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
const crypto = require('node:crypto');

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

// Phase 91-02: stdin is read ONCE at module-init time so the engine
// integration block can short-circuit on empty messages. The original
// Phase 83 main() reads it again, but readStdinSync of fd 0 returns ''
// on second call (EOF) -- which is fine because main() also early-
// exits on empty message. We pass the raw stdin in via module scope.
const STDIN_RAW = readStdinSync();
const STDIN_MESSAGE = extractMessage(STDIN_RAW);

function main() {
  const start = Date.now();
  const deadline = start + BUDGET_MS;

  const message = STDIN_MESSAGE;
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

// ---------------------------------------------------------------------------
// Phase 91-02: Navigation Engine integration block.
//
// On every UserPromptSubmit hook invocation we resolve the active section,
// read the quadruple + USER.md, call navigation-engine.decide() with a
// 1200ms hard timeout, persist a decision_trace under
// .mindrian/decision-traces/<session-id>.json (atomic + 50-entry rotation),
// and emit a NAVIGATION DECISION (engine v1) block to additionalContext.
//
// Canon Part 8 (Graph Boundary): this block is LOCAL-only. brainAvailable
// is hard-coded to false in Wave 1; Plan 91-07 (Wave 3) opts into the
// scalar brain-client.isAvailable() handle. ZERO Brain network surface
// is added here. The decision-trace JSON file is LOCAL.
//
// Risk 2 mitigation (engine latency): Promise.race against a 1200ms
// timeout leaves 800ms hook headroom before the 2000ms ceiling fires.
// Risk 6 mitigation (trace budget): persisted to disk, rotated at 50
// entries (drop oldest 10), atomic tmp+rename writes.
//
// Failure discipline: any throw or timeout inside this block returns null
// engineDecision. The Phase 83 classifier flow continues unchanged. No
// stderr noise on the happy or failure path.
// ---------------------------------------------------------------------------

const NAV_HARD_TIMEOUT_MS = 1200;
const TRACE_ROTATE_AT = 50;
const TRACE_KEEP_AFTER_ROTATE = 40;

function resolveActiveSectionPathForRoom(roomDir) {
  if (!roomDir) return null;
  try {
    const activeJson = path.join(roomDir, '.mindrian', 'active-section.json');
    if (fs.existsSync(activeJson)) {
      try {
        const data = JSON.parse(fs.readFileSync(activeJson, 'utf8'));
        if (data && typeof data.section === 'string' && data.section.length > 0) {
          const candidate = path.isAbsolute(data.section)
            ? data.section
            : path.join(roomDir, data.section);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            return candidate;
          }
        }
      } catch (_e) { /* fall through */ }
    }
  } catch (_e) {}
  // Fallback: most-recently-modified subdir containing MINTO.md.
  try {
    const entries = fs.readdirSync(roomDir, { withFileTypes: true })
      .filter(function (d) { return d.isDirectory() && !d.name.startsWith('.'); });
    let best = null;
    let bestMtime = 0;
    for (const d of entries) {
      const sectionPath = path.join(roomDir, d.name);
      const mintoPath = path.join(sectionPath, 'MINTO.md');
      try {
        if (!fs.existsSync(mintoPath)) continue;
        const st = fs.statSync(mintoPath);
        if (st.mtimeMs > bestMtime) {
          bestMtime = st.mtimeMs;
          best = sectionPath;
        }
      } catch (_e) {}
    }
    return best;
  } catch (_e) {
    return null;
  }
}

function resolveRoomsRootForNav() {
  // Wider env-var acceptance than Phase 83 resolveMindrianRoomsRoot.
  // Phase 83 uses MINDRIAN_ROOMS_ROOT; resolve-room (the bash sibling)
  // uses MINDRIAN_ROOMS_HOME. The Phase 91 hot path accepts either so
  // tests + bash + node converge on the same fixture without divergent
  // env conventions.
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  const envHome = process.env.MINDRIAN_ROOMS_HOME;
  if (envHome && fs.existsSync(envHome)) return envHome;
  return resolveMindrianRoomsRoot();
}

