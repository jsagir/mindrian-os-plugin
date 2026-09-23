# Phase 355 baseline (D-57 gate, HIPS-10)

Recorded by Task 1 of plan 355-01, on 2026-09-23. This is the one place the
phase's starting point lives - later plans read it, they never re-capture it.

## Gate

(a) `grep -nE '^- \[ \] 354-[0-9]+-PLAN\.md' .planning/ROADMAP.md` printed
nothing - every 354-NN plan is checked. `ls .planning/phases/354-*/354-16-SUMMARY.md`
resolved to
`.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/354-16-SUMMARY.md`.
Phase 354 is CLOSED. Gate (a) PASSED.

(b) `git status --short` on the six D-57 shared files - `lib/mcp/tools/gate.cjs`,
`lib/mcp/tool-router.cjs`, `lib/core/brain-client.cjs`,
`lib/core/part8-egress-guard.cjs`, `scripts/doctor.cjs`,
`scripts/jev-devtime-client.cjs` - printed nothing for all six. Those six files
carry no diff this session did not make. Gate (b), on the six D-57 files, PASSED.

The same command also swept three peer-owned files the plan's action line
names alongside the six (`scripts/eval-icm-writers.cjs`,
`tests/test-353-grader-agreement.cjs`, `tests/test-353-ledger-shape.cjs`,
`.planning/REQUIREMENTS.md`). Three of those showed as modified
(`M scripts/eval-icm-writers.cjs`, `M tests/test-353-grader-agreement.cjs`,
`M tests/test-353-ledger-shape.cjs`); `.planning/REQUIREMENTS.md` was clean.
This is documented, expected peer state, not a D-57 violation: the plan's own
`<shared_tree_rules>` briefing (and `docs/2026-09-23-HANDOFF-phase-355-planned-continue.md`'s
"Peer contract from Phase 356" section) name exactly these two test-353 files
as unowned diffs sitting outside `tests/test-353-tripwires.cjs` ("never stage
those"), and `scripts/eval-icm-writers.cjs` is Phase 353/356 peer territory
per the same handoff. The D-57 truths block in the plan frontmatter defines
the gate over the six named shared files only. None of the three dirty files
was touched by this plan; they were re-read from disk, left alone, and are
recorded here so a later plan does not re-discover the same three files and
wonder whether the gate was skipped.

## D-57 file anchors (post-354)

Re-read at BASE_355, so later plans that edit a D-57 file start from these
anchors instead of the research's line numbers.

```
$ grep -n "_promoteCardSubject\|row.type !== 'claim'\|subject_not_claim" lib/mcp/tools/gate.cjs
56:// _promoteCardSubject(db, roomDir, live) -> { subject_node_id,
69:function _promoteCardSubject(db, roomDir, live) {
95:  if (row.type !== 'claim') {
96:    return { subject_node_id: subjectId, subject_confirmed: false, subject_skip_reason: 'subject_not_claim' };
390:                const subjectPromotion = _promoteCardSubject(db, roomDir, live);
```

```
$ grep -n "scout-hsi\|UNIMPLEMENTED_MUTATING_ORCHESTRATION\|NOT EXECUTED\|z.enum(\['structural_transfer'" lib/mcp/tool-router.cjs
406:  'scout', 'scout-health', 'scout-deadlines', 'scout-competitors', 'scout-hsi', 'scout-snapshot',
427:// claim to have done something. They get an explicit NOT EXECUTED banner and a
446:const UNIMPLEMENTED_MUTATING_ORCHESTRATION = new Set([
448:  'scout', 'scout-health', 'scout-deadlines', 'scout-competitors', 'scout-hsi', 'scout-snapshot',
950:          const unimplementedMutation = UNIMPLEMENTED_MUTATING_ORCHESTRATION.has(command);
952:            parts.push(`\n> **NOT EXECUTED.** This returns the \`${command}\` instructions, not a completed operation. Nothing has changed yet. Follow the Reference steps below and verify the result before reporting success.`);
1833:    'Manage rooms (rooms-list, rooms-new, rooms-open, rooms-close, rooms-archive, rooms-where), run scout intelligence (scout, scout-health, scout-deadlines, scout-competitors, scout-hsi, scout-snapshot), and handle admin, onboarding, models and scheduled tasks. rooms-open genuinely switches the active room. scout and its variants only return the scout reference plus current room context, not gathered intelligence; run /mos:scout on the CLI for the real scan (a .snapshots/ state capture, a competitor report, the HSI pipeline). Treat act, act-chain and act-swarm differently: they execute multi-step work with little supervision, so prefer act-dry-run first and do not invoke them for a decision the user has not already framed.',
1995:      const unimplementedMutation = UNIMPLEMENTED_MUTATING_ORCHESTRATION.has(command);
1997:        parts.push(`\n> **NOT EXECUTED.** This returns the \`${command}\` instructions, not a completed operation. Nothing has changed yet. Follow the Reference steps below and verify the result before reporting success.`);
2208:      surprise_type: z.enum(['structural_transfer', 'semantic_implementation'])
```

```
$ grep -n "^const BRAIN_URL\|^async function callTool\|egress_blocked\|tier_denied\|rate_limited" lib/core/brain-client.cjs
40:const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://theo-mcp.onrender.com';
543: * `error` property (so `tier_denied` / `invalid_key` / `rate_limited` /
544: * `egress_blocked` sentinels are never decorated -- those are refusals, not
595:async function callTool(toolName, args) {
627:  // `egress_blocked` is a sentinel OBJECT, not `null`: `null` is the
631:  // `tier_denied` (:497 area) and `invalid_key` above.
661:        error: 'egress_blocked',
759:          return { error: 'tier_denied', tool: toolName, message: message };
771:        // after the budget exhausts, return a distinct rate_limited
795:            error: 'rate_limited',
943:      _logEventBestEffort(undefined, 'brain_egress_blocked', {
1068: * egress_blocked sentinel described below; the caller returns it as-is and
1084:      error: 'egress_blocked',
1096:    error: 'egress_blocked',
1200:  // Phase 247-02 audit fix (Rule 1): a sentinel object (tier_denied /
1526:  if (raw.error) return raw; // egress_blocked / tier_denied / rate_limited / invalid_key
1807:      _logEventBestEffort(options.db, 'brain_egress_blocked', {
1921:      _logEventBestEffort(options.db, 'brain_egress_blocked', {
2046:// reshaping -- the tier_denied / invalid_key sentinels and the transport-null
2086:// Sentinel discipline: a result carrying .error (tier_denied, invalid_key)
2297: * (tier_denied/invalid_key) and the transport-null pass through untouched
2654:  //           sentinel the unreachable path uses; best-effort log brain_egress_blocked.
2664:      _logEventBestEffort(o.db, 'brain_egress_blocked', {
2671:      return { advice: null, reason: 'egress_blocked' };
```

```
$ grep -n "find_connections\|known_tool_shape" lib/core/part8-egress-guard.cjs
336:// find_connections and taxonomy_ladder. TAXONOMY_RUNGS is the closed four-
464:  if (toolName.indexOf('find_connections') !== -1) {
471:    return { class: 'known_tool_shape', reason: 'find_connections from/to label pair' };
480:    return { class: 'known_tool_shape', reason: 'taxonomy_ladder rung enum' };
497:    return { class: 'known_tool_shape', reason: 'recommend_chain problem_type enum' };
512:    return { class: 'known_tool_shape', reason: 'framework_step canonical framework handle' };
518:    return { class: 'known_tool_shape', reason: 'framework_techniques canonical framework handle' };
527:    return { class: 'known_tool_shape', reason: 'case_story canonical framework handle' };
536:// GENERIC HANDLES ONLY per D-10 -- this is STRICTER than find_connections's
537:// _isSafeShortLabel on purpose: find_connections proves any safe short label,
741: *      (find_connections, taxonomy_ladder) that clears default-deny -> allow;
```

```
$ grep -n "id: '" scripts/doctor.cjs
877:      id: 'install-state',
901:      id: 'deployment-surfaces',
931:      id: 'version-of-record-repo',
964:      id: 'verify-release',
1000:      id: 'version-of-record-published',
1063:      id: 'npx-roundtrip',
1138:      id: 'doctor-all',
1176:      id: 'coverage-gate',
1186:          { id: 'connector', script: 'build-connector-registry.cjs' },
1187:          { id: 'projection', script: 'build-orchestration-projection.cjs' },
1195:          { id: 'framework-vocabulary', script: 'check-framework-vocabulary-drift.cjs' },
1200:          { id: 'render', script: 'check-render-coverage.cjs' },
1207:          { id: 'skill-mirrors', script: 'build-skill-mirrors.cjs' },
1216:          { id: 'shape-declaration', script: 'check-shape-declaration.cjs' },
1227:          { id: 'tool-honesty', script: 'check-tool-honesty.cjs' },
1241:          { id: 'theo-mcp-exposure', script: 'check-theo-mcp-exposure.cjs' },
1275:      id: 'session-start-active-version',
1329:      id: 'verify-release-clean-tree',
1375:      id: 'frontmatter-yaml-validity',
1426:      id: 'release-dry-run-output',
1475:      id: 'working-tree-housekeeping',
1520:      id: 'worktree-hygiene',
1577:      id: 'harness-policies',
1644:      id: 'activation-reached-the-wire',
1756:      id: 'agentshield-all-surfaces-clean',
1821:      id: 'eureka-smoke-stack-ready',
1905:      id: 'eureka-fts-index-visible',
1962:      id: 'capability-ledger-fresh',
2006:      id: 'mcp-surface-tool-count',
2047:      id: 'icm-ruling-eval-fresh',
2236:  { id: 'ACPT-01', file: 'test-acpt-01-engine-fires.cjs',           label: 'navigation engine fires (routing_source legacy->engine on a real fired sensor)' },
2237:  { id: 'ACPT-02', file: 'test-acpt-02-websearch-hat-scoped.cjs',   label: 'WebSearch is hat-scoped (the external-tool affordance respects the hat boundary)' },
2238:  { id: 'ACPT-03', file: 'test-acpt-03-first-material-explore.cjs', label: 'first material auto-explores (room non-empty by turn 2)' },
2239:  { id: 'ACPT-04', file: 'test-acpt-04-filing-cascade-surfaces.cjs', label: 'filing surfaces a cross-relationship cascade mid-session' },
2240:  { id: 'ACPT-05', file: 'test-acpt-05-brain-derive-tier-rise.cjs', label: 'BRAIN.md derive raises tier_mode above tier_0 (hermetic; live mode_a self-skips)' },
2241:  { id: 'ACPT-06', file: 'test-acpt-06-dial-atomic-emission.cjs',   label: 'dial text + card contract emit atomically on the engine arm (real sensor fired from the production turn shape); legacy emits neither' },
4127:            finding_id: 'W007-' + (phase || 'unknown'),
4144:            finding_id: 'I001-' + (planRef ? planRef.planLabel : 'unknown'),
4162:          finding_id: 'P-prose-vs-code',
```
(the id list is long; captured in full for anchor stability, not because every
row matters to 355 - the acceptance-point ids referenced below are `coverage-gate`
and `verify-release-clean-tree`.)

```
$ grep -n "EGRESS_PROFILES\|kind: '" scripts/jev-devtime-client.cjs
395:// EGRESS_PROFILES: frozen object of frozen profile objects, one per builder,
399:const EGRESS_PROFILES = Object.freeze({
402:    kind: 'candidates_v1',
418:    kind: 'exact_state_v1',
442:    kind: 'candidates_v1',
451:module.exports = { DEFAULT_ENDPOINT, loadKey, makeEgressGuard, jev, pool, EGRESS_PROFILES };
```

## Doctor acceptance baseline (BASE_355)

`BASE_355 = 9458bf802` (2026-09-23). `node scripts/doctor.cjs --acceptance`
exit code 1. Full stdout+stderr captured to the session scratch directory
(never inside the repo), summary line:

```
Acceptance full: 20/21 points passed; failed: verify-release-clean-tree.
```

Failing-point set (sorted): `{verify-release-clean-tree}`. This matches the
documented baseline `tests/run-all-224.sh` already carries
(`coverage-gate`, `verify-release-clean-tree`) minus `coverage-gate`, which
passed this run. `verify-release-clean-tree` fails here because the working
tree is genuinely dirty mid-development (multiple sessions executing Phases
355, 356, 357, 358 and 361 concurrently in this tree) - an environment-driven
gap this phase neither caused nor can clear, per the run-all-217.sh
written-reason idiom. `tests/run-all-355.sh`'s
`doctor_acceptance_no_new_regression` treats `verify-release-clean-tree`
(and `coverage-gate`, should it reappear) as the baseline; any OTHER failing
point is a new regression and fails the leg.
