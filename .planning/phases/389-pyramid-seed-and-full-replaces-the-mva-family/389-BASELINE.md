# Phase 389 baseline (plan 389-01)

Scratch HOME, MINDRIAN_BRAIN_URL=http://127.0.0.1:9, Brain and Tavily and Vercel keys unset. No network call to the Brain or Tavily.
HEAD when plan 389-01 started: 3002cf611. HEAD when the legs ran: b7fdd970859a0621934e16190b4c01a448da1a49 (peer commits landed in between; no MVA file changed in them).
Plugin version at the run: 2.0.0-beta.82 (research read beta.80).
Exit code map: 0 = PASS, 77 = ENVGAP, other = FAIL. A FAIL here is recorded as PRE-EXISTING and is not fixed by this plan, except the router test (fixed in Task 2).

| leg | command | exit | result | counts |
|-----|---------|------|--------|--------|
| 118 | `bash tests/run-all-118.sh` | 1 | FAIL (PRE-EXISTING) | 16 suites: 13 pass, 3 fail (test-all-six-agents, mva-deck-builder.test, mva-option-router.test) |
| router | `node lib/core/mva-option-router.test.cjs` | 1 | FAIL (PRE-EXISTING) | 18 tests: 13 pass, 5 fail (all five assert phase_119_stub) |
| fromBrief | `node tests/test-mva-from-brief.cjs` | 0 | PASS | 21 of 21 pass |
| 267 | `bash tests/run-all-267.sh` | 1 | FAIL (PRE-EXISTING) | PASS=26 FAIL=7 SKIPPED=1 |
| 2673 | `bash tests/run-all-267.3.sh` | 0 | PASS | PASS=5 FAIL=0 SKIP=0 |
| hk1 | `node tests/test-261029-qef-hook-timeouts.cjs` | 0 | PASS | all pass |
| hk2 | `node tests/test-connector-tier-d-hooks.cjs` | 1 | FAIL (PRE-EXISTING) | 3 passed, 1 failed (CHECK 4, brain-derivation-drain.cjs brain-client require) |
| hk3 | `node tests/test-quick-260911-juq-hooks-json-top-level.cjs` | 0 | PASS | node:test, 0 fail |
| hk4 | `node tests/test-346-catalogue-schema.cjs` | 1 | FAIL (PRE-EXISTING) | 18 of 19 (assert 12, hook mechanism partition) |
| hk5 | `node tests/test-369-hook-require-graph.cjs` | 0 | PASS | 5 passed, 0 failed |
| cr | `node scripts/build-connector-registry.cjs --check` | 0 | PASS |  |
| op | `node scripts/build-orchestration-projection.cjs --check` | 0 | PASS |  |
| rc | `node scripts/check-render-coverage.cjs` | 0 | PASS | 17 covered, 0 gap; 198 wired, 2 excluded, 0 unwired (200 declaring commands) |
| sd | `node scripts/check-shape-declaration.cjs --check` | 0 | PASS | advisory lint; exit 0 |
| rd | `node scripts/check-registry-drift.cjs --check` | 0 | PASS | OK, 0 findings, baseline git-tag v2.0.0-beta.81 (the first run without --check printed usage, exit 2) |
| il | `node scripts/build-command-irreversibility-ledger.cjs --check` | 0 | PASS | WARN 20: 14 STALE, 2 REMOVED, 2 UNSCORED, 1 ANSWER_KEY_DRIFT, 1 LABEL_SET_MISMATCH; no MVA command named |
| dist | `node scripts/build-dist-bundles.cjs --check-stale` | 1 | FAIL (PRE-EXISTING) | STALE since beta.52 by design (live plugin beta.82) |
| t209 | `node tests/test-209-declared-implies-wired.cjs` | 1 | FAIL (PRE-EXISTING) | deepStrictEqual on the known contradiction list differs; no mva name in the output |
| cmdreg | `node scripts/build-command-registry.cjs --check` | 0 | PASS |  |
| sm | `node scripts/build-skill-mirrors.cjs --check` | 0 | PASS | 112 mirrors match |
| hm | `node scripts/build-harness-manifest.cjs --check` | 0 | PASS |  |
| scl | `node scripts/build-section-command-ledger.cjs --check` | 1 | FAIL (PRE-EXISTING) | plugin_version drift: ledger beta.80, repo beta.82 |
| hitl | `node scripts/backfill-hitl-shape.cjs --check` | 1 | FAIL (PRE-EXISTING) | lists surfaces that would change (includes commands/mva-report.md and skills/mva-pipeline/SKILL.md) |
| layer | `node scripts/backfill-layer.cjs --check` | 1 | FAIL (PRE-EXISTING) | 4 surfaces would change (none in the MVA family) |
| fc | `node ui/mos-face/scripts/face-commands.cjs --check` | 0 | PASS | 112 WHY lines, 3 drift warnings, 0 problems |
| ws | `node tests/test-369.26-registry-sync.cjs` | 1 | FAIL (PRE-EXISTING) | 6 passed, 2 failed (workspace mod assets differ from data/) |

