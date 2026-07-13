import { notFound } from "next/navigation";

import { LocaleProvider } from "@/components/LocaleProvider";
import { apiGet, ApiError } from "@/lib/api";
import type { Locale } from "@/lib/dictionaries";
import type { TrackedOrder } from "@/lib/types";
import { OrderTrackerClient } from "./OrderTrackerClient";

export const dynamic = "force-dynamic";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  let order: TrackedOrder;
  try {
    order = await apiGet<TrackedOrder>(`/public/orders/${orderId}/track`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <LocaleProvider initialLocale={order.restaurant.defaultLocale as Locale}>
      <OrderTrackerClient orderId={orderId} initialOrder={order} />
    </LocaleProvider>
  );
}
