/**
 * MindrianOS Plugin -- Proactive Intelligence Persistence
 * Parses analyze-room output, persists insights with repeat suppression,
 * and tracks cross-room relationships.
 *
 * Exports: persistIntelligence, loadIntelligence, shouldSuppress, addCrossRoomRelationship
 */

'use strict';

const fs = require('fs');
const path = require('path');

const INTELLIGENCE_FILE = '.proactive-intelligence.json';
const SUPPRESS_THRESHOLD = 3;

/**
 * Load existing intelligence from room directory.
 * @param {string} roomDir - Absolute path to room directory
 * @returns {{ insights: Array, cross_room: Array, updated: string }}
 */
function loadIntelligence(roomDir) {
  const filePath = path.join(roomDir, INTELLIGENCE_FILE);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      return {
        insights: Array.isArray(data.insights) ? data.insights : [],
        cross_room: Array.isArray(data.cross_room) ? data.cross_room : [],
        updated: data.updated || ''
      };
    }
  } catch (_) {
    // Corrupted file -- start fresh
  }
  return { insights: [], cross_room: [], updated: '' };
}

/**
 * Parse analyze-room stdout into structured insight objects.
 * Handles: GAP:STRUCTURAL, GAP:SEMANTIC, GAP:ADJACENT, CONVERGE, CONTRADICT lines.
 * @param {string} analyzeOutput - Raw stdout from analyze-room script
 * @returns {Array<{ type: string, section?: string, term?: string, message: string, confidence: string }>}
 */
function parseAnalyzeOutput(analyzeOutput) {
  if (!analyzeOutput || typeof analyzeOutput !== 'string') return [];

  const insights = [];
  const lines = analyzeOutput.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // GAP:STRUCTURAL:{section}:{confidence}:{message}
    // GAP:SEMANTIC:{section}:{confidence}:{message}
    // GAP:ADJACENT:{section}:{confidence}:{message}
    const gapMatch = trimmed.match(/^GAP:(STRUCTURAL|SEMANTIC|ADJACENT):([^:]+):([^:]+):(.+)$/);
    if (gapMatch) {
      insights.push({
        type: 'gap',
        subtype: gapMatch[1].toLowerCase(),
        section: gapMatch[2],
        confidence: gapMatch[3],
        message: gapMatch[4]
      });
      continue;
    }

    // CONVERGE:{term}:{count}:{confidence}:{message}
    const convergeMatch = trimmed.match(/^CONVERGE:([^:]+):(\d+):([^:]+):(.+)$/);
    if (convergeMatch) {
      insights.push({
        type: 'convergence',
        term: convergeMatch[1],
        count: parseInt(convergeMatch[2], 10),
        confidence: convergeMatch[3],
        message: convergeMatch[4]
      });
      continue;
    }

    // CONTRADICT:{section1}:{section2}:{confidence}:{message}
    const contradictMatch = trimmed.match(/^CONTRADICT:([^:]+):([^:]+):([^:]+):(.+)$/);
    if (contradictMatch) {
      insights.push({
        type: 'contradiction',
        section: contradictMatch[1],
        section2: contradictMatch[2],
        confidence: contradictMatch[3],
        message: contradictMatch[4]
      });
      continue;
    }
  }

  return insights;
}

/**
 * Match key for deduplication: type + section (for gaps/contradictions) or type + term (for convergence).
 * @param {{ type: string, section?: string, term?: string, section2?: string }} insight
 * @returns {string}
 */
function insightKey(insight) {
  if (insight.type === 'convergence') {
    return `convergence:${insight.term || ''}`;
  }
  if (insight.type === 'contradiction') {
    return `contradiction:${insight.section || ''}:${insight.section2 || ''}`;
  }
  return `gap:${insight.subtype || ''}:${insight.section || ''}`;
}

/**
 * Persist intelligence from analyze-room output with repeat suppression.
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} analyzeOutput - Raw stdout from analyze-room script
 * @returns {{ persisted: number, new: number, suppressed: number }}
 */
function persistIntelligence(roomDir, analyzeOutput) {
  const parsed = parseAnalyzeOutput(analyzeOutput);
  if (parsed.length === 0) {
    return { persisted: 0, new: 0, suppressed: 0 };
  }

  const data = loadIntelligence(roomDir);
  const now = new Date().toISOString();

  // Build lookup by key
  const existingMap = new Map();
  for (let i = 0; i < data.insights.length; i++) {
    existingMap.set(insightKey(data.insights[i]), i);
  }

  let newCount = 0;
  let suppressed = 0;

  for (const insight of parsed) {
    const key = insightKey(insight);
    const existingIdx = existingMap.get(key);

    if (existingIdx !== undefined) {
      // Existing insight -- increment times_shown, update last_seen
      data.insights[existingIdx].times_shown = (data.insights[existingIdx].times_shown || 0) + 1;
      data.insights[existingIdx].last_seen = now;
      if (data.insights[existingIdx].times_shown >= SUPPRESS_THRESHOLD) {
        suppressed++;
      }
    } else {
      // New insight
      const entry = {
        ...insight,
        first_seen: now,
        last_seen: now,
        times_shown: 0
      };
      data.insights.push(entry);
      existingMap.set(key, data.insights.length - 1);
      newCount++;
    }
  }

  data.updated = now;

  // Write atomically
  const filePath = path.join(roomDir, INTELLIGENCE_FILE);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);

  return { persisted: parsed.length, new: newCount, suppressed };
}

/**
 * Check if an insight should be suppressed (shown 3+ times).
 * @param {{ times_shown: number }} insight
 * @returns {boolean}
 */
function shouldSuppress(insight) {
  return (insight && typeof insight.times_shown === 'number' && insight.times_shown >= SUPPRESS_THRESHOLD);
}

/**
 * Add or update a cross-room relationship.
 * @param {string} roomDir - Absolute path to room directory
 * @param {string} sourceRoom - Source room name/path
 * @param {string} targetRoom - Target room name/path
 * @param {string[]} sharedConcepts - Array of shared concept strings
 */
function addCrossRoomRelationship(roomDir, sourceRoom, targetRoom, sharedConcepts) {
  const data = loadIntelligence(roomDir);
  const now = new Date().toISOString();

  // Find existing relationship (same source + target)
  const existing = data.cross_room.find(
    cr => cr.source_room === sourceRoom && cr.target_room === targetRoom
  );

  if (existing) {
    // Union shared concepts
    const conceptSet = new Set([...(existing.shared_concepts || []), ...sharedConcepts]);
    existing.shared_concepts = [...conceptSet];
    existing.detected = now;
  } else {
    data.cross_room.push({
      source_room: sourceRoom,
      target_room: targetRoom,
      shared_concepts: [...sharedConcepts],
      detected: now
    });
  }

  data.updated = now;

  // Write atomically
  const filePath = path.join(roomDir, INTELLIGENCE_FILE);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

module.exports = {
  persistIntelligence,
  loadIntelligence,
  shouldSuppress,
  addCrossRoomRelationship
};
