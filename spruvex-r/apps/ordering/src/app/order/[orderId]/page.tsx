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

  // Read at request time (not build time) — this is the API's public
  // origin, reachable from the customer's own browser for the realtime
  // order-tracking socket. Deliberately not a NEXT_PUBLIC_* var: those get
  // inlined into the client bundle at build time, which most container
  // platforms (this repo's docker-compose.prod.yml included) can't easily
  // pass in without a registry round-trip. Passing it down as a prop keeps
  // the same Docker image deployable anywhere, configured purely at runtime.
  const rawPublicApiOrigin = process.env.PUBLIC_API_ORIGIN ?? "http://localhost:3000";
  const publicApiOrigin = rawPublicApiOrigin.includes("://")
    ? rawPublicApiOrigin
    : `https://${rawPublicApiOrigin}`;

  return (
    <LocaleProvider initialLocale={order.restaurant.defaultLocale as Locale}>
      <OrderTrackerClient orderId={orderId} initialOrder={order} publicApiOrigin={publicApiOrigin} />
    </LocaleProvider>
  );
}
