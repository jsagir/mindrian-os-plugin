'use strict';

/**
 * chat-context-builder.cjs -- SQL-targeted context injection for the BYO
 * chat panel (Phase 87-09). Produces a {systemPrompt, userPrompt,
 * tokenEstimate} triple sized to stay under 5000 tokens per call -- a
 * ~57x reduction vs. slurping the whole room.
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Five intent patterns (all return tokenEstimate on every path):
 *   1. contradicts  -- top CONTRADICTS edges from room.db
 *   2. converges    -- top CONVERGES edges from room.db
 *   3. stakeholders -- graceful early-return "no data yet" when the
 *                       stakeholders table is empty (R6 / 84-05 Pattern 3)
 *   4. gaps         -- sections with the fewest indexed artifacts
 *   5. briefing     -- fallback: top-confidence edges + artifact excerpts
 *
 * Schema notes (real room.db, from lib/core/lazygraph-ops.cjs):
 *   - edges(source, target, type, properties)  -- NOT source_id/target_id
 *   - nodes(id, type, properties)  -- Artifact nodes have id = "section/slug"
 *     and properties JSON carries title + section; this IS the "artifacts"
 *     view the plan's pseudocode referenced.
 *   - stakeholders(id, type, name, canonical_ref, notes, metadata,
 *     created_at, updated_at)
 *
 * The 5K budget is enforced by capping the JSON-stringified edge list and
 * per-artifact excerpt size. Every return path computes tokenEstimate =
 * Math.ceil((systemPrompt.length + userPrompt.length) / 4).
 */

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const CTX_CHAR_BUDGET = 18000;         // ~4500 tokens at 4 char/token
const PER_ARTIFACT_CHAR_CAP = 1500;    // cap each artifact excerpt
const EDGE_JSON_CAP = 3000;            // cap JSON.stringify(edges, null, 2)

/**
 * Classify a free-text user message into one of the five intent buckets.
 * Default fallback: briefing.
 * @param {string} msg
 * @returns {'contradicts'|'converges'|'stakeholders'|'gaps'|'briefing'}
 */
function classifyIntent(msg) {
  const m = (msg || '').toLowerCase();
  if (/contradic|conflict|inconsist/.test(m)) return 'contradicts';
  if (/converg|align|pattern|theme/.test(m)) return 'converges';
  if (/said|who|attribut|stakeholder/.test(m)) return 'stakeholders';
  if (/gap|fill|next|where should/.test(m)) return 'gaps';
  if (/briefing|intelligence|summary|overview/.test(m)) return 'briefing';
  return 'briefing';
}

/**
 * Read an artifact file with a hard size cap.
 * @param {string} filePath
 * @returns {string}
 */
function readArtifactSafe(filePath) {
  try {
    const s = fs.readFileSync(filePath, 'utf8');
    return s.length > PER_ARTIFACT_CHAR_CAP
      ? (s.slice(0, PER_ARTIFACT_CHAR_CAP) + '\n[truncated]')
      : s;
  } catch (_) {
    return '';
  }
}

/**
 * Approximate token count from char length (4 chars per token heuristic).
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @returns {number}
 */
function estimateTokens(systemPrompt, userPrompt) {
  return Math.ceil(((systemPrompt || '').length + (userPrompt || '').length) / 4);
}

/**
 * Derive a best-effort section name from an Artifact node id of the form
 * "section/slug". Returns null if the id has no slash.
 * @param {string} id
 * @returns {string|null}
 */
function sectionOfId(id) {
  if (!id || typeof id !== 'string') return null;
  const i = id.indexOf('/');
  return i > 0 ? id.slice(0, i) : null;
}

/**
 * Parse a node properties JSON string, defensively.
 * @param {string} s
 * @returns {object}
 */
function safeProps(s) {
  if (!s) return {};
  try { return JSON.parse(s); } catch (_) { return {}; }
}

/**
 * Build a chat context for `userMessage` scoped to `roomDir`. Returns
 *   { systemPrompt, userPrompt, tokenEstimate, earlyReturn, intent }
 * where tokenEstimate is a number on EVERY code path (including fallbacks
 * and early-returns). Never throws on missing db; it returns a minimal
 * context instead.
 *
 * @param {string} roomDir Absolute path to the active room.
 * @param {string} userMessage Raw user input (post-trim).
 * @param {object} [options] Reserved for future filters.
 * @returns {Promise<{systemPrompt:string, userPrompt:string, tokenEstimate:number, earlyReturn:boolean, intent:string}>}
 */
