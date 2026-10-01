'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 shared planted-room fixture (plan 366-01, D-06).
 *
 * buildPerspectiveRoom(rootDir, opts) -> { roomDir, dbPath, planted, ids }
 *
 * REQUIRE ORDER: require this module only AFTER the caller has isolated the
 * process (HOME, USERPROFILE and MINDRIAN_ROOMS_HOME pointed at mkdtemp dirs,
 * CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID deleted). It loads room-db and
 * node-insert lazily inside buildPerspectiveRoom, but the caller's isolation
 * must already be in place when it does.
 *
 * The room: four product sections (problem-definition, market-analysis,
 * solution-design, competitive-analysis) plus a structural references/ dir,
 * each product section with a CONTEXT.md carrying "## Inputs". Declared
 * couplings: solution-design <- problem-definition and
 * competitive-analysis <- market-analysis.
 *
 * planted (each a pair [a, b] of node ids):
 *   eureka       two things across sections sharing two DESCRIBES entities
 *                and lexical overlap (the eureka recall must surface it);
 *   rs           two developed problem-definition things whose INFORMS flow
 *                lands on one thin solution-design thing ([P1, P2]; the thin
 *                target is ids.rs_target);
 *   hsi          high DESCRIBES-entity overlap, near-zero word overlap,
 *                across sections;
 *   analogies    the same pair as hsi (structure without shared words);
 *   whitespace   the two things a WhitespaceZone (ids.whitespace_zone)
 *                borders through WHITESPACE_DETECTED edges, two sections;
 *   connections  two things whose canon handles resolve (frontmatter-style
 *                framework: equal to an exact canon name), each with a
 *                USES_FRAMEWORK edge to a framework: node;
 *   known        a pair already joined by an INFORMS edge across sections
 *                that would otherwise be recalled (shared entity + words);
 *                every recall must exclude it.
 * An existing opportunity node (ids.opportunity) carries evidence_ids and
 * DERIVED_FROM edges to ids.opportunity_pair, a second exclusion.
 *
 * Order: every node is minted through insertNode FIRST; only then do the raw
 * INSERT INTO edges statements run, each naming two ids that already exist
 * (the D-16 node-before-edge rule). Raw edge SQL is allowed only inside test
 * fixtures (the seed103 precedent). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SECTIONS = Object.freeze(['problem-definition', 'market-analysis', 'solution-design', 'competitive-analysis']);

// declared "## Inputs" per section (the ICM lane and the RS flow)
const INPUTS = Object.freeze({
  'problem-definition': '- Reference (every run): references/schema.md',
  'market-analysis': '- Reference (every run): references/schema.md',
  'solution-design': '- Working (this run): ../problem-definition/output/problem.md',
  'competitive-analysis': '- Working (this run): ../market-analysis/output/segments.md',
});

const CANON = Object.freeze({
  rs: 'Reverse Salient Analysis',
  lenses: 'Four Lenses of Innovation',
  // a methodology slug that maps through data/command-registry.json
  // (/mos:analyze-systems -> Systems Thinking)
  methodology: 'analyze-systems',
});

function contextMd(sec) {
  return '# ' + sec + '\n\nOne job: work the ' + sec + ' section.\n\n## Inputs\n' + INPUTS[sec] +
    '\n\n## Process\n1. read\n\n## Outputs\n- ' + sec + '.md\n\n## Human check\nRead it.\n';
}

function writeTree(roomDir) {
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nname: fixture-366\n---\n');
  SECTIONS.forEach(function (sec) {
    fs.mkdirSync(path.join(roomDir, sec), { recursive: true });
    fs.writeFileSync(path.join(roomDir, sec, 'CONTEXT.md'), contextMd(sec));
  });
  fs.mkdirSync(path.join(roomDir, 'references'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'references', 'schema.md'), '# schema\n\nReference material for the fixture room.\n');
}

