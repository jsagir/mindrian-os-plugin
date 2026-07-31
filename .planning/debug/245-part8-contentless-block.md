---
status: resolved
kind: rca
trigger: "245-part8-contentless-block"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [8]
created: 2026-07-31T00:00:00Z
updated: 2026-07-31T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. `classify()`'s terminal catch-all returns `ambiguous` for a contentless
`{}` payload, and `part8-egress-guard-hook.cjs` translates `ambiguous` plus `brainAvailable()`
into `exit 2`, so a zero-argument Brain metadata read renders the Part 8 leak-prevention card.
test: `classify()` run directly against 8 payload/tool combinations, plus the hook driven as a
child process with a synthetic PreToolUse envelope.
expecting: a contentless `brain_stats` call classifies as `allow` and passes the hook with exit 0,
while every payload carrying a byte still hits the unchanged fail-closed catch-all.
next_action: none. Fixed in Phase 245 Plan 03. The adjacent `brain_search` finding is FLAGGED and
deliberately left unfixed (see section 5 below).

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ `99a5f33a` (working tree, `/home/jsagi/dev/MindrianOS-Plugin`)
- **WIRE claims probe against:** none. This is a pure LOCAL classifier defect. `classify()` opens
  zero Brain wire by construction (D-01), and the hook leg is driven with the
  `PART8_FORCE_BRAIN_AVAILABLE=1` test seam, not a live Brain.
- **Date of audit:** 2026-07-31
- **Re-verification rule:** every source claim below was re-verified against the working tree at
  the sha above by live `node` execution, not by reading alone.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: 1.16.0-beta.4
- Reported by: live working session (a `brain_stats` call rendered the leak-prevention card)
- Date first observed: 2026-07-31
- Related debug sessions: none. Phase 245 Requirement 5 / D-26 / D-27 / D-28 own this.

## Problem Statement

A `brain_stats` call carrying a literal empty payload `{}` was intercepted by the Part 8 egress
guard and rendered the leak-prevention gate, blocking a metadata read that cannot possibly carry
user bytes.

## Symptoms

expected: a zero-argument Brain metadata read (`brain_stats`, `brain_schema`) passes the Part 8
guard silently, because there is nothing in the payload to leak.
actual: the Part 8 F.1 leak-prevention card rendered and the tool call was cancelled.
errors: the hook's ambiguous branch emits the F.1 gate JSON on stderr. Captured verbatim from the
production hook (first stderr line, `PART8_FORCE_BRAIN_AVAILABLE=1`, `tool_input: {a:1}` standing
in for the pre-fix contentless case):

```
{"zones":{"header":"-- part 8 -- this may leak unknown -- pick --","body":"1. Reformulate\n2. Cancel\n3. Free-Text","signals":"","footer":null},"contract":{"shape":"F.1","keyboard":"askuserquestion","verbs":["Reformulate","Cancel","Free-Text"],"mode":"A","recommended":"Reformulate","standingOptions":false}}
```

reproduction:
  1. `node -e "console.log(JSON.stringify(require('./lib/core/part8-egress-guard.cjs').classify({}, {toolName:'mcp__plugin_mos_mindrian-brain__brain_stats'})))"`
  2. observe `{"verdict":"ambiguous","class":"unknown","reason":"neither proven move-set nor content hit"}`
  3. drive `scripts/part8-egress-guard-hook.cjs` with `{"tool_name":"<scoped brain_stats>","tool_input":{}}`
     on stdin and `PART8_FORCE_BRAIN_AVAILABLE=1`
  4. observe exit code 2 and the F.1 gate on stderr
started: Phase 196-03, when `classify()` shipped with three positive recognizers and one terminal
catch-all. The defect has been latent since then; it surfaces whenever the Brain is available and
a contentless Brain tool is called.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork. The guard is a hook shared by all three install
  targets, so the defect and its fix land on all three at once, by construction.
- Affected commands: any surface that reaches `brain-client.cjs::stats()` or `::schema()`, plus
  anything downstream of a Brain schema read.
- Affected users: every install with a Brain key present (`brainAvailable()` true). Brain-less
  installs were never affected, because the D-08a degrade path allows on ambiguous.
