#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-14: Part 8 zero egress. The calibration log (calibration_observations) is LOCAL
// room.db only and must NEVER be read by the Brain packet builder. This is a structural
// tripwire (Canon Part 8), not a behavioral test: it FAILS the day anyone wires calibration
// data into the Brain egress path, BEFORE any cue ships. Verified live (177-RESEARCH.md
// MG-10/MG-14): buildBrainPacket reads only the nodes + identity tables.
//
// Pure node asserts, no deps. Real green at scaffold time because the invariant holds today;
// it is a regression fence for every wave that follows.

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-14-part8-egress ---');

// The Brain egress surface: the packet builder + its re-export chokepoint.
const PACKET = path.join(ROOT, 'lib/core/navigation/packet.cjs');
const NAV = path.join(ROOT, 'lib/core/navigation.cjs');
ok(fs.existsSync(PACKET), 'lib/core/navigation/packet.cjs exists (the Brain packet builder)');
ok(fs.existsSync(NAV), 'lib/core/navigation.cjs exists (the chokepoint that re-exports buildBrainPacket)');

const packetSrc = fs.existsSync(PACKET) ? fs.readFileSync(PACKET, 'utf8') : '';
const navSrc = fs.existsSync(NAV) ? fs.readFileSync(NAV, 'utf8') : '';

// (1) No calibration table is referenced anywhere in the Brain egress path. The calibration
//     log is LOCAL-only; if a future change reads it here, that is a Part 8 breach.
const CALIB = /calibration_observ|calibration_harness|calibration_log|calibration_observation/i;
ok(!CALIB.test(packetSrc), 'packet.cjs references NO calibration table (Part 8: LOCAL -> BRAIN never)');
ok(!CALIB.test(navSrc), 'navigation.cjs references NO calibration table in the buildBrainPacket path');

// (2) Allow-list tripwire: every table the packet builder SELECTs FROM must be on the
//     known-safe list. A calibration (or any new) table sneaking into the egress builder
//     trips this immediately.
const ALLOWED_TABLES = new Set(['nodes', 'identity', 'edges']);
// Case-SENSITIVE: SQL keyword FROM is uppercase in this codebase; lowercase "from" in
// prose comments must not trip the fence.
const fromMatches = [...packetSrc.matchAll(/\bFROM\s+([a-z_][a-z0-9_]*)/g)].map((m) => m[1].toLowerCase());
ok(fromMatches.length > 0, 'packet.cjs has at least one table read (sanity: the regex matched)');
const illegal = fromMatches.filter((t) => !ALLOWED_TABLES.has(t));
ok(illegal.length === 0, 'packet.cjs reads ONLY allow-listed tables {nodes,identity,edges}; found illegal: [' + illegal.join(', ') + ']');

// (3) buildBrainPacket is the named egress entry and is re-exported through the chokepoint
//     (so this fence guards the one door, per 177-RESEARCH.md MG-9).
ok(/buildBrainPacket/.test(packetSrc), 'packet.cjs defines buildBrainPacket (the egress entry)');
ok(/buildBrainPacket\s*:/.test(navSrc), 'navigation.cjs re-exports buildBrainPacket (the single chokepoint)');

console.log(failed === 0 ? 'PASS test-bch-14 (Part 8 zero-egress tripwire holds)' : ('FAIL test-bch-14 (' + failed + ' assertion(s) failed)'));
process.exit(failed === 0 ? 0 : 1);
