import { notFound } from "next/navigation";

import { LocaleProvider } from "@/components/LocaleProvider";
import { MenuHeader } from "@/components/MenuHeader";
import { RestaurantBranchList } from "./RestaurantBranchList";
import { apiGet, ApiError } from "@/lib/api";
import type { Locale } from "@/lib/dictionaries";
import type { RestaurantInfo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let info: RestaurantInfo;
  try {
    info = await apiGet<RestaurantInfo>(`/public/restaurants/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <LocaleProvider initialLocale={info.restaurant.defaultLocale as Locale}>
      <MenuHeader
        logoUrl={info.restaurant.logoUrl}
        name={info.restaurant.name}
        nameEn={info.restaurant.nameEn}
      />
      <RestaurantBranchList slug={slug} branches={info.branches} />
      {info.branches.length === 0 && (
        <p className="p-8 text-center text-muted-foreground">—</p>
      )}
    </LocaleProvider>
  );
}
