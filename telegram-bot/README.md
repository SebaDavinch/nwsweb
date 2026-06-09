# Nordwind Telegram Bot

Standalone Telegram bot service for Nordwind VA.

## Features

- Telegram account linking via `/link CODE`
- Menu buttons for profile, booking, news, NOTAMs, events, roster, METAR, TAF
- Personal Telegram notification settings synced with the website
- Separate polling loops for content and PIREP status monitoring
- Reads configuration from `telegram-bot/.env` or the repository root `.env`

## Required environment variables

- `TELEGRAM_BOT_TOKEN`
- `WEBSITE_BASE_URL`

Optional overrides:

- `TELEGRAM_BOT_CONFIG_TOKEN`
- `TELEGRAM_BOT_POLLING`
- `TELEGRAM_BOT_ANNOUNCEMENT_INTERVAL_MS`
- `TELEGRAM_BOT_PIREP_INTERVAL_MS`
- `TELEGRAM_BOT_DEFAULT_ROSTER_LIMIT`

## Run locally

```bash
cd telegram-bot
npm install
npm start
```

## Systemd

Example unit file: `deploy/systemd/telegram-bot.service`

Recommended layout:

- `/opt/nordwindsite/.env` for shared production secrets
- `/opt/nordwindsite/telegram-bot/` for the Telegram bot package itself

The unit loads both `/opt/nordwindsite/.env` and `/opt/nordwindsite/telegram-bot/.env` if present, then starts the bot from `/opt/nordwindsite/telegram-bot/src/index.js`.