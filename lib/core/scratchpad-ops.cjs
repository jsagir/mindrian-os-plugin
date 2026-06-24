/**
 * scratchpad-ops.cjs -- Pre-room scratchpad persistence
 *
 * Stores opportunities, highlights, persona, and framework chain progress
 * at ~/.mindrian/scratchpad.json across sessions without requiring a room.
 *
 * Part of CONV-04 (real-time opportunity extraction) and CONV-06 (pre-room persistence).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRATCHPAD_DIR = path.join(os.homedir(), '.mindrian');
const SCRATCHPAD_PATH = path.join(SCRATCHPAD_DIR, 'scratchpad.json');

const DEFAULT_SCRATCHPAD = {
  opportunities: [],
  highlights: [],
  persona: null,
  framework_chain_progress: null,
  last_updated: null,
  // Phase 155-01: birth gate answers journal (B1/B2/U0 pre-room gate decisions).
  // Entries shape: {gate_id, option_key, canonical_verb, alias_label, free_text?,
  //                 arrival_asset?, ts}
  // Replayed as typed edges after room birth (Plan 02: drainBirthGateAnswers).
  // Preserving this key in DEFAULT_SCRATCHPAD + readScratchpad() closes
  // RESEARCH Pitfall 2 (the re-normalization silently-drops-unknown-keys trap).
  birth_gate_answers: []
};

/**
 * Read the scratchpad. Creates ~/.mindrian/ if missing.
 * Returns parsed object or default empty structure.
 */
