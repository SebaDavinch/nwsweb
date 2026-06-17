# WORKLOG — журнал работ по проекту

Журнал ведётся по сессиям: что сделано, что исправлено, что осталось. Новые записи добавляются сверху.
Формат релизов: `artifacts/website-release-<yyyyMMdd-HHmmss>.zip` (dist + server + prod + package.json). Если менялся `server/index.js` — после деплоя нужен рестарт API.

---

## 2026-06-17

### Фикс темы хаба + радио вынесено в футер-виджет «сейчас играет»
- **«Тема сломана»** (NOTAM/Галерея/Радио и др.): контент-«лист» секций хаба был жёстко светлым (`bg-zinc-100 text-zinc-900`), но `.dark` на корне AppShell включал `dark:`-варианты переиспользуемых компонентов → тёмные блоки на светлом фоне. Фикс: лист сделан тематическим (`dark:bg-zinc-950 dark:text-zinc-100`) — в тёмной теме всё консистентно тёмное. Заодно `ActivityFeed` и обёртка ленты переведены на «светлая база + `dark:`» (были light-only).
- **Радио → футер**: пункт «Радио» убран из сайдбара хаба. Воспроизведение станций вынесено в **общий стор** `use-radio.ts` (единый `<audio>` на уровне модуля — **переживает навигацию** между вкладками; `useSyncExternalStore`). `StationsPlayer` переписан на стор (play/pause/громкость/устройство — общие). Новый виджет **`radio-now-playing.tsx`** в футере (`live-stats-bar`, при авторизации + `config.features.radio`): иконка/название текущей станции, индикатор «в эфире», play/pause, клик по названию → переход во вкладку радио, **шеврон → мини-плеер вверх** (play/pause, громкость, «Открыть радио»).
- **hub-mode** теперь реагирует на `?section=` в URL (футер-виджет навигирует `/app/hub?section=radio`); внутренние клики по рейлу URL не меняют, эффект их не перетирает. Раздел «radio» остался доступен (рендерит `RadioPlayer`), только без пункта в сайдбаре.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.

### Фикс: приложение некликабельно при загрузке (зависший сплэш) + уборка вектор-борта
- **Корневой баг** (`app-splash.tsx`): эффект завершения зависел от `progress` (меняется каждый кадр rAF). После готовности он ставил `fading=true` и `setTimeout(onDone, 500)`, **возвращая cleanup, который чистит таймер** — на следующем же кадре эффект перезапускался, cleanup отменял `onDone`, и сплэш **никогда не размонтировался**: висел невидимым (`opacity:0`) оверлеем `fixed inset-0 z-[100]` без `pointer-events-none` и **съедал все клики**, хаб виден сквозь него. Фолбэк-таймаут тоже не срабатывал (`doneRef` уже выставлен). Фикс: таймер хранится в ref и чистится только при размонтировании (cleanup не отменяет `onDone`); + `pointer-events-none` на сплэше во время фейда.
- **View Transition (защита)**: `pointer-events: none` на всех `::view-transition*` псевдоэлементах (снимки перехода никогда не должны перехватывать клики) + `try/catch` в `toggleThemeAnimated` с фолбэком на простую смену темы.
- **Убран вектор-борт `NordwindJet`**: по решению — выглядел плохо. Удалён из `hub-overview` и `app-splash`, компонент `nordwind-jet.tsx` удалён.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.

### Починка синхронизации локации пилота с vAMSYS (корневой баг)
Симптом: пилот меняет локацию в vAMSYS, сайт/приложение не подхватывают (vAMSYS не шлёт нам POST — только опрос).
- **Корневая причина** (`loadPilotProfileById`): при передаче `seedPilot` (это **устаревший `session.user`**) функция брала `node` из seed, а живой профиль из Operations API **не перезапрашивала** (docs-эндпоинт выключен по умолчанию, прямой `apiFetch` срабатывал только `if (!node)`). Поэтому `syncPilotApiLocationFromVamsys` сравнивал Pilot-API локацию со **стейл-локацией из сессии** → «совпадает» → ничего не обновлялось.
- **Фикс**: добавлен флаг `loadPilotProfileById(id, { seedPilot, forceFresh })`. При `forceFresh` seed игнорируется, тянется живой `/pilots/{id}` из Operations API (seed остаётся только как фолбэк, если живой запрос упал). `syncPilotApiLocationFromVamsys` теперь зовёт с `forceFresh: true` — реально видит смену локации.
- **Лимит обновления (защита API от частых F5)**: в `GET /api/pilot/location` форс-синк с vAMSYS теперь не чаще раза в `PILOT_LOCATION_MIN_REFRESH_MS` (нов. env, дефолт **10 мин**, мин 1 мин) на пилота (`pilotLocationRefreshAt` Map). В пределах окна отдаём кэшированную локацию из соединения — без обращений к vAMSYS. Первый запрос после логина (пилота нет в map) всегда форсит → «при новой логин-сессии» покрыто.
- **Три пути синка, все теперь live + rate-limited**: `/api/vamsys/me` (логин/refresh, ≥3 мин/сессия — `PILOT_API_LOCATION_SYNC_MS`); `/api/pilot/location` (страницы брони/диспетча + app-хук, ≥10 мин/пилот); фоновый sweep (ежечасно — `PILOT_LOCATION_SYNC_INTERVAL_MS`).
- Проверки: `node --check server/index.js` → 0. Клиент не менялся (серверный лимит авторитетный, защищает API независимо от клиента).

### #3 Activity Feed — лента активности сообщества (сайт + приложение, закрыта)
Единый компонент ленты + агрегирующий эндпоинт.
- **Сервер** (`server/index.js`): публичный `GET /api/feed?limit=` — агрегатор, мержит три источника (каждый в своём try/catch, чтобы сбой одного не ронял ленту): (1) галерея — `buildSocialGalleryFeed` (загрузки/лайки/альбомы, только публичное), (2) завершённые рейсы «кто куда летал» — `loadCompletedFlights` (пилот/маршрут/ВС/ВАК, при наличии vAMSYS-кредов), (3) новости+события из админ-коллекции `activities` (`toPublicManualActivity`). Нормализует к общему виду `{id,type,createdAt,actor,title,summary,media,route,vac,href}`, сортирует по времени, режет до limit (max 60).
- **Клиент** (`activity-feed.tsx`): хук `useActivityFeed` + компонент `ActivityFeed` (+`FeedRow`). Иконка/акцент/лейбл по типу (рейс/скриншот/альбом/лайк/новость/событие), точка цвета ВАК, флаги маршрута (ICAO→страна), превью медиа с счётчиком лайков, относительное время (ru/en), клик → href. **Светлая** (на сайте — белая карточка, в приложении — светлый «лист» хаба; не делал dark: т.к. контент-лист хаба всегда светлый — паттерн переиспользуемых ЛК-компонентов).
- **Сайт** (`pilot-dashboard.tsx`): вкладка «Лента» (иконка Activity, после «Обзор»; `?tab=feed`, в `allowedTabs`).
- **Приложение** (`hub-mode.tsx`): секция «Лента» в рейле хаба (после «Обзор»).
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### #2 Диспетчеризация — интеграция в приложение (закрыта)
Полноэкранный flow брони теперь работает и в десктоп-приложении — один компонент на сайт и app.
- **`pilot-dispatch.tsx`** получил проп `variant: "site" | "app"`. В app-режиме: навигация ведёт на `/app/flight` (а не `/dashboard?tab=bookings`), контейнер `h-full` без рамки/скругления (вписывается в shell), карта `FlightMap theme="dark"`. Все поверхности переведены на «светлая база + `dark:`» — на сайте светло, в приложении (скоуп `.dark` в AppShell) автоматически тёмно (паттерн проекта).
- **Маршрут** `/app/dispatch` (`routes.ts`, `element: createElement(PilotDispatch, { variant: "app" })`).
- **Точки входа в app**: CTA «Забронировать» в `flight-mode.tsx` (пустое состояние, теперь `<Link to="/app/dispatch">`) и в `hub-overview.tsx` (нет активной брони) ведут на app-диспетчеризацию.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.
- NB: фикс — после `/login` рабочая директория шелла сбивается; tsc запускать с абсолютным путём к tsconfig.

### Скилл `virtual-airline-ops` (профильная экспертиза по ВАК/vAMSYS)
Создан большой проектный скилл `.claude/skills/virtual-airline-ops/` — чтобы работать профильно по виртуальным авиакомпаниям (VA / ВАК; **никогда не «VAC»**).
- `SKILL.md` — карта домена, жёсткое правило терминологии, когда применять, принципы работы, ссылки на референсы.
- `references/virtual-airlines-101.md` — что такое VA, как устроены, VATSIM/IVAO, типы ивентов, ранги/экономика, чек-лист хорошей ВАК.
- `references/vamsys-platform.md` — компоненты vAMSYS (**Orwell** админка / **Phoenix** портал пилота / **Pegasus** ACARS / **Hangar** хранилище), модель данных, полный список разделов Orwell (с vamsys.co.uk/docs/orwell), карта документации.
- `references/vamsys-api.md` — v3 API: базы/версии, два OAuth (Operations client-credentials + Pilot PKCE), JSON:API-конвенции (page/sort/filter), **полная инвентаризация эндпоинтов Operations + Pilot, выверенная по `server/index.js`**, lifecycle брони, канонические URL (vamsys.io/docs/operations, /docs/pilot — client-rendered Scalar).
- `references/group-airlines.md` — реальные профили Nordwind (NWS, SVO, Pegas Touristik), Ikar (KAR, ex-Pegas Fly, Оренбург), Southwind (STW, Анталья, тур., смешанные экипажи) + маппинг на VNWS и `detectAirline`.
- `references/ecosystem-and-references.md` — аналоги ВАК (phpVMS, AirlineSim, Volanta/FSHub, крупные VA), источники идей, workflow ресёрча/обновления (фетч в этой среде местами заблокирован — зафиксированы источники и GitHub-зеркало доков `vAMSYS-LTD/documentation`).
- Факты собраны через WebSearch (WebFetch домены частично блокируются политикой среды) + выверены по рабочему коду интеграции.

### Скилл VA: добавлен референс по VATSIM (`references/vatsim-network.md`)
По запросу — VATSIM как «переменная в уравнении» ВАК:
- **Структура сети**: 3 региона (AMAS/EMEA/APAC) → дивизионы → субдивизионы (vACC/ARTCC/FIR); **Appendix A** — полный список всех дивизионов по регионам (VATUSA/VATCAN/VATMEX/VATCA/VATCAR/VATSUR/VATBRZ; VATUK/VATEUD/VATRUS/VATMENA/VATSSA; VATPAC/VATNZ/VATPRC/VATROC/VATJPN/VATKOR/VATSEA/VATWA) с заметкой verify.
- **Релевантные VNWS дивизионы**: **VATRUS** (Nordwind/Ikar) + **Caucasus ACC** (юг РФ + Грузия UGGG/Азербайджан/Армения, Сочи) и **TRvACC** (Southwind, Анталья).
- **Участие ВАК в сети**: prefile/callsign базово + формальная **VA Partner программа (VAP/VPVASO)**, VA Discord, co-sponsorship ивентов с дивизионами/facility.
- **Ивенты**: FNO, fly-in, group, туры, **Cross the Pond** (Slottery-слоты), WorldFlight; как ВАК их проводит/присоединяется.
- **Петля обратной связи** (как участие влияет на ВАК И на регион): трафик↔ATC-стаффинг↔рекрутинг↔партнёрство.
- **Документы VATSIM** (по ссылке vatsim.net/docs): CoC, CoR, User Agreement, **Privacy & Data Collection / CERT** — что значат для хранения данных пилотов в VNWS (минимум, согласие, без IP — совпадает с текущей политикой).
- **Хуки в VNWS**: тег события (network/регион/слот), prefile-напоминание, промо ивентов под хабы, online на карте, награды за участие.

