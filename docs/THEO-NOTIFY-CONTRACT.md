---
layer: harness
status: active
canon_parts: [7, 8]
implementing_phase: 349
sibling_contract: docs/RELEASE-CEREMONY-RULING-SYSTEM.md
---

# The Theo Notify Contract (the leading edge)

This document is the durable half of Phase 349 (release-to-Theo leading edge). `.planning/` is
gitignored (`.gitignore:97`, CLAUDE.md WORKSPACE GUARD), so every ruling this phase makes that
lives only in a `PLAN.md` evaporates at the next machine switch. This file is the tracked
survivor: the two halves of place 8, the insertion point with its line evidence, six rulings
with their reasoning written out, the Part 8 boundary, the security terms, Tri-Polar, the layer
declaration, the measured emission census with its recorded contradiction, the R1..R5 scope
table, and the eleven-row WD-349 working-decision ledger all live here, not in `349-01-PLAN.md`.

## Why this contract exists

Phase 343 shipped the LAGGING half of a two-way coupling and can only refuse a release, never
repair the drift: `scripts/release-lib/theo-stamp-gate.sh` blocks release N+1 when Theo never
re-emitted against release N, but it cannot make Theo re-emit. Nothing on the plugin side tells
Theo a version moved; the loop is entirely reactive, never event-driven. This phase builds the
structural mirror image of `scripts/release-lib/theo-stamp-gate.sh`, and the whole design
discipline is "what would the stamp gate do here, in reverse" (Canon Part 7). The measured drift
that motivates it: `mappedBy command-registry@2.0.0-beta.12` against a repo at `2.0.0-beta.40`,
five betas of silence with nothing able to fail.

## The measured state, stated once and never softened

Measured live on 2026-09-16 at commit `df64b994f` (`git log --oneline -1`), repo version
`2.0.0-beta.40` (`node lib/core/repo-version.cjs`):

- `grep -rn "repository_dispatch\|theo-resync\|theo_resync"` across every tracked `.sh`, `.cjs`,
  `.js`, `.yml`, `.yaml`, `.json` and `.md` file, excluding `.planning/`: **0 call sites**. Zero
  hits anywhere in this repo's own tracked source.
- `.github/workflows/` contains exactly one file, `agentshield-scan.yml`, unrelated to Theo.
- `grep -rn "registryHash" lib/ scripts/ data/`: exactly one hit, the doc-comment in
  `scripts/release-lib/theo-stamp-gate.sh` describing a field Theo's own API response carries.
  Nothing in this repo computes a hash of `data/command-registry.json` today.

These three measurements match the planner's own 2026-09-15 scan exactly (`349-RESEARCH.md`
Finding 3-4): this phase is genuinely starting from zero, not closing a gap this repo already
partially built.

**The contradiction, named as an open finding, not explained away.** A live `theo_health` read on
2026-09-15 reported `payloads_emitted_since: 2`, `payloads_applied_since: 0`,
`materiality: "not-measured"`, `finding: "beyond-threshold"` against `baseline_stamp:
command-registry@2.0.0-beta.12`. This repo's own source scan on 2026-09-16 found **0 call sites**
that could have emitted anything. Both cannot be simply true of the same wire. Two candidate
explanations, neither confirmed: (1) something outside this repo already emits against the same
`theo-resync` event class, or (2) Theo's counter measures a different event class entirely and
the field name is coincidental. This phase does NOT resolve which. The owner of that
investigation is the Theo repo's own consuming phase, not this plan, and this paragraph exists so
a future reader is not surprised by the discrepancy rather than discovering it cold.

## The two halves of place 8

| Half | File | Step | Timing | Direction | Verifies | Failure mode | Opt-out |
|---|---|---|---|---|---|---|---|
| LAGGING (shipped) | `theo-stamp-gate.sh` | Step 0.6 | pre-mutation | a READ | retroactively, at the start of the NEXT cut | fails closed on mismatch or unreadable | `--no-theo-check` |
| LEADING (this phase) | `theo-notify-gate.sh` | Step 5.6 | post-push | a WRITE | immediately, on the cut that just landed | fails closed on `SEND FAILURE` | `--no-theo-notify` |

