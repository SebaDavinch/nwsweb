import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Activity,
  BookOpen,
  Calendar,
  ChevronDown,
  FileText,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  Moon,
  Newspaper,
  Plane,
  Radio,
  Search,
  Settings,
  Shield,
  Sun,
  Users,
  X,
  Info,
} from "lucide-react";
import { SiteSearch, useSiteSearch } from "./site-search";
import { useLanguage } from "../context/language-context";
import { useAuth } from "../context/auth-context";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationCenter } from "./dashboard/notification-center";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";
import { useSiteDesign } from "../hooks/use-site-design";
import { useSiteTheme } from "../hooks/use-site-theme";
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

// ── Types ─────────────────────────────────────────────────────────────────────

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
  icon: React.ElementType;
  desc?: string;
  authOnly?: boolean;
};

type HeaderNavGroup = {
  key: string;
  label: string;
  icon: React.ElementType;
  items: HeaderNavItem[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUtcTimeLabel(value?: string | null) {
  if (!value) return "--:--";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "--:--";
  return `${String(parsed.getUTCHours()).padStart(2, "0")}:${String(parsed.getUTCMinutes()).padStart(2, "0")}`;
}

function buildInitials(firstName?: string, lastName?: string) {
  return `${String(firstName || "").trim().charAt(0) || "N"}${String(lastName || "").trim().charAt(0) || "V"}`.toUpperCase();
}

function buildPilotDisplayName(firstName?: string, lastName?: string, callsign?: string) {
  const fullName = [String(firstName || "").trim(), String(lastName || "").trim()].filter(Boolean).join(" ");
  const safeCallsign = String(callsign || "NWS").trim() || "NWS";
  return fullName ? `${fullName} - ${safeCallsign}` : safeCallsign;
}

// ── Glass Nav Dropdown ────────────────────────────────────────────────────────

function NavDropdown({
  group,
  primaryColor,
  isGroupActive,
  location,
}: {
  group: HeaderNavGroup;
  primaryColor: string;
  isGroupActive: boolean;
  location: { pathname: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const GroupIcon = group.icon;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={isGroupActive ? { color: primaryColor } : undefined}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 select-none ${
          isGroupActive
            ? "bg-white/10 text-white"
            : "text-white/80 hover:bg-white/8 hover:text-white"
        }`}
      >
        <GroupIcon className="h-3.5 w-3.5 opacity-70" />
        <span>{group.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-[calc(100%+8px)] left-0 z-50 w-72 rounded-2xl border border-white/10 p-1.5 shadow-2xl shadow-black/50"
          style={{
            background: "rgba(18, 18, 22, 0.88)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
          }}
        >
          {/* Arrow */}
          <div
            className="absolute -top-[6px] left-6 h-3 w-3 rotate-45 border-l border-t border-white/10"
            style={{ background: "rgba(18, 18, 22, 0.88)" }}
          />

          {group.items.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 group ${
                  active ? "bg-white/12" : "hover:bg-white/8"
                }`}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: active ? `${primaryColor}25` : "rgba(255,255,255,0.06)",
                    border: `1px solid ${active ? primaryColor + "40" : "rgba(255,255,255,0.08)"}`,
                  }}
                >
                  <Icon
                    className="h-4 w-4 transition-colors"
                    style={{ color: active ? primaryColor : "rgba(255,255,255,0.65)" }}
                  />
                </div>
                <div className="min-w-0">
                  <div
                    className="text-sm font-medium leading-tight"
                    style={{ color: active ? primaryColor : "rgba(255,255,255,0.9)" }}
                  >
                    {item.label}
                  </div>
                  {item.desc && (
                    <div className="mt-0.5 text-[11px] text-white/40 leading-tight truncate">
                      {item.desc}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Profile Dropdown ──────────────────────────────────────────────────────────

function HeaderProfileMenu({ primaryColor }: { primaryColor: string }) {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, pilot, logout } = useAuth();
  const { t } = useLanguage();
  const [currentBooking, setCurrentBooking] = useState<HeaderBookingSummary | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !pilot) { setCurrentBooking(null); return; }
    let active = true;
    const load = async () => {
      try {
        const r = await fetch("/api/vamsys/dashboard/home", { credentials: "include" });
        if (!r.ok) throw new Error("");
        const payload = await r.json().catch(() => null);
        if (!active) return;
        const nextBooking = Array.isArray(payload?.upcomingFlights) ? payload.upcomingFlights[0] || null : null;
        setCurrentBooking(nextBooking ? {
          id: Number(nextBooking.id || 0) || 0,
          flightNumber: String(nextBooking.flightNumber || "Booking").trim() || "Booking",
          departureCode: String(nextBooking.departureCode || nextBooking.departure || "").trim() || undefined,
          arrivalCode: String(nextBooking.arrivalCode || nextBooking.arrival || "").trim() || undefined,
          departureTime: String(nextBooking.departureTime || nextBooking.scheduledTime || "").trim() || null,
        } : null);
      } catch {
        if (active) setCurrentBooking(null);
      }
    };
    void load();
    return () => { active = false; };
  }, [isAuthenticated, pilot]);

  if (!isAuthenticated || !pilot) return null;

  const displayName = buildPilotDisplayName(pilot.firstName, pilot.lastName, pilot.callsign);
  const bookingLabel = currentBooking
    ? `${currentBooking.flightNumber} ${currentBooking.departureCode || "---"} → ${currentBooking.arrivalCode || "---"} ${formatUtcTimeLabel(currentBooking.departureTime)} UTC`
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden lg:flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-left text-white transition-all hover:border-white/20 hover:bg-white/10"
        >
          <Avatar className="h-8 w-8 border border-white/10">
            {pilot.avatar ? <AvatarImage src={pilot.avatar} alt={displayName} /> : null}
            <AvatarFallback style={{ backgroundColor: primaryColor }} className="text-xs font-bold text-white">
              {buildInitials(pilot.firstName, pilot.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 hidden xl:block">
            <div className="truncate text-sm font-semibold max-w-[140px]">{displayName}</div>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-white/50 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] rounded-2xl border border-gray-200 bg-white dark:bg-gray-900/95 dark:backdrop-blur-xl dark:border-white/[0.09] p-2 shadow-2xl dark:shadow-[0_16px_48px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.07)]">
        <DropdownMenuLabel className="px-3 py-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              {pilot.avatar ? <AvatarImage src={pilot.avatar} alt={displayName} /> : null}
              <AvatarFallback style={{ backgroundColor: primaryColor }} className="font-bold text-white">
                {buildInitials(pilot.firstName, pilot.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-gray-900 dark:text-white">{displayName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Nordwind Virtual Pilot</div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="dark:bg-white/[0.08]" />
        {currentBooking && currentBooking.id > 0 ? (
          <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5 mb-1 dark:focus:bg-white/[0.06]">
            <Link to={`/dashboard/booking/${currentBooking.id}`} className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E31E24]/10">
                <Plane className="h-3.5 w-3.5 text-[#E31E24]" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t("nav.currentBooking")}</div>
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{bookingLabel}</div>
              </div>
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="dark:text-gray-200 dark:focus:bg-white/[0.06] dark:focus:text-white">
            <Link to="/dashboard" className="flex items-center gap-2.5 rounded-xl px-3 py-2">
              <LayoutDashboard className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <span>{t("nav.profileDashboard")}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="dark:text-gray-200 dark:focus:bg-white/[0.06] dark:focus:text-white">
            <Link to="/dashboard?tab=recent" className="flex items-center gap-2.5 rounded-xl px-3 py-2">
              <History className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <span>{t("nav.recentFlights")}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="dark:text-gray-200 dark:focus:bg-white/[0.06] dark:focus:text-white">
            <Link to="/dashboard?tab=settings" className="flex items-center gap-2.5 rounded-xl px-3 py-2">
              <Settings className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <span>{t("dashboard.settings")}</span>
            </Link>
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem asChild className="dark:text-gray-200 dark:focus:bg-white/[0.06] dark:focus:text-white">
              <Link to="/admin" className="flex items-center gap-2.5 rounded-xl px-3 py-2">
                <Shield className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                <span>{t("nav.adminConsole")}</span>
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="dark:bg-white/[0.08]" />
        <DropdownMenuItem
          onSelect={() => { logout(); navigate("/"); }}
          variant="destructive"
          className="rounded-xl px-3 py-2 dark:focus:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          {t("dashboard.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main Header ───────────────────────────────────────────────────────────────

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isRu = language === "ru";
  const { isAuthenticated, pilot } = useAuth();
  const design = useSiteDesign();
  const primaryColor = design.primaryColor || "#E31E24";
  const accentColor = design.accentColor || "#2A2A2A";
  const headerLogo = design.headerLogoDataUrl || logo;
  const { open: searchOpen, setOpen: setSearchOpen } = useSiteSearch();
  const { isDark, toggleAnimated: toggleTheme } = useSiteTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  const directLinks = useMemo<HeaderNavItem[]>(() => [
    { path: "/", label: t("nav.home"), icon: Home },
    { path: "/tickets", label: t("nav.contactUs"), icon: MessageSquare, authOnly: true },
  ], [t]);

  const navGroups = useMemo<HeaderNavGroup[]>(() => [
    {
      key: "company",
      label: t("nav.about"),
      icon: Info,
      items: [
        { path: "/about",      label: t("nav.project"),    icon: BookOpen,   desc: isRu ? "О нас и нашей миссии"      : "About us and our mission" },
        { path: "/team",       label: t("nav.team"),       icon: Users,      desc: isRu ? "Состав команды VA"          : "Our team members" },
        { path: "/activities", label: t("nav.activities"), icon: Calendar,   desc: isRu ? "События и мероприятия"      : "Events and activities" },
        { path: "/news",       label: t("nav.news"),       icon: Newspaper,  desc: isRu ? "Новости и анонсы"           : "News and announcements" },
        { path: "/documents",  label: t("nav.documents"),  icon: FileText,   desc: isRu ? "Правила, документы"         : "Rules and documents" },
      ],
    },
    {
      key: "operations",
      label: t("nav.operations"),
      icon: Activity,
      items: [
        { path: "/fleet",  label: t("nav.fleet"),  icon: Plane, desc: isRu ? "Воздушные суда и ливреи"  : "Aircraft and liveries" },
        { path: "/routes", label: t("nav.routes"), icon: Map,   desc: isRu ? "Маршрутная сеть"           : "Route network" },
        { path: "/live",   label: t("nav.live"),   icon: Radio, desc: isRu ? "Рейсы в реальном времени" : "Flights in real time" },
      ],
    },
  ], [t, isRu]);

  const mobileLinks = useMemo(
    () => [...directLinks, ...navGroups.flatMap((g) => g.items)]
      .filter((item, i, src) => src.findIndex((c) => c.path === item.path) === i),
    [directLinks, navGroups],
  );

  return (
    <>
      <header
        className="text-white sticky top-0 z-50 relative transition-shadow duration-300"
        style={{
          backgroundColor: accentColor,
          boxShadow: scrolled ? "0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.35)" : "none",
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between h-[68px]">
            {/* Logo */}
            <Link to="/" className="flex items-center shrink-0">
              <img src={headerLogo} alt={design.siteTitle || "Nordwind Virtual"} className="h-[48px]" />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {directLinks.filter((link) => !link.authOnly || isAuthenticated).map((link) => {
                const Icon = link.icon;
                const active = isActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    style={active ? { color: primaryColor } : undefined}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ${
                      active ? "bg-white/10" : "text-white/80 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70" />
                    {link.label}
                  </Link>
                );
              })}

              {navGroups.map((group) => {
                const visibleItems = group.items.filter((item) => !item.authOnly || isAuthenticated);
                if (visibleItems.length === 0) return null;
                const isGroupActive = visibleItems.some((item) => isActive(item.path));
                return (
                  <NavDropdown
                    key={group.key}
                    group={{ ...group, items: visibleItems }}
                    primaryColor={primaryColor}
                    isGroupActive={isGroupActive}
                    location={location}
                  />
                );
              })}
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-2.5">
              {/* Search */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="hidden lg:flex items-center gap-2 rounded-xl border border-white/12 bg-white/6 px-3 py-1.5 text-sm text-white/60 transition-all hover:border-white/22 hover:bg-white/10 hover:text-white"
                title={isRu ? "Поиск (Ctrl+K)" : "Search (Ctrl+K)"}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="text-xs">{isRu ? "Поиск" : "Search"}</span>
                <kbd className="ml-0.5 rounded border border-white/15 bg-white/8 px-1 py-0.5 text-[10px] font-mono text-white/50">⌃K</kbd>
              </button>

              {isAuthenticated ? <NotificationCenter variant="header" /> : null}
              {isAuthenticated && pilot ? <HeaderProfileMenu primaryColor={primaryColor} /> : null}

              {(!isAuthenticated || !pilot) ? (
                <Link
                  to="/login"
                  style={{ backgroundColor: primaryColor }}
                  className="hidden lg:inline-flex items-center gap-1.5 rounded-xl text-white px-5 py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  {t("nav.login")}
                </Link>
              ) : null}

              {/* Theme toggle */}
              <button
                type="button"
                onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
                className="flex items-center justify-center h-8 w-8 rounded-xl border border-white/12 bg-white/6 text-white/70 transition-all hover:border-white/22 hover:bg-white/10 hover:text-white"
                title={isDark ? (isRu ? "Светлая тема" : "Light theme") : (isRu ? "Тёмная тема" : "Dark theme")}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <LanguageSwitcher />

              {/* Mobile hamburger */}
              <button
                type="button"
                className="lg:hidden rounded-xl border border-white/10 p-2 hover:bg-white/8 transition-colors"
                onClick={() => setMobileMenuOpen((v) => !v)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        <SiteSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

        {/* Gradient fade — only on home page where hero is dark */}
        {location.pathname === "/" && (
          <div
            className="pointer-events-none absolute left-0 right-0 bottom-0 h-10 translate-y-full"
            style={{ background: `linear-gradient(to bottom, ${accentColor}, transparent)` }}
          />
        )}
      </header>

      {/* Mobile menu — glass overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="fixed top-[68px] left-0 right-0 z-40 lg:hidden border-t border-white/8 overflow-y-auto max-h-[calc(100svh-68px)]"
            style={{
              background: "rgba(18, 18, 22, 0.96)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {mobileLinks
                .filter((link) => !link.authOnly || isAuthenticated)
                .map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.path);
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                        active ? "bg-white/12" : "hover:bg-white/8"
                      }`}
                      style={active ? { color: primaryColor } : { color: "rgba(255,255,255,0.85)" }}
                    >
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
                        style={{
                          background: active ? `${primaryColor}20` : "rgba(255,255,255,0.06)",
                          border: `1px solid ${active ? primaryColor + "40" : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: active ? primaryColor : "rgba(255,255,255,0.55)" }} />
                      </div>
                      <span className="text-sm font-medium">{link.label}</span>
                    </Link>
                  );
                })}

              <div className="pt-2 border-t border-white/8 mt-2">
                {isAuthenticated && pilot ? (
                  <button
                    type="button"
                    onClick={() => { navigate("/dashboard"); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white transition-colors hover:bg-white/8"
                  >
                    <Avatar className="h-7 w-7 border border-white/10">
                      {pilot.avatar ? <AvatarImage src={pilot.avatar} alt="" /> : null}
                      <AvatarFallback style={{ backgroundColor: primaryColor }} className="text-xs font-bold text-white">
                        {buildInitials(pilot.firstName, pilot.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{buildPilotDisplayName(pilot.firstName, pilot.lastName, pilot.callsign)}</span>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ backgroundColor: primaryColor }}
                    className="flex items-center justify-center rounded-xl text-white px-5 py-2.5 text-sm font-semibold"
                  >
                    {t("nav.login")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
