#!/usr/bin/env node
'use strict';

/*
 * Phase 127-01 Task 2 -- migration orchestration script.
 *
 * Addresses BRAIN-MCP-127-04 (script + --dry-run flag = SG-3) +
 * BRAIN-MCP-127-05 (SG-1 HARD INVARIANT consumed structurally) +
 * BRAIN-MCP-127-06 (SG-2 pre-migration snapshot) +
 * BRAIN-MCP-127-07 (SG-4 idempotency log -- via lib/core/migration-snapshot.cjs).
 *
 * Detects existing testers' user-scope HTTP-transport legacy MCP entries and
 * removes them via the supported CLI subprocess
 *   claude mcp remove --scope user mindrian-brain
 *
 * SG-1 HARD INVARIANT: this script NEVER writes a file at any path resolving
 * to the legacy user-scope JSON state file. ALL scope-user state mutations
 * route through the supported `claude mcp <add|remove> --scope user` CLI
 * subprocess. Acceptance gates (Task 3 harness T5 + plan's <verification> #2)
 * structurally enforce this: a forbidden-token grep returns zero, AND a
 * byte-equality sha256 test asserts the legacy state file is untouched.
 *
 * Modes:
 *   --dry-run    print planned actions without state changes (SG-3)
 *   --help       usage
 *   (default)    execute the migration plan
 *
 * Two-key conflict case: when the legacy user-scope Bearer differs from the
 * current ~/.mindrian.env key (documented Wave-1 tester case), the script
 * REFUSES to auto-migrate and surfaces a one-line warning instructing the
 * user to reconcile keys manually.
 *
 * HARD RULE: zero em-dashes in this file (hyphens only).
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const snapshot = require('../lib/core/migration-snapshot.cjs');
const { resolveBrainKey } = require('../lib/core/resolve-brain-key.cjs');

const SOURCE_NAME = 'mindrian-brain';

function getLegacyEntry(mockClaude) {
  if (typeof mockClaude === 'function') return mockClaude();
  try {
    const out = execFileSync('claude', ['mcp', 'get', SOURCE_NAME, '--scope', 'user'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 5000,
    });
    const entry = JSON.parse(out);
    if (entry && entry.type === 'http' && entry.scope === 'user') return entry;
    return null;
  } catch (_) {
    // non-zero exit = no entry present; the canonical "nothing to migrate" case
    return null;
  }
}

function extractBearerKey(entry) {
  const auth = entry && entry.headers && entry.headers.Authorization;
  if (!auth) return null;
  const m = String(auth).match(/^Bearer\s+(.+)$/);
  return m ? m[1].trim() : null;
}

function planMigration(opts) {
  const o = opts || {};
  const homeDir = o.homeDir || os.homedir();
  const entry = getLegacyEntry(o.mockClaude);
  if (!entry) {
    return { action: 'none', reason: 'no_legacy_entry_present' };
  }
  const fp = snapshot.fingerprintEntry(entry);
  if (snapshot.isAlreadyMigrated(homeDir, SOURCE_NAME, fp)) {
    return { action: 'already_migrated', reason: 'idempotency_log_match', fingerprint: fp };
  }
  const legacyKey = extractBearerKey(entry);
  const currentResolved = (o.mockBrainKey !== undefined)
    ? { key: o.mockBrainKey, available: !!o.mockBrainKey }
    : resolveBrainKey({ home: homeDir });
  if (legacyKey && currentResolved.available && legacyKey !== currentResolved.key) {
    return {
      action: 'refuse',
      reason: 'two_key_conflict_rotate_required',
      fingerprint: fp,
      warning: 'legacy user-scope mindrian-brain Bearer differs from current ~/.mindrian.env key; '
        + 'auto-migration refused -- run `claude mcp remove --scope user mindrian-brain` after rotating keys',
    };
  }
  return {
    action: 'remove',
    reason: 'legacy_http_transport_matches_current_key',
    fingerprint: fp,
    entry_snapshot: entry,
  };
}

function executePlan(args) {
  const a = args || {};
  const plan = a.plan;
  const homeDir = a.homeDir || os.homedir();
  const dryRun = !!a.dryRun;
  const isoTs = a.isoTs || new Date().toISOString();

  if (!plan || plan.action === 'none' || plan.action === 'already_migrated') {
    return { executed: false, action: plan ? plan.action : 'none' };
  }
  if (plan.action === 'refuse') {
    process.stderr.write('[migrate-brain-mcp] WARNING: ' + plan.warning + '\n');
    return { executed: false, action: 'refused', warning: plan.warning };
  }
  // action === 'remove'
  if (dryRun) {
    return {
      executed: false,
      action: 'dry-run',
      would_have: [
        'snapshot',
        'claude mcp remove --scope user ' + SOURCE_NAME,
        'log fingerprint=' + plan.fingerprint,
      ],
    };
  }
  // SG-2: snapshot lands BEFORE any state-changing call. The snapshot file is
  // the user's manual-restore surface if the CLI subprocess misbehaves.
  const snapPath = snapshot.snapshotPath(homeDir, isoTs);
  fs.mkdirSync(path.dirname(snapPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(snapPath, JSON.stringify(plan.entry_snapshot, null, 2), { mode: 0o600 });

  // SG-1: route through the supported CLI. This file contains zero direct
  // writes to the legacy user-scope state JSON; the mutation is delegated to
  // the supported CLI subprocess by design.
  const removeFn = a.mockRemove || (() => execFileSync('claude',
    ['mcp', 'remove', SOURCE_NAME, '--scope', 'user'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 }));
  removeFn();

  // SG-4: idempotency log with sha256 fingerprint (no raw identifiers --
  // appendMigrationLog enforces the scrub via _scanForRawIdentifiers).
  snapshot.appendMigrationLog(homeDir, {
    ts: isoTs,
    source: SOURCE_NAME,
    fingerprint: plan.fingerprint,
    action: 'removed',
  });

  return { executed: true, action: 'removed', fingerprint: plan.fingerprint, snapshot_path: snapPath };
}

function usage() {
  return 'Usage: migrate-brain-mcp-from-http-to-stdio.cjs [--dry-run] [--help]\n'
    + '\n'
    + 'Removes legacy user-scope HTTP-transport mindrian-brain entries via the\n'
    + 'supported `claude mcp remove --scope user` CLI. Idempotent; safe to re-run.\n'
    + 'Refuses to auto-migrate when the legacy Bearer differs from ~/.mindrian.env.\n';
}

function main(argv) {
  const args = argv || process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage());
    return 0;
  }
  const dryRun = args.includes('--dry-run');
  const plan = planMigration({});
  if (dryRun) {
    process.stdout.write('[migrate-brain-mcp] dry-run: would ' + plan.action
      + (plan.fingerprint ? ' (fingerprint=' + plan.fingerprint + ')' : '') + '\n');
    const result = executePlan({ plan, dryRun: true });
    if (result.would_have) {
      for (const step of result.would_have) {
        process.stdout.write('[migrate-brain-mcp] dry-run: would ' + step + '\n');
      }
    }
    return 0;
  }
  const result = executePlan({ plan, dryRun: false });
  process.stdout.write('[migrate-brain-mcp] ' + JSON.stringify(result) + '\n');
  return 0;
}

module.exports = { main, planMigration, executePlan, getLegacyEntry, extractBearerKey, SOURCE_NAME };

if (require.main === module) {
  process.exit(main());
}
