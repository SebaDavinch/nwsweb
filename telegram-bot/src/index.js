import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../..");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const websiteBaseUrl = String(process.env.WEBSITE_BASE_URL || "http://127.0.0.1:8787").trim().replace(/\/$/, "");
const botConfigToken = String(process.env.TELEGRAM_BOT_CONFIG_TOKEN || "").trim();
const pollingIntervalMs = Math.max(500, Number(process.env.TELEGRAM_POLLING_INTERVAL_MS || 1500) || 1500);
const defaultLanguage = String(process.env.TELEGRAM_DEFAULT_LANGUAGE || "ru").trim().toLowerCase() || "ru";
const vamsysClientId = String(process.env.VAMSYS_CLIENT_ID || "").trim();
const vamsysClientSecret = String(process.env.VAMSYS_CLIENT_SECRET || "").trim();
const vamsysApiScope = String(
  process.env.VAMSYS_API_SCOPE || process.env.VAMSYS_CLIENT_CREDENTIALS_SCOPE || ""
).trim();
const tokenUrl = String(process.env.VAMSYS_TOKEN_URL || process.env.TOKEN_URL || "https://vamsys.io/oauth/token").trim();
const operationsBase = String(process.env.VAMSYS_API_BASE || process.env.API_BASE || "https://vamsys.io/api/v3/operations")
  .trim()
  .replace(/\/+$/, "");
const pirepReviewIntervalMs = Number(process.env.PIREP_REVIEW_INTERVAL_MS || 60000);
const pirepWebBaseUrl = String(process.env.PIREP_WEB_BASE_URL || "https://vamsys.io/pireps")
  .trim()
  .replace(/\/+$/, "");
const pirepReviewRecentLimit = Math.max(
  25,
  Math.min(200, Number(process.env.PIREP_REVIEW_RECENT_LIMIT || 100) || 100)
);
const pirepReviewPendingWindowMs = Math.max(
  Number(process.env.PIREP_REVIEW_PENDING_WINDOW_MS || 12 * 60 * 60 * 1000) || 12 * 60 * 60 * 1000,
  5 * 60 * 1000
);
const authStoreFile = path.resolve(
  String(process.env.AUTH_STORAGE_FILE || path.resolve(ROOT_DIR, "data/auth-store.json")).trim()
);

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in telegram-bot/.env");
  process.exit(1);
}

const telegramApiBase = `https://api.telegram.org/bot${token}`;

let updateOffset = 0;
let polling = false;
let vamsysTokenCache = {
  accessToken: null,
  expiresAt: 0,
};
let cachedConfig = {
  botSettings: {
    enabled: true,
    adminChatIds: [],
    sync: { tickets: true, news: true, notams: true, alerts: true },
    commands: { start: true, help: true, ping: true, news: true, notams: true, ticket: true },
  },
  ticketConfig: {
    enabled: true,
    categories: [],
  },
};
let lastConfigLoadAt = 0;
let lastPirepReviewCheckAt = 0;
let pirepReviewInitialized = false;
let pirepReviewPollInFlight = false;
const pirepReviewSeen = new Map();
const pirepReviewActiveFlights = new Map();
const pirepReviewPendingFlights = new Map();
const pirepReviewCommentState = new Map();

