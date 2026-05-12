# Phase 110 - Discuss-Phase Discussion Log

> Human-reference audit trail of the `/gsd:discuss-phase 110` session (2026-05-12). NOT consumed by downstream agents (researcher / planner / executor) -- they read `110-CONTEXT.md`.

## Setup

- Invoked top-level: `/gsd:discuss-phase 110` (no `--auto`; `workflow.discuss_mode` unset -> `discuss` mode).
- `110-CONTEXT.md` already existed as a 2026-05-03 Codex-input stub (thesis / hard invariant / scope / out-of-scope all already locked). Treated as "Update it" -- expand the stub with the missing implementation decisions D-05..D-11.
- Prior context loaded: PROJECT.md (Phase 109 just shipped; Canon Part 9 ratified v1.4), STATE.md (Current Position = Phase 110), CANON-PHASE-MAP.md (Phase 110 = `planned, v1.13.0-beta.3` per the Path C re-route -- the stub's `parent_release: v1.14.0` is stale; fixed in the new CONTEXT frontmatter), the Phase 109 packet.cjs / ingestion.cjs / navigation.cjs APIs, the Phase 90 buildBrainQueryContext 5-tripwire precedent.
- Codebase scout: `ajv@8.18.0` is resolvable (bundled w/ the MCP SDK -- no new direct dep); `buildBrainPacket` exists from Phase 109 (emits `packet_version`/`local_graph_summary`/`banked_opportunities`, NO `origin` field yet); `brain-client.cjs` has `query`/`callTool`/`write` but no `sendPacket()` and no JSON Schema validation; `data/command-registry.json` + `scripts/build-command-registry.cjs --check` + the pre-commit wiring (Phase 122) is the pattern to mirror.

## Gray areas presented (multiSelect)

1. Validator: ajv vs hand-rolled (+ response-validation strictness)
2. `origin` provenance strength (string+hook+allowlist vs + in-process nonce)
3. Privacy modes: which the shipped jobs need + opt-up UX
4. Dual-path rollout window + legacy sunset

User selected: **all four.**

## Decisions

| # | Gray area | Options offered | User pick | -> CONTEXT |
|---|-----------|-----------------|-----------|-----------|
| 1 | Validator | (A) ajv@8.18.0 + `data/brain-packet-schema.json` + `scripts/build-brain-packet-schema.cjs --check` tripwire; response-validation = reject-hard-but-degrade-soft (no ingest, log a `memory_event`, turn proceeds Brain-advice-less, never throw, never partial-ingest) -- **recommended**.  (B) hand-rolled per-job `validateIn/Out<Job>()` in the Phase-90 style; no schema file. | **A** | D-05, D-06, D-07 |
| 2 | `origin` provenance | (A) `origin: 'navigation_api'` string field (`'test_fixture'` only with `MINDRIAN_TEST_MODE=1`) + pre-commit hook fails any new `sendPacket(` not preceded by `buildBrainPacket(` + `brain-client.sendPacket` rejects non-allowlisted `origin` -- 3 independent layers, no crypto -- **recommended**.  (B) also stamp + verify an in-process nonce (belt + suspenders).  (C) call-stack/module-identity inspection -- not recommended. | **A** | D-08 |
| 3 | Privacy opt-up | (A) default + only-ever-used = `local_summary_only`; opt-up to `allow_filenames` = `config.json > preferences.brain_privacy_mode` / per-call `opts.privacyMode`, no prompt; opt-up to `allow_excerpts` = config flag AND a one-time Part-3 Decision Gate per room (APPROVE+reason); `allow_excerpts` has no shipped consumer (escape hatch) -- **recommended**.  (B) config flag alone for both.  (C) Decision Gate for both. | **A** | D-03 (carried), D-09 |
| 4 | Dual-path sunset | (A) dual through `v1.13.0-beta.3 .. v1.13.0-final`; first legacy job-style call per session emits `console.warn` + a `memory_event`/telemetry line; `v1.14.0` DELETES the legacy job path (code removed); `query()`/`write()` raw-Cypher methodology lookups untouched forever (not "legacy") -- **recommended**.  (B) same but `v1.14.0` hard-errors instead of deleting.  (C) longer window -- dual through `v1.14.0`, typed-only in `v1.15.0`. | **A** | D-10 |

All four locked to the recommended option. No scope-creep raised. No prior-phase decision conflicts. The closed job vocabulary, the hard invariant, `packet_version: '1.0'`, the privacy-mode names, and "Brain-side enforcement is out of scope" were carried forward verbatim from the stub (D-00..D-04).

## Output

- `110-CONTEXT.md` rewritten: status `Ready for planning`; D-00..D-11 + Claude's Discretion + canonical_refs + code_context + specifics + deferred; frontmatter `parent_release` / `target_release` corrected to `v1.13.0-beta.3` (Path C).
- This log.
- Next: `/gsd:plan-phase 110`.
