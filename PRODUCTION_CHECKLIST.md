# قائمة الإطلاق للإنتاج | Production Launch Checklist

> آخر تحديث: 2026-07-10 — قبل أول إطلاق تجريبي (Trial Launch)

## 1) الاستضافة المقترحة

- **قاعدة البيانات**: Neon (مستمرة من بيئة التطوير) — أنشئ فرعاً/مشروعاً منفصلاً لـ Production عن Development (لا تُشارك نفس القاعدة بين البيئتين إطلاقاً).
- **API + Worker**: أي مزوّد حاويات يدعم Dockerfile قياسي (Railway، Render، Fly.io، أو VPS + docker-compose الجاهز في `docker-compose.yml`). يحتاج: Redis (لتحديد المعدل الموزّع والـ background jobs)، متغيرات البيئة من `spruvex-app/.env.example`.
- **pos-system وspruvex-site**: ملفات ثابتة (static build) — يمكن نشرها عبر أي CDN/استضافة ثابتة (Vercel، Netlify، Cloudflare Pages) أو عبر nginx المرفق في `deploy/nginx/`.
- **الحد الأدنى لبيئة تجريبية (Trial)**: عملية API واحدة + عملية Worker واحدة + Redis صغير + استضافة ثابتة للواجهتين. يمكن التوسّع لاحقاً.

## 2) إعداد النطاق DNS

- [ ] تسجيل نطاق رسمي (مثال: `spruvex.com`).
- [ ] سجلات DNS: `app.spruvex.com` (pos-system) → استضافة الواجهة، `api.spruvex.com` (API) → الخادم الخلفي، `spruvex.com` (الموقع التسويقي) → spruvex-site.
- [ ] إن استُخدم nginx كـ reverse proxy على خادم واحد: توجيه الثلاثة إلى نفس IP، والتفريق عبر `server_name` (القالب جاهز في `deploy/nginx/nginx.conf`، يحتاج استبدال كل `CHANGE_ME`).

## 3) SSL/HTTPS

