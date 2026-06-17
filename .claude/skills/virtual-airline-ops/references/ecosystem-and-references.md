# VA ecosystem, idea sourcing & research workflow

Use this when designing features/events for VNWS and you want to see **how other VAs do it**, compare
ideas, or refresh facts from source.

## Comparable VA platforms & projects (for idea benchmarking)

- **vAMSYS** (this project's platform) — Orwell/Phoenix/Pegasus/Hangar. Watch its **changelog**
  (https://vamsys.co.uk/changelog) for new capabilities to surface in VNWS.
- **phpVMS** — long-running open-source VA platform; huge ecosystem of community modules; good for
  seeing baseline VA feature sets and economy/rank patterns.
- **AirlineSim** — browser airline-management/economy game (not sim-flying) — strong reference for
  *economy* and scheduling depth.
- **SimBrief** (navigraph) — de-facto OFP/dispatch generator every serious VA integrates.
- **Volanta**, **FSHub**, **ACARS-class trackers** — flight tracking + maps + social feeds; good UX
  references for live map, screenshots-on-map, and activity feeds (VNWS already borrows the
  geo-screenshot idea).
- **Big established VAs** (for polish/event ideas): e.g. LH Virtual (a premier vAMSYS VA),
  British Airways VA, American/Delta/United VAs, IVAO/VATSIM "virtual airlines" directories.
- **Directories**: VATSIM and IVAO maintain virtual-airline listings; "mynextairline" and similar
  aggregate VAs you can study.

## Where to source ideas (themes to mine)

- **Engagement loops**: ranks, achievements/badges, virtual economy/balance, leaderboards, passport
  (countries/airports flown), streaks.
- **Events**: fly-ins, multi-leg tours, group flights, challenges, network-wide events (Cross the
  Pond, World Flight), online nights. See `virtual-airlines-101.md`.
- **Community**: Discord integration, screenshot gallery + likes, activity feed, chat, recognition.
- **Immersion**: live map, in-flight IFE/destination guide, METAR, crew manifests, Discord Rich
  Presence, desktop companion.
- **Ops realism**: SimBrief OFP, NOTAM acknowledgement gates, network prefile reminders, divert
  handling, load factors, scoring/auto-reject rules (Orwell concepts).

## Research / refresh workflow (when web access is available)

Fetching is sometimes blocked by environment policy. When it works:

1. **vAMSYS docs** — read the canonical pages:
   - Operations API: https://vamsys.io/docs/operations
   - Pilot API: https://vamsys.io/docs/pilot
   - Orwell: https://vamsys.co.uk/docs/orwell/ · User docs: https://vamsys.co.uk/docs
   - Dev docs: https://docs.vamsys.dev/ · API/auth: https://protocol.vamsys.dev/
   - These API pages are **client-rendered (Scalar)** — to extract endpoint specs, load the OpenAPI
     JSON the viewer fetches, or pull markdown from the docs source repo below.
2. **Docs source mirror** (closest to a downloadable wiki, archived/read-only):
   https://github.com/vAMSYS-LTD/documentation — pull raw files from
   `https://raw.githubusercontent.com/vAMSYS-LTD/documentation/<branch>/<path>` (folders: `concepts`,
   `guides`, `orwell`, `vds`, `hangar`, `migration`, `settings`, `data`, `checklist`).
3. **Community forum** (Q&A, project codenames, staff answers): https://community.vamsys.io/
4. **Airlines** (real-world facts): Wikipedia — Nordwind Airlines, Ikar (a.k.a. Pegas Fly),
   Southwind Airlines; airhex/airline databases for codes.
5. **Networks**: vatsim.net (events, prefile `my.vatsim.net`), ivao.aero (`fpl.ivao.aero`).
6. **Cross-check against `server/index.js`** — it is the ground truth for what the live API returns
   in practice (field names, paging, quirks) for *this* project.

## Output discipline when researching

- Distil into the relevant reference file in this skill (don't dump raw HTML).
- Cite the source URL.
- Mark anything uncertain or volatile (codes, fleets, scope strings) as "verify in Orwell/docs".
- Keep terminology correct: **VA / ВАК**, never "VAC".
