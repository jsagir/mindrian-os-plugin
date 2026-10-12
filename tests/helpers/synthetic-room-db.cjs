'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261012-sc0 -- seeded synthetic rooms for the Part 8 guard survey gate.
 *
 * Purpose: build 6 deterministic synthetic room.db files at call time so the
 * guard survey gate (tests/test-3692-guard-survey-gate.cjs) can measure the
 * egress guard without a real room. Every string in this file is invented.
 * No real room is read or copied. The room.db is built at call time in a
 * caller-owned temp folder and is never committed (room.db is git-ignored).
 *
 * A later quick repoints tests/test-3692-lexicon-generic-entries.cjs to
 * buildRoom(dir, 'gate-lexgen'). The spec gate-lexgen copies the fixture
 * lists of quick 261012-sbz so that change needs no change of behavior.
 *
 * Plugin modules are required lazily inside buildRoom, so the caller sets its
 * HOME isolation first.
 *
 * Exports: SEED, mulberry32, ROOM_SPECS, GATE_ROOMS, nodesFor, buildRoom.
 *
 * No em-dash or en-dash anywhere (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');

const SEED = 3692;

// Standard 32-bit generator.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GATE_ROOMS = [
  'gate-lexgen',
  'gate-scaffold',
  'gate-claims',
  'gate-noise',
  'gate-segment',
  'gate-empty',
];

// The 18 generic company words and the 12 generic technology names (copied
// from the 261012-sbz fixture).
const GENERIC_COMPANIES = ['Design', 'Value', 'Customer', 'Canvas', 'Strategy', 'Innovation', 'Model',
  'Market', 'Lean', 'Business', 'Proposition', 'Dominant', 'Loop', 'Diagrams', 'Theory', 'Solution',
  'Options', 'Trends'];
const GENERIC_TECH = ['Value Proposition', 'Business Model', 'Innovation Management', 'Real Options',
  'Three Horizons', 'Stock Flow', 'Technology Adoption', 'Decision Pods', 'Search Gradient',
  'Problem Taxonomy', 'Design Strategy', 'Customer Value'];

function coreSections() {
  return require(path.join(__dirname, '..', '..', 'lib', 'core', 'section-registry.cjs')).CORE_SECTIONS;
}

function entity(entityType, name) {
  return { w: 'entity', entityType: entityType, name: name };
}
function insert(type, props, epistemic) {
  return { w: 'insert', type: type, props: props, epistemic_type: epistemic };
}
function claim(text) {
  return { w: 'claim', text: text };
}

function lexgenNodes() {
  const cs = coreSections();
  const nodes = [];
  Object.keys(cs).forEach(function (slug) {
    nodes.push(insert('Artifact', { title: slug, section: slug }, 'observation'));
  });
  GENERIC_COMPANIES.forEach(function (n) { nodes.push(entity('company', n)); });
  GENERIC_TECH.forEach(function (n) { nodes.push(entity('technology', n)); });
  nodes.push(insert('person', { name: 'Tamsin Rourke' }, 'extracted_fact'));
  nodes.push(entity('company', 'Quillfern Labs'));
  nodes.push(insert('organization', { name: 'Veldmark' }, 'extracted_fact'));
  nodes.push(claim('Larkspur depots cut chiller downtime by forty percent after the retrofit'));
  nodes.push(entity('technology', 'solar cold locker'));
  return { venture_name: 'Brightmoor Kiln', nodes: nodes };
}

function scaffoldNodes() {
  const cs = coreSections();
  const nodes = [];
  Object.keys(cs).forEach(function (slug) {
    nodes.push(insert('Artifact', { title: cs[slug].label, section: slug }, 'observation'));
    nodes.push(insert('artifact', { title: slug.replace(/-/g, ' '), section: slug }, 'observation'));
  });
  nodes.push(insert('Artifact', { title: 'Orvash pilot debrief', section: 'market-analysis' }, 'observation'));
  return { venture_name: null, nodes: nodes };
}

function claimsNodes() {
  const nodes = [
    claim('Orvash kiosks lifted repeat orders by thirty percent in the Belnex pilot'),
    claim('Dravi couriers refuse night routes when the fuel rebate lapses'),
    claim('Torvi clinics pay for sterilization audits only after a failed inspection'),
    claim('The lean canvas for Orvash kiosks shows repeat orders rise when deposits fall'),
    claim('Belnex buyers named the riskiest assumption as the sterilization audit backlog'),
    insert('CausalClaim',
      { statement: 'Higher Nexmoor deposit fees cause fewer Brightspur returns within ninety days' },
      'extracted_fact'),
  ];
  return { venture_name: null, nodes: nodes };
}

