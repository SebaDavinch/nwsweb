# VATSIM as a variable in the VA equation

How a virtual airline (**VA / ВАК**) plugs into the **VATSIM** network, interacts with its **regions /
divisions**, runs and joins **events**, and how that participation feeds back on both the VA *and* the
region. This is the "online layer" that turns a logbook into a living operation.

> One-line model: **a VA supplies pilots+traffic+identity; a VATSIM division supplies airspace+ATC+
> events. Events are where the two couple, and the coupling is a feedback loop** (more on this below).

## 0. VNWS network stance (project positioning — important)

**Nordwind Virtual is effectively "based" in the VATRUS division** (the Russian-speaking division of
VATSIM) and treats **VATSIM as its priority network**. This is a deliberate identity/positioning
choice, not a technical limit:

- **Home division: VATRUS.** Our core airspace, ATC partners and natural event collaborators are
  VATRUS units (Caucasus ACC, etc.); Southwind ops also touch VATEUD/TRvACC (Turkey). Treat VATRUS as
  the default "where we live" when designing events, region tags, ATC-coverage promos, partnerships.
- **VATSIM is the priority network** in product copy, defaults, event scheduling and feature emphasis
  (prefile links, online reminders, "fly the event" promos default to VATSIM).
- **But other networks are fully allowed.** vAMSYS does not lock a VA to one network, and neither do
  we — pilots may fly on **IVAO, PilotEdge, POSCON, SayIntentions, FSCloud or offline**. Respect the
  pilot's **preferred network** (from `/pilot/preferences`) and never hard-block non-VATSIM flying.
- **Design rule:** VATSIM = sensible default & primary emphasis; other networks = first-class
  alternatives. Anything network-specific (prefile URL, event partner division, online badge) should
  be **driven by the pilot's preferred network / the event's configured network**, with VATSIM as the
  fallback default — not VATSIM-only.

## 1. What VATSIM is (and why it's a variable, not a backdrop)

VATSIM (Virtual Air Traffic Simulation Network) is the largest free online network where human
volunteer controllers staff ATC and pilots fly in shared airspace, talking by voice/text like real
ops. For a VA it is not just "where you fly" — it is an **external system the VA depends on and
influences**: ATC coverage, events, and regional activity determine *when and where flying is fun*,
and the VA's pilots are *traffic* that the network's regions measure and court.

## 2. VATSIM structure (the regions/divisions you interact with)

Hierarchy (managed by the **Board of Governors / BoG**):

```
VATSIM (BoG)
└── Regions (3 global): AMAS (Americas) · EMEA (Europe, Middle East & Africa) · APAC (Asia-Pacific)
    └── Divisions (national/multi-national, e.g. VATUK, VATEUD, VATRUS, VATUSA…)
        └── Subdivisions / local facilities: vACC (Europe/Asia) · ARTCC (USA) · FIR (elsewhere)
            └── Controllers, sectors, sector files, training syllabi, local standing orders
```

See **Appendix A** at the bottom for the full region → division → subdivision list.

- **Local facilities are the "boots on the ground"** — they own the sectors you actually talk to and
  run most events. A vACC/FIR/ARTCC = a piece of real-world airspace, staffed by trained controllers.
- **Controller ratings**: S1 (Tower trainee) → S2 → S3 → C1 (Enroute) etc. Coverage depth at an event
  depends on how many rated controllers a facility can field.
- **Regions relevant to the Pegas group** (verify current status):
  - **VATRUS — the Russian-speaking division of VATSIM** (covers Russia, Central Asian countries,
    Belarus and Eastern-European Russian-speaking communities; site **vatrus.info**). This is the home
    division for **Nordwind** and **Ikar** (both operate mainly out of Moscow/SVO and other Russian
    bases — see note on hubs below). VATRUS is split
    into geographic regions/ACCs (e.g. **Siberia**, **Caucasus**, etc.), each with its FIRs.
  - **Caucasus ACC** (a structural unit/ACC inside VATRUS) — controls airspace over Rostov, Volgograd,
    Astrakhan; the Caucasus republics (Dagestan, Chechnya, Ingushetia, North Ossetia, Karachay-
    Cherkessia, Adygea, Kalmykia); Krasnodar & Stavropol; **and Georgia (Tbilisi FIR / UGGG),
    Azerbaijan, Armenia**. Relevant to southern/leisure routes (e.g. Sochi and the Caucasus). VATRUS
    Caucasus ACC is known to **collaborate with VAs on events** (scenic regional flights).
  - **TRvACC** (VATSIM Turkey, EMEA region) — for **Southwind** (Antalya/LTAI and Turkish airspace).
  - Regional ATC availability shapes which of your routes are "alive" online at any given time, and
    which divisions are natural **event partners** for VNWS.

