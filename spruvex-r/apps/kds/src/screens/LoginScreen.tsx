import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Spinner } from "@spruvex-r/ui";

import { ApiError, post, setAccessToken, setRefreshToken } from "../lib/api";

interface LoginResponse {
  tokens: { accessToken: string; refreshToken: string };
}

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await post<LoginResponse>("/auth/login", { email, password });
      setAccessToken(res.tokens.accessToken);
      setRefreshToken(res.tokens.refreshToken);
      onSuccess();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("auth.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Button
        variant="ghost"
        className="absolute top-4 end-4"
        onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
      >
        {t("common.language")}
      </Button>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center">
          <img src="/logo-horizontal.png" alt="SpruVex R" className="h-12 object-contain" />
          <CardTitle>{t("app.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Spinner className="border-primary-foreground" /> : t("auth.login")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
