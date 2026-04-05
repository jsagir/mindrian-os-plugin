/**
 * MindrianOS Plugin -- De Bono Hat Persistence
 * Manages persistent hat state across sessions for each room.
 *
 * Storage layout:
 *   room/.mindrian/hats/{color}/STATE.md     - Current hat state (focus, concerns, opportunities)
 *   room/.mindrian/hats/{color}/session-log/YYYY-MM-DD.md - Daily session findings
 *
 * Exports: loadHatState, saveHatState, logSession, loadAllHatStates, getRecentLogs
 *
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision).
 */

'use strict';

const fs = require('fs');
const path = require('path');

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
// Directory helpers
// ---------------------------------------------------------------------------

/**
 * Get the hat directory for a given color within a room.
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} color - Hat color (white|red|black|yellow|green|blue)
 * @returns {string}
 */
function hatDir(roomDir, color) {
  return path.join(path.resolve(roomDir), '.mindrian', 'hats', color);
}

/**
 * Ensure hat directories exist for a given color.
 * @param {string} roomDir
 * @param {string} color
 */
function ensureHatDirs(roomDir, color) {
  const dir = hatDir(roomDir, color);
  fs.mkdirSync(path.join(dir, 'session-log'), { recursive: true });
}

// ---------------------------------------------------------------------------
// STATE.md parsing / serialization
// ---------------------------------------------------------------------------

/**
 * Parse a hat STATE.md into structured data.
 * @param {string} content - Raw markdown content
 * @returns {{ current_focus: string, last_analysis: string, top_concerns: string[], top_opportunities: string[], methodology_notes: string[], session_count: number }}
 */
