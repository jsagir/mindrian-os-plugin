#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-05 -- /mos:explain-decision CLI dispatcher
 * ====================================================
 * User-facing audit surface for the Navigation Engine. Reads the
 * decision-trace JSON written by Plan 91-02 (and extended by Plans 91-03
 * routing_* fields + 91-04 offer_rendered) and renders it human-readable.
 *
 * Usage:
 *   node scripts/explain-decision-command.cjs
 *   node scripts/explain-decision-command.cjs --last 5
 *   node scripts/explain-decision-command.cjs --session abc123
 *   node scripts/explain-decision-command.cjs --last 3 --session abc123
 *
 * Default: render the last 1 trace.
 *
 * Session resolution chain (first match wins):
 *   1. --session <SID> CLI flag
 *   2. CLAUDE_SESSION_ID environment variable
 *   3. .mindrian/current-session.json pointer file (if present)
 *   4. Most-recent .mindrian/decision-traces/*.json by mtime
 *
 * Graceful fallbacks (always exit 0; advisory only):
 *   - No active room: print "No active room found." advisory.
 *   - No trace file: print "No decisions recorded for this session." advisory.
 *   - Malformed JSON: print "Decision trace file could not be parsed." advisory.
 *
 * Canon Part 3 (Tri-Context Decision Gate, Section 8):
 *   Every decision must be explainable. The renderer covers all 8
 *   brain_md_* fields plus 5 structural trace fields plus the
 *   chosen_rationale string. Tier mode + weight_applied feed a 4-line
 *   classifier mirroring lib/core/statusline-cache.cjs (check / warn /
 *   low / --) using the De Stijl glyph vocabulary.
 *
 * Canon Part 4 (Every Choice Is Graph Data):
 *   Reads from the graph-data surface (.mindrian/decision-traces/*.json)
 *   that Plan 91-02 writes. Pure read; never modifies the trace file.
 *
 * Canon Part 8 (Graph Boundary):
 *   Zero network surface. Reads only LOCAL .mindrian/decision-traces/.
 *   Source-scan in Test 11 enforces no Brain client / network / shell-out
 *   references in this script.
 *
 * Three-surface compatible: pure CJS, node built-ins only.
 */

const fs = require('node:fs');
const path = require('node:path');
// Phase 128.1-03b: the canonical session-scoped active-room resolver.
// resolveActiveRoomDir's inline `reg.active` read was a Bucket B-reader of the
// racing global string; it now routes through resolveActiveRoom (D-03).
const sessionBinding = require('../lib/core/session-binding.cjs');

// ---------- Frozen constants ----------

const DEFAULT_LAST_N = 1;
const TRACES_DIR_NAME = 'decision-traces';
const POINTER_FILE_NAME = 'current-session.json';

// Glyph vocabulary mirrors lib/core/statusline-cache.cjs and the De Stijl
// classifier from Canon Part 2. Re-mirrored here (~6 lines) instead of
// cross-requiring lib/core from a scripts/ entry point so this script
// stays self-contained.
function classifyTier(tierMode, weightApplied) {
  if (tierMode === 'tier_0') return 'low';
  if (tierMode === 'mode_a') {
    if (typeof weightApplied === 'number') {
      if (weightApplied >= 0.7) return 'check';
      if (weightApplied >= 0.3) return 'warn';
    }
    return 'check';
  }
  if (tierMode === 'mode_b') {
    if (typeof weightApplied === 'number' && weightApplied >= 0.5) return 'warn';
    return 'low';
  }
  return '--';
}

// ---------- argv parsing ----------

function parseArgs(argv) {
  const args = { last: DEFAULT_LAST_N, session: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--last') {
      const next = argv[i + 1];
      const n = parseInt(next, 10);
      if (Number.isFinite(n) && n > 0) args.last = n;
      i += 1;
    } else if (a === '--session') {
      const next = argv[i + 1];
      if (typeof next === 'string' && next.length > 0) args.session = next;
      i += 1;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    }
  }
  return args;
}

// ---------- Room resolution (mirrors intent-classifier resolveActiveRoomDir) ----------

function resolveRoomsRoot() {
  const home = process.env.MINDRIAN_ROOMS_HOME;
  if (typeof home === 'string' && home.length > 0) return home;
  const root = process.env.MINDRIAN_ROOMS_ROOT;
  if (typeof root === 'string' && root.length > 0) return root;
  // Default: ~/MindrianRooms.
  if (typeof process.env.HOME === 'string' && process.env.HOME.length > 0) {
    return path.join(process.env.HOME, 'MindrianRooms');
  }
  return null;
}

