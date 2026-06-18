#!/usr/bin/env node
/**
 * Phase 163 Plan 06 -- the Part 8 adversarial leak scan over ALL Phase-163
 * surfaces (WAVE 6 VERIFY).
 *
 * Mirrors tests/test-futures-part8-leak.cjs (the FW-11 floor) + the run-all-156.sh
 * BRAIN_WRITE + RAW_FETCH sweep philosophy: a static boundary scan over every
 * Phase-163 lib + command + skill surface asserting ZERO user-content-to-Brain /
 * raw-external-egress tokens.
 *
 * This is the phase's locality FLOOR (Canon Part 8: LOCAL data -> BRAIN: NO).
 *
 * The surfaces scanned (the load-bearing net-new ~15-20% of Phase 163):
 *   the connective-taxonomy substrate (typed-domain / get-domains-for-trends /
 *   domain-hierarchy), the trend harness (trending-to-absurd/*.cjs), and the skill
 *   surface (commands/trending-to-absurd.md + skills/trending-to-absurd/SKILL.md).
 *
 * Forbidden tokens (the canonical Part 8 breaches):
 *   - mcp__brain_(write|store|upsert|ingest)   the Brain-write MCP call.
 *   - writeBrain / sendToBrain / ingestToBrain  the brain-write helper idiom.
 *   - a raw fetch( egress in the lib code (the lib must NEVER open its own egress;
 *     the ONLY sanctioned external leg is the inherited runSignalResearch ->
 *     fetchCorpus chokepoint, which lives in the futures harness, not Phase-163
 *     code).
 *   - a hardcoded external http(s) endpoint (a github.com comment URL is allowed,
 *     mirroring the run-all-156.sh github.com carve-out).
 *
 * Each finding is collected; the suite exits non-zero with the full finding list
 * when any forbidden token is found, so a real leak is surfaced as a FINDING, never
 * silently passed.
 *
 * Single run only, no external test framework. NO em-dashes (hyphens only).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SUITE = 'test-trending-to-absurd-part8-leak';
const REPO = path.join(__dirname, '..');

// ALL Phase-163 lib + command + skill surfaces (the net-new ~15-20%). The lib
// code must carry zero egress; the command + skill prose must carry no Brain-write
// MCP directive. A missing surface is itself a finding (the scan must be exhaustive).
const SURFACES = [
  // Foundation: the connective-taxonomy substrate (Waves 2-3).
  'lib/core/navigation/typed-domain.cjs',
  'lib/core/navigation/get-domains-for-trends.cjs',
  'lib/core/synthesizers/domain-hierarchy.cjs',
  // Surfaces: the trend harness (Waves 4-5).
  'lib/core/trending-to-absurd/orchestrator.cjs',
  'lib/core/trending-to-absurd/stage7-roadmap.cjs',
  'lib/core/trending-to-absurd/variance.cjs',
  // The skill surface (Wave 4).
  'commands/trending-to-absurd.md',
  'skills/trending-to-absurd/SKILL.md',
];

// The lib-only subset (the .cjs code paths). Raw fetch( / external http(s) egress
// is forbidden in lib code; the command + skill markdown may legitimately cite a
// SIGNAL methodology by name (the prose layer is not an egress path).
const LIB_SURFACES = SURFACES.filter((s) => s.endsWith('.cjs'));

// The forbidden-token regexes (mirror the run-all-156.sh BRAIN_WRITE + RAW_FETCH
// regexes and the FW-11 floor patterns).
const BRAIN_WRITE_MCP = /mcp__brain_(write|store|upsert|ingest)/;
const BRAIN_WRITE_HELPER = /writeBrain|sendToBrain|ingestToBrain/;
// A raw fetch( call: fetch preceded by a non-identifier char (so .fetchCorpus on a
// caller-supplied corpus object -- the sanctioned chokepoint delegate -- is NOT a
// match, but a bare fetch( egress IS). Mirrors the run-all-156.sh RAW_FETCH regex
// [^a-zA-Z_]fetch[[:space:]]*\( exactly.
const RAW_FETCH = /[^a-zA-Z_.]fetch\s*\(/;
// A hardcoded external http(s) endpoint, github.com excepted (the comment-URL
// carve-out, identical to run-all-156.sh).
const EXTERNAL_HTTP = /https?:\/\/(?!github\.com)/;

const findings = [];

function scanLine(rel, lineNo, line) {
  // Filter out pure comment lines for the egress regexes where a comment could
  // self-invalidate the count (mirrors the plan's `grep -v '^#'` style filtering):
  // a `// ... fetch( ...` doc comment is prose, not an egress path. We still scan
  // the Brain-write tokens on every line (a Brain-write call in a comment is a
  // documentation smell worth flagging, and the real code carries none).
  const trimmed = line.trim();
  const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');

  if (BRAIN_WRITE_MCP.test(line)) {
    findings.push({ surface: rel, line: lineNo, token: 'mcp__brain_write/store/upsert/ingest', detail: trimmed.slice(0, 80) });
  }
  if (BRAIN_WRITE_HELPER.test(line)) {
    findings.push({ surface: rel, line: lineNo, token: 'writeBrain/sendToBrain/ingestToBrain', detail: trimmed.slice(0, 80) });
  }
}

function scanLibLine(rel, lineNo, line) {
  const trimmed = line.trim();
  const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
  // Egress regexes apply to executable lib lines only: a doc comment that
  // mentions fetch( as prose is not an egress path (the `grep -v '^#'` spirit).
  if (!isComment) {
    if (RAW_FETCH.test(line)) {
      findings.push({ surface: rel, line: lineNo, token: 'raw fetch( egress', detail: trimmed.slice(0, 80) });
    }
    if (EXTERNAL_HTTP.test(line)) {
      findings.push({ surface: rel, line: lineNo, token: 'external http(s) endpoint', detail: trimmed.slice(0, 80) });
    }
  }
}

// ---------------------------------------------------------------------------
// The scan.
// ---------------------------------------------------------------------------
console.log(SUITE);

for (const rel of SURFACES) {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs)) {
    findings.push({ surface: rel, line: 0, token: 'MISSING surface', detail: 'expected Phase-163 surface not found' });
    continue;
  }
  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    scanLine(rel, i + 1, lines[i]);
  }
  console.log('  scanned -', rel + ' (' + lines.length + ' lines)');
}

// The egress regexes apply to the lib subset only (the markdown prose layer may
// name a SIGNAL methodology without being an egress path).
for (const rel of LIB_SURFACES) {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs)) continue;
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    scanLibLine(rel, i + 1, lines[i]);
  }
}

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
if (findings.length === 0) {
  console.log('\n' + SUITE + ': PASS (zero forbidden Part 8 tokens across ' + SURFACES.length + ' Phase-163 surfaces)');
  process.exit(0);
}

console.error('\n' + SUITE + ': FAIL -- ' + findings.length + ' Part 8 finding(s):');
for (const f of findings) {
  console.error('  - [' + f.token + '] ' + f.surface + ':' + f.line + '  ' + f.detail);
}
process.exit(1);
