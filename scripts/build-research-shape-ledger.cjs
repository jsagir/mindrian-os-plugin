#!/usr/bin/env node
'use strict';
/*
 * scripts/build-research-shape-ledger.cjs -- Phase 363 Plan 10 (DRP363-12,
 * DRP363-20; D-09, D-17, D-18, D-19).
 *
 * Builds data/research-shape-ledger.json, the shipped structure data the
 * research planner reads locally: which frameworks fit which problem type
 * and in what order (FEEDS_INTO), the Scientific Roadmapping and Logic Trees
 * steps, and the diffusion frameworks. The runtime reads ONLY the shipped
 * ledger; it never calls framework_step or brain_query.
 *
 *   node scripts/build-research-shape-ledger.cjs [--from-snapshot <path>] [--out <path>]
 *        build from the dev-time snapshot and write the ledger
 *   node scripts/build-research-shape-ledger.cjs --check [--ledger <path>] [--from-snapshot <path>]
 *        rebuild in memory, exit 1 with a recovery line on any byte drift
 *   node scripts/build-research-shape-ledger.cjs --live [--write]
 *        re-read the graph through the guarded client (handles only), print
 *        a diff against the shipped ledger, write only with --write
 *
 * IP ruling (2026-09-17, applied to shipped data per D-18): names, edges and
 * short lines only. ProcessSteps ship name, order, key_question and gates,
 * each string capped at 140 characters (first sentence, cut on a word
 * boundary). Techniques ship as names only. No description field is ever
 * read or shipped.
 *
 * Canon Part 8: the only strings that cross to the graph are Cypher text
 * with framework names and problem-type ids bound as parameters. --check and
 * the default build make ZERO network calls and never load the Brain client.
 *
 * Hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'research-shape-ledger.json');
const SNAPSHOT_PATH = path.join(ROOT, 'tests', 'fixtures', '363-graph-snapshot.json');

const STRING_CAP = 140;
const LEDGER_SCHEMA = 'mos.research-shape-ledger/1';
const SNAPSHOT_SCHEMA = 'mos.graph-snapshot/1';
const IP_RULING = 'IP ruling 2026-09-17: names, edges, short lines only; no descriptions; strings capped at 140 characters.';

const PROBLEM_TYPES = Object.freeze(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']);
const FULL_CONTENT = Object.freeze(['Scientific Roadmapping', 'Logic Trees (Issue, Hypothesis, Decision)']);
const SCIENTIFIC_SET = Object.freeze([
  'Logic Trees (Issue, Hypothesis, Decision)',
  'Hypothesis-Driven Problem Solving',
  'Scientific Method',
  'Adversarial Research Protocol',
  'Research Validation and Early Business Framing',
  'Herbert Simon The Sciences of the Artificial',
  'Scientific Roadmapping',
]);
const DIFFUSION_SET = Object.freeze([
  'Adoption-Capacity Theory',
  'Dual-Use Technology',
  'Diffusion of Innovations (Rogers)',
  'Diffusion Theory',
  'Law of Diffusion of Innovation',
]);
const EXTRA_FRAMEWORKS = Object.freeze(['The Pyramid Principle']);

// Local (not graph) research shapes, from 363-RESEARCH-pws.md's mapping table.
const SHAPES = Object.freeze({
  UnDefined: { shape: 'landscape_scan', default_mode: 'deep' },
  IllDefined: { shape: 'independent_lens_fanout', default_mode: 'deep', quick_when: 'one_lens_named' },
  WellDefined: { shape: 'hypothesis_test', default_mode: 'quick' },
  Wicked: { shape: 'systems_map', default_mode: 'deep', unresolved_valid: true },
});

// ---------------------------------------------------------------------------
// IP caps
// ---------------------------------------------------------------------------
function capString(s) {
  let t = String(s).replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  if (m && m[1].length <= STRING_CAP) return m[1];
  if (m) t = m[1];
  if (t.length <= STRING_CAP) return t;
  const cut = t.slice(0, STRING_CAP);
  const sp = cut.lastIndexOf(' ');
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, '');
}

function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === 'object') {
    const r = {};
    Object.keys(o).sort().forEach(function (k) { r[k] = sortKeys(o[k]); });
    return r;
  }
  return o;
}

function assertIpCaps(node, where) {
  const w = where || '$';
  if (typeof node === 'string') {
    if (node.length > STRING_CAP) throw new Error('ip_cap_exceeded at ' + w);
    return;
  }
  if (Array.isArray(node)) { node.forEach(function (v, i) { assertIpCaps(v, w + '[' + i + ']'); }); return; }
  if (node && typeof node === 'object') {
    Object.keys(node).forEach(function (k) {
      if (k === 'description') throw new Error('description_key_forbidden at ' + w);
      assertIpCaps(node[k], w + '.' + k);
    });
  }
}

function strList(a) {
  return (Array.isArray(a) ? a : []).filter(function (x) { return typeof x === 'string' && x.length > 0; }).map(capString);
}

function stepList(a, keepQuestion) {
  const out = (Array.isArray(a) ? a : []).filter(function (s) { return s && typeof s === 'object' && typeof s.name === 'string'; })
    .map(function (s, i) {
      const e = { order: Number.isInteger(s.order) ? s.order : i + 1, name: capString(s.name) };
      if (keepQuestion) {
        e.key_question = typeof s.key_question === 'string' && s.key_question ? capString(s.key_question) : null;
        e.gates = Array.isArray(s.gates) ? strList(s.gates) : [];
      }
      return e;
    });
  out.sort(function (a, b) { return a.order - b.order; });
  return out;
}

// ---------------------------------------------------------------------------
// buildLedger(snapshot) -> ledger object (deterministic, pure)
// ---------------------------------------------------------------------------
function buildLedger(snapshot) {
  if (!snapshot || snapshot.schema !== SNAPSHOT_SCHEMA) throw new Error('snapshot_schema_mismatch');
  const Q = require('../lib/core/research-planner/question-templates.cjs');
  const templateFrameworks = {};
  Q.PLANNER_TEMPLATE_IDS.forEach(function (id) { templateFrameworks[id] = Q.TEMPLATES[id].framework; });

  const wanted = [];
  function want(n) { if (wanted.indexOf(n) === -1) wanted.push(n); }
  Object.keys(templateFrameworks).forEach(function (id) { want(templateFrameworks[id]); });
  SCIENTIFIC_SET.forEach(want);
  DIFFUSION_SET.forEach(want);
  EXTRA_FRAMEWORKS.forEach(want);
  FULL_CONTENT.forEach(want);
  wanted.sort();

  const snapPT = snapshot.problem_types || {};
  const problem_types = {};
  PROBLEM_TYPES.forEach(function (id) { problem_types[id] = { frameworks: strList(snapPT[id]) }; });

  const frameworks = {};
  const theoGaps = [];
  wanted.forEach(function (n) {
    const s = (snapshot.frameworks || {})[n];
    if (!s || s.found === false) {
      frameworks[n] = {
        problem_types: [], feeds_into: [], fed_by: [], prerequisite: [], complements: [], aliases: [],
        steps: [], techniques: [], theo_gap: 'name_not_found',
      };
      theoGaps.push({ framework: n, gap: 'name_not_found' });
      return;
    }
    const full = FULL_CONTENT.indexOf(n) !== -1;
    const e = {
      problem_types: PROBLEM_TYPES.filter(function (id) { return problem_types[id].frameworks.indexOf(n) !== -1; }),
      feeds_into: strList(s.feeds_into),
      fed_by: strList(s.fed_by),
      prerequisite: strList(s.prerequisite),
      complements: strList(s.complements),
      aliases: strList(s.aliases),
      steps: full ? stepList(s.steps, true) : [],
      techniques: full ? strList(s.techniques) : [],
      theo_gap: null,
    };
    if (full && Array.isArray(s.step_loop) && s.step_loop.length > 0) e.step_loop = s.step_loop.map(function (p) { return [p[0], p[1]]; });
    if (full && e.steps.length === 0) e.theo_gap = 'zero_steps';
    else if (!full && s.graph_step_count === 0) e.theo_gap = 'zero_steps';
    if (e.theo_gap) theoGaps.push({ framework: n, gap: e.theo_gap });
    frameworks[n] = e;
  });

  const ledger = {
    schema: LEDGER_SCHEMA,
    built_from: {
      source: String(snapshot.source),
      captured_at: String(snapshot.captured_at),
      snapshot_schema: SNAPSHOT_SCHEMA,
    },
    ip_ruling: IP_RULING,
    problem_types: problem_types,
    shapes: JSON.parse(JSON.stringify(SHAPES)),
    scientific_set: SCIENTIFIC_SET.slice(),
    diffusion_set: DIFFUSION_SET.slice(),
    template_frameworks: templateFrameworks,
    frameworks: frameworks,
    theo_gaps: theoGaps,
    content_gaps: strList(snapshot.content_gaps),
  };
  assertIpCaps(ledger);
  return sortKeys(ledger);
}

function serialize(ledger) { return JSON.stringify(ledger, null, 2) + '\n'; }

// ---------------------------------------------------------------------------
// liveSnapshot(brainClient) -> snapshot (anchored reads, bound params only)
// ---------------------------------------------------------------------------
const CYPHER = Object.freeze({
  exists: 'MATCH (f:Framework {name:$n}) RETURN f.name AS name',
  steps: 'MATCH (f:Framework {name:$n})-[:HAS_PROCESS_STEP]->(s) RETURN s.order AS ord, s.name AS name, s.key_question AS key_question, s.gates AS gates',
  techniques: 'MATCH (f:Framework {name:$n})-[:USES_TECHNIQUE]->(t:Technique) RETURN t.name AS name',
  feeds: 'MATCH (f:Framework {name:$n})-[:FEEDS_INTO]->(g:Framework) RETURN g.name AS name',
  fedBy: 'MATCH (g:Framework)-[:FEEDS_INTO]->(f:Framework {name:$n}) RETURN g.name AS name',
  prereq: 'MATCH (f:Framework {name:$n})-[:PREREQUISITE]->(g:Framework) RETURN g.name AS name',
  complements: 'MATCH (f:Framework {name:$n})-[:COMPLEMENTS]->(g:Framework) RETURN g.name AS name',
  aliases: 'MATCH (a:Framework)-[:ALIAS_OF]->(f:Framework {name:$n}) RETURN a.name AS name',
  problemType: 'MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(p:DomainConcept {id:$pt}) RETURN f.name AS name',
});

function rowsOf(res) {
  if (!res) return null;
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.records)) return res.records;
  return null;
}
function pick(rec, key) {
  if (rec && typeof rec === 'object' && !Array.isArray(rec)) return rec[key] !== undefined ? rec[key] : Object.values(rec)[0];
  return Array.isArray(rec) ? rec[0] : rec;
}

async function liveSnapshot(brainClient) {
  if (!brainClient || typeof brainClient.query !== 'function') throw new Error('brain_client_required');
  const Q = require('../lib/core/research-planner/question-templates.cjs');
  const names = [];
  Q.PLANNER_TEMPLATE_IDS.forEach(function (id) { if (names.indexOf(Q.TEMPLATES[id].framework) === -1) names.push(Q.TEMPLATES[id].framework); });
  SCIENTIFIC_SET.concat(DIFFUSION_SET, EXTRA_FRAMEWORKS, FULL_CONTENT).forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });
  names.sort();

  async function read(cypher, params) {
    const rows = rowsOf(await brainClient.query(cypher, params));
    if (rows === null) throw new Error('brain_unavailable');
    return rows;
  }
  async function col(cypher, params) {
    return (await read(cypher, params)).map(function (r) { return pick(r, 'name'); }).filter(function (x) { return typeof x === 'string'; });
  }

  const frameworks = {};
  for (let i = 0; i < names.length; i += 1) {
    const n = names[i];
    const found = (await col(CYPHER.exists, { n: n })).length > 0;
    if (!found) { frameworks[n] = { found: false }; continue; }
    const full = FULL_CONTENT.indexOf(n) !== -1;
    const e = {
      found: true,
      feeds_into: await col(CYPHER.feeds, { n: n }),
      fed_by: await col(CYPHER.fedBy, { n: n }),
      prerequisite: await col(CYPHER.prereq, { n: n }),
      complements: await col(CYPHER.complements, { n: n }),
      aliases: await col(CYPHER.aliases, { n: n }),
      steps: [],
      techniques: [],
      step_loop: [],
    };
    const stepRows = full ? await read(CYPHER.steps, { n: n }) : [];
    e.graph_step_count = full ? stepRows.length : 0;
    if (full) {
      e.steps = stepRows.map(function (r) {
        return { order: r.ord, name: r.name, key_question: r.key_question === undefined ? null : r.key_question, gates: r.gates === undefined ? null : r.gates };
      });
      e.techniques = await col(CYPHER.techniques, { n: n });
    }
    frameworks[n] = e;
  }
  const problem_types = {};
  for (let j = 0; j < PROBLEM_TYPES.length; j += 1) {
    problem_types[PROBLEM_TYPES[j]] = await col(CYPHER.problemType, { pt: PROBLEM_TYPES[j] });
  }
  return sortKeys({
    schema: SNAPSHOT_SCHEMA,
    captured_at: new Date().toISOString(),
    source: 'theo_guarded',
    frameworks: frameworks,
    problem_types: problem_types,
    content_gaps: ['live capture through the guarded client; fields the graph did not serve are null'],
  });
}

// ---------------------------------------------------------------------------
// Diff summary
// ---------------------------------------------------------------------------
function diffSummary(a, b) {
  const lines = [];
  const fa = (a && a.frameworks) || {};
  const fb = (b && b.frameworks) || {};
  Object.keys(fb).forEach(function (n) {
    if (!fa[n]) { lines.push('added framework: ' + n); return; }
    ['problem_types', 'feeds_into', 'fed_by', 'prerequisite', 'complements', 'aliases', 'steps', 'techniques'].forEach(function (k) {
      if (JSON.stringify(fa[n][k]) !== JSON.stringify(fb[n][k])) lines.push('changed ' + k + ': ' + n);
    });
  });
  Object.keys(fa).forEach(function (n) { if (!fb[n]) lines.push('removed framework: ' + n); });
  return lines;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function argVal(argv, flag) {
  const i = argv.indexOf(flag);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : null;
}
function readSnapshot(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

async function main(argv) {
  const snapPath = argVal(argv, '--from-snapshot') || SNAPSHOT_PATH;
  if (argv.includes('--check')) {
    const ledgerPath = argVal(argv, '--ledger') || LEDGER_PATH;
    let expected;
    try { expected = serialize(buildLedger(readSnapshot(snapPath))); } catch (e) {
      console.error('build-research-shape-ledger --check: cannot build: ' + e.message);
      return 1;
    }
    let actual = null;
    try { actual = fs.readFileSync(ledgerPath, 'utf8'); } catch (_e) { actual = null; }
    if (actual !== expected) {
      console.error('build-research-shape-ledger --check: DRIFT in ' + path.relative(ROOT, ledgerPath));
      console.error('Recovery: node scripts/build-research-shape-ledger.cjs   (rebuilds data/research-shape-ledger.json from the snapshot)');
      return 1;
    }
    console.log('build-research-shape-ledger --check: OK');
    return 0;
  }
  if (argv.includes('--live')) {
    // eslint-disable-next-line global-require
    const brainClient = require('../lib/core/brain-client.cjs');
    let snap;
    try { snap = await liveSnapshot(brainClient); } catch (e) {
      console.error('build-research-shape-ledger --live: ' + e.message + '; ledger unchanged');
      return 1;
    }
    const live = buildLedger(snap);
    let shipped = null;
    try { shipped = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')); } catch (_e) { shipped = null; }
    const diff = diffSummary(shipped, live);
    console.log(diff.length === 0 ? 'live read matches the shipped ledger (structure)' : diff.join('\n'));
    if (argv.includes('--write')) {
      fs.writeFileSync(LEDGER_PATH, serialize(live));
      console.log('wrote ' + path.relative(ROOT, LEDGER_PATH));
    } else {
      console.log('nothing written (pass --write to replace the shipped ledger)');
    }
    return 0;
  }
  const out = argVal(argv, '--out') || LEDGER_PATH;
  const ledger = buildLedger(readSnapshot(snapPath));
  fs.writeFileSync(out, serialize(ledger));
  console.log('wrote ' + path.relative(ROOT, out));
  return 0;
}

module.exports = { buildLedger, liveSnapshot, serialize, diffSummary, capString, assertIpCaps, CYPHER };

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code); }, function (e) {
    console.error(e && e.message ? e.message : String(e));
    process.exit(1);
  });
}
