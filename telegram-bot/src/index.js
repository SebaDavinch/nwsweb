import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(BOT_DIR, '..');

const botEnvPath = path.resolve(BOT_DIR, '.env');
const rootEnvPath = path.resolve(ROOT_DIR, '.env');
if (fs.existsSync(botEnvPath)) {
  dotenv.config({ path: botEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const token = String(process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN || '').trim();
const websiteBaseUrl = String(
  process.env.WEBSITE_BASE_URL || `http://127.0.0.1:${String(process.env.VAMSYS_SERVER_PORT || 8787).trim() || '8787'}`
)
  .trim()
  .replace(/\/+$/, '');
const configToken = String(process.env.TELEGRAM_BOT_CONFIG_TOKEN || token).trim();
const pollingEnabled = String(process.env.TELEGRAM_BOT_POLLING || 'true').trim().toLowerCase() !== 'false';
const announcementIntervalMs = Math.max(
  60_000,
  Number(process.env.TELEGRAM_BOT_ANNOUNCEMENT_INTERVAL_MS || 180_000) || 180_000,
);
const pirepIntervalMs = Math.max(
  60_000,
  Number(process.env.TELEGRAM_BOT_PIREP_INTERVAL_MS || 90_000) || 90_000,
);
const defaultRosterLimit = Math.max(
  3,
  Math.min(20, Number(process.env.TELEGRAM_BOT_DEFAULT_ROSTER_LIMIT || 8) || 8),
);

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is missing');
}

const bot = new TelegramBot(token, { polling: pollingEnabled });
const inputState = new Map();
const knownAnnouncementIds = {
  news: new Set(),
  notams: new Set(),
  events: new Set(),
};
const knownPirepStates = new Map();
let announcementsPrimed = false;
let pirepPrimed = false;

const runtimeConfigCache = {
  loadedAt: 0,
  commandSignature: '',
  botSettings: null,
  ticketConfig: null,
};

const runtimeConfigTtlMs = 30_000;

const defaultRuntimeBotSettings = {
  enabled: true,
  commands: {
    start: true,
    menu: true,
    link: true,
    help: true,
    ping: true,
    profile: true,
    booking: true,
    news: true,
    notams: true,
    events: true,
    roster: true,
    metar: true,
    taf: true,
    settings: true,
    ticket: true,
  },
};

const commandList = [
  { command: 'start', settingKey: 'start', description: 'Открыть главное меню' },
  { command: 'menu', settingKey: 'menu', description: 'Показать меню' },
  { command: 'link', settingKey: 'link', description: 'Привязать Telegram к профилю: /link CODE' },
  { command: 'help', settingKey: 'help', description: 'Подсказка по командам' },
  { command: 'ping', settingKey: 'ping', description: 'Проверка доступности бота' },
  { command: 'profile', settingKey: 'profile', description: 'Показать профиль пилота' },
  { command: 'booking', settingKey: 'booking', description: 'Показать текущий букинг' },
  { command: 'ticket', settingKey: 'ticket', description: 'Мои тикеты и создание нового' },
  { command: 'news', settingKey: 'news', description: 'Последние новости' },
  { command: 'notams', settingKey: 'notams', description: 'Актуальные NOTAM' },
  { command: 'events', settingKey: 'events', description: 'Ближайшие события' },
  { command: 'roster', settingKey: 'roster', description: 'Текущий ростер' },
  { command: 'metar', settingKey: 'metar', description: 'METAR по ICAO, например /metar UUEE' },
  { command: 'taf', settingKey: 'taf', description: 'TAF по ICAO, например /taf UUEE' },
  { command: 'settings', settingKey: 'settings', description: 'Настройки Telegram-уведомлений' },
];

const buildActorFromMessage = (msg = {}) => ({
  chatId: String(msg?.chat?.id || '').trim() || null,
  telegramId: String(msg?.from?.id || '').trim() || null,
  username: String(msg?.from?.username || '').trim() || null,
  name: [msg?.from?.first_name, msg?.from?.last_name].map((value) => String(value || '').trim()).filter(Boolean).join(' ') || null,
});

const buildActorFromCallback = (query = {}) => ({
  chatId: String(query?.message?.chat?.id || '').trim() || null,
  telegramId: String(query?.from?.id || '').trim() || null,
  username: String(query?.from?.username || '').trim() || null,
  name: [query?.from?.first_name, query?.from?.last_name].map((value) => String(value || '').trim()).filter(Boolean).join(' ') || null,
});

const formatDateTime = (value) => {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) {
    return String(value || '').trim() || '—';
  }
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
};

const compactText = (value, maxLength = 240) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '—';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
};

const getRuntimeBotSettings = () => {
  const existing = runtimeConfigCache.botSettings && typeof runtimeConfigCache.botSettings === 'object'
    ? runtimeConfigCache.botSettings
    : {};

  return {
    ...defaultRuntimeBotSettings,
    ...existing,
    commands: {
      ...defaultRuntimeBotSettings.commands,
      ...(existing?.commands && typeof existing.commands === 'object' ? existing.commands : {}),
    },
  };
};

const isCommandEnabled = (key) => {
  const settings = getRuntimeBotSettings();
  if (settings.enabled === false) {
    return false;
  }

  return settings?.commands?.[key] !== false;
};

const buildAvailableTelegramCommands = () =>
  commandList
    .filter((item) => !item.settingKey || isCommandEnabled(item.settingKey))
    .map(({ command, description }) => ({ command, description }));

const syncTelegramCommands = async () => {
  const commands = buildAvailableTelegramCommands();
  const signature = JSON.stringify(commands);
  if (signature === runtimeConfigCache.commandSignature) {
    return;
  }

  await bot.setMyCommands(commands);
  runtimeConfigCache.commandSignature = signature;
};

const ensureRuntimeConfig = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && runtimeConfigCache.botSettings && now - runtimeConfigCache.loadedAt < runtimeConfigTtlMs) {
    return runtimeConfigCache;
  }

  try {
    const payload = await websiteRequest('/api/telegram-bot/config');
    runtimeConfigCache.botSettings = payload?.botSettings || null;
    runtimeConfigCache.ticketConfig = payload?.ticketConfig || null;
    runtimeConfigCache.loadedAt = now;
    await syncTelegramCommands().catch(() => null);
  } catch (error) {
    if (!runtimeConfigCache.botSettings) {
      runtimeConfigCache.botSettings = null;
      runtimeConfigCache.ticketConfig = null;
      runtimeConfigCache.loadedAt = now;
    }
  }

  return runtimeConfigCache;
};

