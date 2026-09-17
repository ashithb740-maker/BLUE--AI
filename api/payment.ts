type Req = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (value: unknown) => Res };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PRICE_PAISE = 1100;
const UPI_ID = "ashithb740@okicici";

function bearer(req: Req) {
  const value = req.headers?.authorization || req.headers?.Authorization;
  return Array.isArray(value) ? value[0] : value || "";
}

async function sb(path: string, token: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

async function sbAdmin(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = bearer(req);
  if (!token.startsWith("Bearer ")) return res.status(401).json({ error: "Please sign in first." });
  if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "Payment service is not fully configured." });
  }

  const auth = await sb("/auth/v1/user", token);
  if (!auth.ok) return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  const user = await auth.json();

  let body: any;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  if (body.action === "payment-info") {
    const reference = `BLUE-${user.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    return res.status(200).json({
      upiId: UPI_ID,
      amount: 11,
      amountPaise: PRICE_PAISE,
      currency: "INR",
      reference,
      note: "BLUE Pro - 1 year",
    });
  }

  if (body.action === "submit-utr") {
    const utr = String(body.utr || "").trim();
    const reference = String(body.reference || "").trim();
    if (!utr || utr.length < 6 || utr.length > 80) {
      return res.status(400).json({ error: "Please enter a valid UTR / transaction reference number." });
    }
    if (!reference || reference.length > 100) {
      return res.status(400).json({ error: "Payment reference is missing. Please reopen the payment window." });
    }

    const existingResponse = await sbAdmin(
      `/rest/v1/payments?payment_id=eq.${encodeURIComponent(utr)}&select=id,status,user_id&limit=1`
    );
    const existingRows = await existingResponse.json().catch(() => []);
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return res.status(409).json({ error: "This UTR has already been submitted." });
    }

    const insertResponse = await sbAdmin("/rest/v1/payments", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        user_id: user.id,
        order_id: reference,
        payment_id: utr,
        amount_paise: PRICE_PAISE,
        status: "created",
      }),
    });
    if (!insertResponse.ok) {
      const detail = await insertResponse.text().catch(() => "");
      console.error("UPI payment insert failed", detail);
      return res.status(502).json({ error: "Unable to submit your payment request. Please try again." });
    }

    return res.status(200).json({
      success: true,
      status: "pending",
      message: "Payment submitted. Your UTR has been sent for verification.",
    });
  }

  return res.status(400).json({ error: "Unknown payment action." });
}
