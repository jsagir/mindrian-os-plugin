#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-18 (RE-SCOPED): the role_blend PRODUCER at room creation already EXISTS
// (room-birth.cjs:426 writeUserMdAtomic, Phase 155 - the bundle's "GAP 1" was STALE,
// see 177-RESEARCH.md sec 0/3). The real work is UPSTREAM: compute a single-axis blend
// { canonical_role: 1.0 } from the dual-path/shallow-doc scalar (mirror
// persona-override.cjs:280-281) and thread it to birthRoom opts.roleBlend via the
// graph-self-heal caller. This suite proves: (1) the helper computes a single-axis blend
// and degrades to null (never fabricates); (2) graph-self-heal threads it into the EXISTING
// producer; (3) NO duplicate writeUserMdAtomic producer was added; (4) the producer it
// threads into actually exists. Part 8: the blend is role-key + 1.0 only (no user content).
//
// Pure node asserts, no deps.

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-18-persona-write ---');

// (1) The single-axis blend helper (unit).
const sdp = require(path.join(ROOT, 'lib/core/shallow-doc-parser.cjs'));
ok(typeof sdp.blendFromCanonicalRole === 'function', 'shallow-doc-parser exports blendFromCanonicalRole');

const f = sdp.blendFromCanonicalRole('Founder');
ok(f && f.founder === 1.0 && Object.keys(f).length === 1, "blendFromCanonicalRole('Founder') => single-axis { founder: 1.0 }");

const de = sdp.blendFromCanonicalRole('Domain Expert');
ok(de && de.domain_expert === 1.0, "case/space normalized: 'Domain Expert' => { domain_expert: 1.0 }");

const stu = sdp.blendFromCanonicalRole('student');
ok(stu && stu.student === 1.0, "lowercase scalar maps: 'student' => { student: 1.0 }");

// Degrade: absent / empty / unmappable => null, NEVER a fabricated blend.
ok(sdp.blendFromCanonicalRole('') === null, "empty scalar => null (cold-start, never fabricate)");
ok(sdp.blendFromCanonicalRole(undefined) === null, 'undefined scalar => null');
ok(sdp.blendFromCanonicalRole('NotARealRole') === null, "unmappable scalar => null (never invent a role)");

// Single-axis invariant: a valid blend sums to exactly 1.0 on exactly one key.
const sum = Object.values(f).reduce((a, b) => a + b, 0);
ok(sum === 1.0 && Object.keys(f).length === 1, 'a computed blend is single-axis and sums to 1.0');

// (2) graph-self-heal threads the computed blend into birthRoom opts.roleBlend.
const HEAL = path.join(ROOT, 'lib/core/graph-self-heal.cjs');
const healSrc = fs.readFileSync(HEAL, 'utf8');
ok(/blendFromCanonicalRole/.test(healSrc), 'graph-self-heal imports/uses blendFromCanonicalRole');
ok(/roleBlend\s*=\s*computedBlend|birthOpts\.roleBlend\s*=\s*computedBlend/.test(healSrc),
  'graph-self-heal threads computedBlend into birthRoom opts.roleBlend');
ok(/canonicalRole/.test(healSrc), 'graph-self-heal reads a canonicalRole option to compute the blend');

// (3) RE-SCOPE GUARD: graph-self-heal must NOT add a duplicate writeUserMdAtomic producer.
// It threads to the EXISTING producer via birthRoom; a direct writeUserMdAtomic call here
// would mean the re-scope was misread (GAP 1 is stale).
ok(!/writeUserMdAtomic/.test(healSrc),
  'graph-self-heal does NOT call writeUserMdAtomic directly (re-scope: thread to existing producer, no duplicate)');
ok(/birthRoom\s*\(/.test(healSrc), 'graph-self-heal threads through the existing birthRoom producer');

// (4) The existing producer is real (GAP 1 was stale): room-birth.cjs writes role_blend
// via writeUserMdAtomic.
const BIRTH = path.join(ROOT, 'lib/core/navigation/room-birth.cjs');
ok(fs.existsSync(BIRTH), 'lib/core/navigation/room-birth.cjs exists (the producer)');
const birthSrc = fs.readFileSync(BIRTH, 'utf8');
ok(/writeUserMdAtomic/.test(birthSrc), 'room-birth.cjs calls writeUserMdAtomic (the existing producer)');
ok(/role_blend/.test(birthSrc), 'room-birth.cjs writes role_blend (GAP 1 was STALE - producer already shipped)');

// (5) Part 8: the blend object carries only the role key + numeric weight, no user content.
const onlyScalar = Object.entries(f).every(([k, v]) => typeof k === 'string' && typeof v === 'number');
ok(onlyScalar, 'Part 8: blend carries only role-key + numeric weight (no user content, no egress)');

console.log(failed === 0 ? 'PASS test-bch-18 (BCH-18 re-scoped: single-axis blend threaded to the existing producer)' : ('FAIL test-bch-18 (' + failed + ' failed)'));
process.exit(failed === 0 ? 0 : 1);
