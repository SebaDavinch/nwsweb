import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCopy, Radio, RefreshCw, Save, Send, ServerCog, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
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
  providerReady?: boolean;
  operationsCredentialsConfigured?: boolean;
  pilotApiConfigured?: boolean;
  telemetryHistoryEntries?: number;
  telemetryBackfillEntries?: number;
  activeFlights?: number;
  diskCacheEnabled?: boolean;
  diskCacheLastPersistAt?: string | number | null;
  telemetryHistoryTtlHours?: number;
  telemetryPointCap?: number;
  rolloutStage?: string;
  hoppieLogonConfigured?: boolean;
  hoppieLogonValid?: boolean;
  selcalConfigured?: boolean;
  selcalValid?: boolean;
  stationConfigured?: boolean;
  stationValid?: boolean;
  dispatchTargetConfigured?: boolean;
  dispatchTargetValid?: boolean;
  callsignPrefixValid?: boolean;
  missingItems?: string[];
  capabilities?: string[];
  bootstrapReady?: boolean;
  hoppieTransportStatus?: string;
  hoppieTransportReachable?: boolean;
  lastHoppieProbeAt?: string | null;
  lastHoppieProbeRoute?: string | null;
  lastHoppieProbeMessage?: string | null;
  recentHoppieTransactions?: number;
  bootstrapPreview?: Record<string, unknown>;
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

interface HoppieLogPayload {
  entries?: HoppieLogEntry[];
  summary?: AcarsSummary;
}

interface HoppieActionResponse {
  ok?: boolean;
  error?: string;
  summary?: AcarsSummary;
  result?: {
    response?: {
      status?: string;
      payload?: string;
      raw?: string;
    };
  };
}

interface VacDispatchBooking {
  bookingId: number;
  pilotId: number;
  pilotName: string;
  pilotUsername: string;
  callsign: string;
  vacCode: string;
  callsignEligible: boolean;
  routeLabel: string;
  departure: string;
  arrival: string;
  aircraftLabel: string;
  departureTime: string;
  createdAt: string;
  status: string;
  priority: string;
  tag: string;
  notes: string;
  liveTracked?: boolean;
  etd?: string;
  eta?: string;
  ete?: string;
  currentPhase?: string;
  vatsimOnline?: boolean;
  hoppieOnline?: boolean;
  availableForMessages?: boolean;
  hoppieConnected?: string;
  hoppieStatusNote?: string;
}

interface VacNetworkFlight {
  id: string;
  cid: number;
  callsign: string;
  vacCode: string;
  vatsimOnline: boolean;
  pilotName: string;
  departure: string;
  arrival: string;
  routeLabel: string;
  aircraft: string;
  groundspeed: number | null;
  altitude: number | null;
  heading: number | null;
  onlineSince: string;
  lastUpdated: string;
  matchedBookingId: number;
  matchedBookingStatus: string;
  matchedBookingRoute: string;
  hoppieOnline: boolean;
  availableForMessages: boolean;
  hoppieConnected: string;
  hoppieMessagesSeen: number | null;
  hoppieMessageRate: number | null;
  hoppieNote: string;
  remarks: string;
}

interface VacNetworkPayload {
  items?: VacNetworkFlight[];
  summary?: {
    onlineVacFlights?: number;
    matchedBookings?: number;
    hoppieOnline?: number;
    availableForMessages?: number;
    updatedAt?: string;
    prefixes?: string[];
  };
}

interface VacDispatchLogEntry {
  id: string;
  requestedAt: string;
  mode: string;
  bookingId: number;
  templateId: string;
  from: string;
  to: string;
  callsign: string;
  vacCode: string;
  pilotName: string;
  routeLabel: string;
  packet: string;
  ok: boolean;
  responseStatus: string;
  responsePayload: string;
  activityId: string;
}

interface VacMessageTemplate {
  id: string;
  title: string;
  code: string;
  category: string;
  description: string;
  body: string;
  active: boolean;
  order: number;
  updatedAt?: string;
}

interface VacDispatchPayload {
  bookings?: VacDispatchBooking[];
  templates?: VacMessageTemplate[];
  allowedPrefixes?: string[];
  placeholders?: string[];
  summary?: {
    totalBookings?: number;
    eligibleBookings?: number;
    blockedBookings?: number;
    activeTemplates?: number;
    transportStatus?: string;
    vatsimOnline?: number;
    availableForMessages?: number;
  };
}

const DEFAULT_VAC_TEMPLATE: VacMessageTemplate = {
  id: "",
  title: "",
  code: "",
  category: "arrival",
  description: "",
  body: "{{callsign}} ARRIVAL STAND {{stand}}.",
  active: true,
  order: 10,
  updatedAt: "",
};

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
  stationCallsign: "NWSOPS",
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

const HOPPIE_LOGON_PATTERN = /^[A-Z0-9]{4,12}$/;
const SELCAL_PATTERN = /^[A-Z]{2}-?[A-Z]{2}$/;
const CALLSIGN_PATTERN = /^[A-Z0-9]{3,10}$/;
const PREFIX_PATTERN = /^[A-Z0-9]{2,4}$/;

