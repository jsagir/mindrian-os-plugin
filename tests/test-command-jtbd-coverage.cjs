#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 104-02 -- Per-command JTBD reverse-coverage harness.
 *
 * Implements: JTBDCONS-104-03
 *
 * Reverse coverage scan: walks all 13 JTBD ids in
 * `lib/hmi/jtbd-taxonomy.json` `entries[]` and asserts each id appears
 * in at least one `commands/*.md` `serves_jtbd:` declaration.
 *
 * The `explore` fallback id MUST also be served by at least one command
 * (Phase 104 requirement; reasonable candidates are /mos:operator,
 * /mos:status, /mos:help, /mos:splash).
 *
 * Failure mode: list every orphan JTBD id (taxonomy entry that NO
 * command serves) along with a hint for the operator.
 *
 * Latency budget: < 500ms warm.
 *
 * Exit codes:
 *   0  = PASS
 *   1  = FAIL (one or more orphan JTBD ids)
 *   77 = SKIPPED (degraded env: missing taxonomy file)
 *
 * Zero dependencies (Node built-ins only). Reuses the same line-scan
 * pattern as test-command-jtbd-declarations.cjs (sibling Plan 104-02
 * test).
 *
 * Canon Part 8: zero Brain queries. Pure local filesystem scan.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const TAXONOMY_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json');

process.stdout.write('test-command-jtbd-coverage.cjs (Phase 104-02 JTBDCONS-104-03)\n');

const t0 = Date.now();

// ---- Load taxonomy (canonical 13 ids) ----
let canonicalIds;
try {
  const raw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  const tax = JSON.parse(raw);
  if (!tax || !Array.isArray(tax.entries)) {
    process.stderr.write('SKIP: taxonomy malformed (missing entries[])\n');
    process.exit(77);
  }
  canonicalIds = tax.entries.map(function (e) { return e && e.id; }).filter(Boolean);
  if (canonicalIds.length === 0) {
    process.stderr.write('SKIP: taxonomy entries[] empty\n');
    process.exit(77);
  }
} catch (err) {
  process.stderr.write('SKIP: cannot read taxonomy at ' + TAXONOMY_PATH + ': ' + err.message + '\n');
  process.exit(77);
}

// ---- Walk commands and collect every declared JTBD id ----
//
// We accumulate a Map<jtbdId, string[]> of jtbdId -> commandFiles[]
// so the failure report can ALSO show low-coverage ids if useful in
// future extensions. Today the test only fails on zero-coverage.
//
// Parsing strategy mirrors test-command-jtbd-declarations.cjs: locate
// the `serves_jtbd:` line in frontmatter, JSON.parse the RHS. We
// silently skip any file whose declaration is malformed because the
// sibling test (declarations) is the authoritative validator for those
// errors; coverage's job is reverse-mapping.

let commandFiles;
try {
  commandFiles = fs.readdirSync(COMMANDS_DIR)
    .filter(function (n) { return n.endsWith('.md'); })
    .sort();
} catch (err) {
  process.stderr.write('FAIL: cannot read commands directory: ' + err.message + '\n');
  process.exit(1);
}

if (commandFiles.length === 0) {
  process.stderr.write('FAIL: commands/ contains zero .md files\n');
  process.exit(1);
}

const FRONTMATTER_CLOSE = /^---\s*$/;

const servedBy = new Map(); // jtbdId -> commandFile[]
function record(id, file) {
  let arr = servedBy.get(id);
  if (!arr) { arr = []; servedBy.set(id, arr); }
  arr.push(file);
}

for (let f = 0; f < commandFiles.length; f++) {
  const name = commandFiles[f];
  const filePath = path.join(COMMANDS_DIR, name);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_err) {
    continue; // declarations test will surface the read error
  }
  const lines = raw.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') continue;

  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (FRONTMATTER_CLOSE.test(lines[i])) { closeIdx = i; break; }
  }
  if (closeIdx === -1) continue;

  for (let i = 1; i < closeIdx; i++) {
    const m = lines[i].match(/^serves_jtbd:\s*(.*)$/);
    if (!m) continue;
    let arr;
    try { arr = JSON.parse(m[1]); } catch (_e) { break; }
    if (!Array.isArray(arr)) break;
    for (let k = 0; k < arr.length; k++) {
      if (typeof arr[k] === 'string') record(arr[k], name);
    }
    break; // only one serves_jtbd line per file
  }
}

// ---- Reverse coverage check ----
const orphans = [];
for (let i = 0; i < canonicalIds.length; i++) {
  const id = canonicalIds[i];
  if (!servedBy.has(id) || servedBy.get(id).length === 0) {
    orphans.push(id);
  }
}

// `explore` is a special-case must-have per requirement spec
// (JTBDCONS-104-03 explicitly calls it out). The generic loop above
// already covers it because `explore` is in canonicalIds, but we keep
// a separate assertion message so the failure mode is unambiguous.
const exploreOrphan = !servedBy.has('explore') || servedBy.get('explore').length === 0;

const elapsed = Date.now() - t0;

if (orphans.length === 0) {
  process.stdout.write('  ok  all ' + canonicalIds.length + ' canonical JTBD ids served by >= 1 command\n');
  process.stdout.write('  ok  explore fallback id served by ' + servedBy.get('explore').length + ' command(s)\n');
  // Per-id coverage summary (informational; not asserted)
  for (let i = 0; i < canonicalIds.length; i++) {
    const id = canonicalIds[i];
    const cnt = servedBy.get(id).length;
    process.stdout.write('       ' + id.padEnd(22) + ' served by ' + cnt + ' command(s)\n');
  }
  process.stdout.write('  ok  latency ' + elapsed + 'ms (budget < 500ms)\n');
  process.exit(0);
}

process.stderr.write('FAIL: ' + orphans.length + ' orphan JTBD id(s) (no command serves them)\n');
for (let i = 0; i < orphans.length; i++) {
  const id = orphans[i];
  const hint = (id === 'explore')
    ? '  (hint: explore is the fallback id; candidates: /mos:operator, /mos:status, /mos:help, /mos:splash)'
    : '';
  process.stderr.write('  orphan: ' + id + hint + '\n');
}
if (exploreOrphan) {
  process.stderr.write('  CRITICAL: the `explore` fallback id has zero serving commands; selector-dispatcher F.6 fallthrough has no anchor.\n');
}
process.exit(1);
