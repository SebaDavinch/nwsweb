import "dotenv/config";
import { getActiveChannels } from "./api-client.js";
import { createTwitchClient, syncChannels as syncTwitch } from "./platforms/twitch.js";
import { syncYouTubeChannels } from "./platforms/youtube.js";

const POLL_INTERVAL = Number(process.env.CHANNELS_POLL_INTERVAL) || 60000;

async function syncAll() {
  try {
    const all = await getActiveChannels();
    const twitchChannels = all.filter((c) => c.platform === "twitch");
    const youtubeChannels = all.filter((c) => c.platform === "youtube");

    await syncTwitch(twitchChannels);
    await syncYouTubeChannels(youtubeChannels);

    if (all.length > 0) {
      console.log(`[bot] Synced: ${twitchChannels.length} Twitch, ${youtubeChannels.length} YouTube channels`);
    }
  } catch (e) {
    console.error("[bot] syncAll error:", e?.message);
  }
}

console.log("[bot] NWSBot starting…");
createTwitchClient();

// Initial sync after 3s (give Twitch client time to connect)
setTimeout(async () => {
  await syncAll();
  setInterval(syncAll, POLL_INTERVAL);
}, 3000);

process.on("SIGINT", () => { console.log("[bot] Shutting down"); process.exit(0); });
process.on("SIGTERM", () => { console.log("[bot] Shutting down"); process.exit(0); });
