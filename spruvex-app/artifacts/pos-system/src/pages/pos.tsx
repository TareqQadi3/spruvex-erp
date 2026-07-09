import { useState } from "react";
import {
  useGetProducts, useGetCustomers, useCreateSale,
  useGetSettings, getGetDashboardStatsQueryKey,
} from "@workspace/api-client-react";
import { printInvoice } from "@/utils/printInvoice";
import { emailInvoice, whatsappInvoice } from "@/utils/shareInvoice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, CreditCard, Banknote, UserPlus, Pencil, Check, X, Printer, ShoppingBag, CheckCircle2, Save, Mail, MessageCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/i18n";
import { QuickAddCustomerDialog } from "@/components/QuickAddCustomerDialog";

interface CartItem {
  productId: number;
  productName: string;
  unitPrice: number;
  includesTax: boolean;
  quantity: number;
  discount: number;
}

interface CompletedSale {
  id: number;
  total: number;
  paymentMethod: "cash" | "card";
  customerName: string;
  customerPhone?: string | null;
  itemCount: number;
  cartItems: Array<{ productName: string; quantity: number; unitPrice: number; subtotal: number }>;
  createdAt: string;
}

export default function PosPage() {
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: products } = useGetProducts(search ? { search } : undefined);
  const { data: customers } = useGetCustomers();
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
    const customerPhone = customers?.find(c => c.id === selectedCustomerId)?.phone ?? null;
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
        }
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
    <div className="h-[calc(100vh-6rem)] flex gap-4">
      {/* Products grid */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
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
      </div>

      {/* Cart */}
      <Card className="w-96 flex flex-col bg-background/50 border-sidebar-border shrink-0">
        <CardHeader className="py-3 px-4 border-b bg-card">
          <CardTitle className="text-base">{t("pos.current_sale")}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
          {/* Customer selector */}
          <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("pos.customer")}</div>
            <div className="flex gap-2">
              <Select
                value={selectedCustomerId ? String(selectedCustomerId) : "__walk_in__"}
                onValueChange={val => {
                  if (val === "__walk_in__") {
                    setSelectedCustomerId(null);
                    setSelectedCustomerName("");
                  } else {
                    const c = customers?.find(c => c.id === Number(val));
                    setSelectedCustomerId(Number(val));
                    setSelectedCustomerName(c?.name ?? "");
                  }
                }}
              >
                <SelectTrigger className="flex-1 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__walk_in__">{t("pos.walk_in")}</SelectItem>
                  {customers?.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}{c.phone ? ` — ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <QuickAddCustomerDialog
                onCreated={c => {
                  setSelectedCustomerId(c.id);
                  setSelectedCustomerName(c.name);
                }}
                trigger={
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
            {selectedCustomerName && (
              <div className="text-xs text-primary font-medium">{selectedCustomerName}</div>
            )}
          </div>

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
                        onClick={() => removeFromCart(item.productId)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Price editing */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground text-xs">{t("pos.unit_price")}:</span>
                      {editingPrice === item.productId ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={editPriceValue}
                            onChange={e => setEditPriceValue(e.target.value)}
                            className="h-6 text-xs px-2 w-24"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === "Enter") confirmEditPrice(item.productId);
                              if (e.key === "Escape") setEditingPrice(null);
                            }}
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => confirmEditPrice(item.productId)}>
                            <Check className="h-3 w-3 text-green-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingPrice(null)}>
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                          onClick={() => startEditPrice(item)}
                        >
                          <span className="font-medium">{fmt(item.unitPrice)}</span>
                          <Pencil className="h-3 w-3 opacity-60" />
                        </button>
                      )}
                      {!item.includesTax && taxRate > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 ms-auto">+{taxRate}%</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-7 text-center text-sm font-medium">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.productId, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="font-bold text-sm">{fmt(getItemTotal(item))}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Totals + checkout */}
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
                  onClick={() => handleCheckout("cash")}
                  disabled={cart.length === 0}
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
                  onClick={() => handleCheckout("card")}
                  disabled={cart.length === 0}
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
        </CardContent>
      </Card>
    </div>
  );
}
