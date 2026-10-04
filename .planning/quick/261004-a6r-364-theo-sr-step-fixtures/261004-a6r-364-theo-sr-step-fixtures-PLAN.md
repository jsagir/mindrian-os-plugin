---
phase: quick
plan: 261004-a6r
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/fixtures/364-theo/framework-step-all-null.json
  - tests/fixtures/364-theo/framework-step-one-null.json
  - tests/fixtures/364-theo/framework-step-authored.json
  - tests/fixtures/364-theo/framework-step-unlabelled-seven.json
  - tests/fixtures/364-theo/framework-step-eight-unlabelled.json
  - tests/fixtures/364-theo/framework-step-honest-empty.json
  - tests/test-364-sr-steps.cjs
  - tests/test-364-sr-door.cjs
  - docs/2026-10-03-PHASE-364-THEO-NOTIFY.md
  - .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md
  - .planning/quick/261004-a6r-364-theo-sr-step-fixtures/261004-a6r-364-theo-sr-step-fixtures-SUMMARY.md
autonomous: true
requirements: [QUICK-261004-a6r, 364-A6]

must_haves:
  truths:
    - "No tests/fixtures/364-theo/framework-step-*.json file carries a retired sr-v1 step id; the step families carry sciroad::scientific-roadmapping::p01 to p07 in that order with the seven Theo Phase 25 labels"
    - "Every step in the live-shaped families (authored, one-null, unlabelled-seven, eight-unlabelled) is stepKind STEP, step-level orchestrationStatus draft, with thinkingMode and artifactRubric set; researchDirective is set on p01 and p06 only and is JSON null on p02, p03, p04, p05 and p07"
    - "readSrSteps over the authored fixture returns ok with seven steps in list order; a null researchDirective never causes a refusal"
    - "The honest-empty case (a Scientific Roadmapping row with zero steps, and the no-row shape) reads as no_steps_in_canon, never step_unauthored and never an error reason"
    - "Every framework-step fixture's frameworkIdentities.resolved is exactly [Tech Tree Mapping]; Technology Roadmapping, Roadmapping and Field Roadmapping appear in none; the reader only ever sends the canonical Scientific Roadmapping"
    - "node tests/test-364-sr-steps.cjs exits 0 with FAIL 0 and PASS at least 53; the other fixture consumers keep their pre-edit counts: sr-door 70, filing 49, mcp 31, refusal-e2e 52, part8 17, theo-handoff 9 (measured 2026-10-04 at plan time)"
    - "No live Theo or Brain call is made by this quick; the opt-in live smoke is not run"
  artifacts:
    - path: "tests/fixtures/364-theo/framework-step-authored.json"
      provides: "Theo 25 shaped authored payload: p01 to p07 STEP rows plus one synthetic DEFINITION and one synthetic ASIDE row"
      contains: "sciroad::scientific-roadmapping::p07"
    - path: "tests/fixtures/364-theo/framework-step-honest-empty.json"
      provides: "the retire-window honest empty: the framework row with steps []"
      contains: "\"steps\": []"
    - path: "tests/test-364-sr-steps.cjs"
      provides: "legs S1 to S21: Theo 25 ids, labels, deliberate nulls, thinkingMode distribution, retired ids and aliases, Tech Tree Mapping alias with no steps, honest empty, live-smoke predicate agreement, step-5 coverage"
      contains: "RETIRED_ALIASES"
    - path: "tests/test-364-sr-door.cjs"
      provides: "D2 and D3 step-map assertions on the p ids"
      contains: "sciroad::scientific-roadmapping::p04"
  key_links:
    - from: "tests/test-364-sr-steps.cjs"
      to: "tests/fixtures/364-theo/framework-step-*.json"
      via: "fx(name) reads each family; S17 and S18a enumerate every framework-step-*.json in the directory"
      pattern: "framework-step-honest-empty"
    - from: "tests/test-364-sr-steps.cjs S20"
      to: "tests/test-364-live-smoke.cjs lines 89-91"
      via: "the same seven-steps predicate and the same refusal predicate, applied offline to the fixtures"
      pattern: "label.trim\\(\\).length > 0"
    - from: "tests/helpers/fixture-door-364.cjs runnableRows"
      to: "tests/test-364-sr-door.cjs D2 and D3"
      via: "mapSteps label map over SR_OPERATIONS; sr:1 maps to p01, sr:7 to p07, positional sr:4 to p04"
      pattern: "sciroad::scientific-roadmapping::p0[147]"
---

<objective>
Move the Phase 364 Theo step fixtures and their tests from the retired `sr-v1-step-1..7` ids to Theo Phase 25's rebuilt Scientific Roadmapping (Theo write 1 `f05ac2c` at 2026-10-04T15:58:18Z, write 2 `43205a2` at 16:29:04Z), and pin what Theo now serves: the seven p ids and labels, STEP rows, the thinkingMode distribution, the deliberate researchDirective nulls, the draft status, the retired aliases, the Tech Tree Mapping alias that resolves but returns no steps, and the honest empty seen between the retire write and the structure write.

