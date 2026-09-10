#!/usr/bin/env node
'use strict';

/**
 * Quick task 260910-h32 -- no-brain-write-from-scripts regression test
 * ==========================================================================
 * Canon Part 8 forbids LOCAL -> BRAIN user-data egress. scripts/sync-rooms-brain
 * was a script-level writer that string-interpolated room name, venture name,
 * stage, status and path into a Cypher MERGE and POSTed it to the live Brain on
 * every session start and every room create/archive -- a constitutional breach
 * regardless of whether the destination accepted the writes. It was deleted
 * 2026-09-10 (quick task 260910-h32). This is a default-deny census over every
 * tracked file under scripts/ so a script-level Brain write cannot come back
 * silently, under this name or any other.
 *
 * Evidence trail (cited per CLAUDE.md's Dev-Research Compositing rule):
 * ~/MindrianRooms/rethinking-mindrianos/research/2026-09-10-sync-rooms-brain-egress-observed.md
 * (1,498 brain_write POSTs observed, 55 distinct Room names, one run, 2026-09-10).
 *
 * Five arms:
 *   Arm 1 - the deletion holds: scripts/sync-rooms-brain absent on disk.
 *   Arm 2 - the name is gone: zero tracked scripts/ files mention the literal
 *           string "sync-rooms-brain", comments included (raw text, no strip).
 *   Arm 3 - default-deny census: comment-stripped, zero unlisted matches for
 *           brain.write( or callTool('brain_write') under scripts/.
 *   Arm 4 - allowlist reconciliation, both directions: every ALLOWLIST entry
 *           exists on disk AND still produces a hit; a stale entry fails loudly.
 *   Arm 5 - mutation leg: the matcher runs against synthetic in-memory fixtures
 *           so a regex-rot or comment-strip bug that silently stops matching
 *           (or starts over-matching) is caught, not just Arms 2-4 passing
 *           vacuously.
 *
 * Comment-stripping caveat: this test strips comments BEFORE matching the two
 * call patterns, since a comment cannot egress. Dropping text after an
 * unquoted `//` (.cjs/.js) or `#` (extensionless bash) can, in principle,
 * truncate a line whose `//` or `#` sits inside a string literal. The effect
 * is strictly FEWER false positives, never more -- a real call could only be
 * hidden by this, never invented. Arm 5 is what proves the matcher still
 * detects real calls after stripping, so a regression here is caught by a red
 * Arm 5, not a silently-vacuous Arm 3.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const BRAIN_WRITE_CALL = /\bbrain\s*\.\s*write\s*\(/;
const CALLTOOL_BRAIN_WRITE = /callTool\s*\(\s*['"`]brain_write['"`]/;

// Frozen, default-deny. Anything producing a hit that is NOT listed here is a
// failure (Arm 3). Membership was derived by running this census once before
// freezing: only a file that ACTUALLY produces a hit belongs here (Arm 4b) --
// a file whose only mention is prose (for example scripts/seed-brain-commands.cjs,
// whose "brain_write" references are inside comments, or
// scripts/admin-brain-write.cjs, which gates the admin write behind a direct
// Neo4j driver session and never calls brain.write( or callTool('brain_write')
// itself) does NOT survive comment stripping and is correctly NOT allowlisted.
const ALLOWLIST = Object.freeze([
  Object.freeze({
    path: 'scripts/whitespace-to-brain.cjs',
    reason:
      'pre-existing dev-pipeline Brain writer invoked only from ' +
      'scripts/discovery-cycle.cjs:446; out of scope for quick task 260910-h32; ' +
      'a known open surface, not a cleared one -- mirrors the reasoning at ' +
      'tests/test-252-guard-census.cjs:179 ("dev pipeline; visible skip")',
  }),
]);

const ALLOWLIST_PATHS = new Set(ALLOWLIST.map((e) => e.path));

/**
 * Strips comments from source text before pattern matching, since a comment
 * cannot egress. Drops block comments (/ * ... * /, non-greedy) first, then
 * per line drops text after `//` for .cjs/.js files and after an unquoted `#`
 * for extensionless bash scripts. See header docblock for the false-positive
 * -only caveat this introduces; Arm 5 proves the matcher still detects real
 * calls after stripping.
 */
