# Virtual Airlines 101 — concepts, networks, events

> Terminology: **VA** (English) / **ВАК** (Russian, *Виртуальная Авиакомпания*). **Never "VAC".**

## What a virtual airline is

A **virtual airline (VA)** is a flight-simulation hobby organisation that simulates operating a real
or fictional airline. Members ("virtual pilots") fly legs in a flight simulator (MSFS 2020/2024,
X-Plane 11/12, Prepar3D) on behalf of the VA, logging each flight as a **PIREP**. VAs range from a
handful of friends to thousands of members with full management platforms, economies and events.

A VA is **not** a real air carrier — no real passengers, no commercial authority. It models the
*operation* of an airline: fleet, route network, schedules, ranks, sometimes a virtual economy.

### Core building blocks

- **Fleet** — the aircraft types/registrations the VA "operates". Pilots pick an aircraft when they
  book a flight; fleets are usually grouped by type (A320, B738, etc.).
- **Route network / schedules** — scheduled sectors between airports the VA serves. A route has a
  flight number, origin/destination, distance, typical duration, allowed fleet, sometimes days/freq.
- **Hub** — a base airport. Pilots are "located" at an airport; you usually fly out of where you are.
- **Booking / dispatch** — reserving a route + aircraft + time before flying; "dispatch" prepares the
  flight (often generating an OFP via SimBrief).
- **PIREP** (Pilot Report) — the record of a completed flight: route, times, fuel, landing rate,
  position track. Filed automatically by an **ACARS** client or manually ("manual claim").
- **ACARS** — software that connects to the sim, tracks the flight live (position, altitude, phase)
  and auto-submits the PIREP. (vAMSYS's ACARS is **Pegasus**.)
- **OFP** (Operational Flight Plan) — the dispatch paperwork; almost always generated via **SimBrief**.
- **Ranks** — progression tiers earned by flight hours / number of PIREPs / points (e.g. Cadet →
  First Officer → Captain → Senior Captain). Often gate access to bigger aircraft.
- **Badges / awards / achievements** — recognition for milestones (first flight, 100 hours, events).
- **Economy** (optional) — virtual currency/points earned per flight, spent on perks; engagement loop.
- **NOTAM** — operational notice pilots must read/acknowledge (e.g. before booking).
- **Roster / events / activities** — organised group flying (see below).

## Online networks: VATSIM and IVAO

VAs are usually flown on a live online network so pilots share airspace and talk to human ATC.

- **VATSIM** (Virtual Air Traffic Simulation Network) — the largest network; free; volunteer
  controllers; voice + text. Pilots **file a flight plan** (prefile) and connect via a pilot client
  (vPilot, swift, xPilot). Big events fill sectors with real-time ATC coverage.
- **IVAO** (International Virtual Aviation Organisation) — the other major network; similar model,
  its own software and ratings.
- Other/smaller: PilotEdge (paid, NA-focused ATC), POSCON, SayIntentions (AI ATC), FSCloud.

A VA does **not** require flying online — many log offline flights too — but online flying (esp.
during events) is the social core. VNWS surfaces a pilot's **preferred network** and offers a
"file flight plan" prefile link (VATSIM `my.vatsim.net`, IVAO `fpl.ivao.aero`, etc.).

### Why networks matter for VA features

- Show the pilot's network and a prefile reminder before departure (VNWS does this).
- Events are scheduled around network ATC coverage windows.
- Live maps may blend VA telemetry with network presence.

## Events — the heartbeat of a VA

Events are scheduled, themed group flying. They drive engagement and are worth designing well.

Common event types:
- **Fly-in / fly-out** — everyone flies *to* (or *from*) one featured airport in a window; ATC staffs it.
- **Group flight / formation** — a set departure time and route flown together.
- **Multi-leg tours** — a sequence of legs completed over days/weeks, with progress tracking
  (VNWS "activities" track leg/percent completion).
- **Network-wide events** — VATSIM *Cross the Pond*, *World Flight*, regional fly-ins; VAs join in.
- **Challenges** — metric-based goals (most legs this month, specific city pair, landing-rate contests).
- **Online days** — a recurring evening where members commit to fly online together.

Good event design: clear theme + window, achievable legs, ATC/network coordination, a reward
(badge/points/leaderboard), good comms (Discord), and a recap afterwards.

## What makes a VA good (product checklist)

- Low-friction **dispatch** (book → SimBrief → fly → auto-PIREP).
- A reason to **come back**: ranks, achievements, economy, leaderboards, events, community (chat/gallery).
- **Identity**: real liveries/fleet/hubs, consistent branding, lore.
- **Visibility**: live map, activity feed, stats, "who's flying now".
- **Fairness/automation**: ACARS validation, anti-cheat on PIREPs, clear rank/economy rules.
- **Community**: Discord, gallery, events, recognition.

## How this maps to VNWS

VNWS implements the full loop on top of vAMSYS: bookings/dispatch, PIREPs + screenshots, live map,
NOTAMs, events/activities with progress, ranks, badges + a custom achievements system, balance/economy,
passport (countries flown), leaderboard, gallery, chat, a desktop companion app (NordwindHub), and
network prefile reminders. See `vamsys-platform.md` and `vamsys-api.md` for the mechanics.
