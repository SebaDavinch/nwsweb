import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAdminNav } from "./admin-nav-context";
import { useLanguage } from "../../context/language-context";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  FileText,
  Filter,
  Loader2,
  MessageSquare,
  Plane,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { getCachedAdminBootstrap } from "./admin-bootstrap-cache";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PirepListItem {
  id: number;
  pilot_id?: number | null;
  booking_id?: number | null;
  route_id?: number | null;
  departure_airport_id?: number | null;
  arrival_airport_id?: number | null;
  callsign?: string | null;
  flight_number?: string | null;
  status?: string | null;
  type?: string | null;
  need_reply?: boolean;
  landing_rate?: number | null;
  landing_g?: number | null;
  flight_distance?: number | null;
  flight_length?: number | null;
  block_length?: number | null;
  credited_time?: number | null;
  fuel_used?: number | null;
  points?: number | null;
  bonus_sum?: number | null;
  network?: string | null;
  internal_note?: string | null;
  off_blocks_time?: string | null;
  departure_time?: string | null;
  landing_time?: string | null;
  on_blocks_time?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PirepComment {
  id: number;
  comment?: string | null;
  content?: string | null;
  commenter_id?: number | null;
  commenter_name?: string | null;
  hide_name?: boolean;
  created_at?: string | null;
}

interface PirepTouchdown {
  index?: number;
  landing_rate?: number | null;
  landing_g?: number | null;
  lat?: number | null;
  lon?: number | null;
  selected?: boolean;
  created_at?: string | null;
}

interface PirepPositionReport {
  id?: number;
  altitude?: number | null;
  magnetic_heading?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  groundspeed?: number | null;
  distance_remaining?: number | null;
  phase?: number | null;
  departure_time?: string | null;
  time_remaining?: string | null;
  network?: string | null;
  created_at?: string | null;
}

interface PirepStaffAction {
  id?: number;
  user_id?: number | null;
  action_type?: string | null;
  action_text?: string | null;
  created_at?: string | null;
}

interface PirepDetail extends PirepListItem {
  pirep_data?: Record<string, unknown> | null;
  log?: unknown[] | null;
  pilot?: {
    id?: number;
    username?: string;
    name?: string;
  } | null;
  booking?: {
    id?: number;
    callsign?: string;
    flight_number?: string;
  } | null;
  aircraft?: {
    id?: number;
    name?: string;
    registration?: string;
  } | null;
  fleet?: {
    id?: number;
    name?: string;
    code?: string;
  } | null;
  departure_airport?: {
    id?: number;
    icao?: string;
    iata?: string;
    name?: string;
  } | null;
  arrival_airport?: {
    id?: number;
    icao?: string;
    iata?: string;
    name?: string;
  } | null;
  comments?: PirepComment[];
  claim?: {
    id?: number;
    status?: string;
    message?: string;
    flight_number?: string;
  } | null;
  staff_actions?: PirepStaffAction[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  accepted: "default",
  auto_accepted: "default",
  rejected: "destructive",
  invalidated: "destructive",
  pending: "secondary",
  manual: "outline",
  complete: "default",
};

const fmtSeconds = (s: number | null | undefined) => {
  if (s == null || !Number.isFinite(Number(s))) return "—";
  const total = Math.round(Number(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m}m`;
};

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }); } catch { return iso; }
};

// ─── PIREP List ───────────────────────────────────────────────────────────────

export function AdminPireps() {
  const { navigateTo } = useAdminNav();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const initialBootstrap = getCachedAdminBootstrap();
  const [pireps, setPireps] = useState<PirepListItem[]>(() => Array.isArray(initialBootstrap?.pireps?.pireps) ? (initialBootstrap.pireps?.pireps as PirepListItem[]) : []);
  const [isLoading, setIsLoading] = useState(!Array.isArray(initialBootstrap?.pireps?.pireps));
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(() => String(initialBootstrap?.pireps?.meta?.next_cursor || "").trim() || null);
  const [currentCursor, setCurrentCursor] = useState<string>("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [filterNeedReply, setFilterNeedReply] = useState("__all__");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterType, setFilterType] = useState("__all__");
  const [pendingSearch, setPendingSearch] = useState("");

  const loadPireps = useCallback(async (cursor = "", force = false) => {
    setIsLoading(true);
    try {
      if (!force && !cursor && filterStatus === "__all__" && filterNeedReply === "__all__" && filterType === "__all__" && !filterSearch) {
        const cachedBootstrap = getCachedAdminBootstrap();
        if (Array.isArray(cachedBootstrap?.pireps?.pireps)) {
          setPireps(cachedBootstrap.pireps.pireps as PirepListItem[]);
          setNextCursor(String(cachedBootstrap?.pireps?.meta?.next_cursor || "").trim() || null);
          return;
        }
      }

      const params = new URLSearchParams();
      params.set("page[size]", "25");
      params.set("sort", "-id");
      if (cursor) params.set("page[cursor]", cursor);
      if (filterStatus && filterStatus !== "__all__") params.set("filter[status]", filterStatus);
      if (filterNeedReply !== "__all__") params.set("filter[need_reply]", filterNeedReply);
      if (filterType !== "__all__") params.set("filter[type]", filterType);
      if (filterSearch) {
        if (/^\d+$/.test(filterSearch.trim())) {
          params.set("filter[pilot_id]", filterSearch.trim());
        } else {
          params.set("filter[callsign]", filterSearch.trim());
        }
      }
      const resp = await fetch(`/api/admin/pireps?${params.toString()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { pireps?: PirepListItem[]; meta?: { next_cursor?: string | null } };
      setPireps(data.pireps || []);
      setNextCursor(data.meta?.next_cursor || null);
    } catch {
      toast.error(tr("Не удалось загрузить PIREP", "Failed to load PIREPs"));
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterNeedReply, filterType, filterSearch, tr]);

  useEffect(() => {
    setCurrentCursor("");
    setPrevCursors([]);
    void loadPireps("");
  }, [filterStatus, filterNeedReply, filterType, filterSearch, loadPireps]);

  const handleNextPage = () => {
    if (!nextCursor) return;
    setPrevCursors((prev) => [...prev, currentCursor]);
    setCurrentCursor(nextCursor);
    void loadPireps(nextCursor);
  };

  const handlePrevPage = () => {
    if (prevCursors.length === 0) return;
    const newPrev = [...prevCursors];
    const cursor = newPrev.pop() ?? "";
    setPrevCursors(newPrev);
    setCurrentCursor(cursor);
    void loadPireps(cursor);
  };

  const handleSearch = () => {
    setFilterSearch(pendingSearch.trim());
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{tr("Управление PIREP", "PIREP Management")}</h1>
        <Button size="sm" variant="outline" onClick={() => void loadPireps(currentCursor, true)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          {tr("Обновить", "Refresh")}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          <Input
            placeholder={tr("Позывной или Pilot ID…", "Callsign or Pilot ID…")}
            className="h-8 w-48 text-sm"
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          />
          <Button size="sm" variant="outline" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue placeholder={tr("Статус", "Status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr("Все статусы", "All statuses")}</SelectItem>
            <SelectItem value="pending">{tr("На проверке", "Pending")}</SelectItem>
            <SelectItem value="accepted">{tr("Принят", "Accepted")}</SelectItem>
            <SelectItem value="auto_accepted">{tr("Автопринят", "Auto-accepted")}</SelectItem>
            <SelectItem value="rejected">{tr("Отклонён", "Rejected")}</SelectItem>
            <SelectItem value="invalidated">{tr("Аннулирован", "Invalidated")}</SelectItem>
            <SelectItem value="manual">{tr("Ручной", "Manual")}</SelectItem>
            <SelectItem value="complete">{tr("Завершён", "Complete")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-36 text-sm">
            <SelectValue placeholder={tr("Тип", "Type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr("Все типы", "All types")}</SelectItem>
            <SelectItem value="regular">{tr("Обычный", "Regular")}</SelectItem>
            <SelectItem value="claim">{tr("Клейм", "Claim")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterNeedReply} onValueChange={setFilterNeedReply}>
          <SelectTrigger className="h-8 w-44 text-sm">
            <SelectValue placeholder={tr("Требует ответа", "Needs reply")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr("Все", "All")}</SelectItem>
            <SelectItem value="true">{tr("Требует ответа", "Needs reply")}</SelectItem>
            <SelectItem value="false">{tr("Не требует", "No reply needed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">{tr("Пилот", "Pilot")}</th>
              <th className="px-3 py-2">{tr("Рейс", "Flight")}</th>
              <th className="px-3 py-2">{tr("Маршрут", "Route")}</th>
              <th className="px-3 py-2">{tr("Статус", "Status")}</th>
              <th className="px-3 py-2">{tr("Посадка", "Landing")}</th>
              <th className="px-3 py-2">{tr("Очки", "Points")}</th>
              <th className="px-3 py-2">{tr("Дата", "Date")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : pireps.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted-foreground">{tr("PIREP не найдены", "No PIREPs found")}</td>
              </tr>
            ) : pireps.map((p) => (
              <tr
                key={p.id}
                className="border-b hover:bg-muted/20 cursor-pointer"
                onClick={() => navigateTo("pirep-detail", p.id)}
              >
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">#{p.id}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{p.callsign || `${tr("Пилот", "Pilot")} ${p.pilot_id || "?"}`}</div>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{p.flight_number || "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {p.departure_airport_id && p.arrival_airport_id
                    ? `${p.departure_airport_id} → ${p.arrival_airport_id}`
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Badge variant={STATUS_VARIANT[p.status || ""] ?? "outline"} className="text-xs capitalize">
                      {p.status || "—"}
                    </Badge>
                    {p.need_reply && <Bell className="h-3 w-3 text-orange-500" />}
                    {p.type === "claim" && <Badge variant="outline" className="text-xs">{tr("Клейм", "Claim")}</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.landing_rate != null ? `${p.landing_rate} fpm` : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {p.points != null ? p.points : "—"}
                  {p.bonus_sum ? <span className="text-green-600"> +{p.bonus_sum}</span> : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(p.created_at)}</td>
                <td className="px-3 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={(e) => { e.stopPropagation(); navigateTo("pirep-detail", p.id); }}
                  >
                    {tr("Открыть", "Open")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{pireps.length} {tr("записей", "records")}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handlePrevPage} disabled={prevCursors.length === 0 || isLoading}>
            <ChevronLeft className="h-4 w-4" />
            {tr("Назад", "Back")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleNextPage} disabled={!nextCursor || isLoading}>
            {tr("Вперед", "Next")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── PIREP Detail ─────────────────────────────────────────────────────────────

export function AdminPirepDetail({ pirepId: pirepIdProp }: { pirepId?: number }) {
  const { id: paramId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { navigateTo } = useAdminNav();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const pirepId = pirepIdProp || Number(paramId || searchParams.get("id") || 0) || 0;

  const [pirep, setPirep] = useState<PirepDetail | null>(null);
  const [isLoading, setIsLoading] = useState(pirepId > 0);
  const [isBusy, setIsBusy] = useState(false);

  // Tabs data
  const [positionReports, setPositionReports] = useState<PirepPositionReport[]>([]);
  const [isPosLoading, setIsPosLoading] = useState(false);
  const [touchdowns, setTouchdowns] = useState<PirepTouchdown[]>([]);
  const [isTdLoading, setIsTdLoading] = useState(false);

  // Comment state
  const [newComment, setNewComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Edit state
  const [editPoints, setEditPoints] = useState("");
  const [editBonus, setEditBonus] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editBlockLen, setEditBlockLen] = useState("");
  const [editFlightLen, setEditFlightLen] = useState("");

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Accept-claim dialog
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimHours, setClaimHours] = useState("");
  const [claimMinutes, setClaimMinutes] = useState("");
  const [claimPoints, setClaimPoints] = useState("");

  const loadPirep = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/admin/pireps/${pirepId}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { pirep?: PirepDetail };
      const p = data.pirep;
      if (!p) throw new Error("PIREP not found");
      setPirep(p);
      setEditPoints(String(p.points ?? ""));
      setEditBonus(String(p.bonus_sum ?? ""));
      setEditNote(p.internal_note || "");
      setEditBlockLen(String(p.block_length ?? ""));
      setEditFlightLen(String(p.flight_length ?? ""));
    } catch {
      toast.error(tr("Не удалось загрузить PIREP", "Failed to load PIREP"));
    } finally {
      setIsLoading(false);
    }
  }, [pirepId, tr]);

  const loadPositionReports = useCallback(async () => {
    setIsPosLoading(true);
    try {
      const resp = await fetch(`/api/admin/pireps/${pirepId}/position-reports`);
      const data = await resp.json() as { positionReports?: PirepPositionReport[] };
      setPositionReports(data.positionReports || []);
    } catch {
      toast.error(tr("Не удалось загрузить position reports", "Failed to load position reports"));
    } finally {
      setIsPosLoading(false);
    }
  }, [pirepId, tr]);

  const loadTouchdowns = useCallback(async () => {
    setIsTdLoading(true);
    try {
      const resp = await fetch(`/api/admin/pireps/${pirepId}/touchdowns`);
      const data = await resp.json() as { touchdowns?: PirepTouchdown[] };
      setTouchdowns(data.touchdowns || []);
    } catch {
      toast.error(tr("Не удалось загрузить touchdowns", "Failed to load touchdowns"));
    } finally {
      setIsTdLoading(false);
    }
  }, [pirepId, tr]);

  useEffect(() => {
    if (pirepId > 0) {
      void loadPirep();
      void loadTouchdowns();
    }
  }, [pirepId, loadPirep, loadTouchdowns]);

  const apiAction = async (path: string, method = "POST", body?: Record<string, unknown>) => {
    setIsBusy(true);
    try {
      const resp = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await resp.json() as { ok?: boolean; error?: string };
      if (!resp.ok || data.ok === false) throw new Error(data.error || `HTTP ${resp.status}`);
      return data;
    } finally {
      setIsBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!confirm(tr("Принять PIREP?", "Accept PIREP?"))) return;
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/accept`, "POST");
      toast.success(tr("PIREP принят", "PIREP accepted"));
      void loadPirep();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim() && !confirm(tr("Отклонить без причины?", "Reject without a reason?"))) return;
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/reject`, "POST", rejectReason ? { reason: rejectReason } : undefined);
      toast.success(tr("PIREP отклонён", "PIREP rejected"));
      setRejectDialogOpen(false);
      setRejectReason("");
      void loadPirep();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleInvalidate = async () => {
    if (!confirm(tr("Аннулировать PIREP? Это действие нельзя отменить.", "Invalidate PIREP? This action cannot be undone."))) return;
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/invalidate`, "POST");
      toast.success(tr("PIREP аннулирован", "PIREP invalidated"));
      void loadPirep();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleRejectClaim = async () => {
    if (!confirm(tr("Отклонить клейм?", "Reject claim?"))) return;
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/reject-claim`, "POST");
      toast.success(tr("Клейм отклонён", "Claim rejected"));
      void loadPirep();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleAcceptClaim = async () => {
    const hours = Number(claimHours);
    const minutes = Number(claimMinutes);
    const points = Number(claimPoints);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(points)) {
      toast.error(tr("Укажите корректные значения часов, минут и очков", "Enter valid values for hours, minutes, and points"));
      return;
    }
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/accept-claim`, "POST", { hours, minutes, points });
      toast.success(tr("Клейм принят", "Claim accepted"));
      setClaimDialogOpen(false);
      void loadPirep();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleReprocess = async () => {
    if (!confirm(tr("Запустить переобработку PIREP?", "Start PIREP reprocessing?"))) return;
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/reprocess`, "POST");
      toast.success(tr("Переобработка запущена", "Reprocessing started"));
      void loadPirep();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleNeedReply = async (value: boolean) => {
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/need-reply`, "PUT", { need_reply: value });
      toast.success(value ? tr("Отмечен для ответа", "Marked for reply") : tr("Пометка снята", "Mark removed"));
      setPirep((prev) => prev ? { ...prev, need_reply: value } : prev);
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleSavePoints = async () => {
    const val = Number(editPoints);
    if (!Number.isFinite(val)) { toast.error(tr("Укажите число", "Enter a number")); return; }
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/points`, "PUT", { points: val });
      toast.success(tr("Очки обновлены", "Points updated"));
      setPirep((prev) => prev ? { ...prev, points: val } : prev);
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleSaveBonus = async () => {
    const val = Number(editBonus);
    if (!Number.isFinite(val)) { toast.error(tr("Укажите число", "Enter a number")); return; }
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/bonus-points`, "PUT", { points: val });
      toast.success(tr("Бонусные очки обновлены", "Bonus points updated"));
      setPirep((prev) => prev ? { ...prev, bonus_sum: val } : prev);
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleSaveNote = async () => {
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/internal-note`, "PUT", { note: editNote });
      toast.success(tr("Заметка сохранена", "Note saved"));
      setPirep((prev) => prev ? { ...prev, internal_note: editNote } : prev);
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleSaveTimes = async () => {
    const block = Number(editBlockLen);
    const flight = Number(editFlightLen);
    if (!Number.isFinite(block) || !Number.isFinite(flight)) { toast.error(tr("Укажите корректные значения в секундах", "Enter valid values in seconds")); return; }
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/times`, "PUT", { block_length: block, flight_length: flight });
      toast.success(tr("Времена обновлены", "Times updated"));
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsAddingComment(true);
    try {
      const resp = await fetch(`/api/admin/pireps/${pirepId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      const data = await resp.json() as { ok?: boolean; error?: string };
      if (!resp.ok || data.ok === false) throw new Error(data.error || `HTTP ${resp.status}`);
      setNewComment("");
      toast.success(tr("Комментарий добавлен", "Comment added"));
      void loadPirep();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); } finally {
      setIsAddingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm(tr("Удалить комментарий?", "Delete comment?"))) return;
    try {
      const resp = await fetch(`/api/admin/pireps/${pirepId}/comments/${commentId}`, { method: "DELETE" });
      const data = await resp.json() as { ok?: boolean; error?: string };
      if (!resp.ok || data.ok === false) throw new Error(data.error || `HTTP ${resp.status}`);
      toast.success(tr("Комментарий удалён", "Comment deleted"));
      void loadPirep();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const handleSelectLanding = async (index: number) => {
    if (!confirm(tr(`Выбрать посадку #${index} как основную?`, `Set landing #${index} as primary?`))) return;
    try {
      await apiAction(`/api/admin/pireps/${pirepId}/select-landing`, "POST", { touchdown_index: index });
      toast.success(tr("Посадка выбрана", "Landing selected"));
      void loadPirep();
      void loadTouchdowns();
    } catch (e) { toast.error(String((e as Error).message || tr("Ошибка", "Error"))); }
  };

  const pilotLabel = useMemo(() => {
    if (!pirep) return "";
    if (pirep.pilot?.name) return `${pirep.pilot.name} (${pirep.pilot.username || pirep.pilot_id || ""})`;
    if (pirep.callsign) return pirep.callsign;
    return `${tr("Пилот", "Pilot")} #${pirep.pilot_id || "?"}`;
  }, [pirep, tr]);

  const depAirport = useMemo(() => (pirep?.departure_airport?.icao || String(pirep?.departure_airport_id || "")), [pirep]);
  const arrAirport = useMemo(() => (pirep?.arrival_airport?.icao || String(pirep?.arrival_airport_id || "")), [pirep]);
  const isActionable = pirep?.status && !["accepted", "auto_accepted", "complete"].includes(pirep.status);
  const isClaim = pirep?.type === "claim";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pirep) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {tr("PIREP не найден.", "PIREP not found.")} <Button variant="link" onClick={() => navigateTo("pireps")}>{tr("Вернуться к списку", "Back to list")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigateTo("pireps")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {tr("К списку", "Back to list")}
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            PIREP #{pirep.id}
            <Badge variant={STATUS_VARIANT[pirep.status || ""] ?? "outline"} className="capitalize">
              {pirep.status || tr("неизвестно", "unknown")}
            </Badge>
            {pirep.need_reply && <Badge variant="outline" className="border-orange-400 text-orange-600 gap-1"><Bell className="h-3 w-3" />{tr("Требует ответа", "Needs reply")}</Badge>}
            {isClaim && <Badge variant="outline">{tr("Клейм", "Claim")}</Badge>}
          </h1>
          <div className="text-sm text-muted-foreground">{pilotLabel} · {pirep.flight_number || "—"} · {depAirport} → {arrAirport}</div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void loadPirep()} disabled={isBusy}>
          <RefreshCw className={`h-4 w-4 ${isBusy ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {!isClaim && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAccept} disabled={isBusy}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {tr("Принять", "Accept")}
          </Button>
        )}
        {isClaim && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setClaimDialogOpen(true)} disabled={isBusy}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {tr("Принять клейм", "Accept claim")}
          </Button>
        )}
        {!isClaim && (
          <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={isBusy}>
            <XCircle className="h-4 w-4 mr-1" />
            {tr("Отклонить", "Reject")}
          </Button>
        )}
        {isClaim && (
          <Button size="sm" variant="destructive" onClick={handleRejectClaim} disabled={isBusy}>
            <XCircle className="h-4 w-4 mr-1" />
            {tr("Отклонить клейм", "Reject claim")}
          </Button>
        )}
        <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={handleInvalidate} disabled={isBusy}>
          <AlertTriangle className="h-4 w-4 mr-1" />
          {tr("Аннулировать", "Invalidate")}
        </Button>
        <Button size="sm" variant="outline" onClick={handleReprocess} disabled={isBusy}>
          <RefreshCw className="h-4 w-4 mr-1" />
          {tr("Переобработать", "Reprocess")}
        </Button>
        <Button
          size="sm"
          variant={pirep.need_reply ? "default" : "outline"}
          onClick={() => void handleNeedReply(!pirep.need_reply)}
          disabled={isBusy}
          className={pirep.need_reply ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
        >
          {pirep.need_reply ? <BellOff className="h-4 w-4 mr-1" /> : <Bell className="h-4 w-4 mr-1" />}
          {pirep.need_reply ? tr("Снять отметку", "Remove mark") : tr("Требует ответа", "Needs reply")}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{tr("Обзор", "Overview")}</TabsTrigger>
          <TabsTrigger value="comments">{tr("Комментарии", "Comments")} ({(pirep.comments || []).length})</TabsTrigger>
          <TabsTrigger value="edit">{tr("Редактирование", "Edit")}</TabsTrigger>
          <TabsTrigger value="touchdowns">{tr("Посадки", "Touchdowns")} ({touchdowns.length})</TabsTrigger>
          <TabsTrigger value="positions" onClick={() => { if (positionReports.length === 0) void loadPositionReports(); }}>
            {tr("Позиционные отчёты", "Position Reports")}
          </TabsTrigger>
          {(pirep.staff_actions?.length ?? 0) > 0 && (
            <TabsTrigger value="actions">{tr("Действия персонала", "Staff Actions")}</TabsTrigger>
          )}
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{tr("Рейс", "Flight")}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Номер", "Number")}</span><span className="font-medium">{pirep.flight_number || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Позывной", "Callsign")}</span><span className="font-medium">{pirep.callsign || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Отправление", "Departure")}</span><span className="font-medium">{pirep.departure_airport?.icao || depAirport || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Прибытие", "Arrival")}</span><span className="font-medium">{pirep.arrival_airport?.icao || arrAirport || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Сеть", "Network")}</span><span className="font-medium">{pirep.network || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Тип", "Type")}</span><span className="font-medium capitalize">{pirep.type || "—"}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{tr("Статистика", "Statistics")}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Посадка", "Landing")}</span><span className="font-medium">{pirep.landing_rate != null ? `${pirep.landing_rate} fpm` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">G-force</span><span className="font-medium">{pirep.landing_g != null ? pirep.landing_g : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Дистанция", "Distance")}</span><span className="font-medium">{pirep.flight_distance != null ? `${pirep.flight_distance} nm` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Время полёта", "Flight time")}</span><span className="font-medium">{fmtSeconds(pirep.flight_length)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Блочное время", "Block time")}</span><span className="font-medium">{fmtSeconds(pirep.block_length)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Топливо", "Fuel")}</span><span className="font-medium">{pirep.fuel_used != null ? `${pirep.fuel_used} kg` : "—"}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{tr("Очки и время", "Points & Times")}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Очки", "Points")}</span><span className="font-medium">{pirep.points ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Бонус", "Bonus")}</span><span className="font-medium text-green-600">{pirep.bonus_sum != null ? `+${pirep.bonus_sum}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Выход из стоянки", "Off blocks")}</span><span className="font-medium">{fmtDate(pirep.off_blocks_time)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Взлёт", "Takeoff")}</span><span className="font-medium">{fmtDate(pirep.departure_time)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Посадка", "Landing")}</span><span className="font-medium">{fmtDate(pirep.landing_time)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{tr("Постановка на стоянку", "On blocks")}</span><span className="font-medium">{fmtDate(pirep.on_blocks_time)}</span></div>
              </CardContent>
            </Card>

            {pirep.aircraft && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{tr("Воздушное судно", "Aircraft")}</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  <div>{pirep.aircraft.name || "—"}</div>
                  <div className="text-muted-foreground">{pirep.aircraft.registration || ""}</div>
                </CardContent>
              </Card>
            )}

            {pirep.claim && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{tr("Клейм", "Claim")}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">{tr("Статус", "Status")}</span><span className="capitalize font-medium">{pirep.claim.status}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{tr("Рейс", "Flight")}</span><span className="font-medium">{pirep.claim.flight_number || "—"}</span></div>
                  {pirep.claim.message && <div className="text-muted-foreground italic text-xs mt-1">{pirep.claim.message}</div>}
                </CardContent>
              </Card>
            )}

            {pirep.internal_note && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-800">{tr("Внутренняя заметка", "Internal Note")}</CardTitle></CardHeader>
                <CardContent className="text-sm text-yellow-900">{pirep.internal_note}</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Comments ── */}
        <TabsContent value="comments" className="space-y-3 pt-2">
          <div className="space-y-2">
            {(pirep.comments || []).length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">{tr("Комментариев нет", "No comments")}</div>
            )}
            {(pirep.comments || []).map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs text-muted-foreground">{c.hide_name ? tr("Анонимно", "Anonymous") : (c.commenter_name || `#${c.commenter_id || "?"}`)} · {fmtDate(c.created_at)}</div>
                  <div className="mt-0.5 break-words">{c.comment || c.content || ""}</div>
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => void handleDeleteComment(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder={tr("Добавить комментарий…", "Add a comment…")}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] text-sm"
            />
            <Button size="sm" variant="outline" onClick={handleAddComment} disabled={isAddingComment || !newComment.trim()} className="self-end">
              {isAddingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </TabsContent>

        {/* ── Edit ── */}
        <TabsContent value="edit" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{tr("Очки", "Points")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{tr("Основные очки", "Base points")}</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={editPoints} onChange={(e) => setEditPoints(e.target.value)} className="h-8 text-sm" />
                    <Button size="sm" variant="outline" onClick={handleSavePoints} disabled={isBusy}><Check className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{tr("Бонусные очки", "Bonus points")}</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={editBonus} onChange={(e) => setEditBonus(e.target.value)} className="h-8 text-sm" />
                    <Button size="sm" variant="outline" onClick={handleSaveBonus} disabled={isBusy}><Check className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{tr("Времена (секунды)", "Times (seconds)")}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{tr("Block time (сек)", "Block time (sec)")}</Label>
                  <Input type="number" value={editBlockLen} onChange={(e) => setEditBlockLen(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{tr("Flight time (сек)", "Flight time (sec)")}</Label>
                  <Input type="number" value={editFlightLen} onChange={(e) => setEditFlightLen(e.target.value)} className="h-8 text-sm" />
                </div>
                <Button size="sm" onClick={handleSaveTimes} disabled={isBusy}>
                  <Check className="h-4 w-4 mr-1" />{tr("Сохранить времена", "Save times")}
                </Button>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Внутренняя заметка</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="min-h-[80px] text-sm"
                  placeholder={tr("Внутренняя заметка для персонала…", "Internal staff note…")}
                />
                <Button size="sm" onClick={handleSaveNote} disabled={isBusy}>
                  <Check className="h-4 w-4 mr-1" />Сохранить заметку
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Touchdowns ── */}
        <TabsContent value="touchdowns" className="pt-2">
          {isTdLoading ? (
            <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : touchdowns.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Данных о посадках нет</div>
          ) : (
            <div className="space-y-2">
              {touchdowns.map((td, i) => (
                <div key={i} className={`flex items-center justify-between rounded-md border p-3 text-sm ${td.selected ? "border-green-400 bg-green-50" : ""}`}>
                  <div className="space-y-0.5">
                    <div className="font-medium">Посадка #{i} {td.selected && <Badge className="ml-1 bg-green-600 text-xs">Выбрана</Badge>}</div>
                    <div className="text-xs text-muted-foreground">
                      {td.landing_rate != null ? `${td.landing_rate} fpm` : ""}
                      {td.landing_g != null ? ` · ${td.landing_g}g` : ""}
                      {td.lat != null && td.lon != null ? ` · ${td.lat.toFixed(4)}, ${td.lon.toFixed(4)}` : ""}
                    </div>
                  </div>
                  {!td.selected && touchdowns.length > 1 && (
                    <Button size="sm" variant="outline" onClick={() => void handleSelectLanding(i)} disabled={isBusy}>
                      Выбрать
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Position Reports ── */}
        <TabsContent value="positions" className="pt-2">
          {isPosLoading ? (
            <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
          ) : positionReports.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Нет данных. <Button size="sm" variant="link" onClick={() => void loadPositionReports()}>Загрузить</Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[500px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-1.5">Время</th>
                    <th className="px-2 py-1.5">Высота</th>
                    <th className="px-2 py-1.5">Курс</th>
                    <th className="px-2 py-1.5">GS</th>
                    <th className="px-2 py-1.5">Lat</th>
                    <th className="px-2 py-1.5">Lon</th>
                    <th className="px-2 py-1.5">Осталось</th>
                  </tr>
                </thead>
                <tbody>
                  {positionReports.map((pr, i) => (
                    <tr key={pr.id ?? i} className="border-b hover:bg-muted/10">
                      <td className="px-2 py-1">{pr.departure_time || fmtDate(pr.created_at)}</td>
                      <td className="px-2 py-1">{pr.altitude != null ? `${pr.altitude} ft` : "—"}</td>
                      <td className="px-2 py-1">{pr.magnetic_heading != null ? `${pr.magnetic_heading}°` : "—"}</td>
                      <td className="px-2 py-1">{pr.groundspeed != null ? `${pr.groundspeed} kts` : "—"}</td>
                      <td className="px-2 py-1">{pr.latitude?.toFixed(3) ?? "—"}</td>
                      <td className="px-2 py-1">{pr.longitude?.toFixed(3) ?? "—"}</td>
                      <td className="px-2 py-1">{pr.distance_remaining != null ? `${pr.distance_remaining} nm` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Staff Actions ── */}
        {(pirep.staff_actions?.length ?? 0) > 0 && (
          <TabsContent value="actions" className="pt-2 space-y-2">
            {(pirep.staff_actions || []).map((a, i) => (
              <div key={a.id ?? i} className="rounded-md border p-3 text-sm">
                <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
                  <span>{a.action_type || tr("действие", "action")}</span>
                  <span>{fmtDate(a.created_at)}</span>
                </div>
                <div>{a.action_text || ""}</div>
              </div>
            ))}
          </TabsContent>
        )}
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Отклонить PIREP #{pirep.id}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Причина отклонения (необязательно)</Label>
            <Textarea
              placeholder={tr("Укажите причину…", "Enter reason…")}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Отмена</Button>
              <Button variant="destructive" onClick={handleReject} disabled={isBusy}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Отклонить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accept Claim Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Принять клейм PIREP #{pirep.id}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">Часы</Label><Input type="number" min="0" max="24" value={claimHours} onChange={(e) => setClaimHours(e.target.value)} /></div>
              <div><Label className="text-xs">Минуты</Label><Input type="number" min="0" max="59" value={claimMinutes} onChange={(e) => setClaimMinutes(e.target.value)} /></div>
              <div><Label className="text-xs">Очки</Label><Input type="number" min="0" value={claimPoints} onChange={(e) => setClaimPoints(e.target.value)} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>Отмена</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAcceptClaim} disabled={isBusy}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Принять
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
