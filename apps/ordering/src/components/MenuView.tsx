"use client";

import { useMemo, useState } from "react";

import { useLocale } from "./LocaleProvider";
import { CategoryNav } from "./CategoryNav";
import { ProductCard } from "./ProductCard";
import type { Menu } from "@/lib/types";

export function MenuView({ menu, currency }: { menu: Menu; currency: string }) {
  const { t } = useLocale();
  const categoriesWithProducts = useMemo(
    () => menu.categories.filter((c) => menu.products.some((p) => p.categoryId === c.id)),
    [menu],
  );
  const [activeId, setActiveId] = useState<string | null>(
    categoriesWithProducts[0]?.id ?? null,
  );

  if (menu.products.length === 0) {
    return <p className="p-8 text-center text-muted-foreground">{t("menu.empty")}</p>;
  }

  const visibleProducts = activeId
    ? menu.products.filter((p) => p.categoryId === activeId)
    : menu.products;

  return (
    <>
      <CategoryNav
        categories={categoriesWithProducts}
        activeId={activeId}
        onSelect={setActiveId}
      />
      <div className="space-y-3 p-4">
        {visibleProducts.map((product) => (
          <ProductCard key={product.id} product={product} currency={currency} />
        ))}
      </div>
    </>
  );
}
