import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, PlayCircle, Radar, Save, Search, Upload } from "lucide-react";
import { useRef } from "react";
import { Switch } from "../ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useLanguage } from "../../context/language-context";

interface RouteItem {
  id: number;
  flightNumber: string;
  airlineCode: string;
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  distance: string;
  duration: string;
  fleetIds: number[];
  meta: {
    hubId: string | null;
    hubLabel: string | null;
    status: string;
    priority: string;
    notes: string;
  };
}

interface HubItem {
  id: string;
  icao: string;
  name: string;
}

interface AuditIssue {
  routeId: number;
  flight: string;
  sector: string;
  errors: string[];
}

interface AuditReport {
  generatedAt: string;
  navdataReady: boolean;
  totalRoutes: number;
  checkedRoutes: number;
  issueCount: number;
  issues: AuditIssue[];
}

interface AuditSettings {
  enabled: boolean;
  intervalHours: number;
  discordNotify: boolean;
  discordChannelId: string;
  lastRunAt?: string;
}

interface AuditNavdataInfo {
  ready: boolean;
  fixes: number;
  airways: number;
  dir: string;
  updatedAt?: string | null;
  ageDays?: number | null;
}

const NAVDATA_STALE_AFTER_DAYS = 28;

export function AdminRoutesPage() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [hubs, setHubs] = useState<HubItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [airlineFilter, setAirlineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingRoute, setEditingRoute] = useState<RouteItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hubId, setHubId] = useState("");
  const [status, setStatus] = useState("active");
  const [priority, setPriority] = useState("normal");
  const [notes, setNotes] = useState("");

  // Route network audit
  const [auditSettings, setAuditSettings] = useState<AuditSettings>({ enabled: false, intervalHours: 24, discordNotify: true, discordChannelId: "" });
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [auditNavdata, setAuditNavdata] = useState<AuditNavdataInfo | null>(null);
  const [isAuditRunning, setIsAuditRunning] = useState(false);
  const [isAuditSaving, setIsAuditSaving] = useState(false);
  const [isNavdataUploading, setIsNavdataUploading] = useState(false);
  const [navdataUploadError, setNavdataUploadError] = useState("");
  const navdataInputRef = useRef<HTMLInputElement>(null);

  const uploadNavdata = async (file: File) => {
    setIsNavdataUploading(true);
    setNavdataUploadError("");
    try {
      const lower = file.name.toLowerCase();
      let url = "";
      if (lower.endsWith(".zip")) url = "/api/admin/route-audit/navdata-archive";
      else if (lower.includes("fix")) url = "/api/admin/route-audit/navdata?file=fix";
      else if (lower.includes("awy") || lower.includes("airway")) url = "/api/admin/route-audit/navdata?file=awy";
      else {
        setNavdataUploadError(tr("Не удалось определить тип файла: ожидается .zip, earth_fix.dat или earth_awy.dat", "Cannot detect file type: expected .zip, earth_fix.dat or earth_awy.dat"));
        return;
      }
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.ok) {
        setNavdataUploadError(String(payload?.error || tr("Не удалось загрузить файл", "Upload failed")));
        return;
      }
      await loadAudit();
    } catch (error) {
      setNavdataUploadError(String(error || tr("Не удалось загрузить файл", "Upload failed")));
    } finally {
      setIsNavdataUploading(false);
      if (navdataInputRef.current) navdataInputRef.current.value = "";
    }
  };

  const loadAudit = async () => {
    try {
      const res = await fetch("/api/admin/route-audit", { credentials: "include" });
      if (!res.ok) return;
      const payload = await res.json();
      if (payload?.settings) setAuditSettings(payload.settings);
      if (payload?.report) setAuditReport(payload.report);
      if (payload?.navdata) setAuditNavdata(payload.navdata);
    } catch { /* ignore */ }
  };

  const saveAuditSettings = async () => {
    setIsAuditSaving(true);
    try {
      const res = await fetch("/api/admin/route-audit/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auditSettings),
      });
      const payload = res.ok ? await res.json() : null;
      if (payload?.settings) setAuditSettings(payload.settings);
    } finally {
      setIsAuditSaving(false);
    }
  };

  const runAuditNow = async () => {
    setIsAuditRunning(true);
    try {
      const res = await fetch("/api/admin/route-audit/run", { method: "POST", credentials: "include" });
      const payload = res.ok ? await res.json() : null;
      if (payload?.report) setAuditReport(payload.report);
    } finally {
      setIsAuditRunning(false);
    }
  };

  useEffect(() => { void loadAudit(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [routesResponse, hubsResponse] = await Promise.all([
        fetch("/api/admin/routes", { credentials: "include" }),
        fetch("/api/admin/content/hubs", { credentials: "include" }),
      ]);

      const routesPayload = routesResponse.ok ? await routesResponse.json() : { routes: [] };
      const hubsPayload = hubsResponse.ok ? await hubsResponse.json() : { items: [] };
      setRoutes(Array.isArray(routesPayload?.routes) ? routesPayload.routes : []);
      setHubs(Array.isArray(hubsPayload?.items) ? hubsPayload.items : []);
    } catch (error) {
      console.error("Failed to load routes admin data", error);
      setRoutes([]);
      setHubs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const airlineOptions = useMemo(() => Array.from(new Set(routes.map((item) => item.airlineCode).filter(Boolean))).sort(), [routes]);
  const statusOptions = useMemo(() => Array.from(new Set(routes.map((item) => item.meta?.status || "active"))).sort(), [routes]);

  const filteredRoutes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return routes.filter((item) => {
      const matchesSearch =
        !query ||
        [item.flightNumber, item.fromCode, item.toCode, item.fromName, item.toName]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesAirline = airlineFilter === "all" || item.airlineCode === airlineFilter;
      const matchesStatus = statusFilter === "all" || (item.meta?.status || "active") === statusFilter;
      return matchesSearch && matchesAirline && matchesStatus;
    });
  }, [airlineFilter, routes, search, statusFilter]);

  const openDialog = (route: RouteItem) => {
    setEditingRoute(route);
    setHubId(route.meta?.hubId || "none");
    setStatus(route.meta?.status || "active");
    setPriority(route.meta?.priority || "normal");
    setNotes(route.meta?.notes || "");
    setDialogOpen(true);
  };

  const saveMeta = async () => {
    if (!editingRoute) {
      return;
    }

    await fetch(`/api/admin/routes/${editingRoute.id}/meta`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hubId: hubId === "none" ? "" : hubId,
        status,
        priority,
        notes,
      }),
    });

    setDialogOpen(false);
    setEditingRoute(null);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{tr("Маршруты", "Routes")}</h2>
        <p className="text-sm text-gray-500">{tr("Операционный каталог маршрутов с метаданными хабов и приоритета.", "Operational route catalog with hub and priority metadata.")}</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Radar className="h-4 w-4 text-[#E31E24]" />
              {tr("Аудит маршрутной сети", "Route Network Audit")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <input
                ref={navdataInputRef}
                type="file"
                accept=".zip,.dat"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadNavdata(f); }}
              />
              <Button variant="outline" size="sm" onClick={() => navdataInputRef.current?.click()} disabled={isNavdataUploading}>
                {isNavdataUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                {tr("Загрузить AIRAC", "Upload AIRAC")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void runAuditNow()} disabled={isAuditRunning || !auditNavdata?.ready}>
                {isAuditRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                {tr("Запустить сейчас", "Run now")}
              </Button>
              <Button size="sm" onClick={() => void saveAuditSettings()} disabled={isAuditSaving} className="bg-[#E31E24] hover:bg-[#c91a1f]">
                {isAuditSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {tr("Сохранить", "Save")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {navdataUploadError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>{navdataUploadError}</div>
            </div>
          )}
          {!auditNavdata?.ready ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                {tr("Навигационная база не загружена. Установите её одним из способов: ", "Navigation database is not loaded. Install it either way: ")}
                <strong>{tr("1)", "1)")}</strong> {tr("нажмите «Загрузить AIRAC» и выберите ZIP-архив или файлы ", "click “Upload AIRAC” and pick a ZIP archive or the ")}
                <code className="font-mono text-xs">earth_fix.dat</code> / <code className="font-mono text-xs">earth_awy.dat</code>
                {tr(" (формат X-Plane / Navigraph); ", " files (X-Plane / Navigraph format); ")}
                <strong>{tr("2)", "2)")}</strong> {tr("или положите эти файлы вручную в папку ", "or place those files manually into ")}
                <code className="font-mono text-xs">data/navdata/</code>
                {tr(" на сервере и обновите страницу.", " on the server and refresh this page.")}
              </div>
            </div>
          ) : (
            <>
              {typeof auditNavdata.ageDays === "number" && auditNavdata.ageDays >= NAVDATA_STALE_AFTER_DAYS && (
                <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    {tr(
                      `Навигационная база не обновлялась ${auditNavdata.ageDays} дн. — AIRAC-цикл (28 дн.) истёк. Загрузите свежие earth_fix.dat и earth_awy.dat в data/navdata/.`,
                      `Navigation database is ${auditNavdata.ageDays} days old — the AIRAC cycle (28 days) has expired. Upload fresh earth_fix.dat and earth_awy.dat to data/navdata/.`
                    )}
                  </div>
                </div>
              )}
              <div className="text-xs text-gray-500">
                {tr("Навданные загружены:", "Navdata loaded:")} {auditNavdata.fixes.toLocaleString()} {tr("точек", "fixes")} · {auditNavdata.airways.toLocaleString()} {tr("трасс", "airways")}
                {auditNavdata.updatedAt ? <> · {tr("обновлены", "updated")} {new Date(auditNavdata.updatedAt).toLocaleDateString()}{typeof auditNavdata.ageDays === "number" ? ` (${auditNavdata.ageDays} ${tr("дн. назад", "days ago")})` : ""}</> : null}
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="text-sm font-medium text-gray-900">{tr("Автопроверка", "Auto-audit")}</div>
                <div className="text-[11px] text-gray-500">{tr("Запуск по расписанию", "Run on schedule")}</div>
              </div>
              <Switch checked={auditSettings.enabled} onCheckedChange={(checked) => setAuditSettings((prev) => ({ ...prev, enabled: Boolean(checked) }))} />
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-medium text-gray-900 mb-1">{tr("Интервал (часы)", "Interval (hours)")}</div>
              <Input
                type="number"
                min={1}
                max={168}
                value={auditSettings.intervalHours}
                onChange={(e) => setAuditSettings((prev) => ({ ...prev, intervalHours: Math.max(1, Number(e.target.value) || 24) }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="text-sm font-medium text-gray-900">{tr("Discord-сводка", "Discord summary")}</div>
                <div className="text-[11px] text-gray-500">{tr("Присылать отчёт ботом", "Send report via bot")}</div>
              </div>
              <Switch checked={auditSettings.discordNotify} onCheckedChange={(checked) => setAuditSettings((prev) => ({ ...prev, discordNotify: Boolean(checked) }))} />
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-sm font-medium text-gray-900 mb-1">{tr("Discord канал ID", "Discord channel ID")}</div>
              <Input
                value={auditSettings.discordChannelId}
                onChange={(e) => setAuditSettings((prev) => ({ ...prev, discordChannelId: e.target.value.trim() }))}
                placeholder={tr("по умолчанию — новости", "default — news channel")}
              />
            </div>
          </div>

          {auditReport && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2 text-sm">
                  {auditReport.issueCount === 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="font-semibold text-gray-900">
                    {auditReport.issueCount === 0
                      ? tr("Проблем не найдено", "No issues found")
                      : tr(`Проблем: ${auditReport.issueCount}`, `Issues: ${auditReport.issueCount}`)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {tr("проверено", "checked")} {auditReport.checkedRoutes}/{auditReport.totalRoutes}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{new Date(auditReport.generatedAt).toLocaleString()}</span>
              </div>
              {auditReport.issues.length > 0 && (
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                  {auditReport.issues.map((issue) => (
                    <div key={`${issue.routeId}-${issue.flight}`} className="px-4 py-2 flex items-start gap-3">
                      <div className="w-40 shrink-0">
                        <div className="font-semibold text-sm text-gray-900">{issue.flight}</div>
                        <div className="text-xs text-gray-500">{issue.sector}</div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-wrap gap-1.5 py-0.5">
                        {issue.errors.map((err, i) => (
                          <Badge key={i} variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 font-normal">{err}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder={tr("Поиск маршрутов...", "Search routes...")} value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={airlineFilter} onValueChange={setAirlineFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={tr("Авиакомпания", "Airline")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Все авиакомпании", "All airlines")}</SelectItem>
                  {airlineOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder={tr("Статус", "Status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Все статусы", "All statuses")}</SelectItem>
                  {statusOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr("Рейс", "Flight")}</TableHead>
                  <TableHead>{tr("Маршрут", "Route")}</TableHead>
                  <TableHead>{tr("Операции", "Ops")}</TableHead>
                  <TableHead>{tr("Метаданные", "Meta")}</TableHead>
                  <TableHead className="text-right">{tr("Действия", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-gray-500">{tr("Загрузка маршрутов...", "Loading routes...")}</TableCell>
                  </TableRow>
                ) : filteredRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-gray-500">{tr("Маршруты не найдены.", "No routes found.")}</TableCell>
                  </TableRow>
                ) : (
                  filteredRoutes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell>
                        <div className="font-medium text-gray-900">{route.flightNumber || "—"}</div>
                        <div className="text-xs text-gray-500">{route.airlineCode || "NWS"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-900">{route.fromCode} → {route.toCode}</div>
                        <div className="text-xs text-gray-500">{route.fromName} → {route.toName}</div>
                      </TableCell>
                      <TableCell>
                        <div>{route.distance}</div>
                        <div className="text-xs text-gray-500">{route.duration} · {route.fleetIds?.length || 0} {tr("привязок флота", "fleet refs")}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{route.meta?.status || "active"}</Badge>
                          <Badge variant="outline">{route.meta?.priority || "normal"}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{route.meta?.hubLabel || tr("Хаб не назначен", "No hub assigned")}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" onClick={() => openDialog(route)}>
                            <Pencil className="h-4 w-4" />
                            {tr("Изменить", "Edit")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr("Изменить метаданные маршрута", "Edit Route Metadata")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tr("Хаб", "Hub")}</Label>
              <Select value={hubId} onValueChange={setHubId}>
                <SelectTrigger>
                  <SelectValue placeholder={tr("Выберите хаб", "Select hub")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr("Без хаба", "No hub")}</SelectItem>
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id} value={hub.id}>
                      {hub.name} {hub.icao ? `(${hub.icao})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tr("Статус", "Status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{tr("Активен", "Active")}</SelectItem>
                  <SelectItem value="seasonal">{tr("Сезонный", "Seasonal")}</SelectItem>
                  <SelectItem value="paused">{tr("На паузе", "Paused")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tr("Приоритет", "Priority")}</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">{tr("Обычный", "Normal")}</SelectItem>
                  <SelectItem value="high">{tr("Высокий", "High")}</SelectItem>
                  <SelectItem value="critical">{tr("Критический", "Critical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{tr("Заметки", "Notes")}</Label>
              <Textarea className="min-h-32" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tr("Отмена", "Cancel")}</Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={saveMeta}>{tr("Сохранить", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}