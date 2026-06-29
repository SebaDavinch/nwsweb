import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Loader2, RefreshCw, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useLanguage } from "../../context/language-context";

interface LeaderboardEntry {
  rank?: number | null;
  pilot_id?: number | null;
  pilot?: { id?: number; username?: string; name?: string } | null;
  username?: string | null;
  name?: string | null;
  value?: number | null;
  hours?: number | null;
  flights?: number | null;
  points?: number | null;
}

interface Leaderboard {
  id: number | string;
  name: string;
  type?: string | null;
  period?: string | null;
  entries?: LeaderboardEntry[] | null;
  updated_at?: string | null;
}

export function AdminLeaderboards() {
  const { language } = useLanguage();
  const tr = useCallback((ru: string, en: string) => (language === "ru" ? ru : en), [language]);

  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Leaderboard | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/leaderboards", { credentials: "include" });
      const data = await res.json();
      setLeaderboards(Array.isArray(data.leaderboards) ? data.leaderboards : []);
    } catch {
      toast.error(tr("Не удалось загрузить лидерборды", "Failed to load leaderboards"));
    } finally {
      setIsLoading(false);
    }
  }, [tr]);

  const loadDetail = useCallback(async (lb: Leaderboard) => {
    setSelected(lb);
    if (lb.entries) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/leaderboards/${lb.id}`, { credentials: "include" });
      const data = await res.json();
      const detail: Leaderboard = data.leaderboard ?? data;
      setSelected((prev) => prev?.id === lb.id ? { ...prev, ...detail } : prev);
      setLeaderboards((prev) =>
        prev.map((item) => item.id === lb.id ? { ...item, ...detail } : item)
      );
    } catch {
      toast.error(tr("Не удалось загрузить детали", "Failed to load leaderboard details"));
    } finally {
      setDetailLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : n.toLocaleString(language === "ru" ? "ru-RU" : "en-US");

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(language === "ru" ? "ru-RU" : "en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  const getPilotName = (entry: LeaderboardEntry) =>
    entry.pilot?.name || entry.pilot?.username || entry.name || entry.username || `Pilot #${entry.pilot_id || entry.pilot?.id || "?"}`;

  const getValue = (entry: LeaderboardEntry) =>
    entry.value ?? entry.hours ?? entry.flights ?? entry.points ?? null;

  if (selected) {
    const entries = Array.isArray(selected.entries) ? selected.entries : [];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {tr("Назад", "Back")}
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{selected.name}</h2>
            <p className="text-sm text-gray-400">
              {selected.type && <span className="mr-2">{selected.type}</span>}
              {selected.period && <span className="mr-2">{selected.period}</span>}
              {tr("Обновлено:", "Updated:")} {fmtDate(selected.updated_at)}
            </p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => loadDetail({ ...selected, entries: undefined })}>
            <RefreshCw className={`h-4 w-4 ${detailLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium w-12">#</th>
                    <th className="px-4 py-3 font-medium">{tr("Пилот", "Pilot")}</th>
                    <th className="px-4 py-3 font-medium text-right">{tr("Значение", "Value")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detailLoading ? (
                    <tr><td colSpan={3} className="px-4 py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                    </td></tr>
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">
                      {tr("Записей нет", "No entries")}
                    </td></tr>
                  ) : entries.map((entry, idx) => {
                    const pos = entry.rank ?? idx + 1;
                    const isTop3 = pos <= 3;
                    return (
                      <tr key={entry.pilot_id ?? idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`font-bold ${pos === 1 ? "text-amber-500" : pos === 2 ? "text-gray-400" : pos === 3 ? "text-amber-700" : "text-gray-500"}`}>
                            {isTop3 ? ["🥇", "🥈", "🥉"][pos - 1] : pos}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{getPilotName(entry)}</div>
                          {entry.pilot?.username && entry.pilot.name && (
                            <div className="text-xs text-gray-400">@{entry.pilot.username}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {fmt(getValue(entry))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{tr("Лидерборды", "Leaderboards")}</h2>
          <p className="text-sm text-gray-500">{tr("Таблицы лидеров vAMSYS", "vAMSYS leaderboards")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : leaderboards.length === 0 ? (
        <Card className="border-none shadow-sm">
          <CardContent className="py-16 text-center text-gray-400">
            {tr("Лидерборды не найдены", "No leaderboards found")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {leaderboards.map((lb) => {
            const entries = Array.isArray(lb.entries) ? lb.entries.slice(0, 3) : [];
            return (
              <Card
                key={lb.id}
                className="border-none shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => void loadDetail(lb)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="truncate">{lb.name}</span>
                  </CardTitle>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {lb.type && <Badge variant="outline" className="text-xs border-gray-200">{lb.type}</Badge>}
                    {lb.period && <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">{lb.period}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {entries.length > 0 ? (
                    <div className="space-y-1.5">
                      {entries.map((entry, idx) => {
                        const pos = entry.rank ?? idx + 1;
                        return (
                          <div key={entry.pilot_id ?? idx} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-gray-400 w-5 shrink-0 text-center">
                                {pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : pos}
                              </span>
                              <span className="truncate text-gray-900">{getPilotName(entry)}</span>
                            </div>
                            <span className="text-gray-500 shrink-0 ml-2">{fmt(getValue(entry))}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Users className="h-3.5 w-3.5" />
                      {tr("Нажмите чтобы посмотреть", "Click to view")}
                    </div>
                  )}
                  {lb.updated_at && (
                    <div className="mt-3 text-xs text-gray-400">{tr("Обновлено", "Updated")} {fmtDate(lb.updated_at)}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
