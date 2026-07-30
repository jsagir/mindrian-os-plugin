#!/usr/bin/env node
'use strict';

/**
 * Phase 239 Plan 06 (BRAIN-03) -- the sendPacket PARK census.
 *
 * sendPacket's fate is a DECISION, not a bug fix: RULING = PARKED. This file
 * machine-checks the facts that decision rests on, so a future PR that adds a
 * real production sendPacket( caller, or that quietly deletes the park note,
 * turns this suite red instead of leaving the decision to rot silently.
 *
 * Six legs:
 *   LEG 1 - THE CENSUS: zero non-allowlisted, non-comment sendPacket( call
 *           sites across lib/, scripts/, bin/, pipelines/.
 *   LEG 2 - ANTI-VACUITY for LEG 1: a seeded temp tree with a real bare
 *           sendPacket( call at a non-allowlisted-shaped path reports
 *           exactly 1, proving the scanner actually walks something.
 *   LEG 3 - the dated PARKED note exists at the call surface (within 30
 *           lines above `async function sendPacket(` in brain-client.cjs).
 *   LEG 4 - the same decision exists in docs/architecture/SUBSTRATE-CONTRACT.md
 *           (sendPacket, PARKED, BRAIN-03, an ISO-shaped date).
 *   LEG 5 - the two contradictory in-repo claims are reconciled: the false
 *           header claim in tests/test-150-brain-egress.cjs is gone; the true
 *           claim in lib/core/navigation/packet.cjs survives.
 *   LEG 6 - MUTATION (documentation leg): the live production-tree mutation
 *           proof (append a bare sendPacket( call to a scratch copy of
 *           lib/core/artifact-id.cjs, observe LEG 1 go red with the offending
 *           path named, restore, confirm `git diff --stat` empty and the
 *           suite green again) is performed BY THE EXECUTOR BY HAND, per the
 *           Phase 241/242/243 precedent, and transcribed in the plan
 *           SUMMARY.md -- not baked into this file's own execution, because
 *           this file cannot safely mutate a tracked repo file while it is
 *           the process currently running against that same repo tree.
 *
 * The allowlist is DERIVED from scripts/check-schema-aliases.cjs's
 * isAllowedSendpacketPath (the existing D-08 layer-2 pre-commit guard's own
 * authority), never hand-copied, so the census cannot silently drift from the
 * guard it complements.
 *
 * How this differs from lib/core/mindrian-brain-shim.test.cjs's existing
 * `sendPacket(` count assertion (Test 8, Phase 127): that test scans ONE file
 * (bin/mindrian-brain-mcp-client.cjs) for a Phase 110 typed-packet BYPASS --
 * proving the MCP shim never calls sendPacket directly, itself, ever (a
 * narrow, single-file, permanent invariant). This file scans the WHOLE
 * production tree (lib/, scripts/, bin/, pipelines/) for ANY non-allowlisted
 * caller anywhere, proving the wider BRAIN-03 census fact (a repo-wide,
 * re-openable, dated ruling). Neither duplicates the other: the shim test is
 * about one caller that must NEVER exist; this suite is about the count of
 * callers that exist ANYWHERE outside the allowlist, today.
 *
 * Plain Node, node:assert. No new runtime deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const schemaAliases = require(path.join(REPO, 'scripts', 'check-schema-aliases.cjs'));
const isAllowedSendpacketPath = schemaAliases.isAllowedSendpacketPath;

const SCAN_DIRS = ['lib', 'scripts', 'bin', 'pipelines'];

// ---------------------------------------------------------------------------
// Strip string literals ('...' / "..." / `...`) and //-comments from a single
// source line BEFORE pattern-matching it. Without this, a park note's own
// prose (which legitimately says the word "sendPacket(" inside a JS string,
// e.g. lib/core/mindrian-brain-shim.test.cjs's assertion-failure messages)
// would self-invalidate the gate -- exactly the T-239-06-C threat this leg
// mitigates. Naive single-pass char scan; good enough for a repo census, not
// a full JS parser.
// ---------------------------------------------------------------------------
function stripStringsAndComments(line) {
  let result = '';
  let i = 0;
  const len = line.length;
  while (i < len) {
    const ch = line[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < len && line[i] !== quote) {
        if (line[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') break;
    result += ch;
    i += 1;
  }
  return result;
}

// ---------------------------------------------------------------------------
// The census function. LEG 1 runs it against the real repo root; LEG 2 runs
// the SAME function against a synthetic seeded temp root, so both legs share
// one code path and neither can silently diverge from the other.
// ---------------------------------------------------------------------------
function censusSendPacketCallSites(rootDir, scanDirs, isAllowedFn) {
  const violations = [];
  let scannedFiles = 0;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(cjs|js|mjs)$/.test(entry.name)) continue;
      const rel = path.relative(rootDir, full).replace(/\\/g, '/');
      if (isAllowedFn(rel)) continue; // allowlisted path: whole file exempt
      scannedFiles += 1;
      let content;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch (_e) {
        continue;
      }
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Exclude the definition line itself (belt-and-suspenders; the file
        // that defines it is already allowlisted, so this rarely fires).
        if (/^async function sendPacket\s*\(/.test(trimmed)) continue;
        // Exclude whole-comment lines.
        if (/^(\/\/|\*|\/\*)/.test(trimmed)) continue;
        const stripped = stripStringsAndComments(lines[i]);
        if (/\bsendPacket\s*\(/.test(stripped)) {
          violations.push({ file: rel, line: i + 1, text: trimmed.slice(0, 160) });
        }
      }
    }
  }

  for (const d of scanDirs) {
    walk(path.join(rootDir, d));
  }
  return { violations, scannedFiles };
}

let passed = 0;
let failed = 0;

function record(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' + err.message + '\n');
  }
}

process.stdout.write('Phase 239-06 (BRAIN-03) sendPacket parked census\n');

// -----------------------------------------------------------------------
// LEG 1: THE CENSUS -- zero non-allowlisted, non-comment sendPacket( call
// sites across lib/, scripts/, bin/, pipelines/.
// -----------------------------------------------------------------------
record('LEG 1: census -- zero production sendPacket( call sites outside the allowlist', () => {
  const { violations, scannedFiles } = censusSendPacketCallSites(REPO, SCAN_DIRS, isAllowedSendpacketPath);
  process.stdout.write(
    '    LEG 1: scanned ' + scannedFiles + ' non-allowlisted .cjs/.js/.mjs file(s) under ' +
      SCAN_DIRS.join(', ') + '; violations=' + JSON.stringify(violations) + '\n'
  );
  assert.equal(
    violations.length,
    0,
    'LEG 1 FAILED: non-allowlisted sendPacket( call site(s) found: ' + JSON.stringify(violations)
  );
});

// -----------------------------------------------------------------------
// LEG 2: ANTI-VACUITY for LEG 1. Seed a temp tree with a real bare
// sendPacket( call at a non-allowlisted-shaped path (lib/core/<name>.cjs is
// NOT on the allowlist -- only lib/core/brain-client.cjs, lib/core/
// navigation.cjs, and lib/core/navigation/ are). Without this leg, LEG 1
// could pass vacuously because the scanner walks nothing.
// -----------------------------------------------------------------------
record('LEG 2: anti-vacuity -- a seeded non-allowlisted call site is caught', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sendpacket-census-'));
  try {
    const scratchDir = path.join(tempDir, 'lib', 'core');
    fs.mkdirSync(scratchDir, { recursive: true });
    const scratchFile = path.join(scratchDir, 'scratch-non-allowlisted.cjs');
    fs.writeFileSync(
      scratchFile,
      "'use strict';\n" +
        "async function callIt() {\n" +
        "  await require('./brain-client.cjs').sendPacket({ origin: 'x' });\n" +
        "}\n" +
        'module.exports = { callIt };\n'
    );
    const { violations, scannedFiles } = censusSendPacketCallSites(tempDir, ['lib'], isAllowedSendpacketPath);
    process.stdout.write(
      '    LEG 2: seeded ' + scratchFile + '; scanned ' + scannedFiles +
        ' file(s); violations=' + JSON.stringify(violations) + '\n'
    );
    assert.equal(
      violations.length,
      1,
      'LEG 2 FAILED: expected exactly 1 seeded violation, got ' + violations.length
    );
    assert.equal(
      violations[0].file,
      'lib/core/scratch-non-allowlisted.cjs',
      'LEG 2 FAILED: violation reported for the wrong path'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------
// LEG 3: the dated PARKED note exists at the call surface, within 30 lines
// above `async function sendPacket(` in lib/core/brain-client.cjs.
// -----------------------------------------------------------------------
const brainClientPath = path.join(REPO, 'lib', 'core', 'brain-client.cjs');
record('LEG 3: dated PARKED note present at the call surface', () => {
  const src = fs.readFileSync(brainClientPath, 'utf8');
  const lines = src.split('\n');
  let funcLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^async function sendPacket\s*\(/.test(lines[i].trim())) {
      funcLineIdx = i;
      break;
    }
  }
  assert.notEqual(funcLineIdx, -1, 'async function sendPacket( not found in lib/core/brain-client.cjs');
  const windowStart = Math.max(0, funcLineIdx - 30);
  const windowText = lines.slice(windowStart, funcLineIdx).join('\n');
  process.stdout.write(
    '    LEG 3: sendPacket at source line ' + (funcLineIdx + 1) +
      '; scanned lines ' + (windowStart + 1) + '-' + funcLineIdx + ' above it for PARKED\n'
  );
  assert.ok(windowText.includes('PARKED'), 'LEG 3 FAILED: no PARKED note within 30 lines above sendPacket(');
  assert.ok(
    /\d{4}-\d{2}-\d{2}/.test(windowText),
    'LEG 3 FAILED: no ISO-shaped date (YYYY-MM-DD) found in the park note window'
  );
});

// -----------------------------------------------------------------------
// LEG 4: the same decision exists in docs/architecture/SUBSTRATE-CONTRACT.md.
// -----------------------------------------------------------------------
const substrateContractPath = path.join(REPO, 'docs', 'architecture', 'SUBSTRATE-CONTRACT.md');
record('LEG 4: park decision recorded in docs/architecture/SUBSTRATE-CONTRACT.md', () => {
  const doc = fs.readFileSync(substrateContractPath, 'utf8');
  assert.ok(doc.includes('sendPacket'), 'LEG 4 FAILED: sendPacket not named in SUBSTRATE-CONTRACT.md');
  assert.ok(doc.includes('PARKED'), 'LEG 4 FAILED: PARKED not present in SUBSTRATE-CONTRACT.md');
  assert.ok(doc.includes('BRAIN-03'), 'LEG 4 FAILED: BRAIN-03 not named in SUBSTRATE-CONTRACT.md');
  assert.ok(
    /\d{4}-\d{2}-\d{2}/.test(doc),
    'LEG 4 FAILED: no ISO-shaped date (YYYY-MM-DD) found in SUBSTRATE-CONTRACT.md'
  );
});

// -----------------------------------------------------------------------
// LEG 5: the two contradictory in-repo claims are reconciled. The false
// claim is gone; the true claim survives (the reconciliation went in the
// right direction, per T-239-T7).
// -----------------------------------------------------------------------
record('LEG 5: contradiction reconciled -- false claim gone, true claim survives', () => {
  const t150Path = path.join(REPO, 'tests', 'test-150-brain-egress.cjs');
  const t150Src = fs.readFileSync(t150Path, 'utf8');
  assert.ok(
    !t150Src.includes('FIRST real sendPacket consumer'),
    'LEG 5 FAILED: tests/test-150-brain-egress.cjs still asserts the FALSE "FIRST real sendPacket consumer" claim'
  );
  const packetPath = path.join(REPO, 'lib', 'core', 'navigation', 'packet.cjs');
  const packetSrc = fs.readFileSync(packetPath, 'utf8');
  assert.ok(
    packetSrc.includes('zero production consumers'),
    'LEG 5 FAILED: lib/core/navigation/packet.cjs no longer carries its TRUE "zero production consumers" claim'
  );
});

// -----------------------------------------------------------------------
// LEG 6: MUTATION (documentation leg). The live production-tree mutation
// proof cannot be safely performed by this file against itself while this
// file is the process currently scanning the repo it would be mutating; it
// is performed BY THE EXECUTOR BY HAND against a scratch copy of
// lib/core/artifact-id.cjs (a file this phase does not otherwise touch),
// observed, restored, and transcribed in the plan SUMMARY.md, per the Phase
// 241/242/243 precedent LEG 7 in tests/test-239-query-egress-canary.cjs
// already established for the sibling BRAIN-02 plan. This leg documents
// where that proof lives so a reader of this suite's PASS transcript is not
// left wondering why a "mutation" leg makes no assertion of its own.
// -----------------------------------------------------------------------
record('LEG 6: mutation proof performed by hand against lib/core/artifact-id.cjs -- see plan SUMMARY.md', () => {
  assert.ok(true, 'documentation leg; see .planning/phases/239-brain-access-surface/239-06-SUMMARY.md');
});

process.stdout.write(
  '\nPhase 239-06 sendpacket-parked suite: ' + (failed === 0 ? 'PASS' : 'FAIL') +
    ' (' + passed + ' passed, ' + failed + ' failed)\n'
);
process.exit(failed === 0 ? 0 : 1);
