import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/QueryErrorState";
import { ArrowLeft, Send } from "lucide-react";
import { useTranslation } from "@/i18n";
import { platformFetch } from "../platformFetch";

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  companyId: string;
  assignedToId: string | null;
  createdAt: string;
}

interface SupportMessage {
  id: string;
  authorType: "customer" | "admin" | "system";
  body: string;
  isInternalNote: boolean;
  createdAt: string;
}

const STATUSES = ["open", "pending", "in_progress", "resolved", "closed"];

export default function PlatformSupportTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id as string;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [assignId, setAssignId] = useState("");

  const { data: ticket, isLoading, isError, refetch } = useQuery<SupportTicket>({
    queryKey: ["platform-ticket", ticketId],
    queryFn: () => platformFetch(`/support/tickets/${ticketId}`),
  });

  const { data: messages, refetch: refetchMessages } = useQuery<SupportMessage[]>({
    queryKey: ["platform-ticket-messages", ticketId],
    queryFn: () => platformFetch(`/support/tickets/${ticketId}/messages`),
  });

  const replyMutation = useMutation({
    mutationFn: () => platformFetch(`/support/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ body: reply, isInternalNote: isInternal }) }),
    onSuccess: () => { setReply(""); refetchMessages(); queryClient.invalidateQueries({ queryKey: ["platform-ticket", ticketId] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => platformFetch(`/support/tickets/${ticketId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-ticket", ticketId] }); toast.success(t("platform.status_changed")); },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: () => platformFetch(`/support/tickets/${ticketId}/assign`, { method: "PATCH", body: JSON.stringify({ assignedToId: assignId }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["platform-ticket", ticketId] }); toast.success(t("platform.assigned")); },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !ticket) return <QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} />;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/platform/support">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
            <span className="text-xs text-muted-foreground font-mono">· {ticket.companyId}</span>
          </div>
          <h1 className="text-lg font-bold">{ticket.subject}</h1>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 text-sm whitespace-pre-wrap">{ticket.description}</CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("common.status")}</CardTitle></CardHeader>
          <CardContent>
            <Select value={ticket.status} onValueChange={(v) => statusMutation.mutate(v)}>
              <SelectTrigger><SelectValue>{t(`support.status_${ticket.status}`)}</SelectValue></SelectTrigger>
              <SelectContent>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`support.status_${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">{t("platform.assign_section")}</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder={t("platform.user_id_placeholder")} value={assignId} onChange={e => setAssignId(e.target.value)} />
            <Button size="sm" variant="outline" onClick={() => assignMutation.mutate()} disabled={!assignId.trim()}>{t("platform.assign_button")}</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("support.conversation")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {messages?.map(msg => (
            <div
              key={msg.id}
              className={`rounded-lg border p-3 text-sm ${msg.isInternalNote ? "bg-amber-500/10 border-amber-500/30" : msg.authorType === "admin" ? "bg-primary/5 border-primary/20" : "bg-muted/30"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  {msg.authorType === "admin" ? t("support.support_team") : t("platform.customer")}
                  {msg.isInternalNote && <Badge variant="outline" className="text-[10px]">{t("platform.internal_note")}</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{msg.body}</div>
            </div>
          ))}

          <div className="space-y-2 pt-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t("support.reply_placeholder")} rows={3} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={isInternal} onCheckedChange={(v) => setIsInternal(Boolean(v))} />
                {t("platform.internal_note_toggle")}
              </label>
              <Button size="sm" disabled={replyMutation.isPending || !reply.trim()} onClick={() => replyMutation.mutate()}>
                <Send className="me-2 h-4 w-4" />
                {replyMutation.isPending ? t("common.saving") : t("support.send_reply")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
