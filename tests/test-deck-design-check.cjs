'use strict';
// Phase 175-02 -- deck-design ruleset WARN-first check test.
//
// Proves the deck-design ruleset --check (D-04d, CIRS deferred-enforcement,
// mirroring R6/R11) WARNs, never FAILs, this phase. Two parts:
//
//   (a) the six Task-1 checker behaviors exercised directly against the three
//       pure checkers in lib/core/deck-design-rules.cjs with inline HTML
//       fixtures (a missing source link; all source links; an AI image with no
//       provenance; a conformant provenance footer; a logo linking to
//       mindrian-os.com; a logo that does not);
//   (b) a spawned scripts/check-deck-design.cjs over a fixture HTML with a
//       missing source link AND a missing AI-image provenance footer, asserting
//       the process exits 0 (WARN-first) while emitting [deck-design WARN] lines
//       on stderr.
//
// The checkers are pure functions of the HTML string (Canon Part 8: zero Brain,
// zero network). Each returns an array of { rule, severity, message } findings
// where severity is always "warn" this phase. WARN-first means the CLI exits 0
// even when warnings are present; the hard-FAIL flip is deferred (D-04d).
//
// Node built-ins only (assert, child_process, fs, os, path). Hyphens only; no
// em-dashes.

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RULES_PATH = path.join(REPO_ROOT, 'lib', 'core', 'deck-design-rules.cjs');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'check-deck-design.cjs');

const {
  checkSourceLinks,
  checkImageProvenance,
  checkBrandBinding,
  DESIGN_SYSTEM,
  PROVENANCE_FORMAT,
} = require(RULES_PATH);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// A conformant logo anchor: the default MindrianOS Design System logo -> mindrian-os.com.
const LOGO_OK = '<a class="logo" href="https://mindrian-os.com"><span>MINDRIAN</span></a>';
const LOGO_BAD = '<a class="logo" href="https://example.com"><span>MINDRIAN</span></a>';

// ---- checkSourceLinks ----

check('Test 1: checkSourceLinks WARNs on a sourced claim with no href', () => {
  const html = LOGO_OK + '<p data-sourced="Acme 2025 market report">TAM is 40B.</p>';
  const findings = checkSourceLinks(html);
  assert.equal(Array.isArray(findings), true, 'returns an array');
  assert.equal(findings.length, 1, 'one finding for the unlinked sourced claim');
  assert.equal(findings[0].severity, 'warn', 'severity is warn (WARN-first)');
  assert.match(findings[0].message, /Acme 2025 market report|sourced/i,
    'names the unlinked claim');
});

check('Test 2: checkSourceLinks empty when every sourced claim carries an href', () => {
  const html = LOGO_OK +
    '<p data-sourced="Acme 2025"><a href="https://acme.example/report">TAM is 40B.</a></p>' +
    '<p data-sourced="BLS 2024"><a href="https://bls.example/x">Labor up 3%.</a></p>';
  const findings = checkSourceLinks(html);
  assert.deepEqual(findings, [], 'no findings when all sourced claims are linked');
});

// ---- checkImageProvenance ----

check('Test 3: checkImageProvenance WARNs on an AI image with no provenance footer', () => {
  const html = LOGO_OK + '<img data-ai="true" src="hero.png" alt="hero">';
  const findings = checkImageProvenance(html);
  assert.equal(findings.length, 1, 'one finding for the missing footer');
  assert.equal(findings[0].severity, 'warn', 'severity is warn');
  assert.match(findings[0].message, /provenance|footer|AI/i, 'mentions provenance');
});

check('Test 4: checkImageProvenance empty when AI image has a conformant footer', () => {
  const html = LOGO_OK +
    '<figure><img data-ai="true" src="hero.png" alt="hero">' +
    '<figcaption class="ai-provenance" style="position:absolute;right:8px;bottom:8px;font-size:9pt">' +
    'AI: Adobe Firefly, 2025</figcaption></figure>';
  const findings = checkImageProvenance(html);
  assert.deepEqual(findings, [], 'no findings when the footer is conformant');
});

// ---- checkBrandBinding ----

check('Test 5: checkBrandBinding WARNs when the logo is not mindrian-os.com; empty when it is', () => {
  const bad = checkBrandBinding(LOGO_BAD);
  assert.equal(bad.length, 1, 'one finding when the logo link is wrong');
  assert.equal(bad[0].severity, 'warn', 'severity is warn');

  const ok = checkBrandBinding(LOGO_OK);
  assert.deepEqual(ok, [], 'no findings when the logo links to mindrian-os.com');
});

// ---- the constants ----

check('Test 6: DESIGN_SYSTEM + PROVENANCE_FORMAT encode the contract', () => {
  assert.equal(DESIGN_SYSTEM.name, 'MindrianOS Design System', 'design system named');
  assert.equal(DESIGN_SYSTEM.logo_link, 'https://mindrian-os.com', 'logo link is mindrian-os.com');
  assert.match(String(PROVENANCE_FORMAT.position), /bottom-right/i, 'position bottom-right');
  // 8-10pt size band.
  assert.equal(PROVENANCE_FORMAT.min_pt, 8, 'min 8pt');
  assert.equal(PROVENANCE_FORMAT.max_pt, 10, 'max 10pt');
  assert.match(String(PROVENANCE_FORMAT.template), /tool|year|AI:/i, 'tool + year template');
});

// ---- the spawned CLI: WARN-not-FAIL (exit 0 with warnings on stderr) ----

check('Spawn: check-deck-design.cjs exits 0 (WARN-first) with WARN lines on stderr', () => {
  // A deck with a missing source link AND a missing AI-image provenance footer
  // AND a non-mindrian-os.com logo -- three warnings, must still exit 0.
  const html =
    '<!DOCTYPE html><html><head><title>fixture</title></head><body>' +
    LOGO_BAD +
    '<p data-sourced="Some report 2025">A claim with no link.</p>' +
    '<img data-ai="true" src="hero.png" alt="hero">' +
    '</body></html>';

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-design-'));
  const fixturePath = path.join(tmpDir, 'fixture-deck.html');
  fs.writeFileSync(fixturePath, html);

  try {
    const res = spawnSync('node', [CLI_PATH, fixturePath], { encoding: 'utf8' });
    assert.equal(res.status, 0, 'CLI exits 0 even with warnings (WARN-first, D-04d)');
    assert.match(res.stderr, /\[deck-design WARN\]/, 'emits [deck-design WARN] lines on stderr');
    // The summary count line is informational; tolerate stdout or stderr.
    const all = (res.stdout || '') + (res.stderr || '');
    assert.match(all, /warning/i, 'prints a summary mentioning warnings');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

check('Spawn: missing file argument exits 2 (operator error, distinct from a warning)', () => {
  const res = spawnSync('node', [CLI_PATH], { encoding: 'utf8' });
  assert.equal(res.status, 2, 'no file argument is an operator error -> exit 2');
  assert.match(res.stderr, /usage/i, 'prints a usage line to stderr');
});

console.log('\ndeck-design-check: ' + pass + ' checks passed');
