import { useCallback, useEffect, useState } from "react";
import { FileText, RefreshCw, ExternalLink, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import DOMPurify from "dompurify";
import { useLanguage } from "../../context/language-context";

interface SimbriefPayload {
  ok?: boolean;
  available?: boolean;
  url?: string | null;
  html?: string | null;
  message?: string;
  error?: string;
}

/** Просмотр OFP SimBrief по броне на странице полёта. */
export function OfpViewer({ bookingId }: { bookingId: number }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SimbriefPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (method: "GET" | "PUT" = "GET") => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pilot/bookings/${bookingId}/simbrief`, {
          method,
          credentials: "include",
        });
        const payload = (await res.json().catch(() => null)) as SimbriefPayload | null;
        setData(payload);
      } catch {
        setData({ error: "network" });
      } finally {
        setLoading(false);
      }
    },
    [bookingId]
  );

  // первая загрузка при раскрытии
  useEffect(() => {
    if (open && !data) void load("GET");
  }, [open, data, load]);

  const url = data?.url || "";
  const safeHtml = data?.html ? DOMPurify.sanitize(data.html) : "";
  const hasContent = Boolean(url || safeHtml);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-red-500" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{tr("OFP SimBrief", "SimBrief OFP")}</span>
        </button>
        <div className="flex items-center gap-1.5">
          {open && hasContent ? (
            <>
              <button
                type="button"
                onClick={() => void load("PUT")}
                disabled={loading}
                className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5"
                title={tr("Обновить", "Refresh")}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </button>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-400 dark:hover:bg-white/5"
                  title={tr("Открыть в браузере", "Open in browser")}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </>
          ) : null}
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-zinc-400">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-zinc-100 dark:border-white/5">
          {loading && !data ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr("Загрузка OFP…", "Loading OFP…")}
            </div>
          ) : url ? (
            <iframe title="SimBrief OFP" src={url} className="h-[70vh] w-full bg-white" />
          ) : safeHtml ? (
            <div
              className="nws-scroll max-h-[70vh] overflow-y-auto bg-white p-4 text-sm text-zinc-800"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          ) : (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              {data?.message || tr("OFP для этого рейса пока недоступен. Сгенерируйте бриф в SimBrief.", "OFP isn't available yet. Generate a briefing in SimBrief.")}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