## 3. How a VA participates in the network

**As pilots (the baseline):** members connect a pilot client (vPilot/swift/xPilot), **prefile a flight
plan** (`my.vatsim.net`), fly the VA's route under the airline **callsign** (ICAO + flight no., e.g.
`NWS xxx` "NORDLAND"), and talk to whatever ATC is online. No partnership needed to just fly.

**As a Partner (the formal layer) — the VA Partner Policy / "VAP" program:**
- VATSIM runs a **Virtual Airlines Partner (VAP)** program, overseen by the **VPVASO** (Vice President
  of Virtual Airlines & Special Operations). VAs apply to become **Partners**.
- Partner benefits include: access to the **VATSIM VA Discord** (coordinate with other VAs and with
  ARTCC/FIR **event coordinators**), eligibility to **co-sponsor events with divisions/facilities**,
  listing as a partner, and shared training/community initiatives.
- Partners are subject to **audits / compliance & quality standards** (activity, conduct, branding).
- Divisions also keep their own **partner VA lists** (e.g. VATSIM Italy, SkyTeam Virtual) and share
  events/training with them.

> For VNWS: "are we a VATSIM Partner?" is a real-world status question — don't assert it; treat it as
> configurable. The product hooks (below) work whether or not VNWS is a formal partner.

## 4. Events — where VA and region couple

Event types (smallest → largest):
- **FNO (Friday Night Operations)** — VATSIM's flagship recurring event: one or two featured airports
  fully staffed on a Friday, heavy traffic. The standard "big night".
