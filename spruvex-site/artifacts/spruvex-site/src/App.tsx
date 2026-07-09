import React, { useState, useEffect } from 'react';
import fullLogo from '@assets/IMG_9856_1782692974743.jpeg';
import iconLogo from '@assets/IMG_9857_1782692974743.jpeg';
import { useScrollAnimation } from './useScrollAnimation';
import { getConfig, saveLead } from './config';

const FX: Record<string, number> = { SAR: 1, USD: 0.27, AED: 0.98 };
const CURR_LABEL: Record<string, Record<string, string>> = { 
  SAR: { ar: "ر.س", en: "SAR" }, 
  USD: { ar: "$", en: "$" }, 
  AED: { ar: "د.إ", en: "AED" } 
};

const CYCLE_LABEL_PERIOD: Record<string, Record<string, string>> = {
  ar: { m1: "شهرياً", m3: "كل 3 أشهر", m6: "كل 6 أشهر", y1: "سنوياً", life: "دفعة واحدة" },
  en: { m1: "/ month", m3: "/ 3 months", m6: "/ 6 months", y1: "/ year", life: "one-time" }
};

/* ===================== I18N DICTIONARY ===================== */
const I18N: Record<string, Record<string, string>> = {
  ar: {
    brand: "SpruVex",
    nav_features: "المميزات", nav_integrations: "التكاملات", nav_pricing: "الباقات",
    nav_trial: "التجربة المجانية", nav_contact: "تواصل معنا", nav_cta: "ابدأ مجاناً", nav_whatsapp: "تواصل واتساب",

    hero_eyebrow: "نظام ERP + كاشير سحابي للتجار",
    hero_title_html: 'كل أعمالك التجارية… <span class="gradient-text">في نظام واحد</span>',
    hero_sub: "SpruVex يوحّد المحاسبة والمبيعات والمخزون والفروع والصيانة وخدمة العملاء في منصة سحابية واحدة، ويربط متجرك مباشرة بسلة وزد وشوبيفاي وتابي وتمارا وواتساب.",
    hero_cta1: "جرّب 7 أيام مجاناً", hero_cta2: "اطّلع على الباقات",
    hero_trust1: "يثق به تجار في السعودية والخليج", hero_trust2: "بدون بطاقة بنكية للتجربة",
    node_acc: "المحاسبة", node_pos: "نقاط البيع", node_inv: "المخزون", node_branch: "الفروع", node_wa: "واتساب", node_pay: "تابي وتمارا",

    strip_label: "يتكامل مباشرة مع المنصات التي يستخدمها تجارك",

    feat_eyebrow: "منصة واحدة", feat_title: "كل ما يحتاجه تاجرك، بدون تطبيقات متفرقة",
    feat_sub: "من أول فاتورة إلى تقرير نهاية الشهر — SpruVex يجمع كل العمليات في تجربة واحدة سهلة ومرنة.",
    feat1_title: "ERP + نقاط بيع + خدمة، في نظام واحد",
    feat1_desc: "المحاسبة والمبيعات والمخزون والصيانة وإدارة العملاء، كلها تتحدث مع بعضها فورياً، بدون تصدير ملفات أو نقل بيانات يدوي بين برامج منفصلة.",
    feat1_service: "الصيانة",
    feat2_title: "فروع وصلاحيات", feat2_desc: "تحكّم في عدد غير محدود من الفروع، وحدّد صلاحيات كل موظف بدقة حسب دوره.",
    feat3_title: "لوحات ومؤشرات لحظية", feat3_desc: "تقارير مبيعات ومخزون وأداء فروع تتحدث لحظة بلحظة، بدون انتظار.",
    feat4_title: "سحابي بالكامل", feat4_desc: "افتح نظامك من أي جهاز ومن أي مكان، بياناتك محفوظة ومؤمّنة دائماً.",
    feat5_title: "تكامل مفتوح", feat5_desc: "اربط متجرك الإلكتروني، بوابات الدفع بالتقسيط، وواتساب — كل ذلك من إعدادات حسابك.",

    int_eyebrow: "تكاملات جاهزة", int_title: "يربط حساب التاجر بكل المنصات التي يعمل عليها",
    int_sub: "يربط التاجر حساباته الخارجية بحسابه في SpruVex مرة واحدة، وتتدفق البيانات تلقائياً بين الأنظمة.",
    int_tab1: "متاجر إلكترونية", int_tab2: "الدفع بالتقسيط", int_tab3: "واتساب للفواتير",
    int1_h: "سلة، زد، Shopify",
    int1_p: "يربط التاجر متجره الإلكتروني بحسابه في SpruVex، فتتزامن الطلبات والمخزون والمنتجات تلقائياً بين المتجر والنظام المحاسبي دون تدخل يدوي.",
    int1_li1: "مزامنة الطلبات الجديدة فور وصولها", int1_li2: "تحديث المخزون تلقائياً بين المتجر والفروع", int1_li3: "إصدار فواتير محاسبية لكل طلب مباشرة",
    flow_store: "متجرك على سلة / زد / Shopify", flow_sync: "مزامنة لحظية للطلبات والمخزون", flow_acc: "حسابك في SpruVex",
    int2_h: "تابي وتمارا",
    int2_p: "فعّل الدفع بالتقسيط في متجرك أو نقطة البيع، ويُسجَّل كل تقسيط تلقائياً في حساباتك دون أي إدخال يدوي إضافي.",
    int2_li1: "ربط حساب التاجر في تابي وتمارا بضغطة واحدة", int2_li2: "تتبّع المستحقات والتسويات في تقارير منفصلة", int2_li3: "يعمل في المتجر الإلكتروني وفي الفرع",
    flow_bnpl1: "عميلك يختار الدفع بالتقسيط", flow_bnpl2: "تابي / تمارا تعتمد العملية", flow_bnpl3: "تسجيل آلي في تقارير SpruVex",
    int3_h: "إرسال الفواتير عبر واتساب",
    int3_p: "اربط رقم واتساب الأعمال بحسابك، ويستلم عميلك فاتورته فوراً بعد إتمام الطلب — بدون طباعة أو رسائل يدوية.",
    int3_li1: "إرسال الفاتورة تلقائياً بعد كل عملية بيع", int3_li2: "تذكير تلقائي بالمستحقات والتقسيط", int3_li3: "قوالب رسائل قابلة للتخصيص باسم متجرك",
    flow_wa1: "عملية بيع جديدة في SpruVex", flow_wa2: "إرسال فوري عبر واتساب الأعمال", flow_wa3: "عميلك يستلم الفاتورة فوراً",

    price_eyebrow: "باقات مرنة", price_title: "باقة تناسب حجم كل تاجر",
    price_sub: "أسعار تقديرية مبدئية — قابلة للتعديل حسب السوق والمنطقة.",
    cyc_m1: "شهري", cyc_m3: "3 أشهر", cyc_m6: "6 أشهر", cyc_y1: "سنوي", cyc_y1_badge: "وفّر أكثر", cyc_life: "مدى الحياة",
    plan1_name: "الأساسية", plan1_desc: "للمتاجر الصغيرة والمشاريع الناشئة",
    plan1_f1: "فرع واحد ومستخدمان", plan1_f2: "نقاط بيع + محاسبة أساسية", plan1_f3: "ربط متجر إلكتروني واحد", plan1_f4: "فواتير واتساب يدوية", plan1_f5: "دعم عبر البريد والواتساب",
    plan2_badge: "الأكثر طلباً", plan2_name: "المتقدمة", plan2_desc: "للمتاجر متعددة الفروع والنمو السريع",
    plan2_f1: "حتى 5 فروع و10 مستخدمين", plan2_f2: "ERP كامل + صيانة وخدمة عملاء", plan2_f3: "ربط متاجر متعددة (سلة، زد، Shopify)", plan2_f4: "دفع بالتقسيط: تابي وتمارا", plan2_f5: "فواتير واتساب تلقائية", plan2_f6: "لوحات تحليلات متقدمة",
    plan3_name: "الاحترافية", plan3_desc: "للمؤسسات والسلاسل التجارية الكبيرة",
    plan3_f1: "فروع ومستخدمون غير محدودين", plan3_f2: "كل مزايا المتقدمة، بدون حدود", plan3_f3: "تكاملات مخصّصة عبر API", plan3_f4: "مدير حساب مخصص", plan3_f5: "أولوية الدعم الفني 24/7",
    plan_cta: "ابدأ الآن",
    lifetime_note: "في باقة الشراء مدى الحياة، تُطبَّق رسوم سنوية ثابتة للدعم الفني والاستضافة السحابية، تُعرض عليك بوضوح قبل إتمام الشراء.",
    lifetime_fee_label: "رسوم سنوية للدعم والاستضافة",

    trial_eyebrow: "بدون أي مخاطرة", trial_title: "جرّب SpruVex كاملاً قبل أي قرار شراء",
    trial_sub: "تجربة مجانية لمدة 7 أيام بكل المزايا، ودون الحاجة لإدخال بطاقة بنكية. إذا احتجت وقتاً إضافياً، يمكنك طلب تمديد التجربة 7 أيام أخرى مجاناً.",
    trial_s1: "سجّل بياناتك التجارية الأساسية", trial_s2: "استكشف النظام بكل صلاحياته لمدة 7 أيام", trial_s3: "اطلب تمديداً مجانياً أو اختر باقتك المناسبة",
    trial_days_label: "أيام تجربة مجانية كاملة", trial_cta: "ابدأ تجربتك الآن",
    trial_extend: "يمكن طلب تمديد", trial_extend_days: "+7 أيام", trial_extend_free: "مجاناً بعد الانتهاء",

    signup_eyebrow: "جاهزون لخدمتك", signup_title: "ابدأ مع SpruVex اليوم",
    signup_sub: "سجّل بيانات متجرك لطلب تجربة مجانية أو باقة مدفوعة، أو راسلنا مباشرة لأي استفسار — فريقنا يرد خلال ساعات العمل.",
    info1_h: "رد سريع", info1_p: "نتواصل معك خلال 24 ساعة عمل كحد أقصى",
    info2_h: "بياناتك بأمان", info2_p: "معلوماتك التجارية محفوظة ولا تُشارك مع أي طرف ثالث",
    info3_h: "إعداد مرافَق", info3_p: "نساعدك في إعداد حسابك وربط متجرك خطوة بخطوة",
    wa_card_h: "تفضّل التواصل المباشر؟", wa_card_p: "تواصل معنا الآن على واتساب", wa_card_cta: "واتساب",
    ftab1: "طلب تجربة / باقة", ftab2: "استفسار عام",
    success_h: "تم استلام طلبك بنجاح", success_p: "سيتواصل معك فريقنا قريباً. يمكنك أيضاً إرسال الطلب نفسه على واتساب لتسريع الرد.", success_wa: "إرسال الطلب عبر واتساب",
    f_name: "الاسم الكامل", f_store: "اسم المتجر / النشاط", f_phone: "رقم الجوال (واتساب)", f_email: "البريد الإلكتروني",
    f_interest: "ما الذي تريده؟", f_int_trial: "تجربة مجانية 7 أيام", f_int_basic: "باقة الأساسية", f_int_pro: "باقة المتقدمة", f_int_ent: "باقة الاحترافية", f_int_life: "شراء مدى الحياة",
    f_channels: "القنوات التي تحتاج ربطها", f_ch_none: "— اختياري —",
    f_notes: "ملاحظات إضافية (اختياري)", f_submit: "إرسال الطلب", f_wa_alt: "أو راسلنا واتساب مباشرة",
    f_note: "بإرسالك هذا النموذج فإنك توافق على تواصلنا معك بخصوص حسابك في SpruVex.",
    f_msg: "رسالتك",

    faq_eyebrow: "أسئلة شائعة", faq_title: "كل ما تحتاج معرفته قبل البدء",
    faq1_q: "هل أحتاج بطاقة بنكية للتجربة المجانية؟", faq1_a: "لا. التجربة المجانية لمدة 7 أيام لا تتطلب أي بطاقة بنكية أو دفع مسبق، وتشمل كل مزايا النظام.",
    faq2_q: "هل يمكن تمديد فترة التجربة؟", faq2_a: "نعم، بعد انتهاء الأيام السبعة الأولى يمكنك طلب تمديد 7 أيام إضافية مجاناً من حسابك مباشرة أو عبر التواصل معنا.",
    faq3_q: "ما الفرق بين الباقات الشهرية والشراء مدى الحياة؟", faq3_a: "الباقات الدورية تُجدَّد حسب المدة المختارة (شهر، 3 أشهر، 6 أشهر، سنة). خيار الشراء مدى الحياة يمنحك ترخيصاً دائماً للنظام، مع رسوم سنوية ثابتة ومنخفضة لتغطية الدعم الفني والاستضافة السحابية فقط.",
    faq4_q: "هل يمكن ربط أكثر من متجر إلكتروني بحساب واحد؟", faq4_a: "نعم في باقتي المتقدمة والاحترافية، يمكنك ربط أكثر من متجر (سلة، زد، Shopify) بحساب SpruVex نفسه ومزامنتها جميعاً من لوحة تحكم واحدة.",
    faq5_q: "كيف تُرسَل الفواتير للعملاء عبر واتساب؟", faq5_a: "بعد ربط رقم واتساب الأعمال الخاص بمتجرك، يرسل النظام الفاتورة تلقائياً للعميل فور إتمام عملية البيع، بصيغة جاهزة وقابلة للتخصيص باسم متجرك.",
    faq6_q: "هل يمكن تغيير الباقة لاحقاً؟", faq6_a: "نعم، يمكنك الترقية أو تغيير باقتك في أي وقت من حسابك، وسيُحتسب الفرق بشكل تناسبي.",

    footer_desc: "منصة سحابية تجمع المحاسبة والمبيعات والمخزون والفروع والصيانة وإدارة العملاء في نظام واحد سهل الاستخدام وقابل للتوسع.",
    footer_h1: "المنتج", footer_h2: "الشركة", footer_h3: "تواصل معنا",
    footer_faq: "الأسئلة الشائعة", footer_terms: "الشروط والأحكام", footer_privacy: "سياسة الخصوصية",
    footer_hours: "الأحد – الخميس، 9ص – 6م", footer_copy: "© 2026 SpruVex. جميع الحقوق محفوظة.",

    offer_title: "🎉 عرض خاص!", offer_desc: "خصم إضافي 5% على أول اشتراك", offer_copied: "تم النسخ!", offer_cta: "احصل عليه الآن"
  },
  en: {
    brand: "SpruVex",
    nav_features: "Features", nav_integrations: "Integrations", nav_pricing: "Pricing",
    nav_trial: "Free Trial", nav_contact: "Contact", nav_cta: "Start Free", nav_whatsapp: "Chat on WhatsApp",

    hero_eyebrow: "Cloud ERP + POS for merchants",
    hero_title_html: 'Every part of your business, <span class="gradient-text">one system</span>',
    hero_sub: "SpruVex unifies accounting, sales, inventory, branches, service, and customer management in one cloud platform — connected directly to Salla, Zid, Shopify, Tabby, Tamara, and WhatsApp.",
    hero_cta1: "Try 7 days free", hero_cta2: "See pricing",
    hero_trust1: "Trusted by merchants across Saudi Arabia & the Gulf", hero_trust2: "No card required for trial",
    node_acc: "Accounting", node_pos: "Point of Sale", node_inv: "Inventory", node_branch: "Branches", node_wa: "WhatsApp", node_pay: "Tabby & Tamara",

    strip_label: "Connects directly with the platforms your merchants already use",

    feat_eyebrow: "One platform", feat_title: "Everything your merchant needs, without scattered apps",
    feat_sub: "From the first invoice to the end-of-month report — SpruVex brings every operation into one easy, flexible experience.",
    feat1_title: "ERP + POS + service, in one system",
    feat1_desc: "Accounting, sales, inventory, maintenance, and customer management all talk to each other instantly — no exporting files or manually moving data between separate tools.",
    feat1_service: "Service",
    feat2_title: "Branches & permissions", feat2_desc: "Manage unlimited branches and set precise permissions for every employee based on their role.",
    feat3_title: "Live dashboards", feat3_desc: "Sales, inventory, and branch performance reports update in real time — no waiting.",
    feat4_title: "Fully cloud-based", feat4_desc: "Access your system from any device, anywhere — your data is always saved and secured.",
    feat5_title: "Open integrations", feat5_desc: "Connect your online store, installment payment gateways, and WhatsApp — all from your account settings.",

    int_eyebrow: "Ready-made integrations", int_title: "Connects a merchant's account to every platform they run on",
    int_sub: "Merchants link their external accounts to SpruVex once, and data flows automatically between systems.",
    int_tab1: "Online stores", int_tab2: "Installment payments", int_tab3: "WhatsApp invoicing",
    int1_h: "Salla, Zid, Shopify",
    int1_p: "Merchants connect their online store to their SpruVex account, syncing orders, inventory, and products automatically between the store and the accounting system — no manual work.",
    int1_li1: "New orders synced the moment they arrive", int1_li2: "Inventory updated automatically across the store and branches", int1_li3: "Accounting invoices issued for every order directly",
    flow_store: "Your store on Salla / Zid / Shopify", flow_sync: "Real-time order & inventory sync", flow_acc: "Your SpruVex account",
    int2_h: "Tabby & Tamara",
    int2_p: "Enable installment payments in your store or point of sale, and every installment is logged automatically in your accounts with no extra manual entry.",
    int2_li1: "Link your Tabby and Tamara merchant account in one click", int2_li2: "Track dues and settlements in separate reports", int2_li3: "Works in both the online store and in-branch",
    flow_bnpl1: "Your customer chooses installments", flow_bnpl2: "Tabby / Tamara approves the transaction", flow_bnpl3: "Automatically logged in SpruVex reports",
    int3_h: "Sending invoices via WhatsApp",
    int3_p: "Link your WhatsApp Business number to your account, and your customer receives their invoice instantly after checkout — no printing, no manual messages.",
    int3_li1: "Invoice sent automatically after every sale", int3_li2: "Automatic reminders for dues and installments", int3_li3: "Customizable message templates with your store's name",
    flow_wa1: "New sale recorded in SpruVex", flow_wa2: "Instantly sent via WhatsApp Business", flow_wa3: "Your customer receives the invoice instantly",

    price_eyebrow: "Flexible plans", price_title: "A plan that fits every merchant's size",
    price_sub: "Preliminary estimated pricing — adjustable by market and region.",
    cyc_m1: "Monthly", cyc_m3: "3 months", cyc_m6: "6 months", cyc_y1: "Yearly", cyc_y1_badge: "Best value", cyc_life: "Lifetime",
    plan1_name: "Basic", plan1_desc: "For small stores and new businesses",
    plan1_f1: "1 branch, 2 users", plan1_f2: "POS + basic accounting", plan1_f3: "1 online store connection", plan1_f4: "Manual WhatsApp invoices", plan1_f5: "Email & WhatsApp support",
    plan2_badge: "Most popular", plan2_name: "Advanced", plan2_desc: "For multi-branch stores scaling fast",
    plan2_f1: "Up to 5 branches, 10 users", plan2_f2: "Full ERP + maintenance & service", plan2_f3: "Multiple store connections (Salla, Zid, Shopify)", plan2_f4: "Installments via Tabby & Tamara", plan2_f5: "Automatic WhatsApp invoices", plan2_f6: "Advanced analytics dashboards",
    plan3_name: "Enterprise", plan3_desc: "For large businesses and retail chains",
    plan3_f1: "Unlimited branches & users", plan3_f2: "Everything in Advanced, no limits", plan3_f3: "Custom API integrations", plan3_f4: "Dedicated account manager", plan3_f5: "Priority 24/7 technical support",
    plan_cta: "Get started",
    lifetime_note: "With the Lifetime plan, a fixed annual fee applies for technical support and cloud hosting, shown clearly before purchase.",
    lifetime_fee_label: "annual support & hosting fee",

    trial_eyebrow: "Zero risk", trial_title: "Try the full SpruVex experience before deciding",
    trial_sub: "A free 7-day trial with every feature included, no card required. Need more time? Request a free 7-day extension after it ends.",
    trial_s1: "Register your basic business details", trial_s2: "Explore the full system for 7 days", trial_s3: "Request a free extension or pick your plan",
    trial_days_label: "days of full free trial", trial_cta: "Start your trial now",
    trial_extend: "You can request", trial_extend_days: "+7 more days", trial_extend_free: "free after it ends",

    signup_eyebrow: "Ready to help", signup_title: "Get started with SpruVex today",
    signup_sub: "Register your store details to request a free trial or paid plan, or message us directly with any question — our team replies during working hours.",
    info1_h: "Fast response", info1_p: "We get back to you within 24 working hours at most",
    info2_h: "Your data is safe", info2_p: "Your business information is stored securely and never shared with third parties",
    info3_h: "Guided setup", info3_p: "We help you set up your account and connect your store step by step",
    wa_card_h: "Prefer to talk directly?", wa_card_p: "Message us now on WhatsApp", wa_card_cta: "WhatsApp",
    ftab1: "Request trial / plan", ftab2: "General inquiry",
    success_h: "Your request was received", success_p: "Our team will reach out soon. You can also send the same request on WhatsApp to speed things up.", success_wa: "Send request via WhatsApp",
    f_name: "Full name", f_store: "Store / business name", f_phone: "Mobile number (WhatsApp)", f_email: "Email address",
    f_interest: "What are you interested in?", f_int_trial: "7-day free trial", f_int_basic: "Basic plan", f_int_pro: "Advanced plan", f_int_ent: "Enterprise plan", f_int_life: "Lifetime purchase",
    f_channels: "Channels you need connected", f_ch_none: "— optional —",
    f_notes: "Additional notes (optional)", f_submit: "Send request", f_wa_alt: "Or message us on WhatsApp",
    f_note: "By submitting this form, you agree to be contacted about your SpruVex account.",
    f_msg: "Your message",

    faq_eyebrow: "FAQ", faq_title: "Everything you need to know before starting",
    faq1_q: "Do I need a credit card for the free trial?", faq1_a: "No. The 7-day free trial requires no card or upfront payment, and includes every feature of the system.",
    faq2_q: "Can I extend the trial period?", faq2_a: "Yes — after the first 7 days end, you can request a free 7-day extension directly from your account or by contacting us.",
    faq3_q: "What's the difference between recurring plans and the lifetime purchase?", faq3_a: "Recurring plans renew based on your chosen cycle (monthly, 3 months, 6 months, yearly). The lifetime option gives you a permanent license to the system, with a fixed, low annual fee covering technical support and cloud hosting only.",
    faq4_q: "Can I connect more than one online store to one account?", faq4_a: "Yes — in the Advanced and Enterprise plans, you can connect multiple stores (Salla, Zid, Shopify) to the same SpruVex account and sync them all from one dashboard.",
    faq5_q: "How are invoices sent to customers via WhatsApp?", faq5_a: "Once you link your store's WhatsApp Business number, the system automatically sends the invoice to the customer right after checkout, in a ready format customizable with your store's name.",
    faq6_q: "Can I change my plan later?", faq6_a: "Yes, you can upgrade or change your plan anytime from your account, and the difference is calculated proportionally.",

    footer_desc: "A cloud platform that brings accounting, sales, inventory, branches, service, and customer management into one easy, scalable system.",
    footer_h1: "Product", footer_h2: "Company", footer_h3: "Contact",
    footer_faq: "FAQ", footer_terms: "Terms & Conditions", footer_privacy: "Privacy Policy",
    footer_hours: "Sun – Thu, 9am – 6pm", footer_copy: "© 2026 SpruVex. All rights reserved.",
    offer_title: "🎉 Special Offer!", offer_desc: "Get an extra 5% off your first subscription", offer_copied: "Copied!", offer_cta: "Claim Offer"
  }
};

