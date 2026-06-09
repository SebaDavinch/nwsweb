import "dotenv/config";

const BACKEND_URL = String(process.env.VK_BOT_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
const CONFIG_TOKEN = String(process.env.VK_BOT_CONFIG_TOKEN || "").trim();
const RETRY_DELAY_MS = Math.max(1000, Number(process.env.VK_BOT_POLL_DELAY_MS || 5000) || 5000);

const logVkRuntime = (level, event, details = {}) => {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };
  const writer = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  writer("[vk-bot-runtime]", JSON.stringify(payload));
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const resolveWebsiteBaseUrl = () => String(process.env.WEBSITE_BASE_URL || process.env.PUBLIC_WEBSITE_URL || "").trim().replace(/\/$/, "");

const resolveAbsoluteUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (!raw.startsWith("/")) {
    return "";
  }
  const base = resolveWebsiteBaseUrl();
  return base ? `${base}${raw}` : "";
};

const renderUserTemplate = (template = "", context = {}) =>
  String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = context?.[key];
    return value == null ? "" : String(value);
  });

const fetchConfig = async () => {
  if (!CONFIG_TOKEN) {
    logVkRuntime("error", "config_token_missing", {});
    throw new Error("VK_BOT_CONFIG_TOKEN is required");
  }

  const startedAt = Date.now();
  logVkRuntime("info", "config_fetch_start", {
    backendUrl: BACKEND_URL,
  });

  const response = await fetch(`${BACKEND_URL}/api/vk-bot/config`, {
    headers: {
      "x-vk-bot-token": CONFIG_TOKEN,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    logVkRuntime("error", "config_fetch_failed", {
      status: response.status,
      durationMs: Date.now() - startedAt,
      error: String(payload?.error || `Failed to load VK bot config (${response.status})`),
    });
    throw new Error(String(payload?.error || `Failed to load VK bot config (${response.status})`));
  }

  logVkRuntime("info", "config_fetch_success", {
    durationMs: Date.now() - startedAt,
    enabled: payload?.botSettings?.enabled !== false,
    hasAccessToken: Boolean(String(payload?.botSettings?.accessToken || "").trim()),
  });
  return payload?.botSettings || null;
};

const vkApi = async (method, accessToken, params = {}) => {
  const startedAt = Date.now();
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }
    body.set(key, String(value));
  });
  body.set("access_token", accessToken);
  body.set("v", "5.199");

  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    logVkRuntime("error", "vk_api_failed", {
      method,
      status: response.status,
      durationMs: Date.now() - startedAt,
      message: String(payload?.error?.error_msg || `VK API error on ${method}`),
      code: payload?.error?.error_code || null,
    });
    throw new Error(String(payload?.error?.error_msg || `VK API error on ${method}`));
  }
  logVkRuntime("debug", "vk_api_success", {
    method,
    status: response.status,
    durationMs: Date.now() - startedAt,
  });
  return payload?.response || null;
};

const buildMenuText = (settings) => {
  const items = Array.isArray(settings?.menuItems) ? settings.menuItems.filter((item) => item?.enabled !== false) : [];
  const lines = [settings?.menuTitle || "Меню сообщества"];
  for (const item of items) {
    if (item.action === "faq") {
      lines.push(`- ${item.label} -> FAQ:${item.value}`);
    } else if (item.action === "url") {
      lines.push(`- ${item.label} -> ${item.value}`);
    } else {
      lines.push(`- ${item.label}`);
    }
  }
  return lines.join("\n");
};

const buildFaqResponse = (settings, text) => {
  const faqItems = Array.isArray(settings?.faqItems) ? settings.faqItems.filter((item) => item?.enabled !== false) : [];
  const normalized = normalizeText(text);

  for (const item of faqItems) {
    const keywords = Array.isArray(item.keywords) ? item.keywords.map(normalizeText).filter(Boolean) : [];
    const matchesQuestion = normalized.includes(normalizeText(item.question));
    const matchesKeyword = keywords.some((keyword) => normalized.includes(keyword));
    if (matchesQuestion || matchesKeyword) {
      return item.answer || settings?.fallbackMessage || "Ответ пока не настроен.";
    }
  }

  return null;
};

