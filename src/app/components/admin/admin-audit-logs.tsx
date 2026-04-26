import { useEffect, useMemo, useState } from "react";
import { Activity, Filter, Loader2, Search, ShieldCheck } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useLanguage } from "../../context/language-context";

interface AuditLogEntry {
  id: string;
  createdAt: string;
  action: string;
  method: string;
  path: string;
  changedKeys?: string[];
  admin?: {
    id?: string | null;
    username?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
  target?: {
    type?: string | null;
    id?: number | null;
    label?: string | null;
  } | null;
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

export function AdminAuditLogs() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/admin/audit-logs?limit=300", {
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(String(payload?.error || "Failed to load audit logs"));
        }
        if (active) {
          setEntries(Array.isArray(payload?.entries) ? payload.entries : []);
        }
      } catch (nextError) {
        if (active) {
          setEntries([]);
          setError(String(nextError instanceof Error ? nextError.message : "Failed to load audit logs"));
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

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (entityFilter !== "all" && String(entry?.target?.type || "") !== entityFilter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        entry.action,
        entry.method,
        entry.path,
        entry.admin?.name,
        entry.admin?.username,
        entry.admin?.role,
        entry.target?.type,
        entry.target?.label,
        Array.isArray(entry.changedKeys) ? entry.changedKeys.join(" ") : "",
      ].join(" ").toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [entries, entityFilter, query]);

  const entityCounts = useMemo(() => {
    return entries.reduce<Record<string, number>>((accumulator, entry) => {
      const key = String(entry?.target?.type || "admin").trim() || "admin";
      accumulator[key] = Number(accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tr("Аудит лог", "Audit Log")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tr("Журнал всех административных изменений и действий записи.", "Journal of recorded administrative changes and write actions.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{tr("Записей", "Entries")}: {entries.length}</Badge>
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{tr("Пилоты", "Pilots")}: {entityCounts.pilot || 0}</Badge>
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{tr("Самолёты", "Aircraft")}: {entityCounts.aircraft || 0}</Badge>
          <Badge variant="outline" className="border-gray-200 bg-white text-gray-700">{tr("Аэропорты", "Airports")}: {entityCounts.airport || 0}</Badge>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Поиск по админу, действию или сущности", "Search by admin, action or entity")} className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["all", tr("Все", "All")],
              ["pilot", tr("Пилоты", "Pilots")],
              ["aircraft", tr("Самолёты", "Aircraft")],
              ["airport", tr("Аэропорты", "Airports")],
              ["pirep", "PIREP"],
            ].map(([value, label]) => (
              <Button key={value} type="button" variant={entityFilter === value ? "default" : "outline"} onClick={() => setEntityFilter(value)}>
                {entityFilter === value ? <Filter className="mr-2 h-4 w-4" /> : null}
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {tr("Загрузка audit log...", "Loading audit log...")}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">{error}</div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-500">
          {tr("Логи по текущему фильтру не найдены.", "No audit records match the current filter.")}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="border-none shadow-sm">
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-gray-900">{entry.action}</div>
                      <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{entry.method}</Badge>
                      <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">{entry.target?.type || "admin"}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">{entry.target?.label || entry.path}</div>
                  </div>
                  <div className="text-sm text-gray-500">{formatDateTime(entry.createdAt)}</div>
                </div>
                <div className="grid gap-3 text-sm text-gray-600 md:grid-cols-3">
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-gray-400">{tr("Админ", "Admin")}</div>
                    <div className="mt-1 font-medium text-gray-900">{entry.admin?.name || entry.admin?.username || "Admin"}</div>
                    <div className="text-xs text-gray-500">{entry.admin?.role || "admin"}</div>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-gray-400">{tr("Путь", "Path")}</div>
                    <div className="mt-1 break-all font-medium text-gray-900">{entry.path}</div>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs uppercase tracking-wide text-gray-400">{tr("Изменены поля", "Changed fields")}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Array.isArray(entry.changedKeys) && entry.changedKeys.length > 0 ? entry.changedKeys.slice(0, 6).map((key) => (
                        <Badge key={key} variant="outline" className="border-gray-200 bg-white text-gray-700">{key}</Badge>
                      )) : <span className="text-gray-500">—</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}