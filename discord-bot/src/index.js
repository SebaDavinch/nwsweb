import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import 'dotenv/config';
import {
  ActivityType,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} from 'discord.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../..');
const BOT_DIR = path.resolve(__dirname, '..');

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const vamsysClientId = process.env.VAMSYS_CLIENT_ID;
const vamsysClientSecret = process.env.VAMSYS_CLIENT_SECRET;
const pilotApiClientId = String(process.env.PILOT_API_CLIENT_ID || '').trim();
const pilotApiBase = String(process.env.PILOT_API_BASE || 'https://vamsys.io/api/v3/pilot')
  .trim()
  .replace(/\/+$/, '');
const authStoreFile = path.resolve(
  String(process.env.AUTH_STORAGE_FILE || path.resolve(ROOT_DIR, 'data/auth-store.json')).trim()
);
const websiteBaseUrl = String(process.env.WEBSITE_BASE_URL || 'https://vnws.org')
  .trim()
  .replace(/\/+$/, '');
const pilotBookingsUrl = String(
  process.env.PILOT_BOOKINGS_URL || `${websiteBaseUrl}/dashboard?tab=bookings`
).trim();
const profileCardScript = path.resolve(BOT_DIR, 'profile_card.py');
const badgesCardScript = path.resolve(BOT_DIR, 'badges_card.py');
const profileCardBackground = path.resolve(
  ROOT_DIR,
  'src/assets/26e15098031469524c864ad646ad94972bd0af05.png'
);
const profileCardLogo = path.resolve(
  ROOT_DIR,
  'src/assets/99be6a8339eae76151119a13613864930c8bf6e7.png'
);
const vamsysApiScope = String(
  process.env.VAMSYS_API_SCOPE || process.env.VAMSYS_CLIENT_CREDENTIALS_SCOPE || ''
).trim();
const liveFeedChannelId =
  process.env.LIVE_FEED_CHANNEL_ID || '1456988328388985003';
const liveFeedIntervalMs = Number(process.env.LIVE_FEED_INTERVAL_MS || 120000);
const pirepReviewChannelId =
  process.env.PIREP_REVIEW_CHANNEL_ID || '1405161495368699914';
const pirepReviewIntervalMs = Number(process.env.PIREP_REVIEW_INTERVAL_MS || 60000);
const pirepWebBaseUrl = String(process.env.PIREP_WEB_BASE_URL || 'https://vamsys.io/pireps')
  .trim()
  .replace(/\/+$/, '');
const pirepReviewRecentLimit = Math.max(
  25,
  Math.min(200, Number(process.env.PIREP_REVIEW_RECENT_LIMIT || 100) || 100)
);
const pirepReviewPendingWindowMs = Math.max(
  Number(process.env.PIREP_REVIEW_PENDING_WINDOW_MS || 12 * 60 * 60 * 1000) || 12 * 60 * 60 * 1000,
  5 * 60 * 1000
);
const fallbackAdminRoleIds = String(
  process.env.ADMIN_ROLE_IDS ||
    '1397527647675879444,1397529397665333318,1456984642602275053'
)
  .split(/[\s,;]+/)
  .map((value) => value.trim())
  .filter(Boolean);
const ticketCategoryId = String(process.env.TICKET_CATEGORY_ID || '').trim();
const ticketClosedCategoryId = String(process.env.TICKET_CLOSED_CATEGORY_ID || '').trim();
const ticketLogChannelId = String(process.env.TICKET_LOG_CHANNEL_ID || '').trim();
const ticketAllowedCategories = String(
  process.env.TICKET_ALLOWED_CATEGORIES || 'general,operations,website,discord,other'
)
  .split(/[\s,;]+/)
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const ticketAllowedLanguages = String(process.env.TICKET_ALLOWED_LANGUAGES || 'ru,en')
  .split(/[\s,;]+/)
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const TICKET_OPEN_BUTTON_ID = 'ticket:open';
const TICKET_CLOSE_BUTTON_ID = 'ticket:close';
const TICKET_CREATE_MODAL_ID = 'ticket:create';
const TICKET_CLOSE_MODAL_PREFIX = 'ticket:close:';
const BOOKING_VIEW_PREFIX = 'booking:view:';
const BOOKING_CANCEL_PREFIX = 'booking:cancel:';
const BOOKING_MENU_PREFIX = 'booking:menu:';
const BOOKING_ROUTE_SELECT_PREFIX = 'booking:route-select:';
const BOOKING_AIRCRAFT_MENU_PREFIX = 'booking:aircraft-menu:';
const BOOKING_AIRCRAFT_SELECT_PREFIX = 'booking:aircraft-select:';
const BOOKING_CONFIRM_PREFIX = 'booking:confirm:';
const NOTAM_VIEW_PREFIX = 'notam:view:';
const NOTAM_READ_PREFIX = 'notam:read:';
const CLAIM_SUBMIT_BUTTON_PREFIX = 'claims:submit:';
const CLAIM_SUBMIT_MODAL_ID = 'claims:submit';
const PIREP_COMMENT_BUTTON_PREFIX = 'pirep:comment:';
const PIREP_COMMENT_MODAL_PREFIX = 'pirep:comment-modal:';

const TOKEN_URL = String(process.env.VAMSYS_TOKEN_URL || process.env.TOKEN_URL || 'https://vamsys.io/oauth/token').trim();
const OPERATIONS_BASE = String(process.env.VAMSYS_API_BASE || process.env.API_BASE || 'https://vamsys.io/api/v3/operations').trim();
const WEATHER_BASE = 'https://aviationweather.gov/api/data';

let vamsysTokenCache = {
  accessToken: null,
  expiresAt: 0,
};

let ranksCache = {
  map: null,
  expiresAt: 0,
};

let airportsCache = {
  byId: null,
  byCode: null,
  expiresAt: 0,
};

let routesCache = {
  list: null,
  expiresAt: 0,
};

let fleetCatalogCache = {
  list: null,
  expiresAt: 0,
};

let liveFeedMessageId = null;
let liveFeedTimer = null;
let remoteConfigTimer = null;
let syncedAdminRoleIds = [...fallbackAdminRoleIds];
let syncedDiscordBotSettings = null;
let pilotStatusTimer = null;
let pirepReviewTimer = null;
let pirepReviewInitialized = false;
const pirepReviewSeen = new Map();
const pirepReviewActiveFlights = new Map();
const pirepReviewPendingFlights = new Map();
const pirepReviewCommentState = new Map();
let pirepReviewPollInFlight = false;
let notamNotificationTimer = null;
let badgeNotificationTimer = null;

const ACCEPTED_PIREP_STATUSES = new Set(['accepted', 'auto_accepted', 'approved']);
const REJECTED_PIREP_STATUSES = new Set(['rejected', 'denied', 'declined', 'failed', 'cancelled']);
const INVALIDATED_PIREP_STATUSES = new Set(['invalidated', 'invalid', 'void']);

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

const LOCAL_TOURS_CATALOG = [
  {
    id: 'starter-tour',
    title: 'Starter Tour',
    description: 'Complete your first flights and settle into Nordwind operations.',
    targets: { flights: 3, hours: 5 },
  },
  {
    id: 'regional-rotation',
    title: 'Regional Rotation',
    description: 'Build a reliable regional block of flights.',
    targets: { flights: 10, hours: 20 },
  },
  {
    id: 'dispatch-pro',
    title: 'Dispatch Pro',
    description: 'Keep location, claims and operational discipline aligned.',
    targets: { flights: 15, hours: 35, claims: 1, locationSet: true },
  },
];

const LOCAL_BADGES_CATALOG = [
  { id: 'first-flight', title: 'First Flight', description: 'Complete your first accepted flight.', icon: 'FF', color: '#E31E24' },
  { id: 'ten-flights', title: 'Line Regular', description: 'Reach 10 completed flights.', icon: '10', color: '#0F766E' },
  { id: 'hundred-hours', title: 'Century Hours', description: 'Accumulate 100 total hours.', icon: '100', color: '#1D4ED8' },
  { id: 'honorary-rank', title: 'Honorary Rank', description: 'Earn an honorary rank.', icon: 'HR', color: '#7C3AED' },
  { id: 'claim-submitted', title: 'Claim Filed', description: 'Submit your first manual claim.', icon: 'CL', color: '#EA580C' },
  { id: 'location-set', title: 'Positioned', description: 'Set your pilot location.', icon: 'LOC', color: '#059669' },
];

