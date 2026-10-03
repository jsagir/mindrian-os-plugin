#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 06 Tasks 1-2 -- filing the Scientific Roadmapping plan only on
 * an approved F.8 selection (THEO-C output rule, ROOT, Canon Part 9, rejection
 * is data). layer: graph
 *
 * Legs F1-F13 drive lib/core/research-planner/sr-filing.cjs over temp rooms
 * built by tests/helpers/fixture-room-364.cjs, with walked door state from
 * tests/helpers/fixture-door-364.cjs and the authored Theo fixture. Graph reads
 * are plain SELECTs on a read handle; every write goes through the module under
 * test. Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at mkdtemp
 * dirs before any repo module loads; the network guard is installed first and
 * the last check proves zero attempts. Exit 77 when node:sqlite is missing.
 *
 * House rule: hyphens only, no em-dashes, no emoji. Dash characters in checks
 * are spelled with String.fromCharCode.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-filing-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-filing-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  console.log('SKIP: node:sqlite is not available (ENV GAP)');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-filing');

const MOD_PATH = path.join(REPO_ROOT, 'lib/core/research-planner/sr-filing.cjs');
const fixtures = require(path.join(REPO_ROOT, 'tests/helpers/fixture-door-364.cjs'));
const roomFixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-364.cjs'));

const ROOT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-filing-'));
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const RUBRIC_LABEL = 'plugin-side rubric, not Theo content';

let roomCount = 0;
function newRoom(state) {
  roomCount += 1;
  return roomFixture.buildEntryRoom(ROOT_DIR, state || 'stated_goal', { name: 'filing-room-' + roomCount }).roomDir;
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function hasDash(s) { return String(s).indexOf(EM) !== -1 || String(s).indexOf(EN) !== -1; }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; } }

function rows(roomDir, sql, args) {
  const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
  const db = navigation.openRoomDbForCaller(roomDir);
  if (!db) return [];
  try { const st = db.prepare(sql); return st.all.apply(st, args || []); } finally { navigation.closeRoomDbForCaller(db); }
}
function counts(roomDir) {
  return {
    nodes: rows(roomDir, 'SELECT COUNT(*) AS n FROM nodes')[0].n,
    edges: rows(roomDir, 'SELECT COUNT(*) AS n FROM edges')[0].n,
  };
}
function nodeIds(roomDir) { return rows(roomDir, 'SELECT id FROM nodes').map(function (r) { return r.id; }); }
function planDirFiles(roomDir) {
  const d = path.join(roomDir, 'research-plan');
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d);
}

// the first frontmatter block as a flat text, plus a tiny reader for the keys the legs need
function frontmatter(md) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md || '');
  return m ? m[1] : '';
}
function fmScalar(fm, key) {
  const m = new RegExp('^' + key + ': (.*)$', 'm').exec(fm);
  return m ? m[1].replace(/^"|"$/g, '') : null;
}
function stepBlocks(fm) {
  const at = fm.indexOf('\nsteps:');
  if (at === -1) return [];
  const tail = fm.slice(at + 7);
  return tail.split(/\n  - stage: /).slice(1).map(function (b) {
    const o = { stage: b.split('\n')[0].replace(/^"|"$/g, '') };
    b.split('\n').slice(1).forEach(function (line) {
      const m = /^    ([a-z_]+): (.*)$/.exec(line);
      if (m) o[m[1]] = m[2].replace(/^"|"$/g, '');
    });
    return o;
  });
}

