'use strict';
// Phase 372-01 fixture helper: a deterministic omission fixture room, the golden
// call matrix, the top_k tie probe, and the golden capture / compare CLI.
//
// Order of work (decision D9): this helper captures a golden snapshot of every
// PRE-EXISTING getRoomContext result field on the UNMODIFIED source
// (--write-golden), before any change to lib/. After the change, --compare-golden
// proves every pre-existing field, the key order and the prepare count are
// unchanged. The tie probe (D1) decides whether top_k_cap ships.
//
// Reuse before build (Canon Part 7): the schema comes from room-141-fixture.cjs,
// the chain_state type from chain-state.cjs, the cortex list from room-context.cjs.
// House rule: hyphens only, no em-dashes.
//
// Usage:
//   node tests/helpers/fixture-room-372.cjs --write-golden
//   node tests/helpers/fixture-room-372.cjs --compare-golden

const path = require('node:path');
const fs = require('node:fs');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {
  process.stdout.write('SKIP fixture-room-372.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { applySchema, buildFixtureDb } = require(path.join(REPO_ROOT, 'tests', 'fixtures', 'room-141-fixture.cjs'));
const { CHAIN_STATE_NODE_TYPE } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'chain-state.cjs'));
const { getNeighborhood } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'neighborhood.cjs'));
const roomContext = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs'));
const { getRoomContext, CORTEX_NODE_TYPES } = roomContext;

// Every node timestamp is at or below NOW_PIN, so the 90-day recency term of
// NEIGHBORHOOD_SQL clamps to 0 and no score depends on the wall clock.
const NOW_PIN = 1717000000000;
const MARKER_PREFIX = 'OMIT372-';
const SOURCE_TAG = 'omit-372';
const FOCUS_ID = 'section:omit-372';
const CHAIN_FOCUS_ID = 'chain:omit-372:focus';
const RAW_COUNT_DEPTH2 = 16;
const RAW_COUNT_DEPTH1 = 14;
const CHAIN_IN_DEFAULT_TOPK = 3;
const GOLDEN_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '372', 'golden-pre-change.json');
const GUARDED_SOURCES = [
  'lib/core/navigation/room-context.cjs',
  'lib/core/navigation/neighborhood.cjs',
  'lib/mcp/tools/context.cjs',
];

const PRE_EXISTING_TOP_KEYS = ['summary', 'recentMessages', 'relevantNodes', 'cortexNodes', '_meta'];
const PRE_EXISTING_META_KEYS = [
  'seedNodeId', 'fragmentWindow', 'topK', 'maxDepth',
  'legTimingsMs', 'legCostChars', 'legCostTokensApprox', 'estimateOnly',
];

function insertNode(db, n) {
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, ' +
    'created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    n.id, n.type, JSON.stringify(n.properties), SOURCE_TAG, 'system',
    typeof n.confidence === 'number' ? n.confidence : null,
    'proposed', n.created_at, n.created_at, SOURCE_TAG
  );
}

function insertEdge(db, source, target, type) {
  db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)')
    .run(source, target, type, '{}');
}