function readScratchpad() {
  if (!fs.existsSync(SCRATCHPAD_DIR)) {
    fs.mkdirSync(SCRATCHPAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(SCRATCHPAD_PATH)) {
    return { ...DEFAULT_SCRATCHPAD, opportunities: [], highlights: [], birth_gate_answers: [] };
  }
  try {
    const raw = fs.readFileSync(SCRATCHPAD_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      persona: parsed.persona || null,
      framework_chain_progress: parsed.framework_chain_progress || null,
      last_updated: parsed.last_updated || null,
      // Phase 155-01: explicitly preserve birth_gate_answers from parsed JSON.
      // The spread-DEFAULT_SCRATCHPAD pattern silently drops keys not in the
      // spread target when the field is destructured explicitly (RESEARCH Pitfall 2).
      // We close the trap by reading the field explicitly with an Array.isArray guard,
      // matching the same idiom used for opportunities and highlights above.
      birth_gate_answers: Array.isArray(parsed.birth_gate_answers) ? parsed.birth_gate_answers : []
    };
  } catch (_e) {
    return { ...DEFAULT_SCRATCHPAD, opportunities: [], highlights: [], birth_gate_answers: [] };
  }
}

/**
 * Write a scratchpad entry.
 * @param {string} type - "opportunity" or "highlight"
 * @param {object} data - For opportunity: full opportunity object. For highlight: { text: "..." }
 * @returns {{ written: boolean, type: string, deduplicated?: boolean, count: number }}
 */
function writeScratchpadEntry(type, data) {
  const pad = readScratchpad();

  if (type === 'opportunity') {
    // Dedup by opportunityHash on problem field
    const { opportunityHash } = require('./opportunity-extractor.cjs');
    const newHash = opportunityHash(data.problem || '');
    const exists = pad.opportunities.some(opp => opportunityHash(opp.problem || '') === newHash);
    if (exists) {
      return { written: false, type: 'opportunity', deduplicated: true, count: pad.opportunities.length };
    }
    // Ensure required fields have defaults
    const entry = {
      problem: data.problem || '',
      mirror_solution: data.mirror_solution || '',
      domain: data.domain || '',
      evidence: data.evidence || '',
      source_framework: data.source_framework || 'conversation',
      knight_position: data.knight_position || 'uncertainty',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
      created: data.created || new Date().toISOString().split('T')[0],
      status: data.status || 'candidate'
    };
    pad.opportunities.push(entry);
  } else if (type === 'highlight') {
    pad.highlights.push({
      text: data.text || (typeof data === 'string' ? data : JSON.stringify(data)),
      timestamp: new Date().toISOString()
    });
  } else {
    return { written: false, type, error: 'Unknown type. Use "opportunity" or "highlight".' };
  }

  pad.last_updated = new Date().toISOString();
  _writeAtomic(pad);
  const count = type === 'opportunity' ? pad.opportunities.length : pad.highlights.length;
  return { written: true, type, count };
}

/**
 * Get just the opportunities array from the scratchpad.
 * @returns {Array}
 */
function getScratchpadOpportunities() {
  return readScratchpad().opportunities;
}

/**
 * Update scratchpad metadata fields (persona or framework_chain_progress).
 * @param {string} field - "persona" or "framework_chain_progress"
 * @param {*} value - The value to set
 * @returns {{ updated: boolean, field: string }}
 */
function updateScratchpadMeta(field, value) {
  if (field !== 'persona' && field !== 'framework_chain_progress') {
    return { updated: false, field, error: 'Only "persona" or "framework_chain_progress" allowed.' };
  }
  const pad = readScratchpad();
  pad[field] = value;
  pad.last_updated = new Date().toISOString();
  _writeAtomic(pad);
  return { updated: true, field };
}

/**
 * Migrate scratchpad contents to a room.
 * Banks each opportunity via opportunity-ops.bankOpportunity(),
 * copies highlights to room/.context/conversation-highlights.md,
 * then clears the scratchpad.
 * @param {string} roomDir - Path to the room directory
 * @returns {{ migrated_opportunities: number, migrated_highlights: number }}
 */
function migrateToRoom(roomDir) {
  const pad = readScratchpad();
  let migratedOpps = 0;
  let migratedHighlights = 0;

  // Lazy require to avoid circular deps
  const opportunityOps = require('./opportunity-ops.cjs');

  // Bank each opportunity to the room
  for (const opp of pad.opportunities) {
    try {
      const result = opportunityOps.bankOpportunity(roomDir, opp);
      if (result && !result.error) migratedOpps++;
    } catch (_e) {
      // Skip failed banks, continue with rest
    }
  }

  // Copy highlights to room/.context/conversation-highlights.md
  if (pad.highlights.length > 0) {
    const resolvedRoom = path.resolve(roomDir);
    const contextDir = path.join(resolvedRoom, '.context');
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
    const highlightsPath = path.join(contextDir, 'conversation-highlights.md');
    const lines = ['# Conversation Highlights', '', '> Migrated from pre-room scratchpad', ''];
    for (const h of pad.highlights) {
      lines.push(`- **${h.timestamp || 'unknown'}:** ${h.text}`);
    }
    lines.push('');
    fs.writeFileSync(highlightsPath, lines.join('\n'), 'utf-8');
    migratedHighlights = pad.highlights.length;
  }

  // Clear scratchpad after migration
  clearScratchpad();

  return { migrated_opportunities: migratedOpps, migrated_highlights: migratedHighlights };
}

/**
 * Clear the scratchpad to default empty structure.
 */
function clearScratchpad() {
  const empty = { ...DEFAULT_SCRATCHPAD, opportunities: [], highlights: [] };
  empty.last_updated = new Date().toISOString();
  _writeAtomic(empty);
}

/**
 * Journal a birth gate answer to birth_gate_answers in the scratchpad.
 * Appends an entry; never overwrites existing entries.
 *
 * Entry shape:
 *   { gate_id: 'B1'|'B2'|'U0', option_key, canonical_verb, alias_label,
 *     free_text?, arrival_asset?, ts }
 *
 * ts is defaulted to Date.now() if absent.
 *
 * Used by: B2 Defer path in commands/new-project.md; B1 gate in Plan 02;
 * U0 gate in Plan 04. All entries are replayed as typed graph edges by
 * drainBirthGateAnswers() inside the Plan 02 STEP 2 birth transaction.
 *
 * Part 8: birth_gate_answers is LOCAL-only; drainBirthGateAnswers writes
 * to room.db, never to Brain.
 *
 * @param {object} answer - the gate answer to journal
 * @returns {{ written: boolean }}
 */
function writeScratchpadBirthAnswer(answer) {
  try {
    const pad = readScratchpad();
    const entry = {
      gate_id: answer.gate_id || null,
      option_key: answer.option_key || null,
      canonical_verb: answer.canonical_verb || null,
      alias_label: answer.alias_label || null,
      ts: typeof answer.ts === 'number' ? answer.ts : Date.now()
    };
    // Optional fields: only include if present
    if (typeof answer.free_text === 'string') entry.free_text = answer.free_text;
    if (typeof answer.arrival_asset === 'string') entry.arrival_asset = answer.arrival_asset;
    // Phase 179-02 (SPEC Req 9): widen the whitelist so the B1 persona/hypothesis
    // signal survives to B2. ADDITIVE -- absent fields leave the entry shape
    // byte-identical to today (keys absent, not present-as-null).
    // role_blend rides as a plain non-null non-array object (the {key:1.0} blend);
    // blueprint_family + hypothesis_text ride as strings (same typeof-string idiom).
    // Part 8: these are LOCAL-only journal bytes; drainBirthGateAnswers writes them
    // to room.db, never to Brain (role_blend weights + hypothesis_text never egress).
    if (
      answer.role_blend &&
      typeof answer.role_blend === 'object' &&
      !Array.isArray(answer.role_blend)
    ) {
      entry.role_blend = answer.role_blend;
    }
    if (typeof answer.blueprint_family === 'string') entry.blueprint_family = answer.blueprint_family;
    if (typeof answer.hypothesis_text === 'string') entry.hypothesis_text = answer.hypothesis_text;

    pad.birth_gate_answers.push(entry);
    pad.last_updated = new Date().toISOString();
    _writeAtomic(pad);
    return { written: true };
  } catch (_e) {
    return { written: false, error: _e.message };
  }
}

/**
 * Drain birth gate answers into the room database.
 *
 * Body filled by Plan 02 (lib/core/navigation/room-birth.cjs); called inside
 * the STEP 2 SQLite transaction. Delegates to the room-birth.cjs internal
 * drainBirthGateAnswers implementation so all drain logic lives in one place.
 *
 * For each gateAnswers entry:
 *   1. logMemoryEvent with event_type='birth_gate_answered'
 *   2. writeEdge with the typed cascade edge:
 *       Approve / RunMethodology -> FILED_AS_DECISION
 *       Defer                    -> DEFERRED
 *       Reject                   -> REJECTED_BECAUSE (reason = entry.free_text)
 *       <anything else>          -> FILED_AS_DECISION (safe default)
 *   NEVER write CHOSE (not in ALLOWED_EDGE_TYPES; RESEARCH Pitfall 7 verified).
 *
 * Canon Part 8: gate_answers are LOCAL-only; drainBirthGateAnswers writes to
 * room.db, never to Brain. The free_text reason is truncated to 200 chars.
 *
 * @param {object} db - the room.db DatabaseSync instance (caller provides)
 * @param {string} roomDir - the room directory path (caller provides)
 * @param {Array} [gateAnswers] - the birth_gate_answers array (optional; defaults to [])
 * @param {string} [ventureNodeId] - the claim node id for edge source attribution
 * @returns {{ ok: boolean, drained: number }}
 */
function drainBirthGateAnswers(db, roomDir, gateAnswers, ventureNodeId) {
  // Delegate to the room-birth.cjs implementation (the canonical body lives there
  // to avoid circular deps: room-birth.cjs requires scratchpad-ops.cjs for
  // migrateToRoom; scratchpad-ops.cjs would create a circular if it required
  // room-birth.cjs directly). Lazy-require breaks the cycle.
  try {
    const roomBirth = require('./navigation/room-birth.cjs');
    return roomBirth.drainBirthGateAnswers(db, roomDir, gateAnswers, ventureNodeId);
  } catch (_e) {
    // Fallback stub if room-birth.cjs is not yet available (Plan 01 isolation).
    void db; void roomDir; void gateAnswers; void ventureNodeId;
    return { ok: true, drained: 0 };
  }
}

/**
 * Atomic write: write to .tmp then rename.
 * @param {object} data
 */
function _writeAtomic(data) {
  if (!fs.existsSync(SCRATCHPAD_DIR)) {
    fs.mkdirSync(SCRATCHPAD_DIR, { recursive: true });
  }
  const tmpPath = SCRATCHPAD_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, SCRATCHPAD_PATH);
}

module.exports = {
  readScratchpad,
  writeScratchpadEntry,
  getScratchpadOpportunities,
  updateScratchpadMeta,
  migrateToRoom,
  clearScratchpad,
  // Phase 155-01 additions (birth gate answers journal):
  writeScratchpadBirthAnswer,
  drainBirthGateAnswers
};