const ensureCommandAllowed = async (chatId, commandKey) => {
  await ensureRuntimeConfig().catch(() => null);
  if (isCommandEnabled(commandKey)) {
    return true;
  }

  await sendMenu(chatId, 'Эта команда сейчас отключена в админке сайта.');
  return false;
};

const createInlineButton = (text, callbackData) => ({ text, callback_data: callbackData });

const pushMenuRow = (rows, items) => {
  const filtered = items.filter((item) => !item.settingKey || isCommandEnabled(item.settingKey));
  if (filtered.length === 0) {
    return;
  }

  rows.push(filtered.map((item) => createInlineButton(item.text, item.action)));
};

const buildMainMenu = () => ({
  reply_markup: {
    inline_keyboard: (() => {
      const rows = [];
      pushMenuRow(rows, [
        { text: 'Профиль', action: 'menu:profile', settingKey: 'profile' },
        { text: 'Букинг', action: 'menu:booking', settingKey: 'booking' },
      ]);
      pushMenuRow(rows, [
        { text: 'Новости', action: 'menu:news', settingKey: 'news' },
        { text: 'NOTAM', action: 'menu:notams', settingKey: 'notams' },
      ]);
      pushMenuRow(rows, [
        { text: 'События', action: 'menu:events', settingKey: 'events' },
        { text: 'Ростер', action: 'menu:roster', settingKey: 'roster' },
      ]);
      pushMenuRow(rows, [
        { text: 'METAR', action: 'menu:metar_prompt', settingKey: 'metar' },
        { text: 'TAF', action: 'menu:taf_prompt', settingKey: 'taf' },
      ]);
      pushMenuRow(rows, [
        { text: 'Тикеты', action: 'menu:tickets', settingKey: 'ticket' },
        { text: 'Настройки', action: 'menu:settings', settingKey: 'settings' },
      ]);
      pushMenuRow(rows, [
        { text: 'Как привязать', action: 'menu:link_help', settingKey: 'link' },
      ]);
      return rows;
    })(),
  },
});

const buildSettingsKeyboard = (preferences = null) => {
  const channels = preferences?.notifications?.channels || {};
  const types = preferences?.notifications?.notificationTypes || {};
  const icon = (value) => (value ? 'ON' : 'OFF');

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `Telegram channel ${icon(Boolean(channels.telegram))}`, callback_data: 'settings:channel:telegram' },
        ],
        [
          { text: `Букинг ${icon(Boolean(types.booking))}`, callback_data: 'settings:type:booking' },
          { text: `Claim ${icon(Boolean(types.claim))}`, callback_data: 'settings:type:claim' },
        ],
        [
          { text: `Review ${icon(Boolean(types.review))}`, callback_data: 'settings:type:review' },
          { text: `Await review ${icon(Boolean(types.awaitingReview))}`, callback_data: 'settings:type:awaitingReview' },
        ],
        [
          { text: `Accepted ${icon(Boolean(types.accepted))}`, callback_data: 'settings:type:accepted' },
          { text: `Rejected ${icon(Boolean(types.rejected))}`, callback_data: 'settings:type:rejected' },
        ],
        [
          { text: `Need reply ${icon(Boolean(types.needsReply))}`, callback_data: 'settings:type:needsReply' },
          { text: `Invalidated ${icon(Boolean(types.invalidated))}`, callback_data: 'settings:type:invalidated' },
        ],
        [
          { text: `NOTAM ${icon(Boolean(types.notam))}`, callback_data: 'settings:type:notam' },
          { text: `Events ${icon(Boolean(types.event))}`, callback_data: 'settings:type:event' },
        ],
        [
          { text: `Badge ${icon(Boolean(types.badge))}`, callback_data: 'settings:type:badge' },
          { text: `System ${icon(Boolean(types.system))}`, callback_data: 'settings:type:system' },
        ],
        [
          { text: 'Обновить', callback_data: 'menu:settings' },
          { text: 'Меню', callback_data: 'menu:home' },
        ],
      ],
    },
  };
};

const sendMenu = async (chatId, text) =>
  bot.sendMessage(chatId, text, buildMainMenu());

