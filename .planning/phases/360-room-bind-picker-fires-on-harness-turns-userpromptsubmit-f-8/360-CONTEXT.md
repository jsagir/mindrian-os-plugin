# Phase 360: Room-bind picker fires on harness turns (UserPromptSubmit F.8) - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**Mode:** `--auto` (single pass; every gray area auto-selected, the recommended option chosen, each choice logged in 360-DISCUSSION-LOG.md)

<domain>
## Phase Boundary

The UserPromptSubmit hook `scripts/intent-classifier.cjs` stops treating every turn as a human turn. When the
turn that triggered the hook is harness-originated (a peer message, a queued peer delivery, a task
notification or an idle notice), the room-resolution half of `main()` emits and writes nothing, and the
pending F.8 binding answer is not consumed. Human turns keep today's behavior byte for byte. The harness
verdict comes from the ONE classifier in `lib/hmi/turn-text.cjs` that 357-07 ships (D-07 as amended by R-A).
Target: in the four-session snapshot replay, harness-triggered picker fires go from 33 to 0 while
human-triggered fires stay at 2.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `360-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `360-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Gating the room-resolution half of `scripts/intent-classifier.cjs` `main()` on a harness verdict. That covers the F.8 binding gate (both headers), the zero-score no-match gate, the strict-mode override, and the legacy intent-mismatch advisory, with their side-channel and trace writes.
- Gating `consumePriorBindingAnswer` on the same verdict.
- Whatever minimal addition `lib/hmi/turn-text.cjs` needs so a UserPromptSubmit prompt can be classified with the 357 classifier, plus the two leading tags from requirement 5.
- Sanitized fixtures, a tripwire test, a fault-injection leg, and a local-only snapshot replay leg.
- A test runner for this phase (for example `tests/run-all-360.sh`).

**Out of scope (from SPEC.md):**
- 357's Stop-hook fixes (`check-card-fire.cjs` harness guard, F.1 dial-chrome strip). 357 owns them and 360 depends on them.
- Phase 359's missed forks. That is a separate phase.
- The intent-classifier's F.1 reach minting policy (NAV / engine block, `sensor-room-pick.cjs` F.1 room chooser). The engine NAV block keeps running on harness turns in this phase.
- Suppressing re-fires on HUMAN turns after a declined or ignored card, or after a "dev repo / no room" answer that was never persisted (the unbound fire-every-human-turn policy, T-dia-02 comment at :683). Candidate follow-on.
- Auto-continuation turns (`origin.kind:'auto-continuation'`). 1 run, 0 fires. Researcher may propose as a follow-on.
- Stop-hook feedback meta records. None triggered this path in the snapshot.
- Desktop/Cowork behavior changes. No UserPromptSubmit hook on those surfaces (requirement 9).

</spec_lock>

<decisions>
## Implementation Decisions

### Input source for the verdict (A1-A3 are open for the researcher)
- **D-01:** The verdict is computed from the hook's stdin payload, parsed once. `intent-classifier.cjs` hands the
  parsed payload (or `STDIN_RAW`) to ONE new export in `lib/hmi/turn-text.cjs` (working name
  `classifyUserPromptPayload(payload, opts)`, returning `'harness'` or a non-harness class). All reading of
  `prompt`, `isMeta`, `origin`, and `transcript_path` happens inside turn-text. `intent-classifier.cjs` never
  reads `isMeta` or `origin` itself (R4 tripwire).
- **D-02:** The new export does not carry its own rule body. It normalizes the payload into `(content, rec)` and
  calls `classifyPrecedingUserContentSource(content, rec)` from 357-07, so the Stop hook and the
  UserPromptSubmit hook share one rule body and one `HARNESS_LEADS` list. When stdin carries no `origin` or
  `isMeta` (the expected A1 answer), `rec.originKind` is `undefined`, so R-A's rule "origin not human AND the
  prompt leads with a harness tag" reduces to a lead-only verdict. The human path costs one `trimStart` plus a
  few `startsWith` calls and zero file reads.
- **D-03:** If A1 shows the stdin payload DOES carry `origin` / `isMeta`, use those fields directly and drop the
  transcript read in D-04 entirely.
