import { useState } from "react";
import {
  useGetProducts, useGetCustomers, useCreateSale,
  useGetSettings, getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { printInvoice } from "@/utils/printInvoice";
import { emailInvoice, whatsappInvoice } from "@/utils/shareInvoice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Printer, ShoppingBag, CheckCircle2, Save, Mail, MessageCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/i18n";
import { PosLayoutShell } from "../pos-shared/PosLayoutShell";
import { CartPanel } from "../pos-shared/CartPanel";
import type { CartItem, CompletedSale, PosCustomer } from "../pos-shared/types";

export default function ListPosTemplate() {
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: products } = useGetProducts(search ? { search } : undefined);
  const { data: customers } = useGetCustomers();
  const customerList = (customers ?? []) as unknown as PosCustomer[];
  const { data: settings } = useGetSettings();
  const createSale = useCreateSale();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const taxRate = Number(settings?.taxRate ?? 0);
  const currency = settings?.currency ?? "SAR";

  const invoiceSettings = {
    shopName: settings?.shopName,
    shopAddress: settings?.shopAddress,
    shopPhone: settings?.shopPhone,
    logoUrl: settings?.logoUrl,
    invoiceHeaderText: settings?.invoiceHeaderText,
    invoiceFooterText: settings?.invoiceFooterText,
    currency: settings?.currency,
    taxRate: settings?.taxRate,
    vatNumber: (settings as { vatNumber?: string | null })?.vatNumber,
  };

  const fmt = (n: number) => `${currency} ${n.toFixed(2)}`;

  const getItemFinalPrice = (item: CartItem) =>
    item.includesTax ? item.unitPrice : item.unitPrice * (1 + taxRate / 100);

  const getItemTotal = (item: CartItem) => getItemFinalPrice(item) * item.quantity - item.discount;

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

  const handleCheckout = (method: "cash" | "card") => {
    if (cart.length === 0 || isProcessing) return;

    setIsProcessing(true);
    const items = cart.map(i => ({
      productId: i.productId,
      productName: i.productName,
      unitPrice: getItemFinalPrice(i),
      quantity: i.quantity,
      discount: i.discount,
    }));
    const customerName = selectedCustomerName || t("pos.walk_in");
    const customerPhone = customerList.find(c => c.id === selectedCustomerId)?.phone ?? null;
    const cartSnapshot = [...cart];
    const totalSnapshot = total;

    createSale.mutate(
      {
        data: {
          items,
          paymentMethod: method,
          amountPaid: total,
          discount: 0,
          customerId: selectedCustomerId ?? undefined,
        } as any
      },
      {
        onSuccess: (sale: any) => {
          // Save confirmed in DB — now update UI
          setCart([]);
          setSelectedCustomerId(null);
          setSelectedCustomerName("");
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          setCompletedSale({
            id: sale.id,
            total: totalSnapshot,
            paymentMethod: method,
            customerName,
            customerPhone,
            itemCount: cartSnapshot.reduce((s, i) => s + i.quantity, 0),
            cartItems: cartSnapshot.map(i => ({
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: getItemFinalPrice(i),
              subtotal: getItemTotal(i),
            })),
            createdAt: new Date().toISOString(),
          });
          setIsProcessing(false);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? t("pos.sale_failed");
          // Show error inline in the cart panel rather than a fleeting toast
          setCompletedSale(null);
          setIsProcessing(false);
          // Surface the error prominently
          alert(`${t("pos.sale_failed")}: ${msg}`);
        },
      }
    );
  };

  const startNewSale = () => {
    setCompletedSale(null);
  };

  // ─── Success Screen ───────────────────────────────────────────────
  if (completedSale) {
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
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{t("pos.transaction_id")}</span>
                <span className="font-mono font-medium">#{completedSale.id}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{t("pos.customer")}</span>
                <span className="font-medium">{completedSale.customerName}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{t("pos.payment_method")}</span>
                <span className="font-medium capitalize">
                  {completedSale.paymentMethod === "cash" ? t("pos.cash") : t("pos.card")}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-muted-foreground">{t("pos.items_sold")}</span>
                <span className="font-medium">{completedSale.itemCount}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5 bg-green-500/5">
                <span className="font-bold">{t("pos.total")}</span>
                <span className="font-bold text-green-500">{fmt(completedSale.total)}</span>
              </div>
            </div>

            <div className="w-full space-y-3">
              <div className="grid grid-cols-4 gap-2">
                <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => printInvoice({
                  sale: { id: completedSale.id, total: completedSale.total, paymentMethod: completedSale.paymentMethod, createdAt: completedSale.createdAt, customerName: completedSale.customerName },
                  items: completedSale.cartItems, settings: invoiceSettings,
                })}>
                  <Save className="h-5 w-5" />
                  <span className="text-xs">{t("pos.save")}</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => printInvoice({
                  sale: { id: completedSale.id, total: completedSale.total, paymentMethod: completedSale.paymentMethod, createdAt: completedSale.createdAt, customerName: completedSale.customerName },
                  items: completedSale.cartItems, settings: invoiceSettings,
                })}>
                  <Printer className="h-5 w-5" />
                  <span className="text-xs">{t("pos.print")}</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => emailInvoice({
                  invoiceNo: completedSale.id, shopName: settings?.shopName, customerName: completedSale.customerName,
                  items: completedSale.cartItems, total: completedSale.total, currency: settings?.currency,
                })}>
                  <Mail className="h-5 w-5" />
                  <span className="text-xs">{t("pos.email")}</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => whatsappInvoice({
                  invoiceNo: completedSale.id, shopName: settings?.shopName, customerName: completedSale.customerName,
                  items: completedSale.cartItems, total: completedSale.total, currency: settings?.currency, phone: completedSale.customerPhone,
                })}>
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-xs">{t("pos.whatsapp")}</span>
                </Button>
              </div>
              <Button size="lg" className="h-14 w-full bg-primary" onClick={startNewSale}>
                <ShoppingBag className="me-2 h-5 w-5" />
                <span className="font-bold">{t("pos.new_sale")}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
          customers={customerList}
          selectedCustomerId={selectedCustomerId}
          selectedCustomerName={selectedCustomerName}
          onSelectCustomer={(id, name) => { setSelectedCustomerId(id); setSelectedCustomerName(name); }}
          onCustomerCreated={c => { setSelectedCustomerId(c.id); setSelectedCustomerName(c.name); }}
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
          isProcessing={isProcessing}
          onCheckout={handleCheckout}
        />
      }
    />
  );
}
