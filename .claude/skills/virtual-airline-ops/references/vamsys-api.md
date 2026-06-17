# vAMSYS v3 API reference (Operations + Pilot)

> **Canonical live docs (user-confirmed):**
> - Operations API: **https://vamsys.io/docs/operations**
> - Pilot API: **https://vamsys.io/docs/pilot**
> - Auth/usage & interactive (Scalar/OpenAPI): https://protocol.vamsys.dev/ (`/authentication`, `/using-api`)
>
> Those doc pages are **client-rendered** (Scalar viewer), so plain HTML fetch returns only the title.
> To read them, open in a browser or pull the OpenAPI/JSON spec the viewer loads. **The most reliable
> concrete reference for this project is the working integration in `server/index.js`** — every path
> below is one this codebase actually calls against the live API.

## Bases & versioning

```
Operations API   https://vamsys.io/api/v3/operations      (env VAMSYS_API_BASE)
Pilot API        https://vamsys.io/api/v3/pilot            (env PILOT_API_BASE)
OAuth token      https://vamsys.io/oauth/token             (env VAMSYS_TOKEN_URL)
OAuth authorize  https://vamsys.io/oauth/authorize
```

## Authentication (two separate OAuth2 systems)

1. **Operations API — OAuth2 Client Credentials (server-to-server).**
   - The VA creates an API client in **Orwell → API**; you get a `client_id` / `client_secret`.
   - Exchange at `POST https://vamsys.io/oauth/token` (`grant_type=client_credentials`), send
     `Authorization: Bearer <token>` on requests. Token cached server-side until expiry.
   - **Granular read scopes** exist (client-credentials tokens can be read-only and safe for public
     use); fully backwards-compatible with older full tokens.
2. **Pilot API — OAuth2 Authorization Code + PKCE (per pilot).**
   - Pilot authorises at `/oauth/authorize` (with PKCE challenge); your app exchanges the code at
     `/oauth/token` for a pilot-scoped token. Separate from the Operations session.
   - >40 endpoints across ~10 granular **scopes** (profile, bookings, pireps, claims, activities,
     favourites, notams, location, preferences, hub). Confirm exact scope strings from the live docs.

> VNWS detail: it runs **three** parallel auth systems — Discord OAuth (public accounts), vAMSYS
> Operations OAuth (main pilot/admin login), and Pilot-API PKCE (separate pilot profile). See
> `CLAUDE.md` and `server/index.js`.

## Query conventions (JSON:API style — Operations API)

- **Pagination**: `?page[size]=300` (and page cursors). This codebase fetches all pages via a
  `fetchAllPages(path)` helper.
- **Sorting**: `?sort=name`, `?sort=-created_at`, `?sort=order,name` (prefix `-` = descending).
- **Filtering**: `?filter[pilot_id]=123`.
- Combine: `/pireps?page[size]=100&filter[pilot_id]=123&sort=-created_at`.

## Operations API surface (resources this project reads)

Paths are relative to `…/api/v3/operations`. Verified against `server/index.js`.

