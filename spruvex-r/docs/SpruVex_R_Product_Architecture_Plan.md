# SpruVex R — Product & Technical Architecture Plan v1.0

**Restaurant Operating System — SaaS for Saudi Arabia & GCC**

> وثيقة تخطيط شاملة (Product + Architecture) — جاهزة للتسليم إلى Claude Code.
> SpruVex R منتج مستقل تماماً عن SpruVex ERP: قاعدة بيانات مستقلة، Backend مستقل، Dashboard مستقل، وهوية بصرية خضراء مستقلة.

---

## 1. Product Vision & Strategy

### الرؤية
نظام تشغيل متكامل للمطاعم (Restaurant Operating System) يربط رحلة الطلب كاملة: من مسح العميل لـ QR الطاولة، إلى شاشة المطبخ، إلى الكاشير، إلى التقارير — في منصة SaaS واحدة سحابية، عربية أولاً (Arabic-first RTL)، ومتوافقة مع متطلبات السوق السعودي (ZATCA، ضريبة القيمة المضافة 15%).

### لماذا سيشتري المطعم SpruVex R؟ (Value Proposition)
1. **تقليل العمالة وتسريع الخدمة**: العميل يطلب بنفسه عبر QR — طلبات أدق، دورة طاولة أسرع.
2. **نظام واحد بدل ثلاثة**: POS + منيو رقمي + شاشة مطبخ + مخزون + تقارير في اشتراك واحد.
3. **جاهزية Compliance**: فواتير مبسطة متوافقة مع ZATCA من اليوم الأول (ميزة تنافسية حقيقية أمام الحلول الأجنبية).
4. **Arabic-first**: واجهات RTL أصلية وليست ترجمة لاحقة — نقطة ضعف معروفة عند المنافسين العالميين.
5. **بدون أجهزة خاصة**: يعمل على أي متصفح/تابلت/جهاز Android — تكلفة دخول منخفضة.

### التموضع في السوق
- المنافسون في السعودية: Foodics (المسيطر)، Marn، POSRocket، حلول عالمية (Square/Toast غير متوافقة محلياً).
- استراتيجية الدخول: **استهداف المطاعم الصغيرة والمتوسطة والكافيهات** التي تجد Foodics مكلفاً أو معقداً، بتسعير أبسط وتجربة إعداد Self-service خلال أقل من ساعة.
- نموذج الإيراد: اشتراك شهري/سنوي لكل فرع (Per-branch subscription) بثلاث باقات (Basic / Pro / Growth) + رسوم إضافية مستقبلاً على المدفوعات الإلكترونية.

### مبادئ المنتج
- Time-to-market أولاً: MVP قابل للبيع خلال أشهر، وليس نظاماً مثالياً بعد سنة.
- كل ميزة تُقاس بسؤال واحد: هل تساعد المطعم على البيع أكثر أو الخسارة أقل؟
- التعقيد المؤجل: لا Microservices، لا تكاملات توصيل في MVP، لا تطبيقات Native في البداية.

---

## 2. Target Customers

| الشريحة | الوصف | حجم الفرص |
|---|---|---|
| **مطاعم صغيرة ومتوسطة** | 1–5 فروع، خدمة طاولات أو Fast-casual | الشريحة الأساسية للـ MVP |
| **كافيهات ومحامص** | حجم طلبات عالٍ، منيو بسيط، تركيز على السرعة | مثالية لـ QR + KDS |
| **مطاعم عائلية بخدمة طاولات** | تحتاج Tables & Floors + تقسيم فواتير | Pro tier |
| **Cloud Kitchens** | بدون صالة — تعتمد على External Ordering Link + KDS | شريحة نمو مستقبلية |
| **سلاسل صغيرة (2–10 فروع)** | تحتاج تقارير مركزية متعددة الفروع | Growth tier |

**خارج النطاق حالياً**: السلاسل الكبيرة (50+ فرع)، الفنادق، الكاترينج المؤسسي.

---

## 3. User Personas

1. **صاحب المطعم (Owner)** — يريد رؤية المبيعات والأرباح من جواله، لا يجلس على النظام يومياً. يهمه: Dashboard واضح، تنبيهات، تقارير نهاية اليوم.
2. **مدير الفرع (Branch Manager)** — يدير الورديات، الموظفين، المنيو، المخزون، ويعالج المشاكل (إلغاء طلب، خصم). يهمه: صلاحيات مرنة وسجل تدقيق.
3. **الكاشير (Cashier)** — يعمل تحت ضغط. يهمه: شاشة POS سريعة، أقل عدد نقرات، دفع سريع (كاش/شبكة)، طباعة فاتورة فورية.
4. **الويتر (Waiter)** — يأخذ الطلبات على تابلت، يتابع حالة الطاولات. يهمه: خريطة طاولات واضحة وإرسال الطلب للمطبخ بلمسة.
5. **موظف المطبخ (Kitchen Staff)** — يشاهد KDS. يهمه: طلبات واضحة كبيرة الخط، ترتيب زمني، زر "جاهز" واحد.
6. **العميل (Diner)** — يمسح QR ويطلب من جواله. يهمه: منيو سريع التحميل، صور، تخصيص الطلب (Modifiers)، بدون تحميل تطبيق أو تسجيل.
7. **Platform Super Admin (فريق SpruVex)** — يدير التينانتس، الاشتراكات، الدعم الفني.

