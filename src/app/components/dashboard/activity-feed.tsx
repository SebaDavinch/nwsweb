import { useEffect, useState } from "react";
import {
  Plane,
  Camera,
  Heart,
  Images,
  Newspaper,
  CalendarDays,
  Activity as ActivityIcon,
  Loader2,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { getFlagUri, icaoToCountry } from "./flag-data";

export interface FeedItem {
  id: string;
  type: "flight" | "screenshot" | "album" | "like" | "news" | "event" | "activity";
  createdAt: string | null;
  actor: { name: string; pilotId?: number | null; username?: string | null } | null;
  title: string;
  summary: string;
  media: { url: string | null; likeCount: number } | null;
  route: { from: string; to: string } | null;
  vac: "NWS" | "KAR" | "STW" | null;
  href: string | null;
}

const TYPE_META: Record<
  FeedItem["type"],
  {
    icon: typeof Plane;
    labelRu: string;
    labelEn: string;
    iconBg: string;
    iconColor: string;
    border: string;
    bg: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  flight: {
    icon: Plane,
    labelRu: "Рейс",
    labelEn: "Flight",
    iconBg: "bg-sky-100 dark:bg-sky-500/15",
    iconColor: "text-sky-600 dark:text-sky-400",
    border: "border-sky-200/70 dark:border-sky-500/20",
    bg: "bg-sky-50/50 dark:bg-sky-500/5",
    badgeBg: "bg-sky-100 dark:bg-sky-500/15",
    badgeText: "text-sky-700 dark:text-sky-400",
  },
  screenshot: {
    icon: Camera,
    labelRu: "Скриншот",
    labelEn: "Screenshot",
    iconBg: "bg-violet-100 dark:bg-violet-500/15",
    iconColor: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200/70 dark:border-violet-500/20",
    bg: "bg-violet-50/50 dark:bg-violet-500/5",
    badgeBg: "bg-violet-100 dark:bg-violet-500/15",
    badgeText: "text-violet-700 dark:text-violet-400",
  },
  album: {
    icon: Images,
    labelRu: "Альбом",
    labelEn: "Album",
    iconBg: "bg-fuchsia-100 dark:bg-fuchsia-500/15",
    iconColor: "text-fuchsia-600 dark:text-fuchsia-400",
    border: "border-fuchsia-200/70 dark:border-fuchsia-500/20",
    bg: "bg-fuchsia-50/50 dark:bg-fuchsia-500/5",
    badgeBg: "bg-fuchsia-100 dark:bg-fuchsia-500/15",
    badgeText: "text-fuchsia-700 dark:text-fuchsia-400",
  },
  like: {
    icon: Heart,
    labelRu: "Лайк",
    labelEn: "Like",
    iconBg: "bg-rose-100 dark:bg-rose-500/15",
    iconColor: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200/70 dark:border-rose-500/20",
    bg: "bg-rose-50/50 dark:bg-rose-500/5",
    badgeBg: "bg-rose-100 dark:bg-rose-500/15",
    badgeText: "text-rose-700 dark:text-rose-400",
  },
  news: {
    icon: Newspaper,
    labelRu: "Новость",
    labelEn: "News",
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
    border: "border-amber-200/70 dark:border-amber-500/20",
    bg: "bg-amber-50/50 dark:bg-amber-500/5",
    badgeBg: "bg-amber-100 dark:bg-amber-500/15",
    badgeText: "text-amber-700 dark:text-amber-400",
  },
  event: {
    icon: CalendarDays,
    labelRu: "Событие",
    labelEn: "Event",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200/70 dark:border-emerald-500/20",
    bg: "bg-emerald-50/50 dark:bg-emerald-500/5",
    badgeBg: "bg-emerald-100 dark:bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-400",
  },
  activity: {
    icon: ActivityIcon,
    labelRu: "Активность",
    labelEn: "Activity",
    iconBg: "bg-gray-100 dark:bg-white/8",
    iconColor: "text-gray-500 dark:text-gray-400",
    border: "border-gray-200/70 dark:border-white/8",
    bg: "bg-gray-50/50 dark:bg-white/3",
    badgeBg: "bg-gray-100 dark:bg-white/8",
    badgeText: "text-gray-600 dark:text-gray-400",
  },
};

const VAC_DOT: Record<string, string> = {
  NWS: "bg-[#E31E24]",
  KAR: "bg-sky-500",
  STW: "bg-amber-400",
};

function timeAgo(iso: string | null, language: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  const ru = language === "ru";
  if (m < 1) return ru ? "только что" : "just now";
  if (m < 60) return ru ? `${m} мин назад` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return ru ? `${h} ч назад` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return ru ? `${d} дн назад` : `${d}d ago`;
  return new Date(t).toLocaleDateString(ru ? "ru-RU" : "en-US", { day: "numeric", month: "short" });
}

function Flag({ icao }: { icao?: string }) {
  const code = icaoToCountry(icao || "");
  const uri = code ? getFlagUri(code) : "";
  if (!uri) return null;
  return (
    <img
      src={uri}
      alt=""
      className="inline-block h-3 w-4.5 shrink-0 rounded-[2px] border border-black/10 object-cover"
    />
  );
}

export function useActivityFeed(limit = 30) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/feed?limit=${limit}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!active) return;
        if (Array.isArray(p?.feed)) setFeed(p.feed);
        else setError(true);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [limit]);

  return { feed, loading, error };
}

// ─── Flight card ──────────────────────────────────────────────────────────────

