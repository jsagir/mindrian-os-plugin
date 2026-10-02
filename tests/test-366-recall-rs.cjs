#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 13 Task 1 (EPV366-05, D-08): the RS perspective recall, derived
 * from the local graph and the ICM declared feeds with no embeddings.
 *
 *   RS1  the module exports the full perspective interface (frozen budgets and lanes), registry says available
 *   RS2  the planted lagging boundary: a thin solution-design thing paired with a developed
 *        problem-definition thing, lane flow_boundary, lag_score above zero, lag table leads with solution-design
 *   RS3  known pairs are excluded (existing INFORMS edges) and counted in counts.excluded_known
 *   RS4  max_candidates and pairs_per_boundary are hard caps; pairs_truncated reports the rest
 *   RS5  two runs with the same tag give byte-identical candidates.jsonl
 *   RS6  row shape (shared keys plus lag_score) and questionSetFor leaves (slots, closed pair, rs-known, validates)
 *   RS7  declared feeds carry direction (and a CONTEXT.md whose Inputs is the last heading still parses)
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the
 * session env is cleared BEFORE any repo module loads. Zero network. Exit 77 when
 * node:sqlite is missing. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-rs-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-rs-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: function () { return 0; }, restore: function () {} };
const C = hygiene.makeChecker('test-366-recall-rs');

const PERSP = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const index = require(path.join(PERSP, 'index.cjs'));
const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
const rs = require(path.join(PERSP, 'rs-recall.cjs'));
const eurekaRecall = require(path.join(PERSP, 'eureka-recall.cjs'));
const shared = require(path.join(PERSP, 'shared.cjs'));

const TAG = '20261002T000000Z';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-rs-'));

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function hasPair(rows, a, b) { return rows.some(function (r) { return (r.a === a && r.b === b) || (r.a === b && r.b === a); }); }