---

## 4. Core Modules

| # | Module | الوظيفة الأساسية |
|---|---|---|
| 1 | **POS** | شاشة بيع، سلة، Modifiers، خصومات، دفع متعدد (كاش/شبكة/مقسم)، طباعة فاتورة، استرجاع/إلغاء بصلاحية |
| 2 | **Digital Menu** | منيو رقمي عربي/إنجليزي بصور وأسعار وأقسام، يتحدث لحظياً من إدارة المنيو |
| 3 | **QR Table Ordering** | QR فريد لكل طاولة → يفتح المنيو مع تحديد المطعم/الفرع/الطاولة تلقائياً → الطلب يصل POS + KDS برقم الطاولة |
| 4 | **External Ordering Link** | رابط طلبات خارجية (Pickup/Takeaway) لكل فرع، بدون دفع إلكتروني في MVP (الدفع عند الاستلام) |
| 5 | **Kitchen Display System (KDS)** | شاشة مطبخ لحظية (Realtime): طلبات جديدة → قيد التحضير → جاهز، مع مؤقتات وتنبيه للتأخير |
| 6 | **Tables & Floors** | طوابق وطاولات، حالة الطاولة (فارغة/مشغولة/فاتورة مفتوحة)، دمج/نقل طلبات بين طاولات |
| 7 | **Menu Management** | أقسام، منتجات، أسعار لكل فرع، صور، إخفاء/إظهار، أوقات توفر (وجبة فطور فقط...) |
| 8 | **Products, Modifiers & Options** | مجموعات إضافات (Modifier Groups): إلزامية/اختيارية، حد أدنى/أقصى، سعر إضافي لكل خيار |
| 9 | **Recipes & Ingredients** | وصفة لكل منتج (مكونات + كميات) → خصم تلقائي من المخزون عند البيع (Ingredient-level costing) |
| 10 | **Inventory & Waste** | مخزون مكونات لكل فرع، مشتريات/استلام، جرد، تسويات، تسجيل هدر بأسباب |
| 11 | **Employees & Permissions** | مستخدمون، أدوار (RBAC)، صلاحيات دقيقة، PIN سريع لتبديل الكاشير |
| 12 | **Shifts & Cash Management** | فتح/إغلاق وردية، عهدة الدرج، مطابقة الكاش (Reconciliation)، فروقات، تقرير الوردية |
| 13 | **Reports & Analytics** | مبيعات (يومي/فترة/فرع/منتج/قسم)، أوقات الذروة، أداء الموظفين، تقرير الضريبة، تكلفة المبيعات |
| 14 | **SaaS Multi-Tenant Platform** | عزل كامل بين المطاعم، Onboarding ذاتي، إدارة فروع |
| 15 | **Subscription Management** | باقات، فترة تجريبية، فوترة، إيقاف/تفعيل، حدود الباقة (عدد فروع/مستخدمين) |
| 16 | **ZATCA Compliance** | فاتورة ضريبية مبسطة + QR (TLV/Base64) — Phase 1 في MVP، وجاهزية معمارية لـ Phase 2 |

---

## 5. MVP Scope

**الهدف: مطعم واحد يستطيع التسجيل، تجهيز منيوه، واستقبال أول طلب QR وبيعه على POS خلال أقل من ساعة — بدون تدخل منا.**

### داخل MVP (v1.0)
- Onboarding ذاتي: تسجيل مطعم → فرع افتراضي → معالج إعداد (منيو، طاولات، ضريبة، شعار).
- Menu Management كامل (أقسام، منتجات، Modifiers، صور، عربي/إنجليزي).
- POS: بيع، Modifiers، خصم (بصلاحية)، دفع كاش/شبكة/مقسم، طباعة فاتورة حرارية (80mm) مع QR ZATCA.
- QR Table Ordering + Digital Menu (تجربة عميل عبر المتصفح، بدون تسجيل).
- External Ordering Link (استلام من الفرع، دفع عند الاستلام).
- KDS لحظي (WebSockets) بمحطة مطبخ واحدة لكل فرع.
- Tables & Floors أساسي (خريطة طاولات، حالات، فاتورة مفتوحة لكل طاولة).
- Employees & RBAC (أدوار جاهزة: Owner / Manager / Cashier / Waiter / Kitchen + صلاحيات قابلة للتعديل) + دخول PIN للـ POS.
- Shifts & Cash: فتح/إغلاق وردية ومطابقة كاش وتقرير وردية.
- تقارير أساسية: مبيعات اليوم/الفترة، أفضل المنتجات، تقرير ضريبة، تقرير الورديات.
- Multi-tenant + Subscription أساسي: باقة واحدة + تجربة 14 يوم + تفعيل يدوي للدفع (تحويل بنكي/فاتورة) — بوابة دفع الاشتراكات لاحقاً.
- ZATCA Phase 1: فاتورة مبسطة إلكترونية غير قابلة للتعديل + QR بصيغة TLV.

