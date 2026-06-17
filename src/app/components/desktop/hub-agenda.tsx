import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Newspaper,
  CalendarDays,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";

interface FeedItem {
  id: number | string;
  title: string;
  category?: string;
  content?: string;
  summary?: string;
  date: string;
  status?: string;
  featured?: boolean;
  imageUrl?: string | null;
  linkUrl?: string | null;
}

interface NotamItem {
  id: number | string;
  title: string;
  content?: string;
  type?: "info" | "warning" | "critical";
  priority?: "low" | "medium" | "high";
  mustRead?: boolean;
}

const ts = (v: string) => {
  const t = new Date(String(v || "")).getTime();
  return Number.isFinite(t) ? t : 0;
};

const strip = (s?: string) => String(s || "").replace(/<[^>]+>/g, "").trim();

export function HubAgenda({ onOpenNotams }: { onOpenNotams?: () => void }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";

  const [news, setNews] = useState<FeedItem[]>([]);
  const [events, setEvents] = useState<FeedItem[]>([]);
  const [notams, setNotams] = useState<NotamItem[]>([]);

  useEffect(() => {
    let active = true;
    const get = async (url: string, key: string) => {
      try {
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) return [];
        const p = await r.json().catch(() => null);
        return Array.isArray(p?.[key]) ? p[key] : [];
      } catch {
        return [];
      }
    };
    void (async () => {
      const [n, a, nt] = await Promise.all([
        get("/api/public/news", "news"),
        get("/api/public/activities", "activities"),
        get("/api/vamsys/notams", "notams"),
      ]);
      if (!active) return;
      setNews(
        (n as FeedItem[])
          .filter((i) => (i.status ? i.status === "Published" : true))
          .sort((x, y) => (x.featured !== y.featured ? (x.featured ? -1 : 1) : ts(y.date) - ts(x.date)))
          .slice(0, 4)
      );
      setEvents(
        (a as FeedItem[])
          .filter((i) => (i.status ? i.status === "Published" : true))
          .sort((x, y) => (x.featured !== y.featured ? (x.featured ? -1 : 1) : ts(y.date) - ts(x.date)))
          .slice(0, 6)
      );
      setNotams(
        (nt as NotamItem[])
          .slice()
          .sort((x, y) => Number(Boolean(y.mustRead)) - Number(Boolean(x.mustRead)))
          .slice(0, 4)
      );
    })();
    return () => {
      active = false;
    };
  }, []);

  const fmtDate = (v: string) =>
    ts(v) ? new Date(ts(v)).toLocaleDateString(locale, { day: "numeric", month: "short" }) : "—";

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-white">
          <CalendarClock className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            {tr("Сегодня на повестке дня", "On today's agenda")}
          </h2>
          <p className="text-xs text-zinc-400">{tr("События, новости и NOTAM", "Events, news and NOTAM")}</p>
        </div>
      </div>

      {/* Карусель событий */}
      <EventsCarousel events={events} fmtDate={fmtDate} tr={tr} />

      {/* Новости + NOTAM */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Новости */}
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-white/5 dark:bg-zinc-900">
          <header className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2.5 dark:border-white/5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <Newspaper className="h-4 w-4 text-red-500" />
              {tr("Новости", "News")}
            </h3>
            <a href="/news" className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600">
              {tr("Все", "All")}
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </header>
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {news.length === 0 ? (
              <div className="px-3.5 py-5 text-sm text-zinc-400">{tr("Нет новостей", "No news")}</div>
            ) : (
              news.map((n) => (
                <a
                  key={`news-${n.id}`}
                  href={n.linkUrl || "/news"}
                  className="block px-3.5 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className="rounded bg-red-50 px-1.5 py-0.5 font-semibold uppercase text-red-600 dark:bg-red-500/15 dark:text-red-400">
                      {tr("Новость", "News")}
                    </span>
                    {fmtDate(n.date)}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{n.title}</div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* NOTAM */}
        <div className="rounded-2xl border border-zinc-100 bg-white dark:border-white/5 dark:bg-zinc-900">
          <header className="flex items-center justify-between border-b border-zinc-100 px-3.5 py-2.5 dark:border-white/5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              NOTAM
            </h3>
            {onOpenNotams ? (
              <button
                type="button"
                onClick={onOpenNotams}
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
              >
                {tr("Все", "All")}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            ) : null}
          </header>
          <div className="divide-y divide-zinc-100 dark:divide-white/5">
            {notams.length === 0 ? (
              <div className="px-3.5 py-5 text-sm text-zinc-400">{tr("Активных NOTAM нет", "No active NOTAM")}</div>
            ) : (
              notams.map((n) => {
                const crit = n.type === "critical" || n.priority === "high" || n.mustRead;
                return (
                  <div key={`notam-${n.id}`} className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${crit ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{n.title}</span>
                      {n.mustRead ? (
                        <span className="ml-auto shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600 dark:bg-red-500/15 dark:text-red-400">
                          {tr("важно", "must read")}
                        </span>
                      ) : null}
                    </div>
                    {n.content ? (
                      <p className="mt-0.5 line-clamp-1 pl-3.5 text-xs text-zinc-500 dark:text-zinc-400">{strip(n.content)}</p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function EventsCarousel({
  events,
  fmtDate,
  tr,
}: {
  events: FeedItem[];
  fmtDate: (v: string) => string;
  tr: (ru: string, en: string) => string;
}) {
  const [idx, setIdx] = useState(0);
  const hovering = useRef(false);

  const count = events.length;
  const safeIdx = count ? idx % count : 0;

  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => {
      if (!hovering.current) setIdx((i) => (i + 1) % count);
    }, 6000);
    return () => window.clearInterval(id);
  }, [count]);

  const go = (dir: number) => setIdx((i) => (i + dir + count) % count);

  if (count === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-200 text-sm text-zinc-400 dark:border-white/10">
        {tr("Запланированных событий нет", "No upcoming events")}
      </div>
    );
  }

  const ev = events[safeIdx];
  const desc = strip(ev.summary || ev.content);

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      onMouseEnter={() => (hovering.current = true)}
      onMouseLeave={() => (hovering.current = false)}
    >
      <a
        href={ev.linkUrl || "/news"}
        className="relative block h-44 sm:h-52"
        style={
          ev.imageUrl
            ? { backgroundImage: `url("${ev.imageUrl}")`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {/* Заливка, если нет картинки */}
        {!ev.imageUrl ? <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-red-950" /> : null}
        {/* Затемнение для читаемости */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <CalendarDays className="h-3 w-3" />
              {tr("Событие", "Event")}
            </span>
            <span className="text-xs font-medium text-white/80">{fmtDate(ev.date)}</span>
          </div>
          <h3 className="line-clamp-1 text-lg font-black tracking-tight text-white drop-shadow">{ev.title}</h3>
          {desc ? <p className="mt-0.5 line-clamp-2 max-w-xl text-xs text-white/70">{desc}</p> : null}
        </div>
      </a>

      {/* Навигация */}
      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            aria-label="prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            aria-label="next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 right-3 flex gap-1.5">
            {events.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === safeIdx ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
                aria-label={`event ${i + 1}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
