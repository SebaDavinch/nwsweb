# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Description

Nordwindsite — сайт и система управления виртуальной авиакомпанией **Nordwind Virtual Airlines (VNWS)**, работающей на базе платформы [vAMSYS.io](https://vamsys.io).

Проект включает:
- **Публичный сайт** — информация об авиакомпании, флот, маршруты, новости, команда, документы
- **Кабинет пилота** — бронирование рейсов, PIREP, статистика, социальная галерея, паспорт, испытания, баланс
- **Панель администратора** — управление маршрутами, флотом, пилотами, событиями, новостями, Discord/Telegram ботами
- **Живая карта** — отображение активных рейсов в реальном времени с телеметрией
- **Интеграции** — Discord (OAuth + бот), Telegram, SimBrief, Hoppie ACARS, Twitch, YouTube

## Commands

```bash
# Development (run both in separate terminals)
npm run dev           # Vite frontend dev server (proxies /api → localhost:8787)
npm run dev:server    # Express API server (port 8787)

# Build & preview
npm run build         # TypeScript compile + Vite bundle → dist/
npm run preview       # Serve production build locally

# Lint
npm lint              # ESLint on all TypeScript/TSX files

# Scripts
npm run test:auth          # Test authentication flows
npm run smoke:admin-routes # Smoke test admin CRUD (create → detail → meta → update → delete)
npm run gallery:picks      # Build social gallery featured picks

# Production
npm run start:api     # API server (production)
npm run start:site    # Static file server on port 8788
```

## Architecture Overview

Full-stack virtual airline platform. React SPA с большим Express-бэкендом, который проксирует и расширяет vAMSYS.io Operations API.

```
React (Vite, TypeScript)
  └─ /api/* proxy ──► Express server/index.js (port 8787)
                          ├─ vAMSYS Operations API (OAuth client credentials)
                          ├─ vAMSYS Pilot API (PKCE OAuth, separate flow)
                          ├─ Discord OAuth + bot
                          ├─ Telegram bot
                          └─ data/*.json  (file-based persistence, no database)
```

## Backend

Единый файл `server/index.js` (~31k строк, ~279 эндпоинтов).

- **`/api/public/*` + `/api/vamsys/*`** — публичные данные: флот, маршруты, живые рейсы, NOTAM, погода
- **`/api/pilot/*`** — авторизованные действия пилота: бронирования, PIREPs, галерея, баланс, испытания, паспорт, SimBrief
- **`/api/admin/*`** — полный CRUD: маршруты, флот, новости, события, пилоты, боты, ACARS, аудит-лог

### Auth

Три параллельные OAuth-системы:
- **Discord OAuth** — публичные аккаунты
- **vAMSYS Operations OAuth** — основной логин пилота/администратора
- **Pilot API PKCE OAuth** — отдельный профиль пилота; не перезаписывает Operations-сессию

Доступ в админку (`requireAdmin`) проверяет: `ADMIN_DISCORD_IDS`, `ADMIN_VAMSYS_IDS`, `ADMIN_VAMSYS_USERNAMES`, `ADMIN_VAMSYS_HONORARY_RANK_IDS`, или `ADMIN_BOOTSTRAP_TOKEN`.

### Caching

- In-memory TTL: рейсы ~100ms, флот/маршруты — минуты, дашборд — 10 мин
- Disk: сессии, ростер пилотов, история телеметрии (`data/*.json`)
- **Telemetry backfill** — восстанавливает траекторию рейса эвристическим сопоставлением позиций при неполных данных

## Frontend

- **`src/app/routes.ts`** — React Router v7, ~143 маршрута
- **`src/app/App.tsx`** — корень; оборачивает роутер в четыре контекста: `AuthProvider`, `LanguageProvider`, `NewsProvider`, `NotificationsProvider`
- **`src/app/components/admin/`** — 40+ страниц панели администратора
- **`src/app/components/dashboard/`** — личный кабинет пилота
- **`src/app/components/ui/`** — переиспользуемые примитивы в стиле Shadcn на базе Radix UI

### Context providers

| Провайдер | Назначение |
|---|---|
| `auth-context.tsx` | Состояние сессии, OAuth-флоу |
| `language-context.tsx` | i18n (RU/EN, fallback — русский). Все строки UI через `useLanguage().t(key)` |
| `news-context.tsx` | Лента новостей и активностей |
| `notifications-context.tsx` | Toast-уведомления через Sonner |

## Admin Navigation Pattern

Все вызовы `navigate()` внутри admin-компонентов должны использовать `?page=` query-параметры (например, `navigate('?page=edit&id=123')`), а не path-based роутинг.

## Data Persistence

Базы данных нет. Состояние хранится в `data/*.json`:
- `auth-store.json` — сессии, OAuth-связки, администраторы
- `pilots-roster.json`, `fleet-snapshot.json` — кэш данных API
- `social-gallery.json` + `social-gallery-assets/` — медиа галереи
- `admin-content.json`, `admin-audit-log.json`, `event-coins.json` и др.

Перед изменением логики персистентности делать резервную копию `data/`.

## Stack

- **Frontend**: React 18, React Router v7, TypeScript 5.9, Tailwind CSS 4, Vite 6, Radix UI, Leaflet, Recharts, React Hook Form, Sonner
- **Backend**: Express 4, Node.js ES modules, без ORM (нативный `fs` для JSON)
- **External**: vAMSYS.io, Discord, Telegram, Twitch, YouTube, SimBrief, Hoppie ACARS

## Deployment

Деплой всегда делается через сборку архива — прямого SSH-деплоя нет. Пользователь загружает и переносит архив вручную.

**Сборка архива:**
```powershell
# Запускать из корня проекта
.\artifacts\rebuild_release.ps1
```

Скрипт делает `npm ci` → `npm run build` → пакует `dist/*` в `artifacts/website-release-rebuild-<timestamp>.zip`.

Архив содержит собранный фронтенд (`dist/`). Серверные файлы (`server/`, `package.json`, `package-lock.json`, `deploy/prod/`) переносятся отдельно вручную при необходимости.

После сборки ZIP находится в `artifacts/` — его и загружают на сервер.

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `VAMSYS_CLIENT_ID` / `VAMSYS_CLIENT_SECRET` | Operations API credentials |
| `VAMSYS_API_BASE` | API root (default: `https://vamsys.io/api/v3/operations`) |
| `PILOT_API_CLIENT_ID` / `PILOT_API_CLIENT_SECRET` | Pilot API OAuth |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Discord login |
| `DISCORD_BOT_TOKEN` | Discord bot (news publishing) |
| `TELEGRAM_BOT_TOKEN` | Telegram announcements |
| `ADMIN_BOOTSTRAP_TOKEN` | One-time admin grant |
| `ENABLE_DEV_SESSIONS` | `true` → enables `POST /__dev/seed-vamsys-session` for local testing |
| `FLIGHT_MAP_CACHE_MS` | Live flight poll interval (default: 100ms) |
