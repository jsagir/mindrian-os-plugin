#!/usr/bin/env node
'use strict';
// Layered Context Access tier baseline probe (379.1.1 plan 04, work item 9).
//
// Read-only. No network call, no Brain tool call, no write. It reads two fixture
// rooms and calls pure functions. Canon Part 8: nothing leaves the machine.
// Output: one JSON object on stdout, sorted keys, no timestamp, so two runs give
// the same bytes.
//
// Usage: node lca-tier-baseline.cjs

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..', '..', '..', '..');
const shared = require(path.join(REPO, 'lib', 'core', 'navigation-engine-shared.cjs'));
const folderMemory = require(path.join(REPO, 'lib', 'core', 'folder-memory.cjs'));
const brainClient = require(path.join(REPO, 'lib', 'core', 'brain-client.cjs'));

const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'icm-rooms');
const ROOMS = ['alpha-room', 'gamma-room'];
// sub-rooms/ holds nested rooms. It is a container, not a section.
const NOT_SECTIONS = new Set(['sub-rooms']);

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort().forEach((k) => { out[k] = sortKeys(v[k]); });
    return out;
  }
  return v;
}

const SHAPES = [
  { label: 'quadruple_null', quadruple: null },
  { label: 'brain_null', quadruple: { brain: null } },
  { label: 'brain_parse_failed', quadruple: { brain: { parse_failed: true } } },
  { label: 'brain_staleness_unavailable', quadruple: { brain: { staleness: 'unavailable' } } },
  { label: 'brain_staleness_fresh', quadruple: { brain: { staleness: 'fresh' } } },
  { label: 'brain_stale_brain_offline', quadruple: { brain: { staleness: 'stale', stale_reason: 'brain_offline' } } },
  { label: 'brain_stale_age_exceeded', quadruple: { brain: { staleness: 'stale', stale_reason: 'age_exceeded' } } },
];

const truthTable = [];
SHAPES.forEach((s) => {
  [true, false].forEach((avail) => {
    truthTable.push({
      brain_available: avail,
      shape: s.label,
      tier: shared.resolveTierMode(s.quadruple, avail),
    });
  });
});

function sectionDirs(roomDir) {
  return fs.readdirSync(roomDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !NOT_SECTIONS.has(e.name))
    .map((e) => e.name)
    .sort();
}

const fixtureRooms = {};
ROOMS.forEach((room) => {
  const roomDir = path.join(FIXTURES, room);
  const names = sectionDirs(roomDir);
  const sections = names.map((name) => {
    const q = folderMemory.readQuadruple(path.join(roomDir, name));
    return {
      brain_null: q.brain === null,
      name,
      tier_brain_available_false: shared.resolveTierMode(q, false),
      tier_brain_available_true: shared.resolveTierMode(q, true),
    };
  });
  const n = sections.length;
  const withBrain = sections.filter((s) => !s.brain_null).length;
  const share = (key) => (n === 0 ? null : Number((sections.filter((s) => s[key] === 'tier_0').length / n).toFixed(4)));
  fixtureRooms[room] = {
    counts: {
      sections: n,
      sections_with_brain: withBrain,
      tier_0_share_brain_available_false: share('tier_brain_available_false'),
      tier_0_share_brain_available_true: share('tier_brain_available_true'),
    },
    sections,
  };
});

const result = {
  client: { is_available: brainClient.isAvailable() },
  fixture_rooms: fixtureRooms,
  truth_table: truthTable,
};

process.stdout.write(JSON.stringify(sortKeys(result), null, 2) + '\n');