These are ONE place in RULE 5's enumeration, not two. RULE 5's numbered list has exactly eight
items after this phase, unchanged in count. Treating the leading half as a ninth place re-triggers
the WD-12 disease Phase 343 already fixed once, when the lockstep count was stated four different
ways across four files.

## The insertion point, with its line evidence

After the Step 5.5 `SKIP_TAG_VERIFY` block's closing `fi` (`release.sh:1416`) and before Step
9.8's comment block (`release.sh:1418`). It cannot be earlier: the tag must provably be at origin
first, which is Step 5.5's own job, so notifying Theo before the tag is confirmed pushed would
tell Theo about a release that might not have landed. It cannot be later: Step 9.8 is a hard-abort
acceptance gate, and a notify that only fires on a fully green post-publish tree would be silent
exactly when Theo most needs to know a version landed, since a real release has already happened
by Step 9.

## Ruling 1, the version source (WD-349-5)

The trap: Step 7.5 at `release.sh:1276-1282` rewrites `.claude-plugin/plugin.json`'s version to
`$NEXT_VERSION` (the beta.N+1 dev placeholder) BEFORE this insertion point is reached. The
sibling gate reads disk safely only because it runs at Step 0.6, before any mutation; this step
runs at Step 5.6, after Step 7.5 has already mutated the file. The ruling: pass `$NEW_VERSION`
(the bash variable computed once at Step 1 and never reassigned) as an explicit argument, never
re-derive it from `plugin.json` or `lib/core/repo-version.cjs` at the call site. The consequence
of getting it wrong, in one sentence: Theo re-emits its command layer stamped against a version
that was never released, permanently mis-stamping Theo relative to what users can actually
install.

## Ruling 2, what registryHash means (WD-349-4)

The question, stated honestly first: the ratified carrier confirmed the four `client_payload`
field NAMES, not the hash algorithm or the field's direction of meaning. The live evidence, dated:
`command_neighborhood('/mos:act')` on 2026-09-15 returned a per-command `registryHash` of
`0091bea38562b7f8f8ec49d3b48243b449b22869b7a8f4f2d6f420f1ad5673df` alongside `mappedBy:
command-registry@2.0.0-beta.12`. Theo already computes and stores its own hash, keyed to whatever
registry state it last mapped from. The reasoning: echoing back a value Theo already holds tells
Theo nothing new; what Theo cannot know is the registry's state NOW, at the commit it is about to
pull, so the plugin sends its own live SHA-256 and Theo diffs against it. This CORROBORATES
`349-RESEARCH.md`'s assumption A1 rather than overturning it, and the evidence postdates the
research document by hours, not days. The mechanics: `git show <release_sha>:data/command-
registry.json` piped to a SHA-256 digest, the tagged commit's bytes, never the working tree's,
because by Step 5.6 the tree is already on Commit B.

## Ruling 3, dry-run is a preview line, not a real call (WD-349-6)

The asymmetry, stated plainly: Step 0.6's gate performs a REAL read under `--dry-run` by design
(WD-20), because a read is side-effect-free and `doctor --acceptance` shells `release.sh
--dry-run` constantly. A dispatch is a WRITE. Copying that carve-out to a write would fire a real
event at Theo on every acceptance run, which happens far more often than a real release. The
wrong test assertion, named so nobody writes it: "under DRY_RUN the dispatch was invoked but the
failure was ignored" tests the wrong behavior; the correct assertion is "the dispatch command was
never invoked at all". The coupled edit this ruling requires: `Step 5.6` must enter
`scripts/doctor.cjs`'s `release-dry-run-output` `expectedSteps` array in the same commit as the
preview line, so the preview itself is gated and the blocker never goes red against a half-landed
pair.

## Ruling 4, failure classes are named and never conflated (NOTIFY-06)