### مؤجل عمداً (خارج MVP)
- Recipes & Ingredient-level Inventory & Waste → **v1.1** (أول إصدار بعد الإطلاق — أهم طلب متوقع من العملاء الجادين).
- Online Payment للطلبات الخارجية (Mada/Apple Pay عبر مزود مثل Moyasar/Tap) → v1.2.
- ZATCA Phase 2 (Reporting API، توقيع رقمي، hash chain مفعّل خارجياً) → v1.2 — لكن **بنية الفواتير تُبنى من اليوم الأول append-only مع UUID وحقول الـ hash** حتى لا نعيد الهيكلة لاحقاً.
- تكاملات التوصيل (Jahez/HungerStation/Careem) → v2.
- Multi-KDS stations (شاشة مشويات/شاشة مشروبات) → v1.1.
- Offline-first POS كامل → v2 (في MVP: تحمل انقطاع قصير بقائمة انتظار محلية — انظر القسم 8).
- Customer loyalty، حجوزات الطاولات، تطبيقات Native → لاحقاً حسب السوق.

**قرار منتج مهم**: MVP بدون مخزون مكونات ليس نقصاً قاتلاً — معظم المطاعم الصغيرة تبدأ بالبيع والتقارير، والمخزون يأتي كسبب للترقية إلى باقة Pro.

---

## 6. Future Roadmap (Product)

| إصدار | التركيز | أبرز الميزات |
|---|---|---|
| **v1.0 (MVP)** | البيع والطلب الرقمي | POS، QR Ordering، KDS، Shifts، تقارير أساسية، ZATCA Phase 1 |
| **v1.1** | التحكم بالتكلفة | Recipes & Ingredients، Inventory & Waste، Multi-KDS، تقارير تكلفة |
| **v1.2** | المدفوعات والامتثال | Online Payment، ZATCA Phase 2، فوترة اشتراكات آلية |
| **v2.0** | النمو والتكامل | تكاملات التوصيل، Loyalty، Offline-first POS، تقارير Multi-branch متقدمة، Public API |
| **v2.x** | الذكاء | توقع الطلب، اقتراح تسعير، تحليل هدر ذكي |

---

## 7. User Flows (المسارات الأساسية)

### 7.1 طلب داخل المطعم عبر QR
1. العميل يمسح QR الطاولة → URL بصيغة `order.spruvex-r.com/t/{tableCode}` (كود عشوائي غير قابل للتخمين، يحدد المطعم + الفرع + الطاولة).
2. يفتح المنيو الرقمي فوراً (بدون تسجيل) بلغة الجهاز مع مبدّل عربي/إنجليزي.
3. يضيف منتجات + Modifiers → يؤكد الطلب (اسم اختياري + ملاحظات).
4. الطلب يُنشأ بحالة `pending` مرتبطاً بالطاولة → يظهر **لحظياً** على POS (للتأكيد أو الإرسال المباشر حسب إعداد المطعم) وعلى KDS.
5. المطبخ يحضّر → `ready` → إشعار للويتر.
6. عند المحاسبة: الكاشير يفتح الطاولة على POS → كل طلبات الطاولة في فاتورة واحدة (أو تقسيم) → دفع → فاتورة ZATCA → الطاولة تعود `available`.

**Edge cases يجب التعامل معها**: طلبات متتابعة من نفس الطاولة تنضم لنفس الجلسة المفتوحة (Table Session)؛ QR ممسوح بعد إغلاق المطعم → رسالة "خارج أوقات العمل"؛ منتج نفد → يختفي فوراً من المنيو (توفر لحظي)؛ إعداد للمطعم: "الطلبات الذاتية تحتاج تأكيد كاشير قبل المطبخ" نعم/لا.

### 7.2 طلب خارجي (Takeaway Link)
رابط الفرع `order.spruvex-r.com/{restaurantSlug}/{branchSlug}` → منيو → الطلب مع رقم جوال العميل → يظهر على POS كـ Pickup order برقم متسلسل → تأكيد + زمن تجهيز متوقع (SMS/WhatsApp لاحقاً — في MVP شاشة حالة الطلب برابط مباشر) → دفع عند الاستلام على POS.

### 7.3 بيع مباشر على POS (Walk-in / Counter)
كاشير يدخل بـ PIN → وردية مفتوحة إلزامية → سلة → Modifiers → دفع (كاش يحسب الباقي / شبكة / مقسم) → طباعة فاتورة مع QR → الطلب للمطبخ إذا فُعّل KDS للطلبات المحلية.

