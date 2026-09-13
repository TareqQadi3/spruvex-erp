import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, Plus, KeyRound, Users as UsersIcon, Mail, X } from "lucide-react";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { QueryErrorState } from "@/components/QueryErrorState";

interface AppUser {
  id: number;
  username: string;
  role: string;
  permissions: string | null;
  isActive: boolean;
  createdAt: string;
}

interface InviteSummary {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

const ROLES = ["admin", "store_manager", "cashier", "warehouse_staff", "accountant"];
const PERMISSIONS = [
  "add_product", "edit_product_price", "override_discount", "view_reports",
  "manage_inventory", "manage_customers", "manage_repairs", "manage_accounting", "manage_settings",
];

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    // Legacy routes (/auth/users) reply { error: "message" }; modular routes
    // (/auth/invites) go through the AppError envelope { error: { message } }.
    // This page calls both, so handle either shape.
    throw new Error(err.error?.message ?? err.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  const body = await res.json();
  // Same split on the success side: legacy routes return the payload
  // directly, modular routes wrap it as { data }.
  return body?.data ?? body;
}

export default function UsersSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogUser, setDialogUser] = useState<AppUser | "new" | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const { data: users, isLoading, isError, refetch } = useQuery<AppUser[]>({
    queryKey: ["auth-users"],
    queryFn: () => authFetch("/auth/users"),
  });

  const { data: invites, isLoading: invitesLoading } = useQuery<InviteSummary[]>({
    queryKey: ["auth-invites"],
    queryFn: () => authFetch("/auth/invites"),
  });
  const pendingInvites = invites?.filter(i => i.status === "pending") ?? [];

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: number; username?: string; password?: string; role: string; permissions: string[] }) =>
      vars.id
        ? authFetch(`/auth/users/${vars.id}`, { method: "PUT", body: JSON.stringify(vars) })
        : authFetch("/auth/users", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-users"] });
      setDialogUser(null);
      toast.success(t("users.save_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (vars: { id: number; isActive: boolean }) =>
      authFetch(`/auth/users/${vars.id}`, { method: "PUT", body: JSON.stringify({ isActive: vars.isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth-users"] }),
  });

  const inviteMutation = useMutation({
    mutationFn: (vars: { email: string; role: string }) =>
      authFetch("/auth/invites", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-invites"] });
      setInviteDialogOpen(false);
      toast.success(t("users.invite_sent"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (id: string) => authFetch(`/auth/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth-invites"] });
      toast.success(t("users.invite_revoked"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("users.title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
            <Mail className="me-2 h-4 w-4" />
            {t("users.invite_by_email")}
          </Button>
          <Button onClick={() => setDialogUser("new")}>
            <Plus className="me-2 h-4 w-4" />
            {t("users.add_user")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.list_title")}</CardTitle>
          <CardDescription>{t("users.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          {isError && <QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} />}
          {!isLoading && !isError && users?.length === 0 && (
            <EmptyState icon={UsersIcon} title={t("users.empty_title")} description={t("users.empty_desc")} />
          )}
          {users?.map(u => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium text-sm">{u.username}</div>
                <div className="text-xs text-muted-foreground">{t(`roles.${u.role}`)}</div>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={u.isActive}
                  onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: u.id, isActive: checked })}
                />
                <Button variant="ghost" size="icon" onClick={() => setDialogUser(u)}>
                  <KeyRound className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {!invitesLoading && pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("users.pending_invites_title")}</CardTitle>
            <CardDescription>{t("users.pending_invites_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingInvites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="font-medium text-sm" dir="ltr">{inv.email}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{t(`roles.${inv.role}`)}</span>
                    <Badge variant="outline">{t("users.invite_status_pending")}</Badge>
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => {
                    if (confirm(t("users.invite_revoke_confirm"))) revokeInviteMutation.mutate(inv.id);
                  }}
                  disabled={revokeInviteMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {dialogUser && (
        <UserDialog
          user={dialogUser === "new" ? null : dialogUser}
          onClose={() => setDialogUser(null)}
          onSave={(vars) => saveMutation.mutate(vars)}
          isPending={saveMutation.isPending}
        />
      )}

      {inviteDialogOpen && (
        <InviteDialog
          onClose={() => setInviteDialogOpen(false)}
          onSend={(vars) => inviteMutation.mutate(vars)}
          isPending={inviteMutation.isPending}
        />
      )}
    </div>
  );
}

function InviteDialog({
  onClose, onSend, isPending,
}: {
  onClose: () => void;
  onSend: (vars: { email: string; role: string }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("cashier");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("users.invite_title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">{t("users.invite_desc")}</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("users.invite_email")}</Label>
            <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("users.invite_role")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue>{t(`roles.${role}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={isPending || !email.trim()} onClick={() => onSend({ email: email.trim(), role })}>
            {isPending ? t("users.invite_sending") : t("users.invite_send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserDialog({
  user, onClose, onSave, isPending,
}: {
  user: AppUser | null;
  onClose: () => void;
  onSave: (vars: { id?: number; username?: string; password?: string; role: string; permissions: string[] }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "cashier");
  const [permissions, setPermissions] = useState<string[]>(() => {
    try { return user?.permissions ? JSON.parse(user.permissions) : []; } catch { return []; }
  });

  const togglePermission = (p: string) => {
    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? t("users.edit_user") : t("users.add_user")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!user && (
            <div className="space-y-1.5">
              <Label>{t("auth.username")}</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{user ? t("users.new_password_optional") : t("auth.password")}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("users.role")}</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue>{t(`roles.${role}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("users.extra_permissions")}</Label>
            <p className="text-xs text-muted-foreground">{t("users.extra_permissions_desc")}</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PERMISSIONS.map(p => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={permissions.includes(p)} onCheckedChange={() => togglePermission(p)} />
                  {p.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            disabled={isPending || (!user && (!username.trim() || !password))}
            onClick={() => onSave({
              id: user?.id,
              ...(user ? {} : { username: username.trim() }),
              ...(password ? { password } : {}),
              role,
              permissions,
            })}
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
