import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import { createHash, randomBytes, randomUUID } from "node:crypto";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment from .env when present and fall back to the local temp env used in this workspace.
dotenv.config();
if (!process.env.VAMSYS_CLIENT_ID && !process.env.CLIENT_ID && !process.env.VAMSYS_API_TOKEN) {
  dotenv.config({ path: path.resolve(__dirname, "../temp_vamsys.env") });
}

// Service configuration from environment with sensible defaults
const PORT = Number(
  process.env.PORT || process.env.SERVER_PORT || process.env.VAMSYS_SERVER_PORT || 8787
);
const SERVE_STATIC = String(process.env.SERVE_STATIC || "true").toLowerCase() === "true";

// API base used for vAMSYS operations endpoints (can be overridden)
const API_BASE = process.env.VAMSYS_API_BASE || process.env.API_BASE || "https://vamsys.io/api/v3/operations";

// VAMSYS / backend credentials
const CLIENT_ID = process.env.VAMSYS_CLIENT_ID || process.env.CLIENT_ID || "";
const CLIENT_SECRET = process.env.VAMSYS_CLIENT_SECRET || process.env.CLIENT_SECRET || "";
const VAMSYS_API_SCOPE = String(
  process.env.VAMSYS_API_SCOPE || process.env.VAMSYS_CLIENT_CREDENTIALS_SCOPE || ""
).trim();

// Token endpoint for client_credentials grant
const TOKEN_URL = process.env.VAMSYS_TOKEN_URL || process.env.TOKEN_URL || "https://vamsys.io/oauth/token";

// Optional simple API token: if set, this token will be used directly
// instead of performing the client_credentials OAuth flow.
const API_TOKEN = process.env.VAMSYS_API_TOKEN || "";
const API_AUTH_SCHEME = String(process.env.VAMSYS_API_AUTH_SCHEME || "Bearer").trim();

// vAMSYS OAuth (if used)
const VAMSYS_OAUTH_CLIENT_ID = process.env.VAMSYS_OAUTH_CLIENT_ID || "";
const VAMSYS_OAUTH_CLIENT_SECRET = process.env.VAMSYS_OAUTH_CLIENT_SECRET || "";

// Discord OAuth / bot tokens
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const DISCORD_OAUTH_REDIRECT_URI = process.env.DISCORD_OAUTH_REDIRECT_URI || "";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || "";
const DISCORD_NEWS_CHANNEL_ID = process.env.DISCORD_NEWS_CHANNEL_ID || "";
const DISCORD_OAUTH_SUCCESS_URL = process.env.DISCORD_OAUTH_SUCCESS_URL || "/login?discord=success";
const DISCORD_OAUTH_FAILURE_URL = process.env.DISCORD_OAUTH_FAILURE_URL || "/login?discord=error";
const VAMSYS_OAUTH_REDIRECT_URI = process.env.VAMSYS_OAUTH_REDIRECT_URI || "";
const VAMSYS_OAUTH_SUCCESS_URL = process.env.VAMSYS_OAUTH_SUCCESS_URL || "/login?vamsys=success";
const VAMSYS_OAUTH_FAILURE_URL = process.env.VAMSYS_OAUTH_FAILURE_URL || "/login?vamsys=error";
const VAMSYS_OAUTH_SCOPE = String(process.env.VAMSYS_OAUTH_SCOPE || "").trim();
const PILOT_API_BASE = process.env.PILOT_API_BASE || "https://vamsys.io/api/v3/pilot";
const PILOT_API_CLIENT_ID = process.env.PILOT_API_CLIENT_ID || "";
const PILOT_API_REDIRECT_URI = process.env.PILOT_API_REDIRECT_URI || "";
const PILOT_API_SCOPE = String(process.env.PILOT_API_SCOPE || "").trim();
const PILOT_API_SUCCESS_URL =
  process.env.PILOT_API_SUCCESS_URL || "/dashboard?tab=settings&pilot_api=success";
const PILOT_API_FAILURE_URL =
  process.env.PILOT_API_FAILURE_URL || "/dashboard?tab=settings&pilot_api=error";
const SIMBRIEF_ENABLED = String(process.env.SIMBRIEF_ENABLED || "false").toLowerCase() === "true";
const ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN || "";
const ADMIN_DISCORD_IDS = String(process.env.ADMIN_DISCORD_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ADMIN_VAMSYS_IDS = String(process.env.ADMIN_VAMSYS_IDS || "")
  .split(",")
  .map((value) => String(value || "").trim().toUpperCase())
  .filter(Boolean);
const ADMIN_VAMSYS_USERNAMES = String(process.env.ADMIN_VAMSYS_USERNAMES || "")
  .split(",")
  .map((value) => String(value || "").trim().toUpperCase())
  .filter(Boolean);
const ADMIN_VAMSYS_HONORARY_RANK_IDS = String(
  process.env.ADMIN_VAMSYS_HONORARY_RANK_IDS || process.env.VAMSYS_STAFF_HONORARY_RANK_IDS || "5"
)
  .split(",")
  .map((value) => Number(String(value || "").trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const ADMIN_VAMSYS_HONORARY_RANK_NAMES = String(
  process.env.ADMIN_VAMSYS_HONORARY_RANK_NAMES || process.env.VAMSYS_STAFF_HONORARY_RANK_NAMES || "STAFF"
)
  .split(",")
  .map((value) => String(value || "").trim().toUpperCase())
  .filter(Boolean);
const PRESEEDED_STAFF_DISCORD_IDS = ["1397529397665333318"];
const DIST_DIR = path.resolve(__dirname, "../dist");

const logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  debug: (...args) => (console.debug ? console.debug(...args) : console.log(...args)),
};

// Local vAMSYS mock switch
const USE_LOCAL_VAMSYS_MOCK = String(process.env.USE_LOCAL_VAMSYS_MOCK || "").toLowerCase() === "true";
const LOCAL_VAMSYS_MOCK_PREFIX = "/__local/vamsys";
if (USE_LOCAL_VAMSYS_MOCK) {
  API_BASE = `http://localhost:${PORT}${LOCAL_VAMSYS_MOCK_PREFIX}/operations`;
}
let AUTH_STORE_FILE = process.env.AUTH_STORAGE_FILE || "";
if (!AUTH_STORE_FILE) {
  AUTH_STORE_FILE = path.resolve(__dirname, "../data/auth-store.json");
}
// Pilots roster persistence file (stored alongside the auth store)
const PILOTS_ROSTER_FILE = path.join(path.dirname(AUTH_STORE_FILE), "pilots-roster.json");
const FLEET_SNAPSHOT_FILE = path.join(path.dirname(AUTH_STORE_FILE), "fleet-snapshot.json");
const ADMIN_CONTENT_FILE = path.join(path.dirname(AUTH_STORE_FILE), "admin-content.json");
const ADMIN_AUDIT_LOG_FILE = path.join(path.dirname(AUTH_STORE_FILE), "admin-audit-log.json");
const AUTH_ACTIVITY_LOG_FILE = path.join(path.dirname(AUTH_STORE_FILE), "auth-activity-log.json");
const TELEMETRY_HISTORY_FILE = path.join(path.dirname(AUTH_STORE_FILE), "telemetry-history-cache.json");
const ADMIN_AUDIT_MAX_ENTRIES = Math.max(Number(process.env.ADMIN_AUDIT_MAX_ENTRIES || 5000) || 5000, 500);
const AUTH_ACTIVITY_MAX_ENTRIES = Math.max(Number(process.env.AUTH_ACTIVITY_MAX_ENTRIES || 5000) || 5000, 500);
const DISCORD_STATE_COOKIE = "nws_discord_oauth_state";
const DISCORD_SESSION_COOKIE = "nws_discord_session";
const DISCORD_STATE_TTL_MS = 10 * 60 * 1000;
const DISCORD_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VAMSYS_STATE_COOKIE = "nws_vamsys_oauth_state";
const VAMSYS_SESSION_COOKIE = "nws_vamsys_session";
const PILOT_API_STATE_COOKIE = "nws_pilot_api_oauth_state";
const VAMSYS_STATE_TTL_MS = 10 * 60 * 1000;
const VAMSYS_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PILOT_API_STATE_TTL_MS = 10 * 60 * 1000;
const VAMSYS_SESSION_REFRESH_MS =
  Math.max(Number(process.env.VAMSYS_SESSION_REFRESH_MS || 5 * 60 * 1000) || 5 * 60 * 1000, 30 * 1000);
const PILOT_API_PROFILE_REFRESH_MS = Math.max(
  Number(process.env.PILOT_API_PROFILE_REFRESH_MS || 15 * 60 * 1000) || 15 * 60 * 1000,
  60 * 1000
);
const VAMSYS_OAUTH_PROFILE_PROBE_ENABLED =
  String(process.env.VAMSYS_OAUTH_PROFILE_PROBE_ENABLED || "false").toLowerCase() === "true";
const VAMSYS_TRY_DOCS_PILOT_ENDPOINT =
  String(process.env.VAMSYS_TRY_DOCS_PILOT_ENDPOINT || "false").toLowerCase() === "true";

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
};

let summaryCache = {
  data: null,
  expiresAt: 0,
};

let fleetCache = {
  data: null,
  expiresAt: 0,
};

let aircraftLookupCache = {
  byId: null,
  byRegistration: null,
  expiresAt: 0,
};

let aircraftDetailsCache = {
  byKey: new Map(),
  expiresAt: 0,
};

let fleetLiveriesCache = {
  byFleetId: new Map(),
  expiresAt: 0,
};

let fleetLiveryDetailsCache = {
  byKey: new Map(),
  expiresAt: 0,
};

let routesCache = {
  data: null,
  expiresAt: 0,
};

let flightMapCache = {
  data: null,
  expiresAt: 0,
};

const FLIGHT_MAP_CACHE_MS = Math.max(Number(process.env.FLIGHT_MAP_CACHE_MS || 100) || 100, 80);
const FLIGHT_MAP_IDLE_CACHE_MS = Math.max(Number(process.env.FLIGHT_MAP_IDLE_CACHE_MS || 30000) || 30000, 5000);
const ACTIVE_FLIGHT_GRACE_MS = Math.max(Number(process.env.ACTIVE_FLIGHT_GRACE_MS || 15000) || 15000, 2000);
const TELEMETRY_HISTORY_TTL_MS = Math.max(Number(process.env.TELEMETRY_HISTORY_TTL_MS || 6 * 60 * 60 * 1000) || 6 * 60 * 60 * 1000, 60 * 1000);
const TELEMETRY_HISTORY_MAX_POINTS = Math.max(Number(process.env.TELEMETRY_HISTORY_MAX_POINTS || 1800) || 1800, 200);
const TELEMETRY_HISTORY_RESET_DISTANCE_NM = Math.max(Number(process.env.TELEMETRY_HISTORY_RESET_DISTANCE_NM || 250) || 250, 30);
const TELEMETRY_BACKFILL_RETRY_MS = Math.max(Number(process.env.TELEMETRY_BACKFILL_RETRY_MS || 120000) || 120000, 10000);
const TELEMETRY_BACKFILL_FRESH_MS = Math.max(Number(process.env.TELEMETRY_BACKFILL_FRESH_MS || 15 * 60 * 1000) || 15 * 60 * 1000, 60000);
const TELEMETRY_BACKFILL_MIN_POINTS = Math.max(Number(process.env.TELEMETRY_BACKFILL_MIN_POINTS || 240) || 240, 20);
const TELEMETRY_BACKFILL_MAX_REFERENCE_IDS = Math.max(Number(process.env.TELEMETRY_BACKFILL_MAX_REFERENCE_IDS || 2) || 2, 1);
const TELEMETRY_BACKFILL_CURRENT_MATCH_NM = Math.max(Number(process.env.TELEMETRY_BACKFILL_CURRENT_MATCH_NM || 700) || 700, 150);
const TELEMETRY_BACKFILL_DEPARTURE_MATCH_NM = Math.max(Number(process.env.TELEMETRY_BACKFILL_DEPARTURE_MATCH_NM || 500) || 500, 100);
const TELEMETRY_BACKFILL_BLOCKING_ENABLED = String(process.env.TELEMETRY_BACKFILL_BLOCKING_ENABLED || "false").toLowerCase() === "true";
const TELEMETRY_DISK_CACHE_ENABLED = String(process.env.TELEMETRY_DISK_CACHE_ENABLED || "true").toLowerCase() === "true";
const TELEMETRY_DISK_FLUSH_MS = Math.max(Number(process.env.TELEMETRY_DISK_FLUSH_MS || 30000) || 30000, 5000);
const TELEMETRY_DISK_MAX_ENTRIES = Math.max(Number(process.env.TELEMETRY_DISK_MAX_ENTRIES || 5000) || 5000, 200);
const TELEMETRY_DISK_MAX_BACKFILL_ENTRIES = Math.max(Number(process.env.TELEMETRY_DISK_MAX_BACKFILL_ENTRIES || 3000) || 3000, 100);
const telemetryHistoryCache = new Map();
const telemetryBackfillCache = new Map();
const telemetryDiskPersistState = {
  dirty: false,
  flushInFlight: false,
  lastPersistAt: 0,
};
const activeFlightHoldCache = new Map();

let recentFlightsCache = new Map();

let completedFlightsCache = {
  data: null,
  expiresAt: 0,
};

let systemStatusCache = {
  data: null,
  expiresAt: 0,
};

let airportsLookupCache = {
  map: null,
  expiresAt: 0,
};

let pilotsLookupCache = {
  byUsername: null,
  expiresAt: 0,
};

let ranksLookupCache = {
  map: null,
  expiresAt: 0,
};

let badgesCatalogCache = {
  items: null,
  expiresAt: 0,
};

let pilotsRosterCache = {
  data: null,
  expiresAt: 0,
};

const pilotNameCache = new Map();

const UNIFIED_CATALOG_DELTA_SYNC_MS = Math.max(
  Number(process.env.UNIFIED_CATALOG_DELTA_SYNC_MS || 2 * 60 * 1000) || 2 * 60 * 1000,
  30 * 1000
);
const UNIFIED_CATALOG_FULL_SYNC_MS = Math.max(
  Number(process.env.UNIFIED_CATALOG_FULL_SYNC_MS || 6 * 60 * 60 * 1000) || 6 * 60 * 60 * 1000,
  10 * 60 * 1000
);
const UNIFIED_CATALOG_MAX_DELTA_PAGES = Math.max(
  Number(process.env.UNIFIED_CATALOG_MAX_DELTA_PAGES || 8) || 8,
  1
);

const unifiedCatalogCache = {
  initialized: false,
  initPromise: null,
  syncPromise: null,
  periodicTimer: null,
  lastFullSyncAt: 0,
  lastDeltaSyncAt: 0,
  airportsById: new Map(),
  hubsById: new Map(),
  routesById: new Map(),
  fleetsById: new Map(),
};

const discordOauthStateCache = new Map();
const discordOauthRedirectCache = new Map();
const discordSessionCache = new Map();
const vamsysOauthStateCache = new Map();
const vamsysSessionCache = new Map();
const pilotApiOauthStateCache = new Map();

const authStoreTemplate = {
  version: 2,
  discordOauthStates: {},
  discordSessions: {},
  vamsysOauthStates: {},
  vamsysSessions: {},
  pilotApiOauthStates: {},
  discordLinks: {},
  vamsysLinks: {},
  adminUsers: {},
  pilotPreferences: {},
  pilotNotamReads: {},
  curatedPilots: {},
  pilotBadgeAwards: {},
  toursCatalog: {},
};

const discordLinksCache = new Map();
const vamsysLinksCache = new Map();
const adminUsersCache = new Map();
const pilotPreferencesCache = new Map();
const pilotNotamReadsCache = new Map();
const curatedPilotsCache = new Map();
const pilotBadgeAwardsCache = new Map();
const toursCatalogCache = new Map();

const DEFAULT_NOTIFICATION_SETTINGS = {
  channels: {
    email: true,
    discord: true,
    browser: false,
  },
  notificationTypes: {
    booking: true,
    claim: true,
    review: true,
    notam: true,
    event: true,
    system: true,
    badge: true,
  },
};

const DEFAULT_DISCORD_BOT_TEMPLATES = {
  bookingCreated: {
    id: "bookingCreated",
    title: "Booking {{flightNumber}} created",
    description: "{{pilotName}} booked {{route}} with {{aircraft}}.",
    enabled: true,
  },
  flightTakeoff: {
    id: "flightTakeoff",
    title: "{{flightNumber}} departed",
    description: "{{pilotName}} is now airborne from {{departure}} to {{arrival}}.",
    enabled: true,
  },
  flightLanding: {
    id: "flightLanding",
    title: "{{flightNumber}} arrived",
    description: "{{pilotName}} landed at {{arrival}} from {{departure}}.",
    enabled: true,
  },
  pirepReview: {
    id: "pirepReview",
    title: "PIREP ready for review",
    description: "{{pilotName}} filed {{flightNumber}} on {{route}}.",
    enabled: true,
  },
  ticketCreated: {
    id: "ticketCreated",
    title: "Ticket #{{ticketNumber}}: {{subject}}",
    description: "{{content}}",
    enabled: true,
  },
  ticketUpdated: {
    id: "ticketUpdated",
    title: "Ticket #{{ticketNumber}} updated",
    description: "Status: {{status}} | Priority: {{priority}}",
    enabled: true,
  },
  ticketReply: {
    id: "ticketReply",
    title: "New reply on ticket #{{ticketNumber}}",
    description: "{{content}}",
    enabled: true,
  },
  ticketClosed: {
    id: "ticketClosed",
    title: "Ticket #{{ticketNumber}} closed",
    description: "{{subject}}",
    enabled: true,
  },
  newsCreated: {
    id: "newsCreated",
    title: "{{title}}",
    description: "{{content}}",
    enabled: true,
  },
  notamCreated: {
    id: "notamCreated",
    title: "NOTAM: {{title}}",
    description: "{{content}}",
    enabled: true,
  },
  alertCreated: {
    id: "alertCreated",
    title: "Alert: {{title}}",
    description: "{{content}}",
    enabled: true,
  },
};

const DEFAULT_DISCORD_BOT_SETTINGS = {
  enabled: true,
  webhookUrl: "",
  monitoredGuildId: "",
  adminRoleIds: [],
  sync: {
    tickets: true,
    news: true,
    notams: true,
    alerts: true,
  },
  notifications: {
    bookingCreated: true,
    flightTakeoff: true,
    flightLanding: true,
    pirepReview: true,
    ticketCreated: true,
    ticketReply: true,
    ticketUpdated: true,
    ticketClosed: true,
    newsCreated: true,
    notamCreated: true,
    alertCreated: true,
  },
  channels: {
    bookings: "",
    flights: "",
    pirepReview: "",
    tickets: "",
    news: "",
    notams: "",
    alerts: "",
  },
  pirepAlerts: {
    awaitingReview: true,
    reviewStarted: true,
    staffComment: true,
    pilotDmOnReviewStarted: true,
    pilotDmOnStaffComment: true,
  },
  templates: DEFAULT_DISCORD_BOT_TEMPLATES,
  updatedAt: null,
};

const DEFAULT_TELEGRAM_BOT_SETTINGS = {
  enabled: true,
  pollingEnabled: true,
  webhookEnabled: false,
  webhookUrl: "",
  adminChatIds: [],
  sync: {
    tickets: true,
    news: true,
    notams: true,
    alerts: true,
  },
  commands: {
    start: true,
    help: true,
    ping: true,
    news: true,
    notams: true,
    ticket: true,
  },
  updatedAt: null,
};

const DEFAULT_TOURS_CATALOG = [
  {
    id: "starter-tour",
    title: "Starter Tour",
    description: "Complete your first flights and settle into Nordwind operations.",
    targets: {
      flights: 3,
      hours: 5,
    },
  },
  {
    id: "regional-rotation",
    title: "Regional Rotation",
    description: "Build short-haul consistency with a solid regional block of flights.",
    targets: {
      flights: 10,
      hours: 20,
    },
  },
  {
    id: "dispatch-pro",
    title: "Dispatch Pro",
    description: "Show operational discipline with bookings, claims and current location data.",
    targets: {
      flights: 15,
      hours: 35,
      claims: 1,
      locationSet: true,
    },
  },
];

const LOCAL_BADGES_CATALOG = [
  {
    id: "first-flight",
    title: "First Flight",
    description: "Complete your first accepted flight in Nordwind Virtual.",
    icon: "FF",
    color: "#E31E24",
  },
  {
    id: "ten-flights",
    title: "Line Regular",
    description: "Reach 10 completed flights.",
    icon: "10",
    color: "#0F766E",
  },
  {
    id: "hundred-hours",
    title: "Century Hours",
    description: "Accumulate 100 total flight hours.",
    icon: "100",
    color: "#1D4ED8",
  },
  {
    id: "honorary-rank",
    title: "Honorary Rank",
    description: "Earn any honorary rank inside Nordwind Virtual.",
    icon: "HR",
    color: "#7C3AED",
  },
  {
    id: "claim-submitted",
    title: "Claim Filed",
    description: "Submit your first manual claim with operational evidence.",
    icon: "CL",
    color: "#EA580C",
  },
  {
    id: "location-set",
    title: "Positioned",
    description: "Set and keep your pilot location in the Pilot API.",
    icon: "LOC",
    color: "#059669",
  },
];

const ensureAuthStoreDir = () => {
  const dir = path.dirname(AUTH_STORE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const persistPilotsRoster = () => {
  try {
    if (!pilotsRosterCache.data) return;
    ensureAuthStoreDir();
    const tempPath = `${PILOTS_ROSTER_FILE}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(pilotsRosterCache.data, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, PILOTS_ROSTER_FILE);
    logger.info('[pilots] persist_success', { PILOTS_ROSTER_FILE });
  } catch (err) {
    logger.warn('[pilots] persist_failed', String(err));
  }
};

const readFleetSnapshotFromDisk = () => {
  try {
    if (!fs.existsSync(FLEET_SNAPSHOT_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(FLEET_SNAPSHOT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const fleets = Array.isArray(parsed?.fleets) ? parsed.fleets : [];
    return { fleets };
  } catch (err) {
    logger.warn('[fleet] snapshot_read_failed', String(err));
    return null;
  }
};

const persistFleetSnapshot = (payload) => {
  try {
    if (!payload || !Array.isArray(payload?.fleets)) {
      return;
    }
    ensureAuthStoreDir();
    const tempPath = `${FLEET_SNAPSHOT_FILE}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, FLEET_SNAPSHOT_FILE);
    logger.info('[fleet] snapshot_persist_success', { FLEET_SNAPSHOT_FILE, fleets: payload.fleets.length });
  } catch (err) {
    logger.warn('[fleet] snapshot_persist_failed', String(err));
  }
};

const normalizeAdminText = (value) => String(value || "").trim();

const normalizeAdminMultilineText = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();

const normalizeAdminBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["true", "1", "yes", "on", "active", "published"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off", "draft", "archived"].includes(normalized)) {
    return false;
  }
  return fallback;
};

const normalizeAdminNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const slugifyAdminValue = (value, fallback = "item") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

const sortAdminItems = (items = []) =>
  [...items].sort((left, right) => {
    const orderDiff = normalizeAdminNumber(left?.order, 0) - normalizeAdminNumber(right?.order, 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    return String(left?.title || left?.name || left?.icao || left?.id || "").localeCompare(
      String(right?.title || right?.name || right?.icao || right?.id || "")
    );
  });

const getDefaultAcarsConfig = () => ({
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
});

const buildDefaultAdminContent = () => {
  const now = new Date().toISOString();
  return {
    version: 1,
    documents: [
      {
        id: "doc-va-rules",
        slug: "va-rules",
        title: "VA Rules",
        description: "Operating rules and conduct requirements for Nordwind Virtual pilots.",
        category: "Rules",
        contentFormat: "markdown",
        content: "Use this page to maintain the current VAC rules and operating policy.",
        published: true,
        order: 10,
        updatedAt: now,
      },
      {
        id: "doc-vatsim-guidelines",
        slug: "vatsim-guidelines",
        title: "VATSIM Guidelines",
        description: "Network etiquette, phraseology and event participation guidance.",
        category: "Network",
        contentFormat: "markdown",
        content: "Use this page to keep VATSIM-related guidance current.",
        published: true,
        order: 20,
        updatedAt: now,
      },
      {
        id: "doc-vamsys-guide",
        slug: "vamsys-guide",
        title: "vAMSYS Guide",
        description: "Pilot onboarding and daily workflow inside vAMSYS.",
        category: "Platform",
        contentFormat: "markdown",
        content: "Use this page to document booking, claims and roster workflows.",
        published: true,
        order: 30,
        updatedAt: now,
      },
    ],
    events: [],
    staff: [],
    badges: LOCAL_BADGES_CATALOG.map((badge, index) => ({
      id: `badge-${badge.id}`,
      title: badge.title,
      code: badge.id,
      color: badge.color,
      description: badge.description,
      criteria: "Managed locally",
      active: true,
      order: (index + 1) * 10,
      updatedAt: now,
    })),
    activities: [],
    acarsMessageTemplates: [
      {
        id: "acars-template-arrival-stand",
        title: "Arrival stand assignment",
        code: "ARRIVAL_STAND",
        category: "arrival",
        description: "Assign an arrival stand or gate to the crew.",
        body: "{{callsign}} ARRIVAL STAND {{stand}}. REPORT PARKED ON BLOCK.",
        active: true,
        order: 10,
        updatedAt: now,
      },
      {
        id: "acars-template-turnaround-ready",
        title: "Turnaround ready check",
        code: "TURNAROUND_READY",
        category: "turnaround",
        description: "Ask crew to confirm turnaround or handling readiness.",
        body: "{{callsign}} CONFIRM TURNAROUND STATUS AT {{arrival}}. ADVISE READY TIME.",
        active: true,
        order: 20,
        updatedAt: now,
      },
      {
        id: "acars-template-ops-note",
        title: "Operational note",
        code: "OPS_NOTE",
        category: "ops",
        description: "Generic internal dispatch note with optional free text.",
        body: "{{callsign}} OPS NOTE {{note}}",
        active: true,
        order: 30,
        updatedAt: now,
      },
    ],
    hubs: [],
    fleet: [],
    routeMeta: {},
    bookingMeta: {},
    acarsConfig: getDefaultAcarsConfig(),
    siteDesign: {
      siteTitle: "Nordwind Virtual",
      tagline: "nordwind virtual group",
      primaryColor: "#E31E24",
      accentColor: "#2A2A2A",
      headerLogoDataUrl: "",
      footerLogoDataUrl: "",
      loginLogoDataUrl: "",
      adminLogoDataUrl: "",
      updatedAt: null,
    },
    ticketCategories: [
      {
        id: "general",
        name: "General",
        description: "General support requests",
        color: "#E31E24",
        enabled: true,
        order: 10,
      },
      {
        id: "operations",
        name: "Operations",
        description: "Bookings, routes, dispatch, and flight operations",
        color: "#2563EB",
        enabled: true,
        order: 20,
      },
      {
        id: "website",
        name: "Website",
        description: "Portal and UI issues",
        color: "#0F766E",
        enabled: true,
        order: 30,
      },
      {
        id: "discord",
        name: "Discord",
        description: "Discord bot and role sync",
        color: "#7C3AED",
        enabled: true,
        order: 40,
      },
    ],
    ticketTags: [
      { id: "urgent", name: "Urgent", enabled: true, order: 10 },
      { id: "billing", name: "Billing", enabled: true, order: 20 },
      { id: "technical", name: "Technical", enabled: true, order: 30 },
      { id: "vamsys", name: "vAMSYS", enabled: true, order: 40 },
      { id: "discord", name: "Discord", enabled: true, order: 50 },
    ],
    ticketAssignees: [],
    tickets: [],
    discordBotSettings: DEFAULT_DISCORD_BOT_SETTINGS,
    telegramBotSettings: DEFAULT_TELEGRAM_BOT_SETTINGS,
  };
};

let adminContentCache = null;
let adminAuditLogCache = null;
let authActivityLogCache = null;

const readAdminContentStore = () => {
  if (adminContentCache) {
    return adminContentCache;
  }

  const base = buildDefaultAdminContent();

  try {
    ensureAuthStoreDir();
    if (!fs.existsSync(ADMIN_CONTENT_FILE)) {
      fs.writeFileSync(ADMIN_CONTENT_FILE, `${JSON.stringify(base, null, 2)}\n`, "utf8");
      adminContentCache = base;
      return adminContentCache;
    }

    const raw = fs.readFileSync(ADMIN_CONTENT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    adminContentCache = {
      ...base,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      documents: Array.isArray(parsed?.documents) ? parsed.documents : base.documents,
      events: Array.isArray(parsed?.events) ? parsed.events : base.events,
      staff: Array.isArray(parsed?.staff) ? parsed.staff : base.staff,
      badges: Array.isArray(parsed?.badges) ? parsed.badges : base.badges,
      activities: Array.isArray(parsed?.activities) ? parsed.activities : base.activities,
      acarsMessageTemplates: Array.isArray(parsed?.acarsMessageTemplates) ? parsed.acarsMessageTemplates : base.acarsMessageTemplates,
      hubs: Array.isArray(parsed?.hubs) ? parsed.hubs : base.hubs,
      fleet: Array.isArray(parsed?.fleet) ? parsed.fleet : base.fleet,
      routeMeta: parsed?.routeMeta && typeof parsed.routeMeta === "object" ? parsed.routeMeta : {},
      bookingMeta: parsed?.bookingMeta && typeof parsed.bookingMeta === "object" ? parsed.bookingMeta : {},
      ticketCategories: Array.isArray(parsed?.ticketCategories) ? parsed.ticketCategories : base.ticketCategories,
      ticketTags: Array.isArray(parsed?.ticketTags) ? parsed.ticketTags : base.ticketTags,
      ticketAssignees: Array.isArray(parsed?.ticketAssignees) ? parsed.ticketAssignees : base.ticketAssignees,
      tickets: Array.isArray(parsed?.tickets) ? parsed.tickets : base.tickets,
      acarsConfig: parsed?.acarsConfig && typeof parsed.acarsConfig === "object" ? {
        ...base.acarsConfig,
        ...parsed.acarsConfig,
      } : base.acarsConfig,
      discordBotSettings: parsed?.discordBotSettings && typeof parsed.discordBotSettings === "object" ? {
        ...base.discordBotSettings,
        ...parsed.discordBotSettings,
        sync: {
          ...base.discordBotSettings.sync,
          ...(parsed?.discordBotSettings?.sync && typeof parsed.discordBotSettings.sync === "object" ? parsed.discordBotSettings.sync : {}),
        },
        notifications: {
          ...base.discordBotSettings.notifications,
          ...(parsed?.discordBotSettings?.notifications && typeof parsed.discordBotSettings.notifications === "object" ? parsed.discordBotSettings.notifications : {}),
        },
        channels: {
          ...base.discordBotSettings.channels,
          ...(parsed?.discordBotSettings?.channels && typeof parsed.discordBotSettings.channels === "object" ? parsed.discordBotSettings.channels : {}),
        },
        templates: {
          ...base.discordBotSettings.templates,
          ...(parsed?.discordBotSettings?.templates && typeof parsed.discordBotSettings.templates === "object" ? parsed.discordBotSettings.templates : {}),
        },
      } : base.discordBotSettings,
      telegramBotSettings: parsed?.telegramBotSettings && typeof parsed.telegramBotSettings === "object" ? {
        ...base.telegramBotSettings,
        ...parsed.telegramBotSettings,
        sync: {
          ...base.telegramBotSettings.sync,
          ...(parsed?.telegramBotSettings?.sync && typeof parsed.telegramBotSettings.sync === "object" ? parsed.telegramBotSettings.sync : {}),
        },
        commands: {
          ...base.telegramBotSettings.commands,
          ...(parsed?.telegramBotSettings?.commands && typeof parsed.telegramBotSettings.commands === "object" ? parsed.telegramBotSettings.commands : {}),
        },
      } : base.telegramBotSettings,
      siteDesign: parsed?.siteDesign && typeof parsed.siteDesign === "object" ? {
        ...base.siteDesign,
        ...parsed.siteDesign,
      } : base.siteDesign,
    };
  } catch (error) {
    logger.warn("[admin-content] read_failed", String(error));
    adminContentCache = base;
  }

  return adminContentCache;
};

const persistAdminContentStore = (content) => {
  try {
    ensureAuthStoreDir();
    const nextContent = content && typeof content === "object" ? content : buildDefaultAdminContent();
    const tempPath = `${ADMIN_CONTENT_FILE}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(nextContent, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, ADMIN_CONTENT_FILE);
    adminContentCache = nextContent;
  } catch (error) {
    logger.warn("[admin-content] persist_failed", String(error));
  }
};

const withAdminContentUpdate = (updater) => {
  const current = readAdminContentStore();
  const next = updater({ ...current });
  const resolved = next && typeof next === "object" ? next : current;
  persistAdminContentStore(resolved);
  return resolved;
};

const readAdminAuditLogStore = () => {
  if (adminAuditLogCache) {
    return adminAuditLogCache;
  }

  try {
    ensureAuthStoreDir();
    if (!fs.existsSync(ADMIN_AUDIT_LOG_FILE)) {
      fs.writeFileSync(ADMIN_AUDIT_LOG_FILE, "[]\n", "utf8");
      adminAuditLogCache = [];
      return adminAuditLogCache;
    }

    const raw = fs.readFileSync(ADMIN_AUDIT_LOG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    adminAuditLogCache = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.warn("[admin-audit] read_failed", String(error));
    adminAuditLogCache = [];
  }

  return adminAuditLogCache;
};

const persistAdminAuditLogStore = (entries) => {
  try {
    ensureAuthStoreDir();
    const nextEntries = Array.isArray(entries) ? entries.slice(0, ADMIN_AUDIT_MAX_ENTRIES) : [];
    const tempPath = `${ADMIN_AUDIT_LOG_FILE}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(nextEntries, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, ADMIN_AUDIT_LOG_FILE);
    adminAuditLogCache = nextEntries;
  } catch (error) {
    logger.warn("[admin-audit] persist_failed", String(error));
  }
};

const trimAuditText = (value, maxLength = 220) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
};

const sanitizeAuditValue = (value, depth = 0) => {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return trimAuditText(value, 400);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeAuditValue(item, depth + 1));
  }

  if (typeof value !== "object") {
    return String(value);
  }

  if (depth >= 2) {
    return "[Object]";
  }

  const sensitivePattern = /(password|secret|token|authorization|cookie|avatar|image|dataurl|accessToken|refreshToken)/i;
  const entries = Object.entries(value)
    .filter(([key]) => key !== "proof" && key !== "telemetryTrack")
    .slice(0, 20)
    .map(([key, entryValue]) => [
      key,
      sensitivePattern.test(key) ? "[redacted]" : sanitizeAuditValue(entryValue, depth + 1),
    ]);

  return Object.fromEntries(entries);
};

const readAuthActivityLogStore = () => {
  if (authActivityLogCache) {
    return authActivityLogCache;
  }

  try {
    ensureAuthStoreDir();
    if (!fs.existsSync(AUTH_ACTIVITY_LOG_FILE)) {
      fs.writeFileSync(AUTH_ACTIVITY_LOG_FILE, "[]\n", "utf8");
      authActivityLogCache = [];
      return authActivityLogCache;
    }

    const raw = fs.readFileSync(AUTH_ACTIVITY_LOG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    authActivityLogCache = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.warn("[auth-activity] read_failed", String(error));
    authActivityLogCache = [];
  }

  return authActivityLogCache;
};

const persistAuthActivityLogStore = (entries) => {
  try {
    ensureAuthStoreDir();
    const nextEntries = Array.isArray(entries) ? entries.slice(0, AUTH_ACTIVITY_MAX_ENTRIES) : [];
    const tempPath = `${AUTH_ACTIVITY_LOG_FILE}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(nextEntries, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, AUTH_ACTIVITY_LOG_FILE);
    authActivityLogCache = nextEntries;
  } catch (error) {
    logger.warn("[auth-activity] persist_failed", String(error));
  }
};

const formatAuthActorDisplay = ({ name = "", username = "", fallback = "Unknown user" } = {}) => {
  const resolvedName = trimAuditText(name);
  const resolvedUsername = trimAuditText(username);
  if (resolvedName && resolvedUsername && resolvedName.toLowerCase() !== resolvedUsername.toLowerCase()) {
    return `${resolvedName} - ${resolvedUsername}`;
  }
  return resolvedName || resolvedUsername || fallback;
};

const createAuthActivityActor = ({ provider = "unknown", user = null, fallbackName = "", fallbackUsername = "", role = "" } = {}) => {
  const source = user && typeof user === "object" ? user : {};
  const name = String(
    source?.name ||
      source?.vamsysPilotName ||
      source?.globalName ||
      `${source?.first_name || ""} ${source?.last_name || ""}` ||
      fallbackName
  ).trim();
  const username = String(
    source?.username || source?.vamsysPilotUsername || source?.callsign || fallbackUsername
  ).trim();
  const resolvedRole = String(role || source?.rank || source?.role || "").trim();
  const resolvedId = String(source?.id || source?.vamsysPilotId || "").trim();

  return {
    id: resolvedId || null,
    provider,
    name: trimAuditText(name) || null,
    username: trimAuditText(username) || null,
    display: formatAuthActorDisplay({
      name,
      username,
      fallback: fallbackName || fallbackUsername || "Unknown user",
    }),
    role: trimAuditText(resolvedRole) || null,
  };
};

const appendAuthActivityEntry = (entry) => {
  const current = readAuthActivityLogStore();
  const next = [entry, ...current].slice(0, AUTH_ACTIVITY_MAX_ENTRIES);
  persistAuthActivityLogStore(next);
  return entry;
};

const filterAuthActivityEntries = ({ limit = 100, providers = [], outcomes = [] } = {}) => {
  const normalizedProviders = Array.isArray(providers)
    ? providers.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const normalizedOutcomes = Array.isArray(outcomes)
    ? outcomes.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];

  return readAuthActivityLogStore()
    .filter((entry) => {
      if (normalizedProviders.length > 0 && !normalizedProviders.includes(String(entry?.provider || "").toLowerCase())) {
        return false;
      }
      if (normalizedOutcomes.length > 0 && !normalizedOutcomes.includes(String(entry?.outcome || "").toLowerCase())) {
        return false;
      }
      return true;
    })
    .slice(0, Math.max(1, Math.min(500, Number(limit || 100) || 100)));
};

const recordAuthActivity = ({ req, provider = "unknown", type = "login", outcome = "success", message = "", actor = null, details = null } = {}) => {
  const actorEntry = actor && typeof actor === "object" ? actor : null;
  return appendAuthActivityEntry({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    provider: trimAuditText(provider) || "unknown",
    type: trimAuditText(type) || "login",
    outcome: trimAuditText(outcome) || "success",
    message: trimAuditText(message, 400) || null,
    actor: actorEntry,
    request: req
      ? {
          path: trimAuditText(req.originalUrl || req.url || "", 300) || null,
          ip: trimAuditText(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "", 120) || null,
          userAgent: trimAuditText(req.headers?.["user-agent"] || "", 220) || null,
        }
      : null,
    details: sanitizeAuditValue(details),
  });
};

const appendUniqueAuditIds = (target, ...values) => {
  values.flat().forEach((value) => {
    const numeric = Number(value || 0) || 0;
    if (numeric > 0 && !target.includes(numeric)) {
      target.push(numeric);
    }
  });
};

const inferAdminAuditTargetType = (pathname = "") => {
  if (/\/api\/admin\/pilots(?:\/|$)/.test(pathname)) return "pilot";
  if (/\/api\/admin\/fleet\/aircraft(?:\/|$)/.test(pathname)) return "aircraft";
  if (/\/api\/admin\/airports(?:\/|$)/.test(pathname)) return "airport";
  if (/\/api\/admin\/pireps(?:\/|$)/.test(pathname)) return "pirep";
  if (/\/api\/admin\/operations\/badges\/\d+\/pilots\//.test(pathname)) return "pilot";
  if (/\/api\/admin\/bookings(?:\/|$)/.test(pathname)) return "booking";
  if (/\/api\/admin\/routes(?:\/|$)/.test(pathname)) return "route";
  if (/\/api\/admin\/hubs(?:\/|$)/.test(pathname)) return "hub";
  if (/\/api\/admin\/activities(?:\/|$)/.test(pathname)) return "activity";
  if (/\/api\/admin\/notams(?:\/|$)/.test(pathname)) return "notam";
  if (/\/api\/admin\/alerts(?:\/|$)/.test(pathname)) return "alert";
  if (/\/api\/admin\/fleet\/groups(?:\/|$)/.test(pathname)) return "fleet-group";
  if (/\/api\/admin\/content\//.test(pathname)) return "content";
  return "admin";
};

const inferAdminAuditTargetId = ({ pathname = "", params = {}, body = {}, payload = {}, targetType = "admin" } = {}) => {
  if (targetType === "pilot") {
    return Number(params.pilotId || params.id || body.pilotId || body.pilot_id || payload?.profile?.id || payload?.pilot?.id || 0) || null;
  }
  if (targetType === "aircraft") {
    return Number(params.id || body.id || body.aircraftId || body.aircraft_id || payload?.aircraft?.id || 0) || null;
  }
  if (targetType === "airport") {
    return Number(params.id || body.id || body.airportId || body.airport_id || payload?.airport?.id || 0) || null;
  }
  if (targetType === "pirep") {
    return Number(params.id || body.id || body.pirepId || body.pirep_id || payload?.pirep?.id || 0) || null;
  }
  return Number(params.id || body.id || 0) || null;
};

const inferAdminAuditTargetLabel = ({ pathname = "", body = {}, payload = {}, targetType = "admin" } = {}) => {
  const profileNode = payload?.profile && typeof payload.profile === "object" ? payload.profile : null;
  const pilotNode = payload?.pilot && typeof payload.pilot === "object" ? payload.pilot : null;
  const pirepNode = payload?.pirep && typeof payload.pirep === "object" ? payload.pirep : null;

  const candidates = [
    profileNode?.name,
    profileNode?.username,
    pilotNode?.name,
    pilotNode?.username,
    payload?.name,
    payload?.title,
    payload?.label,
    payload?.flightNumber,
    payload?.callsign,
    payload?.icao,
    payload?.registration,
    pirepNode?.flightNumber,
    body?.name,
    body?.title,
    body?.label,
    body?.username,
    body?.flightNumber,
    body?.flight_number,
    body?.callsign,
    body?.model,
    body?.registration,
    body?.icao,
    body?.iata,
  ].map((value) => trimAuditText(value)).filter(Boolean);

  if (candidates.length > 0) {
    return candidates[0];
  }

  if (pathname.includes("/operations/badges/") && pathname.includes("/pilots/")) {
    return "Pilot badge assignment";
  }

  return targetType === "admin" ? null : `${targetType} update`;
};

const buildAdminAuditActionLabel = ({ method = "POST", pathname = "", targetType = "admin" } = {}) => {
  if (method === "GET") {
    return `Viewed ${targetType}`;
  }

  if (pathname.includes("/operations/badges/") && pathname.includes("/pilots/")) {
    return method === "DELETE" ? "Removed badge from pilot" : "Assigned badge to pilot";
  }

  const verb = method === "POST"
    ? "Created"
    : method === "PUT"
      ? "Updated"
      : method === "PATCH"
        ? "Patched"
        : method === "DELETE"
          ? "Deleted"
          : method;

  return `${verb} ${targetType}`;
};

const buildAdminAuditEntry = ({ req, payload = null, statusCode = 200, durationMs = 0 } = {}) => {
  const pathname = String(req.path || req.originalUrl || "").split("?")[0];
  const method = String(req.method || "POST").toUpperCase();
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const targetType = inferAdminAuditTargetType(pathname);
  const targetId = inferAdminAuditTargetId({ pathname, params: req.params || {}, body, payload, targetType });
  const targetLabel = inferAdminAuditTargetLabel({ pathname, body, payload, targetType });
  const changedKeys = Object.keys(body || {}).slice(0, 20);

  const related = {
    pilotIds: [],
    aircraftIds: [],
    airportIds: [],
    pirepIds: [],
  };

  appendUniqueAuditIds(
    related.pilotIds,
    targetType === "pilot" ? targetId : null,
    req.params?.pilotId,
    body?.pilotId,
    body?.pilot_id,
    payload?.profile?.id,
    payload?.pilot?.id,
    payload?.pirep?.pilotId,
    payload?.booking?.pilotId
  );
  appendUniqueAuditIds(
    related.aircraftIds,
    targetType === "aircraft" ? targetId : null,
    body?.aircraftId,
    body?.aircraft_id,
    payload?.aircraft?.id
  );
  appendUniqueAuditIds(
    related.airportIds,
    targetType === "airport" ? targetId : null,
    body?.airportId,
    body?.airport_id,
    body?.departureId,
    body?.departure_id,
    body?.arrivalId,
    body?.arrival_id,
    payload?.airport?.id,
    payload?.departure?.id,
    payload?.arrival?.id
  );
  appendUniqueAuditIds(
    related.pirepIds,
    targetType === "pirep" ? targetId : null,
    body?.pirepId,
    body?.pirep_id,
    payload?.pirep?.id
  );

  const adminUser = req.adminUser && typeof req.adminUser === "object" ? req.adminUser : {};

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    admin: {
      id: String(adminUser?.id || adminUser?.pilot_id || "").trim() || null,
      username: String(adminUser?.username || adminUser?.callsign || "").trim() || null,
      name: String(adminUser?.name || `${adminUser?.first_name || ""} ${adminUser?.last_name || ""}`).trim() || "Admin",
      role: String(adminUser?.rank || "admin").trim() || "admin",
    },
    action: buildAdminAuditActionLabel({ method, pathname, targetType }),
    method,
    path: pathname,
    statusCode: Number(statusCode || 200) || 200,
    durationMs: Math.max(0, Math.round(Number(durationMs || 0) || 0)),
    target: {
      type: targetType,
      id: targetId,
      label: targetLabel,
    },
    changedKeys,
    related,
    body: sanitizeAuditValue(body),
  };
};

const appendAdminAuditEntry = (entry) => {
  const current = readAdminAuditLogStore();
  const next = [entry, ...current].slice(0, ADMIN_AUDIT_MAX_ENTRIES);
  persistAdminAuditLogStore(next);
  return entry;
};

const filterAdminAuditEntries = ({ limit = 100, entityTypes = [], pilotId = null } = {}) => {
  const normalizedEntityTypes = Array.isArray(entityTypes)
    ? entityTypes.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const normalizedPilotId = Number(pilotId || 0) || 0;

  return readAdminAuditLogStore()
    .filter((entry) => {
      if (normalizedEntityTypes.length > 0 && !normalizedEntityTypes.includes(String(entry?.target?.type || "").toLowerCase())) {
        return false;
      }

      if (normalizedPilotId > 0) {
        const relatedPilotIds = Array.isArray(entry?.related?.pilotIds) ? entry.related.pilotIds.map((value) => Number(value || 0) || 0) : [];
        const targetPilotId = Number(entry?.target?.type === "pilot" ? entry?.target?.id : 0) || 0;
        if (!relatedPilotIds.includes(normalizedPilotId) && targetPilotId !== normalizedPilotId) {
          return false;
        }
      }

      return true;
    })
    .slice(0, Math.max(1, Math.min(500, Number(limit || 100) || 100)));
};

const createAdminAuditMiddleware = () => (req, res, next) => {
  const method = String(req.method || "").toUpperCase();
  const pathname = String(req.path || req.originalUrl || "").split("?")[0];
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    next();
    return;
  }

  if (pathname === "/api/admin/audit-logs") {
    next();
    return;
  }

  const startedAt = Date.now();
  let responsePayload = null;
  let alreadyLogged = false;

  const logSuccess = () => {
    if (alreadyLogged || res.statusCode >= 400) {
      return;
    }
    alreadyLogged = true;
    appendAdminAuditEntry(
      buildAdminAuditEntry({
        req,
        payload: responsePayload,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      })
    );
  };

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    responsePayload = payload;
    logSuccess();
    return originalJson(payload);
  };

  const originalSend = res.send.bind(res);
  res.send = (payload) => {
    if (responsePayload == null && payload && typeof payload === "object") {
      responsePayload = payload;
    }
    logSuccess();
    return originalSend(payload);
  };

  res.on("finish", () => {
    logSuccess();
  });

  next();
};

const MANAGED_ADMIN_COLLECTIONS = new Set(["documents", "events", "staff", "badges", "activities", "acarsMessageTemplates", "hubs"]);

const normalizePublicActivityCategory = (value) => {
  const normalized = normalizeAdminText(value).toLowerCase();
  if (normalized === "event") {
    return "Event";
  }
  if (normalized === "notam") {
    return "NOTAM";
  }
  return "News";
};

const normalizePublicActivityStatus = (value, fallback = "Published") => {
  const normalized = normalizeAdminText(value || fallback).toLowerCase();
  if (normalized === "draft") {
    return "Draft";
  }
  if (normalized === "archived") {
    return "Archived";
  }
  if (normalized === "active") {
    return "Published";
  }
  return "Published";
};

const normalizePublicNotamType = (value, fallback = "info") => {
  const normalized = normalizeAdminText(value || fallback).toLowerCase();
  if (normalized === "warning" || normalized === "critical") {
    return normalized;
  }
  return "info";
};

const normalizePublicNotamPriority = (value, fallback = "low") => {
  const normalized = normalizeAdminText(value || fallback).toLowerCase();
  if (normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "low";
};

const normalizePublicActivityDate = (...values) => {
  for (const value of values) {
    const normalized = normalizeAdminText(value);
    if (normalized) {
      return normalized;
    }
  }
  return new Date().toISOString().slice(0, 10);
};

const normalizeDocumentContentFormat = (value, fallback = "markdown") => {
  const normalized = normalizeAdminText(value || fallback).toLowerCase();
  if (normalized === "html" || normalized === "plain") {
    return normalized;
  }
  return "markdown";
};

const normalizeAdminStaffSource = (value, fallback = "manual") => {
  const normalized = normalizeAdminText(value || fallback).toLowerCase();
  return normalized === "vamsys" ? "vamsys" : "manual";
};

const extractPublicActivityImageUrl = (item = {}) => {
  const candidates = [
    item?.image,
    item?.imageDark,
    item?.image_dark,
    item?.imageUrl,
    item?.image_url,
    item?.bannerUrl,
    item?.banner_url,
    item?.coverUrl,
    item?.cover_url,
    item?.coverImage,
    item?.cover_image,
    item?.thumbnailUrl,
    item?.thumbnail_url,
    item?.heroImage,
    item?.hero_image,
    item?.posterUrl,
    item?.poster_url,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAdminText(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const toPublicManualActivity = (item = {}) => ({
  ...item,
  source: "manual",
  originalId: Number(item?.vamsysId || 0) || null,
  category: normalizePublicActivityCategory(item?.category || item?.type),
  status: normalizePublicActivityStatus(item?.status, "Published"),
  date: normalizePublicActivityDate(item?.date, item?.updatedAt),
  content: normalizeAdminText(item?.content ?? item?.description),
  summary: normalizeAdminText(item?.summary ?? item?.description),
  author: normalizeAdminText(item?.author || "Admin") || "Admin",
  tag: normalizeAdminText(item?.tag),
  linkUrl: normalizeAdminText(item?.linkUrl),
  featured: normalizeAdminBoolean(item?.featured, false),
  views: Math.max(0, normalizeAdminNumber(item?.views, 0)),
  activityType: normalizeAdminText(item?.type || item?.category || "news") || "news",
  activitySubtype: null,
  target: normalizeAdminText(item?.target),
  imageUrl: extractPublicActivityImageUrl(item),
  registrationOpen: false,
  registrations: 0,
  completions: 0,
  points: 0,
});

const toPublicLiveActivity = (item = {}) => {
  const type = normalizeAdminText(item?.type || "Event") || "Event";
  const subtype = normalizeAdminText(item?.subtype);
  const tags = Array.isArray(item?.tags) ? item.tags.map((tag) => normalizeAdminText(tag)).filter(Boolean) : [];
  const summary =
    normalizeAdminText(item?.sidebarTitle) ||
    normalizeAdminText(item?.description) ||
    normalizeAdminText(item?.target);
  const content =
    normalizeAdminText(item?.description) ||
    normalizeAdminText(item?.sidebarContent) ||
    normalizeAdminText(item?.target) ||
    "vAMSYS activity";
  const featured =
    type === "Event" ||
    type === "FocusAirport" ||
    /banner/i.test(subtype) ||
    tags.some((tag) => /banner/i.test(tag));

  return {
    id: `live-${String(item?.id || randomUUID())}`,
    source: "vamsys",
    originalId: Number(item?.originalId || item?.id || 0) || null,
    category: "Event",
    title: normalizeAdminText(item?.name || `${type} activity`) || `${type} activity`,
    content,
    summary,
    author: "vAMSYS",
    date: normalizePublicActivityDate(item?.start, item?.showFrom, item?.createdAt, item?.updatedAt),
    status: item?.status === "ended" ? "Archived" : item?.status === "hidden" ? "Draft" : "Published",
    views: Math.max(0, normalizeAdminNumber(item?.registrationCount, 0)),
    tag: tags[0] || null,
    linkUrl: null,
    featured,
    activityType: type,
    activitySubtype: subtype || null,
    target: normalizeAdminText(item?.target),
    imageUrl: extractPublicActivityImageUrl(item),
    registrationOpen: Boolean(item?.registrationOpen),
    registrations: Math.max(0, normalizeAdminNumber(item?.registrationCount, 0)),
    completions: Math.max(0, normalizeAdminNumber(item?.completionCount, 0)),
    points: Math.max(0, normalizeAdminNumber(item?.points, 0)),
    start: normalizeAdminText(item?.start),
    end: normalizeAdminText(item?.end),
    showFrom: normalizeAdminText(item?.showFrom),
    tags,
  };
};

const resolveActivityRegistrationOpen = (activity = {}) => {
  const readBoolean = (value) => {
    if (typeof value === "boolean") {
      return value;
    }
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (["1", "true", "yes", "open", "enabled"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "closed", "disabled"].includes(normalized)) {
      return false;
    }
    return null;
  };

  const explicitCandidates = [
    activity?.registration_open,
    activity?.registrationOpen,
    activity?.registrations_open,
    activity?.registrationsOpen,
    activity?.can_register,
    activity?.canRegister,
    activity?.allow_registration,
    activity?.allowRegistration,
    activity?.is_registration_open,
    activity?.isRegistrationOpen,
  ];

  for (const candidate of explicitCandidates) {
    const normalized = readBoolean(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  const now = Date.now();
  const registrationOpenAt = Date.parse(String(activity?.registration_start || activity?.registrationStart || ""));
  const registrationCloseAt = Date.parse(String(activity?.registration_end || activity?.registrationEnd || ""));

  if (Number.isFinite(registrationOpenAt) && now < registrationOpenAt) {
    return false;
  }
  if (Number.isFinite(registrationCloseAt) && now > registrationCloseAt) {
    return false;
  }

  const status = computeAdminActivityStatus(activity);
  return status === "active" || status === "upcoming";
};

const normalizeManagedAdminItem = (collection, payload = {}, existing = null) => {
  const now = new Date().toISOString();
  const id = normalizeAdminText(payload.id || existing?.id) || randomUUID();

  if (collection === "documents") {
    const title = normalizeAdminText(payload.title || existing?.title || "Untitled document");
    return {
      id,
      slug: slugifyAdminValue(payload.slug || title, id),
      title,
      description: normalizeAdminText(payload.description || existing?.description),
      category: normalizeAdminText(payload.category || existing?.category || "General"),
      content: normalizeAdminText(payload.content || existing?.content),
      contentFormat: normalizeDocumentContentFormat(payload.contentFormat, existing?.contentFormat || "markdown"),
      published: normalizeAdminBoolean(payload.published, normalizeAdminBoolean(existing?.published, true)),
      order: normalizeAdminNumber(payload.order, normalizeAdminNumber(existing?.order, 0)),
      updatedAt: now,
    };
  }

  if (collection === "events") {
    return {
      id,
      title: normalizeAdminText(payload.title || existing?.title || "Untitled event"),
      status: normalizeAdminText(payload.status || existing?.status || "planned") || "planned",
      scheduledAt: normalizeAdminText(payload.scheduledAt || existing?.scheduledAt),
      location: normalizeAdminText(payload.location || existing?.location),
      summary: normalizeAdminText(payload.summary || existing?.summary),
      description: normalizeAdminText(payload.description || existing?.description),
      order: normalizeAdminNumber(payload.order, normalizeAdminNumber(existing?.order, 0)),
      updatedAt: now,
    };
  }

  if (collection === "staff") {
    return {
      id,
      pilotId: Number(payload.pilotId || existing?.pilotId || 0) || null,
      username: normalizeAdminText(payload.username || existing?.username),
      name: normalizeAdminText(payload.name || existing?.name || "Staff member"),
      role: normalizeAdminText(payload.role || existing?.role || "Staff"),
      rank: normalizeAdminText(payload.rank || existing?.rank),
      division: normalizeAdminText(payload.division || existing?.division),
      email: normalizeAdminText(payload.email || existing?.email),
      discord: normalizeAdminText(payload.discord || existing?.discord),
      status: normalizeAdminText(payload.status || existing?.status || "active") || "active",
      bio: normalizeAdminText(payload.bio || existing?.bio),
      source: normalizeAdminStaffSource(payload.source, existing?.source || "manual"),
      syncedAt: normalizeAdminText(payload.syncedAt || existing?.syncedAt),
      order: normalizeAdminNumber(payload.order, normalizeAdminNumber(existing?.order, 0)),
      updatedAt: now,
    };
  }

  if (collection === "badges") {
    return {
      id,
      title: normalizeAdminText(payload.title || existing?.title || "Badge"),
      code: normalizeAdminText(payload.code || existing?.code || id).toUpperCase(),
      color: normalizeAdminText(payload.color || existing?.color || "#E31E24") || "#E31E24",
      description: normalizeAdminText(payload.description || existing?.description),
      criteria: normalizeAdminText(payload.criteria || existing?.criteria),
      active: normalizeAdminBoolean(payload.active, normalizeAdminBoolean(existing?.active, true)),
      order: normalizeAdminNumber(payload.order, normalizeAdminNumber(existing?.order, 0)),
      updatedAt: now,
    };
  }

  if (collection === "activities") {
    const title = normalizeAdminText(payload.title || existing?.title || "Activity");
    const category = normalizePublicActivityCategory(payload.category || existing?.category || payload.type || existing?.type || "news");
    const status = normalizePublicActivityStatus(payload.status || existing?.status || "Published");
    const type = normalizeAdminText(payload.type || existing?.type || (category === "Event" ? "event" : category === "NOTAM" ? "ops" : "news")) || "news";
    const content = normalizeAdminText(payload.content ?? existing?.content ?? payload.description ?? existing?.description);
    const summary = normalizeAdminText(payload.summary ?? existing?.summary ?? payload.description ?? existing?.description);
    return {
      id,
      title,
      slug: slugifyAdminValue(payload.slug || existing?.slug || title, id),
      category,
      type,
      status,
      author: normalizeAdminText(payload.author || existing?.author || "Admin") || "Admin",
      date: normalizeAdminText(payload.date || existing?.date || "") || now.slice(0, 10),
      target: normalizeAdminText(payload.target || existing?.target),
      summary,
      content,
      description: summary,
      tag: normalizeAdminText(payload.tag ?? existing?.tag),
      linkUrl: normalizeAdminText(payload.linkUrl ?? existing?.linkUrl),
      published: normalizeAdminBoolean(payload.published, normalizeAdminBoolean(existing?.published, true)),
      featured: normalizeAdminBoolean(payload.featured, normalizeAdminBoolean(existing?.featured, false)),
      mustRead: normalizeAdminBoolean(payload.mustRead, normalizeAdminBoolean(existing?.mustRead, false)),
      notamType: normalizePublicNotamType(payload.notamType ?? existing?.notamType),
      notamPriority: normalizePublicNotamPriority(payload.notamPriority ?? existing?.notamPriority),
      views: Math.max(0, normalizeAdminNumber(payload.views, normalizeAdminNumber(existing?.views, 0))),
      order: normalizeAdminNumber(payload.order, normalizeAdminNumber(existing?.order, 0)),
      vamsysSection: normalizeAdminText(payload.vamsysSection || existing?.vamsysSection || "events") || "events",
      vamsysId: Number(payload.vamsysId || existing?.vamsysId || 0) || null,
      vamsysSubtype: normalizeAdminText(payload.vamsysSubtype || existing?.vamsysSubtype || "routes") || "routes",
      vamsysSyncStatus: normalizeAdminText(payload.vamsysSyncStatus || existing?.vamsysSyncStatus || "pending") || "pending",
      vamsysSyncError: normalizeAdminText(payload.vamsysSyncError || existing?.vamsysSyncError),
      vamsysSyncedAt: normalizeAdminText(payload.vamsysSyncedAt || existing?.vamsysSyncedAt),
      updatedAt: now,
    };
  }

  if (collection === "acarsMessageTemplates") {
    const title = normalizeAdminText(payload.title || existing?.title || "Message template");
    const normalizedCode = normalizeAdminText(payload.code || existing?.code || title)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return {
      id,
      title,
      code: normalizedCode || `TEMPLATE_${String(id).slice(0, 8).toUpperCase()}`,
      category: normalizeAdminText(payload.category || existing?.category || "general") || "general",
      description: normalizeAdminText(payload.description || existing?.description),
      body: normalizeAdminMultilineText(payload.body ?? existing?.body ?? payload.content ?? existing?.content),
      active: normalizeAdminBoolean(payload.active, normalizeAdminBoolean(existing?.active, true)),
      order: normalizeAdminNumber(payload.order, normalizeAdminNumber(existing?.order, 0)),
      updatedAt: now,
    };
  }

  return {
    id,
    icao: normalizeAdminText(payload.icao || existing?.icao).toUpperCase(),
    name: normalizeAdminText(payload.name || existing?.name || "Hub"),
    city: normalizeAdminText(payload.city || existing?.city),
    country: normalizeAdminText(payload.country || existing?.country),
    status: normalizeAdminText(payload.status || existing?.status || "active") || "active",
    notes: normalizeAdminText(payload.notes || existing?.notes),
    order: normalizeAdminNumber(payload.order, normalizeAdminNumber(existing?.order, 0)),
    updatedAt: now,
  };
};

const listManagedAdminCollection = (collection) => {
  const store = readAdminContentStore();
  return sortAdminItems(Array.isArray(store?.[collection]) ? store[collection] : []);
};

const extractPilotRoleLabels = (pilot = {}) => {
  const labels = new Set();
  const collect = (input) => {
    if (!Array.isArray(input)) {
      return;
    }

    input.forEach((item) => {
      if (typeof item === "string") {
        const normalized = normalizeAdminText(item);
        if (normalized) {
          labels.add(normalized);
        }
        return;
      }

      if (!item || typeof item !== "object") {
        return;
      }

      const normalized = normalizeAdminText(
        item.title || item.name || item.label || item.code || item.slug
      );
      if (normalized) {
        labels.add(normalized);
      }
    });
  };

  collect(pilot?.roles);
  collect(pilot?.staff_roles);
  collect(pilot?.groups);

  return Array.from(labels);
};

const inferStaffDivision = (labels = []) => {
  const normalized = labels
    .map((value) => normalizeAdminText(value).toLowerCase())
    .filter(Boolean);

  if (normalized.some((value) => value.includes("dispatch") || value.includes("ops") || value.includes("operation"))) {
    return "Operations";
  }
  if (normalized.some((value) => value.includes("train") || value.includes("instructor") || value.includes("exam"))) {
    return "Training";
  }
  if (normalized.some((value) => value.includes("event") || value.includes("community") || value.includes("media") || value.includes("marketing"))) {
    return "Community";
  }
  if (normalized.some((value) => value.includes("hr") || value.includes("human") || value.includes("recruit"))) {
    return "HR";
  }
  if (normalized.some((value) => value.includes("ceo") || value.includes("coo") || value.includes("director") || value.includes("management") || value.includes("manager"))) {
    return "Management";
  }
  return "General";
};

const inferStaffStatusFromRoster = (pilot = {}) => {
  const status = normalizeAdminText(pilot?.status).toLowerCase();
  if (status === "banned" || status === "inactive" || status === "archived") {
    return "archived";
  }
  if (status === "frozen" || status === "leave") {
    return "leave";
  }
  return "active";
};

const findExistingStaffEntry = (items = [], { pilotId = null, email = "", username = "", name = "" } = {}) => {
  const emailKey = normalizeMatchValue(email);
  const usernameKey = normalizeMatchValue(username);
  const nameKey = normalizeMatchValue(name);

  return (
    items.find((item) => {
      const itemPilotId = Number(item?.pilotId || 0) || null;
      if (pilotId && itemPilotId && pilotId === itemPilotId) {
        return true;
      }

      if (emailKey && normalizeMatchValue(item?.email) === emailKey) {
        return true;
      }

      if (usernameKey && normalizeMatchValue(item?.username) === usernameKey) {
        return true;
      }

      return Boolean(nameKey && normalizeMatchValue(item?.name) === nameKey);
    }) || null
  );
};

const syncAdminStaffCollection = async () => {
  const [rawPilots, rosterPayload, ranksMap] = await Promise.all([
    fetchAllPages("/pilots?page[size]=300"),
    loadPilotsRoster({ force: true }),
    loadRanksMap(),
  ]);

  const existingItems = listManagedAdminCollection("staff");
  const rosterById = new Map(
    (Array.isArray(rosterPayload?.pilots) ? rosterPayload.pilots : [])
      .map((pilot) => [Number(pilot?.id || 0) || 0, pilot])
      .filter(([id]) => id > 0)
  );

  const matchedExistingIds = new Set();
  const now = new Date().toISOString();
  let nextOrder =
    existingItems.reduce((maxValue, item) => Math.max(maxValue, normalizeAdminNumber(item?.order, 0)), 0) + 10;

  const syncedItems = (Array.isArray(rawPilots) ? rawPilots : [])
    .filter((pilot) => pilot && !pilot.deleted_at && isPilotStaff(pilot))
    .map((pilot) => {
      const pilotId = Number(pilot?.id || 0) || null;
      const rosterPilot = pilotId ? rosterById.get(pilotId) || null : null;
      const existing = findExistingStaffEntry(existingItems, {
        pilotId,
        email: pilot?.email,
        username: pilot?.username,
        name: pilot?.name,
      });

      if (existing?.id) {
        matchedExistingIds.add(String(existing.id));
      }

      const roleLabels = extractPilotRoleLabels(pilot);
      const rankId = Number(pilot?.rank_id || rosterPilot?.rankId || 0) || 0;
      const rank =
        normalizeAdminText(pilot?.rank?.name || pilot?.rank_name || rosterPilot?.rank) ||
        (rankId > 0 ? ranksMap.get(rankId) || `Rank #${rankId}` : "");
      const discordLabel =
        normalizeAdminText(existing?.discord) ||
        normalizeAdminText(readDiscordUsernameFromPilot(pilot)) ||
        normalizeAdminText(readDiscordIdFromPilot(pilot));

      const item = normalizeManagedAdminItem(
        "staff",
        {
          ...existing,
          id: existing?.id,
          pilotId,
          username: normalizeAdminText(pilot?.username || rosterPilot?.username),
          name: normalizeAdminText(pilot?.name || rosterPilot?.name || existing?.name || "Staff member"),
          email: normalizeAdminText(pilot?.email || rosterPilot?.email || existing?.email),
          role: normalizeAdminText(existing?.role || roleLabels[0] || "Staff") || "Staff",
          rank,
          division: normalizeAdminText(existing?.division || inferStaffDivision(roleLabels) || "General") || "General",
          discord: discordLabel,
          status: inferStaffStatusFromRoster(rosterPilot || pilot),
          bio: normalizeAdminText(existing?.bio),
          source: "vamsys",
          syncedAt: now,
          order: existing ? normalizeAdminNumber(existing?.order, 0) : nextOrder,
        },
        existing || null
      );

      if (!existing) {
        nextOrder += 10;
      }

      return item;
    });

  const staleSyncedItems = existingItems
    .filter(
      (item) =>
        normalizeAdminStaffSource(item?.source, "manual") === "vamsys" && !matchedExistingIds.has(String(item?.id || ""))
    )
    .map((item) =>
      normalizeManagedAdminItem(
        "staff",
        {
          ...item,
          status: "archived",
          syncedAt: now,
          source: "vamsys",
        },
        item
      )
    );

  const untouchedManualItems = existingItems.filter(
    (item) =>
      normalizeAdminStaffSource(item?.source, "manual") !== "vamsys" && !matchedExistingIds.has(String(item?.id || ""))
  );

  const nextItems = sortAdminItems([...untouchedManualItems, ...staleSyncedItems, ...syncedItems]);
  const nextStore = withAdminContentUpdate((draft) => ({
    ...draft,
    staff: nextItems,
  }));

  return {
    items: sortAdminItems(Array.isArray(nextStore?.staff) ? nextStore.staff : nextItems),
    stats: {
      synced: syncedItems.length,
      archived: staleSyncedItems.length,
      manual: untouchedManualItems.length,
    },
  };
};

const upsertManagedAdminCollectionItem = (collection, payload = {}, id = null) => {
  const store = withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.[collection]) ? [...draft[collection]] : [];
    const targetId = normalizeAdminText(id || payload.id);
    const currentIndex = targetId ? items.findIndex((item) => String(item?.id) === targetId) : -1;
    const existing = currentIndex >= 0 ? items[currentIndex] : null;
    const nextItem = normalizeManagedAdminItem(collection, payload, existing);

    if (currentIndex >= 0) {
      items[currentIndex] = nextItem;
    } else {
      items.push(nextItem);
    }

    draft[collection] = sortAdminItems(items);
    return draft;
  });

  return (Array.isArray(store?.[collection]) ? store[collection] : []).find((item) => String(item?.id) === String(id || payload.id || "")) ||
    (Array.isArray(store?.[collection]) ? store[collection] : []).slice(-1)[0] ||
    null;
};

const getManagedAdminCollectionItem = (collection, id) => {
  if (!id) {
    return null;
  }
  const items = listManagedAdminCollection(collection);
  return items.find((item) => String(item?.id || "") === String(id)) || null;
};

const isManagedEventActivity = (item = {}) =>
  normalizePublicActivityCategory(item?.category || item?.type) === "Event";

const resolveVamsysSectionForManagedActivity = (item = {}) => {
  const normalized = normalizeAdminText(item?.vamsysSection || "events").toLowerCase();
  if (["events", "focus-airports", "rosters", "community-goals", "community-challenges"].includes(normalized)) {
    return normalized;
  }
  return "events";
};

const buildManagedActivityWindow = (item = {}) => {
  const explicitStart = normalizeAdminText(item?.start || item?.vamsysStart);
  const explicitEnd = normalizeAdminText(item?.end || item?.vamsysEnd);
  const explicitShowFrom = normalizeAdminText(item?.showFrom || item?.vamsysShowFrom);

  if (explicitStart && explicitEnd) {
    return {
      start: explicitStart,
      end: explicitEnd,
      show_from: explicitShowFrom || explicitStart,
    };
  }

  const parsedDate = Date.parse(String(item?.date || ""));
  if (Number.isFinite(parsedDate)) {
    const start = new Date(parsedDate);
    const end = new Date(parsedDate + 24 * 60 * 60 * 1000);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      show_from: start.toISOString(),
    };
  }

  const now = new Date();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return {
    start: now.toISOString(),
    end: tomorrow.toISOString(),
    show_from: now.toISOString(),
  };
};

const buildVamsysPayloadFromManagedActivity = (item = {}) => {
  const tag = normalizeAdminText(item?.tag);
  const tags = tag ? [tag] : [];
  const window = buildManagedActivityWindow(item);
  const subtype = normalizeAdminText(item?.vamsysSubtype || item?.subtype || "routes") || "routes";
  const points = Math.max(0, Number(item?.points || item?.views || 0) || 0);

  const basePayload = {
    name: normalizeAdminText(item?.title || item?.name || "Event") || "Event",
    description: normalizeAdminText(item?.content || item?.summary || item?.description),
    sidebar_title: normalizeAdminText(item?.summary || item?.title || "Event"),
    sidebar_content: normalizeAdminText(item?.content || item?.summary || item?.description),
    points,
    time_award_scale: Number(item?.time_award_scale || 3) || 3,
    tags,
    ...window,
  };

  const customPayload = item?.vamsysPayload && typeof item.vamsysPayload === "object" ? item.vamsysPayload : null;
  if (customPayload) {
    return { ...basePayload, ...customPayload };
  }

  if (resolveVamsysSectionForManagedActivity(item) === "events") {
    return {
      ...basePayload,
      subtype,
      allow_repeat_participation: normalizeAdminBoolean(item?.allow_repeat_participation, false),
      registration_required: normalizeAdminBoolean(item?.registration_required, false),
      routes: Array.isArray(item?.routes) ? item.routes : [],
      departure_airport_ids: Array.isArray(item?.departure_airport_ids) ? item.departure_airport_ids : [],
      arrival_airport_ids: Array.isArray(item?.arrival_airport_ids) ? item.arrival_airport_ids : [],
    };
  }

  return basePayload;
};

const syncManagedActivityToVamsys = async (item = {}, { action = "upsert" } = {}) => {
  const section = resolveVamsysSectionForManagedActivity(item);
  const linkedId = Number(item?.vamsysId || 0) || 0;

  if (action === "delete") {
    if (linkedId <= 0) {
      return { ok: true, vamsysId: null, section, syncedAt: new Date().toISOString(), syncError: "" };
    }

    await apiRequest(`/activities/${section}/${linkedId}`, { method: "DELETE" });
    return { ok: true, vamsysId: null, section, syncedAt: new Date().toISOString(), syncError: "" };
  }

  const payload = buildVamsysPayloadFromManagedActivity(item);
  if (linkedId > 0) {
    const updated = await apiRequest(`/activities/${section}/${linkedId}`, { method: "PUT", body: payload });
    const nextId = Number(updated?.id || updated?.data?.id || linkedId) || linkedId;
    return { ok: true, vamsysId: nextId, section, syncedAt: new Date().toISOString(), syncError: "" };
  }

  const created = await apiRequest(`/activities/${section}`, { method: "POST", body: payload });
  const nextId = Number(created?.id || created?.data?.id || 0) || 0;
  if (nextId <= 0) {
    throw new Error("vAMSYS did not return created activity id");
  }
  return { ok: true, vamsysId: nextId, section, syncedAt: new Date().toISOString(), syncError: "" };
};

const deleteManagedAdminCollectionItem = (collection, id) => {
  const targetId = normalizeAdminText(id);
  let deleted = false;

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.[collection]) ? draft[collection] : [];
    const nextItems = items.filter((item) => {
      const keep = String(item?.id) !== targetId;
      if (!keep) {
        deleted = true;
      }
      return keep;
    });
    draft[collection] = nextItems;
    return draft;
  });

  return deleted;
};

const normalizeFleetAircraftItem = (payload = {}, existing = null) => ({
  id: normalizeAdminText(payload.id || existing?.id) || randomUUID(),
  model: normalizeAdminText(payload.model || existing?.model || "Aircraft"),
  registration: normalizeAdminText(payload.registration || existing?.registration).toUpperCase(),
  seats: normalizeAdminNumber(payload.seats, normalizeAdminNumber(existing?.seats, 0)),
  range_nm: normalizeAdminNumber(payload.range_nm ?? payload.rangeNm, normalizeAdminNumber(existing?.range_nm, 0)),
  cruise_speed: normalizeAdminNumber(
    payload.cruise_speed ?? payload.cruiseSpeed,
    normalizeAdminNumber(existing?.cruise_speed, 0)
  ),
  serviceable: normalizeAdminBoolean(payload.serviceable, normalizeAdminBoolean(existing?.serviceable, true)),
  status: normalizeAdminText(payload.status || existing?.status || "active") || "active",
  baseHubId: normalizeAdminText(payload.baseHubId || existing?.baseHubId),
  notes: normalizeAdminText(payload.notes || existing?.notes),
});

const inferFleetAirlineCode = (payload = {}) => {
  const source = [
    payload?.airlineCode,
    payload?.airline,
    payload?.vac,
    payload?.name,
    payload?.code,
    payload?.notes,
  ]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean)
    .join(" ");

  if (source.includes("STW") || source.includes("SOUTHWIND")) {
    return "STW";
  }

  if (source.includes("KAR") || source.includes("IKAR") || source.includes("PEGAS")) {
    return "KAR";
  }

  return "NWS";
};

const normalizeFleetGroupItem = (payload = {}, existing = null) => ({
  id: normalizeAdminText(payload.id || existing?.id) || randomUUID(),
  name: normalizeAdminText(payload.name || existing?.name || "Fleet group"),
  code: normalizeAdminText(payload.code || existing?.code).toUpperCase(),
  airlineCode: inferFleetAirlineCode(payload?.airlineCode ? payload : existing ? { ...existing, ...payload } : payload),
  color: normalizeAdminText(payload.color || existing?.color || "#E31E24") || "#E31E24",
  status: normalizeAdminText(payload.status || existing?.status || "active") || "active",
  baseHubId: normalizeAdminText(payload.baseHubId || existing?.baseHubId),
  notes: normalizeAdminText(payload.notes || existing?.notes),
  source: normalizeAdminText(payload.source || existing?.source || "local") || "local",
  aircraft: Array.isArray(existing?.aircraft) ? existing.aircraft : [],
});

const buildFleetCatalogFromLivePayload = (payload = { fleets: [] }) => {
  const fleets = Array.isArray(payload?.fleets) ? payload.fleets : [];
  return fleets.map((fleet, fleetIndex) => ({
    id: normalizeAdminText(fleet?.id) || `fleet-${fleetIndex + 1}`,
    name: normalizeAdminText(fleet?.name || fleet?.code || `Fleet ${fleetIndex + 1}`),
    code: normalizeAdminText(fleet?.code).toUpperCase(),
    airlineCode: inferFleetAirlineCode(fleet),
    color: normalizeAdminText(fleet?.color || "#E31E24") || "#E31E24",
    status: "active",
    baseHubId: "",
    notes: "",
    source: "vamsys",
    aircraft: (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map((item, aircraftIndex) => ({
      id: normalizeAdminText(item?.id) || `aircraft-${fleetIndex + 1}-${aircraftIndex + 1}`,
      model: normalizeAdminText(item?.model || item?.name || "Aircraft"),
      registration: normalizeAdminText(item?.registration).toUpperCase(),
      seats: normalizeAdminNumber(item?.seats, 0),
      range_nm: normalizeAdminNumber(item?.range_nm, 0),
      cruise_speed: normalizeAdminNumber(item?.cruise_speed, 0),
      serviceable: normalizeAdminBoolean(item?.serviceable, true),
      status: normalizeAdminBoolean(item?.serviceable, true) ? "active" : "maintenance",
      baseHubId: "",
      notes: "",
    })),
  }));
};

const getManagedFleetCatalog = async ({ syncLive = false } = {}) => {
  const store = readAdminContentStore();
  const currentFleet = Array.isArray(store?.fleet) ? store.fleet : [];

  if (!syncLive && currentFleet.length > 0) {
    return { fleets: currentFleet };
  }

  const liveFleet = await loadFleetData().catch(() => ({ fleets: [] }));
  const seededFleet = buildFleetCatalogFromLivePayload(liveFleet);

  if (!syncLive && seededFleet.length === 0) {
    return { fleets: currentFleet };
  }

  const nextFleet = syncLive || currentFleet.length === 0 ? seededFleet : currentFleet;
  const updated = withAdminContentUpdate((draft) => {
    draft.fleet = nextFleet;
    return draft;
  });

  return { fleets: Array.isArray(updated?.fleet) ? updated.fleet : [] };
};

const upsertFleetGroup = async (payload = {}, id = null) => {
  await getManagedFleetCatalog();
  const targetId = normalizeAdminText(id || payload.id);
  const updated = withAdminContentUpdate((draft) => {
    const fleets = Array.isArray(draft?.fleet) ? [...draft.fleet] : [];
    const currentIndex = targetId ? fleets.findIndex((item) => String(item?.id) === targetId) : -1;
    const existing = currentIndex >= 0 ? fleets[currentIndex] : null;
    const nextItem = normalizeFleetGroupItem(payload, existing);
    nextItem.aircraft = Array.isArray(existing?.aircraft) ? existing.aircraft : [];

    if (currentIndex >= 0) {
      fleets[currentIndex] = nextItem;
    } else {
      fleets.push(nextItem);
    }

    draft.fleet = sortAdminItems(fleets);
    return draft;
  });

  return (Array.isArray(updated?.fleet) ? updated.fleet : []).find(
    (item) => String(item?.id) === String(targetId || payload.id || "")
  ) || (Array.isArray(updated?.fleet) ? updated.fleet : []).slice(-1)[0] || null;
};

const deleteFleetGroup = async (groupId) => {
  await getManagedFleetCatalog();
  const targetId = normalizeAdminText(groupId);
  let deleted = false;

  withAdminContentUpdate((draft) => {
    const fleets = Array.isArray(draft?.fleet) ? draft.fleet : [];
    draft.fleet = fleets.filter((item) => {
      const keep = String(item?.id) !== targetId;
      if (!keep) {
        deleted = true;
      }
      return keep;
    });
    return draft;
  });

  return deleted;
};

const upsertFleetAircraft = async (payload = {}, aircraftId = null) => {
  await getManagedFleetCatalog();
  const groupId = normalizeAdminText(payload.groupId || payload.fleetId);
  if (!groupId) {
    throw new Error("groupId is required");
  }

  const targetAircraftId = normalizeAdminText(aircraftId || payload.id);
  const updated = withAdminContentUpdate((draft) => {
    const fleets = Array.isArray(draft?.fleet) ? [...draft.fleet] : [];
    const groupIndex = fleets.findIndex((item) => String(item?.id) === groupId);
    if (groupIndex < 0) {
      throw new Error("Fleet group not found");
    }

    const group = { ...fleets[groupIndex] };
    const aircraft = Array.isArray(group?.aircraft) ? [...group.aircraft] : [];
    const currentIndex = targetAircraftId
      ? aircraft.findIndex((item) => String(item?.id) === targetAircraftId)
      : -1;
    const existing = currentIndex >= 0 ? aircraft[currentIndex] : null;
    const nextItem = normalizeFleetAircraftItem(payload, existing);

    if (currentIndex >= 0) {
      aircraft[currentIndex] = nextItem;
    } else {
      aircraft.push(nextItem);
    }

    group.aircraft = sortAdminItems(aircraft);
    fleets[groupIndex] = group;
    draft.fleet = sortAdminItems(fleets);
    return draft;
  });

  const group = (Array.isArray(updated?.fleet) ? updated.fleet : []).find((item) => String(item?.id) === groupId);
  return (Array.isArray(group?.aircraft) ? group.aircraft : []).find(
    (item) => String(item?.id) === String(targetAircraftId || payload.id || "")
  ) || (Array.isArray(group?.aircraft) ? group.aircraft : []).slice(-1)[0] || null;
};

const deleteFleetAircraft = async (aircraftId) => {
  await getManagedFleetCatalog();
  const targetId = normalizeAdminText(aircraftId);
  let deleted = false;

  withAdminContentUpdate((draft) => {
    draft.fleet = (Array.isArray(draft?.fleet) ? draft.fleet : []).map((fleet) => {
      const aircraft = Array.isArray(fleet?.aircraft) ? fleet.aircraft : [];
      const nextAircraft = aircraft.filter((item) => {
        const keep = String(item?.id) !== targetId;
        if (!keep) {
          deleted = true;
        }
        return keep;
      });
      return {
        ...fleet,
        aircraft: nextAircraft,
      };
    });
    return draft;
  });

  return deleted;
};

const getRouteMetaStore = () => {
  const store = readAdminContentStore();
  return store?.routeMeta && typeof store.routeMeta === "object" ? store.routeMeta : {};
};

const getBookingMetaStore = () => {
  const store = readAdminContentStore();
  return store?.bookingMeta && typeof store.bookingMeta === "object" ? store.bookingMeta : {};
};

const normalizeAdminImageDataUrl = (value, fallback = "") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (!/^data:image\//i.test(normalized)) {
    return String(fallback || "").trim();
  }

  return normalized.length <= 3_000_000 ? normalized : String(fallback || "").trim();
};

const getSiteDesignStore = () => {
  const store = readAdminContentStore();
  const defaults = buildDefaultAdminContent().siteDesign;
  return store?.siteDesign && typeof store.siteDesign === "object"
    ? { ...defaults, ...store.siteDesign }
    : defaults;
};

const normalizeSiteDesignPayload = (payload = {}, current = null) => {
  const existing = current && typeof current === "object" ? current : getSiteDesignStore();
  return {
    siteTitle: normalizeAdminText(payload.siteTitle ?? existing.siteTitle ?? "Nordwind Virtual") || "Nordwind Virtual",
    tagline: normalizeAdminText(payload.tagline ?? existing.tagline ?? "nordwind virtual group") || "nordwind virtual group",
    primaryColor: normalizeAdminText(payload.primaryColor ?? existing.primaryColor ?? "#E31E24") || "#E31E24",
    accentColor: normalizeAdminText(payload.accentColor ?? existing.accentColor ?? "#2A2A2A") || "#2A2A2A",
    headerLogoDataUrl: normalizeAdminImageDataUrl(payload.headerLogoDataUrl, existing.headerLogoDataUrl),
    footerLogoDataUrl: normalizeAdminImageDataUrl(payload.footerLogoDataUrl, existing.footerLogoDataUrl),
    loginLogoDataUrl: normalizeAdminImageDataUrl(payload.loginLogoDataUrl, existing.loginLogoDataUrl),
    adminLogoDataUrl: normalizeAdminImageDataUrl(payload.adminLogoDataUrl, existing.adminLogoDataUrl),
    updatedAt: new Date().toISOString(),
  };
};

const upsertSiteDesignStore = (payload = {}) => {
  const current = getSiteDesignStore();
  const updated = withAdminContentUpdate((draft) => {
    draft.siteDesign = normalizeSiteDesignPayload(payload, current);
    return draft;
  });

  return updated?.siteDesign || getSiteDesignStore();
};

const normalizeTicketStatus = (value, fallback = "open") => {
  const normalized = normalizeAdminText(value || fallback).toLowerCase();
  if (["open", "in_progress", "resolved", "closed"].includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const normalizeTicketPriority = (value, fallback = "normal") => {
  const normalized = normalizeAdminText(value || fallback).toLowerCase();
  if (["low", "normal", "high", "critical"].includes(normalized)) {
    return normalized;
  }
  return fallback;
};

const sortTicketConfigItems = (items = []) =>
  [...(Array.isArray(items) ? items : [])]
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      ...item,
      id: normalizeAdminText(item.id || item.name || `item-${index + 1}`),
      name: normalizeAdminText(item.name || item.label || item.title || item.id || `Item ${index + 1}`),
      description: normalizeAdminText(item.description),
      color: normalizeAdminText(item.color || "#E31E24") || "#E31E24",
      enabled: normalizeAdminBoolean(item.enabled, true),
      order: normalizeAdminNumber(item.order, (index + 1) * 10),
    }))
    .filter((item) => item.id && item.name)
    .sort((left, right) => {
      const orderDiff = normalizeAdminNumber(left.order, 0) - normalizeAdminNumber(right.order, 0);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });

const getDiscordBotSettingsStore = () => {
  const store = readAdminContentStore();
  const defaults = DEFAULT_DISCORD_BOT_SETTINGS;
  const existing = store?.discordBotSettings && typeof store.discordBotSettings === "object"
    ? store.discordBotSettings
    : {};

  return {
    ...defaults,
    ...existing,
    sync: {
      ...defaults.sync,
      ...(existing?.sync && typeof existing.sync === "object" ? existing.sync : {}),
    },
    notifications: {
      ...defaults.notifications,
      ...(existing?.notifications && typeof existing.notifications === "object" ? existing.notifications : {}),
    },
    channels: {
      ...defaults.channels,
      ...(existing?.channels && typeof existing.channels === "object" ? existing.channels : {}),
    },
    pirepAlerts: {
      ...defaults.pirepAlerts,
      ...(existing?.pirepAlerts && typeof existing.pirepAlerts === "object" ? existing.pirepAlerts : {}),
    },
    templates: {
      ...defaults.templates,
      ...(existing?.templates && typeof existing.templates === "object" ? existing.templates : {}),
    },
  };
};

const upsertDiscordBotSettingsStore = (payload = {}) => {
  const current = getDiscordBotSettingsStore();
  const updated = withAdminContentUpdate((draft) => {
    draft.discordBotSettings = {
      ...current,
      ...(payload && typeof payload === "object" ? payload : {}),
      sync: {
        ...current.sync,
        ...(payload?.sync && typeof payload.sync === "object" ? payload.sync : {}),
      },
      notifications: {
        ...current.notifications,
        ...(payload?.notifications && typeof payload.notifications === "object" ? payload.notifications : {}),
      },
      channels: {
        ...current.channels,
        ...(payload?.channels && typeof payload.channels === "object" ? payload.channels : {}),
      },
      pirepAlerts: {
        ...current.pirepAlerts,
        ...(payload?.pirepAlerts && typeof payload.pirepAlerts === "object" ? payload.pirepAlerts : {}),
      },
      templates: {
        ...current.templates,
        ...(payload?.templates && typeof payload.templates === "object" ? payload.templates : {}),
      },
      updatedAt: new Date().toISOString(),
    };
    return draft;
  });

  return updated?.discordBotSettings || getDiscordBotSettingsStore();
};

const getTelegramBotSettingsStore = () => {
  const store = readAdminContentStore();
  const defaults = DEFAULT_TELEGRAM_BOT_SETTINGS;
  const existing = store?.telegramBotSettings && typeof store.telegramBotSettings === "object"
    ? store.telegramBotSettings
    : {};

  return {
    ...defaults,
    ...existing,
    sync: {
      ...defaults.sync,
      ...(existing?.sync && typeof existing.sync === "object" ? existing.sync : {}),
    },
    commands: {
      ...defaults.commands,
      ...(existing?.commands && typeof existing.commands === "object" ? existing.commands : {}),
    },
  };
};

const upsertTelegramBotSettingsStore = (payload = {}) => {
  const current = getTelegramBotSettingsStore();
  const updated = withAdminContentUpdate((draft) => {
    draft.telegramBotSettings = {
      ...current,
      ...(payload && typeof payload === "object" ? payload : {}),
      sync: {
        ...current.sync,
        ...(payload?.sync && typeof payload.sync === "object" ? payload.sync : {}),
      },
      commands: {
        ...current.commands,
        ...(payload?.commands && typeof payload.commands === "object" ? payload.commands : {}),
      },
      updatedAt: new Date().toISOString(),
    };
    return draft;
  });

  return updated?.telegramBotSettings || getTelegramBotSettingsStore();
};

const getTicketConfigStore = () => {
  const store = readAdminContentStore();
  const defaults = buildDefaultAdminContent();

  return {
    enabled: normalizeAdminBoolean(store?.ticketsEnabled, true),
    categories: sortTicketConfigItems(Array.isArray(store?.ticketCategories) ? store.ticketCategories : defaults.ticketCategories),
    tags: sortTicketConfigItems(Array.isArray(store?.ticketTags) ? store.ticketTags : defaults.ticketTags),
    assignees: sortTicketConfigItems(Array.isArray(store?.ticketAssignees) ? store.ticketAssignees : defaults.ticketAssignees),
    updatedAt: normalizeAdminText(store?.ticketsUpdatedAt),
  };
};

const upsertTicketConfigStore = (payload = {}) => {
  const current = getTicketConfigStore();
  const updated = withAdminContentUpdate((draft) => {
    draft.ticketsEnabled = normalizeAdminBoolean(payload.enabled, current.enabled);
    draft.ticketCategories = payload.categories ? sortTicketConfigItems(payload.categories) : current.categories;
    draft.ticketTags = payload.tags ? sortTicketConfigItems(payload.tags) : current.tags;
    draft.ticketAssignees = payload.assignees ? sortTicketConfigItems(payload.assignees) : current.assignees;
    draft.ticketsUpdatedAt = new Date().toISOString();
    return draft;
  });

  return {
    enabled: normalizeAdminBoolean(updated?.ticketsEnabled, true),
    categories: sortTicketConfigItems(updated?.ticketCategories),
    tags: sortTicketConfigItems(updated?.ticketTags),
    assignees: sortTicketConfigItems(updated?.ticketAssignees),
    updatedAt: normalizeAdminText(updated?.ticketsUpdatedAt),
  };
};

const listTicketsStore = () => {
  const store = readAdminContentStore();
  const items = Array.isArray(store?.tickets) ? store.tickets : [];
  return [...items]
    .filter((item) => item && typeof item === "object")
    .sort((left, right) => {
      const rightTime = Date.parse(String(right?.updatedAt || right?.createdAt || ""));
      const leftTime = Date.parse(String(left?.updatedAt || left?.createdAt || ""));
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
};

const getNextTicketNumber = () => {
  const maxNumber = listTicketsStore().reduce((maxValue, item) => {
    const value = Number(item?.number || 0) || 0;
    return value > maxValue ? value : maxValue;
  }, 999);
  return maxNumber + 1;
};

const STALE_PIREP_AUTO_TICKET_WINDOW_MS = 24 * 60 * 60 * 1000;
const STALE_PIREP_AUTO_TICKET_SCAN_INTERVAL_MS = 15 * 60 * 1000;
const STALE_PIREP_AUTO_TICKET_PAGE_SIZE = 100;
const STALE_PIREP_AUTO_TICKET_MAX_PAGES = 5;
const STALE_PIREP_AUTO_TICKET_STATUSES = ["pending", "manual"];

let stalePirepAutoTicketScanPromise = null;

const resolveTicketActor = async (req) => {
  const vamsysSession = getVamsysSessionFromRequest(req);
  const discordSession = getDiscordSessionFromRequest(req);
  if (!vamsysSession && !discordSession) {
    return null;
  }

  const context = await resolveCurrentPilotContext(req).catch(() => null);
  const pilot = context?.pilot && typeof context.pilot === "object" ? context.pilot : {};
  const discordUser = discordSession?.user && typeof discordSession.user === "object" ? discordSession.user : {};

  const pilotId = Number(context?.pilotId || pilot?.id || 0) || null;
  const discordId = normalizeAdminText(discordUser?.id || readDiscordIdFromPilot(pilot) || "") || null;
  const username = normalizeAdminText(pilot?.username || discordUser?.username || "") || "pilot";
  const name =
    normalizeAdminText(pilot?.name || discordUser?.globalName || discordUser?.username || username || "Pilot") ||
    "Pilot";

  return {
    pilotId,
    discordId,
    username,
    name,
    provider: vamsysSession ? "vamsys" : "discord",
    isAdmin: Boolean(vamsysSession && isVamsysAdmin(vamsysSession.user || {})),
    discordSession: Boolean(discordSession),
  };
};

const canActorAccessTicket = (ticket, actor) => {
  if (!ticket || !actor) {
    return false;
  }
  if (actor.isAdmin) {
    return true;
  }

  const owner = ticket?.owner && typeof ticket.owner === "object" ? ticket.owner : {};
  if (actor.pilotId && Number(owner?.pilotId || 0) === Number(actor.pilotId)) {
    return true;
  }
  if (actor.discordId && normalizeAdminText(owner?.discordId) === normalizeAdminText(actor.discordId)) {
    return true;
  }
  if (actor.username && normalizeAdminText(owner?.username).toLowerCase() === actor.username.toLowerCase()) {
    return true;
  }

  return false;
};

const sanitizeTicketForViewer = (ticket, actor) => {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  const unreadCount = actor?.isAdmin
    ? Number(ticket?.unreadByStaff || 0) || 0
    : Number(ticket?.unreadByOwner || 0) || 0;

  return {
    ...ticket,
    messages,
    unreadCount,
  };
};

const resolvePilotSupportTicketOwner = (context = {}) => {
  const pilot = context?.pilot && typeof context.pilot === "object" ? context.pilot : {};
  const pilotId = Number(context?.pilotId || pilot?.id || 0) || null;
  const username = normalizeAdminText(pilot?.username || pilot?.callsign || "") || (pilotId ? `pilot-${pilotId}` : "pilot");
  const name = normalizeAdminText(pilot?.name || username || "Pilot") || "Pilot";

  return {
    pilotId,
    discordId: normalizeAdminText(readDiscordIdFromPilot(pilot) || "") || null,
    username,
    name,
    provider: "vamsys",
  };
};

const resolveOperationsTicketCategory = (config = getTicketConfigStore()) => {
  const enabledCategories = Array.isArray(config?.categories)
    ? config.categories.filter((item) => normalizeAdminBoolean(item?.enabled, true))
    : [];

  return (
    enabledCategories.find((item) => normalizeAdminText(item?.id || "").toLowerCase() === "operations") ||
    enabledCategories[0] ||
    null
  );
};

const resolveOutdatedFlightReportTags = (config = getTicketConfigStore()) => {
  const enabledTagIds = new Set(
    (Array.isArray(config?.tags) ? config.tags : [])
      .filter((item) => normalizeAdminBoolean(item?.enabled, true))
      .map((item) => normalizeAdminText(item?.id || ""))
      .filter(Boolean)
  );

  return ["technical", "vamsys"].filter((item) => enabledTagIds.has(item));
};

const findActiveOutdatedRouteReportTicket = (tickets = [], routeId, owner = {}) => {
  const normalizedRouteId = Number(routeId || 0) || 0;
  const ownerPilotId = Number(owner?.pilotId || 0) || 0;
  const ownerUsername = normalizeAdminText(owner?.username || "").toLowerCase();

  return tickets.find((ticket) => {
    const report = ticket?.routeReport && typeof ticket.routeReport === "object" ? ticket.routeReport : {};
    const ticketRouteId = Number(report?.routeId || ticket?.relatedRouteId || 0) || 0;
    if (ticketRouteId !== normalizedRouteId) {
      return false;
    }

    if (normalizeTicketStatus(ticket?.status, "open") === "closed") {
      return false;
    }

    const ticketOwner = ticket?.owner && typeof ticket.owner === "object" ? ticket.owner : {};
    const ticketOwnerPilotId = Number(ticketOwner?.pilotId || 0) || 0;
    const ticketOwnerUsername = normalizeAdminText(ticketOwner?.username || "").toLowerCase();

    if (ownerPilotId > 0 && ticketOwnerPilotId === ownerPilotId) {
      return true;
    }

    return Boolean(ownerUsername && ticketOwnerUsername && ticketOwnerUsername === ownerUsername);
  }) || null;
};

const buildOutdatedRouteReportTicket = ({ route = {}, owner = {}, config = getTicketConfigStore() } = {}) => {
  const category = resolveOperationsTicketCategory(config);
  if (!category) {
    return null;
  }

  const now = new Date().toISOString();
  const routeId = Number(route?.id || 0) || 0;
  const flightLabel =
    normalizeAdminText(route?.flightNumber || route?.callsign || "") ||
    (routeId > 0 ? `Route ${routeId}` : "Route");
  const fromCode = normalizeAdminText(route?.fromCode || "").toUpperCase() || "—";
  const toCode = normalizeAdminText(route?.toCode || "").toUpperCase() || "—";
  const routeText = normalizeAdminMultilineText(route?.routeText || "") || null;
  const contentLines = [
    `Pilot reported route ${flightLabel} as outdated.`,
    `Route ID: ${routeId || "unknown"}`,
    `Sector: ${fromCode} -> ${toCode}`,
    `Reporter: ${owner?.name || "Pilot"} (${owner?.username || "unknown"})`,
    "Reason: the flight appears to be no longer active and should be reviewed by staff.",
  ];

  if (routeText) {
    contentLines.push(`Filed route: ${routeText}`);
  }

  return {
    id: randomUUID(),
    number: getNextTicketNumber(),
    subject: `Outdated flight report: ${flightLabel}`,
    categoryId: category.id,
    categoryName: category.name,
    status: "open",
    priority: "normal",
    tags: resolveOutdatedFlightReportTags(config),
    assigneeId: null,
    assigneeName: null,
    owner,
    messages: [
      {
        id: randomUUID(),
        authorRole: "pilot",
        authorName: owner?.name || "Pilot",
        authorUsername: owner?.username || "pilot",
        content: contentLines.join("\n"),
        createdAt: now,
      },
    ],
    unreadByOwner: 0,
    unreadByStaff: 1,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    source: "pilot-route-report",
    relatedRouteId: routeId,
    routeReport: {
      type: "outdated-flight",
      routeId,
      flightNumber: flightLabel,
      callsign: normalizeAdminText(route?.callsign || "") || null,
      fromCode,
      toCode,
      routeText,
      reportedAt: now,
    },
  };
};

const createOutdatedRouteReportTicket = ({ route = {}, context = {} } = {}) => {
  const config = getTicketConfigStore();
  if (!config.enabled) {
    return { ticket: null, duplicate: false, error: "Ticket system is temporarily disabled" };
  }

  const owner = resolvePilotSupportTicketOwner(context);
  const existingTicket = findActiveOutdatedRouteReportTicket(listTicketsStore(), route?.id, owner);
  if (existingTicket) {
    return { ticket: existingTicket, duplicate: true, error: null };
  }

  const ticket = buildOutdatedRouteReportTicket({ route, owner, config });
  if (!ticket) {
    return { ticket: null, duplicate: false, error: "No enabled ticket category is available" };
  }

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    items.push(ticket);
    draft.tickets = items;
    return draft;
  });

  void sendDiscordBotNotification({
    eventKey: "ticketCreated",
    title: `Ticket #${ticket.number}: ${ticket.subject}`,
    description: ticket.messages[0]?.content?.slice(0, 500) || ticket.subject,
    category: ticket.categoryName,
    author: owner.name || "Pilot",
    color: 0xe31e24,
    content: owner.discordId ? `Outdated flight report #${ticket.number} from <@${owner.discordId}>` : "",
    variables: {
      ticketNumber: ticket.number,
      subject: ticket.subject,
      content: ticket.messages[0]?.content?.slice(0, 500) || ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      pilotName: owner.name || "Pilot",
      reporter: owner.name || "Pilot",
      authorRole: "pilot",
      route: `${ticket.routeReport?.fromCode || "—"} -> ${ticket.routeReport?.toCode || "—"}`,
      aircraft: "",
    },
    fields: [
      { name: "Category", value: ticket.categoryName, inline: true },
      { name: "Flight", value: ticket.routeReport?.flightNumber || ticket.subject, inline: true },
      { name: "Reporter", value: owner.name || owner.username || "Pilot", inline: true },
    ],
  }).catch(() => {});

  return { ticket, duplicate: false, error: null };
};

const parseAdminTimestamp = (value) => {
  const timestamp = Date.parse(String(value || "").trim());
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizePirepAutoTicketStatus = (value) => normalizeAdminText(value || "").toLowerCase();

const getStalePirepAutoTicketTimestamp = (pirep = {}) => {
  const candidates = [
    pirep?.created_at,
    pirep?.submitted_at,
    pirep?.filed_at,
    pirep?.landing_time,
    pirep?.arrival_time,
    pirep?.updated_at,
  ];

  for (const candidate of candidates) {
    const timestamp = parseAdminTimestamp(candidate);
    if (timestamp > 0) {
      return timestamp;
    }
  }

  return 0;
};

const isPirepEligibleForAutoReviewTicket = (pirep = {}, now = Date.now()) => {
  const pirepId = Number(pirep?.id || 0) || 0;
  if (pirepId <= 0) {
    return false;
  }

  const status = normalizePirepAutoTicketStatus(pirep?.status);
  if (!STALE_PIREP_AUTO_TICKET_STATUSES.includes(status)) {
    return false;
  }

  const ageTimestamp = getStalePirepAutoTicketTimestamp(pirep);
  if (ageTimestamp <= 0) {
    return false;
  }

  return now - ageTimestamp >= STALE_PIREP_AUTO_TICKET_WINDOW_MS;
};

const resolveStalePirepAutoTicketCategory = (config = getTicketConfigStore()) => {
  const enabledCategories = Array.isArray(config?.categories)
    ? config.categories.filter((item) => normalizeAdminBoolean(item?.enabled, true))
    : [];

  return (
    enabledCategories.find((item) => normalizeAdminText(item?.id || "").toLowerCase() === "operations") ||
    enabledCategories[0] ||
    null
  );
};

const resolveStalePirepAutoTicketTags = (config = getTicketConfigStore()) => {
  const enabledTagIds = new Set(
    (Array.isArray(config?.tags) ? config.tags : [])
      .filter((item) => normalizeAdminBoolean(item?.enabled, true))
      .map((item) => normalizeAdminText(item?.id || ""))
      .filter(Boolean)
  );

  return ["technical", "vamsys"].filter((item) => enabledTagIds.has(item));
};

const hasAutoReviewTicketForPirep = (tickets = [], pirepId) => {
  const normalizedPirepId = Number(pirepId || 0) || 0;
  if (normalizedPirepId <= 0) {
    return false;
  }

  return tickets.some((ticket) => {
    const autoReview = ticket?.autoReview && typeof ticket.autoReview === "object" ? ticket.autoReview : {};
    const metadataPirepId = Number(autoReview?.pirepId || ticket?.relatedPirepId || 0) || 0;
    return metadataPirepId === normalizedPirepId;
  });
};

const formatStalePirepAgeLabel = (ageMs) => {
  const totalHours = Math.max(1, Math.floor(Number(ageMs || 0) / (60 * 60 * 1000)));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0 && hours > 0) {
    return `${days}d ${hours}h`;
  }
  if (days > 0) {
    return `${days}d`;
  }
  return `${totalHours}h`;
};

const buildStalePirepRouteLabel = (pirep = {}) => {
  const departure = normalizeAdminText(
    pirep?.departure_airport?.icao || pirep?.departure_airport?.iata || pirep?.departure_icao || pirep?.departure_iata || ""
  ).toUpperCase();
  const arrival = normalizeAdminText(
    pirep?.arrival_airport?.icao || pirep?.arrival_airport?.iata || pirep?.arrival_icao || pirep?.arrival_iata || ""
  ).toUpperCase();

  return departure && arrival ? `${departure} -> ${arrival}` : departure || arrival || "Route unavailable";
};

const buildStalePirepAutoReviewTicket = (pirep = {}, config = getTicketConfigStore()) => {
  const category = resolveStalePirepAutoTicketCategory(config);
  if (!category) {
    return null;
  }

  const now = new Date().toISOString();
  const pirepId = Number(pirep?.id || 0) || 0;
  const status = normalizePirepAutoTicketStatus(pirep?.status) || "pending";
  const ageTimestamp = getStalePirepAutoTicketTimestamp(pirep);
  const ageMs = Math.max(0, Date.now() - ageTimestamp);
  const ageLabel = formatStalePirepAgeLabel(ageMs);
  const pilotName =
    normalizeAdminText(pirep?.pilot?.name || pirep?.pilot_name || pirep?.pilot?.username || "") || "Unknown pilot";
  const pilotUsername =
    normalizeAdminText(pirep?.pilot?.username || pirep?.pilot?.callsign || pirep?.pilot_username || "") || "unknown";
  const callsign = normalizeAdminText(pirep?.callsign || pirep?.flight_number || "") || `PIREP ${pirepId}`;
  const routeLabel = buildStalePirepRouteLabel(pirep);
  const content = [
    `Automatic review ticket created for stale PIREP #${pirepId}.`,
    `Callsign: ${callsign}`,
    `Pilot: ${pilotName} (${pilotUsername})`,
    `Route: ${routeLabel}`,
    `Status: ${status}`,
    `Age: ${ageLabel}`,
    `Filed at: ${ageTimestamp > 0 ? new Date(ageTimestamp).toISOString() : "unknown"}`,
    "Reason: PIREP has been waiting in review too long and should be rechecked by staff.",
  ].join("\n");

  return {
    id: randomUUID(),
    number: getNextTicketNumber(),
    subject: `Review stale PIREP ${callsign}`,
    categoryId: category.id,
    categoryName: category.name,
    status: "open",
    priority: ageMs >= 48 * 60 * 60 * 1000 ? "critical" : "high",
    tags: resolveStalePirepAutoTicketTags(config),
    assigneeId: null,
    assigneeName: null,
    owner: {
      pilotId: null,
      discordId: null,
      username: "review-bot",
      name: "Auto Review",
      provider: "system",
    },
    messages: [
      {
        id: randomUUID(),
        authorRole: "staff",
        authorName: "Auto Review",
        authorUsername: "review-bot",
        content,
        createdAt: now,
      },
    ],
    unreadByOwner: 0,
    unreadByStaff: 1,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    source: "system-auto-review",
    relatedPirepId: pirepId,
    autoReview: {
      type: "stale-pirep",
      pirepId,
      status,
      callsign,
      route: routeLabel,
      pilotName,
      pilotUsername,
      staleSince: ageTimestamp > 0 ? new Date(ageTimestamp).toISOString() : null,
      thresholdHours: STALE_PIREP_AUTO_TICKET_WINDOW_MS / (60 * 60 * 1000),
      detectedAt: now,
    },
  };
};

const createStalePirepAutoReviewTicket = (pirep = {}) => {
  const config = getTicketConfigStore();
  if (!config.enabled) {
    return null;
  }

  const ticket = buildStalePirepAutoReviewTicket(pirep, config);
  if (!ticket) {
    return null;
  }

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    if (hasAutoReviewTicketForPirep(items, pirep?.id)) {
      draft.tickets = items;
      return draft;
    }
    items.push(ticket);
    draft.tickets = items;
    return draft;
  });

  void sendDiscordBotNotification({
    eventKey: "ticketCreated",
    title: `Ticket #${ticket.number}: ${ticket.subject}`,
    description: ticket.messages[0]?.content?.slice(0, 500) || ticket.subject,
    category: ticket.categoryName,
    author: "Auto Review",
    color: 0xeab308,
    variables: {
      ticketNumber: ticket.number,
      subject: ticket.subject,
      content: ticket.messages[0]?.content?.slice(0, 500) || ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      pilotName: ticket.autoReview?.pilotName || "Unknown pilot",
      reporter: "Auto Review",
      authorRole: "staff",
      route: ticket.autoReview?.route || "",
      aircraft: "",
    },
    fields: [
      { name: "Category", value: ticket.categoryName, inline: true },
      { name: "Priority", value: ticket.priority, inline: true },
      { name: "Source", value: "Auto Review", inline: true },
      { name: "PIREP", value: String(ticket.relatedPirepId || "-"), inline: true },
    ],
  }).catch(() => {});

  return ticket;
};

const fetchPirepsForAutoReviewTickets = async ({ status = "pending", cursor = "" } = {}) => {
  const params = new URLSearchParams();
  params.set("page[size]", String(STALE_PIREP_AUTO_TICKET_PAGE_SIZE));
  params.set("sort", "id");
  params.set("filter[status]", normalizePirepAutoTicketStatus(status) || "pending");
  if (cursor) {
    params.set("page[cursor]", cursor);
  }

  const token = await getAccessToken();
  const response = await fetch(`${API_BASE}/pireps?${params.toString()}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Failed to load PIREPs for status ${status}: ${response.status}`);
  }

  const payload = await response.json();
  return {
    items: Array.isArray(payload?.data) ? payload.data : [],
    nextCursor: normalizeAdminText(payload?.meta?.next_cursor || "") || null,
  };
};

const scanStalePirepsForAutoTickets = async ({ force = false } = {}) => {
  if (stalePirepAutoTicketScanPromise && !force) {
    return stalePirepAutoTicketScanPromise;
  }

  const run = (async () => {
    const existingTickets = listTicketsStore();
    const trackedPirepIds = new Set(
      existingTickets
        .map((item) => Number(item?.autoReview?.pirepId || item?.relatedPirepId || 0) || 0)
        .filter((item) => item > 0)
    );
    const now = Date.now();
    const createdTickets = [];

    for (const status of STALE_PIREP_AUTO_TICKET_STATUSES) {
      let cursor = "";
      let pageCount = 0;

      while (pageCount < STALE_PIREP_AUTO_TICKET_MAX_PAGES) {
        const payload = await fetchPirepsForAutoReviewTickets({ status, cursor });
        const items = Array.isArray(payload?.items) ? payload.items : [];
        if (items.length === 0) {
          break;
        }

        for (const pirep of items) {
          const pirepId = Number(pirep?.id || 0) || 0;
          if (pirepId <= 0 || trackedPirepIds.has(pirepId)) {
            continue;
          }
          if (!isPirepEligibleForAutoReviewTicket(pirep, now)) {
            continue;
          }

          const ticket = createStalePirepAutoReviewTicket(pirep);
          if (ticket) {
            trackedPirepIds.add(pirepId);
            createdTickets.push(ticket.number);
          }
        }

        pageCount += 1;
        if (!payload?.nextCursor) {
          break;
        }
        cursor = payload.nextCursor;
      }
    }

    if (createdTickets.length > 0) {
      logger.info("[tickets] stale_pirep_auto_tickets_created", {
        count: createdTickets.length,
        ticketNumbers: createdTickets,
      });
    }

    return { created: createdTickets.length, ticketNumbers: createdTickets };
  })()
    .catch((error) => {
      logger.warn("[tickets] stale_pirep_auto_ticket_scan_failed", String(error?.message || error || "unknown error"));
      return { created: 0, ticketNumbers: [] };
    })
    .finally(() => {
      if (stalePirepAutoTicketScanPromise === run) {
        stalePirepAutoTicketScanPromise = null;
      }
    });

  stalePirepAutoTicketScanPromise = run;
  return run;
};

setTimeout(() => {
  scanStalePirepsForAutoTickets().catch(() => {});
  setInterval(() => {
    scanStalePirepsForAutoTickets().catch(() => {});
  }, STALE_PIREP_AUTO_TICKET_SCAN_INTERVAL_MS);
}, 5000);

const getAcarsConfigStore = () => {
  const store = readAdminContentStore();
  const defaults = getDefaultAcarsConfig();
  return store?.acarsConfig && typeof store.acarsConfig === "object"
    ? { ...defaults, ...store.acarsConfig }
    : defaults;
};

const HOPPIE_ACARS_CONNECT_URL = "https://www.hoppie.nl/acars/system/connect.html";
const HOPPIE_ACARS_ONLINE_URL = "https://www.hoppie.nl/acars/system/online.html";
const VATSIM_DATA_URL = "https://data.vatsim.net/v3/vatsim-data.json";
const HOPPIE_ACTIVITY_LOG_LIMIT = 40;
const ACARS_VAC_NETWORK_CACHE_MS = 60 * 1000;
const ACARS_VAC_DISPATCH_LOG_LIMIT = 100;

const acarsHoppieActivityLog = [];
const acarsVacDispatchLog = [];
let acarsVacNetworkCache = {
  data: {
    items: [],
    summary: {
      onlineVacFlights: 0,
      matchedBookings: 0,
      hoppieOnline: 0,
      availableForMessages: 0,
      updatedAt: null,
      prefixes: [],
    },
  },
  expiresAt: 0,
};
let acarsHoppieProbeState = {
  lastCheckedAt: null,
  status: "idle",
  route: null,
  message: "No probes yet",
  responseStatus: null,
  responsePayload: null,
};

const getAcarsHoppieActivityLog = () => [...acarsHoppieActivityLog];
const getAcarsVacDispatchLog = () => [...acarsVacDispatchLog];

const recordAcarsHoppieActivity = (entry = {}) => {
  const nextEntry = {
    id: randomUUID(),
    requestedAt: new Date().toISOString(),
    action: normalizeAdminText(entry.action || entry.type || "request") || "request",
    from: normalizeAdminText(entry.from).toUpperCase(),
    to: normalizeAdminText(entry.to).toUpperCase(),
    type: normalizeAdminText(entry.type).toLowerCase(),
    packet: typeof entry.packet === "string" ? entry.packet : "",
    ok: Boolean(entry.ok),
    responseStatus: normalizeAdminText(entry.responseStatus || (entry.ok ? "ok" : "error")) || (entry.ok ? "ok" : "error"),
    responsePayload: normalizeAdminText(entry.responsePayload),
    httpStatus: Number(entry.httpStatus || 0) || 0,
  };

  acarsHoppieActivityLog.unshift(nextEntry);
  if (acarsHoppieActivityLog.length > HOPPIE_ACTIVITY_LOG_LIMIT) {
    acarsHoppieActivityLog.length = HOPPIE_ACTIVITY_LOG_LIMIT;
  }
  return nextEntry;
};

const recordAcarsVacDispatchLog = (entry = {}) => {
  const nextEntry = {
    id: randomUUID(),
    requestedAt: new Date().toISOString(),
    mode: normalizeAdminText(entry.mode || "message") || "message",
    bookingId: Number(entry.bookingId || 0) || 0,
    templateId: normalizeAdminText(entry.templateId),
    from: normalizeAdminText(entry.from).toUpperCase(),
    to: normalizeAdminText(entry.to).toUpperCase(),
    callsign: normalizeAdminText(entry.callsign || entry.to).toUpperCase(),
    vacCode: normalizeAdminText(entry.vacCode).toUpperCase(),
    pilotName: normalizeAdminText(entry.pilotName || "Pilot") || "Pilot",
    routeLabel: normalizeAdminText(entry.routeLabel),
    packet: typeof entry.packet === "string" ? entry.packet : "",
    ok: Boolean(entry.ok),
    responseStatus: normalizeAdminText(entry.responseStatus || (entry.ok ? "ok" : "error")) || (entry.ok ? "ok" : "error"),
    responsePayload: normalizeAdminText(entry.responsePayload),
    activityId: normalizeAdminText(entry.activityId),
  };

  acarsVacDispatchLog.unshift(nextEntry);
  if (acarsVacDispatchLog.length > ACARS_VAC_DISPATCH_LOG_LIMIT) {
    acarsVacDispatchLog.length = ACARS_VAC_DISPATCH_LOG_LIMIT;
  }
  return nextEntry;
};

const updateAcarsHoppieProbeState = (patch = {}) => {
  acarsHoppieProbeState = {
    ...acarsHoppieProbeState,
    ...patch,
  };
  return acarsHoppieProbeState;
};

const resolveAcarsHoppieStationCallsign = (settings = {}, explicitCallsign = "") => {
  const candidate = normalizeAdminText(explicitCallsign || settings.stationCallsign || settings.callsignPrefix).toUpperCase();
  if (candidate) {
    return candidate;
  }
  return "NWSOPS";
};

const resolveAcarsHoppieTargetCallsign = (settings = {}, explicitCallsign = "") => {
  const candidate = normalizeAdminText(explicitCallsign || settings.dispatchTarget || "SERVER").toUpperCase();
  if (candidate) {
    return candidate;
  }
  return "SERVER";
};

const buildAcarsHoppieUserAgent = (settings = {}) => {
  const clientName = normalizeAdminText(settings.clientName || "Nordwind ACARS") || "Nordwind ACARS";
  const clientVersion = normalizeAdminText(settings.clientVersion || "0.1") || "0.1";
  return `${clientName}/${clientVersion} (+https://nordwind.virtual)`;
};

const parseAcarsHoppieResponse = (raw = "") => {
  const text = String(raw || "").trim();
  const match = text.match(/^([a-z]+)\s*\{([\s\S]*)\}$/i);
  if (match) {
    return {
      raw: text,
      status: String(match[1] || "unknown").toLowerCase(),
      payload: String(match[2] || "").trim(),
    };
  }

  const normalized = text.toLowerCase();
  if (normalized.startsWith("ok")) {
    return { raw: text, status: "ok", payload: text.slice(2).trim() };
  }
  if (normalized.startsWith("error")) {
    return { raw: text, status: "error", payload: text.slice(5).trim() };
  }

  return {
    raw: text,
    status: text ? "unknown" : "empty",
    payload: text,
  };
};

const assertAcarsHoppieConfigured = () => {
  const settings = getAcarsConfigStore();
  if (!settings.enabled) {
    throw new Error("ACARS profile is disabled");
  }
  if (settings.provider !== "custom-hoppie") {
    throw new Error("ACARS provider is not set to custom-hoppie");
  }
  const logon = normalizeAdminText(settings.hoppieLogonCode).toUpperCase();
  if (!logon) {
    throw new Error("Hoppie logon code is missing");
  }
  return {
    settings,
    logon,
  };
};

const sendAcarsHoppiePacket = async ({ action = "request", from = "", to = "", type = "ping", packet = "" } = {}) => {
  const { settings, logon } = assertAcarsHoppieConfigured();
  const resolvedType = normalizeAdminText(type || "ping").toLowerCase() || "ping";
  const resolvedFrom = resolveAcarsHoppieStationCallsign(settings, from);
  const resolvedTo = resolveAcarsHoppieTargetCallsign(settings, to);
  const requestBody = new URLSearchParams({
    logon,
    from: resolvedFrom,
    to: resolvedTo,
    type: resolvedType,
    packet: String(packet || ""),
  });

  const response = await fetch(HOPPIE_ACARS_CONNECT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": buildAcarsHoppieUserAgent(settings),
    },
    body: requestBody,
  });

  const responseText = await response.text().catch(() => "");
  const parsed = parseAcarsHoppieResponse(responseText);
  const ok = response.ok && parsed.status !== "error";
  const activity = recordAcarsHoppieActivity({
    action,
    from: resolvedFrom,
    to: resolvedTo,
    type: resolvedType,
    packet: String(packet || ""),
    ok,
    responseStatus: parsed.status,
    responsePayload: parsed.payload,
    httpStatus: response.status,
  });

  updateAcarsHoppieProbeState({
    lastCheckedAt: activity.requestedAt,
    status: ok ? "ok" : parsed.status || "error",
    route: `${resolvedFrom} → ${resolvedTo}`,
    message: parsed.payload || parsed.raw || (ok ? "Hoppie request succeeded" : "Hoppie request failed"),
    responseStatus: parsed.status,
    responsePayload: parsed.payload || parsed.raw,
  });

  return {
    ok,
    httpStatus: response.status,
    request: {
      action,
      from: resolvedFrom,
      to: resolvedTo,
      type: resolvedType,
      packet: String(packet || ""),
    },
    response: parsed,
    activity,
  };
};

const decodeAcarsVacHtml = (value = "") =>
  String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const stripAcarsVacHtml = (value = "") =>
  normalizeAdminText(decodeAcarsVacHtml(String(value || "").replace(/<[^>]+>/g, " ")));

const parseAcarsVacHoppieOnlineStations = (html = "") => {
  const rows = [];
  const rowPattern = /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>\s*<a[^>]*network=([^"&]+)&callsign=([^"&]+)[^>]*>([^<]+)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let match = rowPattern.exec(String(html || ""));

  while (match) {
    const network = stripAcarsVacHtml(match[2] || match[1]).toUpperCase();
    const callsign = normalizeAdminText(decodeURIComponent(match[3] || match[4] || "")).toUpperCase();
    if (network && callsign) {
      const messagesSeenRaw = stripAcarsVacHtml(match[6]);
      const messageRateRaw = stripAcarsVacHtml(match[7]);
      rows.push({
        network,
        callsign,
        connected: stripAcarsVacHtml(match[5]),
        messagesSeen: Number(messagesSeenRaw.replace(/[^0-9.-]+/g, "")) || 0,
        messageRate: Number(messageRateRaw.replace(/[^0-9.-]+/g, "")) || 0,
        note: stripAcarsVacHtml(match[8]),
      });
    }

    match = rowPattern.exec(String(html || ""));
  }

  return rows;
};

const loadAcarsVacNetworkSnapshot = async ({ limit = 200 } = {}) => {
  const now = Date.now();
  if (acarsVacNetworkCache.expiresAt > now && acarsVacNetworkCache.data) {
    return acarsVacNetworkCache.data;
  }

  const [vatsimResponse, hoppieOnlineResponse, bookings] = await Promise.all([
    fetch(VATSIM_DATA_URL, {
      headers: {
        Accept: "application/json",
      },
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`VATSIM network data returned ${response.status}`);
      }
      return response.json();
    }),
    fetch(HOPPIE_ACARS_ONLINE_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Hoppie online stations returned ${response.status}`);
      }
      return response.text();
    }),
    loadAdminBookingsCatalog({ limit: 500 }).catch(() => []),
  ]);

  const hoppieStations = parseAcarsVacHoppieOnlineStations(hoppieOnlineResponse)
    .filter((item) => item.network === "VATSIM")
    .reduce((accumulator, item) => {
      accumulator.set(item.callsign, item);
      return accumulator;
    }, new Map());

  const bookingsByCallsign = (Array.isArray(bookings) ? bookings : []).reduce((accumulator, booking) => {
    const callsign = normalizeAdminText(booking?.callsign).toUpperCase();
    if (callsign) {
      accumulator.set(callsign, booking);
    }
    return accumulator;
  }, new Map());

  const items = (Array.isArray(vatsimResponse?.pilots) ? vatsimResponse.pilots : [])
    .map((pilot) => {
      const callsign = normalizeAdminText(pilot?.callsign).toUpperCase();
      const vacCode = detectAcarsVacCode(callsign);
      if (!callsign || !vacCode) {
        return null;
      }

      const flightPlan = pilot?.flight_plan && typeof pilot.flight_plan === "object" ? pilot.flight_plan : {};
      const departure = normalizeAdminText(flightPlan?.departure).toUpperCase();
      const arrival = normalizeAdminText(flightPlan?.arrival).toUpperCase();
      const routeLabel = departure || arrival ? `${departure || "—"} → ${arrival || "—"}` : "Route not filed";
      const aircraft =
        normalizeAdminText(flightPlan?.aircraft_short || flightPlan?.aircraft_faa || flightPlan?.aircraft) ||
        "Aircraft not filed";
      const groundspeed = Number(pilot?.groundspeed);
      const altitude = Number(pilot?.altitude);
      const hoppieStation = hoppieStations.get(callsign) || null;
      const booking = bookingsByCallsign.get(callsign) || null;

      return {
        id: `vatsim-${Number(pilot?.cid || 0) || randomUUID()}`,
        cid: Number(pilot?.cid || 0) || 0,
        callsign,
        vacCode,
        vatsimOnline: true,
        pilotName: normalizeAdminText(pilot?.name || "Pilot") || "Pilot",
        departure,
        arrival,
        routeLabel,
        aircraft,
        groundspeed: Number.isFinite(groundspeed) ? Math.round(groundspeed) : null,
        altitude: Number.isFinite(altitude) ? Math.round(altitude) : null,
        heading: Number.isFinite(Number(pilot?.heading)) ? Math.round(Number(pilot.heading)) : null,
        latitude: Number.isFinite(Number(pilot?.latitude)) ? Number(pilot.latitude) : null,
        longitude: Number.isFinite(Number(pilot?.longitude)) ? Number(pilot.longitude) : null,
        onlineSince: normalizeAdminText(pilot?.logon_time),
        lastUpdated: normalizeAdminText(pilot?.last_updated),
        matchedBookingId: Number(booking?.id || 0) || 0,
        matchedBookingStatus: normalizeAdminText(booking?.status),
        matchedBookingRoute: normalizeAdminText(booking?.routeLabel),
        hoppieOnline: Boolean(hoppieStation),
        availableForMessages: Boolean(hoppieStation),
        hoppieConnected: normalizeAdminText(hoppieStation?.connected),
        hoppieMessagesSeen: Number.isFinite(Number(hoppieStation?.messagesSeen)) ? Number(hoppieStation.messagesSeen) : null,
        hoppieMessageRate: Number.isFinite(Number(hoppieStation?.messageRate)) ? Number(hoppieStation.messageRate) : null,
        hoppieNote: normalizeAdminText(hoppieStation?.note),
        remarks: normalizeAdminText(flightPlan?.remarks),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const availabilityDelta = Number(Boolean(right?.availableForMessages)) - Number(Boolean(left?.availableForMessages));
      if (availabilityDelta !== 0) {
        return availabilityDelta;
      }
      const bookingDelta = Number(Boolean(right?.matchedBookingId)) - Number(Boolean(left?.matchedBookingId));
      if (bookingDelta !== 0) {
        return bookingDelta;
      }
      return String(left?.callsign || "").localeCompare(String(right?.callsign || ""));
    })
    .slice(0, Math.max(1, Math.min(500, Number(limit) || 200)));

  const summary = {
    onlineVacFlights: items.length,
    matchedBookings: items.filter((item) => Number(item?.matchedBookingId || 0) > 0).length,
    hoppieOnline: items.filter((item) => item?.hoppieOnline).length,
    availableForMessages: items.filter((item) => item?.availableForMessages).length,
    updatedAt: normalizeAdminText(vatsimResponse?.general?.update_timestamp || vatsimResponse?.general?.update),
    prefixes: INTERNAL_VAC_CALLSIGN_PREFIXES,
  };

  acarsVacNetworkCache = {
    data: {
      items,
      summary,
    },
    expiresAt: now + ACARS_VAC_NETWORK_CACHE_MS,
  };

  return acarsVacNetworkCache.data;
};

const INTERNAL_VAC_CALLSIGN_PREFIXES = ["KAR", "NWS", "STW"];
const ACARS_VAC_TEMPLATE_PLACEHOLDERS = [
  "callsign",
  "flightNumber",
  "vac",
  "pilotName",
  "pilotUsername",
  "departure",
  "arrival",
  "route",
  "aircraft",
  "stand",
  "gate",
  "note",
  "stationCallsign",
  "dispatchTarget",
  "date",
  "time",
];

const detectAcarsVacCode = (value = "") => {
  const normalized = normalizeAdminText(value).toUpperCase();
  const exactPrefix = INTERNAL_VAC_CALLSIGN_PREFIXES.find((prefix) => normalized.startsWith(prefix));
  if (exactPrefix) {
    return exactPrefix;
  }
  if (normalized.includes("STW") || normalized.includes("SOUTHWIND")) {
    return "STW";
  }
  if (normalized.includes("KAR") || normalized.includes("IKAR") || normalized.includes("PEGAS")) {
    return "KAR";
  }
  if (normalized.includes("NWS") || normalized.includes("NORDWIND")) {
    return "NWS";
  }
  return "";
};

const isEligibleAcarsVacCallsign = (value = "") => Boolean(detectAcarsVacCode(value));

const listAcarsVacMessageTemplates = () =>
  listManagedAdminCollection("acarsMessageTemplates").map((template) => ({
    id: normalizeAdminText(template?.id),
    title: normalizeAdminText(template?.title || "Template") || "Template",
    code: normalizeAdminText(template?.code).toUpperCase(),
    category: normalizeAdminText(template?.category || "general") || "general",
    description: normalizeAdminText(template?.description),
    body: normalizeAdminMultilineText(template?.body),
    active: normalizeAdminBoolean(template?.active, true),
    order: normalizeAdminNumber(template?.order, 0),
    updatedAt: normalizeAdminText(template?.updatedAt),
  }));

const loadAcarsVacDispatchCatalog = async ({ limit = 200 } = {}) => {
  const templates = listAcarsVacMessageTemplates();
  const bookings = await loadAdminBookingsCatalog({ limit: Math.max(1, Math.min(500, Number(limit) || 200)) });
  const flightMap = await loadFlightMap().catch(() => ({ flights: [] }));
  const networkSnapshot = await loadAcarsVacNetworkSnapshot({ limit: 500 }).catch(() => ({ items: [] }));
  const liveFlightsByCallsign = new Map(
    (Array.isArray(flightMap?.flights) ? flightMap.flights : [])
      .map((flight) => {
        const callsign = normalizeAdminText(flight?.flightNumber || flight?.callsign).toUpperCase();
        return callsign ? [callsign, flight] : null;
      })
      .filter(Boolean)
  );
  const networkFlightsByCallsign = new Map(
    (Array.isArray(networkSnapshot?.items) ? networkSnapshot.items : [])
      .map((item) => {
        const callsign = normalizeAdminText(item?.callsign).toUpperCase();
        return callsign ? [callsign, item] : null;
      })
      .filter(Boolean)
  );
  const queue = bookings
    .filter((booking) => !["completed", "cancelled"].includes(String(booking?.status || "").toLowerCase()))
    .map((booking) => {
      const callsign = normalizeAdminText(booking?.callsign).toUpperCase();
      const vacCode = detectAcarsVacCode(callsign);
      const liveFlight = liveFlightsByCallsign.get(callsign) || null;
      const networkFlight = networkFlightsByCallsign.get(callsign) || null;
      return {
        bookingId: Number(booking?.id || 0) || 0,
        pilotId: Number(booking?.pilotId || 0) || 0,
        pilotName: normalizeAdminText(booking?.pilotName || booking?.pilotUsername || "Pilot") || "Pilot",
        pilotUsername: normalizeAdminText(booking?.pilotUsername),
        callsign,
        vacCode,
        callsignEligible: Boolean(vacCode),
        routeLabel: normalizeAdminText(booking?.routeLabel),
        departure: normalizeAdminText(booking?.departure).toUpperCase(),
        arrival: normalizeAdminText(booking?.arrival).toUpperCase(),
        aircraftLabel: normalizeAdminText(booking?.aircraftLabel),
        departureTime: normalizeAdminText(booking?.departureTime),
        createdAt: normalizeAdminText(booking?.createdAt),
        status: normalizeAdminText(booking?.status || "active") || "active",
        priority: normalizeAdminText(booking?.meta?.priority || "normal") || "normal",
        tag: normalizeAdminText(booking?.meta?.tag),
        notes: normalizeAdminText(booking?.meta?.notes),
        liveTracked: Boolean(liveFlight),
        etd: normalizeAdminText(liveFlight?.etd || liveFlight?.time || booking?.departureTime),
        eta: normalizeAdminText(liveFlight?.eta || booking?.estimatedArrivalTime),
        ete: normalizeAdminText(liveFlight?.ete || liveFlight?.remainingTime),
        currentPhase: normalizeAdminText(liveFlight?.currentPhase || liveFlight?.status),
        vatsimOnline: Boolean(networkFlight),
        hoppieOnline: Boolean(networkFlight?.hoppieOnline),
        availableForMessages: Boolean(networkFlight?.availableForMessages),
        hoppieConnected: normalizeAdminText(networkFlight?.hoppieConnected),
        hoppieStatusNote: normalizeAdminText(networkFlight?.hoppieNote),
      };
    })
    .sort((left, right) => {
      const leftPriority = left.callsignEligible ? 0 : 1;
      const rightPriority = right.callsignEligible ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      const leftTime = Date.parse(String(left.departureTime || left.createdAt || ""));
      const rightTime = Date.parse(String(right.departureTime || right.createdAt || ""));
      if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      return String(left.callsign || "").localeCompare(String(right.callsign || ""));
    });

  return {
    bookings: queue,
    templates,
    allowedPrefixes: INTERNAL_VAC_CALLSIGN_PREFIXES,
    placeholders: ACARS_VAC_TEMPLATE_PLACEHOLDERS,
    summary: {
      totalBookings: queue.length,
      eligibleBookings: queue.filter((item) => item.callsignEligible).length,
      blockedBookings: queue.filter((item) => !item.callsignEligible).length,
      activeTemplates: templates.filter((item) => item.active).length,
      vatsimOnline: queue.filter((item) => item.vatsimOnline).length,
      availableForMessages: queue.filter((item) => item.availableForMessages).length,
    },
  };
};

const buildAcarsVacMessageContext = ({ booking = null, payload = {}, settings = {}, to = "" } = {}) => {
  const callsign = normalizeAdminText(to || booking?.callsign).toUpperCase();
  const departure = normalizeAdminText(payload?.departure || booking?.departure).toUpperCase();
  const arrival = normalizeAdminText(payload?.arrival || booking?.arrival).toUpperCase();
  const stand = normalizeAdminText(payload?.stand).toUpperCase();
  const gate = normalizeAdminText(payload?.gate || payload?.stand).toUpperCase();
  const note = normalizeAdminMultilineText(payload?.note || payload?.remark);
  const now = new Date();

  return {
    callsign,
    flightNumber: callsign,
    vac: detectAcarsVacCode(callsign),
    pilotName: normalizeAdminText(payload?.pilotName || booking?.pilotName || "Pilot") || "Pilot",
    pilotUsername: normalizeAdminText(payload?.pilotUsername || booking?.pilotUsername),
    departure,
    arrival,
    route: departure && arrival ? `${departure}-${arrival}` : normalizeAdminText(booking?.routeLabel).replace(/\s*→\s*/g, "-"),
    aircraft: normalizeAdminText(payload?.aircraft || booking?.aircraftLabel),
    stand,
    gate,
    note,
    stationCallsign: resolveAcarsHoppieStationCallsign(settings, payload?.from),
    dispatchTarget: resolveAcarsHoppieTargetCallsign(settings),
    date: now.toISOString().slice(0, 10),
    time: now.toISOString().slice(11, 16),
  };
};

const renderAcarsVacMessageTemplate = (templateText = "", context = {}) =>
  String(templateText || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context?.[key];
    return value == null ? "" : String(value);
  }).trim();

const sendAcarsVacDispatchMessage = async (payload = {}) => {
  const settings = getAcarsConfigStore();
  const bookingId = Number(payload?.bookingId || 0) || 0;
  const catalog = await loadAcarsVacDispatchCatalog({ limit: 500 });
  const booking = bookingId > 0
    ? (Array.isArray(catalog?.bookings) ? catalog.bookings : []).find((item) => Number(item?.bookingId || 0) === bookingId) || null
    : null;
  const templateId = normalizeAdminText(payload?.templateId);
  const template = templateId
    ? (Array.isArray(catalog?.templates) ? catalog.templates : []).find((item) => String(item?.id) === templateId) || null
    : null;
  const to = normalizeAdminText(payload?.to || booking?.callsign).toUpperCase();

  if (!to) {
    throw new Error("A target callsign is required");
  }

  if (!isEligibleAcarsVacCallsign(to)) {
    throw new Error("Target callsign must start with KAR, NWS or STW");
  }

  const sourceText = normalizeAdminMultilineText(payload?.message || template?.body);
  if (!sourceText) {
    throw new Error("Message text is required");
  }

  const context = buildAcarsVacMessageContext({
    booking,
    payload,
    settings,
    to,
  });
  const packet = renderAcarsVacMessageTemplate(sourceText, context);
  if (!packet) {
    throw new Error("Rendered message is empty");
  }

  try {
    const result = await sendAcarsHoppiePacket({
      action: template ? "vac-template" : "vac-message",
      from: normalizeAdminText(payload?.from).toUpperCase() || resolveAcarsHoppieStationCallsign(settings),
      to,
      type: "telex",
      packet,
    });

    const dispatchLog = recordAcarsVacDispatchLog({
      mode: template ? "template" : "spontaneous",
      bookingId: booking?.bookingId || bookingId,
      templateId: template?.id,
      from: result?.request?.from || resolveAcarsHoppieStationCallsign(settings),
      to,
      callsign: to,
      vacCode: detectAcarsVacCode(to),
      pilotName: context.pilotName,
      routeLabel: context.route,
      packet,
      ok: result?.ok,
      responseStatus: result?.response?.status,
      responsePayload: result?.response?.payload || result?.response?.raw,
      activityId: result?.activity?.id,
    });

    return {
      ...result,
      preview: {
        from: result?.request?.from || resolveAcarsHoppieStationCallsign(settings),
        to,
        packet,
        vacCode: detectAcarsVacCode(to),
        context,
      },
      booking,
      template,
      dispatchLog,
    };
  } catch (error) {
    recordAcarsVacDispatchLog({
      mode: template ? "template" : "spontaneous",
      bookingId: booking?.bookingId || bookingId,
      templateId: template?.id,
      from: normalizeAdminText(payload?.from).toUpperCase() || resolveAcarsHoppieStationCallsign(settings),
      to,
      callsign: to,
      vacCode: detectAcarsVacCode(to),
      pilotName: context.pilotName,
      routeLabel: context.route,
      packet,
      ok: false,
      responseStatus: "error",
      responsePayload: String(error?.message || error || "Failed to send VAC message"),
    });
    throw error;
  }
};

const normalizeAcarsConfigPayload = (payload = {}, current = null) => {
  const existing = current && typeof current === "object" ? current : getAcarsConfigStore();
  const nextStationName = normalizeAdminText(payload.stationName ?? existing.stationName ?? "Nordwind Virtual Operations");
  const nextStationCallsign = normalizeAdminText(payload.stationCallsign ?? existing.stationCallsign ?? "NWSOPS").toUpperCase();
  const nextCallsignPrefix = normalizeAdminText(payload.callsignPrefix ?? existing.callsignPrefix ?? "NWS").toUpperCase();
  const nextDispatchTarget = normalizeAdminText(payload.dispatchTarget ?? existing.dispatchTarget ?? "NWSDISP").toUpperCase();
  return {
    enabled: normalizeAdminBoolean(payload.enabled, normalizeAdminBoolean(existing.enabled, true)),
    provider: normalizeAdminText(payload.provider ?? existing.provider ?? "custom-hoppie") || "custom-hoppie",
    networkMode: normalizeAdminText(payload.networkMode ?? existing.networkMode ?? "production") || "production",
    rolloutStage: normalizeAdminText(payload.rolloutStage ?? existing.rolloutStage ?? "planning") || "planning",
    clientName: normalizeAdminText(payload.clientName ?? existing.clientName ?? "Nordwind ACARS") || "Nordwind ACARS",
    clientVersion: normalizeAdminText(payload.clientVersion ?? existing.clientVersion ?? "0.1") || "0.1",
    hoppieLogonCode: normalizeAdminText(payload.hoppieLogonCode ?? existing.hoppieLogonCode).toUpperCase(),
    selcal: normalizeAdminText(payload.selcal ?? existing.selcal).toUpperCase(),
    stationName: nextStationName || "Nordwind Virtual Operations",
    stationCallsign: nextStationCallsign || "NWSOPS",
    callsignPrefix: nextCallsignPrefix || "NWS",
    dispatchTarget: nextDispatchTarget || "NWSDISP",
    positionIntervalSeconds: Math.max(5, normalizeAdminNumber(payload.positionIntervalSeconds ?? existing.positionIntervalSeconds, 15)),
    telemetryRetentionHours: Math.max(1, normalizeAdminNumber(payload.telemetryRetentionHours ?? existing.telemetryRetentionHours, 24)),
    autoFilePirep: normalizeAdminBoolean(payload.autoFilePirep, normalizeAdminBoolean(existing.autoFilePirep, false)),
    autoAcceptPirep: normalizeAdminBoolean(payload.autoAcceptPirep, normalizeAdminBoolean(existing.autoAcceptPirep, false)),
    enableMessageRelay: normalizeAdminBoolean(payload.enableMessageRelay, normalizeAdminBoolean(existing.enableMessageRelay, true)),
    enablePositionReports: normalizeAdminBoolean(payload.enablePositionReports, normalizeAdminBoolean(existing.enablePositionReports, true)),
    enableTelemetryBackfill: normalizeAdminBoolean(payload.enableTelemetryBackfill, normalizeAdminBoolean(existing.enableTelemetryBackfill, true)),
    enableCpdlc: normalizeAdminBoolean(payload.enableCpdlc, normalizeAdminBoolean(existing.enableCpdlc, true)),
    enableTelex: normalizeAdminBoolean(payload.enableTelex, normalizeAdminBoolean(existing.enableTelex, true)),
    enableClearanceRequests: normalizeAdminBoolean(payload.enableClearanceRequests, normalizeAdminBoolean(existing.enableClearanceRequests, true)),
    syncSimbriefRemarks: normalizeAdminBoolean(payload.syncSimbriefRemarks, normalizeAdminBoolean(existing.syncSimbriefRemarks, true)),
    dispatchIntegrationEnabled: normalizeAdminBoolean(payload.dispatchIntegrationEnabled, normalizeAdminBoolean(existing.dispatchIntegrationEnabled, true)),
    commentsEnabled: normalizeAdminBoolean(payload.commentsEnabled, normalizeAdminBoolean(existing.commentsEnabled, true)),
    notes: normalizeAdminText(payload.notes ?? existing.notes),
    updatedAt: new Date().toISOString(),
  };
};

const upsertAcarsConfigStore = (payload = {}) => {
  const current = getAcarsConfigStore();
  const updated = withAdminContentUpdate((draft) => {
    draft.acarsConfig = normalizeAcarsConfigPayload(payload, current);
    return draft;
  });

  return updated?.acarsConfig || getAcarsConfigStore();
};

const getAcarsAdminSummary = () => {
  const settings = getAcarsConfigStore();
  const cachedFlights = Array.isArray(flightMapCache?.data?.flights) ? flightMapCache.data.flights : [];
  const activeFlights = cachedFlights.length > 0 ? cachedFlights.length : activeFlightHoldCache.size;
  const normalizedLogon = String(settings.hoppieLogonCode || "").trim().toUpperCase();
  const normalizedSelcal = String(settings.selcal || "").trim().toUpperCase();
  const normalizedStationCallsign = String(settings.stationCallsign || "").trim().toUpperCase();
  const normalizedCallsignPrefix = String(settings.callsignPrefix || "").trim().toUpperCase();
  const normalizedDispatchTarget = String(settings.dispatchTarget || "").trim().toUpperCase();
  const logonLooksValid = /^[A-Z0-9]{4,12}$/.test(normalizedLogon);
  const selcalLooksValid = /^[A-Z]{2}-?[A-Z]{2}$/.test(normalizedSelcal);
  const stationLooksValid = /^[A-Z0-9]{3,10}$/.test(normalizedStationCallsign);
  const callsignPrefixLooksValid = /^[A-Z0-9]{2,4}$/.test(normalizedCallsignPrefix);
  const dispatchTargetLooksValid = /^[A-Z0-9]{3,10}$/.test(normalizedDispatchTarget);
  const missingItems = [];

  if (!settings.enabled) {
    missingItems.push("Enable the ACARS profile");
  }
  if (!normalizedLogon) {
    missingItems.push("Set the Hoppie logon code");
  } else if (!logonLooksValid) {
    missingItems.push("Use a valid Hoppie logon code");
  }
  if (!normalizedSelcal) {
    missingItems.push("Set the SELCAL code");
  } else if (!selcalLooksValid) {
    missingItems.push("Use a valid SELCAL format");
  }
  if (!normalizedStationCallsign) {
    missingItems.push("Set the station callsign");
  } else if (!stationLooksValid) {
    missingItems.push("Use a valid station callsign");
  }
  if (!normalizedCallsignPrefix) {
    missingItems.push("Set the flight callsign prefix");
  } else if (!callsignPrefixLooksValid) {
    missingItems.push("Use a valid flight callsign prefix");
  }
  if (!normalizedDispatchTarget) {
    missingItems.push("Set the dispatch target logon");
  } else if (!dispatchTargetLooksValid) {
    missingItems.push("Use a valid dispatch target logon");
  }
  if (!settings.enableTelex && !settings.enableCpdlc && !settings.enablePositionReports) {
    missingItems.push("Enable at least one Hoppie message capability");
  }

  const capabilities = [
    settings.enableTelex ? "TELEX" : null,
    settings.enableCpdlc ? "CPDLC" : null,
    settings.enableClearanceRequests ? "CLEARANCE" : null,
    settings.enablePositionReports ? "POSREP" : null,
    settings.enableMessageRelay ? "MESSAGE RELAY" : null,
    settings.autoFilePirep ? "AUTO PIREP" : null,
    settings.syncSimbriefRemarks ? "SIMBRIEF REMARKS" : null,
  ].filter(Boolean);
  const bootstrapReady = missingItems.length === 0;

  return {
    providerReady: Boolean(settings.enabled && settings.provider === "custom-hoppie" && normalizedLogon),
    operationsCredentialsConfigured: Boolean((CLIENT_ID && CLIENT_SECRET) || API_TOKEN),
    pilotApiConfigured: isPilotApiConfigured(),
    telemetryHistoryEntries: telemetryHistoryCache.size,
    telemetryBackfillEntries: telemetryBackfillCache.size,
    activeFlights,
    diskCacheEnabled: TELEMETRY_DISK_CACHE_ENABLED,
    diskCacheLastPersistAt: telemetryDiskPersistState.lastPersistAt || null,
    telemetryHistoryTtlHours: Number((TELEMETRY_HISTORY_TTL_MS / (60 * 60 * 1000)).toFixed(1)),
    telemetryPointCap: TELEMETRY_HISTORY_MAX_POINTS,
    rolloutStage: String(settings.rolloutStage || "planning"),
    hoppieLogonConfigured: Boolean(normalizedLogon),
    hoppieLogonValid: logonLooksValid,
    selcalConfigured: Boolean(normalizedSelcal),
    selcalValid: selcalLooksValid,
    stationConfigured: Boolean(normalizedStationCallsign),
    stationValid: stationLooksValid,
    dispatchTargetConfigured: Boolean(normalizedDispatchTarget),
    dispatchTargetValid: dispatchTargetLooksValid,
    callsignPrefixValid: callsignPrefixLooksValid,
    missingItems,
    capabilities,
    bootstrapReady,
    hoppieTransportStatus: String(acarsHoppieProbeState.status || "idle"),
    hoppieTransportReachable: acarsHoppieProbeState.status === "ok",
    lastHoppieProbeAt: acarsHoppieProbeState.lastCheckedAt || null,
    lastHoppieProbeRoute: acarsHoppieProbeState.route || null,
    lastHoppieProbeMessage: acarsHoppieProbeState.message || null,
    recentHoppieTransactions: acarsHoppieActivityLog.length,
    bootstrapPreview: {
      provider: settings.provider,
      networkMode: settings.networkMode,
      rolloutStage: settings.rolloutStage,
      client: {
        name: settings.clientName,
        version: settings.clientVersion,
      },
      hoppie: {
        logonCode: normalizedLogon,
        selcal: normalizedSelcal,
        stationName: String(settings.stationName || "").trim(),
        stationCallsign: normalizedStationCallsign,
        dispatchTarget: normalizedDispatchTarget,
        callsignPrefix: normalizedCallsignPrefix,
        capabilities,
      },
      telemetry: {
        positionIntervalSeconds: settings.positionIntervalSeconds,
        retentionHours: settings.telemetryRetentionHours,
        backfillEnabled: Boolean(settings.enableTelemetryBackfill),
      },
      pirep: {
        autoFile: Boolean(settings.autoFilePirep),
        autoAccept: Boolean(settings.autoAcceptPirep),
        commentsEnabled: Boolean(settings.commentsEnabled),
        syncSimbriefRemarks: Boolean(settings.syncSimbriefRemarks),
      },
      dispatch: {
        integrationEnabled: Boolean(settings.dispatchIntegrationEnabled),
        messageRelayEnabled: Boolean(settings.enableMessageRelay),
      },
      flightCallsignExample: normalizedCallsignPrefix ? `${normalizedCallsignPrefix}1234` : "",
    },
  };
};

const hasOwnAdminPayloadValue = (payload, key) =>
  Boolean(payload) && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, key);

const buildRouteMetaRecord = (current = {}, payload = {}) => {
  const nextHubId = hasOwnAdminPayloadValue(payload, "hubId")
    ? normalizeAdminText(payload?.hubId)
    : normalizeAdminText(current?.hubId);
  const nextStatus = hasOwnAdminPayloadValue(payload, "status")
    ? normalizeAdminText(payload?.status)
    : normalizeAdminText(current?.status || "active");
  const nextPriority = hasOwnAdminPayloadValue(payload, "priority")
    ? normalizeAdminText(payload?.priority)
    : normalizeAdminText(current?.priority || "normal");
  const nextSection = hasOwnAdminPayloadValue(payload, "section")
    ? normalizeAdminText(payload?.section)
    : normalizeAdminText(current?.section || "default");
  const nextNotes = hasOwnAdminPayloadValue(payload, "notes")
    ? normalizeAdminText(payload?.notes)
    : normalizeAdminText(current?.notes);
  const nextRemarks = hasOwnAdminPayloadValue(payload, "remarks")
    ? normalizeAdminText(payload?.remarks)
    : normalizeAdminText(current?.remarks);
  const nextInternalRemarks = hasOwnAdminPayloadValue(payload, "internalRemarks")
    ? normalizeAdminText(payload?.internalRemarks)
    : normalizeAdminText(current?.internalRemarks);
  const nextTags = hasOwnAdminPayloadValue(payload, "tags")
    ? parseAdminCsvValues(payload?.tags)
    : parseAdminCsvValues(current?.tags);
  const nextHidden = hasOwnAdminPayloadValue(payload, "hidden")
    ? parseAdminBooleanInput(payload?.hidden, false)
    : parseAdminBooleanInput(current?.hidden, false);

  return {
    hubId: nextHubId || null,
    status: nextStatus || "active",
    priority: nextPriority || "normal",
    section: nextSection || "default",
    notes: nextNotes || "",
    remarks: nextRemarks || "",
    internalRemarks: nextInternalRemarks || "",
    tags: nextTags,
    hidden: nextHidden,
    updatedAt: new Date().toISOString(),
  };
};

const upsertRouteMeta = (routeId, payload = {}) => {
  const targetId = String(routeId || "").trim();
  if (!targetId) {
    throw new Error("Route ID is required");
  }

  const updated = withAdminContentUpdate((draft) => {
    const routeMeta = draft?.routeMeta && typeof draft.routeMeta === "object" ? { ...draft.routeMeta } : {};
    routeMeta[targetId] = buildRouteMetaRecord(routeMeta?.[targetId] || {}, payload);
    draft.routeMeta = routeMeta;
    return draft;
  });

  return updated?.routeMeta?.[targetId] || null;
};

const bulkUpsertRouteMeta = (updates = []) => {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("Route updates are required");
  }

  const normalizedUpdates = updates.map((item) => {
    const targetId = String(item?.id || item?.routeId || "").trim();
    if (!targetId) {
      throw new Error("Each route update must include an id");
    }
    return {
      id: targetId,
      payload: item?.payload && typeof item.payload === "object" ? item.payload : item,
    };
  });

  const updated = withAdminContentUpdate((draft) => {
    const routeMeta = draft?.routeMeta && typeof draft.routeMeta === "object" ? { ...draft.routeMeta } : {};

    normalizedUpdates.forEach((item) => {
      routeMeta[item.id] = buildRouteMetaRecord(routeMeta[item.id] || {}, item.payload);
    });

    draft.routeMeta = routeMeta;
    return draft;
  });

  return normalizedUpdates.map((item) => ({
    id: item.id,
    meta: updated?.routeMeta?.[item.id] || null,
  }));
};

const deleteRouteMeta = (routeId) => {
  const targetId = String(routeId || "").trim();
  if (!targetId) {
    throw new Error("Route ID is required");
  }

  let removed = false;
  withAdminContentUpdate((draft) => {
    const routeMeta = draft?.routeMeta && typeof draft.routeMeta === "object" ? { ...draft.routeMeta } : {};
    if (Object.prototype.hasOwnProperty.call(routeMeta, targetId)) {
      delete routeMeta[targetId];
      removed = true;
    }
    draft.routeMeta = routeMeta;
    return draft;
  });

  return removed;
};

const bulkDeleteRouteMeta = (routeIds = []) => {
  if (!Array.isArray(routeIds) || routeIds.length === 0) {
    throw new Error("Route IDs are required");
  }

  const normalizedIds = Array.from(
    new Set(
      routeIds
        .map((routeId) => String(routeId || "").trim())
        .filter(Boolean)
    )
  );

  if (normalizedIds.length === 0) {
    throw new Error("Route IDs are required");
  }

  let deleted = 0;
  withAdminContentUpdate((draft) => {
    const routeMeta = draft?.routeMeta && typeof draft.routeMeta === "object" ? { ...draft.routeMeta } : {};

    normalizedIds.forEach((targetId) => {
      if (Object.prototype.hasOwnProperty.call(routeMeta, targetId)) {
        delete routeMeta[targetId];
        deleted += 1;
      }
    });

    draft.routeMeta = routeMeta;
    return draft;
  });

  return {
    deleted,
    ids: normalizedIds,
  };
};

const upsertBookingMeta = (bookingId, payload = {}) => {
  const targetId = String(bookingId || "").trim();
  if (!targetId) {
    throw new Error("Booking ID is required");
  }

  const updated = withAdminContentUpdate((draft) => {
    const bookingMeta = draft?.bookingMeta && typeof draft.bookingMeta === "object" ? { ...draft.bookingMeta } : {};
    bookingMeta[targetId] = {
      tag: normalizeAdminText(payload.tag || bookingMeta?.[targetId]?.tag),
      priority: normalizeAdminText(payload.priority || bookingMeta?.[targetId]?.priority || "normal") || "normal",
      notes: normalizeAdminText(payload.notes || bookingMeta?.[targetId]?.notes),
      updatedAt: new Date().toISOString(),
    };
    draft.bookingMeta = bookingMeta;
    return draft;
  });

  return updated?.bookingMeta?.[targetId] || null;
};

const loadAdminRoutesCatalog = async () => {
  const [routesPayload, hubs] = await Promise.all([loadRoutesData(), loadAdminHubsCatalog()]);
  const routes = Array.isArray(routesPayload?.routes) ? routesPayload.routes : [];
  const hubMap = new Map(hubs.map((item) => [String(item.id), item]));
  const routeMeta = getRouteMetaStore();

  return routes.map((route) => {
    const meta = routeMeta[String(route?.id)] || {};
    const hub = meta?.hubId ? hubMap.get(String(meta.hubId)) || null : null;
    const hubAirportPreview = Array.isArray(hub?.airportLabels) && hub.airportLabels.length > 0 ? hub.airportLabels[0] : null;
    return {
      ...route,
      meta: {
        hubId: meta?.hubId || null,
        hubLabel: hub ? `${hub.name}${hubAirportPreview ? ` · ${hubAirportPreview}` : ""}` : null,
        status: meta?.status || "active",
        priority: meta?.priority || "normal",
        section: meta?.section || "default",
        notes: meta?.notes || "",
        remarks: meta?.remarks || "",
        internalRemarks: meta?.internalRemarks || "",
        tags: Array.isArray(meta?.tags) ? meta.tags : [],
        hidden: Boolean(meta?.hidden),
        updatedAt: meta?.updatedAt || null,
      },
    };
  });
};

const pickAdminRouteValue = (record, keys = []) => {
  if (!record || typeof record !== "object") {
    return null;
  }

  for (const key of keys) {
    if (!key || !Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }

    const value = record[key];
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        return value;
      }
      continue;
    }

    if (typeof value === "number") {
      if (Number.isFinite(value)) {
        return value;
      }
      continue;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "object") {
      return value;
    }
  }

  return null;
};

const mapAdminRouteServiceDays = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "number" ? item : normalizeAdminText(item)))
      .filter((item) => item !== null && item !== "");
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, enabled]) => parseAdminBooleanInput(enabled, false))
      .map(([day]) => day);
  }

  return parseAdminCsvValues(value);
};

const mapAdminRouteTextList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAdminText(item)).filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value).map((item) => normalizeAdminText(item)).filter(Boolean);
  }

  return parseAdminCsvValues(value);
};

const ADMIN_ROUTE_SERVICE_DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const buildAdminRouteDetail = async (routeId) => {
  const normalizedRouteId = Number(routeId || 0) || 0;
  if (normalizedRouteId <= 0) {
    throw new Error("Route ID is required");
  }

  const [catalogRoutes, airports, rawRouteResponse] = await Promise.all([
    loadAdminRoutesCatalog(),
    fetchAllPages("/airports?page[size]=300"),
    apiRequest(`/routes/${encodeURIComponent(String(normalizedRouteId))}?weight_unit=kg`),
  ]);

  const catalogRouteItems = Array.isArray(catalogRoutes?.routes)
    ? catalogRoutes.routes
    : Array.isArray(catalogRoutes)
      ? catalogRoutes
      : [];
  const rawRoute = rawRouteResponse?.data && typeof rawRouteResponse.data === "object" ? rawRouteResponse.data : rawRouteResponse;
  if (!rawRoute || typeof rawRoute !== "object") {
    throw new Error("Route not found");
  }
  const route = catalogRouteItems.find((item) => Number(item?.id || 0) === normalizedRouteId) || null;
  const airportMap = new Map(
    (Array.isArray(airports) ? airports : []).map((airport) => [
      Number(airport?.id || 0),
      {
        code: normalizeAdminText(airport?.icao || airport?.iata || airport?.id),
        name: normalizeAdminText(airport?.name),
      },
    ])
  );

  const departure = airportMap.get(Number(rawRoute?.departure_id || route?.departureId || 0)) || null;
  const arrival = airportMap.get(Number(rawRoute?.arrival_id || route?.arrivalId || 0)) || null;
  const simbriefOptions = rawRoute?.simbrief_options && typeof rawRoute.simbrief_options === "object" ? rawRoute.simbrief_options : {};
  const serviceDays = mapAdminRouteServiceDays(
    pickAdminRouteValue(rawRoute, ["service_days", "serviceDays", "days_of_operation", "daysOfOperation"])
  );

  const detail = {
    type: normalizeAdminText(rawRoute?.type || route?.type || "scheduled") || "scheduled",
    callsign: normalizeAdminText(pickAdminRouteValue(rawRoute, ["callsign", "flight_number", "flightNumber"]) || route?.callsign) || "",
    flightNumber: normalizeAdminText(pickAdminRouteValue(rawRoute, ["flight_number", "flightNumber", "callsign"]) || route?.flightNumber) || "",
    airlineCode: normalizeAdminText(route?.airlineCode) || "NWS",
    departureCode: normalizeAdminText(departure?.code || route?.fromCode) || "",
    departureName: normalizeAdminText(departure?.name || route?.fromName) || "",
    arrivalCode: normalizeAdminText(arrival?.code || route?.toCode) || "",
    arrivalName: normalizeAdminText(arrival?.name || route?.toName) || "",
    departureTimeUtc: normalizeAdminText(pickAdminRouteValue(rawRoute, ["departure_time", "departureTime", "off_block_time", "offBlockTime", "dep_time"])) || "",
    arrivalTimeUtc: normalizeAdminText(pickAdminRouteValue(rawRoute, ["arrival_time", "arrivalTime", "on_block_time", "onBlockTime", "arr_time"])) || "",
    startDate: normalizeAdminText(pickAdminRouteValue(rawRoute, ["start_date", "startDate", "effective_from", "effectiveFrom"])) || "",
    endDate: normalizeAdminText(pickAdminRouteValue(rawRoute, ["end_date", "endDate", "effective_to", "effectiveTo"])) || "",
    routeText: normalizeAdminText(pickAdminRouteValue(rawRoute, ["route", "route_text", "routing", "flight_plan", "flightPlan", "simbrief_route"])) || "",
    routeNotes: normalizeAdminText(pickAdminRouteValue(rawRoute, ["internal_remarks", "internalRemarks", "notes", "note"])) || "",
    remarks: normalizeAdminText(pickAdminRouteValue(rawRoute, ["remarks", "remark", "simbrief_remarks", "simbriefRemarks"])) || "",
    flightLevel: normalizeAdminText(pickAdminRouteValue(rawRoute, ["altitude", "flight_level", "flightLevel", "cruise_level", "cruiseLevel"])) || "",
    costIndex: normalizeAdminText(pickAdminRouteValue(rawRoute, ["cost_index", "costIndex"])) || "",
    fuelPolicy:
      normalizeAdminText(pickAdminRouteValue(rawRoute, ["fuel_policy", "fuelPolicy", "fuel_notes", "fuelNotes"])) ||
      normalizeAdminText(simbriefOptions?.resvrule) ||
      "",
    aircraftTypes: mapAdminRouteTextList(pickAdminRouteValue(rawRoute, ["aircraft_types", "aircraftTypes", "fleet_types", "fleetTypes"])),
    alternates: mapAdminRouteTextList(
      pickAdminRouteValue(rawRoute, ["alternate_airports", "alternateAirports", "alternates", "preferred_alternates"]) ||
        [simbriefOptions?.altn, simbriefOptions?.altn2].filter(Boolean)
    ),
    fleetIds: Array.isArray(rawRoute?.fleet_ids)
      ? rawRoute.fleet_ids.map((item) => Number(item || 0)).filter((item) => item > 0)
      : Array.isArray(route?.fleetIds)
        ? route.fleetIds.map((item) => Number(item || 0)).filter((item) => item > 0)
        : [],
    liveTags: mapAdminRouteTextList(pickAdminRouteValue(rawRoute, ["tag", "tags"])),
    liveHidden: Boolean(rawRoute?.hidden),
    serviceDays,
    distance: normalizeAdminText(rawRoute?.flight_distance ? `${rawRoute.flight_distance} nm` : route?.distance) || "—",
    duration: normalizeAdminText(rawRoute?.flight_length || route?.duration) || "—",
    frequency: normalizeAdminText(route?.frequency) || (serviceDays.length === 0 ? "daily" : serviceDays.join(", ")),
    source: "vamsys",
  };

  const fallbackRoute = route || {
    id: normalizedRouteId,
    flightNumber: detail.flightNumber,
    airlineCode:
      normalizeAdminText(route?.airlineCode) ||
      normalizeAdminText(detail.callsign).replace(/\d+/g, "") ||
      normalizeAdminText(detail.flightNumber).replace(/\d+/g, "") ||
      "NWS",
    fromCode: detail.departureCode,
    toCode: detail.arrivalCode,
    fromName: detail.departureName,
    toName: detail.arrivalName,
    distance: detail.distance,
    duration: detail.duration,
    fleetIds: detail.fleetIds,
  };

  return {
    ...fallbackRoute,
    detail,
  };
};

const parseAdminBooleanInput = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off", ""].includes(normalized)) {
    return false;
  }
  return fallback;
};

const parseAdminCsvValues = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const resolveAirportReferenceIds = async (input) => {
  const tokens = parseAdminCsvValues(input);
  if (tokens.length === 0) {
    return [];
  }

  const airports = await fetchAllPages("/airports?page[size]=300");
  const byId = new Map();
  const byCode = new Map();

  (Array.isArray(airports) ? airports : []).forEach((airport) => {
    const airportId = Number(airport?.id || 0) || 0;
    if (airportId <= 0) {
      return;
    }
    byId.set(String(airportId), airportId);
    [airport?.icao, airport?.iata].forEach((code) => {
      const normalized = String(code || "").trim().toUpperCase();
      if (normalized) {
        byCode.set(normalized, airportId);
      }
    });
  });

  const resolved = [];
  const unresolved = [];
  tokens.forEach((token) => {
    const normalized = String(token || "").trim();
    const numericId = byId.get(normalized);
    const codeId = byCode.get(normalized.toUpperCase());
    const airportId = numericId || codeId || null;
    if (airportId) {
      resolved.push(airportId);
      return;
    }
    unresolved.push(normalized);
  });

  if (unresolved.length > 0) {
    throw new Error(`Unknown airports: ${unresolved.join(", ")}`);
  }

  return Array.from(new Set(resolved));
};

const loadAdminAirportsCatalog = async () => {
  const airports = await fetchAllPages("/airports?page[size]=300&sort=name");

  return (Array.isArray(airports) ? airports : []).map((airport) => ({
    id: Number(airport?.id || 0) || 0,
    name: String(airport?.name || airport?.icao || airport?.iata || "Airport").trim(),
    icao: String(airport?.icao || "").trim(),
    iata: String(airport?.iata || "").trim(),
    category: String(airport?.category || "").trim() || "—",
    base: Boolean(airport?.base),
    suitableAlternate: Boolean(airport?.suitable_alternate),
    taxiInMinutes: Number(airport?.taxi_in_minutes || 0) || 0,
    taxiOutMinutes: Number(airport?.taxi_out_minutes || 0) || 0,
    airportBriefingUrl: String(airport?.airport_briefing_url || "").trim() || null,
    preferredAlternates: Array.isArray(airport?.preferred_alternates) ? airport.preferred_alternates : [],
    countryName: String(airport?.country?.name || "").trim() || "—",
    countryIso2: String(airport?.country?.iso2 || "").trim() || null,
    latitude: Number(airport?.latitude || 0) || null,
    longitude: Number(airport?.longitude || 0) || null,
    updatedAt: String(airport?.updated_at || airport?.created_at || "").trim() || null,
  }));
};

const buildAdminAirportPayload = (payload = {}, { isCreate = false } = {}) => {
  const nextPayload = {
    name: String(payload?.name || "").trim(),
    category: String(payload?.category || "").trim() || null,
    base: parseAdminBooleanInput(payload?.base, false),
    suitable_alternate: parseAdminBooleanInput(payload?.suitableAlternate ?? payload?.suitable_alternate, false),
    airport_briefing_url: String(payload?.airportBriefingUrl || payload?.airport_briefing_url || "").trim() || null,
    taxi_in_minutes: Number(payload?.taxiInMinutes ?? payload?.taxi_in_minutes ?? 0) || 0,
    taxi_out_minutes: Number(payload?.taxiOutMinutes ?? payload?.taxi_out_minutes ?? 0) || 0,
    preferred_alternates: parseAdminCsvValues(payload?.preferredAlternates ?? payload?.preferred_alternates).map((item) => item.toUpperCase()),
  };

  if (isCreate) {
    const icaoIata = String(payload?.icaoIata || payload?.icao_iata || "").trim().toUpperCase();
    if (!icaoIata) {
      throw new Error("ICAO/IATA is required");
    }
    nextPayload.icao_iata = icaoIata;
  }

  if (!nextPayload.name) {
    throw new Error("Airport name is required");
  }

  return nextPayload;
};

const loadAdminHubsCatalog = async () => {
  const [hubs, airportsLookup] = await Promise.all([
    fetchAllPages("/hubs?page[size]=100&sort=order"),
    loadAirportsLookup(),
  ]);

  return (Array.isArray(hubs) ? hubs : []).map((hub) => {
    const airportIds = Array.isArray(hub?.airport_ids) ? hub.airport_ids.map((item) => Number(item || 0)).filter((item) => item > 0) : [];
    const airportLabels = airportIds.map((airportId) => {
      const airport = airportsLookup.get(airportId) || null;
      return airport ? `${airport.code} - ${airport.name}` : String(airportId);
    });

    const primaryAirport = airportIds.length > 0 ? (airportsLookup.get(airportIds[0]) || null) : null;

    return {
      id: Number(hub?.id || 0) || 0,
      name: String(hub?.name || "Hub").trim() || "Hub",
      order: Number(hub?.order || 0) || 0,
      default: Boolean(hub?.default),
      pilotsCount: Number(hub?.pilots_count || 0) || 0,
      airportIds,
      airportLabels,
      airportsText: airportLabels.join(", "),
      city: primaryAirport?.city || null,
      countryName: primaryAirport?.countryName || null,
      countryIso2: primaryAirport?.countryIso2 || null,
      updatedAt: String(hub?.updated_at || hub?.created_at || "").trim() || null,
    };
  });
};

const buildAdminHubPayload = async (payload = {}) => {
  const name = String(payload?.name || "").trim();
  if (!name) {
    throw new Error("Hub name is required");
  }

  const airportIds = await resolveAirportReferenceIds(payload?.airportIds ?? payload?.airport_ids ?? payload?.airportRefs ?? payload?.airport_refs);
  if (airportIds.length === 0) {
    throw new Error("At least one airport is required for a hub");
  }

  return {
    name,
    airport_ids: airportIds,
    default: parseAdminBooleanInput(payload?.default, false),
    order: payload?.order === "" || payload?.order == null ? null : Number(payload.order || 0) || 0,
  };
};

const ADMIN_ROUTE_SERVICE_DAY_MAP = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  7: "sunday",
  0: "sunday",
};

const resolveSingleAirportReferenceId = async (input, label) => {
  const resolvedIds = await resolveAirportReferenceIds(input);
  if (resolvedIds.length === 0) {
    throw new Error(`${label} airport is required`);
  }
  if (resolvedIds.length > 1) {
    throw new Error(`${label} airport must resolve to exactly one airport`);
  }
  return resolvedIds[0];
};

const normalizeAdminRouteServiceDayValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1 && value <= 7) {
      return value;
    }
    if (value === 0) {
      return 7;
    }
    return null;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return ADMIN_ROUTE_SERVICE_DAY_MAP[normalized] || ADMIN_ROUTE_SERVICE_DAY_MAP[normalized.slice(0, 3)] || null;
};

const parseAdminRouteServiceDays = (input) => {
  const rawValues = Array.isArray(input)
    ? input
    : input && typeof input === "object"
      ? Object.entries(input)
          .filter(([, enabled]) => parseAdminBooleanInput(enabled, false))
          .map(([key]) => key)
      : parseAdminCsvValues(input);

  return Array.from(
    new Set(
      rawValues
        .map((item) => normalizeAdminRouteServiceDayValue(item))
        .filter((item) => typeof item === "string" && item)
    )
  ).sort((left, right) => ADMIN_ROUTE_SERVICE_DAY_ORDER.indexOf(left) - ADMIN_ROUTE_SERVICE_DAY_ORDER.indexOf(right));
};

const normalizeAdminRouteTimeValue = (input, label, { required = false } = {}) => {
  const normalized = String(input || "").trim();
  if (!normalized) {
    if (required) {
      throw new Error(`${label} time is required`);
    }
    return null;
  }

  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    throw new Error(`${label} time must use HH:MM or HH:MM:SS`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
    throw new Error(`${label} time is invalid`);
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const normalizeAdminRouteDateValue = (input, label, { endOfDay = false } = {}) => {
  const normalized = String(input || "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Date.parse(normalized);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    throw new Error(`${label} must use ISO datetime or YYYY-MM-DD`);
  }

  return `${match[1]}T${endOfDay ? "23:59:59" : "00:00:00"}+00:00`;
};

const resolveAdminRouteFleetIds = async (input) => {
  const tokens = Array.isArray(input)
    ? input.map((item) => String(item || "").trim()).filter(Boolean)
    : parseAdminCsvValues(input);

  if (tokens.length === 0) {
    return [];
  }

  const fleetCatalog = await getManagedFleetCatalog().catch(() => ({ fleets: [] }));
  const fleets = Array.isArray(fleetCatalog?.fleets) ? fleetCatalog.fleets : [];
  const byId = new Map();
  const byCode = new Map();
  const byName = new Map();

  fleets.forEach((fleet) => {
    const fleetId = Number(fleet?.id || 0) || 0;
    if (fleetId <= 0) {
      return;
    }

    byId.set(String(fleetId), fleetId);

    const fleetCode = String(fleet?.code || "").trim().toUpperCase();
    if (fleetCode) {
      byCode.set(fleetCode, fleetId);
    }

    const fleetName = String(fleet?.name || "").trim().toUpperCase();
    if (fleetName) {
      byName.set(fleetName, fleetId);
    }
  });

  const resolved = [];
  const unresolved = [];

  tokens.forEach((token) => {
    const normalized = String(token || "").trim();
    const numericId = byId.get(normalized);
    const codeId = byCode.get(normalized.toUpperCase());
    const nameId = byName.get(normalized.toUpperCase());
    const fleetId = numericId || codeId || nameId || null;
    if (fleetId) {
      resolved.push(fleetId);
      return;
    }
    unresolved.push(normalized);
  });

  if (unresolved.length > 0) {
    throw new Error(`Unknown fleet references: ${unresolved.join(", ")}`);
  }

  return Array.from(new Set(resolved));
};

const hasAdminRoutePayloadField = (payload = {}, keys = []) =>
  keys.some((key) => key && Object.prototype.hasOwnProperty.call(payload, key));

const getAdminRoutePayloadField = (payload = {}, keys = []) => {
  for (const key of keys) {
    if (key && Object.prototype.hasOwnProperty.call(payload, key)) {
      return payload[key];
    }
  }

  return undefined;
};

const buildAdminRoutePayload = async (payload = {}) => {
  const flightNumber = String(payload?.flightNumber ?? payload?.flight_number ?? "").trim().toUpperCase();
  const callsign = String(payload?.callsign ?? flightNumber).trim().toUpperCase();
  if (!flightNumber) {
    throw new Error("Flight number is required");
  }
  if (!callsign) {
    throw new Error("Callsign is required");
  }

  const departureId = await resolveSingleAirportReferenceId(
    payload?.departureId ?? payload?.departure_id ?? payload?.departureCode ?? payload?.departure_code ?? payload?.departure,
    "Departure"
  );
  const arrivalId = await resolveSingleAirportReferenceId(
    payload?.arrivalId ?? payload?.arrival_id ?? payload?.arrivalCode ?? payload?.arrival_code ?? payload?.arrival,
    "Arrival"
  );

  const fleetIds = await resolveAdminRouteFleetIds(payload?.fleetIds ?? payload?.fleet_ids ?? payload?.fleetRefs ?? payload?.fleet_refs);
  if (fleetIds.length === 0) {
    throw new Error("At least one fleet is required");
  }

  const serviceDays = parseAdminRouteServiceDays(
    payload?.serviceDays ?? payload?.service_days ?? payload?.daysOfOperation ?? payload?.days_of_operation
  );
  if (serviceDays.length === 0) {
    throw new Error("At least one service day is required");
  }

  const departureTime = normalizeAdminRouteTimeValue(
    payload?.departureTimeUtc ?? payload?.departure_time ?? payload?.departureTime ?? payload?.off_block_time ?? payload?.offBlockTime,
    "Departure",
    { required: true }
  );
  const arrivalTime = normalizeAdminRouteTimeValue(
    payload?.arrivalTimeUtc ?? payload?.arrival_time ?? payload?.arrivalTime ?? payload?.on_block_time ?? payload?.onBlockTime,
    "Arrival",
    { required: true }
  );

  const startDate = normalizeAdminRouteDateValue(
    payload?.startDate ?? payload?.start_date ?? payload?.effectiveFrom ?? payload?.effective_from,
    "Start date",
    { endOfDay: false }
  );
  const endDate = normalizeAdminRouteDateValue(
    payload?.endDate ?? payload?.end_date ?? payload?.effectiveTo ?? payload?.effective_to,
    "End date",
    { endOfDay: true }
  );
  if (startDate && endDate && Date.parse(endDate) < Date.parse(startDate)) {
    throw new Error("End date cannot be earlier than start date");
  }

  const nextPayload = {
    type: String(payload?.type || "scheduled").trim().toLowerCase() || "scheduled",
    callsign,
    flight_number: flightNumber,
    departure_id: departureId,
    arrival_id: arrivalId,
    fleet_ids: fleetIds,
    service_days: serviceDays,
    departure_time: departureTime,
    arrival_time: arrivalTime,
    flight_length: String(payload?.duration ?? payload?.flightLength ?? payload?.flight_length ?? "").trim() || null,
    flight_distance:
      payload?.distanceNm == null || payload?.distanceNm === ""
        ? payload?.flightDistance == null || payload?.flight_distance === ""
          ? null
          : Number(payload?.flightDistance ?? payload?.flight_distance ?? 0) || null
        : Number(payload?.distanceNm || 0) || null,
    start_date: startDate,
    end_date: endDate,
    altitude:
      payload?.altitude == null || payload?.altitude === ""
        ? payload?.flightLevel == null || payload?.flightLevel === ""
          ? null
          : Number(payload?.flightLevel || 0) || null
        : Number(payload?.altitude || 0) || null,
    route: String(payload?.routeText ?? payload?.route ?? payload?.route_text ?? payload?.routing ?? payload?.flight_plan ?? payload?.flightPlan ?? "").trim() || null,
    remarks: String(payload?.remarks ?? payload?.remark ?? payload?.simbriefRemarks ?? payload?.simbrief_remarks ?? "").trim() || null,
    internal_remarks: String(payload?.routeNotes ?? payload?.internalRemarks ?? payload?.internal_remarks ?? payload?.notes ?? payload?.note ?? "").trim() || null,
    cost_index: String(payload?.costIndex ?? payload?.cost_index ?? "").trim() || null,
    tag: parseAdminCsvValues(payload?.liveTags ?? payload?.tag ?? payload?.tags).filter(Boolean),
    fuel_policy: String(payload?.fuelPolicy ?? payload?.fuel_policy ?? payload?.fuelNotes ?? payload?.fuel_notes ?? "").trim() || null,
    hidden: payload?.hidden == null ? null : parseAdminBooleanInput(payload?.hidden, false),
  };

  return Object.fromEntries(
    Object.entries(nextPayload).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
};

const buildAdminRouteUpdatePayload = async (payload = {}) => {
  const nextPayload = {};

  if (hasAdminRoutePayloadField(payload, ["departureId", "departure_id", "departureCode", "departure_code", "departure"])) {
    throw new Error("Departure airport cannot be changed after route creation");
  }

  if (hasAdminRoutePayloadField(payload, ["arrivalId", "arrival_id", "arrivalCode", "arrival_code", "arrival"])) {
    throw new Error("Arrival airport cannot be changed after route creation");
  }

  if (hasAdminRoutePayloadField(payload, ["type"])) {
    nextPayload.type = String(payload?.type || "").trim().toLowerCase() || null;
  }

  if (hasAdminRoutePayloadField(payload, ["callsign"])) {
    const callsign = String(payload?.callsign || "").trim().toUpperCase();
    nextPayload.callsign = callsign || null;
  }

  if (hasAdminRoutePayloadField(payload, ["flightNumber", "flight_number"])) {
    const flightNumber = String(payload?.flightNumber ?? payload?.flight_number ?? "").trim().toUpperCase();
    nextPayload.flight_number = flightNumber || null;
  }

  if (hasAdminRoutePayloadField(payload, ["fleetIds", "fleet_ids", "fleetRefs", "fleet_refs"])) {
    const nextType = String(payload?.type || "").trim().toLowerCase();
    const fleetIds = await resolveAdminRouteFleetIds(getAdminRoutePayloadField(payload, ["fleetIds", "fleet_ids", "fleetRefs", "fleet_refs"]));
    if (fleetIds.length === 0 && nextType !== "jumpseat") {
      throw new Error("At least one fleet is required unless the route type is jumpseat");
    }
    nextPayload.fleet_ids = fleetIds;
  }

  if (hasAdminRoutePayloadField(payload, ["serviceDays", "service_days", "daysOfOperation", "days_of_operation"])) {
    nextPayload.service_days = parseAdminRouteServiceDays(
      getAdminRoutePayloadField(payload, ["serviceDays", "service_days", "daysOfOperation", "days_of_operation"])
    );
  }

  if (hasAdminRoutePayloadField(payload, ["departureTimeUtc", "departure_time", "departureTime", "off_block_time", "offBlockTime"])) {
    nextPayload.departure_time = normalizeAdminRouteTimeValue(
      getAdminRoutePayloadField(payload, ["departureTimeUtc", "departure_time", "departureTime", "off_block_time", "offBlockTime"]),
      "Departure"
    );
  }

  if (hasAdminRoutePayloadField(payload, ["arrivalTimeUtc", "arrival_time", "arrivalTime", "on_block_time", "onBlockTime"])) {
    nextPayload.arrival_time = normalizeAdminRouteTimeValue(
      getAdminRoutePayloadField(payload, ["arrivalTimeUtc", "arrival_time", "arrivalTime", "on_block_time", "onBlockTime"]),
      "Arrival"
    );
  }

  if (hasAdminRoutePayloadField(payload, ["startDate", "start_date", "effectiveFrom", "effective_from"])) {
    nextPayload.start_date = normalizeAdminRouteDateValue(
      getAdminRoutePayloadField(payload, ["startDate", "start_date", "effectiveFrom", "effective_from"]),
      "Start date",
      { endOfDay: false }
    );
  }

  if (hasAdminRoutePayloadField(payload, ["endDate", "end_date", "effectiveTo", "effective_to"])) {
    nextPayload.end_date = normalizeAdminRouteDateValue(
      getAdminRoutePayloadField(payload, ["endDate", "end_date", "effectiveTo", "effective_to"]),
      "End date",
      { endOfDay: true }
    );
  }

  if (nextPayload.start_date && nextPayload.end_date && Date.parse(nextPayload.end_date) < Date.parse(nextPayload.start_date)) {
    throw new Error("End date cannot be earlier than start date");
  }

  if (hasAdminRoutePayloadField(payload, ["duration", "flightLength", "flight_length"])) {
    nextPayload.flight_length =
      String(getAdminRoutePayloadField(payload, ["duration", "flightLength", "flight_length"]) || "").trim() || null;
  }

  if (hasAdminRoutePayloadField(payload, ["distanceNm", "flightDistance", "flight_distance"])) {
    const rawDistance = getAdminRoutePayloadField(payload, ["distanceNm", "flightDistance", "flight_distance"]);
    nextPayload.flight_distance = rawDistance == null || rawDistance === "" ? null : Number(rawDistance || 0) || null;
  }

  if (hasAdminRoutePayloadField(payload, ["altitude", "flightLevel", "flight_level", "cruiseLevel", "cruise_level"])) {
    const rawAltitude = getAdminRoutePayloadField(payload, ["altitude", "flightLevel", "flight_level", "cruiseLevel", "cruise_level"]);
    nextPayload.altitude = rawAltitude == null || rawAltitude === "" ? null : Number(rawAltitude || 0) || null;
  }

  if (hasAdminRoutePayloadField(payload, ["routeText", "route", "route_text", "routing", "flight_plan", "flightPlan"])) {
    nextPayload.route =
      String(getAdminRoutePayloadField(payload, ["routeText", "route", "route_text", "routing", "flight_plan", "flightPlan"]) || "").trim() || null;
  }

  if (hasAdminRoutePayloadField(payload, ["remarks", "remark", "simbriefRemarks", "simbrief_remarks"])) {
    nextPayload.remarks = String(getAdminRoutePayloadField(payload, ["remarks", "remark", "simbriefRemarks", "simbrief_remarks"]) || "").trim() || null;
  }

  if (hasAdminRoutePayloadField(payload, ["routeNotes", "internalRemarks", "internal_remarks", "notes", "note"])) {
    nextPayload.internal_remarks =
      String(getAdminRoutePayloadField(payload, ["routeNotes", "internalRemarks", "internal_remarks", "notes", "note"]) || "").trim() || null;
  }

  if (hasAdminRoutePayloadField(payload, ["costIndex", "cost_index"])) {
    nextPayload.cost_index = String(getAdminRoutePayloadField(payload, ["costIndex", "cost_index"]) || "").trim() || null;
  }

  if (hasAdminRoutePayloadField(payload, ["liveTags", "tag", "tags"])) {
    nextPayload.tag = parseAdminCsvValues(getAdminRoutePayloadField(payload, ["liveTags", "tag", "tags"]))
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (hasAdminRoutePayloadField(payload, ["hidden"])) {
    nextPayload.hidden = parseAdminBooleanInput(payload?.hidden, false);
  }

  return Object.fromEntries(Object.entries(nextPayload).filter(([, value]) => value !== undefined));
};

const computeAdminActivityStatus = (activity = {}) => {
  const now = Date.now();
  const showFrom = Date.parse(String(activity?.show_from || activity?.showFrom || ""));
  const start = Date.parse(String(activity?.start || ""));
  const end = Date.parse(String(activity?.end || ""));

  if (Number.isFinite(end) && end < now) {
    return "ended";
  }
  if (Number.isFinite(showFrom) && showFrom > now) {
    return "hidden";
  }
  if (Number.isFinite(start) && start > now) {
    return "upcoming";
  }
  return "active";
};

const formatFocusAirportTarget = (activity = {}, airportsLookup = null) => {
  const airportId = Number(activity?.airport_id || 0) || 0;
  if (airportId <= 0) {
    return "Focus airport";
  }

  const airport = airportsLookup instanceof Map ? airportsLookup.get(airportId) || null : null;
  if (!airport || typeof airport !== "object") {
    return `Airport #${airportId}`;
  }

  const code = String(airport?.icao || airport?.code || airport?.iata || "").trim();
  const name = String(airport?.name || "").trim();

  if (name && code && name.toUpperCase() !== code.toUpperCase()) {
    return `${name} (${code})`;
  }
  if (name) {
    return name;
  }
  if (code) {
    return code;
  }

  return `Airport #${airportId}`;
};

const formatAdminActivityTarget = (activity = {}, type = "", airportsLookup = null) => {
  if (type === "FocusAirport") {
    return formatFocusAirportTarget(activity, airportsLookup);
  }
  if (type === "Tour" || type === "Roster") {
    const legsCount = Array.isArray(activity?.legs) ? activity.legs.length : 0;
    return `${legsCount} legs`;
  }
  if (type === "CommunityGoal") {
    const current = Number(activity?.current_progress || 0) || 0;
    const target = Number(activity?.target || activity?.count_target || 0) || 0;
    const unit = String(activity?.unit || "").trim();
    return `${current}/${target}${unit ? ` ${unit}` : ""}`;
  }
  if (type === "CommunityChallenge") {
    const teams = Array.isArray(activity?.teams) ? activity.teams : [];
    return teams.map((team) => `${team?.name || "Team"}: ${Number(team?.current_progress || 0) || 0}/${Number(team?.target || 0) || 0}`).join(" | ") || "2 teams";
  }
  const points = Number(activity?.points || 0) || 0;
  return points > 0 ? `${points} pts` : "—";
};

const loadAdminActivitiesCatalog = async () => {
  const endpoints = [
    { type: "Event", path: "/activities/events?page[size]=100&sort=order,-start&filter[include_past]=true" },
    { type: "FocusAirport", path: "/activities/focus-airports?page[size]=100&sort=order,-start&filter[include_past]=true" },
    { type: "Tour", path: "/activities/tours?page[size]=100&sort=order,-start&filter[include_past]=true" },
    { type: "Roster", path: "/activities/rosters?page[size]=100&sort=order,-start&filter[include_past]=true" },
    { type: "CommunityGoal", path: "/activities/community-goals?page[size]=100&sort=order,-start&filter[include_past]=true" },
    { type: "CommunityChallenge", path: "/activities/community-challenges?page[size]=100&sort=order,-start&filter[include_past]=true" },
  ];

  const [collections, airportsLookup] = await Promise.all([
    Promise.all(
      endpoints.map(async (endpoint) => ({
        type: endpoint.type,
        items: await fetchAllPages(endpoint.path).catch(() => []),
      }))
    ),
    loadAirportsLookup().catch(() => new Map()),
  ]);

  const activities = collections.flatMap((collection) =>
    (Array.isArray(collection.items) ? collection.items : []).map((item) => ({
      id: `${collection.type}-${item?.id}`,
      originalId: Number(item?.id || 0) || 0,
      type: collection.type,
      subtype: String(item?.subtype || "").trim() || null,
      name: String(item?.name || `${collection.type} ${item?.id || ""}`).trim(),
      description: String(item?.description || "").trim(),
      sidebarTitle: String(item?.sidebar_title || "").trim() || null,
      sidebarContent: String(item?.sidebar_content || "").trim() || null,
      image: String(item?.image || "").trim() || null,
      imageDark: String(item?.image_dark || "").trim() || null,
      tags: Array.isArray(item?.tags) ? item.tags : [],
      start: String(item?.start || "").trim() || null,
      end: String(item?.end || "").trim() || null,
      showFrom: String(item?.show_from || "").trim() || null,
      status: computeAdminActivityStatus(item),
      registrationOpen: resolveActivityRegistrationOpen(item),
      target: formatAdminActivityTarget(item, collection.type, airportsLookup),
      registrationCount: Number(item?.registration_count || 0) || 0,
      completionCount: Number(item?.completion_count || 0) || 0,
      points: Number(item?.points || 0) || 0,
      createdAt: String(item?.created_at || "").trim() || null,
      updatedAt: String(item?.updated_at || item?.created_at || "").trim() || null,
    }))
  );

  activities.sort((left, right) => {
    const leftTime = Date.parse(String(left?.start || left?.showFrom || ""));
    const rightTime = Date.parse(String(right?.start || right?.showFrom || ""));
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });

  const summary = activities.reduce((accumulator, item) => {
    const typeKey = String(item?.type || "Other");
    accumulator.total += 1;
    accumulator.byType[typeKey] = (accumulator.byType[typeKey] || 0) + 1;
    accumulator.byStatus[item.status] = (accumulator.byStatus[item.status] || 0) + 1;
    return accumulator;
  }, { total: 0, byType: {}, byStatus: {} });

  return { activities, summary };
};

const inferAdminBookingStatus = (booking = {}) => {
  if (booking?.deleted_at) {
    return "cancelled";
  }
  if ((Number(booking?.pirep_id || 0) || 0) > 0) {
    return "completed";
  }
  return normalizeAdminText(booking?.status || "active") || "active";
};

const loadAdminBookingsCatalog = async ({ limit = 100 } = {}) => {
  const pageSize = Math.max(1, Math.min(200, Number(limit) || 100));
  const [bookings, routesPayload, fleetPayload, pilotsPayload] = await Promise.all([
    fetchAllPages(`/bookings?page[size]=${pageSize}&sort=-created_at`),
    loadRoutesData().catch(() => ({ routes: [] })),
    loadFleetData().catch(() => ({ fleets: [] })),
    loadPilotsRoster().catch(() => ({ pilots: [] })),
  ]);

  const routeMap = new Map((Array.isArray(routesPayload?.routes) ? routesPayload.routes : []).map((item) => [Number(item?.id || 0), item]));
  const pilotMap = new Map((Array.isArray(pilotsPayload?.pilots) ? pilotsPayload.pilots : []).map((item) => [Number(item?.id || 0), item]));
  const aircraftMap = new Map();

  (Array.isArray(fleetPayload?.fleets) ? fleetPayload.fleets : []).forEach((fleet) => {
    (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).forEach((item) => {
      const id = Number(item?.id || 0) || 0;
      if (id > 0) {
        aircraftMap.set(id, item);
      }
    });
  });

  const bookingMeta = getBookingMetaStore();

  return (Array.isArray(bookings) ? bookings : []).map((booking) => {
    const routeId = Number(booking?.route_id || 0) || 0;
    const aircraftId = Number(booking?.aircraft_id || 0) || 0;
    const pilotId = Number(booking?.pilot_id || 0) || 0;
    const route = routeMap.get(routeId) || null;
    const aircraft = aircraftMap.get(aircraftId) || null;
    const pilot = pilotMap.get(pilotId) || null;
    const meta = bookingMeta[String(booking?.id || "")] || {};

    return {
      id: Number(booking?.id || 0) || 0,
      pilotId: pilotId || null,
      pilotName: normalizeAdminText(pilot?.name || booking?.pilot?.name || booking?.pilot_name || "Pilot"),
      pilotUsername: normalizeAdminText(pilot?.username || booking?.pilot?.username || ""),
      callsign: normalizeAdminText(booking?.callsign || booking?.flight_number || route?.flightNumber || "Booking"),
      routeId: routeId || null,
      routeLabel: route ? `${route.fromCode || "----"} → ${route.toCode || "----"}` : "—",
      departure: route?.fromCode || normalizeAdminText(booking?.departure_id),
      arrival: route?.toCode || normalizeAdminText(booking?.arrival_id),
      aircraftId: aircraftId || null,
      aircraftLabel: normalizeAdminText(aircraft?.model || booking?.aircraft?.name || booking?.aircraft?.type || "—"),
      departureTime: normalizeAdminText(booking?.departure_time),
      createdAt: normalizeAdminText(booking?.created_at),
      status: inferAdminBookingStatus(booking),
      meta: {
        tag: meta?.tag || "",
        priority: meta?.priority || "normal",
        notes: meta?.notes || "",
        updatedAt: meta?.updatedAt || null,
      },
    };
  });
};

const markTelemetryDiskDirty = () => {
  telemetryDiskPersistState.dirty = true;
};

const takeNewestEntries = (entries, maxEntries) => {
  if (!Array.isArray(entries) || entries.length <= maxEntries) {
    return Array.isArray(entries) ? entries : [];
  }

  return entries
    .slice()
    .sort((a, b) => Number(a?.updatedAt || 0) - Number(b?.updatedAt || 0))
    .slice(-maxEntries);
};

const persistTelemetrySnapshotToDisk = () => {
  if (!TELEMETRY_DISK_CACHE_ENABLED) {
    return;
  }
  if (telemetryDiskPersistState.flushInFlight || !telemetryDiskPersistState.dirty) {
    return;
  }

  telemetryDiskPersistState.flushInFlight = true;

  try {
    const historyEntries = takeNewestEntries(
      Array.from(telemetryHistoryCache.entries()).map(([key, value]) => ({
        key,
        updatedAt: Number(value?.updatedAt || 0),
        points: Array.isArray(value?.points) ? value.points : [],
      })),
      TELEMETRY_DISK_MAX_ENTRIES
    );

    const backfillEntries = takeNewestEntries(
      Array.from(telemetryBackfillCache.entries()).map(([key, value]) => ({
        key,
        updatedAt: Number(value?.updatedAt || value?.lastAttemptAt || 0),
        points: Array.isArray(value?.points) ? value.points : [],
      })),
      TELEMETRY_DISK_MAX_BACKFILL_ENTRIES
    );

    const payload = {
      version: 1,
      savedAt: Date.now(),
      historyEntries,
      backfillEntries,
    };

    ensureAuthStoreDir();
    const tempPath = `${TELEMETRY_HISTORY_FILE}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(payload)}\n`, "utf8");
    fs.renameSync(tempPath, TELEMETRY_HISTORY_FILE);

    telemetryDiskPersistState.lastPersistAt = Date.now();
    telemetryDiskPersistState.dirty = false;
  } catch (err) {
    logger.warn("[telemetry] disk_persist_failed", String(err));
  } finally {
    telemetryDiskPersistState.flushInFlight = false;
  }
};

const loadTelemetrySnapshotFromDisk = () => {
  if (!TELEMETRY_DISK_CACHE_ENABLED) {
    return;
  }

  try {
    if (!fs.existsSync(TELEMETRY_HISTORY_FILE)) {
      return;
    }

    const raw = fs.readFileSync(TELEMETRY_HISTORY_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const now = Date.now();

    const historyEntries = Array.isArray(parsed?.historyEntries) ? parsed.historyEntries : [];
    for (const entry of historyEntries) {
      const key = String(entry?.key || "").trim();
      if (!key) {
        continue;
      }

      const points = Array.isArray(entry?.points) ? entry.points : [];
      if (points.length < 2) {
        continue;
      }

      const updatedAt = Number(entry?.updatedAt || 0);
      if (now - updatedAt > TELEMETRY_HISTORY_TTL_MS) {
        continue;
      }

      const trimmedPoints =
        points.length > TELEMETRY_HISTORY_MAX_POINTS
          ? points.slice(points.length - TELEMETRY_HISTORY_MAX_POINTS)
          : points;

      telemetryHistoryCache.set(key, {
        updatedAt,
        points: trimmedPoints,
      });
    }

    const backfillEntries = Array.isArray(parsed?.backfillEntries) ? parsed.backfillEntries : [];
    for (const entry of backfillEntries) {
      const key = String(entry?.key || "").trim();
      if (!key) {
        continue;
      }

      const points = Array.isArray(entry?.points) ? entry.points : [];
      if (points.length < 2) {
        continue;
      }

      const updatedAt = Number(entry?.updatedAt || 0);
      if (now - updatedAt > TELEMETRY_HISTORY_TTL_MS) {
        continue;
      }

      const trimmedPoints =
        points.length > TELEMETRY_HISTORY_MAX_POINTS
          ? points.slice(points.length - TELEMETRY_HISTORY_MAX_POINTS)
          : points;

      telemetryBackfillCache.set(key, {
        points: trimmedPoints,
        updatedAt,
        lastAttemptAt: updatedAt,
        inFlight: null,
      });
    }

    telemetryDiskPersistState.dirty = false;
    telemetryDiskPersistState.lastPersistAt = Date.now();
    logger.info("[telemetry] disk_load_success", {
      file: TELEMETRY_HISTORY_FILE,
      historyEntries: telemetryHistoryCache.size,
      backfillEntries: telemetryBackfillCache.size,
    });
  } catch (err) {
    logger.warn("[telemetry] disk_load_failed", String(err));
  }
};

const persistAuthStore = () => {
  logger.info('[auth] persist_start', { AUTH_STORE_FILE });
  const discordOauthStates = {};
  for (const [state, expiresAt] of discordOauthStateCache.entries()) {
    discordOauthStates[state] = expiresAt;
  }

  const discordSessions = {};
  for (const [sessionId, session] of discordSessionCache.entries()) {
    discordSessions[sessionId] = session;
  }

  const vamsysOauthStates = {};
  for (const [state, expiresAt] of vamsysOauthStateCache.entries()) {
    vamsysOauthStates[state] = expiresAt;
  }

  const vamsysSessions = {};
  for (const [sessionId, session] of vamsysSessionCache.entries()) {
    vamsysSessions[sessionId] = session;
  }

  const pilotApiOauthStates = {};
  for (const [state, details] of pilotApiOauthStateCache.entries()) {
    pilotApiOauthStates[state] = details;
  }

  const currentLinks = {};
  for (const [id, link] of discordLinksCache.entries()) {
    currentLinks[id] = link;
  }

  const currentVamsysLinks = {};
  for (const [id, link] of vamsysLinksCache.entries()) {
    currentVamsysLinks[id] = link;
  }

  const currentAdminUsers = {};
  for (const [id, adminUser] of adminUsersCache.entries()) {
    currentAdminUsers[id] = adminUser;
  }

  const currentPilotPreferences = {};
  for (const [id, preferences] of pilotPreferencesCache.entries()) {
    currentPilotPreferences[id] = preferences;
  }

  const currentPilotNotamReads = {};
  for (const [id, reads] of pilotNotamReadsCache.entries()) {
    currentPilotNotamReads[id] = reads;
  }

  const currentCuratedPilots = {};
  for (const [id, details] of curatedPilotsCache.entries()) {
    currentCuratedPilots[id] = details;
  }

  const currentPilotBadgeAwards = {};
  for (const [id, awards] of pilotBadgeAwardsCache.entries()) {
    currentPilotBadgeAwards[id] = awards;
  }

  const currentToursCatalog = {};
  for (const [id, tour] of toursCatalogCache.entries()) {
    currentToursCatalog[id] = tour;
  }

  const payload = {
    version: 2,
    discordOauthStates,
    discordSessions,
    vamsysOauthStates,
    vamsysSessions,
    pilotApiOauthStates,
    discordLinks: currentLinks,
    vamsysLinks: currentVamsysLinks,
    adminUsers: currentAdminUsers,
    pilotPreferences: currentPilotPreferences,
    pilotNotamReads: currentPilotNotamReads,
    curatedPilots: currentCuratedPilots,
    pilotBadgeAwards: currentPilotBadgeAwards,
    toursCatalog: currentToursCatalog,
  };

  ensureAuthStoreDir();
  const tempPath = `${AUTH_STORE_FILE}.tmp`;
  try {
    fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, AUTH_STORE_FILE);
    logger.info('[auth] persist_success', { AUTH_STORE_FILE, vamsysSessions: Object.keys(vamsysSessions).length, discordSessions: Object.keys(discordSessions).length });
  } catch (err) {
    logger.error('[auth] persist_failed', String(err));
    try {
      // fallback to OS temp directory
      const fallbackBase = path.join(os.tmpdir(), path.basename(AUTH_STORE_FILE));
      const fallbackTemp = `${fallbackBase}.tmp`;
      fs.writeFileSync(fallbackTemp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      fs.renameSync(fallbackTemp, fallbackBase);
      // switch AUTH_STORE_FILE to the fallback so future writes use it
      AUTH_STORE_FILE = fallbackBase;
      logger.warn('[auth] persist_fallback_to_tmp', AUTH_STORE_FILE);
    } catch (err2) {
      logger.error('[auth] persist_fallback_failed', String(err2));
    }
  }
};

const updateAuthStoreLinks = ({ discordLink, vamsysLink } = {}) => {
  if (discordLink?.id) {
    const key = String(discordLink.id);
    const existing = discordLinksCache.get(key) || {};
    discordLinksCache.set(key, {
      ...existing,
      ...discordLink,
      id: key,
      metadata: {
        ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
        ...(discordLink?.metadata && typeof discordLink.metadata === "object" ? discordLink.metadata : {}),
      },
      updatedAt: new Date().toISOString(),
    });
  }

  if (vamsysLink?.id) {
    const key = String(vamsysLink.id);
    const existing = vamsysLinksCache.get(key) || {};
    vamsysLinksCache.set(key, {
      ...existing,
      ...vamsysLink,
      id: key,
      metadata: {
        ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
        ...(vamsysLink?.metadata && typeof vamsysLink.metadata === "object" ? vamsysLink.metadata : {}),
      },
      updatedAt: new Date().toISOString(),
    });
  }
  persistAuthStore();
};

const setAdminUser = ({ discordId, username, email, linkedBy, role = "admin", metadata = {} }) => {
  if (!discordId) {
    return;
  }

  const existing = adminUsersCache.get(discordId) || {};
  adminUsersCache.set(discordId, {
    provider: "discord",
    id: discordId,
    role,
    username: username || existing.username || "",
    email: email || existing.email || "",
    linkedBy: linkedBy || existing.linkedBy || "system",
    linkedAt: existing.linkedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      ...(existing.metadata && typeof existing.metadata === "object" ? existing.metadata : {}),
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    },
  });
  persistAuthStore();
};

const removeAdminUser = (discordId) => {
  if (!discordId) {
    return;
  }
  if (adminUsersCache.delete(discordId)) {
    persistAuthStore();
  }
};

const normalizeAdminValue = (value) => String(value || "").trim().toUpperCase();

const normalizePilotIdentityKey = (value) => String(value || "").trim();

const getPilotIdentityKeys = (pilot = {}) => {
  const keys = [
    pilot?.pilotId,
    pilot?.id,
    pilot?.user_id,
    pilot?.userId,
    pilot?.username,
    pilot?.email,
  ]
    .map(normalizePilotIdentityKey)
    .filter(Boolean);

  return Array.from(new Set(keys));
};

const resolvePilotScopedCacheValue = (cache, pilot = {}) => {
  for (const key of getPilotIdentityKeys(pilot)) {
    if (cache.has(key)) {
      return cache.get(key);
    }
  }
  return null;
};

const setPilotScopedCacheValue = (cache, pilot = {}, value) => {
  const keys = getPilotIdentityKeys(pilot);
  if (keys.length === 0) {
    return null;
  }

  keys.forEach((key) => {
    cache.set(key, value);
  });
  return keys[0];
};

const deletePilotScopedCacheValue = (cache, pilot = {}) => {
  const keys = getPilotIdentityKeys(pilot);
  if (keys.length === 0) {
    return false;
  }

  let deleted = false;
  keys.forEach((key) => {
    deleted = cache.delete(key) || deleted;
  });

  return deleted;
};

const cloneNotificationSettings = (value = DEFAULT_NOTIFICATION_SETTINGS) => ({
  channels: {
    ...DEFAULT_NOTIFICATION_SETTINGS.channels,
    ...(value?.channels && typeof value.channels === "object" ? value.channels : {}),
  },
  notificationTypes: {
    ...DEFAULT_NOTIFICATION_SETTINGS.notificationTypes,
    ...(value?.notificationTypes && typeof value.notificationTypes === "object" ? value.notificationTypes : {}),
  },
});

const getPilotPreferences = (pilot = {}) => {
  const existing = resolvePilotScopedCacheValue(pilotPreferencesCache, pilot);
  return {
    notifications: cloneNotificationSettings(existing?.notifications),
    updatedAt: String(existing?.updatedAt || "").trim() || null,
  };
};

const setPilotPreferences = (pilot = {}, partial = {}) => {
  const current = getPilotPreferences(pilot);
  const nextValue = {
    notifications: cloneNotificationSettings({
      channels: {
        ...current.notifications.channels,
        ...(partial?.notifications?.channels && typeof partial.notifications.channels === "object"
          ? partial.notifications.channels
          : {}),
      },
      notificationTypes: {
        ...current.notifications.notificationTypes,
        ...(partial?.notifications?.notificationTypes &&
        typeof partial.notifications.notificationTypes === "object"
          ? partial.notifications.notificationTypes
          : {}),
      },
    }),
    updatedAt: new Date().toISOString(),
  };

  setPilotScopedCacheValue(pilotPreferencesCache, pilot, nextValue);
  persistAuthStore();
  return nextValue;
};

const getPilotNotamReadState = (pilot = {}) => {
  const existing = resolvePilotScopedCacheValue(pilotNotamReadsCache, pilot);
  const entries = Array.isArray(existing?.entries) ? existing.entries : [];
  return {
    entries: entries
      .map((item) => ({
        notamId: Number(item?.notamId || 0) || 0,
        readAt: String(item?.readAt || "").trim() || null,
        notifiedAt: String(item?.notifiedAt || "").trim() || null,
        dmMessageId: String(item?.dmMessageId || "").trim() || null,
      }))
      .filter((item) => item.notamId > 0),
    updatedAt: String(existing?.updatedAt || "").trim() || null,
  };
};

const hasPilotReadNotam = (pilot = {}, notamId) => {
  const normalizedId = Number(notamId || 0) || 0;
  if (normalizedId <= 0) {
    return false;
  }
  return getPilotNotamReadState(pilot).entries.some((item) => item.notamId === normalizedId && item.readAt);
};

const markPilotNotamState = (pilot = {}, notamId, patch = {}) => {
  const normalizedId = Number(notamId || 0) || 0;
  if (normalizedId <= 0) {
    return getPilotNotamReadState(pilot);
  }

  const current = getPilotNotamReadState(pilot);
  const nextEntries = [...current.entries];
  const entryIndex = nextEntries.findIndex((item) => item.notamId === normalizedId);
  const existing = entryIndex >= 0 ? nextEntries[entryIndex] : { notamId: normalizedId, readAt: null, notifiedAt: null, dmMessageId: null };
  const updated = {
    ...existing,
    ...patch,
    notamId: normalizedId,
  };

  if (entryIndex >= 0) {
    nextEntries[entryIndex] = updated;
  } else {
    nextEntries.push(updated);
  }

  const nextValue = {
    entries: nextEntries,
    updatedAt: new Date().toISOString(),
  };
  setPilotScopedCacheValue(pilotNotamReadsCache, pilot, nextValue);
  persistAuthStore();
  return nextValue;
};

const getCuratedPilotMeta = (pilot = {}) => {
  const existing = resolvePilotScopedCacheValue(curatedPilotsCache, pilot);
  return existing && typeof existing === "object"
    ? {
        isCurated: Boolean(existing?.isCurated),
        note: String(existing?.note || "").trim() || null,
        updatedAt: String(existing?.updatedAt || "").trim() || null,
      }
    : {
        isCurated: false,
        note: null,
        updatedAt: null,
      };
};

const setCuratedPilotMeta = (pilot = {}, { isCurated = false, note = "" } = {}) => {
  const nextValue = {
    isCurated: Boolean(isCurated),
    note: String(note || "").trim() || null,
    updatedAt: new Date().toISOString(),
  };
  setPilotScopedCacheValue(curatedPilotsCache, pilot, nextValue);
  persistAuthStore();
  return nextValue;
};

const getPilotBadgeAwards = (pilot = {}) => {
  const existing = resolvePilotScopedCacheValue(pilotBadgeAwardsCache, pilot);
  return Array.isArray(existing)
    ? existing
        .map((item) => ({
          id: String(item?.id || "").trim(),
          title: String(item?.title || "").trim(),
          description: String(item?.description || "").trim(),
          iconUrl: String(item?.iconUrl || "").trim() || null,
          icon: String(item?.icon || "").trim() || null,
          color: String(item?.color || "").trim() || null,
          awardedAt: String(item?.awardedAt || "").trim() || null,
          source: String(item?.source || "local").trim() || "local",
          metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
        }))
        .filter((item) => item.id)
    : [];
};

const upsertPilotBadgeAward = (pilot = {}, badge = {}) => {
  const badgeId = String(badge?.id || "").trim();
  if (!badgeId) {
    return getPilotBadgeAwards(pilot);
  }

  const current = getPilotBadgeAwards(pilot);
  const nextAwards = [...current];
  const existingIndex = nextAwards.findIndex((item) => item.id === badgeId);
  const catalogBadge = LOCAL_BADGES_CATALOG.find((item) => item.id === badgeId) || null;
  const nextValue = {
    id: badgeId,
    title: String(badge?.title || catalogBadge?.title || badgeId).trim(),
    description: String(badge?.description || catalogBadge?.description || "").trim(),
    iconUrl: String(badge?.iconUrl || "").trim() || null,
    icon: String(badge?.icon || catalogBadge?.icon || "").trim() || null,
    color: String(badge?.color || catalogBadge?.color || "").trim() || null,
    awardedAt: String(badge?.awardedAt || new Date().toISOString()).trim(),
    source: String(badge?.source || "local").trim() || "local",
    metadata: badge?.metadata && typeof badge.metadata === "object" ? badge.metadata : {},
  };

  if (existingIndex >= 0) {
    nextAwards[existingIndex] = {
      ...nextAwards[existingIndex],
      ...nextValue,
    };
  } else {
    nextAwards.push(nextValue);
  }

  setPilotScopedCacheValue(pilotBadgeAwardsCache, pilot, nextAwards);
  persistAuthStore();
  return nextAwards;
};

const getResolvedToursCatalog = () => {
  const fromCache = Array.from(toursCatalogCache.values()).filter((item) => item && typeof item === "object");
  if (fromCache.length > 0) {
    return fromCache;
  }
  return DEFAULT_TOURS_CATALOG;
};

const computePilotToursProgress = ({ pilot = {}, claimsCount = 0 } = {}) => {
  const flights = Number(pilot?.flights || 0) || 0;
  const hours = Number(pilot?.hours || 0) || 0;
  const honoraryRankId = Number(pilot?.honorary_rank_id || pilot?.honoraryRankId || 0) || 0;
  const hasLocation = Boolean(String(pilot?.location || "").trim());

  return getResolvedToursCatalog().map((tour) => {
    const targets = tour?.targets && typeof tour.targets === "object" ? tour.targets : {};
    const parts = [];
    if (Number.isFinite(Number(targets?.flights))) {
      parts.push({ label: "Flights", current: flights, target: Number(targets.flights) || 0 });
    }
    if (Number.isFinite(Number(targets?.hours))) {
      parts.push({ label: "Hours", current: hours, target: Number(targets.hours) || 0 });
    }
    if (Number.isFinite(Number(targets?.claims))) {
      parts.push({ label: "Claims", current: Number(claimsCount || 0) || 0, target: Number(targets.claims) || 0 });
    }
    if (typeof targets?.locationSet === "boolean") {
      parts.push({ label: "Location", current: hasLocation ? 1 : 0, target: targets.locationSet ? 1 : 0 });
    }
    if (typeof targets?.honoraryRank === "boolean") {
      parts.push({ label: "Honorary rank", current: honoraryRankId > 0 ? 1 : 0, target: targets.honoraryRank ? 1 : 0 });
    }

    const completedParts = parts.filter((item) => item.current >= item.target && item.target > 0).length;
    const completionRatio = parts.length === 0 ? 0 : completedParts / parts.length;

    return {
      id: String(tour?.id || "").trim(),
      title: String(tour?.title || "Tour").trim() || "Tour",
      description: String(tour?.description || "").trim(),
      isLocal: Boolean(tour?.isLocal),
      completionRatio,
      completed: parts.length > 0 && completedParts === parts.length,
      parts,
    };
  });
};

const deriveAutomaticBadgesForPilot = ({ pilot = {}, claimsCount = 0 } = {}) => {
  const flights = Number(pilot?.flights || 0) || 0;
  const hours = Number(pilot?.hours || 0) || 0;
  const honoraryRankId = Number(pilot?.honorary_rank_id || pilot?.honoraryRankId || 0) || 0;
  const hasLocation = Boolean(String(pilot?.location || "").trim());

  return LOCAL_BADGES_CATALOG.filter((badge) => {
    switch (badge.id) {
      case "first-flight":
        return flights >= 1;
      case "ten-flights":
        return flights >= 10;
      case "hundred-hours":
        return hours >= 100;
      case "honorary-rank":
        return honoraryRankId > 0;
      case "claim-submitted":
        return Number(claimsCount || 0) >= 1;
      case "location-set":
        return hasLocation;
      default:
        return false;
    }
  });
};

const getUnreadNotamsForPilot = (pilot = {}, notams = [], { mustReadOnly = false } = {}) => {
  return (Array.isArray(notams) ? notams : []).filter((item) => {
    const notamId = Number(item?.id || 0) || 0;
    if (notamId <= 0) {
      return false;
    }
    if (mustReadOnly && !Boolean(item?.mustRead)) {
      return false;
    }
    return !hasPilotReadNotam(pilot, notamId);
  });
};

const createUnreadNotamsBookingError = (unreadNotams = []) => {
  const unreadCount = Array.isArray(unreadNotams) ? unreadNotams.length : 0;
  return createPilotApiError(
    409,
    "notams_unread",
    unreadCount > 0
      ? `You have ${unreadCount} unread NOTAM${unreadCount === 1 ? "" : "s"}. Open the NOTAM tab or use /notams and mark them as read before creating a booking.`
      : "Unread NOTAMs must be acknowledged before creating a booking."
  );
};

const buildBadgeIconDataUrl = ({ icon = "BD", color = "#E31E24" } = {}) => {
  const safeIcon = encodeURIComponent(String(icon || "BD").trim().slice(0, 4) || "BD");
  const safeColor = encodeURIComponent(String(color || "#E31E24").trim() || "#E31E24");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="${safeColor}"/><circle cx="48" cy="48" r="34" fill="rgba(255,255,255,0.14)"/><text x="48" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">${safeIcon}</text></svg>`;
  return `data:image/svg+xml;utf8,${svg}`;
};

const loadOperationsBadgesCatalog = async () => {
  const now = Date.now();
  if (badgesCatalogCache.items && now < badgesCatalogCache.expiresAt) {
    return badgesCatalogCache.items;
  }

  try {
    const payload = await fetchAllPages("/badges?page[size]=100");
    const items = (Array.isArray(payload) ? payload : []).map((badge) => ({
      id: String(badge?.slug || badge?.code || badge?.id || "").trim(),
      externalId: Number(badge?.id || 0) || null,
      title: String(badge?.name || badge?.title || badge?.label || "Badge").trim() || "Badge",
      description: String(badge?.description || badge?.content || "").trim(),
      iconUrl: String(badge?.icon || badge?.icon_url || badge?.image || badge?.image_url || "").trim() || null,
      color: String(badge?.color || badge?.hex_color || "").trim() || null,
      source: "operations",
      metadata: badge && typeof badge === "object" ? badge : {},
    })).filter((badge) => badge.id);

    badgesCatalogCache = {
      items,
      expiresAt: now + 10 * 60 * 1000,
    };
    return items;
  } catch {
    badgesCatalogCache = {
      items: [],
      expiresAt: now + 60 * 1000,
    };
    return [];
  }
};

const syncPilotBadges = async ({ pilot = {}, claimsCount = 0 } = {}) => {
  const operationsBadges = await loadOperationsBadgesCatalog();
  const currentAwards = getPilotBadgeAwards(pilot);
  const newlyAwarded = [];

  deriveAutomaticBadgesForPilot({ pilot, claimsCount }).forEach((badge) => {
    const exists = currentAwards.some((item) => item.id === badge.id);
    if (!exists) {
      newlyAwarded.push(badge.id);
    }
    upsertPilotBadgeAward(pilot, {
      ...badge,
      iconUrl: buildBadgeIconDataUrl({ icon: badge.icon, color: badge.color }),
      source: "local",
    });
  });

  const mergedAwards = getPilotBadgeAwards(pilot).map((award) => {
    const operationsBadge = operationsBadges.find(
      (item) => item.id === award.id || (item.externalId && item.externalId === Number(award.id || 0))
    );
    return {
      ...award,
      title: String(operationsBadge?.title || award.title || award.id).trim(),
      description: String(operationsBadge?.description || award.description || "").trim(),
      iconUrl:
        String(operationsBadge?.iconUrl || award.iconUrl || "").trim() ||
        buildBadgeIconDataUrl({ icon: award.icon, color: award.color }),
      color: String(operationsBadge?.color || award.color || "#E31E24").trim() || "#E31E24",
      source: operationsBadge ? "operations" : award.source,
      metadata: {
        ...(award?.metadata && typeof award.metadata === "object" ? award.metadata : {}),
        operationsBadge: operationsBadge?.metadata || null,
      },
    };
  });

  setPilotScopedCacheValue(pilotBadgeAwardsCache, pilot, mergedAwards);
  persistAuthStore();

  return {
    badges: mergedAwards.sort((left, right) => {
      const leftTime = Date.parse(String(left?.awardedAt || ""));
      const rightTime = Date.parse(String(right?.awardedAt || ""));
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    }),
    newlyAwarded,
  };
};

const isDiscordAdmin = (discordId) => {
  if (!discordId) {
    return false;
  }
  if (ADMIN_DISCORD_IDS.includes(discordId)) {
    return true;
  }
  const entry = adminUsersCache.get(discordId);
  return Boolean(entry && (entry.role === "admin" || entry.role === "staff"));
};

const normalizeConfiguredAdminValue = (value) => String(value || "").trim().toUpperCase();

const hasStaffLikeHonoraryRankName = (value) => {
  const normalized = normalizeConfiguredAdminValue(value);
  if (!normalized) {
    return false;
  }

  if (ADMIN_VAMSYS_HONORARY_RANK_NAMES.includes(normalized)) {
    return true;
  }

  return /(^|[\s_-])STAFF($|[\s_-])/.test(normalized);
};

const hasConfiguredVamsysAdminAccess = (user = {}) => {
  if (!user || typeof user !== "object") {
    return false;
  }

  const configuredIds = [
    user?.id,
    user?.user_id,
    user?.vamsys_id,
    user?.vamsysId,
    user?.pilot_id,
    user?.pilotId,
    user?.vamsysPilotId,
  ]
    .map((value) => normalizeConfiguredAdminValue(value))
    .filter(Boolean);

  if (configuredIds.some((value) => ADMIN_VAMSYS_IDS.includes(value))) {
    return true;
  }

  const configuredUsernames = [
    user?.username,
    user?.callsign,
    user?.preferred_username,
    user?.vamsys_username,
    user?.vamsysUsername,
    user?.vamsysPilotUsername,
  ]
    .map((value) => normalizeConfiguredAdminValue(value))
    .filter(Boolean);

  if (configuredUsernames.some((value) => ADMIN_VAMSYS_USERNAMES.includes(value))) {
    return true;
  }

  const honoraryRankId = Number(
    user?.honorary_rank_id || user?.honoraryRankId || user?.honorary_rank?.id || 0
  ) || 0;

  if (honoraryRankId > 0 && ADMIN_VAMSYS_HONORARY_RANK_IDS.includes(honoraryRankId)) {
    return true;
  }

  const honoraryRankLabels = [
    user?.honorary_rank?.name,
    user?.honorary_rank?.title,
    user?.honorary_rank?.label,
    user?.honorary_rank?.slug,
    user?.honorary_rank?.code,
    user?.honorary_rank_name,
    user?.honoraryRankName,
    user?.honorary_rank_label,
    user?.honoraryRankLabel,
  ].filter(Boolean);

  return honoraryRankLabels.some((value) => hasStaffLikeHonoraryRankName(value));
};

const isVamsysAdmin = (vamsysUser = {}) => {
  return hasConfiguredVamsysAdminAccess(vamsysUser);
};

const getAdminRole = (discordId) => {
  if (!discordId) {
    return "none";
  }
  if (PRESEEDED_STAFF_DISCORD_IDS.includes(discordId)) {
    return "staff";
  }
  if (ADMIN_DISCORD_IDS.includes(discordId)) {
    return "admin";
  }
  const entry = adminUsersCache.get(discordId);
  return entry?.role || "none";
};

const isDiscordSessionAdmin = (session = null) => {
  const discordId = String(session?.user?.id || "").trim();
  return Boolean(session && (isDiscordAdmin(discordId) || session?.user?.isStaff));
};

const getDiscordSessionRole = (session = null) => {
  if (!session) {
    return "none";
  }

  const discordId = String(session?.user?.id || "").trim();
  const configuredRole = getAdminRole(discordId);
  if (configuredRole !== "none") {
    return configuredRole;
  }

  return session?.user?.isStaff ? "staff" : "member";
};

const loadAuthStore = () => {
  logger.info('[auth] load_start', { AUTH_STORE_FILE });
  try {
    if (!fs.existsSync(AUTH_STORE_FILE)) {
      ensureAuthStoreDir();
      fs.writeFileSync(AUTH_STORE_FILE, `${JSON.stringify(authStoreTemplate, null, 2)}\n`, "utf8");
      logger.info('[auth] load_created_template', { AUTH_STORE_FILE });
      return;
    }

    const raw = fs.readFileSync(AUTH_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);

    const discordOauthStates =
      parsed?.discordOauthStates && typeof parsed.discordOauthStates === "object"
        ? parsed.discordOauthStates
        : {};
    for (const [state, expiresAt] of Object.entries(discordOauthStates)) {
      discordOauthStateCache.set(state, Number(expiresAt) || 0);
    }

    const discordSessions =
      parsed?.discordSessions && typeof parsed.discordSessions === "object"
        ? parsed.discordSessions
        : {};
    for (const [sessionId, session] of Object.entries(discordSessions)) {
      discordSessionCache.set(sessionId, session);
    }

    const vamsysOauthStates =
      parsed?.vamsysOauthStates && typeof parsed.vamsysOauthStates === "object"
        ? parsed.vamsysOauthStates
        : {};
    for (const [state, expiresAt] of Object.entries(vamsysOauthStates)) {
      vamsysOauthStateCache.set(state, Number(expiresAt) || 0);
    }

    const vamsysSessions =
      parsed?.vamsysSessions && typeof parsed.vamsysSessions === "object"
        ? parsed.vamsysSessions
        : {};
    for (const [sessionId, session] of Object.entries(vamsysSessions)) {
      vamsysSessionCache.set(sessionId, session);
    }

    const pilotApiOauthStates =
      parsed?.pilotApiOauthStates && typeof parsed.pilotApiOauthStates === "object"
        ? parsed.pilotApiOauthStates
        : {};
    for (const [state, details] of Object.entries(pilotApiOauthStates)) {
      if (details && typeof details === "object") {
        pilotApiOauthStateCache.set(state, details);
      }
    }

    // Try to load persisted pilots roster if present
    try {
      if (fs.existsSync(PILOTS_ROSTER_FILE)) {
        const rosterRaw = fs.readFileSync(PILOTS_ROSTER_FILE, "utf8");
        const rosterParsed = JSON.parse(rosterRaw);
        if (rosterParsed && typeof rosterParsed === "object") {
          pilotsRosterCache = {
            data: rosterParsed,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000, // keep for 24h by default
          };
          logger.info('[pilots] load_from_disk', { PILOTS_ROSTER_FILE });
        }
      }
    } catch (roErr) {
      logger.warn('[pilots] load_failed', String(roErr));
    }

    const discordLinks =
      parsed?.discordLinks && typeof parsed.discordLinks === "object"
        ? parsed.discordLinks
        : {};
    for (const [id, link] of Object.entries(discordLinks)) {
      discordLinksCache.set(id, link);
    }

    const vamsysLinks =
      parsed?.vamsysLinks && typeof parsed.vamsysLinks === "object"
        ? parsed.vamsysLinks
        : {};
    for (const [id, link] of Object.entries(vamsysLinks)) {
      vamsysLinksCache.set(id, link);
    }

    const adminUsers =
      parsed?.adminUsers && typeof parsed.adminUsers === "object"
        ? parsed.adminUsers
        : {};
    for (const [id, adminUser] of Object.entries(adminUsers)) {
      adminUsersCache.set(id, adminUser);
    }

    const pilotPreferences =
      parsed?.pilotPreferences && typeof parsed.pilotPreferences === "object"
        ? parsed.pilotPreferences
        : {};
    for (const [id, preferences] of Object.entries(pilotPreferences)) {
      pilotPreferencesCache.set(id, preferences);
    }

    const pilotNotamReads =
      parsed?.pilotNotamReads && typeof parsed.pilotNotamReads === "object"
        ? parsed.pilotNotamReads
        : {};
    for (const [id, reads] of Object.entries(pilotNotamReads)) {
      pilotNotamReadsCache.set(id, reads);
    }

    const curatedPilots =
      parsed?.curatedPilots && typeof parsed.curatedPilots === "object"
        ? parsed.curatedPilots
        : {};
    for (const [id, details] of Object.entries(curatedPilots)) {
      curatedPilotsCache.set(id, details);
    }

    const pilotBadgeAwards =
      parsed?.pilotBadgeAwards && typeof parsed.pilotBadgeAwards === "object"
        ? parsed.pilotBadgeAwards
        : {};
    for (const [id, awards] of Object.entries(pilotBadgeAwards)) {
      pilotBadgeAwardsCache.set(id, Array.isArray(awards) ? awards : []);
    }

    const toursCatalog =
      parsed?.toursCatalog && typeof parsed.toursCatalog === "object"
        ? parsed.toursCatalog
        : {};
    for (const [id, tour] of Object.entries(toursCatalog)) {
      toursCatalogCache.set(id, tour);
    }
    logger.info('[auth] load_success', { vamsysSessions: vamsysSessionCache.size, discordSessions: discordSessionCache.size, vamsysLinks: vamsysLinksCache.size });
  } catch {
    ensureAuthStoreDir();
    fs.writeFileSync(AUTH_STORE_FILE, `${JSON.stringify(authStoreTemplate, null, 2)}\n`, "utf8");
    logger.warn('[auth] load_failed_reset', { AUTH_STORE_FILE });
  }
};

loadAuthStore();
loadTelemetrySnapshotFromDisk();

if (toursCatalogCache.size === 0) {
  DEFAULT_TOURS_CATALOG.forEach((tour) => {
    const tourId = String(tour?.id || "").trim();
    if (!tourId) {
      return;
    }
    toursCatalogCache.set(tourId, {
      ...tour,
      id: tourId,
      isLocal: true,
      updatedAt: new Date().toISOString(),
    });
  });
  persistAuthStore();
}

for (const discordId of PRESEEDED_STAFF_DISCORD_IDS) {
  const existing = adminUsersCache.get(discordId);
  if (!existing) {
    adminUsersCache.set(discordId, {
      provider: "discord",
      id: discordId,
      role: "staff",
      username: "",
      email: "",
      linkedBy: "preseed",
      linkedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { source: "hardcoded" },
    });
  }
}
persistAuthStore();

// Helper: compute simple diff between two rosters (prev and curr) and log summary
const diffRosters = (prev = { pilots: [] }, curr = { pilots: [] }) => {
  try {
    const prevById = new Map();
    for (const p of prev.pilots || []) {
      if (p && p.id != null) prevById.set(String(p.id), p);
    }

    const currById = new Map();
    for (const p of curr.pilots || []) {
      if (p && p.id != null) currById.set(String(p.id), p);
    }

    const added = [];
    const removed = [];
    const changed = [];

    for (const [id, p] of currById.entries()) {
      if (!prevById.has(id)) {
        added.push(p);
        continue;
      }
      const prevP = prevById.get(id);
      // simple change detection on key fields
      if (
        String(prevP.username || "") !== String(p.username || "") ||
        String(prevP.name || "") !== String(p.name || "") ||
        Number(prevP.hours || 0) !== Number(p.hours || 0) ||
        Number(prevP.flights || 0) !== Number(p.flights || 0) ||
        String(prevP.status || "") !== String(p.status || "")
      ) {
        changed.push({ before: prevP, after: p });
      }
    }

    for (const [id, p] of prevById.entries()) {
      if (!currById.has(id)) {
        removed.push(p);
      }
    }

    logger.info('[pilots] diff', { added: added.length, removed: removed.length, changed: changed.length });
    if (added.length) logger.info('[pilots] added_sample', added.slice(0, 5).map((p) => ({ id: p.id, username: p.username })));
    if (removed.length) logger.info('[pilots] removed_sample', removed.slice(0, 5).map((p) => ({ id: p.id, username: p.username })));
    if (changed.length) logger.info('[pilots] changed_sample', changed.slice(0, 5).map((c) => ({ id: c.after.id, username: c.after.username })));
  } catch (e) {
    logger.warn('[pilots] diff_failed', String(e));
  }
};

// Force-refresh the pilots roster, persist to disk and log diffs vs previous file.
const refreshPilotsRoster = async (opts = { force: true }) => {
  try {
    let prev = null;
    try {
      if (fs.existsSync(PILOTS_ROSTER_FILE)) {
        const raw = fs.readFileSync(PILOTS_ROSTER_FILE, 'utf8');
        prev = JSON.parse(raw);
      }
    } catch (e) {
      logger.warn('[pilots] prev_load_failed', String(e));
    }

    const result = await loadPilotsRoster({ force: Boolean(opts.force) });

    try {
      const curr = result || pilotsRosterCache.data || { pilots: [] };
      diffRosters(prev || { pilots: [] }, curr);
    } catch (e) {
      logger.warn('[pilots] post_diff_failed', String(e));
    }
    return result;
  } catch (err) {
    logger.warn('[pilots] refresh_failed', String(err));
    return null;
  }
};

// Kick off an initial refresh at startup (non-blocking) and schedule periodic refreshes every 5 minutes
setTimeout(() => {
  refreshPilotsRoster({ force: true }).catch(() => {});
  setInterval(() => refreshPilotsRoster({ force: true }).catch(() => {}), 5 * 60 * 1000);
}, 2000);

setInterval(() => {
  persistTelemetrySnapshotToDisk();
}, TELEMETRY_DISK_FLUSH_MS);

const flushTelemetryOnExit = () => {
  try {
    persistTelemetrySnapshotToDisk();
  } catch {
    // no-op
  }
};

process.on("SIGINT", () => {
  flushTelemetryOnExit();
  process.exit(0);
});

process.on("SIGTERM", () => {
  flushTelemetryOnExit();
  process.exit(0);
});

// Apply manual vAMSYS mappings from environment (optional)
// VAMSYS_MANUAL_MAPPINGS should be a JSON string mapping pilot id -> { id, username, name, email }
// Example: '{"20393": {"id": 20393, "username": "NWS", "name":"NWS Pilot", "email":""}}'
const applyManualVamsysMappings = () => {
  const raw = process.env.VAMSYS_MANUAL_MAPPINGS || "";
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const [idKey, link] of Object.entries(parsed)) {
        if (!link || typeof link !== "object") continue;
        const id = String(link.id || idKey || "");
        if (!id) continue;
        const entry = {
          provider: "vamsys",
          id: id,
          username: link.username || link.user || "",
          name: link.name || "",
          email: link.email || "",
          linkedBy: "manual:env",
          linkedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { source: "VAMSYS_MANUAL_MAPPINGS" },
        };
        vamsysLinksCache.set(String(id), entry);
        console.log("[vamsys] manual_mapping_applied", { id: String(id), username: entry.username });
      }
      persistAuthStore();
    }
  } catch (err) {
    console.error("[vamsys] manual_mapping_parse_failed", String(err), truncateForLog(raw, 1000));
  }
};

applyManualVamsysMappings();

const app = express();
app.use(express.json());

const VAMSYS_LOG_PREFIX = "[vamsys]";

const sanitizeLogValue = (value) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
};

const truncateForLog = (value, maxLength = 400) => {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
};

const isWrappedOperationsActionResponse = (path, method, payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const normalizedMethod = String(method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) {
    return false;
  }

  if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
    return false;
  }

  return [
    /^\/registrations\/[^/]+\/(approve|reject)$/,
    /^\/transfers\/[^/]+\/(approve|reject)$/,
    /^\/ranks\/reorder$/,
    /^\/ranks\/[^/]+\/pilots\/[^/]+$/,
    /^\/hubs\/[^/]+\/pilots\/[^/]+$/,
  ].some((pattern) => pattern.test(path));
};

const normalizeAdminActivitySection = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "events") return "events";
  if (normalized === "focus-airports") return "focus-airports";
  if (normalized === "rosters" || normalized === "curated-rosters") return "rosters";
  if (normalized === "community-goals") return "community-goals";
  if (normalized === "community-challenges") return "community-challenges";
  return "";
};

const resolveAdminActivitySectionPath = (section = "") => {
  const normalized = normalizeAdminActivitySection(section);
  if (!normalized) {
    return "";
  }
  return `/activities/${normalized}`;
};

const normalizeOperationsActionResponse = (path, method, payload) => {
  if (!isWrappedOperationsActionResponse(path, method, payload)) {
    return payload;
  }

  return {
    ...payload,
    ...payload.data,
  };
};

// Normalize JSON:API nodes into flat objects so callers can read `.name`, `.hours`, etc.
const flattenJsonApiNode = (node) => {
  if (!node || typeof node !== "object") {
    return {};
  }

  const attributes = node?.attributes && typeof node.attributes === "object" ? node.attributes : {};
  const relationships = node?.relationships && typeof node.relationships === "object" ? node.relationships : {};

  const flatRelationships = {};
  for (const [key, value] of Object.entries(relationships)) {
    const relData = value && typeof value === "object" ? value?.data : null;
    if (!relData) {
      continue;
    }
    if (Array.isArray(relData)) {
      flatRelationships[key] = relData.map((item) =>
        item && typeof item === "object"
          ? {
              id: item.id,
              type: item.type,
              ...(item.attributes && typeof item.attributes === "object" ? item.attributes : {}),
            }
          : item
      );
    } else if (relData && typeof relData === "object") {
      flatRelationships[key] = {
        id: relData.id,
        type: relData.type,
        ...(relData.attributes && typeof relData.attributes === "object" ? relData.attributes : {}),
      };
    }
  }

  return {
    ...(node && typeof node === "object" ? node : {}),
    ...(attributes && typeof attributes === "object" ? attributes : {}),
    ...(flatRelationships && typeof flatRelationships === "object" ? flatRelationships : {}),
    id: node?.id || attributes?.id,
  };
};

const logVamsys = (level, event, details = {}) => {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };
  const logger =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  logger(VAMSYS_LOG_PREFIX, JSON.stringify(payload, (_key, value) => sanitizeLogValue(value)));
};

const requestContext = (req) => ({
  method: req.method,
  path: req.originalUrl || req.url,
  ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
  userAgent: req.headers["user-agent"] || "",
});

const decodeJwtPayload = (token) => {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) {
      return null;
    }
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const parseCookieHeader = (cookieHeader = "") => {
  const cookies = {};
  cookieHeader.split(";").forEach((part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) {
      return;
    }
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  });
  return cookies;
};

const buildCookie = (name, value, maxAgeSeconds) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
};

const clearCookie = (name) => {
  const parts = [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
};

const cleanupDiscordCaches = () => {
  const now = Date.now();
  let hasChanges = false;
  for (const [state, expiresAt] of discordOauthStateCache.entries()) {
    if (now >= expiresAt) {
      discordOauthStateCache.delete(state);
      discordOauthRedirectCache.delete(state);
      hasChanges = true;
    }
  }
  for (const [sessionId, session] of discordSessionCache.entries()) {
    if (!session || now >= session.expiresAt) {
      discordSessionCache.delete(sessionId);
      hasChanges = true;
    }
  }
  for (const [state, expiresAt] of vamsysOauthStateCache.entries()) {
    if (now >= expiresAt) {
      vamsysOauthStateCache.delete(state);
      hasChanges = true;
    }
  }
  for (const [state, details] of pilotApiOauthStateCache.entries()) {
    const expiresAt = Number(details?.expiresAt || 0) || 0;
    if (!expiresAt || now >= expiresAt) {
      pilotApiOauthStateCache.delete(state);
      hasChanges = true;
    }
  }
  for (const [sessionId, session] of vamsysSessionCache.entries()) {
    if (!session || now >= session.expiresAt) {
      vamsysSessionCache.delete(sessionId);
      hasChanges = true;
    }
  }
  if (hasChanges) {
    persistAuthStore();
  }
};

const isDiscordOAuthConfigured = () =>
  Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET && DISCORD_OAUTH_REDIRECT_URI);

const isVamsysOAuthConfigured = () =>
  Boolean(VAMSYS_OAUTH_CLIENT_ID && VAMSYS_OAUTH_CLIENT_SECRET && VAMSYS_OAUTH_REDIRECT_URI);

const isPilotApiConfigured = () => Boolean(PILOT_API_CLIENT_ID && PILOT_API_REDIRECT_URI);

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const createPkceVerifier = () => toBase64Url(randomBytes(64));

const createPkceChallenge = (verifier) =>
  toBase64Url(createHash("sha256").update(String(verifier || "")).digest());

const unwrapPilotApiPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload?.data && typeof payload.data === "object") {
    return payload.data;
  }

  if (payload?.profile && typeof payload.profile === "object") {
    return payload.profile;
  }

  return payload;
};

const extractPilotApiProfile = (payload) => {
  const profile = unwrapPilotApiPayload(payload);
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const firstName = String(profile?.first_name || profile?.firstName || "").trim();
  const lastName = String(profile?.last_name || profile?.lastName || "").trim();
  const composedName = `${firstName} ${lastName}`.trim();

  return {
    id: String(profile?.id || profile?.pilot_id || profile?.user_id || profile?.sub || "").trim(),
    username: String(
      profile?.username || profile?.callsign || profile?.pilot_number || profile?.pilotNumber || ""
    ).trim(),
    name: String(profile?.name || composedName || profile?.display_name || profile?.displayName || "").trim(),
    email: String(profile?.email || "").trim(),
    avatar: String(profile?.avatar || profile?.avatar_url || profile?.avatarUrl || "").trim(),
    location: String(profile?.location || profile?.country || "").trim(),
    rank: String(profile?.rank || profile?.rank_name || profile?.rankName || "").trim(),
    raw: profile,
  };
};

const sanitizePilotApiProfile = (profile = {}) => {
  const extracted = extractPilotApiProfile(profile) || {};
  return {
    id: String(extracted?.id || "").trim(),
    username: String(extracted?.username || "").trim(),
    name: String(extracted?.name || "").trim(),
    email: String(extracted?.email || "").trim(),
    avatar: String(extracted?.avatar || "").trim(),
    location: String(extracted?.location || "").trim(),
    rank: String(extracted?.rank || "").trim(),
  };
};

const createWebsiteSessionFromPilotApiProfile = async (profile = {}) => {
  const extractedProfile = extractPilotApiProfile(profile) || {};
  const seedUser = {
    id: String(extractedProfile?.id || "").trim(),
    username: String(extractedProfile?.username || "NWS").trim(),
    name: String(extractedProfile?.name || extractedProfile?.username || "Pilot").trim(),
    email: String(extractedProfile?.email || "").trim(),
    rank: String(extractedProfile?.rank || "Member").trim() || "Member",
    hours: 0,
    flights: 0,
    joinedAt: "",
    avatar: String(extractedProfile?.avatar || "").trim(),
  };

  const pilotId = Number(seedUser.id || 0) || 0;
  if (pilotId <= 0) {
    throw new Error("pilot_api_profile_missing_id");
  }

  const enriched = await enrichVamsysSessionUser({
    baseUser: seedUser,
    forceRosterRefresh: true,
  });

  const sessionId = randomUUID();
  vamsysSessionCache.set(sessionId, {
    user: enriched.user,
    accessToken: "",
    enrichedAt: Date.now(),
    expiresAt: Date.now() + VAMSYS_SESSION_TTL_MS,
  });

  updateAuthStoreLinks({
    vamsysLink: {
      provider: "vamsys",
      id: String(enriched.user?.id || pilotId),
      username: String(enriched.user?.username || seedUser.username || "").trim(),
      name: String(enriched.user?.name || seedUser.name || "").trim(),
      email: String(enriched.user?.email || seedUser.email || "").trim(),
      role: isVamsysAdmin(enriched.user || {}) ? "admin" : "member",
      linkedBy: "oauth:pilot-api",
      linkedAt: new Date().toISOString(),
      metadata: {
        source: "oauth:pilot-api",
        isAdmin: isVamsysAdmin(enriched.user || {}),
      },
    },
  });

  return {
    sessionId,
    user: enriched.user,
    pilotId: Number(enriched.user?.id || pilotId) || pilotId,
  };
};

const getStoredPilotApiConnectionByPilotId = (pilotId) => {
  const normalizedPilotId = Number(pilotId || 0) || 0;
  if (normalizedPilotId <= 0) {
    return null;
  }

  const link = findStoredVamsysLink({ id: String(normalizedPilotId) });
  const connection = link?.metadata?.pilotApi;
  if (!connection || typeof connection !== "object") {
    return null;
  }

  return {
    ...connection,
    pilotId: Number(connection?.pilotId || normalizedPilotId) || normalizedPilotId,
  };
};

const storePilotApiConnection = ({ pilotId, sessionUser = {}, connection }) => {
  const normalizedPilotId = Number(pilotId || sessionUser?.id || 0) || 0;
  if (normalizedPilotId <= 0 || !connection || typeof connection !== "object") {
    return;
  }

  updateAuthStoreLinks({
    vamsysLink: {
      id: String(normalizedPilotId),
      username: String(sessionUser?.username || connection?.profile?.username || "").trim(),
      name: String(sessionUser?.name || connection?.profile?.name || "").trim(),
      email: String(sessionUser?.email || connection?.profile?.email || "").trim(),
      metadata: {
        pilotApi: {
          pilotId: normalizedPilotId,
          accessToken: String(connection?.accessToken || "").trim(),
          refreshToken: String(connection?.refreshToken || "").trim(),
          expiresAt: Number(connection?.expiresAt || 0) || 0,
          scope: String(connection?.scope || "").trim(),
          connectedAt: String(connection?.connectedAt || new Date().toISOString()),
          updatedAt: new Date().toISOString(),
          profileSyncedAt: Number(connection?.profileSyncedAt || 0) || 0,
          profile: connection?.profile ? sanitizePilotApiProfile(connection.profile) : null,
        },
      },
    },
  });
};

const clearPilotApiConnection = ({ pilotId, sessionUser = {} }) => {
  const normalizedPilotId = Number(pilotId || sessionUser?.id || 0) || 0;
  if (normalizedPilotId <= 0) {
    return;
  }

  updateAuthStoreLinks({
    vamsysLink: {
      id: String(normalizedPilotId),
      username: String(sessionUser?.username || "").trim(),
      name: String(sessionUser?.name || "").trim(),
      email: String(sessionUser?.email || "").trim(),
      metadata: {
        pilotApi: null,
      },
    },
  });
};

const exchangePilotApiToken = async (body) => {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const responseText = await response.text().catch(() => "");
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const errorCode = String(payload?.error || "").trim();
    throw new Error(
      `pilot_api_token_exchange_failed:${response.status}:${errorCode || truncateForLog(responseText, 300)}`
    );
  }

  return payload;
};

const fetchPilotApiProfile = async (accessToken) => {
  const response = await fetch(`${PILOT_API_BASE}/profile`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const responseText = await response.text().catch(() => "");
  let payload = {};
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(`pilot_api_profile_failed:${response.status}:${truncateForLog(responseText, 300)}`);
  }

  const profile = extractPilotApiProfile(payload);
  if (!profile) {
    throw new Error("pilot_api_profile_missing");
  }

  return profile;
};

const refreshPilotApiConnection = async ({ pilotId, sessionUser = {}, connection }) => {
  const refreshToken = String(connection?.refreshToken || "").trim();
  if (!refreshToken) {
    return null;
  }

  const payload = await exchangePilotApiToken(
    new URLSearchParams({
      client_id: PILOT_API_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );

  const nextConnection = {
    ...connection,
    accessToken: String(payload?.access_token || "").trim(),
    refreshToken: String(payload?.refresh_token || refreshToken).trim(),
    expiresAt: Date.now() + Math.max(Number(payload?.expires_in || 3600) || 3600, 60) * 1000,
    scope: String(payload?.scope || connection?.scope || "").trim(),
  };

  storePilotApiConnection({
    pilotId,
    sessionUser,
    connection: nextConnection,
  });

  return nextConnection;
};

const ensurePilotApiConnection = async ({ pilotId, sessionUser = {}, forceProfileRefresh = false } = {}) => {
  const normalizedPilotId = Number(pilotId || sessionUser?.id || 0) || 0;
  if (normalizedPilotId <= 0) {
    return null;
  }

  let connection = getStoredPilotApiConnectionByPilotId(normalizedPilotId);
  if (!connection) {
    return null;
  }

  const now = Date.now();
  const tokenExpired = !connection?.accessToken || now >= (Number(connection?.expiresAt || 0) || 0) - 60_000;
  if (tokenExpired) {
    try {
      connection = await refreshPilotApiConnection({
        pilotId: normalizedPilotId,
        sessionUser,
        connection,
      });
    } catch (error) {
      if (String(error).includes("invalid_grant")) {
        clearPilotApiConnection({ pilotId: normalizedPilotId, sessionUser });
        return null;
      }
      throw error;
    }
  }

  const shouldRefreshProfile =
    forceProfileRefresh ||
    !connection?.profile ||
    now - (Number(connection?.profileSyncedAt || 0) || 0) >= PILOT_API_PROFILE_REFRESH_MS;

  if (!shouldRefreshProfile) {
    return connection;
  }

  try {
    const profile = await fetchPilotApiProfile(connection.accessToken);
    connection = {
      ...connection,
      profile,
      profileSyncedAt: Date.now(),
    };
  } catch (error) {
    if (String(error).includes("pilot_api_profile_failed:401") && connection?.refreshToken) {
      connection = await refreshPilotApiConnection({
        pilotId: normalizedPilotId,
        sessionUser,
        connection,
      });
      const profile = await fetchPilotApiProfile(connection.accessToken);
      connection = {
        ...connection,
        profile,
        profileSyncedAt: Date.now(),
      };
    } else {
      throw error;
    }
  }

  storePilotApiConnection({
    pilotId: normalizedPilotId,
    sessionUser,
    connection,
  });

  return connection;
};

const createPilotApiError = (status, code, message, details = null) => {
  const error = new Error(String(message || code || "Pilot API request failed"));
  error.status = Number(status || 500) || 500;
  error.code = String(code || "pilot_api_request_failed").trim() || "pilot_api_request_failed";
  error.details = details;
  return error;
};

const readPilotApiResponse = async (response) => {
  const responseText = await response.text().catch(() => "");
  let payload = null;

  try {
    payload = responseText ? JSON.parse(responseText) : null;
  } catch {
    payload = null;
  }

  return {
    payload,
    responseText,
  };
};

const pilotApiRequest = async ({ pilotId, sessionUser = {}, path, method = "GET", body } = {}) => {
  const normalizedPilotId = Number(pilotId || sessionUser?.id || 0) || 0;
  let connection = await ensurePilotApiConnection({
    pilotId: normalizedPilotId,
    sessionUser,
  });

  if (!connection?.accessToken) {
    throw createPilotApiError(409, "pilot_api_not_connected", "Pilot API connection required");
  }

  const execute = async (accessToken) => {
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(`${PILOT_API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await execute(connection.accessToken);
  if (response.status === 401 && connection?.refreshToken) {
    try {
      connection = await refreshPilotApiConnection({
        pilotId: normalizedPilotId,
        sessionUser,
        connection,
      });
    } catch (error) {
      if (String(error).includes("invalid_grant")) {
        clearPilotApiConnection({ pilotId: normalizedPilotId, sessionUser });
        throw createPilotApiError(409, "pilot_api_not_connected", "Pilot API connection expired");
      }
      throw error;
    }

    if (!connection?.accessToken) {
      throw createPilotApiError(409, "pilot_api_not_connected", "Pilot API connection expired");
    }

    response = await execute(connection.accessToken);
  }

  const { payload, responseText } = await readPilotApiResponse(response);
  if (!response.ok) {
    const errors = Array.isArray(payload?.errors) ? payload.errors : [];
    const firstError = errors.find((item) => item && typeof item === "object") || null;
    const code =
      String(payload?.code || payload?.error?.code || firstError?.code || payload?.error || "").trim() ||
      `pilot_api_${response.status}`;
    const message =
      String(
        payload?.message ||
          payload?.error?.message ||
          firstError?.detail ||
          payload?.detail ||
          responseText ||
          ""
      ).trim() || `Pilot API request failed (${response.status})`;

    throw createPilotApiError(response.status, code, truncateForLog(message, 300), payload || responseText);
  }

  if (response.status === 204) {
    return null;
  }

  return payload;
};

const getPilotApiCollectionItems = (payload) => {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  return [];
};

const getPilotApiItem = (payload) => {
  if (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }

  return null;
};

const toPilotApiRelativePath = (pathValue) => {
  const normalized = String(pathValue || "").trim();
  if (!normalized) {
    return "";
  }

  try {
    const baseUrl = new URL(PILOT_API_BASE);
    const targetUrl = new URL(normalized, baseUrl);
    const relativePath = targetUrl.pathname.startsWith(baseUrl.pathname)
      ? targetUrl.pathname.slice(baseUrl.pathname.length) || "/"
      : targetUrl.pathname;

    return `${relativePath.startsWith("/") ? relativePath : `/${relativePath}`}${targetUrl.search}`;
  } catch {
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }
};

const withPilotApiPageSize = (pathValue, pageSize) => {
  const relativePath = toPilotApiRelativePath(pathValue);
  if (!relativePath) {
    return "";
  }

  const url = new URL(relativePath, PILOT_API_BASE);
  if (!url.searchParams.has("page[size]")) {
    url.searchParams.set("page[size]", String(pageSize));
  }
  return toPilotApiRelativePath(`${url.pathname}${url.search}`);
};

const resolvePilotApiNextCollectionPath = (payload, fallbackPath) => {
  const nextCursor = String(payload?.meta?.next_cursor || payload?.meta?.nextCursor || "").trim();
  if (nextCursor) {
    const url = new URL(toPilotApiRelativePath(fallbackPath), PILOT_API_BASE);
    url.searchParams.set("page[cursor]", nextCursor);
    return toPilotApiRelativePath(`${url.pathname}${url.search}`);
  }

  const nextLink = String(
    payload?.links?.next || payload?.links?.next_page_url || payload?.meta?.next_page_url || payload?.meta?.nextPageUrl || ""
  ).trim();
  return nextLink ? toPilotApiRelativePath(nextLink) : "";
};

const fetchPilotApiCollectionPages = async ({ pilotId, sessionUser = {}, path, maxPages = 12, pageSize = 500 } = {}) => {
  const items = [];
  const seenPaths = new Set();
  let nextPath = withPilotApiPageSize(path, pageSize);
  let pageCount = 0;

  while (nextPath && pageCount < maxPages && !seenPaths.has(nextPath)) {
    seenPaths.add(nextPath);
    const payload = await pilotApiRequest({
      pilotId,
      sessionUser,
      path: nextPath,
    });

    items.push(...getPilotApiCollectionItems(payload));
    nextPath = resolvePilotApiNextCollectionPath(payload, nextPath);
    pageCount += 1;
  }

  return items;
};

const extractPilotApiPirepProfile = (payload) => {
  const directItem = getPilotApiItem(payload);
  const candidates = [
    payload?.data,
    payload?.profile,
    payload?.pirep,
    directItem?.data,
    directItem?.profile,
    directItem?.pirep,
    directItem,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
};

const normalizePilotApiPirepProfileSeries = (series) => {
  if (!Array.isArray(series)) {
    return [];
  }

  return series
    .map((point) => {
      const x = Number(point?.x ?? point?.time ?? point?.timestamp ?? 0);
      const y = Number(point?.y ?? point?.value ?? 0);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }
      return { x, y };
    })
    .filter(Boolean)
    .sort((left, right) => left.x - right.x);
};

const normalizePilotApiPirepProfileAnnotations = (annotations) => {
  if (!Array.isArray(annotations)) {
    return [];
  }

  return annotations
    .map((annotation, index) => {
      const x = Number(annotation?.x ?? annotation?.time ?? annotation?.timestamp ?? 0);
      if (!Number.isFinite(x)) {
        return null;
      }

      return {
        id: Number(annotation?.id || index + 1) || index + 1,
        x,
        label: String(annotation?.label || annotation?.name || "").trim() || `Event ${index + 1}`,
        category: String(annotation?.category || "flight").trim() || "flight",
        color: String(annotation?.color || "slate").trim() || "slate",
        num: Number(annotation?.num || index + 1) || index + 1,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.x - right.x);
};

const normalizePilotApiPirepProfile = (payload) => {
  const profile = extractPilotApiPirepProfile(payload);
  if (!profile || typeof profile !== "object") {
    return {
      altitude: [],
      groundspeed: [],
      annotations: [],
    };
  }

  const source =
    profile?.data && typeof profile.data === "object" && !Array.isArray(profile.data)
      ? profile.data
      : profile;

  return {
    altitude: normalizePilotApiPirepProfileSeries(source?.altitude),
    groundspeed: normalizePilotApiPirepProfileSeries(source?.groundspeed ?? source?.speed),
    annotations: normalizePilotApiPirepProfileAnnotations(source?.annotations),
  };
};

const mergePilotApiPirepSnapshot = (basePirep, profilePirep) => {
  const baseRecord = basePirep && typeof basePirep === "object" && !Array.isArray(basePirep) ? basePirep : null;
  const profileRecord = profilePirep && typeof profilePirep === "object" && !Array.isArray(profilePirep) ? profilePirep : null;

  if (!baseRecord) {
    return profileRecord;
  }

  if (!profileRecord) {
    return baseRecord;
  }

  const mergeNestedRecord = (leftValue, rightValue) => {
    const leftRecord = leftValue && typeof leftValue === "object" && !Array.isArray(leftValue) ? leftValue : null;
    const rightRecord = rightValue && typeof rightValue === "object" && !Array.isArray(rightValue) ? rightValue : null;
    if (leftRecord && rightRecord) {
      return {
        ...leftRecord,
        ...rightRecord,
      };
    }
    return rightRecord || leftRecord || undefined;
  };

  return {
    ...profileRecord,
    ...baseRecord,
    pilot: mergeNestedRecord(profileRecord.pilot, baseRecord.pilot),
    user: mergeNestedRecord(profileRecord.user, baseRecord.user),
    booking: mergeNestedRecord(profileRecord.booking, baseRecord.booking),
    aircraft: mergeNestedRecord(profileRecord.aircraft, baseRecord.aircraft),
    route: mergeNestedRecord(profileRecord.route, baseRecord.route),
  };
};

const fetchPilotApiPirepPositions = async ({ pilotId, sessionUser = {}, pirepId } = {}) => {
  const normalizedPirepId = Number(pirepId || 0) || 0;
  if (normalizedPirepId <= 0) {
    return [];
  }

  const items = await fetchPilotApiCollectionPages({
    pilotId,
    sessionUser,
    path: `/pireps/${encodeURIComponent(String(normalizedPirepId))}/positions`,
    maxPages: 20,
    pageSize: 500,
  });

  const directTrack = normalizeTelemetryTrackArray(items);
  return directTrack.length >= 2 ? directTrack : extractLongestTelemetryTrack({ data: items });
};

const fetchPilotApiPirepProfile = async ({ pilotId, sessionUser = {}, pirepId } = {}) => {
  const normalizedPirepId = Number(pirepId || 0) || 0;
  if (normalizedPirepId <= 0) {
    return {
      altitude: [],
      groundspeed: [],
      annotations: [],
    };
  }

  const payload = await pilotApiRequest({
    pilotId,
    sessionUser,
    path: `/pireps/${encodeURIComponent(String(normalizedPirepId))}/profile`,
  });

  return normalizePilotApiPirepProfile(payload);
};

const formatMinutesDuration = (minutesValue) => {
  const totalMinutes = Number(minutesValue);
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return "—";
  }

  return formatDuration(totalMinutes * 60);
};

const formatPilotStatusLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "—";
  }

  return normalized
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const inferPilotBookingStatus = (booking) => {
  if (booking?.deleted_at) {
    return "cancelled";
  }

  if ((Number(booking?.pirep_id || 0) || 0) > 0) {
    return "completed";
  }

  const departureTime = Date.parse(String(booking?.departure_time || ""));
  if (Number.isFinite(departureTime)) {
    return departureTime <= Date.now() ? "active" : "upcoming";
  }

  return String(booking?.status || "pending").trim() || "pending";
};

const loadPilotApiReferenceData = async () => {
  const [routesPayload, fleetPayload, airportsMap] = await Promise.all([
    loadRoutesData().catch(() => ({ routes: [] })),
    loadFleetData().catch(() => ({ fleets: [] })),
    loadAirportsLookup().catch(() => new Map()),
  ]);

  const routeIndex = new Map();
  const aircraftIndex = new Map();

  (Array.isArray(routesPayload?.routes) ? routesPayload.routes : []).forEach((route) => {
    const routeId = Number(route?.id || 0) || 0;
    if (routeId > 0) {
      routeIndex.set(routeId, route);
    }
  });

  (Array.isArray(fleetPayload?.fleets) ? fleetPayload.fleets : []).forEach((fleet) => {
    const fleetId = Number(fleet?.id || 0) || 0;
    (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).forEach((aircraft) => {
      const aircraftId = Number(aircraft?.id || 0) || 0;
      if (aircraftId <= 0) {
        return;
      }

      aircraftIndex.set(aircraftId, {
        ...aircraft,
        fleetId,
        fleetName: String(fleet?.name || fleet?.code || "").trim(),
        fleetCode: String(fleet?.code || "").trim(),
      });
    });
  });

  return {
    routeIndex,
    aircraftIndex,
    airportsMap,
  };
};

const resolveAirportSummary = (airportsMap, airportId) => {
  const normalizedAirportId = Number(airportId || 0) || 0;
  const fallback = {
    id: normalizedAirportId > 0 ? normalizedAirportId : null,
    code: "—",
    name: "—",
  };

  if (normalizedAirportId <= 0 || !(airportsMap instanceof Map)) {
    return fallback;
  }

  const record = airportsMap.get(normalizedAirportId);
  if (!record || typeof record !== "object") {
    return fallback;
  }

  return {
    id: Number(record?.id || normalizedAirportId) || normalizedAirportId,
    code: String(record?.code || "—").trim() || "—",
    name: String(record?.name || record?.code || "—").trim() || "—",
  };
};

const findAirportSummaryByCode = async (code) => {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const airportsMap = await loadAirportsLookup();
  for (const record of airportsMap.values()) {
    const airportCode = String(record?.code || "").trim().toUpperCase();
    if (airportCode === normalizedCode) {
      return record;
    }
  }

  return null;
};

const enrichPilotApiBooking = (booking, references) => {
  const routeId = Number(booking?.route_id || 0) || null;
  const aircraftId = Number(booking?.aircraft_id || 0) || null;
  const route = routeId ? references.routeIndex.get(routeId) || null : null;
  const aircraft = aircraftId ? references.aircraftIndex.get(aircraftId) || null : null;
  const departure = resolveAirportSummary(references.airportsMap, booking?.departure_id || route?.departureId);
  const arrival = resolveAirportSummary(references.airportsMap, booking?.arrival_id || route?.arrivalId);
  const status = inferPilotBookingStatus(booking);
  const flightNumber =
    String(booking?.flight_number || route?.flightNumber || booking?.callsign || route?.callsign || "").trim() ||
    "—";
  const callsign = String(booking?.callsign || route?.callsign || flightNumber).trim() || flightNumber;

  return {
    id: Number(booking?.id || 0) || 0,
    routeId,
    aircraftId,
    pirepId: Number(booking?.pirep_id || 0) || null,
    flightNumber,
    callsign,
    departureCode: departure.code,
    departureName: departure.name,
    arrivalCode: arrival.code,
    arrivalName: arrival.name,
    routeLabel: `${departure.code} → ${arrival.code}`,
    aircraft: aircraft
      ? `${String(aircraft?.model || "Aircraft").trim()}${aircraft?.registration ? ` · ${aircraft.registration}` : ""}`
      : "—",
    aircraftModel: String(aircraft?.model || "").trim(),
    registration: String(aircraft?.registration || "").trim(),
    fleetName: String(aircraft?.fleetName || "").trim(),
    network: String(booking?.network || "").trim(),
    altitude: String(booking?.altitude || "").trim(),
    passengers: Number.isFinite(Number(booking?.passengers)) ? Number(booking.passengers) : null,
    cargo: Number.isFinite(Number(booking?.cargo)) ? Number(booking.cargo) : null,
    userRoute: String(booking?.user_route || "").trim(),
    departureTime: String(booking?.departure_time || "").trim() || null,
    arrivalTime: String(booking?.arrival_time || "").trim() || null,
    estimatedArrivalTime: String(booking?.estimated_arrival_time || "").trim() || null,
    validTo: String(booking?.valid_to || "").trim() || null,
    createdAt: String(booking?.created_at || "").trim() || null,
    deletedAt: String(booking?.deleted_at || "").trim() || null,
    status,
    statusLabel: formatPilotStatusLabel(status),
    canCancel: !booking?.deleted_at && !(Number(booking?.pirep_id || 0) > 0),
  };
};

const loadDetailedPilotApiBookings = async ({ pilotId, sessionUser = {}, bookings = [], references } = {}) => {
  const normalizedPilotId = Number(pilotId || sessionUser?.id || 0) || 0;
  const items = Array.isArray(bookings) ? bookings : [];

  if (normalizedPilotId <= 0 || !items.length) {
    return items.map((item) => enrichPilotApiBooking(item, references));
  }

  const detailedBookings = await Promise.all(
    items.map(async (item) => {
      const bookingId = Number(item?.id || 0) || 0;
      if (bookingId <= 0) {
        return enrichPilotApiBooking(item, references);
      }

      try {
        const payload = await pilotApiRequest({
          pilotId: normalizedPilotId,
          sessionUser,
          path: `/bookings/${encodeURIComponent(String(bookingId))}`,
        });
        const detailedBooking = getPilotApiItem(payload);
        return enrichPilotApiBooking(detailedBooking || item, references);
      } catch {
        return enrichPilotApiBooking(item, references);
      }
    })
  );

  return detailedBookings;
};

const enrichPilotApiPirep = (pirep, references) => {
  const routeId = Number(pirep?.route_id || 0) || null;
  const aircraftId = Number(pirep?.aircraft_id || 0) || null;
  const route = routeId ? references.routeIndex.get(routeId) || null : null;
  const aircraft = aircraftId ? references.aircraftIndex.get(aircraftId) || null : null;
  const departure = resolveAirportSummary(references.airportsMap, pirep?.departure_id || route?.departureId);
  const arrival = resolveAirportSummary(references.airportsMap, pirep?.arrival_id || route?.arrivalId);
  const flightNumber =
    String(pirep?.flight_number || route?.flightNumber || pirep?.callsign || route?.callsign || "").trim() || "—";

  return {
    id: Number(pirep?.id || 0) || 0,
    bookingId: Number(pirep?.booking_id || 0) || null,
    routeId,
    aircraftId,
    flightNumber,
    callsign: String(pirep?.callsign || flightNumber).trim() || flightNumber,
    departure: departure.code,
    departureName: departure.name,
    arrival: arrival.code,
    arrivalName: arrival.name,
    aircraft: aircraft
      ? `${String(aircraft?.model || "Aircraft").trim()}${aircraft?.registration ? ` · ${aircraft.registration}` : ""}`
      : "—",
    duration: formatMinutesDuration(pirep?.flight_time),
    blockTime: formatMinutesDuration(pirep?.block_time),
    distance: Number.isFinite(Number(pirep?.distance)) ? `${Number(pirep.distance)} nm` : "—",
    landing: Number.isFinite(Number(pirep?.landing_rate)) ? `${Number(pirep.landing_rate)} fpm` : "—",
    landingRate: Number.isFinite(Number(pirep?.landing_rate)) ? Number(pirep.landing_rate) : null,
    network: String(pirep?.network || "").trim(),
    status: formatPilotStatusLabel(pirep?.status),
    points: Number.isFinite(Number(pirep?.points)) ? Number(pirep.points) : null,
    score: Number.isFinite(Number(pirep?.score)) ? Number(pirep.score) : null,
    completedAt: String(pirep?.arrival_time || pirep?.created_at || "").trim() || null,
    createdAt: String(pirep?.created_at || "").trim() || null,
  };
};

const inferVacCodeFromSources = (...values) => {
  const source = values
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value;
      }
      return [value];
    })
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean)
    .join(" ");

  if (source.includes("KAR")) {
    return "KAR";
  }
  if (source.includes("STW")) {
    return "STW";
  }
  return "NWS";
};

const resolveAirportTelemetrySummary = (airportsMap, airportId) => {
  const summary = resolveAirportSummary(airportsMap, airportId);
  const record = Number(airportId || 0) > 0 && airportsMap instanceof Map ? airportsMap.get(Number(airportId || 0)) : null;

  return {
    ...summary,
    latitude: Number.isFinite(Number(record?.latitude)) ? Number(record.latitude) : null,
    longitude: Number.isFinite(Number(record?.longitude)) ? Number(record.longitude) : null,
    icao: String(record?.icao || summary.code || "").trim() || null,
    iata: String(record?.iata || "").trim() || null,
    countryName: String(record?.countryName || "").trim() || null,
  };
};

const mergeTelemetryTracks = (...tracks) => {
  const merged = tracks.flatMap((track) => (Array.isArray(track) ? track : []));
  if (merged.length < 2) {
    return Array.isArray(merged) ? merged : [];
  }
  return normalizeTelemetryTrackArray(merged);
};

const buildPirepTelemetryCacheKey = ({ pirep = null, enriched = null, departure = null, arrival = null } = {}) => {
  return [
    "pirep",
    String(pirep?.id || enriched?.id || "").trim(),
    String(pirep?.booking_id || enriched?.bookingId || "").trim(),
    String(enriched?.flightNumber || pirep?.flight_number || pirep?.callsign || "").trim().toUpperCase(),
    String(departure?.code || "").trim().toUpperCase(),
    String(arrival?.code || "").trim().toUpperCase(),
    String(pirep?.created_at || pirep?.arrival_time || "").trim().toUpperCase(),
  ]
    .filter(Boolean)
    .join(":");
};

const resolvePirepFlightMapMatch = ({ flights = [], pirep = null, enriched = null } = {}) => {
  const normalizedFlightNumber = String(enriched?.flightNumber || pirep?.flight_number || pirep?.callsign || "")
    .trim()
    .toUpperCase();
  const normalizedCallsign = String(enriched?.callsign || pirep?.callsign || "")
    .trim()
    .toUpperCase();
  const normalizedDeparture = String(enriched?.departure || "").trim().toUpperCase();
  const normalizedArrival = String(enriched?.arrival || "").trim().toUpperCase();

  return (Array.isArray(flights) ? flights : []).find((flight) => {
    const flightNumber = String(flight?.flightNumber || "").trim().toUpperCase();
    const departure = String(flight?.departure || "").trim().toUpperCase();
    const arrival = String(flight?.destination || flight?.arrival || "").trim().toUpperCase();
    if (!flightNumber) {
      return false;
    }

    const callsignMatches =
      (normalizedFlightNumber && flightNumber === normalizedFlightNumber) ||
      (normalizedCallsign && flightNumber === normalizedCallsign);
    if (!callsignMatches) {
      return false;
    }

    if (normalizedDeparture && departure && normalizedDeparture !== departure) {
      return false;
    }

    if (normalizedArrival && arrival && normalizedArrival !== arrival) {
      return false;
    }

    return true;
  }) || null;
};

const deriveTelemetryProgress = ({ currentLat, currentLon, departureLat, departureLon, arrivalLat, arrivalLon, fallback = null } = {}) => {
  const fallbackNumeric = Number(fallback);
  if (Number.isFinite(fallbackNumeric)) {
    return Math.max(0, Math.min(100, fallbackNumeric));
  }

  if (
    !Number.isFinite(Number(currentLat)) ||
    !Number.isFinite(Number(currentLon)) ||
    !Number.isFinite(Number(departureLat)) ||
    !Number.isFinite(Number(departureLon)) ||
    !Number.isFinite(Number(arrivalLat)) ||
    !Number.isFinite(Number(arrivalLon))
  ) {
    return 0;
  }

  const totalDistance = Number(calculateDistanceNm(departureLat, departureLon, arrivalLat, arrivalLon));
  const completedDistance = Number(calculateDistanceNm(departureLat, departureLon, currentLat, currentLon));
  if (!Number.isFinite(totalDistance) || totalDistance <= 0 || !Number.isFinite(completedDistance)) {
    return 0;
  }

  return Math.max(0, Math.min(100, (completedDistance / totalDistance) * 100));
};

const enrichPilotApiClaim = (claim, airportsMap) => {
  const departure = resolveAirportSummary(airportsMap, claim?.departure_id);
  const arrival = resolveAirportSummary(airportsMap, claim?.arrival_id);
  const status = String(claim?.status || "pending").trim() || "pending";
  const proof = (Array.isArray(claim?.proof) ? claim.proof : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const type = String(item?.type || "link").trim().toLowerCase() || "link";
      if (type === "image") {
        return {
          type: "image",
          data: String(item?.data || "").trim() || null,
          url: String(item?.url || "").trim() || null,
        };
      }

      return {
        type: "link",
        url: String(item?.url || "").trim() || null,
      };
    });

  return {
    id: Number(claim?.id || 0) || 0,
    bookingId: Number(claim?.booking_id || 0) || null,
    pirepId: Number(claim?.pirep_id || 0) || null,
    status,
    statusLabel: formatPilotStatusLabel(status),
    needsReply: Boolean(claim?.needs_reply),
    departureId: departure.id,
    arrivalId: arrival.id,
    departureCode: departure.code,
    departureName: departure.name,
    arrivalCode: arrival.code,
    arrivalName: arrival.name,
    routeLabel: `${departure.code} → ${arrival.code}`,
    departureTime: String(claim?.departure_time || "").trim() || null,
    arrivalTime: String(claim?.arrival_time || "").trim() || null,
    message: String(claim?.message || "").trim(),
    proof,
    proofCount: proof.length,
    createdAt: String(claim?.created_at || "").trim() || null,
  };
};

const summarizePilotApiStatistics = (statistics) => {
  const flightTime =
    statistics?.flight_time_all_time && typeof statistics.flight_time_all_time === "object"
      ? statistics.flight_time_all_time
      : {};
  const pireps =
    statistics?.pireps_all_time && typeof statistics.pireps_all_time === "object"
      ? statistics.pireps_all_time
      : {};
  const seconds = Number(flightTime?.seconds || 0) || 0;

  return {
    totalHours: seconds > 0 ? Math.round((seconds / 3600) * 10) / 10 : 0,
    totalHoursFormatted: String(flightTime?.formatted || "0:00").trim() || "0:00",
    totalFlights: Number(pireps?.count || statistics?.pirep_count || 0) || 0,
    lastPirepDate: String(statistics?.last_pirep_date || "").trim() || null,
    uniqueArrivalAirports: Number(statistics?.unique_arrival_airports || 0) || 0,
    generatedAt: String(statistics?.generated_at || "").trim() || null,
  };
};

const resolvePilotApiRankNames = async ({ pilotId, sessionUser = {} } = {}) => {
  const normalizedPilotId = Number(pilotId || sessionUser?.id || 0) || 0;
  if (normalizedPilotId <= 0) {
    return {
      displayRankName: String(sessionUser?.rank || "Member").trim() || "Member",
      regularRankName: String(sessionUser?.rank || "Member").trim() || "Member",
      honoraryRankName: "",
      nextRankName: "",
      progressPercent: 0,
      progressHoursRemaining: null,
      progressPirepsRemaining: null,
      progressPointsRemaining: null,
      progressBonusRemaining: null,
    };
  }

  const [rankPayload, profilePayload] = await Promise.all([
    pilotApiRequest({
      pilotId: normalizedPilotId,
      sessionUser,
      path: "/rank",
    }).catch(() => null),
    pilotApiRequest({
      pilotId: normalizedPilotId,
      sessionUser,
      path: "/profile",
    }).catch(() => null),
  ]);

  const rankData = rankPayload ? getPilotApiItem(rankPayload) || {} : {};
  const profileData = profilePayload ? getPilotApiItem(profilePayload) || {} : {};

  const displayRankName = String(rankData?.name || "").trim();
  let regularRankName =
    String(profileData?.rank?.name || profileData?.rank_name || profileData?.rankName || "").trim() ||
    String(sessionUser?.rank || "").trim();
  let honoraryRankName =
    String(
      profileData?.honorary_rank?.name ||
        profileData?.honorary_rank_name ||
        profileData?.honoraryRankName ||
        sessionUser?.honorary_rank?.name ||
        ""
    ).trim();

  const isHonoraryDisplayRank = Boolean(rankData?.honorary_rank);
  if (isHonoraryDisplayRank && displayRankName && !honoraryRankName) {
    honoraryRankName = displayRankName;
  }

  if (!regularRankName && displayRankName && !isHonoraryDisplayRank) {
    regularRankName = displayRankName;
  }

  if (!regularRankName) {
    regularRankName = "Member";
  }

  const nextRank = rankData?.next_rank && typeof rankData.next_rank === "object" ? rankData.next_rank : {};
  const nextRankName =
    String(nextRank?.name || rankData?.next_rank_name || rankData?.nextRankName || "").trim() || "";

  const progressCandidates = [
    Number(nextRank?.hours_progress_pct),
    Number(nextRank?.pireps_progress_pct),
    Number(nextRank?.points_progress_pct),
    Number(nextRank?.bonus_progress_pct),
    Number(rankData?.progress_pct),
  ].filter((value) => Number.isFinite(value));
  const progressPercentRaw = progressCandidates.length > 0 ? Math.max(...progressCandidates) : 0;
  const progressPercent = Math.max(0, Math.min(100, Math.round(progressPercentRaw)));

  const normalizeRemainingMetric = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return Math.max(0, Math.round(numeric));
  };

  return {
    displayRankName: displayRankName || regularRankName,
    regularRankName,
    honoraryRankName,
    nextRankName,
    progressPercent,
    progressHoursRemaining: normalizeRemainingMetric(nextRank?.hours_remaining),
    progressPirepsRemaining: normalizeRemainingMetric(nextRank?.pireps_remaining),
    progressPointsRemaining: normalizeRemainingMetric(nextRank?.points_remaining),
    progressBonusRemaining: normalizeRemainingMetric(nextRank?.bonus_remaining),
  };
};

const loadPilotApiDashboardData = async ({ pilotId, sessionUser = {}, limit = 5 } = {}) => {
  const normalizedPilotId = Number(pilotId || sessionUser?.id || 0) || 0;
  if (normalizedPilotId <= 0) {
    return null;
  }

  const pageSize = Math.max(10, Math.min(25, Number(limit || 5) * 3));
  const [statisticsPayload, bookingsPayload, references, rankInfo] = await Promise.all([
    pilotApiRequest({
      pilotId: normalizedPilotId,
      sessionUser,
      path: "/statistics",
    }),
    pilotApiRequest({
      pilotId: normalizedPilotId,
      sessionUser,
      path: `/bookings?page[size]=${pageSize}&sort=departure_time`,
    }),
    loadPilotApiReferenceData(),
    resolvePilotApiRankNames({ pilotId: normalizedPilotId, sessionUser }).catch(() => ({
      displayRankName: String(sessionUser?.rank || "Member").trim() || "Member",
      regularRankName: String(sessionUser?.rank || "Member").trim() || "Member",
      honoraryRankName: "",
      nextRankName: "",
      progressPercent: 0,
      progressHoursRemaining: null,
      progressPirepsRemaining: null,
      progressPointsRemaining: null,
      progressBonusRemaining: null,
    })),
  ]);

  const statistics = getPilotApiItem(statisticsPayload) || {};
  const detailedBookings = await loadDetailedPilotApiBookings({
    pilotId: normalizedPilotId,
    sessionUser,
    bookings: getPilotApiCollectionItems(bookingsPayload),
    references,
  });
  const bookings = detailedBookings
    .filter((item) => item.status !== "cancelled")
    .filter((item) => !item.deletedAt)
    .sort((left, right) => {
      const leftTime = left.departureTime ? Date.parse(left.departureTime) : Number.MAX_SAFE_INTEGER;
      const rightTime = right.departureTime ? Date.parse(right.departureTime) : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    })
    .slice(0, Math.max(1, Math.min(10, Number(limit || 5))));

  return {
    statistics: summarizePilotApiStatistics(statistics),
    upcomingFlights: bookings,
    rank: rankInfo,
  };
};

const resolveRedirectUrl = (value, fallback) => {
  try {
    if (!value) {
      return fallback;
    }
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value;
    }
    return value.startsWith("/") ? value : `/${value}`;
  } catch {
    return fallback;
  }
};

const resolveInternalRedirectPath = (value, fallback = "") => {
  try {
    if (!value) {
      return fallback;
    }
    const candidate = String(value || "").trim();
    if (
      !candidate ||
      candidate.startsWith("http://") ||
      candidate.startsWith("https://") ||
      candidate.startsWith("//")
    ) {
      return fallback;
    }
    return candidate.startsWith("/") ? candidate : `/${candidate}`;
  } catch {
    return fallback;
  }
};

const appendQueryParam = (target, key, value) => {
  if (!target) {
    return "";
  }
  if (target.startsWith("http://") || target.startsWith("https://")) {
    const url = new URL(target);
    url.searchParams.set(key, value);
    return url.toString();
  }
  const separator = target.includes("?") ? "&" : "?";
  return `${target}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

const buildFailureRedirect = (reason) => {
  const base = resolveRedirectUrl(DISCORD_OAUTH_FAILURE_URL, "/login?discord=error");
  if (!reason) {
    return base;
  }
  return appendQueryParam(base, "reason", reason);
};

const toComparable = (value) => String(value || "").trim().toLowerCase();

const isPlaceholderPilotName = (value) => {
  const name = String(value || "").trim();
  if (!name) {
    return true;
  }

  const normalized = name.toLowerCase();
  // Only treat the generic "NWS Member" label as a placeholder.
  if (normalized === "nws member") {
    return true;
  }

  return false;
};

const isPlaceholderPilotUsername = (value) => {
  const username = String(value || "").trim().toUpperCase();
  if (!username) {
    return true;
  }
  return username === "NWS" || username === "VAMSYS";
};

const findStoredVamsysLink = (candidate = {}) => {
  const candidateId = String(candidate?.id || "").trim();
  const candidateUsername = normalizeMatchValue(candidate?.username);
  const candidateEmail = normalizeMatchValue(candidate?.email);

  if (candidateId) {
    const exact = vamsysLinksCache.get(candidateId);
    if (exact) {
      return exact;
    }
  }

  const links = Array.from(vamsysLinksCache.values());
  const byUsername = candidateUsername
    ? links.find((link) => normalizeMatchValue(link?.username) === candidateUsername)
    : null;
  if (byUsername) {
    return byUsername;
  }

  const byEmail = candidateEmail
    ? links.find((link) => normalizeMatchValue(link?.email) === candidateEmail)
    : null;
  if (byEmail) {
    return byEmail;
  }

  return null;
};

const readDiscordIdFromPilot = (pilot) => {
  const candidates = [
    pilot?.discord_id,
    pilot?.discordId,
    pilot?.discord_user_id,
    pilot?.discordUserId,
    pilot?.discord?.id,
    pilot?.social?.discord_id,
    pilot?.social?.discordId,
  ];
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
};

const readDiscordUsernameFromPilot = (pilot) => {
  const candidates = [
    pilot?.discord_username,
    pilot?.discordUsername,
    pilot?.discord_name,
    pilot?.discordName,
    pilot?.discord?.username,
    pilot?.social?.discord_username,
    pilot?.social?.discordUsername,
  ];
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
};

const extractRoleNames = (pilot) => {
  const names = new Set();
  const collect = (input) => {
    if (!Array.isArray(input)) {
      return;
    }
    input.forEach((item) => {
      if (typeof item === "string") {
        names.add(toComparable(item));
      } else if (item && typeof item === "object") {
        names.add(toComparable(item.name));
        names.add(toComparable(item.slug));
        names.add(toComparable(item.code));
      }
    });
  };

  collect(pilot?.roles);
  collect(pilot?.staff_roles);
  collect(pilot?.groups);

  return Array.from(names).filter(Boolean);
};

const isPilotStaff = (pilot) => {
  return hasConfiguredVamsysAdminAccess(pilot);
};

const resolveVamsysDiscordMatch = (pilot, discordUser) => {
  const discordId = String(discordUser?.id || "").trim();
  const discordUsername = toComparable(discordUser?.username);

  const pilotDiscordId = String(readDiscordIdFromPilot(pilot) || "").trim();
  const pilotDiscordUsername = toComparable(readDiscordUsernameFromPilot(pilot));

  const byDiscordId = Boolean(discordId && pilotDiscordId && discordId === pilotDiscordId);
  const byDiscordUsername = Boolean(
    discordUsername && pilotDiscordUsername && discordUsername === pilotDiscordUsername
  );

  return {
    matched: byDiscordId || byDiscordUsername,
    matchType: byDiscordId
      ? "discord_id"
      : byDiscordUsername
      ? "discord_username"
      : "none",
  };
};

const loadVamsysPilotByDiscord = async (discordUser) => {
  const pilots = await fetchAllPages("/pilots?page[size]=300");
  for (const pilot of pilots) {
    const match = resolveVamsysDiscordMatch(pilot, discordUser);
    if (match.matched) {
      return {
        pilot,
        matchType: match.matchType,
        isStaff: isPilotStaff(pilot),
      };
    }
  }
  return null;
};

const DISCORD_OAUTH_INTENT_LOGIN = "login";
const DISCORD_OAUTH_INTENT_LINK = "link";

const resolveDiscordOauthIntent = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === DISCORD_OAUTH_INTENT_LINK
    ? DISCORD_OAUTH_INTENT_LINK
    : DISCORD_OAUTH_INTENT_LOGIN;
};

const findStoredVamsysLinkByDiscordId = (discordId) => {
  const normalizedDiscordId = String(discordId || "").trim();
  if (!normalizedDiscordId) {
    return null;
  }

  const links = Array.from(vamsysLinksCache.values());
  return (
    links.find((link) => String(link?.discordId || "").trim() === normalizedDiscordId) || null
  );
};

const resolveLinkedVamsysPilotForDiscordUser = async (discordUser) => {
  const discordId = String(discordUser?.id || "").trim();
  if (!discordId) {
    return null;
  }

  const storedDiscordLink = discordLinksCache.get(discordId) || null;
  const storedVamsysLink = findStoredVamsysLinkByDiscordId(discordId);
  const linkedPilotId =
    Number(storedDiscordLink?.vamsysPilotId || storedVamsysLink?.id || 0) || 0;

  if (!linkedPilotId) {
    return null;
  }

  const seedPilot = {
    id: linkedPilotId,
    username: String(storedVamsysLink?.username || "").trim(),
    name: String(storedVamsysLink?.name || "").trim(),
    email: String(storedVamsysLink?.email || "").trim(),
  };

  const pilot =
    (await loadPilotProfileById(linkedPilotId, { seedPilot }).catch(() => null)) ||
    {
      ...seedPilot,
      id: linkedPilotId,
    };

  return {
    pilot,
    matchType: "stored_link",
    isStaff: isPilotStaff(pilot),
  };
};

app.get("/api/auth/discord/login", (req, res) => {
  if (!isDiscordOAuthConfigured()) {
    res.status(500).json({
      error:
        "Missing DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET or DISCORD_OAUTH_REDIRECT_URI",
    });
    return;
  }

  cleanupDiscordCaches();

  const state = randomUUID();
  const now = Date.now();
  discordOauthStateCache.set(state, now + DISCORD_STATE_TTL_MS);
  const oauthIntent = resolveDiscordOauthIntent(req.query.intent);

  const returnTo = resolveInternalRedirectPath(String(req.query.returnTo || ""), "");
  const defaultSuccessUrl =
    oauthIntent === DISCORD_OAUTH_INTENT_LINK
      ? "/dashboard?tab=settings&discord=success"
      : "/login?discord=success";
  const defaultFailureUrl =
    oauthIntent === DISCORD_OAUTH_INTENT_LINK
      ? "/dashboard?tab=settings&discord=error"
      : "/login?discord=error";

  const successUrl = returnTo
    ? appendQueryParam(returnTo, "discord", "success")
    : oauthIntent === DISCORD_OAUTH_INTENT_LINK
    ? defaultSuccessUrl
    : resolveRedirectUrl(DISCORD_OAUTH_SUCCESS_URL, defaultSuccessUrl);
  const failureUrl = returnTo
    ? appendQueryParam(returnTo, "discord", "error")
    : oauthIntent === DISCORD_OAUTH_INTENT_LINK
    ? defaultFailureUrl
    : resolveRedirectUrl(DISCORD_OAUTH_FAILURE_URL, defaultFailureUrl);

  if (oauthIntent === DISCORD_OAUTH_INTENT_LINK) {
    const vamsysSession = getVamsysSessionFromRequest(req);
    const vamsysPilotId = Number(vamsysSession?.user?.id || 0) || 0;
    if (!vamsysSession || vamsysPilotId <= 0) {
      res.redirect(appendQueryParam(failureUrl, "reason", "link_requires_vamsys_login"));
      return;
    }
  }

  discordOauthRedirectCache.set(state, {
    successUrl,
    failureUrl,
    intent: oauthIntent,
  });

  persistAuthStore();

  const authUrl = new URL("https://discord.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", DISCORD_OAUTH_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "identify email");
  authUrl.searchParams.set("state", state);

  res.setHeader("Set-Cookie", buildCookie(DISCORD_STATE_COOKIE, state, DISCORD_STATE_TTL_MS / 1000));
  res.redirect(authUrl.toString());
});

app.get("/api/auth/discord/callback", async (req, res) => {
  let fallbackErrorUrl = buildFailureRedirect("oauth_error");

  try {
    if (!isDiscordOAuthConfigured()) {
      res.redirect(buildFailureRedirect("discord_oauth_not_configured"));
      return;
    }

    if (!requireCredentials(res)) {
      res.redirect(buildFailureRedirect("vamsys_not_configured"));
      return;
    }

    cleanupDiscordCaches();

    const code = String(req.query.code || "");
    const stateFromQuery = String(req.query.state || "");
    const cookies = parseCookieHeader(req.headers.cookie || "");
    const stateFromCookie = cookies[DISCORD_STATE_COOKIE] || "";

    if (!code || !stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
      recordAuthActivity({
        req,
        provider: "discord",
        type: "login",
        outcome: "error",
        message: "Discord login failed: invalid OAuth state",
        details: { reason: "oauth_state_invalid" },
      });
      res.setHeader("Set-Cookie", clearCookie(DISCORD_STATE_COOKIE));
      res.redirect(fallbackErrorUrl);
      return;
    }

    const stateExpiresAt = discordOauthStateCache.get(stateFromQuery) || 0;
    const redirectTargets = discordOauthRedirectCache.get(stateFromQuery) || null;
    const oauthIntent = resolveDiscordOauthIntent(redirectTargets?.intent);
    if (redirectTargets?.failureUrl) {
      fallbackErrorUrl = appendQueryParam(redirectTargets.failureUrl, "reason", "oauth_error");
    }
    discordOauthStateCache.delete(stateFromQuery);
    discordOauthRedirectCache.delete(stateFromQuery);
    persistAuthStore();
    if (!stateExpiresAt || Date.now() >= stateExpiresAt) {
      recordAuthActivity({
        req,
        provider: "discord",
        type: "login",
        outcome: "error",
        message: "Discord login failed: expired OAuth state",
        details: { reason: "oauth_state_expired" },
      });
      res.setHeader("Set-Cookie", clearCookie(DISCORD_STATE_COOKIE));
      res.redirect(fallbackErrorUrl);
      return;
    }

    const tokenBody = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: DISCORD_OAUTH_REDIRECT_URI,
    });

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange Discord auth code");
    }

    const tokenPayload = await tokenResponse.json();
    const accessToken = String(tokenPayload.access_token || "");

    if (!accessToken) {
      throw new Error("Discord access token missing");
    }

    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch Discord user profile");
    }

    const user = await userResponse.json();
    const discordId = String(user.id || "");

    let vamsysMatch = null;

    if (oauthIntent === DISCORD_OAUTH_INTENT_LINK) {
      const activeVamsysSession = getVamsysSessionFromRequest(req);
      const activeSessionUser = activeVamsysSession?.user || null;
      const activePilotId = Number(activeSessionUser?.id || 0) || 0;

      if (!activeSessionUser || activePilotId <= 0) {
        recordAuthActivity({
          req,
          provider: "discord",
          type: "link",
          outcome: "error",
          message: "Discord link failed: vAMSYS login required",
          details: { reason: "link_requires_vamsys_login" },
        });
        res.setHeader("Set-Cookie", clearCookie(DISCORD_STATE_COOKIE));
        res.redirect(appendQueryParam(fallbackErrorUrl, "reason", "link_requires_vamsys_login"));
        return;
      }

      const existingDiscordLink = discordLinksCache.get(discordId) || null;
      const existingPilotId = Number(existingDiscordLink?.vamsysPilotId || 0) || 0;
      if (existingPilotId > 0 && existingPilotId !== activePilotId) {
        recordAuthActivity({
          req,
          provider: "discord",
          type: "link",
          outcome: "error",
          message: "Discord link failed: Discord account is already linked to another pilot",
          actor: createAuthActivityActor({ provider: "vamsys", user: activeSessionUser }),
          details: { reason: "discord_already_linked", existingPilotId, activePilotId },
        });
        res.setHeader("Set-Cookie", clearCookie(DISCORD_STATE_COOKIE));
        res.redirect(appendQueryParam(fallbackErrorUrl, "reason", "discord_already_linked"));
        return;
      }

      const resolvedPilot = {
        id: activePilotId,
        username: String(activeSessionUser?.username || "").trim(),
        name: String(activeSessionUser?.name || "").trim(),
        email: String(activeSessionUser?.email || "").trim(),
        rank: String(activeSessionUser?.rank || "").trim(),
        hours: Number(activeSessionUser?.hours || 0) || 0,
        flights: Number(activeSessionUser?.flights || 0) || 0,
        joinedAt: String(activeSessionUser?.joinedAt || "").trim(),
      };

      vamsysMatch = {
        pilot: resolvedPilot,
        matchType: "manual_link",
        isStaff: isPilotStaff(resolvedPilot),
      };
    } else {
      vamsysMatch = await resolveLinkedVamsysPilotForDiscordUser(user);
      if (!vamsysMatch?.pilot) {
        recordAuthActivity({
          req,
          provider: "discord",
          type: "login",
          outcome: "error",
          message: "Discord login failed: account is not linked to a vAMSYS pilot",
          actor: createAuthActivityActor({
            provider: "discord",
            user,
            fallbackName: String(user.global_name || "").trim(),
            fallbackUsername: String(user.username || "").trim(),
          }),
          details: { reason: "discord_not_linked" },
        });
        res.setHeader("Set-Cookie", clearCookie(DISCORD_STATE_COOKIE));
        res.redirect(appendQueryParam(fallbackErrorUrl, "reason", "discord_not_linked"));
        return;
      }
    }

    if (!vamsysMatch?.pilot) {
      res.setHeader("Set-Cookie", clearCookie(DISCORD_STATE_COOKIE));
      res.redirect(buildFailureRedirect("vamsys_profile_not_found_or_not_linked"));
      return;
    }
    const staffMember = Boolean(vamsysMatch.isStaff);

    if (staffMember) {
      setAdminUser({
        discordId,
        username: String(user.username || ""),
        email: String(user.email || ""),
        linkedBy: "vamsys-staff-sync",
        role: "staff",
        metadata: {
          vamsysPilotId: Number(vamsysMatch.pilot?.id || 0) || null,
          vamsysMatchType: vamsysMatch.matchType,
        },
      });
    }

    const sessionId = randomUUID();
    const sessionUser = {
      id: discordId,
      username: String(user.username || ""),
      globalName: String(user.global_name || ""),
      email: String(user.email || ""),
      avatar: String(user.avatar || ""),
      vamsysPilotId: Number(vamsysMatch.pilot?.id || 0) || null,
      vamsysPilotName: String(vamsysMatch.pilot?.name || ""),
      vamsysPilotUsername: String(vamsysMatch.pilot?.username || ""),
      vamsysLinkedBy: vamsysMatch.matchType,
      isStaff: staffMember,
    };

    discordSessionCache.set(sessionId, {
      user: sessionUser,
      expiresAt: Date.now() + DISCORD_SESSION_TTL_MS,
    });
    updateAuthStoreLinks({
      discordLink: {
        id: sessionUser.id,
        username: sessionUser.username,
        globalName: sessionUser.globalName,
        email: sessionUser.email,
        avatar: sessionUser.avatar,
        linkedAt: new Date().toISOString(),
        vamsysPilotId: sessionUser.vamsysPilotId,
        vamsysLinkedBy: sessionUser.vamsysLinkedBy,
        isStaff: sessionUser.isStaff,
      },
      vamsysLink: {
        id: String(vamsysMatch.pilot?.id || ""),
        username: String(vamsysMatch.pilot?.username || ""),
        name: String(vamsysMatch.pilot?.name || ""),
        email: String(vamsysMatch.pilot?.email || ""),
        discordId,
        isStaff: staffMember,
        matchType: vamsysMatch.matchType,
        linkedAt: new Date().toISOString(),
      },
    });

    const successUrl =
      redirectTargets?.successUrl || resolveRedirectUrl(DISCORD_OAUTH_SUCCESS_URL, "/login?discord=success");
    res.setHeader("Set-Cookie", [
      clearCookie(DISCORD_STATE_COOKIE),
      buildCookie(DISCORD_SESSION_COOKIE, sessionId, DISCORD_SESSION_TTL_MS / 1000),
    ]);
    recordAuthActivity({
      req,
      provider: "discord",
      type: oauthIntent === DISCORD_OAUTH_INTENT_LINK ? "link" : "login",
      outcome: "success",
      message: oauthIntent === DISCORD_OAUTH_INTENT_LINK ? "Discord account linked successfully" : "Successful Discord login",
      actor: createAuthActivityActor({ provider: "vamsys", user: vamsysMatch.pilot }),
      details: {
        discordUsername: sessionUser.username,
        discordGlobalName: sessionUser.globalName,
        matchType: vamsysMatch.matchType,
      },
    });
    res.redirect(successUrl);
  } catch (error) {
    recordAuthActivity({
      req,
      provider: "discord",
      type: "login",
      outcome: "error",
      message: "Discord login failed",
      details: {
        reason: "discord_callback_failed",
        error: String(error),
      },
    });
    logger.error("[auth] discord_callback_failed", {
      error: String(error),
      code: String(req.query.code || "").slice(0, 12),
      hasState: Boolean(req.query.state),
    });
    res.setHeader("Set-Cookie", clearCookie(DISCORD_STATE_COOKIE));
    res.redirect(fallbackErrorUrl);
  }
});

app.get("/api/auth/discord/me", (req, res) => {
  const session = getDiscordSessionFromRequest(req);

  if (!session) {
    res.setHeader("Set-Cookie", clearCookie(DISCORD_SESSION_COOKIE));
    res.status(401).json({ authenticated: false });
    return;
  }

  res.json({
    authenticated: true,
    provider: "discord",
    isAdmin: false,
    role: "member",
    user: session.user,
  });
});

app.post("/api/auth/discord/logout", (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const sessionId = cookies[DISCORD_SESSION_COOKIE] || "";
  const session = sessionId ? discordSessionCache.get(sessionId) || null : null;
  if (sessionId) {
    discordSessionCache.delete(sessionId);
    persistAuthStore();
  }
  recordAuthActivity({
    req,
    provider: "discord",
    type: "logout",
    outcome: "success",
    message: "Discord logout",
    actor: createAuthActivityActor({
      provider: session?.user?.vamsysPilotId ? "vamsys" : "discord",
      user: session?.user || null,
      fallbackName: String(session?.user?.globalName || "").trim(),
      fallbackUsername: String(session?.user?.username || "").trim(),
    }),
  });
  res.setHeader("Set-Cookie", clearCookie(DISCORD_SESSION_COOKIE));
  res.json({ ok: true });
});

const fetchVamsysOAuthProfile = async (accessToken) => {
  const claims = decodeJwtPayload(accessToken) || {};
  const tokenId = Number(claims?.id || claims?.pilot_id || claims?.sub || claims?.uid || 0) || null;

  const candidates = [
    "https://vamsys.io/api/v3/account",
    "https://vamsys.io/api/v3/user",
    "https://vamsys.io/api/v3/pilot",
    "https://vamsys.io/api/v3/pilots/me",
    "https://vamsys.io/api/v3/operations/pilot",
    "https://vamsys.io/api/v3/operations/pilots/me",
    "https://vamsys.io/api/account",
    "https://vamsys.io/api/user",
    "https://vamsys.io/api/me",
    "https://vamsys.io/oauth/userinfo",
  ];

  if (tokenId) {
    candidates.push(
      `https://vamsys.io/api/v3/pilots/${tokenId}`,
      `https://vamsys.io/api/v3/operations/pilots/${tokenId}`
    );
  }

  for (const endpoint of candidates) {
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logVamsys("warn", "oauth_profile_endpoint_failed", {
          endpoint,
          status: response.status,
          durationMs: Date.now() - startedAt,
          body: truncateForLog(body),
        });
        continue;
      }
      const payload = await response.json();
      const data = payload?.data || payload;

      const flattenJsonApiNode = (node) => {
        if (!node || typeof node !== "object") {
          return {};
        }

        const attributes = node?.attributes && typeof node.attributes === "object" ? node.attributes : {};
        const relationships =
          node?.relationships && typeof node.relationships === "object" ? node.relationships : {};

        const flatRelationships = {};
        for (const [key, value] of Object.entries(relationships)) {
          const relData = value && typeof value === "object" ? value?.data : null;
          if (!relData) {
            continue;
          }
          if (Array.isArray(relData)) {
            flatRelationships[key] = relData.map((item) =>
              item && typeof item === "object"
                ? {
                    id: item.id,
                    type: item.type,
                    ...(item.attributes && typeof item.attributes === "object" ? item.attributes : {}),
                  }
                : item
            );
          } else if (relData && typeof relData === "object") {
            flatRelationships[key] = {
              id: relData.id,
              type: relData.type,
              ...(relData.attributes && typeof relData.attributes === "object"
                ? relData.attributes
                : {}),
            };
          }
        }

        return {
          ...(node && typeof node === "object" ? node : {}),
          ...(attributes && typeof attributes === "object" ? attributes : {}),
          ...(flatRelationships && typeof flatRelationships === "object" ? flatRelationships : {}),
          id: node?.id || attributes?.id,
        };
      };

      const normalizedData =
        data && typeof data === "object"
          ? {
              ...(Array.isArray(data) ? { items: data.map((item) => flattenJsonApiNode(item)) } : flattenJsonApiNode(data)),
              user:
                data?.user && typeof data.user === "object"
                  ? flattenJsonApiNode(data.user)
                  : payload?.user && typeof payload.user === "object"
                  ? flattenJsonApiNode(payload.user)
                  : undefined,
              pilot:
                data?.pilot && typeof data.pilot === "object"
                  ? flattenJsonApiNode(data.pilot)
                  : payload?.pilot && typeof payload.pilot === "object"
                  ? flattenJsonApiNode(payload.pilot)
                  : undefined,
              account:
                data?.account && typeof data.account === "object"
                  ? flattenJsonApiNode(data.account)
                  : payload?.account && typeof payload.account === "object"
                  ? flattenJsonApiNode(payload.account)
                  : undefined,
              dataAttributes:
                data?.attributes && typeof data.attributes === "object" ? data.attributes : undefined,
            }
          : null;

      if (normalizedData && typeof normalizedData === "object") {
        logVamsys("info", "oauth_profile_endpoint_success", {
          endpoint,
          durationMs: Date.now() - startedAt,
        });
        return normalizedData;
      }
    } catch {
      logVamsys("warn", "oauth_profile_endpoint_error", {
        endpoint,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  logVamsys("warn", "oauth_profile_not_found", { candidates: candidates.length });
  return null;
};

const getVamsysSessionFromRequest = (req) => {
  cleanupDiscordCaches();
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const sessionId = cookies[VAMSYS_SESSION_COOKIE] || "";
  const session = sessionId ? vamsysSessionCache.get(sessionId) : null;
  if (!session || Date.now() >= session.expiresAt) {
    if (sessionId) {
      vamsysSessionCache.delete(sessionId);
      persistAuthStore();
    }
    logger.warn('[auth] vamsys_session_missing', { sessionId, hasSessionInCache: vamsysSessionCache.has(sessionId) });
    return null;
  }
  logger.debug('[auth] vamsys_session_found', { sessionId, userId: session?.user?.id || session?.userId || null });
  return session;
};

const getDiscordSessionFromRequest = (req) => {
  cleanupDiscordCaches();
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const sessionId = cookies[DISCORD_SESSION_COOKIE] || "";
  const session = sessionId ? discordSessionCache.get(sessionId) : null;
  if (!session || Date.now() >= session.expiresAt) {
    if (sessionId) {
      discordSessionCache.delete(sessionId);
      persistAuthStore();
    }
    return null;
  }
  return session;
};

const applyResolvedPilotToUser = (currentUser, pilot = {}) => {
  if (!pilot || typeof pilot !== "object") {
    return currentUser;
  }

  const resolvedHonoraryRankId = Number(
    pilot?.honorary_rank_id ||
      pilot?.honoraryRankId ||
      pilot?.honorary_rank?.id ||
      currentUser?.honorary_rank_id ||
      currentUser?.honoraryRankId ||
      currentUser?.honorary_rank?.id ||
      0
  ) || 0;

  return {
    ...currentUser,
    id: String(pilot?.id || currentUser?.id || ""),
    username: String(pilot?.username || currentUser?.username || ""),
    name: String(pilot?.name || currentUser?.name || ""),
    email: String(pilot?.email || currentUser?.email || ""),
    rank: String(pilot?.rank || currentUser?.rank || "Member"),
    hours: Number(pilot?.hours || currentUser?.hours || 0) || 0,
    flights: Number(pilot?.flights || currentUser?.flights || 0) || 0,
    joinedAt: String(pilot?.joinedAt || currentUser?.joinedAt || ""),
    honorary_rank_id: resolvedHonoraryRankId > 0 ? resolvedHonoraryRankId : 0,
    honoraryRankId: resolvedHonoraryRankId > 0 ? resolvedHonoraryRankId : 0,
    honorary_rank:
      pilot?.honorary_rank && typeof pilot.honorary_rank === "object"
        ? pilot.honorary_rank
        : currentUser?.honorary_rank && typeof currentUser.honorary_rank === "object"
        ? currentUser.honorary_rank
        : undefined,
  };
};

const enrichVamsysSessionUser = async ({ accessToken, baseUser = {}, forceRosterRefresh = false } = {}) => {
  const claims = accessToken ? decodeJwtPayload(accessToken) || {} : {};
  const shouldProbeOAuthProfile =
    Boolean(accessToken) &&
    VAMSYS_OAUTH_PROFILE_PROBE_ENABLED;
  const profile = shouldProbeOAuthProfile
    ? await fetchVamsysOAuthProfile(accessToken).catch(() => null)
    : null;

  const mergedProfile = {
    ...(claims && typeof claims === "object" ? claims : {}),
    ...(profile && typeof profile === "object" ? profile : {}),
    ...(baseUser && typeof baseUser === "object" ? baseUser : {}),
  };

  const identity = extractOauthIdentity(mergedProfile);
  let sessionUser = {
    id: String(identity.id || baseUser?.id || "vamsys-user"),
    username: String(identity.username || baseUser?.username || "NWS"),
    name: String(identity.name || identity.username || baseUser?.name || "").trim(),
    email: String(identity.email || baseUser?.email || ""),
    rank: String(identity.rank || baseUser?.rank || "Member"),
    hours: Number(identity.hours || baseUser?.hours || 0) || 0,
    flights: Number(identity.flights || baseUser?.flights || 0) || 0,
    joinedAt: String(identity.joinedAt || baseUser?.joinedAt || ""),
    avatar: String(identity.avatar || baseUser?.avatar || ""),
    honorary_rank_id: Number(
      identity?.honorary_rank_id ||
        identity?.honoraryRankId ||
        identity?.honorary_rank?.id ||
        baseUser?.honorary_rank_id ||
        baseUser?.honoraryRankId ||
        baseUser?.honorary_rank?.id ||
        0
    ) || 0,
    honoraryRankId: Number(
      identity?.honorary_rank_id ||
        identity?.honoraryRankId ||
        identity?.honorary_rank?.id ||
        baseUser?.honorary_rank_id ||
        baseUser?.honoraryRankId ||
        baseUser?.honorary_rank?.id ||
        0
    ) || 0,
    honorary_rank:
      identity?.honorary_rank && typeof identity.honorary_rank === "object"
        ? identity.honorary_rank
        : baseUser?.honorary_rank && typeof baseUser.honorary_rank === "object"
        ? baseUser.honorary_rank
        : undefined,
  };

  try {
    if (forceRosterRefresh) {
      await loadPilotsRoster({ force: true });
    }
  } catch (err) {
    logVamsys("warn", "oauth_roster_refresh_failed", { error: String(err) });
  }

  const operationsMatch = await resolveOperationsPilotFromProfile(mergedProfile).catch(() => null);
  if (operationsMatch?.pilot) {
    sessionUser = applyResolvedPilotToUser(sessionUser, operationsMatch.pilot);

    try {
      const rankId = Number(operationsMatch?.pilot?.rank_id || 0) || 0;
      if (rankId > 0) {
        const ranksMap = await loadRanksMap();
        const mappedRank = ranksMap.get(rankId);
        if (mappedRank) {
          sessionUser.rank = String(mappedRank);
        }
      }
    } catch (err) {
      logVamsys("warn", "oauth_rank_mapping_failed", { error: String(err), pilotId: operationsMatch?.pilot?.id || null });
    }
  }

  const resolvedPilotId = Number(
    operationsMatch?.pilot?.id ||
    sessionUser?.id ||
    mergedProfile?.id ||
    mergedProfile?.pilot_id ||
    mergedProfile?.sub ||
    0
  ) || 0;

  if (resolvedPilotId > 0) {
    const byIdProfile = await loadPilotProfileById(resolvedPilotId, {
      seedPilot: operationsMatch?.pilot || null,
    }).catch(() => null);
    if (byIdProfile) {
      sessionUser = applyResolvedPilotToUser(sessionUser, byIdProfile);
    }
  }

  if (!sessionUser.name || isPlaceholderPilotName(sessionUser.name)) {
    const rosterPilot = await findPilotInRoster({
      id: sessionUser.id,
      username: sessionUser.username,
      email: sessionUser.email,
      name: sessionUser.name,
    }).catch(() => null);
    if (rosterPilot) {
      sessionUser = applyResolvedPilotToUser(sessionUser, rosterPilot);
    }
  }

  if (!sessionUser.name || isPlaceholderPilotName(sessionUser.name)) {
    const fallbackNameById = await loadPilotName(sessionUser.id).catch(() => "");
    if (fallbackNameById && !isPlaceholderPilotName(fallbackNameById)) {
      sessionUser.name = String(fallbackNameById);
    }
  }

  return {
    user: sessionUser,
    identity,
    claims,
    profile,
    operationsMatch,
  };
};

app.get("/api/auth/vamsys/login", (req, res) => {
  if (!isVamsysOAuthConfigured()) {
    logVamsys("error", "oauth_login_config_missing", requestContext(req));
    res.status(500).json({
      error: "Missing VAMSYS_OAUTH_CLIENT_ID, VAMSYS_OAUTH_CLIENT_SECRET or VAMSYS_OAUTH_REDIRECT_URI",
    });
    return;
  }

  cleanupDiscordCaches();

  const state = randomUUID();
  vamsysOauthStateCache.set(state, Date.now() + VAMSYS_STATE_TTL_MS);
  persistAuthStore();

  const authUrl = new URL("https://vamsys.io/oauth/authorize");
  authUrl.searchParams.set("client_id", VAMSYS_OAUTH_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", VAMSYS_OAUTH_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  if (VAMSYS_OAUTH_SCOPE) {
    authUrl.searchParams.set("scope", VAMSYS_OAUTH_SCOPE);
  }
  authUrl.searchParams.set("state", state);

  logVamsys("info", "oauth_login_redirect", {
    ...requestContext(req),
    hasScope: Boolean(VAMSYS_OAUTH_SCOPE),
    redirectUri: VAMSYS_OAUTH_REDIRECT_URI,
  });

  res.setHeader("Set-Cookie", buildCookie(VAMSYS_STATE_COOKIE, state, VAMSYS_STATE_TTL_MS / 1000));
  res.redirect(authUrl.toString());
});

app.get("/api/auth/vamsys/callback", async (req, res) => {
  const failureUrl = resolveRedirectUrl(VAMSYS_OAUTH_FAILURE_URL, "/login?vamsys=error");
  const successUrl = resolveRedirectUrl(VAMSYS_OAUTH_SUCCESS_URL, "/login?vamsys=success");
  const startedAt = Date.now();

  try {
    if (!isVamsysOAuthConfigured()) {
      res.redirect(failureUrl);
      return;
    }

    const oauthError = String(req.query.error || "");
    if (oauthError) {
      recordAuthActivity({
        req,
        provider: "vamsys",
        type: "login",
        outcome: "error",
        message: "vAMSYS login failed: provider returned an OAuth error",
        details: {
          reason: "oauth_provider_error",
          oauthError,
          description: String(req.query.error_description || "").trim(),
        },
      });
      logVamsys("warn", "oauth_callback_provider_error", {
        ...requestContext(req),
        oauthError,
        description: truncateForLog(String(req.query.error_description || ""), 300),
      });
      res.setHeader("Set-Cookie", clearCookie(VAMSYS_STATE_COOKIE));
      res.redirect(failureUrl);
      return;
    }

    const code = String(req.query.code || "").trim();
    const stateFromQuery = String(req.query.state || "").trim();
    const cookies = parseCookieHeader(req.headers.cookie || "");
    const stateFromCookie = String(cookies[VAMSYS_STATE_COOKIE] || "").trim();

    if (!code || !stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
      recordAuthActivity({
        req,
        provider: "vamsys",
        type: "login",
        outcome: "error",
        message: "vAMSYS login failed: invalid OAuth state",
        details: { reason: "oauth_state_invalid" },
      });
      logVamsys("warn", "oauth_callback_state_invalid", {
        ...requestContext(req),
        hasCode: Boolean(code),
        hasStateQuery: Boolean(stateFromQuery),
        hasStateCookie: Boolean(stateFromCookie),
      });
      res.setHeader("Set-Cookie", clearCookie(VAMSYS_STATE_COOKIE));
      res.redirect(failureUrl);
      return;
    }

    const stateExpiresAt = Number(vamsysOauthStateCache.get(stateFromQuery) || 0);
    vamsysOauthStateCache.delete(stateFromQuery);
    if (!stateExpiresAt || Date.now() >= stateExpiresAt) {
      recordAuthActivity({
        req,
        provider: "vamsys",
        type: "login",
        outcome: "error",
        message: "vAMSYS login failed: expired OAuth state",
        details: { reason: "oauth_state_expired" },
      });
      logVamsys("warn", "oauth_callback_state_expired", { ...requestContext(req) });
      res.setHeader("Set-Cookie", clearCookie(VAMSYS_STATE_COOKIE));
      res.redirect(failureUrl);
      return;
    }

    const tokenBody = new URLSearchParams({
      client_id: VAMSYS_OAUTH_CLIENT_ID,
      client_secret: VAMSYS_OAUTH_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: VAMSYS_OAUTH_REDIRECT_URI,
    });

    const tokenResponse = await fetch("https://vamsys.io/oauth/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text().catch(() => "");
      throw new Error(`oauth_token_exchange_failed:${tokenResponse.status}:${truncateForLog(body, 500)}`);
    }

    const tokenPayload = await tokenResponse.json();
    const accessToken = String(tokenPayload?.access_token || "").trim();
    if (!accessToken) {
      throw new Error("oauth_access_token_missing");
    }

    const enriched = await enrichVamsysSessionUser({
      accessToken,
      baseUser: {},
      forceRosterRefresh: true,
    });

    const sessionId = randomUUID();
    vamsysSessionCache.set(sessionId, {
      user: enriched.user,
      accessToken,
      enrichedAt: Date.now(),
      expiresAt: Date.now() + VAMSYS_SESSION_TTL_MS,
    });

    updateAuthStoreLinks({
      vamsysLink: {
        provider: "vamsys",
        id: String(enriched.user?.id || ""),
        username: String(enriched.user?.username || ""),
        name: String(enriched.user?.name || ""),
        email: String(enriched.user?.email || ""),
        role: isVamsysAdmin(enriched.user || {}) ? "admin" : "member",
        linkedBy: "oauth:vamsys",
        linkedAt: new Date().toISOString(),
        metadata: {
          source: "oauth_callback",
          isAdmin: isVamsysAdmin(enriched.user || {}),
        },
      },
    });
    persistAuthStore();

    res.setHeader("Set-Cookie", [
      clearCookie(VAMSYS_STATE_COOKIE),
      buildCookie(VAMSYS_SESSION_COOKIE, sessionId, VAMSYS_SESSION_TTL_MS / 1000),
    ]);

    logVamsys("info", "oauth_callback_success", {
      ...requestContext(req),
      sessionUserId: enriched.user?.id || null,
      sessionUsername: enriched.user?.username || null,
      durationMs: Date.now() - startedAt,
    });

    recordAuthActivity({
      req,
      provider: "vamsys",
      type: "login",
      outcome: "success",
      message: "Successful vAMSYS login",
      actor: createAuthActivityActor({ provider: "vamsys", user: enriched.user }),
      details: {
        durationMs: Date.now() - startedAt,
        isAdmin: isVamsysAdmin(enriched.user || {}),
      },
    });

    res.redirect(successUrl);
  } catch (error) {
    recordAuthActivity({
      req,
      provider: "vamsys",
      type: "login",
      outcome: "error",
      message: "vAMSYS login failed",
      details: {
        reason: "oauth_callback_failed",
        durationMs: Date.now() - startedAt,
        error: String(error),
      },
    });
    logVamsys("error", "oauth_callback_failed", {
      ...requestContext(req),
      durationMs: Date.now() - startedAt,
      error: String(error),
    });
    res.setHeader("Set-Cookie", clearCookie(VAMSYS_STATE_COOKIE));
    res.redirect(failureUrl);
  }
});

app.get("/api/auth/vamsys/me", async (req, res) => {
  const session = getVamsysSessionFromRequest(req);
  if (!session) {
    res.setHeader("Set-Cookie", clearCookie(VAMSYS_SESSION_COOKIE));
    res.status(401).json({ authenticated: false });
    return;
  }

  try {
    const accessToken = String(session.accessToken || "").trim();
    const enrichedAt = Number(session?.enrichedAt || 0) || 0;
    const shouldRefresh = !enrichedAt || Date.now() - enrichedAt >= VAMSYS_SESSION_REFRESH_MS;
    if (accessToken && shouldRefresh) {
      const enriched = await enrichVamsysSessionUser({
        accessToken,
        baseUser: session.user || {},
        forceRosterRefresh: false,
      });
      session.user = enriched.user;
      session.enrichedAt = Date.now();
      persistAuthStore();
    }
  } catch (error) {
    logVamsys("warn", "vamsys_me_enrich_failed", {
      ...requestContext(req),
      error: String(error),
    });
  }

  let vamsysAdmin = isVamsysAdmin(session?.user || {});
  const hasHonoraryInSession = Boolean(
    session?.user &&
      (
        session.user.honorary_rank_id != null ||
        session.user.honoraryRankId != null ||
        session.user?.honorary_rank?.id != null
      )
  );

  if (!vamsysAdmin && !hasHonoraryInSession) {
    try {
      const fallbackPilotId = Number(session?.user?.id || 0) || 0;
      if (fallbackPilotId > 0) {
        const fallbackProfile = await loadPilotProfileById(fallbackPilotId).catch(() => null);
        if (fallbackProfile) {
          session.user = applyResolvedPilotToUser(session.user || {}, fallbackProfile);
          session.enrichedAt = Date.now();
          persistAuthStore();
          vamsysAdmin = isVamsysAdmin(session?.user || {});
        }
      }
    } catch (error) {
      logVamsys("warn", "vamsys_me_honorary_fallback_failed", {
        ...requestContext(req),
        error: String(error),
      });
    }
  }

  res.json({
    authenticated: true,
    provider: "vamsys",
    isAdmin: vamsysAdmin,
    role: vamsysAdmin ? "admin" : "member",
    user: session.user,
  });
});

app.get("/api/auth/pilot-api/connect", (req, res) => {
  cleanupDiscordCaches();

  const intent = String(req.query.intent || "").trim().toLowerCase() === "login" ? "login" : "connect";

  const returnTo = resolveInternalRedirectPath(
    String(req.query.returnTo || ""),
    intent === "login" ? "/dashboard" : ""
  );
  const successUrl =
    intent === "login"
      ? returnTo || "/dashboard"
      : returnTo
      ? appendQueryParam(returnTo, "pilot_api", "success")
      : resolveRedirectUrl(PILOT_API_SUCCESS_URL, "/dashboard?tab=settings&pilot_api=success");
  const failureUrl =
    intent === "login"
      ? appendQueryParam(resolveInternalRedirectPath("/login", "/login"), "pilot_api", "error")
      : returnTo
      ? appendQueryParam(returnTo, "pilot_api", "error")
      : resolveRedirectUrl(PILOT_API_FAILURE_URL, "/dashboard?tab=settings&pilot_api=error");

  if (!isPilotApiConfigured()) {
    res.redirect(appendQueryParam(failureUrl, "reason", "pilot_api_not_configured"));
    return;
  }

  const session = getVamsysSessionFromRequest(req);
  const pilotId = Number(session?.user?.id || 0) || 0;
  if (intent !== "login" && (!session || pilotId <= 0)) {
    res.redirect(appendQueryParam(failureUrl, "reason", "vamsys_login_required"));
    return;
  }

  const state = randomUUID();
  const codeVerifier = createPkceVerifier();
  pilotApiOauthStateCache.set(state, {
    expiresAt: Date.now() + PILOT_API_STATE_TTL_MS,
    pilotId,
    intent,
    codeVerifier,
    successUrl,
    failureUrl,
  });
  persistAuthStore();

  const authUrl = new URL("https://vamsys.io/oauth/authorize");
  authUrl.searchParams.set("client_id", PILOT_API_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", PILOT_API_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", createPkceChallenge(codeVerifier));
  authUrl.searchParams.set("code_challenge_method", "S256");
  if (PILOT_API_SCOPE) {
    authUrl.searchParams.set("scope", PILOT_API_SCOPE);
  }

  res.setHeader("Set-Cookie", buildCookie(PILOT_API_STATE_COOKIE, state, PILOT_API_STATE_TTL_MS / 1000));
  res.redirect(authUrl.toString());
});

app.get("/api/auth/pilot-api/callback", async (req, res) => {
  cleanupDiscordCaches();

  const activeSession = getVamsysSessionFromRequest(req);
  let failureUrl = activeSession
    ? resolveRedirectUrl(PILOT_API_FAILURE_URL, "/dashboard?tab=settings&pilot_api=error")
    : "/login?pilot_api=error";

  try {
    if (!isPilotApiConfigured()) {
      res.redirect(appendQueryParam(failureUrl, "reason", "pilot_api_not_configured"));
      return;
    }

    const oauthError = String(req.query.error || "").trim();
    const code = String(req.query.code || "").trim();
    const stateFromQuery = String(req.query.state || "").trim();
    const cookies = parseCookieHeader(req.headers.cookie || "");
    const stateFromCookie = String(cookies[PILOT_API_STATE_COOKIE] || "").trim();

    const stateEntry = stateFromQuery ? pilotApiOauthStateCache.get(stateFromQuery) || null : null;
    failureUrl = stateEntry?.failureUrl || failureUrl;
    const intent = String(stateEntry?.intent || "").trim().toLowerCase() === "login" ? "login" : "connect";
    const activePilotId = Number(activeSession?.user?.id || 0) || 0;

    if (oauthError) {
      recordAuthActivity({
        req,
        provider: "pilot-api",
        type: intent === "login" ? "login" : "connect",
        outcome: "error",
        message: intent === "login" ? "Pilot API login failed: provider returned an OAuth error" : "Pilot API connect failed: provider returned an OAuth error",
        actor: activeSession?.user ? createAuthActivityActor({ provider: "vamsys", user: activeSession.user }) : null,
        details: { reason: "oauth_error", oauthError },
      });
      res.setHeader("Set-Cookie", clearCookie(PILOT_API_STATE_COOKIE));
      if (stateFromQuery) {
        pilotApiOauthStateCache.delete(stateFromQuery);
        persistAuthStore();
      }
      res.redirect(appendQueryParam(failureUrl, "reason", "oauth_error"));
      return;
    }

    if (!code || !stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie || !stateEntry) {
      recordAuthActivity({
        req,
        provider: "pilot-api",
        type: intent === "login" ? "login" : "connect",
        outcome: "error",
        message: intent === "login" ? "Pilot API login failed: invalid OAuth state" : "Pilot API connect failed: invalid OAuth state",
        actor: activeSession?.user ? createAuthActivityActor({ provider: "vamsys", user: activeSession.user }) : null,
        details: { reason: "oauth_state_invalid" },
      });
      res.setHeader("Set-Cookie", clearCookie(PILOT_API_STATE_COOKIE));
      res.redirect(appendQueryParam(failureUrl, "reason", "oauth_state_invalid"));
      return;
    }

    pilotApiOauthStateCache.delete(stateFromQuery);
    persistAuthStore();

    const stateExpiresAt = Number(stateEntry?.expiresAt || 0) || 0;
    const statePilotId = Number(stateEntry?.pilotId || 0) || 0;
    if (!stateExpiresAt || Date.now() >= stateExpiresAt) {
      recordAuthActivity({
        req,
        provider: "pilot-api",
        type: intent === "login" ? "login" : "connect",
        outcome: "error",
        message: intent === "login" ? "Pilot API login failed: expired OAuth state" : "Pilot API connect failed: expired OAuth state",
        actor: activeSession?.user ? createAuthActivityActor({ provider: "vamsys", user: activeSession.user }) : null,
        details: { reason: "oauth_state_expired" },
      });
      res.setHeader("Set-Cookie", clearCookie(PILOT_API_STATE_COOKIE));
      res.redirect(appendQueryParam(failureUrl, "reason", "oauth_state_expired"));
      return;
    }

    if (intent !== "login" && (!activeSession || activePilotId <= 0)) {
      recordAuthActivity({
        req,
        provider: "pilot-api",
        type: "connect",
        outcome: "error",
        message: "Pilot API connect failed: vAMSYS login required",
        details: { reason: "vamsys_login_required" },
      });
      res.setHeader("Set-Cookie", clearCookie(PILOT_API_STATE_COOKIE));
      res.redirect(appendQueryParam(failureUrl, "reason", "vamsys_login_required"));
      return;
    }

    if (intent !== "login" && (statePilotId <= 0 || statePilotId !== activePilotId)) {
      recordAuthActivity({
        req,
        provider: "pilot-api",
        type: "connect",
        outcome: "error",
        message: "Pilot API connect failed: pilot session changed during OAuth flow",
        actor: activeSession?.user ? createAuthActivityActor({ provider: "vamsys", user: activeSession.user }) : null,
        details: { reason: "pilot_session_changed", statePilotId, activePilotId },
      });
      res.setHeader("Set-Cookie", clearCookie(PILOT_API_STATE_COOKIE));
      res.redirect(appendQueryParam(failureUrl, "reason", "pilot_session_changed"));
      return;
    }

    const tokenPayload = await exchangePilotApiToken(
      new URLSearchParams({
        client_id: PILOT_API_CLIENT_ID,
        grant_type: "authorization_code",
        code,
        code_verifier: String(stateEntry?.codeVerifier || ""),
        redirect_uri: PILOT_API_REDIRECT_URI,
      })
    );

    const accessToken = String(tokenPayload?.access_token || "").trim();
    const refreshToken = String(tokenPayload?.refresh_token || "").trim();
    if (!accessToken || !refreshToken) {
      throw new Error("pilot_api_token_missing");
    }

    const profile = await fetchPilotApiProfile(accessToken);
    const profilePilotId = Number(profile?.id || 0) || 0;
    if (intent !== "login" && profilePilotId > 0 && profilePilotId !== activePilotId) {
      throw new Error("pilot_api_profile_mismatch");
    }

    let sessionUser = activeSession?.user || {};
    let targetPilotId = activePilotId;
    let sessionId = "";

    if (intent === "login") {
      const createdSession = await createWebsiteSessionFromPilotApiProfile(profile);
      sessionUser = createdSession.user || {};
      targetPilotId = Number(createdSession.pilotId || profilePilotId || 0) || 0;
      sessionId = String(createdSession.sessionId || "").trim();
    }

    if (targetPilotId <= 0) {
      throw new Error("pilot_api_profile_missing_id");
    }

    storePilotApiConnection({
      pilotId: targetPilotId,
      sessionUser,
      connection: {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + Math.max(Number(tokenPayload?.expires_in || 3600) || 3600, 60) * 1000,
        scope: String(tokenPayload?.scope || PILOT_API_SCOPE || "").trim(),
        connectedAt: new Date().toISOString(),
        profile,
        profileSyncedAt: Date.now(),
      },
    });

    const nextCookies = [clearCookie(PILOT_API_STATE_COOKIE)];
    if (intent === "login" && sessionId) {
      nextCookies.push(buildCookie(VAMSYS_SESSION_COOKIE, sessionId, VAMSYS_SESSION_TTL_MS / 1000));
    }

    recordAuthActivity({
      req,
      provider: "pilot-api",
      type: intent === "login" ? "login" : "connect",
      outcome: "success",
      message: intent === "login" ? "Successful login via Pilot API" : "Pilot API connected successfully",
      actor: createAuthActivityActor({ provider: "vamsys", user: sessionUser }),
      details: {
        pilotId: targetPilotId,
        intent,
      },
    });

    res.setHeader("Set-Cookie", nextCookies);
    res.redirect(stateEntry?.successUrl || resolveRedirectUrl(PILOT_API_SUCCESS_URL, "/dashboard?tab=settings&pilot_api=success"));
  } catch (error) {
    recordAuthActivity({
      req,
      provider: "pilot-api",
      type: activeSession ? "connect" : "login",
      outcome: "error",
      message: activeSession ? "Pilot API connect failed" : "Pilot API login failed",
      actor: activeSession?.user ? createAuthActivityActor({ provider: "vamsys", user: activeSession.user }) : null,
      details: {
        reason: "pilot_api_connect_failed",
        error: String(error),
      },
    });
    res.setHeader("Set-Cookie", clearCookie(PILOT_API_STATE_COOKIE));
    res.redirect(appendQueryParam(failureUrl, "reason", "pilot_api_connect_failed"));
  }
});

app.get("/api/auth/pilot-api/status", async (req, res) => {
  const session = getVamsysSessionFromRequest(req);
  if (!session) {
    res.setHeader("Set-Cookie", clearCookie(VAMSYS_SESSION_COOKIE));
    res.status(401).json({ authenticated: false, configured: isPilotApiConfigured(), connected: false });
    return;
  }

  if (!isPilotApiConfigured()) {
    res.json({ authenticated: true, configured: false, connected: false });
    return;
  }

  try {
    const forceRefresh = String(req.query.refresh || "").trim() === "1";
    const pilotId = Number(session?.user?.id || 0) || 0;
    const connection = await ensurePilotApiConnection({
      pilotId,
      sessionUser: session.user || {},
      forceProfileRefresh: forceRefresh,
    });

    if (!connection) {
      res.json({ authenticated: true, configured: true, connected: false });
      return;
    }

    res.json({
      authenticated: true,
      configured: true,
      connected: true,
      connectedAt: connection.connectedAt || null,
      expiresAt: Number(connection.expiresAt || 0) || null,
      profileSyncedAt: Number(connection.profileSyncedAt || 0) || null,
      scope: String(connection.scope || "").trim(),
      profile: connection.profile ? sanitizePilotApiProfile(connection.profile) : null,
    });
  } catch {
    res.status(502).json({
      authenticated: true,
      configured: true,
      connected: false,
      error: "pilot_api_status_failed",
    });
  }
});

app.post("/api/auth/pilot-api/disconnect", (req, res) => {
  const session = getVamsysSessionFromRequest(req);
  if (!session) {
    res.setHeader("Set-Cookie", clearCookie(VAMSYS_SESSION_COOKIE));
    res.status(401).json({ ok: false, error: "Authentication required" });
    return;
  }

  clearPilotApiConnection({
    pilotId: Number(session?.user?.id || 0) || 0,
    sessionUser: session.user || {},
  });

  res.json({ ok: true });
});

const requirePilotApiSession = (req, res) => {
  const session = getVamsysSessionFromRequest(req);
  if (!session) {
    res.setHeader("Set-Cookie", clearCookie(VAMSYS_SESSION_COOKIE));
    res.status(401).json({ ok: false, error: "Authentication required", code: "auth_required" });
    return null;
  }

  return session;
};

const respondWithPilotApiError = (res, error, fallbackMessage) => {
  const status = Number(error?.status || 502) || 502;
  const code = String(error?.code || "pilot_api_request_failed").trim() || "pilot_api_request_failed";
  const message =
    status >= 500
      ? fallbackMessage
      : String(error?.message || fallbackMessage).trim() || fallbackMessage;

  res.status(status).json({
    ok: false,
    error: message,
    code,
  });
};

app.get("/api/pilot/bookings", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const pageSize = Math.max(1, Math.min(50, Number(req.query["page[size]"] || 20) || 20));
    const cursor = String(req.query["page[cursor]"] || "").trim();
    const sort = String(req.query.sort || "departure_time").trim() || "departure_time";
    const status = String(req.query["filter[status]"] || "").trim();
    const params = new URLSearchParams();
    params.set("page[size]", String(pageSize));
    params.set("sort", sort);
    if (cursor) {
      params.set("page[cursor]", cursor);
    }
    if (status) {
      params.set("filter[status]", status);
    }

    const [payload, references] = await Promise.all([
      pilotApiRequest({
        pilotId: Number(session?.user?.id || 0) || 0,
        sessionUser: session.user || {},
        path: `/bookings?${params.toString()}`,
      }),
      loadPilotApiReferenceData(),
    ]);

    const bookings = await loadDetailedPilotApiBookings({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      bookings: getPilotApiCollectionItems(payload),
      references,
    });

    res.json({
      bookings,
      meta: payload?.meta || null,
      links: payload?.links || null,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load Pilot API bookings");
  }
});

app.get("/api/pilot/bookings/:id", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const bookingId = encodeURIComponent(String(req.params.id || "").trim());
    if (!bookingId) {
      res.status(400).json({ ok: false, error: "Booking ID is required", code: "booking_id_required" });
      return;
    }

    const [payload, references] = await Promise.all([
      pilotApiRequest({
        pilotId: Number(session?.user?.id || 0) || 0,
        sessionUser: session.user || {},
        path: `/bookings/${bookingId}`,
      }),
      loadPilotApiReferenceData(),
    ]);

    const booking = getPilotApiItem(payload);
    if (!booking) {
      res.status(404).json({ ok: false, error: "Booking not found", code: "booking_not_found" });
      return;
    }

    res.json({ booking: enrichPilotApiBooking(booking, references) });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load Pilot API booking");
  }
});

app.patch("/api/pilot/bookings/:id", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const bookingId = encodeURIComponent(String(req.params.id || "").trim());
    if (!bookingId) {
      res.status(400).json({ ok: false, error: "Booking ID is required", code: "booking_id_required" });
      return;
    }

    const payloadBody = {};
    const optionalStringFields = [
      ["network", req.body?.network],
      ["callsign", req.body?.callsign],
      ["flight_number", req.body?.flightNumber ?? req.body?.flight_number],
      ["altitude", req.body?.altitude],
      ["user_route", req.body?.userRoute ?? req.body?.user_route],
    ];

    optionalStringFields.forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      payloadBody[key] = String(value).trim();
    });

    const optionalNumericFields = [
      ["passengers", req.body?.passengers],
      ["cargo", req.body?.cargo],
      ["routing_id", req.body?.routingId ?? req.body?.routing_id],
    ];

    optionalNumericFields.forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        payloadBody[key] = numericValue;
      }
    });

    if (!Object.keys(payloadBody).length) {
      res.status(400).json({ ok: false, error: "No fields to update", code: "booking_patch_empty" });
      return;
    }

    const [payload, references] = await Promise.all([
      pilotApiRequest({
        pilotId: Number(session?.user?.id || 0) || 0,
        sessionUser: session.user || {},
        path: `/bookings/${bookingId}`,
        method: "PATCH",
        body: payloadBody,
      }),
      loadPilotApiReferenceData(),
    ]);

    const booking = getPilotApiItem(payload);
    if (!booking) {
      res.status(404).json({ ok: false, error: "Booking not found", code: "booking_not_found" });
      return;
    }

    res.json({
      ok: true,
      booking: enrichPilotApiBooking(booking, references),
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to update Pilot API booking");
  }
});

const normalizePilotBookingLifecycleStatus = (booking = {}) => {
  if (booking?.deleted_at) {
    return "cancelled";
  }
  if ((Number(booking?.pirep_id || 0) || 0) > 0) {
    return "completed";
  }
  return String(booking?.status || "upcoming").trim().toLowerCase() || "upcoming";
};

const isPilotBookingOpenForSequence = (booking = {}) => {
  const status = normalizePilotBookingLifecycleStatus(booking);
  return ["active", "upcoming", "pending"].includes(status);
};

const getPilotBookingTimestamp = (booking = {}) => {
  const candidates = [booking?.departure_time, booking?.created_at, booking?.updated_at];
  for (const candidate of candidates) {
    const parsed = Date.parse(String(candidate || ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const computePilotBookingChainTailAirportId = ({ bookings = [], startAirportId = 0 } = {}) => {
  const baseAirportId = Number(startAirportId || 0) || 0;
  if (baseAirportId <= 0) {
    return null;
  }

  const openBookings = (Array.isArray(bookings) ? bookings : [])
    .filter((booking) => isPilotBookingOpenForSequence(booking))
    .slice()
    .sort((left, right) => getPilotBookingTimestamp(left) - getPilotBookingTimestamp(right));

  let currentAirportId = baseAirportId;
  const usedIds = new Set();

  while (true) {
    const nextBooking = openBookings.find((booking) => {
      const bookingId = Number(booking?.id || 0) || 0;
      const departureId = Number(booking?.departure_id || booking?.route?.departure_id || 0) || 0;
      return bookingId > 0 && !usedIds.has(bookingId) && departureId > 0 && departureId === currentAirportId;
    });

    if (!nextBooking) {
      break;
    }

    usedIds.add(Number(nextBooking.id || 0) || 0);
    const arrivalId = Number(nextBooking?.arrival_id || nextBooking?.route?.arrival_id || 0) || 0;
    if (arrivalId <= 0) {
      break;
    }
    currentAirportId = arrivalId;
  }

  return currentAirportId;
};

const computePilotBookingCascadeIds = ({ bookings = [], targetBookingId = 0 } = {}) => {
  const selectedBookingId = Number(targetBookingId || 0) || 0;
  if (selectedBookingId <= 0) {
    return [];
  }

  const openBookings = (Array.isArray(bookings) ? bookings : [])
    .filter((booking) => isPilotBookingOpenForSequence(booking))
    .slice()
    .sort((left, right) => getPilotBookingTimestamp(left) - getPilotBookingTimestamp(right));

  const target = openBookings.find((booking) => Number(booking?.id || 0) === selectedBookingId) || null;
  if (!target) {
    return [selectedBookingId];
  }

  const selectedIds = [selectedBookingId];
  const usedIds = new Set(selectedIds);
  let currentArrivalId = Number(target?.arrival_id || target?.route?.arrival_id || 0) || 0;

  while (currentArrivalId > 0) {
    const next = openBookings.find((booking) => {
      const bookingId = Number(booking?.id || 0) || 0;
      const departureId = Number(booking?.departure_id || booking?.route?.departure_id || 0) || 0;
      return bookingId > 0 && !usedIds.has(bookingId) && departureId === currentArrivalId;
    });

    if (!next) {
      break;
    }

    const nextId = Number(next?.id || 0) || 0;
    usedIds.add(nextId);
    selectedIds.push(nextId);
    currentArrivalId = Number(next?.arrival_id || next?.route?.arrival_id || 0) || 0;
  }

  return selectedIds;
};

const normalizePilotSimbriefPayload = (payload) => {
  const node = getPilotApiItem(payload) || (payload && typeof payload === "object" ? payload : {});
  const url = String(
    node?.url ||
      node?.ofp_url ||
      node?.briefing_url ||
      node?.dispatch_url ||
      node?.pdf_url ||
      node?.link ||
      ""
  ).trim();
  const html = String(node?.html || node?.ofp_html || node?.briefing_html || "").trim();

  return {
    available: Boolean(url || html || (node && typeof node === "object" && Object.keys(node).length > 0)),
    url: url || null,
    html: html || null,
    raw: node && typeof node === "object" ? node : null,
  };
};

app.post("/api/pilot/bookings", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const normalizedPilotId = Number(session?.user?.id || 0) || 0;
    const routeId = Number(req.body?.routeId || req.body?.route_id || 0) || 0;
    const aircraftId = Number(req.body?.aircraftId || req.body?.aircraft_id || 0) || 0;
    const departureTime = String(req.body?.departureTime || req.body?.departure_time || "").trim();

    if (routeId <= 0 || aircraftId <= 0 || !departureTime) {
      res.status(400).json({
        ok: false,
        error: "route_id, aircraft_id and departure_time are required",
        code: "booking_payload_invalid",
      });
      return;
    }

    try {
      const currentNotams = await fetchAllPages("/notams?page[size]=100");
      const serializedNotams = (Array.isArray(currentNotams) ? currentNotams : []).map((item) =>
        serializeVamsysNotam(item)
      );
      const unreadNotams = getUnreadNotamsForPilot(session.user || {}, serializedNotams);
      if (unreadNotams.length > 0) {
        throw createUnreadNotamsBookingError(unreadNotams);
      }
    } catch (error) {
      if (String(error?.code || "") === "notams_unread") {
        throw error;
      }
    }

    const [routesPayload, pilotConnection, existingBookingsPayload, airportsMap] = await Promise.all([
      loadRoutesData().catch(() => ({ routes: [] })),
      ensurePilotApiConnection({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
        forceProfileRefresh: true,
      }).catch(() => null),
      pilotApiRequest({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
        path: "/bookings?page[size]=100&sort=departure_time",
      }).catch(() => ({ data: [] })),
      loadAirportsLookup().catch(() => new Map()),
    ]);

    const routes = Array.isArray(routesPayload?.routes) ? routesPayload.routes : [];
    const selectedRoute = routes.find((item) => Number(item?.id || 0) === routeId) || null;
    const selectedDepartureId =
      Number(selectedRoute?.departureId || selectedRoute?.departure_id || selectedRoute?.fromId || 0) || 0;
    const currentLocationId =
      Number(pilotConnection?.profile?.location_id || pilotConnection?.profile?.locationId || 0) || 0;
    const existingBookings = getPilotApiCollectionItems(existingBookingsPayload);
    const expectedDepartureId = computePilotBookingChainTailAirportId({
      bookings: existingBookings,
      startAirportId: currentLocationId,
    });

    if (
      selectedDepartureId > 0 &&
      Number(expectedDepartureId || 0) > 0 &&
      selectedDepartureId !== Number(expectedDepartureId || 0)
    ) {
      const expectedAirport = airportsMap.get(Number(expectedDepartureId || 0)) || null;
      const selectedAirport = airportsMap.get(selectedDepartureId) || null;
      const expectedDepartureCode = String(expectedAirport?.code || "").trim() || null;
      const selectedDepartureCode = String(selectedRoute?.fromCode || selectedAirport?.code || "").trim() || null;
      res.status(409).json({
        ok: false,
        code: "booking_departure_mismatch",
        error:
          expectedDepartureCode && selectedDepartureCode
            ? `Next booking must depart from ${expectedDepartureCode}. Selected departure is ${selectedDepartureCode}.`
            : "Next booking must depart from your current route chain location.",
        expectedDepartureId: Number(expectedDepartureId || 0) || null,
        expectedDepartureCode,
        selectedDepartureCode,
      });
      return;
    }

    const payloadBody = {
      route_id: routeId,
      aircraft_id: aircraftId,
      departure_time: departureTime,
    };

    const optionalStringFields = [
      ["network", req.body?.network],
      ["callsign", req.body?.callsign],
      ["flight_number", req.body?.flightNumber ?? req.body?.flight_number],
      ["altitude", req.body?.altitude],
      ["user_route", req.body?.userRoute ?? req.body?.user_route],
    ];
    optionalStringFields.forEach(([key, value]) => {
      const normalized = String(value || "").trim();
      if (normalized) {
        payloadBody[key] = normalized;
      }
    });

    const optionalNumericFields = [
      ["passengers", req.body?.passengers],
      ["cargo", req.body?.cargo],
      ["routing_id", req.body?.routingId ?? req.body?.routing_id],
    ];
    optionalNumericFields.forEach(([key, value]) => {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        payloadBody[key] = numericValue;
      }
    });

    if (Array.isArray(req.body?.containers) && req.body.containers.length > 0) {
      payloadBody.containers = req.body.containers;
    }

    const [payload, references] = await Promise.all([
      pilotApiRequest({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
        path: "/bookings",
        method: "POST",
        body: payloadBody,
      }),
      loadPilotApiReferenceData(),
    ]);

    const booking = getPilotApiItem(payload);
    res.status(201).json({
      ok: true,
      booking: booking ? enrichPilotApiBooking(booking, references) : null,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to create Pilot API booking");
  }
});

app.delete("/api/pilot/bookings/:id", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const bookingId = encodeURIComponent(String(req.params.id || "").trim());
    const targetBookingId = Number(req.params.id || 0) || 0;
    if (!bookingId) {
      res.status(400).json({ ok: false, error: "Booking ID is required", code: "booking_id_required" });
      return;
    }

    const normalizedPilotId = Number(session?.user?.id || 0) || 0;
    const existingBookingsPayload = await pilotApiRequest({
      pilotId: normalizedPilotId,
      sessionUser: session.user || {},
      path: "/bookings?page[size]=100&sort=departure_time",
    }).catch(() => ({ data: [] }));
    const cascadeIds = computePilotBookingCascadeIds({
      bookings: getPilotApiCollectionItems(existingBookingsPayload),
      targetBookingId,
    });

    const cancelledBookingIds = [];
    for (const bookingNumericId of cascadeIds) {
      const normalizedId = Number(bookingNumericId || 0) || 0;
      if (normalizedId <= 0) {
        continue;
      }
      await pilotApiRequest({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
        path: `/bookings/${encodeURIComponent(String(normalizedId))}`,
        method: "DELETE",
      });
      cancelledBookingIds.push(normalizedId);
    }

    if (!cancelledBookingIds.includes(targetBookingId) && targetBookingId > 0) {
      await pilotApiRequest({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
        path: `/bookings/${bookingId}`,
        method: "DELETE",
      });
      cancelledBookingIds.unshift(targetBookingId);
    }

    res.json({
      ok: true,
      cancelledBookingIds,
      cancelledCount: cancelledBookingIds.length,
      cascadeCancelled: cancelledBookingIds.length > 1,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to cancel Pilot API booking");
  }
});

app.get("/api/pilot/bookings/:id/simbrief", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const bookingId = encodeURIComponent(String(req.params.id || "").trim());
    if (!bookingId) {
      res.status(400).json({ ok: false, error: "Booking ID is required", code: "booking_id_required" });
      return;
    }

    const payload = await pilotApiRequest({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: `/bookings/${bookingId}/simbrief`,
    });

    const normalized = normalizePilotSimbriefPayload(payload);
    res.json({ ok: true, ...normalized, canGenerate: true });
  } catch (error) {
    const status = Number(error?.status || 0) || 0;
    if (status === 404 || status === 422) {
      res.json({
        ok: true,
        available: false,
        url: null,
        html: null,
        raw: null,
        canGenerate: true,
        code: "simbrief_not_connected",
        message: "SimBrief is not linked for this booking.",
      });
      return;
    }
    respondWithPilotApiError(res, error, "Failed to load SimBrief OFP");
  }
});

app.put("/api/pilot/bookings/:id/simbrief", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const bookingId = encodeURIComponent(String(req.params.id || "").trim());
    if (!bookingId) {
      res.status(400).json({ ok: false, error: "Booking ID is required", code: "booking_id_required" });
      return;
    }

    const payload = await pilotApiRequest({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: `/bookings/${bookingId}/simbrief`,
      method: "PUT",
      body: {},
    });

    const normalized = normalizePilotSimbriefPayload(payload);
    res.json({ ok: true, ...normalized, canGenerate: true });
  } catch (error) {
    const status = Number(error?.status || 0) || 0;
    if (status === 404 || status === 422) {
      res.json({
        ok: true,
        available: false,
        url: null,
        html: null,
        raw: null,
        canGenerate: false,
        code: "simbrief_not_connected",
        message: "SimBrief is not linked for this booking.",
      });
      return;
    }
    respondWithPilotApiError(res, error, "Failed to refresh SimBrief OFP");
  }
});

app.post("/api/pilot/dispatch-url", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const routeId = Number(req.body?.routeId || req.body?.route_id || 0) || 0;
    if (routeId <= 0) {
      res.status(400).json({ ok: false, error: "route_id is required", code: "route_id_required" });
      return;
    }

    const payload = await pilotApiRequest({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: "/dispatch-url",
      method: "POST",
      body: {
        route_id: routeId,
      },
    });

    const dispatch = getPilotApiItem(payload) || {};
    res.json({
      ok: true,
      url: String(dispatch?.url || "").trim() || null,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to create Pilot API dispatch URL");
  }
});

app.get("/api/pilot/activities/registrations", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const registrations = await fetchPilotApiCollectionPages({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: "/activities/registrations?page[size]=100",
      maxPages: 6,
      pageSize: 100,
    });

    res.json({
      registrations: (Array.isArray(registrations) ? registrations : [])
        .map((item) => ({
          id: Number(item?.id || 0) || 0,
          activityId: Number(item?.activity_id || item?.activityId || 0) || 0,
          createdAt: String(item?.created_at || item?.createdAt || "").trim() || null,
        }))
        .filter((item) => item.id > 0 && item.activityId > 0),
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load Pilot API activity registrations");
  }
});

app.post("/api/pilot/activities/:id/register", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const activityId = Number(req.params.id || 0) || 0;
    if (activityId <= 0) {
      res.status(400).json({ ok: false, error: "Activity ID is required", code: "activity_id_required" });
      return;
    }

    const payload = await pilotApiRequest({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: `/activities/${encodeURIComponent(String(activityId))}/register`,
      method: "POST",
    });

    const registration = getPilotApiItem(payload) || {};
    res.status(201).json({
      ok: true,
      registration: {
        id: Number(registration?.id || 0) || 0,
        activityId: Number(registration?.activity_id || registration?.activityId || activityId) || activityId,
        createdAt: String(registration?.created_at || registration?.createdAt || "").trim() || null,
      },
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to register for activity");
  }
});

app.delete("/api/pilot/activities/registrations/:id", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const registrationId = Number(req.params.id || 0) || 0;
    if (registrationId <= 0) {
      res.status(400).json({ ok: false, error: "Registration ID is required", code: "registration_id_required" });
      return;
    }

    await pilotApiRequest({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: `/activities/registrations/${encodeURIComponent(String(registrationId))}`,
      method: "DELETE",
    });

    res.status(204).end();
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to unregister from activity");
  }
});

const normalizePilotActivityProgressSnapshot = (payload = {}, fallbackActivityId = 0) => {
  const node = getPilotApiItem(payload) || (payload && typeof payload === "object" ? payload : {});
  const legStatus = Array.isArray(node?.leg_status)
    ? node.leg_status
    : Array.isArray(node?.legStatus)
      ? node.legStatus
      : [];
  const legTotal = legStatus.length;
  const legCompleted = legStatus.filter((leg) => {
    const status = String(leg?.status || "").trim().toLowerCase();
    return ["completed", "complete", "done", "accepted"].includes(status);
  }).length;

  const explicitPercentCandidates = [
    Number(node?.progress_percentage),
    Number(node?.progressPercent),
    Number(node?.progress),
  ].filter((value) => Number.isFinite(value));
  const derivedPercent = legTotal > 0 ? Math.round((legCompleted / legTotal) * 100) : 0;
  const progressPercentRaw = explicitPercentCandidates.length > 0 ? explicitPercentCandidates[0] : derivedPercent;
  const progressPercent = Math.max(0, Math.min(100, Math.round(progressPercentRaw)));

  return {
    id: Number(node?.id || 0) || 0,
    activityId: Number(node?.activity_id || node?.activityId || fallbackActivityId || 0) || 0,
    status: String(node?.status || "not_started").trim() || "not_started",
    progressPercent,
    legCompleted,
    legTotal,
    contributionData:
      node?.contribution_data && typeof node.contribution_data === "object"
        ? node.contribution_data
        : node?.contributionData && typeof node.contributionData === "object"
          ? node.contributionData
          : null,
    updatedAt: String(node?.updated_at || node?.updatedAt || "").trim() || null,
    createdAt: String(node?.created_at || node?.createdAt || "").trim() || null,
  };
};

app.get("/api/pilot/activities/progress-widget", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const maxItems = Math.max(1, Math.min(8, Number(req.query.limit || 4) || 4));
    const [registrations, liveCatalog] = await Promise.all([
      fetchPilotApiCollectionPages({
        pilotId: Number(session?.user?.id || 0) || 0,
        sessionUser: session.user || {},
        path: "/activities/registrations?page[size]=100",
        maxPages: 6,
        pageSize: 100,
      }),
      loadAdminActivitiesCatalog().catch(() => ({ activities: [] })),
    ]);

    const registrationRows = (Array.isArray(registrations) ? registrations : [])
      .map((item) => ({
        registrationId: Number(item?.id || 0) || 0,
        activityId: Number(item?.activity_id || item?.activityId || 0) || 0,
        createdAt: String(item?.created_at || item?.createdAt || "").trim() || null,
      }))
      .filter((item) => item.registrationId > 0 && item.activityId > 0)
      .sort((left, right) => {
        const leftTime = Date.parse(String(left.createdAt || ""));
        const rightTime = Date.parse(String(right.createdAt || ""));
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      })
      .slice(0, maxItems);

    const activityMap = new Map(
      (Array.isArray(liveCatalog?.activities) ? liveCatalog.activities : [])
        .map((activity) => [Number(activity?.originalId || 0) || 0, activity])
        .filter(([id]) => id > 0)
    );

    const items = await Promise.all(
      registrationRows.map(async (registration) => {
        let progress = null;
        try {
          const progressPayload = await pilotApiRequest({
            pilotId: Number(session?.user?.id || 0) || 0,
            sessionUser: session.user || {},
            path: `/activities/${encodeURIComponent(String(registration.activityId))}/progress`,
          });
          progress = normalizePilotActivityProgressSnapshot(progressPayload, registration.activityId);
        } catch (error) {
          const status = Number(error?.status || 0) || 0;
          if (status !== 404) {
            throw error;
          }
          progress = {
            id: 0,
            activityId: registration.activityId,
            status: "not_started",
            progressPercent: 0,
            legCompleted: 0,
            legTotal: 0,
            contributionData: null,
            updatedAt: null,
            createdAt: null,
          };
        }

        const liveActivity = activityMap.get(registration.activityId) || null;
        return {
          registrationId: registration.registrationId,
          activityId: registration.activityId,
          activityTitle: String(liveActivity?.name || `Activity #${registration.activityId}`).trim(),
          activityType: String(liveActivity?.type || "Event").trim() || "Event",
          activityStart: String(liveActivity?.start || "").trim() || null,
          registeredAt: registration.createdAt,
          progress,
        };
      })
    );

    res.json({
      items,
      total: items.length,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load pilot activity progress widget");
  }
});

app.get("/api/pilot/claims", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const pageSize = Math.max(1, Math.min(50, Number(req.query["page[size]"] || 15) || 15));
    const cursor = String(req.query["page[cursor]"] || "").trim();
    const status = String(req.query["filter[status]"] || "").trim();
    const params = new URLSearchParams();
    params.set("page[size]", String(pageSize));
    if (cursor) {
      params.set("page[cursor]", cursor);
    }
    if (status) {
      params.set("filter[status]", status);
    }

    const [payload, airportsMap] = await Promise.all([
      pilotApiRequest({
        pilotId: Number(session?.user?.id || 0) || 0,
        sessionUser: session.user || {},
        path: `/claims?${params.toString()}`,
      }),
      loadAirportsLookup().catch(() => new Map()),
    ]);

    const claims = getPilotApiCollectionItems(payload)
      .map((item) => enrichPilotApiClaim(item, airportsMap))
      .sort((left, right) => {
        const leftTime = Date.parse(String(left?.createdAt || ""));
        const rightTime = Date.parse(String(right?.createdAt || ""));
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });

    res.json({
      claims,
      meta: payload?.meta || null,
      links: payload?.links || null,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load Pilot API claims");
  }
});

app.post("/api/pilot/claims", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const bookingId = Number(req.body?.bookingId || req.body?.booking_id || 0) || 0;
    const departureTime = String(req.body?.departureTime || req.body?.departure_time || "").trim();
    const arrivalTime = String(req.body?.arrivalTime || req.body?.arrival_time || "").trim();
    const message = String(req.body?.message || "").trim();
    const rawProof = Array.isArray(req.body?.proof)
      ? req.body.proof
      : Array.isArray(req.body?.proofLinks)
        ? req.body.proofLinks
        : [];

    const proof = rawProof
      .map((item) => {
        if (typeof item === "string") {
          const url = String(item).trim();
          return url ? { type: "link", url } : null;
        }

        if (!item || typeof item !== "object") {
          return null;
        }

        const type = String(item?.type || "link").trim().toLowerCase();
        if (type === "image") {
          const data = String(item?.data || "").trim();
          return data ? { type: "image", data } : null;
        }

        const url = String(item?.url || "").trim();
        return url ? { type: "link", url } : null;
      })
      .filter(Boolean)
      .slice(0, 5);

    if (bookingId <= 0 || !departureTime || !arrivalTime || !message || proof.length < 1) {
      res.status(400).json({
        ok: false,
        error: "booking_id, departure_time, arrival_time, message and 1-5 proof items are required",
        code: "claim_payload_invalid",
      });
      return;
    }

    const departureTimestamp = Date.parse(departureTime);
    const arrivalTimestamp = Date.parse(arrivalTime);
    if (
      Number.isFinite(departureTimestamp) &&
      Number.isFinite(arrivalTimestamp) &&
      arrivalTimestamp < departureTimestamp
    ) {
      res.status(400).json({
        ok: false,
        error: "arrival_time must be later than departure_time",
        code: "claim_time_invalid",
      });
      return;
    }

    const [payload, airportsMap] = await Promise.all([
      pilotApiRequest({
        pilotId: Number(session?.user?.id || 0) || 0,
        sessionUser: session.user || {},
        path: "/claims",
        method: "POST",
        body: {
          booking_id: bookingId,
          departure_time: departureTime,
          arrival_time: arrivalTime,
          message,
          proof,
        },
      }),
      loadAirportsLookup().catch(() => new Map()),
    ]);

    const claim = getPilotApiItem(payload);
    res.status(201).json({
      ok: true,
      claim: claim ? enrichPilotApiClaim(claim, airportsMap) : null,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to submit Pilot API claim");
  }
});

app.get("/api/pilot/pireps", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const pageSize = Math.max(1, Math.min(50, Number(req.query["page[size]"] || 10) || 10));
    const cursor = String(req.query["page[cursor]"] || "").trim();
    const sort = String(req.query.sort || "-created_at").trim() || "-created_at";
    const params = new URLSearchParams();
    params.set("page[size]", String(pageSize));
    params.set("sort", sort);
    if (cursor) {
      params.set("page[cursor]", cursor);
    }

    const [payload, references] = await Promise.all([
      pilotApiRequest({
        pilotId: Number(session?.user?.id || 0) || 0,
        sessionUser: session.user || {},
        path: `/pireps?${params.toString()}`,
      }),
      loadPilotApiReferenceData(),
    ]);

    res.json({
      pireps: getPilotApiCollectionItems(payload).map((item) => enrichPilotApiPirep(item, references)),
      meta: payload?.meta || null,
      links: payload?.links || null,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load Pilot API PIREPs");
  }
});

app.get("/api/pilot/pireps/:id", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const pirepId = Number(req.params.id || 0) || 0;
    const normalizedPilotId = Number(session?.user?.id || 0) || 0;
    if (pirepId <= 0) {
      res.status(400).json({ ok: false, error: "PIREP ID is required", code: "pirep_id_required" });
      return;
    }

    const [payload, references, flightMap, pilotApiProfile, pilotApiPositionsTrack] = await Promise.all([
      pilotApiRequest({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
        path: `/pireps/${encodeURIComponent(String(pirepId))}`,
      }),
      loadPilotApiReferenceData(),
      loadFlightMap().catch(() => ({ flights: [] })),
      fetchPilotApiPirepProfile({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
        pirepId,
      }).catch(() => null),
      fetchPilotApiPirepPositions({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
        pirepId,
      }).catch(() => []),
    ]);

    const rawPirep = getPilotApiItem(payload);
    if (!rawPirep) {
      res.status(404).json({ ok: false, error: "PIREP not found", code: "pirep_not_found" });
      return;
    }

    const enriched = enrichPilotApiPirep(rawPirep, references);
    const route = enriched.routeId ? references.routeIndex.get(enriched.routeId) || null : null;
    const aircraft = enriched.aircraftId ? references.aircraftIndex.get(enriched.aircraftId) || null : null;
    const departure = resolveAirportTelemetrySummary(references.airportsMap, rawPirep?.departure_id || route?.departureId);
    const arrival = resolveAirportTelemetrySummary(references.airportsMap, rawPirep?.arrival_id || route?.arrivalId);
    const liveMatch = resolvePirepFlightMapMatch({
      flights: Array.isArray(flightMap?.flights) ? flightMap.flights : [],
      pirep: rawPirep,
      enriched,
    });

    const cacheKey = buildPirepTelemetryCacheKey({ pirep: rawPirep, enriched, departure, arrival });
    const referenceIds = [rawPirep?.booking_id, enriched.bookingId, rawPirep?.booking?.id].filter(Boolean);
    const [pilotName, backfillTrack] = await Promise.all([
      resolvePilotNameFromPirep(rawPirep).catch(() => ""),
      referenceIds.length > 0
        ? getHistoricalTelemetryBackfill({
            cacheKey,
            referenceIds,
            waitForFetch: true,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const directTrack = extractLongestTelemetryTrack(payload);
      const telemetryTrack = mergeTelemetryTracks(liveMatch?.telemetryTrack, pilotApiPositionsTrack, backfillTrack, directTrack);
    const lastTelemetryPoint = telemetryTrack.length > 0 ? telemetryTrack[telemetryTrack.length - 1] : null;
    const currentLat = Number.isFinite(Number(liveMatch?.currentLat))
      ? Number(liveMatch.currentLat)
      : Number.isFinite(Number(lastTelemetryPoint?.lat))
        ? Number(lastTelemetryPoint.lat)
        : null;
    const currentLon = Number.isFinite(Number(liveMatch?.currentLon))
      ? Number(liveMatch.currentLon)
      : Number.isFinite(Number(lastTelemetryPoint?.lon))
        ? Number(lastTelemetryPoint.lon)
        : null;
    const heading = Number.isFinite(Number(liveMatch?.heading))
      ? Number(liveMatch.heading)
      : Number.isFinite(Number(lastTelemetryPoint?.heading))
        ? Number(lastTelemetryPoint.heading)
        : null;
    const altitude = Number.isFinite(Number(liveMatch?.altitude))
      ? Number(liveMatch.altitude)
      : Number.isFinite(Number(lastTelemetryPoint?.altitude))
        ? Number(lastTelemetryPoint.altitude)
        : null;
    const normalizedPirepStatus = String(rawPirep?.status || "").trim().toLowerCase();
    const isCompletedPirep =
      Boolean(rawPirep?.arrival_time || rawPirep?.in_time || enriched.completedAt) ||
      ["accepted", "auto_accepted", "approved", "completed"].includes(normalizedPirepStatus);
    const progress = deriveTelemetryProgress({
      currentLat,
      currentLon,
      departureLat: departure.latitude,
      departureLon: departure.longitude,
      arrivalLat: arrival.latitude,
      arrivalLon: arrival.longitude,
      fallback: isCompletedPirep ? 100 : liveMatch?.progress,
    });
    const comments = [
      rawPirep?.comments,
      rawPirep?.comment,
      rawPirep?.remarks,
      rawPirep?.notes,
      rawPirep?.message,
    ]
      .map((value) => String(value || "").trim())
      .find(Boolean) || null;
    const vac = inferVacCodeFromSources(
      route?.airlineCode,
      aircraft?.fleetCode,
      aircraft?.fleetName,
      enriched.flightNumber,
      enriched.callsign,
      rawPirep?.airline_code,
      rawPirep?.airline
    );

    res.json({
      pirep: {
        id: enriched.id,
        bookingId: enriched.bookingId,
        routeId: enriched.routeId,
        aircraftId: enriched.aircraftId,
        flightNumber: enriched.flightNumber,
        callsign: enriched.callsign,
        pilot: pilotName || String(session?.user?.name || session?.user?.username || "Pilot").trim() || "Pilot",
        pilotId: Number(rawPirep?.pilot_id || session?.user?.id || 0) || null,
        departure: enriched.departure,
        departureName: departure.name,
        departureLat: departure.latitude,
        departureLon: departure.longitude,
        arrival: enriched.arrival,
        arrivalName: arrival.name,
        arrivalLat: arrival.latitude,
        arrivalLon: arrival.longitude,
        aircraft: enriched.aircraft,
        aircraftModel: String(aircraft?.model || aircraft?.name || "").trim() || null,
        aircraftRegistration: String(aircraft?.registration || "").trim() || null,
        flightTime: enriched.duration,
        blockTime: enriched.blockTime,
        distance: enriched.distance,
        distanceNm: Number.isFinite(Number(rawPirep?.distance)) ? Number(rawPirep.distance) : null,
        landing: enriched.landing,
        landingRate: enriched.landingRate,
        status: enriched.status,
        network: enriched.network || String(liveMatch?.network || "").trim() || null,
        score: enriched.score,
        points: enriched.points,
        comments,
        createdAt: enriched.createdAt,
        completedAt: enriched.completedAt,
        departureTime: String(rawPirep?.departure_time || rawPirep?.out_time || "").trim() || null,
        arrivalTime: String(rawPirep?.arrival_time || rawPirep?.in_time || "").trim() || null,
        vac,
        progress,
        heading,
        speed: Number.isFinite(Number(liveMatch?.speed)) ? Number(liveMatch.speed) : null,
        altitude,
        currentLat,
        currentLon,
        hasLiveTelemetry: telemetryTrack.length >= 2 || (Number.isFinite(currentLat) && Number.isFinite(currentLon)),
        telemetryTrack,
        flightProfile: pilotApiProfile,
      },
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load Pilot API PIREP detail");
  }
});

app.post("/api/pilot/pireps/:id/comments", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const pirepId = Number(req.params.id || 0) || 0;
    const content = String(req.body?.content || "").trim();

    if (pirepId <= 0) {
      res.status(400).json({ ok: false, error: "PIREP ID is required", code: "pirep_id_required" });
      return;
    }

    if (!content) {
      res.status(400).json({ ok: false, error: "Comment content is required", code: "pirep_comment_required" });
      return;
    }

    if (content.length > 1000) {
      res.status(400).json({ ok: false, error: "Comment content is too long", code: "pirep_comment_too_long" });
      return;
    }

    const payload = await pilotApiRequest({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: `/pireps/${encodeURIComponent(String(pirepId))}/comments`,
      method: "POST",
      body: {
        content,
      },
    });

    res.status(201).json({
      ok: true,
      comment: getPilotApiItem(payload),
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to add PIREP comment");
  }
});

app.get("/api/pilot/statistics", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const payload = await pilotApiRequest({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: "/statistics",
    });

    const statistics = getPilotApiItem(payload) || {};
    res.json({
      statistics,
      summary: summarizePilotApiStatistics(statistics),
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load Pilot API statistics");
  }
});

app.patch("/api/pilot/location", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const rawAirportCode = String(req.body?.airportCode || req.body?.airport_code || req.body?.icao || "").trim();
    const numericAirportId = Number(req.body?.airportId || req.body?.airport_id || 0) || 0;
    let airportRecord = null;
    let airportId = null;

    if (rawAirportCode) {
      airportRecord = await findAirportSummaryByCode(rawAirportCode);
      airportId = Number(airportRecord?.id || 0) || 0;
      if (airportId <= 0) {
        res.status(400).json({ ok: false, error: "Unknown airport code", code: "airport_not_found" });
        return;
      }
    } else if (numericAirportId > 0) {
      airportId = numericAirportId;
      const airportsMap = await loadAirportsLookup();
      airportRecord = airportsMap.get(airportId) || null;
    }

    await pilotApiRequest({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      path: "/location",
      method: "PATCH",
      body: {
        airport_id: airportId > 0 ? airportId : null,
      },
    });

    await ensurePilotApiConnection({
      pilotId: Number(session?.user?.id || 0) || 0,
      sessionUser: session.user || {},
      forceProfileRefresh: true,
    }).catch(() => null);

    res.json({
      ok: true,
      airportId: airportId > 0 ? airportId : null,
      airportCode: String(airportRecord?.code || "").trim() || null,
      airportName: String(airportRecord?.name || "").trim() || null,
      locationLabel:
        airportRecord && airportId > 0
          ? `${String(airportRecord?.name || "").trim()} (${String(airportRecord?.code || "").trim()})`
          : null,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to update Pilot API location");
  }
});

app.get("/api/pilot/location", async (req, res) => {
  const session = requirePilotApiSession(req, res);
  if (!session) {
    return;
  }

  try {
    const pilotId = Number(session?.user?.id || 0) || 0;
    const connection = await ensurePilotApiConnection({
      pilotId,
      sessionUser: session.user || {},
      forceProfileRefresh: true,
    });

    const extracted = extractPilotApiProfile(connection?.profile || {}) || {};
    const airportsMap = await loadAirportsLookup().catch(() => new Map());
    const locationId = Number(connection?.profile?.location_id || connection?.profile?.locationId || 0) || 0;
    let airport = locationId > 0 ? airportsMap.get(locationId) || null : null;
    let locationLabel = String(extracted?.location || "").trim() || null;

    if (!airport && pilotId > 0) {
      try {
        const references = await loadPilotApiReferenceData();
        const bookingsPayload = await pilotApiRequest({
          pilotId,
          sessionUser: session.user || {},
          path: "/bookings?page[size]=10&sort=departure_time",
        });
        const detailedBookings = await loadDetailedPilotApiBookings({
          pilotId,
          sessionUser: session.user || {},
          bookings: getPilotApiCollectionItems(bookingsPayload),
          references,
        });

        const candidateBooking = (Array.isArray(detailedBookings) ? detailedBookings : []).find((booking) => {
          const status = String(booking?.status || "").trim().toLowerCase();
          return status === "upcoming" || status === "active";
        });

        const bookingAirportCode = String(candidateBooking?.departureCode || "").trim().toUpperCase();
        if (bookingAirportCode) {
          airport = await findAirportSummaryByCode(bookingAirportCode).catch(() => null);
          if (airport) {
            locationLabel = `${String(airport?.name || bookingAirportCode).trim()} (${bookingAirportCode})`;
          }
        }
      } catch {
        // ignore booking fallback failures
      }
    }

    if (!airport && pilotId > 0) {
      try {
        const recentFlights = await loadRecentFlights({ pilotId, limit: 1 });
        const latestFlight = Array.isArray(recentFlights?.flights) ? recentFlights.flights[0] || null : null;
        const arrivalCode = String(latestFlight?.arrivalIcao || latestFlight?.arrival || latestFlight?.destination || "").trim().toUpperCase();
        if (arrivalCode) {
          airport = await findAirportSummaryByCode(arrivalCode).catch(() => null);
          if (airport) {
            locationLabel = `${String(airport?.name || arrivalCode).trim()} (${arrivalCode})`;
          }
        }
      } catch {
        // ignore recent flight fallback failures
      }
    }

    res.json({
      ok: true,
      airportId: Number(airport?.id || locationId || 0) || null,
      airportCode: String(airport?.code || "").trim() || null,
      airportName: String(airport?.name || "").trim() || null,
      locationLabel,
    });
  } catch (error) {
    respondWithPilotApiError(res, error, "Failed to load Pilot API location");
  }
});

app.get("/api/pilot/preferences", async (req, res) => {
  const context = await resolveCurrentPilotContext(req).catch(() => null);
  if (!context?.pilotId && !context?.pilot?.username) {
    res.status(401).json({ ok: false, error: "Authentication required", code: "auth_required" });
    return;
  }

  let pilotApiPreferences = null;
  const session = getVamsysSessionFromRequest(req);
  const normalizedPilotId = Number(session?.user?.id || context?.pilotId || 0) || 0;

  if (session && isPilotApiConfigured() && normalizedPilotId > 0) {
    try {
      const connection = await ensurePilotApiConnection({
        pilotId: normalizedPilotId,
        sessionUser: session.user || {},
      });
      if (connection) {
        const profilePayload = await pilotApiRequest({
          pilotId: normalizedPilotId,
          sessionUser: session.user || {},
          path: "/profile",
        }).catch(() => null);
        const profileData = profilePayload ? getPilotApiItem(profilePayload) || {} : connection.profile || {};

        pilotApiPreferences = {
          connected: true,
          preferredNetwork: String(
            profileData?.preferred_network || connection?.profile?.preferred_network || ""
          ).trim() || "offline",
          sbPreferences: Array.isArray(profileData?.sb_preferences)
            ? profileData.sb_preferences.map((item) => String(item || "").trim()).filter(Boolean)
            : Array.isArray(connection?.profile?.sb_preferences)
              ? connection.profile.sb_preferences.map((item) => String(item || "").trim()).filter(Boolean)
              : [],
          useImperialUnits: Boolean(
            profileData?.use_imperial_units ?? connection?.profile?.use_imperial_units ?? false
          ),
        };
      }
    } catch {
      pilotApiPreferences = null;
    }
  }

  res.json({
    ok: true,
    preferences: getPilotPreferences(context.pilot),
    pilotApiPreferences,
  });
});

app.patch("/api/pilot/preferences", express.json(), async (req, res) => {
  const context = await resolveCurrentPilotContext(req).catch(() => null);
  if (!context?.pilotId && !context?.pilot?.username) {
    res.status(401).json({ ok: false, error: "Authentication required", code: "auth_required" });
    return;
  }

  const nextPreferences = setPilotPreferences(context.pilot, {
    notifications: {
      channels: req.body?.notifications?.channels,
      notificationTypes: req.body?.notifications?.notificationTypes,
    },
  });

  let pilotApiPreferences = null;
  const session = getVamsysSessionFromRequest(req);
  const normalizedPilotId = Number(session?.user?.id || context?.pilotId || 0) || 0;
  const hasPilotApiPayload =
    req.body &&
    typeof req.body === "object" &&
    (
      Object.prototype.hasOwnProperty.call(req.body, "preferredNetwork") ||
      Object.prototype.hasOwnProperty.call(req.body, "preferred_network") ||
      Object.prototype.hasOwnProperty.call(req.body, "sbPreferences") ||
      Object.prototype.hasOwnProperty.call(req.body, "sb_preferences") ||
      Object.prototype.hasOwnProperty.call(req.body, "useImperialUnits") ||
      Object.prototype.hasOwnProperty.call(req.body, "use_imperial_units")
    );

  if (hasPilotApiPayload) {
    if (!session || !isPilotApiConfigured() || normalizedPilotId <= 0) {
      res.status(409).json({
        ok: false,
        error: "Pilot API is not connected for this account.",
        code: "pilot_api_not_connected",
      });
      return;
    }

    const preferredNetwork = String(req.body?.preferredNetwork ?? req.body?.preferred_network ?? "").trim().toLowerCase();
    const sbPreferencesInput = Array.isArray(req.body?.sbPreferences)
      ? req.body.sbPreferences
      : Array.isArray(req.body?.sb_preferences)
        ? req.body.sb_preferences
        : [];
    const sbPreferences = sbPreferencesInput.map((item) => String(item || "").trim()).filter(Boolean);
    const pilotApiBody = {};

    if (Object.prototype.hasOwnProperty.call(req.body, "preferredNetwork") || Object.prototype.hasOwnProperty.call(req.body, "preferred_network")) {
      pilotApiBody.preferred_network = preferredNetwork || "offline";
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "sbPreferences") || Object.prototype.hasOwnProperty.call(req.body, "sb_preferences")) {
      pilotApiBody.sb_preferences = sbPreferences;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "useImperialUnits") || Object.prototype.hasOwnProperty.call(req.body, "use_imperial_units")) {
      pilotApiBody.use_imperial_units = Boolean(req.body?.useImperialUnits ?? req.body?.use_imperial_units);
    }

    await ensurePilotApiConnection({
      pilotId: normalizedPilotId,
      sessionUser: session.user || {},
    });

    await pilotApiRequest({
      pilotId: normalizedPilotId,
      sessionUser: session.user || {},
      path: "/preferences",
      method: "PATCH",
      body: pilotApiBody,
    });

    pilotApiPreferences = {
      connected: true,
      preferredNetwork: String(pilotApiBody.preferred_network || "offline"),
      sbPreferences,
      useImperialUnits: Boolean(pilotApiBody.use_imperial_units),
    };
  }

  res.json({ ok: true, preferences: nextPreferences, pilotApiPreferences });
});

app.get("/api/pilot/roster", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const filter = String(req.query.filter || "all").trim().toLowerCase();
    const roster = await loadPilotsRoster();
    const pilots = (Array.isArray(roster?.pilots) ? roster.pilots : []).map((pilot) => {
      const curatedMeta = getCuratedPilotMeta(pilot);
      return {
        ...pilot,
        isCurated: curatedMeta.isCurated,
        curatedNote: curatedMeta.note,
      };
    });

    res.json({
      ok: true,
      pilots: filter === "curated" ? pilots.filter((pilot) => pilot.isCurated) : pilots,
      curatedCount: pilots.filter((pilot) => pilot.isCurated).length,
      total: pilots.length,
    });
  } catch {
    res.status(502).json({ ok: false, error: "Failed to load pilot roster" });
  }
});

app.get("/api/pilot/tours", async (req, res) => {
  const context = await resolveCurrentPilotContext(req, { includeClaimsCount: true }).catch(() => null);
  if (!context?.pilotId && !context?.pilot?.username) {
    res.status(401).json({ ok: false, error: "Authentication required", code: "auth_required" });
    return;
  }

  res.json({
    ok: true,
    tours: computePilotToursProgress({
      pilot: context.pilot,
      claimsCount: context.claimsCount,
    }),
  });
});

app.get("/api/pilot/badges", async (req, res) => {
  const context = await resolveCurrentPilotContext(req, { includeClaimsCount: true }).catch(() => null);
  if (!context?.pilotId && !context?.pilot?.username) {
    res.status(401).json({ ok: false, error: "Authentication required", code: "auth_required" });
    return;
  }

  try {
    const badgeState = await syncPilotBadges({
      pilot: context.pilot,
      claimsCount: context.claimsCount,
    });
    res.json({
      ok: true,
      badges: badgeState.badges,
      newlyAwarded: badgeState.newlyAwarded,
    });
  } catch {
    res.status(502).json({ ok: false, error: "Failed to load pilot badges" });
  }
});

// Dev-only helper to seed a vAMSYS session for local testing
if (String(process.env.ENABLE_DEV_SESSIONS || "").toLowerCase() === "true") {
  app.post("/__dev/seed-vamsys-session", express.json(), (req, res) => {
    try {
      const payload = req.body || {};
      const sessionId = randomUUID();
      const sessionUser = payload.user || {
        id: String(payload.id || "99999"),
        username: String(payload.username || "devpilot"),
        name: String(payload.name || "Dev Pilot"),
        email: String(payload.email || "dev@example.com"),
        rank: String(payload.rank || "Member"),
        hours: Number(payload.hours || 0) || 0,
        flights: Number(payload.flights || 0) || 0,
        joinedAt: String(payload.joinedAt || new Date().toISOString()),
        avatar: String(payload.avatar || ""),
      };

      const accessToken = String(payload.accessToken || "dev-token");
      const seededEnrichedAt =
        payload?.forceRefresh === true
          ? 0
          : Number(payload?.enrichedAt || 0) || 0;

      vamsysSessionCache.set(sessionId, {
        user: sessionUser,
        accessToken,
        enrichedAt: seededEnrichedAt,
        expiresAt: Date.now() + VAMSYS_SESSION_TTL_MS,
      });

      persistAuthStore();

      res.setHeader("Set-Cookie", buildCookie(VAMSYS_SESSION_COOKIE, sessionId, VAMSYS_SESSION_TTL_MS / 1000));
      res.json({ ok: true, sessionId, user: sessionUser });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Dev-only helper: simulate the vAMSYS OAuth callback processing using a supplied profile.
  // This will run the same matching/enrichment logic and will append a new pilot to the
  // local roster if no operations/by-id/roster match is found (useful for testing).
  app.post("/__dev/simulate-vamsys-callback", express.json(), async (req, res) => {
    try {
      const payload = req.body || {};
      const profile = payload.profile || payload.user || payload || {};

      const resolvedProfile = { ...(profile && typeof profile === 'object' ? profile : {}) };
      const identity = extractOauthIdentity(resolvedProfile);

      const sessionUser = {
        id: String(identity.id || identity.sub || identity.pilot_id || identity.uid || "vamsys-sim"),
        username: String(identity.username || identity.preferred_username || identity.callsign || "simpilot"),
        name: String(identity.name || identity.username || "Sim Pilot").trim(),
        email: String(identity.email || "").trim(),
        rank: String(identity.rank || "Member"),
        hours: Number(identity.hours || 0) || 0,
        flights: Number(identity.flights || 0) || 0,
        joinedAt: String(identity.joinedAt || new Date().toISOString()),
      };

      // Ensure roster is fresh for the test
      try {
        await loadPilotsRoster({ force: true });
      } catch (e) {
        // ignore
      }

      // Try operations match
      const operationsMatch = await resolveOperationsPilotFromProfile(resolvedProfile).catch(() => null);
      if (operationsMatch?.pilot) {
        return res.json({ ok: true, action: "matched_operations", matchType: operationsMatch.matchType, pilot: operationsMatch.pilot });
      }

      // Try by-id
      const byId = await loadPilotProfileById(sessionUser.id).catch(() => null);
      if (byId) {
        return res.json({ ok: true, action: "matched_by_id", pilot: byId });
      }

      // Try roster lookup
      const rosterMatch = await findPilotInRoster({ id: sessionUser.id, username: sessionUser.username, email: sessionUser.email, name: sessionUser.name }).catch(() => null);
      if (rosterMatch) {
        return res.json({ ok: true, action: "matched_roster", pilot: rosterMatch });
      }

      // Otherwise append new pilot to roster (same logic as callback)
      try {
        const usernameIsPlaceholder = isPlaceholderPilotUsername(sessionUser.username);
        const nameIsPlaceholder = isPlaceholderPilotName(sessionUser.name);

        if (usernameIsPlaceholder || nameIsPlaceholder) {
          return res.json({ ok: true, action: "skipped_placeholder", username: sessionUser.username, name: sessionUser.name });
        }

        const roster = (pilotsRosterCache && pilotsRosterCache.data) ? pilotsRosterCache.data : { pilots: [] };
        roster.pilots = Array.isArray(roster.pilots) ? roster.pilots : [];

        const already = roster.pilots.find((p) => {
          return (
            (p && p.username && normalizeMatchValue(p.username) === normalizeMatchValue(sessionUser.username)) ||
            (p && p.email && normalizeMatchValue(p.email) === normalizeMatchValue(sessionUser.email))
          );
        });

        if (already) {
          return res.json({ ok: true, action: "already_in_roster", pilot: already });
        }

        const newEntry = {
          id: Number(sessionUser.id) || null,
          username: String(sessionUser.username || "").trim(),
          name: String(sessionUser.name || "").trim(),
          email: String(sessionUser.email || "").trim(),
          rank: String(sessionUser.rank || "").trim(),
          hours: Number(sessionUser.hours || 0) || 0,
          flights: Number(sessionUser.flights || 0) || 0,
          status: "active",
          joinedAt: String(sessionUser.joinedAt || new Date().toISOString()),
        };

        roster.pilots.push(newEntry);
        pilotsRosterCache = { data: roster, expiresAt: Date.now() + 5 * 60 * 1000 };
        try { persistPilotsRoster(); } catch (e) {}

        logVamsys("info", "dev_sim_new_pilot_added", { username: newEntry.username, id: newEntry.id });
        return res.json({ ok: true, action: "added", pilot: newEntry });
      } catch (e) {
        return res.status(500).json({ ok: false, error: String(e) });
      }
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });
}

// Endpoint used by the frontend to look up the current pilot roster from vAMSYS.
// The result is cached for a few minutes by loadPilotsRoster(); callers can hit this
// endpoint to obtain a quick view of staff/members.  The route accepts the same
// parameters as the /api/auth/vamsys/me endpoints and will refresh cache when
// the session is valid.
app.get(["/api/auth/vamsys/roster-me", "/api/auth/vamsys/roster_me"], async (req, res) => {
  const session = getVamsysSessionFromRequest(req);
  if (!session) {
    res.setHeader("Set-Cookie", clearCookie(VAMSYS_SESSION_COOKIE));
    res.status(401).json({ authenticated: false });
    return;
  }

  try {
    const accessToken = String(session.accessToken || "").trim();
    let probe = { ...(session.user || {}) };

    if (accessToken) {
      const claims = decodeJwtPayload(accessToken) || {};
      const profile = await fetchVamsysOAuthProfile(accessToken);
      probe = {
        ...(claims && typeof claims === "object" ? claims : {}),
        ...(profile && typeof profile === "object" ? profile : {}),
        ...probe,
      };
    }

    const identity = extractOauthIdentity(probe);
    const lookupId = firstNonEmptyString(identity.id, session.user?.id);
    const lookupUsername = firstNonEmptyString(identity.username, session.user?.username);
    const lookupEmail = firstNonEmptyString(identity.email, session.user?.email);
    const lookupName = firstNonEmptyString(identity.name, session.user?.name);

    // If there's a manual stored link for this session, return it immediately
    const storedLink = findStoredVamsysLink(session.user || {});
    if (storedLink) {
      res.json({
        ok: true,
        user: {
          id: String(storedLink?.id || lookupId || ""),
          username: String(storedLink?.username || lookupUsername || ""),
          name: String(storedLink?.name || lookupName || ""),
          email: String(storedLink?.email || lookupEmail || ""),
          rank: String(storedLink?.rank || "Member"),
          hours: Number(storedLink?.hours || 0) || 0,
          flights: Number(storedLink?.flights || 0) || 0,
          joinedAt: String(storedLink?.joinedAt || ""),
        },
      });
      return;
    }

    let resolved = await findPilotInRoster({
      id: lookupId,
      username: lookupUsername,
      email: lookupEmail,
      name: lookupName,
    });

    if (!resolved) {
      const byId = await loadPilotProfileById(lookupId);
      if (byId) {
        resolved = {
          id: byId.id,
          username: byId.username,
          name: byId.name,
          email: byId.email,
          rank: byId.rank,
          hours: byId.hours,
          flights: byId.flights,
          joinedAt: byId.joinedAt,
        };
      }
    }

    if (!resolved) {
      res.status(404).json({ error: "pilot_not_found" });
      return;
    }

    res.json({
      ok: true,
      user: {
        id: String(resolved?.id || ""),
        username: String(resolved?.username || ""),
        name: String(resolved?.name || ""),
        email: String(resolved?.email || ""),
        rank: String(resolved?.rank || "Member"),
        hours: Number(resolved?.hours || 0) || 0,
        flights: Number(resolved?.flights || 0) || 0,
        joinedAt: String(resolved?.joinedAt || ""),
      },
    });
  } catch {
    res.status(500).json({ error: "resolve_failed" });
  }
});

// New helper endpoint: return the full, live list of pilots from vAMSYS operations API.
// This is equivalent to `curl https://<host>/api/v3/operations/pilots` with
// the service's client_credentials token.  It can be used for diagnostics or to
// build an up-to-date roster without waiting for the local cache.
app.get("/api/vamsys/pilots", async (req, res) => {
  try {
    // forward any querystring parameters (filter, page, etc.) to the API
    const qs = req.url.split("?")[1] || "";
    const path = qs ? `/pilots?${qs}` : "/pilots";
    const data = await fetchAllPages(`${path}`);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Search for a pilot by id, username, email or name.
// Query parameter: `q` (required) - search term (id or text)
app.get("/api/vamsys/search", async (req, res) => {
  try {
    // Ensure we have a fresh copy of the pilots roster from operations API
    try {
      await loadPilotsRoster({ force: true });
    } catch (e) {
      // Log but don't fail the whole request; continue with cached data if available
      logVamsys && logVamsys('warn', 'roster_refresh_failed', { error: String(e) });
    }
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.status(400).json({ ok: false, error: "q_required" });
      return;
    }

    // Try numeric id lookup first
    const idNum = Number(q);
    if (Number.isFinite(idNum) && idNum > 0) {
      const profile = await loadPilotProfileById(idNum);
      if (profile) {
        res.json({ ok: true, method: "id", pilot: profile });
        return;
      }
    }
    // Prefer official operations API filters where possible (documented).
    try {
      // Try operations API filter by username
      const byUsername = await apiFetch(`/pilots?filter[username]=${encodeURIComponent(q)}&page[size]=1`).catch(() => null);
      if (byUsername && Array.isArray(byUsername?.data) && byUsername.data.length) {
        const node = byUsername.data[0];
        const pilot = node && node.id && (node.attributes || node.relationships) ? flattenJsonApiNode(node) : node;
        res.json({ ok: true, method: "operations_filter_username", pilot });
        return;
      }

      // Try operations API filter by user_id (some installs expose user_id)
      const byUserId = await apiFetch(`/pilots?filter[user_id]=${encodeURIComponent(q)}&page[size]=1`).catch(() => null);
      if (byUserId && Array.isArray(byUserId?.data) && byUserId.data.length) {
        const node = byUserId.data[0];
        const pilot = node && node.id && (node.attributes || node.relationships) ? flattenJsonApiNode(node) : node;
        res.json({ ok: true, method: "operations_filter_user_id", pilot });
        return;
      }

      // Try operations API filter by discord_id (used elsewhere in code)
      const byDiscord = await apiFetch(`/pilots?filter[discord_id]=${encodeURIComponent(q)}&page[size]=1`).catch(() => null);
      if (byDiscord && Array.isArray(byDiscord?.data) && byDiscord.data.length) {
        const node = byDiscord.data[0];
        const pilot = node && node.id && (node.attributes || node.relationships) ? flattenJsonApiNode(node) : node;
        res.json({ ok: true, method: "operations_filter_discord_id", pilot });
        return;
      }

      // Try exact roster cached lookup
      const rosterExact = await findPilotInRoster({ username: q, email: q, name: q });
      if (rosterExact) {
        res.json({ ok: true, method: "roster_exact", pilot: rosterExact });
        return;
      }

      // If name/email partial match needed, fallback to cached roster fuzzy search
      const roster = await loadPilotsRoster().catch(() => null);
      if (roster && Array.isArray(roster.pilots)) {
        const lower = q.toLowerCase();
        const fuzzy = roster.pilots.find((p) => {
          const hay = `${String(p?.username || "")} ${String(p?.name || "")} ${String(p?.email || "")}`.toLowerCase();
          return hay.includes(lower);
        });
        if (fuzzy) {
          res.json({ ok: true, method: "roster_fuzzy", pilot: fuzzy });
          return;
        }
      }

      // Last-resort: perform live scan of operations pilots list (may be heavy)
      const all = await fetchAllPages("/pilots?page[size]=300").catch(() => null);
      if (Array.isArray(all)) {
        const lower = q.toLowerCase();
        const candidate = all.find((p) => {
          const username = String(p?.username || "").toLowerCase();
          const name = String(p?.name || "").toLowerCase();
          const email = String(p?.email || "").toLowerCase();
          return username.includes(lower) || name.includes(lower) || email.includes(lower);
        });
        if (candidate) {
          const normalized = {
            id: Number(candidate?.id || 0) || null,
            username: String(candidate?.username || "").trim(),
            name: String(candidate?.name || "").trim(),
            email: String(candidate?.email || "").trim(),
            rank: String(candidate?.rank?.name || candidate?.rank_name || "").trim(),
            hours: Number(candidate?.hours || candidate?.total_hours || 0) || 0,
            flights: Number(candidate?.flights || candidate?.total_flights || 0) || 0,
            joinedAt: String(candidate?.created_at || candidate?.joined_at || "").trim(),
          };
          res.json({ ok: true, method: "live_scan", pilot: normalized });
          return;
        }
      }

      res.status(404).json({ ok: false, error: "pilot_not_found" });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Endpoint to force-refresh pilots roster and return a report describing how it was obtained.
app.get("/api/vamsys/roster-refresh", async (req, res) => {
  const startedAt = Date.now();
  try {
    const usedAuth = API_TOKEN ? "static_token" : "client_credentials";
    const tokenMask = API_TOKEN ? (String(API_TOKEN).slice(0, 8) + '...') : (String(tokenCache.accessToken || '').slice(0, 8) ? `${String(tokenCache.accessToken || '').slice(0, 8)}...` : null);

    // Force reload roster (pilots + ranks) and persist to disk
    const roster = await loadPilotsRoster({ force: true });
    const count = Array.isArray(roster?.pilots) ? roster.pilots.length : 0;

    const durationMs = Date.now() - startedAt;
    const report = {
      ok: true,
      timestamp: new Date(startedAt).toISOString(),
      durationMs,
      method: "operations_api_roster_fetch",
      auth: {
        usedAuth,
        tokenMask: tokenMask || null,
      },
      pilotsCount: count,
      savedTo: PILOTS_ROSTER_FILE,
    };

    // log a structured event for diagnostics
    logVamsys && logVamsys("info", "roster_refresh_completed", { pilotsCount: count, durationMs, usedAuth });

    res.json(report);
  } catch (err) {
    logVamsys && logVamsys("error", "roster_refresh_failed", { error: String(err) });
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Unified auth endpoint: prefer vAMSYS identity, fall back to Discord identity
app.get("/api/auth/me", async (req, res) => {
  try {
    const vamsysSession = getVamsysSessionFromRequest(req);
    const discordSession = getDiscordSessionFromRequest(req);

    if (!vamsysSession && !discordSession) {
      // clear any stale cookies from both providers
      res.setHeader("Set-Cookie", [clearCookie(VAMSYS_SESSION_COOKIE), clearCookie(DISCORD_SESSION_COOKIE)]);
      res.status(401).json({ authenticated: false });
      return;
    }

    let provider = null;
    let user = null;
    let isAdmin = false;
    let role = null;

    if (vamsysSession) {
      provider = "vamsys";
      user = vamsysSession.user || null;
      isAdmin = isVamsysAdmin(user || {});
      role = isAdmin ? "admin" : "member";
    }

    if (!provider && discordSession) {
      provider = "discord";
      user = discordSession.user || null;
      isAdmin = false;
      role = "member";
    }

    // If both sessions exist: prefer vAMSYS identity and admin determination.
    if (vamsysSession && discordSession) {
      user = vamsysSession.user || discordSession.user || null;
      if (isVamsysAdmin(vamsysSession.user || {})) {
        isAdmin = true;
        role = "admin";
      } else {
        isAdmin = false;
        role = "member";
      }
    }

    res.json({
      authenticated: true,
      provider: provider || "unknown",
      isAdmin: Boolean(isAdmin),
      role: role || (provider === "vamsys" ? "member" : null),
      user: user || null,
    });
  } catch (error) {
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/api/auth/vamsys/logout", (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie || "");
  const sessionId = cookies[VAMSYS_SESSION_COOKIE] || "";
  const session = sessionId ? vamsysSessionCache.get(sessionId) || null : null;
  if (sessionId) {
    vamsysSessionCache.delete(sessionId);
    persistAuthStore();
  }
  recordAuthActivity({
    req,
    provider: "vamsys",
    type: "logout",
    outcome: "success",
    message: "vAMSYS logout",
    actor: createAuthActivityActor({ provider: "vamsys", user: session?.user || null }),
  });
  res.setHeader("Set-Cookie", clearCookie(VAMSYS_SESSION_COOKIE));
  res.json({ ok: true });
});

const requireAdmin = (req, res, next) => {
  const vamsysSession = getVamsysSessionFromRequest(req);
  const hasVamsysAdmin = Boolean(vamsysSession && isVamsysAdmin(vamsysSession?.user || {}));

  if (!hasVamsysAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  req.adminUser = vamsysSession.user;
  next();
};

const hasBootstrapAccess = (req) => {
  if (!ADMIN_BOOTSTRAP_TOKEN) {
    return false;
  }
  const token = String(req.headers["x-admin-bootstrap-token"] || "");
  return token && token === ADMIN_BOOTSTRAP_TOKEN;
};

app.get("/api/auth/vamsys/debug-me", async (req, res) => {
  const vamsysSession = getVamsysSessionFromRequest(req);
  const bootstrap = hasBootstrapAccess(req);
  if (!vamsysSession && !bootstrap) {
    res.status(401).json({ error: "No active vAMSYS session" });
    return;
  }

  let user = vamsysSession?.user || null;

  // If we have a real vAMSYS session, try to enrich that user object
  if (user) {
    try {
      const pilotId = Number(user?.id || user?.pilot_id || user?.account_id || 0) || 0;
      if (pilotId) {
        const profile = await loadPilotProfileById(pilotId);
        if (profile) {
          user.id = String(profile.id || user.id || pilotId);
          user.username = user.username || profile.username || user.username;
          user.name = user.name || profile.name || user.name;
          user.email = user.email || profile.email || user.email;
          user.rank = user.rank || profile.rank || user.rank;
          user.hours = Number(profile.hours || user.hours || 0) || 0;
          user.flights = Number(profile.flights || user.flights || 0) || 0;
          user.joinedAt = user.joinedAt || profile.joinedAt || user.joinedAt;
        }
      }
    } catch (e) {
      try { logger?.warn && logger.warn('[auth-me] profile_enrich_failed', { error: String(e) }); } catch (_) {}
    }
  } else if (bootstrap) {
    // No vAMSYS session but admin bootstrap access — allow fetching a pilot profile by id
    const pilotIdQuery = Number(req.query.pilotId || req.query.id || 0) || 0;
    if (pilotIdQuery) {
      try {
        const profile = await loadPilotProfileById(pilotIdQuery);
        if (profile) {
          user = {
            id: String(profile.id || pilotIdQuery),
            username: profile.username || '',
            name: profile.name || '',
            email: profile.email || '',
            rank: profile.rank || '',
            hours: Number(profile.hours || 0) || 0,
            flights: Number(profile.flights || 0) || 0,
            joinedAt: profile.joinedAt || '',
          };
        }
      } catch (e) {
        try { logger?.warn && logger.warn('[auth-me] bootstrap_profile_fetch_failed', { error: String(e), pilotId: pilotIdQuery }); } catch (_) {}
      }
    }
  }

  const discordSession = getDiscordSessionFromRequest(req);
  const discordId = String(discordSession?.user?.id || "");
  const actorIsAdmin = Boolean(discordSession && isDiscordAdmin(discordId));
  // reuse earlier `bootstrap` value from above

  if (!actorIsAdmin && !bootstrap) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  try {
    const accessToken = String(vamsysSession?.accessToken || "").trim();
    const claims = accessToken ? decodeJwtPayload(accessToken) : null;
    const retriedProfile = accessToken ? await fetchVamsysOAuthProfile(accessToken) : null;

    const mergedProfile = {
      ...(claims && typeof claims === "object" ? claims : {}),
      ...(retriedProfile && typeof retriedProfile === "object" ? retriedProfile : {}),
    };

    const extracted = extractOauthIdentity(mergedProfile);
    const operationsMatch = await resolveOperationsPilotFromProfile(mergedProfile);
    const byIdProfile = await loadPilotProfileById(firstNonEmptyString(extracted.id, vamsysSession?.user?.id));
    const rosterMatch = await findPilotInRoster({
      id: firstNonEmptyString(extracted.id, vamsysSession?.user?.id),
      username: firstNonEmptyString(extracted.username, vamsysSession?.user?.username),
      email: firstNonEmptyString(extracted.email, vamsysSession?.user?.email),
      name: firstNonEmptyString(extracted.name, vamsysSession?.user?.name),
    });

    const claimSubset = claims
      ? {
          id: claims?.id || claims?.pilot_id || claims?.sub || null,
          username: claims?.username || claims?.preferred_username || null,
          firstName: claims?.first_name || claims?.given_name || null,
          lastName: claims?.last_name || claims?.family_name || null,
          name: claims?.name || null,
          email: claims?.email || null,
        }
      : null;

    res.json({
      ok: true,
      actor: {
        via: bootstrap ? "bootstrap-token" : "discord-admin",
        discordId: discordId || null,
      },
      sessionUser: vamsysSession?.user || user || null,
      diagnostics: {
        hasAccessToken: Boolean(accessToken),
        claims: claimSubset,
        extracted,
      },
      matches: {
        operations: operationsMatch
          ? {
              matchType: operationsMatch.matchType,
              pilot: operationsMatch.pilot,
            }
          : null,
        byIdProfile,
        roster: rosterMatch,
      },
      retriedProfile,
    });
  } catch (error) {
    res.status(500).json({
      error: "debug_failed",
      message: error instanceof Error ? error.message : String(error || "unknown_error"),
    });
  }
});

// Probe vAMSYS candidate endpoints with the current session access token
app.get("/api/auth/vamsys/probe-endpoints", async (req, res) => {
  const session = getVamsysSessionFromRequest(req);
  if (!session) {
    res.setHeader("Set-Cookie", clearCookie(VAMSYS_SESSION_COOKIE));
    res.status(401).json({ authenticated: false });
    return;
  }

  const accessToken = String(session.accessToken || "").trim();
  if (!accessToken) {
    res.status(400).json({ error: "no_access_token" });
    return;
  }

  const candidates = [
    "https://vamsys.io/api/v3/account",
    "https://vamsys.io/api/v3/user",
    "https://vamsys.io/api/v3/pilot",
    "https://vamsys.io/api/v3/pilots/me",
    "https://vamsys.io/api/v3/operations/pilot",
    "https://vamsys.io/api/v3/operations/pilots/me",
    "https://vamsys.io/api/account",
    "https://vamsys.io/api/user",
    "https://vamsys.io/api/me",
    "https://vamsys.io/oauth/userinfo",
  ];

  const results = [];

  for (const endpoint of candidates) {
    try {
      const startedAt = Date.now();
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const text = await response.text().catch(() => "");
      results.push({
        endpoint,
        ok: Boolean(response.ok),
        status: response.status,
        durationMs: Date.now() - startedAt,
        bodySnippet: String(text || "").slice(0, 2000),
      });
    } catch (err) {
      results.push({ endpoint, ok: false, status: null, durationMs: 0, error: String(err) });
    }
  }

  res.json({ ok: true, results });
});


app.get("/api/admin/access/me", (req, res) => {
  const session = getDiscordSessionFromRequest(req);
  const isAdmin = isDiscordSessionAdmin(session);
  const role = getDiscordSessionRole(session);

  if (!session) {
    res.status(401).json({ authenticated: false, isAdmin: false });
    return;
  }

  res.json({
    authenticated: true,
    isAdmin,
    role,
    user: session.user,
  });
});

app.get("/api/admin/access/list", requireAdmin, (_req, res) => {
  const admins = Array.from(adminUsersCache.values());
  res.json({ admins });
});

app.post("/api/admin/access/grant", (req, res) => {
  const session = getDiscordSessionFromRequest(req);
  const actorIsAdmin = isDiscordSessionAdmin(session);
  const bootstrap = hasBootstrapAccess(req);
  const actorId = String(session?.user?.id || "").trim();

  if (!actorIsAdmin && !bootstrap) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const discordId = String(req.body?.discordId || "").trim();
  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "").trim();
  const role = String(req.body?.role || "admin").trim().toLowerCase();

  if (!discordId) {
    res.status(400).json({ error: "discordId is required" });
    return;
  }

  setAdminUser({
    discordId,
    username,
    email,
    linkedBy: bootstrap ? "bootstrap-token" : actorId,
    role: role === "staff" ? "staff" : "admin",
  });

  res.json({ ok: true });
});

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

const getManagedDiscordGuildId = () =>
  normalizeAdminText(getDiscordBotSettingsStore()?.monitoredGuildId || process.env.DISCORD_GUILD_ID || "") || "";

const getManagedDiscordAdminRoleIds = () => {
  const configured = getDiscordBotSettingsStore()?.adminRoleIds;
  return Array.isArray(configured)
    ? configured.map((item) => normalizeAdminText(item)).filter(Boolean)
    : [];
};

const discordApiRequest = async (path, init = {}) => {
  if (!DISCORD_BOT_TOKEN) {
    throw new Error("Discord bot token is not configured");
  }

  const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    body: init.body,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Discord API request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json().catch(() => null);
};

const sortDiscordRoleEntries = (roles = []) =>
  [...(Array.isArray(roles) ? roles : [])].sort((left, right) => {
    const positionDiff = (Number(right?.position || 0) || 0) - (Number(left?.position || 0) || 0);
    if (positionDiff !== 0) {
      return positionDiff;
    }
    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });

const serializeDiscordRole = (role, selectedIds = new Set()) => ({
  id: String(role?.id || "").trim(),
  name: String(role?.name || "").trim() || "Role",
  color: String(role?.color ? `#${Number(role.color).toString(16).padStart(6, "0")}` : "#99AAB5"),
  position: Number(role?.position || 0) || 0,
  managed: Boolean(role?.managed),
  mentionable: Boolean(role?.mentionable),
  selected: selectedIds.has(String(role?.id || "").trim()),
});

const serializeDiscordChannel = (channel) => ({
  id: String(channel?.id || "").trim(),
  name: String(channel?.name || "").trim() || "channel",
  type: Number(channel?.type || 0) || 0,
  parentId: String(channel?.parent_id || "").trim() || null,
});

const serializeDiscordGuildMember = (member, roleLookup = new Map()) => {
  const user = member?.user && typeof member.user === "object" ? member.user : {};
  const roleIds = Array.isArray(member?.roles) ? member.roles.map((item) => String(item || "").trim()).filter(Boolean) : [];
  return {
    discordId: String(user?.id || "").trim(),
    username: String(user?.username || "").trim() || "discord-user",
    discriminator: String(user?.discriminator || "").trim() || null,
    globalName: String(user?.global_name || "").trim() || null,
    avatarUrl: user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null,
    nick: String(member?.nick || "").trim() || null,
    roleIds,
    roles: roleIds
      .map((roleId) => roleLookup.get(roleId))
      .filter(Boolean)
      .map((role) => ({ id: role.id, name: role.name, color: role.color })),
  };
};

app.get("/api/public/discord-widget", async (_req, res) => {
  const guildId = getManagedDiscordGuildId();
  const inviteUrl = normalizeAdminText(process.env.DISCORD_INVITE_URL || "https://discord.gg/nordwind") || "https://discord.gg/nordwind";

  if (!guildId) {
    res.json({
      configured: false,
      guildId: null,
      inviteUrl,
      widgetUrl: null,
      guild: null,
    });
    return;
  }

  let guild = null;
  try {
    if (DISCORD_BOT_TOKEN) {
      const guildPayload = await discordApiRequest(`/guilds/${encodeURIComponent(guildId)}?with_counts=true`);
      guild = {
        id: String(guildPayload?.id || guildId),
        name: String(guildPayload?.name || "Discord Server"),
        iconUrl: guildPayload?.icon
          ? `https://cdn.discordapp.com/icons/${guildPayload.id}/${guildPayload.icon}.png?size=128`
          : null,
        approximateMemberCount: Number(guildPayload?.approximate_member_count || 0) || null,
      };
    }
  } catch {
    guild = null;
  }

  res.json({
    configured: true,
    guildId,
    inviteUrl,
    widgetUrl: `https://discord.com/widget?id=${encodeURIComponent(guildId)}&theme=light`,
    guild,
  });
});

app.get("/api/admin/discord-bot/guild", requireAdmin, async (_req, res) => {
  try {
    const guildId = getManagedDiscordGuildId();
    if (!guildId) {
      res.json({
        configured: false,
        guild: null,
        roles: [],
        channels: [],
        adminUsers: Array.from(adminUsersCache.values()),
      });
      return;
    }

    const [guild, rolesPayload, channelsPayload] = await Promise.all([
      discordApiRequest(`/guilds/${encodeURIComponent(guildId)}`),
      discordApiRequest(`/guilds/${encodeURIComponent(guildId)}/roles`),
      discordApiRequest(`/guilds/${encodeURIComponent(guildId)}/channels`),
    ]);

    const selectedRoleIds = new Set(getManagedDiscordAdminRoleIds());
    const roles = sortDiscordRoleEntries(rolesPayload)
      .filter((role) => !role?.managed || String(role?.name || "").trim() !== "@everyone")
      .map((role) => serializeDiscordRole(role, selectedRoleIds));

    const channels = (Array.isArray(channelsPayload) ? channelsPayload : [])
      .filter((channel) => [0, 2, 4, 5, 10, 11, 12, 15].includes(Number(channel?.type)))
      .map((channel) => serializeDiscordChannel(channel));

    res.json({
      configured: true,
      guild: {
        id: String(guild?.id || guildId),
        name: String(guild?.name || "Discord Server"),
        iconUrl: guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null,
        approximateMemberCount: Number(guild?.approximate_member_count || 0) || null,
      },
      roles,
      channels,
      adminRoleIds: Array.from(selectedRoleIds),
      adminUsers: Array.from(adminUsersCache.values()),
    });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || error || "Failed to load Discord guild") });
  }
});

app.get("/api/admin/discord-bot/members", requireAdmin, async (req, res) => {
  try {
    const guildId = getManagedDiscordGuildId();
    if (!guildId) {
      res.status(400).json({ error: "Monitored guild is not configured" });
      return;
    }

    const query = normalizeAdminText(req.query.query || "");
    if (query.length < 2) {
      res.json({ members: [] });
      return;
    }

    const [rolesPayload, membersPayload] = await Promise.all([
      discordApiRequest(`/guilds/${encodeURIComponent(guildId)}/roles`),
      discordApiRequest(
        `/guilds/${encodeURIComponent(guildId)}/members/search?query=${encodeURIComponent(query)}&limit=20`
      ),
    ]);

    const selectedRoleIds = new Set(getManagedDiscordAdminRoleIds());
    const roleLookup = new Map(
      sortDiscordRoleEntries(rolesPayload).map((role) => [
        String(role?.id || "").trim(),
        serializeDiscordRole(role, selectedRoleIds),
      ])
    );

    const members = (Array.isArray(membersPayload) ? membersPayload : [])
      .map((member) => serializeDiscordGuildMember(member, roleLookup))
      .filter((member) => member.discordId);

    res.json({ members });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || error || "Failed to search Discord members") });
  }
});

app.post("/api/admin/access/revoke", (req, res) => {
  const session = getDiscordSessionFromRequest(req);
  const actorIsAdmin = isDiscordSessionAdmin(session);
  const bootstrap = hasBootstrapAccess(req);

  if (!actorIsAdmin && !bootstrap) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const discordId = String(req.body?.discordId || "").trim();
  if (!discordId) {
    res.status(400).json({ error: "discordId is required" });
    return;
  }

  removeAdminUser(discordId);
  res.json({ ok: true });
});

const DISCORD_NOTIFICATION_CHANNEL_BY_EVENT = {
  bookingCreated: "bookings",
  flightTakeoff: "flights",
  flightLanding: "flights",
  pirepReview: "pirepReview",
  ticketCreated: "tickets",
  ticketUpdated: "tickets",
  ticketReply: "tickets",
  ticketClosed: "tickets",
  newsCreated: "news",
  notamCreated: "notams",
  alertCreated: "alerts",
};

const listDiscordTicketAdminMentions = () => {
  const roleMentions = getManagedDiscordAdminRoleIds()
    .map((roleId) => normalizeAdminText(roleId))
    .filter(Boolean)
    .map((roleId) => `<@&${roleId}>`);
  if (roleMentions.length > 0) {
    return roleMentions.slice(0, 10);
  }

  const ids = new Set();
  for (const discordId of ADMIN_DISCORD_IDS) {
    const normalized = normalizeAdminText(discordId);
    if (normalized) {
      ids.add(normalized);
    }
  }
  for (const discordId of PRESEEDED_STAFF_DISCORD_IDS) {
    const normalized = normalizeAdminText(discordId);
    if (normalized) {
      ids.add(normalized);
    }
  }
  for (const discordId of adminUsersCache.keys()) {
    const normalized = normalizeAdminText(discordId);
    if (normalized) {
      ids.add(normalized);
    }
  }
  return Array.from(ids).slice(0, 20);
};

const buildTicketAdminPingContent = (eventKey, variables = {}, fallbackContent = "") => {
  const normalizedFallback = String(fallbackContent || "").trim();
  if (!["ticketCreated", "ticketReply"].includes(String(eventKey || ""))) {
    return normalizedFallback;
  }

  if (eventKey === "ticketReply" && String(variables?.authorRole || "").toLowerCase() === "staff") {
    return normalizedFallback;
  }

  const mentions = listDiscordTicketAdminMentions()
    .map((discordId) => String(discordId || ""))
    .join(" ")
    .trim();

  if (!mentions) {
    return normalizedFallback;
  }

  return [mentions, normalizedFallback].filter(Boolean).join("\n").trim();
};

const renderDiscordTemplateString = (value, variables = {}) =>
  String(value || "")
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
      const resolved = variables?.[key];
      return resolved === undefined || resolved === null ? "" : String(resolved);
    })
    .trim();

const normalizeDiscordEmbedFields = (fields = []) =>
  (Array.isArray(fields) ? fields : [])
    .filter((field) => field && typeof field === "object")
    .map((field) => ({
      name: String(field.name || "").trim(),
      value: String(field.value || "").trim(),
      inline: Boolean(field.inline),
    }))
    .filter((field) => field.name && field.value)
    .slice(0, 25);

const sendDiscordPayload = async ({ channelId, webhookUrl, payload }) => {
  const normalizedChannelId = String(channelId || "").trim();
  const normalizedWebhookUrl = String(webhookUrl || "").trim();
  let lastError = null;

  if (normalizedChannelId && DISCORD_BOT_TOKEN) {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${encodeURIComponent(normalizedChannelId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      return { sent: true, via: "bot", channelId: normalizedChannelId };
    }

    lastError = new Error(`Discord API responded with ${response.status}`);
  }

  if (normalizedWebhookUrl) {
    const response = await fetch(normalizedWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { sent: true, via: "webhook" };
    }

    lastError = new Error(`Discord webhook responded with ${response.status}`);
  }

  if (lastError) {
    throw lastError;
  }

  return { sent: false, reason: "discord_not_configured" };
};

const sendDiscordBotNotification = async ({
  eventKey,
  title,
  description,
  author,
  category,
  color = 0xe31e24,
  fields = [],
  variables = {},
  force = false,
  content = "",
}) => {
  const settings = getDiscordBotSettingsStore();
  if (!force) {
    if (!settings?.enabled) {
      return { sent: false, reason: "disabled" };
    }
    if (settings?.notifications?.[eventKey] === false) {
      return { sent: false, reason: "notification_disabled" };
    }
  }

  const channelKey = DISCORD_NOTIFICATION_CHANNEL_BY_EVENT[eventKey] || "news";
  const configuredChannelId = String(settings?.channels?.[channelKey] || "").trim();
  const fallbackChannelId = eventKey === "newsCreated" ? String(DISCORD_NEWS_CHANNEL_ID || "").trim() : "";
  const channelId = configuredChannelId || fallbackChannelId;
  const template =
    settings?.templates?.[eventKey] && typeof settings.templates[eventKey] === "object"
      ? settings.templates[eventKey]
      : DEFAULT_DISCORD_BOT_TEMPLATES[eventKey] || null;

  if (template && template.enabled === false && !force) {
    return { sent: false, reason: "template_disabled" };
  }

  const mergedVariables = {
    ...variables,
    title,
    content: description,
    author,
    category,
  };
  const resolvedContent = buildTicketAdminPingContent(eventKey, mergedVariables, content);

  const resolvedTitle =
    renderDiscordTemplateString(template?.title || title || "Update", mergedVariables) ||
    String(title || "Update");
  const resolvedDescription =
    renderDiscordTemplateString(template?.description || description || "", mergedVariables) ||
    String(description || "").trim() ||
    "No content";
  const embedFields = normalizeDiscordEmbedFields(fields);
  if (category) {
    embedFields.unshift({ name: "Category", value: String(category), inline: true });
  }
  if (author) {
    embedFields.push({ name: "Author", value: String(author), inline: true });
  }

  return sendDiscordPayload({
    channelId,
    webhookUrl: settings?.webhookUrl,
    payload: {
      ...(resolvedContent ? { content: String(resolvedContent) } : {}),
      allowed_mentions: {
        parse: [],
        roles: getManagedDiscordAdminRoleIds(),
        users: listDiscordTicketAdminMentions()
          .filter((mention) => /^<@\d+>$/.test(mention))
          .map((mention) => mention.replace(/[<@>]/g, "")),
      },
      embeds: [
        {
          title: resolvedTitle.slice(0, 250),
          description:
            resolvedDescription.length > 4000
              ? `${resolvedDescription.slice(0, 3997)}...`
              : resolvedDescription,
          color,
          fields: embedFields.slice(0, 25),
          timestamp: new Date().toISOString(),
        },
      ],
    },
  });
};

const publishNewsToDiscord = async ({ title, content, category, author }) => {
  return sendDiscordBotNotification({
    eventKey: "newsCreated",
    title: String(title || "Untitled").slice(0, 250),
    description: String(content || "").trim(),
    category: String(category || "News").toUpperCase(),
    author: String(author || "Admin"),
    color:
      String(category || "").toUpperCase() === "NOTAM"
        ? 0xf59e0b
        : String(category || "").toUpperCase() === "EVENT"
          ? 0x3b82f6
          : 0xe31e24,
    force: true,
  });
};

const requireCredentials = (res) => {
  if (!((CLIENT_ID && CLIENT_SECRET) || API_TOKEN)) {
    res.status(500).json({
      error: "Missing VAMSYS_API_TOKEN or VAMSYS_CLIENT_ID/VAMSYS_CLIENT_SECRET",
    });
    return false;
  }
  return true;
};

const getAccessToken = async () => {
  const now = Date.now();
  // If a simple API token is configured, use it directly and skip the OAuth flow.
  if (API_TOKEN) {
    // cache it for a long time
    tokenCache = { accessToken: API_TOKEN, expiresAt: now + 10 * 365 * 24 * 60 * 60 * 1000 };
    logVamsys("info", "token_static_present", { scheme: API_AUTH_SCHEME });
    return API_TOKEN;
  }
  if (tokenCache.accessToken && now < tokenCache.expiresAt - 60_000) {
    logVamsys("info", "token_cache_hit", {
      expiresInMs: tokenCache.expiresAt - now,
    });
    return tokenCache.accessToken;
  }

  const startedAt = Date.now();
  logVamsys("info", "token_fetch_start", {});

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: CLIENT_ID || "",
    client_secret: CLIENT_SECRET || "",
  });
  if (VAMSYS_API_SCOPE) {
    body.set("scope", VAMSYS_API_SCOPE);
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  let respText = "";
  try {
    respText = await response.clone().text().catch(() => "");
  } catch (e) {
    respText = "";
  }

  if (!response.ok) {
    const errorBody = truncateForLog(respText);
    logVamsys("error", "token_fetch_failed", {
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: errorBody,
    });
    throw new Error("Failed to obtain access token");
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    logVamsys("error", "token_fetch_json_parse_failed", { err: e && e.stack ? e.stack : String(e), body: truncateForLog(respText) });
    throw e;
  }
  const expiresIn = Number(data.expires_in || 0) * 1000;

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (expiresIn || 0),
  };

  // Masked token for logs
  const tokenMask = String(data.access_token || "").slice(0, 8) ? `${String(data.access_token || "").slice(0, 8)}...` : "";

  logVamsys("info", "token_fetch_success", {
    durationMs: Date.now() - startedAt,
    expiresInMs: expiresIn || 0,
    hasScope: Boolean(VAMSYS_API_SCOPE),
    scope: VAMSYS_API_SCOPE || null,
    tokenMask,
    body: truncateForLog(respText, 1000),
  });

  return tokenCache.accessToken;
};

const apiFetch = async (path) => {
  const startedAt = Date.now();
  const token = await getAccessToken();
  const maskedToken = String(token || "").slice(0, 8) ? `${String(token || "").slice(0, 8)}...` : "(none)";
  logVamsys("debug", "operations_api_fetch_start", { path, apiBase: API_BASE, tokenMask: maskedToken });

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    logVamsys("error", "operations_api_fetch_network_error", { path, err: err && err.stack ? err.stack : String(err) });
    throw err;
  }

  let respText = "";
  try {
    respText = await response.clone().text().catch(() => "");
  } catch (e) {
    respText = "";
  }

  if (!response.ok) {
    const details = truncateForLog(respText);
    logVamsys("error", "operations_api_fetch_failed", {
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: details,
    });
    throw new Error(`API request failed for ${path}: ${response.status} ${details}`);
  }

  logVamsys("info", "operations_api_fetch_success", {
    path,
    status: response.status,
    durationMs: Date.now() - startedAt,
    body: truncateForLog(respText, 1000),
  });

  try {
    return response.json();
  } catch (err) {
    logVamsys("error", "operations_api_fetch_json_parse_failed", { path, err: err && err.stack ? err.stack : String(err), body: truncateForLog(respText) });
    throw err;
  }
};

const apiRequest = async (path, { method = "GET", body } = {}) => {
  const startedAt = Date.now();
  const token = await getAccessToken();
  const maskedToken = String(token || "").slice(0, 8) ? `${String(token || "").slice(0, 8)}...` : "(none)";
  logVamsys("debug", "operations_api_request_start", { path, method, tokenMask: maskedToken, body: truncateForLog(body && JSON.stringify(body)) });

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    logVamsys("error", "operations_api_request_network_error", { path, method, err: err && err.stack ? err.stack : String(err) });
    throw err;
  }

  let respText = "";
  try {
    respText = await response.clone().text().catch(() => "");
  } catch (e) {
    respText = "";
  }

  if (!response.ok) {
    const details = truncateForLog(respText);
    logVamsys("error", "operations_api_request_failed", {
      path,
      method,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: details,
    });
    throw new Error(`API request failed for ${path}: ${response.status} ${details}`);
  }

  logVamsys("info", "operations_api_request_success", {
    path,
    method,
    status: response.status,
    durationMs: Date.now() - startedAt,
    body: truncateForLog(respText, 1000),
  });

  if (response.status === 204) {
    if (method !== "GET" && /^\/(airports|hubs|fleet|routes)(?:\/|$)/.test(String(path || ""))) {
      requestUnifiedCatalogResync();
    }
    return null;
  }

  try {
    const payload = await response.json();
    if (method !== "GET" && /^\/(airports|hubs|fleet|routes)(?:\/|$)/.test(String(path || ""))) {
      requestUnifiedCatalogResync();
    }
    return normalizeOperationsActionResponse(path, method, payload);
  } catch (err) {
    logVamsys("error", "operations_api_request_json_parse_failed", { path, method, err: err && err.stack ? err.stack : String(err), body: truncateForLog(respText) });
    throw err;
  }
};

const fetchAllPages = async (path) => {
  const startedAt = Date.now();
  let url = `${API_BASE}${path}`;
  const results = [];
  let pageCount = 0;

  while (url) {
    const token = await getAccessToken();
    const pageStartedAt = Date.now();
    const maskedToken = String(token || "").slice(0, 8) ? `${String(token || "").slice(0, 8)}...` : "(none)";
    logVamsys("debug", "operations_api_page_start", { path, url, pageCount, tokenMask: maskedToken });

    let response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      logVamsys("error", "operations_api_page_network_error", { path, url, pageCount, err: err && err.stack ? err.stack : String(err) });
      throw err;
    }

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      logVamsys("error", "operations_api_page_failed", {
        path,
        url,
        status: response.status,
        pageCount,
        durationMs: Date.now() - pageStartedAt,
        body: truncateForLog(details),
      });
      throw new Error(`API request failed for ${url}: ${response.status} ${details}`);
    }

    const pageText = await response.clone().text().catch(() => "");
    let data;
    try {
      data = await response.json();
    } catch (err) {
      logVamsys("error", "operations_api_page_json_parse_failed", { path, url, err: err && err.stack ? err.stack : String(err), body: truncateForLog(pageText) });
      throw err;
    }
    pageCount += 1;
    if (Array.isArray(data?.data)) {
      // Normalize JSON:API nodes into flat objects so callers can read `.name`, `.hours`, etc.
      results.push(...data.data.map((item) => (item && typeof item === "object" ? flattenJsonApiNode(item) : item)));
    }

    logVamsys("info", "operations_api_page_success", {
      path,
      url,
      pageCount,
      status: response.status,
      receivedItems: Array.isArray(data?.data) ? data.data.length : 0,
      durationMs: Date.now() - pageStartedAt,
      body: truncateForLog(pageText, 1000),
    });

    const meta = data?.meta || {};
    const nextUrl = meta.next_cursor_url || meta.next_page_url || null;
    if (typeof nextUrl === "string" && nextUrl.length > 0) {
      url = nextUrl.startsWith("http") ? nextUrl : `${API_BASE}${nextUrl}`;
      continue;
    }

    if (meta.next_cursor) {
      const separator = path.includes("?") ? "&" : "?";
      url = `${API_BASE}${path}${separator}page[cursor]=${encodeURIComponent(
        meta.next_cursor
      )}`;
      continue;
    }

    url = null;
  }

  logVamsys("info", "operations_api_pagination_complete", {
    path,
    totalPages: pageCount,
    totalItems: results.length,
    durationMs: Date.now() - startedAt,
  });

  return results;
};

const resolveNextPageUrl = (meta = {}, sourcePath = "") => {
  const nextUrl = meta.next_cursor_url || meta.next_page_url || null;
  if (typeof nextUrl === "string" && nextUrl.length > 0) {
    return nextUrl.startsWith("http") ? nextUrl : `${API_BASE}${nextUrl}`;
  }
  if (meta.next_cursor) {
    const separator = sourcePath.includes("?") ? "&" : "?";
    return `${API_BASE}${sourcePath}${separator}page[cursor]=${encodeURIComponent(meta.next_cursor)}`;
  }
  return null;
};

const fetchOperationsPage = async ({ url, sourcePath }) => {
  const token = await getAccessToken();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`API request failed for ${url}: ${response.status} ${details}`);
  }

  const data = await response.json();
  const items = Array.isArray(data?.data)
    ? data.data.map((item) => (item && typeof item === "object" ? flattenJsonApiNode(item) : item))
    : [];
  const nextPageUrl = resolveNextPageUrl(data?.meta || {}, sourcePath);

  return {
    items,
    nextPageUrl,
  };
};

const parseSyncTimestamp = (item) => {
  const candidates = [
    item?.updated_at,
    item?.updatedAt,
    item?.created_at,
    item?.createdAt,
    item?.deleted_at,
    item?.deletedAt,
  ];

  for (const value of candidates) {
    const time = Date.parse(String(value || ""));
    if (Number.isFinite(time) && time > 0) {
      return time;
    }
  }

  return 0;
};

const fetchIncrementalUpdates = async ({ path, lastSyncAt = 0, maxPages = UNIFIED_CATALOG_MAX_DELTA_PAGES }) => {
  let url = `${API_BASE}${path}`;
  let pageCount = 0;
  let sawTimestamp = false;
  const changed = [];
  let reachedOldBoundary = false;

  while (url && pageCount < maxPages && !reachedOldBoundary) {
    const page = await fetchOperationsPage({ url, sourcePath: path });
    pageCount += 1;

    for (const item of page.items) {
      const updatedAt = parseSyncTimestamp(item);
      if (updatedAt > 0) {
        sawTimestamp = true;
      }

      if (lastSyncAt > 0 && updatedAt > 0 && updatedAt <= lastSyncAt) {
        reachedOldBoundary = true;
        break;
      }

      changed.push(item);
    }

    url = reachedOldBoundary ? null : page.nextPageUrl;
  }

  return {
    changed,
    sawTimestamp,
    isComplete: reachedOldBoundary || !url,
  };
};

const mapByNumericId = (items = []) => {
  const map = new Map();
  for (const item of items) {
    const id = Number(item?.id || 0) || 0;
    if (id > 0) {
      map.set(id, item);
    }
  }
  return map;
};

const buildUnifiedAirportRecord = (airport = {}) => ({
  id: Number(airport.id || 0) || null,
  code: airport.icao || airport.iata || String(airport.id || ""),
  icao: String(airport?.icao || "").trim() || null,
  iata: String(airport?.iata || "").trim() || null,
  name: airport.name || airport.icao || airport.iata || "",
  city:
    String(
      airport?.city ||
        airport?.municipality ||
        airport?.location?.city ||
        airport?.address?.city ||
        ""
    ).trim() || null,
  category: String(airport?.category || "").trim() || null,
  base: Boolean(airport?.base),
  suitableAlternate: Boolean(airport?.suitable_alternate),
  taxiInMinutes: Number(airport?.taxi_in_minutes || 0) || 0,
  taxiOutMinutes: Number(airport?.taxi_out_minutes || 0) || 0,
  airportBriefingUrl: String(airport?.airport_briefing_url || "").trim() || null,
  preferredAlternates: Array.isArray(airport?.preferred_alternates) ? airport.preferred_alternates : [],
  countryName: String(airport?.country?.name || "").trim() || null,
  countryIso2: String(airport?.country?.iso2 || "").trim() || null,
  latitude: Number(airport?.latitude || 0) || null,
  longitude: Number(airport?.longitude || 0) || null,
});

const buildUnifiedFleetEntry = async (fleet = {}, aircraftColor = "#E31E24") => {
  const fleetId = Number(fleet?.id || 0) || 0;
  const aircraft =
    fleetId > 0
      ? await fetchAllPages(`/fleet/${fleetId}/aircraft?page[size]=100`).catch(() => [])
      : [];

  return {
    id: fleetId || null,
    name: fleet.name || fleet.code || `Fleet ${fleetId || ""}`,
    code: fleet.code || "",
    color: aircraftColor,
    aircraft: (Array.isArray(aircraft) ? aircraft : []).map((item) => ({
      id: item.id,
      model: item.name || fleet.name || "",
      registration: item.registration || "",
      seats: item.passengers ?? fleet.max_pax ?? 0,
      range_nm: item.range_nm ?? item.range ?? item.max_range ?? item.flight_range ?? null,
      cruise_speed: item.cruise_speed ?? item.speed ?? item.cruise ?? item.max_speed ?? null,
      serviceable: item.serviceable ?? item.is_serviceable ?? item.available ?? null,
    })),
  };
};

const runUnifiedCatalogFullSync = async () => {
  const [airports, hubs, routes, fleets] = await Promise.all([
    fetchAllPages("/airports?page[size]=300&sort=-updated_at"),
    fetchAllPages("/hubs?page[size]=100&sort=-updated_at"),
    fetchAllPages("/routes?page[size]=300&sort=-updated_at"),
    fetchAllPages("/fleet?page[size]=100&sort=-updated_at"),
  ]);

  const airportsMap = mapByNumericId((Array.isArray(airports) ? airports : []).map((item) => buildUnifiedAirportRecord(item)));
  const hubsMap = mapByNumericId(Array.isArray(hubs) ? hubs : []);
  const routesMap = mapByNumericId(Array.isArray(routes) ? routes : []);

  const colors = ["#E31E24", "#0066CC", "#FF6B00", "#2A2A2A"];
  const fleetEntries = await Promise.all(
    (Array.isArray(fleets) ? fleets : []).map((fleet, index) =>
      buildUnifiedFleetEntry(fleet, colors[index % colors.length])
    )
  );
  const fleetsMap = mapByNumericId(fleetEntries);

  unifiedCatalogCache.airportsById = airportsMap;
  unifiedCatalogCache.hubsById = hubsMap;
  unifiedCatalogCache.routesById = routesMap;
  unifiedCatalogCache.fleetsById = fleetsMap;
  unifiedCatalogCache.lastFullSyncAt = Date.now();
  unifiedCatalogCache.lastDeltaSyncAt = Date.now();
  unifiedCatalogCache.initialized = true;

  const fleetSnapshot = {
    fleets: Array.from(fleetsMap.values()),
  };
  fleetCache = {
    data: fleetSnapshot,
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
  persistFleetSnapshot(fleetSnapshot);
};

const mergeIncrementalEntities = (targetMap, items, mapper = (entry) => entry) => {
  for (const raw of items) {
    const item = mapper(raw);
    const id = Number(item?.id || 0) || 0;
    if (id <= 0) {
      continue;
    }
    const deletedAt = Date.parse(String(item?.deleted_at || item?.deletedAt || ""));
    if (Number.isFinite(deletedAt) && deletedAt > 0) {
      targetMap.delete(id);
      continue;
    }
    targetMap.set(id, item);
  }
};

const runUnifiedCatalogDeltaSync = async () => {
  if (!unifiedCatalogCache.initialized) {
    await runUnifiedCatalogFullSync();
    return;
  }

  const since = unifiedCatalogCache.lastDeltaSyncAt || unifiedCatalogCache.lastFullSyncAt || 0;

  const [airportsDelta, hubsDelta, routesDelta, fleetsDelta] = await Promise.all([
    fetchIncrementalUpdates({ path: "/airports?page[size]=200&sort=-updated_at", lastSyncAt: since }),
    fetchIncrementalUpdates({ path: "/hubs?page[size]=100&sort=-updated_at", lastSyncAt: since }),
    fetchIncrementalUpdates({ path: "/routes?page[size]=200&sort=-updated_at", lastSyncAt: since }),
    fetchIncrementalUpdates({ path: "/fleet?page[size]=100&sort=-updated_at", lastSyncAt: since }),
  ]);

  if (!airportsDelta.sawTimestamp || !hubsDelta.sawTimestamp || !routesDelta.sawTimestamp || !fleetsDelta.sawTimestamp) {
    await runUnifiedCatalogFullSync();
    return;
  }

  mergeIncrementalEntities(unifiedCatalogCache.airportsById, airportsDelta.changed, buildUnifiedAirportRecord);
  mergeIncrementalEntities(unifiedCatalogCache.hubsById, hubsDelta.changed);
  mergeIncrementalEntities(unifiedCatalogCache.routesById, routesDelta.changed);

  if (fleetsDelta.changed.length > 0) {
    const existingCount = Math.max(unifiedCatalogCache.fleetsById.size, 1);
    const colors = ["#E31E24", "#0066CC", "#FF6B00", "#2A2A2A"];
    for (const changedFleet of fleetsDelta.changed) {
      const fleetId = Number(changedFleet?.id || 0) || 0;
      if (fleetId <= 0) {
        continue;
      }
      const colorSeed = (fleetId + existingCount) % colors.length;
      const mergedFleet = await buildUnifiedFleetEntry(changedFleet, colors[colorSeed]);
      unifiedCatalogCache.fleetsById.set(fleetId, mergedFleet);
    }

    const fleetSnapshot = {
      fleets: Array.from(unifiedCatalogCache.fleetsById.values()),
    };
    fleetCache = {
      data: fleetSnapshot,
      expiresAt: Number.MAX_SAFE_INTEGER,
    };
    persistFleetSnapshot(fleetSnapshot);
  }

  unifiedCatalogCache.lastDeltaSyncAt = Date.now();

  if (!airportsDelta.isComplete || !hubsDelta.isComplete || !routesDelta.isComplete || !fleetsDelta.isComplete) {
    unifiedCatalogCache.lastFullSyncAt = 0;
  }
};

const syncUnifiedCatalog = async ({ forceFull = false } = {}) => {
  if (unifiedCatalogCache.syncPromise) {
    return unifiedCatalogCache.syncPromise;
  }

  const now = Date.now();
  const needsFullSync =
    forceFull ||
    !unifiedCatalogCache.initialized ||
    now - unifiedCatalogCache.lastFullSyncAt > UNIFIED_CATALOG_FULL_SYNC_MS;

  unifiedCatalogCache.syncPromise = (needsFullSync ? runUnifiedCatalogFullSync() : runUnifiedCatalogDeltaSync())
    .catch((error) => {
      logger.warn("[catalog] sync_failed", { error: String(error) });
      if (!unifiedCatalogCache.initialized) {
        throw error;
      }
    })
    .finally(() => {
      unifiedCatalogCache.syncPromise = null;
    });

  return unifiedCatalogCache.syncPromise;
};

const ensureUnifiedCatalogReady = async () => {
  if (unifiedCatalogCache.initialized) {
    return;
  }
  if (!unifiedCatalogCache.initPromise) {
    unifiedCatalogCache.initPromise = syncUnifiedCatalog({ forceFull: true }).finally(() => {
      unifiedCatalogCache.initPromise = null;
    });
  }
  await unifiedCatalogCache.initPromise;
};

const requestUnifiedCatalogResync = () => {
  unifiedCatalogCache.lastDeltaSyncAt = 0;
  void syncUnifiedCatalog({ forceFull: false });
};

const startUnifiedCatalogSyncScheduler = () => {
  if (unifiedCatalogCache.periodicTimer) {
    return;
  }

  void ensureUnifiedCatalogReady().catch((error) => {
    logger.warn("[catalog] initial_sync_failed", { error: String(error) });
  });

  unifiedCatalogCache.periodicTimer = setInterval(() => {
    void syncUnifiedCatalog({ forceFull: false });
  }, UNIFIED_CATALOG_DELTA_SYNC_MS);
};

const formatDuration = (secondsValue) => {
  const totalSeconds = Number(secondsValue);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "—";
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}m`;
};

const toRadians = (value) => (Number(value) * Math.PI) / 180;

const calculateDistanceNm = (lat1, lon1, lat2, lon2) => {
  const values = [lat1, lon1, lat2, lon2].map((value) => Number(value));
  if (!values.every((value) => Number.isFinite(value))) {
    return null;
  }

  const [fromLat, fromLon, toLat, toLon] = values;
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLon = toRadians(toLon - fromLon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = earthRadiusKm * c;

  return distanceKm * 0.539957;
};

const loadAirportsLookup = async () => {
  const now = Date.now();
  if (airportsLookupCache.map && now < airportsLookupCache.expiresAt) {
    return airportsLookupCache.map;
  }

  await ensureUnifiedCatalogReady().catch(() => undefined);
  if (unifiedCatalogCache.airportsById.size > 0) {
    airportsLookupCache = {
      map: new Map(unifiedCatalogCache.airportsById),
      expiresAt: now + 5 * 60 * 1000,
    };
    return airportsLookupCache.map;
  }

  const airports = await fetchAllPages("/airports?page[size]=300");
  const map = new Map();

  airports.forEach((airport) => {
    if (!airport?.id) {
      return;
    }
    map.set(airport.id, {
      id: Number(airport.id || 0) || null,
      code: airport.icao || airport.iata || String(airport.id),
      icao: String(airport?.icao || "").trim() || null,
      iata: String(airport?.iata || "").trim() || null,
      name: airport.name || airport.icao || airport.iata || "",
      city:
        String(
          airport?.city ||
            airport?.municipality ||
            airport?.location?.city ||
            airport?.address?.city ||
            ""
        ).trim() || null,
      category: String(airport?.category || "").trim() || null,
      base: Boolean(airport?.base),
      suitableAlternate: Boolean(airport?.suitable_alternate),
      taxiInMinutes: Number(airport?.taxi_in_minutes || 0) || 0,
      taxiOutMinutes: Number(airport?.taxi_out_minutes || 0) || 0,
      airportBriefingUrl: String(airport?.airport_briefing_url || "").trim() || null,
      preferredAlternates: Array.isArray(airport?.preferred_alternates) ? airport.preferred_alternates : [],
      countryName: String(airport?.country?.name || "").trim() || null,
      countryIso2: String(airport?.country?.iso2 || "").trim() || null,
      latitude: Number(airport?.latitude || 0) || null,
      longitude: Number(airport?.longitude || 0) || null,
    });
  });

  airportsLookupCache = {
    map,
    expiresAt: now + 60 * 60 * 1000,
  };

  return map;
};

const loadPilotName = async (pilotId) => {
  const key = Number(pilotId);
  if (!Number.isFinite(key) || key <= 0) {
    return "";
  }

  if (pilotNameCache.has(key)) {
    return pilotNameCache.get(key);
  }

  try {
    const response = await apiFetch(`/pilots/${key}`);
    // apiFetch may return a JSON:API payload; prefer flattened node if present
    let data = response?.data || response || {};
    if (data && typeof data === "object" && data.id && (data.attributes || data.relationships)) {
      data = flattenJsonApiNode(data);
    }
    const name = data.name || data.username || "";
    pilotNameCache.set(key, name);
    return name;
  } catch {
    pilotNameCache.set(key, "");
    return "";
  }
};

const normalizePilotDisplayName = (value) => {
  const name = String(value || "").trim();
  if (!name || isPlaceholderPilotName(name)) {
    return "";
  }
  return name;
};

const resolvePilotNameFromPirep = async (pirep) => {
  const pilotNode =
    pirep?.pilot && typeof pirep.pilot === "object" ? pirep.pilot : {};
  const userNode =
    pirep?.user && typeof pirep.user === "object" ? pirep.user : {};

  const directCandidates = [
    pirep?.pilot_name,
    pirep?.pilotName,
    pirep?.pilot,
    pirep?.name,
    pirep?.username,
    pilotNode?.name,
    pilotNode?.full_name,
    pilotNode?.display_name,
    pilotNode?.username,
    userNode?.name,
    userNode?.full_name,
    userNode?.display_name,
    userNode?.username,
  ];

  for (const candidate of directCandidates) {
    const resolved = normalizePilotDisplayName(candidate);
    if (resolved) {
      return resolved;
    }
  }

  const pilotId = Number(pirep?.pilot_id || pilotNode?.id || userNode?.id || 0) || 0;
  if (pilotId > 0) {
    const byId = normalizePilotDisplayName(await loadPilotName(pilotId).catch(() => ""));
    if (byId) {
      return byId;
    }

    const rosterMatch = await findPilotInRoster({
      id: pilotId,
      username: String(pilotNode?.username || userNode?.username || "").trim(),
      name: String(pilotNode?.name || userNode?.name || "").trim(),
    }).catch(() => null);

    const rosterName = normalizePilotDisplayName(
      rosterMatch?.name || rosterMatch?.full_name || rosterMatch?.display_name || rosterMatch?.username || ""
    );
    if (rosterName) {
      return rosterName;
    }
  }

  return "";
};

const loadPilotProfileById = async (pilotId, { seedPilot = null } = {}) => {
  const key = Number(pilotId);
  if (!Number.isFinite(key) || key <= 0) {
    return null;
  }

  // Optional documented endpoint (disabled by default in this environment,
  // because it often returns 404 and slows the auth flow).
  const host = process.env.VAMSYS_HOST || (() => {
    try {
      return new URL(API_BASE).origin;
    } catch {
      return 'https://vamsys.io';
    }
  })();

  const url = `${String(host).replace(/\/$/, '')}/api/v3/pilots/${key}`;

  try {
    const normalizePilotPayload = (payload) => {
      let normalized = payload?.data || payload || {};
      if (normalized && typeof normalized === 'object' && normalized.id && (normalized.attributes || normalized.relationships)) {
        normalized = flattenJsonApiNode(normalized);
      }
      return normalized;
    };

    const token = await getAccessToken();
    const startedAt = Date.now();
    let node = null;

    if (seedPilot && typeof seedPilot === "object") {
      node = normalizePilotPayload(seedPilot);
    }

    if (VAMSYS_TRY_DOCS_PILOT_ENDPOINT) {
      const resp = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const txt = await resp.text().catch(() => '');
      if (resp.ok) {
        let parsed = null;
        try { parsed = JSON.parse(txt || '{}'); } catch { parsed = null; }
        node = normalizePilotPayload(parsed);
      } else {
        logVamsys('warn', 'pilot_profile_fetch_failed', { pilotId: key, url, status: resp.status, durationMs: Date.now() - startedAt, body: truncateForLog(txt) });
      }
    }

    if (!node || !node.id) {
      try {
        const direct = await apiFetch(`/pilots/${key}`).catch(() => null);
        if (direct) {
          node = normalizePilotPayload(direct);
          logVamsys('info', 'pilot_profile_fallback_used', { pilotId: key, method: 'operations_direct' });
        }
      } catch (fallbackErr) {
        logVamsys('warn', 'pilot_profile_fallback_direct_failed', { pilotId: key, error: String(fallbackErr) });
      }
    }

    if (!node || !node.id) {
      return null;
    }

    const computeHours = () => {
      const explicit = Number(node?.hours || node?.total_hours || 0) || 0;
      try {
        const stats = node?.statistics || {};
        // Prefer an all-time value if present.
        if (stats?.flight_time_all_time && Number.isFinite(Number(stats.flight_time_all_time.seconds))) {
          return Number((Number(stats.flight_time_all_time.seconds) / 3600).toFixed(2));
        }
        // If all_time is missing, sum available flight_time_* buckets as requested.
        let totalSeconds = 0;
        for (const k of Object.keys(stats || {})) {
          if (k.startsWith('flight_time') && stats[k] && Number.isFinite(Number(stats[k].seconds))) {
            totalSeconds += Number(stats[k].seconds) || 0;
          }
        }
        if (totalSeconds > 0) return Number((totalSeconds / 3600).toFixed(2));
      } catch (e) {}
      return explicit;
    };

    const computeFlights = () => {
      const explicit = Number(node?.flights || node?.total_flights || 0) || 0;
      try {
        const stats = node?.statistics || {};
        // Prefer an all-time count if present.
        if (stats?.pireps_all_time && Number.isFinite(Number(stats.pireps_all_time.count))) {
          return Number(stats.pireps_all_time.count);
        }
        // If all_time is missing, sum available pireps* buckets as requested.
        let totalCount = 0;
        for (const k of Object.keys(stats || {})) {
          if (k.startsWith('pireps') && stats[k] && Number.isFinite(Number(stats[k].count))) {
            totalCount += Number(stats[k].count) || 0;
          }
        }
        if (totalCount > 0) return totalCount;
      } catch (e) {}
      return explicit;
    };

    let hours = computeHours();
    let flights = computeFlights();

    // If the documented pilot resource lacks `statistics` or both hours/flights are zero,
    // fall back to aggregating PIREPs for this pilot as a best-effort backup.
    try {
      const statsMissing = !node || !node.statistics || Object.keys(node.statistics || {}).length === 0;
      if (statsMissing || (!hours && !flights)) {
        const pireps = await fetchAllPages(`/pireps?page[size]=100&filter[pilot_id]=${key}&sort=-created_at`);
        const pirepsArr = Array.isArray(pireps) ? pireps : (Array.isArray(pireps?.data) ? pireps.data : []);
        if (Array.isArray(pirepsArr) && pirepsArr.length) {
          const accepted = pirepsArr.filter((p) => ['accepted', 'auto_accepted', 'approved'].includes(String(p?.status || '').toLowerCase()));
          const source = accepted.length ? accepted : pirepsArr;
          const totalSeconds = source.reduce((sum, p) => sum + (Number(p?.flight_length) || 0), 0);
          const pirepsCount = source.length;
          const pirepHours = Number((totalSeconds / 3600).toFixed(2));
          if (pirepHours > hours) hours = pirepHours;
          if (pirepsCount > flights) flights = pirepsCount;
          logVamsys('info', 'pilot_profile_pireps_aggregated', { pilotId: key, pirepsCount, hours, flights });
        }
      }
    } catch (e) {
      logVamsys('warn', 'pilot_profile_pireps_aggregate_failed', { pilotId: key, error: String(e) });
    }

    logVamsys('info', 'pilot_profile_endpoint_used', { pilotId: key, url, durationMs: Date.now() - startedAt });

    try {
      const preview = {};
      if (node && typeof node === 'object') Object.keys(node).slice(0, 20).forEach((k) => { preview[k] = node[k]; });
      logger?.info && logger.info('[vamsys-stat] pilot_profile_fetched', { pilotId: key, resolvedId: Number(node?.id || key) || key, username: String(node?.username || '').trim(), name: String(node?.name || '').trim(), hours, flights, preview });
    } catch (e) { try { console.warn('[vamsys-stat] logging failed', String(e)); } catch (_) {} }

    return {
      id: Number(node?.id || key) || key,
      username: String(node?.username || '').trim(),
      name: String(node?.name || '').trim(),
      email: String(node?.email || '').trim(),
      rank: String(node?.rank?.name || node?.rank_name || '').trim(),
      hours,
      flights,
      joinedAt: String(node?.created_at || node?.joined_at || '').trim(),
    };
  } catch (e) {
    logVamsys('error', 'pilot_profile_fetch_error', { pilotId: key, url, error: String(e) });
    return null;
  }
};

const findPilotInRoster = async ({ id, username, email, name } = {}) => {
  const roster = await loadPilotsRoster();
  const pilots = Array.isArray(roster?.pilots) ? roster.pilots : [];
  if (!pilots.length) {
    return null;
  }

  const idNumber = Number(id);
  if (Number.isFinite(idNumber) && idNumber > 0) {
    const byId = pilots.find((pilot) => Number(pilot?.id || 0) === idNumber);
    if (byId) {
      return byId;
    }
  }

  const usernameKey = normalizeMatchValue(username);
  if (usernameKey) {
    const byUsername = pilots.find(
      (pilot) => normalizeMatchValue(pilot?.username) === usernameKey
    );
    if (byUsername) {
      return byUsername;
    }
  }

  const emailKey = normalizeMatchValue(email);
  if (emailKey) {
    const byEmail = pilots.find(
      (pilot) => normalizeMatchValue(pilot?.email) === emailKey
    );
    if (byEmail) {
      return byEmail;
    }
  }

  const nameKey = normalizeMatchValue(name);
  if (nameKey) {
    const byName = pilots.find(
      (pilot) => normalizeMatchValue(pilot?.name) === nameKey
    );
    if (byName) {
      return byName;
    }
  }

  return null;
};

const loadPilotsLookup = async () => {
  const now = Date.now();
  if (pilotsLookupCache.byUsername && now < pilotsLookupCache.expiresAt) {
    return pilotsLookupCache.byUsername;
  }

  const pilots = await fetchAllPages("/pilots?page[size]=300");
  const byUsername = new Map();

  pilots.forEach((pilot) => {
    const username = String(pilot?.username || "").trim();
    if (!username) {
      return;
    }

    byUsername.set(username.toUpperCase(), {
      username,
      name: String(pilot?.name || "").trim(),
      id: Number(pilot?.id || 0) || null,
    });
  });

  pilotsLookupCache = {
    byUsername,
    expiresAt: now + 10 * 60 * 1000,
  };

  return byUsername;
};

const loadRanksMap = async () => {
  const now = Date.now();
  if (ranksLookupCache.map && now < ranksLookupCache.expiresAt) {
    return ranksLookupCache.map;
  }

  const ranks = await fetchAllPages('/ranks?page[size]=200');
  const map = new Map();
  for (const rank of ranks) {
    const id = Number(rank?.id || 0) || 0;
    if (!id) continue;
    const name = String(rank?.name || rank?.abbreviation || `Rank #${id}`).trim();
    map.set(id, name);
  }

  ranksLookupCache = { map, expiresAt: now + 10 * 60 * 1000 };
  return map;
};

const loadPilotsRoster = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && pilotsRosterCache.data && now < pilotsRosterCache.expiresAt) {
    return pilotsRosterCache.data;
  }

  const [pilots, ranks] = await Promise.all([
    fetchAllPages("/pilots?page[size]=300"),
    fetchAllPages("/ranks?page[size]=200"),
  ]);

  const rankMap = new Map();
  ranks.forEach((rank) => {
    const rankId = Number(rank?.id || 0);
    if (!rankId) {
      return;
    }
    rankMap.set(rankId, String(rank?.name || rank?.abbreviation || ""));
  });

  const roster = pilots
    .filter((pilot) => !pilot?.deleted_at)
    .map((pilot) => {
      const rankId = Number(pilot?.rank_id || 0) || null;
      const airlineBan = Boolean(pilot?.airline_ban);
      const platformBan = Boolean(pilot?.platform_ban);
      const frozenDate = String(pilot?.frozen_date || "").trim();

      let status = "active";
      if (platformBan || airlineBan) {
        status = "banned";
      } else if (frozenDate) {
        status = "frozen";
      }

      return {
        id: Number(pilot?.id || 0) || null,
        username: String(pilot?.username || ""),
        name: String(pilot?.name || ""),
        email: String(pilot?.email || ""),
        airlineId: Number(pilot?.airline_id || 0) || null,
        rank: rankId ? rankMap.get(rankId) || `Rank #${rankId}` : "",
        rankId,
        hours: Number(pilot?.hours || pilot?.total_hours || 0) || 0,
        flights: Number(pilot?.flights || pilot?.total_flights || 0) || 0,
        status,
        joinedAt: String(pilot?.created_at || pilot?.joined_at || ""),
      };
    });

  pilotsRosterCache = {
    data: { pilots: roster },
    expiresAt: now + 5 * 60 * 1000,
  };

  // Persist the roster to disk so the host retains a usable copy across restarts
  try {
    persistPilotsRoster();
  } catch (e) {
    logger.warn('[pilots] persist_call_failed', String(e));
  }

  return pilotsRosterCache.data;
};

const normalizeMatchValue = (value) => String(value || "").trim().toUpperCase();

const firstNonEmptyString = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) {
      return text;
    }
  }
  return "";
};

const extractOauthIdentity = (profile = {}) => {
  const user = profile?.user && typeof profile.user === "object" ? profile.user : {};
  const pilot = profile?.pilot && typeof profile.pilot === "object" ? profile.pilot : {};
  const account = profile?.account && typeof profile.account === "object" ? profile.account : {};

  const firstName = firstNonEmptyString(
    profile?.first_name,
    profile?.given_name,
    user?.first_name,
    user?.given_name,
    pilot?.first_name,
    account?.first_name
  );

  const lastName = firstNonEmptyString(
    profile?.last_name,
    profile?.family_name,
    user?.last_name,
    user?.family_name,
    pilot?.last_name,
    account?.last_name
  );

  const composedName = `${firstName} ${lastName}`.trim();

  return {
    id: firstNonEmptyString(
      profile?.id,
      profile?.pilot_id,
      profile?.sub,
      profile?.uid,
      user?.id,
      pilot?.id,
      account?.id
    ),
    username: firstNonEmptyString(
      profile?.username,
      profile?.callsign,
      profile?.preferred_username,
      profile?.nickname,
      user?.username,
      pilot?.username,
      account?.username
    ),
    name: firstNonEmptyString(
      profile?.name,
      user?.name,
      pilot?.name,
      account?.name,
      composedName
    ),
    email: firstNonEmptyString(profile?.email, user?.email, pilot?.email, account?.email),
    rank: firstNonEmptyString(
      profile?.rank?.name,
      profile?.rank_name,
      user?.rank?.name,
      user?.rank_name,
      pilot?.rank?.name,
      pilot?.rank_name,
      account?.rank?.name,
      account?.rank_name
    ),
    hours: Number(
      profile?.hours ||
        profile?.total_hours ||
        user?.hours ||
        user?.total_hours ||
        pilot?.hours ||
        pilot?.total_hours ||
        account?.hours ||
        account?.total_hours ||
        0
    ) || 0,
    flights: Number(
      profile?.flights ||
        profile?.total_flights ||
        user?.flights ||
        user?.total_flights ||
        pilot?.flights ||
        pilot?.total_flights ||
        account?.flights ||
        account?.total_flights ||
        0
    ) || 0,
    joinedAt: firstNonEmptyString(
      profile?.created_at,
      profile?.joined_at,
      user?.created_at,
      user?.joined_at,
      pilot?.created_at,
      pilot?.joined_at,
      account?.created_at,
      account?.joined_at
    ),
    avatar: firstNonEmptyString(profile?.avatar, user?.avatar, pilot?.avatar, account?.avatar),
    honorary_rank_id:
      Number(
        profile?.honorary_rank_id ||
          profile?.honoraryRankId ||
          profile?.honorary_rank?.id ||
          user?.honorary_rank_id ||
          user?.honoraryRankId ||
          user?.honorary_rank?.id ||
          pilot?.honorary_rank_id ||
          pilot?.honoraryRankId ||
          pilot?.honorary_rank?.id ||
          account?.honorary_rank_id ||
          account?.honoraryRankId ||
          account?.honorary_rank?.id ||
          0
      ) || 0,
    honoraryRankId:
      Number(
        profile?.honorary_rank_id ||
          profile?.honoraryRankId ||
          profile?.honorary_rank?.id ||
          user?.honorary_rank_id ||
          user?.honoraryRankId ||
          user?.honorary_rank?.id ||
          pilot?.honorary_rank_id ||
          pilot?.honoraryRankId ||
          pilot?.honorary_rank?.id ||
          account?.honorary_rank_id ||
          account?.honoraryRankId ||
          account?.honorary_rank?.id ||
          0
      ) || 0,
    honorary_rank:
      profile?.honorary_rank && typeof profile.honorary_rank === "object"
        ? profile.honorary_rank
        : user?.honorary_rank && typeof user.honorary_rank === "object"
        ? user.honorary_rank
        : pilot?.honorary_rank && typeof pilot.honorary_rank === "object"
        ? pilot.honorary_rank
        : account?.honorary_rank && typeof account.honorary_rank === "object"
        ? account.honorary_rank
        : undefined,
  };
};

const resolveOperationsPilotFromProfile = async (profile) => {
  if (!profile) return null;
  const normalizePilotNode = (pilot) => {
    if (!pilot || typeof pilot !== "object") {
      return pilot;
    }
    if (pilot.id && (pilot.attributes || pilot.relationships)) {
      return flattenJsonApiNode(pilot);
    }
    return pilot;
  };
  try {
    const discordId = String(profile?.discord_id || profile?.user?.discord_id || profile?.user?.discordUser?.discord_id || "").trim();
    const userId = String(profile?.user_id || profile?.user?.id || profile?.pilot?.user_id || "").trim();
    const username = String(
      profile?.username || profile?.preferred_username || profile?.user?.username || profile?.pilot?.username || profile?.account?.username || ""
    ).trim();

    // Extra: sometimes the OAuth token `id`/`sub` is the vAMSYS user id (not pilot id).
    // Try those claim fields as additional candidates when querying the operations API.
    const claimIdCandidates = [
      String(profile?.id || "").trim(),
      String(profile?.sub || "").trim(),
      String(profile?.pilot_id || "").trim(),
      String(profile?.pilot?.id || "").trim(),
    ].filter((v) => v && v !== "null");

    if (claimIdCandidates.length) {
      logVamsys && logVamsys('debug', 'resolve_ops_profile_claim_candidates', { claimIdCandidates, username, userId, discordId });
    }

    if (discordId) {
      const resp = await apiFetch(`/pilots?filter[discord_id]=${encodeURIComponent(discordId)}&page[size]=1`);
      const pilot = resp?.data && Array.isArray(resp.data) && resp.data.length ? resp.data[0] : null;
      if (pilot) return { pilot: normalizePilotNode(pilot), matchType: "operations_discord_id" };
    }

    if (userId) {
      const resp = await apiFetch(`/pilots?filter[user_id]=${encodeURIComponent(userId)}&page[size]=1`);
      const pilot = resp?.data && Array.isArray(resp.data) && resp.data.length ? resp.data[0] : null;
      if (pilot) return { pilot: normalizePilotNode(pilot), matchType: "operations_user_id" };
    }

    // If the initial user_id lookup failed, try claim-derived ids as either user_id or pilot id
    for (const candidateId of claimIdCandidates) {
      try {
        // Try as pilot id (direct lookup) first. This is usually the fastest path
        // when JWT claim `id` is actually the pilot id.
        const respById = await apiFetch(`/pilots/${encodeURIComponent(candidateId)}`).catch(() => null);
        const byIdNode = respById?.data || respById || null;
        if (byIdNode && typeof byIdNode === "object") {
          return { pilot: normalizePilotNode(byIdNode), matchType: 'operations_id_claim' };
        }

        // Try as user_id filter
        const respUserId = await apiFetch(`/pilots?filter[user_id]=${encodeURIComponent(candidateId)}&page[size]=1`).catch(() => null);
        if (respUserId && Array.isArray(respUserId.data) && respUserId.data.length) {
          return { pilot: normalizePilotNode(respUserId.data[0]), matchType: 'operations_user_id_claim' };
        }
      } catch (e) {
        // ignore and continue
      }
    }

    if (username) {
      const resp = await apiFetch(`/pilots?filter[username]=${encodeURIComponent(username)}&page[size]=1`);
      const pilot = resp?.data && Array.isArray(resp.data) && resp.data.length ? resp.data[0] : null;
      if (pilot) return { pilot: normalizePilotNode(pilot), matchType: "operations_username" };
    }

    // Roster fallback
    const rosterMatch = await findPilotInRoster({
      id: String(profile?.id || profile?.sub || profile?.pilot?.id || ""),
      username,
      email: String(profile?.email || profile?.user?.email || ""),
      name: String(profile?.name || profile?.user?.name || profile?.pilot?.name || ""),
    });
    if (rosterMatch) return { pilot: rosterMatch, matchType: "roster" };
  } catch (err) {
    // swallow errors and return null
  }

  return null;
};

const loadSummaryStats = async () => {
  const now = Date.now();
  if (summaryCache.data && now < summaryCache.expiresAt) {
    return summaryCache.data;
  }

  let general = null;
  try {
    general = await apiFetch("/statistics/general");
  } catch (err) {
    logVamsys("warn", "statistics_general_fetch_failed", { error: String(err) });
    general = null;
  }

  let pilots = general?.data?.pilots?.current ?? null;
  let pirepsTotal = general?.data?.pireps?.total ?? null;
  let flightTimeSeconds = general?.data?.flightTime?.seconds ?? null;
  let flightHours = typeof flightTimeSeconds === "number" ? Math.round(flightTimeSeconds / 3600) : null;

  // Fallback: if general stats unavailable, aggregate from pireps list
  if (!general) {
    try {
      const pageSize = 200;
      const pireps = await fetchAllPages(`/pireps?page[size]=${pageSize}&sort=-created_at`);
      if (Array.isArray(pireps)) {
        pirepsTotal = pireps.length;
        const totalSeconds = pireps.reduce((acc, p) => acc + (Number(p?.flight_length) || 0), 0);
        flightHours = totalSeconds > 0 ? Math.round(totalSeconds / 3600) : 0;
      }
    } catch (e) {
      logVamsys("warn", "statistics_fallback_pireps_failed", { error: String(e) });
      pirepsTotal = pirepsTotal ?? null;
      flightHours = flightHours ?? null;
    }
  }

  const fleetSnapshot = await loadFleetData().catch(() => null);
  const aircraftTotal = Array.isArray(fleetSnapshot?.fleets)
    ? fleetSnapshot.fleets.reduce((total, fleet) => {
        const aircraftCount = Array.isArray(fleet?.aircraft) ? fleet.aircraft.length : 0;
        return total + aircraftCount;
      }, 0)
    : 0;

  const payload = {
    pilots,
    pirepsTotal,
    aircraftTotal,
    flightHours,
  };

  summaryCache = {
    data: payload,
    expiresAt: now + 10 * 60 * 1000,
  };

  return payload;
};

const loadFleetData = async () => {
  if (fleetCache.data) {
    return fleetCache.data;
  }

  await ensureUnifiedCatalogReady().catch(() => undefined);
  if (unifiedCatalogCache.fleetsById.size > 0) {
    const payload = {
      fleets: Array.from(unifiedCatalogCache.fleetsById.values()),
    };
    fleetCache = {
      data: payload,
      expiresAt: Number.MAX_SAFE_INTEGER,
    };
    persistFleetSnapshot(payload);
    return fleetCache.data;
  }

  const persistedSnapshot = readFleetSnapshotFromDisk();
  if (persistedSnapshot && Array.isArray(persistedSnapshot.fleets) && persistedSnapshot.fleets.length > 0) {
    fleetCache = {
      data: persistedSnapshot,
      expiresAt: Number.MAX_SAFE_INTEGER,
    };
    return fleetCache.data;
  }

  const fleets = await fetchAllPages("/fleet?page[size]=100");
  const colors = ["#E31E24", "#0066CC", "#FF6B00", "#2A2A2A"];

  const fleetData = [];
  for (const fleet of fleets) {
    if (!fleet?.id) {
      continue;
    }
    const aircraft = await fetchAllPages(
      `/fleet/${fleet.id}/aircraft?page[size]=100`
    );

    fleetData.push({
      id: fleet.id,
      name: fleet.name || fleet.code || `Fleet ${fleet.id}`,
      code: fleet.code || "",
      color: colors[fleetData.length % colors.length],
      aircraft: aircraft.map((item) => ({
        id: item.id,
        model: item.name || fleet.name || "",
        registration: item.registration || "",
        seats: item.passengers ?? fleet.max_pax ?? 0,
        range_nm:
          item.range_nm ??
          item.range ??
          item.max_range ??
          item.flight_range ??
          null,
        cruise_speed:
          item.cruise_speed ??
          item.speed ??
          item.cruise ??
          item.max_speed ??
          null,
        serviceable:
          item.serviceable ??
          item.is_serviceable ??
          item.available ??
          null,
      })),
    });
  }

  const payload = { fleets: fleetData };
  fleetCache = {
    data: payload,
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
  persistFleetSnapshot(payload);

  return fleetCache.data;
};

const normalizeRegistration = (value) => String(value || "").trim().toUpperCase();

const normalizeLiveryStatus = (payload = {}) => {
  if (payload?.approved) {
    return "approved";
  }
  if (payload?.rejected) {
    return "rejected";
  }
  if (payload?.ignored) {
    return "ignored";
  }
  return "pending";
};

const normalizeLiveryRecord = (payload = {}) => ({
  id: Number(payload?.id || 0) || 0,
  airlineId: Number(payload?.airline_id || 0) || null,
  fleetId: Number(payload?.fleet_id || 0) || null,
  name: String(payload?.name || payload?.livery || "Livery").trim() || "Livery",
  aircraft: String(payload?.aircraft || "").trim() || null,
  aircraftType: String(payload?.aircraft_type || "").trim().toUpperCase() || null,
  addon: String(payload?.addon || "").trim() || null,
  liveryCode: String(payload?.livery || "").trim() || null,
  approved: Boolean(payload?.approved),
  rejected: Boolean(payload?.rejected),
  ignored: Boolean(payload?.ignored),
  status: normalizeLiveryStatus(payload),
  bookingId: Number(payload?.booking_id || 0) || null,
  pirepsCount: Number(payload?.pireps_count || 0) || 0,
  internalNote: String(payload?.internal_note || "").trim() || null,
  pirepUsage: Array.isArray(payload?.pirep_usage)
    ? payload.pirep_usage.map((item) => ({
        pirepId: Number(item?.pirep_id || 0) || null,
        bookingId: Number(item?.booking_id || 0) || null,
        createdAt: String(item?.created_at || "").trim() || null,
      }))
    : [],
  createdAt: String(payload?.created_at || "").trim() || null,
  updatedAt: String(payload?.updated_at || "").trim() || null,
});

const normalizeAircraftDisplayName = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const upper = text.toUpperCase();
  if (upper === "N/A" || upper === "NONE" || upper === "NULL" || upper === "UNKNOWN" || upper === "—") {
    return "";
  }

  return text;
};

const loadAircraftDetailsByFleetAndId = async (fleetId, aircraftId) => {
  const numericFleetId = Number(fleetId || 0) || 0;
  const numericAircraftId = Number(aircraftId || 0) || 0;
  if (numericFleetId <= 0 || numericAircraftId <= 0) {
    return null;
  }

  const now = Date.now();
  const cacheKey = `${numericFleetId}:${numericAircraftId}`;

  if (now >= aircraftDetailsCache.expiresAt) {
    aircraftDetailsCache = {
      byKey: new Map(),
      expiresAt: now + 10 * 60 * 1000,
    };
  }

  if (aircraftDetailsCache.byKey.has(cacheKey)) {
    return aircraftDetailsCache.byKey.get(cacheKey);
  }

  try {
    const details = await apiFetch(`/fleet/${numericFleetId}/aircraft/${numericAircraftId}`);
    const node = details?.data && typeof details.data === "object" ? details.data : details;
    aircraftDetailsCache.byKey.set(cacheKey, node || null);
    return node || null;
  } catch {
    aircraftDetailsCache.byKey.set(cacheKey, null);
    return null;
  }
};

const normalizeDashboardText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const normalizeDashboardUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  return /^https?:\/\//i.test(text) ? text : null;
};

const createDashboardResourceItem = (candidate, defaultType = "resource") => {
  if (!candidate) {
    return null;
  }

  if (typeof candidate === "string") {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }
    return {
      type: defaultType,
      label: trimmed,
      url: normalizeDashboardUrl(trimmed),
    };
  }

  if (typeof candidate !== "object") {
    return null;
  }

  const label =
    normalizeDashboardText(candidate.label) ||
    normalizeDashboardText(candidate.title) ||
    normalizeDashboardText(candidate.name) ||
    normalizeDashboardText(candidate.filename) ||
    normalizeDashboardText(candidate.type) ||
    "Resource";

  return {
    type: normalizeDashboardText(candidate.type) || defaultType,
    label,
    url:
      normalizeDashboardUrl(candidate.url) ||
      normalizeDashboardUrl(candidate.href) ||
      normalizeDashboardUrl(candidate.link) ||
      normalizeDashboardUrl(candidate.download_url) ||
      normalizeDashboardUrl(candidate.downloadUrl) ||
      normalizeDashboardUrl(candidate.file),
  };
};

const collectDashboardResourceItems = (value, defaultType = "resource") => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => createDashboardResourceItem(item, defaultType)).filter(Boolean);
  }

  if (typeof value === "object") {
    if (Array.isArray(value.items)) {
      return collectDashboardResourceItems(value.items, defaultType);
    }
    if (Array.isArray(value.data)) {
      return collectDashboardResourceItems(value.data, defaultType);
    }
    return [createDashboardResourceItem(value, defaultType)].filter(Boolean);
  }

  return [createDashboardResourceItem(value, defaultType)].filter(Boolean);
};

const dedupeDashboardResourceItems = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${String(item?.type || "resource").trim().toLowerCase()}|${String(item?.label || "").trim().toLowerCase()}|${String(item?.url || "").trim().toLowerCase()}`;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const extractDashboardAircraftResources = (details) => {
  if (!details || typeof details !== "object") {
    return { liveries: [], scenarios: [], links: [] };
  }

  const liveries = dedupeDashboardResourceItems([
    ...collectDashboardResourceItems(details?.liveries, "livery"),
    ...collectDashboardResourceItems(details?.livery, "livery"),
    ...collectDashboardResourceItems(details?.paints, "livery"),
    ...collectDashboardResourceItems(details?.paintkits, "livery"),
  ]);

  const scenarios = dedupeDashboardResourceItems([
    ...collectDashboardResourceItems(details?.scenarios, "scenario"),
    ...collectDashboardResourceItems(details?.scenario, "scenario"),
    ...collectDashboardResourceItems(details?.scenery, "scenario"),
    ...collectDashboardResourceItems(details?.sceneries, "scenario"),
    ...collectDashboardResourceItems(details?.profiles, "scenario"),
  ]);

  const links = dedupeDashboardResourceItems([
    ...collectDashboardResourceItems(details?.links, "resource"),
    ...collectDashboardResourceItems(details?.resources, "resource"),
    ...collectDashboardResourceItems(details?.downloads, "resource"),
    ...collectDashboardResourceItems(details?.documents, "resource"),
    ...collectDashboardResourceItems(details?.docs, "resource"),
  ]).filter(
    (item) =>
      !liveries.some((entry) => entry.label === item.label && entry.url === item.url) &&
      !scenarios.some((entry) => entry.label === item.label && entry.url === item.url)
  );

  return { liveries, scenarios, links };
};

const extractDashboardAircraftImageUrl = (details) =>
  normalizeDashboardUrl(details?.image_url) ||
  normalizeDashboardUrl(details?.imageUrl) ||
  normalizeDashboardUrl(details?.thumbnail_url) ||
  normalizeDashboardUrl(details?.thumbnailUrl) ||
  normalizeDashboardUrl(details?.preview_url) ||
  normalizeDashboardUrl(details?.previewUrl) ||
  normalizeDashboardUrl(details?.photo_url) ||
  normalizeDashboardUrl(details?.photoUrl) ||
  normalizeDashboardUrl(details?.image);

const loadDashboardFleetCatalog = async () => {
  const [fleetPayload, hubs] = await Promise.all([
    getManagedFleetCatalog().catch(() => ({ fleets: [] })),
    loadAdminHubsCatalog().catch(() => []),
  ]);

  const hubById = new Map((Array.isArray(hubs) ? hubs : []).map((hub) => [String(hub?.id || ""), hub]));
  const fleets = await Promise.all(
    (Array.isArray(fleetPayload?.fleets) ? fleetPayload.fleets : []).map(async (fleet) => {
      const fleetId = Number(fleet?.id || 0) || 0;
      const baseHub = hubById.get(String(fleet?.baseHubId || "")) || null;
      const liveries = fleetId > 0 ? await loadFleetLiveriesByFleetId(fleetId).catch(() => []) : [];
      const aircraft = await Promise.all(
        (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map(async (item) => {
          const aircraftId = Number(item?.id || 0) || 0;
          const details =
            fleetId > 0 && aircraftId > 0
              ? await loadAircraftDetailsByFleetAndId(fleetId, aircraftId).catch(() => null)
              : null;
          const resources = extractDashboardAircraftResources(details || {});
          const aircraftBaseHub = hubById.get(String(item?.baseHubId || "")) || null;

          return {
            ...item,
            description:
              normalizeDashboardText(details?.description) ||
              normalizeDashboardText(details?.summary) ||
              normalizeDashboardText(details?.info) ||
              null,
            notes: normalizeDashboardText(item?.notes) || normalizeDashboardText(details?.notes),
            imageUrl: extractDashboardAircraftImageUrl(details || {}),
            liveries: resources.liveries,
            scenarios: resources.scenarios,
            links: resources.links,
            baseHub: aircraftBaseHub
              ? {
                  id: aircraftBaseHub.id,
                  name: aircraftBaseHub.name,
                  airportsText: aircraftBaseHub.airportsText,
                }
              : null,
          };
        })
      );

      return {
        ...fleet,
        baseHub: baseHub
          ? {
              id: baseHub.id,
              name: baseHub.name,
              airportsText: baseHub.airportsText,
            }
          : null,
        liveries,
        aircraft,
      };
    })
  );

  return { fleets };
};

const loadDashboardAirportsCatalog = async () => {
  const airportsMap = await loadAirportsLookup().catch(() => new Map());

  return Array.from(airportsMap.values())
    .map((airport) => ({
      id: Number(airport?.id || 0) || 0,
      code: String(airport?.code || airport?.icao || airport?.iata || "").trim() || "вЂ”",
      icao: normalizeDashboardText(airport?.icao),
      iata: normalizeDashboardText(airport?.iata),
      city: normalizeDashboardText(airport?.city),
      name: String(airport?.name || airport?.code || "Airport").trim() || "Airport",
      category: normalizeDashboardText(airport?.category),
      base: Boolean(airport?.base),
      suitableAlternate: Boolean(airport?.suitableAlternate),
      taxiInMinutes: Number(airport?.taxiInMinutes || 0) || 0,
      taxiOutMinutes: Number(airport?.taxiOutMinutes || 0) || 0,
      airportBriefingUrl: normalizeDashboardUrl(airport?.airportBriefingUrl),
      preferredAlternates: Array.isArray(airport?.preferredAlternates) ? airport.preferredAlternates : [],
      countryName: normalizeDashboardText(airport?.countryName),
      countryIso2: normalizeDashboardText(airport?.countryIso2),
      latitude: Number(airport?.latitude || 0) || null,
      longitude: Number(airport?.longitude || 0) || null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

const buildDashboardFleetFallbackCatalog = async () => {
  const [fleetPayload, hubs] = await Promise.all([
    getManagedFleetCatalog().catch(() => ({ fleets: [] })),
    loadAdminHubsCatalog().catch(() => []),
  ]);

  const hubById = new Map((Array.isArray(hubs) ? hubs : []).map((hub) => [String(hub?.id || ""), hub]));
  const fleets = (Array.isArray(fleetPayload?.fleets) ? fleetPayload.fleets : []).map((fleet) => {
    const baseHub = hubById.get(String(fleet?.baseHubId || "")) || null;
    return {
      ...fleet,
      baseHub: baseHub
        ? {
            id: baseHub.id,
            name: baseHub.name,
            airportsText: baseHub.airportsText,
          }
        : null,
      liveries: Array.isArray(fleet?.liveries) ? fleet.liveries : [],
      aircraft: (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map((item) => {
        const aircraftBaseHub = hubById.get(String(item?.baseHubId || "")) || null;
        return {
          ...item,
          description: normalizeDashboardText(item?.description),
          notes: normalizeDashboardText(item?.notes),
          imageUrl: normalizeDashboardUrl(item?.imageUrl || item?.image_url || item?.image),
          liveries: Array.isArray(item?.liveries) ? item.liveries : [],
          scenarios: Array.isArray(item?.scenarios) ? item.scenarios : [],
          links: Array.isArray(item?.links) ? item.links : [],
          baseHub: aircraftBaseHub
            ? {
                id: aircraftBaseHub.id,
                name: aircraftBaseHub.name,
                airportsText: aircraftBaseHub.airportsText,
              }
            : null,
        };
      }),
    };
  });

  return { fleets };
};

const buildDashboardAirportsFallbackCatalog = async () => {
  const airportsMap = await loadAirportsLookup().catch(() => new Map());
  return Array.from(airportsMap.values()).sort((left, right) =>
    String(left?.name || "").localeCompare(String(right?.name || ""))
  );
};

const loadFleetLiveriesByFleetId = async (fleetId) => {
  const numericFleetId = Number(fleetId || 0) || 0;
  if (numericFleetId <= 0) {
    return [];
  }

  const now = Date.now();
  if (now >= fleetLiveriesCache.expiresAt) {

    /* =========================================================
     * Dashboard helper utilities (module-level scope required
     * for /api/vamsys/dashboard/fleet and /airports endpoints)
     * =========================================================*/
    const normalizeDashboardText = (value) => {
      const text = String(value || "").trim();
      return text || null;
    };

    const normalizeDashboardUrl = (value) => {
      const text = String(value || "").trim();
      if (!text) return null;
      if (/^https?:\/\//i.test(text)) return text;
      return null;
    };

    const createDashboardResourceItem = (candidate, defaultType = "resource") => {
      if (!candidate) return null;
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (!trimmed) return null;
        return { type: defaultType, label: trimmed, url: normalizeDashboardUrl(trimmed) };
      }
      if (typeof candidate !== "object") return null;
      const label =
        normalizeDashboardText(candidate.label) ||
        normalizeDashboardText(candidate.title) ||
        normalizeDashboardText(candidate.name) ||
        normalizeDashboardText(candidate.filename) ||
        normalizeDashboardText(candidate.type) ||
        "Resource";
      return {
        type: normalizeDashboardText(candidate.type) || defaultType,
        label,
        url:
          normalizeDashboardUrl(candidate.url) ||
          normalizeDashboardUrl(candidate.href) ||
          normalizeDashboardUrl(candidate.link) ||
          normalizeDashboardUrl(candidate.download_url) ||
          normalizeDashboardUrl(candidate.downloadUrl) ||
          normalizeDashboardUrl(candidate.file),
      };
    };

    const collectDashboardResourceItems = (value, defaultType = "resource") => {
      if (!value) return [];
      if (Array.isArray(value)) {
        return value.map((item) => createDashboardResourceItem(item, defaultType)).filter(Boolean);
      }
      if (typeof value === "object") {
        if (Array.isArray(value.items)) return collectDashboardResourceItems(value.items, defaultType);
        if (Array.isArray(value.data)) return collectDashboardResourceItems(value.data, defaultType);
        return [createDashboardResourceItem(value, defaultType)].filter(Boolean);
      }
      return [createDashboardResourceItem(value, defaultType)].filter(Boolean);
    };

    const dedupeDashboardResourceItems = (items = []) => {
      const seen = new Set();
      return items.filter((item) => {
        const key = `${String(item?.type || "resource").trim().toLowerCase()}|${String(item?.label || "").trim().toLowerCase()}|${String(item?.url || "").trim().toLowerCase()}`;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const extractDashboardAircraftResources = (details) => {
      if (!details || typeof details !== "object") return { liveries: [], scenarios: [], links: [] };
      const liveries = dedupeDashboardResourceItems([
        ...collectDashboardResourceItems(details?.liveries, "livery"),
        ...collectDashboardResourceItems(details?.livery, "livery"),
        ...collectDashboardResourceItems(details?.paints, "livery"),
        ...collectDashboardResourceItems(details?.paintkits, "livery"),
      ]);
      const scenarios = dedupeDashboardResourceItems([
        ...collectDashboardResourceItems(details?.scenarios, "scenario"),
        ...collectDashboardResourceItems(details?.scenario, "scenario"),
        ...collectDashboardResourceItems(details?.scenery, "scenario"),
        ...collectDashboardResourceItems(details?.sceneries, "scenario"),
        ...collectDashboardResourceItems(details?.profiles, "scenario"),
      ]);
      const links = dedupeDashboardResourceItems([
        ...collectDashboardResourceItems(details?.links, "resource"),
        ...collectDashboardResourceItems(details?.resources, "resource"),
        ...collectDashboardResourceItems(details?.downloads, "resource"),
        ...collectDashboardResourceItems(details?.documents, "resource"),
        ...collectDashboardResourceItems(details?.docs, "resource"),
      ]).filter((item) => !liveries.some((e) => e.label === item.label && e.url === item.url) && !scenarios.some((e) => e.label === item.label && e.url === item.url));
      return { liveries, scenarios, links };
    };

    const extractDashboardAircraftImageUrl = (details) => (
      normalizeDashboardUrl(details?.image_url) ||
      normalizeDashboardUrl(details?.imageUrl) ||
      normalizeDashboardUrl(details?.thumbnail_url) ||
      normalizeDashboardUrl(details?.thumbnailUrl) ||
      normalizeDashboardUrl(details?.preview_url) ||
      normalizeDashboardUrl(details?.previewUrl) ||
      normalizeDashboardUrl(details?.photo_url) ||
      normalizeDashboardUrl(details?.photoUrl) ||
      normalizeDashboardUrl(details?.image)
    );

    const loadDashboardFleetCatalog = async () => {
      const [fleetPayload, hubs] = await Promise.all([
        getManagedFleetCatalog().catch(() => ({ fleets: [] })),
        loadAdminHubsCatalog().catch(() => []),
      ]);
      const hubById = new Map((Array.isArray(hubs) ? hubs : []).map((hub) => [String(hub?.id || ""), hub]));
      const fleets = await Promise.all(
        (Array.isArray(fleetPayload?.fleets) ? fleetPayload.fleets : []).map(async (fleet) => {
          const fleetId = Number(fleet?.id || 0) || 0;
          const baseHub = hubById.get(String(fleet?.baseHubId || "")) || null;
          const liveries = fleetId > 0 ? await loadFleetLiveriesByFleetId(fleetId).catch(() => []) : [];
          const aircraft = await Promise.all(
            (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map(async (item) => {
              const aircraftId = Number(item?.id || 0) || 0;
              const details =
                fleetId > 0 && aircraftId > 0
                  ? await loadAircraftDetailsByFleetAndId(fleetId, aircraftId).catch(() => null)
                  : null;
              const resources = extractDashboardAircraftResources(details || {});
              const aircraftBaseHub = hubById.get(String(item?.baseHubId || "")) || null;
              return {
                ...item,
                description:
                  normalizeDashboardText(details?.description) ||
                  normalizeDashboardText(details?.summary) ||
                  normalizeDashboardText(details?.info) ||
                  null,
                notes: normalizeDashboardText(item?.notes) || normalizeDashboardText(details?.notes),
                imageUrl: extractDashboardAircraftImageUrl(details || {}),
                liveries: resources.liveries,
                scenarios: resources.scenarios,
                links: resources.links,
                baseHub: aircraftBaseHub ? { id: aircraftBaseHub.id, name: aircraftBaseHub.name, airportsText: aircraftBaseHub.airportsText } : null,
              };
            })
          );
          return {
            ...fleet,
            baseHub: baseHub ? { id: baseHub.id, name: baseHub.name, airportsText: baseHub.airportsText } : null,
            liveries,
            aircraft,
          };
        })
      );
      return { fleets };
    };

    const loadDashboardAirportsCatalog = async () => {
      const airportsMap = await loadAirportsLookup().catch(() => new Map());
      return Array.from(airportsMap.values())
        .map((airport) => ({
          id: Number(airport?.id || 0) || 0,
          code: String(airport?.code || airport?.icao || airport?.iata || "").trim() || "—",
          icao: normalizeDashboardText(airport?.icao),
          iata: normalizeDashboardText(airport?.iata),
          city: normalizeDashboardText(airport?.city),
          name: String(airport?.name || airport?.code || "Airport").trim() || "Airport",
          category: normalizeDashboardText(airport?.category),
          base: Boolean(airport?.base),
          suitableAlternate: Boolean(airport?.suitableAlternate),
          taxiInMinutes: Number(airport?.taxiInMinutes || 0) || 0,
          taxiOutMinutes: Number(airport?.taxiOutMinutes || 0) || 0,
          airportBriefingUrl: normalizeDashboardUrl(airport?.airportBriefingUrl),
          preferredAlternates: Array.isArray(airport?.preferredAlternates) ? airport.preferredAlternates : [],
          countryName: normalizeDashboardText(airport?.countryName),
          countryIso2: normalizeDashboardText(airport?.countryIso2),
          latitude: Number(airport?.latitude || 0) || null,
          longitude: Number(airport?.longitude || 0) || null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    };
    /* ========================================================= */
    fleetLiveriesCache = {
      byFleetId: new Map(),
      expiresAt: now + 10 * 60 * 1000,
    };
  }

  if (fleetLiveriesCache.byFleetId.has(numericFleetId)) {
    return fleetLiveriesCache.byFleetId.get(numericFleetId) || [];
  }

  try {
    const items = await fetchAllPages(`/fleet/${numericFleetId}/liveries?page[size]=100&sort=-updated_at`);
    const normalized = (Array.isArray(items) ? items : []).map((item) => normalizeLiveryRecord(item));
    fleetLiveriesCache.byFleetId.set(numericFleetId, normalized);
    return normalized;
  } catch (error) {
    logger.warn("[liveries] list_load_failed", { fleetId: numericFleetId, error: String(error) });
    fleetLiveriesCache.byFleetId.set(numericFleetId, []);
    return [];
  }
};

const loadFleetLiveryDetail = async (fleetId, liveryId, { pirepLimit = 10 } = {}) => {
  const numericFleetId = Number(fleetId || 0) || 0;
  const numericLiveryId = Number(liveryId || 0) || 0;
  if (numericFleetId <= 0 || numericLiveryId <= 0) {
    return null;
  }

  const now = Date.now();
  const cacheKey = `${numericFleetId}:${numericLiveryId}:${Number(pirepLimit || 10) || 10}`;
  if (now >= fleetLiveryDetailsCache.expiresAt) {
    fleetLiveryDetailsCache = {
      byKey: new Map(),
      expiresAt: now + 5 * 60 * 1000,
    };
  }

  if (fleetLiveryDetailsCache.byKey.has(cacheKey)) {
    return fleetLiveryDetailsCache.byKey.get(cacheKey) || null;
  }

  try {
    const payload = await apiFetch(`/fleet/${numericFleetId}/liveries/${numericLiveryId}?pirep_limit=${Math.max(0, Number(pirepLimit || 10) || 10)}`);
    const raw = payload?.data && typeof payload.data === "object" ? flattenJsonApiNode(payload.data) : payload;
    const normalized = raw ? normalizeLiveryRecord(raw) : null;
    fleetLiveryDetailsCache.byKey.set(cacheKey, normalized);
    return normalized;
  } catch (error) {
    logger.warn("[liveries] detail_load_failed", { fleetId: numericFleetId, liveryId: numericLiveryId, error: String(error) });
    fleetLiveryDetailsCache.byKey.set(cacheKey, null);
    return null;
  }
};

const updateFleetLiveryStatus = async (fleetId, liveryId, payload = {}) => {
  const numericFleetId = Number(fleetId || 0) || 0;
  const numericLiveryId = Number(liveryId || 0) || 0;
  if (numericFleetId <= 0 || numericLiveryId <= 0) {
    throw new Error("Invalid fleet or livery id");
  }

  const nextPayload = {};
  if (typeof payload?.approved === "boolean") {
    nextPayload.approved = payload.approved;
  }
  if (typeof payload?.rejected === "boolean") {
    nextPayload.rejected = payload.rejected;
  }
  if (typeof payload?.ignored === "boolean") {
    nextPayload.ignored = payload.ignored;
  }
  if (payload?.internal_note === null || typeof payload?.internal_note === "string") {
    nextPayload.internal_note = payload.internal_note == null ? null : String(payload.internal_note).trim() || null;
  }
  if (payload?.process_pireps === null || typeof payload?.process_pireps === "boolean") {
    nextPayload.process_pireps = payload.process_pireps;
  }

  const truthyStates = [nextPayload.approved, nextPayload.rejected, nextPayload.ignored].filter(Boolean).length;
  if (truthyStates > 1) {
    throw new Error("Only one livery status can be true");
  }

  const response = await apiRequest(`/fleet/${numericFleetId}/liveries/${numericLiveryId}`, {
    method: "PUT",
    body: nextPayload,
  });
  const raw = response?.data && typeof response.data === "object" ? flattenJsonApiNode(response.data) : response;
  const normalized = normalizeLiveryRecord(raw || {});

  if (fleetLiveriesCache.byFleetId.has(numericFleetId)) {
    const current = fleetLiveriesCache.byFleetId.get(numericFleetId) || [];
    fleetLiveriesCache.byFleetId.set(
      numericFleetId,
      current.map((item) => (item.id === numericLiveryId ? { ...item, ...normalized } : item))
    );
  }
  fleetLiveryDetailsCache.byKey = new Map(
    Array.from(fleetLiveryDetailsCache.byKey.entries()).filter(([key]) => !String(key).startsWith(`${numericFleetId}:${numericLiveryId}:`))
  );

  return normalized;
};

const loadAircraftLookup = async () => {
  if (aircraftLookupCache.byId && aircraftLookupCache.byRegistration) {
    return aircraftLookupCache;
  }

  const fleetPayload = await loadFleetData();
  const fleets = Array.isArray(fleetPayload?.fleets) ? fleetPayload.fleets : [];
  const byId = new Map();
  const byRegistration = new Map();

  for (const fleet of fleets) {
    const aircraft = Array.isArray(fleet?.aircraft) ? fleet.aircraft : [];
    for (const item of aircraft) {
      const label =
        String(
          item?.name ||
            item?.type ||
            item?.aircraft_type ||
            item?.model ||
            fleet?.name ||
            ""
        ).trim() || "—";

      const id = Number(item?.id || 0) || 0;
      if (id > 0) {
        byId.set(id, label);
      }

      const registration = normalizeRegistration(item?.registration || item?.tail || item?.ident || "");
      if (registration) {
        byRegistration.set(registration, label);
      }
    }
  }

  aircraftLookupCache = {
    byId,
    byRegistration,
    expiresAt: Number.MAX_SAFE_INTEGER,
  };

  return aircraftLookupCache;
};

const resolveAircraftLabelFromPirep = async (pirep) => {
  const pirepAircraft =
    pirep?.aircraft && typeof pirep.aircraft === "object" ? pirep.aircraft : {};
  const directLabel = String(
    (typeof pirep?.aircraft === "string" ? pirep.aircraft : "") ||
      pirep?.aircraft_name ||
      pirep?.aircraft_type ||
      pirep?.aircraftType ||
      pirep?.aircraft_registration ||
      pirep?.registration ||
      pirep?.tail ||
      pirepAircraft?.name ||
      pirepAircraft?.type ||
      pirepAircraft?.registration ||
      ""
  ).trim();

  if (directLabel) {
    return directLabel;
  }

  const lookup = await loadAircraftLookup().catch(() => null);
  if (!lookup) {
    return "—";
  }

  const aircraftId = Number(
    pirep?.aircraft_id || pirep?.aircraftId || pirepAircraft?.id || 0
  ) || 0;
  if (aircraftId > 0) {
    const byId = lookup.byId?.get(aircraftId);
    if (byId) {
      return byId;
    }
  }

  const fleetId = Number(
    pirep?.fleet_id || pirep?.fleetId || pirepAircraft?.fleet_id || pirepAircraft?.fleetId || 0
  ) || 0;

  if (fleetId > 0 && aircraftId > 0) {
    const details = await loadAircraftDetailsByFleetAndId(fleetId, aircraftId).catch(() => null);
    const detailLabel = normalizeAircraftDisplayName(
      details?.name || details?.type || details?.aircraft_type || details?.model || ""
    );
    if (detailLabel) {
      return detailLabel;
    }

    const detailReg = normalizeRegistration(details?.registration || details?.tail || details?.ident || "");
    if (detailReg) {
      const byRegFromDetails = lookup.byRegistration?.get(detailReg);
      if (byRegFromDetails) {
        return byRegFromDetails;
      }
    }
  }

  const registration = normalizeRegistration(
    pirep?.aircraft_registration ||
      pirep?.registration ||
      pirep?.tail ||
      pirepAircraft?.registration ||
      ""
  );
  if (registration) {
    const byReg = lookup.byRegistration?.get(registration);
    if (byReg) {
      return byReg;
    }
  }

  return "—";
};

const loadRoutesData = async () => {
  const now = Date.now();
  if (routesCache.data && now < routesCache.expiresAt) {
    return routesCache.data;
  }

  await ensureUnifiedCatalogReady().catch(() => undefined);
  if (unifiedCatalogCache.routesById.size > 0) {
    const payload = {
      routes: Array.from(unifiedCatalogCache.routesById.values()),
    };
    routesCache = {
      data: payload,
      expiresAt: now + 5 * 60 * 1000,
    };
    return routesCache.data;
  }

  const getCoordinate = (airport, keys) => {
    for (const key of keys) {
      const value = airport?.[key];
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return null;
  };

  const airports = await fetchAllPages("/airports?page[size]=200");
  const airportMap = new Map();
  airports.forEach((airport) => {
    if (!airport?.id) {
      return;
    }
    const code = airport.icao || airport.iata || String(airport.id);
    airportMap.set(airport.id, {
      code,
      name: airport.name || code,
      lat: getCoordinate(airport, ["lat", "latitude", "coord_lat", "coords_lat"]),
      lon: getCoordinate(airport, ["lon", "lng", "longitude", "coord_lon", "coords_lon"]),
    });
  });

  const routes = await fetchAllPages("/routes?page[size]=200");
  const detectAirlineCode = (route) => {
    const callsign = String(route?.callsign || "").toUpperCase();
    if (callsign.includes("KAR")) {
      return "KAR";
    }

    const normalizeDashboardText = (value) => {
      const text = String(value || "").trim();
      return text || null;
    };

    const normalizeDashboardUrl = (value) => {
      const text = String(value || "").trim();
      if (!text) {
        return null;
      }

      if (/^https?:\/\//i.test(text)) {
        return text;
      }

      return null;
    };

    const createDashboardResourceItem = (candidate, defaultType = "resource") => {
      if (!candidate) {
        return null;
      }

      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (!trimmed) {
          return null;
        }

        return {
          type: defaultType,
          label: trimmed,
          url: normalizeDashboardUrl(trimmed),
        };
      }

      if (typeof candidate !== "object") {
        return null;
      }

      const label =
        normalizeDashboardText(candidate.label) ||
        normalizeDashboardText(candidate.title) ||
        normalizeDashboardText(candidate.name) ||
        normalizeDashboardText(candidate.filename) ||
        normalizeDashboardText(candidate.type) ||
        "Resource";

      return {
        type: normalizeDashboardText(candidate.type) || defaultType,
        label,
        url:
          normalizeDashboardUrl(candidate.url) ||
          normalizeDashboardUrl(candidate.href) ||
          normalizeDashboardUrl(candidate.link) ||
          normalizeDashboardUrl(candidate.download_url) ||
          normalizeDashboardUrl(candidate.downloadUrl) ||
          normalizeDashboardUrl(candidate.file),
      };
    };

    const collectDashboardResourceItems = (value, defaultType = "resource") => {
      if (!value) {
        return [];
      }

      if (Array.isArray(value)) {
        return value
          .map((item) => createDashboardResourceItem(item, defaultType))
          .filter(Boolean);
      }

      if (typeof value === "object") {
        if (Array.isArray(value.items)) {
          return collectDashboardResourceItems(value.items, defaultType);
        }
        if (Array.isArray(value.data)) {
          return collectDashboardResourceItems(value.data, defaultType);
        }
        return [createDashboardResourceItem(value, defaultType)].filter(Boolean);
      }

      return [createDashboardResourceItem(value, defaultType)].filter(Boolean);
    };

    const dedupeDashboardResourceItems = (items = []) => {
      const seen = new Set();
      return items.filter((item) => {
        const key = `${String(item?.type || "resource").trim().toLowerCase()}|${String(item?.label || "").trim().toLowerCase()}|${String(item?.url || "").trim().toLowerCase()}`;
        if (!key || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    };

    const extractDashboardAircraftResources = (details) => {
      if (!details || typeof details !== "object") {
        return {
          liveries: [],
          scenarios: [],
          links: [],
        };
      }

      const liveries = dedupeDashboardResourceItems([
        ...collectDashboardResourceItems(details?.liveries, "livery"),
        ...collectDashboardResourceItems(details?.livery, "livery"),
        ...collectDashboardResourceItems(details?.paints, "livery"),
        ...collectDashboardResourceItems(details?.paintkits, "livery"),
      ]);

      const scenarios = dedupeDashboardResourceItems([
        ...collectDashboardResourceItems(details?.scenarios, "scenario"),
        ...collectDashboardResourceItems(details?.scenario, "scenario"),
        ...collectDashboardResourceItems(details?.scenery, "scenario"),
        ...collectDashboardResourceItems(details?.sceneries, "scenario"),
        ...collectDashboardResourceItems(details?.profiles, "scenario"),
      ]);

      const links = dedupeDashboardResourceItems([
        ...collectDashboardResourceItems(details?.links, "resource"),
        ...collectDashboardResourceItems(details?.resources, "resource"),
        ...collectDashboardResourceItems(details?.downloads, "resource"),
        ...collectDashboardResourceItems(details?.documents, "resource"),
        ...collectDashboardResourceItems(details?.docs, "resource"),
      ]).filter((item) => !liveries.some((entry) => entry.label === item.label && entry.url === item.url) && !scenarios.some((entry) => entry.label === item.label && entry.url === item.url));

      return {
        liveries,
        scenarios,
        links,
      };
    };

    const extractDashboardAircraftImageUrl = (details) => {
      return (
        normalizeDashboardUrl(details?.image_url) ||
        normalizeDashboardUrl(details?.imageUrl) ||
        normalizeDashboardUrl(details?.thumbnail_url) ||
        normalizeDashboardUrl(details?.thumbnailUrl) ||
        normalizeDashboardUrl(details?.preview_url) ||
        normalizeDashboardUrl(details?.previewUrl) ||
        normalizeDashboardUrl(details?.photo_url) ||
        normalizeDashboardUrl(details?.photoUrl) ||
        normalizeDashboardUrl(details?.image)
      );
    };

    const loadDashboardFleetCatalog = async () => {
      const [fleetPayload, hubs] = await Promise.all([
        getManagedFleetCatalog().catch(() => ({ fleets: [] })),
        loadAdminHubsCatalog().catch(() => []),
      ]);

      const hubById = new Map(
        (Array.isArray(hubs) ? hubs : []).map((hub) => [String(hub?.id || ""), hub])
      );

      const fleets = await Promise.all(
        (Array.isArray(fleetPayload?.fleets) ? fleetPayload.fleets : []).map(async (fleet) => {
          const fleetId = Number(fleet?.id || 0) || 0;
          const baseHub = hubById.get(String(fleet?.baseHubId || "")) || null;
          const liveries = fleetId > 0 ? await loadFleetLiveriesByFleetId(fleetId).catch(() => []) : [];
          const aircraft = await Promise.all(
            (Array.isArray(fleet?.aircraft) ? fleet.aircraft : []).map(async (item) => {
              const aircraftId = Number(item?.id || 0) || 0;
              const details =
                fleetId > 0 && aircraftId > 0
                  ? await loadAircraftDetailsByFleetAndId(fleetId, aircraftId).catch(() => null)
                  : null;
              const resources = extractDashboardAircraftResources(details || {});
              const aircraftBaseHub = hubById.get(String(item?.baseHubId || "")) || null;

              return {
                ...item,
                description:
                  normalizeDashboardText(details?.description) ||
                  normalizeDashboardText(details?.summary) ||
                  normalizeDashboardText(details?.info) ||
                  null,
                notes: normalizeDashboardText(item?.notes) || normalizeDashboardText(details?.notes),
                imageUrl: extractDashboardAircraftImageUrl(details || {}),
                liveries: resources.liveries,
                scenarios: resources.scenarios,
                links: resources.links,
                baseHub: aircraftBaseHub
                  ? {
                      id: aircraftBaseHub.id,
                      name: aircraftBaseHub.name,
                      airportsText: aircraftBaseHub.airportsText,
                    }
                  : null,
              };
            })
          );

          return {
            ...fleet,
            baseHub: baseHub
              ? {
                  id: baseHub.id,
                  name: baseHub.name,
                  airportsText: baseHub.airportsText,
                }
              : null,
            liveries,
            aircraft,
          };
        })
      );

      return { fleets };
    };

    const loadDashboardAirportsCatalog = async () => {
      const airportsMap = await loadAirportsLookup().catch(() => new Map());

      return Array.from(airportsMap.values())
        .map((airport) => ({
          id: Number(airport?.id || 0) || 0,
          code: String(airport?.code || airport?.icao || airport?.iata || "").trim() || "—",
          icao: normalizeDashboardText(airport?.icao),
          iata: normalizeDashboardText(airport?.iata),
          city: normalizeDashboardText(airport?.city),
          name: String(airport?.name || airport?.code || "Airport").trim() || "Airport",
          category: normalizeDashboardText(airport?.category),
          base: Boolean(airport?.base),
          suitableAlternate: Boolean(airport?.suitableAlternate),
          taxiInMinutes: Number(airport?.taxiInMinutes || 0) || 0,
          taxiOutMinutes: Number(airport?.taxiOutMinutes || 0) || 0,
          airportBriefingUrl: normalizeDashboardUrl(airport?.airportBriefingUrl),
          preferredAlternates: Array.isArray(airport?.preferredAlternates) ? airport.preferredAlternates : [],
          countryName: normalizeDashboardText(airport?.countryName),
          countryIso2: normalizeDashboardText(airport?.countryIso2),
          latitude: Number(airport?.latitude || 0) || null,
          longitude: Number(airport?.longitude || 0) || null,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
    };
    if (callsign.includes("STW")) {
      return "STW";
    }
    return "NWS";
  };

  const mapped = routes.map((route) => {
    const departure = airportMap.get(route.departure_id) || { code: "", name: "", lat: null, lon: null };
    const arrival = airportMap.get(route.arrival_id) || { code: "", name: "", lat: null, lon: null };
    const distance = route.flight_distance ? `${route.flight_distance} nm` : "—";
    const duration = route.flight_length || "—";

    let frequency = "daily";
    const serviceDays = route.service_days || route.serviceDays || null;
    if (Array.isArray(serviceDays) && serviceDays.length > 0) {
      if (serviceDays.length <= 3) {
        frequency = "weekly3";
      } else if (serviceDays.length <= 5) {
        frequency = "weekly5";
      }
    }

    return {
      id: route.id,
      type: route.type || "scheduled",
      callsign: route.callsign || "",
      flightNumber: route.flight_number || route.callsign || "",
      routeText: String(route.route || route.route_text || route.routing || route.flight_plan || route.flightPlan || "").trim(),
      airlineCode: detectAirlineCode(route),
      fleetIds: Array.isArray(route.fleet_ids) ? route.fleet_ids : [],
      departureId: route.departure_id || null,
      arrivalId: route.arrival_id || null,
      serviceDays: Array.isArray(route.service_days) ? route.service_days : [],
      from: `${departure.name} (${departure.code})`.trim(),
      to: `${arrival.name} (${arrival.code})`.trim(),
      fromCode: departure.code,
      fromName: departure.name,
      fromLat: departure.lat,
      fromLon: departure.lon,
      toCode: arrival.code,
      toName: arrival.name,
      toLat: arrival.lat,
      toLon: arrival.lon,
      distance,
      duration,
      frequency,
    };
  });

  routesCache = {
    data: { routes: mapped },
    expiresAt: now + 10 * 60 * 1000,
  };

  return routesCache.data;
};

const normalizeTelemetryCoordinatePair = (firstValue, secondValue) => {
  const first = Number(firstValue);
  const second = Number(secondValue);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return null;
  }

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return { lat: first, lon: second };
  }

  if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
    return { lat: second, lon: first };
  }

  return null;
};

const normalizeTelemetryPointRecord = (point, fallbackIndex = 0) => {
  if (Array.isArray(point) && point.length >= 2) {
    const pair = normalizeTelemetryCoordinatePair(point[0], point[1]);
    if (pair) {
      return {
        lat: pair.lat,
        lon: pair.lon,
        altitude: null,
        heading: null,
        ts: null,
        idx: fallbackIndex,
      };
    }
  }

  if (!point || typeof point !== "object") {
    return null;
  }

  const pointRecord = {
    ...(point?.attributes && typeof point.attributes === "object" ? point.attributes : {}),
    ...point,
  };

  const pairFromGeometry =
    (Array.isArray(pointRecord?.geometry?.coordinates) && normalizeTelemetryCoordinatePair(pointRecord.geometry.coordinates[0], pointRecord.geometry.coordinates[1])) ||
    (Array.isArray(pointRecord?.location?.coordinates) && normalizeTelemetryCoordinatePair(pointRecord.location.coordinates[0], pointRecord.location.coordinates[1])) ||
    (Array.isArray(pointRecord?.position?.coordinates) && normalizeTelemetryCoordinatePair(pointRecord.position.coordinates[0], pointRecord.position.coordinates[1])) ||
    (Array.isArray(pointRecord?.coords?.coordinates) && normalizeTelemetryCoordinatePair(pointRecord.coords.coordinates[0], pointRecord.coords.coordinates[1])) ||
    (Array.isArray(pointRecord?.coordinates) && normalizeTelemetryCoordinatePair(pointRecord.coordinates[0], pointRecord.coordinates[1])) ||
    (Array.isArray(pointRecord?.coord) && normalizeTelemetryCoordinatePair(pointRecord.coord[0], pointRecord.coord[1])) ||
    null;

  const sourceLat =
    pointRecord.lat ??
    pointRecord.latitude ??
    pointRecord.currentLat ??
    pointRecord.current_lat ??
    pointRecord.positionLat ??
    pointRecord.position_lat ??
    pointRecord.position?.lat ??
    pointRecord.position?.latitude ??
    pointRecord.location?.lat ??
    pointRecord.location?.latitude ??
    pointRecord.coords?.lat ??
    pointRecord.coords?.latitude ??
    pointRecord.y ??
    pairFromGeometry?.lat;

  const sourceLon =
    pointRecord.lon ??
    pointRecord.lng ??
    pointRecord.longitude ??
    pointRecord.currentLon ??
    pointRecord.current_lon ??
    pointRecord.positionLon ??
    pointRecord.position_lon ??
    pointRecord.position?.lon ??
    pointRecord.position?.lng ??
    pointRecord.position?.longitude ??
    pointRecord.location?.lon ??
    pointRecord.location?.lng ??
    pointRecord.location?.longitude ??
    pointRecord.coords?.lon ??
    pointRecord.coords?.lng ??
    pointRecord.coords?.longitude ??
    pointRecord.x ??
    pairFromGeometry?.lon;

  const lat = Number(sourceLat);
  const lon = Number(sourceLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const altitude = Number(
    pointRecord.altitude ??
      pointRecord.altitudeFt ??
      pointRecord.altitude_ft ??
      pointRecord.flightLevel ??
      pointRecord.flight_level ??
      null
  );
  const heading = Number(
    pointRecord.heading ??
      pointRecord.magneticHeading ??
      pointRecord.magnetic_heading ??
      pointRecord.track ??
      pointRecord.course ??
      null
  );
  const ts = Number(
    pointRecord.ts ??
      pointRecord.timestamp ??
      pointRecord.time ??
      pointRecord.created_at ??
      pointRecord.createdAt ??
      pointRecord.reported_at ??
      pointRecord.reportedAt ??
      0
  );

  return {
    lat,
    lon,
    altitude: Number.isFinite(altitude) ? altitude : null,
    heading: Number.isFinite(heading) ? heading : null,
    ts: Number.isFinite(ts) ? ts : null,
    idx: fallbackIndex,
  };
};

const normalizeTelemetryTrackArray = (track) => {
  if (!Array.isArray(track) || track.length < 2) {
    return [];
  }

  const normalized = track
    .map((point, index) => normalizeTelemetryPointRecord(point, index))
    .filter(Boolean);

  const hasAnyTs = normalized.some((point) => Number.isFinite(Number(point?.ts)) && Number(point?.ts) > 0);
  const sorted = normalized
    .slice()
    .sort((a, b) => {
      if (hasAnyTs) {
        const ats = Number(a?.ts || 0);
        const bts = Number(b?.ts || 0);
        if (ats !== bts) {
          return ats - bts;
        }
      }
      return Number(a?.idx || 0) - Number(b?.idx || 0);
    });

  const deduped = [];
  for (const point of sorted) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      Math.abs(Number(last.lat) - Number(point.lat)) < 0.000001 &&
      Math.abs(Number(last.lon) - Number(point.lon)) < 0.000001
    ) {
      continue;
    }
    deduped.push({
      lat: Number(point.lat),
      lon: Number(point.lon),
      altitude: Number.isFinite(Number(point.altitude)) ? Number(point.altitude) : null,
      heading: Number.isFinite(Number(point.heading)) ? Number(point.heading) : null,
      ts: Number.isFinite(Number(point.ts)) ? Number(point.ts) : null,
    });
  }

  return deduped.length >= 2 ? deduped : [];
};

const extractLongestTelemetryTrack = (payload) => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const preferredKeys = new Set([
    "posreps",
    "position_reports",
    "positionReports",
    "telemetryTrack",
    "telemetry_track",
    "trail",
    "track",
    "positions",
    "breadcrumbs",
    "history",
    "points",
    "data",
    "items",
    "results",
    "records",
  ]);

  const queue = [{ node: payload, depth: 0 }];
  const visited = new Set();
  const candidateTracks = [];
  let inspectedNodes = 0;

  while (queue.length > 0 && inspectedNodes < 1200) {
    const current = queue.shift();
    const node = current?.node;
    const depth = Number(current?.depth || 0);
    if (!node) {
      continue;
    }

    if (typeof node === "object") {
      if (visited.has(node)) {
        continue;
      }
      visited.add(node);
    }

    inspectedNodes += 1;

    if (Array.isArray(node)) {
      if (node.length >= 2) {
        const parsed = normalizeTelemetryTrackArray(node);
        if (parsed.length >= 2) {
          candidateTracks.push(parsed);
        }
      }

      if (depth < 5) {
        const sample = node.length > 200 ? node.slice(0, 200) : node;
        for (const child of sample) {
          if (child && typeof child === "object") {
            queue.push({ node: child, depth: depth + 1 });
          }
        }
      }
      continue;
    }

    if (!node || typeof node !== "object" || depth >= 5) {
      continue;
    }

    const entries = Object.entries(node);
    const preferred = [];
    const rest = [];

    for (const [key, value] of entries) {
      if (!value || typeof value !== "object") {
        continue;
      }
      if (preferredKeys.has(key)) {
        preferred.push(value);
      } else {
        rest.push(value);
      }
    }

    preferred.forEach((value) => queue.push({ node: value, depth: depth + 1 }));
    rest.slice(0, 30).forEach((value) => queue.push({ node: value, depth: depth + 1 }));
  }

  if (!candidateTracks.length) {
    return [];
  }

  candidateTracks.sort((a, b) => b.length - a.length);
  return candidateTracks[0] || [];
};

const resolveBackfillTrackCacheEntry = (cacheKey) => {
  const existing = telemetryBackfillCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const created = {
    points: [],
    updatedAt: 0,
    lastAttemptAt: 0,
    inFlight: null,
  };
  telemetryBackfillCache.set(cacheKey, created);
  markTelemetryDiskDirty();
  return created;
};

const getHistoricalTelemetryBackfill = async ({ cacheKey, referenceIds = [], waitForFetch = false }) => {
  if (!cacheKey) {
    return [];
  }

  const now = Date.now();
  const entry = resolveBackfillTrackCacheEntry(cacheKey);
  const existingPoints = Array.isArray(entry.points) ? entry.points : [];
  const isFresh =
    existingPoints.length >= 2 &&
    now - Number(entry.updatedAt || 0) < TELEMETRY_BACKFILL_FRESH_MS;

  if (isFresh) {
    return existingPoints;
  }

  const normalizedIds = Array.from(
    new Set(
      referenceIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  ).slice(0, TELEMETRY_BACKFILL_MAX_REFERENCE_IDS);

  if (!entry.inFlight && normalizedIds.length > 0 && now - Number(entry.lastAttemptAt || 0) >= TELEMETRY_BACKFILL_RETRY_MS) {
    entry.lastAttemptAt = now;

    entry.inFlight = (async () => {
      let bestTrack = existingPoints;

      for (const id of normalizedIds) {
        const paths = [
          `/bookings/${id}?include=posreps,position_reports`,
          `/bookings/${id}?include=posreps`,
          `/bookings/${id}?include=position_reports`,
          `/bookings/${id}?include_posreps=1`,
          `/bookings/${id}`,
        ];

        for (const path of paths) {
          const payload = await apiFetch(path).catch(() => null);
          if (!payload) {
            continue;
          }

          const extracted = extractLongestTelemetryTrack(payload);
          if (extracted.length > bestTrack.length) {
            bestTrack = extracted;
          }

          if (bestTrack.length >= TELEMETRY_HISTORY_MAX_POINTS) {
            break;
          }
        }

        if (bestTrack.length >= TELEMETRY_HISTORY_MAX_POINTS) {
          break;
        }
      }

      if (bestTrack.length >= 2) {
        entry.points =
          bestTrack.length > TELEMETRY_HISTORY_MAX_POINTS
            ? bestTrack.slice(bestTrack.length - TELEMETRY_HISTORY_MAX_POINTS)
            : bestTrack;
        entry.updatedAt = Date.now();
        markTelemetryDiskDirty();
      }
    })()
      .catch((err) => {
        logger.warn("[flight_map] telemetry_backfill_failed", {
          cacheKey,
          error: String(err),
        });
      })
      .finally(() => {
        const current = telemetryBackfillCache.get(cacheKey);
        if (current) {
          current.inFlight = null;
        }
      });
  }

  if (waitForFetch && entry.inFlight) {
    await entry.inFlight.catch(() => null);
    const refreshed = telemetryBackfillCache.get(cacheKey);
    const refreshedPoints = Array.isArray(refreshed?.points) ? refreshed.points : [];
    return refreshedPoints;
  }

  return existingPoints;
};

const loadFlightMap = async () => {
  const now = Date.now();
  if (flightMapCache.data && now < flightMapCache.expiresAt) {
    return flightMapCache.data;
  }

  for (const [key, value] of telemetryHistoryCache.entries()) {
    if (!value || now - Number(value.updatedAt || 0) > TELEMETRY_HISTORY_TTL_MS) {
      telemetryHistoryCache.delete(key);
      markTelemetryDiskDirty();
    }
  }

  for (const [key, value] of telemetryBackfillCache.entries()) {
    if (!value || now - Number(value.updatedAt || value.lastAttemptAt || 0) > TELEMETRY_HISTORY_TTL_MS) {
      telemetryBackfillCache.delete(key);
      markTelemetryDiskDirty();
    }
  }

  const responseHasTrackHistory = (payload) => {
    const flights = Array.isArray(payload?.data) ? payload.data : [];
    return flights.some((item) => {
      const sources = [
        item?.telemetry,
        item?.live,
        item?.position,
        item?.progress,
        item,
      ].filter((source) => source && typeof source === "object");

      for (const source of sources) {
        const tracks = [
          source?.posreps,
          source?.position_reports,
          source?.positionReports,
          source?.telemetryTrack,
          source?.telemetry_track,
          source?.trail,
          source?.track,
          source?.positions,
          source?.breadcrumbs,
          source?.history,
        ];
        if (tracks.some((track) => Array.isArray(track) && track.length >= 2)) {
          return true;
        }
      }

      return false;
    });
  };

  const flightMapPaths = [
    "/flight-map?include_posreps=true",
    "/flight-map?include_posreps=1",
    "/flight-map?include=posreps",
    "/flight-map?include=posreps&include_posreps=1",
    "/flight-map",
  ];

  let data = null;
  for (let index = 0; index < flightMapPaths.length; index += 1) {
    const path = flightMapPaths[index];
    const candidate = await apiFetch(path).catch(() => null);
    if (!candidate) {
      continue;
    }
    data = candidate;
    if (responseHasTrackHistory(candidate) || index === flightMapPaths.length - 1) {
      break;
    }
  }

  if (!data) {
    throw new Error("flight_map_fetch_failed");
  }

  const pilotsByUsername = await loadPilotsLookup();
  const aircraftLookup = await loadAircraftLookup().catch(() => null);
  const getCoordinate = (airport, keys) => {
    for (const key of keys) {
      const value = airport?.[key];
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return null;
  };

  const flights = await Promise.all((data?.data || []).map(async (item) => {
    const booking = item.booking || {};
    const route = item.route || {};
    const departureAirport = item.departureAirport || {};
    const arrivalAirport = item.arrivalAirport || {};
    const progress = item.progress || {};
    const pilot = item.pilot || {};
    const aircraft = item.aircraft || {};

    const flightNumber = booking.callsign || booking.flightNumber || "";
    const departureCode =
      departureAirport.icao || departureAirport.iata || departureAirport.identifier || "";
    const arrivalCode =
      arrivalAirport.icao || arrivalAirport.iata || arrivalAirport.identifier || "";
    const departureName = departureAirport.name || departureCode;
    const arrivalName = arrivalAirport.name || arrivalCode;
    const departureLat = getCoordinate(departureAirport, [
      "lat",
      "latitude",
      "coord_lat",
      "coords_lat",
    ]);
    const departureLon = getCoordinate(departureAirport, [
      "lon",
      "lng",
      "longitude",
      "coord_lon",
      "coords_lon",
    ]);
    const arrivalLat = getCoordinate(arrivalAirport, [
      "lat",
      "latitude",
      "coord_lat",
      "coords_lat",
    ]);
    const arrivalLon = getCoordinate(arrivalAirport, [
      "lon",
      "lng",
      "longitude",
      "coord_lon",
      "coords_lon",
    ]);
    const status =
      progress.currentPhase || progress.phase || route.status || "En Route";
    const progressValue =
      progress.progressPercentage ??
      progress.progress_percent ??
      progress.progress ??
      0;
    const telemetrySources = [
      item?.telemetry,
      item?.live,
      item?.position,
      item?.posreps,
      item?.position_reports,
      item?.positionReports,
      progress,
      item,
    ].filter((source) => source && typeof source === "object");

    const getCoordinateFromSources = (sources, keys) => {
      for (const source of sources) {
        const value = getCoordinate(source, keys);
        if (Number.isFinite(value)) {
          return value;
        }
      }
      return null;
    };

    const getNumericFromSources = (sources, keys, fallback = null) => {
      for (const source of sources) {
        for (const key of keys) {
          const numeric = Number(source?.[key]);
          if (Number.isFinite(numeric)) {
            return numeric;
          }
        }
      }
      const fallbackNumeric = Number(fallback);
      return Number.isFinite(fallbackNumeric) ? fallbackNumeric : null;
    };

    const extractTelemetryTrack = (sources) => {
      const trackCollections = [
        "posreps",
        "position_reports",
        "positionReports",
        "telemetryTrack",
        "telemetry_track",
        "trail",
        "track",
        "positions",
        "breadcrumbs",
        "history",
      ];

      const normalizeCoordinatePair = (firstValue, secondValue) => {
        const first = Number(firstValue);
        const second = Number(secondValue);
        if (!Number.isFinite(first) || !Number.isFinite(second)) {
          return null;
        }

        if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
          return { lat: first, lon: second };
        }

        if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
          return { lat: second, lon: first };
        }

        return null;
      };

      const extractCoordinatePair = (value) => {
        if (!Array.isArray(value) || value.length < 2) {
          return null;
        }
        return normalizeCoordinatePair(value[0], value[1]);
      };

      const unwrapTrackCollection = (value) => {
        if (Array.isArray(value)) return value;
        if (!value || typeof value !== "object") return null;
        if (Array.isArray(value?.data)) return value.data;
        if (Array.isArray(value?.items)) return value.items;
        if (Array.isArray(value?.results)) return value.results;
        if (Array.isArray(value?.records)) return value.records;
        if (Array.isArray(value?.points)) return value.points;
        if (Array.isArray(value?.posreps)) return value.posreps;
        return null;
      };

      for (const source of sources) {
        const sourceCandidates = [
          source,
          source?.attributes,
          source?.data,
          source?.relationships,
        ].filter((entry) => entry && typeof entry === "object");

        for (const sourceCandidate of sourceCandidates) {
          for (const key of trackCollections) {
            const maybeTrack = unwrapTrackCollection(sourceCandidate?.[key]);
            if (!Array.isArray(maybeTrack) || maybeTrack.length < 2) {
              continue;
            }

            const normalized = maybeTrack
              .map((point, index) => {
                const directPair = extractCoordinatePair(point);
                if (directPair) {
                  return {
                    lat: directPair.lat,
                    lon: directPair.lon,
                    altitude: null,
                    heading: null,
                    ts: null,
                    idx: index,
                  };
                }

                if (point && typeof point === "object") {
                  const pointRecord = {
                    ...(point?.attributes && typeof point.attributes === "object" ? point.attributes : {}),
                    ...point,
                  };

                  const pairFromGeometry =
                    extractCoordinatePair(pointRecord?.geometry?.coordinates) ||
                    extractCoordinatePair(pointRecord?.location?.coordinates) ||
                    extractCoordinatePair(pointRecord?.position?.coordinates) ||
                    extractCoordinatePair(pointRecord?.coords?.coordinates) ||
                    extractCoordinatePair(pointRecord?.coordinates) ||
                    extractCoordinatePair(pointRecord?.coord);

                  const sourceLat =
                    pointRecord.lat ??
                    pointRecord.latitude ??
                    pointRecord.currentLat ??
                    pointRecord.current_lat ??
                    pointRecord.positionLat ??
                    pointRecord.position_lat ??
                    pointRecord.position?.lat ??
                    pointRecord.position?.latitude ??
                    pointRecord.location?.lat ??
                    pointRecord.location?.latitude ??
                    pointRecord.coords?.lat ??
                    pointRecord.coords?.latitude ??
                    pointRecord.y ??
                    pairFromGeometry?.lat;

                  const sourceLon =
                    pointRecord.lon ??
                    pointRecord.lng ??
                    pointRecord.longitude ??
                    pointRecord.currentLon ??
                    pointRecord.current_lon ??
                    pointRecord.positionLon ??
                    pointRecord.position_lon ??
                    pointRecord.position?.lon ??
                    pointRecord.position?.lng ??
                    pointRecord.position?.longitude ??
                    pointRecord.location?.lon ??
                    pointRecord.location?.lng ??
                    pointRecord.location?.longitude ??
                    pointRecord.coords?.lon ??
                    pointRecord.coords?.lng ??
                    pointRecord.coords?.longitude ??
                    pointRecord.x ??
                    pairFromGeometry?.lon;

                  const lat = Number(sourceLat);
                  const lon = Number(sourceLon);
                  if (Number.isFinite(lat) && Number.isFinite(lon)) {
                    const sourceAltitude = Number(
                      pointRecord.altitude ??
                        pointRecord.altitudeFt ??
                        pointRecord.altitude_ft ??
                        pointRecord.flightLevel ??
                        pointRecord.flight_level ??
                        null
                    );
                    const sourceHeading = Number(
                      pointRecord.heading ??
                        pointRecord.magneticHeading ??
                        pointRecord.magnetic_heading ??
                        pointRecord.track ??
                        pointRecord.course ??
                        null
                    );
                    const ts = Number(
                      pointRecord.ts ??
                        pointRecord.timestamp ??
                        pointRecord.time ??
                        pointRecord.created_at ??
                        pointRecord.createdAt ??
                        pointRecord.reported_at ??
                        pointRecord.reportedAt ??
                        0
                    );
                    return {
                      lat,
                      lon,
                      altitude: Number.isFinite(sourceAltitude) ? sourceAltitude : null,
                      heading: Number.isFinite(sourceHeading) ? sourceHeading : null,
                      ts: Number.isFinite(ts) ? ts : null,
                      idx: index,
                    };
                  }
                }

                return null;
              })
              .filter(Boolean);

            const hasAnyTs = normalized.some((point) => Number.isFinite(Number(point?.ts)));
            const sorted = normalized
              .slice()
              .sort((a, b) => {
                if (hasAnyTs) {
                  const ats = Number(a?.ts || 0);
                  const bts = Number(b?.ts || 0);
                  if (ats !== bts) {
                    return ats - bts;
                  }
                }
                return Number(a?.idx || 0) - Number(b?.idx || 0);
              });

            const deduped = [];
            for (const point of sorted) {
              const last = deduped[deduped.length - 1];
              if (
                last &&
                Math.abs(Number(last.lat) - Number(point.lat)) < 0.000001 &&
                Math.abs(Number(last.lon) - Number(point.lon)) < 0.000001
              ) {
                continue;
              }
              deduped.push(point);
            }

            if (deduped.length >= 2) {
              return deduped.map((point) => ({
                lat: Number(point.lat),
                lon: Number(point.lon),
                altitude: Number.isFinite(Number(point.altitude)) ? Number(point.altitude) : null,
                heading: Number.isFinite(Number(point.heading)) ? Number(point.heading) : null,
                ts: Number.isFinite(Number(point.ts)) ? Number(point.ts) : null,
              }));
            }
          }
        }
      }

      return [];
    };

    const heading = getNumericFromSources(
      telemetrySources,
      ["heading", "magneticHeading", "magnetic_heading", "track", "course"],
      route.heading
    );
    const speed = getNumericFromSources(
      telemetrySources,
      ["speed", "groundSpeed", "ground_speed", "airspeed"],
      null
    );
    const altitude = getNumericFromSources(
      telemetrySources,
      ["altitude", "altitudeFt", "altitude_ft", "flightLevel"],
      null
    );

    const currentLat = getCoordinateFromSources(telemetrySources, [
      "lat",
      "latitude",
      "currentLat",
      "current_lat",
      "positionLat",
      "position_lat",
      "y",
    ]);
    const currentLon = getCoordinateFromSources(telemetrySources, [
      "lon",
      "lng",
      "longitude",
      "currentLon",
      "current_lon",
      "positionLon",
      "position_lon",
      "x",
    ]);
    let telemetryTrack = extractTelemetryTrack(telemetrySources);
    const hasLiveCoordinates = Number.isFinite(currentLat) && Number.isFinite(currentLon);
    const hasLiveTelemetry = hasLiveCoordinates || telemetryTrack.length >= 2;

    if (hasLiveCoordinates && telemetryTrack.length) {
      const last = telemetryTrack[telemetryTrack.length - 1] || {};
      const lastLat = Number(last.lat);
      const lastLon = Number(last.lon);
      const sameAsLast =
        Number.isFinite(lastLat) &&
        Number.isFinite(lastLon) &&
        Math.abs(lastLat - Number(currentLat)) < 0.00001 &&
        Math.abs(lastLon - Number(currentLon)) < 0.00001;
      if (!sameAsLast) {
        telemetryTrack.push({
          lat: Number(currentLat),
          lon: Number(currentLon),
          altitude: Number.isFinite(Number(altitude)) ? Number(altitude) : null,
          heading: Number.isFinite(Number(heading)) ? Number(heading) : null,
          ts: Date.now(),
        });
      }
    }

    let resolvedCurrentLat = currentLat;
    let resolvedCurrentLon = currentLon;
    if ((!Number.isFinite(resolvedCurrentLat) || !Number.isFinite(resolvedCurrentLon)) && telemetryTrack.length) {
      const lastPoint = telemetryTrack[telemetryTrack.length - 1] || {};
      const lat = Number(lastPoint.lat);
      const lon = Number(lastPoint.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        resolvedCurrentLat = lat;
        resolvedCurrentLon = lon;
      }
    }

    const telemetrySegmentSignature = [
      String(departureCode || "").trim().toUpperCase(),
      String(arrivalCode || "").trim().toUpperCase(),
      String(booking?.flight_date || booking?.date || progress?.departureTime || progress?.std || "")
        .trim()
        .toUpperCase(),
    ]
      .filter(Boolean)
      .join("|");

    const telemetryHistoryKey = [
      String(item?.id || booking?.id || route?.id || "").trim(),
      String(booking.callsign || booking.flightNumber || "").trim().toUpperCase(),
      String(pilot?.id || pilot?.pilot_id || "").trim(),
      String(pilot?.username || pilot?.callsign || "").trim().toUpperCase(),
      telemetrySegmentSignature,
    ]
      .filter(Boolean)
      .join(":");

    const telemetryBackfillReferenceIds = [
      booking?.id,
      item?.id,
      booking?.booking_id,
    ];

    const existingHistoryPoints = telemetryHistoryKey
      ? (telemetryHistoryCache.get(telemetryHistoryKey)?.points || [])
      : [];

    const shouldWaitBackfill =
      TELEMETRY_BACKFILL_BLOCKING_ENABLED &&
      telemetryTrack.length < TELEMETRY_BACKFILL_MIN_POINTS &&
      existingHistoryPoints.length < TELEMETRY_BACKFILL_MIN_POINTS;

    let historicalBackfillTrack =
      telemetryHistoryKey && telemetryTrack.length < TELEMETRY_BACKFILL_MIN_POINTS
        ? await getHistoricalTelemetryBackfill({
            cacheKey: telemetryHistoryKey,
            referenceIds: telemetryBackfillReferenceIds,
            waitForFetch: shouldWaitBackfill,
          })
        : [];

    if (historicalBackfillTrack.length >= 2) {
      const backfillFirst = historicalBackfillTrack[0];
      const backfillLast = historicalBackfillTrack[historicalBackfillTrack.length - 1];

      const depLat = Number(departureLat);
      const depLon = Number(departureLon);
      const curLat = Number(resolvedCurrentLat);
      const curLon = Number(resolvedCurrentLon);

      if (Number.isFinite(curLat) && Number.isFinite(curLon)) {
        const distanceToFirstNm = Number(calculateDistanceNm(curLat, curLon, Number(backfillFirst?.lat), Number(backfillFirst?.lon)));
        const distanceToLastNm = Number(calculateDistanceNm(curLat, curLon, Number(backfillLast?.lat), Number(backfillLast?.lon)));
        const nearestToCurrentNm = Math.min(
          Number.isFinite(distanceToFirstNm) ? distanceToFirstNm : Number.POSITIVE_INFINITY,
          Number.isFinite(distanceToLastNm) ? distanceToLastNm : Number.POSITIVE_INFINITY
        );

        if (!Number.isFinite(nearestToCurrentNm) || nearestToCurrentNm > TELEMETRY_BACKFILL_CURRENT_MATCH_NM) {
          historicalBackfillTrack = [];
        }
      }

      if (
        historicalBackfillTrack.length >= 2 &&
        Number.isFinite(depLat) &&
        Number.isFinite(depLon)
      ) {
        const depToFirstNm = Number(calculateDistanceNm(depLat, depLon, Number(backfillFirst?.lat), Number(backfillFirst?.lon)));
        if (Number.isFinite(depToFirstNm) && depToFirstNm > TELEMETRY_BACKFILL_DEPARTURE_MATCH_NM) {
          historicalBackfillTrack = [];
        }
      }
    }

    if (telemetryHistoryKey) {
      const existing = telemetryHistoryCache.get(telemetryHistoryKey);
      const existingPoints = Array.isArray(existing?.points) ? existing.points : [];

      const currentPoint =
        Number.isFinite(resolvedCurrentLat) && Number.isFinite(resolvedCurrentLon)
          ? {
              lat: Number(resolvedCurrentLat),
              lon: Number(resolvedCurrentLon),
              altitude: Number.isFinite(Number(altitude)) ? Number(altitude) : null,
              heading: Number.isFinite(Number(heading)) ? Number(heading) : null,
              ts: now,
            }
          : null;

      const merged = [];
      const appendPoint = (point) => {
        if (!point || typeof point !== "object") {
          return;
        }
        const lat = Number(point.lat);
        const lon = Number(point.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return;
        }
        const normalized = {
          lat,
          lon,
          altitude: Number.isFinite(Number(point.altitude)) ? Number(point.altitude) : null,
          heading: Number.isFinite(Number(point.heading)) ? Number(point.heading) : null,
          ts: Number.isFinite(Number(point.ts)) ? Number(point.ts) : null,
        };

        const last = merged[merged.length - 1];
        if (
          last &&
          Math.abs(Number(last.lat) - normalized.lat) < 0.000001 &&
          Math.abs(Number(last.lon) - normalized.lon) < 0.000001
        ) {
          const nextTs = Number(normalized.ts || 0);
          const lastTs = Number(last.ts || 0);
          if (nextTs > lastTs) {
            merged[merged.length - 1] = {
              ...last,
              ...normalized,
            };
          }
          return;
        }

        merged.push(normalized);
      };

      let seedExistingPoints = existingPoints;
      if (currentPoint && existingPoints.length) {
        const lastExisting = existingPoints[existingPoints.length - 1];
        const lastLat = Number(lastExisting?.lat);
        const lastLon = Number(lastExisting?.lon);
        const currentLat = Number(currentPoint?.lat);
        const currentLon = Number(currentPoint?.lon);
        if (
          Number.isFinite(lastLat) &&
          Number.isFinite(lastLon) &&
          Number.isFinite(currentLat) &&
          Number.isFinite(currentLon)
        ) {
          const jumpNm = Number(calculateDistanceNm(lastLat, lastLon, currentLat, currentLon));
          if (Number.isFinite(jumpNm) && jumpNm > TELEMETRY_HISTORY_RESET_DISTANCE_NM) {
            seedExistingPoints = [];
          }
        }
      }

      seedExistingPoints.forEach(appendPoint);
      historicalBackfillTrack.forEach(appendPoint);
      telemetryTrack.forEach(appendPoint);
      if (currentPoint) {
        appendPoint(currentPoint);
      }

      const hasAnyTs = merged.some((point) => Number.isFinite(Number(point.ts)) && Number(point.ts) > 0);
      const normalizedMerged = hasAnyTs
        ? merged
            .slice()
            .sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0))
        : merged;

      const trimmed =
        normalizedMerged.length > TELEMETRY_HISTORY_MAX_POINTS
          ? normalizedMerged.slice(normalizedMerged.length - TELEMETRY_HISTORY_MAX_POINTS)
          : normalizedMerged;

      telemetryHistoryCache.set(telemetryHistoryKey, {
        updatedAt: now,
        points: trimmed,
      });
      markTelemetryDiskDirty();

      if (trimmed.length >= telemetryTrack.length) {
        telemetryTrack = trimmed;
      }
    }

    const resolveAircraftLabel = async () => {
      const directLabel = normalizeAircraftDisplayName(
        aircraft.name ||
          aircraft.type ||
          aircraft.aircraft_type ||
          aircraft.model ||
          item?.aircraft_name ||
          item?.aircraft_type ||
          item?.aircraftType ||
          ""
      );
      if (directLabel) {
        return directLabel;
      }

      const aircraftId = Number(aircraft.id || item?.aircraft_id || item?.aircraftId || 0) || 0;
      if (aircraftId > 0) {
        const byId = aircraftLookup?.byId?.get(aircraftId);
        if (byId) {
          return byId;
        }
      }

      const registration = normalizeRegistration(
        aircraft.registration ||
          aircraft.tail ||
          aircraft.ident ||
          item?.aircraft_registration ||
          item?.registration ||
          item?.tail ||
          ""
      );
      if (registration) {
        const byReg = aircraftLookup?.byRegistration?.get(registration);
        if (byReg) {
          return byReg;
        }
      }

      const fleetId = Number(aircraft.fleet_id || item?.fleet_id || booking?.fleet_id || 0) || 0;
      if (fleetId > 0 && aircraftId > 0) {
        const details = await loadAircraftDetailsByFleetAndId(fleetId, aircraftId);
        const detailsNode = details && typeof details === "object" ? details : {};
        const detailedLabel = normalizeAircraftDisplayName(
          detailsNode?.name || detailsNode?.type || detailsNode?.aircraft_type || detailsNode?.model || ""
        );
        if (detailedLabel) {
          return detailedLabel;
        }
      }

      return "—";
    };

    const aircraftLabel = await resolveAircraftLabel();
    const parsedProgress = Number(progressValue);
    let resolvedProgress = Number.isFinite(parsedProgress) ? parsedProgress : 0;

    if (
      resolvedProgress <= 0 &&
      Number.isFinite(currentLat) &&
      Number.isFinite(currentLon) &&
      Number.isFinite(departureLat) &&
      Number.isFinite(departureLon) &&
      Number.isFinite(arrivalLat) &&
      Number.isFinite(arrivalLon)
    ) {
      const totalDistance = calculateDistanceNm(
        departureLat,
        departureLon,
        arrivalLat,
        arrivalLon
      );
      const completedDistance = calculateDistanceNm(
        departureLat,
        departureLon,
        currentLat,
        currentLon
      );

      if (
        Number.isFinite(totalDistance) &&
        Number(totalDistance) > 0 &&
        Number.isFinite(completedDistance)
      ) {
        resolvedProgress = (Number(completedDistance) / Number(totalDistance)) * 100;
      }
    }
    const remainingDistanceNm =
      Number(
        progress.distanceRemaining ??
          progress.distance_remaining ??
          progress.remaining_distance ??
          null
      ) || null;
    const remainingTime =
      progress.timeRemaining ||
      progress.time_remaining ||
      progress.remaining_time ||
      "";
    const etd =
      progress.departureTime ||
      progress.std ||
      progress.scheduledDepartureTime ||
      "";
    const eta =
      progress.eta ||
      progress.estimatedArrivalTime ||
      progress.estimated_arrival_time ||
      progress.sta ||
      "";
    const currentPhase =
      progress.currentPhase ||
      progress.current_phase ||
      status ||
      "";
    const passengersRaw =
      progress.passengers ??
      progress.pax ??
      progress.booked_passengers ??
      progress.bookedPassengers ??
      booking.passengers ??
      booking.pax ??
      booking.booked_passengers ??
      booking.bookedPassengers ??
      route.passengers ??
      route.pax ??
      item.passengers ??
      item.pax ??
      null;
    const passengers = Number(passengersRaw);
    const aircraftRegistration =
      aircraft.registration || aircraft.tail || aircraft.ident || "";
    const network =
      progress.network ||
      progress.networkType ||
      progress.network_type ||
      progress.onlineNetwork ||
      booking.network ||
      booking.networkType ||
      booking.network_type ||
      route.network ||
      route.networkType ||
      item.network ||
      item.networkType ||
      item.onlineNetwork ||
      "";
    const pilotNumericId = Number(
      pilot.id ?? pilot.pilot_id ?? booking.pilot_id ?? null
    );
    const pilotUsername =
      pilot.username || pilot.code || pilot.callsign || "";
    const pilotProfile = pilotsByUsername.get(String(pilotUsername).toUpperCase());
    const pilotNameFallback =
      Number.isFinite(pilotNumericId) && pilotNumericId > 0
        ? await loadPilotName(pilotNumericId)
        : "";
    const pilotDisplayName =
      pilotProfile?.name ||
      pilot.name ||
      pilotNameFallback ||
      pilotUsername ||
      "";
    const pilotDisplayId =
      pilotProfile?.username ||
      pilotUsername ||
      (Number.isFinite(pilotNumericId) && pilotNumericId > 0
        ? String(pilotNumericId)
        : "");

    return {
      time: etd,
      etd,
      eta,
      ete: remainingTime,
      flightNumber,
      departure: `${departureCode}`.trim(),
      departureCity: departureName,
      destination: `${arrivalCode}`.trim(),
      destinationCity: arrivalName,
      status,
      currentPhase,
      pilot: pilotDisplayName,
      pilotId: pilotDisplayId,
      pilotVaId: pilot.airline || "",
      aircraft: aircraftLabel,
      progress: Math.max(0, Math.min(100, resolvedProgress || 0)),
      heading,
      speed,
      altitude,
      currentLat: Number.isFinite(resolvedCurrentLat) ? Number(resolvedCurrentLat) : null,
      currentLon: Number.isFinite(resolvedCurrentLon) ? Number(resolvedCurrentLon) : null,
      hasLiveTelemetry,
      telemetryTrack,
      remainingDistanceNm,
      remainingTime,
      passengers: Number.isFinite(passengers) && passengers >= 0 ? Math.round(passengers) : null,
      aircraftRegistration,
      network,
      departureLat,
      departureLon,
      arrivalLat,
      arrivalLon,
      airline: pilot.airline || "Nordwind Virtual",
      statusColor: "#FFC107",
    };
  }));

  const getFlightHoldKey = (flight) =>
    `${String(flight?.flightNumber || "").trim().toUpperCase()}:${String(flight?.pilotId || "").trim().toUpperCase()}`;

  const byKey = new Map();
  flights.forEach((flight) => {
    const key = getFlightHoldKey(flight);
    if (!key || key === ":") {
      return;
    }
    byKey.set(key, flight);
    activeFlightHoldCache.set(key, {
      flight,
      seenAt: now,
    });
  });

  for (const [key, entry] of activeFlightHoldCache.entries()) {
    const ageMs = now - Number(entry?.seenAt || 0);
    if (!entry?.flight || ageMs > ACTIVE_FLIGHT_GRACE_MS) {
      activeFlightHoldCache.delete(key);
      continue;
    }

    if (!byKey.has(key)) {
      byKey.set(key, entry.flight);
    }
  }

  const stabilizedFlights = Array.from(byKey.values());

  const hasAtLeastOneLiveFlight = stabilizedFlights.some((flight) => Boolean(flight?.hasLiveTelemetry));
  const cacheDurationMs = hasAtLeastOneLiveFlight ? FLIGHT_MAP_CACHE_MS : FLIGHT_MAP_IDLE_CACHE_MS;

  flightMapCache = {
    data: { flights: stabilizedFlights },
    expiresAt: now + cacheDurationMs,
  };

  return flightMapCache.data;
};

const resolveLoggedInPilotIdentity = (req) => {
  const vamsysSession = getVamsysSessionFromRequest(req);
  const vamsysUser = vamsysSession?.user || {};
  const vamsysPilotId = Number(vamsysUser?.id || 0);

  if (Number.isFinite(vamsysPilotId) && vamsysPilotId > 0) {
    return {
      pilotId: vamsysPilotId,
      username: String(vamsysUser?.username || "").trim(),
      email: String(vamsysUser?.email || "").trim(),
    };
  }

  const discordSession = getDiscordSessionFromRequest(req);
  const discordUser = discordSession?.user || {};
  const discordLinkedPilotId = Number(discordUser?.vamsysPilotId || 0);

  return {
    pilotId:
      Number.isFinite(discordLinkedPilotId) && discordLinkedPilotId > 0
        ? discordLinkedPilotId
        : null,
    username: String(discordUser?.vamsysPilotUsername || "").trim(),
    email: "",
  };
};

const resolveCurrentPilotContext = async (req, { includeClaimsCount = false } = {}) => {
  const identity = resolveLoggedInPilotIdentity(req);
  const pilotId = Number(identity?.pilotId || 0) || 0;
  const vamsysSession = getVamsysSessionFromRequest(req);
  const sessionUser = vamsysSession?.user || {};

  let pilot = sessionUser && typeof sessionUser === "object" ? { ...sessionUser } : {};
  if (pilotId > 0) {
    pilot.id = String(pilotId);
  }
  if (!pilot.username && identity?.username) {
    pilot.username = identity.username;
  }
  if (!pilot.email && identity?.email) {
    pilot.email = identity.email;
  }

  if (pilotId > 0) {
    const byIdProfile = await loadPilotProfileById(pilotId, { seedPilot: sessionUser }).catch(() => null);
    if (byIdProfile) {
      pilot = applyResolvedPilotToUser(pilot, byIdProfile);
    }
  } else {
    const rosterPilot = await findPilotInRoster({
      id: pilot?.id,
      username: pilot?.username || identity?.username,
      email: pilot?.email || identity?.email,
      name: pilot?.name,
    }).catch(() => null);
    if (rosterPilot) {
      pilot = applyResolvedPilotToUser(pilot, rosterPilot);
    }
  }

  let pilotApiProfile = null;
  if (vamsysSession && isPilotApiConfigured()) {
    const connection = await ensurePilotApiConnection({
      pilotId: Number(pilot?.id || pilotId || 0) || 0,
      sessionUser,
    }).catch(() => null);
    if (connection?.profile) {
      pilotApiProfile = connection.profile;
      const rawProfile = extractPilotApiProfile(connection.profile) || {};
      if (String(rawProfile?.location || "").trim()) {
        pilot.location = String(rawProfile.location).trim();
      }
      if (String(rawProfile?.rank || "").trim()) {
        pilot.rank = String(rawProfile.rank).trim();
      }
    }
  }

  const claimsCount = includeClaimsCount && vamsysSession
    ? await pilotApiRequest({
        pilotId: Number(pilot?.id || pilotId || 0) || 0,
        sessionUser,
        path: "/claims?page[size]=50",
      })
        .then((payload) => getPilotApiCollectionItems(payload).length)
        .catch(() => 0)
    : 0;

  return {
    identity,
    pilot,
    pilotId: Number(pilot?.id || pilotId || 0) || 0,
    sessionUser,
    pilotApiProfile,
    claimsCount,
  };
};

const resolveLoggedInPilotId = (req) => {
  const identity = resolveLoggedInPilotIdentity(req);
  const pilotId = Number(identity?.pilotId || 0);
  if (Number.isFinite(pilotId) && pilotId > 0) {
    return pilotId;
  }
  return null;
};

const loadRecentFlights = async ({ pilotId, limit = 10 } = {}) => {
  const resolvedPilotId = Number(pilotId || 0);
  if (!Number.isFinite(resolvedPilotId) || resolvedPilotId <= 0) {
    return { flights: [] };
  }

  const resolvedLimit = Math.max(1, Math.min(50, Number(limit || 10)));
  const cacheKey = `${resolvedPilotId}:${resolvedLimit}`;
  const now = Date.now();
  const cached = recentFlightsCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  const pageSize = Math.max(50, Math.min(200, resolvedLimit * 8));

  const [pireps, airportsMap] = await Promise.all([
    fetchAllPages(`/pireps?page[size]=${pageSize}&filter[pilot_id]=${resolvedPilotId}&sort=-created_at`),
    loadAirportsLookup(),
  ]);

  const filteredPireps = Array.isArray(pireps)
    ? pireps.filter((pirep) => Number(pirep?.pilot_id || 0) === resolvedPilotId)
    : [];

  const recent = [];
  for (const pirep of filteredPireps.slice(0, resolvedLimit)) {
    const aircraftLabel = await resolveAircraftLabelFromPirep(pirep);

    const departure = airportsMap.get(pirep.departure_airport_id) || {
      code: "",
      name: "",
      city: "",
      icao: "",
      countryIso2: null,
      countryName: null,
    };
    const arrival = airportsMap.get(pirep.arrival_airport_id) || {
      code: "",
      name: "",
      city: "",
      icao: "",
      countryIso2: null,
      countryName: null,
    };

    const pilotName = await loadPilotName(pirep.pilot_id);
    const callsign = pirep.callsign || pirep.flight_number || "";
    const vacRaw = `${callsign}`.toUpperCase();
    const vac = vacRaw.includes("KAR")
      ? "KAR"
      : vacRaw.includes("STW")
      ? "STW"
      : "NWS";
    const createdAt = pirep.created_at || null;
    const gForceValue = [
      pirep?.g_force,
      pirep?.gForce,
      pirep?.landing_g_force,
      pirep?.landingGForce,
      pirep?.landing_g,
      pirep?.landingG,
      pirep?.max_g_force,
      pirep?.maxGForce,
    ]
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value));

    recent.push({
      id: pirep.id,
      flightNumber: callsign,
      departure: departure.code || "—",
      departureIcao: departure.icao || departure.code || "—",
      departureAirport: departure.name || departure.code || "—",
      departureCity: departure.city || departure.name || departure.code || "—",
      departureCountryIso2: departure.countryIso2 || null,
      departureCountryName: departure.countryName || null,
      arrival: arrival.code || "—",
      arrivalIcao: arrival.icao || arrival.code || "—",
      arrivalAirport: arrival.name || arrival.code || "—",
      destination: arrival.code || "—",
      destinationCity: arrival.city || arrival.name || arrival.code || "—",
      arrivalCountryIso2: arrival.countryIso2 || null,
      arrivalCountryName: arrival.countryName || null,
      status: pirep.status || "completed",
      pilot: pilotName || "—",
      pilotId: Number(pirep.pilot_id || 0) || resolvedPilotId,
      duration: formatDuration(pirep.flight_length),
      distance: Number.isFinite(Number(pirep.flight_distance))
        ? `${Number(pirep.flight_distance)} nm`
        : "—",
      aircraft: aircraftLabel,
      landing: Number.isFinite(Number(pirep.landing_rate))
        ? `${Number(pirep.landing_rate)} fpm`
        : "—",
      landingRate: Number.isFinite(Number(pirep.landing_rate))
        ? Number(pirep.landing_rate)
        : null,
      gForce: Number.isFinite(gForceValue) ? Number(gForceValue) : null,
      completedAt: createdAt,
      completedDate: createdAt
        ? new Date(createdAt).toISOString().slice(0, 10)
        : "",
      completedTime: createdAt
        ? new Date(createdAt).toISOString().slice(11, 16)
        : "",
      vac,
    });
  }

  const payload = { flights: recent };
  recentFlightsCache.set(cacheKey, {
    data: payload,
    expiresAt: now + 60 * 1000,
  });

  return payload;
};

const loadCompletedFlights = async ({ limit = 12 } = {}) => {
  const resolvedLimit = Math.max(1, Math.min(50, Number(limit || 12)));
  const now = Date.now();

  if (completedFlightsCache.data && now < completedFlightsCache.expiresAt) {
    const cachedFlights = Array.isArray(completedFlightsCache.data?.flights)
      ? completedFlightsCache.data.flights.slice(0, resolvedLimit)
      : [];
    return { flights: cachedFlights };
  }

  const pageSize = Math.max(50, Math.min(200, resolvedLimit * 8));
  const [pireps, airportsMap] = await Promise.all([
    fetchAllPages(`/pireps?page[size]=${pageSize}&sort=-created_at`),
    loadAirportsLookup(),
  ]);

  const allowedStatuses = new Set(["accepted", "auto_accepted", "approved", "completed"]);
  const source = Array.isArray(pireps) ? pireps : [];
  const filtered = source.filter((pirep) => {
    const status = String(pirep?.status || "").toLowerCase();
    return allowedStatuses.has(status);
  });

  const selected = filtered.length ? filtered.slice(0, resolvedLimit) : source.slice(0, resolvedLimit);

  const flights = await Promise.all(selected.map(async (pirep) => {
    const aircraftLabel = await resolveAircraftLabelFromPirep(pirep);

    const departure = airportsMap.get(pirep.departure_airport_id) || {
      code: "",
      name: "",
    };
    const arrival = airportsMap.get(pirep.arrival_airport_id) || {
      code: "",
      name: "",
    };

    const pilotName = await resolvePilotNameFromPirep(pirep);
    const callsign = String(pirep.callsign || pirep.flight_number || "").trim();
    const vacRaw = callsign.toUpperCase();
    const vac = vacRaw.includes("KAR")
      ? "KAR"
      : vacRaw.includes("STW")
      ? "STW"
      : "NWS";
    const createdAt = String(pirep.created_at || "").trim();

    return {
      id: Number(pirep.id || 0) || null,
      flightNumber: callsign || "—",
      departure: departure.code || "—",
      departureCity: departure.name || departure.code || "—",
      destination: arrival.code || "—",
      destinationCity: arrival.name || arrival.code || "—",
      status: "Completed",
      pilot: pilotName || (Number(pirep.pilot_id || 0) > 0 ? `Pilot #${Number(pirep.pilot_id || 0)}` : "—"),
      pilotId: Number(pirep.pilot_id || 0) || null,
      aircraft: aircraftLabel,
      progress: 100,
      duration: formatDuration(pirep.flight_length),
      completedDate: createdAt ? new Date(createdAt).toISOString().slice(0, 10) : "",
      completedTime: createdAt ? new Date(createdAt).toISOString().slice(11, 19) : "",
      vac,
    };
  }));

  completedFlightsCache = {
    data: { flights },
    expiresAt: now + 60 * 1000,
  };

  return { flights };
};

const loadSystemStatus = async () => {
  const now = Date.now();
  if (systemStatusCache.data && now < systemStatusCache.expiresAt) {
    return systemStatusCache.data;
  }

  let vamsysOnline = false;
  let acarsConnected = false;

  try {
    await getAccessToken();
    vamsysOnline = true;
  } catch {
    vamsysOnline = false;
  }

  try {
    const flightMap = await loadFlightMap();
    const flights = Array.isArray(flightMap?.flights) ? flightMap.flights : [];
    acarsConnected = vamsysOnline && flights.length >= 0;
  } catch {
    acarsConnected = false;
  }

  const payload = {
    services: [
      {
        id: "vamsys",
        name: "vAMSYS",
        state: vamsysOnline ? "online" : "offline",
        label: vamsysOnline ? "Online" : "Offline",
      },
      {
        id: "acars",
        name: "ACARS",
        state: acarsConnected ? "online" : "offline",
        label: acarsConnected ? "Connected" : "Offline",
      },
      {
        id: "simbrief",
        name: "SimBrief",
        state: SIMBRIEF_ENABLED ? "online" : "offline",
        label: SIMBRIEF_ENABLED ? "Available" : "In Development",
      },
    ],
  };

  systemStatusCache = {
    data: payload,
    expiresAt: now + 30 * 1000,
  };

  return payload;
};

const parseUpcomingDate = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const formatUpcomingDate = (value) => {
  const parsed = parseUpcomingDate(value);
  if (!parsed) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const formatUpcomingTime = (value) => {
  const parsed = parseUpcomingDate(value);
  if (!parsed) {
    return "";
  }
  return parsed.toISOString().slice(11, 16);
};

const resolveUpcomingRawDate = (item) =>
  item?.scheduled_departure ||
  item?.scheduled_at ||
  item?.departure_time ||
  item?.flight_date ||
  item?.date ||
  "";

const mapUpcomingItem = (item) => {
  const rawDate = resolveUpcomingRawDate(item);
  const route = item?.route && typeof item.route === "object" ? item.route : {};
  const aircraftValue =
    String(item?.aircraft_name || item?.aircraft_type || "").trim() ||
    (typeof item?.aircraft === "string"
      ? String(item.aircraft).trim()
      : String(item?.aircraft?.name || item?.aircraft?.type || "").trim()) ||
    (typeof route?.aircraft === "string"
      ? String(route.aircraft).trim()
      : String(route?.aircraft?.name || route?.aircraft?.type || "").trim());

  return {
    id: Number(item?.id || 0) || Math.floor(Math.random() * 1_000_000_000),
    flightNumber:
      String(item?.callsign || item?.flight_number || item?.number || route?.callsign || route?.flight_number || "").trim() ||
      "—",
    departure:
      String(
        item?.departure_icao ||
          item?.departure ||
          item?.origin ||
          item?.from ||
          route?.departure_icao ||
          route?.origin_icao ||
          route?.departure ||
          route?.origin ||
          ""
      ).trim() || "—",
    arrival:
      String(
        item?.arrival_icao ||
          item?.arrival ||
          item?.destination ||
          item?.to ||
          route?.arrival_icao ||
          route?.destination_icao ||
          route?.arrival ||
          route?.destination ||
          ""
      ).trim() || "—",
    scheduledDate: formatUpcomingDate(rawDate),
    scheduledTime: formatUpcomingTime(rawDate),
    aircraft: aircraftValue || "—",
    rawDate,
  };
};

const loadUpcomingFlightsForPilot = async ({ pilotId, pilotUsername = "", pilotEmail = "", limit = 5 } = {}) => {
  const resolvedPilotId = Number(pilotId || 0);
  const normalizedPilotUsername = normalizeMatchValue(pilotUsername);
  const normalizedPilotEmail = normalizeMatchValue(pilotEmail);

  if (
    (!Number.isFinite(resolvedPilotId) || resolvedPilotId <= 0) &&
    !normalizedPilotUsername &&
    !normalizedPilotEmail
  ) {
    return [];
  }

  const candidates = [];
  if (Number.isFinite(resolvedPilotId) && resolvedPilotId > 0) {
    candidates.push(
      `/bookings?filter[pilot_id]=${resolvedPilotId}&page[size]=100&sort=scheduled_departure`,
      `/bookings?filter[user_id]=${resolvedPilotId}&page[size]=100&sort=scheduled_departure`,
      `/bids?filter[pilot_id]=${resolvedPilotId}&page[size]=100&sort=-created_at`
    );
  }

  candidates.push(
    "/bookings?page[size]=100&sort=scheduled_departure",
    "/bookings?page[size]=100&sort=flight_date",
    "/bids?page[size]=100&sort=-created_at",
    "/schedules?page[size]=100&sort=departure_time"
  );

  for (const path of candidates) {
    try {
      const response = await apiFetch(path);
      const responseData = response?.data;
      const items = Array.isArray(responseData)
        ? responseData
        : responseData && typeof responseData === "object"
        ? [responseData]
        : [];
      if (!items.length) {
        continue;
      }

      const endpointAlreadyFilteredByPilot =
        Number.isFinite(resolvedPilotId) &&
        resolvedPilotId > 0 &&
        (path.includes(`filter[pilot_id]=${resolvedPilotId}`) || path.includes(`filter[user_id]=${resolvedPilotId}`));

      const mine = items.filter((item) => {
        if (endpointAlreadyFilteredByPilot) {
          return true;
        }

        const linkedPilotIds = [
          item?.pilot_id,
          item?.pilot?.id,
          item?.user_id,
          item?.user?.id,
          item?.booking?.pilot_id,
          item?.booking?.pilot?.id,
        ]
          .map((value) => Number(value || 0))
          .filter((value) => Number.isFinite(value) && value > 0);

        if (Number.isFinite(resolvedPilotId) && resolvedPilotId > 0 && linkedPilotIds.includes(resolvedPilotId)) {
          return true;
        }

        const linkedUsernames = [
          item?.pilot?.username,
          item?.pilot_username,
          item?.user?.username,
          item?.user_username,
          item?.booking?.pilot?.username,
          item?.booking?.pilot_username,
        ]
          .map((value) => normalizeMatchValue(value))
          .filter(Boolean);

        if (normalizedPilotUsername && linkedUsernames.includes(normalizedPilotUsername)) {
          return true;
        }

        const linkedEmails = [
          item?.pilot?.email,
          item?.pilot_email,
          item?.user?.email,
          item?.user_email,
          item?.booking?.pilot?.email,
          item?.booking?.pilot_email,
        ]
          .map((value) => normalizeMatchValue(value))
          .filter(Boolean);

        if (normalizedPilotEmail && linkedEmails.includes(normalizedPilotEmail)) {
          return true;
        }

        return false;
      });

      const now = Date.now();
      const mapped = mine
        .map(mapUpcomingItem)
        .filter((item) => {
          const parsed = parseUpcomingDate(item.rawDate);
          return parsed ? parsed.getTime() >= now : true;
        })
        .sort((a, b) => {
          const dateA = parseUpcomingDate(a.rawDate)?.getTime() || Number.MAX_SAFE_INTEGER;
          const dateB = parseUpcomingDate(b.rawDate)?.getTime() || Number.MAX_SAFE_INTEGER;
          return dateA - dateB;
        })
        .slice(0, Math.max(1, Math.min(10, Number(limit || 5))))
        .map(({ rawDate, ...rest }) => rest);

      if (mapped.length) {
        return mapped;
      }
    } catch {
      // try next endpoint candidate
    }
  }

  return [];
};

const normalizeVamsysNotamType = (value) => {
  const normalized = String(value || "info").trim().toLowerCase();
  if (normalized === "warning" || normalized === "critical") {
    return normalized;
  }
  return "info";
};

const normalizeVamsysNotamPriority = (value) => {
  const normalized = String(value || "low").trim().toLowerCase();
  if (normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "low";
};

const normalizeVamsysAlertType = (value) => {
  const normalized = String(value || "info").trim().toLowerCase();
  if (normalized === "warning" || normalized === "critical") {
    return normalized;
  }
  return "info";
};

const normalizeVamsysAlertPages = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const serializeVamsysAlert = (alert) => ({
  id: Number(alert?.id || 0) || 0,
  title: String(alert?.title || "Untitled alert").trim() || "Untitled alert",
  content: String(alert?.content || "").trim(),
  type: normalizeVamsysAlertType(alert?.type),
  pages: normalizeVamsysAlertPages(alert?.pages),
  orderColumn: Number(alert?.order_column || 0) || 0,
  startShowing: String(alert?.start_showing || "").trim() || null,
  stopShowing: String(alert?.stop_showing || "").trim() || null,
  createdAt: String(alert?.created_at || "").trim() || null,
  updatedAt: String(alert?.updated_at || "").trim() || null,
});

const isVamsysAlertActive = (alert, page = null) => {
  const now = Date.now();
  const start = Date.parse(String(alert?.startShowing || ""));
  const stop = Date.parse(String(alert?.stopShowing || ""));
  const pages = Array.isArray(alert?.pages) ? alert.pages : [];
  const normalizedPage = String(page || "").trim().toLowerCase();

  if (Number.isFinite(start) && start > now) {
    return false;
  }
  if (Number.isFinite(stop) && stop < now) {
    return false;
  }
  if (normalizedPage && pages.length > 0 && !pages.includes(normalizedPage)) {
    return false;
  }

  return true;
};

const buildAdminAlertPayload = (payload = {}) => {
  const title = String(payload?.title || "").trim();
  const content = String(payload?.content || "").trim();
  const pages = normalizeVamsysAlertPages(payload?.pages);

  if (!title) {
    throw new Error("Alert title is required");
  }
  if (!content) {
    throw new Error("Alert content is required");
  }

  return {
    title,
    content,
    type: normalizeVamsysAlertType(payload?.type),
    pages: pages.length > 0 ? pages : ["dashboard"],
    order_column: Number(payload?.order_column || payload?.orderColumn || 0) || 0,
    start_showing: String(payload?.start_showing || payload?.startShowing || "").trim() || null,
    stop_showing: String(payload?.stop_showing || payload?.stopShowing || "").trim() || null,
  };
};

const normalizeVamsysNotamContent = (value) =>
  String(value || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*p[^>]*>/gi, "")
    .replace(/<\s*\/?(strong|b)\s*>/gi, "")
    .replace(/<\s*\/?(em|i)\s*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const serializeVamsysNotam = (notam) => ({
  id: Number(notam?.id || 0) || 0,
  title: String(notam?.title || "Untitled NOTAM").trim() || "Untitled NOTAM",
  content: normalizeVamsysNotamContent(notam?.content),
  type: normalizeVamsysNotamType(notam?.type),
  priority: normalizeVamsysNotamPriority(notam?.priority),
  mustRead: Boolean(notam?.must_read),
  tag: String(notam?.tag || "").trim() || null,
  url: String(notam?.url || "").trim() || null,
  createdAt: String(notam?.created_at || "").trim() || null,
  readCount: Number(notam?.read_count || 0) || 0,
});

app.get("/api/vamsys/dashboard/home", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotIdentity = resolveLoggedInPilotIdentity(req);
  const pilotId = Number(pilotIdentity?.pilotId || 0) || null;
  if (!pilotId && !pilotIdentity?.username && !pilotIdentity?.email) {
    res.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  try {
    const session = getVamsysSessionFromRequest(req) || getDiscordSessionFromRequest(req);
    const pilot = session?.user || {};
    const sessionUser = getVamsysSessionFromRequest(req)?.user || {};

    let pilotApiDashboard = null;
    if (isPilotApiConfigured()) {
      try {
        pilotApiDashboard = await loadPilotApiDashboardData({
          pilotId,
          sessionUser,
          limit: 5,
        });
      } catch {
        pilotApiDashboard = null;
      }
    }

    const [recentFlightsPayload, upcomingFlights, systemStatus, notamsResponse, alertsResponse] = await Promise.all([
      pilotId ? loadRecentFlights({ pilotId, limit: 10 }) : Promise.resolve({ flights: [] }),
      pilotApiDashboard?.upcomingFlights
        ? Promise.resolve(pilotApiDashboard.upcomingFlights)
        : loadUpcomingFlightsForPilot({
            pilotId,
            pilotUsername: pilotIdentity?.username || "",
            pilotEmail: pilotIdentity?.email || "",
            limit: 5,
          }),
      loadSystemStatus(),
      fetchAllPages("/notams?page[size]=25").catch(() => []),
      fetchAllPages("/alerts?page[size]=25").catch(() => []),
    ]);

    const flights = Array.isArray(recentFlightsPayload?.flights) ? recentFlightsPayload.flights : [];
    const serializedNotams = (Array.isArray(notamsResponse) ? notamsResponse : [])
      .map((item) => serializeVamsysNotam(item))
      .sort((left, right) => {
        const leftTime = Date.parse(String(left?.createdAt || ""));
        const rightTime = Date.parse(String(right?.createdAt || ""));
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });
    const unreadNotams = getUnreadNotamsForPilot(pilot || {}, serializedNotams);
    const urgentNotams = unreadNotams.filter(
      (item) => item.mustRead || item.priority === "high" || item.type === "warning" || item.type === "critical"
    );
    const activeAlerts = (Array.isArray(alertsResponse) ? alertsResponse : [])
      .map((item) => serializeVamsysAlert(item))
      .filter((item) => isVamsysAlertActive(item, "dashboard"))
      .sort((left, right) => {
        const orderDiff = Number(left?.orderColumn || 0) - Number(right?.orderColumn || 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        const rightTime = Date.parse(String(right?.startShowing || right?.createdAt || ""));
        const leftTime = Date.parse(String(left?.startShowing || left?.createdAt || ""));
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });
    const landingRates = flights
      .map((item) => Number(item?.landingRate))
      .filter((value) => Number.isFinite(value));
    const avgLandingRate = landingRates.length
      ? Math.round(landingRates.reduce((sum, value) => sum + value, 0) / landingRates.length)
      : null;

    res.json({
      stats: {
        totalHours:
          Number(pilotApiDashboard?.statistics?.totalHours ?? pilot?.hours ?? pilot?.totalHours ?? 0) || 0,
        totalFlights:
          Number(pilotApiDashboard?.statistics?.totalFlights ?? pilot?.flights ?? pilot?.totalFlights ?? 0) || 0,
        memberSince: String(pilot?.joinedAt || pilot?.joinDate || ""),
        avgLandingRate,
      },
      rank: {
        name:
          String(pilotApiDashboard?.rank?.displayRankName || "").trim() ||
          String(pilot?.rank || "Member"),
        regularName:
          String(pilotApiDashboard?.rank?.regularRankName || "").trim() ||
          String(pilot?.rank || "Member"),
        honoraryName:
          String(pilotApiDashboard?.rank?.honoraryRankName || "").trim() ||
          String(
            pilot?.honorary_rank?.name ||
              pilot?.honoraryRankName ||
              pilot?.honorary_rank_name ||
              ""
          ).trim(),
        nextRankName: String(pilotApiDashboard?.rank?.nextRankName || "").trim() || "",
        progressPercent: Number(pilotApiDashboard?.rank?.progressPercent || 0) || 0,
        progressHoursRemaining: Number.isFinite(Number(pilotApiDashboard?.rank?.progressHoursRemaining))
          ? Number(pilotApiDashboard?.rank?.progressHoursRemaining)
          : null,
        progressPirepsRemaining: Number.isFinite(Number(pilotApiDashboard?.rank?.progressPirepsRemaining))
          ? Number(pilotApiDashboard?.rank?.progressPirepsRemaining)
          : null,
        progressPointsRemaining: Number.isFinite(Number(pilotApiDashboard?.rank?.progressPointsRemaining))
          ? Number(pilotApiDashboard?.rank?.progressPointsRemaining)
          : null,
        progressBonusRemaining: Number.isFinite(Number(pilotApiDashboard?.rank?.progressBonusRemaining))
          ? Number(pilotApiDashboard?.rank?.progressBonusRemaining)
          : null,
        hours: Number(pilotApiDashboard?.statistics?.totalHours ?? pilot?.hours ?? pilot?.totalHours ?? 0) || 0,
      },
      upcomingFlights,
      systemStatus,
      notams: {
        total: serializedNotams.length,
        urgentCount: urgentNotams.length,
        urgent: urgentNotams.slice(0, 3),
        latest: serializedNotams.slice(0, 6),
      },
      alerts: {
        total: activeAlerts.length,
        items: activeAlerts.slice(0, 3),
      },
    });
  } catch {
    res.status(502).json({
      error: "Failed to load dashboard data",
    });
  }
});

app.get("/api/vamsys/summary", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const summary = await loadSummaryStats();
    res.json(summary);
  } catch (error) {
    res.status(502).json({
      error: "Failed to load vAMSYS statistics",
    });
  }
});

app.get("/api/vamsys/catalog", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    await ensureUnifiedCatalogReady();
    const now = Date.now();
    const shouldForceFull = now - unifiedCatalogCache.lastFullSyncAt > UNIFIED_CATALOG_FULL_SYNC_MS;
    void syncUnifiedCatalog({ forceFull: shouldForceFull });

    res.json({
      catalog: {
        airports: Array.from(unifiedCatalogCache.airportsById.values()),
        hubs: Array.from(unifiedCatalogCache.hubsById.values()),
        routes: Array.from(unifiedCatalogCache.routesById.values()),
        fleets: Array.from(unifiedCatalogCache.fleetsById.values()),
      },
      sync: {
        initialized: Boolean(unifiedCatalogCache.initialized),
        lastFullSyncAt: unifiedCatalogCache.lastFullSyncAt || null,
        lastDeltaSyncAt: unifiedCatalogCache.lastDeltaSyncAt || null,
        deltaIntervalMs: UNIFIED_CATALOG_DELTA_SYNC_MS,
        fullIntervalMs: UNIFIED_CATALOG_FULL_SYNC_MS,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to load shared catalog",
      detail: String(error?.message || error || "catalog_error"),
    });
  }
});

app.get("/api/vamsys/fleet", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await loadFleetData();
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: "Failed to load vAMSYS fleet",
    });
  }
});

app.get("/api/vamsys/dashboard/fleet", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await loadDashboardFleetCatalog();
    res.json(payload);
  } catch (error) {
    logger.warn("[dashboard] fleet_catalog_load_failed", { error: String(error) });
    try {
      const payload = await buildDashboardFleetFallbackCatalog();
      res.json(payload);
    } catch (fallbackError) {
      logger.warn("[dashboard] fleet_catalog_fallback_failed", { error: String(fallbackError) });
      res.status(502).json({
        error: "Failed to load dashboard fleet",
      });
    }
  }
});

app.get("/api/vamsys/fleet/:fleetId/liveries/:liveryId", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const detail = await loadFleetLiveryDetail(req.params.fleetId, req.params.liveryId, {
      pirepLimit: req.query?.pirep_limit,
    });
    if (!detail) {
      res.status(404).json({ error: "Livery not found" });
      return;
    }
    res.json({ livery: detail });
  } catch (error) {
    res.status(502).json({
      error: "Failed to load livery details",
    });
  }
});

app.get("/api/vamsys/dashboard/airports", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const airports = await loadDashboardAirportsCatalog();
    res.json({ airports });
  } catch (error) {
    logger.warn("[dashboard] airports_catalog_load_failed", { error: String(error) });
    try {
      const airports = await buildDashboardAirportsFallbackCatalog();
      res.json({ airports });
    } catch (fallbackError) {
      logger.warn("[dashboard] airports_catalog_fallback_failed", { error: String(fallbackError) });
      res.status(502).json({
        error: "Failed to load dashboard airports",
      });
    }
  }
});

app.get("/api/weather/metar/:icao", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const icao = String(req.params.icao || "").trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(icao)) {
      res.status(400).json({ error: "Invalid ICAO" });
      return;
    }

    const response = await fetch(`https://tgftp.nws.noaa.gov/data/observations/metar/stations/${icao}.TXT`, {
      headers: {
        "User-Agent": "NordwindSite/1.0",
      },
    });

    if (!response.ok) {
      res.status(502).json({ error: "Failed to load METAR" });
      return;
    }

    const text = await response.text();
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const observedAt = lines.length > 0 ? lines[0] : null;
    const raw = lines.length > 1 ? lines[1] : null;

    res.json({
      metar: raw
        ? {
            station: icao,
            raw,
            observedAt,
          }
        : null,
    });
  } catch (error) {
    res.status(502).json({
      error: "Failed to load METAR",
      detail: String(error?.message || error || "unknown_error"),
    });
  }
});

app.put("/api/admin/fleet/:fleetId/liveries/:liveryId", async (req, res) => {
  try {
    const updated = await updateFleetLiveryStatus(req.params.fleetId, req.params.liveryId, req.body || {});
    res.json({ livery: updated });
  } catch (error) {
    const message = String(error?.message || error || "Failed to update livery status");
    const status = /not found/i.test(message) ? 404 : /Only one livery status can be true|Invalid fleet or livery id/i.test(message) ? 400 : 502;
    res.status(status).json({ error: message });
  }
});

app.get("/api/vamsys/routes", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await loadRoutesData();
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: "Failed to load vAMSYS routes",
    });
  }
});

app.post("/api/pilot/routes/:id/report-outdated", async (req, res) => {
  const context = await resolveCurrentPilotContext(req).catch(() => null);
  if (!context?.pilotId && !context?.pilot?.username) {
    res.status(401).json({ ok: false, error: "Authentication required", code: "auth_required" });
    return;
  }

  const routeId = Number(req.params.id || 0) || 0;
  if (routeId <= 0) {
    res.status(400).json({ ok: false, error: "Route ID is required", code: "route_id_required" });
    return;
  }

  try {
    const routesPayload = await loadRoutesData();
    const route = (Array.isArray(routesPayload?.routes) ? routesPayload.routes : []).find(
      (item) => Number(item?.id || 0) === routeId
    );

    if (!route) {
      res.status(404).json({ ok: false, error: "Route not found", code: "route_not_found" });
      return;
    }

    const result = createOutdatedRouteReportTicket({ route, context });
    if (result.error) {
      res.status(503).json({ ok: false, error: result.error, code: "ticket_unavailable" });
      return;
    }

    res.status(result.duplicate ? 200 : 201).json({
      ok: true,
      duplicate: result.duplicate,
      ticket: result.ticket,
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to submit outdated flight report"), code: "route_report_failed" });
  }
});

app.get("/api/vamsys/notams", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const context = await resolveCurrentPilotContext(req).catch(() => null);
    const payload = await fetchAllPages("/notams?page[size]=100");
    const notams = (Array.isArray(payload) ? payload : [])
      .map((item) => serializeVamsysNotam(item))
      .map((item) => ({
        ...item,
        isRead: context?.pilot ? hasPilotReadNotam(context.pilot, item.id) : false,
      }))
      .sort((left, right) => {
        const leftTime = Date.parse(String(left?.createdAt || ""));
        const rightTime = Date.parse(String(right?.createdAt || ""));
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });

    const unread = context?.pilot ? getUnreadNotamsForPilot(context.pilot, notams) : [];

    res.json({
      notams,
      summary: {
        total: notams.length,
        mustRead: notams.filter((item) => item.mustRead).length,
        highPriority: notams.filter((item) => item.priority === "high").length,
        unread: unread.length,
        unreadMustRead: unread.filter((item) => item.mustRead).length,
      },
    });
  } catch {
    res.status(502).json({
      error: "Failed to load vAMSYS NOTAMs",
    });
  }
});

app.post("/api/pilot/notams/:id/read", async (req, res) => {
  const context = await resolveCurrentPilotContext(req).catch(() => null);
  if (!context?.pilotId && !context?.pilot?.username) {
    res.status(401).json({ ok: false, error: "Authentication required", code: "auth_required" });
    return;
  }

  const notamId = Number(req.params.id || 0) || 0;
  if (notamId <= 0) {
    res.status(400).json({ ok: false, error: "NOTAM ID is required", code: "notam_id_required" });
    return;
  }

  const nextState = markPilotNotamState(context.pilot, notamId, {
    readAt: new Date().toISOString(),
  });
  const entry = nextState.entries.find((item) => item.notamId === notamId) || null;

  res.json({
    ok: true,
    notamId,
    readAt: entry?.readAt || null,
  });
});

app.get("/api/vamsys/flight-map", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await loadFlightMap();
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: "Failed to load vAMSYS flight map",
    });
  }
});

app.get("/api/vamsys/recent-flights", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotId = resolveLoggedInPilotId(req);
  if (!pilotId) {
    res.status(401).json({
      error: "Authentication required",
    });
    return;
  }

  try {
    const payload = await loadRecentFlights({ pilotId, limit: 10 });
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: "Failed to load vAMSYS recent flights",
    });
  }
});

app.get("/api/vamsys/completed-flights", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const limit = Number(req.query.limit || 12) || 12;
    const payload = await loadCompletedFlights({ limit });
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: "Failed to load vAMSYS completed flights",
    });
  }
});

app.get("/api/tickets/meta", (_req, res) => {
  const config = getTicketConfigStore();
  res.json({
    enabled: config.enabled,
    categories: config.categories.filter((item) => normalizeAdminBoolean(item?.enabled, true)),
    tags: config.tags.filter((item) => normalizeAdminBoolean(item?.enabled, true)),
    assignees: config.assignees.filter((item) => normalizeAdminBoolean(item?.enabled, true)),
  });
});

app.get("/api/tickets", async (req, res) => {
  const actor = await resolveTicketActor(req);
  if (!actor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const tickets = listTicketsStore()
    .filter((item) => canActorAccessTicket(item, actor))
    .map((item) => sanitizeTicketForViewer(item, actor));

  const unreadCount = tickets.reduce((sum, item) => sum + (Number(item?.unreadCount || 0) || 0), 0);
  res.json({ tickets, unreadCount });
});

app.post("/api/tickets", express.json({ limit: "1mb" }), async (req, res) => {
  const actor = await resolveTicketActor(req);
  if (!actor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!actor.discordSession) {
    res.status(403).json({ error: "Discord authorization is required for ticket creation" });
    return;
  }

  const config = getTicketConfigStore();
  if (!config.enabled) {
    res.status(503).json({ error: "Ticket system is temporarily disabled" });
    return;
  }

  const subject = normalizeAdminText(req.body?.subject || "");
  const categoryId = normalizeAdminText(req.body?.categoryId || "").toLowerCase();
  const content = normalizeAdminMultilineText(req.body?.content || "");
  const priority = normalizeTicketPriority(req.body?.priority, "normal");

  if (!subject) {
    res.status(400).json({ error: "Ticket subject is required" });
    return;
  }
  if (!content) {
    res.status(400).json({ error: "Ticket message is required" });
    return;
  }

  const category = config.categories.find((item) => item.id === categoryId && normalizeAdminBoolean(item?.enabled, true));
  if (!category) {
    res.status(400).json({ error: "Invalid ticket category" });
    return;
  }

  const allowedTagIds = new Set(config.tags.filter((item) => normalizeAdminBoolean(item?.enabled, true)).map((item) => String(item.id || "")));
  const requestedTags = Array.isArray(req.body?.tags) ? req.body.tags : [];
  const tags = requestedTags
    .map((item) => normalizeAdminText(item))
    .filter(Boolean)
    .filter((item) => allowedTagIds.has(item));

  const now = new Date().toISOString();
  const ticket = {
    id: randomUUID(),
    number: getNextTicketNumber(),
    subject,
    categoryId: category.id,
    categoryName: category.name,
    status: "open",
    priority,
    tags,
    assigneeId: null,
    assigneeName: null,
    owner: {
      pilotId: actor.pilotId,
      discordId: actor.discordId,
      username: actor.username,
      name: actor.name,
      provider: actor.provider,
    },
    messages: [
      {
        id: randomUUID(),
        authorRole: "pilot",
        authorName: actor.name,
        authorUsername: actor.username,
        content,
        createdAt: now,
      },
    ],
    unreadByOwner: 0,
    unreadByStaff: 1,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
  };

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    items.push(ticket);
    draft.tickets = items;
    return draft;
  });

  void sendDiscordBotNotification({
    eventKey: "ticketCreated",
    title: `Ticket #${ticket.number}: ${subject}`,
    description: content.slice(0, 500),
    category: category.name,
    author: actor.name || "Unknown",
    color: 0xe31e24,
    content: actor.discordId ? `New ticket #${ticket.number} from <@${actor.discordId}>` : "",
    variables: {
      ticketNumber: ticket.number,
      subject,
      content: content.slice(0, 500),
      status: ticket.status,
      priority,
      pilotName: actor.name || "Unknown",
      reporter: actor.name || "Unknown",
      authorRole: "pilot",
      route: category.name,
      aircraft: "",
    },
    fields: [
      { name: "Category", value: category.name, inline: true },
      { name: "Priority", value: priority, inline: true },
      { name: "Reporter", value: actor.name || "Unknown", inline: true },
    ],
  }).catch(() => {});

  res.status(201).json({ ok: true, ticket: sanitizeTicketForViewer(ticket, actor) });
});

app.get("/api/tickets/:id", async (req, res) => {
  const actor = await resolveTicketActor(req);
  if (!actor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const ticketId = normalizeAdminText(req.params.id);
  const ticket = listTicketsStore().find((item) => String(item?.id || "") === ticketId || String(item?.number || "") === ticketId);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (!canActorAccessTicket(ticket, actor)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.json({ ticket: sanitizeTicketForViewer(ticket, actor) });
});

app.post("/api/tickets/:id/messages", express.json({ limit: "1mb" }), async (req, res) => {
  const actor = await resolveTicketActor(req);
  if (!actor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!actor.discordSession) {
    res.status(403).json({ error: "Discord authorization is required to reply" });
    return;
  }

  const ticketId = normalizeAdminText(req.params.id);
  const content = normalizeAdminMultilineText(req.body?.content || "");
  if (!content) {
    res.status(400).json({ error: "Message content is required" });
    return;
  }

  let updatedTicket = null;
  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    const index = items.findIndex((item) => String(item?.id || "") === ticketId || String(item?.number || "") === ticketId);
    if (index < 0) {
      return draft;
    }

    const current = items[index];
    if (!canActorAccessTicket(current, actor)) {
      updatedTicket = { __error: "forbidden" };
      return draft;
    }

    const now = new Date().toISOString();
    const nextMessages = Array.isArray(current?.messages) ? [...current.messages] : [];
    nextMessages.push({
      id: randomUUID(),
      authorRole: actor.isAdmin ? "staff" : "pilot",
      authorName: actor.name,
      authorUsername: actor.username,
      content,
      createdAt: now,
    });

    updatedTicket = {
      ...current,
      messages: nextMessages,
      status: current?.status === "closed" ? "open" : normalizeTicketStatus(current?.status, "open"),
      updatedAt: now,
      closedAt: current?.status === "closed" ? null : current?.closedAt || null,
      unreadByOwner: actor.isAdmin ? Number(current?.unreadByOwner || 0) + 1 : 0,
      unreadByStaff: actor.isAdmin ? 0 : Number(current?.unreadByStaff || 0) + 1,
    };

    items[index] = updatedTicket;
    draft.tickets = items;
    return draft;
  });

  if (updatedTicket?.__error === "forbidden") {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  if (!updatedTicket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  void sendDiscordBotNotification({
    eventKey: "ticketReply",
    title: `New reply on ticket #${updatedTicket.number}`,
    description: content.slice(0, 500),
    category: updatedTicket.categoryName,
    author: actor.name || "Unknown",
    color: actor.isAdmin ? 0x3b82f6 : 0xe31e24,
    variables: {
      ticketNumber: updatedTicket.number,
      subject: updatedTicket.subject,
      content: content.slice(0, 500),
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      pilotName: actor.name || "Unknown",
      authorRole: actor.isAdmin ? "staff" : "pilot",
    },
    fields: [
      { name: "Status", value: updatedTicket.status, inline: true },
      { name: "Priority", value: updatedTicket.priority, inline: true },
      { name: "Author", value: actor.name || "Unknown", inline: true },
    ],
  }).catch(() => {});

  res.json({ ok: true, ticket: sanitizeTicketForViewer(updatedTicket, actor) });
});

app.post("/api/tickets/:id/status", express.json(), async (req, res) => {
  const actor = await resolveTicketActor(req);
  if (!actor) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const requestedStatus = normalizeTicketStatus(req.body?.status, "open");
  if (!["open", "closed"].includes(requestedStatus) && !actor.isAdmin) {
    res.status(403).json({ error: "Only admin can set this status" });
    return;
  }

  const ticketId = normalizeAdminText(req.params.id);
  let updatedTicket = null;

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    const index = items.findIndex((item) => String(item?.id || "") === ticketId || String(item?.number || "") === ticketId);
    if (index < 0) {
      return draft;
    }

    const current = items[index];
    if (!canActorAccessTicket(current, actor)) {
      updatedTicket = { __error: "forbidden" };
      return draft;
    }

    const now = new Date().toISOString();
    updatedTicket = {
      ...current,
      status: requestedStatus,
      updatedAt: now,
      closedAt: requestedStatus === "closed" ? now : null,
      unreadByOwner: actor.isAdmin ? Number(current?.unreadByOwner || 0) + 1 : 0,
      unreadByStaff: actor.isAdmin ? 0 : Number(current?.unreadByStaff || 0) + 1,
    };

    items[index] = updatedTicket;
    draft.tickets = items;
    return draft;
  });

  if (updatedTicket?.__error === "forbidden") {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  if (!updatedTicket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json({ ok: true, ticket: sanitizeTicketForViewer(updatedTicket, actor) });
});

const isAuthorizedDiscordBotRequest = (request) => {
  const provided = normalizeAdminText(request?.headers?.["x-discord-bot-token"] || "");
  const fallbackToken = normalizeAdminText(process.env.DISCORD_BOT_CONFIG_TOKEN || "");
  const expected = normalizeAdminText(DISCORD_BOT_TOKEN || fallbackToken);
  return Boolean(expected && provided && provided === expected);
};

const isAuthorizedTelegramBotRequest = (request) => {
  const provided = normalizeAdminText(request?.headers?.["x-telegram-bot-token"] || "");
  const fallbackToken = normalizeAdminText(process.env.TELEGRAM_BOT_CONFIG_TOKEN || "");
  const expected = normalizeAdminText(TELEGRAM_BOT_TOKEN || fallbackToken);
  return Boolean(expected && provided && provided === expected);
};

const resolveDiscordBotTicketCategory = (rawValue, config = getTicketConfigStore()) => {
  const normalized = normalizeAdminText(rawValue || "").toLowerCase();
  const categories = Array.isArray(config?.categories) ? config.categories : [];
  return categories.find((item) => {
    const id = normalizeAdminText(item?.id || "").toLowerCase();
    const name = normalizeAdminText(item?.name || "").toLowerCase();
    return Boolean(normalized && (normalized === id || normalized === name));
  }) || null;
};

app.get("/api/discord-bot/config", (req, res) => {

  if (!isAuthorizedDiscordBotRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({
    botSettings: getDiscordBotSettingsStore(),
    ticketConfig: getTicketConfigStore(),
  });
});

app.get("/api/telegram-bot/config", (req, res) => {
  if (!isAuthorizedTelegramBotRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({
    botSettings: getTelegramBotSettingsStore(),
    ticketConfig: getTicketConfigStore(),
  });
});

app.post("/api/discord-bot/sync/content", express.json({ limit: "1mb" }), async (req, res) => {
  if (!isAuthorizedDiscordBotRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const type = normalizeAdminText(req.body?.type || "news").toLowerCase();
  const title = normalizeAdminText(req.body?.title || "");
  const summary = normalizeAdminText(req.body?.summary || "");
  const content = normalizeAdminMultilineText(req.body?.content || summary || "");
  const author = normalizeAdminText(req.body?.author || "Discord Bot") || "Discord Bot";
  const botSettings = getDiscordBotSettingsStore();

  if (!title || !content) {
    res.status(400).json({ error: "Title and content are required" });
    return;
  }

  try {
    if (type === "notam") {
      if (botSettings?.sync?.notams === false) {
        res.status(409).json({ error: "NOTAM sync is disabled" });
        return;
      }
      if (!requireCredentials(res)) {
        return;
      }

      const payload = await apiRequest("/notams", {
        method: "POST",
        body: {
          title,
          content: Array.isArray(req.body?.affectedAirports) && req.body.affectedAirports.length > 0
            ? `Affected airports: ${req.body.affectedAirports.join(", ")}\n\n${content}`
            : content,
          type: normalizePublicNotamType(req.body?.notamType, "info"),
          priority: normalizePublicNotamPriority(req.body?.notamPriority, "medium"),
          must_read: normalizeAdminBoolean(req.body?.mustRead ?? req.body?.must_read, false),
          tag: normalizeAdminText(req.body?.tag) || null,
          url: normalizeAdminText(req.body?.linkUrl || req.body?.url) || null,
        },
      });

      res.status(201).json({ ok: true, item: serializeVamsysNotam(payload) });
      return;
    }

    if (type === "alert") {
      if (botSettings?.sync?.alerts === false) {
        res.status(409).json({ error: "Alert sync is disabled" });
        return;
      }
      if (!requireCredentials(res)) {
        return;
      }

      const payload = await apiRequest("/alerts", {
        method: "POST",
        body: buildAdminAlertPayload({
          title,
          content,
          type: normalizeAdminText(req.body?.alertType || req.body?.type || "info"),
          pages: req.body?.pages || ["dashboard"],
          orderColumn: req.body?.orderColumn,
          startShowing: req.body?.startShowing,
          stopShowing: req.body?.stopShowing,
        }),
      });

      res.status(201).json({ ok: true, item: serializeVamsysAlert(payload) });
      return;
    }

    if ((type === "news" || type === "event") && botSettings?.sync?.[type === "event" ? "news" : "news"] === false) {
      res.status(409).json({ error: "Content sync is disabled" });
      return;
    }

    const status = type === "event" ? "Draft" : "Published";
    const category = type === "event" ? "Event" : "News";
    const now = new Date().toISOString();
    const item = upsertManagedAdminCollectionItem("activities", {
      title,
      content,
      summary: summary || content.slice(0, 180),
      author,
      category,
      type,
      status,
      published: status === "Published",
      date: now.slice(0, 10),
      featured: normalizeAdminBoolean(req.body?.featured, false),
    });

    res.status(201).json({ ok: true, item });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || error || "Failed to sync content") });
  }
});

app.post("/api/telegram-bot/sync/content", express.json({ limit: "1mb" }), async (req, res) => {
  if (!isAuthorizedTelegramBotRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const type = normalizeAdminText(req.body?.type || "news").toLowerCase();
  const title = normalizeAdminText(req.body?.title || "");
  const summary = normalizeAdminText(req.body?.summary || "");
  const content = normalizeAdminMultilineText(req.body?.content || summary || "");
  const author = normalizeAdminText(req.body?.author || "Telegram Bot") || "Telegram Bot";
  const botSettings = getTelegramBotSettingsStore();

  if (!title || !content) {
    res.status(400).json({ error: "Title and content are required" });
    return;
  }

  try {
    if (type === "notam") {
      if (botSettings?.sync?.notams === false) {
        res.status(409).json({ error: "NOTAM sync is disabled" });
        return;
      }
      if (!requireCredentials(res)) {
        return;
      }

      const payload = await apiRequest("/notams", {
        method: "POST",
        body: {
          title,
          content: Array.isArray(req.body?.affectedAirports) && req.body.affectedAirports.length > 0
            ? `Affected airports: ${req.body.affectedAirports.join(", ")}\n\n${content}`
            : content,
          type: normalizePublicNotamType(req.body?.notamType, "info"),
          priority: normalizePublicNotamPriority(req.body?.notamPriority, "medium"),
          must_read: normalizeAdminBoolean(req.body?.mustRead ?? req.body?.must_read, false),
          tag: normalizeAdminText(req.body?.tag) || null,
          url: normalizeAdminText(req.body?.linkUrl || req.body?.url) || null,
        },
      });

      res.status(201).json({ ok: true, item: serializeVamsysNotam(payload) });
      return;
    }

    if (type === "alert") {
      if (botSettings?.sync?.alerts === false) {
        res.status(409).json({ error: "Alert sync is disabled" });
        return;
      }
      if (!requireCredentials(res)) {
        return;
      }

      const payload = await apiRequest("/alerts", {
        method: "POST",
        body: buildAdminAlertPayload({
          title,
          content,
          type: normalizeAdminText(req.body?.alertType || req.body?.type || "info"),
          pages: req.body?.pages || ["dashboard"],
          orderColumn: req.body?.orderColumn,
          startShowing: req.body?.startShowing,
          stopShowing: req.body?.stopShowing,
        }),
      });

      res.status(201).json({ ok: true, item: serializeVamsysAlert(payload) });
      return;
    }

    if ((type === "news" || type === "event") && botSettings?.sync?.news === false) {
      res.status(409).json({ error: "Content sync is disabled" });
      return;
    }

    const status = type === "event" ? "Draft" : "Published";
    const category = type === "event" ? "Event" : "News";
    const now = new Date().toISOString();
    const item = upsertManagedAdminCollectionItem("activities", {
      title,
      content,
      summary: summary || content.slice(0, 180),
      author,
      category,
      type,
      status,
      published: status === "Published",
      date: now.slice(0, 10),
      featured: normalizeAdminBoolean(req.body?.featured, false),
    });

    res.status(201).json({ ok: true, item });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || error || "Failed to sync content") });
  }
});

app.post("/api/discord-bot/tickets", express.json({ limit: "1mb" }), (req, res) => {
  if (!isAuthorizedDiscordBotRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const config = getTicketConfigStore();
  if (!config.enabled) {
    res.status(503).json({ error: "Ticket system is temporarily disabled" });
    return;
  }

  const actor = req.body?.actor && typeof req.body.actor === "object" ? req.body.actor : {};
  const subject = normalizeAdminText(req.body?.subject || "");
  const category = resolveDiscordBotTicketCategory(req.body?.category || req.body?.categoryId, config);
  const content = normalizeAdminMultilineText(req.body?.content || "");
  const priority = normalizeTicketPriority(req.body?.priority, "normal");
  const language = normalizeAdminText(req.body?.language || "").toLowerCase() || null;

  if (!subject) {
    res.status(400).json({ error: "Ticket subject is required" });
    return;
  }
  if (!content) {
    res.status(400).json({ error: "Ticket message is required" });
    return;
  }
  if (!category) {
    res.status(400).json({ error: "Valid ticket category is required" });
    return;
  }

  const now = new Date().toISOString();
  const ticket = {
    id: randomUUID(),
    number: getNextTicketNumber(),
    subject,
    categoryId: category.id,
    categoryName: category.name,
    status: "open",
    priority,
    tags: [],
    assigneeId: null,
    assigneeName: null,
    owner: {
      pilotId: Number(actor?.pilotId || 0) || null,
      discordId: normalizeAdminText(actor?.discordId || "") || null,
      username: normalizeAdminText(actor?.username || "") || "discord-user",
      name: normalizeAdminText(actor?.name || actor?.username || "Discord User") || "Discord User",
      provider: "discord-bot",
    },
    messages: [
      {
        id: randomUUID(),
        authorRole: "pilot",
        authorName: normalizeAdminText(actor?.name || actor?.username || "Discord User") || "Discord User",
        authorUsername: normalizeAdminText(actor?.username || "") || "discord-user",
        content,
        createdAt: now,
      },
    ],
    unreadByOwner: 0,
    unreadByStaff: 1,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    language,
    source: "discord",
    discordGuildId: normalizeAdminText(req.body?.discordGuildId || "") || null,
    discordChannelId: normalizeAdminText(req.body?.discordChannelId || "") || null,
  };

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    items.push(ticket);
    draft.tickets = items;
    return draft;
  });

  void sendDiscordBotNotification({
    eventKey: "ticketCreated",
    title: `Ticket #${ticket.number}: ${subject}`,
    description: content.slice(0, 500),
    category: category.name,
    author: ticket.owner.name || "Discord User",
    color: 0xe31e24,
    content: ticket.owner.discordId ? `New Discord ticket #${ticket.number} from <@${ticket.owner.discordId}>` : "",
    variables: {
      ticketNumber: ticket.number,
      subject,
      content: content.slice(0, 500),
      status: ticket.status,
      priority,
      pilotName: ticket.owner.name || "Discord User",
      reporter: ticket.owner.name || "Discord User",
      authorRole: "pilot",
      route: category.name,
      aircraft: "",
    },
    fields: [
      { name: "Category", value: category.name, inline: true },
      { name: "Priority", value: priority, inline: true },
      { name: "Source", value: "Discord", inline: true },
    ],
  }).catch(() => {});

  res.status(201).json({ ok: true, ticket });
});

app.post("/api/telegram-bot/tickets", express.json({ limit: "1mb" }), (req, res) => {
  if (!isAuthorizedTelegramBotRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const config = getTicketConfigStore();
  if (!config.enabled) {
    res.status(503).json({ error: "Ticket system is temporarily disabled" });
    return;
  }

  const actor = req.body?.actor && typeof req.body.actor === "object" ? req.body.actor : {};
  const subject = normalizeAdminText(req.body?.subject || "");
  const category = resolveDiscordBotTicketCategory(req.body?.category || req.body?.categoryId, config);
  const content = normalizeAdminMultilineText(req.body?.content || "");
  const priority = normalizeTicketPriority(req.body?.priority, "normal");
  const language = normalizeAdminText(req.body?.language || "").toLowerCase() || null;

  if (!subject) {
    res.status(400).json({ error: "Ticket subject is required" });
    return;
  }
  if (!content) {
    res.status(400).json({ error: "Ticket message is required" });
    return;
  }
  if (!category) {
    res.status(400).json({ error: "Valid ticket category is required" });
    return;
  }

  const now = new Date().toISOString();
  const ticket = {
    id: randomUUID(),
    number: getNextTicketNumber(),
    subject,
    categoryId: category.id,
    categoryName: category.name,
    status: "open",
    priority,
    tags: [],
    assigneeId: null,
    assigneeName: null,
    owner: {
      pilotId: Number(actor?.pilotId || 0) || null,
      telegramId: normalizeAdminText(actor?.telegramId || "") || null,
      username: normalizeAdminText(actor?.username || "") || "telegram-user",
      name: normalizeAdminText(actor?.name || actor?.username || "Telegram User") || "Telegram User",
      provider: "telegram-bot",
    },
    messages: [
      {
        id: randomUUID(),
        authorRole: "pilot",
        authorName: normalizeAdminText(actor?.name || actor?.username || "Telegram User") || "Telegram User",
        authorUsername: normalizeAdminText(actor?.username || "") || "telegram-user",
        content,
        createdAt: now,
      },
    ],
    unreadByOwner: 0,
    unreadByStaff: 1,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    language,
    source: "telegram",
    telegramChatId: normalizeAdminText(req.body?.telegramChatId || req.body?.chatId || "") || null,
  };

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    items.push(ticket);
    draft.tickets = items;
    return draft;
  });

  res.status(201).json({ ok: true, ticket });
});

app.post("/api/discord-bot/tickets/:id/status", express.json({ limit: "1mb" }), (req, res) => {
  if (!isAuthorizedDiscordBotRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const ticketId = normalizeAdminText(req.params.id);
  const requestedStatus = normalizeTicketStatus(req.body?.status, "open");
  const actorName = normalizeAdminText(req.body?.actorName || "Discord Bot") || "Discord Bot";
  const reason = normalizeAdminMultilineText(req.body?.reason || "");
  let updatedTicket = null;

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    const index = items.findIndex((item) => String(item?.id || "") === ticketId || String(item?.number || "") === ticketId);
    if (index < 0) {
      return draft;
    }

    const current = items[index];
    const now = new Date().toISOString();
    updatedTicket = {
      ...current,
      status: requestedStatus,
      updatedAt: now,
      closedAt: requestedStatus === "closed" ? now : null,
      unreadByOwner: requestedStatus === "closed" ? Number(current?.unreadByOwner || 0) + 1 : Number(current?.unreadByOwner || 0),
    };
    items[index] = updatedTicket;
    draft.tickets = items;
    return draft;
  });

  if (!updatedTicket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  void sendDiscordBotNotification({
    eventKey: requestedStatus === "closed" ? "ticketClosed" : "ticketUpdated",
    title: `Ticket #${updatedTicket.number} ${requestedStatus === "closed" ? "closed" : "updated"}`,
    description: reason || updatedTicket.subject,
    category: updatedTicket.categoryName,
    author: actorName,
    color: requestedStatus === "closed" ? 0x6b7280 : 0x3b82f6,
    variables: {
      ticketNumber: updatedTicket.number,
      subject: updatedTicket.subject,
      content: reason || updatedTicket.subject,
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      pilotName: actorName,
    },
    fields: [
      { name: "Status", value: updatedTicket.status, inline: true },
      { name: "Priority", value: updatedTicket.priority, inline: true },
      { name: "Source", value: "Discord", inline: true },
    ],
  }).catch(() => {});

  res.json({ ok: true, ticket: updatedTicket });
});

app.post("/api/telegram-bot/tickets/:id/status", express.json({ limit: "1mb" }), (req, res) => {
  if (!isAuthorizedTelegramBotRequest(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const ticketId = normalizeAdminText(req.params.id);
  const requestedStatus = normalizeTicketStatus(req.body?.status, "open");
  const reason = normalizeAdminMultilineText(req.body?.reason || "");
  let updatedTicket = null;

  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    const index = items.findIndex((item) => String(item?.id || "") === ticketId || String(item?.number || "") === ticketId);
    if (index < 0) {
      return draft;
    }

    const current = items[index];
    const now = new Date().toISOString();
    updatedTicket = {
      ...current,
      status: requestedStatus,
      updatedAt: now,
      closedAt: requestedStatus === "closed" ? now : null,
      unreadByOwner: requestedStatus === "closed" ? Number(current?.unreadByOwner || 0) + 1 : Number(current?.unreadByOwner || 0),
      lastTelegramBotReason: reason || null,
    };
    items[index] = updatedTicket;
    draft.tickets = items;
    return draft;
  });

  if (!updatedTicket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  res.json({ ok: true, ticket: updatedTicket });
});

app.use("/api/admin", requireAdmin);
app.use("/api/admin", createAdminAuditMiddleware());

app.get("/api/admin/audit-logs", (req, res) => {
  const entityTypes = String(req.query.entityTypes || req.query.entityType || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const pilotId = Number(req.query.pilotId || 0) || 0;
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100) || 100));

  res.json({
    entries: filterAdminAuditEntries({
      limit,
      entityTypes,
      pilotId,
    }),
  });
});

app.get("/api/admin/auth-logs", (req, res) => {
  const providers = String(req.query.providers || req.query.provider || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const outcomes = String(req.query.outcomes || req.query.outcome || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100) || 100));

  res.json({
    entries: filterAuthActivityEntries({
      limit,
      providers,
      outcomes,
    }),
  });
});

app.get("/api/admin/tickets/config", (_req, res) => {
  res.json({
    ticketConfig: getTicketConfigStore(),
  });
});

app.put("/api/admin/tickets/config", express.json({ limit: "1mb" }), (req, res) => {
  try {
    const ticketConfig = upsertTicketConfigStore(req.body && typeof req.body === "object" ? req.body : {});
    res.json({ ok: true, ticketConfig });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/admin/tickets", (_req, res) => {
  const tickets = listTicketsStore();
  res.json({
    tickets,
    summary: {
      total: tickets.length,
      open: tickets.filter((item) => normalizeTicketStatus(item?.status, "open") === "open").length,
      inProgress: tickets.filter((item) => normalizeTicketStatus(item?.status, "open") === "in_progress").length,
      resolved: tickets.filter((item) => normalizeTicketStatus(item?.status, "open") === "resolved").length,
      closed: tickets.filter((item) => normalizeTicketStatus(item?.status, "open") === "closed").length,
      unreadByStaff: tickets.reduce((sum, item) => sum + (Number(item?.unreadByStaff || 0) || 0), 0),
    },
  });
});

app.get("/api/admin/tickets/:id", (req, res) => {
  const ticketId = normalizeAdminText(req.params.id);
  const ticket = listTicketsStore().find((item) => String(item?.id || "") === ticketId || String(item?.number || "") === ticketId);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json({ ticket });
});

app.put("/api/admin/tickets/:id", express.json({ limit: "1mb" }), (req, res) => {
  const ticketId = normalizeAdminText(req.params.id);
  const patch = req.body && typeof req.body === "object" ? req.body : {};
  const config = getTicketConfigStore();

  let updatedTicket = null;
  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    const index = items.findIndex((item) => String(item?.id || "") === ticketId || String(item?.number || "") === ticketId);
    if (index < 0) {
      return draft;
    }

    const current = items[index];
    const now = new Date().toISOString();
    const categoryId = normalizeAdminText(patch.categoryId || current?.categoryId).toLowerCase();
    const category = config.categories.find((item) => item.id === categoryId) || null;
    const assigneeId = normalizeAdminText(patch.assigneeId || "");
    const assignee = config.assignees.find((item) => item.id === assigneeId) || null;
    const allowedTagIds = new Set(config.tags.map((item) => item.id));
    const rawTags = Array.isArray(patch.tags) ? patch.tags : current?.tags;
    const tags = (Array.isArray(rawTags) ? rawTags : [])
      .map((item) => normalizeAdminText(item))
      .filter((item) => allowedTagIds.has(item));

    updatedTicket = {
      ...current,
      status: normalizeTicketStatus(patch.status, normalizeTicketStatus(current?.status, "open")),
      priority: normalizeTicketPriority(patch.priority, normalizeTicketPriority(current?.priority, "normal")),
      categoryId: category?.id || current?.categoryId,
      categoryName: category?.name || current?.categoryName,
      tags,
      assigneeId: assignee?.id || null,
      assigneeName: assignee?.name || null,
      updatedAt: now,
      closedAt: normalizeTicketStatus(patch.status, normalizeTicketStatus(current?.status, "open")) === "closed"
        ? current?.closedAt || now
        : null,
    };

    items[index] = updatedTicket;
    draft.tickets = items;
    return draft;
  });

  if (!updatedTicket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const notificationEventKey = updatedTicket.status === "closed" ? "ticketClosed" : "ticketUpdated";
  void sendDiscordBotNotification({
    eventKey: notificationEventKey,
    title:
      notificationEventKey === "ticketClosed"
        ? `Ticket #${updatedTicket.number} closed`
        : `Ticket #${updatedTicket.number}: ${updatedTicket.subject}`,
    description: `Status: ${updatedTicket.status} | Priority: ${updatedTicket.priority}`,
    category: updatedTicket.categoryName,
    author: req.adminUser?.name || req.adminUser?.username || "Staff",
    color: notificationEventKey === "ticketClosed" ? 0x6b7280 : 0x3b82f6,
    variables: {
      ticketNumber: updatedTicket.number,
      subject: updatedTicket.subject,
      content: `Status: ${updatedTicket.status} | Priority: ${updatedTicket.priority}`,
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      assigneeName: updatedTicket.assigneeName || "Unassigned",
    },
    fields: [
      { name: "Category", value: updatedTicket.categoryName, inline: true },
      { name: "Assignee", value: updatedTicket.assigneeName || "Unassigned", inline: true },
    ],
  }).catch(() => {});

  res.json({ ok: true, ticket: updatedTicket });
});

app.post("/api/admin/tickets/:id/messages", express.json({ limit: "1mb" }), (req, res) => {
  const ticketId = normalizeAdminText(req.params.id);
  const content = normalizeAdminMultilineText(req.body?.content || "");
  const authorName = normalizeAdminText(req.body?.authorName || req.adminUser?.name || req.adminUser?.username || "Staff") || "Staff";
  const authorUsername = normalizeAdminText(req.body?.authorUsername || req.adminUser?.username || "staff") || "staff";

  if (!content) {
    res.status(400).json({ error: "Message content is required" });
    return;
  }

  let updatedTicket = null;
  withAdminContentUpdate((draft) => {
    const items = Array.isArray(draft?.tickets) ? [...draft.tickets] : [];
    const index = items.findIndex((item) => String(item?.id || "") === ticketId || String(item?.number || "") === ticketId);
    if (index < 0) {
      return draft;
    }

    const current = items[index];
    const now = new Date().toISOString();
    const nextMessages = Array.isArray(current?.messages) ? [...current.messages] : [];
    nextMessages.push({
      id: randomUUID(),
      authorRole: "staff",
      authorName,
      authorUsername,
      content,
      createdAt: now,
    });

    updatedTicket = {
      ...current,
      messages: nextMessages,
      status: current?.status === "closed" ? "open" : normalizeTicketStatus(current?.status, "open"),
      updatedAt: now,
      closedAt: current?.status === "closed" ? null : current?.closedAt || null,
      unreadByOwner: Number(current?.unreadByOwner || 0) + 1,
      unreadByStaff: 0,
    };

    items[index] = updatedTicket;
    draft.tickets = items;
    return draft;
  });

  if (!updatedTicket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  void sendDiscordBotNotification({
    eventKey: "ticketReply",
    title: `New reply on ticket #${updatedTicket.number}`,
    description: content.slice(0, 500),
    category: updatedTicket.categoryName,
    author: authorName,
    color: 0x3b82f6,
    variables: {
      ticketNumber: updatedTicket.number,
      subject: updatedTicket.subject,
      content: content.slice(0, 500),
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      pilotName: authorName,
      authorRole: "pilot",
    },
    fields: [
      { name: "Status", value: updatedTicket.status, inline: true },
      { name: "Priority", value: updatedTicket.priority, inline: true },
      { name: "Author", value: authorName, inline: true },
    ],
  }).catch(() => {});

  res.json({ ok: true, ticket: updatedTicket });
});

app.get("/api/admin/discord-bot/config", (_req, res) => {
  res.json({
    botSettings: getDiscordBotSettingsStore(),
    ticketConfig: getTicketConfigStore(),
  });
});

app.put("/api/admin/discord-bot/config", express.json({ limit: "1mb" }), (req, res) => {
  try {
    const botSettings = upsertDiscordBotSettingsStore(req.body && typeof req.body === "object" ? req.body : {});
    res.json({ ok: true, botSettings });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/admin/telegram-bot/config", (_req, res) => {
  res.json({
    botSettings: getTelegramBotSettingsStore(),
    ticketConfig: getTicketConfigStore(),
  });
});

app.put("/api/admin/telegram-bot/config", express.json({ limit: "1mb" }), (req, res) => {
  try {
    const botSettings = upsertTelegramBotSettingsStore(req.body && typeof req.body === "object" ? req.body : {});
    res.json({ ok: true, botSettings });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/admin/acars", (_req, res) => {
  res.json({
    settings: getAcarsConfigStore(),
    summary: getAcarsAdminSummary(),
  });
});

app.put("/api/admin/acars", (req, res) => {
  try {
    const settings = upsertAcarsConfigStore(req.body && typeof req.body === "object" ? req.body : {});
    res.json({
      ok: true,
      settings,
      summary: getAcarsAdminSummary(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: String(error || "Failed to update ACARS settings"),
    });
  }
});

app.get("/api/admin/acars/hoppie/log", (_req, res) => {
  res.json({
    entries: getAcarsHoppieActivityLog(),
    probe: acarsHoppieProbeState,
    summary: getAcarsAdminSummary(),
  });
});

app.post("/api/admin/acars/hoppie/ping", express.json(), async (req, res) => {
  try {
    const settings = getAcarsConfigStore();
    const from = normalizeAdminText(req.body?.from).toUpperCase() || resolveAcarsHoppieStationCallsign(settings);
    const onlinePacket = normalizeAdminText(req.body?.packet) || resolveAcarsHoppieTargetCallsign(settings);
    const result = await sendAcarsHoppiePacket({
      action: "ping",
      from,
      to: "SERVER",
      type: "ping",
      packet: onlinePacket,
    });
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, result, summary: getAcarsAdminSummary() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error || "Failed to ping Hoppie"), summary: getAcarsAdminSummary() });
  }
});

app.post("/api/admin/acars/hoppie/poll", express.json(), async (req, res) => {
  try {
    const settings = getAcarsConfigStore();
    const from = normalizeAdminText(req.body?.from).toUpperCase() || resolveAcarsHoppieStationCallsign(settings);
    const result = await sendAcarsHoppiePacket({
      action: "poll",
      from,
      to: "SERVER",
      type: "poll",
      packet: normalizeAdminText(req.body?.packet),
    });
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, result, summary: getAcarsAdminSummary() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error || "Failed to poll Hoppie"), summary: getAcarsAdminSummary() });
  }
});

app.post("/api/admin/acars/hoppie/message", express.json(), async (req, res) => {
  try {
    const settings = getAcarsConfigStore();
    const type = normalizeAdminText(req.body?.type || "telex").toLowerCase() || "telex";
    const from = normalizeAdminText(req.body?.from).toUpperCase() || resolveAcarsHoppieStationCallsign(settings);
    const to = normalizeAdminText(req.body?.to).toUpperCase() || (type === "poll" || type === "ping" ? "SERVER" : resolveAcarsHoppieTargetCallsign(settings));
    const packet = String(req.body?.packet ?? req.body?.message ?? "");
    const result = await sendAcarsHoppiePacket({
      action: type === "telex" ? "send-telex" : "send-packet",
      from,
      to,
      type,
      packet,
    });
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, result, summary: getAcarsAdminSummary() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error || "Failed to send Hoppie packet"), summary: getAcarsAdminSummary() });
  }
});

app.get("/api/admin/acars/vac/dispatch", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200) || 200));
    const payload = await loadAcarsVacDispatchCatalog({ limit });
    res.json({
      ...payload,
      settings: getAcarsConfigStore(),
      summary: {
        ...(payload.summary || {}),
        transportStatus: getAcarsAdminSummary().hoppieTransportStatus || "idle",
      },
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error || "Failed to load VAC dispatch catalog") });
  }
});

app.get("/api/admin/acars/vac/network", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200) || 200));
    const payload = await loadAcarsVacNetworkSnapshot({ limit });
    res.json(payload);
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error || "Failed to load VAC network snapshot") });
  }
});

app.get("/api/admin/acars/vac/log", (_req, res) => {
  res.json({ entries: getAcarsVacDispatchLog() });
});

app.post("/api/admin/acars/vac/message", express.json(), async (req, res) => {
  try {
    const result = await sendAcarsVacDispatchMessage(req.body && typeof req.body === "object" ? req.body : {});
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, result, summary: getAcarsAdminSummary() });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error), summary: getAcarsAdminSummary() });
  }
});

app.get("/api/admin/dashboard/overview", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const [summary, flightMap, notamsResponse, pirepsResponse] = await Promise.all([
      loadSummaryStats(),
      loadFlightMap(),
      fetchAllPages("/notams?page[size]=100"),
      fetchAllPages("/pireps?page[size]=250&sort=-created_at"),
    ]);

    const now = new Date();
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pireps = Array.isArray(pirepsResponse) ? pirepsResponse : [];
    const recentRaw = pireps.slice(0, 8);

    const pirepTimestamps = pireps
      .map((pirep) => Date.parse(String(pirep?.created_at || pirep?.submitted_at || pirep?.updated_at || "")))
      .filter((value) => Number.isFinite(value));

    const buildHourlySeries = () => {
      const buckets = [];
      for (let offset = 23; offset >= 0; offset -= 1) {
        const start = new Date(now);
        start.setMinutes(0, 0, 0);
        start.setHours(start.getHours() - offset);
        const end = new Date(start);
        end.setHours(end.getHours() + 1);
        buckets.push({
          label: start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          flights: 0,
          startedAt: start.getTime(),
          endedAt: end.getTime(),
        });
      }

      for (const timestamp of pirepTimestamps) {
        const bucket = buckets.find((item) => timestamp >= item.startedAt && timestamp < item.endedAt);
        if (bucket) {
          bucket.flights += 1;
        }
      }

      return buckets.map(({ label, flights }) => ({ label, flights }));
    };

    const buildDailySeries = (days) => {
      const buckets = [];
      for (let offset = days - 1; offset >= 0; offset -= 1) {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - offset);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        buckets.push({
          label: days <= 7 ? dayLabels[start.getDay()] : `${start.getDate()}`,
          fullLabel: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          flights: 0,
          startedAt: start.getTime(),
          endedAt: end.getTime(),
        });
      }

      for (const timestamp of pirepTimestamps) {
        const bucket = buckets.find((item) => timestamp >= item.startedAt && timestamp < item.endedAt);
        if (bucket) {
          bucket.flights += 1;
        }
      }

      return buckets.map(({ label, fullLabel, flights }) => ({ label, fullLabel, flights }));
    };

    const buildMonthlySeries = () => {
      const buckets = [];
      for (let offset = 11; offset >= 0; offset -= 1) {
        const start = new Date(now.getFullYear(), now.getMonth() - offset, 1, 0, 0, 0, 0);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
        buckets.push({
          label: monthLabels[start.getMonth()],
          fullLabel: `${monthLabels[start.getMonth()]} ${start.getFullYear()}`,
          flights: 0,
          startedAt: start.getTime(),
          endedAt: end.getTime(),
        });
      }

      for (const timestamp of pirepTimestamps) {
        const bucket = buckets.find((item) => timestamp >= item.startedAt && timestamp < item.endedAt);
        if (bucket) {
          bucket.flights += 1;
        }
      }

      return buckets.map(({ label, fullLabel, flights }) => ({ label, fullLabel, flights }));
    };

    const activitySeries = {
      day: buildHourlySeries(),
      week: buildDailySeries(7),
      month: buildDailySeries(30),
      year: buildMonthlySeries(),
    };

    const recentActivity = [];
    for (const pirep of recentRaw) {
      const pilotName = await loadPilotName(pirep?.pilot_id);
      const callsign = String(pirep?.callsign || pirep?.flight_number || "");
      const from = String(pirep?.departure_icao || "");
      const to = String(pirep?.arrival_icao || "");
      const statusRaw = String(pirep?.status || "completed").toLowerCase();
      const status =
        statusRaw.includes("reject") || statusRaw.includes("declin")
          ? "rejected"
          : statusRaw.includes("pend")
          ? "pending"
          : "approved";

      recentActivity.push({
        id: Number(pirep?.id || 0),
        user: pilotName || `Pilot #${pirep?.pilot_id || ""}`,
        detail: `${callsign || "PIREP"} ${from || ""}${to ? `-${to}` : ""}`.trim(),
        time: String(pirep?.created_at || ""),
        status,
      });
    }

    res.json({
      kpi: {
        totalPilots: Number(summary?.pilots || 0) || 0,
        activeFlights: Array.isArray(flightMap?.flights) ? flightMap.flights.length : 0,
        totalHours: Number(summary?.flightHours || 0) || 0,
        totalNotams: Array.isArray(notamsResponse) ? notamsResponse.length : 0,
      },
      weeklyActivity: activitySeries.week.map((item) => ({ day: item.label, flights: item.flights })),
      activitySeries,
      recentActivity,
    });
  } catch {
    res.status(502).json({
      error: "Failed to load admin dashboard overview",
    });
  }
});

app.post("/api/admin/news/publish-discord", async (req, res) => {
  try {
    const { title, content, category, author } = req.body || {};
    const result = await publishNewsToDiscord({ title, content, category, author });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: "Failed to publish to Discord",
    });
  }
});

app.get("/api/admin/notams", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await fetchAllPages("/notams?page[size]=100");
    res.json({
      notams: payload,
    });
  } catch {
    res.status(502).json({
      error: "Failed to load NOTAMs",
    });
  }
});

app.post("/api/admin/notams", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const { title, content, type, priority, must_read, tag, url } = req.body || {};
    const payload = await apiRequest("/notams", {
      method: "POST",
      body: {
        title,
        content,
        type: type || "info",
        priority: priority || "low",
        must_read: Boolean(must_read),
        tag: tag || null,
        url: url || null,
      },
    });
    if (normalizeAdminBoolean(req.body?.sendToDiscord ?? req.body?.publishToDiscord, false)) {
      void sendDiscordBotNotification({
        eventKey: "notamCreated",
        title: title || "Untitled NOTAM",
        description: content || "",
        category: "NOTAM",
        author: "Ops",
        color: 0xf59e0b,
        variables: {
          title: title || "Untitled NOTAM",
          content: content || "",
          priority: priority || "low",
          type: type || "info",
        },
        fields: [
          { name: "Priority", value: String(priority || "low"), inline: true },
          { name: "Type", value: String(type || "info"), inline: true },
        ],
      }).catch(() => {});
    }
    res.json(payload);
  } catch {
    res.status(502).json({
      error: "Failed to create NOTAM",
    });
  }
});

app.put("/api/admin/notams/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const id = encodeURIComponent(req.params.id);
    const { title, content, type, priority, must_read, tag, url } = req.body || {};
    const payload = await apiRequest(`/notams/${id}`, {
      method: "PUT",
      body: {
        title,
        content,
        type: type || "info",
        priority: priority || "low",
        must_read: Boolean(must_read),
        tag: tag || null,
        url: url || null,
      },
    });
    if (normalizeAdminBoolean(req.body?.sendToDiscord ?? req.body?.publishToDiscord, false)) {
      void sendDiscordBotNotification({
        eventKey: "notamCreated",
        title: title || "Untitled NOTAM",
        description: content || "",
        category: "NOTAM",
        author: "Ops",
        color: 0xf59e0b,
        variables: {
          title: title || "Untitled NOTAM",
          content: content || "",
          priority: priority || "low",
          type: type || "info",
        },
        fields: [
          { name: "Priority", value: String(priority || "low"), inline: true },
          { name: "Type", value: String(type || "info"), inline: true },
        ],
      }).catch(() => {});
    }
    res.json(payload);
  } catch {
    res.status(502).json({
      error: "Failed to update NOTAM",
    });
  }
});

app.delete("/api/admin/notams/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const id = encodeURIComponent(req.params.id);
    await apiRequest(`/notams/${id}`, {
      method: "DELETE",
    });
    res.json({ ok: true });
  } catch {
    res.status(502).json({
      error: "Failed to delete NOTAM",
    });
  }
});

app.get("/api/admin/alerts", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await fetchAllPages("/alerts?page[size]=100");
    res.json({
      alerts: (Array.isArray(payload) ? payload : []).map((item) => serializeVamsysAlert(item)),
    });
  } catch {
    res.status(502).json({
      error: "Failed to load alerts",
    });
  }
});

app.post("/api/admin/alerts", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await apiRequest("/alerts", {
      method: "POST",
      body: buildAdminAlertPayload(req.body || {}),
    });
    if (normalizeAdminBoolean(req.body?.sendToDiscord ?? req.body?.publishToDiscord, false)) {
      void sendDiscordBotNotification({
        eventKey: "alertCreated",
        title: String(req.body?.title || "Untitled Alert"),
        description: String(req.body?.content || "").trim(),
        category: "ALERT",
        author: "Ops",
        color: 0x3b82f6,
        variables: {
          title: String(req.body?.title || "Untitled Alert"),
          content: String(req.body?.content || "").trim(),
          pages: Array.isArray(req.body?.pages) ? req.body.pages.join(", ") : "dashboard",
        },
        fields: [
          {
            name: "Pages",
            value: Array.isArray(req.body?.pages) && req.body.pages.length > 0 ? req.body.pages.join(", ") : "dashboard",
            inline: true,
          },
        ],
      }).catch(() => {});
    }
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: String(error?.message || "Failed to create alert"),
    });
  }
});

app.put("/api/admin/alerts/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const id = encodeURIComponent(req.params.id);
    const payload = await apiRequest(`/alerts/${id}`, {
      method: "PUT",
      body: buildAdminAlertPayload(req.body || {}),
    });
    if (normalizeAdminBoolean(req.body?.sendToDiscord ?? req.body?.publishToDiscord, false)) {
      void sendDiscordBotNotification({
        eventKey: "alertCreated",
        title: String(req.body?.title || "Untitled Alert"),
        description: String(req.body?.content || "").trim(),
        category: "ALERT",
        author: "Ops",
        color: 0x3b82f6,
        variables: {
          title: String(req.body?.title || "Untitled Alert"),
          content: String(req.body?.content || "").trim(),
          pages: Array.isArray(req.body?.pages) ? req.body.pages.join(", ") : "dashboard",
        },
        fields: [
          {
            name: "Pages",
            value: Array.isArray(req.body?.pages) && req.body.pages.length > 0 ? req.body.pages.join(", ") : "dashboard",
            inline: true,
          },
        ],
      }).catch(() => {});
    }
    res.json(payload);
  } catch (error) {
    res.status(502).json({
      error: String(error?.message || "Failed to update alert"),
    });
  }
});

app.delete("/api/admin/alerts/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const id = encodeURIComponent(req.params.id);
    await apiRequest(`/alerts/${id}`, {
      method: "DELETE",
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(502).json({
      error: String(error?.message || "Failed to delete alert"),
    });
  }
});

// ---- Admin: Operations Badges CRUD ----

app.get("/api/admin/operations/badges", async (_req, res) => {
  if (!requireCredentials(res)) return;
  try {
    const badges = await fetchAllPages("/badges?page[size]=100&sort=order,name");
    res.json({ badges: Array.isArray(badges) ? badges : [] });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || "Failed to load badges") });
  }
});

app.post("/api/admin/operations/badges", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  try {
    const badge = await apiRequest("/badges", { method: "POST", body: req.body });
    badgesCatalogCache = { items: null, expiresAt: 0 };
    res.status(201).json(badge);
  } catch (error) {
    res.status(422).json({ error: String(error?.message || "Failed to create badge") });
  }
});

app.get("/api/admin/operations/badges/:id", async (req, res) => {
  if (!requireCredentials(res)) return;
  try {
    const badge = await apiRequest(`/badges/${encodeURIComponent(req.params.id)}`);
    res.json(badge);
  } catch (error) {
    res.status(502).json({ error: String(error?.message || "Failed to load badge") });
  }
});

app.put("/api/admin/operations/badges/:id", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  try {
    const badge = await apiRequest(`/badges/${encodeURIComponent(req.params.id)}`, { method: "PUT", body: req.body });
    badgesCatalogCache = { items: null, expiresAt: 0 };
    res.json(badge);
  } catch (error) {
    res.status(422).json({ error: String(error?.message || "Failed to update badge") });
  }
});

app.delete("/api/admin/operations/badges/:id", async (req, res) => {
  if (!requireCredentials(res)) return;
  try {
    await apiRequest(`/badges/${encodeURIComponent(req.params.id)}`, { method: "DELETE" });
    badgesCatalogCache = { items: null, expiresAt: 0 };
    res.status(204).end();
  } catch (error) {
    res.status(502).json({ error: String(error?.message || "Failed to delete badge") });
  }
});

app.get("/api/admin/operations/badges/:id/pilots", async (req, res) => {
  if (!requireCredentials(res)) return;
  try {
    const pilots = await fetchAllPages(`/badges/${encodeURIComponent(req.params.id)}/pilots?page[size]=100&sort=-badge_pilot.created_at`);
    res.json({ pilots: Array.isArray(pilots) ? pilots : [] });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || "Failed to load badge pilots") });
  }
});

app.post("/api/admin/operations/badges/:badgeId/pilots/:pilotId", async (req, res) => {
  if (!requireCredentials(res)) return;
  try {
    await apiRequest(`/badges/${encodeURIComponent(req.params.badgeId)}/pilots/${encodeURIComponent(req.params.pilotId)}`, { method: "POST" });
    res.status(204).end();
  } catch (error) {
    res.status(422).json({ error: String(error?.message || "Failed to award badge") });
  }
});

app.delete("/api/admin/operations/badges/:badgeId/pilots/:pilotId", async (req, res) => {
  if (!requireCredentials(res)) return;
  try {
    await apiRequest(`/badges/${encodeURIComponent(req.params.badgeId)}/pilots/${encodeURIComponent(req.params.pilotId)}`, { method: "DELETE" });
    res.status(204).end();
  } catch (error) {
    res.status(502).json({ error: String(error?.message || "Failed to revoke badge") });
  }
});

// ---- Admin: Pilot badges for admin profile view ----
app.get("/api/admin/pilot-badges/:pilotId", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pilotId = Number(req.params.pilotId || 0) || 0;
  if (pilotId <= 0) { res.status(400).json({ error: "Invalid pilot ID" }); return; }
  try {
    const badges = await fetchAllPages("/badges?page[size]=100&sort=order,name");
    const manualBadges = (Array.isArray(badges) ? badges : []).filter((b) => b?.manually_awardable);
    // For manually awardable badges, check if pilot is a recipient
    const recipientChecks = await Promise.all(
      manualBadges.map(async (badge) => {
        const badgeId = Number(badge?.id || 0);
        if (!badgeId) return { badgeId, hasIt: false };
        try {
          const pilots = await fetchAllPages(`/badges/${badgeId}/pilots?page[size]=300`);
          const hasIt = (Array.isArray(pilots) ? pilots : []).some((p) => Number(p?.id || p?.user_id || 0) === pilotId);
          return { badgeId, hasIt };
        } catch {
          return { badgeId, hasIt: false };
        }
      })
    );
    const awardedSet = new Set(recipientChecks.filter((r) => r.hasIt).map((r) => r.badgeId));
    res.json({
      badges: (Array.isArray(badges) ? badges : []).map((b) => ({
        id: Number(b?.id || 0),
        name: String(b?.name || "Badge"),
        category: String(b?.category || ""),
        description: String(b?.description || ""),
        image: String(b?.image || ""),
        manually_awardable: Boolean(b?.manually_awardable),
        awarded: awardedSet.has(Number(b?.id || 0)),
      })),
    });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || "Failed to load pilot badges") });
  }
});

const normalizeAdminPilotStatsNode = (value) => {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};

const getAdminPilotAllTimeHours = (pilotNode = {}, rosterPilot = null) => {
  const stats = normalizeAdminPilotStatsNode(pilotNode?.statistics);
  if (stats?.flight_time_all_time && Number.isFinite(Number(stats.flight_time_all_time.seconds))) {
    return Number((Number(stats.flight_time_all_time.seconds) / 3600).toFixed(2));
  }
  return Number(pilotNode?.hours || pilotNode?.total_hours || rosterPilot?.hours || 0) || 0;
};

const getAdminPilotAllTimeFlights = (pilotNode = {}, rosterPilot = null) => {
  const stats = normalizeAdminPilotStatsNode(pilotNode?.statistics);
  if (stats?.pireps_all_time && Number.isFinite(Number(stats.pireps_all_time.count))) {
    return Number(stats.pireps_all_time.count) || 0;
  }
  return Number(pilotNode?.flights || pilotNode?.total_flights || rosterPilot?.flights || 0) || 0;
};

const getAdminPilotAllTimePoints = (pilotNode = {}) => {
  const stats = normalizeAdminPilotStatsNode(pilotNode?.statistics);
  if (stats?.points_all_time && Number.isFinite(Number(stats.points_all_time.sum))) {
    return Number(stats.points_all_time.sum) || 0;
  }
  return Number(pilotNode?.points || pilotNode?.total_points || 0) || 0;
};

const getAdminPilotRankRequirementValue = (rankNode = {}, keys = []) => {
  for (const key of keys) {
    const numeric = Number(rankNode?.[key]);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return null;
};

const buildAdminPilotRankSnapshot = ({ pilotNode = {}, rosterPilot = null, ranks = [] } = {}) => {
  const normalizedRanks = (Array.isArray(ranks) ? ranks : [])
    .map((rank) => (rank && typeof rank === "object" ? rank : null))
    .filter(Boolean)
    .sort((left, right) => {
      const leftLevel = Number(left?.level || left?.order || left?.priority || 0) || 0;
      const rightLevel = Number(right?.level || right?.order || right?.priority || 0) || 0;
      if (leftLevel !== rightLevel) {
        return leftLevel - rightLevel;
      }
      return (Number(left?.id || 0) || 0) - (Number(right?.id || 0) || 0);
    });

  const currentRankId = Number(pilotNode?.rank_id || pilotNode?.rank?.id || rosterPilot?.rankId || 0) || 0;
  const currentRank = normalizedRanks.find((rank) => Number(rank?.id || 0) === currentRankId) || null;
  const currentLevel = Number(currentRank?.level || currentRank?.order || currentRank?.priority || 0) || 0;
  const nextRank =
    normalizedRanks.find((rank) => {
      const rankLevel = Number(rank?.level || rank?.order || rank?.priority || 0) || 0;
      if (currentLevel > 0) {
        return rankLevel > currentLevel;
      }
      return Number(rank?.id || 0) > currentRankId;
    }) || null;

  const hours = getAdminPilotAllTimeHours(pilotNode, rosterPilot);
  const flights = getAdminPilotAllTimeFlights(pilotNode, rosterPilot);
  const points = getAdminPilotAllTimePoints(pilotNode);
  const bonus = Number(pilotNode?.statistics?.points_all_time?.bonus || pilotNode?.bonus_sum || 0) || 0;

  const metrics = [
    {
      key: "hours",
      label: "Hours",
      current: hours,
      target: getAdminPilotRankRequirementValue(nextRank, ["required_hours", "hours_required_total", "hours", "min_hours", "minimum_hours"]),
      unit: "h",
    },
    {
      key: "pireps",
      label: "PIREPs",
      current: flights,
      target: getAdminPilotRankRequirementValue(nextRank, ["required_pireps", "pireps", "min_pireps", "minimum_pireps"]),
      unit: "flights",
    },
    {
      key: "points",
      label: "Points",
      current: points,
      target: getAdminPilotRankRequirementValue(nextRank, ["required_points", "points", "min_points", "minimum_points"]),
      unit: "pts",
    },
    {
      key: "bonus",
      label: "Bonus",
      current: bonus,
      target: getAdminPilotRankRequirementValue(nextRank, ["required_bonus", "bonus", "min_bonus", "minimum_bonus"]),
      unit: "pts",
    },
  ]
    .filter((metric) => Number.isFinite(Number(metric.target)) && Number(metric.target) > 0)
    .map((metric) => {
      const current = Number(metric.current || 0) || 0;
      const target = Number(metric.target || 0) || 0;
      const progressPercent = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
      return {
        key: metric.key,
        label: metric.label,
        current,
        target,
        remaining: Math.max(0, Math.ceil(target - current)),
        progressPercent,
        unit: metric.unit,
      };
    });

  const progressPercent = metrics.length > 0 ? Math.max(...metrics.map((metric) => Number(metric.progressPercent || 0) || 0)) : 100;

  return {
    currentName:
      String(pilotNode?.rank?.name || rosterPilot?.rank || currentRank?.name || currentRank?.abbreviation || "Member").trim() || "Member",
    currentAbbreviation:
      String(pilotNode?.rank?.abbreviation || currentRank?.abbreviation || "").trim() || null,
    currentImageUrl:
      String(pilotNode?.rank?.image_url || currentRank?.image_url || currentRank?.imageUrl || "").trim() || null,
    currentLevel,
    honorary:
      Boolean(pilotNode?.prefer_honorary_rank) ||
      Boolean(pilotNode?.rank?.honorary_rank) ||
      Boolean(currentRank?.honorary_rank),
    nextRankName: String(nextRank?.name || nextRank?.abbreviation || "").trim() || null,
    nextRankLevel: Number(nextRank?.level || nextRank?.order || nextRank?.priority || 0) || null,
    progressPercent,
    metrics,
  };
};

const buildAdminPilotBreakdownRows = (pireps = [], keyResolver) => {
  const grouped = new Map();

  (Array.isArray(pireps) ? pireps : []).forEach((pirep) => {
    const key = String(keyResolver(pirep) || "Unknown").trim() || "Unknown";
    const current = grouped.get(key) || {
      key,
      count: 0,
      flightTimeSeconds: 0,
      pointsRegular: 0,
      pointsBonus: 0,
      distanceFlown: 0,
    };

    current.count += 1;
    current.flightTimeSeconds += Number(pirep?.flight_length || 0) || 0;
    current.pointsRegular += Number(pirep?.points || 0) || 0;
    current.pointsBonus += Number(pirep?.bonus_sum || pirep?.bonus || 0) || 0;
    current.distanceFlown += Number(pirep?.distance || pirep?.distance_flown || 0) || 0;
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((row) => ({
      key: row.key,
      count: row.count,
      flightTime: {
        formatted: formatDuration(row.flightTimeSeconds),
        seconds: row.flightTimeSeconds,
      },
      points: {
        regular: row.pointsRegular,
        bonus: row.pointsBonus,
        sum: row.pointsRegular + row.pointsBonus,
      },
      distanceFlown: Math.round(row.distanceFlown),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return right.flightTime.seconds - left.flightTime.seconds;
    });
};

app.get("/api/admin/pilots/:id/profile-page", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotId = Number(req.params.id || 0) || 0;
  if (pilotId <= 0) {
    res.status(400).json({ error: "Pilot ID is required" });
    return;
  }

  try {
    const rosterPayload = await loadPilotsRoster();
    const rosterPilot = (Array.isArray(rosterPayload?.pilots) ? rosterPayload.pilots : []).find(
      (item) => Number(item?.id || 0) === pilotId
    ) || null;

    if (!rosterPilot) {
      res.status(404).json({ error: "Pilot not found" });
      return;
    }

    const rawPilotResponse = await apiFetch(`/pilots/${pilotId}`).catch(() => null);
    const rawPilot = rawPilotResponse && rawPilotResponse.id && (rawPilotResponse.attributes || rawPilotResponse.relationships)
      ? flattenJsonApiNode(rawPilotResponse)
      : rawPilotResponse && rawPilotResponse?.data && rawPilotResponse.data.id && (rawPilotResponse.data.attributes || rawPilotResponse.data.relationships)
        ? flattenJsonApiNode(rawPilotResponse.data)
        : rawPilotResponse?.data || rawPilotResponse || {};

    const [ranks, badges, pireps, notesPayload] = await Promise.all([
      fetchAllPages("/ranks?page[size]=200").catch(() => []),
      fetchAllPages("/badges?page[size]=100&sort=order,name").catch(() => []),
      fetchAllPages(`/pireps?page[size]=200&filter[pilot_id]=${encodeURIComponent(String(pilotId))}&sort=-created_at`).catch(() => []),
      apiRequest(`/pilots/${pilotId}/notes?sort=-created_at&page[size]=30`).catch(() => ({ data: [] })),
    ]);

    const acceptedStatuses = new Set(["accepted", "auto_accepted", "approved", "completed"]);
    const acceptedPireps = (Array.isArray(pireps) ? pireps : []).filter((item) => acceptedStatuses.has(String(item?.status || "").toLowerCase()));

    const earnedBadges = (await Promise.all(
      (Array.isArray(badges) ? badges : []).map(async (badge) => {
        const badgeId = Number(badge?.id || 0) || 0;
        if (badgeId <= 0) {
          return null;
        }
        try {
          const recipients = await fetchAllPages(`/badges/${badgeId}/pilots?page[size]=300`);
          const recipient = (Array.isArray(recipients) ? recipients : []).find((item) => Number(item?.id || item?.user_id || 0) === pilotId);
          if (!recipient) {
            return null;
          }

          return {
            id: badgeId,
            name: String(badge?.name || `Badge #${badgeId}`).trim() || `Badge #${badgeId}`,
            description: String(badge?.description || "").trim() || null,
            imageUrl: String(badge?.image_url || badge?.image || "").trim() || null,
            earnedAt: String(recipient?.earned_at || recipient?.created_at || recipient?.badge_pilot?.created_at || "").trim() || null,
          };
        } catch {
          return null;
        }
      })
    ))
      .filter(Boolean)
      .sort((left, right) => {
        const leftTime = Date.parse(String(left?.earnedAt || ""));
        const rightTime = Date.parse(String(right?.earnedAt || ""));
        if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && rightTime !== leftTime) {
          return rightTime - leftTime;
        }
        return String(left?.name || "").localeCompare(String(right?.name || ""));
      });

    const statsNode = normalizeAdminPilotStatsNode(rawPilot?.statistics);
    const totalHours = getAdminPilotAllTimeHours(rawPilot, rosterPilot);
    const totalFlights = getAdminPilotAllTimeFlights(rawPilot, rosterPilot);
    const totalPoints = getAdminPilotAllTimePoints(rawPilot);

    const aircraftNames = buildAdminPilotBreakdownRows(
      acceptedPireps,
      (pirep) => pirep?.aircraft?.name || pirep?.aircraft?.type || pirep?.aircraft_type || pirep?.aircraft || "Unknown aircraft"
    ).map((row) => String(row.key || "").trim().toLowerCase()).filter(Boolean);
    const auditEntries = filterAdminAuditEntries({ limit: 400, pilotId });
    const notes = (Array.isArray(notesPayload?.data) ? notesPayload.data : [])
      .map((item) => {
        const normalized = item && item.id && (item.attributes || item.relationships)
          ? flattenJsonApiNode(item)
          : item && item?.data && item.data.id && (item.data.attributes || item.data.relationships)
            ? flattenJsonApiNode(item.data)
            : item || {};

        return {
          id: Number(normalized?.id || 0) || 0,
          note: String(normalized?.note || "").trim(),
          enteredBy: Number(normalized?.entered_by || 0) || null,
          enteredByName: String(normalized?.entered_by_name || "").trim() || null,
          createdAt: String(normalized?.created_at || "").trim() || null,
          updatedAt: String(normalized?.updated_at || "").trim() || null,
        };
      })
      .filter((item) => item.id > 0);
    const audit = {
      pilot: auditEntries.filter((entry) => String(entry?.target?.type || "") === "pilot").slice(0, 12),
      aircraft: auditEntries.filter((entry) => {
        if (String(entry?.target?.type || "") !== "aircraft") {
          return false;
        }
        const label = String(entry?.target?.label || "").trim().toLowerCase();
        return !label || aircraftNames.includes(label);
      }).slice(0, 12),
      airport: auditEntries.filter((entry) => String(entry?.target?.type || "") === "airport").slice(0, 12),
      pirep: auditEntries.filter((entry) => String(entry?.target?.type || "") === "pirep").slice(0, 12),
    };

    res.json({
      profile: {
        id: pilotId,
        username: String(rawPilot?.username || rosterPilot?.username || "").trim(),
        name: String(rawPilot?.name || rosterPilot?.name || rosterPilot?.username || "Pilot").trim() || "Pilot",
        email: String(rawPilot?.email || rosterPilot?.email || "").trim() || null,
        rank: String(rawPilot?.rank?.name || rosterPilot?.rank || "Member").trim() || "Member",
        rankId: Number(rawPilot?.rank_id || rawPilot?.rank?.id || rosterPilot?.rankId || 0) || null,
        airlineId: Number(rawPilot?.airline_id || rosterPilot?.airlineId || 0) || null,
        hours: totalHours,
        flights: totalFlights,
        status: String(rosterPilot?.status || "active").trim() || "active",
        joinedAt: String(rawPilot?.created_at || rawPilot?.join_date || rosterPilot?.joinedAt || "").trim() || null,
        preferHonoraryRank: Boolean(rawPilot?.prefer_honorary_rank),
        frozen: Boolean(rawPilot?.frozen || String(rosterPilot?.status || "").toLowerCase() === "frozen"),
        banned: Boolean(rawPilot?.banned || String(rosterPilot?.status || "").toLowerCase() === "banned"),
        useImperialUnits: Boolean(rawPilot?.use_imperial_units),
        holidayAllowance: rawPilot?.holiday_allowance == null ? null : Number(rawPilot.holiday_allowance) || 0,
        underActivityGrace: Boolean(rawPilot?.under_activity_grace),
        activityWhitelist: Boolean(rawPilot?.activity_whitelist),
        activityType: String(rawPilot?.activity_type || "standard").trim() || "standard",
        hubId: Number(rawPilot?.hub_id || 0) || null,
        locationId: Number(rawPilot?.location_id || 0) || null,
      },
      statistics: {
        totalHours,
        totalFlights,
        totalPoints,
        uniqueArrivalAirports: Number(statsNode?.unique_arrival_airports || 0) || 0,
        lastPirepDate: String(statsNode?.last_pirep_date || "").trim() || null,
        generatedAt: String(statsNode?.generated_at || "").trim() || null,
      },
      rank: buildAdminPilotRankSnapshot({ pilotNode: rawPilot, rosterPilot, ranks }),
      badges: earnedBadges,
      breakdown: {
        byAircraft: buildAdminPilotBreakdownRows(acceptedPireps, (pirep) => pirep?.aircraft?.name || pirep?.aircraft?.type || pirep?.aircraft_type || pirep?.aircraft || "Unknown aircraft"),
        byNetwork: buildAdminPilotBreakdownRows(acceptedPireps, (pirep) => pirep?.network || pirep?.network_name || "Offline"),
        byRouteType: buildAdminPilotBreakdownRows(acceptedPireps, (pirep) => pirep?.route_type || pirep?.type || pirep?.flight_type || "Scheduled"),
        byTimeOfDay: buildAdminPilotBreakdownRows(acceptedPireps, (pirep) => {
          const timestamp = Date.parse(String(pirep?.departure_time || pirep?.submitted_at || pirep?.created_at || ""));
          if (!Number.isFinite(timestamp)) {
            return "Unknown";
          }
          const hours = new Date(timestamp).getUTCHours();
          return hours >= 6 && hours < 18 ? "Day" : "Night";
        }),
      },
      notes,
      audit,
    });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || "Failed to load admin pilot profile page") });
  }
});

app.post("/api/admin/pilots/:id/notes", express.json(), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotId = Number(req.params.id || 0) || 0;
  const note = String(req.body?.note || "").trim();
  if (pilotId <= 0) {
    res.status(400).json({ ok: false, error: "Pilot ID is required" });
    return;
  }
  if (!note) {
    res.status(400).json({ ok: false, error: "Note text is required" });
    return;
  }

  try {
    const payload = await apiRequest(`/pilots/${pilotId}/notes`, {
      method: "POST",
      body: { note },
    });
    const normalized = payload && payload.id && (payload.attributes || payload.relationships)
      ? flattenJsonApiNode(payload)
      : payload?.data && payload.data.id && (payload.data.attributes || payload.data.relationships)
        ? flattenJsonApiNode(payload.data)
        : payload || {};
    res.status(201).json({
      ok: true,
      note: {
        id: Number(normalized?.id || 0) || 0,
        note: String(normalized?.note || "").trim(),
        enteredBy: Number(normalized?.entered_by || 0) || null,
        enteredByName: String(normalized?.entered_by_name || "").trim() || null,
        createdAt: String(normalized?.created_at || "").trim() || null,
        updatedAt: String(normalized?.updated_at || "").trim() || null,
      },
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to create pilot note") });
  }
});

app.put("/api/admin/pilots/:id/notes/:noteId", express.json(), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotId = Number(req.params.id || 0) || 0;
  const noteId = Number(req.params.noteId || 0) || 0;
  const note = String(req.body?.note || "").trim();
  if (pilotId <= 0 || noteId <= 0) {
    res.status(400).json({ ok: false, error: "Pilot ID and note ID are required" });
    return;
  }
  if (!note) {
    res.status(400).json({ ok: false, error: "Note text is required" });
    return;
  }

  try {
    const payload = await apiRequest(`/pilots/${pilotId}/notes/${noteId}`, {
      method: "PUT",
      body: { note },
    });
    const normalized = payload && payload.id && (payload.attributes || payload.relationships)
      ? flattenJsonApiNode(payload)
      : payload?.data && payload.data.id && (payload.data.attributes || payload.data.relationships)
        ? flattenJsonApiNode(payload.data)
        : payload || {};
    res.json({
      ok: true,
      note: {
        id: Number(normalized?.id || 0) || 0,
        note: String(normalized?.note || "").trim(),
        enteredBy: Number(normalized?.entered_by || 0) || null,
        enteredByName: String(normalized?.entered_by_name || "").trim() || null,
        createdAt: String(normalized?.created_at || "").trim() || null,
        updatedAt: String(normalized?.updated_at || "").trim() || null,
      },
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to update pilot note") });
  }
});

app.delete("/api/admin/pilots/:id/notes/:noteId", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotId = Number(req.params.id || 0) || 0;
  const noteId = Number(req.params.noteId || 0) || 0;
  if (pilotId <= 0 || noteId <= 0) {
    res.status(400).json({ ok: false, error: "Pilot ID and note ID are required" });
    return;
  }

  try {
    await apiRequest(`/pilots/${pilotId}/notes/${noteId}`, {
      method: "DELETE",
    });
    res.status(204).end();
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to delete pilot note") });
  }
});

app.post("/api/admin/pilots/:id/send-name-for-review", express.json(), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotId = Number(req.params.id || 0) || 0;
  const reason = String(req.body?.reason || "").trim();
  if (pilotId <= 0) {
    res.status(400).json({ ok: false, error: "Pilot ID is required" });
    return;
  }
  if (!reason) {
    res.status(400).json({ ok: false, error: "Reason is required" });
    return;
  }

  try {
    await apiRequest(`/pilots/${pilotId}/send-name-for-review`, {
      method: "POST",
      body: { reason },
    });
    res.status(204).end();
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to send pilot name for review") });
  }
});

app.get("/api/admin/pilots", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await loadPilotsRoster();
    res.json(payload);
  } catch {
    res.status(502).json({
      error: "Failed to load pilots",
    });
  }
});

app.get("/api/admin/pilots/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotId = Number(req.params.id || 0) || 0;
  if (pilotId <= 0) {
    res.status(400).json({ error: "Pilot ID is required" });
    return;
  }

  try {
    const rosterPayload = await loadPilotsRoster();
    const pilot = (Array.isArray(rosterPayload?.pilots) ? rosterPayload.pilots : []).find(
      (item) => Number(item?.id || 0) === pilotId
    );

    if (!pilot) {
      res.status(404).json({ error: "Pilot not found" });
      return;
    }

    const [recentFlightsPayload, rawBookings] = await Promise.all([
      loadRecentFlights({ pilotId, limit: 8 }).catch(() => ({ flights: [] })),
      fetchAllPages(`/bookings?page[size]=20&filter[pilot_id]=${encodeURIComponent(String(pilotId))}&sort=-created_at`).catch(() => []),
    ]);

    const recentFlights = Array.isArray(recentFlightsPayload?.flights) ? recentFlightsPayload.flights : [];
    const bookings = (Array.isArray(rawBookings) ? rawBookings : []).map((booking) => ({
      id: Number(booking?.id || 0) || 0,
      callsign: normalizeAdminText(booking?.callsign || booking?.flight_number || "Booking"),
      route: `${normalizeAdminText(booking?.departure_airport?.icao || booking?.departure_id || "----")} → ${normalizeAdminText(booking?.arrival_airport?.icao || booking?.arrival_id || "----")}`,
      aircraft: normalizeAdminText(booking?.aircraft?.name || booking?.aircraft?.type || booking?.aircraft_id || "—"),
      status: inferAdminBookingStatus(booking),
      departureTime: normalizeAdminText(booking?.departure_time),
      createdAt: normalizeAdminText(booking?.created_at),
    }));

    res.json({
      pilot,
      stats: {
        totalHours: Number(pilot?.hours || 0) || 0,
        totalFlights: Number(pilot?.flights || 0) || 0,
        recentFlights: recentFlights.length,
        activeBookings: bookings.filter((item) => item.status === "active" || item.status === "pending").length,
      },
      recentFlights,
      bookings,
    });
  } catch {
    res.status(502).json({ error: "Failed to load pilot detail" });
  }
});

app.get("/api/admin/pilots/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const pilotId = Number(req.params.id || 0) || 0;
  if (pilotId <= 0) {
    res.status(400).json({ error: "Pilot ID is required" });
    return;
  }

  try {
    const rosterPayload = await loadPilotsRoster();
    const rosterPilot = (Array.isArray(rosterPayload?.pilots) ? rosterPayload.pilots : []).find(
      (item) => Number(item?.id || 0) === pilotId
    ) || null;

    const [profile, recentFlightsPayload, upcomingFlights, bookings] = await Promise.all([
      loadPilotProfileById(pilotId, { seedPilot: rosterPilot }).catch(() => null),
      loadRecentFlights({ pilotId, limit: 8 }).catch(() => ({ flights: [] })),
      loadUpcomingFlightsForPilot({
        pilotId,
        pilotUsername: String(rosterPilot?.username || ""),
        pilotEmail: String(rosterPilot?.email || ""),
        limit: 5,
      }).catch(() => []),
      loadAdminBookingsCatalog({ limit: 150 }).then((items) => items.filter((item) => Number(item?.pilotId || 0) === pilotId)).catch(() => []),
    ]);

    const recentFlights = Array.isArray(recentFlightsPayload?.flights) ? recentFlightsPayload.flights : [];

    res.json({
      profile: {
        id: pilotId,
        username: String(profile?.username || rosterPilot?.username || ""),
        name: String(profile?.name || rosterPilot?.name || rosterPilot?.username || "Pilot"),
        email: String(profile?.email || rosterPilot?.email || ""),
        rank: String(profile?.rank || rosterPilot?.rank || "Member"),
        rankId: Number(profile?.rankId || rosterPilot?.rankId || 0) || null,
        airlineId: Number(profile?.airlineId || rosterPilot?.airlineId || 0) || null,
        hours: Number(profile?.hours || rosterPilot?.hours || 0) || 0,
        flights: Number(profile?.flights || rosterPilot?.flights || 0) || 0,
        status: String(rosterPilot?.status || "active"),
        joinedAt: String(profile?.joinedAt || rosterPilot?.joinedAt || ""),
        honoraryRank: String(profile?.honoraryRank || "").trim() || null,
      },
      statistics: {
        totalHours: Number(profile?.hours || rosterPilot?.hours || 0) || 0,
        totalFlights: Number(profile?.flights || rosterPilot?.flights || 0) || 0,
        averageLandingRate:
          recentFlights.length > 0
            ? Math.round(
                recentFlights
                  .map((item) => Number(item?.landingRate || 0))
                  .filter((value) => Number.isFinite(value) && value !== 0)
                  .reduce((sum, value, _index, array) => sum + value / array.length, 0)
              ) || null
            : null,
      },
      recentFlights,
      upcomingFlights: Array.isArray(upcomingFlights) ? upcomingFlights : [],
      bookings,
    });
  } catch {
    res.status(502).json({ error: "Failed to load pilot details" });
  }
});

app.get("/api/public/documents", (_req, res) => {
  const documents = listManagedAdminCollection("documents").filter((item) => normalizeAdminBoolean(item?.published, true));
  res.json({ documents });
});

app.get("/api/public/news", (_req, res) => {
  try {
    const news = listManagedAdminCollection("activities")
      .filter((item) => normalizeAdminBoolean(item?.published, true))
      .filter((item) => normalizePublicActivityStatus(item?.status, "Published") === "Published")
      .filter((item) => normalizePublicActivityCategory(item?.category || item?.type) === "News")
      .map((item) => toPublicManualActivity(item))
      .sort((left, right) => {
        const orderDiff = Number(Boolean(right?.featured)) - Number(Boolean(left?.featured));
        if (orderDiff !== 0) {
          return orderDiff;
        }
        const rightTime = Date.parse(String(right?.date || ""));
        const leftTime = Date.parse(String(left?.date || ""));
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      });

    res.json({ news });
  } catch (error) {
    res.status(502).json({ error: String(error || "Failed to load public news") });
  }
});

app.get("/api/public/activities", async (_req, res) => {
  try {
    const manualActivities = listManagedAdminCollection("activities")
      .filter((item) => normalizeAdminBoolean(item?.published, true))
      .filter((item) => normalizePublicActivityStatus(item?.status, "Published") === "Published")
      .filter((item) => normalizePublicActivityCategory(item?.category || item?.type) === "Event")
      .map((item) => toPublicManualActivity(item));

    const liveCatalog = await loadAdminActivitiesCatalog().catch(() => ({ activities: [] }));
    const liveActivities = (Array.isArray(liveCatalog?.activities) ? liveCatalog.activities : [])
      .filter((item) => String(item?.status || "") !== "ended")
      .map((item) => toPublicLiveActivity(item));

    const liveIds = new Set(
      liveActivities
        .map((item) => Number(item?.originalId || 0) || 0)
        .filter((id) => id > 0)
    );

    const manualFallbackActivities = manualActivities.filter((item) => {
      const linkedId = Number(item?.originalId || 0) || 0;
      if (linkedId <= 0) {
        return true;
      }
      return !liveIds.has(linkedId);
    });

    const activities = [...liveActivities, ...manualFallbackActivities].sort((left, right) => {
      const orderDiff = Number(Boolean(right?.featured)) - Number(Boolean(left?.featured));
      if (orderDiff !== 0) {
        return orderDiff;
      }
      const rightTime = Date.parse(String(right?.date || ""));
      const leftTime = Date.parse(String(left?.date || ""));
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });

    res.json({ activities });
  } catch (error) {
    res.status(502).json({ error: String(error || "Failed to load public activities") });
  }
});

app.get("/api/public/documents/:slug", (req, res) => {
  const slug = slugifyAdminValue(req.params.slug, "");
  const document = listManagedAdminCollection("documents").find((item) => item.slug === slug && normalizeAdminBoolean(item?.published, true));
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({ document });
});

app.get("/api/admin/content/:collection", (req, res) => {
  const collection = normalizeAdminText(req.params.collection);
  if (!MANAGED_ADMIN_COLLECTIONS.has(collection)) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  res.json({ items: listManagedAdminCollection(collection) });
});

app.post("/api/admin/content/:collection", express.json(), async (req, res) => {
  const collection = normalizeAdminText(req.params.collection);
  if (!MANAGED_ADMIN_COLLECTIONS.has(collection)) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  let item = upsertManagedAdminCollectionItem(collection, req.body || {});
  if (collection === "activities" && isManagedEventActivity(item)) {
    try {
      const sync = await syncManagedActivityToVamsys(item, { action: "upsert" });
      item = upsertManagedAdminCollectionItem(collection, {
        ...item,
        vamsysId: sync.vamsysId,
        vamsysSection: sync.section,
        vamsysSyncStatus: "synced",
        vamsysSyncError: "",
        vamsysSyncedAt: sync.syncedAt,
      }, item.id);
    } catch (error) {
      item = upsertManagedAdminCollectionItem(collection, {
        ...item,
        vamsysSyncStatus: "failed",
        vamsysSyncError: String(error?.message || error || "vAMSYS sync failed"),
      }, item.id);
    }
  }
  if (
    collection === "activities" &&
    normalizeAdminBoolean(req.body?.sendToDiscord, false) &&
    normalizePublicActivityCategory(item?.category || item?.type) === "News"
  ) {
    void publishNewsToDiscord({
      title: item?.title,
      content: item?.content || item?.summary || item?.description,
      category: item?.category || "News",
      author: item?.author || "Admin",
    }).catch(() => {});
  }
  res.status(201).json({ ok: true, item });
});

app.put("/api/admin/content/:collection/:id", express.json(), async (req, res) => {
  const collection = normalizeAdminText(req.params.collection);
  if (!MANAGED_ADMIN_COLLECTIONS.has(collection)) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  let item = upsertManagedAdminCollectionItem(collection, req.body || {}, req.params.id);
  if (collection === "activities" && isManagedEventActivity(item)) {
    try {
      const sync = await syncManagedActivityToVamsys(item, { action: "upsert" });
      item = upsertManagedAdminCollectionItem(collection, {
        ...item,
        vamsysId: sync.vamsysId,
        vamsysSection: sync.section,
        vamsysSyncStatus: "synced",
        vamsysSyncError: "",
        vamsysSyncedAt: sync.syncedAt,
      }, item.id);
    } catch (error) {
      item = upsertManagedAdminCollectionItem(collection, {
        ...item,
        vamsysSyncStatus: "failed",
        vamsysSyncError: String(error?.message || error || "vAMSYS sync failed"),
      }, item.id);
    }
  }
  if (
    collection === "activities" &&
    normalizeAdminBoolean(req.body?.sendToDiscord, false) &&
    normalizePublicActivityCategory(item?.category || item?.type) === "News"
  ) {
    void publishNewsToDiscord({
      title: item?.title,
      content: item?.content || item?.summary || item?.description,
      category: item?.category || "News",
      author: item?.author || "Admin",
    }).catch(() => {});
  }
  res.json({ ok: true, item });
});

app.delete("/api/admin/content/:collection/:id", async (req, res) => {
  const collection = normalizeAdminText(req.params.collection);
  if (!MANAGED_ADMIN_COLLECTIONS.has(collection)) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  const existing = getManagedAdminCollectionItem(collection, req.params.id);
  if (collection === "activities" && isManagedEventActivity(existing || {})) {
    try {
      await syncManagedActivityToVamsys(existing || {}, { action: "delete" });
    } catch (error) {
      res.status(400).json({ ok: false, error: String(error?.message || error || "Failed to delete activity in vAMSYS") });
      return;
    }
  }

  const deleted = deleteManagedAdminCollectionItem(collection, req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json({ ok: true });
});

app.post("/api/admin/staff/sync", express.json(), async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await syncAdminStaffCollection();
    res.json({ ok: true, ...payload });
  } catch (error) {
    logger.warn("[admin-staff] sync_failed", String(error));
    res.status(502).json({ ok: false, error: "Failed to sync staff roster" });
  }
});

app.get("/api/admin/fleet/catalog", async (_req, res) => {
  const payload = await getManagedFleetCatalog();
  res.json(payload);
});

app.post("/api/admin/fleet/sync", express.json(), async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const payload = await getManagedFleetCatalog({ syncLive: true });
  res.json({ ok: true, fleets: payload.fleets });
});

app.post("/api/admin/fleet/groups", express.json(), async (req, res) => {
  const group = await upsertFleetGroup(req.body || {});
  res.status(201).json({ ok: true, group });
});

app.put("/api/admin/fleet/groups/:id", express.json(), async (req, res) => {
  const group = await upsertFleetGroup(req.body || {}, req.params.id);
  res.json({ ok: true, group });
});

app.delete("/api/admin/fleet/groups/:id", async (req, res) => {
  const deleted = await deleteFleetGroup(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Fleet group not found" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/admin/fleet/aircraft", express.json(), async (req, res) => {
  try {
    const aircraft = await upsertFleetAircraft(req.body || {});
    res.status(201).json({ ok: true, aircraft });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.put("/api/admin/fleet/aircraft/:id", express.json(), async (req, res) => {
  try {
    const aircraft = await upsertFleetAircraft(req.body || {}, req.params.id);
    res.json({ ok: true, aircraft });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.delete("/api/admin/fleet/aircraft/:id", async (req, res) => {
  const deleted = await deleteFleetAircraft(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Aircraft not found" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/admin/routes", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const routes = await loadAdminRoutesCatalog();
    res.json({ routes });
  } catch {
    res.status(502).json({ error: "Failed to load routes" });
  }
});

app.post("/api/admin/routes", express.json({ limit: "2mb" }), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await buildAdminRoutePayload(req.body || {});
    const route = await apiRequest("/routes", { method: "POST", body: payload });
    res.status(201).json({ ok: true, route });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.put("/api/admin/routes/:id", express.json({ limit: "2mb" }), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await buildAdminRouteUpdatePayload(req.body || {});
    const route = await apiRequest(`/routes/${encodeURIComponent(String(req.params.id || ""))}`, { method: "PUT", body: payload });
    res.json({ ok: true, route });
  } catch (error) {
    const message = String(error?.message || error);
    const status = message.includes("404") ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

app.delete("/api/admin/routes/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    await apiRequest(`/routes/${encodeURIComponent(String(req.params.id || ""))}`, { method: "DELETE" });
    const deletedMeta = deleteRouteMeta(req.params.id);
    res.json({ ok: true, deletedMeta });
  } catch (error) {
    const message = String(error?.message || error);
    const status = message.includes("404") ? 404 : 400;
    res.status(status).json({ ok: false, error: message });
  }
});

app.get("/api/admin/routes/:id/detail", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const route = await buildAdminRouteDetail(req.params.id);
    res.json({ route });
  } catch (error) {
    const message = String(error?.message || error);
    const status = message === "Route not found" ? 404 : 502;
    res.status(status).json({ error: message || "Failed to load route detail" });
  }
});

app.put("/api/admin/routes/:id/meta", express.json(), (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const meta = upsertRouteMeta(req.params.id, req.body || {});
    res.json({ ok: true, meta });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.delete("/api/admin/routes/:id/meta", express.json(), (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const deleted = deleteRouteMeta(req.params.id);
    res.json({ ok: true, deleted });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.put("/api/admin/routes/bulk-meta", express.json({ limit: "2mb" }), (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const updates = Array.isArray(req.body?.updates)
      ? req.body.updates
      : Array.isArray(req.body)
        ? req.body
        : [];
    const results = bulkUpsertRouteMeta(updates);
    res.json({ ok: true, updated: results.length, results });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.delete("/api/admin/routes/bulk-meta", express.json({ limit: "2mb" }), (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const routeIds = Array.isArray(req.body?.ids)
      ? req.body.ids
      : Array.isArray(req.body)
        ? req.body
        : [];
    const result = bulkDeleteRouteMeta(routeIds);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/admin/activities", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await loadAdminActivitiesCatalog();
    res.json(payload);
  } catch {
    res.status(502).json({ error: "Failed to load activities" });
  }
});

app.get("/api/admin/activities/:section/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const sectionPath = resolveAdminActivitySectionPath(req.params.section);
  const itemId = Number(req.params.id || 0) || 0;
  if (!sectionPath) {
    res.status(404).json({ ok: false, error: "Unknown activity section" });
    return;
  }
  if (itemId <= 0) {
    res.status(400).json({ ok: false, error: "Activity ID is required" });
    return;
  }

  try {
    const payload = await apiRequest(`${sectionPath}/${itemId}`);
    const activity = payload?.data || payload || null;
    res.json({ ok: true, activity });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to load activity") });
  }
});

app.post("/api/admin/activities/:section", express.json({ limit: "12mb" }), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const sectionPath = resolveAdminActivitySectionPath(req.params.section);
  if (!sectionPath) {
    res.status(404).json({ ok: false, error: "Unknown activity section" });
    return;
  }

  try {
    const payload = await apiRequest(sectionPath, { method: "POST", body: req.body || {} });
    res.status(201).json({ ok: true, activity: payload?.data || payload || null });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to create activity") });
  }
});

app.put("/api/admin/activities/:section/:id", express.json({ limit: "12mb" }), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const sectionPath = resolveAdminActivitySectionPath(req.params.section);
  const itemId = Number(req.params.id || 0) || 0;
  if (!sectionPath) {
    res.status(404).json({ ok: false, error: "Unknown activity section" });
    return;
  }
  if (itemId <= 0) {
    res.status(400).json({ ok: false, error: "Activity ID is required" });
    return;
  }

  try {
    const payload = await apiRequest(`${sectionPath}/${itemId}`, { method: "PUT", body: req.body || {} });
    res.json({ ok: true, activity: payload?.data || payload || null });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to update activity") });
  }
});

app.delete("/api/admin/activities/:section/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const sectionPath = resolveAdminActivitySectionPath(req.params.section);
  const itemId = Number(req.params.id || 0) || 0;
  if (!sectionPath) {
    res.status(404).json({ ok: false, error: "Unknown activity section" });
    return;
  }
  if (itemId <= 0) {
    res.status(400).json({ ok: false, error: "Activity ID is required" });
    return;
  }

  try {
    await apiRequest(`${sectionPath}/${itemId}`, { method: "DELETE" });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to delete activity") });
  }
});

app.get("/api/admin/hubs", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const hubs = await loadAdminHubsCatalog();
    res.json({ hubs });
  } catch {
    res.status(502).json({ error: "Failed to load hubs" });
  }
});

app.post("/api/admin/hubs", express.json(), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await buildAdminHubPayload(req.body || {});
    const hub = await apiRequest("/hubs", { method: "POST", body: payload });
    res.status(201).json({ ok: true, hub });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.put("/api/admin/hubs/:id", express.json(), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = await buildAdminHubPayload(req.body || {});
    const hub = await apiRequest(`/hubs/${encodeURIComponent(String(req.params.id || ""))}`, { method: "PUT", body: payload });
    res.json({ ok: true, hub });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.delete("/api/admin/hubs/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    await apiRequest(`/hubs/${encodeURIComponent(String(req.params.id || ""))}`, { method: "DELETE" });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/admin/hubs/:id/pilots", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const hubId = Number(req.params.id || 0) || 0;
  if (hubId <= 0) {
    res.status(400).json({ error: "Hub ID is required" });
    return;
  }

  try {
    const pilots = await fetchAllPages(`/hubs/${hubId}/pilots?page[size]=100&sort=username`);
    res.json({
      pilots: (Array.isArray(pilots) ? pilots : []).map((pilot) => ({
        id: Number(pilot?.id || 0) || 0,
        username: String(pilot?.username || "").trim(),
        name: String(pilot?.name || pilot?.username || "Pilot").trim() || "Pilot",
        nameWithRank: String(pilot?.name_with_rank || pilot?.name || pilot?.username || "Pilot").trim() || "Pilot",
      })).filter((p) => p.id > 0),
    });
  } catch (error) {
    res.status(502).json({ error: String(error?.message || "Failed to load hub pilots") });
  }
});

app.post("/api/admin/hubs/:hubId/pilots/:pilotId", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const hubId = Number(req.params.hubId || 0) || 0;
  const pilotId = Number(req.params.pilotId || 0) || 0;
  if (hubId <= 0 || pilotId <= 0) {
    res.status(400).json({ ok: false, error: "Hub ID and Pilot ID are required" });
    return;
  }

  try {
    const payload = await apiRequest(`/hubs/${hubId}/pilots/${pilotId}`, { method: "POST" });
    res.json({ ok: true, message: payload?.message || "Pilot assigned to hub." });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.delete("/api/admin/hubs/:hubId/pilots/:pilotId", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  const hubId = Number(req.params.hubId || 0) || 0;
  const pilotId = Number(req.params.pilotId || 0) || 0;
  if (hubId <= 0 || pilotId <= 0) {
    res.status(400).json({ ok: false, error: "Hub ID and Pilot ID are required" });
    return;
  }

  try {
    const payload = await apiRequest(`/hubs/${hubId}/pilots/${pilotId}`, { method: "DELETE" });
    res.json({ ok: true, message: payload?.message || "Pilot removed from hub." });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/admin/airports", async (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const airports = await loadAdminAirportsCatalog();
    res.json({ airports });
  } catch {
    res.status(502).json({ error: "Failed to load airports" });
  }
});

app.post("/api/admin/airports", express.json({ limit: "2mb" }), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = buildAdminAirportPayload(req.body || {}, { isCreate: true });
    const airport = await apiRequest("/airports", { method: "POST", body: payload });
    res.status(201).json({ ok: true, airport });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.put("/api/admin/airports/:id", express.json({ limit: "2mb" }), async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const payload = buildAdminAirportPayload(req.body || {}, { isCreate: false });
    const airport = await apiRequest(`/airports/${encodeURIComponent(String(req.params.id || ""))}`, { method: "PUT", body: payload });
    res.json({ ok: true, airport });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.delete("/api/admin/airports/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    await apiRequest(`/airports/${encodeURIComponent(String(req.params.id || ""))}`, { method: "DELETE" });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/admin/bookings", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100) || 100));
    const bookings = await loadAdminBookingsCatalog({ limit });
    res.json({ bookings });
  } catch {
    res.status(502).json({ error: "Failed to load bookings" });
  }
});

app.get("/api/admin/bookings/:id", async (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const bookingId = encodeURIComponent(String(req.params.id || "").trim());
    if (!bookingId) {
      res.status(400).json({ ok: false, error: "Booking ID is required" });
      return;
    }

    const raw = await apiRequest(`/bookings/${bookingId}`);
    const booking = raw && raw.id && (raw.attributes || raw.relationships)
      ? flattenJsonApiNode(raw)
      : raw && raw?.data && raw.data.id && (raw.data.attributes || raw.data.relationships)
        ? flattenJsonApiNode(raw.data)
        : raw?.data || raw || null;

    const summary = (await loadAdminBookingsCatalog({ limit: 200 })).find(
      (item) => Number(item?.id || 0) === (Number(req.params.id || 0) || 0)
    ) || null;

    res.json({
      booking,
      summary,
      meta: getBookingMetaStore()[String(req.params.id || "")] || null,
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to load booking detail") });
  }
});

app.put("/api/admin/bookings/:id/meta", express.json(), (req, res) => {
  try {
    const meta = upsertBookingMeta(req.params.id, req.body || {});
    res.json({ ok: true, meta });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

// ─── Admin: PIREP management ───────────────────────────────────────────────

app.get("/api/admin/pireps", async (req, res) => {
  if (!requireCredentials(res)) return;
  try {
    const pageSize = Math.max(1, Math.min(100, Number(req.query["page[size]"] || 25) || 25));
    const cursor = String(req.query["page[cursor]"] || "").trim();
    const sort = String(req.query.sort || "-id").trim() || "-id";
    const params = new URLSearchParams();
    params.set("page[size]", String(pageSize));
    params.set("sort", sort);
    if (cursor) params.set("page[cursor]", cursor);
    const filterKeys = [
      "id", "pilot_id", "booking_id", "route_id", "callsign", "flight_number",
      "status", "type", "need_reply", "network", "departure_airport_id", "arrival_airport_id",
    ];
    filterKeys.forEach((key) => {
      const val = String(req.query[`filter[${key}]`] || "").trim();
      if (val) params.set(`filter[${key}]`, val);
    });
    const token = await getAccessToken();
    const url = `${API_BASE}/pireps?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      res.status(response.status).json({ ok: false, error: `vAMSYS error: ${response.status}`, detail: text.slice(0, 500) });
      return;
    }
    const data = await response.json();
    res.json({
      pireps: Array.isArray(data?.data) ? data.data : [],
      meta: data?.meta || null,
    });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to load PIREPs") });
  }
});

app.get("/api/admin/pireps/:id", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  try {
    const payload = await apiRequest(`/pireps/${pirepId}`);
    const pirep = payload?.data || payload || null;
    res.json({ pirep });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to load PIREP") });
  }
});

app.get("/api/admin/pireps/:id/position-reports", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  try {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE}/pireps/${pirepId}/position-reports`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      res.status(response.status).json({ ok: false, error: `vAMSYS error: ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json({ positionReports: Array.isArray(data) ? data : [] });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to load position reports") });
  }
});

app.get("/api/admin/pireps/:id/touchdowns", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  try {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE}/pireps/${pirepId}/touchdowns`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      res.status(response.status).json({ ok: false, error: `vAMSYS error: ${response.status}` });
      return;
    }
    const data = await response.json();
    res.json({ touchdowns: Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []) });
  } catch (error) {
    res.status(502).json({ ok: false, error: String(error?.message || "Failed to load touchdowns") });
  }
});

app.post("/api/admin/pireps/:id/comments", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const content = String(req.body?.content || "").trim();
  if (!content) { res.status(400).json({ ok: false, error: "Comment content is required" }); return; }
  if (content.length > 2000) { res.status(400).json({ ok: false, error: "Comment too long (max 2000)" }); return; }
  try {
    const payload = await apiRequest(`/pireps/${pirepId}/comments`, { method: "POST", body: { content } });
    res.status(201).json({ ok: true, comment: payload?.data || payload });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to add comment") });
  }
});

app.delete("/api/admin/pireps/:id/comments/:commentId", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  const commentId = Number(req.params.commentId || 0) || 0;
  if (pirepId <= 0 || commentId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID and Comment ID required" }); return; }
  try {
    await apiRequest(`/pireps/${pirepId}/comments/${commentId}`, { method: "DELETE" });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to delete comment") });
  }
});

app.put("/api/admin/pireps/:id/points", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const points = Number(req.body?.points ?? null);
  if (!Number.isFinite(points)) { res.status(400).json({ ok: false, error: "Valid points value required" }); return; }
  try {
    await apiRequest(`/pireps/${pirepId}/points`, { method: "PUT", body: { points } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to update points") });
  }
});

app.put("/api/admin/pireps/:id/bonus-points", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const points = Number(req.body?.points ?? null);
  if (!Number.isFinite(points)) { res.status(400).json({ ok: false, error: "Valid points value required" }); return; }
  try {
    await apiRequest(`/pireps/${pirepId}/bonus-points`, { method: "PUT", body: { points } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to update bonus points") });
  }
});

app.post("/api/admin/pireps/:id/reprocess", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  try {
    const payload = await apiRequest(`/pireps/${pirepId}/reprocess`, { method: "POST" });
    res.json({ ok: true, result: payload });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to reprocess PIREP") });
  }
});

app.put("/api/admin/pireps/:id/need-reply", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const need_reply = Boolean(req.body?.need_reply);
  try {
    await apiRequest(`/pireps/${pirepId}/need-reply`, { method: "PUT", body: { need_reply } });
    res.json({ ok: true, need_reply });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to update need-reply") });
  }
});

app.put("/api/admin/pireps/:id/internal-note", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const note = String(req.body?.note || "").trim();
  try {
    await apiRequest(`/pireps/${pirepId}/internal-note`, { method: "PUT", body: { internal_note: note } });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to update internal note") });
  }
});

app.put("/api/admin/pireps/:id/times", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const body = req.body || {};
  const timesPayload = {};
  if (Number.isFinite(Number(body.block_length))) timesPayload.block_length = Number(body.block_length);
  if (Number.isFinite(Number(body.flight_length))) timesPayload.flight_length = Number(body.flight_length);
  if (Number.isFinite(Number(body.paused_air_time))) timesPayload.paused_air_time = Number(body.paused_air_time);
  if (Number.isFinite(Number(body.paused_blocks_time))) timesPayload.paused_blocks_time = Number(body.paused_blocks_time);
  try {
    await apiRequest(`/pireps/${pirepId}/times`, { method: "PUT", body: timesPayload });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to update times") });
  }
});

app.post("/api/admin/pireps/:id/select-landing", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const touchdown_index = Number(req.body?.touchdown_index ?? 0);
  if (!Number.isFinite(touchdown_index) || touchdown_index < 0) {
    res.status(400).json({ ok: false, error: "Valid touchdown_index required" }); return;
  }
  try {
    const payload = await apiRequest(`/pireps/${pirepId}/select-landing`, { method: "POST", body: { touchdown_index } });
    res.json({ ok: true, result: payload });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to select landing") });
  }
});

app.post("/api/admin/pireps/:id/accept", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  try {
    const payload = await apiRequest(`/pireps/${pirepId}/accept`, { method: "POST" });
    res.json({ ok: true, result: payload });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to accept PIREP") });
  }
});

app.post("/api/admin/pireps/:id/accept-claim", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const hours = Number(req.body?.hours ?? 0);
  const minutes = Number(req.body?.minutes ?? 0);
  const points = Number(req.body?.points ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(points)) {
    res.status(400).json({ ok: false, error: "Valid hours, minutes, points required" }); return;
  }
  try {
    const payload = await apiRequest(`/pireps/${pirepId}/accept-claim`, { method: "POST", body: { hours, minutes, points } });
    res.json({ ok: true, result: payload });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to accept claim") });
  }
});

app.post("/api/admin/pireps/:id/reject", express.json(), async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  const reason = String(req.body?.reason || "").trim();
  try {
    const payload = await apiRequest(`/pireps/${pirepId}/reject`, {
      method: "POST",
      body: reason ? { reason } : undefined,
    });
    res.json({ ok: true, result: payload });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to reject PIREP") });
  }
});

app.post("/api/admin/pireps/:id/reject-claim", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  try {
    const payload = await apiRequest(`/pireps/${pirepId}/reject-claim`, { method: "POST" });
    res.json({ ok: true, result: payload });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to reject claim") });
  }
});

app.post("/api/admin/pireps/:id/invalidate", async (req, res) => {
  if (!requireCredentials(res)) return;
  const pirepId = Number(req.params.id || 0) || 0;
  if (pirepId <= 0) { res.status(400).json({ ok: false, error: "PIREP ID required" }); return; }
  try {
    const payload = await apiRequest(`/pireps/${pirepId}/invalidate`, { method: "POST" });
    res.json({ ok: true, result: payload });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || "Failed to invalidate PIREP") });
  }
});

app.get("/api/admin/system-status", async (_req, res) => {
  const credentialsConfigured = Boolean((CLIENT_ID && CLIENT_SECRET) || API_TOKEN);
  const discordConfigured = Boolean(DISCORD_BOT_TOKEN && DISCORD_NEWS_CHANNEL_ID);

  let vamsysReachable = false;
  if (credentialsConfigured) {
    try {
      await getAccessToken();
      vamsysReachable = true;
    } catch {
      vamsysReachable = false;
    }
  }

  res.json({
    vamsys: {
      configured: credentialsConfigured,
      reachable: vamsysReachable,
    },
    discord: {
      configured: discordConfigured,
      newsChannelIdSet: Boolean(DISCORD_NEWS_CHANNEL_ID),
    },
    server: {
      port: Number(PORT) || 8787,
    },
  });
});

app.get("/api/site-design", (_req, res) => {
  res.json({ design: getSiteDesignStore() });
});

app.get("/api/admin/site-design", (_req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  res.json({ design: getSiteDesignStore() });
});

app.put("/api/admin/site-design", express.json({ limit: "8mb" }), (req, res) => {
  if (!requireCredentials(res)) {
    return;
  }

  try {
    const design = upsertSiteDesignStore(req.body || {});
    res.json({ ok: true, design });
  } catch (error) {
    res.status(400).json({ ok: false, error: String(error?.message || error) });
  }
});

if (SERVE_STATIC) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`vAMSYS proxy listening on port ${PORT}`);
  startUnifiedCatalogSyncScheduler();
});
