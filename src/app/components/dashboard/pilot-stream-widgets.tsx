import { useEffect, useState } from "react";
import { useLanguage } from "../../context/language-context";
import { useLocation } from "react-router";
import {
  Copy, Check, RefreshCw, Monitor, Eye, EyeOff, ExternalLink,
  Bot, Twitch, Youtube, CheckCircle2, XCircle, Loader2, Unlink,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

// ─── Stream widget types ─────────────────────────────────────────────────────

interface StreamSettings { showHud: boolean; width: number; height: number; }
interface TokenResponse { token: string; settings: StreamSettings; }

// ─── Chatbot types ────────────────────────────────────────────────────────────

interface TwitchConnection { channel: string; displayName?: string; connectedAt?: string; }
interface YoutubeConnection { channelId: string; channelName?: string; connectedAt?: string; }
interface ChatbotSettings {
  twitch: TwitchConnection | null;
  youtube: YoutubeConnection | null;
  enabledPlatforms: string[];
}

const BOT_COMMANDS = [
  { cmd: "!metar <ICAO>", descRu: "Погода/METAR на аэродроме", descEn: "Airport METAR weather" },
  { cmd: "!rank", descRu: "Твой ранг и налёт", descEn: "Your rank and hours" },
  { cmd: "!rank <callsign>", descRu: "Ранг другого пилота", descEn: "Rank of another pilot" },
  { cmd: "!online", descRu: "Кто сейчас летит", descEn: "Who is flying right now" },
  { cmd: "!notam", descRu: "Активные NOTAMы", descEn: "Active NOTAMs" },
  { cmd: "!flight", descRu: "Твой текущий рейс", descEn: "Your current flight" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PilotStreamWidgets() {
  const { language } = useLanguage();
  const location = useLocation();
  const ru = language === "ru";
  const tr = (r: string, e: string) => (ru ? r : e);

  const [activeTab, setActiveTab] = useState<"widgets" | "chatbot">("widgets");

  // Handle redirect back from OAuth
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatbot = params.get("chatbot");
    if (chatbot) {
      setActiveTab("chatbot");
      if (chatbot === "twitch_ok") setChatbotStatus({ type: "success", msg: tr("Twitch подключён!", "Twitch connected!") });
      if (chatbot === "youtube_ok") setChatbotStatus({ type: "success", msg: tr("YouTube подключён!", "YouTube connected!") });
      if (chatbot === "twitch_error") setChatbotStatus({ type: "error", msg: tr("Ошибка подключения Twitch", "Twitch connection error") });
      if (chatbot === "youtube_error") setChatbotStatus({ type: "error", msg: tr("Ошибка подключения YouTube", "YouTube connection error") });
    }
  }, [location.search]);

  // ── Stream widget state ──
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<StreamSettings>({ showHud: true, width: 1280, height: 720 });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedMap, setCopiedMap] = useState(false);

  // ── Chatbot state ──
  const [botSettings, setBotSettings] = useState<ChatbotSettings | null>(null);
  const [botLoading, setBotLoading] = useState(true);
  const [chatbotStatus, setChatbotStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [twitchInput, setTwitchInput] = useState("");
  const [savingTwitch, setSavingTwitch] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/pilot/stream-token", { credentials: "include" });
        if (res.ok) {
          const data: TokenResponse = await res.json();
          setToken(data.token);
          setSettings(data.settings);
        }
      } finally { setLoading(false); }
    };
    void load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/pilot/chatbot-settings", { credentials: "include" });
        if (res.ok) {
          const data: ChatbotSettings = await res.json();
          setBotSettings(data);
          if (data.twitch?.channel) setTwitchInput(data.twitch.channel);
        }
      } finally { setBotLoading(false); }
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
      if (res.ok) { const data: { token: string } = await res.json(); setToken(data.token); }
    } finally { setRegenerating(false); }
  };

  const saveSettings = async (next: Partial<StreamSettings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    setSaving(true);
    try {
      await fetch("/api/pilot/stream-settings", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
    } finally { setSaving(false); }
  };

  const saveTwitchChannel = async () => {
    const ch = twitchInput.trim().toLowerCase().replace(/^#/, "");
    if (!ch) return;
    setSavingTwitch(true);
    setChatbotStatus(null);
    try {
      const res = await fetch("/api/pilot/chatbot-settings", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twitchChannel: ch, enabledPlatforms: [...(botSettings?.enabledPlatforms || []), "twitch"].filter((v, i, a) => a.indexOf(v) === i) }),
      });
      if (res.ok) {
        const data = await res.json();
        setBotSettings(data.settings);
        setChatbotStatus({ type: "success", msg: tr("Канал сохранён. Бот подключается…", "Channel saved. Bot is joining…") });
      }
    } finally { setSavingTwitch(false); }
  };

  const disconnectPlatform = async (platform: "twitch" | "youtube") => {
    setDisconnecting(platform);
    setChatbotStatus(null);
    try {
      const res = await fetch(`/api/pilot/chatbot-settings/${platform}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setBotSettings((prev) => prev ? {
          ...prev,
          [platform]: null,
          enabledPlatforms: prev.enabledPlatforms.filter((p) => p !== platform),
        } : prev);
        if (platform === "twitch") setTwitchInput("");
        setChatbotStatus({ type: "success", msg: tr(`${platform === "twitch" ? "Twitch" : "YouTube"} отключён`, `${platform === "twitch" ? "Twitch" : "YouTube"} disconnected`) });
      }
    } finally { setDisconnecting(null); }
  };

  if (loading && botLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#E31E24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-0">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("widgets")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "widgets" ? "border-[#E31E24] text-[#E31E24]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <Monitor className="h-4 w-4" />
          {tr("Виджеты", "Widgets")}
        </button>
        <button
          onClick={() => setActiveTab("chatbot")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "chatbot" ? "border-[#E31E24] text-[#E31E24]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <Bot className="h-4 w-4" />
          {tr("Чат-бот", "Chat Bot")}
          {botSettings && (botSettings.twitch || botSettings.youtube) ? (
            <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500" />
          ) : null}
        </button>
      </div>

      {/* ── WIDGETS TAB ── */}
      {activeTab === "widgets" && (
        <div className="space-y-6 px-1">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{tr("Виджеты для стрима", "Stream Widgets")}</h2>
            <p className="text-sm text-gray-500">
              {tr("Добавь ссылку в OBS как Browser Source — виджет покажет твой активный рейс в IFE-стиле.", "Add the URL to OBS as a Browser Source — the widget will show your active flight in IFE style.")}
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-200 bg-[#04111e] aspect-video relative">
            {token ? (
              <iframe src={`${widgetUrl}&_preview=1`} className="absolute inset-0 w-full h-full border-0" title="Widget preview" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
                {tr("Генерируем токен…", "Generating token…")}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tr("Ссылка с HUD", "URL with HUD")}</label>
            <div className="flex gap-2">
              <Input readOnly value={widgetUrl} className="font-mono text-xs bg-gray-50" onClick={(e) => (e.target as HTMLInputElement).select()} />
              <Button size="icon" variant="outline" onClick={() => copy(widgetUrl, "full")} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              {widgetUrl && (
                <Button size="icon" variant="outline" asChild className="shrink-0">
                  <a href={widgetUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tr("Только карта (без HUD)", "Map only (no HUD)")}</label>
            <div className="flex gap-2">
              <Input readOnly value={mapOnlyUrl} className="font-mono text-xs bg-gray-50" onClick={(e) => (e.target as HTMLInputElement).select()} />
              <Button size="icon" variant="outline" onClick={() => copy(mapOnlyUrl, "map")} className="shrink-0">
                {copiedMap ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{tr("Настройки виджета", "Widget settings")}</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">{tr("Показывать HUD", "Show HUD")}</div>
                <div className="text-xs text-gray-400 mt-0.5">{tr("Маршрут, позывной, телеметрия", "Route, callsign, telemetry")}</div>
              </div>
              <button type="button" onClick={() => saveSettings({ showHud: !settings.showHud })}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${settings.showHud ? "bg-[#E31E24]/10 text-[#E31E24]" : "bg-gray-200 text-gray-500"}`}>
                {settings.showHud ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {settings.showHud ? tr("Включён", "On") : tr("Выключен", "Off")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">{tr("Ширина (px)", "Width (px)")}</label>
                <Input type="number" min={320} max={3840} value={settings.width}
                  onChange={(e) => setSettings((s) => ({ ...s, width: Number(e.target.value) || 1280 }))}
                  onBlur={() => saveSettings({})} className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">{tr("Высота (px)", "Height (px)")}</label>
                <Input type="number" min={200} max={2160} value={settings.height}
                  onChange={(e) => setSettings((s) => ({ ...s, height: Number(e.target.value) || 720 }))}
                  onBlur={() => saveSettings({})} className="text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Monitor className="h-3.5 w-3.5" />
              {tr(`Задай эти размеры в OBS (${settings.width}×${settings.height})`, `Set these in OBS Browser Source (${settings.width}×${settings.height})`)}
            </div>
            {saving && <div className="text-xs text-gray-400">{tr("Сохраняем…", "Saving…")}</div>}
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-400">{tr("Как добавить в OBS", "How to add to OBS")}</div>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>{tr('Добавь источник "Browser Source"', 'Add a "Browser Source" source')}</li>
              <li>{tr("Вставь ссылку в поле URL", "Paste the URL into the URL field")}</li>
              <li>{tr(`Задай размер ${settings.width}×${settings.height}`, `Set size to ${settings.width}×${settings.height}`)}</li>
              <li>{tr('Для прозрачного фона добавь "&bg=transparent" к URL', 'For transparent background add "&bg=transparent" to URL')}</li>
            </ol>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating} className="text-gray-500 hover:text-red-600 hover:border-red-200">
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${regenerating ? "animate-spin" : ""}`} />
              {tr("Обновить токен (сбросит ссылку)", "Regenerate token (resets link)")}
            </Button>
          </div>
        </div>
      )}

      {/* ── CHATBOT TAB ── */}
      {activeTab === "chatbot" && (
        <div className="space-y-6 px-1">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{tr("Чат-бот NWSBot", "NWSBot Chat Bot")}</h2>
            <p className="text-sm text-gray-500">
              {tr("Подключи бота к своему стриму. Зрители смогут использовать команды прямо в чате.", "Connect the bot to your stream. Viewers can use commands directly in chat.")}
            </p>
          </div>

          {/* Status toast */}
          {chatbotStatus ? (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${chatbotStatus.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {chatbotStatus.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              {chatbotStatus.msg}
            </div>
          ) : null}

          {botLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr("Загрузка…", "Loading…")}
            </div>
          ) : (
            <>
              {/* ── TWITCH ── */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-[#9146FF]/5 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-xl bg-[#9146FF]/10 flex items-center justify-center">
                    <Twitch className="h-5 w-5 text-[#9146FF]" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">Twitch</div>
                    <div className="text-xs text-gray-400">{tr("Бот присоединится к твоему каналу", "Bot will join your channel")}</div>
                  </div>
                  {botSettings?.twitch ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {tr("Подключён", "Connected")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-400">{tr("Не подключён", "Not connected")}</Badge>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  {botSettings?.twitch ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-800">twitch.tv/{botSettings.twitch.displayName || botSettings.twitch.channel}</div>
                        {botSettings.twitch.connectedAt ? (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {tr("Подключён", "Connected")} {new Date(botSettings.twitch.connectedAt).toLocaleDateString()}
                          </div>
                        ) : null}
                      </div>
                      <Button variant="outline" size="sm" disabled={disconnecting === "twitch"} onClick={() => disconnectPlatform("twitch")}
                        className="text-red-600 border-red-200 hover:bg-red-50">
                        {disconnecting === "twitch" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Unlink className="h-3.5 w-3.5 mr-1.5" />}
                        {tr("Отключить", "Disconnect")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        {tr("Войди через Twitch чтобы автоматически привязать канал, или введи имя вручную.", "Sign in with Twitch to auto-link your channel, or enter the name manually.")}
                      </div>
                      <div className="flex gap-2">
                        <Button asChild className="bg-[#9146FF] hover:bg-[#7c2ffc] text-white">
                          <a href="/api/auth/twitch/login">
                            <Twitch className="h-4 w-4 mr-2" />
                            {tr("Войти через Twitch", "Sign in with Twitch")}
                          </a>
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="h-px flex-1 bg-gray-200" />
                        {tr("или введи имя канала вручную", "or enter channel name manually")}
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder={tr("имя_канала", "channel_name")}
                          value={twitchInput}
                          onChange={(e) => setTwitchInput(e.target.value)}
                          className="text-sm"
                          onKeyDown={(e) => { if (e.key === "Enter") void saveTwitchChannel(); }}
                        />
                        <Button onClick={saveTwitchChannel} disabled={savingTwitch || !twitchInput.trim()} className="bg-[#9146FF] hover:bg-[#7c2ffc] text-white shrink-0">
                          {savingTwitch ? <Loader2 className="h-4 w-4 animate-spin" /> : tr("Сохранить", "Save")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── YOUTUBE ── */}
              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-[#FF0000]/5 border-b border-gray-100">
                  <div className="w-9 h-9 rounded-xl bg-[#FF0000]/10 flex items-center justify-center">
                    <Youtube className="h-5 w-5 text-[#FF0000]" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">YouTube</div>
                    <div className="text-xs text-gray-400">{tr("Бот мониторит live-чат твоего канала", "Bot monitors your channel live chat")}</div>
                  </div>
                  {botSettings?.youtube ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {tr("Подключён", "Connected")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-400">{tr("Не подключён", "Not connected")}</Badge>
                  )}
                </div>
                <div className="p-5">
                  {botSettings?.youtube ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-800">{botSettings.youtube.channelName || botSettings.youtube.channelId}</div>
                        {botSettings.youtube.connectedAt ? (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {tr("Подключён", "Connected")} {new Date(botSettings.youtube.connectedAt).toLocaleDateString()}
                          </div>
                        ) : null}
                      </div>
                      <Button variant="outline" size="sm" disabled={disconnecting === "youtube"} onClick={() => disconnectPlatform("youtube")}
                        className="text-red-600 border-red-200 hover:bg-red-50">
                        {disconnecting === "youtube" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Unlink className="h-3.5 w-3.5 mr-1.5" />}
                        {tr("Отключить", "Disconnect")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm text-gray-600">
                        {tr("Войди через Google чтобы бот мог читать live-чат твоего YouTube-канала.", "Sign in with Google so the bot can read your YouTube channel's live chat.")}
                      </div>
                      <Button asChild className="bg-[#FF0000] hover:bg-[#cc0000] text-white">
                        <a href="/api/auth/youtube/login">
                          <Youtube className="h-4 w-4 mr-2" />
                          {tr("Войти через Google / YouTube", "Sign in with Google / YouTube")}
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── COMMANDS ── */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{tr("Доступные команды", "Available commands")}</div>
                <div className="space-y-2">
                  {BOT_COMMANDS.map((c) => (
                    <div key={c.cmd} className="flex items-baseline gap-3">
                      <code className="text-xs font-mono bg-white border border-gray-200 px-2 py-0.5 rounded-md text-[#E31E24] shrink-0">{c.cmd}</code>
                      <span className="text-sm text-gray-500">{ru ? c.descRu : c.descEn}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
