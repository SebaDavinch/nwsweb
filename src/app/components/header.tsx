import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ChevronDown, ChevronUp, History, LayoutDashboard, LogOut, Menu, Plane, Settings, Shield, X } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { useAuth } from "../context/auth-context";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationCenter } from "./dashboard/notification-center";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";
import { useSiteDesign } from "../hooks/use-site-design";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface HeaderBookingSummary {
  id: number;
  flightNumber: string;
  departureCode?: string;
  arrivalCode?: string;
  departureTime?: string | null;
}

type HeaderNavItem = {
  path: string;
  label: string;
  authOnly?: boolean;
};

type HeaderNavGroup = {
  key: string;
  label: string;
  items: HeaderNavItem[];
};

function formatUtcTimeLabel(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }

  return `${String(parsed.getUTCHours()).padStart(2, "0")}:${String(parsed.getUTCMinutes()).padStart(2, "0")}`;
}

function buildInitials(firstName?: string, lastName?: string) {
  return `${String(firstName || "").trim().charAt(0) || "N"}${String(lastName || "").trim().charAt(0) || "V"}`.toUpperCase();
}

function HeaderProfileMenu({ primaryColor }: { primaryColor: string }) {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, pilot, logout } = useAuth();
  const { t } = useLanguage();
  const [currentBooking, setCurrentBooking] = useState<HeaderBookingSummary | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !pilot) {
      setCurrentBooking(null);
      return;
    }

    let active = true;
    const loadDashboardHome = async () => {
      try {
        const response = await fetch("/api/vamsys/dashboard/home", { credentials: "include" });
        if (!response.ok) {
          throw new Error("Failed to load dashboard home");
        }

        const payload = await response.json().catch(() => null);
        if (!active) {
          return;
        }

        const nextBooking = Array.isArray(payload?.upcomingFlights) ? payload.upcomingFlights[0] || null : null;
        setCurrentBooking(
          nextBooking
            ? {
                id: Number(nextBooking.id || 0) || 0,
                flightNumber: String(nextBooking.flightNumber || "Booking").trim() || "Booking",
                departureCode: String(nextBooking.departureCode || nextBooking.departure || "").trim() || undefined,
                arrivalCode: String(nextBooking.arrivalCode || nextBooking.arrival || "").trim() || undefined,
                departureTime: String(nextBooking.departureTime || nextBooking.scheduledTime || "").trim() || null,
              }
            : null,
        );
      } catch {
        if (active) {
          setCurrentBooking(null);
        }
      }
    };

    void loadDashboardHome();

    return () => {
      active = false;
    };
  }, [isAuthenticated, pilot]);

  if (!isAuthenticated || !pilot) {
    return null;
  }

  const displayName = `${pilot.firstName || "Pilot"} - ${pilot.callsign || "NWS"}`;
  const bookingLabel = currentBooking
    ? `${currentBooking.flightNumber} ${currentBooking.departureCode || "---"} - ${currentBooking.arrivalCode || "---"} ETD: ${formatUtcTimeLabel(currentBooking.departureTime)} UTC`
    : null;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden lg:flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-left text-white transition hover:border-white/20 hover:bg-white/10"
        >
          <Avatar className="h-10 w-10 border border-white/10">
            {pilot.avatar ? <AvatarImage src={pilot.avatar} alt={displayName} /> : null}
            <AvatarFallback style={{ backgroundColor: primaryColor }} className="text-sm font-bold text-white">
              {buildInitials(pilot.firstName, pilot.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{displayName}</div>
            <div className="truncate text-xs text-white/55">{pilot.rank || "Pilot"}</div>
          </div>
          <ChevronDown className="h-4 w-4 text-white/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] rounded-2xl border border-gray-200 p-2">
        <DropdownMenuLabel className="px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {pilot.avatar ? <AvatarImage src={pilot.avatar} alt={displayName} /> : null}
              <AvatarFallback style={{ backgroundColor: primaryColor }} className="font-bold text-white">
                {buildInitials(pilot.firstName, pilot.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">{displayName}</div>
              <div className="truncate text-xs text-gray-500">{pilot.email || pilot.rank || "Pilot"}</div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {currentBooking && currentBooking.id > 0 ? (
          <DropdownMenuItem asChild className="rounded-xl px-3 py-3">
            <Link to={`/dashboard/booking/${currentBooking.id}`} className="flex flex-col items-start gap-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{t("nav.currentBooking")}</div>
              <div className="text-sm font-medium text-gray-900">{bookingLabel}</div>
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              {t("nav.profileDashboard")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard?tab=recent" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("nav.recentFlights")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard?tab=settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t("dashboard.settings")}
            </Link>
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem asChild>
              <Link to="/admin" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {t("nav.adminConsole")}
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout} variant="destructive">
          <LogOut className="h-4 w-4" />
          {t("dashboard.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isRu = language === "ru";
  const { isAuthenticated, pilot } = useAuth();
  const design = useSiteDesign();
  const primaryColor = design.primaryColor || "#E31E24";
  const accentColor = design.accentColor || "#2A2A2A";
  const headerLogo = design.headerLogoDataUrl || logo;

  const isActive = (path: string) => {
    if (path === "/activities") {
      return location.pathname === "/activities";
    }

    return location.pathname === path;
  };

  const directLinks = useMemo<HeaderNavItem[]>(
    () => [
      { path: "/", label: t("nav.home") },
    ],
    [t],
  );

  const navGroups = useMemo<HeaderNavGroup[]>(
    () => [
      {
        key: "company",
        label: "VA",
        items: [
          { path: "/about", label: t("nav.about") },
          { path: "/team", label: isRu ? "Команда" : "Team" },
          { path: "/activities", label: t("nav.activities") },
          { path: "/news", label: t("nav.news") },
          { path: "/documents", label: t("nav.documents") },
        ],
      },
      {
        key: "operations",
        label: "Operations",
        items: [
          { path: "/fleet", label: t("nav.fleet") },
          { path: "/routes", label: t("nav.routes") },
          { path: "/live", label: "Live Flights" },
          { path: "/gates", label: isRu ? "Стоянки" : "Gate Assigner" },
        ],
      },
      {
        key: "support",
        label: "Support",
        items: [
          { path: "/tickets", label: t("nav.tickets"), authOnly: true },
        ],
      },
    ],
    [t, isRu],
  );

  const mobileLinks = useMemo(
    () => [
      ...directLinks,
      ...navGroups.flatMap((group) => group.items),
    ].filter((item, index, source) => source.findIndex((candidate) => candidate.path === item.path) === index),
    [directLinks, navGroups],
  );

  const navigateToDashboard = () => {
    navigate("/dashboard");
    setMobileMenuOpen(false);
  };

  return (
    <header className="text-white sticky top-0 z-50" style={{ backgroundColor: accentColor }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center">
            <img src={headerLogo} alt={design.siteTitle || "Nordwind Virtual"} className="h-[53px]" />
          </Link>

          <nav className="hidden lg:flex items-center gap-2">
            {directLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                style={isActive(link.path) ? { color: primaryColor } : undefined}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isActive(link.path) ? "bg-white/8" : "text-white hover:bg-white/6 hover:text-white"}`}
              >
                {link.label}
              </Link>
            ))}
            {navGroups.map((group) => {
              const visibleItems = group.items.filter((item) => !item.authOnly || isAuthenticated);
              if (visibleItems.length === 0) {
                return null;
              }

              const isGroupActive = visibleItems.some((item) => isActive(item.path));
              const isGroupOpen = openGroupKey === group.key;

              return (
                <DropdownMenu key={group.key} onOpenChange={(open) => setOpenGroupKey(open ? group.key : null)}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      style={isGroupActive ? { color: primaryColor } : undefined}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${isGroupActive ? "bg-white/8" : "text-white hover:bg-white/6 hover:text-white"}`}
                    >
                      <span>{group.label}</span>
                      {isGroupOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[220px] rounded-2xl border border-gray-200 p-2">
                    <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {visibleItems.map((item) => (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link to={item.path}>{item.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? <NotificationCenter variant="header" /> : null}
            {isAuthenticated && pilot ? <HeaderProfileMenu primaryColor={primaryColor} /> : null}
            {!isAuthenticated || !pilot ? (
              <Link
                to="/login"
                style={{ backgroundColor: primaryColor }}
                className="hidden lg:block bg-[#E31E24] text-white px-6 py-2 rounded hover:bg-[#c41a20] transition-colors"
              >
                {t("nav.login")}
              </Link>
            ) : null}
            <LanguageSwitcher />
            <button
              className="lg:hidden rounded-xl border border-white/10 p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="lg:hidden pb-4 space-y-2">
            {mobileLinks
              .filter((link) => !link.authOnly || isAuthenticated)
              .map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                style={isActive(link.path) ? { color: primaryColor } : undefined}
                className={`block rounded-xl px-3 py-2 transition-colors ${isActive(link.path) ? "bg-white/8" : "text-white hover:bg-white/6 hover:text-white"}`}
              >
                {link.label}
              </Link>
            ))}
            
            {isAuthenticated && pilot ? (
              <Button type="button" onClick={navigateToDashboard} className="mt-2 w-full justify-start" style={{ backgroundColor: primaryColor }}>
                <Plane className="mr-2 h-4 w-4" />
                {pilot.firstName} - {pilot.callsign}
              </Button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                style={{ backgroundColor: primaryColor }}
                className="block mt-2 bg-[#E31E24] text-white px-6 py-2 rounded hover:bg-[#c41a20] transition-colors text-center"
              >
                {t("nav.login")}
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}