function buildOmissionFixtureDb() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  let tick = 0;
  const nextTs = () => NOW_PIN - 1000000 + (tick++) * 1000; // distinct, all below NOW_PIN
  const mk = (id, type, label, confidence) => insertNode(db, {
    id, type, confidence, created_at: nextTs(),
    properties: { text: MARKER_PREFIX + label },
  });

  mk(FOCUS_ID, 'section', 'section', 0.8);
  for (let i = 1; i <= 8; i++) {
    mk('claim:tie-' + i, 'claim', 'tie ' + i, 0.5);
    insertEdge(db, FOCUS_ID, 'claim:tie-' + i, 'INFORMS');
  }
  const supConf = [0.61, 0.62, 0.63];
  for (let i = 1; i <= 3; i++) {
    mk('claim:sup-' + i, 'claim', 'support ' + i, supConf[i - 1]);
    insertEdge(db, FOCUS_ID, 'claim:sup-' + i, 'SUPPORTS');
  }
  const chainConf = [0.5, 0.51, 0.52];
  for (let i = 1; i <= 3; i++) {
    mk('chain:omit-372:' + i, CHAIN_STATE_NODE_TYPE, 'chain ' + i, chainConf[i - 1]);
    insertEdge(db, FOCUS_ID, 'chain:omit-372:' + i, 'CONTRADICTS');
  }
  mk('claim:deep-1', 'claim', 'deep 1', 0.55);
  insertEdge(db, 'claim:tie-1', 'claim:deep-1', 'SUPPORTS');
  mk('claim:deep-2', 'claim', 'deep 2', 0.56);
  insertEdge(db, 'claim:sup-1', 'claim:deep-2', 'SUPPORTS');

  // Carve-out record: a chain_state node with no edge from the section.
  mk(CHAIN_FOCUS_ID, CHAIN_STATE_NODE_TYPE, 'chain focus', 0.5);
  insertEdge(db, CHAIN_FOCUS_ID, 'claim:sup-1', 'SOURCED_FROM');
  insertEdge(db, CHAIN_FOCUS_ID, 'chain:omit-372:1', 'FEEDS_INTO');

  // Cortex nodes with fixed created_at values.
  mk('memory:omit-372', 'memory_artifact', 'memory artifact', null);
  mk('thought:omit-372', 'governing_thought', 'governing thought', null);
  mk('decision:omit-372', 'decision', 'decision', null);

  const sess = db.prepare('INSERT INTO sessions (started_at, summary, methodology_used) VALUES (?, ?, ?)')
    .run('2024-05-29T08:00:00Z', MARKER_PREFIX + 'session', SOURCE_TAG);
  const sessionId = Number(sess.lastInsertRowid);
  const frag = db.prepare(
    'INSERT INTO fragments (session_id, role, content, timestamp, section_context) VALUES (?, ?, ?, ?, ?)'
  );
  for (let i = 0; i < 9; i++) {
    const content = i === 3 ? 'OMIT372-LONG ' + 'x'.repeat(500) : 'OMIT372-FRAG ' + i;
    const ts = '2024-05-29T08:00:' + String(10 + i).padStart(2, '0') + 'Z';
    frag.run(sessionId, i % 2 === 0 ? 'user' : 'assistant', content, ts, SOURCE_TAG);
  }
  return db;
}

// Recompute the exported constants from a raw getNeighborhood call. If a number
// differs, fix the fixture, not the constant.
function selfCheckFixture(db) {
  const raw2 = getNeighborhood(db, FOCUS_ID, { topK: 100, maxDepth: 2 });
  const raw1 = getNeighborhood(db, FOCUS_ID, { topK: 100, maxDepth: 1 });
  if (raw2.length !== RAW_COUNT_DEPTH2) throw new Error('RAW_COUNT_DEPTH2 expected ' + RAW_COUNT_DEPTH2 + ' got ' + raw2.length);
  if (raw1.length !== RAW_COUNT_DEPTH1) throw new Error('RAW_COUNT_DEPTH1 expected ' + RAW_COUNT_DEPTH1 + ' got ' + raw1.length);
  const chainIn = raw2.slice(0, 10).filter((r) => r.type === CHAIN_STATE_NODE_TYPE).length;
  if (chainIn !== CHAIN_IN_DEFAULT_TOPK) throw new Error('CHAIN_IN_DEFAULT_TOPK expected ' + CHAIN_IN_DEFAULT_TOPK + ' got ' + chainIn);
  return true;
}

const SEED_LONG = 'S'.repeat(520);
const SEED_FRAGMENTS_MIXED = [
  'plain string one',
  { role: 'assistant', content: 'object fragment two', timestamp: '2024-05-29T09:00:01Z' },
  SEED_LONG,
  { role: 'user', text: 'text-field fragment four' },
  'plain string five',
  { role: 'assistant', content: 'object fragment six ' + 'y'.repeat(100) },
  { role: 'user', content: 'seed seven', section_context: SOURCE_TAG },
  { role: 'user', content: 'seed eight', sectionContext: SOURCE_TAG },
];

const DEFAULT_OPTS = { topK: 10, fragmentWindow: 6, maxDepth: 2, now: NOW_PIN };

const GOLDEN_CALLS = [
  { name: 'default', build: 'omission', opts: Object.assign({}, DEFAULT_OPTS) },
  { name: 'caps_small', build: 'omission', opts: { topK: 4, fragmentWindow: 3, fragmentCharCap: 60, maxDepth: 2, now: NOW_PIN } },
  { name: 'wide', build: 'omission', opts: { topK: 100, fragmentWindow: 50, fragmentCharCap: 4000, maxDepth: 2, now: NOW_PIN } },
  { name: 'depth1', build: 'omission', opts: { topK: 10, maxDepth: 1, now: NOW_PIN } },
  { name: 'estimate', build: 'omission', opts: Object.assign({}, DEFAULT_OPTS, { estimateOnly: true }) },
  {
    name: 'seed_lane', build: 'omission',
    opts: { seedFragments: SEED_FRAGMENTS_MIXED, fragmentWindow: 5, fragmentCharCap: 60, topK: 10, now: NOW_PIN },
  },
  {
    name: 'no_seed', build: 'omission',
    opts: { seedFragments: [{ role: 'user', content: 'no section here' }], topK: 10, now: NOW_PIN },
  },
  { name: 'chain_focus', build: 'omission', opts: { focusNodeId: CHAIN_FOCUS_ID, topK: 10, now: NOW_PIN } },
  { name: 'explicit_focus', build: 'omission', opts: { focusNodeId: 'claim:sup-1', topK: 5, now: NOW_PIN } },
  { name: 'room141_default', build: 'room141', opts: Object.assign({}, DEFAULT_OPTS) },
];