if (!token || !clientId) {
  console.error('Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID in .env');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),
  new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Show bot uptime'),
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Show basic bot info'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available slash commands'),
  new SlashCommandBuilder()
    .setName('vamsys-stats')
    .setDescription('Show vAMSYS summary statistics'),
  new SlashCommandBuilder()
    .setName('vamsys-live')
    .setDescription('Show active flights from vAMSYS')
    .addIntegerOption((opt) =>
      opt
        .setName('limit')
        .setDescription('How many flights to show (1-10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),
  new SlashCommandBuilder()
    .setName('vamsys-recent')
    .setDescription('Show recent completed flights from vAMSYS')
    .addIntegerOption((opt) =>
      opt
        .setName('limit')
        .setDescription('How many flights to show (1-10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(10)
    ),
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show your pilot profile from vAMSYS'),
  new SlashCommandBuilder()
    .setName('booking')
    .setDescription('Show your current booking from vAMSYS'),
  new SlashCommandBuilder()
    .setName('notams')
    .setDescription('Show current operational NOTAMs from vAMSYS'),
  new SlashCommandBuilder()
    .setName('roster')
    .setDescription('Show current Nordwind roster and curated pilots')
    .addIntegerOption((opt) =>
      opt
        .setName('limit')
        .setDescription('How many pilots to show (1-15)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(15)
    ),
  new SlashCommandBuilder()
    .setName('tours')
    .setDescription('Show your current Nordwind tours progress'),
  new SlashCommandBuilder()
    .setName('claims')
    .setDescription('View claims and submit a manual claim'),
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View or update your Discord notification settings')
    .addStringOption((opt) =>
      opt
        .setName('scope')
        .setDescription('What you want to update')
        .setRequired(false)
        .addChoices(
          { name: 'Channel', value: 'channel' },
          { name: 'Type', value: 'type' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('key')
        .setDescription('Setting key, e.g. discord, notam, badge')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('enabled')
        .setDescription('Enable or disable the selected setting')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('location')
    .setDescription('View or update your pilot location')
    .addStringOption((opt) =>
      opt
        .setName('icao')
        .setDescription('Set a new ICAO or use CLEAR to reset')
        .setRequired(false)
        .setMaxLength(5)
    ),
  new SlashCommandBuilder()
    .setName('badges')
    .setDescription('Show your earned pilot badges'),
  new SlashCommandBuilder()
    .setName('airport')
    .setDescription('Show airport details from vAMSYS by ICAO')
    .addStringOption((opt) =>
      opt
        .setName('icao')
        .setDescription('Airport ICAO (e.g. UUEE)')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(4)
    ),
  new SlashCommandBuilder()
    .setName('routes')
    .setDescription('Show available routes from an ICAO airport')
    .addStringOption((opt) =>
      opt
        .setName('icao')
        .setDescription('Departure ICAO (e.g. LTAI)')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(4)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('limit')
        .setDescription('How many routes to show (1-25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ),
  new SlashCommandBuilder()
    .setName('metar')
    .setDescription('Get METAR by ICAO')
    .addStringOption((opt) =>
      opt
        .setName('icao')
        .setDescription('Airport ICAO (e.g. UUEE)')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(4)
    ),
  new SlashCommandBuilder()
    .setName('taf')
    .setDescription('Get TAF by ICAO')
    .addStringOption((opt) =>
      opt
        .setName('icao')
        .setDescription('Airport ICAO (e.g. UUEE)')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(4)
    ),
  new SlashCommandBuilder()
    .setName('news-create')
    .setDescription('Create and publish a news post using a modal form')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target channel for news post')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread
        )
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('alert-create')
    .setDescription('Create and publish an operational alert')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target channel for alert')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread
        )
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('notam-create')
    .setDescription('Create and publish a NOTAM (Notice to Airmen)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName('priority')
        .setDescription('NOTAM priority level')
        .addChoices(
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' }
        )
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target channel for NOTAM')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread
        )
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Post a ticket panel with modal-based ticket creation')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target channel for the ticket panel')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement
        )
        .setRequired(false)
    ),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    console.log(`Slash commands registered for guild ${guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Slash commands registered globally');
  }
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
}

function hasVamsysCredentials() {
  return Boolean(vamsysClientId && vamsysClientSecret);
}

function hasPilotApiSupport() {
  return Boolean(pilotApiClientId);
}

function normalizeMatchValue(value) {
  return String(value || '').trim().toUpperCase();
}

function toTitleCaseWords(value) {
  return String(value || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase())
    .join(' ');
}

function truncateText(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function safeJsonParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function loadBotAuthStore() {
  try {
    if (!fs.existsSync(authStoreFile)) {
      return null;
    }
    return safeJsonParse(fs.readFileSync(authStoreFile, 'utf8'), null);
  } catch {
    return null;
  }
}

function saveBotAuthStore(store) {
  const dirPath = path.dirname(authStoreFile);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(authStoreFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function getPilotStoreKeys(candidate = {}) {
  return Array.from(
    new Set(
      [candidate?.id, candidate?.username, candidate?.email]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function ensureStoreSection(store, key) {
  if (!store[key] || typeof store[key] !== 'object') {
    store[key] = {};
  }
  return store[key];
}

function getSharedStoreEntry(store, sectionName, candidate = {}) {
  const section = ensureStoreSection(store, sectionName);
  for (const key of getPilotStoreKeys(candidate)) {
    if (section[key] !== undefined) {
      return { key, value: section[key], section };
    }
  }
  return { key: null, value: null, section };
}

function setSharedStoreEntry(store, sectionName, candidate = {}, value) {
  const section = ensureStoreSection(store, sectionName);
  const keys = getPilotStoreKeys(candidate);
  if (keys.length === 0) {
    return null;
  }
  keys.forEach((key) => {
    section[key] = value;
  });
  return keys[0];
}

function cloneNotificationSettings(value = DEFAULT_NOTIFICATION_SETTINGS) {
  return {
    channels: {
      ...DEFAULT_NOTIFICATION_SETTINGS.channels,
      ...(value?.channels && typeof value.channels === 'object' ? value.channels : {}),
    },
    notificationTypes: {
      ...DEFAULT_NOTIFICATION_SETTINGS.notificationTypes,
      ...(value?.notificationTypes && typeof value.notificationTypes === 'object' ? value.notificationTypes : {}),
    },
  };
}

function getPilotPreferences(candidate = {}) {
  const store = loadBotAuthStore() || {};
  const { value } = getSharedStoreEntry(store, 'pilotPreferences', candidate);
  return {
    store,
    preferences: {
      notifications: cloneNotificationSettings(value?.notifications),
      updatedAt: String(value?.updatedAt || '').trim() || null,
    },
  };
}

function setPilotPreferences(candidate = {}, nextNotifications) {
  const store = loadBotAuthStore() || {};
  const normalizedNotifications = cloneNotificationSettings(nextNotifications);
  normalizedNotifications.notificationTypes.review = true;
  const nextValue = {
    notifications: normalizedNotifications,
    updatedAt: new Date().toISOString(),
  };
  setSharedStoreEntry(store, 'pilotPreferences', candidate, nextValue);
  saveBotAuthStore(store);
  return nextValue;
}

function getPilotNotamState(candidate = {}) {
  const store = loadBotAuthStore() || {};
  const { value } = getSharedStoreEntry(store, 'pilotNotamReads', candidate);
  const entries = Array.isArray(value?.entries) ? value.entries : [];
  return {
    store,
    state: {
      entries: entries
        .map((item) => ({
          notamId: Number(item?.notamId || 0) || 0,
          readAt: String(item?.readAt || '').trim() || null,
          notifiedAt: String(item?.notifiedAt || '').trim() || null,
          dmMessageId: String(item?.dmMessageId || '').trim() || null,
        }))
        .filter((item) => item.notamId > 0),
      updatedAt: String(value?.updatedAt || '').trim() || null,
    },
  };
}

function hasPilotReadNotam(candidate = {}, notamId) {
  const normalizedId = Number(notamId || 0) || 0;
  if (normalizedId <= 0) {
    return false;
  }
  const { state } = getPilotNotamState(candidate);
  return state.entries.some((item) => item.notamId === normalizedId && item.readAt);
}

function updatePilotNotamState(candidate = {}, notamId, patch = {}) {
  const normalizedId = Number(notamId || 0) || 0;
  const { store, state } = getPilotNotamState(candidate);
  if (normalizedId <= 0) {
    return state;
  }
  const nextEntries = [...state.entries];
  const index = nextEntries.findIndex((item) => item.notamId === normalizedId);
  const existing = index >= 0 ? nextEntries[index] : { notamId: normalizedId, readAt: null, notifiedAt: null, dmMessageId: null };
  const updated = { ...existing, ...patch, notamId: normalizedId };
  if (index >= 0) {
    nextEntries[index] = updated;
  } else {
    nextEntries.push(updated);
  }
  const nextValue = {
    entries: nextEntries,
    updatedAt: new Date().toISOString(),
  };
  setSharedStoreEntry(store, 'pilotNotamReads', candidate, nextValue);
  saveBotAuthStore(store);
  return nextValue;
}

function getPilotBadgeAwards(candidate = {}) {
  const store = loadBotAuthStore() || {};
  const { value } = getSharedStoreEntry(store, 'pilotBadgeAwards', candidate);
  return Array.isArray(value) ? value : [];
}

function setPilotBadgeAwards(candidate = {}, awards = []) {
  const store = loadBotAuthStore() || {};
  setSharedStoreEntry(store, 'pilotBadgeAwards', candidate, Array.isArray(awards) ? awards : []);
  saveBotAuthStore(store);
  return Array.isArray(awards) ? awards : [];
}

function rememberDiscordBinding(candidate = {}, discordUserId = '') {
  const entry = findStoredVamsysLinkEntry(candidate);
  if (!entry?.store || !entry?.linkKey) {
    return;
  }
  const nextStore = entry.store;
  const currentLink = nextStore.vamsysLinks?.[entry.linkKey] || entry.link || {};
  nextStore.vamsysLinks = nextStore.vamsysLinks && typeof nextStore.vamsysLinks === 'object'
    ? nextStore.vamsysLinks
    : {};
  nextStore.vamsysLinks[entry.linkKey] = {
    ...currentLink,
    metadata: {
      ...(currentLink?.metadata && typeof currentLink.metadata === 'object' ? currentLink.metadata : {}),
      discordUserId: String(discordUserId || '').trim() || null,
    },
  };
  saveBotAuthStore(nextStore);
}

function getKnownDiscordBindings() {
  const store = loadBotAuthStore() || {};
  const vamsysLinks = store?.vamsysLinks && typeof store.vamsysLinks === 'object' ? store.vamsysLinks : {};
  return Object.values(vamsysLinks)
    .map((item) => ({
      id: String(item?.id || '').trim(),
      username: String(item?.username || '').trim(),
      email: String(item?.email || '').trim(),
      discordUserId: String(item?.metadata?.discordUserId || '').trim(),
    }))
    .filter((item) => item.discordUserId && (item.id || item.username || item.email));
}

function findStoredVamsysLinkEntry(candidate = {}) {
  const store = loadBotAuthStore();
  const vamsysLinks = store?.vamsysLinks && typeof store.vamsysLinks === 'object'
    ? store.vamsysLinks
    : null;
  if (!vamsysLinks) {
    return null;
  }

  const candidateId = String(candidate?.id || '').trim();
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
}

function getStoredPilotApiConnection(candidate = {}) {
  const entry = findStoredVamsysLinkEntry(candidate);
  const connection = entry?.link?.metadata?.pilotApi;
  if (!entry || !connection || typeof connection !== 'object') {
    return null;
  }

  return {
    ...entry,
    connection: {
      ...connection,
      expiresAt: Number(connection?.expiresAt || 0) || 0,
      profileSyncedAt: Number(connection?.profileSyncedAt || 0) || 0,
      pilotId: Number(connection?.pilotId || candidate?.id || 0) || 0,
    },
  };
}

function persistPilotApiConnection(entry, connection, sessionUser = {}) {
  if (!entry?.store || !entry?.linkKey || !entry?.link) {
    return;
  }

  const nextStore = entry.store;
  const currentLink = nextStore.vamsysLinks?.[entry.linkKey] || entry.link;
  nextStore.vamsysLinks = nextStore.vamsysLinks && typeof nextStore.vamsysLinks === 'object'
    ? nextStore.vamsysLinks
    : {};
  nextStore.vamsysLinks[entry.linkKey] = {
    ...currentLink,
    username: String(sessionUser?.username || currentLink?.username || '').trim(),
    name: String(sessionUser?.name || currentLink?.name || '').trim(),
    email: String(sessionUser?.email || currentLink?.email || '').trim(),
    metadata: {
      ...(currentLink?.metadata && typeof currentLink.metadata === 'object' ? currentLink.metadata : {}),
      pilotApi: {
        ...connection,
        updatedAt: new Date().toISOString(),
      },
    },
  };
  saveBotAuthStore(nextStore);
}

async function exchangePilotApiToken(body) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const responseText = await response.text().catch(() => '');
  const payload = safeJsonParse(responseText, {});
  if (!response.ok) {
    const message =
      String(payload?.error_description || payload?.error || responseText || '').trim() ||
      `Pilot API token exchange failed (${response.status})`;
    throw new Error(message);
  }

  return payload || {};
}

async function executePilotApiRequest({ candidate, path: requestPath, method = 'GET', body } = {}) {
  const stored = getStoredPilotApiConnection(candidate);
  if (!stored?.connection?.accessToken && !stored?.connection?.refreshToken) {
    throw new Error('Pilot API connection is not available. Connect it on the website first.');
  }

  let connection = stored.connection;
  const performRequest = async (accessToken) => {
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(`${pilotApiBase}${requestPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  const refreshConnection = async () => {
    if (!hasPilotApiSupport() || !connection?.refreshToken) {
      throw new Error('Pilot API connection expired and cannot be refreshed automatically.');
    }

    const tokenPayload = await exchangePilotApiToken(
      new URLSearchParams({
        client_id: pilotApiClientId,
        grant_type: 'refresh_token',
        refresh_token: String(connection.refreshToken || '').trim(),
      })
    );

    connection = {
      ...connection,
      accessToken: String(tokenPayload?.access_token || '').trim(),
      refreshToken: String(tokenPayload?.refresh_token || connection.refreshToken || '').trim(),
      expiresAt: Date.now() + Math.max(Number(tokenPayload?.expires_in || 3600) || 3600, 60) * 1000,
      scope: String(tokenPayload?.scope || connection?.scope || '').trim(),
    };
    persistPilotApiConnection(stored, connection, candidate);
  };

  if (!connection?.accessToken || Date.now() >= (Number(connection?.expiresAt || 0) || 0) - 60_000) {
    await refreshConnection();
  }

  let response = await performRequest(connection.accessToken);
  if (response.status === 401 && connection?.refreshToken) {
    await refreshConnection();
    response = await performRequest(connection.accessToken);
  }

  const responseText = await response.text().catch(() => '');
  const payload = safeJsonParse(responseText, null);

  if (!response.ok) {
    const firstError = Array.isArray(payload?.errors) ? payload.errors[0] : null;
    const message =
      String(
        payload?.message ||
          payload?.error?.message ||
          firstError?.detail ||
          payload?.detail ||
          responseText ||
          ''
      ).trim() || `Pilot API request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function getPilotApiCollectionItems(payload) {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
}

function inferBookingStatus(booking = {}) {
  const rawStatus = String(booking?.status || '').trim().toLowerCase();
  if (rawStatus) {
    return rawStatus;
  }
  if (booking?.deleted_at) {
    return 'cancelled';
  }
  if (Number(booking?.pirep_id || 0) > 0) {
    return 'completed';
  }
  return 'booked';
}

function formatBookingStatusLabel(status) {
  return toTitleCaseWords(String(status || '').trim() || 'booked');
}

function hasActiveBookingStatus(status) {
  return !['completed', 'cancelled', 'rejected'].includes(String(status || '').trim().toLowerCase());
}

function resolveActiveBooking(bookings = []) {
  return (Array.isArray(bookings) ? bookings : []).find((item) => hasActiveBookingStatus(item?.status)) || null;
}

function normalizeOperationsBooking(booking = {}) {
  const flightNumber =
    String(booking?.flight_number || booking?.callsign || booking?.flightNumber || '').trim() ||
    `Booking ${booking?.id || '—'}`;
  const callsign =
    String(booking?.callsign || booking?.flight_number || booking?.flightNumber || '').trim() ||
    flightNumber;
  const departureCode =
    String(
      booking?.departure_airport?.icao ||
        booking?.departure_airport?.iata ||
        booking?.departure_id ||
        booking?.departure_airport_id ||
        '—'
    ).trim() || '—';
  const arrivalCode =
    String(
      booking?.arrival_airport?.icao ||
        booking?.arrival_airport?.iata ||
        booking?.arrival_id ||
        booking?.arrival_airport_id ||
        '—'
    ).trim() || '—';
  const status = inferBookingStatus(booking);

  return {
    id: Number(booking?.id || 0) || 0,
    routeId: Number(booking?.route_id || 0) || null,
    aircraftId: Number(booking?.aircraft_id || 0) || null,
    source: 'bookings',
    flightNumber,
    callsign,
    departure: departureCode,
    destination: arrivalCode,
    status,
    statusLabel: formatBookingStatusLabel(status),
    aircraft: String(
      booking?.aircraft?.name || booking?.aircraft?.type || booking?.aircraft_id || '—'
    ).trim() || '—',
    network: String(booking?.network || '').trim(),
    userRoute: String(booking?.user_route || '').trim() || null,
    date: booking?.departure_time || booking?.departureTime || booking?.created_at || null,
    createdAt: booking?.created_at || null,
    routeLabel: `${departureCode} → ${arrivalCode}`,
    departureAirport: booking?.departure_airport || null,
    departureAirportId: booking?.departure_id || booking?.departure_airport_id || null,
    canCancel:
      !booking?.deleted_at &&
      !(Number(booking?.pirep_id || 0) > 0) &&
      !['completed', 'cancelled', 'rejected'].includes(status),
  };
}

async function getBookingsForPilot(pilot, { limit = 20 } = {}) {
  const pilotId = Number(pilot?.id || 0) || 0;
  if (pilotId <= 0) {
    return [];
  }

  const payload = await vamsysFetch(
    `/bookings?page[size]=${Math.max(1, Math.min(50, limit))}&filter[pilot_id]=${encodeURIComponent(
      String(pilotId)
    )}&sort=departure_time`
  );

  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items.map((item) => normalizeOperationsBooking(item));
}

async function getBookingCollectionForPilot(pilot, { limit = 20 } = {}) {
  const bookings = await getBookingsForPilot(pilot, { limit }).catch(() => []);
  if (bookings.length > 0) {
    return bookings;
  }

  const currentBooking = await getCurrentBookingForPilot(pilot).catch(() => null);
  return currentBooking ? [currentBooking] : [];
}

function resolvePrimaryBookingIndex(bookings = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) {
    return -1;
  }

  const activeIndex = bookings.findIndex(
    (item) => !['completed', 'cancelled', 'rejected'].includes(String(item?.status || '').toLowerCase())
  );
  return activeIndex >= 0 ? activeIndex : 0;
}

function normalizeVamsysNotamType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['warning', 'critical'].includes(normalized)) {
    return normalized;
  }
  return normalized === 'operational' ? 'warning' : 'info';
}

function normalizeVamsysNotamPriority(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['high', 'medium', 'low'].includes(normalized)) {
    return normalized;
  }
  return 'low';
}

async function loadCurrentNotams({ limit = 25 } = {}) {
  const payload = await vamsysFetchAllPages('/notams?page[size]=50');
  return (Array.isArray(payload) ? payload : [])
    .map((notam) => ({
      id: Number(notam?.id || 0) || 0,
      title: String(notam?.title || 'Untitled NOTAM').trim() || 'Untitled NOTAM',
      content: String(notam?.content || '').trim(),
      type: normalizeVamsysNotamType(notam?.type),
      priority: normalizeVamsysNotamPriority(notam?.priority),
      mustRead: Boolean(notam?.must_read),
      tag: String(notam?.tag || '').trim() || null,
      url: String(notam?.url || '').trim() || null,
      createdAt: String(notam?.created_at || '').trim() || null,
      readCount: Number(notam?.read_count || 0) || 0,
    }))
    .sort((left, right) => {
      const leftTime = Date.parse(String(left?.createdAt || ''));
      const rightTime = Date.parse(String(right?.createdAt || ''));
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    })
    .slice(0, limit);
}

function getUnreadNotamsForCandidate(candidate = {}, notams = []) {
  return (Array.isArray(notams) ? notams : []).filter((item) => !hasPilotReadNotam(candidate, item.id));
}

async function resolveClaimsCountForCandidate(candidate = {}) {
  try {
    const payload = await executePilotApiRequest({
      candidate,
      path: '/claims?page[size]=50',
    });
    return getPilotApiCollectionItems(payload).length;
  } catch {
    return 0;
  }
}

function buildBadgeIconDataUrl({ icon = 'BD', color = '#E31E24' } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="${String(color || '#E31E24').trim() || '#E31E24'}"/><circle cx="48" cy="48" r="34" fill="rgba(255,255,255,0.14)"/><text x="48" y="56" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#FFFFFF">${String(icon || 'BD').trim().slice(0, 4) || 'BD'}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function deriveAutomaticBadges({ profile = {}, claimsCount = 0 } = {}) {
  const flights = Number(profile?.pireps || profile?.flights || 0) || 0;
  const hours = Number(profile?.hours || 0) || 0;
  const honoraryRank = String(profile?.honoraryRank || '').trim();
  const hasLocation = Boolean(String(profile?.airportCode || '').trim());

  return LOCAL_BADGES_CATALOG.filter((badge) => {
    switch (badge.id) {
      case 'first-flight':
        return flights >= 1;
      case 'ten-flights':
        return flights >= 10;
      case 'hundred-hours':
        return hours >= 100;
      case 'honorary-rank':
        return Boolean(honoraryRank);
      case 'claim-submitted':
        return Number(claimsCount || 0) >= 1;
      case 'location-set':
        return hasLocation;
      default:
        return false;
    }
  }).map((badge) => ({
    ...badge,
    iconUrl: buildBadgeIconDataUrl({ icon: badge.icon, color: badge.color }),
  }));
}

function syncPilotBadges(candidate = {}, { profile = {}, claimsCount = 0 } = {}) {
  const existing = getPilotBadgeAwards(candidate);
  const nextAwards = [...existing];
  const newlyAwarded = [];

  deriveAutomaticBadges({ profile, claimsCount }).forEach((badge) => {
    const existingIndex = nextAwards.findIndex((item) => item?.id === badge.id);
    const nextValue = {
      ...badge,
      awardedAt:
        existingIndex >= 0 ? String(nextAwards[existingIndex]?.awardedAt || '').trim() || new Date().toISOString() : new Date().toISOString(),
      source: 'local',
    };
    if (existingIndex >= 0) {
      nextAwards[existingIndex] = {
        ...nextAwards[existingIndex],
        ...nextValue,
      };
    } else {
      nextAwards.push(nextValue);
      newlyAwarded.push(nextValue);
    }
  });

  setPilotBadgeAwards(candidate, nextAwards);
  return {
    badges: nextAwards.sort((left, right) => {
      const leftTime = Date.parse(String(left?.awardedAt || ''));
      const rightTime = Date.parse(String(right?.awardedAt || ''));
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    }),
    newlyAwarded,
  };
}

function computeTourProgress({ profile = {}, claimsCount = 0 } = {}) {
  const flights = Number(profile?.pireps || profile?.flights || 0) || 0;
  const hours = Number(profile?.hours || 0) || 0;
  const hasLocation = Boolean(String(profile?.airportCode || '').trim());

  return LOCAL_TOURS_CATALOG.map((tour) => {
    const targets = tour?.targets || {};
    const parts = [];
    if (Number.isFinite(Number(targets?.flights))) {
      parts.push({ label: 'Flights', current: flights, target: Number(targets.flights) || 0 });
    }
    if (Number.isFinite(Number(targets?.hours))) {
      parts.push({ label: 'Hours', current: hours, target: Number(targets.hours) || 0 });
    }
    if (Number.isFinite(Number(targets?.claims))) {
      parts.push({ label: 'Claims', current: Number(claimsCount || 0) || 0, target: Number(targets.claims) || 0 });
    }
    if (typeof targets?.locationSet === 'boolean') {
      parts.push({ label: 'Location', current: hasLocation ? 1 : 0, target: targets.locationSet ? 1 : 0 });
    }
    const completed = parts.length > 0 && parts.every((item) => item.current >= item.target);
    return {
      ...tour,
      completed,
      parts,
    };
  });
}

function formatNotamType(type) {
  return type === 'critical' ? 'Critical' : type === 'warning' ? 'Warning' : 'Info';
}

function formatNotamPriority(priority) {
  return priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low';
}

function resolveHonoraryRankLabel(pilotDetails = {}, ranksMap = new Map()) {
  const honoraryRankId =
    Number(
      pilotDetails?.honorary_rank_id ||
        pilotDetails?.honoraryRankId ||
        pilotDetails?.honorary_rank?.id ||
        0
    ) || 0;
  const directLabel = String(
    pilotDetails?.honorary_rank?.name || pilotDetails?.honorary_rank?.title || ''
  ).trim();

  if (directLabel) {
    return directLabel;
  }
  if (honoraryRankId > 0) {
    return ranksMap.get(honoraryRankId) || null;
  }
  return null;
}

function buildProfileCardPayload(profile = {}, avatarUrl = '') {
  return {
    name: String(profile?.name || 'Unknown Pilot').trim() || 'Unknown Pilot',
    callsign: String(profile?.callsign || '—').trim() || '—',
    rank: String(profile?.rank || 'Unknown').trim() || 'Unknown',
    honoraryRank: String(profile?.honoraryRank || '').trim(),
    pireps: Number(profile?.pireps || profile?.flights || 0) || 0,
    hours: Number(profile?.hours || 0) || 0,
    airport: String(profile?.airportCode || profile?.airport || '—').trim() || '—',
    joinedAt: formatUtcDate(profile?.createdAt),
    avatarUrl: String(avatarUrl || '').trim(),
    backgroundPath: profileCardBackground,
    logoPath: profileCardLogo,
  };
}

function buildBadgesCardPayload(profile = {}, badges = []) {
  return {
    title: `${String(profile?.name || profile?.callsign || 'Pilot').trim() || 'Pilot'} · Badges`,
    subtitle: `${Number(profile?.pireps || profile?.flights || 0) || 0} flights · ${formatHours(profile?.hours || 0)}`,
    badges: (Array.isArray(badges) ? badges : []).slice(0, 6).map((badge) => ({
      title: String(badge?.title || badge?.id || 'Badge').trim(),
      description: String(badge?.description || '').trim(),
      icon: String(badge?.icon || badge?.title || 'BD').trim().slice(0, 4),
      color: String(badge?.color || '#E31E24').trim() || '#E31E24',
      awardedAt: String(badge?.awardedAt || '').trim(),
    })),
  };
}

function getPythonCommandCandidates() {
  const seen = new Set();
  const candidates = [
    process.env.PYTHON_EXECUTABLE,
    path.resolve(ROOT_DIR, '.venv/Scripts/python.exe'),
    path.resolve(ROOT_DIR, '.venv/bin/python'),
    'python3',
    'python',
  ].filter(Boolean);

  return candidates.filter((candidate) => {
    const key = String(candidate).trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function generateProfileCard(profile = {}, avatarUrl = '') {
  const payload = buildProfileCardPayload(profile, avatarUrl);
  const outputPath = path.join(
    os.tmpdir(),
    `nws-profile-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
  );

  let lastError = null;
  for (const pythonCommand of getPythonCommandCandidates()) {
    try {
      await execFileAsync(
        pythonCommand,
        [profileCardScript, outputPath, JSON.stringify(payload)],
        {
          windowsHide: true,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        }
      );

      if (fs.existsSync(outputPath)) {
        const buffer = await fs.promises.readFile(outputPath);
        await fs.promises.unlink(outputPath).catch(() => null);
        return buffer;
      }
    } catch (error) {
      lastError = error;
    }
  }

  await fs.promises.unlink(outputPath).catch(() => null);
  throw lastError || new Error('Failed to generate profile card');
}

async function generateBadgesCard(profile = {}, badges = []) {
  const payload = buildBadgesCardPayload(profile, badges);
  const outputPath = path.join(
    os.tmpdir(),
    `nws-badges-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
  );

  let lastError = null;
  for (const pythonCommand of getPythonCommandCandidates()) {
    try {
      await execFileAsync(
        pythonCommand,
        [badgesCardScript, outputPath, JSON.stringify(payload)],
        {
          windowsHide: true,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        }
      );

      if (fs.existsSync(outputPath)) {
        const buffer = await fs.promises.readFile(outputPath);
        await fs.promises.unlink(outputPath).catch(() => null);
        return buffer;
      }
    } catch (error) {
      lastError = error;
    }
  }

  await fs.promises.unlink(outputPath).catch(() => null);
  throw lastError || new Error('Failed to generate badges card');
}

function buildProfileFallbackEmbed(profile, discordUser) {
  return new EmbedBuilder()
    .setColor(0xff8a00)
    .setTitle(`Pilot Profile ${profile.callsign}`)
    .setDescription(profile.name)
    .setThumbnail(discordUser.displayAvatarURL({ size: 256, forceStatic: false }))
    .addFields(
      { name: 'Callsign', value: profile.callsign, inline: true },
      { name: '🧑‍✈️ Rank', value: profile.rank, inline: true },
      {
        name: '🏅 Honorary Rank',
        value: String(profile.honoraryRank || '—'),
        inline: true,
      },
      { name: '🧾 PIREPs', value: String(profile.pireps ?? profile.flights ?? 0), inline: true },
      { name: '⏱ Total Hours', value: formatHours(profile.hours), inline: true },
      {
        name: '🛫 Airport',
        value: profile.airportCode
          ? `${profile.airportFlag} ${profile.airport} (${profile.airportCode})`
          : `${profile.airportFlag} ${profile.airport}`,
        inline: true,
      },
      {
        name: '📅 Created At',
        value: formatUtcDate(profile.createdAt),
        inline: true,
      },
      {
        name: 'Discord',
        value: profile.discordLinked
          ? `${discordUser.username} (✅ Linked)`
          : `${discordUser.username} (❌ Not linked)`,
        inline: false,
      }
    )
    .setFooter({ text: `Pilot ID: ${profile.id}` })
    .setTimestamp(new Date());
}

function buildBookingEmbed({ booking = null, index = 0, total = 0, hasPilotApiConnection = false, blockedByUnreadNotams = false, unreadNotamsCount = 0, locationLabel = null, availableRoutesCount = 0 } = {}) {
  if (!booking) {
    return new EmbedBuilder()
      .setColor(0x6b7280)
      .setTitle('Current Booking')
      .setDescription('No current booking found.')
      .addFields(
        {
          name: 'Manage bookings',
          value: blockedByUnreadNotams
            ? `You have ${unreadNotamsCount} unread NOTAM${unreadNotamsCount === 1 ? '' : 's'}. Review and mark them as read before creating a new booking.`
            : hasPilotApiConnection
            ? 'Use the Booking Menu button below to choose a route, pick an aircraft and confirm a booking directly in Discord.'
            : 'Connect Pilot API on the website first. After that the booking menu will be available directly in Discord.',
          inline: false,
        },
        {
          name: 'Current location',
          value: String(locationLabel || 'Set your location with /location ICAO').trim(),
          inline: false,
        },
        {
          name: 'Available schedules',
          value: String(availableRoutesCount || 0),
          inline: true,
        }
      )
      .setTimestamp(new Date());
  }

  const vac = detectVac(booking.callsign);
  const route = `${booking.departure || '—'} → ${booking.destination || '—'}`;
  const footerText = total > 1 ? `Booking ${index + 1} of ${total}` : 'Single booking';

  return new EmbedBuilder()
    .setColor(0x1d4ed8)
    .setTitle(`Current Booking ${booking.callsign || ''}`.trim())
    .setDescription(booking.routeLabel || route)
    .addFields(
      { name: 'Callsign', value: String(booking.callsign || '—'), inline: true },
      { name: 'VAC', value: vac, inline: true },
      { name: 'Status', value: String(booking.statusLabel || booking.status || '—'), inline: true },
      { name: 'Route', value: route, inline: true },
      { name: 'Aircraft', value: String(booking.aircraft || '—'), inline: true },
      { name: 'Network', value: String(booking.network || '—'), inline: true },
      { name: 'Time', value: formatUtcDate(booking.date), inline: true },
      { name: 'Current location', value: String(locationLabel || '—'), inline: false },
      { name: 'Available schedules', value: String(availableRoutesCount || 0), inline: true },
      { name: 'Custom Route', value: String(booking.userRoute || '—'), inline: false }
    )
    .setFooter({ text: footerText })
    .setTimestamp(new Date());
}

function buildBookingComponents({ booking = null, userId, canCancel = false, blockedByUnreadNotams = false, hasPilotApiConnection = false } = {}) {
  const row = new ActionRowBuilder();

  if (booking?.id && canCancel) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${BOOKING_CANCEL_PREFIX}${booking.id}:0:${userId}`)
        .setLabel('Delete booking')
        .setStyle(ButtonStyle.Danger)
    );
  }

  if (!booking && hasPilotApiConnection && !blockedByUnreadNotams) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${BOOKING_MENU_PREFIX}${userId}`)
        .setLabel('Open booking menu')
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (!blockedByUnreadNotams || !hasPilotApiConnection) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(hasPilotApiConnection ? 'Open bookings dashboard' : 'Open website')
        .setStyle(ButtonStyle.Link)
        .setURL(pilotBookingsUrl)
    );
  }

  return row.components.length > 0 ? [row] : [];
}

function buildBookingAvailabilityEmbeds({ locationAirport = null, fallbackLocationLabel = null, routes = [] } = {}) {
  const locationCode =
    toAirportCode(locationAirport?.icao) ||
    toAirportCode(locationAirport?.iata) ||
    null;
  const locationLabel = locationAirport
    ? formatAirportCityCode(locationAirport, locationCode)
    : String(fallbackLocationLabel || '').trim() || null;

  if (!locationLabel) {
    return [
      new EmbedBuilder()
        .setColor(0x475569)
        .setTitle('Available Schedules')
        .setDescription('Set your current airport with /location ICAO to see all scheduled routes from that location.')
        .setTimestamp(new Date()),
    ];
  }

  if (!Array.isArray(routes) || routes.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(0x475569)
        .setTitle(`Available Schedules from ${locationCode || 'Current Airport'}`)
        .setDescription(`No scheduled routes were found from ${locationLabel}.`)
        .setTimestamp(new Date()),
    ];
  }

  const lines = routes.map(
    (route, index) =>
      `${index + 1}. **${String(route?.flightNumber || 'Route').trim()}** · ${locationCode || '----'} -> ${String(route?.destinationCode || '----').trim()} · ${String(route?.destinationName || 'Destination').trim()} · ${String(route?.airline || 'Airline').trim()}`
  );

  const embeds = [];
  let currentLines = [];
  let currentLength = 0;
  let startIndex = 0;

  const flushChunk = (endIndexExclusive) => {
    if (currentLines.length === 0) {
      return;
    }
    embeds.push(
      new EmbedBuilder()
        .setColor(0x2563eb)
        .setTitle(`Available Schedules from ${locationCode || 'Current Airport'}`)
        .setDescription(currentLines.join('\n'))
        .setFooter({ text: `Routes ${startIndex + 1}-${endIndexExclusive} of ${lines.length}` })
        .setTimestamp(new Date())
    );
    currentLines = [];
    currentLength = 0;
    startIndex = endIndexExclusive;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLength = currentLength + (currentLines.length > 0 ? 1 : 0) + line.length;
    if (nextLength > 3600 && currentLines.length > 0) {
      flushChunk(index);
    }
    currentLines.push(line);
    currentLength += (currentLines.length > 1 ? 1 : 0) + line.length;
  }

  flushChunk(lines.length);
  return embeds;
}

function getDefaultBookingDepartureTime() {
  const departure = new Date();
  departure.setMinutes(0, 0, 0);
  departure.setHours(departure.getHours() + 1);
  return departure.toISOString();
}

function getCompatibleAircraftForRoute(route = null, fleets = []) {
  const allowedFleetIds = Array.isArray(route?.fleetIds)
    ? route.fleetIds.map((item) => Number(item || 0) || 0).filter((item) => item > 0)
    : [];
  const sourceFleets = allowedFleetIds.length > 0
    ? (Array.isArray(fleets) ? fleets : []).filter((fleet) => allowedFleetIds.includes(Number(fleet?.id || 0) || 0))
    : Array.isArray(fleets)
    ? fleets
    : [];

  return sourceFleets
    .flatMap((fleet) =>
      (Array.isArray(fleet?.aircraft) ? fleet.aircraft : [])
        .filter((aircraft) => aircraft?.id)
        .filter((aircraft) => aircraft?.serviceable !== false)
        .map((aircraft) => ({
          id: Number(aircraft?.id || 0) || 0,
          model: String(aircraft?.model || 'Aircraft').trim() || 'Aircraft',
          registration: String(aircraft?.registration || '').trim(),
          fleetId: Number(fleet?.id || 0) || 0,
          fleetName: String(fleet?.name || fleet?.code || 'Fleet').trim() || 'Fleet',
        }))
    )
    .sort((left, right) => `${left.model} ${left.registration}`.localeCompare(`${right.model} ${right.registration}`));
}

async function loadBookingContext({ pilot, discordUserId } = {}) {
  const [bookings, profile, notams] = await Promise.all([
    getBookingCollectionForPilot(pilot, { limit: 20 }),
    getPilotProfileData(discordUserId).catch(() => null),
    loadCurrentNotams({ limit: 25 }).catch(() => []),
  ]);

  const activeBooking = resolveActiveBooking(bookings);
  const hasPilotApiConnection = Boolean(getStoredPilotApiConnection(pilot));
  const unreadNotams = getUnreadNotamsForCandidate(pilot, notams);
  const locationCode = toAirportCode(profile?.airportCode) || toAirportCode(activeBooking?.departure) || null;
  const { locationAirport, routes } = await getAvailableRoutesFromAirportCode(locationCode || '');
  const locationLabel = locationAirport
    ? formatAirportCityCode(locationAirport, locationCode)
    : profile?.airportCode
    ? `${String(profile?.airport || profile?.airportCode).trim() || profile?.airportCode} (${profile?.airportCode})`
    : null;

  return {
    bookings,
    activeBooking,
    hasPilotApiConnection,
    unreadNotams,
    locationAirport,
    locationLabel,
    routes,
  };
}

function buildBookingRouteMenuEmbed({ locationLabel = null, routes = [], blockedByUnreadNotams = false, unreadNotamsCount = 0, hasPilotApiConnection = false } = {}) {
  const previewLines = routes.slice(0, 8).map((route, index) => {
    return `${index + 1}. ${String(route?.flightNumber || 'Route').trim()} · ${String(route?.destinationCode || '----').trim()} · ${String(route?.destinationName || 'Destination').trim()}`;
  });

  const description = blockedByUnreadNotams
    ? `You still have ${unreadNotamsCount} unread NOTAM${unreadNotamsCount === 1 ? '' : 's'}. Mark them as read before creating a booking.`
    : !hasPilotApiConnection
    ? 'Pilot API is not connected for this pilot. Open the website and connect it first.'
    : !locationLabel
    ? 'Set your current airport with /location ICAO first, then open the booking menu again.'
    : routes.length === 0
    ? `No scheduled routes were found from ${locationLabel}.`
    : 'Choose a route from the select menu below. Then choose a compatible aircraft and confirm the booking.';

  const embed = new EmbedBuilder()
    .setColor(0x2563eb)
    .setTitle('Booking Menu')
    .setDescription(description)
    .addFields(
      { name: 'Current location', value: String(locationLabel || 'Not set'), inline: false },
      { name: 'Available schedules', value: String(routes.length || 0), inline: true }
    )
    .setTimestamp(new Date());

  if (previewLines.length > 0) {
    embed.addFields({ name: 'Route preview', value: fitLinesForEmbedField(previewLines), inline: false });
  }

  if (routes.length > 25) {
    embed.setFooter({ text: `Showing the first 25 routes out of ${routes.length}` });
  }

  return embed;
}

function buildBookingRouteMenuComponents({ routes = [], userId, canOpenMenu = false } = {}) {
  const components = [];

  if (canOpenMenu && routes.length > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${BOOKING_ROUTE_SELECT_PREFIX}${userId}`)
          .setPlaceholder('Choose route')
          .addOptions(
            routes.slice(0, 25).map((route) => ({
              label: truncateText(String(route?.flightNumber || `Route ${route?.id || '—'}`).trim() || 'Route', 100),
              description: truncateText(
                `${String(route?.fromCode || '----').trim()} → ${String(route?.destinationCode || '----').trim()} · ${String(route?.destinationName || 'Destination').trim()}`,
                100
              ),
              value: String(route?.id || 0),
            }))
          )
      )
    );
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Open dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(pilotBookingsUrl)
    )
  );

  return components;
}

