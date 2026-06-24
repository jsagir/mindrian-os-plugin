---
phase: 179
plan: "08"
subsystem: ga4-card-fire-interceptor
tags: [gap-closure, fix-wave, R-1-cure, stop-hook, part-8, cirs-r15]
kind: summary
requires:
  - scripts/check-card-fire.cjs (Plan 179-01 substrate)
  - scripts/on-stop (the transcript-read idiom reused)
  - data/render-coverage-registry.json (Phase 178 R15 PRIMARY substrate, DEFERRED)
provides:
  - A LIVE GA-4 card-fire interceptor (no longer a runtime no-op)
  - The load-bearing end-to-end test the original suite was missing (BL-01 / WR-03)
  - A converging bounded-escape counter (WR-01) + a TTL-pruned retry store (WR-02)
  - Honest PRIMARY-deferred / BACKSTOP-live doctrine (WR-04) in code + 179-CONTEXT
  - Reconciled Stop-vs-PostToolUse + decision:block-vs-exit-2 doc drift (IN-01)
affects:
  - tests/run-all-179.sh (new W8 line)
tech-stack:
  added: []
  patterns:
    - Stop-hook transcript_path parsing (mirrors scripts/on-stop:33)
    - spawnSync end-to-end test against the real script entry point
key-files:
  created:
    - tests/test-ga4-card-fire-e2e-179.cjs
  modified:
    - scripts/check-card-fire.cjs
    - tests/run-all-179.sh
    - .planning/phases/179-ignite-b1-starting-point-fix/179-CONTEXT.md
decisions:
  - "BL-01: deriveTurnSignals parses transcript_path (the real Stop contract) for the BACKSTOP + AskUserQuestion detection; direct-field envelopes stay backward-compatible so the 22 existing assertions stay green."
  - "WR-01: the retry counter keys on session_id + stable gate identity (ran_entries set, else gate_turn_index), NEVER output_text, so re-worded re-prompts converge and MAX_FORCE_RETRIES is reachable."
  - "WR-02: the retry store entries carry { count, ts } and are TTL-pruned (RETRY_TTL_MS = 24h) on every write; legacy bare-integer entries are normalized, never lost."
  - "WR-04: PRIMARY is documented as DEFERRED (no producer of ran_entries exists repo-wide); the BACKSTOP is the LIVE detector this phase ships."
  - "IN-01: the interceptor is a Stop-hook-class interceptor emitting decision:block on exit 0, NOT a PostToolUse exit-2 block; reconciled in the file header + 179-CONTEXT."
metrics:
  duration: ~25m
  completed: 2026-06-24
  tasks: 1
  files: 4
---

# Phase 179 Plan 08: GA-4 Card-Fire Interceptor Gap-Closure Summary

The adversarial-review BLOCKER (BL-01) is closed: the GA-4 card-fire interceptor now
FIRES at runtime against a realistic Stop stdin by parsing `transcript_path` (mirroring
`scripts/on-stop:33`) instead of reading turn signals the real Stop hook never sends. A
load-bearing end-to-end test pipes a realistic Stop envelope through the actual script and
proves the block; it fails against the pre-fix no-op and passes after the fix. The three
related warnings (WR-01 converging retry key, WR-02 TTL-pruned store, WR-04 honest
PRIMARY-deferred/BACKSTOP-live doctrine) and the IN-01 Stop-vs-PostToolUse doc drift are all
closed.

## What was the bug (BL-01)

`deriveTurnSignals(env)` read `output_text` / `ran_entries` / `askuserquestion_fired`
directly off the Stop-hook stdin envelope. The real Claude Code Stop hook delivers
`{ hook_event_name, transcript_path, session_id, ... }` and NONE of those normalized
fields. So at runtime every signal was empty, `classifyCardFire` always returned
`no-gate-signal`, and the hook always no-opped. The green 22-assertion suite never caught it
because every assertion fed synthetic `turn` objects straight into the pure predicate,
never crossing `deriveTurnSignals` / `main()` against a realistic Stop shape (the WR-03
test-theater gap).