const matchReplyTemplate = (template, normalizedText) => {
  const mode = normalizeText(template?.matchMode || "contains") || "contains";
  const trigger = String(template?.trigger || "").trim();
  if (!trigger) {
    return false;
  }

  if (mode === "exact") {
    return normalizedText === normalizeText(trigger);
  }
  if (mode === "regex") {
    try {
      return new RegExp(trigger, "i").test(normalizedText);
    } catch {
      return false;
    }
  }
  return normalizedText.includes(normalizeText(trigger));
};

const buildReplyTemplateResponse = (settings, text, message) => {
  const templates = Array.isArray(settings?.replyTemplates)
    ? [...settings.replyTemplates].filter((item) => item?.enabled !== false)
    : [];
  templates.sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0));

  const normalizedText = normalizeText(text);
  const websiteUrl = resolveWebsiteBaseUrl() || "";
  for (const template of templates) {
    if (!matchReplyTemplate(template, normalizedText)) {
      continue;
    }

    const response = renderUserTemplate(template?.response || "", {
      message: text,
      peerId: Number(message?.peer_id || 0) || "",
      userId: Number(message?.from_id || 0) || "",
      websiteUrl,
    }).trim();

    if (response) {
      return response;
    }
  }

  return null;
};

const buildDialogKeyboard = (settings) => {
  const dialogMenu = settings?.dialogMenu && typeof settings.dialogMenu === "object" ? settings.dialogMenu : null;
  if (!dialogMenu?.enabled) {
    return null;
  }

  const buttons = Array.isArray(dialogMenu?.buttons)
    ? [...dialogMenu.buttons].filter((item) => item?.enabled !== false)
    : [];
  buttons.sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0));
  if (buttons.length === 0) {
    return null;
  }

  const rows = [];
  const rowSize = 3;
  for (let index = 0; index < buttons.length; index += rowSize) {
    const chunk = buttons.slice(index, index + rowSize);
    const row = chunk
      .map((button) => {
        const label = String(button?.label || "").trim();
        if (!label) {
          return null;
        }
        const type = normalizeText(button?.type || "text") || "text";
        if (type === "url") {
          const link = resolveAbsoluteUrl(button?.value || "");
          if (!link) {
            return null;
          }
          return {
            action: {
              type: "open_link",
              label,
              link,
            },
          };
        }

        return {
          action: {
            type: "text",
            label,
            payload: JSON.stringify({
              action: type,
              value: String(button?.value || ""),
              id: String(button?.id || ""),
            }),
          },
        };
      })
      .filter(Boolean);
    if (row.length > 0) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return null;
  }

  return JSON.stringify({
    one_time: Boolean(dialogMenu?.oneTime),
    inline: Boolean(dialogMenu?.inline),
    buttons: rows,
  });
};

const sendMessage = async ({ accessToken, peerId, message, keyboard = null }) => {
  await vkApi("messages.send", accessToken, {
    peer_id: peerId,
    random_id: Date.now(),
    message,
    keyboard,
  });
};

