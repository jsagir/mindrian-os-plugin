#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * SEED-103: the Eureka perspective inside the research planner, end to end and
 * hermetic: a synthetic two-section room, recall from the local graph + ICM
 * structure (no embeddings, no model, no network), Stage A judge, a question
 * set the planner validates and turns into a plan, files as edit surfaces,
 * STATUS.md derived, and the MCP ops reachable through the tool handler.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolate from the machine's real rooms BEFORE any repo module loads (the
// test-363-mcp-tool idiom): the MCP room resolver reads the registry's active
// room before it falls back to the boot room, so without this a run could land
// in a real room.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-seed103-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-seed103-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
const recall = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-recall.cjs'));
const judge = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-judge.cjs'));
const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
const families = require(path.join(REPO_ROOT, 'lib/core/research-planner/families.cjs'));
const planner = require(path.join(REPO_ROOT, 'lib/core/research-planner/planner.cjs'));

hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: [], restore: function () {} };
const C = hygiene.makeChecker('test-seed103-eureka-perspective');

// ---------------------------------------------------------------------------
// fixture: two sections, four artifacts, two shared entities, one known pair
// ---------------------------------------------------------------------------
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-seed103-'));
const roomDir = path.join(root, 'room');
fs.mkdirSync(roomDir, { recursive: true });
fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nname: seed103-fixture\n---\n');
fs.mkdirSync(path.join(roomDir, 'problem-definition'), { recursive: true });
fs.mkdirSync(path.join(roomDir, 'market-analysis'), { recursive: true });
fs.writeFileSync(path.join(roomDir, 'problem-definition', 'CONTEXT.md'), '# problem-definition\n\nOne job: state the problem.\n\n## Inputs\n- Working (this run): ../market-analysis/output/segments.md\n\n## Process\n1. read\n\n## Outputs\n- problem.md\n\n## Human check\nRead it.\n');
fs.writeFileSync(path.join(roomDir, 'market-analysis', 'CONTEXT.md'), '# market-analysis\n\nOne job: size the market.\n\n## Inputs\n- Reference (every run): references/schema.md\n\n## Process\n1. read\n\n## Outputs\n- segments.md\n\n## Human check\nRead it.\n');

const db = roomDb.openRoomDb(roomDir);
function node(id, type, props, opts) { insertNode(db, id, type, JSON.stringify(props), Object.assign({ source_path: 'test:seed103', epistemic_type: 'observation' }, opts || {})); }
function edge(s, t, type) { db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)').run(s, t, type, '{}'); }

node('section:problem-definition', 'Section', { slug: 'problem-definition' });
node('section:market-analysis', 'Section', { slug: 'market-analysis' });
// artifacts: two per section; A1/M1 share vocabulary and an entity; A2/M2 share an entity only; A1/M2 are already connected
node('pd/A1', 'Artifact', { title: 'Membrane fouling in desalination intake filters', body: 'Biofilm growth on membrane surfaces raises pressure drop; periodic backwash and coating reduce fouling and extend service life.' });
node('pd/A2', 'Artifact', { title: 'Regulatory timeline for coastal permits', body: 'Permit approval cycles for coastal infrastructure and the agencies that gate them.' });
node('ma/M1', 'Artifact', { title: 'Surface coating suppliers for filtration membranes', body: 'Suppliers of anti-fouling coating for membrane filters; pricing tiers and biofilm resistance claims.' });
node('ma/M2', 'Artifact', { title: 'Segment sizing for municipal water utilities', body: 'Utility procurement cycles and the agencies that approve capital budgets.' });
node('pd/C1', 'claim', { text: 'Coating cadence sets membrane service life.', section: 'problem-definition' });
// a claim with no section of its own: inherits market-analysis through SOURCED_FROM
node('ma/C2', 'claim', { text: 'Utility procurement cycles gate coating adoption.' });
edge('ma/C2', 'ma/M2', 'SOURCED_FROM');
// scaffold rows must never be things (Phase 363.1 scaffold-as-content class)
node('problem-definition/BRAIN', 'Artifact', { title: 'BRAIN', body: 'Common scaffold text shared by every section template file in the room.' });
node('market-analysis/BRAIN', 'Artifact', { title: 'BRAIN', body: 'Common scaffold text shared by every section template file in the room.' });
edge('problem-definition/BRAIN', 'section:problem-definition', 'BELONGS_TO');
edge('market-analysis/BRAIN', 'section:market-analysis', 'BELONGS_TO');
edge('pd/A1', 'section:problem-definition', 'BELONGS_TO');
edge('pd/A2', 'section:problem-definition', 'BELONGS_TO');
edge('ma/M1', 'section:market-analysis', 'BELONGS_TO');
edge('ma/M2', 'section:market-analysis', 'BELONGS_TO');
node('ent/coating', 'technology', { name: 'anti-fouling coating' });
node('ent/agency', 'organization', { name: 'permitting agency' });
edge('pd/A1', 'ent/coating', 'DESCRIBES');
edge('ma/M1', 'ent/coating', 'DESCRIBES');
edge('pd/A2', 'ent/agency', 'DESCRIBES');
edge('ma/M2', 'ent/agency', 'DESCRIBES');
// the room already connects A1 and M2: must be excluded
edge('pd/A1', 'ma/M2', 'INFORMS');
// an existing opportunity over A2 + M1: must be excluded
node('opp/1', 'opportunity', { name: 'existing', evidence_ids: ['pd/A2', 'ma/M1'] });
roomDb.closeRoomDb(db);

