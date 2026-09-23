# Phase 356 Report: Chain-Executor Material-Step Ledger (Jev Noul, Seat Scored at Dev Time)

Durable reasoning trail (evidence and cross-domain grounding): `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-chain-executor-irreversibility-ledger-356.md`, mirrored to `~/MindrianOS/research/2026-09-23-chain-executor-irreversibility-ledger-356.md`.

## What changed and why

The chain-executor's runtime halt rule (`isIrreversibleStep` in `lib/core/chain-executor.cjs`) used a 7-keyword substring match over each command's slug to decide whether an autonomous_safe step was actually irreversible and should stop an unattended chain. That keyword list matched exactly 1 of the registry's 113 commands (`/mos:publish`). The real exposure was never that the code was wrong about `/mos:publish` -- it is that the plugin ships 113 commands, most of them are `autonomous_safe: true` (they run underneath Larry's suggest-to-run seam without stopping for the navigator), and a purely lexical filter cannot see behavior. A command like `/mos:show` can be irreversible for reasons that have nothing to do with its name.

Phase 356 adds a third, add-only signal to `isIrreversibleStep`: a dev-time-built ledger (`data/command-irreversibility-ledger.json`) that scores every registry command once against a locked policy, using a Noul (yes/no) judgment from Jev (TypeSafe System One), and ships the scores as plain JSON that the runtime reads locally with zero network calls. The ledger can only ever force a step to become material; it can never clear a step the older two signals (an explicit `step.irreversible` flag, or the keyword hint) already flagged. Material and irreversible are kept as distinct predicates throughout: the runtime code still says `forced_material`, and the policy's own `instructions` state plainly that "irreversible" (Phase 356's scoring question) is narrower than "material" (the runtime halt decision), so a Jev "no" on irreversibility never overrides an existing material flag from elsewhere.

## Measured numbers

All numbers below are taken from their committed source file, named per number.

