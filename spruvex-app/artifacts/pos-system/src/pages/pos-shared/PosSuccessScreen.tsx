import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { printInvoice } from "@/utils/printInvoice";
import { emailInvoice, whatsappInvoice } from "@/utils/shareInvoice";
import { CheckCircle2, Save, Printer, Mail, MessageCircle, ShoppingBag } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { CompletedSale } from "./types";

/**
 * Post-checkout completion screen shared by every POS template: shows the
 * saved sale summary and the print/email/WhatsApp/save action bar, with a
 * "New Sale" button to start over. Templates pass their own settings + money
 * formatter so invoices stay consistent with the tenant's branding.
 */
export function PosSuccessScreen({
  completedSale,
  settings,
  fmt,
  onNewSale,
}: {
  completedSale: CompletedSale;
  settings: any;
  fmt: (n: number) => string;
  onNewSale: () => void;
}) {
  const { t } = useTranslation();
  const invoiceSettings = {
    shopName: settings?.shopName, shopAddress: settings?.shopAddress, shopPhone: settings?.shopPhone,
    logoUrl: settings?.logoUrl, invoiceHeaderText: settings?.invoiceHeaderText, invoiceFooterText: settings?.invoiceFooterText,
    currency: settings?.currency, taxRate: settings?.taxRate, vatNumber: (settings as any)?.vatNumber,
  };
  return (
    <div className="h-[calc(100vh-6rem)] flex items-center justify-center">
      <Card className="w-full max-w-md border-2 border-green-500/40 bg-background">
        <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center gap-6">
          <div className="h-20 w-20 rounded-full bg-green-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-green-500">{t("pos.transaction_complete")}</h2>
            <p className="text-muted-foreground text-sm">{t("pos.saved_in_database")}</p>
          </div>
          <div className="w-full rounded-lg bg-muted/50 border divide-y text-sm">
            <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">{t("pos.transaction_id")}</span><span className="font-mono font-medium">#{completedSale.id}</span></div>
            <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">{t("pos.customer")}</span><span className="font-medium">{completedSale.customerName}</span></div>
            <div className="flex justify-between px-4 py-2.5 bg-green-500/5"><span className="font-bold">{t("pos.total")}</span><span className="font-bold text-green-500">{fmt(completedSale.total)}</span></div>
          </div>
          <div className="w-full space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => printInvoice({ sale: { id: completedSale.id, total: completedSale.total, paymentMethod: completedSale.paymentMethod, createdAt: completedSale.createdAt, customerName: completedSale.customerName }, items: completedSale.cartItems, settings: invoiceSettings })}>
                <Save className="h-5 w-5" /><span className="text-xs">{t("pos.save")}</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => printInvoice({ sale: { id: completedSale.id, total: completedSale.total, paymentMethod: completedSale.paymentMethod, createdAt: completedSale.createdAt, customerName: completedSale.customerName }, items: completedSale.cartItems, settings: invoiceSettings })}>
                <Printer className="h-5 w-5" /><span className="text-xs">{t("pos.print")}</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => emailInvoice({ invoiceNo: completedSale.id, shopName: settings?.shopName, customerName: completedSale.customerName, items: completedSale.cartItems, total: completedSale.total, currency: settings?.currency })}>
                <Mail className="h-5 w-5" /><span className="text-xs">{t("pos.email")}</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => whatsappInvoice({ invoiceNo: completedSale.id, shopName: settings?.shopName, customerName: completedSale.customerName, items: completedSale.cartItems, total: completedSale.total, currency: settings?.currency, phone: completedSale.customerPhone })}>
                <MessageCircle className="h-5 w-5" /><span className="text-xs">{t("pos.whatsapp")}</span>
              </Button>
            </div>
            <Button size="lg" className="h-14 w-full bg-primary" onClick={onNewSale}>
              <ShoppingBag className="me-2 h-5 w-5" /><span className="font-bold">{t("pos.new_sale")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
