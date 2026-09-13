import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, AlertCircle, Globe, XCircle } from "lucide-react";
import { useTranslation } from "@/i18n";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";

interface InviteInfo {
  companyName: string;
  email: string;
  role: string;
}

export default function AcceptInvitePage({ token }: { token: string }) {
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { t, lang, setLang } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { setSession } = useAuth();

  useEffect(() => {
    fetch(`/api/auth/invites/${token}/info`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error?.message ?? "Invalid invite");
        setInfo(body.data);
      })
      .catch(() => setInfo(null))
      .finally(() => setIsValidating(false));
  }, [token]);

  const accept = async () => {
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(`/api/auth/invites/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? t("acceptInvite.accept_failed"));
      const { user, tokens } = body.data;
      const sessionUser: AuthUser = { id: user.id, username: user.username, role: user.role };
      setSession(tokens.accessToken, sessionUser);
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? t("acceptInvite.accept_failed"));
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
        {lang === "ar" ? t("common.language_en") : t("common.language_ar")}
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
          {isValidating ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("acceptInvite.loading")}
            </CardContent>
          ) : !info ? (
            <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <div className="text-base font-semibold">{t("acceptInvite.invalid_title")}</div>
              <p className="text-sm text-muted-foreground">{t("acceptInvite.invalid_desc")}</p>
              <Button variant="outline" className="mt-2" onClick={() => navigate("/login")}>
                {t("acceptInvite.back_to_login")}
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{t("acceptInvite.title")}</CardTitle>
                <CardDescription>
                  {t("acceptInvite.desc_with_company", { name: info.companyName, role: t(`roles.${info.role}`) })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input id="email" dir="ltr" value={info.email} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">{t("acceptInvite.username")}</Label>
                  <Input
                    id="username"
                    dir="ltr"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("acceptInvite.password")}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pe-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  className="w-full h-11"
                  onClick={accept}
                  disabled={isLoading || username.trim().length < 3 || password.length < 8}
                >
                  {isLoading ? t("acceptInvite.accepting") : t("acceptInvite.accept_button")}
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
