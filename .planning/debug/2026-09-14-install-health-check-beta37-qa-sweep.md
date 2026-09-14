---
status: partially-resolved
kind: qa-sweep
trigger: "2026-09-14-install-health-check-beta37-qa-sweep"
issue_id: ""
severity: medium
surfaces: [cli]
brain_mode: full-loop
canon_parts: [7, 8]
created: 2026-09-14T00:00:00Z
updated: 2026-09-14T00:00:00Z
---

## RECONSTRUCTION NOTICE (read first)

The original version of this file (created during the planning session that
produced `.planning/quick/260914-ntk-fix-rca-findings-1a-1b-3-4-1-4-2-4-3-5-i/260914-ntk-PLAN.md`)
was destroyed mid-execution by a **concurrent GSD session sharing this same
working directory** (`/home/jsagi/dev/MindrianOS-Plugin/`). That session was
executing an unrelated Phase 344 plan, ran `node scripts/doctor.cjs
--acceptance` as part of its own verification, observed this quick task's
in-flight uncommitted edits sitting in the shared tree (this file, plus
uncommitted changes to `scripts/doctor.cjs` and
`lib/core/doctor/graph-derive-health-module.cjs`), misattributed them to
`doctor --acceptance` "self-patching its own source tree", and reverted the
tracked files with `git checkout --` and deleted this untracked file. Their
own reasoning is preserved verbatim at
`.planning/phases/344-the-layer-contract-name-describe-and-pin-every-engineering-l/deferred-items.md`
item 1.

**Consequence:** the original 458-line RCA -- with its full Symptoms,
Eliminated, Evidence, and per-finding Technical Root Cause sections -- is
gone and was never read into this executor's context (the plan's own
"Facts verified during planning" section was written to be self-sufficient
for execution precisely so re-reading the RCA was not required, per the
plan's own instruction not to re-derive facts). This reconstruction restores
enough structure to keep `/gsd:debug` and future sessions oriented, using
only what survives in `260914-ntk-PLAN.md`:

- The 8 findings this quick task closed (1a, 1b, 3, 4.1, 4.2, 4.3, 5.ii, 5c)
  are documented below with real root-cause detail, because the plan
  preserved exact file:line evidence for each.
- The 5 findings still open (2, 5b, 7, 5.i, 6) are documented with ONLY the
  one-line summaries the plan's "Explicitly OUT OF SCOPE" section preserved.
  Their original Symptoms/Evidence/reproduction-steps sections are lost. A
  follow-up session that picks up any of findings 2, 5b, 7, 5.i, 6 should
  expect to re-gather evidence for them, not assume it exists here.

**Recommendation:** the underlying hazard (two GSD executor sessions writing
into the same physical working directory, with no isolation) should get its
own debug session. `deferred-items.md`'s recommendation to investigate "why
doctor.cjs --acceptance writes to its own source tree" was itself a
misdiagnosis -- the real cause is cross-session collision, not a doctor.cjs
self-patch bug. This RCA file does not open that investigation; it only
flags it here so it is not silently lost a second time.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: v2.0.0-beta.37 (QA sweep target)
- Reported by: beta.37 install-health-check QA sweep
- Date first observed: 2026-09-14
- Related debug sessions: none known

## Problem Statement

The beta.37 install-health-check QA sweep found 13 findings across the
`doctor.cjs` diagnostic surface. Quick task 260914-ntk closed 8 of them
(the derive/eureka doctor cluster, the generic renderer's literal
"undefined", and the room-md/MINTO/statusline drift cluster). 5 remain open,
tracked below and in `260914-ntk-PLAN.md`'s "Explicitly OUT OF SCOPE"
section.

## Findings -- CLOSED by quick task 260914-ntk

### Finding 1b -- `doctor --fix eureka` was a silent no-op

