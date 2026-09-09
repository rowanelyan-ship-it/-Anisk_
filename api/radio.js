// بروكسي بث إذاعة القرآن الكريم من القاهرة
// المسار: /api/radio.js  →  متاح على الموقع تحت الرابط /api/radio
//
// ليه محتاجين الملف ده؟
// مزودو بث الراديو (radiojar / qurango) بيحجبوا الطلبات الجاية مباشرة من
// المتصفح لو الدومين مش معروف عندهم — لكن لو الطلب جه من سيرفر Vercel
// (زي ما بيعمل الملف ده) بيعاملوه كطلب عادي ويردوا عليه.
// النتيجة: التطبيق بيطلب /api/radio (سيرفره هو)، والسيرفر هو اللي يجيب
// البث من المصدر الحقيقي ويوصّله للمستخدم بدون أي حجب.

const RADIO_SOURCES = [
  "https://backup.qurango.net/radio/cairo",
  "https://backup.qurango.net/radio/mix",
  "https://stream.radiojar.com/8s5u5tpdtwzuv",
];

export const config = {
  // مهم جداً: نوقف Vercel عن تحويل الرد لـ JSON تلقائياً
  // عشان البث الصوتي يعدي بدون تعديل
  api: { responseLimit: false, bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).end("Method Not Allowed");
    return;
  }

  let lastError = null;

  for (const url of RADIO_SOURCES) {
    try {
      const upstream = await fetch(url, {
        headers: {
          // بنبعت User-Agent عادي عشان نتجنب الحجب
          "User-Agent": "Mozilla/5.0 (compatible; radio-proxy/1.0)",
          "Icy-MetaData": "0",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!upstream.ok || !upstream.body) {
        lastError = `${url} → ${upstream.status}`;
        continue;
      }

      // نمرر الـ headers الصوتية للمتصفح
      const contentType = upstream.headers.get("content-type") || "audio/mpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "no-cache, no-store");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Radio-Source", url);
      res.status(200);

      // نمرر البث مباشرة للمتصفح chunk by chunk
      const reader = upstream.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const canContinue = res.write(value);
          if (!canContinue) {
            // المتصفح وقّف الاستماع
            await new Promise((r) => res.once("drain", r));
          }
        }
        res.end();
      };

      req.on("close", () => reader.cancel());
      await pump();
      return;

    } catch (err) {
      lastError = `${url} → ${err.message}`;
      continue;
    }
  }

  // كل المصادر فشلت
  res.status(502).json({ error: "all-sources-failed", detail: lastError });
}