### 7.4 وردية الكاشير
فتح وردية بعهدة افتتاحية → عمليات البيع تُربط بالوردية → Cash In/Out بسبب → إغلاق: النظام يعرض المتوقع نقداً، الكاشير يعد الفعلي، الفرق يسجل ويظهر بتقرير الوردية → لا بيع بدون وردية مفتوحة.

### 7.5 Onboarding مطعم جديد
تسجيل (اسم مطعم، جوال، بريد) → تحقق OTP → إنشاء Tenant + فرع افتراضي + Owner + أدوار جاهزة → معالج: (1) بيانات ضريبية (الرقم الضريبي، CR) (2) العملة/الضريبة 15% (3) استيراد منيو يدوي أو من Excel (4) توليد طاولات و QR PDF للطباعة (5) دعوة الموظفين → جاهز للبيع. تجربة 14 يوم كاملة الميزات.

### 7.6 KDS
شاشة كروت بالترتيب الزمني: كرت = رقم الطلب + الطاولة/Pickup + الأصناف + Modifiers بخط واضح + مؤقت يتغير لونه عند تجاوز الزمن المستهدف → "بدء التحضير" → "جاهز" → يختفي ويصل إشعار للويتر/POS.

---

## 8. System Architecture

### 8.1 القرار المعماري الرئيسي: Modular Monolith

**الخيارات المدروسة:**

| الخيار | المزايا | العيوب | القرار |
|---|---|---|---|
| **Microservices** | استقلالية نشر وتوسع لكل خدمة | تعقيد ضخم (شبكة، Observability، Transactions موزعة) لا يبرره حجم فريق صغير وسرعة السوق المطلوبة | ❌ مرفوض الآن |
| **Monolith تقليدي** | أسرع بداية | يتحول Spaghetti مع النمو، صعب فصله لاحقاً | ❌ |
| **Modular Monolith (NestJS)** | تطبيق واحد بنشر واحد، لكن مقسم Domain Modules بحدود صارمة — كل Module قابل للفصل كخدمة مستقلة مستقبلاً إذا احتجنا | يتطلب انضباطاً في الحدود بين الـ Modules | ✅ **المعتمد** |

### 8.2 Stack المعتمد

| الطبقة | التقنية | السبب |
|---|---|---|
| Backend | **NestJS (Node.js + TypeScript)** | DI + Modules + Guards تخدم RBAC والـ Multi-tenancy بشكل طبيعي |
| ORM | **Prisma** | سرعة تطوير + Type-safety؛ مع Client Extension لفرض tenant scoping وتمرير `SET LOCAL app.current_tenant_id` داخل Transaction لدعم RLS (بديل: TypeORM — مقبول، لكن Prisma أسرع لفريق صغير) |
| Database | **PostgreSQL 16** | RLS للعزل، JSONB لتفاصيل الطلب المجمدة، موثوقية |
| Realtime | **WebSockets (Socket.io عبر NestJS Gateway)** + Redis Adapter | KDS وPOS يحتاجان دفعاً لحظياً؛ Rooms لكل فرع/محطة. (بديل SSE: أبسط لكنه اتجاه واحد — الـ KDS يحتاج إرسال حالات) |
| Cache/Queue | **Redis + BullMQ** | جلسات Socket، طوابير (إرسال ZATCA لاحقاً، تقارير ثقيلة، صور) |
| Frontend | **React + TypeScript + Tailwind + shadcn/ui** | (Theme أخضر مخصص لهوية SpruVex R — انظر القسم 11) |
| Customer Ordering | **Next.js (SSR)** | صفحة المنيو يجب أن تفتح خلال ثوانٍ على شبكة جوال — SSR + Edge caching، وSEO لروابط المطاعم |
| Monorepo | **Turborepo + pnpm** | مشاركة الأنواع (types) وعقود API بين التطبيقات |
| Storage | S3-compatible (صور المنتجات، شعارات، PDF فواتير) | |
| Deployment | Docker Compose (بداية) → قابلية النقل لأي Cloud؛ Postgres مُدار (RDS/Supabase-postgres) | |

### 8.3 مخطط عام

```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                   │
│  Admin Dashboard │ POS App │ KDS App │ Customer Ordering │
│     (React)      │ (React) │ (React) │    (Next.js)      │
│                Platform Admin (React)                    │
└───────────────┬─────────────────────────┬───────────────┘
                │ REST API (JWT)          │ WebSockets
┌───────────────▼─────────────────────────▼───────────────┐
│              NestJS Modular Monolith (API)               │
│  ┌─────────┬─────────┬──────────┬──────────┬──────────┐ │
│  │ Identity│ Catalog │ Ordering │ Kitchen  │  Tables  │ │
│  ├─────────┼─────────┼──────────┼──────────┼──────────┤ │
│  │ Payments│ Shifts  │ Inventory│ Reports  │ Billing  │ │
│  ├─────────┴─────────┴──────────┴──────────┴──────────┤ │
│  │ Shared Kernel: Tenancy, RBAC, Audit, ZATCA, Events │ │
│  └────────────────────────────────────────────────────┘ │
└───────┬──────────────────┬──────────────────┬───────────┘
        │                  │                  │
   PostgreSQL          Redis (Pub/Sub,     S3 Storage
   (RLS enforced)      BullMQ, Socket)     (images/PDFs)
```

