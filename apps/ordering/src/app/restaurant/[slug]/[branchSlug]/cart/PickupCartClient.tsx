"use client";

import { CartPageContent } from "@/components/CartPageContent";
import { useLocale } from "@/components/LocaleProvider";
import { clientPost } from "@/lib/client-api";
import type { GuestOrderResult } from "@/lib/types";

export function PickupCartClient({
  slug,
  branchSlug,
  currency,
}: {
  slug: string;
  branchSlug: string;
  currency: string;
}) {
  const { t } = useLocale();

  return (
    <CartPageContent
      currency={currency}
      requirePhone
      notice={t("cart.pickupNotice")}
      onSubmit={(ctx) =>
        clientPost<GuestOrderResult>(
          `/public/restaurants/${slug}/branches/${branchSlug}/orders`,
          {
            items: ctx.items,
            customerPhone: ctx.customerPhone,
            ...(ctx.customerName ? { customerName: ctx.customerName } : {}),
            ...(ctx.notes ? { notes: ctx.notes } : {}),
          },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      }
    />
  );
}