## Output tail per leg (last 400 characters)

### 118
`bash tests/run-all-118.sh`

```
ms 242.930347
>>> ./test-mva-dror-harness.cjs: PASSED

========================================
  Summary (118 scoped)
========================================
  Total:  16
  Passed: 13
  Failed: 3
  Time:   8s

  Failed:
    - ../lib/agents/mva/test-all-six-agents.cjs
    - ../lib/core/mva-deck-builder.test.cjs
    - ../lib/core/mva-option-router.test.cjs
========================================

```

### router
`node lib/core/mva-option-router.test.cjs`

```
btests (node:internal/test_runner/test:744:7)
  ...
# Subtest: Canon Part 8: forbidden-token sweep on router source (no raw_sentence / MVA_SENTENCE)
ok 18 - Canon Part 8: forbidden-token sweep on router source (no raw_sentence / MVA_SENTENCE)
  ---
  duration_ms: 0.233704
  type: 'test'
  ...
1..18
# tests 18
# suites 0
# pass 13
# fail 5
# cancelled 0
# skipped 0
# todo 0
# duration_ms 81.258023

```

### fromBrief
`node tests/test-mva-from-brief.cjs`

```
SON returns brief_parse_error
  PASS: T-155-04-03: brief_parse_error includes message

Section 6: static checks
  PASS: commands/new-project.md contains "express" (>= 1)
  PASS: OPTION_BEHAVIOR[2].action is not phase_119_stub
  PASS: venture-shape-nudge.cjs comment contains /mos:ignite
  PASS: room-auto-create-nudge.cjs verb is /mos:ignite (not /mos:new-project)


[test-mva-from-brief] 21/21 PASS

```

### 267
`bash tests/run-all-267.sh`

```
PASSED

--- regression: release payload ceiling ---
check-release-payload-ceiling: entryCount=2197 unpackedSize=43467193 size=13342296
check-release-payload-ceiling: OK (0 findings)
>>> regression: release payload ceiling: PASSED

--- 267: em-dash guard ---
>>> 267: em-dash guard: PASSED
======================================
Phase 267: PASS=26 FAIL=7 SKIP=1
======================================

```

### 2673
`bash tests/run-all-267.3.sh`

```
ssion-start
    session-start:MODE_ROUTING  scripts/session-start
    session-start:COLD_START_MENU  scripts/session-start
  compliant: 4
  missing:   0
  invalid:   0

All 4 interactive commands declare their first reward -- the rule holds.
>>> 267.3 registry gate (--surfaces): PASSED

======================================
Phase 267.3: PASS=5 FAIL=0 SKIP=0
======================================

```

### hk1
`node tests/test-261029-qef-hook-timeouts.cjs`

```
80, post-compact 120
  ok A4 the DD-1 table matches every entry exactly once
  ok A5 only the Part 8 egress guard has onFailure, and it is exactly "block"
  ok A6 ambient-stop keeps timeout 5 and async true
  ok A7 parseHookCommands reads the timeout as seconds
  ok A8 isNetworkCapable is true only for the npm reconcile hook
  ok A9 the preflight budget check reads seconds
hook-timeouts: ALL PASS

```

