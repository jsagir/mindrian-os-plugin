---
phase: 274
slug: bare-scripts-invocation-anchoring-the-adjacent-class-phase-2
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-01
---

# Phase 274 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from
> `274-RESEARCH.md`'s "Validation Architecture" section (research pass, 2026-09-01).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None -- hand-rolled CJS assertion scripts + bash aggregators (repo convention). `tests/test-271-plugin-path-anchoring.cjs` is the direct template (218 lines, `fs.mkdtempSync` fixtures, imports `scanSurface`/`scanScriptInvocations`/`validateAllowlist` directly from the instrument). |
| **Config file** | none -- deliberate |
| **Quick run command** | `node tests/test-274-script-invocation-anchoring.cjs` |
| **Full suite command** | `bash tests/run-all-274.sh` |
| **Estimated runtime** | sub-second for fixtures; the CLI smoke test spawns real processes so a few seconds |

---

## Sampling Rate

- **Per task commit:** `node tests/test-274-script-invocation-anchoring.cjs` (fixtures only, never touches the live tree, stays green while the sweep is mid-flight).
- **Per wave merge:** `bash tests/run-all-274.sh`.
- **Phase gate:** `bash scripts/verify-release` fully green before `/gsd-verify-work`.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|----------|-----------|-------------------|-------------|--------|
| T1-T2 | 274-01 | 0 | ANCHOR-01 | Widened predicate matches `sh`/`npx`/`python3`; classifies anchored vs bare; `--check-scripts` exits 1 on violation, 0 on clean | unit (fixture) | `node tests/test-274-script-invocation-anchoring.cjs` | ✅ | ✅ green |
| T1 | 274-02, 274-03 | 1 | ANCHOR-02 | Zero unanchored command-surface invocation sites | integration (live tree) | `node scripts/check-plugin-path-anchoring.cjs --check-scripts` | ✅ | ✅ green |
| T1 | 274-04 | 1 | ANCHOR-03 | The 3 hand-authored skill sites use the long fail-closed form, not the short form | unit (fixture + live grep) | `node tests/test-274-script-invocation-anchoring.cjs` | ✅ | ✅ green |
| T1 | 274-04 | 1 | ANCHOR-04 | Zero unanchored agent-surface sites | integration | `node scripts/check-plugin-path-anchoring.cjs --check-scripts` | ✅ | ✅ green |
| T1 | 274-05 | 2 | ANCHOR-05 | Mirrors byte-consistent with fixed commands | integration | `node scripts/build-skill-mirrors.cjs --check` | ✅ exists | ✅ green |
| T2 | 274-04 | 1 | ANCHOR-06 | Every allowlist entry has a non-empty reason; every `followup` id resolves | unit | `node tests/test-274-script-invocation-anchoring.cjs` (reuses `validateAllowlist`) | ✅ | ✅ green |
| T3 | 274-01 | 0 | ANCHOR-07 | Fixture A/B: identical line, prefix as only variable, exit 1 -> exit 0 | unit (tmpdir fixture) | `node tests/test-274-script-invocation-anchoring.cjs` | ✅ | ✅ green |
| T3 | 274-01 | 0 | ANCHOR-08 | From a non-plugin-root cwd, a representative sample of anchored invocations resolves (no `Cannot find module`/exit 127); the bare form provably fails | integration (runtime smoke) | `bash tests/smoke-274-cli-invocation.sh` | ✅ | ✅ green |
| T1 | 274-06 | 3 (last) | ANCHOR-09 | `verify-release` emits a PASS line for gate 10f | integration | `bash scripts/verify-release` (grep for the 10f PASS line) | ✅ exists | ✅ green |
| T2, T3 | 274-06 | 3 (last) | ANCHOR-10 | Zero em-dashes in all new text; CHANGELOG/ROADMAP/knowledge-base entries present | lint (grep) | `grep -rn` em-dash bytes on changed files | inline | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Sequencing note (research finding): wire ANCHOR-09/gate 10f LAST, after ANCHOR-02..06 land. Phase 271-05 wired its own gate-PASS criterion before its dependency waves closed, found it unmeetable, and left verify-release red for days (DEVIATION-271-05-A). Do not repeat.*

---

## Wave 0 Requirements

