# SpruVex ERP — Current Status

> آخر تحديث: 2026-07-09 (بعد إتمام المرحلة 6)

## نظرة عامة | Overview

منصة ERP + POS SaaS متعددة المستأجرين تستهدف السوق السعودي (توافق ZATCA).

Multi-tenant ERP + POS SaaS platform targeting the Saudi market (ZATCA compliance).

## بنية المستودع | Repository Layout

مستودع واحد موحّد على GitHub (`TareqQadi3/spruvex-erp`) — لا توجد مستودعات git داخلية متداخلة بعد الآن.

| المسار | الوصف |
|---|---|
| `spruvex-app/` | التطبيق الرئيسي (pnpm monorepo): باكند Express + فرونتند React POS + سكيما Drizzle |
| `spruvex-site/` | الموقع التسويقي (مشروع مستقل تماماً — Vite + React، بلا أي اعتماد على Replit) |
| `database_schema*.sql` | مرجع SQL تاريخي — **المصدر الرسمي للسكيما هو `spruvex-app/lib/db` (Drizzle)** |
| `PROJECT_VISION*.md` | رؤية المشروع والنموذج التجاري (3 باقات + Enterprise) |

> تاريخ Git الكامل لكل من `spruvex-app` و`spruvex-site` (قبل الدمج) محفوظ في فروع `archive/spruvex-app` و`archive/spruvex-site`.

## حالة الوحدات | Module Status

