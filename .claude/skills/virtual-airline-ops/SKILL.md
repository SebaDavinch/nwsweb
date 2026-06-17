---
name: virtual-airline-ops
description: >-
  Domain expertise for building Nordwind Virtual (VNWS) and any virtual airline (VA / Russian: ВАК)
  feature. Covers the vAMSYS platform and its v3 API (Operations + Pilot), VATSIM/IVAO online
  operations, events, ranks/economy, PIREPs/ACARS, dispatch/bookings, and the real-world Pegas
  group airlines (Nordwind, Ikar, Southwind). Use whenever the task touches VA concepts, vAMSYS
  integration, how other VAs work, event design, or VATSIM/IVAO. Enforces correct terminology:
  English "VA" / "virtual airline", Russian "ВАК" — NEVER write "VAC".
---

# Virtual Airline Operations (Nordwind Virtual / vAMSYS)

This skill makes you work like a virtual-airline product specialist for **Nordwind Virtual (VNWS)**,
which runs on the **vAMSYS.io** platform. Load the reference files below for depth; this page is the
map and the rules.

## Cardinal terminology rule (do not get this wrong)

- English: **VA** = *Virtual Airline*. Plural **VAs**. Never **"VAC"** — that abbreviation is wrong.
- Russian: **ВАК** = *Виртуальная Авиакомпания*. Use ВАК in Russian-language UI/text.
- A VA is a flight-sim hobby organisation that simulates running an airline (fleet, route network,
  pilots, schedules, ranks), typically flown online on **VATSIM** or **IVAO**. It is *not* a real
  air operator and has no real-world commercial authority.
- Other key terms: **PIREP** (Pilot Report — a logged completed flight), **ACARS** (the client that
  auto-tracks a flight and files the PIREP — here **Pegasus**), **OFP** (Operational Flight Plan,
  from SimBrief), **dispatch** (creating/preparing a booking to fly), **hub** (a base airport),
  **leg/sector** (one flight), **callsign**, **livery**, **NOTAM**, **roster**.

## When to use this skill

- Building or changing any VNWS feature: bookings, dispatch, PIREPs, gallery, events/activities,
  ranks, badges/achievements, economy/balance, live map, NOTAMs, leaderboard, passport.
- Anything touching the **vAMSYS v3 API** (Operations or Pilot) — see `references/vamsys-api.md`.
- Designing **events** or community features, or researching **how other VAs do it**.
- Writing copy or features that reference VATSIM/IVAO, the Pegas group airlines, or VA conventions.

## The domain in one screen

- **Platform**: vAMSYS (vamsys.io app). Components — **Orwell** (admin/management backend),
  **Phoenix** (pilot portal), **Pegasus** (ACARS flight tracker), **Hangar** (file storage),
  plus the **v3 API** (Operations server-to-server + Pilot OAuth PKCE). See `references/vamsys-platform.md`.
- **This project (VNWS)**: a custom React + Express stack that *proxies and extends* the vAMSYS v3
  API and adds its own features (desktop app, gallery, chat, achievements, email, etc.). The single
  best concrete API reference is the working integration in `server/index.js` (~279 endpoints).
- **The airlines flown (real Pegas group)**: **Nordwind** (NWS), **Ikar** (KAR, ex–"Pegas Fly"),
  **Southwind** (STW, Turkish). See `references/group-airlines.md`.
- **Networks**: VATSIM and IVAO — live human-ATC multiplayer networks. Events drive most VA
  activity, and a VA both *feeds* and *depends on* its VATSIM region/division (a feedback loop).
  **VNWS is based in the VATRUS division and treats VATSIM as its priority network** — but vAMSYS
  allows other networks (IVAO/PilotEdge/POSCON/offline) and so do we (respect the pilot's preferred
  network; VATSIM is the default, not a lock). Relevant divisions: **VATRUS** (Nordwind/Ikar; incl.
  **Caucasus ACC**) and **TRvACC** (Southwind). See `references/vatsim-network.md` §0.

## Reference files (read the relevant one before acting)

| File | Use it for |
|---|---|
| `references/virtual-airlines-101.md` | What VAs are, how they operate, VATSIM vs IVAO, event types, ranks/economy patterns, what makes a good VA. |
| `references/vatsim-network.md` | VATSIM as a variable: region/division structure (incl. **VATRUS** & **Caucasus ACC**, **TRvACC**), the VA Partner program, events, the VA↔region feedback loop, and VATSIM governing/privacy documents (CoC/CoR/User Agreement/data) and what they mean for VNWS. |
| `references/vamsys-platform.md` | vAMSYS components (Orwell/Phoenix/Pegasus/Hangar), concepts, how a VA is configured, docs map. |
| `references/vamsys-api.md` | v3 API: auth (OAuth client-credentials + PKCE), scopes, JSON:API conventions, full endpoint inventory (Operations + Pilot), canonical doc URLs. |
| `references/group-airlines.md` | Real-world Nordwind / Ikar / Southwind profiles and how they map to VNWS (codes, callsigns, hubs, fleets, naming/crew conventions). |
| `references/ecosystem-and-references.md` | Comparable VA projects, where to find ideas, event references, and the research/refresh workflow when fetching is allowed. |

**Offline docs mirror** (`docs/`, no network needed): `docs/vamsys/` = the full official vAMSYS
user/admin docs (49 md files — concepts, Orwell, **VDS** = Virtual Dispatch System, settings, hangar,
migration); `docs/vatsim/` = VATSIM governing PDFs (CoC, User Agreement, Privacy + Data Collection,
VA Partner Policy). See `docs/README.md` for the map. Grep `docs/vamsys` for exact admin/VDS behaviour;
use `references/vamsys-api.md` for the REST contract.

## Working principles

1. **Terminology first.** VA/ВАК, never VAC. Match the project's bilingual RU/EN convention.
2. **Treat `server/index.js` as the API source of truth** for this project; the public vAMSYS docs
   describe the upstream contract but this codebase shows exactly what works and how it's mapped.
3. **vAMSYS is read-mostly upstream.** We can read pilots/badges/routes/PIREPs; we cannot award
   vAMSYS badges or invent server-side data it doesn't expose (e.g., crew lists, real divert codes).
   When upstream lacks something, generate/derive it locally and label it as such.
4. **Respect the Pegas group identity** when generating content (names, liveries, hubs): Nordwind &
   Ikar are Russian; Southwind is Turkish (mixed RU/TR crews).
5. **Refresh, don't guess.** Canonical sources are listed in `references/vamsys-api.md` and
   `references/ecosystem-and-references.md`. If network fetching is available, pull the live docs to
   confirm details (scopes, new endpoints) before relying on memory. If a fact is uncertain, say so.
