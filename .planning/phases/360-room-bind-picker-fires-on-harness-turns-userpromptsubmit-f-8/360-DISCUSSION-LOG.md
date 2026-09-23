# Phase 360: Room-bind picker fires on harness turns (UserPromptSubmit F.8) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 360-room-bind-picker-fires-on-harness-turns-userpromptsubmit-f-8
**Mode:** `--auto`, single pass, run as a subagent with no chain auto-advance. The state.record-session step was skipped because a peer session executing Phase 354 owns STATE.md.
**Areas discussed:** Input source for the verdict, Guard placement in main(), R5 tag re-add and 357 replay compatibility, Fixture format, Test and tripwire files, Tri-Polar, Sequencing

[--auto] Selected all gray areas: Input source for the verdict, Guard placement in main(), R5 tag re-add and 357 replay compatibility, Fixture format, Test and tripwire files, Tri-Polar, Sequencing.
[auto] SPEC found (360-SPEC.md, 9 requirements): loaded as `<spec_lock>`. The discussion covers HOW only.
[auto] No existing CONTEXT, checkpoint or plans: fresh context.

---

## Input source for the verdict

| Option | Description | Selected |
|--------|-------------|----------|
| Stdin first, lead-only fallback, bounded tail read as a veto on lead hits only | Use stdin `origin`/`isMeta` if present (A1). Otherwise the prompt lead decides. Read the transcript tail only when a lead hit or `isMeta` needs R-A's origin or carve-out check. The human path does zero reads | ✓ |
| Always tail-read `transcript_path` | Read the triggering record's `isMeta`/`origin` on every turn | |
| Prompt lead only, never read the transcript | Cheapest. A pasted human tag as the lead is misread (0 observed) | |

**Choice:** [auto] Input source - Q: "How does the hook obtain the triggering record's isMeta/origin?" -> Selected: "Stdin first, lead-only fallback, bounded tail read as a veto on lead hits only" (recommended default)
**Notes:** An always-on tail read would violate the SPEC hook-budget constraint on the human path. Lead-only already passes the R8 carve-out fixture, because Skill bodies and images do not lead with a harness tag. The tail read only refines R-A's origin gate. A1-A3 go to the researcher, and D-03 drops the tail read if stdin carries origin.

---

## Guard placement in main()

| Option | Description | Selected |
|--------|-------------|----------|
| Module-init verdict constant, one early guard in main() plus one at the consumePriorBindingAnswer call | Two lines of control flow. All four emitters and their side writes are skipped together | ✓ |
| Per-emitter guards | Guard inside `emitBindingGate`, `emitNoMatchGate`, `emitStrictModeOverride` and the legacy advisory separately | |
| Guard the whole hook (return before main and the engine block) | Also silences NAV / F.1 and graph findings | |

**Choice:** [auto] Guard placement - Q: "Where does the harness short-circuit sit?" -> Selected: "Module-init verdict constant, one early guard in main() plus one at the consumePriorBindingAnswer call" (recommended default)
**Notes:** Per-emitter guards leave room for a fifth path to be missed. The whole-hook option breaks the SPEC boundary: the NAV engine block keeps running (F.1 minting is out of scope). The planner confirms that `main()` holds only room-resolution work.

---

## R5 tag re-add and 357 replay compatibility

| Option | Description | Selected |
|--------|-------------|----------|
| 360 edits the one HARNESS_LEADS after 357-07 lands, and the run-all-357 replay proves 0 pass->block | Single list, 360's own commit citing R5; update any 357 leg that pins the absence of the tags | ✓ |
| Ask 357-07 to add the tags before it lands | Changes 357's measured R-A outcome mid-flight | |
| Separate UPS-only list in turn-text | Two lists. Breaks R4's "defined in exactly one file" rule in spirit | |

**Choice:** [auto] Tag re-add - Q: "Who owns the R5 edit, and how does it stay compatible with 357's replay?" -> Selected: "360 edits the one HARNESS_LEADS after 357-07 lands, and the run-all-357 replay proves 0 pass->block" (recommended default)
**Notes:** On the Stop path the tag rule is origin-gated, and both tags have 0 stored occurrences, so no Stop verdict should move. The replay is the proof. 360 also adds the stored peer framing if 357-07's prefix measurement did not add it.

---

## Fixture format

| Option | Description | Selected |
|--------|-------------|----------|
| One JSON cases file with a meta `sanitization_statement`, in 357 / 238 corpus conventions | `tests/fixtures/ups-harness-360/cases.json`, placeholder ids and names, stdin plus optional transcript records | ✓ |
| One file per shape | More files, same content | |
| Inline fixtures inside the test | No sanitization_statement home. Harder for the R8 grep | |

**Choice:** [auto] Fixture format - Q: "What fixture format?" -> Selected: "One JSON cases file with a meta sanitization_statement, in 357 / 238 corpus conventions" (recommended default)

---

## Test and tripwire files

| Option | Description | Selected |
|--------|-------------|----------|
| Split by concern: harness-picker (R1-R3, R6), leads (R5), tripwire (R4, R9), snapshot-replay (R7, local-only skip), run-all-360.sh | Each requirement maps to one file. The runner chains run-all-357 and the R3 suites | ✓ |
| One monolithic test-360 file | Harder to run the local-only replay separately | |

**Choice:** [auto] Tests - Q: "Which test and tripwire files?" -> Selected: "Split by concern ..." (recommended default)
**Notes:** Fault injection uses a `--require` preload stub, with no production seam. An env seam in the `navTestThrowing` style is the fallback. The byte-identical leg compares a `git archive` of `PLAN_BASE` against HEAD (357 `--code-root` pattern).

---

## Tri-Polar

| Option | Description | Selected |
|--------|-------------|----------|
| CLI-only fix, no lib/mcp diff, MCP room-bind tests run unchanged in the runner | The defect needs a UserPromptSubmit hook, and hookless surfaces have nothing to suppress | ✓ |
| Add an MCP-side harness check | No defect exists there. It would violate R9 | |

**Choice:** [auto] Tri-Polar - Q: "What is the Tri-Polar note?" -> Selected: "CLI-only fix ..." (recommended default)

---

## Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| The first plan task asserts 357-07's API and run-all-357.sh are on main, else HALT; adapt to the shipped API | Protects against building on a plan-only API | ✓ |
| Plan against the 357-07 plan text without a check | Risk of forking the classifier if 357-07 changes | |

**Choice:** [auto] Sequencing - Q: "How does 360 depend on 357-07?" -> Selected: "The first plan task asserts ... else HALT" (recommended default)

---

## Claude's Discretion

- The turn-text export name and signature (one rule body is mandatory).
- The tail-read bound (64 KB suggested) and the record-match method.
- Whether the R7 replay is a test file or a scripts/ dev tool called by a test.

## Deferred Ideas

- The fire-every-human-turn policy for unbound sessions (T-dia-02). Possible follow-on.
- Dev-repo / no-room answer persistence and suppression.
- Harness-turn behavior of `consumePriorF1Pick`, the NAV engine block and `injectGraphFindings` (the F.1 answer-hijack class; goes with 357's deferred F.1 minting item).
- Auto-continuation turns.
- Stop-hook feedback meta records at UserPromptSubmit (not observed).
