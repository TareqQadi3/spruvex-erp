"use client";

import { CartPageContent } from "@/components/CartPageContent";
import { useLocale } from "@/components/LocaleProvider";
import { clientPost } from "@/lib/client-api";
import type { GuestOrderResult } from "@/lib/types";

export function TableCartClient({ qrToken, currency }: { qrToken: string; currency: string }) {
  const { t } = useLocale();

  return (
    <CartPageContent
      currency={currency}
      requirePhone={false}
      notice={t("cart.dineInNotice")}
      onSubmit={(ctx) =>
        clientPost<GuestOrderResult>(
          `/public/tables/${qrToken}/orders`,
          {
            items: ctx.items,
            ...(ctx.customerName ? { customerName: ctx.customerName } : {}),
            ...(ctx.notes ? { notes: ctx.notes } : {}),
          },
          { "Idempotency-Key": crypto.randomUUID() },
        )
      }
    />
  );
}
