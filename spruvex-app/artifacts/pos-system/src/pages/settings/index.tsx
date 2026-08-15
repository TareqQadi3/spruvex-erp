import { useEffect } from "react";
import { Link } from "wouter";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Save, Store, Receipt, Bell, Globe, Image, Printer, Shield, FileSpreadsheet, Plug } from "lucide-react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "@/i18n";
import type { Lang } from "@/i18n";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useState } from "react";
import { MediaUploadField } from "@/components/MediaUploadField";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, isError, refetch } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { t, setLang } = useTranslation();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { register, handleSubmit, reset, control, setValue, watch } = useForm<any>({
    defaultValues: {
      shopName: "", shopAddress: "", shopPhone: "",
      currency: "SAR", taxRate: 15, lowStockThreshold: 5,
      receiptFooter: "", language: "en",
      logoUrl: "", invoiceHeaderText: "", invoiceFooterText: "",
      showBarcode: false, invoiceType: "a4", repairsModuleEnabled: true,
      vatNumber: "", repairInvoiceType: "a4", repairInvoiceSameAsSales: true,
      posTemplate: "list",
    }
  });

  useEffect(() => {
    if (settings) {
      reset({
        shopName: settings.shopName ?? "",
        shopAddress: settings.shopAddress ?? "",
        shopPhone: settings.shopPhone ?? "",
        currency: settings.currency ?? "SAR",
        taxRate: settings.taxRate ?? 15,
        lowStockThreshold: settings.lowStockThreshold ?? 5,
        expiryAlertDays: (settings as any).expiryAlertDays ?? 7,
        receiptFooter: settings.receiptFooter ?? "",
        language: settings.language ?? "en",
        logoUrl: settings.logoUrl ?? "",
        invoiceHeaderText: settings.invoiceHeaderText ?? "",
        invoiceFooterText: settings.invoiceFooterText ?? "",
        showBarcode: settings.showBarcode ?? false,
        invoiceType: settings.invoiceType ?? "a4",
        repairsModuleEnabled: settings.repairsModuleEnabled ?? true,
        vatNumber: (settings as any).vatNumber ?? "",
        repairInvoiceType: (settings as any).repairInvoiceType ?? "a4",
        repairInvoiceSameAsSales: (settings as any).repairInvoiceSameAsSales ?? true,
        posTemplate: settings.posTemplate ?? "list",
      });
      if (settings.logoUrl) setLogoPreview(settings.logoUrl);
    }
  }, [settings, reset]);

  const onSubmit = (data: any) => {
    updateSettings.mutate({
      data: {
        shopName: data.shopName,
        shopAddress: data.shopAddress || null,
        shopPhone: data.shopPhone || null,
        currency: data.currency,
        taxRate: Number(data.taxRate),
        lowStockThreshold: Number(data.lowStockThreshold),
        expiryAlertDays: Number(data.expiryAlertDays),
        receiptFooter: data.receiptFooter || null,
        language: data.language,
        logoUrl: data.logoUrl || null,
        invoiceHeaderText: data.invoiceHeaderText || null,
        invoiceFooterText: data.invoiceFooterText || null,
        showBarcode: data.showBarcode,
        invoiceType: data.invoiceType,
        repairsModuleEnabled: data.repairsModuleEnabled,
        vatNumber: data.vatNumber || null,
        repairInvoiceType: data.repairInvoiceType,
        repairInvoiceSameAsSales: data.repairInvoiceSameAsSales,
        posTemplate: data.posTemplate,
      }
    }, {
      onSuccess: () => {
        toast.success(t("settings.save_success"));
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        setLang(data.language as Lang);
      },
      onError: () => toast.error(t("settings.save_failed")),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <Card><CardContent><QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("settings.title")}</h1>
        <p className="text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Store Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.store_info")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.store_info_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("settings.shop_name")}</Label>
              <Input {...register("shopName")} placeholder={t("settings.shop_name_placeholder")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("common.address")}</Label>
                <Input {...register("shopAddress")} placeholder={t("settings.address_placeholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.phone")}</Label>
                <Input {...register("shopPhone")} placeholder={t("settings.phone_placeholder")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* POS Screen */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.pos_screen")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.pos_screen_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>{t("settings.pos_template")}</Label>
              <Controller
                name="posTemplate"
                control={control}
                render={({ field }) => {
                  const posTemplateLabels: Record<string, string> = {
                    list: t("settings.pos_template_list"),
                    grid: t("settings.pos_template_grid"),
                    image: t("settings.pos_template_image"),
                    mobile: t("settings.pos_template_mobile"),
                  };
                  return (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue>{posTemplateLabels[field.value] ?? field.value}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="list">{posTemplateLabels.list}</SelectItem>
                        <SelectItem value="grid">{posTemplateLabels.grid}</SelectItem>
                        <SelectItem value="image">{posTemplateLabels.image}</SelectItem>
                        <SelectItem value="mobile">{posTemplateLabels.mobile}</SelectItem>
                      </SelectContent>
                    </Select>
                  );
                }}
              />
              <p className="text-xs text-muted-foreground">{t("settings.pos_template_hint")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Branding */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Image className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.invoice_branding")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.invoice_branding_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Logo upload */}
            <div className="space-y-2">
              <Label>{t("settings.company_logo")}</Label>
              <MediaUploadField
                value={logoPreview}
                onChange={(url) => { setLogoPreview(url); setValue("logoUrl", url ?? ""); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("settings.invoice_header")}</Label>
              <Textarea
                {...register("invoiceHeaderText")}
                placeholder={t("settings.invoice_header_placeholder")}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.invoice_footer")}</Label>
              <Textarea
                {...register("invoiceFooterText")}
                placeholder={t("settings.invoice_footer_placeholder")}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.receipt_footer_title")}</Label>
              <Textarea
                {...register("receiptFooter")}
                placeholder={t("settings.receipt_footer_desc")}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Invoice Format */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.invoice_format")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.invoice_format_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("settings.invoice_type")}</Label>
              <Controller
                name="invoiceType"
                control={control}
                render={({ field }) => {
                  const invoiceTypeLabels: Record<string, string> = {
                    a4: t("settings.invoice_type_a4"),
                    thermal_80: t("settings.invoice_type_thermal80"),
                    thermal_58: t("settings.invoice_type_thermal58"),
                  };
                  return (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue>{invoiceTypeLabels[field.value] ?? field.value}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a4">{invoiceTypeLabels.a4}</SelectItem>
                        <SelectItem value="thermal_80">{invoiceTypeLabels.thermal_80}</SelectItem>
                        <SelectItem value="thermal_58">{invoiceTypeLabels.thermal_58}</SelectItem>
                      </SelectContent>
                    </Select>
                  );
                }}
              />
            </div>

            <Link href="/settings/invoice-builder">
              <Button type="button" variant="outline" size="sm">{t("settings.open_invoice_builder")}</Button>
            </Link>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>{t("settings.show_barcode")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.show_barcode_desc")}</p>
              </div>
              <Controller
                name="showBarcode"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>{t("settings.repair_invoice_same")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.repair_invoice_same_desc")}</p>
              </div>
              <Controller
                name="repairInvoiceSameAsSales"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>

            {!watch("repairInvoiceSameAsSales") && (
              <div className="space-y-1.5">
                <Label>{t("settings.repair_invoice_type")}</Label>
                <Controller
                  name="repairInvoiceType"
                  control={control}
                  render={({ field }) => {
                    const repairTypeLabels: Record<string, string> = {
                      a4: t("settings.invoice_type_a4"),
                      thermal_80: t("settings.invoice_type_thermal80"),
                      thermal_58: t("settings.invoice_type_thermal58"),
                    };
                    return (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue>{repairTypeLabels[field.value] ?? field.value}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a4">{repairTypeLabels.a4}</SelectItem>
                          <SelectItem value="thermal_80">{repairTypeLabels.thermal_80}</SelectItem>
                          <SelectItem value="thermal_58">{repairTypeLabels.thermal_58}</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.financial")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.financial_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("settings.currency")}</Label>
                <Controller
                  name="currency"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("settings.select_currency")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SAR">{t("settings.currency_sar")}</SelectItem>
                        <SelectItem value="AED">{t("settings.currency_aed")}</SelectItem>
                        <SelectItem value="USD">{t("settings.currency_usd")}</SelectItem>
                        <SelectItem value="EUR">{t("settings.currency_eur")}</SelectItem>
                        <SelectItem value="GBP">{t("settings.currency_gbp")}</SelectItem>
                        <SelectItem value="KWD">{t("settings.currency_kwd")}</SelectItem>
                        <SelectItem value="QAR">{t("settings.currency_qar")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.tax_rate")}</Label>
                <Input type="number" step="0.01" min="0" max="100" {...register("taxRate")} placeholder="15" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.vat_number")}</Label>
              <Input {...register("vatNumber")} placeholder={t("settings.vat_number_placeholder")} />
              <p className="text-xs text-muted-foreground">{t("settings.vat_number_desc")}</p>
            </div>
            <Link href="/settings/payment-methods">
              <Button type="button" variant="outline" size="sm">{t("settings.manage_payment_methods")}</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Inventory Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.inventory_alerts")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.inventory_alerts_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>{t("settings.low_stock_threshold")}</Label>
              <Input type="number" min="0" {...register("lowStockThreshold")} placeholder="5" />
              <p className="text-xs text-muted-foreground">{t("settings.low_stock_help")}</p>
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.expiry_alert_days")}</Label>
              <Input type="number" min="0" {...register("expiryAlertDays")} placeholder="7" />
              <p className="text-xs text-muted-foreground">{t("settings.expiry_alert_days_help")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Import / Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.import_export_title")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.import_export_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/settings/import-export">
              <Button type="button" variant="outline" size="sm">{t("settings.open_import_export")}</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Roles & Audit Log */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.rbac_title")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.rbac_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/settings/roles">
              <Button type="button" variant="outline" size="sm">{t("roles.title")}</Button>
            </Link>
            <Link href="/settings/audit-log">
              <Button type="button" variant="outline" size="sm">{t("auditLog.title")}</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.integrations_title")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.integrations_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/settings/integrations">
              <Button type="button" variant="outline" size="sm">{t("settings.open_integrations")}</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.modules_title")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.modules_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>{t("settings.repairs_module")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.repairs_module_desc")}</p>
              </div>
              <Controller
                name="repairsModuleEnabled"
                control={control}
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-3">
              <Link href="/settings/branches">
                <Button type="button" variant="outline" size="sm">{t("branches.title")}</Button>
              </Link>
              <Link href="/settings/warehouses">
                <Button type="button" variant="outline" size="sm">{t("warehouses.title")}</Button>
              </Link>
              <Link href="/settings/installment-plans">
                <Button type="button" variant="outline" size="sm">{t("installments.title")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("settings.language_title")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("settings.language_desc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Controller
              name="language"
              control={control}
              render={({ field }) => {
                const langLabels: Record<string, string> = {
                  en: t("settings.lang_en"),
                  ar: t("settings.lang_ar"),
                };
                return (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder={t("settings.select_language")}>
                        {langLabels[field.value] ?? field.value}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">{langLabels.en}</SelectItem>
                      <SelectItem value="ar">{langLabels.ar}</SelectItem>
                    </SelectContent>
                  </Select>
                );
              }}
            />
          </CardContent>
        </Card>

        {/* Users & roles */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{t("settings.roles_title")}</CardTitle>
                  <CardDescription className="text-xs mt-0.5">{t("settings.roles_desc")}</CardDescription>
                </div>
              </div>
              <Link href="/settings/users">
                <Button type="button" variant="outline" size="sm">{t("settings.manage_users")}</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {["cashier", "store_manager", "warehouse_staff", "accountant"].map(role => (
                <div key={role} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{t(`roles.${role}`)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={updateSettings.isPending} size="lg">
            <Save className="me-2 h-4 w-4" />
            {updateSettings.isPending ? t("common.saving") : t("settings.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