- **Fly-in / fly-out** — everyone flies *to*/*from* a featured field in a window; the local vACC staffs it.
- **Group flight / formation** — set departure time + route flown together.
- **Multi-leg tours** — a sequence of legs over days/weeks with progress tracking.
- **Cross the Pond (CtP)** — twice-yearly transatlantic mega-event; full ATC gate-to-gate across the
  NAT; **more NAT crossings than real-world**. Uses a **slot lottery ("Slottery")** — pilots enter,
  a draw allocates booking times; **don't cross without a slot** (ATC manageability).
- **WorldFlight** — round-the-world relay (~70 aircraft per leg), charity-driven, continuous legs.

**How a VA runs or joins an event:**
1. Pick a theme + window that matches **ATC coverage** (coordinate with the relevant vACC/FIR — that's
   what the VA Discord / event coordinators are for).
2. Publish routes/legs; for big events handle **slots/bookings** (CtP Slottery, event booking pages).
3. Promote (Discord, site, in-app). Brief pilots: prefile, callsign, slot/time, comms expectations.
4. Fly it online; **recap** afterwards (stats, screenshots, leaderboard, badges).

## 5. The feedback loop (how participation affects BOTH sides) — "the equation"

This is the part the user asked to model: **event participation is a two-way amplifier.**

**Effect on the VA (ВАК):**
- Activity spike (bookings/PIREPs/online hours concentrated in the window).
- Member acquisition & retention (events are the #1 reason people join/return).
- Engagement currency: badges, achievements, leaderboard movement, economy/points, "passport"
  countries flown — all spike around events.
- Identity & prestige: a well-run event raises the VA's standing and partner reputation.

**Effect on the region / division / facility:**
- **Controller staffing hours & traffic density** rise — facilities *want* VA traffic because it
  justifies staffing and training; busy scopes = controller engagement & rating progression.
- **Recruitment/training** pipeline for the vACC (more pilots → more interest in controlling).
- **Partner standing**: VAs that reliably bring traffic to a division strengthen the partnership;
  divisions reciprocate with co-sponsorship, featured routes, NOTAMs.
- **Network-level load**: mega-events (CtP) reshape traffic (NAT track saturation) — hence slots.

**The loop:** VA promotes event → pilots bring traffic → division staffs ATC → good experience →
more pilots join VA & division → bigger next event. Conversely, no ATC coverage → flat event →
disengagement. So a VA's event calendar is effectively **co-designed with the region's coverage**.

## 6. How to model VATSIM in VNWS (product hooks)

Concrete ways this maps onto features (some already exist — see `vamsys-platform.md`/code):
- **Preferred network + prefile** (exists): show VATSIM/IVAO badge + "file flight plan" deep-link
  (`my.vatsim.net`) and an online reminder before departure.
- **Events/activities tied to the network**: tag an event with its **network (VATSIM/IVAO)**, the
  **region/vACC** providing ATC, and a **slot/booking link** (e.g. CtP Slottery). Track leg/percent
  progress (already in activities).
- **"Fly the event" promos**: surface upcoming VATSIM events relevant to VNWS hubs (read the hub list
  from vAMSYS/site, e.g. SVO, Antalya, …) on the hub agenda / activity feed.
- **Online awareness on the live map**: optionally blend VATSIM presence with VNWS telemetry; show
  "who's online on the network now".
- **Recognition tied to participation**: event badges/achievements, post-event leaderboard, recap in
  news — closing the feedback loop inside the product.
- **Region tagging**: associate routes/hubs with their VATSIM division so events and coverage can be
  filtered ("tonight TRvACC is staffing Antalya").

## 7. VATSIM rules & documents (pilot-relevant, incl. data/privacy)

A VA operating on VATSIM is bound by VATSIM's governing documents — and so are its members when they
connect. Know these; they constrain what a VA may require of pilots and what data it may handle.
Index: **https://vatsim.net/docs/** (policy docs mirrored on `cdn.vatsim.net/policy-documents/`).

**Governing documents (the "three principal items" + more):**
- **Code of Conduct (CoC)** — behaviour on the network (pilots & controllers): be online-ready, follow
  ATC instructions, no disruptive conduct, correct callsign/equipment. A VA may **not** ask members to
  breach the CoC. https://vatsim.net/docs/policy/code-of-conduct/
- **Code of Regulations (CoR)** — the constitutional/structural rules (regions/divisions, roles,
  governance). https://vatsim.net/docs/policy/code-of-regulations/
- **User Agreement** — terms every account holder accepts.
  https://cdn.vatsim.net/policy-documents/User_Agreement_v1.2.pdf
- **Global Ratings Policy / Transfer policies** — controller ratings & moving between divisions
  (mostly ATC-side, but affects who can staff your events).
- **Virtual Airlines Partner (VAP) Policy** — the rules for being a Partner VA (see §3).
  https://vatsim.net/docs/policy/virtual-airline-partners/

**Personal data / privacy (important for VNWS):**
- **Privacy Policy** + **Privacy and Data Collection Policy** — what VATSIM collects and how.
  https://cdn.vatsim.net/policy-documents/Privacy%20Policy%20v1.2.pdf
- **Data Protection & Handling Policy** — data is held in **CERT** (VATSIM's central data repository);
  **regions, divisions and their sub-units may also hold their own data collections**. GDPR-style
  handling obligations apply to anyone (including VAs/divisions) that stores member data.
- **Implications for a VA / VNWS:**
  - Treat VATSIM IDs / member data as **personal data** — store the minimum, get consent, allow
    deletion. (VNWS already follows this instinct: it **does not store IPs**, keeps login history
    without IP, and has token revocation — keep that posture for any VATSIM data too.)
  - Don't scrape or republish another member's data beyond what policy allows; don't expose CERT data.
  - If VNWS ever ingests VATSIM connection/online data, document the lawful basis and retention.
  - Email/marketing to members must stay consent-based (mirrors VNWS's existing CSV-consent email rule).

> Net: VATSIM documents are both a **compliance boundary** (what you can require/store) and a **design
> input** (callsign/equipment rules, ratings → event coverage, partner obligations). When a feature
> touches member data or network conduct, check the relevant doc above first.

## 8. Sources & verify

- VATSIM regions/structure: https://vatsim.net/docs/about/regions/ · EMEA: https://vatsim.net/docs/regions/emea/
- VA Partner Policy / program: https://vatsim.net/docs/policy/virtual-airline-partners/ (+ policy PDFs on cdn.vatsim.net)
- VA ops system: https://vasops.vatsim.net/ · VATSIM VA Discord (via partner program)
- Events: Cross the Pond https://ctp.vatsim.net/ (FAQ, Slottery, schedule) · WorldFlight
  https://www.worldflight.center/ · live events: https://vatsim-radar.com/events
- Turkey: TRvACC https://www.vatsim.tr/
- Russia: **VATRUS** https://vatrus.info/?lang=eng (regions/FIRs incl. **Caucasus ACC**
  https://vatrus.info/geo/region/caucasus?lang=eng · Tbilisi FIR https://vatrus.info/geo/fir/UGGG?lang=eng)
- Governing/policy docs index: **https://vatsim.net/docs/** — CoC, CoR
  (https://vatsim.net/docs/policy/code-of-regulations/), User Agreement, Privacy & Data Collection,
  VA Partner Policy (https://vatsim.net/docs/policy/virtual-airline-partners/). PDFs on
  `cdn.vatsim.net/policy-documents/`. (Note: `vatsim.net/docs/` may return 403 to automated fetch —
  use a browser or the cdn PDF links.)
- IVAO equivalent: https://ivao.aero/ (mirror these concepts; prefile `fpl.ivao.aero`)

> Verify partner status, division names, and event dates against the live sources — these change.
> Keep terminology correct: **VA / ВАК**, never "VAC".

---

## Appendix A — Full VATSIM region → division → subdivision tree

VATSIM = **3 regions**, each split into **divisions**, each split into **subdivisions** (vACCs in
Europe/Asia, **ARTCCs** in the USA, **FIRs** elsewhere). Counts/names drift — **verify against
https://vatsim.net/docs/regions/** (per-region pages: `/amas/`, `/emea/`, `/apac/`).

### AMAS — Americas (7 divisions)
- **VATUSA** — United States (+ PKWA Kwajalein/Bucholz). Subdivided into **ARTCCs** (e.g. ZNY New York,
  ZLA Los Angeles, ZMA Miami, ZAU Chicago, ZID, ZTL, ZOA, ZSE, ZHU, etc. — ~20+ ARTCCs).
- **VATCAN** — Canada (FIRs: Vancouver, Edmonton, Winnipeg, Toronto, Montreal, Moncton, Gander…).
- **VATMEX** — Mexico.
- **VATCA** — Central America (Guatemala, Belize, Honduras, El Salvador, Nicaragua, Costa Rica, Panama).
- **VATCAR** — Caribbean.
- **VATSUR** — South America (Argentina, Bolivia, Chile, Colombia, Peru, Ecuador, Uruguay, Venezuela,
  Paraguay).
- **VATBRZ** — Brazil.

### EMEA — Europe, Middle East & Africa (5 divisions; ~48 local institutions)
- **VATUK** — United Kingdom (3 FIRs: London, Scottish, + others). ~24% of EMEA membership.
- **VATEUD** — Europe Division (~68% of the region): Ireland, continental Europe, the Balkans,
  Scandinavia, Ukraine, **Turkey**, and the Mediterranean islands. Split into **~32 country vACCs**,
  including (verify): **VATSIM Turkey / TRvACC** (→ Southwind), Germany (VATGER), France, Spain, Italy,
  Netherlands, Belgium, Switzerland, Austria, Poland, Czech, Scandinavia, Portugal, Greece, Ireland,
  Romania, Hungary, the Balkans, the Baltics, Ukraine vACC, etc.
- **VATRUS** — Russia/Russian-speaking division: Russia, Central-Asian states, Belarus & Eastern-
  European Russian-speaking communities. Split into **Russia's ~12 FIRs + Ukraine vACC**, grouped into
  regions/ACCs incl. **Caucasus ACC** (S. Russia + Georgia/UGGG, Azerbaijan, Armenia), **Siberia**,
  Krasnoyarsk (UNKL), etc. → **Nordwind & Ikar home division.**
- **VATMENA** — Middle East & North Africa (Persian Gulf, Middle East, North Africa).
- **VATSSA** — Sub-Sahara Africa (southern part of the continent).

### APAC — Asia-Pacific (8 divisions)
- **VATPAC** — Australia Pacific (Australia, Fiji, French Polynesia, Kiribati, Marshall Is. excl.
  Kwajalein, Micronesia, Nauru, New Caledonia, Palau, Papua New Guinea, Solomon Is., Tuvalu, Vanuatu,
  Wallis & Futuna).
- **VATNZ** — New Zealand (New Zealand, Samoa, Tonga, Cook Islands, Niue).
- **VATPRC** — People's Republic of China.
- **VATROC** — Republic of China (Taiwan).
- **VATJPN** — Japan.
- **VATKOR** — Korea.
- **VATSEA** — South-East Asia.
- **VATWA** — West Asia.

> For the Pegas group: Southwind ⇒ **VATEUD / TRvACC (Turkey)**; Nordwind & Ikar ⇒ **VATRUS** (their
> bases are across Russia — Moscow, St. Petersburg, Kaliningrad, etc.; southern/Sochi routes fall under
> **Caucasus ACC**). These are the natural event-partner divisions for VNWS. The relevant division for
> any given event is **whatever vACC/FIR covers that route's airspace** — derive it from the route, not
> from a hardcoded hub list. Rosters change — confirm on the region pages before asserting.
