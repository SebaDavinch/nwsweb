import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, RefreshCcw } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Button } from "../ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "../ui/chart";
import { Textarea } from "../ui/textarea";
import { LiveMap } from "../live-map";
import { PassengerManifest } from "./passenger-manifest";

interface TelemetryPoint {
  lat: number;
  lon: number;
  altitude?: number | null;
  heading?: number | null;
  ts?: number | null;
}

interface FlightProfilePoint { x: number; y: number; }
interface FlightProfileAnnotation {
  id: number; x: number; label: string;
  category?: string | null; color?: string | null; num?: number | null;
}
interface FlightProfile {
  altitude?: FlightProfilePoint[];
  groundspeed?: FlightProfilePoint[];
  annotations?: FlightProfileAnnotation[];
}

interface PirepDetail {
  id: number;
  bookingId?: number | null;
  routeId?: number | null;
  aircraftId?: number | null;
  flightNumber: string;
  callsign?: string | null;
  pilot?: string | null;
  pilotId?: number | null;
  rank?: string | null;
  departure: string;
  departureName?: string | null;
  departureLat?: number | null;
  departureLon?: number | null;
  arrival: string;
  arrivalName?: string | null;
  arrivalLat?: number | null;
  arrivalLon?: number | null;
  aircraft: string;
  aircraftModel?: string | null;
  aircraftRegistration?: string | null;
  flightTime?: string | null;
  blockTime?: string | null;
  distance?: string | null;
  distanceNm?: number | null;
  landing?: string | null;
  landingRate?: number | null;
  status?: string | null;
  network?: string | null;
  score?: number | null;
  points?: number | null;
  pointsBreakdown?: Array<{ label: string; value: number }> | null;
  comments?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  passengers?: number | null;
  cargo?: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  progress?: number | null;
  currentLat?: number | null;
  currentLon?: number | null;
  hasLiveTelemetry?: boolean;
  telemetryTrack?: TelemetryPoint[];
  flightProfile?: FlightProfile | null;
  vac: "NWS" | "KAR" | "STW";
}

interface PilotPirepDetailProps {
  pirepId: number | null;
  onBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDt = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fmtTime = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
};