function buildBookingAircraftEmbed({ route = null, aircraft = [] } = {}) {
  const previewLines = aircraft.slice(0, 8).map((item, index) => {
    return `${index + 1}. ${item.model}${item.registration ? ` · ${item.registration}` : ''} · ${item.fleetName}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x0f766e)
    .setTitle('Choose Aircraft')
    .setDescription(
      route
        ? `Selected route: **${String(route.flightNumber || 'Route').trim()}** · ${String(route.fromCode || '----').trim()} → ${String(route.destinationCode || '----').trim()}`
        : 'Selected route is no longer available.'
    )
    .addFields(
      { name: 'Route', value: String(route?.routeLabel || '—'), inline: true },
      { name: 'Compatible aircraft', value: String(aircraft.length || 0), inline: true }
    )
    .setTimestamp(new Date());

  if (previewLines.length > 0) {
    embed.addFields({ name: 'Aircraft preview', value: fitLinesForEmbedField(previewLines), inline: false });
  }

  if (aircraft.length > 25) {
    embed.setFooter({ text: `Showing the first 25 aircraft out of ${aircraft.length}` });
  }

  return embed;
}

function buildBookingAircraftComponents({ routeId, aircraft = [], userId } = {}) {
  const components = [];

  if (aircraft.length > 0) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${BOOKING_AIRCRAFT_SELECT_PREFIX}${routeId}:${userId}`)
          .setPlaceholder('Choose aircraft')
          .addOptions(
            aircraft.slice(0, 25).map((item) => ({
              label: truncateText(String(item?.model || 'Aircraft').trim() || 'Aircraft', 100),
              description: truncateText(`${String(item?.registration || 'No reg').trim()} · ${String(item?.fleetName || 'Fleet').trim()}`, 100),
              value: String(item?.id || 0),
            }))
          )
      )
    );
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${BOOKING_MENU_PREFIX}${userId}`)
        .setLabel('Change route')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel('Open dashboard')
        .setStyle(ButtonStyle.Link)
        .setURL(pilotBookingsUrl)
    )
  );

  return components;
}

function buildBookingConfirmEmbed({ route = null, aircraft = null, departureTime = null } = {}) {
  return new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('Confirm Booking')
    .setDescription('Review the booking details below. Press Confirm booking to create it in Pilot API.')
    .addFields(
      { name: 'Route', value: route ? `${String(route.flightNumber || 'Route').trim()} · ${String(route.fromCode || '----').trim()} → ${String(route.destinationCode || '----').trim()}` : '—', inline: false },
      { name: 'Aircraft', value: aircraft ? `${String(aircraft.model || 'Aircraft').trim()}${aircraft.registration ? ` · ${aircraft.registration}` : ''}` : '—', inline: false },
      { name: 'Fleet', value: String(aircraft?.fleetName || '—'), inline: true },
      { name: 'Departure time', value: formatUtcDate(departureTime), inline: true }
    )
    .setFooter({ text: 'Departure time is set automatically to the next full hour.' })
    .setTimestamp(new Date());
}

function buildBookingConfirmComponents({ routeId, aircraftId, userId } = {}) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${BOOKING_CONFIRM_PREFIX}${routeId}:${aircraftId}:${userId}`)
        .setLabel('Confirm booking')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${BOOKING_AIRCRAFT_MENU_PREFIX}${routeId}:${userId}`)
        .setLabel('Change aircraft')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${BOOKING_MENU_PREFIX}${userId}`)
        .setLabel('Change route')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

async function buildBookingMenuPayload({ pilot, discordUserId, userId } = {}) {
  const context = await loadBookingContext({ pilot, discordUserId });
  return {
    embeds: [
      buildBookingRouteMenuEmbed({
        locationLabel: context.locationLabel,
        routes: context.routes,
        blockedByUnreadNotams: context.unreadNotams.length > 0,
        unreadNotamsCount: context.unreadNotams.length,
        hasPilotApiConnection: context.hasPilotApiConnection,
      }),
    ],
    components: buildBookingRouteMenuComponents({
      routes: context.routes,
      userId,
      canOpenMenu: context.hasPilotApiConnection && context.unreadNotams.length === 0 && Boolean(context.locationLabel),
    }),
  };
}

async function buildBookingAircraftPayload({ pilot, discordUserId, userId, routeId } = {}) {
  const context = await loadBookingContext({ pilot, discordUserId });
  const route = (Array.isArray(context.routes) ? context.routes : []).find((item) => Number(item?.id || 0) === Number(routeId || 0)) || null;
  const fleets = await loadFleetCatalog().catch(() => []);
  const aircraft = route ? getCompatibleAircraftForRoute(route, fleets) : [];

  return {
    embeds: [buildBookingAircraftEmbed({ route, aircraft })],
    components: buildBookingAircraftComponents({ routeId: Number(routeId || 0) || 0, aircraft, userId }),
  };
}

async function buildBookingConfirmPayload({ pilot, discordUserId, userId, routeId, aircraftId } = {}) {
  const context = await loadBookingContext({ pilot, discordUserId });
  const route = (Array.isArray(context.routes) ? context.routes : []).find((item) => Number(item?.id || 0) === Number(routeId || 0)) || null;
  const fleets = await loadFleetCatalog().catch(() => []);
  const aircraft = getCompatibleAircraftForRoute(route, fleets).find((item) => Number(item?.id || 0) === Number(aircraftId || 0)) || null;
  const departureTime = getDefaultBookingDepartureTime();

  return {
    embeds: [buildBookingConfirmEmbed({ route, aircraft, departureTime })],
    components: buildBookingConfirmComponents({ routeId: Number(routeId || 0) || 0, aircraftId: Number(aircraftId || 0) || 0, userId }),
  };
}

async function buildBookingReplyPayload({ pilot, discordUserId, userId, selectedIndex = null } = {}) {
  const context = await loadBookingContext({ pilot, discordUserId });
  const booking = context.activeBooking;

  const embeds = [
    buildBookingEmbed({
      booking,
      index: selectedIndex === null || selectedIndex === undefined ? 0 : Number(selectedIndex) || 0,
      total: booking ? 1 : 0,
      hasPilotApiConnection: context.hasPilotApiConnection,
      blockedByUnreadNotams: context.unreadNotams.length > 0,
      unreadNotamsCount: context.unreadNotams.length,
      locationLabel: context.locationLabel,
      availableRoutesCount: context.routes.length,
    }),
    ...buildBookingAvailabilityEmbeds({
      locationAirport: context.locationAirport,
      fallbackLocationLabel: context.locationLabel,
      routes: context.routes,
    }),
  ];

  const payload = {
    embeds,
    components: buildBookingComponents({
      booking,
      userId,
      canCancel: Boolean(context.hasPilotApiConnection && booking?.canCancel),
      blockedByUnreadNotams: context.unreadNotams.length > 0,
      hasPilotApiConnection: context.hasPilotApiConnection,
    }),
  };

  return payload;
}

function buildNotamEmbed({ notam = null, index = 0, total = 0 } = {}) {
  if (!notam) {
    return new EmbedBuilder()
      .setColor(0x6b7280)
      .setTitle('Current NOTAMs')
      .setDescription('No NOTAMs are published right now.')
      .setTimestamp(new Date());
  }

  const color =
    notam.priority === 'high' || notam.type === 'critical'
      ? 0xef4444
      : notam.type === 'warning'
      ? 0xf59e0b
      : 0x0ea5e9;

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(notam.title)
    .setDescription(truncateText(notam.content || 'No description provided.', 3500) || 'No description provided.')
    .addFields(
      { name: 'Type', value: formatNotamType(notam.type), inline: true },
      { name: 'Priority', value: formatNotamPriority(notam.priority), inline: true },
      { name: 'Must Read', value: notam.mustRead ? 'Yes' : 'No', inline: true },
      { name: 'Tag', value: String(notam.tag || '—'), inline: true },
      { name: 'Published', value: formatUtcDate(notam.createdAt), inline: true },
      { name: 'Views', value: String(notam.readCount || 0), inline: true }
    )
    .setFooter({ text: total > 1 ? `NOTAM ${index + 1} of ${total}` : 'Single NOTAM' })
    .setTimestamp(new Date());
}

function buildNotamComponents({ notam = null, index = 0, total = 0, userId } = {}) {
  const row = new ActionRowBuilder();

  if (total > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${NOTAM_VIEW_PREFIX}${Math.max(0, index - 1)}:${userId}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index <= 0),
      new ButtonBuilder()
        .setCustomId(`${NOTAM_VIEW_PREFIX}${Math.min(total - 1, index + 1)}:${userId}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(index >= total - 1)
    );
  }

  if (notam?.url) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Open source')
        .setStyle(ButtonStyle.Link)
        .setURL(notam.url)
    );
  }

  if (notam?.id) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${NOTAM_READ_PREFIX}${notam.id}:${userId}`)
        .setLabel('Mark as read')
        .setStyle(ButtonStyle.Success)
    );
  }

  return row.components.length > 0 ? [row] : [];
}

async function resolvePilotForInteraction(interaction) {
  const pilot = await findPilotByDiscordId(interaction.user.id);
  if (pilot) {
    rememberDiscordBinding(pilot, interaction.user.id);
  }
  return pilot;
}

function buildClaimsEmbed({ claims = [], pilot = null } = {}) {
  const topClaims = Array.isArray(claims) ? claims.slice(0, 5) : [];
  const description =
    topClaims.length === 0
      ? 'No manual claims found yet. Use the button below to submit one.'
      : topClaims
          .map((claim, index) => {
            const route = `${claim?.departure?.code || '—'} → ${claim?.arrival?.code || '—'}`;
            return `${index + 1}. **#${claim?.id || '—'}** · ${route} · ${String(claim?.status || 'pending').toUpperCase()}`;
          })
          .join('\n');

  return new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle(`Manual Claims${pilot?.username ? ` · ${pilot.username}` : ''}`)
    .setDescription(description)
    .setFooter({ text: topClaims.length > 0 ? 'Showing latest 5 claims' : 'Manual claim submission available below' })
    .setTimestamp(new Date());
}

function buildClaimsComponents({ userId } = {}) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CLAIM_SUBMIT_BUTTON_PREFIX}${userId}`)
        .setLabel('Submit manual claim')
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

function buildSettingsEmbed(preferences) {
  const channels = preferences?.notifications?.channels || DEFAULT_NOTIFICATION_SETTINGS.channels;
  const types = preferences?.notifications?.notificationTypes || DEFAULT_NOTIFICATION_SETTINGS.notificationTypes;
  const channelLines = Object.keys(DEFAULT_NOTIFICATION_SETTINGS.channels).map((key) => {
    const label = key === 'discord' ? 'Discord DM' : toTitleCaseWords(key);
    return `${label}: ${channels[key] ? 'On' : 'Off'}`;
  });
  const typeLines = Object.keys(DEFAULT_NOTIFICATION_SETTINGS.notificationTypes).map((key) => {
    const suffix = key === 'review' ? ' (required)' : '';
    return `${toTitleCaseWords(key)}: ${types[key] ? 'On' : 'Off'}${suffix}`;
  });
  return new EmbedBuilder()
    .setColor(0x2563eb)
    .setTitle('Notification Settings')
    .addFields(
      {
        name: 'Channels',
        value: channelLines.join('\n'),
        inline: true,
      },
      {
        name: 'Types',
        value: typeLines.join('\n'),
        inline: true,
      }
    )
    .setFooter({ text: 'Use /settings scope:<channel|type> key:<name> enabled:<true|false> to update. Review stays enabled.' })
    .setTimestamp(new Date());
}

function buildLocationEmbed({ locationCode = null, locationLabel = null } = {}) {
  return new EmbedBuilder()
    .setColor(0x14b8a6)
    .setTitle('Pilot Location')
    .setDescription(locationCode ? `${locationLabel || locationCode}` : 'Location is not set.')
    .setFooter({ text: 'Use /location ICAO to update, or /location ICAO:CLEAR to reset.' })
    .setTimestamp(new Date());
}

function buildRosterEmbed({ pilots = [], curatedPilots = [], limit = 10 } = {}) {
  const topPilots = Array.isArray(pilots) ? pilots.slice(0, limit) : [];
  return new EmbedBuilder()
    .setColor(0xe31e24)
    .setTitle('Nordwind Roster')
    .addFields(
      {
        name: `Roster Snapshot (${topPilots.length}/${Array.isArray(pilots) ? pilots.length : 0})`,
        value:
          topPilots.length > 0
            ? topPilots.map((pilot, index) => `${index + 1}. **${pilot?.username || pilot?.name || 'Pilot'}** · ${pilot?.rank || 'Member'}`).join('\n')
            : 'Roster is empty.',
        inline: false,
      },
      {
        name: `Curated (${Array.isArray(curatedPilots) ? curatedPilots.length : 0})`,
        value:
          Array.isArray(curatedPilots) && curatedPilots.length > 0
            ? curatedPilots.slice(0, 8).map((pilot) => `• ${pilot?.username || pilot?.name || 'Pilot'}`).join('\n')
            : 'No curated pilots configured yet.',
        inline: false,
      }
    )
    .setTimestamp(new Date());
}

function buildToursEmbed({ tours = [] } = {}) {
  return new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('Current Tours')
    .setDescription(
      Array.isArray(tours) && tours.length > 0
        ? tours
            .map((tour) => {
              const status = tour.completed ? 'Completed' : 'In progress';
              const parts = Array.isArray(tour.parts)
                ? tour.parts.map((part) => `${part.label}: ${part.current}/${part.target}`).join(' · ')
                : 'No progress data';
              return `**${tour.title}** — ${status}\n${parts}`;
            })
            .join('\n\n')
        : 'No tours available.'
    )
    .setTimestamp(new Date());
}

function buildBadgesEmbed({ badges = [] } = {}) {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('Pilot Badges')
    .setDescription(
      Array.isArray(badges) && badges.length > 0
        ? badges
            .slice(0, 8)
            .map((badge) => `**${badge.title}** · ${formatUtcDate(badge.awardedAt)}`)
            .join('\n')
        : 'No badges earned yet.'
    )
    .setTimestamp(new Date());
}

function buildBadgeEarnedEmbed(badge) {
  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('Badge Earned')
    .setDescription(`You earned **${badge?.title || 'a new badge'}**.`)
    .addFields({ name: 'Details', value: String(badge?.description || 'No description provided.'), inline: false })
    .setTimestamp(new Date());
}

async function notifyUnreadNotams() {
  if (!client.isReady() || !hasVamsysCredentials()) {
    return;
  }

  const bindings = getKnownDiscordBindings();
  if (bindings.length === 0) {
    return;
  }

  const notams = await loadCurrentNotams({ limit: 25 }).catch(() => []);
  if (!Array.isArray(notams) || notams.length === 0) {
    return;
  }

  for (const binding of bindings) {
    const preferences = getPilotPreferences(binding).preferences;
    if (!preferences.notifications.channels.discord || !preferences.notifications.notificationTypes.notam) {
      continue;
    }

    const unread = getUnreadNotamsForCandidate(binding, notams).filter((item) => {
      const { state } = getPilotNotamState(binding);
      const existing = state.entries.find((entry) => entry.notamId === item.id);
      return !existing?.notifiedAt;
    });

    if (unread.length === 0) {
      continue;
    }

    const user = await client.users.fetch(binding.discordUserId).catch(() => null);
    if (!user) {
      continue;
    }

    for (const notam of unread.slice(0, 3)) {
      const message = await user.send({
        embeds: [buildNotamEmbed({ notam, index: 0, total: 1 })],
      }).catch(() => null);

      updatePilotNotamState(binding, notam.id, {
        notifiedAt: new Date().toISOString(),
        dmMessageId: message?.id || null,
      });

      if (message) {
        setTimeout(() => {
          message.edit({
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`${NOTAM_READ_PREFIX}${notam.id}:${binding.discordUserId}`)
                  .setLabel('Mark as read')
                  .setStyle(ButtonStyle.Success)
              ),
            ],
          }).catch(() => null);
        }, 10_000);
      }
    }
  }
}

async function notifyBadgeAwards() {
  if (!client.isReady() || !hasVamsysCredentials()) {
    return;
  }

  const bindings = getKnownDiscordBindings();
  if (bindings.length === 0) {
    return;
  }

  for (const binding of bindings) {
    const preferences = getPilotPreferences(binding).preferences;
    if (!preferences.notifications.channels.discord || !preferences.notifications.notificationTypes.badge) {
      continue;
    }

    const [profile, claimsCount] = await Promise.all([
      getPilotProfileData(binding.discordUserId).catch(() => null),
      resolveClaimsCountForCandidate(binding),
    ]);
    if (!profile) {
      continue;
    }

    const badgeState = syncPilotBadges(binding, { profile, claimsCount });
    if (!Array.isArray(badgeState.newlyAwarded) || badgeState.newlyAwarded.length === 0) {
      continue;
    }

    const user = await client.users.fetch(binding.discordUserId).catch(() => null);
    if (!user) {
      continue;
    }

    for (const badge of badgeState.newlyAwarded) {
      await user.send({ embeds: [buildBadgeEarnedEmbed(badge)] }).catch(() => null);
    }
  }
}

function extractOwnerIdFromCustomId(customId) {
  const parts = String(customId || '').split(':');
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

async function ensureInteractionOwner(interaction) {
  const ownerId = extractOwnerIdFromCustomId(interaction.customId);
  if (!ownerId || ownerId === interaction.user.id) {
    return true;
  }

  await interaction.reply({
    content: 'This control belongs to another user.',
    ephemeral: true,
  });
  return false;
}

function hasAdminAccess(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }

  const adminRoleIds = getEffectiveAdminRoleIds();
  if (adminRoleIds.length === 0) {
    return false;
  }

  const rolesContainer = interaction.member?.roles;
  if (!rolesContainer) {
    return false;
  }

  if (Array.isArray(rolesContainer)) {
    const rolesSet = new Set(rolesContainer.map((roleId) => String(roleId)));
    return adminRoleIds.some((roleId) => rolesSet.has(roleId));
  }

  const roleCache = rolesContainer.cache;
  if (roleCache && typeof roleCache.has === 'function') {
    return adminRoleIds.some((roleId) => roleCache.has(roleId));
  }

  return false;
}

function getTicketOwnerIdFromChannel(channel) {
  const topic = String(channel?.topic || '');
  const match = topic.match(/ticket_owner:(\d{10,25})/);
  return match ? match[1] : null;
}

function canManageTicket(interaction, channel) {
  if (hasAdminAccess(interaction)) {
    return true;
  }

  const ownerId = getTicketOwnerIdFromChannel(channel);
  return Boolean(ownerId && ownerId === interaction.user.id);
}

function buildTicketChannelName(user, subject) {
  const base = `${user.username || 'pilot'}-${subject || 'ticket'}`
    .toLowerCase()
    .replace(/[^a-z0-9\-\s_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = String(user.id).slice(-4);
  return `ticket-${base || 'support'}-${suffix}`.slice(0, 90);
}

function normalizeTicketCategory(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  if (!normalized) {
    return null;
  }
  return ticketAllowedCategories.includes(normalized) ? normalized : null;
}

function normalizeTicketLanguage(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return null;
  }
  return ticketAllowedLanguages.includes(normalized) ? normalized : null;
}

function parseAffectedAirports(rawValue) {
  return [...new Set(
    String(rawValue || '')
      .split(/[\s,;]+/)
      .map((item) => String(item || '').trim().toUpperCase())
      .filter((item) => /^[A-Z0-9]{4,5}$/.test(item))
  )].slice(0, 12);
}

function readTicketMetadataFromChannel(channel) {
  const topic = String(channel?.topic || '');
  const matchValue = (pattern) => {
    const match = topic.match(pattern);
    return match ? match[1] : null;
  };

  return {
    ownerId: matchValue(/ticket_owner:(\d{10,25})/),
    websiteTicketId: matchValue(/website_ticket_id:([^|]+)/),
    websiteTicketNumber: matchValue(/website_ticket_number:(\d+)/),
  };
}

function buildTicketChannelTopic({
  ownerId,
  subject,
  category,
  language,
  status = 'open',
  createdAt = Date.now(),
  websiteTicketId = null,
  websiteTicketNumber = null,
} = {}) {
  const parts = [
    ownerId ? `ticket_owner:${ownerId}` : null,
    `ticket_status:${status}`,
    `ticket_created:${createdAt}`,
    `ticket_subject:${String(subject || '').slice(0, 100)}`,
    `ticket_category:${String(category || '').slice(0, 40)}`,
    `ticket_lang:${String(language || '').slice(0, 10)}`,
    websiteTicketId ? `website_ticket_id:${websiteTicketId}` : null,
    websiteTicketNumber ? `website_ticket_number:${websiteTicketNumber}` : null,
  ].filter(Boolean);

  return parts.join('|').slice(0, 1024);
}

async function syncWebsiteContent(payload = {}) {
  const botToken = String(process.env.DISCORD_BOT_CONFIG_TOKEN || '').trim();
  if (!botToken) {
    throw new Error('Bot token not configured on server');
  }

  const response = await fetch(`${websiteBaseUrl}/api/discord-bot/sync/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Discord-Bot-Token': botToken,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || 'Failed to sync with website');
  }

  return response.json().catch(() => ({}));
}

