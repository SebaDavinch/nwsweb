import { useState } from "react";
import { Search, Loader2, CheckCircle2, XCircle, AlertCircle, Clock, CalendarX2 } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useLanguage } from "../../context/language-context";

interface RouteItem {
  id: number;
  callsign: string;
  flightNumber: string;
  fromCode: string;
  toCode: string;
  fromName: string;
  toName: string;
  distance: string;
  duration: string;
  meta?: {
    status?: string;
    hidden?: boolean;
    updatedAt?: string | null;
  };
}

interface RouteDetail {
  startDate?: string;
  endDate?: string;
  serviceDays?: Array<string | number>;
}

interface MatchedRoute extends RouteItem {
  detail: RouteDetail | null;
}

interface CheckResult {
  query: string;
  matches: MatchedRoute[];
}

type ActualityStatus = "active" | "expired" | "not-started" | "inactive" | "hidden";

function getActuality(route: RouteItem, detail: RouteDetail | null): ActualityStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (detail?.endDate && detail.endDate < today) return "expired";
  if (detail?.startDate && detail.startDate > today) return "not-started";
  if (route.meta?.hidden) return "hidden";
  const s = String(route.meta?.status || "active").toLowerCase();
  if (s !== "active") return "inactive";
  return "active";
}

function ActualityBadge({ status, tr }: { status: ActualityStatus; tr: (ru: string, en: string) => string }) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
          <CheckCircle2 className="h-3 w-3" />
          {tr("Активен", "Active")}
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
          <CalendarX2 className="h-3 w-3" />
          {tr("Истёк", "Expired")}
        </span>
      );
    case "not-started":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
          <Clock className="h-3 w-3" />
          {tr("Не начался", "Not started")}
        </span>
      );
    case "inactive":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 border border-orange-200">
          <AlertCircle className="h-3 w-3" />
          {tr("Неактивен", "Inactive")}
        </span>
      );
    case "hidden":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 border border-gray-200">
          <AlertCircle className="h-3 w-3" />
          {tr("Скрыт", "Hidden")}
        </span>
      );
  }
}

