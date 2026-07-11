#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 216-05 -- the FIELD-CONTRACT test for the room-native substrate path,
 * mirroring tests/test-215-field-contract.cjs onto the room.db adapter.
 *
 * WHY THIS TEST EXISTS (the bug it would have caught):
 *   buildRoomNativeSubstrate's `section` field fell back to the room.db node's
 *   schema-level `type` column. That column is the ICM node TYPE ('Section'
 *   for every section anchor, 'Artifact' for entries, 'memory_event' for
 *   bookkeeping), not a domain label. Against a real room (ador-ip-test, 68
 *   nodes) every pre-Phase-162-vintage Section anchor carries props {name,
 *   label} with NO section key, so all 11 anchors hit the type fallback; and
 *   because every edge is BELONGS_TO artifact-to-section, those anchors
 *   dominate degree and therefore every top-ranked pair. deriveSharedProblems
 *   and opportunity-statement deriveFields interpolate `section` VERBATIM into
 *   user prose, so 25 of 25 Opportunity Statements read literally
 *   'a Section x Section cross-domain bridge' (the 216-04 navigator-logged
 *   gap). The real domain signal exists: props.section on Artifact rows and
 *   the source_path first path segment everywhere else.
 *
 * This test reproduces the exact ador vintage room shape hermetically, then
 * drives the REAL substrate adapter, the REAL deriveSharedProblems fallback,
 * and the REAL buildOpportunityStatement emitter, asserting no ICM type value
 * ever reaches a section field or statement text. Hermetic (temp dir),
 * offline, node built-ins + shipped modules only. No em-dashes.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { buildRoomNativeSubstrate } = require(path.join(REPO_ROOT, 'lib/core/eureka/room-native-substrate.cjs'));
const { deriveSharedProblems } = require(path.join(REPO_ROOT, 'scripts/eureka-portfolio-report.cjs'));
const oppmod = require(path.join(REPO_ROOT, 'lib/core/eureka/opportunity-statement.cjs'));

let PASS = 0;
let FAIL = 0;
function ok(cond, msg) {
  if (cond) { PASS += 1; } else { FAIL += 1; process.stderr.write('  FAIL: ' + msg + '\n'); }
}

// Fixture room builder (the test-216-room-substrate makeRoom idiom). Note the
// source_path default is 'fixture://' + id, so every derivation-under-test row
// passes an EXPLICIT source_path.
function makeRoom(nodeSpecs, edgeSpecs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-216-fc-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (let i = 0; i < nodeSpecs.length; i += 1) {
    const n = nodeSpecs[i];
    ins.run(n.id, n.type || 'Claim', JSON.stringify(n.props || {}), n.source_path || ('fixture://' + n.id), 'import', n.created_at, n.created_at);
  }
  if (edgeSpecs && edgeSpecs.length) {
    const eins = db.prepare('INSERT INTO edges(source,target,type,properties) VALUES (?,?,?,?)');
    for (let i = 0; i < edgeSpecs.length; i += 1) {
      const e = edgeSpecs[i];
      eins.run(e.source, e.target, e.type || 'BELONGS_TO', JSON.stringify(e.props || {}));
    }
  }
  closeRoomDb(db);
  return dir;
}

function day(n) {
  return '2026-07-0' + n + 'T00:00:00.000Z';
}

