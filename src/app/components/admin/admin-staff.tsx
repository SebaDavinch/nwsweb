import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AdminContentManager } from "./admin-content-manager";
import { useLanguage } from "../../context/language-context";

interface RosterPilot {
  id: number;
  username: string;
  name: string;
  rank: string;
  email: string;
  status: string;
}

let pilotsRosterCache: RosterPilot[] | null = null;

function PilotSearch({
  onSelect,
  language,
}: {
  onSelect: (pilot: RosterPilot) => void;
  language: string;
}) {
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [query, setQuery] = useState("");
  const [pilots, setPilots] = useState<RosterPilot[]>(pilotsRosterCache ?? []);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pilotsRosterCache) return;
    setLoading(true);
    fetch("/api/admin/pilots", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list: RosterPilot[] = Array.isArray(data?.pilots) ? data.pilots : [];
        pilotsRosterCache = list;
        setPilots(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pilots
      .filter(
        (p) =>
          p.username.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [pilots, query]);

  const handleSelect = async (pilot: RosterPilot) => {
    setQuery("");
    setOpen(false);
    onSelect(pilot);

    try {
      const r = await fetch("/api/admin/auth-logs?limit=500", { credentials: "include" });
      const data = await r.json();
      const entries: { actor?: { username?: string; id?: string } }[] = Array.isArray(data?.entries) ? data.entries : [];
      const hasLogin = entries.some(
        (e) =>
          String(e?.actor?.username || "").toLowerCase() === pilot.username.toLowerCase() ||
          String(e?.actor?.id || "") === String(pilot.id)
      );
      if (!hasLogin) {
        toast.warning(
          tr(
            `Пилот ${pilot.username} ни разу не заходил на сайт`,
            `Pilot ${pilot.username} has never logged into the site`
          )
        );
      }
    } catch {
      // auth log check is best-effort
    }
  };

  return (
    <div className="space-y-1.5 border-b border-gray-100 pb-4 mb-2">
      <Label>{tr("Поиск пилота", "Find pilot")}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9 pr-9"
          placeholder={tr("Позывной, имя или фамилия...", "Callsign, first or last name...")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>
      {open && matches.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
          {matches.map((pilot) => (
            <button
              key={pilot.id}
              type="button"
              className="flex w-full items-start gap-3 px-3 py-2.5 text-sm hover:bg-gray-50 text-left transition-colors border-b border-gray-100 last:border-0"
              onMouseDown={() => handleSelect(pilot)}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">{pilot.name}</div>
                <div className="text-xs text-gray-400">
                  {pilot.username}
                  {pilot.rank ? ` · ${pilot.rank}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-400">
        {tr(
          "Выберите пилота — поля ниже заполнятся автоматически.",
          "Select a pilot to auto-fill fields below."
        )}
      </p>
    </div>
  );
}

interface StaffItem {
  id: string;
  pilotId?: number | null;
  username?: string;
  handle?: string | null;
  name: string;
  role: string;
  rank?: string;
  division: string;
  color?: string | null;
  status: string;
  email: string;
  discord?: string;
  syncedAt?: string;
  bio?: string;
  order?: number;
  source?: string;
}

export function AdminStaff() {
  const location = useLocation();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [reloadToken, setReloadToken] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const autoSyncTriggeredRef = useRef(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/admin/staff/sync", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(tr("Не удалось синхронизировать персонал", "Failed to sync staff"));
      }

      const payload = await response.json().catch(() => null);

      setReloadToken((current) => current + 1);
      toast.success(
        payload?.stats
          ? tr(`Синхронизация завершена: ${Number(payload.stats.synced || 0)} синхронизировано, ${Number(payload.stats.archived || 0)} архивировано`, `Staff sync complete: ${Number(payload.stats.synced || 0)} synced, ${Number(payload.stats.archived || 0)} archived`)
          : tr("Синхронизация персонала завершена", "Staff sync complete")
      );
    } catch (error) {
      console.error("Failed to sync staff", error);
      toast.error(tr("Не удалось синхронизировать персонал", "Failed to sync staff"));
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldAutoSync = params.get("sync") === "1";

    if (!shouldAutoSync) {
      autoSyncTriggeredRef.current = false;
      return;
    }

    if (autoSyncTriggeredRef.current || isSyncing) {
      return;
    }

    autoSyncTriggeredRef.current = true;
    handleSync().catch(() => undefined);
  }, [isSyncing, location.search]);

  return (
    <AdminContentManager<StaffItem>
      collection="staff"
      title={tr("Персонал VA", "VA Staff")}
      subtitle={tr("Поддерживайте состав персонала и подтягивайте актуальные данные из vAMSYS с синхронизированными рангами пилотов.", "Maintain staff roster and pull current VA staff from vAMSYS with synced pilot ranks.")}
      singularLabel={tr("Сотрудник", "Staff Member")}
      searchKeys={["name", "username", "handle", "role", "rank", "division", "email", "discord", "pilotId"]}
      filterKeys={["division", "rank", "status", "source"]}
      reloadToken={reloadToken}
      toolbarActions={
        <Button type="button" variant="outline" onClick={handleSync} disabled={isSyncing}>
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {tr("Синхронизировать из vAMSYS", "Sync from vAMSYS")}
        </Button>
      }
      columns={[
        { key: "name", label: tr("Имя", "Name") },
        { key: "username", label: tr("Логин", "Username") },
        { key: "handle", label: tr("Хэндл", "Handle") },
        { key: "role", label: tr("Роль", "Role") },
        { key: "rank", label: tr("Ранг", "Rank") },
        { key: "division", label: tr("Отдел", "Division") },
        {
          key: "color",
          label: tr("Цвет", "Color"),
          render: (item) => (
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || "#E31E24" }} />
              {item.color || "#E31E24"}
            </div>
          ),
        },
        { key: "discord", label: tr("Discord", "Discord") },
        {
          key: "status",
          label: tr("Статус", "Status"),
          render: (item) => <Badge variant="outline">{item.status || tr("активен", "active")}</Badge>,
        },
        {
          key: "source",
          label: tr("Источник", "Source"),
          render: (item) => <Badge variant="outline">{item.source || tr("вручную", "manual")}</Badge>,
        },
        {
          key: "syncedAt",
          label: tr("Последняя синхронизация", "Last Sync"),
          render: (item) => {
            const value = String(item.syncedAt || "").trim();
            if (!value) {
              return "—";
            }

            const timestamp = Date.parse(value);
            return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value;
          },
        },
        { key: "email", label: tr("Email", "Email") },
      ]}
      formTop={({ updateFormValue, editingItem }) =>
        !editingItem ? (
          <PilotSearch
            language={language}
            onSelect={(pilot) => {
              updateFormValue("pilotId", String(pilot.id));
              updateFormValue("username", pilot.username);
              updateFormValue("name", pilot.name);
              updateFormValue("rank", pilot.rank);
              updateFormValue("email", pilot.email);
            }}
          />
        ) : null
      }
      fields={[
        { key: "pilotId", label: tr("ID пилота", "Pilot ID"), type: "number" },
        { key: "username", label: tr("Логин", "Username"), type: "text" },
        { key: "handle", label: tr("Хэндл (@id)", "Handle (@id)"), type: "text" },
        { key: "name", label: tr("Имя", "Name"), type: "text" },
        { key: "role", label: tr("Роль", "Role"), type: "text" },
        { key: "rank", label: tr("Ранг", "Rank"), type: "text" },
        { key: "division", label: tr("Отдел", "Division"), type: "text" },
        { key: "color", label: tr("Цвет роли", "Role Color"), type: "text" },
        {
          key: "status",
          label: tr("Статус", "Status"),
          type: "select",
          options: [
            { label: tr("Активен", "Active"), value: "active" },
            { label: tr("В отпуске", "On leave"), value: "leave" },
            { label: tr("В архиве", "Archived"), value: "archived" },
          ],
        },
        { key: "email", label: tr("Email", "Email"), type: "text" },
        { key: "discord", label: tr("Discord", "Discord"), type: "text" },
        {
          key: "source",
          label: tr("Источник", "Source"),
          type: "select",
          options: [
            { label: tr("Вручную", "Manual"), value: "manual" },
            { label: "vAMSYS", value: "vamsys" },
          ],
        },
        { key: "syncedAt", label: tr("Последняя синхронизация", "Last Sync"), type: "text" },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
        { key: "bio", label: tr("Био", "Bio"), type: "textarea" },
      ]}
    />
  );
}