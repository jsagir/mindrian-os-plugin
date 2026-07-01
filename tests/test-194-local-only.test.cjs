#!/usr/bin/env node
// Phase 194 FLOOR 1 -- Part 8 (Graph Boundary) local-only source-grep.
//
// The constitution (CLAUDE.md Part 8): session files, presence ledgers, the
// version stamp, and the reconcile are ALL local filesystem + room.db. ZERO
// Brain egress. No binding/reconcile byte crosses the wire.
//
// This floor greps every NEW 194 module that EXISTS for a Brain/network token
// and FAILs the build if one appears. It is authorable and GREEN in Wave 0
// because zero 194 modules exist yet (nothing to flag), and it stays green as
// each module lands clean. It is the mitigation the research A-log names for the
// "a future 194 module egresses to Brain" threat (T-194-02).
//
// Node built-in assert only. No runner dep. No em-dashes.

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// The NET-NEW 194 module surface. Files that do not yet exist are skipped from
// the grep (Wave 0 has none of these; the floor tightens as each lands).
const NEW_194_MODULES = [
  'lib/core/session-binding.cjs',
  'lib/core/session-presence.cjs',
  'lib/core/navigation/reconcile-guard.cjs',
  'lib/workflow/session-binding-consumer.cjs',
  'lib/workflow/reconcile-f9-adapter.cjs',
  'scripts/session-end-presence.cjs',
  'scripts/reassign-primary.cjs',
];

// Brain / network tokens. A local-only module must contain NONE of these.
// Kept deliberately precise: the token is `mindrian-brain` (the Brain host),
// not the bare word `Brain` (a comment may legitimately say "ZERO Brain egress").
const FORBIDDEN_TOKENS = [
  'fetch',
  'http',
  'https',
  'mindrian-brain',
  'McpServer',
  'onrender',
  'axios',
  'node:https',
];

let scanned = 0;
const violations = [];

for (const rel of NEW_194_MODULES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue; // not landed yet -> nothing to grep
  scanned += 1;
  const src = fs.readFileSync(abs, 'utf8');
  for (const token of FORBIDDEN_TOKENS) {
    if (src.includes(token)) {
      violations.push(`${rel}: forbidden token '${token}'`);
    }
  }
}

if (violations.length > 0) {
  console.error('FAIL: Part 8 local-only floor -- Brain/network token(s) found in a 194 module:');
  for (const v of violations) console.error('  - ' + v);
  console.error('A 194 module must be entirely LOCAL (filesystem + room.db). No Brain egress.');
  assert.fail('Part 8 local-only floor violated');
}

console.log(`PASS: test-194-local-only (Part 8 floor) -- ${scanned} of ${NEW_194_MODULES.length} 194 modules present, zero Brain/network token`);
process.exit(0);
