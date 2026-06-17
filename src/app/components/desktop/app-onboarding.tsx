import { Languages, Sun, Moon, ArrowRight } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAppTheme } from "./use-app-theme";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";

export const ONBOARDED_KEY = "nws.app.onboarded";

export function isOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true;
  }
}

function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
              active
                ? "border-red-500 bg-red-500/10 text-red-500 dark:text-red-300"
                : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5",
            ].join(" ")}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function AppOnboarding({ onDone }: { onDone: () => void }) {
  const { language, setLanguage } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { theme, setTheme } = useAppTheme();

  const finish = () => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* ignore */
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/70 p-6 backdrop-blur">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-2xl dark:border-white/10 dark:bg-zinc-900">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logo} alt="Nordwind" className="mb-3 h-14 w-auto object-contain" />
          <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            {tr("Добро пожаловать", "Welcome")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {tr("Выберите язык и тему — позже это можно изменить в настройках.", "Pick your language and theme — you can change this later in settings.")}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {tr("Язык", "Language")}
            </div>
            <Choice
              value={language}
              onChange={(v) => setLanguage(v)}
              options={[
                { value: "ru", label: "Русский", icon: <Languages className="h-4 w-4" /> },
                { value: "en", label: "English", icon: <Languages className="h-4 w-4" /> },
              ]}
            />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {tr("Тема", "Theme")}
            </div>
            <Choice
              value={theme}
              onChange={(v) => setTheme(v)}
              options={[
                { value: "light", label: tr("Светлая", "Light"), icon: <Sun className="h-4 w-4" /> },
                { value: "dark", label: tr("Тёмная", "Dark"), icon: <Moon className="h-4 w-4" /> },
              ]}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={finish}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-400"
        >
          {tr("Продолжить", "Continue")}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
