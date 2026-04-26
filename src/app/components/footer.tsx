import { Plane, Mail, Users, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { useLanguage } from "../context/language-context";
import { Button } from "./ui/button";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";
import { useSiteDesign } from "../hooks/use-site-design";

export function Footer() {
  const { t } = useLanguage();
  const design = useSiteDesign();
  const primaryColor = design.primaryColor || "#E31E24";
  const accentColor = design.accentColor || "#2A2A2A";
  const footerLogo = design.footerLogoDataUrl || logo;

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
              <div className="flex items-center space-x-2 text-gray-300">
                <Plane size={16} />
                <span>vamsys.io</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Users size={16} />
                <span>Discord</span>
              </div>
              <div className="flex items-center space-x-2 text-gray-300">
                <Mail size={16} />
                <span>support@nordwindvirtual.com</span>
              </div>
            </div>
          </div>
        </div>

        {/* Other Projects Section */}
        <div className="border-t border-gray-700 mt-8 pt-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <p className="text-gray-400 text-sm">{t("footer.otherProjects")}</p>
            <a
              href="https://vamsys.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button
                variant="outline"
                style={{ borderColor: primaryColor, color: primaryColor }}
                className="bg-transparent border-[#E31E24] text-[#E31E24] hover:bg-[#E31E24] hover:text-white transition-colors"
              >
                Russian Airways Group
                <ExternalLink className="ml-2" size={16} />
              </Button>
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