## The fixes

### BL-01 -- make the interceptor actually fire (the load-bearing fix)

- `deriveTurnSignals(env)` rewritten: when the envelope carries `transcript_path` (and no
  direct `output_text`), it calls the new `readTranscriptTurn(transcriptPath)` which parses
  the JSONL transcript (reusing the `scripts/on-stop` idiom: read the local file, walk the
  lines), extracts the LAST assistant message text -> `output_text` (drives the BACKSTOP),
  and scans tool-use records for an `AskUserQuestion` invocation -> `askuserquestion_fired`.
- BACKWARD-COMPAT: if the envelope already carries the normalized fields directly (the
  unit-test shape), those win, so the 22 existing assertions stay green.
- FAIL-SAFE: an unreadable / missing / malformed transcript yields empty signals -> a safe
  no-op (`readTranscriptTurn` never throws; malformed lines are skipped).
- New helpers added + exported: `readTranscriptTurn`, `extractAssistantText`,
  `scanContentForAskUserQuestion`.

### WR-01 -- the bounded-escape counter now converges

`turnContextHash(turn)` re-keyed on STABLE turn identity: `session_id` + a stable gate
identity (the `ran_entries` set when present, else a transcript `gate_turn_index` message
counter). The volatile `output_text` is deliberately EXCLUDED, so a re-worded re-prompt on
the same stuck gate increments the SAME counter and `MAX_FORCE_RETRIES` is actually
reachable. Proven end-to-end: driving the real script `MAX_FORCE_RETRIES` times with
re-worded ascii-box transcripts on the same session reaches the ceiling, and the next run
DEGRADES (`continue:true`) instead of blocking forever.

### WR-02 -- the retry side-file no longer leaks

Each store entry is now `{ count, ts }`; `writeRetryStore` calls the new pure
`pruneRetryStore(store, now)` on every write, evicting entries older than
`RETRY_TTL_MS` (24h). A legacy bare-integer entry (pre-WR-02 format) is normalized via the
new `normalizeRetryEntry` and kept (then subject to the TTL going forward), never lost. The
store cannot grow without bound.

### WR-04 -- honest PRIMARY-deferred / BACKSTOP-live doctrine

A repo-wide grep finds ZERO producers of `ran_entries` / `reached_gate_entries`, so the
registry-keyed PRIMARY detector has no live source from a transcript (a transcript yields
assistant TEXT, not a reached-entries SET). The file header doctrine + 179-CONTEXT now state
plainly that PRIMARY is DEFERRED pending a reached-gate side-channel writer, and the BACKSTOP
(transcript ASCII-box text detection) is the LIVE detector this phase ships. The PRIMARY code
path is retained and correct (it activates the instant a producer lands; the unit tests
exercise it via direct-field envelopes) but is no longer presented as the live cure. The
side-channel writer is named as a deferred follow-on, OUT of scope.

### IN-01 -- Stop-vs-PostToolUse + decision:block-vs-exit-2 doc drift reconciled

The file header and 179-CONTEXT called it a "GA-4 PostToolUse interceptor" emitting an
"exit-2 block." It is wired in the `hooks/hooks.json` Stop block and emits a
`decision:'block'` JSON envelope on exit 0 (a valid Stop-block path). Both surfaces now say
Stop-hook-class + decision:block-on-exit-0, with the drift explicitly noted as reconciled.

## The new load-bearing test (BL-01 / WR-03)

`tests/test-ga4-card-fire-e2e-179.cjs` (19 assertions), wired into `tests/run-all-179.sh` as
the new W8 line. It `spawnSync`s `node scripts/check-card-fire.cjs` with a realistic Stop
stdin against fixture `.jsonl` transcripts:

- E2E-1: ascii-box transcript (no AskUserQuestion) -> asserts stdout carries
  `decision:'block'` + the `AskUserQuestion` re-prompt.
- E2E-2: transcript WITH an `AskUserQuestion` tool_use -> asserts a no-op (`continue:true`,
  no block).
