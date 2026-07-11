import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spruvex-r/ui";

import { api } from "../../lib/api";

interface TenantInfo {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
  logoUrl?: string;
  type?: string;
  country: string;
  currency: string;
  defaultLocale: string;
  vatNumber?: string;
  crNumber?: string;
  vatRate: string;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api<TenantInfo>("/tenant"),
  });

  const rows: Array<[string, string | undefined]> = data
    ? [
        [t("onboarding.restaurantName"), data.name],
        [t("onboarding.restaurantNameEn"), data.nameEn],
        [t("onboarding.type"), data.type ? t(`onboarding.types.${data.type}`) : undefined],
        [t("onboarding.country"), data.country],
        [t("settings.currency"), data.currency],
        [t("settings.vatNumber"), data.vatNumber],
        [t("settings.crNumber"), data.crNumber],
        [t("settings.vatRate"), data.vatRate ? `${data.vatRate}%` : undefined],
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      {isLoading && <Spinner />}
      {data && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t("settings.restaurantInfo")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between py-3 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value ?? t("settings.notSet")}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
