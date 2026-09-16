import type { VercelRequest, VercelResponse } from "@vercel/node";

type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const safeHistory: GeminiMessage[] = history
    .filter((item: any) =>
      (item?.role === "user" || item?.role === "model") &&
      typeof item?.text === "string" &&
      item.text.trim()
    )
    .slice(-20)
    .map((item: any) => ({
      role: item.role,
      parts: [{ text: item.text.trim() }],
    }));

  safeHistory.push({ role: "user", parts: [{ text: message }] });

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: safeHistory,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.message || "Gemini request failed";
      return res.status(response.status).json({ error: errorMessage });
    }

    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((part: any) => part?.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return res.status(502).json({ error: "Gemini returned an empty response" });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({ error: "Unable to contact Gemini" });
  }
}
