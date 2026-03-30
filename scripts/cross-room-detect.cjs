#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Cross-Room Concept Detection
 * Scans KuzuDB artifact titles across rooms, finds shared keywords,
 * and records cross-room relationships in proactive intelligence.
 *
 * Usage: node cross-room-detect.cjs <roomDir> [workspaceDir]
 *
 * Exits 0 gracefully when no registry exists or single room (nothing to cross-reference).
 * Each room's KuzuDB is opened and closed independently (read-only MATCH queries only).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const roomDir = process.argv[2];
const workspaceDir = process.argv[3] || process.cwd();

if (!roomDir) {
  console.log(JSON.stringify({ scanned: 0, relationships: 0, concepts: [], error: 'no room dir' }));
  process.exit(0);
}

const registryPath = path.join(workspaceDir, '.rooms', 'registry.json');

// Graceful exit if no registry
if (!fs.existsSync(registryPath)) {
  console.log(JSON.stringify({ scanned: 0, relationships: 0, concepts: [] }));
  process.exit(0);
}

/**
 * Extract keywords from an array of title strings.
 * Splits on spaces, filters words > 3 chars, lowercases, unique set.
 * @param {string[]} titles
 * @returns {Set<string>}
 */
function extractKeywords(titles) {
  const keywords = new Set();
  const noise = new Set([
    'analysis', 'framework', 'venture', 'methodology', 'section',
    'evidence', 'definition', 'problem', 'market', 'solution',
    'business', 'model', 'financial', 'competitive', 'approach',
    'should', 'would', 'could', 'about', 'their', 'these', 'those',
    'which', 'where', 'through', 'between', 'using', 'based',
    'consider', 'important', 'different', 'provide', 'from', 'with',
    'that', 'this', 'will', 'have', 'been', 'what', 'when', 'into',
    'more', 'than', 'also', 'each', 'they', 'does', 'there', 'your'
  ]);

  for (const title of titles) {
    if (!title || typeof title !== 'string') continue;
    const words = title.toLowerCase().split(/[^a-z0-9]+/);
    for (const word of words) {
      if (word.length > 3 && !noise.has(word)) {
        keywords.add(word);
      }
    }
  }
  return keywords;
}

/**
 * Query artifact titles from a room's KuzuDB.
 * Opens DB, queries, closes -- open-use-close pattern.
 * @param {string} roomPath - Absolute path to the room
 * @returns {Promise<string[]>} Array of artifact titles
 */
async function getArtifactTitles(roomPath) {
  const lazygraphDir = path.join(roomPath, '.lazygraph');
  if (!fs.existsSync(lazygraphDir)) return [];

  let kuzu;
  try {
    kuzu = require('kuzu');
  } catch (_) {
    return []; // KuzuDB not installed
  }

  let db = null;
  let conn = null;
  try {
    db = new kuzu.Database(lazygraphDir, 0, false, false, 256 * 1024 * 1024);
    conn = new kuzu.Connection(db);
    const result = await conn.query('MATCH (a:Artifact) RETURN a.title');
    const titles = [];
    while (result.hasNext()) {
      const row = await result.getNext();
      const val = row['a.title'];
      if (val) titles.push(val);
    }
    return titles;
  } catch (_) {
    return []; // DB error -- skip this room
  } finally {
    try { if (conn) conn.close(); } catch (_) {}
    try { if (db) db.close(); } catch (_) {}
  }
}

async function main() {
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (_) {
    console.log(JSON.stringify({ scanned: 0, relationships: 0, concepts: [] }));
    process.exit(0);
  }

  const rooms = registry.rooms || {};
  const roomNames = Object.keys(rooms);

  // Single room -- nothing to cross-reference
  if (roomNames.length <= 1) {
    console.log(JSON.stringify({ scanned: roomNames.length, relationships: 0, concepts: [] }));
    process.exit(0);
  }

  // Resolve current room's canonical path
  const currentRoomAbs = path.resolve(roomDir);

  // Get current room's keywords
  const currentTitles = await getArtifactTitles(currentRoomAbs);
  const currentKeywords = extractKeywords(currentTitles);

  if (currentKeywords.size === 0) {
    console.log(JSON.stringify({ scanned: roomNames.length, relationships: 0, concepts: [] }));
    process.exit(0);
  }

  // Load proactive intelligence module
  let pi;
  try {
    pi = require(path.join(__dirname, '..', 'lib', 'core', 'proactive-intelligence.cjs'));
  } catch (_) {
    // Try alternative path
    try {
      pi = require(path.resolve(__dirname, '..', 'lib', 'core', 'proactive-intelligence.cjs'));
    } catch (_2) {
      console.log(JSON.stringify({ scanned: roomNames.length, relationships: 0, concepts: [], error: 'pi module not found' }));
      process.exit(0);
    }
  }

  let scanned = 0;
  let relationships = 0;
  const allConcepts = [];

  for (const name of roomNames) {
    const roomEntry = rooms[name];
    if (!roomEntry || !roomEntry.path) continue;

    const otherRoomAbs = path.resolve(workspaceDir, roomEntry.path);

    // Skip current room
    if (otherRoomAbs === currentRoomAbs) continue;

    // Skip rooms without .lazygraph
    if (!fs.existsSync(path.join(otherRoomAbs, '.lazygraph'))) continue;

    scanned++;

    try {
      const otherTitles = await getArtifactTitles(otherRoomAbs);
      const otherKeywords = extractKeywords(otherTitles);

      // Find intersection
      const shared = [];
      for (const kw of currentKeywords) {
        if (otherKeywords.has(kw)) {
          shared.push(kw);
        }
      }

      // Require 3+ shared concepts for a meaningful relationship
      if (shared.length >= 3) {
        pi.addCrossRoomRelationship(
          currentRoomAbs,
          path.basename(currentRoomAbs),
          path.basename(otherRoomAbs),
          shared
        );
        relationships++;
        allConcepts.push(...shared);
      }
    } catch (_) {
      // Skip failed rooms -- continue scanning
    }
  }

  const uniqueConcepts = [...new Set(allConcepts)];
  console.log(JSON.stringify({ scanned, relationships, concepts: uniqueConcepts }));
}

main().catch(() => {
  console.log(JSON.stringify({ scanned: 0, relationships: 0, concepts: [], error: 'unexpected' }));
  process.exit(0);
});
