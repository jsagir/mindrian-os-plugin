'use strict';
/*
 * Phase 219-02 Task 3 -- buildFixtureRoom: the hub-skew fixture room builder
 * (the 218 R1 countermeasure).
 *
 * WHY THIS EXISTS: 218's fixture-green lied twice. Its seeded room had no
 * pre-existing high-degree hub class, so degree-centrality scoring
 * (validated_demand percentile rank over pair_count) never had an entrenched
 * hub family to bury the low-degree entity family under -- exactly what the
 * live months-old rooms do (218-VERIFICATION root cause). This builder MODELS
 * that accumulated skew so Plans 03/04 unit tests rank against a fixture that
 * can no longer lie that way.
 *
 * WHAT IT SEEDS (all through navigation writers ONLY -- never raw SQL; the
 * run-all-219 grep gate enforces zero raw node/edge inserts here):
 *   (a) HUB SKEW: three memory_artifact hub nodes (one ROOM-kind per section),
 *       each carrying 14 typed edges (6 CONVERGES to its own-section
 *       satellites + 2 CONVERGES to the other hubs + 6 INFORMS to the next
 *       section's satellites) -- the accumulated-skew profile.
 *   (b) LOW-DEGREE ENTITY FAMILY: company / technology / market nodes with
 *       1-2 edges each, via navigation.writeEntityNode (born
 *       review_status='proposed', Part 9).
 *   (c) KNOWN BRIDGE: a cross-section RELATED_TO edge between two low-degree
 *       entities anchored in DIFFERENT sections -- the surprise/intersection
 *       candidate the harvest sensor must rank ABOVE artifact-vs-artifact
 *       pairs.
 *   (c2) KNOWN DOMAIN BRIDGE (GAP-2, 219-06 live checkpoint): a second
 *       cross-section bridge riding USES_COMPONENT -- the REAL 218
 *       domain-relationship vocabulary a live room actually produces
 *       (RELATED_TO never occurs on a live post-218 room; this proves the
 *       harvest lane's BRIDGE_EDGE_TYPES extension actually fires).
 *   (d) KNOWN CONTRADICTION: a CONTRADICTS edge pair -- the Challenging
 *       Orthodoxies lens candidate.
 *   (e) ZERO-CONNECTION ISOLATE: one entity node with NO typed links -- must
 *       be SUPPRESSED by the sensor (one dot is noise, REQ-2).
 *   (f) minimal room scaffolding (ROOM.md, section .md files, .mindrian/) so
 *       producers can write side-channels and read artifact bodies.
 *
 * DETERMINISTIC: fixed names and sections, no randomness, no network, no LLM.
 * Returns stable ids for every planted feature so tests assert against exact
 * expectations. NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../../lib/core/room-db.cjs');
const navigation = require('../../lib/core/navigation.cjs');

// The fixed session id every entity node is minted under: keeps
// ENTITY_NODE_ID(sessionId, name) stable across runs (idempotent UPSERT).
const FIXTURE_SESSION = 'fixture-219';

// Three sections; each gets one ROOM-kind hub + six satellite kinds. The kind
// vocabulary is the closed MEMORY_KIND_SET memory-artifacts.cjs enforces.
const SECTIONS = ['competitive-analysis', 'technology-stack', 'market-analysis'];
const SATELLITE_KINDS = ['STATE', 'MINTO', 'BRAIN', 'FEYNMAN', 'USER', 'DRIFT'];

function must(result, what) {
  if (!result || result.ok !== true) {
    throw new Error('fixture-room-219: ' + what + ' failed: ' + JSON.stringify(result));
  }
  return result;
}

function writeFileUnder(roomDir, rel, body) {
  const abs = path.join(roomDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body + '\n', 'utf8');
}

// buildFixtureRoom(tmpDir) -> { roomDir, dbPath, ids }
//
// tmpDir: an existing writable directory (the caller owns cleanup). The room
// is created at tmpDir/room so the caller's dir stays inspectable.
function buildFixtureRoom(tmpDir) {
  if (typeof tmpDir !== 'string' || tmpDir.length === 0) {
    throw new Error('fixture-room-219: tmpDir is required');
  }
  const roomDir = path.join(tmpDir, 'room');
  fs.mkdirSync(roomDir, { recursive: true });

  // (f) Minimal scaffolding: ROOM.md identity + per-section md files backing
  // every memory_artifact node's props.path, so body-reading producers work.
  writeFileUnder(roomDir, 'ROOM.md', '# Fixture Room 219\n\nHub-skew fixture (Phase 219-02 Task 3).');
  for (const section of SECTIONS) {
    writeFileUnder(roomDir, path.join(section, 'ROOM.md'),
      '# ' + section + '\n\nSection hub artifact for the ' + section + ' section.');
    for (const kind of SATELLITE_KINDS) {
      writeFileUnder(roomDir, path.join(section, kind + '.md'),
        '# ' + section + ' ' + kind + '\n\nSatellite artifact (' + kind + ') in ' + section + '.');
    }
  }

  const db = openRoomDb(roomDir, { allowExtension: true }); // creates .mindrian/
  const ids = {
    session: FIXTURE_SESSION,
    sections: SECTIONS.slice(),
    hubs: {},          // section -> hub node id
    satellites: {},    // section -> [6 satellite node ids]
    entities: {},      // name -> entity node id
    bridgeA: null,
    bridgeB: null,
    domainBridgeA: null,
    domainBridgeB: null,
    contradictionA: null,
    contradictionB: null,
    isolate: null,
  };

  try {
    // ---- (a) hubs + satellites (memory_artifact nodes via the chokepoint) ----
    for (const section of SECTIONS) {
      const hub = must(navigation.writeMemoryArtifactNode(db, {
        section: section,
        kind: 'ROOM',
        path: section + '/ROOM.md',
        hash: '',
      }), 'hub write (' + section + ')');
      ids.hubs[section] = hub.node_id;

      ids.satellites[section] = [];
      for (const kind of SATELLITE_KINDS) {
        const sat = must(navigation.writeMemoryArtifactNode(db, {
          section: section,
          kind: kind,
          path: section + '/' + kind + '.md',
          hash: '',
        }), 'satellite write (' + section + '/' + kind + ')');
        ids.satellites[section].push(sat.node_id);
      }
    }

    // Hub edge fan-out: 6 own-section CONVERGES + 2 hub-hub CONVERGES
    // + 6 next-section INFORMS = 14 edges per hub (the 10-20 skew band).
    for (let s = 0; s < SECTIONS.length; s += 1) {
      const section = SECTIONS[s];
      const hubId = ids.hubs[section];
      for (const satId of ids.satellites[section]) {
        must(navigation.writeEdge(db, {
          source_id: hubId,
          target_id: satId,
          edge_type: 'CONVERGES',
          properties: { relation: 'converges' },
        }), 'hub->satellite CONVERGES (' + section + ')');
      }
      const nextSection = SECTIONS[(s + 1) % SECTIONS.length];
      for (const satId of ids.satellites[nextSection]) {
        must(navigation.writeEdge(db, {
          source_id: hubId,
          target_id: satId,
          edge_type: 'INFORMS',
          properties: { relation: 'informs' },
        }), 'hub->next-section-satellite INFORMS (' + section + ')');
      }
    }
    // Hub-hub clique (3 edges; each hub gains 2 endpoints).
    for (let i = 0; i < SECTIONS.length; i += 1) {
      for (let j = i + 1; j < SECTIONS.length; j += 1) {
        must(navigation.writeEdge(db, {
          source_id: ids.hubs[SECTIONS[i]],
          target_id: ids.hubs[SECTIONS[j]],
          edge_type: 'CONVERGES',
          properties: { relation: 'converges' },
        }), 'hub->hub CONVERGES');
      }
    }

    // ---- (b) low-degree entity family (writeEntityNode, 1-2 edges each) ----
    const family = [
      // name, entityType, anchor section (its DESCRIBES target hub)
      { name: 'Vantorix Systems', entityType: 'company', section: 'competitive-analysis' },
      { name: 'Cryogenic Pump Array', entityType: 'technology', section: 'technology-stack' },
      { name: 'Evacuated Tube Freight Market', entityType: 'market', section: 'market-analysis' },
      { name: 'Orthodox Rail Group', entityType: 'company', section: 'competitive-analysis' },
      { name: 'Maglev Load Lock', entityType: 'technology', section: 'technology-stack' },
      // GAP-2 (219-06 live checkpoint): a second bridge pair riding the REAL
      // 218 domain-relationship vocabulary (USES_COMPONENT), not the generic
      // RELATED_TO the (c) bridge below uses -- proves the harvest lane finds
      // both, since a live room only ever produces the 218 vocabulary.
      { name: 'Thermex Rivals Inc', entityType: 'company', section: 'competitive-analysis' },
      { name: 'Cryoline Components', entityType: 'technology', section: 'technology-stack' },
    ];
    for (const ent of family) {
      const r = must(navigation.writeEntityNode(db, {
        entityType: ent.entityType,
        name: ent.name,
        sessionId: FIXTURE_SESSION,
      }), 'entity write (' + ent.name + ')');
      ids.entities[ent.name] = r.node_id;
      // Exactly ONE provenance edge each: entity DESCRIBES its section hub.
      must(navigation.writeEdge(db, {
        source_id: r.node_id,
        target_id: ids.hubs[ent.section],
        edge_type: 'DESCRIBES',
        properties: { relation: 'describes', entity_node: r.node_id },
      }), 'entity DESCRIBES hub (' + ent.name + ')');
    }

    // ---- (c) the KNOWN BRIDGE: cross-section RELATED_TO between two
    // low-degree entities anchored in DIFFERENT sections (their 2nd edge). ----
    ids.bridgeA = ids.entities['Vantorix Systems'];        // competitive-analysis
    ids.bridgeB = ids.entities['Cryogenic Pump Array'];    // technology-stack
    must(navigation.writeEdge(db, {
      source_id: ids.bridgeA,
      target_id: ids.bridgeB,
      edge_type: 'RELATED_TO',
      properties: { relation: 'related_to', planted: 'bridge' },
    }), 'planted bridge RELATED_TO');

    // ---- (c2) GAP-2 SECOND BRIDGE: cross-section USES_COMPONENT between two
    // low-degree entities -- the REAL 218 domain-relationship vocabulary a
    // live room actually produces (their 2nd edge each). ----
    ids.domainBridgeA = ids.entities['Thermex Rivals Inc'];    // competitive-analysis
    ids.domainBridgeB = ids.entities['Cryoline Components'];   // technology-stack
    must(navigation.writeEdge(db, {
      source_id: ids.domainBridgeA,
      target_id: ids.domainBridgeB,
      edge_type: 'USES_COMPONENT',
      properties: { relation: 'uses_component', planted: 'domain-bridge' },
    }), 'planted domain bridge USES_COMPONENT');

    // ---- (d) the KNOWN CONTRADICTION: a CONTRADICTS edge pair (their 2nd
    // edge; the Challenging Orthodoxies lens candidate). ----
    ids.contradictionA = ids.entities['Orthodox Rail Group'];  // competitive-analysis
    ids.contradictionB = ids.entities['Maglev Load Lock'];     // technology-stack
    must(navigation.writeEdge(db, {
      source_id: ids.contradictionA,
      target_id: ids.contradictionB,
      edge_type: 'CONTRADICTS',
      properties: { relation: 'contradicts', planted: 'contradiction' },
    }), 'planted CONTRADICTS');

    // ---- (e) the ZERO-CONNECTION ISOLATE: one entity node, NO typed links.
    // One dot is noise: the harvest sensor must SUPPRESS it (REQ-2). ----
    const isolate = must(navigation.writeEntityNode(db, {
      entityType: 'market',
      name: 'Orphan Signal Market',
      sessionId: FIXTURE_SESSION,
    }), 'isolate write');
    ids.isolate = isolate.node_id;
    ids.entities['Orphan Signal Market'] = isolate.node_id;
  } finally {
    closeRoomDb(db);
  }

  return {
    roomDir: roomDir,
    dbPath: path.join(roomDir, '.mindrian', 'room.db'),
    ids: ids,
  };
}

module.exports = { buildFixtureRoom };
