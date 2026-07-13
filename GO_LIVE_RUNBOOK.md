# دليل التنفيذ العملي للإطلاق التجريبي | Go-Live Runbook

> آخر تحديث: 2026-07-10 — **أوامر جاهزة للتنفيذ، لا تُنفَّذ قبل اعتماد النطاق.**
> البنية المعتمدة: Cloudflare + Hetzner CX32 (فالكنشتاين/فرانكفورت) + Neon Launch (فرانكفورت).

---

## أ) نتيجة فحص النطاق (تم التحقق من سجلات RDAP الرسمية بتاريخ 2026-07-10)

| النطاق | الحالة | القرار المقترح |
|---|---|---|
| **spruvex.com** | ✅ **متاح** | **سجّله — هذا هو النطاق الرئيسي** |
| spruvex.net | ✅ متاح | اختياري دفاعياً (~$12/سنة) — يعاد توجيهه لـ.com |
| spruvex.io / spruvex.app | ✅ متاحان | غير ضروريين الآن؛ يمكن اقتناؤهما لاحقاً لمنتجات مستقبلية (SpruVex R قد يستخدم subdomain مثل `r.spruvex.com` أصلاً — العلامة الواحدة تخدم كل المنتجات عبر subdomains بلا نطاقات إضافية) |
| spruvex.sa / .com.sa | مؤجَّل | بعد السجل التجاري (شرط SaudiNIC) |

**الاسم سليم للعلامة الشاملة**: "SpruVex" غير مقيّد بمنتج معين — `app.spruvex.com` للـERP الآن، و`r.spruvex.com` أو ما شابه لاحقاً للمطاعم، والجذر للموقع التسويقي الجامع.

---

## ب) قائمة فحص شراء وتجهيز الحسابات (بالترتيب)

> قاعدة عامة لكل الحسابات: بريد واحد مملوك لك، **2FA إلزامي فور الإنشاء**، وكل بيانات الدخول في مدير كلمات مرور. لا تشارك أي حساب.

| # | الحساب | ماذا تفعل | يحتاج دفع؟ | ملاحظات |
|---|---|---|---|---|
| 1 | **Cloudflare** | إنشاء حساب → تفعيل 2FA | لا (خطة Free) | يُنشأ **قبل** النطاق لأن التسجيل سيتم داخله |
| 2 | **Domain** | من داخل Cloudflare: Registrar → Register → `spruvex.com` | نعم (~$10-11/سنة) | Auto-renew مفعّل + WHOIS privacy (افتراضي) |
| 3 | **Hetzner** | إنشاء حساب Cloud → إضافة وسيلة دفع | نعم (~€7.3/شهر عند إنشاء الخادم) | ⚠️ **الحسابات الجديدة قد تخضع لتحقق هوية يستغرق ساعات-أيام — أنشئ الحساب اليوم حتى لو تأخر النشر**؛ لا تنشئ الخادم إلا عند خطوة التنفيذ |
| 4 | **Neon** | إنشاء حساب → ترقية لخطة Launch | نعم (~$19/شهر) | لا تنشئ مشروع الإنتاج إلا عند الخطوة 4 أدناه؛ **لا تلمس مشروع التطوير الحالي** |
| 5 | **Sentry** | إنشاء حساب (خطة Developer المجانية) → إنشاء مشروع Node.js → احفظ الـDSN | لا | الـDSN سيُستخدم في خطوة النشر |
| 6 | **UptimeRobot** | إنشاء حساب مجاني | لا | المراقب يُضاف بعد النشر (خطوة 8) |

---

## ج) خطوات التنفيذ الثمانية — أوامر عملية مرتبة

> ⛔ **لا تنفّذ شيئاً هنا قبل اعتماد شراء النطاق.** كل خطوة تُتحقق قبل التالية.

### الخطوة 1 — Domain + DNS (في لوحة Cloudflare)

بعد تسجيل `spruvex.com` في Cloudflare Registrar، أضف السجلات (كلها **Proxied ☁️ برتقالي**):

| Type | Name | Content |
|---|---|---|
| A | `spruvex.com` | `<IP الخادم — يُعرف في الخطوة 7>` |
| A | `app` | `<نفس IP>` |
| A | `api` | `<نفس IP>` |

> يمكن إنشاء الخادم (خطوة 7-أ) قبل هذه لتعرف الـIP، ثم العودة هنا — الترتيب الفعلي: 7-أ ← 1 ← 2 ← بقية 7.

### الخطوة 2 — SSL (Cloudflare Origin CA — بلا certbot نهائياً)

1. Cloudflare → SSL/TLS → وضع **Full (strict)**.
2. SSL/TLS → Origin Server → **Create Certificate** (RSA، صلاحية 15 سنة، للأسماء: `spruvex.com, *.spruvex.com`).
3. احفظ الملفين على الخادم:
```bash
mkdir -p ~/spruvex-erp/deploy/nginx/certs/spruvex
# الصق شهادة Origin في:  deploy/nginx/certs/spruvex/fullchain.pem
# والصق المفتاح الخاص في: deploy/nginx/certs/spruvex/privkey.pem
chmod 600 ~/spruvex-erp/deploy/nginx/certs/spruvex/privkey.pem
```
4. عدّل `deploy/nginx/nginx.conf` على الخادم: استبدل كل `CHANGE_ME` بالنطاقات الحقيقية، ووجّه الـ`ssl_certificate`/`ssl_certificate_key` الثلاثة كلها إلى `certs/spruvex/` (شهادة wildcard واحدة تغطي الجميع).
5. **استعادة الـIP الحقيقي خلف Cloudflare** (وإلا فسيرى rate limiting عناوين Cloudflare بدل العملاء): أضف داخل كتلة `http {}` في `nginx.conf`:
```nginx
# Cloudflare real client IP
real_ip_header CF-Connecting-IP;
# نطاقات Cloudflare (حدّثها من cloudflare.com/ips)
set_real_ip_from 173.245.48.0/20;  set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;  set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;  set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;  set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22; set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;   set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;    set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
```

