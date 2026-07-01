'use strict';
/*
 * Phase 188-00 Wave 0 -- F.8 fan-out consumer behavior stub (SFS-03).
 * =========================================================================
 * CONTRACT the Wave-C consumer (lib/workflow/f8-fanout-consumer.cjs) implements
 * against. RED now (the module does not exist) and GREEN when the fan-out lands.
 * Fails LOUDLY on module-not-found -- never a silent skip (T-188-00-02).
 *
 * What the F.8 consumer is: F.1 resolves ONE pick to ONE closeOffer call; F.8
 * loops the captured ARRAY and calls the closer per item on ONE confirm
 * (1 confirm -> N typed edges). The per-item body clones consumeF1Pick.
 *
 * Part 9 chokepoint invariant (the load-bearing rule, f1-pick-consumer.cjs:44-49):
 * the consumer NEVER opens room.db. The caller owns the handle and passes a
 * populated roomState.db; every write routes through closeOffer -> navigation.cjs.
 * This stub greps the consumer's OWN source for forbidden requires.
 *
 * Testability seam: the F.8 consumer accepts an injectable closer (roomState.closer
 * or an args.closer) so a spy can count closeOffer calls WITHOUT a live room.db.
 *
 * House rule: hyphens only, no em-dashes. Node built-ins only, zero deps.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// RED-loud: the module must exist.
const mod = require('./f8-fanout-consumer.cjs');
ok('module exports consumeF8Fanout', typeof mod.consumeF8Fanout === 'function');

// ---- Part 9 source assertion: the consumer opens NO room.db of its own ----
const src = fs.readFileSync(path.join(__dirname, 'f8-fanout-consumer.cjs'), 'utf8');
ok('consumer does NOT require better-sqlite3', src.indexOf('better-sqlite3') === -1);
ok('consumer does NOT require node:sqlite', src.indexOf('node:sqlite') === -1);
ok('consumer does NOT open room.db itself (no openRoomDb call)',
  src.indexOf('.openRoomDb(') === -1 && src.indexOf('openRoomDbForCaller') === -1);

// ---- N captured toggles -> N closeOffer calls on ONE confirm ----
let closeCalls = [];
const spyCloser = {
  closeOffer: function (args) { closeCalls.push(args); return { ok: true, recorded: true }; },
};
const priorPayload = {
  verbs: ['ship it', 'archive', 'escalate'],
  reachIds: { 'ship it': 'brain_consult', 'archive': 'brain_consult', 'escalate': 'brain_consult' },
};
// The array capture: three toggles with distinct outcomes (two-channel split preserved).
const captured = [
  { verb: 'ship it', outcome: 'accept' },
  { verb: 'archive', outcome: 'reject' },
  { verb: 'escalate', outcome: 'defer' },
];
const roomState = { db: { __fake__: true }, closer: spyCloser };
const result = mod.consumeF8Fanout({ priorPayload: priorPayload, picks: captured, roomState: roomState });

ok('one confirm produced N closeOffer calls', closeCalls.length === captured.length);
ok('the fan-out reports N recorded items',
  result && result.ok === true && (result.recorded === captured.length || (Array.isArray(result.items) && result.items.length === captured.length)));

// ---- two-channel split preserved: {pick} is the OUTCOME keyword, never the verb ----
ok('closeOffer {pick} is the OUTCOME keyword, never the matched verb',
  closeCalls.every((c) => ['accept', 'reject', 'defer', 'Free-Text'].indexOf(c.pick) !== -1));
ok('the reject item stayed a reject (verb-as-pick coercion bug NOT present)',
  closeCalls.some((c) => c.pick === 'reject'));

// ---- degrade-never-block per item: one bad toggle does not abort the set ----
closeCalls = [];
const withBad = [
  { verb: 'ship it', outcome: 'accept' },
  { verb: 'NOT-A-RENDERED-VERB', outcome: 'accept' },
  { verb: 'escalate', outcome: 'defer' },
];
const degraded = mod.consumeF8Fanout({ priorPayload: priorPayload, picks: withBad, roomState: roomState });
ok('one malformed toggle does not abort the confirmed set (degrade-never-block)',
  closeCalls.length === 2 && degraded && degraded.ok === true);

console.log('\nPASS f8-consumer.test (' + pass + ' assertions)');
console.log('>>> f8-consumer.test.cjs: PASSED');
