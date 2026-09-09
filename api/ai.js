// دالة Vercel الخادمية (Serverless Function) — بروكسي آمن بين التطبيق و Anthropic API.
// المسار: /api/ai.js  →  متاحة تلقائيًا على الموقع بعد النشر تحت الرابط /api/ai
// (Vercel بيحوّل أي ملف جوّه مجلد /api لنقطة نهاية API تلقائيًا، من غير إعداد إضافي).
//
// ليه محتاجين الملف ده أصلًا؟
// المتصفح مايقدرش يتصل بـ https://api.anthropic.com مباشرة: أولًا لازم مفتاح API
// سرّي، ومفتاح زي ده لو اتحط في كود الواجهة (App.jsx) هيبقى ظاهر لأي حد يفتح
// "عرض المصدر" ويسرقه. وثانيًا Anthropic أصلًا بيرفض نداءات مباشرة من متصفحات
// خارجية (CORS). فالحل المعتمد هو: الطلب يروح من متصفح المستخدمة لسيرفر Vercel
// (الملف ده)، والسيرفر بس (مش المتصفح) هو اللي عنده المفتاح السري ويكلّم
// Anthropic نيابة عنها، ويرجّع الرد للمتصفح.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method-not-allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // الرسالة دي بتظهر مباشرة في تبويب "اسأل أنيسك" لو المفتاح مش مضاف —
    // عشان تعرفي فورًا إن المشكلة هنا بالظبط، مش في الكود نفسه.
    res.status(500).json({
      error:
        "المفتاح السري (ANTHROPIC_API_KEY) مش مضاف على السيرفر. من Vercel: Settings → Environment Variables، ضيفي متغيّر باسم ANTHROPIC_API_KEY وقيمته مفتاح API بتاعك من console.anthropic.com، بعدين اعملي Redeploy (النشر الجديد بس هو اللي بياخد المتغيّر).",
    });
    return;
  }

  try {
    const { system, messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "invalid-request: مفيش رسائل مبعوتة" });
      return;
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
        max_tokens: 1024,
        system: system || undefined,
        messages,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      // بنمرر رسالة الخطأ الحقيقية من Anthropic (مفتاح غلط، رصيد خلص، الموديل
      // مش متاح...) بدل ما نخبيها، عشان تعرفي بالظبط المشكلة فين.
      res.status(upstream.status).json({ error: data?.error?.message || `upstream-error-${upstream.status}` });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "server-error: " + (err?.message || "غير معروف") });
  }
}
