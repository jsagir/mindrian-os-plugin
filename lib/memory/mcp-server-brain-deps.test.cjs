#!/usr/bin/env node
'use strict';

/**
 * Phase 94-04 -- mcp-server-brain dependency + drift fence.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Phase 94-04 closes the v1.11.0 P0 ship-blocker where the bundled
 * mcp-server-brain/ cannot start because npm install never runs in that
 * subdirectory and required env vars (SUPABASE_URL, MINDRIAN_BRAIN_KEY,
 * etc.) are silently absent. Plan 94-04 ships three layers of safety:
 *
 *   1. install.sh post-install hook that runs `(cd mcp-server-brain &&
 *      npm install)` IF the directory exists, with graceful skip when it
 *      does not. Tier 0 graceful per Canon Decision 8.
 *   2. .env.brain.template lists all 7 required env vars (SUPABASE_URL,
 *      SUPABASE_KEY, MINDRIAN_BRAIN_KEY, NEO4J_URI, NEO4J_USERNAME,
 *      NEO4J_PASSWORD, PINECONE_API_KEY) one per line with a `#` comment
 *      describing each. Configuration becomes documented, not implicit.
 *   3. scripts/session-start emits a yellow WARN line when
 *      MINDRIAN_BRAIN_KEY is set but the canonical 'mindrian-brain' MCP
 *      server is not declared in .mcp.json (this repo) OR the user's
 *      personal .mcp.json. Loud yellow signal beats silent tier_0
 *      fallback.
 *
 * docs/install/BRAIN-SETUP.md gains a 'Bundled mcp-server-brain
 * (optional/legacy)' section documenting the deprecation path -- v1.11.2
 * defaults to users pointing 'mindrian-brain' at their own Neo4j MCP
 * (Plan 94-03 Option A); the bundled server remains buildable for
 * advanced users.
 *
 * Test map (4 cases, one-to-one with the PLAN <behavior> block):
 *   T1  install.sh contains the literal `cd mcp-server-brain && npm
 *       install` substring AND wraps it in an existence guard that
 *       references mcp-server-brain/package.json.
 *   T2  .env.brain.template contains every one of these 7 substrings:
 *       SUPABASE_URL, SUPABASE_KEY, MINDRIAN_BRAIN_KEY, NEO4J_URI,
 *       NEO4J_USERNAME, NEO4J_PASSWORD, PINECONE_API_KEY.
 *   T3  scripts/session-start contains a drift check that references
 *       BOTH 'MINDRIAN_BRAIN_KEY' and the canonical 'mindrian-brain'
 *       server name, with a WARN-prefixed advisory line.
 *   T4  docs/install/BRAIN-SETUP.md contains a header substring
 *       matching /(Bundled|Deprecated|optional.*legacy)/i AND mentions
 *       'mcp-server-brain'. Skip-gracefully if the file does not yet
 *       exist (Plan 94-03 may not have landed -- in this repo it has).
 *
 * Canon Part 7 (Reuse Before Build): install.sh and session-start are
 * existing chokepoints; this plan extends them rather than introducing
 * new orchestration.
 *
 * Canon Part 8 (Graph Boundary): drift check is a LOCAL-only signal
 * derived from local env vars + .mcp.json file inspection; zero network
 * surface added.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const INSTALL_SH = path.join(REPO, 'install.sh');
const ENV_TEMPLATE = path.join(REPO, '.env.brain.template');
const SESSION_START = path.join(REPO, 'scripts', 'session-start');
const BRAIN_SETUP = path.join(REPO, 'docs', 'install', 'BRAIN-SETUP.md');

// ---------- Helpers ----------

function readFileGuarded(p) {
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

function logPass(name) {
  process.stdout.write('PASS ' + name + '\n');
}

function logSkip(name, reason) {
  process.stdout.write('SKIP ' + name + ' (' + reason + ')\n');
}

function logFail(name, err) {
  process.stderr.write('FAIL ' + name + '\n');
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  if (err && err.stack) process.stderr.write(err.stack + '\n');
}

let passed = 0;
let failed = 0;
let skipped = 0;

function runTest(name, fn) {
  try {
    const result = fn();
    if (result === 'skip') {
      skipped += 1;
      return;
    }
    passed += 1;
    logPass(name);
  } catch (err) {
    failed += 1;
    logFail(name, err);
  }
}

// ---------- T1: install.sh post-install hook ----------

runTest(
  'T1 install.sh contains conditional cd mcp-server-brain && npm install hook',
  () => {
    const src = readFileGuarded(INSTALL_SH);
    assert.ok(src, 'install.sh exists at repo root');

    // The literal install command must appear.
    assert.match(
      src,
      /cd\s+mcp-server-brain\s+&&\s+npm\s+install/,
      'install.sh references `cd mcp-server-brain && npm install`'
    );

    // The command must be wrapped in an existence guard against
    // mcp-server-brain/package.json so users without the bundled server
    // do not see a confusing error (Tier 0 graceful per Canon Decision 8).
    assert.match(
      src,
      /mcp-server-brain\/package\.json/,
      'install.sh references mcp-server-brain/package.json existence'
    );

    // Zero em-dashes in the modified file (Phase 94 hard rule).
    assert.ok(
      !/—/.test(src),
      'install.sh contains zero em-dashes (Phase 94 rule)'
    );
  }
);

// ---------- T2: .env.brain.template lists all 7 required vars ----------

runTest(
  'T2 .env.brain.template lists all 7 required env vars',
  () => {
    const src = readFileGuarded(ENV_TEMPLATE);
    assert.ok(src, '.env.brain.template exists at repo root');

    const required = [
      'SUPABASE_URL',
      'SUPABASE_KEY',
      'MINDRIAN_BRAIN_KEY',
      'NEO4J_URI',
      'NEO4J_USERNAME',
      'NEO4J_PASSWORD',
      'PINECONE_API_KEY',
    ];

    for (const key of required) {
      assert.match(
        src,
        new RegExp('\\b' + key + '\\b'),
        '.env.brain.template contains ' + key
      );
    }

    // Zero em-dashes in the modified file (Phase 94 hard rule).
    assert.ok(
      !/—/.test(src),
      '.env.brain.template contains zero em-dashes (Phase 94 rule)'
    );

    // Plan must_have: minimum line count of 25 (one comment + var + blank
    // per group leaves comfortable room).
    const lineCount = src.split('\n').length;
    assert.ok(
      lineCount >= 20,
      '.env.brain.template has at least 20 lines (got ' + lineCount + ')'
    );
  }
);

// ---------- T3: scripts/session-start drift check ----------

runTest(
  'T3 scripts/session-start emits WARN when MINDRIAN_BRAIN_KEY set but mindrian-brain absent',
  () => {
    const src = readFileGuarded(SESSION_START);
    assert.ok(src, 'scripts/session-start exists');

    // The drift check must reference the env var the user sets.
    assert.match(
      src,
      /MINDRIAN_BRAIN_KEY/,
      'session-start references MINDRIAN_BRAIN_KEY env var'
    );

    // The drift check must reference the canonical server name (Plan
    // 94-03 standardized this across 17 commands).
    assert.match(
      src,
      /["']mindrian-brain["']/,
      'session-start references canonical mindrian-brain server name'
    );

    // The advisory line must be loud (yellow / WARN) so users notice
    // the misconfiguration instead of silent tier_0 fallback.
    assert.match(
      src,
      /WARN[^\n]*MINDRIAN_BRAIN_KEY/,
      'session-start emits WARN-prefixed advisory'
    );

    // Zero em-dashes (Phase 94 hard rule).
    assert.ok(
      !/—/.test(src),
      'scripts/session-start contains zero em-dashes (Phase 94 rule)'
    );
  }
);

// ---------- T4: docs/install/BRAIN-SETUP.md deprecation section ----------

runTest(
  'T4 docs/install/BRAIN-SETUP.md contains bundled-server deprecation section',
  () => {
    const src = readFileGuarded(BRAIN_SETUP);
    if (src === null) {
      logSkip(
        'T4 docs/install/BRAIN-SETUP.md contains bundled-server deprecation section',
        'BRAIN-SETUP.md does not exist yet (Plan 94-03 not landed)'
      );
      return 'skip';
    }

    // Header substring matching one of the deprecation patterns.
    assert.match(
      src,
      /Bundled|Deprecated|optional.*legacy/i,
      'BRAIN-SETUP.md contains a Bundled/Deprecated/optional-legacy header'
    );

    // The section must mention the directory it deprecates.
    assert.match(
      src,
      /mcp-server-brain/,
      'BRAIN-SETUP.md mentions mcp-server-brain by name'
    );

    // Zero em-dashes (Phase 94 hard rule).
    assert.ok(
      !/—/.test(src),
      'docs/install/BRAIN-SETUP.md contains zero em-dashes (Phase 94 rule)'
    );
  }
);

// ---------- Final report ----------

const total = passed + failed + skipped;
process.stdout.write(
  '\nmcp-server-brain-deps: ' +
    passed + '/' + total + ' passed' +
    (skipped > 0 ? ', ' + skipped + ' skipped' : '') +
    (failed > 0 ? ', ' + failed + ' failed' : '') +
    '\n'
);

process.exit(failed === 0 ? 0 : 1);
