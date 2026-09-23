#!/usr/bin/env node
'use strict';

// Phase 361 (dominant-design research mode) baseline test.
//
// Proves that tests/fixtures/361-pre-phase.json faithfully pins the state of
// this repo the instant before any Phase 361 edit landed: the base commit
// itself, the command-registry digest and row, the /mos:dominant-designs
// Setup section and quick-pass paragraph, and the find_connections arm of
// lib/core/part8-egress-guard.cjs's _proveKnownToolShape. Every later
// test-361-*.cjs file measures its own "did 361 change this" claim against
// this fixture, so a hand-edited fixture must fail here first.
//
// The extraction helpers below (extractSetupSection, extractQuickPassParagraph,
// extractFindConnectionsSlice, sha256, loadFixture) are exported so later 361
// tests reuse the exact same slice rules instead of re-deriving them.
//
// exit 0  -> PASSED (all six legs)
// exit 1  -> FAILED
// exit 77 -> SKIPPED (ENV GAP, e.g. fixture or git missing)
//
// House rule: hyphens only, no em-dashes, no emoji.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// --- Test hygiene: no network egress from any 361 test -----------------------
let networkAttempted = false;
globalThis.fetch = function _blockedFetch() {
  networkAttempted = true;
  process.stderr.write('NETWORK_ATTEMPT_361\n');
  throw new Error('NETWORK_ATTEMPT_361: fetch is blocked in tests/test-361-baseline.cjs');
};

const PRELOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-361-preload-'));
const PRELOAD_FILE = path.join(PRELOAD_DIR, 'no-network-preload.cjs');
fs.writeFileSync(
  PRELOAD_FILE,
  "globalThis.fetch = function () { process.stderr.write('NETWORK_ATTEMPT_361\\n'); " +
    "throw new Error('NETWORK_ATTEMPT_361'); };\n"
);
const CHILD_ENV = Object.assign({}, process.env, { NODE_OPTIONS: `--require ${PRELOAD_FILE}` });

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', '361-pre-phase.json');

// --- Shared extraction helpers (reused by later test-361-*.cjs files) -------

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function gitShow(sha, filePath) {
  return execFileSync('git', ['show', `${sha}:${filePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    env: CHILD_ENV,
    maxBuffer: 1024 * 1024 * 16,
  });
}

function extractSetupSection(text) {
  const startIdx = text.indexOf('## Setup');
  const endIdx = text.indexOf('## Session Flow');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  return text.slice(startIdx, endIdx);
}

function extractQuickPassParagraph(text) {
  const startMarker = 'Then follow the framework phases';
  const endMarker = 'slow down.';
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endMarkerIdx = text.indexOf(endMarker, startIdx);
  if (endMarkerIdx === -1) return null;
  const endIdx = endMarkerIdx + endMarker.length;
  return text.slice(startIdx, endIdx);
}

function extractFindConnectionsSlice(text) {
  const lines = text.split('\n');
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf("toolName.indexOf('find_connections') !== -1") !== -1) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) return null;
  let endLine = -1;
  for (let i = startLine + 1; i < lines.length; i++) {
    if (lines[i] === '  }') {
      endLine = i;
      break;
    }
  }
  if (endLine === -1) return null;
  return lines.slice(startLine, endLine + 1).join('\n');
}

function parseDominantDesignsRow(registryText) {
  const registry = JSON.parse(registryText);
  const commands = Array.isArray(registry.commands) ? registry.commands : [];
  return commands.find((c) => c && c.command === '/mos:dominant-designs') || null;
}

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

module.exports = {
  sha256,
  gitShow,
  extractSetupSection,
  extractQuickPassParagraph,
  extractFindConnectionsSlice,
  parseDominantDesignsRow,
  loadFixture,
  FIXTURE_PATH,
};

// --- Test runner ---------------------------------------------------------

if (require.main === module) {
  let pass = 0;
  let fail = 0;
  let envGap = false;

  function leg(name, fn) {
    try {
      fn();
      console.log(`PASS: ${name}`);
      pass += 1;
    } catch (err) {
      console.log(`FAIL: ${name} -- ${err && err.message ? err.message : err}`);
      fail += 1;
    }
  }

  let fixture;
  try {
    fixture = loadFixture();
  } catch (err) {
    console.log(`ENV GAP: fixture not readable at ${FIXTURE_PATH} -- ${err.message}`);
    process.exit(77);
  }

  leg('base_sha is 40-hex and an ancestor of HEAD', () => {
    if (!/^[0-9a-f]{40}$/.test(fixture.base_sha)) {
      throw new Error(`base_sha is not 40-hex: ${fixture.base_sha}`);
    }
    execFileSync('git', ['merge-base', '--is-ancestor', fixture.base_sha, 'HEAD'], {
      cwd: ROOT,
      env: CHILD_ENV,
    });
  });

  leg('command-registry.json sha256 matches the pinned digest', () => {
    const text = gitShow(fixture.base_sha, 'data/command-registry.json');
    const digest = sha256(text);
    if (digest !== fixture.command_registry_sha256) {
      throw new Error(
        `sha256 mismatch: got ${digest}, fixture has ${fixture.command_registry_sha256}`
      );
    }
  });

  leg('the /mos:dominant-designs registry row deep-equals the pinned row', () => {
    const text = gitShow(fixture.base_sha, 'data/command-registry.json');
    const row = parseDominantDesignsRow(text);
    if (!row) throw new Error('row not found in base registry');
    if (!deepEqual(row, fixture.dominant_designs_row)) {
      throw new Error('registry row does not deep-equal fixture.dominant_designs_row');
    }
  });

  leg('Setup section and quick-pass paragraph match the pinned text and digests', () => {
    const text = gitShow(fixture.base_sha, 'commands/dominant-designs.md');
    const setup = extractSetupSection(text);
    const quickPass = extractQuickPassParagraph(text);
    if (setup !== fixture.setup_section) {
      throw new Error('setup_section text mismatch');
    }
    if (sha256(setup) !== fixture.setup_section_sha256) {
      throw new Error('setup_section_sha256 mismatch');
    }
    if (quickPass !== fixture.quick_pass_paragraph) {
      throw new Error('quick_pass_paragraph text mismatch');
    }
    if (sha256(quickPass) !== fixture.quick_pass_paragraph_sha256) {
      throw new Error('quick_pass_paragraph_sha256 mismatch');
    }
  });

  leg('find_connections arm slice matches the pinned text and digest', () => {
    const text = gitShow(fixture.base_sha, 'lib/core/part8-egress-guard.cjs');
    const slice = extractFindConnectionsSlice(text);
    if (slice !== fixture.find_connections_slice) {
      throw new Error('find_connections_slice text mismatch');
    }
    if (sha256(slice) !== fixture.find_connections_slice_sha256) {
      throw new Error('find_connections_slice_sha256 mismatch');
    }
    if (!slice.split('\n')[0].includes("toolName.indexOf('find_connections') !== -1")) {
      throw new Error('slice does not start with the find_connections guard line');
    }
    const sliceLines = slice.split('\n');
    if (sliceLines[sliceLines.length - 1] !== '  }') {
      throw new Error('slice does not end with a two-space } line');
    }
  });

  leg('no network attempt was made', () => {
    if (networkAttempted) {
      throw new Error('fetch thrower fired -- a network attempt was made');
    }
  });

  console.log(`PASSED=${pass} FAILED=${fail} SKIPPED=${envGap ? 1 : 0}`);
  process.exit(fail > 0 ? 1 : 0);
}
