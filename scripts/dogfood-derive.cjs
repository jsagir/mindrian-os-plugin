#!/usr/bin/env node
'use strict';
// Phase 260517-dcw Task 2: dog-food bridge -- derive phase.
//
// Reads last-N file_changed events from room.db via navigation.cjs::findRecentChanges,
// regenerates the sentinel-bounded ## Live (auto) block in ~/MindrianRooms/mindrian/STATE.md
// atomically (mirrors lib/core/feynman/timeline-runner.cjs::mergeSentinelSection +
// atomicWrite verbatim per Canon Part 7 reuse).
//
// Canon Part 9 D-03 invariant: ALL graph reads go through navigation.cjs (the only door).
// Canon Part 8 invariant: ZERO remote calls; ZERO network surface; LOCAL only.
// Canon Part 7: the sentinel + atomic-write mechanics are copied from Phase 124-02
//   timeline-runner.cjs with the constant names renamed (TIMELINE_AUTO_* -> LIVE_AUTO_*).
//   The feynman_timeline_refreshed memory_event type is REUSED here -- semantically this
//   IS the same refresh-the-auto-section action; inventing a parallel type would add
//   surface without integration benefit. See plan 260517-dcw Task 2 step 2c rationale.
//
// Modes:
//   node scripts/dogfood-derive.cjs            -- live regenerate
//   node scripts/dogfood-derive.cjs --dry-run  -- prints proposed block; writes nothing

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(PLUGIN_ROOT, 'lib/core/navigation.cjs'));

const ROOM_DIR = process.env.MINDRIAN_DOGFOOD_ROOM_DIR
  || path.join(os.homedir(), 'MindrianRooms', 'mindrian');
const ROOM_DB = path.join(ROOM_DIR, 'room.db');
const STATE_PATH = path.join(ROOM_DIR, 'STATE.md');
const PLUGIN_JSON = path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');

const SENTINEL_START = '<!-- LIVE_AUTO_START -->';
const SENTINEL_END = '<!-- LIVE_AUTO_END -->';
const HEADER = '## Live (auto)';

const DRY_RUN = process.argv.includes('--dry-run');

function softWarn(msg) { process.stderr.write('dogfood-derive: ' + msg + '\n'); }

function readPluginVersion() {
  try { return JSON.parse(fs.readFileSync(PLUGIN_JSON, 'utf8')).version || 'unknown'; }
  catch (_) { return 'unknown'; }
}

// ---- VERBATIM copy of lib/core/feynman/timeline-runner.cjs::mergeSentinelSection ----
//      (with the sentinel constants renamed; mechanics identical -- Canon Part 7 reuse).
function mergeSentinelSection(body, renderedBody) {
  const startIdx = body.indexOf(SENTINEL_START);
  const endIdx = body.indexOf(SENTINEL_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = body.slice(0, startIdx + SENTINEL_START.length);
    const after = body.slice(endIdx);
    return before + '\n' + renderedBody + '\n' + after;
  }
  const sep = body.endsWith('\n') ? '' : '\n';
  return body + sep + '\n' + HEADER + '\n\n' + SENTINEL_START + '\n' + renderedBody + '\n' + SENTINEL_END + '\n';
}

// ---- VERBATIM copy of lib/core/feynman/timeline-runner.cjs::atomicWrite ----
function atomicWrite(targetPath, content) {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);
  const tmp = path.join(dir, '.' + base + '.tmp.' + process.pid + '.' + Date.now());
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, content, 0, 'utf8');
    try { fs.fsyncSync(fd); } catch (_) { /* fsync best-effort */ }
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, targetPath);
}

function renderLiveBlock(db) {
  const nowIso = new Date().toISOString();
  const version = readPluginVersion();
  let events = [];
  try {
    // Last 10 file_changed events. findRecentChanges returns DESC by created_at.
    events = navigation.findRecentChanges(db, 0, { limit: 10, eventType: 'file_changed' }) || [];
  } catch (_) { events = []; }
  const lines = [];
  lines.push('**Last sync:** ' + nowIso + ' (' + events.length + ' events drained)');
  lines.push('**Plugin version:** ' + version);
  lines.push('');
  lines.push('**Recent activity (last 10 events):**');
  lines.push('');
  lines.push('| When | What | Where |');
  lines.push('|------|------|-------|');
  if (events.length === 0) {
    lines.push('| -- | (no events yet) | -- |');
  } else {
    for (const e of events) {
      const ts = (() => {
        try { return new Date(e.createdAt).toISOString().slice(11, 16); }
        catch (_) { return '--:--'; }
      })();
      const p = (e.properties && e.properties.path) || e.sourcePath || '(unknown)';
      lines.push('| ' + ts + ' | ' + e.eventType + ' | ' + p + ' |');
    }
  }
  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(ROOM_DIR) || !fs.existsSync(ROOM_DB)) {
    softWarn('target room not found at ' + ROOM_DIR + ' -- skipping');
    return 0;
  }
  if (!fs.existsSync(STATE_PATH)) {
    softWarn('STATE.md not found at ' + STATE_PATH + ' -- skipping');
    return 0;
  }
  let DatabaseSync;
  try { DatabaseSync = require('node:sqlite').DatabaseSync; }
  catch (_) { softWarn('node:sqlite unavailable -- skipping'); return 0; }
  let db;
  // Phase 276 C4: busy-timeout option, one line, see lib/core/room-db.cjs:242-251
  // for the full reasoning.
  try { db = new DatabaseSync(ROOM_DB, { timeout: 5000 }); }
  catch (_) { softWarn('could not open room.db'); return 0; }

  const rendered = renderLiveBlock(db);

  if (DRY_RUN) {
    process.stdout.write('--- DRY RUN: proposed ## Live (auto) block ---\n');
    process.stdout.write(rendered + '\n');
    try { db.close(); } catch (_) {}
    return 0;
  }

  const currentBody = fs.readFileSync(STATE_PATH, 'utf8');
  const newBody = mergeSentinelSection(currentBody, rendered);
  atomicWrite(STATE_PATH, newBody);

  // Reuse feynman_timeline_refreshed memory_event per Canon Part 7. Semantically this IS
  // the same refresh-the-auto-section action; a parallel type would add surface without
  // integration benefit. The sourcePath disambiguates the dog-food surface from the
  // FEYNMAN.md timeline surface for downstream filtering.
  try {
    navigation.logMemoryEvent(db, 'feynman_timeline_refreshed', {
      source_path: 'dogfood:STATE.md',
      created_by: 'system:dogfood-derive',
    });
  } catch (_) { /* logging failure does not corrupt the refresh; the write already landed */ }
  try { db.close(); } catch (_) {}

  process.stdout.write(JSON.stringify({
    written: STATE_PATH,
    events_rendered: 10,
  }) + '\n');
  return 0;
}

process.exit(main());
