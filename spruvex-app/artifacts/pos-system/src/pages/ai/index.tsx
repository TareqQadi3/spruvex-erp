import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { Sparkles, Lock, TrendingUp, TrendingDown, AlertTriangle, PackagePlus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { useModuleEnabled } from "@/hooks/useModuleEnabled";

const PROVIDERS = ["anthropic", "mock"] as const;
const PERIODS = ["daily", "weekly", "monthly"] as const;

async function aiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api/ai${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? body?.error ?? "Request failed");
  return body?.data;
}

interface QuotaStatus { used: number; limit: number; remaining: number; }
interface AiSettingsView { provider: string; model: string | null; isActive: boolean; hasApiKey: boolean; }
interface SummaryMetrics { revenue: number; netProfit: number; salesCount: number; }
interface BusinessAlert { type: string; severity: "info" | "warning" | "critical"; messageAr: string; messageEn: string; link: string; }
interface ReorderSuggestion { productId: string; productName: string; currentStock: number; lowStockThreshold: number; suggestedQuantity: number; }
interface BusinessSummaryResult {
  text: string;
  period: string;
  metrics: { current: SummaryMetrics; previous: SummaryMetrics };
  alerts: BusinessAlert[];
  reorderSuggestions: ReorderSuggestion[];
}

const SEVERITY_VARIANT: Record<string, "destructive" | "default" | "outline"> = {
  critical: "destructive",
  warning: "default",
  info: "outline",
};

export default function AiAssistantPage() {
  const { t, lang } = useTranslation();
  const { enabled: moduleEnabled, isLoading: moduleLoading } = useModuleEnabled("ai_features");

  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [period, setPeriod] = useState<string>("monthly");
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<BusinessSummaryResult | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [settings, setSettings] = useState<AiSettingsView | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProvider] = useState<string>("anthropic");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (!moduleEnabled) return;
    aiFetch("/quota").then(setQuota).catch(() => {});
    aiFetch("/settings").then((s: AiSettingsView) => {
      setSettings(s);
      setProvider(s.provider);
      setModel(s.model ?? "");
      setIsActive(s.isActive);
    }).catch(() => {});
  }, [moduleEnabled]);

  const generateSummary = async () => {
    setIsGenerating(true);
    setSummaryError(null);
    try {
      const result = await aiFetch("/business-assistant/summary", { method: "POST", body: JSON.stringify({ period, language: lang }) });
      setSummary(result);
      aiFetch("/quota").then(setQuota).catch(() => {});
    } catch (err: any) {
      setSummaryError(err.message ?? t("aiAssistant.generate_failed"));
    } finally {
      setIsGenerating(false);
    }
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const updated = await aiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify({ provider, model: model.trim() || null, apiKey: apiKey.trim() || undefined, isActive }),
      });
      setSettings(updated);
      setApiKey("");
      toast.success(t("aiAssistant.settings_saved"));
    } catch (err: any) {
      toast.error(err.message ?? t("common.error"));
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (!moduleLoading && !moduleEnabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("aiAssistant.title")}</h1>
        <Card>
          <CardContent className="py-12">
            <EmptyState icon={Lock} title={t("aiAssistant.upgrade_title")} description={t("aiAssistant.upgrade_desc")} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Sparkles className="h-5 w-5" />{t("aiAssistant.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("aiAssistant.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSettings(v => !v)}>
          <Settings2 className="me-1.5 h-4 w-4" />
          {t("aiAssistant.settings")}
        </Button>
      </div>

      {showSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("aiAssistant.settings_title")}</CardTitle>
            <CardDescription>{t("aiAssistant.settings_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("aiAssistant.provider")}</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger><SelectValue>{provider}</SelectValue></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("aiAssistant.model")} ({t("common.optional")})</Label>
                <Input value={model} onChange={e => setModel(e.target.value)} placeholder={t("aiAssistant.model_placeholder")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>
                {t("aiAssistant.api_key")} ({t("common.optional")})
                {settings?.hasApiKey && <Badge variant="outline" className="ms-2">{t("aiAssistant.configured")}</Badge>}
              </Label>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={t("aiAssistant.api_key_placeholder")} />
              <p className="text-xs text-muted-foreground">{t("aiAssistant.api_key_hint")}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{t("aiAssistant.is_active")}</div>
                <div className="text-xs text-muted-foreground">{t("aiAssistant.is_active_desc")}</div>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button onClick={saveSettings} disabled={isSavingSettings}>
              {isSavingSettings ? t("common.saving") : t("common.save")}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("aiAssistant.business_summary_title")}</CardTitle>
              <CardDescription>{t("aiAssistant.business_summary_desc")}</CardDescription>
            </div>
            {quota && (
              <Badge variant="outline">{t("aiAssistant.quota_remaining", { remaining: quota.remaining, limit: quota.limit })}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {PERIODS.map(p => (
              <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
                {t(`aiAssistant.period_${p}`)}
              </Button>
            ))}
            <Button size="sm" onClick={generateSummary} disabled={isGenerating} className="ms-auto">
              <Sparkles className="me-1.5 h-3.5 w-3.5" />
              {isGenerating ? t("aiAssistant.generating") : t("aiAssistant.generate")}
            </Button>
          </div>

          {isGenerating && <Skeleton className="h-32 w-full" />}
          {summaryError && <p className="text-sm text-destructive">{summaryError}</p>}

          {summary && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">{summary.text}</div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{t("reports.revenue")}</div>
                  <div className="text-lg font-bold">{summary.metrics.current.revenue.toFixed(2)}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{t("reports.net_profit")}</div>
                  <div className="text-lg font-bold">{summary.metrics.current.netProfit.toFixed(2)}</div>
                </div>
              </div>

              {summary.alerts.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">{t("aiAssistant.alerts")}</div>
                  {summary.alerts.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                      {a.severity === "critical" ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0" /> : a.severity === "warning" ? <TrendingDown className="h-4 w-4 text-amber-500 shrink-0" /> : <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <span className="flex-1">{lang === "ar" ? a.messageAr : a.messageEn}</span>
                      <Badge variant={SEVERITY_VARIANT[a.severity]}>{t(`aiAssistant.severity_${a.severity}`)}</Badge>
                    </div>
                  ))}
                </div>
              )}

              {summary.reorderSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-1.5"><PackagePlus className="h-4 w-4" />{t("aiAssistant.reorder_suggestions")}</div>
                  {summary.reorderSuggestions.map(s => (
                    <div key={s.productId} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                      <span>{s.productName}</span>
                      <span className="text-muted-foreground">{t("aiAssistant.reorder_qty", { current: s.currentStock, suggested: s.suggestedQuantity })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
