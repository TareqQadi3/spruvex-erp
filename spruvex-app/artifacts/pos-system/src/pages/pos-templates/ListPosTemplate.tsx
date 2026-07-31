import { useState } from "react";
import { useGetProducts, useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/i18n";
import { PosLayoutShell } from "../pos-shared/PosLayoutShell";
import { CartPanel } from "../pos-shared/CartPanel";
import { PosSuccessScreen } from "../pos-shared/PosSuccessScreen";
import { usePosSale } from "../pos-shared/usePosSale";
import { usePosCustomerSelection } from "../pos-shared/usePosCustomerSelection";
import type { CartItem, PosCustomer, CheckoutPayload } from "../pos-shared/types";

export default function ListPosTemplate() {
  const [search, setSearch] = useState("");
  const customer = usePosCustomerSelection();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");

  const { data: products } = useGetProducts(search ? { search } : undefined);
  const { data: settings } = useGetSettings();
  const { t } = useTranslation();

  const taxRate = Number(settings?.taxRate ?? 0);
  const currency = settings?.currency ?? "SAR";

  const fmt = (n: number) => `${currency} ${n.toFixed(2)}`;

  const getItemFinalPrice = (item: CartItem) =>
    item.includesTax ? item.unitPrice : item.unitPrice * (1 + taxRate / 100);

  const getItemTotal = (item: CartItem) => getItemFinalPrice(item) * item.quantity - item.discount;

  const sale = usePosSale({ getItemFinalPrice, getItemTotal });

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        unitPrice: Number(product.sellingPrice),
        includesTax: product.includesTax ?? false,
        quantity: 1,
        discount: 0,
      }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev =>
      prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
  };

  const startEditPrice = (item: CartItem) => {
    setEditingPrice(item.productId);
    setEditPriceValue(item.unitPrice.toFixed(2));
  };

  const confirmEditPrice = (productId: number) => {
    const val = parseFloat(editPriceValue);
    if (!isNaN(val) && val >= 0) {
      setCart(prev => prev.map(i => i.productId === productId ? { ...i, unitPrice: val } : i));
    }
    setEditingPrice(null);
  };

  const taxAmount = cart.reduce((sum, item) => {
    if (item.includesTax) return sum;
    return sum + (item.unitPrice * (taxRate / 100) * item.quantity);
  }, 0);
  const subtotalBeforeTax = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity - item.discount, 0);
  const total = cart.reduce((sum, item) => sum + getItemTotal(item), 0);

  const resetAfterSale = () => {
    setCart([]);
    customer.resetCustomer();
  };

  const handleCheckout = (payload: CheckoutPayload) => {
    sale.submitSale({
      cart,
      customer: customer.selectedCustomer,
      discount: 0,
      payload,
      onSuccess: resetAfterSale,
    });
  };

  const handleSuspend = () => {
    sale.suspendCart("", cart, 0);
    resetAfterSale();
  };

  const handleRestoreHeld = (id: string) => {
    const held = sale.restoreHeldCart(id);
    if (held) {
      setCart(held.items);
      customer.resetCustomer();
    }
  };

  if (sale.completedSale) {
    return <PosSuccessScreen completedSale={sale.completedSale} fmt={fmt} onNewSale={() => sale.setCompletedSale(null)} />;
  }

  return (
    <PosLayoutShell
      productArea={
        <>
          <div className="relative">
            <Search className="absolute start-3 top-3 h-5 w-5 text-muted-foreground" />
            <Input
              className="ps-10 h-12 text-base bg-background"
              placeholder={t("pos.search_placeholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
              {products?.map(product => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-primary transition-colors select-none"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                    <div className="h-14 w-14 bg-muted rounded-lg flex items-center justify-center">
                      <span className="font-bold text-xl">{product.name.charAt(0)}</span>
                    </div>
                    <div className="w-full">
                      <div className="font-medium text-sm line-clamp-2">{product.name}</div>
                      <div className="text-primary font-bold mt-1">
                        {fmt(product.includesTax
                          ? Number(product.sellingPrice)
                          : Number(product.sellingPrice) * (1 + taxRate / 100))}
                      </div>
                      {!product.includesTax && taxRate > 0 && (
                        <div className="text-[10px] text-muted-foreground">{t("pos.incl_tax")}</div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{t("pos.stock", { count: product.stock })}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </>
      }
      cartPanel={
        <CartPanel
          customers={customer.customerList}
          selectedCustomerId={customer.selectedCustomerId}
          selectedCustomerName={customer.selectedCustomerName}
          onSelectCustomer={customer.selectCustomer}
          onCustomerCreated={customer.customerCreated}
          cart={cart}
          editingPriceId={editingPrice}
          editPriceValue={editPriceValue}
          onStartEditPrice={startEditPrice}
          onEditPriceValueChange={setEditPriceValue}
          onConfirmEditPrice={confirmEditPrice}
          onCancelEditPrice={() => setEditingPrice(null)}
          onRemoveItem={removeFromCart}
          onQuantityChange={updateQuantity}
          taxRate={taxRate}
          fmt={fmt}
          getItemTotal={getItemTotal}
          subtotalBeforeTax={subtotalBeforeTax}
          taxAmount={taxAmount}
          total={total}
          isProcessing={sale.isProcessing}
          paymentMethods={sale.paymentMethods}
          heldCarts={sale.heldCarts}
          onRestoreHeld={handleRestoreHeld}
          onRemoveHeld={sale.removeHeldCart}
          onSuspend={handleSuspend}
          onCheckout={handleCheckout}
        />
      }
    />
  );
}
