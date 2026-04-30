import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  Award,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Circle,
  ChevronDown,
  ClipboardList,
  FileSearch2,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPinned,
  MessageSquare,
  Plane,
  Radio,
  Route,
  Send,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { useSiteDesign } from "../../hooks/use-site-design";
import { Button } from "../ui/button";
import { AdminQuickAccessHeaderMenu } from "./admin-quick-access";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";

type MenuItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  children?: Array<{
    path: string;
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
  const { pilot, logout } = useAuth();
  const design = useSiteDesign();

  const [role, setRole] = useState("admin");
  const [menuSectionsOpen, setMenuSectionsOpen] = useState<Record<MenuSection["id"], boolean>>({
    operations: true,
    media: true,
    settings: true,
  });
  const [submenuOpen, setSubmenuOpen] = useState<Record<string, boolean>>({
    events: true,
  });

  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
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

  const menuSections: MenuSection[] = useMemo(
    () => [
      {
        id: "operations",
        label: "Operations",
        items: [
          { path: "/admin/hubs", icon: MapPinned, label: "Hubs" },
          { path: "/admin/airports", icon: Building2, label: "Airports" },
          { path: "/admin/fleet", icon: Plane, label: t("admin.nav.fleet") },
          { path: "/admin/routes", icon: Route, label: "Routes" },
          { path: "/admin/bookings", icon: ClipboardList, label: "Bookings" },
          { path: "/admin/pireps", icon: FileSearch2, label: "PIREPs" },
          { path: "/admin/pilots", icon: Users, label: t("admin.nav.pilots") },
          {
            path: "/admin/events",
            icon: CalendarDays,
            label: "Events",
            children: [
              { path: "/admin/events?view=events", label: "Events" },
              { path: "/admin/events?view=focus-airports", label: "Focus Airports" },
              { path: "/admin/events?view=rosters", label: "Rosters" },
              { path: "/admin/events?view=curated-rosters", label: "Curated Rosters" },
              { path: "/admin/events?view=community", label: "Community Goals & Challenges" },
            ],
          },
          { path: "/admin/documents", icon: FileText, label: t("admin.nav.documents") },
        ],
      },
      {
        id: "media",
        label: "Media",
        items: [
          { path: "/admin/news", icon: Bell, label: "News" },
          { path: "/admin/tickets", icon: MessageSquare, label: "Tickets" },
          { path: "/admin/badges", icon: Award, label: "Badges" },
          { path: "/admin/activities", icon: Bell, label: "Notams&Alerts" },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        items: [
          { path: "/admin/discord-bot", icon: Bot, label: "Discord" },
          { path: "/admin/telegram-bot", icon: Send, label: "Telegram" },
          { path: "/admin/settings", icon: Settings, label: tr("Настройки", "Settings") },
          { path: "/admin/staff", icon: ShieldCheck, label: "Staff" },
          { path: "/admin/audit-logs", icon: ClipboardList, label: tr("Аудит лог", "Audit Log") },
          { path: "/admin/auth-logs", icon: LogOut, label: tr("Журнал авторизации", "Auth Log") },
          { path: "/admin/acars", icon: Radio, label: tr("Кэш телеметрии", "Telemetry Cache") },
        ],
      },
    ],
    [t, tr],
  );

  useEffect(() => {
    setMenuSectionsOpen((current) => {
      const next = { ...current };
      menuSections.forEach((section) => {
        if (section.items.some((item) => location.pathname.startsWith(item.path) || (item.children || []).some((child) => child.path.startsWith(location.pathname)))) {
          next[section.id] = true;
        }
      });
      return next;
    });
  }, [location.pathname, menuSections]);

  useEffect(() => {
    if (location.pathname.startsWith("/admin/events")) {
      setSubmenuOpen((current) => ({ ...current, events: true }));
    }
  }, [location.pathname]);

  const displayName = useMemo(() => {
    if (!pilot) {
      return "Admin User";
    }
    return `${pilot.firstName} ${pilot.lastName}`.trim() || pilot.callsign || "Admin User";
  }, [pilot]);

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

  const handleLogout = () => {
    logout();
    navigate("/login");
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
          <NavLink
            to="/admin"
            end
            style={({ isActive }) => (isActive ? { backgroundColor: primaryColor } : undefined)}
            className={({ isActive }) =>
              `mb-2 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                isActive ? "text-white shadow-md" : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`
            }
          >
            <LayoutDashboard size={18} />
            <span>{t("admin.nav.overview")}</span>
          </NavLink>

          {menuSections.map((section) => {
            const isOpen = Boolean(menuSectionsOpen[section.id]);
            const isSectionActive = section.items.some((item) => location.pathname.startsWith(item.path));

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
                      const itemActive = location.pathname.startsWith(item.path);
                      const currentView = new URLSearchParams(location.search).get("view") || "events";

                      if (hasChildren) {
                        const isItemOpen = Boolean(submenuOpen.events);
                        return (
                          <div key={item.path} className="space-y-1">
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
                                  const childUrl = new URL(child.path, "https://admin.local");
                                  const childView = childUrl.searchParams.get("view") || "events";
                                  const isChildActive = location.pathname === "/admin/events" && currentView === childView;
                                  return (
                                    <NavLink
                                      key={child.path}
                                      to={child.path}
                                      style={isChildActive ? { backgroundColor: primaryColor } : undefined}
                                      className={`flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                                        isChildActive ? "text-white shadow-md" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                                      }`}
                                    >
                                      <Circle size={8} />
                                      <span>{child.label}</span>
                                    </NavLink>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          style={({ isActive }) => (isActive ? { backgroundColor: primaryColor } : undefined)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                              isActive ? "text-white shadow-md" : "text-gray-400 hover:bg-gray-800 hover:text-white"
                            }`
                          }
                        >
                          <item.icon size={16} />
                          <span>{item.label}</span>
                        </NavLink>
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

      <main className="ml-72 flex min-h-screen flex-1 flex-col">
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

        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
