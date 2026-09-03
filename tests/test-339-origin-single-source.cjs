#!/usr/bin/env node
'use strict';

/**
 * Phase 339 Plan 01 (FLIP-01) -- origin single-source scan, HERMETIC.
 * ==========================================================================
 * This phase's whole disease is a SECOND SOURCE OF TRUTH: one origin, one
 * vocabulary switch, one update-path string, one coverage ruling. This test
 * mechanizes the origin half of that rule so a second origin literal cannot
 * be reintroduced later by someone who never read this phase.
 *
 * The observed shape it keys on: a comment-stripped, non-blank line under
 * lib/, bin/ or scripts/ that contains an onrender.com Brain origin literal
 * (either pws-brain-mcp.onrender.com, the incumbent, or theo-mcp.onrender.com,
 * the flip target -- the point is that no site outside the allowlist owns
 * ANY origin literal, not that one specific host string is gone).
 *
 * What it deliberately does NOT key on: comment prose (a comment-only line
 * carrying the literal is not a failure -- prose is swept for accuracy, not
 * for FLIP-01), and it never touches docs/, tests/fixtures/, .planning/, or
 * any dated handoff/RCA under docs/, all of which are historical records
 * this sweep leaves alone per CONTEXT.md D-12.
 *
 * Scan scope, exactly per this plan's own action spec: every .cjs, .js and
 * extensionless-executable file under lib/, bin/ and scripts/, excluding
 * node_modules/. This intentionally excludes .sh scripts under scripts/
 * (release.sh, setup-hooks.sh, etc) -- those are out of this test's scope,
 * not silently missed; a future phase can widen the scan if needed.
 *
 * THIS TEST IS RED ON THIS PLAN'S OWN RUN. scripts/probe-brain-contract.cjs:74
 * and scripts/build-brain-census.cjs:61 each still declare their own
 * BRAIN_URL const; plan 339-07 removes them. Do not add either file to the
 * ALLOWLIST to make this test green -- print the offending file:line
 * instead, so 339-07's executor has the exact work list.
 *
 * Three arms, hand-rolled record()/failed-counter harness (mirrors
 * tests/test-254-normalize-roundtrip-probe.cjs's own precedent, not
 * node:test):
 *   Arm 1 - ALLOWLIST shape: exactly two entries, each carrying a written
 *           reason of at least 40 characters, so a future third entry
 *           cannot be added silently.
 *   Arm 2 - self-check: the comment-stripping logic does not flag a
 *           comment-only line carrying the literal (fixture string, no
 *           real file I/O).
 *   Arm 3 - the live source scan itself: zero un-allowlisted onrender.com
 *           Brain origin literals on a non-comment line anywhere in scope.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCAN_ROOTS = ['lib', 'bin', 'scripts'];
const ORIGIN_RE = /\b(?:pws-brain-mcp|theo-mcp)\.onrender\.com\b/;

// ---------------------------------------------------------------------------
// ALLOWLIST: exactly two entries, each with a written reason string. Adding
// a third entry without extending both the array AND giving it a reason of
// at least 40 characters is caught by Arm 1 below.
// ---------------------------------------------------------------------------
const ALLOWLIST = Object.freeze([
  Object.freeze({
    file: 'lib/core/brain-client.cjs',
    reason:
      'the module-scope BRAIN_URL const is the single source of truth every ' +
      'other site resolves through getBrainUrl(); this is the one place the ' +
      'literal is allowed to exist.',
  }),
  Object.freeze({
    file: 'lib/core/doctor/class-m-brain-smoke.cjs',
    reason:
      "layer 6's canon-endpoint constant answers \"is the resolved endpoint " +
      'the canon one\", so deriving it from getBrainUrl() would make the ' +
      'comparison always true and destroy the check; it moves in the same ' +
      'commit as line 24 instead.',
  }),
]);
const ALLOWLIST_FILES = new Set(ALLOWLIST.map((e) => e.file));

// ---------------------------------------------------------------------------
// Comment-stripping. Deliberately NOT one whole-file state machine tracking
// quotes across the entire file: an early build of this scanner did that and
// broke on scripts/session-start (107KB of bash mixing real code, `#`
// comments containing English contractions like "doesn't", and embedded
// heredoc/JS snippets) -- a single stray unmatched quote anywhere upstream
// left the state machine stuck inside a fake string for hundreds of lines,
// silently swallowing real `#` comment lines whole (so line 1878's comment
// was never recognized as a comment at all). The fix: reset quote-tracking
// state at the START OF EVERY LINE. JS string literals and shell single/
// double-quoted strings are conventionally single-line in this codebase, so
// per-line reset costs nothing in the common case and BOUNDS any parsing
// mistake to at most one line, never hundreds. This is a documented, deliberate
// tradeoff: a `/* ... */` block comment or a genuine multi-line template
// literal can still span lines (handled explicitly below); a stray `'` or
// `"` cannot corrupt anything past the line it appears on.
//
// Two file kinds, two strippers:
//   jslike (.cjs, .js): mask /* */ block comments first (multi-line, quote-
//     blind -- accepted limitation: a literal "/*" inside a string would be
//     misread as a comment start, not applicable to any file this test
//     scans), then strip `//` line comments per line with same-line quote
//     awareness so `'https://...'` is never truncated at its own scheme.
//   shell (extensionless executables): strip `#` line comments per line
//     with the same same-line quote awareness, no block-comment concept.
// ---------------------------------------------------------------------------
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
    // state === 'block'
    if (c === '*' && c2 === '/') { state = 'code'; out += '  '; i += 1; continue; }
    out += c === '\n' ? '\n' : ' ';
  }
  return out;
}

