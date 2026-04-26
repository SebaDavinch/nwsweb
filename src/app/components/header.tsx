import { Link, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "../context/language-context";
import { useAuth } from "../context/auth-context";
import { LanguageSwitcher } from "./language-switcher";
import { TicketBell } from "./ticket-bell";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";
import { useSiteDesign } from "../hooks/use-site-design";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { t } = useLanguage();
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

  const navLinks = [
    { path: "/", label: t("nav.home") },
    { path: "/about", label: t("nav.about") },
    { path: "/activities", label: t("nav.activities") },
    { path: "/news", label: t("nav.news") },
    { path: "/fleet", label: t("nav.fleet") },
    { path: "/routes", label: t("nav.routes") },
    { path: "/documents", label: t("nav.documents") },
    { path: "/tickets", label: t("nav.tickets") },
    { path: "/join", label: t("nav.join") },
  ];

  return (
    <header className="text-white sticky top-0 z-50" style={{ backgroundColor: accentColor }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo/Brand */}
          <Link to="/" className="flex items-center">
            <img src={headerLogo} alt={design.siteTitle || "Nordwind Virtual"} className="h-[53px]" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-4">
            {navLinks
              .filter((link) => link.path !== "/tickets" || isAuthenticated)
              .filter((link) => link.path !== "/join")
              .map((link) => (
              <Link
                key={link.path}
                to={link.path}
                style={isActive(link.path) ? { color: primaryColor } : undefined}
                className={`transition-colors text-sm font-medium ${
                  isActive(link.path)
                    ? ""
                    : "text-white hover:text-[#E31E24]"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Language Switcher & Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? <TicketBell /> : null}
            {isAuthenticated && pilot ? (
              <Link
                to="/dashboard"
                style={{ backgroundColor: primaryColor }}
                className="hidden lg:flex items-center gap-2 bg-[#E31E24] text-white px-4 py-2 rounded hover:bg-[#c41a20] transition-colors"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
                  {pilot.firstName[0]}
                  {pilot.lastName[0]}
                </div>
                <span>{pilot.callsign}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                style={{ backgroundColor: primaryColor }}
                className="hidden lg:block bg-[#E31E24] text-white px-6 py-2 rounded hover:bg-[#c41a20] transition-colors"
              >
                {t("nav.login")}
              </Link>
            )}
            <LanguageSwitcher />
            <button
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="lg:hidden pb-4">
            {navLinks
              .filter((link) => link.path !== "/tickets" || isAuthenticated)
              .map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                style={isActive(link.path) ? { color: primaryColor } : undefined}
                className={`block py-2 transition-colors ${
                  isActive(link.path)
                    ? ""
                    : "text-white hover:text-[#E31E24]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            
            {isAuthenticated && pilot ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                style={{ backgroundColor: primaryColor }}
                className="flex items-center gap-2 mt-2 bg-[#E31E24] text-white px-4 py-2 rounded hover:bg-[#c41a20] transition-colors"
              >
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
                  {pilot.firstName[0]}
                  {pilot.lastName[0]}
                </div>
                <span>{pilot.callsign}</span>
              </Link>
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