# SpruVex

مظلة SpruVex التجارية — منتجات مستقلة تحت علامة واحدة، كل منتج بقاعدة بيانات وبنية تشغيل خاصة به. لا يوجد تطبيق واحد موحّد؛ هذا المستودع يجمع شيفرة المصدر لثلاثة مشاريع مستقلة تماماً.

## المشاريع الثلاثة | The Three Projects

| المشروع | الوصف | التقنيات | الحالة |
|---|---|---|---|
| **[`spruvex-app/`](spruvex-app)** | SpruVex ERP — نظام ERP/POS/صيانة متعدد المستأجرين (SaaS) للسوق السعودي، متوافق مع ZATCA | Express + React (Vite) + Drizzle + PostgreSQL (Neon) | جاهز للإطلاق التجريبي — انظر `PILOT_LAUNCH_PLAN.md` |
| **[`spruvex-site/`](spruvex-site)** | الموقع التسويقي لـ SpruVex ERP | Vite + React | جاهز |
| **[`spruvex-r/`](spruvex-r)** | SpruVex R — نظام تشغيل مطاعم مستقل تماماً (POS، قائمة رقمية، طلب عبر QR، شاشة مطبخ KDS) — **مشروع منفصل بالكامل**: قاعدة بيانات خاصة، خادم خلفي خاص، لوحات تحكم خاصة، وهوية بصرية خضراء مستقلة | NestJS + Prisma + PostgreSQL (RLS) + Redis + Next.js | قيد التطوير — انظر `spruvex-r/README.md` |

> **مهم**: `spruvex-r` استُورد إلى هذا المستودع عبر `git subtree` (كامل تاريخ Git محفوظ) ليكون كل كود SpruVex في مكان واحد — لكنه **يبقى منتجاً مستقلاً تماماً** من الناحية التشغيلية: بيئة تشغيل، قاعدة بيانات، ونشر منفصلون كلياً عن `spruvex-app`/`spruvex-site`. **لا تُشارك أي أسرار (`.env`) أو قواعد بيانات أو حاويات Docker بين المشروعين إطلاقاً** — كلاهما يستخدم أسماء متغيرات بيئة متطابقة (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`) بقيم مختلفة تماماً، فنسخ ملف `.env` من أحدهما إلى الآخر خطأ أمني حقيقي.

## التشغيل المحلي | Local Development

كل مشروع مستقل بالكامل (workspace pnpm خاص به، بلا ملف `package.json` أو `pnpm-workspace.yaml` على مستوى الجذر):

```powershell
# SpruVex ERP (API + POS frontend)
cd spruvex-app
.\run-local.ps1

# الموقع التسويقي
cd spruvex-site
pnpm -C artifacts/spruvex-site run dev

# SpruVex R
cd spruvex-r
pnpm install && pnpm dev   # راجع spruvex-r/README.md للتفاصيل الكاملة
```

## التوثيق الإضافي | Further Documentation

- `SPRUVEX_CURRENT_STATUS.md` — حالة SpruVex ERP الحالية وتاريخ المراحل.
- `PRODUCTION_CHECKLIST.md` / `PILOT_LAUNCH_PLAN.md` / `INFRASTRUCTURE_DECISIONS.md` / `GO_LIVE_RUNBOOK.md` — خطة الإطلاق التجريبي لـ SpruVex ERP.
- `spruvex-r/README.md` و`spruvex-r/docs/` — توثيق SpruVex R الخاص به.
