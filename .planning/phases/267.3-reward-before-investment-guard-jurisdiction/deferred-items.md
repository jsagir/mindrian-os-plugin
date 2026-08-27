# Phase 267.3 deferred items

Out-of-scope discoveries made during execution. Logged, NOT fixed, per the
executor scope boundary: only issues directly caused by this phase's changes
are auto-fixed.

## DEFERRED-267.3-D1 - `bash tests/run-all-118.sh` is RED for four pre-existing reasons

**Found during:** plan 267.3-02, Task 3 step 4 (the regression sweep the plan
mandates because Phase 118's suite owns the linter).

**Measured:** 2026-08-28, at `9a1b9fda`. `Total: 16, Passed: 12, Failed: 4`.

**The arm that matters is GREEN.** `../lib/core/mva-rule-linter.test.cjs`, the
suite that owns the linter this plan edits, passes inside `run-all-118.sh` and
standalone (14/14). None of the four failing suites references
`mva-rule-linter`, `first-reward-surfaces` or `check-reward-before-investment`
(verified by grep). So the plan's stop-work condition ("a change to the linter
that reds this suite") did NOT trigger.

**Proof of pre-existence.** A detached worktree was created at `16fefbfa`, the
commit immediately before this plan's first commit, and the four suites were run
there:

| Suite | At `16fefbfa` (pre-change) | At `9a1b9fda` (post-change) | Verdict |
|---|---|---|---|
| `lib/agents/mva/test-all-six-agents.cjs` | FAIL | FAIL | pre-existing |
| `lib/core/mva-deck-builder.test.cjs` | FAIL | FAIL | pre-existing |
| `lib/core/mva-option-router.test.cjs` | FAIL | FAIL | pre-existing |
| `lib/core/mva-classifier.test.cjs` | PASS | FAIL | ENV GAP, see below |

`mva-option-router.test.cjs` fails because the test still expects
`phase_119_stub` where the code now returns `ignite_from_brief`: Phase 119
replaced the stub and the test was never updated. A stale expectation, not a
regression.

**The classifier case is an ENV GAP in the test, not a code failure.**
`mva-classifier.test.cjs` T7 ("no fetch attempted when key absent") clears
`process.env.ANTHROPIC_API_KEY` and redirects `HOME` to a clean tmpdir, but the
key resolver ALSO reads a repo-local `.env`, and this checkout has an untracked
`/home/jsagi/dev/MindrianOS-Plugin/.env` dated 2026-07-14 carrying a key. So the
resolver finds a key the test believed it had removed, and `source` comes back
`heuristic` instead of `heuristic_fallback`. The detached worktree has no `.env`,
which is exactly why the same suite passes there. The test's isolation is
incomplete: it must neutralize the repo-local `.env` path too, not just `HOME`.

**Why not fixed here:** all four are outside this plan's blast radius. Fixing a
stale Phase 119 expectation or repairing the classifier test's isolation inside a
reward-vocabulary plan would mix two unrelated changes into one phase's history.

**Suggested owner:** a `/gsd-quick --validate` pass, or whichever phase next
touches the Phase 118 MVA suites.

---

## DEFERRED-267.3-D2 - the vocabulary has no term for a pre-reward surface, only a diagnostic one

**Found during:** plan 267.3-03, Task 1 (classifying the four `scripts/session-start`
injected-prose branches).

**The finding.** `267.3-DECISIONS.md` D-B defines `--none (diagnostic surface)` as "a command
that reports state rather than delivering a variable reward." Two of the four session-start
branches fit that cleanly: `UPDATE` is a version-delta report, and `COLD_START_MENU` reports
what is available. The other two fit only its opt-out half:

| Branch | Delivers a variable reward? | "Reports state"? |
|---|---|---|
| `session-start:FIRST_INSTALL` | NO (GAP R-1, Reward leg 2/10) | Not really. It welcomes and asks who the user is. |
| `session-start:MODE_ROUTING` | NO | Not really. It is a routing card that asks before giving. |

Both were declared `--none (diagnostic surface)` because it is the only member of the eight-term
closed vocabulary that is not an outright false statement. The five reward terms would each be a
false declaration. `--none (scripting only)` would be a false claim about invocation, since the
scripting override at `docs/reward-before-investment-rule.md:95` is legitimate only under an
actual `--no-interactive` / `--script` / `-q` invocation, and a SessionStart hook has none. That
is the exact error the `publish` miscall in `267.3-AUDIT.md` Section 3.3 already paid for once.

**The open question, stated so a future phase does not rediscover it:** does the vocabulary want
a distinct pre-reward opt-out, spelled in the same `--none (...)` family, for a surface that
asks for investment before anything is given back? That is a genuinely different category from
"reports state", and the session-start path is not the only place it will appear.

**Why not fixed here.** `267.3-DECISIONS.md` D-B ruled "exactly two new `REWARD_TYPES` members.
No more, no fewer. No respellings." A third term is a canon amendment requiring a navigator
ruling plus a `docs/reward-before-investment-rule.md` entry, per
`lib/core/mva-rule-linter.cjs:15-17` and the registry's own `_doc.reward_vocabulary_note`.
Minting one inside an execution plan is precisely the command-level invention the canon forbids.
The strain is instead recorded in each record's `why` field and in the in-file comment, so the
declaration is honest about being the nearest available term rather than a perfect one.

**Suggested owner:** a follow-up canon-amendment ruling, most naturally alongside Phase 267.2's
repair of GAP R-1, since that repair may change the answer (a FIRST_INSTALL that actually
delivers a reward would declare a reward term and the question would not arise for that branch).

**Blast radius if left as-is:** none mechanical. The four declarations are valid, the gate is
green, and the `why` fields carry the reasoning. This is a vocabulary-precision item, not a
correctness item.

---

## DEFERRED-267.3-D3 - `test-267-1-first-install-hooked-audit.cjs` is red on a Phase 270 file

**Found during:** plan 267.3-03, baseline capture, BEFORE any edit in the plan.

**Measured:** 2026-08-28 at `fd3afd46` (the pre-plan HEAD). `bash tests/run-all-267.1.sh` reads
`PASS=2 FAIL=1 SKIP=0`. Identical numbers after all three of this plan's commits.

**The failure.** The GAP I-1 pinning assertion expects exactly one `lib/`, `scripts/` or
`hooks/` source reference to `~/.mindrian-user.md` and finds four:

| Hit | File | This plan's? |
|---|---|---|
| 1 | `lib/core/user-archetype.cjs:64` | no (the original, expected hit) |
| 2 | `lib/mcp/tools/identity.cjs:3` | no (Phase 270) |
| 3 | `lib/mcp/tools/identity.cjs:10` | no (Phase 270) |
| 4 | `lib/mcp/tools/identity.cjs:72` | no (Phase 270) |

`lib/mcp/tools/identity.cjs` is a Phase 270 (Memory/Context Operator MCP) file. Plan 267.3-03
touched `data/first-reward-surfaces.json`, `scripts/session-start` (comments only),
`scripts/verify-release` and one new test file. It touched nothing under `lib/`.

**Reading it correctly:** the assertion's own message says "GAP I-1 closed or changed shape ...
re-run the 267.1 audit". Hit 4 (`identity.cjs:72`, which RETURNS the path) may mean a writer now
exists where the 267.1 audit found none, which would make this a genuinely useful signal rather
than noise. That is an audit-refresh question, not a test-repair question, and it belongs to
whoever owns the 267.1 audit refresh.

**Why not fixed here.** Pre-existing, in an unrelated file, outside this plan's blast radius.
Editing a Phase 267.1 pinning assertion from inside a 267.3 execution plan would either hide a
real finding or mix two phases' history.

**Suggested owner:** Phase 267.2 (it owns the GAP R-1 / GAP I-1 repairs and will need the audit
refreshed anyway), or a `/gsd-quick --validate` pass.

---

## DEFERRED-267.3-D4 - the pre-commit guard's own comment still lists the v1.13.0 six

**Found during:** plan 267.3-04, Task 3, while amending `REWARD_TYPES` a second time.

**The finding.** `scripts/hooks/pre-commit-room-minto-guard.sh:294-296` carries a recovery
comment that names the allowed values inline:

> Recovery on failure: declare interactive_first_reward in the offending
> commands/*.md frontmatter. Allowed values: reframe_question, instant_brief,
> schema_preview, calibration_distribution_preview, paragraph_preview,
> --none (scripting only).

That list is the v1.13.0 original six. It went stale at plan 267.3-02, which added
`methodology_reframe` and `--none (diagnostic surface)`, and it is now three terms behind after
267.3-04 added `live_deliverable`. A developer reading only the hook comment would believe
three legal values are illegal.

**Blast radius: zero mechanical.** The comment is not a gate. The hook shells out to
`scripts/check-reward-before-investment.cjs`, whose failure message prints the LIVE
`[...REWARD_TYPES]` at run time, so the value a developer actually sees on a real failure is
always current. Nothing reads the comment.

**Why not fixed here.** Pre-existing (it was already two terms stale before this plan started)
and it lives in a pre-commit hook script, which is outside this plan's declared file set.
Editing a commit-gate script from inside a classification plan mixes an unrelated concern into
this phase's diff. The general repair is better: replace the hardcoded list with a pointer to
the rule doc's allowed-values section, so it can never go stale a fourth time.

**Suggested owner:** plan 267.3-08 (close-out, which already owns "correct the rule doc's
enforcement description"), or a `/gsd-quick --validate` pass.

---

## DEFERRED-267.3-D5 - the `dist/` bundles carry stale copies of the 17 mirrors

**Found during:** plan 267.3-04, Task 3, immediately after `node scripts/build-skill-mirrors.cjs`.

**The finding.** `scripts/build-skill-mirrors.cjs` regenerates `skills/*/SKILL.md` only. There
is a SECOND generated surface it does not touch: `scripts/build-dist-bundles.cjs` writes
`dist/generic-claude-dir/.claude/skills/<name>/SKILL.md` and
`dist/zed/.agents/skills/<name>/SKILL.md`, both tracked in git, and both carry a copy of every
one of the 17 skills this plan just changed. Measured: `skills/publish/SKILL.md` now carries
`interactive_first_reward: live_deliverable`; `dist/zed/.agents/skills/publish/SKILL.md` carries
no such key. All 17 are present in both dist targets and all 17 are now behind.

**Why nothing caught it.** `node scripts/build-dist-bundles.cjs --check-stale` reports
`stale=false`, because it compares a stamped `source_version` (2.0.0-beta.12) rather than
hashing content. A source edit that does not bump the version is invisible to it, so the freshness
check reports green on a drifted bundle. That is the same shape of gap Phase 271 found in the
anchoring class: a sweep cleans a tree once, only a gate keeps it clean.

**Blast radius.** Nothing in `scripts/verify-release` or the pre-commit hooks reads
`dist/`, so no gate is red today. The exposure is at the version cut, where a bundle shipped to
a generic-Claude or Zed host would carry the OLD declarations. `interactive_first_reward` is a
declaration the linter reads out of the plugin source tree, not a runtime behavior switch, so
the practical effect on a user is nil; the correctness effect is that a shipped artifact
contradicts its own source.

**Why not fixed here.** `dist/` is not in this plan's declared file set, regenerating it would
add a large unrelated diff spanning many more than 17 files, and the version stamp it writes is
release-cut business. Two separable pieces of work, and the second is the one worth having:

1. Regenerate the dist bundles (mechanical, belongs to the next version cut).
2. Give `--check-stale` a content-hash arm so a source edit without a version bump reds it, and
   wire that arm into `scripts/verify-release`.

**Suggested owner:** piece 1 at the next `scripts/release.sh` cut; piece 2 as its own
`/gsd-quick` item or a Phase 267.3-08 close-out addition.