### 8.4 التواصل بين الـ Modules
- داخلياً: **Domain Events** عبر NestJS EventEmitter (مثال: `order.placed` → يستهلكه Kitchen وReports وInventory) — يمنع الاعتماد المباشر المتشابك ويجهزنا لأي فصل مستقبلي.
- لا يستدعي Module جداول Module آخر مباشرة — فقط عبر Service العام أو Event.

### 8.5 موقف الـ Offline في MVP (قرار صريح)
Offline-first كامل مكلف (مزامنة، تعارضات، ترقيم فواتير). **قرار MVP**: Online-first مع "Degraded Mode": POS يحتفظ بقائمة انتظار محلية (IndexedDB) لعمليات البيع أثناء انقطاع قصير (دقائق)، تُرفع تلقائياً مع **Idempotency Keys** عند العودة، والفاتورة الضريبية تُصدر عند المزامنة. يُوضّح للعميل أن الانقطاع الطويل غير مدعوم في v1. Offline كامل في v2.

---

## 9. Database Design

### 9.1 استراتيجية Multi-tenancy

**الخيارات**: Shared schema + `tenant_id` / Schema-per-tenant / DB-per-tenant.
**القرار: Shared schema + `tenant_id` على كل جدول، مع Postgres Row-Level Security كطبقة حماية إجبارية.**
السبب: أبسط Migrations وأرخص تشغيلاً لمئات المطاعم الصغيرة، وRLS يحوّل "نسيان WHERE tenant_id" من تسريب بيانات إلى نتيجة فارغة. كل Request يضبط `SET LOCAL app.current_tenant_id` داخل Transaction. Schema-per-tenant يُدرس فقط إذا ظهر عميل Enterprise بمتطلب عزل تعاقدي.

### 9.2 قواعد عامة (على كل الجداول التجارية)
- `id UUID`، `tenant_id`، و`branch_id` على الجداول التشغيلية.
- `created_at / updated_at / created_by / updated_by`.
- Soft delete (`deleted_at`) على السجلات التجارية — **باستثناء الفواتير: append-only لا تُحذف ولا تُعدّل** (متطلب ZATCA).
- المبالغ: `NUMERIC(12,2)` أو Integer halalas — **ممنوع float**.
- جدول `audit_logs` للأحداث الحساسة: إلغاء طلب، خصم فوق حد، فتح درج بدون بيع، تعديل صلاحيات، تسوية مخزون.

### 9.3 الجداول حسب الـ Domain

**Identity & Tenancy**
- `tenants` (المطعم: الاسم، slug، الشعار، الرقم الضريبي، CR، الحالة، الباقة)
- `branches` (فرع: اسم، عنوان، إحداثيات، أوقات عمل JSONB، إعدادات الطلب الذاتي)
- `users` (بريد/جوال، hash، حالة) — `user_roles` (user, role, tenant, branch nullable = صلاحية على مستوى المطعم)
- `roles`, `permissions`, `role_permissions` (الصلاحيات جدول وليس enum)
- `pos_pins` (PIN مشفر لكل مستخدم لكل فرع لتبديل الكاشير السريع)

**Catalog (المنيو)**
- `categories` (اسم عربي/إنجليزي، ترتيب، صورة، إظهار)
- `products` (اسم ع/E، وصف ع/E، صورة، قسم، ضريبة، حالة، أوقات توفر JSONB)
- `product_branch_settings` (سعر لكل فرع، متوفر/موقوف لكل فرع)
- `modifier_groups` (اسم، min_select، max_select، إلزامي) — `modifiers` (اسم، سعر إضافي) — `product_modifier_groups`

**Tables & Floors**
- `floors` — `tables` (رقم، سعة، floor، **qr_code فريد عشوائي**، حالة)
- `table_sessions` (جلسة مفتوحة لطاولة: بدأت/أغلقت، تجمع كل طلبات الجلسة لفاتورة واحدة أو مقسمة)

