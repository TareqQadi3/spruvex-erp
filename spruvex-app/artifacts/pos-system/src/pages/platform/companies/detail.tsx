import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryErrorState } from "@/components/QueryErrorState";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useTranslation } from "@/i18n";
import { platformFetch } from "../platformFetch";

interface CompanySummary {
  id: string;
  name: string;
  plan: string;
  businessType: string | null;
  status: "active" | "suspended";
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  activeAddonCodes: string[];
}

const PLAN_CODES = ["erp_business", "restaurant", "sales_repair", "enterprise"];
const ADDON_CODES = ["ecommerce", "loyalty", "advanced_reports", "online_menu", "customer_ordering", "ai_features", "payment_gateways", "additional_users", "additional_branches"];
const QUANTITY_ADDONS = new Set(["additional_users", "additional_branches"]);

export default function PlatformCompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const companyId = params.id as string;
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: company, isLoading, isError, refetch } = useQuery<CompanySummary>({
    queryKey: ["platform-company", companyId],
    queryFn: () => platformFetch(`/companies/${companyId}`),
  });

  const [renewDays, setRenewDays] = useState("30");
  const [resetUserId, setResetUserId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [addonQuantities, setAddonQuantities] = useState<Record<string, string>>({});

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["platform-company", companyId] });
    queryClient.invalidateQueries({ queryKey: ["platform-companies"] });
  };

  const changePlanMutation = useMutation({
    mutationFn: (plan: string) => platformFetch(`/companies/${companyId}/plan`, { method: "PATCH", body: JSON.stringify({ plan }) }),
    onSuccess: () => { invalidate(); toast.success(t("platform.plan_changed")); },
    onError: (err: Error) => toast.error(err.message),
  });

  const changeStatusMutation = useMutation({
    mutationFn: (status: "active" | "suspended") => platformFetch(`/companies/${companyId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { invalidate(); toast.success(t("platform.status_changed")); },
    onError: (err: Error) => toast.error(err.message),
  });

  const renewMutation = useMutation({
    mutationFn: () => platformFetch(`/companies/${companyId}/subscription/renew`, { method: "PATCH", body: JSON.stringify({ periodDays: Number(renewDays) || 30 }) }),
    onSuccess: () => { invalidate(); toast.success(t("platform.renewed")); },
    onError: (err: Error) => toast.error(err.message),
  });

  const addonMutation = useMutation({
    mutationFn: (vars: { code: string; isActive: boolean; quantity?: number }) =>
      platformFetch(`/companies/${companyId}/addons/${vars.code}`, { method: "PUT", body: JSON.stringify({ isActive: vars.isActive, quantity: vars.quantity }) }),
    onSuccess: () => { invalidate(); toast.success(t("platform.addon_updated")); },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () => platformFetch(`/users/${resetUserId}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword: resetPassword }) }),
    onSuccess: () => { setResetPassword(""); toast.success(t("platform.password_reset")); },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !company) return <QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/platform/companies">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{company.name}</h1>
          <p className="text-xs text-muted-foreground font-mono">{company.id}</p>
        </div>
        <Badge variant={company.status === "active" ? "default" : "destructive"}>{t(`platform.company_status_${company.status}`)}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("platform.plan_section")}</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <Select value={company.plan} onValueChange={(v) => changePlanMutation.mutate(v)}>
            <SelectTrigger className="w-56"><SelectValue>{company.plan}</SelectValue></SelectTrigger>
            <SelectContent>
              {PLAN_CODES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {company.subscriptionStatus} · {company.currentPeriodEnd ? new Date(company.currentPeriodEnd).toLocaleDateString() : "—"}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("platform.status_section")}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t("platform.status_section_desc")}</p>
          <Switch
            checked={company.status === "active"}
            onCheckedChange={(checked) => changeStatusMutation.mutate(checked ? "active" : "suspended")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("platform.renew_section")}</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-2">
          <Input type="number" className="w-28" value={renewDays} onChange={e => setRenewDays(e.target.value)} />
          <span className="text-sm text-muted-foreground">{t("platform.days")}</span>
          <Button size="sm" onClick={() => renewMutation.mutate()} disabled={renewMutation.isPending}>{t("platform.renew_button")}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("platform.addons_section")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ADDON_CODES.map(code => {
            const active = company.activeAddonCodes.includes(code);
            const isQuantity = QUANTITY_ADDONS.has(code);
            return (
              <div key={code} className="flex items-center justify-between rounded-lg border p-2.5">
                <span className="font-mono text-sm">{code}</span>
                <div className="flex items-center gap-2">
                  {isQuantity && active && (
                    <Input
                      type="number" className="w-20 h-8"
                      placeholder={t("platform.quantity")}
                      value={addonQuantities[code] ?? ""}
                      onChange={e => setAddonQuantities(prev => ({ ...prev, [code]: e.target.value }))}
                    />
                  )}
                  <Switch
                    checked={active}
                    onCheckedChange={(checked) => addonMutation.mutate({
                      code, isActive: checked,
                      quantity: isQuantity ? Number(addonQuantities[code] ?? 0) : undefined,
                    })}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" />{t("platform.reset_password_section")}</CardTitle>
          <CardDescription>{t("platform.reset_password_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={t("platform.user_id_placeholder")} value={resetUserId} onChange={e => setResetUserId(e.target.value)} />
            <Input type="password" placeholder={t("platform.new_password_placeholder")} value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
          </div>
          <Button
            size="sm" variant="outline"
            disabled={resetPasswordMutation.isPending || !resetUserId.trim() || resetPassword.length < 8}
            onClick={() => resetPasswordMutation.mutate()}
          >
            {t("platform.reset_password_button")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