- **D-04:** If stdin has no origin: do a bounded tail read of `transcript_path` (last 64 KB at most) ONLY when the
  prompt already leads with a harness tag, or when stdin says `isMeta:true`. The human path with no harness lead
  never touches the transcript (SPEC hook-budget constraint). The tail read can only VETO (never add) a harness
  verdict:
  - If it finds the triggering record with `origin.kind === 'human'` (a human pasted a tag as the lead), the
    verdict is non-harness.
  - For an `isMeta` payload with no harness lead, the R-A carve-out applies: harness only if the previous user
    record is not human-upstream. If the previous record cannot be read, the verdict is non-harness (fail toward
    human).
  - If the record is not in the transcript yet (A3 negative), or the read fails, the lead-only verdict from D-02
    stands. "Origin unknown" is not a fault under R6. A thrown exception is (D-06).
  - The researcher decides from A1-A3 evidence whether D-04 is needed at all. The SPEC allows lead-only if the
    R8 carve-out fixture still passes, and it does by construction, because a Skill body or image record does
    not lead with a harness tag.
- **D-05:** Raw prompt form (A2): the lead list must cover BOTH forms the snapshot shows for peers: the stored
  framing `Another Claude session sent a message:` and the raw queued tags `<agent-message from=` /
  `<cross-session-message from=`. Whichever form the hook actually receives, it is covered (R5).

### Where the guard sits in `main()`
- **D-06:** Compute the verdict once, at module init next to `STDIN_MESSAGE` / `STDIN_SESSION_ID`:
  `const TURN_IS_HARNESS = harnessVerdict(STDIN_RAW)`. The helper lazy-requires turn-text inside try/catch and
  returns `true` only when the export returns exactly `'harness'`. Any missing module, throw, or unrecognized
  shape returns `false` (R6, PSB-06 never-block).
- **D-07:** Use a single early guard, not per-emitter guards. At the top of `main()`, directly after
  `if (!message) return 0;`, add `if (TURN_IS_HARNESS) return 0;`. This sits before the strict-mode override,
  the zero-score gate, the F.8 binding gate and the legacy advisory, so all four outputs and their side writes
  (`recordReachedGate`, `binding_gate` / `zero_score_gate` trace payloads, offered markers) are skipped by one
  line. The planner must confirm that `main()` (:477 to about :750) holds only room-resolution work, so nothing
  outside R1 is skipped. If anything else lives there, it moves to the guard's far side or is recorded as a
  deviation.
- **D-08:** Add a second guard at the answer consumer only: wrap the `consumePriorBindingAnswer(roomDir,
  sessionId, STDIN_MESSAGE)` call (:3575) in `if (!TURN_IS_HARNESS)`. The pending `binding_gate_payload` stays
  unconsumed for the next human turn (R2).
- **D-09:** Leave these untouched on harness turns (SPEC out of scope): `consumePriorF1Pick`, the engine NAV
  block (`emitEngineDecisionBlock`), and `injectGraphFindings`. Their harness-turn behavior is a deferred item
  (see below).

### R5 tag re-add and compatibility with 357's replay
- **D-10:** 360 owns the edit that adds `<agent-message` and `<cross-session-message` to the ONE `HARNESS_LEADS`
  in `lib/hmi/turn-text.cjs`. It lands after 357-07 is on `main`, in 360's own commit, and the commit message
  cites R5 and the 15 queued-peer runs. If 357-07's measured peer-prefix step did not add
  `Another Claude session sent a message:`, 360 adds it in the same edit. `[Cross-session idle notice]` and
  `<task-notification` are already in the list from 357-07. Every match is a structural leading-tag
  `startsWith` on the trimmed text, never on meaning.
