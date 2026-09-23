# Phase 357: Gate-triad replay harness (Jev as dev-time teacher, deterministic runtime) - Context

**Gathered:** 2026-09-23 (`/gsd-discuss-phase 357 --auto`; every choice is a recommended default and is logged
in 357-DISCUSSION-LOG.md)
**Status:** Ready for planning. EXECUTION IS HELD until Phase 354 completes (see D-15).

<domain>
## Phase Boundary

This phase delivers a labeled replay corpus plus a replay harness that runs Stop events through the real card
gate (the CLI hook and the MCP `stop_gate_check`). It also delivers the smallest deterministic fix that brings
false blocks to 0 with no new misses, and a Larry gate-prose shrink that happens only if that fix meets the
bar. Jev is used only at dev time, to label the synthetic and sanitized fixtures. There is no runtime ledger
and no runtime vendor call.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**7 requirements are locked.** See `357-SPEC.md` for the full requirements, boundaries and acceptance criteria.

Downstream agents MUST read `357-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- The replay corpus (4 sources) and its loader test
- `scripts/replay-card-fire.cjs` (CLI and MCP surfaces)
- A dev-only Jev labeler for the synthetic and sanitized entries, using the shared client and allow-list
- The minimal deterministic fix in `check-card-fire.cjs` / `gate-relevance.cjs` needed to meet the bar
- The metric-gated shrink of the 3 card-rule prose spans
- Adding the replay to the standing test suite

**Out of scope (from SPEC.md):**
- A runtime Jev-scored ledger (`data/gate-triad-ledger.json`)
- Any runtime or hook Jev call
- Sending dogfood or user text to Jev
- The other 13 Larry per-turn judgments
- Catching prose forks with 0 extractable labels (these are recorded as known misses)
- intent-classifier's stale-reach minting (it is covered in the corpus; split out if the fix can't absorb it)
- The session-bind room-picker gate's firing policy
- Rebuilding the shared Jev client if another phase has already extracted it

</spec_lock>

<decisions>
## Implementation Decisions

### Root cause of the triggering false block (established during discuss, drives D-07)

The 2026-09-23 block (`~/.mindrian/card-fire-intercepts.log`, session 56924067, verdict
`reached-registry-gate-no-card`, empty gate_signature) happened like this:

- **What the preceding record was:** the record right before the blocked turn was a subagent hand-back
  (`<agent-message from=...>`). Claude Code writes this as a `role:user` record with `isMeta: true` and a
  real text block.
- **How it was misread:** `lib/hmi/turn-text.cjs::classifyPrecedingUserContentSource` (about :115-137)
  returns `'typed'` for any text block. `check-card-fire.cjs:1333-1334` already admits this: "a background
  task-notification carrying a real text block classifies as 'typed' and falls straight through".
- **Why the block followed:** the `preceding-turn-synthetic-no-user-engagement` guard (:683) never fired.
  Relevance was then decided by incidental token overlap between the agent report and the recorded F.1
  subject (a fleet census). That overlap satisfied `gateTopicallyRelevant`, so the turn was force-blocked.

In short, a harness message was treated as a human turn.

### Replay corpus format
- **D-01:** Corpus layout:
  - `tests/fixtures/card-fire-replay/` holds one JSON file per source: `debug-cases.json`,
    `live-2026-09-23.json` and `dogfood.json`, each with a `meta` block carrying `sanitization_statement`.
  - Source (a) is NOT copied. The loader reads `tests/fixtures/card-fire-corpus-238.json` in place through
    an adapter, because existing tests import that file and a copy would drift.
- **D-02:** Entry shape: `{id, source: '238'|'debug'|'live'|'dogfood', envelope: {...}, expected_verdict_class:
  'block'|'pass', expected_reason?, label_origin: 'hand'|'jev'|'local'|'human', why, known_miss?: {reason}}`.
  - `envelope` holds exactly the direct fields `deriveTurnSignals` already accepts (`ran_entries`,
    `output_text`, `preceding_user_text`, `preceding_user_text_source`, `gate_subject_text`,
    `reach_corroborated`, `sidechannel_health`, `gate_is_fresh`, plus the new `preceding_user_is_meta`
    from D-07).
  - No new seam is invented.
- **D-03:** The baseline is `tests/fixtures/card-fire-replay/baseline.json`, written by
  `replay-card-fire.cjs --baseline write` against the pre-phase commit and committed. `new_misses` means any
  entry that blocked in the baseline, is labeled `block`, and passes after the change.

### Dogfood extraction (Part 8: local only)
- **D-04:** A dev-only `scripts/extract-dogfood-stop-events.cjs` builds candidate envelopes locally from:
  - Jonathan's own MindrianOS dev-session transcripts (`~/.claude/projects/*/*.jsonl`)
  - `~/.mindrian/card-fire-intercepts.log`

  The researcher must verify whether transcripts carry the hook `additionalContext`, which holds the NAV block
  and the reach subject. If they don't, `ran_entries` and `gate_subject_text` for non-intercepted turns get
  reconstructed from the intercept log and the side channel where available. Where they can't be, the entry
  is marked `envelope_partial` and excluded from the metric.
- **D-05:** Sanitization before commit:
  - Third-party names, room content and venture specifics are replaced with placeholders. Only the structural
    shape is kept (same rule as the 238 corpus meta).
  - Raw extracts live only in the gitignored scratch path until sanitized.
  - Dogfood text never goes to Jev.
- **D-06:** Dogfood labels:
  - Claude proposes each label locally, with `label_origin: local`.
  - The navigator ratifies them in one review sheet, `357-DOGFOOD-LABELS.md` (a table of id, one-line gist,
    proposed verdict and why), and each confirmed row is flipped to `human`.
  - This review is the phase's single human checkpoint and is non-autonomous.

### Minimal deterministic runtime fix
- **D-07 (primary fix, root-caused):** treat a harness-originated preceding record as synthetic, not typed.
  - `turn-text.cjs` threads the record's `isMeta` flag through.
  - `classifyPrecedingUserContentSource` returns a new source class `'harness'` when the record has
    `isMeta: true`, OR when its text begins with a known harness envelope tag: `<task-notification>`,
    `<agent-message`, `<cross-session-message`, `[SYSTEM NOTIFICATION`.
  - `check-card-fire.cjs:683` treats `'harness'` exactly like `'tool_result'` (verdict
    `preceding-turn-synthetic-no-user-engagement`).
  - The match is structural, on the flag or the leading tag only, never on meaning.
  - Fix the stale comment at :1333-1334.
- **D-08:** Nothing is added beyond D-07 unless the replay shows a remaining false block. Each additional
  change must cite the corpus entry id it fixes.
  - Do NOT add a rule of the form "primary arm + 0 option labels -> pass". The primary arm exists precisely
    to catch a model that ignored a reached gate and rendered nothing, so that rule would create new misses.
  - Do NOT touch the backstop regex tuning pinned by the 238 corpus.
- **D-09:** The relevance and answered heuristics (`gate-relevance.cjs`) stay as they are unless the replay
  names a failing entry. Jev labels decide what the correct verdict is. They never become runtime code.

### Dev-time Jev labeler
- **D-10:** `scripts/label-card-fire-replay.cjs`:
  - It imports `scripts/jev-devtime-client.cjs`, following 356-CONTEXT D-06/D-07. Whichever of 354-17 / 356
    / 357 executes first extracts it from `build-section-command-ledger.cjs` with re-exports; the others
    import it.
  - It adds its own egress profile `card_fire_replay` (per D-08 of 356: one guard file, one profile each,
    never a union, refuse and never strip). The profile allows exactly these state keys, each with a string
    cap:
    - `output_text`
    - `preceding_user_text`
    - `gate_subject_text`
    - `gate_shape`
    - `turns_since_gate`
    - `policy`
  - The `policy` value must equal the policy file byte for byte.
- **D-11:** Before it builds any request, the labeler refuses any entry whose `source === 'dogfood'` or which
  lacks `meta.sanitization_statement`. With no key it degrades to `unlabeled`, exit 0.
  `label-card-fire-replay` is added to the tripwire leg that bans ledger builders from `hooks/`.
- **D-12:** The policy file is `data/jev-policies/card-fire-replay.json`
  (`{policy_id, version, instructions, criteria[], boundary_cases[]}`, the 356 shape). The three questions
  are:
  - is-fork
  - already-answered
  - relevant

  Each is an independent Noul with the full policy stated. They are never compared to each other, and no
  Choice or Noul confidence is mixed. Mapping:
  - Noul >= 0.80 means yes.
  - Noul <= 0.20 means no.
  - Anything else is `uncertain`, which goes to the navigator.

  Output goes to `357-JEV-LABEL-REPORT.md`. Disagreements with the hand labels are listed for a ruling and
  never auto-applied. These thresholds are starting values; the labeled fixture itself may revise them
  (356's lesson: don't borrow 004's 0.90).

### Replay harness and surfaces
- **D-13:** `scripts/replay-card-fire.cjs [--surface cli|mcp|both] [--baseline write|compare] [--json]`.
  - The CLI surface calls `deriveTurnSignals(envelope)` then `classifyCardFire`.
  - The MCP surface calls `lib/mcp/stop-gate-handler.cjs::handleStopEvent`.
  - It runs under a temp `MINDRIAN_HOME` with no bound room and cleared retry counters per entry, so neither
    the room close-out nor the session counters can leak between entries.
  - It makes zero network calls. A test stubs `fetch` to throw.
  - The exit code is non-zero on `false_blocks > 0 || new_misses > 0`.
- **D-14:** `tests/test-357-replay.cjs` runs `--surface both --baseline compare` and asserts CLI and MCP
  parity (ignoring `dedup-already-fired-this-session`). It is wired into `tests/run-all-357.sh` and the
  existing card-fire suite runner, so it becomes the standing gate.

### Sequencing and coordination
- **D-15:** Execution waits for Phase 354 to complete. jsagi-25 pings on done or halt, and a disk watch runs
  as well. No 354 plan touches 357's files (verified 2026-09-23). Do not edit the uncommitted, unowned diffs:
  `eval-icm-writers.cjs`, the test-353 tests, `navigation.cjs`, `docs/OPEN-HANDOFFS.md`.
- **D-16:** The Larry prose shrink (R6) is anchored on section headers, not line numbers:
  - Edit targets:
    - the `agents/larry-extended.md` section "## Decision Gates -- fire the card, never draw the box
      (SEED-021)"
    - the two SKILL spans: the never-hand-draw rule, about :216, and the honest-residual card-fire note,
      about :244
  - These must stay:
    - fire the card on a genuine unanswered, relevant fork
    - never draw the ASCII box
    - the FIRE-IF-FORK trailer is judgment-gated
    - "type a/b/c" is used only on a surface that can't fire the tool
  - The "Post-Gate Handoff" section is NOT touched. It keeps "runChain halts at the first MATERIAL step,
    material = not autonomous_safe" verbatim, per jsagi-a7 / 356, and `tests/test-larry-handoff-seam.cjs`
    stays green.
  - The user-level copy `~/.claude/agents/larry-extended.md` is out of scope.
- **D-17:** Dual filing, per CLAUDE.md "Dev-Research Compositing": the reasoning trail goes into
  `~/MindrianRooms/rethinking-mindrianos/research/<dated>/` and is mirrored to `mindrianOS/research/`,
  cross-linked to this CONTEXT.

### Claude's Discretion
- Internal module layout of the replay and extractor scripts, and fixture ids and naming.
- Whether `extractOptionLabels` output is recorded per entry for diagnostics.
- Test split across files, as long as D-14's standing gate exists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked scope
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-SPEC.md` - locked
  requirements. MUST read before planning.
- `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/357-BRIEF.md` - the
  original direction. Superseded by SPEC where they conflict (no runtime ledger).

### Gate code under change
- `scripts/check-card-fire.cjs` - `classifyCardFire` :523, `deriveTurnSignals` :1482, the synthetic-source
  guard :683, the stale comment :1333, `buildEnforcementEnvelope` :788, `main` :1669
- `lib/hmi/turn-text.cjs` - `classifyPrecedingUserContentSource` about :115, `readTranscriptTurn` consumers
- `lib/core/gate-relevance.cjs` - `gateTopicallyRelevant` :309, `gateAlreadyAnswered` :267,
  `extractOptionLabels` :200
- `lib/mcp/stop-gate-handler.cjs` - `handleStopEvent` :464/:489 (MCP surface); `lib/mcp/tools/stop-gate.cjs`

### Fixtures and tests to reuse
- `tests/fixtures/card-fire-corpus-238.json` - source (a) and the sanitization_statement precedent
- `tests/test-209-primary-sidechannel.cjs`, `tests/test-card-fire-relevance-gate.cjs`,
  `tests/test-ga4-card-fire-e2e-179.cjs`, `tests/test-238-card-fire-corpus.cjs`,
  `tests/test-198-stop-gate-retry-ceiling.test.cjs` - regression legs to preserve
- `tests/test-353-tripwires.cjs` - the no-vendor-under-lib/hooks tripwire (extend, don't weaken)
- `tests/test-larry-handoff-seam.cjs` - must stay green (D-16)

### Debug history (source (b))
- `.planning/debug/resolved/backstop-benign-list-defeats-relevance-gate.md`,
  `card-fire-answered-gate-refires-within-ttl-window.md`, `card-fire-block-surface.md`,
  `card-fire-over-enforcement.md`, `card-fire-relevance-check-gap.md`,
  `card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance.md`,
  `stop-hook-fires-card-on-option-shaped-prose-sentence.md`,
  `room-bind-gate-fires-on-notification-only-turns.md`, `intern-w1-card-discipline-decay.md`,
  `reach-gate-stale-turn-input.md`

### Jev (dev-time only)
- `.claude/skills/spike-findings-MindrianOS-Plugin/SKILL.md` and `references/jev-typed-decisions-api.md`,
  `references/policy-execution-parity.md` - API contract, measured latency and cost, and stated-policy parity
- `.planning/phases/356-*/356-CONTEXT.md` D-06..D-09 - the shared `jev-devtime-client.cjs` interface and
  per-profile egress guard
- `.planning/phases/355-*/355-BRIEF.md` - Noul vs Choice are not comparable
- `scripts/build-section-command-ledger.cjs` - `assertEgressCeiling` :90, key loading, the extraction source
- `CLAUDE.md` Canon Part 8, and the 2026-09-17 IP-egress and dependency rulings (recorded in the spike-findings
  skill)

### Prose targets
- `agents/larry-extended.md` - "Decision Gates" section (shrink); "Post-Gate Handoff" (do not touch)
- `skills/larry-personality/SKILL.md` - card-rule spans about :216 and about :244

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The `deriveTurnSignals` direct-field envelope: this is the replay seam, so no new injection point is needed.
- The `card-fire-corpus-238.json` format and sanitization meta: the template for new fixture files.
- The `build-section-command-ledger.cjs` fetch, egress and pool code: the extraction source for the shared
  client.
- `~/.mindrian/card-fire-intercepts.log`: real verdicts with `ran_entries` and `output_text`, used for
  dogfood seeding.

### Established Patterns
- Every card-fire change so far shipped a regression leg per RCA. 357 generalizes that into one corpus plus a
  baseline.
- Fail-toward-card on uncertainty in `gate-relevance.cjs`. D-07 keeps this: only a confirmed harness flag or
  tag bypasses the check.
- Dev-time-only vendor code lives under `scripts/`, with tripwires banning it from `lib/` and `hooks/`.

### Integration Points
- `turn-text.cjs` -> `check-card-fire.cjs` `deriveTurnSignals` -> `classifyCardFire` (CLI Stop hook)
- `stop-gate-handler.cjs` -> the same classifier (MCP; Desktop/Cowork)
- `tests/run-all-357.sh` plus the existing card-fire suite runner

</code_context>

<specifics>
## Specific Ideas

- The live false block from this session's own history is the anchor fixture (source (c)). The replay on the
  pre-phase code must reproduce it as FALSE_BLOCK. This is the "e2e" proof the navigator asked for.
- "Most token-effective and deterministic" (navigator, round 1) is the selection rule for any fork during
  planning. Prefer the change that removes a regenerated turn and keeps runtime pure code.

</specifics>

<deferred>
## Deferred Ideas

- **The UserPromptSubmit room-bind picker fires on harness turns.** The F.8 room-picker was re-injected on
  agent-message and cross-session-message turns all through this session. It is the same "harness record read
  as a human turn" class as D-07, but a different hook (session-start / UserPromptSubmit). Candidate
  follow-on, which may reuse D-07's `'harness'` classifier.
- **The intent-classifier mints F.1 reaches unrelated to the turn** (the fleet-census and decide-pursue
  reaches injected into this dev session). This is the upstream cause and belongs in its own phase.
- **The other 13 Larry per-turn judgments** (glyph/move, dial, problem type, elevation, escape hatch...) use
  the same teacher/student pattern. The follow-on phase(s) come after 357 proves the replay approach.
- **Prose forks with 0 extractable labels (intern-w1):** a known miss, since they need text understanding.

</deferred>

---

*Phase: 357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re*
*Context gathered: 2026-09-23*