const websiteRequest = async (endpoint, { method = 'GET', body = null, query = null } = {}) => {
  const url = new URL(endpoint, `${websiteBaseUrl}/`);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  const headers = {};
  if (url.pathname.startsWith('/api/telegram-bot/')) {
    headers['x-telegram-bot-token'] = configToken;
  }
  if (body !== null) {
    headers['content-type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(String(payload?.message || payload?.error || `Request failed: ${response.status}`));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

const ensureLinked = async (actor) => {
  const chatId = String(actor?.chatId || '').trim();
  const telegramId = String(actor?.telegramId || '').trim();
  const profile = await websiteRequest('/api/telegram-bot/profile', {
    method: 'POST',
    body: {
      chatId,
      telegramId,
      actor,
    },
  });
  return profile;
};

const loadPreferences = async (actor) =>
  websiteRequest('/api/telegram-bot/preferences', {
    query: {
      chatId: actor?.chatId,
      telegramId: actor?.telegramId,
    },
  });

const togglePreference = async (actor, bucket, key) => {
  const current = await loadPreferences(actor);
  const existing = current?.preferences?.notifications || {};
  const channels = existing.channels || {};
  const notificationTypes = existing.notificationTypes || {};

  const payload =
    bucket === 'channel'
      ? { notifications: { channels: { [key]: !Boolean(channels[key]) } } }
      : { notifications: { notificationTypes: { [key]: !Boolean(notificationTypes[key]) } } };

  return websiteRequest('/api/telegram-bot/preferences', {
    method: 'PATCH',
    body: {
      chatId: actor?.chatId,
      telegramId: actor?.telegramId,
      actor,
      ...payload,
    },
  });
};

const formatProfileMessage = (payload = {}) => {
  const profile = payload?.profile || {};
  return [
    'Профиль пилота',
    `Имя: ${profile.name || '—'}`,
    `Позывной: ${profile.callsign || '—'}`,
    `Ранг: ${profile.rank || '—'}`,
    `Полётов: ${profile.flights ?? '—'}`,
    `Часы: ${profile.hours ?? '—'}`,
    `Средняя посадка: ${profile.avgVs ?? '—'}${profile.avgVs ? ' fpm' : ''}`,
    `Баланс: ${profile.balance ?? '—'}`,
    `В системе с: ${formatDateTime(profile.joinedAt)}`,
  ].join('\n');
};

const formatBookingMessage = (payload = {}) => {
  if (!payload?.booking) {
    return 'Активный букинг не найден.';
  }

  const booking = payload.booking;
  const route = booking.route || `${booking.departure || '----'} -> ${booking.arrival || '----'}`;
  return [
    'Текущий букинг',
    `Рейс: ${booking.flightNumber || booking.callsign || '—'}`,
    `Маршрут: ${route}`,
    `Борт: ${booking.aircraft || booking.aircraftLabel || '—'}`,
    `Статус: ${booking.status || 'active'}`,
    `ETD: ${booking.departureTime || booking.etd || '—'}`,
    `ETA: ${booking.eta || '—'}`,
    `Создан: ${formatDateTime(booking.createdAt)}`,
  ].join('\n');
};

const formatNewsMessage = (items = [], title = 'Лента') => {
  if (!Array.isArray(items) || items.length === 0) {
    return `${title}: пока пусто.`;
  }

  return [
    title,
    ...items.slice(0, 5).map((item, index) => {
      const itemTitle = String(item?.title || item?.name || `Запись ${index + 1}`).trim();
      const itemDate = formatDateTime(item?.date || item?.publishedAt || item?.createdAt);
      const itemSummary = compactText(item?.summary || item?.content || item?.description || '');
      return `${index + 1}. ${itemTitle}\n${itemDate}\n${itemSummary}`;
    }),
  ].join('\n\n');
};

const formatNotamMessage = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Активных NOTAM сейчас нет.';
  }

  return [
    'NOTAM',
    ...items.slice(0, 5).map((item, index) => {
      const title = String(item?.title || item?.subject || `NOTAM ${index + 1}`).trim();
      const priority = String(item?.priority || item?.type || 'info').trim();
      const summary = compactText(item?.content || item?.summary || item?.description || '');
      return `${index + 1}. [${priority}] ${title}\n${summary}`;
    }),
  ].join('\n\n');
};

const formatRosterMessage = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return 'Ростер сейчас пуст.';
  }

  return [
    'Ростер Nordwind',
    ...items.map((item, index) => {
      const name = String(item?.name || item?.username || `Pilot ${index + 1}`).trim();
      const rank = String(item?.rank || item?.rank_name || '').trim();
      const airline = String(item?.airline || item?.callsign || '').trim();
      return `${index + 1}. ${name}${rank ? ` | ${rank}` : ''}${airline ? ` | ${airline}` : ''}`;
    }),
  ].join('\n');
};

const formatWeatherMessage = (kind, payload = {}, icao) => {
  const entry = payload?.metar || payload?.taf || payload || {};
  const raw = String(entry?.raw || '').trim();
  if (!raw) {
    return `${kind.toUpperCase()} для ${icao} не найден.`;
  }
  const timestamp = entry?.observedAt || entry?.issueTime || entry?.observed || null;
  return [
    `${kind.toUpperCase()} ${entry?.station || icao}`,
    raw,
    timestamp ? formatDateTime(timestamp) : null,
  ].filter(Boolean).join('\n');
};

const handleProfile = async (actor) => {
  const payload = await ensureLinked(actor);
  return formatProfileMessage(payload);
};

const handleBooking = async (actor) => {
  const payload = await websiteRequest('/api/telegram-bot/booking', {
    method: 'POST',
    body: {
      chatId: actor?.chatId,
      telegramId: actor?.telegramId,
      actor,
    },
  });
  return formatBookingMessage(payload);
};

const handleNews = async () => {
  const payload = await websiteRequest('/api/public/news');
  return formatNewsMessage(payload?.news || [], 'Новости');
};

const handleNotams = async () => {
  const payload = await websiteRequest('/api/vamsys/notams');
  return formatNotamMessage(payload?.notams || payload?.items || payload?.data || []);
};

const handleEvents = async () => {
  const payload = await websiteRequest('/api/public/activities');
  return formatNewsMessage(payload?.activities || [], 'События');
};

const handleRoster = async (limit = defaultRosterLimit) => {
  const payload = await websiteRequest('/api/vamsys/pilots', {
    query: {
      'page[size]': Math.max(1, Math.min(20, Number(limit || defaultRosterLimit) || defaultRosterLimit)),
    },
  });
  return formatRosterMessage(Array.isArray(payload?.data) ? payload.data.slice(0, limit) : []);
};

const handleWeather = async (kind, icaoValue) => {
  const icao = String(icaoValue || '').trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao)) {
    return 'Нужен ICAO из 4 букв, например UUEE.';
  }

  const payload = await websiteRequest(`/api/weather/${kind}/${icao}`);
  return formatWeatherMessage(kind, payload, icao);
};

const handleSettings = async (actor) => {
  const payload = await loadPreferences(actor);
  const preferences = payload?.preferences || null;
  const channels = preferences?.notifications?.channels || {};
  const types = preferences?.notifications?.notificationTypes || {};

  return {
    text: [
      'Настройки Telegram',
      `Канал Telegram: ${Boolean(channels.telegram) ? 'включен' : 'выключен'}`,
      `Букинг: ${Boolean(types.booking) ? 'ON' : 'OFF'}`,
      `Claim: ${Boolean(types.claim) ? 'ON' : 'OFF'}`,
      `PIREP review: ${Boolean(types.review) ? 'ON' : 'OFF'}`,
      `Review started: ${Boolean(types.awaitingReview) ? 'ON' : 'OFF'}`,
      `Accepted: ${Boolean(types.accepted) ? 'ON' : 'OFF'}`,
      `Rejected: ${Boolean(types.rejected) ? 'ON' : 'OFF'}`,
      `Need reply: ${Boolean(types.needsReply) ? 'ON' : 'OFF'}`,
      `Invalidated: ${Boolean(types.invalidated) ? 'ON' : 'OFF'}`,
      `NOTAM: ${Boolean(types.notam) ? 'ON' : 'OFF'}`,
      `Events: ${Boolean(types.event) ? 'ON' : 'OFF'}`,
      `Badge: ${Boolean(types.badge) ? 'ON' : 'OFF'}`,
      `System: ${Boolean(types.system) ? 'ON' : 'OFF'}`,
    ].join('\n'),
    keyboard: buildSettingsKeyboard(payload),
  };
};

