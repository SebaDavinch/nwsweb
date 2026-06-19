import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { Header } from "./header";
import { Footer } from "./footer";
import { AiSearchWidget } from "./ai-search-widget";
import { isTauri } from "./desktop/use-tauri";
import { useSiteTheme } from "../hooks/use-site-theme";

export function Root() {
  const navigate = useNavigate();
  const location = useLocation();
  useSiteTheme(); // sync .dark class on <html> and keep in sync

  // В десктоп-приложении (Tauri) корень сайта не показываем — уводим в оболочку приложения.
  useEffect(() => {
    if (isTauri() && location.pathname === "/") {
      navigate("/app", { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AiSearchWidget />
    </div>
  );
}