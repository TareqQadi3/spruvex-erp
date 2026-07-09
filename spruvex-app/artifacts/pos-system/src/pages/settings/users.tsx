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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, KeyRound } from "lucide-react";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

interface AppUser {
  id: number;
  username: string;
  role: string;
  permissions: string | null;
  isActive: boolean;
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
    throw new Error(err.error ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

export default function UsersSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogUser, setDialogUser] = useState<AppUser | "new" | null>(null);

  const { data: users, isLoading } = useQuery<AppUser[]>({
    queryKey: ["auth-users"],
    queryFn: () => authFetch("/auth/users"),
  });

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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("users.title")}</h1>
        </div>
        <Button onClick={() => setDialogUser("new")}>
          <Plus className="me-2 h-4 w-4" />
          {t("users.add_user")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("users.list_title")}</CardTitle>
          <CardDescription>{t("users.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
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

      {dialogUser && (
        <UserDialog
          user={dialogUser === "new" ? null : dialogUser}
          onClose={() => setDialogUser(null)}
          onSave={(vars) => saveMutation.mutate(vars)}
          isPending={saveMutation.isPending}
        />
      )}
    </div>
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