Purpose: the five fixture families and the tests that read them still describe the 2026-10-02 Theo state. Seven test files and one helper read these fixtures, so the ids must move together and stay green. This is the fixture half of follow-on A6. The live half (smoke re-run, authored live walk, recorded live payload) is excluded by the orchestrator's constraint: it waits for Theo's close message after the influence recompute (canon window 25 still open).

How the fixtures are produced: WRITTEN FROM THE THEO SESSION'S FACTS, not regenerated. No fixture generator or 364 script writes tests/fixtures/364-theo/. The only plugin script that calls framework_step is scripts/build-research-shape-ledger.cjs, and it writes data/research-shape-ledger.json and tests/fixtures/363-graph-snapshot.json, not these files. So this quick makes no live read through bin/mindrian-brain-mcp-client.cjs, scripts/mindrian-brain-mcp-client.cjs or lib/core/part8-egress-guard.cjs.

Text fields (runIt, artifactRubric, researchDirective) keep the existing "FIXTURE ..., not canon" marker strings, for two reasons. The facts carry no step prose. And Theo's authored prose is Brain IP, which a tracked plugin fixture must not hold (CLAUDE.md "The Three Layers": Brain = SECRET IP).

Output: six framework-step fixtures (five rewritten, one new honest-empty), updated tests/test-364-sr-steps.cjs (S1 to S21) and tests/test-364-sr-door.cjs (D2, D3 id strings), and a dated note in the 364 notify doc and in 364-FOLLOW-ONS A6.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md (read only; do not write)
@tests/test-364-sr-steps.cjs
@tests/test-364-live-smoke.cjs
@lib/core/research-planner/sr-steps.cjs
@.planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md

Theo Phase 25 facts (from the Theo session jsagi-93, 2026-10-04, the only source for this quick):
- framework_step("Scientific Roadmapping") returns seven steps in this order: `sciroad::scientific-roadmapping::p01` Tension Qualification, `p02` Goal Quantification, `p03` Rung Placement and Type Selection, `p04` Forum Construction, `p05` Path Enumeration, `p06` Constraint Interrogation, `p07` Catalytic Ranking.
- Every step is stepKind STEP with a thinkingMode (SEQUENTIAL 4, PARALLEL 1, ITERATIVE 1, DECOMPOSE 1) and an artifactRubric. Theo did not report which step carries which mode.
- label and runIt are set on all seven since write 2.
- researchDirective is set on p01 and p06 only. It is null on the other five on purpose (the reviewed prose names no evidence to weigh there). That null is not missing data.
- orchestrationStatus stays draft on every step.
- The old `sr-v1-step-1..7` ids are gone for good.
- Between the retire write and the structure write, framework_step returned no Scientific Roadmapping steps at all: an honest empty, not an error.
- The aliases Technology Roadmapping, Roadmapping (bare) and Field Roadmapping no longer resolve. Tech Tree Mapping resolves to the canonical name but returns no steps, so call it with the canonical name.
- Problem-type links: WellDefined rank 2, IllDefined rank 3. recommend_chain(WellDefined) lists Scientific Roadmapping at step 5.
- No tool was added or removed, no input shape changed, and no wire key was removed or renamed.

Plan-time measurements (2026-10-04, this planner, offline):
- Pre-edit counts, each exit 0: test-364-sr-steps PASS 37, sr-door 70, filing 49, mcp 31, refusal-e2e 52, part8 17, theo-handoff 9.
- Fixture consumers (grep): tests/test-364-sr-steps.cjs, tests/test-364-sr-door.cjs, tests/test-364-filing.cjs, tests/test-364-mcp.cjs, tests/test-364-refusal-e2e.cjs, tests/test-364-part8.cjs, tests/helpers/fixture-door-364.cjs (plus tests/helpers/fake-brain-364.cjs by path). Only sr-steps and sr-door quote fixture step ids. refusal-e2e line 201 needs the authored runIt to match /FIXTURE runIt/. mcp M4 (line 163) needs the labels "FIXTURE DEFINITION row" and "FIXTURE ASIDE row". part8 Q8 needs runIt text absent from the filed plan.
- Dry run in a scratch copy of the repo: the exact fixture spec in Task 1 plus the id edits in sr-door and sr-steps kept all seven consumers at their pre-edit counts. The colon ids pass through the CLI walk, the run state and the theo_step_id YAML line without change. No lib/ or scripts/ change is needed.
- At plan time every target path was clean (`git status --short` empty).

