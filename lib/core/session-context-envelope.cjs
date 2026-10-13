'use strict';
/**
 * lib/core/session-context-envelope.cjs (quick 261013-k1u, SEED-128 T14 and T23)
 *
 * Encodes the SessionStart hook envelope with JSON.stringify, so the hook
 * stdout is always valid JSON.
 *
 * Why this module exists (Canon Part 7, reuse before build): no lib/core
 * export strips ANSI codes, encodes a hook envelope or assembles a hook
 * context under a budget. lib/core/directive-envelope.cjs is the Brain
 * DirectiveEnvelope, a different contract.
 *
 * Why it matters: Claude Code 2.1.296 drops the whole session-start context
 * when the hook stdout is invalid JSON (debug entry X-1). The old bash
 * envelope passed ESC bytes from the Room Map and the EDGE lines into the
 * JSON string (debug entry I-1).
 *
 * scripts/session-start marks each block of its context with GS (0x1d), the
 * block id and GS. This module splits on those markers, sanitizes each block,
 * assembles the blocks under a budget and prints the envelope.
 *
 * Budget (SEED-128 T23): Claude Code 2.1.296 inlines at most 10,000
 * characters of one hook context and shows only a 2,407-character preview of
 * a longer one (debug entry X-2). assembleContext orders the blocks by value
 * (BLOCK_POLICY rank), keeps the required blocks in full, shortens or leaves
 * out the optional blocks to fit DEFAULT_BUDGET_CHARS, and ends with a
 * Pointers block. Every block is saved in full to the session context file
 * (--full-file), and the Pointers block names that file.
 *
 * CLI:
 *   node lib/core/session-context-envelope.cjs emit --shape hook|flat
 *        --system-message <text> [--full-file <path>] [--plugin-root <path>]
 *        [--budget <n>]
 * The context is read from stdin. On any error the CLI writes nothing to
 * stdout and exits 1, so the caller can use its bash fallback.
 *
 * Node built-ins only. Canon Part 8: no network, no Brain call.
 */

const fs = require('fs');
const path = require('path');

const MARKER = '\u001d';

// Claude Code 2.1.296 binary constant vRs=1e4: each hook additionalContext
// above this many characters (JS string length) is saved to a file and only
// a 2,407-character preview reaches the model (debug entry X-2).
const CLAUDE_CODE_INLINE_LIMIT = 10000;
// The inline budget: 1,000 characters below the Claude Code limit.
const DEFAULT_BUDGET_CHARS = 9000;
// Characters kept free for the Pointers block.
const POINTER_RESERVE_CHARS = 600;
// An optional piece with less room than this is left out, not cut.
const MIN_CUT_CHARS = 200;
// Added where an optional piece is cut.
const CUT_NOTE = '\n[... shortened here; the full block is in the session context file named under Pointers]';
// The room-state head (stage and counts) is at most this many characters.
const ROOM_STATE_HEAD_MAX = 600;

/**
 * Block policy (quick 261013-k1u plan, "Block policy"). Lower rank goes
 * first inline. A required block is always inline in full. An optional block
 * is transformed, then capped (cap in characters, null = no cap), then cut
 * or left out when the budget has no room. The label names the block in the
 * Pointers block and in the full session context file.
 * Final caps: see the quick 261013-k1u SUMMARY.
 */