function parseHatState(content) {
  const state = {
    current_focus: '',
    last_analysis: '',
    top_concerns: [],
    top_opportunities: [],
    methodology_notes: [],
    session_count: 0,
  };

  if (!content || typeof content !== 'string') return state;

  // Parse frontmatter
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const lines = fmMatch[1].split('\n');
    for (const line of lines) {
      const kvMatch = line.match(/^([a-z_]+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const val = kvMatch[2].trim();
        if (key === 'current_focus') state.current_focus = val;
        if (key === 'last_analysis') state.last_analysis = val;
        if (key === 'session_count') state.session_count = parseInt(val, 10) || 0;
      }
      const listMatch = line.match(/^\s+-\s+(.+)$/);
      if (listMatch) {
        // Determine which list this belongs to based on preceding key
        // Simple heuristic: check what the last key was
      }
    }
  }

  // Parse sections from body
  const bodyStart = content.indexOf('---', content.indexOf('---') + 3);
  const body = bodyStart >= 0 ? content.slice(bodyStart + 3) : content;

  const concernsMatch = body.match(/## Top Concerns\n([\s\S]*?)(?=\n## |$)/);
  if (concernsMatch) {
    state.top_concerns = concernsMatch[1]
      .split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  }

  const oppsMatch = body.match(/## Top Opportunities\n([\s\S]*?)(?=\n## |$)/);
  if (oppsMatch) {
    state.top_opportunities = oppsMatch[1]
      .split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  }

  const methMatch = body.match(/## Methodology Notes\n([\s\S]*?)(?=\n## |$)/);
  if (methMatch) {
    state.methodology_notes = methMatch[1]
      .split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean);
  }

  return state;
}

/**
 * Serialize hat state to STATE.md markdown content.
 * @param {string} color
 * @param {object} state
 * @returns {string}
 */
function serializeHatState(color, state) {
  const label = HAT_LABELS[color] || color;
  const concerns = (state.top_concerns || []).map(c => `- ${c}`).join('\n') || '- None yet';
  const opps = (state.top_opportunities || []).map(o => `- ${o}`).join('\n') || '- None yet';
  const meth = (state.methodology_notes || []).map(m => `- ${m}`).join('\n') || '- None yet';

  return `---
hat: ${color}
hat_label: ${label}
current_focus: ${state.current_focus || 'General analysis'}
last_analysis: ${state.last_analysis || 'never'}
session_count: ${state.session_count || 0}
---

# ${color.charAt(0).toUpperCase() + color.slice(1)} Hat -- ${label}

## Top Concerns
${concerns}

## Top Opportunities
${opps}

## Methodology Notes
${meth}
`;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Load the persistent state for a given hat color.
 * Returns default state if no STATE.md exists yet.
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} color - Hat color
 * @returns {{ current_focus: string, last_analysis: string, top_concerns: string[], top_opportunities: string[], methodology_notes: string[], session_count: number }}
 */
function loadHatState(roomDir, color) {
  if (!HAT_COLORS.includes(color)) {
    return { error: `Invalid hat color: ${color}. Must be one of: ${HAT_COLORS.join(', ')}` };
  }

  const statePath = path.join(hatDir(roomDir, color), 'STATE.md');
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    return parseHatState(content);
  } catch (e) {
    // No state yet -- return defaults
    return {
      current_focus: 'General analysis',
      last_analysis: 'never',
      top_concerns: [],
      top_opportunities: [],
      methodology_notes: [],
      session_count: 0,
    };
  }
}

/**
 * Save hat state to disk. Creates directories if needed.
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} color - Hat color
 * @param {object} state - State to persist
 * @returns {{ saved: boolean, path: string }}
 */
function saveHatState(roomDir, color, state) {
  if (!HAT_COLORS.includes(color)) {
    return { error: `Invalid hat color: ${color}` };
  }

  ensureHatDirs(roomDir, color);
  const statePath = path.join(hatDir(roomDir, color), 'STATE.md');

  // Merge with existing state to preserve fields not in this update
  const existing = loadHatState(roomDir, color);
  const merged = {
    current_focus: state.current_focus || existing.current_focus,
    last_analysis: state.last_analysis || new Date().toISOString().split('T')[0],
    top_concerns: state.top_concerns || existing.top_concerns,
    top_opportunities: state.top_opportunities || existing.top_opportunities,
    methodology_notes: state.methodology_notes || existing.methodology_notes,
    session_count: (state.session_count !== undefined) ? state.session_count : existing.session_count,
  };

  const content = serializeHatState(color, merged);
  fs.writeFileSync(statePath, content, 'utf-8');

  return { saved: true, path: statePath };
}

/**
 * Log a session's findings for a hat color. Appends to the daily log file.
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} color - Hat color
 * @param {{ focus: string, findings: string[], concerns: string[], opportunities: string[], artifact?: string }} findings
 * @returns {{ logged: boolean, path: string }}
 */
function logSession(roomDir, color, findings) {
  if (!HAT_COLORS.includes(color)) {
    return { error: `Invalid hat color: ${color}` };
  }

  ensureHatDirs(roomDir, color);

  const today = new Date().toISOString().split('T')[0];
  const time = new Date().toISOString().split('T')[1].replace(/\.\d+Z/, 'Z');
  const logPath = path.join(hatDir(roomDir, color), 'session-log', `${today}.md`);

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

  // If file exists, append. Otherwise create with header.
  let content;
  try {
    content = fs.readFileSync(logPath, 'utf-8');
    content += '\n' + entry;
  } catch (e) {
    content = `# ${color.charAt(0).toUpperCase() + color.slice(1)} Hat -- ${label} Session Log (${today})\n` + entry;
  }

  fs.writeFileSync(logPath, content, 'utf-8');

  // Update session count in STATE.md
  const state = loadHatState(roomDir, color);
  state.session_count = (state.session_count || 0) + 1;
  state.last_analysis = today;

  // Merge new concerns/opportunities into state (keep last 5 each)
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

  saveHatState(roomDir, color, state);

  return { logged: true, path: logPath };
}

/**
 * Load all 6 hat states for a room. Returns map of color -> state.
 * @param {string} roomDir
 * @returns {Object<string, object>}
 */
function loadAllHatStates(roomDir) {
  const states = {};
  for (const color of HAT_COLORS) {
    states[color] = loadHatState(roomDir, color);
  }
  return states;
}

/**
 * Get recent session logs for a hat (last N days).
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
