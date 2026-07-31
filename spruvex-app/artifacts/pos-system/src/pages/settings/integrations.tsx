import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CreditCard, Store, Plus, Pencil, PlugZap, Copy, Check, Link2, ExternalLink } from "lucide-react";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

type GatewayMode = "test" | "live";
interface GatewaySettings {
  id: string;
  provider: string;
  mode: GatewayMode;
  isActive: boolean;
  hasCredentials: boolean;
  createdAt?: string;
  updatedAt?: string;
}
interface EcommerceConnection {
  id: string;
  companyId: string;
  platform: string;
  status: "connected" | "disconnected" | "error";
  storeUrl?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
  hasCredentials: boolean;
}

interface ConfigField {
  key: string;
  label: string;
  required?: boolean;
  help?: string;
}

const GATEWAY_PROVIDERS = ["tabby", "tamara", "moyasar", "mock"] as const;
const PLATFORMS = ["salla", "zid", "shopify", "mock"] as const;

const GATEWAY_FIELDS: Record<string, ConfigField[]> = {
  tabby: [
    { key: "secretKey", label: "Secret Key", required: true },
    { key: "merchantCode", label: "Merchant Code" },
    { key: "webhookSecret", label: "Webhook Secret" },
  ],
  tamara: [
    { key: "apiToken", label: "API Token", required: true },
    { key: "notificationToken", label: "Notification Token" },
  ],
  moyasar: [
    { key: "secretKey", label: "Secret Key", required: true },
    { key: "webhookSecret", label: "Webhook Secret" },
  ],
  mock: [{ key: "webhookSecret", label: "Webhook Secret" }],
};

