# Nordwind Virtual Website

Визиточный сайт виртуальной авиакомпании Nordwind Virtual на платформе vamsys.io.

## Запуск

1. Установите зависимости:
   - `npm install`
2. Создайте .env на основе .env.example и заполните VAMSYS_CLIENT_ID / VAMSYS_CLIENT_SECRET.
   - Для vAMSYS 5.4 при использовании scoped client credentials задайте `VAMSYS_API_SCOPE`. Для текущего сайта достаточно `ops:read`.
   - Если токен/клиент работают без scopes, поле `VAMSYS_API_SCOPE` можно оставить пустым.
   - Для постепенного внедрения персонального профиля через Pilot API нужен отдельный OAuth client: заполните `PILOT_API_CLIENT_ID` и `PILOT_API_REDIRECT_URI`.
   - Pilot API работает через Authorization Code + PKCE и не использует client secret. Это отдельное подключение от основного Operations API.
   - Для публикации новостей из админки в Discord по галочке `Send to Discord` добавьте `DISCORD_BOT_TOKEN` и `DISCORD_NEWS_CHANNEL_ID`.
3. Запустите API-прокси и фронтенд в отдельных терминалах:
   - `npm run dev:server`
   - `npm run dev`

## Smoke-check admin routes

- Скрипт `npm run smoke:admin-routes` прогоняет create -> detail -> meta -> update -> delete через локальные `/api/admin/routes` endpoints и по умолчанию удаляет тестовый маршрут в конце.
- Для headless локального запуска удобно поднять API так: PowerShell: `$env:ENABLE_DEV_SESSIONS='true'; npm run dev:server`. Тогда скрипт сам seed'ит временную vAMSYS admin session через `POST /__dev/seed-vamsys-session`.
- Если у вас уже есть рабочая admin cookie-сессия, можно передать её через `ROUTE_SMOKE_COOKIE` и не использовать dev seed.
- Необязательные переменные: `ROUTE_SMOKE_BASE_URL`, `ROUTE_SMOKE_DEPARTURE`, `ROUTE_SMOKE_ARRIVAL`, `ROUTE_SMOKE_FLEET_ID`, `ROUTE_SMOKE_HUB_ID`, `ROUTE_SMOKE_KEEP_ROUTE=true`.
- Для create/update/delete нужны write-capable vAMSYS Operations credentials. Конфигурации только с `ops:read` недостаточно.

## vAMSYS 5.4

- Пагинация `/routes` уже поддерживает оба варианта ключей: новые `meta.next_cursor_url` / `meta.prev_cursor_url` и старые `meta.next_page_url` / `meta.prev_page_url`.
- Для action endpoints vAMSYS 5.4 (`registrations approve/reject`, `transfers approve/reject`, `ranks/reorder`, honorary rank, hub pilot attach/detach) API теперь возвращает поля внутри `data`. Прокси сохраняет совместимость и дублирует эти поля на верхний уровень ответа для существующих скриптов.
- Если вы переводите client credentials на scopes, убедитесь, что токену выданы права под ваш сценарий. Для read-only витрин и публичных виджетов используйте `ops:read`.

## Pilot API

- В `Settings` добавлено отдельное подключение Pilot API. Оно не меняет основной логин сайта и не трогает текущий Operations API поток.
- Подключение использует отдельный PKCE OAuth flow, хранит access/refresh token и умеет обновлять `/api/v3/pilot/profile` для персональных данных пилота.
- Это первый шаг для постепенного переноса профиля на Pilot API: теперь можно безопасно наращивать richer profile fields без риска сломать текущую авторизацию.

## ACARS / Hoppie

- В `/admin/acars` хранится рабочий профиль Hoppie ACARS: logon, SELCAL, station callsign, dispatch target, capability toggles и bootstrap preview.
- Из той же вкладки доступны live Hoppie actions через серверный прокси: `ping`, `poll` и отправка пакетов (`telex`, `cpdlc`, `progress`, `position`, `posreq`, `datareq`, `peek`).
- Инструменты Hoppie используют официальный endpoint `https://www.hoppie.nl/acars/system/connect.html` и ведут журнал последних запросов в админке.

## Сборка

- `npm run build`

## Деплой

- Linux/macOS: `deploy/prod/deploy_prod.sh`
- Windows PowerShell: `deploy/prod/deploy_prod.ps1`
- Оба скрипта ожидают `REMOTE_HOST`, `REMOTE_USER`, `REMOTE_DIR` и при необходимости `API_SERVICE`, `SITE_SERVICE`, `NGINX_SERVICE`.
- Пример для Windows: `./deploy/prod/deploy_prod.ps1 -RemoteHost vnws.org -RemoteUser deploy -RemoteDir /var/www/nws`

## Структура

- Основные страницы находятся в [src/app/components](src/app/components).
- Глобальные стили — в [src/styles](src/styles).
- Изображения — в [src/assets](src/assets).
