#!/usr/bin/env node
'use strict';
/**
 * Phase 234 / D-08 + D-09 + D-11: the free-core network scan.
 *
 * WHAT THIS PROVES, IN PLAIN WORDS
 * The business model only works if the two halves stay separated. The free core
 * (the local MCP tool surface, the SQL navigation chokepoint, the key resolver)
 * runs entirely on the user's machine and reaches nothing. The Brain is the paid
 * layer, and it is a READ service: it serves generic methodology and never sees a
 * byte of user content. Those are the same sentence read from two directions --
 * D-08/D-09 is the commercial reading, Canon Part 8 (Graph Boundary) is the
 * constitutional reading -- and ONE measurement settles both. If a network token
 * ever appears on an executable line in these files, both readings break at once:
 * the free tier stopped being free-standing AND user data acquired a way out.
 * That is why this scan is the artifact that closes D-08, D-09 and D-11 together.
 *
 * WHY A 234-SCOPED INSTANCE RATHER THAN A NEW IDEA
 * The pattern already exists: run-all-158.sh, run-all-217.sh and run-all-233.sh
 * all carry a comment-stripped Part 8 egress sweep, and run-all-234.sh carries
 * one over the files THIS phase touched. 234-VALIDATION.md's D-08/D-09 row asks
 * for the same instrument aimed at a different, and larger, target set: the WHOLE
 * of lib/mcp/tools/, plus lib/core/navigation.cjs and lib/core/resolve-brain-key.cjs.
 * So the regex text here is not invented; it is the SAME pattern run-all-234.sh
 * was certified with, and a parity check below fails this test if the two ever
 * drift apart. Canon Part 7, reuse before build.
 *
 * WHY A GLOB AND NOT A FIXED LIST
 * run-all-233.sh and run-all-234.sh both use a fixed PART8_TARGETS array, which is
 * right for "the files this plan touched" -- a closed, known set. lib/mcp/tools/ is
 * different in kind: it is a directory of many small independent per-tool modules
 * that grows every time a tool is added. A fixed list there goes stale silently,
 * and a stale target list looks exactly like a clean codebase, which is the very
 * false-success shape this phase exists to close. So the tool modules are
 * glob-discovered, and discovering ZERO of them is a hard failure rather than a
 * vacuous pass. The two named single files stay named, and a missing one fails.
 *
 * WHY THE SELF-TEST RUNS FIRST
 * A grep gate that quietly stopped matching is indistinguishable from a codebase
 * with nothing to find. Both print green. So before the pattern is trusted over a
 * single real file, it is run over synthetic lines that plant every forbidden
 * token and MUST be caught, plus lines that must NOT be caught. The gate earns
 * the right to be believed before it is believed.
 *
 * THE resolve-brain-key.cjs QUESTION, ALREADY SETTLED IN 234-01
 * The `brain` token is case-sensitive and lowercase on purpose: it catches code
 * shapes (requires, identifiers, hostnames, env keys) while letting prose like
 * "no Brain" in a module docstring through, since docstring bodies are not comment
 * lines and a gate that fails on correct committed code gets disabled by the next
 * person who trips it. 234-01 anticipated that lib/core/resolve-brain-key.cjs would
 * therefore need an allowance, MEASURED it, and found it does not: its identifiers
 * are `resolveBrainKey` and `MINDRIAN_BRAIN_KEY`, both with an uppercase B, and its
 * only lowercase `brain` occurrences sit on comment lines the stripper removes.
 * That resolution is REUSED here rather than re-derived -- and it is reused as an
 * ASSERTION (a must-not-catch self-test case), not as an allow-list entry, because
 * an allowance would blind the gate to a real lowercase-`brain` egress shape in
 * that file forever, whereas an assertion keeps the gate sharp and proves the
 * case-sensitivity reasoning still holds.
 *
 * The allow-list is consequently EMPTY. Every one of the swept files produces zero
 * hits with no exceptions carved out. Any future entry must carry a written
 * reason; that is enforced below, not left to good manners.
 *
 * No em-dashes in program output. No network reach: this script only reads files.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
const failures = [];

function ok(msg) {
  pass += 1;
  console.log(`    ok: ${msg}`);
}
function bad(msg) {
  fail += 1;
  failures.push(msg);
  console.log(`    FAIL: ${msg}`);
}

// ---------------------------------------------------------------------------
// The pattern. Same token set run-all-234.sh (and run-all-233.sh before it) was
// certified with. The only difference is mechanical: JavaScript regex literals
// require the forward slashes in `https?://` to be escaped. The parity check
// below normalizes that one difference away and compares the rest byte for byte,
// so a future strengthening of the bash pattern cannot leave this file behind.
// ---------------------------------------------------------------------------
const PART8_RE = /fetch\(|https?:\/\/|require\(['"]node:https?|\b(curl|wget)\b|axios|onrender|api\.anthropic|brain/;

// EXACT-LINE allow-list. DELIBERATELY EMPTY: every swept file is clean with no
// exception carved out. Any entry added later must carry a written reason (see
// the hygiene check below) so a rename or a convenience edit cannot silently
// widen the gate. This is the run-all-217 / run-all-233 written-reason idiom.
/** @type {{pattern: RegExp, reason: string}[]} */
const PART8_ALLOW = [];