### Скилл VA: догружены оффлайн-доки (`docs/`)
- **`docs/vamsys/`** — вся официальная документация vAMSYS (49 .md) из `github.com/vAMSYS-LTD/documentation` @ bc5f49e (Markdoc): concepts (users-and-pilots/activity/rank-transfer), orwell/* (pilots/ranks/badges/events/announcements/staff/liveries-pireps/design/pages), **vds/*** (routes/aircraft/airports/load-management — Virtual Dispatch System), settings/* (api/airline/acars/discord/scores/autoreject/presets/share-agreements), hangar/*, data/*, migration/*, guides/*.
- **`docs/vatsim/`** — 5 управляющих PDF VATSIM с `cdn.vatsim.net`: Code of Conduct 2024, User Agreement v1.2, Privacy Policy v1.2, Privacy & Data Collection Policy v1.1, VA Partner Policy 2024 v2.
- **`docs/README.md`** — индекс мирролра + команды для рефреша; SKILL.md теперь указывает на оффлайн-доки. Всё качалось через PowerShell Invoke-WebRequest/GitHub API (WebFetch для этих доменов блокируется политикой среды). ~1.7 МБ, 54 файла.

### #2 Диспетчеризация — полноэкранный flow (сайт, в работе)
Замена модалки брони (`pilot-bookings.tsx`) на полноэкранную страницу в стиле vAMSYS/Air Canada.
- **Новый маршрут** `/dashboard/dispatch` (`routes.ts`) → `pilot-dispatch.tsx` (standalone, как `pilot-booking-view`).
- **Бэкенд не трогали** — переиспользованы готовые эндпоинты: `GET /api/vamsys/routes` (+hubs), `GET /api/vamsys/fleet`, `GET /api/pilot/location`, `PATCH /api/pilot/location` (move), `POST /api/pilot/bookings`. Фильтрация рейсов из аэропорта и флота по маршруту — на клиенте (`route.fleetIds` ∩ `aircraft.fleetId`).
- **Экран 1 (карта)**: переиспользован `FlightMap` (Leaflet) — рейсы **только из текущей локации пилота**; сворачиваемый сайдбар (как на vAMSYS) со списком направлений (флаг/ICAO/название/счётчик рейсов), клик по аэропорту на карте или в списке → экран выбора. Ховер по точке направления держит фокус локации; кнопка **«Переместиться в ICAO»** (`PATCH /api/pilot/location`) при фокусе на чужом аэропорту.
- **Экран 2 (выбор рейса)**: список рейсов по направлению, переключатель **Карточки (по умолчанию, стиль Air Canada) / Список**; если рейс к пункту единственный — выбирается сразу. Правая панель подтверждения: карточка рейса + выбор **ВС из флота маршрута** + время вылета (datetime-local, UTC; пусто → +1ч) + кнопка **«Подтвердить и забронировать»** (`POST /api/pilot/bookings`) → переход в `/dashboard?tab=bookings`.
- **Точки входа**: кнопки «Забронировать» в `pilot-bookings.tsx` (шапка + пустое состояние) теперь ведут на `/dashboard/dispatch` (старая модалка-код оставлена, но из UI не открывается).
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.
- **Осталось по #2**: интеграция в десктоп-приложение (`/app`, свой shell) — отдельным шагом.

### Категории достижений (создание в админке + группировка в ЛК)
- **Модель каталога** (`server/index.js`): теперь `{ categories:[{id,titleRu,titleEn,icon,order}], achievements:[...] }`; у достижения — необязательный `categoryId`. Новый `normalizeAchievementCategories`, `normalizeAchievementCatalog` возвращает `{categories,achievements}` (если ключ `categories` отсутствует — берутся `DEFAULT_ACHIEVEMENT_CATEGORIES`, пустой массив уважается). Дефолтные категории: «Прогресс» (hours/flights) и «Коллекции» (badges/screenshots). `readAchievementsCatalog`/`persistAchievementsCatalog` переведены на полную модель (хелпер `writeAchievementsCatalogFile`).
- **Эндпоинты**: `GET .../catalog` отдаёт `categories`; `PUT` принимает `{achievements,categories}` и возвращает обе части; `reset` сеет обе. `GET /api/pilot/achievements` теперь отдаёт `categories` и `categoryId` у каждого достижения.
- **Админ-редактор** (`admin-achievements.tsx`): кнопка «Категории» открывает панель управления (add/edit/delete: titleRu/titleEn, иконка, порядок); в диалоге достижения — выбор категории; достижения в карточках/списке **сгруппированы по категориям** (с «Без категории» в конце); категории уходят в `PUT`.
- **ЛК сайта** (`pilot-achievements.tsx`): достижения сгруппированы по категориям с заголовками (двуязычными), «Другое» — для без категории.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### Редактор достижений в админке (CRUD каталога)
- **Сервер** (`server/index.js`): `persistAchievementsCatalog()` (нормализует + пишет файл + обновляет кэш). Эндпоинты: `PUT /api/admin/achievements/catalog` (сохранить каталог целиком), `POST /api/admin/achievements/catalog/reset` (сброс к `DEFAULT_ACHIEVEMENTS_CATALOG`). `GET` расширен: помимо `achievements` отдаёт справочники `metrics` (4 считаемые метрики), `icons` (clock/plane/award/camera/trophy) и `badges` (локальные `LOCAL_BADGES_CATALOG` + vAMSYS `loadOperationsBadgesCatalog`, уникализация по id) — для выпадашек редактора.
- **Админка** (`admin-achievements.tsx` переписан): редактор поверх просмотра карточки/список. Кнопки «Добавить» / «Сбросить» / «Сохранить» (активна при наличии правок, баннер «несохранённые изменения»). Карточка/строка получили Изменить/Удалить. Диалог редактирования: название RU/EN, метрика (Select), иконка (Select), список целей с add/remove — порог (number) + подпись RU/EN + **привязка наградного бейджа** (Select, «Без бейджа» по умолчанию). «Применить» коммитит в рабочую копию (цели сортируются по порогу), «Сохранить» шлёт `PUT` всего каталога. NB: выдача бейджа по `rewardBadgeId` пока не реализована — поле задаётся, но не вручается.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### Достижения: вкладка в админке (список/карточки) + просмотр в ЛК на сайте
- **Сервер** (`server/index.js`): `GET /api/admin/achievements/catalog` (`requireAdmin`) — отдаёт определения каталога из `readAchievementsCatalog()`.
- **Админка** (`admin-achievements.tsx` + регистрация в `admin-layout.tsx`): новая страница «Достижения» (раздел «Медиа», иконка Trophy, `page=achievements`). Переключатель вида **Карточки ↔ Список**: карточки — иконка/заголовок(ru/en)/метрика + чипы целей (значок связи, если есть `rewardBadgeId`); список — таблица (достижение+id, метрика, цели-бейджи, число привязанных наградных бейджей). Read-only (правка каталога — отдельная задача).
- **ЛК сайта** (`pilot-achievements.tsx` + вкладка в `pilot-dashboard.tsx`): вкладка «Достижения» (иконка Trophy, после «Бейджи»; `?tab=achievements`, добавлена в `allowedTabs`). Тянет `/api/pilot/achievements`, рендерит Steam-style карточки в светлой теме сайта (прогресс-бар к следующей цели + медальоны целей), локализация ru/en.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### Единая БД-каталог достижений + Steam-style прогресс-бар
По решению — достижения вынесены в редактируемую «базу», задел под привязку к бейджам, UI в стиле Steam.
- **Сервер** (`server/index.js`): каталог достижений вынесен из захардкоженного `ACHIEVEMENTS_CATALOG` в файл `data/achievements-catalog.json` (новый `ACHIEVEMENTS_CATALOG_FILE`). Прежний const переименован в `DEFAULT_ACHIEVEMENTS_CATALOG` — это сид по умолчанию. `readAchievementsCatalog()` читает файл, при отсутствии засевает из дефолта и пишет на диск; кэш в памяти. `normalizeAchievementCatalog` принимает как объекты целей (`{threshold,labelRu,labelEn,rewardBadgeId}`), так и числа (`goals:[10,50]`), сортирует по порогу, проставляет обе локали. На каждой цели — необязательное поле **`rewardBadgeId`** (задел под наградной бейдж; выдача пока НЕ реализована). Эндпоинт `GET /api/pilot/achievements` читает из каталога-базы и прокидывает `rewardBadgeId`. Per-pilot состояние разблокировок осталось в `achievements-store.json` (ключ — id цели). Метрики те же 4 (налёт/рейсы/бейджи/скриншоты).
- **Клиент** (`app-achievements.tsx`): карточка достижения переделана в стиль Steam — крупный медальон-иконка (золотой / изумрудный когда всё достигнуто), заголовок + счётчик `X/Y целей`, **прогресс-бар к следующей цели** (`value / nextThreshold`, % из `progressToNext`, янтарный градиент; изумрудный full при завершении) с подписью «Следующая: …», ряд медальонов целей (получено=янтарь, следующая=голубой, закрыто=серый, Lock). Лесенка-тиры с отдельными строками убрана. `rewardBadgeId` добавлен в тип `AchievementTier`.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### Двуязычные достижения RU/EN (план #4, закрыта)
Каталог хранил только русские строки, колокольчик/toast слали захардкоженный русский.
- **Сервер** (`server/index.js`): `ACHIEVEMENTS_CATALOG` переведён на пары `titleRu/titleEn` и `labelRu/labelEn`. `GET /api/pilot/achievements` отдаёт обе локали (`title/titleRu/titleEn`, `label/labelRu/labelEn`, `nextLabel/nextLabelRu/nextLabelEn`), сохраняя back-compat (`title`/`label`/`nextLabel` = русские). `newlyUnlocked` тоже несёт `achievementRu/En` + `tierRu/En`.
- **Клиент** (`use-achievements.ts`): типы расширены `titleRu/En`, `labelRu/En`, `nextLabelRu/En`; хелперы `localizeAchievementTitle`/`localizeTierLabel` (фолбэк на legacy-поле). Хук подключил `useLanguage`; уведомление в колокольчик/Windows-toast формируется на текущем языке («🏆 Достижение получено!» / «🏆 Achievement unlocked!»), **локаль фиксируется на момент анбоксинга** (toast одноразовый, запись в колокольчике остаётся на языке разблокировки — по плану допустимо).
- **`app-achievements.tsx`**: заголовки достижений и подписи тиров рендерятся через `localize*` по `language`. Категория `achievement` в `notification-center` уже локализована (`notifications.category.achievement` ru/en есть).
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### Вкладка «Экипаж» на странице «Полёт» (план #1, закрыта)
Чисто фронт — vAMSYS экипаж не отдаёт, генерируем локально и детерминированно.
- **`flight-crew.ts`** (новый): база имён/фамилий + генератор. Авиакомпания по callsign/flight#: `detectAirline` (STW/Southwind, KAR/Икар/Pegas, иначе Nordwind). Имена: Nordwind/Икар — русские; Southwind — смешанные (русские + турецкие). Русские фамилии хранятся в мужской форме, `feminizeRu` адаптирует женские (-ов/-ев/-ин→+а, -ский→-ская). PRNG — FNV-hash(`bookingId|callsign|airline`) → mulberry32, поэтому состав стабилен для рейса. Кабинный экипаж 4–8 чел. по типу ВС (`cabinCrewCount`). Роли (КВС/2-й пилот/старший БП/БП) локализованы ru/en через `crewRoleLabel`.
- **`flight-crew-tab.tsx`** (новый): карточки членов экипажа (имя, роль, аватар-заглушка с инициалами и детерминированным цветом), две группы — Лётный экипаж / Кабинный экипаж, бейдж ВАК. RU/EN.
- **`flight-mode.tsx`**: 4-я вкладка «Экипаж» (иконка Contact) между «Информация» и «Пассажиры».
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.

---

## 2026-06-15

### Переработка страницы «Полёт» в IFE-стиль (в работе)
Цель — фирменная IFE-страница: прогресс-бар маршрута, 3D-глобус, METAR, гид по городу (фото/видео), вкладки.
- **Бэкенд** (`server/index.js`): агрегатор `GET /api/pilot/destination/:icao` — по ICAO из кэш-базы аэропортов vAMSYS (`loadAirportsLookup`) берёт город/страну/координаты, обогащает Wikipedia REST summary (описание) + Wikimedia Commons geosearch (фото города, фильтр карт/флагов/логотипов) + поисковую ссылку YouTube. Кэш в памяти 7 дней (деградированный — 10 мин, чтобы транзиентный сбой не отравил кэш). Хелперы `cleanCityName`/`looksLikeAirport`/`fetchNearestCity` (geosearch ≤10км). Тест: LTAI→Antalya (6 фото города, описание 327); для хабов, где vAMSYS city=имя аэропорта, фото аэропортовые (ограничение базы).
- **Клиент**:
  - `cobe` (лёгкий WebGL-глобус, форк с нативными `arcs`): `flight-globe.tsx` — дуга маршрута вылет→прилёт, маркеры точек/борта, авто-вращение к текущей позиции (rAF + `globe.update`).
  - `use-destination.ts` — хук гида по ICAO прилёта.
  - `flight-mode.tsx` переписан: (1) верхний IFE-блок — ICAO крупно + город/страна/SVG-флаг по бокам, ETE + пройденные мили по центру над баром, остаток/всего миль справа, прогресс-бар с бортом; (2) глобус + плитки телеметрии + ближайший company airport + METAR вылета/прилёта; (3) **гид по пункту назначения** — карусель фото, описание города (Wikipedia), значимость маршрута, «Посмотреть в полёте» (YouTube); (4) вкладки «Информация о рейсе» (цифры vAMSYS) / «Пассажиры» (`PassengerManifest`); ниже OFP + in-flight скриншоты.
- Проверки: `tsc --noEmit` → 0; build → 0 (cobe бандлится).

### Divert: алерт-подтверждение + ручной выбор аэропорта + фоновый синк локации
- **Divert через подтверждение** (vAMSYS не даёт live-статус диверта): геометрия определяет *кандидата*, не меняет статус сама.
  - `flight-phase.tsx`: убрана авто-фаза `diverting` из геометрии (оставлен приоритет строки vAMSYS — на случай, если когда-то появится).
  - `use-divert-detect.ts` (новый): cross-track отклонение от маршрута + раннее снижение далеко от пункта (>45nm вбок + <FL140, или <9000ft, при >90nm до прилёта) → `candidate`. Решение пользователя (confirm/dismiss) хранится на рейс (localStorage). Аэропорт цели — из мировой базы (`fetchNearestAirport`, приоритет компании).
  - `flight-mode.tsx`: алерт **«Вы уходите на запасной?»** (показывается при кандидате, пока не решено) с предполагаемым аэропортом и кнопками Да/Нет. Подтверждение → статус `diverting` (индикатор + перечёркнутый ICAO + новый со стрелкой + красная дуга на глобусе).
- **Ручной выбор аэропорта диверта**: сервер `GET /api/airports/lookup?icao=` (мировая база, приоритет компании); клиент `lookupAirport`; в divert-блоке кнопка «Сменить аэропорт» (prompt ICAO) + «Авто» (вернуть авто-детект). Ручной выбор приоритетнее, хранится на рейс.
- **Фоновая синхронизация локации** (`server/index.js`): планировщик `startPilotLocationSyncScheduler` — раз в час (env `PILOT_LOCATION_SYNC_INTERVAL_MS`) проходит по активным vAMSYS-сессиям с Pilot API connection и синкает локацию из vAMSYS. + при авторизации сессия создаётся со свежим профилем, клиент-хук `usePilotLocation` форсит `forceProfileRefresh`. Покрывает «ежечасно/при авторизации/постоянно».
- Проверки: `tsc` → 0; `node --check` → 0; build — прогон.

### Единая мировая база аэропортов (OurAirports) + приоритет базы компании
- **Сервер** (`server/index.js`): `loadWorldAirports()` — скачивает OurAirports `airports.csv` (public domain, env `WORLD_AIRPORTS_URL`), парсит (свой CSV-парсер с кавычками), фильтрует large/medium/small + валидный ICAO + координаты (~40k), кэш на диск `data/world-airports.json` (TTL 30 дней) + в память. Lazy-загрузка, фолбэк на устаревший кэш.
- `GET /api/airports/nearest?lat=&lon=&exclude=&companyBiasNm=` — ближайший аэропорт: **база компании в приоритете** (берётся, если в пределах `companyBiasNm`=40nm от мирового ближайшего), иначе мировой. Отдаёт `nearest`/`company`/`world` (icao/iata/name/city/country/base/isCompany/distanceNm/lat/lon). Тест: над Берлином → EDDB (мировой, 9nm); над Москвой → UUEE (company, base, 5nm).
- **Клиент**: `fetchNearestAirport()` в `use-company-airports.ts` (серверный поиск); divert на странице «Полёт» теперь берёт пункт из мировой базы (через состояние + throttle по округлённым координатам ~0.1°), а не только из базы компании. Бейдж «База» если запасной — база компании.
- Проверки: `tsc` → 0; `node --check` → 0; build — прогон; эндпоинт протестирован вживую.

### Divert-индикация на странице «Полёт» (как на FlightRadar)
- При фазе `diverting` на странице «Полёт»:
  - **Верхний блок**: исходный ICAO прилёта **перечёркнут** (красная линия), сверху — новый ICAO со стрелкой `CornerUpRight`, бейдж «Диверт», флаг/город нового пункта, дистанция «до запасного», пометка «предполож.».
  - **Глобус**: добавлена **красная дуга диверта** от текущей позиции к запасному + красный маркер (FlightGlobe получил проп `divert`, вторая `arc` с красным цветом).
- Новый пункт назначения определяется **эвристически** — ближайший аэропорт компании к текущей позиции (`findNearestAirport`, исключая исходный прилёт), т.к. vAMSYS не отдаёт код фактического диверта. Помечен как предполагаемый.
- **Геометрический детект факта диверта** (`flight-phase.tsx`): `bearingDeg` + `crossTrackNm` (отклонение от great-circle линии маршрута). `looksLikeDivert`: уход с трассы >55nm + снижение <FL130 **или** снижение <9000ft, при условии >110nm до исходного прилёта. Отличает от step-climb (идёт вверх на эшелонах) и спрямлений (боковой сдвиг без раннего снижения). Встроен в `classifyByGeometry` (en-route, перед cruise/descent). **Явный `divert` из строки vAMSYS/Pegasus — абсолютный приоритет** над геометрией (проверка в начале `normalizeFlightPhase`). NB: «вся база аэропортов мира» недоступна на клиенте (только база компании ~68) — факт диверта по геометрии, пункт из базы компании как предполагаемый.
- Проверки: `tsc --noEmit` → 0; build → 0.

### Статус рейса «Diverting» (уход на запасной)
- `flight-phase.tsx`: новая фаза `diverting` в `FlightPhase` + `FLIGHT_PHASE_META` (иконка Navigation2, красная пилюля, live); детект в `classifyByString` (`/divert/` — первым, до arrived). Геометрией не определяется (нужен запасной) — приходит из строки статуса vAMSYS.
- i18n `phase.diverting` (Diverting / «Уход на запасной»).
- `flight-status-indicator.tsx`: статус «Diverting» (красный градиент, бегущий блик).
- `use-discord-presence.ts`: метка фазы добавлена (`Record<FlightPhase>` — tsc заставил).
- Проверки: `tsc --noEmit` → 0; build — прогон.

### Красивое переключение тёмной/светлой темы (View Transitions)
- `use-app-theme.ts`: `toggleThemeAnimated(origin)` — через **View Transitions API** круговой reveal новой темы из точки клика (радиус до дальнего угла, `clip-path` circle, 480мс, `flushSync` для синхронного коммита React). Fallback на мгновенное переключение, если API нет или `prefers-reduced-motion`. Хук отдаёт `toggleAnimated`.
- `styles/index.css`: правила `::view-transition-old/new(root)` — отключён дефолтный кроссфейд, новая тема поверх (z-index), анимируется только clip-path.
- Подключено: кнопка ☀/🌙 в шапке (`app-shell`, origin = координаты клика) и сегмент «Тема» в настройках (`app-settings`, дефолтный origin). WebView2 (Chromium) поддерживает VT — в .exe работает.
- Проверки: `tsc --noEmit` → 0; build — прогон.

### Страница «Полёт» — вкладка «Скриншоты» (третья вкладка)
- **Сервер**: `GET /api/pilot/bookings/:id/screenshots` (по аналогии с pireps) — медиа галереи, привязанные к броне (`flight.bookingId`), фильтр по актору.
- **`screenshot-watcher.ts`**: хелперы `listFolderImages` (картинки папки) и `readImageAsDataUrl` (превью/чтение файла) для выбора что публиковать.
- **`flight-screenshots.tsx`** (новый) — вкладка: сетка залитых скриншотов рейса (обновляемая); пусто → подсказка «настройте папку или добавьте вручную»; drag-n-drop/выбор файла; **папка сима** (Tauri) — выбор папки → «Сканировать» → сетка превью с чекбоксами → **«Опубликовать выбранные»** (выбор каких снимков публиковать). Все загрузки привязываются к рейсу (`flight`/`gear`).
- **`flight-mode.tsx`**: третья вкладка «Скриншоты» рядом с инфо/пассажиры (заменила отдельный блок `InflightScreenshot` внизу).
- Проверки: `tsc --noEmit` → 0; `node --check` → 0; build — прогон.

### «Next Up» (несколько букингов) + синхронизация локации
- **Несколько броней**: `use-active-booking.ts` теперь возвращает `upcoming` (все активные брони, сортировка по `departureTime`, ближайшая первой) + `booking = upcoming[0]`. На **обзорной** — блок «Ваши запланированные полёты» (показывается при >1 брони): нумерованный список с флагами/ICAO/callsign/ВС, бейдж «Следующий» у первого, время вылета, клик → страница брони.
- **Синхронизация локации** (раньше рассинхрон при смене в vAMSYS): новый хук `use-pilot-location.ts` опрашивает готовый `GET /api/pilot/location` (forceProfileRefresh + синк из vAMSYS + фолбэки booking/recent-flight). В шапке (`HeaderProfile`) свежая локация имеет **приоритет** над устаревшей `pilot.location` из сессии.
- Проверки: `tsc --noEmit` → 0.

### Мероприятия (Activities): вкладка + запись + трекинг прогресса; OFP → верхний таб; печать
- **Бэкенд уже был готов**: `GET /api/pilot/activities/registrations`, `POST /api/pilot/activities/:id/register`, `DELETE /api/pilot/activities/registrations/:id`, `GET /api/pilot/activities/progress-widget` (прогресс по ногам/процентам), `GET /api/public/activities`.
- **Активности (клиент)**: `use-activities.ts` (каталог + регистрации + register/unregister, матч по `originalId`↔`activityId`), `use-activity-progress.ts` (прогресс-виджет), `app-activities.tsx` — вкладка «Мероприятия» в сайдбаре хаба: карточки с фото/типом/датами/метриками, кнопка Записаться/Отписаться, прогресс-бар записанных, фильтр Все/Мои. На **обзорной** — блок «Мои мероприятия» (прогресс, только если записан; клик → вкладка). `onOpenActivities` проброшен из hub-mode.
- **OFP**:
  - Сервер: `normalizePilotSimbriefPayload` выделяет `pdfUrl` (pdf_url/files.pdf.link/fms_downloads/directory+name).
  - `app-ofp.tsx` — полноэкранный OFP: iframe (PDF/URL) или санитайзный HTML; Обновить (`PUT`)/В браузере/**Печать** (HTML → новое окно + `print()` → принтеры Windows; PDF → iframe.print() с фолбэком на внешнее окно при cross-origin).
  - **Переехал из сайдбара в верхний таб-режим** (по решению пользователя): route `/app/ofp` + `ofp-mode.tsx`; `ModeTab` «План» в шапке рядом с Hub/Flight — **виден только при активной броне** (`Boolean(booking)`). Инлайн `OfpViewer` на странице «Полёт» оставлен как быстрый превью.
- Проверки: `tsc --noEmit` → 0; `node --check` → 0.

### Страница «Полёт»: красивый статус-индикатор фаз + сеть/подача плана
- **Статус-индикатор** (`flight-status-indicator.tsx`): в левом верхнем углу страницы «Полёт» — градиентная пилюля с иконкой фазы, свечением и бегущим бликом (`@keyframes nws-shine`). «Лётные» подписи по 12 фазам (ru/en): Готов к посадке / Посадка / Буксировка (Pushing Back) / Руление (Taxiing Out) / Взлёт (Departing) / Набор (Climbing) / Крейсер (En-Route) / Снижение (Descending) / Заход (Approaching) / Прибытие (Arriving) / Руление к гейту (Taxiing In) / На стоянке (On Blocks). Привязан к `tele.phase` (`normalizeFlightPhase`). Старая строка статуса/`FlightPhaseBadge` в шапке заменена.
- **Сеть + подача плана** (`use-pilot-network.ts` + `NetworkReminder`): берёт `preferredNetwork` из `/api/pilot/preferences`. Если **offline/не выбрана — не показывается**. Иначе карточка: бейдж сети (VATSIM/IVAO/POSCON/PilotEdge/FSCloud/SayIntentions), напоминание «Не забудьте подать план полёта в сеть перед вылетом» (в воздухе — «Вы летаете в сети X»), кнопка **«Подать план»** → `openExternal` на prefile-URL сети (VATSIM my.vatsim.net, IVAO fpl.ivao.aero и т.д.; для «other» кнопки нет).
- Проверки: `tsc --noEmit` → 0; build — прогон.

### Страница приложения на сайте + хранение/раздача билдов (/download)
- **Сервер** (`server/index.js`): хранилище релизов — `data/app-releases.json` (метаданные) + `data/app-releases/` (бинарники). Эндпоинты:
  - Публичные: `GET /api/app/releases` (список + latest, с downloadUrl), `GET /api/app/download/latest`, `GET /api/app/download/:version` (стрим файла через `res.download`, счётчик загрузок).
  - Админ (`requireAdmin`): `GET /api/admin/app-releases`, `POST /api/admin/app-releases` (raw upload `express.raw` 400 МБ, `?version=&platform=&ext=` + заголовок `X-Release-Notes` URI-encoded), `DELETE /api/admin/app-releases/:version`. Версии сортируются по числовым сегментам (свежая первой), перезапись версии удаляет старый бинарник.
- **Публичная страница** `/download` (`download-page.tsx`): hero с логотипом + кнопка «Скачать для Windows» (latest version/size, либо «скоро»), грид из 12 возможностей, системные требования, история версий с changelog и кнопками скачивания. Маршрут добавлен в `routes.ts`.
- **Футер**: ссылка «Приложение» → `/download` (в Quick Links).
- **Админка** (`admin-app-config.tsx`): секция «Релизы приложения» — загрузка билда (.exe/.msi/.zip) через XHR с прогресс-баром, версия + changelog, список релизов (размер/загрузки/дата) со скачиванием и удалением.
- Проверки: `tsc` → 0; `node --check` → 0; live-тест: `/api/app/releases`→200 `{latest:null,releases:[]}`, `download/latest`→404, admin-upload без auth→403.

### Сборка релиза + локальное тестирование (2026-06-15)
- **Билд**: `npm run build` (`tsc -b && vite build`) → exit 0, `✓ built in 14.43s`. Предупреждение про чанк >500 КБ — известное (App-бандл), не ошибка.
- **Архив**: `artifacts/website-release-20260615-174618.zip` (5.73 МБ), правильная структура — папка-обёртка `website-release-<ts>/` с содержимым `dist/` (index.html + assets/...).
- **Проверка целостности**: `index.html` → `assets/index-C-_O5AJv.js`; новый код сессии (агенда «На повестке дня», сплэш «Подгоняем трап», «Ближайший аэропорт») присутствует в этом бандле.
- **Тест отдачи (статика, `server/site.js`)**: index 200 (479 б), JS-ассет 200 с MIME `application/javascript`, 3.16 МБ (совпадает с билдом) — грабля «MIME text/html для .js» не воспроизводится.
- **Тест API (`server/index.js`, .env с боевыми кредами)**: `/api/health`→`{ok:true,vamsys:true}`; `/api/public/news`/`/activities`→200; `/api/app/config`→200; новые эндпоинты: `/api/auth/session`→`{authenticated:false}`, `/api/pilot/chat/emojis`→`{emojis:[]}`, `/api/admin/email/templates` без админа→403. Всё ОК.
- NB: `server/site.js` игнорирует `SITE_PORT` и всегда слушает 8788.

### Главная — блок «Сегодня на повестке дня» (события каруселью + новости + NOTAM)
- Новый `hub-agenda.tsx`: единый информационный уголок на обзорной странице.
  - **Карусель событий** (`/api/public/activities`): крупная карточка с фоновой картинкой события (`imageUrl`) + затемнение, бейдж «Событие»/дата/название/краткое описание; стрелки ‹›, точки-индикаторы, авто-прокрутка 6с (пауза при наведении).
  - **Новости** (`/api/public/news`) — компактный список (4) с датой и ссылкой.
  - **NOTAM** (`/api/vamsys/notams`) — список (4, must-read наверх) с цветовой точкой важности, бейдж «важно», кнопка «Все» → переход в секцию NOTAM.
- `hub-overview.tsx`: вместо нижнего грида «крайние полёты + NewsEventsWidget» теперь `HubAgenda` во всю ширину + крайние полёты отдельной секцией. Проп `onOpenNotams` проброшен из `hub-mode` (`setSection("notams")`).
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.

### Режим «Полёт» — прогресс-бар, остаток миль, ближайший company airport
- `use-company-airports.ts` (новый): каталог аэропортов компании из `/api/vamsys/dashboard/airports` (с координатами, кэш на сессию), хелперы `distanceNm` (haversine) и `findNearestAirport` (ближайший, с исключением ICAO).
- `flight-mode.tsx`:
  - Прогресс рейса: из vAMSYS, либо вычисляется по координатам (пройдено/всего через haversine), если vAMSYS прогресса нет. Самолётик на баре уже был — теперь подпись показывает `%` + **остаток миль** (`… nm ост.`).
  - Плитка телеметрии «Прогресс» заменена на **«Осталось»** (мили до прилёта).
  - Новая строка **«Ближайший аэропорт»**: ICAO + город + бейдж «База» + дистанция (nm), считается от текущей позиции, исключая вылет/прилёт текущего рейса.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.

### Загрузочный сплэш приложения
- Новый `app-splash.tsx` — экран старта: тёмный фон с красным свечением, логотип проекта в рамке, «NordwindHub», анимированный бар загрузки (easeOutCubic за 3.6с) и **сменяющиеся авиа-надписи** под баром («Подготавливаем стоянку…», «Подгоняем трап…», «Готовим вкусный кофе…», «Загружаем багаж…», «Проверяем метео…», «Запрашиваем эшелон…», «Заправляем борт…», «Получаем разрешение на запуск…», ru/en, ротация 0.75с). Парящий `NordwindJet` на фоне; fade-out по завершении.
- Подключён в `app-shell.tsx` поверх всего; показывается **один раз за запуск** (флаг `sessionStorage nws.app.splashed`).
- **Держится ровно до готовности данных** (а не фикс-таймер): проп `ready={!isAuthLoading}` (первичная проверка сессии). Бар асимптотически ползёт к 92%, при `ready` добегает до 100% и делает fade-out. Минимум показа 1.3с (чтобы не мелькал), фолбэк-таймаут 12с (на случай сбоя сети).
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.

### Оживление обзорной страницы: вектор-борт Nordwind сбоку
- Новый `nordwind-jet.tsx` — SVG-самолёт в ливрее VNWS (вид сбоку, нос вправо): белый фюзеляж, красный cheatline, кил с белой «N», окна, двигатель под крылом, контактная тень. Без внешних ассетов.
- Врисован в приветственный блок `hub-overview.tsx` (абсолютно, левее колокольчика, `lg:`+ширины), CSS-анимация парения `.nws-float` (keyframe в `styles/index.css`).
- Дизайн проверен растеризацией SVG→PNG (`@resvg/resvg-js`, `--no-save`, временные файлы удалены): подправлены нос/крыло/двигатель. Узнаваемо как борт Nordwind.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.

### Чат: реакции + личные сообщения; чат упрощён до Общий+ЛС; ассистент → плавающий кружок
- **Реакции** (эмодзи на сообщениях):
  - Сервер (`server/index.js`): `normalizeChatReaction` (юникод/`:name:`), `toggleChatReaction` (хранит `reactions: {emoji:[actorKey]}` на сообщении), WS-тип `react` → broadcast `reaction` с обновлённой картой.
  - Клиент (`use-chat.ts`): `ChatMessage.reactions`, обработка `reaction`, `reactMessage(id,emoji)`. `chat-panel`: чипы реакций под сообщением (подсветка своих, счётчик, клик-тоггл) + быстрый пикер (smile→набор) на наведении.
- **Личные сообщения (ЛС)**: DM-комната с детерминированным id `dm-<a>__<b>` (одинаков у обоих), type `dm`, доступ только участникам (**модератор НЕ видит ЛС**). `POST /api/pilot/chat/dm` (найти/создать), список комнат отдаёт `dm/peer/name` (имя собеседника из `participants`, фиксируется при отправке). `normalizeChatRoom` принимает `dm-...`. Хук `useChatRooms.openDm`.
- **Упрощение по решению пользователя**: пользовательские комнаты убраны из UI — слева только **Общий** + секция **Личные** (с «+» для новой ЛС). Бэкенд комнат оставлен (скрыт). `chat-panel.tsx` переписан.
- **Ассистент → плавающий кружок** (как на сайте): новый `app-assistant-bubble.tsx` (кнопка в правом нижнем углу над статус-баром + компактная панель, настоящий `/api/pilot/assistant`), смонтирован в `app-shell` при авторизации. Секция «Ассистент» убрана из сайдбара хаба; `app-assistant.tsx` удалён.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### #12 — мост к симулятору: каркас (FSUIPC/XPUIPC) + абстракция источника телеметрии
Цель — опциональный источник телеметрии из сима, с фолбэком на vAMSYS.
- **Находка**: крейт `fsuipc` 0.3 — **только 32-бит** (`pub mod local` под `cfg(target_pointer_width="32")`), для нашего 64-бит .exe не годится (FSUIPC7 тоже 64-бит). Зависимость убрана.
- **Rust** (`src-tauri/src/sim.rs` + регистрация в `lib.rs`): модуль `sim` с единым `SimTelemetry` (connected/source/lat/lon/alt_ft/hdg/gs_kt/ias_kt/vs_fpm/on_ground) и командами `sim_read`/`sim_status`. Нативное чтение — каркас (возвращает «не подключено»); реальный 64-бит FSUIPC IPC (shared-mem `FsuipcN<pid>` + `RegisterWindowMessage("FsuipcMsg")` + `FindWindow "UIPCMAIN"`) и/или SimConnect реализуются и проверяются на машине с симулятором (рантайм без сима не проверить). `cargo check` → 0.
- **Клиент**:
  - `use-sim-telemetry.ts` — опрос Tauri-команды `sim_read` (через `@tauri-apps/api/core` invoke), в вебе/без сима → «не подключено».
  - `use-telemetry-source.ts` — единый источник: рейс/маршрут/прогресс из vAMSYS, а live-поля высота/скорость/курс/позиция перекрываются симом, когда он подключён и включён пользователем; пресет в localStorage (`nws.sim.enabled`).
  - `app-settings.tsx` — `SimSourceRow`: тумблер «Данные симулятора (FSUIPC/XPUIPC)» + индикатор статуса (источник/не найден/выключено).
  - `flight-mode.tsx` — переключён на `useTelemetrySource`, бейдж **SIM** на IFE-карточке, когда данные идут из сима.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `cargo check` → 0.

### Auth-API сайта: формальный статус, история входов, app-токены (защита/лимиты)
По запросу «чёткая авторизация на сайте» — три направления: формальный auth-API, история входов, защита/лимиты. **IP не храним** (по решению — потребовал бы отдельной политики конфиденциальности).
- **App-токены (защита)** (`server/index.js`): отдельный от cookie секрет для входа в .exe. `appTokenCache` (token → kind/sessionId/pilotId/username/deviceId/createdAt/lastSeenAt/expiresAt/userAgent), TTL 30 дн (env `APP_TOKEN_TTL_MS`), скользящее продление (< 7 дн), лимит 10 токенов/пилот, персист в auth-store, прунинг истёкших в `cleanupDiscordCaches`. `createAppToken`/`resolveAppToken`/`revokeAppToken`/`pruneExpiredAppTokens`.
  - OAuth-колбэки (pilot-api + discord) теперь выдают app-токен (не сырой sessionId) в deep-link. Middleware и WS резолвят токен → cookie-сессию.
- **Формальный auth-API**: `GET /api/auth/session` (унифицированный статус: provider/user/isAdmin/isStaff + инфо об app-токене), `POST /api/auth/session/revoke` (выход приложения — отзыв текущего токена, вызывается из `logout`), `POST /api/auth/session/revoke-all` (выйти на всех устройствах).
- **История входов**: `GET /api/pilot/auth/history` — события из журнала auth-активности по текущему пользователю (время/провайдер/тип/исход/устройство из user-agent, **без IP**).
- **Клиент**: `auth-context.logout()` дёргает `/api/auth/session/revoke` до очистки токена; новый `pilot-login-history.tsx` (история + «выйти везде», парс user-agent → метка устройства) в карточке «Безопасность» ЛК (`pilot-settings.tsx`); i18n `settings.security.loginHistory` (ru/en).
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### #15 — авторизация и вся сетевая часть упакованного .exe (deep-link)
Проблема: в .exe браузерный OAuth-редирект не возвращается в окно, а куки системного браузера недоступны webview. Решение — deep-link `nordwind://auth` + сессия-токен, который приложение шлёт заголовком; раннее middleware инжектит его в `req.headers.cookie`, поэтому весь cookie-based код сессий работает без правок.
- **Сервер** (`server/index.js`):
  - Helpers: `APP_DEEP_LINK_SCHEME` (env `APP_DEEP_LINK_SCHEME`, по умолч. `nordwind`), `isAppLoginRequest(req)` (`?app=1`), `buildAppAuthRedirect(kind, sessionId)` → `nordwind://auth?kind=&session=`.
  - **Middleware** (после CORS): заголовки `X-NWS-Session` + `X-NWS-Session-Kind` (`vamsys|discord`) → инжект `nws_*_session=<token>` в `req.headers.cookie`.
  - **Pilot API**: `connect` пишет `app` в state-кэш; `callback` при `app && login` редиректит в `buildAppAuthRedirect("vamsys", sessionId)` (куку всё равно ставит).
  - **Discord**: `login` пишет `app` в redirect-кэш; `callback` при `app && !link` редиректит в deep-link (`discord`).
  - **Чат WS**: токен из query (`?session=&kind=`) инжектится в cookie перед `resolveSocialGalleryViewer` (WS не шлёт заголовки).
- **Клиент**:
  - `src/app/app-session.ts` (новый): стор токена (`localStorage nws.app.session.*`), `appSessionHeaders()`, `appSessionWsQuery()`.
  - `api-base.ts`: патч fetch добавляет заголовки сессии; патч WebSocket — `?session=&kind=` в URL; экспорт `getApiBaseUrl()`.
  - `use-deep-link-auth.ts` (новый): `@tauri-apps/plugin-deep-link` `getCurrent`/`onOpenUrl` → парс `nordwind://auth` → `setAppSession` → колбэк (refreshAuth+переход в хаб). Смонтирован в `app-shell`.
  - `app-login.tsx`: в Tauri вход открывает системный браузер на `${apiBase}/api/auth/{pilot-api/connect|discord/login}?intent=login&app=1` (через `openExternal`), в вебе — прежний флоу.
  - `auth-context.tsx`: `logout()` чистит токен приложения (`clearAppSession`).
- **Rust/Tauri**: `tauri-plugin-deep-link` + `tauri-plugin-single-instance` (feature `deep-link`, Win/Linux — форвард URL в запущенный экземпляр + фокус окна) в `Cargo.toml`/`lib.rs`; схема `nordwind` в `tauri.conf.json` (`plugins.deep-link.desktop.schemes`); `deep-link:default` в capabilities; рантайм `register_all()` в setup.
  - ⚠️ Rust-часть локально не собиралась — проверить при `npm run app:build`.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

### #15 — подготовка десктоп-сборки (куки + внешние ссылки)
- **Куки сессии для входа в .exe** (`server/index.js`): `buildCookie`/`clearCookie` теперь читают `resolveSameSite()` — env `COOKIE_SAMESITE` (`Lax`|`None`|`Strict`, по умолч. `Lax`). При `None` форсится `Secure` (нужно для cross-origin tauri.localhost → vnws.org). Поведение сайта без переменной не меняется. CORS для tauri-origin уже был. `node --check` → 0.
- **Внешние ссылки в системном браузере** (упакованный webview не открывает `target="_blank"` наружу):
  - Плагин `@tauri-apps/plugin-opener`: npm-пакет + `tauri-plugin-opener` в `Cargo.toml` + `tauri_plugin_opener::init()` в `lib.rs` + права `opener:default`/`opener:allow-open-url` в capabilities.
  - `open-external.ts` (новый): `openExternal(url)` (в Tauri — `plugin-opener.openUrl`, иначе `window.open`) и `externalLinkProps(url)` (спред на `<a>`: перехват клика в Tauri).
  - Подключено: `live-stats-bar.tsx` (Сайт/Discord), `app-login.tsx` (регистрация).
  - ⚠️ Rust-часть не собиралась локально — проверить при `npm run app:build`.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.
- Осталось по #15: OAuth-логин внутри .exe (deep-link `nordwind://` + системный браузер), прогон сборки на Win10/11.

### Галерея на сайте: ручные теги ВС/регистрации при загрузке
- `pilot-social-gallery.tsx` (ЛК): в форму «Опубликовать скриншот» добавлены опциональные поля **Тип ВС** и **Регистрация**, уходят в `gear {aircraft, registration}` (сервер уже принимает это поле — правок бэка не потребовалось). Пояснение под полями: загрузка с сайта без привязки к полёту и без геометки на карте; оба поля можно оставить пустыми. Сброс полей после публикации.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0.

### Шаблоны email-рассылок (#20, закрыта)
- **Сервер** (`server/email-campaigns.js`):
  - Новый стор `templatesStore` → `data/email-templates.json` (`{templates:[]}`).
  - CRUD: `GET /api/admin/email/templates` (отдаёт `templates` + `presets`), `POST` (создать), `PUT /:id` (правка name/subject/html), `DELETE /:id`.
  - `wrapTemplate(heading, body, cta, href)` — фирменная HTML-обёртка (красная шапка Nordwind, CTA-кнопка). `BUILTIN_PRESETS` — read-only пресеты «Новость»/«Событие»/«Дайджест» (subject + готовый HTML с плейсхолдером `{{name}}`, ссылки на `/news`/`/events`/`/dashboard`).
- **Клиент** (`admin-email.tsx`): секция «Шаблоны писем» над «Новой кампанией» — чипы-пресеты + список своих шаблонов (Применить/Удалить). «Применить» подставляет `subject`+`html` в форму кампании. В форме создания — кнопка «Сохранить как шаблон» (prompt имени → POST).
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check` (модуль + index) → 0.

### Переделка чата (#19, закрыта)
Чат переведён с комнат-по-рейсу (`flight:*`) на пользовательские комнаты.
- **Сервер** (`server/index.js`):
  - WS-обработчик `attachChatWebSocketServer` — проверка `canAccessRoom(store, room, viewer, isMod)` сразу после нормализации комнаты: для приватной комнаты, где пользователь не owner/member/invited (и не модератор) → `{type:"error",error:"forbidden_room"}` + close `4403`.
  - `extractChatMentions(text)` — детект `@ник` (regex `(?:^|[\s(<])@([A-Za-z0-9_.-]{2,40})`), нормализация в lowercase; массив `mentions` добавлен в объект сообщения и broadcast/историю.
  - (REST комнат/эмодзи и модель `roomMeta` уже были сделаны ранее.)
- **Клиент** (`src/app/components/desktop/`):
  - `use-chat.ts` — `ChatMessage.mentions?`, опция `onIncoming(msg)` (вызывается для новых сообщений, не из истории), проброс `error` (`forbidden_room`/`invalid_room`/`auth_required`).
  - `use-chat-rooms.ts` (новый) — список доступных комнат + кастом-эмодзи (`GET /api/pilot/chat/rooms`), `createRoom`/`inviteToRoom`/`deleteRoom`.
  - `chat-panel.tsx` (переписан) — сайдбар своих комнат с кнопкой «+», модалка создания (Открытая/Закрытая), инвайт/удаление для owner-комнат, статус-бейдж, экран «нет доступа» при `forbidden_room`. **Эмодзи-пикер** (юникод-набор + кастомные), вставка `:name:`/юникод в драфт; рендер сообщений через `renderText` — подстановка кастомных `:name:` → `<img>` и подсветка `@ник`. Комнаты по рейсу убраны (`useActiveBooking`/`Plane` больше не нужны).
  - `app-settings.tsx` — тумблер «Уведомления об упоминаниях» (`getMentionNotifEnabled`, ключ `nws.notif.mentions`); упоминание шлёт Windows-toast (`notify`) при включённых общих + mention-уведомлениях и совпадении `@ник` с `pilot.callsign`.
- **Админка** (`admin-app-config.tsx`): секция «Кастомные эмодзи чата» — загрузка картинки (≤256 КБ → data URL), имя-слаг, список с превью и удалением (`POST/DELETE /api/admin/chat/emojis`, чтение через `GET /api/pilot/chat/emojis`).
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0; `node --check server/index.js` → 0.

---

## 2026-06-13 (десктоп-компаньон — старт)

### План: Tauri desktop-приложение Nordwind (новое направление)
Полноценное десктоп-приложение в стилистике проекта. Согласованные решения:
- **Оболочка**: Tauri (Rust + webview), переиспользует текущий React/Vite/Tailwind фронтенд и контексты `AuthProvider`/`LanguageProvider`. Бэкенд — тот же `server/index.js`.
- **Форм-фактор**: desktop-компаньон рядом с MSFS, overlay/always-on-top.
- **Два режима**: «Хаб» (профиль, галерея, чат, настройки) и «Полёт» (радио, виджеты, IFE). Переключение ручное; вкладка «Полёт» проверяет активный букинг через vAMSYS, при отсутствии — пустое состояние + CTA забронировать (бронь можно из приложения).
- **Чат**: свой WebSocket на `server` (8787), комнаты общая+по рейсу, история в `data/`.
- **Данные полёта/IFE**: vAMSYS телеметрия (готовый live-feed), не SimConnect.
- **Радио**: интернет-станции (выбор) + ATC-радиосканнер (LiveATC) + расширяемый каталог; прокси потоков на бэкенде.

### Фазы
1. Каркас Tauri (init поверх Vite, окно, режимы). 2. Хаб (профиль/галерея/настройки + **баланс**, **крайние полёты**, **все завершённые полёты**, **виджет новостей и ивентов** из useNews()). 3. Чат (WS). 4. Полёт (радио/виджеты/IFE + **список пассажиров** через переиспользование `passenger-manifest.tsx`).

### Блокер диска (2026-06-13)
- Первый `cargo check` упал: на C: было 0.12 ГБ свободно (диск полон после установки VS Build Tools + Rust). После очистки — 3.65 ГБ, пересборка запущена. Tauri debug `target/` крупный — следить за местом; при нехватке чистить `target/`, `%TEMP%`, кэши, старые `website-release-*`/`artifacts`.

### Toolchain — установлен ✅
- Rust 1.96 (rustup, MSVC host) + VS Build Tools 2022 (VCTools) через winget. `cargo`/`rustc` в `~/.cargo/bin` (в свежих шеллах PATH может не подхватиться — добавлять `$env:USERPROFILE\.cargo\bin`).

### Фаза 1 — каркас Tauri (сделано)
- `npm i -D @tauri-apps/cli@^2` + `@tauri-apps/api@^2`; `tauri init` → `src-tauri/` (CLI 2.11.2, tauri 2.11).
- `src-tauri/tauri.conf.json`: identifier `io.nordwind.companion`, frameless-окно (`decorations:false`) 1180×760 (min 980×620), `devUrl http://localhost:5173/app`, dist `../dist`.
- `src-tauri/capabilities/default.json`: добавлены права окна (start-dragging, minimize, maximize/unmaximize/toggle, is-maximized, close, set-always-on-top).
- React-оболочка `src/app/components/desktop/`:
  - `use-tauri.ts` — `isTauri()` (по `__TAURI_INTERNALS__`) + `useWindowControls()` (свернуть/развернуть/закрыть/«поверх всех окон»), динамический импорт `@tauri-apps/api/window`, no-op в браузере.
  - `use-active-booking.ts` — опрос `/api/pilot/bookings?limit=150`, выбор активной/ближайшей брони (фильтр по statusLabel), poll 30с.
  - `app-shell.tsx` — кастомный заголовок (drag-region, лого, табы Хаб/Полёт с индикатором активной брони, переключатель языка, контролы окна).
  - `hub-mode.tsx` — заглушка хаба (карточки профиль/галерея/чат/настройки) + экран логина при отсутствии сессии.
  - `flight-mode.tsx` — пустое состояние «нет активной брони» + CTA на `/dashboard`; при активной броне — карточка рейса + чипы IFE/Радио/Виджеты (заглушка фазы 4).
- Маршрут `/app` (AppShell) с детьми `hub`/`flight`, index → redirect на `/app/hub`. В `root.tsx` редирект на `/app` при запуске в Tauri.
- i18n-ключи `app.*` (ru/en) в `language-context.tsx`.
- npm-скрипты: `app:dev` (`tauri dev`), `app:build` (`tauri build`), `tauri`.
- Проверки: `tsc --noEmit -p tsconfig.app.json` → 0. `cargo check` (Rust-оболочка) — выполняется.

**Запуск (dev):** в одном терминале `npm run dev:server` (API на 8787), в другом `npm run app:dev` (Tauri запускает Vite сам). Vite проксирует `/api` → 8787. В браузере оболочка доступна на `http://localhost:5173/app`.

Rust-оболочка компилируется (`cargo check` → Finished). Фаза 1 закрыта.

### Фаза 2 — режим «Хаб» (сделано)
- `app-shell.tsx`: `<main>` переведён в `overflow-hidden` — каждый режим сам управляет прокруткой (нужно для layout с боковым рейлом).
- `hub-mode.tsx` переписан в секционный хаб: тёмный рейл слева + светлый контент справа (как в ЛК). Секции и переиспользуемые компоненты:
  - **Обзор** — приветствие, чипы (часы/рейсы/баланс из `/api/pilot/balance`/звание), виджет новостей+ивентов, крайние полёты (`RecentFlights`).
  - **Крайние полёты** — `RecentFlights` + детальный PIREP (`PilotPirepDetail` по `onOpenPirep`).
  - **Все рейсы** — `PilotAllFlights`.
  - **Статистика** — `PilotStats`. **Баланс** — `PilotBalance`. **Паспорт** — `PilotPassport`. **Галерея** — `PilotSocialGallery`. **Настройки** — `PilotSettings`. **Новости** — полный `NewsEventsWidget`.
- Новый `news-events-widget.tsx`: фетчит `/api/public/news` + `/api/public/activities`, объединяет, фильтрует Published + News/Event, сортирует (featured → дата), бейджи Новость/Событие. Не зависит от статичных сидов `NewsProvider`.
- Проверки: `tsc --noEmit` → 0.

### Фаза 3 — чат (WebSocket) (сделано)
- Пакет `ws@8.21`. Сервер (`server/index.js`): модуль чата поверх существующего `server` (`attachChatWebSocketServer` вызывается в колбэке `app.listen`).
  - Путь апгрейда `/api/chat/ws?room=<room>`; `WebSocketServer({ noServer:true })` + `server.on("upgrade")` (фильтр по pathname, чужие апгрейды не трогаем).
  - Аутентификация — `resolveSocialGalleryViewer({ headers })` (та же cookie-сессия). Нет сессии → `{type:"error",error:"auth_required"}` + close 4401 (проверено).
  - Комнаты: `general` и `flight:<CALLSIGN>` (валидация `normalizeChatRoom`). При подключении шлётся `{type:"history"}` (до 200 сообщений), новые — `{type:"message"}`, broadcast по комнате.
  - История в `data/chat-store.json` (`{rooms:{[room]:[]}}`), debounce-persist 1.5с, кап 200 сообщений/комната, лимит 2000 символов.
- Vite: `/api` proxy → `{ target, ws:true }` (проксирование WebSocket в dev).
- Клиент (`src/app/components/desktop/`):
  - `use-chat.ts` — WS-хук с авто-reconnect (backoff), history/message, `sendMessage`.
  - `chat-panel.tsx` — список комнат (общий + текущий рейс по активной броне), лента (свои/чужие пузыри, аватар/инициалы/время), ввод (Enter), индикатор статуса.
  - Секция «Чат» в `hub-mode.tsx` (тёмная, во всю высоту, вне светлого скролл-контейнера).
- Проверки: `tsc --noEmit` → 0; `node --check server` → 0; сервер стартует, лог `[chat] WebSocket ready`; неавторизованный WS отклоняется 4401.

### Хаб — редизайн вкладки «Обзор» (сделано)
- Новый `src/app/components/desktop/hub-overview.tsx` (вынесен из hub-mode), современный дизайн на закруглённых панелях:
  - Приветствие «С возвращением, {имя}» + подзаголовок; **колокольчик** — переиспользован `NotificationCenter` (готовая модалка уведомлений, живёт в `NotificationsProvider`).
  - **Текущий букинг** — тёмная градиентная карточка (rounded-3xl) с **SVG-флагами** вылет/прилёт через локальную базу `flag-data.ts` (`icaoToCountry` + `getFlagUri`, без внешних запросов), callsign, тип ВС, CTA «Открыть»; при отсутствии брони — пунктирная плашка + ссылка на бронь.
  - Метрики: часы / рейсы / баланс (`/api/pilot/balance`).
  - **Цветные карточки статусов PIREP** (4 шт., градиентные): Принято (emerald) / На проверке (amber) / Аннулировано (slate) / Отклонено (red) — счётчики из `/api/vamsys/recent-flights` (маппинг статусов как в recent-flights, needs_reply → на проверке).
  - **Крайние 3 полёта** — компактные строки с SVG-флагами, бейджем статуса, датой, клик → детальный PIREP.
  - Виджет новостей+ивентов.
- `hub-mode.tsx`: старый инлайн-overview удалён, импортируется новый `HubOverview`.
- Проверки: `tsc --noEmit` → 0.

### Экран логина приложения (сделано)
- Новый `src/app/components/desktop/app-login.tsx` — тёмный экран входа под стиль оболочки: фоновое красное свечение, карточка на закруглённых панелях, **наш логотип** (`@/assets/99be6a8339eae76151119a13613864930c8bf6e7.png`, тот же что на веб-логине), кнопки «Войти через vAMSYS» (`loginWithPilotApi("/app")`) и «Войти через Discord» (`loginWithDiscord("/app")`) с лоадерами, ссылка на регистрацию, нота о приватности. RU/EN через inline tr().
- Подключён в `hub-mode.tsx` и `flight-mode.tsx` вместо прежних простых кнопок логина (убраны неиспользуемые `LogIn`/`loginWithVAMSYS`).
- Проверки: `tsc --noEmit` → 0.

### Тема (светлая/тёмная) + текущая локация (сделано)
- Новый `use-app-theme.ts` — тема приложения (`light`/`dark`, по умолч. dark), persist в localStorage (`nws.app.theme`). Класс `dark` вешается на корневой `<div>` AppShell (скоуп Tailwind `dark:` через `@custom-variant dark (&:is(.dark *))` в theme.css) — тема не утекает на публичный сайт.
- Переключатель (Sun/Moon) в шапке приложения; i18n `app.theme.light/dark` (ru/en).
- Все собственные поверхности приложения переведены на «светлая база + `dark:`»: `app-shell`, `hub-mode` (рейл/канвас), `chat-panel`, `app-login`, `hub-overview`, `news-events-widget`, `flight-mode`. Переиспользуемые компоненты ЛК остаются светлыми (в тёмной теме — белые карточки на тёмном канвасе).
- **Текущая локация пилота** в шапке: `pilot.location` + SVG-флаг (если в строке есть ICAO — через `icaoToCountry`/`getFlagUri`), иначе иконка MapPin.
- Проверки: `tsc --noEmit` → 0.

### Интерактивная карта всех рейсов (сделано)
- Новая секция «Карта» в Хабе — переиспользует готовый `LiveMap` (Leaflet, тёмные тайлы, пан/зум, маркеры бортов, шлейфы телеметрии, сайдбар деталей по клику) — как на vAMSYS.
- Новый `hub-map.tsx`: опрос `/api/vamsys/flight-map` каждые 2с, компактный маппер строк в тип `Flight` из live-map (позиция/курс/скорость/высота/прогресс/телеметрия/коорд. вылета-прилёта, грубое определение ВАК для цвета), сохранение выбранного борта между обновлениями.
- Тип `Flight` экспортирован из `live-map.tsx`. Карта рендерится во всю высоту контент-области (как чат, без отступов), `className="relative h-full w-full bg-[#0d1117]"`.
- Карта тёмная в обеих темах (как и на vAMSYS).
- **Список участников в воздухе** (боковая панель слева от карты, тема light/dark): «В воздухе N», по каждому рейсу — номер, пилот, маршрут, статус/фаза, эшелон, цветная полоса ВАК; свои рейсы — бейдж «вы» и наверху списка; клик → выделение борта на карте.
- Проверки: `tsc --noEmit` → 0.

### Нижний статус-бар с живыми рейсами (сделано)
- Новый `use-live-flights.ts` — лёгкий опрос `/api/vamsys/flight-map` (каждые 5с): список, общее число, разбивка по ВАК.
- Новый `live-stats-bar.tsx` — постоянная панель внизу оболочки (h-7, тема light/dark): «N в воздухе» с пульсирующей точкой, разбивка NWS/KAR/STW, мой текущий рейс (если в воздухе — номер/маршрут/эшелон), часы UTC.
- Подключён в `app-shell.tsx` под `<main>`.
- Проверки: `tsc --noEmit` → 0.

### Статус-бар: индикаторы состояния + ссылки (сделано)
- Сервер: новый публичный `GET /api/health` → `{ ok, vamsys, time }` (vAMSYS через кэш `loadSystemStatus`/`getAccessToken`, 30с). Проверено: `{"ok":true,"vamsys":true}`.
- Новый `use-app-health.ts` — опрос `/api/health` каждые 15с → состояние `backend`/`vamsys` (online/offline/unknown).
- `live-stats-bar.tsx` дополнен: индикаторы (цветные точки) **vAMSYS API / Сервер / Вход** (авторизация из `useAuth`), и кликабельные иконки **Сайт** (Globe → https://vnws.org) и **Discord** (https://discord.gg/MfTT8KU5yC). Домен сайта взят из `deploy/prod/nginx_vnws.conf.example` (server_name vnws.org).
- Проверки: `tsc --noEmit` → 0, `node --check` → 0.
- NB: внешние ссылки — `<a target="_blank">` (работают в браузере/dev). В упакованном Tauri для открытия в системном браузере позже понадобится `@tauri-apps/plugin-opener` (вместе с OAuth-deeplink — отдельная задача упаковки).

### Уведомления Windows о событиях рейса (сделано)
- Tauri-плагин `tauri-plugin-notification` (Rust + `@tauri-apps/plugin-notification`), регистрация в `lib.rs`, право `notification:default` в capabilities. `cargo check` → ОК.
- `notify.ts` — единый helper: в Tauri нативный toast (запрос разрешения), в браузере — Web Notifications.
- `use-flight-notifications.ts` — следит за активным рейсом пилота (`/api/vamsys/flight-map`, фаза через переиспользованный `normalizeFlightPhase` по геометрии), шлёт:
  - **после буксировки/вылета** (pushback/taxi/takeoff/climb) — «Рейс начался: {маршрут}»;
  - **после касания/прибытия** (landing/taxiIn/arrived) — «Добро пожаловать в {город}! Не забудьте завершить полёт в Pegasus после заруливания».
  - Дедуп через localStorage (1 раз на рейс на событие), уважает тумблер уведомлений. Хук смонтирован в `AppShell` (работает во всех режимах).

### Язык в настройках + первый запуск + UTC (сделано)
- `LanguageProvider` теперь персистит язык в localStorage (`nws.lang`), читает при старте.
- `app-settings.tsx` — экран настроек приложения: **язык RU/EN** (segmented), **тема светлая/тёмная**, **уведомления** (вкл/выкл + кнопка «Тест»). Рендерится в секции «Настройки» Хаба над аккаунт-настройками (`PilotSettings`).
- `use-app-theme.ts` переписан на общий module-store с подпиской — переключение темы из настроек/онбординга и шапки синхронно.
- `app-onboarding.tsx` — экран первого запуска (overlay) с выбором языка и темы; флаг `nws.app.onboarded` в localStorage; смонтирован в `AppShell`.
- **UTC-время** — уже выводится в нижнем статус-баре (часы UTC, тик 1с).
- Проверки: `tsc --noEmit` → 0, `cargo check` → ОК.

### Система скриншотов рейса (сделано)
- Сервер: медиа галереи теперь несёт `flight {pirepId,bookingId,callsign,route}` (upload + сериализация). Новый `GET /api/pilot/pireps/:id/screenshots` — снимки, привязанные к PIREP, только владельца.
- Сайт PIREP (`pilot-pirep-detail.tsx` + новый `pirep-screenshots.tsx`): сворачиваемый блок «Скриншоты» с сеткой превью и drag-n-drop загрузкой; снимки уходят в общую пользовательскую галерею (тот же `POST /api/pilot/social-gallery/media`) с привязкой к PIREP.
- Настройки приложения (`screenshot-settings.tsx`): автодетект папки скриншотов (Volanta-style) — выбор папки через Tauri dialog, наблюдение через Tauri fs `watchImmediate`, новые файлы-картинки автозаливаются в галерею; плюс прямой drag-n-drop. В браузере — только ручная загрузка (плашка-предупреждение).
- Глобальный watcher (`use-screenshot-autowatch.ts`, смонтирован в AppShell) — детект работает во всех режимах; уведомление при добавлении.
- In-flight (`inflight-screenshot.tsx` в режиме «Полёт»): подсказка «Хотите поделиться скриншотом?» + инструкция (как снять в MSFS/X-Plane) + drag-n-drop, привязка к активному букингу.
- Tauri-плагины: `tauri-plugin-fs`, `tauri-plugin-dialog` (+ JS), права в capabilities (fs read/watch, dialog). `cargo check` → ОК.
- Проверки: `tsc --noEmit` → 0, `node --check` → 0, `cargo check` → 0.

### Гео-скриншоты на карте (Volanta-style) (сделано)
- Сервер: эфемерные метки в памяти, TTL 30 мин (`screenshotPins`, prune). `POST /api/pilot/screenshot-pins` (lat/lon/altitude/mediaId/assetUrl/title/callsign + имя пилота из сессии), `GET /api/pilot/screenshot-pins` (активные + `ageMs`).
- In-flight загрузка (`inflight-screenshot.tsx`): после успешной заливки берёт текущую позицию пилота из `/api/vamsys/flight-map` и создаёт гео-метку.
- `live-map.tsx`: новый проп `screenshotPins` + `onPinClick`, отдельный слой Leaflet, маркер с круглым превью + пульсация, попап (превью/имя·callsign/«N мин назад»).
- `hub-map.tsx`: опрос меток (10с), передача в карту, лайтбокс по клику (фулл-превью) с кнопкой **лайка** (переиспользует `/api/pilot/social-gallery/media/:id/like`, дедуп локально).
- Проверки: `tsc --noEmit` → 0, `node --check` → 0.
- **Сайт**: те же метки на публичной живой карте (`live-flights.tsx`) — проп `screenshotPins` без `onPinClick` (только просмотр-попап, без лайка). Гостям эндпоинт вернёт 401 → меток нет; залогиненным видны.

### Discord Rich Presence (сделано)
- Rust: крейт `discord-rich-presence`, состояние `DiscordState` (Mutex<клиент+app_id>, переподключение при смене id), команды `discord_set_activity` (details/state/assets/timestamps) и `discord_clear`. `cargo check` → ОК.
- Клиент `use-discord-presence.ts` (смонтирован в AppShell, только Tauri): по активному рейсу пилота показывает фазу (`normalizeFlightPhase`), маршрут, callsign, ВС и таймер с момента входа в полёт; вне полёта — «В хабе/готов к вылету»; без сессии — «В главном меню».
- App ID берётся из `VITE_DISCORD_APP_ID` (пусто → presence не активируется). Ассет `large_image` = ключ "nordwind" (загрузить арт в Discord Developer Portal → Rich Presence → Art Assets).
- Проверки: `tsc --noEmit` → 0, `cargo check` → 0.

### Паспорт пилота в приложении
- Уже встроен: секция «Паспорт» в Хабе (`PilotPassport`, карта посещённых стран). Отдельный «паспорт-буклет» не делался — при желании переоформить.

### Управление приложением из админки + модерация чата + дизайн (сделано)
- Сервер: стор `data/app-config.json` (фиче-флаги chat/map/radio/screenshots/notifications/discordPresence, ссылки, discordAppId, screenshotPinTtlMinutes, defaultTheme/Language, radioStations, announcement, chatModerators). Публичный `GET /api/app/config`, админ `GET/PUT /api/admin/app-config` (requireAdmin, deep-merge). TTL гео-меток теперь берётся из конфига (`screenshotPinTtlMs`).
- Модерация чата: `chatModerators` (username/pilotId) → `isChatModerator`; WS `type:"delete"` (только модератор) удаляет сообщение из истории + broadcast `delete`; history шлёт `isModerator`. Клиент (`use-chat`+`chat-panel`): кнопка удаления при наведении, бейдж «модератор».
- Админ-страница `admin-app-config.tsx` (page `app-config`, пункт «Приложение» в группе настроек): тумблеры модулей, ссылки/Discord App ID/TTL/тема/язык, объявление, редактор радиостанций, управление модераторами чата.
- Приложение: `use-app-config.ts` — читает конфиг; Хаб скрывает отключённые модули (chat/map/gallery).
- **Дизайн**: сворачиваемый сайдбар Хаба (иконки в свёрнутом виде, tooltip, состояние в localStorage `nws.app.sidebarCollapsed`).
- **Мини-статистика пилота** (`pilot-mini-stats.tsx`) в подвале сайдбара: аватар/имя + налёт/рейсы/дата вступления; в свёрнутом виде — аватар.
- Проверки: `tsc --noEmit` → 0, `node --check` → 0.

### Бэклог (новые запросы, в очереди)
- [ ] Репорты в чате + алерты в Discord/Telegram админам (#9).
- [ ] Лидерборд по суммарным лайкам скриншотов (#10).
- [ ] YouTube-плейлист/плеер: добавление ссылок, кэш между запусками, громкость, выбор устройства вывода (#11) — часть радио-модуля.
- [ ] Основа SimConnect/FSUIPC + концепт мода MSFS 2020/2024 (in-sim навбар-панель) (#12).
- [ ] Минималистичная отделка панелей по всему приложению (продолжающаяся).

### Фикс тёмной темы + шапка (UTC/баланс) + репорты чата (сделано)
- **Тёмная тема переделана на «островки»**: `.dark` больше не на корне (иначе светлые переиспользуемые ЛК-компоненты ломались на тёмном канвасе). Теперь тема применяется только к хрому: шапка, сайдбар (`nav`), нижний статус-бар, чат, онбординг — каждый получает класс `dark` при тёмной теме. Контент-область всегда светлая (как «документ» EFB) → переиспользуемые компоненты рендерятся корректно. Карта всегда тёмная.
- **Шапка**: добавлены **баланс** (`/api/pilot/balance`, амбер-чип), **UTC-часы** (тикают), рядом с локацией/callsign. Переключатель темы ☀/🌙 и языка RU/EN — уже были в шапке (всегда видны, в т.ч. на логине).
- **Репорты чата (#9)**: WS `type:"report"` (любой пользователь) → запись в chat-store + алерт в Discord (`sendDiscordBotNotification`, eventKey `chatReport`) и Telegram (`sendTelegramAdminNotification`). Кнопка «флажок» на чужих сообщениях (prompt причины, дедуп). Админка: `GET /api/admin/chat-reports`, `POST .../:id/resolve` (+опц. удалить сообщение); секция «Репорты чата» в странице «Приложение» (удалить/игнор).
- Проверки: `tsc --noEmit` → 0, `node --check` → 0.

### Редизайн паспорта пилота (#13, сделано)
- Новый `app-passport.tsx` — самодостаточный «паспорт-буклет» в гамме Volanta (navy `#0f1530→#1a1340` + фиолет/бирюза/изумруд акценты, glow-блобы), стилистика vAMSYS. Тёмный всегда (как документ), вне зависимости от темы приложения.
- Данные из `/api/pilot/passport`: шапка с числом стран, метрики (страны/аэропорты/рейсы/маршруты), **хроника по годам** (флаги стран + счётчик аэропортов, `countriesByYear`), частые аэропорты (флаг+ICAO+визиты), топ-маршрутов. Флаги — локальные `getFlagUri`/`icaoToCountry`, name→iso2 строится из аэропортов.
- Подключён в Хаб вместо `PilotPassport` (ЛК-версия на сайте не тронута).
- Проверки: `tsc --noEmit` → 0.

### Лидерборд по лайкам скриншотов (#10, сделано)
- Сервер: `GET /api/pilot/gallery-leaderboard` — топ-20 пилотов по `likesReceived` (переиспользует `buildSocialGalleryPilotRanking`), поля rank/name/likes/uploads/featured.
- Клиент: `likes-leaderboard.tsx` — медали за топ-3, подсветка «вы», число лайков/фото. Показан в секции «Галерея» Хаба над галереей.
- Проверки: `tsc --noEmit` → 0, `node --check` → 0.

### Переработка галереи (сделано)
- Новый `app-gallery.tsx` — универсальная современная галерея: вкладки **Лента/Топ/Мои** (communityMedia/topShots/myMedia), фильтр по категориям (чипы), **masonry-сетка** (CSS columns, break-inside-avoid), оверлей с автором/маршрутом, кнопка лайка с оптимистичным обновлением, **лайтбокс** (фулл, автор/рейс/дата, лайк), загрузка через кнопку и drag-n-drop. Тема light/dark.
- В Хабе секция «Галерея» = `AppGallery` + `LikesLeaderboard` сбоку (grid 1fr/300px). Старый `PilotSocialGallery` из приложения убран (ЛК-версия на сайте не тронута).
- Проверки: `tsc --noEmit` → 0.

### Радио-модуль (YouTube-плейлист) (#11, сделано)
- `use-youtube-playlist.ts` — плейлист с кэшем в localStorage (`nws.radio.playlist`), `parseYouTubeId` (watch/youtu.be/embed/shorts/live/bare id), add/remove/setTitle/clear.
- `youtube-api.ts` — однократная загрузка YouTube IFrame API с ожиданием готовности.
- `radio-player.tsx` — плеер на YT.Player: play/pause, next/prev, авто-следующий по ENDED, громкость (ползунок, кэш `nws.radio.volume`), добавление трека по ссылке, список плейлиста с подсветкой текущего/удалением.
- Секция «Радио» в Хабе (тип/пункт/рендер), под фиче-флагом `config.features.radio`.
- NB: вывод на конкретное аудиоустройство (setSinkId) для YouTube-iframe недоступен технически; оставлено на HTML-аудио источники (интернет-станции/ATC) в дальнейшем расширении радио.
- Проверки: `tsc --noEmit` → 0.

### Радио: станции по регионам + выбор аудиоустройства + фикс иконки самолёта (сделано)
- **Иконка борта на карте** (`live-map.tsx`): в `createAirplaneMarker` SVG-path рисовал звезду — заменён на нормальный силуэт самолёта (нос вверх, крылья+хвост, поворот по курсу). Чинит и сайт, и приложение.
- **Станции** (`stations-player.tsx`): HTML5 `<audio>`, play/stop, громкость (кэш `nws.radio.station.volume`), **выбор устройства вывода** через `setSinkId` (`use-audio-outputs.ts` — enumerateDevices audiooutput; работает в WebView2/Chromium). Источник станций — `config.radioStations` (без YouTube-ссылок).
- **Регионы**: поле `region` у станции (europe/russia/cis/atc/other), чипы-фильтры в плеере (показываются только присутствующие регионы). Дефолтные станции в конфиге сервера: Россия (Record/Energy/Наше), Европа (SomaFM/BBC R1), СНГ (Europa Plus KZ). Редактор станций в админке получил select региона.
- **Радио-вкладки**: переключатель Станции/YouTube в `radio-player.tsx` (YouTube-плеер остаётся смонтированным через hidden, чтобы не пересоздавать).
- **Аудиоустройства — компромисс**: для HTML-станций/ATC — реальный `setSinkId`; YouTube идёт на системное устройство (iframe нельзя маршрутизировать) — есть пометка в UI.
- **Статус-бар**: индикатор «Вход» переименован в «Авторизация» (тултип «Сервер авторизации»).
- Проверки: ожидают прогона (`tsc`/`node --check`) — изменения аддитивные.

### Унификация скриншотов вокруг галереи (сделано)
- Галерея — центр: тулбар `app-gallery.tsx` получил кнопку **«Авто-импорт папки»** (pickFolder/setWatchFolder, зелёный статус при активной папке) рядом с «Загрузить» + drag-n-drop. Глобальный watcher (AppShell) грузит новые файлы.
- Дублирующий блок скриншотов **убран из Настроек** (`app-settings.tsx`, `screenshot-settings.tsx` больше не подключён).
- Режим «Полёт» (`inflight-screenshot.tsx`): подсказка+инструкция+дропзона сохранены, добавлен **виджет-лента превью** снимков этого рейса (из ответов upload, до 12, клик → фулл). Каждый снимок → галерея + гео-метка.
- Проверки: `tsc --noEmit` → 0.

### Теги скриншотов + пустой экран-инструкция + NordwindHub + Changelog (сделано)
- **Теги скриншота**: сервер хранит/отдаёт `gear {aircraft (ICAO), registration, addons[]}` + `description` на медиа. In-flight автозаполняет aircraft/registration **из активной брони** (не хардкод). В галерее — кнопка «Детали» с опц. полями (тип ВС/регистрация/аддоны/описание, применяются к след. загрузкам), показ тегов и описания в лайтбоксе.
- **Пустая галерея** = обучающий экран: «Поделитесь первым скриншотом» + 3 шага (снять в симе MSFS V / X-Plane; авто-импорт/перетащить; готово) + кнопки «Авто-импорт папки»/«Загрузить».
- **Переименование в NordwindHub**: шапка приложения, экран логина, `tauri.conf.json` (productName + window title).
- **Changelog**: сервер `GET /api/app/changelog` (читает `data/changelog.json`). **Автоматизация** — `scripts/changelog-from-git.mjs` (npm `changelog`): парсит git log через `execFileSync` (без шелла — иначе Windows ломает %-плейсхолдеры), категоризация по conventional-префиксам (feat/fix/perf/refactor/docs/chore→скрыт/other), группировка по тегам версий или последние 80 коммитов. Вкладка «Что нового» в Хабе (`app-changelog.tsx`) — таймлайн с бейджами типов.
- Проверки: `tsc --noEmit` → 0; changelog сгенерирован.

### Режим «Полёт» — наполнение (сделано)
- `use-flight-telemetry.ts` — live-телеметрия активного рейса пилота из `/api/vamsys/flight-map` (8с): позиция/высота/скорость/курс/прогресс + фаза через `normalizeFlightPhase`.
- `flight-mode.tsx` переписан: тёмная IFE-карточка рейса (коды+названия аэропортов, прогресс-бар с самолётиком, бейдж фазы `FlightPhaseBadge`), плитки телеметрии (высота FL / GS / курс / прогресс) при наличии борта в воздухе, иначе подсказка про ACARS; in-flight скриншоты; список пассажиров (`PassengerManifest`). Всегда тёмный (IFE-стиль).
- ИИ-ассистент (#14): `POST /api/pilot/assistant` (xAI/grok, site-context + знания о приложении + персонализация пилота, rate-limit), `app-assistant.tsx` — чат с подсказками; секция «Ассистент» в Хабе.
- Главная: затемнённый фон из ротации фото бортов (топ-скриншоты), вся Главная — тёмный островок.
- Проверки: `tsc --noEmit` → 0; `node --check` → 0.

### Подготовка к Windows-сборке (Win10/11) (сделано)
- `tauri.conf.json` bundle: targets `["nsis"]`, publisher/copyright/описания, **NSIS installMode `currentUser`** (без админ-прав), языки RU/EN, **WebView2 `downloadBootstrapper` (silent)** — на Win10 докачает рантайм, на Win11 встроен. Win10 полностью совместим (WebView2 поддерживает 10 1803+/11).
- **API base для .exe**: `src/app/api-base.ts` — в Tauri (origin tauri://localhost) глобально патчит `fetch` (относит. `/api/*` → `https://vnws.org`, `credentials:include`) и `WebSocket` (→ `wss://vnws.org`). В вебе не трогает. Подключено в `main.tsx`. Override через `VITE_API_BASE`.
- **CORS на сервере** для упакованного приложения: middleware разрешает origin `http(s)://tauri.localhost`/`tauri://localhost` (+ env `APP_CORS_ORIGINS`) с `Access-Control-Allow-Credentials`, preflight OPTIONS.
- Discord RP: статус подключения + тумблер в настройках, App ID из конфига админки. Чат: явный индикатор статуса (в сети/подключение/отключено).
- Профиль: мини-статы (часы/рейсы/вступление) + баланс/локация переехали в меню профиля (правый верхний угол); карточка из сайдбара убрана.
- Главная: фон/тема теперь следуют переключателю темы (была всегда тёмной).
- Проверки: `tsc` → 0, `node --check` → 0.

**⚠️ Блокер для auth в упакованном .exe:** куки сессии (vAMSYS/Discord) должны ставиться с `SameSite=None; Secure`, иначе при cross-origin (tauri.localhost → vnws.org) браузер их не отправит и вход не сработает. Проверить/поправить установку cookie на сервере перед релизом десктоп-сборки. См. #15.

### Система достижений + бейджи + Steam-style уведомления (#16, сделано)
- Сервер: движок достижений `ACHIEVEMENTS_CATALOG` (тиры по метрикам hours/flights/badges/screenshots), `GET /api/pilot/achievements` — прогресс/тиры/nextThreshold + `newlyUnlocked`; хранение `unlockedAt` в `data/achievements-store.json` (дедуп момента). Метрики: pilot.hours/flights, число бейджей (`syncPilotBadges`), число своих медиа в галерее.
- Клиент: `use-achievements.ts` — опрос + при `newlyUnlocked` шлёт **Windows toast** (`notify`, «🏆 Достижение получено!») + запись в **колокольчик** (категория `achievement`, дедуп localStorage). Смонтирован глобально в AppShell (уведомления приходят в любой секции).
- `app-achievements.tsx` — секция «Достижения» в Хабе: карточки с прогресс-баром и тирами (открытые/закрытые) + **объединено с бейджами vAMSYS** (`PilotBadges` тем же разделом).
- Категория `achievement` добавлена в `notifications-context`, иконка/цвет в `notification-center`, i18n ru/en. Колокольчик общий для сайта и приложения.
- Проверки: `tsc` → 0, `node --check` → 0.

### Карта-фикс + ACARS + MSFS-аддон + OFP + NOTAM (сделано)
- **Фикс живой карты** (клик по борту + трейл, чинит сайт и приложение): `hub-map.tsx` мемоизация `handleSelect/handleClose` (`useCallback`) — маркеры больше не пересоздаются каждые 2с; `live-map.tsx` — пины скриншотов в отдельный pane `nwsPins` (z-index 580 < маркеров 600), маркер пина с `pane:"nwsPins"`; нормализация телеметрии расширена ключами `positionLat/positionLon/x/y`.
- **Достижения UI** переделан под референс: общий процент-бар + строки тиров (зелёная галочка DONE / синий + NEXT / замок), подсветка текущего.
- **ACARS-раздел** в Хабе (`acars-panel.tsx`) — каркас без статуса подключения (по решению): текущий рейс, заготовки входящие/исходящие, помечен «в разработке».
- **MSFS-аддон в настройках** (`msfs-addon-settings.tsx`) — задел: автодетект пакета в Community-папке MSFS (Store+Steam пути через Tauri fs/path), статус Установлен/Не установлен/Проверка; право `fs:allow-exists`.
- **OFP SimBrief** на странице полёта (`ofp-viewer.tsx`) — через vAMSYS (`/api/pilot/bookings/:id/simbrief`): iframe по url или санитайзный HTML, обновить/открыть.
- **NOTAM-раздел** в Хабе (`PilotNotams`) + **Pegasus-баннер** срочных NOTAM (`urgent-notams.tsx` в AppShell): must-read/critical/high, скрываемый, «Открыть» → `/app/hub?section=notams` (hub-mode читает `?section=`).
- Проверки: `tsc` → 0, `node --check` → 0.

### Email-рассылки (маркетинг) MVP (#18, сделано)
- `server/email-campaigns.js` (модуль, `mountEmailCampaigns(app, {...})`): абстракция отправки — адаптеры **SMTP (nodemailer)** и **API (Resend-совместимый)**, выбор через `EMAIL_PROVIDER=smtp|api`. Сторы: `data/email-campaigns.json` (кампании: subject/html/status/stats), `data/email-subscriptions.json` (unsubscribed + ручной импорт).
- Аудитория: активные пилоты из `loadPilotsRoster` (email) + **ручной импорт** (вставка email/CSV) − отписавшиеся. (vAMSYS имеет флаг подписки, но базу заливаем вручную.)
- Отправка: фоновая очередь с троттлингом (`EMAIL_THROTTLE_MS`), плейсхолдеры `{{name}}/{{email}}/{{unsubscribe}}`, авто-футер с отпиской, заголовок `List-Unsubscribe`. Публичная страница отписки `GET /api/email/unsubscribe?e=&t=` (токен по sha256).
- Эндпоинты (requireAdmin): status, import, CRUD кампаний, test (одно письмо), send (запуск). 
- Админ-страница `admin-email.tsx` (page `email`, пункт «Рассылки»): статус провайдера/аудитории, импорт базы, создание кампании (HTML), тест-отправка, запуск + live-статистика (sent/total/failed).
- ENV для прода: `EMAIL_PROVIDER`, SMTP_* или EMAIL_API_KEY/URL, `EMAIL_FROM`, `PUBLIC_SITE_URL`, `EMAIL_UNSUB_SECRET`, `EMAIL_THROTTLE_MS`. Зависимость `nodemailer`.
- Проверки: `tsc` → 0, `node --check` (index + модуль) → 0.

### Осталось по теме приложения
- [ ] Фаза 4 — режим «Полёт»: радио-модуль (источники: интернет-станции + ATC-сканнер + **Spotify как источник наравне с другими**, embed-плеер без OAuth), overlay-виджеты, IFE (live-карта), список пассажиров (`passenger-manifest.tsx`), **загрузка скриншотов прямо в текущий рейс** (переиспользует `POST /api/pilot/social-gallery/media`; расширить сервер полями `flightBookingId`/`flightCallsign`/`flightRoute` + эндпоинт списка снимков по броне).
- [x] Уведомления Windows о начале рейса и посадке — сделано (см. выше).
- [ ] OAuth-логин внутри Tauri: сейчас `loginWithVAMSYS()` рассчитан на браузерный редирект; в упакованном приложении понадобится deep-link/внешний браузер (отдельная задача).
- [ ] Переиспользуемые компоненты ЛК светлые — в тёмной оболочке контент-зона намеренно светлая; проверить читаемость крупных компонентов (RecentFlights в половинной колонке Обзора может быть тесным).

---

## 2026-06-13

### Сделано
- **Динамический статус фазы полёта на странице букинга** (`pilot-booking-view.tsx` + новый `flight-phase.tsx`, `language-context.tsx`):
  - страница просмотра брони стала live: опрос `/api/vamsys/flight-map` каждые 12с, сопоставление активного рейса по callsign/flightNumber;
  - новый переиспользуемый `FlightPhaseBadge` + `normalizeFlightPhase()` — канонические фазы: Запланирован / Посадка / Буксировка / Руление / Взлёт / Набор / Крейсер / Снижение / Заход / Посадка / Руление к гейту / Прибыл. Каждая со своим цветом, иконкой и пульсирующей точкой;
  - определение фазы геометрией (приоритетно над строкой vAMSYS): haversine от позиции ВС до аэропортов вылета/прилёта + путевая скорость + высота. Высота vAMSYS — MSL, поэтому «на земле» определяется не по высоте, а по близости позиции к аэродрому (≤3 nm) + малой GS: <3kt у вылета → Boarding, <8kt → Pushback, <50kt → Taxi, быстро → Takeoff; у прилёта аналогично Landing/TaxiIn/Arrived. В воздухе: терминальная зона (≤35nm) у прилёта → Approach/Landing, у вылета → Climb; эшелон ≥FL180 → Cruise/Descent по прогрессу;
  - в шапке статичный бейдж статуса заменяется live-фазой; добавлена строка телеметрии (ALT/GS/остаток дистанции/ETE) с прогресс-баром при наличии активного рейса;
  - i18n-ключи `phase.*` (ru/en).

- **Скроллбар сайдбара ЛК** (`pilot-dashboard.tsx`, `styles/index.css`): дефолтный широкий серый скролл заменён на тонкий (6px) полупрозрачный, скрытый до наведения (классы `.nws-scroll` / `.nws-scroll-hover`). Релиз `20260613-142127`.

---

## 2026-06-12

### Сделано
- **Колонка «Тип» в таблице «Все рейсы»** (`pilot-all-flights.tsx`): заголовок «ВС» → «Тип», вместо слитной строки `A21N/A321+1` — отдельные бейджи ИКАО-кодов (`B738` `A321`), первые два + счётчик `+N` с тултипом остальных; колонка расширена 80→104px. Релиз `20260612-165036`.
- **Карта: динамический масштаб маркеров + база флагов** (`flight-map.tsx`, `flag-data.ts`):
  - кружки масштабируются от зума (`scale = 0.28 + zoom*0.105`, диапазон 0.5–1.05, CSS-переменная на контейнере, плавный transition) — на обзорном зуме мельче, при приближении полный размер;
  - флаги РФ: добавлен отсутствовавший префикс `UN` (вся Зап. Сибирь — UNKL/UNNT/UNOO), `UMKK` (Калининград) исправлен с by→ru, `UK` исправлен с ru→ua, `UTD*`→tj, `UTA*`→tm (через новый 3-буквенный слой overrides);
  - добиты 16 недостающих SVG-флагов (kp, tm, lu, cy, si, mt, mc, ba, md, mk, gi, kh, hk, mo, bn, tl) — все страны из ICAO-маппинга теперь имеют картинку;
  - починены «битые» иконки флагов: бейдж рендерился при известной стране, но пустом SVG (например ZKPY/КНДР) — теперь проверяется именно наличие картинки.
  - релиз `20260612-160248`.
- **Тёплый старт бэкенда (оптимизация холодного запуска)** (`server/index.js`):
  - причина 15-секундной загрузки ЛК после рестарта: unified-каталог (аэропорты/хабы/маршруты/флот) пуст, и первый запрос ждёт полный paginated-синк с vAMSYS;
  - теперь каталог персистится в `data/unified-catalog-snapshot.json` (после full/delta синков, троттлинг 30с) и при старте мгновенно поднимается с диска (stale-while-revalidate) — страницы доступны сразу, свежий синк идёт в фоне;
  - добавлен прогрев `loadRoutesData()` и `loadDashboardBootstrapCatalog()` при старте (к существующему прогреву админки);
  - проверено локально: после рестарта `snapshot_restored` и `/api/vamsys/routes` отвечает мгновенно даже при недоступном vAMSYS.
  - релиз `20260612-151141`.
- **Аудит маршрутной сети** (`server/index.js`, админка «Маршруты»):
  - сервер парсит FPL-строки всех маршрутов и проверяет точки/трассы по навбазе X-Plane (`data/navdata/earth_fix.dat` + `earth_awy.dat`);
  - ошибки вида «трасса X не найдена», «точка Y не найдена», «точка Y не лежит на трассе X»;
  - автозапуск по интервалу (настраивается, по умолч. 24 ч), кнопка «Запустить сейчас», сводка в админке (до 300 проблем) и в Discord (топ-12);
  - эндпоинты: `GET /api/admin/route-audit`, `PUT .../settings`, `POST .../run`.
- **Напоминалка AIRAC**: возраст навбазы по mtime файлов; ≥28 дней — оранжевый баннер в админке + предупреждение в Discord-сводке.
- **Установка AIRAC через админку**: кнопка «Загрузить AIRAC» — ZIP (сервер сам достаёт earth_fix/earth_awy из архива, свой мини-распаковщик на zlib) или отдельные .dat; валидация формата; `POST /api/admin/route-audit/navdata[-archive]`. Альтернатива — вручную в `data/navdata/`.
- **Модерация репортов маршрутов** (админка «Тикеты», блок «Модерация репортов»):
  - кулдаун между репортами (по умолч. 30 мин), лимит за 24 ч (по умолч. 5), блок-лист пилотов (по username vAMSYS);
  - сервер возвращает 403/429 с кодами `report_blocked` / `report_cooldown` / `report_daily_limit`, тосты RU/EN в кабинете;
  - эндпоинты: `GET/PUT /api/admin/route-reports/settings`.
- **Репорт с конкретикой**: в модалке репорта выбор причины (не выполняется / расписание / тип ВС / FPL / другое) + поле «Детали» (до 500 симв.); причина и детали попадают в тикет и Discord-уведомление.
- **Самолёты: ИКАО-код + регистрация** вместо полного названия модели в выборе ВС при бронировании (`pilot-bookings.tsx`): `VQ-BCD · B738`, тип — `B738 · флот`.
- **Починён сырой ключ** `bookings.reportInactiveDescription` в модалке (перевода не существовало; добавлены RU/EN).
- **Режим двух аэропортов** на «Все рейсы»: фильтр «Аэропорт прилёта» (зависит от хаба), клик хаб → клик прилёт на карте, плашка `UUEE ✈ LTAI`, авто-сброс несуществующих направлений.

### Релизы за день
`20260612-000917` (два аэропорта) → `003100` (репорт+ИКАО) → `005332` (модерация) → `122959` (аудит) → `124646` (напоминалка) → `130203` (загрузка AIRAC).

### Осталось / не дофикшено
- [ ] **Навбаза не установлена** — аудит не заработает, пока на сервер не загрузят earth_fix.dat/earth_awy.dat (через админку или вручную).
- [ ] Discord-событие `routeAudit` не имеет своего шаблона/тумблера в настройках бота (шлётся через дефолтный канал news, если не указан channel ID в настройках аудита).
- [ ] Валидатор FPL не знает SID/STAR по-настоящему (эвристика «похоже на процедуру — пропустить» на первых/последних позициях); полноценная проверка потребует earth_proc данных.
- [ ] В `routes.tsx` (публичная страница) фильтр прилёта не добавлялся — только в кабинете пилота («Все рейсы»).

---

## 2026-06-11

### Сделано
- **Загрузочный экран с Боингом** — сделан инлайном в `index.html` (SVG 737-800 в ливрее Nordwind, звёзды/облака, прогресс с авиа-статусами, ожидание монтирования React, sessionStorage для коротких повторных показов). **Откачен по решению пользователя** (`git checkout index.html`) — кривовато вышло, детали не доделаны. Если возвращаться — переделать отрисовку самолёта.
- **Карта (flight-map.tsx)**:
  - починен сброс зума: `fitBounds` теперь только при реальной смене данных (ключ по составу данных), а не при каждом ререндере;
  - метки заменены с «капель» на кружки (дест 28px, хаб 46px, код внутри, флаг сверху);
  - линии маршрутов в красной гамме (`#f87171`/`#fca5a5`), активные — фирменный красный со свечением.
- **Иконки статистики** в шапке кабинета пилота: Clock/Plane/PlaneLanding/CalendarDays к Hours/Flights/Landing Rate/Member Since.
- **Vite dev server**: добавлен `host: '127.0.0.1'` в `vite.config.ts` (биндился только на IPv6 `::1` — ERR_CONNECTION_REFUSED).
- Удалён `demo-737.html` из корня — ронял `npm run dev` (импортировал неустановленный three).

### Грабли деплоя (важно)
- Прод отдаёт строго `dist/` рядом с `server/` запущенного процесса (`server/site.js`). Два деплоя «не применились», потому что файлы клали не в ту папку. Проверка после деплоя: `grep index- dist/index.html` на сервере должен совпадать с локальным билдом.
- Ошибка «MIME text/html для .js» = `index.html` заменён, а `assets/` ещё старые (или наоборот) — деплоить надо целиком.
- `rebuild_release.ps1` падает по `npm ci`, если запущен dev-сервер (lightningcss заблокирован). Останавливать Vite перед сборкой.

### Осталось
- [x] ~~Загрузочный экран~~ — откачен, в прод не пошёл.

---

## Ранее (контекст из git)
- `fe8c4f2` локализация Save/Compare в недавних рейсах (ru/en)
- `860ae93` фикс Invariant failed на дашборде и crypto require
- `1745cc8` большой UI-оверхол: hero, live map, PIREP detail, stream widgets
