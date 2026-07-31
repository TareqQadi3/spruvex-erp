import { useEffect, useState } from "react";
import {
  useGetProducts, useGetCustomers,
  useGetSettings, useGetCategories,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, X, ShoppingCart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
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

/**
 * Photo-driven POS layout for clothing, shoes, perfume and other image-first
 * retailers: products appear as large photo tiles; tapping one opens a big
 * detail view before anything is added to the shared cart. Reuses CartPanel +
 * PosSuccessScreen so checkout behaves identically to every other template.
 */
export function ImagePosTemplate({ onUseListTemplate }: { onUseListTemplate: () => void }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [selectedOrderType, setSelectedOrderType] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [detailProduct, setDetailProduct] = useState<any | null>(null);
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

  const handleDetailAdd = (product: any) => {
    if (product.hasAddons) {
      setAddonProduct({ id: product.id, name: product.name, sellingPrice: product.sellingPrice, includesTax: product.includesTax });
    } else {
      addLineToCart(product);
      setDetailProduct(null);
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
              {products && products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                  {products.map((product: any) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => setDetailProduct(product)}
                      className="group flex flex-col overflow-hidden rounded-xl border bg-background hover:border-primary hover:shadow-sm transition-all select-none"
                    >
                      <div className="relative aspect-square bg-muted">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <span className="font-bold text-4xl text-muted-foreground">{product.name.charAt(0)}</span>
                          </div>
                        )}
                        {Number(product.stock) <= 0 && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <span className="text-sm font-bold text-destructive">{t("pos.out_of_stock")}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-start">
                        <div className="text-sm font-medium line-clamp-2 leading-snug">{product.name}</div>
                        <div className="text-primary font-bold text-sm mt-1">{fmt(Number(product.sellingPrice))}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-muted-foreground">{t("pos.no_products")}</div>
              )}
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

      {detailProduct && (
        <Dialog open={!!detailProduct} onOpenChange={v => !v && setDetailProduct(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle className="line-clamp-1">{detailProduct.name}</DialogTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setDetailProduct(null)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogHeader>
            <div className="rounded-xl overflow-hidden border bg-muted aspect-video">
              {detailProduct.imageUrl ? (
                <img src={detailProduct.imageUrl} alt={detailProduct.name} className="h-full w-full object-contain" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <span className="font-bold text-5xl text-muted-foreground">{detailProduct.name.charAt(0)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-primary">{fmt(Number(detailProduct.sellingPrice))}</div>
              {Number(detailProduct.stock) > 0 ? (
                <span className="text-xs text-muted-foreground">{t("pos.stock", { count: detailProduct.stock })}</span>
              ) : (
                <span className="text-xs font-semibold text-destructive">{t("pos.out_of_stock")}</span>
              )}
            </div>
            {detailProduct.description && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{detailProduct.description}</p>
            )}
            <DialogFooter>
              <Button
                size="lg"
                className="w-full"
                disabled={Number(detailProduct.stock) <= 0}
                onClick={() => handleDetailAdd(detailProduct)}
              >
                <ShoppingCart className="me-2 h-4 w-4" />
                {t("pos.add_to_cart")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {addonProduct && (
        <AddonPickerDialog
          productId={addonProduct.id}
          productName={addonProduct.name}
          open={!!addonProduct}
          onClose={() => setAddonProduct(null)}
          onConfirm={(addons, notes) => {
            addLineToCart(addonProduct, addons, notes);
            setAddonProduct(null);
            setDetailProduct(null);
          }}
        />
      )}
    </>
  );
}