function resolveActiveRoomDir() {
  const root = resolveRoomsRootForNav();
  if (!root) return null;
  const reg = readRegistry(root);
  if (!reg) return null;
  const active = activeRoomFromRegistry(reg);
  if (!active) return null;
  // Registry entries may carry a "path" field (relative or absolute).
  // Default: <root>/<active-name>.
  let candidate = path.join(root, active);
  try {
    if (reg.rooms && typeof reg.rooms === 'object' && reg.rooms[active]) {
      const meta = reg.rooms[active];
      if (meta && typeof meta.path === 'string' && meta.path.length > 0) {
        candidate = path.isAbsolute(meta.path)
          ? meta.path
          : path.join(root, meta.path);
      }
    }
  } catch (_) { /* fall back to default */ }
  try {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  } catch (_) {}
  return null;
}

function resolveSessionId(roomDir) {
  const env = process.env.CLAUDE_SESSION_ID;
  if (typeof env === 'string' && env.length > 0) return env;
  // Fallback: sha256(roomDir + ISO-date).slice(0,12). Date precision day
  // means same room on same day shares a session file when the env hint
  // is missing -- acceptable per the plan's Section "Session ID
  // resolution".
  try {
    const day = new Date().toISOString().slice(0, 10);
    return crypto.createHash('sha256').update((roomDir || '') + day)
      .digest('hex').slice(0, 12);
  } catch (_) {
    return 'unknown';
  }
}

function persistDecisionTrace(roomDir, sessionId, traceEntry) {
  // Fire-and-forget. Any error is swallowed; the engine block never
  // disrupts the user prompt.
  try {
    const dir = path.join(roomDir, '.mindrian', 'decision-traces');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    const filePath = path.join(dir, sessionId + '.json');
    let data = { version: 1, session_id: sessionId, traces: [] };
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.traces)) {
        data = parsed;
        if (data.session_id !== sessionId) data.session_id = sessionId;
        if (data.version !== 1) data.version = 1;
      }
    } catch (_) { /* first write OR corruption -> reset */ }
    data.traces.push(traceEntry);
    // Rotate per Plan 91-02 contract: when length exceeds 50, drop the
    // oldest 10 entries before write. Result: keep last 40 + the just-
    // pushed current = 41 entries on disk after a rotation event.
    if (data.traces.length > TRACE_ROTATE_AT) {
      data.traces = data.traces.slice(10);
    }
    // Atomic tmp + rename. Defensive open with 'wx' to fail-fast on
    // stale tmp.
    const rnd = Math.random().toString(36).slice(2, 10);
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + rnd + '.trace';
    let fd;
    try {
      fd = fs.openSync(tmpPath, 'wx');
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        fd = fs.openSync(tmpPath, 'wx');
      } else {
        return;
      }
    }
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2));
      try { fs.fsyncSync(fd); } catch (_) {
        // ENOTSUP on tmpfs / overlayfs / Windows ImDisk. Best-effort
        // durability is acceptable for decision-trace.
      }
    } finally {
      try { fs.closeSync(fd); } catch (_) {}
    }
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (_) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (_) { /* fire-and-forget */ }
}

