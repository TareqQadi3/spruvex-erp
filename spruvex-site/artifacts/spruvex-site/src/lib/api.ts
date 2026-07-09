export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';

export interface Plan {
  code: string;
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  priceMonthlySar: number | null;
  maxUsers: number;
  maxBranches: number;
  maxProducts: number;
  maxCustomers: number;
  maxInvoicesPerMonth: number;
  storageQuotaMb: number;
  modules: string[];
}

export interface Addon {
  code: string;
  type: 'module' | 'quantity' | string;
  grantsModule?: string;
  boostsLimit?: string;
}

export interface PlanCatalog {
  plans: Plan[];
  addons: Addon[];
}

export async function fetchPlanCatalog(): Promise<PlanCatalog> {
  const res = await fetch(`${API_URL}/api/public/plans`);
  if (!res.ok) throw new Error(`Failed to load plans (${res.status})`);
  const json = await res.json();
  return json.data as PlanCatalog;
}

export function signupUrl(plan?: string) {
  return plan ? `${APP_URL}/signup?plan=${encodeURIComponent(plan)}` : `${APP_URL}/signup`;
}
