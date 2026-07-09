import { useState } from "react";
import { useTheme } from "next-themes";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Globe,
  Store,
  Smartphone,
  Wrench,
  UtensilsCrossed,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type BusinessType = "retail" | "electronics" | "repair" | "restaurant" | "ecommerce";
type CompanyPlan = "erp_business" | "restaurant" | "sales_repair" | "enterprise";

const BUSINESS_TYPES: { value: BusinessType; icon: typeof Store }[] = [
  { value: "retail", icon: Store },
  { value: "electronics", icon: Smartphone },
  { value: "repair", icon: Wrench },
  { value: "restaurant", icon: UtensilsCrossed },
  { value: "ecommerce", icon: ShoppingCart },
];

const PLANS: { value: CompanyPlan }[] = [
  { value: "erp_business" },
  { value: "restaurant" },
  { value: "sales_repair" },
  { value: "enterprise" },
];

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [plan, setPlan] = useState<CompanyPlan | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { setSession } = useAuth();
  const [, navigate] = useLocation();
  const { t, lang, setLang } = useTranslation();
  const { resolvedTheme } = useTheme();

  const step1Valid = companyName.trim().length > 0 && adminUsername.trim().length >= 3 && adminPassword.length >= 8;

  const handleNext = () => {
    setError("");
    if (step === 1 && !step1Valid) {
      setError(t("signup.step1_incomplete"));
      return;
    }
    if (step === 2 && !businessType) {
      setError(t("signup.select_business_type"));
      return;
    }
    setStep(s => Math.min(3, s + 1));
  };

  const handleBack = () => {
    setError("");
    setStep(s => Math.max(1, s - 1));
  };

  const handleSubmit = async () => {
    if (!plan) {
      setError(t("signup.select_plan"));
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/register-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          adminUsername: adminUsername.trim(),
          adminEmail: adminEmail.trim() || undefined,
          adminPassword,
          businessType,
          plan,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? t("signup.signup_failed"));
      }
      const { user, tokens } = body.data;
      const sessionUser: AuthUser = { id: user.id, username: user.username, role: user.role };
      setSession(tokens.accessToken, sessionUser);
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? t("signup.signup_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <button
        type="button"
        onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        className="absolute top-4 end-4 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Globe className="h-4 w-4" />
        {lang === "ar" ? "English" : "العربية"}
      </button>
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-3">
          <BrandLogo
            variant="horizontal"
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            className="h-10 w-auto mx-auto"
          />
          <p className="text-sm text-muted-foreground">{t("signup.subtitle")}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={cn(
                "h-1.5 w-12 rounded-full transition-colors",
                n <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {step === 1 && t("signup.step1_title")}
              {step === 2 && t("signup.step2_title")}
              {step === 3 && t("signup.step3_title")}
            </CardTitle>
            <CardDescription>
              {step === 1 && t("signup.step1_desc")}
              {step === 2 && t("signup.step2_desc")}
              {step === 3 && t("signup.step3_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">{t("signup.company_name")}</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder={t("signup.company_name_placeholder")}
                    autoFocus
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adminUsername">{t("signup.admin_username")}</Label>
                  <Input
                    id="adminUsername"
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    placeholder={t("signup.admin_username_placeholder")}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adminEmail">{t("signup.admin_email")}</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder={t("signup.admin_email_placeholder")}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="adminPassword">{t("signup.admin_password")}</Label>
                  <div className="relative">
                    <Input
                      id="adminPassword"
                      type={showPassword ? "text" : "password"}
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pe-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("signup.password_hint")}</p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    <span className="text-sm font-medium">{t(`signup.business_type_${value}`)}</span>
                  </button>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLANS.map(({ value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPlan(value)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-4 text-start transition-colors hover:bg-muted/50",
                      plan === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border",
                    )}
                  >
                    <span className="text-sm font-semibold">{t(`signup.plan_${value}`)}</span>
                    <span className="text-xs text-muted-foreground">{t(`signup.plan_${value}_desc`)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              {step > 1 && (
                <Button type="button" variant="outline" className="flex-1 h-11" onClick={handleBack} disabled={isLoading}>
                  <ChevronLeft className="h-4 w-4 me-1 rtl:rotate-180" />
                  {t("signup.back")}
                </Button>
              )}
              {step < 3 && (
                <Button type="button" className="flex-1 h-11" onClick={handleNext} disabled={isLoading}>
                  {t("signup.next")}
                  <ChevronRight className="h-4 w-4 ms-1 rtl:rotate-180" />
                </Button>
              )}
              {step === 3 && (
                <Button type="button" className="flex-1 h-11" onClick={handleSubmit} disabled={isLoading || !plan}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      {t("signup.creating_account")}
                    </span>
                  ) : t("signup.create_account")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          {t("signup.have_account")}{" "}
          <a href="/login" className="text-primary hover:underline font-medium">
            {t("signup.sign_in_link")}
          </a>
        </p>
      </div>
    </div>
  );
}
