---
status: gathering            # gathering | investigating | fixing | resolved
kind: rca                    # rca | debug-session | qa-sweep
trigger: "html-artifacts-invisible-to-graph-derivation"
issue_id: ""
severity: medium             # blocker | high | medium | low
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [7, 9]
created: 2026-09-04T14:07:46Z
updated: 2026-09-04T14:07:46Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `main` HEAD @ `781dd341` (this repo, `/home/jsagi/dev/MindrianOS-Plugin`), the commit immediately after quick task 260904-ng7's Task 2 landed.
- **WIRE claims probe against:** not applicable. Every claim below is a local `node -e` probe against this working tree's `node_modules/` and `package.json`, not a deployed server.
- **Date of audit:** 2026-09-04
- **Re-verification rule:** any source-code claim filed below MUST be re-verified against `origin/main` HEAD before it lands as a finding; otherwise the finding is provisional and tagged `needs-source-reverify`.

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: `lib/core/doc-text-extractor.cjs`'s `extractHtmlText` requires `cheerio`, which is not installed in this repo (absent from both `package.json` dependencies and `node_modules/`), so it throws `CHEERIO_UNAVAILABLE` for every `.html` file. Three graph-adjacent callers route `.html` reads through it and each one catches that throw and silently returns `''`, so `.html` room artifacts contribute NO text to graph derivation, candidate production, or LazyGraph indexing.
test: `node -e "require('./lib/core/doc-text-extractor.cjs').extractDocText('/tmp/x.html')"` against this working tree.
expecting: the call throws `CHEERIO_UNAVAILABLE cheerio unavailable: Cannot find module 'cheerio'` for a real `.html` path (or any path, since the module load happens before the file read).
next_action: this quick task (260904-ng7) deliberately does NOT fix it. The next action is a future session choosing between the two candidate fixes named below and re-running `/gsd:debug html-artifacts-invisible-to-graph-derivation` to move status to `investigating` then `fixing`.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: check `.claude-plugin/plugin.json` at time of resume; not pinned here since this defect is dependency-installation state, not a version-specific regression.
- Reported by: quick task 260904-ng7 (fix room_search's HTML blindness), filed as a deliberately out-of-scope adjacent defect surfaced during that investigation.
- Date first observed: 2026-09-04
- Related debug sessions: none. This is the sibling defect to the room_search fix in the same quick task; that fix took a different approach (a dependency-free strip pass inside `lib/mcp/tools/room.cjs`) specifically because this defect makes the shared extractor unsafe to reuse today.

## Problem Statement

`lib/core/doc-text-extractor.cjs`'s `.html` extraction leg depends on the `cheerio` npm package, which this repo does not have installed; every `.html` room artifact therefore contributes zero text to graph derivation (`graph-backfill.cjs`), candidate production (`graph-candidate-producer.cjs`), and LazyGraph indexing (`lazygraph-ops.cjs`), and the failure is silent (each caller catches the throw and returns `''`) rather than surfaced.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: an `.html` room artifact (a brief, rubric, or deck -- these are in the repo's own canonical `ARTIFACT_EXT` list, `lib/core/graph-backfill.cjs:68`) contributes its rendered text to graph derivation, candidate production, and LazyGraph, the same as an `.md` or `.docx` artifact does.
actual: `extractDocText()` returns `''` for every `.html` file in this repo, with no error surfaced to the caller or the user. The three callers each swallow the underlying throw in a `try { ... } catch (_e) { return ''; }` block.
errors: verbatim probe output (see Evidence) is `Error: cheerio unavailable: Cannot find module 'cheerio'`, `code: 'CHEERIO_UNAVAILABLE'`. This error never reaches a user or log line in the three caller sites; it is caught and discarded.
reproduction:
  1. From `/home/jsagi/dev/MindrianOS-Plugin`, run `node -e "require('./lib/core/doc-text-extractor.cjs').extractDocText('/tmp/x.html')"` (the file need not even exist with real content -- the `require('cheerio')` inside `extractHtmlText` throws before the file is read).
  2. Observe the thrown `CHEERIO_UNAVAILABLE` error at the top level (this direct call is not wrapped, so it propagates and crashes the one-liner).
  3. Contrast with calling `_readArtifactText`/`_resolveArtifactText`/`_readArtifactContent` (the three graph-side wrappers) on the same `.html` path: each returns `''` with no error, because each independently wraps the `extractDocText` call in its own try/catch.