Session and scope rules (every task in this plan):
- Workspace is /home/jsagi/dev/MindrianOS-Plugin only (confirm with `pwd`).
- Every command runs with the nvm Node first: `export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH`.
- Peers share this working tree: a Phase 369 verifier and a Phase 369.1 executor are running. Before editing any file, run `git status --short -- <file>`. A diff you did not make belongs to a peer: STOP and report it.
- Commit only named paths: `git add <path>` (`git add -f` under `.planning/`), then `git commit --only -m "<msg>" -- <paths>`. Never `git add .`, `git add -A`, `git commit -a`, `git stash`, `git reset`, `git checkout -- <file>` or `--no-verify`. Do not use `gsd-tools query commit` (it sweeps the whole index). After each commit, run `git merge-base --is-ancestor <sha> HEAD` to confirm the commit is on HEAD.
- No STATE.md or ROADMAP.md writes while peers execute.
- Never kill a `mindrian-mcp-server` process or a shell you did not start. No `npm install` at the repo root.
- Hyphens only: no em-dash or en-dash in any file this plan touches.
- No live call of any kind: never set `MOS_364_LIVE=1`, never run tests/test-364-live-smoke.cjs live, never call brain-client, the mindrian-brain MCP client or any `mcp__theo__*` tool. Theo is a standing consult, but this quick consults Theo only through the facts quoted above. Every test here runs offline behind its own net guard.
- Edit nothing outside files_modified. That means no lib/, scripts/ or data/ change (data/research-shape-ledger.json still lists the retired aliases; that is out of scope here and goes in the SUMMARY as an observation). Do not edit tests/test-364-live-smoke.cjs. The other consumer tests (filing, mcp, refusal-e2e, part8) and both helpers stay untouched.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite the five fixture families to the Theo 25 ids, add the honest-empty fixture, move the quoted ids in sr-door and sr-steps</name>
  <files>tests/fixtures/364-theo/framework-step-all-null.json, tests/fixtures/364-theo/framework-step-one-null.json, tests/fixtures/364-theo/framework-step-authored.json, tests/fixtures/364-theo/framework-step-unlabelled-seven.json, tests/fixtures/364-theo/framework-step-eight-unlabelled.json, tests/fixtures/364-theo/framework-step-honest-empty.json, tests/test-364-sr-door.cjs, tests/test-364-sr-steps.cjs</files>
  <read_first>
    - tests/fixtures/364-theo/framework-step-*.json (all five as they are: the key order, the envelope, the authored list order and its descending sourceOrder 9,8,7,6,5,4,3,2,1)
    - tests/test-364-sr-steps.cjs lines 68-155 (S1 step_id line 73, S2 /def|aside/ regex line 89, S3 step_id line 100, S4 lines 91-93, S8 lines 150-154)
    - tests/test-364-sr-door.cjs lines 120-140 (D2 line 128, D3 lines 133-139)
    - tests/helpers/fixture-door-364.cjs lines 84-99 (runnableRows and theoAuthored read the fixtures)
    - lib/core/research-planner/sr-steps.cjs lines 103-126 (refuses only on a missing label or runIt; a null researchDirective passes through as null)
    - lib/core/dominant-design/theo-structure.cjs lines 135-167 (classifyCallResult: rows [] or rows[0].steps [] gives no_steps_in_canon)
  </read_first>
  <action>
Run `git status --short -- tests/fixtures/364-theo tests/test-364-sr-door.cjs tests/test-364-sr-steps.cjs` first. If it shows anything, STOP and report.

Write each fixture as 2-space-indented JSON with a trailing newline. Use the Write tool, or a throwaway generator in your scratchpad that is never committed. Write from the Theo facts in context; do not regenerate (no generator exists, and this quick makes no live call).

Envelope for every file: `rows: [{ name: "Scientific Roadmapping", orchestrationStatus: "draft", steps: [...] }]`, `frameworkIdentities: { resolved: ["Tech Tree Mapping"] }`, `diagnostics: {}`, `egress_disclosure: { verdict: "allow", disposition: "proceeded" }`. The one exception: framework-step-all-null keeps verdict "ambiguous" as it has today. "Tech Tree Mapping" alone replaces the old four-alias list, because the three retired aliases no longer resolve.

Step key order stays as today: stepId, label, runIt, stepKind, thinkingMode, researchDirective, artifactRubric, charStart, sourceOrder, orchestrationStatus, sourceConstruct.

A live-shaped step pNN for n = 1 to 7 has these values:
- stepId `sciroad::scientific-roadmapping::pNN` (two-digit n).
- label: the Theo 25 label for that position.
- runIt `FIXTURE runIt for sciroad::scientific-roadmapping::pNN, not canon`.
- stepKind `STEP`.
- thinkingMode: p01 to p04 `SEQUENTIAL`, p05 `PARALLEL`, p06 `ITERATIVE`, p07 `DECOMPOSE`. This is a fixture convention that assigns the modes in the order the Theo facts list them. Theo did not report the per-step mapping.
- researchDirective `FIXTURE researchDirective for sciroad::scientific-roadmapping::pNN, not canon` on p01 and p06 only. JSON null on p02, p03, p04, p05 and p07: the deliberate Theo nulls.
- artifactRubric `FIXTURE artifactRubric for sciroad::scientific-roadmapping::pNN, not canon`.
- charStart n*100, sourceOrder n, orchestrationStatus `draft`, sourceConstruct null.

