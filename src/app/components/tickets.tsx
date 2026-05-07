import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Bell, LifeBuoy, Loader2, MessageSquare, PlusCircle } from "lucide-react";
import { useAuth } from "../context/auth-context";
import { useLanguage } from "../context/language-context";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface TicketConfigItem {
  id: string;
  name: string;
  description?: string;
  color?: string;
  enabled?: boolean;
}

interface TicketMessage {
  id: string;
  authorRole: "pilot" | "staff";
  authorName: string;
  authorUsername: string;
  content: string;
  createdAt: string;
}

interface Ticket {
  id: string;
  number: number;
  subject: string;
  categoryId: string;
  categoryName: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "critical";
  tags: string[];
  assigneeName?: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const statusMeta: Record<Ticket["status"], string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  resolved: "border-sky-200 bg-sky-50 text-sky-700",
  closed: "border-gray-200 bg-gray-50 text-gray-700",
};

export function TicketsPage() {
  const { isAuthenticated, isAuthLoading, loginWithDiscord } = useAuth();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketConfigItem[]>([]);
  const [tags, setTags] = useState<TicketConfigItem[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");

  const [subject, setSubject] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<Ticket["priority"]>("normal");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");

  const loadTickets = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [metaRes, ticketsRes] = await Promise.all([
        fetch("/api/tickets/meta", { credentials: "include" }),
        fetch("/api/tickets", { credentials: "include" }),
      ]);

      const metaPayload = metaRes.ok ? await metaRes.json() : {};
      const ticketsPayload = ticketsRes.ok ? await ticketsRes.json() : {};

      const nextCategories = Array.isArray(metaPayload?.categories) ? metaPayload.categories : [];
      setCategories(nextCategories);
      setTags(Array.isArray(metaPayload?.tags) ? metaPayload.tags : []);

      const nextTickets = Array.isArray(ticketsPayload?.tickets) ? ticketsPayload.tickets : [];
      setTickets(nextTickets);

      if (!categoryId && nextCategories.length > 0) {
        setCategoryId(String(nextCategories[0].id || ""));
      }
      if (!selectedTicketId && nextTickets.length > 0) {
        setSelectedTicketId(String(nextTickets[0].id || ""));
      }
      if (selectedTicketId && !nextTickets.some((item: Ticket) => item.id === selectedTicketId)) {
        setSelectedTicketId(nextTickets[0]?.id || "");
      }
    } catch {
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, categoryId, selectedTicketId]);

  useEffect(() => {
    loadTickets().catch(() => undefined);
  }, [loadTickets]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );

  const createTicket = async () => {
    if (!subject.trim() || !message.trim() || !categoryId) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, categoryId, message: message.trim(), content: message.trim(), priority }),
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const created = payload?.ticket;
      if (created?.id) {
        setSubject("");
        setMessage("");
        setSelectedTicketId(String(created.id));
        await loadTickets();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) {
      return;
    }

    setIsReplying(true);
    try {
      const response = await fetch(`/api/tickets/${encodeURIComponent(selectedTicket.id)}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      if (!response.ok) {
        return;
      }
      setReply("");
      await loadTickets();
    } finally {
      setIsReplying(false);
    }
  };

  const changeStatus = async (status: "open" | "closed") => {
    if (!selectedTicket) {
      return;
    }

    await fetch(`/api/tickets/${encodeURIComponent(selectedTicket.id)}/status`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadTickets();
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> {tr("Загрузка...", "Loading...")}
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14">
        <Card className="border-none shadow-sm">
          <CardContent className="p-10 text-center space-y-4">
            <LifeBuoy className="h-10 w-10 text-[#E31E24] mx-auto" />
            <h1 className="text-2xl font-bold text-gray-900">{tr("Тикеты поддержки", "Support Tickets")}</h1>
            <p className="text-gray-500">
              {tr("Для доступа к тикет-системе требуется авторизация через Discord.", "Discord authorization is required to access the ticket system.")}
            </p>
            <Button onClick={() => loginWithDiscord("/tickets", "login")} className="bg-[#E31E24] hover:bg-[#c91a1f]">
              {tr("Войти через Discord", "Sign in with Discord")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tr("Тикеты поддержки", "Support Tickets")}</h1>
          <p className="text-sm text-gray-500">{tr("История тикетов, ответы и статус обработки.", "Ticket history, replies and processing status.")}</p>
        </div>
        <Link to="/dashboard" className="text-sm text-[#E31E24] hover:underline">
          {tr("Вернуться в кабинет", "Back to dashboard")}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><PlusCircle className="h-4 w-4 text-[#E31E24]" /> {tr("Новый тикет", "New Ticket")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder={tr("Тема", "Subject")} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={180} />
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Категория", "Category")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(value) => setPriority(value as Ticket["priority"])}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Приоритет", "Priority")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{tr("Низкий", "Low")}</SelectItem>
                  <SelectItem value="normal">{tr("Обычный", "Normal")}</SelectItem>
                  <SelectItem value="high">{tr("Высокий", "High")}</SelectItem>
                  <SelectItem value="critical">{tr("Критический", "Critical")}</SelectItem>
                </SelectContent>
              </Select>
              <Textarea placeholder={tr("Опишите вашу проблему", "Describe your issue")} value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
              <Button className="w-full bg-[#E31E24] hover:bg-[#c91a1f]" onClick={createTicket} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {tr("Создать тикет", "Create ticket")}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-[#E31E24]" /> {tr("Мои тикеты", "My Tickets")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[420px] overflow-auto">
              {isLoading ? (
                <div className="text-sm text-gray-500 flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> {tr("Загрузка...", "Loading...")}</div>
              ) : tickets.length === 0 ? (
                <div className="text-sm text-gray-500">{tr("Тикетов пока нет.", "No tickets yet.")}</div>
              ) : (
                tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className={`w-full text-left rounded-lg border p-3 hover:bg-gray-50 ${selectedTicketId === ticket.id ? "border-[#E31E24] bg-red-50/40" : "border-gray-200"}`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm text-gray-900 truncate">#{ticket.number} {ticket.subject}</div>
                      {ticket.unreadCount > 0 ? <Badge className="bg-[#E31E24]">{ticket.unreadCount}</Badge> : null}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <Badge variant="outline" className={statusMeta[ticket.status]}>{tr(
                        ticket.status === "open" ? "Открыт" : ticket.status === "in_progress" ? "В работе" : ticket.status === "resolved" ? "Решён" : "Закрыт",
                        ticket.status
                      )}</Badge>
                      <span className="text-gray-400">{formatDateTime(ticket.updatedAt)}</span>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none shadow-sm min-h-[640px]">
            {selectedTicket ? (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-lg">#{selectedTicket.number} {selectedTicket.subject}</CardTitle>
                      <div className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={statusMeta[selectedTicket.status]}>{tr(
                          selectedTicket.status === "open" ? "Открыт" : selectedTicket.status === "in_progress" ? "В работе" : selectedTicket.status === "resolved" ? "Решён" : "Закрыт",
                          selectedTicket.status
                        )}</Badge>
                        <span>{selectedTicket.categoryName}</span>
                        <span>{tr("Обновлён", "Updated")}: {formatDateTime(selectedTicket.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {selectedTicket.status !== "closed" ? (
                        <Button variant="outline" onClick={() => changeStatus("closed")}>{tr("Закрыть", "Close")}</Button>
                      ) : (
                        <Button variant="outline" onClick={() => changeStatus("open")}>{tr("Переоткрыть", "Reopen")}</Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                    {selectedTicket.messages.map((item) => (
                      <div key={item.id} className={`rounded-xl border p-3 ${item.authorRole === "staff" ? "border-sky-200 bg-sky-50" : "border-gray-200 bg-white"}`}>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span className="font-medium text-gray-700">{item.authorName} ({item.authorRole === "staff" ? tr("персонал", "staff") : tr("пилот", "pilot")})</span>
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap text-gray-700">{item.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <Textarea placeholder={tr("Написать ответ", "Write a reply")} value={reply} onChange={(e) => setReply(e.target.value)} rows={4} />
                    <Button onClick={sendReply} disabled={isReplying || selectedTicket.status === "closed"} className="bg-[#E31E24] hover:bg-[#c91a1f]">
                      {isReplying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                      {tr("Отправить ответ", "Send reply")}
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="h-full min-h-[500px] flex items-center justify-center text-gray-500">
                {tr("Выберите тикет слева для просмотра деталей.", "Select a ticket on the left to view details.")}
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {tags.length > 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="p-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-500 mr-2">{tr("Доступные теги:", "Available tags:")}</span>
            {tags.map((tag) => (
              <Badge key={tag.id} variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{tag.name}</Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