function formatEngineDecisionBlock(decision, routing, offerLine) {
  if (!decision || typeof decision !== 'object') return '';
  const trace = decision.decision_trace || {};
  const fireSkill = decision.fire_skill === null || decision.fire_skill === undefined
    ? 'null' : String(decision.fire_skill);
  const suppressSkills = Array.isArray(decision.suppress_skills)
    ? '[' + decision.suppress_skills.join(', ') + ']'
    : '[]';
  let offer = 'null';
  if (decision.offer_next_step && typeof decision.offer_next_step === 'object') {
    const cmd = decision.offer_next_step.command || '';
    const reason = decision.offer_next_step.reason || '';
    offer = '{command: ' + cmd + ', reason: ' + reason + '}';
  }
  let persona = 'null';
  if (decision.persona_updates && typeof decision.persona_updates === 'object') {
    const pu = decision.persona_updates;
    persona = '{archetype: ' + (pu.archetype || 'null')
      + ', problem_type: ' + (pu.problem_type || 'null')
      + ', venture_stage: ' + (pu.venture_stage || 'null') + '}';
  }
  const tierMode = trace.brain_md_tier_mode || 'tier_0';
  const recommended = trace.brain_md_recommended_marker_rendered === true
    ? 'true' : 'false';
  const why = trace.chosen_rationale || '';
  const lines = [
    '## NAVIGATION DECISION (engine v1)',
    '',
    'fire_skill: ' + fireSkill,
    'suppress_skills: ' + suppressSkills,
    'offer_next_step: ' + offer,
    'persona_updates: ' + persona,
    'tier_mode: ' + tierMode,
    'brain_md_recommended_marker_rendered: ' + recommended,
  ];
  // Phase 91-03: append router output (routing_source + activated_skills)
  // when the caller has computed it. Two new lines summarize which
  // activation set won (engine vs legacy vs mixed) and which skills are
  // active for this turn after composition.
  if (routing && typeof routing === 'object') {
    const routingSource = typeof routing.source === 'string' ? routing.source : 'legacy';
    const activated = Array.isArray(routing.activated_skills)
      ? '[' + routing.activated_skills.join(', ') + ']'
      : '[]';
    lines.push('activated_skills: ' + activated);
    lines.push('routing_source: ' + routingSource);
  }
  lines.push('');
  lines.push('Why: ' + why);
  // Phase 91-04: append the offer-presenter output (one-line grounded
  // suggestion, optional RECOMMENDED marker) after the Why line so it
  // is the LAST thing Larry sees in additionalContext. Skipped when
  // null (offer suppressed by grounding rule, per-turn cap, or
  // consecutive-ignore window).
  if (typeof offerLine === 'string' && offerLine.length > 0) {
    lines.push('');
    lines.push(offerLine);
  }
  return lines.join('\n');
}

function navTestSleepMs() {
  const v = process.env.MOS_NAV_TEST_SLEEP;
  if (!v) return 0;
  const n = parseInt(v, 10);
  if (!isNaN(n) && n > 0) return n;
  return 0;
}

function navTestThrowing() {
  return process.env.MOS_NAV_TEST_THROW === '1';
}

// Phase 91-03: integration test stub for engine output. When set, the
// run-navigation-engine path overrides the decision's fire_skill (and
// optionally suppress_skills) so end-to-end tests can exercise the
// router without mocking the engine module. Production behavior is
// unchanged when env vars are unset (string equality, never coerced
// from absent values).
//   MOS_NAV_TEST_FIRE_SKILL=<verb>          -> set decision.fire_skill
//   MOS_NAV_TEST_FIRE_SKILL=__NULL__        -> force decision.fire_skill = null
//   MOS_NAV_TEST_SUPPRESS_SKILLS=a,b,c      -> set decision.suppress_skills (csv)
function navTestFireSkill() {
  const v = process.env.MOS_NAV_TEST_FIRE_SKILL;
  if (typeof v !== 'string' || v.length === 0) return undefined;
  if (v === '__NULL__') return null;
  return v;
}

function navTestSuppressSkills() {
  const v = process.env.MOS_NAV_TEST_SUPPRESS_SKILLS;
  if (typeof v !== 'string' || v.length === 0) return undefined;
  return v.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
}

// Phase 91-04: integration test stubs for offer_next_step. Injected
// AFTER decide() returns so end-to-end tests can exercise the offer
// presenter without mocking the engine module. Mirrors Plan 91-03's
// MOS_NAV_TEST_FIRE_SKILL pattern. Production behavior is unchanged
// when env vars are unset.
//   MOS_NAV_TEST_OFFER_COMMAND=<cmd>     -> set decision.offer_next_step.command
//   MOS_NAV_TEST_OFFER_COMMAND=__NULL__  -> force decision.offer_next_step = null
//   MOS_NAV_TEST_OFFER_REASON=<reason>   -> set decision.offer_next_step.reason
function navTestOfferCommand() {
  const v = process.env.MOS_NAV_TEST_OFFER_COMMAND;
  if (typeof v !== 'string' || v.length === 0) return undefined;
  if (v === '__NULL__') return null;
  return v;
}