**Ordering (قلب النظام)**
- `orders`: رقم يومي متسلسل لكل فرع، النوع (`dine_in / takeaway_link / pos_walkin`)، المصدر (`qr / external_link / pos`)، الطاولة/الجلسة (nullable)، بيانات عميل الاستلام (جوال/اسم)، الحالة (`pending → confirmed → preparing → ready → completed / cancelled`)، المجاميع (subtotal, discount, vat, total)، ملاحظات، `placed_by` (user أو guest).
- `order_items`: المنتج + **لقطة مجمدة JSONB** (الاسم والسعر لحظة الطلب — تغيير المنيو لا يغير الفواتير القديمة)، الكمية، حالة تحضير للصنف، ملاحظات.
- `order_item_modifiers`: لقطة الاسم والسعر لكل إضافة مختارة.
- `order_status_history`: كل تغيير حالة (من/إلى/بواسطة/متى) — أساس تحليلات زمن التحضير.

**Payments & Invoicing**
- `payments` (order، الوسيلة `cash/card/split`، المبلغ، الوردية، الكاشير) — يدعم أكثر من سطر دفع للطلب الواحد.
- `invoices` — **append-only**: رقم تسلسلي غير منقطع لكل فرع، UUID، نوع (`simplified` افتراضياً)، لقطة كاملة JSONB، مجاميع الضريبة، `qr_payload` (TLV Base64)، وحقول جاهزة لـ Phase 2: `invoice_hash`, `previous_invoice_hash`, `zatca_status`, `zatca_response`. الإلغاء = `credit_notes` مرجعية، لا حذف.

**Shifts & Cash**
- `shifts` (فرع، فتح/إغلاق، عهدة افتتاحية، متوقع، فعلي، فرق، من فتح/أغلق)
- `cash_movements` (وردية، نوع `in/out`، مبلغ، سبب)

**Inventory (v1.1 — يُصمم الآن ويُبنى لاحقاً)**
- `ingredients` (وحدة قياس، تكلفة متوسطة) — `recipes` (product ↔ ingredients + كميات)
- `stock_levels` (ingredient × branch) — `stock_movements` (نوع: purchase/sale_deduction/waste/adjustment/transfer، مرجع، كمية، تكلفة)
- `waste_logs` (سبب، مسجل بواسطة) — `purchases` + `purchase_items` (مورد، استلام)
- `suppliers`

**Billing (اشتراكات SaaS)**
- `plans` (حدود: فروع، مستخدمون، ميزات JSONB) — `subscriptions` (tenant، باقة، حالة `trial/active/past_due/suspended`، تواريخ) — `subscription_invoices`

**Platform**
- `platform_admins`، `tenant_activity_metrics` (لمتابعة الصحة والـ Churn)

### 9.4 فهارس أساسية
`orders(tenant_id, branch_id, created_at)`, `orders(branch_id, status) WHERE status IN ('pending','preparing')` (partial index لشاشة KDS), `invoices(branch_id, sequence_no)` unique, `tables(qr_code)` unique, `products(tenant_id, category_id)`.

---

## 10. Backend Domain Structure (NestJS)

```
apps/api/src/
├── modules/
│   ├── identity/        # auth (JWT access+refresh), users, roles, permissions, PIN
│   ├── tenancy/         # tenants, branches, onboarding wizard
│   ├── catalog/         # categories, products, modifiers, availability
│   ├── tables/          # floors, tables, QR generation, table sessions
│   ├── ordering/        # orders, order items, status machine, guest ordering API
│   ├── kitchen/         # KDS queries, station routing (v1.1: multi-station)
│   ├── payments/        # payments, split logic
│   ├── invoicing/       # ZATCA service: invoice issuance, sequence, QR TLV, (phase2-ready)
│   ├── shifts/          # shifts, cash movements, reconciliation
│   ├── inventory/       # v1.1: ingredients, recipes, stock, waste, purchases
│   ├── reports/         # read-model queries, aggregations
│   ├── billing/         # plans, subscriptions, limits enforcement
│   └── platform/        # super-admin: tenants oversight, support tools
├── shared/
│   ├── tenancy/         # TenantContext (AsyncLocalStorage), Prisma extension, RLS SET LOCAL
│   ├── rbac/            # @RequirePermission() guard/decorator
│   ├── events/          # domain events: order.placed, order.ready, invoice.issued...
│   ├── audit/           # audit interceptor/service
│   ├── realtime/        # Socket.io gateway, rooms: branch:{id}:kds / branch:{id}:pos
│   └── common/          # pagination, validation pipes, money utils, i18n
└── main.ts
```

**قواعد صارمة:**
- كل Endpoint عليه `@RequirePermission('orders.void')` صراحة — لا ثقة ضمنية.
- كل استعلام يمر عبر Prisma Extension التي تحقن `tenant_id` وتضبط RLS — لا Raw queries خارجها.
- Idempotency-Key إلزامي على إنشاء الطلب والدفع (يحمي من التكرار عند إعادة المحاولة/الشبكة الضعيفة).
- Order Status Machine مركزية: الانتقالات المسموحة معرفة في مكان واحد، وكل انتقال يطلق Event ويسجل في history.
- Guest endpoints (منيو + إنشاء طلب QR) — Public لكن Rate-limited ومقيدة بـ `table qr_code` صالح وجلسة سارية.

