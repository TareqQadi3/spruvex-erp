import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "@/i18n";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-10 pb-8 flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-foreground">{t("common.not_found")}</h1>
            <p className="text-sm text-muted-foreground">{t("common.not_found_desc")}</p>
          </div>
          <Link href="/">
            <Button><Home className="me-2 h-4 w-4" />{t("nav.dashboard")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
