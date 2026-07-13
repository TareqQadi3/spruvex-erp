import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@spruvex-r/ui";

export function AuthShell({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-secondary/60 to-background p-4">
      <div className="absolute top-4 end-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
        >
          {t("common.language")}
        </Button>
      </div>
      {children}
    </div>
  );
}