function readJsonSafe(fp) {
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

// Phase 128.1-03b (D-03): the prior inline `reg.active` read was a Bucket B
// reader of the racing global string. resolveActiveRoom does the session-keyed
// lookup plus the last_active/active fallback internally so concurrent
// sessions resolve their own room. The `tripwire` signal is destructured but
// not acted on here -- Plan 05 owns the tripwire surface.
function resolveActiveRoomDir() {
  try {
    const sid = sessionBinding.resolveSessionId();
    const { room, path: roomPath /* tripwire */ } =
      sessionBinding.resolveActiveRoom(sid);
    if (roomPath) {
      try {
        if (fs.existsSync(roomPath) && fs.statSync(roomPath).isDirectory()) {
          return roomPath;
        }
      } catch (_) { /* fall through to slug derivation */ }
    }
    // Fallback: derive from the slug under the rooms root (resolver path empty
    // when the room is registered without an explicit path entry).
    if (typeof room === 'string' && room.length > 0) {
      const root = resolveRoomsRoot();
      if (root) {
        const candidate = path.join(root, room);
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            return candidate;
          }
        } catch (_) {}
      }
    }
  } catch (_) { /* graceful */ }
  return null;
}

// ---------- Session resolution ----------

function resolveSessionId(roomDir, flagSession) {
  if (typeof flagSession === 'string' && flagSession.length > 0) return flagSession;
  const env = process.env.CLAUDE_SESSION_ID;
  if (typeof env === 'string' && env.length > 0) return env;
  // Pointer file written by future plans (or hand-set by tests).
  try {
    const pointer = path.join(roomDir, '.mindrian', POINTER_FILE_NAME);
    if (fs.existsSync(pointer)) {
      const parsed = readJsonSafe(pointer);
      if (parsed && typeof parsed.session_id === 'string' && parsed.session_id.length > 0) {
        return parsed.session_id;
      }
    }
  } catch (_) {}
  // mtime fallback: scan decision-traces/, pick newest *.json.
  try {
    const dir = path.join(roomDir, '.mindrian', TRACES_DIR_NAME);
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir);
    let best = null;
    let bestMtime = -1;
    for (const e of entries) {
      if (!e.endsWith('.json')) continue;
      const fp = path.join(dir, e);
      try {
        const st = fs.statSync(fp);
        if (st.isFile() && st.mtimeMs > bestMtime) {
          bestMtime = st.mtimeMs;
          best = e.slice(0, -5);
        }
      } catch (_) {}
    }
    return best;
  } catch (_) { return null; }
}

// ---------- Trace file reading ----------

function readTraceFile(roomDir, sessionId) {
  const fp = path.join(roomDir, '.mindrian', TRACES_DIR_NAME, sessionId + '.json');
  if (!fs.existsSync(fp)) {
    return { ok: false, reason: 'absent' };
  }
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.traces)) {
      return { ok: false, reason: 'malformed' };
    }
    return { ok: true, data: parsed };
  } catch (_) {
    return { ok: false, reason: 'malformed' };
  }
}

// ---------- Renderers ----------

function fmtScalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') {
    // Print numbers with up to 2 decimals; integers as integers.
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(2);
  }
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function fmtList(arr) {
  if (!Array.isArray(arr)) return '[]';
  return '[' + arr.map(String).join(', ') + ']';
}

