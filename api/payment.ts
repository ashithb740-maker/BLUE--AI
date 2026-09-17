import crypto from "node:crypto";

type Req = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> };
type Res = { status: (code: number) => Res; json: (value: unknown) => Res };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const PRICE_PAISE = 1100;

function bearer(req: Req) {
  const value = req.headers?.authorization || req.headers?.Authorization;
  return Array.isArray(value) ? value[0] : value || "";
}

async function sb(path: string, token: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { apikey: SUPABASE_KEY, Authorization: token, "Content-Type": "application/json", ...(options.headers || {}) } });
}

async function sbAdmin(path: string, options: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}${path}`, { ...options, headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json", ...(options.headers || {}) } });
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const token = bearer(req);
  if (!token.startsWith("Bearer ")) return res.status(401).json({ error: "Please sign in first." });
  if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SERVICE_KEY) return res.status(500).json({ error: "Payment service is not fully configured." });

  const auth = await sb("/auth/v1/user", token);
  if (!auth.ok) return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  const user = await auth.json();
  const body: any = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const action = body.action;

  if (action === "create-order") {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return res.status(500).json({ error: "Razorpay is not configured yet." });
    const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: PRICE_PAISE, currency: "INR", receipt: `blue_${user.id.slice(0, 8)}_${Date.now()}`, notes: { user_id: user.id, plan: "blue_pro_yearly" } }) });
    const order = await orderResponse.json();
    if (!orderResponse.ok) return res.status(502).json({ error: "Unable to create the payment order." });
    await sbAdmin("/rest/v1/payments", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ user_id: user.id, order_id: order.id, amount_paise: PRICE_PAISE, status: "created" }) });
    return res.status(200).json({ keyId: RAZORPAY_KEY_ID, orderId: order.id, amount: PRICE_PAISE, currency: "INR", email: user.email || "" });
  }

  if (action === "verify") {
    const orderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");
    if (!orderId || !paymentId || !signature || !RAZORPAY_KEY_SECRET) return res.status(400).json({ error: "Invalid payment verification data." });
    const recordResponse = await sbAdmin(`/rest/v1/payments?order_id=eq.${encodeURIComponent(orderId)}&select=id,user_id,amount_paise,status&limit=1`);
    const records = await recordResponse.json();
    const record = records?.[0];
    if (!record || record.user_id !== user.id || record.status === "paid") return res.status(400).json({ error: "Payment order could not be verified." });
    const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.status(400).json({ error: "Payment signature verification failed." });

    const premiumUntil = new Date();
    premiumUntil.setUTCFullYear(premiumUntil.getUTCFullYear() + 1);
    await sbAdmin(`/rest/v1/payments?id=eq.${encodeURIComponent(record.id)}`, { method: "PATCH", body: JSON.stringify({ payment_id: paymentId, status: "paid" }) });
    await sbAdmin(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ plan: "pro", premium_until: premiumUntil.toISOString(), updated_at: new Date().toISOString() }) });
    return res.status(200).json({ success: true, plan: "pro", premiumUntil: premiumUntil.toISOString() });
  }

  return res.status(400).json({ error: "Unknown payment action." });
}
