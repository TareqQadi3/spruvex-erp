import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useGetSubscriptionStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CreditCard, Users, GitBranch, Package, UserRound, FileText, HardDrive, Sparkles, LifeBuoy } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useModuleEnabled } from "@/hooks/useModuleEnabled";

interface PlanLimits {
  maxUsers: number;
  maxBranches: number;
  maxProducts: number;
  maxCustomers: number;
  maxInvoicesPerMonth: number;
  storageQuotaMb: number;
  maxAiRequestsPerMonth: number;
  modules: string[];
  nameAr: string;
  nameEn: string;
  taglineAr: string;
  taglineEn: string;
  priceMonthlySar: number | null;
}

interface PlanCatalogEntry extends PlanLimits { code: string; }
interface AddonCatalogEntry { code: string; type: "module" | "quantity"; grantsModule?: string; boostsLimit?: string; }

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  trial: "outline",
  active: "default",
  expired: "destructive",
  suspended: "destructive",
  cancelled: "secondary",
};

const MODULE_ADDON_CODES = ["ecommerce", "loyalty", "advanced_reports", "online_menu", "customer_ordering", "ai_features", "payment_gateways"];

function AddonRow({ addon, lang }: { addon: AddonCatalogEntry; lang: string }) {
  const { enabled, isLoading } = useModuleEnabled(addon.grantsModule ?? addon.code);
  return (
    <div className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
      <span className="font-mono text-xs text-muted-foreground">{addon.code}</span>
      {isLoading ? <Skeleton className="h-5 w-16" /> : (
        <Badge variant={enabled ? "default" : "outline"}>
          {enabled ? (lang === "ar" ? "مفعّلة" : "Active") : (lang === "ar" ? "غير مفعّلة" : "Not active")}
        </Badge>
      )}
    </div>
  );
}

export default function PlanSettingsPage() {
  const { t, lang } = useTranslation();
  const { data: status, isLoading: statusLoading } = useGetSubscriptionStatus();
  const [catalog, setCatalog] = useState<{ plans: PlanCatalogEntry[]; addons: AddonCatalogEntry[] } | null>(null);

  useEffect(() => {
    fetch("/api/public/plans").then(r => r.json()).then(body => setCatalog(body.data)).catch(() => {});
  }, []);

  const currentPlan = catalog?.plans.find(p => p.code === status?.plan);
  const isLoading = statusLoading || !catalog;

  const limitRows = currentPlan ? [
    { icon: Users, label: t("settings.plan_limit_users"), value: currentPlan.maxUsers },
    { icon: GitBranch, label: t("settings.plan_limit_branches"), value: currentPlan.maxBranches },
    { icon: Package, label: t("settings.plan_limit_products"), value: currentPlan.maxProducts },
    { icon: UserRound, label: t("settings.plan_limit_customers"), value: currentPlan.maxCustomers },
    { icon: FileText, label: t("settings.plan_limit_invoices"), value: currentPlan.maxInvoicesPerMonth },
    { icon: HardDrive, label: t("settings.plan_limit_storage"), value: `${currentPlan.storageQuotaMb} MB` },
    { icon: Sparkles, label: t("settings.plan_limit_ai"), value: currentPlan.maxAiRequestsPerMonth },
  ] : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.plan_title")}</h1>
      </div>

      {isLoading ? (
        <Card><CardContent className="pt-6 space-y-3"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">{lang === "ar" ? currentPlan?.nameAr : currentPlan?.nameEn}</CardTitle>
                    <CardDescription>{lang === "ar" ? currentPlan?.taglineAr : currentPlan?.taglineEn}</CardDescription>
                  </div>
                </div>
                {status && <Badge variant={STATUS_VARIANT[status.status] ?? "outline"}>{t(`settings.plan_status_${status.status}`)}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentPlan?.priceMonthlySar != null && (
                <div className="text-2xl font-bold">
                  {currentPlan.priceMonthlySar} <span className="text-sm font-normal text-muted-foreground">{t("settings.plan_per_month")}</span>
                </div>
              )}
              {status?.status === "trial" && status.trialEndsAt && (
                <p className="text-sm text-muted-foreground">
                  {t("settings.plan_trial_ends", { date: new Date(status.trialEndsAt).toLocaleDateString() })}
                </p>
              )}
              {status?.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  {t("settings.plan_period_ends", { date: new Date(status.currentPeriodEnd).toLocaleDateString() })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("settings.plan_limits_title")}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {limitRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border p-3">
                  <row.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{row.label}</div>
                    <div className="text-sm font-semibold">{row.value}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {currentPlan && currentPlan.modules.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("settings.plan_modules_title")}</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {currentPlan.modules.map(m => <Badge key={m} variant="secondary">{m}</Badge>)}
              </CardContent>
            </Card>
          )}

          {catalog && (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("settings.plan_addons_title")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {catalog.addons
                  .filter(a => MODULE_ADDON_CODES.includes(a.code))
                  .map(addon => <AddonRow key={addon.code} addon={addon} lang={lang} />)}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{t("settings.plan_upgrade_hint")}</p>
              <Link href="/support">
                <Button variant="outline" size="sm">
                  <LifeBuoy className="me-1.5 h-4 w-4" />
                  {t("settings.plan_contact_support")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
