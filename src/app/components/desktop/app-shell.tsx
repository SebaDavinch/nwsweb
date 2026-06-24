import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { Minus, Square, Copy, X, Pin, PinOff, Plane, LayoutDashboard, Sun, Moon, MapPin, Coins, Clock, LogOut, CalendarDays, FileText } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { useWindowControls } from "./use-tauri";
import { useActiveBooking } from "./use-active-booking";
import { useAppTheme } from "./use-app-theme";
import { useFlightNotifications } from "./use-flight-notifications";
import { LiveStatsBar } from "./live-stats-bar";
import { AppOnboarding, isOnboarded } from "./app-onboarding";
import { UrgentNotamsBanner } from "./urgent-notams";
import { useScreenshotAutoWatch } from "./use-screenshot-autowatch";
import { useDiscordPresence } from "./use-discord-presence";
import { useAchievements } from "./use-achievements";
import { useDeepLinkAuth } from "./use-deep-link-auth";
import { AppAssistantBubble } from "./app-assistant-bubble";
import { AppSplash } from "./app-splash";
import { usePilotLocation } from "./use-pilot-location";
import { installGlobalLogHandlers } from "./app-logger";

installGlobalLogHandlers();

function ModeTab({ to, icon, label, dot }: { to: string; icon: React.ReactNode; label: string; dot?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
        ].join(" ")
      }
    >
      {icon}
      <span>{label}</span>
      {dot ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.6)]" />
      ) : null}
    </NavLink>
  );
}

