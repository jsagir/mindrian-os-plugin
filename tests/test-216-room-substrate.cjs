#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 216-01 -- hermetic offline unit test for the room-native substrate
 * adapter (lib/core/eureka/room-native-substrate.cjs). Proves the D-01 navigator
 * directive contract: a normal room.db (nodes + typed edges, NO CSV-derived
 * idea-graph.json) yields the exact loadGraph return shape, with attention =
 * node degree and growth = created_at recency, and degrades gracefully below the
 * shipped MIN_COHORT=30 floor instead of crashing.
 *
 * Zero network (Canon Part 8). Requires ONLY the adapter, lib/core/room-db.cjs,
 * and (for the composed degradation legs) the SHIPPED tail-quadrant +
 * portfolio-dimensions classifiers read-only. No runner import, no encoder.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { buildRoomNativeSubstrate } = require(path.join(REPO_ROOT, 'lib/core/eureka/room-native-substrate.cjs'));
const pdims = require(path.join(REPO_ROOT, 'lib/core/eureka/portfolio-dimensions.cjs'));
const tailmod = require(path.join(REPO_ROOT, 'lib/core/eureka/tail-quadrant.cjs'));

let PASS = 0;
let FAIL = 0;
function ok(cond, msg) {
  if (cond) { PASS += 1; } else { FAIL += 1; process.stderr.write('  FAIL: ' + msg + '\n'); }
}

// The nine-field tech contract loadGraph()/techFor() guarantee. Every techMap
// entry the adapter emits must carry EXACTLY these keys.
const TECH_FIELDS = ['id', 'cnumber', 'title', 'primary_tier', 'pair_count', 'degree', 'section', 'primary_problem', 'problems'];

// Build a fixture room on disk. nodeSpecs: [{ id, type?, props?, rawPropsString?,
// created_at }]. edgeSpecs: [{ source, target, type?, props? }]. When
// rawPropsString is a string it is written to the properties column VERBATIM
// (used to exercise the malformed-JSON path), else props is JSON.stringify'd.
function makeRoom(nodeSpecs, edgeSpecs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-216-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (let i = 0; i < nodeSpecs.length; i += 1) {
    const n = nodeSpecs[i];
    const propStr = (typeof n.rawPropsString === 'string') ? n.rawPropsString : JSON.stringify(n.props || {});
    ins.run(n.id, n.type || 'Claim', propStr, n.source_path || ('fixture://' + n.id), 'import', n.created_at, n.created_at);
  }
  if (edgeSpecs && edgeSpecs.length) {
    const eins = db.prepare('INSERT INTO edges(source,target,type,properties) VALUES (?,?,?,?)');
    for (let i = 0; i < edgeSpecs.length; i += 1) {
      const e = edgeSpecs[i];
      eins.run(e.source, e.target, e.type || 'CONVERGES', JSON.stringify(e.props || {}));
    }
  }
  closeRoomDb(db);
  return dir;
}

