# SpruVex

مظلة SpruVex التجارية — منتجات مستقلة تحت علامة واحدة، كل منتج بقاعدة بيانات وبنية تشغيل خاصة به. لا يوجد تطبيق واحد موحّد؛ هذا المستودع يجمع شيفرة المصدر لمشروعين مستقلين تماماً.

## المشاريع | The Projects

| المشروع | الوصف | التقنيات | الحالة |
|---|---|---|---|
| **[`spruvex-app/`](spruvex-app)** | SpruVex ERP — نظام ERP/POS/صيانة متعدد المستأجرين (SaaS) للسوق السعودي، متوافق مع ZATCA | Express + React (Vite) + Drizzle + PostgreSQL (Neon) | جاهز للإطلاق التجريبي — انظر `PILOT_LAUNCH_PLAN.md` |
| **[`spruvex-site/`](spruvex-site)** | الموقع التسويقي لـ SpruVex ERP | Vite + React | جاهز |

> **ملاحظة**: **SpruVex R** (نظام تشغيل المطاعم) كان مستوردًا هنا مؤقتًا عبر `git subtree`، وانتقل الآن نهائيًا إلى مستودعه الخاص المستقل: [`spruvex-r`](https://github.com/TareqQadi3/spruvex-r) — لأنه منتج منفصل تمامًا تشغيليًا وتجاريًا (قاعدة بيانات، خادم خلفي، نشر، واشتراك مختلفين كليًا)، يربطه بـ SpruVex ERP فقط الموقع التسويقي المشترك. لا تُعِد استيراده هنا مرة أخرى — أي تعديل على SpruVex R يجب أن يتم في مستودعه الخاص فقط.

## التشغيل المحلي | Local Development

كل مشروع مستقل بالكامل (workspace pnpm خاص به، بلا ملف `package.json` أو `pnpm-workspace.yaml` على مستوى الجذر):

```powershell
# SpruVex ERP (API + POS frontend)
cd spruvex-app
.\run-local.ps1

# الموقع التسويقي
cd spruvex-site
pnpm -C artifacts/spruvex-site run dev
```

SpruVex R (نظام تشغيل المطاعم) له مستودعه ودليل تشغيله المحلي الخاص: [`spruvex-r`](https://github.com/TareqQadi3/spruvex-r).

## CI/CD — الوضع الحالي | Current State

- `.github/workflows/ci.yml` (جذر المستودع) — يغطي `spruvex-app` و`spruvex-site` (typecheck، build، migration-drift check، smoke test حقيقي، فحص أسرار، بناء Docker تجريبي).
- CI الخاص بـ SpruVex R موجود ومستقل بالكامل داخل مستودعه الخاص.

## التوثيق الإضافي | Further Documentation

- `SPRUVEX_CURRENT_STATUS.md` — حالة SpruVex ERP الحالية وتاريخ المراحل.
- `PRODUCTION_CHECKLIST.md` / `PILOT_LAUNCH_PLAN.md` / `INFRASTRUCTURE_DECISIONS.md` / `GO_LIVE_RUNBOOK.md` — خطة الإطلاق التجريبي لـ SpruVex ERP.
- توثيق SpruVex R الخاص به موجود في مستودعه: [`spruvex-r`](https://github.com/TareqQadi3/spruvex-r).
