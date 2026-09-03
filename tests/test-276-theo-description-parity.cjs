#!/usr/bin/env node
'use strict';

/*
 * Phase 276 Plan 04, Task 3 -- TOOLHON-12, a non-blocking cross-repo
 * coordination signal.
 *
 * This is a COORDINATION SIGNAL, never a gate (Theo D-04: coordinated, not
 * executed cross-repo). It reports a byte diff per constant and SKIPS
 * loudly when the Theo checkout is absent -- it must never block a plugin
 * commit. tests/run-all-273.sh's own missing-target-FAILS accounting is
 * DELIBERATELY INVERTED here: an absent Theo checkout is expected (Theo is
 * out of repo, CI has no copy), so absence SKIPS rather than fails.
 *
 * Nothing under /home/jsagi/Theo is ever written by this file: no fs write
 * primitive of any kind appears anywhere below. Only read-only fs reads and
 * a read-only `git rev-parse` are performed against the Theo checkout.
 *
 * Extraction, the load-bearing design choice. This file does NOT extract
 * the five description constants with a bare regex over TypeScript source
 * -- 276-RESEARCH.md names that exact failure mode (Theo 05-REVIEW CR-01):
 * a lossy regex extractor reports IDENTICAL over a real divergence when the
 * constant is a multi-line string concatenation with escaped quotes. This
 * file reuses scripts/check-tool-honesty.cjs's own shipped
 * extractStringLiteralConcat primitive (a quote-and-escape aware forward
 * scanner) on both sides of the comparison, never a hand-rolled second
 * extractor. When a compiled dist/ build exists under the Theo checkout,
 * that compiled JS is read first (same const-assignment shape, already
 * built); the raw .ts source is the fallback when dist/ is absent.
 *
 * Re-pins the Theo commit at RUN TIME (not trusted from a stale document):
 * compares the checkout's live HEAD against the commit this report was
 * pinned to, 83a1ce2 (276-RESEARCH.md). A moved pin is expected news
 * (RESEARCH Assumption A14), never a failure.
 *
 * Canon Part 8: LOCAL only, plus one read-only `git rev-parse` against the
 * Theo checkout for its own HEAD (not a network call). No em-dashes.
 *
 * Run: node tests/test-276-theo-description-parity.cjs [--strict]
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const checker = require(path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs'));

const THEO_ROOT = process.env.THEO_ROOT || '/home/jsagi/Theo';
const PINNED_THEO_COMMIT = '83a1ce2';
const STRICT = process.argv.includes('--strict');

// ---------------------------------------------------------------------------
// SKIP, loudly, when the Theo checkout is absent. Never a failure. This is
// the deliberate inversion of run-all-273.sh's missing-target-FAILS
// accounting: Theo is out of repo, CI has no copy, and the whole point of
// this file is that its absence cannot block a plugin commit.
// ---------------------------------------------------------------------------
if (!fs.existsSync(THEO_ROOT)) {
  process.stdout.write('SKIP: THEO_ROOT (' + THEO_ROOT + ') does not exist on this machine.\n');
  process.stdout.write('SKIP: this is a coordination signal only (Theo D-04: coordinated, not executed\n');
  process.stdout.write('SKIP: cross-repo); it never blocks a plugin commit. Set THEO_ROOT to point at a\n');
  process.stdout.write('SKIP: Theo checkout to run this report for real.\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Re-pin at run time.
// ---------------------------------------------------------------------------
const gitResult = spawnSync('git', ['-C', THEO_ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
const liveHead = (gitResult.status === 0) ? gitResult.stdout.trim() : null;
if (liveHead && liveHead !== PINNED_THEO_COMMIT) {
  process.stdout.write('INFORMATION: Theo checkout HEAD (' + liveHead + ') has moved past the commit this\n');
  process.stdout.write('INFORMATION: report was pinned to (' + PINNED_THEO_COMMIT + '). Theo is actively developed;\n');
  process.stdout.write('INFORMATION: a moved pin is expected news, not a failure (RESEARCH Assumption A14).\n');
} else if (liveHead) {
  process.stdout.write('Theo checkout HEAD matches the pinned commit ' + PINNED_THEO_COMMIT + '.\n');
} else {
  process.stdout.write('INFORMATION: could not read Theo checkout HEAD via git rev-parse; continuing anyway,\n');
  process.stdout.write('INFORMATION: this line is informational only and never blocks the report below.\n');
}

// ---------------------------------------------------------------------------
// Extraction primitives. Both sides reuse checker.extractStringLiteralConcat
// (the shipped quote-and-escape aware forward scanner), never a hand-rolled
// second extractor.
// ---------------------------------------------------------------------------

// extractConstDescription(fileText, constName) -- Theo side. Locates
// `const <constName> =` then the first TOP-LEVEL terminating semicolon
// (found against maskNonCode's output, so a semicolon inside the
// description string itself is masked out and never mistaken for the
// statement's real end), then hands the raw slice between them to
// extractStringLiteralConcat. Works identically against a compiled .js
// file or the raw .ts source, because both use the same
// `const NAME = 'a' + 'b' + ...;` shape.
function extractConstDescription(fileText, constName) {
  const masked = checker.maskNonCode(fileText);
  const declRe = new RegExp('const\\s+' + constName + '\\s*=');
  const dm = declRe.exec(masked);
  if (!dm) return { error: 'declaration "const ' + constName + '" not found' };
  const start = dm.index + dm[0].length;
  const semiIdx = masked.indexOf(';', start);
  if (semiIdx === -1) return { error: 'no top-level terminating semicolon found after "const ' + constName + ' ="' };
  const exprText = fileText.slice(start, semiIdx);
  const value = checker.extractStringLiteralConcat(exprText);
  if (!value) return { error: 'extractStringLiteralConcat produced an empty value for ' + constName };
  return { value };
}

// extractPluginToolDescription(fileText, toolName) -- plugin side. Mirrors
// the checker's own (unexported) findServerToolCalls shape using its
// exported primitives (maskNonCode, scanBalanced, splitTopLevelArgs,
// extractStringLiteralConcat), the same reproduction-from-exported-
// primitives pattern 276-01 and 276-03 already established for this
// codebase, rather than a second hand-rolled parser.
function extractPluginToolDescription(fileText, toolName) {
  const masked = checker.maskNonCode(fileText);
  const callRe = /server\.tool\s*\(/g;
  let m;
  while ((m = callRe.exec(masked)) !== null) {
    const openParen = masked.indexOf('(', m.index);
    if (openParen === -1) continue;
    const closeParen = checker.scanBalanced(masked, openParen);
    if (closeParen === -1) continue;
    const innerText = fileText.slice(openParen + 1, closeParen);
    const args = checker.splitTopLevelArgs(innerText);
    if (args.length < 2) continue;
    const name = checker.extractStringLiteralConcat(args[0]);
    if (name !== toolName) continue;
    const value = checker.extractStringLiteralConcat(args[1]);
    if (!value) return { error: 'extractStringLiteralConcat produced an empty value for the ' + toolName + ' description' };
    return { value };
  }
  return { error: 'server.tool(\'' + toolName + '\', ...) call not found' };
}

function firstDivergenceOffset(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}

// ---------------------------------------------------------------------------
// The five absorbed operational tools. theoRelJs is tried first (a compiled
// dist/ build, when present); theoRelTs is the fallback.
// ---------------------------------------------------------------------------
const CONSTANTS = [
  {
    name: 'ROOM_BIND_DESCRIPTION',
    theoRelJs: 'dist/mcp/operational/room-bind.js',
    theoRelTs: 'src/mcp/operational/room-bind.ts',
    pluginFile: 'lib/mcp/tool-router.cjs',
    toolName: 'room_bind',
  },
  {
    name: 'GRAPH_WRITE_DESCRIPTION',
    theoRelJs: 'dist/mcp/operational/graph-write.js',
    theoRelTs: 'src/mcp/operational/graph-write.ts',
    pluginFile: 'lib/mcp/tools/graph.cjs',
    toolName: 'graph_write',
  },
  {
    name: 'GATE_RENDER_DESCRIPTION',
    theoRelJs: 'dist/mcp/operational/gate-render.js',
    theoRelTs: 'src/mcp/operational/gate-render.ts',
    pluginFile: 'lib/mcp/tools/gate.cjs',
    toolName: 'gate_render',
  },
  {
    name: 'GATE_ANSWER_DESCRIPTION',
    theoRelJs: 'dist/mcp/operational/gate-answer.js',
    theoRelTs: 'src/mcp/operational/gate-answer.ts',
    pluginFile: 'lib/mcp/tools/gate.cjs',
    toolName: 'gate_answer',
  },
  {
    name: 'CHAIN_RUN_DESCRIPTION',
    theoRelJs: 'dist/mcp/operational/chain-run.js',
    theoRelTs: 'src/mcp/operational/chain-run.ts',
    pluginFile: 'lib/mcp/tools/chain.cjs',
    toolName: 'chain_run',
  },
];

process.stdout.write('\n-- FIVE-CONSTANT PARITY REPORT --\n');
const results = [];
for (const spec of CONSTANTS) {
  let pluginResult;
  try {
    const pluginSrc = fs.readFileSync(path.join(REPO_ROOT, spec.pluginFile), 'utf8');
    pluginResult = extractPluginToolDescription(pluginSrc, spec.toolName);
  } catch (e) {
    pluginResult = { error: 'could not read ' + spec.pluginFile + ': ' + (e && e.message) };
  }

  let theoResult = null;
  let theoSource = null;
  const distPath = path.join(THEO_ROOT, spec.theoRelJs);
  const tsPath = path.join(THEO_ROOT, spec.theoRelTs);
  if (fs.existsSync(distPath)) {
    try {
      const distSrc = fs.readFileSync(distPath, 'utf8');
      theoResult = extractConstDescription(distSrc, spec.name);
      theoSource = 'dist (' + spec.theoRelJs + ')';
    } catch (e) {
      theoResult = { error: 'could not read ' + spec.theoRelJs + ': ' + (e && e.message) };
    }
  }
  if (!theoResult || theoResult.error) {
    try {
      const tsSrc = fs.readFileSync(tsPath, 'utf8');
      const tsResult = extractConstDescription(tsSrc, spec.name);
      if (!theoResult || !tsResult.error) {
        theoResult = tsResult;
        theoSource = 'ts-source (' + spec.theoRelTs + ')';
      }
    } catch (e) {
      if (!theoResult) theoResult = { error: 'could not read ' + spec.theoRelTs + ': ' + (e && e.message) };
    }
  }

  let line;
  let status;
  if (pluginResult.error || theoResult.error) {
    status = 'EXTRACTION_FAILED';
    line = 'EXTRACTION_FAILED: plugin=' + (pluginResult.error || 'ok') + ' | theo=' + (theoResult.error || 'ok');
  } else {
    const offset = firstDivergenceOffset(pluginResult.value, theoResult.value);
    if (offset === -1) {
      status = 'IDENTICAL';
      line = 'IDENTICAL (' + pluginResult.value.length + ' bytes both sides)';
    } else {
      status = 'DIFFERS';
      line = 'DIFFERS at offset ' + offset + ' (plugin ' + pluginResult.value.length + ' bytes / theo '
        + theoResult.value.length + ' bytes)';
    }
  }

  results.push({ name: spec.name, toolName: spec.toolName, status, line, theoSource: theoSource || 'n/a' });
  process.stdout.write(spec.name + ' [' + spec.toolName + '] (theo source: ' + (theoSource || 'n/a') + '): ' + line + '\n');
}

const problems = results.filter((r) => r.status === 'DIFFERS' || r.status === 'EXTRACTION_FAILED');
process.stdout.write('\n' + results.length + ' constant(s) compared, ' + problems.length + ' problem(s) (DIFFERS or EXTRACTION_FAILED)\n');
process.stdout.write('This is a coordination signal (Theo D-04), never a gate; the plugin cannot fix\n');
process.stdout.write('Theo\'s own file from this repo. Nothing under ' + THEO_ROOT + ' was written.\n');

if (STRICT && problems.length > 0) {
  process.stdout.write('\n--strict: exiting 1 (nothing wires --strict by default)\n');
  process.exit(1);
}

process.exit(0);