const PLATFORM_FIELDS: Record<string, ConfigField[]> = {
  salla: [
    { key: "accessToken", label: "Access Token", required: true },
    { key: "webhookSecret", label: "Webhook Secret" },
  ],
  zid: [
    { key: "authorization", label: "Authorization Token", required: true },
    { key: "managerToken", label: "Manager Token" },
    { key: "storeId", label: "Store ID" },
    { key: "webhookSecret", label: "Webhook Secret" },
  ],
  shopify: [
    { key: "shopDomain", label: "Shop Domain (e.g. my-shop.myshopify.com)", required: true },
    { key: "accessToken", label: "Admin Access Token", required: true },
    { key: "webhookSecret", label: "Webhook Secret" },
  ],
  mock: [{ key: "webhookSecret", label: "Webhook Secret", required: true }],
};

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [gatewayDialog, setGatewayDialog] = useState<string | null>(null);
  const [connectionDialog, setConnectionDialog] = useState<EcommerceConnection | "new" | null>(null);

  const { data: gateways, isLoading: gatewaysLoading } = useQuery<GatewaySettings[]>({
    queryKey: ["payment-gateways"],
    queryFn: () => api<{ data: GatewaySettings[] }>("/payments/gateways").then(r => r.data),
  });

  const { data: connections, isLoading: connectionsLoading } = useQuery<EcommerceConnection[]>({
    queryKey: ["ecommerce-connections"],
    queryFn: () => api<{ data: EcommerceConnection[] }>("/ecommerce/connections").then(r => r.data),
  });

  const saveGateway = useMutation({
    mutationFn: (vars: { provider: string; body: { credentials?: Record<string, string>; mode: GatewayMode; isActive: boolean } }) =>
      api(`/payments/gateways/${vars.provider}`, { method: "PUT", body: JSON.stringify(vars.body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-gateways"] });
      setGatewayDialog(null);
      toast.success(t("integrations.gateway_saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveConnection = useMutation({
    mutationFn: (vars: { id?: string; body: { platform?: string; storeUrl?: string; credentials?: Record<string, string> } }) =>
      vars.id
        ? api(`/ecommerce/connections/${vars.id}`, { method: "PATCH", body: JSON.stringify(vars.body) })
        : api("/ecommerce/connections", { method: "POST", body: JSON.stringify(vars.body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ecommerce-connections"] });
      setConnectionDialog(null);
      toast.success(t("integrations.connection_saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testConnection = useMutation({
    mutationFn: (id: string) => api<{ data: { ok: boolean; storeName?: string | null; message?: string | null } }>(`/ecommerce/connections/${id}/test`, { method: "POST" }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ecommerce-connections"] });
      if (result.data.ok) {
        toast.success(result.data.storeName ?? t("integrations.test_ok"));
      } else {
        toast.error(result.data.message ?? t("integrations.test_failed"));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const gatewayMap = new Map((gateways ?? []).map(g => [g.provider, g]));

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("integrations.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("integrations.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{t("integrations.payments_title")}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{t("integrations.payments_desc")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {gatewaysLoading && [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          {!gatewaysLoading && GATEWAY_PROVIDERS.map(provider => {
            const g = gatewayMap.get(provider);
            return (
              <div key={provider} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm capitalize">{provider}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[9px] px-1.5">{g?.mode ?? "test"}</Badge>
                      <span>{g?.hasCredentials ? t("integrations.configured") : t("integrations.not_configured")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t("integrations.active")}</span>
                    <Switch
                      checked={g?.isActive ?? true}
                      onCheckedChange={checked => {
                        if (g) {
                          saveGateway.mutate({ provider, body: { mode: g.mode, isActive: checked } });
                        }
                      }}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setGatewayDialog(provider)}>
                    <Pencil className="h-3.5 w-3.5 me-1" />
                    {t("integrations.configure")}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{t("integrations.ecommerce_title")}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t("integrations.ecommerce_desc")}</CardDescription>
              </div>
            </div>
            <Button onClick={() => setConnectionDialog("new")}>
              <Plus className="h-4 w-4 me-1" />
              {t("integrations.add_connection")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectionsLoading && [1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          {!connectionsLoading && (connections?.length ?? 0) === 0 && (
            <div className="py-10 flex flex-col items-center text-center text-muted-foreground gap-2">
              <Store className="h-8 w-8" />
              <p className="text-sm">{t("integrations.no_connections")}</p>
            </div>
          )}
          {(connections ?? []).map(conn => (
            <div key={conn.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                  <Link2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <span className="capitalize truncate">{conn.platform}</span>
                    <Badge
                      className="text-[9px] px-1.5"
                      variant={conn.status === "connected" ? "default" : conn.status === "error" ? "destructive" : "outline"}
                    >
                      {t(`integrations.status_${conn.status}`)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {conn.storeUrl ?? t("integrations.no_store_url")}
                    {conn.lastSyncedAt ? ` · ${t("integrations.last_synced")}: ${new Date(conn.lastSyncedAt).toLocaleString()}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm"
                  disabled={testConnection.isPending}
                  onClick={() => testConnection.mutate(conn.id)}
                >
                  <PlugZap className="h-3.5 w-3.5 me-1" />
                  {t("integrations.test")}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setConnectionDialog(conn)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {gatewayDialog && (
        <GatewayDialog
          provider={gatewayDialog}
          current={gatewayMap.get(gatewayDialog)}
          onClose={() => setGatewayDialog(null)}
          isPending={saveGateway.isPending}
          onSave={(body) => saveGateway.mutate({ provider: gatewayDialog, body })}
        />
      )}
      {connectionDialog && (
        <ConnectionDialog
          connection={connectionDialog === "new" ? null : connectionDialog}
          onClose={() => setConnectionDialog(null)}
          isPending={saveConnection.isPending}
          onSave={(body) => saveConnection.mutate({ id: connectionDialog === "new" ? undefined : connectionDialog.id, body })}
        />
      )}
    </div>
  );
}

function WebhookUrlRow({ url }: { url: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const full = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
      <code className="flex-1 text-[11px] truncate" dir="ltr">{full}</code>
      <Button
        variant="ghost" size="icon"
        onClick={() => {
          navigator.clipboard.writeText(full);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function CredentialFields({
  fields, values, setValue, hasExistingCredentials,
}: {
  fields: ConfigField[];
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  hasExistingCredentials: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      {fields.map(field => (
        <div key={field.key} className="space-y-1.5">
          <Label>
            {t(`integrations.field_${field.key}`)}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            value={values[field.key] ?? ""}
            onChange={e => setValue(field.key, e.target.value)}
            placeholder={hasExistingCredentials ? t("integrations.keep_existing") : t("integrations.enter_value")}
            type={field.key.toLowerCase().includes("secret") || field.key.toLowerCase().includes("token") || field.key.toLowerCase().includes("key") ? "password" : "text"}
          />
          {field.help && <p className="text-xs text-muted-foreground">{t(`integrations.help_${field.key}`)}</p>}
        </div>
      ))}
    </div>
  );
}

function GatewayDialog({
  provider, current, onClose, isPending, onSave,
}: {
  provider: string;
  current?: GatewaySettings;
  onClose: () => void;
  isPending: boolean;
  onSave: (body: { credentials?: Record<string, string>; mode: GatewayMode; isActive: boolean }) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<GatewayMode>(current?.mode ?? "test");
  const [isActive, setIsActive] = useState(current?.isActive ?? true);
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }));
  const hasExisting = current?.hasCredentials ?? false;
  const fields = GATEWAY_FIELDS[provider] ?? [];
  const requiredMissing = fields.filter(f => f.required && !values[f.key] && !hasExisting).length > 0;

  const handleSave = () => {
    const credentials = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.trim().length > 0)
    );
    onSave({ credentials: Object.keys(credentials).length > 0 ? credentials : undefined, mode, isActive });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">{t("integrations.configure_gateway")} — {provider}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("integrations.mode")}</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as GatewayMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">{t("integrations.mode_test")}</SelectItem>
                  <SelectItem value="live">{t("integrations.mode_live")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("integrations.active")}</Label>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
          </div>
          <CredentialFields fields={fields} values={values} setValue={setValue} hasExistingCredentials={hasExisting} />
          <div className="space-y-1.5">
            <Label className="text-sm">{t("integrations.webhook_url")}</Label>
            <WebhookUrlRow url={`/api/payments/webhooks/${provider}`} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={isPending || requiredMissing} onClick={handleSave}>
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectionDialog({
  connection, onClose, isPending, onSave,
}: {
  connection: EcommerceConnection | null;
  onClose: () => void;
  isPending: boolean;
  onSave: (body: { platform?: string; storeUrl?: string; credentials?: Record<string, string> }) => void;
}) {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<string>(connection?.platform ?? "salla");
  const [storeUrl, setStoreUrl] = useState(connection?.storeUrl ?? "");
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }));
  const hasExisting = connection?.hasCredentials ?? false;
  const fields = PLATFORM_FIELDS[platform] ?? [];
  const requiredMissing = !connection && fields.filter(f => f.required && !values[f.key]).length > 0;

  const handleSave = () => {
    const credentials = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.trim().length > 0)
    );
    onSave({
      ...(connection ? {} : { platform }),
      storeUrl: storeUrl.trim() || undefined,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{connection ? t("integrations.edit_connection") : t("integrations.add_connection")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!connection && (
            <div className="space-y-1.5">
              <Label>{t("integrations.platform")}</Label>
              <Select value={platform} onValueChange={(v) => { setPlatform(v); setValues({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t("integrations.store_url")}</Label>
            <Input value={storeUrl} onChange={e => setStoreUrl(e.target.value)} placeholder="https://example.com" dir="ltr" />
          </div>
          <CredentialFields fields={fields} values={values} setValue={setValue} hasExistingCredentials={hasExisting} />
          {connection && (
            <div className="space-y-1.5">
              <Label className="text-sm">{t("integrations.webhook_url")}</Label>
              <WebhookUrlRow url={`/api/ecommerce/webhooks/${connection.id}/orders`} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={isPending || requiredMissing} onClick={handleSave}>
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
