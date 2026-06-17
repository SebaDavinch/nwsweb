import { useEffect, useState } from "react";
import { Heart, Trophy, Medal } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { useAuth } from "../../context/auth-context";

interface Leader {
  rank: number;
  pilotId: number | null;
  username: string | null;
  name: string;
  likes: number;
  uploads: number;
  featured: number;
}

function rankBadge(rank: number) {
  if (rank === 1) return { cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", icon: <Trophy className="h-3.5 w-3.5" /> };
  if (rank === 2) return { cls: "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-300", icon: <Medal className="h-3.5 w-3.5" /> };
  if (rank === 3) return { cls: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400", icon: <Medal className="h-3.5 w-3.5" /> };
  return { cls: "bg-zinc-100 text-zinc-400 dark:bg-white/5 dark:text-zinc-500", icon: null };
}

export function LikesLeaderboard({ limit = 10 }: { limit?: number }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const { pilot } = useAuth();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/pilot/gallery-leaderboard", { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (active && Array.isArray(p?.leaders)) setLeaders(p.leaders);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <header className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-white/5">
        <Heart className="h-4 w-4 text-red-500" />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {tr("Топ по лайкам", "Likes leaderboard")}
        </h3>
      </header>
      <div className="divide-y divide-zinc-100 dark:divide-white/5">
        {loading ? (
          <div className="px-4 py-6 text-sm text-zinc-400">{tr("Загрузка…", "Loading…")}</div>
        ) : leaders.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-400">{tr("Пока нет лайков", "No likes yet")}</div>
        ) : (
          leaders.slice(0, limit).map((l) => {
            const b = rankBadge(l.rank);
            const isMe = pilot && (String(l.pilotId ?? "") === String(pilot.id) || l.username === pilot.callsign);
            return (
              <div
                key={`${l.rank}-${l.username}`}
                className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? "bg-red-50/60 dark:bg-red-500/5" : ""}`}
              >
                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${b.cls}`}>
                  {b.icon || l.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {l.name}
                    {isMe ? <span className="ml-1 text-[10px] font-bold uppercase text-red-500">{tr("вы", "you")}</span> : null}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {l.uploads} {tr("фото", "shots")}
                    {l.featured ? ` · ★ ${l.featured}` : ""}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-sm font-bold text-red-500 dark:bg-red-500/10">
                  <Heart className="h-3.5 w-3.5 fill-current" />
                  {l.likes}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
