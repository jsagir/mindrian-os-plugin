#!/usr/bin/env node
// Phase 194 FLOOR 2 -- last_modified_at CAS-token coverage discipline.
//
// The reconcile-guard's lost-update token is nodes.last_modified_at. A token
// only detects drift if EVERY content-mutating writer bumps it. The PATTERNS
// audit (194-PATTERNS.md CRITICAL FINDING) proved that today THREE same-node
// UPDATE sites mutate `properties`/`review_status` WITHOUT bumping the token:
//   - lib/core/navigation/abstraction-claim.cjs (persistAbstractionLevel)
//   - lib/core/breakthrough/verb-dispatch.cjs   (read-merge-write)
//   - lib/core/breakthrough/scanner.cjs         (read-merge-write)
// Wave 4 (194-06 Task 1) repairs these. This floor is the guardrail that stops
// a FUTURE writer from silently re-opening the hole (threat T-194-01).
//
// It asserts: every `UPDATE nodes SET` in the navigation dir + the two
// breakthrough read-merge-write sites that touches `properties` or
// `review_status` ALSO contains `last_modified_at`, EXCEPT the two allowlisted
// node-birth sites (typed-domain.cjs + room-birth.cjs), where a co-session
// cannot hold a readVersion of a node being born, so the token is not required.
//
// SELF-SKIP CONTRACT: this floor FAILs RED today (the three sites above are not
// yet repaired -- that is Wave 4's job). So it self-skips (exit 0 with a SKIP
// notice) until the Wave-4 sentinel lib/core/navigation/reconcile-guard.cjs
// lands. The harness ALSO run_if-gates it on that same sentinel. Once Wave 4
// lands the guard AND repairs the sites, this flips to a hard green run.
//
// Node built-in assert only. No runner dep. No em-dashes.

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Phase 194-06 Task 1: FLIPPED to a HARD run. Wave 4 repaired the four
// read-merge-write UPDATE sites (abstraction-claim + both breakthrough sites +
// check-pending), so the last_modified_at coverage floor now runs unconditionally.
// The former Wave-4 self-skip sentinel (lib/core/navigation/reconcile-guard.cjs)
// is removed; this floor is the standing guardrail against a future writer
// re-opening the lost-update hole (threat T-194-14).

// The scan surface: every source .cjs in the navigation dir (which includes
// abstraction-claim.cjs, transitions.cjs, typed-domain.cjs, room-birth.cjs)
// plus the two breakthrough read-merge-write sites. Test files excluded.
const NAV_DIR = path.join(ROOT, 'lib/core/navigation');
const scanFiles = [];
for (const name of fs.readdirSync(NAV_DIR)) {
  if (name.endsWith('.test.cjs')) continue;
  if (!name.endsWith('.cjs')) continue;
  scanFiles.push(path.join(NAV_DIR, name));
}
scanFiles.push(path.join(ROOT, 'lib/core/breakthrough/verb-dispatch.cjs'));
scanFiles.push(path.join(ROOT, 'lib/core/breakthrough/scanner.cjs'));

// Node-birth / bookkeeping sites: a co-session cannot hold a readVersion of a
// node being born, so a blind review_status='confirmed' at birth need not carry
// the CAS token. Each is allowlisted WITH the rationale named inline.
const ALLOWLIST = {
  'typed-domain.cjs': 'node-birth: blind review_status=confirmed on a just-typed domain node; no co-session readVersion can exist',
  'room-birth.cjs': 'room-birth bookkeeping: blind review_status=confirmed on a Section at room creation; no co-session readVersion can exist',
  'typed-frame.cjs': 'node-birth: blind review_status=confirmed on a just-composed Frame node (type minted Phase 205, identical shape to typed-domain); no co-session readVersion can exist',
};

const CONTENT_TOKENS = ['properties', 'review_status'];

let checked = 0;
let allowed = 0;
const violations = [];

for (const abs of scanFiles) {
  if (!fs.existsSync(abs)) continue;
  const base = path.basename(abs);
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('UPDATE nodes SET')) return;
    const touchesContent = CONTENT_TOKENS.some((t) => line.includes(t));
    if (!touchesContent) return; // e.g. a pure created_at/last_seen_at bump is not a content mutation
    if (Object.prototype.hasOwnProperty.call(ALLOWLIST, base)) {
      allowed += 1;
      return; // documented node-birth exclusion
    }
    checked += 1;
    if (!line.includes('last_modified_at')) {
      violations.push(`${path.relative(ROOT, abs)}:${i + 1} -- UPDATE mutates content but omits last_modified_at`);
    }
  });
}

if (violations.length > 0) {
  console.error('FAIL: last_modified_at coverage floor -- content UPDATE(s) bypass the CAS token:');
  for (const v of violations) console.error('  - ' + v);
  console.error('Every content-mutating `UPDATE nodes SET` must also set last_modified_at (except the allowlisted node-birth sites).');
  assert.fail('last_modified_at coverage floor violated');
}

console.log(`PASS: test-194-lastmod-discipline -- ${checked} content UPDATE site(s) carry last_modified_at; ${allowed} allowlisted node-birth site(s) excluded with rationale`);
process.exit(0);