const BLOCK_POLICY = Object.freeze({
  'identity':        Object.freeze({ rank: 0,  kind: 'required', cap: null, transform: null, label: 'Larry identity' }),
  'room-identity':   Object.freeze({ rank: 10, kind: 'required', cap: null, transform: null, label: 'active room and cross-room policy' }),
  'room-flag':       Object.freeze({ rank: 11, kind: 'required', cap: null, transform: null, label: 'active room flag' }),
  'room-state':      Object.freeze({ rank: 12, kind: 'required', cap: null, transform: null, label: 'room state (Room Map, section table, cross-references)' }),
  'cold-start':      Object.freeze({ rank: 12, kind: 'optional', cap: null, transform: null, label: 'session start instructions' }),
  'readiness':       Object.freeze({ rank: 13, kind: 'required', cap: null, transform: null, label: 'room readiness' }),
  'sealed-rooms':    Object.freeze({ rank: 14, kind: 'required', cap: null, transform: null, label: 'sealed rooms' }),
  'room-focus':      Object.freeze({ rank: 20, kind: 'optional', cap: 800, transform: null, label: 'focus sections' }),
  'other-rooms':     Object.freeze({ rank: 21, kind: 'optional', cap: 700, transform: null, label: 'other rooms card' }),
  'room-memory':     Object.freeze({ rank: 22, kind: 'optional', cap: 2800, transform: null, label: 'room memory (governing thoughts per section)' }),
  'mode-behavior':   Object.freeze({ rank: 25, kind: 'optional', cap: null, transform: null, label: 'mode instructions' }),
  'opp-bank':        Object.freeze({ rank: 30, kind: 'optional', cap: 400, transform: null, label: 'opportunity bank' }),
  'returning-user':  Object.freeze({ rank: 31, kind: 'optional', cap: 400, transform: null, label: 'returning user hint' }),
  'scratchpad':      Object.freeze({ rank: 32, kind: 'optional', cap: 600, transform: null, label: 'scratchpad' }),
  'nudges':          Object.freeze({ rank: 40, kind: 'optional', cap: 1000, transform: null, label: 'nudges' }),
  'proactive':       Object.freeze({ rank: 45, kind: 'optional', cap: 1200, transform: 'drop-edge-lines', label: 'proactive room intelligence' }),
  'recent-sessions': Object.freeze({ rank: 50, kind: 'optional', cap: 800, transform: null, label: 'recent sessions' }),
  'room-state-body': Object.freeze({ rank: 55, kind: 'optional', cap: 1200, transform: 'drop-box-lines', label: 'room state (Room Map, section table, cross-references)' }),
  'user-context':    Object.freeze({ rank: 60, kind: 'optional', cap: 600, transform: null, label: 'user context (USER.md)' }),
  'learnings':       Object.freeze({ rank: 65, kind: 'optional', cap: 500, transform: null, label: 'usage learnings' }),
  'ctx-budget':      Object.freeze({ rank: 70, kind: 'optional', cap: 300, transform: null, label: 'context budget' }),
  'integrations':    Object.freeze({ rank: 71, kind: 'optional', cap: 200, transform: null, label: 'integrations' }),
  'update-notice':   Object.freeze({ rank: 75, kind: 'optional', cap: 300, transform: null, label: 'update notice' }),
  'unmarked':        Object.freeze({ rank: 80, kind: 'optional', cap: 500, transform: null, label: 'other context' }),
  'doctrine':        Object.freeze({ rank: 90, kind: 'required', cap: null, transform: null, label: 'session doctrine' }),
});

// ANSI CSI: ESC [ parameter bytes 0x30-0x3F, intermediate bytes 0x20-0x2F, one final byte 0x40-0x7E.
const RE_CSI = /\u001b\[[\u0030-\u003f]*[\u0020-\u002f]*[\u0040-\u007e]/g;
// OSC: ESC ] up to BEL or ESC backslash.
const RE_OSC = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g;
// Any other ESC plus one byte 0x40-0x5F.
const RE_ESC_FE = /\u001b[\u0040-\u005f]/g;
// C0 characters other than TAB (0x09) and LF (0x0a), and DEL.
const RE_C0 = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Remove ANSI sequences and control characters. Keep LF and TAB.
 * The two-character sequence backslash-n stays as it is (debug entry I-8:
 * a global decode would break a Windows path such as C:\Users\nadia).
 */
function sanitizeText(text) {
  let s = String(text == null ? '' : text);
  s = s.replace(RE_CSI, '');
  s = s.replace(RE_OSC, '');
  s = s.replace(RE_ESC_FE, '');
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/\r/g, '');
  s = s.replace(RE_C0, '');
  return s;
}

/**
 * Split a marked context into blocks. A marker is GS, id, GS.
 * Text before the first marker gets the id "unmarked".
 * Returns [{ id, text }] in input order (empty unmarked text is dropped).
 */
function splitMarkedContext(raw) {
  const s = String(raw == null ? '' : raw);
  const parts = s.split(MARKER);
  const blocks = [];
  if (parts[0].length > 0) blocks.push({ id: 'unmarked', text: parts[0] });
  for (let i = 1; i + 1 < parts.length; i += 2) {
    blocks.push({ id: parts[i].trim() || 'unmarked', text: parts[i + 1] });
  }
  // An odd trailing piece (an unclosed marker) is kept as unmarked text.
  if (parts.length > 1 && parts.length % 2 === 0) {
    blocks.push({ id: 'unmarked', text: parts[parts.length - 1] });
  }
  return blocks;
}