function stripQuoteAwarePerLine(line, commentChar) {
  let out = '';
  let state = 'code'; // code | squote | dquote | btick (btick only relevant for jslike)
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    const c2 = i + 1 < line.length ? line[i + 1] : '';
    if (state === 'code') {
      if (c === "'") { state = 'squote'; out += c; continue; }
      if (c === '"') { state = 'dquote'; out += c; continue; }
      if (c === '`') { state = 'btick'; out += c; continue; }
      if (commentChar === '//' && c === '/' && c2 === '/') {
        out += ' '.repeat(line.length - i);
        break;
      }
      if (commentChar === '#' && c === '#') {
        out += ' '.repeat(line.length - i);
        break;
      }
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

function stripJsLikeComments(src) {
  const masked = maskJsBlockComments(src);
  return masked
    .split('\n')
    .map((line) => stripQuoteAwarePerLine(line, '//'))
    .join('\n');
}

function stripShellComments(src) {
  return src
    .split('\n')
    .map((line) => stripQuoteAwarePerLine(line, '#'))
    .join('\n');
}

// ---------------------------------------------------------------------------
// File walk: .cjs, .js, and extensionless-executable files under lib/, bin/,
// scripts/, excluding node_modules/.
// ---------------------------------------------------------------------------
function isExecutable(fullPath) {
  try {
    const st = fs.statSync(fullPath);
    return (st.mode & 0o111) !== 0;
  } catch (_) {
    return false;
  }
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (ext === '.cjs' || ext === '.js') {
      out.push({ full, kind: 'jslike' });
    } else if (ext === '' && isExecutable(full)) {
      out.push({ full, kind: 'shell' });
    }
  }
}

function collectViolations() {
  const files = [];
  for (const root of SCAN_ROOTS) {
    walk(path.join(REPO_ROOT, root), files);
  }
  const violations = [];
  for (const { full, kind } of files) {
    const rel = path.relative(REPO_ROOT, full).split(path.sep).join('/');
    const src = fs.readFileSync(full, 'utf8');
    const stripped = kind === 'jslike' ? stripJsLikeComments(src) : stripShellComments(src);
    const lines = stripped.split('\n');
    for (let idx = 0; idx < lines.length; idx += 1) {
      if (ORIGIN_RE.test(lines[idx])) {
        if (ALLOWLIST_FILES.has(rel)) continue;
        violations.push(rel + ':' + (idx + 1));
      }
    }
  }
  return violations;
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

  process.stdout.write('Phase 339-01 (FLIP-01) origin single-source scan -- HERMETIC\n');

  // -------------------------------------------------------------------------
  // Arm 1: ALLOWLIST shape.
  // -------------------------------------------------------------------------
  record('Arm 1: ALLOWLIST has exactly two entries, each with a reason >= 40 chars', () => {
    assert.strictEqual(ALLOWLIST.length, 2, 'ALLOWLIST must carry exactly two entries');
    for (const entry of ALLOWLIST) {
      assert.strictEqual(typeof entry.file, 'string', 'each ALLOWLIST entry needs a file string');
      assert.strictEqual(typeof entry.reason, 'string', 'each ALLOWLIST entry needs a reason string');
      assert.ok(
        entry.reason.length >= 40,
        'ALLOWLIST reason for ' + entry.file + ' must be at least 40 characters (got ' + entry.reason.length + ')'
      );
    }
    assert.deepStrictEqual(
      Array.from(ALLOWLIST_FILES).sort(),
      ['lib/core/brain-client.cjs', 'lib/core/doctor/class-m-brain-smoke.cjs'].sort(),
      'ALLOWLIST must name exactly brain-client.cjs and class-m-brain-smoke.cjs'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 2: self-check, comment-only literal lines do not fail the scan.
  // -------------------------------------------------------------------------
  record('Arm 2: a comment-only line carrying the literal is not a violation (self-check fixture)', () => {
    const jsFixture = [
      "'use strict';",
      '// mirrors https://pws-brain-mcp.onrender.com, the incumbent default',
      '/* also fine, single line: theo-mcp.onrender.com is the flip target */',
      '/**',
      ' * a docblock continuation line naming pws-brain-mcp.onrender.com',
      ' * (mirrors the real session-start / class-m-brain-smoke docblock shape)',
      ' */',
      "const CODE_LINE = 'no literal here';",
    ].join('\n');
    const jsStripped = stripJsLikeComments(jsFixture);
    const jsLines = jsStripped.split('\n');
    for (let idx = 0; idx < jsLines.length; idx += 1) {
      assert.ok(
        !ORIGIN_RE.test(jsLines[idx]),
        'jslike fixture line ' + (idx + 1) + ' must be comment-stripped clean, got: ' + JSON.stringify(jsLines[idx])
      );
    }

    const shellFixture = [
      '#!/usr/bin/env bash',
      '#   - "Brain: HTTP client active (pws-brain-mcp.onrender.com)" -- key resolved.',
      "# key, never calls Brain. The \"pws-brain-mcp.onrender.com\" string in the",
      'echo "no literal on this line" >&2',
    ].join('\n');
    const shellStripped = stripShellComments(shellFixture);
    const shellLines = shellStripped.split('\n');
    for (let idx = 0; idx < shellLines.length; idx += 1) {
      assert.ok(
        !ORIGIN_RE.test(shellLines[idx]),
        'shell fixture line ' + (idx + 1) + ' must be comment-stripped clean, got: ' + JSON.stringify(shellLines[idx])
      );
    }

    // Positive controls: a real code-line literal, including one shaped like
    // the module-scope const (with the '//' scheme INSIDE a string, the
    // exact case naive '//'-truncation would falsely clear), must still be
    // caught after stripping, for BOTH strippers.
    const positiveJs =
      "const BRAIN_URL = process.env.MINDRIAN_BRAIN_URL || 'https://theo-mcp.onrender.com';";
    assert.ok(
      ORIGIN_RE.test(stripJsLikeComments(positiveJs)),
      'a real jslike code-line origin literal must survive comment-stripping (positive control)'
    );
    const positiveShell = '  echo "Brain: HTTP client active (pws-brain-mcp.onrender.com)" >&2';
    assert.ok(
      ORIGIN_RE.test(stripShellComments(positiveShell)),
      'a real shell code-line origin literal must survive comment-stripping (positive control)'
    );
  });

  // -------------------------------------------------------------------------
  // Arm 3: the live source scan.
  // -------------------------------------------------------------------------
  record('Arm 3: zero un-allowlisted onrender.com origin literals under lib/, bin/, scripts/', () => {
    const violations = collectViolations();
    if (violations.length > 0) {
      process.stdout.write(
        '\n  ' + violations.length + ' violation(s) found (this is the correct wave-1 state; ' +
          'plan 339-07 clears the remaining script literals):\n'
      );
      for (const v of violations) {
        process.stdout.write('    ' + v + '\n');
      }
    }
    assert.deepStrictEqual(
      violations,
      [],
      violations.length + ' un-allowlisted origin literal(s) found: ' + violations.join(', ')
    );
  });

  process.stdout.write(
    '\nPhase 339-01 (FLIP-01) origin single-source scan: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