function navTestOfferReason() {
  const v = process.env.MOS_NAV_TEST_OFFER_REASON;
  if (typeof v !== 'string' || v.length === 0) return undefined;
  return v;
}

// Phase 91-03: compute the pre-91 (legacy) skill activation set based
// on observable file-state and env-var toggles. The router composes
// this with the engine decision per Canon Part 7 (Reuse Before Build):
// when engine is silent, this is the activation that fires; when
// engine is opinionated, this is the input the suppress list operates
// on. Skills observed:
//   - larry-personality      always-on (no activation directive)
//   - context-engine         always-on (no activation directive)
//   - room-passive           when active room resolves
//   - room-proactive         when active room resolves
// Env-var toggles honored:
//   MOS_NO_SKILL_<name>=1     -> remove from set
//   MOS_FORCE_SKILL_<name>=1  -> add to set even if file-state misses
function computeLegacyActivation(roomDir) {
  const set = [];
  const seen = new Set();
  function add(name) {
    if (typeof name !== 'string' || name.length === 0) return;
    if (seen.has(name)) return;
    if (process.env['MOS_NO_SKILL_' + name] === '1') return;
    seen.add(name);
    set.push(name);
  }
  add('larry-personality');
  add('context-engine');
  if (roomDir) {
    add('room-passive');
    add('room-proactive');
  }
  // FORCE_SKILL allows enabling a skill that file-state would not
  // activate. Iterate env keys looking for the prefix.
  for (const key of Object.keys(process.env)) {
    if (key.indexOf('MOS_FORCE_SKILL_') === 0 && process.env[key] === '1') {
      add(key.slice('MOS_FORCE_SKILL_'.length));
    }
  }
  return set;
}

