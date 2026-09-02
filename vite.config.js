import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// بروكسي محلي لمسار /api/ai أثناء "npm run dev" فقط — بدون الإضافة دي، ميزة
// "اسأل أنيسك AI" ما كانتش هتشتغل خالص محليًا، لأن /api/ai مسار خاص بدوال
// Vercel الحقيقية (Serverless Functions) ومش موجود أثناء التطوير المحلي العادي؛
// أي طلب ليه كان بيرجع صفحة index.html نفسها (200) بدل خطأ واضح، فالتطبيق كان
// يفشل بصمت. الإضافة دي بتحاكي نفس دالة api/ai.js بالظبط، بس شغالة جوه سيرفر
// التطوير نفسه. المفتاح بيتقرأ من ملف .env محلي (مش مرفوع على GitHub — موجود في
// .gitignore) ومبيوصلش لكود المتصفح أبدًا. على Vercel، الدالة الحقيقية اللي
// بتشتغل فعليًا هي api/ai.js — الإضافة دي مالهاش أي تأثير على النشر هناك.
function localAiApiPlugin(env) {
  return {
    name: "local-ai-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || req.url !== "/api/ai") return next();
        const apiKey = env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            error:
              "ANTHROPIC_API_KEY غير موجود محليًا. أنشئي ملف باسم .env في جذر المشروع (بجانب package.json) وضعي بداخله سطر: ANTHROPIC_API_KEY=مفتاحك_هنا ثم أعيدي تشغيل npm run dev.",
          }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("error", () => next());
        req.on("end", async () => {
          try {
            const { system, messages } = body ? JSON.parse(body) : {};
            const upstream = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages }),
            });
            const data = await upstream.json();
            res.statusCode = upstream.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          } catch {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "حدث خطأ غير متوقع أثناء الاتصال محليًا بالمساعد." }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // تحميل كل متغيرات البيئة (بدون اشتراط بادئة VITE_) — بس داخل ملف الإعداد ده
  // نفسه (بيئة Node وقت التطوير)، مش داخل كود العميل، فالمفتاح يفضل سرّي فعليًا.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), localAiApiPlugin(env)],
  };
});
