---
phase: 199-agentshield-stripe-commercial
plan: 06
type: execute
wave: 3
depends_on: [199-04]
files_modified:
  - scripts/agentshield-sessionstart-scan.cjs
  - lib/hmi/agentshield-drift-gate.cjs
  - lib/core/navigation/memory-events.cjs
  - hooks/hooks.json
autonomous: true
requirements: [AS-07]

must_haves:
  truths:
    - "A SessionStart hook re-runs runAgentShieldScan() and, when a finding is NEW since the last locally-cached scan, renders a Shape F.1 Decision Gate {Investigate, Defer} -- composing the shipped shape-f1-renderer.cjs, no new selector shape, no new frozen scalar"
    - "The hook is fail-open: any internal error never blocks session start, and a clean or already-seen-and-deferred finding produces silent exit 0"
    - "Every scan decision is journaled as scalars + slugs + counts only via navigation.cjs (never raw file bytes), mirroring the 196-04 ontology pattern"
  artifacts:
    - path: lib/hmi/agentshield-drift-gate.cjs
      provides: "renderGate({surface, findingCount, ruleId}) -> {zones, contract}, verbs {Investigate, Defer}"
    - path: scripts/agentshield-sessionstart-scan.cjs
      provides: "the SessionStart hook entry point"
  key_links:
    - from: "lib/hmi/agentshield-drift-gate.cjs"
      to: "lib/hmi/shape-f1-renderer.cjs"
      via: "require + renderShapeF1() composition"
      pattern: "renderShapeF1\\("
    - from: "scripts/agentshield-sessionstart-scan.cjs"
      to: "lib/core/security/agentshield-run.cjs"
      via: "require + runAgentShieldScan() call"
---

<objective>
Wire AgentShield's continuous-scanning mode as a native Claude Code SessionStart hook (per SEED-016's CC-currency amendment -- no bespoke --watch daemon) that surfaces genuinely NEW drift via the same open-vocabulary Shape F.1 Decision Gate pattern 196-05 established for the ambiguous-egress case, and journals every decision through the existing navigation.cjs telemetry chokepoint.