- Status: FIXED
- Root cause: `scripts/doctor.cjs`'s `parseArgs` (a bare `for (const arg of
  argv)` chain of `===` comparisons) had no branch for the token following
  `--fix`, so `eureka` in `--fix eureka` matched nothing and was silently
  discarded. `fixEurekaSmoke()` (`lib/core/doctor/class-s-eureka-smoke.cjs:355`)
  shipped fully implemented and exported but was never called from anywhere,
  a no-op since commit `ec98625f`.
- Fix: added a positional-argument capture for `--fix eureka` (mirroring the
  existing `--bind-check <roomDir>` idiom) plus a fix-then-recheck flow in
  both the standalone and combined class S dispatch paths. `--dry-run`
  always projects the install without spawning, independent of current
  check state.
- Deliberately NOT done: `--all` still excludes class S by design
  (`commands/doctor.md:97`); `--fix --all` does not trigger the 380 MB
  eureka install.
- Commit: 556c4780 (`fix(quick-260914-ntk): wire --fix eureka to
  fixEurekaSmoke, surface encoder-unavailable and derive-attempt-completed
  signals`)

### Finding 1a -- encoder-unavailable rooms got generic re-enqueue advice

- Status: FIXED
- Root cause: `detectRoomHealth()` (`lib/core/doctor/graph-derive-health-module.cjs`)
  never read the `derivation_skipped` memory_event that
  `discloseSkip()` (`scripts/gsd-graph-derive-drain.cjs:315-343`) writes with
  `reason: 'encoder_unavailable'`. A room whose derive skipped every pair for
  lack of the local semantic encoder looked identical to a room that simply
  had not derived yet.
- Fix: `detectRoomHealth()` now reads the last `derivation_skipped` event
  through `findRecentChanges` (the read-only navigation door). A room whose
  most recent skip event names `encoder_unavailable`, with no newer
  heal-attempt marker, reports `encoderUnavailable: true` and a reason
  naming `/mos:doctor --fix eureka`, and `fix()` skips re-enqueueing it.
- Commit: 556c4780 (same as Finding 1b)

### Finding 5c -- a room that legitimately found zero edges was re-enqueued forever

- Status: FIXED
- Root cause: `needsHeal` (`graph-derive-health-module.cjs:244`, pre-fix) was
  a pure function of current state (`hasBelongsTo && cascadeEdgeCount ===
  0`), with no memory of whether a derive attempt had ever run. A room that
  ran a real derive and honestly found nothing to connect looked identical
  to a room that never derived, and kept getting re-enqueued.
- Fix: added a local heal-attempt marker
  (`<roomDir>/.mindrian/graph-derive-heal-attempts.json`), written by
  `fix()` on every successful re-enqueue (atomic tmp-file-plus-rename write,
  mirroring `enqueueDerive`'s own idiom). An empty queue after a recorded
  attempt now converges to `deriveAttemptCompleted: true`, `status: 'ok'`,
  breaking the loop.
- Commit: 556c4780 (same as Finding 1b)

### Finding 3 -- the generic renderer printed the literal word "undefined"

- Status: FIXED
- Root cause: the check-row renderer's fallback chain
  (`check.detail || check.status`) and the fix-row renderer's fallback chain
  (`entry.detail || entry.status`) in `scripts/doctor.cjs`'s generic `--all`
  renderer assumed every result carries `{status, detail}`. `checkBrainSmoke()`
  returns `{ok, layers, overall_ms}` with neither field; `install-state`
  recovery entries carry `{class, surface, action, ok, note}` with `detail`
  present only on the failure branch. Under a combined run both fallbacks
  bottomed out at `undefined`.
- Fix: extended both fallback chains (`check.detail || check.status ||
  (check.ok ? 'ok' : 'unknown')` and `entry.detail || entry.note ||
  entry.status || entry.action || (entry.ok ? 'ok' : 'unknown')`). Fixed the
  renderer, not the producers, since normalizing every producer would mean
  touching class M, install-state, and every future async carve-out.
- Commit: 7938e428 (`fix(quick-260914-ntk): stop the generic doctor renderer
  printing literal "undefined"`)

### Findings 4.1 and 4.2 -- room-md flagged dot-directories as rooms

- Status: FIXED
- Root cause: `listSubdirs()` in `lib/core/doctor/room-md-module.cjs` had no
  categorical dot-directory skip, only the named `SKIP_DIRS` set. It
  enumerated `.intelligence` and `.snapshots` as sections missing
  ROOM.md/MINTO.md, even though `scripts/generate-section-intelligence.cjs:258-259`
  already blanket-skips every dot-directory and was never going to fill
  them. 4.2 ("still missing after generation") was the same asymmetry, not
  a second bug.
- Fix: added `if (entry.name.startsWith('.')) continue;` immediately after
  the existing directory-type check, before the `SKIP_DIRS` check.
  `SKIP_DIRS` stays in place for its non-dot entries.
- Commit: this quick task's Task C commit (see git log around this file's
  commit date; `lib/core/doctor/room-md-module.cjs`)

### Finding 4.3 -- MINTO missing-field violations bucketed as "unexpected"

- Status: FIXED
- Root cause: `addViolation()` in `lib/core/feynman-minto-invariants.cjs`
  builds `{category, severity, message, field}` and never a `type`.
  `summarizeViolations` (internal to
  `scripts/frontmatter-schema-validator.cjs`, which has no `module.exports`)
  bucketed every violation without a `type` as "unexpected", including
  genuinely missing `schema_version` / `governing_thought` /
  `last_generated_at` fields.
- Fix: the MINTO delegation arm in `lib/core/frontmatter-schemas.cjs`
  (the one testable seam between the two vocabularies, via the exported
  `validate()`) now maps each violation to a copy carrying
  `type: (v.field && /^Missing\b/.test(v.message)) ? 'missing' : (v.type ||
  'invalid')`. `/^Missing\b/` catches all three missing-field messages
  (two share the "Missing or empty frontmatter field: <name>" prefix, the
  third reads "Missing last_generated_at (backfill case...)") while leaving
  the two freshness violations ("...is in the future...", "...is stale...")
  in the non-missing bucket.
- Commit: this quick task's Task C commit
  (`lib/core/frontmatter-schemas.cjs`)

### Finding 5.ii -- statusline check was blind to `$HOME`-form commands

- Status: FIXED
- Root cause: `data/deployment-surfaces.json:24` writes the statusLine
  command as `bash "$HOME/.claude/statusline-mos"` (the portable form) on
  purpose. `lib/core/doctor/statusline-visibility-module.cjs` ran its path
  regex at three sites without expanding `$HOME` first, so a `$HOME`-form
  command fell through to the stale-path / missing-target branches instead
  of resolving. Class J's `expandSurfacePath()`
  (`deployment-surfaces-module.cjs:66-81`) already normalized `$HOME` on
  both sides; class G (this module) never adopted the same normalization.
- Fix: added `expandHomeTokens()` (expands `$HOME`, `${HOME}`, and a leading
  `~/` via `os.homedir()`) and applied it at all three regex-extraction
  sites before the `.match()` call.
- Not a regression of the `intern-w1-statusline-room-mismatch` KB fix --
  that one fixed topology-blindness and which-file-to-check in this same
  module and never touched this regex.
- Commit: this quick task's Task C commit
  (`lib/core/doctor/statusline-visibility-module.cjs`)

## Findings -- OPEN (reconstructed from plan summary only; see notice above)

### Finding 2 -- derive queue only drains the open room

- Status: OPEN, out of scope for 260914-ntk
- Summary (from plan): needs a new `--drain-all` feature. No further detail
  survives the file loss; a follow-up session should re-gather evidence
  before scoping a fix.

### Finding 5b -- heal stage 1 schema errors on an old room.db

- Status: OPEN, tracked separately
- Summary (from plan): already tracked as `ROADMAP.md D-276-4`, a real
  `openGraph` migration-chain change. Consult `ROADMAP.md` for current
  status rather than this file.

### Finding 7 -- no batch heal mode

- Status: OPEN, out of scope for 260914-ntk
- Summary (from plan): needs a new batch-heal feature. No further detail
  survives the file loss.

### Finding 5.i -- working-as-designed / backlog

- Status: OPEN (backlog), no code change planned
- Summary (from plan): named as working-as-designed at planning time. No
  further detail survives the file loss.

### Finding 6 -- working-as-designed / backlog

- Status: OPEN (backlog), no code change planned
- Summary (from plan): named as working-as-designed at planning time. No
  further detail survives the file loss.

## Current Focus

hypothesis: n/a -- 8 of 13 findings closed by quick task 260914-ntk; the
remaining 5 are backlog/tracked-elsewhere items, not an active
investigation.
test: n/a
expecting: n/a
next_action: findings 1a, 1b, 3, 4.1, 4.2, 4.3, 5.ii and 5c were fixed by
quick task 260914-ntk (commits 556c4780, 7938e428, and this quick task's
Task C commit). Findings 2, 5b, 7, 5.i and 6 remain open for the reasons
stated in their own sections above; 5b specifically routes through
ROADMAP.md D-276-4, not this file. A separate debug session should open for
the cross-session working-directory collision noted in the Reconstruction
Notice above.

## Non-Code Follow-ups

- CHANGELOG.md: Fixed entry added under `## [Unreleased] -- v2.0.0-beta.38`
  by this quick task's Task C commit.
- This file is NOT moved to `.planning/debug/resolved/` -- open findings
  (2, 5b, 7, 5.i, 6) remain.
- No `knowledge-base.md` block added yet, for the same reason.
- Recommended follow-up: open a dedicated debug session on the cross-session
  working-directory collision described in the Reconstruction Notice.
