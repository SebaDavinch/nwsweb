# Nordwind VK Bot

Separate VK community bot runtime linked to the Nordwind backend.

## Environment

- `VK_BOT_BACKEND_URL` - backend base URL, for example `http://localhost:3000`
- `VK_BOT_CONFIG_TOKEN` - shared secret used to fetch `/api/vk-bot/config`
- `VK_BOT_POLL_DELAY_MS` - retry delay after long poll errors, default `5000`

## Run

```bash
npm install
npm start
```

## Behavior

- Loads bot settings from backend config.
- Polls VK long poll for incoming messages.
- Replies to `/start` and `/menu`.
- Matches FAQ keywords from backend-managed FAQ items.
- Falls back to the configured fallback message when no FAQ matches.