- Version range: 1.x since Phase 196 - fixed at 1.16.0-beta.4+ (Phase 245 Plan 03).
- Severity: high. Not a leak, the opposite: a false block on a no-leak path.
- Blast radius: `brain_stats`, `brain_schema`, and any future nullary Brain tool. `brain_search`
  is adjacent but a DIFFERENT case (section 5).

## Eliminated

- hypothesis: the live interception was a hook timeout at 2000ms rather than a classifier verdict.
  evidence: the hook was driven as a child process and its ambiguous branch emitted the F.1 gate
  JSON verbatim (quoted under Symptoms). A timeout emits neither a gate nor a Part 8 notice. This
  settles 245-RESEARCH.md Assumption A1: the branch that fired is the `classify()` catch-all
  translated by `part8-egress-guard-hook.cjs:179-202`, and specifically the GATE render leg
  (`lib/hmi/part8-egress-gate.cjs`), not the minimal fallback notice.
  timestamp: 2026-07-31T00:00:00Z

- hypothesis: the Phase 239 tool-name matcher was over-broad and caught a tool it should not have.
  evidence: `hooks/hooks.json:236`'s matcher `mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*`
  correctly identifies `brain_stats` as a Brain tool. The scoping is right; the defect is
  downstream in the classifier. Confirmed by 245-RESEARCH.md State of the Art.
  timestamp: 2026-07-31T00:00:00Z

## Evidence

- timestamp: 2026-07-31T00:00:00Z
  checked: `classify()` run live against 8 payload/tool combinations
  found:
    `brain_stats  {}` -> `{"verdict":"ambiguous","class":"unknown","reason":"neither proven move-set nor content hit"}`
    `brain_schema {}` -> `{"verdict":"ambiguous","class":"unknown","reason":"neither proven move-set nor content hit"}`
    `brain_stats  undefined` -> `{"verdict":"ambiguous","class":"unknown","reason":"non-object payload"}`
    `brain_ask {question:"lean startup methodology"}` -> `{"verdict":"allow","class":"move_set","reason":"generic methodology vocabulary handle"}`
  implication: the guard's risk ordering is INVERTED. A free-form call carrying a real user
  question is ALLOWED, while a zero-argument stats read that cannot possibly leak is BLOCKED.

- timestamp: 2026-07-31T00:00:00Z
  checked: `lib/core/brain-client.cjs:488` and `:575`
  found: both call sites pass a literal empty object: `callTool('brain_schema', {})` and
  `callTool('brain_stats', {})`.
  implication: the defect is reachable from shipped code on every Brain-enabled install, not only
  from a hand-crafted payload.

- timestamp: 2026-07-31T00:00:00Z
  checked: `scripts/part8-egress-guard-hook.cjs:179-202`
  found: `ambiguous` plus `brainAvailable()` calls `block()`, which writes to stderr and exits 2.
  implication: the classifier verdict IS the user-visible block. The chain is closed end to end.

## Technical Root Cause

- Site: `lib/core/part8-egress-guard.cjs:231-268` function `classify` (pre-fix line numbers), the
  terminal catch-all at the end of the function.
- Cause: `classify()` had three POSITIVE recognizers (the CONTENT-SET forbidden-pattern scan, the
  typed MOVE-SET packet shape, and the free-form vocabulary match for `brain_ask` / `brain_query`)
  and one terminal catch-all returning `ambiguous`. A contentless `{}` carries nothing for any of
  the three recognizers to match, so it fell to the catch-all. There was no recognizer for the
  case "this payload provably contains nothing".
- Why it surfaces now: it did not start now. It has been latent since Phase 196-03. It becomes
  visible whenever a Brain-available session calls a nullary Brain tool, which Phase 245's own
  work made routine.

## Verdict: over-firing, not correctly conservative

Requirement 5's acceptance criterion permits EITHER outcome - "`brain_stats` either passes cleanly
or its block is documented as intentional". The phase must be on record about which one it chose.

**This is (b): the guard was OVER-FIRING. It is not correctly conservative.**

