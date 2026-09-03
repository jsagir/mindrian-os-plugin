/**
 * MindrianOS Plugin - User Archetype Detection (CTX-01)
 * Detects venturist/researcher/student from USER.md, venture stage, and command patterns.
 * Pure Node.js built-ins only. No npm dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { safeReadFile } = require('./index.cjs');

/**
 * Known archetypes with their detection signals.
 */
const ARCHETYPES = {
  student: {
    userMdSignals: [
      /student/i, /learner/i, /course/i, /class/i, /homework/i,
      /assignment/i, /semester/i, /university/i, /college/i,
      /undergrad/i, /graduate\s+student/i, /mba\s+student/i
    ],
    stages: ['Pre-Opportunity', 'Discovery'],
    weight: 0
  },
  researcher: {
    userMdSignals: [
      /researcher/i, /academic/i, /professor/i, /faculty/i,
      /phd/i, /postdoc/i, /lab\b/i, /publication/i,
      /peer.review/i, /grant\s+writing/i, /dissertation/i,
      /principal\s+investigator/i, /research\s+group/i
    ],
    stages: ['Discovery', 'Validation'],
    weight: 0
  },
  venturist: {
    userMdSignals: [
      /founder/i, /ceo/i, /cto/i, /entrepreneur/i,
      /startup/i, /venture/i, /investor/i, /fundrais/i,
      /pitch/i, /deck/i, /revenue/i, /market\s+fit/i,
      /business\s+model/i, /scale/i, /series\s+[a-d]/i,
      /seed\s+round/i, /angel/i, /vc\b/i, /accelerator/i
    ],
    stages: ['Validation', 'Design', 'Investment'],
    weight: 0
  }
};

// Phase 267.2 W2 (research finding C-3, reproduced empirically). writeUserMdAtomic
// (lib/core/user-md-ops.cjs) unconditionally emits all seven role_blend axis names
// -- researcher: 0, investor: 0, mentor: 0, student: 0, etc. -- on every write. Before
// this fix, the scan below read the RAW WHOLE FILE, so those always-present zero-valued
// axis NAMES matched the /student/i, /researcher/i, /founder/i, /investor/i signals below
// on every single write, regardless of the actual user: student/researcher/venturist each
// scored +2, the 2/2/2 tie broke to whichever archetype ARCHETYPES declares first
// (student), and a founder who wrote canonical_role: founder read back as a student.
//
// Fix (decision D-G, option (b), the reader-side fix): scope the scan to two sources
// only -- canonical_role's VALUE (not the whole "canonical_role: founder" line, so the
// key name itself cannot match a signal regex) and the prose BODY below the frontmatter
// delimiter. The role_blend block is never scanned. This lives at the reader rather than
// the writer because every OTHER caller of writeUserMdAtomic (lib/core/navigation/
// room-birth.cjs, lib/mcp/tools/identity.cjs) produces the identical frontmatter shape,
// so a writer-side workaround would leave all of them still reading back wrong.
//
// A file with no frontmatter delimiter (old-shape USER.md, or a room file authored by
// hand) is scanned whole exactly as before -- this fix cannot regress an existing room.
function _archetypeScanText(raw) {
  const fmRe = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const m = raw.match(fmRe);
  if (!m) {
    // No frontmatter delimiter found: preserve the pre-fix behaviour exactly.
    return raw;
  }
  const frontmatter = m[1];
  const body = m[2];
  let roleValue = '';
  const roleMatch = frontmatter.match(/^canonical_role:\s*(.*)$/m);
  if (roleMatch) {
    roleValue = roleMatch[1].trim();
    // Strip surrounding quotes per the narrow-dialect YAML scalar convention
    // lib/core/user-md-ops.cjs's own parser/emitter already uses.
    if (roleValue.length >= 2
        && ((roleValue[0] === '"' && roleValue[roleValue.length - 1] === '"')
          || (roleValue[0] === "'" && roleValue[roleValue.length - 1] === "'"))) {
      roleValue = roleValue.slice(1, -1);
    }
    if (roleValue === 'null' || roleValue === '~') roleValue = '';
  }
  return roleValue + '\n' + body;
}

/**
 * Detect user archetype from room directory signals.
 * Uses 3 signal sources: USER.md content, venture stage, and command/usage patterns.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ archetype: string, confidence: string, signals: string[] }}
 */