const formatTicketStatus = (statusValue) => {
  const status = String(statusValue || '').trim().toLowerCase();
  if (status === 'in_progress') {
    return 'в работе';
  }
  if (status === 'resolved') {
    return 'решён';
  }
  if (status === 'closed') {
    return 'закрыт';
  }
  return 'открыт';
};

const formatTicketPriority = (priorityValue) => {
  const priority = String(priorityValue || '').trim().toLowerCase();
  if (priority === 'high') {
    return 'high';
  }
  if (priority === 'low') {
    return 'low';
  }
  return 'normal';
};

const formatTicketListMessage = (payload = {}) => {
  const tickets = Array.isArray(payload?.tickets) ? payload.tickets : [];
  if (tickets.length === 0) {
    return [
      'Тикеты',
      'У вас пока нет тикетов.',
      'Нажмите «Новый тикет», чтобы отправить запрос в поддержку.',
    ].join('\n');
  }

  return [
    'Тикеты',
    `Всего: ${tickets.length} | Непрочитано: ${Number(payload?.unreadCount || 0) || 0}`,
    ...tickets.slice(0, 6).map((ticket) => [
      `#${ticket?.number || ticket?.id || '?'} • ${ticket?.subject || 'Без темы'}`,
      `${formatTicketStatus(ticket?.status)} | ${ticket?.categoryName || ticket?.categoryId || '—'} | ${formatDateTime(ticket?.updatedAt || ticket?.createdAt)}`,
    ].join('\n')),
  ].join('\n\n');
};

const formatTicketDetailMessage = (ticket = {}) => {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  return [
    `Тикет #${ticket?.number || ticket?.id || '?'}`,
    `Тема: ${ticket?.subject || 'Без темы'}`,
    `Статус: ${formatTicketStatus(ticket?.status)}`,
    `Категория: ${ticket?.categoryName || ticket?.categoryId || '—'}`,
    `Приоритет: ${formatTicketPriority(ticket?.priority)}`,
    `Обновлён: ${formatDateTime(ticket?.updatedAt || ticket?.createdAt)}`,
    messages.length > 0
      ? `Последние сообщения:\n${messages.slice(-3).map((message) => {
          const role = String(message?.authorRole || '').trim().toLowerCase() === 'staff' ? 'STAFF' : 'PILOT';
          return `[${role}] ${message?.authorName || message?.authorUsername || 'user'}\n${compactText(message?.content || '', 180)}`;
        }).join('\n\n')}`
      : 'Сообщений пока нет.',
  ].join('\n');
};

const buildTicketListKeyboard = (payload = {}) => {
  const tickets = Array.isArray(payload?.tickets) ? payload.tickets : [];
  return {
    reply_markup: {
      inline_keyboard: [
        ...tickets.slice(0, 6).map((ticket) => [
          createInlineButton(`#${ticket?.number || ticket?.id || '?'} ${compactText(ticket?.subject || 'Без темы', 26)}`, `ticket:view:${ticket?.id || ticket?.number}`),
        ]),
        [
          createInlineButton('Новый тикет', 'ticket:new'),
          createInlineButton('Обновить', 'ticket:list'),
        ],
        [createInlineButton('Меню', 'menu:home')],
      ],
    },
  };
};

const buildTicketDetailKeyboard = (ticket = {}) => {
  const isClosed = String(ticket?.status || '').trim().toLowerCase() === 'closed';
  return {
    reply_markup: {
      inline_keyboard: [
        [
          createInlineButton('Ответить', `ticket:reply:${ticket?.id || ticket?.number}`),
          createInlineButton(isClosed ? 'Переоткрыть' : 'Закрыть', `ticket:status:${ticket?.id || ticket?.number}:${isClosed ? 'open' : 'closed'}`),
        ],
        [
          createInlineButton('К списку', 'ticket:list'),
          createInlineButton('Меню', 'menu:home'),
        ],
      ],
    },
  };
};

const buildTicketCategoryKeyboard = (categories = []) => ({
  reply_markup: {
    inline_keyboard: [
      ...categories.slice(0, 12).map((category) => [
        createInlineButton(category?.name || category?.id || 'Category', `ticket:category:${category?.id}`),
      ]),
      [
        createInlineButton('К тикетам', 'ticket:list'),
        createInlineButton('Меню', 'menu:home'),
      ],
    ],
  },
});

const loadTicketMeta = async () => {
  await ensureRuntimeConfig().catch(() => null);
  if (runtimeConfigCache.ticketConfig?.categories) {
    return {
      enabled: runtimeConfigCache.ticketConfig?.enabled !== false,
      categories: Array.isArray(runtimeConfigCache.ticketConfig?.categories) ? runtimeConfigCache.ticketConfig.categories : [],
    };
  }

  return websiteRequest('/api/telegram-bot/tickets/meta');
};

const loadTickets = async (actor) =>
  websiteRequest('/api/telegram-bot/tickets', {
    query: {
      chatId: actor?.chatId,
      telegramId: actor?.telegramId,
    },
  });

const loadTicketDetail = async (actor, ticketId) =>
  websiteRequest(`/api/telegram-bot/tickets/${encodeURIComponent(String(ticketId || '').trim())}`, {
    query: {
      chatId: actor?.chatId,
      telegramId: actor?.telegramId,
    },
  });

const handleTickets = async (actor) => {
  const payload = await loadTickets(actor);
  return {
    text: formatTicketListMessage(payload),
    keyboard: buildTicketListKeyboard(payload),
  };
};