function getEffectiveAdminRoleIds() {
  return Array.isArray(syncedAdminRoleIds) && syncedAdminRoleIds.length > 0
    ? syncedAdminRoleIds
    : fallbackAdminRoleIds;
}

function getSyncedDiscordBotSettings() {
  return syncedDiscordBotSettings && typeof syncedDiscordBotSettings === 'object'
    ? syncedDiscordBotSettings
    : null;
}

function getPirepAlertSettings() {
  const remote = getSyncedDiscordBotSettings()?.pirepAlerts;
  return {
    awaitingReview: true,
    reviewStarted: true,
    staffComment: true,
    accepted: true,
    rejected: true,
    invalidated: true,
    pilotDmOnReviewStarted: true,
    pilotDmOnStaffComment: true,
    pilotDmOnAccepted: true,
    pilotDmOnRejected: true,
    pilotDmOnInvalidated: true,
    ...(remote && typeof remote === 'object' ? remote : {}),
  };
}

function getConfiguredPirepReviewChannelId() {
  const remoteChannelId = String(getSyncedDiscordBotSettings()?.channels?.pirepReview || '').trim();
  return remoteChannelId || String(pirepReviewChannelId || '').trim();
}

async function refreshRemoteBotConfig() {
  const botToken = String(process.env.DISCORD_BOT_CONFIG_TOKEN || '').trim();
  if (!botToken) {
    return null;
  }

  const response = await fetch(`${websiteBaseUrl}/api/discord-bot/config`, {
    headers: {
      'X-Discord-Bot-Token': botToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load remote bot config (${response.status})`);
  }

  const payload = await response.json().catch(() => ({}));
  syncedDiscordBotSettings = payload?.botSettings && typeof payload.botSettings === 'object'
    ? payload.botSettings
    : null;
  const configuredAdminRoleIds = Array.isArray(payload?.botSettings?.adminRoleIds)
    ? payload.botSettings.adminRoleIds
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    : [];

  syncedAdminRoleIds = configuredAdminRoleIds.length > 0 ? configuredAdminRoleIds : [...fallbackAdminRoleIds];
  return payload;
}

async function createWebsiteTicketFromDiscord({ interaction, subject, category, language, content, channel }) {
  const botToken = String(process.env.DISCORD_BOT_CONFIG_TOKEN || '').trim();
  if (!botToken) {
    throw new Error('Bot token not configured on server');
  }

  const response = await fetch(`${websiteBaseUrl}/api/discord-bot/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Discord-Bot-Token': botToken,
    },
    body: JSON.stringify({
      subject,
      category,
      language,
      content,
      discordGuildId: interaction.guildId,
      discordChannelId: channel?.id || null,
      actor: {
        discordId: interaction.user.id,
        username: interaction.user.username,
        name: interaction.user.globalName || interaction.user.username,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || 'Failed to create website ticket');
  }

  const payload = await response.json().catch(() => ({}));
  return payload?.ticket || null;
}

async function updateWebsiteTicketStatusFromDiscord(ticketId, status, actorName, reason = '') {
  const botToken = String(process.env.DISCORD_BOT_CONFIG_TOKEN || '').trim();
  if (!botToken || !ticketId) {
    return null;
  }

  const response = await fetch(`${websiteBaseUrl}/api/discord-bot/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Discord-Bot-Token': botToken,
    },
    body: JSON.stringify({
      status,
      actorName,
      reason,
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || 'Failed to update website ticket');
  }

  return response.json().catch(() => ({}));
}

function buildAlertPublishEmbed({ title, summary, content, authorTag }) {
  return new EmbedBuilder()
    .setColor(0xdc2626)
    .setTitle(title)
    .setDescription([summary, content].filter(Boolean).join('\n\n'))
    .setFooter({ text: `Published by ${authorTag}` })
    .setTimestamp(new Date());
}

function buildNotamPublishEmbed({ title, content, priority, affectedAirports, authorTag }) {
  const embed = new EmbedBuilder()
    .setColor(priority === 'high' ? 0xdc2626 : priority === 'medium' ? 0xf59e0b : 0x2563eb)
    .setTitle(`NOTAM: ${title}`)
    .setDescription(content)
    .addFields({ name: 'Priority', value: String(priority || 'medium'), inline: true })
    .setFooter({ text: `Published by ${authorTag}` })
    .setTimestamp(new Date());

  if (Array.isArray(affectedAirports) && affectedAirports.length > 0) {
    embed.addFields({ name: 'Affected Airports', value: affectedAirports.join(', '), inline: false });
  }

  return embed;
}

function getTicketAdminPermissionOverwrites() {
  const adminRoleIds = getEffectiveAdminRoleIds();
  return adminRoleIds.map((roleId) => ({
    id: roleId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
    ],
  }));
}

async function getVamsysAccessToken() {
  const now = Date.now();
  if (vamsysTokenCache.accessToken && now < vamsysTokenCache.expiresAt - 60_000) {
    return vamsysTokenCache.accessToken;
  }

  if (!hasVamsysCredentials()) {
    throw new Error('Missing VAMSYS_CLIENT_ID or VAMSYS_CLIENT_SECRET');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: vamsysClientId,
    client_secret: vamsysClientSecret,
  });
  if (vamsysApiScope) {
    body.set('scope', vamsysApiScope);
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error('Failed to obtain vAMSYS token');
  }

  const data = await response.json();
  const expiresIn = Number(data.expires_in || 0) * 1000;
  vamsysTokenCache = {
    accessToken: data.access_token,
    expiresAt: now + expiresIn,
  };

  return vamsysTokenCache.accessToken;
}

async function vamsysFetch(path) {
  const accessToken = await getVamsysAccessToken();
  const response = await fetch(`${OPERATIONS_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`vAMSYS request failed: ${path}`);
  }

  return response.json();
}

async function vamsysFetchAllPages(path) {
  let url = `${OPERATIONS_BASE}${path}`;
  const results = [];

  while (url) {
    const accessToken = await getVamsysAccessToken();
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`vAMSYS paged request failed: ${url}`);
    }

    const data = await response.json();
    if (Array.isArray(data?.data)) {
      results.push(...data.data);
    }

    const meta = data?.meta || {};
    const nextUrl = meta.next_cursor_url || meta.next_page_url || null;
    if (typeof nextUrl === 'string' && nextUrl.length > 0) {
      url = nextUrl.startsWith('http') ? nextUrl : `${OPERATIONS_BASE}${nextUrl}`;
      continue;
    }

    if (meta.next_cursor) {
      const separator = path.includes('?') ? '&' : '?';
      url = `${OPERATIONS_BASE}${path}${separator}page[cursor]=${encodeURIComponent(
        meta.next_cursor
      )}`;
      continue;
    }

    url = null;
  }

  return results;
}

function normalizeIcao(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
}

async function fetchMetar(icao) {
  const response = await fetch(
    `${WEATHER_BASE}/metar?ids=${encodeURIComponent(icao)}&format=json`
  );
  if (!response.ok) {
    throw new Error('METAR request failed');
  }

  const data = await response.json();
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) {
    return null;
  }

  return {
    raw: item.rawOb || item.raw_text || item.raw || null,
    station: item.icaoId || item.station_id || icao,
    observed: item.obsTime || item.observation_time || null,
  };
}

async function fetchTaf(icao) {
  const response = await fetch(
    `${WEATHER_BASE}/taf?ids=${encodeURIComponent(icao)}&format=json`
  );
  if (!response.ok) {
    throw new Error('TAF request failed');
  }

  const data = await response.json();
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) {
    return null;
  }

  return {
    raw: item.rawTAF || item.raw_text || item.raw || null,
    station: item.icaoId || item.station_id || icao,
    issueTime: item.issueTime || item.issue_time || null,
  };
}

async function loadRanksMap() {
  const now = Date.now();
  if (ranksCache.map && now < ranksCache.expiresAt) {
    return ranksCache.map;
  }

  const ranks = await vamsysFetchAllPages('/ranks?page[size]=200');
  const map = new Map();
  ranks.forEach((rank) => {
    if (!rank?.id) {
      return;
    }
    map.set(rank.id, rank.name || rank.abbreviation || `Rank ${rank.id}`);
  });

  ranksCache = {
    map,
    expiresAt: now + 10 * 60 * 1000,
  };

  return map;
}

async function findPilotByDiscordId(discordId) {
  const payload = await vamsysFetch(
    `/pilots?page[size]=1&filter[discord_id]=${encodeURIComponent(discordId)}`
  );
  const pilot = Array.isArray(payload?.data) ? payload.data[0] : null;
  if (!pilot?.id) {
    return null;
  }
  return pilot;
}

function toAirportCode(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return normalized;
}

function extractCountryCode(airportObject) {
  return (
    airportObject?.country_code ||
    airportObject?.countryCode ||
    airportObject?.country?.code ||
    airportObject?.country?.iso2 ||
    airportObject?.country?.alpha2 ||
    airportObject?.country_iso2 ||
    null
  );
}

async function loadAirportsLookup() {
  const now = Date.now();
  if (airportsCache.byId && airportsCache.byCode && now < airportsCache.expiresAt) {
    return airportsCache;
  }

  const airports = await vamsysFetchAllPages('/airports?page[size]=300');
  const byId = new Map();
  const byCode = new Map();

  airports.forEach((airport) => {
    if (!airport) {
      return;
    }

    if (airport.id !== undefined && airport.id !== null) {
      byId.set(String(airport.id), airport);
    }

    const icao = toAirportCode(airport.icao);
    const iata = toAirportCode(airport.iata);
    if (icao) {
      byCode.set(icao, airport);
    }
    if (iata) {
      byCode.set(iata, airport);
    }
  });

  airportsCache = {
    byId,
    byCode,
    expiresAt: now + 60 * 60 * 1000,
  };

  return airportsCache;
}

function normalizeRouteFlightNumber(route) {
  return (
    route?.callsign ||
    route?.flight_number ||
    route?.flightNumber ||
    route?.number ||
    route?.code ||
    route?.identifier ||
    null
  );
}

function getVacLabelFromFlightNumber(flightNumberValue) {
  const raw = String(flightNumberValue || '').trim().toUpperCase();
  const vac = detectVac(raw);
  if (vac === 'KAR') {
    return 'IKAR Airlines';
  }
  if (vac === 'STW') {
    return 'Southwind Airlines';
  }
  return 'Nordwind Airlines';
}

function getVacCodeFromFlightNumber(flightNumberValue) {
  const raw = String(flightNumberValue || '').trim().toUpperCase();
  return detectVac(raw);
}

function fitLinesForEmbedField(lines, maxLength = 1024) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return '—';
  }

  const accepted = [];
  let total = 0;

  for (const line of lines) {
    const value = String(line || '').trim();
    if (!value) {
      continue;
    }

    const extra = accepted.length > 0 ? 1 : 0;
    if (total + extra + value.length > maxLength) {
      break;
    }

    accepted.push(value);
    total += extra + value.length;
  }

  if (accepted.length === 0) {
    return lines[0] ? String(lines[0]).slice(0, Math.max(1, maxLength - 1)) + '…' : '—';
  }

  if (accepted.length < lines.length) {
    let joined = accepted.join('\n');
    const suffix = `\n…+${lines.length - accepted.length} more`;
    if (joined.length + suffix.length <= maxLength) {
      joined += suffix;
    }
    return joined;
  }

  return accepted.join('\n');
}

function formatAirportCityCode(airport, fallbackCode) {
  const code =
    toAirportCode(airport?.icao) ||
    toAirportCode(airport?.iata) ||
    toAirportCode(fallbackCode) ||
    '—';
  const countryCode = extractCountryCode(airport) || inferCountryCodeFromIcao(code);
  const flag = countryCodeToFlagEmoji(countryCode);
  const city =
    airport?.city ||
    airport?.municipality ||
    airport?.town ||
    airport?.name ||
    code;

  return `${flag} ${city} (${code})`;
}

function getAirportCoordinates(airport = null) {
  const latitude = Number(
    airport?.latitude ?? airport?.lat ?? airport?.position?.latitude ?? airport?.coords?.lat ?? NaN
  );
  const longitude = Number(
    airport?.longitude ?? airport?.lon ?? airport?.lng ?? airport?.position?.longitude ?? airport?.coords?.lon ?? NaN
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function getRouteColorHex(vacCode = 'NWS') {
  if (vacCode === 'KAR') {
    return '#F59E0B';
  }
  if (vacCode === 'STW') {
    return '#0EA5E9';
  }
  return '#E31E24';
}

async function loadRoutesList() {
  const now = Date.now();
  if (routesCache.list && now < routesCache.expiresAt) {
    return routesCache.list;
  }

  const routes = await vamsysFetchAllPages('/routes?page[size]=300');
  routesCache = {
    list: routes,
    expiresAt: now + 10 * 60 * 1000,
  };

  return routes;
}

async function loadFleetCatalog() {
  const now = Date.now();
  if (fleetCatalogCache.list && now < fleetCatalogCache.expiresAt) {
    return fleetCatalogCache.list;
  }

  const fleets = await vamsysFetchAllPages('/fleet?page[size]=100');
  const list = await Promise.all(
    (Array.isArray(fleets) ? fleets : []).map(async (fleet) => {
      if (!fleet?.id) {
        return null;
      }

      const aircraft = await vamsysFetchAllPages(`/fleet/${fleet.id}/aircraft?page[size]=100`).catch(() => []);
      return {
        id: Number(fleet?.id || 0) || 0,
        name: String(fleet?.name || fleet?.code || `Fleet ${fleet?.id || '—'}`).trim(),
        code: String(fleet?.code || '').trim(),
        aircraft: (Array.isArray(aircraft) ? aircraft : []).map((item) => ({
          id: Number(item?.id || 0) || 0,
          model: String(item?.name || fleet?.name || 'Aircraft').trim() || 'Aircraft',
          registration: String(item?.registration || '').trim(),
          serviceable: item?.serviceable ?? item?.is_serviceable ?? item?.available ?? true,
        })),
      };
    })
  );

  const normalized = list.filter(Boolean);
  fleetCatalogCache = {
    list: normalized,
    expiresAt: now + 10 * 60 * 1000,
  };

  return normalized;
}

async function loadRosterSnapshot({ limit = 300 } = {}) {
  const [ranksMap, pilots] = await Promise.all([
    loadRanksMap(),
    vamsysFetchAllPages(`/pilots?page[size]=${Math.max(25, Math.min(300, limit))}`),
  ]);

  return (Array.isArray(pilots) ? pilots : []).map((pilot) => ({
    id: Number(pilot?.id || 0) || 0,
    username: String(pilot?.username || '').trim() || 'Pilot',
    name: String(pilot?.name || '').trim() || 'Pilot',
    rank: String(pilot?.rank || ranksMap.get(Number(pilot?.rank_id || 0) || 0) || 'Member').trim(),
    email: String(pilot?.email || '').trim() || null,
    flights: Number(pilot?.flights || 0) || 0,
    hours: Number(pilot?.hours || 0) || 0,
  }));
}

async function loadClaimsForCandidate(candidate = {}, { limit = 10 } = {}) {
  const payload = await executePilotApiRequest({
    candidate,
    path: `/claims?page[size]=${Math.max(1, Math.min(50, limit))}`,
  });
  return getPilotApiCollectionItems(payload);
}

async function updatePilotLocation(candidate = {}, airportCode = '') {
  const normalizedCode = String(airportCode || '').trim().toUpperCase();
  if (!normalizedCode || normalizedCode === 'CLEAR') {
    await executePilotApiRequest({
      candidate,
      path: '/location',
      method: 'PATCH',
      body: {
        airport_id: null,
      },
    });
    return { airportCode: null, airportName: null, locationLabel: null };
  }

  const lookup = await loadAirportsLookup();
  const airport = lookup.byCode.get(normalizedCode) || null;
  if (!airport?.id) {
    throw new Error(`Airport ${normalizedCode} was not found.`);
  }

  await executePilotApiRequest({
    candidate,
    path: '/location',
    method: 'PATCH',
    body: {
      airport_id: Number(airport.id || 0) || null,
    },
  });

  return {
    airportCode: toAirportCode(airport.icao) || toAirportCode(airport.iata) || normalizedCode,
    airportName: String(airport.name || '').trim() || null,
    locationLabel: `${String(airport.name || '').trim() || normalizedCode} (${toAirportCode(airport.icao) || normalizedCode})`,
  };
}

async function getAvailableRoutesFromAirportCode(airportCode = '') {
  const normalizedCode = normalizeIcao(airportCode);
  if (normalizedCode.length !== 4) {
    return {
      locationAirport: null,
      routes: [],
    };
  }

  const [lookup, routes] = await Promise.all([loadAirportsLookup(), loadRoutesList()]);
  const locationAirport = lookup.byCode.get(normalizedCode) || null;
  if (!locationAirport) {
    return {
      locationAirport: null,
      routes: [],
    };
  }

  const departureId = locationAirport.id !== undefined ? String(locationAirport.id) : null;
  const filtered = (Array.isArray(routes) ? routes : []).filter((route) => {
    const routeDepartureCode = toAirportCode(
      route?.departure_airport?.icao ||
        route?.departure_airport?.iata ||
        route?.departure_icao ||
        route?.from
    );

    if (routeDepartureCode && routeDepartureCode === normalizedCode) {
      return true;
    }

    const routeDepartureId = route?.departure_id ?? route?.departure_airport_id ?? null;
    if (departureId && routeDepartureId !== null && routeDepartureId !== undefined) {
      return String(routeDepartureId) === departureId;
    }

    return false;
  });

  const enriched = filtered.map((route, index) => {
    const flightNumber = normalizeRouteFlightNumber(route) || `Route ${route?.id || index + 1}`;
    const vacCode = getVacCodeFromFlightNumber(flightNumber);
    const arrivalAirport =
      route?.arrival_airport ||
      (route?.arrival_id !== undefined && route?.arrival_id !== null
        ? lookup.byId.get(String(route.arrival_id))
        : null) ||
      null;
    const destinationCode =
      toAirportCode(
        arrivalAirport?.icao ||
          arrivalAirport?.iata ||
          route?.arrival_airport?.icao ||
          route?.arrival_airport?.iata ||
          route?.arrival_icao ||
          route?.to ||
          route?.arrival_id
      ) || '----';
    const destinationName =
      String(arrivalAirport?.name || arrivalAirport?.city || destinationCode).trim() || destinationCode;
    const destinationCoordinates = getAirportCoordinates(arrivalAirport);

    return {
      id: Number(route?.id || 0) || 0,
      flightNumber,
      routeLabel: `${normalizedCode} → ${destinationCode}`,
      vacCode,
      airline: getVacLabelFromFlightNumber(flightNumber),
      fromCode: normalizedCode,
      fromName: String(locationAirport?.name || locationAirport?.city || normalizedCode).trim() || normalizedCode,
      destinationCode,
      destinationName,
      fleetIds: Array.isArray(route?.fleet_ids)
        ? route.fleet_ids.map((item) => Number(item || 0) || 0).filter((item) => item > 0)
        : [],
      latitude: destinationCoordinates?.latitude ?? null,
      longitude: destinationCoordinates?.longitude ?? null,
      color: getRouteColorHex(vacCode),
    };
  });

  return {
    locationAirport,
    routes: enriched,
  };
}

async function resolveAirportContext({ airportObject, airportId, airportCode }) {
  const lookup = await loadAirportsLookup();

  let resolvedAirport = airportObject || null;
  if (!resolvedAirport && airportId !== undefined && airportId !== null) {
    resolvedAirport = lookup.byId.get(String(airportId)) || null;
  }

  const normalizedCode = toAirportCode(
    airportCode || resolvedAirport?.icao || resolvedAirport?.iata || resolvedAirport?.identifier
  );

  if (!resolvedAirport && normalizedCode) {
    resolvedAirport = lookup.byCode.get(normalizedCode) || null;
  }

  const code =
    toAirportCode(resolvedAirport?.icao) ||
    toAirportCode(resolvedAirport?.iata) ||
    toAirportCode(resolvedAirport?.identifier) ||
    normalizedCode;

  const name =
    resolvedAirport?.name ||
    (code ? `${code} Airport` : '—');

  const countryCode = extractCountryCode(resolvedAirport) || inferCountryCodeFromIcao(code) || null;

  return {
    name,
    code,
    countryCode,
    flag: countryCodeToFlagEmoji(countryCode),
  };
}

async function getPilotProfileData(discordId) {
  const pilot = await findPilotByDiscordId(discordId);
  if (!pilot) {
    return null;
  }

  const [ranksMap, pireps, pilotDetailsPayload, currentBooking] = await Promise.all([
    loadRanksMap(),
    vamsysFetchAllPages(
      `/pireps?page[size]=100&filter[pilot_id]=${encodeURIComponent(pilot.id)}&sort=-created_at`
    ),
    vamsysFetch(`/pilots/${encodeURIComponent(pilot.id)}`).catch(() => null),
    getCurrentBookingForPilot(pilot).catch(() => null),
  ]);

  const pilotDetails = pilotDetailsPayload?.data || pilot;
  const accepted = pireps.filter((p) =>
    ['accepted', 'auto_accepted', 'approved'].includes(String(p.status || '').toLowerCase())
  );
  const source = accepted.length > 0 ? accepted : pireps;
  const totalSeconds = source.reduce(
    (sum, p) => sum + (Number(p.flight_length) || 0),
    0
  );

  const statusLower = String(currentBooking?.status || '').toLowerCase();
  const hasActiveBooking =
    Boolean(currentBooking?.departureAirport) &&
    !['completed', 'cancelled', 'rejected'].includes(statusLower);

  const pilotAirportContext = await resolveAirportContext({
    airportObject:
      pilotDetails.current_airport ||
      pilotDetails.location ||
      pilotDetails.currentAirport ||
      pilotDetails.airport ||
      pilotDetails.home_airport ||
      pilotDetails.base_airport ||
      null,
    airportId:
      pilotDetails.current_airport_id ||
      pilotDetails.currentAirportId ||
      pilotDetails.location_id ||
      pilotDetails.airport_id ||
      pilotDetails.airportId ||
      pilotDetails.home_airport_id ||
      pilotDetails.base_airport_id ||
      null,
    airportCode:
      pilotDetails.current_airport_icao ||
      pilotDetails.currentAirportIcao ||
      pilotDetails.airport_icao ||
      pilotDetails.airportIcao ||
      null,
  });

  const airportContext =
    pilotAirportContext?.code
      ? pilotAirportContext
      : hasActiveBooking
      ? await resolveAirportContext({
          airportObject: currentBooking.departureAirport,
          airportId:
            currentBooking.departureAirport?.id ||
            currentBooking.departureAirportId ||
            null,
          airportCode: currentBooking.departure,
        })
      : pilotAirportContext;

  return {
    id: pilot.id,
    name: pilotDetails.name || pilotDetails.username || 'Unknown',
    callsign: pilotDetails.username || '—',
    email: pilotDetails.email || pilot.email || '',
    rank: ranksMap.get(pilotDetails.rank_id || pilot.rank_id) || 'Unknown',
    honoraryRank: resolveHonoraryRankLabel(pilotDetails, ranksMap),
    flights: source.length,
    pireps: source.length,
    hours: Number((totalSeconds / 3600).toFixed(2)),
    airport: airportContext.name,
    airportCode: airportContext.code,
    airportFlag: airportContext.flag,
    createdAt: pilotDetails.created_at || pilotDetails.createdAt || pilot.created_at || null,
    discordLinked: Boolean(pilotDetails.discord_id || pilot.discord_id),
  };
}

function countryCodeToFlagEmoji(countryCode) {
  const value = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) {
    return '🏳️';
  }
  const points = [...value].map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...points);
}

