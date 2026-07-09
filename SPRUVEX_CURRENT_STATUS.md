# SpruVex ERP — Current Status

> آخر تحديث: 2026-07-09

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

- **Backend** (`spruvex-app/artifacts/api-server`): auth, rbac, pos, inventory, sync, zatca (بنية modular) + مسارات legacy (products, repairs, reports, settings...)
- **Frontend** (`spruvex-app/artifacts/pos-system`): POS, dashboard, inventory, repairs, accounting, reports, settings + i18n عربي/إنجليزي
- **Database** (`spruvex-app/lib/db`): سكيما Drizzle (60+ جدولاً) تشمل multi-tenancy، ZATCA، subscriptions، وأساس موديول المطاعم (بلا واجهة بعد)
- **مكتمل بالمرحلة 2**: تعيين فني الصيانة + بوابة موافقة العميل، مرتجعات المبيعات/المشتريات، سجل حركات المخزون وتحويل المستودعات، دورة البيع بالتقسيط الكاملة، إدارة الحسابات وميزان المراجعة

## التشغيل المحلي | Local Development

```powershell
cd spruvex-app
.\run-local.ps1   # يشغّل API (منفذ من .env) + Vite frontend
```

المتغيرات في `spruvex-app/.env` (غير متتبَّع في git): `DATABASE_URL`, `JWT_SECRET`, `PORT`, `VITE_PORT`.

## ملاحظات | Notes

- لا تضع أسراراً أو توكنات في أي ملف متتبَّع في git.
- قاعدة البيانات حالياً Neon PostgreSQL سحابية (وليست محلية) — هي بيئة التطوير الرسمية حتى مرحلة النشر.
- خارطة الطريق الكاملة (11 مرحلة) موثقة في محادثات التطوير — المرحلة الحالية: **المرحلة 3 — ربط الموقع بالتطبيق (SaaS onboarding)**.
