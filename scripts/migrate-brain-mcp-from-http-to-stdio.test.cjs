#!/usr/bin/env node
'use strict';

/*
 * Phase 127-01 Task 2 -- RED tests for the migration orchestration script
 * (scripts/migrate-brain-mcp-from-http-to-stdio.cjs).
 *
 * 11 tests covering BRAIN-MCP-127-04 (script + --dry-run flag) +
 * BRAIN-MCP-127-05 (SG-1 ~/.claude.json byte-equality HARD INVARIANT) +
 * BRAIN-MCP-127-06 (SG-2 snapshot pre-state-change) + dry-run + refuse path
 * + log scrub.
 *
 * Hermetic os.tmpdir() HOME via mkdtempSync + rmSync cleanup. NO real
 * `claude` CLI invocations (every test injects mockClaude / mockBrainKey /
 * mockRemove).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const SCRIPT = path.resolve(__dirname, 'migrate-brain-mcp-from-http-to-stdio.cjs');
const m = require(SCRIPT);

function mkHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mig-brain-mcp-'));
}
function rmHome(h) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (_) {}
}

function legacyEntryFixture() {
  return {
    name: 'mindrian-brain',
    scope: 'user',
    type: 'http',
    url: 'https://example.invalid/mcp',
    headers: { Authorization: 'Bearer testfixturekey0001' },
  };
}

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('PASS: ' + name);
  } catch (e) {
    fail++;
    console.error('FAIL: ' + name);
    console.error('  ' + (e && e.message ? e.message : String(e)));
    if (e && e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  }
}

// ---- T1 ----
t('T1 planMigration returns action=none when no legacy entry present', () => {
  const h = mkHome();
  try {
    const plan = m.planMigration({ homeDir: h, mockClaude: () => null });
    assert.equal(plan.action, 'none');
    assert.equal(plan.reason, 'no_legacy_entry_present');
  } finally { rmHome(h); }
});

// ---- T2 ----
t('T2 planMigration returns action=remove when legacy Bearer matches current key', () => {
  const h = mkHome();
  try {
    const entry = legacyEntryFixture();
    const plan = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0001' });
    assert.equal(plan.action, 'remove');
    assert.equal(plan.reason, 'legacy_http_transport_matches_current_key');
    assert.match(plan.fingerprint, /^[a-f0-9]{16}$/);
  } finally { rmHome(h); }
});

// ---- T3 ----
t('T3 planMigration returns action=refuse on two-key conflict', () => {
  const h = mkHome();
  try {
    const entry = legacyEntryFixture();
    const plan = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0002' });
    assert.equal(plan.action, 'refuse');
    assert.equal(plan.reason, 'two_key_conflict_rotate_required');
    assert.ok(plan.warning && /auto-migration refused/i.test(plan.warning));
  } finally { rmHome(h); }
});

// ---- T4 ----
t('T4 planMigration second call returns action=already_migrated after executePlan(remove)', () => {
  const h = mkHome();
  try {
    const entry = legacyEntryFixture();
    const plan1 = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0001' });
    assert.equal(plan1.action, 'remove');
    m.executePlan({ plan: plan1, homeDir: h, dryRun: false, isoTs: '2026-05-19T20:30:00Z', mockRemove: () => {} });
    const plan2 = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0001' });
    assert.equal(plan2.action, 'already_migrated');
    assert.equal(plan2.reason, 'idempotency_log_match');
  } finally { rmHome(h); }
});

// ---- T5 dry-run side-effect-free ----
t('T5 executePlan dryRun=true returns would_have, no removeFn call, no files written', () => {
  const h = mkHome();
  try {
    const entry = legacyEntryFixture();
    let removeCalled = false;
    const plan = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0001' });
    const result = m.executePlan({ plan, homeDir: h, dryRun: true, mockRemove: () => { removeCalled = true; } });
    assert.equal(removeCalled, false);
    assert.equal(result.executed, false);
    assert.ok(Array.isArray(result.would_have));
    assert.ok(result.would_have.length >= 1);
    // No snapshot dir, no log file
    const snapDir = path.join(h, '.mindrian', 'pre-migration-snapshots');
    assert.equal(fs.existsSync(snapDir), false, 'dry-run must not create snapshot dir');
    const log = path.join(h, '.mindrian', 'migrations.jsonl');
    assert.equal(fs.existsSync(log), false, 'dry-run must not write log');
  } finally { rmHome(h); }
});

// ---- T6 snapshot lands BEFORE removeFn ----
t('T6 executePlan writes snapshot BEFORE invoking removeFn (SG-2 ordering)', () => {
  const h = mkHome();
  try {
    const entry = legacyEntryFixture();
    let snapshotExistsAtRemoveTime = false;
    let snapshotPath = null;
    const plan = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0001' });
    const mockRemove = () => {
      const snapDir = path.join(h, '.mindrian', 'pre-migration-snapshots');
      if (fs.existsSync(snapDir)) {
        const files = fs.readdirSync(snapDir);
        if (files.length > 0) {
          snapshotExistsAtRemoveTime = true;
          snapshotPath = path.join(snapDir, files[0]);
        }
      }
    };
    const result = m.executePlan({ plan, homeDir: h, dryRun: false, isoTs: '2026-05-19T20:30:00Z', mockRemove });
    assert.equal(result.executed, true);
    assert.equal(snapshotExistsAtRemoveTime, true, 'snapshot MUST exist on disk before removeFn is invoked');
    assert.ok(snapshotPath && fs.existsSync(snapshotPath));
  } finally { rmHome(h); }
});

// ---- T7 SG-1 byte-equality of ~/.claude.json ----
t('T7 SG-1 HARD INVARIANT: ~/.claude.json byte-identical before+after executePlan', () => {
  const h = mkHome();
  try {
    const fakeClaudeJson = path.join(h, '.claude.json');
    const payload = JSON.stringify({
      projects: {},
      mcpServers: { 'mindrian-brain': { type: 'http', url: 'https://example.invalid/mcp', headers: { Authorization: 'Bearer testfixturekey0001' } } },
      autoUpdate: true,
      padding: 'x'.repeat(700),
    });
    fs.writeFileSync(fakeClaudeJson, payload);
    const before = crypto.createHash('sha256').update(fs.readFileSync(fakeClaudeJson)).digest('hex');
    const entry = legacyEntryFixture();
    const plan = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0001' });
    m.executePlan({ plan, homeDir: h, dryRun: false, isoTs: '2026-05-19T20:30:00Z', mockRemove: () => {} });
    const after = crypto.createHash('sha256').update(fs.readFileSync(fakeClaudeJson)).digest('hex');
    assert.equal(before, after, 'SG-1 VIOLATION: ~/.claude.json modified during executePlan');
  } finally { rmHome(h); }
});

// ---- T8 refuse path no-op ----
t('T8 executePlan with action=refuse writes stderr warning, no removeFn, no snapshot, no log', () => {
  const h = mkHome();
  try {
    const entry = legacyEntryFixture();
    const plan = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0002' });
    assert.equal(plan.action, 'refuse');
    let removeCalled = false;
    const result = m.executePlan({ plan, homeDir: h, dryRun: false, mockRemove: () => { removeCalled = true; } });
    assert.equal(removeCalled, false);
    assert.equal(result.executed, false);
    assert.equal(result.action, 'refused');
    const snapDir = path.join(h, '.mindrian', 'pre-migration-snapshots');
    assert.equal(fs.existsSync(snapDir) && fs.readdirSync(snapDir).length > 0, false);
    const log = path.join(h, '.mindrian', 'migrations.jsonl');
    assert.equal(fs.existsSync(log), false);
  } finally { rmHome(h); }
});

// ---- T9 log structure ----
t('T9 migrations.jsonl has exactly one removed record with fingerprint/source/action/ts (SG-4)', () => {
  const h = mkHome();
  try {
    const entry = legacyEntryFixture();
    const plan = m.planMigration({ homeDir: h, mockClaude: () => entry, mockBrainKey: 'testfixturekey0001' });
    m.executePlan({ plan, homeDir: h, dryRun: false, isoTs: '2026-05-19T20:30:00Z', mockRemove: () => {} });
    const logPath = path.join(h, '.mindrian', 'migrations.jsonl');
    const text = fs.readFileSync(logPath, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    assert.equal(lines.length, 1);
    const rec = JSON.parse(lines[0]);
    assert.equal(rec.action, 'removed');
    assert.equal(rec.source, 'mindrian-brain');
    assert.match(rec.fingerprint, /^[a-f0-9]{16}$/);
    assert.ok(rec.ts);
    // SG-4 scrub: no Bearer / UUID
    assert.equal(/Bearer\s+/.test(text), false);
    assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text), false);
  } finally { rmHome(h); }
});

// ---- T10 CLI --dry-run ----
t('T10 CLI --dry-run exits 0 and prints "dry-run" without spawning claude', () => {
  // Spawn the script with the fixture's HOME and a stale-fail claude that we DO not need
  // to override (no legacy entry -> action=none -> dry-run prints "would none").
  const h = mkHome();
  try {
    // Override PATH so an accidental `claude` call would fail visibly (but the script's
    // execFileSync catches non-zero exit and treats it as no-entry, so this is safe).
    const env = Object.assign({}, process.env, {
      HOME: h,
      PATH: '/usr/bin:/bin', // claude binary is intentionally NOT on PATH for hermetic test
    });
    const out = execFileSync(process.execPath, [SCRIPT, '--dry-run'], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(out, /dry-run/);
  } finally { rmHome(h); }
});

// ---- T11 CLI --help ----
t('T11 CLI --help prints usage and exits 0', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(out, /Usage:/);
});

console.log('');
console.log('==== RESULTS ====');
console.log('PASS: ' + pass);
console.log('FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