The six fixtures:
(1) framework-step-all-null: seven rows p01 to p07. Every field is null except stepId and sourceOrder n, as today. This is the nothing-authored refusal family that S1, S6, S10, S11, S13, sr-door D16, mcp and refusal-e2e use.
(2) framework-step-one-null: seven live-shaped rows, with p04 runIt null.
(3) framework-step-authored: nine rows in this list order: p01 (sourceOrder 9), a DEFINITION row (8), p02 (7), p03 (6), p04 (5), p05 (4), an ASIDE row (3), p06 (2), p07 (1).
- All seven p rows are live-shaped and stepKind STEP. p03 is no longer stepKind null: S4 builds that case inline (below).
- The DEFINITION row: stepId `fixture-def-1`, label `FIXTURE DEFINITION row`, runIt `FIXTURE runIt for fixture-def-1, not canon`, stepKind `DEFINITION`. thinkingMode, researchDirective, artifactRubric, charStart and sourceConstruct are null. orchestrationStatus `draft`.
- The ASIDE row is the same with `fixture-aside-1`, `FIXTURE ASIDE row` and stepKind `ASIDE`.
- These two synthetic rows stay because S2, S5 and mcp M4 test the skip contract. Theo's live answer has none.
(4) framework-step-unlabelled-seven: seven live-shaped rows whose labels are `Fixture step A` to `Fixture step G`.
(5) framework-step-eight-unlabelled: the same seven rows plus a synthetic eighth row. Its stepId is `sciroad::scientific-roadmapping::p08`, label `Fixture step H`, thinkingMode `SEQUENTIAL`, researchDirective null, charStart 800, sourceOrder 8, and the rest follows the live-shaped values. Theo has seven steps; the eighth exists only to force step_map_unresolved.
(6) NEW framework-step-honest-empty: the envelope with `steps: []`. This is the retire-window honest empty, and it is also the shape the Tech Tree Mapping alias answers with.

In tests/test-364-sr-door.cjs, change only the quoted ids:
- line 128 `'sr-v1-step-1'` becomes `'sciroad::scientific-roadmapping::p01'`.
- line 135 `'sr-v1-step-1'` and `'sr-v1-step-7'` become p01 and p07.
- line 137 `'sr-v1-step-4'` becomes p04.
- Nothing else in that file changes.

In tests/test-364-sr-steps.cjs, make id-only moves so the file stays green at 37 checks:
- S1 step_id becomes p01. S3 step_id becomes p04.
- S4: build the case inline. Clone `fx('framework-step-authored')`, set p03's stepKind to null, read it, and check that the result includes p03 with stepKind null. The check name stays "S4 a runnable row with stepKind null is included".
- S8: find the template row with stepKind `'STEP'` instead of `'PROCEDURE'`. Build the 60 ids as `'sciroad::scientific-roadmapping::p' + String(i + 1).padStart(2, '0')` and expect steps[49].stepId to be `'sciroad::scientific-roadmapping::p50'`.
- Keep the S2 /def|aside/ check as written (the synthetic ids contain def and aside).

Hyphens only. No Theo repo path in any test file (test-364-theo-handoff T8 scans for it).

