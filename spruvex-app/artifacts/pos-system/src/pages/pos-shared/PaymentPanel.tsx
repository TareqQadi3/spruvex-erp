import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Banknote, CreditCard } from "lucide-react";
import { useTranslation } from "@/i18n";

export function PaymentPanel({
  subtotalBeforeTax,
  taxAmount,
  taxRate,
  total,
  isProcessing,
  cartEmpty,
  fmt,
  onCheckout,
}: {
  subtotalBeforeTax: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  isProcessing: boolean;
  cartEmpty: boolean;
  fmt: (n: number) => string;
  onCheckout: (method: "cash" | "card") => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="p-4 bg-card border-t space-y-3">
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("pos.subtotal")}</span>
          <span>{fmt(subtotalBeforeTax)}</span>
        </div>
        {taxRate > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("pos.tax", { rate: taxRate })}</span>
            <span>{fmt(taxAmount)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between text-xl font-bold">
          <span>{t("pos.total")}</span>
          <span className="text-primary">{fmt(total)}</span>
        </div>
      </div>

      {isProcessing ? (
        <div className="h-14 rounded-lg bg-muted flex items-center justify-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm font-medium">{t("pos.processing")}</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onCheckout("cash")}
            disabled={cartEmpty}
          >
            <Banknote className="me-2 h-5 w-5" />
            <div className="flex flex-col items-start">
              <span className="text-xs opacity-80">{t("pos.pay_with")}</span>
              <span className="font-bold">{t("pos.cash")}</span>
            </div>
          </Button>
          <Button
            size="lg"
            className="h-14 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => onCheckout("card")}
            disabled={cartEmpty}
          >
            <CreditCard className="me-2 h-5 w-5" />
            <div className="flex flex-col items-start">
              <span className="text-xs opacity-80">{t("pos.pay_with")}</span>
              <span className="font-bold">{t("pos.card")}</span>
            </div>
          </Button>
        </div>
      )}
    </div>
  );
}