### hk2
`node tests/test-connector-tier-d-hooks.cjs`

```
nt, not an ad-hoc detached spawn
  FAIL CHECK 4 - Part 8: no Brain-client egress in the fire path; generic handles + scalars only
    CHECK 4 - Part 8: no Brain-client egress in the fire path; generic handles + scalars only: scripts/brain-derivation-drain.cjs must not require a brain-client in the fire path (Part 8)

true !== false


Tier D sensor-firing wiring scan: 3 passed, 1 failed (4 checks)

```

### hk3
`node tests/test-quick-260911-juq-hooks-json-top-level.cjs`

```
)
  ---
  duration_ms: 0.725955
  type: 'test'
  ...
# Subtest: Arm 4: the top-level-keys guard is not vacuous -- an extra key fails the same assertion
ok 4 - Arm 4: the top-level-keys guard is not vacuous -- an extra key fails the same assertion
  ---
  duration_ms: 0.790353
  type: 'test'
  ...
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9.705389

```

### hk4
`node tests/test-346-catalogue-schema.cjs`

```
 2+ digit count
PASS 16: every prose_mandates row carries id, rule, where (existing path), floor, arbiter_input, non-empty reason
PASS 17: at least one prose_mandates row targets skills/larry-personality/SKILL.md with a non-none floor
PASS 18: zero em-dashes in the catalogue
PASS 19: zero em-dashes in this test file

18/19 assertions passed
>>> test-346-catalogue-schema.cjs: FAILED (1 failure(s))

```

### hk5
`node tests/test-369-hook-require-graph.cjs`

```
ath chain (chain root.cjs -> a.cjs -> b.ts)
  PASS arm 2b: mutation - a require literal naming a .mts is a violation even when the file is absent
  PASS arm 2c: a clean tree reports no violation
  PASS arm 3: hook cold-start baseline fixture exists, parses, and every measured p95_ms is below its timeout_ms (45 measured entries, n=10, node v22.23.1)

test-369-hook-require-graph: 5 passed, 0 failed

```

### cr
`node scripts/build-connector-registry.cjs --check`

```
connector-registry: OK
(node:2198628) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)

```

### op
`node scripts/build-orchestration-projection.cjs --check`

```
orchestration-projection: OK

```

### rc
`node scripts/check-render-coverage.cjs`

```
render-coverage report: 17 covered, 0 excluded, 0 gap (17 entries)
render-coverage md-keyspace: 198 wired, 2 excluded, 0 unwired (200 declaring commands)

```

### sd
`node scripts/check-shape-declaration.cjs --check`

```
ork it does not have"
Recovery: run node scripts/backfill-hitl-shape.cjs, or hand-author the missing declaration per docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add connector.excluded:true + reason if this skill reaches no fork.
(node:2198655) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)

```

### rd
`node scripts/check-registry-drift.cjs --check`

```
check-registry-drift: baseline source = git-tag (v2.0.0-beta.81)
check-registry-drift: deprecations source = data/command-deprecations.json (2 valid entries)
check-registry-drift: OK (0 findings, 0 accepted removal(s), baseline=git-tag)

```

### il
`node scripts/build-command-irreversibility-ledger.cjs --check`

```
os:research
WARN: STALE /mos:room
WARN: STALE /mos:root-cause
WARN: STALE /mos:rs-experts
WARN: UNSCORED /mos:scientific-roadmap
WARN: STALE /mos:setup
WARN: STALE /mos:think-hats
WARN: STALE /mos:whitespace
WARN: REMOVED /mos:pws-brain
WARN: REMOVED /mos:query
WARN: ANSWER_KEY_DRIFT ledger answer_key_hash does not match the current answer-key bytes
command-irreversibility-ledger --check: WARN 20

```

### dist
`node scripts/build-dist-bundles.cjs --check-stale`

```
dist bundle STALE: bundle was generated from 2.0.0-beta.52, the live plugin is 2.0.0-beta.82
Recovery: node scripts/build-dist-bundles.cjs

```

### t209
`node tests/test-209-declared-implies-wired.cjs`