Commit: `git add tests/fixtures/364-theo/framework-step-honest-empty.json`, then `git commit --only -m "test(quick-261004-a6r): move 364 SR step fixtures to the Theo 25 p ids" -- tests/fixtures/364-theo/framework-step-all-null.json tests/fixtures/364-theo/framework-step-one-null.json tests/fixtures/364-theo/framework-step-authored.json tests/fixtures/364-theo/framework-step-unlabelled-seven.json tests/fixtures/364-theo/framework-step-eight-unlabelled.json tests/fixtures/364-theo/framework-step-honest-empty.json tests/test-364-sr-door.cjs tests/test-364-sr-steps.cjs`. Then confirm the sha with `git merge-base --is-ancestor`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && for t in sr-steps sr-door filing mcp refusal-e2e part8 theo-handoff; do H=$(mktemp -d); R=$(mktemp -d); env -u MOS_364_LIVE HOME=$H USERPROFILE=$H MINDRIAN_ROOMS_HOME=$R node tests/test-364-$t.cjs 2>&1 | tail -n 1 | sed "s/^/$t /"; rm -rf "$H" "$R"; done</automated>
  </verify>
  <acceptance_criteria>
    - The verify loop prints exactly these lines: `sr-steps PASS: 37 FAIL: 0`, `sr-door PASS: 70 FAIL: 0`, `filing PASS: 49 FAIL: 0`, `mcp PASS: 31 FAIL: 0`, `refusal-e2e PASS: 52 FAIL: 0`, `part8 PASS: 17 FAIL: 0`, `theo-handoff PASS: 9 FAIL: 0`
    - `grep -l "sr-v1" tests/fixtures/364-theo/*.json tests/test-364-sr-door.cjs; test $? -eq 1` succeeds (no file matches)
    - `ls tests/fixtures/364-theo/framework-step-*.json | wc -l` prints 6
    - `node -e "const f=require('./tests/fixtures/364-theo/framework-step-authored.json');const r=f.rows[0].steps.filter(s=>s.stepKind==='STEP');const w=[1,2,3,4,5,6,7].map(n=>'sciroad::scientific-roadmapping::p0'+n);const rd=r.filter(s=>s.researchDirective!==null).map(s=>s.stepId);const m={};r.forEach(s=>{m[s.thinkingMode]=(m[s.thinkingMode]||0)+1});process.exit(JSON.stringify(r.map(s=>s.stepId))===JSON.stringify(w)&&JSON.stringify(rd)===JSON.stringify([w[0],w[5]])&&r.every(s=>s.orchestrationStatus==='draft'&&typeof s.artifactRubric==='string')&&m.SEQUENTIAL===4&&m.PARALLEL===1&&m.ITERATIVE===1&&m.DECOMPOSE===1&&JSON.stringify(f.frameworkIdentities.resolved)==='[\"Tech Tree Mapping\"]'?0:1)"` exits 0
    - `node -e "const f=require('./tests/fixtures/364-theo/framework-step-honest-empty.json');process.exit(f.rows.length===1&&f.rows[0].name==='Scientific Roadmapping'&&Array.isArray(f.rows[0].steps)&&f.rows[0].steps.length===0?0:1)"` exits 0
    - `grep -c "not canon" tests/fixtures/364-theo/framework-step-authored.json` is at least 7 (18 expected)
    - `grep -lE "Technology Roadmapping|Field Roadmapping|\"Roadmapping\"" tests/fixtures/364-theo/framework-step-*.json; test $? -eq 1` succeeds
    - `grep -nP '[\x{2013}\x{2014}]' tests/fixtures/364-theo/*.json tests/test-364-sr-door.cjs tests/test-364-sr-steps.cjs; test $? -eq 1` succeeds
    - `git show --numstat <task-1-sha> -- tests/test-364-sr-door.cjs` shows at most 3 lines added and 3 removed (id strings only); `git show --name-only --format= <task-1-sha>` lists exactly the eight Task 1 paths
  </acceptance_criteria>
  <done>All six framework-step fixtures carry the Theo 25 shape, and no sr-v1 id remains in any fixture or in sr-door. The seven fixture consumers are green at their exact pre-edit counts. One commit holds the eight paths and is an ancestor of HEAD.</done>
</task>

<task type="auto">
  <name>Task 2: Pin the Theo 25 facts in tests/test-364-sr-steps.cjs (legs S14 to S21)</name>
  <files>tests/test-364-sr-steps.cjs</files>
  <read_first>
    - tests/test-364-sr-steps.cjs (whole file, as Task 1 left it; the makeFake helper lines 43-58, the checker C, the final zero-network check)
    - tests/test-364-live-smoke.cjs lines 54 and 89-92 (ENV_GAP_REASONS, the refusal predicate and the seven-steps predicate the live smoke applies)
    - lib/core/research-planner/sr-steps.cjs lines 177-203 (renderStatus prints "Theo steps unavailable: <reason>." for no_steps_in_canon)
    - lib/core/research-planner/perspective.cjs lines 36-44 (SR_OPERATIONS, the plugin-side seven labels the sr-door label map uses)
    - lib/core/dominant-design/theo-structure.cjs line 135 (classifyCallResult export)
  </read_first>
  <action>
Run `git status --short -- tests/test-364-sr-steps.cjs` first. It must be empty: Task 1 is committed. If not, STOP and report.

Add these constants near the top, after REFUSAL:
- `SR_ID(n)`, which returns `'sciroad::scientific-roadmapping::p' + String(n).padStart(2, '0')`.
- `THEO25_IDS`: p01 to p07.
- `THEO25_LABELS`: the seven literal Theo 25 labels in order, written out as strings, not imported.
- `RETIRED_ALIASES = ['Technology Roadmapping', 'Roadmapping', 'Field Roadmapping']`.
- `TECH_TREE = 'Tech Tree Mapping'`.
- `RETIRED_ID_RE = /^sr-v1-/`. This must be the ONLY place the string sr-v1 appears in the file.

Update the header comment:
- "Legs S1-S13" becomes "Legs S1-S21".
- Add one line saying the fixtures follow Theo Phase 25 write 1 f05ac2c and write 2 43205a2, written from the Theo session's reported facts rather than a live capture.
- Add one line saying the thinkingMode per-step assignment in the fixtures is a fixture convention. Only the distribution is canon.
- Do not mention the retired ids by their literal prefix in the comment.

