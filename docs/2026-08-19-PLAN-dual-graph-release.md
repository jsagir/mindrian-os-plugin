# PLAN - the Dual-Graph Release (v2.0.0-beta.6 -> v2.0.0 final)

Date: 2026-08-19. Author: dual-graph release session (Claude Code, JonathanSagir
machine). Status: DESIGN - awaiting navigator approve. Companion to
docs/2026-08-19-HANDOFF-brain-plugin-sync-release.md (arrives with the WS-A merge).

## 0. The thesis

MindrianOS is a dual-graph system the day the two graphs stop being two
databases that coexist and become two halves of ONE loop:

- LOCAL room graph (SQLite, navigation.cjs) supplies WHEN - sensors read room
  state and fire on context.
- BRAIN canon (Memgraph, pws-brain-mcp.onrender.com, 29,055 nodes) supplies
  WHICH and IN WHAT SEQUENCE - recommend_chain returns the ordered framework
  chain with /mos: commands.
- The seam: enum-only egress (problem_type) -> chain -> human Decision Gate ->
  chain_run executes the autonomous_safe prefix -> halts at material -> results
  file BACK into the local graph (artifact_id + memory_event + typed edges).

v2.0.0's milestone name was literally "Build the Loop". This release closes it.
Recommendation: ship v2.0.0-beta.6 with the full scope below; when acceptance
(section 5) passes live, finalize v2.0.0 as the dual-graph version.

## 1. What recon established (2026-08-19, three seam maps + RCA)

- The Brain->plugin adapter for recommend_chain DOES NOT EXIST (zero refs).
- The brain_framework_chain companion is DECLARED by 3 sensors (SENS-01/03/09)
  and CONSUMED BY NOTHING - .companions has zero readers; decide() narrows every
  reach to reach_id/posture at resolveFireSkill (navigation-engine.cjs:647).
- Sensors are pure/sync/LOCAL by grep-enforced fence (tests/test-249-capture-seam
  .cjs); the Brain call must live at an async seam ABOVE decide().
- Part 8 hook guards (part8-egress-guard-hook + brain-response-sanitize) match
  server name mindrian-brain; the live server is pws-brain-mcp -> both no-op.
  In-process classify() covers 4 of ~16 brain-client wrappers.
- gate_answer and chain_run-resume consume the SAME single-use gate-ledger
  entry: the documented ratify-then-resume flow dies with
  unknown_or_expired_gate (tests pin each path separately; they are mutually
  exclusive on one gate_id).
- MCP write path refuses on claude-code -> model falls back to ungoverned disk
  writes (RCA .planning/debug/mcp-write-path-disabled-on-cli-host.md; fix in
  flight as quick task 260819-bql, option A).
- No live stale-store detection: GraphRagMeta inert, two committed snapshots
  disagree by 421 nodes, 29055 appears nowhere in the repo. The stale replica
  (mindrian-brain.onrender.com, frozen ~July at 28,325) fooled three sessions
  in one day and is still named by LIVE user-facing surfaces:
  commands/setup.md + skills/setup/SKILL.md (5 hits each), scripts/session-start
  banner (3), .env.brain.template, dist bundle.
- Local framework_index covers 28 frameworks; Brain names beyond it degrade to
  {command:null} -> halt; normalizeFrameworkName wrapper exists (brain-client
  .cjs:1205) but no runtime path calls it.
- scripts/check-dual-graph-health.cjs (Phase 130.7-03) is the EXISTING 4-metric
  dual-graph gate, currently report-only.

## 2. Workstreams

WS-A. LAND THE NIGHT (merge - mechanical, conflict-free, verified)
  Merge origin/seeds/host-runtime-research-2026-07-18 into main: runtime
  instructions at MCP initialize, 3 Desktop prompts (bind-room/status/act),
  doctrine docs v2 (172-SYSTEMS-MODEL addendum, AGENTIC-SURFACING-PATTERN v2.0,
  ARCHITECTURE-DEEP-DIVE Brain rewrite), team handoff. Push main (currently
  ahead 2 unpushed).

WS-B. THE WRITE PATH HOME (in flight: quick task 260819-bql)
  claude-code host gets the MCP write path (option A). Closes the local half of
  the loop: filings land in the graph in-turn, not via disk-write fallbacks.