- [x] `tests/test-274-script-invocation-anchoring.cjs` -- covers ANCHOR-01, 03, 06, 07. Modeled on `tests/test-271-plugin-path-anchoring.cjs` (same `ok()` helper, same `mkdtempSync` fixture pattern, same direct-import-of-the-instrument approach). Landed 274-01, 20/20 PASS.
- [x] `tests/smoke-274-cli-invocation.sh` -- covers ANCHOR-08. The four-arm table RESEARCH.md's Code Example 3 measured live is its exact specification (bare -> Cannot find module; anchored+env -> resolves; short-form+env-unset -> resolves to wrong path and dies confusingly; long-form+both-unset -> refuses with a message naming the fix). Landed 274-01, 8/8 PASS.
- [x] `tests/run-all-274.sh` -- aggregator, modeled on `tests/run-all-271.sh`, including a DO-NOT-REGRESS arm re-running `node scripts/check-plugin-path-anchoring.cjs --check` so this phase cannot re-break gate 10c's citation tier. Landed 274-01; header updated 274-05 to record the `--check-scripts` arm's RED-to-GREEN transition. `bash tests/run-all-274.sh` PASS=4 FAIL=0.
- [x] `--check-scripts` mode added to `scripts/check-plugin-path-anchoring.cjs` -- the gateable exit-code path (part of ANCHOR-01, not a separate file). Landed 274-01; wired as a hard release gate (10f) in `scripts/verify-release` by 274-06.
- No framework install needed

Wave 0 complete: all 4 gaps landed in 274-01. All subsequent waves (command sweep, skill/agent
anchoring, mirror regen, gate wiring) built on this foundation and are now themselves complete.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Desktop/Cowork runtime execution of anchored invocations | D-02 (stated gap) | No automated harness drives Desktop/Cowork today; static path-correctness covers the anchoring logic itself (surface-independent), but not actual shell execution on those two surfaces | Navigator can spot-check post-release if desired; not blocking this phase's gate per D-02's explicit, stated scope |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency acceptable (sub-second fixtures, smoke test spawns real processes)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Phase 274 complete. All 10 ANCHOR requirements verified green (see Per-Task
Verification Map above); `bash tests/run-all-274.sh` PASS=4 FAIL=0; `bash scripts/verify-release`
runs clean end to end including the new gate 10f. Signed off by 274-06 (phase close plan),
2026-09-01.

---

## Dev-Research Compositing Trail (274-06, Task 3)

Per CLAUDE.md's standing Dev-Research Compositing mandate, this phase's durable reasoning trail
was authored and attempted at both mandated homes. Outcome, honestly recorded, matching the
271-05 precedent exactly (same hook, same class of stale binding):

- **Room write: BLOCKED, not bypassed.** The `Write` to
  `~/MindrianRooms/rethinking-mindrianos/research/2026-09-01-bare-scripts-invocation-anchoring-274/`
  was refused by the `write-scope-check` PreToolUse hook, verbatim: "Blocked: write to
  rethinking-mindrianos denied. Active room is jonathan-contractor-motj." That binding is stale
  (this GSD session never established it) -- the same class of drift 271-05 hit under a
  different wrong room name (`launchpad-02` then, `jonathan-contractor-motj` now). The hook was
  NOT bypassed via a Bash heredoc or any other write-scope-check evasion.
- **Sibling-repo mirror: LANDED and verified.** The full reasoning trail (security framing,
  the fourth-pass pattern lesson, the three instrument defects, the mirror-drift finding, the
  DEVIATION-271-05-A sequencing lesson this phase deliberately avoided, both registered
  followups) is written at
  `~/MindrianOS/research/2026-09-01-bare-scripts-invocation-anchoring-274/2026-09-01-bare-scripts-invocation-anchoring-274.md`
  -- verified present with `test -e` immediately after the write. This is CLAUDE.md's stated
  "source-of-record" mirror location; no reasoning was lost.
- **Outstanding human action, one command:** `/mos:rooms switch rethinking-mindrianos`, after
  which the room copy is a single `cp` of the sibling-repo mirror above. The compositing
  mandate is half-satisfied (source-of-record landed, room copy blocked) and is recorded as
  such here, not claimed as fully complete.
- **A separate finding surfaced while investigating the mirror path (not a compositing
  failure of this phase):** `~/MindrianRooms/mindrianOS/research/` (a room, distinct from the
  `~/MindrianOS/research/` sibling repo used above) has had no new phase entries land since
  roughly 2026-07-08. It was never the mandated mirror target -- CLAUDE.md's "mirrored to
  `mindrianOS/research/` as source-of-record" refers to the sibling repo, confirmed by Phase
  271/272/273's own mirrors all landing correctly there -- but the name collision is worth
  flagging for the next reader who might assume the room copy is the mirror.
