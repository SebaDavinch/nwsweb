import { useEffect, useState } from "react";
import {
  Home,
  Activity,
  History,
  MapPin,
  Coins,
  BarChart2,
  BookOpen,
  ImagePlus,
  Newspaper,
  MessageSquare,
  Map as MapIcon,
  Radio as RadioIcon,
  RadioTower,
  Package,
  Trophy,
  ShieldAlert,
  Settings,
  CalendarDays,
  PanelLeftOpen,
  PanelLeftClose,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { RecentFlights } from "../dashboard/recent-flights";
import { PilotAllFlights } from "../dashboard/pilot-all-flights";
import { PilotBalance } from "../dashboard/pilot-balance";
import { PilotStats } from "../dashboard/pilot-stats";
import { AppPassport } from "./app-passport";
import { LikesLeaderboard } from "./likes-leaderboard";
import { AppGallery } from "./app-gallery";
import { RadioPlayer } from "./radio-player";
import { AppChangelog } from "./app-changelog";
import { AppAchievements } from "./app-achievements";
import { AcarsPanel } from "./acars-panel";
import { PilotNotams } from "../dashboard/pilot-notams";
import { PilotSettings } from "../dashboard/pilot-settings";
import { PilotPirepDetail } from "../dashboard/pilot-pirep-detail";
import { NewsEventsWidget } from "./news-events-widget";
import { ChatPanel } from "./chat-panel";
import { HubOverview } from "./hub-overview";
import { ActivityFeed } from "../dashboard/activity-feed";
import { HubMap } from "./hub-map";
import { AppLogin } from "./app-login";
import { AppSettings } from "./app-settings";
import { AppActivities } from "./app-activities";
import { useAppConfig } from "./use-app-config";

type HubSection =
  | "overview"
  | "feed"
  | "recent"
  | "flights"
  | "balance"
  | "stats"
  | "passport"
  | "achievements"
  | "notams"
  | "gallery"
  | "news"
  | "map"
  | "radio"
  | "acars"
  | "chat"
  | "activities"
  | "changelog"
  | "settings";

export function HubMode() {
  const { t, language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { isAuthenticated, isAuthLoading } = useAuth();
  const { config } = useAppConfig();
  const [section, setSection] = useState<HubSection>(() => {
    try {
      const s = new URLSearchParams(window.location.search).get("section");
      return (s as HubSection) || "overview";
    } catch {
      return "overview";
    }
  });
  const [pirepId, setPirepId] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("nws.app.sidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("nws.app.sidebarCollapsed", collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const openPirep = (id: number) => {
    setPirepId(id);
    setSection("recent");
  };

  if (isAuthLoading) {
    return <div className="p-8 text-sm text-zinc-500">{t("app.loading")}</div>;
  }

  if (!isAuthenticated) {
    return <AppLogin />;
  }

  const allItems: Array<{ id: HubSection; label: string; icon: React.ReactNode }> = [
    { id: "overview", label: tr("Обзор", "Overview"), icon: <Home className="h-4 w-4" /> },
    { id: "feed", label: tr("Лента", "Feed"), icon: <Activity className="h-4 w-4" /> },
    { id: "recent", label: tr("Крайние полёты", "Recent"), icon: <History className="h-4 w-4" /> },
    { id: "flights", label: tr("Все рейсы", "All flights"), icon: <MapPin className="h-4 w-4" /> },
    { id: "stats", label: tr("Статистика", "Stats"), icon: <BarChart2 className="h-4 w-4" /> },
    { id: "balance", label: tr("Баланс", "Balance"), icon: <Coins className="h-4 w-4" /> },
    { id: "passport", label: tr("Паспорт", "Passport"), icon: <BookOpen className="h-4 w-4" /> },
    { id: "achievements", label: tr("Достижения", "Achievements"), icon: <Trophy className="h-4 w-4" /> },
    { id: "activities", label: tr("Мероприятия", "Activities"), icon: <CalendarDays className="h-4 w-4" /> },
    { id: "gallery", label: tr("Галерея", "Gallery"), icon: <ImagePlus className="h-4 w-4" /> },
    { id: "notams", label: "NOTAM", icon: <ShieldAlert className="h-4 w-4" /> },
    { id: "news", label: tr("Новости", "News"), icon: <Newspaper className="h-4 w-4" /> },
    { id: "map", label: tr("Карта", "Map"), icon: <MapIcon className="h-4 w-4" /> },
    { id: "radio", label: tr("Радио", "Radio"), icon: <RadioIcon className="h-4 w-4" /> },
    { id: "acars", label: tr("ACARS", "ACARS"), icon: <RadioTower className="h-4 w-4" /> },
    { id: "chat", label: tr("Чат", "Chat"), icon: <MessageSquare className="h-4 w-4" /> },
    { id: "changelog", label: tr("Что нового", "Changelog"), icon: <Package className="h-4 w-4" /> },
    { id: "settings", label: t("app.hub.settings"), icon: <Settings className="h-4 w-4" /> },
  ];
  const items = allItems.filter((item) => {
    if (item.id === "chat") return config.features.chat;
    if (item.id === "map") return config.features.map;
    if (item.id === "radio") return config.features.radio;
    if (item.id === "gallery") return config.features.screenshots;
    return true;
  });

  return (
    <div className="flex h-full bg-zinc-100 dark:bg-zinc-950">
      {/* Рейл секций (сворачиваемый) */}
      <nav
        className={[
          "nws-scroll-hover flex shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-2 transition-[width] duration-200 dark:border-white/5 dark:bg-zinc-900",
          collapsed ? "w-14" : "w-52",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="mb-1 flex items-center justify-center rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-100"
          title={collapsed ? tr("Развернуть", "Expand") : tr("Свернуть", "Collapse")}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        {items.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={collapsed ? item.label : undefined}
              onClick={() => {
                setSection(item.id);
                if (item.id !== "recent") setPirepId(null);
              }}
              className={[
                "mb-0.5 flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                active
                  ? "bg-red-500 text-white"
                  : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              {item.icon}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Карта — во всю высоту, без отступов */}
      {section === "map" ? (
        <div className="min-h-0 flex-1">
          <HubMap />
        </div>
      ) : section === "chat" ? (
        <div className="min-h-0 flex-1 bg-zinc-100 p-3 dark:bg-zinc-950">
          <ChatPanel />
        </div>
      ) : section === "overview" ? (
        /* Главная — фон/тема следуют переключателю, свой скролл внутри */
        <div className="nws-scroll-hover min-h-0 flex-1 overflow-y-auto">
          <HubOverview onOpenPirep={openPirep} onOpenNotams={() => setSection("notams")} onOpenActivities={() => setSection("activities")} />
        </div>
      ) : (
      /* Контент секции — светлый «лист» (переиспользуемые ЛК-компоненты), читаемо в обеих темах */
      <div className="nws-scroll-hover flex-1 overflow-y-auto bg-zinc-100 p-5 text-zinc-900">
        {section === "recent" &&
          (pirepId !== null ? (
            <PilotPirepDetail pirepId={pirepId} onBack={() => setPirepId(null)} />
          ) : (
            <RecentFlights onOpenPirep={openPirep} />
          ))}
        {section === "flights" && <PilotAllFlights onOpenBookings={() => setSection("overview")} />}
        {section === "stats" && <PilotStats />}
        {section === "balance" && <PilotBalance />}
        {section === "passport" && <AppPassport />}
        {section === "achievements" && <AppAchievements />}
        {section === "activities" && <AppActivities />}
        {section === "notams" && <PilotNotams />}
        {section === "gallery" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
            <AppGallery />
            <LikesLeaderboard limit={10} />
          </div>
        )}
        {section === "feed" && (
          <div className="mx-auto max-w-2xl rounded-2xl bg-white p-4 shadow-sm">
            <ActivityFeed limit={40} />
          </div>
        )}
        {section === "news" && (
          <div className="mx-auto max-w-2xl">
            <NewsEventsWidget limit={30} />
          </div>
        )}
        {section === "radio" && <RadioPlayer />}
        {section === "acars" && <AcarsPanel />}
        {section === "changelog" && <AppChangelog />}
        {section === "settings" && (
          <div className="space-y-6">
            <AppSettings />
            <PilotSettings />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
