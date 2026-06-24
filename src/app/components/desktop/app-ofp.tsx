import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, ExternalLink, Loader2, Printer } from "lucide-react";
import DOMPurify from "dompurify";
import { useLanguage } from "../../context/language-context";
import { openExternal } from "./open-external";

interface SimbriefPayload {
  ok?: boolean;
  available?: boolean;
  url?: string | null;
  pdfUrl?: string | null;
  html?: string | null;
  message?: string;
  error?: string;
}

/**
 * Полноэкранный просмотр OFP (план полёта SimBrief) по активной броне.
 * Поддерживает обновление, открытие в браузере и печать через системные принтеры Windows.
 */
export function AppOfp({ bookingId, route }: { bookingId: number; route?: string }) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [data, setData] = useState<SimbriefPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const load = useCallback(
    async (method: "GET" | "PUT" = "GET") => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pilot/bookings/${bookingId}/simbrief`, { method, credentials: "include" });
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

  useEffect(() => {
    void load("GET");
  }, [load]);

  const pdfUrl = data?.pdfUrl || "";
  const viewerUrl = pdfUrl || data?.url || "";
  const safeHtml = data?.html ? DOMPurify.sanitize(data.html) : "";
  const hasContent = Boolean(viewerUrl || safeHtml);

  // Печать через системный диалог (→ принтеры Windows).
  const print = () => {
    // HTML-OFP печатаем в своём окне: открываем чистый документ с содержимым и вызываем print().
    if (safeHtml && !pdfUrl) {
      const w = window.open("", "_blank", "width=900,height=1000");
      if (!w) return;
      w.document.write(
        `<!doctype html><html><head><meta charset="utf-8"><title>OFP ${route || ""}</title>` +
          `<style>body{font-family:monospace;font-size:12px;padding:24px;color:#111}</style></head>` +
          `<body>${safeHtml}</body></html>`
      );
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
      }, 300);
      return;
    }
    // PDF: пробуем напечатать через iframe (same-origin прокси не гарантирован → fallback на открытие).
    const frame = iframeRef.current;
    try {
      if (frame?.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      }
    } catch {
      /* cross-origin — печать из iframe запрещена, открываем во внешнем окне */
    }
    if (viewerUrl) void openExternal(viewerUrl);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Тулбар */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{tr("План полёта (OFP)", "Flight plan (OFP)")}</h1>
            {route ? <p className="text-xs text-zinc-400">{route}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load("PUT")}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {tr("Обновить", "Refresh")}
          </button>
          {hasContent ? (
            <>
              <button
                type="button"
                onClick={print}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-400"
              >
                <Printer className="h-4 w-4" />
                {tr("Печать", "Print")}
              </button>
              {viewerUrl ? (
                <button
                  type="button"
                  onClick={() => void openExternal(viewerUrl)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
                >
                  <ExternalLink className="h-4 w-4" />
                  {tr("В браузере", "In browser")}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* Документ */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10">
        {loading && !data ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("Загрузка OFP…", "Loading OFP…")}
          </div>
        ) : viewerUrl ? (
          <iframe ref={iframeRef} title="OFP" src={viewerUrl} className="h-full w-full bg-white dark:bg-zinc-900" />
        ) : safeHtml ? (
          <div
            className="nws-scroll h-full overflow-y-auto bg-white p-5 font-mono text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-zinc-400">
            <FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            {data?.message || tr(
              "OFP для этого рейса пока недоступен. Сгенерируйте бриф в SimBrief и нажмите «Обновить».",
              "OFP isn't available yet. Generate a briefing in SimBrief and press Refresh."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
