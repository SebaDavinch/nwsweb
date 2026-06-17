import { useEffect, useState } from "react";
import { ScrollText, Copy, Trash2, ChevronDown, ChevronUp, AlertTriangle, Check } from "lucide-react";
import { useLanguage } from "../../context/language-context";
import { getLogs, clearLogs, subscribeLogs, exportLogsText, type LogEntry } from "./app-logger";

const LEVEL_CLS: Record<string, string> = {
  info: "text-zinc-400",
  warn: "text-amber-500",
  error: "text-red-500",
};

export function LogsViewer() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>(getLogs());
  const [copied, setCopied] = useState(false);

  useEffect(() => subscribeLogs(() => setEntries(getLogs())), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportLogsText());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{tr("Логи приложения", "App logs")}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
            {entries.length}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open ? (
        <div className="border-t border-zinc-100 p-4 dark:border-white/5">
          {/* Дисклеймер */}
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {tr(
                "Технические логи нужны только для поддержки. Они хранятся локально на вашем устройстве и не отправляются автоматически. При обращении в саппорт скопируйте и пришлите их.",
                "Technical logs are for support only. They are stored locally on your device and are not sent automatically. When contacting support, copy and share them."
              )}
            </span>
          </div>

          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? tr("Скопировано", "Copied") : tr("Копировать", "Copy")}
            </button>
            <button
              type="button"
              onClick={clearLogs}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-white/10 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {tr("Очистить", "Clear")}
            </button>
          </div>

          <div className="nws-scroll max-h-72 overflow-y-auto rounded-xl bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed">
            {entries.length === 0 ? (
              <div className="text-zinc-500">{tr("Логи пусты", "No logs")}</div>
            ) : (
              entries
                .slice()
                .reverse()
                .map((e, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    <span className="text-zinc-600">{e.ts.slice(11, 19)}</span>{" "}
                    <span className={LEVEL_CLS[e.level] || "text-zinc-400"}>{e.level.toUpperCase()}</span>{" "}
                    <span className="text-sky-400">{e.scope}</span>{" "}
                    <span className="text-zinc-300">{e.message}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
