/* ============================================================
   SpruVex Site Config — read/write from localStorage
   Admin panel saves here; main site reads on every mount.
   ============================================================ */

export interface Lead {
  id: string;
  type: 'trial' | 'contact';
  timestamp: string;
  name: string;
  store?: string;
  phone: string;
  email: string;
  interest?: string;
  channels?: string;
  notes?: string;
  message?: string;
  status: 'new' | 'contacted' | 'converted' | 'closed';
}

export interface PricingRow {
  m1: number; m3: number; m6: number; y1: number; life: number;
}

export interface SiteConfig {
  whatsapp: string;
  offer: {
    enabled: boolean;
    titleAr: string; titleEn: string;
    descAr: string;  descEn: string;
    code: string;
    discount: number;
  };
  pricing: {
    basic: PricingRow;
    pro: PricingRow;
    enterprise: PricingRow;
  };
  lifetimeFees: { basic: number; pro: number; enterprise: number };
  planFeatures: {
    basic: string[];
    pro: string[];
    enterprise: string[];
  };
}

export const DEFAULT_CONFIG: SiteConfig = {
  whatsapp: '966565732642',
  offer: {
    enabled: true,
    titleAr: '🎉 عرض خاص!',           titleEn: '🎉 Special Offer!',
    descAr: 'خصم إضافي 5% على أول اشتراك', descEn: 'Get an extra 5% off your first subscription',
    code: 'NEW5', discount: 5,
  },
  pricing: {
    basic:      { m1: 149,  m3: 129, m6: 119, y1: 99,  life: 2490  },
    pro:        { m1: 349,  m3: 309, m6: 279, y1: 249, life: 5990  },
    enterprise: { m1: 699,  m3: 629, m6: 579, y1: 499, life: 11990 },
  },
  lifetimeFees: { basic: 199, pro: 349, enterprise: 599 },
  planFeatures: {
    basic: [
      'فرع واحد ومستخدمان',
      'نقاط بيع + محاسبة أساسية',
      'ربط متجر إلكتروني واحد',
      'فواتير واتساب يدوية',
      'دعم عبر البريد والواتساب',
    ],
    pro: [
      'حتى 5 فروع و10 مستخدمين',
      'ERP كامل + صيانة وخدمة عملاء',
      'ربط متاجر متعددة (سلة، زد، Shopify)',
      'دفع بالتقسيط: تابي وتمارا',
      'فواتير واتساب تلقائية',
      'لوحات تحليلات متقدمة',
    ],
    enterprise: [
      'فروع ومستخدمون غير محدودين',
      'كل مزايا المتقدمة، بدون حدود',
      'تكاملات مخصّصة عبر API',
      'مدير حساب مخصص',
      'أولوية الدعم الفني 24/7',
    ],
  },
};

const CONFIG_KEY = 'spruvex_config';
const LEADS_KEY  = 'spruvex_leads';
const AUTH_KEY   = 'spruvex_admin_auth';

export const ADMIN_PASSWORD = 'SpruVex@2026';

/* ---- Config helpers ---- */
export function getConfig(): SiteConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return DEFAULT_CONFIG;
    const p = JSON.parse(stored);
    return {
      ...DEFAULT_CONFIG, ...p,
      offer:        { ...DEFAULT_CONFIG.offer,        ...p.offer },
      pricing: {
        basic:      { ...DEFAULT_CONFIG.pricing.basic,      ...p.pricing?.basic },
        pro:        { ...DEFAULT_CONFIG.pricing.pro,        ...p.pricing?.pro },
        enterprise: { ...DEFAULT_CONFIG.pricing.enterprise, ...p.pricing?.enterprise },
      },
      lifetimeFees: { ...DEFAULT_CONFIG.lifetimeFees, ...p.lifetimeFees },
      planFeatures: {
        basic:      p.planFeatures?.basic      ?? DEFAULT_CONFIG.planFeatures.basic,
        pro:        p.planFeatures?.pro        ?? DEFAULT_CONFIG.planFeatures.pro,
        enterprise: p.planFeatures?.enterprise ?? DEFAULT_CONFIG.planFeatures.enterprise,
      },
    };
  } catch { return DEFAULT_CONFIG; }
}

export function saveConfig(config: SiteConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

/* ---- Admin auth ---- */
export function isAdminAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) === '1';
}
export function setAdminAuthenticated(v: boolean): void {
  if (v) localStorage.setItem(AUTH_KEY, '1');
  else    localStorage.removeItem(AUTH_KEY);
}

/* ---- Lead helpers ---- */
export function getLeads(): Lead[] {
  try { return JSON.parse(localStorage.getItem(LEADS_KEY) || '[]'); }
  catch { return []; }
}

export function saveLead(lead: Omit<Lead, 'id' | 'timestamp' | 'status'>): void {
  const leads = getLeads();
  leads.unshift({ ...lead, id: Date.now().toString(), timestamp: new Date().toISOString(), status: 'new' });
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

export function updateLeadStatus(id: string, status: Lead['status']): void {
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === id);
  if (idx !== -1) { leads[idx].status = status; localStorage.setItem(LEADS_KEY, JSON.stringify(leads)); }
}

export function deleteLead(id: string): void {
  localStorage.setItem(LEADS_KEY, JSON.stringify(getLeads().filter(l => l.id !== id)));
}