async function main() {
  let sr = null;
  try { sr = require(MOD_PATH); } catch (e) { C.check('F0 sr-filing.cjs loads', false, e.message); }
  const filing = require(path.join(REPO_ROOT, 'lib/core/research-planner/filing.cjs'));
  C.check('F13a filing.checkAuthority is exported as a function', typeof filing.checkAuthority === 'function');
  if (!sr) {
    C.check('F13 zero network attempts', net.attempts() === 0);
    process.exit(C.summary() || 1);
  }
  const perspective = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspective.cjs'));
  const theoFx = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/364-theo/framework-step-authored.json'), 'utf8'));
  const theoLabels = theoFx.rows[0].steps.map(function (s) { return s.label; });

  const DATE = '2026-10-03';
  const stateA = fixtures.walkedState();
  stateA.discarded = [
    { kind: 'route', id: 'P9', reason: 'Needs a cell chemistry nobody can source this decade' },
    { kind: 'route', id: 'P8', reason: 'Duplicates path P2 at higher cost' },
  ];
  const basketA = sr.buildPlanBasket(stateA);
  const allIds = basketA.map(function (i) { return i.id; });

  // ---- contract shape of the basket
  C.check('F0 basket first item is research_plan', basketA[0] && basketA[0].id === 'research_plan' && basketA[0].kind === 'research_plan' && basketA[0].default_on === true);
  C.check('F0 basket carries step_claim and discarded_route items',
    allIds.some(function (i) { return /^step_claim:sr:\d$/.test(i); }) && allIds.filter(function (i) { return /^discarded_route:/.test(i); }).length === 2);
  C.check('F0 labels are plain words, at most 160 characters, no dashes',
    basketA.every(function (i) { return typeof i.label === 'string' && i.label.length > 0 && i.label.length <= 160 && !hasDash(i.label); }));
  C.check('F0 PLAN_REL and HISTORY_REL constants', sr.PLAN_REL === 'research-plan/PLAN.md' && sr.HISTORY_REL === 'research-plan/history');

  // ---- F1 no selection writes nothing
  const r1 = newRoom('stated_goal');
  const before1 = counts(r1);
  const f1 = sr.filePlan(r1, stateA, null, { date: DATE });
  C.check('F1 null selection refused no_approved_selection', f1.ok === false && f1.reason === 'no_approved_selection', JSON.stringify(f1));
  C.check('F1 nothing written (files and graph)', planDirFiles(r1).length === 0 && JSON.stringify(counts(r1)) === JSON.stringify(before1));

  // ---- F2 unapproved, grant-carrying, unknown
  const r2 = newRoom('stated_goal');
  const before2 = counts(r2);
  const f2a = sr.filePlan(r2, stateA, { approved: false, items: ['research_plan'] }, { date: DATE });
  const f2b = sr.filePlan(r2, stateA, { approved: true, items: [], grant_id: 'g1' }, { date: DATE });
  const f2c = sr.filePlan(r2, stateA, { approved: true, items: ['nope'] }, { date: DATE });
  C.check('F2 unapproved refused', f2a.ok === false && f2a.reason === 'no_approved_selection', JSON.stringify(f2a));
  C.check('F2 grant-carrying refused', f2b.ok === false && f2b.reason === 'grant_not_authority', JSON.stringify(f2b));
  C.check('F2 unknown item refused', f2c.ok === false && f2c.reason === 'unknown_item', JSON.stringify(f2c));
  C.check('F2 each refusal wrote nothing', planDirFiles(r2).length === 0 && JSON.stringify(counts(r2)) === JSON.stringify(before2));

  // ---- F3 approved selection of everything
  const r3 = newRoom('stated_goal');
  const idsBefore3 = new Set(nodeIds(r3));
  const f3 = sr.filePlan(r3, stateA, { approved: true, items: allIds }, { date: DATE });
  C.check('F3 approved selection files ok', f3.ok === true, JSON.stringify(f3));
  const planAbs3 = path.join(r3, 'research-plan', 'PLAN.md');
  const md3 = readSafe(planAbs3);
  C.check('F3 research-plan/PLAN.md exists', md3 !== null);
  const fm3 = frontmatter(md3);
  C.check('F3 frontmatter names the rung and the methodology', fmScalar(fm3, 'rung') === 'WellDefined' && fmScalar(fm3, 'methodology') === 'scientific-roadmap', fm3.slice(0, 300));
  const steps3 = stepBlocks(fm3);
  C.check('F3 seven Stage A steps with a status run, not_run or declined',
    steps3.length === 7 && steps3.every(function (s) { return ['run', 'not_run', 'declined'].indexOf(s.status) !== -1; }), JSON.stringify(steps3).slice(0, 300));
  C.check('F3 frontmatter carries review_status proposed, run_tag, roadmap_type and both frameworks',
    fmScalar(fm3, 'review_status') === 'proposed' && fmScalar(fm3, 'run_tag') === stateA.run_tag
    && fmScalar(fm3, 'roadmap_type') === 'technology roadmap' && /Scientific Roadmapping/.test(fm3) && /Hypothesis-Driven Problem Solving/.test(fm3));
  C.check('F3 body carries the published sections',
    ['## What must be delivered', '## Steps', '## Systems pass', '## Ranked limiters', '## Hypotheses handed to /mos:research', '## Settled, not re-argued', '## Discarded routes']
      .every(function (h) { return md3.indexOf(h) !== -1; }));
  C.check('F3 report names plan_rel and a plan node', f3.report && f3.report.plan_rel === 'research-plan/PLAN.md' && typeof f3.report.plan_node_id === 'string' && f3.report.plan_node_id.length > 0);
  const planNodes3 = rows(r3, "SELECT id FROM nodes WHERE type='memory_artifact' AND json_extract(properties,'$.path') = ?", ['research-plan/PLAN.md']);
  C.check('F3 PLAN.md is a graph citizen', planNodes3.length === 1 && planNodes3[0].id === f3.report.plan_node_id);

  // ---- F4 entered at step 6
  const r4 = newRoom('rs_finding');
  const entry4 = fixtures.syntheticEntry({
    proposed_step: 6,
    not_run: [1, 2, 3, 4, 5].map(function (n) { return { step: n, reason: 'filed earlier', stand_in: { kind: 'sr_plan', id: '2026-09-30-sr-fixture-0000abcd' } }; }),
    bound: { reverse_salients: [], dominant_designs: [], futures: [], systems: [] },
  });
  let state4 = null;
  try {
    state4 = fixtures.walkedState({ entry: entry4, chosenStep: 6 });
  } catch (e) { C.check('F4 walked state at step 6 builds', false, e.message); }
  if (state4) {
    const b4 = sr.buildPlanBasket(state4);
    const f4 = sr.filePlan(r4, state4, { approved: true, items: ['research_plan'] }, { date: DATE });
    C.check('F4 files ok', f4.ok === true, JSON.stringify(f4));
    const md4 = readSafe(path.join(r4, 'research-plan', 'PLAN.md')) || '';
    const st4 = stepBlocks(frontmatter(md4));
    C.check('F4 steps 1-5 are not_run with their stand-in',
      st4.length === 7 && st4.slice(0, 5).every(function (s) { return s.status === 'not_run' && /sr_plan/.test(s.stand_in || ''); }), JSON.stringify(st4).slice(0, 300));
    C.check('F4 not-run steps offer no step claim', b4.filter(function (i) { return /^step_claim:sr:[1-5]$/.test(i.id); }).length === 0);
    const sys4 = /## Systems pass\n([\s\S]*?)\n## /.exec(md4);
    C.check('F4 systems pass section says declined with the reason', !!sys4 && /declined/i.test(sys4[1]) && /fixture: no systems artifact/.test(sys4[1]), sys4 && sys4[1]);
  }

  // ---- F5 step wording only from Theo
  C.check('F5 every theo_label equals an authored Theo label',
    steps3.length === 7 && steps3.every(function (s) { return theoLabels.indexOf(s.theo_label) !== -1; }), JSON.stringify(steps3.map(function (s) { return s.theo_label; })));
  const guard = perspective.srStepGuide(null);
  const keyQs = (guard && Array.isArray(guard.steps) ? guard.steps : []).map(function (s) { return s.key_question; }).filter(Boolean);
  C.check('F5 the local step guide has key questions to hunt', keyQs.length > 0);
  C.check('F5 no local key_question appears in PLAN.md', keyQs.every(function (q) { return md3.indexOf(q) === -1; }));

  // ---- F6 claims land proposed
  const claimNodes3 = rows(r3, "SELECT id, type, review_status FROM nodes WHERE type='claim'").filter(function (n) { return !idsBefore3.has(n.id); });
  C.check('F6 filing wrote at least one claim node', claimNodes3.length > 0 && Object.keys(f3.report.claim_nodes).length === claimNodes3.length, claimNodes3.length + ' vs ' + Object.keys(f3.report.claim_nodes).length);
  C.check('F6 every new claim node is review_status proposed', claimNodes3.every(function (n) { return n.review_status === 'proposed'; }));
  const informs3 = rows(r3, "SELECT source, target FROM edges WHERE type='INFORMS' AND target = ?", [f3.report.plan_node_id]);
  C.check('F6 each claim INFORMS the PLAN.md node', informs3.length === claimNodes3.length);

  // ---- F7 rejection is data
  const rej3 = rows(r3, "SELECT source, target FROM edges WHERE type='REJECTED_BECAUSE'");
  C.check('F7 one REJECTED_BECAUSE edge per selected discarded route', rej3.length === 2 && Object.keys(f3.report.discarded_nodes).length === 2, JSON.stringify(rej3));
  C.check('F7 each edge runs from a decision node to the PLAN.md node',
    rej3.every(function (e) {
      const src = rows(r3, 'SELECT type FROM nodes WHERE id = ?', [e.source])[0];
      return e.target === f3.report.plan_node_id && src && src.type === 'decision';
    }));
  C.check('F7 report counts the edges and none failed', f3.report.edges.written >= 4 && f3.report.edges.failed === 0, JSON.stringify(f3.report.edges));
  const md3disc = /## Discarded routes\n([\s\S]*?)(\n## |\n### |$)/.exec(md3);
  C.check('F7 PLAN.md lists the discarded routes with their reasons', !!md3disc && /P9/.test(md3disc[1]) && /Duplicates path P2/.test(md3disc[1]));

  // ---- F8 selecting only a step claim adds research_plan
  const r8 = newRoom('stated_goal');
  const claimItem = allIds.filter(function (i) { return /^step_claim:/.test(i); })[0];
  const f8 = sr.filePlan(r8, stateA, { approved: true, items: [claimItem] }, { date: DATE });
  C.check('F8 step-claim-only selection files ok', f8.ok === true, JSON.stringify(f8));
  C.check('F8 research_plan was added and a note says so',
    fs.existsSync(path.join(r8, 'research-plan', 'PLAN.md')) && Array.isArray(f8.report.notes) && f8.report.notes.some(function (n) { return /research.plan/i.test(n) && /added|alongside|always/i.test(n); }), JSON.stringify(f8.report && f8.report.notes));

  // ---- F9 identity file
  const roomMd = readSafe(path.join(r3, 'research-plan', 'ROOM.md'));
  C.check('F9 research-plan/ROOM.md exists after filing', roomMd !== null && roomMd.length > 0);

  // ---- F10 history instead of overwrite
  const r10 = newRoom('stated_goal');
  const first = sr.filePlan(r10, stateA, { approved: true, items: ['research_plan'] }, { date: '2026-10-01' });
  const stateB = clone(stateA);
  stateB.run_tag = 'sr-20261003-feedbeef';
  const second = sr.filePlan(r10, stateB, { approved: true, items: ['research_plan'] }, { date: DATE });
  const hist = path.join(r10, 'research-plan', 'history');
  const histFiles = fs.existsSync(hist) ? fs.readdirSync(hist) : [];
  const fresh10 = readSafe(path.join(r10, 'research-plan', 'PLAN.md')) || '';
  C.check('F10 both filings ok', first.ok === true && second.ok === true, JSON.stringify([first, second]).slice(0, 300));
  C.check('F10 the first PLAN.md moved to research-plan/history/ as <date>-<run_tag>-PLAN.md', histFiles.length === 1 && histFiles[0] === '2026-10-01-' + stateA.run_tag + '-PLAN.md', histFiles.join(','));
  const histMd = histFiles.length ? (readSafe(path.join(hist, histFiles[0])) || '') : '';
  C.check('F10 history holds the earlier plan and PLAN.md holds the fresh one',
    fmScalar(frontmatter(histMd), 'run_tag') === stateA.run_tag && fmScalar(frontmatter(fresh10), 'run_tag') === stateB.run_tag);

  // ---- F11 card
  const card = sr.planBasketCard(basketA);
  C.check('F11 card first line is the plan question', card && typeof card.body_md === 'string' && card.body_md.split('\n')[0] === '## File this research plan?', card && card.body_md && card.body_md.split('\n')[0]);
  C.check('F11 card keeps the proposed-only promise and the F.8 shape', /Everything lands as proposed/.test(card.body_md) && card.shape === 'F.8');
  C.check('F11 card payload lists every basket id', Array.isArray(card.payload.item_ids) && card.payload.item_ids.length === basketA.length);

  // ---- F12 rubric label and dashes
  C.check('F12 PLAN.md carries the rubric label', md3.indexOf(RUBRIC_LABEL) !== -1);
  C.check('F12 PLAN.md, card and ROOM.md carry no em-dash or en-dash', !hasDash(md3) && !hasDash(card.body_md) && !hasDash(roomMd));
  C.check('F12 PLAN.md renders no grade or score wording', !/\b(grade|score)[sd]?\b/i.test(md3.replace(/Scientific-method rubric[^\n]*/g, '')));
  const rendered = sr.renderPlanMd(stateA, { date: DATE });
  C.check('F12 renderPlanMd is pure and matches the filed file', typeof rendered === 'string' && rendered === md3);

  // ---- source hygiene (acceptance)
  const src = fs.readFileSync(MOD_PATH, 'utf8');
  C.check('F12 source: no network or brain client, no dash bytes', !/fetch\(|brain-client|mcp__theo/.test(src) && !hasDash(src));
  const authAt = src.indexOf('checkAuthority');
  const writeAt = src.indexOf('atomicWrite(');
  C.check('F12 source: checkAuthority appears before the first atomicWrite call', authAt !== -1 && writeAt !== -1 && authAt < writeAt);

  C.check('F13 zero network attempts', net.attempts() === 0);
  process.exit(C.summary());
}

main().catch(function (e) { console.log('FAIL: unhandled ' + (e && e.stack || e)); process.exit(1); });