### الخطوة 3 — Environment (على الخادم)

```bash
cd ~/spruvex-erp/spruvex-app
cp .env.example .env
nano .env
```
القيم الإلزامية:
```env
NODE_ENV=production
DATABASE_URL=<من الخطوة 4>
JWT_SECRET=<ناتج: openssl rand -base64 32>
PORT=5000
VITE_PORT=5173
ALLOWED_ORIGINS=https://app.spruvex.com,https://spruvex.com
TRUST_PROXY=true
AI_PROVIDER=mock
```
ومتغيرات بناء الموقع (في جذر المستودع، لأمر compose):
```bash
cd ~/spruvex-erp
cat > .env <<'EOF'
SITE_VITE_API_URL=https://api.spruvex.com
SITE_VITE_APP_URL=https://app.spruvex.com
EOF
```

### الخطوة 4 — Database (لوحة Neon)

1. مشروع جديد: الاسم `spruvex-production`، المنطقة **AWS eu-central-1 (Frankfurt)**، خطة Launch.
2. انسخ `DATABASE_URL` (بـpooler) إلى `.env` أعلاه.
3. تحقق: `psql "<DATABASE_URL>" -c "select 1"` (أو أي عميل) يعمل من الخادم.

### الخطوة 5 — Migration (من الخادم)

```bash
cd ~/spruvex-erp/spruvex-app
corepack enable && pnpm install --frozen-lockfile
cd lib/db && pnpm run migrate
# تحقق: "Migrations complete." — 14 ملفاً (0000..0013)
```

### الخطوة 6 — Admin (مرة واحدة فقط)

```bash
cd ~/spruvex-erp/spruvex-app/artifacts/api-server
npx tsx scripts/seedPlatformAdmin.ts <اسم-مشرف-حقيقي> '<كلمة-مرور-قوية>'
```
⚠️ سجّلها في مدير كلمات المرور فوراً — **لا مسار استعادة لهذا الحساب.**

### الخطوة 7 — Deploy

**7-أ. إنشاء الخادم (لوحة Hetzner):** Cloud → New Server → Location: **Falkenstein** → Image: **Ubuntu 24.04** → Type: **CX32** → أضف مفتاح SSH الخاص بك → Create. سجّل الـIP (ثم أكمل الخطوة 1).

**7-ب. تجهيز الخادم:**
```bash
ssh root@<IP>
apt update && apt upgrade -y
# Docker
curl -fsSL https://get.docker.com | sh
# Node + pnpm (للـmigrate/seed خارج الحاويات)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs git
corepack enable
# جدار الحماية
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
# تعطيل دخول كلمة المرور لـSSH (مفاتيح فقط)
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart ssh
```

**7-ج. جلب الكود وتشغيله:**
```bash
git clone https://github.com/TareqQadi3/spruvex-erp.git ~/spruvex-erp
cd ~/spruvex-erp
# نفّذ الآن الخطوات 2(ملفات الشهادة) و3(البيئة) و4-6 أعلاه، ثم:
docker compose --profile full up -d --build
docker compose ps   # كل الحاويات healthy/running
```

**7-د. دمج Sentry** (الاستثناء الوحيد الملموس للكود — commit صغير واحد مخطط له مسبقاً): إضافة الـDSN وتهيئة Sentry في `core/errors/errorHandler.ts` — يُنفَّذ كمهمة منفصلة عند الوصول لهذه الخطوة.

### الخطوة 8 — Verification

```bash
curl -s https://api.spruvex.com/healthz    # {"status":"ok"}
curl -s https://api.spruvex.com/readyz     # {"status":"ok","checks":{"database":"ok","redis":"ok"}}
curl -s https://api.spruvex.com/api/public/plans | head -c 200   # الباقات الحقيقية
# rate limiting فعلي:
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code} " -X POST https://api.spruvex.com/api/auth/login -H "Content-Type: application/json" -d '{"username":"x","password":"y"}'; done
# يجب أن تتحول إلى 429 بعد ~20 محاولة
```
ثم عبر المتصفح: **قائمة الفحص التسعة بنود كاملة** من `PILOT_LAUNCH_PLAN.md §4` (إنشاء شركة → ... → الدعم)، وإنشاء شركة "SpruVex Demo" الدائمة، وربط UptimeRobot بـ`/readyz` مع اختبار حريق واحد (إيقاف الحاوية ثوانيَ والتأكد من وصول التنبيه).

---

## ترتيب التنفيذ الزمني الواقعي

1. اليوم: حسابات (ب) — خصوصاً Hetzner بسبب احتمال تحقق الهوية.
2. بعد اعتماد النطاق: شراؤه (دقائق) → 7-أ إنشاء الخادم → 1 DNS → 2 SSL → 7-ب تجهيز → 3-6 بيئة/قاعدة/هجرات/مشرف → 7-ج تشغيل → 7-د Sentry → 8 تحقق.
3. جلسة عمل واحدة مركّزة (2-4 ساعات) تكفي للخطوات كلها إذا كانت الحسابات جاهزة.