function stripComments(text) {
  // Mirrors the bash harness stripper: grep -vE '^[[:space:]]*(//|\*|/\*|#)'
  return text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*|#)/.test(line));
}

function allowed(line) {
  return PART8_ALLOW.some((entry) => entry.pattern.test(line));
}

function hits(text) {
  const out = [];
  stripComments(text).forEach((line, i) => {
    if (PART8_RE.test(line) && !allowed(line)) out.push({ n: i + 1, line: line.trim() });
  });
  return out;
}

// ---------------------------------------------------------------------------
// 0. Pattern parity with the phase harness.
// ---------------------------------------------------------------------------
console.log('--- Pattern parity: this scan uses the harness pattern, not its own ---');
{
  const harnessPath = path.join(ROOT, 'tests', 'run-all-234.sh');
  if (!fs.existsSync(harnessPath)) {
    bad('tests/run-all-234.sh not found, so pattern parity cannot be established');
  } else {
    const harness = fs.readFileSync(harnessPath, 'utf8');
    const m = harness.match(/^PART8_RE="(.*)"$/m);
    if (!m) {
      bad('no PART8_RE="..." assignment found in tests/run-all-234.sh');
    } else {
      // Shell double-quote unescaping: \" in the source is a literal " in the value.
      const harnessPattern = m[1].replace(/\\"/g, '"');
      // JS regex source unescaping: \/ is a literal / (ERE needs no escape there).
      const jsPattern = PART8_RE.source.replace(/\\\//g, '/');
      if (jsPattern === harnessPattern) {
        ok('PART8_RE here is byte-identical to tests/run-all-234.sh after the one mechanical slash difference');
      } else {
        bad(`PART8_RE drifted from tests/run-all-234.sh\n      here:    ${jsPattern}\n      harness: ${harnessPattern}`);
      }
    }
  }
}
console.log('');

// ---------------------------------------------------------------------------
// 1. NEGATIVE SELF-TEST, before any real file is read.
// ---------------------------------------------------------------------------
console.log('--- Self-test: the scan actually bites ---');

function mustCatch(label, line) {
  if (hits(line).length > 0) {
    console.log(`    caught: ${label}`);
    pass += 1;
  } else {
    bad(`MISS (the scan is blind to this): ${label} -> ${line}`);
  }
}

function mustNotCatch(label, line) {
  if (hits(line).length === 0) {
    console.log(`    correctly ignored: ${label}`);
    pass += 1;
  } else {
    bad(`FALSE POSITIVE: ${label} -> ${line}`);
  }
}

// All 9 forbidden token shapes.
mustCatch('fetch(', "  const r = await fetch(url);");
mustCatch('https:// literal', "  const u = 'https://mindrian-brain.onrender.com/mcp';");
mustCatch('node:https require', "  const https = require('node:https');");
mustCatch('curl', "  spawnSync('curl', ['-s', target]);");
mustCatch('wget', "  spawnSync('wget', [target]);");
mustCatch('axios (no URL literal)', "  const axios = require('axios');");
mustCatch('onrender host (no scheme)', "  const host = 'mindrian-brain.onrender.com';");
mustCatch('api.anthropic (no scheme)', "  const h = 'api.anthropic.com';");
mustCatch('brain identifier', '  const brainKey = process.env.MINDRIAN_BRAIN_KEY;');

// Shapes that must NOT trip it.
mustNotCatch('a comment line naming egress', '// never call fetch( or curl the brain at https://x.onrender.com');
mustNotCatch('ordinary local code', '  const db = openRoomDbReadOnlyForCaller(roomDir);');
// 234-01's measured resolution, kept as an assertion rather than an allowance.
mustNotCatch(
  'the resolve-brain-key.cjs env-var-name shape (uppercase BRAIN, no lowercase token)',
  '  const key = process.env.MINDRIAN_BRAIN_KEY || null;'
);
mustNotCatch(
  'the resolve-brain-key.cjs exported identifier shape (resolveBrainKey, uppercase B)',
  '  module.exports = { resolveBrainKey };'
);
console.log('');

// ---------------------------------------------------------------------------
// 2. Allow-list hygiene. An entry without a written reason is how a gate rots.
// ---------------------------------------------------------------------------
console.log('--- Allow-list hygiene ---');
if (PART8_ALLOW.length === 0) {
  ok('allow-list is empty: every swept file is clean with no exception carved out');
} else {
  PART8_ALLOW.forEach((entry, i) => {
    if (typeof entry.reason === 'string' && entry.reason.trim().length >= 20) {
      ok(`allow-list entry ${i} carries a written reason`);
    } else {
      bad(`allow-list entry ${i} has no written reason, so it cannot be audited`);
    }
  });
}
console.log('');

// ---------------------------------------------------------------------------
// 3. The real sweep.
// ---------------------------------------------------------------------------
console.log('--- Sweep: zero network tokens in the free core ---');

const TOOLS_DIR = path.join(ROOT, 'lib', 'mcp', 'tools');
let toolFiles = [];
if (!fs.existsSync(TOOLS_DIR)) {
  bad('lib/mcp/tools/ does not exist, so the glob target set cannot be built');
} else {
  toolFiles = fs
    .readdirSync(TOOLS_DIR)
    .filter((f) => f.endsWith('.cjs'))
    .sort()
    .map((f) => path.join('lib', 'mcp', 'tools', f));
  if (toolFiles.length === 0) {
    // A glob that finds nothing prints the same green as a clean codebase.
    bad('the lib/mcp/tools/*.cjs glob discovered ZERO files, which is a vacuous pass, not a clean result');
  } else {
    ok(`glob discovered ${toolFiles.length} tool module(s) under lib/mcp/tools/`);
  }
}

// The two explicitly-named single files from 234-VALIDATION.md's D-08/D-09 row.
const NAMED = [path.join('lib', 'core', 'navigation.cjs'), path.join('lib', 'core', 'resolve-brain-key.cjs')];

const targets = [...toolFiles, ...NAMED];
let sweptClean = 0;

for (const rel of targets) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    // MISSING fails the leg rather than skipping silently.
    bad(`MISSING sweep target: ${rel}`);
    continue;
  }
  const found = hits(fs.readFileSync(abs, 'utf8'));
  if (found.length > 0) {
    bad(`FORBIDDEN network token on an executable line in: ${rel}`);
    found.forEach((h) => console.log(`        ${h.n}: ${h.line}`));
  } else {
    sweptClean += 1;
  }
}

if (fail === 0) {
  ok(`${sweptClean} free-core file(s) swept, zero network tokens on any executable line`);
}
console.log('');

// ---------------------------------------------------------------------------
console.log('======================================');
console.log(`234 free-core network scan: PASS=${pass} FAIL=${fail}`);
console.log('======================================');
if (fail > 0) {
  console.log('');
  console.log('D-08/D-09/D-11 boundary breach. Every failure above, in order:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
process.exit(0);