- E2E-3: missing transcript -> asserts a safe no-op (never throws, never blocks spuriously).
- WR-01: re-worded retries on the same session+gate produce the SAME retry key; a different
  session does not collide; the end-to-end counter reaches the ceiling then degrades.
- WR-02: `pruneRetryStore` evicts a stale entry, keeps a fresh one, normalizes a legacy bare
  int, and never grows past the input key set.

### Pre-fix-fails / post-fix-passes evidence (no test theater)

Restoring `scripts/check-card-fire.cjs` from `git HEAD` (the pre-fix code) and running the
new test, it FAILS at the load-bearing assertion:

```
AssertionError: (E2E-1) the envelope BLOCKS (decision:block) -- the LIVE cure, no longer a no-op
  actual: false  expected: true
```

Against the fixed code it passes 19/19. The pre-fix live repro returned
`{"continue":true,"suppressOutput":true}` (the no-op); the post-fix live repro returns
`{"decision":"block","reason":"ascii-box-backstop-no-card",...}`.

## Verification

- `node tests/test-ga4-card-fire-interceptor.cjs` -> 22/22 (existing assertions stay green).
- `node tests/test-ga4-card-fire-e2e-179.cjs` -> 19/19 (the new e2e).
- `bash tests/run-all-179.sh` -> Passed 12, Failed 0, Skipped 0, exit 0.
- Adjacent regression fences: `tests/run-all-178.sh` 10/0, `tests/run-all-172.sh` 20/0.
- Live proof:
  `echo '{"hook_event_name":"Stop","transcript_path":"<ascii-box-fixture>"}' | node scripts/check-card-fire.cjs`
  now emits `decision:block` (was `continue:true` no-op pre-fix).

## Frozen contracts + Part 8

- `lib/core/navigation/room-birth.cjs`, `lib/core/navigation/edges.cjs`,
  `lib/core/navigation/transitions.cjs`: byte-unchanged (`git diff --quiet HEAD` clean).
- No reach / posture / edge / node minted; the carried frozen-set drift fences
  (`reach-ids` 6, `posture-ids` 3) stay green.
- Part 8: the interceptor opens NO Brain wire and egresses NO content. It reads the LOCAL
  transcript file (a local path, same class as `scripts/on-stop`), scans it for glyphs /
  tool-use, and discards it; nothing is sent anywhere. The existing PART-8 sweep assertion in
  the 22-assertion suite + the Plan 179-07 cross-surface leak sweep both stay green.

## Deviations from Plan

None beyond the mandated fixes. The fix-wave was executed exactly as specified (BL-01 +
WR-01 + WR-02 + WR-04 + IN-01, the new e2e test wired into run-all-179.sh).

## Deferred Issues (out of scope, not introduced by this plan)

- The reached-gate side-channel writer that would make PRIMARY live is a named, deferred
  follow-on (WR-04). Documented honestly; not built this wave per the mandate.
- `179-CONTEXT.md` carries 18 PRE-EXISTING em-dashes in its "Canonical refs" / "Code context"
  / "Deferred ideas" sections (present in committed HEAD, not introduced here). Per the
  SCOPE BOUNDARY rule they were left untouched; my added prose is em-dash clean, and the
  CI-swept runtime surfaces (`scripts/check-card-fire.cjs`, `tests/test-ga4-card-fire-e2e-179.cjs`,
  `tests/run-all-179.sh`) carry zero em-dashes/en-dashes.
- An unrelated untracked file `references/design/newsletter-email-template.html` exists in the
  working tree; it is not part of this plan and was NOT staged.

## Self-Check: PASSED

- scripts/check-card-fire.cjs FOUND
- tests/test-ga4-card-fire-e2e-179.cjs FOUND
- tests/run-all-179.sh FOUND
- .planning/phases/179-ignite-b1-starting-point-fix/179-08-SUMMARY.md FOUND
- bash tests/run-all-179.sh exit 0 (12 passed, 0 failed)
- pre-fix-fails / post-fix-passes proven for the new e2e test