function projectPreExisting(result) {
  const m = result._meta;
  return {
    summary: result.summary,
    recentMessages: result.recentMessages,
    relevantNodes: result.relevantNodes,
    cortexNodes: result.cortexNodes,
    _meta: {
      seedNodeId: m.seedNodeId,
      fragmentWindow: m.fragmentWindow,
      topK: m.topK,
      maxDepth: m.maxDepth,
      legCostChars: m.legCostChars,
      legCostTokensApprox: m.legCostTokensApprox,
      estimateOnly: m.estimateOnly,
    },
  };
}

function countingDb(db, counter) {
  return new Proxy(db, {
    get(target, prop) {
      const v = target[prop];
      if (prop === 'prepare') {
        return function (...args) { counter.n += 1; return target.prepare(...args); };
      }
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}

async function runGoldenCalls() {
  const omissionDb = buildOmissionFixtureDb();
  const calls = {};
  for (const c of GOLDEN_CALLS) {
    const db = c.build === 'room141' ? buildFixtureDb() : omissionDb;
    const counter = { n: 0 };
    const result = await getRoomContext(countingDb(db, counter), 'room-372', c.opts);
    calls[c.name] = {
      projected: projectPreExisting(result),
      prepare_count: counter.n,
      top_keys: Object.keys(result),
      meta_keys: Object.keys(result._meta),
    };
  }
  const sweep = {};
  for (let k = 1; k <= RAW_COUNT_DEPTH2 + 2; k++) {
    const r = await getRoomContext(omissionDb, 'room-372', { focusNodeId: FOCUS_ID, topK: k, maxDepth: 2, now: NOW_PIN });
    sweep['topK_' + k] = {
      topK: r._meta.topK,
      relevantNodes: r.relevantNodes.map((n) => ({ id: n.id, type: n.type, score: n.score })),
    };
  }
  return { calls, sweep };
}

function compareAgainstGolden(golden, run) {
  const diffs = [];
  for (const name of Object.keys(golden.calls)) {
    const g = golden.calls[name];
    const r = run.calls[name];
    if (!r) { diffs.push(name + ': missing from run'); continue; }
    if (JSON.stringify(g.projected) !== JSON.stringify(r.projected)) diffs.push(name + ': projected result differs');
    if (g.prepare_count !== r.prepare_count) diffs.push(name + ': prepare_count ' + g.prepare_count + ' -> ' + r.prepare_count);
    if (JSON.stringify(r.top_keys) !== JSON.stringify(PRE_EXISTING_TOP_KEYS)) diffs.push(name + ': top-level keys ' + JSON.stringify(r.top_keys));
    const okMeta = JSON.stringify(r.meta_keys) === JSON.stringify(PRE_EXISTING_META_KEYS)
      || JSON.stringify(r.meta_keys) === JSON.stringify(PRE_EXISTING_META_KEYS.concat(['omitted']));
    if (!okMeta) diffs.push(name + ': _meta keys ' + JSON.stringify(r.meta_keys));
  }
  for (const name of Object.keys(run.calls)) {
    if (!golden.calls[name]) diffs.push(name + ': not in golden');
  }
  if (JSON.stringify(golden.sweep) !== JSON.stringify(run.sweep)) diffs.push('topk_sweep: relevantNodes differ');
  if (JSON.stringify(golden.pre_existing_top_keys) !== JSON.stringify(PRE_EXISTING_TOP_KEYS)) diffs.push('top key list constant differs from golden');
  if (JSON.stringify(golden.pre_existing_meta_keys) !== JSON.stringify(PRE_EXISTING_META_KEYS)) diffs.push('meta key list constant differs from golden');
  return diffs;
}

// Tie probe (D1). Uses only getNeighborhood, so it also runs after the change.
function probeTieStability(db, focusId, maxDepth) {
  const raw = getNeighborhood(db, focusId, { topK: 100, maxDepth });
  const tiedBoundaries = [];
  for (let k = 1; k < raw.length; k++) {
    if (raw[k - 1].score === raw[k].score) tiedBoundaries.push(k);
  }
  const unstable = [];
  for (let k = 1; k <= raw.length; k++) {
    const atK = JSON.stringify(getNeighborhood(db, focusId, { topK: k, maxDepth }));
    const atK1 = JSON.stringify(getNeighborhood(db, focusId, { topK: k + 1, maxDepth }).slice(0, k));
    if (atK !== atK1) unstable.push(k);
  }
  const ver = db.prepare('select sqlite_version() as v').get();
  return {
    stable: unstable.length === 0,
    tied_boundaries: tiedBoundaries,
    unstable_ks: unstable,
    raw_count: raw.length,
    node_version: process.version,
    sqlite_version: ver && ver.v,
  };
}

function gitText(args) {
  const { execFileSync } = require('node:child_process'); // lazy, CLI only
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

async function cliWriteGolden() {
  if (fs.existsSync(GOLDEN_PATH)) {
    process.stderr.write('REFUSED: golden already exists at ' + GOLDEN_PATH + '\n');
    return 1;
  }
  const blobs = {};
  for (const rel of GUARDED_SOURCES) {
    const work = gitText(['hash-object', rel]);
    const head = gitText(['rev-parse', 'HEAD:' + rel]);
    if (work !== head) {
      process.stderr.write('REFUSED: ' + rel + ' differs from HEAD (' + work + ' vs ' + head + ')\n');
      return 1;
    }
    blobs[rel] = head;
  }
  const db = buildOmissionFixtureDb();
  selfCheckFixture(db);
  const run = await runGoldenCalls();
  const probe2 = probeTieStability(db, FOCUS_ID, 2);
  const probe1 = probeTieStability(db, FOCUS_ID, 1);
  const tieProbe = {
    maxDepth2: probe2,
    maxDepth1: probe1,
    stable: probe2.stable && probe1.stable,
  };
  if (probe2.tied_boundaries.length === 0) {
    process.stderr.write('PROBE VACUOUS: no tied boundary at maxDepth 2\n');
    return 1;
  }
  const out = {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    node_version: process.version,
    sqlite_version: probe2.sqlite_version,
    source_blobs: blobs,
    pre_existing_top_keys: PRE_EXISTING_TOP_KEYS,
    pre_existing_meta_keys: PRE_EXISTING_META_KEYS,
    calls: run.calls,
    sweep: run.sweep,
    tie_probe: tieProbe,
  };
  fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
  fs.writeFileSync(GOLDEN_PATH, JSON.stringify(out, null, 2) + '\n');
  process.stdout.write('GOLDEN WRITTEN ' + path.relative(REPO_ROOT, GOLDEN_PATH) + '\n');
  process.stdout.write(tieProbe.stable
    ? 'BRANCH A: tie probe stable, ship top_k_cap\n'
    : 'BRANCH B: tie probe unstable at k=' + JSON.stringify(probe2.unstable_ks.concat(probe1.unstable_ks)) + ', drop top_k_cap\n');
  return 0;
}

async function cliCompareGolden() {
  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  selfCheckFixture(buildOmissionFixtureDb());
  const run = await runGoldenCalls();
  const diffs = compareAgainstGolden(golden, run);
  if (diffs.length > 0) {
    for (const d of diffs) process.stdout.write('DIFF ' + d + '\n');
    return 1;
  }
  process.stdout.write('GOLDEN COMPARE OK (' + Object.keys(golden.calls).length + ' calls)\n');
  return 0;
}

module.exports = {
  buildOmissionFixtureDb, GOLDEN_CALLS, NOW_PIN, runGoldenCalls, projectPreExisting,
  compareAgainstGolden, probeTieStability, RAW_COUNT_DEPTH2, RAW_COUNT_DEPTH1,
  CHAIN_IN_DEFAULT_TOPK, FOCUS_ID, CHAIN_FOCUS_ID, MARKER_PREFIX, GOLDEN_PATH,
  selfCheckFixture, PRE_EXISTING_TOP_KEYS, PRE_EXISTING_META_KEYS, CORTEX_NODE_TYPES,
};

if (require.main === module) {
  const flag = process.argv[2];
  const fn = flag === '--write-golden' ? cliWriteGolden
    : flag === '--compare-golden' ? cliCompareGolden : null;
  if (!fn) {
    process.stderr.write('usage: fixture-room-372.cjs --write-golden | --compare-golden\n');
    process.exit(2);
  }
  fn().then((code) => process.exit(code), (err) => {
    process.stderr.write('ERROR ' + (err && err.stack || err) + '\n');
    process.exit(1);
  });
}