**Registry and keyword baseline**
- Registry count at build: **113** commands (`data/command-registry.json`, confirmed equal to the ledger's `entries.length`).
- Keyword baseline (pre-356): the 7-keyword substring match over the slug matched **1 of 113** slugs (`/mos:publish`) (`356-SPEC.md` background).
- Blurb size: blurbs (teaching + jtbd_summary) average ~67 tokens; bodies average ~2,450 tokens, max ~15,500 (`356-CONTEXT.md`).

**Blind labeling (first round, D-04/D-20, pre-D-21 rubric)**
- D-04 risk subset: **66 rows**, blind-labeled by the navigator under the original "outside the machine" rubric, committed before Claude's sealed pre-labels (`356-CLAUDE-PRELABELS.json`, D-04, D-16) were revealed.
- D-20 remainder: **47 rows**, the rest of the 113-command registry, same blind-before-reveal protocol.
- First-round blind-vs-Claude agreement, computed directly from `356-CLAUDE-PRELABELS.json` against the filled `356-BLIND-LABEL-SHEET.md` and `356-BLIND-LABEL-SHEET-REMAINDER.md`:
  - Sheet A (66-row subset): **64/66** agree; 2 disagreements (`/mos:mva-brief`, `/mos:rooms`).
  - Sheet B (47-row remainder): **45/47** agree; 2 disagreements (`/mos:rs-fetch`, `/mos:show`).

**D-21 rubric change and re-run**
- Found at the validation desk: the flagged predicate changed from "outside the machine" to "always stop for the navigator" (D-21), because the navigator's own per-command rulings (export, update, doctor = flag; admin, rs-fetch = no flag) could not be explained by "outside the machine" alone -- some flags are about the plugin's own install/update/repair surface or a branded outward artifact, not an external write.
- Because the definition of "irreversible" itself changed, both blind labelers (fresh agents, blind to each other) re-ran the full 113-row registry under the new rubric rather than patching the old 66+47 row labels (D-16's blind-before-reveal order preserved: both filled sheets committed together, before any A-vs-B comparison).
- D-21 two-labeler agreement: **106/113** (94%); 7 disagreements (`/mos:heal`, `/mos:mva-brief`, `/mos:new-surface`, `/mos:scheduled-tasks`, `/mos:setup`, `/mos:show`, `/mos:vault`) (`356-06-SUMMARY.md`).

**The 14 navigator rulings**
- 7 resolve the D-21 sheet-A-vs-sheet-B disagreements listed above.
- 7 resolve boundary cases the navigator reviewed directly at the desk even though both labelers already agreed on them (navigator ruling takes precedence per the plan's stated order): `/mos:admin`, `/mos:doctor`, `/mos:export`, `/mos:rs-fetch`, `/mos:update`, `/mos:wiki`, `/mos:rooms`.
- Source: `356-NAVIGATOR-RULINGS.json` (commit `3ccc1a1ff`), transcribed into the answer key without paraphrase.

**Answer key (`data/jev-labels/command-irreversibility.json`)**
- **11 flagged** (irreversible: true) / **102 not flagged**, covering all 113 registry commands.
- 99 rows by two-model-blind-agreement, 14 by navigator-arbitrated ruling. Stated plainly per D-20: this is a model-built, human-arbitrated answer key, not a fully human-labeled one.

**Live Jev build (`data/command-irreversibility-ledger.json`, `356-LIVE-BUILD-OUTCOME.json`)**
- `jev_model`: jev-1.13.0.
- **Threshold T = 0.23**, `threshold_set_by`: `/mos:new-surface` (the labeled-true command that scored lowest). **Margin above the highest labeled-false score below T: 0.02.** Zero misses: all 11 labeled-true rows scored >= T.
- **False alarms: 4** (`/mos:mva-brief`, `/mos:mva-report`, `/mos:research`, `/mos:setup`). All four confirmed not in the 31-command chain-run set, so the D-14 appeal gate did not trip (`appeal_gate_tripped: false`) and the build shipped them flagged per D-14's "ship flagged, extra halt costs one gate" rule for non-chain-run commands.
- **Flagged total: 15** (the 11 labeled-true plus the 4 non-chain-run false alarms).
- **Commands the ledger newly forces to halt at runtime** -- computed by intersecting the 15 flagged commands against the registry's `autonomous_safe: true` rows (the other 13 flagged commands are already `autonomous_safe: false`, i.e. already material via an older signal, so the ledger only confirms them): **2** -- `/mos:research` (a false alarm) and `/mos:show` (labeled-true).
- **Cost and calls:** `jev_calls: 113`, `input_tokens: 302295`, `output_tokens: 2486`, `estimated_cost_usd: 0.01269639` (**~$0.013**, vendor-claimed rate, unverified, 42 USD per billion input tokens). No per-call latency was captured (the builder does not report it).
- **Key scrub:** the dev-time key was loaded once via `client.loadKey`, used only in process memory, and never appears in any committed file -- confirmed by `356-LIVE-BUILD-OUTCOME.json.key_scrub` (`key_found: false` across the build log, raw scores, and shipped ledger) and re-confirmed in this plan's own verification pass (`grep -rl "sk-356-SENTINEL-DO-NOT-SHIP" data/` returns 0 files; `test-356-egress.cjs`'s real-key-absence leg passes against all 129 files under `data/`).

**Appeal gate (D-14)**
- **Not triggered.** `356-APPEAL-SHEET.md` and `356-LIVE-BUILD-OUTCOME.json` both record `appeal_gate_tripped: false`, `appeal_items: []`, `chain_run_false_alarms: []`. Tasks 2 and 3 of plan 356-12 (navigator ruling, rebuild) were correctly skipped.

## Phase verification (this plan, 356-13)

Run with `env -u TYPESAFE_API_KEY` throughout.

1. `bash tests/run-all-356.sh` -> `PASSED=25 FAILED=0 SKIPPED=0`.
2. `node tests/test-264-b3-frozen.cjs` -> `PASS (29 checks)`.
3. Every chain suite from the 356-03 baseline list, run twice (default env, shipped ledger present; and `MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent/356.json`, ledger absent):

| Suite | 356-03 baseline | Present (shipped ledger) | Absent (missing ledger) |
|---|---|---|---|
| tests/test-264-b3-frozen.cjs | 0 | 0 | 0 |
| tests/test-larry-handoff-seam.cjs | 0 | 0 | 0 |
| tests/test-chain-executor-gate.cjs | 0 | 0 | 0 |
| tests/test-chain-executor-loop.cjs | 0 | 0 | 0 |
| tests/test-chain-executor-verdict.cjs | 0 | 0 | 0 |
| tests/test-chain-executor-fable-mode.cjs | 0 | 0 | 0 |
| tests/test-chain-executor-part8-leak.cjs | 0 | 0 | 0 |
| tests/test-bch-09-forced-material.cjs | 0 | 0 | 0 |
| tests/test-ignite-on-runchain.cjs | 0 | 0 | 0 |
| tests/test-201-bounded-retry.cjs | 0 | 0 | 0 |
| tests/test-264-flagship-ralph.cjs | 0 | 0 | 0 |
| tests/test-354-chain-resume-identity.cjs | 0 | 0 | 0 |
| tests/test-act-on-runchain.cjs | 0 | 0 | 0 |
| tests/test-pipeline-on-runchain.cjs | 0 | 0 | 0 |
| tests/test-harness-167-verdict.cjs (pre-existing, unrelated) | 1 | 1 | 1 |
| lib/workflow/command-resolver.test.cjs (pre-existing, unrelated) | 1 | 1 | 1 |

Every SPEC R5(c) ledger-absent run equals its pre-356 baseline exactly. No new regression in either environment.

4. The 353 suites against their 356-02 baselines: `test-353-ledger-shape.cjs` PASS=13 FAIL=6 (matches, pre-existing red per 356-RESEARCH.md Pitfall 5), `test-353-grader-agreement.cjs` PASS=30 FAIL=0 (matches), `test-353-release-wiring.cjs` PASS=8 FAIL=0 (matches), `test-353-tripwires.cjs` all three legs green (matches).
5. `node scripts/build-command-irreversibility-ledger.cjs --check` -> `OK (113 entries, T=0.23, mode=jev-live)`, exit 0, zero WARN lines.
6. No key material: `grep -rl "sk-356-SENTINEL-DO-NOT-SHIP" data/ | wc -l` -> 0. `test-356-egress.cjs` real-key-absence leg -> PASS (129 data files scanned, absent).
7. Tripwires: `test-356-tripwires.cjs` -> PASS (7 checks). `test-353-tripwires.cjs` -> PASS=5 FAIL=0.

**One out-of-scope drift found during this run, not caused by Phase 356:** `bash tests/run-all-264.sh` reported `PASS=11 FAIL=3` today, one more failure than the 356-03/356-12 baseline of `PASS=12 FAIL=2`. The extra failure is `node scripts/build-connector-registry.cjs --check` reporting `data/connector-registry.json` and `data/mcp-tool-connectors.json` as STALE. Root cause traced to `git status --short`: `lib/mcp/tools/claim-verify.cjs` carries an uncommitted, unowned peer diff at verification time (none of Phase 356's `files_modified` list touches the connector registry, the MCP tool surface, or `lib/mcp/`). Per the executor's scope-boundary rule, this is logged to `deferred-items.md` and left unfixed by this plan; it is not a Phase 356 regression, and it does not touch any chain-run command's autonomous_safe expectation. The two known-red arms from the 356-03/356-12 baseline (frozen-166 passthrough, chain-executor.cjs zero-diff arm) are present unchanged inside that same run.

8. D-12 re-read (see "Larry contract (D-12)" below).

## Rulings and deviations

- **D-14 (Jev judges, the navigator audits):** every ledger entry's `flag` is `p_irreversible >= T`; the answer key sets T and audits every disagreement. The appeal gate is a chain-run-only backstop -- it never fired this build.
- **D-15 (threshold failure rule):** T = 0.23 is the highest value at which every labeled-true row scores at or above it; zero misses confirmed.
- **D-16 (blind-before-reveal):** enforced by git commit ancestry at every round (66-row sheet, 47-row remainder, both 113-row D-21 sheets) -- every blind sheet's fill commit precedes the corresponding reveal.
- **D-17 (frozen-test re-pin):** `tests/test-264-b3-frozen.cjs`'s `isIrreversibleStep` pin was re-pinned once (356-03), with a written reason above `PINNED_HASHES`; the other five Canon Part 3 pins are unchanged, confirmed again in this plan's `--check` run (PASS, 29 checks).
- **D-18 (353 baselines, unowned diffs):** `scripts/eval-icm-writers.cjs` and `tests/test-353-{grader-agreement,ledger-shape}.cjs` carried unowned, uncommitted peer diffs throughout Phase 356 (still true at 356-13 verification time). 356 never edited, stashed, or reverted them; the 353 builder refactor was correctly DEFERRED (see "Deferred" below).
- **D-19 (shared client, append-only tripwire list):** `HOOKS_BANNED_LEDGER_SCRIPTS` in `tests/test-353-tripwires.cjs` now carries 5 entries (`eval-icm-writers`, `build-section-command-ledger`, `jev-devtime-client`, `build-command-irreversibility-ledger`, `irreversibility-answer-key`), one per dev-time Jev ledger script across 356, 357 and 354-17, appended rather than folded into a hand-edited regex.
- **D-20 (second blind labeler + arbitration):** applied exactly as specified; the report states plainly (per D-20's own requirement) that the answer key is model-built and human-arbitrated, not fully human-labeled, and gives the agreement rate (106/113, D-21 re-run).
- **D-21 (rubric redefinition):** applied; policy v2 and v3 both use the "always stop for the navigator" wording word for word; the code kept the name `isIrreversibleStep` and the reason `forced_material` throughout, per D-21's own instruction that the SPEC's "irreversible" wording is read as this rubric from now on.
- **D-22 (strategy-then-tactics, Theo-consult-grounded):** policy v3's `instructions` opens with one strategy sentence before the tactical rubric; every `boundary_cases` entry carries a bracketed strategic tag. No schema change.

**Cross-session incidents observed during Phase 356 (not Phase 356 bugs, recorded for the record):**
- **`gsd-tools query commit` whole-index sweep (`f7ec913b6`):** a concurrent peer session (jsagi-25, Phase 354-10) ran a commit tool that swept 356-07's staged Task 1 diff (`scripts/jev-devtime-client.cjs`'s `material_step_ledger` profile addition, `tests/test-356-egress.cjs`) into its own unrelated commit. Content was verified byte-identical to what 356-07 intended (`git diff HEAD` empty against the intended files); not reverted, not re-committed. Every subsequent 356 commit used a single tightly-coupled `git add -f ... && git commit ... --only -- ...` to close the race window.
- **356-10 API spend-limit pause and resume:** a mid-run API spend-limit error paused Task 1 partway through (after the `runCheck` function body was written, before the CLI branch was wired). On resume, `git diff` confirmed the uncommitted partial edit was intact and syntactically consistent; work continued from that point with no rework.
- **Security-test narrowing (`a57a0c0ee`, navigator-approved):** `tests/test-356-*.cjs`'s blind-sheet leak check originally used a bare `/boundary/i` pattern, which false-positived on the registry's own Canon Part 8 wording ("Part-8 boundary gate") appearing in real command text. Narrowed to the policy's actual `boundary_cases` field term (still caught in any spelling), approved by the navigator in session.

## Deferred

From `deferred-items.md`:

- **356-02: `scripts/build-section-command-ledger.cjs` refactor DEFERRED.** `scripts/jev-devtime-client.cjs` was extracted and proven parity-equivalent to the pre-extraction guard (16-case fixture); the 353 builder itself was left byte-identical because its unowned consumers (`scripts/eval-icm-writers.cjs`, `tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`) still carry uncommitted peer diffs as of this report. A full 9-step recipe is written for whoever finds all four paths clean.
- **356-09 (resolved in 356-08):** the missing `/mos:vault` boundary case, initially deferred, was closed in 356-08's policy v3 lock.
- **356-08 validation-desk items, out of scope for Phase 356:** (1) the `/mos:export` branding requirement -- the Mindrian logo and "mindrianos / www.mindrian-os.com" mark must always remain on exported artifacts; no 356 file enforces this at the export-command level. (2) the `/mos:mva-brief` HITL idea -- the navigator's suggestion to add a conditional AskUserQuestion gate before its deploy step; not built. (3) Theo-sync notes: `/mos:new-surface` needs a mirrored node set in Theo when a surface registers; `/mos:scheduled-tasks` should engage Theo to offer suggestions; neither is wired.
- **This plan (356-13): connector-registry staleness** caused by an unowned, uncommitted peer diff to `lib/mcp/tools/claim-verify.cjs` (see "Phase verification" above). Logged to `deferred-items.md`, not fixed here.

## Larry contract (D-12)

Re-read at execute time, per D-12's instruction, rather than assumed from memory:

- **(a) Post-Gate Handoff still says runChain halts at the first material step.** `git log -5 -- agents/larry-extended.md` shows the file's most recent commit is `b9398b6a0` (Phase 344, 2026-09-14), unrelated to 356 or 357. The "## Post-Gate Handoff (Phase 166 -- the suggest-to-run seam)" section (lines 70-82) reads today exactly as it did before Phase 356: "runChain auto-runs the autonomous_safe prefix and HALTS at the first material step, returning control to you at that gate," and "runChain runs the autonomous_safe prefix underneath as machinery and halts at the FIRST material (non-autonomous_safe) step."
- **(b) 357's gate-prose shrink has NOT landed.** `.planning/phases/357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re/` contains only PLAN/CONTEXT/SPEC/RESEARCH/BRIEF/PATTERNS files, no SUMMARY files and no commit touching `agents/larry-extended.md`. There is nothing to reconcile yet; the file's halt semantics are exactly what they were before Phase 356.
- **(c) Nothing in `larry-extended.md`, the `larry-personality` skill, the 356 policy, or any 357 policy under `data/jev-policies/` redefines "material" as "irreversible."** `grep -n -i "material\|irreversible\|forced_material" skills/larry-personality/SKILL.md` returns one hit (the "Auto-sequence after an approve" rule), which states the auto-sequence "never runs a material step" and is silent on any equivalence with "irreversible." `data/jev-policies/command-irreversibility.json`'s own `instructions` state the opposite of a conflation: irreversible (the Noul question Phase 356 asks Jev) is explicitly narrower than material (the runtime halt decision) -- a "no" from Jev never clears an existing material flag.
- **(d) `node tests/test-356-larry-contract.cjs` exits 0 and prints `handoff seam with shipped ledger: PASS`** with `data/command-irreversibility-ledger.json` present (confirmed in this plan's verification run; 11/11 checks pass).

**Observation carried forward from 356-03:** the Post-Gate Handoff's parenthetical "(non-autonomous_safe)" was already a simplification before Phase 356 -- an explicit `step.irreversible` flag and, after 356, a ledger-forced `forced_material` step also halt, neither of which is captured by the literal words "non-autonomous_safe." The file is NOT edited by this plan (D-12 forbids it); this is recorded as an observation for whoever next touches that section's wording, most likely 357.

## Theo re-emission (D-13)

**No Theo code changed in Phase 356.** Every 356 artifact -- the policy JSON, the answer-key JSON, the ledger JSON, and the client module (`scripts/jev-devtime-client.cjs`) -- is plain data or pure functions, readable without the plugin working tree. Theo can re-emit the ledger from the pinned `data/` sources holding its own key:

1. Read `data/command-registry.json` (113 commands), `data/jev-policies/command-irreversibility.json` (locked v3 policy), and `data/jev-labels/command-irreversibility.json` (113-row answer key) -- all three are plain, versioned JSON.
2. Recompute each command's staleness hash using the one definition in `lib/core/irreversibility-ledger.cjs`'s `TEXT_HASH_BASIS` constant: sha256 hex of UTF-8 `JSON.stringify([command, teaching, jtbd_summary])`, non-string inputs collapse to `''`.
3. Run a one-to-one port of `scripts/jev-devtime-client.cjs`'s `jev()`/`makeEgressGuard()` seam against the `material_step_ledger` profile (exact-key-set, `must_equal_file` on the policy). D-09's design already keeps the module's error shape compatible for exactly this: every guard violation throws an error naming the refused key (`err.code === 'EGRESS_REFUSED'`, `err.profile`, `err.key`), matching Theo's own egress design of refusing a call carrying any field the tool did not ask for, never silently stripping.
4. Score all 113 commands once each, holding Theo's own vendor key (never the plugin's `~/.secrets/typesafe.env`).
5. Apply the same threshold rule (D-15): T = the highest value at which every labeled-true row scores at or above it; fail loudly if T <= 0 or any labeled-true row is missing a score.

The Theo consult that informed D-22 (the strategy-then-tactics policy framing) was thin on direct gate/irreversibility grounding; the strongest available grounding was the general PWS problem-type ladder. Theo's own recommendation, given that thin direct grounding, was to schedule a Red Teaming pass (`/mos:challenge-assumptions`) on the locked policy before it goes live against real Jev calls again -- not yet scheduled, carried forward as an open item. Raw `mcp__theo__*` calls are blocked outright by the Part 8 egress hook (a THEO-04-class finding if attempted directly); every Theo consult in Phase 356 went through the sanctioned `brain_ask` path. `release.sh` Step 5.6 already notifies Theo on every real release per `docs/THEO-NOTIFY-CONTRACT.md`, independent of this phase.

## Open threads (carried to the research trail and to peer sessions)

- The `/mos:mva-brief` HITL prompt idea (navigator's own suggestion, not built).
- Theo mirroring for `/mos:new-surface` and `/mos:scheduled-tasks` (navigator's own notes, not wired).
- The export-command logo/branding rule (styling may change, the Mindrian mark may not move).
- `/mos:validate-proposition` has a registry entry but no commands file (surfaced by a labeler while reading the registry for this phase's blind sheets; not a Phase 356 defect, a pre-existing registry/surface mismatch worth a future phase's attention).
- The deferred 353 builder (`build-section-command-ledger.cjs`) refactor, blocked on the same three unowned peer diffs since 356-02 and still unowned at this report's writing.
- The `gsd-tools` bug surfaced by the whole-index-sweep incident (`f7ec913b6`): a commit helper that stages/commits the whole index rather than only its caller's intended files, which is what let one session's commit sweep up another's staged diff.

## Research trail

Filed at `~/MindrianRooms/rethinking-mindrianos/research/2026-09-23-chain-executor-irreversibility-ledger-356.md`, mirrored byte-for-byte to `~/MindrianOS/research/2026-09-23-chain-executor-irreversibility-ledger-356.md`. Cross-links back to this report; this report cross-links to it above.
