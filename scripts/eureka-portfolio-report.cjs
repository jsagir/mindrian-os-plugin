#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 215-04 -- the composed PORTFOLIO batch runner.
 *
 * ONE command turns a room.db + a cited idea-graph into a ranked, AHP-weighted,
 * provenance-stamped portfolio report with a DISTINCT weak-signal tail section
 * and critic-gated Opportunity Statements. This is COMPOSITION, not a new engine
 * (Canon Part 7): every scoring primitive already ships. The runner wires the
 * Wave-1 modules (ahp-weights, portfolio-dimensions, tail-quadrant,
 * opportunity-statement) onto the reused Phase 211 spine (tri-modal index,
 * scoreMeasured, the room-runner's backend-aware vector read + enumeration).
 *
 * Pipeline:
 *   (1) load the idea-graph JSON -> techMap (id -> node fields) + deduped
 *       CONVERGES pairs; cohort counts are read AT RUN TIME from what loaded,
 *       never a hardcoded substrate literal (the graph regenerates),
 *   (2) openRoomDb + tri-modal indexNodes; HARD GATE on idx.embedded === true so
 *       a stale-vector run can never masquerade as a live one (the 211 fix class),
 *   (3) read vectors back ONCE via the exported loadIndexVectors,
 *   (4) enumerate pairs: --pairs graph (the cited CONVERGES substrate, default)
 *       or --pairs full (the 211 cross-boundary enumeration over ALL room nodes),
 *   (5) score each pair with scoreMeasured (the Part 8 figure-guard skips + counts,
 *       never aborts),
 *   (6) three-dimension score keyed to the AHP CRITERIA, composed with the
 *       per-run-reloaded weight vector (a bad matrix aborts LOUDLY, never a
 *       silently mis-weighted report),
 *   (7) classify the low-attention / high-growth tail as its OWN category,
 *   (8) rank pairs, keep --top, and add every tail-flagged complementary pair as
 *       a statement candidate (the gems ride even when outranked),
 *   (9) render a markdown report + a JSON sibling (Plan 05 reads the JSON).
 *
 * --------------------------------------------------------------------------
 * CANON PART 8 (Graph Boundary): ZERO network calls of any kind. No URL, no
 * socket. The offline stub encoder is deterministic and local. Real-room content
 * is verified by the HUMAN spot-check (the Plan 05 checkpoint), never by a
 * network judge. The Part 8 K/M/B figure-guard inside scoreMeasured throws on a
 * forbidden pattern; this runner skips + counts, so one tripping node never
 * aborts the batch, and the skip count prints in provenance.
 *
 * CANON PART 9 (Memory Locality): writes ONLY the derived eureka_* projection
 * tables (via indexNodes) and the report FILES. ZERO writes to nodes, edges, or
 * memory_event; banking a statement as a graph node is a later phase's governed
 * wiring, not minted here. The room handle opens in a try/finally so it always
 * closes.
 *
 * A4 posture: single-process batch, no deep FUSION-engine call and no
 * chain-executor fan-out in this loop. Per-tech DEEP analysis stays the reserved
 * path the report's next_steps RECOMMEND (never trigger).
 * --------------------------------------------------------------------------
 *
 * Usage:
 *   node scripts/eureka-portfolio-report.cjs [--db <roomDir>] [--graph <path>] \
 *     [--pairs graph|full] [--offline] [--top <n>] [--out <md>] [--json <json>] \
 *     [--brokerage <json>]
 *
 * Pure CJS, node built-ins + the shipped lib modules and the 211 runner. No
 * Commander, no new npm dependency, no em-dashes.
 */

const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const triModal = require(path.join(REPO_ROOT, 'lib/core/eureka/tri-modal-index.cjs'));
const { scoreMeasured } = require(path.join(REPO_ROOT, 'lib/core/rs-differential-scorer.cjs'));
const spine = require(path.join(REPO_ROOT, 'lib/core/eureka/embedding-spine.cjs'));

// Reused 211 runner helpers (Part 7 composition; additively exported in Task 1).
const roomReport = require(path.join(REPO_ROOT, 'scripts/eureka-room-report.cjs'));
const buildRootDomainMap = roomReport.buildRootDomainMap;
const loadIndexVectors = roomReport.loadIndexVectors;
const stubEncode = roomReport.stubEncode;
const truncate = roomReport.truncate;

// The four Wave-1 modules composed into the pipeline.
const ahp = require(path.join(REPO_ROOT, 'lib/core/eureka/ahp-weights.cjs'));
const pdims = require(path.join(REPO_ROOT, 'lib/core/eureka/portfolio-dimensions.cjs'));
const tailmod = require(path.join(REPO_ROOT, 'lib/core/eureka/tail-quadrant.cjs'));
const oppmod = require(path.join(REPO_ROOT, 'lib/core/eureka/opportunity-statement.cjs'));

// The Plan 01 room-native substrate adapter (D-01): sources pairs + signals from
// room.db directly so the SAME four Wave-1 modules compose against a room with no
// CSV-derived idea-graph. Injected, never a require cycle (it never imports this
// runner). See lib/core/eureka/room-native-substrate.cjs.
const roomNative = require(path.join(REPO_ROOT, 'lib/core/eureka/room-native-substrate.cjs'));
// Phase 218 fix (REQ-5 live-verification gap, T-218-VD): the closed, frozen
// entity-node type family, reused (never re-derived) from its one source of
// truth. See the "stratified cohort" comment at its call site below.
const { ENTITY_NODE_TYPES } = require(path.join(REPO_ROOT, 'lib/core/navigation/typed-entity.cjs'));

const DEFAULT_GRAPH = 'evals/eureka/jhtv-idea-graph.json';
const PROGRESS_EVERY = 100000; // full mode over a big room is ~millions of pairs

// ---------------------------------------------------------------------------
// argv -- switch/case router (the gsd-tools idiom), no dependency.
// ---------------------------------------------------------------------------

function parseArgv(argv) {
  const opts = {
    db: 'room',
    graph: DEFAULT_GRAPH,
    pairs: 'graph',
    offline: false,
    top: 25,
    out: 'evals/eureka/215-portfolio-report.md',
    json: 'evals/eureka/215-portfolio-report.json',
    brokerage: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--offline': opts.offline = true; break;
      case '--db': opts.db = argv[i += 1]; break;
      case '--graph': opts.graph = argv[i += 1]; break;
      case '--pairs': opts.pairs = argv[i += 1]; break;
      case '--top': opts.top = parseInt(argv[i += 1], 10); break;
      case '--out': opts.out = argv[i += 1]; break;
      case '--json': opts.json = argv[i += 1]; break;
      case '--brokerage': opts.brokerage = argv[i += 1]; break;
      case '-h':
      case '--help': opts.help = true; break;
      default: break;
    }
  }
  if (opts.pairs !== 'full' && opts.pairs !== 'room') opts.pairs = 'graph';
  if (!Number.isFinite(opts.top) || opts.top <= 0) opts.top = 25;
  return opts;
}

