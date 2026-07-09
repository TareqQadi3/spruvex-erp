rm PROJECT_VISION.md
mv PROJECT_VISION_UPDATED.md PROJECT_VISION.md
git add .
git commit -m "update project vision file (full replacement)"<div dir="rtl"># </div>  
You are now working on an EXISTING production application that already contains:  
  
- Accounting system  
- POS system  
- Maintenance / Repair system  
  
Your job is to TRANSFORM this existing system into a production-grade SaaS ERP platform.  
  
You are NOT starting from scratch.  
You are REFACTORING and EVOLVING the system.  
  
---  
  
# 🎯 FINAL GOAL  
  
Convert this application into a:  
  
➡ Multi-Tenant SaaS ERP System  
  
With:  
- Accounting  
- POS  
- Inventory  
- Sales & Purchases  
- Maintenance **(**Repair Shop Module**)**  
- Payment Engine  
- Integrations **(**Salla, Zid, Shopify, Tabby, Tamara**)**  
- Settings & Admin Panel  
  
---  
  
# 🧠 CORE ARCHITECTURE RULE  
  
Use:  
  
➡ Modular Monolith Architecture **(**NOT microservices**)**  
  
Why:  
- Faster development  
- Easier maintenance  
- Easier SaaS scaling  
  
---  
  
# 🏢 SAAS RULE **(**CRITICAL**)**  
  
This is a Multi-Tenant system.  
  
Every data entity MUST include:  
- company_id **(**tenant isolation**)**  
  
Rules:  
- No data sharing between companies  
- All queries MUST be scoped by company_id  
- Users belong to a company  
- Branches belong to a company  
  
---  
  
# 📦 REQUIRED MODULE STRUCTURE  
  
## CORE MODULES  
- Auth  
- Users  
- Companies  
- Branches  
- Roles & Permissions  
- Settings  
- Audit Logs  
  
---  
  
## BUSINESS MODULES  
  
### 1. Products & Inventory  
- Categories **(**tree structure unlimited depth**)**  
- Brands  
- Products  
- Stock management  
- Warehouses  
- Stock movements  
  
---  
  
### 2. POS SYSTEM **(**CRITICAL**)**  
- Ultra-fast UI **(**<300ms response**)**  
- Barcode scanning  
- Offline mode support  
- Cart system  
- Split payments  
- Hold / Resume sales  
- Receipt printing  
  
UI Layout:  
- Left: search + categories + brands  
- Center: product grid  
- Right: cart + payment + totals  
  
---  
  
### 3. PAYMENT ENGINE **(**VERY IMPORTANT**)**  
  
Must support:  
- Cash  
- Mada  
- Card  
- Tabby  
- Tamara  
- Custom payment methods  
  
Each payment method supports:  
- percentage fee  
- fixed fee  
- multiple fee layers **(**max 3**)**  
  
Rules:  
- Fees apply ONLY on the amount paid with that method  
- Split payments must be supported  
  
Example:  
Invoice = 500  
- 100 Cash  
- 100 Mada  
- 100 Mada  
- 200 Card **(**+ fees on card only**)**  
  
---  
  
### 4. INVOICING SYSTEM  
Must support:  
- Multiple templates **(**A4, POS 80mm, Service, Maintenance**)**  
- QR Code **(**ZATCA structure ready**)**  
- Multi-payment breakdown  
- Tax breakdown  
- Template engine  
  
---  
  
### 5. MAINTENANCE MODULE **(**REPAIR SHOPS**)**  
  
For:  
- Phones  
- Laptops  
- Electronics  
- Computers  
  
Repair Workflow:  
- Received  
- Diagnosed  
- Waiting approval  
- Repairing  
- Completed  
- Delivered  
  
Repair Order fields:  
- customer info  
- device type  
- brand  
- model  
- serial number  
- issue description  
- technician notes  
- parts used  
- labor cost  
  
Must include:  
- technician assignment  
- repair tracking  
- parts inventory deduction  
- repair reports  
  
