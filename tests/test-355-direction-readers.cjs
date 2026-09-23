#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 12 (HIPS-01, D-07) -- readers and duplicates.
 *
 * Task 1: the three duplicate direction-id enums (eureka-critic.cjs,
 * eureka-offer.cjs, grill-engine.cjs) and the eureka_critic zod schema in
 * tool-router.cjs all now source the two wire ids from
 * lib/core/direction-convention.cjs's DIRECTIONS instead of carrying a
 * second copy. eureka-reach-runner.cjs and sensor-eureka.cjs are the two
 * named 355-19 carve-outs (they move with the schema_version bump, not this
 * plan).
 *
 * Task 2: producers that store a direction/innovation label in a room
 * (scripts/hsi-to-graph.cjs) and readers that surface one
 * (lib/core/nl-graph-queries.cjs) never trust the stored string; they
 * re-derive it fresh from the stored similarity pair (or suppress it,
 * REVERSE_SALIENT's innovation_type, unless the edge is rs-engine-sourced)
 * every time. lib/chat/fabric-chat.cjs and scripts/generate-chat-embed.cjs
 * carry the same honesty note in their LLM-facing schema descriptions.
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const hygiene = require('./helpers/hygiene-355.cjs');

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');

const checker = hygiene.makeChecker('test-355-direction-readers');
const { check } = checker;

const d = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const { DIRECTIONS, classify } = d;

// ---------------------------------------------------------------------------
// Task 1: duplicate enums and the eureka_critic zod enum take DIRECTIONS
// (D-07)
// ---------------------------------------------------------------------------

// Leg 1a: static sweep. The only non-comment two-literal direction-id arrays
// left under lib/ are direction-convention.cjs itself (the definition) and
// the two named 355-19 carve-outs.
const TWO_LITERAL_ARRAY =
  /\[\s*['"](?:structural_transfer|semantic_implementation)['"]\s*,\s*['"](?:structural_transfer|semantic_implementation)['"]\s*\]/;

const ALLOWED_ARRAY_HITS = [
  path.join('lib', 'core', 'direction-convention.cjs'), // the definition itself
  path.join('lib', 'core', 'eureka', 'eureka-reach-runner.cjs'), // moves in 355-19
  path.join('lib', 'core', 'sensors', 'sensor-eureka.cjs'), // moves in 355-19
];

function sweepLibForTwoLiteralArrays() {
  const files = hygiene.listFilesRecursive(path.join(REPO, 'lib')).filter((f) => f.endsWith('.cjs'));
  const hits = [];
  for (const abs of files) {
    const lines = hygiene.nonCommentLines(abs);
    for (const line of lines) {
      if (TWO_LITERAL_ARRAY.test(line)) {
        hits.push(path.relative(REPO, abs));
        break;
      }
    }
  }
  return hits;
}

const arrayHits = sweepLibForTwoLiteralArrays();
const unresolvedArrayHits = arrayHits.filter((rel) => ALLOWED_ARRAY_HITS.indexOf(rel) === -1);
check(
  'T1 static: no unresolved two-literal direction-id arrays under lib/ (allowed: direction-convention.cjs + the two 355-19 carve-outs)',
  unresolvedArrayHits.length === 0,
  unresolvedArrayHits.length ? 'unresolved: ' + unresolvedArrayHits.join(', ') : undefined
);
check(
  'T1 static: the two 355-19 carve-outs are still present (unwidened exception list)',
  arrayHits.indexOf(path.join('lib', 'core', 'eureka', 'eureka-reach-runner.cjs')) !== -1 &&
    arrayHits.indexOf(path.join('lib', 'core', 'sensors', 'sensor-eureka.cjs')) !== -1
);

// Leg 1b: each of the four files requires direction-convention.cjs.
const REQUIRING_FILES = [
  path.join('lib', 'core', 'eureka-critic.cjs'),
  path.join('lib', 'core', 'eureka', 'eureka-offer.cjs'),
  path.join('lib', 'core', 'grill-engine.cjs'),
  path.join('lib', 'mcp', 'tool-router.cjs'),
];
for (const rel of REQUIRING_FILES) {
  const abs = path.join(REPO, rel);
  const found = hygiene.nonCommentLines(abs).some((line) => line.indexOf('direction-convention.cjs') !== -1);
  check('T1 ' + rel + ' requires direction-convention.cjs', found);
}

// Leg 1c: eureka-critic.cjs's SURPRISE_TYPES (internal, not exported) is
// exercised indirectly through criticRule's own closed-enum guard: a payload
// carrying each DIRECTIONS member must validate; anything outside DIRECTIONS
// must throw.
{
  const eurekaCritic = require(path.join(REPO, 'lib', 'core', 'eureka-critic.cjs'));
  const tags = eurekaCritic.loadCriticTags();
  const basePayload = {
    differential_score: 0.5,
    semantic_similarity: 0.5,
    lsa_similarity: 0.2,
    source_domain_tag: tags.domain_tags[0],
    target_domain_tag: tags.domain_tags[0],
    rubric_pattern: '000000',
    schema_version: tags.schema_version,
  };
  for (const member of DIRECTIONS) {
    let threw = false;
    try {
      eurekaCritic.criticRule(Object.assign({}, basePayload, { surprise_type: member }));
    } catch (e) {
      threw = true;
    }
    check('T1 eureka-critic criticRule accepts DIRECTIONS member ' + member, threw === false);
  }
  let rejectedNone = false;
  try {
    eurekaCritic.criticRule(Object.assign({}, basePayload, { surprise_type: 'none' }));
  } catch (e) {
    rejectedNone = true;
  }
  check('T1 eureka-critic criticRule rejects a non-DIRECTIONS surprise_type ("none")', rejectedNone === true);
}

// Leg 1d: eureka-offer.cjs's exported DIRECTION_ENUM deep-equals DIRECTIONS.
{
  const eurekaOffer = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-offer.cjs'));
  check(
    'T1 eureka-offer DIRECTION_ENUM === direction-convention DIRECTIONS',
    JSON.stringify(eurekaOffer.DIRECTION_ENUM) === JSON.stringify(DIRECTIONS)
  );
}

// Leg 1e: grill-engine.cjs's internal EUREKA_SURPRISE_TYPES is not exported
// (validateEurekaSignal is the only consumer); the static sweep above is the
// authoritative proof for this file. This is a load-time smoke check only:
// requiring the module must not throw now that it imports
// direction-convention.cjs.
{
  const grillEngine = require(path.join(REPO, 'lib', 'core', 'grill-engine.cjs'));
  check('T1 grill-engine.cjs loads cleanly after importing direction-convention.cjs', typeof grillEngine.runGrill === 'function');
}

// Leg 1f: tool-router.cjs's eureka_critic input schema accepts exactly
// DIRECTIONS for surprise_type, and schema_version is unchanged (still an
// int field, no literal bump).
{
  const router = require(path.join(REPO, 'lib', 'mcp', 'tool-router.cjs'));
  const schemas = {};
  const fakeServer = {
    tool(name, _desc, schema) {
      schemas[name] = schema;
    },
  };
  const fakeRoomDir = path.join(REPO, '__nonexistent_355_readers_probe_room__');
  router.registerRouterTools(fakeServer, fakeRoomDir, REPO, { compact: '' }, 'cli');
  const surpriseTypeSchema = schemas.eureka_critic && schemas.eureka_critic.surprise_type;
  check('T1 tool-router eureka_critic schema captured', !!surpriseTypeSchema);
  if (surpriseTypeSchema) {
    for (const member of DIRECTIONS) {
      const r = surpriseTypeSchema.safeParse(member);
      check('T1 tool-router eureka_critic surprise_type accepts ' + member, r.success === true);
    }
    const rejectNone = surpriseTypeSchema.safeParse('none');
    const rejectBridge = surpriseTypeSchema.safeParse('meaning_bridge');
    check('T1 tool-router eureka_critic surprise_type rejects "none"', rejectNone.success === false);
    check('T1 tool-router eureka_critic surprise_type rejects "meaning_bridge"', rejectBridge.success === false);
  }
  const schemaVersionSchema = schemas.eureka_critic && schemas.eureka_critic.schema_version;
  check('T1 tool-router eureka_critic schema_version field still present (unchanged shape)', !!schemaVersionSchema);
}

// ---------------------------------------------------------------------------
// Task 2: readers re-derive stored labels from the stored pair (D-07)
// ---------------------------------------------------------------------------

const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { openGraph, closeGraph } = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const nlGraphQueries = require(path.join(REPO, 'lib', 'core', 'nl-graph-queries.cjs'));

const HSI_TO_GRAPH_SCRIPT = path.join(REPO, 'scripts', 'hsi-to-graph.cjs');
const AGREEMENT_TEST_SCRIPT = path.join(REPO, 'tests', 'test-355-direction-agreement.cjs');

// mos-355- prefix (never mos-354-, so a leftover from this test is
// unambiguous in a shared /tmp -- T-355-58: always a copy under mkdtemp,
// never the committed 272 fixture room itself).
function makeMos355ScratchRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-' + label + '-'));
  const room = path.join(root, 'room');
  fs.mkdirSync(room, { recursive: true });
  return {
    root,
    room,
    cleanup() {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (_e) {
        // best-effort cleanup
      }
    },
  };
}

async function seedArtifactNodes(roomDir, ids) {
  const graph = await openGraph(roomDir);
  try {
    const stmt = graph.conn.prepare(
      "INSERT INTO nodes (id, type, properties) VALUES (?, 'Artifact', ?) ON CONFLICT(id) DO UPDATE SET properties = excluded.properties"
    );
    for (const id of ids) {
      stmt.run(id, JSON.stringify({ title: id }));
    }
  } finally {
    await closeGraph(graph.db);
  }
}

async function readEdgesOfType(roomDir, type) {
  const graph = await openGraph(roomDir);
  try {
    const rows = graph.conn.prepare('SELECT source, target, properties FROM edges WHERE type = ?').all(type);
    return rows.map((r) => Object.assign({ source: r.source, target: r.target }, JSON.parse(r.properties)));
  } finally {
    await closeGraph(graph.db);
  }
}

async function seedRawEdge(roomDir, source, target, type, properties) {
  const graph = await openGraph(roomDir);
  try {
    graph.conn
      .prepare(
        'INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?) ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties'
      )
      .run(source, target, type, JSON.stringify(properties));
  } finally {
    await closeGraph(graph.db);
  }
}

// Leg 2a/2b: running hsi-to-graph.cjs on a scratch room writes
// HSI_CONNECTION edges whose surprise_type is classify(lsa_sim,
// semantic_sim) for every pair, including pairs whose stored string says the
// opposite (the retired convention), and 'none' for a pair with a missing
// lsa_sim.
async function runLegHsiToGraphWriteTime() {
  const scratch = makeMos355ScratchRoom('write');
  try {
    const pairs = [
      // diff = 0.5 - 0.2 = 0.3 > 0 -> structural_transfer. Stored string is
      // deliberately the WRONG (retired-convention) label.
      { left_id: 'artifact-a', right_id: 'artifact-b', lsa_sim: 0.2, semantic_sim: 0.5, hsi_score: 0.5, surprise_type: 'semantic_implementation', breakthrough_potential: 0.3 },
      // diff = 0.3 - 0.6 = -0.3 <= 0 -> semantic_implementation. Stored
      // string is again deliberately wrong.
      { left_id: 'artifact-c', right_id: 'artifact-d', lsa_sim: 0.6, semantic_sim: 0.3, hsi_score: 0.4, surprise_type: 'structural_transfer', breakthrough_potential: 0.2 },
      // Missing lsa_sim -> must write 'none', never a fabricated direction.
      { left_id: 'artifact-e', right_id: 'artifact-f', lsa_sim: null, semantic_sim: 0.5, hsi_score: 0.4, surprise_type: 'structural_transfer', breakthrough_potential: 0.2 },
    ];
    await seedArtifactNodes(scratch.room, ['artifact-a', 'artifact-b', 'artifact-c', 'artifact-d', 'artifact-e', 'artifact-f']);
    fs.writeFileSync(
      path.join(scratch.room, '.hsi-results.json'),
      JSON.stringify({ metadata: { tier: 1 }, hsi_pairs: pairs, reverse_salients: [] })
    );
    execFileSync(process.execPath, [HSI_TO_GRAPH_SCRIPT, scratch.room], { stdio: 'pipe' });
    const edges = await readEdgesOfType(scratch.room, 'HSI_CONNECTION');
    check('T2 hsi-to-graph writes 3 HSI_CONNECTION edges', edges.length === 3, 'got ' + edges.length);
    for (const pair of pairs) {
      const edge = edges.find((e) => e.source === pair.left_id && e.target === pair.right_id);
      const expected = classify(pair.lsa_sim, pair.semantic_sim);
      check(
        'T2 hsi-to-graph re-derives surprise_type for ' + pair.left_id + '->' + pair.right_id +
          ' (ignores stored "' + pair.surprise_type + '")',
        !!edge && edge.surprise_type === expected,
        edge ? 'got ' + edge.surprise_type + ' expected ' + expected : 'edge not found'
      );
    }
  } finally {
    scratch.cleanup();
  }
}

// Leg 2c/2d: the nl-graph-queries HSI query re-derives surprise_type from
// the stored pair; the REVERSE_SALIENT query returns innovation_type only
// for an rs-engine-sourced edge, null otherwise.
async function runLegNlGraphQueries() {
  const scratch = makeMos355ScratchRoom('query');
  try {
    await seedArtifactNodes(scratch.room, ['artifact-x', 'artifact-y']);
    // diff = 0.5 - 0.2 = 0.3 > 0 -> structural_transfer. Stored string says
    // the opposite on purpose.
    await seedRawEdge(scratch.room, 'artifact-x', 'artifact-y', 'HSI_CONNECTION', {
      hsi_score: 0.5,
      lsa_sim: 0.2,
      semantic_sim: 0.5,
      surprise_type: 'semantic_implementation',
      breakthrough_potential: 0.3,
      tier: 'tier1',
    });

    let graph = await openGraph(scratch.room);
    try {
      const result = nlGraphQueries.executeNLQuery(graph.conn, 'hsi_connections', { min_score: 0 });
      check('T2 nl-graph-queries hsi_connections query executes', !result.error, result.error);
      const row = result.rows && result.rows[0];
      check('T2 nl-graph-queries hsi_connections returns exactly one row', !!row);
      if (row) {
        check(
          'T2 nl-graph-queries hsi_connections re-derives surprise_type (ignores stored "semantic_implementation")',
          row.surprise_type === classify(row.lsa_sim, row.semantic_sim) && row.surprise_type === 'structural_transfer',
          'got ' + row.surprise_type
        );
      }
    } finally {
      await closeGraph(graph.db);
    }

    // The edges table carries no hard FK to nodes (D-169-11), so these
    // Section-id edges need no Section node rows to be readable.
    await seedRawEdge(scratch.room, 'section-a', 'section-b', 'REVERSE_SALIENT', {
      differential_score: 0.4,
      innovation_type: 'structural_transfer',
      source: 'rs-engine',
    });
    await seedRawEdge(scratch.room, 'section-c', 'section-d', 'REVERSE_SALIENT', {
      differential_score: 0.3,
      innovation_type: 'semantic_implementation',
      // no `source` property -- the legacy Section-level, Python/hsi-to-
      // graph.cjs-origin edge shape.
    });

    graph = await openGraph(scratch.room);
    try {
      const result = nlGraphQueries.executeNLQuery(graph.conn, 'reverse_salients', {});
      check('T2 nl-graph-queries reverse_salients query executes', !result.error, result.error);
      const rows = result.rows || [];
      const rsEngineRow = rows.find((r) => r.source === 'section-a');
      const legacyRow = rows.find((r) => r.source === 'section-c');
      check(
        'T2 nl-graph-queries reverse_salients keeps innovation_type for an rs-engine-sourced edge',
        !!rsEngineRow && rsEngineRow.innovation_type === 'structural_transfer',
        rsEngineRow ? 'got ' + rsEngineRow.innovation_type : 'row not found'
      );
      check(
        'T2 nl-graph-queries reverse_salients suppresses innovation_type for a non-rs-engine edge (null)',
        !!legacyRow && legacyRow.innovation_type === null,
        legacyRow ? 'got ' + legacyRow.innovation_type : 'row not found'
      );
    } finally {
      await closeGraph(graph.db);
    }
  } finally {
    scratch.cleanup();
  }
}

// Leg 2e: leg H of tests/test-355-direction-agreement.cjs reports no hit in
// any file this task touched (mirrors the plan's own verify command).
function runLegHNoNewHitsInTouchedFiles() {
  const touchedBasenames = ['hsi-to-graph.cjs', 'nl-graph-queries.cjs', 'fabric-chat.cjs', 'generate-chat-embed.cjs'];
  let out = '';
  try {
    out = execFileSync(process.execPath, [AGREEMENT_TEST_SCRIPT], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    // test-355-direction-agreement.cjs currently exits 1 (leg H is still red
    // on files outside this task's scope); this leg needs its stdout, not
    // its exit code.
    out = (e.stdout || '') + (e.stderr || '');
  }
  const hFailLines = out.split('\n').filter((line) => line.indexOf('FAIL: H ') === 0);
  const touchedHit = hFailLines.filter((line) => touchedBasenames.some((b) => line.indexOf(b) !== -1));
  check(
    'T2 leg H of test-355-direction-agreement.cjs: no hit in any file this task touched',
    touchedHit.length === 0,
    touchedHit.length ? touchedHit.join(' | ') : undefined
  );
}

// ---------------------------------------------------------------------------
// Run the async Task 2 legs, then the sync leg, then summarize. The tmp
// scratch rooms are always removed (finally blocks above), so a repeated run
// of this file never grows /tmp's mos-355- population.
// ---------------------------------------------------------------------------
(async () => {
  try {
    await runLegHsiToGraphWriteTime();
    await runLegNlGraphQueries();
    runLegHNoNewHitsInTouchedFiles();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
