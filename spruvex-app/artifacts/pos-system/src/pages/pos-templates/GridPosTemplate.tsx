import { useEffect, useState } from "react";
import {
  useGetProducts, useGetCustomers, useCreateSale,
  useGetSettings, useGetCategories, getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { printInvoice } from "@/utils/printInvoice";
import { emailInvoice, whatsappInvoice } from "@/utils/shareInvoice";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Printer, ShoppingBag, CheckCircle2, Save, Mail, MessageCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { PosLayoutShell } from "../pos-shared/PosLayoutShell";
import { CartPanel } from "../pos-shared/CartPanel";
import { AddonPickerDialog, type SelectedAddon } from "../pos-shared/AddonPickerDialog";
import type { CartItem, CompletedSale, PosCustomer } from "../pos-shared/types";

interface OrderType { id: string; key: string; name: string; nameEn?: string | null }

async function authFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export default function GridPosTemplate() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [selectedOrderType, setSelectedOrderType] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [addonProduct, setAddonProduct] = useState<{ id: number; name: string; sellingPrice: number; includesTax: boolean } | null>(null);

  const { data: products } = useGetProducts(
    search ? { search } : (selectedCategoryId ? { categoryId: selectedCategoryId as any } : undefined),
  );
  const { data: categories } = useGetCategories();
  const { data: customers } = useGetCustomers();
  const customerList = (customers ?? []) as unknown as PosCustomer[];
  const { data: settings } = useGetSettings();
  const createSale = useCreateSale();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  useEffect(() => {
    authFetch("/order-types").then((types: OrderType[]) => {
      setOrderTypes(types);
      if (types.length > 0) setSelectedOrderType(types[0].key);
    });
  }, []);

  const taxRate = Number(settings?.taxRate ?? 0);
  const currency = settings?.currency ?? "SAR";
  const fmt = (n: number) => `${currency} ${n.toFixed(2)}`;

  const getItemFinalPrice = (item: CartItem) =>
    item.includesTax ? item.unitPrice : item.unitPrice * (1 + taxRate / 100);
  const getItemTotal = (item: CartItem) => getItemFinalPrice(item) * item.quantity - item.discount;

  const addLineToCart = (product: { id: number; name: string; sellingPrice: any; includesTax?: boolean }, addons: SelectedAddon[] = [], notes = "") => {
    const addonTotal = addons.reduce((s, a) => s + a.priceDelta, 0);
    const effectivePrice = Number(product.sellingPrice) + addonTotal;
    setCart(prev => {
      // Lines with different addons/notes must stay separate — only merge an
      // identical no-customization tap with an existing identical line.
      if (addons.length === 0 && !notes) {
        const existing = prev.find(i => i.productId === product.id && (!i.selectedAddons || i.selectedAddons.length === 0) && !i.itemNotes);
        if (existing) {
          return prev.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
        }
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        unitPrice: effectivePrice,
        includesTax: product.includesTax ?? false,
        quantity: 1,
        discount: 0,
        selectedAddons: addons.length > 0 ? addons : undefined,
        itemNotes: notes || undefined,
      }];
    });
  };

  const handleProductTap = (product: any) => {
    if (product.hasAddons) {
      setAddonProduct({ id: product.id, name: product.name, sellingPrice: product.sellingPrice, includesTax: product.includesTax });
    } else {
      addLineToCart(product);
    }
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };
  const removeFromCart = (productId: number) => setCart(prev => prev.filter(i => i.productId !== productId));
  const startEditPrice = (item: CartItem) => { setEditingPrice(item.productId); setEditPriceValue(item.unitPrice.toFixed(2)); };
  const confirmEditPrice = (productId: number) => {
    const val = parseFloat(editPriceValue);
    if (!isNaN(val) && val >= 0) setCart(prev => prev.map(i => i.productId === productId ? { ...i, unitPrice: val } : i));
    setEditingPrice(null);
  };

  const taxAmount = cart.reduce((sum, item) => item.includesTax ? sum : sum + (item.unitPrice * (taxRate / 100) * item.quantity), 0);
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
      selectedAddons: i.selectedAddons,
      itemNotes: i.itemNotes,
    }));
    const customerName = selectedCustomerName || t("pos.walk_in");
    const customerPhone = customerList.find(c => c.id === selectedCustomerId)?.phone ?? null;
    const cartSnapshot = [...cart];
    const totalSnapshot = total;

    createSale.mutate(
      { data: { items, paymentMethod: method, amountPaid: total, discount: 0, customerId: selectedCustomerId ?? undefined, orderType: selectedOrderType ?? undefined } as any },
      {
        onSuccess: (sale: any) => {
          setCart([]);
          setSelectedCustomerId(null);
          setSelectedCustomerName("");
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          setCompletedSale({
            id: sale.id, total: totalSnapshot, paymentMethod: method, customerName, customerPhone,
            itemCount: cartSnapshot.reduce((s, i) => s + i.quantity, 0),
            cartItems: cartSnapshot.map(i => ({ productName: i.productName, quantity: i.quantity, unitPrice: getItemFinalPrice(i), subtotal: getItemTotal(i) })),
            createdAt: new Date().toISOString(),
          });
          setIsProcessing(false);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? t("pos.sale_failed");
          setCompletedSale(null);
          setIsProcessing(false);
          alert(`${t("pos.sale_failed")}: ${msg}`);
        },
      },
    );
  };

  if (completedSale) {
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
              <Button size="lg" className="h-14 w-full bg-primary" onClick={() => setCompletedSale(null)}>
                <ShoppingBag className="me-2 h-5 w-5" /><span className="font-bold">{t("pos.new_sale")}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PosLayoutShell
        productArea={
          <>
            {orderTypes.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {orderTypes.map(ot => (
                  <button
                    key={ot.key}
                    type="button"
                    onClick={() => setSelectedOrderType(ot.key)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors",
                      selectedOrderType === ot.key ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50",
                    )}
                  >
                    {ot.name}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute start-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input className="ps-10 h-11 bg-background" placeholder={t("pos.search_placeholder")} value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {!search && categories && categories.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border", !selectedCategoryId ? "bg-primary/10 border-primary text-primary" : "border-border")}
                >
                  {t("pos.all_categories")}
                </button>
                {categories.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border", selectedCategoryId === c.id ? "bg-primary/10 border-primary text-primary" : "border-border")}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-4">
                {products?.map((product: any) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductTap(product)}
                    className="flex flex-col items-center gap-2 rounded-xl border p-3 hover:border-primary hover:bg-muted/30 transition-colors select-none"
                  >
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-bold text-2xl text-muted-foreground">{product.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-center line-clamp-2">{product.name}</div>
                    <div className="text-primary font-bold text-sm">{fmt(Number(product.sellingPrice))}</div>
                  </button>
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
      {addonProduct && (
        <AddonPickerDialog
          productId={addonProduct.id}
          productName={addonProduct.name}
          open={!!addonProduct}
          onClose={() => setAddonProduct(null)}
          onConfirm={(addons, notes) => {
            addLineToCart(addonProduct, addons, notes);
            setAddonProduct(null);
          }}
        />
      )}
    </>
  );
}