- **D-11:** On the Stop path the lead rule is origin-gated (origin not human), and both tags have 0 stored
  occurrences as user text (357 Finding 4), so Stop-path verdicts should be unchanged. Proof is the replay, not
  the argument: `tests/run-all-357.sh` (replay leg with `--baseline compare`) must stay green, with 0
  pass->block flips, 0 new misses and 0 human-upstream flips. If a 357 test pins the ABSENCE of these two tags
  (357-07's acceptance grep is plan-time only, not a standing leg), 360 updates that leg in the same commit
  and cites R5. It never forks the list.
- **D-12:** A human prompt that quotes a tag mid-text stays non-harness, because only the lead is checked.
  A unit leg pins this.

### Fixtures, tests and tripwires
- **D-13:** Fixtures follow 357's `tests/fixtures/card-fire-replay/` conventions: one JSON file,
  `tests/fixtures/ups-harness-360/cases.json`, with a top-level `meta` block (`schema_version`, `source:
  "authored"`, and a `sanitization_statement` in the style of `tests/fixtures/card-fire-corpus-238.json` /
  the 357 corpus meta) and an `entries` array. Each entry is `{id, shape, stdin: {prompt, session_id,
  transcript_path?}, transcript_records?, expect: "suppress" | "fire"}`. The session id, room names and peer
  names are placeholders (`sample-session-a`, `sample-room`, `sample-peer`).
- **D-14:** Entries: 5 harness shapes (task-notification, queued `<cross-session-message from=`, queued
  `<agent-message from=`, stored peer framing, idle notice), 1 carve-out (a Skill-body meta record right after a
  human prompt, in transcript mode, expect fire), 2 human controls (direct, and queued with `origin.kind:
  'human'`), 1 mid-text quote (expect fire), and 1 pasted-lead with human origin (expect fire). The last one
  applies only if D-03 or D-04 can see origin. Otherwise it is recorded as an accepted limit with 0 observed
  cases.
- **D-15:** Test files:
  - `tests/test-360-harness-picker.cjs`: R1 including the human control leg, R2 seeded pending payload then a
    human follow-up that binds, R3 byte-identical leg, and R6 fault injection. It uses the existing
    `spawnSync(process.execPath, [CLASSIFIER], {input, env: {MINDRIAN_ROOMS_HOME, ...}})` pattern from
    `tests/test-260917-binding-gate-offscope.cjs`, with temp homes in mkdtemp.
  - `tests/test-360-leads.cjs`: the 5 R5 lead legs plus the mid-text negative, run against the turn-text
    export directly.
  - `tests/test-360-tripwire.cjs`: R4 (no harness lead literal and no `isMeta` comparison in
    `scripts/intent-classifier.cjs`, and the list defined in exactly one file under `lib/` + `scripts/`) and R9
    (`git diff --name-only $PLAN_BASE..HEAD` has no `lib/mcp/` path).
  - `tests/test-360-snapshot-replay.cjs`: R7, local-only, reading `~/.cache/mindrian-dev/357-raw/` after
    `sha256sum -c SHA256SUMS`. It prints harness and human fire counts, exits non-zero unless the result is
    harness 0 and human 2, and SKIPs with a stated reason when the snapshot is absent. Its output is booleans,
    counts and leading tags only.
  - `tests/run-all-360.sh`: runs all of the above, then `tests/run-all-357.sh`, then the six R3 suites with a
    count compare.
- **D-16:** R6 fault injection uses a `--require` preload stub in the spawned child that makes the turn-text
  export throw. There is no production env seam. If the planner finds the preload cannot intercept the lazy
  require, an env seam in the same style as the existing `navTestThrowing` seams is the fallback, and the
  planner records why.
- **D-17:** R3 byte-identical leg: run the human-origin fixture against a `git archive` of `PLAN_BASE` (357's
  `--code-root` pattern) and against HEAD in the same temp home, and compare stdout bytes. The R3 suite
  baseline (pass/fail counts of `test-209-primary-sidechannel`, `test-209-engine-arm-contract`,
  `test-225-answer-narrowing`, `test-260917-binding-gate-offscope`, `test-251-skeleton-split`, and
  `lib/memory/userpromptsubmit-integration.test.cjs`) is recorded in the first plan's SUMMARY before any code
  change. Known reds stay known (357 R-J precedent) and are not fixed here.

### Tri-Polar
- **D-18:** The defect is CLI-only because it needs a UserPromptSubmit hook. Desktop and Cowork bind through
  MCP `room_list` -> `room_bind` and `gate_render` with `kind:'binding'`, which have no harness-turn injection.
  No `lib/mcp/` file changes. The existing MCP room-bind tests run unchanged in `run-all-360.sh`:
  `tests/test-248-room-bind-honest-return.cjs`, `tests/test-248-room-bind-session-authoritative.cjs`,
  `tests/test-room-bind-health-signal.cjs`, and `tests/test-room-bind-stdio-session-fallback.cjs`. The Stop
  side is already Tri-Polar through 357's shared `classifyCardFire`.

### Sequencing and coordination
- **D-19:** Execution is gated on 357-07 being on `main`. The first plan task checks that `lib/hmi/turn-text.cjs`
  exports `HARNESS_LEADS` and that `classifyPrecedingUserContentSource` returns `'harness'` for a peer-shaped
  rec, and that `tests/run-all-357.sh` exists. It HALTS if any check fails. If 357-07's shipped API differs
  from the plan, 360 adapts to it and does not fork it.
- **D-20:** Parallel-session rules follow 357-07: record `PLAN_BASE`, use explicit-path commits
  (`git commit --only -- <paths>`), and run `git status --short -- <file>` before each edit, stopping on a peer
  diff. The 357-07 never-edit list applies. Never write STATE.md while a peer session owns it. No em-dashes.

### Claude's Discretion
- The exact export name and signature of the turn-text entry point (D-01), as long as it has one rule body.
- The tail-read byte bound (64 KB suggested) and how the triggering record is matched in the tail (by exact
  prompt text equality on the last user record is the suggested method).
- Whether R7's replay is a test file or a `scripts/` dev tool invoked by the test.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 360 locked scope
- `.planning/phases/360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8/360-SPEC.md` - Locked requirements. MUST read before planning.

### The shared harness classifier (357)
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-CONTEXT.md` - D-07 and `<post_research_rulings>` R-A (the V3 carve-out and the tag list), R-D (snapshot location), R-I (`--code-root`), R-J (known reds)
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-07-PLAN.md` - Task 1: the `HARNESS_LEADS` and `classifyPrecedingUserContentSource(content, rec)` shape 360 reuses, and the peer-prefix measurement step
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-RESEARCH.md` - Finding 3 (this picker minted the anchor false block), Finding 4 (lead-tag table, 0 stored `<agent-message` / `<cross-session-message`), Pattern 4 (rule order)
- `lib/hmi/turn-text.cjs` - `classifyPrecedingUserContentSource` (:115 before 357-07), the home of the one tag list

### Emitter
- `scripts/intent-classifier.cjs` - `extractMessage` :340, `extractSessionId` :378, `STDIN_RAW` / `STDIN_MESSAGE` :406-411, `main()` :477, T-dia-02 dedupe :683, `emitBindingGate` call :691, `emitBindingGate` :2844, `bindingGateAlreadyOffered` :3101, `emitNoMatchGate` :3149, `consumePriorBindingAnswer` :3293 (call :3575), entry block :3511
- `hooks/hooks.json` :361 - the UserPromptSubmit registration via `hooks/run-hook.cmd intent-classifier`
- `.planning/debug/resolved/room-bind-gate-fires-on-notification-only-turns.md` - the prior RCA (Stop side only)

### Test patterns and fixtures
- `tests/test-260917-binding-gate-offscope.cjs` - spawnSync classifier harness with `MINDRIAN_ROOMS_HOME`
- `tests/test-209-primary-sidechannel.cjs` - F.8 header literal (:668), Behavior 14 (1-arg contract)
- `tests/fixtures/card-fire-corpus-238.json` - the `sanitization_statement` style
- `tests/fixtures/card-fire-replay/` and `tests/run-all-357.sh` - 357 conventions (created by 357-01/-09; not on disk at discuss time)

### Project rules
- `CLAUDE.md` - Tri-Polar Design Rule, Canon Part 8, GSD enforcement, no em-dashes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extractMessage` already parses the stdin JSON. The payload object can be handed to turn-text without a second parse (for example, by returning it from a small shared parse helper).
- `classifyPrecedingUserContentSource(content, rec)` from 357-07: one rule body, R-A ordered, with backward-compatible 1-arg calls.
- 357's `replay-card-fire.cjs --code-root` pattern for pre-phase comparisons.

### Established Patterns
- Module-init stdin read (`STDIN_RAW`), so the verdict can be a module constant used by both `main()` and the entry block.
- Every hook helper is fire-and-forget in try/catch (PSB-06 never-block). The harness helper follows the same pattern.
- Fail toward today's behavior on uncertainty (357 D-07: only a confirmed harness flag or tag bypasses).

### Integration Points
- `main()` top guard (D-07) and the `consumePriorBindingAnswer` call site (D-08). Nothing else in intent-classifier changes.
- `lib/hmi/turn-text.cjs`: the new export plus the two tags (D-01, D-10).

</code_context>

<specifics>
## Specific Ideas

- The anchor case (357 Finding 3, session 56924067 08:50:45) must be represented by the stored-peer fixture shape. It is the upstream minter of the live false block, so 360 closes the source that 357 cleans up at Stop.
- "Most token-effective and deterministic" (357 navigator rule) is the selection rule for any planning fork: one module constant, two guards, one shared list.

</specifics>

<deferred>
## Deferred Ideas

- **Fire-every-human-turn policy for unbound sessions** (T-dia-02 comment :683). A declined or ignored card re-fires on every scoring human turn. This is a product decision with its own suites and a candidate follow-on phase.
- **Dev-repo / no-room suppression.** A "dev repo, no room" answer that is never persisted keeps the picker alive in dev sessions. It pairs with the item above.
- **Harness-turn behavior of `consumePriorF1Pick`, the NAV engine block and `injectGraphFindings`.** The same answer-hijack class as R2, but for F.1. It belongs with 357's deferred "intent-classifier mints F.1 reaches unrelated to the turn".
- **Auto-continuation turns** (`origin.kind:'auto-continuation'`). 1 run, 0 fires. Possible follow-on.
- **Stop-hook feedback meta records at UserPromptSubmit.** Not observed. Revisit only if the replay shows one.

</deferred>

---

*Phase: 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8*
*Context gathered: 2026-09-23*