Add the legs below before the final zero-network check, one C.check per bullet (16 new checks, so the summary reads PASS 53 if each bullet is one check):
- S14a: readSrSteps over the authored fixture returns ok, and the stepIds deep-equal THEO25_IDS in order.
- S14b: the step labels deep-equal THEO25_LABELS. THEO25_LABELS also deep-equals perspective.SR_OPERATIONS, because the sr-door label map depends on it.
- S14c: in the authored, one-null, unlabelled-seven and eight-unlabelled fixtures, every row whose stepKind is not DEFINITION or ASIDE has stepKind 'STEP' and step-level orchestrationStatus 'draft'. The authored read's framework_status is 'draft'.
- S15a: in the authored read, the stepIds whose researchDirective is not null deep-equal [SR_ID(1), SR_ID(6)].
- S15b: in the authored read, the researchDirective of p02, p03, p04, p05 and p07 is strictly `=== null`, and the read is ok. A deliberate null is never a refusal.
- S15c: thinkingMode and artifactRubric are non-empty strings on all seven read steps.
- S16: the thinkingMode counts over the seven read steps are exactly SEQUENTIAL 4, PARALLEL 1, ITERATIVE 1, DECOMPOSE 1. Do not assert which step carries which mode.
- S17: enumerate every `framework-step-*.json` in FIX. There are exactly 6, and no stepId in any of them matches RETIRED_ID_RE.
- S18a: in every one of those six fixtures, frameworkIdentities.resolved deep-equals [TECH_TREE] and contains none of RETIRED_ALIASES.
- S18b: build an alias-aware fake whose callTool answers by args.framework: 'Scientific Roadmapping' gets the authored fixture, TECH_TREE gets the honest-empty fixture, anything else gets `{ rows: [] }`. readSrSteps through it is ok with seven steps. The only recorded framework_step arg is `{ framework: 'Scientific Roadmapping' }`. mod.HANDLE is neither TECH_TREE nor any RETIRED_ALIASES entry.
- S18c: call that fake's callTool('framework_step', { framework: TECH_TREE }) directly, then classify the answer with theo-structure's classifyCallResult('framework_step', answer). The result is 'no_steps_in_canon': the alias resolves but serves no steps.
- S19a: readSrSteps over framework-step-honest-empty returns ok false with reason 'no_steps_in_canon' and no message. The reason is none of step_unauthored, call_threw, brain_unavailable, refused or egress_blocked. Keep S7's inline `{ rows: [] }` leg as the no-row variant.
- S19b: renderStatus of that honest-empty read with a covered coverage contains "Theo steps unavailable: no_steps_in_canon." It does not contain REFUSAL, and it has no em-dash or en-dash.
- S20a: apply the live smoke's seven-steps predicate verbatim to the authored read: ok true, steps length 7, every label and runIt a string with trim().length > 0. It holds. The fixture and the smoke agree on the Theo 25 shape.
- S20b: apply the live smoke's refusal predicate to the one-null read: reason step_unauthored and message === mod.REFUSAL_TEXT. It holds, with step_id SR_ID(4).
- S21: build a six-step chain from recommend-chain-thin by appending step 5 framework 'Scientific Roadmapping' and step 6 framework 'Pricing Review'. readCoverage returns covered: Theo 25 lists the framework at step 5, and coverage is membership only. The recorded call is (WellDefined, 6), and JSON.stringify of the result contains none of the five other chain framework names.

Keep every existing leg S1 to S13. Keep the net guard first and the zero-network check last.

Hyphens only. No Theo repo path. No live call.

Commit: `git commit --only -m "test(quick-261004-a6r): pin Theo 25 SR ids, deliberate nulls, retired aliases and the honest empty" -- tests/test-364-sr-steps.cjs`. Then confirm the sha with `git merge-base --is-ancestor`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && H=$(mktemp -d); R=$(mktemp -d); env -u MOS_364_LIVE HOME=$H USERPROFILE=$H MINDRIAN_ROOMS_HOME=$R node tests/test-364-sr-steps.cjs 2>&1 | tail -n 25; echo "exit=${PIPESTATUS[0]}"; rm -rf "$H" "$R"</automated>
  </verify>
  <acceptance_criteria>
    - `node tests/test-364-sr-steps.cjs` exits 0, its summary reads FAIL: 0, and PASS is at least 53
    - The output lists check names beginning S14a, S14b, S14c, S15a, S15b, S15c, S16, S17, S18a, S18b, S18c, S19a, S19b, S20a, S20b, S21, each prefixed PASS
    - `grep -c "sr-v1" tests/test-364-sr-steps.cjs` prints 1 (the RETIRED_ID_RE line only)
    - `grep -c "framework-step-honest-empty" tests/test-364-sr-steps.cjs` is at least 1, and `grep -c "RETIRED_ALIASES" tests/test-364-sr-steps.cjs` is at least 2
    - `grep -c "researchDirective" tests/test-364-sr-steps.cjs` is at least 2
    - `grep -nP '[\x{2013}\x{2014}]' tests/test-364-sr-steps.cjs; test $? -eq 1` succeeds, and `grep -c "jsagi/Theo" tests/test-364-sr-steps.cjs` prints 0
    - Re-running the Task 1 verify loop still prints sr-door 70, filing 49, mcp 31, refusal-e2e 52, part8 17 and theo-handoff 9, each FAIL: 0
  </acceptance_criteria>
  <done>test-364-sr-steps pins the Theo 25 ids, labels, STEP and draft, the thinkingMode distribution, the deliberate researchDirective nulls, the retired ids and aliases, the Tech Tree Mapping alias with no steps, the honest empty, the live-smoke predicates and step-5 coverage. It runs offline with zero network attempts. One commit, an ancestor of HEAD.</done>
