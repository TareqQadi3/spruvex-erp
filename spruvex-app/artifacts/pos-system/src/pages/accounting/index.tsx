import { useState } from "react";
import {
  useGetExpenses, useCreateExpense, useDeleteExpense, getGetExpensesQueryKey,
  useGetActiveCashSession, useOpenCashSession, useCloseCashSession,
  getGetActiveCashSessionQueryKey, getGetCashSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, LockOpen, Lock, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { useTranslation } from "@/i18n";

const CATEGORY_COLORS: Record<string, string> = {
  rent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  salary: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  utilities: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  supplies: "bg-green-500/10 text-green-700 border-green-500/20",
  maintenance: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  other: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const EXPENSE_CATEGORY_KEYS = ["rent", "salary", "utilities", "supplies", "maintenance", "other"];

function AddExpenseDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const createExpense = useCreateExpense();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<any>({
    defaultValues: { date: new Date().toISOString().split("T")[0] }
  });
  const { t } = useTranslation();

  const onSubmit = (data: any) => {
    createExpense.mutate({
      data: {
        description: data.description,
        amount: Number(data.amount),
        category: data.category,
        date: data.date,
        notes: data.notes || undefined,
      }
    }, {
      onSuccess: () => {
        toast.success(t("accounting.save_success"));
        reset({ date: new Date().toISOString().split("T")[0] });
        setOpen(false);
        onCreated();
      },
      onError: () => toast.error(t("accounting.save_failed")),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="me-2 h-4 w-4" /> {t("accounting.add_expense")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("accounting.record_expense")}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("accounting.expense_desc_required")}</Label>
            <Input {...register("description", { required: true })} placeholder={t("accounting.expense_desc_placeholder")} className={errors.description ? "border-destructive" : ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("accounting.amount_required")}</Label>
              <Input type="number" step="0.01" {...register("amount", { required: true })} placeholder="0.00" className={errors.amount ? "border-destructive" : ""} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("accounting.date_required")}</Label>
              <Input type="date" {...register("date", { required: true })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("accounting.category_required")}</Label>
            <Controller
              name="category"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                    <SelectValue placeholder={t("accounting.select_category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORY_KEYS.map(cat => (
                      <SelectItem key={cat} value={cat}>{t(`accounting.cat_${cat}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("accounting.notes_optional")}</Label>
            <Textarea {...register("notes")} placeholder={t("accounting.notes_placeholder")} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={createExpense.isPending}>
              {createExpense.isPending ? t("common.saving") : t("accounting.record_expense")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountingPage() {
  const queryClient = useQueryClient();
  const { data: expenses, isLoading } = useGetExpenses();
  const { data: activeSession } = useGetActiveCashSession({ query: { retry: false } as any });
  const openSession = useOpenCashSession();
  const closeSession = useCloseCashSession();
  const { t } = useTranslation();

  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");

  const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  const handleOpenSession = () => {
    openSession.mutate({ data: { openingBalance: Number(openingBalance) } }, {
      onSuccess: () => {
        toast.success(t("accounting.session_opened_msg"));
        setOpeningBalance("");
        queryClient.invalidateQueries({ queryKey: getGetActiveCashSessionQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCashSessionsQueryKey() });
      },
      onError: (e: any) => toast.error(e?.data?.error || t("accounting.session_failed")),
    });
  };

  const handleCloseSession = () => {
    if (!activeSession) return;
    closeSession.mutate({ id: activeSession.id, data: { closingBalance: Number(closingBalance) } }, {
      onSuccess: () => {
        toast.success(t("accounting.session_closed"));
        setClosingBalance("");
        queryClient.invalidateQueries({ queryKey: getGetActiveCashSessionQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCashSessionsQueryKey() });
      },
      onError: () => toast.error(t("accounting.close_failed")),
    });
  };

  const deleteExpense = useDeleteExpense();
  const handleDeleteExpense = (id: number) => {
    if (!window.confirm(t("accounting.delete_confirm"))) return;
    deleteExpense.mutate({ id }, {
      onSuccess: () => {
        toast.success(t("accounting.delete_success"));
        queryClient.invalidateQueries({ queryKey: getGetExpensesQueryKey() });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("accounting.title")}</h1>
        <AddExpenseDialog onCreated={() => queryClient.invalidateQueries({ queryKey: getGetExpensesQueryKey() })} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeSession
                ? <LockOpen className="h-5 w-5 text-green-500" />
                : <Lock className="h-5 w-5 text-muted-foreground" />}
              {t("accounting.cash_session")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeSession ? (
              <>
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="text-sm font-medium text-green-700 dark:text-green-400">{t("accounting.session_open")}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t("accounting.session_opened", {
                      date: format(new Date(activeSession.openedAt), "MMM d, HH:mm"),
                      balance: Number(activeSession.openingBalance).toFixed(2)
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("accounting.closing_balance")}</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" placeholder={t("accounting.count_cash")} value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} />
                    <Button variant="destructive" onClick={handleCloseSession} disabled={!closingBalance || closeSession.isPending}>
                      <Lock className="me-2 h-4 w-4" /> {t("accounting.close_session")}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  {t("accounting.no_active_session")}
                </div>
                <div className="space-y-1.5">
                  <Label>{t("accounting.opening_balance")}</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" placeholder={t("accounting.cash_in_drawer")} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
                    <Button onClick={handleOpenSession} disabled={!openingBalance || openSession.isPending}>
                      <LockOpen className="me-2 h-4 w-4" /> {t("accounting.open_session")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-destructive" />
              {t("accounting.expense_summary")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalExpenses.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground mt-1">{t("accounting.total_expenses")}</p>
            <div className="mt-4 space-y-2">
              {EXPENSE_CATEGORY_KEYS.map(cat => {
                const catTotal = expenses?.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0) ?? 0;
                if (catTotal === 0) return null;
                return (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <Badge variant="outline" className={CATEGORY_COLORS[cat]}>{t(`accounting.cat_${cat}`)}</Badge>
                    <span className="font-medium">{catTotal.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("accounting.expense_records")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.description")}</TableHead>
                <TableHead>{t("common.category")}</TableHead>
                <TableHead className="text-end">{t("common.amount")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : expenses?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("accounting.no_expenses")}</TableCell>
                </TableRow>
              ) : (
                expenses?.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-sm">{expense.date}</TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={CATEGORY_COLORS[expense.category]}>
                        {t(`accounting.cat_${expense.category}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end font-medium">{Number(expense.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-end">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(expense.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
