import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, Monitor, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "../../context/language-context";
import { Button } from "../ui/button";

interface LoginEvent {
  id: string;
  createdAt: string;
  provider: string;
  type: string;
  outcome: string;
  userAgent: string | null;
}

// Краткая метка устройства из user-agent (без хранения/показа IP).
function deviceLabel(ua: string | null): string {
  const s = String(ua || "");
  if (!s) return "—";
  let os = "";
  if (/Windows/i.test(s)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(s)) os = "macOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(s)) os = "iOS";
  else if (/Linux/i.test(s)) os = "Linux";
  let browser = "";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/Chrome\//i.test(s)) browser = "Chrome";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari\//i.test(s)) browser = "Safari";
  return [os, browser].filter(Boolean).join(" · ") || "—";
}

export function PilotLoginHistory() {
  const { language } = useLanguage();
  const isRu = language === "ru";
  const tr = (ru: string, en: string) => (isRu ? ru : en);
  const locale = isRu ? "ru-RU" : "en-US";

  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pilot/auth/history?limit=20", { credentials: "include" });
      if (res.ok) {
        const p = await res.json();
        setHistory(Array.isArray(p?.history) ? p.history : []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revokeAll = async () => {
    if (!window.confirm(tr("Выйти из приложения на всех устройствах?", "Sign out of the app on all devices?"))) return;
    setRevoking(true);
    try {
      const res = await fetch("/api/auth/session/revoke-all", { method: "POST", credentials: "include" });
      const p = await res.json().catch(() => null);
      if (res.ok) {
        toast.success(tr(`Сессии приложения отозваны: ${p?.revoked ?? 0}`, `App sessions revoked: ${p?.revoked ?? 0}`));
      } else {
        toast.error(tr("Ошибка", "Error"));
      }
    } catch {
      toast.error(tr("Ошибка", "Error"));
    } finally {
      setRevoking(false);
    }
  };

  const providerLabel = (p: string) => {
    const v = String(p || "").toLowerCase();
    if (v === "discord") return "Discord";
    if (v === "pilot-api" || v === "vamsys") return "vAMSYS";
    if (v === "telegram") return "Telegram";
    return p || "—";
  };

  const typeLabel = (t: string) => {
    const v = String(t || "").toLowerCase();
    if (v === "login") return tr("вход", "login");
    if (v === "logout") return tr("выход", "logout");
    if (v === "connect") return tr("подключение", "connect");
    if (v === "link") return tr("привязка", "link");
    return t || "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-500">
          {tr(
            "Последние события входа в ваш аккаунт. IP не сохраняется.",
            "Recent sign-in events for your account. IP is not stored."
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {tr("Обновить", "Reload")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void revokeAll()}
            disabled={revoking}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            {revoking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}
            {tr("Выйти везде (приложение)", "Sign out everywhere (app)")}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("Загрузка…", "Loading…")}
        </div>
      ) : history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center text-sm text-gray-400">
          {tr("Событий входа пока нет", "No sign-in events yet")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          {history.map((e, i) => (
            <div
              key={e.id}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${i % 2 ? "bg-gray-50/60" : "bg-white"}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Monitor className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <div className="truncate font-medium text-gray-800">
                    {providerLabel(e.provider)} · {typeLabel(e.type)}
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        e.outcome === "success" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                      }`}
                    >
                      {e.outcome === "success" ? tr("успех", "ok") : tr("ошибка", "fail")}
                    </span>
                  </div>
                  <div className="truncate text-xs text-gray-400">{deviceLabel(e.userAgent)}</div>
                </div>
              </div>
              <div className="shrink-0 text-xs tabular-nums text-gray-400">
                {new Date(e.createdAt).toLocaleString(locale, {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