(async function main() {
  const room = fixture.buildPerspectiveRoom(root, { name: 'rs-room' });
  const P = room.planted;
  const target = room.ids.rs_target;
  const rec = rs.runRecall(room.roomDir, { tag: TAG });

  await leg('RS1 full perspective interface, frozen budgets and lanes, registry available', function () {
    index.INTERFACE_NAMES.forEach(function (n) { if (rs[n] === undefined) throw new Error('missing export ' + n); });
    if (rs.ID !== 'rs' || rs.TEMPLATE_ID !== 'rs') return 'ids ' + rs.ID + ' ' + rs.TEMPLATE_ID;
    if (rs.COMMAND !== '/mos:find-bottlenecks') return rs.COMMAND;
    if (JSON.stringify(rs.LENSES) !== '["rs.lag","rs.known"]') return JSON.stringify(rs.LENSES);
    if (!Object.isFrozen(rs.BUDGETS) || !Object.isFrozen(rs.STAGE_A_LANES)) return 'not frozen';
    if (JSON.stringify(rs.BUDGETS) !== '{"max_candidates":200,"max_leaves":8,"pairs_per_boundary":10}') return JSON.stringify(rs.BUDGETS);
    if (JSON.stringify(rs.STAGE_A_LANES) !== '["flow_boundary","icm_declared","support_gap"]') return JSON.stringify(rs.STAGE_A_LANES);
    if (rs.RUN_ROOT !== path.join('.mindrian', 'perspectives', 'rs')) return rs.RUN_ROOT;
    if (rs.FALSIFIER !== Q.TEMPLATES.rs.dimensions[0].falsifier_default) return 'falsifier differs from the rs template';
    if (index.available('rs') !== true) return 'registry says unavailable';
    if (index.getPerspective('rs') !== rs) return 'registry returns another module';
    return true;
  });

  await leg('RS2 planted lagging boundary: thin solution-design thing x developed problem-definition thing', function () {
    if (!rec.ok) return JSON.stringify(rec).slice(0, 200);
    const rows = rec.candidates;
    const hit = rows.filter(function (r) { return (r.a === target || r.b === target) && (r.section_a === 'problem-definition' || r.section_b === 'problem-definition'); });
    if (!hit.length) return 'no pair across the lagging boundary for ' + target;
    if (!hit.every(function (r) { return r.lanes.indexOf('flow_boundary') !== -1; })) return 'lanes ' + JSON.stringify(hit.map(function (r) { return r.lanes; }));
    if (!hit.every(function (r) { return typeof r.lag_score === 'number' && r.lag_score > 0; })) return 'lag_score';
    if (!hit.some(function (r) { return r.lanes.indexOf('icm_declared') !== -1; })) return 'declared feed lane missing';
    if (!hit.every(function (r) { return r.lanes.indexOf('support_gap') !== -1; })) return 'support_gap lane missing (no anchored claim exists)';
    const back = rs.readCandidates(room.roomDir, TAG);
    const lag = back && back.header && back.header.lag;
    if (!Array.isArray(lag) || !lag.length) return 'header lag table missing';
    if (lag[0].section !== 'solution-design' || !(lag[0].lag > 0)) return JSON.stringify(lag[0]);
    if (lag.some(function (l) { return !(l.lag > 0); })) return 'a non-lagging section is listed';
    return true;
  });

  await leg('RS3 known pairs excluded and counted', function () {
    const rows = rec.candidates;
    if (hasPair(rows, P.known[0], P.known[1])) return 'known pair present';
    if (hasPair(rows, 'pd/P1', target) || hasPair(rows, 'pd/P2', target)) return 'a pair already joined by INFORMS is present';
    if (!(rec.counts.excluded_known >= 1)) return 'excluded_known ' + rec.counts.excluded_known;
    if (rec.candidates.some(function (r) { return r.section_a === r.section_b; })) return 'same-section pair';
    const opp = room.ids.opportunity_pair;
    if (hasPair(rows, opp[0], opp[1])) return 'opportunity pair present';
    return true;
  });

  await leg('RS4 hard caps and truncation report', function () {
    const capped = rs.runRecall(room.roomDir, { tag: '20261002T000001Z', budgets: { max_candidates: 2 } });
    if (capped.candidates.length !== 2) return 'cap ' + capped.candidates.length;
    if (!(capped.pairs_truncated >= 1)) return 'truncated ' + capped.pairs_truncated;
    const perB = rs.runRecall(room.roomDir, { tag: '20261002T000002Z', budgets: { pairs_per_boundary: 1 } });
    const bySec = {};
    perB.candidates.forEach(function (r) { const k = [r.section_a, r.section_b].sort().join('|'); bySec[k] = (bySec[k] || 0) + 1; });
    if (Object.keys(bySec).some(function (k) { return bySec[k] > 1; })) return 'per boundary cap ' + JSON.stringify(bySec);
    if (!(perB.pairs_truncated >= 1)) return 'per boundary truncation not reported';
    if (rec.candidates.length > rs.BUDGETS.max_candidates) return 'default cap';
    return true;
  });

  await leg('RS5 same tag, byte-identical candidates.jsonl', function () {
    const file = path.join(rs.runDirFor(room.roomDir, TAG), '02_recall', 'output', 'candidates.jsonl');
    const first = fs.readFileSync(file);
    const again = rs.runRecall(room.roomDir, { tag: TAG });
    const second = fs.readFileSync(file);
    if (!first.equals(second)) return 'bytes differ';
    if (JSON.stringify(again.candidates) !== JSON.stringify(rec.candidates)) return 'candidates differ';
    if (file.indexOf(path.join(room.roomDir, '.mindrian', 'perspectives', 'rs')) !== 0) return file;
    return true;
  });

  await leg('RS6 row shape, ordering and the question set leaves', function () {
    const want = ['a', 'b', 'section_a', 'section_b', 'title_a', 'title_b', 'lanes', 'lexical', 'shared_entities', 'lag_score'];
    for (const r of rec.candidates) {
      want.forEach(function (k) { if (!(k in r)) throw new Error('row missing ' + k); });
      if (Math.round(r.lag_score * 10000) / 10000 !== r.lag_score) throw new Error('lag_score not at 4 places');
    }
    for (let i = 1; i < rec.candidates.length; i += 1) {
      if (rec.candidates[i - 1].lag_score < rec.candidates[i].lag_score) return 'not sorted by lag_score';
    }
    const qs = rec.question_set;
    if (qs.template_id !== 'rs') return qs.template_id;
    const lag = qs.leaves.filter(function (l) { return l.dimension === 'rs:lagging_component'; });
    if (!lag.length) return 'no rs:lagging_component leaf';
    const researchable = lag.filter(function (l) { return l.researchable === true; });
    if (!researchable.length) return 'no researchable pair leaf';
    for (const l of researchable) {
      if (!l.slots || Object.keys(l.slots).sort().join() !== 'cause,effect') return 'slots ' + JSON.stringify(l.slots);
      if (l.corpus !== 'openalex' || l.lens !== 'rs.lag') return 'corpus/lens ' + l.corpus + ' ' + l.lens;
      if (/[()"\n]/.test(l.slots.cause + l.slots.effect)) return 'slot not a short term';
    }
    for (const l of lag) {
      if (!l.pair || l.pair.perspective !== 'rs' || l.pair.run_tag !== TAG || !l.pair.a || !l.pair.b) return 'pair ' + JSON.stringify(l.pair);
      if (Object.keys(l.pair).sort().join() !== 'a,b,perspective,run_tag') return 'pair keys';
    }
    const known = qs.leaves.filter(function (l) { return l.dimension === 'rs:already_known'; });
    if (known.length !== 1 || known[0].corpus !== 'room' || known[0].lens !== 'rs.known') return 'rs-known leaf';
    if (qs.leaves.length > rs.BUDGETS.max_leaves + 1) return 'too many leaves ' + qs.leaves.length;
    const shape = Q.validateQuestionSet(qs);
    if (!shape.ok) return JSON.stringify(shape.errors);
    return true;
  });

  await leg('RS7 declared feeds carry direction; Inputs as the last heading still parses; no embedding code', function () {
    const feeds = rs._test.declaredFeeds(room.roomDir, ['problem-definition', 'market-analysis', 'solution-design', 'competitive-analysis']);
    const got = feeds.map(function (f) { return f.join('>'); }).sort();
    const want = ['market-analysis>competitive-analysis', 'problem-definition>solution-design'];
    if (JSON.stringify(got) !== JSON.stringify(want)) return JSON.stringify(got);
    // Inputs is the final heading and has no trailing newline
    const tail = fixture.buildPerspectiveRoom(root, { name: 'rs-tail', withoutDb: true });
    fs.writeFileSync(path.join(tail.roomDir, 'solution-design', 'CONTEXT.md'), '# solution-design\n\n## Inputs\n- Working: ../competitive-analysis/output/x.md');
    const f2 = rs._test.declaredFeeds(tail.roomDir, ['solution-design', 'competitive-analysis']).map(function (f) { return f.join('>'); });
    if (JSON.stringify(f2) !== '["competitive-analysis>solution-design"]') return JSON.stringify(f2);
    // a missing CONTEXT.md and a traversal-shaped slug read nothing
    const none = rs._test.declaredFeeds(tail.roomDir, ['solution-design', '../etc']);
    if (none.some(function (f) { return f.join('').indexOf('..') !== -1; })) return 'traversal slug used';
    const src = fs.readFileSync(path.join(PERSP, 'rs-recall.cjs'), 'utf8');
    if (/rs-engine|rs-math/.test(src.replace(/\/\*[\s\S]*?\*\//, ''))) return 'imports the legacy engine';
    if (typeof eurekaRecall.buildSubstrate !== 'function' || typeof shared.makeCandidateStore !== 'function') return 'contract missing';
    return true;
  });

  const attempts = typeof net.attempts === 'function' ? net.attempts() : 0;
  C.check('zero network attempts', attempts === 0, String(attempts));
  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
})().catch(function (err) {
  process.stderr.write('test-366-recall-rs THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