Three distinct outcomes, three distinct output tokens: `SENT` (success), `SKIPPED` (the audited
`--no-theo-notify` opt-out), and `SEND FAILURE` (non-2xx, network failure, `gh` absent, or no
`timeout` binary on PATH). The discipline this copies: `theo-stamp-gate.sh` asserts `READ FAILURE`
before it ever checks `MISMATCH`, so a transport problem is never reported as a verdict; this
gate's `SEND FAILURE` plays the same role relative to `SKIPPED`. The `timeout` rule: a missing
`timeout` binary fails closed rather than running the dispatch unbounded, exactly as WR-02 ruled
for the sibling gate.

## Ruling 5, the audit record is untracked (WD-349-7)

The trap, in full: a tracked write at Step 5.6 lands AFTER Step 8's clean-tree guard, after both
release commits, and after the push, so it would leave the working tree dirty at the end of every
successful release and red the NEXT cut's Step 2.5 `--pre-flight` clean-tree gate. The established
precedent: `~/.mindrian/` is this repo's local side-channel directory
(`lib/statusline/cockpit-signals.cjs:84`, `lib/statusline/cockpit-telemetry.cjs:54`), and
`release.sh:1433` already documents `~/.mindrian/recovery-log.txt` as a release audit trail. The
ruling: append one line per real release to `~/.mindrian/theo-notify-log.txt`, on success AND on
send failure, overridable via `MINDRIAN_THEO_NOTIFY_CMD`'s sibling env var
`MINDRIAN_THEO_NOTIFY_LOG` so a hermetic test never touches a real HOME. The durable
cross-machine record is the separate, one-time `docs/OPEN-HANDOFFS.md` row, written at phase
time, not at release time.

## Ruling 6, the cross-session notify is a tracked file, not a push (WD-349-8)

