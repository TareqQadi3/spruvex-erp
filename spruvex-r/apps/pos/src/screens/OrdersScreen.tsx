import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { io, type Socket } from "socket.io-client";

import { Badge, Button, Card, CardContent, Dialog, Input, Spinner } from "@spruvex-r/ui";

import { ApiError } from "../lib/api";
import { getAccessToken, tryRefresh } from "../lib/api";
import { posApi, type ActiveOrder } from "../lib/pos-api";
import { printHtml } from "../lib/print";
import { DiscountDialog } from "../components/DiscountDialog";
import { PaymentDialog } from "../components/PaymentDialog";

const ACTIVE = ["new", "confirmed", "preparing", "ready", "served"];

const STATUS_BADGE: Record<string, "success" | "destructive" | "default" | "muted"> = {
  new: "destructive",
  confirmed: "default",
  preparing: "default",
  ready: "success",
  served: "success",
};

function prepTicketHtml(order: ActiveOrder): string {
  const lines = order.items
    .map(
      (item) => `
      <div class="item">
        <div class="big">${item.quantity}× ${item.productSnapshot.name}</div>
        ${item.modifiers.map((m) => `<div class="mods">+ ${m.modifierSnapshot.name}</div>`).join("")}
        ${item.notes ? `<div class="mods">✎ ${item.notes}</div>` : ""}
      </div>`,
    )
    .join("");
  return `
    <h1>#${order.orderNumber}</h1>
    <p class="center">${order.table ? `طاولة ${order.table.number}` : order.type}</p>
    <p class="center muted" dir="ltr">${new Date(order.createdAt).toLocaleTimeString()}</p>
    <div class="line"></div>
    ${lines}
    ${order.notes ? `<div class="line"></div><p>${order.notes}</p>` : ""}`;
}

export function OrdersScreen({ branchId }: { branchId: string }) {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<ActiveOrder | null>(null);
  const [discounting, setDiscounting] = useState<ActiveOrder | null>(null);
  const [cancelling, setCancelling] = useState<ActiveOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async () => {
    setOrders(await posApi.activeOrders(branchId));
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    void load();
    let disposed = false;

    void (async () => {
      if (!getAccessToken()) await tryRefresh();
      if (disposed) return;
      const socket = io({ transports: ["websocket"], auth: { token: getAccessToken() } });
      socketRef.current = socket;
      socket.on("connect", async () => {
        await socket.emitWithAck("subscribe", { channel: "orders" });
        void load();
      });
      const merge = (incoming: ActiveOrder) => {
        setOrders((current) => {
          const without = current.filter((order) => order.id !== incoming.id);
          if (!ACTIVE.includes(incoming.status)) return without;
          return [...without, incoming].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        });
      };
      socket.on("order.created", merge);
      socket.on("order.updated", merge);
    })();

    return () => {
      disposed = true;
      socketRef.current?.disconnect();
    };
  }, [branchId, load]);

  const name = (item: { name: string; nameEn: string | null }) =>
    i18n.language === "en" && item.nameEn ? item.nameEn : item.name;

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      void load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : t("common.error"));
    }
  }

  if (loading) return <Spinner className="m-8 h-8 w-8" />;

  const visible = orders;

  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {visible.length === 0 && (
        <p className="col-span-full p-8 text-center text-muted-foreground">{t("orders.empty")}</p>
      )}
      {visible.map((order) => {
        const paid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return (
          <Card key={order.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xl font-extrabold" dir="ltr">
                  #{order.orderNumber}
                </span>
                <div className="flex items-center gap-2">
                  {order.table && <Badge>{t("pos.table", { number: order.table.number })}</Badge>}
                  <Badge variant={STATUS_BADGE[order.status] ?? "muted"}>
                    {t(`orders.status.${order.status}`)}
                  </Badge>
                </div>
              </div>

              <ul className="space-y-1 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>
                      {item.quantity}× {name(item.productSnapshot)}
                      {item.modifiers.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          ({item.modifiers.map((m) => name(m.modifierSnapshot)).join("، ")})
                        </span>
                      )}
                    </span>
                    <span dir="ltr">{item.lineTotal}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span>
                  {Number(order.discount) > 0 && (
                    <Badge variant="muted">-{order.discount}</Badge>
                  )}
                </span>
                <span className="text-lg font-bold text-primary" dir="ltr">
                  {order.total} {t("pos.sar")}
                </span>
              </div>
              {paid > 0 && (
                <p className="text-xs text-muted-foreground" dir="ltr">
                  {t("payment.paid")}: {paid.toFixed(2)}
                </p>
              )}

              <div className="flex flex-wrap gap-1 pt-1">
                {order.status === "new" && (
                  <Button
                    size="sm"
                    onClick={() => act(() => posApi.transition(order.id, "confirmed"))}
                  >
                    {t("orders.confirmOrder")}
                  </Button>
                )}
                {order.status !== "new" && (
                  <Button size="sm" onClick={() => setPaying(order)}>
                    {t("orders.pay")}
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setDiscounting(order)}>
                  {t("orders.discount")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printHtml(`#${order.orderNumber}`, prepTicketHtml(order))}
                >
                  {t("orders.prepTicket")}
                </Button>
                {["new", "confirmed", "preparing"].includes(order.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => {
                      setCancelReason("");
                      setCancelling(order);
                    }}
                  >
                    {t("orders.cancelOrder")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {paying && (
        <PaymentDialog
          orderId={paying.id}
          orderNumber={paying.orderNumber}
          onClose={() => {
            setPaying(null);
            void load();
          }}
          onCompleted={() => void load()}
        />
      )}
      {discounting && (
        <DiscountDialog
          orderId={discounting.id}
          onClose={() => setDiscounting(null)}
          onApplied={() => void load()}
        />
      )}
      <Dialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={t("orders.cancelOrder")}
      >
        <div className="space-y-4">
          <Input
            placeholder={t("orders.cancelReason")}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <Button
            variant="destructive"
            className="w-full"
            disabled={!cancelReason}
            onClick={() => {
              const order = cancelling;
              setCancelling(null);
              if (order) {
                void act(() => posApi.transition(order.id, "cancelled", cancelReason));
              }
            }}
          >
            {t("orders.cancelOrder")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