// Artifacts: [id, section, props]
const ARTIFACTS = Object.freeze([
  // rs: two developed problem-definition things flowing into one thin solution-design thing
  ['pd/P1', 'problem-definition', { title: 'Membrane fouling in desalination intake filters', body: 'Biofilm growth on membrane surfaces raises pressure drop; periodic backwash cycles, chemical dosing and inspection schedules extend service life across coastal plants.' }],
  ['pd/P2', 'problem-definition', { title: 'Energy load of high pressure pumping stages', body: 'Pump energy dominates operating cost; recovery devices, staged pressure vessels and variable speed drives each trade capital against kilowatt hours.' }],
  ['sd/S1', 'solution-design', { title: 'Intake redesign sketch', body: 'Draft.' }],
  // eureka: shared entities (coating, biofilm) plus lexical overlap
  ['pd/P3', 'problem-definition', { title: 'Antifouling coating chemistry for seawater membranes', body: 'Zwitterionic coating layers resist biofilm attachment on seawater membranes and slow fouling between cleaning cycles.' }],
  ['ma/M1', 'market-analysis', { title: 'Suppliers of antifouling coating for seawater membranes', body: 'Coating suppliers sell zwitterionic layers that resist biofilm on seawater membranes; pricing tiers and fouling resistance claims.' }],
  // hsi / analogies: three shared entities, disjoint vocabulary
  ['ma/M2', 'market-analysis', { title: 'Municipal crews dispatched by neighbourhood demand', body: 'Utilities assign maintenance teams street by street according to complaint volume and seasonal workload.' }],
  ['ca/C1', 'competitive-analysis', { title: 'Ant colony pheromone trails', body: 'Foraging insects lay chemical markers that strengthen along shorter paths, letting the nest converge on efficient food routes.' }],
  // whitespace: bordered by a WhitespaceZone across two sections
  ['ma/M3', 'market-analysis', { title: 'Rural cooperatives without treatment budgets', body: 'Small agricultural cooperatives draw brackish groundwater and lack capital for any purification equipment.' }],
  ['ca/C2', 'competitive-analysis', { title: 'Incumbent vendors ignore sub-megalitre installs', body: 'Major vendors quote only large plants; nobody packages small skid systems for remote villages.' }],
  // connections: canon handles resolve
  ['pd/P4', 'problem-definition', { title: 'Bottleneck that holds back the treatment system', framework: CANON.rs, body: 'The lagging subsystem is brine disposal; every other component has advanced faster than the outfall permitting.' }],
  ['sd/S2', 'solution-design', { title: 'Four angles on the redesign', framework: CANON.lenses, body: 'Orthodoxies, trends, competencies and unmet needs each suggest a different intake architecture.' }],
  ['ca/C3', 'competitive-analysis', { title: 'Feedback loops in the vendor ecosystem', methodology: CANON.methodology, body: 'Service contracts reinforce lock-in; spare part pricing balances against churn.' }],
  // known: would be recalled (shared entity + words) but is already joined by INFORMS
  ['pd/P5', 'problem-definition', { title: 'Brine discharge salinity limits for coastal outfalls', body: 'Outfall diffusers must dilute brine discharge below salinity limits set for coastal marine habitats.' }],
  ['ma/M4', 'market-analysis', { title: 'Diffuser vendors for brine discharge outfalls', body: 'Vendors of outfall diffusers that dilute brine discharge for coastal salinity limits; contract sizes.' }],
  // opportunity exclusion pair
  ['sd/S3', 'solution-design', { title: 'Solar powered reverse osmosis skid', body: 'Photovoltaic panels drive a compact skid for remote brackish wells with battery buffering.' }],
  ['ca/C4', 'competitive-analysis', { title: 'Solar desalination skid competitors', body: 'Competitors ship photovoltaic driven compact skids for remote brackish wells.' }],
]);

const ENTITIES = Object.freeze([
  ['ent/coating', 'technology', { name: 'antifouling coating' }],
  ['ent/biofilm', 'technology', { name: 'biofilm' }],
  ['ent/routing', 'entity', { name: 'adaptive routing' }],
  ['ent/dispatch', 'entity', { name: 'demand-driven dispatch' }],
  ['ent/swarm', 'entity', { name: 'swarm coordination' }],
  ['ent/brine', 'technology', { name: 'brine diffuser' }],
  ['ent/solar-skid', 'product', { name: 'solar RO skid' }],
]);

