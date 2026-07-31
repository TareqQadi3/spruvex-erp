import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, Building2, Plus, Users, Star } from "lucide-react";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

interface BranchItem {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface UserItem { id: string; username: string; role: string; }
interface BranchUserRow { id: string; userId: string; }

export default function BranchesSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [usersDialogBranch, setUsersDialogBranch] = useState<BranchItem | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const { data: branches, isLoading } = useQuery<BranchItem[]>({
    queryKey: ["branches"],
    queryFn: () => api("/branches"),
  });

  const { data: allUsers } = useQuery<UserItem[]>({
    queryKey: ["auth-users"],
    queryFn: () => api("/auth/users"),
  });

  const { data: branchUsers } = useQuery<BranchUserRow[]>({
    queryKey: ["branch-users", usersDialogBranch?.id],
    queryFn: () => api(`/branches/${usersDialogBranch!.id}/users`),
    enabled: !!usersDialogBranch,
  });

  const createMutation = useMutation({
    mutationFn: (vars: { name: string; code?: string; address?: string; phone?: string }) =>
      api("/branches", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setDialogOpen(false);
      setName(""); setCode(""); setAddress(""); setPhone("");
      toast.success(t("branches.save_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api(`/branches/${id}`, { method: "PUT", body: JSON.stringify({ isDefault: true }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api(`/branches/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branches"] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const assignUserMutation = useMutation({
    mutationFn: (userId: string) =>
      api(`/branches/${usersDialogBranch!.id}/users`, { method: "POST", body: JSON.stringify({ userId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branch-users", usersDialogBranch?.id] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeUserMutation = useMutation({
    mutationFn: (userBranchId: string) => api(`/branches/user-branches/${userBranchId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branch-users", usersDialogBranch?.id] }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("branches.title")}</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" /> {t("branches.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("branches.list_title")}</CardTitle>
          <CardDescription>{t("branches.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          {!isLoading && branches?.length === 0 && (
            <EmptyState icon={Building2} title={t("branches.empty_title")} description={t("branches.empty_desc")} />
          )}
          {branches?.map(b => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {b.name}
                    {b.isDefault && <Badge variant="secondary">{t("branches.default")}</Badge>}
                    {!b.isActive && <Badge variant="destructive">{t("branches.inactive")}</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{[b.code, b.phone, b.address].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" title={t("branches.manage_users")} onClick={() => setUsersDialogBranch(b)}>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </Button>
                {!b.isDefault && (
                  <Button variant="ghost" size="icon" title={t("branches.set_default")} onClick={() => setDefaultMutation.mutate(b.id)}>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("branches.add")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("branches.name")}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("branches.code")}</Label>
              <Input value={code} onChange={e => setCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("branches.phone")}</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("branches.address")}</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              disabled={createMutation.isPending || !name.trim()}
              onClick={() => createMutation.mutate({ name: name.trim(), code: code.trim() || undefined, address: address.trim() || undefined, phone: phone.trim() || undefined })}
            >
              {createMutation.isPending ? t("common.saving") : t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!usersDialogBranch} onOpenChange={open => !open && setUsersDialogBranch(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("branches.manage_users")}: {usersDialogBranch?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {allUsers?.map(u => {
              const assignment = branchUsers?.find(bu => bu.userId === u.id);
              return (
                <div key={u.id} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="text-sm">{u.username} <span className="text-xs text-muted-foreground">({u.role})</span></div>
                  {assignment ? (
                    <Button variant="outline" size="sm" onClick={() => revokeUserMutation.mutate(assignment.id)}>
                      {t("branches.remove")}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => assignUserMutation.mutate(u.id)}>
                      {t("branches.assign")}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUsersDialogBranch(null)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
