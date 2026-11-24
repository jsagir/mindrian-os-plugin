# Phase 399 label review for the owner

Plan 399-03. Labels and rounded numbers only. Nothing in this file was applied unless a section says "applied".
Source of every p value: the recorded Gemini yes/no run (fixture tests/fixtures/399/recorded-job-command-yes-no.json) and the private proposals files. The p values are model output. They are not facts.
The owner rules on each item. This phase changes none of them.

## 1. Held pairs (D-07)

The owner held 2 pairs. They are not applied.

| Job | Command | Recorded p |
|-----|---------|------------|
| surface-contradiction | /mos:memory-cortex-reach | 0.916 |
| find-bottleneck | /mos:show | 0.934 |

Registry serves_jtbd today: /mos:memory-cortex-reach = ["navigate"]. /mos:show = ["prepare-pitch", "explore"].

## 2. Doubtful existing labels (D-07, not changed)

The registry carries these 5 labels today. The recorded p is low for each. They are not changed.

| Job | Command | Recorded p |
|-----|---------|------------|
| audit-room | /mos:admin | 0.058 |
| compare-options | /mos:deep-grade | 0.076 |
| validate-idea | /mos:dial-memory-refresh | 0.057 |
| validate-idea | /mos:feynman-timeline-refresh | 0.054 |
| compare-options | /mos:models | 0.083 |

## 3. Taxonomy and registry disagreements (I-02)

1 item is resolved by an accepted label. 5 items are open.

| Status | Job (taxonomy hook) | Command | Registry serves_jtbd today | Recorded p |
|--------|---------------------|---------|----------------------------|------------|
| resolved_by_accepted | decide-pursue | /mos:validate-proposition | ["validate-idea", "prepare-pitch", "decide-pursue"] | 0.927 |
| open | connect-domains | /mos:explore-domains | ["find-problem", "understand-market", "explore"] | 0.796 |
| open | decide-pursue | /mos:lean-canvas | ["prepare-pitch", "validate-idea"] | 0.864 |
| open | surface-contradiction | /mos:persona | ["prepare-pitch"] | 0.737 |
| open | surface-contradiction | /mos:think-hats | ["explore", "compare-options"] | 0.839 |
| open | validate-idea | /mos:think-hats | ["explore", "compare-options"] | 0.887 |

## 4. Agents and MCP tools (I-03)

Rule (written in data/capability-job-labels.json): apply a pair only when all 4 hold. (a) p is 0.90 or more. (b) The capability has at most 2 jobs at 0.90 or more. (c) The job is in data/job-vocabulary.json. (d) The name is an agent file, or an MCP tool registered as surface mcp:<name>.

Applied (6 capabilities):

- research: understand-market (agent frontmatter serves_jtbd)
- reverse-salient-agent: find-bottleneck, validate-idea (agent frontmatter serves_jtbd)
- artifact_file: file-meeting (data/capability-job-labels.json)
- contradiction_check: surface-contradiction, validate-idea (data/capability-job-labels.json)
- gate_render: compare-options (data/capability-job-labels.json)
- whitespace_scan: audit-room, validate-idea (data/capability-job-labels.json)

Not applied. Reason codes: three_or_more_strong_jobs, not_a_registered_tool, below_owner_band, no_job_reached_0_70. The first failing condition in this order names the reason: no_job_reached_0_70, below_owner_band, three_or_more_strong_jobs, not_a_registered_tool.
Note: intelligence and room_graph also fail (d) (no registered mcp surface). The code shown is the first condition that fails.

Agents not applied:

- three_or_more_strong_jobs: investor (validate-idea 0.94, prepare-pitch 0.91, decide-pursue 0.90); larry-extended (decide-pursue 0.93, surface-contradiction 0.92, find-problem 0.91)
- below_owner_band: brain-query (connect-domains 0.84, explore 0.73); competitor-watch-fetcher (prepare-pitch 0.77, validate-idea 0.70); dominant-design-researcher (validate-idea 0.74); framework-runner (validate-idea 0.81, decide-pursue 0.80, understand-market 0.76, prepare-pitch 0.76); grading (audit-room 0.71); persona-analyst (validate-idea 0.83, decide-pursue 0.79)
- no_job_reached_0_70: analogy-query-fetcher (connect-domains 0.64); chain-step-reviewer (find-bottleneck 0.31); grant-reviewer (validate-idea 0.66); meeting-perspective-extractor (file-meeting 0.65); opportunity-scanner (decide-pursue 0.53); research-lane-analyst (understand-market 0.54); vault-section-reviewer (audit-room 0.42)

MCP tools not applied:

