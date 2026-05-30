/**
 * MindrianOS Plugin -- De Bono Hat Persistence
 * Manages persistent hat state across sessions for each room.
 *
 * Phase 130-03 RETIREMENT: the canonical hat state (focus, concerns,
 * opportunities, session_count) now lives as a typed HatState node in room.db,
 * read/written through lib/core/navigation.cjs (the Plan 01 lens-nodes
 * chokepoint). The legacy .mindrian/hats/{color}/STATE.md filesystem writes are
 * RETIRED -- this module no longer writes STATE.md (paying down the baselined
 * Canon Part 9 filesystem-state violation the Cluster 2 audit flagged).
 *
 * This module is NOT in the substrate-guard allow-list, so it may NOT require
 * lib/core/room-db.cjs and may NOT require node:sqlite. It takes a roomDir and
 * routes every room.db touch through navigation.cjs roomDir-taking wrappers
 * (writeHatStateByRoomDir / readHatStateByRoomDir / readAllHatStatesByRoomDir),
 * which open room.db internally inside the allow-listed navigation surface.
 *
 * Storage layout (going-forward):
 *   room/.mindrian/room.db                                  - HatState nodes (canonical state)
 *   room/.mindrian/hats/{color}/session-log/YYYY-MM-DD.md   - Daily session findings (read-only archive)
 *
 * The legacy STATE.md files are LEFT IN PLACE as a read-only archive; the
 * one-shot scripts/migrate-hats-to-roomdb.cjs backfills them into HatState nodes.
 *
 * Exports: HAT_COLORS, HAT_LABELS, loadHatState, saveHatState, logSession,
 *          loadAllHatStates, getRecentLogs (the 7-function contract callers
 *          depend on -- signatures preserved).
 *
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision); room.db
 * access via navigation.cjs only.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const navigation = require('./navigation.cjs');

const HAT_COLORS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];

const HAT_LABELS = {
  white: 'Facts & Data',
  red: 'Emotions & Intuition',
  black: 'Risks & Dangers',
  yellow: 'Benefits & Opportunities',
  green: 'Creativity & Alternatives',
  blue: 'Process & Meta',
};

// ---------------------------------------------------------------------------
// Directory helpers (session-log archive only -- STATE.md is RETIRED)
// ---------------------------------------------------------------------------

/**
 * Get the hat directory for a given color within a room.
 * Used only for the session-log markdown archive (the daily logs are NOT
 * migrated this phase per the 130-CONTEXT pre-resolved decision).
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} color - Hat color (white|red|black|yellow|green|blue)
 * @returns {string}
 */
function hatDir(roomDir, color) {
  return path.join(path.resolve(roomDir), '.mindrian', 'hats', color);
}

/**
 * Ensure the session-log directory exists for a given color (archive path only).
 * @param {string} roomDir
 * @param {string} color
 */
function ensureSessionLogDir(roomDir, color) {
  fs.mkdirSync(path.join(hatDir(roomDir, color), 'session-log'), { recursive: true });
}

// ---------------------------------------------------------------------------
// Core API (room.db-backed via navigation.cjs)
// ---------------------------------------------------------------------------

/**
 * Load the persistent state for a given hat color from the room.db HatState node.
 * Returns default state if no node exists yet (or room.db is absent).
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} color - Hat color
 * @returns {{ current_focus: string, last_analysis: string, top_concerns: string[], top_opportunities: string[], methodology_notes: string[], session_count: number } | { error: string }}
 */
function loadHatState(roomDir, color) {
  if (!HAT_COLORS.includes(color)) {
    return { error: `Invalid hat color: ${color}. Must be one of: ${HAT_COLORS.join(', ')}` };
  }
  // navigation.readHatStateByRoomDir returns the canonical default shape when the
  // node is absent or room.db does not exist, so callers always get a structured
  // object (preserving the legacy loadHatState absent-state contract).
  return navigation.readHatStateByRoomDir(path.resolve(roomDir), color);
}

/**
 * Save hat state to the room.db HatState node via navigation.cjs.
 * Merges with existing state to preserve fields not in this update.
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} color - Hat color
 * @param {object} state - State to persist
 * @returns {{ saved: boolean, node_id?: string } | { error: string }}
 */
function saveHatState(roomDir, color, state) {
  if (!HAT_COLORS.includes(color)) {
    return { error: `Invalid hat color: ${color}` };
  }
  const resolved = path.resolve(roomDir);

  // Merge with existing state to preserve fields not in this update.
  const existing = loadHatState(resolved, color);
  const base = existing && !existing.error ? existing : {};
  const merged = {
    current_focus: state.current_focus || base.current_focus,
    last_analysis: state.last_analysis || new Date().toISOString().split('T')[0],
    top_concerns: state.top_concerns || base.top_concerns,
    top_opportunities: state.top_opportunities || base.top_opportunities,
    methodology_notes: state.methodology_notes || base.methodology_notes,
    session_count: (state.session_count !== undefined) ? state.session_count : base.session_count,
  };

  const result = navigation.writeHatStateByRoomDir(resolved, color, merged);
  if (!result || result.ok !== true) {
    return { saved: false, reason: (result && result.reason) || 'hatstate_write_failed' };
  }
  return { saved: true, node_id: result.node_id };
}

