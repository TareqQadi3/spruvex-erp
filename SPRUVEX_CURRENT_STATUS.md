# SpruVex ERP — Current Status

> آخر تحديث: 2026-07-09 (بعد إتمام المرحلة 4)

## نظرة عامة | Overview

منصة ERP + POS SaaS متعددة المستأجرين تستهدف السوق السعودي (توافق ZATCA).

Multi-tenant ERP + POS SaaS platform targeting the Saudi market (ZATCA compliance).

## بنية المستودع | Repository Layout

مستودع واحد موحّد على GitHub (`TareqQadi3/spruvex-erp`) — لا توجد مستودعات git داخلية متداخلة بعد الآن.

| المسار | الوصف |
|---|---|
| `spruvex-app/` | التطبيق الرئيسي (pnpm monorepo): باكند Express + فرونتند React POS + سكيما Drizzle |
| `spruvex-site/` | الموقع التسويقي (منفصل — سيُعاد تطويره لاحقاً) |
| `database_schema*.sql` | مرجع SQL تاريخي — **المصدر الرسمي للسكيما هو `spruvex-app/lib/db` (Drizzle)** |
| `PROJECT_VISION*.md` | رؤية المشروع والنموذج التجاري (3 باقات + Enterprise) |

> تاريخ Git الكامل لكل من `spruvex-app` و`spruvex-site` (قبل الدمج) محفوظ في فروع `archive/spruvex-app` و`archive/spruvex-site`.

## حالة الوحدات | Module Status

- **Backend** (`spruvex-app/artifacts/api-server`): auth, rbac, pos, inventory, sync, zatca, subscriptions, platform (بنية modular) + مسارات legacy (products, repairs, reports, settings...)
- **Frontend** (`spruvex-app/artifacts/pos-system`): POS, dashboard, inventory, repairs, accounting, reports, settings, signup wizard + i18n عربي/إنجليزي
- **Database** (`spruvex-app/lib/db`): سكيما Drizzle تشمل multi-tenancy، ZATCA، subscriptions/company_addons، branches، product 2.0 (price lists, units/UOM, variants, e-commerce)، وأساس موديول المطاعم (بلا واجهة بعد)
- **مكتمل بالمرحلة 2**: تعيين فني الصيانة + بوابة موافقة العميل، مرتجعات المبيعات/المشتريات، سجل حركات المخزون وتحويل المستودعات، دورة البيع بالتقسيط الكاملة، إدارة الحسابات وميزان المراجعة
- **مكتمل بالمرحلة 3**: تسجيل شركة جديدة (signup wizard 3 خطوات) ينشئ tenant + branch + settings + اشتراك trial في معاملة واحدة، تعيين الموديولات حسب نوع النشاط
- **مكتمل بالمرحلة 4**: نظام باقات وإضافات (plan/addon catalog كـ code constants)، `company_addons`، `users.isPlatformAdmin`، `planLimitsService` كمصدر وحيد لحالة الاشتراك الفعلية (trial/active/expired/suspended)، middleware لفرض الموديولات والحدود على مستوى الـ API، مسارات `/api/platform/*` لإدارة الشركات (تغيير باقة، إيقاف/تفعيل، تفعيل إضافات، تجديد اشتراك يدوي). لا توجد بوابة دفع بعد (Mada/Tabby/Tamara/Stripe مخطط لها لاحقاً، البنية جاهزة لها)

## التشغيل المحلي | Local Development

```powershell
cd spruvex-app
.\run-local.ps1   # يشغّل API (منفذ من .env) + Vite frontend
```

المتغيرات في `spruvex-app/.env` (غير متتبَّع في git): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `VITE_PORT`.

## ملاحظات | Notes

- لا تضع أسراراً أو توكنات في أي ملف متتبَّع في git.
- قاعدة البيانات حالياً Neon PostgreSQL سحابية (وليست محلية) — هي بيئة التطوير الرسمية حتى مرحلة النشر.
- خارطة الطريق الكاملة (11 مرحلة) موثقة في محادثات التطوير — المراحل 1-4 مكتملة. المرحلة الحالية: **المرحلة 5 — نظام دعم العملاء (Customer Support / Tickets)**.
