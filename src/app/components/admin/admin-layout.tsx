import { useEffect, useMemo, useState, type FC, useCallback } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { AdminDashboard } from "./admin-dashboard";
import { AdminAcars } from "./admin-acars";
import { AdminNews } from "./admin-news";
import { AdminActivities } from "./admin-activities";
import { AdminPilots } from "./admin-pilots";
import { AdminPilotProfile } from "./admin-pilot-profile";
import { AdminFleet } from "./admin-fleet";
import { AdminSettings } from "./admin-settings";
import { AdminDocuments } from "./admin-documents";
import { AdminStaff } from "./admin-staff";
import { AdminEvents } from "./admin-events";
import { AdminBadges } from "./admin-content-pages";
import { AdminBookingsManagement, AdminRoutesManagement } from "./admin-operations-pages";
import { AdminPireps, AdminPirepDetail } from "./admin-pireps";
import { AdminAirportsManagement, AdminHubsManagement } from "./admin-network-pages";
import { AdminTickets } from "./admin-tickets";
import { AdminDiscordBot } from "./admin-discord-bot";
import { AdminTelegramBot } from "./admin-telegram-bot";
import { AdminAuditLogs } from "./admin-audit-logs";
import { AdminAuthLogs } from "./admin-auth-logs";
import { AdminBannerGeneratorPage } from "./admin-banner-generator";
import { AdminGallery } from "./admin-gallery";
import { AdminCallsignChecker } from "./admin-callsign-checker";
import { AdminNotams } from "./admin-notams";
import {
  Award,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Circle,
  ListChecks,
  ChevronDown,
  ClipboardList,
  FileSearch2,
  FileText,
  Images,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  MapPinned,
  MessageSquare,
  Plane,
  Radio,
  Route,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { useSiteDesign } from "../../hooks/use-site-design";
import { Button } from "../ui/button";
import { fetchAdminBootstrap } from "./admin-bootstrap-cache";
import { AdminNavContext } from "./admin-nav-context";
import { AdminQuickAccessHeaderMenu } from "./admin-quick-access";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";

const ADMIN_PAGES = new Set([
  "fleet", "news", "activities", "notams", "pilots", "pilot-profile", "documents",
  "events", "staff", "badges", "bookings", "routes", "pireps", "pirep-detail",
  "airports", "hubs", "tickets", "discord-bot", "telegram-bot",
  "banner-generator", "acars", "settings", "audit-logs", "auth-logs", "gallery",
  "callsign-checker",
]);

function AdminPageContent({ page, pageId }: { page: string; pageId: number }) {
  if (page === "pilot-profile") return <AdminPilotProfile />;
  if (page === "pirep-detail") return <AdminPirepDetail pirepId={pageId} />;
  if (page === "fleet") return <AdminFleet />;
  if (page === "news") return <AdminNews />;
  if (page === "activities") return <AdminActivities />;
  if (page === "notams") return <AdminNotams />;
  if (page === "pilots") return <AdminPilots />;
  if (page === "documents") return <AdminDocuments />;
  if (page === "events") return <AdminEvents />;
  if (page === "staff") return <AdminStaff />;
  if (page === "badges") return <AdminBadges />;
  if (page === "bookings") return <AdminBookingsManagement />;
  if (page === "routes") return <AdminRoutesManagement />;
  if (page === "pireps") return <AdminPireps />;
  if (page === "airports") return <AdminAirportsManagement />;
  if (page === "hubs") return <AdminHubsManagement />;
  if (page === "tickets") return <AdminTickets />;
  if (page === "discord-bot") return <AdminDiscordBot />;
  if (page === "telegram-bot") return <AdminTelegramBot />;
  if (page === "banner-generator") return <AdminBannerGeneratorPage />;
  if (page === "gallery") return <AdminGallery />;
  if (page === "callsign-checker") return <AdminCallsignChecker />;
  if (page === "acars") return <AdminAcars />;
  if (page === "settings") return <AdminSettings />;
  if (page === "audit-logs") return <AdminAuditLogs />;
  if (page === "auth-logs") return <AdminAuthLogs />;
  return <AdminDashboard />;
}

type MenuItem = {
  page: string;
  label: string;
  icon: LucideIcon;
  standalone?: string;
  children?: Array<{
    view: string;
    label: string;
  }>;
};

type MenuSection = {
  id: "operations" | "media" | "settings";
  label: string;
  items: MenuItem[];
};


export function AdminLayout() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { pilot, isAuthenticated, isAuthLoading, isAdmin } = useAuth();
  const design = useSiteDesign();

  const [role, setRole] = useState("admin");
  const [activePage, setActivePage] = useState("dashboard");
  const [activeId, setActiveId] = useState(0);
  const [menuSectionsOpen, setMenuSectionsOpen] = useState<Record<MenuSection["id"], boolean>>({
    operations: true,
    media: true,
    settings: true,
  });
  const [submenuOpen, setSubmenuOpen] = useState<Record<string, boolean>>({
    events: true,
  });

  const tr = useCallback((ru: string, en: string) => (language === "ru" ? ru : en), [language]);
  const primaryColor = design.primaryColor || "#E31E24";
  const accentColor = design.accentColor || "#1a1a1a";
  const adminLogo = design.adminLogoDataUrl || logo;

  useEffect(() => {
    let active = true;

    const loadAccess = async () => {
      try {
        const response = await fetch("/api/admin/access/me", { credentials: "include" });
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (active) {
          setRole(String(payload?.role || "admin"));
        }
      } catch {
        // Ignore access badge errors and keep default role.
      }
    };

    loadAccess().catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetchAdminBootstrap().catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const menuSections: MenuSection[] = useMemo(
    () => [
      {
        id: "operations",
        label: tr("Операции", "Operations"),
        items: [
          { page: "hubs", icon: MapPinned, label: tr("Хабы", "Hubs") },
          { page: "airports", icon: Building2, label: tr("Аэропорты", "Airports") },
          { page: "fleet", icon: Plane, label: t("admin.nav.fleet") },
          { page: "routes", icon: Route, label: tr("Маршруты", "Routes") },
          { page: "callsign-checker", icon: ListChecks, label: tr("Проверка каллсайнов", "Callsign Checker") },
          { page: "bookings", icon: ClipboardList, label: tr("Бронирования", "Bookings") },
          { page: "pireps", icon: FileSearch2, label: "PIREPs" },
          { page: "pilots", icon: Users, label: t("admin.nav.pilots") },
          {
            page: "events",
            icon: CalendarDays,
            label: tr("События", "Events"),
            children: [
              { view: "events", label: tr("События", "Events") },
              { view: "focus-airports", label: tr("Фокусные аэропорты", "Focus Airports") },
              { view: "rosters", label: tr("Ростеры", "Rosters") },
              { view: "curated-rosters", label: tr("Кураторские ростеры", "Curated Rosters") },
              { view: "community", label: tr("Цели и челленджи сообщества", "Community Goals & Challenges") },
            ],
          },
          { page: "documents", icon: FileText, label: t("admin.nav.documents") },
        ],
      },
      {
        id: "media",
        label: tr("Медиа", "Media"),
        items: [
          { page: "news", icon: Bell, label: tr("Новости", "News") },
          { page: "tickets", icon: MessageSquare, label: tr("Тикеты", "Tickets") },
          { page: "badges", icon: Award, label: tr("Бейджи", "Badges") },
          { page: "activities", icon: Bell, label: tr("Активности", "Activities") },
          { page: "notams", icon: ShieldAlert, label: tr("NOTAMы vAMSYS", "vAMSYS NOTAMs") },
          { page: "banner-generator", icon: ImagePlus, label: tr("Генератор баннеров", "Banner Generator"), standalone: "/banner-generator" },
          { page: "gallery", icon: Images, label: tr("Галерея", "Gallery") },
        ],
      },
      {
        id: "settings",
        label: tr("Настройки", "Settings"),
        items: [
          { page: "discord-bot", icon: Bot, label: tr("Discord", "Discord") },
          { page: "telegram-bot", icon: Send, label: tr("Telegram", "Telegram") },
          { page: "settings", icon: Settings, label: tr("Настройки", "Settings") },
          { page: "staff", icon: ShieldCheck, label: tr("Персонал", "Staff") },
          { page: "audit-logs", icon: ClipboardList, label: tr("Журнал аудита", "Audit Log") },
          { page: "auth-logs", icon: LogOut, label: tr("Журнал авторизации", "Auth Log") },
          { page: "acars", icon: Radio, label: tr("Кэш телеметрии", "Telemetry Cache") },
        ],
      },
    ],
    [t, tr],
  );

  // Sync activePage/activeId from URL search params — same pattern as pilot dashboard
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedPage = params.get("page") || "dashboard";
    const requestedId = Number(params.get("id") || 0) || 0;
    if (ADMIN_PAGES.has(requestedPage)) {
      setActivePage(requestedPage);
      setActiveId(requestedId);
    } else {
      setActivePage("dashboard");
      setActiveId(0);
    }
  }, [location.search]);

  useEffect(() => {
    setMenuSectionsOpen((current) => {
      const next = { ...current };
      menuSections.forEach((section) => {
        if (section.items.some((item) => activePage === item.page)) {
          next[section.id] = true;
        }
      });
      return next;
    });
  }, [activePage, menuSections]);

  useEffect(() => {
    if (activePage === "events") {
      setSubmenuOpen((current) => ({ ...current, events: true }));
    }
  }, [activePage]);

  const displayName = useMemo(() => {
    if (!pilot) {
      return tr("Администратор", "Admin User");
    }
    return `${pilot.firstName} ${pilot.lastName}`.trim() || pilot.callsign || tr("Администратор", "Admin User");
  }, [pilot, tr]);

  const displayEmail = useMemo(() => {
    if (!pilot) {
      return "admin@nordwind.va";
    }
    return pilot.email || pilot.callsign || "admin@nordwind.va";
  }, [pilot]);

  const initials = useMemo(() => {
    if (!pilot) {
      return "AD";
    }
    return `${pilot.firstName?.[0] || "A"}${pilot.lastName?.[0] || "D"}`.toUpperCase();
  }, [pilot]);

  const navigateTo = useCallback((page: string, id = 0) => {
    setActivePage(page);
    setActiveId(id);
    navigate(id > 0 ? `/admin?page=${page}&id=${id}` : `/admin?page=${page}`);
  }, [navigate]);

  // Auth guard — after all hooks so React hook order is consistent
  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogout = () => {
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="fixed z-10 flex h-full w-72 flex-col text-white" style={{ backgroundColor: accentColor }}>
        <div className="border-b border-gray-800 p-6">
          <div className="mb-2 flex items-center gap-2">
            <img src={adminLogo} alt={design.siteTitle || "Nordwind Virtual"} className="h-[40px] w-auto object-contain" />
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{t("admin.console.title")}</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <button
            type="button"
            onClick={() => { setActivePage("dashboard"); setActiveId(0); navigate("/admin"); }}
            style={activePage === "dashboard" ? { backgroundColor: primaryColor } : undefined}
            className={`mb-2 flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
              activePage === "dashboard" ? "text-white shadow-md" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <LayoutDashboard size={18} />
            <span>{t("admin.nav.overview")}</span>
          </button>

          {menuSections.map((section) => {
            const isOpen = Boolean(menuSectionsOpen[section.id]);
            const isSectionActive = section.items.some((item) => activePage === item.page);

            return (
              <div key={section.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setMenuSectionsOpen((current) => ({ ...current, [section.id]: !isOpen }))}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isSectionActive ? "text-white" : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
                  }`}
                >
                  <span className="flex-1 text-left">{section.label}</span>
                  <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`} />
                </button>

                {isOpen ? (
                  <div className="ml-2 space-y-1 border-l border-gray-800 pl-2">
                    {section.items.map((item) => {
                      const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                      const itemActive = activePage === item.page;
                      const currentView = new URLSearchParams(location.search).get("view") || "events";

                      if (hasChildren) {
                        const isItemOpen = Boolean(submenuOpen.events);
                        return (
                          <div key={item.page} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => setSubmenuOpen((current) => ({ ...current, events: !isItemOpen }))}
                              style={itemActive ? { backgroundColor: primaryColor } : undefined}
                              className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                itemActive ? "text-white shadow-md" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                              }`}
                            >
                              <item.icon size={16} />
                              <span className="flex-1 text-left">{item.label}</span>
                              <ChevronDown size={14} className={`transition-transform ${isItemOpen ? "rotate-180" : "rotate-0"}`} />
                            </button>

                            {isItemOpen ? (
                              <div className="ml-2 space-y-1 border-l border-gray-800/80 pl-3">
                                {item.children?.map((child) => {
                                  const isChildActive = activePage === "events" && currentView === child.view;
                                  return (
                                    <button
                                      key={child.view}
                                      type="button"
                                      onClick={() => { setActivePage("events"); setActiveId(0); navigate(`/admin?page=events&view=${child.view}`); }}
                                      style={isChildActive ? { backgroundColor: primaryColor } : undefined}
                                      className={`flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                                        isChildActive ? "text-white shadow-md" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                      }`}
                                    >
                                      <Circle size={8} />
                                      <span>{child.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      if (item.standalone) {
                        return (
                          <button
                            key={item.page}
                            type="button"
                            onClick={() => navigate(item.standalone!)}
                            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors text-gray-400 hover:bg-gray-800 hover:text-white"
                          >
                            <item.icon size={16} />
                            <span>{item.label}</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={item.page}
                          type="button"
                          onClick={() => { setActivePage(item.page); setActiveId(0); navigate(`/admin?page=${item.page}`); }}
                          style={itemActive ? { backgroundColor: primaryColor } : undefined}
                          className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                            itemActive ? "text-white shadow-md" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                          }`}
                        >
                          <item.icon size={16} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-gray-800 p-4">
          <div className="mb-2 flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-bold">{initials}</div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-gray-500">{displayEmail}</p>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: primaryColor }}>
                {role}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start text-red-400 hover:bg-red-900/20 hover:text-red-300"
            onClick={handleLogout}
          >
            <LogOut size={16} className="mr-2" />
            {t("admin.console.exit")}
          </Button>
        </div>
      </aside>

      <main className="ml-72 flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-8">
          <h1 className="font-semibold text-gray-800">{t("admin.panel.title")}</h1>
          <div className="flex items-center gap-4">
            <AdminQuickAccessHeaderMenu />
            <div className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs text-green-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              {t("admin.status.api")}
            </div>
          </div>
        </header>

        <div className="flex-1 min-w-0 overflow-auto p-8">
          <AdminNavContext.Provider value={{ navigateTo }}>
            <AdminPageContent page={activePage} pageId={activeId} />
          </AdminNavContext.Provider>
        </div>
      </main>
    </div>
  );
}
