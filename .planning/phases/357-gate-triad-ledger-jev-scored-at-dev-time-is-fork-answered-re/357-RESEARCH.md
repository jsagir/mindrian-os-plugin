# Phase 357: Gate-triad replay harness (Jev as dev-time teacher, deterministic runtime) - Research

**Researched:** 2026-09-23
**Domain:** Stop-hook card gate (`scripts/check-card-fire.cjs`, `lib/core/gate-relevance.cjs`, `lib/hmi/turn-text.cjs`, `lib/mcp/stop-gate-handler.cjs`), Claude Code transcript format, dev-time Jev labeling
**Confidence:** HIGH on code paths and transcript shapes (measured against disk in this session); MEDIUM on the D-08a fix direction (measured on 2 live cases); LOW on nothing load-bearing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(Copied from `357-CONTEXT.md` `<decisions>`, current as of 2026-09-23 including D-08a and the Noul criteria amendment.)

#### Root cause of the triggering false block (established during discuss, drives D-07)

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

#### Replay corpus format
- **D-01:** Corpus layout: `tests/fixtures/card-fire-replay/` holds one JSON file per source: `debug-cases.json`, `live-2026-09-23.json` and `dogfood.json`, each with a `meta` block carrying `sanitization_statement`. Source (a) is NOT copied. The loader reads `tests/fixtures/card-fire-corpus-238.json` in place through an adapter, because existing tests import that file and a copy would drift.
- **D-02:** Entry shape: `{id, source: '238'|'debug'|'live'|'dogfood', envelope: {...}, expected_verdict_class: 'block'|'pass', expected_reason?, label_origin: 'hand'|'jev'|'local'|'human', why, known_miss?: {reason}}`. `envelope` holds exactly the direct fields `deriveTurnSignals` already accepts (`ran_entries`, `output_text`, `preceding_user_text`, `preceding_user_text_source`, `gate_subject_text`, `reach_corroborated`, `sidechannel_health`, `gate_is_fresh`, plus the new `preceding_user_is_meta` from D-07). No new seam is invented.
- **D-03:** The baseline is `tests/fixtures/card-fire-replay/baseline.json`, written by `replay-card-fire.cjs --baseline write` against the pre-phase commit and committed. `new_misses` means any entry that blocked in the baseline, is labeled `block`, and passes after the change.

#### Dogfood extraction (Part 8: local only)
- **D-04:** A dev-only `scripts/extract-dogfood-stop-events.cjs` builds candidate envelopes locally from Jonathan's own MindrianOS dev-session transcripts (`~/.claude/projects/*/*.jsonl`) and `~/.mindrian/card-fire-intercepts.log`. The researcher must verify whether transcripts carry the hook `additionalContext`, which holds the NAV block and the reach subject. If they don't, `ran_entries` and `gate_subject_text` for non-intercepted turns get reconstructed from the intercept log and the side channel where available. Where they can't be, the entry is marked `envelope_partial` and excluded from the metric.
- **D-05:** Sanitization before commit: third-party names, room content and venture specifics are replaced with placeholders; only the structural shape is kept (same rule as the 238 corpus meta). Raw extracts live only in the gitignored scratch path until sanitized. Dogfood text never goes to Jev.
- **D-06:** Dogfood labels: Claude proposes each label locally, with `label_origin: local`. The navigator ratifies them in one review sheet, `357-DOGFOOD-LABELS.md` (a table of id, one-line gist, proposed verdict and why), and each confirmed row is flipped to `human`. This review is the phase's single human checkpoint and is non-autonomous.

#### Minimal deterministic runtime fix
- **D-07 (primary fix, root-caused):** treat a harness-originated preceding record as synthetic, not typed.
  - `turn-text.cjs` threads the record's `isMeta` flag through.
  - `classifyPrecedingUserContentSource` returns a new source class `'harness'` when the record has `isMeta: true`, OR when its text begins with a known harness envelope tag: `<task-notification>`, `<agent-message`, `<cross-session-message`, `[SYSTEM NOTIFICATION`.
  - `check-card-fire.cjs:683` treats `'harness'` exactly like `'tool_result'` (verdict `preceding-turn-synthetic-no-user-engagement`).
  - The match is structural, on the flag or the leading tag only, never on meaning.
  - Fix the stale comment at :1333-1334.
- **D-08:** Nothing is added beyond D-07 unless the replay shows a remaining false block. Each additional change must cite the corpus entry id it fixes.
  - Do NOT add a rule of the form "primary arm + 0 option labels -> pass". The primary arm exists precisely to catch a model that ignored a reached gate and rendered nothing, so that rule would create new misses.
  - Do NOT touch the backstop regex tuning pinned by the 238 corpus.
