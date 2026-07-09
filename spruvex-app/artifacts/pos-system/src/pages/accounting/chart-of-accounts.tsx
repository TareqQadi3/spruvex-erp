import { useState } from "react";
import {
  useGetAccounts, useCreateAccount, useUpdateAccount,
  getGetAccountsQueryKey,
} from "@workspace/api-client-react";
import type { Account, AccountInputType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Lock } from "lucide-react";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "@/i18n";

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  liability: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  equity: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  revenue: "bg-green-500/10 text-green-700 border-green-500/20",
  expense: "bg-red-500/10 text-red-600 border-red-500/20",
};

interface AccountFormValues {
  code: string;
  name: string;
  nameAr?: string;
  type: AccountInputType;
  subtype?: string;
  parentId?: string;
}

function AccountDialog({
  account, accounts, onSaved,
}: {
  account?: Account;
  accounts: Account[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!account;
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const { t } = useTranslation();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AccountFormValues>({
    defaultValues: account
      ? { code: account.code, name: account.name, nameAr: account.nameAr ?? "", type: account.type, subtype: account.subtype ?? "", parentId: account.parentId ?? "" }
      : { code: "", name: "", nameAr: "", type: "asset", subtype: "", parentId: "" },
  });

  const onSubmit = (data: AccountFormValues) => {
    if (isEdit && account) {
      updateAccount.mutate({
        id: account.id,
        data: {
          name: data.name,
          nameAr: data.nameAr || null,
          parentId: data.parentId || null,
        },
      }, {
        onSuccess: () => {
          toast.success(t("accounting.coa_save_success"));
          setOpen(false);
          onSaved();
        },
        onError: (e: any) => toast.error(e?.data?.error || t("accounting.coa_save_failed")),
      });
      return;
    }

    createAccount.mutate({
      data: {
        code: data.code,
        name: data.name,
        nameAr: data.nameAr || undefined,
        type: data.type,
        subtype: data.subtype || undefined,
        parentId: data.parentId || null,
      },
    }, {
      onSuccess: () => {
        toast.success(t("accounting.coa_save_success"));
        reset();
        setOpen(false);
        onSaved();
      },
      onError: (e: any) => toast.error(e?.data?.error || t("accounting.coa_save_failed")),
    });
  };

  const isPending = createAccount.isPending || updateAccount.isPending;
  const parentCandidates = accounts.filter(a => !account || a.id !== account.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button><Plus className="me-2 h-4 w-4" /> {t("accounting.add_account")}</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? t("accounting.edit_account") : t("accounting.add_account")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("accounting.account_code_required")}</Label>
              <Input {...register("code", { required: true })} disabled={isEdit} placeholder="1000" className={errors.code ? "border-destructive" : ""} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("accounting.account_type_required")}</Label>
              <Controller
                name="type"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} disabled={isEdit}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("accounting.select_account_type")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{t(`accounting.type_${type}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("accounting.account_name_required")}</Label>
            <Input {...register("name", { required: true })} placeholder={t("accounting.account_name_placeholder")} className={errors.name ? "border-destructive" : ""} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("accounting.account_name_ar")}</Label>
            <Input {...register("nameAr")} placeholder={t("accounting.account_name_ar_placeholder")} dir="rtl" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("accounting.parent_account")}</Label>
            <Controller
              name="parentId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={(v) => field.onChange(v === "none" ? "" : v)} value={field.value || "none"}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("accounting.select_parent_account")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("accounting.no_parent")}</SelectItem>
                    {parentCandidates.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ChartOfAccounts() {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useGetAccounts();
  const { t } = useTranslation();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetAccountsQueryKey() });

  const parentName = (parentId: string | null | undefined, list: Account[]) => {
    if (!parentId) return null;
    return list.find(a => a.id === parentId)?.name ?? null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <AccountDialog accounts={accounts ?? []} onSaved={invalidate} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounting.code")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("accounting.account_type")}</TableHead>
                <TableHead>{t("accounting.parent_account")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3, 4].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : accounts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("accounting.no_accounts")}</TableCell>
                </TableRow>
              ) : (
                accounts?.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono text-sm">{account.code}</TableCell>
                    <TableCell className="font-medium">
                      {account.name}
                      {account.nameAr && <div className="text-xs text-muted-foreground" dir="rtl">{account.nameAr}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={TYPE_COLORS[account.type]}>
                        {t(`accounting.type_${account.type}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {parentName(account.parentId, accounts) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {account.isSystem && (
                        <Badge variant="outline" className="me-1">
                          <Lock className="h-3 w-3 me-1" /> {t("accounting.system_account")}
                        </Badge>
                      )}
                      <Badge variant={account.isActive ? "outline" : "secondary"}>
                        {account.isActive ? t("accounting.active") : t("accounting.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <AccountDialog account={account} accounts={accounts ?? []} onSaved={invalidate} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
