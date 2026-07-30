import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Pencil, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import { CustomerPanel } from "./CustomerPanel";
import { PaymentPanel } from "./PaymentPanel";
import { QuantityControl } from "./QuantityControl";
import type { CartItem } from "./types";

interface Customer {
  id: number;
  name: string;
  phone?: string | null;
}

/**
 * The full right-hand cart card every POS template shares: customer picker,
 * line items (with inline price edit + qty), totals, and cash/card checkout.
 * Templates differ only in how a product gets *into* this cart (List search,
 * Grid buttons, Image tiles, Mobile variant picker) — this component and its
 * callback contract stay identical across all of them.
 */
export function CartPanel({
  customers,
  selectedCustomerId,
  selectedCustomerName,
  onSelectCustomer,
  onCustomerCreated,
  cart,
  editingPriceId,
  editPriceValue,
  onStartEditPrice,
  onEditPriceValueChange,
  onConfirmEditPrice,
  onCancelEditPrice,
  onRemoveItem,
  onQuantityChange,
  taxRate,
  fmt,
  getItemTotal,
  subtotalBeforeTax,
  taxAmount,
  total,
  isProcessing,
  onCheckout,
}: {
  customers: Customer[] | undefined;
  selectedCustomerId: number | null;
  selectedCustomerName: string;
  onSelectCustomer: (id: number | null, name: string) => void;
  onCustomerCreated: (customer: { id: number; name: string }) => void;
  cart: CartItem[];
  editingPriceId: number | null;
  editPriceValue: string;
  onStartEditPrice: (item: CartItem) => void;
  onEditPriceValueChange: (value: string) => void;
  onConfirmEditPrice: (productId: number) => void;
  onCancelEditPrice: () => void;
  onRemoveItem: (productId: number) => void;
  onQuantityChange: (productId: number, delta: number) => void;
  taxRate: number;
  fmt: (n: number) => string;
  getItemTotal: (item: CartItem) => number;
  subtotalBeforeTax: number;
  taxAmount: number;
  total: number;
  isProcessing: boolean;
  onCheckout: (method: "cash" | "card") => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="w-96 flex flex-col bg-background/50 border-sidebar-border shrink-0">
      <CardHeader className="py-3 px-4 border-b bg-card">
        <CardTitle className="text-base">{t("pos.current_sale")}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
        <CustomerPanel
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          selectedCustomerName={selectedCustomerName}
          onSelect={onSelectCustomer}
          onCreated={onCustomerCreated}
        />

        <ScrollArea className="flex-1 px-4 py-3">
          <div className="space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">{t("pos.cart_empty")}</div>
            ) : (
              cart.map(item => (
                <div key={item.productId} className="p-3 bg-muted/40 rounded-lg border space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-medium text-sm line-clamp-2">{item.productName}</span>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => onRemoveItem(item.productId)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground text-xs">{t("pos.unit_price")}:</span>
                    {editingPriceId === item.productId ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={editPriceValue}
                          onChange={e => onEditPriceValueChange(e.target.value)}
                          className="h-6 text-xs px-2 w-24"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter") onConfirmEditPrice(item.productId);
                            if (e.key === "Escape") onCancelEditPrice();
                          }}
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onConfirmEditPrice(item.productId)}>
                          <Check className="h-3 w-3 text-green-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelEditPrice}>
                          <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                        onClick={() => onStartEditPrice(item)}
                      >
                        <span className="font-medium">{fmt(item.unitPrice)}</span>
                        <Pencil className="h-3 w-3 opacity-60" />
                      </button>
                    )}
                    {!item.includesTax && taxRate > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 ms-auto">+{taxRate}%</Badge>
                    )}
                  </div>

                  {item.itemNotes && (
                    <div className="text-xs text-muted-foreground italic">{item.itemNotes}</div>
                  )}
                  {item.selectedAddons && item.selectedAddons.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {item.selectedAddons.map(a => a.optionName).join(", ")}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <QuantityControl quantity={item.quantity} onChange={delta => onQuantityChange(item.productId, delta)} />
                    <span className="font-bold text-sm">{fmt(getItemTotal(item))}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <PaymentPanel
          subtotalBeforeTax={subtotalBeforeTax}
          taxAmount={taxAmount}
          taxRate={taxRate}
          total={total}
          isProcessing={isProcessing}
          cartEmpty={cart.length === 0}
          fmt={fmt}
          onCheckout={onCheckout}
        />
      </CardContent>
    </Card>
  );
}
