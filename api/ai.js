export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY غير مُعرَّف.",
    });
  }

  try {
    const { system, messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "لم يتم إرسال أي رسالة إلى المساعد.",
      });
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    const rawText = await upstream.text();

    let data;

    try {
      data = JSON.parse(rawText);
    } catch {
      return res.status(502).json({
        error: "استجابة غير متوقعة من خدمة الذكاء الاصطناعي.",
      });
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error:
          data?.error?.message ||
          "تعذّر الاتصال بالمساعد.",
      });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({
      error: "خطأ غير متوقع في الخادم: " + (e?.message || String(e)),
    });
  }
}