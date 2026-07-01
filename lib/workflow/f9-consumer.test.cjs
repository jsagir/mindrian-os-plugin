'use strict';
/*
 * Phase 188-00 Wave 0 -- F.9 ordered consumer behavior stub (SFS-05).
 * =========================================================================
 * CONTRACT the Wave-C consumer (lib/workflow/f9-ordered-consumer.cjs) implements
 * against. RED now (the module does not exist) and GREEN when the ordered consumer
 * lands. Fails LOUDLY on module-not-found.
 *
 * What the F.9 consumer is: it walks the cascade in order and applies each item's
 * ordered outcome (Decision 13, "rejection is data"):
 *   APPROVE -> write the edge,
 *   REJECT  -> record NOT-applied + reason (the reason becomes a graph node),
 *   DEFER   -> leave a CONTRADICTS-linked competing-claim pair.
 *
 * Part 9 chokepoint invariant: the consumer NEVER opens room.db (same source
 * assertion as the F.8 fan-out). The caller passes roomState.db; every write
 * routes through the injectable closer / navigation.cjs.
 *
 * House rule: hyphens only, no em-dashes. Node built-ins only, zero deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// RED-loud: the module must exist.
const mod = require('./f9-ordered-consumer.cjs');
ok('module exports consumeF9Ordered', typeof mod.consumeF9Ordered === 'function');

// ---- Part 9 source assertion: NO self-opened room.db ----
const src = fs.readFileSync(path.join(__dirname, 'f9-ordered-consumer.cjs'), 'utf8');
ok('consumer does NOT require better-sqlite3', src.indexOf('better-sqlite3') === -1);
ok('consumer does NOT require node:sqlite', src.indexOf('node:sqlite') === -1);
ok('consumer does NOT open room.db itself',
  src.indexOf('.openRoomDb(') === -1 && src.indexOf('openRoomDbForCaller') === -1);

// ---- ordered outcomes: APPROVE writes edge, REJECT records reason, DEFER leaves CONTRADICTS pair ----
const writes = [];
const spy = {
  writeEdge: function (e) { writes.push({ kind: 'edge', edge: e }); return { ok: true }; },
  recordRejection: function (r) { writes.push({ kind: 'rejection', reason: r }); return { ok: true }; },
  leaveContradictsPair: function (p) { writes.push({ kind: 'contradicts', pair: p }); return { ok: true }; },
};
const items = [
  { claim: 'A implies B', outcome: 'APPROVE' },
  { claim: 'B is unsupported', outcome: 'REJECT', reason: 'no evidence' },
  { claim: 'C competes with A', outcome: 'DEFER' },
];
const roomState = { db: { __fake__: true }, graph: spy };
const result = mod.consumeF9Ordered({ items: items, roomState: roomState });

ok('all three ordered items were consumed',
  result && result.ok === true && (result.applied === items.length || (Array.isArray(result.items) && result.items.length === items.length)));

// APPROVE writes the edge.
ok('APPROVE writes an edge', writes.some((w) => w.kind === 'edge'));

// REJECT records NOT-applied + the reason (rejection is data).
const rej = writes.find((w) => w.kind === 'rejection');
ok('REJECT records a NOT-applied reason (Decision 13: rejection is data)',
  rej && JSON.stringify(rej).indexOf('no evidence') !== -1);

// DEFER leaves a CONTRADICTS-linked competing-claim pair.
ok('DEFER leaves a CONTRADICTS-linked competing-claim pair',
  writes.some((w) => w.kind === 'contradicts'));

console.log('\nPASS f9-consumer.test (' + pass + ' assertions)');
console.log('>>> f9-consumer.test.cjs: PASSED');