- three_or_more_strong_jobs: intelligence (decide-pursue 0.98, validate-idea 0.98, understand-market 0.94, connect-domains 0.92; not registered); room_graph (audit-room 0.96, surface-contradiction 0.92, find-bottleneck 0.90; not registered)
- not_a_registered_tool: analysis (find-bottleneck 0.97, find-problem 0.93); brain_ask (find-problem 0.95, connect-domains 0.90; on the mindrian-brain server); meeting (file-meeting 0.93); methodology (find-problem 0.93, decide-pursue 0.91); room_state (audit-room 0.97)
- below_owner_band: brain_query (connect-domains 0.71); export (prepare-pitch 0.84); gate_answer (compare-options 0.78, decide-pursue 0.77); gate_list (find-bottleneck 0.79); graph_query (audit-room 0.77, find-bottleneck 0.75, explore 0.74, connect-domains 0.71); graph_reason (audit-room 0.85, validate-idea 0.84, surface-contradiction 0.75); orchestration (explore 0.75); reach_candidates (find-bottleneck 0.70); room_artifact (audit-room 0.83, prepare-pitch 0.79, decide-pursue 0.76, explore 0.72); room_bind (file-meeting 0.85); room_content (file-meeting 0.75); room_search (audit-room 0.72); room_startup (surface-contradiction 0.74); room_state_bound (surface-contradiction 0.82, audit-room 0.73); status_read (find-bottleneck 0.84)
- no_job_reached_0_70 (top job and p): brain_schema (explore 0.33); brain_search (connect-domains 0.67); brain_stats (find-bottleneck 0.67); brain_write (explore 0.48); chain_resolve (find-bottleneck 0.62); chain_run (find-bottleneck 0.31); claim_write (explore 0.56); context_assemble (file-meeting 0.59); contract_version (explore 0.31); detect_dual_path (find-bottleneck 0.21); eureka_critic (decide-pursue 0.54); extract_shallow (file-meeting 0.61); framework_run (plan-execution 0.69); graph_write (file-meeting 0.48); identity_write (explore 0.28); memory_event (explore 0.39); room_changes (find-bottleneck 0.29); room_create (file-meeting 0.29); room_list (file-meeting 0.42); stop_gate_check (file-meeting 0.49); suggest_next (audit-room 0.62); view_compile (audit-room 0.62)

## 5. Skills with no job label (13)

I-03 covers agents and MCP tools only. These 13 skill proposals are not applied. Proposals at 0.70 or more, rounded:

- brain-connector: surface-contradiction 0.94, connect-domains 0.89, validate-idea 0.87, find-bottleneck 0.84
- client-discovery-interview: none reached 0.70 (find-problem 0.25)
- context-engine: none reached 0.70 (explore 0.41)
- conversation-mode: explore 0.91, find-problem 0.83
- intelligence-orchestrator: file-meeting 0.94
- larry-personality: decide-pursue 0.92, find-problem 0.86, validate-idea 0.83, explore 0.82
- mos-deck-engine: prepare-pitch 0.88
- mullins-scaffold: decide-pursue 0.81, validate-idea 0.71
- pws-methodology: decide-pursue 0.82, validate-idea 0.82, find-problem 0.82, find-bottleneck 0.76
- room-passive: file-meeting 0.94
- room-proactive: surface-contradiction 0.97, audit-room 0.92, prepare-pitch 0.87, decide-pursue 0.85
- trending-to-absurd: none reached 0.70 (validate-idea 0.42)
- ui-system: none reached 0.70 (explore 0.28)

## 6. Skill pairs at 0.90 or more with no label

Source: the skill-match run, pairs of kind skill with p 0.90 or more and label 0. Only skills that already carry labels (has_labels 1) are listed here. 7 further pairs belong to the 13 unlabelled skills of section 5. Pairs that the plan 02 mirrors now carry are dropped. 9 pairs remain. None is applied.

| Job | Skill | p |
|-----|-------|---|
| validate-idea | compare-ventures | 0.92 |
| decide-pursue | deep-grade | 0.96 |
| validate-idea | deep-grade | 0.98 |
| connect-domains | explore-domains | 0.95 |
| decide-pursue | lean-canvas | 0.94 |
| decide-pursue | pipeline | 0.92 |
| find-problem | rs-fetch | 0.92 |
| decide-pursue | think-hats | 0.93 |
| validate-idea | think-hats | 0.92 |

## 7. Command pairs in the 0.70 to 0.89 band with no registry label

