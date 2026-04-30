import { useAuth } from "../../context/auth-context";
import { useLanguage } from "../../context/language-context";
import { Navigate, Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  Plane,
  MapPin,
  Building2,
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

const normalizeDashboardTab = (value: string) => {
  if (value === "claims") {
    return "manual-pirep";
  }

  return value;
};

export function PilotDashboard() {
  const { isAuthenticated, isAuthLoading, pilot, isAdmin, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
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
      departure?: string;
      arrival?: string;
      departureCode?: string;
      arrivalCode?: string;
      scheduledDate?: string;
      scheduledTime?: string;
      departureTime?: string | null;
      aircraft: string;
    }>;
    recentFlightsPreview?: Array<{
      id: number;
      flightNumber: string;
      departure?: string;
      arrival?: string;
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
  const [isActivityWidgetExpanded, setIsActivityWidgetExpanded] = useState(false);

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

    const params = new URLSearchParams(location.search);
    const requestedTab = String(params.get("tab") || "").trim();
    const requestedPirepId = Number(params.get("id") || "0") || null;
    const discordState = String(params.get("discord") || "").trim();

    const normalizedRequestedTab = normalizeDashboardTab(requestedTab);
    const allowedTabs = new Set(["home", "bookings", "all-flights", "manual-pirep", "notams", "badges", "simbrief", "where2fly", "recent", "fleet", "liveries", "airports", "pirep", "settings"]);
    if (normalizedRequestedTab && allowedTabs.has(normalizedRequestedTab)) {
      setActiveTab(normalizedRequestedTab);
      setSelectedPirepId(normalizedRequestedTab === "pirep" ? requestedPirepId : null);
      return;
    }

    if (discordState) {
      setActiveTab("settings");
      setSelectedPirepId(null);
    }
  }, [isAuthLoading, isAuthenticated, pilot, location.search]);

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
  const memberSinceYear = Number.isFinite(new Date(memberSinceValue).getTime())
    ? new Date(memberSinceValue).getFullYear()
    : new Date().getFullYear();
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
    { id: "bookings", label: "Bookings", icon: Plane },
    { id: "all-flights", label: t("dashboard.tabs.allFlights"), icon: MapPin },
    { id: "manual-pirep", label: t("dashboard.tabs.claims"), icon: ClipboardCheck },
    { id: "notams", label: t("dashboard.tabs.notams"), icon: ShieldAlert },
    { id: "badges", label: t("dashboard.tabs.badges"), icon: Award },
    { id: "simbrief", label: t("dashboard.simbrief"), icon: Cloud },
    { id: "where2fly", label: t("dashboard.tabs.where2fly"), icon: Navigation },
    { id: "fleet", label: "Fleet", icon: Plane },
    { id: "liveries", label: t("dashboard.tabs.liveries"), icon: Palette },
    { id: "airports", label: "Airports", icon: Building2 },
    { id: "recent", label: t("dashboard.tabs.recentFlights"), icon: History },
    { id: "documents", label: t("nav.documents"), icon: FileText },
    { id: "settings", label: t("dashboard.settings"), icon: Settings },
  ];

  if (isAdmin) {
    navItems.push({ id: "admin", label: t("admin.console.title"), icon: Shield });
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
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
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <span className="text-[#E31E24]">{pilot.rank}</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
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
      <main className="flex-1 overflow-hidden flex flex-col bg-[#f5f5f7]">
        {/* Mobile Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between lg:hidden">
          <div className="font-bold text-lg text-gray-900">
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
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto h-full">
            <div className="mb-4 hidden items-center justify-end lg:flex">
              <NotificationCenter />
            </div>
            
            {activeTab === "home" && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-[#1d1d1f]">
                    {t("dashboard.tabs.overview")}
                  </h1>
                  <div className="text-sm text-gray-500">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>

                {urgentNotams.length > 0 ? (
                  <Card className="border-orange-200 bg-linear-to-r from-orange-50 via-amber-50 to-white shadow-sm">
                    <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-orange-500 text-white">{t("dashboard.notams.alertBadge")}</Badge>
                          <div className="font-semibold text-[#1d1d1f]">{t("dashboard.notams.alertTitle")}</div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{t("dashboard.notams.alertSubtitle")}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {urgentNotams.map((item) => (
                            <Badge key={item.id} variant="outline" className="border-orange-200 bg-white text-orange-700">
                              {item.title}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <Button
                        onClick={() => openDashboardTab("notams")}
                        variant="outline"
                        className="border-orange-200 bg-white text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                      >
                        {t("dashboard.notams.viewAll")}
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                {dashboardAlerts.length > 0 ? (
                  <Card className="border-sky-200 bg-linear-to-r from-sky-50 via-cyan-50 to-white shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-sky-600 text-white">{t("dashboard.alerts.badge")}</Badge>
                        <div className="font-semibold text-[#1d1d1f]">{t("dashboard.alerts.title")}</div>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        {dashboardAlerts.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={item.type === "critical" ? "border-red-200 bg-red-50 text-red-700" : item.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-sky-200 bg-sky-50 text-sky-700"}>
                                {t(`notams.type.${item.type}`)}
                              </Badge>
                            </div>
                            <div className="mt-3 font-semibold text-[#1d1d1f]">{item.title}</div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{item.content}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-gray-500 text-sm mb-1">{t("dashboard.stats.hours")}</div>
                      <div className="text-2xl font-bold text-[#1d1d1f]">{totalHours}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-gray-500 text-sm mb-1">{t("dashboard.stats.flights")}</div>
                      <div className="text-2xl font-bold text-[#1d1d1f]">{totalFlights}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-gray-500 text-sm mb-1">{t("dashboard.stats.avgRating")}</div>
                      <div className="text-2xl font-bold text-[#1d1d1f]">
                        {Number.isFinite(avgLandingRate) ? `${avgLandingRate} fpm` : "—"}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="text-gray-500 text-sm mb-1">{t("dashboard.stats.memberSince")}</div>
                      <div className="text-2xl font-bold text-[#1d1d1f]">
                        {memberSinceYear}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions & Status */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Upcoming & Quick Actions */}
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-md">
                      <CardHeader>
                        <CardTitle>{t("dashboard.upcoming.title")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {upcomingBookings.length > 0 ? (
                          <div className="space-y-4">
                            {upcomingBookings.map((booking) => (
                              <div
                                key={booking.id}
                                className="border border-gray-100 bg-gray-50/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-full bg-[#E31E24]/10 flex items-center justify-center text-[#E31E24]">
                                    <Plane className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="font-bold text-lg">{booking.flightNumber}</div>
                                      {upcomingBookings.length > 1 && upcomingBookings.indexOf(booking) > 0 ? (
                                        <Badge variant="outline" className="bg-white text-xs text-gray-600">
                                          +{upcomingBookings.indexOf(booking)}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {booking.departureCode || booking.departure || "—"} <span className="text-gray-400">→</span> {booking.arrivalCode || booking.arrival || "—"}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {booking.departureTime
                                        ? new Date(booking.departureTime).toLocaleString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })
                                        : `${booking.scheduledDate || ""}${booking.scheduledTime ? ` • ${booking.scheduledTime}` : ""}` || "—"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <Button 
                                    onClick={() => openDashboardTab("simbrief")}
                                    variant="outline"
                                    className="flex-1 sm:flex-none"
                                  >
                                    {t("dashboard.briefing")}
                                  </Button>
                                  <Button 
                                    onClick={() => openDashboardTab("bookings")}
                                    className="bg-[#E31E24] hover:bg-[#c41a20] text-white flex-1 sm:flex-none"
                                  >
                                    Manage booking
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-10">
                            <Plane className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">{t("dashboard.upcoming.noFlights")}</p>
                            <Button 
                              onClick={() => openDashboardTab("bookings")}
                              variant="link" 
                              className="text-[#E31E24]"
                            >
                              {t("dashboard.bookFlight")}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button 
                        onClick={() => openDashboardTab("where2fly")}
                        className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-left flex items-start justify-between group"
                      >
                        <div>
                          <div className="font-bold text-lg mb-1">{t("dashboard.quickActions.findRoute")}</div>
                          <div className="text-sm text-gray-500">{t("dashboard.findRoute.desc")}</div>
                        </div>
                        <MapPin className="w-6 h-6 text-[#E31E24] group-hover:scale-110 transition-transform" />
                      </button>

                      <button 
                        onClick={() => openDashboardTab("simbrief")}
                        className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-left flex items-start justify-between group"
                      >
                        <div>
                          <div className="font-bold text-lg mb-1">{t("dashboard.simbrief.title")}</div>
                          <div className="text-sm text-gray-500">{t("dashboard.simbrief.desc")}</div>
                        </div>
                        <Cloud className="w-6 h-6 text-[#E31E24] group-hover:scale-110 transition-transform" />
                      </button>

                      <button 
                        onClick={() => openDashboardTab("fleet")}
                        className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-left flex items-start justify-between group"
                      >
                        <div>
                          <div className="font-bold text-lg mb-1">Fleet</div>
                          <div className="text-sm text-gray-500">Inspect aircraft, links, and resource packs.</div>
                        </div>
                        <Plane className="w-6 h-6 text-[#E31E24] group-hover:scale-110 transition-transform" />
                      </button>

                      <button 
                        onClick={() => openDashboardTab("airports")}
                        className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow text-left flex items-start justify-between group"
                      >
                        <div>
                          <div className="font-bold text-lg mb-1">Airports</div>
                          <div className="text-sm text-gray-500">Browse airport info, briefing links, and alternates.</div>
                        </div>
                        <Building2 className="w-6 h-6 text-[#E31E24] group-hover:scale-110 transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Profile/Notams/Misc */}
                  <div className="space-y-6">
                     <Card className="bg-[#2A2A2A] text-white border-none shadow-md">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-[#E31E24]" />
                            {t("dashboard.rank.current")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold mb-1">{regularRankName}</div>
                          <div className="mb-3 text-sm text-white/80">
                            {t("dashboard.rank.honorary")}: {honoraryRankName || "—"}
                          </div>
                          <div className="text-xs text-gray-400 flex justify-between">
                            <span>Live vAMSYS data</span>
                            <span>{totalHours}h</span>
                          </div>
                        </CardContent>
                     </Card>

                     <Card className="border-none shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base">{t("dashboard.rank.progressTitle")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {nextRankName ? (
                            <>
                              <div className="flex items-center justify-between text-sm text-gray-600">
                                <span>{`${t("dashboard.rank.nextRankPrefix")}: ${nextRankName}`}</span>
                                <span className="font-semibold text-[#1d1d1f]">{rankProgressPercent}%</span>
                              </div>
                              <Progress value={rankProgressPercent} className="h-2.5 bg-gray-200 [&_[data-slot=progress-indicator]]:bg-[#E31E24]" />
                              {rankProgressMetrics.length > 0 ? (
                                <div className="space-y-1.5 text-xs text-gray-500">
                                  {rankProgressMetrics.map((metric) => (
                                    <div key={metric.key} className="flex items-center justify-between">
                                      <span>{metric.label}</span>
                                      <span className="font-medium text-gray-700">{metric.value}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">{t("dashboard.rank.progressNoRequirements")}</div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-gray-600">{t("dashboard.rank.maxRank")}</div>
                          )}
                        </CardContent>
                     </Card>

                     <Card className="border-none shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base">{t("dashboard.system.status")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {services.length > 0 ? (
                            services.map((service) => {
                              const isOnline = service.state === "online";
                              return (
                                <div key={service.id} className="flex items-center justify-between text-sm">
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-400"}`}
                                    ></span>
                                    {service.name}
                                  </span>
                                  <span className={isOnline ? "text-green-600 font-medium" : "text-gray-500 font-medium"}>
                                    {service.label}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-sm text-gray-500">{t("dashboard.system.noData")}</div>
                          )}
                        </CardContent>
                     </Card>

                     {needsReplyFlights.length > 0 ? (
                       <Card className="border-amber-200 bg-linear-to-r from-amber-50 via-orange-50 to-white shadow-sm">
                          <CardHeader>
                            <CardTitle className="text-base text-[#1d1d1f]">{t("dashboard.home.replyNeeded.title")}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="text-sm text-gray-600">{t("dashboard.home.replyNeeded.subtitle")}</div>
                            {needsReplyFlights.map((flight) => (
                              <button
                                key={flight.id}
                                type="button"
                                onClick={() => openPirepDetail(flight.id)}
                                className="w-full rounded-xl border border-amber-100 bg-white px-4 py-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-[#1d1d1f]">{flight.flightNumber || "—"}</div>
                                    <div className="mt-1 text-sm text-gray-500">{flight.departure || "—"} → {flight.arrival || "—"}</div>
                                  </div>
                                  <Badge className="bg-amber-500 text-white">{t("dashboard.recent.status.needsReply")}</Badge>
                                </div>
                              </button>
                            ))}
                          </CardContent>
                       </Card>
                     ) : null}

                     <Card className="border-none shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-base">{t("dashboard.home.lastFlights.title")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {recentFlightsPreview.length > 0 ? (
                            recentFlightsPreview.map((flight) => (
                              <button
                                key={flight.id}
                                type="button"
                                onClick={() => openPirepDetail(flight.id)}
                                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-left transition-colors hover:border-[#E31E24] hover:bg-white"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-[#1d1d1f]">{flight.flightNumber || "—"}</div>
                                    <div className="mt-1 text-sm text-gray-500">{flight.departure || "—"} → {flight.arrival || "—"}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{flight.status || "—"}</div>
                                    <div className="mt-1 text-xs text-gray-500">
                                      {flight.completedAt
                                        ? new Date(flight.completedAt).toLocaleDateString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                          })
                                        : "—"}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">{t("dashboard.home.lastFlights.empty")}</div>
                          )}
                        </CardContent>
                     </Card>

                     <Card className="border-none shadow-sm">
                        <CardHeader className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <ClipboardCheck className="h-4 w-4 text-[#E31E24]" />
                                {t("dashboard.activities.widget.title")}
                              </CardTitle>
                              <div className="mt-1 text-xs text-gray-500">{t("dashboard.activities.widget.subtitle")}</div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-gray-600"
                              onClick={() => setIsActivityWidgetExpanded((value) => !value)}
                            >
                              {isActivityWidgetExpanded ? "Collapse" : "Expand"}
                              <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${isActivityWidgetExpanded ? "rotate-180" : "rotate-0"}`} />
                            </Button>
                          </div>

                          <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            {isActivityProgressLoading
                              ? "Loading..."
                              : !isPilotApiConnectedForActivities
                                ? t("dashboard.activities.widget.connect")
                                : Array.isArray(activityProgressWidget?.items) && activityProgressWidget.items.length > 0
                                  ? `${activityProgressWidget.items.length} active item(s)`
                                  : t("dashboard.activities.widget.empty")}
                          </div>
                        </CardHeader>

                        {isActivityWidgetExpanded ? (
                          <CardContent className="space-y-3">
                            {isActivityProgressLoading ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading...
                              </div>
                            ) : !isPilotApiConnectedForActivities ? (
                              <div className="space-y-3">
                                <div className="text-sm text-gray-500">{t("dashboard.activities.widget.connect")}</div>
                                <Button variant="outline" size="sm" onClick={() => openDashboardTab("settings")}>
                                  {t("settings.pilotApi.connect")}
                                </Button>
                              </div>
                            ) : Array.isArray(activityProgressWidget?.items) && activityProgressWidget.items.length > 0 ? (
                              <div className="space-y-3">
                                {activityProgressWidget.items.map((item) => {
                                  const progressPercent = Math.max(0, Math.min(100, Number(item?.progress?.progressPercent || 0) || 0));
                                  const status = String(item?.progress?.status || "not_started").trim();
                                  const legCompleted = Number(item?.progress?.legCompleted || 0) || 0;
                                  const legTotal = Number(item?.progress?.legTotal || 0) || 0;

                                  return (
                                    <div key={item.registrationId} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="truncate text-sm font-medium text-[#1d1d1f]">{item.activityTitle}</div>
                                        <Badge variant="outline" className="border-gray-200 bg-white text-[10px] text-gray-700">
                                          {item.activityType || "Event"}
                                        </Badge>
                                      </div>
                                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                                        <span>{status === "not_started" ? t("dashboard.activities.widget.notStarted") : status.replaceAll("_", " ")}</span>
                                        <span>{progressPercent}%</span>
                                      </div>
                                      <Progress value={progressPercent} className="mt-2 h-2 bg-gray-200 [&_[data-slot=progress-indicator]]:bg-[#E31E24]" />
                                      {legTotal > 0 ? (
                                        <div className="mt-1 text-[11px] text-gray-500">
                                          {t("dashboard.activities.widget.legs")}: {legCompleted}/{legTotal}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}

                                <Button variant="outline" size="sm" onClick={() => navigate("/activities")}>
                                  {t("dashboard.activities.widget.viewAll")}
                                </Button>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">{t("dashboard.activities.widget.empty")}</div>
                            )}
                          </CardContent>
                        ) : null}
                     </Card>
                  </div>
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

            {activeTab === "settings" && <PilotSettings />}
          </div>
        </div>
      </main>
    </div>
  );
}