function FlightCard({ item, meta, language }: { item: FeedItem; meta: typeof TYPE_META["flight"]; language: string }) {
  const Icon = meta.icon;
  const actorName = item.actor?.name?.trim();

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${meta.border} ${meta.bg} hover:brightness-[0.97] dark:hover:brightness-110`}>
      {/* Icon */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
        <Icon className={`h-4 w-4 ${meta.iconColor}`} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Actor + badge + time */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <div className="flex items-center gap-1.5">
            {item.vac && (
              <span className={`h-2 w-2 shrink-0 rounded-full ${VAC_DOT[item.vac] || "bg-gray-400"}`} />
            )}
            {actorName && (
              <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">{actorName}</span>
            )}
          </div>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badgeBg} ${meta.badgeText}`}>
            {language === "ru" ? meta.labelRu : meta.labelEn}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-zinc-500">{timeAgo(item.createdAt, language)}</span>
        </div>

        {/* Flight number + route */}
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-sm font-black tracking-wide text-gray-800 dark:text-zinc-100">
            {item.title}
          </span>
          {item.route && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
              <Flag icao={item.route.from} />
              <span className="font-mono font-semibold">{item.route.from}</span>
              <ArrowRight className="h-3 w-3 shrink-0 text-gray-300 dark:text-zinc-600" />
              <Flag icao={item.route.to} />
              <span className="font-mono font-semibold">{item.route.to}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Media card (screenshot / album / like) ───────────────────────────────────

function MediaCard({ item, meta, language }: { item: FeedItem; meta: (typeof TYPE_META)[keyof typeof TYPE_META]; language: string }) {
  const Icon = meta.icon;
  const actorName = item.actor?.name?.trim();

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${meta.border} ${meta.bg} hover:brightness-[0.97] dark:hover:brightness-110`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
        <Icon className={`h-4 w-4 ${meta.iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {actorName && (
            <span className="text-sm font-bold text-gray-900 dark:text-zinc-100">{actorName}</span>
          )}
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badgeBg} ${meta.badgeText}`}>
            {language === "ru" ? meta.labelRu : meta.labelEn}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-zinc-500">{timeAgo(item.createdAt, language)}</span>
        </div>
        {item.title && (
          <p className="mt-0.5 truncate text-sm font-semibold text-gray-700 dark:text-zinc-300">{item.title}</p>
        )}
        {item.summary && (
          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-zinc-400">{item.summary}</p>
        )}
      </div>
      {item.media?.url && (
        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
          <img src={item.media.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          {(item.media.likeCount ?? 0) > 0 && (
            <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded-md bg-black/60 px-1 py-0.5 text-[9px] font-bold text-white">
              <Heart className="h-2.5 w-2.5 fill-current" />
              {item.media.likeCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── News / Event card ────────────────────────────────────────────────────────

function ContentCard({ item, meta, language }: { item: FeedItem; meta: (typeof TYPE_META)[keyof typeof TYPE_META]; language: string }) {
  const Icon = meta.icon;

  return (
    <div className={`rounded-2xl border transition-colors ${meta.border} ${meta.bg} hover:brightness-[0.97] dark:hover:brightness-110 overflow-hidden`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}>
          <Icon className={`h-4 w-4 ${meta.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badgeBg} ${meta.badgeText}`}>
              {language === "ru" ? meta.labelRu : meta.labelEn}
            </span>
            <span className="text-[11px] text-gray-400 dark:text-zinc-500">{timeAgo(item.createdAt, language)}</span>
          </div>
          <p className="mt-1 text-sm font-bold leading-snug text-gray-900 dark:text-zinc-100">{item.title}</p>
          {item.summary && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-zinc-400">{item.summary}</p>
          )}
          {item.href && (
            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-gray-400 dark:text-zinc-500">
              <MapPin className="h-3 w-3" />
              {language === "ru" ? "Подробнее" : "Read more"}
              <ArrowRight className="h-3 w-3" />
            </div>
          )}
        </div>
        {item.media?.url && (
          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/5">
            <img src={item.media.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FeedCard dispatcher ──────────────────────────────────────────────────────

function FeedCard({ item, language }: { item: FeedItem; language: string }) {
  const meta = TYPE_META[item.type] || TYPE_META.activity;

  const card =
    item.type === "flight" ? (
      <FlightCard item={item} meta={TYPE_META.flight} language={language} />
    ) : item.type === "news" || item.type === "event" ? (
      <ContentCard item={item} meta={meta} language={language} />
    ) : (
      <MediaCard item={item} meta={meta} language={language} />
    );

  if (item.href) {
    return (
      <a href={item.href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E31E24]/40 rounded-2xl">
        {card}
      </a>
    );
  }
  return card;
}

// ─── Public export ────────────────────────────────────────────────────────────

export function ActivityFeed({ limit = 30, className = "" }: { limit?: number; className?: string }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { feed, loading, error } = useActivityFeed(limit);

  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2">
        <ActivityIcon className="h-4 w-4 text-[#E31E24]" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400">
          {tr("Лента сообщества", "Community feed")}
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 py-12 text-sm text-gray-400 dark:border-white/10 dark:text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Загрузка…", "Loading…")}
        </div>
      ) : error || feed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400 dark:border-white/10 dark:text-zinc-500">
          {tr("Пока тихо. Загляните позже.", "Quiet for now. Check back later.")}
        </div>
      ) : (
        <div className="space-y-2">
          {feed.map((item) => (
            <FeedCard key={item.id} item={item} language={language} />
          ))}
        </div>
      )}
    </div>
  );
}
