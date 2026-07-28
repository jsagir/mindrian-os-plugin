# Phase 241: Feynman-MINTO - Research

**Researched:** 2026-07-28
**Domain:** Internal wiring/logic remediation of an existing local-only self-repair subsystem (no new external technology)
**Confidence:** HIGH (every claim below is a direct grep/read against the working tree at the RCA's cited sha and later; no speculative library research needed)

## Summary

Phase 241 is a pure internal wiring and logic fix inside a subsystem that already exists end to end: the Feynman-MINTO guardian (`scripts/feynman-minto-guardian.cjs`), its invariant checker (`lib/core/feynman-minto-invariants.cjs` + the `lib/memory/validators/*` registry), and its debounced regen queue (`scripts/minto-debouncer.cjs`). There is no new library, framework, or external service to evaluate. The research problem is entirely "where exactly does each of the four named finding shapes live in this codebase, and what change closes each one without breaking its neighbors." This document answers that with file:line evidence for all four, going beyond the filed RCA (`minto-debounce-consumer-dead-end.md`), which covers only one of the four (F-0).

**Four distinct findings map to the phase's three success criteria and two requirements as follows:**

| Finding | What's broken | Requirement | Success Criterion |
|---------|---------------|-------------|--------------------|
| F-0 | Debounce queue has enqueue producers but no working consumer; two stop-path drains discard the queue instead of acting on it (RCA main finding, already filed, Option B recommended) | Folded into MINTO-01/the phase Goal ("dead loop stops taxing commits") but not named by ID in either requirement's text | Indirectly SC1 ("repair ladder is reachable") and directly SC3 (pre-commit demotion is contingent on this loop's liveness) |
| F-1 | The guardian's on-stop invariant *report* (not the debounce queue) never reaches the user: `scripts/on-stop:460` runs the guardian under `timeout 1 ... >/dev/null 2>&1 \|\| true`, and even un-redirected, `scripts/on-stop`'s own final stdout line never folds in the guardian's systemMessage | MINTO-01 | SC1 |
| F-2 | The severity ladder downgrades a missing `MINTO.md` and a missing `governing_thought` to `error`, not `critical`, so the enqueue-on-critical gate almost never fires for the breaches navigators actually hit | MINTO-02 | SC2 |
| F-3 | Pre-commit hard-blocks (exit 2) on the same `>= error` threshold that F-2 already reaches today, tied to a repair loop that (per F-0) does not actually repair anything yet | MINTO-02 | SC3 |

**Primary recommendation:** Treat F-1, F-2, F-3 as the phase's direct-line work (their fixes are small, localized, and independently testable). Treat F-0 as in-scope per ROADMAP.md's explicit fold-in language, and implement the RCA's own recommended Option B (wire `scripts/intent-classifier.cjs` as the UserPromptSubmit consumer + stop the unconditional `olderThanMs: 0` vacuum at both stop-path drains) rather than re-litigating Option A/C — the RCA already eliminated the alternatives with cited evidence. Do not conflate F-0 (debounce queue) with F-1 (on-stop invariant report) — they are different code paths that happen to sit in the same `scripts/on-stop` file section.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| On-stop invariant scan + report write (F-1) | Backend/CLI hook script (`scripts/on-stop`, Node child process) | — | Runs headless inside the Stop hook's process-exit path; no browser, no server |
| On-stop findings reaching the user (F-1) | Frontend/hook-output surface (Stop-hook `systemMessage` JSON contract Claude Code reads) | Backend/CLI hook script | The write happens in the CLI layer; the "reaches the user" half is entirely about what `scripts/on-stop`'s FINAL stdout JSON line contains, since Claude Code only reads that one line |
| Debounce queue producer/consumer (F-0) | Backend/CLI hook scripts (`scripts/feynman-minto-guardian.cjs`, `scripts/minto-debouncer.cjs`, `scripts/intent-classifier.cjs`) | Shared core (`lib/mcp/stop-gate-handler.cjs` for non-CLI surfaces) | Pure local file-based queue (`.mindrian/minto-queue.json`); no network, no DB |
| Severity ladder / invariant validation (F-2) | Shared core (`lib/core/feynman-minto-invariants.cjs`, `lib/memory/validators/minto-invariants.cjs`) | Backend/CLI (`scripts/feynman-minto-guardian.cjs`'s own existence-check synthetic violation) | Pure logic module, imported by both the guardian CLI and (potentially) any future MCP-side invariant check |
| Pre-commit gate (F-3) | Backend/CLI (git hook: `scripts/hooks/pre-commit-room-minto-guard.sh` -> `scripts/feynman-minto-guardian.cjs pre-commit`) | — | Runs as a native git pre-commit hook; no MCP/Desktop/Cowork equivalent exists (commits happen in a CLI/dev environment) |

**Tri-Polar note (CLAUDE.md's strong default):** F-1's on-stop invariant scan is currently invoked ONLY from `scripts/on-stop` (the CLI-specific Stop path). `lib/mcp/stop-gate-handler.cjs` — the shared "mindrian-core" Stop path other surfaces use — never calls `feynman-minto-guardian.cjs on-stop` at all (confirmed by grep, see Evidence below). This means Desktop/Cowork sessions never receive a guardian invariant report today, independent of the /dev/null bug. The phase's success criterion 1 says findings must reach "the user-visible surface" without naming a surface; the planner must explicitly decide whether the fix stays CLI-only (narrowest read of SC1, fastest) or also wires `stop-gate-handler.cjs` for Desktop/Cowork parity (broader read, matches the Tri-Polar strong default, but is new scope not literally named by the RCA or the phase's evidence-gathering to date). See Open Questions.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MINTO-01 | The guardian's on-stop output reaches the user instead of `/dev/null`, and its report-write/ghost-pruning cannot be silently dropped by a 1-second timeout (F-1) | F-1 code map below: `scripts/on-stop:453-461`, `scripts/feynman-minto-guardian.cjs:335-434` (`runOnStop`), `scripts/on-stop:543-550` (final stdout contract) |
| MINTO-02 | The critical-repair severity ladder actually triggers on the breaches navigators hit (missing MINTO.md, missing governing_thought), not only two rare crash artifacts (F-2); pre-commit friction from the same dead loop is demoted to warn until the loop is live (F-3 folds in) | F-2 code map: `scripts/feynman-minto-guardian.cjs:176-184`, `lib/core/feynman-minto-invariants.cjs:388-398`, `lib/memory/validators/minto-invariants.cjs:32-36`, enqueue gate at `scripts/feynman-minto-guardian.cjs:276`. F-3 code map: `scripts/feynman-minto-guardian.cjs:455-495` (`runPreCommit`), `scripts/hooks/pre-commit-room-minto-guard.sh:220-232` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **CJS only, no TypeScript** (`lib/core/*.cjs` ships as source) — every file touched in this phase is already `.cjs`; stay in that idiom.
- **No em-dashes anywhere** in any prose this phase produces (comments, docs, commit messages) — use hyphens.
- **Three-surface rule (Tri-Polar, STRONG DEFAULT)**: evaluate CLI/Desktop/Cowork for every change; a surface skip must be a stated, deliberate call, not an oversight. Directly relevant here since F-1's fix as currently scoped is CLI-only (see Architectural Responsibility Map above).
- **Part 8 (Brain boundary)**: not implicated. Every file in scope (`scripts/on-stop`, `feynman-minto-guardian.cjs`, `minto-debouncer.cjs`, `intent-classifier.cjs`, the invariants modules) is LOCAL-only; none of the four findings touch a Brain call. No new egress risk from this phase's changes.
- **Part 11 (CIRS / Invocation Constitution)**: Phase 235 (CIRS Commit Gate + Seam-Liveness Helper) is scheduled in the same Wave (per `.planning/HANDOFF-2026-07-28-v1.16.0-max-parallel-execution.md`, both 235 and 241 are "TRUE WAVE 1," plannable and executable concurrently with zero hard blockers between them) and explicitly touches `scripts/hooks/pre-commit-room-minto-guard.sh`'s installation path (235-01-PLAN.md: "consolidate the pre-commit hook to one canonical source"). Phase 241's F-3 fix also edits pre-commit-guard behavior. See Open Questions for the concurrency/merge-order risk this creates.
- **Reuse before build (Part 7)**: the repo already has a proven "advisory-default, `--strict` opt-in" idiom for exactly this kind of demotion (`scripts/check-shape-declaration.cjs`, Phase 210). F-3's fix should reuse this idiom rather than inventing a new flag shape. See Architecture Patterns.
- **GSD Workflow Enforcement**: this phase's execution must run through `/gsd-execute-phase`, not direct edits.
- **QA/RCA standard**: any NEW finding this research surfaces that isn't already an RCA (F-1's exact code path was not previously documented anywhere) may warrant its own `.planning/debug/<slug>.md` filing per `docs/RCA-TEMPLATE.md` if the planner wants a permanent record separate from this RESEARCH.md — optional, not required to execute the fix.
- **Dev-Research Compositing**: this phase touches MindrianOS's own architecture (not user-facing feature work), so findings from this research composite into the `rethinking-mindrianos` room per CLAUDE.md's standing rule. This is an execution-time (not research-time) obligation; noted here so the planner carries it into the plan's non-code follow-ups.
- **langtalks-graph-expert consult (MANDATORY per Cross-Cutting Research Rule, ROADMAP.md)**: already performed by the orchestrator prior to this research pass. See Sources / grounding note below — result was an honest "not in corpus yet" for every mechanism-specific term (self-repair, self-correction, critic model, dead letter queue, background job queue, async worker, Minto pyramid, Feynman technique); "reflection" and "guardrails" exist as loosely-connected entities but only via a shared episode co-mention, not a genuine documented architectural relationship. This finding is carried forward as-is (see Sources), not re-attempted in this pass — do not fabricate a langtalks citation for this phase.

