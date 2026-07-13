import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

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

import { api, ApiError } from "../../lib/api";

interface TenantInfo {
  id: string;
  name: string;
  nameEn?: string;
  slug: string;
  logoUrl?: string;
  legalName?: string;
  type?: string;
  country: string;
  currency: string;
  defaultLocale: string;
  vatNumber?: string;
  crNumber?: string;
  address?: string;
  vatRate: string;
  publicBaseUrl: string;
}

interface ZatcaForm {
  legalName: string;
  vatNumber: string;
  crNumber: string;
  address: string;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => api<TenantInfo>("/tenant"),
  });

  const [form, setForm] = useState<ZatcaForm>({
    legalName: "",
    vatNumber: "",
    crNumber: "",
    address: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        legalName: data.legalName ?? "",
        vatNumber: data.vatNumber ?? "",
        crNumber: data.crNumber ?? "",
        address: data.address ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api("/tenant", {
        method: "PATCH",
        body: JSON.stringify({
          ...(form.legalName ? { legalName: form.legalName } : {}),
          ...(form.vatNumber ? { vatNumber: form.vatNumber } : {}),
          ...(form.crNumber ? { crNumber: form.crNumber } : {}),
          ...(form.address ? { address: form.address } : {}),
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tenant"] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("common.error")),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const rows: Array<[string, string | undefined]> = data
    ? [
        [t("onboarding.restaurantName"), data.name],
        [t("onboarding.restaurantNameEn"), data.nameEn],
        [t("onboarding.type"), data.type ? t(`onboarding.types.${data.type}`) : undefined],
        [t("onboarding.country"), data.country],
        [t("settings.currency"), data.currency],
        [t("settings.vatRate"), data.vatRate ? `${data.vatRate}%` : undefined],
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      {isLoading && <Spinner />}
      {data && (
        <div className="grid max-w-3xl grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.zatca")}</CardTitle>
              <CardDescription>{t("settings.zatcaHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                {error && <Alert variant="destructive">{error}</Alert>}
                {saved && <Alert>{t("settings.saved")}</Alert>}
                <div className="space-y-2">
                  <Label htmlFor="legalName">{t("settings.legalName")}</Label>
                  <Input
                    id="legalName"
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">{t("settings.vatNumber")}</Label>
                  <Input
                    id="vatNumber"
                    dir="ltr"
                    maxLength={15}
                    value={form.vatNumber}
                    onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crNumber">{t("settings.crNumber")}</Label>
                  <Input
                    id="crNumber"
                    dir="ltr"
                    value={form.crNumber}
                    onChange={(e) => setForm({ ...form, crNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{t("settings.address")}</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? <Spinner className="border-primary-foreground" /> : t("common.save")}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("settings.publicLinks")}</CardTitle>
              <CardDescription>{t("settings.publicLinksHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="rounded-md bg-muted p-3 text-sm" dir="ltr">
                {data.publicBaseUrl}/restaurant/{data.slug}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("settings.qrLinksHint")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
