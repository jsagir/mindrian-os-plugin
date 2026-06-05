'use strict';
// RETR-03 + D-03a (Phase 141) -- adversarial Canon Part 8 / Part 9 source sweep
// over lib/core/navigation/room-context.cjs.
//
// Mirrors the forbidden-substring + forbidden-require idiom of
// tests/test-feynman-timeline-canon-part-9-invariant.cjs. Asserts the fusion
// module returns RAW prose and never reaches for the packet.cjs egress
// projection (which hashes prose under the default local_summary_only mode):
//   (1) ZERO require of any *packet* module
//   (2) ZERO use of the forbidden projection tokens
//       {projectText, shortText, hashText, safeNodeProjection,
//        resolvePrivacyMode, PRIVACY_MODES}
//   (3) ZERO sha256 / createHash call sites
//
// RED now: room-context.cjs does not exist, so the file-present assertion fails.
// Once Wave-1 lands the file, the sweep enforces the clean invariant.
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'room-context.cjs');

assert.ok(
  fs.existsSync(TARGET),
  'RETR-03: lib/core/navigation/room-context.cjs must exist (RED until Wave-1 lands it)'
);

const src = fs.readFileSync(TARGET, 'utf8');

const FORBIDDEN_REQUIRES = [
  /require\s*\(\s*['"][^'"]*packet[^'"]*['"]\s*\)/,
  /require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/,
];

const FORBIDDEN_TOKENS = [
  'projectText',
  'shortText',
  'hashText',
  'safeNodeProjection',
  'safeContradictionProjection',
  'safeUnsupportedProjection',
  'resolvePrivacyMode',
  'PRIVACY_MODES',
];

const FORBIDDEN_CALLS = [
  /\bsha256\b/i,
  /createHash\s*\(/,
];

for (const rx of FORBIDDEN_REQUIRES) {
  assert.equal(rx.test(src), false, 'room-context.cjs must not match forbidden require: ' + rx);
}

for (const tok of FORBIDDEN_TOKENS) {
  assert.equal(
    src.indexOf(tok), -1,
    'room-context.cjs must not reference the egress-projection token: ' + tok
  );
}

for (const rx of FORBIDDEN_CALLS) {
  assert.equal(rx.test(src), false, 'room-context.cjs must not match forbidden hash call: ' + rx);
}

// Regression: the module must compose from the shipped readers, proving the
// sweep scans the right file (mirror the Phase 124 "imports navigation" check).
assert.match(
  src,
  /require\s*\(\s*['"][^'"]*neighborhood[^'"]*['"]\s*\)/,
  'room-context.cjs must require the neighborhood reader (Leg C)'
);

process.stdout.write('PASS test-room-context-part8-invariant.cjs (RETR-03 Part-8 source sweep)\n');
process.exit(0);
