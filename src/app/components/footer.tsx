import { MessageSquare, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { useLanguage } from "../context/language-context";
import { Button } from "./ui/button";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";
import vatsimLogo from "@/assets/vatsim-logo.svg";
import ragLogo from "@/app/components/admin/banner-generator/assets/rag-logo.svg";
import { useSiteDesign } from "../hooks/use-site-design";

export function Footer() {
  const { t } = useLanguage();
  const design = useSiteDesign();
  const primaryColor = design.primaryColor || "#E31E24";
  const accentColor = design.accentColor || "#2A2A2A";
  const footerLogo = design.footerLogoDataUrl || logo;
  const myNextAirlineLogoUrl = "https://mynextairline.com/images/logo-light.png";

  return (
    <footer className="text-white mt-auto" style={{ backgroundColor: accentColor }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <div className="mb-4">
              <img src={footerLogo} alt={design.siteTitle || "Nordwind Virtual"} className="h-12 mb-3" />
            </div>
            <p className="text-gray-300 text-sm">
              {t("footer.about.text")}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg mb-4" style={{ color: primaryColor }}>{t("footer.links.title")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/about"
                  className="text-gray-300 hover:text-[#E31E24] transition-colors"
                >
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link
                  to="/fleet"
                  className="text-gray-300 hover:text-[#E31E24] transition-colors"
                >
                  {t("nav.fleet")}
                </Link>
              </li>
              <li>
                <Link
                  to="/routes"
                  className="text-gray-300 hover:text-[#E31E24] transition-colors"
                >
                  {t("nav.routes")}
                </Link>
              </li>
              <li>
                <Link
                  to="/join"
                  className="text-gray-300 hover:text-[#E31E24] transition-colors"
                >
                  {t("nav.join")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg mb-4" style={{ color: primaryColor }}>{t("footer.contact.title")}</h3>
            <div className="space-y-3 text-sm">
              <a
                href="https://discord.gg/MfTT8KU5yC"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-100 transition-colors hover:bg-white/10"
              >
                <ExternalLink size={16} />
                <span>Discord</span>
              </a>
              <div>
                <Button asChild className="bg-[#E31E24] text-white hover:bg-[#c41a20]">
                  <Link to="/tickets">
                    <MessageSquare className="mr-2" size={16} />
                    {t("nav.tickets")}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Partner logos */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
            <a
              href="https://vatsim.net/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="VATSIM"
              className="group flex min-h-[138px] flex-col items-start justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {t("footer.partners.official")}
              </div>
              <img
                src={vatsimLogo}
                alt="VATSIM"
                className="h-auto max-h-[64px] w-full max-w-[260px] object-contain"
                loading="lazy"
              />
              <div className="text-[10px] font-semibold uppercase tracking-[0.26em] text-cyan-300/80">
                Aviate Educate Communicate
              </div>
            </a>

            <a
              href="https://vamsys.io/register/rag"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Russian Airways Group"
              className="group flex min-h-[138px] flex-col items-start justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {t("footer.partners.otherProject")}
              </div>
              <img
                src={ragLogo}
                alt="Russian Airways Group"
                className="h-auto max-h-[52px] w-full max-w-[250px] object-contain"
                loading="lazy"
              />
              <div className="text-sm text-gray-300">
                {t("footer.partners.ragName")}
              </div>
            </a>

            <a
              href="https://mynextairline.com/airlines/nordwind-airlines-virtual"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="MyNextAirline"
              className="group flex min-h-[138px] flex-col items-start justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {t("footer.partners.voteForUs")}
              </div>
              <img
                src={myNextAirlineLogoUrl}
                alt="MyNextAirline"
                className="h-auto max-h-[42px] w-full max-w-[250px] object-contain"
                loading="lazy"
              />
              <div className="text-sm text-gray-300">My Next Airline</div>
            </a>
          </div>
        </div>

        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>{t("footer.copyright")}</p>
          <p className="mt-2">
            {t("footer.disclaimer")}
          </p>
        </div>
      </div>
    </footer>
  );
}