/**
 * Build the envelope text: JSON.stringify(obj, null, 2) plus one line feed.
 * The key order and layout match the old bash printf envelope, so existing
 * regex extractors keep working.
 */
function buildEnvelope({ context, systemMessage, shape }) {
  const ctx = String(context == null ? '' : context);
  const sm = String(systemMessage == null ? '' : systemMessage);
  let obj;
  if (shape === 'flat') {
    obj = { additional_context: ctx, systemMessage: sm };
  } else {
    obj = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx }, systemMessage: sm };
  }
  return JSON.stringify(obj, null, 2) + '\n';
}

function policyFor(id) {
  if (id !== 'room-state-body' && Object.prototype.hasOwnProperty.call(BLOCK_POLICY, id)) return BLOCK_POLICY[id];
  return BLOCK_POLICY.unmarked; // unknown ids use the unmarked policy
}

function byRankThenOrder(a, b) {
  if (a.policy.rank !== b.policy.rank) return a.policy.rank - b.policy.rank;
  if (a.order !== b.order) return a.order - b.order;
  return (a.sub || 0) - (b.sub || 0);
}

/**
 * Split the room-state block. The head is the text before the first line that
 * starts with "# " (at most ROOM_STATE_HEAD_MAX characters, cut at a line
 * end). The body is the rest.
 */
function splitRoomState(text) {
  let idx = -1;
  if (text.startsWith('# ')) idx = 0;
  else {
    const m = /\n# /.exec(text);
    if (m) idx = m.index + 1;
  }
  let head = idx < 0 ? text : text.slice(0, idx);
  if (head.length > ROOM_STATE_HEAD_MAX) {
    const lf = head.lastIndexOf('\n', ROOM_STATE_HEAD_MAX - 1);
    head = lf > 0 ? head.slice(0, lf + 1) : head.slice(0, ROOM_STATE_HEAD_MAX);
  }
  return { head, body: text.slice(head.length) };
}

// Count the characters from U+2500 to U+257F (box drawing) in a line.
function boxCount(line) {
  let n = 0;
  for (const ch of line) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x2500 && cp <= 0x257f) n += 1;
  }
  return n;
}

function applyTransform(name, text) {
  switch (name) {
    case 'drop-edge-lines':
      return text.split('\n').filter((l) => !/^\s*EDGE:/.test(l)).join('\n');
    case 'drop-box-lines':
      return text.split('\n').filter((l) => boxCount(l) < 3).join('\n');
    default:
      return text;
  }
}

// Do not end a cut between the two halves of a surrogate pair.
function safeSliceEnd(text, end) {
  let e = Math.max(0, Math.min(end, text.length));
  if (e > 0 && e < text.length) {
    const c = text.charCodeAt(e - 1);
    if (c >= 0xd800 && c <= 0xdbff) e -= 1;
  }
  return e;
}

// Cut at the last line feed that keeps the piece plus the cut note within allowed.
function cutAtLine(text, allowed) {
  const limit = allowed - CUT_NOTE.length;
  let idx = text.lastIndexOf('\n', limit);
  if (idx <= 0) idx = safeSliceEnd(text, limit);
  return text.slice(0, idx) + CUT_NOTE;
}

function uniqueLabels(cut) {
  const seen = new Set();
  const out = [];
  for (const c of cut) {
    if (!seen.has(c.label)) { seen.add(c.label); out.push(c.label); }
  }
  return out;
}

function buildPointers(cut, o) {
  let s = '\n\n## Pointers\n- Full doctrine text: ' + o.doctrinePath;
  if (cut.length > 0) {
    const labels = uniqueLabels(cut).join(', ');
    if (o.fullFileSaved) {
      s += '\n- Full session context: ' + o.fullFilePath + '. Shortened or left out here: ' + labels
        + '. Read that file before you answer about room detail that is not shown above.';
    } else {
      s += '\n- The full session context could not be saved this session. Shortened or left out here: ' + labels + '.';
    }
  }
  return s;
}

