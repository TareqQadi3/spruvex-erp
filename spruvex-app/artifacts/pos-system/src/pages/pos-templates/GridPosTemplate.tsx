import { useEffect, useState } from "react";
import {
  useGetProducts, useGetCustomers,
  useGetSettings, useGetCategories,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { PosLayoutShell } from "../pos-shared/PosLayoutShell";
import { CartPanel } from "../pos-shared/CartPanel";
import { PosSuccessScreen } from "../pos-shared/PosSuccessScreen";
import { AddonPickerDialog, type SelectedAddon } from "../pos-shared/AddonPickerDialog";
import { usePosSale } from "../pos-shared/usePosSale";
import type { CartItem, PosCustomer, CheckoutPayload } from "../pos-shared/types";

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
  const [addonProduct, setAddonProduct] = useState<{ id: number; name: string; sellingPrice: number; includesTax: boolean } | null>(null);

  const { data: products } = useGetProducts(
    search ? { search } : (selectedCategoryId ? { categoryId: selectedCategoryId as any } : undefined),
  );
  const { data: categories } = useGetCategories();
  const { data: customers } = useGetCustomers();
  const customerList = (customers ?? []) as unknown as PosCustomer[];
  const { data: settings } = useGetSettings();
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

  const sale = usePosSale({ getItemFinalPrice, getItemTotal });

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

  const selectedCustomer = customerList.find(c => c.id === selectedCustomerId) ?? null;

  const resetAfterSale = () => {
    setCart([]);
    setSelectedCustomerId(null);
    setSelectedCustomerName("");
  };

  const handleCheckout = (payload: CheckoutPayload) => {
    sale.submitSale({
      cart,
      customer: selectedCustomer,
      discount: 0,
      orderType: selectedOrderType ?? undefined,
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
      setSelectedCustomerId(null);
      setSelectedCustomerName("");
    }
  };

  if (sale.completedSale) {
    return <PosSuccessScreen completedSale={sale.completedSale} fmt={fmt} onNewSale={() => sale.setCompletedSale(null)} />;
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
