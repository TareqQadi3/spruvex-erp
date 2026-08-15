import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { openServerPrint } from "@/utils/openServerPrint";
import { emailInvoice, whatsappInvoice } from "@/utils/shareInvoice";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useGetSettings } from "@workspace/api-client-react";
import { CheckCircle2, Save, Printer, Mail, MessageCircle, ShoppingBag, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { CompletedSale } from "./types";

/**
 * Post-checkout completion screen shared by every POS template: shows the
 * saved sale summary and the print/email/WhatsApp/save action bar, with a
 * "New Sale" button to start over. Printing is on-demand: the ZATCA invoice is
 * created (or reused, idempotently) at print time, then rendered server-side
 * via the Invoice Builder's /api/invoicing/print/sales/:invoiceId so the
 * tenant's chosen thermal/A4 template applies.
 * 
 * Features:
 * - Success sound notification (configurable via settings.posSuccessSoundEnabled)
 * - Auto-return to POS after configurable seconds (settings.posAutoReturnSeconds, 0 = disabled)
 * - Manual "New Sale" button always works
 */
export function PosSuccessScreen({
  completedSale,
  fmt,
  onNewSale,
}: {
  completedSale: CompletedSale;
  fmt: (n: number) => string;
  onNewSale: () => void;
}) {
  const { t } = useTranslation();
  const { data: settings } = useGetSettings();
  const [printing, setPrinting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const hasPlayedSound = useRef(false);

  const printType = settings?.invoiceType ?? "a4";
  const autoReturnSeconds = settings?.posAutoReturnSeconds ?? 3;
  const soundEnabled = settings?.posSuccessSoundEnabled ?? true;

  // Play success sound and start auto-return countdown on mount
  useEffect(() => {
    // Play success sound
    if (soundEnabled && !hasPlayedSound.current) {
      hasPlayedSound.current = true;
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
      } catch {
        // Ignore audio errors (autoplay policy, etc.)
      }
    }

    // Start auto-return countdown if enabled
    if (autoReturnSeconds > 0) {
      setCountdown(autoReturnSeconds);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            onNewSale();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoReturnSeconds, soundEnabled, onNewSale]);

  const print = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      const invoice = await api<{ id: string }>(`/zatca/invoices/for-sale/${completedSale.id}`, { method: "POST" });
      await openServerPrint(`/invoicing/print/sales/${invoice.id}?printType=${printType}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPrinting(false);
    }
  };

  const handleNewSale = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(null);
    onNewSale();
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
            {countdown !== null && (
              <p className="text-xs text-muted-foreground">
                {t("pos.auto_return_in", { seconds: countdown })}
              </p>
            )}
          </div>
          <div className="w-full rounded-lg bg-muted/50 border divide-y text-sm">
            <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">{t("pos.transaction_id")}</span><span className="font-mono font-medium">#{completedSale.id}</span></div>
            <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">{t("pos.customer")}</span><span className="font-medium">{completedSale.customerName}</span></div>
            <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">{t("pos.payment_method")}</span><span className="font-medium capitalize">{completedSale.paymentMethod}</span></div>
            {completedSale.outstanding > 0.005 && (
              <div className="flex justify-between px-4 py-2.5"><span className="text-muted-foreground">{t("pos.outstanding_balance")}</span><span className="font-medium text-amber-600 dark:text-amber-400">{fmt(completedSale.outstanding)}</span></div>
            )}
            <div className="flex justify-between px-4 py-2.5 bg-green-500/5"><span className="font-bold">{t("pos.total")}</span><span className="font-bold text-green-500">{fmt(completedSale.total)}</span></div>
          </div>
          <div className="w-full space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" className="h-16 flex-col gap-1" onClick={print} disabled={printing}>
                {printing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                <span className="text-xs">{t("pos.save")}</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1" onClick={print} disabled={printing}>
                {printing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
                <span className="text-xs">{t("pos.print")}</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => emailInvoice({ invoiceNo: completedSale.id, shopName: settings?.shopName ?? undefined, customerName: completedSale.customerName, items: completedSale.cartItems, total: completedSale.total, currency: settings?.currency ?? undefined })}>
                <Mail className="h-5 w-5" /><span className="text-xs">{t("pos.email")}</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => whatsappInvoice({ invoiceNo: completedSale.id, shopName: settings?.shopName ?? undefined, customerName: completedSale.customerName, items: completedSale.cartItems, total: completedSale.total, currency: settings?.currency ?? undefined, phone: completedSale.customerPhone })}>
                <MessageCircle className="h-5 w-5" /><span className="text-xs">{t("pos.whatsapp")}</span>
              </Button>
            </div>
            <Button size="lg" className="h-14 w-full bg-primary" onClick={handleNewSale}>
              <ShoppingBag className="me-2 h-5 w-5" /><span className="font-bold">{t("pos.new_sale")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