// Walk the optional pieces by rank (Assembly rule 5).
function walkOptional(optional, available) {
  let avail = available;
  const inline = [];
  const cut = [];
  for (const p of optional) {
    const transformed = applyTransform(p.policy.transform, p.text);
    const removed = transformed.length < p.text.length;
    const cap = p.policy.cap == null ? Infinity : p.policy.cap;
    const allowed = Math.max(0, Math.min(cap, avail));
    if (transformed.length <= allowed) {
      inline.push({ policy: p.policy, order: p.order, sub: p.sub, text: transformed });
      avail -= transformed.length;
      if (removed) cut.push({ id: p.id, label: p.policy.label, how: 'shortened' });
    } else if (allowed >= MIN_CUT_CHARS) {
      const text = cutAtLine(transformed, allowed);
      inline.push({ policy: p.policy, order: p.order, sub: p.sub, text });
      avail -= text.length;
      cut.push({ id: p.id, label: p.policy.label, how: 'shortened' });
    } else {
      cut.push({ id: p.id, label: p.policy.label, how: 'left out' });
    }
  }
  return { inline, cut };
}

/**
 * Assemble the inline context under a budget (pure; no file write).
 * blocks: [{ id, text }] in append order (from splitMarkedContext).
 * opts: { budget, fullFilePath, fullFileSaved, doctrinePath }
 * Returns { inline, full, cut } where cut lists the pieces that were
 * shortened or left out ({ id, label, how }).
 */
function assembleContext(blocks, opts) {
  const o = Object.assign({}, opts || {});
  const budget = Number.isFinite(o.budget) && o.budget > 0 ? o.budget : DEFAULT_BUDGET_CHARS;
  const ptrOpts = {
    doctrinePath: o.doctrinePath || path.join('references', 'personality', 'session-start-doctrine.md'),
    fullFilePath: o.fullFilePath || null,
    fullFileSaved: Boolean(o.fullFilePath) && o.fullFileSaved !== false,
  };

  // 1. Merge every occurrence of one id into one block, in append order. Sanitize.
  const merged = [];
  const byId = new Map();
  for (const b of blocks || []) {
    const id = String((b && b.id) || 'unmarked');
    if (!byId.has(id)) {
      const m = { id, policy: policyFor(id), text: '', order: merged.length };
      byId.set(id, m);
      merged.push(m);
    }
    byId.get(id).text += sanitizeText(b && b.text);
  }

  // 2. Expand room-state into its head piece and its body piece.
  const pieces = [];
  for (const m of merged) {
    if (m.id === 'room-state') {
      const rs = splitRoomState(m.text);
      pieces.push({ id: 'room-state', policy: BLOCK_POLICY['room-state'], text: rs.head, order: m.order, sub: 0 });
      if (rs.body) pieces.push({ id: 'room-state-body', policy: BLOCK_POLICY['room-state-body'], text: rs.body, order: m.order, sub: 1 });
    } else {
      pieces.push({ id: m.id, policy: m.policy, text: m.text, order: m.order, sub: 0 });
    }
  }
  const live = pieces.filter((p) => p.text.length > 0);

  // 3. Required pieces inline in full.
  const required = live.filter((p) => p.policy.kind === 'required');
  const optional = live.filter((p) => p.policy.kind !== 'required').sort(byRankThenOrder);
  const requiredLen = required.reduce((n, p) => n + p.text.length, 0);

  // 4 to 7. Walk the optional pieces; widen the pointer reserve when the
  // Pointers block itself is longer than the reserve.
  let reserve = POINTER_RESERVE_CHARS;
  let body = '';
  let cut = [];
  let pointers = '';
  for (let pass = 0; pass < 4; pass++) {
    const walked = walkOptional(optional, budget - requiredLen - reserve);
    const inlinePieces = required.map((p) => ({ policy: p.policy, order: p.order, sub: p.sub, text: p.text }))
      .concat(walked.inline)
      .sort(byRankThenOrder);
    body = inlinePieces.map((p) => p.text).join('');
    cut = walked.cut;
    pointers = buildPointers(cut, ptrOpts);
    const over = body.length + pointers.length - budget;
    if (over <= 0 || walked.inline.length === 0) break;
    reserve += over;
  }

  // 8. Required pieces too large: hard-cut the joined pieces at a line end.
  if (body.length + pointers.length > budget) {
    cut = cut.concat([{ id: 'required-overflow', label: 'the end of the required blocks', how: 'shortened' }]);
    pointers = buildPointers(cut, ptrOpts);
    const room = Math.max(0, budget - pointers.length);
    let idx = body.lastIndexOf('\n', room);
    if (idx <= 0) idx = safeSliceEnd(body, room);
    body = body.slice(0, idx);
    if (body.length + pointers.length > budget) {
      // A Pointers block alone above the budget: keep the head of the joined text.
      const all = body + pointers;
      body = all.slice(0, safeSliceEnd(all, budget));
      pointers = '';
    }
  }

  // 9. The full text: a 2-line header, then every block in rank order.
  const header = 'MindrianOS session context, written by scripts/session-start at ' + new Date().toISOString() + '.\n'
    + 'The inline SessionStart context is capped at ' + budget + ' characters; this file holds every block in full.\n';
  const fullBlocks = merged.slice().sort(byRankThenOrder)
    .filter((m) => m.text.length > 0)
    .map((m) => '\n===== ' + m.policy.label + ' =====\n' + m.text + '\n');
  const full = header + fullBlocks.join('');

  return { inline: body + pointers, full, cut };
}

