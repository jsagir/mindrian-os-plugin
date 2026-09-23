# Phase 354 Plan 12 -- Theo Integration Evidence

This file is the evidence record for THEO-01 (live certification), THEO-03
(live certification), and THEO-02 (release registry synchronization
disposition). It is appended to by each of this plan's tasks; nothing in it
is deleted or overwritten by a later task.

CTX-THEO-READONLY holds throughout: no write, deploy, dispatch or workflow
change was made to `/home/jsagi/Theo` in the production of this file.

---

## Live contract run

**Command:** `MINDRIAN_354_LIVE=1 node tests/test-354-theo-live-contract.cjs`

**Exit status:** `0` (full pass -- every one of the 9 live records asserted
`ok: true`)

**Duration:** ~11s wall clock (measured around the command)

**Environment:**
- Started (UTC): `2026-09-23T13:20:06Z`
- Node version: `v22.23.1`
- Repo HEAD at run time: `91e5397c2`
- Origin (default `lib/core/brain-client.cjs` URL, no override):
  `https://theo-mcp.onrender.com`
- Auth: `MINDRIAN_BRAIN_KEY` already resolved in this session's environment
  (no auto-registration attempt was needed; `ensureAvailable()` returned
  `true` on the first, synchronous `isAvailable()` check)
- Provider build/version: **not exposed** -- `brain_stats()` (the one
  read-only call `lib/core/brain-client.cjs` already wraps) returns
  `{ nodes, relationships, labels[], diagnostics }` and carries no
  `version`/`build`/`schema_version`/`graphrag_version` field of any kind on
  the live origin. Honestly recorded as `not exposed`, not fabricated.

**This run DID reach the live integration.** THEO-01 and THEO-03's live
certification clause is satisfied by this run, not merely by the hermetic
`tests/test-354-theo-journey.cjs` suite (Task 1) -- per the plan's own
truth: "a mock-only pass cannot certify the live integration."

### JSON records (9 total: 4 `recommend_chain` + 4 `taxonomy_ladder` + 1 `brain_ask`)

