import fetch from "node-fetch";
import { handleCommand } from "../commands/index.js";

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || "";
let BOT_REFRESH_TOKEN = process.env.YOUTUBE_REFRESH_TOKEN || "";
let botAccessToken = null;
let botTokenExpiry = 0;

const POLL_INTERVAL = Number(process.env.YOUTUBE_CHAT_POLL_INTERVAL) || 5000;

// Map channelId → { liveChatId, pageToken, timer }
const activePolls = new Map();

async function refreshBotToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || !BOT_REFRESH_TOKEN) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: BOT_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    botAccessToken = data.access_token;
    botTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000;
    return botAccessToken;
  }
  return null;
}

async function getBotToken() {
  if (botAccessToken && Date.now() < botTokenExpiry) return botAccessToken;
  return refreshBotToken();
}

async function getLiveChatId(channelId, userAccessToken) {
  const token = userAccessToken || await getBotToken();
  if (!token) return null;
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  const broadcast = data?.items?.find((i) => i.snippet?.channelId === channelId) || data?.items?.[0];
  return broadcast?.snippet?.liveChatId || null;
}

async function sendYouTubeMessage(liveChatId, text) {
  const token = await getBotToken();
  if (!token) return;
  await fetch("https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      snippet: { liveChatId, type: "textMessageEvent", textMessageDetails: { messageText: text.slice(0, 200) } },
    }),
  });
}

async function pollChat(channelId, liveChatId, pageToken, userAccessToken) {
  const token = userAccessToken || await getBotToken();
  if (!token) return { nextPageToken: pageToken };

  const params = new URLSearchParams({ part: "snippet,authorDetails", liveChatId, maxResults: "50" });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.error) { console.error("[youtube] poll error:", data.error.message); return { nextPageToken: pageToken }; }

  for (const item of (data.items || [])) {
    const text = item.snippet?.displayMessage || item.snippet?.textMessageDetails?.messageText || "";
    const senderName = item.authorDetails?.displayName || "viewer";
    if (!text.startsWith("!")) continue;
    const reply = await handleCommand(text, senderName);
    if (reply) {
      try { await sendYouTubeMessage(liveChatId, reply); } catch (e) { console.error("[youtube] send error:", e?.message); }
    }
  }

  return { nextPageToken: data.nextPageToken || null };
}

async function startPollLoop(channelId, userAccessToken) {
  if (activePolls.has(channelId)) return;

  let liveChatId = await getLiveChatId(channelId, userAccessToken);
  if (!liveChatId) {
    console.log(`[youtube] No active stream for channel ${channelId}, will retry`);
    const timer = setTimeout(() => { activePolls.delete(channelId); startPollLoop(channelId, userAccessToken); }, 60000);
    activePolls.set(channelId, { liveChatId: null, timer });
    return;
  }

  console.log(`[youtube] Started polling liveChatId ${liveChatId} for channel ${channelId}`);
  let pageToken = null;

  const loop = async () => {
    if (!activePolls.has(channelId)) return;
    try {
      const result = await pollChat(channelId, liveChatId, pageToken, userAccessToken);
      pageToken = result.nextPageToken;
    } catch (e) {
      console.error("[youtube] poll loop error:", e?.message);
    }
    if (activePolls.has(channelId)) {
      activePolls.get(channelId).timer = setTimeout(loop, POLL_INTERVAL);
    }
  };

  activePolls.set(channelId, { liveChatId, timer: setTimeout(loop, POLL_INTERVAL) });
}

function stopPollLoop(channelId) {
  const entry = activePolls.get(channelId);
  if (entry) {
    clearTimeout(entry.timer);
    activePolls.delete(channelId);
    console.log(`[youtube] Stopped polling for channel ${channelId}`);
  }
}

export async function syncYouTubeChannels(channels) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    if (channels.length > 0) console.warn("[youtube] YOUTUBE_CLIENT_ID/SECRET not set — YouTube disabled");
    return;
  }

  const wanted = new Set(channels.map((c) => c.channelId));

  for (const ch of wanted) {
    if (!activePolls.has(ch)) {
      const entry = channels.find((c) => c.channelId === ch);
      await startPollLoop(ch, entry?.accessToken || null);
    }
  }

  for (const ch of activePolls.keys()) {
    if (!wanted.has(ch)) stopPollLoop(ch);
  }
}
