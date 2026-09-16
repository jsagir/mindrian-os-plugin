# Phase 349 Close-Out: Release-to-Theo Leading Edge

Status: CLOSED, 2026-09-16
Phase: 349 (release-to-theo leading edge, graph-engineering learning, synchronous update between coupled systems)
Ledger: `docs/THEO-NOTIFY-CONTRACT.md` (cited throughout, not restated)
Validation map: `.planning/phases/349-release-to-theo-leading-edge-graph-engineering-learning-sync/349-VALIDATION.md`

This document is the tracked record of what Phase 349 shipped, what it measured, what it
deliberately did not take, and who owns the follow-on. `.planning/` is gitignored in this
repository (`.gitignore:97`), so a reader on another machine cannot open `349-RESEARCH.md`,
`349-LANGTALKS-CONSULT.md`, or any PLAN/SUMMARY/VALIDATION file this phase produced. Everything
load-bearing lives here, in `docs/THEO-NOTIFY-CONTRACT.md`, or in the code itself.

---

## One: What shipped

| Artifact | What it does | NOTIFY id closed |
|---|---|---|
| `scripts/release-lib/theo-notify-gate.sh` (`mos_theo_notify_gate` + three helpers, 340 lines) | Fires the `repository_dispatch`, computes `registryHash` from the tagged commit, mirrors `theo-stamp-gate.sh`'s house rules (no `set -e`, `${VAR:-}` guarded, safe to source twice, never prints a token) | NOTIFY-01, NOTIFY-03, NOTIFY-06, NOTIFY-11 |
| `scripts/release.sh` (source guard, `--no-theo-notify` flag, Step 5.6 preview line and call site) | Wires the gate at Step 5.6, between Step 5.5's tag verification and Step 9.8, passing `$NEW_VERSION` and the tag-re-derived commit sha as explicit arguments, never re-reading disk | NOTIFY-02, NOTIFY-04, NOTIFY-05 |
| `scripts/doctor.cjs` (`Step 5.6` added to `release-dry-run-output`'s `expectedSteps`) | Gates the preview line in the same commit as the wiring, so the blocker never goes red against a half-landed pair | NOTIFY-05 |
| `tests/test-349-theo-notify-gate.cjs` (9 arms) | Hermetic proof of real-mode success, send failure, dry-run non-invocation, the audited skip, the two failure classes, the missing-`timeout` fail-closed path, shell-metacharacter safety, the audit log, and token non-disclosure | NOTIFY-07 |
| `tests/test-349-payload-boundary.cjs` (7 arms) | Hermetic proof of the closed four-key payload, the GitHub cap headroom, hash correctness against an independent digest, the tagged-commit-not-working-tree distinction, and the placeholder-version trap | NOTIFY-08 |
| `tests/test-349-release-wiring.cjs` (17 checks) | Static proof of the call-site position, argument order, the sha source, and zero disk-version reads at or after Step 5.5 | NOTIFY-02 |
| `tests/test-349-dry-run-never-sends.cjs` (8 checks) | Live-shelled proof that a real `bash scripts/release.sh patch --dry-run` invokes no dispatch, writes no log, and leaves the tree byte-identical | NOTIFY-05 |
| `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 place 8 (amended in place) | Describes both halves of the Theo coupling (lagging + leading) as one place, still exactly eight numbered places | NOTIFY-09 |
| `.claude/includes/release-process.md` ("Telling Theo" subsection) | Names Step 5.6 in every session's own pinned context, points at RULE 5 as the single home | NOTIFY-10 |
| `docs/OPEN-HANDOFFS.md` (dated Theo-side row) | Names exactly what Theo's own consuming CI must do on receipt, with a named owner and the acceptance number | NOTIFY-12 |
| `docs/THEO-NOTIFY-CONTRACT.md` | The durable ledger: six rulings, eleven working decisions, the R1..R5 scope table, the ratified navigator disposition, the measured census | NOTIFY-13, NOTIFY-14 |
| `.planning/ROADMAP.md` (`### Phase 351:` card) | The real, numbered, scoped sibling card for the deferred Theo-side consuming-CI work | NOTIFY-14 |
| Fourteen `tests/test-349-*.cjs` legs plus `tests/run-all-349.sh` | The phase's own proof surface: 14 legs, `PASS=14 FAIL=0 SKIP=0 EXPECTED-RED=0` | all fourteen |
| `.planning/REQUIREMENTS.md` | NOTIFY-01..14, all fourteen closed with a `Measured:` clause naming a real command and its observed result | all fourteen |

Every row names a real path that exists on disk as of this close.

---

## Two: What was measured

The full sweep, this session (2026-09-16), every command run before a single `Measured:` clause
was written:

- `bash tests/run-all-349.sh`: `PASS=14 FAIL=0 SKIP=0 EXPECTED-RED=0` (real 3m25.670s, timed).
- `node tests/test-349-theo-notify-gate.cjs`: exit 0, 9/9 checks. `node
  tests/test-349-payload-boundary.cjs`: exit 0, 7/7 checks. `node tests/test-349-release-wiring.cjs`:
  exit 0, 17/17 checks. `node tests/test-349-dry-run-never-sends.cjs`: exit 0, 8/8 checks. `node
  tests/test-349-contract-doc.cjs`: exit 0, 12/12 checks. `node tests/test-349-docs-lockstep.cjs`:
  exit 0, 12/12 checks.
- `node scripts/doctor.cjs --acceptance`: `20/20 points passed`, unregressed against 349-03's
  baseline.
- `node scripts/run-harness.cjs --check`: `9 pass, 0 fail, 4 ghost, 2 declared, 15 total`, exit 0.
  `node scripts/check-substrate.cjs`: exit 0 (informational baseline, no violation introduced by
  this phase).
- `node scripts/build-connector-registry.cjs --check`, `node
  scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`:
  all `OK`, unchanged surface count -- this phase shipped zero invocable surfaces (release
  scripting only).
- `node scripts/check-layer-declaration.cjs`: `OK: 285 surfaces enumerated, 248 declared, 37
  exempt`, unchanged. `node scripts/check-shape-declaration.cjs --check`: exit 0, 54 advisory WARN
  entries, unchanged from the 348-08/09 baseline, none touching a file this phase wrote.
- `node tests/test-343-theo-stamp-gate.cjs` and `node tests/test-235-release-shape-gate.cjs`: both
  exit 0 (7/7, 5/5), the sibling gate and the release-shape sentinel region both unregressed.
- **The dry-run safety proof, run live and recorded in this task.** `S=$(git status --porcelain);
  bash scripts/release.sh patch --dry-run` with `MINDRIAN_THEO_NOTIFY_CMD` pointed at a
  sentinel-creating command in a temp dir and `MINDRIAN_THEO_NOTIFY_LOG` pointed at a temp path:
  exit 0, `Step 5.6` appeared 4 times in stdout, the sentinel file did NOT exist afterward, the
  audit log did NOT exist afterward, and `git status --porcelain` was byte-identical before and
  after.
- **The re-measured emission census.** The one real dispatch invocation
  (`gh api repos/jsagir/theo/dispatches`) exists in exactly one file:
  `scripts/release-lib/theo-notify-gate.sh`. A broader keyword scan for the literal tokens
  `repository_dispatch`/`theo-resync` across every `.sh`/`.cjs` file also matches
  `scripts/release.sh` (the dry-run preview line and the Step 5.6 header comment) and
  `scripts/doctor.cjs` (a maintenance-note comment) -- 3 files total, 2 of which are descriptive
  text this phase deliberately added, not additional call sites. The documentation reference
  count is 4 files (`.claude/includes/release-process.md`, `docs/THEO-NOTIFY-CONTRACT.md`,
  `docs/RELEASE-CEREMONY-RULING-SYSTEM.md`, `docs/OPEN-HANDOFFS.md`).
- **The R5 acceptance probe, run live.** `bash scripts/release.sh patch --dry-run 2>&1 | grep
  theo-stamp-gate` prints `[DRY RUN] theo-stamp-gate: MISMATCH -- Theo's stamp is
  command-registry@2.0.0-beta.12, expected command-registry@2.0.0-beta.40`.

**The headline, stated in plain words and never softened: these are two separate claims, and a
reader must be able to tell them apart.**

- **The plugin side is done and proven.** Step 5.6 fires on every real cut; the version on the
  wire is provably the released version and not the next-bump placeholder (the argument wins over
  disk across two calls with disk mutated in between, per `tests/test-349-payload-boundary.cjs`
  arm 5); the payload is a closed four-key set, asserted by `deepStrictEqual` on a sorted key
  array; a dry-run is proven live to send nothing and leave the tree byte-identical; a send
  failure fails the cut closed as a named `SEND FAILURE`, distinct from a named `SKIPPED`
  (the `--no-theo-notify` opt-out).
- **Whether Theo ACTS on the event is not this repo's to prove** and was measured at
  `payloads_applied_since: 0` on 2026-09-15. The current `theo-stamp-gate` probe line reads
  `MISMATCH -- Theo's stamp is command-registry@2.0.0-beta.12, expected
  command-registry@2.0.0-beta.40`, verbatim, on 2026-09-16. The reason in one sentence: this repo
  can fire the dispatch; it cannot make Theo restamp; the coupling's repair is one CI job away,
  owned by the `jsagir/theo` repository, tracked as Phase 351 below.

---

## Three: The emission-count finding, carried forward

Theo reported `payloads_emitted_since: 2` and `payloads_applied_since: 0` on 2026-09-15 while this
repo's own source scan on both 2026-09-16 (pre-phase, `docs/THEO-NOTIFY-CONTRACT.md`) and
2026-09-16 (post-phase, this task) found the real dispatch invocation string
(`gh api repos/jsagir/theo/dispatches`) in exactly zero files before this phase and exactly one
file (`scripts/release-lib/theo-notify-gate.sh`) after it. Both numbers cannot be simply true of
the same wire absent one of two explanations, neither confirmed:

1. Something outside this repo already emitted against the same `theo-resync` event class (a
   manual test dispatch, a different repository, or a hand-run `curl`/`gh api` call), and nothing
   on the consuming side acted on it because no consuming CI job exists yet.
2. Theo's counter measures a different event class entirely and the field name `payloads_emitted_since`
   is coincidental to this phase's `theo-resync` event.

What it would change if resolved either way: if (1), this phase added a second channel firing the
same event class, and the two emission sources need reconciling before Theo's own counter can be
trusted as ground truth for `theo-resync` specifically. If (2), the drift baseline this phase
measured (`0 -> 1` call sites) is the correct and complete picture, and Theo's counter is not
informative about this coupling at all. This phase does NOT resolve which. The owner of that
investigation is the Theo repo's own consuming phase (Phase 351, registered below), not this
plan; this paragraph exists so a future reader is not surprised by the discrepancy rather than
discovering it cold.

---

## Four: The six rulings, in one table

| Ruling | Verdict | Where recorded | What it forecloses |
|---|---|---|---|
| Version source (WD-349-5) | `$NEW_VERSION` is passed as an explicit argument, never re-derived from disk at the call site | `docs/THEO-NOTIFY-CONTRACT.md`, Ruling 1 | Notifying Theo of the `$NEXT_VERSION` dev placeholder on every single cut, since Step 7.5 has already rewritten `plugin.json` by the time Step 5.6 runs |
| `registryHash` meaning (WD-349-4, RULED at 349-03) | A plugin-computed live SHA-256 of the tagged commit's bytes, never an echo of Theo's own already-held value | `docs/THEO-NOTIFY-CONTRACT.md`, Ruling 2 and Navigator Ratification | A field Theo already owns being echoed back and telling Theo nothing new |
| Dry-run is a preview line, not a real call (WD-349-6) | The real dispatch command is never invoked under `--dry-run`; one additional `echo` line, same as every other post-tag step | `docs/THEO-NOTIFY-CONTRACT.md`, Ruling 3 | A real `repository_dispatch` firing at Theo on every `doctor --acceptance` run |
| Failure classes named and never conflated (NOTIFY-06) | Three distinct outcomes and tokens: `SENT`, `SKIPPED`, `SEND FAILURE`; a missing `timeout` fails closed rather than running unbounded | `docs/THEO-NOTIFY-CONTRACT.md`, Ruling 4 | A transport problem being reported as a verdict, or a hung GitHub API blocking the release train |
| Audit record is untracked (WD-349-7) | Append to `~/.mindrian/theo-notify-log.txt`, never a tracked write after Step 9's push | `docs/THEO-NOTIFY-CONTRACT.md`, Ruling 5 | Dirtying the working tree after every successful release and redding the next cut's Step 2.5 clean-tree gate |
| Cross-session notify is a tracked file, not a push (WD-349-8) | The tracked `docs/OPEN-HANDOFFS.md` row is the honest implementation; the REAL machine-to-machine notify is the dispatch itself | `docs/THEO-NOTIFY-CONTRACT.md`, Ruling 6 | Designing a feature around detecting whether a live Theo session exists, which no mechanism in this repo can do |

Full reasoning for each lives in `docs/THEO-NOTIFY-CONTRACT.md`; it is not duplicated here.

---

## Five: The trap this phase avoided

Stated plainly with its file and line: by the time Step 5.6 runs, Step 7.5 (`release.sh:1276-1282`)
has already rewritten `.claude-plugin/plugin.json`'s `version` field to `$NEXT_VERSION`, the
beta.N+1 dev placeholder. A naive implementation that read the version the way the sibling stamp
gate reads it (`theo-stamp-gate.sh` gets away with a fresh disk read only because it runs at Step
0.6, before any mutation) would have notified Theo of an unreleased version on every single cut,
silently, forever -- permanently mis-stamping Theo relative to what users can actually install.

Two mechanical guards prevent it: (1) the gate takes the version as an explicit argument, and its
own source contains no `repo-version.cjs` or `plugin.json` reference in a non-comment line
(measured `0` occurrences, this session); (2) `tests/test-349-release-wiring.cjs` asserts the
comment-stripped slice of `scripts/release.sh` from the Step 5.5 offset to end of file contains
zero disk-version reads. Say plainly: this was found by reading the script (`349-RESEARCH.md`
Finding 2), not by a failing test, and the test exists because it was found.

---

## Six: What this phase deliberately did not do

- **No Theo-side consuming CI.** Owned by the Theo repo. The R5 disposition was executed at this
  plan's Task 2: `.planning/ROADMAP.md` now carries a real, numbered `### Phase 351:` card naming
  the owner and the plugin-side acceptance number, rather than the probe reading `PASS` from a
  live restamp this repo cannot itself perform.
- **No retry-with-backoff on the dispatch.** A single bounded attempt (`timeout 8`) that fails
  closed, matching `theo-stamp-gate.sh`'s own choice for the same class of problem.
  `verify-tag-push.sh` DOES retry (`scripts/release-lib/verify-tag-push.sh:83`), but for a known
  eventually-consistent replication lag, which is a different failure class than a dispatch send
  failure.
- **No idempotency ledger for duplicate dispatches on a re-run.** Theo's own re-emit is documented
  as deterministic with no timestamp, so a re-generation against an unchanged registry is a
  no-op. The guarantee already exists one hop away; a plugin-side ledger would be new durable
  state to maintain across `--no-theo-notify` and partial-failure recovery.
- **No live cross-session push.** No mechanism exists (WD-349-8). The tracked
  `docs/OPEN-HANDOFFS.md` row is the honest implementation, and the real machine-to-machine notify
  is the dispatch itself.
- **No tracked per-release handoff file.** The audit record is the untracked
  `~/.mindrian/theo-notify-log.txt` (WD-349-7), because a tracked write after the push dirties the
  tree and reds the next cut's pre-flight gate.
- **No `docs/VERSION-BUMP-CHECKLIST.md`.** Ruled option (a) at 349-03's checkpoint: Phase 343's
  WD-14 stands (STANDING, 2026-09-14: "`VERSION-BUMP-CHECKLIST.md` is NOT created in this repo").
  The roadmap's deliverable 4 wording is satisfied instead by amending RULE 5 place 8 plus
  `.claude/includes/release-process.md`, with the reconciliation recorded verbatim in
  `docs/RELEASE-CEREMONY-RULING-SYSTEM.md` and `docs/THEO-NOTIFY-CONTRACT.md`'s Navigator
  Ratification section (NOTIFY-10).

---

## Seven: RULE 6 compliance, named

This phase changed release infrastructure (`scripts/release.sh`, `scripts/doctor.cjs`).
`docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 6 requires such a change ship as a beta first and be
promoted only after the install self-test passes: "Bugs in release infra are the hardest to
recover from -- a broken gate blocks shipping its own fix." State that plainly as the next
operational step: the first cut carrying Step 5.6 ships as `X.Y.Z-beta.N`, not a final version.

Separately, and this is the state as measured at this phase's own start (349-03's checkpoint): the
`theo-stamp-gate` probe already reads `MISMATCH` (`command-registry@2.0.0-beta.12` against a repo
at `2.0.0-beta.40`), so `main` was effectively HELD on the 343-07 gate before this phase began --
any real release attempt would already abort at Step 0.6 without an opt-out. The first cut
carrying Step 5.6 may therefore need BOTH the beta-first posture (RULE 6) AND `--no-theo-check`
(the pre-existing, unrelated, already-audited opt-out for the LAGGING half) until Phase 351's
consuming CI clears the stamp, with the skip recorded in the release log exactly as
`theo-stamp-gate.sh` already designs it to be.

---

## Eight: Tri-Polar

One row per `CAPABILITY_MAP` key (`lib/mcp/surface-detect.cjs:22-26`), read live rather than
hand-typed, reproduced from `docs/THEO-NOTIFY-CONTRACT.md`:

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

---

## Nine: Grounding and its honest gaps

Per `349-LANGTALKS-CONSULT.md`: the corpus carries a `Synchronous Update` node, sourced to the
Iko Azoulay AI-SDLC episode (`loc=19471:19485`) -- the one direct hit, and the only corpus claim
this phase's design reasoning is entitled to cite. It does NOT carry the audit-lagging-versus-leading
PAIRING (a `relationship_path` query found only 4-hop shared-episode co-mention between
`Synchronous Update` and `Audit node`, no direct semantic edge), the phrase "leading edge" (no
match under any label tried), a "contract drift" concept (the fragments `Consumer`, `drift` and
`contract` exist as separate unconnected nodes, no synthesized pattern to cite), or an
event-versus-polling tradeoff writeup (an `Event` node exists, 3 hops and still episode-mediated;
no "polling" node). All four are MindrianOS-authored framing, named as such in
`349-RESEARCH.md` and `docs/THEO-NOTIFY-CONTRACT.md` rather than attributed to a source that does
not carry them.

Two named research assumptions: A1 (`registryHash`'s outbound meaning, a plugin-computed hash
rather than an echo of Theo's own value) was corroborated by live evidence taken 2026-09-15,
hours after `349-RESEARCH.md` was written (`command_neighborhood('/mos:act')` returning Theo's
own `registryHash`/`mappedBy` pair) -- still an inference about a consuming side (Phase 351) that
does not exist yet, not a closed question. A2 (GitHub's ten-property `client_payload` cap and the
exact error status codes) is MEDIUM confidence: `docs.github.com` was unreachable to WebFetch at
research time, and the number was cross-referenced against community usage instead
(`349-RESEARCH.md` Sources). The fail-closed design (a flat four-key payload, well under any
plausible cap, growing under a single new nested key rather than many top-level keys) is robust to
the exact number being wrong.

---

## Ten: Open working decisions

`docs/THEO-NOTIFY-CONTRACT.md` carries the full eleven-row WD-349 ledger; it is not duplicated
here. Status as of this close: WD-349-2 (Step 5.6's name), WD-349-3 (`--no-theo-notify` as a
separate flag), WD-349-4 (`registryHash`'s plugin-computed meaning) and WD-349-9 (R5's
disposition) were all RULED at the 349-03 blocking navigator checkpoint (2026-09-16), with the
navigator answering "approved as specified" on the first three and "out of scope, register a card
(Recommended)" on R5, zero fork overrules. The remaining seven rows (WD-349-1, WD-349-5, WD-349-6,
WD-349-7, WD-349-8, WD-349-10, WD-349-11) all stay WORKING -- shipped exactly as Claude's own
working call, never challenged by a navigator checkpoint, each with its own named reverse path if
a future navigator wants to reopen it. Zero rows are silently dropped; zero rows are upgraded to
RULED without an actual navigator answer on record.

---

## Eleven: What the next phase inherits

Phase 351 (registered in `.planning/ROADMAP.md` immediately after Phase 350, per WD-349-9's ruled
disposition) gets a delivered, well-shaped event with a fixed four-key payload, a documented hash
meaning, and a tracked handoff row (`docs/OPEN-HANDOFFS.md`) naming exactly what to do on receipt:
re-emit the command layer, restamp `mappedBy`, verify the received `registryHash` against a
freshly computed one, consult langtalks-graph-expert, and run the full-stack pass. It also
inherits the still-open emission-count finding (Section Three above) as its own investigation to
resolve, since only the Theo side can name what produced the two prior emissions this repo's own
source scan never accounts for.

This repo inherits a release script with one more fail-closed gate (Step 5.6) and one more audited
opt-out (`--no-theo-notify`, independent of `--no-theo-check`); RULE 5 place 8 now describes a
complete two-way Theo coupling in one place rather than half of one; and the 343-07 lagging gate
stays exactly where it was, waiting on Phase 351's own CI run to read `PASS` instead of
`MISMATCH`. Any future release-infrastructure phase touching `scripts/release.sh` inherits the
concrete, tested precedent of the placeholder-version trap (Section Five) as the canonical example
of why a post-mutation step must never re-read disk the way a pre-mutation step safely can.

**The rethinking-mindrianos filing outcome.** Per CLAUDE.md's Dev-Research Compositing rule, this
close-out's reasoning trail was attempted at
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-16-release-to-theo-leading-edge.md` this
session and correctly REFUSED by Claude Code's own `write-scope-check` PreToolUse hook: the
session's active room was not `rethinking-mindrianos` (the identical refusal Phase 344's, 345's,
347's and 348's own close-outs all recorded for the same situation, a fifth occurrence of the same
class). It is respected here rather than routed around: no active-room switch was attempted, and
no session state was force-changed. The plugin-side fallback mirror lands instead at
`~/MindrianOS/research/2026-09-16-release-to-theo-leading-edge.md`, carrying the lagging-versus-leading
framing named as MindrianOS's own synthesis (not a corpus relationship), the placeholder-version
trap and how it was found, the live `registryHash` evidence that settled A1, the emission-count
contradiction, and cross-references to `docs/THEO-NOTIFY-CONTRACT.md` and this close-out. A
session with `rethinking-mindrianos` set active (`/mos:rooms switch rethinking-mindrianos`) needs
to append that drafted content into the room's own research entry.

---
*Phase: 349-release-to-theo-leading-edge-graph-engineering-learning-sync*
*Closed: 2026-09-16*
