# Nordwind Discord Bot

Independent Discord bot service (runs separately from the website).

## 1) Setup

1. Create a bot in Discord Developer Portal.
2. Enable **Message Content Intent** (only if you add message-based commands later).
3. Copy your bot token and application (client) ID.
4. Create `.env` from `.env.example`.

## 2) Install

```bash
npm install
```

Install Python dependency for profile cards:

```bash
python -m pip install -r requirements.txt
```

## 3) Run

```bash
npm run start
```

For development with auto-reload:

```bash
npm run dev
```

## Commands

- `/ping` — bot latency
- `/uptime` — process uptime
- `/info` — basic bot info
- `/help` — list commands
- `/vamsys-stats` — vAMSYS summary stats
- `/vamsys-live [limit]` — active flights
- `/vamsys-recent [limit]` — recent completed flights
- `/profile` — your pilot profile rendered as a Nordwind-style card with rank, honorary rank, PIREP count and hours
- `/booking` — your current booking plus a text list of scheduled flights available from your current pilot location, with buttons for dashboard opening, booking switching and deletion when Pilot API is connected
- `/notams` — current operational NOTAMs with next/previous navigation buttons
- `/roster [limit]` — current roster snapshot plus curated pilots section
- `/tours` — your current Nordwind tours progress
- `/claims` — recent manual claims with modal-based manual claim submission
- `/settings [scope] [key] [enabled]` — view or update Discord DM notification settings and notification types
- `/location [icao]` — show current pilot location or set/reset it through Pilot API
- `/badges` — your currently earned pilot badges
- `/airport <icao>` — airport details from vAMSYS database by ICAO
- `/routes <icao> [limit]` — routes from departure ICAO with airline and flight number
- `/metar <icao>` — METAR by ICAO
- `/taf <icao>` — TAF by ICAO
- `/ticket-panel [channel]` — posts ticket panel with modal-based ticket creation
- `/news-create [channel]` — opens modal form and publishes a news embed (Manage Server required)

## Notes

- If `DISCORD_GUILD_ID` is set, commands are registered to that guild (fast updates).
- If `DISCORD_GUILD_ID` is empty, commands are registered globally (can take time to propagate).
- Admin commands are allowed for users with `Manage Server` OR any role from `ADMIN_ROLE_IDS`.
- For `vamsys-*` commands set `VAMSYS_CLIENT_ID` and `VAMSYS_CLIENT_SECRET` in `.env`.
- For Pillow profile cards install Python 3 and `requirements.txt`. If needed set `PYTHON_EXECUTABLE` explicitly.
- `/booking` delete actions rely on a shared website auth store with Pilot API connection data. Configure `AUTH_STORAGE_FILE` if the bot cannot find it automatically.
- New booking action in Discord opens the website bookings tab from `PILOT_BOOKINGS_URL`.
- `/booking` also uses the pilot location from `/location` to show all available scheduled routes from the current airport as embed text.
- If a pilot has unread NOTAMs, the bot suppresses the new-booking shortcut until those NOTAMs are acknowledged.
- For vAMSYS 5.4 scoped client credentials set `VAMSYS_API_SCOPE=ops:read`. Leave it empty only if your token is intentionally unscoped.
- Live flights feed auto-posts/updates one embed message in `LIVE_FEED_CHANNEL_ID` (defaults to `1456988328388985003`).
- Feed update interval is controlled by `LIVE_FEED_INTERVAL_MS` (default `120000` ms).
- PIREP review monitor tracks active flights, waits for the filed PIREP after the flight disappears from live flights, and alerts when the resulting PIREP is not accepted.
- Configure notifier channel via `PIREP_REVIEW_CHANNEL_ID` (defaults to `1405161495368699914`).
- Configure notifier polling via `PIREP_REVIEW_INTERVAL_MS` (default `60000` ms).
- Recent PIREP scan size is controlled by `PIREP_REVIEW_RECENT_LIMIT` (default `100`).
- Pending flight watch lifetime is controlled by `PIREP_REVIEW_PENDING_WINDOW_MS` (default `43200000` ms / 12h).
- Alert embed title is clickable and points to PIREP URL (base can be overridden via `PIREP_WEB_BASE_URL`).
- When a Discord binding exists and `/settings` keeps `discord` + `review` notifications enabled, the bot also sends the pilot a DM that the PIREP needs review.
- New NOTAM DM alerts are sent to pilots whose Discord binding is known to the bot and who keep Discord + NOTAM notifications enabled in `/settings`.
- Badge-earned DM alerts are sent with the same binding/preferences model.
- Ticket system uses modals for create/close actions and creates private ticket channels.
- Optional ticket config via `.env`: `TICKET_CATEGORY_ID`, `TICKET_CLOSED_CATEGORY_ID`, `TICKET_LOG_CHANNEL_ID`.
- Ticket creation modal includes required `category` and `language` (`ru/en` by default).
- You can configure category/language sets via `TICKET_ALLOWED_CATEGORIES` and `TICKET_ALLOWED_LANGUAGES`.
