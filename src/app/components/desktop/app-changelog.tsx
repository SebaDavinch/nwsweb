import { useEffect, useState } from "react";
import { Sparkles, Wrench, Zap, FileText, GitCommit, Package } from "lucide-react";
import { useLanguage } from "../../context/language-context";

interface ChangeItem {
  type: string;
  text: string;
  hash?: string;
}
interface ChangelogEntry {
  version: string;
  date: string;
  count: number;
  items: ChangeItem[];
}

const TYPE_META: Record<string, { label: [string, string]; cls: string; icon: React.ReactNode }> = {
  feature: { label: ["Новое", "Feature"], cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400", icon: <Sparkles className="h-3.5 w-3.5" /> },
  fix: { label: ["Исправление", "Fix"], cls: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400", icon: <Wrench className="h-3.5 w-3.5" /> },
  perf: { label: ["Оптимизация", "Perf"], cls: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", icon: <Zap className="h-3.5 w-3.5" /> },
  refactor: { label: ["Рефактор", "Refactor"], cls: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400", icon: <GitCommit className="h-3.5 w-3.5" /> },
  docs: { label: ["Документация", "Docs"], cls: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", icon: <FileText className="h-3.5 w-3.5" /> },
  other: { label: ["Прочее", "Other"], cls: "bg-zinc-100 text-zinc-500 dark:bg-white/5 dark:text-zinc-400", icon: <GitCommit className="h-3.5 w-3.5" /> },
};

export function AppChangelog() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/app/changelog", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (active && Array.isArray(p?.entries)) setEntries(p.entries);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const fmtDate = (v: string) => {
    const t = new Date(String(v || "")).getTime();
    return Number.isFinite(t) && t > 0 ? new Date(t).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : v;
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-2">
        <Package className="h-5 w-5 text-red-500" />
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{tr("Что нового", "Changelog")}</h1>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400">{tr("Загрузка…", "Loading…")}</div>
      ) : entries.length === 0 ? (
        <div className="text-sm text-zinc-400">{tr("История изменений пока пуста", "No changelog yet")}</div>
      ) : (
        <div className="relative space-y-6 border-l border-zinc-200 pl-6 dark:border-white/10">
          {entries.map((e) => (
            <div key={e.version} className="relative">
              <span className="absolute -left-[31px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-4 ring-white dark:ring-zinc-950" />
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{e.version}</h2>
                <span className="text-xs text-zinc-400">{fmtDate(e.date)}</span>
                <span className="text-xs text-zinc-400">· {e.count}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {e.items.map((it, i) => {
                  const meta = TYPE_META[it.type] || TYPE_META.other;
                  return (
                    <div key={`${e.version}-${i}`} className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
                      <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${meta.cls}`}>
                        {meta.icon}
                        {language === "ru" ? meta.label[0] : meta.label[1]}
                      </span>
                      <span className="text-sm text-zinc-700 dark:text-zinc-200">{it.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