const handleTicketDetail = async (actor, ticketId) => {
  const payload = await loadTicketDetail(actor, ticketId);
  return {
    text: formatTicketDetailMessage(payload?.ticket || {}),
    keyboard: buildTicketDetailKeyboard(payload?.ticket || {}),
  };
};

const startTicketCreate = async (chatId) => {
  const payload = await loadTicketMeta();
  const categories = Array.isArray(payload?.categories) ? payload.categories : [];
  if (payload?.enabled === false) {
    await sendMenu(chatId, 'Система тикетов временно отключена.');
    return;
  }
  if (categories.length === 0) {
    await sendMenu(chatId, 'Для Telegram пока не настроены категории тикетов.');
    return;
  }

  await bot.sendMessage(chatId, 'Выберите категорию тикета.', buildTicketCategoryKeyboard(categories));
};

const normalizePirepStatus = (statusValue) => String(statusValue || '').trim().toLowerCase();

const isAcceptedPirepStatus = (statusValue) => {
  const status = normalizePirepStatus(statusValue);
  return status === 'accepted' || status === 'auto_accepted' || status === 'approved' || status === 'completed';
};

const isRejectedPirepStatus = (statusValue) => normalizePirepStatus(statusValue).includes('reject');

const isInvalidatedPirepStatus = (statusValue) => normalizePirepStatus(statusValue).includes('invalid');

const isPirepReviewStatus = (statusValue) => {
  const status = normalizePirepStatus(statusValue);
  return Boolean(status && (status === 'review' || status === 'pending_review' || status === 'in_review' || status === 'under_review' || status.includes('review')));
};

const isPirepReviewStartedStatus = (statusValue) => {
  const status = normalizePirepStatus(statusValue);
  return status === 'in_review' || status === 'under_review';
};

const resolvePirepNotificationEvent = (previousState, pirep = {}) => {
  const nextStatus = normalizePirepStatus(pirep?.status);
  const previousStatus = normalizePirepStatus(previousState?.status);
  const nextUpdatedAt = String(pirep?.updatedAt || pirep?.createdAt || '').trim();
  const previousUpdatedAt = String(previousState?.updatedAt || '').trim();
  const nextNeedReply = Boolean(pirep?.needReply);
  const previousNeedReply = Boolean(previousState?.needReply);

  if (isAcceptedPirepStatus(nextStatus)) {
    return isAcceptedPirepStatus(previousStatus) ? null : 'accepted';
  }
  if (isRejectedPirepStatus(nextStatus)) {
    return isRejectedPirepStatus(previousStatus) ? null : 'rejected';
  }
  if (isInvalidatedPirepStatus(nextStatus)) {
    return isInvalidatedPirepStatus(previousStatus) ? null : 'invalidated';
  }
  if (nextNeedReply && (!previousNeedReply || previousUpdatedAt !== nextUpdatedAt)) {
    return 'needsReply';
  }
  if (!isPirepReviewStatus(nextStatus)) {
    return null;
  }
  if (!isPirepReviewStartedStatus(previousStatus) && isPirepReviewStartedStatus(nextStatus)) {
    return 'awaitingReview';
  }
  if (!previousStatus || !isPirepReviewStatus(previousStatus)) {
    return 'review';
  }

  return null;
};

const canSendPirepNotification = (pilot = {}, eventKey) => {
  const types = pilot?.preferences?.notifications?.notificationTypes || {};
  if (eventKey === 'awaitingReview') {
    return Boolean(types.awaitingReview || types.review);
  }
  if (eventKey === 'review') {
    return Boolean(types.review || types.awaitingReview);
  }
  return Boolean(types?.[eventKey]);
};

const formatPirepNotificationText = (pirep = {}, eventKey = 'review') => {
  const route = pirep?.route || `${pirep?.departure || '----'} -> ${pirep?.arrival || '----'}`;
  const title = eventKey === 'accepted'
    ? 'PIREP принят'
    : eventKey === 'rejected'
      ? 'PIREP отклонён'
      : eventKey === 'invalidated'
        ? 'PIREP invalidated'
        : eventKey === 'needsReply'
          ? 'PIREP требует ответа'
          : eventKey === 'awaitingReview'
            ? 'PIREP взят в review'
            : 'PIREP обновлён';

  return [
    title,
    `Рейс: ${pirep?.flightNumber || pirep?.callsign || `PIREP ${pirep?.id || ''}`}`,
    `Статус: ${pirep?.status || eventKey}`,
    `Маршрут: ${route}`,
    `Обновлено: ${formatDateTime(pirep?.updatedAt || pirep?.createdAt)}`,
  ].join('\n');
};

const sendCommandError = async (chatId, error) => {
  const status = Number(error?.status || 0) || 0;
  if (status === 404 && String(error?.payload?.error || '') === 'not_linked') {
    await sendMenu(
      chatId,
      'Telegram ещё не привязан. В личном кабинете сгенерируйте код и отправьте сюда /link CODE.',
    );
    return;
  }

  await sendMenu(chatId, `Не удалось выполнить команду: ${String(error?.message || 'unknown_error')}`);
};

const processMenuAction = async (chatId, actor, action) => {
  if (action === 'home') {
    await sendMenu(chatId, 'Главное меню Nordwind Telegram Bot');
    return;
  }
  if (action === 'profile') {
    await sendMenu(chatId, await handleProfile(actor));
    return;
  }
  if (action === 'booking') {
    await sendMenu(chatId, await handleBooking(actor));
    return;
  }
  if (action === 'tickets') {
    const payload = await handleTickets(actor);
    await bot.sendMessage(chatId, payload.text, payload.keyboard);
    return;
  }
  if (action === 'news') {
    await sendMenu(chatId, await handleNews());
    return;
  }
  if (action === 'notams') {
    await sendMenu(chatId, await handleNotams());
    return;
  }
  if (action === 'events') {
    await sendMenu(chatId, await handleEvents());
    return;
  }
  if (action === 'roster') {
    await sendMenu(chatId, await handleRoster());
    return;
  }
  if (action === 'metar_prompt') {
    inputState.set(String(chatId), { type: 'metar' });
    await sendMenu(chatId, 'Отправьте ICAO аэропорта одним сообщением, например UUEE.');
    return;
  }
  if (action === 'taf_prompt') {
    inputState.set(String(chatId), { type: 'taf' });
    await sendMenu(chatId, 'Отправьте ICAO аэропорта одним сообщением, например UUEE.');
    return;
  }
  if (action === 'settings') {
    const settingsPayload = await handleSettings(actor);
    await bot.sendMessage(chatId, settingsPayload.text, settingsPayload.keyboard);
    return;
  }
  if (action === 'link_help') {
    await sendMenu(
      chatId,
      'Привязка Telegram\n1. В кабинете пилота откройте Настройки\n2. Сгенерируйте Telegram-код\n3. Отправьте сюда /link CODE',
    );
  }
};