## Standard Stack

Not applicable in the conventional sense — this phase installs zero new packages and touches zero external services. All work is inside four existing `.cjs`/bash files using Node.js built-ins already in use repo-wide (`node:fs`, `node:path`, `node:child_process`). No `npm install` step, no version to pin, no Context7 lookup for a third-party library.

**Node.js built-in behaviors relevant to the fix (verified against training knowledge of the Node.js/POSIX `timeout(1)` contract, not Context7, since this is shell/coreutils behavior, not a Node API):**
- `[ASSUMED]` GNU coreutils `timeout N CMD`, on hitting the deadline, sends `SIGTERM` to the child by default (not `SIGKILL`), and coreutils' `timeout` exits with status 124 when it had to kill the command. `scripts/on-stop:460`'s `|| true` swallows that 124 unconditionally, so today nothing distinguishes "guardian finished within 1s" from "guardian was killed at 1s." A SIGTERM mid-`writeJsonAtomic` (`scripts/feynman-minto-guardian.cjs:236-248`) is safe for the FILE that was being written (the temp-file-then-rename pattern means a killed write never corrupts the target — the rename either happened or didn't), but it does mean the invariant-report and any pending ghost-prune from that run are simply never produced, silently. This is standard POSIX signal behavior, not something to verify via Context7; flagged `[ASSUMED]` only because it wasn't executed live in this research pass to confirm the exact 124 exit code on this machine's `timeout` binary — low risk, the behavior is well-established coreutils semantics.

## Package Legitimacy Audit

Not applicable. Zero external packages are installed, updated, or newly required by this phase. All four findings are fixed by rearranging/extending calls between files already in the repository (`scripts/on-stop`, `scripts/feynman-minto-guardian.cjs`, `scripts/minto-debouncer.cjs`, `scripts/intent-classifier.cjs`, `lib/core/feynman-minto-invariants.cjs`, `lib/memory/validators/minto-invariants.cjs`, `scripts/hooks/pre-commit-room-minto-guard.sh`).

## Architecture Patterns

### System Architecture Diagram (current, broken state)

```
SESSION LIFECYCLE (CLI surface)
================================

session-start hook
  -> scripts/feynman-minto-guardian.cjs session-start <room>
       -> walkSections() -> validateSection() per section
       -> if severity === 'critical': enqueueRegenSafe()
            -> scripts/minto-debouncer.cjs enqueue()
               -> writes .mindrian/minto-queue.json (PRODUCER 1)
  (post-write hook, separately, also enqueues -- PRODUCER 2,
   proven by lib/memory/post-write-triple.test.cjs:249-250)

   ... session runs ...
   [F-0 GAP: scripts/intent-classifier.cjs, the UserPromptSubmit hook that
    fires on every turn, NEVER references minto-debouncer.cjs at all.
    Nothing drains-and-ACTS mid-session.]

Stop hook fires
  -> scripts/on-stop (CLI-specific Stop path)
       -> line 345: minto-debouncer.cjs drain(olderThanMs:0)  [DISCARD A -- F-0]
            return value never inspected; queue emptied unconditionally
       -> lines 364-443: Phase 88-06 snapshot (session-snapshot.json,
          minto-stale.json) -- unrelated to F-1, working correctly
       -> line 460: [F-1 GAP]
            timeout 1 node feynman-minto-guardian.cjs on-stop <room> \
              >/dev/null 2>&1 || true
            -- runOnStop() walks sections again, writes
               .mindrian/invariant-report.json, prunes stale ghosts,
               and emits {systemMessage: msg} to ITS OWN stdout when
               worst severity >= error -- but:
                 (a) stdout+stderr redirected to /dev/null: the
                     systemMessage JSON never leaves this process
                 (b) `timeout 1`: if the section walk + writes exceed
                     1000ms, SIGTERM kills the process before the
                     report write / ghost prune / systemMessage ever
                     execute (they run in that program order, AFTER
                     the section loop)
                 (c) `|| true`: exit code 124 (timed out) is swallowed,
                     so nothing downstream even knows a kill happened
       -> lines 543-550: THE ACTUAL STOP-HOOK OUTPUT.
            ONE JSON line built from STOP_SUMMARY_LINE (section count +
            health glyph, sourced from session-snapshot.json) or
            VOICE_SUMMARY_LINE. Guardian's on-stop findings are NEVER
            folded in here even if (a) above were fixed -- this is a
            SECOND, independent reason findings don't reach the user.

  -> lib/mcp/stop-gate-handler.cjs (shared "mindrian-core" Stop path,
     used by Desktop/Cowork and any non-CLI-hook consumer)
       -> _closeOutMintoDrain(): minto-debouncer.cjs drain(olderThanMs:0)
            [DISCARD B -- F-0, same shape as scripts/on-stop:345]
       -> NEVER calls feynman-minto-guardian.cjs on-stop at all.
          Desktop/Cowork sessions get ZERO guardian invariant reporting,
          independent of the /dev/null bug -- it's simply not invoked.

PRE-COMMIT (git hook, all surfaces where a commit happens)
  -> scripts/hooks/pre-commit-room-minto-guard.sh
       -> feynman-minto-guardian.cjs pre-commit <room>
            -> runPreCommit(): validates only STAGED sections
               -> if worstSeverityIdx >= SEVERITY_ORDER.indexOf('error'):
                    exit 2  [F-3: this ALREADY blocks today on 'error'-
                    level violations, which is where missing MINTO.md
                    and missing governing_thought currently sit]
       -> hook script: exit code != 0 -> commit blocked  [F-3]

SEVERITY LADDER (F-2)
  scripts/feynman-minto-guardian.cjs:176-184 (validateSection):
    MINTO.md missing -> synthetic violation, severity HARDCODED 'error'
      (comment explicitly says minto-invariants validator "otherwise
      returns null for missing MINTO -- by design")

  lib/memory/validators/minto-invariants.cjs:30-37 (the registered
  wrapper validator):
    if MINTO.md missing -> return { severity: null, violations: [] }
      -- suppresses lib/core/feynman-minto-invariants.cjs's OWN
      file-not-found CRITICAL (see below) entirely for this path

  lib/core/feynman-minto-invariants.cjs:265-312 (validate(), the
  underlying content validator, called only when MINTO.md exists):
    file not found / not a file / zero bytes -> SEVERITY.CRITICAL
      (this path is dead in practice for "missing" because the
      wrapper above short-circuits before ever calling it)
    missing/empty governing_thought (line 388-398) -> SEVERITY.ERROR
      (not critical -- this one DOES run, since it only fires on an
      EXISTING MINTO.md with a missing field)

  enqueue gate, scripts/feynman-minto-guardian.cjs:276:
    if (result.severity === 'critical') enqueueRegenSafe()
    -- 'error' never reaches this gate, so neither breach enqueues,
    independent of F-0.
```

### Recommended Project Structure

No new files/directories required for F-1, F-2, or F-3 — all are edits to existing files. F-0's Option B fix touches an existing file (`scripts/intent-classifier.cjs`) plus two existing drain call sites; no new module needed either (the debouncer and its `drain()`/`enqueue()` API already exist and are unit-tested).

### Pattern 1: Advisory-default / `--strict`-opt-in demotion (precedent for F-3)

**What:** A check that used to hard-fail is demoted to WARN-and-continue by default, with a flag that restores the old hard-fail behavior. This is an established, already-shipped idiom in this exact repo (Phase 210), not a new pattern the planner needs to invent.

**When to use:** Exactly F-3's situation — a gate whose underlying repair mechanism (F-0) is not (yet, or ever) fully trustworthy, so blocking a commit on it is disproportionate friction until that trust is established.

**Example (from `scripts/check-shape-declaration.cjs`, source of the pattern already in this repo):**
```javascript
// Source: scripts/check-shape-declaration.cjs:894-916 (this repo, Phase 210)
const strict = argv.includes('--strict');
if (report.violations.length > 0) {
  if (strict) {
    // The pre-210 hard-fail contract, preserved as the --strict opt-in.
    console.error('strict mode: exiting 1 (--strict restores the pre-Phase-210 hard-fail contract)');
    process.exitCode = 1;
  } else {
    // Phase 210-02 (item 210-A): advisory default. Every violation is still
    // enumerated; only the exit-1 block is removed. Mirrors the doctor.cjs
    // WARN-not-fail pattern.
    console.error(
      'WARN: shape-declaration advisory (Phase 210): ' + report.violations.length +
        ' violation(s) detected; not blocking (run with --strict to restore hard-fail)'
    );
  }
}
```
Applying this shape to `runPreCommit()` in `scripts/feynman-minto-guardian.cjs:455-495` would mean: keep detecting and enumerating violations exactly as today, but change the `return 2` at line 492 to a WARN print (mirroring the existing `process.stderr.write('[guardian] pre-commit blocked...')` block already there, just re-worded to "not blocking") plus `return 0`, with the hard-block path gated behind an explicit opt-in (an env var like `MINTO_PRECOMMIT_STRICT=1` or a `--strict` CLI flag passed through `pre-commit-room-minto-guard.sh`) that is OFF by default. This satisfies SC3's literal text ("produces a WARN and the commit succeeds") without deleting the detection logic, and gives a documented path back to hard-fail once F-0's repair loop is trusted.

### Pattern 2: Model-mediated repair, not headless automated regen (F-0/Option B's real mechanism)

**What:** The RCA's Option B says "wire `scripts/intent-classifier.cjs` as the promised UserPromptSubmit consumer." This is NOT a background job that silently regenerates `MINTO.md` files. Per the RCA's own risk analysis (Option A's rejection): `/mos:reason` requires an active Claude session as its LLM, and a hook script cannot invoke an LLM turn headlessly. `intent-classifier.cjs` is a UserPromptSubmit hook whose entire existing contract (per its own docstring, `scripts/intent-classifier.cjs:1-27`) is: read the user's message, score it, and "write a conversational warning to stdout" that Claude Code injects as `additionalContext` into the NEXT model turn. The correct mechanism for Option B is therefore: drain items older than 30s from the queue, and if any are found, emit an additionalContext nudge (e.g., "N section(s) have a pending MINTO regen: <section names>. Consider running /mos:reason.") — leaving the actual regen to the model reading that nudge (or to a human), not to the hook itself.

**Why this matters for the plan:** This determines what "repair or escalation recorded" in SC2, and "the repair loop is live" in SC3, actually mean operationally — they mean the SIGNAL is reachable (a real consumer exists and surfaces the pending work to a model turn), not that an automated headless regen fires. Scoping F-0's fix as "make regen happen automatically" would be over-scoping relative to what the RCA itself proved is even possible (Option A was explicitly rejected for exactly this reason).

**Budget constraint to respect:** `scripts/intent-classifier.cjs` has an existing hard 200ms total budget (`BUDGET_MS = 200`, line 34) and runs on EVERY user turn. The debounce drain added to this path must stay cheap — the RCA's own risk note says the drain call itself must remain "a file read plus a timestamp filter," which `drain(roomDir, { olderThanMs: 30000 })` already is by construction (`scripts/minto-debouncer.cjs:279-320`: read file, `Date.parse` compare, write back only if something drained). Do not add anything slower (no network, no LLM call, no directory-wide re-scan) inside this call path.

### Anti-Patterns to Avoid

- **Fixing F-1 by only removing `>/dev/null`:** removing the redirect alone does NOT fix the finding. `scripts/on-stop`'s final stdout contract (lines 543-550) is a single hand-built JSON line that never reads or folds in anything the guardian's `on-stop` subprocess printed. Even with the redirect removed, the guardian's `{systemMessage: ...}` line would be printed to the PARENT script's stdout mid-script (not JSON-parsed, not the LAST line), and the actual Stop-hook contract (Claude Code reads only the process's final stdout) would still show the unrelated `STOP_SUMMARY_LINE`/`VOICE_SUMMARY_LINE` text. The fix must CAPTURE the guardian's output (or its written `.mindrian/invariant-report.json`) and fold a summary into the FINAL `SYSTEM_MESSAGE` construction at lines 532-550, or replace the guardian's own stdout emission with a return value the wrapper script consumes.
- **Fixing F-2 by deleting the `lib/memory/validators/minto-invariants.cjs` short-circuit outright:** its comment states a real design reason ("this validator is specifically about the content contract of an existing MINTO.md"). The guardian ALREADY has a purpose-built existence-check synthetic violation at `scripts/feynman-minto-guardian.cjs:176-184` for exactly the missing-file case — the fix belongs there (change `severity: 'error'` to `'critical'`), not in the content validator. Two independent "missing file" signals (one hardcoded severity in the guardian, one suppressed-to-null in the wrapper) is intentional layering, not a bug to collapse into one file.
- **Conflating F-0's fix location with F-1's:** both live inside the same `if [ -n "${ROOM_DIR}" ]...` block in `scripts/on-stop` (F-0 at line 345, F-1 at line 460), roughly 115 lines apart, and both discard output via `>/dev/null 2>&1 || true`. They are different subsystems (debounce queue vs. invariant report) with different fixes. Do not write one test or one code change that silently "fixes" only one while the success criteria imply both need independent, separately-provable gates.
- **Raising F-2's severities without checking the F-3 interaction:** today, missing MINTO.md/governing_thought are already `error`-level, which ALREADY meets `runPreCommit`'s existing `>= error` block threshold (`scripts/feynman-minto-guardian.cjs:488`). Raising them to `critical` does not change pre-commit's current blocking behavior (critical also satisfies `>= error`) — F-3's fix is therefore a genuinely separate, additional change to `runPreCommit`'s exit behavior, not something F-2's severity bump incidentally causes or fixes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Advisory-vs-strict gating for a demoted check | A new flag/env-var naming scheme invented from scratch | The `--strict` CLI-flag idiom already shipped in `scripts/check-shape-declaration.cjs` (Phase 210) | Same repo, same problem shape (demote a hard-fail to advisory, keep a documented restore path), already reviewed and shipped; reuse-before-build (Canon Part 7) |
| Draining the debounce queue at UserPromptSubmit time | A new polling/timer mechanism inside `intent-classifier.cjs` | `scripts/minto-debouncer.cjs`'s existing `drain(roomDir, { timeoutMs, olderThanMs })` API, already implements the wall-clock-bounded, lock-guarded, atomic-write-back partition this needs | The debouncer already handles the concurrency (Phase 87-02 write-lock), atomicity, and timeout-safety this consumer needs; it is a pure function call away |
| Atomic report/queue writes | Hand-rolled `fs.writeFileSync` + rename | `writeJsonAtomic()` already defined in `scripts/feynman-minto-guardian.cjs:236-248` (tmp file + fsync + rename), and the equivalent pattern in `minto-debouncer.cjs`'s `writeQueueAtomic` | Both are already crash-safe (a kill mid-write leaves the prior file intact); duplicating this logic risks a subtly different (weaker) atomicity guarantee |

**Key insight:** every piece this phase needs already exists somewhere in the codebase in a proven, tested form (debounce queue API, atomic-write helper, advisory/strict gating idiom, additionalContext injection contract). The work is entirely about CONNECTING existing pieces correctly and adjusting a handful of severity/threshold constants — not building anything new.

## Common Pitfalls

### Pitfall 1: Fixing the `/dev/null` redirect but not the 1-second `timeout`, or vice versa

**What goes wrong:** SC1 requires BOTH halves to hold: "the guardian's on-stop output reaches the user-visible surface... and an injected slow report-write... still lands on disk along with its ghost-pruning." These are two separate failure modes in the SAME line (`scripts/on-stop:460`) that must both be fixed, and SC1's own mutation-proof language ("restoring the drop turns the gate red") implies a test that can independently verify each: one test seeding a normal-speed violation and checking the systemMessage reaches the final stdout JSON; another injecting an artificially slow validator/report-write and confirming the write still lands (requires either raising or removing the 1s ceiling, or restructuring `runOnStop` so the write/prune happen BEFORE anything that could run long, or both).

**Why it happens:** the two problems are adjacent in the same shell line and easy to treat as "one bug, one fix" (just delete `>/dev/null 2>&1` and `timeout 1`).

**How to avoid:** design the fix and its test to independently prove: (a) systemMessage reaches Claude Code's actual final Stop-hook JSON output, and (b) a report-write/ghost-prune that takes LONGER than the old 1000ms budget still completes and is observable on disk afterward.

**Warning signs:** a test that only checks `.mindrian/invariant-report.json` exists after a NORMAL-speed run (doesn't prove the timeout can't still drop a SLOW one), or a test that only checks stdout is non-empty (doesn't prove the content reaches the ACTUAL final Stop-hook JSON that `scripts/on-stop` emits at lines 543-550).

### Pitfall 2: The two stop-path drain sites (F-0) are not identical and both need the same fix independently

**What goes wrong:** `scripts/on-stop:345` (bash, CLI) and `lib/mcp/stop-gate-handler.cjs:124-129` (`_closeOutMintoDrain`, shared mindrian-core path) both discard the debounce queue with `olderThanMs: 0`, but they are reached from different code and different test suites. A fix or test that only touches one leaves the other's blast radius (RCA: "the gap is not surface-specific") open.

**Why it happens:** they look like duplicated logic and a fix applied to one is easy to assume "covers" the other since they call the same underlying `minto-debouncer.cjs` module.

**How to avoid:** per the RCA's own recommendation, change BOTH call sites' `olderThanMs` (or otherwise stop the unconditional vacuum at both), and write (or extend) a test that exercises both entry points, matching the RCA's own Test 1 ("every production... call site that requires or references `scripts/minto-debouncer.cjs` is enumerated... at least one PRODUCTION site both enqueues AND later drains-and-acts").

### Pitfall 3: A census/gate that is vacuously satisfied by test-only code (this repo's own named failure shape)

**What goes wrong:** ROADMAP.md's stated rigor bar for this whole milestone explicitly warns against "a test honoring a contract... satisfy[ing] a production-wiring gate vacuously," and the RCA's own Test 1 spec calls this out by name, citing the sibling `hedge-fold-has-no-production-trigger` RCA's identical failure mode.

**Why it happens:** it's easy to write a unit test that calls `intent-classifier.cjs`'s new drain-and-nudge function directly (proving the function works) without ever proving that function is actually WIRED into `intent-classifier.cjs`'s real UserPromptSubmit entry point that runs in production.

**How to avoid:** any new/updated test for F-0's fix must include a call-site census (grep-based, excluding `tests/`/`*.test.cjs`) proving the production entry point genuinely reaches the new drain-and-act logic, matching the RCA's own Test 1 spec verbatim.

### Pitfall 4: Editing `scripts/hooks/pre-commit-room-minto-guard.sh` concurrently with Phase 235's hook consolidation

**What goes wrong:** Phase 235 (same wave, no hard dependency between 235 and 241 per `.planning/HANDOFF-2026-07-28-v1.16.0-max-parallel-execution.md`) explicitly plans to "consolidate the pre-commit hook to one canonical source (retiring the divergent setup-hooks.sh / install-pre-commit.sh authoring)." If Phase 241's F-3 fix edits `pre-commit-room-minto-guard.sh`'s exit-code handling around the same time Phase 235 restructures which file installs/owns that hook, one phase's edit can silently get overwritten or moved by the other depending on execution order.

**Why it happens:** both phases are scheduled with "nothing hard" as their dependency and are explicitly plannable/executable concurrently (per the HANDOFF doc's Wave 1 grouping), so there's no ROADMAP-level ordering constraint forcing sequential execution.

**How to avoid:** before editing `scripts/hooks/pre-commit-room-minto-guard.sh` or any of the divergent hook-authoring scripts it names, check Phase 235's actual completion/merge status (`.planning/phases/235-cirs-commit-gate-seam-liveness-helper/` for a `*-SUMMARY.md`, or `git log` for 235's commits) at plan-time and again at execute-time. If 235 has landed first, confirm the canonical hook file path is still `pre-commit-room-minto-guard.sh` before assuming the F-3 edit target is unchanged.

### Pitfall 5: Treating F-2's severity bump as risk-free for existing green tests

**What goes wrong:** `lib/memory/feynman-minto-guardian.test.cjs` (per the RCA's own Evidence, lines 155/176/596/609/623) already asserts queue-file contents after enqueue calls in various scenarios. Raising missing-MINTO.md/missing-governing_thought to `critical` changes which scenarios now ALSO enqueue (via the `session-start` gate at line 276), which could flip existing test fixtures that assumed "error-level violations never enqueue" into now-enqueuing cases, potentially breaking currently-passing assertions about queue emptiness in those fixtures.

**Why it happens:** the severity constant change is small and localized, but its DOWNSTREAM effect (the enqueue gate) is a different function entirely, easy to miss when scoping the diff.

**How to avoid:** run the full `lib/memory/feynman-minto-guardian.test.cjs` and `lib/memory/feynman-minto-invariants.test.cjs` suites after the severity change, before writing new tests, to catch any now-invalid "no enqueue expected" assertions from the old severity ladder.

## Code Examples

### F-1: current on-stop guardian invocation (the finding, verbatim)

```bash
# Source: scripts/on-stop:453-461 (this repo, current state)
# --- Phase 88-13 guardian: on-stop invariant verification + stale ghost pruning
# Runs every registered validator (minto-invariants + snapshot-integrity +
# queue-health + stale-lifecycle) AFTER the 88-06 drain + snapshot lands,
# writes .mindrian/invariant-report.json atomically, and CONSUMES
# stale-lifecycle ghost warnings to prune stale.json in-place. Timeout 1s
# so the guardian cannot eat into the 3000ms Stop-hook budget. Advisory
# (never exits non-zero). See 88-13-SUMMARY.md.
timeout 1 node "${PLUGIN_ROOT}/scripts/feynman-minto-guardian.cjs" on-stop "${ROOM_DIR}" >/dev/null 2>&1 || true
# --- end Phase 88-13 guardian on-stop ---
```

### F-1: the guardian's own on-stop output the wrapper discards

```javascript
// Source: scripts/feynman-minto-guardian.cjs:393-432 (runOnStop, tail)
// Emitted to THIS PROCESS's stdout -- discarded by the >/dev/null above,
// and never captured/folded in even when un-redirected, since
// scripts/on-stop builds its own final JSON independently (lines 543-550).
if (worstIdx >= SEVERITY_ORDER.indexOf('error')) {
  const loc = worstSection === '__room__' ? 'room' : 'section ' + worstSection;
  const msg = 'guardian: ' + worstSeverity + ' in ' + loc + ' (' + worstCategory + ', glyph low)';
  const payload = { systemMessage: msg };
  process.stdout.write(JSON.stringify(payload) + '\n');
}
```

### F-1: the actual Stop-hook contract that must fold the guardian's finding in

```bash
# Source: scripts/on-stop:543-550 (this repo, current state)
# This is the ONLY stdout Claude Code reads for the Stop hook. FINAL_SM
# today is built ONLY from STOP_SUMMARY_LINE / VOICE_SUMMARY_LINE --
# never from the guardian's on-stop invariant report.
SYSTEM_MESSAGE="$FINAL_SM" node -e "
  const msg = process.env.SYSTEM_MESSAGE || '';
  const out = {
    continue: true,
    systemMessage: msg
  };
  process.stdout.write(JSON.stringify(out) + '\n');
" 2>/dev/null || printf '{"continue": true}\n'
```

### F-2: the severity ladder's three relevant sites

```javascript
// Source: scripts/feynman-minto-guardian.cjs:169-184 (validateSection)
// The guardian's OWN synthetic existence-check -- fix target for missing MINTO.md.
if (!fs.existsSync(path.join(sectionDir, 'MINTO.md'))) {
  all.push({
    validator: 'existence-check',
    category: 'existence',
    severity: 'error',   // <-- F-2: change to 'critical'
    message: 'MINTO.md missing in section "' + section + '"',
    section: section,
  });
}
```

```javascript
// Source: lib/core/feynman-minto-invariants.cjs:388-398
// Missing/empty governing_thought -- currently ERROR, not CRITICAL.
if (
  typeof fm.governing_thought !== 'string' ||
  fm.governing_thought.length === 0
) {
  addViolation(
    violations,
    CATEGORIES.SCHEMA,
    SEVERITY.ERROR,   // <-- F-2: change to SEVERITY.CRITICAL
    'Missing or empty frontmatter field: governing_thought',
    'governing_thought'
  );
}
```

```javascript
// Source: scripts/feynman-minto-guardian.cjs:269-279 (runSessionStart)
// The enqueue gate both breaches must reach after the severity fix.
const result = validateSection(roomDir, s, validators, ctx);
let action = 'none';
if (result.severity === 'critical') {
  enqueueRegenSafe(roomDir, s, 'guardian:critical-repair');
  action = 'enqueued_regen';
}
```

### F-3: the pre-commit block to demote

```javascript
// Source: scripts/feynman-minto-guardian.cjs:455-495 (runPreCommit)
// worstSeverityIdx >= SEVERITY_ORDER.indexOf('error') already catches
// BOTH breaches today (error-level, pre-F-2-fix). This is F-3's fix
// target: change the `return 2` block to a WARN + `return 0`, gated
// behind an opt-in --strict/env flag per the Pattern 1 precedent above.
if (worstSeverityIdx >= SEVERITY_ORDER.indexOf('error')) {
  process.stderr.write('[guardian] pre-commit blocked by Feynman-MINTO violations:\n');
  for (const m of messages) process.stderr.write(m + '\n');
  process.stderr.write('[guardian] Fix violations or use --no-verify (at your own risk).\n');
  return 2;   // <-- F-3: demote to WARN + return 0 by default
}
```

### F-0: the debouncer's own API (already built, needs a real caller)

```javascript
// Source: scripts/minto-debouncer.cjs:353 (module.exports) + docstring lines 18-21
// dbnc.enqueue(roomDir, section, reason);              // idempotent within 10s
// dbnc.drain(roomDir, { timeoutMs: 5000, olderThanMs: 30000 });
// dbnc.peek(roomDir);                                   // read-only
module.exports = { enqueue, drain, peek };
```

```javascript
// Source: scripts/intent-classifier.cjs:1-27 (docstring, current contract)
// UserPromptSubmit hook. ... writes a conversational warning to stdout
// when the highest-scoring room is NOT the active room. ... Advisory
// only. Never blocks. ... Hard 200ms budget.
// F-0/Option B target: add a debouncer.drain(activeRoomDir,
// { olderThanMs: 30000 }) call inside this existing budget, and if any
// entries drain, append a one-line additionalContext nudge alongside
// (or instead of) the existing scope-mismatch warning.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A -- no prior working state to regress from | This phase restores/completes a Phase 88 design that shipped with a documented-but-unbuilt consumer (`scripts/minto-debouncer.cjs:34` names `intent-classifier.cjs` as the intended consumer since Phase 88-05) | Phase 88 (feature landed, gap present since day one per RCA: "not a regression, there is no bisect target") | Not a regression to fix, but a never-completed feature to finish |

**Deprecated/outdated:** none. Every module in scope is actively maintained and current; this is a completion/correction, not a modernization.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GNU coreutils `timeout` sends SIGTERM (not SIGKILL) by default on deadline and the resulting exit code is 124 | Standard Stack | Low -- well-established POSIX/coreutils behavior; even if the exact signal/code differs on this machine's `timeout` build, the observable defect (silent drop via `\|\| true`) is unaffected and independently confirmed by static code reading, not runtime observation |
| A2 | F-0's Option B mechanism should be "drain + emit an additionalContext nudge," not an automated headless regen | Architecture Patterns / Pattern 2 | Medium -- this is my inference from `intent-classifier.cjs`'s existing contract plus the RCA's own Option A rejection reasoning, not something the RCA states explicitly as Option B's exact output shape. If the planner/user intends something else (e.g., queueing a follow-up task via a different mechanism), this assumption should be confirmed during `/gsd-discuss-phase` before locking the plan |
| A3 | Pre-commit's WARN-not-block demotion (F-3) should be a PERMANENT default (with a `--strict` opt-in), not merely time-boxed to "until Option B ships within this same phase" | Architecture Patterns / Pattern 1, Common Pitfalls | Medium -- SC3's exact phrasing ("Until the repair loop is live") is genuinely ambiguous between "permanently advisory, matching this repo's Phase-210 idiom" and "temporarily advisory, reverting once F-0 ships in this same phase." Recommend the permanent-advisory reading (decouples SC3 from F-0's fate, and matches the only precedent this repo has for this exact problem shape), but this should be confirmed, not assumed, before planning locks it in |
| A4 | SC1 ("the guardian's on-stop output reaches the user-visible surface") is satisfiable via a CLI-only fix (`scripts/on-stop`), without also wiring `lib/mcp/stop-gate-handler.cjs` for Desktop/Cowork parity | Architectural Responsibility Map (Tri-Polar note) | Medium-High -- CLAUDE.md's Tri-Polar rule treats a surface skip as requiring an explicit, stated decision, not a default. This directly affects phase scope (one file edit vs. two code paths in two languages/runtimes) |

## Open Questions

1. **Does F-0's fix (Option B) belong fully inside Phase 241, or is a minimal "stop the unconditional vacuum" (the Option-C-flavored half of the RCA's recommendation) sufficient for this phase, deferring the actual `intent-classifier.cjs` wiring?**
   - What we know: ROADMAP.md explicitly folds F-0 into Phase 241 ("folds in the filed `minto-debounce-consumer-dead-end` RCA, F-0 already open") and the phase Goal says "its repair ladder is reachable" (present tense, implying the ladder becomes reachable IN this phase). Neither MINTO-01 nor MINTO-02's literal text names F-0, and SC3 is phrased conditionally ("Until the repair loop is live"), which reads more naturally if the loop is NOT expected to be fully live by the end of this phase.
   - What's unclear: whether "reachable" in the Goal statement means "a real consumer now exists and nudges the model" (full Option B) or merely "the queue-health alarm can now actually fire because the unconditional vacuum is gone" (the RCA's minimal Option-C-flavored piece, without inventing the intent-classifier nudge).
   - Recommendation: default to implementing full Option B (the RCA's own explicit recommendation, with cited reasoning for why Option A is impossible and Option C alone is a downgrade of value) since it's the RCA's stated recommendation and ROADMAP folds F-0 in without carving out a narrower scope; confirm with the user/`/gsd-discuss-phase` if plan complexity or time budget makes the minimal path preferable.

2. **Does the F-1 fix need to extend to `lib/mcp/stop-gate-handler.cjs` for Desktop/Cowork parity, or is a CLI-only (`scripts/on-stop`) fix sufficient for this phase's success criteria?**
   - What we know: `stop-gate-handler.cjs` never invokes the guardian's `on-stop` mode at all today (confirmed by grep, zero hits for `feynman-minto-guardian` in that file). SC1's success criterion text doesn't name a surface.
   - What's unclear: whether the phase's implicit scope (given the RCA's own Scope-and-Impact section explicitly lists "cli, desktop, cowork" as affected surfaces for F-0, but F-1 was never covered by the RCA at all) extends the Tri-Polar expectation to F-1 too.
   - Recommendation: given CLAUDE.md's strong Tri-Polar default treats a skip as requiring a stated, deliberate call rather than a silent omission, the plan should either (a) wire `stop-gate-handler.cjs` to also invoke the guardian's on-stop check and fold its result into whatever surfaces Desktop/Cowork read, or (b) explicitly document in the plan why this phase intentionally stays CLI-only (e.g., "Desktop/Cowork's guardian-reporting gap is a pre-existing, separate finding, tracked as [new RCA/backlog item], out of Phase 241's proven-by-SC1 scope"). Silence on this is not acceptable per the Tri-Polar rule.

3. **Should the F-1 fix raise/remove the 1-second timeout, or restructure `runOnStop()`'s program order so the report-write and ghost-prune happen BEFORE any section-walk work that could run long?**
   - What we know: `runOnStop()` (lines 335-434) walks ALL sections, aggregates violations, THEN writes the report, THEN prunes ghosts, THEN emits systemMessage -- all sequentially, all inside the 1s window today. SC1 requires a slow report-write to still land.
   - What's unclear: whether "slow" in SC1 refers to a slow section-walk/validation pass (many sections, or one slow validator) or specifically a slow DISK write (e.g., a throttled filesystem), which would call for different fixes (raising the deadline vs. reordering vs. writing incrementally per-section instead of one batch at the end).
   - Recommendation: the safest fix that satisfies SC1 literally ("an injected slow report-write... still lands on disk") is to remove the hard kill on the write/prune phase specifically (e.g., raise or drop `timeout` for `on-stop` mode, since the guardian's own comment already frames the 1s budget as being about the 3000ms Stop-hook TOTAL budget, not a report-write speed limit) while keeping some overall wall-clock sanity bound if the existing 3000ms Stop-hook budget is a hard external constraint from Claude Code itself.

## Environment Availability

Not applicable — this phase has zero external dependencies beyond the Node.js runtime and POSIX shell/coreutils (`timeout`, `git`) already required and verified by every other phase in this repo. No new tool, service, or package to probe.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Custom CJS test runner (no Jest/Mocha/Vitest) -- `lib/memory/run-feynman-tests.cjs`, discovers and runs an explicit `TEST_FILES` array via `node:child_process.spawnSync` per file |
| Config file | none (the `TEST_FILES` array in `lib/memory/run-feynman-tests.cjs` itself is the "config") |
| Quick run command | `node lib/memory/feynman-minto-guardian.test.cjs` (single file, fastest signal for guardian-side changes) |
| Full suite command | `node lib/memory/run-feynman-tests.cjs` (runs the full Feynman-MINTO pipeline suite, includes debouncer + invariants + guardian + post-write-triple files) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MINTO-01 (F-1, findings reach user) | Seeded triple-health violation's systemMessage appears in `scripts/on-stop`'s FINAL stdout JSON | integration (shell + node) | new test invoking `scripts/on-stop` end-to-end with a seeded violation and asserting on the process's actual final stdout line | ❌ Wave 0 -- no existing test drives `scripts/on-stop` as a subprocess and asserts final stdout content |
| MINTO-01 (F-1, slow write survives timeout) | Injected slow report-write/ghost-prune still produces `.mindrian/invariant-report.json` and prunes `minto-stale.json` | integration | new test with an injectable delay (e.g., env-var-controlled artificial sleep in a test validator) proving the write survives past the old 1000ms mark; mutation-prove by restoring the old `timeout 1` and confirming the write is dropped | ❌ Wave 0 |
| MINTO-01 (F-0 fold-in, debounce consumer wired) | A production call site both enqueues AND later drains-and-acts (not merely drains-and-discards) | integration + structural census | `lib/memory/feynman-minto-guardian.test.cjs` extension, per RCA's own Test 1/Test 2 spec (production-only census excluding `tests/`) | ❌ Wave 0 -- RCA explicitly names this as new (`tests/test-88-minto-debounce-consumer-wired.cjs` or an extension) |
| MINTO-02 (F-2, severity ladder) | Seeded missing MINTO.md and missing governing_thought each aggregate to `critical` and reach the enqueue gate | unit | extend `lib/memory/feynman-minto-invariants.test.cjs` and `lib/memory/feynman-minto-guardian.test.cjs` fixtures | ✅ files exist, need new/updated assertions |
| MINTO-02 (F-3, pre-commit demotion) | Same seeded breach at pre-commit produces WARN (stderr) and exit 0, proven by a real `git commit` run | integration (real git commit, not just calling `runPreCommit()` directly) | new test that stages a seeded breach in a scratch git repo/worktree and runs the actual pre-commit hook, asserting exit 0 + WARN text | ❌ Wave 0 -- existing `feynman-minto-guardian.test.cjs` likely calls `runPreCommit()` as a function; SC3's own text demands a REAL commit run, which is a stronger bar |

### Sampling Rate
- **Per task commit:** `node lib/memory/feynman-minto-guardian.test.cjs` (fastest relevant signal for guardian-side edits) or `node lib/memory/minto-debouncer.test.cjs` (for F-0 debouncer-side edits)
- **Per wave merge:** `node lib/memory/run-feynman-tests.cjs` (full Feynman-MINTO suite)
- **Phase gate:** full suite green before `/gsd-verify-work`, plus the mutation-proof runs the ROADMAP rigor standard requires (disabling each fix must turn its named test red) for all three success criteria

### Wave 0 Gaps
- [ ] New integration test driving `scripts/on-stop` as a real subprocess and asserting on its actual final stdout JSON (needed for MINTO-01/F-1's "reaches the user" half)
- [ ] New integration test with an injectable slow-write path proving the timeout can no longer silently drop a report-write/ghost-prune (needed for MINTO-01/F-1's second half)
- [ ] New/extended test per the RCA's own Test 1/Test 2 spec: a production-call-site census (excluding `tests/`) proving a real consumer both enqueues and drains-and-acts (needed for F-0's fold-in)
- [ ] New integration test running a REAL `git commit` against a scratch repo/worktree with a seeded breach, asserting exit 0 + WARN text (needed for MINTO-02/F-3 -- SC3 explicitly requires "a real commit run," which existing function-level tests of `runPreCommit()` do not satisfy)
- [ ] Framework install: none needed -- the existing custom CJS runner (`lib/memory/run-feynman-tests.cjs`) already exists and is the correct place to register all of the above

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled per the governing default), so this section is included for completeness, though this phase's blast radius is narrow.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | No session/token handling touched |
| V4 Access Control | No | No access-control logic touched |
| V5 Input Validation | Marginal | The severity-ladder change (F-2) IS input validation logic (validating a MINTO.md's frontmatter fields), but the change is a severity-level RECLASSIFICATION of an already-existing, already-correct validation check, not new validation logic. No new untrusted input source is introduced. |
| V6 Cryptography | No | No crypto touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| False-success / silent-drop reporting (this repo's own tracked failure class, per `feedback_false_success_silent_skip_gates_academy_testers.md` in user memory and the RCA's own framing: "a queue that is genuinely empty... looks identical to a queue that was emptied without being consumed") | Repudiation (the system's own success message misrepresents what happened -- `scripts/on-stop:110`'s "N sections drained" line reports a SECTION COUNT, not a drained-queue-entry count, per RCA Evidence) | Every "advisory, never blocks" surface this phase touches must be honest about WHAT it checked and WHETHER anything was found/acted on, not merely report a generic success line. The F-1 and F-0 fixes should both surface an explicit count (violations found, entries drained/nudged) rather than a boolean "ran successfully" signal, to avoid reproducing this exact failure class in the new code paths. |
| Pre-commit demotion accidentally becoming a silent no-op instead of an honest WARN (F-3) | Repudiation | Follow the `check-shape-declaration.cjs` precedent exactly: still ENUMERATE every violation to stderr even when not blocking, so the WARN is genuinely informative, not merely "exit 0 and say nothing" |

## Sources

### Primary (HIGH confidence -- direct code reads/greps against this repo's working tree, 2026-07-28)
- `.planning/ROADMAP.md` (Phase 241 section + Cross-Cutting Research Rules) -- phase goal, success criteria, dependency notes
- `.planning/REQUIREMENTS.md` (MINTO-01/MINTO-02 exact text + F-0..F-3 numbering)
- `.planning/debug/minto-debounce-consumer-dead-end.md` -- filed RCA, F-0's full evidence trail and Option A/B/C analysis (source of truth for F-0; not re-investigated, only translated and cross-referenced here)
- `scripts/on-stop` (lines 330-553) -- F-1's exact code location (`timeout 1 ... on-stop ... >/dev/null 2>&1 || true` at line 460) and the final Stop-hook stdout contract (lines 543-550)
- `scripts/feynman-minto-guardian.cjs` (full file, 575 lines) -- `runOnStop`, `runSessionStart`, `runPreCommit`, `validateSection`'s existence-check severity, the enqueue gate
- `lib/core/feynman-minto-invariants.cjs` (lines 260-400) -- the underlying content validator's severity assignments, including the file-not-found CRITICAL path that is short-circuited before ever running for a missing MINTO.md
- `lib/memory/validators/minto-invariants.cjs` (full file, 62 lines) -- the wrapper that suppresses missing-file CRITICALs to null
- `lib/mcp/stop-gate-handler.cjs` (lines 100-242) -- confirms the shared/non-CLI Stop path never calls the guardian's on-stop invariant check at all (grep for `feynman-minto-guardian` returns zero hits)
- `scripts/hooks/pre-commit-room-minto-guard.sh` (lines 195-234) -- the actual git-hook exit-code propagation F-3 must change
- `scripts/minto-debouncer.cjs` (full file structure + `enqueue`/`drain`/`peek`, lines 221-353) -- the existing, already-tested debounce queue API F-0's fix reuses
- `scripts/intent-classifier.cjs` (lines 1-60) -- the promised-but-unwired consumer's existing UserPromptSubmit contract and 200ms budget constraint
- `lib/memory/run-feynman-tests.cjs` (full `TEST_FILES` registry) -- confirms the existing test runner and the four relevant test files
- `.planning/HANDOFF-2026-07-28-v1.16.0-max-parallel-execution.md` -- confirms Phase 241's "nothing hard" dependency status and its concurrency with Phase 235 (source of the Pitfall 4 / pre-commit-hook-consolidation-collision risk)
- `.planning/STATE.md` (lines 1-60) -- confirms v1.16.0 milestone is in `planning` status, Phase 234 (prior milestone) is the last completed phase, no v1.16.0 phase has executed yet
- `./CLAUDE.md` -- Tri-Polar rule, Part 7/8/11 canon references, GSD workflow enforcement, langtalks/Context7 grounding-source rules

### Secondary (MEDIUM confidence)
- none beyond the above -- no WebSearch/WebFetch/Context7 lookups were needed; this phase has no external library or service surface to research

### Tertiary (LOW confidence)
- A1 (coreutils `timeout` signal/exit-code behavior) -- stated from general POSIX/coreutils knowledge, not verified live on this machine's `timeout` binary in this research pass; see Assumptions Log

### Grounding-source note (per CLAUDE.md's mandatory "Consult ALL Relevant Grounding Sources" section)
- **langtalks-graph-expert:** already consulted by the orchestrator prior to this research pass (this research agent does not have the tool). Result, recorded honestly per the orchestrator's brief: `get_entity` found "reflection" and "guardrails" as loosely-connected entities, related to each other only via a shared episode co-mention (not a genuine documented architectural relationship); `self-repair`, `self-correction`, `critic model`, `dead letter queue`, `background job queue`, `async worker`, `Minto pyramid`, and `Feynman technique` all returned `found=false`. This is a valid "not in corpus yet" outcome per CLAUDE.md's own standing rule ("Not in the corpus yet" is a valid, expected answer). Not re-attempted in this research pass; no langtalks citation is fabricated anywhere in this document.
- **Context7:** not invoked. This phase touches zero third-party libraries or documented APIs (`node:sqlite`, the only Context7-flagged dependency in this milestone's Cross-Cutting Research Rules, applies to Phases 236/240/242, not 241).
- **claude-api skill / claude-code-guide agent:** not invoked. This phase does not touch `hooks/hooks.json` matchers, MCP tool registration, or subagent-registry behavior -- it edits the BODIES of scripts already wired into the Stop/PreToolUse/pre-commit paths, not the wiring declarations themselves. (Note: if the planner decides to ALSO wire `lib/mcp/stop-gate-handler.cjs` per Open Question 2, that edit is still a body-level change to an already-registered handler, not a new matcher/registration, so this exemption should still hold -- but the planner should re-confirm this at plan time.)
- **WebSearch/WebFetch:** not invoked. No time-sensitive release-notes or vendor-docs question exists in this phase's scope; per the standing MCP-stack-awareness rule, silent WebSearch firing was avoided since nothing in this research required it.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A (no new stack) -- HIGH confidence there is nothing to research here
- Architecture (F-0/F-1/F-2/F-3 code locations): HIGH -- every claim is a direct grep/read against the current working tree, with exact file:line citations reproducible by any reader
- Pitfalls: HIGH for Pitfalls 1/2/3/5 (directly evidenced by code structure and the RCA's own stated rigor bar); MEDIUM for Pitfall 4 (the concurrency risk is inferred from the HANDOFF doc's wave grouping, not an observed collision)

**Research date:** 2026-07-28
**Valid until:** this research is tied to the exact working-tree state at commit-time of this session; re-verify file:line citations if Phase 235 (concurrent, same wave) lands first and touches any of the same files, or if more than ~7 days pass before Phase 241 is planned/executed (fast-moving milestone, multiple concurrent phases in flight)
