import { useEffect, useState } from "react";
import { useLanguage } from "../context/language-context";
import { useAuth } from "../context/auth-context";
import { Navigate, useLocation } from "react-router";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";
import { useSiteDesign } from "../hooks/use-site-design";

export function Login() {
  const { t } = useLanguage();
  const { isAuthenticated, isAuthLoading, loginWithPilotApi, loginWithDiscord, refreshAuth } = useAuth();
  const design = useSiteDesign();
  const primaryColor = design.primaryColor || "#E31E24";
  const accentColor = design.accentColor || "#2A2A2A";
  const loginLogo = design.loginLogoDataUrl || logo;
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = new URLSearchParams(location.search);
  const oauthReason = String(searchParams.get("reason") || "").trim();
  const pilotApiState = String(searchParams.get("pilot_api") || "").trim().toLowerCase();
  const pilotApiErrorMessage = (() => {
    if (pilotApiState !== "error") {
      return "";
    }

    switch (oauthReason) {
      case "pilot_api_not_configured":
        return "Pilot API login is not configured on the server yet.";
      case "oauth_error":
        return "Pilot API authorization was cancelled or rejected. Please try again.";
      case "oauth_state_invalid":
      case "oauth_state_expired":
        return "Pilot API authorization expired or became invalid. Please try again.";
      case "pilot_api_connect_failed":
        return "Pilot API authorization failed. Check the client activation and callback URL, then retry.";
      default:
        return "Pilot API authorization failed. Please try again.";
    }
  })();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldRefresh =
      params.get("discord") === "success" ||
      params.get("vamsys") === "success" ||
      params.get("pilot_api") === "success";

    if (!shouldRefresh) {
      return;
    }

    refreshAuth().catch(() => {
      // ignore
    });
  }, [location.search, refreshAuth]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <p className="text-gray-600">Authorizing...</p>
      </div>
    );
  }

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handlePilotApiLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithPilotApi("/dashboard");
    } catch (error) {
      console.error("Pilot API login failed:", error);
      setIsLoading(false);
    } finally {
      // noop: window location changes in OAuth flow
    }
  };

  const handleDiscordLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithDiscord();
    } catch (error) {
      console.error("Discord login failed:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(227,30,36,0.08),transparent_28%),linear-gradient(135deg,#f8fafc_0%,#eef2f7_45%,#f7f7f7_100%)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6 rounded-[28px] border border-white/70 bg-[#1f232d] px-8 py-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <img src={loginLogo} alt={design.siteTitle || "Nordwind Virtual"} className="h-24 w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.28)]" />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: accentColor }}>{design.siteTitle || "Pilot Login"}</h2>
          <p className="text-gray-600">{t("login.subtitle")}</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-white/80 bg-white/95 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <h2 className="text-2xl text-[#2A2A2A] mb-6 text-center">
            {t("login.title")}
          </h2>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            {/* Pilot API Login Button */}
            <button
              type="button"
              style={{ borderColor: primaryColor, color: primaryColor }}
              className="w-full rounded-xl border-2 bg-white py-3 text-base font-medium transition-all hover:-translate-y-0.5 hover:bg-[color:var(--login-primary-hover)] hover:text-white flex items-center justify-center gap-2"
              onClick={handlePilotApiLogin}
              disabled={isLoading}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = primaryColor;
                event.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = "#ffffff";
                event.currentTarget.style.color = primaryColor;
              }}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
              </svg>
              <span>Login with vAMSYS Pilot API</span>
            </button>

            {/* Discord Login Button */}
            <button
              type="button"
              style={{ borderColor: primaryColor, color: primaryColor }}
              className="w-full rounded-xl border-2 bg-white py-3 text-base font-medium transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              onClick={handleDiscordLogin}
              disabled={isLoading}
              onMouseEnter={(event) => {
                event.currentTarget.style.backgroundColor = primaryColor;
                event.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = "#ffffff";
                event.currentTarget.style.color = primaryColor;
              }}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Login with Discord</span>
            </button>

            {oauthReason === "discord_not_linked" && (
              <p className="text-xs text-red-600 text-center">
                Discord login is available only after linking it in your pilot settings.
              </p>
            )}

            {pilotApiErrorMessage && (
              <p className="text-xs text-red-600 text-center">
                {pilotApiErrorMessage}
              </p>
            )}

            <p className="text-xs text-center text-gray-600 pt-1">
              Еще не зарегистрированы в ВАК?{" "}
              <a
                href="https://vamsys.io/register/nws"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#E31E24] hover:underline"
              >
                Зарегистрироваться
              </a>
            </p>
          </div>

        </div>

        {/* Info Note */}
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/90 p-4 shadow-sm">
          <p className="text-sm text-blue-800 text-center">
            {t("login.note")}
          </p>
        </div>
      </div>
    </div>
  );
}