const ACCEPTED_PIREP_STATUSES = new Set(["accepted", "auto_accepted", "approved"]);
const REJECTED_PIREP_STATUSES = new Set(["rejected", "denied", "declined", "failed", "cancelled"]);
const INVALIDATED_PIREP_STATUSES = new Set(["invalidated", "invalid", "void"]);
const DEFAULT_NOTIFICATION_SETTINGS = {
  channels: {
    email: true,
    discord: true,
    telegram: false,
    browser: false,
  },
  notificationTypes: {
    booking: true,
    claim: true,
    review: true,
    awaitingReview: true,
    accepted: true,
    rejected: true,
    needsReply: true,
    invalidated: true,
    notam: true,
    event: true,
    system: true,
    badge: true,
    test: false,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeJsonParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const hasVamsysCredentials = () => Boolean(vamsysClientId && vamsysClientSecret);

const normalizeMatchValue = (value) => String(value || "").trim().toUpperCase();

const loadBotAuthStore = () => {
  try {
    if (!fs.existsSync(authStoreFile)) {
      return null;
    }
    return safeJsonParse(fs.readFileSync(authStoreFile, "utf8"), null);
  } catch {
    return null;
  }
};

const getPilotStoreKeys = (candidate = {}) =>
  Array.from(
    new Set(
      [candidate?.id, candidate?.username, candidate?.email]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

const ensureStoreSection = (store, key) => {
  if (!store[key] || typeof store[key] !== "object") {
    store[key] = {};
  }
  return store[key];
};

const getSharedStoreEntry = (store, sectionName, candidate = {}) => {
  const section = ensureStoreSection(store, sectionName);
  for (const key of getPilotStoreKeys(candidate)) {
    if (section[key] !== undefined) {
      return { key, value: section[key], section };
    }
  }
  return { key: null, value: null, section };
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

const getPilotPreferences = (candidate = {}) => {
  const store = loadBotAuthStore() || {};
  const { value } = getSharedStoreEntry(store, "pilotPreferences", candidate);
  return {
    notifications: cloneNotificationSettings(value?.notifications),
    updatedAt: String(value?.updatedAt || "").trim() || null,
  };
};

const findStoredVamsysLinkEntry = (candidate = {}) => {
  const store = loadBotAuthStore();
  const vamsysLinks = store?.vamsysLinks && typeof store.vamsysLinks === "object" ? store.vamsysLinks : null;
  if (!vamsysLinks) {
    return null;
  }

  const candidateId = String(candidate?.id || "").trim();
  const candidateUsername = normalizeMatchValue(candidate?.username);
  const candidateEmail = normalizeMatchValue(candidate?.email);

  if (candidateId && vamsysLinks[candidateId]) {
    return { store, linkKey: candidateId, link: vamsysLinks[candidateId] };
  }

  for (const [linkKey, link] of Object.entries(vamsysLinks)) {
    if (candidateUsername && normalizeMatchValue(link?.username) === candidateUsername) {
      return { store, linkKey, link };
    }
    if (candidateEmail && normalizeMatchValue(link?.email) === candidateEmail) {
      return { store, linkKey, link };
    }
  }

  return null;
};

const getAdminChatIds = (config) =>
  (Array.isArray(config?.botSettings?.adminChatIds) ? config.botSettings.adminChatIds : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);

const hasTelegramAdminAlertTargets = (config) => getAdminChatIds(config).length > 0;

const hasTelegramPirepPollingEnabled = (config) =>
  config?.botSettings?.enabled !== false &&
  config?.botSettings?.pollingEnabled !== false &&
  config?.botSettings?.sync?.alerts !== false;

const apiHeaders = () => ({
  "Content-Type": "application/json",
  ...(botConfigToken ? { "x-telegram-bot-token": botConfigToken } : {}),
});

const telegramRequest = async (method, body = {}) => {
  const response = await fetch(`${telegramApiBase}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(String(payload?.description || `Telegram API error on ${method}`));
  }
  return payload.result;
};

const sendMessage = async (chatId, text) =>
  telegramRequest("sendMessage", {
    chat_id: chatId,
    text: String(text || "").slice(0, 4096),
    disable_web_page_preview: true,
  });

const sendMessageToAdminChats = async (config, text) => {
  const adminChatIds = getAdminChatIds(config);
  if (!adminChatIds.length) {
    return;
  }

  await Promise.allSettled(adminChatIds.map((chatId) => sendMessage(chatId, text)));
};

const getVamsysAccessToken = async () => {
  const now = Date.now();
  if (vamsysTokenCache.accessToken && now < vamsysTokenCache.expiresAt - 60_000) {
    return vamsysTokenCache.accessToken;
  }

  if (!hasVamsysCredentials()) {
    throw new Error("Missing VAMSYS_CLIENT_ID or VAMSYS_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: vamsysClientId,
    client_secret: vamsysClientSecret,
  });
  if (vamsysApiScope) {
    body.set("scope", vamsysApiScope);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const responseText = await response.text().catch(() => "");
  const payload = safeJsonParse(responseText, {});
  if (!response.ok) {
    throw new Error(String(payload?.error_description || payload?.error || "Failed to obtain vAMSYS token"));
  }

  vamsysTokenCache = {
    accessToken: String(payload?.access_token || "").trim() || null,
    expiresAt: now + Math.max(Number(payload?.expires_in || 3600) || 3600, 60) * 1000,
  };

  if (!vamsysTokenCache.accessToken) {
    throw new Error("vAMSYS token response did not include an access token");
  }

  return vamsysTokenCache.accessToken;
};

const vamsysFetch = async (requestPath) => {
  const accessToken = await getVamsysAccessToken();
  const response = await fetch(`${operationsBase}${requestPath}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`vAMSYS request failed: ${requestPath}`);
  }

  return response.json();
};

const formatUtcDate = (dateValue) => {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date)} UTC`;
};

const toAirportCode = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
};

const normalizePirepStatus = (statusValue) => String(statusValue || "").trim().toLowerCase();

const isAcceptedPirepStatus = (statusValue) => ACCEPTED_PIREP_STATUSES.has(normalizePirepStatus(statusValue));
const isRejectedPirepStatus = (statusValue) => REJECTED_PIREP_STATUSES.has(normalizePirepStatus(statusValue));
const isInvalidatedPirepStatus = (statusValue) => INVALIDATED_PIREP_STATUSES.has(normalizePirepStatus(statusValue));

const isPirepReviewStatus = (statusValue) => {
  const status = normalizePirepStatus(statusValue);
  if (!status) {
    return false;
  }
  return status === "review" || status === "in_review" || status === "under_review" || status === "pending_review" || status.includes("review");
};

const isPirepReviewStartedStatus = (statusValue) => {
  const status = normalizePirepStatus(statusValue);
  return status === "in_review" || status === "under_review";
};

const resolvePirepStatusAlertEvent = (previousStatus, nextStatus) => {
  const normalizedPrevious = normalizePirepStatus(previousStatus);
  const normalizedNext = normalizePirepStatus(nextStatus);
  if (!normalizedNext) {
    return null;
  }

  if (isAcceptedPirepStatus(normalizedNext)) {
    return isAcceptedPirepStatus(normalizedPrevious) ? null : "accepted";
  }
  if (isRejectedPirepStatus(normalizedNext)) {
    return isRejectedPirepStatus(normalizedPrevious) ? null : "rejected";
  }
  if (isInvalidatedPirepStatus(normalizedNext)) {
    return isInvalidatedPirepStatus(normalizedPrevious) ? null : "invalidated";
  }
  if (!isPirepReviewStatus(normalizedNext)) {
    return null;
  }
  if (!isPirepReviewStartedStatus(normalizedPrevious) && isPirepReviewStartedStatus(normalizedNext)) {
    return "reviewStarted";
  }
  if (!normalizedPrevious || isAcceptedPirepStatus(normalizedPrevious) || !isPirepReviewStatus(normalizedPrevious)) {
    return "awaitingReview";
  }

  return null;
};

const getPirepFiledTimestamp = (pirep = {}) => {
  const raw = pirep?.submitted_at || pirep?.filed_at || pirep?.updated_at || pirep?.created_at || null;
  const timestamp = Date.parse(String(raw || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizePirepRouteCodes = (pirep = {}) => ({
  departure:
    toAirportCode(
      pirep?.departure_airport?.icao ||
        pirep?.departure_airport?.iata ||
        pirep?.departure_icao ||
        pirep?.departure_id ||
        pirep?.departure_airport_id
    ) || "-",
  arrival:
    toAirportCode(
      pirep?.arrival_airport?.icao ||
        pirep?.arrival_airport?.iata ||
        pirep?.arrival_icao ||
        pirep?.arrival_id ||
        pirep?.arrival_airport_id
    ) || "-",
});

const buildTrackedFlightKey = (flight = {}) => {
  const pilotId = Number(flight?.pilotId || 0) || 0;
  const pilotUsername = String(flight?.pilotUsername || "").trim().toLowerCase();
  const callsign = String(flight?.callsign || "").trim().toUpperCase();
  const departure = toAirportCode(flight?.departure) || "----";
  const arrival = toAirportCode(flight?.arrival) || "----";
  const pilotKey = pilotId > 0 ? `pilot:${pilotId}` : pilotUsername ? `user:${pilotUsername}` : "pilot:unknown";
  return `${pilotKey}|${callsign || `${departure}-${arrival}`}`;
};

const normalizeFlightForPirepTracking = (item = {}) => {
  const booking = item?.booking && typeof item.booking === "object" ? item.booking : {};
  const pilot = item?.pilot && typeof item.pilot === "object" ? item.pilot : {};
  const departureAirport = item?.departureAirport && typeof item.departureAirport === "object" ? item.departureAirport : {};
  const arrivalAirport = item?.arrivalAirport && typeof item.arrivalAirport === "object" ? item.arrivalAirport : {};
  const progress = item?.progress && typeof item.progress === "object" ? item.progress : {};
  const departure =
    toAirportCode(departureAirport?.icao || departureAirport?.iata || departureAirport?.identifier || booking?.departure_icao || booking?.departure_id) ||
    "-";
  const arrival =
    toAirportCode(arrivalAirport?.icao || arrivalAirport?.iata || arrivalAirport?.identifier || booking?.arrival_icao || booking?.arrival_id) ||
    "-";
  const callsign =
    String(booking?.callsign || booking?.flightNumber || booking?.flight_number || item?.callsign || "").trim().toUpperCase() ||
    `${departure}-${arrival}`;
  const tracked = {
    callsign,
    departure,
    arrival,
    routeLabel: `${departure} -> ${arrival}`,
    pilotId: Number(pilot?.id || booking?.pilot_id || 0) || 0,
    pilotName: String(pilot?.name || pilot?.username || "Unknown pilot").trim() || "Unknown pilot",
    pilotUsername: String(pilot?.username || "").trim(),
    pilotEmail: String(pilot?.email || "").trim(),
    aircraft:
      String(item?.aircraft?.registration || item?.aircraft?.name || item?.aircraft?.type || booking?.aircraft?.name || booking?.aircraft?.type || "").trim() ||
      "-",
    startedAt:
      getPirepFiledTimestamp({
        submitted_at: progress?.departureTime || progress?.std || progress?.started_at || item?.updated_at || item?.created_at,
      }) || Date.now(),
    currentPhase: String(progress?.currentPhase || progress?.phase || "").trim() || "En Route",
  };

  return {
    ...tracked,
    trackingKey: buildTrackedFlightKey(tracked),
  };
};

const isPotentialPirepMatch = (pirep = {}, trackedFlight = {}) => {
  const pirepPilotId = Number(pirep?.pilot_id || pirep?.pilot?.id || 0) || 0;
  const trackedPilotId = Number(trackedFlight?.pilotId || 0) || 0;
  if (trackedPilotId > 0 && pirepPilotId > 0 && trackedPilotId !== pirepPilotId) {
    return false;
  }

  const pirepCallsign = String(pirep?.callsign || pirep?.flight_number || "").trim().toUpperCase();
  const trackedCallsign = String(trackedFlight?.callsign || "").trim().toUpperCase();
  if (trackedCallsign && pirepCallsign && trackedCallsign !== pirepCallsign) {
    return false;
  }

  const routeCodes = normalizePirepRouteCodes(pirep);
  if (
    trackedFlight?.departure &&
    trackedFlight?.arrival &&
    routeCodes.departure !== "-" &&
    routeCodes.arrival !== "-" &&
    (trackedFlight.departure !== routeCodes.departure || trackedFlight.arrival !== routeCodes.arrival)
  ) {
    return false;
  }

  const filedTimestamp = getPirepFiledTimestamp(pirep);
  const endedAt = Number(trackedFlight?.endedAt || 0) || 0;
  if (filedTimestamp > 0 && endedAt > 0 && filedTimestamp < endedAt - 30 * 60 * 1000) {
    return false;
  }

  return true;
};

const findMatchingPirepForTrackedFlight = (trackedFlight = {}, pireps = []) => {
  const matches = (Array.isArray(pireps) ? pireps : [])
    .filter((item) => item?.id && isPotentialPirepMatch(item, trackedFlight))
    .sort((left, right) => getPirepFiledTimestamp(right) - getPirepFiledTimestamp(left));

  return matches[0] || null;
};

const loadPirepDetails = async (pirepId) => {
  const normalizedId = Number(pirepId || 0) || 0;
  if (normalizedId <= 0) {
    return null;
  }

  const payload = await vamsysFetch(`/pireps/${normalizedId}`);
  return payload?.data || payload || null;
};

const resolvePirepReviewUrl = (pirep = {}) => {
  const directUrl = pirep?.url || pirep?.pirep_url || pirep?.review_url || pirep?.links?.web || pirep?.links?.self || null;
  if (typeof directUrl === "string" && directUrl.startsWith("http")) {
    return directUrl;
  }
  if (!pirep?.id || !pirepWebBaseUrl) {
    return null;
  }
  return `${pirepWebBaseUrl}/${pirep.id}`;
};

const extractPirepComments = (pirep = {}) => {
  const candidates = [pirep?.comments, pirep?.data?.comments, pirep?.attributes?.comments];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => item && typeof item === "object");
    }
  }
  return [];
};

const getPirepCommentText = (comment = {}) => String(comment?.comment || comment?.content || comment?.message || comment?.body || "").trim();
const getPirepCommentAuthorName = (comment = {}) =>
  String(comment?.commenter_name || comment?.commenterName || comment?.author_name || comment?.authorName || comment?.user_name || comment?.username || "").trim();

const getPirepCommentSignature = (comment = {}) => {
  const commentId = Number(comment?.id || comment?.comment_id || comment?.commentId || comment?.author_comment_id || 0) || 0;
  const createdAt = String(comment?.created_at || comment?.createdAt || comment?.updated_at || comment?.updatedAt || "").trim();
  const text = getPirepCommentText(comment).slice(0, 120);
  return `${commentId || createdAt || "comment"}:${text}`;
};

const isStaffPirepComment = (comment = {}, pirep = {}, trackedFlight = null) => {
  const pilotId = Number(pirep?.pilot_id || pirep?.pilot?.id || trackedFlight?.pilotId || 0) || 0;
  const commenterId = Number(comment?.commenter_id || comment?.commenterId || comment?.user_id || comment?.userId || comment?.author_id || comment?.authorId || 0) || 0;
  if (pilotId > 0 && commenterId > 0) {
    return pilotId !== commenterId;
  }

  const pilotNames = new Set(
    [
      pirep?.pilot?.name,
      pirep?.pilot?.username,
      pirep?.pilot_name,
      pirep?.pilot_username,
      trackedFlight?.pilotName,
      trackedFlight?.pilotUsername,
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const authorName = getPirepCommentAuthorName(comment).toLowerCase();
  if (!authorName) {
    return true;
  }
  return !pilotNames.has(authorName);
};

const getLatestStaffPirepComment = (pirep = {}, trackedFlight = null) => {
  const comments = extractPirepComments(pirep)
    .filter((comment) => getPirepCommentText(comment))
    .filter((comment) => isStaffPirepComment(comment, pirep, trackedFlight))
    .sort((left, right) => {
      const rightTime = Date.parse(String(right?.created_at || right?.createdAt || right?.updated_at || right?.updatedAt || "")) || 0;
      const leftTime = Date.parse(String(left?.created_at || left?.createdAt || left?.updated_at || left?.updatedAt || "")) || 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return (Number(right?.id || 0) || 0) - (Number(left?.id || 0) || 0);
    });

  return comments[0] || null;
};

const rememberPirepCommentState = (pirep = {}, trackedFlight = null) => {
  if (!pirep?.id) {
    return;
  }

  const latestComment = getLatestStaffPirepComment(pirep, trackedFlight);
  pirepReviewCommentState.set(String(pirep.id), {
    signature: latestComment ? getPirepCommentSignature(latestComment) : "",
    updatedAt: String(pirep?.updated_at || pirep?.submitted_at || pirep?.created_at || "").trim() || null,
  });
};

const formatPirepAlertMessage = ({ pirep, trackedFlight = null, source = "recent-feed", eventKey = "awaitingReview", comment = null } = {}) => {
  const pilotName = pirep?.pilot?.name || pirep?.pilot?.username || pirep?.pilot_name || trackedFlight?.pilotName || "Unknown pilot";
  const routeCodes = normalizePirepRouteCodes(pirep);
  const departureCode = routeCodes.departure !== "-" ? routeCodes.departure : trackedFlight?.departure || "-";
  const arrivalCode = routeCodes.arrival !== "-" ? routeCodes.arrival : trackedFlight?.arrival || "-";
  const callsign = pirep?.callsign || pirep?.flight_number || `PIREP ${pirep?.id || "-"}`;
  const reviewUrl = resolvePirepReviewUrl(pirep);
  const status = normalizePirepStatus(pirep?.status) || "submitted";
  const filedAt = formatUtcDate(pirep?.filed_at || pirep?.created_at || pirep?.submitted_at || null);
  const monitorSource =
    source === "flight-end"
      ? "Detected after the live flight disappeared from the active flights feed."
      : "Detected from the recent PIREP submission feed.";

  let title = "PIREP Review Required";
  if (eventKey === "reviewStarted") {
    title = "PIREP Review Started";
  } else if (eventKey === "staffComment") {
    title = "New Staff Comment On PIREP";
  } else if (eventKey === "accepted") {
    title = "PIREP Accepted";
  } else if (eventKey === "rejected") {
    title = "PIREP Rejected";
  } else if (eventKey === "invalidated") {
    title = "PIREP Invalidated";
  }

  const lines = [
    title,
    `Pilot: ${pilotName}`,
    `Flight: ${callsign}`,
    `Route: ${departureCode} -> ${arrivalCode}`,
    `Status: ${status}`,
    `Filed: ${filedAt}`,
    `PIREP ID: ${pirep?.id || "-"}`,
    `Source: ${monitorSource}`,
  ];

  if (eventKey === "staffComment" && comment) {
    lines.push(`Comment by ${getPirepCommentAuthorName(comment) || "Staff"}: ${getPirepCommentText(comment).slice(0, 800) || "Comment added"}`);
  }
  if (reviewUrl) {
    lines.push(`Open: ${reviewUrl}`);
  }

  return lines.join("\n");
};

const getPilotNotificationTypeForPirepEvent = (eventKey) => {
  if (eventKey === "reviewStarted") {
    return "awaitingReview";
  }
  if (eventKey === "staffComment") {
    return "needsReply";
  }
  if (eventKey === "accepted") {
    return "accepted";
  }
  if (eventKey === "rejected") {
    return "rejected";
  }
  if (eventKey === "invalidated") {
    return "invalidated";
  }

  return "review";
};

const shouldSendPirepPilotTelegram = (eventKey) => eventKey !== "awaitingReview";

const sendPirepPilotTelegram = async ({ pirep, trackedFlight = null, source = "recent-feed", eventKey = "awaitingReview", comment = null } = {}) => {
  const candidate = {
    id: Number(pirep?.pilot_id || pirep?.pilot?.id || trackedFlight?.pilotId || 0) || 0,
    username: String(pirep?.pilot?.username || pirep?.pilot_username || trackedFlight?.pilotUsername || "").trim() || null,
    email: String(pirep?.pilot?.email || pirep?.pilot_email || trackedFlight?.pilotEmail || "").trim() || null,
  };
  const binding = findStoredVamsysLinkEntry(candidate)?.link || candidate;
  const telegram = binding?.metadata?.telegram && typeof binding.metadata.telegram === "object"
    ? binding.metadata.telegram
    : null;
  const chatId = String(telegram?.chatId || "").trim();
  if (!chatId || !shouldSendPirepPilotTelegram(eventKey)) {
    return;
  }

  const preferences = getPilotPreferences(binding);
  const notificationTypeKey = getPilotNotificationTypeForPirepEvent(eventKey);
  if (
    preferences.notifications.channels.telegram === false ||
    preferences.notifications.notificationTypes[notificationTypeKey] === false
  ) {
    return;
  }

  await sendMessage(chatId, formatPirepAlertMessage({ pirep, trackedFlight, source, eventKey, comment })).catch(() => null);
};

const linkTelegramAccount = async (message, rawCode) => {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) {
    await sendMessage(message.chat.id, "Формат: /link CODE\nОткройте Settings на сайте, сгенерируйте код и отправьте его сюда.");
    return;
  }

  const response = await fetch(`${websiteBaseUrl}/api/telegram-bot/link`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({
      code,
      telegramChatId: String(message.chat.id),
      actor: {
        chatId: String(message.chat.id),
        telegramId: String(message.from?.id || ""),
        username: String(message.from?.username || "").trim() || null,
        name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ").trim() || message.from?.username || "Telegram User",
      },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(payload?.error || "Failed to link Telegram account"));
  }

  const pilotName = String(payload?.pilot?.name || payload?.pilot?.username || "пилот").trim() || "пилот";
  await sendMessage(message.chat.id, `Telegram успешно привязан к аккаунту ${pilotName}. Теперь бот сможет присылать персональные уведомления.`);
};

const sendPirepReviewNotifications = async ({ config, pirep, trackedFlight = null, source = "recent-feed", eventKey = "awaitingReview", comment = null } = {}) => {
  if (!pirep?.id || !hasTelegramPirepPollingEnabled(config)) {
    return;
  }

  const message = formatPirepAlertMessage({ pirep, trackedFlight, source, eventKey, comment });
  if (hasTelegramAdminAlertTargets(config)) {
    await sendMessageToAdminChats(config, message);
  }
  await sendPirepPilotTelegram({ pirep, trackedFlight, source, eventKey, comment });
};

const notifyPirepReviewStatus = async (config) => {
  if (!hasTelegramPirepPollingEnabled(config) || !hasVamsysCredentials() || pirepReviewPollInFlight) {
    return;
  }

  pirepReviewPollInFlight = true;
  try {
    const [flightMapPayload, payload] = await Promise.all([
      vamsysFetch("/flight-map"),
      vamsysFetch(`/pireps?page[size]=${pirepReviewRecentLimit}&sort=-id`),
    ]);
    const currentFlights = new Map(
      (Array.isArray(flightMapPayload?.data) ? flightMapPayload.data : [])
        .map((item) => normalizeFlightForPirepTracking(item))
        .filter((item) => item?.trackingKey)
        .map((item) => [item.trackingKey, item])
    );
    const pireps = Array.isArray(payload?.data) ? payload.data : [];

    if (!pirepReviewInitialized) {
      currentFlights.forEach((item, key) => {
        pirepReviewActiveFlights.set(key, item);
      });
      pireps.forEach((item) => {
        if (item?.id) {
          pirepReviewSeen.set(String(item.id), normalizePirepStatus(item.status));
          rememberPirepCommentState(item);
        }
      });
      pirepReviewInitialized = true;
      return;
    }

    if (pirepReviewSeen.size > 2000) {
      const keys = Array.from(pirepReviewSeen.keys()).slice(0, 1000);
      keys.forEach((key) => pirepReviewSeen.delete(key));
      keys.forEach((key) => pirepReviewCommentState.delete(key));
    }

    const now = Date.now();
    for (const [key, trackedFlight] of pirepReviewActiveFlights.entries()) {
      if (currentFlights.has(key) || pirepReviewPendingFlights.has(key)) {
        continue;
      }

      pirepReviewPendingFlights.set(key, {
        ...trackedFlight,
        endedAt: now,
        watchCreatedAt: now,
      });
    }

    pirepReviewActiveFlights.clear();
    currentFlights.forEach((item, key) => {
      pirepReviewActiveFlights.set(key, item);
    });

    for (const [key, trackedFlight] of pirepReviewPendingFlights.entries()) {
      if (now - (Number(trackedFlight?.watchCreatedAt || trackedFlight?.endedAt || 0) || 0) > pirepReviewPendingWindowMs) {
        pirepReviewPendingFlights.delete(key);
        continue;
      }

      const matchedPirep = findMatchingPirepForTrackedFlight(trackedFlight, pireps);
      if (!matchedPirep?.id) {
        continue;
      }

      const detailedPirep = (await loadPirepDetails(matchedPirep.id).catch(() => null)) || matchedPirep;
      const pirepKey = String(detailedPirep.id);
      const previousStatus = pirepReviewSeen.get(pirepKey);
      const normalizedStatus = normalizePirepStatus(detailedPirep.status);
      const alertEvent = resolvePirepStatusAlertEvent(previousStatus, normalizedStatus);

      if (alertEvent) {
        await sendPirepReviewNotifications({
          config,
          pirep: detailedPirep,
          trackedFlight,
          source: "flight-end",
          eventKey: alertEvent,
        });
      }

      pirepReviewSeen.set(pirepKey, normalizedStatus);
      rememberPirepCommentState(detailedPirep, trackedFlight);
      pirepReviewPendingFlights.delete(key);
    }

    for (const pirep of pireps) {
      if (!pirep?.id) {
        continue;
      }

      const key = String(pirep.id);
      const normalizedStatus = normalizePirepStatus(pirep.status);
      const previousStatus = pirepReviewSeen.get(key);
      const alertEvent = resolvePirepStatusAlertEvent(previousStatus, normalizedStatus);
      let detailedPirep = null;

      if (previousStatus === normalizedStatus) {
        const previousCommentState = pirepReviewCommentState.get(key) || null;
        const payloadUpdatedAt = String(pirep?.updated_at || pirep?.submitted_at || pirep?.created_at || "").trim() || null;
        const shouldRefreshComments =
          isPirepReviewStatus(normalizedStatus) &&
          (!previousCommentState || (payloadUpdatedAt && payloadUpdatedAt !== previousCommentState.updatedAt));

        if (!shouldRefreshComments) {
          continue;
        }

        detailedPirep = (await loadPirepDetails(pirep.id).catch(() => null)) || pirep;
        const latestStaffComment = getLatestStaffPirepComment(detailedPirep);
        const nextSignature = latestStaffComment ? getPirepCommentSignature(latestStaffComment) : "";
        if (
          latestStaffComment &&
          previousCommentState &&
          previousCommentState.signature &&
          nextSignature !== previousCommentState.signature
        ) {
          await sendPirepReviewNotifications({
            config,
            pirep: detailedPirep,
            trackedFlight: null,
            source: "recent-feed",
            eventKey: "staffComment",
            comment: latestStaffComment,
          });
        }

        rememberPirepCommentState(detailedPirep);
        continue;
      }

      if (alertEvent) {
        detailedPirep = (await loadPirepDetails(pirep.id).catch(() => null)) || pirep;
        await sendPirepReviewNotifications({
          config,
          pirep: detailedPirep,
          trackedFlight: null,
          source: "recent-feed",
          eventKey: alertEvent,
        });
      }

      pirepReviewSeen.set(key, normalizedStatus);
      rememberPirepCommentState(detailedPirep || pirep);
    }
  } catch (error) {
    console.error("[telegram-bot] pirep_review_notifier_failed", String(error?.message || error));
  } finally {
    pirepReviewPollInFlight = false;
  }
};

const setCommands = async () => {
  const commands = [
    { command: "start", description: "Start the bot" },
    { command: "help", description: "List available commands" },
    { command: "ping", description: "Check bot status" },
    { command: "link", description: "Link Telegram to your pilot profile using a code from the website" },
    { command: "news", description: "Latest Nordwind news" },
    { command: "notams", description: "Latest operational NOTAMs" },
    { command: "ticket", description: "Create ticket: /ticket category | subject | message" },
    { command: "news_create", description: "Admin: create news" },
    { command: "alert_create", description: "Admin: create alert" },
    { command: "notam_create", description: "Admin: create NOTAM" },
  ];
  await telegramRequest("setMyCommands", { commands });
};

const loadRemoteConfig = async ({ force = false } = {}) => {
  if (!force && Date.now() - lastConfigLoadAt < 5 * 60 * 1000) {
    return cachedConfig;
  }

  if (!botConfigToken) {
    lastConfigLoadAt = Date.now();
    return cachedConfig;
  }

  try {
    const response = await fetch(`${websiteBaseUrl}/api/telegram-bot/config`, {
      headers: apiHeaders(),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(String(payload?.error || "Failed to load Telegram bot config"));
    }
    cachedConfig = {
      botSettings: payload?.botSettings && typeof payload.botSettings === "object" ? payload.botSettings : cachedConfig.botSettings,
      ticketConfig: payload?.ticketConfig && typeof payload.ticketConfig === "object" ? payload.ticketConfig : cachedConfig.ticketConfig,
    };
    lastConfigLoadAt = Date.now();
  } catch (error) {
    console.warn("[telegram-bot] config_load_failed", String(error));
  }

  return cachedConfig;
};

const isAdminChat = async (chatId) => {
  const config = await loadRemoteConfig();
  const allowed = Array.isArray(config?.botSettings?.adminChatIds) ? config.botSettings.adminChatIds : [];
  return allowed.map((item) => String(item)).includes(String(chatId));
};

const fetchLatestNews = async (count = 3) => {
  const response = await fetch(`${websiteBaseUrl}/api/public/activities`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(payload?.error || "Failed to load news"));
  }
  return (Array.isArray(payload?.activities) ? payload.activities : [])
    .filter((item) => String(item?.category || "").toLowerCase() === "news")
    .slice(0, Math.max(1, Math.min(10, count)));
};

const fetchLatestNotams = async (count = 5) => {
  const response = await fetch(`${websiteBaseUrl}/api/vamsys/notams`);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(payload?.error || "Failed to load NOTAMs"));
  }
  return (Array.isArray(payload?.notams) ? payload.notams : []).slice(0, Math.max(1, Math.min(10, count)));
};

const syncContent = async (payload) => {
  const response = await fetch(`${websiteBaseUrl}/api/telegram-bot/sync/content`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(data?.error || "Failed to sync content"));
  }
  return data;
};

const createTicket = async (payload) => {
  const response = await fetch(`${websiteBaseUrl}/api/telegram-bot/tickets`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(data?.error || "Failed to create ticket"));
  }
  return data?.ticket || null;
};

const parseCountArgument = (rawValue, fallback) => {
  const value = Number(String(rawValue || "").trim());
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(10, Math.max(1, Math.trunc(value)));
};

const splitPayload = (text) =>
  String(text || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

const formatNewsItems = (items = []) => {
  if (!items.length) {
    return "Новостей пока нет.";
  }
  return items
    .map((item, index) => {
      const title = String(item?.title || "Без названия").trim();
      const summary = String(item?.summary || item?.content || "").trim();
      const date = String(item?.date || "").trim();
      return `${index + 1}. ${title}${date ? `\n${date}` : ""}${summary ? `\n${summary.slice(0, 220)}` : ""}`;
    })
    .join("\n\n");
};

const formatNotams = (items = []) => {
  if (!items.length) {
    return "NOTAM сейчас нет.";
  }
  return items
    .map((item, index) => {
      const title = String(item?.title || "Untitled NOTAM").trim();
      const priority = String(item?.priority || "medium").trim();
      const content = String(item?.content || "").trim().slice(0, 320);
      return `${index + 1}. [${priority}] ${title}${content ? `\n${content}` : ""}`;
    })
    .join("\n\n");
};

const formatHelp = async () => {
  const config = await loadRemoteConfig();
  const categories = Array.isArray(config?.ticketConfig?.categories) ? config.ticketConfig.categories : [];
  const categoryList = categories.length
    ? categories.filter((item) => item?.enabled !== false).map((item) => item.name || item.id).join(", ")
    : "operations, website, discord";

  return [
    "Команды Telegram-бота:",
    "/start",
    "/help",
    "/ping",
    "/link CODE",
    "/news [count]",
    "/notams [count]",
    `/ticket category | subject | message`,
    "Пример:",
    "/link TG-ABC12345",
    `/ticket website | Не работает флот | Во вкладке Fleet пусто`,
    `Категории тикетов: ${categoryList}`,
    "",
    "Admin:",
    "/news_create title | content",
    "/alert_create title | content",
    "/notam_create [priority] | title | content",
  ].join("\n");
};

const handleTicketCommand = async (message, text) => {
  const parts = splitPayload(text);
  if (parts.length < 3) {
    await sendMessage(
      message.chat.id,
      "Формат: /ticket category | subject | message\nПример: /ticket website | Не работает флот | Пустая страница Fleet"
    );
    return;
  }

  const [category, subject, ...contentParts] = parts;
  const ticket = await createTicket({
    category,
    subject,
    content: contentParts.join(" | "),
    language: defaultLanguage,
    telegramChatId: String(message.chat.id),
    actor: {
      telegramId: String(message.from?.id || ""),
      username: String(message.from?.username || "").trim() || null,
      name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ").trim() || message.from?.username || "Telegram User",
    },
  });

  await sendMessage(
    message.chat.id,
    ticket
      ? `Тикет создан: #${ticket.number}\nТема: ${ticket.subject}\nКатегория: ${ticket.categoryName}`
      : "Тикет создан."
  );
};

const handleAdminContentCommand = async (message, command, text) => {
  if (!(await isAdminChat(message.chat.id))) {
    await sendMessage(message.chat.id, "Эта команда доступна только в админских чатах.");
    return;
  }

  if (command === "news_create") {
    const [title, ...contentParts] = splitPayload(text);
    if (!title || contentParts.length === 0) {
      await sendMessage(message.chat.id, "Формат: /news_create title | content");
      return;
    }
    await syncContent({ type: "news", title, content: contentParts.join(" | "), author: "Telegram Bot" });
    await sendMessage(message.chat.id, `Новость создана: ${title}`);
    return;
  }

  if (command === "alert_create") {
    const [title, ...contentParts] = splitPayload(text);
    if (!title || contentParts.length === 0) {
      await sendMessage(message.chat.id, "Формат: /alert_create title | content");
      return;
    }
    await syncContent({ type: "alert", title, content: contentParts.join(" | "), author: "Telegram Bot" });
    await sendMessage(message.chat.id, `Alert создан: ${title}`);
    return;
  }

  if (command === "notam_create") {
    const parts = splitPayload(text);
    if (parts.length < 2) {
      await sendMessage(message.chat.id, "Формат: /notam_create [priority] | title | content");
      return;
    }

    let notamPriority = "medium";
    let title = parts[0];
    let contentStartIndex = 1;
    if (["low", "medium", "high"].includes(parts[0].toLowerCase()) && parts.length >= 3) {
      notamPriority = parts[0].toLowerCase();
      title = parts[1];
      contentStartIndex = 2;
    }
    const content = parts.slice(contentStartIndex).join(" | ");
    if (!title || !content) {
      await sendMessage(message.chat.id, "Формат: /notam_create [priority] | title | content");
      return;
    }

    await syncContent({
      type: "notam",
      title,
      content,
      notamPriority,
      author: "Telegram Bot",
    });
    await sendMessage(message.chat.id, `NOTAM создан: ${title}`);
  }
};

const handleCommand = async (message) => {
  const text = String(message?.text || "").trim();
  if (!text.startsWith("/")) {
    return;
  }

  const [commandToken, ...rest] = text.split(" ");
  const command = String(commandToken || "")
    .replace(/^\/+/, "")
    .split("@")[0]
    .toLowerCase();
  const restText = rest.join(" ").trim();

  try {
    if (command === "start") {
      if (restText) {
        await linkTelegramAccount(message, restText);
        return;
      }
      await sendMessage(message.chat.id, "Nordwind Telegram Bot запущен. Напиши /help, чтобы увидеть доступные команды.");
      return;
    }

    if (command === "help") {
      await sendMessage(message.chat.id, await formatHelp());
      return;
    }

    if (command === "ping") {
      await sendMessage(message.chat.id, "pong");
      return;
    }

    if (command === "link") {
      await linkTelegramAccount(message, restText);
      return;
    }

    if (command === "news") {
      const items = await fetchLatestNews(parseCountArgument(rest[0], 3));
      await sendMessage(message.chat.id, formatNewsItems(items));
      return;
    }

    if (command === "notams") {
      const items = await fetchLatestNotams(parseCountArgument(rest[0], 5));
      await sendMessage(message.chat.id, formatNotams(items));
      return;
    }

    if (command === "ticket") {
      await handleTicketCommand(message, restText);
      return;
    }

    if (["news_create", "alert_create", "notam_create"].includes(command)) {
      await handleAdminContentCommand(message, command, restText);
    }
  } catch (error) {
    console.error("[telegram-bot] command_failed", command, error);
    await sendMessage(message.chat.id, `Ошибка: ${String(error?.message || error || "unknown error")}`);
  }
};

const pollOnce = async () => {
  const updates = await telegramRequest("getUpdates", {
    offset: updateOffset,
    timeout: 25,
    allowed_updates: ["message"],
  });

  for (const update of Array.isArray(updates) ? updates : []) {
    updateOffset = Math.max(updateOffset, Number(update?.update_id || 0) + 1);
    const message = update?.message;
    if (!message?.text) {
      continue;
    }
    await handleCommand(message);
  }
};

const startPolling = async () => {
  if (polling) {
    return;
  }
  polling = true;
  console.log("[telegram-bot] polling_started");

  while (true) {
    try {
      const config = await loadRemoteConfig();
      if (config?.botSettings?.enabled === false || config?.botSettings?.pollingEnabled === false) {
        await sleep(5000);
        continue;
      }

      const now = Date.now();
      if (now - lastPirepReviewCheckAt >= pirepReviewIntervalMs) {
        lastPirepReviewCheckAt = now;
        await notifyPirepReviewStatus(config);
      }

      await pollOnce();
    } catch (error) {
      console.error("[telegram-bot] polling_error", error);
      await sleep(3000);
    }

    await sleep(pollingIntervalMs);
  }
};

await loadRemoteConfig({ force: true });
await setCommands().catch((error) => {
  console.warn("[telegram-bot] set_commands_failed", String(error));
});
await startPolling();
