import { useEffect, useMemo, useState } from "react";
import { Loader2, Medal, Plane, Trophy, TrendingUp } from "lucide-react";

import { useLanguage } from "../../context/language-context";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type LeaderboardPeriod = "day" | "week" | "month" | "all";

interface LeaderboardRow {
  rank: number;
  pilotId: number;
  name: string;
  rankName: string;
  flights: number;
  hours: number;
  distance: number;
  points: number;
  avgLandingRate: number | null;
  lastFlightAt: string | null;
}

interface LeaderboardPayload {
  period: LeaderboardPeriod;
  updatedAt: string;
  totals: {
    pilots: number;
    flights: number;
    points: number;
  };
  rows: LeaderboardRow[];
  currentPilot: LeaderboardRow | null;
}

const PERIODS: LeaderboardPeriod[] = ["day", "week", "month", "all"];

const podiumStyles = [
  "border-amber-200 bg-gradient-to-b from-amber-50 to-white",
  "border-slate-200 bg-gradient-to-b from-slate-50 to-white",
  "border-orange-200 bg-gradient-to-b from-orange-50 to-white",
];

const formatHours = (value: number) => `${value.toLocaleString("ru-RU", { maximumFractionDigits: 1, minimumFractionDigits: value % 1 === 0 ? 0 : 1 })}h`;

const formatLandingRate = (value: number | null) => {
  if (!Number.isFinite(Number(value))) {
    return "—";
  }
  return `${value} fpm`;
};

const resolveInitials = (name: string) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "P";
  }
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "P";
};