- **D-08a (second live false block, 2026-09-23T09:40:16Z, same session):** verdict `reached-registry-gate-no-card`, empty gate_signature, `ran_entries: [scripts/intent-classifier.cjs]`. The preceding record WAS a real human-typed question, so D-07 does NOT cover it. The output had no options and no question. Class: an F.1 reach minted by intent-classifier about an unrelated room artifact (a `memory_artifact:research/...briefing-mirror` subject), which passed relevance by incidental token overlap with the human turn. This entry is corpus source (c) #2 and is therefore a guaranteed remaining false block after D-07, so D-08 WILL fire. The planner must plan one more deterministic fix that cites this entry. Candidate directions (planner or researcher to pick from code evidence, not from meaning-guessing):
  - reach-subject provenance (a subject naming a room artifact that is not the turn's own subject)
  - the reach's routing seed vs the current turn
  - requiring relevance overlap on distinguishing, non-boilerplate subject tokens that come from the human turn itself

  Any change to `gate-relevance.cjs` here is allowed by D-09 because a failing entry is named.
- **D-09:** The relevance and answered heuristics (`gate-relevance.cjs`) stay as they are unless the replay names a failing entry. Jev labels decide what the correct verdict is. They never become runtime code.

#### Dev-time Jev labeler
- **D-10:** `scripts/label-card-fire-replay.cjs` imports `scripts/jev-devtime-client.cjs`, following 356-CONTEXT D-06/D-07. Whichever of 354-17 / 356 / 357 executes first extracts it from `build-section-command-ledger.cjs` with re-exports; the others import it. It adds its own egress profile `card_fire_replay` (per D-08 of 356: one guard file, one profile each, never a union, refuse and never strip). The profile allows exactly these state keys, each with a string cap: `output_text`, `preceding_user_text`, `gate_subject_text`, `gate_shape`, `turns_since_gate`, `policy`. The `policy` value must equal the policy file byte for byte.
- **D-11:** Before it builds any request, the labeler refuses any entry whose `source === 'dogfood'` or which lacks `meta.sanitization_statement`. With no key it degrades to `unlabeled`, exit 0. `label-card-fire-replay` is appended to the tripwire leg that bans ledger builders from `hooks/` - as ONE entry in the named list constant 356 is introducing in `tests/test-353-tripwires.cjs` leg 2 (if 357 touches that file first, 357 introduces the named list constant itself, and 356 appends to it; never edit the regex in place).
- **D-12:** The policy file is `data/jev-policies/card-fire-replay.json` (`{policy_id, version, instructions, criteria: {"true": "...", "false": "..."}, boundary_cases[]}`, the Noul-native shape per docs.typesafe.ai primitives/noul.md; 356 D-01 amended 2026-09-23 - criteria is an OBJECT, never an array; one policy entry per Noul). The three questions are is-fork, already-answered, relevant. Each is an independent Noul with the full policy stated. They are never compared to each other, and no Choice or Noul confidence is mixed. Mapping: Noul >= 0.80 means yes; Noul <= 0.20 means no; anything else is `uncertain`, which goes to the navigator. Output goes to `357-JEV-LABEL-REPORT.md`. Disagreements with the hand labels are listed for a ruling and never auto-applied. These thresholds are starting values; the labeled fixture itself may revise them (356's lesson: don't borrow 004's 0.90).

#### Replay harness and surfaces
- **D-13:** `scripts/replay-card-fire.cjs [--surface cli|mcp|both] [--baseline write|compare] [--json]`. The CLI surface calls `deriveTurnSignals(envelope)` then `classifyCardFire`. The MCP surface calls `lib/mcp/stop-gate-handler.cjs::handleStopEvent`. It runs under a temp `MINDRIAN_HOME` with no bound room and cleared retry counters per entry, so neither the room close-out nor the session counters can leak between entries. It makes zero network calls. A test stubs `fetch` to throw. The exit code is non-zero on `false_blocks > 0 || new_misses > 0`.
- **D-14:** `tests/test-357-replay.cjs` runs `--surface both --baseline compare` and asserts CLI and MCP parity (ignoring `dedup-already-fired-this-session`). It is wired into `tests/run-all-357.sh` and the existing card-fire suite runner, so it becomes the standing gate.

#### Sequencing and coordination
- **D-15:** Execution waits for Phase 354 to complete. jsagi-25 pings on done or halt, and a disk watch runs as well. No 354 plan touches 357's files (verified 2026-09-23). Do not edit the uncommitted, unowned diffs: `eval-icm-writers.cjs`, the test-353 tests, `navigation.cjs`, `docs/OPEN-HANDOFFS.md`.
- **D-16:** The Larry prose shrink (R6) is anchored on section headers, not line numbers. Edit targets: the `agents/larry-extended.md` section "## Decision Gates -- fire the card, never draw the box (SEED-021)"; the two SKILL spans: the never-hand-draw rule, about :216, and the honest-residual card-fire note, about :244. These must stay: fire the card on a genuine unanswered, relevant fork; never draw the ASCII box; the FIRE-IF-FORK trailer is judgment-gated; "type a/b/c" is used only on a surface that can't fire the tool. The "Post-Gate Handoff" section is NOT touched. It keeps "runChain halts at the first MATERIAL step, material = not autonomous_safe" verbatim, per jsagi-a7 / 356, and `tests/test-larry-handoff-seam.cjs` stays green. The user-level copy `~/.claude/agents/larry-extended.md` is out of scope.
- **D-17:** Dual filing, per CLAUDE.md "Dev-Research Compositing": the reasoning trail goes into `~/MindrianRooms/rethinking-mindrianos/research/<dated>/` and is mirrored to `mindrianOS/research/`, cross-linked to this CONTEXT.

### Claude's Discretion
- Internal module layout of the replay and extractor scripts, and fixture ids and naming.
- Whether `extractOptionLabels` output is recorded per entry for diagnostics.
- Test split across files, as long as D-14's standing gate exists.

### Deferred Ideas (OUT OF SCOPE)
- **The UserPromptSubmit room-bind picker fires on harness turns.** The F.8 room-picker was re-injected on agent-message and cross-session-message turns all through this session. It is the same "harness record read as a human turn" class as D-07, but a different hook (session-start / UserPromptSubmit). Candidate follow-on, which may reuse D-07's `'harness'` classifier.
- **The intent-classifier mints F.1 reaches unrelated to the turn** (the fleet-census and decide-pursue reaches injected into this dev session). This is the upstream cause and belongs in its own phase.
- **The other 13 Larry per-turn judgments** (glyph/move, dial, problem type, elevation, escape hatch...) use the same teacher/student pattern. The follow-on phase(s) come after 357 proves the replay approach.
- **Prose forks with 0 extractable labels (intern-w1):** a known miss, since they need text understanding.
</user_constraints>

<phase_requirements>
## Phase Requirements

No REQ ids are registered yet; SPEC R1-R7 are the requirements. Proposed ids are in "Proposed Requirement IDs" below.

| ID | Description (SPEC) | Research Support |
|----|--------------------|------------------|
| R1 / GATE357-01, -09 | Replay corpus, 4 sources, >=45 entries, 4 fields + sanitization_statement | Transcript shapes (Finding 1), 238 adapter state mapping (Finding 6), dogfood fidelity 100% (Finding 2), retention clocks (Pitfall 1) |
| R2 / GATE357-02 | `replay-card-fire.cjs`, real classifier, no network, non-zero exit | Envelope modes (Pattern 1), `--code-root` for pre-phase run (Pattern 3), hermetic env (Pattern 2) |
| R3 / GATE357-03 | Dev-only Jev labeler, (a)(b)(c) only, shared client, keyless exit 0 | Shared client status (Finding 8), Noul criteria object (verified), tripwire leg (Finding 9) |
| R4 / GATE357-04, -05 | Deterministic fix, 0 false blocks, 0 new misses | D-07 measured (Finding 4), D-07 carve-out (Pitfall 3), D-08a chrome fix (Finding 5) |
| R5 / GATE357-06 | CLI vs MCP verdict parity | `handleStopEvent` side effects and hermetic recipe (Finding 7) |
| R6 / GATE357-07 | Metric-gated prose shrink >=50% | Exact spans, bytes, test-pinned phrases (Finding 10); SKILL :244 is mis-targeted (Pitfall 6) |
| R7 / GATE357-08 | Replay as a standing gate; reverted fix fails the suite | Existing runners already carry red legs (Pitfall 8); `--code-root` mutation check (Pattern 3) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Work only in `/home/jsagi/dev/MindrianOS-Plugin/`; never the plugin cache. All repo edits go through a GSD workflow.
- CJS only, no TypeScript, Node >= 22.16. CLI entry points parse `process.argv` with a switch-case router (no Commander/yargs).
- No em-dashes anywhere (hyphens only). Feynman-simplified, JTBD-oriented prose.
- Canon Part 8: user data never egresses. For 357: dogfood text never goes to Jev; only sanitized, authored (a)/(b)/(c) text may cross, and only through the shared egress guard.
- Canon Part 7: reuse before build (the 238 corpus is read in place; the hermetic helper and transcript-writer patterns already exist).
- Canon Part 11 R15: a genuine fork still gets a card (the primary arm must not be weakened).
- Canon Part 12: Larry prose changes keep the voice doctrine; the byte delta is reported.
- Tri-Polar: CLI hook and MCP `stop_gate_check` must agree.
- Verification: `bash tests/run-all-<phase>.sh`; `node scripts/build-harness-manifest.cjs` must be regenerated when Larry surfaces change (pre-commit drift guard, `scripts/hooks/pre-commit:428-445`).
- QA/RCA: defects found go to `.planning/debug/<slug>.md` per `docs/RCA-TEMPLATE.md`.
- Dev-Research Compositing: dual filing into `~/MindrianRooms/rethinking-mindrianos/research/<dated>/` plus mirror (D-17).
- Tracked `.planning` files: new files under the phase dir need `git add -f` (user memory, hard fact 2026-09-16).
- Parallel sessions: commit by explicit path only; never revert or stash unowned diffs.

## Summary

The replay harness is very buildable, and better than the CONTEXT assumed: Claude Code transcripts DO record every UserPromptSubmit hook's full stdout (the NAV block and the F.8 room-picker JSON), every Stop hook's live outcome (block, pass, degrade) and every user record's `isMeta` flag and `origin.kind`. A prototype reconstruction built only from transcripts reproduced the live card-fire verdict on 77 of 77 Stop events in the window where the installed plugin code is byte-identical to HEAD. So `envelope_partial` should be close to 0% in that window. Two clocks matter: the intercept log keeps only 24 hours, and transcripts keep 30 days.

The D-07 root cause holds, with one correction. The gate that force-blocked the anchor turn was NOT the stale F.1 fleet-census reach. That reach was consumed by the terminal Stop at 08:49. The live record was a fresh F.8 room-bind gate. It was minted by the UserPromptSubmit hook on the hand-back turn itself: the harness record triggered the picker, and the picker then blocked the turn. D-07 still fixes the anchor. Over 30 days of transcripts, D-07 as written flips 66 HEAD-code blocks to pass and flips 0 passes to blocks. In the HEAD-identical window it removes 9 of 11 live blocks. Only 1 of the 66 flips has a human-typed record upstream (a Skill-body meta record after a human prompt), so a narrow carve-out is recommended. Two of D-07's four tags (`<agent-message`, `<cross-session-message`) and `[SYSTEM NOTIFICATION` never appear as stored text. Stored peer messages are `isMeta:true` strings, and task-notifications are NOT `isMeta` (they carry `origin.kind:'task-notification'` and the `<task-notification` tag).

For D-08a, the evidence points to one direction. The 09:40 block's ONLY overlapping token with the F.1 subject was `gate`. That word is F.1 dial chrome: it appears in at least 50% of the 431 F.1 subjects minted in 30 days. The fix that extends the 2026-09-17 `GATE_BOILERPLATE_TOKENS` precedent (commit 893cee043, which stripped F.8 chrome) to the F.1 dial's own static chrome removes this false block deterministically. The other human-typed block in the window (09:20) overlaps on one chrome token plus one 10-character content token, so it survives that fix. It must be labeled before anyone can promise "0 false blocks".

**Primary recommendation:** Build the corpus in two envelope modes: direct-field for synthetic entries, and transcript plus side-channel for live and dogfood entries, so the D-07 code path is actually exercised. Add `--code-root <dir>` so the same corpus runs against a `git archive` of the pre-phase commit. Ship D-07 with a human-upstream carve-out, plus an F.1-chrome extension of `GATE_BOILERPLATE_TOKENS` that cites live entry #2. Snapshot the raw live evidence now, before the 24-hour and 30-day clocks erase it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Harness-vs-human preceding record classification | Local hook runtime (`lib/hmi/turn-text.cjs`) | - | The single transcript reader; structural flags only |
| Card-gate verdict | Local hook runtime (`scripts/check-card-fire.cjs::classifyCardFire`) | MCP daemon (`lib/mcp/stop-gate-handler.cjs`) wraps the same predicate | One predicate, two hosts (Tri-Polar) |
| Relevance chrome stripping (D-08a) | Local pure module (`lib/core/gate-relevance.cjs`) | - | Pure, deterministic, already owns `GATE_BOILERPLATE_TOKENS` |
| Replay corpus + harness | Dev-time scripts + tests (`scripts/replay-card-fire.cjs`, `tests/fixtures/card-fire-replay/`) | - | Never ships in a hook path |
| Dogfood extraction | Dev-time script, local-only (`scripts/extract-dogfood-stop-events.cjs`) | Gitignored scratch outside the repo | Part 8: never leaves the machine |
| Jev labeling | Dev-time script (`scripts/label-card-fire-replay.cjs`) -> TypeSafe API | Shared `scripts/jev-devtime-client.cjs` guard | Barred from `lib/` and `hooks/` by tripwire |
| Larry prose | Plugin prompt surfaces (`agents/larry-extended.md`, `skills/larry-personality/SKILL.md`) | `data/harness-manifest.json` digests | Metric-gated shrink |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`node:fs`, `node:path`, `node:os`, `node:crypto`, `node:child_process`, global `fetch`) | Node v22.23.1 on this machine [VERIFIED: `node --version`] | Everything: fixtures, replay, extraction, labeler | Repo convention: zero-dep CJS; spike clients are zero-dep [CITED: .claude/skills/spike-findings-MindrianOS-Plugin/SKILL.md] |
| `scripts/jev-devtime-client.cjs` (in-repo, shared) | not yet on disk [VERIFIED: `ls`] | Jev fetch, per-profile egress guard, pool | 356 D-06..D-09 / 354-17 plan contract |
| TypeSafe Jev `POST https://api.typesafe.ai/v1/systemone`, model `jev-latest` | measured against jev-1.13.0 | Dev-time Noul labels | [CITED: references/jev-typed-decisions-api.md] |

### Supporting (in-repo, reuse)
| Asset | Purpose | When to Use |
|-------|---------|-------------|
| `tests/helpers/cardfire-hermetic-238.cjs::makeHermeticCardFireEnv` | Sets `MINDRIAN_HOME` and `CARD_FIRE_SIDECHANNEL_PATH` together, restorable | Every replay test leg (add `MINDRIAN_ROOMS_HOME` yourself for MCP) |
| `tests/test-209-primary-sidechannel.cjs` `writeTranscriptAndDerive` pattern (~:470-540) | Write a minimal jsonl transcript + side-channel record, then derive | Model for transcript-mode entries |
| `tests/test-ga4-card-fire-e2e-179.cjs::writeTranscript` (:50) | jsonl fixture writer + spawn of `main()` | Optional `--e2e` spawn mode |
| `tests/test-198-stop-gate-retry-ceiling.test.cjs:65-75` | The MCP hermetic env recipe (both `MINDRIAN_HOME` and `MINDRIAN_ROOMS_HOME`) | MCP surface |
| `lib/core/card-fire-sidechannel.cjs` `recordReachedGate({filePath})` | Seed reach records with controlled age | Side-channel mode entries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Transcript + side-channel envelope for live/dogfood | Direct fields only (D-02 literal) | Direct `preceding_user_text_source:'typed'` would pin the pre-fix classification, so the post-fix replay would still block; D-07 would be untestable (Pitfall 2) |
| `git archive <sha>` into mkdtemp for the pre-phase run | `git worktree add` | Worktrees register in `.git/worktrees` and have bitten this repo before (user memory: worktree base mismatch); archive is stateless |
| Renderer-derived F.1 chrome list | Frequency-derived list (>=50% of F.1 subjects) | Frequency list includes words that can be real content (`research`, `claim`, `brain`, `decision`); derive from renderer static strings and pin with a drift test |

**Installation:** none. No new packages.

## Package Legitimacy Audit

No external packages are installed by this phase (Node built-ins plus in-repo modules only). slopcheck not run: nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | - | - | - | - | - | - |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Key Findings (verified in code and on disk, this session)

### Finding 1 - D-04: transcripts DO carry hook output (HIGH)
Measured on `~/.claude/projects/-home-jsagi/` (109 top-level session files, 2026-08-23 to 2026-09-23). All shapes below are described structurally; no transcript text is reproduced.
- `type:'attachment'`, `attachment.type:'hook_success'`, `attachment.hookEvent:'UserPromptSubmit'`, fields `{hookName, toolUseID, hookEvent, content, stdout, stderr, exitCode, command, durationMs}`. `content === stdout` (full hook output, plain text). 1,867 such records.
  - A plain-text `## NAVIGATION DECISION (engine v1)` block appears when the engine arm rendered (545 records). A dial render is followed by `[AskUserQuestion contract: shape=F.1 verbs=N]` and `[AskUserQuestion payload: {...}]` lines (`scripts/intent-classifier.cjs:1626-1664`).
  - `[NAV DECISION unchanged - prior block stands]` (`intent-classifier.cjs:1141`) means suppression, so no mint that turn (1,322 records).
  - The F.8 room-bind gate arrives as a JSON line `{"hookSpecificOutput":{"hookEventName","additionalContext"},"systemMessage"}` inside the same stdout. Its `additionalContext` carries `[AskUserQuestion contract: shape=F.8 ...]`. A plain-text scan misses it: the first prototype missed 5 of 11 blocks until it parsed that JSON line.
- `attachment.hookEvent:'SessionStart'` also has `hook_additional_context` records (`content: string[]`).
- Stop outcome per hook command: `hook_success` with `stdout` of length 39 = `{"continue":true,"suppressOutput":true}` (pass); length 71 = the degrade envelope; `hook_blocking_error` with `blockingError.command` naming `scripts/check-card-fire.cjs` = block. Across 30 days: 3,252 check-card-fire evaluations, 177 live blocks, all 177 from check-card-fire.
- The `system` subtype `stop_hook_summary` marks each Stop.
- User records carry top-level `isMeta` and `origin: {kind, ...}`. Observed `origin.kind` values: `human` (1,525), `task-notification` (1,186, NOT isMeta), `peer` (327, all isMeta), `auto-continuation` (1). Tool results have no origin.
- **What the side channel can and cannot give:** `~/.mindrian/card-fire-reached.json` has `{<session_id>: [{entry, shape, ts, subject<=300 chars}]}`. The TTL is 10 minutes (`card-fire-sidechannel.cjs:69`) and the fresh window is 2 minutes (:92). A record is consumed on every terminal verdict (`check-card-fire.cjs:1348-1364`, `card-fire-sidechannel.cjs:451`). So historical subjects are NOT recoverable from it. They ARE recoverable from the transcript: the F.1 subject is `rendered.text` (`intent-classifier.cjs:1668`), the text between the NAV block's `Why:` paragraph and the `[AskUserQuestion contract` line, trimmed and cut to 300 chars (`sanitizeSubjectText`, `card-fire-sidechannel.cjs:132`). The F.8 subject is `header + ' ' + body` (`intent-classifier.cjs:2943-2950, 3208-3215`).
- **What the intercept log can and cannot give:** `~/.mindrian/card-fire-intercepts.log` records only `{ts, timestamp, session_id, reason, gate_signature, ran_entries, matched_glyph_span, output_text<=4000}` (`check-card-fire.cjs:1279-1300`). It has no subject, no preceding text, no source and no freshness. It is TTL-pruned to 24 hours on every write (`RETRY_TTL_MS`, :244). At research time it held 11 records (10 intercepts plus 1 degrade, 4 sessions, all from 2026-09-23).

### Finding 2 - dogfood envelope reconstruction is exact in the HEAD-identical window (HIGH)
- The installed plugin `mos@2.0.0-beta.47` (`~/.claude/plugins/installed_plugins.json`, lastUpdated 2026-09-17T15:31Z) is byte-identical to HEAD for `check-card-fire.cjs`, `gate-relevance.cjs`, `turn-text.cjs`, `card-fire-sidechannel.cjs`, `stop-gate-handler.cjs`, `intent-classifier.cjs` and `render-coverage-registry.json` [VERIFIED: `cmp`].
- The prototype algorithm (local, research scratch only):
  1. Walk each session file in order.
  2. For every UserPromptSubmit `hook_success`, parse plain-text and JSON-line outputs. Every `[AskUserQuestion contract: shape=F.x` becomes a mint `{entry:'scripts/intent-classifier.cjs', ts, subject}`.
  3. At each check-card-fire Stop attachment, cut the transcript at the last `assistant` record before it (this excludes the "Stop hook feedback" meta record written for this same block).
  4. Run the real `turn-text.readTurnText` on that prefix, prune mints older than 10 minutes, set `gate_is_fresh = (now - newest mint) <= 120 s` and `reach_corroborated = fresh`, then run the real `classifyCardFire`.
  5. After a non-block live outcome, clear mints (consumption). After a block, keep them and increment the retry count.
- Result on sessions that started after 2026-09-17T15:32Z: **77/77 agreement** with the live outcome recorded in the transcript. A rerun a few minutes later gave 83 Stops, 11 blocks and 1 degrade, all agreeing. `envelope_partial` expected rate is about 0% in this window.
- Invisible mint sources: `lib/hmi/selector-dispatcher.cjs:1138` pickShape door (MCP / command processes) and `lib/core/eureka/qualify-opportunity.cjs`. None mattered in the window. Mark an entry `envelope_partial` only when its reconstructed pre-phase verdict disagrees with the live outcome.
- Outside the window (older code eras), reconstruction is not validated. 177 blocks over 30 days include many that HEAD code already passes. Use the pre-beta.47 era only as optional `era: pre-beta.47` entries.

### Finding 3 - the anchor (c)#1 correction (MEDIUM-HIGH)
Replay of session 56924067 (booleans and shapes only):
1. 08:48:07: UPS mints F.1 (the fleet-census subject lives here).
2. 08:49:06: the Stop's preceding record is a tool_result, so `preceding-turn-synthetic-no-user-engagement`. That verdict is terminal, so the F.1 record is consumed.
3. 08:50:43: a `peer` hand-back record arrives (`isMeta:true`, plain string starting with harness framing, NOT `<agent-message`).
4. 08:50:45: UPS on that hand-back emits NAV-unchanged plus an **F.8 room-bind gate** in `hookSpecificOutput`, which mints F.8.
5. 08:50:52: Stop. `ran_entries=[intent-classifier]`, fresh F.8 subject, preceding source `'typed'`, relevance passes, block.

The (c)#1 fixture must model an F.8 subject, not F.1. D-07 still fixes it. It also shows that the Deferred item "room-bind picker fires on harness turns" was the upstream minter of this exact block.

### Finding 4 - D-07 measured (HIGH)
The variant replay applied the same reconstruction to all 3,252 Stops across 30 days. The classifier was HEAD code throughout; only the preceding-source rule varied.

| Variant | block->pass flips vs HEAD | pass->block flips | Human-upstream flips |
|---------|---------------------------|-------------------|----------------------|
| V1 = D-07 literal (isMeta OR tag -> harness) | 66 (task-notification 49, peer 12, Skill/other meta 4, idle notice 1) | 0 | 1 (a Skill-body meta record directly after a human prompt) |
| V2 = skip meta records, classify previous record | 66 | **3** (2 slash-command bodies, 1 human+image) | - |
| V3 = V1 with human-upstream carve-out (recommended) | 65 | 0 | 0 |

HEAD-identical window: V1 removes 9 of 11 live blocks (5 peer, 3 task-notification, 1 Skill-body meta record). The 2 remaining blocks are human-typed (09:20 in session 0f86dd63; 09:40 in session 56924067 = D-08a). Stop-hook-feedback-preceded Stops (150 over 30 days) were `pass` under every variant, so D-07 does not measurably change the retry-loop semantics.

Leading tags seen as stored user text (30 days):
- **Non-meta:**
  - `<task-notification` (1,186, origin task-notification)
  - `<command-message` (110, human-initiated slash commands)
  - `<command-name` (75)
  - `[Request interrupted by user` (62)
  - `<local-command-stdout` (54)
  - `[Image` (9, origin human)
  - `[Pasted text` (1)
  - `<pasted_content` (1, origin human)
  - `<bash-input` / `<bash-stdout` (1 each)
- **Meta:**
  - Skill bodies (`Base directory for this skill`, 407)
  - `Stop hook feedback:` (about 360)
  - peer messages (327, plain harness framing)
  - `<local-command-caveat>` (39)
  - `[Image` (39)
  - `[Cross-session idle notice]` (31)
  - `/loop` tick and command re-invocation bodies
- **Never seen as a leading tag:** `<agent-message`, `<cross-session-message`, `[SYSTEM NOTIFICATION` (0 each).

Which of these a real human turn can start with:
- `<command-message` / `<command-name` (slash commands), `[Image`, `[Pasted text`, `<pasted_content`. None of them is in D-07's tag list, which is correct.
- A human could paste text that begins with `<task-notification`, although 0 have been observed. So the tag rule should apply only when `origin.kind !== 'human'`.

### Finding 5 - D-08a fix direction (MEDIUM, 2 live cases)
- `gateTopicallyRelevant` (`gate-relevance.cjs:309`) returns true on ANY shared or prefix token of 4+ chars after `gateSubjectTokens` strips `GATE_BOILERPLATE_TOKENS` (:139). That set holds only F.8 chrome: `bind session room rooms select start talk new`. It came from 893cee043 (2026-09-17, "gate-boilerplate false relevance").
- The F.1 engine-arm subject is the whole rendered dial (`intent-classifier.cjs:1668`, `engineArmSubject = rendered.text`), so it carries `lib/hmi/dial-presenter.cjs` chrome such as `PROMPT_LINE = 'Choose next reach:'` (:137), `FRAMING_MODE_B` (:153) and the Investigate/Blend/Insight dial words.
- Over 431 F.1 subjects in 30 days, these gate-subject tokens appear in >=50% of them: `back blend brain bring choose claim decision gate insight investigate local next none prior ranked reach research signal spin turn worked`.
- **D-08a (09:40):** the human turn had 5 subject tokens. The ONLY overlap with the F.1 subject was `gate`, a chrome token, with 0 non-chrome overlap. Extending the boilerplate strip to F.1 dial chrome turns it into `gate-irrelevant-to-turn`. This is deterministic and code-derived, and it follows the precedent.
- **The other human block (09:20):** overlap = `prior` (chrome) plus 1 non-chrome 10-character content token, so it would STILL block after the chrome fix. Its correct label is unknown (see Open Question 2).
- **Recommended implementation:**
  - Add an exported frozen `F1_DIAL_CHROME_TOKENS` (or widen `GATE_BOILERPLATE_TOKENS`). Derive it from the static template strings in `dial-presenter.cjs` and the F.1 renderer, not from the frequency list.
  - Add a drift test that tokenizes the renderer's exported constants and asserts coverage.
  - Exclude words that are also plausible reach content (`research`, `claim`, `brain`, `decision`) unless they are literally in a static template string.
  - Cite `live-2026-09-23-02` in the commit and in the test leg.
- **Rejected directions:**
  - "reach-subject provenance": semantic.
  - "routing seed vs turn": that lives in intent-classifier, which is out of scope per SPEC.

### Finding 6 - the 238 corpus is multi-state, not single-envelope (HIGH)
`tests/test-238-card-fire-corpus.cjs:85-160` runs each entry through `classifyCardFire` (not `deriveTurnSignals`) in up to 4 side-channel states: `buildTurn(text, {sidechannel_health, reach_corroborated})`, with `ran_entries:[]` and no preceding text. The expected outcomes:
- Half A (10 entries): pass in state 1 (healthy, uncorroborated).
- Half B (4 entries): block in state 2 (healthy, corroborated) and state 3 (unavailable).
- Half A in state 4 (unavailable): block exactly when `computeBackstopHit(text)` (documented cost).

The adapter must emit explicit per-state envelopes. Minimum: Half A x state 1 = 10 pass entries; Half B x states 2 and 3 = 8 block entries. Total 18 entries from source (a), which raises the corpus above the 45 floor. All are BACKSTOP-path (`ran_entries:[]`), so D-07 (a PRIMARY-only guard at `check-card-fire.cjs:648-683`) and a PRIMARY-path relevance change cannot move them. The Half B risk from R4 is nil, apart from a chrome-token change, which also applies on the backstop relevance path (:720-730). Assert it.

### Finding 7 - MCP surface side effects and the hermetic recipe (HIGH)
`handleStopEvent(sessionId, stopContext)` (`lib/mcp/stop-gate-handler.cjs:449-580`) runs these steps in order:
1. `resolveSessionRoomDir` -> `session-room.cjs::resolveMcpSessionRoom({noFloor:true})`. This reads `MINDRIAN_ROOMS_HOME` (NOT `MINDRIAN_HOME`). Leg A is the session binding; leg B is the **machine-wide `registry.json` active room** (`resolve-active-room.cjs`, `reg.active` source). With the env unset it resolves `~/MindrianRooms`, finds Jonathan's active room and runs `closeOutRoom`: minto drain, recompile, folder-memory snapshot, guardian, STATE.md persist, memory lifecycle (:299-313). **D-13's "temp MINDRIAN_HOME" alone is NOT hermetic.** Also set `MINDRIAN_ROOMS_HOME` (and `MINDRIAN_ROOMS_ROOT`) to an empty temp dir, as `test-198-stop-gate-retry-ceiling.test.cjs:70-75` does.
2. `deriveTurnSignals(Object.assign({}, ctx, {session_id}))`.
3. Counters come from the shared `~/.mindrian/card-fire-retries.json` accessors (temp `MINDRIAN_HOME` isolates them).
4. `classifyCardFire`.
5. For a non-material verdict: clear counters, consume the side channel, and return `{fire:false, reason, business}`.
6. For a material verdict: the in-memory `_sessionDedupState` (`_resetForTest()` exported), then bump counters, then `gateRender.renderGate` (in-process only, no fs or network found). It returns `{fire:true, business, ...rendered}` with **no verdict reason**.

Parity must therefore compare the verdict class (`fire` true vs `intercept` true), not reason strings. Use a unique `session_id` per entry, or call `_resetForTest()`, so dedup never triggers across entries.

The CLI in-process path: `deriveTurnSignals` reads the side channel whenever `ran_entries` is empty, and reads `sideChannelHealth()` and `reach_corroborated` unless they are given directly (:1482-1580). Set `CARD_FIRE_SIDECHANNEL_PATH` per entry. Note that `CLAUDE_CODE_SESSION_ID` is set when the executor runs inside Claude Code; it only affects pickShape mints (`selector-dispatcher.cjs`), which the replay never calls.

### Finding 8 - shared Jev client status (HIGH)
- `scripts/jev-devtime-client.cjs` does not exist [VERIFIED].
- Extraction source: `scripts/build-section-command-ledger.cjs`.
  - `loadKey` :70-78 (env, else `~/.secrets/typesafe.env`; the key file exists, mode 600).
  - `EGRESS_ALLOWED_*` + `assertEgressCeiling` :85-129. This is one uniform 140-char cap on candidate fields, plus a 400-char cap on `questions[*].instructions.judge`.
  - `jev` :136-157 (calls the guard, then fetch; 429/529 backoff).
  - `pool` :161-173.
  - Exports :708-725.
- Pinned consumers:
  - `scripts/eval-icm-writers.cjs` uses `ledgerBuilder.jev` (:516), `.assertEgressCeiling` (:520) and `.loadKey` (:706).
  - `tests/test-353-grader-agreement.cjs:79-91` uses `assertEgressCeiling`.
  - Both carry uncommitted peer diffs right now (D-15).
- 354-17-PLAN.md (wave 5, depends on 354-09) already contains the extract-if-absent / import-if-present task with the D-07 interface: `loadKey({env, secretsPath})`, `makeEgressGuard(profile)`, `jev(body, {key, guard, endpoint?, fetchImpl?, sleepImpl?})`, `pool`, frozen `EGRESS_PROFILES`. Its profile shape is one `max string length` per profile.
- **Gap for 357 (and 356):** D-10 needs a different cap PER state key, and `policy` must be byte-identical to a file. 354-17's guard shape may not support either. `output_text` needs a larger cap than 140. And the policy-in-question pattern (spike 004) exceeds the 400-char `instructions.judge` cap unless the policy rides in `state.policy`.

### Finding 9 - tripwire leg (HIGH)
`tests/test-353-tripwires.cjs` leg 2 (:104-113) is `const bannedRe = /eval-icm-writers|build-section-command-ledger/;`, scanned over `hooks/` (non-comment lines).
- Per D-11, replace it with a named list constant, e.g. `const HOOK_BANNED_DEVTIME_SCRIPTS = ['eval-icm-writers', 'build-section-command-ledger', ...]`, built into the regex, and append `label-card-fire-replay` (plus `jev-devtime-client` if not already added by 356/354-17).
- Leg 1 bans `api.typesafe.ai` only under `lib/`. `grep -rn api.typesafe.ai lib/ hooks/` returns nothing today [VERIFIED].
- Caution: leg 1 writes and deletes a scratch file `lib/core/__scratch-353-tripwire-negctl.cjs` during the run. That is harmless but touches the shared tree.

### Finding 10 - prose shrink spans (HIGH)
- `agents/larry-extended.md` lines 84-91, header `## Decision Gates -- fire the card, never draw the box (SEED-021)`: 1,751 B including the header, 1,685 B body [VERIFIED `wc -c`]. The next section `## The Cardinal Sin` is at :92. `## Post-Gate Handoff` is at :70-83 (do not touch).
- `skills/larry-personality/SKILL.md:216` (list item 5 under `### Operating the Dial (shipped)`): 479 B. This is the card rule "Never hand-draw the dial glyphs ... Text and card are atomic: no card, no picture".
- `skills/larry-personality/SKILL.md:244`: 606 B. This is NOT a card-fire rule. It is the Voice Signature honest-residual paragraph for the color mark. **It contains the two phrases `tests/test-larry-voice-mark-182.cjs:286-289` asserts**: `DECLARED CONVENTION` and `not a per-token runtime guarantee`. Shrinking it breaks that test (Pitfall 6).
- Phrases pinned by tests that fall inside the shrink spans (they must survive):
  - `larry-extended.md`: `## Decision Gates` and `no card, no picture (SEED-021)` (`tests/test-gate-native-fire-w1.cjs:113-115`; also `data/harness-policies/contract-parity-larry.json` phrases checked by `tests/test-298-contract-parity.cjs`).
  - `AskUserQuestion`: also elsewhere in the file, but keep it in the section.
  - Nothing pins the :216 wording.
- Other gates:
  - `data/harness-manifest.json` stores sha256 digests of both files (`larry_surfaces`). Regenerate with `node scripts/build-harness-manifest.cjs`.
  - `--check` is ALREADY red at research time from 354's `chain-executor.cjs`/`navigation-engine.cjs` drift, so do not misattribute it.
  - `scripts/check-first-touch-drift.cjs:62-64` lists both files.
- Byte math: all three spans total 2,836 B, so a >=50% cut means <=1,418 B. If :244 is dropped as mis-targeted, the two card spans total 2,230 B, so the target is <=1,115 B.

## Architecture Patterns

### System Architecture Diagram

```
 corpus sources                                   replay-card-fire.cjs
 ------------------                               --------------------------------------------
 (a) card-fire-corpus-238.json --adapter-->  +->  per entry: mkdtemp HOME / ROOMS_HOME / SIDECHANNEL
 (b) debug-cases.json (authored)    ---------+     |  seed side channel (age-controlled), seed counters
 (c) live-2026-09-23.json (paraphrased) -----+     |  write minimal transcript.jsonl (transcript mode)
 (d) dogfood.json (sanitized, local labels) -+     v
                                                  code-root (HEAD | git-archive of pre-phase sha)
 extract-dogfood-stop-events.cjs                    |-- CLI: deriveTurnSignals(env) -> classifyCardFire
   ~/.claude/projects/*.jsonl  --\                  |       (+ real retry accessors, like main())
   card-fire-intercepts.log    ---> raw scratch     |-- MCP: handleStopEvent(sid, env) -> fire?
   (outside repo) -> sanitize -> verdict-preserve   v
   check -> 357-DOGFOOD-LABELS.md (human)         verdict class per surface
                                                    |
 label-card-fire-replay.cjs (a,b,c only)            v
   refuse dogfood / no sanitization_statement     compare vs expected_verdict_class and baseline.json
   jev-devtime-client guard(card_fire_replay)       -> FALSE_BLOCK / NEW_MISS / KNOWN_MISS / OK
   -> 3 independent Nouls -> 357-JEV-LABEL-REPORT   -> exit !=0 if false_blocks>0 || new_misses>0
```

### Recommended Project Structure
```
scripts/
  replay-card-fire.cjs              # harness (--surface, --baseline, --json, --code-root, --only)
  extract-dogfood-stop-events.cjs   # local-only transcript -> candidate envelopes (raw to scratch)
  label-card-fire-replay.cjs        # dev-only Jev labeler (a,b,c)
  jev-devtime-client.cjs            # shared; import (or extract per 354-17 contract if absent)
data/jev-policies/card-fire-replay.json
tests/fixtures/card-fire-replay/
  debug-cases.json  live-2026-09-23.json  dogfood.json  baseline.json
  transcripts/ (optional: per-entry minimal jsonl, or inline `transcript` arrays in the entry)
tests/
  test-357-corpus-loader.cjs  test-357-replay.cjs  test-357-harness-source.cjs
  test-357-f1-chrome.cjs      test-357-labeler-refusal.cjs
  run-all-357.sh
```

### Pattern 1: Three envelope modes (resolves the D-02 vs D-07 tension)
**What:** Each entry has `envelope.mode`:
- `direct` (default): 238 and authored debug entries. Direct fields go to `deriveTurnSignals`, and `sidechannel_health` and `reach_corroborated` MUST be given explicitly (otherwise `deriveTurnSignals` reads the real side channel, `check-card-fire.cjs:1545-1580`).
- `transcript`: live and dogfood entries. The entry carries a minimal `transcript: [records]`, meaning sanitized role:user and assistant records that keep `isMeta` and `origin.kind`. The harness writes it to temp and passes `transcript_path` with NO `output_text`, `preceding_user_text` or `preceding_user_text_source`, so `readTranscriptTurn` -> `turn-text` (the code D-07 changes) actually runs.
- `sidechannel`: reach state given as `sidechannel_records: [{entry, shape, age_ms, subject}]`, seeded with `recordReachedGate({filePath})` and then back-dated. `ran_entries` is omitted and `session_id` is set, so `gate_is_fresh`, subjects and consumption come from the real module.
- `transcript` and `sidechannel` combine: that combination is exactly the live Stop contract.

**Why:** `deriveTurnSignals` does NOT accept `gate_is_fresh` as a direct field (verified :1510-1540: it is only set from the side channel). And a direct `preceding_user_text_source:'typed'` would freeze the pre-fix classification. No runtime seam is added.

### Pattern 2: Hermetic per-entry environment
Set these BEFORE requiring code-root modules and reset them per entry (fresh mkdtemp):
- `MINDRIAN_HOME` (retries, intercept log)
- `CARD_FIRE_SIDECHANNEL_PATH`
- `MINDRIAN_ROOMS_HOME` and `MINDRIAN_ROOMS_ROOT` (MCP room resolution)

Then:
- Unique `session_id` per entry.
- `stopGateHandler._resetForTest()` before each MCP call.
- `globalThis.fetch = () => { throw new Error('network forbidden in replay') }` for the whole run.

For retry and degrade cases, pre-seed counters with the real `bumpRetryCount`/`bumpSessionCount` exports (`check-card-fire.cjs` exports :1780-1800) so both surfaces read them identically.

### Pattern 3: `--code-root` for pre-phase and mutation runs
`git archive <pre-phase-sha> scripts lib data | tar -x -C <mkdtemp>` gives a stateless snapshot. The replay then requires `<code-root>/scripts/check-card-fire.cjs` and `<code-root>/lib/mcp/stop-gate-handler.cjs`. `PLUGIN_ROOT` is `__dirname/..`, so the whole subtree resolves inside the snapshot (`check-card-fire.cjs:152`).
- Use it for `--baseline write` (D-03) and for the R2 assertion: the pre-phase run shows the live entries as FALSE_BLOCK and exits non-zero.
- Use it for the R7 "reverted fix fails" check: archive HEAD, revert only the fix hunks inside the temp copy with `git show <fix-sha>` applied in reverse via `git apply -R --directory`, and assert non-zero.

### Pattern 4: D-07 with a human-upstream carve-out (V3)
Change `classifyPrecedingUserContentSource(content, recordMeta?)`, keeping the 1-arg call backward compatible (test-209 Behavior 14, :555-585). `readTurnText` has `obj` in scope at `turn-text.cjs:208-220`. It passes `{isMeta: obj.isMeta === true, originKind: obj.origin && obj.origin.kind, prevUserKind}`, where `prevUserKind` is the classification of the previous user record in the walk. The rule order:
1. `originKind` in {`task-notification`, `peer`} -> `'harness'`.
2. `originKind !== 'human'` AND the leading text (after trimStart) starts with `<task-notification` or `[Cross-session idle notice]` -> `'harness'`. Keep D-07's other tags too (harmless, 0 observed).
3. `isMeta === true` AND the previous user record is NOT human-upstream -> `'harness'`. Human-upstream means origin `human`, or a non-meta record whose text starts with `<command-name`/`<command-message`.
4. Otherwise, today's logic.

In `check-card-fire.cjs:683`, extend the equality to `=== 'tool_result' || === 'harness'`. Fix the comment at :1333-1334. The carve-out means the fix is always at or below today's blocks, with zero new blocks.

### Anti-Patterns to Avoid
- **Direct-field live and dogfood entries:** they hide the D-07 path (Pitfall 2).
- **"Primary arm + 0 labels -> pass":** banned by D-08. The primary arm exists for the silent model.
- **A frequency-derived chrome list:** strips real content words and creates misses.
- **Comparing MCP and CLI `reason` strings:** MCP `fire:true` carries no reason.
- **Requiring `tests/helpers/*` from `scripts/replay-card-fire.cjs`:** keep the isolation code in the script (scripts must not depend on tests).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transcript parsing for the replay | A second jsonl walker | `lib/hmi/turn-text.cjs::readTurnText` via `transcript_path` | turn-text calls itself "THE ONE transcript reader"; a second walker is the drift it exists to prevent |
| Reach state and freshness | Computing `gate_is_fresh` in the harness | Seeding the real side channel with back-dated `ts` | `deriveTurnSignals` has no direct seam for it |
| Retry and session counters | Harness-local counters | The exported `read/bump/clear` accessors against temp `MINDRIAN_HOME` | Both surfaces share one store by design (`check-card-fire.cjs` export comment) |
| Jev fetch, backoff, egress | A new client | `scripts/jev-devtime-client.cjs` (import or extract per 354-17 contract) | D-10, one guard file |
| Hermetic env | New env juggling in tests | `tests/helpers/cardfire-hermetic-238.cjs` plus `MINDRIAN_ROOMS_HOME` | Already encodes the two-var trap |
| Pre-phase code | A long-lived worktree | `git archive` into mkdtemp | Stateless, no `.git/worktrees` entries |

**Key insight:** every piece of the live Stop contract (transcript path, side-channel file, counters file) already has a test seam. The replay should drive those seams, not invent a parallel envelope.

## Runtime State Inventory

Not a rename or migration phase. It does touch runtime state, which is listed here for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `~/.mindrian/card-fire-intercepts.log` (24 h TTL), `card-fire-reached.json` (10 min TTL), `card-fire-retries.json`: live evidence stores | Snapshot to scratch outside the repo NOW. The replay must never read or write them (temp env) |
| Live service config | None; TypeSafe has no stored config | None |
| OS-registered state | None | None |
| Secrets/env vars | `~/.secrets/typesafe.env` (`TYPESAFE_API_KEY`, present, mode 600) | Read by `loadKey` only. Never printed or committed. Keyless path must exit 0 |
| Build artifacts | `data/harness-manifest.json` digests of Larry surfaces | Regenerate after R6 |

## Common Pitfalls

### Pitfall 1: The live evidence expires before execution
**What goes wrong:** execution is held for Phase 354, which had only 4 of about 18 plans summarized at research time. The intercept log prunes to 24 hours on its next write, so the anchor record goes after about 2026-09-24T08:50Z. Transcripts are cleaned after 30 days: the oldest file is from 2026-08-24, so no `cleanupPeriodDays` override exists and the default is 30. Session 56924067 disappears around 2026-10-23.
**How to avoid:** make the first plan task (or a navigator-approved pre-execution step) a local raw snapshot: copy the intercept log and the source session jsonl files (at least 56924067, 0f86dd63, 0208790f, 21829408) to a scratch dir OUTSIDE the repo, for example `~/.cache/mindrian-dev/357-raw/` (mode 700). Record the sha256 values in the plan's SUMMARY. **Warning sign:** the extractor finds 0 records for 2026-09-23.

### Pitfall 2: Direct fields freeze the pre-fix classification
**What goes wrong:** an entry with `preceding_user_text_source:'typed'` keeps blocking after D-07, because direct fields win (`check-card-fire.cjs:1621-1627`). **How to avoid:** use transcript mode for every entry whose verdict depends on turn-text (Pattern 1). Loader-test rule: `source in {live, dogfood}` implies `envelope.mode` includes `transcript`.

### Pitfall 3: Bare `isMeta` misclassifies human-initiated turns
**What goes wrong:** Skill bodies, slash-command bodies and image placeholders are `isMeta:true` records that sit right after a human-typed record (observed "meta:skill <- human" 72, "meta:image <- human" 19, "meta:other <- human" 13). V1 would call these turns harness. That happened for 1 real block in 30 days, which is a potential new miss. **How to avoid:** the V3 carve-out. Add corpus entries for human+Skill-meta and human+image-meta turns with a fresh relevant gate, expected block (these are authored debug entries).

### Pitfall 4: MCP replay closes out Jonathan's real active room
**What goes wrong:** with `MINDRIAN_ROOMS_HOME` unset, `handleStopEvent` resolves the machine-wide active room and runs `closeOutRoom` (STATE.md persist, minto drain, recompile, snapshot). **How to avoid:** Pattern 2. A test asserts `business.room_dir === null` for every MCP replay result.

### Pitfall 5: Sanitization changes the verdict
**What goes wrong:** relevance is token overlap, so paraphrasing `preceding_user_text` or `gate_subject_text` can add or remove the one overlapping token. For example, the (c)#2 case hinges on the single token `gate`, and (c)#1 hinges on overlap between the hand-back and the F.8 subject. **How to avoid:** the extractor runs the pre-phase replay on the raw envelope and on the sanitized envelope, and requires the same verdict and reason. Author paraphrases that deliberately keep the overlapping token class (chrome vs content). Record `raw_verdict` next to `sanitized_verdict` in the scratch report, never in the repo.

### Pitfall 6: SKILL :244 is not a card rule
**What goes wrong:** D-16 and SPEC R6 list SKILL :244 (606 B) as "the honest-residual card-fire note". It is the Voice Signature color-mark residual, and it holds two phrases `tests/test-larry-voice-mark-182.cjs:286-289` requires. **How to avoid:** navigator ruling (Open Question 1). The recommendation is to drop :244 from the shrink set and measure the 50% target on the two real card spans (2,230 B -> <=1,115 B).

### Pitfall 7: Shared guard cannot express 357's caps
**What goes wrong:** 354-17's `makeEgressGuard` profile carries one max string length and no file-equality check. **How to avoid:** the first of 356/357 to need it extends the profile schema additively: `max_len_by_key: {output_text: N, ...}`, `must_equal_file: {policy: 'data/jev-policies/card-fire-replay.json'}`. Keep refuse-don't-strip and the thrown error naming the key (356 D-09). Coordinate through ListAgents and a message before editing the shared file.

### Pitfall 8: The "standing suite" is already red
**What goes wrong:** under hermetic env at research time, `run-all-179.sh` (ga4 e2e E2E-1), `run-all-209.sh` (209-03 declared-implies-wired) and `run-all-238.sh` (238-03 chosen validation) each had 1 failing leg. `tests/test-card-fire-relevance-gate.cjs` has 5 red legs, "expected until 210-05", that are stale. The E2E-1 red is probably the 238-08 backstop suppression, since a missing side file reads as healthy. A reverted fix "making the suite fail" is therefore unprovable at the runner level. **How to avoid:** R7 asserts on the replay leg's own exit code (and `run-all-357.sh`, which contains only 357 legs). Add the replay as a new `run_if` leg in `run-all-238.sh` (the GATE-04 corpus runner), and record the pre-existing reds as ENV/known in the SUMMARY. Do not fix them in 357.

### Pitfall 9: Tests that tamper with the shared tree
`tests/test-298-contract-parity.cjs` temporarily edits Larry surfaces and policies, then restores them. It fails on "git status --porcelain is empty" whenever peer sessions have diffs (observed 4 fails, all restored). `tests/test-353-tripwires.cjs` leg 1 writes a scratch file under `lib/core/`. Run these only when no peer session is mid-edit on those paths, and read the failures in that light.

## Code Examples

### Harness-source classification (turn-text), backward compatible
```js
// lib/hmi/turn-text.cjs - sketch; structural signals only (origin.kind, isMeta, leading tag)
const HARNESS_ORIGINS = new Set(['task-notification', 'peer']);
const HARNESS_LEADS = ['<task-notification', '<agent-message', '<cross-session-message',
  '[SYSTEM NOTIFICATION', '[Cross-session idle notice]'];
function classifyPrecedingUserContentSource(content, rec) {
  const base = /* existing body, unchanged */ legacyClassify(content);
  if (!rec || typeof rec !== 'object') return base;              // 1-arg callers unchanged
  if (HARNESS_ORIGINS.has(rec.originKind)) return 'harness';
  const lead = extractAssistantText(content).trimStart();
  if (rec.originKind !== 'human' && HARNESS_LEADS.some((t) => lead.startsWith(t))) return 'harness';
  if (rec.isMeta === true && rec.prevHumanUpstream !== true) return 'harness';
  return base;
}
```

### Side-channel mode seeding
```js
// Source pattern: tests/test-209-primary-sidechannel.cjs Behaviors 12-13
sidechannel.recordReachedGate({ sessionId: sid, surface: 'scripts/intent-classifier.cjs',
  shape: rec.shape, subjectText: rec.subject, filePath: scPath });
const store = JSON.parse(fs.readFileSync(scPath, 'utf8'));            // back-date ts
store[sid][store[sid].length - 1].ts = Date.now() - rec.age_ms;       // keep age far from 120000/600000
fs.writeFileSync(scPath, JSON.stringify(store));
```

### Noul question (verified shape)
```js
// Source: https://docs.typesafe.ai/primitives/noul (fetched 2026-09-23): criteria is an OBJECT; no confidence field
questions['is_fork'] = { type: 'noul',
  instructions: 'Using the policy in `policy`, is the text at `output_text` posing a genuine structural fork ...',
  criteria: { true: '<policy true gloss>', false: '<policy false gloss>' } };
// response: { type: 'noul', noul: 0.93 }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One regression leg per RCA | One labeled replay corpus + baseline | This phase | The generalization CONTEXT names |
| Runtime Jev-scored ledger (BRIEF) | Jev as dev-time labeler only | SPEC round 2 | No vendor in turn path |
| Noul `criteria[]` (CONTEXT D-12 first draft) | `criteria: {"true","false"}` object | 356 D-01 amended, 2026-09-23 [VERIFIED docs] | Policy file schema |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Code's transcript retention default is 30 days (inferred from oldest file 2026-08-24 and no `cleanupPeriodDays` in settings) | Pitfall 1 | Snapshot deadline could be earlier or later |
| A2 | The F.1 dial chrome words can be enumerated from `dial-presenter.cjs` static strings | Finding 5 | If chrome is assembled dynamically, a renderer-export seam is needed |
| A3 | The 09:20 human-typed block's correct label is unknown (could be a genuine relevant gate) | Finding 5 | If labeled pass, a third fix is needed and may be text-dependent |
| A4 | 354-17 lands before 357 executes and creates `jev-devtime-client.cjs` | Finding 8 | If 354-17 halts, 357 must extract (plan both branches) |

## Open Questions

1. **SKILL :244 in the shrink set?**
   - What we know: it is a voice-mark residual, and it is test-pinned (Pitfall 6).
   - Recommendation: drop it and measure 50% on the two card spans. This needs a navigator ruling because it touches locked D-16 and SPEC R6.
2. **The 09:20 human-typed block (session 0f86dd63)**
   - What we know: F.1 fresh, overlap on `prior` plus one content token.
   - What's unclear: whether it is a false block.
   - Recommendation: include it in dogfood and label it at the D-06 checkpoint. If it is labeled pass, it is a D-08 case with no deterministic fix. Either amend the bar (a `known_false_block` class) or open a follow-on. Flag it to the navigator before execution.
3. **The D-07 carve-out (V3)**
   - What we know: V3 narrows locked D-07 (it removes 1 human-upstream flip in 30 days and adds nothing).
   - Recommendation: navigator one-word approval.
4. **Snapshot timing**
   - What we know: raw evidence expires (24 h / 30 d) while execution waits for 354.
   - Recommendation: the orchestrator asks the navigator to authorize a local-only snapshot now (a copy outside the repo, no repo edit).
5. **Shared guard schema extension owner (Pitfall 7)**
   - Recommendation: agree with 356 (jsagi-a7) on who adds `max_len_by_key` and `must_equal_file`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v22.23.1 | - |
| git (archive) | `--code-root` pre-phase runs | yes | repo | worktree (not recommended) |
| TypeSafe key | labeler | yes (`~/.secrets/typesafe.env`, 600) | - | keyless -> `unlabeled`, exit 0 |
| Transcripts `~/.claude/projects/-home-jsagi/*.jsonl` | dogfood | yes (109 files, 30-day window) | - | none after purge (Pitfall 1) |
| Intercept log | live (c) cross-check | yes (11 records, 24 h) | - | transcript reconstruction |
| `scripts/jev-devtime-client.cjs` | labeler | no (expected from 354-17) | - | extract per 354-17 contract |

**Missing dependencies with no fallback:** raw live evidence after its expiry (snapshot first).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Plain Node assert scripts + bash `run_if` aggregators (repo convention) |
| Config file | none; `tests/run-all-357.sh` (Wave 0) |
| Quick run command | `node tests/test-357-replay.cjs` |
| Full suite command | `bash tests/run-all-357.sh && bash tests/run-all-238.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE357-01 | >=45 entries, 4 sources, 4 fields, meta.sanitization_statement, live/dogfood use transcript mode | unit | `node tests/test-357-corpus-loader.cjs` | no, Wave 0 |
| GATE357-02 | Pre-phase code-root: live entries = FALSE_BLOCK, exit !=0; HEAD: exit 0; fetch stubbed to throw | integration | `node scripts/replay-card-fire.cjs --code-root "$PRE" --json` (via `node tests/test-357-replay.cjs`) | no, Wave 0 |
| GATE357-03 | Labeler refuses dogfood and missing-statement entries before building a request; keyless exit 0 `unlabeled`; tripwire green | unit | `node tests/test-357-labeler-refusal.cjs && node tests/test-353-tripwires.cjs && ! grep -rn api.typesafe.ai lib/ hooks/` | no, Wave 0 |
| GATE357-04 | harness source class: peer / task-notification / meta-after-tool_result -> synthetic pass; human+Skill-meta and human+image keep block; test-209 Behaviors 12-14 green | unit | `node tests/test-357-harness-source.cjs && node tests/test-209-primary-sidechannel.cjs` | no, Wave 0 |
| GATE357-05 | F.1 chrome strip: live #2 passes; chrome list covers renderer static strings; 238 Half B still blocks | unit | `node tests/test-357-f1-chrome.cjs && node tests/test-238-card-fire-corpus.cjs` | no, Wave 0 |
| GATE357-06 | CLI vs MCP verdict class identical per entry (dedup excluded); `business.room_dir === null` | integration | `node scripts/replay-card-fire.cjs --surface both --baseline compare` | no, Wave 0 |
| GATE357-07 | Spans shrink >=50% (or skip recorded); gate-native-fire-w1, voice-mark-182, handoff-seam, 298 contract parity green; manifest regenerated | unit | `node tests/test-gate-native-fire-w1.cjs && node tests/test-larry-voice-mark-182.cjs && node tests/test-larry-handoff-seam.cjs && node scripts/build-harness-manifest.cjs --check` | yes (existing) |
| GATE357-08 | Reverted fix fails the standing leg | integration (phase gate) | `node tests/test-357-replay.cjs --mutation` (archive HEAD, `git apply -R` the fix commit inside temp, expect !=0) | no, Wave 0 |
| GATE357-09 | Dogfood: >=20 entries, all `label_origin: human`, sanitized verdict == raw verdict | manual checkpoint + unit | `node tests/test-357-corpus-loader.cjs --dogfood-strict` | no, Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/test-357-replay.cjs` (in-process, under 5 s for about 60 entries)
- **Per wave merge:** `bash tests/run-all-357.sh`
- **Phase gate:** full suite plus the GATE357-08 mutation check, plus a manual review of `357-JEV-LABEL-REPORT.md` disagreements

### Wave 0 Gaps
- [ ] `tests/run-all-357.sh`, `tests/test-357-*.cjs` (5 files above)
- [ ] `tests/fixtures/card-fire-replay/` skeleton with `meta.sanitization_statement`
- [ ] Pre-phase sha recorded (the commit before the first 357 code change) for `--code-root` and `--baseline write`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | - |
| V3 Session Management | no | - |
| V4 Access Control | no | - |
| V5 Input Validation | yes | Replay treats transcript and fixture JSON as untrusted: per-line try/catch (turn-text pattern), never eval |
| V6 Cryptography | no | sha256 only for hashes (node:crypto) |
| V8 Data Protection | yes | Part 8 egress guard (refuse-don't-strip), dogfood never leaves the machine, key never printed |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Dogfood text reaches Jev | Information disclosure | Refuse on `source==='dogfood'` BEFORE request build; profile allow-list; test |
| A policy or instructions field smuggles room text | Information disclosure | `policy` must byte-equal the policy file; per-key caps |
| Replay mutates the real room or `~/.mindrian` | Tampering | Temp `MINDRIAN_HOME` / `MINDRIAN_ROOMS_HOME` / side-channel path; assert `room_dir === null` |
| Vendor in hook path | Elevation / supply chain | Tripwire legs 1-2 (named list), `grep` gate |
| Third-party names in committed fixtures | Information disclosure | Sanitization statement plus grep check (the 238-07 precedent) |

## Proposed Requirement IDs

| ID | Requirement | SPEC |
|----|-------------|------|
| GATE357-01 | Replay corpus loader: 4 sources, >=45 entries, required fields, sanitization meta, envelope-mode rule | R1 |
| GATE357-02 | `scripts/replay-card-fire.cjs` with `--surface`, `--baseline`, `--json`, `--code-root`; no network; exit semantics | R2 |
| GATE357-03 | Dev-only Jev labeler on the shared client plus the `card_fire_replay` profile; refusal; keyless; tripwire named list | R3 |
| GATE357-04 | D-07 `'harness'` source class (with human-upstream carve-out), threaded `isMeta`/`origin.kind` | R4 |
| GATE357-05 | D-08a F.1 dial chrome strip in `gate-relevance.cjs`, citing `live-2026-09-23-02` | R4 |
| GATE357-06 | CLI/MCP verdict-class parity with hermetic MCP env | R5 |
| GATE357-07 | Metric-gated Larry prose shrink plus manifest regeneration plus byte delta in SUMMARY | R6 |
| GATE357-08 | Standing gate: `run-all-357.sh` plus a `run-all-238.sh` leg plus the mutation check | R7 |
| GATE357-09 | Dogfood extractor, raw snapshot, sanitization with verdict preservation, navigator label checkpoint | R1(d), D-04..D-06 |

Suggested plan shape: whichever of 354-17 / 356 lands first owns the extraction; 357 branches on file existence.
- **Wave 1:** snapshot plus extractor (GATE357-09 part), corpus plus loader plus harness plus baseline (01, 02). These can run in parallel.
- **Wave 2:** the D-07 fix (04), then the D-08a fix (05), serialized on the same files. The labeler (03) runs in parallel once the client exists.
- **Checkpoint:** navigator reviews `357-DOGFOOD-LABELS.md` and the Jev disagreements.
- **Wave 3:** parity (06) plus the standing gate (08).
- **Wave 4:** prose shrink (07) only if the replay reports 0/0, plus D-17 dual filing.

## Sources

### Primary (HIGH confidence)
- Repo code read this session:
  - `scripts/check-card-fire.cjs` (:152-251, :334-523, :523-786, :788-830, :1258-1364, :1420-1809)
  - `lib/hmi/turn-text.cjs` (full)
  - `lib/core/gate-relevance.cjs` (:60-358)
  - `lib/core/card-fire-sidechannel.cjs` (:60-570)
  - `lib/mcp/stop-gate-handler.cjs` (:49-589)
  - `lib/mcp/session-room.cjs`
  - `lib/mcp/tools/stop-gate.cjs`
  - `scripts/intent-classifier.cjs` (:1090-1135, :1553-1740, :2925-2960, :3195-3225)
  - `lib/hmi/selector-dispatcher.cjs` (:1095-1150)
  - `lib/hmi/dial-presenter.cjs` (:115-175)
  - `scripts/build-section-command-ledger.cjs` (:49-180, :700-726)
  - `tests/test-353-tripwires.cjs`, `tests/test-238-card-fire-corpus.cjs`, `tests/test-209-primary-sidechannel.cjs`, `tests/test-gate-native-fire-w1.cjs`, `tests/test-larry-voice-mark-182.cjs`, `tests/helpers/cardfire-hermetic-238.cjs`
- Measurements on local transcripts and logs (shapes and counts only; scratch scripts in the session scratchpad, not committed)
- https://docs.typesafe.ai/primitives/noul: Noul criteria object, no confidence (fetched 2026-09-23)
- `.claude/skills/spike-findings-MindrianOS-Plugin/` (SKILL.md, jev-typed-decisions-api.md, policy-execution-parity.md)
- `.planning/phases/356-*/356-CONTEXT.md` D-01..D-12; `.planning/phases/354-*/354-17-PLAN.md`

### Secondary (MEDIUM confidence)
- The D-08a chrome analysis (2 live cases, 431 F.1 subjects)

### Tertiary (LOW confidence)
- Transcript retention default (A1)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, because there are no new deps and the in-repo seams were verified
- Architecture: HIGH, because envelope modes and hermetic needs were traced in code, and reconstruction was measured at 77/77
- Pitfalls: HIGH for Pitfalls 2-9 (measured or read); MEDIUM for Pitfall 1 timing (A1)
- D-08a direction: MEDIUM (small n)

**Research date:** 2026-09-23
**Valid until:** 2026-10-07 for code facts (the gate files change often); the raw-evidence deadlines in Pitfall 1 are hard dates.
