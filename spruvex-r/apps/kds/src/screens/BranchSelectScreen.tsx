import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@spruvex-r/ui";

import { api } from "../lib/api";

interface BranchRow {
  id: string;
  name: string;
  nameEn: string | null;
}

export function BranchSelectScreen({ onSelect }: { onSelect: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const [branches, setBranches] = useState<BranchRow[] | null>(null);

  useEffect(() => {
    void api<BranchRow[]>("/my-branches").then(setBranches);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("branch.select")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!branches && <Spinner />}
          {branches?.map((branch) => (
            <Button
              key={branch.id}
              variant="secondary"
              size="lg"
              className="w-full justify-start text-lg"
              onClick={() => onSelect(branch.id)}
            >
              {i18n.language === "en" && branch.nameEn ? branch.nameEn : branch.name}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
