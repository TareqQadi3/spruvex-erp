import { notFound } from "next/navigation";

import { CartProvider } from "@/components/CartProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { MenuHeader } from "@/components/MenuHeader";
import { apiGet, ApiError } from "@/lib/api";
import type { Locale } from "@/lib/dictionaries";
import type { RestaurantInfo } from "@/lib/types";
import { PickupCartClient } from "./PickupCartClient";

export const dynamic = "force-dynamic";

export default async function PickupCartPage({
  params,
}: {
  params: Promise<{ slug: string; branchSlug: string }>;
}) {
  const { slug, branchSlug } = await params;

  let info: RestaurantInfo;
  try {
    info = await apiGet<RestaurantInfo>(`/public/restaurants/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
  const branch = info.branches.find((b) => b.slug === branchSlug);
  if (!branch) {
    notFound();
  }

  return (
    <LocaleProvider initialLocale={info.restaurant.defaultLocale as Locale}>
      <CartProvider scope={`pickup:${slug}:${branchSlug}`}>
        <MenuHeader
          logoUrl={info.restaurant.logoUrl}
          name={info.restaurant.name}
          nameEn={info.restaurant.nameEn}
          subtitle={branch.name}
        />
        <PickupCartClient
          slug={slug}
          branchSlug={branchSlug}
          currency={info.restaurant.currency}
        />
      </CartProvider>
    </LocaleProvider>
  );
}
