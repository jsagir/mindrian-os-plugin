#!/usr/bin/env node
'use strict';

/**
 * Phase 83-07: Mid-session intent classifier (Tier 2).
 *
 * UserPromptSubmit hook. Reads the user message from stdin (JSON payload
 * or raw text), scores it against every registered room plus every sealed
 * room under MindrianRooms, and writes a conversational warning to stdout
 * when the highest-scoring room is NOT the active room. Under the
 * UserPromptSubmit contract stdout is injected as additionalContext into
 * the conversation.
 *
 * Advisory only. Never blocks. Never exits non-zero on scope mismatch.
 * Only exits non-zero on internal error (and even then we prefer exit 0
 * so we do not pollute the conversation with error noise). Hard 200ms
 * budget; if exceeded mid-walk, exits 0 silently. Writes at most one
 * warning block per invocation.
 *
 * Design rules per plan 83-07:
 *   - No dependencies. CJS only. Inline helpers.
 *   - Speed beats accuracy. False positives are tolerable, 83-06 catches
 *     the write-time false negatives.
 *   - Sealed room names surface in the warning only, not sealed content;
 *     sealed names are already surfaced by the 83-03 SEALED ROOMS block
 *     so this is not a new leak vector.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BUDGET_MS = 200;
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at',
  'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
]);

// ---------------------------------------------------------------------------
// Room root + registry resolution. Mirrors 83-06 helpers (kept inline rather
// than extracted to lib/core to avoid a retrofit of 83-06 for a tiny helper).
// ---------------------------------------------------------------------------

function resolveMindrianRoomsRoot() {
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  const defaultRoot = path.join(home, 'MindrianRooms');
  if (fs.existsSync(defaultRoot)) return defaultRoot;
  try {
    const entries = fs.readdirSync(home, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'MindrianRooms') return path.join(home, e.name);
      const sub = path.join(home, e.name);
      try {
        const subEntries = fs.readdirSync(sub, { withFileTypes: true });
        for (const s of subEntries) {
          if (s.isDirectory() && s.name === 'MindrianRooms') {
            return path.join(sub, s.name);
          }
        }
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
  return null;
}

function readRegistry(root) {
  try {
    const regPath = path.join(root, '.rooms', 'registry.json');
    const raw = fs.readFileSync(regPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function activeRoomFromRegistry(reg) {
  if (reg && typeof reg.active === 'string' && reg.active.length > 0) {
    return reg.active;
  }
  return null;
}

function registeredRoomNames(reg) {
  if (!reg) return [];
  // Support both array form and object form for rooms field.
  if (Array.isArray(reg.rooms)) {
    const out = [];
    for (const r of reg.rooms) {
      if (typeof r === 'string') out.push(r);
      else if (r && typeof r.name === 'string') out.push(r.name);
    }
    return out;
  }
  if (reg.rooms && typeof reg.rooms === 'object') {
    return Object.keys(reg.rooms);
  }
  return [];
}

function isSealed(root, roomName) {
  try {
    return fs.existsSync(path.join(root, roomName, 'GUARDRAIL.md'));
  } catch (_) {
    return false;
  }
}

// Walk MindrianRooms root one level deep looking for GUARDRAIL.md. Matches
// 83-03 walker logic: sealed rooms are always direct children of the root.
function discoverSealedRooms(root, deadline) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const e of entries) {
    if (Date.now() > deadline) return out;
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.')) continue;
    if (isSealed(root, e.name)) out.push(e.name);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tokenizer + fingerprint builder
// ---------------------------------------------------------------------------

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const lowered = text.toLowerCase();
  const rough = lowered.split(/[^a-z0-9]+/);
  const out = [];
  for (const t of rough) {
    if (!t) continue;
    if (t.length < 2) continue;
    if (STOP_WORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

function splitRoomName(name) {
  if (!name || typeof name !== 'string') return [];
  return tokenize(name.replace(/[-_]+/g, ' '));
}

// Read STATE.md frontmatter `project:` plus top-30-line capitalized phrases.
// The capitalized-phrase heuristic is deliberately crude: grab any two-or-more
// consecutive Capitalized words and treat them as entity candidates. Single
// Capitalized words are ignored (too noisy at line starts).
function buildFingerprint(root, roomName, deadline) {
  const tokens = new Set();
  for (const t of splitRoomName(roomName)) tokens.add(t);
  if (Date.now() > deadline) return tokens;
  let statePath = path.join(root, roomName, 'STATE.md');
  let raw = '';
  try {
    raw = fs.readFileSync(statePath, 'utf8');
  } catch (_) {
    return tokens;
  }
  const lines = raw.split('\n').slice(0, 30);
  // Parse frontmatter project: field if present.
  let inFrontmatter = false;
  for (const line of lines) {
    if (line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) {
      const m = line.match(/^project\s*:\s*(.+)\s*$/i);
      if (m) {
        const val = m[1].replace(/^["']|["']$/g, '');
        for (const t of tokenize(val)) tokens.add(t);
      }
      continue;
    }
    // Body: capitalized-phrase extraction. Match runs of 2+ Capitalized words.
    const phraseRe = /\b([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)+)\b/g;
    let pm;
    while ((pm = phraseRe.exec(line)) !== null) {
      for (const t of tokenize(pm[1])) tokens.add(t);
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreRoom(messageTokenSet, roomName, fingerprint) {
  // Room-name exact match: every token of the room name must appear in the
  // message token set. Weight = 5.
  const nameTokens = splitRoomName(roomName);
  let nameHit = nameTokens.length > 0;
  for (const t of nameTokens) {
    if (!messageTokenSet.has(t)) { nameHit = false; break; }
  }
  let score = nameHit ? 5 : 0;
  let nameMatch = nameHit;
  let entityMatches = 0;
  for (const t of fingerprint) {
    // Do not double-count the room-name tokens as entity matches.
    if (nameTokens.indexOf(t) !== -1) continue;
    if (messageTokenSet.has(t)) {
      score += 1;
      entityMatches += 1;
    }
  }
  return { score: score, nameMatch: nameMatch, entityMatches: entityMatches };
}

// ---------------------------------------------------------------------------
// Message extraction
// ---------------------------------------------------------------------------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function extractMessage(raw) {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  // Try JSON first.
  let parsed = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch (_) { /* not json */ }
  if (parsed && typeof parsed === 'object') {
    const fields = ['user_message', 'prompt', 'message', 'text'];
    for (const f of fields) {
      const v = parsed[f];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    // Nested: some hook envelopes put the prompt in tool_input or payload.
    if (parsed.payload && typeof parsed.payload === 'object') {
      for (const f of fields) {
        const v = parsed.payload[f];
        if (typeof v === 'string' && v.length > 0) return v;
      }
    }
    return '';
  }
  // Raw text fallback.
  return trimmed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const start = Date.now();
  const deadline = start + BUDGET_MS;

  const raw = readStdinSync();
  const message = extractMessage(raw);
  if (!message) return 0;

  const root = resolveMindrianRoomsRoot();
  if (!root) return 0;

  const reg = readRegistry(root);
  const active = activeRoomFromRegistry(reg);
  const registered = registeredRoomNames(reg);

  if (Date.now() > deadline) return 0;

  const sealedRooms = discoverSealedRooms(root, deadline);
  if (Date.now() > deadline) return 0;

  // Deduplicate room corpus.
  const corpus = [];
  const seen = new Set();
  for (const name of registered.concat(sealedRooms)) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    corpus.push(name);
  }
  if (corpus.length === 0) return 0;

  const messageTokens = tokenize(message);
  if (messageTokens.length === 0) return 0;
  const messageTokenSet = new Set(messageTokens);

  let best = null;
  let activeScore = null;
  for (const roomName of corpus) {
    if (Date.now() > deadline) return 0;
    const fp = buildFingerprint(root, roomName, deadline);
    const s = scoreRoom(messageTokenSet, roomName, fp);
    if (roomName === active) {
      activeScore = s;
    }
    if (!best || s.score > best.score) {
      best = { name: roomName, score: s.score, nameMatch: s.nameMatch, entityMatches: s.entityMatches };
    }
  }

  if (!best || best.score === 0) return 0;
  if (active && best.name === active) return 0;

  // Tie-break: prefer active. If active has same score as best, silence.
  if (active && activeScore && activeScore.score >= best.score) return 0;

  // Weak-match silencing: a single 1-point entity match is not strong enough.
  if (!best.nameMatch && best.entityMatches < 2) return 0;

  const otherCount = best.score;
  const activeCountDisplay = activeScore ? activeScore.score : 0;
  const activeDisplay = active || '(none)';

  let warning =
    'Intent mismatch detected. User message contains ' + otherCount +
    ' tokens matching room ' + best.name + ', only ' + activeCountDisplay +
    ' matching active room ' + activeDisplay + '. ' +
    'Acknowledge the mismatch in your next reply. Confirm with the user ' +
    'whether to switch rooms before drafting any artifact related to ' +
    best.name + '.';

  if (sealedRooms.indexOf(best.name) !== -1) {
    warning += '\nNote: ' + best.name + ' is a sealed room. Any artifact ' +
      'related to it must be authored from inside that room (see 83-06).';
  }

  // 88.1-03: systemMessage retrofit. Emit a JSON envelope so Claude Code
  // 2.1.x renders a one-line status alongside the additionalContext
  // injection. LOCAL-only (Canon Part 8): room slugs only, no user prompt
  // text echoed. Silent on the happy path (no message when rooms match).
  const systemMessage = 'intent mismatch: suggested room ' + best.name +
    ' (score ' + otherCount + ') outweighs active room ' + activeDisplay +
    ' (score ' + activeCountDisplay + ')';
  const envelope = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: warning
    },
    systemMessage: systemMessage
  };
  try {
    process.stdout.write(JSON.stringify(envelope) + '\n');
  } catch (_e) {
    // Last-resort fallback: raw text (preserves pre-retrofit behavior).
    process.stdout.write(warning + '\n');
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Phase 84-06: graph-findings injection (env-gated, default ON)
//
// Reads the active room's .proactive-intelligence.json and writes the top 3
// non-suppressed insights to stdout as an additionalContext block. The block
// is appended after any topic-mismatch warning emitted by main().
//
// Kill switch: set MINDRIAN_COPILOT_INJECT_FINDINGS=0 for byte-identical
// Phase 83 behavior. Any non-zero/unset value enables injection.
//
// Hard cap of 3 findings IS the suppression mechanism (Dependabot lesson:
// push channels without built-in caps become noise). No config to raise it.
//
// Failure discipline: ALL errors swallowed silently. If anything goes wrong,
// nothing is written and the hook exits 0. The user prompt is never
// disrupted. Closes SCOPE-NB-08.
// ---------------------------------------------------------------------------

const FINDINGS_BUDGET_MS = 200;
const FINDINGS_RESERVED_MS = 50; // require >= 50ms remaining of the 200ms budget
const FINDINGS_SUPPRESS_THRESHOLD = 3; // mirrors lib/core/proactive-intelligence.cjs
const FINDINGS_CAP = 3;

function injectionEnabled() {
  const v = process.env.MINDRIAN_COPILOT_INJECT_FINDINGS;
  if (v === undefined || v === null || v === '') return true;
  if (v === '0' || v === 'false') return false;
  return true;
}

function confidenceRank(c) {
  if (typeof c !== 'string') return 0;
  const lc = c.toLowerCase();
  if (lc === 'high') return 3;
  if (lc === 'medium' || lc === 'med') return 2;
  if (lc === 'low') return 1;
  return 0;
}

function formatFinding(insight) {
  const type = (insight && typeof insight.type === 'string') ? insight.type : 'insight';
  const message = (insight && typeof insight.message === 'string') ? insight.message : '';
  return type + ': ' + message;
}

function injectGraphFindings(injectionStart) {
  // Budget guard: require enough remaining headroom of the 200ms budget.
  const elapsed = Date.now() - injectionStart;
  if (elapsed > (FINDINGS_BUDGET_MS - FINDINGS_RESERVED_MS)) return;

  const root = resolveMindrianRoomsRoot();
  if (!root) return;
  const reg = readRegistry(root);
  const active = activeRoomFromRegistry(reg);
  if (!active) return;

  const filePath = path.join(root, active, '.proactive-intelligence.json');
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return;
  }

  const insights = (data && Array.isArray(data.insights)) ? data.insights : [];
  if (insights.length === 0) return;

  // Filter: drop suppressed (times_shown >= threshold).
  const live = [];
  for (const ins of insights) {
    if (!ins || typeof ins !== 'object') continue;
    const shown = (typeof ins.times_shown === 'number') ? ins.times_shown : 0;
    if (shown >= FINDINGS_SUPPRESS_THRESHOLD) continue;
    live.push(ins);
  }
  if (live.length === 0) return;

  // Deterministic sort: confidence desc, then stable original order.
  // (Stable sort is guaranteed in V8 since Node 12.)
  const decorated = live.map(function (ins, idx) {
    return { ins: ins, idx: idx, rank: confidenceRank(ins.confidence) };
  });
  decorated.sort(function (a, b) {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.idx - b.idx;
  });

  const top = decorated.slice(0, FINDINGS_CAP);
  if (top.length === 0) return;

  // Re-check budget before writing; if we blew it, skip silently.
  if ((Date.now() - injectionStart) > (FINDINGS_BUDGET_MS - FINDINGS_RESERVED_MS)) return;

  const lines = ['## GRAPH FINDINGS (top 3)', ''];
  for (let i = 0; i < top.length; i++) {
    lines.push((i + 1) + '. ' + formatFinding(top[i].ins));
  }
  process.stdout.write(lines.join('\n') + '\n');
}

try {
  const injectionStart = Date.now();
  const code = main();
  if (injectionEnabled()) {
    try {
      injectGraphFindings(injectionStart);
    } catch (_) {
      // Fail-silent: never disrupt the prompt.
    }
  }
  process.exit(typeof code === 'number' ? code : 0);
} catch (_) {
  // Fail-silent on any unexpected error. Classifier is advisory.
  process.exit(0);
}
