---
phase: 179
plan: 10
subsystem: card-fire-interceptor
tags: [gap-closure, fix-wave, bounded-escape, livelock, gate-signature, part-8]
requires:
  - 179-09 (the last-user-anchor CR-02 fix this wave supersedes on the no-anchor path)
  - scripts/check-card-fire.cjs (the GA-4 R-1 cure interceptor)
provides:
  - a transcript-growth-INVARIANT, per-gate retry key anchored on GATE-IDENTIFYING content
  - CR-03 fix (no-role:user growing transcript converges + degrades at MAX+1)
  - WR-07 fix (two distinct gates get independent counters; no cross-gate budget bleed)
  - WR-08 transcript-read tail cap (the 3000ms hook cannot be stalled by a huge transcript)
affects:
  - scripts/check-card-fire.cjs
  - tests/test-ga4-card-fire-e2e-179.cjs
tech-stack:
  added: []
  patterns: [gate-content-signature, sha256-local-hash, byte-tail-read-cap]
key-files:
  created: []
  modified:
    - scripts/check-card-fire.cjs
    - tests/test-ga4-card-fire-e2e-179.cjs
decisions:
  - "Anchor the retry key on the GATE-IDENTIFYING content (matched glyph span + normalized option-label SET), never the user message, never assistantCount"
  - "DELETE the gate_turn_index = assistantCount fallback entirely from the key derivation"
  - "Degenerate fallback is session_id ALONE (coarse but always converges); a growing value is unreachable as the key"
  - "WR-08: cap the transcript read at the last TRANSCRIPT_TAIL_BYTES (2 MiB); detection semantics unchanged (the box turn lives at the tail)"
metrics:
  duration: ~35m
  completed: 2026-06-25
---

# Phase 179 Plan 10: GA-4 Bounded-Escape Gate-Content Anchor (CR-03 BLOCKER + WR-07 + WR-08) Summary

GAP-CLOSURE fix-wave 179-10 cures the iteration-3 re-review CR-03 BLOCKER (the bounded escape STILL livelocked on any transcript whose box turn has no preceding `role:user` record, because the 179-09 fix anchored the retry key on the LAST USER message, which is empty there and fell back to the growing `assistantCount`) plus WR-07 (two distinct gates sharing the same last-user message merged onto one counter) plus WR-08 (the unbounded transcript read). The root fix moves the anchor from the user message to the GATE-IDENTIFYING content itself.

## What changed

### CR-03 (BLOCKER) + WR-07 (WARNING) -- anchor on the GATE, not the user message

The third consecutive iteration of the SAME failure class (BL-01 -> CR-02 -> CR-03): the headline "bounded escape / no infinite loop" guarantee dead on a reachable-but-unfixtured path. The 179-09 fix anchored the retry key on the LAST USER message (`last_user_anchor`). That anchor is EMPTY when the box turn has no preceding `role:user` record -- a compaction `type:'summary'` lead, OR this codebase's own Phase 114/117 auto-fire-before-the-navigator-types flows -- and the empty anchor fell through to `gate_turn_index = assistantCount` (the growing counter), so every retry on a growing no-user transcript minted a fresh `count:1` key and the bounded escape NEVER converged.

ROOT FIX (`scripts/check-card-fire.cjs`):