function inferCountryCodeFromIcao(icao) {
  const code = String(icao || '')
    .trim()
    .toUpperCase();

  if (code.length < 2) {
    return null;
  }

  const byPrefix2 = {
    UU: 'RU',
    UL: 'RU',
    UR: 'RU',
    US: 'RU',
    UK: 'UA',
    UM: 'BY',
    UT: 'KZ',
    UB: 'AZ',
    UG: 'GE',
    EV: 'LV',
    EY: 'LT',
    EE: 'EE',
    EF: 'FI',
    EN: 'NO',
    EK: 'DK',
    ES: 'SE',
    ED: 'DE',
    LF: 'FR',
    EG: 'GB',
    LE: 'ES',
    LI: 'IT',
    EP: 'PL',
    LK: 'CZ',
    LH: 'HU',
    LO: 'AT',
    LT: 'TR',
    OM: 'SK',
    LS: 'CH',
    LP: 'PT',
    BI: 'IS',
    KJ: 'JP',
    RJ: 'JP',
    RK: 'KR',
    ZS: 'CN',
    ZB: 'CN',
    ZG: 'CN',
    ZH: 'CN',
    ZL: 'CN',
    ZY: 'CN',
    YP: 'AU',
    YM: 'AU',
    NZ: 'NZ',
    FA: 'ZA',
    HE: 'EG',
    DA: 'DZ',
    DT: 'TN',
    GM: 'MA',
    DR: 'RW',
    HK: 'KE',
    OE: 'AT',
    CY: 'CA',
    SC: 'CL',
    SP: 'PE',
    SB: 'BR',
    SK: 'CO',
    SV: 'VE',
    MU: 'MU',
    FM: 'MG',
    VG: 'VG',
  };

  const prefix2 = code.slice(0, 2);
  if (byPrefix2[prefix2]) {
    return byPrefix2[prefix2];
  }

  const prefix1 = code[0];
  const byPrefix1 = {
    K: 'US',
    C: 'CA',
    U: 'RU',
    E: 'EU',
    R: 'JP',
    Z: 'CN',
    Y: 'AU',
    F: 'ZA',
  };

  return byPrefix1[prefix1] && byPrefix1[prefix1] !== 'EU'
    ? byPrefix1[prefix1]
    : null;
}

async function getRegisteredPilotsCount() {
  try {
    const general = await vamsysFetch('/statistics/general');
    const count = Number(general?.data?.pilots?.current);
    if (Number.isFinite(count) && count >= 0) {
      return count;
    }
  } catch {
    // fallback below
  }

  try {
    const pilots = await vamsysFetch('/pilots?page[size]=1');
    const total = Number(pilots?.meta?.total);
    if (Number.isFinite(total) && total >= 0) {
      return total;
    }
  } catch {
    // ignore
  }

  return 0;
}

async function updateBotPresenceWithPilots() {
  if (!client.isReady()) {
    return;
  }

  let pilotCount = 0;
  if (hasVamsysCredentials()) {
    pilotCount = await getRegisteredPilotsCount();
  }

  client.user.setPresence({
    status: 'online',
    activities: [
      {
        type: ActivityType.Watching,
        name: `Serving for ${pilotCount} pilots | v0.1`,
      },
    ],
  });
}

async function getCurrentBookingForPilot(pilot) {
  const bookingPayload = await vamsysFetch(
    `/bookings?page[size]=1&filter[pilot_id]=${encodeURIComponent(
      pilot.id
    )}&sort=-created_at`
  );
  const booking = Array.isArray(bookingPayload?.data)
    ? bookingPayload.data[0] || null
    : null;
  if (booking) {
    return {
      source: 'bookings',
      callsign:
        booking.callsign || booking.flight_number || booking.flightNumber || `Booking ${booking.id}`,
      departure:
        booking.departure_airport?.icao ||
        booking.departure_airport?.iata ||
        booking.departure_airport_id ||
        '—',
      destination:
        booking.arrival_airport?.icao ||
        booking.arrival_airport?.iata ||
        booking.arrival_airport_id ||
        '—',
      status: booking.status || 'unknown',
      aircraft:
        booking.aircraft?.name || booking.aircraft?.type || booking.aircraft_id || '—',
      userRoute:
        typeof booking.user_route === 'string' && booking.user_route.trim().length > 0
          ? booking.user_route.trim()
          : null,
      date:
        booking.departure_time || booking.departureTime || booking.created_at || null,
      departureAirport: booking.departure_airport || null,
      departureAirportId:
        booking.departure_id ||
        booking.departure_airport_id ||
        null,
    };
  }

  const flightMap = await vamsysFetch('/flight-map');
  const activeItems = Array.isArray(flightMap?.data) ? flightMap.data : [];
  const active = activeItems.find((item) => {
    const itemPilot = item?.pilot || {};
    if (itemPilot.id && String(itemPilot.id) === String(pilot.id)) {
      return true;
    }
    if (itemPilot.username && String(itemPilot.username) === String(pilot.username)) {
      return true;
    }
    return false;
  });

  if (!active) {
    return null;
  }

  const bookingInfo = active.booking || {};
  const dep = active.departureAirport || {};
  const arr = active.arrivalAirport || {};
  const progress = active.progress || {};

  return {
    source: 'flight-map',
    callsign: bookingInfo.callsign || bookingInfo.flightNumber || '—',
    departure: dep.icao || dep.iata || dep.identifier || '—',
    destination: arr.icao || arr.iata || arr.identifier || '—',
    status: progress.currentPhase || progress.phase || 'En Route',
    aircraft: active.aircraft?.name || active.aircraft?.type || '—',
    date: progress.departureTime || progress.std || null,
    departureAirport: dep || null,
    departureAirportId: dep.id || null,
  };
}

function buildLiveFlightsEmbedFromMap(payload) {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const top = items.slice(0, 12);

  const description =
    top.length === 0
      ? 'No active flights right now.'
      : top
          .map((item, idx) => {
            const booking = item.booking || {};
            const dep = item.departureAirport || {};
            const arr = item.arrivalAirport || {};
            const progress = item.progress || {};
            const pilot = item.pilot || {};

            const callsign = booking.callsign || booking.flightNumber || '—';
            const phase = progress.currentPhase || progress.phase || 'En Route';
            const percent = Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  Number(progress.progressPercentage ?? progress.progress ?? 0) || 0
                )
              )
            );
            const progressBar = (() => {
              const steps = 10;
              const filled = Math.round((percent / 100) * steps);
              return `${'█'.repeat(filled)}${'░'.repeat(steps - filled)} ${percent}%`;
            })();
            const vac = detectVac(callsign);
            const pilotDisplay = [String(pilot.name || '').trim(), String(pilot.username || '').trim()]
              .filter(Boolean)
              .join(' ')
              || String(pilot.username || pilot.name || 'Pilot').trim()
              || 'Pilot';
            const fromText = formatAirportCityCode(
              dep,
              dep.icao || dep.iata || dep.identifier || '—'
            );
            const toText = formatAirportCityCode(
              arr,
              arr.icao || arr.iata || arr.identifier || '—'
            );
            const statusBadge = getFlightStatusBadge(phase);
            return [
              `${idx + 1}. **${callsign}**`,
              `👨‍✈️ **Pilot:** ${pilotDisplay} · **Airline:** ${vac}`,
              `${fromText} -> ${toText}`,
              `📶 ${progressBar} · **Status:** ${statusBadge} ${phase}`,
            ].join('\n');
          })
          .join('\n\n');

  return new EmbedBuilder()
    .setColor(0xe31e24)
    .setTitle('Live Flights')
    .setDescription(description)
    .setFooter({ text: `Updated ${new Date().toUTCString()}` })
    .setTimestamp(new Date());
}

