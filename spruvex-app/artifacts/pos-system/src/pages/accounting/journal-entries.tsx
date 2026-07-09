import { useState } from "react";
import {
  useGetAccounts, useGetJournalEntries, useCreateJournalEntry,
  getGetJournalEntriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";

interface DraftLine {
  accountId: string;
  side: "debit" | "credit";
  amount: string;
  memo: string;
}

function emptyLine(): DraftLine {
  return { accountId: "", side: "debit", amount: "", memo: "" };
}

function NewJournalEntryDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: accounts } = useGetAccounts();
  const createEntry = useCreateJournalEntry();
  const { t } = useTranslation();

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);

  const totalDebit = lines.reduce((s, l) => s + (l.side === "debit" ? Number(l.amount) || 0 : 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.side === "credit" ? Number(l.amount) || 0 : 0), 0);
  const difference = totalDebit - totalCredit;
  const isBalanced = Math.abs(difference) < 0.01 && totalDebit > 0;
  const linesValid = lines.every(l => l.accountId && Number(l.amount) > 0);

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);
  const removeLine = (index: number) => setLines(prev => prev.filter((_, i) => i !== index));

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setMemo("");
    setLines([emptyLine(), emptyLine()]);
  };

  const handleSubmit = () => {
    if (!isBalanced || !linesValid) return;
    createEntry.mutate({
      data: {
        date,
        memo: memo || undefined,
        lines: lines.map(l => ({
          accountId: l.accountId,
          debit: l.side === "debit" ? Number(l.amount) : undefined,
          credit: l.side === "credit" ? Number(l.amount) : undefined,
          memo: l.memo || undefined,
        })),
      },
    }, {
      onSuccess: () => {
        toast.success(t("accounting.je_save_success"));
        resetForm();
        setOpen(false);
        onCreated();
      },
      onError: (e: any) => toast.error(e?.data?.error || t("accounting.je_save_failed")),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="me-2 h-4 w-4" /> {t("accounting.new_journal_entry")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{t("accounting.new_journal_entry")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("accounting.date_required")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("accounting.memo_optional")}</Label>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={t("accounting.memo_placeholder")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("accounting.journal_lines")}</Label>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-start gap-2 rounded-lg border p-2">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <Select value={line.accountId} onValueChange={(v) => updateLine(index, { accountId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("accounting.select_account")} />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={line.memo}
                      onChange={(e) => updateLine(index, { memo: e.target.value })}
                      placeholder={t("accounting.line_memo_placeholder")}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="w-28 space-y-1.5">
                    <Select value={line.side} onValueChange={(v) => updateLine(index, { side: v as "debit" | "credit" })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debit">{t("accounting.debit")}</SelectItem>
                        <SelectItem value="credit">{t("accounting.credit")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28 space-y-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount}
                      onChange={(e) => updateLine(index, { amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length <= 2}
                    onClick={() => removeLine(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="me-2 h-3.5 w-3.5" /> {t("accounting.add_line")}
            </Button>
          </div>

          <div className={`flex items-center justify-between rounded-lg border p-3 text-sm ${isBalanced ? "border-green-500/30 bg-green-500/10" : "border-destructive/30 bg-destructive/10"}`}>
            <span>{t("accounting.total_debit")}: <strong>{totalDebit.toFixed(2)}</strong></span>
            <span>{t("accounting.total_credit")}: <strong>{totalCredit.toFixed(2)}</strong></span>
            <span className={isBalanced ? "text-green-700 dark:text-green-400 font-medium" : "text-destructive font-medium"}>
              {isBalanced ? t("accounting.balanced") : t("accounting.unbalanced_diff", { amount: Math.abs(difference).toFixed(2) })}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button type="button" disabled={!isBalanced || !linesValid || createEntry.isPending} onClick={handleSubmit}>
            {createEntry.isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function JournalEntries() {
  const queryClient = useQueryClient();
  const { data: entries, isLoading } = useGetJournalEntries();
  const { t } = useTranslation();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <NewJournalEntryDialog onCreated={invalidate} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("accounting.entry_number")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("common.description")}</TableHead>
                <TableHead>{t("accounting.source")}</TableHead>
                <TableHead>{t("accounting.journal_lines")}</TableHead>
                <TableHead className="text-end">{t("common.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                  </TableRow>
                ))
              ) : entries?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("accounting.no_journal_entries")}</TableCell>
                </TableRow>
              ) : (
                entries?.map((entry) => {
                  const total = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">{entry.entryNumber}</TableCell>
                      <TableCell className="text-sm">{entry.date}</TableCell>
                      <TableCell>{entry.memo || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {entry.isManual ? t("accounting.source_manual") : t(`accounting.source_${entry.sourceType}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.lines.map(l => `${l.accountCode ?? ""} ${l.accountName ?? ""}`).join(", ")}
                      </TableCell>
                      <TableCell className="text-end font-medium">{total.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
