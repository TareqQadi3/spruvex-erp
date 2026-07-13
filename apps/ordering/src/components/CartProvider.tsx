"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CartLine } from "@/lib/cart";
import type { MenuModifier, MenuProduct } from "@/lib/types";

interface CartState {
  lines: CartLine[];
  addLine: (product: MenuProduct, modifiers: MenuModifier[], notes?: string) => void;
  removeLine: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);

function storageKey(scope: string): string {
  return `spruvex:ordering:cart:${scope}`;
}

/** One cart per table/branch scope so switching QR codes doesn't mix orders. */
export function CartProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(scope));
      setLines(raw ? (JSON.parse(raw) as CartLine[]) : []);
    } catch {
      setLines([]);
    }
    setHydrated(true);
  }, [scope]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey(scope), JSON.stringify(lines));
  }, [lines, scope, hydrated]);

  const addLine = useCallback(
    (product: MenuProduct, modifiers: MenuModifier[], notes?: string) => {
      setLines((current) => [
        ...current,
        { lineId: crypto.randomUUID(), product, quantity: 1, modifiers, notes },
      ]);
    },
    [],
  );

  const removeLine = useCallback((lineId: string) => {
    setLines((current) => current.filter((line) => line.lineId !== lineId));
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setLines((current) =>
      current
        .map((line) => (line.lineId === lineId ? { ...line, quantity } : line))
        .filter((line) => line.quantity > 0),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(
    () => ({ lines, addLine, removeLine, setQuantity, clear }),
    [lines, addLine, removeLine, setQuantity, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