- **New `gateSignature(outputText)`** -- a STABLE structural signature of the gate-identifying content of an assistant message: the matched ASCII-box **glyph span** (normalized: lowercased, whitespace-collapsed) plus the **normalized option-label token SET** (each `[n] text` / `n) text` / `n. text` label body lowercased, non-alphanumeric stripped, deduped, SORTED). Returns a 24-char sha256, or `''` when no gate content is recoverable. This is INVARIANT across transcript growth (fixes CR-02 on ALL paths including no-user), present whenever a gate is detected (fixes CR-03), and per-gate (two genuinely-different gates -> different signatures -> different counters: fixes WR-07).
  - **Re-wording robustness:** the signature anchors on the glyph + the option-label SET, NOT the full message prose, so re-wording the surrounding prose between retries does not move the key. If the model MATERIALLY changes the option labels each retry the key may flap -- acceptable ONLY because the degenerate session-alone floor still bounds it; documented as the named residual.
  - **A load-bearing sub-fix:** the option-label regex requires a whitespace separator after the marker (`[1-9][).]\s+`), which rejects a decimal number like `0.123456789` from being mistaken for an `n.` option marker. Without this guard the random per-run suffix in the growing-transcript fixture injected a phantom volatile label and flapped the signature (caught during this wave's own test run, fixed before commit).

- **`turnContextHash` precedence** is now `ran_entries` (deferred PRIMARY, no producer) -> `gate_signature` (the LIVE anchor). The `gate_turn_index` / `assistantCount` tier is **DELETED**. When BOTH are empty (degenerate), the key floors to `session_id` ALONE -- coarse but ALWAYS converges (any consecutive intercept in the session counts up), NEVER a growing value. A growing value is now UNREACHABLE as the key.

- **`readTranscriptTurn`** no longer tracks user messages at all (the user message is irrelevant to the key); it derives `gate_signature` from the last assistant text. **`deriveTurnSignals`** threads `gate_signature` (explicit envelope field -> parsed transcript -> derived from `output_text`), dropping `last_user_anchor` and `gate_turn_index` from the turn shape.

### WR-08 (hardening) -- transcript read tail cap

`readTranscriptTurn` now reads at most the LAST `TRANSCRIPT_TAIL_BYTES` (2 MiB) via the new `readTranscriptTail` helper (statSync the size; plain read at/under the cap, else open a descriptor and read only the trailing window). A pathological multi-hundred-MB transcript can no longer stall the 3000ms hook. Detection semantics are unchanged -- the last assistant message and its gate signature both live at the tail; a partial leading line from the byte cut is dropped by the existing per-line JSON `try/catch`.

## Live proof (the load-bearing evidence)

Side-files committed alongside this SUMMARY:

**CR-03** (`179-10-CR03-prefix-livelock-proof.txt` / `179-10-CR03-postfix-convergence-proof.txt`) -- a growing NO-`role:user` transcript (a `type:'summary'` compaction lead, growing assistant turns, the box), same `session_id`, driven through the REAL script 5 times:
- PRE-FIX: `keys at ceiling = 3 -> [3b4cc096..., ceb7fad5..., f4183f07...]`, `degraded = false` -> **LIVELOCK** (3 distinct count:1 keys, the CR-03 signature reproduced against post-179-09 code).
- POST-FIX: `keys at ceiling = 1 -> [7e5dad025e4381ca]`, `degraded = true` -> **CONVERGES** (ONE key climbs to MAX, degrades at MAX+1).

**WR-07** (`179-10-WR07-two-independent-keys-proof.txt`) -- gate A intercepted twice (`{514c2baa...: count 2}`), then a DISTINCT gate B once in the same session -> gate B mints a NEW independent key (`{eea160f4...: count 1}`), gate A's counter UNTOUCHED -> **TWO INDEPENDENT KEYS, no cross-clear**.

## Pre-fix-fails / post-fix-passes

The new CR-03 and WR-07 e2e assertions were run against the PRE-FIX (179-09) `scripts/check-card-fire.cjs` (git `HEAD:` version) and the CR-03 ceiling assertion genuinely THREW `AssertionError: (CR-03) at the ceiling the side-file holds exactly ONE converging key` -- the suite cannot pass pre-fix. Against the post-fix code the full e2e suite is 37/37 green. The new fixtures write NO `role:user` first line (a `type:'summary'` lead stands in), per the hard rule.

## Tests

`tests/test-ga4-card-fire-e2e-179.cjs` grew 25 -> 37 assertions:
- (CR-03) growing NO-`role:user` transcript: blocks runs 1..MAX, ONE converging key at the ceiling, degrades at MAX+1; plus a bare-box-as-first-message convergence.
- (WR-07) two distinct gates one session: gate A one key at count 2, gate B a NEW independent key at count 1, gate A untouched, no cross-clear.
- (WR-08) `TRANSCRIPT_TAIL_BYTES` + `readTranscriptTail` exported; a huge (cap + 1 MiB) fixture still detects the TAIL box turn and BLOCKS.
- The existing (CR-02) growing-with-user convergence + (WR-06) stale-card-then-box + the 22 unit assertions all still GREEN.

Full suites: `bash tests/run-all-179.sh` FULLY GREEN (12 pass / 0 fail / 0 skip); `bash tests/run-all-178.sh` 10/0; `bash tests/run-all-172.sh` 20/20.

## Frozen contracts + boundaries

- `lib/core/navigation/edges.cjs`, `lib/core/navigation/transitions.cjs`, `lib/core/navigation/room-birth.cjs` are BYTE-UNCHANGED vs HEAD.
- No reach / posture / edge / node minted. Frozen Part 3 contracts (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the glyphs) untouched.
- Part 8: the gate signature is a local sha256; raw user/assistant text never egresses; the interceptor reads the LOCAL transcript only (zero network/Brain surface, verified by grep).
- No em-dashes (CI sweep clean).
- BL-01 stays fixed (the transcript-parsing wiring is untouched; the box-blocks / fired-card-no-ops sanity holds).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Option-label regex matched a decimal number as a phantom option label**
- **Found during:** the first run of the growing-transcript convergence assertion (the fixture appends `Math.random()` to the box text).
- **Issue:** the initial `OPTION_LABEL_RE` `\d+[).]` matched the line `0.123456789` (the random suffix), capturing `123456789` as an option label, which flapped the gate signature across retries and broke convergence.
- **Fix:** require a whitespace separator after the marker and restrict the ordinal to `[1-9]` (`/^\s*(?:\[\s*[1-9]\s*\]|[1-9][).])\s+(.+?)\s*$/`), so a decimal number is not a marker.
- **Files modified:** `scripts/check-card-fire.cjs` (`gateSignature`).
- **Commit:** this wave's atomic commit.

No architectural changes; no authentication gates. The fix is a single atomic commit per the sequential-on-main contract.

## Known Stubs

None. The PRIMARY `ran_entries` path remains a documented deferred (WR-04, no producer) -- unchanged by this wave; the LIVE BACKSTOP path is fully cured on all reachable transcript shapes.

## Self-Check: PASSED

- Files exist: `scripts/check-card-fire.cjs`, `tests/test-ga4-card-fire-e2e-179.cjs`, `179-10-SUMMARY.md`, and the three proof side-files -- all FOUND.
- Commits exist: `b00efd1a` (fix) + `969a701a` (docs) -- both in git log.
- Suites green: e2e 37/37, unit 22/22, run-all-179 12/0/0, run-all-178 10/0, run-all-172 20/20.
