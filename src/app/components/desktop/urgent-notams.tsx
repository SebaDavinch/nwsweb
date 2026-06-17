import { useEffect, useState } from "react";
import { ShieldAlert, X, ChevronRight } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";

interface NotamItem {
  id: number | string;
  title: string;
  content?: string;
  type?: "info" | "warning" | "critical";
  priority?: "low" | "medium" | "high";
  mustRead?: boolean;
}

const DISMISS_KEY = "nws.notams.dismissed";

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DISMISS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function dismiss(id: string) {
  try {
    const s = getDismissed();
    s.add(id);
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(s).slice(-200)));
  } catch {
    /* ignore */
  }
}

/**
 * Pegasus-style баннер срочных NOTAM вверху приложения.
 * Показывает must-read / critical / high-priority, можно скрыть.
 */
export function UrgentNotamsBanner({ onOpen }: { onOpen: () => void }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<NotamItem[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(getDismissed);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/vamsys/notams", { credentials: "include" });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => null)) as { notams?: NotamItem[] } | null;
        if (!active || !Array.isArray(payload?.notams)) return;
        const urgent = payload!.notams!.filter(
          (n) => n.mustRead || n.type === "critical" || n.priority === "high"
        );
        setItems(urgent);
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(load, 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [isAuthenticated]);

  const visible = items.filter((n) => !hidden.has(String(n.id)));
  if (visible.length === 0) return null;
  const top = visible[0];
  const critical = top.type === "critical";

  return (
    <div
      className={`flex items-center gap-3 border-b px-4 py-2 text-sm ${
        critical
          ? "border-red-600/30 bg-red-600 text-white"
          : "border-amber-500/30 bg-amber-500 text-white"
      }`}
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{tr("NOTAM", "NOTAM")}: </span>
        <span className="truncate">{top.title}</span>
        {visible.length > 1 ? (
          <span className="ml-2 rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] font-bold">+{visible.length - 1}</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30"
      >
        {tr("Открыть", "Open")}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          dismiss(String(top.id));
          setHidden((s) => new Set(s).add(String(top.id)));
        }}
        className="shrink-0 rounded p-1 hover:bg-white/20"
        title={tr("Скрыть", "Dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