function navTestCounterPath() {
  const v = process.env.MOS_NAV_TEST_COUNTER;
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

function bumpReadCounter(counterFile) {
  if (!counterFile) return;
  try {
    let n = 0;
    try {
      const raw = fs.readFileSync(counterFile, 'utf8');
      const parsed = parseInt(String(raw).trim(), 10);
      if (!isNaN(parsed)) n = parsed;
    } catch (_) {}
    n += 1;
    try { fs.mkdirSync(path.dirname(counterFile), { recursive: true }); } catch (_) {}
    fs.writeFileSync(counterFile, String(n));
  } catch (_) { /* counter is best-effort */ }
}

function deferredSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function callDecideWithTimeout(decideFn, turn, ctx, hardTimeoutMs) {
  // Promise.race: decide() runs synchronously and returns its result;
  // we wrap it in a microtask so race can compete cleanly. The sleep
  // arm resolves to a sentinel symbol so we can distinguish timeout.
  const TIMEOUT_SENTINEL = '__nav_timeout__';
  const decidePromise = new Promise(function (resolve) {
    // Honor MOS_NAV_TEST_SLEEP by deferring decide() execution.
    const sleepMs = navTestSleepMs();
    const launch = function () {
      try {
        const result = decideFn(turn, ctx);
        resolve(result);
      } catch (e) {
        // Throws inside decide become structured engine_fault decisions
        // upstream; if it bubbled here treat as null fallback.
        resolve(null);
      }
    };
    if (sleepMs > 0) {
      setTimeout(launch, sleepMs);
    } else {
      // Defer to next microtask so Promise.race actually races.
      setImmediate(launch);
    }
  });
  const timeoutPromise = deferredSleep(hardTimeoutMs).then(function () {
    return TIMEOUT_SENTINEL;
  });
  return Promise.race([decidePromise, timeoutPromise]).then(function (val) {
    if (val === TIMEOUT_SENTINEL) return null;
    return val;
  });
}

function runNavigationEngine(roomDir, sessionId) {
  // Returns Promise<{decision, elapsed_ms} | null>. Never throws.
  return new Promise(function (resolve) {
    const startedAt = Date.now();
    try {
      // Test-only fast paths.
      if (navTestThrowing()) {
        return resolve(null);
      }
      // Lazy-require so missing deps in Tier 0 environments do not blow
      // up the classifier hot path.
      let navEngine;
      let folderMemory;
      let userMdOps;
      try {
        navEngine = require(
          path.join(__dirname, '..', 'lib', 'core', 'navigation-engine.cjs')
        );
        folderMemory = require(
          path.join(__dirname, '..', 'lib', 'core', 'folder-memory.cjs')
        );
        userMdOps = require(
          path.join(__dirname, '..', 'lib', 'core', 'user-md-ops.cjs')
        );
      } catch (_e) {
        return resolve(null);
      }

      const sectionPath = resolveActiveSectionPathForRoom(roomDir);
      if (!sectionPath) {
        // No section to read; engine returns Tier 0 fallback. Still
        // useful to emit + persist so /mos:explain-decision has a row.
      }

      // Per-turn quadruple cache: a single read, observed by tests via
      // MOS_NAV_TEST_COUNTER.
      let quadruple = null;
      if (sectionPath) {
        const counterFile = navTestCounterPath();
        bumpReadCounter(counterFile);
        try {
          quadruple = folderMemory.readQuadruple(sectionPath);
        } catch (_e) {
          quadruple = null;
        }
      }

      // USER.md persona read (graceful on absent / malformed).
      let userMd = null;
      try {
        const userPath = path.join(roomDir, 'USER.md');
        userMd = userMdOps.readUserMd(userPath);
      } catch (_e) {
        userMd = null;
      }

      // Build context.userPersona shape expected by the engine's
      // buildIntentPersona reader (Plan 91-00).
      let userPersona = null;
      if (userMd && typeof userMd === 'object') {
        userPersona = {
          archetype: userMd.canonical_role || null,
          problem_type: userMd.problem_type === 'unknown' ? null : userMd.problem_type,
          venture_stage: userMd.venture_stage === 'unknown' ? null : userMd.venture_stage,
        };
      }

      const turn = {
        userText: null, // hot path does not forward prompt content
        sectionPath: sectionPath,
        sessionId: sessionId,
      };
      const context = {
        quadruple: quadruple,
        brainAvailable: false, // Wave 1 is LOCAL-only per Canon Part 8
        userPersona: userPersona,
        intentSignal: null,
      };

      callDecideWithTimeout(navEngine.decide, turn, context, NAV_HARD_TIMEOUT_MS)
        .then(function (decision) {
          if (decision === null || decision === undefined) {
            return resolve(null);
          }
          // Phase 91-03 integration test stubs: when MOS_NAV_TEST_FIRE_SKILL
          // is set, override the engine's fire_skill so the router can be
          // exercised end-to-end without mocking the engine module. The
          // env vars are never set in production.
          const stubFire = navTestFireSkill();
          if (stubFire !== undefined) {
            decision.fire_skill = stubFire;
          }
          const stubSuppress = navTestSuppressSkills();
          if (stubSuppress !== undefined) {
            decision.suppress_skills = stubSuppress;
          }
          // Phase 91-04: offer_next_step stub injection.
          const stubOfferCmd = navTestOfferCommand();
          if (stubOfferCmd !== undefined) {
            if (stubOfferCmd === null) {
              decision.offer_next_step = null;
            } else {
              const stubOfferReason = navTestOfferReason();
              decision.offer_next_step = {
                command: stubOfferCmd,
                reason: typeof stubOfferReason === 'string' ? stubOfferReason : '',
              };
            }
          }
          const elapsedMs = Date.now() - startedAt;
          resolve({ decision: decision, elapsed_ms: elapsedMs });
        })
        .catch(function () { resolve(null); });
    } catch (_e) {
      resolve(null);
    }
  });
}

function emitEngineDecisionBlock(roomDir, sessionId) {
  // Synchronous-from-caller wrapper that drives the async engine and
  // blocks the event loop only as long as the hard timeout. Used at the
  // tail of the classifier process so the user turn never proceeds
  // without the decision in hand.
  const result = runNavigationEngine(roomDir, sessionId);
  // Bridge promise to sync exit by pumping the event loop. Node 18+
  // does not expose deasync; we rely on process.exit happening from a
  // .then callback below. The function returns the promise; caller
  // awaits before exiting.
  return result;
}

function appendTraceTurnNumber(roomDir, sessionId) {
  // Compute next turn number based on existing trace file.
  try {
    const filePath = path.join(roomDir, '.mindrian', 'decision-traces', sessionId + '.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.traces) && parsed.traces.length > 0) {
      const last = parsed.traces[parsed.traces.length - 1];
      if (last && typeof last.turn === 'number') return last.turn + 1;
    }
  } catch (_) {}
  return 1;
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
  // Phase 91-02 navigation engine block (always LAST so the decision
  // appears below any Phase 83 / Phase 84 emissions in additionalContext).
  // Skipped on empty stdin to preserve Phase 83's silent-exit contract;
  // the engine has no useful turn to decide on an empty message.
  let navP = Promise.resolve(null);
  try {
    if (STDIN_MESSAGE && STDIN_MESSAGE.length > 0) {
    const roomDir = resolveActiveRoomDir();
    if (roomDir) {
      const sessionId = resolveSessionId(roomDir);
      navP = emitEngineDecisionBlock(roomDir, sessionId).then(function (out) {
        if (!out || !out.decision) return null;
        // Phase 91-03: compose engine decision with legacy file-state +
        // env activation through the skill-activation-router. The router
        // enforces Canon Part 3 closed 10-verb vocabulary on engine
        // outputs and falls back to legacy when engine is silent.
        // Lazy-require so missing module degrades gracefully (the engine
        // block still emits with routing absent).
        let routing = null;
        try {
          const router = require(
            path.join(__dirname, '..', 'lib', 'core', 'skill-activation-router.cjs')
          );
          const legacyActivation = computeLegacyActivation(roomDir);
          routing = router.routeActivation(out.decision, legacyActivation);
        } catch (_e) {
          routing = null;
        }

        // Phase 91-04: offer presenter integration.
        //
        // Step 1 (close the ignore-loop on the previous turn): if the
        // most recent history entry is 'shown' for this same session,
        // reclassify it as 'acted' (user invoked the suggested command)
        // or 'ignored' (user did not). This is the simple Wave-1
        // heuristic from PLAN: classifyTurnOutcome on the previous
        // 'shown' record using the current STDIN_MESSAGE.
        //
        // Step 2 (present this turn's offer if any): call presentOffer
        // and, when an offer renders, record a 'shown' outcome so the
        // next turn can reclassify it. If the engine returned null
        // offer or grounding rejected it, no shown record is written.
        //
        // Lazy-require so missing module degrades gracefully (the
        // engine + routing block still emits with no Offer line).
        let offerLine = null;
        try {
          const presenter = require(
            path.join(__dirname, '..', 'lib', 'core', 'offer-presenter.cjs')
          );

          // Step 1: reclassify previous 'shown' record (if any) using
          // the user's current message as the acted/ignored signal.
          try {
            const history = presenter.readOfferHistory(roomDir);
            const arr = (history && Array.isArray(history.history)) ? history.history : [];
            // Walk backwards to find the most recent entry for this
            // session; reclassify if and only if its outcome is 'shown'.
            for (let i = arr.length - 1; i >= 0; i -= 1) {
              const e = arr[i];
              if (!e || typeof e !== 'object') continue;
              if (e.session_id === sessionId && e.outcome === 'shown') {
                const newOutcome = presenter.classifyTurnOutcome(
                  { command: e.command }, STDIN_MESSAGE
                );
                // In-place update + atomic rewrite.
                e.outcome = newOutcome;
                try {
                  const fp = path.join(roomDir, '.mindrian', 'offer-history.json');
                  const tmpDir = path.join(roomDir, '.mindrian');
                  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (_) {}
                  const rnd = Math.random().toString(36).slice(2, 10);
                  const tmpPath = fp + '.tmp.' + process.pid + '.' + rnd;
                  fs.writeFileSync(tmpPath, JSON.stringify(history, null, 2));
                  fs.renameSync(tmpPath, fp);
                } catch (_) { /* best-effort reclassification */ }
                break;
              }
              // Stop walking once we hit any non-'shown' entry for this
              // session (older turns are already classified).
              if (e.session_id === sessionId) break;
            }
          } catch (_) { /* ignore-loop is best-effort */ }

          // Step 2: present this turn's offer (if engine produced one).
          let history2;
          try { history2 = presenter.readOfferHistory(roomDir); } catch (_) {
            history2 = { version: 1, history: [] };
          }
          const sessionCtx = { offeredThisTurn: false, sessionId: sessionId };
          let presented;
          try {
            presented = presenter.presentOffer(out.decision, history2, sessionCtx);
          } catch (_) { presented = null; }
          if (presented && typeof presented.offerLine === 'string' && presented.offerLine.length > 0) {
            offerLine = presented.offerLine;
            // Record 'shown' so next turn can reclassify.
            try {
              const offer = (out.decision && out.decision.offer_next_step) || {};
              presenter.recordOfferOutcome(roomDir, {
                outcome: 'shown',
                session_id: sessionId,
                command: typeof offer.command === 'string' ? offer.command : null,
                reason: typeof offer.reason === 'string' ? offer.reason : null,
              });
            } catch (_) { /* fire-and-forget */ }
          }
        } catch (_e) {
          offerLine = null;
        }

        // Compose trace entry. Persist routing source/notes alongside
        // engine trace so /mos:explain-decision (Plan 91-05) surfaces
        // which activation set won.
        const turnNo = appendTraceTurnNumber(roomDir, sessionId);
        const baseTrace = (out.decision && out.decision.decision_trace) || {};
        const traceEntry = Object.assign({}, baseTrace, {
          turn: turnNo,
          at: new Date().toISOString(),
          elapsed_ms: out.elapsed_ms,
        });
        if (routing && typeof routing === 'object') {
          traceEntry.routing_source = routing.source;
          traceEntry.routing_reason = routing.reason;
          traceEntry.routing_activated_skills = routing.activated_skills;
          traceEntry.routing_suppressed_skills = routing.suppressed_skills;
          if (Array.isArray(routing.trace_notes) && routing.trace_notes.length > 0) {
            traceEntry.routing_trace_notes = routing.trace_notes;
          }
        }
        // Phase 91-04: persist the rendered offer line (or null) into
        // the decision trace for /mos:explain-decision (Plan 91-05).
        if (typeof offerLine === 'string' && offerLine.length > 0) {
          traceEntry.offer_rendered = offerLine;
        }
        persistDecisionTrace(roomDir, sessionId, traceEntry);
        // Emit additionalContext block.
        const block = formatEngineDecisionBlock(out.decision, routing, offerLine);
        if (block && block.length > 0) {
          try { process.stdout.write(block + '\n'); } catch (_) {}
        }
        return null;
      }).catch(function () { return null; });
    }
    }
  } catch (_) { /* engine block is fire-and-forget */ }
  // Wait for engine to settle (bounded by NAV_HARD_TIMEOUT_MS) before
  // exiting so the additionalContext write lands before stdout closes.
  navP.then(function () {
    process.exit(typeof code === 'number' ? code : 0);
  }, function () {
    process.exit(typeof code === 'number' ? code : 0);
  });
} catch (_) {
  // Fail-silent on any unexpected error. Classifier is advisory.
  process.exit(0);
}