const HELP = [
  'eureka-portfolio-report.cjs -- the composed portfolio batch runner (Part 7).',
  '',
  'Usage:',
  '  node scripts/eureka-portfolio-report.cjs [flags]',
  '',
  'Flags (defaults in brackets):',
  '  --db <roomDir>        [room]     the room directory -> <db>/.mindrian/room.db',
  '  --graph <path>        [' + DEFAULT_GRAPH + ']  the cited idea-graph JSON',
  '  --pairs graph|full|room [graph]  graph = the cited CONVERGES substrate (fast ranked loop);',
  '                                   full = the 211 cross-boundary enumeration over ALL room nodes;',
  '                                   room = room-native substrate from room.db nodes+edges (no idea-graph needed)',
  '  --offline             [live]     deterministic stub encoder (no model, no network)',
  '  --top <n>             [25]       keep the top N ranked pairs',
  '  --out <md>            [evals/eureka/215-portfolio-report.md]   markdown report',
  '  --json <json>         [evals/eureka/215-portfolio-report.json] JSON sibling (Plan 05 reads this)',
  '  --brokerage <json>    [<none>]   optional id -> [0,1] Burt-brokerage map (the DG-1 seam)',
  '  --help                           show this help',
].join('\n');

// ---------------------------------------------------------------------------
// Small local helpers.
// ---------------------------------------------------------------------------