const processTicketAction = async (chatId, actor, data) => {
  if (data === 'ticket:list') {
    const payload = await handleTickets(actor);
    await bot.sendMessage(chatId, payload.text, payload.keyboard);
    return;
  }
  if (data === 'ticket:new') {
    await startTicketCreate(chatId);
    return;
  }

  const parts = String(data || '').split(':');
  if (parts[1] === 'category') {
    const categoryId = String(parts[2] || '').trim();
    if (!categoryId) {
      await sendMenu(chatId, 'Не удалось определить категорию тикета.');
      return;
    }

    inputState.set(String(chatId), {
      type: 'ticket:create',
      categoryId,
    });
    await sendMenu(
      chatId,
      'Отправьте одним сообщением тему на первой строке и описание ниже.\n\nПример:\nПроблема с букингом\nНе могу открыть бронь после смены борта.',
    );
    return;
  }
  if (parts[1] === 'view') {
    const payload = await handleTicketDetail(actor, parts[2]);
    await bot.sendMessage(chatId, payload.text, payload.keyboard);
    return;
  }
  if (parts[1] === 'reply') {
    const ticketId = String(parts[2] || '').trim();
    inputState.set(String(chatId), {
      type: 'ticket:reply',
      ticketId,
    });
    await sendMenu(chatId, `Отправьте ответ для тикета #${ticketId} одним сообщением.`);
    return;
  }
  if (parts[1] === 'status') {
    const ticketId = String(parts[2] || '').trim();
    const status = String(parts[3] || 'open').trim().toLowerCase();
    await websiteRequest(`/api/telegram-bot/tickets/${encodeURIComponent(ticketId)}/status`, {
      method: 'POST',
      body: {
        chatId: actor?.chatId,
        telegramId: actor?.telegramId,
        actor,
        status,
      },
    });
    const payload = await handleTicketDetail(actor, ticketId);
    await bot.sendMessage(chatId, payload.text, payload.keyboard);
  }
};

const syncAnnouncementDeliveries = async () => {
  const targetsPayload = await websiteRequest('/api/telegram-bot/linked-pilots');
  const linkedPilots = Array.isArray(targetsPayload?.linkedPilots) ? targetsPayload.linkedPilots : [];
  if (linkedPilots.length === 0) {
    return;
  }

  const [newsPayload, notamPayload, eventsPayload] = await Promise.all([
    websiteRequest('/api/public/news').catch(() => ({ news: [] })),
    websiteRequest('/api/vamsys/notams').catch(() => ({ notams: [] })),
    websiteRequest('/api/public/activities').catch(() => ({ activities: [] })),
  ]);

  const feeds = [
    {
      key: 'news',
      items: Array.isArray(newsPayload?.news) ? newsPayload.news : [],
      typeKey: 'system',
      formatter: (item) => `Новая новость\n${item?.title || 'Без заголовка'}\n${compactText(item?.summary || item?.content || '')}`,
    },
    {
      key: 'notams',
      items: Array.isArray(notamPayload?.notams || notamPayload?.data) ? (notamPayload.notams || notamPayload.data) : [],
      typeKey: 'notam',
      formatter: (item) => `Новый NOTAM\n${item?.title || 'Без заголовка'}\n${compactText(item?.content || item?.summary || '')}`,
    },
    {
      key: 'events',
      items: Array.isArray(eventsPayload?.activities) ? eventsPayload.activities : [],
      typeKey: 'event',
      formatter: (item) => `Новое событие\n${item?.title || 'Без заголовка'}\n${compactText(item?.summary || item?.content || '')}`,
    },
  ];

  for (const feed of feeds) {
    const seen = knownAnnouncementIds[feed.key];
    for (const item of feed.items.slice(0, 10)) {
      const itemId = String(item?.id || item?.slug || item?.title || '').trim();
      if (!itemId) {
        continue;
      }

      const isKnown = seen.has(itemId);
      seen.add(itemId);
      if (!announcementsPrimed || isKnown) {
        continue;
      }

      await Promise.all(
        linkedPilots
          .filter((pilot) => Boolean(pilot?.chatId))
          .filter((pilot) => Boolean(pilot?.preferences?.notifications?.channels?.telegram))
          .filter((pilot) => Boolean(pilot?.preferences?.notifications?.notificationTypes?.[feed.typeKey]))
          .map((pilot) => bot.sendMessage(pilot.chatId, feed.formatter(item)).catch(() => null)),
      );
    }
  }

  announcementsPrimed = true;
};

const mapPirepStateKey = (pirep = {}) => {
  return resolvePirepNotificationEvent(null, pirep) || normalizePirepStatus(pirep?.status) || 'review';
};

const syncPirepDeliveries = async () => {
  const targetsPayload = await websiteRequest('/api/telegram-bot/linked-pilots');
  const linkedPilots = Array.isArray(targetsPayload?.linkedPilots) ? targetsPayload.linkedPilots : [];

  for (const pilot of linkedPilots) {
    if (!pilot?.chatId || !pilot?.preferences?.notifications?.channels?.telegram) {
      continue;
    }

    const pirepPayload = await websiteRequest('/api/telegram-bot/pireps', {
      query: {
        pilotId: pilot.pilotId,
        limit: 5,
      },
    }).catch(() => ({ pireps: [] }));
    const pireps = Array.isArray(pirepPayload?.pireps) ? pirepPayload.pireps : [];

    for (const pirep of pireps) {
      const pirepId = Number(pirep?.id || 0) || 0;
      if (pirepId <= 0) {
        continue;
      }

      const cacheKey = `${pilot.pilotId}:${pirepId}`;
      const previous = knownPirepStates.get(cacheKey);
      const nextState = {
        status: normalizePirepStatus(pirep?.status),
        updatedAt: String(pirep?.updatedAt || pirep?.createdAt || '').trim(),
        needReply: Boolean(pirep?.needReply),
      };
      knownPirepStates.set(cacheKey, nextState);

      if (!pirepPrimed) {
        continue;
      }
      const eventKey = resolvePirepNotificationEvent(previous, pirep);
      if (!eventKey) {
        continue;
      }
      if (!canSendPirepNotification(pilot, eventKey)) {
        continue;
      }

      await bot.sendMessage(pilot.chatId, formatPirepNotificationText(pirep, eventKey)).catch(() => null);
    }
  }

  pirepPrimed = true;
};

