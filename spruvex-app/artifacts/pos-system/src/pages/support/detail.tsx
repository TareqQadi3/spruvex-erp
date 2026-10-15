import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/QueryErrorState";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { authFetch } from "./index";

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
  description: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
}

interface SupportMessage {
  id: string;
  authorType: "customer" | "admin" | "system";
  body: string;
  createdAt: string;
}

export default function SupportTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id as string;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data: ticket, isLoading: ticketLoading, isError: ticketError, refetch: refetchTicket } = useQuery<SupportTicket>({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => authFetch(`/support/tickets/${ticketId}`),
  });

  const { data: messages, isLoading: messagesLoading, isError: messagesError, refetch: refetchMessages } = useQuery<SupportMessage[]>({
    queryKey: ["support-ticket-messages", ticketId],
    queryFn: () => authFetch(`/support/tickets/${ticketId}/messages`),
  });

  const replyMutation = useMutation({
    mutationFn: () => authFetch(`/support/tickets/${ticketId}/messages`, { method: "POST", body: JSON.stringify({ body: reply }) }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["support-ticket-messages", ticketId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => authFetch(`/support/tickets/${ticketId}/close`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast.success(t("support.ticket_closed"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (ticketLoading) return <div className="space-y-4 max-w-2xl"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (ticketError || !ticket) return <QueryErrorState message={t("common.error_load_data")} onRetry={() => refetchTicket()} />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/support">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
            <Badge variant={STATUS_VARIANT[ticket.status] ?? "outline"}>{t(`support.status_${ticket.status}`)}</Badge>
            <Badge variant="outline">{t(`support.priority_${ticket.priority}`)}</Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight">{ticket.subject}</h1>
        </div>
        {ticket.status === "resolved" && (
          <Button variant="outline" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
            <CheckCircle2 className="me-2 h-4 w-4" />
            {t("support.close_ticket")}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 text-sm whitespace-pre-wrap">{ticket.description}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("support.conversation")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {messagesLoading && [1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          {messagesError && <QueryErrorState message={t("common.error_load_data")} onRetry={() => refetchMessages()} />}
          {!messagesLoading && !messagesError && messages?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("support.no_messages")}</p>
          )}
          {messages?.map(msg => (
            <div
              key={msg.id}
              className={`rounded-lg border p-3 text-sm ${msg.authorType === "admin" ? "bg-primary/5 border-primary/20" : "bg-muted/30"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{msg.authorType === "admin" ? t("support.support_team") : t("support.you")}</span>
                <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{msg.body}</div>
            </div>
          ))}

          {ticket.status !== "closed" && (
            <div className="space-y-2 pt-2">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t("support.reply_placeholder")}
                rows={3}
              />
              <Button
                size="sm"
                disabled={replyMutation.isPending || !reply.trim()}
                onClick={() => replyMutation.mutate()}
              >
                <Send className="me-2 h-4 w-4" />
                {replyMutation.isPending ? t("common.saving") : t("support.send_reply")}
              </Button>
            </div>
          )}
          {ticket.status === "closed" && (
            <p className="text-xs text-muted-foreground pt-2">{t("support.ticket_is_closed")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
