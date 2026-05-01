#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-05 -- Memory completion detector (PostToolUse hook).
 *
 * Reads <roomDir>/.mindrian/last-cascade.json (Phase 95 side-channel 8-key payload).
 * Matches against jtbd-taxonomy.json completion_pattern (Phase 103-01).
 * On match, fires acrossSession.completeJtbd to write a completed entry + LOCAL graph edge.
 *
 * Pitfall 6 gates (RESEARCH §8):
 *   - Requires cascade.cascade_status === 'completed' (Phase 95 contract)
 *   - Requires within-session current.confidence >= 0.6
 *   - Manual `/mos:memory complete` is the user override for false negatives
 *
 * Three disjoint match signals (RESEARCH §4.2):
 *   1. artifact_glob   -- file path glob match (** / * / ?)
 *   2. cascade_edge    -- edge type added to the cascade classification
 *   3. state_md_key    -- STATE.md section that was written
 *
 * Graceful degradation: try/catch wraps body; never throws upward; never fails cascade.
 * CLI exits 0 always.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const CONFIDENCE_FLOOR = 0.6;

function detectAndFire(roomDir, roomSlug) {
  try {
    if (!roomDir || !fs.existsSync(roomDir)) return;

    // 1. Read cascade side-channel (Phase 95).
    const cascadePath = path.join(roomDir, '.mindrian', 'last-cascade.json');
    if (!fs.existsSync(cascadePath)) return;
    let cascade;
    try {
      cascade = JSON.parse(fs.readFileSync(cascadePath, 'utf8'));
    } catch (_) { return; }
    if (!cascade || typeof cascade !== 'object') return;

    // Pitfall 6 gate (a): cascade_status must be 'completed'.
    // Phase 95's bash writer sets cascade_status: "complete" (string literal);
    // accept "complete" or "completed" for forward compatibility.
    const statusOk = cascade.cascade_status === 'completed' || cascade.cascade_status === 'complete';
    if (!statusOk) return;

    // 2. Read within-session JTBD (Phase 100).
    let cur = null;
    try {
      const jtbdState = require('../lib/hmi/jtbd-state.cjs');
      cur = jtbdState.getCurrent(roomDir);
    } catch (_) { /* graceful */ }
    if (!cur || typeof cur.jtbd !== 'string' || cur.jtbd.length === 0 || cur.jtbd === 'explore') return;

    // Pitfall 6 gate (b): confidence >= CONFIDENCE_FLOOR.
    if (typeof cur.confidence === 'number' && cur.confidence < CONFIDENCE_FLOOR) return;

    // 3. Look up completion_pattern from taxonomy.
    const taxonomyPath = path.join(PLUGIN_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json');
    let tax;
    try {
      tax = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
    } catch (_) { return; }
    const entries = (tax && Array.isArray(tax.entries)) ? tax.entries : [];
    const entry = entries.find(e => e && e.id === cur.jtbd);
    if (!entry || !entry.completion_pattern) return;
    const pat = entry.completion_pattern;

    // 4. Match against cascade output. 3 disjoint signals; first match wins.
    let matched = null;

    // 4a. artifact_glob (e.g., "**/rs-thesis*.md", with | alternation).
    if (pat.artifact_glob && cascade.file_path) {
      const subs = String(pat.artifact_glob).split('|');
      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i].trim();
        if (sub && matchGlob(cascade.file_path, sub)) {
          matched = 'artifact_glob:' + sub;
          break;
        }
      }
    }

    // 4b. cascade_edge (e.g., "REVERSE_SALIENT", "INFORMS|CONVERGES",
    // "decision_edge:APPROVE|decision_edge:REJECT").
    if (!matched && pat.cascade_edge && cascade.classification &&
        Array.isArray(cascade.classification.edges_added)) {
      const subs = String(pat.cascade_edge).split('|');
      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i].trim();
        if (sub && cascade.classification.edges_added.indexOf(sub) !== -1) {
          matched = 'cascade_edge:' + sub;
          break;
        }
      }
    }

    // 4c. state_md_key (e.g., "Decisions", "MEETING-PREP", "Roadmap|Milestones").
    if (!matched && pat.state_md_key && cascade.classification &&
        typeof cascade.classification.state_md_section === 'string') {
      const subs = String(pat.state_md_key).split('|');
      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i].trim();
        if (sub && cascade.classification.state_md_section === sub) {
          matched = 'state_md_key:' + sub;
          break;
        }
      }
    }

    if (!matched) return;

    // 5. Fire completion event. acrossSession.completeJtbd writes:
    //   - JSON state in ~/MindrianRooms/.memory/jtbd-history.json
    //   - audit log line
    //   - graph-edge intent line for Canon Part 4 (drained later)
    const acrossSession = require('../lib/hmi/across-session-memory.cjs');
    acrossSession.completeJtbd(roomSlug, cur.jtbd, matched, cascade.file_path || '');
  } catch (err) {
    // Final defensive net. NEVER throw upward.
    try { process.stderr.write('[memory-completion-detector] error: ' +
      String(err && err.message ? err.message : err).slice(0, 200) + '\n'); }
    catch (_) { /* swallow logger error */ }
  }
}

// matchGlob -- hand-rolled, zero-dep glob -> regex.
//   ** matches any characters including /
//   *  matches anything except /
//   ?  matches a single non-/ character
// Other regex specials are escaped.
function matchGlob(filePath, glob) {
  if (!glob || typeof glob !== 'string' || typeof filePath !== 'string') return false;
  const re = '^' + glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLESTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLESTAR__/g, '.*')
    .replace(/\?/g, '[^/]') + '$';
  try { return new RegExp(re).test(filePath); }
  catch (_) { return false; }
}

// resolveRoomSlug -- maps roomDir to a room slug via the registry.
// Falls back to basename(roomDir) if registry is missing/unreadable.
function resolveRoomSlug(roomDir) {
  try {
    const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return path.basename(roomDir);
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    const rooms = (reg && Array.isArray(reg.rooms)) ? reg.rooms : [];
    const target = path.resolve(roomDir);
    const entry = rooms.find(x => {
      if (!x) return false;
      // Two registry conventions:
      //   - across-session-memory: rooms[].path (relative or absolute)
      //   - jtbd-update: rooms[].abs_path (absolute)
      const candidate = (typeof x.abs_path === 'string' && x.abs_path) ||
                        (typeof x.path === 'string' && x.path) || null;
      if (!candidate) return false;
      const rd = path.isAbsolute(candidate) ? candidate : path.join(home, candidate);
      try { return path.resolve(rd) === target; } catch (_) { return false; }
    });
    return (entry && entry.slug) ? entry.slug : path.basename(roomDir);
  } catch (_) { return path.basename(roomDir || ''); }
}

module.exports = { detectAndFire: detectAndFire, resolveRoomSlug: resolveRoomSlug, matchGlob: matchGlob };

// CLI entry -- reads room from env (Claude Code hook contract).
if (require.main === module) {
  try {
    const roomDir = process.env.CLAUDE_ROOM_DIR ||
                    process.env.CLAUDE_ACTIVE_ROOM ||
                    process.cwd();
    const roomSlug = resolveRoomSlug(roomDir);
    detectAndFire(roomDir, roomSlug);
  } catch (err) {
    try { process.stderr.write('[memory-completion-detector] CLI error: ' +
      String(err && err.message ? err.message : err).slice(0, 200) + '\n'); }
    catch (_) { /* swallow */ }
  }
  // Always exit 0 -- never fail the cascade.
  process.exit(0);
}