bot.onText(/^\/start(?:@\w+)?$/i, async (msg) => {
  if (!(await ensureCommandAllowed(String(msg.chat.id), 'start'))) {
    return;
  }
  await sendMenu(String(msg.chat.id), 'Nordwind Telegram Bot\nИспользуйте кнопки меню или команды.');
});

bot.onText(/^\/menu(?:@\w+)?$/i, async (msg) => {
  if (!(await ensureCommandAllowed(String(msg.chat.id), 'menu'))) {
    return;
  }
  await sendMenu(String(msg.chat.id), 'Главное меню Nordwind Telegram Bot');
});

bot.onText(/^\/help(?:@\w+)?$/i, async (msg) => {
  if (!(await ensureCommandAllowed(String(msg.chat.id), 'help'))) {
    return;
  }
  const helpText = [
    'Команды:',
    ...buildAvailableTelegramCommands().map((item) => `/${item.command} - ${item.description}`),
  ].join('\n');
  await sendMenu(String(msg.chat.id), helpText);
});

bot.onText(/^\/ping(?:@\w+)?$/i, async (msg) => {
  const chatId = String(msg.chat.id);
  if (!(await ensureCommandAllowed(chatId, 'ping'))) {
    return;
  }
  await sendMenu(chatId, 'Telegram bot online.');
});

bot.onText(/^\/link(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = String(msg.chat.id);
  if (!(await ensureCommandAllowed(chatId, 'link'))) {
    return;
  }
  const actor = buildActorFromMessage(msg);
  const code = String(match?.[1] || '').trim();
  if (!code) {
    await sendMenu(chatId, 'Отправьте команду в формате /link CODE');
    return;
  }

  try {
    const payload = await websiteRequest('/api/telegram-bot/link', {
      method: 'POST',
      body: {
        code,
        actor,
        chatId: actor.chatId,
        telegramChatId: actor.chatId,
      },
    });
    const pilot = payload?.pilot || {};
    await sendMenu(chatId, `Telegram привязан к пилоту ${pilot?.name || pilot?.username || pilot?.id || 'pilot'}.`);
  } catch (error) {
    await sendCommandError(chatId, error);
  }
});

bot.onText(/^\/profile(?:@\w+)?$/i, async (msg) => {
  const chatId = String(msg.chat.id);
  if (!(await ensureCommandAllowed(chatId, 'profile'))) {
    return;
  }
  try {
    await sendMenu(chatId, await handleProfile(buildActorFromMessage(msg)));
  } catch (error) {
    await sendCommandError(chatId, error);
  }
});

bot.onText(/^\/booking(?:@\w+)?$/i, async (msg) => {
  const chatId = String(msg.chat.id);
  if (!(await ensureCommandAllowed(chatId, 'booking'))) {
    return;
  }
  try {
    await sendMenu(chatId, await handleBooking(buildActorFromMessage(msg)));
  } catch (error) {
    await sendCommandError(chatId, error);
  }
});