function renderTrace(t) {
  const lines = [];
  // Header: turn, timestamp, elapsed.
  const turn = (typeof t.turn === 'number') ? t.turn : '?';
  const at = typeof t.at === 'string' ? t.at : '';
  const elapsed = (typeof t.elapsed_ms === 'number')
    ? (t.elapsed_ms + 'ms')
    : 'unknown';
  lines.push('Turn ' + turn + ' @ ' + at + '  (elapsed: ' + elapsed + ')');
  lines.push('');

  // Tier Mode block with glyph classifier.
  const tierMode = typeof t.brain_md_tier_mode === 'string'
    ? t.brain_md_tier_mode
    : 'tier_0';
  const weight = typeof t.brain_md_weight_applied === 'number'
    ? t.brain_md_weight_applied
    : null;
  const glyph = classifyTier(tierMode, weight);
  lines.push('## Tier Mode');
  lines.push(tierMode + '  glyph: ' + glyph);
  lines.push('');

  // BRAIN.md signal: 5 fields (version, staleness, stale_reason,
  // weight_applied, sections_consumed).
  lines.push('## BRAIN.md signal');
  lines.push('- version: ' + fmtScalar(t.brain_md_version));
  lines.push('- staleness: ' + fmtScalar(t.brain_md_staleness));
  lines.push('- stale_reason: ' + fmtScalar(t.brain_md_stale_reason));
  lines.push('- weight_applied: ' + fmtScalar(t.brain_md_weight_applied));
  lines.push('- sections_consumed: ' + fmtList(t.brain_md_sections_consumed));
  lines.push('');

  // RECOMMENDED marker block: 2 fields (rendered, highest_confidence).
  lines.push('## RECOMMENDED marker');
  lines.push('- rendered: ' + fmtScalar(t.brain_md_recommended_marker_rendered));
  lines.push('- highest_confidence: ' + fmtScalar(t.brain_md_recommended_confidence));
  lines.push('');

  // Five-Signal Triangulation: 5 numbered entries.
  lines.push('## Five-Signal Triangulation');
  lines.push('');
  // 1. ICM scope.
  let icmLine = '1. ICM scope: ';
  if (t.icm_scope && typeof t.icm_scope === 'object') {
    const sec = t.icm_scope.section || 'unknown';
    const sp = t.icm_scope.scope_path || '';
    icmLine += sec + ' (scope_path: ' + sp + ')';
  } else {
    icmLine += 'null';
  }
  lines.push(icmLine);
  // 2. SQL signals.
  let sqlLine = '2. SQL signals: ';
  if (t.sql_signals && typeof t.sql_signals === 'object') {
    const ec = t.sql_signals.edge_counts;
    const co = t.sql_signals.contradictions;
    const cv = t.sql_signals.convergences;
    sqlLine += fmtScalar(ec) + ' edges, ' + fmtScalar(co) + ' contradictions, '
      + fmtScalar(cv) + ' convergences';
  } else {
    sqlLine += 'null';
  }
  lines.push(sqlLine);
  // 3. Feynman-MINTO.
  let mintoLine = '3. Feynman-MINTO: ';
  if (t.minto_reasoning && typeof t.minto_reasoning === 'object') {
    const rh = t.minto_reasoning.reasoning_health_score;
    const stale = t.minto_reasoning.is_stale;
    const gt = t.minto_reasoning.governing_thought || '';
    mintoLine += 'reasoning_health=' + fmtScalar(rh)
      + ', is_stale=' + fmtScalar(stale)
      + ', governing_thought="' + gt + '"';
  } else {
    mintoLine += 'null';
  }
  lines.push(mintoLine);
  // 4. BRAIN patterns.
  const sections = Array.isArray(t.brain_md_sections_consumed)
    ? t.brain_md_sections_consumed
    : [];
  lines.push('4. BRAIN patterns: ' + fmtList(sections));
  // 5. Intent + Persona.
  let personaLine = '5. Intent + Persona: ';
  if (t.intent_persona && typeof t.intent_persona === 'object') {
    const lp = t.intent_persona.larry_persona || 'null';
    const bp = t.intent_persona.brain_persona || 'null';
    const dc = t.intent_persona.detection_confidence;
    personaLine += 'larry=' + lp + ', brain=' + bp
      + ', confidence=' + fmtScalar(dc);
  } else {
    personaLine += 'null';
  }
  lines.push(personaLine);
  lines.push('');

  // Chosen rationale.
  lines.push('## Chosen rationale');
  lines.push(typeof t.chosen_rationale === 'string' ? t.chosen_rationale : '(none)');
  lines.push('');

  // Optional: routing source (Plan 91-03) and offer_rendered (Plan 91-04).
  if (t.routing_source) {
    lines.push('## Routing');
    lines.push('- source: ' + t.routing_source);
    if (t.routing_reason) lines.push('- reason: ' + t.routing_reason);
    if (Array.isArray(t.routing_activated_skills)) {
      lines.push('- activated_skills: ' + fmtList(t.routing_activated_skills));
    }
    lines.push('');
  }
  if (typeof t.offer_rendered === 'string' && t.offer_rendered.length > 0) {
    lines.push('## Offer rendered');
    lines.push(t.offer_rendered);
    lines.push('');
  }

  lines.push('---');
  return lines.join('\n');
}

// Phase 94-09: Action Footer per skills/ui-system/SKILL.md 4-zone rule.
// Section 1 Zone 4 declares the Action Footer "NEVER omitted". Pre-94-09
// this script's output ended with `---` separator and no Next: footer,
// violating the rule. Per QA handoff Section 3 FIX-8, append a footer
// with 3 canonical /mos:* commands so the user always has a navigable
// next step after inspecting a decision trace. Verbs map to Canon Part 3
// 10-verb vocabulary: /mos:status -> Synthesize (room health),
// /mos:act -> Run Methodology, /mos:suggest-next -> Free-Text /
// Spawn Sub-Agent (engine-driven recommendation).
function actionFooter() {
  return [
    '',
    'Next:  /mos:status         see room health',
    '       /mos:act            run a methodology',
    '       /mos:suggest-next   let the engine pick',
    '',
  ].join('\n');
}

