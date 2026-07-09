import { useEffect, useRef } from "react";
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
import { Save, Store, Receipt, Bell, Globe, Image, Printer, Shield } from "lucide-react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "@/i18n";
import type { Lang } from "@/i18n";
import { useState } from "react";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const { t, setLang } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { register, handleSubmit, reset, control, setValue, watch } = useForm<any>({
    defaultValues: {
      shopName: "", shopAddress: "", shopPhone: "",
      currency: "SAR", taxRate: 15, lowStockThreshold: 5,
      receiptFooter: "", language: "en",
      logoUrl: "", invoiceHeaderText: "", invoiceFooterText: "",
      showBarcode: false, invoiceType: "a4", repairsModuleEnabled: true,
      vatNumber: "", repairInvoiceType: "a4", repairInvoiceSameAsSales: true,
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
      });
      if (settings.logoUrl) setLogoPreview(settings.logoUrl);
    }
  }, [settings, reset]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error(t("settings.logo_too_large"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoPreview(dataUrl);
      setValue("logoUrl", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = (data: any) => {
    updateSettings.mutate({
      data: {
        shopName: data.shopName,
        shopAddress: data.shopAddress || null,
        shopPhone: data.shopPhone || null,
        currency: data.currency,
        taxRate: Number(data.taxRate),
        lowStockThreshold: Number(data.lowStockThreshold),
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
              <div className="flex items-start gap-4">
                <div
                  className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/30 overflow-hidden shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-center p-2">
                      <Image className="h-6 w-6 text-muted-foreground/50 mx-auto" />
                      <span className="text-[10px] text-muted-foreground">{t("settings.logo_upload_hint")}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2 flex-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    {t("settings.upload_logo")}
                  </Button>
                  {logoPreview && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive ms-2"
                      onClick={() => { setLogoPreview(null); setValue("logoUrl", ""); }}>
                      {t("common.delete")}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">{t("settings.logo_size_hint")}</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
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
                        <SelectItem value="SAR">SAR — Saudi Riyal ﷼</SelectItem>
                        <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                        <SelectItem value="USD">USD — US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                        <SelectItem value="GBP">GBP — British Pound</SelectItem>
                        <SelectItem value="KWD">KWD — Kuwaiti Dinar</SelectItem>
                        <SelectItem value="QAR">QAR — Qatari Riyal</SelectItem>
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
