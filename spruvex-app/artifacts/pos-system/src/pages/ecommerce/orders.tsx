import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import {
  RefreshCw, ArrowRight, PackageCheck, Eye, ShoppingBag, Store, Ban, AlertTriangle, Plug,
} from "lucide-react";

interface EcommerceOrder {
  id: string;
  connectionId: string;
  externalOrderId: string;
  externalOrderNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  total: string;
  currency: string;
  status: string;
  payload: {
    externalOrderId: string;
    externalOrderNumber?: string;
    customerName?: string;
    customerPhone?: string;
    currency?: string;
    total: number;
    items: { externalProductId: string; name: string; quantity: number; unitPrice: number }[];
    raw?: unknown;
  } | null;
  errorMessage: string | null;
  saleId: string | null;
  importedAt: string | null;
  createdAt: string;
}

interface Connection {
  id: string;
  platform: string;
  status: string;
  storeUrl: string | null;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

interface PaymentMethodOption {
  id: number;
  name: string;
  percentFee: string;
  fixedFee: string;
  isActive: boolean;
}

const STATUS_STYLES: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  received: "secondary",
  importing: "outline",
  imported: "default",
  failed: "destructive",
  ignored: "outline",
};

export default function EcommerceOrdersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [viewOrder, setViewOrder] = useState<EcommerceOrder | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  const { data: connections } = useQuery<Connection[]>({
    queryKey: ["ecommerce-connections"],
    queryFn: () => api<{ data: Connection[] }>("/ecommerce/connections").then(r => r.data),
  });

  const { data: paymentMethods } = useQuery<PaymentMethodOption[]>({
    queryKey: ["payment-methods"],
    queryFn: () => api("/payment-methods"),
  });

  const { data, isLoading, refetch } = useQuery<Paginated<EcommerceOrder>>({
    queryKey: ["ecommerce-orders", status],
    queryFn: () => api(`/ecommerce/orders?page=1&pageSize=100${status ? `&status=${status}` : ""}`),
  });

  const orders = data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ecommerce-orders"] });

  const pullMutation = useMutation({
    mutationFn: (connectionId: string) => api(`/ecommerce/connections/${connectionId}/pull-orders`, { method: "POST" }),
    onSuccess: (res: { data: { pulled: number; staged: number; duplicates: number } }) => {
      toast.success(t("ecommerce.pull_success", { count: res.data.staged }));
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: (order: EcommerceOrder) => {
      setImportingId(order.id);
      const method = (paymentMethods ?? []).find(m => m.isActive);
      return api(`/ecommerce/orders/${order.id}/import`, {
        method: "POST",
        body: JSON.stringify(method ? { paymentMethodId: String(method.id) } : {}),
      });
    },
    onSuccess: (res: { data: { saleId: string } }) => {
      toast.success(t("ecommerce.import_success"));
      invalidate();
      setImportingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      invalidate();
      setImportingId(null);
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: (orderId: string) => api(`/ecommerce/orders/${orderId}/ignore`, { method: "POST" }),
    onSuccess: () => {
      toast.success(t("ecommerce.ignore_success"));
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const connectionPlatform = (connectionId: string) =>
    connections?.find(c => c.id === connectionId)?.platform ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings/integrations">
            <Button variant="outline" size="icon"><ArrowRight className="h-4 w-4 rotate-180" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("ecommerce.orders_title")}</h1>
            <p className="text-muted-foreground text-sm">{t("ecommerce.orders_subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="me-2 h-4 w-4" />
          {t("ecommerce.refresh")}
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("ecommerce.incoming_orders")}</CardTitle>
            <div className="w-44">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue placeholder={t("ecommerce.all_statuses")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("ecommerce.all_statuses")}</SelectItem>
                  <SelectItem value="received">{t("ecommerce.status_received")}</SelectItem>
                  <SelectItem value="importing">{t("ecommerce.status_importing")}</SelectItem>
                  <SelectItem value="imported">{t("ecommerce.status_imported")}</SelectItem>
                  <SelectItem value="failed">{t("ecommerce.status_failed")}</SelectItem>
                  <SelectItem value="ignored">{t("ecommerce.status_ignored")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription>{t("ecommerce.orders_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title={t("ecommerce.no_orders")}
              description={t("ecommerce.no_orders_desc")}
              action={
                <div className="flex gap-2">
                  {(connections ?? []).filter(c => c.status === "connected").length > 0 ? (
                    (connections ?? []).filter(c => c.status === "connected").map(c => (
                      <Button key={c.id} size="sm" variant="outline" onClick={() => pullMutation.mutate(c.id)}>
                        <Store className="me-2 h-4 w-4" />
                        {t("ecommerce.pull")}
                      </Button>
                    ))
                  ) : (
                    <Link href="/settings/integrations">
                      <Button size="sm">
                        <Plug className="me-2 h-4 w-4" />
                        {t("ecommerce.connect_store")}
                      </Button>
                    </Link>
                  )}
                </div>
              }
            />
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">
                        {order.externalOrderNumber ?? order.externalOrderId}
                        <span className="text-muted-foreground font-normal"> · {connectionPlatform(order.connectionId)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {order.customerName ?? t("customers.walk_in")}
                        {order.customerPhone ? ` · ${order.customerPhone}` : ""} · {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-end">
                      <div className="font-semibold text-sm">{order.currency} {Number(order.total).toFixed(2)}</div>
                      <Badge variant={STATUS_STYLES[order.status] ?? "outline"} className="mt-0.5 capitalize">
                        {t(`ecommerce.status_${order.status}`)}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setViewOrder(order)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {order.status === "received" || order.status === "failed" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={importingId === order.id}
                          onClick={() => importMutation.mutate(order)}
                        >
                          {importingId === order.id
                            ? t("common.saving")
                            : <><PackageCheck className="me-1.5 h-4 w-4" />{t("ecommerce.import")}</>}
                        </Button>
                        <Button size="sm" variant="outline" disabled={importingId === order.id} onClick={() => {
                          if (window.confirm(t("ecommerce.ignore_confirm"))) ignoreMutation.mutate(order.id);
                        }}>
                          <Ban className="me-1.5 h-4 w-4" />
                          {t("ecommerce.ignore")}
                        </Button>
                      </>
                    ) : order.saleId ? (
                      <Link href={`/sales`}>
                        <Button size="sm" variant="outline">
                          <PackageCheck className="me-1.5 h-4 w-4" />
                          {t("ecommerce.view_sale")}
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {viewOrder && (
        <OrderDetailDialog order={viewOrder} connectionPlatform={connectionPlatform} onClose={() => setViewOrder(null)} />
      )}
    </div>
  );
}

function OrderDetailDialog({
  order, connectionPlatform, onClose,
}: {
  order: EcommerceOrder;
  connectionPlatform: (connectionId: string) => string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const items = order.payload?.items ?? [];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{order.externalOrderNumber ?? order.externalOrderId}</DialogTitle>
          <DialogDescription>
            {connectionPlatform(order.connectionId)} · {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">{t("customers.title")}</div>
              <div className="font-medium">{order.customerName ?? t("customers.walk_in")}</div>
              {order.customerPhone && <div className="text-xs text-muted-foreground">{order.customerPhone}</div>}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">{t("common.status")}</div>
              <Badge variant={STATUS_STYLES[order.status] ?? "outline"} className="capitalize">
                {t(`ecommerce.status_${order.status}`)}
              </Badge>
            </div>
          </div>

          {order.errorMessage && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <span>{order.errorMessage}</span>
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t("pos.items")}</Label>
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{item.name}</span>
                  <span className="shrink-0 text-muted-foreground ms-3">
                    {item.quantity} × {item.unitPrice.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between rounded-lg border-t pt-3 text-sm font-semibold">
            <span>{t("pos.total")}</span>
            <span>{order.currency} {Number(order.total).toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