- **Backend** (`spruvex-app/artifacts/api-server`): auth, rbac, pos, inventory, sync, zatca, subscriptions, platform, support, public (بنية modular) + مسارات legacy (products, repairs, reports, settings...)
- **الموقع التسويقي** (`spruvex-site/artifacts/spruvex-site`): Vite + React SPA مستقل تماماً، 9 صفحات (رئيسية، ERP، POS، مطاعم، مبيعات وصيانة، باقات، مميزات، أسئلة شائعة، تواصل)، عربي RTL / إنجليزي LTR
- **Frontend** (`spruvex-app/artifacts/pos-system`): POS, dashboard, inventory, repairs, accounting, reports, settings, signup wizard + i18n عربي/إنجليزي
- **Database** (`spruvex-app/lib/db`): سكيما Drizzle تشمل multi-tenancy، ZATCA، subscriptions/company_addons، branches، product 2.0 (price lists, units/UOM, variants, e-commerce)، وأساس موديول المطاعم (بلا واجهة بعد)
- **مكتمل بالمرحلة 2**: تعيين فني الصيانة + بوابة موافقة العميل، مرتجعات المبيعات/المشتريات، سجل حركات المخزون وتحويل المستودعات، دورة البيع بالتقسيط الكاملة، إدارة الحسابات وميزان المراجعة
- **مكتمل بالمرحلة 3**: تسجيل شركة جديدة (signup wizard 3 خطوات) ينشئ tenant + branch + settings + اشتراك trial في معاملة واحدة، تعيين الموديولات حسب نوع النشاط
- **مكتمل بالمرحلة 4**: نظام باقات وإضافات (plan/addon catalog كـ code constants)، `company_addons`، `users.isPlatformAdmin`، `planLimitsService` كمصدر وحيد لحالة الاشتراك الفعلية (trial/active/expired/suspended)، middleware لفرض الموديولات والحدود على مستوى الـ API، مسارات `/api/platform/*` لإدارة الشركات (تغيير باقة، إيقاف/تفعيل، تفعيل إضافات، تجديد اشتراك يدوي). لا توجد بوابة دفع بعد (Mada/Tabby/Tamara/Stripe مخطط لها لاحقاً، البنية جاهزة لها)
- **مكتمل بالمرحلة 5**: نظام تذاكر دعم العملاء على مستوى المنصة (الشركة/tenant تفتح تذكرة مع فريق SpruVex) — جداول `support_tickets`, `support_ticket_messages`, `support_ticket_attachments` (بيانات وصفية فقط، بلا backend رفع ملفات)، `support_ticket_status_history`، وجدول `notifications` عام. حالات: open/pending/in_progress/resolved/closed، أولويات: low/medium/high/critical. مسارات المستأجر `/api/support/*` ومسارات الإدارة الملحقة بـ `/api/platform/support/*`. أساس WhatsApp/Chatbot في السكيما فقط (`channel` enum) بلا تكامل فعلي
- **مكتمل بالمرحلة 6**: إعادة بناء `spruvex-site` بالكامل فوق الأساس الموجود (بدون بدء من الصفر):
  - **تنظيف Replit**: حذف كل ملفات/إعدادات Replit (`.replit`, `.replit-artifact`, plugins في `vite.config.ts`, تبعيات `@replit/*`)، إزالة override كان يمنع تشغيل الموقع خارج بيئة Replit linux-x64 (ثغرة حقيقية اكتُشفت أثناء التحقق — كانت تمنع تشغيل الموقع على أي جهاز غير Replit)، حذف مشاريع sandbox/api-server المكررة غير المستخدمة داخل `spruvex-site`.
  - **صفحات حقيقية متعددة** عبر `wouter` بدل صفحة واحدة بروابط داخلية: 9 صفحات (رئيسية، ERP، POS، مطاعم، مبيعات وصيانة، باقات، مميزات، أسئلة شائعة، تواصل).
  - **أسعار حقيقية من الباكند**: `PLAN_CATALOG` في `lib/db` أُضيف له `nameAr/nameEn/taglineAr/taglineEn/priceMonthlySar`، ونقطة API عامة غير محمية `GET /api/public/plans` (موديول `modules/public` جديد) تُغذّي صفحة الباقات مباشرة — لا يوجد أي سعر مكتوب داخل كود الموقع. تم التحقق حياً أن تغيير السعر في الباكند ينعكس فوراً على الموقع.
  - **ربط التسجيل**: كل أزرار "ابدأ الآن" تفتح `/signup` الحقيقي في `pos-system` (مع `?plan=` عند الاختيار من بطاقة باقة محددة)، وتم تعديل بسيط في `pos-system/src/pages/signup.tsx` لقراءة هذا الباراميتر وتحديد الباقة تلقائياً في الخطوة الثالثة. تم التحقق الحي الكامل: من صفحة الباقات → التسجيل مع الباقة محددة مسبقاً → إنشاء tenant حقيقي → الوصول إلى Dashboard.
  - **لوحة إدارة أساسية** (`AdminPanel.tsx`, `?admin`): لإدارة نصوص الصفحة الرئيسية والأسئلة الشائعة والعروض (لا تزال تخزّن في localStorage — أساس فقط، ربطها بنظام Admin حقيقي مؤجل لمرحلة لاحقة كما طُلب). الأسعار لم تعد قابلة للتعديل من هنا (تُدار من الباكند فقط).
  - **SEO**: عناوين/أوصاف ديناميكية لكل صفحة، `sitemap.xml` و`robots.txt` حقيقيان، JSON-LD Organization في `index.html`.
  - بقيت مشكلة حقيقية اكتُشفت أثناء التحقق المستقل (غير مبلّغ عنها من الوكيل المنفّذ) وتم إصلاحها: تسميات الإضافات (add-ons) في صفحة الباقات كانت تعرض رموزاً خام غير مترجمة لعدم تطابق قائمة الأكواد المفترَضة مع `ADDON_CATALOG` الحقيقي في الباكند.

## التشغيل المحلي | Local Development

```powershell
cd spruvex-app
.\run-local.ps1   # يشغّل API (منفذ من .env) + Vite frontend
```

المتغيرات في `spruvex-app/.env` (غير متتبَّع في git): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `VITE_PORT`.

لتشغيل الموقع التسويقي محلياً: `pnpm -C spruvex-site --filter @workspace/spruvex-site run dev` مع `PORT`, `BASE_PATH`, `VITE_API_URL` (رابط الـ API، افتراضياً `http://localhost:5000`), `VITE_APP_URL` (رابط pos-system لأزرار "ابدأ الآن"، افتراضياً `http://localhost:5173`).

## ملاحظات | Notes

- لا تضع أسراراً أو توكنات في أي ملف متتبَّع في git.
- قاعدة البيانات حالياً Neon PostgreSQL سحابية (وليست محلية) — هي بيئة التطوير الرسمية حتى مرحلة النشر.
- خارطة الطريق الكاملة (11 مرحلة) موثقة في محادثات التطوير — المراحل 1-6 مكتملة. بانتظار توجيه المرحلة 7.
