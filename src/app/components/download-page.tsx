import { useEffect, useState } from "react";
import {
  Download,
  Map as MapIcon,
  MessageSquare,
  Images,
  Radio,
  Sparkles,
  Camera,
  Trophy,
  BookMarked,
  ShieldAlert,
  Gamepad2,
  Bell,
  Monitor,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useLanguage } from "../context/language-context";
import logo from "@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png";

interface ReleaseView {
  version: string;
  notes: string;
  platform: string;
  size: number;
  uploadedAt: string | null;
  downloads: number;
  downloadUrl: string;
}

const fmtSize = (bytes: number) => {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
};

export function DownloadPage() {
  const { language } = useLanguage();
  const ru = language === "ru";
  const tr = (r: string, e: string) => (ru ? r : e);
  const locale = ru ? "ru-RU" : "en-US";

  const [latest, setLatest] = useState<ReleaseView | null>(null);
  const [releases, setReleases] = useState<ReleaseView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/app/releases")
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (p) {
          setLatest(p.latest || null);
          setReleases(Array.isArray(p.releases) ? p.releases : []);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const features = [
    { icon: MapIcon, title: tr("Живая карта", "Live map"), desc: tr("Все рейсы в реальном времени, трейлы, кто где летит.", "All live flights, trails, who's flying where.") },
    { icon: Camera, title: tr("Скриншоты рейса", "Flight screenshots"), desc: tr("Авто-импорт из симулятора, гео-метки на карте.", "Auto-import from the sim, geo-pins on the map.") },
    { icon: Images, title: tr("Галерея сообщества", "Community gallery"), desc: tr("Лента, топ, лайки, лидерборд по скриншотам.", "Feed, top shots, likes, screenshot leaderboard.") },
    { icon: MessageSquare, title: tr("Чат и ЛС", "Chat & DMs"), desc: tr("Общий чат, личные сообщения, реакции, упоминания.", "General chat, direct messages, reactions, mentions.") },
    { icon: Radio, title: tr("Радио", "Radio"), desc: tr("Интернет-станции и YouTube-плейлисты во время полёта.", "Internet stations and YouTube playlists in flight.") },
    { icon: Sparkles, title: tr("ИИ-ассистент", "AI assistant"), desc: tr("Помощь по авиакомпании и приложению в один клик.", "Help with the VA and the app in one click.") },
    { icon: Trophy, title: tr("Достижения", "Achievements"), desc: tr("Тиры по налёту и активности, Steam-style уведомления.", "Tiers by hours and activity, Steam-style toasts.") },
    { icon: BookMarked, title: tr("Паспорт пилота", "Pilot passport"), desc: tr("Карта посещённых стран и аэропортов, хроника.", "Map of visited countries and airports, timeline.") },
    { icon: ShieldAlert, title: tr("NOTAM", "NOTAM"), desc: tr("Баннер срочных уведомлений и полный список.", "Urgent banner and the full NOTAM list.") },
    { icon: Gamepad2, title: tr("Discord Rich Presence", "Discord Rich Presence"), desc: tr("Ваш рейс и фаза прямо в статусе Discord.", "Your flight and phase right in your Discord status.") },
    { icon: Bell, title: tr("Уведомления", "Notifications"), desc: tr("О начале рейса, посадке и упоминаниях в чате.", "On flight start, landing and chat mentions.") },
    { icon: Monitor, title: tr("Режим «Полёт»", "Flight mode"), desc: tr("IFE-карточка, телеметрия, ближайший аэропорт, OFP.", "IFE card, telemetry, nearest airport, OFP.") },
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#1a1a1f] text-white">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-red-900/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-200">
              <Monitor className="h-3.5 w-3.5" />
              {tr("Десктоп-приложение", "Desktop app")}
            </div>
            <div className="flex items-center gap-4">
              <img src={logo} alt="NordwindHub" className="h-16 w-auto object-contain" />
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">NordwindHub</h1>
            </div>
            <p className="max-w-2xl text-lg leading-relaxed text-white/70">
              {tr(
                "Десктоп-компаньон пилота Nordwind Virtual: живая карта, чат, галерея, радио, ассистент, скриншоты рейса и режим «Полёт» с телеметрией — всё рядом с симулятором.",
                "The Nordwind Virtual pilot companion: live map, chat, gallery, radio, assistant, flight screenshots and a telemetry Flight mode — right next to your simulator."
              )}
            </p>

            {/* CTA */}
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {loading ? (
                <div className="h-12 w-56 animate-pulse rounded-xl bg-white/10" />
              ) : latest ? (
                <>
                  <a
                    href={latest.downloadUrl}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-[#E31E24] px-6 py-3.5 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#c41a20]"
                  >
                    <Download className="h-5 w-5" />
                    {tr("Скачать для Windows", "Download for Windows")}
                  </a>
                  <div className="text-sm text-white/60">
                    {tr("Версия", "Version")} {latest.version} · {fmtSize(latest.size)}
                  </div>
                </>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm text-white/70">
                  <Clock className="h-4 w-4" />
                  {tr("Сборка скоро будет доступна для скачивания", "A build will be available for download soon")}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Возможности */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-black tracking-tight text-[#1d1d1f]">{tr("Возможности", "Features")}</h2>
        <p className="mt-1 text-sm text-gray-500">{tr("Всё, что нужно пилоту, в одном окне рядом с симулятором.", "Everything a pilot needs in one window next to the sim.")}</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#E31E24]">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-base font-bold text-[#1d1d1f]">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Системные требования */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-[#1d1d1f]">{tr("Системные требования", "System requirements")}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              tr("Windows 10 (1803+) или Windows 11, 64-bit", "Windows 10 (1803+) or Windows 11, 64-bit"),
              tr("WebView2 (встроен в Win11, докачается на Win10)", "WebView2 (built into Win11, auto-downloaded on Win10)"),
              tr("Установка без прав администратора", "Installs without administrator rights"),
              tr("Аккаунт пилота vAMSYS или Discord", "vAMSYS or Discord pilot account"),
              tr("~150 МБ свободного места", "~150 MB free disk space"),
              tr("Интернет-соединение", "Internet connection"),
            ].map((req) => (
              <li key={req} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                {req}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* История версий */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-black tracking-tight text-[#1d1d1f]">{tr("История версий", "Release history")}</h2>
        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-400">{tr("Загрузка…", "Loading…")}</div>
          ) : releases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-400">
              {tr("Пока нет опубликованных версий.", "No published versions yet.")}
            </div>
          ) : (
            releases.map((r, i) => (
              <div
                key={r.version}
                className={`rounded-2xl border p-5 ${i === 0 ? "border-[#E31E24]/30 bg-red-50/40" : "border-gray-100 bg-white"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-[#1d1d1f]">v{r.version}</span>
                    {i === 0 ? (
                      <span className="rounded-full bg-[#E31E24] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        {tr("Актуальная", "Latest")}
                      </span>
                    ) : null}
                    <span className="text-xs text-gray-400">
                      {r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : ""}
                      {" · "}
                      {fmtSize(r.size)}
                    </span>
                  </div>
                  <a
                    href={r.downloadUrl}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-semibold text-[#1d1d1f] transition-colors hover:border-[#E31E24] hover:text-[#E31E24]"
                  >
                    <Download className="h-4 w-4" />
                    {tr("Скачать", "Download")}
                  </a>
                </div>
                {r.notes ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{r.notes}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
