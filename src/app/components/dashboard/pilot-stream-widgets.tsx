import { useEffect, useState } from "react";
import { useLanguage } from "../../context/language-context";
import { Copy, Check, RefreshCw, Monitor, Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface StreamSettings {
  showHud: boolean;
  width: number;
  height: number;
}

interface TokenResponse {
  token: string;
  settings: StreamSettings;
}

export function PilotStreamWidgets() {
  const { language } = useLanguage();
  const ru = language === "ru";
  const tr = (r: string, e: string) => (ru ? r : e);

  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<StreamSettings>({ showHud: true, width: 1280, height: 720 });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedMap, setCopiedMap] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/pilot/stream-token", { credentials: "include" });
        if (res.ok) {
          const data: TokenResponse = await res.json();
          setToken(data.token);
          setSettings(data.settings);
        }
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const widgetUrl = token ? `${baseUrl}/stream/map?token=${token}` : "";
  const mapOnlyUrl = token ? `${baseUrl}/stream/map?token=${token}&hud=0` : "";

  const copy = async (text: string, which: "full" | "map") => {
    await navigator.clipboard.writeText(text);
    if (which === "full") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else { setCopiedMap(true); setTimeout(() => setCopiedMap(false), 2000); }
  };

  const regenerate = async () => {
    if (!confirm(tr("Старая ссылка перестанет работать. Продолжить?", "The old link will stop working. Continue?"))) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/pilot/stream-token/regenerate", { method: "POST", credentials: "include" });
      if (res.ok) {
        const data: { token: string } = await res.json();
        setToken(data.token);
      }
    } finally {
      setRegenerating(false);
    }
  };

  const saveSettings = async (next: Partial<StreamSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    setSaving(true);
    try {
      await fetch("/api/pilot/stream-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#E31E24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontFamily: "var(--font-display)" }}>
          {tr("Виджеты для стрима", "Stream Widgets")}
        </h2>
        <p className="text-sm text-gray-500">
          {tr(
            "Добавь ссылку в OBS как Browser Source — виджет покажет твой активный рейс в IFE-стиле с картой, телеметрией и трейлом.",
            "Add the URL to OBS as a Browser Source — the widget will show your active flight in IFE style with map, telemetry, and trail."
          )}
        </p>
      </div>

      {/* Preview */}
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-[#04111e] aspect-video relative">
        {token ? (
          <iframe
            src={`${widgetUrl}&_preview=1`}
            className="absolute inset-0 w-full h-full border-0"
            title="Widget preview"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
            {tr("Генерируем токен…", "Generating token…")}
          </div>
        )}
      </div>

      {/* Full widget URL */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {tr("Ссылка с HUD (карта + телеметрия)", "URL with HUD (map + telemetry)")}
        </label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={widgetUrl}
            className="font-mono text-xs bg-gray-50 border-gray-200 text-gray-700"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => copy(widgetUrl, "full")}
            className="shrink-0"
            title={tr("Скопировать", "Copy")}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          {widgetUrl && (
            <Button size="icon" variant="outline" asChild className="shrink-0">
              <a href={widgetUrl} target="_blank" rel="noreferrer" title={tr("Открыть", "Open")}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Map-only URL */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {tr("Только карта (без HUD)", "Map only (no HUD)")}
        </label>
        <div className="flex gap-2">
          <Input
            readOnly
            value={mapOnlyUrl}
            className="font-mono text-xs bg-gray-50 border-gray-200 text-gray-700"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => copy(mapOnlyUrl, "map")}
            className="shrink-0"
          >
            {copiedMap ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {tr("Настройки виджета", "Widget settings")}
        </div>

        {/* HUD toggle */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">{tr("Показывать HUD", "Show HUD")}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {tr("Маршрут, каллсайн, телеметрия", "Route, callsign, telemetry")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => saveSettings({ showHud: !settings.showHud })}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              settings.showHud
                ? "bg-[#E31E24]/10 text-[#E31E24] hover:bg-[#E31E24]/15"
                : "bg-gray-200 text-gray-500 hover:bg-gray-300"
            }`}
          >
            {settings.showHud ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {settings.showHud ? tr("Включён", "On") : tr("Выключен", "Off")}
          </button>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">{tr("Ширина (px)", "Width (px)")}</label>
            <Input
              type="number"
              min={320}
              max={3840}
              value={settings.width}
              onChange={(e) => setSettings((s) => ({ ...s, width: Number(e.target.value) || 1280 }))}
              onBlur={() => saveSettings({})}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">{tr("Высота (px)", "Height (px)")}</label>
            <Input
              type="number"
              min={200}
              max={2160}
              value={settings.height}
              onChange={(e) => setSettings((s) => ({ ...s, height: Number(e.target.value) || 720 }))}
              onBlur={() => saveSettings({})}
              className="text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Monitor className="h-3.5 w-3.5" />
          {tr(
            `Задай эти размеры в настройках Browser Source в OBS (${settings.width}×${settings.height})`,
            `Set these dimensions in OBS Browser Source settings (${settings.width}×${settings.height})`
          )}
        </div>

        {saving && <div className="text-xs text-gray-400">{tr("Сохраняем…", "Saving…")}</div>}
      </div>

      {/* OBS instructions */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">
          {tr("Как добавить в OBS", "How to add to OBS")}
        </div>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>{tr('Добавь источник "Browser Source"', 'Add a "Browser Source" source')}</li>
          <li>{tr("Вставь ссылку в поле URL", "Paste the URL into the URL field")}</li>
          <li>{tr(`Задай размер ${settings.width}×${settings.height}`, `Set size to ${settings.width}×${settings.height}`)}</li>
          <li>{tr('Для прозрачного фона добавь "&bg=transparent" к URL', 'For transparent background add "&bg=transparent" to the URL')}</li>
        </ol>
      </div>

      {/* Regenerate */}
      <div className="pt-2 border-t border-gray-100">
        <Button
          variant="outline"
          size="sm"
          onClick={regenerate}
          disabled={regenerating}
          className="text-gray-500 hover:text-red-600 hover:border-red-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${regenerating ? "animate-spin" : ""}`} />
          {tr("Обновить токен (сбросит ссылку)", "Regenerate token (resets link)")}
        </Button>
      </div>
    </div>
  );
}
