import { useEffect, useState } from "react";
import {
  Download,
  Monitor,
  Plane,
  CheckCircle2,
  Clock,
  ExternalLink,
  Package,
  Joystick,
} from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface DesktopRelease {
  version: string;
  notes: string;
  platform: string;
  size: number;
  uploadedAt: string | null;
  downloads: number;
  downloadUrl: string;
}

interface HubRelease {
  version: string;
  notes: string;
  uploadedAt: string | null;
  downloads: number;
}

const fmtSize = (bytes: number) => {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} МБ` : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
};

const fmtDate = (iso: string | null | undefined, locale: string) => {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
};

export function PilotDownloads() {
  const { language } = useLanguage();
  const ru = language === "ru";
  const tr = (r: string, e: string) => (ru ? r : e);
  const locale = ru ? "ru-RU" : "en-US";

  const [desktopLatest, setDesktopLatest] = useState<DesktopRelease | null>(null);
  const [desktopReleases, setDesktopReleases] = useState<DesktopRelease[]>([]);
  const [desktopLoading, setDesktopLoading] = useState(true);

  const [hubLatest, setHubLatest] = useState<HubRelease | null>(null);
  const [hubReleases, setHubReleases] = useState<HubRelease[]>([]);
  const [hubLoading, setHubLoading] = useState(true);

  useEffect(() => {
    fetch("/api/app/releases")
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (p) {
          setDesktopLatest(p.latest || null);
          setDesktopReleases(Array.isArray(p.releases) ? p.releases : []);
        }
      })
      .catch(() => null)
      .finally(() => setDesktopLoading(false));

    fetch("/api/app/msfs-hub/releases")
      .then((r) => r.json().catch(() => null))
      .then((p) => {
        if (p) {
          setHubLatest(p.latest || null);
          setHubReleases(Array.isArray(p.releases) ? p.releases : []);
        }
      })
      .catch(() => null)
      .finally(() => setHubLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[#1d1d1f] dark:text-white">
          {tr("Загрузки", "Downloads")}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {tr(
            "Инструменты пилота Nordwind Virtual — десктоп-компаньон и MSFS-панель.",
            "Nordwind Virtual pilot tools — desktop companion and MSFS toolbar panel."
          )}
        </p>
      </div>

      {/* ── NordwindHub Desktop App ── */}
      <Card className="border border-gray-100 shadow-md overflow-hidden dark:bg-white/[0.04] dark:backdrop-blur-xl dark:border-white/[0.09]">
        <CardHeader className="pb-4 border-b border-gray-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#E31E24]/10 flex items-center justify-center">
              <Monitor className="h-5 w-5 text-[#E31E24]" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                NordwindHub
                <Badge className="bg-[#E31E24] text-white text-[10px] uppercase tracking-wide">
                  {tr("Десктоп", "Desktop")}
                </Badge>
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {tr("Windows · требует WebView2", "Windows · requires WebView2")}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {tr(
              "Десктоп-компаньон пилота: живая карта, чат сообщества, галерея скриншотов, радио, ИИ-ассистент, достижения, паспорт, NOTAM и режим «Полёт» с телеметрией рейса.",
              "Pilot desktop companion: live map, community chat, screenshot gallery, radio, AI assistant, achievements, passport, NOTAM and a Flight mode with flight telemetry."
            )}
          </p>

          {/* CTA */}
          <div className="flex flex-wrap items-center gap-3">
            {desktopLoading ? (
              <div className="h-10 w-48 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
            ) : desktopLatest ? (
              <>
                <Button asChild className="bg-[#E31E24] hover:bg-[#c41a20] text-white gap-2">
                  <a href={desktopLatest.downloadUrl}>
                    <Download className="h-4 w-4" />
                    {tr("Скачать для Windows", "Download for Windows")}
                  </a>
                </Button>
                <span className="text-xs text-gray-400">
                  v{desktopLatest.version} · {fmtSize(desktopLatest.size)}
                </span>
              </>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                {tr("Сборка скоро будет доступна", "A build will be available soon")}
              </div>
            )}
          </div>

          {/* System requirements */}
          <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.07] p-4">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              {tr("Системные требования", "System requirements")}
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                tr("Windows 10 (1803+) или Windows 11, 64-bit", "Windows 10 (1803+) or Windows 11, 64-bit"),
                tr("WebView2 (встроен в Win11, докачается на Win10)", "WebView2 (built into Win11, auto-downloaded on Win10)"),
                tr("Без прав администратора", "No administrator rights needed"),
                tr("Аккаунт пилота vAMSYS или Discord", "vAMSYS or Discord pilot account"),
              ].map((req) => (
                <li key={req} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Release history */}
          {!desktopLoading && desktopReleases.length > 0 && (
            <ReleaseHistory
              releases={desktopReleases.map((r) => ({
                version: r.version,
                notes: r.notes,
                uploadedAt: r.uploadedAt,
                size: r.size,
                downloadHref: r.downloadUrl,
              }))}
              accentClass="border-[#E31E24]/20 bg-red-50/40 dark:bg-red-900/10"
              badgeClass="bg-[#E31E24]"
              hoverClass="hover:border-[#E31E24] hover:text-[#E31E24]"
              locale={locale}
              tr={tr}
            />
          )}
        </CardContent>
      </Card>

      {/* ── vNWS Hub MSFS Panel ── */}
      <Card className="border border-gray-100 shadow-md overflow-hidden dark:bg-white/[0.04] dark:backdrop-blur-xl dark:border-white/[0.09]">
        <CardHeader className="pb-4 border-b border-gray-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center">
              <Joystick className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                vNWS Hub
                <Badge className="bg-sky-600 text-white text-[10px] uppercase tracking-wide">
                  MSFS
                </Badge>
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {tr("MSFS 2020 / MSFS 2024 · панель тулбара", "MSFS 2020 / MSFS 2024 · toolbar panel")}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {tr(
              "Панель инструментов прямо внутри Microsoft Flight Simulator — текущее бронирование, NOTAMы, статистика, быстрый поиск рейсов и индикаторы связи с сайтом и vAMSYS.",
              "A toolbar panel inside Microsoft Flight Simulator — current booking, NOTAMs, stats, quick flight search and connectivity indicators for the site and vAMSYS."
            )}
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: tr("Текущее бронирование", "Active booking"), desc: tr("Маршрут, статус, время, борт", "Route, status, time, aircraft") },
              { label: tr("NOTAMы", "NOTAMs"), desc: tr("Список актуальных уведомлений", "List of current notifications") },
              { label: tr("Статистика и PIREPы", "Stats & PIREPs"), desc: tr("Налёт, рейсы, последние полёты", "Hours, flights, recent trips") },
              { label: tr("Быстрый поиск рейса", "Quick booking search"), desc: tr("DEP → ARR → открыть на сайте", "DEP → ARR → open on site") },
              { label: tr("Индикаторы связи", "Connectivity status"), desc: tr("vnws.org и vAMSYS в реальном времени", "vnws.org and vAMSYS in real-time") },
              { label: tr("Автовыбор ВАК", "Auto VA detection"), desc: tr("vNWS или RAG по активному букингу", "vNWS or RAG by active booking") },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-gray-100 dark:border-white/[0.07] bg-gray-50/60 dark:bg-white/[0.02] p-3.5">
                <div className="text-sm font-semibold text-[#1d1d1f] dark:text-gray-100">{f.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Install instructions */}
          <div className="rounded-xl bg-sky-50/60 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-500/20 p-4 space-y-3">
            <div className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              {tr("Установка", "Installation")}
            </div>
            <ol className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 list-none">
              {[
                tr("Скачайте архив VNWSHub ниже.", "Download the VNWSHub archive below."),
                tr("Распакуйте папку VNWSHub в директорию Community вашего симулятора.", "Extract the VNWSHub folder into the Community directory of your simulator."),
                tr("Запустите MSFS — кнопка vNWS Hub появится на тулбаре в кабине.", "Launch MSFS — the vNWS Hub button will appear on the cockpit toolbar."),
                tr("Войдите в аккаунт, введя токен из настроек профиля на сайте.", "Log in by entering the token from your profile settings on the site."),
              ].map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-bold text-sky-600 dark:text-sky-400">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Download CTA */}
          <div className="flex flex-wrap items-center gap-3">
            {hubLoading ? (
              <div className="h-9 w-44 animate-pulse rounded-xl bg-gray-100 dark:bg-white/10" />
            ) : hubLatest ? (
              <>
                <Button asChild className="bg-sky-600 hover:bg-sky-700 text-white gap-2">
                  <a href="/api/app/msfs-hub/download">
                    <Download className="h-4 w-4" />
                    {tr("Скачать VNWSHub", "Download VNWSHub")}
                  </a>
                </Button>
                <span className="text-xs text-gray-400">
                  v{hubLatest.version}
                  {hubLatest.uploadedAt ? ` · ${fmtDate(hubLatest.uploadedAt, locale)}` : ""}
                </span>
              </>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                {tr("Пакет скоро будет доступен", "Package will be available soon")}
              </div>
            )}
            <a
              href="https://github.com/SebaDavinch/vnws-hub-msfs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
          {hubLatest?.notes ? (
            <div className="rounded-lg border border-gray-100 dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.02] px-3.5 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
              {hubLatest.notes}
            </div>
          ) : null}

          {/* Compatibility */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "MSFS 2020", ok: true },
              { label: "MSFS 2024", ok: true },
              { label: "Chromium 87+", ok: true },
            ].map(({ label, ok }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
              >
                {ok && <CheckCircle2 className="h-3 w-3" />}
                {label}
              </span>
            ))}
          </div>

          {/* Release history */}
          {!hubLoading && hubReleases.length > 0 && (
            <ReleaseHistory
              releases={hubReleases.map((r) => ({
                version: r.version,
                notes: r.notes,
                uploadedAt: r.uploadedAt,
                size: null,
                downloadHref: `/api/app/msfs-hub/download/${r.version}`,
              }))}
              accentClass="border-sky-200/60 bg-sky-50/40 dark:bg-sky-900/10"
              badgeClass="bg-sky-600"
              hoverClass="hover:border-sky-500 hover:text-sky-600"
              locale={locale}
              tr={tr}
            />
          )}
        </CardContent>
      </Card>

      {/* Bottom link to public page */}
      <div className="text-center">
        <a
          href="/download"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#E31E24] transition-colors"
        >
          <Plane className="h-4 w-4" />
          {tr("Публичная страница загрузок", "Public downloads page")}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

// ── Shared release history component ─────────────────────────────────────────
interface ReleaseRow {
  version: string;
  notes: string;
  uploadedAt: string | null;
  size: number | null;
  downloadHref: string;
}

function ReleaseHistory({
  releases,
  accentClass,
  badgeClass,
  hoverClass,
  locale,
  tr,
}: {
  releases: ReleaseRow[];
  accentClass: string;
  badgeClass: string;
  hoverClass: string;
  locale: string;
  tr: (r: string, e: string) => string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {tr("История версий", "Release history")}
      </div>
      <div className="space-y-2">
        {releases.map((r, i) => (
          <div
            key={r.version}
            className={`rounded-xl border p-3.5 ${
              i === 0
                ? accentClass
                : "border-gray-100 dark:border-white/[0.07] bg-white dark:bg-transparent"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="font-bold text-[#1d1d1f] dark:text-white text-sm">v{r.version}</span>
                {i === 0 && (
                  <span className={`rounded-full ${badgeClass} px-2 py-0.5 text-[10px] font-bold uppercase text-white`}>
                    {tr("Актуальная", "Latest")}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {fmtDate(r.uploadedAt, locale)}
                  {r.size ? ` · ${fmtSize(r.size)}` : ""}
                </span>
              </div>
              <a
                href={r.downloadHref}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 ${hoverClass} transition-colors shrink-0`}
              >
                <Download className="h-3.5 w-3.5" />
                {tr("Скачать", "Download")}
              </a>
            </div>
            {r.notes ? (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                {r.notes}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