---  
  
### 6. INTEGRATIONS MODULE  
  
E-commerce:  
- Salla  
- Zid  
- Shopify  
- WooCommerce  
  
Payments:  
- Tabby  
- Tamara  
- Stripe  
- PayTabs  
  
Rules:  
- Webhook based sync  
- Real-time inventory sync  
- Order sync in/out  
  
---  
  
### 7. SETTINGS MODULE  
  
Must include:  
- Company settings  
- Branch settings  
- Tax **(**VAT**)**  
- Invoice numbering rules  
- POS settings  
- Payment method configuration  
- API keys  
- Role permissions  
  
---  
  
# ⚙️ PERFORMANCE REQUIREMENTS  
  
- POS response < 300ms  
- Indexed search **(**barcode/SKU**)**  
- Redis caching  
- Background jobs for sync + invoices  
- Optimized DB queries  
  
---  
  
# 🔐 SECURITY REQUIREMENTS  
  
- JWT authentication  
- RBAC permissions  
- Full audit logs  
- Rate limiting per tenant  
- Strict company isolation  
  
---  
  
# 🗄️ DATABASE RULES  
  
All tables MUST include:  
- id **(**UUID**)**  
- company_id  
- created_at  
- updated_at  
  
---  
  
# 🚀 WHAT YOU MUST DO NOW  
  
1. Analyze existing codebase  
2. Identify structural problems  
3. Refactor into modular architecture  
4. Fix SaaS multi-tenancy design  
5. Improve performance bottlenecks  
6. Preserve existing features **(**do not delete business logic**)**  
7. Convert system into scalable SaaS ERP  
  
---  
  
# 📌 OUTPUT REQUIRED  
  
Return:  
  
- Refactored architecture  
- Improved module structure  
- Updated database design suggestions  
- API structure improvements  
- Critical issues list  
- SaaS readiness checklist  
  
---  
  
IMPORTANT:  
Do not overengineer.  
Do not split into microservices.  
Focus on production-grade SaaS ERP readiness.


---

# 💼 COMMERCIAL PACKAGING MODEL (UPDATED)

The system is also designed to support a SaaS commercial structure based on 3 core products + custom enterprise plan.

## 🧩 CORE PRODUCTS

### 1. Business ERP (General Companies)
For retail, wholesale, services, and general businesses.

Includes:
- Accounting
- Inventory
- Sales & Purchases
- Invoicing (ZATCA compliant)
- Multi-branch management

Target:
- SMEs
- Distributors
- Service companies

---

### 2. Restaurant System
For restaurants, cafés, cloud kitchens, and fast food.

Includes:
- POS system
- Tables & orders
- Kitchen Display System (KDS)
- Menu management
- Delivery & takeaway flows
- Shift management

Optimized for:
- High speed ordering
- Peak-hour performance

---

### 3. Sales & Repair System
For electronics, mobile shops, laptops, and repair centers.

Includes:
- POS sales
- Serial / IMEI tracking
- Repair orders lifecycle
- Technician management
- Spare parts inventory
- Device history tracking

---

## 🏢 CUSTOM / ENTERPRISE PLAN

For companies requiring:
- Advanced workflows
- Deep integrations
- Custom modules
- Dedicated SLA
- BI & analytics dashboards
- Multi-company structures

Pricing: Quote-based (Sales-led)

---

## 🔌 ADD-ONS STRATEGY

To maximize SaaS revenue:

- Extra users
- Extra branches
- Extra warehouses
- API access
- Advanced BI
- Custom reports
- Training & onboarding
- Data migration
- SLA premium support

Rule:
➡ Base system stays simple  
➡ Monetization happens via add-ons

---

## 📊 KEY STRATEGY ALIGNMENT

This commercial model ensures:
- Simple buying decision (3 choices only)
- Clear industry targeting
- Higher conversion rate
- Upselling through add-ons instead of complex plans