function stripComments(sourceText, isBashLike) {
  const noBlockComments = sourceText.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = noBlockComments.split('\n');
  const strippedLines = lines.map((line) => {
    if (isBashLike) {
      const idx = line.indexOf('#');
      if (idx === -1) return line;
      const before = line.slice(0, idx);
      const singleQuotes = (before.match(/'/g) || []).length;
      const doubleQuotes = (before.match(/"/g) || []).length;
      // Crude unquoted check: only strip when quotes balance on the prefix.
      // An imbalance means the # likely sits inside an open quote, so this
      // line is left alone -- fewer false positives, never more (see header).
      if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
        return line.slice(0, idx);
      }
      return line;
    }
    const idx = line.indexOf('//');
    if (idx === -1) return line;
    return line.slice(0, idx);
  });
  return strippedLines.join('\n');
}

function isBashLikePath(relPath) {
  return !(relPath.endsWith('.cjs') || relPath.endsWith('.js'));
}

/**
 * findBrainWriteHits(sourceText, relPath) -> [{ pattern, line }]
 * Local (not module-exported, this file has no other consumer) so Arm 5 can
 * drive it directly against synthetic fixtures.
 */
function findBrainWriteHits(sourceText, relPath) {
  const stripped = stripComments(sourceText, isBashLikePath(relPath || ''));
  const lines = stripped.split('\n');
  const hits = [];
  lines.forEach((line, idx) => {
    if (BRAIN_WRITE_CALL.test(line)) {
      hits.push({ pattern: 'brain.write(', line: idx + 1 });
    }
    if (CALLTOOL_BRAIN_WRITE.test(line)) {
      hits.push({ pattern: "callTool('brain_write')", line: idx + 1 });
    }
  });
  return hits;
}

function listTrackedScriptFiles() {
  const out = execFileSync('git', ['ls-files', 'scripts/'], {
    cwd: REPO,
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

function readFileSafe(relPath) {
  const abs = path.join(REPO, relPath);
  try {
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return null; // crude binary check: a NUL byte
    return buf.toString('utf8');
  } catch (_err) {
    return null; // unreadable (e.g. broken symlink); skip without failing
  }
}

const failures = [];
function fail(msg) {
  failures.push(msg);
}

// ---------------------------------------------------------------------------
// Arm 1: the deletion holds
// ---------------------------------------------------------------------------
const deletedScriptAbs = path.join(REPO, 'scripts', 'sync-rooms-brain');
if (fs.existsSync(deletedScriptAbs)) {
  fail('Arm 1: scripts/sync-rooms-brain exists on disk; it must stay deleted');
}

// ---------------------------------------------------------------------------
// Census: enumerate tracked files under scripts/ (git ls-files, not a
// directory walk, so the set is tracked-files-only and deterministic).
// ---------------------------------------------------------------------------
const files = listTrackedScriptFiles();
assert.ok(files.length > 0, 'expected a non-empty scripts/ census from git ls-files');

// ---------------------------------------------------------------------------
// Arm 2: the name is gone (raw text, comments included, no stripping)
// ---------------------------------------------------------------------------
for (const relPath of files) {
  const raw = readFileSafe(relPath);
  if (raw === null) continue;
  if (raw.includes('sync-rooms-brain')) {
    fail(`Arm 2: ${relPath} still mentions the literal string "sync-rooms-brain"`);
  }
}

// ---------------------------------------------------------------------------
// Arm 3 + Arm 4: default-deny census, both allowlist directions
// ---------------------------------------------------------------------------
const hitFiles = new Set();
for (const relPath of files) {
  const raw = readFileSafe(relPath);
  if (raw === null) continue;
  const hits = findBrainWriteHits(raw, relPath);
  if (hits.length === 0) continue;
  hitFiles.add(relPath);
  if (!ALLOWLIST_PATHS.has(relPath)) {
    for (const hit of hits) {
      fail(`Arm 3: ${relPath}:${hit.line} matches ${hit.pattern} and is not in ALLOWLIST`);
    }
  }
}

// Arm 4a: every ALLOWLIST entry still exists on disk / is still tracked
for (const entry of ALLOWLIST) {
  if (!files.includes(entry.path)) {
    fail(`Arm 4: ALLOWLIST entry ${entry.path} does not exist / is not tracked under scripts/`);
  }
}

// Arm 4b: every ALLOWLIST entry still produces a hit (not stale)
for (const entry of ALLOWLIST) {
  if (!hitFiles.has(entry.path)) {
    fail(`Arm 4: ALLOWLIST entry ${entry.path} produces no brain-write hit; it is stale and must be removed`);
  }
}

// ---------------------------------------------------------------------------
// Arm 5: mutation leg -- prove the oracle is not vacuous
// ---------------------------------------------------------------------------
const POSITIVE_FIXTURE_DOT_WRITE = [
  '// some header comment',
  'async function run() {',
  '  const result = await brain.write(cypher);',
  '  return result;',
  '}',
  '',
].join('\n');

const POSITIVE_FIXTURE_CALLTOOL = [
  'async function call(client) {',
  "  return client.callTool('brain_write', { cypher });",
  '}',
  '',
].join('\n');

const NEGATIVE_FIXTURE = [
  "// this comment mentions brain.write( and callTool('brain_write') but is prose",
  'async function run() {',
  '  const result = await brain.read(cypher);',
  '  return result;',
  '}',
  '',
].join('\n');

const posHitsDotWrite = findBrainWriteHits(POSITIVE_FIXTURE_DOT_WRITE, 'fixture.cjs');
if (posHitsDotWrite.length === 0) {
  fail('Arm 5: matcher failed to detect a real "await brain.write(cypher)" call in a positive fixture');
}

const posHitsCallTool = findBrainWriteHits(POSITIVE_FIXTURE_CALLTOOL, 'fixture.cjs');
if (posHitsCallTool.length === 0) {
  fail("Arm 5: matcher failed to detect a real \"callTool('brain_write', { cypher })\" call in a positive fixture");
}

const negHits = findBrainWriteHits(NEGATIVE_FIXTURE, 'fixture.cjs');
if (negHits.length !== 0) {
  fail(`Arm 5: matcher produced ${negHits.length} false-positive hit(s) on a fixture whose only mentions are commented-out prose`);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (failures.length > 0) {
  console.error('FAILED: test-quick-260910-h32-no-brain-write-from-scripts.cjs');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}

console.log('PASSED: test-quick-260910-h32-no-brain-write-from-scripts.cjs');
console.log('  Arm 1: scripts/sync-rooms-brain absent on disk');
console.log(`  Arm 2: zero of ${files.length} tracked scripts/ files mention "sync-rooms-brain"`);
console.log(`  Arm 3: default-deny census clean (allowlisted hit file(s): ${[...hitFiles].join(', ') || 'none'})`);
console.log(`  Arm 4: ALLOWLIST reconciled both directions (${ALLOWLIST.length} entr${ALLOWLIST.length === 1 ? 'y' : 'ies'})`);
console.log('  Arm 5: mutation leg confirms the matcher detects real calls and clears prose-only mentions');
process.exit(0);
