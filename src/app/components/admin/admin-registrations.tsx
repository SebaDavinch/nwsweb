import { useCallback, useEffect, useState } from "react";
import { CheckCircle, Loader2, RefreshCw, Search, UserCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { useLanguage } from "../../context/language-context";

interface Registration {
  id: number | string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  status?: string | null;
  created_at?: string | null;
  hub?: { name?: string } | null;
  reason?: string | null;
}

type ActionType = "approve" | "reject";

export function AdminRegistrations() {
  const { language } = useLanguage();
  const tr = useCallback((ru: string, en: string) => (language === "ru" ? ru : en), [language]);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionDialog, setActionDialog] = useState<{ reg: Registration; type: ActionType } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [actioning, setActioning] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/registrations", { credentials: "include" });
      const data = await res.json();
      setRegistrations(Array.isArray(data.registrations) ? data.registrations : []);
    } catch {
      toast.error(tr("Не удалось загрузить заявки", "Failed to load registrations"));
    } finally {
      setIsLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  const filtered = registrations.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || String(r.name || "").toLowerCase().includes(q)
      || String(r.username || "").toLowerCase().includes(q)
      || String(r.email || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleAction = async () => {
    if (!actionDialog) return;
    setActioning(true);
    try {
      const url = `/api/admin/registrations/${actionDialog.reg.id}/${actionDialog.type}`;
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: actionNote || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || res.statusText);
      }
      toast.success(actionDialog.type === "approve"
        ? tr("Заявка одобрена", "Registration approved")
        : tr("Заявка отклонена", "Registration rejected"));
      setActionDialog(null);
      setActionNote("");
      load();
    } catch (err) {
      toast.error(String((err as Error).message || err));
    } finally {
      setActioning(false);
    }
  };

  const statusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{tr("Ожидает", "Pending")}</Badge>;
      case "approved":
        return <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">{tr("Одобрена", "Approved")}</Badge>;
      case "rejected":
        return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{tr("Отклонена", "Rejected")}</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString(language === "ru" ? "ru-RU" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const pending = registrations.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{tr("Заявки на вступление", "Registrations")}</h2>
          <p className="text-sm text-gray-500">
            {pending > 0
              ? tr(`${pending} заявок ожидают рассмотрения`, `${pending} pending registration(s)`)
              : tr("Нет ожидающих заявок", "No pending registrations")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative w-full xl:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={tr("Поиск по имени, нику, email...", "Search by name, username, email...")}
                className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full xl:w-44">
                <SelectValue placeholder={tr("Статус", "Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("Все", "All")}</SelectItem>
                <SelectItem value="pending">{tr("Ожидают", "Pending")}</SelectItem>
                <SelectItem value="approved">{tr("Одобрены", "Approved")}</SelectItem>
                <SelectItem value="rejected">{tr("Отклонены", "Rejected")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{tr("Пилот", "Pilot")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Хаб", "Hub")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Дата", "Date")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Статус", "Status")}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    {tr("Заявки не найдены", "No registrations found")}
                  </td></tr>
                ) : filtered.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-gray-400 shrink-0" />
                        <div>
                          <div className="font-medium text-gray-900">{reg.name || reg.username || `#${reg.id}`}</div>
                          {reg.username && reg.name && <div className="text-xs text-gray-400">@{reg.username}</div>}
                          {reg.email && <div className="text-xs text-gray-400">{reg.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{reg.hub?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{fmt(reg.created_at)}</td>
                    <td className="px-4 py-3">{statusBadge(reg.status)}</td>
                    <td className="px-4 py-3">
                      {reg.status === "pending" && (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline"
                            className="h-7 border-green-200 text-green-700 hover:bg-green-50"
                            onClick={() => { setActionDialog({ reg, type: "approve" }); setActionNote(""); }}>
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                            {tr("Одобрить", "Approve")}
                          </Button>
                          <Button size="sm" variant="outline"
                            className="h-7 border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => { setActionDialog({ reg, type: "reject" }); setActionNote(""); }}>
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            {tr("Отклонить", "Reject")}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(actionDialog)} onOpenChange={(open) => { if (!open) setActionDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "approve"
                ? tr("Одобрить заявку", "Approve registration")
                : tr("Отклонить заявку", "Reject registration")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              {actionDialog?.type === "approve"
                ? tr(`Пилот «${actionDialog?.reg.name || actionDialog?.reg.username}» будет принят в ВАК.`, `Pilot "${actionDialog?.reg.name || actionDialog?.reg.username}" will be approved.`)
                : tr(`Заявка «${actionDialog?.reg.name || actionDialog?.reg.username}» будет отклонена.`, `Registration from "${actionDialog?.reg.name || actionDialog?.reg.username}" will be rejected.`)}
            </p>
            <div className="space-y-1">
              <Label>{tr("Примечание (необязательно)", "Note (optional)")}</Label>
              <Textarea rows={3} value={actionNote} onChange={(e) => setActionNote(e.target.value)}
                placeholder={actionDialog?.type === "approve"
                  ? tr("Добро пожаловать!", "Welcome aboard!")
                  : tr("Причина отказа...", "Reason for rejection...")} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} disabled={actioning}>{tr("Отмена", "Cancel")}</Button>
            <Button onClick={handleAction} disabled={actioning}
              className={actionDialog?.type === "approve"
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-[#E31E24] hover:bg-[#c41a20] text-white"}>
              {actioning && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {actionDialog?.type === "approve" ? tr("Одобрить", "Approve") : tr("Отклонить", "Reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
