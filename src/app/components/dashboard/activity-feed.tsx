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
  { icon: typeof Plane; accent: string; labelRu: string; labelEn: string }
> = {
  flight: { icon: Plane, accent: "text-sky-500", labelRu: "Рейс", labelEn: "Flight" },
  screenshot: { icon: Camera, accent: "text-violet-500", labelRu: "Скриншот", labelEn: "Screenshot" },
  album: { icon: Images, accent: "text-fuchsia-500", labelRu: "Альбом", labelEn: "Album" },
  like: { icon: Heart, accent: "text-rose-500", labelRu: "Лайк", labelEn: "Like" },
  news: { icon: Newspaper, accent: "text-amber-500", labelRu: "Новость", labelEn: "News" },
  event: { icon: CalendarDays, accent: "text-emerald-500", labelRu: "Событие", labelEn: "Event" },
  activity: { icon: ActivityIcon, accent: "text-gray-400", labelRu: "Активность", labelEn: "Activity" },
};

const VAC_COLOR: Record<string, string> = {
  NWS: "bg-red-500",
  KAR: "bg-sky-500",
  STW: "bg-amber-500",
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
  return <img src={uri} alt="" className="inline-block h-3 w-4.5 rounded-[2px] border border-black/10 object-cover" />;
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
    return () => {
      active = false;
    };
  }, [limit]);

  return { feed, loading, error };
}

function FeedRow({ item, language }: { item: FeedItem; language: string }) {
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const meta = TYPE_META[item.type] || TYPE_META.activity;
  const Icon = meta.icon;
  const actorName = item.actor?.name?.trim();

  const body = (
    <div className="flex items-start gap-3">
      <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50">
        <Icon className={`h-4.5 w-4.5 ${meta.accent}`} />
        {item.vac ? <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${VAC_COLOR[item.vac] || "bg-gray-400"}`} /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {actorName ? <span className="text-sm font-semibold text-gray-900">{actorName}</span> : null}
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            {tr(meta.labelRu, meta.labelEn)}
          </span>
          <span className="text-xs text-gray-400">{timeAgo(item.createdAt, language)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-700">
          <span className="font-semibold">{item.title}</span>
          {item.route ? (
            <span className="inline-flex items-center gap-1 text-gray-500">
              <Flag icao={item.route.from} />
              <span className="font-mono text-xs">{item.route.from}</span>
              <Plane className="h-3 w-3 text-gray-300" />
              <Flag icao={item.route.to} />
              <span className="font-mono text-xs">{item.route.to}</span>
            </span>
          ) : null}
        </div>
        {item.summary && !item.route ? (
          <div className="mt-0.5 truncate text-xs text-gray-500">{item.summary}</div>
        ) : null}
      </div>
      {item.media?.url ? (
        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <img src={item.media.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          {item.media.likeCount > 0 ? (
            <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-black/55 px-1 text-[9px] font-bold text-white">
              <Heart className="h-2.5 w-2.5 fill-current" />
              {item.media.likeCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const cls = "block rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-gray-100 hover:bg-gray-50";
  return item.href ? (
    <a href={item.href} className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Единая лента активности сообщества (сайт + приложение).
 * Светлая (на сайте — на белой карточке, в приложении — на светлом «листе» хаба).
 */
export function ActivityFeed({ limit = 30, className = "" }: { limit?: number; className?: string }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { feed, loading, error } = useActivityFeed(limit);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <ActivityIcon className="h-4.5 w-4.5 text-[#E31E24]" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">
          {tr("Лента сообщества", "Community feed")}
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-10 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Загрузка…", "Loading…")}
        </div>
      ) : error || feed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          {tr("Пока тихо. Загляните позже.", "Quiet for now. Check back later.")}
        </div>
      ) : (
        <div className="space-y-0.5">
          {feed.map((item) => (
            <FeedRow key={item.id} item={item} language={language} />
          ))}
        </div>
      )}
    </div>
  );
}
