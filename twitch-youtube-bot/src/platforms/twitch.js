import tmi from "tmi.js";
import { handleCommand } from "../commands/index.js";

const USERNAME = process.env.TWITCH_BOT_USERNAME || "";
const TOKEN = process.env.TWITCH_BOT_TOKEN || "";

let client = null;
let joinedChannels = new Set();

export function createTwitchClient() {
  if (!USERNAME || !TOKEN) {
    console.warn("[twitch] TWITCH_BOT_USERNAME or TWITCH_BOT_TOKEN not set — Twitch disabled");
    return;
  }

  client = new tmi.Client({
    identity: { username: USERNAME, password: TOKEN },
    channels: [],
    options: { debug: false },
    connection: { reconnect: true, secure: true },
  });

  client.on("message", async (channel, tags, message, self) => {
    if (self) return;
    const senderName = tags["display-name"] || tags.username || "viewer";
    const reply = await handleCommand(message, senderName);
    if (reply) {
      try { await client.say(channel, reply); } catch (e) { console.error("[twitch] say error:", e?.message); }
    }
  });

  client.on("connected", (addr, port) => console.log(`[twitch] Connected to ${addr}:${port}`));
  client.on("disconnected", (reason) => console.warn("[twitch] Disconnected:", reason));

  client.connect().catch((e) => console.error("[twitch] connect error:", e?.message));
}

export async function syncChannels(channels) {
  if (!client) return;

  const wanted = new Set(channels.map((c) => `#${c.channel.toLowerCase()}`));

  // join new channels
  for (const ch of wanted) {
    if (!joinedChannels.has(ch)) {
      try {
        await client.join(ch);
        joinedChannels.add(ch);
        console.log(`[twitch] Joined ${ch}`);
      } catch (e) {
        console.error(`[twitch] Failed to join ${ch}:`, e?.message);
      }
    }
  }

  // leave removed channels
  for (const ch of joinedChannels) {
    if (!wanted.has(ch)) {
      try {
        await client.part(ch);
        joinedChannels.delete(ch);
        console.log(`[twitch] Left ${ch}`);
      } catch (e) {
        console.error(`[twitch] Failed to leave ${ch}:`, e?.message);
      }
    }
  }
}
