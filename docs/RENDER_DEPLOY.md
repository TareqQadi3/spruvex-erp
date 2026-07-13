# نشر SpruVex R على Render (رابط حقيقي مجاني)

دليل خطوة بخطوة لنشر النظام كاملًا على [Render.com](https://render.com) — خدمة استضافة لها باقة مجانية حقيقية (بدون بطاقة ائتمان).

> **تنبيه صادق:** هذا الدليل لم يُختبر بتشغيل فعلي (لا يوجد حساب Render أو صلاحية إنشاء خدمات من بيئة العمل الحالية) — لكن كل ملف مذكور هنا (`render.yaml`, الـ Dockerfiles) تم فحصه بعناية ومطابقته لمتطلبات Render الموثقة. إذا ظهرت مشكلة في أي خطوة، أرسل لي رسالة الخطأ وسأصلحها فورًا.

## حدود الباقة المجانية (مهم معرفتها)

- كل خدمة (API، لوحة التحكم، إلخ) "تنام" بعد 15 دقيقة من عدم الاستخدام، وتحتاج ~30 ثانية "لتستيقظ" عند أول طلب بعدها. هذا طبيعي وليس عطلًا.
- قاعدة البيانات المجانية **تُحذف تلقائيًا بعد 30 يومًا** بدون تنبيه إضافي. هذا مناسب "لتجربة النظام على رابط حقيقي" الآن، لكن **غير مناسب لعميل حقيقي يدفع** — قبل ذلك يجب الترقية لباقة مدفوعة (تبدأ من حوالي 7$/شهر لكل خدمة).

## الخطوات

### 1. إنشاء حساب Render
اذهب إلى https://render.com واضغط **Get Started** → سجّل عبر حساب GitHub الخاص بك (الأسهل، يربط المستودع مباشرة).

### 2. ربط المستودع ونشر كل الخدمات دفعة واحدة
1. من لوحة Render، اضغط **New +** → **Blueprint**.
2. اختر مستودع `spruvex-r` (اربط حساب GitHub إن طُلب منك ذلك).
3. اختر الفرع: `claude/spruvex-r-implementation-fythx2`.
4. سيكتشف Render ملف `render.yaml` تلقائيًا ويعرض لك كل الخدمات السبع (API + 5 تطبيقات + قاعدة بيانات).
5. اضغط **Apply** — سيبدأ Render ببناء ونشر كل شيء. **هذا سيفشل جزئيًا في البداية** (لأن قاعدة البيانات تحتاج إعدادًا يدويًا واحدًا — الخطوة التالية) — هذا متوقع تمامًا، تابع.

### 3. الخطوة اليدوية الوحيدة: إنشاء دور قاعدة البيانات الثاني

نظامنا يستخدم دورين منفصلين في قاعدة البيانات لأسباب أمنية (عزل بيانات كل مطعم عن الآخر). Render يُنشئ دورًا واحدًا فقط تلقائيًا (`spruvex_admin`) — يجب إنشاء الدور الثاني (`spruvex_app`) يدويًا مرة واحدة فقط:

1. من لوحة Render، افتح قاعدة البيانات `spruvex-r-db` → انسخ **"External Connection String"**.
2. افتح أي أداة اتصال بـ PostgreSQL (أو أرسل لي رابط الاتصال هذا وسأنفّذ الخطوة التالية نيابة عنك — كلمة المرور هذه مؤقتة على باقة مجانية ويمكن تغييرها لاحقًا).
3. نفّذ هذا الأمر (استبدل `<كلمة-مرور-قوية>` بكلمة مرور من اختيارك):

```sql
CREATE ROLE spruvex_app LOGIN PASSWORD '<كلمة-مرور-قوية>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE spruvex_r TO spruvex_app;
GRANT USAGE ON SCHEMA public TO spruvex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE spruvex_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO spruvex_app;
ALTER DEFAULT PRIVILEGES FOR ROLE spruvex_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO spruvex_app;
```

4. كوّن رابط الاتصال الجديد: خذ نفس "External Connection String" لكن استبدل اسم المستخدم وكلمة المرور بـ `spruvex_app` والكلمة التي اخترتها.
5. من خدمة `spruvex-r-api` في Render → **Environment** → أدخل هذا الرابط في متغيّر `DATABASE_URL`.
6. اضغط **Manual Deploy** لإعادة تشغيل الخدمة.

### 4. بناء الجداول وتعبئة البيانات التجريبية

من خدمة `spruvex-r-api` في Render، افتح تبويب **Shell** (طرفية داخل الخادم الفعلي)، ونفّذ:

```bash
node_modules/.bin/prisma migrate deploy
node_modules/.bin/prisma db seed
```

### 5. جاهز!

افتح الروابط التالية (كل واحد سيأخذ ~30 ثانية للاستيقاظ أول مرة):

| التطبيق | الرابط |
|---|---|
| لوحة التحكم | `https://spruvex-r-dashboard.onrender.com` |
| نقطة البيع | `https://spruvex-r-pos.onrender.com` |
| شاشة المطبخ | `https://spruvex-r-kds.onrender.com` |
| طلب العميل | `https://spruvex-r-ordering.onrender.com` |
| إدارة المنصة | `https://spruvex-r-platform.onrender.com` |

بيانات الدخول التجريبية هي نفسها (`owner@demo.spruvex.local` / `SpruVex-Demo1` وغيرها) — راجع `docs/PILOT_TRIAL_CHECKLIST.md`.

**إذا اخترت اسمًا مختلفًا للخدمات** عن `spruvex-r-api` وغيرها أثناء تطبيق الـ Blueprint، فالروابط أعلاه ستختلف تبعًا لذلك — Render يعرض الرابط الفعلي لكل خدمة في لوحته مباشرة.

## قبل قبول أول عميل حقيقي يدفع

- رقّي قاعدة البيانات وكل خدمة لباقة مدفوعة (الباقة المجانية تُحذف قاعدة البيانات بعد 30 يومًا).
- فعّل SSL/TLS الفعلي (Render يوفره تلقائيًا على نطاق `onrender.com`؛ إذا ربطت نطاقك الخاص لاحقًا، فعّل شهادته من إعدادات كل خدمة).
- اضبط نسخة احتياطية دورية حقيقية لقاعدة البيانات (راجع `docs/DATABASE.md`).
