import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Plus, LifeBuoy } from "lucide-react";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

export async function authFetch(path: string, options: RequestInit = {}) {
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
    throw new Error(err.error?.message ?? err.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  const body = await res.json();
  return body?.data ?? body;
}

const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "destructive",
  pending: "outline",
  in_progress: "default",
  resolved: "secondary",
  closed: "secondary",
};

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
}

export default function SupportPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [category, setCategory] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<{ tickets: SupportTicket[] }>({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch("/api/support/tickets?pageSize=50", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("Request failed");
      const body = await res.json();
      return { tickets: body.data ?? [] };
    },
  });
  const tickets = data?.tickets ?? [];

  const createMutation = useMutation({
    mutationFn: () => authFetch("/support/tickets", {
      method: "POST",
      body: JSON.stringify({ subject, description, priority, category: category.trim() || undefined }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setDialogOpen(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
      setCategory("");
      toast.success(t("support.ticket_created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("support.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("support.subtitle")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("support.new_ticket")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("support.list_title")}</CardTitle>
          <CardDescription>{t("support.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          {isError && <QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} />}
          {!isLoading && !isError && tickets.length === 0 && (
            <EmptyState icon={LifeBuoy} title={t("support.empty_title")} description={t("support.empty_desc")} />
          )}
          {tickets.map(ticket => (
            <Link key={ticket.id} href={`/support/${ticket.id}`}>
              <div className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
                    <Badge variant={STATUS_VARIANT[ticket.status] ?? "outline"}>{t(`support.status_${ticket.status}`)}</Badge>
                  </div>
                  <div className="font-medium text-sm">{ticket.subject}</div>
                </div>
                <div className="text-end space-y-1">
                  <Badge variant="outline">{t(`support.priority_${ticket.priority}`)}</Badge>
                  <div className="text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {dialogOpen && (
        <Dialog open onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("support.new_ticket")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("support.subject")}</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.description")}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("support.priority")}</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue>{t(`support.priority_${priority}`)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map(p => <SelectItem key={p} value={p}>{t(`support.priority_${p}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("common.category")} ({t("common.optional")})</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button
                disabled={createMutation.isPending || !subject.trim() || !description.trim()}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? t("common.saving") : t("support.submit_ticket")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
