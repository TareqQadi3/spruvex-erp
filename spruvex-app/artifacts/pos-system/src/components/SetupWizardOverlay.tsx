import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CheckCircle2, PartyPopper, Smartphone, Store, UtensilsCrossed, Coffee, Shirt, Wrench, MoreHorizontal } from "lucide-react";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

type BusinessType = "electronics" | "grocery" | "restaurant" | "cafe" | "clothing" | "repair" | "other";

const BUSINESS_TYPES: { value: BusinessType; icon: typeof Store }[] = [
  { value: "electronics", icon: Smartphone },
  { value: "grocery", icon: Store },
  { value: "restaurant", icon: UtensilsCrossed },
  { value: "cafe", icon: Coffee },
  { value: "clothing", icon: Shirt },
  { value: "repair", icon: Wrench },
  { value: "other", icon: MoreHorizontal },
];

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

type Step = "welcome" | "identity" | "businessType" | "catalog" | "done";

export function SetupWizardOverlay({
  initialBusinessType,
  onFinished,
}: {
  initialBusinessType: string | null;
  onFinished: () => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [nameEn, setNameEn] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType>((initialBusinessType as BusinessType) || "other");
  const [isSaving, setIsSaving] = useState(false);
  const [seededOk, setSeededOk] = useState<boolean | null>(null);
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const finish = async () => {
    setIsSaving(true);
    try {
      await authFetch("/settings", { method: "PUT", body: JSON.stringify({ setupCompleted: true }) });
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
    } finally {
      setIsSaving(false);
      onFinished();
    }
  };

  const saveIdentity = async () => {
    setIsSaving(true);
    try {
      await authFetch("/settings", {
        method: "PUT",
        body: JSON.stringify({
          companyNameEn: nameEn.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
        }),
      });
      setStep("businessType");
    } finally {
      setIsSaving(false);
    }
  };

  const saveBusinessType = async () => {
    setIsSaving(true);
    try {
      await authFetch("/settings", { method: "PUT", body: JSON.stringify({ businessType }) });
      setStep("catalog");
    } finally {
      setIsSaving(false);
    }
  };

  const seedCatalog = async (wantSeed: boolean) => {
    if (!wantSeed) {
      setStep("done");
      return;
    }
    setIsSaving(true);
    try {
      await authFetch("/onboarding/seed-catalog", { method: "POST" });
      setSeededOk(true);
    } catch {
      setSeededOk(false);
    } finally {
      setIsSaving(false);
      setStep("done");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-center gap-2">
          {(["welcome", "identity", "businessType", "catalog", "done"] as Step[]).map(s => (
            <div
              key={s}
              className={cn(
                "h-1.5 w-10 rounded-full transition-colors",
                s === step ||
                  ["welcome", "identity", "businessType", "catalog", "done"].indexOf(s) <
                    ["welcome", "identity", "businessType", "catalog", "done"].indexOf(step)
                  ? "bg-primary"
                  : "bg-muted",
              )}
            />
          ))}
        </div>

        <Card className="border-border/60 shadow-lg">
          {step === "welcome" && (
            <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center gap-4">
              <PartyPopper className="h-14 w-14 text-primary" />
              <h2 className="text-xl font-bold">{t("setupWizard.welcome_title")}</h2>
              <p className="text-muted-foreground text-sm">{t("setupWizard.welcome_desc")}</p>
              <div className="w-full flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11" onClick={finish} disabled={isSaving}>
                  {t("setupWizard.skip_all")}
                </Button>
                <Button className="flex-1 h-11" onClick={() => setStep("identity")}>
                  {t("setupWizard.start")}
                </Button>
              </div>
            </CardContent>
          )}

          {step === "identity" && (
            <>
              <CardHeader>
                <CardTitle>{t("setupWizard.identity_title")}</CardTitle>
                <CardDescription>{t("setupWizard.identity_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nameEn">{t("setupWizard.name_en")}</Label>
                  <Input id="nameEn" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="My Store" disabled={isSaving} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="logoUrl">{t("setupWizard.logo_url")}</Label>
                  <Input id="logoUrl" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." disabled={isSaving} />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 h-11" onClick={() => setStep("businessType")} disabled={isSaving}>
                    {t("setupWizard.skip")}
                  </Button>
                  <Button className="flex-1 h-11" onClick={saveIdentity} disabled={isSaving}>
                    {t("setupWizard.next")}
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {step === "businessType" && (
            <>
              <CardHeader>
                <CardTitle>{t("setupWizard.business_type_title")}</CardTitle>
                <CardDescription>{t("setupWizard.business_type_desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {BUSINESS_TYPES.map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBusinessType(value)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50",
                        businessType === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
                      )}
                    >
                      <Icon className={cn("h-6 w-6", businessType === value ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-medium">{t(`signup.business_type_${value}`)}</span>
                    </button>
                  ))}
                </div>
                <Button className="w-full h-11" onClick={saveBusinessType} disabled={isSaving}>
                  {t("setupWizard.next")}
                </Button>
              </CardContent>
            </>
          )}

          {step === "catalog" && (
            <CardContent className="pt-8 pb-8 px-8 flex flex-col items-center text-center gap-4">
              <h2 className="text-lg font-bold">{t("setupWizard.catalog_title")}</h2>
              <p className="text-muted-foreground text-sm">{t("setupWizard.catalog_desc")}</p>
              <div className="w-full flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 h-11" onClick={() => seedCatalog(false)} disabled={isSaving}>
                  {t("setupWizard.no_thanks")}
                </Button>
                <Button className="flex-1 h-11" onClick={() => seedCatalog(true)} disabled={isSaving}>
                  {isSaving ? t("setupWizard.setting_up") : t("setupWizard.yes_add")}
                </Button>
              </div>
            </CardContent>
          )}

          {step === "done" && (
            <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center gap-4">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <h2 className="text-xl font-bold">{t("setupWizard.done_title")}</h2>
              <p className="text-muted-foreground text-sm">
                {seededOk === false ? t("setupWizard.seed_failed") : t("setupWizard.done_desc")}
              </p>
              <Button className="w-full h-11" onClick={finish} disabled={isSaving}>
                {t("setupWizard.go_to_dashboard")}
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
