#!/usr/bin/env node
'use strict';

/*
 * Phase 209-02 (B1) - the Shape-F native-fire firing-block stamp.
 *
 * RC-4: the Phase 190 backfill was frontmatter-only by contract, so 99 commands
 * DECLARE hitl_shape but their bodies never instruct the fire and zero grant the
 * AskUserQuestion tool. This script closes that gap in ONE idempotent, auditable
 * two-part pass (Canon Part 7 reuse-before-build; modeled on
 * scripts/backfill-hitl-shape.cjs patchSurface - node:fs + node:path only, pure
 * exported transforms, a require.main-guarded main, --check dry-run vs apply):
 *
 *   Part A (stampBody): insert the canonical firing block + STAMP_MARKER into the
 *     body of every declared-but-unwired command, immediately after the
 *     frontmatter. Strip-then-reinsert on the marker makes re-runs byte-stable.
 *     Bodies that already mention AskUserQuestion (the 18 pre-wired ones) are NOT
 *     body-stamped.
 *   Part B (grantTool): add AskUserQuestion to a command's EXISTING allowed-tools
 *     list. It NEVER creates the key when absent - an absent allowed-tools list
 *     means unrestricted, so creating one would RESTRICT the command (a
 *     regression). Handles all live dialects: multi-line YAML list, inline flow
 *     array (including empty []), and inline scalar.
 *
 * The STAMP_MARKER line ('<!-- mos:firing-block v1 -->') is machine-detectable:
 * it doubles as plan 03's B3 "wired" predicate token. No em-dashes anywhere in
 * emitted content or comments (double hyphen ok).
 *
 * Usage:
 *   node scripts/stamp-firing-block.cjs
 *       apply mode: stamp bodies and grant tools across commands/*.md; prints a
 *       per-file table and the summary counts.
 *   node scripts/stamp-firing-block.cjs --check
 *       dry-run: prints the pending deltas and exits 1 if any are pending; writes
 *       nothing to disk.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');

// The machine-detectable sentinel. Plan 03's B3 "wired" predicate keys on this
// exact line; grep -rl "mos:firing-block v1" commands/ counts the stamped files.
const STAMP_MARKER = '<!-- mos:firing-block v1 -->';
const STAMP_END = '<!-- /mos:firing-block -->';

// The canonical firing paragraph, extracted once from the thrice-repeated
// commands/rooms.md text (lines 24-27, 116-120, 463-468). Kept shape-generic: it
// references "this command's declared hitl_shape" rather than hard-coding F.1, so
// the same block is correct on an F.1, F.8, or F.9 command.
const CANONICAL_FIRING_BLOCK = [
  "At this command's Decision Gate, fire the AskUserQuestion card natively rather than printing a",
  'bare numbered menu or bullet list. Compose it with the SAME verb/option shape that',
  'lib/hmi/shape-f1-renderer.cjs (renderShapeF1) produces and that lib/hmi/selector-dispatcher.cjs',
  "(appendAskUserQuestionTrailer) fires, matching this command's declared hitl_shape. Never reproduce",
  'the selector as text and never hand-build a bespoke widget (SEED-021): call the AskUserQuestion',
  'tool in this same response so the navigator picks a move instead of re-typing a command. Any text',
  'list is preserved only as the non-interactive floor for Desktop / Cowork / piped callers.',
].join('\n');

// The exact substring stampBody injects right after the frontmatter close. A
// fixed leading "\n\n" plus the delimited block lets STRIP_RE reverse it
// byte-for-byte regardless of how the original body's leading newlines looked.
const INJECT_BLOCK = '\n\n' + STAMP_MARKER + '\n' + CANONICAL_FIRING_BLOCK + '\n' + STAMP_END;

// Reverses INJECT_BLOCK exactly: matches the fixed "\n\n" + marker + (lazy body)
// + end sentinel and removes it. One block per file, so no global flag needed.
const STRIP_RE = /\n\n<!-- mos:firing-block v1 -->\n[\s\S]*?\n<!-- \/mos:firing-block -->/;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

// ---------------------------------------------------------------------------
// parseShape(content) -- return the declared hitl_shape value (string) or null.
// Reads only the frontmatter block.
// ---------------------------------------------------------------------------
function parseShape(content) {
  const m = FRONTMATTER_RE.exec(content);
  if (!m) return null;
  const line = m[1].split(/\r?\n/).find((l) => /^hitl_shape:/.test(l));
  if (!line) return null;
  let val = line.slice('hitl_shape:'.length).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

// declaresShape(content) -- true only for a genuine declaring surface (a
// hitl_shape of "none" or absent is not declaring).
function declaresShape(content) {
  const s = parseShape(content);
  return s !== null && s.length > 0 && s.toLowerCase() !== 'none';
}

// ---------------------------------------------------------------------------
// stampBody(content) -- insert the canonical firing block into a command body,
// idempotently. Skips (returns byte-identical) when: no frontmatter, no
// hitl_shape, hitl_shape is 'none', or the CLEAN body (after stripping any prior
// stamp) still mentions AskUserQuestion (a pre-wired body). Strip-then-reinsert
// makes an already-stamped file reproduce byte-for-byte.
// ---------------------------------------------------------------------------
function stampBody(content) {
  if (typeof content !== 'string') throw new Error('stampBody: content must be a string');
  const m = FRONTMATTER_RE.exec(content);
  if (!m) return content;
  if (!declaresShape(content)) return content;

  // Remove any prior stamp so re-runs are byte-stable, giving the "clean" file.
  const clean = content.replace(STRIP_RE, '');

  const fmEnd = FRONTMATTER_RE.exec(clean)[0].length;
  const cleanBody = clean.slice(fmEnd);

  // A body that already mentions the tool (the 18 pre-wired commands) is never
  // body-stamped. The stripped clean body is checked so our own block, which
  // itself names AskUserQuestion, does not count as a pre-existing mention.
  if (/AskUserQuestion/.test(cleanBody)) return clean;

  const rebuilt = clean.slice(0, fmEnd) + INJECT_BLOCK + clean.slice(fmEnd);
  return rebuilt === content ? content : rebuilt;
}

// ---------------------------------------------------------------------------
// grantTool(content) -- add AskUserQuestion to an EXISTING allowed-tools list in
// the frontmatter. Returns byte-identical when: no frontmatter, no allowed-tools
// key (never creates one), or the tool is already granted. Handles the live
// dialects: multi-line YAML list, inline flow array (incl. []), inline scalar.
// ---------------------------------------------------------------------------
function grantTool(content) {
  if (typeof content !== 'string') throw new Error('grantTool: content must be a string');
  const m = FRONTMATTER_RE.exec(content);
  if (!m) return content;
  const nl = content.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const inner = m[1].split(/\r?\n/);

  let idx = -1;
  for (let i = 0; i < inner.length; i++) {
    if (/^allowed-tools:/.test(inner[i])) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return content; // no key -> never create (absent means unrestricted)

  const afterColon = inner[idx].slice('allowed-tools:'.length).trim();

  if (afterColon === '') {
    // Multi-line YAML list: scan the indented "- item" lines beneath the key.
    let last = idx;
    for (let j = idx + 1; j < inner.length; j++) {
      if (/^\s+-\s+/.test(inner[j])) {
        const item = inner[j].replace(/^\s+-\s+/, '').trim();
        if (item === 'AskUserQuestion') return content; // already granted
        last = j;
      } else {
        break; // blank line, comment, or next key ends the sequence
      }
    }
    // Match the indentation of the existing items (default two spaces).
    let indent = '  ';
    if (last > idx) {
      const mi = /^(\s+)-\s+/.exec(inner[last]);
      if (mi) indent = mi[1];
    }
    inner.splice(last + 1, 0, indent + '- AskUserQuestion');
  } else if (afterColon.startsWith('[')) {
    // Inline flow array.
    if (/\bAskUserQuestion\b/.test(afterColon)) return content;
    const inside = afterColon.slice(1, afterColon.lastIndexOf(']')).trim();
    const items = inside === '' ? [] : inside.split(',').map((s) => s.trim()).filter(Boolean);
    items.push('AskUserQuestion');
    inner[idx] = 'allowed-tools: [' + items.join(', ') + ']';
  } else {
    // Inline scalar (single tool, possibly with a permission spec like Bash(node *)).
    if (/\bAskUserQuestion\b/.test(afterColon)) return content;
    inner[idx] = 'allowed-tools: ' + afterColon + ', AskUserQuestion';
  }

  const rebuilt = '---' + nl + inner.join(nl) + nl + '---' + content.slice(m[0].length);
  return rebuilt === content ? content : rebuilt;
}

// ---------------------------------------------------------------------------
// runStamp({ check, commandsDir }) -- walk commandsDir/*.md, apply stampBody then
// grantTool (grant only on declaring commands), and either report (check) or
// write (apply). Returns { files, pendingCount, changedCount }. Pure of any
// Brain/network I/O (Canon Part 8).
// ---------------------------------------------------------------------------
function runStamp(opts) {
  const check = !!(opts && opts.check);
  const dir = (opts && opts.commandsDir) || COMMANDS_DIR;

  const files = [];
  let pendingCount = 0;
  let changedCount = 0;

  const names = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .sort();

  for (const name of names) {
    const abs = path.join(dir, name);
    const before = fs.readFileSync(abs, 'utf8');

    const afterBody = stampBody(before);
    const bodyStamped = afterBody !== before;

    // Grant only on declaring commands (must_haves: "every DECLARING command").
    const after = declaresShape(before) ? grantTool(afterBody) : afterBody;
    const toolGranted = after !== afterBody;

    let skippedReason = '';
    if (!bodyStamped && !toolGranted) {
      if (!declaresShape(before)) {
        skippedReason = 'no-shape';
      } else {
        const fm = FRONTMATTER_RE.exec(before);
        const body = fm ? before.slice(fm[0].length) : before;
        skippedReason = /AskUserQuestion/.test(body) ? 'already-wired' : 'no-change';
      }
    }

    files.push({ file: name, bodyStamped, toolGranted, skippedReason });

    if (after !== before) {
      pendingCount += 1;
      if (!check) {
        fs.writeFileSync(abs, after);
        changedCount += 1;
      }
    }
  }

  return { files, pendingCount, changedCount };
}

// ---------------------------------------------------------------------------
// main() -- argv switch-case router (gsd-tools.cjs pattern; no Commander).
// --check is a dry-run that exits 1 while deltas are pending, 0 when clean.
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');

  const res = runStamp({ check });
  const changedRows = res.files.filter((f) => f.bodyStamped || f.toolGranted);

  if (check) {
    if (res.pendingCount > 0) {
      console.error('stamp-firing-block --check: ' + res.pendingCount + ' file(s) pending:');
      for (const f of changedRows) {
        const parts = [];
        if (f.bodyStamped) parts.push('body');
        if (f.toolGranted) parts.push('grant');
        console.error('  ' + f.file + '  [' + parts.join('+') + ']');
      }
      console.error('Recovery: run node scripts/stamp-firing-block.cjs');
      process.exit(1);
      return;
    }
    console.log('stamp-firing-block --check: OK (0 pending, ' + res.files.length + ' commands scanned)');
    return;
  }

  const bodyCount = res.files.filter((f) => f.bodyStamped).length;
  const grantCount = res.files.filter((f) => f.toolGranted).length;
  const skipped = res.files.length - changedRows.length;

  for (const f of changedRows) {
    const parts = [];
    if (f.bodyStamped) parts.push('body');
    if (f.toolGranted) parts.push('grant');
    console.log('  ' + f.file + '  [' + parts.join('+') + ']');
  }
  console.log(
    'stamp-firing-block: ' +
      res.changedCount +
      ' file(s) changed (' +
      bodyCount +
      ' body-stamped, ' +
      grantCount +
      ' tool-granted), ' +
      skipped +
      ' unchanged of ' +
      res.files.length +
      ' commands.'
  );
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    stampBody,
    grantTool,
    runStamp,
    parseShape,
    declaresShape,
    STAMP_MARKER,
    STAMP_END,
    CANONICAL_FIRING_BLOCK,
  };
}
