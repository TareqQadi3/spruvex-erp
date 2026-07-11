import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Spinner,
} from "@spruvex-r/ui";

import { ApiError, post } from "../../lib/api";
import { useAuth, type SessionUser } from "../../lib/auth";
import { AuthShell } from "./AuthShell";

interface VerifyResponse {
  user: SessionUser;
  tokens: { accessToken: string; refreshToken: string };
}

/** Wizard step 1: owner account + OTP verification. */
export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { adoptSession } = useAuth();

  const [stage, setStage] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitRegistration(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await post<{ userId: string; devOtp?: string }>("/auth/register", {
        name,
        email,
        password,
        ...(phone ? { phone } : {}),
      });
      setDevOtp(res.devOtp);
      setStage("otp");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await post<VerifyResponse>("/auth/register/verify", { email, code });
      await adoptSession(res.tokens);
      navigate("/onboarding", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    const res = await post<{ devOtp?: string }>("/auth/register/resend-otp", { email }).catch(
      () => ({ devOtp: undefined }),
    );
    setDevOtp(res.devOtp);
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <img src="/logo-horizontal.png" alt="SpruVex R" className="mb-2 h-14 object-contain" />
          <CardTitle>{stage === "form" ? t("auth.registerTitle") : t("auth.otpTitle")}</CardTitle>
          <CardDescription>
            {stage === "form" ? t("auth.registerSubtitle") : t("auth.otpSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stage === "form" ? (
            <form onSubmit={submitRegistration} className="space-y-4">
              {error && <Alert variant="destructive">{error}</Alert>}
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("auth.phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  dir="ltr"
                  placeholder="+9665xxxxxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("auth.passwordRule")}</p>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Spinner className="border-primary-foreground" /> : t("auth.register")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("auth.haveAccount")}{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  {t("auth.login")}
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="space-y-4">
              {error && <Alert variant="destructive">{error}</Alert>}
              {devOtp && (
                <Alert>
                  {t("auth.otpDevHint")} <strong dir="ltr">{devOtp}</strong>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="code">{t("auth.otpCode")}</Label>
                <Input
                  id="code"
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={6}
                  className="text-center text-lg tracking-[0.5em]"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                {busy ? <Spinner className="border-primary-foreground" /> : t("auth.verify")}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={resend}>
                {t("auth.otpResend")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
