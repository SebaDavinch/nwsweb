import { useEffect, useState } from "react";
import { Radio, RefreshCw, Save, Send, ServerCog, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useLanguage } from "../../context/language-context";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";

interface AcarsSettings {
  enabled: boolean;
  provider: string;
  networkMode: string;
  rolloutStage: string;
  clientName: string;
  clientVersion: string;
  hoppieLogonCode: string;
  selcal: string;
  stationName: string;
  stationCallsign: string;
  callsignPrefix: string;
  dispatchTarget: string;
  positionIntervalSeconds: number;
  telemetryRetentionHours: number;
  autoFilePirep: boolean;
  autoAcceptPirep: boolean;
  enableMessageRelay: boolean;
  enablePositionReports: boolean;
  enableTelemetryBackfill: boolean;
  enableCpdlc: boolean;
  enableTelex: boolean;
  enableClearanceRequests: boolean;
  syncSimbriefRemarks: boolean;
  dispatchIntegrationEnabled: boolean;
  commentsEnabled: boolean;
  notes: string;
  updatedAt?: string | null;
}

interface AcarsSummary {
  hoppieTransportStatus?: string;
  hoppieTransportReachable?: boolean;
  lastHoppieProbeAt?: string | number | null;
  lastHoppieProbeRoute?: string | null;
  lastHoppieProbeMessage?: string | null;
  recentHoppieTransactions?: number;
}

interface HoppieLogEntry {
  id: string;
  requestedAt: string;
  action: string;
  from: string;
  to: string;
  type: string;
  packet: string;
  ok: boolean;
  responseStatus: string;
  responsePayload: string;
  httpStatus: number;
}

interface HoppieActionResponse {
  ok?: boolean;
  error?: string;
  summary?: AcarsSummary;
  result?: {
    response?: {
      status?: string;
      payload?: string;
    };
  };
}

const DEFAULT_SETTINGS: AcarsSettings = {
  enabled: true,
  provider: "custom-hoppie",
  networkMode: "production",
  rolloutStage: "planning",
  clientName: "Nordwind ACARS",
  clientVersion: "0.1",
  hoppieLogonCode: "",
  selcal: "",
  stationName: "Nordwind Virtual Operations",
  stationCallsign: "VNWS",
  callsignPrefix: "NWS",
  dispatchTarget: "NWSDISP",
  positionIntervalSeconds: 15,
  telemetryRetentionHours: 24,
  autoFilePirep: false,
  autoAcceptPirep: false,
  enableMessageRelay: true,
  enablePositionReports: true,
  enableTelemetryBackfill: true,
  enableCpdlc: true,
  enableTelex: true,
  enableClearanceRequests: true,
  syncSimbriefRemarks: true,
  dispatchIntegrationEnabled: true,
  commentsEnabled: true,
  notes: "",
  updatedAt: null,
};

const HOPPIE_LOGON_PATTERN = /^[A-Za-z0-9]{8,32}$/;

