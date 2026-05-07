import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useAdminNav } from "./admin-nav-context";
import { fetchAdminBootstrap, getCachedAdminBootstrap } from "./admin-bootstrap-cache";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useLanguage } from "../../context/language-context";

interface PilotRow {
  id: number | null;
  username: string;
  name: string;
  email: string;
  airlineId: number | null;
  rank: string;
  rankId: number | null;
  hours: number;
  flights: number;
  status: string;
  joinedAt: string;
}

const normalizePilotRow = (value: unknown): PilotRow => {
  const pilot = value && typeof value === "object" ? (value as Partial<PilotRow>) : {};
  const id = Number(pilot.id || 0) || 0;
  return {
    id: id > 0 ? id : null,
    username: String(pilot.username || "").trim(),
    name: String(pilot.name || pilot.username || "Pilot").trim() || "Pilot",
    email: String(pilot.email || "").trim(),
    airlineId: Number(pilot.airlineId || 0) || null,
    rank: String(pilot.rank || "Member").trim() || "Member",
    rankId: Number(pilot.rankId || 0) || null,
    hours: Number(pilot.hours || 0) || 0,
    flights: Number(pilot.flights || 0) || 0,
    status: String(pilot.status || "active").trim() || "active",
    joinedAt: String(pilot.joinedAt || "").trim(),
  };
};

