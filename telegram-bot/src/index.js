import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const token = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const websiteBaseUrl = String(process.env.WEBSITE_BASE_URL || "http://127.0.0.1:8787").trim().replace(/\/$/, "");
const botConfigToken = String(process.env.TELEGRAM_BOT_CONFIG_TOKEN || "").trim();
const pollingIntervalMs = Math.max(500, Number(process.env.TELEGRAM_POLLING_INTERVAL_MS || 1500) || 1500);
const defaultLanguage = String(process.env.TELEGRAM_DEFAULT_LANGUAGE || "ru").trim().toLowerCase() || "ru";

if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN in telegram-bot/.env");
  process.exit(1);
}

const telegramApiBase = `https://api.telegram.org/bot${token}`;

let updateOffset = 0;
let polling = false;
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const setCommands = async () => {
  const commands = [
    { command: "start", description: "Start the bot" },
    { command: "help", description: "List available commands" },
    { command: "ping", description: "Check bot status" },
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
    "/news [count]",
    "/notams [count]",
    `/ticket category | subject | message`,
    "Пример:",
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
