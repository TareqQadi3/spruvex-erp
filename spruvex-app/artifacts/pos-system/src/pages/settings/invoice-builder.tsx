import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Pencil, Trash2, Star, FileText } from "lucide-react";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

interface TemplateConfig {
  showLogo: boolean;
  logoUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  language: "ar" | "en";
  accentColor: string;
  showBuyerInfo: boolean;
}
interface InvoiceTemplate {
  id: string;
  name: string;
  documentKind: "sales" | "purchase";
  printType: "thermal_58" | "thermal_80" | "a4";
  isDefault: boolean;
  config: TemplateConfig;
  createdAt?: string;
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

const DEFAULT_CONFIG: TemplateConfig = {
  showLogo: true,
  headerText: "",
  footerText: "",
  language: "ar",
  accentColor: "#1a56db",
  showBuyerInfo: true,
};

export default function InvoiceBuilderPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogTemplate, setDialogTemplate] = useState<InvoiceTemplate | "new" | null>(null);

  const { data: templates, isLoading } = useQuery<InvoiceTemplate[]>({
    queryKey: ["invoice-templates"],
    queryFn: () => authFetch("/invoice-templates"),
  });

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: string; template: Partial<InvoiceTemplate> }) =>
      vars.id
        ? authFetch(`/invoice-templates/${vars.id}`, { method: "PATCH", body: JSON.stringify(vars.template) })
        : authFetch("/invoice-templates", { method: "POST", body: JSON.stringify(vars.template) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      setDialogTemplate(null);
      toast.success(t("invoiceBuilder.save_success"));
    },
    onError: (err: Error) => toast.error(err.message ?? t("invoiceBuilder.save_failed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/invoice-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast.success(t("invoiceBuilder.delete_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const makeDefaultMutation = useMutation({
    mutationFn: (template: InvoiceTemplate) =>
      authFetch(`/invoice-templates/${template.id}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast.success(t("invoiceBuilder.save_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const grouped = (templates ?? []).reduce<Record<string, InvoiceTemplate[]>>((acc, tmpl) => {
    const key = `${tmpl.documentKind}|${tmpl.printType}`;
    (acc[key] ??= []).push(tmpl);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("invoiceBuilder.title")}</h1>
            <p className="text-muted-foreground text-sm">{t("invoiceBuilder.subtitle")}</p>
          </div>
        </div>
        <Button onClick={() => setDialogTemplate("new")}>
          <Plus className="me-2 h-4 w-4" />
          {t("invoiceBuilder.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("invoiceBuilder.list_title")}</CardTitle>
          <CardDescription>{t("invoiceBuilder.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          {!isLoading && templates?.length === 0 && (
            <div className="py-12 flex flex-col items-center text-center text-muted-foreground gap-2">
              <FileText className="h-8 w-8" />
              <p className="text-sm">{t("invoiceBuilder.empty")}</p>
            </div>
          )}
          {Object.entries(grouped).map(([key, list]) => {
            const [kind, printType] = key.split("|") as [InvoiceTemplate["documentKind"], InvoiceTemplate["printType"]];
            return (
              <div key={key} className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  {t(`invoiceBuilder.kind_${kind}`)} · {t(`invoiceBuilder.print_type_${printType}`)}
                </div>
                <div className="space-y-2">
                  {list.map(tmpl => (
                    <div key={tmpl.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-8 w-8 rounded-md shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: tmpl.config.accentColor ?? "#1a56db" }}
                        >
                          <FileText className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2">
                            <span className="truncate">{tmpl.name}</span>
                            {tmpl.isDefault && <Badge className="text-[9px] px-1.5">{t("invoiceBuilder.default_badge")}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t(`invoiceBuilder.lang_${tmpl.config.language}`)}
                            {tmpl.config.headerText ? ` · ${tmpl.config.headerText.slice(0, 40)}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!tmpl.isDefault && (
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => makeDefaultMutation.mutate(tmpl)}>
                            <Star className="h-3.5 w-3.5 me-1" />
                            {t("invoiceBuilder.make_default")}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setDialogTemplate(tmpl)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => {
                            if (window.confirm(t("invoiceBuilder.delete_confirm"))) deleteMutation.mutate(tmpl.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {dialogTemplate && (
        <TemplateDialog
          template={dialogTemplate === "new" ? null : dialogTemplate}
          onClose={() => setDialogTemplate(null)}
          onSave={(template) => saveMutation.mutate({ id: dialogTemplate === "new" ? undefined : dialogTemplate.id, template })}
          isPending={saveMutation.isPending}
        />
      )}
    </div>
  );
}

function TemplateDialog({
  template, onClose, onSave, isPending,
}: {
  template: InvoiceTemplate | null;
  onClose: () => void;
  onSave: (template: Partial<InvoiceTemplate>) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(template?.name ?? "");
  const [documentKind, setDocumentKind] = useState<InvoiceTemplate["documentKind"]>(template?.documentKind ?? "sales");
  const [printType, setPrintType] = useState<InvoiceTemplate["printType"]>(template?.printType ?? "a4");
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [showLogo, setShowLogo] = useState(template?.config.showLogo ?? DEFAULT_CONFIG.showLogo);
  const [headerText, setHeaderText] = useState(template?.config.headerText ?? DEFAULT_CONFIG.headerText ?? "");
  const [footerText, setFooterText] = useState(template?.config.footerText ?? DEFAULT_CONFIG.footerText ?? "");
  const [language, setLanguage] = useState<"ar" | "en">(template?.config.language ?? DEFAULT_CONFIG.language);
  const [accentColor, setAccentColor] = useState(template?.config.accentColor ?? DEFAULT_CONFIG.accentColor);
  const [showBuyerInfo, setShowBuyerInfo] = useState(template?.config.showBuyerInfo ?? DEFAULT_CONFIG.showBuyerInfo);

  const config: TemplateConfig = {
    showLogo,
    headerText: headerText.trim() || null,
    footerText: footerText.trim() || null,
    language,
    accentColor,
    showBuyerInfo,
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? t("invoiceBuilder.edit") : t("invoiceBuilder.add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("invoiceBuilder.name")}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t("invoiceBuilder.name_placeholder")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("invoiceBuilder.document_kind")}</Label>
              <Select value={documentKind} onValueChange={(v) => setDocumentKind(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">{t("invoiceBuilder.kind_sales")}</SelectItem>
                  <SelectItem value="purchase">{t("invoiceBuilder.kind_purchase")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("invoiceBuilder.print_type")}</Label>
              <Select value={printType} onValueChange={(v) => setPrintType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">{t("invoiceBuilder.print_type_a4")}</SelectItem>
                  <SelectItem value="thermal_80">{t("invoiceBuilder.print_type_thermal_80")}</SelectItem>
                  <SelectItem value="thermal_58">{t("invoiceBuilder.print_type_thermal_58")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">{t("invoiceBuilder.is_default")}</Label>
              <p className="text-xs text-muted-foreground">{t("invoiceBuilder.is_default_help")}</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className="text-sm font-medium">{t("invoiceBuilder.config_title")}</div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t("invoiceBuilder.show_logo")}</Label>
              <Switch checked={showLogo} onCheckedChange={setShowLogo} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("invoiceBuilder.header_text")}</Label>
              <Textarea rows={2} value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder={t("invoiceBuilder.header_text_placeholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("invoiceBuilder.footer_text")}</Label>
              <Textarea rows={2} value={footerText} onChange={e => setFooterText(e.target.value)} placeholder={t("invoiceBuilder.footer_text_placeholder")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("invoiceBuilder.language")}</Label>
                <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">{t("invoiceBuilder.lang_ar")}</SelectItem>
                    <SelectItem value="en">{t("invoiceBuilder.lang_en")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("invoiceBuilder.accent_color")}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="h-9 w-12 rounded border bg-background cursor-pointer"
                  />
                  <Input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t("invoiceBuilder.show_buyer_info")}</Label>
              <Switch checked={showBuyerInfo} onCheckedChange={setShowBuyerInfo} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{t("invoiceBuilder.preview_title")}</Label>
            <TemplatePreview showLogo={showLogo} headerText={headerText} footerText={footerText} language={language} accentColor={accentColor} printType={printType} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            disabled={isPending || !name.trim()}
            onClick={() => onSave({ name: name.trim(), documentKind, printType, isDefault, config })}
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatePreview({
  showLogo, headerText, footerText, language, accentColor, printType,
}: {
  showLogo: boolean;
  headerText: string;
  footerText: string;
  language: "ar" | "en";
  accentColor: string;
  printType: string;
}) {
  const { t } = useTranslation();
  const isThermal = printType === "thermal_58";
  return (
    <div
      dir={language === "ar" ? "rtl" : "ltr"}
      className={`border rounded-lg bg-white text-gray-900 p-3 overflow-hidden ${isThermal ? "max-w-[220px]" : ""}`}
    >
      <div className="text-center pb-2 border-b-2" style={{ borderColor: accentColor }}>
        {showLogo && (
          <div className="mx-auto mb-1.5 h-8 w-8 rounded flex items-center justify-center" style={{ backgroundColor: `${accentColor}22` }}>
            <FileText className="h-4 w-4" style={{ color: accentColor }} />
          </div>
        )}
        <div className="font-bold text-xs">My Shop</div>
        {headerText && <div className="text-[9px] text-gray-500 mt-0.5 line-clamp-1">{headerText}</div>}
      </div>
      <div className="flex justify-between text-[9px] py-1.5">
        <span>{language === "ar" ? "رقم الفاتورة" : "Invoice #"}</span>
        <span>000001</span>
      </div>
      <table className="w-full text-[9px] my-1">
        <thead>
          <tr style={{ backgroundColor: accentColor }} className="text-white">
            <th className="text-start px-1 py-1">{language === "ar" ? "الصنف" : "Item"}</th>
            <th className="px-1 py-1">{language === "ar" ? "الكمية" : "Qty"}</th>
            <th className="text-end px-1 py-1">{language === "ar" ? "السعر" : "Price"}</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2].map(i => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-1 py-1">{language === "ar" ? "منتج مثال" : "Sample item"}</td>
              <td className="text-center">1</td>
              <td className="text-end">10.00</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between text-[10px] font-bold pt-1.5 border-t-2" style={{ borderColor: accentColor }}>
        <span>{language === "ar" ? "الإجمالي" : "Total"}</span>
        <span>20.00</span>
      </div>
      {footerText && <div className="text-[8px] text-gray-500 text-center mt-1.5 line-clamp-1">{footerText}</div>}
    </div>
  );
}