---

## 11. Frontend Applications Structure

**Monorepo (Turborepo):**

```
apps/
├── dashboard/    # React SPA — إدارة المطعم (Owner/Manager): منيو، طاولات، موظفون، تقارير، إعدادات
├── pos/          # React SPA — شاشة الكاشير: تصميم Touch-first، أزرار كبيرة، اختصارات
├── kds/          # React SPA — شاشة المطبخ: Fullscreen، خط كبير، ألوان حالة، أصوات تنبيه
├── ordering/     # Next.js — تجربة العميل (QR + رابط خارجي): SSR، خفيفة، PWA-ready
└── platform/     # React SPA — إدارة SpruVex (super admin)
packages/
├── ui/           # مكونات shadcn/ui بثيم SpruVex R الأخضر + دعم RTL كامل
├── api-client/   # عقود الـ API المولدة (OpenAPI) + hooks (TanStack Query)
├── types/        # أنواع مشتركة
└── config/       # tailwind preset, eslint, tsconfig
```

**لماذا تطبيقات منفصلة وليس تطبيقاً واحداً؟** POS وKDS يعملان على أجهزة مخصصة بوضع Kiosk وتحديث مستقل، وتجربة العميل يجب أن تكون أخف ما يمكن (Next.js SSR) — لكن الكل يتشارك الثيم والـ API client عبر packages.

**هوية SpruVex R البصرية (من الشعار المرفق):**
- Primary: أخضر متدرج (Lime `#8BC34A → #4CAF50` إلى Dark Green `#1B5E20`) — يُستخرج Palette دقيق من ملفات الشعار.
- خلفيات فاتحة نظيفة، بطاقات بيضاء، ظلال خفيفة — طابع SaaS حديث.
- الخط: عربي `IBM Plex Sans Arabic` أو `Cairo`، إنجليزي `Inter` — مع RTL أصلي (menus, tables, direction-aware icons).
- KDS: Dark mode افتراضي (شاشات مطبخ).
- لا استخدام لأي عناصر من هوية SpruVex ERP الزرقاء/البنفسجية.

---

## 12. Security & Multi-tenancy Design

1. **عزل التينانت — ثلاث طبقات**: (1) JWT يحمل tenant_id ولا يُقبل من الـ client أبداً كـ parameter، (2) Prisma Extension تفلتر تلقائياً، (3) Postgres RLS كخط دفاع أخير.
2. **AuthN**: JWT Access (قصير 15د) + Refresh (Rotation + كشف إعادة الاستخدام). POS: دخول جهاز + PIN لكل عملية حساسة. حسابات Guest غير موجودة — طلبات QR بلا حساب لكن بربط جلسة الطاولة.
3. **AuthZ (RBAC)**: أدوار × صلاحيات × نطاق (فرع/مطعم). عمليات حساسة (Void، خصم > X%، فتح درج) تتطلب صلاحية + تُسجل في Audit log مع من/متى/لماذا.
4. **حماية مسارات الضيف**: rate limiting (IP + table code)، توقيع جلسة الطاولة، انتهاء صلاحية الجلسة، منع إنشاء طلبات لطاولة عليها جلسة لفرع مغلق.
5. **ZATCA / نزاهة الفواتير**: جدول فواتير append-only، تسلسل بلا فجوات لكل فرع (sequence داخل transaction)، لا حذف/تعديل — فقط Credit notes، حفظ طويل الأمد (~6 سنوات) بأرشفة S3.
6. **بيانات شخصية (PDPL السعودي)**: أقل جمع ممكن (جوال العميل فقط للطلبات الخارجية)، تشفير أثناء النقل والتخزين، سياسة احتفاظ وحذف.
7. **تشغيلياً**: Helmet/CORS مضبوط لكل origin تطبيق، Validation صارم (class-validator/Zod) على كل DTO، أسرار عبر Env/Secrets manager، نسخ احتياطي يومي + Point-in-time recovery، Structured logging مع tenant_id في كل سطر، Sentry للأخطاء.
8. **حدود الاشتراك**: Middleware يفرض حدود الباقة (عدد الفروع/المستخدمين/الطاولات) عند الإنشاء وليس فقط في الواجهة.

---

## 13. Development Roadmap (تنفيذ MVP)

> فريق مفترض: مطور Full-stack واحد + Claude Code. المدد تقديرية بأسابيع عمل مركزة.

