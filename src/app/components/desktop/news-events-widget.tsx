import { useEffect, useMemo, useState } from "react";
import { Newspaper, CalendarDays, ArrowUpRight } from "lucide-react";
import { useLanguage } from "../../context/language-context";

interface FeedItem {
  id: number;
  title: string;
  category: "News" | "Event" | "NOTAM";
  content?: string;
  date: string;
  status?: string;
  featured?: boolean;
  imageUrl?: string | null;
  linkUrl?: string | null;
}

interface FeedPayload {
  news?: FeedItem[];
  activities?: FeedItem[];
}

function toTimestamp(value: string): number {
  const t = new Date(String(value || "")).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function loadFeed(url: string, key: "news" | "activities"): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return [];
    const payload = (await res.json().catch(() => null)) as FeedPayload | null;
    const items = key === "news" ? payload?.news : payload?.activities;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function NewsEventsWidget({ limit = 6, compact = false }: { limit?: number; compact?: boolean }) {
  const { t, language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [news, events] = await Promise.all([
        loadFeed("/api/public/news", "news"),
        loadFeed("/api/public/activities", "activities"),
      ]);
      if (!active) return;
      setItems([...news, ...events]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const feed = useMemo(() => {
    return items
      .filter((i) => (i.status ? i.status === "Published" : true))
      .filter((i) => i.category === "News" || i.category === "Event")
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return toTimestamp(b.date) - toTimestamp(a.date);
      })
      .slice(0, limit);
  }, [items, limit]);

  const fmtDate = (value: string) => {
    const ts = toTimestamp(value);
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString(language === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-white/5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <Newspaper className="h-4 w-4 text-red-500" />
          {tr("Новости и события", "News & Events")}
        </h3>
        <a
          href="/news"
          className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"
        >
          {t("home.liveFlights.viewAll") || tr("Все", "All")}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </header>

      <div className="divide-y divide-zinc-100 dark:divide-white/5">
        {loading ? (
          <div className="px-4 py-6 text-sm text-zinc-400">{t("app.loading")}</div>
        ) : feed.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-400">{tr("Пока нет публикаций", "Nothing published yet")}</div>
        ) : (
          feed.map((item) => {
            const isEvent = item.category === "Event";
            return (
              <a
                key={`${item.category}-${item.id}`}
                href={item.linkUrl || "/news"}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5"
              >
                <span
                  className={[
                    "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    isEvent ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600",
                  ].join(" ")}
                >
                  {isEvent ? <CalendarDays className="h-4 w-4" /> : <Newspaper className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        isEvent ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600",
                      ].join(" ")}
                    >
                      {isEvent ? tr("Событие", "Event") : tr("Новость", "News")}
                    </span>
                    <span className="text-xs text-zinc-400">{fmtDate(item.date)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.title}</div>
                  {!compact && item.content ? (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {item.content.replace(/<[^>]+>/g, "")}
                    </p>
                  ) : null}
                </div>
              </a>
            );
          })
        )}
      </div>
    </section>
  );
}
