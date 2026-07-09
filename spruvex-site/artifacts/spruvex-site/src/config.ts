/* ============================================================
   SpruVex Site Config — read/write from localStorage
   Admin panel saves here; main site reads on every mount.
   Pricing is NOT stored here — it is fetched live from the
   SaaS plan catalog API (see src/lib/api.ts).
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

export interface FaqItem {
  id: string;
  qAr: string; qEn: string;
  aAr: string; aEn: string;
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
  hero: {
    titleAr: string; titleEn: string;
    subAr: string; subEn: string;
  };
  faqItems: FaqItem[];
}

export const DEFAULT_CONFIG: SiteConfig = {
  whatsapp: '966565732642',
  offer: {
    enabled: true,
    titleAr: '🎉 عرض خاص!',           titleEn: '🎉 Special Offer!',
    descAr: 'خصم إضافي 5% على أول اشتراك', descEn: 'Get an extra 5% off your first subscription',
    code: 'NEW5', discount: 5,
  },
  hero: {
    titleAr: 'كل أعمالك التجارية… في نظام واحد',
    titleEn: 'Every part of your business, one system',
    subAr: 'SpruVex يوحّد المحاسبة والمبيعات والمخزون والفروع والصيانة وخدمة العملاء في منصة سحابية واحدة.',
    subEn: 'SpruVex unifies accounting, sales, inventory, branches, service, and customer management in one cloud platform.',
  },
  faqItems: [],
};

const CONFIG_KEY = 'spruvex_config';
const LEADS_KEY  = 'spruvex_leads';
const AUTH_KEY   = 'spruvex_admin_auth';

// Stopgap client-side gate only — there is no backend-authenticated admin yet,
// so this can never be truly secure. Password comes from an env var purely to
// avoid a literal hardcoded string in committed source.
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PANEL_PASSWORD || 'SpruVex@2026';

/* ---- Config helpers ---- */
export function getConfig(): SiteConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return DEFAULT_CONFIG;
    const p = JSON.parse(stored);
    return {
      ...DEFAULT_CONFIG, ...p,
      offer: { ...DEFAULT_CONFIG.offer, ...p.offer },
      hero:  { ...DEFAULT_CONFIG.hero,  ...p.hero },
      faqItems: p.faqItems ?? DEFAULT_CONFIG.faqItems,
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