started: unknown exact commit. `doc-text-extractor.cjs`'s header comment (line 3) claims cheerio is "the already-listed HTML-parse dep", which is false as of this audit; either cheerio was removed from `package.json` after this module was written, or it was never actually added despite the comment. Not resolved further here (out of scope for this filing); a future session can `git log -p -- package.json` for `cheerio` to date the drift precisely.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork -- all three, since `doc-text-extractor.cjs` is shared `lib/core/*.cjs`, not a surface-specific module (Tri-Polar: no surface is exempt, none needed its own fix, none has its own bug either).
- Affected commands: nothing in `commands/` calls this directly; the impact is indirect, through whichever pipelines invoke `graph-backfill.cjs`'s backfill pass, `graph-candidate-producer.cjs`'s candidate mining, or `lazygraph-ops.cjs`'s LazyGraph indexing over a room containing `.html` artifacts.
- Affected users: every install with at least one `.html` room artifact (a brief, rubric, or deck saved as `.html`) that expects it to participate in graph derivation, candidate production, or LazyGraph. Rooms with only `.md`/`.docx` artifacts are unaffected.
- Version range: present at HEAD (`781dd341`, 2026-09-04); not bisected further, per `started` above.
- Severity: medium. Not a crash and not data loss (the artifact file itself is untouched, D-169-03's non-destructive guarantee holds), but a real, silent correctness gap: three separate graph-facing subsystems treat `.html` as contentless when it is not.
- Blast radius: `lib/core/graph-backfill.cjs:86` (`_readArtifactText`), `lib/core/graph-candidate-producer.cjs:117` (`_resolveArtifactText`), `lib/core/lazygraph-ops.cjs:508` (`_readArtifactContent`). All three call `extractDocText` from `lib/core/doc-text-extractor.cjs` and independently catch-and-empty its `CHEERIO_UNAVAILABLE` throw. No other caller of `extractDocText`/`extractHtmlText` was found in this audit (not exhaustively re-greped beyond these three plus `room.cjs`, which this quick task changed to NOT use this extractor for exactly this reason).

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: the `.html` text-extraction gap is a parse fault (malformed HTML), not a missing dependency.
  evidence: the probe throws before `fs.readFileSync` ever runs -- `extractHtmlText`'s `require('cheerio')` call is the very first statement in the function, so the failure is 100% dependency-availability, not content-shape. Confirmed via `ls node_modules | grep -i cheerio` (no output) and `grep -n cheerio package.json` (no output).
  timestamp: 2026-09-04T14:07:46Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-09-04T14:07:46Z
  checked: live probe, `node -e "require('./lib/core/doc-text-extractor.cjs').extractDocText('/tmp/x.html')"` from `/home/jsagi/dev/MindrianOS-Plugin`.
  found: `Error: cheerio unavailable: Cannot find module 'cheerio'` thrown at `lib/core/doc-text-extractor.cjs:97-98` inside `extractHtmlText`, with `err.code === 'CHEERIO_UNAVAILABLE'`, propagated (not caught) by `extractDocText` itself (the `if (err && err.code === 'CHEERIO_UNAVAILABLE') throw err;` re-throw at `lib/core/doc-text-extractor.cjs:119`).
  implication: `extractDocText` is deliberately designed to let a missing-dependency signal propagate (the code comment at line 3-4 and the re-throw at line 119 both say so explicitly) rather than silently degrade to `''` the way a parse fault does. The three callers audited below do NOT honor that distinction -- they catch everything, including `CHEERIO_UNAVAILABLE`, and return `''` regardless.
- timestamp: 2026-09-04T14:07:46Z
  checked: `ls node_modules | grep -i cheerio` and `grep -n cheerio package.json` from the repo root.
  found: both commands return no output. `cheerio` is present in neither `package.json` (dependencies or devDependencies) nor `node_modules/`.
  implication: this is not a "run `npm install`" gap in a checked-out tree -- there is no dependency declaration to install from. Adding cheerio would be a genuine new dependency, with its own vendoring and release-lockstep consequences (Non-Code Follow-ups below), not a missing-lockfile-entry fix.
- timestamp: 2026-09-04T14:07:46Z
  checked: `lib/core/doc-text-extractor.cjs` lines 1-4 (module header comment).
  found: `"...cheerio (the already-listed HTML-parse dep) for .html. ZERO new dependency."`
  implication: this comment is factually false in this repo as of this audit. Whoever writes the fix for this RCA should also correct or remove this comment as part of the change, since it actively misleads a future reader into believing cheerio is safe to assume present.
- timestamp: 2026-09-04T14:07:46Z
  checked: the three graph-side callers of `extractDocText`, each independently.
  found:
    - `lib/core/graph-backfill.cjs:86-92`, function `_readArtifactText`: `try { return extractDocText(absPath) || ''; } catch (_e) { return ''; }`.
    - `lib/core/graph-candidate-producer.cjs:117-123`, function `_resolveArtifactText`: `try { return extractDocText(p) || ''; } catch (_e) { return ''; }`.
    - `lib/core/lazygraph-ops.cjs:508-514`, function `_readArtifactContent`: `try { return extractDocText(filePath) || ''; } catch (_e) { return ''; }`.
  implication: all three wrap the call in a bare `try/catch` that returns `''` on ANY error, not just a genuine parse fault. This means today, for every one of these three subsystems, an `.html` room artifact is functionally indistinguishable from an empty file: it mints a node/candidate/index entry with empty content (each site's own comment says this is "exit-safe" for a parse fault), but the emptiness here is caused by a missing dependency, not a bad file, and nothing signals that difference to the caller, a log, or the user.

## Technical Root Cause

`cheerio` is not installed in this repo (absent from `package.json` and `node_modules/`), so `lib/core/doc-text-extractor.cjs:90-99`'s `extractHtmlText` throws `CHEERIO_UNAVAILABLE` for every `.html` file, and three independent graph-side callers (`graph-backfill.cjs`, `graph-candidate-producer.cjs`, `lazygraph-ops.cjs`) each catch that throw indiscriminately and return `''`, so `.html` room artifacts silently contribute no text anywhere graph derivation, candidate production, or LazyGraph indexing reads artifact content.

- Site: `lib/core/doc-text-extractor.cjs:90-99`, function `extractHtmlText`
- Cause: unconditional `require('cheerio')` with no installed dependency to satisfy it; the module's own header comment (line 3-4) incorrectly asserts cheerio is already a listed dependency.
- Why it surfaces now: not new. This has been true since whatever commit removed (or never added) `cheerio` from `package.json`; quick task 260904-ng7's Task 1 investigation is what surfaced it as a live, verified fact, because it needed to answer "can room_search reuse this extractor for its own .html fix" and the honest answer was no.

## Scope and Impact

(see above; not duplicated per template's single-purpose field guidance -- Scope and Impact is filled once, above the Eliminated/Evidence sections, per this repo's other filed RCAs.)

## Required Code Changes
<!-- Explicit, imperative, one block per change -->

Two candidate fixes are named below WITHOUT choosing between them. That decision belongs to a future session (a dependency addition and a shared-core behavior change both carry consequences broader than this quick task's scope).

- Candidate fix A: add and vendor `cheerio`.
  - Location: `package.json` (add `cheerio` to `dependencies`), plus whatever vendoring/lockfile step this repo uses for new dependencies.
  - Current behavior: `cheerio` is required at call time and is absent, so every `.html` extraction throws.
  - Required behavior: `cheerio` resolves normally; `extractHtmlText` runs its real parse path (`$('body').text()` with the `$.root().text()` fallback already coded).
  - Short-term patch: none needed if this path is chosen; installing the dependency IS the fix.
  - Long-term fix: same as short-term. Also correct the header comment at `lib/core/doc-text-extractor.cjs:3-4` (it currently claims this is already true) once it genuinely is.
  - Consequences to weigh: a new runtime dependency has its own vendoring, bundle-size, and release-lockstep implications (`.claude/includes/release-process.md`'s five-gate lockstep does not currently account for a `node_modules` dependency add; check whether this plugin ships `node_modules` or requires a fresh `npm install` at install time before choosing this path).
- Candidate fix B: give the extractor a dependency-free fallback, the same shape as the one quick task 260904-ng7 added to `lib/mcp/tools/room.cjs` (`htmlLinesToText`, `_internal.htmlLinesToText`).
  - Location: `lib/core/doc-text-extractor.cjs`'s `extractHtmlText` (currently lines 90-99).
  - Current behavior: throws `CHEERIO_UNAVAILABLE` when cheerio cannot be required, with no fallback.
  - Required behavior: on `CHEERIO_UNAVAILABLE`, fall back to a dependency-free strip pass (tag-to-space, script/style/comment blanking, minimal entity decode) instead of throwing, OR keep the throw but have this fallback live at the `extractDocText` call site so `CHEERIO_UNAVAILABLE` is still distinguishable from a genuine parse fault for callers that care.
  - Short-term patch: reuse `lib/mcp/tools/room.cjs`'s `_internal.htmlLinesToText` logic (or extract it to a shared module both `room.cjs` and `doc-text-extractor.cjs` import) rather than writing a second copy -- Canon Part 7, reuse before build.
  - Long-term fix: decide whether `doc-text-extractor.cjs` should keep cheerio as an optional enhancement (real DOM-aware extraction when present, regex fallback when absent) or drop the cheerio path entirely in favor of the dependency-free approach everywhere. That is a shared-core design decision, not a drive-by edit here.
  - Consequences to weigh: `graph-backfill.cjs`, `graph-candidate-producer.cjs`, and `lazygraph-ops.cjs` all currently treat ANY thrown error from `extractDocText` as "return ''" -- if fix B is chosen, those three catch blocks should also be revisited so a genuine parse fault (still expected to degrade to `''`) is not conflated with what will then be a resolved, no-longer-throwing dependency path.

## Tests to Add or Update

- Test 1:
  - Type: unit
  - Location: a new or existing test under `tests/` that exercises `lib/core/doc-text-extractor.cjs` directly (none was found covering `.html` extraction specifically during this audit; confirm before creating a duplicate).
  - Given: `cheerio` is not installed (today's actual state) or fix A/B has landed.
  - When: `extractDocText()` is called on a real `.html` fixture file.
  - Then: today, asserts the documented throw (`CHEERIO_UNAVAILABLE`) propagates from `extractDocText` itself, pinning the current (broken) contract so a future accidental "silently swallow it inside extractDocText too" change is caught. After a fix lands, this test flips to asserting real extracted text instead.
  - Runner registration: whichever `tests/run-all-<phase>.sh` the fixing session's phase uses; not registered here since no fix has landed yet.
- Test 2:
  - Type: unit
  - Location: `tests/` -- one test per affected caller (`graph-backfill.cjs`, `graph-candidate-producer.cjs`, `lazygraph-ops.cjs`).
  - Given: a room/artifact containing an `.html` file with known body text.
  - When: the caller's artifact-text-reading function runs.
  - Then: today, asserts it returns `''` (pinning the current silent-degrade behavior as a KNOWN, not accidentally-fixed, fact). After a fix lands, asserts the real extracted text is returned instead.
  - Runner registration: same as Test 1.

## Non-Code Follow-ups
<!-- The release and canon obligations a code fix alone does not satisfy -->

- CHANGELOG.md: add a Fixed entry under the target version once either candidate fix ships; this filing itself changes no shipped behavior, so no CHANGELOG entry is needed yet.
- Release lockstep: if Candidate Fix A (adding cheerio) is chosen, confirm whether this plugin vendors `node_modules` into the marketplace-distributed artifact or expects the install step to run `npm install` -- this changes what the 5-place version lockstep (`.claude/includes/release-process.md`) needs to additionally verify (a new runtime dependency actually present in the shipped bundle).
- Canon: this defect touches Canon Part 7 (Reuse Before Build -- the header comment's false claim is exactly the kind of stale assumption Part 7 asks a session to catch before reusing existing code) and Canon Part 9 (Memory Locality -- graph derivation silently treating real content as empty is a data-quality gap in what becomes graph data). No `docs/CANON-PHASE-MAP.md` entry needed until a fix phase is planned and declares its own `canon_parts`.
- knowledge-base.md: add the summary block only on resolve, per the template.
- Docs / monitoring / process notes: whoever plans the fix should decide whether `graph-backfill.cjs`, `graph-candidate-producer.cjs`, and `lazygraph-ops.cjs` should log (not just silently return `''`) when `CHEERIO_UNAVAILABLE` specifically is caught, so a future recurrence of "the dependency went missing again" is visible instead of silent, matching the standing "honest refusal everywhere" decision (`.claude/includes/decisions.md` decision 8) even though that decision is framed around the Brain, not local extraction -- the same principle (a failure should surface, not disappear) applies here.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: `cheerio` is not installed in this repo; `doc-text-extractor.cjs`'s `.html` leg depends on it unconditionally and throws `CHEERIO_UNAVAILABLE`; three graph-side callers each catch that throw indiscriminately and return `''`, making every `.html` room artifact silently contentless to graph derivation, candidate production, and LazyGraph.
fix: NOT YET DONE. Deliberately out of scope for quick task 260904-ng7, which filed this RCA instead of fixing it: this is a dependency-or-shared-core decision with release-lockstep consequences, not a drive-by edit inside a room_search-scoped fix.
verification: see Evidence section above (all commands run and their verbatim output are recorded there, not merely claimed).
files_changed: none yet. This file is the only artifact this RCA filing produces.
commits: none yet (will be recorded here once a fixing session lands a change; this file is committed on its own, `git add -f` since `.planning/` is gitignored).