function noiseNodes() {
  const rng = mulberry32(SEED);
  const ONE = GENERIC_COMPANIES;
  const PAIRS = GENERIC_TECH;
  const PLAIN = ['Harbor', 'Lantern', 'Pilot', 'Platform', 'Network', 'Data', 'Signal', 'Bridge',
    'Anchor', 'Compass', 'Engine', 'Studio'];
  const SYL = ['quil', 'fern', 'veld', 'mark', 'bright', 'moor', 'kiln', 'lark', 'spur', 'tam', 'sin',
    'rour', 'ke', 'orv', 'ash', 'bel', 'dra', 'nex', 'tor', 'vi'];
  const SUFFIX = ['Labs', 'Group', 'Works', 'Systems'];
  const TYPES = ['entity', 'company', 'technology', 'market', 'product', 'organization'];
  function pick(a) { return a[Math.floor(rng() * a.length)]; }
  const nodes = [];
  const seen = new Set();
  for (let i = 0; i < 150; i += 1) {
    const r = rng();
    let name;
    if (r < 0.30) {
      name = pick(ONE);
    } else if (r < 0.50) {
      name = pick(ONE) + ' ' + pick(ONE);
    } else if (r < 0.62) {
      name = pick(PAIRS);
    } else if (r < 0.75) {
      name = pick(PLAIN);
    } else {
      const s = pick(SYL) + pick(SYL);
      name = s.charAt(0).toUpperCase() + s.slice(1);
      if (rng() >= 0.5) name = name + ' ' + pick(SUFFIX);
    }
    const type = TYPES[i % 6];
    const key = type + '|' + name;
    if (seen.has(key)) continue;
    seen.add(key);
    if (type === 'company' || type === 'technology' || type === 'market') {
      nodes.push(entity(type, name));
    } else {
      nodes.push(insert(type, { name: name }, 'extracted_fact'));
    }
  }
  return { venture_name: null, nodes: nodes };
}

function segmentNodes() {
  return {
    venture_name: null,
    nodes: [entity('technology', 'Customer Segment'), entity('company', 'Segment')],
  };
}

function emptyNodes() {
  return { venture_name: null, nodes: [] };
}

const ROOM_SPECS = {
  'gate-lexgen': lexgenNodes,
  'gate-scaffold': scaffoldNodes,
  'gate-claims': claimsNodes,
  'gate-noise': noiseNodes,
  'gate-segment': segmentNodes,
  'gate-empty': emptyNodes,
};

// Pure: no DB access. Two calls return deep-equal results.
function nodesFor(name) {
  const fn = ROOM_SPECS[name];
  if (typeof fn !== 'function') throw new Error('unknown synthetic room: ' + name);
  return fn();
}

// Build one room at roomDir. Never registers the room, never touches a registry.
function buildRoom(roomDir, name) {
  const spec = nodesFor(name);
  const { openRoomDb, closeRoomDb } = require(path.join(__dirname, '..', '..', 'lib', 'core', 'room-db.cjs'));
  const navigation = require(path.join(__dirname, '..', '..', 'lib', 'core', 'navigation.cjs'));
  const { insertNode } = require(path.join(__dirname, '..', '..', 'lib', 'core', 'node-insert.cjs'));
  fs.mkdirSync(roomDir, { recursive: true });
  if (spec.venture_name) {
    fs.writeFileSync(path.join(roomDir, 'ROOM.md'),
      '---\nventure_name: ' + spec.venture_name + '\n---\n\n# Synthetic room\n', 'utf8');
  }
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    function must(res, what) {
      if (!res || res.ok !== true) throw new Error('synthetic room write failed: ' + what);
    }
    spec.nodes.forEach(function (n, index) {
      if (n.w === 'entity') {
        must(navigation.writeEntityNode(db, {
          entityType: n.entityType, name: n.name, sessionId: 'sc0', evidenceTier: 'fallback',
        }), n.entityType + ' ' + n.name);
      } else if (n.w === 'claim') {
        must(navigation.writeClaimNode(db, {
          knowledge_type: 'fact', text: n.text, sessionId: 'sc0', sourceSegment: 'seg-sc0-' + index,
        }), 'claim ' + index);
      } else if (n.w === 'insert') {
        insertNode(db, n.type + ':sc0:' + index, n.type, JSON.stringify(n.props),
          { epistemic_type: n.epistemic_type });
      } else {
        throw new Error('unknown node writer: ' + n.w);
      }
    });
  } finally {
    closeRoomDb(db);
  }
  return { nodes: spec.nodes.length };
}

module.exports = { SEED, mulberry32, ROOM_SPECS, GATE_ROOMS, nodesFor, buildRoom };