const formatTimestamp = (value?: string | number | null) => {
  if (!value) return "—";
  const timestamp = typeof value === "number" ? value : Date.parse(String(value));
  if (!Number.isFinite(timestamp)) return String(value);
  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function AdminAcars() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const [settings, setSettings] = useState<AcarsSettings>(DEFAULT_SETTINGS);
  const [summary, setSummary] = useState<AcarsSummary>({});
  const [transportLog, setTransportLog] = useState<HoppieLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningPing, setIsRunningPing] = useState(false);
  const [isRunningPoll, setIsRunningPoll] = useState(false);
  const [isSendingPacket, setIsSendingPacket] = useState(false);
  const [packetType, setPacketType] = useState("telex");
  const [packetFrom, setPacketFrom] = useState(DEFAULT_SETTINGS.stationCallsign);
  const [packetTo, setPacketTo] = useState(DEFAULT_SETTINGS.dispatchTarget);
  const [packetBody, setPacketBody] = useState("");

  const loadAcars = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/acars", { credentials: "include" });
      const payload = response.ok ? await response.json() : null;
      const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...(payload?.settings && typeof payload.settings === "object" ? payload.settings : {}),
      };
      setSettings(nextSettings);
      setSummary(payload?.summary && typeof payload.summary === "object" ? payload.summary : {});
      setPacketFrom(nextSettings.stationCallsign || DEFAULT_SETTINGS.stationCallsign);
      setPacketTo(nextSettings.dispatchTarget || DEFAULT_SETTINGS.dispatchTarget);
    } catch {
      toast.error(tr("Не удалось загрузить настройки ACARS", "Failed to load ACARS settings"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAcars();
  }, []);

  const loadHoppieLog = async () => {
    try {
      const response = await fetch("/api/admin/acars/hoppie/log", { credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) return;
      setTransportLog(Array.isArray(payload?.entries) ? payload.entries : []);
      if (payload?.summary && typeof payload.summary === "object") {
        setSummary(payload.summary);
      }
    } catch {
      // silent
    }
  };

  useEffect(() => {
    void loadHoppieLog();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/acars", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(String(payload?.error || "Failed to save"));
      if (payload?.settings) setSettings({ ...DEFAULT_SETTINGS, ...payload.settings });
      if (payload?.summary) setSummary(payload.summary);
      toast.success(tr("Настройки ACARS сохранены", "ACARS settings saved"));
    } catch (error) {
      toast.error(String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const runHoppieAction = async (endpoint: string, body: Record<string, unknown>) => {
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as HoppieActionResponse | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(String(payload?.error || payload?.result?.response?.payload || "Hoppie action failed"));
    }
    if (payload?.summary && typeof payload.summary === "object") setSummary(payload.summary);
    await loadHoppieLog();
    return payload;
  };

  const handlePing = async () => {
    setIsRunningPing(true);
    try {
      const payload = await runHoppieAction("/api/admin/acars/hoppie/ping", {
        from: packetFrom || settings.stationCallsign,
        packet: packetTo || settings.dispatchTarget || "ALL-CALLSIGNS",
      });
      toast.success(String(payload?.result?.response?.payload || "Hoppie ping succeeded"));
    } catch (error) {
      toast.error(String(error));
    } finally {
      setIsRunningPing(false);
    }
  };

  const handlePoll = async () => {
    setIsRunningPoll(true);
    try {
      const payload = await runHoppieAction("/api/admin/acars/hoppie/poll", {
        from: packetFrom || settings.stationCallsign,
      });
      toast.success(String(payload?.result?.response?.payload || "Hoppie poll completed"));
    } catch (error) {
      toast.error(String(error));
    } finally {
      setIsRunningPoll(false);
    }
  };

  const handleSendPacket = async () => {
    setIsSendingPacket(true);
    try {
      const payload = await runHoppieAction("/api/admin/acars/hoppie/message", {
        type: packetType,
        from: packetFrom || settings.stationCallsign,
        to: packetType === "ping" || packetType === "poll" ? "SERVER" : packetTo || settings.dispatchTarget,
        packet: packetBody,
      });
      toast.success(String(payload?.result?.response?.payload || "Hoppie packet sent"));
      if (packetType !== "poll" && packetType !== "ping") setPacketBody("");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setIsSendingPacket(false);
    }
  };

  const isConfigured = HOPPIE_LOGON_PATTERN.test(settings.hoppieLogonCode.trim());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">{tr("АКАРС", "ACARS")}</h2>
        <p className="text-sm text-gray-500">{tr("Подключение к сети Hoppie ACARS.", "Hoppie ACARS network connection.")}</p>
      </div>

      {/* Config */}
      <Card className="border-none shadow-sm">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{tr("Hoppie logon code", "Hoppie logon code")}</Label>
            <p className="text-xs text-gray-500">{tr("Получите на hoppie.nl. Это единственное поле, которое нужно заполнить.", "Get it at hoppie.nl — this is the only field you need to fill in.")}</p>
            <Input
              value={settings.hoppieLogonCode}
              onChange={(e) => setSettings((s) => ({ ...s, hoppieLogonCode: e.target.value.trim() }))}
              placeholder="MqNSJbrUYMNrx9EP"
              className="font-mono text-sm"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5">
            <span className="text-xs text-gray-500">{tr("Позывной станции", "Station callsign")}</span>
            <span className="font-mono text-sm font-semibold text-gray-800">{settings.stationCallsign || "VNWS"}</span>
          </div>

          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={isConfigured ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}
            >
              {isConfigured ? tr("Настроен", "Configured") : tr("Требует logon code", "Needs logon code")}
            </Badge>
            <Button onClick={saveSettings} disabled={isSaving || isLoading}>
              <Save className="mr-2 h-4 w-4" />
              {tr("Сохранить", "Save")}
            </Button>
          </div>

          <Separator />

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-800 select-none">
              <ServerCog className="h-4 w-4 transition-transform group-open:rotate-90" />
              {tr("Расширенные настройки", "Advanced settings")}
            </summary>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tr("Позывной станции", "Station callsign")}</Label>
                  <Input value={settings.stationCallsign} onChange={(e) => setSettings((s) => ({ ...s, stationCallsign: e.target.value.trim().toUpperCase() }))} placeholder="VNWS" />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Dispatch target", "Dispatch target")}</Label>
                  <Input value={settings.dispatchTarget} onChange={(e) => setSettings((s) => ({ ...s, dispatchTarget: e.target.value.trim().toUpperCase() }))} placeholder="NWSDISP" />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Префикс позывного", "Callsign prefix")}</Label>
                  <Input value={settings.callsignPrefix} onChange={(e) => setSettings((s) => ({ ...s, callsignPrefix: e.target.value.trim().toUpperCase() }))} placeholder="NWS" />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Имя клиента", "Client name")}</Label>
                  <Input value={settings.clientName} onChange={(e) => setSettings((s) => ({ ...s, clientName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Интервал позиций, сек", "Position interval, sec")}</Label>
                  <Input type="number" min={5} max={120} value={settings.positionIntervalSeconds} onChange={(e) => setSettings((s) => ({ ...s, positionIntervalSeconds: Math.max(5, Number(e.target.value) || 15) }))} />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Хранение телеметрии, ч", "Telemetry retention, hours")}</Label>
                  <Input type="number" min={1} max={168} value={settings.telemetryRetentionHours} onChange={(e) => setSettings((s) => ({ ...s, telemetryRetentionHours: Math.max(1, Number(e.target.value) || 24) }))} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ["enabled", tr("Профиль активен", "Profile enabled")],
                  ["enableTelemetryBackfill", tr("Backfill телеметрии", "Telemetry backfill")],
                  ["enableTelex", "TELEX"],
                  ["enableCpdlc", "CPDLC"],
                  ["enablePositionReports", tr("Position reports", "Position reports")],
                  ["autoFilePirep", tr("Автоподача PIREP", "Auto-file PIREP")],
                ] as [keyof AcarsSettings, string][]).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                    <Label className="text-sm font-normal">{label}</Label>
                    <Switch
                      checked={Boolean(settings[key])}
                      onCheckedChange={(checked) => setSettings((s) => ({ ...s, [key]: checked }))}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={isSaving || isLoading} variant="outline" size="sm">
                  <Save className="mr-2 h-3.5 w-3.5" />
                  {tr("Сохранить", "Save")}
                </Button>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Transport tools */}
      {isConfigured && (
        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{tr("Инструменты транспорта Hoppie", "Hoppie transport tools")}</h3>
                <p className="text-sm text-gray-500">{tr("Пинг, проверка inbox и ручная отправка пакетов.", "Ping, poll inbox, and manual packet sending.")}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tr("От позывного", "From callsign")}</Label>
                <Input value={packetFrom} onChange={(e) => setPacketFrom(e.target.value.trim().toUpperCase())} placeholder="VNWS" />
              </div>
              <div className="space-y-2">
                <Label>{tr("К позывному", "To callsign")}</Label>
                <Input value={packetTo} onChange={(e) => setPacketTo(e.target.value.trim().toUpperCase())} placeholder="NWSDISP" />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handlePing} disabled={isRunningPing || isLoading}>
                <Radio className={`mr-2 h-4 w-4 ${isRunningPing ? "animate-pulse" : ""}`} />
                {tr("Пинг Hoppie", "Ping Hoppie")}
              </Button>
              <Button variant="outline" onClick={handlePoll} disabled={isRunningPoll || isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRunningPoll ? "animate-spin" : ""}`} />
                {tr("Проверить inbox", "Poll inbox")}
              </Button>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="space-y-2">
                <Label>{tr("Тип пакета", "Packet type")}</Label>
                <Select value={packetType} onValueChange={setPacketType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telex">TELEX</SelectItem>
                    <SelectItem value="cpdlc">CPDLC</SelectItem>
                    <SelectItem value="progress">Progress</SelectItem>
                    <SelectItem value="position">Position</SelectItem>
                    <SelectItem value="posreq">PosReq</SelectItem>
                    <SelectItem value="datareq">DataReq</SelectItem>
                    <SelectItem value="ping">Ping</SelectItem>
                    <SelectItem value="poll">Poll</SelectItem>
                    <SelectItem value="peek">Peek</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr("Payload пакета", "Packet payload")}</Label>
                <Textarea
                  value={packetBody}
                  onChange={(e) => setPacketBody(e.target.value)}
                  rows={5}
                  placeholder={
                    packetType === "telex"
                      ? tr("Тестовое сообщение в dispatch или ATC", "Test message to dispatch or ATC")
                      : tr("Тело пакета", "Packet body")
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-500">
                {summary.lastHoppieProbeMessage && (
                  <span>{tr("Последний ответ: ", "Last response: ")}<span className="font-mono">{summary.lastHoppieProbeMessage}</span></span>
                )}
              </div>
              <Button onClick={handleSendPacket} disabled={isSendingPacket || isLoading}>
                <Send className="mr-2 h-4 w-4" />
                {tr("Отправить пакет", "Send packet")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transport log */}
      {isConfigured && (
        <Card className="border-none shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{tr("Журнал транзакций Hoppie", "Hoppie transaction log")}</h3>
                <p className="text-sm text-gray-500">{tr("Последние ping, poll и send действия.", "Recent ping, poll, and send actions.")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  {Number(summary.recentHoppieTransactions || transportLog.length)} {tr("запросов", "requests")}
                </Badge>
                <Button variant="outline" size="sm" onClick={loadHoppieLog}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {transportLog.length > 0 ? transportLog.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={entry.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>
                      {entry.responseStatus || (entry.ok ? "ok" : tr("ошибка", "error"))}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{entry.type}</Badge>
                    <span className="text-xs text-gray-500">{formatTimestamp(entry.requestedAt)}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-gray-900">{entry.from} → {entry.to || "SERVER"}</div>
                  {entry.packet ? <pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{entry.packet}</pre> : null}
                  <div className="mt-2 text-sm text-gray-600">{entry.responsePayload || tr("Payload не вернулся.", "No payload returned.")}</div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  {tr("Действия Hoppie пока не выполнялись.", "No Hoppie actions have been executed yet.")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
