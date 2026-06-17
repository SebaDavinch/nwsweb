import { useMemo, useState } from "react";
import { CalendarDays, Loader2, Check, UserPlus, UserMinus, Trophy, Users, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { useActivities, type PublicActivity } from "./use-activities";
import { useActivityProgress, type ActivityProgressItem } from "./use-activity-progress";

const strip = (s?: string) => String(s || "").replace(/<[^>]+>/g, "").trim();

export function AppActivities() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const locale = language === "ru" ? "ru-RU" : "en-US";
  const { activities, registrationByActivity, loading, busyId, register, unregister } = useActivities();
  const { items: progressItems } = useActivityProgress(8);
  const [filter, setFilter] = useState<"all" | "registered">("all");

  // Прогресс по activityId для быстрой подстановки в карточки.
  const progressByActivity = useMemo(() => {
    const m = new Map<number, ActivityProgressItem>();
    for (const it of progressItems) m.set(it.activityId, it);
    return m;
  }, [progressItems]);

  const fmtDate = (v?: string) => {
    const t = new Date(String(v || "")).getTime();
    return Number.isFinite(t) && t > 0 ? new Date(t).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : null;
  };

  const visible = activities.filter((a) =>
    filter === "registered" ? a.originalId != null && registrationByActivity.has(a.originalId) : true
  );

  const onToggle = async (a: PublicActivity) => {
    if (a.originalId == null) return;
    const isReg = registrationByActivity.has(a.originalId);
    const ok = isReg ? await unregister(a.originalId) : await register(a.originalId);
    if (ok) {
      toast.success(isReg ? tr("Вы отписались от мероприятия", "Unregistered from the event") : tr("Вы записаны на мероприятие!", "Registered for the event!"));
    } else {
      toast.error(tr("Не удалось выполнить действие", "Action failed"));
    }
  };

  const registeredCount = activities.filter((a) => a.originalId != null && registrationByActivity.has(a.originalId)).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{tr("Мероприятия", "Activities")}</h1>
            <p className="text-xs text-zinc-400">{tr("События, туры и челленджи авиакомпании", "Airline events, tours and challenges")}</p>
          </div>
        </div>
        <div className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-white/10 dark:bg-zinc-800">
          {(["all", "registered"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              {f === "all" ? tr("Все", "All") : `${tr("Мои", "Mine")}${registeredCount ? ` (${registeredCount})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Загрузка…", "Loading…")}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-12 text-center text-sm text-zinc-400 dark:border-white/10 dark:bg-zinc-900">
          {filter === "registered" ? tr("Вы пока никуда не записаны.", "You're not registered for anything yet.") : tr("Активных мероприятий нет.", "No active activities.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {visible.map((a) => {
            const isReg = a.originalId != null && registrationByActivity.has(a.originalId);
            const prog = a.originalId != null ? progressByActivity.get(a.originalId) : undefined;
            const canRegister = a.originalId != null && (a.registrationOpen || isReg);
            const busy = busyId === a.originalId;
            const start = fmtDate(a.start || a.date);

            return (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
                {/* Изображение */}
                <div className="relative h-32 w-full bg-gradient-to-br from-zinc-800 to-red-950">
                  {a.imageUrl ? <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" /> : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      <CalendarDays className="h-3 w-3" />
                      {a.activityType || tr("Событие", "Event")}
                    </span>
                    {a.featured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        <Star className="h-3 w-3" />
                        {tr("Топ", "Featured")}
                      </span>
                    ) : null}
                  </div>
                  {isReg ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                      <Check className="h-3 w-3" />
                      {tr("Записан", "Registered")}
                    </span>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <h3 className="line-clamp-1 text-base font-black text-white">{a.title}</h3>
                    {start ? <div className="text-[11px] text-white/70">{start}</div> : null}
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  {a.summary || a.content ? (
                    <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{strip(a.summary || a.content)}</p>
                  ) : null}

                  {/* Метрики */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{a.registrations || 0} {tr("уч.", "reg.")}</span>
                    {a.completions ? <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5" />{a.completions} {tr("завершили", "done")}</span> : null}
                    {a.points ? <span className="inline-flex items-center gap-1 text-amber-500"><Star className="h-3.5 w-3.5" />{a.points} pts</span> : null}
                  </div>

                  {/* Прогресс (если записан и есть прогресс) */}
                  {isReg && prog?.progress && prog.progress.legTotal > 0 ? (
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{tr("Прогресс", "Progress")}</span>
                        <span className="font-semibold text-zinc-600 dark:text-zinc-300">{prog.progress.legCompleted}/{prog.progress.legTotal} · {prog.progress.progressPercent}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${prog.progress.progressPercent}%` }} />
                      </div>
                    </div>
                  ) : null}

                  {/* Кнопка записи */}
                  {canRegister ? (
                    <button
                      type="button"
                      onClick={() => void onToggle(a)}
                      disabled={busy}
                      className={[
                        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                        isReg
                          ? "border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                          : "bg-red-500 text-white hover:bg-red-400",
                      ].join(" ")}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : isReg ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      {isReg ? tr("Отписаться", "Unregister") : tr("Записаться", "Register")}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-2 text-center text-xs text-zinc-400 dark:border-white/5 dark:bg-white/5">
                      {tr("Запись закрыта", "Registration closed")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
