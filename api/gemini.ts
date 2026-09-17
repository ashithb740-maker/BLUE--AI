type GeminiMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

type RequestWithBody = {
  method?: string;
  body?: unknown;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (value: unknown) => ResponseLike;
};

export default async function handler(req: RequestWithBody, res: ResponseLike) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "AI service is not configured" });
  }

  let body: any;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
  } catch {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];
  const timeZone = typeof body.timeZone === "string" && body.timeZone.trim() ? body.timeZone.trim() : "UTC";

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

  safeHistory.push({
    role: "user",
    parts: [{
      text: `[Current date/time context: ${new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "long",
        timeZone,
      }).format(new Date())}; timezone: ${timeZone}]

${message}`,
    }],
  });

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: safeHistory,
          systemInstruction: {
            parts: [{
              text: "You are BLUE, an AI assistant. The current date and time are provided in the user's latest message. Treat that date/time as authoritative for questions about today, tomorrow, yesterday, current date, current time, day of week, or relative dates. Never invent an old date from training knowledge. Do not mention the underlying AI provider or model unless the user explicitly asks what technology powers BLUE.",
            }],
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("AI provider request failed:", data?.error?.message || response.status);
      return res.status(response.status).json({ error: "The AI service could not complete that request." });
    }

    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((part: any) => part?.text ?? "")
      .join("")
      .trim();

    if (!text) {
      return res.status(502).json({ error: "The AI service returned an empty response." });
    }

    return res.status(200).json({ text });
  } catch (error) {
    console.error("AI API error:", error);
    return res.status(500).json({ error: "Unable to contact the AI service." });
  }
}
