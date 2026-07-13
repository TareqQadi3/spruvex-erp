import { api, post } from "./api";

export interface Plan {
  id: string;
  key: string;
  name: string;
  nameEn: string | null;
  maxBranches: number;
  maxUsers: number;
  maxOrdersPerMonth: number | null;
  priceMonthlyHalalas: number;
  priceYearlyHalalas: number | null;
  features: Record<string, boolean>;
}

export interface Subscription {
  status: "trialing" | "active" | "past_due" | "suspended" | "cancelled";
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  plan: {
    key: string;
    name: string;
    nameEn: string | null;
    maxBranches: number;
    maxUsers: number;
    maxOrdersPerMonth: number | null;
    priceMonthly: string;
    features: Record<string, boolean>;
  };
  usage: { branches: number; users: number; ordersThisMonth: number };
}

export const billingApi = {
  listPlans: () => api<Plan[]>("/billing/plans"),
  getSubscription: () => api<Subscription>("/billing/subscription"),
  changePlan: (planKey: string) => post<Subscription>("/billing/subscription/change-plan", { planKey }),
};