function finiteOr0(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Numeric recency axis: strip the leading C (case-insensitive), parseInt. A
// higher cnumber is a MORE RECENT catalog entry (the growth proxy).
function cnumberNumeric(cnumber) {
  const s = String(cnumber == null ? '' : cnumber).replace(/^[Cc]/, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function nodeData(n) {
  return (n && typeof n === 'object' && n.data && typeof n.data === 'object') ? n.data : n;
}

// catalogId: the PUBLIC catalog id (C-number / P-number) that joins a room node
// to the cited idea-graph. The 211 import (scripts/import-jhu-tech-csv.cjs) keys
// each room node with a synthetic `claim:<meeting>:<hash>` id and stamps the real
// catalog id as the trailing token of source_path (e.g.
// `meeting:jhu-tech-import-2026-07-05:jhu-tech:C16796`). The idea-graph keys its
// nodes by that SAME catalog id (C16796). Without this join the runner would emit
// opaque hash ids and match nothing in the graph (the id-space mismatch Plan 05
// surfaced at real-room scale; the 215-04 fixture used C-number ids directly so
// the gap was invisible until now). Falls back to the raw room id when no catalog
// token is present (memory_event / persona nodes) so those still enumerate.
function catalogId(row) {
  const sp = String(row && row.source_path ? row.source_path : '');
  const parts = sp.split(':');
  const last = parts.length ? parts[parts.length - 1].trim() : '';
  const m = last.match(/^([A-Za-z]\d+)/);
  return m ? m[1] : (row && row.id);
}

// A room node with no graph entry (full mode ranges over the whole catalog,
// which may hold nodes the cited idea-graph never paired). Synthesize a minimal
// tech so the classifiers degrade honestly instead of throwing.
function techFor(techMap, id) {
  const t = techMap.get(id);
  if (t) return t;
  return {
    id: id,
    cnumber: /^C0*[0-9]+$/i.test(id) ? id : '',
    title: id,
    primary_tier: undefined,
    pair_count: 0,
    degree: 0,
    section: 'unknown',
    primary_problem: '',
    problems: [],
  };
}

// shared_problems for a candidate: the intersection of the two techs' problem
// lists, else an honest single-item bridge label (the emitter requires a
// non-empty first string; never fabricate a market claim, just name the bridge).
function deriveSharedProblems(a, b) {
  const pa = Array.isArray(a.problems) ? a.problems.filter(function (x) { return typeof x === 'string' && x.trim(); }) : [];
  const setB = new Set(Array.isArray(b.problems) ? b.problems : []);
  const shared = pa.filter(function (x) { return setB.has(x); });
  if (shared.length) return shared;
  const one = a.primary_problem || b.primary_problem
    || ('a ' + (a.section || 'unknown') + ' x ' + (b.section || 'unknown') + ' cross-domain bridge');
  return [one];
}

// ---------------------------------------------------------------------------
// Load the cited idea-graph: techMap + deduped CONVERGES pairs. Cohort counts
// are read from THIS load (never a frozen literal). meta.honest_nouns is prose
// quoted verbatim into provenance, never parsed into an asserted count.
// ---------------------------------------------------------------------------

function loadGraph(graphPath) {
  const raw = fs.readFileSync(graphPath, 'utf8');
  const g = JSON.parse(raw);
  const meta = (g && g.meta && typeof g.meta === 'object') ? g.meta : {};
  const els = (g && g.elements && typeof g.elements === 'object') ? g.elements : {};
  const rawNodes = Array.isArray(els.nodes) ? els.nodes : [];
  const rawEdges = Array.isArray(els.edges) ? els.edges : [];

  const techMap = new Map();
  for (let i = 0; i < rawNodes.length; i += 1) {
    const d = nodeData(rawNodes[i]);
    if (!d || typeof d.id !== 'string' || !d.id) continue;

    // FIELD-CONTRACT ADAPTER (the 215-05 fix, tests/test-215-field-contract.cjs).
    // scripts/csv-to-idea-graph.cjs -- the emitter that ALSO feeds the De Stijl
    // dashboard viewer (dashboard/index.html + export-template.html read its
    // section/label/summary fields) -- writes content-node fields named
    // `edge_count`, `primary_label`, `labels`. This scorer's downstream contract
    // (portfolio-dimensions.cjs, opportunity-statement.cjs, both unit-tested with
    // these names) reads `pair_count`, `primary_problem`, `problems`. We reconcile
    // HERE, in the single adapter, rather than renaming the emitter (which would
    // ripple into the two dashboard templates). We still PREFER an explicit
    // scorer-named field when a future graph provides one, then fall back to the
    // emitter's actual name.

    // pair_count (the demand/attention axis): prefer an explicit pair_count, else
    // the emitter's edge_count (how many relationship rows cite this node). Absent
    // -> the field was silently undefined, which pinned validated_demand at the
    // degenerate 0.5 percentile for the whole cohort (the tie-block bug).
    let pairCount = 0;
    if (Number.isFinite(Number(d.pair_count))) pairCount = Number(d.pair_count);
    else if (Number.isFinite(Number(d.edge_count))) pairCount = Number(d.edge_count);

    // primary_problem (the domain the statement names): prefer primary_problem,
    // else the emitter's primary_label (the district = clinical domain).
    let primaryProblem = '';
    if (typeof d.primary_problem === 'string' && d.primary_problem.trim()) primaryProblem = d.primary_problem;
    else if (typeof d.primary_label === 'string') primaryProblem = d.primary_label;

    // problems (the shared-domain intersection source): prefer problems, else labels.
    let problems = [];
    if (Array.isArray(d.problems)) problems = d.problems;
    else if (Array.isArray(d.labels)) problems = d.labels;

    // cnumber (the tail growth-recency proxy): prefer an explicit cnumber, else
    // derive it from a C-number id. The emitter omits cnumber, so without this the
    // cited graph techs (the ones that matter) had cnumber '' and a zeroed growth
    // axis, while non-graph techFor() nodes derived theirs from the id -- an
    // inconsistency that silently degraded the tail for exactly the wrong set.
    let cnumber = '';
    if ((typeof d.cnumber === 'string' || typeof d.cnumber === 'number') && String(d.cnumber).trim()) {
      cnumber = String(d.cnumber);
    } else if (/^C0*[0-9]+$/i.test(d.id)) {
      cnumber = d.id;
    }

    techMap.set(d.id, {
      id: d.id,
      cnumber: cnumber,
      title: (typeof d.title === 'string' && d.title.trim()) ? d.title : d.id,
      primary_tier: d.primary_tier,
      pair_count: pairCount,
      degree: Number.isFinite(Number(d.degree)) ? Number(d.degree) : 0,
      section: (typeof d.section === 'string' && d.section.trim()) ? d.section : 'unknown',
      primary_problem: primaryProblem,
      problems: problems,
    });
  }

  const seen = new Set();
  const convergesPairs = [];
  for (let i = 0; i < rawEdges.length; i += 1) {
    const d = nodeData(rawEdges[i]);
    if (!d || d.type !== 'CONVERGES') continue;
    const s = d.source;
    const t = d.target;
    if (typeof s !== 'string' || typeof t !== 'string' || !s || !t || s === t) continue;
    const key = s < t ? s + ':' + t : t + ':' + s; // unordered dedupe
    if (seen.has(key)) continue;
    seen.add(key);
    convergesPairs.push({
      a: s,
      b: t,
      shared_problems: Array.isArray(d.shared_problems)
        ? d.shared_problems.filter(function (x) { return typeof x === 'string' && x.trim(); })
        : [],
    });
  }

  return { meta: meta, techMap: techMap, convergesPairs: convergesPairs };
}

// Optional DG-1 brokerage map: a JSON file of id -> [0,1]. Surfaced at the CLI
// so a future Phase-212.5 Burt output plugs in with NO code change.
function loadBrokerage(brokeragePath) {
  if (!brokeragePath) return null;
  const raw = fs.readFileSync(brokeragePath, 'utf8');
  const obj = JSON.parse(raw);
  if (!obj || typeof obj !== 'object') return null;
  const m = new Map();
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += 1) {
    const v = Number(obj[keys[i]]);
    if (Number.isFinite(v)) m.set(keys[i], Math.max(0, Math.min(1, v)));
  }
  return m.size > 0 ? m : null;
}

// ---------------------------------------------------------------------------
// Report rendering.
// ---------------------------------------------------------------------------

function fmt(n, d) {
  return (typeof n === 'number' && Number.isFinite(n)) ? n.toFixed(d) : 'n/a';
}

function renderReport(ctx) {
  const L = [];
  const p = ctx.provenance;

  L.push('# Phase 215 Eureka Portfolio Report');
  L.push('');
  L.push('> ONE command, all shipped engines: a ranked, AHP-weighted, provenance-stamped');
  L.push('> portfolio report with a DISTINCT weak-signal tail section. This is composition,');
  L.push('> not a new engine (Canon Part 7). A high composite is NECESSARY not SUFFICIENT.');
  L.push('');

  L.push('## Provenance');
  L.push('');
  L.push('| Field | Value |');
  L.push('| ----- | ----- |');
  L.push('| Run mode | ' + p.run_mode + ' |');
  L.push('| Pairs mode | ' + p.pairs_mode + ' |');
  L.push('| Room dir | `' + ctx.roomDir + '` |');
  L.push('| Graph | `' + ctx.graphRel + '` |');
  L.push('| Encoder model | ' + p.encoder_model + ' |');
  L.push('| Encoder dtype | ' + p.encoder_dtype + ' |');
  L.push('| Vector backend | ' + p.vec_backend + ' |');
  L.push('| AHP weights (strategic_fit / validated_demand / tech_econ_feasibility) | '
    + fmt(p.ahp_weights.strategic_fit, 3) + ' / ' + fmt(p.ahp_weights.validated_demand, 3)
    + ' / ' + fmt(p.ahp_weights.tech_econ_feasibility, 3) + ' |');
  L.push('| AHP CR (Saaty Consistency Ratio) | ' + fmt(p.ahp_cr, 4) + ' |');
  L.push('| AHP matrix source | `' + p.ahp_matrix_source + '` |');
  L.push('| Tail composition | ' + p.tail_composition + ' |');
  L.push('| Tail growth proxy | ' + p.growth_proxy + ' |');
  L.push('| Tail thresholds (attnCut / growthCut) | ' + fmt(p.tail_thresholds.attnCut, 3)
    + ' / ' + fmt(p.tail_thresholds.growthCut, 3) + ' |');
  L.push('| Tail insufficient_structure | ' + String(p.tail_insufficient_structure) + ' |');
  L.push('| Tail suspect_noise | ' + String(p.tail_suspect_noise) + ' |');
  L.push('| Graph nodes loaded | ' + p.graph_nodes + ' |');
  L.push('| CONVERGES pairs loaded | ' + p.converges_pairs + ' |');
  L.push('| Cohort techs (room-indexed, run time) | ' + p.cohort_techs + ' |');
  L.push('| Pairs scored | ' + p.pairs_scored + ' |');
  L.push('| Pairs skipped (Part 8 figure-guard) | ' + p.figure_guard_skipped + ' |');
  L.push('| Honest nouns (graph meta, verbatim) | ' + String(p.honest_nouns).replace(/\|/g, '/') + ' |');
  L.push('| Run date | ' + p.run_date + ' |');
  L.push('');

  if (p.encoder_unavailable) {
    L.push('## Encoder unavailable');
    L.push('');
    L.push('The embedding spine returned `encoder_unavailable` (the transformers dependency is');
    L.push('not installed, or the model could not load). No semantic scores were produced, so the');
    L.push('ranked list and tail below are empty. This is a graceful degradation, not a pipeline');
    L.push('failure. Install the deps and re-run without `--offline` for the live report.');
    L.push('');
  }

  // -- Ranked top N (score is a sort key; the tail is NOT) --
  L.push('## Ranked top ' + ctx.top);
  L.push('');
  L.push('Ranked by the AHP composite score descending. `weak dims` are the dimensions strictly');
  L.push('below the weak floor on either side (the combine rationale). `banked` is true ONLY on a');
  L.push('resolved passing critic verdict.');
  L.push('');
  if (ctx.ranked.length === 0) {
    L.push('_No ranked pairs (see the encoder note above, or the graph paired nothing in the room)._');
    L.push('');
  } else {
    L.push('| rank | A (id: title) | B (id: title) | score | strat_fit | val_demand | feasibility | weak dims | banked |');
    L.push('| ---- | ------------- | ------------- | ----- | --------- | ---------- | ----------- | --------- | ------ |');
    for (let i = 0; i < ctx.ranked.length; i += 1) {
      const r = ctx.ranked[i];
      const weak = (r.weakA.concat(r.weakB));
      const weakStr = weak.length ? Array.from(new Set(weak)).join(', ') : 'none';
      L.push('| ' + r.rank
        + ' | ' + r.idA + ': ' + truncate(r.techA.title, 30)
        + ' | ' + r.idB + ': ' + truncate(r.techB.title, 30)
        + ' | ' + fmt(r.score, 3)
        + ' | ' + fmt(r.pairDims.strategic_fit, 2)
        + ' | ' + fmt(r.pairDims.validated_demand, 2)
        + ' | ' + fmt(r.pairDims.tech_econ_feasibility, 2)
        + ' | ' + weakStr
        + ' | ' + (r.banked ? 'yes' : 'no')
        + ' |');
    }
    L.push('');
  }

  // -- Tail quadrant: its OWN section, never a sort key --
  L.push('## Tail quadrant (weak signals)');
  L.push('');
  L.push('The low-attention / high-growth quadrant: under-watched technologies whose catalog');
  L.push('recency is rising. These are the gems a top-N sort buries, which is exactly why they get');
  L.push('their own section. Axes are per-cohort percentiles (scale-free); growth is a RECENCY');
  L.push('proxy (cnumber), not a measured market-growth rate.');
  L.push('');
  if (ctx.provenance.pairs_mode === 'room') {
    L.push('Room-native axes: attention is room-graph node degree, growth is created_at recency');
    L.push('(still a proxy, still UNCALIBRATED).');
    L.push('');
  }
  if (ctx.tail.insufficient_structure) {
    L.push('**Verdict: INSUFFICIENT STRUCTURE.** The cohort (' + ctx.provenance.cohort_techs
      + ' techs) is below the minimum needed to define a whitespace quadrant. No tail is');
    L.push('classified. This is the honest degenerate verdict, printed INSTEAD of dressing up noise.');
    if (ctx.provenance.pairs_mode === 'room') {
      L.push('Not enough entries for a tail read (the cohort is below the MIN_COHORT 30 floor). The '
        + 'ranked pairs and Opportunity Statements above still stand.');
    }
    L.push('');
  } else if (ctx.tail.suspect_noise) {
    L.push('**Verdict: SUSPECT NOISE.** The quadrant swallowed too large a fraction of the cohort to');
    L.push('be a real weak signal. The list is kept below for transparency but is flagged as likely');
    L.push('noise, not a curated gem set.');
    L.push('');
  }
  if (!ctx.tail.insufficient_structure && ctx.tail.tail.length > 0) {
    L.push('| # | tech | attention (pctile) | growth (pctile) |');
    L.push('| - | ---- | ------------------ | --------------- |');
    for (let i = 0; i < ctx.tail.tail.length; i += 1) {
      const t = ctx.tail.tail[i];
      const tech = ctx.techFor(t.id);
      L.push('| ' + (i + 1) + ' | ' + t.id + ': ' + truncate(tech.title, 30)
        + ' | ' + fmt(t.attention, 3) + ' | ' + fmt(t.growth, 3) + ' |');
    }
    L.push('');
  } else if (!ctx.tail.insufficient_structure) {
    L.push('_No technology fell into the low-attention / high-growth quadrant this run._');
    L.push('');
  }
  L.push('### Tail-driven candidate pairs');
  L.push('');
  L.push('Pairs where at least one side is tail-flagged AND the two sides are complementary-weak');
  L.push('(disjoint weak dimensions). These ride into the Opportunity Statements even when');
  L.push('outranked, because surfacing them is the whole point of the tail category.');
  L.push('');
  if (ctx.tailPairs.length === 0) {
    L.push('_No tail-driven complementary pairs this run._');
    L.push('');
  } else {
    L.push('| rank | A | B | score | complementary |');
    L.push('| ---- | - | - | ----- | ------------- |');
    for (let i = 0; i < ctx.tailPairs.length; i += 1) {
      const r = ctx.tailPairs[i];
      L.push('| ' + r.rank + ' | ' + r.idA + ' | ' + r.idB + ' | ' + fmt(r.score, 3) + ' | yes |');
    }
    L.push('');
  }

  // -- Opportunity Statements --
  L.push('## Opportunity Statements');
  L.push('');
  L.push('Each candidate rendered in the canonical Opportunity Statement shape. A `pending` critic');
  L.push('verdict is labeled NOT YET BANKED (critic pending): the synchronous emitter never claims a');
  L.push('verification it did not obtain.');
  L.push('');
  if (ctx.statements.length === 0) {
    L.push('_No statement candidates this run._');
    L.push('');
  } else {
    for (let i = 0; i < ctx.statements.length; i += 1) {
      const s = ctx.statements[i];
      const state = s.statement.banked
        ? ('BANKED (critic ' + (typeof s.statement.critic === 'object' && s.statement.critic
          ? (s.statement.critic.verdict || 'pass') : 'pass') + ')')
        : 'NOT YET BANKED (critic pending)';
      L.push('### ' + (i + 1) + '. rank ' + s.pair.rank + ' -- ' + s.pair.idA + ' x ' + s.pair.idB
        + (s.tailFlag ? ' [WEAK-SIGNAL TAIL]' : ''));
      L.push('');
      L.push(s.statement.text);
      L.push('');
      L.push('- State: ' + state);
      L.push('- Potential: ' + s.statement.fields.potential_tier);
      L.push('- Next steps (deep analysis is RECOMMENDED, never auto-triggered): ' + s.statement.fields.next_steps);
      L.push('');
    }
  }

  // -- Mandatory caveat block --
  L.push('## Caveat (necessary not sufficient)');
  L.push('');
  L.push('- A high AHP composite is NECESSARY, not SUFFICIENT. The top of this list may be');
  L.push('  restatements; the Grounding Guard (Phase 212) is the filter, this runner only surfaces.');
  L.push('- The score BANDS and the potential tiers are UNCALIBRATED defaults (202-APO tunes them).');
  L.push('- Growth is a RECENCY PROXY (cnumber), not a measured market-growth rate. A rising catalog');
  L.push('  number means newer, not proven to be growing demand.');
  L.push('- Real-room content NEVER reaches a network judge. This report is verified by the human');
  L.push('  spot-check at the Plan 05 checkpoint, not by Plurai.');
  L.push('');
  if (ctx.offline && !ctx.provenance.encoder_unavailable) {
    L.push('> OFFLINE CAVEAT: the stub encoder scores semantic overlap as a hashed bag-of-tokens, so');
    L.push('> the semantic leg TRACKS lexical overlap by construction. This run is a STRUCTURAL smoke');
    L.push('> signal only; it is NOT embedding-quality evidence. The embedding-quality answer needs');
    L.push('> the LIVE run.');
    L.push('');
  }

  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(argv) {
  const opts = parseArgv(argv);
  if (opts.help) {
    process.stdout.write(HELP + '\n');
    return 0;
  }

  const roomDir = path.isAbsolute(opts.db) ? opts.db : path.join(REPO_ROOT, opts.db);
  const graphPath = path.isAbsolute(opts.graph) ? opts.graph : path.join(REPO_ROOT, opts.graph);
  const outPath = path.isAbsolute(opts.out) ? opts.out : path.join(REPO_ROOT, opts.out);
  const jsonPath = path.isAbsolute(opts.json) ? opts.json : path.join(REPO_ROOT, opts.json);

  let db = null;
  try {
    // (6, early) Reload the AHP weights PER RUN. An inconsistent matrix throws
    // AHP_INCONSISTENT here and aborts LOUDLY with exit 1: a bad matrix must
    // never produce a silently mis-weighted report.
    const ahpConfig = ahp.loadAhpConfig();
    const weights = ahpConfig.weights;
    const weightsByCriteria = {
      strategic_fit: weights[0],
      validated_demand: weights[1],
      tech_econ_feasibility: weights[2],
    };
    const matrixSource = ahp._test && ahp._test.DEFAULT_CONFIG_PATH
      ? path.relative(REPO_ROOT, ahp._test.DEFAULT_CONFIG_PATH)
      : 'data/portfolio-ahp-matrix.json';

    // (1) Substrate. graph/full read the cited idea-graph from disk BEFORE the
    // room opens (unchanged from Phase 215). room mode (D-01) reads NEITHER the
    // graphPath NOR loadGraph: it builds pairs + signals from room.db via the
    // adapter AFTER the room opens, so a nonexistent --graph never aborts a room
    // run. techMap/convergesPairs/graph are hoisted so both paths fill them.
    let graph = null;
    let techMap;
    let convergesPairs;
    const brokerage = loadBrokerage(opts.brokerage ? (path.isAbsolute(opts.brokerage) ? opts.brokerage : path.join(REPO_ROOT, opts.brokerage)) : '');

    if (opts.pairs !== 'room') {
      // Counts read from THIS load (never a frozen literal).
      graph = loadGraph(graphPath);
      techMap = graph.techMap;
      convergesPairs = graph.convergesPairs;
    }

    // (2) Open the room + build the tri-modal index.
    db = openRoomDb(roomDir, { allowExtension: true });

    if (opts.pairs === 'room') {
      // Room-native substrate: the adapter keys techs by the SAME catalogId join
      // the index uses below, so pair ids + techMap live in one id-space. No
      // idea-graph file is read (Test 2 pins that graphPath is never touched).
      const sub = roomNative.buildRoomNativeSubstrate(db, { canonicalId: catalogId });
      graph = { meta: sub.meta };
      techMap = sub.techMap;
      convergesPairs = sub.convergesPairs;
    }
    const encodeFn = opts.offline ? stubEncode : undefined;
    const idx = await triModal.indexNodes(db, { encodeFn: encodeFn, roomDir: roomDir });

    // (3) HARD GATE (T-215-09, the 211 fix class): score ONLY when this run
    // freshly embedded. Stale eureka_vec rows from an earlier offline run must
    // never be scored under a LIVE label. Gate on idx.embedded === true.
    const rows = db.prepare('SELECT id, type, properties, source_path FROM nodes').all();
    const rootOf = buildRootDomainMap(rows);
    const vectors = idx.embedded === true ? loadIndexVectors(db, idx.vec_backend) : new Map();

    // Index keyed by the PUBLIC catalog id (catalogId) so pair ids + graph-join
    // speak the idea-graph's C-number id-space, NOT the room's opaque hash ids.
    // The raw room id is retained for vector + text + root-domain lookups (those
    // three tables are keyed by the room id). Last write wins on the (rare, here
    // zero) canonical-id collision.
    const indexed = new Map();
    if (idx.embedded === true) {
      for (let i = 0; i < rows.length; i += 1) {
        const text = triModal.nodeText(rows[i], { roomDir: roomDir });
        if (!text) continue;
        const vec = vectors.get(rows[i].id);
        if (!vec) continue;
        const canonical = catalogId(rows[i]);
        indexed.set(canonical, {
          id: canonical,
          rawId: rows[i].id,
          type: rows[i].type || 'unknown',
          text: text,
          vec: vec,
          root: rootOf(rows[i].id),
        });
      }
    }

    // Cohort = the techs actually present in the room index (read at run time).
    const cohortTechs = Array.from(indexed.keys()).map(function (id) { return techFor(techMap, id); });
    const techForCtx = function (id) { return techFor(techMap, id); };

    // Phase 218 fix (T-218-VD, traced live against aion-eureka-synergy):
    // scoreTechDimensions' validated_demand/tech_econ_feasibility are PERCENTILE
    // ranks of pair_count/degree WITHIN the cohort array passed in. Room-native
    // degree is raw undirected edge count accumulated since the node was born
    // (room-native-substrate.cjs::degreeMap). A memory_artifact scaffold node
    // that has lived in the room for months accrues dozens of edges; a freshly
    // written company/technology/market entity node starts at degree 1 (its
    // single DESCRIBES link back to the artifact it came from) and gets WORSE
    // as more entities point at the same hub. Pooling both families into ONE
    // percentile population means every entity node's percentile is dragged to
    // the floor by comparison against long-accumulated hub degree, regardless of
    // how relevant the entity actually is - not a real weakness signal, an
    // artifact-of-age signal. Verified live: pre-218-fix, aion-eureka-synergy's
    // top-25 stayed 100% memory_artifact-vs-memory_artifact even after 149
    // entity nodes were written (VERIFICATION.md, phase 218-03).
    //
    // Fix: stratify the percentile population by node-type family before
    // ranking. Entity nodes are percentile-ranked against OTHER entity nodes
    // (fair - a same-age peer group); everything else keeps the original
    // mixed cohort. When a room has ZERO entity nodes, entityCohort stays
    // empty and every tech routes to scaffoldCohort === the original
    // cohortTechs array (byte-identical output to pre-fix behavior - this is
    // the "no entity nodes -> unchanged" regression guard).
    const entityCohort = [];
    const scaffoldCohort = [];
    for (let ci = 0; ci < cohortTechs.length; ci += 1) {
      const cid = cohortTechs[ci].id;
      const cnode = indexed.get(cid);
      const cType = cnode && cnode.type;
      if (ENTITY_NODE_TYPES.has(cType)) entityCohort.push(cohortTechs[ci]);
      else scaffoldCohort.push(cohortTechs[ci]);
    }
    const cohortFor = function (id) {
      const node = indexed.get(id);
      const nodeType = node && node.type;
      return ENTITY_NODE_TYPES.has(nodeType) ? entityCohort : scaffoldCohort;
    };

    // (4) Pair set per DG-2 mode.
    const pairsToScore = [];
    if (opts.pairs === 'full') {
      // The 211 cross-boundary enumeration: differ in root-domain OR differ in type.
      const arr = Array.from(indexed.values());
      for (let i = 0; i < arr.length; i += 1) {
        for (let j = i + 1; j < arr.length; j += 1) {
          const a = arr[i];
          const b = arr[j];
          if (a.root === b.root && a.type === b.type) continue;
          pairsToScore.push({ a: a.id, b: b.id, shared_problems: [] });
        }
      }
    } else if (opts.pairs === 'room') {
      // Room mode: the UNION of (a) the room's OWN cited edges (convergesPairs,
      // both endpoints indexed) and (b) the full-mode cross-boundary enumeration.
      // The room's typed edges are its cited convergences and must always score
      // even same-type/same-root (the DG-2 cited-signal spirit); cross-boundary
      // enumeration guarantees non-empty pairs on edge-sparse rooms. Edge pairs
      // are pushed FIRST so their shared_problems survive the unordered dedupe.
      const seenPairs = new Set();
      const pushPair = function (a, b, shared) {
        const key = a < b ? a + '|' + b : b + '|' + a;
        if (seenPairs.has(key)) return;
        seenPairs.add(key);
        pairsToScore.push({ a: a, b: b, shared_problems: Array.isArray(shared) ? shared : [] });
      };
      for (let i = 0; i < convergesPairs.length; i += 1) {
        const cp = convergesPairs[i];
        if (indexed.has(cp.a) && indexed.has(cp.b)) pushPair(cp.a, cp.b, cp.shared_problems);
      }
      const arr = Array.from(indexed.values());
      for (let i = 0; i < arr.length; i += 1) {
        for (let j = i + 1; j < arr.length; j += 1) {
          const a = arr[i];
          const b = arr[j];
          if (a.root === b.root && a.type === b.type) continue;
          pushPair(a.id, b.id, []);
        }
      }
    } else {
      // graph mode: the cited CONVERGES substrate, both ids present in the room.
      for (let i = 0; i < convergesPairs.length; i += 1) {
        const cp = convergesPairs[i];
        if (indexed.has(cp.a) && indexed.has(cp.b)) pairsToScore.push(cp);
      }
    }

    // (5) + (6) Score each pair; compose the three-dimension AHP score.
    const scored = [];
    let part8Skipped = 0;
    let progress = 0;
    for (let k = 0; k < pairsToScore.length; k += 1) {
      const cp = pairsToScore[k];
      const na = indexed.get(cp.a);
      const nb = indexed.get(cp.b);
      let r;
      try {
        // eslint-disable-next-line no-await-in-loop
        r = await scoreMeasured(na.text, nb.text, { vectors: [na.vec, nb.vec] });
      } catch (_e) {
        // Part 8 figure-guard (ExternalEgressViolation): skip + count, never abort.
        part8Skipped += 1;
        continue;
      }
      if (r.warning === 'encoder_unavailable' || r.signed_diff === null) continue;

      const techA = techFor(techMap, cp.a);
      const techB = techFor(techMap, cp.b);
      const dimsA = pdims.scoreTechDimensions(techA, cohortFor(cp.a));
      const dimsB = pdims.scoreTechDimensions(techB, cohortFor(cp.b));
      const rs = { direction: r.direction, abs_diff: r.abs_diff, passes: r.passes };
      const pairDims = pdims.scorePairDimensions({ a: dimsA, b: dimsB, rs: rs });
      const score = ahp.composeScore(pairDims, weights);
      const weakA = pdims.weakDimensions(dimsA);
      const weakB = pdims.weakDimensions(dimsB);
      const isComp = pdims.complementary(dimsA, dimsB);

      scored.push({
        idA: cp.a, idB: cp.b, techA: techA, techB: techB,
        dimsA: dimsA, dimsB: dimsB, pairDims: pairDims, score: score,
        weakA: weakA, weakB: weakB, isComp: isComp,
        shared_problems: cp.shared_problems, rs: rs,
      });

      progress += 1;
      if (opts.pairs === 'full' && progress % PROGRESS_EVERY === 0) {
        process.stderr.write('  scored ' + progress + ' pairs...\n');
      }
    }

    // (7) Tail: per-TECH axes over the cohort. attention = pair_count percentile,
    // growth = cnumber-recency percentile. classifyTail owns the degeneracy guards.
    const pairCounts = cohortTechs.map(function (t) { return finiteOr0(t.pair_count); }).sort(function (a, b) { return a - b; });
    const cnums = cohortTechs.map(function (t) { return cnumberNumeric(t.cnumber); }).sort(function (a, b) { return a - b; });
    const tailItems = cohortTechs.map(function (t) {
      return {
        id: t.id,
        attention: pdims.percentileRank(finiteOr0(t.pair_count), pairCounts),
        growth: pdims.percentileRank(cnumberNumeric(t.cnumber), cnums),
      };
    });
    const tailResult = tailmod.classifyTail(tailItems, brokerage ? { brokerage: brokerage } : {});
    const tailIds = new Set(tailResult.tail.map(function (t) { return t.id; }));

    // (8) Rank pairs; keep --top; add tail-flagged complementary pairs as candidates.
    scored.sort(function (x, y) { return y.score - x.score; });
    for (let i = 0; i < scored.length; i += 1) scored[i].rank = i + 1;
    const ranked = scored.slice(0, opts.top);

    const candMap = new Map();
    for (let i = 0; i < ranked.length; i += 1) candMap.set(ranked[i].idA + '|' + ranked[i].idB, ranked[i]);
    const tailPairs = [];
    for (let i = 0; i < scored.length; i += 1) {
      const s = scored[i];
      if ((tailIds.has(s.idA) || tailIds.has(s.idB)) && s.isComp) {
        candMap.set(s.idA + '|' + s.idB, s);
        tailPairs.push(s);
      }
    }
    const candidates = Array.from(candMap.values()).sort(function (a, b) { return a.rank - b.rank; });

    // Statements: buildOpportunityStatement per candidate. banked is honest.
    const statements = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const s = candidates[i];
      const tailFlag = tailIds.has(s.idA) || tailIds.has(s.idB);
      const shared = (s.shared_problems && s.shared_problems.length)
        ? s.shared_problems
        : deriveSharedProblems(s.techA, s.techB);
      const candidate = {
        a: {
          title: s.techA.title || s.idA,
          primary_problem: s.techA.primary_problem || ('unclassified problem for ' + s.idA),
          section: s.techA.section || 'unknown',
          weak_dimensions: s.weakA,
        },
        b: {
          title: s.techB.title || s.idB,
          primary_problem: s.techB.primary_problem || ('unclassified problem for ' + s.idB),
          section: s.techB.section || 'unknown',
          weak_dimensions: s.weakB,
        },
        shared_problems: shared,
        score: s.score,
        rank: s.rank,
        tail: tailFlag,
      };
      let st;
      try {
        st = oppmod.buildOpportunityStatement(candidate);
      } catch (_e) {
        // A malformed candidate must not abort the batch (skip + move on).
        continue;
      }
      // Reflect the resolved verdict back onto the ranked row for the banked column.
      s.banked = st.banked;
      statements.push({ pair: s, statement: st, tailFlag: tailFlag });
    }
    for (let i = 0; i < ranked.length; i += 1) {
      if (typeof ranked[i].banked !== 'boolean') ranked[i].banked = false;
    }

    const prov = spine.encoderProvenance();
    const provenance = {
      run_mode: opts.offline ? 'offline (deterministic stub encoder)' : 'live (local embedding spine)',
      pairs_mode: opts.pairs,
      encoder_model: opts.offline ? 'stub (deterministic hashed bag-of-tokens)' : prov.model,
      encoder_dtype: opts.offline ? 'stub' : prov.dtype,
      vec_backend: idx.vec_backend,
      ahp_weights: weightsByCriteria,
      ahp_cr: ahpConfig.cr,
      ahp_matrix_source: matrixSource,
      tail_composition: tailResult.composition,
      // Room mode overrides the growth-proxy label ONLY in provenance (the axis
      // math in tail-quadrant.cjs is untouched): the recency signal is created_at,
      // not a catalog cnumber.
      growth_proxy: opts.pairs === 'room' ? 'created_at-recency (room-native)' : tailResult.growth_proxy,
      tail_thresholds: tailResult.thresholds,
      tail_insufficient_structure: tailResult.insufficient_structure,
      tail_suspect_noise: tailResult.suspect_noise,
      cohort_techs: cohortTechs.length,
      graph_nodes: techMap.size,
      converges_pairs: convergesPairs.length,
      pairs_scored: scored.length,
      figure_guard_skipped: part8Skipped,
      honest_nouns: (typeof graph.meta.honest_nouns === 'string' && graph.meta.honest_nouns.trim())
        ? graph.meta.honest_nouns.trim()
        : '(none stated in graph meta)',
      encoder_unavailable: idx.embedded !== true,
      run_date: new Date().toISOString().slice(0, 10),
    };

    const report = renderReport({
      provenance: provenance,
      roomDir: opts.db,
      graphRel: opts.pairs === 'room' ? '(room-native: no idea-graph)' : (path.isAbsolute(opts.graph) ? opts.graph : opts.graph),
      offline: opts.offline,
      top: opts.top,
      ranked: ranked,
      tail: tailResult,
      tailPairs: tailPairs,
      statements: statements,
      techFor: techForCtx,
    });

    // (9) Write the markdown report + the JSON sibling (Plan 05 reads the JSON).
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, report, 'utf8');

    const jsonOut = {
      provenance: provenance,
      ranked: ranked.map(function (r) {
        return {
          rank: r.rank,
          a: r.idA,
          b: r.idB,
          a_title: r.techA.title,
          b_title: r.techB.title,
          score: r.score,
          dims: r.pairDims,
          weak_a: r.weakA,
          weak_b: r.weakB,
          complementary: r.isComp,
          tail_flag: tailIds.has(r.idA) || tailIds.has(r.idB),
          banked: r.banked === true,
        };
      }),
      tail: {
        composition: tailResult.composition,
        growth_proxy: tailResult.growth_proxy,
        insufficient_structure: tailResult.insufficient_structure,
        suspect_noise: tailResult.suspect_noise,
        thresholds: tailResult.thresholds,
        items: tailResult.tail,
      },
      statements: statements.map(function (s) {
        return {
          rank: s.pair.rank,
          a: s.pair.idA,
          b: s.pair.idB,
          tail_flag: s.tailFlag,
          text: s.statement.text,
          banked: s.statement.banked,
          critic: s.statement.critic,
          weak_dimensions: s.statement.weak_dimensions,
          potential_tier: s.statement.fields.potential_tier,
        };
      }),
    };
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2) + '\n', 'utf8');

    process.stdout.write('eureka-portfolio-report: wrote ' + outPath + ' + ' + jsonPath
      + ' (' + scored.length + ' pairs scored, ' + ranked.length + ' ranked, '
      + statements.length + ' statements, ' + tailResult.tail.length + ' tail techs, mode '
      + opts.pairs + '/' + (opts.offline ? 'offline' : 'live') + ')\n');
    return 0;
  } catch (err) {
    process.stderr.write('eureka-portfolio-report FAILED: ' + String(err && err.message ? err.message : err) + '\n');
    return 1;
  } finally {
    if (db) closeRoomDb(db);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code); });
}

module.exports = {
  parseArgv: parseArgv,
  loadGraph: loadGraph,
  loadBrokerage: loadBrokerage,
  techFor: techFor,
  catalogId: catalogId,
  cnumberNumeric: cnumberNumeric,
  deriveSharedProblems: deriveSharedProblems,
  main: main,
};