Argument values sent were, in every one of the 9 calls, one of: a closed
Theo rung enum (`UnDefined`/`IllDefined`/`WellDefined`/`Wicked`), the bare
integer `4`, or the single literal generic question string named in the
plan ("Which framework fits an ill-defined problem at the discovery
stage?"). No room path, no room content, no fs.readFileSync of any kind
crossed into any argument (confirmed: `grep -cE "fs\.readFileSync\("
tests/test-354-theo-live-contract.cjs` prints `0`).

```json
{"probe":"theo-live-contract-354-12","origin":"https://theo-mcp.onrender.com","node_version":"v22.23.1","provider_build":"not exposed","stats_digest":{"top_level_keys":["nodes","relationships","labels","diagnostics"],"array_lengths":{"labels":15}},"record_count":9,"all_ok":true}
{"tool":"recommend_chain","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:06.817Z","duration_ms":2060,"argument_keys":["problem_type","max_steps"],"argument_values":{"problem_type":"UnDefined","max_steps":4},"digest":{"top_level_keys":["problem_type","chain","evidence","coverage","diagnostics"],"array_lengths":{"chain":4}},"first_framework_name":"Red Teaming","threw":null,"ok":true}
{"tool":"recommend_chain","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:08.878Z","duration_ms":837,"argument_keys":["problem_type","max_steps"],"argument_values":{"problem_type":"IllDefined","max_steps":4},"digest":{"top_level_keys":["problem_type","chain","evidence","coverage","diagnostics"],"array_lengths":{"chain":4}},"first_framework_name":"Design Thinking","threw":null,"ok":true}
{"tool":"recommend_chain","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:09.715Z","duration_ms":1599,"argument_keys":["problem_type","max_steps"],"argument_values":{"problem_type":"WellDefined","max_steps":4},"digest":{"top_level_keys":["problem_type","chain","evidence","coverage","diagnostics"],"array_lengths":{"chain":4}},"first_framework_name":"Red Teaming","threw":null,"ok":true}
{"tool":"recommend_chain","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:11.314Z","duration_ms":849,"argument_keys":["problem_type","max_steps"],"argument_values":{"problem_type":"Wicked","max_steps":4},"digest":{"top_level_keys":["problem_type","chain","evidence","coverage","diagnostics"],"array_lengths":{"chain":4}},"first_framework_name":"Six Thinking Hats","threw":null,"ok":true}
{"tool":"taxonomy_ladder","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:12.163Z","duration_ms":268,"argument_keys":["rung"],"argument_values":{"rung":"UnDefined"},"digest":{"top_level_keys":["rung","question_label","rungs","ladder"],"array_lengths":{"rungs":4}},"marked_rung":"UnDefined","threw":null,"ok":true}
{"tool":"taxonomy_ladder","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:12.431Z","duration_ms":245,"argument_keys":["rung"],"argument_values":{"rung":"IllDefined"},"digest":{"top_level_keys":["rung","question_label","rungs","ladder"],"array_lengths":{"rungs":4}},"marked_rung":"IllDefined","threw":null,"ok":true}
{"tool":"taxonomy_ladder","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:12.676Z","duration_ms":219,"argument_keys":["rung"],"argument_values":{"rung":"WellDefined"},"digest":{"top_level_keys":["rung","question_label","rungs","ladder"],"array_lengths":{"rungs":4}},"marked_rung":"WellDefined","threw":null,"ok":true}
{"tool":"taxonomy_ladder","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:12.895Z","duration_ms":221,"argument_keys":["rung"],"argument_values":{"rung":"Wicked"},"digest":{"top_level_keys":["rung","question_label","rungs","ladder"],"array_lengths":{"rungs":4}},"marked_rung":"Wicked","threw":null,"ok":true}
{"tool":"brain_ask","origin":"https://theo-mcp.onrender.com","timestamp":"2026-09-23T13:20:13.116Z","duration_ms":3130,"argument_keys":["question","problem_type"],"argument_values":{"question":"Which framework fits an ill-defined problem at the discovery stage?","problem_type":"IllDefined"},"digest":{"top_level_keys":["answer_mode","rows","search_mode","effective_top_k","diagnostics","directive","next_gate","grounding"],"array_lengths":{"rows":8}},"first_framework_name":"Red Teaming","grounding_problem_type":"IllDefined","grounding_rung_source":"structured","threw":null,"ok":true}
```

### What each assertion proved, live

- **`recommend_chain` x4** (one per rung): every call returned an array
  `chain` (never a thrown exception, never an unhandled malformed shape).
  Each chain carried 4 ranked framework steps with a real framework name in
  first position (`Red Teaming`, `Design Thinking`, `Red Teaming`,
  `Six Thinking Hats` respectively -- genuinely different top candidates per
  rung, proof the origin is actually differentiating on the rung argument,
  not returning a static payload).
- **`taxonomy_ladder` x4** (one per Theo rung id): every call returned the
  real live shape (`{ rung, question_label, rungs: [{id, gloss, marked}],
  ladder }`) with `rungs` always length 4, and in every case EXACTLY one
  entry had `marked: true` and its `id` equaled the requested rung -- the
  taxonomy-casing fix (354-10) is proven live, not only against the local
  read-only `vocabulary.ts` checkout copy that plan's own regression used.
- **`brain_ask`** with `{ problem_type: 'IllDefined' }`: the composed
  envelope's `grounding.problem_type` read `'IllDefined'` and
  `grounding.rung_source` read `'structured'` -- proof the classification
  round-trip fix (354-09) carries the caller's already-known classification
  onto the live wire and through Theo's real composition, rather than
  falling back to `_inferRungFromQuestion`'s text heuristic (which would
  read `rung_source: 'inferred'`).

**THEO-01 and THEO-03 live certification: CLOSED by this run** (in addition
to the hermetic four-case proof in `tests/test-354-theo-journey.cjs`, Task
1). Both the classification round trip and the taxonomy-ladder casing fix
are now proven against the real, running production origin, not only
against a capture-server double or a local schema-file copy.

---

## THEO-02 release registry synchronization