/** Компактные UTC-часы для шапки. */
function HeaderClock() {
  const [utc, setUtc] = useState(() => new Date().toISOString().slice(11, 19));
  useEffect(() => {
    const id = window.setInterval(() => setUtc(new Date().toISOString().slice(11, 19)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="hidden items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs tabular-nums text-zinc-600 dark:bg-white/5 dark:text-zinc-300 sm:flex">
      <Clock className="h-3.5 w-3.5 text-zinc-400" />
      {utc} <span className="text-zinc-400">UTC</span>
    </span>
  );
}

/** Баланс пилота в шапке. */
function HeaderBalance({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 sm:flex">
      <Coins className="h-3.5 w-3.5" />
      {value.toLocaleString("ru-RU")}
    </span>
  );
}

/** Мини-профиль пилота в шапке: аватар + callsign, по клику — карточка. */
function HeaderProfile({
  pilot,
  balance,
  onLogout,
}: {
  pilot: {
    firstName: string;
    lastName: string;
    callsign: string;
    rank?: string;
    avatar?: string;
    location?: string;
    totalHours?: number;
    totalFlights?: number;
    joinDate?: string;
  };
  balance: number | null;
  onLogout: () => void;
}) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const [open, setOpen] = useState(false);
  const freshLocation = usePilotLocation();
  const initials = `${pilot.firstName?.[0] || ""}${pilot.lastName?.[0] || ""}`.toUpperCase() || "?";
  // Свежая локация из vAMSYS (синхронизированная) имеет приоритет над сессией.
  const locationCode =
    freshLocation?.airportCode ||
    (pilot.location ? pilot.location.match(/\b[A-Z]{4}\b/)?.[0] : "") ||
    "—";
  const joined = (() => {
    const t = new Date(String(pilot.joinDate || "")).getTime();
    return Number.isFinite(t) && t > 0 ? new Date(t).toLocaleDateString(locale, { month: "short", year: "numeric" }) : "—";
  })();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-0.5 pl-0.5 pr-2.5 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      >
        <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-red-500 to-red-700 text-[10px] font-bold text-white">
          {pilot.avatar ? <img src={pilot.avatar} alt="" className="h-6 w-6 object-cover" /> : initials}
        </span>
        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{pilot.callsign}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-900">
          <div className="flex items-center gap-3 border-b border-zinc-100 p-3 dark:border-white/5">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-red-500 to-red-700 text-sm font-bold text-white">
              {pilot.avatar ? <img src={pilot.avatar} alt="" className="h-11 w-11 object-cover" /> : initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {pilot.firstName} {pilot.lastName}
              </div>
              <div className="truncate text-xs text-zinc-400">
                {pilot.callsign}
                {pilot.rank ? ` · ${pilot.rank}` : ""}
              </div>
            </div>
          </div>
          {/* Статистика пилота */}
          <div className="grid grid-cols-3 gap-2 p-3">
            <div className="rounded-xl bg-zinc-50 p-2 text-center dark:bg-white/5">
              <Clock className="mx-auto h-3.5 w-3.5 text-sky-500" />
              <div className="mt-0.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">{pilot.totalHours ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-400">{tr("часы", "hrs")}</div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-2 text-center dark:bg-white/5">
              <Plane className="mx-auto h-3.5 w-3.5 text-violet-500" />
              <div className="mt-0.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">{pilot.totalFlights ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-400">{tr("рейсы", "flts")}</div>
            </div>
            <div className="rounded-xl bg-zinc-50 p-2 text-center dark:bg-white/5">
              <CalendarDays className="mx-auto h-3.5 w-3.5 text-emerald-500" />
              <div className="mt-0.5 text-[11px] font-bold text-zinc-800 dark:text-zinc-100">{joined}</div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-400">{tr("в ВАК", "joined")}</div>
            </div>
          </div>
          {/* Баланс + локация */}
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            <div className="flex items-center justify-center gap-1 rounded-xl bg-amber-50 py-1.5 text-sm font-bold text-amber-600 dark:bg-amber-500/10">
              <Coins className="h-3.5 w-3.5" />
              {balance !== null ? balance.toLocaleString("ru-RU") : "—"}
            </div>
            <div className="flex items-center justify-center gap-1 rounded-xl bg-zinc-50 py-1.5 text-sm font-bold text-zinc-700 dark:bg-white/5 dark:text-zinc-200">
              <MapPin className="h-3.5 w-3.5 text-red-500" />
              {locationCode}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-white/5 dark:hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            {tr("Выйти", "Sign out")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell() {
  const { t, language, setLanguage } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { pilot, isAuthenticated, isAuthLoading, logout, refreshAuth } = useAuth();
  const win = useWindowControls();
  const { booking } = useActiveBooking();
  const { isDark, toggleAnimated: toggleThemeAnimated } = useAppTheme();
  const navigate = useNavigate();
  const [onboarded, setOnboarded] = useState(isOnboarded);
  const [balance, setBalance] = useState<number | null>(null);
  // Загрузочный сплэш — один раз за запуск приложения.
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return window.sessionStorage.getItem("nws.app.splashed") !== "1";
    } catch {
      return true;
    }
  });
  useFlightNotifications();
  useScreenshotAutoWatch(isAuthenticated);
  useDiscordPresence();
  useAchievements(); // фоновый опрос → Steam-style уведомления о новых ачивках
  // Вход в упакованном .exe: ловим deep-link с сессией из системного браузера.
  useDeepLinkAuth(() => {
    void refreshAuth();
    navigate("/app/hub");
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setBalance(null);
      return;
    }
    let active = true;
    fetch("/api/pilot/balance", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (active && typeof p?.balance === "number") setBalance(p.balance);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // Sync dark class on <html> so dark: Tailwind variants work everywhere,
  // including portals (dialogs, dropdowns) rendered outside this div.
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [isDark]);

  const ctrlBtn =
    "rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Кастомный заголовок окна (drag-зона). relative z-50 — чтобы выпадающее меню профиля
          было поверх баннера NOTAM и контента (хедер с backdrop-blur — отдельный stacking-контекст). */}
      <header
        data-tauri-drag-region
        className="relative z-50 flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-3 backdrop-blur dark:border-white/5 dark:bg-zinc-900/80"
      >
        {/* Лого + режимы */}
        <div data-tauri-drag-region className="flex items-center gap-4">
          <div className="flex items-center gap-2 pl-1 pr-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500 text-[11px] font-black tracking-tight text-white">
              N
            </div>
            <span className="text-sm font-semibold tracking-wide text-zinc-800 dark:text-zinc-200">NordwindHub</span>
          </div>
          <nav className="flex items-center gap-1">
            <ModeTab to="/app/hub" icon={<LayoutDashboard className="h-4 w-4" />} label={t("app.mode.hub")} />
            <ModeTab
              to="/app/flight"
              icon={<Plane className="h-4 w-4" />}
              label={t("app.mode.flight")}
              dot={Boolean(booking)}
            />
            {/* OFP — таб только при активной броне */}
            {booking ? (
              <ModeTab to="/app/ofp" icon={<FileText className="h-4 w-4" />} label={tr("План", "OFP")} />
            ) : null}
          </nav>
        </div>

        {/* Правый блок: локация, пилот, тема, язык, контролы окна */}
        <div className="flex items-center gap-1">
          {isAuthenticated && pilot ? (
            <>
              <HeaderBalance value={balance} />
              <HeaderClock />
              <HeaderProfile pilot={pilot} balance={balance} onLogout={logout} />
            </>
          ) : null}

          <button
            type="button"
            onClick={(e) => toggleThemeAnimated({ x: e.clientX, y: e.clientY })}
            className={ctrlBtn}
            title={isDark ? t("app.theme.light") : t("app.theme.dark")}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setLanguage(language === "ru" ? "en" : "ru")}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100"
            title={t("app.lang.toggle")}
          >
            {language.toUpperCase()}
          </button>

          {win.isTauri ? (
            <>
              <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-white/10" />
              <button
                type="button"
                onClick={win.toggleAlwaysOnTop}
                className={[
                  "rounded-md p-1.5 transition-colors",
                  win.alwaysOnTop
                    ? "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
                ].join(" ")}
                title={t("app.window.alwaysOnTop")}
              >
                {win.alwaysOnTop ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
              </button>
              <button type="button" onClick={win.minimize} className={ctrlBtn} title={t("app.window.minimize")}>
                <Minus className="h-4 w-4" />
              </button>
              <button type="button" onClick={win.toggleMaximize} className={ctrlBtn} title={t("app.window.maximize")}>
                {win.isMaximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={win.close}
                className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500 hover:text-white dark:text-zinc-400"
                title={t("app.window.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </header>

      {/* Pegasus-style баннер срочных NOTAM */}
      {isAuthenticated ? <UrgentNotamsBanner onOpen={() => navigate("/app/hub?section=notams")} /> : null}

      {/* Контент режима (каждый режим сам управляет прокруткой) */}
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Нижний статус-бар: живые рейсы + UTC */}
      <LiveStatsBar />

      {/* ИИ-ассистент временно отключён */}
      {/* {isAuthenticated ? <AppAssistantBubble /> : null} */}

      {/* Первый запуск: выбор языка и темы */}
      {!onboarded ? <AppOnboarding onDone={() => setOnboarded(true)} /> : null}

      {/* Загрузочный сплэш (поверх всего, один раз за запуск; держится до готовности данных) */}
      {showSplash ? (
        <AppSplash
          ready={!isAuthLoading}
          onDone={() => {
            try {
              window.sessionStorage.setItem("nws.app.splashed", "1");
            } catch {
              /* ignore */
            }
            setShowSplash(false);
          }}
        />
      ) : null}
    </div>
  );
}
