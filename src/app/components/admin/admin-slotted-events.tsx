import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { CalendarDays, Clock, Loader2, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { useLanguage } from "../../context/language-context";

interface SlottedEventSlot {
  id: number;
  time: string;
  available: boolean;
  booked: boolean;
  registeredPilotId: number | null;
}

interface SlottedEvent {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  start: string | null;
  end: string | null;
  showFrom: string | null;
  slotInterval: number | null;
  points: number;
  registrationCount: number;
  departureAirport: string | null;
  arrivalAirport: string | null;
  hidden: boolean;
  slots: SlottedEventSlot[];
  totalSlots: number;
  availableSlots: number;
}

type EditorMode = "create" | "edit";

const emptyForm = (): Partial<SlottedEvent> => ({
  name: "",
  description: "",
  image: "",
  start: new Date().toISOString().slice(0, 16),
  end: new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 16),
  showFrom: new Date().toISOString().slice(0, 16),
  slotInterval: 5,
  points: 100,
  departureAirport: "",
  arrivalAirport: "",
  hidden: false,
});

const fmtDt = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
};

export function AdminSlottedEvents() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [, setSearchParams] = useSearchParams();

  const [events, setEvents] = useState<SlottedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<SlottedEvent>>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const r = await fetch("/api/admin/slotted-events", { credentials: "include" });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error || "Failed");
      setEvents(Array.isArray(payload?.slottedEvents) ? payload.slottedEvents : []);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setForm(emptyForm());
    setEditorMode("create");
    setEditingId(null);
    setEditorOpen(true);
  };

  const openEdit = async (ev: SlottedEvent) => {
    setForm({
      name: ev.name,
      description: ev.description || "",
      image: ev.image || "",
      start: ev.start?.slice(0, 16) || "",
      end: ev.end?.slice(0, 16) || "",
      showFrom: ev.showFrom?.slice(0, 16) || "",
      slotInterval: ev.slotInterval || 5,
      points: ev.points,
      departureAirport: ev.departureAirport || "",
      arrivalAirport: ev.arrivalAirport || "",
      hidden: ev.hidden,
    });
    setEditorMode("edit");
    setEditingId(ev.id);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error(tr("Введите название", "Name is required")); return; }
    setIsSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        image: form.image || null,
        start: form.start ? new Date(form.start).toISOString() : null,
        end: form.end ? new Date(form.end).toISOString() : null,
        showFrom: form.showFrom ? new Date(form.showFrom).toISOString() : null,
        slotInterval: Number(form.slotInterval) || 5,
        points: Number(form.points) || 0,
        departureAirport: form.departureAirport || null,
        arrivalAirport: form.arrivalAirport || null,
        hidden: Boolean(form.hidden),
      };
      const url = editorMode === "edit" ? `/api/admin/slotted-events/${editingId}` : "/api/admin/slotted-events";
      const r = await fetch(url, {
        method: editorMode === "edit" ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error || "Failed");
      toast.success(editorMode === "edit" ? tr("Сохранено", "Saved") : tr("Создан", "Created"));
      setEditorOpen(false);
      void load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(true);
    try {
      const r = await fetch(`/api/admin/slotted-events/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      toast.success(tr("Удалено", "Deleted"));
      setDeleteId(null);
      void load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setIsDeleting(false);
    }
  };

  const field = (key: keyof SlottedEvent, label: string, type: "text" | "number" | "datetime-local" | "textarea" = "text") => (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500 uppercase tracking-wide">{label}</Label>
      {type === "textarea" ? (
        <Textarea
          value={String(form[key] ?? "")}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          rows={3}
          className="text-sm"
        />
      ) : (
        <Input
          type={type}
          value={String(form[key] ?? "")}
          onChange={(e) => setForm((f) => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
          className="text-sm"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tr("Слотовые ивенты", "Slotted Events")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {tr("Координированные мероприятия с фиксированными слотами вылета", "Coordinated events with fixed departure slots")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {tr("Обновить", "Refresh")}
          </Button>
          <Button size="sm" className="bg-[#E31E24] text-white hover:bg-[#c21920]" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            {tr("Создать ивент", "Create Event")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <CalendarDays className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">{tr("Нет слотовых ивентов", "No slotted events yet")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Left: info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{ev.name}</span>
                  {ev.hidden && <Badge variant="outline" className="text-[10px] text-gray-400">Hidden</Badge>}
                  <Badge className="bg-sky-100 text-sky-700 border-sky-200 text-[10px]">
                    {ev.points} pts
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {fmtDt(ev.start)} — {fmtDt(ev.end)}
                  </span>
                  {ev.slotInterval && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {ev.slotInterval} {tr("мин/слот", "min/slot")}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {ev.registrationCount} {tr("рег.", "reg.")}
                  </span>
                  {ev.departureAirport && (
                    <span className="font-mono">{ev.departureAirport}{ev.arrivalAirport ? ` → ${ev.arrivalAirport}` : ""}</span>
                  )}
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchParams({ page: "slotted-event-detail", id: String(ev.id) })}
                >
                  {tr("Просмотр", "View")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void openEdit(ev)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setDeleteId(ev.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editorMode === "edit" ? tr("Редактировать ивент", "Edit Event") : tr("Новый слотовый ивент", "New Slotted Event")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {field("name", tr("Название", "Name"))}
            {field("description", tr("Описание (Markdown)", "Description (Markdown)"), "textarea")}
            {field("image", tr("URL изображения", "Image URL"))}
            <div className="grid grid-cols-2 gap-3">
              {field("start", tr("Начало (UTC)", "Start (UTC)"), "datetime-local")}
              {field("end", tr("Конец (UTC)", "End (UTC)"), "datetime-local")}
            </div>
            {field("showFrom", tr("Показывать с (UTC)", "Show From (UTC)"), "datetime-local")}
            <div className="grid grid-cols-2 gap-3">
              {field("slotInterval", tr("Интервал слотов (мин)", "Slot interval (min)"), "number")}
              {field("points", tr("Баллы", "Points"), "number")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("departureAirport", tr("Аэропорт вылета (ICAO)", "Departure airport (ICAO)"))}
              {field("arrivalAirport", tr("Аэропорт прилёта (ICAO)", "Arrival airport (ICAO)"))}
            </div>
            <div className="flex items-center gap-2">
              <input
                id="hidden-toggle"
                type="checkbox"
                checked={Boolean(form.hidden)}
                onChange={(e) => setForm((f) => ({ ...f, hidden: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="hidden-toggle" className="text-sm">{tr("Скрытый ивент", "Hidden event")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>
              {tr("Отмена", "Cancel")}
            </Button>
            <Button
              className="bg-[#E31E24] text-white hover:bg-[#c21920]"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tr("Сохранить", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{tr("Удалить ивент?", "Delete event?")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            {tr("Ивент будет удалён из vAMSYS. Это действие необратимо.", "The event will be deleted from vAMSYS. This cannot be undone.")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
              {tr("Отмена", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && void handleDelete(deleteId)}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tr("Удалить", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
