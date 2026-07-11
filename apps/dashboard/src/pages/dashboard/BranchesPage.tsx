import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spruvex-r/ui";

import { api } from "../../lib/api";

interface Branch {
  id: string;
  name: string;
  nameEn?: string;
  address?: string;
  phone?: string;
  isActive: boolean;
}

export function BranchesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api<Branch[]>("/branches"),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("branches.title")}</h1>
      {isLoading && <Spinner />}
      {data?.length === 0 && <p className="text-muted-foreground">{t("branches.empty")}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.map((branch) => (
          <Card key={branch.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{branch.name}</CardTitle>
              <span
                className={
                  branch.isActive
                    ? "rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                }
              >
                {branch.isActive ? t("branches.active") : t("branches.inactive")}
              </span>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {branch.address && (
                <p>
                  {t("branches.address")}: {branch.address}
                </p>
              )}
              {branch.phone && (
                <p dir="ltr" className="text-start">
                  {branch.phone}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