function renderHeader(sessionId, count, totalAvailable) {
  const lines = [];
  lines.push('# Navigation Engine Decision Trace');
  lines.push('');
  lines.push('Session: ' + sessionId);
  if (count > 1) {
    lines.push('Last ' + count + ' decisions (of ' + totalAvailable + ' available)');
  } else {
    lines.push('Last decision (of ' + totalAvailable + ' available)');
  }
  lines.push('');
  return lines.join('\n');
}

function printHelp() {
  process.stdout.write([
    '/mos:explain-decision -- Navigation Engine audit surface',
    '',
    'Usage:',
    '  /mos:explain-decision                       (last 1 trace)',
    '  /mos:explain-decision --last 5              (last 5 traces)',
    '  /mos:explain-decision --session SESSIONID   (cross-session audit)',
    '',
    'Reads .mindrian/decision-traces/<session>.json (LOCAL only).',
    '',
  ].join('\n'));
}

// ---------- Main ----------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
    return;
  }

  const roomDir = resolveActiveRoomDir();
  if (!roomDir) {
    process.stdout.write('No active room found.\n');
    process.stdout.write('  Why: registry.json missing or no active room set.\n');
    process.stdout.write('  Fix: /mos:rooms switch <slug>\n');
    // Phase 94-09: Action Footer per ui-system 4-zone rule (NEVER omitted).
    process.stdout.write(actionFooter());
    process.exit(0);
    return;
  }

  const sessionId = resolveSessionId(roomDir, args.session);
  if (!sessionId) {
    process.stdout.write('No decisions recorded for this session.\n');
    process.stdout.write('  Why: no decision-traces found under ' + roomDir + '/.mindrian/decision-traces/\n');
    process.stdout.write('  Fix: send a prompt to Larry to record a decision; then re-run /mos:explain-decision.\n');
    // Phase 94-09: Action Footer per ui-system 4-zone rule.
    process.stdout.write(actionFooter());
    process.exit(0);
    return;
  }

  const result = readTraceFile(roomDir, sessionId);
  if (!result.ok) {
    if (result.reason === 'malformed') {
      process.stdout.write('Decision trace file could not be parsed.\n');
      process.stdout.write('  Session: ' + sessionId + '\n');
      process.stdout.write('  File: .mindrian/decision-traces/' + sessionId + '.json\n');
      // Phase 94-09: Action Footer per ui-system 4-zone rule.
      process.stdout.write(actionFooter());
      process.exit(0);
      return;
    }
    process.stdout.write('No decisions recorded for this session.\n');
    process.stdout.write('  Session: ' + sessionId + '\n');
    // Phase 94-09: Action Footer per ui-system 4-zone rule.
    process.stdout.write(actionFooter());
    process.exit(0);
    return;
  }

  const traces = result.data.traces || [];
  if (traces.length === 0) {
    process.stdout.write('No decisions recorded for this session.\n');
    process.stdout.write('  Session: ' + sessionId + '\n');
    // Phase 94-09: Action Footer per ui-system 4-zone rule. Empty-path
    // (T4) graceful render: the user always gets a navigable next step
    // even when no decisions are recorded yet.
    process.stdout.write(actionFooter());
    process.exit(0);
    return;
  }

  // Clamp --last N to available; default 1.
  const requested = args.last;
  const n = Math.min(requested, traces.length);
  const slice = traces.slice(traces.length - n);

  const header = renderHeader(sessionId, n, traces.length);
  process.stdout.write(header + '\n');
  for (const t of slice) {
    process.stdout.write(renderTrace(t) + '\n\n');
  }
  // Phase 94-09: Action Footer per ui-system 4-zone rule. Appended at the
  // END of the rendered output, AFTER the last trace's closing `---`
  // separator, so renderTrace() output is byte-identical to pre-94-09 up
  // to and including the closing `---`. The footer is purely additive at
  // the tail per the QA handoff Section 3 FIX-8 verbatim suggestion.
  process.stdout.write(actionFooter());
  process.exit(0);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    // Defense-in-depth: never throw to the user. Print advisory and exit 0.
    process.stdout.write('Decision trace could not be rendered.\n');
    process.stdout.write('  Reason: ' + (err && err.message ? err.message : 'unknown') + '\n');
    // Phase 94-09: Action Footer per ui-system 4-zone rule.
    process.stdout.write(actionFooter());
    process.exit(0);
  }
}

module.exports = {
  parseArgs: parseArgs,
  resolveActiveRoomDir: resolveActiveRoomDir,
  resolveSessionId: resolveSessionId,
  readTraceFile: readTraceFile,
  renderTrace: renderTrace,
  renderHeader: renderHeader,
  classifyTier: classifyTier,
  actionFooter: actionFooter,
};