(async function main() {
  // 1. substrate + recall, read-only, no network
  const rec = recall.runRecall(roomDir, { tag: '20261001T000000Z' });
  C.check('recall ok', rec.ok === true, JSON.stringify(rec.counts));
  C.check('things found across two sections', rec.counts.things >= 4 && rec.counts.sections === 2, JSON.stringify(rec.counts));
  const thingIds = recall.readJsonl(path.join(rec.run_dir, '01_substrate', 'output', 'things.jsonl')).map(function (t) { return t.id; });
  C.check('section-less claim inherits its section through SOURCED_FROM', thingIds.indexOf('ma/C2') !== -1, thingIds.join(','));
  C.check('scaffold BRAIN rows are never things', thingIds.every(function (id) { return !/\/BRAIN$/.test(id); }), thingIds.join(','));
  const keys = rec.candidates.map(function (c) { return c.a + '|' + c.b; });
  C.check('A1-M1 recalled (shared entity + lexical)', keys.indexOf('ma/M1|pd/A1') !== -1 || keys.indexOf('pd/A1|ma/M1') !== -1, keys.join(','));
  const a1m1 = rec.candidates.filter(function (c) { return (c.a === 'ma/M1' && c.b === 'pd/A1') || (c.a === 'pd/A1' && c.b === 'ma/M1'); })[0];
  C.check('A1-M1 carries shared_entity and lexical lanes', !!a1m1 && a1m1.lanes.indexOf('shared_entity') !== -1 && a1m1.lanes.indexOf('lexical') !== -1, a1m1 && a1m1.lanes.join(','));
  C.check('A1-M1 carries the ICM declared-coupling lane', !!a1m1 && a1m1.lanes.indexOf('icm_declared') !== -1, a1m1 && a1m1.lanes.join(','));
  C.check('A2-M2 recalled (shared entity only)', keys.indexOf('ma/M2|pd/A2') !== -1 || keys.indexOf('pd/A2|ma/M2') !== -1, keys.join(','));
  C.check('known pair A1-M2 excluded (existing edge)', keys.indexOf('ma/M2|pd/A1') === -1 && keys.indexOf('pd/A1|ma/M2') === -1, keys.join(','));
  C.check('known pair A2-M1 excluded (existing opportunity)', keys.indexOf('ma/M1|pd/A2') === -1 && keys.indexOf('pd/A2|ma/M1') === -1, keys.join(','));
  C.check('known pairs form the exclusion set', rec.counts.known_pairs >= 2, String(rec.counts.known_pairs));
  C.check('no same-section pair', rec.candidates.every(function (c) { return c.section_a !== c.section_b; }));
  C.check('couplings from CONTEXT.md Inputs', rec.couplings.length === 1, JSON.stringify(rec.couplings));

  // 2. cap
  const capped = recall.runRecall(roomDir, { tag: '20261001T000001Z', budgets: { max_candidates: 1 } });
  C.check('cap respected and truncation reported', capped.candidates.length === 1 && capped.pairs_truncated >= 1, capped.candidates.length + '/' + capped.pairs_truncated);

  // 3. files as edit surfaces + derived status
  const runDir = rec.run_dir;
  C.check('things.jsonl written', fs.existsSync(path.join(runDir, '01_substrate', 'output', 'things.jsonl')));
  C.check('candidates.jsonl written with header', (recall.readCandidates(roomDir, rec.tag) || {}).header !== null);
  const status1 = fs.readFileSync(path.join(runDir, 'STATUS.md'), 'utf8');
  C.check('STATUS.md derived: stage 02', /stage: 02_recall/.test(status1), status1.split('\n').slice(-2).join(' '));

  // 4. question set validates and the planner builds a plan from it
  const shape = Q.validateQuestionSet(rec.question_set);
  C.check('question set validates', shape.ok === true, JSON.stringify(shape.errors));
  C.check('eureka template registered with doors', Q.templateForCommand('/mos:eureka') && Q.templateForCommand('/mos:eureka').id === 'eureka');
  C.check('eu.transfer lens maps to concept-evidence with ce.pair', families.LENS_FAMILY['eu.transfer'] && families.LENS_FAMILY['eu.transfer'].family === 'concept-evidence/v1' && families.LENS_FAMILY['eu.transfer'].templates.indexOf('ce.pair') !== -1);
  const leaf = rec.question_set.leaves[0];
  const composed = families.composeForLeaf(leaf, { round: 1 });
  C.check('round-one queries compose for the first leaf', composed && composed.ok !== false && Array.isArray(composed.queries || composed.items || composed.composed) || (composed && composed.ok === true), JSON.stringify(composed).slice(0, 200));
  const built = planner.buildPlan(roomDir, rec.question_set, {});
  C.check('planner accepts the question set', built && built.ok !== false && !!built.run_id, JSON.stringify({ status: built && built.status, errors: built && built.errors }).slice(0, 300));

  // 5. judge stage: Stage A only, then with an injected judge and the measured band
  const j0 = await judge.runJudge(roomDir, rec.tag, { judge: 'none' });
  C.check('judge none writes verdicts', j0.ok && fs.existsSync(j0.file) && j0.summary.judge === 'none' && j0.summary.band === 'unknown');
  const status2 = fs.readFileSync(path.join(runDir, 'STATUS.md'), 'utf8');
  C.check('STATUS.md derived: stage 03', /stage: 03_judge/.test(status2));
  const j1 = await judge.judgeCandidates(rec.candidates, { judge: 'jev', judgeFn: async function () { return { choice: 'useful', confidence: 0.9 }; }, bucket: judge.JEV_USEFULNESS_BUCKET });
  C.check('measured bucket reads medium and routes to a human', j1.summary.band === 'medium' && j1.summary.human_routed === true, JSON.stringify(j1.summary));
  C.check('stage A fabricated-quantity gate fires', judge.stageAGate({ title_a: 'Save $4M with this', title_b: 'x', lanes: ['lexical'] }).pass === false);
  const j2 = await judge.judgeCandidates(rec.candidates, { judge: 'x', judgeFn: async function () { throw new Error('boom'); } });
  C.check('a throwing judge never breaks the stage', j2.rows.length === rec.candidates.length && j2.summary.judged === 0);

  // 6. edit surface: delete a candidate line, the judge sees fewer
  const candFile = path.join(runDir, '02_recall', 'output', 'candidates.jsonl');
  const lines = fs.readFileSync(candFile, 'utf8').split('\n').filter(Boolean);
  fs.writeFileSync(candFile, lines.slice(0, 2).join('\n') + '\n');
  const j3 = await judge.runJudge(roomDir, rec.tag, {});
  C.check('editing candidates.jsonl steers the next stage', j3.rows.length === 1, String(j3.rows.length));

  // 7. MCP ops through the real registration seam (the test-363-mcp-tool idiom:
  //    registerCoreTools with fallbackRoomDir, a session id on `extra`).
  let mcpDetail = '';
  try {
    const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));
    const captured = new Map();
    const stub = {
      tool: function (name, _d, _s, fn) { captured.set(name, fn); },
      registerTool: function (name, cfg, fn) { captured.set(name, fn); captured.set(name + ':cfg', cfg); },
    };
    registerCoreTools(stub, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
    const call = async function (input) {
      const raw = await captured.get('research_run')(input, { sessionId: 'sess-seed103' });
      return JSON.parse(raw.content[0].text);
    };
    const cfg = captured.get('research_run:cfg') || {};
    C.check('research_run declares MCP annotations', cfg.annotations && cfg.annotations.destructiveHint === false && cfg.annotations.openWorldHint === true, JSON.stringify(cfg.annotations));
    C.check('research_run description names the eureka ops', /eureka_recall/.test(String(cfg.description)) && /eureka_candidates/.test(String(cfg.description)));
    const r1 = await call({ op: 'eureka_recall', max_candidates: 5 });
    mcpDetail = JSON.stringify(r1).slice(0, 300);
    C.check('MCP eureka_recall runs on the bound room', r1.ok === true && r1.op === 'eureka_recall' && !!r1.run_tag && r1.counts.sections === 2, mcpDetail);
    C.check('MCP eureka_recall returns a plan and a next step', r1.plan && r1.plan.ok === true && typeof r1.next_step === 'string', JSON.stringify(r1.plan).slice(0, 200));
    const p0 = await call({ op: 'eureka_candidates', run_tag: r1.run_tag, limit: 1, offset: 0 });
    C.check('MCP eureka_candidates page 1: has_more and next_offset', p0.ok === true && p0.count === 1 && p0.has_more === true && p0.next_offset === 1 && p0.total >= 2, JSON.stringify(p0).slice(0, 200));
    const pLast = await call({ op: 'eureka_candidates', run_tag: r1.run_tag, limit: 1, offset: p0.total - 1 });
    C.check('MCP eureka_candidates last page: no more', pLast.ok === true && pLast.has_more === false && pLast.next_offset === null && pLast.judged === false, JSON.stringify(pLast).slice(0, 200));
    const j = await call({ op: 'eureka_judge', run_tag: r1.run_tag });
    C.check('MCP eureka_judge runs Stage A with judge none', j.ok === true && j.summary.judge === 'none', JSON.stringify(j).slice(0, 200));
    const p1 = await call({ op: 'eureka_candidates', run_tag: r1.run_tag, limit: 1 });
    C.check('MCP eureka_candidates carries verdict fields after the judge', p1.ok === true && p1.judged === true && p1.items[0].stage_a && typeof p1.items[0].stage_a.pass === 'boolean', JSON.stringify(p1.items[0]).slice(0, 200));
    const bad = await call({ op: 'eureka_judge', run_tag: '20990101T000000Z' });
    C.check('MCP refusal carries an actionable hint', bad.ok === false && typeof bad.hint === 'string' && /eureka_recall/.test(bad.hint), JSON.stringify(bad));
    const noTag = await call({ op: 'eureka_candidates' });
    C.check('MCP eureka_candidates without run_tag refuses with a hint', noTag.ok === false && noTag.reason === 'run_tag_required' && typeof noTag.hint === 'string');
  } catch (e) {
    C.check('MCP path threw', false, String(e && e.stack ? e.stack : e).slice(0, 400));
  }

  // 8. zero network
  const attemptCount = (net && typeof net.attempts === 'function') ? net.attempts() : ((net && Array.isArray(net.attempts)) ? net.attempts.length : 0);
  C.check('zero network attempts', attemptCount === 0, String(attemptCount));

  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
})().catch(function (err) {
  process.stderr.write('test-seed103-eureka-perspective THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