The evidence is the guard's own inverted risk ordering, measured above: a free-form `brain_ask`
carrying an actual user question is ALLOWED, while a zero-argument metadata read is BLOCKED. A
correctly conservative guard cannot be more permissive toward the payload that carries user bytes
than toward the payload that carries none. The ordering is backwards, so the block on `{}` is a
false positive and not a defensible default.

The deeper point: "cannot prove it is safe" and "provably has nothing to leak" are normally
different claims, and the catch-all is right to treat the first as a block. An empty payload is
the single case where the two coincide. Zero bytes cannot carry user content. Recognizing that is
a NEW POSITIVE PROOF, not a weakened default.

## Required Code Changes

- Change 1:
  - Location: `lib/core/part8-egress-guard.cjs`, new function `_isProvablyEmptyPayload` plus one
    branch inside `classify`
  - Current behavior: a contentless `{}` falls to the terminal catch-all and returns `ambiguous`.
  - Required behavior: add `_isProvablyEmptyPayload(payload)` returning true ONLY for a plain
    object (`typeof === 'object'`, non-null, `!Array.isArray`) with `Object.keys(payload).length
    === 0`. Insert the branch AFTER the CONTENT-SET `scanForContent` block and BEFORE the
    `_looksLikePacket` block, returning
    `{ verdict: 'allow', class: 'empty_payload', reason: 'zero-key payload carries no bytes' }`.
  - Short-term patch: same as the long-term fix. There is no stopgap; the recognizer IS the fix.
  - Long-term fix: as above. Three invariants are non-negotiable and are stated in the code
    comment so a later reader cannot mistake this for a relaxation:
    1. The terminal catch-all stays byte-identical. Any payload carrying anything at all still
       returns `ambiguous`.
    2. `_isFreeFormTool` is NOT broadened (see section 5).
    3. `null` and `undefined` stay fail-closed via the existing `non-object payload` early
       return. A missing envelope field is a different claim from an explicitly empty object, and
       every shipped caller passes `{}` explicitly.
  - Ordering rationale: placing the recognizer AFTER `scanForContent` means the default-deny scan
    still runs first on every call, so no branch can precede default-deny. An empty object
    trivially clears that scan, so the ordering is safe by construction; keeping the scan first
    preserves the invariant rather than relying on it.
  - NOT changed: `scripts/part8-egress-guard-hook.cjs`. Its `ambiguous` -> `exit 2` translation
    and its fail-OPEN-on-internal-error posture (the Phase 239 accepted risk A3/T6, deliberately
    not flipped) both stay exactly as they are.

## Tests to Add or Update

- Test 1:
  - Type: unit + integration (both legs in one file)
  - Location: `tests/test-245-egress-contentless.cjs`
  - Given: the shipped classifier and the shipped hook
  - When: driven with contentless, content-carrying, and malformed payloads
  - Then:
    - unit leg: `{}` -> `allow` / `empty_payload` for `brain_stats`, `brain_schema`, and a
      non-Brain tool name (the recognizer is payload-shaped, not tool-scoped, asserted so the
      behavior is on record as deliberate); `undefined`, `null`, `[]`, `{a:1}`, `{question:''}`
      all stay `ambiguous`; a CONTENT-SET payload still `block` / `content_set`;
      `{question:'lean startup methodology'}` on `brain_ask` still `allow` / `move_set`;
      `_isFreeFormTool('...brain_search')` is still false.
    - hook leg: the hook is spawned as a child process with `PART8_FORCE_BRAIN_AVAILABLE=1`.
      Contentless -> exit 0 with NO Part 8 text on stderr. Content-carrying -> exit 2 with gate
      text. Ambiguous-but-non-empty -> exit 2 (proving the catch-all is untouched). Contentless
      with `PART8_FORCE_BRAIN_AVAILABLE=0` -> exit 0.
  - Runner registration: none needed. `tests/run-all-245.sh` discovers `tests/test-245-*` by glob.
- Test 2 (non-regression, existing files, unchanged):
  - `tests/part8-egress-guard-hook.test.cjs`, `tests/part8-leak-sweep-191.test.cjs`, and
    `tests/test-decide-part8-invariant.cjs` must all still exit 0. All three verified green.

