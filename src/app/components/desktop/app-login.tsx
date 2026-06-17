import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";
import { externalLinkProps, openExternal } from "./open-external";
import { isTauri } from "./use-tauri";
import { getApiBaseUrl } from "../../api-base";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";

function DiscordIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

/**
 * Экран входа десктоп-приложения. Тёмная тема под оболочку.
 * Использует те же OAuth-флоу, что и веб (vAMSYS Pilot API + Discord), returnTo → /app.
 */
export function AppLogin() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { loginWithPilotApi, loginWithDiscord } = useAuth();
  const [busy, setBusy] = useState<"vamsys" | "discord" | null>(null);

  const handleVamsys = async () => {
    setBusy("vamsys");
    try {
      if (isTauri()) {
        // В упакованном .exe OAuth идёт в системном браузере, возврат — через deep-link nordwind://auth.
        await openExternal(`${getApiBaseUrl()}/api/auth/pilot-api/connect?intent=login&app=1`);
        // оставляем busy — окно ждёт deep-link; сбросим, если пользователь вернётся без входа
        window.setTimeout(() => setBusy(null), 4000);
      } else {
        await loginWithPilotApi("/app");
      }
    } catch {
      setBusy(null);
    }
  };

  const handleDiscord = async () => {
    setBusy("discord");
    try {
      if (isTauri()) {
        await openExternal(`${getApiBaseUrl()}/api/auth/discord/login?intent=login&app=1`);
        window.setTimeout(() => setBusy(null), 4000);
      } else {
        await loginWithDiscord("/app");
      }
    } catch {
      setBusy(null);
    }
  };

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-zinc-50 px-6 dark:bg-zinc-950">
      {/* Фоновое свечение */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-red-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-red-900/30 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(239,68,68,0.12),transparent_45%)]" />

      <div className="relative w-full max-w-sm">
        {/* Бренд */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4 flex items-center justify-center rounded-3xl border border-zinc-200 bg-white px-7 py-5 shadow-xl dark:border-white/10 dark:bg-zinc-900/80 dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
            <img
              src={logo}
              alt="Nordwind Virtual"
              className="h-16 w-auto object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.25)]"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">NordwindHub</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {tr("Вход в приложение пилота", "Sign in to the pilot app")}
          </p>
        </div>

        {/* Карточка */}
        <div className="rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur dark:border-white/10 dark:bg-zinc-900/70 dark:shadow-2xl">
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleVamsys}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition-all hover:from-red-400 hover:to-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "vamsys" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
              {tr("Войти через vAMSYS", "Sign in with vAMSYS")}
            </button>

            <button
              type="button"
              onClick={handleDiscord}
              disabled={busy !== null}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-[#5865F2]/90 py-3 text-sm font-semibold text-white transition-all hover:bg-[#5865F2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "discord" ? <Loader2 className="h-5 w-5 animate-spin" /> : <DiscordIcon />}
              {tr("Войти через Discord", "Sign in with Discord")}
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
            {tr("или", "or")}
            <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
          </div>

          <p className="text-center text-xs text-zinc-500">
            {tr("Ещё не в составе ВАК?", "Not a member yet?")}{" "}
            <a
              {...externalLinkProps("https://vamsys.io/register/nws")}
              className="font-semibold text-red-400 hover:text-red-300"
            >
              {tr("Зарегистрироваться", "Register")}
            </a>
          </p>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-600">
          {tr(
            "Вход использует вашу учётную запись vAMSYS. Данные не передаются третьим лицам.",
            "Sign-in uses your vAMSYS account. Your data is never shared with third parties."
          )}
        </p>
      </div>
    </div>
  );
}