async function buildContext(roomDir, userMessage, options = {}) {
  const intent = classifyIntent(userMessage);
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');

  if (!fs.existsSync(dbPath)) {
    const systemPrompt =
      'You are Larry -- the PWS methodology teaching partner. ' +
      'The active room has no graph data yet (room.db missing).';
    return {
      systemPrompt,
      userPrompt: userMessage,
      tokenEstimate: estimateTokens(systemPrompt, userMessage),
      earlyReturn: false,
      intent,
    };
  }

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    // Fetch intent-specific rows. Every query returns an array of plain
    // objects with bounded shape; JSON.stringify cap below ensures budget.
    let rows = [];

    if (intent === 'contradicts') {
      rows = db.prepare(
        "SELECT source, target, type, properties FROM edges WHERE type = 'CONTRADICTS' LIMIT 5"
      ).all();
    } else if (intent === 'converges') {
      rows = db.prepare(
        "SELECT source, target, type, properties FROM edges WHERE type = 'CONVERGES' LIMIT 5"
      ).all();
    } else if (intent === 'stakeholders') {
      const n = db.prepare('SELECT COUNT(*) AS n FROM stakeholders').get().n;
      if (n === 0) {
        // R6 / 84-05 Pattern 3: graceful fallback. Do NOT fabricate
        // attribution when the stakeholders table is empty.
        const sp = 'You are Larry -- the PWS methodology teaching partner.';
        const up =
          'Stakeholder attribution has not been populated for this room yet. ' +
          'File meetings via /mos:file-meeting to populate.';
        return {
          systemPrompt: sp,
          userPrompt: up,
          tokenEstimate: estimateTokens(sp, up),
          earlyReturn: true,
          intent,
        };
      }
      rows = db.prepare(
        'SELECT id, type, name, canonical_ref, notes FROM stakeholders LIMIT 10'
      ).all();
    } else if (intent === 'gaps') {
      // Sections with the fewest Artifact nodes = candidate gaps. Derive
      // the section from each Artifact node's id prefix (schema stores
      // section in the node id path).
      const artifactRows = db.prepare(
        "SELECT id FROM nodes WHERE type = 'Artifact'"
      ).all();
      const perSection = new Map();
      for (const r of artifactRows) {
        const sec = sectionOfId(r.id);
        if (!sec) continue;
        perSection.set(sec, (perSection.get(sec) || 0) + 1);
      }
      rows = [...perSection.entries()]
        .map(([section, entry_count]) => ({ section, entry_count }))
        .sort((a, b) => a.entry_count - b.entry_count)
        .slice(0, 5);
    } else {
      // briefing: top edges as a general overview
      rows = db.prepare(
        'SELECT source, target, type, properties FROM edges LIMIT 10'
      ).all();
    }

    // Fetch a few referenced Artifact nodes by id (best-effort).
    const referencedIds = [...new Set(
      rows.flatMap((r) => [r.source, r.target]).filter(Boolean)
    )].slice(0, 3);

    let artifactExcerpts = '';
    for (const aid of referencedIds) {
      const a = db.prepare(
        "SELECT id, properties FROM nodes WHERE id = ? AND type = 'Artifact'"
      ).get(aid);
      if (!a) continue;
      const props = safeProps(a.properties);
      const title = props.title || a.id;
      // The real on-disk file path is derived from the node id:
      //   id "section/slug"  ->  roomDir/section/slug.md (current layout)
      //   id may also reference a section-level node (skipped above).
      const candidatePaths = [
        path.join(roomDir, aid + '.md'),
        path.join(roomDir, aid, path.basename(aid) + '.md'),
      ];
      let body = '';
      for (const p of candidatePaths) {
        body = readArtifactSafe(p);
        if (body) break;
      }
      if (body) {
        artifactExcerpts += '\n\n--- ' + title + ' ---\n' + body;
      }
    }

    const systemPrompt = [
      'You are Larry -- the PWS methodology teaching partner for MindrianOS.',
      'Voice: conversational, provocative, concise. 3-8 sentences default.',
      '',
      'ACTIVE ROOM: ' + path.basename(roomDir),
      'INTENT: ' + intent,
      '',
      'RELEVANT GRAPH DATA (from SQL query matching user question):',
      JSON.stringify(rows, null, 2).slice(0, EDGE_JSON_CAP),
      '',
      'ARTIFACT EXCERPTS (only the ones referenced by the edges above):',
      artifactExcerpts.slice(0, CTX_CHAR_BUDGET - EDGE_JSON_CAP - 500),
    ].join('\n');

    return {
      systemPrompt,
      userPrompt: userMessage,
      tokenEstimate: estimateTokens(systemPrompt, userMessage),
      earlyReturn: false,
      intent,
    };
  } finally {
    try { db.close(); } catch (_) { /* ignore */ }
  }
}

module.exports = {
  buildContext,
  classifyIntent,
  estimateTokens,
  CTX_CHAR_BUDGET,
};