## The brain_search finding (D-28): FLAGGED, block LEFT IN PLACE

`commands/pws-brain.md:100` documents a fallback: "If `brain_ask` errors, fall back ONCE to
`mcp__mindrian-brain__brain_search` and LABEL the fallback in the output." That fallback is
currently DEAD PROSE.

Why: `_isFreeFormTool` in `lib/core/part8-egress-guard.cjs` recognizes only `brain_ask` and
`brain_query`. `brain_search` is absent from it, so a `brain_search` call carrying
`{query: "..."}` matches no positive recognizer and always lands in the terminal catch-all, where
it returns `ambiguous` and the hook blocks it.

**This is NOT obviously a false positive, and that is the whole point of separating it from the
`brain_stats` case.** A search string IS real user content. It is exactly the class of bytes Canon
Part 8 exists to keep on the LOCAL side of the boundary. The block may well be CORRECT.

**Disposition: FLAGGED. The block is LEFT IN PLACE. `_isFreeFormTool` was NOT widened.**

Widening `_isFreeFormTool` is a real egress-surface change, not a bug fix, and it belongs behind
its own navigator decision rather than riding along inside a false-positive repair. Phase 245
declines it deliberately and says so here rather than resolving it silently in either direction.

Two downstream consequences a future reader needs to know:

1. `commands/pws-brain.md`'s documented `brain_ask` -> `brain_search` fallback cannot currently
   fire. The prose promises a behavior the runtime blocks. Either the guard widens (a navigator
   decision) or the doc is corrected. Both are out of scope here.
2. This is one of FOUR independent blockers (245-RESEARCH.md Example 2b) against ever sourcing the
   verb-to-`reach_id` affinity from a live Pinecone call. The other three: the SPEC's hot-path
   latency constraint, `brain_search`'s `pinecone_quota_exhausted` monthly embedding quota
   (`lib/core/brain-client.cjs:416-470`), and the wrong corpus. Phase 245 Plan 04 sources the
   affinity table from the LOCAL encoder at build time instead, which is unaffected by this.

## Classification of every finding

| # | Finding | Classification |
|---|---------|----------------|
| 1 | `brain_stats {}` blocked by the Part 8 guard | NEW FAILURE (fixed here) |
| 2 | `brain_schema {}` blocked identically | NEW FAILURE, same root cause (fixed here) |
| 3 | `brain_search` always reaches the catch-all and blocks | NEW FAILURE, FLAGGED, deliberately NOT fixed (see section above) |
| 4 | `pws-brain.md`'s documented `brain_search` fallback is unreachable | NEW FAILURE, documentation/runtime divergence, out of scope, follows finding 3 |
| 5 | The hook fails OPEN on an internal error | WORKING AS DESIGNED. Pre-existing accepted risk A3/T6, deliberately not flipped by Phase 239. Untouched here. |
| 6 | The Phase 239 `BRAIN_TOOL_MATCHER` scoping | WORKING. Correctly identifies both tools; the defect was downstream. |
| 7 | Brain-less installs never saw the block | WORKING AS DESIGNED (D-08a degrade path). |

## Gates cleared

1. **Canon Part 8 - the Graph Boundary.** The fix NARROWS what is ambiguous; it never widens what
   is allowed to carry content. The terminal catch-all is byte-unchanged and still returns
   `ambiguous` for every payload carrying anything at all. `_isFreeFormTool` is byte-unchanged.
   The recognizer requires `Object.keys(payload).length === 0`, so zero user bytes can cross
   through it by definition. `null`, `undefined` and `[]` all stay fail-closed. Canon Part 8
   itself (`docs/MINDRIAN-CANON.md`) is NOT reopened or modified by this phase. No user-specific
   bytes reach the Brain.
2. **Tri-Polar - the three surfaces.** The guard is a PreToolUse hook shared by CLI, Desktop and
   Cowork. There is no surface-specific code in `classify()` or in the hook. The fix therefore
   lands on all three at once, verified by construction rather than by three separate runs.