```
ublish/SKILL.md',
    'skills/radar/SKILL.md',
    'skills/rooms/SKILL.md',
    'skills/scheduled-tasks/SKILL.md',
    'skills/setup/SKILL.md',
    'skills/snapshot/SKILL.md',
    'skills/splash/SKILL.md',
    'skills/stance/SKILL.md',
    'skills/update/SKILL.md',
    'skills/vault/SKILL.md',
    'skills/visualize/SKILL.md'
  ],
  operator: 'deepStrictEqual',
  diff: 'simple'
}

Node.js v22.23.1

```

### cmdreg
`node scripts/build-command-registry.cjs --check`

```
command-registry: OK

```

### sm
`node scripts/build-skill-mirrors.cjs --check`

```
build-skill-mirrors --check: OK (112 mirrors match expected content; skip-list verified: trending-to-absurd)

```

### hm
`node scripts/build-harness-manifest.cjs --check`

```
harness-manifest: OK

```

### scl
`node scripts/build-section-command-ledger.cjs --check`

```
section-command-ledger: FAILED (plugin_version drift: ledger=2.0.0-beta.80 repo=2.0.0-beta.82)

```

### hitl
`node scripts/backfill-hitl-shape.cjs --check`

```
 agents/framework-runner.md
  agents/brain-query.md
  agents/larry-extended.md
  pipelines/discovery/CHAIN.md
  pipelines/thesis/CHAIN.md
  pipelines/analogy/CHAIN.md
  skills/mos-deck-engine/SKILL.md
  skills/client-discovery-interview/SKILL.md
  skills/mullins-scaffold/SKILL.md
  skills/mva-pipeline/SKILL.md
  skills/trending-to-absurd/SKILL.md
Recovery: run node scripts/backfill-hitl-shape.cjs

```

### layer
`node scripts/backfill-layer.cjs --check`

```
backfill-layer --check: 4 surface(s) would change:
  agents/larry-extended.md
  commands/file-meeting.md
  commands/setup.md
  skills/file-meeting/SKILL.md
Recovery: run node scripts/backfill-layer.cjs

```

### fc
`node ui/mos-face/scripts/face-commands.cjs --check`

```
WARN WHY differs from the registry for /mos:doctor (run --write, then the build)
WARN WHY differs from the registry for /mos:eureka-portfolio (run --write, then the build)
WARN WHY differs from the registry for /mos:rs-experts (run --write, then the build)
face-commands: 112 WHY lines, 3 drift warnings, 0 problems

```

### ws
`node tests/test-369.26-registry-sync.cjs`

```
ction-report | methodology
    rows: 113, non-methodology rows: 79
  ok informational: distinct body_shape values and the non-methodology row count
  ok the job canon has a sections map, each with a job_id
  ok no registry count is written into the mod (total across src; the derived counts in the action list files)
  ok the action list files read no hitl_shape and never submit

6 passed, 2 failed

```

## Difference from the research numbers

- run-all-118: 16 suites, 13 pass, 3 fail. SAME as research. The three failing suites are the same three.
- mva-option-router test: 13 of 18 pass. SAME as research.
- test-mva-from-brief: 21 of 21. SAME as research.
- Plugin version beta.82, not beta.80. Several legs that compare a version (section-command-ledger, dist stale check, workspace mod assets) fail on version drift, not on MVA content.
- Legs the research did not run, now recorded: run-all-267 (7 fail, 1 skipped), run-all-267.3 (pass), hook census set (tier-d hooks CHECK 4 and catalogue assert 12 fail), generator checks (several fail on version drift).
- Hook census: test-261029-qef-hook-timeouts, test-quick-260911-juq and test-369-hook-require-graph pass. test-connector-tier-d-hooks (CHECK 4) and test-346-catalogue-schema (assert 12) fail BEFORE any MVA change. Plan 07 must judge its hook removal against this, not against green.
- Generated-registry gates that pass: connector-registry, orchestration-projection, render-coverage, command-registry, skill-mirrors, harness-manifest, registry-drift, shape-declaration (advisory), face-commands (0 problems).