const formatTimestamp = (value?: string | number | null) => {
  if (!value) {
    return "—";
  }

  const timestamp = typeof value === "number" ? value : Date.parse(String(value));
  if (!Number.isFinite(timestamp)) {
    return String(value);
  }

  return new Date(timestamp).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const labelRolloutStage = (value?: string, language: "ru" | "en" = "en") => {
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  switch (value) {
    case "internal":
      return tr("Внутренний", "Internal");
    case "beta":
      return tr("Бета", "Beta");
    case "live":
      return tr("Прод", "Live");
    default:
      return tr("Планирование", "Planning");
  }
};

const buildCapabilities = (settings: AcarsSettings) =>
  [
    settings.enableTelex ? "TELEX" : null,
    settings.enableCpdlc ? "CPDLC" : null,
    settings.enableClearanceRequests ? "CLEARANCE" : null,
    settings.enablePositionReports ? "POSREP" : null,
    settings.enableMessageRelay ? "MESSAGE RELAY" : null,
    settings.autoFilePirep ? "AUTO PIREP" : null,
    settings.syncSimbriefRemarks ? "SIMBRIEF REMARKS" : null,
  ].filter((value): value is string => Boolean(value));

const buildMissingItems = (settings: AcarsSettings, language: "ru" | "en" = "en") => {
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const missingItems: string[] = [];
  const normalizedLogon = settings.hoppieLogonCode.trim().toUpperCase();
  const normalizedSelcal = settings.selcal.trim().toUpperCase();
  const normalizedStationCallsign = settings.stationCallsign.trim().toUpperCase();
  const normalizedDispatchTarget = settings.dispatchTarget.trim().toUpperCase();
  const normalizedCallsignPrefix = settings.callsignPrefix.trim().toUpperCase();

  if (!settings.enabled) {
    missingItems.push(tr("Включите профиль перед запуском", "Enable the profile before rollout"));
  }
  if (!normalizedLogon) {
    missingItems.push(tr("Добавьте Hoppie logon code", "Add the Hoppie logon code"));
  } else if (!HOPPIE_LOGON_PATTERN.test(normalizedLogon)) {
    missingItems.push(tr("Укажите корректный Hoppie logon code", "Use a valid Hoppie logon code"));
  }
  if (!normalizedSelcal) {
    missingItems.push(tr("Добавьте код SELCAL", "Add the aircraft SELCAL code"));
  } else if (!SELCAL_PATTERN.test(normalizedSelcal)) {
    missingItems.push(tr("Используйте формат SELCAL AB-CD", "Use SELCAL in AB-CD format"));
  }
  if (!normalizedStationCallsign) {
    missingItems.push(tr("Добавьте station callsign", "Add the station callsign"));
  } else if (!CALLSIGN_PATTERN.test(normalizedStationCallsign)) {
    missingItems.push(tr("Укажите корректный station callsign", "Use a valid station callsign"));
  }
  if (!normalizedDispatchTarget) {
    missingItems.push(tr("Добавьте dispatch target logon", "Add the dispatch target logon"));
  } else if (!CALLSIGN_PATTERN.test(normalizedDispatchTarget)) {
    missingItems.push(tr("Укажите корректный dispatch target logon", "Use a valid dispatch target logon"));
  }
  if (!normalizedCallsignPrefix) {
    missingItems.push(tr("Добавьте префикс позывного рейса", "Add the flight callsign prefix"));
  } else if (!PREFIX_PATTERN.test(normalizedCallsignPrefix)) {
    missingItems.push(tr("Укажите корректный префикс позывного", "Use a valid flight callsign prefix"));
  }
  if (!settings.enableTelex && !settings.enableCpdlc && !settings.enablePositionReports) {
    missingItems.push(tr("Включите хотя бы один канал сообщений Hoppie", "Enable at least one Hoppie message capability"));
  }

  return missingItems;
};

const buildBootstrapPreview = (settings: AcarsSettings) => ({
  provider: settings.provider,
  networkMode: settings.networkMode,
  rolloutStage: settings.rolloutStage,
  client: {
    name: settings.clientName,
    version: settings.clientVersion,
  },
  hoppie: {
    logonCode: settings.hoppieLogonCode.trim().toUpperCase(),
    selcal: settings.selcal.trim().toUpperCase(),
    stationName: settings.stationName.trim(),
    stationCallsign: settings.stationCallsign.trim().toUpperCase(),
    dispatchTarget: settings.dispatchTarget.trim().toUpperCase(),
    callsignPrefix: settings.callsignPrefix.trim().toUpperCase(),
    capabilities: buildCapabilities(settings),
  },
  telemetry: {
    positionIntervalSeconds: settings.positionIntervalSeconds,
    retentionHours: settings.telemetryRetentionHours,
    backfillEnabled: settings.enableTelemetryBackfill,
  },
  pirep: {
    autoFile: settings.autoFilePirep,
    autoAccept: settings.autoAcceptPirep,
    commentsEnabled: settings.commentsEnabled,
    syncSimbriefRemarks: settings.syncSimbriefRemarks,
  },
  dispatch: {
    integrationEnabled: settings.dispatchIntegrationEnabled,
    messageRelayEnabled: settings.enableMessageRelay,
  },
  flightCallsignExample: settings.callsignPrefix.trim() ? `${settings.callsignPrefix.trim().toUpperCase()}1234` : "",
});

const renderVacTemplateText = (templateText: string, context: Record<string, string>) =>
  String(templateText || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => context[key] ?? "").trim();

function AcarsSubmenuSection({
  value,
  title,
  description,
  summary,
  children,
}: {
  value: string;
  title: string;
  description: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <AccordionTrigger className="px-5 py-4 hover:no-underline">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">{title}</div>
            <div className="mt-1 text-xs text-gray-500">{description}</div>
          </div>
          {summary ? (
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {summary}
            </Badge>
          ) : null}
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-gray-100 px-0 pb-0">{children}</AccordionContent>
    </AccordionItem>
  );
}

export function AdminAcars() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [settings, setSettings] = useState<AcarsSettings>(DEFAULT_SETTINGS);
  const [summary, setSummary] = useState<AcarsSummary>({});
  const [transportLog, setTransportLog] = useState<HoppieLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningPing, setIsRunningPing] = useState(false);
  const [isRunningPoll, setIsRunningPoll] = useState(false);
  const [isSendingPacket, setIsSendingPacket] = useState(false);
  const [packetType, setPacketType] = useState("telex");
  const [packetFrom, setPacketFrom] = useState(DEFAULT_SETTINGS.stationCallsign);
  const [packetTo, setPacketTo] = useState(DEFAULT_SETTINGS.dispatchTarget);
  const [packetBody, setPacketBody] = useState("");
  const [dispatchBookings, setDispatchBookings] = useState<VacDispatchBooking[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<VacMessageTemplate[]>([]);
  const [allowedVacPrefixes, setAllowedVacPrefixes] = useState<string[]>(["KAR", "NWS", "STW"]);
  const [vacPlaceholders, setVacPlaceholders] = useState<string[]>([]);
  const [dispatchSummary, setDispatchSummary] = useState<VacDispatchPayload["summary"]>({});
  const [dispatchSearch, setDispatchSearch] = useState("");
  const [dispatchFilter, setDispatchFilter] = useState("eligible");
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateDraft, setTemplateDraft] = useState<VacMessageTemplate>(DEFAULT_VAC_TEMPLATE);
  const [vacStand, setVacStand] = useState("");
  const [vacNote, setVacNote] = useState("");
  const [spontaneousTarget, setSpontaneousTarget] = useState("");
  const [spontaneousMessage, setSpontaneousMessage] = useState("");
  const [networkFlights, setNetworkFlights] = useState<VacNetworkFlight[]>([]);
  const [networkSummary, setNetworkSummary] = useState<VacNetworkPayload["summary"]>({});
  const [dispatchLogEntries, setDispatchLogEntries] = useState<VacDispatchLogEntry[]>([]);
  const [isLoadingVacDispatch, setIsLoadingVacDispatch] = useState(false);
  const [isLoadingVacNetwork, setIsLoadingVacNetwork] = useState(false);
  const [isLoadingVacDispatchLog, setIsLoadingVacDispatchLog] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [isSendingVacMessage, setIsSendingVacMessage] = useState(false);
  const [isSendingSpontaneous, setIsSendingSpontaneous] = useState(false);

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
    } catch (error) {
      console.error("Failed to load ACARS settings", error);
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
      const payload = (await response.json().catch(() => null)) as HoppieLogPayload | null;
      if (!response.ok) {
        return;
      }
      setTransportLog(Array.isArray(payload?.entries) ? payload.entries : []);
      if (payload?.summary && typeof payload.summary === "object") {
        setSummary(payload.summary);
      }
    } catch (error) {
      console.error("Failed to load Hoppie log", error);
    }
  };

  useEffect(() => {
    void loadHoppieLog();
  }, []);

  const loadVacDispatch = async () => {
    setIsLoadingVacDispatch(true);
    try {
      const response = await fetch("/api/admin/acars/vac/dispatch", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as VacDispatchPayload | null;
      if (!response.ok) {
        throw new Error("Failed to load VAC dispatch catalog");
      }

      const nextBookings = Array.isArray(payload?.bookings) ? payload.bookings : [];
      const nextTemplates = Array.isArray(payload?.templates) ? payload.templates : [];
      setDispatchBookings(nextBookings);
      setMessageTemplates(nextTemplates);
      setAllowedVacPrefixes(Array.isArray(payload?.allowedPrefixes) && payload.allowedPrefixes.length > 0 ? payload.allowedPrefixes : ["KAR", "NWS", "STW"]);
      setVacPlaceholders(Array.isArray(payload?.placeholders) ? payload.placeholders : []);
      setDispatchSummary(payload?.summary && typeof payload.summary === "object" ? payload.summary : {});

      if (nextBookings.length > 0) {
        setSelectedBookingId((current) => {
          if (current && nextBookings.some((item) => item.bookingId === current)) {
            return current;
          }
          return (nextBookings.find((item) => item.callsignEligible) || nextBookings[0]).bookingId;
        });
      } else {
        setSelectedBookingId(null);
      }

      if (nextTemplates.length > 0) {
        const preferred = nextTemplates.find((item) => item.id === selectedTemplateId) || nextTemplates.find((item) => item.active) || nextTemplates[0];
        setSelectedTemplateId(preferred.id);
        setTemplateDraft(preferred);
      } else {
        setSelectedTemplateId("");
        setTemplateDraft(DEFAULT_VAC_TEMPLATE);
      }
    } catch (error) {
      console.error("Failed to load VAC dispatch catalog", error);
      toast.error(tr("Не удалось загрузить каталог VAC dispatch", "Failed to load VAC dispatch catalog"));
    } finally {
      setIsLoadingVacDispatch(false);
    }
  };

  useEffect(() => {
    void loadVacDispatch();
  }, []);

  const loadVacNetwork = async () => {
    setIsLoadingVacNetwork(true);
    try {
      const response = await fetch("/api/admin/acars/vac/network", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as VacNetworkPayload | null;
      if (!response.ok) {
        throw new Error("Failed to load VAC network monitor");
      }

      setNetworkFlights(Array.isArray(payload?.items) ? payload.items : []);
      setNetworkSummary(payload?.summary && typeof payload.summary === "object" ? payload.summary : {});
    } catch (error) {
      console.error("Failed to load VAC network monitor", error);
      toast.error(tr("Не удалось загрузить монитор сети VAC", "Failed to load VAC network monitor"));
    } finally {
      setIsLoadingVacNetwork(false);
    }
  };

  useEffect(() => {
    void loadVacNetwork();
  }, []);

  const loadVacDispatchLog = async () => {
    setIsLoadingVacDispatchLog(true);
    try {
      const response = await fetch("/api/admin/acars/vac/log", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as { entries?: VacDispatchLogEntry[] } | null;
      if (!response.ok) {
        throw new Error("Failed to load VAC dispatch log");
      }

      setDispatchLogEntries(Array.isArray(payload?.entries) ? payload.entries : []);
    } catch (error) {
      console.error("Failed to load VAC dispatch log", error);
      toast.error(tr("Не удалось загрузить журнал VAC dispatch", "Failed to load VAC dispatch log"));
    } finally {
      setIsLoadingVacDispatchLog(false);
    }
  };

  useEffect(() => {
    void loadVacDispatchLog();
  }, []);

  const draftCapabilities = useMemo(() => buildCapabilities(settings), [settings]);
  const draftMissingItems = useMemo(() => buildMissingItems(settings, language), [language, settings]);
  const draftBootstrapPreview = useMemo(() => buildBootstrapPreview(settings), [settings]);
  const bootstrapPreviewText = useMemo(
    () => JSON.stringify(summary.bootstrapPreview || draftBootstrapPreview, null, 2),
    [draftBootstrapPreview, summary.bootstrapPreview]
  );
  const selectedDispatchBooking = useMemo(
    () => dispatchBookings.find((item) => item.bookingId === selectedBookingId) || null,
    [dispatchBookings, selectedBookingId]
  );
  const filteredDispatchBookings = useMemo(() => {
    const query = dispatchSearch.trim().toLowerCase();
    return dispatchBookings.filter((item) => {
      const haystack = [item.callsign, item.pilotName, item.pilotUsername, item.routeLabel, item.departure, item.arrival, item.aircraftLabel, item.currentPhase, item.eta, item.ete]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const normalizedFilter = dispatchFilter.toUpperCase();
      const matchesFilter =
        dispatchFilter === "all" ||
        (dispatchFilter === "eligible" && item.callsignEligible) ||
        (dispatchFilter === "blocked" && !item.callsignEligible) ||
        item.vacCode === normalizedFilter;
      return matchesQuery && matchesFilter;
    });
  }, [dispatchBookings, dispatchFilter, dispatchSearch]);
  const vacPreviewContext = useMemo(() => {
    const now = new Date();
    return {
      callsign: selectedDispatchBooking?.callsign || "",
      flightNumber: selectedDispatchBooking?.callsign || "",
      vac: selectedDispatchBooking?.vacCode || "",
      pilotName: selectedDispatchBooking?.pilotName || "Pilot",
      pilotUsername: selectedDispatchBooking?.pilotUsername || "",
      departure: selectedDispatchBooking?.departure || "",
      arrival: selectedDispatchBooking?.arrival || "",
      route: selectedDispatchBooking?.departure && selectedDispatchBooking?.arrival ? `${selectedDispatchBooking.departure}-${selectedDispatchBooking.arrival}` : (selectedDispatchBooking?.routeLabel || ""),
      aircraft: selectedDispatchBooking?.aircraftLabel || "",
      stand: vacStand.trim().toUpperCase(),
      gate: vacStand.trim().toUpperCase(),
      note: vacNote.trim(),
      stationCallsign: (packetFrom || settings.stationCallsign || "").trim().toUpperCase(),
      dispatchTarget: (settings.dispatchTarget || "").trim().toUpperCase(),
      date: now.toISOString().slice(0, 10),
      time: now.toISOString().slice(11, 16),
    };
  }, [packetFrom, selectedDispatchBooking, settings.dispatchTarget, settings.stationCallsign, vacNote, vacStand]);
  const vacPreviewText = useMemo(
    () => renderVacTemplateText(templateDraft.body, vacPreviewContext),
    [templateDraft.body, vacPreviewContext]
  );
  const spontaneousResolvedTarget = useMemo(
    () => (spontaneousTarget.trim() || selectedDispatchBooking?.callsign || "").trim().toUpperCase(),
    [selectedDispatchBooking?.callsign, spontaneousTarget]
  );

  const summaryBadges = useMemo(
    () => [
      {
        label: "Bootstrap",
        value: draftMissingItems.length === 0 ? tr("Готов", "Ready") : tr("Требует настройки", "Needs setup"),
        className: draftMissingItems.length === 0 ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700",
      },
      {
        label: tr("Этап", "Rollout"),
        value: labelRolloutStage(settings.rolloutStage || summary.rolloutStage, language),
        className: "border-slate-200 bg-slate-50 text-slate-700",
      },
      {
        label: tr("Operations API", "Operations API"),
        value: summary.operationsCredentialsConfigured ? tr("Подключен", "Configured") : tr("Отсутствует", "Missing"),
        className: summary.operationsCredentialsConfigured ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700",
      },
      {
        label: tr("Pilot API", "Pilot API"),
        value: summary.pilotApiConfigured ? tr("Подключен", "Connected") : tr("Не связан", "Not linked"),
        className: summary.pilotApiConfigured ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700",
      },
      {
        label: tr("Кэш телеметрии", "Telemetry cache"),
        value: `${Number(summary.telemetryHistoryEntries || 0)} ${tr("live", "live")} / ${Number(summary.telemetryBackfillEntries || 0)} ${tr("backfill", "backfill")}`,
        className: "border-slate-200 bg-slate-50 text-slate-700",
      },
      {
        label: tr("Транспорт", "Transport"),
        value:
          summary.hoppieTransportStatus === "ok"
            ? tr("Доступен", "Reachable")
            : summary.hoppieTransportStatus || tr("Ожидание", "Idle"),
        className: summary.hoppieTransportReachable ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-700",
      },
    ],
    [draftMissingItems.length, language, settings.rolloutStage, summary.hoppieTransportReachable, summary.hoppieTransportStatus, summary.operationsCredentialsConfigured, summary.pilotApiConfigured, summary.rolloutStage, summary.telemetryBackfillEntries, summary.telemetryHistoryEntries]
  );

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
    if (payload?.summary && typeof payload.summary === "object") {
      setSummary(payload.summary);
    }
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
      console.error("Failed to ping Hoppie", error);
      toast.error(String(error || "Failed to ping Hoppie"));
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
      console.error("Failed to poll Hoppie", error);
      toast.error(String(error || "Failed to poll Hoppie"));
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
      if (packetType !== "poll" && packetType !== "ping") {
        setPacketBody("");
      }
    } catch (error) {
      console.error("Failed to send Hoppie packet", error);
      toast.error(String(error || "Failed to send Hoppie packet"));
    } finally {
      setIsSendingPacket(false);
    }
  };

  const copyBootstrapPreview = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(bootstrapPreviewText);
      toast.success(tr("Bootstrap preview скопирован", "Bootstrap preview copied"));
    } catch (error) {
      console.error("Failed to copy bootstrap preview", error);
      toast.error(tr("Не удалось скопировать bootstrap preview", "Failed to copy bootstrap preview"));
    }
  };

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
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to save ACARS settings"));
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...(payload?.settings && typeof payload.settings === "object" ? payload.settings : settings),
      });
      setSummary(payload?.summary && typeof payload.summary === "object" ? payload.summary : {});
      toast.success(tr("Настройки ACARS сохранены", "ACARS settings saved"));
    } catch (error) {
      console.error("Failed to save ACARS settings", error);
      toast.error(String(error || "Failed to save ACARS settings"));
    } finally {
      setIsSaving(false);
    }
  };

  const refreshSummary = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/admin/acars", { credentials: "include" });
      const payload = response.ok ? await response.json() : null;
      if (payload?.summary && typeof payload.summary === "object") {
        setSummary(payload.summary);
      }
    } catch (error) {
      console.error("Failed to refresh ACARS summary", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const startNewTemplate = () => {
    setSelectedTemplateId("");
    setTemplateDraft({
      ...DEFAULT_VAC_TEMPLATE,
      order: Math.max(10, (messageTemplates.length + 1) * 10),
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const selected = messageTemplates.find((item) => item.id === templateId);
    if (selected) {
      setTemplateDraft(selected);
    }
  };

  const saveTemplate = async () => {
    const normalizedTitle = templateDraft.title.trim();
    const normalizedBody = templateDraft.body.trim();
    const normalizedCode = (templateDraft.code || normalizedTitle)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!normalizedTitle || !normalizedBody) {
      toast.error(tr("Название и текст шаблона обязательны", "Template title and body are required"));
      return;
    }

    setIsSavingTemplate(true);
    try {
      const endpoint = templateDraft.id
        ? `/api/admin/content/acarsMessageTemplates/${templateDraft.id}`
        : "/api/admin/content/acarsMessageTemplates";
      const response = await fetch(endpoint, {
        method: templateDraft.id ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...templateDraft,
          title: normalizedTitle,
          code: normalizedCode,
          body: normalizedBody,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to save template"));
      }

      const savedTemplateId = String(payload?.item?.id || templateDraft.id || "");
      await loadVacDispatch();
      if (savedTemplateId) {
        setSelectedTemplateId(savedTemplateId);
      }
      toast.success(tr("Шаблон сообщения сохранен", "Message template saved"));
    } catch (error) {
      console.error("Failed to save template", error);
      toast.error(String(error || "Failed to save template"));
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const deleteTemplate = async () => {
    if (!templateDraft.id) {
      startNewTemplate();
      return;
    }

    setIsDeletingTemplate(true);
    try {
      const response = await fetch(`/api/admin/content/acarsMessageTemplates/${templateDraft.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to delete template"));
      }

      await loadVacDispatch();
      toast.success(tr("Шаблон сообщения удален", "Message template deleted"));
    } catch (error) {
      console.error("Failed to delete template", error);
      toast.error(String(error || "Failed to delete template"));
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  const sendVacMessage = async () => {
    if (!selectedDispatchBooking) {
      toast.error(tr("Сначала выберите бронирование", "Select a booking first"));
      return;
    }
    if (!templateDraft.body.trim()) {
      toast.error(tr("Текст шаблона обязателен", "Template body is required"));
      return;
    }

    setIsSendingVacMessage(true);
    try {
      const response = await fetch("/api/admin/acars/vac/message", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: selectedDispatchBooking.bookingId > 0 ? selectedDispatchBooking.bookingId : undefined,
          templateId: selectedTemplateId || undefined,
          message: templateDraft.body,
          stand: vacStand,
          note: vacNote,
          from: packetFrom || settings.stationCallsign,
          to: selectedDispatchBooking.callsign,
          pilotName: selectedDispatchBooking.pilotName,
          pilotUsername: selectedDispatchBooking.pilotUsername,
          departure: selectedDispatchBooking.departure,
          arrival: selectedDispatchBooking.arrival,
          aircraft: selectedDispatchBooking.aircraftLabel,
        }),
      });
      const payload = (await response.json().catch(() => null)) as HoppieActionResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(String(payload?.error || payload?.result?.response?.payload || "Failed to send VAC message"));
      }
      if (payload?.summary && typeof payload.summary === "object") {
        setSummary(payload.summary);
      }
      await Promise.all([loadHoppieLog(), loadVacDispatch(), loadVacNetwork(), loadVacDispatchLog()]);
      toast.success(tr(`VAC-сообщение отправлено в ${selectedDispatchBooking.callsign}`, `VAC message sent to ${selectedDispatchBooking.callsign}`));
    } catch (error) {
      console.error("Failed to send VAC message", error);
      toast.error(String(error || "Failed to send VAC message"));
    } finally {
      setIsSendingVacMessage(false);
    }
  };

  const sendSpontaneousMessage = async () => {
    const resolvedTarget = spontaneousResolvedTarget;
    const resolvedMessage = spontaneousMessage.trim();

    if (!resolvedTarget) {
      toast.error(tr("Нужен целевой позывной", "Target callsign is required"));
      return;
    }

    if (!resolvedMessage) {
      toast.error(tr("Нужен текст сообщения", "Message text is required"));
      return;
    }

    setIsSendingSpontaneous(true);
    try {
      const response = await fetch("/api/admin/acars/vac/message", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: selectedDispatchBooking?.bookingId,
          to: resolvedTarget,
          message: resolvedMessage,
          from: packetFrom || settings.stationCallsign,
        }),
      });
      const payload = (await response.json().catch(() => null)) as HoppieActionResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(String(payload?.error || payload?.result?.response?.payload || "Failed to send spontaneous message"));
      }
      if (payload?.summary && typeof payload.summary === "object") {
        setSummary(payload.summary);
      }
      setSpontaneousMessage("");
      await Promise.all([loadHoppieLog(), loadVacDispatch(), loadVacNetwork(), loadVacDispatchLog()]);
      toast.success(tr(`Сообщение отправлено в ${resolvedTarget}`, `Message sent to ${resolvedTarget}`));
    } catch (error) {
      console.error("Failed to send spontaneous message", error);
      toast.error(String(error || "Failed to send spontaneous message"));
    } finally {
      setIsSendingSpontaneous(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{tr("АКАРС", "ACARS")}</h2>
          <p className="text-sm text-gray-500">{tr("Профиль ACARS на базе Hoppie: identity клиента, маршрутизация сообщений, политика телеметрии и readiness к запуску.", "Hoppie-focused profile for client identity, message routing, telemetry policy, and rollout readiness.")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => refreshSummary()} disabled={isRefreshing || isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {tr("Обновить сводку", "Refresh summary")}
          </Button>
          <Button onClick={saveSettings} disabled={isSaving || isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {tr("Сохранить профиль Hoppie", "Save Hoppie profile")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-none shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                <ServerCog className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{tr("Контракт провайдера Hoppie", "Hoppie provider contract")}</h3>
                <p className="text-sm text-gray-500">{tr("Определяет точные identity и routing-данные, с которыми будущий ACARS-клиент должен стартовать в сети Hoppie.", "Define the exact identity and routing data that the future ACARS client should boot with on the Hoppie network.")}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="acars-enabled">{tr("Включить профиль", "Enable profile")}</Label>
                    <p className="text-xs text-gray-500">{tr("Сделать этот Hoppie-контракт активным профилем ACARS.", "Expose this Hoppie contract as the active ACARS profile.")}</p>
                  </div>
                  <Switch id="acars-enabled" checked={settings.enabled} onCheckedChange={(checked) => setSettings((current) => ({ ...current, enabled: checked }))} />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="acars-backfill">{tr("Backfill телеметрии", "Telemetry backfill")}</Label>
                    <p className="text-xs text-gray-500">{tr("Пытаться восстанавливать историю маршрута из booking posrep.", "Try to reconstruct route history from booking posreps.")}</p>
                  </div>
                  <Switch id="acars-backfill" checked={settings.enableTelemetryBackfill} onCheckedChange={(checked) => setSettings((current) => ({ ...current, enableTelemetryBackfill: checked }))} />
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-gray-200 p-4">
                <Label>{tr("Этап rollout", "Rollout stage")}</Label>
                <Select value={settings.rolloutStage} onValueChange={(value) => setSettings((current) => ({ ...current, rolloutStage: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={tr("Выберите этап rollout", "Select rollout stage")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">{tr("Планирование", "Planning")}</SelectItem>
                    <SelectItem value="internal">{tr("Внутренний", "Internal")}</SelectItem>
                    <SelectItem value="beta">Beta</SelectItem>
                    <SelectItem value="live">{tr("Прод", "Live")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">{tr("Показывает текущий операционный этап внедрения Hoppie-клиента.", "Tracks where the Hoppie client rollout stands operationally.")}</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900">{tr("Identity и bootstrap", "Identity and bootstrap")}</h4>
              <p className="mt-1 text-sm text-gray-500">{tr("Эти значения становятся фиксированной Hoppie identity для dispatch, logon и генерации flight callsign.", "These values become the fixed Hoppie identity for dispatching, logon, and flight callsign generation.")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tr("Провайдер", "Provider")}</Label>
                <Select value={settings.provider} onValueChange={(value) => setSettings((current) => ({ ...current, provider: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={tr("Выберите провайдера", "Select provider")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom-hoppie">{tr("Кастомный Hoppie", "Custom Hoppie")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr("Режим сети", "Network mode")}</Label>
                <Select value={settings.networkMode} onValueChange={(value) => setSettings((current) => ({ ...current, networkMode: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={tr("Выберите режим сети", "Select network mode")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">{tr("Прод", "Production")}</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tr("Имя клиента", "Client name")}</Label>
                <Input value={settings.clientName} onChange={(event) => setSettings((current) => ({ ...current, clientName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{tr("Версия клиента", "Client version")}</Label>
                <Input value={settings.clientVersion} onChange={(event) => setSettings((current) => ({ ...current, clientVersion: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{tr("Название станции", "Station name")}</Label>
                <Input value={settings.stationName} onChange={(event) => setSettings((current) => ({ ...current, stationName: event.target.value }))} placeholder="Nordwind Virtual Operations" />
              </div>
              <div className="space-y-2">
                <Label>{tr("Позывной станции", "Station callsign")}</Label>
                <Input value={settings.stationCallsign} onChange={(event) => setSettings((current) => ({ ...current, stationCallsign: event.target.value.trim().toUpperCase() }))} placeholder="NWSOPS" />
              </div>
              <div className="space-y-2">
                <Label>{tr("Hoppie logon code", "Hoppie logon code")}</Label>
                <Input value={settings.hoppieLogonCode} onChange={(event) => setSettings((current) => ({ ...current, hoppieLogonCode: event.target.value.trim().toUpperCase() }))} placeholder="ABCD12" />
              </div>
              <div className="space-y-2">
                <Label>SELCAL</Label>
                <Input value={settings.selcal} onChange={(event) => setSettings((current) => ({ ...current, selcal: event.target.value.trim().toUpperCase() }))} placeholder="AB-CD" />
              </div>
              <div className="space-y-2">
                <Label>{tr("Префикс позывного рейса", "Flight callsign prefix")}</Label>
                <Input value={settings.callsignPrefix} onChange={(event) => setSettings((current) => ({ ...current, callsignPrefix: event.target.value.trim().toUpperCase() }))} placeholder="NWS" />
              </div>
              <div className="space-y-2">
                <Label>{tr("Dispatch target logon", "Dispatch target logon")}</Label>
                <Input value={settings.dispatchTarget} onChange={(event) => setSettings((current) => ({ ...current, dispatchTarget: event.target.value.trim().toUpperCase() }))} placeholder="NWSDISP" />
              </div>
              <div className="space-y-2">
                <Label>{tr("Интервал позиций, сек", "Position interval, sec")}</Label>
                <Input type="number" min={5} max={120} value={settings.positionIntervalSeconds} onChange={(event) => setSettings((current) => ({ ...current, positionIntervalSeconds: Math.max(5, Number(event.target.value || 15) || 15) }))} />
              </div>
              <div className="space-y-2">
                <Label>{tr("Хранение телеметрии, ч", "Telemetry retention, hours")}</Label>
                <Input type="number" min={1} max={168} value={settings.telemetryRetentionHours} onChange={(event) => setSettings((current) => ({ ...current, telemetryRetentionHours: Math.max(1, Number(event.target.value || 24) || 24) }))} />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold text-gray-900">{tr("Каналы Hoppie и маршрутизация", "Hoppie channels and routing")}</h4>
              <p className="mt-1 text-sm text-gray-500">{tr("Включите те семейства сообщений, которые desktop-клиент должен поддерживать с первого дня.", "Turn on the actual message families that the desktop client should support on day one.")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["enableTelex", tr("Включить TELEX", "Enable TELEX")],
                ["enableCpdlc", tr("Включить CPDLC", "Enable CPDLC")],
                ["enableClearanceRequests", tr("Включить clearance requests", "Enable clearance requests")],
                ["enableMessageRelay", tr("Ретрансляция ACARS-сообщений", "Relay ACARS messages")],
                ["enablePositionReports", tr("Отправлять отчеты о позиции", "Send position reports")],
                ["syncSimbriefRemarks", tr("Синхронизировать SimBrief remarks", "Sync SimBrief remarks")],
                ["dispatchIntegrationEnabled", tr("Интеграция диспетчерской", "Dispatch integration")],
                ["autoFilePirep", tr("Автоподача PIREP", "Auto-file PIREP")],
                ["autoAcceptPirep", tr("Автопринятие PIREP", "Auto-accept PIREP")],
                ["commentsEnabled", tr("Синхронизация комментариев пилота", "Pilot comment sync")],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
                  <div>
                    <Label>{label}</Label>
                    <p className="text-xs text-gray-500">{tr(`${label} для профиля Hoppie-клиента.`, `${label} behavior for the Hoppie client profile.`)}</p>
                  </div>
                  <Switch
                    checked={Boolean(settings[key as keyof AcarsSettings])}
                    onCheckedChange={(checked) =>
                      setSettings((current) => ({
                        ...current,
                        [key]: checked,
                      }))
                    }
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold text-gray-900">{tr("Примечания по внедрению", "Implementation notes")}</h4>
              <p className="mt-1 text-sm text-gray-500">{tr("Используйте этот блок для фиксации rollout-задач по Hoppie, packaging notes и допущений по провайдеру.", "Use this to pin Hoppie-specific rollout tasks, packaging notes, or provider assumptions.")}</p>
            </div>

            <div className="space-y-2">
              <Label>{tr("Заметки", "Notes")}</Label>
              <Textarea
                value={settings.notes}
                onChange={(event) => setSettings((current) => ({ ...current, notes: event.target.value }))}
                rows={5}
                placeholder={tr("Зафиксируйте mapping позывных, workflow диспетчерской, ожидания по TELEX/CPDLC и оставшиеся задачи по Hoppie.", "Document callsign mapping, dispatch workflow, telex/CPDLC expectations, or remaining Hoppie transport work.")}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={isSaving || isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {tr("Сохранить профиль Hoppie", "Save Hoppie profile")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Accordion type="multiple" defaultValue={["readiness", "transport", "dispatch"]} className="space-y-4">
          <AcarsSubmenuSection
            value="readiness"
            title={tr("Готовность", "Readiness")}
            description={tr("Сводка статуса Hoppie-профиля, bootstrap-контракта и telemetry stack.", "Summary of the Hoppie profile, bootstrap contract, and telemetry stack status.")}
            summary={`${summaryBadges.length} ${tr("проверок", "checks")}`}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-50 p-2 text-red-600">
                  <Radio className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Readiness</h3>
                  <p className="text-sm text-gray-500">Current state of the Hoppie profile, bootstrap contract, and supporting telemetry stack.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {summaryBadges.map((item) => (
                  <Badge key={item.label} variant="outline" className={item.className}>
                    {item.label}: {item.value}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Активные рейсы", "Active flights")}</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{Number(summary.activeFlights || 0)}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{tr("TTL истории", "History TTL")}</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{Number(summary.telemetryHistoryTtlHours || 0)}h</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Лимит точек", "Point cap")}</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{Number(summary.telemetryPointCap || 0)}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Дисковый кэш", "Disk cache")}</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">{summary.diskCacheEnabled ? tr("Вкл", "On") : tr("Выкл", "Off")}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Последнее сохранение кэша", "Last cache persist")}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{formatTimestamp(summary.diskCacheLastPersistAt)}</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Последний Hoppie probe", "Last Hoppie probe")}</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">{formatTimestamp(summary.lastHoppieProbeAt || null)}</div>
                  <div className="mt-1 text-xs text-gray-500">{summary.lastHoppieProbeRoute || tr("Маршрут еще не записан", "No route yet")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="transport"
            title={tr("Инструменты транспорта Hoppie", "Hoppie transport tools")}
            description={tr("Пинг, poll inbox и ручная отправка Hoppie-пакетов из текущего профиля.", "Ping, poll inbox, and manual Hoppie packet sending from the current profile.")}
            summary="Ping / Poll / TELEX"
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                  <Wifi className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Hoppie transport tools</h3>
                  <p className="text-sm text-gray-500">Run live Hoppie probes, poll the station inbox, or send TELEX and other packets from the configured profile.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tr("От позывного", "From callsign")}</Label>
                  <Input value={packetFrom} onChange={(event) => setPacketFrom(event.target.value.trim().toUpperCase())} placeholder="NWSOPS" />
                </div>
                <div className="space-y-2">
                  <Label>{tr("К позывному", "To callsign")}</Label>
                  <Input value={packetTo} onChange={(event) => setPacketTo(event.target.value.trim().toUpperCase())} placeholder="NWSDISP" />
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
                      <SelectValue placeholder={tr("Выберите тип пакета", "Select packet type")} />
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
                    onChange={(event) => setPacketBody(event.target.value)}
                    rows={5}
                    placeholder={packetType === "telex" ? tr("Тестовое сообщение в dispatch или ATC", "Test message to dispatch or ATC") : packetType === "ping" ? tr("Необязательные online callsign, например ALL-CALLSIGNS", "Optional online callsigns, e.g. ALL-CALLSIGNS") : tr("Тело пакета в точности как его должен отправлять Hoppie-клиент", "Packet body exactly as Hoppie client should send it")}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSendPacket} disabled={isSendingPacket || isLoading}>
                  <Send className="mr-2 h-4 w-4" />
                  {tr("Отправить Hoppie-пакет", "Send Hoppie packet")}
                </Button>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                <div className="font-medium text-gray-900">{tr("Последнее сетевое сообщение", "Last network message")}</div>
                <div className="mt-2">{summary.lastHoppieProbeMessage || tr("Обмены с Hoppie пока не записаны.", "No Hoppie exchange recorded yet.")}</div>
              </div>
            </CardContent>
          </Card>
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="network"
            title={tr("Мониторинг сети VAC", "VAC network monitor")}
            description={tr("Автообнаружение VAC-рейсов из VATSIM и видимость Hoppie online.", "Auto-detection of VAC flights from VATSIM and live Hoppie visibility.")}
            summary={`${Number(networkSummary?.onlineVacFlights || networkFlights.length)} ${tr("онлайн", "online")}`}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-sky-100 p-2 text-sky-700">
                    <Wifi className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">VAC network monitor</h3>
                    <p className="text-sm text-gray-500">Auto-detected VAC flights from VATSIM with live Hoppie online visibility.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadVacNetwork()} disabled={isLoadingVacNetwork}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingVacNetwork ? "animate-spin" : ""}`} />
                  {tr("Обновить монитор", "Refresh monitor")}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">VATSIM online: {Number(networkSummary?.onlineVacFlights || networkFlights.length)}</Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{tr("Совпавшие бронирования", "Matched bookings")}: {Number(networkSummary?.matchedBookings || 0)}</Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">Hoppie online: {Number(networkSummary?.hoppieOnline || 0)}</Badge>
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">{tr("Доступны", "Reachable")}: {Number(networkSummary?.availableForMessages || 0)}</Badge>
              </div>

              <div className="max-h-[260px] overflow-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">{tr("Позывной", "Callsign")}</th>
                      <th className="px-4 py-3 font-medium">{tr("Пилот", "Pilot")}</th>
                      <th className="px-4 py-3 font-medium">{tr("Маршрут", "Route")}</th>
                      <th className="px-4 py-3 font-medium">Hoppie</th>
                      <th className="px-4 py-3 font-medium">{tr("Бронирование", "Booking")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {networkFlights.length > 0 ? networkFlights.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer transition-colors hover:bg-gray-50"
                        onClick={() => {
                          setSpontaneousTarget(item.callsign);
                          if (item.matchedBookingId > 0) {
                            setSelectedBookingId(item.matchedBookingId);
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.callsign}</div>
                          <div className="text-xs text-gray-500">{item.aircraft}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>{item.pilotName}</div>
                          <div className="text-xs text-gray-500">{tr("Онлайн с", "Online since")} {formatTimestamp(item.onlineSince)}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>{item.routeLabel}</div>
                          <div className="text-xs text-gray-500">GS {item.groundspeed ?? "—"} kt · FL {item.altitude ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={item.availableForMessages ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                            {item.availableForMessages ? tr("Онлайн", "Online") : tr("Оффлайн", "Offline")}
                          </Badge>
                          <div className="mt-1 text-xs text-gray-500">{item.hoppieConnected || item.hoppieNote || tr("Станция Hoppie не видна", "No Hoppie station visible")}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>{item.matchedBookingId > 0 ? `#${item.matchedBookingId}` : tr("Нет бронирования", "No booking")}</div>
                          <div className="text-xs text-gray-500">{item.matchedBookingStatus || item.matchedBookingRoute || tr("Можно использовать для спонтанной отправки", "Use for spontaneous send")}</div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">{tr("Сейчас на VATSIM не видно рейсов VAC.", "No VAC flights are currently visible on VATSIM.")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-gray-500">{tr("Нажмите на строку, чтобы подставить цель для спонтанного сообщения и перейти к связанному бронированию.", "Click a row to prefill the spontaneous target and jump to the matched booking when one exists.")}</div>
            </CardContent>
          </Card>
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="dispatch"
            title={tr("Очередь VAC dispatch", "VAC dispatch queue")}
            description={tr("Операционные сообщения для KAR, NWS и STW с live status и доступностью доставки.", "Operational messages for KAR, NWS, and STW flights with live status and delivery availability.")}
            summary={`${filteredDispatchBookings.length} ${tr("рейсов", "flights")}`}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tr("Очередь VAC dispatch", "VAC dispatch queue")}</h3>
                  <p className="text-sm text-gray-500">{tr("Внутренний поток operational-сообщений для рейсов KAR, NWS и STW с проверенными рабочими позывными.", "Internal message flow for KAR, NWS and STW flights with verified working callsigns.")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadVacDispatch()} disabled={isLoadingVacDispatch}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingVacDispatch ? "animate-spin" : ""}`} />
                  {tr("Обновить очередь", "Refresh queue")}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{tr("Доступны", "Eligible")}: {Number(dispatchSummary?.eligibleBookings || 0)}</Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{tr("Заблокированы", "Blocked")}: {Number(dispatchSummary?.blockedBookings || 0)}</Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{tr("Шаблоны", "Templates")}: {Number(dispatchSummary?.activeTemplates || 0)}</Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{tr("VATSIM онлайн", "VATSIM online")}: {Number(dispatchSummary?.vatsimOnline || 0)}</Badge>
                <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">{tr("Доступны", "Reachable")}: {Number(dispatchSummary?.availableForMessages || 0)}</Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{tr("Префиксы", "Prefixes")}: {allowedVacPrefixes.join(", ")}</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-2">
                  <Label>{tr("Поиск рейсов", "Search flights")}</Label>
                  <Input value={dispatchSearch} onChange={(event) => setDispatchSearch(event.target.value)} placeholder={tr("Позывной, пилот, маршрут, аэропорт...", "Callsign, pilot, route, airport...")} />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Фильтр", "Filter")}</Label>
                  <Select value={dispatchFilter} onValueChange={setDispatchFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={tr("Выберите фильтр", "Select filter")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eligible">{tr("Только доступные", "Eligible only")}</SelectItem>
                      <SelectItem value="blocked">{tr("Только заблокированные", "Blocked only")}</SelectItem>
                      <SelectItem value="all">{tr("Все рейсы", "All flights")}</SelectItem>
                      {allowedVacPrefixes.map((prefix) => (
                        <SelectItem key={prefix} value={prefix}>{prefix}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="max-h-[260px] overflow-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">{tr("Позывной", "Callsign")}</th>
                      <th className="px-4 py-3 font-medium">{tr("Пилот", "Pilot")}</th>
                      <th className="px-4 py-3 font-medium">{tr("Маршрут", "Route")}</th>
                      <th className="px-4 py-3 font-medium">VAC</th>
                      <th className="px-4 py-3 font-medium">{tr("Статус", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDispatchBookings.length > 0 ? filteredDispatchBookings.map((item) => (
                      <tr
                        key={item.bookingId}
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${selectedBookingId === item.bookingId ? "bg-red-50/60" : ""}`}
                        onClick={() => setSelectedBookingId(item.bookingId)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{item.callsign}</div>
                          <div className="text-xs text-gray-500">{item.aircraftLabel || tr("Борт не указан", "Aircraft not set")}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>{item.pilotName}</div>
                          <div className="text-xs text-gray-500">{item.pilotUsername || tr("Без username", "No username")}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{item.routeLabel || `${item.departure} - ${item.arrival}`}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={item.callsignEligible ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>
                            {item.vacCode || tr("Заблокирован", "Blocked")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>{item.status}</div>
                          <div className="text-xs text-gray-500">
                            {item.availableForMessages
                              ? `${tr("Hoppie онлайн", "Hoppie online")}${item.hoppieConnected ? ` · ${item.hoppieConnected}` : ""}${item.eta ? ` · ${tr("ETA", "ETA")} ${formatTimestamp(item.eta)}` : ""}`
                              : item.vatsimOnline
                              ? `${tr("VATSIM онлайн", "VATSIM online")}${item.eta ? ` · ${tr("ETA", "ETA")} ${formatTimestamp(item.eta)}` : ""}`
                              : item.liveTracked
                              ? `${item.currentPhase || tr("В эфире", "Live")}${item.eta ? ` · ${tr("ETA", "ETA")} ${formatTimestamp(item.eta)}` : ""}`
                              : tr("Нет live-тайминга", "No live timing")}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">{tr("По текущему фильтру рейсы не найдены.", "No flights matched the current filter.")}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedDispatchBooking ? (
                <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={selectedDispatchBooking.callsignEligible ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>
                      {selectedDispatchBooking.callsign}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{selectedDispatchBooking.routeLabel}</Badge>
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{selectedDispatchBooking.priority}</Badge>
                    {selectedDispatchBooking.liveTracked ? (
                      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{tr("Есть live-трекинг", "Live tracked")}</Badge>
                    ) : null}
                    {selectedDispatchBooking.vatsimOnline ? (
                      <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">{tr("VATSIM онлайн", "VATSIM online")}</Badge>
                    ) : null}
                    {selectedDispatchBooking.availableForMessages ? (
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">{tr("Hoppie онлайн", "Hoppie online")}</Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">{tr("Этап", "Phase")}</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">{selectedDispatchBooking.currentPhase || selectedDispatchBooking.status || "—"}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">ETD</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">{formatTimestamp(selectedDispatchBooking.etd || selectedDispatchBooking.departureTime)}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">ETA</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">{formatTimestamp(selectedDispatchBooking.eta)}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="text-xs uppercase tracking-wide text-gray-500">ETE</div>
                      <div className="mt-1 text-sm font-medium text-gray-900">{selectedDispatchBooking.ete || "—"}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={selectedDispatchBooking.availableForMessages ? "border-green-200 bg-green-50 text-green-700" : selectedDispatchBooking.vatsimOnline ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-700"}>
                      {selectedDispatchBooking.availableForMessages ? tr("Готов к отправке через Hoppie", "Ready for Hoppie message") : selectedDispatchBooking.vatsimOnline ? tr("Виден в VATSIM, Hoppie офлайн", "Seen on VATSIM, Hoppie offline") : tr("Не обнаружен в VATSIM", "Not detected on VATSIM")}
                    </Badge>
                    {selectedDispatchBooking.hoppieConnected ? (
                      <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{selectedDispatchBooking.hoppieConnected}</Badge>
                    ) : null}
                    {selectedDispatchBooking.hoppieStatusNote ? (
                      <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">{selectedDispatchBooking.hoppieStatusNote}</Badge>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-[200px_200px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label>{tr("Шаблон сообщения", "Message template")}</Label>
                      <Select value={selectedTemplateId || "none"} onValueChange={(value) => value !== "none" && handleTemplateSelect(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={tr("Выберите шаблон", "Select template")} />
                        </SelectTrigger>
                        <SelectContent>
                          {messageTemplates.length > 0 ? messageTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>
                          )) : <SelectItem value="none">{tr("Нет шаблонов", "No templates")}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{tr("Стоянка / гейт прибытия", "Arrival stand / gate")}</Label>
                      <Input value={vacStand} onChange={(event) => setVacStand(event.target.value.toUpperCase())} placeholder="A12" />
                    </div>
                    <div className="space-y-2">
                      <Label>{tr("Операционная заметка", "Operational note")}</Label>
                      <Input value={vacNote} onChange={(event) => setVacNote(event.target.value)} placeholder={tr("Необязательное примечание для экипажа", "Optional extra remark for the crew")} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{tr("Предпросмотр сообщения", "Rendered message preview")}</Label>
                    <pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{vacPreviewText || tr("Здесь появится предпросмотр шаблона.", "Template preview will appear here.")}</pre>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">{tr("Доступные плейсхолдеры", "Available placeholders")}: {vacPlaceholders.length > 0 ? vacPlaceholders.join(", ") : "callsign, stand, note"}</div>
                    <Button onClick={sendVacMessage} disabled={isSendingVacMessage || !selectedDispatchBooking.callsignEligible}>
                      <Send className="mr-2 h-4 w-4" />
                      {isSendingVacMessage ? tr("Отправка...", "Sending...") : tr("Отправить operational-сообщение", "Send operational message")}
                    </Button>
                  </div>

                  <div className="space-y-4 rounded-xl border border-dashed border-gray-300 bg-white p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{tr("Спонтанное сообщение", "Spontaneous message")}</h4>
                      <p className="text-xs text-gray-500">{tr("Отправка произвольного TELEX без изменения сохраненной библиотеки шаблонов.", "Send an ad hoc TELEX without changing the saved template library.")}</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                      <div className="space-y-2">
                        <Label>{tr("Целевой позывной", "Target callsign")}</Label>
                        <Input
                          value={spontaneousTarget}
                          onChange={(event) => setSpontaneousTarget(event.target.value.toUpperCase())}
                          placeholder={selectedDispatchBooking.callsign || "NWS1234"}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{tr("Текст сообщения", "Message text")}</Label>
                        <Textarea
                          value={spontaneousMessage}
                          onChange={(event) => setSpontaneousMessage(event.target.value)}
                          rows={4}
                          placeholder={tr("NWS1234 СВЯЖИТЕСЬ С OPS ПОСЛЕ ПОСТАНОВКИ НА СТОЯНКУ ДЛЯ ОБНОВЛЕНИЯ ПО TURNAROUND.", "NWS1234 CONTACT OPS ON BLOCK FOR TURNAROUND UPDATE.")}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">{tr("Текущая цель", "Current target")}: {spontaneousResolvedTarget || "—"}. {tr("Бэкенд по-прежнему ограничивает dispatch позывными KAR, NWS и STW.", "The backend still restricts dispatch to KAR, NWS and STW callsigns.")}</div>
                      <Button onClick={sendSpontaneousMessage} disabled={isSendingSpontaneous || !spontaneousResolvedTarget}>
                        <Send className="mr-2 h-4 w-4" />
                        {isSendingSpontaneous ? tr("Отправка...", "Sending...") : tr("Отправить спонтанное сообщение", "Send spontaneous message")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="templates"
            title={tr("Библиотека шаблонов сообщений", "Message template library")}
            description={tr("Хранение и редактирование заготовленных operational message templates.", "Store and edit reusable operational message templates.")}
            summary={`${messageTemplates.length} ${tr("шаблонов", "templates")}`}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tr("Библиотека шаблонов сообщений", "Message template library")}</h3>
                  <p className="text-sm text-gray-500">{tr("Добавляйте и поддерживайте переиспользуемые внутренние Hoppie-шаблоны для dispatch-работы.", "Add and maintain reusable internal Hoppie message templates for dispatch work.")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={startNewTemplate}>{tr("Новый шаблон", "New template")}</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {messageTemplates.length > 0 ? messageTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${selectedTemplateId === template.id ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                  >
                    {template.title}
                  </button>
                )) : (
                  <div className="text-sm text-gray-500">{tr("Шаблонов пока нет.", "No templates yet.")}</div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{tr("Название", "Title")}</Label>
                  <Input value={templateDraft.title} onChange={(event) => setTemplateDraft((current) => ({ ...current, title: event.target.value }))} placeholder={tr("Назначение стоянки прибытия", "Arrival stand assignment")} />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Код", "Code")}</Label>
                  <Input value={templateDraft.code} onChange={(event) => setTemplateDraft((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="ARRIVAL_STAND" />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Категория", "Category")}</Label>
                  <Input value={templateDraft.category} onChange={(event) => setTemplateDraft((current) => ({ ...current, category: event.target.value }))} placeholder={tr("arrival", "arrival")} />
                </div>
                <div className="space-y-2">
                  <Label>{tr("Порядок сортировки", "Sort order")}</Label>
                  <Input type="number" min={0} value={templateDraft.order} onChange={(event) => setTemplateDraft((current) => ({ ...current, order: Number(event.target.value || 0) || 0 }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{tr("Описание", "Description")}</Label>
                <Input value={templateDraft.description} onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))} placeholder={tr("Когда и как dispatch должен использовать этот шаблон", "When and how dispatch should use this template")} />
              </div>

              <div className="space-y-2">
                <Label>{tr("Тело шаблона", "Template body")}</Label>
                <Textarea value={templateDraft.body} onChange={(event) => setTemplateDraft((current) => ({ ...current, body: event.target.value }))} rows={5} placeholder="{{callsign}} ARRIVAL STAND {{stand}}. REPORT PARKED ON BLOCK." />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
                <div>
                  <Label>{tr("Шаблон активен", "Template active")}</Label>
                  <p className="text-xs text-gray-500">{tr("Неактивные шаблоны остаются в библиотеке, но не считаются operational-дефолтами.", "Inactive templates stay in the library but do not count as operational defaults.")}</p>
                </div>
                <Switch checked={templateDraft.active} onCheckedChange={(checked) => setTemplateDraft((current) => ({ ...current, active: checked }))} />
              </div>

              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={deleteTemplate} disabled={isDeletingTemplate || isSavingTemplate}>
                  {templateDraft.id ? tr("Удалить шаблон", "Delete template") : tr("Очистить черновик", "Clear draft")}
                </Button>
                <Button onClick={saveTemplate} disabled={isSavingTemplate || isDeletingTemplate}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSavingTemplate ? tr("Сохранение...", "Saving...") : tr("Сохранить шаблон", "Save template")}
                </Button>
              </div>
            </CardContent>
          </Card>
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="checklist"
            title={tr("Чеклист", "Checklist")}
            description={tr("Минимальные блокеры и capability summary для чистого Hoppie bootstrap.", "Immediate blockers and capability summary for a clean Hoppie bootstrap.")}
            summary={draftMissingItems.length === 0 ? tr("Готов", "Ready") : `${draftMissingItems.length} ${tr("блокеров", "blockers")}`}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                {draftMissingItems.length === 0 ? (
                  <div className="rounded-full bg-green-50 p-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="rounded-full bg-amber-50 p-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tr("Чеклист", "Checklist")}</h3>
                  <p className="text-sm text-gray-500">{tr("Немедленные блокеры для чистого Hoppie bootstrap.", "Immediate blockers for a clean Hoppie bootstrap.")}</p>
                </div>
              </div>
              {draftMissingItems.length > 0 ? (
                <ul className="space-y-2 text-sm text-gray-600">
                  {draftMissingItems.map((item) => (
                    <li key={item} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-amber-800">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
                  {tr("Профиль содержит минимальную identity и routing-конфигурацию, необходимую для Hoppie bootstrap.", "The profile has the minimum identity and routing required for a Hoppie bootstrap.")}
                </div>
              )}
              <div>
                <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">{tr("Возможности", "Capabilities")}</div>
                <div className="flex flex-wrap gap-2">
                  {(summary.capabilities && summary.capabilities.length > 0 ? summary.capabilities : draftCapabilities).map((item) => (
                    <Badge key={item} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="bootstrap"
            title={tr("Bootstrap preview", "Bootstrap preview")}
            description={tr("Сгенерированный profile payload для будущего Hoppie client bootstrap.", "Generated profile payload for the future Hoppie client bootstrap.")}
            summary={tr("Сгенерированный payload", "Generated payload")}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-slate-100 p-2 text-slate-600">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{tr("Bootstrap preview", "Bootstrap preview")}</h3>
                    <p className="text-sm text-gray-500">{tr("Сгенерированный profile block для будущего bootstrap Hoppie-клиента.", "Generated profile block for the future Hoppie client bootstrap.")}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={copyBootstrapPreview}>
                  <ClipboardCopy className="mr-2 h-4 w-4" />
                  {tr("Копировать", "Copy")}
                </Button>
              </div>
              <pre className="max-h-[360px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{bootstrapPreviewText}</pre>
            </CardContent>
          </Card>
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="dispatch-log"
            title={tr("Журнал dispatch-отправок", "Dispatch send log")}
            description={tr("Журнал template и spontaneous VAC-сообщений, отправленных через Hoppie.", "Audit trail for template and spontaneous VAC messages sent through Hoppie.")}
            summary={`${dispatchLogEntries.length} ${tr("записей", "entries")}`}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tr("Журнал dispatch-отправок", "Dispatch send log")}</h3>
                  <p className="text-sm text-gray-500">{tr("Аудит template- и spontaneous-VAC-сообщений, отправленных через Hoppie.", "Audit trail for template and spontaneous VAC messages sent through Hoppie.")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadVacDispatchLog()} disabled={isLoadingVacDispatchLog}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingVacDispatchLog ? "animate-spin" : ""}`} />
                  {tr("Обновить журнал", "Refresh log")}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{dispatchLogEntries.length} {tr("записей", "entries")}</Badge>
                <div className="text-xs text-gray-500">{tr("Журнал включает как успешные отправки, так и неудачные попытки.", "Logs include both successful sends and failed attempts.")}</div>
              </div>
              <div className="space-y-3">
                {dispatchLogEntries.length > 0 ? dispatchLogEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={entry.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>
                        {entry.responseStatus || (entry.ok ? tr("ok", "ok") : tr("ошибка", "error"))}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{entry.mode}</Badge>
                      {entry.templateId ? <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{entry.templateId}</Badge> : null}
                      <div className="text-xs text-gray-500">{formatTimestamp(entry.requestedAt)}</div>
                    </div>
                    <div className="mt-2 text-sm font-medium text-gray-900">{entry.from} → {entry.to}</div>
                    <div className="mt-1 text-xs text-gray-500">{entry.pilotName} · {entry.routeLabel || entry.callsign}</div>
                    {entry.packet ? <pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{entry.packet}</pre> : null}
                    <div className="mt-2 text-sm text-gray-600">{entry.responsePayload || tr("Payload не вернулся.", "No payload returned.")}</div>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                    {tr("VAC dispatch-сообщения пока не логировались.", "No VAC dispatch messages have been logged yet.")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="transport-log"
            title={tr("Журнал транзакций Hoppie", "Hoppie transaction log")}
            description={tr("Последние ping, poll и send действия, выполненные через ACARS admin tools.", "Recent ping, poll, and send actions executed through the ACARS admin tools.")}
            summary={`${Number(summary.recentHoppieTransactions || transportLog.length)} ${tr("запросов", "requests")}`}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tr("Журнал транзакций Hoppie", "Hoppie transaction log")}</h3>
                  <p className="text-sm text-gray-500">{tr("Последние ping, poll и send-действия, выполненные через инструменты ACARS admin.", "Recent ping, poll, and send actions executed through the ACARS admin tools.")}</p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  {Number(summary.recentHoppieTransactions || transportLog.length)} {tr("запросов", "requests")}
                </Badge>
              </div>
              <div className="space-y-3">
                {transportLog.length > 0 ? transportLog.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={entry.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}>
                        {entry.responseStatus || (entry.ok ? tr("ok", "ok") : tr("ошибка", "error"))}
                      </Badge>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">{entry.type}</Badge>
                      <div className="text-xs text-gray-500">{formatTimestamp(entry.requestedAt)}</div>
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
          </AcarsSubmenuSection>

          <AcarsSubmenuSection
            value="next-step"
            title={tr("Следующий этап", "Next build step")}
            description={tr("Короткий roadmap следующего практического этапа по ACARS runtime.", "Short roadmap for the next practical ACARS runtime step.")}
            summary={tr("План", "Roadmap")}
          >
          <Card className="border-none shadow-none">
            <CardContent className="space-y-3 p-6">
              <h3 className="text-lg font-semibold text-gray-900">{tr("Следующий этап сборки", "Next build step")}</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>{tr("Эта страница теперь задает контракт Hoppie identity и умеет активно ping, poll и send-пакеты в сеть Hoppie.", "This page now defines the Hoppie identity contract and can actively ping, poll, and send packets against the Hoppie network.")}</li>
                <li>{tr("Части telemetry и PIREP уже выровнены с live map и backfill-стеком, поэтому клиентская работа может опираться на единую модель данных.", "The telemetry and PIREP parts already line up with the live map and backfill stack, so client work can target one shared data model.")}</li>
                <li>{tr("Следующий практический шаг после этого - подключить ту же packet-логику к реальному desktop или embedded runtime ACARS-клиента.", "The next practical step after this is wiring the same packet logic into the actual desktop or embedded ACARS client runtime.")}</li>
              </ul>
            </CardContent>
          </Card>
          </AcarsSubmenuSection>
        </Accordion>
      </div>
    </div>
  );
}