const handleLongPoll = async (settings) => {
  const accessToken = String(settings?.accessToken || "").trim();
  const groupId = Math.abs(Number(String(settings?.groupId || "").replace(/[^\d-]/g, "")) || 0);
  if (!accessToken || groupId <= 0) {
    logVkRuntime("error", "longpoll_config_invalid", {
      hasAccessToken: Boolean(accessToken),
      groupId,
    });
    throw new Error("VK bot is missing accessToken or groupId");
  }

  logVkRuntime("info", "longpoll_start", {
    groupId,
  });
  const server = await vkApi("messages.getLongPollServer", accessToken, { group_id: groupId });
  let ts = server.ts;

  while (true) {
    const longPollUrl = new URL(server.server);
    longPollUrl.searchParams.set("act", "a_check");
    longPollUrl.searchParams.set("key", server.key);
    longPollUrl.searchParams.set("ts", String(ts));
    longPollUrl.searchParams.set("wait", String(Math.max(1, Number(settings?.longPollWaitSeconds || 25) || 25)));
    longPollUrl.searchParams.set("mode", "2");
    longPollUrl.searchParams.set("version", "3");

    const response = await fetch(longPollUrl.toString());
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.failed) {
      logVkRuntime("warn", "longpoll_failed", {
        status: response.status,
        failedCode: payload?.failed || null,
      });
      throw new Error("Long poll session expired");
    }

    ts = payload.ts || ts;
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    if (updates.length > 0) {
      logVkRuntime("debug", "longpoll_updates_received", {
        count: updates.length,
      });
    }

    for (const update of updates) {
      if (update?.type !== "message_new") {
        continue;
      }

      const message = update?.object?.message || {};
      const peerId = Number(message?.peer_id || 0);
      const text = String(message?.text || "").trim();
      if (peerId <= 0) {
        continue;
      }

      const keyboard = buildDialogKeyboard(settings);
      const payloadRaw = String(message?.payload || "").trim();
      let payload = null;
      if (payloadRaw) {
        try {
          payload = JSON.parse(payloadRaw);
        } catch {
          payload = null;
        }
      }

      logVkRuntime("info", "incoming_message", {
        peerId,
        textPreview: text.slice(0, 80),
        hasPayload: Boolean(payload),
      });

      const payloadAction = normalizeText(payload?.action || "");
      if (payloadAction === "menu") {
        const reply = settings?.menuEnabled === false
          ? (settings?.autoMessages?.menu || settings?.welcomeMessage || "Привет!")
          : `${settings?.autoMessages?.menu || settings?.welcomeMessage || "Привет!"}\n\n${buildMenuText(settings)}`;
        await sendMessage({ accessToken, peerId, message: reply, keyboard });
        logVkRuntime("info", "reply_sent", { type: "menu_payload", peerId });
        continue;
      }

      if (payloadAction === "faq") {
        const faqId = normalizeText(payload?.value || "");
        const faqItems = Array.isArray(settings?.faqItems) ? settings.faqItems.filter((item) => item?.enabled !== false) : [];
        const selected = faqItems.find((item) => normalizeText(item?.id || "") === faqId);
        if (selected?.answer) {
          await sendMessage({ accessToken, peerId, message: selected.answer, keyboard });
          logVkRuntime("info", "reply_sent", { type: "faq_payload", peerId, faqId });
          continue;
        }
      }

      if (payloadAction === "text") {
        const replyFromButton = String(payload?.value || "").trim();
        if (replyFromButton) {
          await sendMessage({ accessToken, peerId, message: replyFromButton, keyboard });
          logVkRuntime("info", "reply_sent", { type: "text_payload", peerId });
          continue;
        }
      }

      if (!text) {
        continue;
      }

      const normalized = normalizeText(text);
      if (normalized === "/start" || normalized === "/menu" || normalized === "меню") {
        const welcomeText = settings?.autoMessages?.start || settings?.welcomeMessage || "Привет!";
        const menuText = settings?.autoMessages?.menu || "";
        const reply = settings?.menuEnabled === false
          ? welcomeText
          : [welcomeText, menuText, buildMenuText(settings)].filter(Boolean).join("\n\n");
        await sendMessage({ accessToken, peerId, message: reply, keyboard });
        logVkRuntime("info", "reply_sent", {
          type: "menu",
          peerId,
        });
        continue;
      }

      if (settings?.faqEnabled !== false) {
        const faqReply = buildFaqResponse(settings, text);
        if (faqReply) {
          await sendMessage({ accessToken, peerId, message: faqReply, keyboard });
          logVkRuntime("info", "reply_sent", {
            type: "faq",
            peerId,
          });
          continue;
        }
      }

      const templateReply = buildReplyTemplateResponse(settings, text, message);
      if (templateReply) {
        await sendMessage({ accessToken, peerId, message: templateReply, keyboard });
        logVkRuntime("info", "reply_sent", {
          type: "template",
          peerId,
        });
        continue;
      }

      await sendMessage({
        accessToken,
        peerId,
        message: settings?.autoMessages?.faqMiss || settings?.fallbackMessage || "Я пока не нашёл ответ. Нажмите /menu.",
        keyboard,
      });
      logVkRuntime("info", "reply_sent", {
        type: "fallback",
        peerId,
      });
    }
  }
};

const main = async () => {
  logVkRuntime("info", "startup", {
    backendUrl: BACKEND_URL,
    retryDelayMs: RETRY_DELAY_MS,
  });

  while (true) {
    try {
      const settings = await fetchConfig();
      if (!settings?.enabled) {
        logVkRuntime("info", "disabled_in_config", {
          sleepMs: RETRY_DELAY_MS,
        });
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      await handleLongPoll(settings);
    } catch (error) {
      logVkRuntime("error", "runtime_error", {
        message: String(error?.message || error),
      });
      await sleep(RETRY_DELAY_MS);
    }
  }
};

main().catch((error) => {
  logVkRuntime("error", "fatal", {
    message: String(error?.message || error),
  });
  process.exitCode = 1;
});