| مرحلة | المدة | التسليم |
|---|---|---|
| **Phase 0 — Foundation** | 1–2 أسبوع | Monorepo، NestJS skeleton، Prisma + Migrations أولية، Tenancy + RLS + RBAC + Audit جاهزة ومختبرة، CI أساسي، Seed data |
| **Phase 1 — Identity & Onboarding** | 1 أسبوع | تسجيل مطعم، OTP، معالج الإعداد، إدارة فروع/مستخدمين/أدوار، Dashboard shell بالثيم الأخضر |
| **Phase 2 — Catalog** | 1–2 أسبوع | أقسام/منتجات/Modifiers، صور، أسعار وتوفر لكل فرع، عربي/إنجليزي |
| **Phase 3 — Tables & QR** | 1 أسبوع | طوابق/طاولات، توليد QR + PDF طباعة، Table sessions |
| **Phase 4 — Ordering Core + Realtime** | 2 أسبوع | Order domain + status machine + Events، Socket.io gateway، **KDS app** |
| **Phase 5 — POS** | 2–3 أسبوع | شاشة بيع كاملة، Modifiers، خصومات، دفع مقسم، طباعة حرارية، Degraded mode queue |
| **Phase 6 — Customer Ordering** | 2 أسبوع | Next.js: منيو QR بالطاولة + رابط خارجي + شاشة حالة الطلب |
| **Phase 7 — Invoicing & ZATCA P1** | 1 أسبوع | Invoice service، تسلسل، QR TLV، قالب فاتورة 80mm |
| **Phase 8 — Shifts & Cash** | 1 أسبوع | ورديات، مطابقة، تقرير وردية |
| **Phase 9 — Reports + Billing** | 1–2 أسبوع | تقارير المبيعات/الضريبة/المنتجات، باقات وتجربة 14 يوم وتعليق |
| **Phase 10 — Hardening & Pilot** | 2 أسبوع | اختبارات E2E للمسارات الحرجة، Load test لـ Sockets، تدقيق أمني للعزل، **تشغيل تجريبي في مطعم حقيقي واحد** |

**الإجمالي: ~15–18 أسبوعاً حتى Pilot.** الاختبار في كل مرحلة (وليس مرحلة مستقلة): Unit للـ domain logic، Integration لعزل التينانت والـ RBAC، E2E (Playwright) لمسار QR→KDS→POS→فاتورة.

---

## 14. Claude Code Implementation Brief

> هذا القسم يُنقل كما هو إلى Claude Code كنقطة انطلاق، مع هذه الوثيقة كاملة كمرجع.

### السياق
أنت تبني **SpruVex R** — Restaurant OS SaaS للسعودية والخليج. منتج مستقل تماماً عن أي نظام آخر (لا تعِد استخدام قرارات أو كود من SpruVex ERP). عربي RTL أولاً + إنجليزي. الهوية خضراء (Palette من ملفات الشعار في `/brand`).

### Stack (غير قابل للتفاوض بدون نقاش)
NestJS + TypeScript، Prisma + PostgreSQL 16 (RLS مفعّل)، Redis + BullMQ، Socket.io، React + Tailwind + shadcn/ui، Next.js لتطبيق الطلب، Turborepo + pnpm.

### قواعد إلزامية في كل الكود
1. كل جدول تجاري: `tenant_id` (+ `branch_id` للتشغيلي)، timestamps، created_by/updated_by، soft delete — **عدا `invoices`: append-only**.
2. RLS policy على كل جدول tenant-owned + Prisma extension تضبط `app.current_tenant_id` — أي endpoint جديد يُختبر ضد تسريب Cross-tenant.
3. كل endpoint: `@RequirePermission()` صريح + validation DTO كامل. لا `// TODO` ولا معالجة أخطاء ناقصة.
4. المال: NUMERIC/halalas فقط. الضريبة 15% قابلة للإعداد.
5. إنشاء الطلبات والمدفوعات: Idempotency-Key.
6. كل نصوص الواجهة عبر i18n (ar/en) — لا نص Hardcoded، وRTL افتراضي.
7. أحداث Domain (`order.placed`, `order.ready`, `invoice.issued`...) بدل الاستدعاء المباشر بين الـ modules.
8. اختبارات مع كل مرحلة: عزل التينانت + RBAC + مسار الطلب الكامل.

### ترتيب التنفيذ
اتبع Phases 0→10 من القسم 13. **لا تبدأ Phase جديدة قبل اكتمال اختبارات السابقة.** ابدأ بـ Phase 0 وسلّم: Monorepo يعمل، Migration أولية بجداول Identity/Tenancy، RLS مثبت بعمل اختبار يحاول القراءة عبر tenant آخر ويفشل، وSeed لمطعم تجريبي.

### تعريف الجاهزية (Definition of Done) للـ MVP
مطعم جديد يسجّل ذاتياً، يبني منيو، يطبع QR طاولاته، يستقبل طلب عميل من الجوال يظهر لحظياً على KDS وPOS، يقفل الفاتورة بدفع مقسم ويطبع فاتورة ZATCA مبسطة بـ QR سليم، ويغلق الوردية بمطابقة كاش — كل ذلك بدون تدخل مطوّر، وبدون أي إمكانية لرؤية بيانات مطعم آخر.

---

*نهاية الوثيقة — SpruVex R Planning v1.0*
