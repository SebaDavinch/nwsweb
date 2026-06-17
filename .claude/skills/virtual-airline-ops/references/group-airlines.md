# The Pegas group airlines (real-world) and how they map to VNWS

Nordwind Virtual flies the real **Pegas group** airlines. Get the identity right when generating
names, liveries, callsigns or crew. Confirm live codes/fleets in **Orwell** / the vAMSYS roster
(`/pilots`, `/fleet`, `/routes`) — registrations and route networks change.

> ⚠️ **Hubs/bases are NOT hardcoded.** The operating bases below are real-world context only and they
> drift (Ikar alone flies from Moscow/SVO, St. Petersburg, Kaliningrad, Krasnoyarsk, Kazan, Perm…).
> **The authoritative hub list lives in vAMSYS / the VNWS admin** — read it from `/hubs` (Operations
> API) or the site config. Never assert a VA's hub from this file; treat these as "where they fly in
> reality", and let the configured data win.

## Nordwind Airlines — "NWS" (the flagship)

- **Real-world**: Russian leisure/charter+scheduled airline, founded **August 2008** by tour operator
  **Pegas Touristik** (Russian & Turkish branches). HQ **Moscow**; main hub **Sheremetyevo (SVO / UUEE)**.
- **Codes**: IATA **N4**, ICAO **NWS**, callsign **"NORDLAND"**. ~27 aircraft (widebody + narrowbody;
  Boeing 777, A330, A321/320, etc. — verify current fleet).
- **Network**: leisure routes from Russia to sun destinations + domestic; large international charter.
- **VNWS mapping**: primary brand. Code/callsign prefix **NWS / Nordwind**. Russian crew names.

## Ikar — "KAR" (ex–"Pegas Fly")

- **Real-world**: Russian charter airline, **Ikar LLC**. **Registered/legal HQ = Orenburg** (a legacy
  of the *Pegas Fly* era) — but **Orenburg is NOT its operational hub today.** Operationally Ikar is
  **multi-base**, flying mainly from **Moscow Sheremetyevo (SVO/UUEE)** (alongside Nordwind), plus
  Krasnoyarsk (Yemelyanovo), Kazan, Perm. Traded as **"Pegas Fly"** 2015–2022, reverted to **Ikar** 2022.
  Ikar LLC also does fleet maintenance for the Pegas group (incl. Nordwind).
- **Codes**: IATA **EO**, ICAO **KAR**. Fleet (verify): Boeing 737-800/900, Boeing 777-200, Embraer 190.
  Brand text you may see: "Икар", "Pegas Fly".
- **VNWS mapping**: code/callsign prefix **KAR / Икар** (detection also matches "Pegas"). Russian crew.
  For a hub, use **SVO/Moscow** (operational), not Orenburg.

## Southwind Airlines — "STW" (the Turkish sister)

- **Real-world**: **Turkish** leisure airline, founded **April 2022**, HQ **Antalya**. ~14 aircraft,
  ~20 destinations. Widely reported as **linked to Nordwind** (shares some crews/aircraft).
- **Codes**: prefix **STW / Southwind** (also "SWI"; verify IATA/ICAO/callsign in roster).
- **VNWS mapping**: code/callsign prefix **STW / Southwind**. **Mixed crews — Russian + Turkish names**
  (VNWS crew generator uses RU+TR for Southwind, RU for Nordwind & Ikar).

## Airline detection in VNWS code

`detectAirline(callsign, flightNumber)` (see `src/app/components/desktop/flight-crew.ts`):
- `STW` / `SWI` / `SOUTHWIND` / "Южный ветер" → **southwind**
- `KAR` / `IKAR` / "Икар" / `PEGAS` → **ikar**
- otherwise → **nordwind** (default)

## Identity cheat-sheet for generated content

| Airline | Region | Crew names | Code prefix | Hub (real) |
|---|---|---|---|---|
| Nordwind | Russia | Russian | N4 / **NWS** / Nordwind | SVO (UUEE), Moscow |
| Ikar | Russia | Russian | EO / **KAR** / Икар (Pegas Fly) | **SVO/Moscow** (operational; HQ Orenburg is legal only) |
| Southwind | Turkey | Russian **+** Turkish | **STW** / Southwind | Antalya (LTAI) |

> Branding: red/white Nordwind livery cues (the project's `NordwindJet` SVG and `#E31E24` accent).
> Always verify the *actual* operating fleet/routes from the vAMSYS roster before asserting specifics
> in user-facing copy — real-world fleets churn and the VA's configured fleet may differ.
