# نشر الأنظمة الثلاثة مجاناً لتجربة SpruVex كاملاً

دليل خطوة بخطوة لتشغيل SpruVex ERP + SpruVex R + الموقع التسويقي على روابط حقيقية، مجاناً بالكامل، عبر [Render.com](https://render.com).

> **تم التحقق فعلياً**: الصور الثلاث (api-server، pos-system، الموقع) بُنيت وشُغّلت محلياً بنجاح عبر Docker في هذه الجلسة — وُجدت وأُصلحت عدة أخطاء حقيقية في ملفات الـ Dockerfile كانت ستمنع أي نشر (ملفات tsconfig مفقودة، مجلد صور مفقود، متغير PORT مطلوب خطأً أثناء البناء). النشر الفعلي على Render نفسه لم يُختبر (لا يوجد حساب) لكن كل شيء أُثبت أنه يبني ويعمل.

## حدود النسخة المجانية (مهم معرفتها)

- كل خدمة "تنام" بعد 15 دقيقة من عدم الاستخدام، وتحتاج ~30 ثانية "لتستيقظ" عند أول طلب. طبيعي وليس عطلاً.
- **مناسب تماماً الآن** (تجربة النظام على رابط حقيقي، عرضه لأكثر من مشترك) — **غير مناسب** لعميل حقيقي يدفع (قبل ذلك: ترقية للباقة المدفوعة + نطاقك الخاص).

---

## الخطوة 1 — إنشاء حساب Render (مرة واحدة فقط)

اذهب إلى https://render.com → **Get Started** → سجّل عبر حساب GitHub الخاص بك (الأسهل، يربط المستودع مباشرة، بلا بطاقة ائتمان).

---

## الخطوة 2 — نشر SpruVex R (نظام المطاعم)

1. من لوحة Render: **New +** → **Blueprint**.
2. اختر مستودع `spruvex-erp` → المسار `spruvex-r/render.yaml` (أو أدخل الفرع `main` إذا طُلب).
3. اضغط **Apply**. سيبني Render 6 خدمات (API + 5 واجهات) + قاعدة بيانات.
4. **الخطوة اليدوية الوحيدة** (خاصة بأمان عزل بيانات المطاعم): افتح `spruvex-r/docs/RENDER_DEPLOY.md` في المستودع واتبع "الخطوة 3" بالضبط (إنشاء دور قاعدة بيانات ثانٍ `spruvex_app`) — أو أرسل لي رابط اتصال قاعدة البيانات (External Connection String) من لوحة Render وسأنفّذها نيابة عنك.
5. بعدها من تبويب **Shell** لخدمة `spruvex-r-api`:
   ```bash
   node_modules/.bin/prisma migrate deploy
   node_modules/.bin/prisma db seed
   ```
6. جاهز — الروابط ستكون بصيغة `https://spruvex-r-dashboard.onrender.com` وهكذا. بيانات الدخول التجريبية: `owner@demo.spruvex.local` / `SpruVex-Demo1`.

---

## الخطوة 3 — إنشاء قاعدة بيانات مجانية لـ SpruVex ERP (Neon)

SpruVex ERP يستخدم Neon (PostgreSQL) — **لا تستخدم قاعدة بياناتك الحالية للتطوير**، أنشئ مشروعاً منفصلاً للتجربة:

1. اذهب إلى https://neon.tech → أنشئ حساباً (مجاني، بلا بطاقة) → **New Project** → اسمه مثلاً `spruvex-trial`.
2. من لوحة المشروع، انسخ **Connection String** (يبدأ بـ `postgresql://...`).
3. احتفظ به — ستحتاجه في الخطوة التالية.

---

## الخطوة 4 — نشر SpruVex ERP (API + نقطة البيع)

1. من لوحة Render: **New +** → **Blueprint** → اختر `spruvex-erp` → المسار `spruvex-app/render.yaml`.
2. اضغط **Apply**. سيطلب منك Render قيمة `DATABASE_URL` — الصق رابط Neon من الخطوة السابقة.
3. سيبني خدمتين: `spruvex-api` و `spruvex-pos`.
4. **بناء الجداول** (مرة واحدة، من جهازك مباشرة — الأسهل):
   ```bash
   cd spruvex-app/lib/db
   DATABASE_URL="<رابط Neon الذي نسخته>" pnpm run migrate
   ```
5. جاهز — الروابط: `https://spruvex-api.onrender.com` (API) و `https://spruvex-pos.onrender.com` (نقطة البيع/لوحة ERP).

---

## الخطوة 5 — نشر الموقع التسويقي

1. من لوحة Render: **New +** → **Blueprint** → اختر `spruvex-erp` → المسار `spruvex-site/render.yaml`.
2. اضغط **Apply** — لا توجد أي قيم يجب إدخالها، كل شيء جاهز تلقائياً (مربوط مسبقاً بروابط SpruVex ERP أعلاه).
3. الرابط: `https://spruvex-site.onrender.com`.

---

## الملخص — بعد اكتمال الخطوات الخمس

| النظام | الرابط |
|---|---|
| SpruVex ERP (لوحة/نقطة بيع) | `https://spruvex-pos.onrender.com` |
| SpruVex ERP (API) | `https://spruvex-api.onrender.com` |
| SpruVex R — لوحة تحكم المطعم | `https://spruvex-r-dashboard.onrender.com` |
| SpruVex R — نقطة البيع | `https://spruvex-r-pos.onrender.com` |
| SpruVex R — شاشة المطبخ | `https://spruvex-r-kds.onrender.com` |
| SpruVex R — طلب العميل | `https://spruvex-r-ordering.onrender.com` |
| الموقع التسويقي | `https://spruvex-site.onrender.com` |

**إذا اخترت أسماء خدمات مختلفة** أثناء تطبيق أي Blueprint، الروابط أعلاه ستختلف — Render يعرض الرابط الفعلي لكل خدمة في لوحته مباشرة.

## إذا واجهت أي خطأ في أي خطوة

أرسل لي رسالة الخطأ (لقطة شاشة كافية) وسأحدد السبب وأصلحه في الكود مباشرة — كل الأخطاء التي ظهرت أثناء تجهيز هذا الدليل كانت في ملفات الإعداد نفسها وتم إصلاحها بالفعل.

## قبل قبول أول عميل حقيقي يدفع

- رقّي كل خدمة (والقاعدتين) لباقة مدفوعة.
- اربط نطاقك (`spruvex.com`، مسجّل حالياً في IONOS) بدل روابط `onrender.com` — يتم من إعدادات كل خدمة في Render (Custom Domain) + تحديث سجلات DNS في IONOS.
- فعّل النسخ الاحتياطي الدوري لقاعدتي البيانات.
