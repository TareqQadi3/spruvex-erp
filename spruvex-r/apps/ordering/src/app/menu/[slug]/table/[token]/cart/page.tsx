import { notFound } from "next/navigation";

import { CartProvider } from "@/components/CartProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { MenuHeader } from "@/components/MenuHeader";
import { apiGet, ApiError } from "@/lib/api";
import type { Locale } from "@/lib/dictionaries";
import type { TableInfo } from "@/lib/types";
import { TableCartClient } from "./TableCartClient";

export const dynamic = "force-dynamic";

export default async function TableCartPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { token } = await params;

  let info: TableInfo;
  try {
    info = await apiGet<TableInfo>(`/public/tables/${token}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
      notFound();
    }
    throw error;
  }

  return (
    <LocaleProvider initialLocale={info.restaurant.defaultLocale as Locale}>
      <CartProvider scope={`table:${token}`}>
        <MenuHeader
          logoUrl={info.restaurant.logoUrl}
          name={info.restaurant.name}
          nameEn={info.restaurant.nameEn}
          subtitle={`${info.branch.name} · ${info.table.number}`}
        />
        <TableCartClient qrToken={token} currency={info.restaurant.currency} />
      </CartProvider>
    </LocaleProvider>
  );
}
