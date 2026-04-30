import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, LogIn, Search } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { useLanguage } from "../../context/language-context";

interface AuthLogEntry {
  id: string;
  createdAt: string;
  provider?: string | null;
  type?: string | null;
  outcome?: string | null;
  message?: string | null;
  actor?: {
    id?: string | null;
    provider?: string | null;
    name?: string | null;
    username?: string | null;
    display?: string | null;
    role?: string | null;
  } | null;
  request?: {
    path?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  } | null;
  details?: unknown;
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const stringifyDetails = (value: unknown) => {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export function AdminAuthLogs() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const [entries, setEntries] = useState<AuthLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/auth-logs?limit=300", {
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(String(payload?.error || "Failed to load auth logs"));
        }
        if (active) {
          setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
        }
      } catch (nextError) {
        if (active) {
          setEntries([]);
          setError(String(nextError instanceof Error ? nextError.message : "Failed to load auth logs"));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const providerCounts = useMemo(() => {
    return entries.reduce<Record<string, number>>((accumulator, entry) => {
      const key = String(entry?.provider || "unknown").trim() || "unknown";
      accumulator[key] = Number(accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
  }, [entries]);

  const outcomeCounts = useMemo(() => {
    return entries.reduce<Record<string, number>>((accumulator, entry) => {
      const key = String(entry?.outcome || "unknown").trim() || "unknown";
      accumulator[key] = Number(accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const provider = String(entry?.provider || "unknown").trim().toLowerCase();
      const outcome = String(entry?.outcome || "unknown").trim().toLowerCase();
      if (providerFilter !== "all" && provider !== providerFilter) {
        return false;
      }
      if (outcomeFilter !== "all" && outcome !== outcomeFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        entry.provider,
        entry.type,
        entry.outcome,
        entry.message,
        entry.actor?.display,
        entry.actor?.name,
        entry.actor?.username,
        entry.request?.path,
        entry.request?.ip,
        stringifyDetails(entry.details),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [entries, outcomeFilter, providerFilter, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tr("Журнал авторизации", "Auth Log")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tr(
              "Отдельный журнал логинов, логаутов и ошибок авторизации пользователей.",
              "Dedicated journal for user logins, logouts, and authentication errors."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{tr("Записей", "Entries")}: {entries.length}</Badge>
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{tr("Успешно", "Success")}: {outcomeCounts.success || 0}</Badge>
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{tr("Ошибки", "Errors")}: {outcomeCounts.error || 0}</Badge>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tr("Поиск по имени, callsign, сообщению или IP", "Search by name, callsign, message, or IP")}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", tr("Все провайдеры", "All providers")],
              ["vamsys", "vAMSYS"],
              ["discord", "Discord"],
              ["pilot-api", "Pilot API"],
            ].map(([value, label]) => (
              <Button key={value} type="button" variant={providerFilter === value ? "default" : "outline"} onClick={() => setProviderFilter(value)}>
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", tr("Все статусы", "All statuses")],
              ["success", tr("Успех", "Success")],
              ["error", tr("Ошибка", "Error")],
            ].map(([value, label]) => (
              <Button key={value} type="button" variant={outcomeFilter === value ? "default" : "outline"} onClick={() => setOutcomeFilter(value)}>
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardContent className="flex flex-wrap gap-2 p-5">
          {Object.entries(providerCounts).map(([provider, count]) => (
            <Badge key={provider} variant="outline" className="border-gray-200 bg-white text-gray-700">
              {provider}: {count}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {tr("Загрузка auth log...", "Loading auth log...")}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-500">
          {tr("Записи авторизации по текущему фильтру не найдены.", "No auth records match the current filter.")}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const isSuccess = String(entry?.outcome || "").toLowerCase() === "success";
            return (
              <Card key={entry.id} className="border-none shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 font-semibold text-gray-900">
                          {isSuccess ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          {entry.message || tr("Событие авторизации", "Auth event")}
                        </div>
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{entry.provider || "unknown"}</Badge>
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{entry.type || "login"}</Badge>
                        <Badge variant="outline" className={isSuccess ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>
                          {entry.outcome || "unknown"}
                        </Badge>
                      </div>
                      <div className="mt-1 text-sm text-gray-500">{entry.actor?.display || tr("Неизвестный пользователь", "Unknown user")}</div>
                    </div>
                    <div className="text-sm text-gray-500">{formatDateTime(entry.createdAt)}</div>
                  </div>

                  <div className="grid gap-3 text-sm text-gray-600 md:grid-cols-3">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-gray-400">{tr("Пользователь", "User")}</div>
                      <div className="mt-1 font-medium text-gray-900">{entry.actor?.display || "—"}</div>
                      <div className="text-xs text-gray-500">{entry.actor?.role || entry.actor?.provider || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-gray-400">IP</div>
                      <div className="mt-1 break-all font-medium text-gray-900">{entry.request?.ip || "—"}</div>
                      <div className="text-xs text-gray-500">{entry.request?.path || "—"}</div>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div className="text-xs uppercase tracking-wide text-gray-400">{tr("Детали", "Details")}</div>
                      <div className="mt-1 line-clamp-3 break-all text-gray-700">{stringifyDetails(entry.details) || "—"}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}