| Resource | Example path | Use |
|---|---|---|
| Pilots | `/pilots?page[size]=300` | Roster (paged). Also per-pilot lookups. |
| Ranks | `/ranks?page[size]=200` | Rank catalogue / progression. |
| Fleet | `/fleet?page[size]=100&sort=-updated_at` | Fleet groups. |
| Aircraft | `/fleet/{fleetId}/aircraft?page[size]=100` | Aircraft (registrations) in a fleet. |
| Liveries | `/fleet/{fleetId}/liveries?page[size]=100` | Liveries for a fleet. |
| Airports | `/airports?page[size]=300&sort=name` | Airport catalogue (coords, city, country). |
| Hubs | `/hubs?page[size]=100&sort=order` · `/hubs/{hubId}/pilots` | Hubs and pilots based there. |
| Routes | `/routes?page[size]=300&sort=-updated_at` | Scheduled routes (flight#, from/to, fleet, freq). |
| Bookings | `/bookings?page[size]=20&filter[pilot_id]=…&sort=-created_at` | Bookings (Ops view). |
| PIREPs | `/pireps?page[size]=250&sort=-created_at` · `filter[pilot_id]=…` | Flight history. |
| NOTAMs | `/notams?page[size]=100` | Operational notices. |
| Alerts | `/alerts?page[size]=100` | Dashboard alerts/announcements. |
| Badges | `/badges?page[size]=100&sort=order,name` · `/badges/{id}` · `/badges/{id}/pilots?page[size]=300` | Badge catalogue + recipients. |

## Pilot API surface (per-pilot, OAuth PKCE)

Paths are relative to `…/api/v3/pilot`. Verified against `server/index.js`.

**Profile / identity**
- `GET /profile` — pilot profile.
- `GET /rank` — current rank.
- `GET /statistics` — hours, flights, etc.
- `GET /location` · `PATCH /location` (`{ airport_id }`) — current airport (move pilot).
- `GET /preferences` — preferences (incl. preferred network).
- (badges, holidays, hub, favourites — exposed per docs/scopes.)

**Bookings / dispatch**
- `GET /bookings?page[size]=…&sort=departure_time` — list.
- `GET /bookings/{id}` — detail.
- `POST /bookings` — create (`{ routeId/route_id, aircraftId/aircraft_id, departureTime }`).
- `DELETE /bookings/{id}` — cancel.
- `GET /bookings/{id}/simbrief` · `PUT /bookings/{id}/simbrief` — read/link SimBrief OFP.
- `POST /dispatch-url` — generate a dispatch URL for a route.

**PIREPs**
- `GET /pireps?…` — flight history (paged/filter/sort).
- `GET /pireps/{id}` — PIREP detail.
- `GET /pireps/{id}/positions` — position track.
- `GET /pireps/{id}/profile` — altitude/profile trace.
- `GET|POST /pireps/{id}/comments` — read/post comments.

**Manual claims** (manual PIREP for flights not auto-tracked)
- `GET /claims?…` · `POST /claims` · (`DELETE /claims/{id}` per docs).

**Activities / rosters**
- `GET /activities/registrations?page[size]=100` — what the pilot registered for.
- `POST /activities/{activityId}/register` · `DELETE /activities/registrations/{registrationId}`.
- `GET /activities/{activityId}/progress` — leg/percent progress.

**NOTAMs / favourites**
- NOTAM browse + **acknowledge**; toggle favourite aircraft/airports (per docs/scopes).

## Booking lifecycle (how dispatch actually flows)

1. Read **routes** (`/routes`) and **fleet** (`/fleet` → aircraft) from Operations API.
2. Filter routes to the pilot's **location** (`GET /pilot/location`), and aircraft to the route's
   allowed `fleetIds` (`route.fleetIds ∩ aircraft.fleetId`).
3. `POST /pilot/bookings { routeId, aircraftId, departureTime }`. May be gated by **unread NOTAMs**
   (`code: notams_unread`) or **departure mismatch** (`booking_departure_mismatch`).
4. Optionally `POST /pilot/dispatch-url` and link SimBrief (`PUT /pilot/bookings/{id}/simbrief`).
5. Pilot flies with **Pegasus** ACARS → PIREP filed automatically; staff review in **Orwell**.

## Gotchas / project conventions

- **Read-mostly.** We cannot create/award vAMSYS **badges**, write **ranks**, or fabricate data the
  API doesn't return (crew lists, real divert airport). Derive locally and label as derived.
- **Caching** in VNWS: live flights ~100ms; fleet/routes minutes; dashboard ~10min; sessions/roster/
  telemetry persisted to `data/*.json`. Respect these when adding endpoints.
- **Move pilot** = `PATCH /pilot/location { airport_id }` (resolve ICAO → airport id first).
- Always page through results (`fetchAllPages`) — don't assume one page.
- When in doubt about a field or new endpoint, **open the live docs** (URLs at top) or grep
  `server/index.js` for an existing call; do not invent payload shapes.
