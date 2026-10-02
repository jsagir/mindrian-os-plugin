#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 14 Task 2 (EPV366-08, D-09): the analogies perspective recall and the SAPPhIRE
 * statement template.
 *
 *   N1  the planted analogies pair (shared entities, near-zero word overlap) is a candidate; the planted
 *       eureka pair (high lexical overlap) is recalled by eureka and filtered out here
 *   N2  every candidate has a relational signal (shared entities or a shared framework node), lexical at
 *       or below the ceiling, and the lane structural
 *   N3  STATEMENT_TEMPLATE is frozen: slots function, behavior, structure for sides a and b, a fill rule,
 *       and a host_hint that sends the host to fill it from room text and never into a query
 *   N4  leaves carry no SAPPhIRE content; slots are short terms only; each pair leaf carries the closed
 *       pair with perspective 'analogies'; the set validates and builds a pyramid
 *   N5  known pair excluded, cap honored, deterministic output
 *   N6  constants, registry interface, no network code in the module, zero network attempts
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session env is cleared
 * BEFORE any repo module loads. Exit 77 when node:sqlite is missing. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-an-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-an-roomshome-'));
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
const C = hygiene.makeChecker('test-366-recall-analogies');

const PERSP = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
const Y = require(path.join(REPO_ROOT, 'lib/core/research-planner/pyramid.cjs'));
const eureka = require(path.join(PERSP, 'eureka-recall.cjs'));

const TAG = '20261002T000000Z';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-an-'));
const room = fixture.buildPerspectiveRoom(root, { name: 'room' });
const AN_PAIR = fixture.PLANTED.analogies;
const EU_PAIR = fixture.PLANTED.eureka;
const MODULE_FILE = path.join(PERSP, 'analogies-recall.cjs');

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function samePair(c, a, b) { return (c.a === a && c.b === b) || (c.a === b && c.b === a); }
function find(list, a, b) { return list.filter(function (c) { return samePair(c, a, b); })[0] || null; }

let mod = null;
try { mod = require(MODULE_FILE); } catch (e) { mod = null; C.check('analogies-recall.cjs loads', false, String(e && e.message)); }