export function AdminPilots() {
  const { navigateTo } = useAdminNav();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const initialBootstrap = getCachedAdminBootstrap();
  const [pilots, setPilots] = useState<PilotRow[]>(() => Array.isArray(initialBootstrap?.pilots) ? initialBootstrap.pilots.map(normalizePilotRow) : []);
  const [isLoading, setIsLoading] = useState(!Array.isArray(initialBootstrap?.pilots));
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [joinedFilter, setJoinedFilter] = useState("all");
  const [sortBy, setSortBy] = useState("joined_desc");

  useEffect(() => {
    let active = true;

    const loadPilots = async () => {
      setIsLoading(true);
      try {
        const payload = await fetchAdminBootstrap();
        const list = Array.isArray(payload?.pilots) ? payload.pilots : [];
        if (active) {
          setPilots(list.map(normalizePilotRow));
        }
      } catch (error) {
        console.error("Failed to load pilots", error);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadPilots().catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const uniqueRanks = useMemo(
    () => Array.from(new Set(pilots.map((pilot) => String(pilot.rank || "").trim()).filter(Boolean))).sort(),
    [pilots]
  );

  const uniqueStatuses = useMemo(
    () => Array.from(new Set(pilots.map((pilot) => String(pilot.status || "").toLowerCase().trim()).filter(Boolean))).sort(),
    [pilots]
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const list = pilots.filter((pilot) => {
      const username = String(pilot.username || "").toLowerCase();
      const name = String(pilot.name || "").toLowerCase();
      const email = String(pilot.email || "").toLowerCase();
      const rank = String(pilot.rank || "").toLowerCase();
      const status = String(pilot.status || "").toLowerCase();
      const joinedTs = Date.parse(String(pilot.joinedAt || ""));
      const joinedDate = Number.isFinite(joinedTs) ? joinedTs : null;

      const matchesSearch =
        !query ||
        username.includes(query) ||
        name.includes(query) ||
        email.includes(query) ||
        rank.includes(query) ||
        status.includes(query);

      const matchesRank = rankFilter === "all" || String(pilot.rank || "") === rankFilter;
      const matchesStatus = statusFilter === "all" || status === statusFilter;

      let matchesJoined = true;
      if (joinedFilter === "last30") {
        matchesJoined = joinedDate != null && now - joinedDate <= 30 * dayMs;
      } else if (joinedFilter === "last90") {
        matchesJoined = joinedDate != null && now - joinedDate <= 90 * dayMs;
      } else if (joinedFilter === "thisYear") {
        matchesJoined = joinedDate != null && new Date(joinedDate).getFullYear() === new Date(now).getFullYear();
      }

      return matchesSearch && matchesRank && matchesStatus && matchesJoined;
    });

    return list.sort((a, b) => {
      const dateA = Date.parse(String(a.joinedAt || ""));
      const dateB = Date.parse(String(b.joinedAt || ""));
      const safeDateA = Number.isFinite(dateA) ? dateA : 0;
      const safeDateB = Number.isFinite(dateB) ? dateB : 0;

      if (sortBy === "joined_asc") {
        return safeDateA - safeDateB;
      }
      if (sortBy === "name_asc") {
        return String(a.name || a.username || "").localeCompare(String(b.name || b.username || ""));
      }
      if (sortBy === "hours_desc") {
        return Number(b.hours || 0) - Number(a.hours || 0);
      }
      if (sortBy === "flights_desc") {
        return Number(b.flights || 0) - Number(a.flights || 0);
      }

      return safeDateB - safeDateA;
    });
  }, [pilots, search, rankFilter, statusFilter, joinedFilter, sortBy]);

  const openPilot = (pilot: PilotRow) => {
    if (!pilot.id) {
      return;
    }

    navigateTo("pilot-profile", pilot.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{tr("Список пилотов", "Pilot List")}</h2>
          <p className="text-sm text-gray-500">{tr("Нажмите на пилота, чтобы открыть профиль, последние рейсы и историю бронирований.", "Click on a pilot to open their profile, recent flights, and booking history.")}</p>
        </div>
        <div className="text-sm text-gray-500">{filtered.length} {tr("пилотов", "pilots")}</div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("Поиск пилотов...", "Search pilots...")} className="pl-9" />
            </div>

            <Select value={rankFilter} onValueChange={setRankFilter}>
              <SelectTrigger className="w-full md:w-56">
                <SelectValue placeholder={tr("Все ранги", "All ranks")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("Все ранги", "All ranks")}</SelectItem>
                {uniqueRanks.map((rank) => (
                  <SelectItem key={rank} value={rank}>
                    {rank}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder={tr("Все статусы", "All statuses")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("Все статусы", "All statuses")}</SelectItem>
                {uniqueStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={joinedFilter} onValueChange={setJoinedFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder={tr("Дата вступления", "Join date")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr("За всё время", "All time")}</SelectItem>
                <SelectItem value="last30">{tr("За последние 30 дней", "Last 30 days")}</SelectItem>
                <SelectItem value="last90">{tr("За последние 90 дней", "Last 90 days")}</SelectItem>
                <SelectItem value="thisYear">{tr("В этом году", "This year")}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-52">
                <SelectValue placeholder={tr("Сортировка", "Sort by")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="joined_desc">{tr("Сначала новые", "Newest first")}</SelectItem>
                <SelectItem value="joined_asc">{tr("Сначала старые", "Oldest first")}</SelectItem>
                <SelectItem value="name_asc">{tr("Имя A-Z", "Name A-Z")}</SelectItem>
                <SelectItem value="hours_desc">{tr("Часы по убыванию", "Hours descending")}</SelectItem>
                <SelectItem value="flights_desc">{tr("Рейсы по убыванию", "Flights descending")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-4 py-3">{tr("Пилот", "Pilot")}</th>
                  <th className="px-4 py-3">VA ID</th>
                  <th className="px-4 py-3">{tr("Ранг", "Rank")}</th>
                  <th className="px-4 py-3">{tr("Часы", "Hours")}</th>
                  <th className="px-4 py-3">{tr("Рейсы", "Flights")}</th>
                  <th className="px-4 py-3">{tr("Статус", "Status")}</th>
                  <th className="px-4 py-3">{tr("Вступил", "Joined")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {tr("Загрузка пилотов...", "Loading pilots...")}
                    </td>
                  </tr>
                ) : filtered.map((pilot) => (
                  <tr
                    key={`${pilot.id ?? "x"}-${pilot.username}`}
                    className={`transition-colors ${pilot.id ? "cursor-pointer hover:bg-gray-50" : "opacity-80"}`}
                    onClick={() => openPilot(pilot)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{pilot.name || pilot.username || "Unknown"}</div>
                      <div className="text-xs text-gray-500">{pilot.username || pilot.email || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{pilot.id ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{pilot.rank || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{Number(pilot.hours || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-700">{Number(pilot.flights || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          String(pilot.status).toLowerCase() === "active"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : String(pilot.status).toLowerCase() === "frozen"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-gray-200 bg-gray-50 text-gray-700"
                        }
                      >
                        {pilot.status || "active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{pilot.joinedAt ? pilot.joinedAt.slice(0, 10) : "—"}</td>
                  </tr>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      {tr("Пилоты не найдены.", "No pilots found.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