/**
 * Log a session's findings for a hat color.
 * The canonical session_count + concerns/opportunities state lands in the
 * room.db HatState node (via saveHatState); the daily markdown log is appended
 * to the session-log archive (the daily logs are NOT migrated this phase).
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} color - Hat color
 * @param {{ focus: string, findings: string[], concerns: string[], opportunities: string[], artifact?: string }} findings
 * @returns {{ logged: boolean, path: string } | { error: string }}
 */
function logSession(roomDir, color, findings) {
  if (!HAT_COLORS.includes(color)) {
    return { error: `Invalid hat color: ${color}` };
  }
  const resolved = path.resolve(roomDir);

  ensureSessionLogDir(resolved, color);

  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].replace(/\.\d+Z/, 'Z');
  const logPath = path.join(hatDir(resolved, color), 'session-log', `${today}.md`);

  const label = HAT_LABELS[color] || color;
  const entry = [
    '',
    `## Session at ${time}`,
    '',
    `**Focus:** ${findings.focus || 'General analysis'}`,
    findings.artifact ? `**Artifact:** ${findings.artifact}` : '',
    '',
    '### Findings',
    ...(findings.findings || []).map(f => `- ${f}`),
    '',
    '### Concerns',
    ...(findings.concerns || []).map(c => `- ${c}`),
    '',
    '### Opportunities',
    ...(findings.opportunities || []).map(o => `- ${o}`),
    '',
    '---',
  ].filter(l => l !== undefined).join('\n');

  // Append to the daily markdown archive (read-only archive going forward).
  let content;
  try {
    content = fs.readFileSync(logPath, 'utf-8');
    content += '\n' + entry;
  } catch (e) {
    content = `# ${color.charAt(0).toUpperCase() + color.slice(1)} Hat -- ${label} Session Log (${today})\n` + entry;
  }
  fs.writeFileSync(logPath, content, 'utf-8');

  // Update the canonical state in the room.db HatState node.
  const loaded = loadHatState(resolved, color);
  const state = loaded && !loaded.error ? loaded : {
    current_focus: 'General analysis',
    last_analysis: 'never',
    top_concerns: [],
    top_opportunities: [],
    methodology_notes: [],
    session_count: 0,
  };
  state.session_count = (state.session_count || 0) + 1;
  state.last_analysis = today;

  // Merge new concerns/opportunities into state (keep last 5 each).
  if (findings.concerns && findings.concerns.length > 0) {
    const merged = [...findings.concerns, ...(state.top_concerns || [])];
    state.top_concerns = [...new Set(merged)].slice(0, 5);
  }
  if (findings.opportunities && findings.opportunities.length > 0) {
    const merged = [...findings.opportunities, ...(state.top_opportunities || [])];
    state.top_opportunities = [...new Set(merged)].slice(0, 5);
  }
  if (findings.focus) {
    state.current_focus = findings.focus;
  }

  saveHatState(resolved, color, state);

  return { logged: true, path: logPath };
}

/**
 * Load all 6 hat states for a room from room.db. Returns map of color -> state.
 * @param {string} roomDir
 * @returns {Object<string, object>}
 */
function loadAllHatStates(roomDir) {
  // One open/close of room.db inside the navigation wrapper for all 6 colors.
  return navigation.readAllHatStatesByRoomDir(path.resolve(roomDir));
}

/**
 * Get recent session logs for a hat (last N days) from the markdown archive.
 * The session-log daily markdown is NOT migrated this phase (130-CONTEXT
 * pre-resolved decision -- only STATE.md becomes a HatState node), so this still
 * reads the read-only filesystem archive.
 * @param {string} roomDir
 * @param {string} color
 * @param {number} [days=7] - How many days back to look
 * @returns {Array<{ date: string, content: string }>}
 */
function getRecentLogs(roomDir, color, days = 7) {
  if (!HAT_COLORS.includes(color)) return [];

  const logDir = path.join(hatDir(roomDir, color), 'session-log');
  let files;
  try {
    files = fs.readdirSync(logDir).filter(f => f.endsWith('.md')).sort().reverse();
  } catch (e) {
    return [];
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const logs = [];
  for (const file of files) {
    const date = file.replace('.md', '');
    if (date < cutoffStr) break;
    try {
      const content = fs.readFileSync(path.join(logDir, file), 'utf-8');
      logs.push({ date, content });
    } catch (e) {
      // skip unreadable
    }
  }

  return logs;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  HAT_COLORS,
  HAT_LABELS,
  loadHatState,
  saveHatState,
  logSession,
  loadAllHatStates,
  getRecentLogs,
};