Band rule: fixture pair with 0.70 <= p < 0.90, where the current registry serves_jtbd of the command does not include the job.
Count: 132 pairs.
The owner judges the band. It is Deferred in 399-CONTEXT.md. This phase does not change it.
Sample rule: sha256(job|command) ascending, first 30
The hash input is the exact string job + "|" + command, for example "audit-room|/mos:show".

| Job | Command | Recorded p |
|-----|---------|------------|
| decide-pursue | /mos:analyze-needs | 0.742 |
| audit-room | /mos:reanalyze | 0.848 |
| validate-idea | /mos:auto-explore | 0.764 |
| validate-idea | /mos:think-hats | 0.887 |
| validate-idea | /mos:diagnostics | 0.725 |
| find-bottleneck | /mos:visualize | 0.762 |
| explore | /mos:find-connections | 0.823 |
| file-meeting | /mos:mva-report | 0.818 |
| understand-market | /mos:bono | 0.731 |
| find-problem | /mos:explore-opportunity | 0.895 |
| find-bottleneck | /mos:bono | 0.756 |
| connect-domains | /mos:auto-explore | 0.896 |
| validate-idea | /mos:compare-ventures | 0.873 |
| decide-pursue | /mos:opportunities | 0.871 |
| find-problem | /mos:ignite | 0.756 |
| connect-domains | /mos:visualize | 0.763 |
| decide-pursue | /mos:macro-trends | 0.838 |
| explore | /mos:whitespace | 0.751 |
| understand-market | /mos:map-unknowns | 0.758 |
| explore | /mos:systems-thinking | 0.753 |
| prepare-pitch | /mos:mva-brief | 0.763 |
| audit-room | /mos:scout | 0.835 |
| decide-pursue | /mos:brain-derive | 0.861 |
| find-bottleneck | /mos:status | 0.796 |
| validate-idea | /mos:diffusion | 0.895 |
| prepare-pitch | /mos:user-needs | 0.754 |
| understand-market | /mos:graph | 0.730 |
| audit-room | /mos:show | 0.828 |
| find-problem | /mos:persona | 0.758 |
| surface-contradiction | /mos:room | 0.733 |

## How to compute sections 6 and 7 again

Save the script below as a file outside the repo (for example sec67.cjs). Run it from the repo root: `node sec67.cjs 6` for section 6 and `node sec67.cjs 7` for section 7. Section 7 needs only the fixture and the registry. Section 6 also reads the private skill-match file at the path in PRIV. Run it after any change to the registry or the skill mirrors, because both inputs move.

```js
// Run from the repo root: node sec67.cjs 6|7
const fs = require('fs');
const crypto = require('crypto');
const PRIV = '/home/jsagi/MindrianOS/research/2026-11-24-decision-advisor-handoff/';
const registry = require(process.cwd() + '/data/command-registry.json');
const fixture = require(process.cwd() + '/tests/fixtures/399/recorded-job-command-yes-no.json');
const r3 = (x) => (Math.round(x * 100) / 100).toFixed(2);
const r3b = (x) => x.toFixed(3);
if (process.argv[2] === '6') {
  const m = require(PRIV + 'job-match-gemini-skills-agents-tools.json');
  const rows = [];
  let unlabelledSkillPairs = 0;
  for (const p of m.pairs) {
    if (p.kind !== 'skill' || p.p < 0.9 || p.label) continue;
    if (!p.has_labels) { unlabelledSkillPairs += 1; continue; }
    const f = process.cwd() + '/skills/' + p.command + '/SKILL.md';
    let carried = false;
    if (fs.existsSync(f)) {
      const mm = fs.readFileSync(f, 'utf8').match(/^serves_jtbd:\s*(\[.*\])/m);
      if (mm && JSON.parse(mm[1]).includes(p.job)) carried = true;
    }
    if (!carried) rows.push([p.job, p.command, r3(p.p)]);
  }
  rows.sort((a, b) => (a[1] + a[0] < b[1] + b[0] ? -1 : 1));
  console.log(JSON.stringify({ unlabelledSkillPairs, rows }));
} else {
  const serves = new Map(registry.commands.map((c) => [c.command, c.serves_jtbd || []]));
  const band = fixture.pairs.filter((x) => x.p >= 0.7 && x.p < 0.9 && !serves.get(x.command).includes(x.job));
  const key = (x) => crypto.createHash('sha256').update(x.job + '|' + x.command).digest('hex');
  const sorted = band.map((x) => ({ ...x, h: key(x) })).sort((a, b) => (a.h < b.h ? -1 : 1));
  console.log(JSON.stringify({ count: band.length, sample: sorted.slice(0, 30).map((x) => [x.job, x.command, r3b(x.p)]) }));
}
```