- [ ] شهادات حقيقية (Let's Encrypt عبر certbot، أو شهادة من مزوّد الاستضافة) — القالب في `deploy/nginx/nginx.conf` جاهز لاستقبالها في `/etc/nginx/certs/`.
- [ ] تأكيد التحويل التلقائي من HTTP إلى HTTPS (موجود في القالب).
- [ ] تفعيل `TRUST_PROXY=true` في متغيرات بيئة API **فقط** عند وجود reverse proxy حقيقي أمامه (راجع تعليق `config/env.ts`) — تفعيله بلا proxy فعلي يفتح ثغرة انتحال IP.

## 4) متغيرات البيئة (Production)

انسخ من `spruvex-app/.env.example` و`spruvex-site/.env.example` وامْلأ **قيماً حقيقية مختلفة عن بيئة التطوير**:

| المتغير | ملاحظة |
|---|---|
| `DATABASE_URL` | قاعدة Production منفصلة عن Development |
| `JWT_SECRET` | سلسلة عشوائية طويلة جديدة (`openssl rand -base64 32`) — **ليست** نفس مفتاح التطوير |
| `NODE_ENV=production` | يُفعّل الفحوصات الصارمة (JWT_SECRET إلزامي، CORS مقفل افتراضياً) |
| `ALLOWED_ORIGINS` | نطاقات app.spruvex.com/spruvex.com الحقيقية فقط |
| `REDIS_URL` | مثيل Redis حقيقي (وإلا يعمل النظام بحماية أضعف في-العملية فقط) |
| `TRUST_PROXY` | `true` فقط إذا كان هناك reverse proxy فعلي |
| `AI_PROVIDER` / `ANTHROPIC_API_KEY` | اختياري — اتركه `mock` حتى تقرر مزوّد الذكاء الاصطناعي الفعلي |
| `VITE_API_URL` / `VITE_APP_URL` (site) | تشير للنطاقات الحقيقية، تُبنى وقت البناء (build-time) وليس runtime |
| `VITE_ADMIN_PANEL_PASSWORD` (site) | كلمة مرور حقيقية — لوحة إدارة الموقع التسويقي gate حماية أساسي فقط (موثّق كقيد معروف) |

**لا تضع أي قيمة حقيقية داخل الكود أو GitHub** — تحقّقنا فعلياً أن `.gitignore` يستثني `.env`/`.env.*` مع نفي صريح لـ`.env.example`، وأن لا أسرار حقيقية موجودة في الملفات المتتبَّعة حالياً.

## 5) قاعدة بيانات Production

- [ ] إنشاء مشروع/فرع Neon منفصل باسم واضح (`spruvex-production`).
- [ ] تطبيق كل الـ migrations من الصفر: `pnpm run migrate` من `spruvex-app/lib/db` مع `DATABASE_URL` يشير لقاعدة الإنتاج.
- [ ] **لا** تُشغّل `backfillDefaultWarehouses.ts` أو أي سكريبت بيانات اختبار على قاعدة الإنتاج — هي فارغة أصلاً.
- [ ] تشغيل `scripts/seedPlatformAdmin.ts` مرة واحدة لإنشاء حساب المشرف الأول (بيانات دخول حقيقية، ليست تجريبية).
- [ ] تأكيد أن مصنّف CI (migration-drift check) يمر بلا أخطاء قبل كل نشر.

## 6) النسخ الاحتياطي والاستعادة

- Neon يوفر نسخاً احتياطية تلقائية (point-in-time recovery) — **يجب تفعيل خطة تدعم هذا** على مشروع الإنتاج تحديداً (تحقق من إعدادات خطة Neon المُستخدمة).
- [ ] توثيق إجراء الاستعادة الفعلي (اختبار استعادة فعلي مرة واحدة قبل الإطلاق: استعادة نسخة إلى فرع منفصل، تشغيل التطبيق ضدها، تأكيد سلامة البيانات).
- **خطة Rollback عند نشر يحمل مشكلة**:
  1. الكود: العودة للـ commit السابق على `main` وإعادة النشر (صور Docker موسومة بالـ commit hash تسهّل هذا).
  2. القاعدة: migrations هذا المشروع تراكمية وإضافية فقط (لا `DROP`/`DELETE` مدمّرة في أي migration حتى الآن — تم التحقق) — التراجع عن الكود لا يتطلب عكس migration في الحالة الشائعة. إن احتاج migration مستقبلي عكساً، يُكتب migration جديد يعكسه صراحة، لا `git revert` على ملف migration مُطبَّق فعلياً.
  3. عند فشل حرج: نقطة استعادة Neon الزمنية كخيار أخير.

## 7) المراقبة

- [ ] **Structured logging**: موجود فعلياً (pino، JSON في الإنتاج) — وجّه المخرجات لخدمة تجميع سجلات (مثال: Better Stack، Datadog، أو حتى ملفات + `journalctl` على VPS).
- [ ] **Error tracking**: لا توجد خدمة تتبّع أخطاء مُدمجة بعد (مثل Sentry) — البنية جاهزة للإضافة (نقطة واحدة: `core/errors/errorHandler.ts`) لكنها غير مفعّلة. أضِفها قبل الإطلاق العام (يمكن تجاوزها لتجربة داخلية صغيرة جداً).
- [ ] **Audit logs**: موجودة فعلياً (`core/logging/auditLogger.ts`) لكل حدث حسّاس (بيع، فاتورة، تغيير باقة...) — تصدر كسجلات منظّمة، راجع تجميعها ضمن نفس خدمة السجلات.
- [ ] **Health/Uptime**: `/healthz` (liveness) و`/readyz` (فحص حقيقي لقاعدة البيانات وRedis) جاهزان — اربطهما بخدمة uptime monitoring خارجية (UptimeRobot، Better Stack، إلخ) تنبّه فوراً عند تعطّل.
- [ ] **مراقبة القاعدة والطوابير**: راقب اتصالات Neon (pool usage) وطابور BullMQ (Worker) — لا توجد لوحة مراقبة مُدمجة بعد؛ الحد الأدنى: تنبيه uptime على `/readyz` يغطي القاعدة، ومراقبة يدوية لسجلات الـ Worker مبدئياً.
- [ ] **تنبيهات الأخطاء الحرجة**: اربط خدمة تتبع الأخطاء (أعلاه) بقناة تنبيه فورية (Slack/بريد) لأي خطأ 500 متكرر أو فشل دفعة/فاتورة ZATCA.

## 8) قبل الضغط على زر الإطلاق

- [ ] كل الفحوصات في `.github/workflows/ci.yml` خضراء على آخر commit.
- [ ] اختبار حي كامل (نفس سلسلة E2E التي تحقّقنا منها) منفّذ ضد بيئة الإنتاج فعلياً بعد النشر الأول (ليس فقط ضد بيئة التطوير).
- [ ] `NODE_ENV=production` مضبوط فعلياً (وليس منسياً كـ `development`).
- [ ] لا حسابات دخول تجريبية ظاهرة في أي واجهة (تحقّقنا وأزلناها من `pos-system`).
- [ ] التكاملات الخارجية (سلة/زد/Shopify، Tabby/Tamara/Moyasar) **تبقى بوضع mock** — لا تُفعَّل ببيانات حقيقية قبل توفر حسابات مطوّر رسمية.
