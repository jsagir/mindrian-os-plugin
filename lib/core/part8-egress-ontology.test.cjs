#!/usr/bin/env node
// Phase 196 -- part8-egress-ontology telemetry test (PB8-06).
//
// WAVE 0 CONTRACT: authored before the ontology writer lands (Nyquist). Requires
// lib/core/part8-egress-ontology.cjs in a try/catch; while absent it prints SKIP
// and exits 0. The moment 196-04 lands the module, these assertions bind.
//
// D-09 invariant: telemetry carries scalars + category slugs + counts ONLY, never
// the offending payload bytes. All writes route through navigation.cjs (Part 9);
// the ontology NEVER opens room.db directly. The three additive EVENT_TYPES strings
// (brain_egress_blocked / _allowed / _ambiguous) must be accepted by the memory
// event Set (membership IS the gate -- logEvent rejects anything outside it).
//
// Zero-dep: plain node assert; spy the navigation seam by monkeypatching its
// re-exported writers. CJS only. No em-dashes.

'use strict';

const assert = require('assert');

let ontology;
try {
  ontology = require('./part8-egress-ontology.cjs');
} catch (_e) {
  console.log('SKIP: part8-egress-ontology.cjs not present (Wave 0) -- inert until 196-04 lands the telemetry writer');
  process.exit(0);
}

assert.strictEqual(typeof ontology.record, 'function', 'part8-egress-ontology must export record()');

// The raw offending bytes that must NEVER appear in any telemetry payload.
const RAW_SECRET = 'founder jane@startup.com pivoting to defense, 2.3M ARR at the Haifa pilot';

// ---------------------------------------------------------------------------
// Spy the navigation.cjs write chokepoint. If the ontology opens room.db directly
// (bypassing navigation) the stub db below trips -- .prepare/.exec throw -- so a
// direct-DB write is caught as a failure rather than silently allowed.
// ---------------------------------------------------------------------------
const navigation = require('./navigation.cjs');
const captured = { events: [], edges: [], nodes: [] };

const orig = {
  logMemoryEvent: navigation.logMemoryEvent,
  writeEdge: navigation.writeEdge,
  writeDomainNode: navigation.writeDomainNode,
};

navigation.logMemoryEvent = function (db, eventType, payload) {
  captured.events.push({ eventType: eventType, payload: payload });
  return { id: 'evt-' + captured.events.length };
};
navigation.writeEdge = function (db, spec) {
  captured.edges.push(spec);
  return { id: 'edge-' + captured.edges.length };
};
navigation.writeDomainNode = function (db, spec) {
  captured.nodes.push(spec);
  return { id: 'node-' + captured.nodes.length };
};

// A stub db that FAILS LOUD if the ontology tries to touch room.db directly.
const stubDb = {
  prepare: function () { throw new Error('D-09 breach: ontology opened room.db directly (must route through navigation.cjs)'); },
  exec: function () { throw new Error('D-09 breach: ontology called db.exec directly'); },
};

function restore() {
  navigation.logMemoryEvent = orig.logMemoryEvent;
  navigation.writeEdge = orig.writeEdge;
  navigation.writeDomainNode = orig.writeDomainNode;
}

try {
  // -------------------------------------------------------------------------
  // PB8-06 (a): record() writes ONLY scalars + slugs + counts. Feed a context
  // carrying the raw offending string; assert nothing logged contains it.
  // -------------------------------------------------------------------------
  ontology.record(stubDb, {
    verdict: 'block',
    class: 'personal_identifier',
    matched_pattern: 'email',
    count: 1,
    // A hostile field: if the writer naively forwards context it would leak this.
    raw_payload: RAW_SECRET,
  });

  assert.ok(captured.events.length >= 1, 'PB8-06: record() must log at least one memory_event through navigation');

  const blob = JSON.stringify(captured);
  assert.ok(blob.indexOf(RAW_SECRET) === -1,
    'PB8-06: telemetry payload must NOT contain raw offending bytes (D-09 scalars-only)');
  assert.ok(blob.indexOf('jane@startup.com') === -1,
    'PB8-06: telemetry must not leak the email substring');

  // -------------------------------------------------------------------------
  // PB8-06 (b): the three additive EVENT_TYPES are accepted for all verdicts.
  // -------------------------------------------------------------------------
  captured.events.length = 0;
  ontology.record(stubDb, { verdict: 'allow', class: 'framework_handle', count: 1 });
  ontology.record(stubDb, { verdict: 'ambiguous', class: 'slug', count: 1 });

  const seenTypes = captured.events.map(function (e) { return e.eventType; });
  const expectedTypes = ['brain_egress_blocked', 'brain_egress_allowed', 'brain_egress_ambiguous'];
  // Every emitted event type must be one of the three additive strings.
  seenTypes.forEach(function (t) {
    assert.ok(expectedTypes.indexOf(t) !== -1,
      'PB8-06: emitted event type "' + t + '" must be one of the three additive EVENT_TYPES');
  });

  // The memory-events Set must actually carry the three additive strings once the
  // module lands (membership IS the gate).
  const memEvents = require('./navigation/memory-events.cjs');
  const eventSet = memEvents.EVENT_TYPES || memEvents.MEMORY_EVENT_TYPES;
  if (eventSet && typeof eventSet.has === 'function') {
    expectedTypes.forEach(function (t) {
      assert.ok(eventSet.has(t), 'PB8-06: EVENT_TYPES Set must accept additive string "' + t + '"');
    });
  }

  // -------------------------------------------------------------------------
  // PB8-06 (c): one TAGGED_WITH edge from the memory_event to the class node.
  // -------------------------------------------------------------------------
  const taggedEdges = captured.edges.filter(function (e) {
    return e && (e.type === 'TAGGED_WITH' || e.edgeType === 'TAGGED_WITH');
  });
  assert.ok(taggedEdges.length >= 1, 'PB8-06: record() must write a TAGGED_WITH edge to the class node');

  console.log('PASS: part8-egress-ontology telemetry (PB8-06) -- scalars-only, navigation-routed, EVENT_TYPES accepted');
} finally {
  restore();
}

process.exit(0);