/* ===================== REACT APP ===================== */
export default function App() {
  useScrollAnimation();
  const config = getConfig();
  const [lang, setLang] = useState('ar');
  const [curr, setCurr] = useState('SAR');
  const [cycle, setCycle] = useState('m1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeIntTab, setActiveIntTab] = useState('stores');
  const [activeFormTab, setActiveFormTab] = useState('trial');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(1);
  const [showOffer, setShowOffer] = useState(false);

  const t = (key: string) => I18N[lang][key] || key;

  // Plan features: use admin-editable Arabic copy; fall back to I18N for English
  const planFeat = {
    basic:      lang === 'ar' ? config.planFeatures.basic      : [t('plan1_f1'), t('plan1_f2'), t('plan1_f3'), t('plan1_f4'), t('plan1_f5')],
    pro:        lang === 'ar' ? config.planFeatures.pro        : [t('plan2_f1'), t('plan2_f2'), t('plan2_f3'), t('plan2_f4'), t('plan2_f5'), t('plan2_f6')],
    enterprise: lang === 'ar' ? config.planFeatures.enterprise : [t('plan3_f1'), t('plan3_f2'), t('plan3_f3'), t('plan3_f4'), t('plan3_f5')],
  };

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (!config.offer.enabled) return;
    const isClosed = localStorage.getItem('spruvex_offer_closed');
    if (isClosed) return;
    const timer = setTimeout(() => setShowOffer(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleCloseOffer = () => {
    setShowOffer(false);
    localStorage.setItem('spruvex_offer_closed', 'true');
  };

  const getPrice = (plan: 'basic' | 'pro' | 'enterprise') => {
    const row = config.pricing[plan];
    const base = (row as unknown as Record<string, number>)[cycle] ?? 0;
    return Math.round(base * FX[curr]);
  };

  const getWhatsappUrl = (msg: string) =>
    `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`;

  const handleTrialFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name     = String(fd.get('name')     || '');
    const store    = String(fd.get('store')    || '');
    const phone    = String(fd.get('phone')    || '');
    const email    = String(fd.get('email')    || '');
    const interest = String(fd.get('interest') || '');
    const channels = String(fd.get('channels') || '');
    const notes    = String(fd.get('notes')    || '');

    // Save to admin leads
    saveLead({ type: 'trial', name, store, phone, email, interest, channels, notes });

    // Also open WhatsApp so you get an immediate notification
    const msg = `طلب جديد من SpruVex\nالاسم: ${name}\nالمتجر: ${store}\nالجوال: ${phone}\nالبريد: ${email}\nالاهتمام: ${interest}\nالقنوات: ${channels}\nملاحظات: ${notes}`;
    window.open(getWhatsappUrl(msg), '_blank');
    setShowSuccess(true);
  };

  const handleContactFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name    = String(fd.get('name')    || '');
    const phone   = String(fd.get('phone')   || '');
    const email   = String(fd.get('email')   || '');
    const message = String(fd.get('message') || '');

    // Save to admin leads
    saveLead({ type: 'contact', name, phone, email, message });

    // Also open WhatsApp
    const msg = `استفسار جديد من SpruVex\nالاسم: ${name}\nالجوال: ${phone}\nالبريد: ${email}\nالرسالة: ${message}`;
    window.open(getWhatsappUrl(msg), '_blank');
    setShowSuccess(true);
  };

  return (
    <>
      <header className="navbar">
        <div className="container nav-inner">
          <a href="#top" className="nav-logo">
            <img src={fullLogo} alt="SpruVex Logo" />
            <span className="nav-wordmark">{t('brand')}</span>
          </a>
          <nav className="nav-links">
            <a href="#features">{t('nav_features')}</a>
            <a href="#integrations">{t('nav_integrations')}</a>
            <a href="#pricing">{t('nav_pricing')}</a>
            <a href="#trial">{t('nav_trial')}</a>
            <a href="#contact">{t('nav_contact')}</a>
          </nav>
          <div className="nav-actions">
            <div className="toggle-pill">
              <button className={lang === 'ar' ? 'active' : ''} onClick={() => setLang('ar')}>AR</button>
              <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <div className="toggle-pill">
              <button className={curr === 'SAR' ? 'active' : ''} onClick={() => setCurr('SAR')}>SAR</button>
              <button className={curr === 'USD' ? 'active' : ''} onClick={() => setCurr('USD')}>USD</button>
              <button className={curr === 'AED' ? 'active' : ''} onClick={() => setCurr('AED')}>AED</button>
            </div>
            <a href="#signup" className="btn btn-primary btn-sm">{t('nav_cta')}</a>
          </div>
          <button className="nav-burger" aria-label="Menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <span></span>
          </button>
        </div>
      </header>

      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <a href="#features" onClick={() => setMobileMenuOpen(false)}>{t('nav_features')}</a>
        <a href="#integrations" onClick={() => setMobileMenuOpen(false)}>{t('nav_integrations')}</a>
        <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>{t('nav_pricing')}</a>
        <a href="#trial" onClick={() => setMobileMenuOpen(false)}>{t('nav_trial')}</a>
        <a href="#contact" onClick={() => setMobileMenuOpen(false)}>{t('nav_contact')}</a>
        <div className="mob-actions">
          <a href="#signup" className="btn btn-gradient" onClick={() => setMobileMenuOpen(false)}>{t('nav_cta')}</a>
          <a href={getWhatsappUrl('مرحباً فريق SpruVex، أريد الاستفسار عن النظام.')} target="_blank" rel="noreferrer" className="btn btn-ghost">{t('nav_whatsapp')}</a>
        </div>
        <div className="mob-toggles">
          <div className="toggle-pill">
            <button className={lang === 'ar' ? 'active' : ''} onClick={() => { setLang('ar'); setMobileMenuOpen(false); }}>AR</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => { setLang('en'); setMobileMenuOpen(false); }}>EN</button>
          </div>
          <div className="toggle-pill">
            <button className={curr === 'SAR' ? 'active' : ''} onClick={() => { setCurr('SAR'); setMobileMenuOpen(false); }}>SAR</button>
            <button className={curr === 'USD' ? 'active' : ''} onClick={() => { setCurr('USD'); setMobileMenuOpen(false); }}>USD</button>
            <button className={curr === 'AED' ? 'active' : ''} onClick={() => { setCurr('AED'); setMobileMenuOpen(false); }}>AED</button>
          </div>
        </div>
      </div>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><span className="dot"></span><span>{t('hero_eyebrow')}</span></span>
              <h1 dangerouslySetInnerHTML={{ __html: t('hero_title_html') }}></h1>
              <p>{t('hero_sub')}</p>
              <div className="hero-ctas">
                <a href="#trial" className="btn btn-gradient">{t('hero_cta1')}</a>
                <a href="#pricing" className="btn btn-ghost">{t('hero_cta2')}</a>
              </div>
              <div className="hero-trust">
                <span className="stars">★★★★★</span>
                <span>{t('hero_trust1')}</span>
                <span className="trust-sep"></span>
                <span>{t('hero_trust2')}</span>
              </div>
            </div>

            <div className="system-map" aria-hidden="true">
              <svg className="map-svg" viewBox="0 0 500 480" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00D4FF"/>
                    <stop offset="100%" stopColor="#6A2CFF"/>
                  </linearGradient>
                </defs>
                <path d="M250,240 L70,60"/>
                <path d="M250,240 L420,40"/>
                <path d="M250,240 L40,220"/>
                <path d="M250,240 L460,230"/>
                <path d="M250,240 L90,410"/>
                <path d="M250,240 L420,420"/>
              </svg>
              <div className="map-core">
                <div className="pulse"></div>
                <img src={iconLogo} alt="SpruVex" />
              </div>
              <div className="map-node n1"><span className="ico" style={{background:'#EBF3FF',color:'#005BFF'}}>🧾</span><span className="lbl">{t('node_acc')}</span></div>
              <div className="map-node n2"><span className="ico" style={{background:'#EAFBFF',color:'#00A6CC'}}>🛒</span><span className="lbl">{t('node_pos')}</span></div>
              <div className="map-node n3"><span className="ico" style={{background:'#F1EBFF',color:'#6A2CFF'}}>📦</span><span className="lbl">{t('node_inv')}</span></div>
              <div className="map-node n4"><span className="ico" style={{background:'#EBF3FF',color:'#005BFF'}}>🏬</span><span className="lbl">{t('node_branch')}</span></div>
              <div className="map-node n5"><span className="ico" style={{background:'#E9FBEF',color:'#1FA855'}}>💬</span><span className="lbl">{t('node_wa')}</span></div>
              <div className="map-node n6"><span className="ico" style={{background:'#FFF3E6',color:'#FF8A1F'}}>💳</span><span className="lbl">{t('node_pay')}</span></div>
            </div>
          </div>
        </section>

        {/* LOGO STRIP */}
        <section className="logo-strip">
          <div className="container">
            <p className="logo-strip-label">{t('strip_label')}</p>
            <div className="logo-row">
              <span className="logo-chip"><span className="dotc" style={{background:'#6A2CFF'}}></span>سلة</span>
              <span className="logo-chip"><span className="dotc" style={{background:'#00D4FF'}}></span>زد</span>
              <span className="logo-chip"><span className="dotc" style={{background:'#95D600'}}></span>Shopify</span>
              <span className="logo-chip"><span className="dotc" style={{background:'#1FD2AF'}}></span>Tabby</span>
              <span className="logo-chip"><span className="dotc" style={{background:'#D63AFF'}}></span>Tamara</span>
              <span className="logo-chip"><span className="dotc" style={{background:'#25D366'}}></span>WhatsApp Business</span>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="section" id="features">
          <div className="container">
            <div className="section-head center animate-on-scroll">
              <span className="eyebrow"><span className="dot"></span><span>{t('feat_eyebrow')}</span></span>
              <h2 className="section-title">{t('feat_title')}</h2>
              <p className="section-sub">{t('feat_sub')}</p>
            </div>

            <div className="features-grid">
              <div className="feature-card lead animate-on-scroll">
                <div className="feature-icon">🧩</div>
                <h3 className="feature-title">{t('feat1_title')}</h3>
                <p className="feature-desc">{t('feat1_desc')}</p>
                <div className="lead-visual">
                  <div className="lv-item" style={{color:'white'}}>{t('node_acc')}</div>
                  <div className="lv-item" style={{color:'white'}}>{t('node_pos')}</div>
                  <div className="lv-item" style={{color:'white'}}>{t('node_inv')}</div>
                  <div className="lv-item" style={{color:'white'}}>{t('feat1_service')}</div>
                </div>
              </div>

              <div className="feature-card animate-on-scroll delay-100">
                <div className="feature-icon">🏬</div>
                <h3 className="feature-title">{t('feat2_title')}</h3>
                <p className="feature-desc">{t('feat2_desc')}</p>
              </div>

              <div className="feature-card animate-on-scroll delay-200">
                <div className="feature-icon">📊</div>
                <h3 className="feature-title">{t('feat3_title')}</h3>
                <p className="feature-desc">{t('feat3_desc')}</p>
              </div>

              <div className="feature-card animate-on-scroll delay-300">
                <div className="feature-icon">☁️</div>
                <h3 className="feature-title">{t('feat4_title')}</h3>
                <p className="feature-desc">{t('feat4_desc')}</p>
              </div>

              <div className="feature-card animate-on-scroll delay-100">
                <div className="feature-icon">🔌</div>
                <h3 className="feature-title">{t('feat5_title')}</h3>
                <p className="feature-desc">{t('feat5_desc')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* INTEGRATIONS */}
        <section className="section" id="integrations">
          <div className="container">
            <div className="integrations-section">
              <div className="container">
                <div className="section-head">
                  <span className="eyebrow"><span className="dot"></span><span>{t('int_eyebrow')}</span></span>
                  <h2 className="section-title">{t('int_title')}</h2>
                  <p className="section-sub">{t('int_sub')}</p>
                </div>

                <div className="int-tabs">
                  <button className={`int-tab ${activeIntTab === 'stores' ? 'active' : ''}`} onClick={() => setActiveIntTab('stores')}>{t('int_tab1')}</button>
                  <button className={`int-tab ${activeIntTab === 'bnpl' ? 'active' : ''}`} onClick={() => setActiveIntTab('bnpl')}>{t('int_tab2')}</button>
                  <button className={`int-tab ${activeIntTab === 'wa' ? 'active' : ''}`} onClick={() => setActiveIntTab('wa')}>{t('int_tab3')}</button>
                </div>

                <div className="int-panels">
                  <div className={`int-panel ${activeIntTab === 'stores' ? 'active' : ''}`}>
                    <div className="int-panel-copy">
                      <h3>{t('int1_h')}</h3>
                      <p>{t('int1_p')}</p>
                      <ul>
                        <li><span className="chk">✓</span><span>{t('int1_li1')}</span></li>
                        <li><span className="chk">✓</span><span>{t('int1_li2')}</span></li>
                        <li><span className="chk">✓</span><span>{t('int1_li3')}</span></li>
                      </ul>
                    </div>
                    <div className="int-visual">
                      <div className="int-flow">
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(106,44,255,.18)',color:'#B89BFF'}}>🛍️</span><span>{t('flow_store')}</span></div>
                        <span className="flow-arrow">↓</span>
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(0,212,255,.16)',color:'#5FE3FF'}}>🔗</span><span>{t('flow_sync')}</span></div>
                        <span className="flow-arrow">↓</span>
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(0,91,255,.18)',color:'#7FB1FF'}}>🧾</span><span>{t('flow_acc')}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className={`int-panel ${activeIntTab === 'bnpl' ? 'active' : ''}`}>
                    <div className="int-panel-copy">
                      <h3>{t('int2_h')}</h3>
                      <p>{t('int2_p')}</p>
                      <ul>
                        <li><span className="chk">✓</span><span>{t('int2_li1')}</span></li>
                        <li><span className="chk">✓</span><span>{t('int2_li2')}</span></li>
                        <li><span className="chk">✓</span><span>{t('int2_li3')}</span></li>
                      </ul>
                    </div>
                    <div className="int-visual">
                      <div className="int-flow">
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(255,138,31,.18)',color:'#FFB066'}}>💳</span><span>{t('flow_bnpl1')}</span></div>
                        <span className="flow-arrow">↓</span>
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(0,212,255,.16)',color:'#5FE3FF'}}>⚙️</span><span>{t('flow_bnpl2')}</span></div>
                        <span className="flow-arrow">↓</span>
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(0,91,255,.18)',color:'#7FB1FF'}}>📋</span><span>{t('flow_bnpl3')}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className={`int-panel ${activeIntTab === 'wa' ? 'active' : ''}`}>
                    <div className="int-panel-copy">
                      <h3>{t('int3_h')}</h3>
                      <p>{t('int3_p')}</p>
                      <ul>
                        <li><span className="chk">✓</span><span>{t('int3_li1')}</span></li>
                        <li><span className="chk">✓</span><span>{t('int3_li2')}</span></li>
                        <li><span className="chk">✓</span><span>{t('int3_li3')}</span></li>
                      </ul>
                    </div>
                    <div className="int-visual">
                      <div className="int-flow">
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(37,211,102,.18)',color:'#5FE38C'}}>🧾</span><span>{t('flow_wa1')}</span></div>
                        <span className="flow-arrow">↓</span>
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(37,211,102,.18)',color:'#5FE38C'}}>💬</span><span>{t('flow_wa2')}</span></div>
                        <span className="flow-arrow">↓</span>
                        <div className="flow-card"><span className="fc-ico" style={{background:'rgba(0,91,255,.18)',color:'#7FB1FF'}}>✅</span><span>{t('flow_wa3')}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="section" id="pricing">
          <div className="container">
            <div className="section-head center">
              <span className="eyebrow"><span className="dot"></span><span>{t('price_eyebrow')}</span></span>
              <h2 className="section-title">{t('price_title')}</h2>
              <p className="section-sub">{t('price_sub')}</p>
            </div>

            <div className="pricing-controls">
              <div className="cycle-tabs">
                <button className={`cycle-tab ${cycle === 'm1' ? 'active' : ''}`} onClick={() => setCycle('m1')}>{t('cyc_m1')}</button>
                <button className={`cycle-tab ${cycle === 'm3' ? 'active' : ''}`} onClick={() => setCycle('m3')}>{t('cyc_m3')}</button>
                <button className={`cycle-tab ${cycle === 'm6' ? 'active' : ''}`} onClick={() => setCycle('m6')}>{t('cyc_m6')}</button>
                <button className={`cycle-tab ${cycle === 'y1' ? 'active' : ''}`} onClick={() => setCycle('y1')}>
                  <span className="save-badge">{t('cyc_y1_badge')}</span>
                  <span>{t('cyc_y1')}</span>
                </button>
                <button className={`cycle-tab ${cycle === 'life' ? 'active' : ''}`} onClick={() => setCycle('life')}>{t('cyc_life')}</button>
              </div>
            </div>

            <div className="pricing-grid">
              {/* Basic */}
              <div className="plan-card">
                <div className="plan-name">{t('plan1_name')}</div>
                <p className="plan-desc">{t('plan1_desc')}</p>
                <div className="plan-price">
                  <span className="amount">{getPrice('basic')}</span>
                  <span className="curr">{CURR_LABEL[curr][lang]}</span>
                </div>
                <div className="plan-period">{CYCLE_LABEL_PERIOD[lang][cycle]}</div>
                <ul className="plan-feat">
                  {planFeat.basic.map((f, i) => <li key={i}><span className="chk">✓</span><span>{f}</span></li>)}
                </ul>
                <a href="#signup" className="btn btn-ghost">{t('plan_cta')}</a>
              </div>

              {/* Pro */}
              <div className="plan-card featured">
                <span className="plan-badge">{t('plan2_badge')}</span>
                <div className="plan-name">{t('plan2_name')}</div>
                <p className="plan-desc">{t('plan2_desc')}</p>
                <div className="plan-price">
                  <span className="amount">{getPrice('pro')}</span>
                  <span className="curr">{CURR_LABEL[curr][lang]}</span>
                </div>
                <div className="plan-period">{CYCLE_LABEL_PERIOD[lang][cycle]}</div>
                <ul className="plan-feat">
                  {planFeat.pro.map((f, i) => <li key={i}><span className="chk">✓</span><span>{f}</span></li>)}
                </ul>
                <a href="#signup" className="btn btn-gradient">{t('plan_cta')}</a>
              </div>

              {/* Enterprise */}
              <div className="plan-card">
                <div className="plan-name">{t('plan3_name')}</div>
                <p className="plan-desc">{t('plan3_desc')}</p>
                <div className="plan-price">
                  <span className="amount">{getPrice('enterprise')}</span>
                  <span className="curr">{CURR_LABEL[curr][lang]}</span>
                </div>
                <div className="plan-period">{CYCLE_LABEL_PERIOD[lang][cycle]}</div>
                <ul className="plan-feat">
                  {planFeat.enterprise.map((f, i) => <li key={i}><span className="chk">✓</span><span>{f}</span></li>)}
                </ul>
                <a href="#signup" className="btn btn-ghost">{t('plan_cta')}</a>
              </div>
            </div>

            {cycle === 'life' && (
              <div className="lifetime-note">
                <span className="li-ico">ℹ️</span>
                <span>{t('lifetime_note')}</span>
              </div>
            )}
          </div>
        </section>

        {/* TRIAL */}
        <section className="section" id="trial">
          <div className="container">
            <div className="trial-section">
              <div className="trial-copy">
                <span className="eyebrow"><span className="dot"></span><span>{t('trial_eyebrow')}</span></span>
                <h2>{t('trial_title')}</h2>
                <p>{t('trial_sub')}</p>
                <div className="trial-steps">
                  <div className="trial-step"><span className="ts-num">1</span><span>{t('trial_s1')}</span></div>
                  <div className="trial-step"><span className="ts-num">2</span><span>{t('trial_s2')}</span></div>
                  <div className="trial-step"><span className="ts-num">3</span><span>{t('trial_s3')}</span></div>
                </div>
              </div>
              <div className="trial-card">
                <div className="trial-days">7</div>
                <div className="trial-days-label">{t('trial_days_label')}</div>
                <a href="#signup" className="btn btn-gradient" style={{width: '100%'}}>{t('trial_cta')}</a>
                <div className="trial-extend">
                  <span>{t('trial_extend')}</span> <strong>{t('trial_extend_days')}</strong> <span>{t('trial_extend_free')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SIGNUP / CONTACT */}
        <section className="section" id="signup">
          <div id="contact" style={{position:'absolute', top: '-100px'}}></div>
          <div className="container">
            <div className="signup-grid">
              <div className="signup-info">
                <span className="eyebrow"><span className="dot"></span><span>{t('signup_eyebrow')}</span></span>
                <h2>{t('signup_title')}</h2>
                <p>{t('signup_sub')}</p>

                <div className="info-row">
                  <span className="ir-ico">⏱️</span>
                  <div><h4>{t('info1_h')}</h4><p>{t('info1_p')}</p></div>
                </div>
                <div className="info-row">
                  <span className="ir-ico">🔒</span>
                  <div><h4>{t('info2_h')}</h4><p>{t('info2_p')}</p></div>
                </div>
                <div className="info-row">
                  <span className="ir-ico">🛠️</span>
                  <div><h4>{t('info3_h')}</h4><p>{t('info3_p')}</p></div>
                </div>

                <div className="wa-float-card">
                  <span className="wic">💬</span>
                  <div className="wt">
                    <strong>{t('wa_card_h')}</strong>
                    <span>{t('wa_card_p')}</span>
                  </div>
                  <a href={getWhatsappUrl('مرحباً فريق SpruVex، أريد الاستفسار عن النظام.')} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{marginInlineStart: 'auto'}}>
                    {t('wa_card_cta')}
                  </a>
                </div>
              </div>

              <div className="signup-form">
                <div className="form-tabs">
                  <button className={`form-tab ${activeFormTab === 'trial' ? 'active' : ''}`} onClick={() => setActiveFormTab('trial')}>{t('ftab1')}</button>
                  <button className={`form-tab ${activeFormTab === 'contact' ? 'active' : ''}`} onClick={() => setActiveFormTab('contact')}>{t('ftab2')}</button>
                </div>

                {showSuccess ? (
                  <div className="form-success show">
                    <div className="fs-ico">✓</div>
                    <h3>{t('success_h')}</h3>
                    <p>{t('success_p')}</p>
                  </div>
                ) : (
                  <>
                    <form className={`form-panel ${activeFormTab === 'trial' ? 'active' : ''}`} onSubmit={handleTrialFormSubmit}>
                      <div className="form-grid">
                        <div className="form-field">
                          <label>{t('f_name')}</label>
                          <input type="text" name="name" required />
                        </div>
                        <div className="form-field">
                          <label>{t('f_store')}</label>
                          <input type="text" name="store" required />
                        </div>
                        <div className="form-field">
                          <label>{t('f_phone')}</label>
                          <input type="tel" name="phone" required placeholder="05xxxxxxxx" />
                        </div>
                        <div className="form-field">
                          <label>{t('f_email')}</label>
                          <input type="email" name="email" required />
                        </div>
                        <div className="form-field">
                          <label>{t('f_interest')}</label>
                          <select name="interest">
                            <option value="trial">{t('f_int_trial')}</option>
                            <option value="basic">{t('f_int_basic')}</option>
                            <option value="pro">{t('f_int_pro')}</option>
                            <option value="enterprise">{t('f_int_ent')}</option>
                            <option value="lifetime">{t('f_int_life')}</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label>{t('f_channels')}</label>
                          <select name="channels">
                            <option value="">{t('f_ch_none')}</option>
                            <option value="salla">سلة</option>
                            <option value="zid">زد</option>
                            <option value="shopify">Shopify</option>
                            <option value="tabby_tamara">Tabby / Tamara</option>
                            <option value="whatsapp">WhatsApp</option>
                          </select>
                        </div>
                        <div className="form-field full">
                          <label>{t('f_notes')}</label>
                          <textarea name="notes"></textarea>
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn btn-gradient">{t('f_submit')}</button>
                        <a href={getWhatsappUrl('مرحباً، أود طلب تجربة/اشتراك في نظام SpruVex.')} target="_blank" rel="noreferrer" className="btn btn-ghost">{t('f_wa_alt')}</a>
                      </div>
                      <p className="form-note">{t('f_note')}</p>
                    </form>

                    <form className={`form-panel ${activeFormTab === 'contact' ? 'active' : ''}`} onSubmit={handleContactFormSubmit}>
                      <div className="form-grid">
                        <div className="form-field">
                          <label>{t('f_name')}</label>
                          <input type="text" name="name" required />
                        </div>
                        <div className="form-field">
                          <label>{t('f_phone')}</label>
                          <input type="tel" name="phone" required placeholder="05xxxxxxxx" />
                        </div>
                        <div className="form-field full">
                          <label>{t('f_email')}</label>
                          <input type="email" name="email" required />
                        </div>
                        <div className="form-field full">
                          <label>{t('f_msg')}</label>
                          <textarea name="message" required></textarea>
                        </div>
                      </div>
                      <div className="form-actions">
                        <button type="submit" className="btn btn-gradient">{t('f_submit')}</button>
                        <a href={getWhatsappUrl('مرحباً فريق SpruVex، لدي استفسار.')} target="_blank" rel="noreferrer" className="btn btn-ghost">{t('f_wa_alt')}</a>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq">
          <div className="container">
            <div className="section-head center">
              <span className="eyebrow"><span className="dot"></span><span>{t('faq_eyebrow')}</span></span>
              <h2 className="section-title">{t('faq_title')}</h2>
            </div>
            <div className="faq-list">
              {[1,2,3,4,5,6].map((i) => (
                <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                  <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{t(`faq${i}_q`)}</span>
                    <span className="faq-plus">+</span>
                  </div>
                  <div className="faq-a">
                    <div className="faq-a-inner">{t(`faq${i}_a`)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <img src={fullLogo} alt="SpruVex" />
              <p>{t('footer_desc')}</p>
            </div>
            <div className="footer-col">
              <h5>{t('footer_h1')}</h5>
              <ul>
                <li><a href="#features">{t('nav_features')}</a></li>
                <li><a href="#integrations">{t('nav_integrations')}</a></li>
                <li><a href="#pricing">{t('nav_pricing')}</a></li>
                <li><a href="#trial">{t('nav_trial')}</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>{t('footer_h2')}</h5>
              <ul>
                <li><a href="#faq">{t('footer_faq')}</a></li>
                <li><a href="#">{t('footer_terms')}</a></li>
                <li><a href="#">{t('footer_privacy')}</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <h5>{t('footer_h3')}</h5>
              <ul>
                <li><a href={getWhatsappUrl('مرحباً، لدي استفسار عن SpruVex.')} target="_blank" rel="noreferrer">WhatsApp Business</a></li>
                <li><a href="mailto:hello@spruvex.com">hello@spruvex.com</a></li>
                <li><span>{t('footer_hours')}</span></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{t('footer_copy')}</span>
            <div className="footer-social">
              <a href="#" aria-label="X">𝕏</a>
              <a href="#" aria-label="Instagram">◎</a>
              <a href="#" aria-label="LinkedIn">in</a>
            </div>
          </div>
        </div>
      </footer>

      {/* WHATSAPP FLOAT */}
      <a href={getWhatsappUrl('مرحباً، أريد الاستفسار عن نظام SpruVex.')} className="wa-float" aria-label="WhatsApp" target="_blank" rel="noreferrer">
        <span className="wa-ring"></span>
        💬
      </a>

      {/* FLOATING OFFER BANNER */}
      {showOffer && config.offer.enabled && (
        <div className="floating-offer">
          <button className="floating-offer-close" onClick={handleCloseOffer}>✕</button>
          <div className="floating-offer-title">{lang === 'ar' ? config.offer.titleAr : config.offer.titleEn}</div>
          <div className="floating-offer-desc">{lang === 'ar' ? config.offer.descAr : config.offer.descEn}</div>
          <div className="floating-offer-code" onClick={(e) => {
            navigator.clipboard.writeText(config.offer.code);
            const target = e.target as HTMLElement;
            target.innerText = t('offer_copied');
            setTimeout(() => target.innerText = config.offer.code, 2000);
          }}>{config.offer.code}</div>
          <a href="#signup" className="btn" onClick={handleCloseOffer}>{t('offer_cta')}</a>
        </div>
      )}
    </>
  );
}