3. **Cross-platform.** The fix touches no process spawning, no paths, and no shell behavior. It
   is a pure in-process predicate over a JavaScript object. Correct on Windows, Mac and Linux by
   construction. The TEST spawns a child process, but it uses `process.execPath` and
   `path.join`, matching the shipped `tests/part8-egress-guard-hook.test.cjs` idiom.
4. **Release lockstep.** The fix ships inside Phase 245. No standalone release is cut by this
   RCA; the phase's own release follows the five-place lockstep via `scripts/release.sh`.
5. **No em-dashes.** This file, the code comments, the test file, and the commit messages all use
   hyphens. Verified: `grep -cP '\x{2014}'` returns 0 on
   `lib/core/part8-egress-guard.cjs`, `tests/test-245-egress-contentless.cjs`, and this file.
6. **Reuse before build (Canon Part 7).** No new command, skill, agent, or hook was added. The fix
   is one private function plus one branch inside an existing classifier, exported through the
   existing underscore-prefixed test-seam convention (`_safeAudit`, `_proveMoveSet`,
   `_looksLikePacket`, `_summaryLeavesAllHashed`, `_extractFreeFormString`, `_isFreeFormTool`).
   The test registers into the existing `tests/run-all-245.sh` glob with zero runner edits.

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the target v1.16.0-beta version noting that contentless
  Brain metadata reads no longer trigger the Part 8 gate.
- Canon: `docs/MINDRIAN-CANON.md` is deliberately NOT modified. The Canon Part 8 boundary is
  unchanged; only the classifier's recognizer set grew. `docs/CANON-PHASE-MAP.md` records Phase
  245's `canon_parts` declaration.
- Navigator decision needed (separate, out of scope): whether `_isFreeFormTool` should recognize
  `brain_search`, and if not, whether `commands/pws-brain.md:100`'s fallback instruction should be
  removed as dead prose.
- knowledge-base.md: add the summary block when this file moves to `.planning/debug/resolved/`.
- Room cross-file: `~/MindrianRooms/rethinking-mindrianos/research/` per the CLAUDE.md
  dev-research compositing rule (same finding, two homes, cross-linked).

## Resolution

root_cause: `lib/core/part8-egress-guard.cjs::classify()` had no positive recognizer for a
provably contentless payload, so a literal `{}` fell to the terminal catch-all and returned
`ambiguous`; `scripts/part8-egress-guard-hook.cjs` translates `ambiguous` plus `brainAvailable()`
into `exit 2`, which rendered the Part 8 F.1 leak-prevention gate on a call that carried zero
bytes.

fix: added `_isProvablyEmptyPayload(payload)` (plain object, non-array, zero own keys) and one
branch inside `classify()` placed AFTER the CONTENT-SET scan and BEFORE the packet check, which
returns `{ verdict: 'allow', class: 'empty_payload', reason: 'zero-key payload carries no bytes' }`.
The terminal catch-all and `_isFreeFormTool` are byte-unchanged. The hook is untouched.

verification:
  - `node tests/test-245-egress-contentless.cjs` -> exit 0, 41 assertions, both legs
  - `node tests/part8-egress-guard-hook.test.cjs` -> exit 0 (PB8-04/05/07/08 + T3 green)
  - `node tests/part8-leak-sweep-191.test.cjs` -> exit 0 (32 assertions)
  - `node tests/test-decide-part8-invariant.cjs` -> exit 0 (2 passed, 0 failed)
  - mutation proof: inverting the recognizer to `Object.keys(payload).length !== 0` makes
    `node tests/test-245-egress-contentless.cjs` exit 1; restoring makes it exit 0
  - `grep -cP '\x{2014}'` -> 0 on both changed source files
  - `git diff docs/MINDRIAN-CANON.md` -> empty

files_changed:
  - lib/core/part8-egress-guard.cjs (added `_isProvablyEmptyPayload` + one classify branch + export)
  - tests/test-245-egress-contentless.cjs (new: unit leg + hook leg)
  - .planning/debug/245-part8-contentless-block.md (this file)

commits: 4fb3ace9 (fix), 99a5f33a (test)