export function PilotLeaderboard() {
  const { language } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);

  const [period, setPeriod] = useState<LeaderboardPeriod>("month");
  const [data, setData] = useState<LeaderboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    const fallbackErrorMessage = isRu ? "Не удалось загрузить лидерборд." : "Failed to load leaderboard.";

    fetch(`/api/vamsys/dashboard/leaderboard?period=${period}`, { credentials: "include" })
      .then((response) => response.json().catch(() => null).then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
        if (!active) {
          return;
        }

        if (!response.ok || !payload?.ok) {
          setData(null);
          setError(String(payload?.error || fallbackErrorMessage));
          return;
        }

        setData(payload as LeaderboardPayload);
      })
      .catch(() => {
        if (active) {
          setData(null);
          setError(fallbackErrorMessage);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isRu, period]);

  const topRows = useMemo(() => (Array.isArray(data?.rows) ? data.rows.slice(0, 3) : []), [data?.rows]);
  const tableRows = useMemo(() => (Array.isArray(data?.rows) ? data.rows.slice(0, 25) : []), [data?.rows]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1d1d1f]">{tr("Лидерборд пилотов", "Pilot leaderboard")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tr(
              "Рейтинг пилотов по принятым PIREP с фильтрами за сутки, неделю, месяц и всё время.",
              "Pilot ranking by accepted PIREPs with day, week, month and all-time filters."
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIODS.map((value) => (
            <Button
              key={value}
              type="button"
              variant={period === value ? "default" : "outline"}
              className={period === value ? "bg-[#E31E24] hover:bg-[#c41a20]" : ""}
              onClick={() => setPeriod(value)}
            >
              {value === "day"
                ? tr("Сутки", "Day")
                : value === "week"
                ? tr("Неделя", "Week")
                : value === "month"
                ? tr("Месяц", "Month")
                : tr("Все время", "All time")}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {tr("Загружаем лидерборд...", "Loading leaderboard...")}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-none shadow-sm bg-white/70 backdrop-blur-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E31E24]/10">
                  <Trophy className="h-5 w-5 text-[#E31E24]" />
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500">{tr("Пилотов в рейтинге", "Pilots ranked")}</div>
                  <div className="text-2xl font-bold text-[#1d1d1f]">{data?.totals?.pilots?.toLocaleString("ru-RU") || 0}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white/70 backdrop-blur-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10">
                  <Plane className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500">{tr("Принятых PIREP", "Accepted PIREPs")}</div>
                  <div className="text-2xl font-bold text-[#1d1d1f]">{data?.totals?.flights?.toLocaleString("ru-RU") || 0}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white/70 backdrop-blur-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500">{tr("Очков в периоде", "Points in period")}</div>
                  <div className="text-2xl font-bold text-[#1d1d1f]">{data?.totals?.points?.toLocaleString("ru-RU") || 0}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data?.currentPilot ? (
            <Card className="border-none shadow-sm bg-[#1d1d1f] text-white">
              <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">{tr("Ваше место", "Your position")}</div>
                  <div className="mt-2 text-2xl font-bold">#{data.currentPilot.rank} {data.currentPilot.name}</div>
                  <div className="mt-1 text-sm text-white/70">{data.currentPilot.rankName} · {data.currentPilot.points.toLocaleString("ru-RU")} pts · {data.currentPilot.flights} PIREP</div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">{tr("Часы", "Hours")}</div>
                    <div className="mt-2 text-lg font-semibold">{formatHours(data.currentPilot.hours)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">NM</div>
                    <div className="mt-2 text-lg font-semibold">{data.currentPilot.distance.toLocaleString("ru-RU")}</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">VS</div>
                    <div className="mt-2 text-lg font-semibold">{formatLandingRate(data.currentPilot.avgLandingRate)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            {topRows.map((row, index) => (
              <Card key={row.pilotId} className={`border shadow-sm ${podiumStyles[index] || podiumStyles[podiumStyles.length - 1]}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1d1d1f] text-base font-bold text-white">
                        {resolveInitials(row.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Medal className={`h-4 w-4 ${index === 0 ? "text-amber-500" : index === 1 ? "text-slate-500" : "text-orange-500"}`} />
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">#{row.rank}</span>
                        </div>
                        <div className="mt-2 truncate text-lg font-bold text-[#1d1d1f]">{row.name}</div>
                        <div className="mt-1 text-sm text-gray-500">{row.rankName}</div>
                      </div>
                    </div>
                    <Badge className="bg-[#1d1d1f] text-white">{row.points.toLocaleString("ru-RU")} pts</Badge>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl bg-white/70 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">PIREP</div>
                      <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{row.flights}</div>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">HRS</div>
                      <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{formatHours(row.hours)}</div>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-gray-400">VS</div>
                      <div className="mt-2 text-lg font-semibold text-[#1d1d1f]">{formatLandingRate(row.avgLandingRate)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-lg text-[#1d1d1f]">{tr("Таблица рейтинга", "Leaderboard table")}</CardTitle>
              <div className="text-xs text-gray-500">
                {data?.updatedAt
                  ? `${tr("Обновлено", "Updated")} ${new Date(data.updatedAt).toLocaleString(isRu ? "ru-RU" : "en-US")}`
                  : null}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase tracking-[0.16em] text-gray-400">
                  <tr>
                    <th className="px-3 py-3">#</th>
                    <th className="px-3 py-3">{tr("Пилот", "Pilot")}</th>
                    <th className="px-3 py-3">{tr("Очки", "Points")}</th>
                    <th className="px-3 py-3">PIREP</th>
                    <th className="px-3 py-3">{tr("Часы", "Hours")}</th>
                    <th className="px-3 py-3">NM</th>
                    <th className="px-3 py-3">VS</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => {
                    const isCurrent = data?.currentPilot?.pilotId === row.pilotId;
                    return (
                      <tr key={row.pilotId} className={`border-b border-gray-50 ${isCurrent ? "bg-red-50/60" : ""}`}>
                        <td className="px-3 py-4 font-semibold text-[#1d1d1f]">#{row.rank}</td>
                        <td className="px-3 py-4">
                          <div className="font-semibold text-[#1d1d1f]">{row.name}</div>
                          <div className="mt-1 text-xs text-gray-500">{row.rankName}</div>
                        </td>
                        <td className="px-3 py-4 font-semibold text-emerald-600">{row.points.toLocaleString("ru-RU")}</td>
                        <td className="px-3 py-4 text-gray-600">{row.flights}</td>
                        <td className="px-3 py-4 text-gray-600">{formatHours(row.hours)}</td>
                        <td className="px-3 py-4 text-gray-600">{row.distance.toLocaleString("ru-RU")}</td>
                        <td className="px-3 py-4 text-gray-600">{formatLandingRate(row.avgLandingRate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}