Stated plainly: no mechanism available to a bash script can push a notification into a different,
already-running Claude Code session. There is no IPC channel, no session registry, no shared bus.
The REAL machine-to-machine notify IS the `repository_dispatch` itself, which reaches Theo's CI in
seconds with no human session involved at all. The weaker "someone is watching right now" layer is
satisfied by the same tracked-file handoff pattern this repo already uses everywhere else
(`CLAUDE.md`'s WORKSPACE GUARD, `docs/OPEN-HANDOFFS.md`). Do not design a feature around detecting
whether a live Theo session exists.

## The Canon Part 8 boundary

The closed four-key set: `version` (a semver string), `commit` (a git sha), `registryHash` (a
SHA-256 hex digest of a generated, tracked, non-user-data file), `command_registry_path` (the
literal string `data/command-registry.json`). No room content, no user bytes, no path under
`~/MindrianRooms`, ever. The growth rule: GitHub caps `client_payload` at ten top-level
properties, so any future addition nests under one new key rather than adding many top-level keys,
and any addition is reviewed against Part 8 before merging.

## Security, in the sibling gate's own terms

Never print a resolved `GH_TOKEN` / `GITHUB_TOKEN` value or a response body verbatim; print the
outcome class (`SENT` / `SKIPPED` / `SEND FAILURE`) and the four payload values only. Pass every
interpolated value as a discrete argv element, never string-concatenated into the default
command's literal text, copying `theo-stamp-gate.sh`'s WR-01 fix exactly, so a checkout path or a
version string containing a shell metacharacter cannot break out. Bound the call with `timeout 8`
and fail closed when `timeout` is absent (WR-02).

## Tri-Polar (the three surfaces)

One row per `CAPABILITY_MAP` key (`lib/mcp/surface-detect.cjs:22-26`), read live rather than
hand-typed:

| Surface | Runtime presence | Effect reached |
|---|---|---|
| `cli` | none; this is release-engineering machinery invoked from one operator's shell | indirectly, through the command layer Theo re-emits after the notify |
| `desktop` | none | indirectly, same command layer |
| `cowork` | none | indirectly, same command layer |

This is a one-shot bash script invoked by one operator on one machine; it has no runtime presence
on Claude Code, Claude Desktop or Cowork. Its effect reaches all three identically and
indirectly, because what it keeps in sync is the command layer every surface reads from Theo.
State that plainly per surface rather than fabricating a per-surface behavior difference that
does not exist.

## The layer declaration

`layer: harness`, declared against the closed vocabulary Phase 344-01 ships
(`data/layer-declaration-schema.json`'s `_doc.layer_vocabulary`). The one-value rule: this surface
declares the rung it ENGINEERS, never the highest rung it rests on. The counter-argument, answered
in writing: a cross-repo event bus looks like a GRAPH concern because it coordinates two systems,
but the rubric's step-1 GRAPH signal is coordinating agents or steps over SHARED STATE within one
system's own loop, and this is a one-shot scaffolding write with no shared state and no halt.
Rubric step 3 (the surface's job is to add, move, measure or repair tools, memory or scaffolding)
is the match: a release gate that computes a hash over a generated registry and fires a cross-repo
event is scaffolding machinery, coordinating no agents, running no agent cycle to a stopping
condition, assembling no context window, and shaping no wording.

## The scope contract: the roadmap card's five deliverables

There is no `349-CONTEXT.md`. `workflow.skip_discuss` is `true` in `.planning/config.json`, so
this phase was never through a discuss pass and carries no navigator D-01..D-NN locks. The scope
contract is therefore the ROADMAP Phase 349 card itself, reproduced here so no plan silently
narrows it:

| # | Roadmap deliverable | Owned by |
|---|---|---|
| R1 | `release.sh` gains a post-tag step emitting a `repository_dispatch` to `jsagir/theo`, event `theo-resync`, payload `{version, commit, registryHash, command_registry_path}`, plus a local handoff record and a cross-session notify | 349-03 (library), 349-04 (wiring) |
| R2 | The signal is audited in the release log like `--no-theo-check`, RULE 5 place 8 gains its leading half, `--dry-run` reports without sending, an unreachable GitHub API fails the step closed with the same audited opt-out shape | 349-03, 349-04, 349-05 |
| R3 | A hermetic test proves send, dry-run-reports-only, unreachable-fails-closed and payload shape, never calling the live API | 349-02 (RED), 349-03 (GREEN) |
| R4 | `VERSION-BUMP-CHECKLIST.md` and the release-process include name the step; `docs/OPEN-HANDOFFS.md` gains the Theo-side row | 349-05, with the WD-14 contradiction ruled at 349-03's checkpoint |
| R5 | A one-time bootstrap: before the phase closes, Theo has restamped against the current plugin version so the 343-07 gate reads green | **UNRESOLVED.** Put to the navigator at 349-03's blocking checkpoint. Recorded, never silently dropped. See WD-349-9. |

## Working decisions, reversible by the navigator

This table, not `349-01-PLAN.md`, is the durable home for these eleven decisions, because
`.planning/` is gitignored and a decision recorded only in a plan evaporates at the next machine
switch. Every row is Claude's working call, adopted so planning could proceed without stopping
for a ruling; each is a bounded edit to overturn.

| # | Decision | Why | Status | Reverses by |
|---|---|---|---|---|
| WD-349-1 | The requirement prefix is `NOTIFY`, fourteen ids, one family. | Verified free this session: `grep -rohE "\b(NOTIFY\|RESYNC\|DISPATCH)-[0-9]{2}\b" .planning/` returns hits only inside `349-RESEARCH.md`'s own proposal, and `NOTIFY` is not among the 29 live prefixes in `.planning/REQUIREMENTS.md`. Matches the sibling pattern (345 `STRAT`, 346 `ARB`, 347 `SHARED`, 348 `SUPER`). | WORKING | a family-wide rename before execution starts |
| WD-349-2 | The new step is named **Step 5.6**. | Release step numbers in this file are symbolic, not positional, and say so: `release.sh:1368` states "Named 5.5 per Phase 126 Plan 04 CONTEXT.md spec; symbolic, not positional" for a step that runs AFTER Step 9. 5.6 sits adjacent to 5.5 both in file order and in meaning: 5.5 proves the tag reached origin, so 5.6 is the first moment the released artifact provably exists in public and Theo can honestly be told about it. A "Step 9.9" name would imply it runs after Step 9.8, which it does not. | WORKING | one string in `release.sh`, one string in the dry-run preview, one array entry in `scripts/doctor.cjs` |
| WD-349-3 | The opt-out flag is `--no-theo-notify`, a SEPARATE flag from the existing `--no-theo-check`. | These are genuinely independent skip conditions. An operator may want to skip VERIFYING Theo's stamp on one cut (Theo unreachable for reads) while still TELLING Theo about the new version, or the reverse. One flag governing both halves would force an operator with one problem to disable two gates. Research Open Question 3 flagged this as a real fork rather than resolving it; this is the resolution, and it is reversible. | WORKING | collapsing the two into one flag in `release.sh`'s arg loop and both gate signatures |
| WD-349-4 | `registryHash` in the OUTBOUND payload is a PLUGIN-computed SHA-256 of `data/command-registry.json`'s bytes AT THE TAGGED COMMIT, not an echo of Theo's own last-known value. | Research assumption A1 leaned this way and asked for confirmation. It is now corroborated by direct live evidence taken 2026-09-15 AFTER `349-RESEARCH.md` was written: `command_neighborhood('/mos:act')` returns a real per-command `registryHash` (`0091bea3...5673df`) stored alongside `mappedBy: "command-registry@2.0.0-beta.12"`. Theo ALREADY computes and stores its own hash, keyed to whatever registry state it last mapped from. A field Theo already owns is not a field the plugin should be echoing back; what Theo cannot know is what the registry looks like NOW, at the commit it is about to pull. So the plugin sends its own live hash and Theo diffs. This is corroboration of the research lean, not an overturn of it. | WORKING | changing one hash source in `_theo_notify_payload`, and the corresponding arm in `tests/test-349-payload-boundary.cjs` |
| WD-349-5 | The version value is the `$NEW_VERSION` bash variable passed as an explicit argument, NEVER re-derived from disk at the call site. | By the time Step 5.6 is reached, Step 7.5 (`release.sh:1276-1282`) has already rewritten `.claude-plugin/plugin.json`'s `version` field to `$NEXT_VERSION`, the dev placeholder. The sibling `theo-stamp-gate.sh` gets away with reading disk because it runs at Step 0.6, BEFORE any mutation. Copying that read here would notify Theo of an unreleased placeholder version on every single cut. This is the concrete mechanism behind the roadmap's "never the placeholder" risk. | WORKING | n/a as a design; the alternative is the defect this decision exists to prevent |
| WD-349-6 | Under `--dry-run` the real dispatch command is NEVER invoked. The step is one additional preview `echo` line inside the existing dry-run block, exactly like every other post-tag step. | Step 0.6's stamp gate is special-cased to perform a REAL read under `--dry-run` (WD-20) because a read is side-effect-free and `doctor --acceptance` shells `release.sh --dry-run` far more often than a release happens. A dispatch is a WRITE. Copying the read carve-out to a write would fire a real `repository_dispatch` at Theo on every `doctor --acceptance` run. The correct test assertion is "the dispatch command was never invoked at all", not "the failure was ignored". | WORKING | n/a as a design; the alternative is the defect this decision exists to prevent |
| WD-349-7 | The per-release audit record is an APPEND to the untracked `~/.mindrian/theo-notify-log.txt`, never a tracked file written after Step 9's push. | The roadmap asks for "a local handoff file under the plugin repo". Taken literally that is a tracked write that lands AFTER Step 8's clean-tree guard, after Commit A, after Commit B and after the push. It would leave the working tree dirty at the end of every successful release, which reds the NEXT cut's Step 2.5 `doctor --acceptance --pre-flight` clean-tree gate. The honest local record is the established `~/.mindrian/` side-channel (`lib/statusline/cockpit-signals.cjs:84`, `lib/statusline/cockpit-telemetry.cjs:54`, and `release.sh:1433`'s own `~/.mindrian/recovery-log.txt` R.7 audit trail). The DURABLE cross-machine record is the one-time `docs/OPEN-HANDOFFS.md` row (349-05), which is a tracked write made at phase time, not at release time. | WORKING | writing the per-release record into a tracked path and adding it to Step 8's dirty-file allowlist, which is a deliberate and much larger change |
| WD-349-8 | "Cross-session notify when a Theo session is live" is satisfied by the tracked-doc handoff pattern, and the plan says so plainly rather than implying a stronger mechanism. | `release.sh` is a bash script in one operator's shell. It has no IPC channel into a different, already-running Claude Code session, no session registry to detect one, and no shared bus. This repo's own established mechanism for telling a different session something happened is the tracked file (`CLAUDE.md` WORKSPACE GUARD, `docs/OPEN-HANDOFFS.md`). The REAL machine-to-machine notify is the `repository_dispatch` itself, which reaches Theo's CI in seconds with no human session involved. Research assumption A4. | WORKING | the navigator naming a concrete live channel (a GitHub issue comment, a webhook) that does not exist today |
| WD-349-9 | **Deliverable R5 (the one-time bootstrap) is NOT assumed reachable from this repo and is NOT silently dropped.** It goes to the navigator at 349-03's blocking checkpoint with the measured evidence, and 349-06 records the ruling either way. | `349-RESEARCH.md` found no Theo-side consuming CI exists. This repo can fire the dispatch; it cannot make Theo restamp. `release.sh patch --dry-run` printing `theo-stamp-gate: PASS` requires a Theo-side action that lives in a different repository. Shipping four of five deliverables and calling the phase done is exactly the failure Phase 348's D-02 was written to prevent. | WORKING | the navigator ruling it in scope with a named mechanism, or ruling it out with a named owner and a numbered ROADMAP card |
| WD-349-10 | `layer: harness`, against the Phase 344 closed vocabulary. | `data/layer-declaration-schema.json`'s `classification_rubric` step 3: "the surface's job is to add, move, measure or repair tools, memory or scaffolding". A release gate that computes a hash over a generated registry and fires a cross-repo event is scaffolding machinery. It coordinates no agents (not `graph`), runs no agent cycle to a stopping condition (not `loop`), assembles no context window (not `context`) and shapes no wording (not `prompt`). | WORKING | one frontmatter value in `docs/THEO-NOTIFY-CONTRACT.md` |
| WD-349-11 | The pre-phase emission census is MEASURED and its contradiction with Theo's own counter is recorded as an OPEN FINDING with a named owner, not explained away. | A live `theo_health` read on 2026-09-15 reported `payloads_emitted_since: 2` with `payloads_applied_since: 0` against `baseline_stamp: command-registry@2.0.0-beta.12`. A source scan of this repo on 2026-09-16 found ZERO `repository_dispatch` and ZERO `theo-resync` call sites outside `.planning/` documents. Both cannot be simply true of the same wire. Either something outside this repo already emits, or Theo's counter measures a different event class. This phase does not resolve that; it records it so a future reader is not surprised. | WORKING | a Theo-side investigation naming what those two emissions were |

## What later plans in this phase land

This document is authored by `349-01-PLAN.md` alongside `.planning/REQUIREMENTS.md`
(NOTIFY-01..14) and the phase's test aggregator. The code this document describes lands in later
plans in the same phase: `tests/test-349-theo-notify-gate.cjs` and
`tests/test-349-payload-boundary.cjs` (349-02, authored RED),
`scripts/release-lib/theo-notify-gate.sh` (349-03, behind a blocking navigator checkpoint), the
`scripts/release.sh` Step 5.6 wiring plus the `scripts/doctor.cjs` `expectedSteps` entry and
`tests/test-349-release-wiring.cjs` and `tests/test-349-dry-run-never-sends.cjs` (349-04), the
`docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 place 8 amendment plus `.claude/includes/release-
process.md` plus the `docs/OPEN-HANDOFFS.md` Theo-side row and `tests/test-349-docs-lockstep.cjs`
(349-05), and the phase close-out plus the R5 disposition card (349-06).
