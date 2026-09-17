# The Section Command Ledger

**File:** `data/section-command-ledger.json`
**Builder:** `scripts/build-section-command-ledger.cjs`
**Phase:** 353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted, Plan 02 (D-353-6, R-353-G, R-353-N)

## What it is

A shipped, keyed table of `job_id|problem_type|stage -> ranked command candidates`. It
is the ONE home the runtime reads (through `lib/core/section-ruling-candidates.cjs`) to
order the commands a section's ruling document recommends and to feed
`f-selector-ranker.cjs::rankForSelector`'s existing `tierCandidates` seam. Every
`ROOM.md`'s `default_methodologies` is a derived, fingerprinted view of this file, never
a second source of truth.

**The runtime never calls a vendor.** `data/section-command-ledger.json` is read once,
cached at module load, and consulted with zero network egress on every turn. Users never
carry a Jev key or a Jev dependency, and no file under `lib/` or `hooks/` references
`api.typesafe.ai`.

## The shipped seed is honest about what it is

The file committed to this repo is built with `--offline-seed`: `build_mode` is
`"offline-seed"`, `jev_model` is `null`, `confidence_floor` is `null`, and every
candidate's own `confidence` is `null`. Nothing in this repo may describe the shipped
file as Jev-scored until the navigator's rebuild (below) replaces it. The offline seed's
row ordering comes from the R-353-C union join (a command's own `produces` path naming
the section, seeded from each section contract's own `## Commands that write here`
table, UNION a command's declared `serves_jtbd`), not from a vendor score.

## The navigator's pre-release rebuild (Jev-scored)

The Jev-scored rebuild is a navigator-invoked pre-release act, never a `release.sh` step
and never a hook (R-353-G). Run it from the operator's own shell with the dev-time key
exported (never committed, never printed):

```bash
# TYPESAFE_API_KEY read from ~/.secrets/typesafe.env (mode 600) if not already exported
node scripts/build-section-command-ledger.cjs
```

This pulls Theo's canonical Framework set through the governed `lib/core/brain-client.cjs`
path (fixed Cypher text, `$params` only, never string-assembled) and scores each job's
candidate commands with Jev in batches of 20 at concurrency 4. It writes `build_mode:
"jev-scored"`, the real `jev_model`, the six measured cost keys (`wall_ms`, `jev_calls`,
`input_tokens`, `output_tokens`, `estimated_cost_usd`, `cost_basis`), and a calibrated
`confidence_floor` swept over `evals/icm/cases/turns.json`'s labeled turns.

## The fallback ruling

If Jev is unavailable at rebuild time, or the navigator chooses not to rebuild, the last
shipped ledger stays in force. `scripts/release.sh` Step 2.4 asserts the shipped ledger's
staleness offline (`build-section-command-ledger.cjs --check`, no vendor call) and fails
closed on drift; the audited opt-out is `--no-ledger-check`, named in the release log
with its consequence (a deliberately stale ledger ships).

## The egress ceiling

Only a framework/command NAME, a JTBD STATEMENT and a GLOSSARY LINE (`definition`, else
the first sentence of a `description` capped at 140 characters) may cross to Jev. Never
room content, never a full Theo description, never a user string.
`assertEgressCeiling(payload)` in the build script makes this executable: it runs before
every vendor call and throws on any key outside the allowed set or any string over 140
characters.

A user's own install never carries a Jev key or its dependency, and it never calls Jev in
a hook or anywhere else. The rebuild is a dev-time, navigator-invoked script; the shipped
data is what every install actually reads.
