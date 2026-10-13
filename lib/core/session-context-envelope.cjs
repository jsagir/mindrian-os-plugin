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
 * block id and GS. This module splits on those markers, sanitizes each block
 * and prints the envelope.
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

const MARKER = '\u001d';

// Claude Code 2.1.296 binary constant vRs=1e4: each hook additionalContext
// above this many characters (JS string length) is saved to a file and only
// a 2,407-character preview reaches the model (debug entry X-2).
const CLAUDE_CODE_INLINE_LIMIT = 10000;
// The inline budget: 1,000 characters below the Claude Code limit.
const DEFAULT_BUDGET_CHARS = 9000;
// Characters kept free for the Pointers block.
const POINTER_RESERVE_CHARS = 600;

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
  const blocks = splitMarkedContext(raw).map((b) => ({ id: b.id, text: sanitizeText(b.text) }));
  const context = blocks.map((b) => b.text).join('');
  return buildEnvelope({ context, systemMessage: sanitizeText(args.systemMessage), shape: args.shape });
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
  sanitizeText,
  splitMarkedContext,
  buildEnvelope,
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