**Phase 351 checked fresh at execution time (not assumed from the 354-CONTEXT.md
planning-time snapshot).** `.planning/ROADMAP.md`'s Phase 351 card still reads
`**Goal:** [To be planned]`, `**Plans:** 0 plans`, `- [ ] TBD (run /gsd-plan-phase
351 to break down)`, `**Depends on:** Phase 349 (closed 2026-09-16); owned by the
Theo repo, not this one`. Unchanged from the state 354-CONTEXT.md recorded at
planning time -- Phase 351 is still registered and still unplanned.

### Six commands run, with exit status and duration

| # | Command | Exit | Duration |
|---|---------|------|----------|
| 1 | `bash tests/run-all-349.sh` | `0` | 213s (PASS=14 FAIL=0 SKIP=0) |
| 2 | `node tests/test-343-theo-stamp-gate.cjs` | `0` | <1s (7/7 checks passed) |
| 3 | `bash scripts/release.sh patch --dry-run 2>&1 \| grep -i theo-stamp` | `0` | 3s (dry run only; confirmed non-mutating by this phase's own `tests/test-349-dry-run-never-sends.cjs`, which shells the real script in `--dry-run` mode and proves it exits before any mutation) |
| 4 | `git -C /home/jsagi/Theo log -1 --format='%h %ad'` | `0` | instant |
| 5 | `ls /home/jsagi/Theo/.github/workflows/` | `0` | instant |
| 6 | `grep -rl "theo-resync" /home/jsagi/Theo/.github /home/jsagi/Theo/scripts 2>/dev/null` | `1` (zero hits) | instant |

Bonus (gh CLI authenticated as `jsagir`, so run per the plan's conditional
clause): `gh api repos/jsagir/theo/actions/workflows --jq '.workflows[].path'`
returned exactly the same three paths as command 5's local `ls`:
`.github/workflows/ci.yml`, `.github/workflows/theo-liveness.yml`,
`.github/workflows/theo-seam-audit.yml`. The local checkout and the GitHub
API agree; no fourth (theo-resync) workflow exists on either surface.

### What the plugin side proves

- `run-all-349.sh` (14 checks: release-shape-gate regression x5, doctor
  acceptance self-coverage x6, connector-registry-fresh, em-dash guard) is
  green: the dispatch payload's shape gate, the doctor's own self-coverage
  around the stamp gate, and the release script's sentinel integrity all
  hold on the plugin side.
- `test-343-theo-stamp-gate.cjs` (7 arms) is green: a matching stamp passes,
  a mismatching stamp fails closed with a named recovery command, a failing
  reader is a distinguishable READ FAILURE (never silently read as a
  mismatch), `DRY_RUN=1` previews without mutating, `--no-theo-check` is an
  audited (visible) opt-out, and the reader is robust to a quoted/spaced
  plugin dir and a missing `timeout` binary.
- The live `--dry-run` preview (command 3) is itself fresh plugin-side
  evidence the drift is CURRENT, not historical: **"theo-stamp-gate: MISMATCH
  -- Theo's stamp is `command-registry@2.0.0-beta.42`, expected
  `command-registry@2.0.0-beta.48`. A real release would ABORT here."** Six
  betas of drift now (worse than the five betas measured at Phase 349's own
  2026-09-16 baseline in `docs/THEO-NOTIFY-CONTRACT.md`), because nothing on
  Theo's side has ever consumed a `repository_dispatch` and re-emitted.

### What the plugin side does NOT prove

- Whether Theo's side ever RECEIVES a `repository_dispatch: theo-resync`
  event (this repo can only prove it SENDS one -- `scripts/release.sh` Step
  5.6, Phase 349 -- not that anything downstream picks it up).
- Registry-hash verification on receipt (Theo would need to compute its own
  fresh digest and compare against the received `registryHash`; nothing in
  this repo can observe that computation).
- Retry or idempotency behavior on the Theo side for a re-emit.
- The applied-stamp state Theo's `mappedBy` field would read after a real
  consumer ran (the live `--dry-run` above only reads the CURRENT, unfixed
  mismatch).

### Provider-side findings (read-only, CTX-THEO-READONLY honored)

- `git -C /home/jsagi/Theo log -1`: `98e337d`, dated `Wed Sep 23 16:26:32
  2026 +0300` -- newer than the `4ae9843` commit 354-CONTEXT.md's
  planning-time snapshot named, confirming active, ongoing work in that
  repository independent of this plan.
- `.github/workflows/` contains exactly three files: `ci.yml`,
  `theo-liveness.yml`, `theo-seam-audit.yml`. No `theo-resync` (or any
  `repository_dispatch`-consuming) workflow exists.
- `grep -rl "theo-resync" .github scripts` returned zero hits, both locally
  and confirmed independently via the GitHub API (`gh api
  repos/jsagir/theo/actions/workflows`).

### `git -C /home/jsagi/Theo status --short`, before and after -- NOT identical, and why

**Before** (captured immediately before `run-all-349.sh` started):

```
 M README.md
 M src/generated/build-stamp.ts
 M src/generated/sync-drift.ts
?? .planning/phases/15-rule-admission-for-the-eleven-labels-phase-13-s-own-admissio/
?? .planning/quick/260916-ekp-reconcile-theo-readme-md-s-stale-tool-co/
?? .planning/quick/260917-ihz-restore-framework-six-thinking-hats-orch/260917-ihz-PLAN.md
?? docs/
```

**After** (captured immediately after the read-only inspection commands, ~4
minutes later):

```
 M README.md
 M src/generated/build-stamp.ts
 M src/generated/sync-drift.ts
 M src/http/serve.ts
 M src/index.ts
 M src/mcp/health.ts
?? .planning/phases/15-rule-admission-for-the-eleven-labels-phase-13-s-own-admissio/
?? .planning/quick/260916-ekp-reconcile-theo-readme-md-s-stale-tool-co/
?? .planning/quick/260917-ihz-restore-framework-six-thinking-hats-orch/260917-ihz-PLAN.md
?? docs/
?? src/bootstrap/serving.ts
```

The two are **not** byte-identical: three additional modified files
(`src/http/serve.ts`, `src/index.ts`, `src/mcp/health.ts`) and one additional
untracked file (`src/bootstrap/serving.ts`) appear in the AFTER capture. This
plan made ZERO writes to `/home/jsagi/Theo` -- every command against that
repository in this section was `git log`, `git status`, `ls` or `grep`
(read-only by construction; none of the four can mutate a working tree).
The gap is explained by the SAME "before/after checkout was already dirty
from unrelated sessions against that separate repository" precedent
354-10-SUMMARY.md already recorded: `/home/jsagi/Theo` is a live, separately
GSD-managed repository, and the `git log -1` timestamp above (`Sep 23
16:26:32`, during this very task's ~4-minute window) confirms a concurrent
session was actively committing/editing there while this task's read-only
commands ran, not any action this plan took. Recorded honestly per the
"two-session tree collision" watch pattern (`WATCH 2026-09-14`) rather than
silently reporting a false "identical" -- CTX-THEO-READONLY (no write,
deploy, dispatch or workflow change made BY THIS PLAN) still holds; it is
the separate repository's own concurrent owner that changed it, not this
task.

### Disposition

**BLOCKED - external dependency: Phase 351 (owner jsagir/theo). Not marked
complete while the provider consumer is absent.**

The concrete Theo-side task, for Theo's own GSD workflow (Phase 351, not
this repo): a `repository_dispatch: [theo-resync]` workflow in `jsagir/theo`
that (1) re-emits the command layer for the received `version`, (2) computes
its own fresh registry digest and verifies it against the received
`registryHash` (reporting a mismatch rather than silently proceeding), and
(3) restamps `mappedBy` to `command-registry@<version>` on success -- so
that, after Theo's CI runs once against a real release, `bash
scripts/release.sh patch --dry-run 2>&1 | grep theo-stamp-gate` prints
`PASS` in this repository (the plugin-side acceptance number Phase 351's own
ROADMAP.md card already names). This plan does not duplicate Phase 351's
scope, does not implement any part of that workflow, and made no write to
`/home/jsagi/Theo`.

---