const fmtElapsed = (s: number) => {
  const t = Math.max(0, Math.round(Number(s) || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), ss = t % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

const statusColor = (s?: string | null) => {
  const v = (s || "").toLowerCase();
  if (v === "accepted" || v === "approved") return "bg-green-100 text-green-700 border-green-200";
  if (v === "rejected") return "bg-red-100 text-red-700 border-red-200";
  if (v === "pending" || v === "review") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-gray-100 text-gray-600 border-gray-200";
};

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, defaultOpen = true, badge, children }: {
  title: string; defaultOpen?: boolean; badge?: string | number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wider text-gray-600">{title}</span>
          {badge !== undefined && (
            <span className="rounded-full bg-[#E31E24] px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────────
function Stat({ label, value, sub }: { label: string; value?: string | number | null; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-gray-900">{value ?? "—"}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

// ── Chart config ──────────────────────────────────────────────────────────────
const chartConfig = {
  altitude: { label: "Altitude (ft)", color: "#E31E24" },
  groundspeed: { label: "Ground speed (kt)", color: "#2563eb" },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────
export function PilotPirepDetail({ pirepId, onBack }: PilotPirepDetailProps) {
  const [detail, setDetail] = useState<PirepDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState(false);

  useEffect(() => {
    if (!pirepId || pirepId <= 0) { setDetail(null); return; }
    let active = true;
    setIsLoading(true); setError(null);
    fetch(`/api/pilot/pireps/${pirepId}`, { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((payload) => {
        if (!active) return;
        if (payload?.pirep) setDetail(payload.pirep);
        else setError(payload?.error || "PIREP not found");
      })
      .catch((e) => { if (active) setError(String(e)); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [pirepId]);

  const selectedFlight = useMemo(() => {
    if (!detail) return null;
    return {
      id: detail.id, flightNumber: detail.callsign || detail.flightNumber,
      departure: detail.departure, departureCity: detail.departureName || detail.departure,
      destination: detail.arrival, destinationCity: detail.arrivalName || detail.arrival,
      status: detail.status || "Completed", pilot: detail.pilot || "Pilot",
      pilotId: detail.pilotId || null, aircraft: detail.aircraft,
      progress: Number.isFinite(Number(detail.progress)) ? Number(detail.progress) : 100,
      vac: detail.vac, etd: detail.departureTime || undefined,
      ete: detail.flightTime || undefined, eta: detail.arrivalTime || detail.completedAt || undefined,
      heading: detail.heading ?? null, speed: detail.speed ?? null,
      altitude: detail.altitude ?? null, currentLat: detail.currentLat ?? null,
      currentLon: detail.currentLon ?? null, aircraftRegistration: detail.aircraftRegistration || undefined,
      network: detail.network || undefined, hasLiveTelemetry: Boolean(detail.hasLiveTelemetry),
      telemetryTrack: Array.isArray(detail.telemetryTrack) ? detail.telemetryTrack : [],
      departureLat: detail.departureLat ?? null, departureLon: detail.departureLon ?? null,
      arrivalLat: detail.arrivalLat ?? null, arrivalLon: detail.arrivalLon ?? null,
    };
  }, [detail]);

  const flightProfileData = useMemo(() => {
    const profile = detail?.flightProfile;
    const altitudeSeries = Array.isArray(profile?.altitude) ? profile.altitude : [];
    const groundspeedSeries = Array.isArray(profile?.groundspeed) ? profile.groundspeed : [];
    const annotations = Array.isArray(profile?.annotations) ? profile.annotations : [];
    const rawPoints = [...altitudeSeries, ...groundspeedSeries].map((p) => Number(p?.x || 0)).filter(Number.isFinite);
    const maxRawX = rawPoints.length ? Math.max(...rawPoints) : 0;
    const norm = (x: number) => (maxRawX > 172800 ? x / 1000 : x);
    const map = new Map<number, { elapsed: number; altitude: number | null; groundspeed: number | null }>();
    altitudeSeries.forEach((p) => {
      const e = norm(Number(p.x || 0));
      if (!Number.isFinite(e)) return;
      const ex = map.get(e) || { elapsed: e, altitude: null, groundspeed: null };
      ex.altitude = Number.isFinite(Number(p.y)) ? Number(p.y) : null;
      map.set(e, ex);
    });
    groundspeedSeries.forEach((p) => {
      const e = norm(Number(p.x || 0));
      if (!Number.isFinite(e)) return;
      const ex = map.get(e) || { elapsed: e, altitude: null, groundspeed: null };
      ex.groundspeed = Number.isFinite(Number(p.y)) ? Number(p.y) : null;
      map.set(e, ex);
    });
    const chartData = Array.from(map.values()).sort((a, b) => a.elapsed - b.elapsed);
    const normalizedAnnotations = annotations
      .map((a) => ({ ...a, x: norm(Number(a?.x || 0)) }))
      .filter((a) => Number.isFinite(a.x))
      .sort((a, b) => a.x - b.x);
    return { chartData, annotations: normalizedAnnotations, hasData: chartData.some((d) => d.altitude !== null || d.groundspeed !== null) };
  }, [detail]);

  const handleSubmitComment = async () => {
    if (!pirepId || isSubmittingComment) return;
    const content = commentDraft.trim();
    if (!content) { setCommentError("Введите текст комментария."); return; }
    setIsSubmittingComment(true); setCommentError(null); setCommentSuccess(false);
    try {
      const r = await fetch(`/api/pilot/pireps/${pirepId}/comments`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error || "Failed to submit comment");
      const text = String(payload?.comment?.content || content).trim();
      setDetail((prev) => prev ? { ...prev, comments: prev.comments ? `${prev.comments}\n\n${text}` : text } : prev);
      setCommentDraft(""); setCommentSuccess(true);
    } catch (e) { setCommentError(String(e instanceof Error ? e.message : e)); }
    finally { setIsSubmittingComment(false); }
  };

  // ── Guard states ─────────────────────────────────────────────────────────
  if (!pirepId) return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />К рейсам</Button>
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-400">Выберите PIREP для просмотра.</div>
    </div>
  );

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-sm text-gray-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />Загружаем PIREP...
    </div>
  );

  if (error || !detail || !selectedFlight) return (
    <div className="space-y-4">
      <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />К рейсам</Button>
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">{error || "PIREP недоступен."}</div>
    </div>
  );

  const pointsBreakdown = Array.isArray(detail.pointsBreakdown) && detail.pointsBreakdown.length > 0
    ? detail.pointsBreakdown
    : null;

  return (
    <div className="space-y-4">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />К рейсам</Button>
      </div>

      {/* Status header */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-6 py-4">
        <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">PIREP STATUS</div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase ${statusColor(detail.status)}`}>
              {detail.status || "Completed"}
            </span>
          </div>
          <div>
            <div className="text-[10px] uppercase text-gray-400">Пилот</div>
            <div className="text-sm font-bold text-gray-900">
              {detail.callsign && <span className="mr-1 text-gray-500">{detail.callsign} ·</span>}
              {detail.pilot || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-gray-400">Рейс</div>
            <div className="font-mono text-sm font-bold text-gray-900">{detail.flightNumber}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-gray-400">Маршрут</div>
            <div className="font-mono text-sm font-bold text-gray-900">{detail.departure} → {detail.arrival}</div>
          </div>
          {detail.rank && (
            <div>
              <div className="text-[10px] uppercase text-gray-400">Ранг</div>
              <div className="text-sm font-medium text-gray-700">{detail.rank}</div>
            </div>
          )}
          {detail.score != null && (
            <div className="ml-auto">
              <div className="text-[10px] uppercase text-gray-400 text-right">Счёт</div>
              <div className="text-2xl font-bold text-[#E31E24]">{detail.score}</div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      {Array.isArray(detail.telemetryTrack) && detail.telemetryTrack.length >= 2 ? (
        <Section title="Карта рейса" defaultOpen={true}>
          <div className="h-[380px]">
            <LiveMap flights={[selectedFlight]} selectedFlight={selectedFlight} />
          </div>
        </Section>
      ) : null}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">

        {/* ── Left column ───────────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">

          {/* Flight info */}
          <Section title="Информация о рейсе" defaultOpen={true}>
            <div className="px-5 py-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              <Stat label="Коллсайн" value={detail.callsign || detail.flightNumber} />
              <Stat label="Тип" value="Scheduled" />
              <Stat label="Сеть" value={detail.network || "Offline"} />
              <Stat label="Воздушное судно" value={detail.aircraftRegistration || "—"} sub={detail.aircraftModel || detail.aircraft} />
              <Stat label="Рейс" value={detail.departure} sub={detail.departureName || undefined} />
              <Stat label="Прибытие" value={detail.arrival} sub={detail.arrivalName || undefined} />
              <Stat label="Дата" value={fmtDt(detail.departureTime || detail.createdAt)} />
              <Stat label="Завершён" value={fmtDt(detail.completedAt || detail.arrivalTime)} />
            </div>
          </Section>

          {/* Timeline */}
          <Section title="Таймлайн" defaultOpen={true}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wider text-gray-400">
                    <th className="px-5 py-2.5 text-left font-semibold">Событие</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Факт</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Запланировано</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { label: "Вылет (STD)", actual: fmtTime(detail.departureTime), sched: fmtTime(detail.departureTime) },
                    { label: "Время в воздухе", actual: detail.flightTime || "—", sched: "—" },
                    { label: "Блок-время", actual: detail.blockTime || "—", sched: "—" },
                    { label: "Дистанция", actual: detail.distance || "—", sched: "—" },
                    { label: "Прилёт (STA)", actual: fmtTime(detail.arrivalTime || detail.completedAt), sched: "—" },
                  ].map(({ label, actual, sched }) => (
                    <tr key={label} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5 font-medium text-gray-700">{label}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">{actual}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{sched}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Performance */}
          <Section title="Характеристики посадки" defaultOpen={true}>
            <div className="px-5 py-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              <Stat label="Скорость касания" value={detail.landingRate != null ? `${detail.landingRate} fpm` : "—"} />
              <Stat label="Посадка" value={detail.landing || "—"} />
              <Stat label="Дистанция" value={detail.distance || "—"} />
              <Stat label="Точки" value={detail.points ?? "—"} />
            </div>
          </Section>

          {/* Flight profile chart */}
          {flightProfileData.hasData && (
            <Section title="Профиль полёта" defaultOpen={false}>
              <div className="px-5 py-4">
                {flightProfileData.annotations.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {flightProfileData.annotations.map((a) => (
                      <span key={`${a.id}-${a.x}`} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500">
                        {fmtElapsed(a.x)} · {a.label}
                      </span>
                    ))}
                  </div>
                )}
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <LineChart data={flightProfileData.chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="elapsed" tickLine={false} axisLine={false} minTickGap={32}
                      tickFormatter={(v) => fmtElapsed(Number(v || 0))} />
                    <YAxis yAxisId="altitude" tickLine={false} axisLine={false} width={64}
                      tickFormatter={(v) => `${Math.round(Number(v || 0) / 1000)}k`} />
                    <YAxis yAxisId="groundspeed" orientation="right" tickLine={false} axisLine={false} width={48}
                      tickFormatter={(v) => `${Math.round(Number(v || 0))}`} />
                    <ChartTooltip cursor={false} content={
                      <ChartTooltipContent
                        labelFormatter={(_, p) => `Elapsed ${fmtElapsed(Number(p?.[0]?.payload?.elapsed || 0))}`}
                        formatter={(v, n) => n === "altitude" ? `${Math.round(Number(v || 0)).toLocaleString()} ft` : `${Math.round(Number(v || 0))} kt`}
                      />
                    } />
                    <ChartLegend content={<ChartLegendContent />} />
                    {flightProfileData.annotations.map((a) => (
                      <ReferenceLine key={`ref-${a.id}-${a.x}`} x={a.x} stroke="rgba(100,116,139,.3)" strokeDasharray="4 4" />
                    ))}
                    <Line yAxisId="altitude" type="monotone" dataKey="altitude" stroke="var(--color-altitude)" strokeWidth={2.5} dot={false} connectNulls />
                    <Line yAxisId="groundspeed" type="monotone" dataKey="groundspeed" stroke="var(--color-groundspeed)" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ChartContainer>
              </div>
            </Section>
          )}

          {/* Passenger manifest */}
          {detail.departure && detail.arrival && (
            <PassengerManifest
              bookingId={detail.bookingId ?? detail.id}
              departureCode={detail.departure}
              arrivalCode={detail.arrival}
              passengers={detail.passengers}
              flightNumber={detail.flightNumber}
            />
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Time card */}
          <Section title="Время" defaultOpen={true}>
            <div className="px-5 py-4 space-y-3">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">AWARDED</div>
                <div className="text-2xl font-bold text-gray-900 font-mono">{detail.flightTime || "—"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-3">
                <Stat label="Airborne" value={detail.flightTime || "—"} />
                <Stat label="Block" value={detail.blockTime || "—"} />
                <Stat label="Scheduled" value={fmtTime(detail.departureTime)} />
                <Stat label="Estimated" value="—" />
              </div>
            </div>
          </Section>

          {/* Points */}
          {(detail.score != null || pointsBreakdown) && (
            <Section title="Очки" badge={detail.score ?? undefined} defaultOpen={true}>
              <div className="px-5 py-4 space-y-2">
                {pointsBreakdown ? (
                  pointsBreakdown.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.label}</span>
                      <span className={`font-bold font-mono ${item.value >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {item.value >= 0 ? "+" : ""}{item.value}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">Детализация очков недоступна.</div>
                )}
                {detail.score != null && (
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm font-bold">
                    <span className="text-gray-700">Flight Score:</span>
                    <span className="text-gray-900 font-mono">{detail.score}</span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Dispatch */}
          <Section title="Диспетч" defaultOpen={false}>
            <div className="px-5 py-4 grid grid-cols-2 gap-3">
              <Stat label="Пассажиры" value={detail.passengers ?? "—"} />
              <Stat label="Груз (кг)" value={detail.cargo ?? "—"} />
            </div>
          </Section>

          {/* Comments */}
          <Section title="Комментарии" defaultOpen={true}>
            <div className="px-5 py-4 space-y-3">
              {detail.comments ? (
                <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{detail.comments}</div>
              ) : (
                <div className="text-xs text-gray-400 italic">Комментариев нет.</div>
              )}
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <Textarea
                  value={commentDraft}
                  onChange={(e) => { setCommentDraft(e.target.value); setCommentError(null); setCommentSuccess(false); }}
                  placeholder="Добавить комментарий..."
                  className="min-h-20 text-sm"
                  maxLength={1000}
                  disabled={isSubmittingComment}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-400">{commentDraft.length}/1000</span>
                  <Button size="sm" onClick={handleSubmitComment} disabled={isSubmittingComment || !commentDraft.trim()}>
                    {isSubmittingComment ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Отправка</> : "Отправить"}
                  </Button>
                </div>
                {commentError && <div className="text-xs text-red-600">{commentError}</div>}
                {commentSuccess && <div className="text-xs text-green-600">Комментарий добавлен.</div>}
              </div>
            </div>
          </Section>

          {/* Reload */}
          <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.reload()}>
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />Обновить PIREP
          </Button>
        </div>
      </div>
    </div>
  );
}