function main() {
  // The ador-ip-test vintage reproduction (grounded in live data queried at
  // plan time): two pre-162-vintage Section anchors (type 'Section', props
  // {name, label} with NO section key, source_path = the bare slug), four
  // Artifact nodes (props carry title + the real section slug, source_path =
  // slug/filename), BELONGS_TO edges artifact -> anchor so the anchors
  // dominate degree exactly as they dominated the real room's top pairs, and
  // one memory_event bookkeeping row (source_path 'system:default').
  const nodes = [
    { id: 'business-model', type: 'Section', props: { name: 'business-model', label: 'BUSINESS MODEL' }, source_path: 'business-model', created_at: day(1) },
    { id: 'competitive-analysis', type: 'Section', props: { name: 'competitive-analysis', label: 'COMPETITIVE ANALYSIS' }, source_path: 'competitive-analysis', created_at: day(1) },
    { id: 'ART1', type: 'Artifact', props: { title: 'investor meeting prep', section: 'business-model' }, source_path: 'business-model/2026-05-26-investor-meeting-prep-eran', created_at: day(2) },
    { id: 'ART2', type: 'Artifact', props: { title: 'pricing model draft', section: 'business-model' }, source_path: 'business-model/pricing-model-draft.md', created_at: day(3) },
    { id: 'ART3', type: 'Artifact', props: { title: 'competitor teardown', section: 'competitive-analysis' }, source_path: 'competitive-analysis/competitor-teardown.md', created_at: day(4) },
    { id: 'ART4', type: 'Artifact', props: { title: 'positioning map', section: 'competitive-analysis' }, source_path: 'competitive-analysis/positioning-map.md', created_at: day(5) },
    { id: 'MEM1', type: 'memory_event', props: {}, source_path: 'system:default', created_at: day(6) },
  ];
  const edges = [
    { source: 'ART1', target: 'business-model' },
    { source: 'ART2', target: 'business-model' },
    { source: 'ART3', target: 'competitive-analysis' },
    { source: 'ART4', target: 'competitive-analysis' },
  ];

  const dir = makeRoom(nodes, edges);
  const db = openRoomDb(dir, { allowExtension: true });
  try {
    // -- 1. Document the SOURCE contract (the 215 pattern): the fixture row's
    //    type column IS the literal 'Section' - the exact ICM shape the bug
    //    fed on. If the schema ever stops speaking this way, this test must
    //    change with it.
    const anchorRow = db.prepare("SELECT id, type FROM nodes WHERE id = 'business-model'").get();
    ok(!!anchorRow, 'fixture: business-model anchor row exists in room.db');
    ok(anchorRow && anchorRow.type === 'Section',
      "source contract: the anchor's type column is the literal 'Section' (got " + JSON.stringify(anchorRow && anchorRow.type) + ')');

    // -- 2. The ADAPTER: every techMap section is a real domain label or the
    //    honest 'unknown', per entry.
    const sub = buildRoomNativeSubstrate(db, {});
    const tm = sub.techMap;
    const bm = tm.get('business-model');
    ok(bm && bm.section === 'business-model',
      "adapter: vintage Section anchor derives section 'business-model' from its bare-slug source_path, NOT 'Section' (got " + JSON.stringify(bm && bm.section) + ')');
    const art1 = tm.get('ART1');
    ok(art1 && art1.section === 'business-model',
      "adapter: Artifact entry's section equals its props.section slug (got " + JSON.stringify(art1 && art1.section) + ')');
    const mem = tm.get('MEM1');
    ok(mem && mem.section === 'unknown',
      "adapter: memory_event ('system:default') derives the honest 'unknown' default, the scorer's own techFor/loadGraph precedent (got " + JSON.stringify(mem && mem.section) + ')');

    // -- 3. The ICM type-leak sweep: no entry's section may equal its own type
    //    column value, nor any ICM type literal at all.
    const typeById = new Map();
    for (let i = 0; i < nodes.length; i += 1) typeById.set(nodes[i].id, nodes[i].type);
    const ICM_TYPES = ['Section', 'Artifact', 'memory_event'];
    let noSelfTypeLeak = true;
    let noAnyTypeLeak = true;
    tm.forEach(function (t, id) {
      if (t.section === typeById.get(id)) noSelfTypeLeak = false;
      if (ICM_TYPES.indexOf(t.section) !== -1) noAnyTypeLeak = false;
    });
    ok(noSelfTypeLeak, "leak sweep: no techMap entry's section equals its own node's type column value");
    ok(noAnyTypeLeak, "leak sweep: no techMap entry's section is any ICM type literal ('Section'/'Artifact'/'memory_event')");

    // -- 4. Drive the REAL fallback + REAL emitter (the user-facing prose leg).
    //    Both Section-anchor techs have problems [] and primary_problem '', so
    //    deriveSharedProblems' bridge fallback fires - the exact code path
    //    that leaked 'a Section x Section cross-domain bridge' into prose.
    const ca = tm.get('competitive-analysis');
    const shared = deriveSharedProblems(bm, ca);
    ok(Array.isArray(shared) && shared[0] === 'a business-model x competitive-analysis cross-domain bridge',
      'fallback: deriveSharedProblems names the real slugs (got ' + JSON.stringify(shared && shared[0]) + ')');
    ok(shared[0].indexOf('Section x Section') === -1,
      "fallback: the bridge label never contains 'Section x Section'");

    // The runner's own candidate assembly (eureka-portfolio-report.cjs
    // statements loop), mirrored field for field.
    const candidate = {
      a: {
        title: bm.title || bm.id,
        primary_problem: bm.primary_problem || ('unclassified problem for ' + bm.id),
        section: bm.section || 'unknown',
        weak_dimensions: [],
      },
      b: {
        title: ca.title || ca.id,
        primary_problem: ca.primary_problem || ('unclassified problem for ' + ca.id),
        section: ca.section || 'unknown',
        weak_dimensions: [],
      },
      shared_problems: shared,
      score: 0.5,
      rank: 1,
      tail: false,
    };
    const st = oppmod.buildOpportunityStatement(candidate);
    // The critic gate resolves pending offline; banked stays false; the text
    // still assembles (the 215-03 contract). The text is the user-facing
    // surface under guard.
    ok(st && typeof st.text === 'string' && st.text.indexOf('Section x Section') === -1,
      "emitter: statement text contains ZERO 'Section x Section'");
    ok(st && st.text.indexOf('business-model x competitive-analysis') !== -1,
      "emitter: statement text names the real slugs 'business-model x competitive-analysis' (text: " + JSON.stringify(st && st.text ? st.text.slice(0, 120) : st) + ')');
  } finally {
    closeRoomDb(db);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  if (FAIL > 0) {
    process.stderr.write('test-216-field-contract: ' + FAIL + ' FAILED, ' + PASS + ' passed\n');
    process.exit(1);
  }
  process.stdout.write('test-216-field-contract: ' + PASS + ' assertions passed - the room-native section field carries real domain labels (or the honest unknown) all the way into statement prose, never the ICM type column.\n');
}

main();
