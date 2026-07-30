import { useState } from "react";
import { useTheme } from "next-themes";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Globe } from "lucide-react";
import { useTranslation } from "@/i18n";
import { BrandLogo } from "@/components/BrandLogo";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { t, lang, setLang } = useTranslation();
  const { resolvedTheme } = useTheme();

  const requestOtp = async () => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) throw new Error(t("auth.otp_send_failed"));
      setStep(2);
    } catch (err: any) {
      setError(err.message ?? t("auth.otp_send_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp, newPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? t("auth.reset_failed"));
      setStep(3);
    } catch (err: any) {
      setError(err.message ?? t("auth.reset_failed"));
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
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <BrandLogo
            variant="horizontal"
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            className="h-10 w-auto mx-auto"
          />
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {step === 1 && t("auth.forgot_password_title")}
              {step === 2 && t("auth.reset_password_title")}
              {step === 3 && t("auth.reset_success_title")}
            </CardTitle>
            <CardDescription>
              {step === 1 && t("auth.forgot_password_desc")}
              {step === 2 && t("auth.reset_password_desc")}
              {step === 3 && t("auth.reset_success_desc")}
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
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={isLoading}
                  />
                </div>
                <Button className="w-full h-11" onClick={requestOtp} disabled={isLoading || !email.trim()}>
                  {isLoading ? t("auth.otp_sending") : t("auth.send_code")}
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="otp">{t("auth.otp_label")}</Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="------"
                    className="text-center text-2xl tracking-[0.5em]"
                    inputMode="numeric"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">{t("auth.new_password")}</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
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
                </div>
                <Button
                  className="w-full h-11"
                  onClick={resetPassword}
                  disabled={isLoading || !/^\d{6}$/.test(otp) || newPassword.length < 8}
                >
                  {isLoading ? t("auth.resetting") : t("auth.reset_password_button")}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={requestOtp} disabled={isLoading}>
                  {t("auth.resend_code")}
                </Button>
              </>
            )}

            {step === 3 && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <Button className="w-full h-11" onClick={() => navigate("/login")}>
                  {t("auth.back_to_login")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
