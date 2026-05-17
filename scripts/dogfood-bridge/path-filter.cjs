'use strict';
// Phase 260517-dcw Task 1: dog-food bridge path filter (pure function).
//
// Closed allowlist + closed ignorelist. Returns true when an absolute path should
// trigger the dog-food bridge (queue-append + emit + derive). Returns false when
// the path is outside the plugin tree, in an ignored subtree, or not in the
// allowlist.
//
// Canon Part 6 (Product-as-Venture): every Edit/Write/MultiEdit on the plugin
//   repo that matches this filter becomes a `file_changed` memory_event in
//   ~/MindrianRooms/mindrian/room.db (via scripts/dogfood-emit.cjs).
// Canon Part 8 (Graph Boundary): this module is LOCAL-only -- zero require()s
//   beyond node:path; zero I/O; zero network surface; pure function.
//
// This module is the SOURCE OF TRUTH for the dog-food allowlist. The bash hook
// (scripts/dogfood-bridge/append-to-queue.sh) mirrors this list verbatim as a
// case-statement inline, because spawning node per Edit would blow the <5ms
// performance budget. The integration test (tests/test-dogfood-path-filter.cjs)
// asserts every classification in this module; the bash mirror is byte-equivalent
// by construction (same allow/ignore prefixes, same exact-file allowlist).

const path = require('node:path');

const PLUGIN_ROOT = '/home/jsagi/MindrianOS-Plugin';

// Closed allowlist (subtrees under PLUGIN_ROOT that DO trigger the bridge).
const ALLOW_PREFIXES = [
  'commands/',
  'skills/',
  'agents/',
  'scripts/',
  'lib/',
  'docs/',
  '.planning/phases/',
];

// Closed allowlist (exact files under PLUGIN_ROOT that DO trigger the bridge).
const ALLOW_FILES = [
  'CHANGELOG.md',
  '.claude-plugin/plugin.json',
  '.planning/v1.13.1-EXECUTION-PLAN.md',
];

// Phase CONTEXT.md regex (additional allowlist for venture phase artifacts).
const ALLOW_PHASE_FILES = /^\.planning\/phases\/[^/]+\/[^/]+-CONTEXT\.md$/;

// Closed ignorelist (always wins even if it matches an allow prefix).
const IGNORE_PREFIXES = [
  '.planning/quick/',
  'node_modules/',
  '.git/',
  'tmp/',
  '.backups/',
];

function matchesDogfoodFilter(absPath) {
  if (typeof absPath !== 'string' || absPath.length === 0) return false;
  const normalized = path.normalize(absPath);
  // Outside the plugin tree -> ignore.
  if (!normalized.startsWith(PLUGIN_ROOT + path.sep) && normalized !== PLUGIN_ROOT) return false;
  const rel = normalized.slice(PLUGIN_ROOT.length + 1).split(path.sep).join('/');
  // Ignore wins over allow (closed ignorelist).
  for (const pref of IGNORE_PREFIXES) {
    if (rel.startsWith(pref)) return false;
  }
  // Allow subtree prefixes.
  for (const pref of ALLOW_PREFIXES) {
    if (rel.startsWith(pref)) return true;
  }
  // Allow exact files.
  for (const f of ALLOW_FILES) {
    if (rel === f) return true;
  }
  // Phase CONTEXT.md regex (e.g. .planning/phases/124-feynman-temporal-awareness/124-CONTEXT.md).
  if (ALLOW_PHASE_FILES.test(rel)) return true;
  return false;
}

module.exports = {
  matchesDogfoodFilter,
  PLUGIN_ROOT,
  ALLOW_PREFIXES,
  ALLOW_FILES,
  ALLOW_PHASE_FILES,
  IGNORE_PREFIXES,
};
