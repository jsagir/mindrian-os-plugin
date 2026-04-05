'use strict';

/**
 * session-state.cjs -- Structured last-session.md writer
 *
 * Writes a structured last-session.md to room/.mindrian/ with fields
 * consumable by future KAIROS daily logs. Called from on-stop hook.
 *
 * Requirement: READY-01
 */

const fs = require('fs');
const path = require('path');

/**
 * Write structured session state to last-session.md
 *
 * @param {string} roomPath - Absolute path to room/ directory
 * @param {object} state - Session state fields
 * @param {string} [state.active_methodology] - Currently active methodology (e.g., "bono-six-hats", "minto-pyramid")
 * @param {string[]} [state.open_questions] - Unresolved questions from this session
 * @param {string} [state.next_suggested_action] - What Larry recommends doing next
 * @param {number} [state.confidence_level] - 0-100 confidence in current room completeness
 * @param {string[]} [state.artifacts_created] - List of artifacts filed this session
 * @param {number} [state.session_duration] - Session duration in seconds
 */
function writeSessionState(roomPath, state = {}) {
  if (!roomPath || !fs.existsSync(roomPath)) {
    return { success: false, error: 'Room path does not exist' };
  }

  const mindrianDir = path.join(roomPath, '.mindrian');
  if (!fs.existsSync(mindrianDir)) {
    fs.mkdirSync(mindrianDir, { recursive: true });
  }

  const now = new Date().toISOString();
  const {
    active_methodology = 'none',
    open_questions = [],
    next_suggested_action = 'Review room state and continue where you left off',
    confidence_level = 50,
    artifacts_created = [],
    session_duration = 0,
  } = state;

  // Format duration as human-readable
  const mins = Math.floor(session_duration / 60);
  const secs = session_duration % 60;
  const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const content = `---
last_updated: "${now}"
active_methodology: "${active_methodology}"
confidence_level: ${confidence_level}
session_duration_seconds: ${session_duration}
artifacts_count: ${artifacts_created.length}
---

# Last Session State

**Ended:** ${now}
**Duration:** ${durationStr}
**Active Methodology:** ${active_methodology}
**Confidence Level:** ${confidence_level}/100

## Open Questions

${open_questions.length > 0
    ? open_questions.map(q => `- ${q}`).join('\n')
    : '- No open questions from this session'}

## Next Suggested Action

${next_suggested_action}

## Artifacts Created

${artifacts_created.length > 0
    ? artifacts_created.map(a => `- ${a}`).join('\n')
    : '- No artifacts created this session'}
`;

  const filePath = path.join(mindrianDir, 'last-session.md');
  fs.writeFileSync(filePath, content, 'utf8');

  return { success: true, path: filePath, timestamp: now };
}

/**
 * Read last session state from last-session.md
 *
 * @param {string} roomPath - Absolute path to room/ directory
 * @returns {object|null} Parsed session state or null if not found
 */
function readSessionState(roomPath) {
  if (!roomPath) return null;

  const filePath = path.join(roomPath, '.mindrian', 'last-session.md');
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const fm = frontmatterMatch[1];
    const state = {};

    const extract = (key) => {
      const m = fm.match(new RegExp(`${key}:\\s*"?([^"\\n]*)"?`));
      return m ? m[1].trim() : null;
    };

    state.last_updated = extract('last_updated');
    state.active_methodology = extract('active_methodology');
    state.confidence_level = parseInt(extract('confidence_level') || '50', 10);
    state.session_duration_seconds = parseInt(extract('session_duration_seconds') || '0', 10);
    state.artifacts_count = parseInt(extract('artifacts_count') || '0', 10);

    // Extract open questions from body
    const questionsMatch = raw.match(/## Open Questions\n\n([\s\S]*?)(?=\n## )/);
    if (questionsMatch) {
      state.open_questions = questionsMatch[1]
        .split('\n')
        .filter(l => l.startsWith('- ') && !l.includes('No open questions'))
        .map(l => l.replace(/^- /, ''));
    } else {
      state.open_questions = [];
    }

    // Extract next suggested action
    const actionMatch = raw.match(/## Next Suggested Action\n\n([\s\S]*?)(?=\n## )/);
    if (actionMatch) {
      state.next_suggested_action = actionMatch[1].trim();
    }

    return state;
  } catch (e) {
    return null;
  }
}

module.exports = { writeSessionState, readSessionState };
