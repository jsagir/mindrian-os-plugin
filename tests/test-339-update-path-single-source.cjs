#!/usr/bin/env node
'use strict';

/**
 * Phase 339 Plan 02 (FLIP-04) -- update-path single-source-of-truth drift
 * test, HERMETIC.
 * ==========================================================================
 * The two-command update path (`/plugin marketplace update`, then
 * `claude plugin update mos@mindrian-marketplace`) must live in exactly ONE
 * place: `lib/core/update-path.cjs`, mirroring `.claude/includes/
 * release-process.md:23-26` byte for byte. This test checks drift in BOTH
 * directions:
 *
 *   Arm 1 - extraction: `.claude/includes/release-process.md`'s fenced
 *           bash block yields exactly two non-empty command lines, with
 *           trailing comments stripped and whitespace trimmed. If a future
 *           edit adds a third command to that block, this arm fails loudly
 *           rather than silently ignoring it.
 *   Arm 2 - module byte-equality: `lib/core/update-path.cjs` exports
 *           MARKETPLACE_UPDATE_COMMAND and PLUGIN_UPDATE_COMMAND, byte-
 *           identical to Arm 1's two extracted strings, plus
 *           UPDATE_PATH_SENTENCE (a single line containing both).
 *   Arm 3 - frozen exports: mutating any exported value throws (strict
 *           mode) or is a silent no-op.
 *   Arm 4 - rendered refusal copy: `lib/core/refusal-messaging.cjs`'s
 *           `renderRefusal('unreachable', ...)` and `renderRefusal(
 *           'no_key', ...)` both include PLUGIN_UPDATE_COMMAND in their
 *           joined output.
 *   Arm 5 - anti-drift, the OPPOSITE direction: `lib/` and `scripts/`
 *           scanned for any OTHER occurrence of the literal string
 *           `claude plugin update mos@mindrian-marketplace` on a non-
 *           comment line; the only permitted hit is
 *           `lib/core/update-path.cjs` itself. Three copies drift; that is
 *           exactly what D-08 (339-CONTEXT.md) asks to prevent.
 *
 * `.claude/includes/release-process.md` is the SOURCE, read at TEST time,
 * never at runtime -- it is a CLAUDE.md `@include`, not a shipped runtime
 * asset (`package.json`'s files allowlist and `release.sh` Step 9.5's
 * payload gate both exclude it), so `lib/core/update-path.cjs` mirrors the
 * two strings as its own frozen constants rather than reading the doc file
 * live.
 *
 * THIS TEST IS RED ON THIS PLAN'S OWN RUN. `lib/core/update-path.cjs` does
 * not exist until plan 339-06 creates it: the require() throws
 * MODULE_NOT_FOUND, caught here and reported as a NAMED failure (never an
 * unhandled crash), so the wave-1 red output stays readable.
 *
 * Hand-rolled record()/failed-counter harness, mirrors
 * tests/test-339-origin-single-source.cjs and
 * tests/test-254-normalize-roundtrip-probe.cjs's own precedent (not
 * node:test -- structural/source-scan suites in this repo use the hand-
 * rolled harness, behavioral node:test suites use node:test).
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_PROCESS_PATH = path.join(REPO_ROOT, '.claude', 'includes', 'release-process.md');
const UPDATE_PATH_MODULE = path.join(REPO_ROOT, 'lib', 'core', 'update-path.cjs');
const UPDATE_PATH_LITERAL = 'claude plugin update mos@mindrian-marketplace';

// ---------------------------------------------------------------------------
// Arm 1 helper: extract the fenced ```bash block containing the update path
// from release-process.md, split its lines, strip trailing `#` comments,
// trim, and drop blanks.
// ---------------------------------------------------------------------------
function extractUpdatePathCommands() {
  const src = fs.readFileSync(RELEASE_PROCESS_PATH, 'utf8');
  const fenceRe = /```bash\n([\s\S]*?)```/g;
  let block = null;
  let m;
  while ((m = fenceRe.exec(src)) !== null) {
    if (m[1].indexOf('plugin marketplace update') !== -1) {
      block = m[1];
      break;
    }
  }
  assert.ok(block !== null, 'release-process.md must contain a ```bash fenced block naming plugin marketplace update');
  const lines = block
    .split('\n')
    .map(function (line) {
      const hashIdx = line.indexOf('#');
      const withoutComment = hashIdx === -1 ? line : line.slice(0, hashIdx);
      return withoutComment.trim();
    })
    .filter(function (line) { return line.length > 0; });
  return lines;
}

// ---------------------------------------------------------------------------
// Arm 5 helper: reused from tests/test-339-origin-single-source.cjs's own
// per-line, per-file-kind comment stripper (Reuse Before Build, Canon
// Part 7) so a heredoc'd user-facing string is correctly treated as
// non-comment code, never silently swallowed as if it were a `#` line.
// ---------------------------------------------------------------------------
function stripQuoteAwarePerLine(line, commentChar) {
  let out = '';
  let state = 'code';
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    const c2 = i + 1 < line.length ? line[i + 1] : '';
    if (state === 'code') {
      if (c === "'") { state = 'squote'; out += c; continue; }
      if (c === '"') { state = 'dquote'; out += c; continue; }
      if (c === '`') { state = 'btick'; out += c; continue; }
      if (commentChar === '//' && c === '/' && c2 === '/') { out += ' '.repeat(line.length - i); break; }
      if (commentChar === '#' && c === '#') { out += ' '.repeat(line.length - i); break; }
      out += c;
      continue;
    }
    const closer = state === 'squote' ? "'" : state === 'dquote' ? '"' : '`';
    if (c === '\\') { out += c + c2; i += 1; continue; }
    if (c === closer) { state = 'code'; out += c; continue; }
    out += c;
  }
  return out;
}

function maskJsBlockComments(src) {
  let out = '';
  let state = 'code';
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    const c2 = i + 1 < src.length ? src[i + 1] : '';
    if (state === 'code') {
      if (c === '/' && c2 === '*') { state = 'block'; out += '  '; i += 1; continue; }
      out += c;
      continue;
    }
    if (c === '*' && c2 === '/') { state = 'code'; out += '  '; i += 1; continue; }
    out += c === '\n' ? '\n' : ' ';
  }
  return out;
}

function stripJsLikeComments(src) {
  const masked = maskJsBlockComments(src);
  return masked.split('\n').map(function (line) { return stripQuoteAwarePerLine(line, '//'); }).join('\n');
}

function stripShellComments(src) {
  return src.split('\n').map(function (line) { return stripQuoteAwarePerLine(line, '#'); }).join('\n');
}

function isExecutable(fullPath) {
  try {
    const st = fs.statSync(fullPath);
    return (st.mode & 0o111) !== 0;
  } catch (_e) {
    return false;
  }
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full, out); continue; }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (ext === '.cjs' || ext === '.js') {
      out.push({ full, kind: 'jslike' });
    } else if (ext === '' && isExecutable(full)) {
      out.push({ full, kind: 'shell' });
    }
  }
}

function scanForLiteral() {
  const files = [];
  walk(path.join(REPO_ROOT, 'lib'), files);
  walk(path.join(REPO_ROOT, 'scripts'), files);
  const hits = [];
  for (const { full, kind } of files) {
    const rel = path.relative(REPO_ROOT, full).split(path.sep).join('/');
    const src = fs.readFileSync(full, 'utf8');
    const stripped = kind === 'jslike' ? stripJsLikeComments(src) : stripShellComments(src);
    const lines = stripped.split('\n');
    for (let idx = 0; idx < lines.length; idx += 1) {
      if (lines[idx].indexOf(UPDATE_PATH_LITERAL) !== -1) {
        hits.push(rel + ':' + (idx + 1));
      }
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Load the module under test once, catching MODULE_NOT_FOUND as a clean
// NAMED failure rather than letting node's own crash stack propagate.
// ---------------------------------------------------------------------------
let updatePathMod = null;
let updatePathLoadError = null;
try {
  delete require.cache[UPDATE_PATH_MODULE];
  updatePathMod = require(UPDATE_PATH_MODULE);
} catch (e) {
  updatePathLoadError = e;
}

function requireModuleOrNamedFailure() {
  if (updatePathLoadError) {
    throw new Error('lib/core/update-path.cjs not found (expected in wave 1; plan 339-06 creates it)');
  }
  return updatePathMod;
}

async function main() {
  let failed = 0;
  const record = (name, fn) => {
    try {
      fn();
      process.stdout.write('  ok  ' + name + '\n');
    } catch (err) {
      failed += 1;
      process.stderr.write('  FAIL ' + name + '\n    ' + (err && err.stack ? err.stack : String(err)) + '\n');
    }
  };

  process.stdout.write('Phase 339-02 (FLIP-04) update-path single-source scan -- HERMETIC\n');

  let extracted = null;

  // -------------------------------------------------------------------------
  // Arm 1: release-process.md extraction.
  // -------------------------------------------------------------------------
  record('Arm 1: release-process.md fenced block yields exactly two non-empty command lines', () => {
    extracted = extractUpdatePathCommands();
    assert.strictEqual(extracted.length, 2, 'exactly two command lines expected, got ' + extracted.length + ': ' + JSON.stringify(extracted));
    assert.strictEqual(extracted[0], '/plugin marketplace update', 'first command must be the marketplace refresh, byte-exact');
    assert.strictEqual(extracted[1], 'claude plugin update mos@mindrian-marketplace', 'second command must be the plugin update, byte-exact');
  });

  // -------------------------------------------------------------------------
  // Arm 2: module byte-equality against the extracted strings.
  // -------------------------------------------------------------------------
  record('Arm 2: lib/core/update-path.cjs exports byte-identical MARKETPLACE_UPDATE_COMMAND, PLUGIN_UPDATE_COMMAND, UPDATE_PATH_SENTENCE', () => {
    const mod = requireModuleOrNamedFailure();
    assert.ok(extracted, 'Arm 1 must have run and extracted the two commands first');
    assert.equal(mod.MARKETPLACE_UPDATE_COMMAND, extracted[0], 'MARKETPLACE_UPDATE_COMMAND must be byte-identical to release-process.md');
    assert.equal(mod.PLUGIN_UPDATE_COMMAND, extracted[1], 'PLUGIN_UPDATE_COMMAND must be byte-identical to release-process.md');
    assert.strictEqual(typeof mod.UPDATE_PATH_SENTENCE, 'string', 'UPDATE_PATH_SENTENCE must be a string');
    assert.ok(mod.UPDATE_PATH_SENTENCE.indexOf(mod.MARKETPLACE_UPDATE_COMMAND) !== -1, 'UPDATE_PATH_SENTENCE must contain the marketplace command');
    assert.ok(mod.UPDATE_PATH_SENTENCE.indexOf(mod.PLUGIN_UPDATE_COMMAND) !== -1, 'UPDATE_PATH_SENTENCE must contain the plugin update command');
    assert.strictEqual(mod.UPDATE_PATH_SENTENCE.indexOf('\n'), -1, 'UPDATE_PATH_SENTENCE must be a single line');
  });

  // -------------------------------------------------------------------------
  // Arm 3: every exported value is frozen.
  // -------------------------------------------------------------------------
  record('Arm 3: every lib/core/update-path.cjs export is frozen (mutation throws or no-ops)', () => {
    const mod = requireModuleOrNamedFailure();
    assert.ok(Object.isFrozen(mod), 'the module.exports object itself must be frozen');
    for (const key of ['MARKETPLACE_UPDATE_COMMAND', 'PLUGIN_UPDATE_COMMAND', 'UPDATE_PATH_SENTENCE']) {
      assert.ok(key in mod, 'export must exist: ' + key);
      const before = mod[key];
      try {
        mod[key] = 'TAMPERED-' + key;
      } catch (_e) {
        // strict-mode throw on a frozen export is the expected, acceptable path.
      }
      assert.strictEqual(mod[key], before, 'export ' + key + ' must be unmodifiable (frozen module.exports)');
    }
  });

  // -------------------------------------------------------------------------
  // Arm 4: rendered refusal copy names the update path.
  // -------------------------------------------------------------------------
  record('Arm 4: refusal-messaging.cjs renderRefusal for unreachable AND no_key both include PLUGIN_UPDATE_COMMAND', () => {
    const mod = requireModuleOrNamedFailure();
    const refusalMessagingPath = path.join(REPO_ROOT, 'lib', 'core', 'refusal-messaging.cjs');
    delete require.cache[refusalMessagingPath];
    const refusalMessaging = require(refusalMessagingPath);
    const unreachableCopy = refusalMessaging.renderRefusal('unreachable', { tool: 'test339' });
    const noKeyCopy = refusalMessaging.renderRefusal('no_key', { tool: 'test339' });
    assert.ok(
      unreachableCopy.indexOf(mod.PLUGIN_UPDATE_COMMAND) !== -1,
      'kind=unreachable rendered copy must include PLUGIN_UPDATE_COMMAND, got: ' + JSON.stringify(unreachableCopy)
    );
    assert.ok(
      noKeyCopy.indexOf(mod.PLUGIN_UPDATE_COMMAND) !== -1,
      'kind=no_key rendered copy must include PLUGIN_UPDATE_COMMAND, got: ' + JSON.stringify(noKeyCopy)
    );
  });

  // -------------------------------------------------------------------------
  // Arm 5: anti-drift, the opposite direction -- exactly one hit, the module
  // itself. This scan already runs against real `main` bytes and may surface
  // a pre-existing duplicate the planner did not know about; that is a
  // legitimate finding for 339-06's work list, not a bug in this test.
  // -------------------------------------------------------------------------
  record('Arm 5: lib/ and scripts/ carry exactly one non-comment occurrence of the literal update-path string (lib/core/update-path.cjs itself)', () => {
    const hits = scanForLiteral();
    if (hits.length > 0) {
      process.stdout.write('\n  ' + hits.length + ' occurrence(s) of the literal found:\n');
      for (const h of hits) process.stdout.write('    ' + h + '\n');
    }
    const nonModuleHits = hits.filter((h) => h.indexOf('lib/core/update-path.cjs:') !== 0);
    assert.deepStrictEqual(
      nonModuleHits,
      [],
      'the literal must appear nowhere outside lib/core/update-path.cjs; found: ' + nonModuleHits.join(', ')
    );
    assert.ok(
      hits.some((h) => h.indexOf('lib/core/update-path.cjs:') === 0),
      'lib/core/update-path.cjs must itself carry the literal (it is the single source)'
    );
  });

  process.stdout.write(
    '\nPhase 339-02 (FLIP-04) update-path single-source scan: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});

// No em-dashes.
