#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-05 -- the FIELD-CONTRACT test between the two modules that must agree
 * on the idea-graph node shape.
 *
 * WHY THIS TEST EXISTS (the bug it would have caught):
 *   scripts/csv-to-idea-graph.cjs (the emitter, which also feeds the De Stijl
 *   dashboard HTML viewer) writes content-node fields named `edge_count`,
 *   `primary_label`, `labels`, with `section` carrying the lens ROLE
 *   (source/target/mixed). scripts/eureka-portfolio-report.cjs (the scorer) reads
 *   a DIFFERENT internal contract -- `pair_count`, `primary_problem`, `problems`
 *   -- consumed by lib/core/eureka/portfolio-dimensions.cjs and
 *   lib/core/eureka/opportunity-statement.cjs. loadGraph() is the adapter between
 *   the two shapes. It silently failed to map them, so EVERY tech got
 *   pair_count=undefined -> validated_demand pinned at the degenerate 0.5
 *   percentile for the whole cohort -> the composite saturated and dozens of
 *   pairs tied at one ceiling, burying real signal (the 215-05 full-catalog
 *   reproduction failure). And every statement read "unclassified problem".
 *
 * This test drives the REAL emitter over a tiny fixture CSV, then loads the
 * result through the REAL scorer's loadGraph, and asserts the internal contract
 * is populated AND DISCRIMINATING. It is hermetic (temp dir), offline, node
 * built-ins + the two shipped scripts only. No em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const EMITTER = path.join(REPO_ROOT, 'scripts', 'csv-to-idea-graph.cjs');
const scorer = require(path.join(REPO_ROOT, 'scripts', 'eureka-portfolio-report.cjs'));

let PASS = 0;
let FAIL = 0;
function ok(cond, msg) {
  if (cond) { PASS += 1; } else { FAIL += 1; process.stderr.write('  FAIL: ' + msg + '\n'); }
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-215-fc-'));
  const pairsCsv = path.join(tmp, 'pairs.csv');
  const nodesCsv = path.join(tmp, 'nodes.csv');
  const outHtml = path.join(tmp, 'graph.html');
  const outJson = path.join(tmp, 'graph.json');

  // C16742 appears in THREE rows (edge_count 3); C05004 in two; C16796/C03552 in
  // one each. This spread is what a working pair_count adapter must preserve so
  // the demand axis discriminates (the exact signal the bug flattened).
  fs.writeFileSync(pairsCsv,
    'source,target,topic\n'
    + 'C16796,C03552,arrhythmias\n'
    + 'C16742,C05004,cerebral aneurysm\n'
    + 'C16742,C09999,cerebral aneurysm\n'
    + 'C16742,C08888,imaging\n', 'utf8');
  fs.writeFileSync(nodesCsv,
    'id,title,description\n'
    + 'C16796,Shim Coil,static magnetic field shim for cardiac MRI\n'
    + 'C03552,Cardiac Sock,electrode array defibrillator\n'
    + 'C16742,Brain Atlas,3D arterial territories atlas\n'
    + 'C05004,EmboGel,injectable embolization material\n'
    + 'C09999,Catheter Guide,navigation aid\n'
    + 'C08888,Imaging Rig,scanner\n', 'utf8');

  // Drive the REAL emitter (the same code path that feeds the dashboard viewer).
  execFileSync(process.execPath, [
    EMITTER,
    '--pairs', pairsCsv,
    '--source-col', 'source', '--target-col', 'target', '--edge-label-col', 'topic',
    '--nodes', nodesCsv, '--node-id-col', 'id', '--node-title-col', 'title', '--node-desc-col', 'description',
    '--out', outHtml, '--json-out', outJson,
  ], { stdio: 'ignore' });

  const g = JSON.parse(fs.readFileSync(outJson, 'utf8'));
  const content = g.elements.nodes.filter(function (n) { return n.data.layer === 'content'; });

  // -- Document the EMITTER contract: it speaks edge_count / primary_label / labels,
  //    and section is the lens ROLE, not a clinical domain. If this ever changes,
  //    the adapter below must change with it -- that is the whole point.
  const c16742 = content.find(function (n) { return n.data.id === 'C16742'; });
  ok(!!c16742, 'emitter produced content node C16742');
  ok(typeof c16742.data.edge_count === 'number', 'emitter emits `edge_count` (not `pair_count`)');
  ok(typeof c16742.data.primary_label === 'string' && c16742.data.primary_label.length > 0,
    'emitter emits `primary_label` (not `primary_problem`)');
  ok(Array.isArray(c16742.data.labels) && c16742.data.labels.length > 0,
    'emitter emits `labels` array (not `problems`)');
  ok(c16742.data.section === 'source' || c16742.data.section === 'target' || c16742.data.section === 'mixed',
    'emitter `section` carries the lens ROLE, not a domain (got ' + JSON.stringify(c16742.data.section) + ')');

  // -- The ADAPTER: loadGraph must translate the emitter shape into the scorer's
  //    internal contract that portfolio-dimensions + opportunity-statement consume.
  const loaded = scorer.loadGraph(outJson);
  const tm = loaded.techMap;

  const t742 = tm.get('C16742');
  const t796 = tm.get('C16796');
  const t004 = tm.get('C05004');
  ok(t742 && t796 && t004, 'loadGraph mapped all fixture techs into techMap');

  // 1. pair_count populated AND finite (was undefined -> the degenerate bug).
  ok(typeof t742.pair_count === 'number' && Number.isFinite(t742.pair_count) && t742.pair_count > 0,
    'loadGraph populates `pair_count` as a finite positive number (got ' + JSON.stringify(t742.pair_count) + ')');

  // 2. pair_count DISCRIMINATES: C16742 (3 edges) must outrank C16796 (1 edge).
  //    A flat/undefined field would make these equal -> the tie that buried the gems.
  ok(t742.pair_count > t796.pair_count,
    'loadGraph `pair_count` discriminates by connectivity: C16742(' + t742.pair_count
      + ') > C16796(' + t796.pair_count + ')');

  // 3. Not every tech shares one pair_count value (the anti-degeneracy assertion).
  const distinct = new Set(Array.from(tm.values()).map(function (t) { return t.pair_count; }));
  ok(distinct.size > 1, 'loadGraph `pair_count` is not a single flat value across the cohort (distinct='
    + distinct.size + ')');

  // 4. primary_problem non-empty (was '' -> "unclassified problem" in every statement).
  ok(typeof t796.primary_problem === 'string' && t796.primary_problem.trim().length > 0,
    'loadGraph populates `primary_problem` from primary_label (got ' + JSON.stringify(t796.primary_problem) + ')');

  // 5. problems non-empty array (was [] -> deriveSharedProblems fell back to a role bridge).
  ok(Array.isArray(t796.problems) && t796.problems.length > 0,
    'loadGraph populates `problems` from labels (got ' + JSON.stringify(t796.problems) + ')');

  // 6. cnumber derived from the C-number id (was '' for graph techs -> the tail
  //    growth axis silently zeroed for exactly the cited techs that matter).
  ok(t796.cnumber === 'C16796',
    'loadGraph derives `cnumber` from a C-number id when the graph omits it (got ' + JSON.stringify(t796.cnumber) + ')');

  // Cleanup best-effort.
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }

  process.stdout.write('\n');
  if (FAIL > 0) {
    process.stderr.write('test-215-field-contract: ' + FAIL + ' FAILED, ' + PASS + ' passed\n');
    process.exit(1);
  }
  process.stdout.write('test-215-field-contract: ' + PASS + ' assertions passed - the emitter shape and the scorer contract are reconciled by loadGraph.\n');
}

main();
