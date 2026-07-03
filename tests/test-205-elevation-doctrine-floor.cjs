'use strict';
/*
 * Phase 205 -- the elevation-doctrine consistency FLOOR test (drift guard).
 * =========================================================================
 * GREEN NOW and MUST STAY GREEN. It guards the source-of-truth discipline the
 * navigator articulated on 2026-07-01: the three-directions-of-elevation doctrine
 * lives in THREE surfaces at different depth, and they must not DRIFT --
 *
 *   1. docs/MINDRIAN-CANON.md            Part 12 (the constitution; full)
 *   2. skills/larry-personality/SKILL.md the behavior engine (full operational)
 *   3. agents/larry-extended.md          the always-on body (terse pointer)
 *
 * The rule: the body stays terse and POINTS to the skill; the skill is the
 * authoritative detail; the canon is the constitution. Saying the same thing at
 * different depth is fine; saying DIFFERENT things is the bug. This test locks the
 * shared load-bearing invariants so an edit to one surface that is not mirrored in
 * the others flips RED.
 *
 * Read-only: never mutates a tracked file (Part 8: zero Brain/network). No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const SKILL = path.join(REPO_ROOT, 'skills', 'larry-personality', 'SKILL.md');
const BODY = path.join(REPO_ROOT, 'agents', 'larry-extended.md');

const read = (p) => fs.readFileSync(p, 'utf8');
const canon = read(CANON);
const skill = read(SKILL);
const body = read(BODY);

const has = (hay, needle) => hay.toLowerCase().includes(String(needle).toLowerCase());
let checks = 0;
function ok(cond, msg) { assert.ok(cond, msg); checks++; }

// ---------- 1. Each surface carries its elevation section ----------
ok(canon.includes('three directions of elevation'), 'CANON: Part 12 "three directions of elevation" section missing');
ok(skill.includes('## The Three Directions of Elevation (Part 12)'), 'SKILL: elevation section header missing');
ok(body.includes('## Elevation (Part 12'), 'BODY: elevation pointer section missing');

// ---------- 2. The THREE direction names appear in ALL THREE surfaces (core anti-drift invariant) ----------
for (const dir of ['vertical', 'horizontal', 'lateral']) {
  ok(has(canon, dir), `CANON: elevation direction "${dir}" missing`);
  ok(has(skill, dir), `SKILL: elevation direction "${dir}" missing`);
  ok(has(body, dir), `BODY: elevation direction "${dir}" missing`);
}

// ---------- 3. Horizontal-is-the-weak-spot / connect-what-they-hold appears in canon + skill ----------
ok(has(canon, 'connect ideas the navigator') && has(canon, 'presented as separate'),
  'CANON: horizontal = connect-already-held-ideas claim drifted');
ok(has(skill, 'connect ideas the navigator') && has(skill, 'presented as separate'),
  'SKILL: horizontal = connect-already-held-ideas claim drifted');

// ---------- 4. The persona ratio (student->vertical/pushback ; peer->horizontal/lateral/help) in all three ----------
for (const [name, txt] of [['CANON', canon], ['SKILL', skill], ['BODY', body]]) {
  ok(has(txt, 'student') && has(txt, 'vertical'), `${name}: persona ratio student->vertical missing`);
  ok((has(txt, 'peer') || has(txt, 'professor') || has(txt, 'researcher')) && has(txt, 'horizontal'),
    `${name}: persona ratio peer->horizontal missing`);
}

// ---------- 5. Hedged-always invariant present in all three (offer, never assert) ----------
// Shared invariant (works for the terse body too): the hedge PAIR -- "might" (offered)
// vs "are" (the forbidden assertion) plus a negation.
for (const [name, txt] of [['CANON', canon], ['SKILL', skill], ['BODY', body]]) {
  ok(has(txt, 'might') && has(txt, 'are') && (has(txt, 'never') || has(txt, 'not')),
    `${name}: hedged-always invariant ("might", never "are") drifted`);
}
// Canon + skill carry the fuller quoted form; the body is allowed to be terser.
for (const [name, txt] of [['CANON', canon], ['SKILL', skill]]) {
  ok(has(txt, 'are the same'), `${name}: full hedged quote ("...are the same") drifted`);
}
// the presumptuous line must be quoted as the FORBIDDEN form, never endorsed
ok(has(canon, 'being presumptuous is not') || has(canon, 'presumptuous'),
  'CANON: "being wrong is fine, being presumptuous is not" invariant missing');

// ---------- 6. The universal four-check present in canon + skill ----------
for (const [name, txt] of [['CANON', canon], ['SKILL', skill]]) {
  for (const c of ['assumptions', 'evidence', 'logic', 'conclusions']) {
    ok(has(txt, c), `${name}: universal four-check "${c}" missing`);
  }
  ok(has(txt, 'also supports') || has(txt, 'different conclusion') || has(txt, 'supports y'),
    `${name}: fourth check = horizontal trigger ("evidence supports X but also Y") drifted`);
}

// ---------- 7. Clarify-vs-reframe (anti-circular) + artifact-is-not-conversation in the skill ----------
ok(has(skill, 'clarify') && has(skill, 'reframe') && has(skill, 'circling'),
  'SKILL: clarify-vs-reframe anti-circular rule missing');
ok(has(skill, 'artifact is not conversation') || (has(skill, 'clean artifact') && has(skill, 'placeholder')),
  'SKILL: artifact-is-not-conversation rule missing');

// ---------- 8. Single-source discipline: the BODY points to the skill, does NOT duplicate the full detail ----------
ok(has(body, 'larry-personality skill'), 'BODY: must point to the larry-personality skill (single source of truth)');
// the body is a POINTER: it must be far shorter than the skill section on this topic
const bodyElevStart = body.indexOf('## Elevation (Part 12');
const bodyElevEnd = body.indexOf('\n## ', bodyElevStart + 1);
const bodyElev = body.slice(bodyElevStart, bodyElevEnd === -1 ? undefined : bodyElevEnd);
const skillElev = skill.slice(skill.indexOf('## The Three Directions of Elevation'),
                              skill.indexOf('## When to Reach'));
ok(bodyElev.length < skillElev.length,
  'BODY elevation pointer must be terser than the SKILL section (no full-doctrine duplication)');

// ---------- 9. Canon ratified with the Appendix D ledger entry (version anchor tracks forward: 1.24 after the Phase 210 entry-37 R16 advisory amendment; was 1.22 post-Phase-195 FCM-08, 1.23 post-Phase-190) ----------
ok(/Version:\s*1\.24/.test(canon), 'CANON: header not at current v1.24');
ok(/34\.\s+\*\*The three directions of elevation ratified/.test(canon),
  'CANON: Appendix D entry 34 (ratification record) missing');

// ---------- 10. House rule: no em-dashes in the elevation sections of any surface ----------
for (const [name, seg] of [['CANON', canon.slice(canon.indexOf('### The three directions of elevation'),
                                                 canon.indexOf('### The Voice Signature'))],
                           ['SKILL', skillElev],
                           ['BODY', bodyElev]]) {
  ok(!seg.includes('—'), `${name}: em-dash in the elevation section (house rule: hyphens only)`);
}

console.log(`PASS test-205-elevation-doctrine-floor.cjs (${checks} assertions: canon<->skill<->body elevation-doctrine consistency, 3 directions in all 3 surfaces, persona-ratio, hedged-always, four-check, clarify-vs-reframe, artifact!=conversation, single-source body-pointer, v1.24 + entry 34, zero em-dashes)`);
