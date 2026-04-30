# Nordwind Telegram Bot

Стартовый Telegram-бот для Nordwindsite. Это первый этап: базовый runtime, polling, чтение новостей/NOTAM и создание контента/тикетов через сайт.

## Setup

1. Создай Telegram bot через `@BotFather`
2. Скопируй токен в `.env`
3. Укажи `WEBSITE_BASE_URL` на живой backend Nordwindsite
4. Если бот должен создавать контент или тикеты через сайт, задай `TELEGRAM_BOT_CONFIG_TOKEN`

## Run

```bash
npm install
npm run start
```

Для разработки:

```bash
npm run dev
```

## Current Commands

- `/start` — приветствие
- `/help` — список команд
- `/ping` — проверка, что бот жив
- `/link CODE` — привязать Telegram к pilot profile на сайте через одноразовый код из Settings
- `/news [count]` — последние новости сайта
- `/notams [count]` — свежие NOTAM
- `/ticket category | subject | message` — создать тикет на сайте
- `/news_create title | content` — создать новость на сайте
- `/alert_create title | content` — создать alert на сайте
- `/notam_create [priority] | title | content` — создать NOTAM на сайте

## Notes

- Admin-only команды ориентируются на `telegramBotSettings.adminChatIds` с сайта.
- Сейчас бот работает через long polling.
- Бот теперь также отправляет PIREP review/status alerts в `adminChatIds`, если заданы `VAMSYS_CLIENT_ID` и `VAMSYS_CLIENT_SECRET`.
- После привязки через `/link CODE` бот также может отправлять персональные accepted/rejected/review/reply-needed уведомления в Telegram по настройкам пилота.
- Следующим этапом можно добавить inline-кнопки, админ-панель сайта и двустороннюю синхронизацию тикетов.