async function upsertLiveFlightsFeedMessage() {
  if (!liveFeedChannelId) {
    return;
  }
  if (!client.isReady()) {
    return;
  }
  if (!hasVamsysCredentials()) {
    return;
  }

  try {
    const channel = await client.channels.fetch(liveFeedChannelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const payload = await vamsysFetch('/flight-map');
    const embed = buildLiveFlightsEmbedFromMap(payload);

    if (!liveFeedMessageId) {
      try {
        const recent = await channel.messages.fetch({ limit: 30 });
        const existing = recent.find((message) => {
          if (!message?.author || message.author.id !== client.user.id) {
            return false;
          }

          const firstEmbed = Array.isArray(message.embeds) ? message.embeds[0] : null;
          const title = String(firstEmbed?.title || '').trim().toLowerCase();
          return title === 'live flights';
        });

        if (existing?.id) {
          liveFeedMessageId = existing.id;
        }
      } catch {
        // ignore discovery errors and fall back to send
      }
    }

    if (liveFeedMessageId) {
      try {
        const message = await channel.messages.fetch(liveFeedMessageId);
        await message.edit({ embeds: [embed] });
        return;
      } catch {
        liveFeedMessageId = null;
      }
    }

    const sent = await channel.send({ embeds: [embed] });
    liveFeedMessageId = sent.id;
  } catch (error) {
    console.error('Live feed update failed:', error?.message || error);
  }
}

function detectVac(callsign = '') {
  const raw = String(callsign).toUpperCase();
  if (raw.includes('KAR')) return 'KAR';
  if (raw.includes('STW')) return 'STW';
  return 'NWS';
}

function getFlightStatusBadge(statusValue) {
  const status = String(statusValue || '')
    .trim()
    .toLowerCase();

  if (!status) return '⚪';

  if (
    status.includes('boarding') ||
    status.includes('taxi') ||
    status.includes('pushback') ||
    status.includes('holding')
  ) {
    return '🟡';
  }

  if (
    status.includes('en route') ||
    status.includes('climb') ||
    status.includes('cruise') ||
    status.includes('descent') ||
    status.includes('approach')
  ) {
    return '🟢';
  }

  if (
    status.includes('landed') ||
    status.includes('arrived') ||
    status.includes('completed') ||
    status.includes('cancelled') ||
    status.includes('divert')
  ) {
    return '🔴';
  }

  return '🔵';
}

function formatDuration(secondsValue) {
  const seconds = Number(secondsValue);
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

function formatHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '0.00h';
  return `${n.toFixed(2)}h`;
}

function formatUtcDate(dateValue) {
  if (!dateValue) return '—';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '—';
  return `${new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date)} UTC`;
}

function isPirepReviewStatus(statusValue) {
  const status = normalizePirepStatus(statusValue);
  if (!status) {
    return false;
  }

  return (
    status === 'review' ||
    status === 'in_review' ||
    status === 'under_review' ||
    status === 'pending_review' ||
    status.includes('review')
  );
}

function isPirepReviewStartedStatus(statusValue) {
  const status = normalizePirepStatus(statusValue);
  return status === 'in_review' || status === 'under_review';
}

function resolvePirepStatusAlertEvent(previousStatus, nextStatus) {
  const normalizedPrevious = normalizePirepStatus(previousStatus);
  const normalizedNext = normalizePirepStatus(nextStatus);
  if (!normalizedNext) {
    return null;
  }

  if (isAcceptedPirepStatus(normalizedNext)) {
    return isAcceptedPirepStatus(normalizedPrevious) ? null : 'accepted';
  }

  if (isRejectedPirepStatus(normalizedNext)) {
    return isRejectedPirepStatus(normalizedPrevious) ? null : 'rejected';
  }

  if (isInvalidatedPirepStatus(normalizedNext)) {
    return isInvalidatedPirepStatus(normalizedPrevious) ? null : 'invalidated';
  }

  if (!isPirepReviewStatus(normalizedNext)) {
    return null;
  }

  if (!isPirepReviewStartedStatus(normalizedPrevious) && isPirepReviewStartedStatus(normalizedNext)) {
    return 'reviewStarted';
  }

  if (!normalizedPrevious || isAcceptedPirepStatus(normalizedPrevious) || !isPirepReviewStatus(normalizedPrevious)) {
    return 'awaitingReview';
  }

  return null;
}

function shouldSendPirepStaffAlert(eventKey) {
  const settings = getSyncedDiscordBotSettings();
  if (settings?.notifications?.pirepReview === false) {
    return false;
  }

  const alertSettings = getPirepAlertSettings();
  if (eventKey === 'accepted') {
    return alertSettings.accepted !== false;
  }
  if (eventKey === 'rejected') {
    return alertSettings.rejected !== false;
  }
  if (eventKey === 'invalidated') {
    return alertSettings.invalidated !== false;
  }
  if (eventKey === 'reviewStarted') {
    return alertSettings.reviewStarted !== false;
  }
  if (eventKey === 'staffComment') {
    return alertSettings.staffComment !== false;
  }

  return alertSettings.awaitingReview !== false;
}

function shouldSendPirepPilotDm(eventKey) {
  if (eventKey === 'awaitingReview') {
    return false;
  }

  const alertSettings = getPirepAlertSettings();
  if (eventKey === 'accepted') {
    return alertSettings.pilotDmOnAccepted !== false;
  }
  if (eventKey === 'rejected') {
    return alertSettings.pilotDmOnRejected !== false;
  }
  if (eventKey === 'invalidated') {
    return alertSettings.pilotDmOnInvalidated !== false;
  }
  if (eventKey === 'staffComment') {
    return alertSettings.pilotDmOnStaffComment !== false;
  }

  return alertSettings.pilotDmOnReviewStarted !== false;
}

function normalizePirepStatus(statusValue) {
  return String(statusValue || '').trim().toLowerCase();
}

function isAcceptedPirepStatus(statusValue) {
  return ACCEPTED_PIREP_STATUSES.has(normalizePirepStatus(statusValue));
}

function isRejectedPirepStatus(statusValue) {
  return REJECTED_PIREP_STATUSES.has(normalizePirepStatus(statusValue));
}

function isInvalidatedPirepStatus(statusValue) {
  return INVALIDATED_PIREP_STATUSES.has(normalizePirepStatus(statusValue));
}

function getPilotNotificationTypeForPirepEvent(eventKey) {
  if (eventKey === 'reviewStarted') {
    return 'awaitingReview';
  }
  if (eventKey === 'staffComment') {
    return 'needsReply';
  }
  if (eventKey === 'accepted') {
    return 'accepted';
  }
  if (eventKey === 'rejected') {
    return 'rejected';
  }
  if (eventKey === 'invalidated') {
    return 'invalidated';
  }

  return 'review';
}

function getPirepFiledTimestamp(pirep = {}) {
  const raw =
    pirep?.submitted_at ||
    pirep?.filed_at ||
    pirep?.updated_at ||
    pirep?.created_at ||
    null;
  const timestamp = Date.parse(String(raw || ''));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function normalizePirepRouteCodes(pirep = {}) {
  return {
    departure:
      toAirportCode(
        pirep?.departure_airport?.icao ||
          pirep?.departure_airport?.iata ||
          pirep?.departure_icao ||
          pirep?.departure_id ||
          pirep?.departure_airport_id
      ) || '—',
    arrival:
      toAirportCode(
        pirep?.arrival_airport?.icao ||
          pirep?.arrival_airport?.iata ||
          pirep?.arrival_icao ||
          pirep?.arrival_id ||
          pirep?.arrival_airport_id
      ) || '—',
  };
}

function buildTrackedFlightKey(flight = {}) {
  const pilotId = Number(flight?.pilotId || 0) || 0;
  const pilotUsername = String(flight?.pilotUsername || '').trim().toLowerCase();
  const callsign = String(flight?.callsign || '').trim().toUpperCase();
  const departure = toAirportCode(flight?.departure) || '----';
  const arrival = toAirportCode(flight?.arrival) || '----';
  const pilotKey = pilotId > 0 ? `pilot:${pilotId}` : pilotUsername ? `user:${pilotUsername}` : 'pilot:unknown';
  return `${pilotKey}|${callsign || `${departure}-${arrival}`}`;
}

function normalizeFlightForPirepTracking(item = {}) {
  const booking = item?.booking && typeof item.booking === 'object' ? item.booking : {};
  const pilot = item?.pilot && typeof item.pilot === 'object' ? item.pilot : {};
  const departureAirport = item?.departureAirport && typeof item.departureAirport === 'object' ? item.departureAirport : {};
  const arrivalAirport = item?.arrivalAirport && typeof item.arrivalAirport === 'object' ? item.arrivalAirport : {};
  const progress = item?.progress && typeof item.progress === 'object' ? item.progress : {};
  const departure =
    toAirportCode(departureAirport?.icao || departureAirport?.iata || departureAirport?.identifier || booking?.departure_icao || booking?.departure_id) ||
    '—';
  const arrival =
    toAirportCode(arrivalAirport?.icao || arrivalAirport?.iata || arrivalAirport?.identifier || booking?.arrival_icao || booking?.arrival_id) ||
    '—';
  const callsign =
    String(booking?.callsign || booking?.flightNumber || booking?.flight_number || item?.callsign || '').trim().toUpperCase() ||
    `${departure}-${arrival}`;
  const tracked = {
    callsign,
    departure,
    arrival,
    routeLabel: `${departure} → ${arrival}`,
    pilotId: Number(pilot?.id || booking?.pilot_id || 0) || 0,
    pilotName: String(pilot?.name || pilot?.username || 'Unknown pilot').trim() || 'Unknown pilot',
    pilotUsername: String(pilot?.username || '').trim(),
    pilotEmail: String(pilot?.email || '').trim(),
    aircraft:
      String(item?.aircraft?.registration || item?.aircraft?.name || item?.aircraft?.type || booking?.aircraft?.name || booking?.aircraft?.type || '').trim() ||
      '—',
    startedAt:
      getPirepFiledTimestamp({
        submitted_at: progress?.departureTime || progress?.std || progress?.started_at || item?.updated_at || item?.created_at,
      }) || Date.now(),
    currentPhase: String(progress?.currentPhase || progress?.phase || '').trim() || 'En Route',
  };

  return {
    ...tracked,
    trackingKey: buildTrackedFlightKey(tracked),
  };
}

function shouldAlertForPirepStatus(previousStatus, nextStatus) {
  const normalizedPrevious = normalizePirepStatus(previousStatus);
  const normalizedNext = normalizePirepStatus(nextStatus);
  if (!normalizedNext) {
    return false;
  }
  if (isAcceptedPirepStatus(normalizedNext)) {
    return false;
  }
  return !normalizedPrevious || isAcceptedPirepStatus(normalizedPrevious);
}

function isPotentialPirepMatch(pirep = {}, trackedFlight = {}) {
  const pirepPilotId = Number(pirep?.pilot_id || pirep?.pilot?.id || 0) || 0;
  const trackedPilotId = Number(trackedFlight?.pilotId || 0) || 0;
  if (trackedPilotId > 0 && pirepPilotId > 0 && trackedPilotId !== pirepPilotId) {
    return false;
  }

  const pirepCallsign = String(pirep?.callsign || pirep?.flight_number || '').trim().toUpperCase();
  const trackedCallsign = String(trackedFlight?.callsign || '').trim().toUpperCase();
  if (trackedCallsign && pirepCallsign && trackedCallsign !== pirepCallsign) {
    return false;
  }

  const routeCodes = normalizePirepRouteCodes(pirep);
  if (
    trackedFlight?.departure &&
    trackedFlight?.arrival &&
    routeCodes.departure !== '—' &&
    routeCodes.arrival !== '—' &&
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
}

function findMatchingPirepForTrackedFlight(trackedFlight = {}, pireps = []) {
  const matches = (Array.isArray(pireps) ? pireps : [])
    .filter((item) => item?.id && isPotentialPirepMatch(item, trackedFlight))
    .sort((left, right) => getPirepFiledTimestamp(right) - getPirepFiledTimestamp(left));

  return matches[0] || null;
}

async function loadPirepDetails(pirepId) {
  const normalizedId = Number(pirepId || 0) || 0;
  if (normalizedId <= 0) {
    return null;
  }

  const payload = await vamsysFetch(`/pireps/${normalizedId}`);
  return payload?.data || payload || null;
}

function resolvePirepReviewUrl(pirep) {
  const directUrl =
    pirep?.url ||
    pirep?.pirep_url ||
    pirep?.review_url ||
    pirep?.links?.web ||
    pirep?.links?.self ||
    null;

  if (typeof directUrl === 'string' && directUrl.startsWith('http')) {
    return directUrl;
  }

  if (!pirep?.id || !pirepWebBaseUrl) {
    return null;
  }

  return `${pirepWebBaseUrl}/${pirep.id}`;
}

function extractPirepComments(pirep = {}) {
  const candidates = [
    pirep?.comments,
    pirep?.data?.comments,
    pirep?.attributes?.comments,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => item && typeof item === 'object');
    }
  }

  return [];
}

function getPirepCommentText(comment = {}) {
  return String(comment?.comment || comment?.content || comment?.message || comment?.body || '').trim();
}

function getPirepCommentAuthorName(comment = {}) {
  return String(
    comment?.commenter_name ||
      comment?.commenterName ||
      comment?.author_name ||
      comment?.authorName ||
      comment?.user_name ||
      comment?.username ||
      ''
  )
    .trim();
}

function getPirepCommentSignature(comment = {}) {
  const commentId = Number(
    comment?.id || comment?.comment_id || comment?.commentId || comment?.author_comment_id || 0
  ) || 0;
  const createdAt = String(comment?.created_at || comment?.createdAt || comment?.updated_at || comment?.updatedAt || '').trim();
  const text = getPirepCommentText(comment).slice(0, 120);
  return `${commentId || createdAt || 'comment'}:${text}`;
}

function isStaffPirepComment(comment = {}, pirep = {}, trackedFlight = null) {
  const pilotId = Number(pirep?.pilot_id || pirep?.pilot?.id || trackedFlight?.pilotId || 0) || 0;
  const commenterId = Number(
    comment?.commenter_id || comment?.commenterId || comment?.user_id || comment?.userId || comment?.author_id || comment?.authorId || 0
  ) || 0;

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
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const authorName = getPirepCommentAuthorName(comment).toLowerCase();
  if (!authorName) {
    return true;
  }

  return !pilotNames.has(authorName);
}

function getLatestStaffPirepComment(pirep = {}, trackedFlight = null) {
  const comments = extractPirepComments(pirep)
    .filter((comment) => getPirepCommentText(comment))
    .filter((comment) => isStaffPirepComment(comment, pirep, trackedFlight))
    .sort((left, right) => {
      const rightTime = Date.parse(String(right?.created_at || right?.createdAt || right?.updated_at || right?.updatedAt || '')) || 0;
      const leftTime = Date.parse(String(left?.created_at || left?.createdAt || left?.updated_at || left?.updatedAt || '')) || 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return (Number(right?.id || 0) || 0) - (Number(left?.id || 0) || 0);
    });

  return comments[0] || null;
}

function rememberPirepCommentState(pirep = {}, trackedFlight = null) {
  if (!pirep?.id) {
    return;
  }

  const latestComment = getLatestStaffPirepComment(pirep, trackedFlight);
  pirepReviewCommentState.set(String(pirep.id), {
    signature: latestComment ? getPirepCommentSignature(latestComment) : '',
    updatedAt: String(pirep?.updated_at || pirep?.submitted_at || pirep?.created_at || '').trim() || null,
  });
}

function buildPirepReviewEmbed(pirep, pilotName, departureCode, arrivalCode) {
  const callsign = pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`;
  const route = `${departureCode} → ${arrivalCode}`;
  const aircraft =
    pirep.aircraft?.registration ||
    pirep.aircraft?.name ||
    pirep.aircraft?.icao ||
    pirep.aircraft_id ||
    '—';
  const landingRateValue = Number(pirep.landing_rate ?? pirep.landingRate);
  const landingRate = Number.isFinite(landingRateValue) ? `${landingRateValue} fpm` : '—';
  const scoreValue = Number(pirep.score ?? pirep.points);
  const score = Number.isFinite(scoreValue) ? String(scoreValue) : '—';
  const filedAt = pirep.filed_at || pirep.created_at || pirep.submitted_at || null;
  const filed = formatUtcDate(filedAt);
  const reviewUrl = resolvePirepReviewUrl(pirep);
  const status = toTitleCaseWords(normalizePirepStatus(pirep.status) || 'submitted');

  const embed = new EmbedBuilder()
    .setColor(0xffa000)
    .setTitle('PIREP Review Required')
    .setDescription(`A PIREP from **${pilotName || 'Unknown pilot'}** (${callsign}) requires staff review.`)
    .addFields(
      { name: 'Flight Number', value: String(callsign), inline: true },
      { name: 'Route', value: route, inline: true },
      { name: 'Status', value: status, inline: true },
      { name: 'Aircraft', value: String(aircraft), inline: true },
      { name: 'Landing Rate', value: landingRate, inline: true },
      { name: 'Score', value: score, inline: true },
      { name: 'Filed', value: filed, inline: true }
    )
    .setFooter({ text: `PIREP ID: ${pirep.id}` })
    .setTimestamp(new Date());

  if (reviewUrl) {
    embed.setURL(reviewUrl);
  }

  return embed;
}

function buildPirepReviewPilotEmbed(pirep, pilotName, departureCode, arrivalCode) {
  const embed = buildPirepReviewEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setColor(0xeab308)
    .setTitle('Your PIREP Needs Review')
    .setDescription(
      `Your completed flight PIREP is not in accepted status yet. The operations team needs to review **${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}**.`
    );

  return embed;
}

function buildPirepReviewStartedEmbed(pirep, pilotName, departureCode, arrivalCode) {
  return buildPirepReviewEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setColor(0x2563eb)
    .setTitle('PIREP Review Started')
    .setDescription(`Staff moved **${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}** into active review.`);
}

function buildPirepReviewStartedPilotEmbed(pirep, pilotName, departureCode, arrivalCode) {
  return buildPirepReviewStartedEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setTitle('Your PIREP Is Under Review')
    .setDescription(`The operations team started reviewing **${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}**.`);
}

function buildPirepAcceptedEmbed(pirep, pilotName, departureCode, arrivalCode) {
  return buildPirepReviewEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setColor(0x16a34a)
    .setTitle('PIREP Accepted')
    .setDescription(`**${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}** was accepted.`);
}

function buildPirepAcceptedPilotEmbed(pirep, pilotName, departureCode, arrivalCode) {
  return buildPirepAcceptedEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setTitle('Your PIREP Was Accepted')
    .setDescription(`Your PIREP **${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}** was accepted.`);
}

function buildPirepRejectedEmbed(pirep, pilotName, departureCode, arrivalCode) {
  return buildPirepReviewEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setColor(0xdc2626)
    .setTitle('PIREP Rejected')
    .setDescription(`**${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}** was rejected.`);
}

function buildPirepRejectedPilotEmbed(pirep, pilotName, departureCode, arrivalCode) {
  return buildPirepRejectedEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setTitle('Your PIREP Was Rejected')
    .setDescription(`Your PIREP **${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}** was rejected. Open it to review staff notes.`);
}

function buildPirepInvalidatedEmbed(pirep, pilotName, departureCode, arrivalCode) {
  return buildPirepReviewEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setColor(0xea580c)
    .setTitle('PIREP Invalidated')
    .setDescription(`**${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}** was invalidated.`);
}

function buildPirepInvalidatedPilotEmbed(pirep, pilotName, departureCode, arrivalCode) {
  return buildPirepInvalidatedEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setTitle('Your PIREP Was Invalidated')
    .setDescription(`Your PIREP **${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}** was invalidated. Open it to review the details.`);
}

function buildPirepStaffCommentEmbed(pirep, pilotName, departureCode, arrivalCode, comment = {}) {
  return buildPirepReviewEmbed(pirep, pilotName, departureCode, arrivalCode)
    .setColor(0x7c3aed)
    .setTitle('New Staff Comment On PIREP')
    .setDescription(`A staff comment was added to **${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}**.`)
    .addFields({
      name: getPirepCommentAuthorName(comment) || 'Staff comment',
      value: getPirepCommentText(comment).slice(0, 1024) || 'Comment added',
      inline: false,
    });
}

function buildPirepPilotCommentEmbed(pirep, pilotName, departureCode, arrivalCode, comment = {}) {
  return buildPirepStaffCommentEmbed(pirep, pilotName, departureCode, arrivalCode, comment)
    .setTitle('New Comment On Your PIREP')
    .setDescription(`The operations team left a comment on **${pirep.callsign || pirep.flight_number || `PIREP ${pirep.id}`}**.`);
}

function buildPirepDmComponents(pirep, discordUserId) {
  const reviewUrl = resolvePirepReviewUrl(pirep);
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`${PIREP_COMMENT_BUTTON_PREFIX}${pirep.id}:${discordUserId}`)
      .setLabel('Add comment')
      .setStyle(ButtonStyle.Primary)
  );

  if (reviewUrl) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Open PIREP')
        .setStyle(ButtonStyle.Link)
        .setURL(reviewUrl)
    );
  }

  return [row];
}

function buildPirepCandidateFromPayload(pirep = {}, trackedFlight = null) {
  return {
    id: Number(pirep?.pilot_id || pirep?.pilot?.id || trackedFlight?.pilotId || 0) || 0,
    username:
      String(pirep?.pilot?.username || pirep?.pilot_username || trackedFlight?.pilotUsername || '').trim() ||
      null,
    email:
      String(pirep?.pilot?.email || pirep?.pilot_email || trackedFlight?.pilotEmail || '').trim() || null,
  };
}

async function sendPirepReviewNotifications({ channel, pirep, trackedFlight = null, source = 'recent-feed', eventKey = 'awaitingReview', comment = null } = {}) {
  if (!pirep?.id) {
    return;
  }

  const pilotName =
    pirep?.pilot?.name ||
    pirep?.pilot?.username ||
    pirep?.pilot_name ||
    trackedFlight?.pilotName ||
    'Unknown pilot';
  const routeCodes = normalizePirepRouteCodes(pirep);
  const departureCode = routeCodes.departure !== '—' ? routeCodes.departure : trackedFlight?.departure || '—';
  const arrivalCode = routeCodes.arrival !== '—' ? routeCodes.arrival : trackedFlight?.arrival || '—';
  const monitorSource =
    source === 'flight-end'
      ? 'Detected after the live flight disappeared from the active flights feed.'
      : 'Detected from the recent PIREP submission feed.';
  let staffEmbed = buildPirepReviewEmbed(pirep, pilotName, departureCode, arrivalCode).addFields({
    name: 'Monitor Source',
    value: monitorSource,
    inline: false,
  });
  let pilotEmbed = buildPirepReviewPilotEmbed(pirep, pilotName, departureCode, arrivalCode);
  let staffContent = 'PIREP Review Required';

  if (eventKey === 'accepted') {
    staffEmbed = buildPirepAcceptedEmbed(pirep, pilotName, departureCode, arrivalCode).addFields({
      name: 'Monitor Source',
      value: monitorSource,
      inline: false,
    });
    pilotEmbed = buildPirepAcceptedPilotEmbed(pirep, pilotName, departureCode, arrivalCode);
    staffContent = 'PIREP Accepted';
  } else if (eventKey === 'rejected') {
    staffEmbed = buildPirepRejectedEmbed(pirep, pilotName, departureCode, arrivalCode).addFields({
      name: 'Monitor Source',
      value: monitorSource,
      inline: false,
    });
    pilotEmbed = buildPirepRejectedPilotEmbed(pirep, pilotName, departureCode, arrivalCode);
    staffContent = 'PIREP Rejected';
  } else if (eventKey === 'invalidated') {
    staffEmbed = buildPirepInvalidatedEmbed(pirep, pilotName, departureCode, arrivalCode).addFields({
      name: 'Monitor Source',
      value: monitorSource,
      inline: false,
    });
    pilotEmbed = buildPirepInvalidatedPilotEmbed(pirep, pilotName, departureCode, arrivalCode);
    staffContent = 'PIREP Invalidated';
  } else if (eventKey === 'reviewStarted') {
    staffEmbed = buildPirepReviewStartedEmbed(pirep, pilotName, departureCode, arrivalCode).addFields({
      name: 'Monitor Source',
      value: monitorSource,
      inline: false,
    });
    pilotEmbed = buildPirepReviewStartedPilotEmbed(pirep, pilotName, departureCode, arrivalCode);
    staffContent = 'PIREP Review Started';
  } else if (eventKey === 'staffComment' && comment) {
    staffEmbed = buildPirepStaffCommentEmbed(pirep, pilotName, departureCode, arrivalCode, comment).addFields({
      name: 'Monitor Source',
      value: monitorSource,
      inline: false,
    });
    pilotEmbed = buildPirepPilotCommentEmbed(pirep, pilotName, departureCode, arrivalCode, comment);
    staffContent = 'PIREP Staff Comment';
  }

  if (channel?.isTextBased() && shouldSendPirepStaffAlert(eventKey)) {
    await channel.send({ content: staffContent, embeds: [staffEmbed] });
  }

  const candidate = buildPirepCandidateFromPayload(pirep, trackedFlight);
  const binding = findStoredVamsysLinkEntry(candidate)?.link || candidate;
  const discordUserId = String(findStoredVamsysLinkEntry(candidate)?.link?.metadata?.discordUserId || '').trim();
  if (!discordUserId) {
    return;
  }

  const preferences = getPilotPreferences(binding).preferences;
  const notificationTypeKey = getPilotNotificationTypeForPirepEvent(eventKey);
  if (
    !preferences.notifications.channels.discord ||
    preferences.notifications.notificationTypes[notificationTypeKey] === false
  ) {
    return;
  }

  if (!shouldSendPirepPilotDm(eventKey)) {
    return;
  }

  const user = await client.users.fetch(discordUserId).catch(() => null);
  if (!user) {
    return;
  }

  await user.send({
    embeds: [pilotEmbed],
    components: buildPirepDmComponents(pirep, discordUserId),
  }).catch(() => null);
}

async function notifyPirepReviewStatus() {
  const configuredPirepReviewChannelId = getConfiguredPirepReviewChannelId();
  if (!configuredPirepReviewChannelId) {
    return;
  }
  if (!client.isReady()) {
    return;
  }
  if (!hasVamsysCredentials()) {
    return;
  }
  if (pirepReviewPollInFlight) {
    return;
  }

  pirepReviewPollInFlight = true;

  try {
    const channel = await client.channels.fetch(configuredPirepReviewChannelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const [flightMapPayload, payload] = await Promise.all([
      vamsysFetch('/flight-map'),
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
          channel,
          pirep: detailedPirep,
          trackedFlight,
          source: 'flight-end',
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
        const payloadUpdatedAt = String(pirep?.updated_at || pirep?.submitted_at || pirep?.created_at || '').trim() || null;
        const shouldRefreshComments =
          isPirepReviewStatus(normalizedStatus) &&
          (!previousCommentState || (payloadUpdatedAt && payloadUpdatedAt !== previousCommentState.updatedAt));

        if (!shouldRefreshComments) {
          continue;
        }

        detailedPirep = (await loadPirepDetails(pirep.id).catch(() => null)) || pirep;
        const latestStaffComment = getLatestStaffPirepComment(detailedPirep);
        const nextSignature = latestStaffComment ? getPirepCommentSignature(latestStaffComment) : '';
        if (
          latestStaffComment &&
          previousCommentState &&
          previousCommentState.signature &&
          nextSignature !== previousCommentState.signature
        ) {
          await sendPirepReviewNotifications({
            channel,
            pirep: detailedPirep,
            trackedFlight: null,
            source: 'recent-feed',
            eventKey: 'staffComment',
            comment: latestStaffComment,
          });
        }

        rememberPirepCommentState(detailedPirep);
        continue;
      }

      if (alertEvent) {
        detailedPirep = (await loadPirepDetails(pirep.id).catch(() => null)) || pirep;
        await sendPirepReviewNotifications({
          channel,
          pirep: detailedPirep,
          trackedFlight: null,
          source: 'recent-feed',
          eventKey: alertEvent,
        });
      }

      pirepReviewSeen.set(key, normalizedStatus);
      rememberPirepCommentState(detailedPirep || pirep);
    }
  } catch (error) {
    console.error('PIREP review notifier failed:', error?.message || error);
  } finally {
    pirepReviewPollInFlight = false;
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('clientReady', () => {
  console.log(`Bot is online: ${client.user.tag}`);

  refreshRemoteBotConfig().catch((error) => {
    console.error('Remote bot config sync failed:', error?.message || error);
  });
  if (remoteConfigTimer) {
    clearInterval(remoteConfigTimer);
  }
  remoteConfigTimer = setInterval(() => {
    refreshRemoteBotConfig().catch((error) => {
      console.error('Remote bot config sync failed:', error?.message || error);
    });
  }, 5 * 60 * 1000);

  updateBotPresenceWithPilots().catch((error) => {
    console.error('Presence update failed:', error?.message || error);
  });
  if (pilotStatusTimer) {
    clearInterval(pilotStatusTimer);
  }
  pilotStatusTimer = setInterval(() => {
    updateBotPresenceWithPilots().catch((error) => {
      console.error('Presence update failed:', error?.message || error);
    });
  }, 5 * 60 * 1000);

  upsertLiveFlightsFeedMessage();
  if (liveFeedTimer) {
    clearInterval(liveFeedTimer);
  }
  liveFeedTimer = setInterval(upsertLiveFlightsFeedMessage, liveFeedIntervalMs);

  notifyPirepReviewStatus();
  if (pirepReviewTimer) {
    clearInterval(pirepReviewTimer);
  }
  pirepReviewTimer = setInterval(notifyPirepReviewStatus, pirepReviewIntervalMs);

  notifyUnreadNotams().catch(() => null);
  if (notamNotificationTimer) {
    clearInterval(notamNotificationTimer);
  }
  notamNotificationTimer = setInterval(() => {
    notifyUnreadNotams().catch(() => null);
  }, Math.max(60_000, liveFeedIntervalMs));

  notifyBadgeAwards().catch(() => null);
  if (badgeNotificationTimer) {
    clearInterval(badgeNotificationTimer);
  }
  badgeNotificationTimer = setInterval(() => {
    notifyBadgeAwards().catch(() => null);
  }, 5 * 60 * 1000);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith(PIREP_COMMENT_MODAL_PREFIX)) {
      const ownerId = extractOwnerIdFromCustomId(interaction.customId);
      if (ownerId && ownerId !== interaction.user.id) {
        await interaction.reply({
          content: 'This control belongs to another user.',
          ephemeral: true,
        });
        return;
      }

      const parts = interaction.customId.split(':');
      const pirepId = Number(parts[3] || 0) || 0;
      const content = interaction.fields.getTextInputValue('pirep-comment-content').trim();
      if (pirepId <= 0) {
        await interaction.reply({
          content: 'PIREP ID is missing.',
          ephemeral: true,
        });
        return;
      }
      if (!content) {
        await interaction.reply({
          content: 'Comment content is required.',
          ephemeral: true,
        });
        return;
      }

      try {
        const pilot = await resolvePilotForInteraction(interaction);
        if (!pilot) {
          throw new Error('Pilot profile not found. Link your Discord account in vAMSYS first.');
        }

        await executePilotApiRequest({
          candidate: pilot,
          path: `/pireps/${encodeURIComponent(String(pirepId))}/comments`,
          method: 'POST',
          body: { content },
        });

        await interaction.reply({
          content: `Comment added to PIREP #${pirepId}.`,
          ephemeral: true,
        });
      } catch (error) {
        await interaction.reply({
          content: String(error?.message || 'Failed to add a PIREP comment.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId === CLAIM_SUBMIT_MODAL_ID) {
      const pilot = await resolvePilotForInteraction(interaction).catch(() => null);
      if (!pilot) {
        await interaction.reply({
          content: 'Pilot profile not found. Link your Discord account in vAMSYS first.',
          ephemeral: true,
        });
        return;
      }

      const bookingId = Number(interaction.fields.getTextInputValue('claim-booking-id').trim() || 0) || 0;
      const departureTime = interaction.fields.getTextInputValue('claim-departure-time').trim();
      const arrivalTime = interaction.fields.getTextInputValue('claim-arrival-time').trim();
      const message = interaction.fields.getTextInputValue('claim-message').trim();
      const proofRaw = interaction.fields.getTextInputValue('claim-proof-links').trim();
      const proof = proofRaw
        .split(/\r?\n|,/) 
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 5)
        .map((url) => ({ type: 'link', url }));

      try {
        await executePilotApiRequest({
          candidate: pilot,
          path: '/claims',
          method: 'POST',
          body: {
            booking_id: bookingId,
            departure_time: departureTime,
            arrival_time: arrivalTime,
            message,
            proof,
          },
        });

        await interaction.reply({
          content: 'Manual claim submitted successfully.',
          ephemeral: true,
        });
      } catch (error) {
        await interaction.reply({
          content: String(error?.message || 'Failed to submit manual claim.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId === TICKET_CREATE_MODAL_ID) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: 'Ticket creation is available only inside a server.',
          ephemeral: true,
        });
        return;
      }

      const subject = interaction.fields.getTextInputValue('ticket-subject').trim();
      const rawCategory = interaction.fields.getTextInputValue('ticket-category').trim();
      const rawLanguage = interaction.fields.getTextInputValue('ticket-language').trim();
      const details = interaction.fields.getTextInputValue('ticket-details').trim();
      const guild = interaction.guild;

      const category = normalizeTicketCategory(rawCategory);
      if (!category) {
        await interaction.reply({
          content: `Unknown category. Allowed: ${ticketAllowedCategories.join(', ')}`,
          ephemeral: true,
        });
        return;
      }

      const language = normalizeTicketLanguage(rawLanguage);
      if (!language) {
        await interaction.reply({
          content: `Unknown language. Allowed: ${ticketAllowedLanguages.join(', ')}`,
          ephemeral: true,
        });
        return;
      }

      try {
        const existing = guild.channels.cache.find(
          (channel) =>
            channel.type === ChannelType.GuildText &&
            String(channel.topic || '').includes(`ticket_owner:${interaction.user.id}`) &&
            !String(channel.topic || '').includes('ticket_status:closed')
        );

        if (existing) {
          await interaction.reply({
            content: `You already have an open ticket: <#${existing.id}>`,
            ephemeral: true,
          });
          return;
        }

        const channelName = buildTicketChannelName(
          interaction.user,
          `${category}-${subject}`
        );
        const createdAt = Date.now();
        const created = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: ticketCategoryId || undefined,
          topic: buildTicketChannelTopic({
            ownerId: interaction.user.id,
            subject,
            category,
            language,
            status: 'open',
            createdAt,
          }),
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
            },
            ...getTicketAdminPermissionOverwrites(),
          ],
        });

        let websiteTicket = null;
        let syncWarning = '';
        try {
          websiteTicket = await createWebsiteTicketFromDiscord({
            interaction,
            subject,
            category,
            language,
            content: details,
            channel: created,
          });

          if (websiteTicket?.id) {
            await created.setTopic(
              buildTicketChannelTopic({
                ownerId: interaction.user.id,
                subject,
                category,
                language,
                status: 'open',
                createdAt,
                websiteTicketId: websiteTicket.id,
                websiteTicketNumber: websiteTicket.number,
              })
            ).catch(() => null);
          }
        } catch (error) {
          syncWarning = ` Website sync failed: ${error?.message || 'unknown error'}`;
        }

        const closeButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(TICKET_CLOSE_BUTTON_ID)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
        );

        const ticketEmbed = new EmbedBuilder()
          .setColor(0x2563eb)
          .setTitle(`🎫 Ticket: ${subject}`)
          .setDescription(details || 'No details provided.')
          .addFields(
            { name: 'Pilot', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Category', value: category, inline: true },
            { name: 'Language', value: language.toUpperCase(), inline: true },
            { name: 'Status', value: 'Open', inline: true }
          )
          .setFooter({ text: `User ID: ${interaction.user.id}` })
          .setTimestamp(new Date());

        if (websiteTicket?.number) {
          ticketEmbed.addFields({
            name: 'Website Ticket',
            value: `#${websiteTicket.number}`,
            inline: true,
          });
        }

        await created.send({
          content: `<@${interaction.user.id}> ${getEffectiveAdminRoleIds().map((id) => `<@&${id}>`).join(' ')}`.trim(),
          embeds: [ticketEmbed],
          components: [closeButton],
        });

        if (ticketLogChannelId) {
          const logChannel = await guild.channels.fetch(ticketLogChannelId).catch(() => null);
          if (logChannel?.isTextBased()) {
            await logChannel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0x16a34a)
                  .setTitle('Ticket Created')
                  .setDescription(`<@${interaction.user.id}> created <#${created.id}>`)
                  .setTimestamp(new Date()),
              ],
            });
          }
        }

        await interaction.reply({
          content: `Ticket created: <#${created.id}>.${syncWarning}`.trim(),
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          content: 'Failed to create ticket. Check bot permissions for channels/overwrites.',
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId.startsWith(TICKET_CLOSE_MODAL_PREFIX)) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: 'Ticket close is available only inside a server.',
          ephemeral: true,
        });
        return;
      }

      const targetChannelId = interaction.customId.slice(TICKET_CLOSE_MODAL_PREFIX.length);
      const reason = interaction.fields.getTextInputValue('ticket-close-reason').trim();
      const channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);

      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: 'Ticket channel not found.',
          ephemeral: true,
        });
        return;
      }

      if (!canManageTicket(interaction, channel)) {
        await interaction.reply({
          content: 'You do not have permission to close this ticket.',
          ephemeral: true,
        });
        return;
      }

      const { ownerId, websiteTicketId } = readTicketMetadataFromChannel(channel);
      const closedTopic = String(channel.topic || '')
        .replace('ticket_status:open', 'ticket_status:closed')
        .concat(`|closed_at:${Date.now()}`);

      try {
        if (ticketClosedCategoryId) {
          await channel.setParent(ticketClosedCategoryId).catch(() => null);
        }

        if (ownerId) {
          await channel.permissionOverwrites.edit(ownerId, {
            SendMessages: false,
          });
        }

        if (!channel.name.startsWith('closed-')) {
          await channel.setName(`closed-${channel.name}`.slice(0, 95));
        }

        await channel.setTopic(closedTopic.slice(0, 1024));
        if (websiteTicketId) {
          await updateWebsiteTicketStatusFromDiscord(
            websiteTicketId,
            'closed',
            interaction.user.globalName || interaction.user.username,
            reason
          ).catch(() => null);
        }

        const closedEmbed = new EmbedBuilder()
          .setColor(0x6b7280)
          .setTitle('✅ Ticket Closed')
          .setDescription(reason || 'No reason provided.')
          .addFields({ name: 'Closed by', value: `<@${interaction.user.id}>`, inline: true })
          .setTimestamp(new Date());

        await channel.send({ embeds: [closedEmbed] });

        if (ticketLogChannelId) {
          const logChannel = await interaction.guild.channels.fetch(ticketLogChannelId).catch(() => null);
          if (logChannel?.isTextBased()) {
            await logChannel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(0xef4444)
                  .setTitle('Ticket Closed')
                  .setDescription(`<#${channel.id}> closed by <@${interaction.user.id}>`)
                  .addFields({ name: 'Reason', value: reason || 'No reason provided.' })
                  .setTimestamp(new Date()),
              ],
            });
          }
        }

        await interaction.reply({
          content: `Ticket <#${channel.id}> closed.`,
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          content: 'Failed to close ticket.',
          ephemeral: true,
        });
      }
      return;
    }

    if (!interaction.customId.startsWith('news-create:')) {
      return;
    }

    if (!hasAdminAccess(interaction)) {
      await interaction.reply({
        content: 'You do not have permission to publish news posts.',
        ephemeral: true,
      });
      return;
    }

    const targetChannelId = interaction.customId.split(':')[1] || interaction.channelId;
    const title = interaction.fields.getTextInputValue('news-title').trim();
    const summary = interaction.fields.getTextInputValue('news-summary').trim();
    const body = interaction.fields.getTextInputValue('news-body').trim();
    const imageUrl = interaction.fields.getTextInputValue('news-image').trim();

    try {
      const channel = await interaction.client.channels.fetch(targetChannelId);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({
          content: 'Cannot publish news to this channel.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xe31e24)
        .setTitle(title)
        .setDescription([summary, body].filter(Boolean).join('\n\n'))
        .setFooter({ text: `Published by ${interaction.user.tag}` })
        .setTimestamp(new Date());

      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      await channel.send({ embeds: [embed] });

      // Sync with website
      try {
        await syncWebsiteContent({
          type: 'news',
          title,
          summary,
          content: body || summary,
        });
      } catch {
      }

      await interaction.reply({
        content: `News published to <#${targetChannelId}> and synced to website.`,
        ephemeral: true,
      });
    } catch {
      await interaction.reply({
        content: 'Failed to publish news.',
        ephemeral: true,
      });
    }
    return;
  }

  if (interaction.customId.startsWith('alert-create:')) {
    if (!hasAdminAccess(interaction)) {
      await interaction.reply({
        content: 'You do not have permission to publish alerts.',
        ephemeral: true,
      });
      return;
    }

    const targetChannelId = interaction.customId.split(':')[1] || interaction.channelId;
    const title = interaction.fields.getTextInputValue('alert-title').trim();
    const summary = interaction.fields.getTextInputValue('alert-summary').trim();
    const content = interaction.fields.getTextInputValue('alert-content').trim();

    try {
      const channel = await interaction.client.channels.fetch(targetChannelId);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({
          content: 'Cannot publish alert to this channel.',
          ephemeral: true,
        });
        return;
      }

      await channel.send({
        embeds: [
          buildAlertPublishEmbed({
            title,
            summary,
            content,
            authorTag: interaction.user.tag,
          }),
        ],
      });

      await syncWebsiteContent({
        type: 'alert',
        title,
        summary,
        content,
      });

      await interaction.reply({
        content: `Alert published to <#${targetChannelId}> and synced to website.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `Failed to publish alert: ${error?.message || 'Unknown error'}`,
        ephemeral: true,
      });
    }
    return;
  }

  if (interaction.customId.startsWith('notam-create:')) {
    if (!hasAdminAccess(interaction)) {
      await interaction.reply({
        content: 'You do not have permission to create NOTAMs.',
        ephemeral: true,
      });
      return;
    }

    const [, priority = 'medium', targetChannelId = interaction.channelId] = interaction.customId.split(':');
    const title = interaction.fields.getTextInputValue('notam-title').trim();
    const content = interaction.fields.getTextInputValue('notam-content').trim();
    const affectsRaw = interaction.fields.getTextInputValue('notam-affects').trim();
    const affectedAirports = parseAffectedAirports(affectsRaw);

    try {
      const channel = await interaction.client.channels.fetch(targetChannelId);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({
          content: 'Cannot publish NOTAM to this channel.',
          ephemeral: true,
        });
        return;
      }

      await channel.send({
        embeds: [
          buildNotamPublishEmbed({
            title,
            content,
            priority,
            affectedAirports,
            authorTag: interaction.user.tag,
          }),
        ],
      });

      await syncWebsiteContent({
        type: 'notam',
        notamPriority: priority,
        title,
        summary: content.slice(0, 180),
        content,
        affectedAirports,
      });

      await interaction.reply({
        content: `NOTAM published to <#${targetChannelId}> and synced to website.`,
        ephemeral: true,
      });
    } catch (error) {
      await interaction.reply({
        content: `Failed to publish NOTAM: ${error?.message || 'Unknown error'}`,
        ephemeral: true,
      });
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId.startsWith(BOOKING_ROUTE_SELECT_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const routeId = Number(interaction.values?.[0] || 0) || 0;
        const pilot = await resolvePilotForInteraction(interaction);
        if (!pilot) {
          throw new Error('Pilot profile not found.');
        }

        const payload = await buildBookingAircraftPayload({
          pilot,
          discordUserId: interaction.user.id,
          userId: interaction.user.id,
          routeId,
        });
        await interaction.editReply(payload);
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to load route aircraft list.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId.startsWith(BOOKING_AIRCRAFT_SELECT_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const parts = interaction.customId.split(':');
        const routeId = Number(parts[2] || 0) || 0;
        const aircraftId = Number(interaction.values?.[0] || 0) || 0;
        const pilot = await resolvePilotForInteraction(interaction);
        if (!pilot) {
          throw new Error('Pilot profile not found.');
        }

        const payload = await buildBookingConfirmPayload({
          pilot,
          discordUserId: interaction.user.id,
          userId: interaction.user.id,
          routeId,
          aircraftId,
        });
        await interaction.editReply({
          embeds: payload.embeds,
          components: payload.components,
        });
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to prepare booking confirmation.'),
          ephemeral: true,
        });
      }
      return;
    }

    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith(PIREP_COMMENT_BUTTON_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      const parts = interaction.customId.split(':');
      const pirepId = Number(parts[2] || 0) || 0;
      if (pirepId <= 0) {
        await interaction.reply({
          content: 'PIREP ID is missing.',
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`${PIREP_COMMENT_MODAL_PREFIX}${pirepId}:${interaction.user.id}`)
        .setTitle(`Comment on PIREP #${pirepId}`);

      const commentInput = new TextInputBuilder()
        .setCustomId('pirep-comment-content')
        .setLabel('Comment')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000)
        .setPlaceholder('Write your reply for the operations team');

      modal.addComponents(new ActionRowBuilder().addComponents(commentInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId.startsWith(CLAIM_SUBMIT_BUTTON_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(CLAIM_SUBMIT_MODAL_ID)
        .setTitle('Submit Manual Claim');

      const bookingIdInput = new TextInputBuilder()
        .setCustomId('claim-booking-id')
        .setLabel('Booking ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(12);

      const departureInput = new TextInputBuilder()
        .setCustomId('claim-departure-time')
        .setLabel('Departure time (ISO 8601)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('2026-04-17T10:00:00Z');

      const arrivalInput = new TextInputBuilder()
        .setCustomId('claim-arrival-time')
        .setLabel('Arrival time (ISO 8601)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('2026-04-17T12:35:00Z');

      const messageInput = new TextInputBuilder()
        .setCustomId('claim-message')
        .setLabel('Claim message')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(600);

      const proofInput = new TextInputBuilder()
        .setCustomId('claim-proof-links')
        .setLabel('Proof links (comma or new line separated)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1200);

      modal.addComponents(
        new ActionRowBuilder().addComponents(bookingIdInput),
        new ActionRowBuilder().addComponents(departureInput),
        new ActionRowBuilder().addComponents(arrivalInput),
        new ActionRowBuilder().addComponents(messageInput),
        new ActionRowBuilder().addComponents(proofInput)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId.startsWith(BOOKING_MENU_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const pilot = await resolvePilotForInteraction(interaction);
        if (!pilot) {
          throw new Error('Pilot profile not found.');
        }

        const payload = await buildBookingMenuPayload({
          pilot,
          discordUserId: interaction.user.id,
          userId: interaction.user.id,
        });
        await interaction.editReply(payload);
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to open booking menu.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId.startsWith(BOOKING_AIRCRAFT_MENU_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const parts = interaction.customId.split(':');
        const routeId = Number(parts[2] || 0) || 0;
        const pilot = await resolvePilotForInteraction(interaction);
        if (!pilot) {
          throw new Error('Pilot profile not found.');
        }

        const payload = await buildBookingAircraftPayload({
          pilot,
          discordUserId: interaction.user.id,
          userId: interaction.user.id,
          routeId,
        });
        await interaction.editReply(payload);
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to return to aircraft selection.'),
          ephemeral: true,
        });
      }
      return;
    }
    if (interaction.customId.startsWith(NOTAM_READ_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const parts = interaction.customId.split(':');
        const notamId = Number(parts[2] || 0) || 0;
        const pilot = await resolvePilotForInteraction(interaction);
        if (!pilot) {
          throw new Error('Pilot profile not found.');
        }

        updatePilotNotamState(pilot, notamId, {
          readAt: new Date().toISOString(),
        });

        await interaction.followUp({
          content: `NOTAM #${notamId} marked as read.`,
          ephemeral: true,
        });
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to mark NOTAM as read.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId.startsWith(BOOKING_CONFIRM_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const parts = interaction.customId.split(':');
        const routeId = Number(parts[2] || 0) || 0;
        const aircraftId = Number(parts[3] || 0) || 0;
        const pilot = await resolvePilotForInteraction(interaction);
        if (!pilot) {
          throw new Error('Pilot profile not found.');
        }

        const context = await loadBookingContext({
          pilot,
          discordUserId: interaction.user.id,
        });
        if (context.activeBooking) {
          throw new Error('You already have an active booking. Delete it first before creating a new one.');
        }
        if (context.unreadNotams.length > 0) {
          throw new Error(`You still have ${context.unreadNotams.length} unread NOTAM${context.unreadNotams.length === 1 ? '' : 's'}.`);
        }

        const departureTime = getDefaultBookingDepartureTime();
        await executePilotApiRequest({
          candidate: pilot,
          path: '/bookings',
          method: 'POST',
          body: {
            route_id: routeId,
            aircraft_id: aircraftId,
            departure_time: departureTime,
          },
        });

        const replyPayload = await buildBookingReplyPayload({
          pilot,
          discordUserId: interaction.user.id,
          userId: interaction.user.id,
        });
        await interaction.editReply(replyPayload);
        await interaction.followUp({
          content: `Booking created successfully for ${formatUtcDate(departureTime)}.`,
          ephemeral: true,
        });
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to create booking.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId.startsWith(BOOKING_VIEW_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const parts = interaction.customId.split(':');
        const targetIndex = Math.max(0, Number(parts[2] || 0) || 0);
        const pilot = await findPilotByDiscordId(interaction.user.id);
        if (!pilot) {
          await interaction.followUp({
            content: 'Pilot profile not found. Make sure your Discord account is linked in vAMSYS.',
            ephemeral: true,
          });
          return;
        }

        const bookings = await getBookingCollectionForPilot(pilot, { limit: 20 });
        const nextIndex = bookings.length === 0 ? 0 : Math.min(targetIndex, Math.max(0, bookings.length - 1));
        const replyPayload = await buildBookingReplyPayload({
          pilot,
          discordUserId: interaction.user.id,
          userId: interaction.user.id,
          selectedIndex: nextIndex,
        });
        await interaction.editReply(replyPayload);
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to refresh bookings.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId.startsWith(BOOKING_CANCEL_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const parts = interaction.customId.split(':');
        const bookingId = Number(parts[2] || 0) || 0;
        const fallbackIndex = Math.max(0, Number(parts[3] || 0) || 0);
        const pilot = await findPilotByDiscordId(interaction.user.id);
        if (!pilot) {
          throw new Error('Pilot profile not found.');
        }

        if (bookingId <= 0) {
          throw new Error('Booking ID is missing.');
        }

        await executePilotApiRequest({
          candidate: pilot,
          path: `/bookings/${encodeURIComponent(String(bookingId))}`,
          method: 'DELETE',
        });

        const bookings = await getBookingCollectionForPilot(pilot, { limit: 20 });
        const nextIndex = bookings.length === 0 ? 0 : Math.min(fallbackIndex, bookings.length - 1);
        const replyPayload = await buildBookingReplyPayload({
          pilot,
          discordUserId: interaction.user.id,
          userId: interaction.user.id,
          selectedIndex: nextIndex,
        });
        await interaction.editReply(replyPayload);
        await interaction.followUp({
          content: `Booking #${bookingId} was cancelled.`,
          ephemeral: true,
        });
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to delete booking.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId.startsWith(NOTAM_VIEW_PREFIX)) {
      if (!(await ensureInteractionOwner(interaction))) {
        return;
      }

      await interaction.deferUpdate();
      try {
        const parts = interaction.customId.split(':');
        const targetIndex = Math.max(0, Number(parts[2] || 0) || 0);
        const notams = await loadCurrentNotams({ limit: 25 });
        const notam = notams[targetIndex] || notams[0] || null;
        const safeIndex = notam ? Math.min(targetIndex, Math.max(0, notams.length - 1)) : 0;
        await interaction.editReply({
          embeds: [buildNotamEmbed({ notam, index: safeIndex, total: notams.length })],
          components: buildNotamComponents({
            notam,
            index: safeIndex,
            total: notams.length,
            userId: interaction.user.id,
          }),
        });
      } catch (error) {
        await interaction.followUp({
          content: String(error?.message || 'Failed to refresh NOTAMs.'),
          ephemeral: true,
        });
      }
      return;
    }

    if (interaction.customId === TICKET_OPEN_BUTTON_ID) {
      const modal = new ModalBuilder()
        .setCustomId(TICKET_CREATE_MODAL_ID)
        .setTitle('Create Support Ticket');

      const subjectInput = new TextInputBuilder()
        .setCustomId('ticket-subject')
        .setLabel('Subject')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(80);

      const categoryInput = new TextInputBuilder()
        .setCustomId('ticket-category')
        .setLabel(`Category (${ticketAllowedCategories.join('/')})`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(40);

      const languageInput = new TextInputBuilder()
        .setCustomId('ticket-language')
        .setLabel(`Language (${ticketAllowedLanguages.join('/')})`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(10);

      const detailsInput = new TextInputBuilder()
        .setCustomId('ticket-details')
        .setLabel('Describe your issue')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1200);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(categoryInput),
        new ActionRowBuilder().addComponents(languageInput),
        new ActionRowBuilder().addComponents(detailsInput)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === TICKET_CLOSE_BUTTON_ID) {
      if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: 'This button can only be used in a ticket channel.',
          ephemeral: true,
        });
        return;
      }

      if (!canManageTicket(interaction, interaction.channel)) {
        await interaction.reply({
          content: 'You do not have permission to close this ticket.',
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`${TICKET_CLOSE_MODAL_PREFIX}${interaction.channelId}`)
        .setTitle('Close Ticket');

      const reasonInput = new TextInputBuilder()
        .setCustomId('ticket-close-reason')
        .setLabel('Reason (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(500);

      modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
      await interaction.showModal(modal);
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    const ws = Math.round(client.ws.ping);
    await interaction.reply(`🏓 Pong! WS ping: ${ws}ms`);
    return;
  }

  if (interaction.commandName === 'uptime') {
    const uptime = process.uptime();
    await interaction.reply(`⏱ Uptime: ${formatUptime(uptime)}`);
    return;
  }

  if (interaction.commandName === 'info') {
    await interaction.reply({
      content: [
        `🤖 Name: ${client.user.username}`,
        `🆔 Client ID: ${clientId}`,
        `🌐 Guild mode: ${guildId ? `single guild (${guildId})` : 'global'}`,
      ].join('\n'),
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === 'help') {
    await interaction.reply({
      content: [
        '📌 Available commands:',
        '/ping',
        '/uptime',
        '/info',
        '/help',
        '/vamsys-stats',
        '/vamsys-live [limit]',
        '/vamsys-recent [limit]',
        '/profile',
        '/booking',
        '/notams',
        '/roster [limit]',
        '/tours',
        '/claims',
        '/settings [scope] [key] [enabled]',
        '/location [icao]',
        '/badges',
        '/airport <icao>',
        '/routes <icao> [limit]',
        '/metar <icao>',
        '/taf <icao>',
        '/ticket-panel [channel]',
        '/news-create [channel]',
        '/alert-create [channel]',
        '/notam-create [priority] [channel]',
      ].join('\n'),
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === 'vamsys-stats') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      const [general, livePayload, recentPayload] = await Promise.all([
        vamsysFetch('/statistics/general'),
        vamsysFetch('/flight-map'),
        vamsysFetch('/pireps?page[size]=100&sort=-created_at'),
      ]);

      const pilots = general?.data?.pilots?.current ?? 0;
      const pireps = general?.data?.pireps?.total ?? 0;
      const hours = Math.round((general?.data?.flightTime?.seconds ?? 0) / 3600) || 0;

      const liveItems = Array.isArray(livePayload?.data) ? livePayload.data : [];
      const recentItems = Array.isArray(recentPayload?.data) ? recentPayload.data : [];
      const recentAccepted = recentItems.filter((item) =>
        ['accepted', 'auto_accepted', 'approved'].includes(
          String(item?.status || '').toLowerCase()
        )
      );

      const vacTemplate = { NWS: 0, KAR: 0, STW: 0 };
      const liveByVac = liveItems.reduce((acc, item) => {
        const callsign = item?.booking?.callsign || item?.booking?.flightNumber || '';
        const vac = detectVac(callsign);
        acc[vac] = (acc[vac] || 0) + 1;
        return acc;
      }, { ...vacTemplate });

      const recentByVac = recentAccepted.reduce((acc, item) => {
        const callsign = item?.callsign || item?.flight_number || item?.flightNumber || '';
        const vac = detectVac(callsign);
        acc[vac] = (acc[vac] || 0) + 1;
        return acc;
      }, { ...vacTemplate });

      const networkByType = liveItems.reduce((acc, item) => {
        const raw = String(
          item?.booking?.network ||
            item?.booking?.networkType ||
            item?.network ||
            ''
        )
          .trim()
          .toUpperCase();

        const key = raw === 'VATSIM' || raw === 'IVAO' ? raw : 'OTHER';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, { VATSIM: 0, IVAO: 0, OTHER: 0 });

      const embed = new EmbedBuilder()
        .setColor(0xe31e24)
        .setTitle('📊 vAMSYS VAC Statistics')
        .setDescription('Operational snapshot for Nordwind Virtual Group')
        .addFields(
          {
            name: 'Overview',
            value: [
              `👥 Pilots: **${pilots}**`,
              `🧾 Total PIREPs: **${pireps}**`,
              `⏱ Flight Hours: **${hours}h**`,
            ].join('\n'),
            inline: true,
          },
          {
            name: 'Live Flights (now)',
            value: [
              `🟢 Active: **${liveItems.length}**`,
              `NWS: **${liveByVac.NWS}** · KAR: **${liveByVac.KAR}** · STW: **${liveByVac.STW}**`,
              `VATSIM: **${networkByType.VATSIM}** · IVAO: **${networkByType.IVAO}** · Other: **${networkByType.OTHER}**`,
            ].join('\n'),
            inline: false,
          },
          {
            name: 'Recent Accepted Flights (last 100)',
            value: [
              `✅ Count: **${recentAccepted.length}**`,
              `NWS: **${recentByVac.NWS}** · KAR: **${recentByVac.KAR}** · STW: **${recentByVac.STW}**`,
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'Source: vAMSYS Operations API v3' })
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply('Failed to load vAMSYS statistics.');
    }
    return;
  }

  if (interaction.commandName === 'vamsys-live') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    const limit = interaction.options.getInteger('limit') ?? 5;
    await interaction.deferReply();
    try {
      const payload = await vamsysFetch('/flight-map');
      const flights = Array.isArray(payload?.data) ? payload.data.slice(0, limit) : [];

      if (flights.length === 0) {
        await interaction.editReply('No active flights right now.');
        return;
      }

      const lines = flights.map((item, index) => {
        const booking = item.booking || {};
        const dep = item.departureAirport || {};
        const arr = item.arrivalAirport || {};
        const progress = item.progress || {};
        const callsign = booking.callsign || booking.flightNumber || '—';
        const depCode = dep.icao || dep.iata || '—';
        const arrCode = arr.icao || arr.iata || '—';
        const percent = Math.round(Number(progress.progressPercentage ?? progress.progress ?? 0) || 0);
        const phase = progress.currentPhase || progress.phase || 'En Route';
        const vac = detectVac(callsign);
        return `${index + 1}. ${callsign} (${vac}) ${depCode} → ${arrCode} | ${phase} | ${percent}%`;
      });

      await interaction.editReply(['🟢 Active flights', ...lines].join('\n'));
    } catch {
      await interaction.editReply('Failed to load active flights from vAMSYS.');
    }
    return;
  }

  if (interaction.commandName === 'vamsys-recent') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    const limit = interaction.options.getInteger('limit') ?? 5;
    await interaction.deferReply();
    try {
      const payload = await vamsysFetch(`/pireps?page[size]=${Math.max(limit, 5)}&sort=-created_at`);
      const pireps = Array.isArray(payload?.data) ? payload.data.slice(0, limit) : [];

      if (pireps.length === 0) {
        await interaction.editReply('No recent flights found.');
        return;
      }

      const lines = pireps.map((p, index) => {
        const callsign = p.callsign || p.flight_number || `PIREP ${p.id}`;
        const dep = p.departure_airport_id || '—';
        const arr = p.arrival_airport_id || '—';
        const status = p.status || 'unknown';
        const duration = formatDuration(p.flight_length);
        return `${index + 1}. ${callsign} | ${dep} → ${arr} | ${status} | ${duration}`;
      });

      await interaction.editReply(['🛬 Recent flights', ...lines].join('\n'));
    } catch {
      await interaction.editReply('Failed to load recent flights from vAMSYS.');
    }
    return;
  }

  if (interaction.commandName === 'profile') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      const profile = await getPilotProfileData(interaction.user.id);
      if (!profile) {
        await interaction.editReply(
          'Pilot profile not found. Make sure your Discord account is linked in vAMSYS.'
        );
        return;
      }

      const discordUser = await client.users
        .fetch(interaction.user.id, { force: true })
        .catch(() => interaction.user);

      const fallbackEmbed = buildProfileFallbackEmbed(profile, discordUser);
      try {
        const cardBuffer = await generateProfileCard(
          profile,
          discordUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: false })
        );
        const attachment = new AttachmentBuilder(cardBuffer, { name: 'pilot-profile-card.png' });
        fallbackEmbed.setImage('attachment://pilot-profile-card.png');
        fallbackEmbed.setThumbnail(null);
        await interaction.editReply({ embeds: [fallbackEmbed], files: [attachment] });
      } catch {
        await interaction.editReply({ embeds: [fallbackEmbed] });
      }
    } catch {
      await interaction.editReply('Failed to load pilot profile from vAMSYS.');
    }
    return;
  }

  if (interaction.commandName === 'booking') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      const pilot = await resolvePilotForInteraction(interaction);
      if (!pilot) {
        await interaction.editReply(
          'Pilot not found. Link your Discord account in vAMSYS first.'
        );
        return;
      }

      const replyPayload = await buildBookingReplyPayload({
        pilot,
        discordUserId: interaction.user.id,
        userId: interaction.user.id,
      });
      await interaction.editReply(replyPayload);
    } catch {
      await interaction.editReply('Failed to load current booking.');
    }
    return;
  }

  if (interaction.commandName === 'notams') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      const notams = await loadCurrentNotams({ limit: 25 });
      const notam = notams[0] || null;
      await interaction.editReply({
        embeds: [buildNotamEmbed({ notam, index: 0, total: notams.length })],
        components: buildNotamComponents({
          notam,
          index: 0,
          total: notams.length,
          userId: interaction.user.id,
        }),
      });
    } catch {
      await interaction.editReply('Failed to load NOTAMs from vAMSYS.');
    }
    return;
  }

  if (interaction.commandName === 'roster') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    const limit = interaction.options.getInteger('limit') ?? 10;
    await interaction.deferReply();
    try {
      const pilots = await loadRosterSnapshot({ limit: 300 });
      const store = loadBotAuthStore() || {};
      const curatedSection = store?.curatedPilots && typeof store.curatedPilots === 'object' ? store.curatedPilots : {};
      const curatedPilots = pilots.filter((pilot) => {
        return getPilotStoreKeys(pilot).some((key) => curatedSection[key]?.isCurated);
      });

      await interaction.editReply({
        embeds: [buildRosterEmbed({ pilots, curatedPilots, limit })],
      });
    } catch {
      await interaction.editReply('Failed to load roster from vAMSYS.');
    }
    return;
  }

  if (interaction.commandName === 'tours') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({ content: 'vAMSYS credentials are not configured in bot .env', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const pilot = await resolvePilotForInteraction(interaction);
      if (!pilot) {
        await interaction.editReply('Pilot profile not found. Link your Discord account in vAMSYS first.');
        return;
      }
      const [profile, claimsCount] = await Promise.all([
        getPilotProfileData(interaction.user.id),
        resolveClaimsCountForCandidate(pilot),
      ]);
      await interaction.editReply({
        embeds: [buildToursEmbed({ tours: computeTourProgress({ profile: profile || {}, claimsCount }) })],
      });
    } catch {
      await interaction.editReply('Failed to load tours progress.');
    }
    return;
  }

  if (interaction.commandName === 'claims') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const pilot = await resolvePilotForInteraction(interaction);
      if (!pilot) {
        await interaction.editReply('Pilot profile not found. Link your Discord account in vAMSYS first.');
        return;
      }
      const claims = await loadClaimsForCandidate(pilot, { limit: 10 });
      await interaction.editReply({
        embeds: [buildClaimsEmbed({ claims, pilot })],
        components: buildClaimsComponents({ userId: interaction.user.id }),
      });
    } catch (error) {
      await interaction.editReply(String(error?.message || 'Failed to load claims.'));
    }
    return;
  }

  if (interaction.commandName === 'settings') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const pilot = await resolvePilotForInteraction(interaction);
      if (!pilot) {
        await interaction.editReply('Pilot profile not found. Link your Discord account in vAMSYS first.');
        return;
      }

      const scope = String(interaction.options.getString('scope') || '').trim().toLowerCase();
      const key = String(interaction.options.getString('key') || '').trim().toLowerCase();
      const enabled = interaction.options.getBoolean('enabled');
      const current = getPilotPreferences(pilot).preferences;

      if (scope && key && typeof enabled === 'boolean') {
        const nextNotifications = cloneNotificationSettings(current.notifications);
        if (scope === 'channel' && Object.prototype.hasOwnProperty.call(nextNotifications.channels, key)) {
          nextNotifications.channels[key] = enabled;
        } else if (scope === 'type' && Object.prototype.hasOwnProperty.call(nextNotifications.notificationTypes, key)) {
          nextNotifications.notificationTypes[key] = enabled;
        } else {
          const channelKeys = Object.keys(DEFAULT_NOTIFICATION_SETTINGS.channels).join(', ');
          const typeKeys = Object.keys(DEFAULT_NOTIFICATION_SETTINGS.notificationTypes).join(', ');
          await interaction.editReply(`Unknown settings key. Use channel keys: ${channelKeys} or type keys: ${typeKeys}.`);
          return;
        }
        setPilotPreferences(pilot, nextNotifications);
      }

      const resolved = getPilotPreferences(pilot).preferences;
      await interaction.editReply({ embeds: [buildSettingsEmbed(resolved)] });
    } catch (error) {
      await interaction.editReply(String(error?.message || 'Failed to load settings.'));
    }
    return;
  }

  if (interaction.commandName === 'location') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const pilot = await resolvePilotForInteraction(interaction);
      if (!pilot) {
        await interaction.editReply('Pilot profile not found. Link your Discord account in vAMSYS first.');
        return;
      }

      const requestedIcao = String(interaction.options.getString('icao') || '').trim().toUpperCase();
      let location = null;
      if (requestedIcao) {
        location = await updatePilotLocation(pilot, requestedIcao);
      } else {
        const profile = await getPilotProfileData(interaction.user.id);
        location = {
          airportCode: String(profile?.airportCode || '').trim() || null,
          locationLabel: profile?.airportCode ? `${profile.airport} (${profile.airportCode})` : profile?.airport || null,
        };
      }

      await interaction.editReply({ embeds: [buildLocationEmbed(location)] });
    } catch (error) {
      await interaction.editReply(String(error?.message || 'Failed to update pilot location.'));
    }
    return;
  }

  if (interaction.commandName === 'badges') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const pilot = await resolvePilotForInteraction(interaction);
      if (!pilot) {
        await interaction.editReply('Pilot profile not found. Link your Discord account in vAMSYS first.');
        return;
      }

      const [profile, claimsCount] = await Promise.all([
        getPilotProfileData(interaction.user.id),
        resolveClaimsCountForCandidate(pilot),
      ]);
      const badgeState = syncPilotBadges(pilot, { profile: profile || {}, claimsCount });
      const embed = buildBadgesEmbed({ badges: badgeState.badges });
      try {
        const cardBuffer = await generateBadgesCard(profile || {}, badgeState.badges);
        const attachment = new AttachmentBuilder(cardBuffer, { name: 'pilot-badges-card.png' });
        embed.setImage('attachment://pilot-badges-card.png');
        await interaction.editReply({ embeds: [embed], files: [attachment] });
      } catch {
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      await interaction.editReply(String(error?.message || 'Failed to load badges.'));
    }
    return;
  }

  if (interaction.commandName === 'airport') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    const icao = normalizeIcao(interaction.options.getString('icao', true));
    if (icao.length !== 4) {
      await interaction.reply({
        content: 'ICAO must be 4 letters (example: UUEE).',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      const lookup = await loadAirportsLookup();
      const airport = lookup.byCode.get(icao) || null;

      if (!airport) {
        await interaction.editReply(`Airport ${icao} not found in vAMSYS database.`);
        return;
      }

      const airportCode =
        toAirportCode(airport.icao) || toAirportCode(airport.iata) || toAirportCode(icao) || '—';
      const iataCode = toAirportCode(airport.iata) || '—';
      const countryCode = extractCountryCode(airport) || inferCountryCodeFromIcao(airportCode);
      const countryFlag = countryCodeToFlagEmoji(countryCode);
      const countryName =
        airport.country?.name ||
        airport.country_name ||
        airport.country ||
        (countryCode || '—');

      const lat = Number(
        airport.lat ?? airport.latitude ?? airport.coord_lat ?? airport.coords_lat
      );
      const lon = Number(
        airport.lon ?? airport.lng ?? airport.longitude ?? airport.coord_lon ?? airport.coords_lon
      );
      const latitude = Number.isFinite(lat) ? lat.toFixed(4) : '—';
      const longitude = Number.isFinite(lon) ? lon.toFixed(4) : '—';

      const city = airport.city || airport.municipality || airport.town || '—';
      const timezone = airport.timezone || airport.tz || '—';
      const elevationRaw = airport.elevation ?? airport.elevation_ft ?? airport.altitude;
      const elevation =
        elevationRaw !== undefined && elevationRaw !== null && String(elevationRaw).length > 0
          ? `${elevationRaw} ft`
          : '—';

      const embed = new EmbedBuilder()
        .setColor(0x14b8a6)
        .setTitle(`🛬 ${airport.name || `${airportCode} Airport`}`)
        .setDescription(`${countryFlag} ${countryName}`)
        .addFields(
          { name: 'ICAO', value: airportCode, inline: true },
          { name: 'IATA', value: iataCode, inline: true },
          { name: 'City', value: String(city), inline: true },
          { name: 'Latitude', value: String(latitude), inline: true },
          { name: 'Longitude', value: String(longitude), inline: true },
          { name: 'Elevation', value: String(elevation), inline: true },
          { name: 'Timezone', value: String(timezone), inline: true },
          { name: 'Airport ID', value: String(airport.id || '—'), inline: true }
        )
        .setFooter({ text: 'Source: vAMSYS Operations API /airports' })
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Failed to load airport data from vAMSYS.');
    }
    return;
  }

  if (interaction.commandName === 'routes') {
    if (!hasVamsysCredentials()) {
      await interaction.reply({
        content: 'vAMSYS credentials are not configured in bot .env',
        ephemeral: true,
      });
      return;
    }

    const fromIcao = normalizeIcao(interaction.options.getString('icao', true));
    if (fromIcao.length !== 4) {
      await interaction.reply({
        content: 'ICAO must be 4 letters (example: LTAI).',
        ephemeral: true,
      });
      return;
    }

    const limit = interaction.options.getInteger('limit') ?? 12;
    await interaction.deferReply();

    try {
      const [lookup, routes] = await Promise.all([loadAirportsLookup(), loadRoutesList()]);
      const departureAirport = lookup.byCode.get(fromIcao) || null;

      if (!departureAirport) {
        await interaction.editReply(`Airport ${fromIcao} not found in vAMSYS database.`);
        return;
      }

      const departureId = departureAirport.id !== undefined ? String(departureAirport.id) : null;
      const filtered = routes.filter((route) => {
        const routeDepartureCode = toAirportCode(
          route?.departure_airport?.icao ||
            route?.departure_airport?.iata ||
            route?.departure_icao ||
            route?.from
        );

        if (routeDepartureCode && routeDepartureCode === fromIcao) {
          return true;
        }

        const routeDepartureId = route?.departure_id ?? route?.departure_airport_id ?? null;
        if (departureId && routeDepartureId !== null && routeDepartureId !== undefined) {
          return String(routeDepartureId) === departureId;
        }

        return false;
      });

      if (filtered.length === 0) {
        await interaction.editReply(`No routes found from ${fromIcao}.`);
        return;
      }

      const selected = filtered.slice(0, limit);
      const fromText = formatAirportCityCode(departureAirport, fromIcao);

      const grouped = {
        NWS: [],
        KAR: [],
        STW: [],
      };

      selected.forEach((route, index) => {
        const flightNumber = normalizeRouteFlightNumber(route) || `Route ${route?.id || index + 1}`;
        const vacCode = getVacCodeFromFlightNumber(flightNumber);
        const airline = getVacLabelFromFlightNumber(flightNumber);

        const arrivalAirport =
          route?.arrival_airport ||
          (route?.arrival_id !== undefined && route?.arrival_id !== null
            ? lookup.byId.get(String(route.arrival_id))
            : null) ||
          null;

        const toText = formatAirportCityCode(
          arrivalAirport,
          route?.arrival_airport?.icao ||
            route?.arrival_airport?.iata ||
            route?.arrival_icao ||
            route?.to ||
            route?.arrival_id
        );

        const line = `• **${flightNumber}** — ${fromText} -> ${toText}`;
        if (grouped[vacCode]) {
          grouped[vacCode].push(line);
        } else {
          grouped.NWS.push(line);
        }
      });

      const sectionOrder = [
        { code: 'NWS', label: 'Nordwind Airlines' },
        { code: 'KAR', label: 'IKAR Airlines' },
        { code: 'STW', label: 'Southwind Airlines' },
      ];

      const fields = sectionOrder
        .filter((section) => grouped[section.code].length > 0)
        .map((section) => ({
          name: `${section.code} · ${section.label} (${grouped[section.code].length})`,
          value: fitLinesForEmbedField(grouped[section.code]),
          inline: false,
        }));

      const hiddenCount = Math.max(0, filtered.length - selected.length);
      const descriptionParts = [
        `From: ${fromText}`,
        `Shown: ${selected.length} of ${filtered.length}`,
      ];

      if (hiddenCount > 0) {
        descriptionParts.push(`Use \`/routes ${fromIcao} limit:${Math.min(25, limit + 5)}\` to show more.`);
      }

      const embed = new EmbedBuilder()
        .setColor(0x2563eb)
        .setTitle(`✈️ Available routes from ${fromIcao}`)
        .setDescription(descriptionParts.join('\n'))
        .addFields(fields)
        .setFooter({ text: 'Source: vAMSYS Operations API /routes' })
        .setTimestamp(new Date());

      if (fields.length === 0) {
        await interaction.editReply(`No routes found from ${fromIcao}.`);
        return;
      }

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Failed to load routes from vAMSYS.');
    }
    return;
  }

  if (interaction.commandName === 'metar') {
    const icao = normalizeIcao(interaction.options.getString('icao', true));
    if (icao.length !== 4) {
      await interaction.reply({
        content: 'ICAO must be 4 letters (example: UUEE).',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      const metar = await fetchMetar(icao);
      if (!metar?.raw) {
        await interaction.editReply(`METAR not found for ${icao}.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0ea5e9)
        .setTitle(`METAR ${metar.station || icao}`)
        .setDescription(`\`${metar.raw}\``)
        .setFooter({ text: metar.observed ? `Observed: ${metar.observed}` : 'AviationWeather' })
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Failed to load METAR.');
    }
    return;
  }

  if (interaction.commandName === 'taf') {
    const icao = normalizeIcao(interaction.options.getString('icao', true));
    if (icao.length !== 4) {
      await interaction.reply({
        content: 'ICAO must be 4 letters (example: UUEE).',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    try {
      const taf = await fetchTaf(icao);
      if (!taf?.raw) {
        await interaction.editReply(`TAF not found for ${icao}.`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x6366f1)
        .setTitle(`TAF ${taf.station || icao}`)
        .setDescription(`\`${taf.raw}\``)
        .setFooter({ text: taf.issueTime ? `Issued: ${taf.issueTime}` : 'AviationWeather' })
        .setTimestamp(new Date());

      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply('Failed to load TAF.');
    }
    return;
  }

  if (interaction.commandName === 'ticket-panel') {
    if (!hasAdminAccess(interaction)) {
      await interaction.reply({
        content: 'You do not have permission to create ticket panel.',
        ephemeral: true,
      });
      return;
    }

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.reply({
        content: 'Cannot post ticket panel to this channel.',
        ephemeral: true,
      });
      return;
    }

    const panelEmbed = new EmbedBuilder()
      .setColor(0x1d4ed8)
      .setTitle('🎫 Support Tickets')
      .setDescription(
        [
          'Need help? Click the button below and fill the modal form.',
          'A private ticket channel will be created for you and staff.',
        ].join('\n')
      )
      .addFields(
        {
          name: 'How it works',
          value: [
            '1) Click **Create Ticket**',
            '2) Fill subject and issue details',
            '3) Staff will answer in your private ticket channel',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Categories',
          value: ticketAllowedCategories.join(', '),
          inline: false,
        },
        {
          name: 'Languages',
          value: ticketAllowedLanguages.join(', '),
          inline: false,
        },
        {
          name: 'Admin Roles',
          value:
            getEffectiveAdminRoleIds().length > 0
              ? getEffectiveAdminRoleIds().map((id) => `<@&${id}>`).join(' ')
              : 'Not configured',
          inline: false,
        }
      )
      .setTimestamp(new Date());

    const panelButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(TICKET_OPEN_BUTTON_ID)
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
    );

    await targetChannel.send({ embeds: [panelEmbed], components: [panelButtons] });
    await interaction.reply({
      content: `Ticket panel posted to <#${targetChannel.id}>.`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === 'news-create') {
    if (!hasAdminAccess(interaction)) {
      await interaction.reply({
        content: 'You do not have permission to create news posts.',
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const targetChannelId = channel?.id || interaction.channelId;

    const modal = new ModalBuilder()
      .setCustomId(`news-create:${targetChannelId}`)
      .setTitle('Create News Post');

    const titleInput = new TextInputBuilder()
      .setCustomId('news-title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(120);

    const summaryInput = new TextInputBuilder()
      .setCustomId('news-summary')
      .setLabel('Summary')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(600);

    const bodyInput = new TextInputBuilder()
      .setCustomId('news-body')
      .setLabel('Details (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1800);

    const imageInput = new TextInputBuilder()
      .setCustomId('news-image')
      .setLabel('Image URL (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(summaryInput),
      new ActionRowBuilder().addComponents(bodyInput),
      new ActionRowBuilder().addComponents(imageInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (interaction.commandName === 'alert-create') {
    if (!hasAdminAccess(interaction)) {
      await interaction.reply({
        content: 'You do not have permission to create alerts.',
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const targetChannelId = channel?.id || interaction.channelId;

    const modal = new ModalBuilder()
      .setCustomId(`alert-create:${targetChannelId}`)
      .setTitle('Create Operational Alert');

    const titleInput = new TextInputBuilder()
      .setCustomId('alert-title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(120);

    const summaryInput = new TextInputBuilder()
      .setCustomId('alert-summary')
      .setLabel('Summary')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(600);

    const contentInput = new TextInputBuilder()
      .setCustomId('alert-content')
      .setLabel('Details')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1800);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(summaryInput),
      new ActionRowBuilder().addComponents(contentInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (interaction.commandName === 'notam-create') {
    if (!hasAdminAccess(interaction)) {
      await interaction.reply({
        content: 'You do not have permission to create NOTAMs.',
        ephemeral: true,
      });
      return;
    }

    const priority = interaction.options.getString('priority') || 'medium';
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const targetChannelId = channel?.id || interaction.channelId;

    const modal = new ModalBuilder()
      .setCustomId(`notam-create:${priority}:${targetChannelId}`)
      .setTitle('Create NOTAM');

    const titleInput = new TextInputBuilder()
      .setCustomId('notam-title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(120);

    const contentInput = new TextInputBuilder()
      .setCustomId('notam-content')
      .setLabel('Content')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000);

    const affectsInput = new TextInputBuilder()
      .setCustomId('notam-affects')
      .setLabel('Affected airports (comma-separated ICAO)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(contentInput),
      new ActionRowBuilder().addComponents(affectsInput)
    );

    await interaction.showModal(modal);
    return;
  }
});

async function bootstrap() {
  await registerCommands();
  await client.login(token);
}

bootstrap().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  if (pilotStatusTimer) {
    clearInterval(pilotStatusTimer);
  }
  if (liveFeedTimer) {
    clearInterval(liveFeedTimer);
  }
  if (notamNotificationTimer) {
    clearInterval(notamNotificationTimer);
  }
  if (badgeNotificationTimer) {
    clearInterval(badgeNotificationTimer);
  }
  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  if (pilotStatusTimer) {
    clearInterval(pilotStatusTimer);
  }
  if (liveFeedTimer) {
    clearInterval(liveFeedTimer);
  }
  if (notamNotificationTimer) {
    clearInterval(notamNotificationTimer);
  }
  if (badgeNotificationTimer) {
    clearInterval(badgeNotificationTimer);
  }
  await client.destroy();
  process.exit(0);
});