WS-C. THE TRIPWIRE CONSUMER (the heart - WHICH/SEQUENCE wire)
  C1. brain-client recommendChain() wrapper, sibling of feedsIntoChains
      (:1306). Enum-only input {problem_type, max_steps}; through callTool.
  C2. Companion consumer at the Larry/async layer: when the fired reach carries
      a brain_framework_chain:<pt> companion, the offer layer calls
      recommendChain(pt) and renders the chain as the Decision Gate. Seam:
      extend lib/brain/chain-recommender.cjs (the declared 122-04 placeholder);
      surface through suggest_next/offer-presenter. NEVER inside sensors or
      decide() (purity fence).
  C3. Chain adapter: Brain chain -> framework names -> chain_resolve ->
      chain_run. Names missing from the local framework_index go through
      normalizeFrameworkName once; still unmapped -> honest optional/halt step.
      Brain commands[] vs local resolution divergence -> memory_event (the
      cmd-map drift sensor). Posture authority stays LOCAL (registry
      autonomous_safe; the Brain recommends, never triggers).
  C4. Fix the resume seam: ONE owner for a material_step gate. gate_answer on a
      kind:'material_step' ledger entry must hand back a resumable verdict that
      chain_run accepts (no single-use deletion race); tool descriptions
      updated to the one true flow; both test suites converge on it.

WS-D. PART 8 GUARD REPAIR (constitutional, must-ship)
  D1. Matcher literal (brain-response-sanitize.cjs:61 + hooks.json copies)
      extended to match the live server naming (pws-brain-mcp) alongside
      mindrian-brain, plugin-prefixed or bare.
  D2. Move the in-process classify() to the callTool chokepoint for free-form
      payloads so coverage is 16/16 wrappers, not 4 (belt), hooks stay the
      suspenders. Scope check: minimal diff, reuse part8-egress-guard.classify.

WS-E. STORE IDENTITY (section-7 doctrine, plugin side)
  E1. class-m-brain-smoke gains layer 6 store_identity: resolved endpoint,
      brain_stats counts vs canon floor (>= 29k nodes; 28,325 = the stale
      replica signature -> FAIL loudly), GraphRagMeta stamp when present.
      LAYERS is wire-locked: update its tests + the --acceptance consumer.
  E2. Endpoint hygiene in LIVE surfaces: commands/setup.md, skills/setup/
      SKILL.md, scripts/session-start banner, .env.brain.template, dist regen.
      The two documented literal mirrors (build-brain-census:61,
      probe-brain-contract:74) stay but flip to the canon host.
  E3. Operator actions (listed, not code): suspend Render service
      mindrian-brain (dead spend); archive github.com/jsagir/
      brain_ProblemsWorthSolving (Aura-era self-hosted relic, July graph);
      Brain-side GraphRagMeta MERGE into the admin-window runbook.

WS-F. DOC SWEEP (section 8 residue)
  36 hits mindrian-brain.onrender.com + 28 hits "Aura Agent" across docs/,
  skills/, commands/. Live doctrine and user-facing surfaces -> canon store
  doctrine; dated historical docs (session records, tester outbox) get a
  one-line retired-replica annotation only where load-bearing, else untouched.

WS-G. FLIP THE EXISTING GATE
  scripts/check-dual-graph-health.cjs from report-only to enforcing in
  verify-release, after confirming its 4 metrics pass on live data. Part 7:
  reuse the shipped gate, mint no second one.

WS-H. RELEASE CEREMONY
  scripts/release.sh prerelease -> v2.0.0-beta.6. Real CHANGELOG content.
  README badge fix (stale at beta.1). mindrian-surface-sync.mjs --emit-payload
  becomes a permanent release-checklist step (handoff section 3 item 5).
  Post-release: acceptance below; if green, --finalize v2.0.0.

## 3. Sequencing

  A (merge+push) -> B lands (quick task) -> C+D+E as ONE GSD phase on main ->
  F (sweep, mechanical) -> G (flip gate) -> H (release) -> acceptance ->
  finalize decision.

## 4. Part 8 statement

Every new wire in WS-C carries ONLY generic methodology handles: problem_type
enums and framework names into the Brain; chains and command slugs out. Zero
room content crosses. WS-D widens enforcement, never egress.

## 5. Acceptance (from the 2026-08-19 handoff, section 9)

  a. Fresh Desktop, updated plugin: prompt menu shows bind-room/status/act;
     handshake instructions present.
  b. Any client, BYK key: brain_stats -> ~29k+ nodes (never 28,325).
  c. recommend_chain("Undefined Problem") -> ordered chain, most steps carrying
     /mos: commands.
  d. Sensor fires in a room -> Larry offers the chain -> approve -> chain_run
     runs the safe prefix, halts at the material gate, results file into the
     room graph via the MCP write path.
  e. Eval gate: no regression from 0.71.

Acceptance d is the dual-graph loop itself, end to end, on a released build.
