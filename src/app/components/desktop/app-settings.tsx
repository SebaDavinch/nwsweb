import { useEffect, useState } from "react";
import { Languages, Sun, Moon, Bell, BellOff, AtSign, Gauge } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAppTheme } from "./use-app-theme";
import { notify } from "./notify";
import { LogsViewer } from "./logs-viewer";
import { MsfsAddonSettings } from "./msfs-addon-settings";
import { useSimTelemetry } from "./use-sim-telemetry";
import { getSimSourceEnabled, setSimSourceEnabled } from "./use-telemetry-source";
import {
  getDiscordRpStatus,
  subscribeDiscordRp,
  isDiscordRpEnabled,
  setDiscordRpEnabled,
  type DiscordRpStatus,
} from "./use-discord-presence";

const NOTIF_KEY = "nws.notif.enabled";
const MENTION_NOTIF_KEY = "nws.notif.mentions";

export function getNotificationsEnabled(): boolean {
  try {
    return window.localStorage.getItem(NOTIF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function getMentionNotifEnabled(): boolean {
  try {
    return window.localStorage.getItem(MENTION_NOTIF_KEY) !== "0";
  } catch {
    return true;
  }
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-zinc-800">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div>
        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</div>
        {desc ? <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{desc}</div> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function AppSettings() {
  const { language, setLanguage } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { theme, toggleAnimated: toggleThemeAnimated } = useAppTheme();
  const [notifEnabled, setNotifEnabled] = useState(getNotificationsEnabled());
  const [mentionEnabled, setMentionEnabled] = useState(getMentionNotifEnabled());

  const toggleNotif = () => {
    const next = !notifEnabled;
    setNotifEnabled(next);
    try {
      window.localStorage.setItem(NOTIF_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const toggleMention = () => {
    const next = !mentionEnabled;
    setMentionEnabled(next);
    try {
      window.localStorage.setItem(MENTION_NOTIF_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{tr("Настройки приложения", "App settings")}</h2>

      <Row title={tr("Язык интерфейса", "Interface language")}>
        <Segmented
          value={language}
          onChange={(v) => setLanguage(v)}
          options={[
            { value: "ru", label: "Русский", icon: <Languages className="h-4 w-4" /> },
            { value: "en", label: "English", icon: <Languages className="h-4 w-4" /> },
          ]}
        />
      </Row>

      <Row title={tr("Тема оформления", "Theme")}>
        <Segmented
          value={theme}
          onChange={(v) => {
            if (v !== theme) toggleThemeAnimated();
          }}
          options={[
            { value: "light", label: tr("Светлая", "Light"), icon: <Sun className="h-4 w-4" /> },
            { value: "dark", label: tr("Тёмная", "Dark"), icon: <Moon className="h-4 w-4" /> },
          ]}
        />
      </Row>

      <Row
        title={tr("Уведомления о полёте", "Flight notifications")}
        desc={tr(
          "Системные уведомления о начале рейса и посадке.",
          "System notifications on flight start and landing."
        )}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void notify(
                tr("Проверка уведомлений", "Test notification"),
                tr("Уведомления работают ✈", "Notifications are working ✈")
              )
            }
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            {tr("Тест", "Test")}
          </button>
          <button
            type="button"
            onClick={toggleNotif}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              notifEnabled
                ? "bg-emerald-500 text-white hover:bg-emerald-400"
                : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300",
            ].join(" ")}
          >
            {notifEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {notifEnabled ? tr("Вкл", "On") : tr("Выкл", "Off")}
          </button>
        </div>
      </Row>

      <Row
        title={tr("Уведомления об упоминаниях", "Mention notifications")}
        desc={tr(
          "Системное уведомление, когда вас упомянули в чате через @ник.",
          "System notification when someone mentions you in chat with @nick."
        )}
      >
        <button
          type="button"
          onClick={toggleMention}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            mentionEnabled
              ? "bg-emerald-500 text-white hover:bg-emerald-400"
              : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300",
          ].join(" ")}
        >
          <AtSign className="h-4 w-4" />
          {mentionEnabled ? tr("Вкл", "On") : tr("Выкл", "Off")}
        </button>
      </Row>

      <DiscordRpRow />

      <SimSourceRow />

      <MsfsAddonSettings />

      <LogsViewer />
    </div>
  );
}

function SimSourceRow() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [enabled, setEnabled] = useState(getSimSourceEnabled());
  // Опрашиваем статус сима только когда источник включён.
  const sim = useSimTelemetry(enabled, 3000);

  const sourceLabel = sim.connected
    ? sim.source.toUpperCase()
    : enabled
      ? tr("сим не найден", "sim not found")
      : tr("выключено", "off");

  return (
    <Row
      title={tr("Данные симулятора (FSUIPC/XPUIPC)", "Simulator data (FSUIPC/XPUIPC)")}
      desc={tr(
        "Брать высоту/скорость/курс/позицию из симулятора, когда он запущен. Иначе — телеметрия vAMSYS.",
        "Use altitude/speed/heading/position from the simulator when running. Otherwise vAMSYS telemetry."
      )}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span className={`h-2 w-2 rounded-full ${sim.connected ? "bg-emerald-500" : "bg-zinc-400"}`} />
          {sourceLabel}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            setSimSourceEnabled(next);
          }}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            enabled
              ? "bg-emerald-500 text-white hover:bg-emerald-400"
              : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300",
          ].join(" ")}
        >
          <Gauge className="h-4 w-4" />
          {enabled ? tr("Вкл", "On") : tr("Выкл", "Off")}
        </button>
      </div>
    </Row>
  );
}

function DiscordRpRow() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [enabled, setEnabled] = useState(isDiscordRpEnabled());
  const [status, setStatus] = useState<DiscordRpStatus>(getDiscordRpStatus());

  useEffect(() => subscribeDiscordRp(() => setStatus(getDiscordRpStatus())), []);

  const statusMeta: Record<DiscordRpStatus, { dot: string; label: string }> = {
    connected: { dot: "bg-emerald-500", label: tr("Подключено", "Connected") },
    disabled: { dot: "bg-zinc-400", label: tr("Выключено", "Disabled") },
    "no-app-id": { dot: "bg-amber-500", label: tr("Не настроен App ID", "App ID not set") },
    "not-tauri": { dot: "bg-zinc-400", label: tr("Только в приложении", "Desktop app only") },
    error: { dot: "bg-red-500", label: tr("Discord не запущен", "Discord not running") },
  };
  const meta = statusMeta[status];

  return (
    <Row
      title="Discord Rich Presence"
      desc={tr("Показывать ваш текущий рейс в статусе Discord.", "Show your current flight in your Discord status.")}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        <button
          type="button"
          onClick={() => {
            const next = !enabled;
            setEnabled(next);
            setDiscordRpEnabled(next);
          }}
          className={[
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            enabled ? "bg-emerald-500 text-white hover:bg-emerald-400" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
          ].join(" ")}
        >
          {enabled ? tr("Вкл", "On") : tr("Выкл", "Off")}
        </button>
      </div>
    </Row>
  );
}