function formatDate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_LABELS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function ServiceDays({ days, language }: { days?: Array<string | number>; language: string }) {
  if (!Array.isArray(days) || days.length === 0) return null;
  const nums = days.map((d) => Number(d)).filter((d) => d >= 1 && d <= 7);
  if (nums.length === 0) return null;
  const labels = language === "ru" ? DAY_LABELS : DAY_LABELS_EN;
  return (
    <div className="flex gap-0.5 mt-1">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <span
          key={d}
          className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium ${
            nums.includes(d) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
          }`}
        >
          {labels[d - 1]}
        </span>
      ))}
    </div>
  );
}

let routesCache: RouteItem[] | null = null;

async function loadRoutes(): Promise<RouteItem[]> {
  if (routesCache) return routesCache;
  const r = await fetch("/api/admin/routes", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to load routes");
  const data = await r.json();
  const list: RouteItem[] = Array.isArray(data?.routes) ? data.routes : [];
  routesCache = list;
  return list;
}

async function loadDetail(id: number): Promise<RouteDetail | null> {
  try {
    const r = await fetch(`/api/admin/routes/${id}/detail`, { credentials: "include" });
    if (!r.ok) return null;
    const data = await r.json();
    return (data?.detail ?? data) as RouteDetail;
  } catch {
    return null;
  }
}

function parseCallsigns(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

export function AdminCallsignChecker() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const [input, setInput] = useState("");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [checkedCount, setCheckedCount] = useState<{ found: number; notFound: number } | null>(null);

  const handleCheck = async () => {
    const queries = parseCallsigns(input);
    if (queries.length === 0) return;

    setIsChecking(true);
    setResults([]);
    setCheckedCount(null);

    try {
      const routes = await loadRoutes();

      const checkResults: CheckResult[] = await Promise.all(
        queries.map(async (query) => {
          const matches = routes.filter((r) => {
            const cs = String(r.callsign || "").toUpperCase();
            const fn = String(r.flightNumber || "").toUpperCase();
            return cs === query || fn === query || cs.includes(query) || fn.includes(query);
          });

          const matchedWithDetails: MatchedRoute[] = await Promise.all(
            matches.map(async (route) => {
              const detail = await loadDetail(route.id);
              return { ...route, detail };
            })
          );

          return { query, matches: matchedWithDetails };
        })
      );

      const found = checkResults.filter((r) => r.matches.length > 0).length;
      setResults(checkResults);
      setCheckedCount({ found, notFound: queries.length - found });
    } finally {
      setIsChecking(false);
    }
  };

  const handleClear = () => {
    setInput("");
    setResults([]);
    setCheckedCount(null);
    routesCache = null;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{tr("Проверка каллсайнов", "Callsign Checker")}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {tr(
            "Введите каллсайны (по одному на строку) и проверьте наличие в базе маршрутов и их актуальность.",
            "Enter callsigns (one per line) to check their presence in the route database and current status."
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Input panel */}
        <div className="space-y-3">
          <Textarea
            className="min-h-48 font-mono text-sm resize-none"
            placeholder={tr("WU1234\nWU5678\nKAR100", "WU1234\nWU5678\nKAR100")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-[#E31E24] hover:bg-[#c41a20] text-white"
              onClick={handleCheck}
              disabled={isChecking || !input.trim()}
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr("Проверяем...", "Checking...")}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  {tr("Проверить", "Check")}
                </>
              )}
            </Button>
            {(results.length > 0 || input.trim()) && (
              <Button variant="outline" onClick={handleClear} disabled={isChecking}>
                {tr("Сбросить", "Clear")}
              </Button>
            )}
          </div>

          {checkedCount !== null && (
            <div className="flex gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 border border-green-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {tr(`Найдено: ${checkedCount.found}`, `Found: ${checkedCount.found}`)}
              </span>
              {checkedCount.notFound > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700 border border-red-200">
                  <XCircle className="h-3.5 w-3.5" />
                  {tr(`Не найдено: ${checkedCount.notFound}`, `Not found: ${checkedCount.notFound}`)}
                </span>
              )}
            </div>
          )}

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500 space-y-1">
            <div className="font-medium text-gray-600">{tr("Формат ввода", "Input format")}</div>
            <div>{tr("• По одному каллсайну на строку", "• One callsign per line")}</div>
            <div>{tr("• Или через запятую / точку с запятой", "• Or comma / semicolon separated")}</div>
            <div>{tr("• Регистр не важен", "• Case insensitive")}</div>
          </div>
        </div>

        {/* Results panel */}
        <div className="space-y-3">
          {results.length === 0 && !isChecking && (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
              {tr("Результаты появятся здесь", "Results will appear here")}
            </div>
          )}

          {results.map((result) => (
            <Card key={result.query} className="border-none shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-base font-mono font-bold text-gray-900">
                    {result.query}
                  </CardTitle>
                  {result.matches.length === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
                      <XCircle className="h-3 w-3" />
                      {tr("Не найден", "Not found")}
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {tr(`${result.matches.length} маршр.`, `${result.matches.length} route${result.matches.length !== 1 ? "s" : ""}`)}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              {result.matches.length > 0 && (
                <CardContent className="px-4 pb-4 space-y-3">
                  {result.matches.map((route) => {
                    const actuality = getActuality(route, route.detail);
                    return (
                      <div
                        key={route.id}
                        className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900">
                                {route.fromCode} → {route.toCode}
                              </span>
                              <span className="text-xs text-gray-500">
                                {route.distance} · {route.duration}
                              </span>
                            </div>
                            {(route.fromName || route.toName) && (
                              <div className="text-xs text-gray-400">
                                {route.fromName} → {route.toName}
                              </div>
                            )}
                          </div>
                          <ActualityBadge status={actuality} tr={tr} />
                        </div>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {route.detail?.startDate && (
                            <span>
                              {tr("С", "From")}: <span className="text-gray-700">{formatDate(route.detail.startDate)}</span>
                            </span>
                          )}
                          {route.detail?.endDate && (
                            <span>
                              {tr("По", "To")}: <span className={`font-medium ${actuality === "expired" ? "text-red-600" : "text-gray-700"}`}>
                                {formatDate(route.detail.endDate)}
                              </span>
                            </span>
                          )}
                          {route.meta?.updatedAt && (
                            <span>
                              {tr("Обновлён", "Updated")}: <span className="text-gray-700">{formatDate(route.meta.updatedAt)}</span>
                            </span>
                          )}
                        </div>

                        {route.detail?.serviceDays && route.detail.serviceDays.length > 0 && (
                          <ServiceDays days={route.detail.serviceDays} language={language} />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
