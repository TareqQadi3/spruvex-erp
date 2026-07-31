import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateSale, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import type {
  CartItem, CompletedSale, CheckoutPayload, PaymentMethodOption, PosCustomer, HeldCart,
} from "./types";

export interface ActiveCashSession {
  id: string;
  status: string;
  openingBalance: number;
  totalSales: number;
}

const HELD_CARTS_KEY = "pos_held_carts";

/**
 * One hook to power checkout in all four POS templates: tenant payment methods,
 * the active cash session, suspend/restore of held carts, and the createSale
 * mutation (full checkout + draft save). Templates keep only their product-
 * picking logic and reset their own cart state on success.
 */
export function usePosSale(options: {
  getItemFinalPrice: (item: CartItem) => number;
  getItemTotal: (item: CartItem) => number;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const createSale = useCreateSale();
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: paymentMethods = [] } = useQuery<PaymentMethodOption[]>({
    queryKey: ["payment-methods"],
    queryFn: () => api("/payment-methods"),
    staleTime: 60_000,
  });

  const { data: activeSession } = useQuery<ActiveCashSession | null>({
    queryKey: ["cash-sessions", "active"],
    queryFn: async () => {
      try {
        return await api("/cash-sessions/active");
      } catch {
        return null;
      }
    },
    staleTime: 30_000,
  });

  // ─── held carts (suspend / restore) ───────────────────────────────────────

  const [heldCarts, setHeldCarts] = useState<HeldCart[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HELD_CARTS_KEY) ?? "[]") as HeldCart[];
    } catch {
      return [];
    }
  });

  const persistHeldCarts = (carts: HeldCart[]) => {
    setHeldCarts(carts);
    try {
      localStorage.setItem(HELD_CARTS_KEY, JSON.stringify(carts));
    } catch {
      // localStorage unavailable (private mode) — held carts just won't persist
    }
  };

  const suspendCart = (label: string, items: CartItem[], discount: number) => {
    const stamp = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    persistHeldCarts([...heldCarts, {
      id: `${Date.now()}`,
      label: (label.trim() || t("pos.held_sale")) + ` · ${stamp}`,
      items: items.map(i => ({ ...i })),
      discount,
      createdAt: new Date().toISOString(),
    }]);
  };

  const restoreHeldCart = (id: string): HeldCart | undefined => {
    const found = heldCarts.find(c => c.id === id);
    if (found) persistHeldCarts(heldCarts.filter(c => c.id !== id));
    return found;
  };

  const removeHeldCart = (id: string) => {
    persistHeldCarts(heldCarts.filter(c => c.id !== id));
  };

  // ─── createSale mutation (full + draft) ───────────────────────────────────

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["cash-sessions"] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  }, [queryClient]);

  const mapItems = (cart: CartItem[]) => cart.map(i => ({
    productId: i.productId,
    productName: i.productName,
    unitPrice: options.getItemFinalPrice(i),
    quantity: i.quantity,
    discount: i.discount,
    selectedAddons: i.selectedAddons,
    itemNotes: i.itemNotes,
    serialNumber: i.serialNumber,
  }));

  const submitSale = (args: {
    cart: CartItem[];
    customer?: PosCustomer | null;
    discount?: number;
    orderType?: string;
    payload: CheckoutPayload;
    onSuccess?: (sale: any) => void;
  }) => {
    if (args.cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    const items = mapItems(args.cart);
    const cartSnapshot = [...args.cart];
    const totalSnapshot = cartSnapshot.reduce((s, i) => s + options.getItemTotal(i), 0);
    const customerName = args.customer?.name ?? t("pos.walk_in");

    createSale.mutate(
      {
        data: {
          items,
          paymentMethod: args.payload.paymentMethod,
          paymentMethodId: args.payload.paymentMethodId,
          amountPaid: args.payload.amountPaid,
          payments: args.payload.payments,
          customerId: args.customer?.id ?? undefined,
          cashSessionId: activeSession?.id ?? undefined,
          discount: args.discount ?? 0,
          orderType: args.orderType ?? undefined,
        } as any,
      },
      {
        onSuccess: (sale: any) => {
          invalidate();
          const total = Number(sale.total) || totalSnapshot;
          const paid = Number(sale.amountPaid) || args.payload.amountPaid;
          const label =
            args.payload.kind === "on_account"
              ? t("pos.on_account")
              : args.payload.paymentMethod === "mixed"
                ? t("pos.mixed")
                : args.payload.paymentMethod;
          setCompletedSale({
            id: sale.id,
            total,
            amountPaid: paid,
            outstanding: Math.max(Math.round((total - paid) * 100) / 100, 0),
            paymentMethod: label,
            paymentMethodId: args.payload.paymentMethodId ?? null,
            customerName,
            customerPhone: args.customer?.phone ?? null,
            itemCount: cartSnapshot.reduce((s, i) => s + i.quantity, 0),
            cartItems: cartSnapshot.map(i => ({
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: options.getItemFinalPrice(i),
              subtotal: options.getItemTotal(i),
            })),
            createdAt: new Date().toISOString(),
          });
          args.onSuccess?.(sale);
          setIsProcessing(false);
        },
        onError: (err: any) => {
          setIsProcessing(false);
          const msg = err?.response?.data?.error ?? err?.message ?? t("pos.sale_failed");
          alert(`${t("pos.sale_failed")}: ${msg}`);
        },
      },
    );
  };

  // Save the current cart as a draft (no stock/ledger effect until approved).
  const saveDraft = (args: {
    cart: CartItem[];
    customer?: PosCustomer | null;
    discount?: number;
    orderType?: string;
    onSuccess?: () => void;
  }) => {
    if (args.cart.length === 0 || isProcessing) return;
    setIsProcessing(true);
    const items = mapItems(args.cart);
    createSale.mutate(
      {
        data: {
          items,
          paymentMethod: "draft",
          amountPaid: 0,
          status: "draft",
          customerId: args.customer?.id ?? undefined,
          discount: args.discount ?? 0,
          orderType: args.orderType ?? undefined,
        } as any,
      },
      {
        onSuccess: () => {
          invalidate();
          args.onSuccess?.();
          alert(t("pos.draft_saved"));
          setIsProcessing(false);
        },
        onError: (err: any) => {
          setIsProcessing(false);
          const msg = err?.response?.data?.error ?? err?.message ?? t("pos.sale_failed");
          alert(`${t("pos.sale_failed")}: ${msg}`);
        },
      },
    );
  };

  return {
    paymentMethods,
    activeSession,
    heldCarts,
    suspendCart,
    restoreHeldCart,
    removeHeldCart,
    isProcessing,
    completedSale,
    setCompletedSale,
    submitSale,
    saveDraft,
    invalidate,
  };
}