</task>

<task type="auto">
  <name>Task 3: Dated notes in the 364 notify doc and follow-on A6, then the 364 sweep</name>
  <files>docs/2026-10-03-PHASE-364-THEO-NOTIFY.md, .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md</files>
  <read_first>
    - docs/2026-10-03-PHASE-364-THEO-NOTIFY.md section 4 (line 56, the "The seven steps" bullet that quotes the old ids)
    - tests/test-364-theo-handoff.cjs lines 51-59 and 102-109 (T2 required phrases, including "Theo has not authored this step yet"; the T7 dash fence)
    - .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md line 18 (A6 as written)
    - tests/run-all-364.sh lines 92-110 (the 364 legs and run_optin for the live smoke)
  </read_first>
  <action>
Run `git status --short -- docs/2026-10-03-PHASE-364-THEO-NOTIFY.md .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md` first. If it is not empty, STOP and report.

Notify doc: keep the 2026-10-02 sentences of "The seven steps" bullet verbatim. They are a dated record, and T2 needs the phrase "Theo has not authored this step yet". Add one indented sub-bullet directly under that bullet. It begins "Update 2026-10-04 (Theo Phase 25 write 1 `f05ac2c`, write 2 `43205a2`, as reported by the Theo session):" and says, in plain words:
- the `sr-v1-step-N` ids are retired;
- framework_step now returns seven STEP steps `sciroad::scientific-roadmapping::p01` to `p07` (Tension Qualification to Catalytic Ranking) with label and runIt set on all seven;
- researchDirective is set on p01 and p06 and is null on the other five on purpose;
- every step is draft;
- Technology Roadmapping, Roadmapping and Field Roadmapping no longer resolve, and Tech Tree Mapping resolves but returns no steps;
- the plugin fixtures and tests/test-364-sr-steps.cjs pin these ids (quick 261004-a6r);
- the plugin's live smoke has not been re-run yet: it waits for Theo's close message after the influence recompute.

Do not claim the command now walks the steps live. That is the smoke's job.

Touch no other section. The dated 2026-10-02 measurements quoted in 364-CONTEXT.md, 364-RESEARCH.md, 364-INPUT.md, 364-03-PLAN.md and 364-10-PLAN.md stay verbatim. They record what was true then, and the follow-on ledger is the living pointer.

364-FOLLOW-ONS.md: append to the end of the single A6 line (keep it one line) the text "PROGRESS 2026-10-04 (quick 261004-a6r): Theo 25 writes `f05ac2c` and `43205a2` landed; the step fixtures and tests/test-364-sr-steps.cjs now pin `sciroad::scientific-roadmapping::p01` to `p07`, written from the Theo session's reported facts, not a live capture. Still open: the live smoke re-run, the authored live walk on a fixture room, and a recorded authored live payload fixture, after Theo's close message (canon window 25)."

Hyphens only.

Then run the sweep. Run `env -u MOS_364_LIVE bash tests/run-all-364.sh` with a 10-minute timeout, writing its output to your scratchpad, and grep the `>>> 364 ` lines. Gate on the 364 legs only:
- every `>>> 364 ...` line PASSED, except `364 live smoke`, which must read SKIPPED (opt-in, MOS_364_LIVE unset).
- A red in a non-364 regression leg is not caused by this quick: only the 364 tests and the 364 helpers read these fixtures, as grep showed at plan time. Record any such red by name in the SUMMARY as pre-existing or peer-owned, and do not fix it.

Commit: `git add -f .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md`, then `git commit --only -m "docs(quick-261004-a6r): note the Theo 25 SR step ids in the 364 notify doc and follow-on A6" -- docs/2026-10-03-PHASE-364-THEO-NOTIFY.md .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md`. Then confirm the sha with `git merge-base --is-ancestor`.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH && H=$(mktemp -d); R=$(mktemp -d); env -u MOS_364_LIVE HOME=$H USERPROFILE=$H MINDRIAN_ROOMS_HOME=$R node tests/test-364-theo-handoff.cjs 2>&1 | tail -n 1; rm -rf "$H" "$R"; env -u MOS_364_LIVE bash tests/run-all-364.sh 2>&1 | grep -E '^>>> 364 '</automated>
  </verify>
  <acceptance_criteria>
    - test-364-theo-handoff prints PASS: 9 FAIL: 0
    - Every `>>> 364 ` line from run-all-364.sh reads PASSED except `>>> 364 live smoke: SKIPPED (opt-in, MOS_364_LIVE unset)`
    - `grep -c "sciroad::scientific-roadmapping::p01" docs/2026-10-03-PHASE-364-THEO-NOTIFY.md` is at least 1, and `grep -c "Theo has not authored this step yet" docs/2026-10-03-PHASE-364-THEO-NOTIFY.md` is at least 1
    - `grep -c "261004-a6r" .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md` prints 1, and that match is on the line beginning `- **A6**`
    - `grep -nP '[\x{2013}\x{2014}]' docs/2026-10-03-PHASE-364-THEO-NOTIFY.md .planning/phases/364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0/364-FOLLOW-ONS.md; test $? -eq 1` succeeds
    - `git show --name-only --format= <task-3-sha>` lists exactly the two doc paths
  </acceptance_criteria>
  <done>The notify doc and follow-on A6 carry a dated, honest note of the Theo 25 ids and of what is still open. The 364 legs are green, and the live smoke stayed skipped. One commit, an ancestor of HEAD.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Theo (Brain) to tracked plugin repo | Theo's authored step prose is Brain IP; a tracked fixture is public plugin source |
