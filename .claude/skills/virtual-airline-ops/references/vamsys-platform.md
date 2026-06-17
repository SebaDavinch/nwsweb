# vAMSYS platform — components, concepts, docs map

**vAMSYS** is a hosted "run your VA like a real airline" management platform. VAs sign up and get a
configured airline: pilots, fleet, routes, bookings, PIREPs, ACARS tracking, events, ranks, badges,
NOTAMs, and an API. **Nordwind Virtual (VNWS) runs on vAMSYS** and this project proxies/extends its
v3 API.

> Two domains exist and are easy to confuse:
> - **vamsys.io** — the live application this project integrates with (`https://vamsys.io/api/v3/...`).
> - **vamsys.co.uk** — marketing + user docs site (`/features`, `/docs`, `/changelog`).
> - **vamsys.dev / docs.vamsys.dev / protocol.vamsys.dev** — developer/API documentation.

## The four product components

| Component | Role | Notes |
|---|---|---|
| **Orwell** | **Admin/management backend** for VA staff ("management system for fleet, routes, PIREPs, and more"). | This is where API v3 clients and OAuth scopes are created (Orwell → **API**). Full section list below. |
| **Phoenix** | **Pilot-facing portal** — dashboards, flight booking, PIREPs, profile, community features. | VNWS effectively builds its *own* Phoenix-equivalent on top of the API. |
| **Pegasus** | **In-house ACARS flight tracker.** Pilots install it to track flights and auto-submit PIREPs. MSFS / X-Plane / Prepar3D; Windows/Mac/Linux; real-time tracking + automatic flight-phase detection. | The "complete in Pegasus after landing" step VNWS references. |
| **Hangar** | **File storage** for the VA — documents, images, files pilots can access. | |

(Historical/related project names you may see in the community: *Phoenix* superseded older pilot
portals. If you see an unfamiliar codename, check the community forum — see references.)

### Orwell sections (admin surface — from vamsys.co.uk/docs/orwell)

The Orwell admin covers, grouped roughly:
- **Pilots & people**: Pilots, Pilot Data & Marketing, Pilot Registration, Pilot Sharing Agreements,
  Holidays, Staff, Ranks, Rank Transfer.
- **Fleet & network**: Fleet, Aircraft, Liveries, Airports, Hubs, Routes, Routings, Scenery,
  Load Factors, Containers, Presets.
- **Flights & rewards**: Bookings, PIREPs, Booking & Dispatch Settings, PIREP & Reward Settings,
  Scoring Groups, Scoring Rules, AutoReject Rules, Callsign Parameters, ACARS Sounds, Activity
  Requirements, Activities.
- **Comms & content**: NOTAMs, Alerts, Badges, Branding, Custom Pages, Phoenix Dashboard Editor.
- **Platform**: General Settings, Statistics, Billing, **API** (create Operations + Pilot API
  clients, manage scopes, request logs, interactive docs).

This is the staff-side mirror of the data model below; VNWS mostly *reads* these via the API and adds
its own admin panel for VNWS-specific content (news, events, gallery, app config, achievements).

## Core domain objects (the vAMSYS data model)

These are the nouns the API exposes (see `vamsys-api.md` for endpoints):

- **Pilot** — profile, rank, statistics, hours, flights, location (current airport), hub, holidays,
  preferences (incl. preferred network), favourites, badges.
- **Rank** — progression tier; pilots advance by hours/PIREPs/points.
- **Fleet** — group of aircraft of a type; each fleet has **aircraft** (registrations) and **liveries**.
- **Airport** — ICAO/IATA, name, city, country, coordinates; some are **hubs**.
- **Route** — scheduled sector: flight number, from/to, distance, duration, allowed fleet IDs, freq.
- **Booking** — a pilot's reservation of a route + aircraft + departure time; can generate a
  **dispatch URL** and link a **SimBrief** OFP.
- **PIREP** — completed flight record; has **positions** (track) and a **profile** (altitude trace),
  plus **comments**. Manual flights are **claims**.
- **Activity / roster** — events and multi-leg tours pilots **register** for and track **progress** on.
- **NOTAM** / **alert** — operational notices; can require acknowledgement before booking.
- **Badge** — award; can be auto-derived or staff-granted; has pilots who earned it.

## How a VA is configured (mental model for staff features)

1. Set up **hubs** and the **airport** set.
2. Define **fleet** (types, aircraft, liveries) and **routes** (with allowed fleet).
3. Define **ranks** (thresholds) and **badges** (criteria).
4. Pilots join, are **located** at a hub, **book** routes, fly with **Pegasus** ACARS, file **PIREPs**.
5. Staff review PIREPs in **Orwell**; pilots progress ranks, earn badges, join **events/activities**.
6. **NOTAMs/alerts** communicate operational info; **API v3** clients power external tools (like VNWS).

## Documentation map (canonical sources)

> Fetching may be blocked in some environments. When it works, prefer the live docs to confirm
> scopes/endpoints. The GitHub docs repo below is the closest thing to a downloadable wiki.

- **User docs hub**: https://vamsys.co.uk/docs  (Getting Started, **Pegasus**, etc.)
- **Features overview**: https://vamsys.co.uk/features
- **Changelog**: https://vamsys.co.uk/changelog  (watch for new API capabilities)
- **Developer docs**: https://vamsys.dev/ and https://docs.vamsys.dev/
  - Sections (from the docs repo): `concepts`, `guides`, `orwell`, `vds`, `hangar`, `migration`,
    `settings`, `data`, `checklist`.
- **API reference (interactive, Scalar/OpenAPI)**: https://protocol.vamsys.dev/
  (incl. `/authentication`, `/using-api`). Auto-generated OpenAPI; >40 Pilot API endpoints across
  ~10 scopes; Operations API with OAuth2 client-credentials + granular read scopes.
- **Docs source (archived, read-only since 2025-07-17)** — best for a full mirror:
  https://github.com/vAMSYS-LTD/documentation  (folders: checklist, concepts, data, guides, hangar,
  migration, orwell, settings, vds). Pull raw markdown from `raw.githubusercontent.com` per file.
- **Community forum** (idea sourcing, project codenames, staff Q&A): https://community.vamsys.io/

## Practical notes for VNWS work

- The Operations API uses **JSON:API** conventions (`page[size]`, `sort`, `filter[field]`). See
  `vamsys-api.md`.
- Auth is split: **Operations API** = OAuth2 **client credentials** (server-to-server, the VA's
  client id/secret); **Pilot API** = OAuth2 **authorization code + PKCE** (per-pilot). VNWS keeps
  these as separate sessions.
- vAMSYS is **read-mostly** for us: we read roster/fleet/routes/PIREPs/badges and perform the
  pilot-scoped actions the Pilot API allows (book/cancel, manual claims, register for activities,
  acknowledge NOTAMs, set location/favourites). We **cannot** invent data it doesn't expose (crew
  manifests, actual divert codes) — VNWS derives those locally and labels them.