/**
 * Write the full session context atomically (temp file in the same
 * directory, then rename). Returns true or false. Never throws.
 */
function writeFullContext(filePath, text) {
  let tmp = null;
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    tmp = filePath + '.tmp-' + process.pid + '-' + Date.now();
    fs.writeFileSync(tmp, text);
    fs.renameSync(tmp, filePath);
    return true;
  } catch (_e) {
    if (tmp) { try { fs.unlinkSync(tmp); } catch (_e2) { /* best effort */ } }
    return false;
  }
}

function parseArgs(argv) {
  const out = { shape: 'hook', systemMessage: '', fullFile: null, pluginRoot: null, budget: DEFAULT_BUDGET_CHARS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--shape': out.shape = argv[++i]; break;
      case '--system-message': out.systemMessage = argv[++i]; break;
      case '--full-file': out.fullFile = argv[++i]; break;
      case '--plugin-root': out.pluginRoot = argv[++i]; break;
      case '--budget': out.budget = parseInt(argv[++i], 10); break;
      default: throw new Error('unknown argument: ' + a);
    }
  }
  if (out.shape !== 'hook' && out.shape !== 'flat') throw new Error('bad --shape: ' + out.shape);
  if (out.systemMessage == null) throw new Error('missing --system-message value');
  if (!Number.isFinite(out.budget) || out.budget < 1000) throw new Error('bad --budget');
  return out;
}

function emit(argv) {
  const args = parseArgs(argv);
  const raw = fs.readFileSync(0, 'utf8');
  const blocks = splitMarkedContext(raw);
  const pluginRoot = args.pluginRoot || path.resolve(__dirname, '..', '..');
  const assembleOpts = {
    budget: args.budget,
    fullFilePath: args.fullFile,
    doctrinePath: path.join(pluginRoot, 'references', 'personality', 'session-start-doctrine.md'),
  };
  let result = assembleContext(blocks, assembleOpts);
  if (args.fullFile) {
    const saved = writeFullContext(args.fullFile, result.full);
    if (!saved) result = assembleContext(blocks, Object.assign({}, assembleOpts, { fullFileSaved: false }));
  }
  return buildEnvelope({ context: result.inline, systemMessage: sanitizeText(args.systemMessage), shape: args.shape });
}

function main(argv) {
  const cmd = argv[0];
  switch (cmd) {
    case 'emit': {
      const text = emit(argv.slice(1));
      process.stdout.write(text);
      return 0;
    }
    default:
      process.stderr.write('usage: session-context-envelope.cjs emit --shape hook|flat --system-message <text> [--full-file <path>] [--plugin-root <path>] [--budget <n>]\n');
      return 1;
  }
}

module.exports = {
  MARKER,
  CLAUDE_CODE_INLINE_LIMIT,
  DEFAULT_BUDGET_CHARS,
  POINTER_RESERVE_CHARS,
  MIN_CUT_CHARS,
  CUT_NOTE,
  BLOCK_POLICY,
  sanitizeText,
  splitMarkedContext,
  buildEnvelope,
  assembleContext,
  writeFullContext,
};

if (require.main === module) {
  let code = 1;
  try {
    code = main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write('session-context-envelope: ' + ((e && e.message) || e) + '\n');
    code = 1;
  }
  process.exitCode = code;
}