| plugin to Theo (Part 8 egress) | Any live read would cross the guarded mindrian-brain wire; this quick makes none |
| shared working tree | Peer sessions (369 verifier, 369.1 executor) hold uncommitted work in the same index |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-a6r-01 | Information disclosure | tests/fixtures/364-theo/*.json | mitigate | runIt, artifactRubric and researchDirective carry only "FIXTURE ..., not canon" marker strings; no Theo prose is copied; Task 1 gates `grep -c "not canon"` on the authored fixture |
| T-a6r-02 | Information disclosure | live Theo read during the quick | mitigate | no live call: MOS_364_LIVE stays unset (`env -u`), no brain-client or MCP client call; every test keeps its net guard and the final zero-network check |
| T-a6r-03 | Tampering | test-364-sr-steps legs | mitigate | S1 to S13 kept; the refusal legs (S1, S3, S7, S10, S11) still assert the exact REFUSAL_TEXT; PASS must rise from 37 to at least 53 with FAIL 0 |
| T-a6r-04 | Tampering | shared index and peer work | mitigate | `git status --short` before each edit, `git commit --only` on named paths, no add-all, stash, reset or --no-verify, ancestry check after each commit |
| T-a6r-05 | Repudiation | provenance of fixture content | mitigate | the test header, the notify doc and follow-on A6 all state the fixtures were written from the Theo session's facts (f05ac2c, 43205a2), not a live capture |
</threat_model>

<verification>
- The seven fixture consumers pass offline: sr-steps at least 53/0, sr-door 70/0, filing 49/0, mcp 31/0, refusal-e2e 52/0, part8 17/0, theo-handoff 9/0.
- `grep -l "sr-v1" tests/fixtures/364-theo/*.json tests/test-364-sr-door.cjs` finds nothing, and test-364-sr-steps.cjs holds the string once (RETIRED_ID_RE).
- run-all-364.sh shows every 364 leg PASSED and the live smoke SKIPPED (opt-in).
- Three commits, each made with `--only` on named paths and each an ancestor of HEAD. No path outside files_modified changed.

Source coverage audit:

| Source | Item | Covered by |
|--------|------|-----------|
| GOAL | refresh framework-step fixtures to Theo 25 | Task 1 |
| GOAL | update test-364-sr-steps expectations (ids, labels, nulls, retired aliases, Tech Tree Mapping) | Task 1 (ids), Task 2 (legs) |
| GOAL | keep the five families and the honest-empty case | Task 1 (families plus the new honest-empty fixture), Task 2 S19 plus the kept S7 |
| GOAL | update 364 docs where fixture ids are quoted | Task 3 (notify doc; A6 ledger); dated historical records kept verbatim, stated in Task 3 |
| GOAL | say whether regenerated or written from facts | objective: written from facts, no generator exists |
| CONSTRAINT | no live smoke, shared-tree git rules, hyphens only | context rules block, every task |
| REQ | QUICK-261004-a6r, 364-A6 (fixture half) | Tasks 1 to 3; the live half of A6 is excluded by the orchestrator constraint and stays tracked in A6 |
| RESEARCH | none (quick mode) | not applicable |
</verification>

<success_criteria>
- Every framework-step fixture uses the Theo 25 ids. The deliberate researchDirective nulls on p02, p03, p04, p05 and p07 are pinned as strict nulls that do not refuse.
- The three retired aliases are gone from every fixture. Tech Tree Mapping is pinned as an alias that resolves with no steps.
- The honest empty reads as no_steps_in_canon.
- All 364 offline legs are green, with no live call, no peer collision and no em-dash or en-dash.
</success_criteria>

<output>
Create `.planning/quick/261004-a6r-364-theo-sr-step-fixtures/261004-a6r-364-theo-sr-step-fixtures-SUMMARY.md` when done. Record:
- the three commit shas;
- the before and after PASS counts per consumer;
- that the fixtures were written from facts (no generator, no live read);
- the thinkingMode fixture convention;
- the observations: data/research-shape-ledger.json still lists the three retired aliases and pre-Theo-25 SR data, a regeneration for a later quick after canon window 25 closes; the live smoke treats no_steps_in_canon as neither a pass nor an ENV GAP, so an honest-empty Theo would read as exit 1 there; the new p ids match the Part 8 guard's PROCESS_STEP_ID_RE, unlike the retired ids;
- any non-364 regression red by name.

The quick orchestrator commits PLAN.md and SUMMARY.md. If you are asked to do it, use `git add -f` and `git commit --only` on exactly those two paths.
</output>