// Open the fixture, build the substrate, hand both to fn, always clean up.
function withSubstrate(nodeSpecs, edgeSpecs, opts, fn) {
  const dir = makeRoom(nodeSpecs, edgeSpecs);
  const db = openRoomDb(dir, { allowExtension: true });
  try {
    fn(buildRoomNativeSubstrate(db, opts), db);
  } finally {
    closeRoomDb(db);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// The runner's cnumberNumeric idiom, inlined so the test never imports the runner:
// strip an optional leading C, parseInt.
function parseCnum(cnumber) {
  const n = parseInt(String(cnumber == null ? '' : cnumber).replace(/^[Cc]/, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function findPair(pairs, x, y) {
  for (let i = 0; i < pairs.length; i += 1) {
    const p = pairs[i];
    if ((p.a === x && p.b === y) || (p.a === y && p.b === x)) return p;
  }
  return null;
}

function day(n) {
  return '2026-07-0' + n + 'T00:00:00.000Z';
}

function run() {
  // ------------------------------------------------------------------
  // Behavior 1: 6 nodes (2 domains), 4 typed edges -> techMap.size 6, all
  // nine fields present, pair_count === degree === edge-appearance count.
  // ------------------------------------------------------------------
  withSubstrate(
    [
      { id: 'N1', props: { title: 'node one', section: 'physics', parentId: 'DOM_A' }, created_at: day(1) },
      { id: 'N2', props: { title: 'node two', section: 'physics', parentId: 'DOM_A' }, created_at: day(2) },
      { id: 'N3', props: { title: 'node three', section: 'physics', parentId: 'DOM_A' }, created_at: day(3) },
      { id: 'N4', props: { title: 'node four', section: 'biology', parentId: 'DOM_B' }, created_at: day(4) },
      { id: 'N5', props: { title: 'node five', section: 'biology', parentId: 'DOM_B' }, created_at: day(5) },
      { id: 'N6', props: { title: 'node six', section: 'biology', parentId: 'DOM_B' }, created_at: day(6) },
    ],
    [
      { source: 'N1', target: 'N2' },
      { source: 'N2', target: 'N3' },
      { source: 'N3', target: 'N4' },
      { source: 'N1', target: 'N4' },
    ],
    {},
    function (sub) {
      ok(sub.techMap.size === 6, 'behavior 1: techMap.size === 6 (got ' + sub.techMap.size + ')');
      let allFields = true;
      let pcEqDeg = true;
      sub.techMap.forEach(function (t) {
        for (let i = 0; i < TECH_FIELDS.length; i += 1) {
          if (!(TECH_FIELDS[i] in t)) allFields = false;
        }
        if (t.pair_count !== t.degree) pcEqDeg = false;
      });
      ok(allFields, 'behavior 1: every tech carries all nine contract fields');
      ok(pcEqDeg, 'behavior 1: pair_count === degree for every tech');
      // N1 appears in edges (N1,N2) and (N1,N4) -> degree 2.
      ok(sub.techMap.get('N1').pair_count === 2, 'behavior 1: N1 pair_count === 2 (got ' + sub.techMap.get('N1').pair_count + ')');
      ok(sub.techMap.get('N1').degree === 2, 'behavior 1: N1 degree === 2');
      // N5 is in no edge -> degree 0.
      ok(sub.techMap.get('N5').pair_count === 0, 'behavior 1: isolated N5 pair_count === 0');
      ok(sub.techMap.get('N1').primary_tier === undefined, 'behavior 1: primary_tier is undefined (no room tier taxonomy)');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 2: cnumber is a numeric string carrying created_at recency;
  // a newer node parses strictly greater than an older node.
  // ------------------------------------------------------------------
  withSubstrate(
    [
      { id: 'OLD', props: { title: 'old' }, created_at: day(1) },
      { id: 'NEW', props: { title: 'new' }, created_at: day(6) },
    ],
    [],
    {},
    function (sub) {
      const c = sub.techMap.get('NEW').cnumber;
      ok(typeof c === 'string' && /^[0-9]+$/.test(c), 'behavior 2: cnumber is a numeric string (got ' + c + ')');
      const older = parseCnum(sub.techMap.get('OLD').cnumber);
      const newer = parseCnum(sub.techMap.get('NEW').cnumber);
      ok(newer > older, 'behavior 2: newer cnumber (' + newer + ') > older (' + older + ') - recency ordering preserved');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 3: (A,B) and (B,A) dedupe to ONE pair; a self-edge (A,A) drops.
  // ------------------------------------------------------------------
  withSubstrate(
    [
      { id: 'A', props: { title: 'a' }, created_at: day(1) },
      { id: 'B', props: { title: 'b' }, created_at: day(2) },
    ],
    [
      { source: 'A', target: 'B' },
      { source: 'B', target: 'A' },
      { source: 'A', target: 'A' },
    ],
    {},
    function (sub) {
      ok(sub.convergesPairs.length === 1, 'behavior 3: (A,B)+(B,A) dedupe and (A,A) drops -> 1 pair (got ' + sub.convergesPairs.length + ')');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 4: edge shared_problems surface; a property-less edge -> [].
  // ------------------------------------------------------------------
  withSubstrate(
    [
      { id: 'A', props: { title: 'a' }, created_at: day(1) },
      { id: 'B', props: { title: 'b' }, created_at: day(2) },
      { id: 'C', props: { title: 'c' }, created_at: day(3) },
      { id: 'D', props: { title: 'd' }, created_at: day(4) },
    ],
    [
      { source: 'A', target: 'B', props: { shared_problems: ['x'] } },
      { source: 'C', target: 'D' },
    ],
    {},
    function (sub) {
      const ab = findPair(sub.convergesPairs, 'A', 'B');
      const cd = findPair(sub.convergesPairs, 'C', 'D');
      ok(ab && ab.shared_problems.length === 1 && ab.shared_problems[0] === 'x', 'behavior 4: edge shared_problems ["x"] surfaces on the pair');
      ok(cd && Array.isArray(cd.shared_problems) && cd.shared_problems.length === 0, 'behavior 4: property-less edge -> shared_problems []');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 5: opts.canonicalId is honored on BOTH the techMap keys and
  // both edge endpoints.
  // ------------------------------------------------------------------
  withSubstrate(
    [
      { id: 'N1', props: { title: 'one' }, created_at: day(1) },
      { id: 'N2', props: { title: 'two' }, created_at: day(2) },
    ],
    [{ source: 'N1', target: 'N2' }],
    { canonicalId: function (row) { return 'K' + row.id; } },
    function (sub) {
      ok(sub.techMap.has('KN1') && sub.techMap.has('KN2'), 'behavior 5: techMap keyed by K-prefixed canonical ids');
      const p = sub.convergesPairs[0];
      const endpoints = [p.a, p.b].sort().join(',');
      ok(endpoints === 'KN1,KN2', 'behavior 5: both edge endpoints translated to canonical space (got ' + endpoints + ')');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 6: meta contract.
  // ------------------------------------------------------------------
  withSubstrate(
    [
      { id: 'N1', props: { title: 'one' }, created_at: day(1) },
      { id: 'N2', props: { title: 'two' }, created_at: day(2) },
      { id: 'N3', props: { title: 'three' }, created_at: day(3) },
    ],
    [{ source: 'N1', target: 'N2' }, { source: 'N2', target: 'N3' }],
    {},
    function (sub) {
      ok(sub.meta.source === 'room-native', 'behavior 6: meta.source === "room-native"');
      ok(sub.meta.nodes_read === 3, 'behavior 6: meta.nodes_read === 3 (got ' + sub.meta.nodes_read + ')');
      ok(sub.meta.edges_read === 2, 'behavior 6: meta.edges_read === 2 (got ' + sub.meta.edges_read + ')');
      ok(typeof sub.meta.honest_nouns === 'string'
        && sub.meta.honest_nouns.indexOf('3') !== -1
        && sub.meta.honest_nouns.indexOf('2') !== -1,
        'behavior 6: honest_nouns is a non-empty string naming both counts');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 7: an EMPTY room (zero nodes, zero edges) - no throw.
  // ------------------------------------------------------------------
  withSubstrate([], [], {}, function (sub) {
    ok(sub.techMap.size === 0, 'behavior 7: empty room -> techMap.size 0');
    ok(Array.isArray(sub.convergesPairs) && sub.convergesPairs.length === 0, 'behavior 7: empty room -> convergesPairs []');
    ok(sub.meta.nodes_read === 0 && sub.meta.edges_read === 0, 'behavior 7: empty room -> meta counts 0/0');
  });

  // ------------------------------------------------------------------
  // Behavior 8: nodes but ZERO edges - every tech pair_count/degree 0.
  // ------------------------------------------------------------------
  withSubstrate(
    [
      { id: 'N1', props: { title: 'one' }, created_at: day(1) },
      { id: 'N2', props: { title: 'two' }, created_at: day(2) },
      { id: 'N3', props: { title: 'three' }, created_at: day(3) },
    ],
    [],
    {},
    function (sub) {
      let allZero = true;
      sub.techMap.forEach(function (t) {
        if (t.pair_count !== 0 || t.degree !== 0) allZero = false;
      });
      ok(allZero, 'behavior 8: edge-less room -> every tech pair_count 0 and degree 0');
      ok(sub.convergesPairs.length === 0, 'behavior 8: edge-less room -> convergesPairs []');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 9: malformed properties ('not-json') still yields a tech entry
  // with title -> id, section -> 'unknown' (never row.type), problems [].
  // The fixture default source_path 'fixture://BADPROPS' contains ':' so the
  // source_path branch falls through and the honest fallback fires.
  // ------------------------------------------------------------------
  withSubstrate(
    [{ id: 'BADPROPS', type: 'Widget', rawPropsString: 'not-json', created_at: day(1) }],
    [],
    {},
    function (sub) {
      const t = sub.techMap.get('BADPROPS');
      ok(!!t, 'behavior 9: malformed-properties node still yields a tech entry');
      ok(t.title === 'BADPROPS', 'behavior 9: title falls back to the id');
      ok(t.section === 'unknown', 'behavior 9: section falls back to the honest unknown, never the ICM type column (got ' + JSON.stringify(t.section) + ')');
      ok(Array.isArray(t.problems) && t.problems.length === 0, 'behavior 9: problems []');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 10: a 10-tech substrate (below MIN_COHORT 30) fed through the
  // SHIPPED axis math + classifyTail returns insufficient_structure true,
  // tail [], NO exception. This pins the D-01 graceful-degradation contract.
  // ------------------------------------------------------------------
  (function () {
    const nodes = [];
    for (let i = 1; i <= 10; i += 1) {
      nodes.push({ id: 'N' + i, props: { title: 'n' + i }, created_at: day((i % 6) + 1) });
    }
    // A couple of edges so the attention axis is not a pure all-zero tie.
    const edges = [{ source: 'N1', target: 'N2' }, { source: 'N2', target: 'N3' }];
    withSubstrate(nodes, edges, {}, function (sub) {
      const cohort = Array.from(sub.techMap.values());
      const pairCounts = cohort.map(function (t) { return t.pair_count; }).sort(function (a, b) { return a - b; });
      const cnums = cohort.map(function (t) { return parseCnum(t.cnumber); }).sort(function (a, b) { return a - b; });
      const items = cohort.map(function (t) {
        return {
          id: t.id,
          attention: pdims.percentileRank(t.pair_count, pairCounts),
          growth: pdims.percentileRank(parseCnum(t.cnumber), cnums),
        };
      });
      let result = null;
      let threw = false;
      try {
        result = tailmod.classifyTail(items);
      } catch (_e) {
        threw = true;
      }
      ok(!threw, 'behavior 10: classifyTail on a sub-cohort substrate does not throw');
      ok(result && result.insufficient_structure === true, 'behavior 10: sub-MIN_COHORT -> insufficient_structure true');
      ok(result && Array.isArray(result.tail) && result.tail.length === 0, 'behavior 10: insufficient_structure -> tail []');
    });
  }());

  // ------------------------------------------------------------------
  // Behavior 11: identical created_at across all 36 nodes (a bulk import)
  // -> a uniform growth tie; classifyTail on the 36-tech cohort still
  // returns without throwing (axes stay in [0,1], satisfying assertAxis).
  // ------------------------------------------------------------------
  (function () {
    const stamp = '2026-07-01T00:00:00.000Z';
    const nodes = [];
    for (let i = 1; i <= 36; i += 1) {
      nodes.push({ id: 'M' + i, props: { title: 'm' + i }, created_at: stamp });
    }
    withSubstrate(nodes, [], {}, function (sub) {
      ok(sub.techMap.size === 36, 'behavior 11: all-tie bulk import -> 36 techs');
      const cohort = Array.from(sub.techMap.values());
      const pairCounts = cohort.map(function (t) { return t.pair_count; }).sort(function (a, b) { return a - b; });
      const cnums = cohort.map(function (t) { return parseCnum(t.cnumber); }).sort(function (a, b) { return a - b; });
      const items = cohort.map(function (t) {
        return {
          id: t.id,
          attention: pdims.percentileRank(t.pair_count, pairCounts),
          growth: pdims.percentileRank(parseCnum(t.cnumber), cnums),
        };
      });
      let threw = false;
      let result = null;
      try {
        result = tailmod.classifyTail(items);
      } catch (_e) {
        threw = true;
      }
      ok(!threw, 'behavior 11: all-tie 36-tech cohort classifies without throwing (axes in [0,1])');
      ok(result && result.insufficient_structure === false, 'behavior 11: 36 >= MIN_COHORT -> not insufficient_structure');
    });
  }());

  // ------------------------------------------------------------------
  // Behavior 12 (216-05 field contract): with no props.section, section is
  // derived from the source_path first path segment - both the first-segment
  // form (an Artifact-shaped row under a section folder) and the bare-slug
  // form (a pre-Phase-162-vintage Section anchor whose source_path IS the
  // slug). The section NEVER falls back to the ICM type column.
  // ------------------------------------------------------------------
  withSubstrate(
    [
      { id: 'ART', type: 'Artifact', props: {}, source_path: 'legal-ip/notes.md', created_at: day(1) },
      { id: 'business-model', type: 'Section', props: { name: 'business-model', label: 'BUSINESS MODEL' }, source_path: 'business-model', created_at: day(2) },
    ],
    [],
    {},
    function (sub) {
      const art = sub.techMap.get('ART');
      ok(art && art.section === 'legal-ip', 'behavior 12: source_path first segment derives the section (got ' + JSON.stringify(art && art.section) + ')');
      const anchor = sub.techMap.get('business-model');
      ok(anchor && anchor.section === 'business-model', 'behavior 12: vintage Section anchor bare-slug source_path derives the section (got ' + JSON.stringify(anchor && anchor.section) + ')');
      ok(anchor && anchor.section !== 'Section', 'behavior 12: vintage Section anchor section is never the ICM type literal Section');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 13 (Phase 219 upstream-metadata fix, the sibling of the
  // props.name title fix): an ENTITY node (company/technology/market) carries
  // no section/problem content of its own, so before this fix its section
  // collapsed to the literal 'unknown' and every entity-entity opportunity
  // statement read "unknown x unknown". The fix reuses the ALREADY-SHIPPED
  // DESCRIBES edge (entity=source, memory_artifact=target carrying
  // props.section):
  //   (1) an entity with a DESCRIBES source artifact INHERITS that artifact's
  //       real section (+ any present primary_problem/problems).
  //   (2) an entity with no usable DESCRIBES source falls back to its entityType
  //       (company/technology/market), NEVER 'unknown'.
  //   (3) the forming edge's type rides through on convergesPairs so a
  //       downstream bridge label can name the real relation.
  // ------------------------------------------------------------------
  withSubstrate(
    [
      // (1) entity WITH a DESCRIBES source artifact carrying a real section.
      { id: 'E1', type: 'company', props: { name: 'Acme', entityType: 'company', evidenceTier: 'None' }, source_path: 'entity:sess:Acme', created_at: day(1) },
      { id: 'ART1', type: 'memory_artifact', props: { section: 'business-model', primary_problem: 'go-to-market fit', problems: ['pricing', 'channel'] }, source_path: 'memory:business-model/entry:USER', created_at: day(2) },
      // (2) entity with NO DESCRIBES source -> entityType fallback.
      { id: 'E2', type: 'technology', props: { name: 'Widget', entityType: 'technology', evidenceTier: 'None' }, source_path: 'entity:sess:Widget', created_at: day(3) },
      // (2b) entity whose DESCRIBES artifact has NO real section -> entityType fallback (never inherit 'unknown').
      { id: 'E3', type: 'market', props: { name: 'BioMarket', entityType: 'market' }, source_path: 'entity:sess:BioMarket', created_at: day(4) },
      { id: 'ART2', type: 'memory_artifact', props: {}, source_path: 'memory:no-section-entry:USER', created_at: day(5) },
    ],
    [
      { source: 'E1', target: 'ART1', type: 'DESCRIBES' },
      { source: 'E1', target: 'E2', type: 'COMPETES_WITH' },
      { source: 'E3', target: 'ART2', type: 'DESCRIBES' },
    ],
    {},
    function (sub) {
      const e1 = sub.techMap.get('E1');
      ok(e1 && e1.section === 'business-model', 'behavior 13: entity inherits section from its DESCRIBES source artifact (got ' + JSON.stringify(e1 && e1.section) + ')');
      ok(e1 && e1.section !== 'unknown', 'behavior 13: inherited entity section is never the literal unknown');
      ok(e1 && e1.primary_problem === 'go-to-market fit', 'behavior 13: entity inherits a present primary_problem from the artifact (got ' + JSON.stringify(e1 && e1.primary_problem) + ')');
      ok(e1 && Array.isArray(e1.problems) && e1.problems.length === 2 && e1.problems[0] === 'pricing', 'behavior 13: entity inherits present problems from the artifact');

      const e2 = sub.techMap.get('E2');
      ok(e2 && e2.section === 'technology', 'behavior 13: entity with no DESCRIBES source falls back to entityType, not unknown (got ' + JSON.stringify(e2 && e2.section) + ')');

      const e3 = sub.techMap.get('E3');
      ok(e3 && e3.section === 'market', 'behavior 13: entity whose DESCRIBES artifact has an unknown section falls back to entityType (got ' + JSON.stringify(e3 && e3.section) + ')');

      // (3) the COMPETES_WITH edge's type rides through on the entity-entity pair.
      const pair = findPair(sub.convergesPairs, 'E1', 'E2');
      ok(pair && pair.edge_type === 'COMPETES_WITH', 'behavior 13: entity-entity pair carries the forming relation edge type (got ' + JSON.stringify(pair && pair.edge_type) + ')');
    }
  );

  // ------------------------------------------------------------------
  // Behavior 14: entityTypeOf reads props.entityType ONLY (never row.type), so
  // a non-entity node classifies as null and never triggers the fixup.
  // ------------------------------------------------------------------
  (function () {
    const et = require(path.join(REPO_ROOT, 'lib/core/eureka/room-native-substrate.cjs'))._test.entityTypeOf;
    ok(et({ entityType: 'company' }) === 'company', 'behavior 14: entityTypeOf returns the label for a valid entity node');
    ok(et({ entityType: 'not-a-type' }) === null, 'behavior 14: entityTypeOf rejects an unknown entityType');
    ok(et({ name: 'x' }) === null, 'behavior 14: entityTypeOf returns null for a node with no entityType');
    ok(et({}) === null, 'behavior 14: entityTypeOf returns null for empty props');
  }());

  if (FAIL > 0) {
    process.stderr.write('test-216-room-substrate: ' + FAIL + ' FAILED, ' + PASS + ' passed\n');
    process.exit(1);
  }
  process.stdout.write('test-216-room-substrate: ' + PASS + ' assertions passed\n');
}

run();
