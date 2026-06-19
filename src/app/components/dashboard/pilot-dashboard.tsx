import { useAuth } from "../../context/auth-context";
import { useLanguage } from "../../context/language-context";
import { Navigate, Link, useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import {
  Plane,
  MapPin,
  Building2,
  ImagePlus,
  Palette,
  Award,
  LogOut,
  Navigation,
  Home,
  History,
  Cloud,
  FileText,
  Menu,
  X,
  Settings,
  Shield,
  ClipboardCheck,
  ShieldAlert,
  Loader2,
  ChevronDown,
  Coins,
  BookOpen,
  BarChart2,
  Trophy,
  MonitorPlay,
  Clock,
  PlaneLanding,
  CalendarDays,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Where2Fly } from "./where2fly";
import { PilotBookings } from "./pilot-bookings";
import { RecentFlights } from "./recent-flights";
import { SimBriefBriefing } from "./simbrief-briefing";
import { PilotSettings } from "./pilot-settings";
import { NotificationCenter } from "./notification-center";
import { PilotClaims } from "./pilot-claims";
import { PilotNotams } from "./pilot-notams";
import { PilotBadges } from "./pilot-badges";
import { PilotFleet } from "./pilot-fleet";
import { PilotLiveries } from "./pilot-liveries";
import { PilotAirports } from "./pilot-airports";
import { PilotPirepDetail } from "./pilot-pirep-detail";
import { PilotAllFlights } from "./pilot-all-flights";
import { PilotSocialGallery } from "./pilot-social-gallery";
import { PilotBalance } from "./pilot-balance";
import { PilotPassport } from "./pilot-passport";
import { PilotStats } from "./pilot-stats";
import { PilotLeaderboard } from "./pilot-leaderboard";
import { PilotStreamWidgets } from "./pilot-stream-widgets";
import { PilotAchievements } from "./pilot-achievements";
import { ActivityFeed } from "./activity-feed";

const normalizeDashboardTab = (value: string) => {
  if (value === "claims") {
    return "manual-pirep";
  }

  return value;
};

const parseDashboardDate = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const dottedDateMatch = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dottedDateMatch) {
    const [, day, month, year] = dottedDateMatch;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const isoDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const formatDashboardDate = (value: string) => {
  const parsed = parseDashboardDate(value);
  if (!parsed) {
    return "—";
  }

  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = String(parsed.getUTCFullYear());
  return `${day}.${month}.${year}`;
};

const upcomingIcaoToCountryIso2 = (icao?: string | null) => {
  const normalized = String(icao || "").trim().toUpperCase();
  if (!normalized || normalized.length < 2) {
    return null;
  }
  const prefix = normalized.slice(0, 2);
  if (prefix === "UR" || prefix === "UW" || prefix === "UU") {
    return "ru";
  }
  return null;
};

export function PilotDashboard() {
  const { isAuthenticated, isAuthLoading, pilot, isAdmin, logout } = useAuth();
  const { t, language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const location = useLocation();
  const navigate = useNavigate();
  const { countryIso2 } = useParams();
  const [activeTab, setActiveTab] = useState("home");
  const [selectedPirepId, setSelectedPirepId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dashboardHome, setDashboardHome] = useState<{
    stats?: {
      totalHours?: number;
      totalFlights?: number;
      memberSince?: string;
      avgLandingRate?: number | null;
    };
    rank?: {
      name?: string;
      regularName?: string;
      hours?: number;
      honoraryName?: string;
      nextRankName?: string;
      progressPercent?: number;
      progressHoursRemaining?: number | null;
      progressPirepsRemaining?: number | null;
      progressPointsRemaining?: number | null;
      progressBonusRemaining?: number | null;
    };
    upcomingFlights?: Array<{
      id: number;
      flightNumber: string;
      callsign?: string | null;
      departure?: string;
      arrival?: string;
      departureCode?: string;
      arrivalCode?: string;
      scheduledDate?: string;
      scheduledTime?: string;
      departureTime?: string | null;
      aircraftType?: string;
      aircraftRegistration?: string | null;
      aircraft: string;
    }>;
    recentFlightsPreview?: Array<{
      id: number;
      flightNumber: string;
      departure?: string;
      departureIcao?: string;
      departureCity?: string;
      departureCountryIso2?: string | null;
      arrival?: string;
      arrivalIcao?: string;
      destinationCity?: string;
      arrivalCountryIso2?: string | null;
      aircraft?: string;
      status?: string;
      completedAt?: string;
      needReply?: boolean;
    }>;
    needsReplyFlights?: Array<{
      id: number;
      flightNumber: string;
      departure?: string;
      arrival?: string;
      aircraft?: string;
      status?: string;
      completedAt?: string;
      needReply?: boolean;
    }>;
    systemStatus?: {
      services?: Array<{
        id: string;
        name: string;
        state: "online" | "offline";
        label: string;
      }>;
    };
    notams?: {
      total?: number;
      urgentCount?: number;
      urgent?: Array<{
        id: number;
        title: string;
        type: "info" | "warning" | "critical";
        priority: "low" | "medium" | "high";
        mustRead: boolean;
        tag?: string | null;
        createdAt?: string | null;
      }>;
      latest?: Array<{
        id: number;
        title: string;
      }>;
    };
    alerts?: {
      total?: number;
      items?: Array<{
        id: number;
        title: string;
        content: string;
        type: "info" | "warning" | "critical";
        pages?: string[];
      }>;
    };
    staffRoles?: Array<{
      id?: string;
      role?: string;
      division?: string;
      handle?: string | null;
      color?: string | null;
    }>;
  } | null>(null);
  const [activityProgressWidget, setActivityProgressWidget] = useState<{
    items: Array<{
      registrationId: number;
      activityId: number;
      activityTitle: string;
      activityType?: string;
      progress?: {
        status?: string;
        progressPercent?: number;
        legCompleted?: number;
        legTotal?: number;
      } | null;
    }>;
  } | null>(null);
  const [isActivityProgressLoading, setIsActivityProgressLoading] = useState(false);
  const [isPilotApiConnectedForActivities, setIsPilotApiConnectedForActivities] = useState(true);
  const [isActivityWidgetExpanded, setIsActivityWidgetExpanded] = useState(true);
  const [sidebarBalance, setSidebarBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !pilot) return;
    let active = true;
    fetch("/api/pilot/balance", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((payload) => { if (active && typeof payload?.balance === "number") setSidebarBalance(payload.balance); })
      .catch(() => null);
    return () => { active = false; };
  }, [isAuthenticated, pilot]);

  useEffect(() => {
    if (!isAuthenticated || !pilot || activeTab !== "home") {
      return;
    }

    let active = true;

    const loadDashboard = async () => {
      try {
        const response = await fetch("/api/vamsys/dashboard/home", {
          credentials: "include",
        });
        if (!response.ok) {
          if (active) {
            setDashboardHome(null);
          }
          return;
        }
        const payload = await response.json();
        if (active) {
          setDashboardHome(payload || null);
        }
      } catch {
        if (active) {
          setDashboardHome(null);
        }
      }
    };

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [activeTab, isAuthenticated, pilot]);


  useEffect(() => {
    if (!isAuthenticated || !pilot || activeTab !== "home") {
      return;
    }

    let active = true;
    const loadWidget = async () => {
      setIsActivityProgressLoading(true);
      try {
        const response = await fetch("/api/pilot/activities/progress-widget?limit=4", {
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);
        if (!active) {
          return;
        }

        if (!response.ok) {
          if (String(payload?.code || "") === "pilot_api_not_connected") {
            setIsPilotApiConnectedForActivities(false);
            setActivityProgressWidget({ items: [] });
          } else {
            setActivityProgressWidget({ items: [] });
          }
          return;
        }

        setIsPilotApiConnectedForActivities(true);
        setActivityProgressWidget({
          items: Array.isArray(payload?.items) ? payload.items : [],
        });
      } catch {
        if (active) {
          setActivityProgressWidget({ items: [] });
        }
      } finally {
        if (active) {
          setIsActivityProgressLoading(false);
        }
      }
    };

    void loadWidget();

    return () => {
      active = false;
    };
  }, [activeTab, isAuthenticated, pilot]);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !pilot) {
      return;
    }

    const normalizedCountryIso2 = String(countryIso2 || "").trim().toUpperCase();
    if (normalizedCountryIso2) {
      setActiveTab("passport");
      setSelectedPirepId(null);
      return;
    }

    const params = new URLSearchParams(location.search);
    const requestedTab = String(params.get("tab") || "").trim();
    const requestedPirepId = Number(params.get("id") || "0") || null;
    const discordState = String(params.get("discord") || "").trim();

    const normalizedRequestedTab = normalizeDashboardTab(requestedTab);
    const allowedTabs = new Set(["home", "feed", "bookings", "all-flights", "manual-pirep", "notams", "badges", "achievements", "simbrief", "where2fly", "recent", "fleet", "liveries", "airports", "gallery", "pirep", "passport", "balance", "stats", "leaderboard", "settings"]);
    if (normalizedRequestedTab && allowedTabs.has(normalizedRequestedTab)) {
      setActiveTab(normalizedRequestedTab);
      setSelectedPirepId(normalizedRequestedTab === "pirep" ? requestedPirepId : null);
      return;
    }

    if (discordState) {
      setActiveTab("settings");
      setSelectedPirepId(null);
    }
  }, [countryIso2, isAuthLoading, isAuthenticated, pilot, location.search]);

  if (isAuthLoading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated || !pilot) {
    return <Navigate to="/login" replace />;
  }

  const displayNameWithCallsign = `${pilot.firstName} - ${pilot.callsign}`;

  const upcomingBookings = Array.isArray(dashboardHome?.upcomingFlights)
    ? dashboardHome.upcomingFlights
    : [];
  const recentFlightsPreview = Array.isArray(dashboardHome?.recentFlightsPreview)
    ? dashboardHome.recentFlightsPreview
    : [];
  const needsReplyFlights = Array.isArray(dashboardHome?.needsReplyFlights)
    ? dashboardHome.needsReplyFlights
    : [];
  const totalHours = Number(dashboardHome?.stats?.totalHours ?? pilot.totalHours ?? 0) || 0;
  const totalFlights = Number(dashboardHome?.stats?.totalFlights ?? pilot.totalFlights ?? 0) || 0;
  const avgLandingRate = Number(dashboardHome?.stats?.avgLandingRate);
  const memberSinceValue = String(dashboardHome?.stats?.memberSince || pilot.joinDate || "");
  const memberSinceDisplay = formatDashboardDate(memberSinceValue);
  const rankName = String(dashboardHome?.rank?.name || pilot.rank || "Member");
  const regularRankName = String(dashboardHome?.rank?.regularName || rankName || pilot.rank || "Member");
  const honoraryRankName = String(dashboardHome?.rank?.honoraryName || pilot.honoraryRank || "").trim();
  const nextRankName = String(dashboardHome?.rank?.nextRankName || "").trim();
  const rankProgressPercent = Math.max(0, Math.min(100, Number(dashboardHome?.rank?.progressPercent || 0) || 0));
  const rankProgressMetrics = [
    {
      key: "hours",
      label: t("dashboard.rank.metric.hours"),
      value: dashboardHome?.rank?.progressHoursRemaining,
    },
    {
      key: "pireps",
      label: t("dashboard.rank.metric.pireps"),
      value: dashboardHome?.rank?.progressPirepsRemaining,
    },
    {
      key: "points",
      label: t("dashboard.rank.metric.points"),
      value: dashboardHome?.rank?.progressPointsRemaining,
    },
    {
      key: "bonus",
      label: t("dashboard.rank.metric.bonus"),
      value: dashboardHome?.rank?.progressBonusRemaining,
    },
  ].filter((item) => Number.isFinite(Number(item.value)) && Number(item.value) > 0);
  const services = Array.isArray(dashboardHome?.systemStatus?.services)
    ? dashboardHome.systemStatus.services
    : [];
  const urgentNotams = Array.isArray(dashboardHome?.notams?.urgent)
    ? dashboardHome.notams.urgent
    : [];
  const dashboardAlerts = Array.isArray(dashboardHome?.alerts?.items)
    ? dashboardHome.alerts.items
    : [];
  const staffRoles = Array.isArray(dashboardHome?.staffRoles)
    ? dashboardHome.staffRoles.filter((role) => String(role?.role || "").trim().length > 0)
    : [];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const openDashboardTab = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedPirepId(null);
    navigate(`/dashboard?tab=${tabId}`);
  };

  const openPirepDetail = (pirepId: number) => {
    setActiveTab("pirep");
    setSelectedPirepId(pirepId);
    navigate(`/dashboard?tab=pirep&id=${pirepId}`);
  };

  const navItems = [
    { id: "home", label: t("dashboard.tabs.overview"), icon: Home },
    { id: "feed", label: tr("Лента", "Feed"), icon: Activity },
    { id: "bookings", label: t("dashboard.tabs.bookings"), icon: Plane },
    { id: "recent", label: t("dashboard.tabs.recentFlights"), icon: History },
    { id: "all-flights", label: t("dashboard.tabs.allFlights"), icon: MapPin },
    { id: "manual-pirep", label: t("dashboard.tabs.claims"), icon: ClipboardCheck },
    { id: "notams", label: t("dashboard.tabs.notams"), icon: ShieldAlert },
    { id: "badges", label: t("dashboard.tabs.badges"), icon: Award },
    { id: "achievements", label: tr("Достижения", "Achievements"), icon: Trophy },
    { id: "simbrief", label: t("dashboard.simbrief"), icon: Cloud },
    { id: "where2fly", label: t("dashboard.tabs.where2fly"), icon: Navigation },
    { id: "fleet", label: t("dashboard.tabs.fleet"), icon: Plane },
    { id: "liveries", label: t("dashboard.tabs.liveries"), icon: Palette },
    { id: "airports", label: t("dashboard.tabs.airports"), icon: Building2 },
    { id: "gallery", label: t("dashboard.tabs.gallery"), icon: ImagePlus },
    { id: "stats", label: t("dashboard.tabs.stats"), icon: BarChart2 },
    { id: "leaderboard", label: t("dashboard.tabs.leaderboard"), icon: Trophy },
    { id: "passport", label: t("dashboard.tabs.passport"), icon: BookOpen },
    { id: "balance", label: t("dashboard.tabs.balance"), icon: Coins },
    { id: "documents", label: t("nav.documents"), icon: FileText },
    { id: "stream-widgets", label: tr("Виджеты", "Widgets"), icon: MonitorPlay },
    { id: "settings", label: t("dashboard.settings"), icon: Settings },
  ];

  if (isAdmin) {
    navItems.push({ id: "admin", label: t("admin.console.title"), icon: Shield });
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation (EFB Style) */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1a1a1a] text-gray-300 transform transition-transform duration-200 ease-in-out
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col border-r border-gray-800
        `}
      >
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E31E24] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-red-900/20">
              NV
            </div>
            <div>
              <div className="font-bold text-white leading-none">Nordwind Virtual</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Virtual EFB</div>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#252525] border border-gray-700/50">
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">
              {pilot.firstName[0]}{pilot.lastName[0]}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-white truncate">
                {displayNameWithCallsign}
              </div>
              <div className="text-xs text-gray-400 flex items-center justify-between gap-1">
                <span className="text-[#E31E24]">{regularRankName}</span>
                {sidebarBalance !== null ? (
                  <span className="inline-flex items-center gap-0.5 text-amber-400 font-semibold">
                    <Coins size={11} />
                    {sidebarBalance.toLocaleString("ru-RU")}
                  </span>
                ) : null}
              </div>
              {honoraryRankName && honoraryRankName !== regularRankName ? (
                <div className="mt-0.5 text-[11px] text-gray-500">{honoraryRankName}</div>
              ) : null}
              {staffRoles.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {staffRoles.map((role, index) => (
                    <span
                      key={`${role.id || role.role || "staff-role"}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        color: role.color || "#f5f5f5",
                        borderColor: role.color || "rgba(255,255,255,0.18)",
                        backgroundColor: "rgba(255,255,255,0.05)",
                      }}
                    >
                      <span>{role.role}</span>
                      {role.handle ? <span className="text-white/55">@{role.handle}</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="nws-scroll-hover flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            if (item.id === "documents" || item.id === "admin") {
              const toPath = item.id === "admin" ? "/admin" : "/documents";
              return (
                <Link
                  key={item.id}
                  to={toPath}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[#252525] hover:text-white ${item.id === "admin" ? "text-[#E31E24] hover:text-[#E31E24]" : ""}`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  openDashboardTab(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? "bg-[#E31E24] text-white shadow-md shadow-red-900/20" 
                    : "hover:bg-[#252525] hover:text-white"
                  }
                `}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-[#252525] hover:text-white transition-colors"
          >
            <LogOut size={18} />
            {t("dashboard.logout")}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col bg-[#f5f5f7] dark:bg-[#0d1117]">
        {/* Mobile Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between lg:hidden">
          <div className="font-bold text-lg text-gray-900 dark:text-white">
            {navItems.find(i => i.id === activeTab)?.label}
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <button onClick={toggleSidebar} className="text-gray-600">
              <Menu size={24} />
            </button>
          </div>
        </header>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 dark:[background:radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(227,30,36,0.07),transparent),radial-gradient(ellipse_60%_40%_at_80%_80%,rgba(59,130,246,0.05),transparent)]">
          <div className="max-w-7xl mx-auto h-full">
            
            {activeTab === "home" && (
              <div className="space-y-5 animate-in fade-in duration-500">

                {/* ── HERO CARD ── */}
                <div className="relative overflow-hidden rounded-2xl bg-[#1a1a1a] dark:bg-white/[0.04] dark:backdrop-blur-2xl dark:border dark:border-white/[0.09] p-6 shadow-xl dark:shadow-[0_8px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.09)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#E31E24]/20 via-transparent to-transparent pointer-events-none" />
                  <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#E31E24]/20 border border-[#E31E24]/30 flex items-center justify-center text-[#E31E24] font-bold text-xl shrink-0">
                        {pilot.firstName[0]}{pilot.lastName[0]}
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">{t("dashboard.tabs.overview")}</div>
                        <div className="text-2xl font-bold text-white leading-tight">{pilot.firstName} {pilot.lastName}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm text-[#E31E24] font-medium">{regularRankName}</span>
                          {honoraryRankName && honoraryRankName !== regularRankName ? (
                            <span className="text-xs text-white/50">· {honoraryRankName}</span>
                          ) : null}
                          <span className="text-xs text-white/30">·</span>
                          <span className="text-xs text-white/50 font-mono">{pilot.callsign}</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
                      {[
                        { label: t("dashboard.stats.hours"), value: `${totalHours}h`, Icon: Clock },
                        { label: t("dashboard.stats.flights"), value: String(totalFlights), Icon: Plane },
                        { label: t("dashboard.stats.avgRating"), value: Number.isFinite(avgLandingRate) ? `${avgLandingRate} fpm` : "—", Icon: PlaneLanding },
                        { label: t("dashboard.stats.memberSince"), value: memberSinceDisplay, Icon: CalendarDays },
                      ].map((stat) => (
                        <div key={stat.label} className="text-center sm:text-right">
                          <div className="flex items-center justify-center sm:justify-end gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest mb-0.5 min-h-[2rem]">
                            <stat.Icon className="w-3.5 h-3.5 text-[#E31E24]/80 shrink-0 mt-0.5" />
                            <span className="leading-tight">{stat.label}</span>
                          </div>
                          <div className="text-xl font-bold text-white">{stat.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {nextRankName ? (
                    <div className="relative mt-5 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span>{t("dashboard.rank.nextRankPrefix")}: <span className="text-white/70">{nextRankName}</span></span>
                        <span className="font-semibold text-white">{rankProgressPercent}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#E31E24] to-orange-400 transition-[width] duration-700"
                          style={{ width: `${rankProgressPercent}%` }}
                        />
                      </div>
                      {rankProgressMetrics.length > 0 ? (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          {rankProgressMetrics.map((m) => (
                            <span key={m.key} className="text-[11px] text-gray-400">{m.label}: <span className="text-white/70">{m.value}</span></span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* ── URGENT NOTAM STRIP ── */}
                {urgentNotams.length > 0 ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                      <span className="text-sm font-semibold text-red-700">{t("dashboard.notams.alertTitle")}</span>
                      {urgentNotams.map((item) => (
                        <Badge key={item.id} className={`text-[11px] ${item.type === "critical" ? "bg-red-500 text-white" : "bg-amber-500 text-white"}`}>
                          {item.title}
                        </Badge>
                      ))}
                    </div>
                    <Button size="sm" onClick={() => openDashboardTab("notams")} className="bg-red-600 hover:bg-red-700 text-white shrink-0">
                      {t("dashboard.notams.viewAll")}
                    </Button>
                  </div>
                ) : null}

                {/* ── ALERTS ── */}
                {dashboardAlerts.length > 0 ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className="bg-sky-600 text-white text-[11px]">{t("dashboard.alerts.badge")}</Badge>
                      <span className="text-sm font-semibold text-sky-800">{t("dashboard.alerts.title")}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {dashboardAlerts.map((item) => (
                        <div key={item.id} className={`rounded-xl border p-4 bg-white dark:bg-gray-800 shadow-sm border-l-4 ${item.type === "critical" ? "border-l-red-500" : item.type === "warning" ? "border-l-amber-400" : "border-l-sky-400"}`}>
                          <Badge variant="outline" className={`mb-2 text-[10px] ${item.type === "critical" ? "border-red-200 bg-red-50 text-red-700" : item.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
                            {t(`notams.type.${item.type}`)}
                          </Badge>
                          <div className="font-semibold text-[#1d1d1f] dark:text-gray-100 text-sm">{item.title}</div>
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-gray-600 dark:text-gray-400">{item.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* ── MAIN GRID ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Left Column: Upcoming + Recent + Quick Actions */}
                  <div className="lg:col-span-2 space-y-5">
                    <Card className="border border-gray-100 shadow-md overflow-hidden dark:bg-white/[0.04] dark:backdrop-blur-xl dark:border-white/[0.09] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Plane className="h-4 w-4 text-[#E31E24]" />
                            {t("dashboard.upcoming.title")}
                          </CardTitle>
                          <Button size="sm" variant="ghost" className="text-xs text-gray-500 h-7" onClick={() => openDashboardTab("bookings")}>
                            {t("dashboard.tabs.bookings")} →
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {upcomingBookings.length > 0 ? (
                          <div className="space-y-3">
                            {upcomingBookings.map((booking) => (
                              <div
                                key={booking.id}
                                className="relative overflow-hidden rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E31E24] rounded-l-xl" />
                                <div className="flex items-center gap-3 pl-3">
                                  <div className="w-10 h-10 rounded-xl bg-[#E31E24]/10 flex items-center justify-center text-[#E31E24] shrink-0">
                                    <Plane className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="font-bold text-lg">
                                        {booking.callsign && booking.flightNumber && booking.callsign !== booking.flightNumber
                                          ? `${booking.flightNumber}/${booking.callsign}`
                                          : booking.flightNumber}
                                      </div>
                                      {upcomingBookings.length > 1 && upcomingBookings.indexOf(booking) > 0 ? (
                                        <Badge variant="outline" className="bg-white text-xs text-gray-600">
                                          +{upcomingBookings.indexOf(booking)}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="text-sm text-gray-500 flex items-center gap-1">
                                      {upcomingIcaoToCountryIso2(booking.departureCode || booking.departure) ? (
                                        <img src={`https://flagcdn.com/${upcomingIcaoToCountryIso2(booking.departureCode || booking.departure)}.svg`} alt="" className="h-3 w-4.5 rounded-[2px] object-cover" loading="lazy" decoding="async" />
                                      ) : null}
                                      <span className="font-mono text-xs">{booking.departureCode || booking.departure || "—"}</span>
                                      <span className="text-gray-300">→</span>
                                      {upcomingIcaoToCountryIso2(booking.arrivalCode || booking.arrival) ? (
                                        <img src={`https://flagcdn.com/${upcomingIcaoToCountryIso2(booking.arrivalCode || booking.arrival)}.svg`} alt="" className="h-3 w-4.5 rounded-[2px] object-cover" loading="lazy" decoding="async" />
                                      ) : null}
                                      <span className="font-mono text-xs">{booking.arrivalCode || booking.arrival || "—"}</span>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                      {[booking.aircraftType || "", booking.aircraftRegistration || ""].filter(Boolean).join(" ") || booking.aircraft || "—"}
                                      {booking.departureTime ? ` · ${new Date(booking.departureTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : booking.scheduledDate ? ` · ${booking.scheduledDate}${booking.scheduledTime ? ` ${booking.scheduledTime}` : ""}` : ""}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto pl-3 sm:pl-0">
                                  <Button onClick={() => openDashboardTab("simbrief")} variant="outline" size="sm" className="flex-1 sm:flex-none text-xs">
                                    {t("dashboard.briefing")}
                                  </Button>
                                  <Button onClick={() => navigate(`/dashboard/booking/${booking.id}`)} size="sm" className="bg-[#E31E24] hover:bg-[#c41a20] text-white flex-1 sm:flex-none text-xs">
                                    {tr("Открыть", "Open")}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Plane className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">{t("dashboard.upcoming.noFlights")}</p>
                            <Button onClick={() => openDashboardTab("bookings")} variant="link" size="sm" className="text-[#E31E24] mt-1">
                              {t("dashboard.bookFlight")}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Recent flights */}
                    <Card className="border border-gray-100 shadow-sm dark:bg-white/[0.04] dark:backdrop-blur-xl dark:border-white/[0.09] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <History className="h-4 w-4 text-gray-400" />
                            {t("dashboard.home.lastFlights.title")}
                          </CardTitle>
                          <Button size="sm" variant="ghost" className="text-xs text-gray-500 h-7" onClick={() => openDashboardTab("recent")}>
                            {t("dashboard.tabs.recentFlights")} →
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-1.5">
                        {recentFlightsPreview.length > 0 ? (
                          recentFlightsPreview.map((flight) => (
                            <button
                              key={flight.id}
                              type="button"
                              onClick={() => openPirepDetail(flight.id)}
                              className="w-full rounded-xl border border-transparent bg-gray-50/80 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06] hover:border-gray-200 dark:hover:border-white/[0.1] hover:shadow-sm dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)] px-4 py-3 text-left transition-all"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#1d1d1f] dark:text-gray-100 text-sm">{flight.flightNumber || "\u2014"}</div>
                                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                                    {flight.departureCountryIso2 ? (
                                      <img
                                        src={`https://flagcdn.com/${flight.departureCountryIso2.toLowerCase()}.svg`}
                                        alt=""
                                        className="h-3 w-4.5 rounded-[2px] object-cover shrink-0"
                                        loading="lazy"
                                      />
                                    ) : null}
                                    <span className="truncate max-w-[140px]">{flight.departureCity || flight.departure || "\u2014"}</span>
                                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 shrink-0">({flight.departureIcao || flight.departure || "\u2014"})</span>
                                    <span className="text-gray-300 dark:text-gray-600 shrink-0">→</span>
                                    {flight.arrivalCountryIso2 ? (
                                      <img
                                        src={`https://flagcdn.com/${flight.arrivalCountryIso2.toLowerCase()}.svg`}
                                        alt=""
                                        className="h-3 w-4.5 rounded-[2px] object-cover shrink-0"
                                        loading="lazy"
                                      />
                                    ) : null}
                                    <span className="truncate max-w-[140px]">{flight.destinationCity || flight.arrival || "\u2014"}</span>
                                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 shrink-0">({flight.arrivalIcao || flight.arrival || "\u2014"})</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                  {(() => {
                                    const s = (flight.status || "").toLowerCase();
                                    if (s === "accepted") return (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/25">
                                        <CheckCircle2 className="w-3 h-3" />ACCEPTED
                                      </span>
                                    );
                                    if (s === "rejected") return (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-500/12 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/20 dark:border-red-500/25">
                                        <XCircle className="w-3 h-3" />REJECTED
                                      </span>
                                    );
                                    if (s === "pending" || s === "incomplete") return (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-500/12 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/25">
                                        <Clock className="w-3 h-3" />{(flight.status || "").toUpperCase()}
                                      </span>
                                    );
                                    if (s === "need_reply" || s === "needsreply") return (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-orange-500/12 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/20 dark:border-orange-500/25">
                                        <AlertCircle className="w-3 h-3" />REPLY
                                      </span>
                                    );
                                    return (
                                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/15">
                                        <HelpCircle className="w-3 h-3" />{(flight.status || "\u2014").toUpperCase()}
                                      </span>
                                    );
                                  })()}
                                  {flight.completedAt ? (() => {
                                    const d = new Date(flight.completedAt);
                                    const now = new Date();
                                    const diffMs = now.getTime() - d.getTime();
                                    const diffDays = Math.floor(diffMs / 86400000);
                                    const isRu = language === "ru";
                                    const sameYear = d.getFullYear() === now.getFullYear();
                                    let label: string;
                                    if (diffDays === 0) {
                                      label = isRu ? "Сегодня" : "Today";
                                    } else if (diffDays === 1) {
                                      label = isRu ? "Вчера" : "Yesterday";
                                    } else if (diffDays < 7) {
                                      label = isRu ? `${diffDays} дн. назад` : `${diffDays}d ago`;
                                    } else {
                                      const day = d.getDate();
                                      const mon = d.toLocaleDateString(isRu ? "ru-RU" : "en-US", { month: "short" });
                                      label = sameYear ? `${day} ${mon}` : `${day} ${mon} ${String(d.getFullYear()).slice(2)}`;
                                    }
                                    const isRelative = diffDays < 7;
                                    return (
                                      <div className={`flex items-center gap-1 ${isRelative ? "text-[10px] font-medium text-gray-500 dark:text-gray-400" : "text-[11px] text-gray-400 dark:text-gray-500"}`}>
                                        <CalendarDays className="w-3 h-3 shrink-0" />
                                        <span>{label}</span>
                                      </div>
                                    );
                                  })() : <span className="text-[11px] text-gray-400 dark:text-gray-500">\u2014</span>}
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-sm text-gray-400 py-3">{t("dashboard.home.lastFlights.empty")}</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { id: "where2fly", label: t("dashboard.quickActions.findRoute"), desc: t("dashboard.findRoute.desc"), icon: MapPin },
                        { id: "simbrief", label: t("dashboard.simbrief.title"), desc: t("dashboard.simbrief.desc"), icon: Cloud },
                        { id: "fleet", label: t("dashboard.fleet.title"), desc: t("dashboard.fleet.subtitle"), icon: Plane },
                        { id: "airports", label: t("dashboard.airports.title"), desc: t("dashboard.airports.subtitle"), icon: Building2 },
                      ].map(({ id, label, desc, icon: Icon }) => (
                        <button
                          key={id}
                          onClick={() => openDashboardTab(id)}
                          className="group p-4 bg-white dark:bg-white/[0.04] dark:backdrop-blur-xl rounded-xl border border-gray-100 dark:border-white/[0.09] shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.07)] hover:shadow-md hover:border-[#E31E24]/30 dark:hover:border-[#E31E24]/40 dark:hover:bg-white/[0.07] transition-all text-left flex flex-col gap-3"
                        >
                          <div className="w-9 h-9 rounded-lg bg-[#E31E24]/10 flex items-center justify-center text-[#E31E24] group-hover:bg-[#E31E24]/20 transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-sm text-[#1d1d1f] dark:text-gray-100 leading-tight">{label}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5 leading-tight line-clamp-2">{desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Activity + System + Reply */}
                  <div className="space-y-5">
                     {/* Needs Reply */}
                     {needsReplyFlights.length > 0 ? (
                       <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
                         <div className="flex items-center gap-2 mb-1">
                           <ShieldAlert className="h-4 w-4 text-amber-600" />
                           <span className="text-sm font-semibold text-amber-800">{t("dashboard.home.replyNeeded.title")}</span>
                         </div>
                         {needsReplyFlights.map((flight) => (
                           <button
                             key={flight.id}
                             type="button"
                             onClick={() => openPirepDetail(flight.id)}
                             className="w-full rounded-lg border border-amber-100 dark:border-amber-900/50 bg-white dark:bg-gray-800 px-3 py-2.5 text-left transition-colors hover:border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-between gap-2"
                           >
                             <div>
                               <div className="font-semibold text-sm text-[#1d1d1f]">{flight.flightNumber || "—"}</div>
                               <div className="text-xs text-gray-400">{flight.departure || "—"} → {flight.arrival || "—"}</div>
                             </div>
                             <Badge className="bg-amber-500 text-white text-[10px]">{t("dashboard.recent.status.needsReply")}</Badge>
                           </button>
                         ))}
                       </div>
                     ) : null}

                     {/* Activity / Roster — dark themed */}
                     <div className="rounded-2xl overflow-hidden bg-[#111318] dark:bg-white/[0.04] dark:backdrop-blur-xl dark:border dark:border-white/[0.09] shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.09)]">
                       <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                         <div className="flex items-center gap-2">
                           <ClipboardCheck className="h-4 w-4 text-cyan-400" />
                           <span className="text-sm font-semibold text-white">{t("dashboard.activities.widget.title")}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           {Array.isArray(activityProgressWidget?.items) && activityProgressWidget.items.length > 0 ? (
                             <span className="text-[11px] text-cyan-400 font-medium">{activityProgressWidget.items.length} {tr("активных", "active")}</span>
                           ) : null}
                           <Button
                             type="button"
                             variant="ghost"
                             size="sm"
                             className="h-6 px-2 text-[11px] text-gray-400 hover:text-white hover:bg-white/10"
                             onClick={() => setIsActivityWidgetExpanded((v) => !v)}
                           >
                             <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isActivityWidgetExpanded ? "rotate-180" : ""}`} />
                           </Button>
                         </div>
                       </div>

                       {isActivityWidgetExpanded ? (
                         <div className="p-3 space-y-2">
                           {isActivityProgressLoading ? (
                             <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                               <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                               <span>{t("dashboard.activities.widget.loading")}</span>
                             </div>
                           ) : !isPilotApiConnectedForActivities ? (
                             <div className="py-4 space-y-2 text-center">
                               <div className="text-sm text-gray-400">{t("dashboard.activities.widget.connect")}</div>
                               <Button variant="outline" size="sm" onClick={() => openDashboardTab("settings")} className="border-white/10 text-gray-300 hover:bg-white/10 hover:text-white">
                                 {t("settings.pilotApi.connect")}
                               </Button>
                             </div>
                           ) : Array.isArray(activityProgressWidget?.items) && activityProgressWidget.items.length > 0 ? (
                             <>
                               {activityProgressWidget.items.map((item) => {
                                 const progressPercent = Math.max(0, Math.min(100, Number(item?.progress?.progressPercent || 0) || 0));
                                 const status = String(item?.progress?.status || "not_started").trim();
                                 const legCompleted = Number(item?.progress?.legCompleted || 0) || 0;
                                 const legTotal = Number(item?.progress?.legTotal || 0) || 0;
                                 const isDone = status === "completed";
                                 const isNext = status === "in_progress" && !isDone;
                                 const legLabel = isDone ? tr("ВЫПОЛНЕНО", "DONE") : isNext ? tr("В ПРОЦЕССЕ", "NEXT") : tr("НЕ НАЧАТО", "PENDING");
                                 const legAccent = isDone ? "text-emerald-400" : isNext ? "text-cyan-400" : "text-gray-500";
                                 const circleClass = isDone
                                   ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                                   : isNext
                                   ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                                   : "bg-white/5 border-white/10 text-gray-500";

                                 return (
                                   <div key={item.registrationId} className="rounded-xl bg-white/5 border border-white/5 p-3 space-y-2">
                                     <div className="flex items-center justify-between gap-2">
                                       <div className="flex items-center gap-2.5 min-w-0">
                                         <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${circleClass}`}>
                                           {isDone ? "✓" : isNext ? "▶" : "○"}
                                         </div>
                                         <span className="text-sm font-medium text-white truncate">{item.activityTitle}</span>
                                       </div>
                                       <span className={`text-[10px] font-bold uppercase tracking-widest shrink-0 ${legAccent}`}>{legLabel}</span>
                                     </div>
                                     <div>
                                       <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                                         <span>{legTotal > 0 ? `${legCompleted}/${legTotal} ${tr("плечей", "legs")}` : (item.activityType || "")}</span>
                                         <span className="font-semibold text-white">{progressPercent}%</span>
                                       </div>
                                       <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                         <div
                                           className={`h-full rounded-full transition-[width] duration-700 ${isDone ? "bg-gradient-to-r from-emerald-500 to-cyan-400" : isNext ? "bg-gradient-to-r from-cyan-500 to-blue-400" : "bg-white/20"}`}
                                           style={{ width: `${progressPercent}%` }}
                                         />
                                       </div>
                                     </div>
                                   </div>
                                 );
                               })}
                               <button onClick={() => navigate("/activities")} className="w-full text-center text-xs text-cyan-400 hover:text-cyan-300 py-1.5 transition-colors">
                                 {t("dashboard.activities.widget.viewAll")} →
                               </button>
                             </>
                           ) : (
                             <div className="py-4 space-y-2 text-center">
                               <div className="text-sm text-gray-400">{t("dashboard.activities.widget.empty")}</div>
                               <button onClick={() => navigate("/activities")} className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                                 {t("dashboard.activities.widget.viewAll")} →
                               </button>
                             </div>
                           )}
                         </div>
                       ) : null}
                     </div>

                     {/* System Status */}
                     <Card className="border border-gray-100 shadow-sm dark:bg-white/[0.04] dark:backdrop-blur-xl dark:border-white/[0.09] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.07)]">
                       <CardHeader className="pb-2">
                         <CardTitle className="text-sm text-gray-500 uppercase tracking-wider font-semibold">{t("dashboard.system.status")}</CardTitle>
                       </CardHeader>
                       <CardContent className="pt-0 space-y-2">
                         {services.length > 0 ? (
                           services.map((service) => {
                             const isOnline = service.state === "online";
                             return (
                               <div key={service.id} className="flex items-center justify-between text-sm">
                                 <span className="flex items-center gap-2 text-gray-600">
                                   <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-gray-300"}`} />
                                   {service.name}
                                 </span>
                                 <span className={`text-xs font-medium ${isOnline ? "text-emerald-600" : "text-gray-400"}`}>{service.label}</span>
                               </div>
                             );
                           })
                         ) : (
                           <div className="text-sm text-gray-400">{t("dashboard.system.noData")}</div>
                         )}
                       </CardContent>
                     </Card>

                  </div>
                </div>
              </div>
            )}

            {activeTab === "feed" && (
              <div className="animate-in fade-in duration-500">
                <div className="mx-auto max-w-2xl rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm md:p-6">
                  <ActivityFeed limit={40} />
                </div>
              </div>
            )}

            {activeTab === "bookings" && (
              <div className="animate-in fade-in duration-500">
                <PilotBookings />
              </div>
            )}

            {activeTab === "all-flights" && (
              <div className="animate-in fade-in duration-500">
                <PilotAllFlights onOpenBookings={() => openDashboardTab("bookings")} />
              </div>
            )}

            {activeTab === "manual-pirep" && (
              <div className="animate-in fade-in duration-500">
                <PilotClaims />
              </div>
            )}

            {activeTab === "notams" && (
              <div className="animate-in fade-in duration-500">
                <PilotNotams />
              </div>
            )}

            {activeTab === "badges" && (
              <div className="animate-in fade-in duration-500">
                <PilotBadges />
              </div>
            )}

            {activeTab === "achievements" && (
              <div className="animate-in fade-in duration-500">
                <PilotAchievements />
              </div>
            )}

            {activeTab === "simbrief" && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <h1 className="text-2xl font-bold text-[#1d1d1f]">{t("dashboard.briefing.title")}</h1>
                <SimBriefBriefing />
              </div>
            )}

            {activeTab === "where2fly" && (
              <div className="animate-in fade-in duration-500">
                <Where2Fly onOpenBookings={() => openDashboardTab("bookings")} />
              </div>
            )}

            {activeTab === "fleet" && (
              <div className="animate-in fade-in duration-500">
                <PilotFleet />
              </div>
            )}

            {activeTab === "liveries" && (
              <div className="animate-in fade-in duration-500">
                <PilotLiveries />
              </div>
            )}

            {activeTab === "airports" && (
              <div className="animate-in fade-in duration-500">
                <PilotAirports />
              </div>
            )}

            {activeTab === "gallery" && (
              <div className="animate-in fade-in duration-500">
                <PilotSocialGallery />
              </div>
            )}

            {activeTab === "recent" && (
              <div className="animate-in fade-in duration-500">
                <h1 className="text-2xl font-bold text-[#1d1d1f] mb-6">{t("dashboard.tabs.recentFlights")}</h1>
                <RecentFlights onOpenPirep={openPirepDetail} />
              </div>
            )}

            {activeTab === "pirep" && (
              <div className="animate-in fade-in duration-500">
                <PilotPirepDetail pirepId={selectedPirepId} onBack={() => openDashboardTab("recent")} />
              </div>
            )}

            {activeTab === "stats" && (
              <div className="animate-in fade-in duration-500">
                <PilotStats />
              </div>
            )}

            {activeTab === "leaderboard" && (
              <div className="animate-in fade-in duration-500">
                <PilotLeaderboard />
              </div>
            )}

            {activeTab === "passport" && (
              <div className="animate-in fade-in duration-500">
                <PilotPassport
                  countryRouteIso2={String(countryIso2 || "").trim() || null}
                  onOpenCountry={(iso2) => navigate(`/dashboard/passport/${iso2}`)}
                  onBackToPassport={() => navigate("/dashboard?tab=passport")}
                />
              </div>
            )}

            {activeTab === "balance" && (
              <div className="animate-in fade-in duration-500">
                <PilotBalance />
              </div>
            )}

            {activeTab === "stream-widgets" && (
              <div className="animate-in fade-in duration-500">
                <PilotStreamWidgets />
              </div>
            )}

            {activeTab === "settings" && <PilotSettings />}
          </div>
        </div>
      </main>
    </div>
  );
}