(async function main() {
  if (mod) {
    const rec = mod.runRecall(room.roomDir, { tag: TAG, now: '2026-10-02T00:00:00.000Z' });

    await leg('N1 the planted analogies pair is a candidate; the lexical eureka pair is filtered out', function () {
      const eu = eureka.runRecall(room.roomDir, { tag: TAG + 'e' });
      const eurekaHasIt = !!find(eu.candidates, EU_PAIR[0], EU_PAIR[1]);
      const hasAn = !!find(rec.candidates, AN_PAIR[0], AN_PAIR[1]);
      const noEu = !find(rec.candidates, EU_PAIR[0], EU_PAIR[1]);
      return (rec.ok === true && eurekaHasIt && hasAn && noEu) || JSON.stringify({ eurekaHasIt: eurekaHasIt, hasAn: hasAn, noEu: noEu, cands: rec.candidates.map(function (c) { return [c.a, c.b, c.lexical]; }) });
    });

    await leg('N2 every candidate: relational signal, lexical at or below the ceiling, lane structural', function () {
      const ceil = mod.BUDGETS.lexical_ceiling;
      const bad = rec.candidates.filter(function (c) {
        const rel = (Array.isArray(c.shared_entities) && c.shared_entities.length > 0) || (Array.isArray(c.shared_frameworks) && c.shared_frameworks.length > 0);
        return !(rel && c.lexical <= ceil && c.lanes.indexOf('structural') !== -1);
      });
      return (rec.candidates.length >= 1 && bad.length === 0) || JSON.stringify(bad.slice(0, 3));
    });

    await leg('N3 STATEMENT_TEMPLATE is frozen with slots, a fill rule and a host_hint', function () {
      const t = mod.STATEMENT_TEMPLATE;
      const h = t && t.host_hint;
      const ok = t && Object.isFrozen(t) && t.schema === 'mos.sapphire-statement/1'
        && JSON.stringify(t.sides) === JSON.stringify(['a', 'b'])
        && JSON.stringify(t.slots) === JSON.stringify(['function', 'behavior', 'structure'])
        && typeof t.fill === 'string' && /never recall/.test(t.fill)
        && typeof h === 'string' && h.length > 0 && /host/.test(h) && /room text/.test(h) && /never/.test(h) && /query/.test(h)
        && rec.statement_template && rec.statement_template.host_hint === h;
      return !!ok || JSON.stringify(t);
    });

    await leg('N4 leaves carry no SAPPhIRE content; slots are short terms; closed pair; set validates', function () {
      const qs = rec.question_set;
      const shape = Q.validateQuestionSet(qs);
      const pairLeaves = qs.leaves.filter(function (l) { return l.pair; });
      const slotKeysOk = qs.leaves.every(function (l) { return !l.slots || Object.keys(l.slots).every(function (k) { return k === 'term' || k === 'term2'; }); });
      const noSapphire = !/sapphire|"function"|"behavior"|"structure"/i.test(JSON.stringify(qs.leaves));
      const pairsOk = pairLeaves.length >= 1 && pairLeaves.every(function (l) { return l.dimension === 'an:structural_transfer' && l.lens === 'an.structure' && l.pair.perspective === 'analogies' && l.pair.run_tag === TAG; });
      const shortOk = pairLeaves.every(function (l) { return !l.researchable || (l.slots && l.slots.term && l.slots.term2 && l.slots.term.length <= 80 && l.slots.term2.length <= 80); });
      const known = qs.leaves.filter(function (l) { return l.dimension === 'an:already_known'; })[0];
      const built = Y.buildPyramid(qs, {});
      const tplOk = qs.template_id === 'analogies' && qs.command === '/mos:find-analogies';
      return (shape.ok === true && slotKeysOk && noSapphire && pairsOk && shortOk && known && known.corpus === 'room' && built.ok !== false && tplOk)
        || JSON.stringify({ shape: shape, slotKeysOk: slotKeysOk, noSapphire: noSapphire, pairsOk: pairsOk, shortOk: shortOk, known: !!known, built: built.ok, tplOk: tplOk });
    });

    await leg('N5 known pair excluded, cap honored, deterministic', function () {
      const again = mod.runRecall(room.roomDir, { tag: TAG + 'b', now: '2026-10-02T00:00:00.000Z' });
      const det = JSON.stringify(rec.candidates) === JSON.stringify(again.candidates) && JSON.stringify(rec.counts) === JSON.stringify(again.counts);
      const room2 = fixture.buildPerspectiveRoom(root, { name: 'room-known' });
      const db = roomDb.openRoomDb(room2.roomDir);
      try { db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)').run(AN_PAIR[0], AN_PAIR[1], 'INFORMS', '{}'); } finally { roomDb.closeRoomDb(db); }
      const r2 = mod.runRecall(room2.roomDir, { tag: TAG });
      const excluded = !find(r2.candidates, AN_PAIR[0], AN_PAIR[1]) && r2.counts.excluded_known >= 1;
      const capped = mod.runRecall(room.roomDir, { tag: TAG + 'c', budgets: { max_candidates: 1 } });
      const capOk = capped.candidates.length === 1 && capped.pairs_truncated === rec.candidates.length - 1;
      return (det && excluded && capOk) || JSON.stringify({ det: det, excluded: excluded, counts2: r2.counts, capOk: capOk, truncated: capped.pairs_truncated, n: rec.candidates.length });
    });

    await leg('N6 constants, registry interface, no network code, zero network attempts', function () {
      const consts = mod.ID === 'analogies' && mod.TEMPLATE_ID === 'analogies' && mod.COMMAND === '/mos:find-analogies'
        && JSON.stringify(mod.LENSES) === JSON.stringify(['an.structure', 'an.known'])
        && mod.RUN_ROOT === path.join('.mindrian', 'perspectives', 'analogies')
        && mod.BUDGETS.max_candidates === 100 && mod.BUDGETS.max_leaves === 8 && mod.BUDGETS.lexical_ceiling === 0.15 && Object.isFrozen(mod.BUDGETS)
        && JSON.stringify(mod.STAGE_A_LANES) === JSON.stringify(['structural', 'icm_declared']) && Object.isFrozen(mod.STAGE_A_LANES);
      const idx = require(path.join(PERSP, 'index.cjs'));
      const reg = idx.getPerspective('analogies');
      const iface = reg && idx.INTERFACE_NAMES.every(function (n) { return n in reg; });
      const src = fs.readFileSync(MODULE_FILE, 'utf8');
      const netCode = /tavily|fetch\(|https?:\/\//i.test(src);
      const dirOk = fs.existsSync(path.join(mod.runDirFor(room.roomDir, TAG), '02_recall', 'output', 'candidates.jsonl'));
      const status = fs.readFileSync(path.join(mod.runDirFor(room.roomDir, TAG), 'STATUS.md'), 'utf8');
      return (consts && iface && !netCode && dirOk && /Analogies perspective run/.test(status) && net.attempts() === 0)
        || JSON.stringify({ consts: !!consts, iface: !!iface, netCode: netCode, dirOk: dirOk, net: net.attempts() });
    });
  }

  process.exitCode = C.summary();
  net.restore();
})();
