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
 * CRITIC RESOLUTION (Phase 219 GAP-1 fix): the emitter's synchronous gate
 * honestly leaves every live statement critic 'pending' (the real Phase 212
 * stageA is async and a sync seam can never await it). AFTER the statements
 * loop and BEFORE banking, this runner awaits oppmod.resolveCriticVerdicts -
 * the bounded async pass (per-statement timeout + batch deadline, env
 * MINDRIAN_CRITIC_RESOLVE_TIMEOUT_MS / MINDRIAN_CRITIC_RESOLVE_BATCH_MS) that
 * resolves each pending statement's REAL stageA verdict and updates banked in
 * place. Unresolvable statements stay honestly 'pending'. OFFLINE runs skip
 * the pass: a stub-encoder verdict would be fixture-green lying about
 * grounding, the exact failure class GAP-1's RCA documents.
 *
 * CANON PART 9 (Memory Locality): graph writes route EXCLUSIVELY through the
 * lib/core/navigation.cjs chokepoint. The banking deferral this header carried
 * since Phase 215 ("a later phase's governed wiring, not minted here") is
 * IMPLEMENTED as of Phase 219 (REQ-1): after the statements loop resolves
 * critic verdicts, ONE BEGIN/COMMIT/ROLLBACK batch (the 218 D-05 shape;
 * node:sqlite has no .transaction() helper) mints each statement passing the
 * banking predicate as a proposed `opportunity` node via
 * navigation.writeOpportunityNode, with DERIVED_FROM evidence edges to the
 * candidate pair's a/b nodes via navigation.linkOpportunityEvidence. NEVER a
 * raw INSERT (the run-all-219.sh grep gate), NEVER graph-ops.indexOpportunity
 * (the legacy raw-insert bypass). A mid-batch failure rolls back the WHOLE
 * batch; the report files are unaffected either way. The room handle opens in
 * a try/finally so it always closes.
 *
 * BANKING PREDICATE (env seam - the logged planner decision for live tuning
 * on ador/corepower; start at 'critic'):
 *   MINDRIAN_OPPORTUNITY_BANK_PREDICATE =
 *     'critic'      (DEFAULT) bank statements with st.banked === true, i.e. a
 *                   RESOLVED PASSING critic verdict (the honest gate; banked
 *                   can never be true on the 'pending' path)
 *     'critic+tail' also bank tail-flagged weak-signal candidates (the gems
 *                   that ride even when outranked)
 *     'all'         every statement with a RESOLVED verdict (critic is not
 *                   'pending'), pass or fail
 *   NEVER gate banking on AHP rank: validated_demand is degree-centrality and
 *   buries low-degree families (219-RESEARCH finding 1 + Pitfall 2).
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
// Phase 219 REQ-1: the navigation chokepoint - the ONLY door for the banking
// pass's node + edge writes (writeOpportunityNode / linkOpportunityEvidence).
const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
// Phase 218 fix (REQ-5 live-verification gap, T-218-VD): the closed, frozen
// entity-node type family, reused (never re-derived) from its one source of
// truth. See the "stratified cohort" comment at its call site below.
const { ENTITY_NODE_TYPES } = require(path.join(REPO_ROOT, 'lib/core/navigation/typed-entity.cjs'));
// Phase 226-02: the encoder-free reasoning-mode core (plan 01). The mode:reasoning
// branch below calls its readRoomMarkdown / proposeCandidatePairs / validateMappings /
// emitReasoningPrompts / scoreReasoningPairs / buildReasoningStatement /
// assertReasoningInvariants surface. Additive: never touched unless the embedded
// attempt genuinely degraded (idx.embedded !== true or scored.length === 0).
const reasoningMode = require(path.join(REPO_ROOT, 'lib/core/eureka/reasoning-mode.cjs'));

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
    // Phase 226-02 reasoning-mode stage flags (all additive; default off/empty so
    // a normal run is byte-identical).
    reasoningEmit: false,
    reasoningScore: false,
    mappings: '',
    answers: '',
    reasoningWorkdir: '',
    forceEncoderUnavailable: false,
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
      // Phase 226-02: the reasoning-mode stage dispatch + its inputs.
      case '--reasoning-emit': opts.reasoningEmit = true; break;
      case '--reasoning-score': opts.reasoningScore = true; break;
      case '--mappings': opts.mappings = argv[i += 1]; break;
      case '--answers': opts.answers = argv[i += 1]; break;
      case '--reasoning-workdir': opts.reasoningWorkdir = argv[i += 1]; break;
      case '--force-encoder-unavailable': opts.forceEncoderUnavailable = true; break;
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
  '',
  'Reasoning-mode (Phase 226) - the encoder-free fallback stages (entered only AFTER a',
  'genuine embedded run degraded; the normal run seeds the workdir):',
  '  --reasoning-emit                 stage 2: read pairs.json + the session-written mappings.json,',
  '                                   write neutral/adversarial rubric prompts, then stop',
  '  --reasoning-score                stage 3: replay the session answers through the real rubric,',
  '                                   write the SAME md+json report labeled mode:reasoning',
  '  --mappings <path>     [<workdir>/mappings.json]  session-written mechanism+mapping per pair',
  '  --answers <path>      [<workdir>/answers.json]   session-written neutral+adversarial answers',
  '  --reasoning-workdir <dir> [<db>/.mindrian/eureka/reasoning]  the reasoning stage state dir',
  '  --force-encoder-unavailable      test seam: force idx.embedded !== true so the degrade path runs',
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
  L.push('| Scaffold pairs excluded (both endpoints memory_artifact / Artifact) | ' + p.scaffold_pairs_excluded + ' |');
  L.push('| Pairs skipped (Part 8 figure-guard) | ' + p.figure_guard_skipped + ' |');
  L.push('| Critic resolution (GAP-1 async pass) | ' + p.critic_resolution + ' |');
  L.push('| Honest nouns (graph meta, verbatim) | ' + String(p.honest_nouns).replace(/\|/g, '/') + ' |');
  L.push('| Run date | ' + p.run_date + ' |');
  L.push('');

  if (p.encoder_unavailable || p.degrade_cause) {
    L.push('## Degraded run (cause named)');
    L.push('');
    // D7 (the David proving case): name the CAUSE, never the bare "not enough
    // entries" symptom. Misdescribing WHY it degraded sends the navigator to fix
    // the wrong thing (add content) when the real blocker is infrastructural.
    if (p.degrade_cause === 'encoder_unavailable') {
      L.push('Cause: `encoder_unavailable`. The embedding model is not installed or cached, so no');
      L.push('semantic scores were produced. This is INFRASTRUCTURAL, not a content gap: adding more');
      L.push('entries will NOT help. Fetch the model (re-run without `--offline` once the deps load),');
      L.push('or run reasoning mode for an honest encoder-free short list.');
    } else if (p.degrade_cause === 'below_floor') {
      L.push('Cause: `below_floor`. The encoder ran, but the room scored zero pairs after a genuine');
      L.push('attempt (the substrate is too thin for the embedded floor). Add cross-domain entries, or');
      L.push('run reasoning mode for an honest encoder-free short list.');
    } else {
      L.push('The embedding spine returned `encoder_unavailable` (the transformers dependency is not');
      L.push('installed, or the model could not load). No semantic scores were produced, so the ranked');
      L.push('list and tail below are empty. This is a graceful degradation, not a pipeline failure.');
    }
    L.push('');
    if (p.reasoning && typeof p.reasoning === 'object') {
      L.push('Reasoning-mode next step: candidate pairs were seeded to `' + p.reasoning.workdir
        + '` (state: ' + p.reasoning.state + ', ' + p.reasoning.pairs_selected + ' pairs). '
        + p.reasoning.next_step + '.');
      L.push('');
    }
  }

  // SEED req 5 / D6: the reasoning -> embedded upgrade delta, in its OWN section,
  // NEVER merged into the ranked table. Present only when this embedded run
  // followed a prior reasoning-mode run over the same room.
  if (p.upgrade && typeof p.upgrade === 'object') {
    L.push('## Reasoning to embedded upgrade');
    L.push('');
    L.push('This room was previously scored in REASONING mode (' + p.upgrade.previous_run_date + '). This');
    L.push('embedded run does NOT silently replace that result. Delta: ' + p.upgrade.survived + ' of the prior');
    L.push('top pairs survived into the new embedded ranked list, ' + p.upgrade.demoted_or_absent + ' demoted or absent.');
    L.push('');
    const newSet = new Set();
    for (let i = 0; i < ctx.ranked.length; i += 1) {
      newSet.add(ctx.ranked[i].idA + '|' + ctx.ranked[i].idB);
      newSet.add(ctx.ranked[i].idB + '|' + ctx.ranked[i].idA);
    }
    const prevTop = Array.isArray(p.upgrade.previous_top) ? p.upgrade.previous_top : [];
    if (prevTop.length > 0) {
      L.push('| prior pair (A x B) | in new embedded ranked |');
      L.push('| ------------------ | ---------------------- |');
      for (let i = 0; i < prevTop.length; i += 1) {
        const pt = prevTop[i];
        L.push('| ' + pt.a + ' x ' + pt.b + ' | ' + (newSet.has(pt.a + '|' + pt.b) ? 'yes' : 'no (demoted/absent)') + ' |');
      }
      L.push('');
    }
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
  L.push('verification it did not obtain. On LIVE runs a bounded async pass then resolves each');
  L.push('pending verdict against the real Phase 212 critic (GAP-1 fix): a resolved pass is BANKED,');
  L.push('a resolved fail is NOT BANKED (with the verdict named), and anything the pass cannot');
  L.push('genuinely resolve stays honestly pending.');
  L.push('');
  if (ctx.statements.length === 0) {
    L.push('_No statement candidates this run._');
    L.push('');
  } else {
    for (let i = 0; i < ctx.statements.length; i += 1) {
      const s = ctx.statements[i];
      // Three honest states (GAP-1): banked on a resolved pass; still pending
      // (sync degrade, offline run, or an unresolvable async pass); or
      // RESOLVED-BUT-FAILED -- the critic really looked and said no, which is
      // information, not a pending state.
      let state;
      if (s.statement.banked) {
        state = 'BANKED (critic ' + (typeof s.statement.critic === 'object' && s.statement.critic
          ? (s.statement.critic.verdict || 'pass') : 'pass') + ')';
      } else if (s.statement.critic === 'pending') {
        state = 'NOT YET BANKED (critic pending)';
      } else {
        const v = (typeof s.statement.critic === 'object' && s.statement.critic)
          ? (s.statement.critic.verdict || s.statement.critic.route || s.statement.critic.tag || 'fail')
          : String(s.statement.critic);
        state = 'NOT BANKED (critic resolved: ' + v + ')';
      }
      L.push('### ' + (i + 1) + '. rank ' + s.pair.rank + ' -- ' + s.pair.idA + ' x ' + s.pair.idB
        + (s.tailFlag ? ' [WEAK-SIGNAL TAIL]' : ''));
      L.push('');
      L.push(s.statement.text);
      L.push('');
      // SEED req 1: the mode label is render-visible on BOTH paths (embedded here,
      // reasoning in renderReasoningReport).
      L.push('- Mode: embedded');
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
// Phase 226-02: the reasoning-mode render (a sibling of renderReport, NOT a
// duplicate of the embedded tables). It leads with the confidence caveat, shows
// the ONE surviving number (lsa_similarity), and NEVER renders a differential /
// semantic / AHP score column (a fabricated-number column is the D1 lie in render
// form). D6: every row it renders must be mode:'reasoning' (asserted below).
// ---------------------------------------------------------------------------

function renderReasoningReport(ctx) {
  const L = [];
  const p = ctx.provenance || {};
  const ranked = Array.isArray(ctx.ranked) ? ctx.ranked : [];
  const statements = Array.isArray(ctx.statements) ? ctx.statements : [];

  // D6 never-merge guard (one line, in code): this render only ever shows
  // reasoning-mode rows; an embedded row here would be a merged-list bug.
  for (let i = 0; i < ranked.length; i += 1) {
    if (ranked[i].mode !== 'reasoning') {
      throw new Error('renderReasoningReport: ranked row ' + i + " is not mode:'reasoning' (D6 never-merge)");
    }
  }
  for (let i = 0; i < statements.length; i += 1) {
    if (statements[i].mode !== 'reasoning') {
      throw new Error('renderReasoningReport: statement row ' + i + " is not mode:'reasoning' (D6 never-merge)");
    }
  }

  L.push('# Phase 226 Eureka Portfolio Report (reasoning mode)');
  L.push('');

  // -- The PROMINENT caveat block, FIRST, before provenance (the anti-overconfidence
  //    antidote: stated once, up front, never a footer). Names all five elements. --
  L.push('## Read this first (reasoning-mode caveat)');
  L.push('');
  L.push('1. This is a REASONING-MODE result: lower confidence BY BASIS, not a verdict. The pairs');
  L.push('   below are a short working diagnosis, not a finished ranked list.');
  L.push('2. WHY the basis is weak: the embedding encoder was unavailable (degrade cause: `'
    + String(p.degrade_cause) + '`), so 2 of the critic\'s 3 numeric legs (differential_score and');
  L.push('   semantic_similarity) are structurally null. Only the lexical overlap (Jaccard,');
  L.push('   lsa_similarity) is a real number here.');
  L.push('3. The analogy bar was NOT lowered: the SAME six-item structure-mapping rubric ran twice');
  L.push('   (neutral + adversarial) and the verdict was computed by code, exactly as embedded mode.');
  L.push('4. Nothing here is banked or confirmed. Acting on any pair is a human decision (Canon Part 9:');
  L.push('   human-only promotion); banked is false on every row.');
  L.push('5. Re-running after the encoder is installed upgrades this room to embedded mode and shows');
  L.push('   the reasoning -> embedded delta, rather than silently replacing this result.');
  L.push('');

  // -- Provenance (reusing the renderReport table idiom, reasoning fields only). --
  L.push('## Provenance');
  L.push('');
  L.push('| Field | Value |');
  L.push('| ----- | ----- |');
  L.push('| Run mode | ' + p.run_mode + ' |');
  L.push('| Degrade cause | ' + p.degrade_cause + ' |');
  L.push('| Formula version | ' + p.formula_version + ' |');
  L.push('| Entries read | ' + p.entries_read + ' |');
  L.push('| Pairs considered / sent / cap | ' + p.pairs_considered + ' / ' + p.pairs_sent + ' / ' + p.reasoning_cap + ' |');
  L.push('| Rejected by rubric (pseudoscience / restatement / general_shallow) | '
    + (p.pairs_rejected_by_rubric ? p.pairs_rejected_by_rubric.pseudoscience : 'n/a') + ' / '
    + (p.pairs_rejected_by_rubric ? p.pairs_rejected_by_rubric.restatement : 'n/a') + ' / '
    + (p.pairs_rejected_by_rubric ? p.pairs_rejected_by_rubric.general_shallow : 'n/a') + ' |');
  L.push('| Banking | ' + p.banking + ' |');
  L.push('| Run date | ' + p.run_date + ' |');
  L.push('');

  // -- Ranked (reasoning mode). NEVER a differential / semantic / AHP score column. --
  L.push('## Ranked top ' + ctx.top + ' (reasoning mode)');
  L.push('');
  L.push('Ordered ascending by lexical overlap. LOW lexical overlap on a pair the rubric still');
  L.push('cleared is the eureka signature: shared meaning the vocabulary hides.');
  L.push('');
  if (ranked.length === 0) {
    L.push('_No pair cleared the two-pass rubric this run (an honest short/empty reasoning result)._');
    L.push('');
  } else {
    L.push('| rank | pair (A x B) | lsa_similarity | verdict | mode |');
    L.push('| ---- | ------------ | -------------- | ------- | ---- |');
    for (let i = 0; i < ranked.length; i += 1) {
      const r = ranked[i];
      L.push('| ' + r.rank
        + ' | ' + truncate(String(r.a_title || r.a), 30) + ' x ' + truncate(String(r.b_title || r.b), 30)
        + ' | ' + fmt(r.lsa_similarity, 3)
        + ' | ' + r.verdict
        + ' | ' + r.mode
        + ' |');
    }
    L.push('');
  }

  // -- Statements: each text with its mode + banked:false visible. --
  L.push('## Statements');
  L.push('');
  if (statements.length === 0) {
    L.push('_No statement candidates this run._');
    L.push('');
  } else {
    for (let i = 0; i < statements.length; i += 1) {
      const s = statements[i];
      L.push('### ' + (i + 1) + '. rank ' + s.rank + ' -- ' + s.a + ' x ' + s.b);
      L.push('');
      L.push(s.text);
      L.push('');
      L.push('| Field | Value |');
      L.push('| ----- | ----- |');
      L.push('| Mode | ' + s.mode + ' |');
      L.push('| Banked | ' + String(s.banked) + ' |');
      L.push('| Critic verdict | ' + s.critic + ' |');
      L.push('| lsa_similarity (' + s.lexical_method + ') | ' + fmt(s.lsa_similarity, 3) + ' |');
      L.push('| Potential | ' + s.potential_tier + ' |');
      L.push('');
    }
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

  // Phase 226-02 stage dispatch (TOP of main, before the AHP load): the emit and
  // score stages read the workdir a genuine degrade run already seeded; neither
  // opens the encoder nor re-runs the embedded pipeline (SEED req 7: additive).
  if (opts.reasoningEmit) return reasoningStageEmit(opts);
  if (opts.reasoningScore) return reasoningStageScore(opts);

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
    // Phase 226-02 degrade-test seam: forward _forceUnavailable ONLY when the flag
    // is set, so an unset run passes undefined and stays byte-identical (the plan-01
    // tri-modal forwarding). Set -> idx.embedded !== true even on a model-cached box.
    const idx = await triModal.indexNodes(db, {
      encodeFn: encodeFn,
      roomDir: roomDir,
      _forceUnavailable: opts.forceEncoderUnavailable ? true : undefined,
    });

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
      // even same-type/same-root (the DG-2 cited-signal spirit) EXCEPT when both
      // endpoints are scaffold types: those are caught by the post-enumeration
      // both-scaffold exclusion below (quick task 260715-0nj). This exception is
      // honest per the 260714-hzx finding that the 39-node memory_artifact
      // CONVERGES clique refills the top-25 whenever the entity cohort thins, so
      // a cited scaffold-vs-scaffold edge is document scaffolding, not a signal.
      // Cross-boundary enumeration guarantees non-empty pairs on edge-sparse
      // rooms. Edge pairs are pushed FIRST so their shared_problems survive the
      // unordered dedupe.
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

    // (4b) Both-scaffold candidate-pair exclusion (quick task 260715-0nj). A
    // single post-enumeration pass, chosen over per-mode inline checks so ALL
    // THREE modes (graph, full, room) are covered at exactly one insertion
    // point. A pair is excluded when BOTH endpoints are members of
    // SCAFFOLD_NODE_TYPES (memory_artifact / Artifact) - structural scaffolding,
    // never a real cross-domain opportunity (the opportunity-harvest.cjs
    // lines 519-521 precedent, extended to the ranking candidate set). Pairs
    // with only ONE scaffold side are NOT touched (narrow scope, per the
    // 260714-hzx disposition). Both endpoints are always present in `indexed`
    // for scoreable pairs, but guard defensively: a missing indexed entry means
    // the pair is NOT treated as scaffold. Exclusions are counted honestly and
    // surfaced in provenance (never a silent suppression).
    let scaffoldPairsExcluded = 0;
    const filteredPairs = [];
    for (let i = 0; i < pairsToScore.length; i += 1) {
      const cp = pairsToScore[i];
      const na = indexed.get(cp.a);
      const nb = indexed.get(cp.b);
      const aScaffold = !!(na && SCAFFOLD_NODE_TYPES.has(na.type));
      const bScaffold = !!(nb && SCAFFOLD_NODE_TYPES.has(nb.type));
      if (aScaffold && bScaffold) {
        scaffoldPairsExcluded += 1;
        continue;
      }
      filteredPairs.push(cp);
    }

    // (5) + (6) Score each pair; compose the three-dimension AHP score.
    const scored = [];
    let part8Skipped = 0;
    let progress = 0;
    for (let k = 0; k < filteredPairs.length; k += 1) {
      const cp = filteredPairs[k];
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

    // Phase 219 GAP-1 fix: the async critic-resolution pass (the "future
    // async runner" the emitter's sync gate always named). The synchronous
    // emission loop above honestly left every live statement critic 'pending'
    // because the real Phase 212 stageA is async; here, AFTER emission and
    // BEFORE banking, we actually await each pending statement's real verdict
    // under the module's per-statement timeout + batch deadline
    // (MINDRIAN_CRITIC_RESOLVE_TIMEOUT_MS / MINDRIAN_CRITIC_RESOLVE_BATCH_MS;
    // batch 0 = operator kill switch). Anything the pass cannot genuinely
    // resolve stays 'pending'/unbanked -- the ability to resolve is added,
    // the honesty floor is unchanged.
    //
    // OFFLINE runs SKIP resolution on purpose: a verdict computed against the
    // deterministic stub encoder would be fixture-green lying about grounding
    // (the exact GAP-1 failure class), so offline statements stay honestly
    // pending and the offline fixture behavior is byte-identical to pre-fix.
    let resolution = null;
    if (!opts.offline) {
      resolution = await oppmod.resolveCriticVerdicts(
        statements.map(function (s) { return s.statement; }),
        {}
      );
      // Re-sync the ranked rows' banked column with the now-resolved verdicts.
      for (let i = 0; i < statements.length; i += 1) {
        statements[i].pair.banked = statements[i].statement.banked === true;
      }
      process.stdout.write('eureka-portfolio-report: critic resolution - '
        + resolution.resolved + ' resolved (' + resolution.banked + ' passing), '
        + resolution.pending + ' still pending'
        + (resolution.deadline_hit ? ' (batch deadline hit)' : '') + '\n');
    }

    for (let i = 0; i < ranked.length; i += 1) {
      if (typeof ranked[i].banked !== 'boolean') ranked[i].banked = false;
    }

    // Phase 219 REQ-1: bank the statements passing the banking predicate as
    // proposed opportunity nodes (the header deferral, implemented). Reuses
    // the runner's already-open db handle; ONE batch, all-or-nothing. A
    // banking failure never aborts the report (the files still write) - it
    // logs honestly to stderr instead.
    const bank = bankStatements(db, BANK_SESSION_ID, statements);
    if (bank.ok) {
      process.stdout.write('eureka-portfolio-report: banked ' + bank.banked
        + ' opportunity node(s), ' + bank.edges + ' evidence edge(s), '
        + bank.skipped + ' skipped (predicate ' + bank.predicate + ')\n');
    } else {
      process.stderr.write('eureka-portfolio-report: banking pass failed ('
        + bank.reason + (bank.detail ? ': ' + bank.detail : '') + ') - rolled back, report files unaffected\n');
    }

    // Phase 226-02 degrade seeding (SEED req 2: evaluated ONLY after the genuine
    // embedded attempt ran). degradeCause is derived from the SAME booleans the
    // embedded path already computed - idx.embedded and scored.length - never a
    // second gate variable. On a non-null cause it seeds pairs.json + a reasoning
    // provenance block; on a healthy run it is a no-op (degrade_cause null, no
    // workdir written).
    const seed = reasoningStageSeed(opts, { embedded: idx.embedded === true, scoredLength: scored.length });

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
      // Quick task 260715-0nj: how many both-scaffold candidate pairs the filter
      // removed before scoring. Read from the run, never a literal (honest nouns).
      scaffold_pairs_excluded: scaffoldPairsExcluded,
      figure_guard_skipped: part8Skipped,
      // GAP-1: how the pending critic verdicts were (or were not) resolved.
      critic_resolution: opts.offline
        ? 'skipped (offline: a stub-encoder verdict would be fixture-green lying)'
        : (resolution
          ? (resolution.resolved + ' resolved (' + resolution.banked + ' passing) / '
            + resolution.pending + ' pending' + (resolution.deadline_hit ? ' (batch deadline hit)' : ''))
          : 'not run'),
      honest_nouns: (typeof graph.meta.honest_nouns === 'string' && graph.meta.honest_nouns.trim())
        ? graph.meta.honest_nouns.trim()
        : '(none stated in graph meta)',
      encoder_unavailable: idx.embedded !== true,
      run_date: new Date().toISOString().slice(0, 10),
      // Phase 226-02 (D7): name the CAUSE of a degrade, not just the symptom.
      // null on a healthy run (the render then shows no degrade block).
      degrade_cause: seed.degrade_cause,
    };
    // The reasoning next-step block (only when a genuine degrade seeded the workdir).
    if (seed.reasoning) provenance.reasoning = seed.reasoning;

    // Phase 226-02 (SEED req 5), CR-01 fix: called unconditionally now, not just on
    // the embedded success path. If a prior report at jsonPath was written in
    // reasoning mode, surface the reasoning -> current delta instead of silently
    // replacing it - INCLUDING the case where this run is a second degrade
    // (idx.embedded !== true, ranked stays empty). buildUpgradeDelta's own
    // run_mode check is the guard; on a still-degraded run it attaches
    // provenance.upgrade with survived:0 and the prior top-5 pair ids, so the
    // overwrite is disclosed with a trace instead of leaving none. Never throws;
    // no upgrade key on any failure or when the prior file wasn't reasoning-mode.
    buildUpgradeDelta(jsonPath, provenance, ranked);

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
          // SEED req 1: every statement carries its mode; embedded here, 'reasoning'
          // on the fallback writer. The JSON leg of the mandatory-label contract.
          mode: 'embedded',
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

// ---------------------------------------------------------------------------
// Phase 219 REQ-1: the banking pass (the header deferral, implemented).
// ---------------------------------------------------------------------------

// The session id every banked opportunity node mints under. A STABLE constant
// (the entity-extract 'entity-extract' default idiom) so re-running the report
// on the same room UPSERTs the same nodes instead of duplicating them
// (OPPORTUNITY_NODE_ID is keyed on sessionId + name).
const BANK_SESSION_ID = 'eureka-portfolio';

// The three documented predicate values (see the header BANKING PREDICATE
// block). An unrecognized value falls back to 'critic' (the safe default).
const BANK_PREDICATES = ['critic', 'critic+tail', 'all'];

function resolveBankPredicate(explicit) {
  const raw = (typeof explicit === 'string' && explicit)
    ? explicit
    : (process.env.MINDRIAN_OPPORTUNITY_BANK_PREDICATE || 'critic');
  return BANK_PREDICATES.indexOf(raw) === -1 ? 'critic' : raw;
}

// Does this statement entry pass the banking predicate? entry is the in-memory
// statements-loop shape { pair, statement, tailFlag }. NEVER rank-based.
function passesBankPredicate(entry, mode) {
  const st = entry && entry.statement;
  if (!st) return false;
  switch (mode) {
    case 'critic+tail':
      return st.banked === true || entry.tailFlag === true;
    case 'all':
      return st.critic !== 'pending';
    case 'critic':
    default:
      return st.banked === true;
  }
}

// The scaffold node-type family (quick task 260715-0nj). A candidate pair whose
// BOTH endpoints are scaffold nodes (memory_artifact / Artifact) is structural
// document scaffolding, never a real cross-domain opportunity. This is the SAME
// 218 pin lib/core/eureka/opportunity-harvest.cjs lines 519-521 already applies
// to the bridge + contradiction lanes ("a structural restatement of the room,
// not a signal"); this constant extends that established predicate to the
// portfolio ranking candidate set. Provenance: quick task 260714-hzx traced the
// regression this closes - once tier-2 correctly thinned the entity cohort
// (309 -> 46 company nodes), the 39-node memory_artifact CONVERGES clique
// refilled the top-25 (18/25 = 72.0 percent structural share). Frozen so no
// caller can mutate the family at run time.
const SCAFFOLD_NODE_TYPES = Object.freeze(new Set(['memory_artifact', 'Artifact']));

// The 216 field contract (test-216-field-contract.cjs precedent): a banked
// node's props.section must be a REAL domain slug or the honest 'unknown',
// NEVER the ICM node type column leaking through as a pseudo-section. This
// deny-list names the ICM/system type values that must never masquerade as a
// section slug.
const ICM_TYPE_DENY = new Set([
  'section', 'artifact', 'memory_artifact', 'memory_event', 'causalclaim',
  'causal_claim', 'whitespacezone', 'whitespace_zone', 'breakthrough',
  'opportunity', 'company', 'technology', 'market', 'domain', 'subdomain',
  'focus_area', 'frame', 'unknown',
]);

function isRealSectionSlug(v) {
  return typeof v === 'string' && v.length > 0
    && v.indexOf(':') === -1
    && !ICM_TYPE_DENY.has(v.toLowerCase());
}

// Derive props.section for a banked opportunity from its EVIDENCE nodes: the
// pair's techA/techB section fields first (room-native substrate already
// carries the 216 contract), then the evidence nodes' props.section, then the
// source_path first segment (a real room folder slug), else the honest
// 'unknown'. READ-only db access; every WRITE stays behind navigation.
function deriveBankSection(db, entry) {
  const pair = entry.pair || {};
  const candidates = [];
  if (pair.techA && pair.techA.section) candidates.push(pair.techA.section);
  if (pair.techB && pair.techB.section) candidates.push(pair.techB.section);
  for (const id of [pair.idA, pair.idB]) {
    if (typeof id !== 'string' || id.length === 0 || !db) continue;
    let row = null;
    try {
      row = db.prepare('SELECT properties, source_path FROM nodes WHERE id = ?').get(id);
    } catch (_e) { row = null; }
    if (!row) continue;
    try {
      const props = JSON.parse(row.properties || '{}');
      if (props && typeof props.section === 'string') candidates.push(props.section);
    } catch (_e) { /* unreadable props: fall through to source_path */ }
    if (typeof row.source_path === 'string' && row.source_path.indexOf('/') > 0
        && row.source_path.indexOf(':') === -1) {
      candidates.push(row.source_path.split('/')[0]);
    }
  }
  for (const c of candidates) {
    if (isRealSectionSlug(c)) return c;
  }
  return 'unknown';
}

// bankStatements(db, sessionId, statements, opts?) -- the REQ-1 governed write.
//
// statements is the in-memory statements-loop array [{ pair, statement,
// tailFlag }]. ONE explicit BEGIN/COMMIT/ROLLBACK batch (the 218 D-05
// entity-extract shape) mints each entry passing the banking predicate as a
// proposed `opportunity` node via navigation.writeOpportunityNode, then links
// DERIVED_FROM evidence edges to the candidate pair's a and b node ids via
// navigation.linkOpportunityEvidence (the Brain answer names DERIVED_FROM as
// provenance). A failed node or edge write THROWS inside the batch so the
// WHOLE batch rolls back (all-or-nothing); the function itself never throws -
// it returns { ok:false, reason, detail } after ROLLBACK.
//
// Returns { ok:true, banked, edges, skipped, predicate } on success. Exported
// so tests/test-219-banking.cjs drives it hermetically without a eureka run.
function bankStatements(db, sessionId, statements, opts) {
  if (!db || !Array.isArray(statements)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const sid = (typeof sessionId === 'string' && sessionId.length > 0) ? sessionId : BANK_SESSION_ID;
  const mode = resolveBankPredicate(opts && opts.predicate);
  let banked = 0;
  let edges = 0;
  let skipped = 0;
  try {
    db.exec('BEGIN');
  } catch (e) {
    return { ok: false, reason: 'begin_failed', detail: String(e.message || '').slice(0, 80) };
  }
  try {
    for (const entry of statements) {
      if (!passesBankPredicate(entry, mode)) { skipped += 1; continue; }
      const pair = entry.pair || {};
      const st = entry.statement || {};
      const titleA = (pair.techA && pair.techA.title) || pair.idA || '';
      const titleB = (pair.techB && pair.techB.title) || pair.idB || '';
      const name = (titleA && titleB) ? (titleA + ' x ' + titleB) : (titleA || titleB);
      const section = deriveBankSection(db, entry);
      const fields = st.fields || {};
      const w = navigation.writeOpportunityNode(db, {
        name: name,
        sessionId: sid,
        lifecycle: 'candidate',
        jtbd: typeof fields.audience === 'string' ? fields.audience : undefined,
        score: typeof pair.score === 'number' ? pair.score : undefined,
        section: section,
        actor: 'system',
        reason: 'eureka statement banked (predicate ' + mode + ')',
        evidence_ids: [pair.idA, pair.idB].filter(function (x) { return typeof x === 'string' && x.length > 0; }),
        formula_version: 'eureka-critic-v1',
        extraProps: {
          statement_text: typeof st.text === 'string' ? st.text : '',
          potential_tier: typeof fields.potential_tier === 'string' ? fields.potential_tier : '',
          critic: typeof st.critic === 'string' ? st.critic : 'resolved',
          rank: typeof pair.rank === 'number' ? pair.rank : null,
          tail_flag: entry.tailFlag === true,
          bank_predicate: mode,
        },
      });
      if (!w || w.ok !== true) {
        throw new Error('bank write failed: ' + ((w && w.reason) || 'unknown') + ' for "' + String(name).slice(0, 60) + '"');
      }
      banked += 1;
      // DERIVED_FROM provenance edges to the candidate pair's a and b nodes.
      for (const targetId of [pair.idA, pair.idB]) {
        if (typeof targetId !== 'string' || targetId.length === 0) continue;
        const r = navigation.linkOpportunityEvidence(db, {
          opportunity_id: w.node_id,
          target_id: targetId,
          edge_type: 'DERIVED_FROM',
          properties: { relation: 'derived_from', opportunity_node: w.node_id },
        });
        if (!r || r.ok !== true) {
          throw new Error('bank edge failed: ' + ((r && r.reason) || 'unknown') + ' -> ' + targetId);
        }
        edges += 1;
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_e) { /* already rolled back */ }
    return { ok: false, reason: 'banking_batch_failed', detail: String(err && err.message ? err.message : err).slice(0, 120) };
  }
  return { ok: true, banked: banked, edges: edges, skipped: skipped, predicate: mode };
}

// ---------------------------------------------------------------------------
// Phase 226-02: the mode:reasoning fallback branch (encoder-free).
//
// Three stages mirror the eureka-critic-run.cjs --emit-prompts / --score split (a
// CLI cannot judge itself): (1) the NORMAL run's degrade SEED writes pairs.json
// when the genuine embedded attempt proved idx.embedded !== true or scored 0
// pairs; (2) --reasoning-emit reads the session-written mappings.json and writes
// rubric prompts; (3) --reasoning-score replays the session answers through the
// REAL critic rubric and writes the SAME { provenance, ranked, tail, statements }
// md+json pair, labeled mode:reasoning with honest-null encoder legs.
// ---------------------------------------------------------------------------

// Resolve the reasoning-stage paths from opts once (roomDir, workdir, mappings,
// answers, and the SAME default report locations the embedded run writes so the
// eureka-command report subcommand reads them unchanged - byte-parity of location).
function resolveReasoningPaths(opts) {
  const roomDir = path.isAbsolute(opts.db) ? opts.db : path.join(REPO_ROOT, opts.db);
  const workdir = opts.reasoningWorkdir
    ? (path.isAbsolute(opts.reasoningWorkdir) ? opts.reasoningWorkdir : path.join(REPO_ROOT, opts.reasoningWorkdir))
    : path.join(roomDir, '.mindrian', 'eureka', 'reasoning');
  const mappingsPath = opts.mappings
    ? (path.isAbsolute(opts.mappings) ? opts.mappings : path.join(REPO_ROOT, opts.mappings))
    : path.join(workdir, 'mappings.json');
  const answersPath = opts.answers
    ? (path.isAbsolute(opts.answers) ? opts.answers : path.join(REPO_ROOT, opts.answers))
    : path.join(workdir, 'answers.json');
  const outPath = path.isAbsolute(opts.out) ? opts.out : path.join(REPO_ROOT, opts.out);
  const jsonPath = path.isAbsolute(opts.json) ? opts.json : path.join(REPO_ROOT, opts.json);
  return {
    roomDir: roomDir, workdir: workdir, mappingsPath: mappingsPath,
    answersPath: answersPath, outPath: outPath, jsonPath: jsonPath,
  };
}

// reasoningStageSeed(opts, ctx) -- the degrade entry, called from the NORMAL run
// AFTER the scoring loop and BEFORE provenance assembly. ctx = { embedded,
// scoredLength }, both taken from the values the embedded path already computed
// (no second gate variable). Returns { degrade_cause } (null on a healthy run,
// nothing written) or { degrade_cause, reasoning } after seeding pairs.json.
function reasoningStageSeed(opts, ctx) {
  const embedded = !!(ctx && ctx.embedded === true);
  const scoredLength = ctx && Number.isFinite(ctx.scoredLength) ? ctx.scoredLength : 0;
  // The cause code (D7): the encoder never ran, or it ran and scored nothing.
  let degradeCause = null;
  if (!embedded) degradeCause = 'encoder_unavailable';
  else if (scoredLength === 0) degradeCause = 'below_floor';
  if (degradeCause === null) {
    // CR-02 fix: a healthy embedded run supersedes any earlier degrade. Delete a
    // stale pairs.json left by a PRIOR degrade so reasoningStageEmit/reasoningStageScore's
    // existing "no pairs.json" guard naturally fires if the reasoning stages are
    // re-run afterward, instead of silently scoring a stale pair-set that could
    // overwrite this healthy (possibly already-banked) report.
    const staleP = resolveReasoningPaths(opts);
    const stalePairsPath = path.join(staleP.workdir, 'pairs.json');
    if (fs.existsSync(stalePairsPath)) {
      try { fs.unlinkSync(stalePairsPath); } catch (_e) { /* best-effort cleanup, never block a healthy run */ }
    }
    return { degrade_cause: null };
  }

  const paths = resolveReasoningPaths(opts);
  const pairsPath = path.join(paths.workdir, 'pairs.json');

  // CR-03 fix: don't reseed out from under an in-progress session. If mappings,
  // answers, or a prompts manifest already exist in this workdir alongside an
  // existing pairs.json, a navigator is mid-session against the CURRENT
  // pairs.json P000N ids - regenerating now (e.g. content changed between two
  // `run` invocations) can silently reassign those ids, orphaning whatever the
  // navigator already wrote. Skip re-seeding (idempotent no-op) and report the
  // existing session state instead.
  const promptsManifestPath = path.join(paths.workdir, 'prompts', 'manifest.json');
  const inProgress = fs.existsSync(pairsPath)
    && (fs.existsSync(paths.mappingsPath) || fs.existsSync(paths.answersPath) || fs.existsSync(promptsManifestPath));
  if (inProgress) {
    let existing;
    try {
      existing = JSON.parse(fs.readFileSync(pairsPath, 'utf8'));
    } catch (_e) {
      existing = { candidates: [] };
    }
    return {
      degrade_cause: degradeCause,
      reasoning: {
        state: 'await_mappings (in-progress session preserved - pairs.json NOT regenerated)',
        workdir: paths.workdir,
        pairs_selected: Array.isArray(existing.candidates) ? existing.candidates.length : 0,
        next_step: 'write mappings.json then run --reasoning-emit',
      },
    };
  }

  const entries = reasoningMode.readRoomMarkdown(paths.roomDir);
  const proposed = reasoningMode.proposeCandidatePairs(entries, {});
  fs.mkdirSync(paths.workdir, { recursive: true });
  const pairsDoc = {
    generated_at: new Date().toISOString(),
    degrade_cause: degradeCause,
    cap: proposed.cap,
    entries_read: entries.length,
    pairs_considered: proposed.pairs_considered,
    candidates: proposed.candidates,
  };
  fs.writeFileSync(pairsPath, JSON.stringify(pairsDoc, null, 2) + '\n', 'utf8');
  return {
    degrade_cause: degradeCause,
    reasoning: {
      state: 'await_mappings',
      workdir: paths.workdir,
      pairs_selected: proposed.candidates.length,
      next_step: 'write mappings.json then run --reasoning-emit',
    },
  };
}

// reasoningStageEmit(opts) -- stage 2. Read pairs.json (SEED req 2 guard: exit 1
// if it is absent, meaning no genuine degrade ran first), validate the
// session-written mappings, write the rubric prompt files, print the next step.
function reasoningStageEmit(opts) {
  const paths = resolveReasoningPaths(opts);
  const pairsPath = path.join(paths.workdir, 'pairs.json');
  if (!fs.existsSync(pairsPath)) {
    process.stderr.write('eureka-portfolio-report --reasoning-emit: no pairs.json at ' + pairsPath + '\n');
    process.stderr.write('Reasoning mode is entered ONLY after a genuine embedded run degraded (SEED req 2:\n');
    process.stderr.write('never speculative). Run the normal report first so a real encoder_unavailable / below_floor attempt seeds pairs.json.\n');
    return 1;
  }
  const pairsDoc = JSON.parse(fs.readFileSync(pairsPath, 'utf8'));
  const mappings = fs.existsSync(paths.mappingsPath) ? JSON.parse(fs.readFileSync(paths.mappingsPath, 'utf8')) : {};
  const validation = reasoningMode.validateMappings(Array.isArray(pairsDoc.candidates) ? pairsDoc.candidates : [], mappings);
  const promptsDir = path.join(paths.workdir, 'prompts');
  const manifest = reasoningMode.emitReasoningPrompts(promptsDir, validation.valid);
  const emitted = manifest.candidates.filter(function (c) { return c.stage_a_pass === true; }).length;
  process.stdout.write('eureka-portfolio-report --reasoning-emit: '
    + validation.valid.length + ' mapped pair(s) (' + validation.excluded_count + ' excluded for missing/invalid mapping), '
    + emitted + ' rubric prompt set(s) written to ' + promptsDir + '\n');
  process.stdout.write('Next: answer each <id>.neutral.txt and <id>.adversarial.txt faithfully into answers.json,\n');
  process.stdout.write('then run: --reasoning-score --answers ' + paths.answersPath + ' --reasoning-workdir ' + paths.workdir + '\n');
  return 0;
}

// reasoningStageScore(opts) -- stage 3. Replay the session answers through the
// REAL rubric (verdict-by-code), assemble the byte-parity report, and write it.
async function reasoningStageScore(opts) {
  const paths = resolveReasoningPaths(opts);
  const pairsPath = path.join(paths.workdir, 'pairs.json');
  const promptsDir = path.join(paths.workdir, 'prompts');
  const manifestPath = path.join(promptsDir, 'manifest.json');
  if (!fs.existsSync(pairsPath)) {
    process.stderr.write('eureka-portfolio-report --reasoning-score: no pairs.json at ' + pairsPath
      + ' (run the normal degrade + --reasoning-emit first)\n');
    return 1;
  }
  const pairsDoc = JSON.parse(fs.readFileSync(pairsPath, 'utf8'));
  const mappings = fs.existsSync(paths.mappingsPath) ? JSON.parse(fs.readFileSync(paths.mappingsPath, 'utf8')) : {};
  const answers = fs.existsSync(paths.answersPath) ? JSON.parse(fs.readFileSync(paths.answersPath, 'utf8')) : {};
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { candidates: [] };
  const validation = reasoningMode.validateMappings(Array.isArray(pairsDoc.candidates) ? pairsDoc.candidates : [], mappings);

  const rows = await reasoningMode.scoreReasoningPairs(validation.valid, answers, {});

  // Max-1-retry latch (AI-SPEC 4b): if ANY candidate came back with a
  // missing/garbled answer AND the manifest has not yet spent its one retry,
  // stamp retry_used, name the pairs, and exit 2 (a distinct retriable code).
  // On a second failure we proceed with the bias-to-reject default, never guess.
  const missing = rows.filter(function (r) { return r.judge_answer_missing === true; });
  if (missing.length > 0 && manifest.retry_used !== true) {
    manifest.retry_used = true;
    // WR-01 fix: if --reasoning-score is run before --reasoning-emit ever created
    // <workdir>/prompts/, manifestPath's parent directory does not exist yet and
    // this write would throw a synchronous ENOENT with no surrounding try/catch
    // (see the top-level .catch() added below as the second half of this fix).
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    process.stderr.write('eureka-portfolio-report --reasoning-score: missing/garbled answers for pair id(s): '
      + missing.map(function (r) { return r.id; }).join(', ') + '\n');
    process.stderr.write('Re-answer ONLY those pairs faithfully into answers.json, then re-run --reasoning-score (one retry allowed).\n');
    return 2;
  }

  // Ranking rule (plan 01 core): transferable rows only, ascending by
  // lsa_similarity (LOW overlap on a still-plausible pair is the eureka signature),
  // capped by --top. rank = index + 1.
  const cap = Number.isFinite(opts.top) && opts.top > 0 ? opts.top : 25;
  const transferable = rows
    .filter(function (r) { return r.verdict === 'transferable'; })
    .slice()
    .sort(function (x, y) { return x.lsa_similarity - y.lsa_similarity; })
    .slice(0, cap);

  const statements = transferable.map(function (r, i) { return reasoningMode.buildReasoningStatement(r, i + 1); });
  const ranked = transferable.map(function (r, i) {
    return {
      // The exact embedded ranked field NAMES survive; the encoder-derived numbers
      // are honest-null (no fabricated score / dims - D2's no-blended-score rule).
      rank: i + 1,
      a: r.a,
      b: r.b,
      a_title: r.title_a,
      b_title: r.title_b,
      score: null,
      dims: null,
      weak_a: [],
      weak_b: [],
      complementary: false,
      tail_flag: false,
      banked: false,
      mode: 'reasoning',
      lsa_similarity: r.lsa_similarity,
      verdict: r.verdict,
      reasoning_tag: r.reasoning_tag,
      differential_score: null,
      semantic_similarity: null,
    };
  });

  // Rubric-rejection accounting (per class) + the encoder-free Gate 1 trip count.
  const pairsRejectedByRubric = { pseudoscience: 0, restatement: 0, general_shallow: 0 };
  let gate1Trips = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].stage_a_pass === false) gate1Trips += 1;
    const v = rows[i].verdict;
    if (v === 'pseudoscience') pairsRejectedByRubric.pseudoscience += 1;
    else if (v === 'restatement') pairsRejectedByRubric.restatement += 1;
    else if (v === 'general_shallow') pairsRejectedByRubric.general_shallow += 1;
  }
  // pairs_sent = candidates actually rubric-scored (a Gate-1 trip never reaches the
  // rubric, so it is not counted as sent).
  const pairsSent = rows.filter(function (r) { return r.stage_a_pass === true; }).length;

  const provenance = {
    // Every key the embedded provenance object carries (lines ~975-1012), with
    // honest reasoning-mode values, so no existing consumer breaks (D4/G-5).
    run_mode: 'reasoning',
    pairs_mode: opts.pairs,
    encoder_model: 'none (reasoning mode)',
    encoder_dtype: 'none',
    vec_backend: 'none',
    ahp_weights: null,
    ahp_cr: null,
    ahp_matrix_source: 'not used (reasoning mode)',
    tail_composition: 'not computed (reasoning mode: no cohort axes without the embedded index)',
    growth_proxy: 'none',
    tail_thresholds: null,
    tail_insufficient_structure: true,
    tail_suspect_noise: false,
    cohort_techs: 0,
    graph_nodes: 0,
    converges_pairs: 0,
    pairs_scored: pairsSent,
    scaffold_pairs_excluded: 0,
    figure_guard_skipped: gate1Trips,
    critic_resolution: 'reasoning rubric (verdict-by-code)',
    honest_nouns: '(none: raw-markdown substrate)',
    encoder_unavailable: true,
    run_date: new Date().toISOString().slice(0, 10),
    // Reasoning-mode extensions.
    degrade_cause: pairsDoc.degrade_cause,
    formula_version: reasoningMode.REASONING_FORMULA_VERSION,
    reasoning_cap: pairsDoc.cap,
    pairs_considered: pairsDoc.pairs_considered,
    pairs_sent: pairsSent,
    pairs_rejected_by_rubric: pairsRejectedByRubric,
    entries_read: pairsDoc.entries_read,
    // BANKING HARD-SKIP (G-3): the reasoning path NEVER calls bankStatements - not
    // even with the default predicate - because MINDRIAN_OPPORTUNITY_BANK_PREDICATE=all
    // would otherwise bank a non-pending reasoning verdict (the exact G-3 breach
    // vector). Part 9 promotion is human-only; there is no write-back call site below.
    banking: 'skipped (reasoning mode: Part 9 human-only promotion)',
  };

  const jsonOut = {
    provenance: provenance,
    ranked: ranked,
    tail: {
      composition: 'not computed (reasoning mode: no cohort axes without the embedded index)',
      growth_proxy: 'none',
      insufficient_structure: true,
      suspect_noise: false,
      thresholds: null,
      items: [],
    },
    statements: statements,
  };

  // G-1 ENFORCEMENT AT THE WRITER: a deterministic node:assert (never a judge call)
  // that refuses the emit if any encoder leg is non-null, banked is true, or the
  // mode label is lost. Called immediately before BOTH fs.writeFileSync calls.
  const report = renderReasoningReport({
    provenance: provenance,
    roomDir: opts.db,
    top: cap,
    ranked: ranked,
    statements: statements,
  });
  reasoningMode.assertReasoningInvariants(jsonOut);
  fs.mkdirSync(path.dirname(paths.outPath), { recursive: true });
  fs.writeFileSync(paths.outPath, report, 'utf8');

  reasoningMode.assertReasoningInvariants(jsonOut);
  fs.mkdirSync(path.dirname(paths.jsonPath), { recursive: true });
  fs.writeFileSync(paths.jsonPath, JSON.stringify(jsonOut, null, 2) + '\n', 'utf8');

  process.stdout.write('eureka-portfolio-report --reasoning-score: wrote ' + paths.outPath + ' + ' + paths.jsonPath
    + ' (mode reasoning, ' + ranked.length + ' ranked, ' + statements.length + ' statements, '
    + pairsSent + ' rubric-scored, cause ' + provenance.degrade_cause + ')\n');
  return 0;
}

// buildUpgradeDelta(jsonPath, provenance, rankedRows) -- SEED req 5. On the
// EMBEDDED success path, if the prior report on disk was written in reasoning
// mode, attach a provenance.upgrade delta (what survived into the new embedded
// ranked list, what did not) instead of silently replacing it. Any read/parse
// failure is a no-op (no upgrade key, byte-identical); never throws.
function buildUpgradeDelta(jsonPath, provenance, rankedRows) {
  let prev;
  try {
    prev = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (_e) {
    return; // no prior file / unreadable / unparseable -> byte-identical, no key
  }
  if (!prev || !prev.provenance || prev.provenance.run_mode !== 'reasoning') return;
  const prevStatements = Array.isArray(prev.statements) ? prev.statements : [];
  const previousTop = prevStatements.slice(0, 5).map(function (s) { return { a: s.a, b: s.b }; });
  const newSet = new Set();
  const rr = Array.isArray(rankedRows) ? rankedRows : [];
  for (let i = 0; i < rr.length; i += 1) {
    newSet.add(rr[i].idA + '|' + rr[i].idB);
    newSet.add(rr[i].idB + '|' + rr[i].idA);
  }
  let survived = 0;
  for (let i = 0; i < previousTop.length; i += 1) {
    if (newSet.has(previousTop[i].a + '|' + previousTop[i].b)) survived += 1;
  }
  provenance.upgrade = {
    previous_run_mode: 'reasoning',
    previous_run_date: prev.provenance.run_date,
    previous_top: previousTop,
    survived: survived,
    demoted_or_absent: previousTop.length - survived,
  };
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code); }, function (err) {
    // WR-01 fix: the --reasoning-emit/--reasoning-score stage dispatch (line ~806)
    // returns BEFORE main()'s own try/catch, so a throw on either path (e.g. an
    // ENOENT from a missing workdir) was previously an unhandled promise rejection
    // / hard crash. Degrade to the same clean-exit-code pattern main()'s own catch
    // uses, instead of a stack trace.
    process.stderr.write('eureka-portfolio-report FAILED: ' + String(err && err.message ? err.message : err) + '\n');
    process.exit(1);
  });
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
  // Phase 219 REQ-1: exported so tests/test-219-banking.cjs drives the banking
  // pass hermetically without a full eureka run.
  bankStatements: bankStatements,
  resolveBankPredicate: resolveBankPredicate,
  deriveBankSection: deriveBankSection,
  BANK_SESSION_ID: BANK_SESSION_ID,
  // Phase 226-02: the reasoning-mode stages, exported so the hermetic tests drive
  // them without a full CLI spawn.
  reasoningStageSeed: reasoningStageSeed,
  reasoningStageEmit: reasoningStageEmit,
  reasoningStageScore: reasoningStageScore,
  buildUpgradeDelta: buildUpgradeDelta,
  renderReasoningReport: renderReasoningReport,
  resolveReasoningPaths: resolveReasoningPaths,
};