function detectArchetype(roomDir) {
  const resolved = path.resolve(roomDir);
  const signals = [];
  const scores = { student: 0, researcher: 0, venturist: 0 };

  // --- Signal 1: USER.md content ---
  const userMdRaw = safeReadFile(path.join(resolved, 'USER.md'))
    || safeReadFile(path.join(resolved, '..', 'USER.md'))
    || safeReadFile(path.join(require('os').homedir(), '.mindrian-user.md'))
    || '';
  const userMd = userMdRaw ? _archetypeScanText(userMdRaw) : '';

  if (userMd) {
    for (const [archetype, config] of Object.entries(ARCHETYPES)) {
      for (const regex of config.userMdSignals) {
        if (regex.test(userMd)) {
          scores[archetype] += 2;
          signals.push(`USER.md:${archetype}:${regex.source}`);
          break; // one match per archetype from USER.md is enough for signal
        }
      }
    }
  }

  // --- Signal 2: Venture stage from STATE.md ---
  const stateMd = safeReadFile(path.join(resolved, 'STATE.md')) || '';
  const stageMatch = stateMd.match(/(?:Venture\s+)?Stage:\s*(.+)/i);
  const stage = stageMatch ? stageMatch[1].trim() : null;

  if (stage) {
    for (const [archetype, config] of Object.entries(ARCHETYPES)) {
      if (config.stages.includes(stage)) {
        scores[archetype] += 1;
        signals.push(`stage:${archetype}:${stage}`);
      }
    }
    // Late-stage ventures strongly suggest venturist
    if (['Design', 'Investment'].includes(stage)) {
      scores.venturist += 2;
      signals.push('stage:venturist:late-stage-boost');
    }
  }

  // --- Signal 3: Room structure patterns ---
  // Many sections filled = venturist; few sections = student/researcher
  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const sectionCount = entries.filter(e =>
      e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_')
    ).length;

    if (sectionCount >= 6) {
      scores.venturist += 1;
      signals.push(`structure:venturist:${sectionCount}-sections`);
    } else if (sectionCount <= 2) {
      scores.student += 1;
      signals.push(`structure:student:${sectionCount}-sections`);
    }
  } catch (_) {
    // Room dir might not exist yet
  }

  // --- Signal 4: Presence of research-specific artifacts ---
  const hasResearchDir = fs.existsSync(path.join(resolved, 'research'))
    || fs.existsSync(path.join(resolved, 'literature-review'));
  if (hasResearchDir) {
    scores.researcher += 2;
    signals.push('structure:researcher:research-dir');
  }

  // --- Signal 5: Analytics / command history ---
  const analyticsPath = path.join(resolved, '.context', 'analytics.json');
  const analyticsRaw = safeReadFile(analyticsPath);
  if (analyticsRaw) {
    try {
      const analytics = JSON.parse(analyticsRaw);
      const cmds = analytics.commands || {};
      // Heavy pipeline/methodology usage = venturist
      const methodCmds = (cmds['mos:act'] || 0) + (cmds['mos:pipeline'] || 0) + (cmds['mos:swarm'] || 0);
      const learnCmds = (cmds['mos:help'] || 0) + (cmds['mos:onboard'] || 0) + (cmds['mos:diagnose'] || 0);
      const researchCmds = (cmds['mos:research'] || 0) + (cmds['mos:brain'] || 0) + (cmds['mos:query'] || 0);

      if (methodCmds > 5) {
        scores.venturist += 2;
        signals.push(`commands:venturist:${methodCmds}-method-cmds`);
      }
      if (learnCmds > methodCmds && learnCmds > researchCmds) {
        scores.student += 1;
        signals.push(`commands:student:${learnCmds}-learn-cmds`);
      }
      if (researchCmds > 3) {
        scores.researcher += 1;
        signals.push(`commands:researcher:${researchCmds}-research-cmds`);
      }
    } catch (_) {
      // Parse error -- skip command signals
    }
  }

  // --- Determine winner ---
  let maxScore = 0;
  let archetype = 'default'; // fallback if no signals

  for (const [name, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      archetype = name;
    }
  }

  // Confidence based on score margin
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const margin = sortedScores[0] - (sortedScores[1] || 0);
  let confidence = 'low';
  if (margin >= 3) confidence = 'high';
  else if (margin >= 1) confidence = 'medium';

  return { archetype, confidence, signals };
}

/**
 * Get the session count for a room.
 * Reads from .context/analytics.json or falls back to estimating from last-session.md.
 * @param {string} roomDir - Path to room directory
 * @returns {number}
 */
function getSessionCount(roomDir) {
  const resolved = path.resolve(roomDir);

  // Try analytics
  const analyticsRaw = safeReadFile(path.join(resolved, '.context', 'analytics.json'));
  if (analyticsRaw) {
    try {
      const analytics = JSON.parse(analyticsRaw);
      return analytics.session_count || 0;
    } catch (_) {}
  }

  // Fallback: check if last-session.md exists (means at least 1 prior session)
  if (fs.existsSync(path.join(resolved, '.context', 'last-session.md'))) {
    return 1;
  }

  return 0;
}

/**
 * Get the room's primary domain from STATE.md or USER.md.
 * Used for returning-user greetings.
 * @param {string} roomDir - Path to room directory
 * @returns {string|null}
 */
function getRoomDomain(roomDir) {
  const resolved = path.resolve(roomDir);

  // Try STATE.md venture name or domain
  const stateMd = safeReadFile(path.join(resolved, 'STATE.md')) || '';
  const ventureMatch = stateMd.match(/(?:Venture|Project|Room)(?:\s+Name)?:\s*(.+)/i);
  if (ventureMatch) return ventureMatch[1].trim();

  // Try ROOM.md
  const roomMd = safeReadFile(path.join(resolved, 'ROOM.md')) || '';
  const titleMatch = roomMd.match(/^#\s+(.+)/m);
  if (titleMatch) return titleMatch[1].trim();

  return null;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const roomDir = args[0];

  if (!roomDir) {
    process.stderr.write('Usage: node user-archetype.cjs <room-dir>\n');
    process.exit(1);
  }

  const result = detectArchetype(roomDir);
  result.sessionCount = getSessionCount(roomDir);
  result.domain = getRoomDomain(roomDir);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

module.exports = { detectArchetype, getSessionCount, getRoomDomain, ARCHETYPES };