bot.onText(/^\/ticket(?:@\w+)?(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = String(msg.chat.id);
  if (!(await ensureCommandAllowed(chatId, 'ticket'))) {
    return;
  }

  const actor = buildActorFromMessage(msg);
  const arg = String(match?.[1] || '').trim();
  try {
    if (!arg) {
      const payload = await handleTickets(actor);
      await bot.sendMessage(chatId, payload.text, payload.keyboard);
      return;
    }
    if (arg.toLowerCase() === 'new') {
      await startTicketCreate(chatId);
      return;
    }
    const payload = await handleTicketDetail(actor, arg.replace(/^#/, ''));
    await bot.sendMessage(chatId, payload.text, payload.keyboard);
  } catch (error) {
    await sendCommandError(chatId, error);
  }
});

bot.onText(/^\/news(?:@\w+)?$/i, async (msg) => {
  if (!(await ensureCommandAllowed(String(msg.chat.id), 'news'))) {
    return;
  }
  await sendMenu(String(msg.chat.id), await handleNews().catch((error) => `Не удалось загрузить новости: ${String(error?.message || error)}`));
});

bot.onText(/^\/notams?(?:@\w+)?$/i, async (msg) => {
  if (!(await ensureCommandAllowed(String(msg.chat.id), 'notams'))) {
    return;
  }
  await sendMenu(String(msg.chat.id), await handleNotams().catch((error) => `Не удалось загрузить NOTAM: ${String(error?.message || error)}`));
});

bot.onText(/^\/events(?:@\w+)?$/i, async (msg) => {
  if (!(await ensureCommandAllowed(String(msg.chat.id), 'events'))) {
    return;
  }
  await sendMenu(String(msg.chat.id), await handleEvents().catch((error) => `Не удалось загрузить события: ${String(error?.message || error)}`));
});

bot.onText(/^\/roster(?:@\w+)?(?:\s+(\d+))?$/i, async (msg, match) => {
  if (!(await ensureCommandAllowed(String(msg.chat.id), 'roster'))) {
    return;
  }
  const requestedLimit = Number(match?.[1] || defaultRosterLimit) || defaultRosterLimit;
  await sendMenu(String(msg.chat.id), await handleRoster(requestedLimit).catch((error) => `Не удалось загрузить ростер: ${String(error?.message || error)}`));
});

bot.onText(/^\/(metar|taf)(?:@\w+)?(?:\s+([A-Za-z]{4}))?$/i, async (msg, match) => {
  const kind = String(match?.[1] || '').trim().toLowerCase();
  if (!(await ensureCommandAllowed(String(msg.chat.id), kind))) {
    return;
  }
  const icao = String(match?.[2] || '').trim();
  if (!icao) {
    await sendMenu(String(msg.chat.id), `Используйте /${kind} ICAO, например /${kind} UUEE`);
    return;
  }
  await sendMenu(String(msg.chat.id), await handleWeather(kind, icao).catch((error) => `Не удалось загрузить ${kind.toUpperCase()}: ${String(error?.message || error)}`));
});

bot.onText(/^\/settings(?:@\w+)?$/i, async (msg) => {
  const chatId = String(msg.chat.id);
  if (!(await ensureCommandAllowed(chatId, 'settings'))) {
    return;
  }
  try {
    const payload = await handleSettings(buildActorFromMessage(msg));
    await bot.sendMessage(chatId, payload.text, payload.keyboard);
  } catch (error) {
    await sendCommandError(chatId, error);
  }
});

bot.on('callback_query', async (query) => {
  const chatId = String(query?.message?.chat?.id || '');
  const data = String(query?.data || '').trim();
  const actor = buildActorFromCallback(query);

  try {
    if (data.startsWith('menu:')) {
      const menuAction = data.slice(5);
      const commandKey = menuAction === 'home'
        ? 'menu'
        : menuAction === 'metar_prompt'
          ? 'metar'
          : menuAction === 'taf_prompt'
            ? 'taf'
            : menuAction === 'tickets'
              ? 'ticket'
              : menuAction;
      if (commandKey && ['profile', 'booking', 'news', 'notams', 'events', 'roster', 'metar', 'taf', 'settings', 'ticket', 'menu', 'link'].includes(commandKey)) {
        if (!(await ensureCommandAllowed(chatId, commandKey === 'ticket' ? 'ticket' : commandKey))) {
          await bot.answerCallbackQuery(query.id).catch(() => null);
          return;
        }
      }
      await processMenuAction(chatId, actor, data.slice(5));
    } else if (data.startsWith('ticket:')) {
      if (!(await ensureCommandAllowed(chatId, 'ticket'))) {
        await bot.answerCallbackQuery(query.id).catch(() => null);
        return;
      }
      await processTicketAction(chatId, actor, data);
    } else if (data.startsWith('settings:')) {
      if (!(await ensureCommandAllowed(chatId, 'settings'))) {
        await bot.answerCallbackQuery(query.id).catch(() => null);
        return;
      }
      const [, bucket, key] = data.split(':');
      await togglePreference(actor, bucket, key);
      const payload = await handleSettings(actor);
      await bot.sendMessage(chatId, payload.text, payload.keyboard);
    }
    await bot.answerCallbackQuery(query.id).catch(() => null);
  } catch (error) {
    await bot.answerCallbackQuery(query.id, {
      text: String(error?.message || 'Action failed'),
      show_alert: true,
    }).catch(() => null);
  }
});

bot.on('message', async (msg) => {
  if (!msg?.text || msg.text.startsWith('/')) {
    return;
  }

  const chatId = String(msg.chat.id);
  const pending = inputState.get(chatId);
  if (!pending) {
    return;
  }

  inputState.delete(chatId);
  if (pending.type !== 'metar' && pending.type !== 'taf') {
    if (pending.type === 'ticket:create') {
      const lines = String(msg.text || '').split(/\r?\n/).map((line) => line.trimEnd());
      const subject = String(lines.shift() || '').trim();
      const content = lines.join('\n').trim();
      if (!subject || !content) {
        inputState.set(chatId, pending);
        await sendMenu(chatId, 'Нужны тема на первой строке и описание ниже. Попробуйте ещё раз.');
        return;
      }

      try {
        const actor = buildActorFromMessage(msg);
        const payload = await websiteRequest('/api/telegram-bot/tickets', {
          method: 'POST',
          body: {
            chatId: actor?.chatId,
            telegramId: actor?.telegramId,
            actor,
            subject,
            content,
            categoryId: pending.categoryId,
          },
        });
        const ticketPayload = {
          text: formatTicketDetailMessage(payload?.ticket || {}),
          keyboard: buildTicketDetailKeyboard(payload?.ticket || {}),
        };
        await bot.sendMessage(chatId, ticketPayload.text, ticketPayload.keyboard);
      } catch (error) {
        await sendCommandError(chatId, error);
      }
      return;
    }

    if (pending.type === 'ticket:reply') {
      try {
        const actor = buildActorFromMessage(msg);
        await websiteRequest(`/api/telegram-bot/tickets/${encodeURIComponent(String(pending.ticketId || '').trim())}/messages`, {
          method: 'POST',
          body: {
            chatId: actor?.chatId,
            telegramId: actor?.telegramId,
            actor,
            content: msg.text,
          },
        });
        const payload = await handleTicketDetail(actor, pending.ticketId);
        await bot.sendMessage(chatId, payload.text, payload.keyboard);
      } catch (error) {
        await sendCommandError(chatId, error);
      }
    }
    return;
  }

  try {
    await sendMenu(chatId, await handleWeather(pending.type, msg.text));
  } catch (error) {
    await sendCommandError(chatId, error);
  }
});

bot.on('polling_error', (error) => {
  console.error('[telegram-bot] polling_error', error);
});

await ensureRuntimeConfig({ force: true }).catch(() => null);
await syncTelegramCommands().catch(() => null);
console.log(`[telegram-bot] started with websiteBaseUrl=${websiteBaseUrl}`);

setInterval(() => {
  void syncAnnouncementDeliveries().catch((error) => {
    console.error('[telegram-bot] announcement_sync_failed', error);
  });
}, announcementIntervalMs);

setInterval(() => {
  void syncPirepDeliveries().catch((error) => {
    console.error('[telegram-bot] pirep_sync_failed', error);
  });
}, pirepIntervalMs);

void syncAnnouncementDeliveries().catch((error) => {
  console.error('[telegram-bot] initial_announcement_sync_failed', error);
});

void syncPirepDeliveries().catch((error) => {
  console.error('[telegram-bot] initial_pirep_sync_failed', error);
});