function frameworkId(name) { return 'framework:' + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const PLANTED = Object.freeze({
  eureka: ['pd/P3', 'ma/M1'],
  rs: ['pd/P1', 'pd/P2'],
  hsi: ['ma/M2', 'ca/C1'],
  analogies: ['ma/M2', 'ca/C1'],
  whitespace: ['ma/M3', 'ca/C2'],
  connections: ['pd/P4', 'sd/S2'],
  known: ['pd/P5', 'ma/M4'],
});

const IDS = Object.freeze({
  rs_target: 'sd/S1',
  whitespace_zone: 'ws/zone-366',
  opportunity: 'opp/existing-366',
  opportunity_pair: ['sd/S3', 'ca/C4'],
  frameworks: [frameworkId(CANON.rs), frameworkId(CANON.lenses)],
  canon: CANON,
});

function edgeList() {
  const e = [];
  ARTIFACTS.forEach(function (a) { e.push([a[0], 'section:' + a[1], 'BELONGS_TO']); });
  // rs flow
  e.push(['pd/P1', 'sd/S1', 'INFORMS']);
  e.push(['pd/P2', 'sd/S1', 'INFORMS']);
  // eureka: two shared DESCRIBES entities
  e.push(['pd/P3', 'ent/coating', 'DESCRIBES']);
  e.push(['ma/M1', 'ent/coating', 'DESCRIBES']);
  e.push(['pd/P3', 'ent/biofilm', 'DESCRIBES']);
  e.push(['ma/M1', 'ent/biofilm', 'DESCRIBES']);
  // hsi / analogies: three shared entities
  ['ent/routing', 'ent/dispatch', 'ent/swarm'].forEach(function (ent) {
    e.push(['ma/M2', ent, 'DESCRIBES']);
    e.push(['ca/C1', ent, 'DESCRIBES']);
  });
  // whitespace
  e.push([IDS.whitespace_zone, 'ma/M3', 'WHITESPACE_DETECTED']);
  e.push([IDS.whitespace_zone, 'ca/C2', 'WHITESPACE_DETECTED']);
  // connections
  e.push(['pd/P4', IDS.frameworks[0], 'USES_FRAMEWORK']);
  e.push(['sd/S2', IDS.frameworks[1], 'USES_FRAMEWORK']);
  // known pair: shared entity and an existing INFORMS edge
  e.push(['pd/P5', 'ent/brine', 'DESCRIBES']);
  e.push(['ma/M4', 'ent/brine', 'DESCRIBES']);
  e.push(['pd/P5', 'ma/M4', 'INFORMS']);
  // opportunity exclusion
  e.push(['sd/S3', 'ent/solar-skid', 'DESCRIBES']);
  e.push(['ca/C4', 'ent/solar-skid', 'DESCRIBES']);
  e.push([IDS.opportunity, 'sd/S3', 'DERIVED_FROM']);
  e.push([IDS.opportunity, 'ca/C4', 'DERIVED_FROM']);
  return e;
}

/**
 * buildPerspectiveRoom(rootDir, opts)
 *   rootDir  an existing (mkdtemp) directory; the room is created at <rootDir>/<opts.name || 'room'>
 *   opts.withoutDb  true -> write the folder tree only, no room.db (substrate-missing legs)
 * Returns { roomDir, dbPath, planted, ids }. dbPath is null when withoutDb.
 */
function buildPerspectiveRoom(rootDir, opts) {
  const o = opts || {};
  const roomDir = path.join(rootDir, o.name || 'room');
  writeTree(roomDir);
  const planted = JSON.parse(JSON.stringify(PLANTED));
  const ids = JSON.parse(JSON.stringify(IDS));
  if (o.withoutDb === true) return { roomDir: roomDir, dbPath: null, planted: planted, ids: ids };

  const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
  const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
  const db = roomDb.openRoomDb(roomDir);
  try {
    const minted = new Set();
    function node(id, type, props, epistemic) {
      insertNode(db, id, type, JSON.stringify(props), { source_path: 'test:fixture-366', epistemic_type: epistemic || 'observation' });
      minted.add(id);
    }
    // 1. nodes first
    SECTIONS.forEach(function (sec) { node('section:' + sec, 'Section', { slug: sec }); });
    ARTIFACTS.forEach(function (a) { node(a[0], 'Artifact', Object.assign({ section: a[1] }, a[2])); });
    ENTITIES.forEach(function (en) { node(en[0], en[1], en[2]); });
    node(IDS.frameworks[0], 'framework', { name: CANON.rs });
    node(IDS.frameworks[1], 'framework', { name: CANON.lenses });
    node(IDS.whitespace_zone, 'WhitespaceZone', { name: 'small remote brackish installs', sections: ['market-analysis', 'competitive-analysis'] }, 'derived_fact');
    node(IDS.opportunity, 'opportunity', { name: 'existing solar skid opportunity', evidence_ids: IDS.opportunity_pair.slice() }, 'hypothesis');

    // 2. edges second, each naming two ids that already exist
    const ins = db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)');
    edgeList().forEach(function (e) {
      if (!minted.has(e[0]) || !minted.has(e[1])) throw new Error('fixture-366: edge before node ' + e.join(' '));
      ins.run(e[0], e[1], e[2], '{}');
    });
  } finally {
    roomDb.closeRoomDb(db);
  }
  return { roomDir: roomDir, dbPath: path.join(roomDir, '.mindrian', 'room.db'), planted: planted, ids: ids };
}

module.exports = { buildPerspectiveRoom, SECTIONS, PLANTED, IDS };
