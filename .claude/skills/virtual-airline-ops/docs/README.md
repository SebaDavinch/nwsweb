# Offline documentation mirror

Local copies of upstream docs so the skill works without network access. **These are mirrors —
upstream may be newer.** Re-pull with the commands in `references/ecosystem-and-references.md`.

## `vamsys/` — vAMSYS official docs (49 markdown files)

Mirrored from **github.com/vAMSYS-LTD/documentation** @ `bc5f49e` (branch `main`; repo archived
read-only 2025-07-17). Markdoc/Markdown format (`{% ... %}` tags). Folder `page.md` files were
flattened to `<folder>.md`.

| Area | Files | What's in it |
|---|---|---|
| `vamsys/checklist*` | overview + day-1…day-5 | New-VA onboarding checklist. |
| `vamsys/concepts/` | `users-and-pilots`, `activity`, `rank-transfer` | **Core data-model concepts** — read these first. |
| `vamsys/orwell/` | `pilots`, `ranks`, `badges`, `events`, `announcements`, `staff`, `liveries-pireps`, `design`, `pages` | **Orwell admin** per-section guides. |
| `vamsys/vds/` | `routes`, `aircraft`, `airports`, `load-management` | **VDS** = Virtual Dispatch System (routes/fleet/airports/load factors). |
| `vamsys/settings/` | `api`, `airline`, `acars`, `discord`, `scores`, `autoreject`, `point-presets`, `comment-presets`, `share-agreements`, `vds` | Platform settings. **`settings/api.md`** = API token creation in Orwell. |
| `vamsys/hangar/` | overview, `quick-start`, `enabling-hangar`, `hangar-components`, `hangar-settings` | **Hangar** file storage. |
| `vamsys/data/` | overview, `importers`, `exporters` | Bulk data import/export. |
| `vamsys/migration/` | overview, `checklist`, `launch` | Migrating an existing VA onto vAMSYS. |
| `vamsys/guides/` | `pfpx-airac-validation`, `regular-expressions-flight-type` | How-to guides. |

> Note: this docs repo is the **user/admin (Orwell/Phoenix/Pegasus/VDS) guide**, not the raw REST API
> reference. For the **v3 API endpoint contract** use `references/vamsys-api.md` (verified against
> `server/index.js`) + the live Scalar docs at vamsys.io/docs/operations · /docs/pilot.

## `vatsim/` — VATSIM governing documents (5 PDFs)

Mirrored from `cdn.vatsim.net/policy-documents/`:

- `Code_of_Conduct_2024.pdf` — network conduct rules (pilots & ATC).
- `User_Agreement_v1.2.pdf` — terms every account holder accepts.
- `Privacy_Policy_v1.2.pdf` — privacy statement.
- `Privacy_and_Data_Collection_Policy_v1.1.pdf` — data collection/handling (CERT, GDPR-style).
- `Virtual_Airlines_Partner_Policy_2024_v2.pdf` — the VA Partner (VAP) program rules.

See `references/vatsim-network.md` §7 for what these mean for VNWS (data handling, partner status).

## Refreshing

```powershell
# vAMSYS docs (re-pull latest from the archived repo or a fork)
#   list:  GET https://api.github.com/repos/vAMSYS-LTD/documentation/git/trees/<sha>?recursive=1
#   raw:   https://raw.githubusercontent.com/vAMSYS-LTD/documentation/<sha>/<path>
# VATSIM PDFs: download from https://cdn.vatsim.net/policy-documents/<file>.pdf
```
