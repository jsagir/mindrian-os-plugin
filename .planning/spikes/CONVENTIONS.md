# Spike Conventions

Patterns and stack choices established across spike sessions. New spikes follow these
unless the question requires otherwise.

## Stack

- Node 22 CJS, zero npm deps, native `fetch`. No SDK inside a spike; the SDK is a
  real-build decision.
- Any Brain/Theo read goes through `lib/core/brain-client.cjs` (`query(cypher, params)`),
  never a second wire. Cypher is a FIXED text with `$params`; never assembled by
  concatenation (substrate rule m4 refuses the commit otherwise).

## Structure

- `.planning/spikes/NNN-name/`: runner `*.cjs`, `results.json` (forensic log: every
  request as an event with ts, label, status, ms, usage), `README.md` with frontmatter,
  optional `report.cjs` -> `report.html` (De Stijl, inline CSS/JS, no CDN, hyphens only).
- `.planning/` is gitignored: stage spike files with `git add -f` by explicit path.
- Commit format `docs(spike-NNN): VERDICT - key finding`, trailer
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Patterns

- Secrets: read from `process.env` or `~/.secrets/<vendor>.env` in-process; never
  printed; stdout piped through `sed` to redact `apikey_*`.
- Canon Part 8 in every payload: generic handles, enums, quantized scalars. Room content
  never crosses. Theo descriptions are Mindrian IP: what may cross to a third vendor is a
  navigator ruling (2026-09-17: name + JTBD statement + glossary line).
- Vendor numbers are labeled as vendor-claimed until a spike measures them; only spike
  measurements are quoted as facts.
- Repeat the headline run once before a verdict; note whether the ranking or the tail
  latency moved.

## Tools and Libraries

- TypeSafe Jev: `POST https://api.typesafe.ai/v1/systemone`, `model: jev-latest`
  (served `jev-1.13.0` on 2026-09-17), Bearer key. Validation failures return 400 (docs
  say 422). No 429 observed at concurrency 20.
- Theo read contract: ROW_CAP=100 with a text-only over-cap response; `Skip`, `Distinct`,
  `NodeUniqueIndexSeekByRange` rejected; bucket by a function-wrapped predicate on the
  name's first character(s).