Purpose: closes SEED-016's "continuous scanning mode" bullet with the CC-native replacement the amendment specifies; keeps Canon Part 3's frozen scalars (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate) untouched by reusing the renderer, never reinventing it.
Output: `scripts/agentshield-sessionstart-scan.cjs`, `lib/hmi/agentshield-drift-gate.cjs`, additive EVENT_TYPES, hooks.json registration.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@lib/hmi/part8-egress-gate.cjs
@lib/hmi/shape-f1-renderer.cjs
@lib/core/navigation/memory-events.cjs
@scripts/part8-egress-guard-hook.cjs
@hooks/hooks.json
@lib/core/security/agentshield-run.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: drift gate + telemetry EVENT_TYPES</name>
  <files>lib/hmi/agentshield-drift-gate.cjs, lib/core/navigation/memory-events.cjs</files>
  <read_first>
    lib/hmi/part8-egress-gate.cjs (the exact composition pattern to clone:
    renderGate/degrade shape, class-slug-only header, by-construction verb
    assertion); lib/core/navigation/memory-events.cjs (the EVENT_TYPES Set +
    the brain_egress_* 3-string additive idiom at the end of the file to
    mirror); lib/hmi/shape-f1-renderer.cjs (CANONICAL_VERBS list -- confirm
    'Defer' is canonical and 'Investigate' rides the open-vocabulary
    user-supplied path).
  </read_first>
  <action>
    Write lib/hmi/agentshield-drift-gate.cjs cloning part8-egress-gate.cjs's
    structure: `renderGate({surface, findingCount, ruleId})` composes
    `renderShapeF1({tier:2, recommendedVerb:'Investigate', verbs:['Investigate','Defer'], header:'-- agentshield -- ' + findingCount + ' new finding(s) on ' + &lt;surface-slug&gt; + ' -- pick --'})`
    ('Defer' is already a CANONICAL_VERB; 'Investigate' rides the
    open-vocabulary user-supplied path, mirroring how 196-05 mixed one
    canonical verb, Reformulate, with one custom verb, Cancel). The header
    names the SURFACE SLUG and COUNT only -- never file paths or matched byte
    content, the same "never render the offending bytes" discipline 196-05
    applied to Part 8, even though this is not itself a Part-8 egress gate.
    There is no Brain-availability concept for this gate, so no `degrade()`
    function is needed; instead export a pure `shouldRender(cacheEntry, finding)`
    helper returning `false` when the finding's `surface`+`ruleId`+`id` key was
    already present in the local dedup cache, so the SAME finding is never
    re-rendered every session.

    Add 2 additive EVENT_TYPES strings to the frozen Set in
    lib/core/navigation/memory-events.cjs: `agentshield_scan_clean`,
    `agentshield_scan_flagged` -- mirror the exact 110-02/196-04 additive-Set
    idiom and comment style (a comment block above the additions explaining
    when each fires, followed by the two string literals added to the Set).
  </action>
  <verify>
    <automated>node -e "const g=require('./lib/hmi/agentshield-drift-gate.cjs').renderGate({surface:'hook_scope',findingCount:1,ruleId:'AS-CVE-010'}); if(JSON.stringify(g.contract.verbs).indexOf('Investigate')===-1) throw new Error('verb missing')"; node -e "if(!require('./lib/core/navigation/memory-events.cjs').EVENT_TYPES.has('agentshield_scan_flagged')) throw new Error('EVENT_TYPES missing agentshield_scan_flagged')"</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    renderGate composes the shipped renderer with no new selector shape and
    the verb set is exactly {Investigate, Defer} plus the auto-appended
    Free-Text; EVENT_TYPES gained the 2 new strings additively (no removed or
    renamed existing strings).
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: SessionStart hook + registration</name>
  <files>scripts/agentshield-sessionstart-scan.cjs, hooks/hooks.json</files>
  <read_first>
    scripts/part8-egress-guard-hook.cjs (fail-open wrap +
    uncaughtException backstop pattern to clone); hooks/hooks.json's
    SessionStart array (matcher `"startup|clear|compact"`, timeout
    conventions -- pick a timeout in the 5000-12000ms band matching similarly
    heavy SessionStart hooks already registered, since a full 5-surface scan
    is heavier than the lightest 2000ms-class hooks).
  </read_first>
  <action>
    Write scripts/agentshield-sessionstart-scan.cjs: on SessionStart, require
    lib/core/security/agentshield-run.cjs, call runAgentShieldScan(), and
    read/write a LOCAL non-repo dedup cache at
    `~/.mindrian/agentshield/last-scan.json` (NOT room.db, NOT a tracked repo
    file -- this is plugin-install-level state, analogous to the existing
    `~/.mindrian/telemetry/query-efficiency.jsonl` LOCAL cache precedent in
    docs/CANON-PHASE-MAP.md). For each finding not present in the cache (keyed
    by surface+ruleId+id), best-effort log `agentshield_scan_flagged` (or
    `agentshield_scan_clean` when totalFlagged===0) via navigation.cjs's
    telemetry chokepoint -- scalars + slugs + counts only (surface slug,
    ruleId, count), NEVER the raw target bytes, mirroring the 196-04 D-09
    firewall discipline -- and print ONE rendered
    lib/hmi/agentshield-drift-gate.cjs gate to stdout for the
    highest-severity NEW finding using the Task-1 `shouldRender` guard, then
    update the cache. Wrap the entire body in a fail-open try/catch plus a
    `process.on('uncaughtException', ...)` backstop identical in shape to
    scripts/part8-egress-guard-hook.cjs's outer wrap, so any internal error
    exits 0 silently -- a SessionStart hook must never block a session; there
    is no fail-closed posture here, unlike the Part-8 PreToolUse hook.

    Register it in hooks/hooks.json's SessionStart array: append a new object
    AFTER the last existing SessionStart entry (do not replace or reorder any
    existing entry), matcher `"startup|clear|compact"`, `timeout: 8000`,
    `async: false`, `statusMessage: "Scanning plugin surfaces for security drift..."`.
  </action>
  <verify>
    <automated>node tests/agentshield-sessionstart-hook.test.cjs; node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))"; bash tests/run-all-199.sh</automated>
  </verify>
  <done>Acceptance bar met -- see <acceptance_criteria> immediately below.</done>
  <acceptance_criteria>
    The hook always exits 0; the dedup cache prevents re-rendering the same
    finding across two consecutive runs; hooks/hooks.json remains valid JSON
    with the new entry appended, not replacing any existing entry.
  </acceptance_criteria>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|--------------|
| SessionStart hook execution | Runs on every Claude Code session start; must never block session startup and must never leak scanned-file bytes into telemetry. |
| local dedup cache | `~/.mindrian/agentshield/last-scan.json` is a user-writable local file outside the repo and outside room.db. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-199-06-01 | Denial of Service | SessionStart hook latency | mitigate | 8000ms timeout matches the weight class of comparable existing SessionStart hooks; the scan itself is bounded local file I/O, no network. |
| T-199-06-02 | Repudiation | scan decisions must be journaled | mitigate | Every scan writes a scalars-only memory_event via navigation.cjs. |
| T-199-06-03 | Information Disclosure | drift gate header | mitigate | Header carries surface slug + count only, never the matched target bytes. |
| T-199-06-04 | Tampering | local dedup cache | accept | User-writable local file; worst case a tampered cache re-surfaces or suppresses a finding locally -- no cross-user or Brain exposure. |
| T-199-06-SC | Tampering (supply chain) | npm installs | N/A | Zero new dependencies. |
</threat_model>

## Artifacts this phase produces

- `lib/hmi/agentshield-drift-gate.cjs` -- Shape F.1 composition for surfacing AgentShield drift.
- `scripts/agentshield-sessionstart-scan.cjs` -- the SessionStart hook entry point.
- 2 additive EVENT_TYPES strings in `lib/core/navigation/memory-events.cjs`.
- Updated `hooks/hooks.json` (new SessionStart entry, nothing removed).

<verification>
`node tests/agentshield-sessionstart-hook.test.cjs` fully green. `bash tests/run-all-199.sh` shows this leg PASSED. `hooks/hooks.json` remains valid JSON.
</verification>

<success_criteria>
- SessionStart hook registered, fail-open, dedup-aware.
- Telemetry routed through navigation.cjs, scalars-only.
- Shape F.1 gate reused with no new frozen scalar.
</success_criteria>

<output>
Create `.planning/phases/199-agentshield-stripe-commercial/199-06-SUMMARY.md` when done
</output>
