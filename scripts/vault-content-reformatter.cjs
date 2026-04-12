#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Vault Content Reformatter
 *
 * Transforms raw Data Room markdown into Obsidian-native rich content:
 *   Pass 1 -- Claim sentence titles (ARCH-01)
 *   Pass 2 -- Callout mapping from keyword prefixes (RULES-03)
 *   Pass 3 -- Rich formatting: speaker quotes, Mondrian dividers (RULES-04)
 *   Pass 4 -- Terminal symbol cleanup: ANSI codes, box-drawing, blocks (RULES-07)
 *   Pass 5 -- Optional nested folder structure (RULES-05, --nested-folders)
 *
 * Pure CJS, zero npm dependencies. Idempotent by construction.
 *
 * Usage:
 *   node scripts/vault-content-reformatter.cjs <room-dir> [--dry-run] [--nested-folders]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { scanRoom } = require('../lib/vault/room-scanner.cjs');
const {
  detectFileType,
  parseFrontmatter,
  serializeFrontmatter,
} = require('../lib/vault/frontmatter-schema.cjs');

// ---------- CLI args ----------

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const NESTED_FOLDERS = argv.includes('--nested-folders');
const roomArg = argv.find((a) => !a.startsWith('--'));

if (!roomArg) {
  process.stderr.write(
    'Usage: node scripts/vault-content-reformatter.cjs <room-dir> [--dry-run] [--nested-folders]\n'
  );
  process.exit(1);
}

const ROOM_DIR = path.resolve(roomArg);
if (!fs.existsSync(ROOM_DIR)) {
  process.stderr.write('ERROR: room dir does not exist: ' + ROOM_DIR + '\n');
  process.exit(1);
}

// ---------- Stats ----------

const stats = {
  titles_transformed: 0,
  callouts_added: 0,
  quotes_formatted: 0,
  ansi_cleaned: 0,
  box_drawing_replaced: 0,
  dividers_added: 0,
  files_moved: 0,
  wikilinks_updated: 0,
  files_processed: 0,
};

// File content cache so multiple passes stack edits before a single write.
const fileCache = new Map(); // absPath -> { original, current }

function loadFile(absPath) {
  if (!fileCache.has(absPath)) {
    try {
      const original = fs.readFileSync(absPath, 'utf-8');
      fileCache.set(absPath, { original, current: original });
    } catch (_) {
      return null;
    }
  }
  return fileCache.get(absPath);
}

function flushFiles() {
  for (const [absPath, entry] of fileCache.entries()) {
    if (entry.current === entry.original) continue;
    if (!DRY_RUN) {
      fs.writeFileSync(absPath, entry.current, 'utf-8');
    }
  }
}

// ---------- Shared helpers ----------

function splitFrontmatter(content) {
  if (!content.startsWith('---')) return { fm: '', body: content, hasFm: false };
  const end = content.indexOf('\n---', 3);
  if (end === -1) return { fm: '', body: content, hasFm: false };
  return {
    fm: content.slice(0, end + 4),
    body: content.slice(end + 4),
    hasFm: true,
  };
}

// ---------- Pass 1: Claim sentence titles ----------

// Minimal verb detector -- we want to recognize enough English verb forms so
// "ALIGN is a smart lobby system" reads as a claim.
const VERB_TOKENS = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had',
  'does', 'do', 'did',
  'will', 'would', 'can', 'could', 'should', 'must', 'may', 'might',
  'builds', 'build', 'built',
  'creates', 'create', 'created',
  'makes', 'make', 'made',
  'enables', 'enable', 'enabled',
  'drives', 'drive', 'drove',
  'requires', 'require', 'required',
  'produces', 'produce', 'produced',
  'solves', 'solve', 'solved',
  'becomes', 'become', 'became',
  'provides', 'provide', 'provided',
  'unlocks', 'unlock', 'unlocked',
  'delivers', 'deliver', 'delivered',
  'transforms', 'transform', 'transformed',
  'changes', 'change', 'changed',
  'shifts', 'shift', 'shifted',
  'lacks', 'lack', 'lacked',
  'needs', 'need', 'needed',
  'works', 'work', 'worked',
  'means', 'mean', 'meant',
  'turns', 'turn', 'turned',
]);

function isClaimSentence(s) {
  if (!s) return false;
  const trimmed = s.trim().replace(/\s+/g, ' ');
  const words = trimmed.split(/\s+/);
  if (words.length < 4) return false;
  // Must contain at least one verb token
  for (const w of words) {
    if (VERB_TOKENS.has(w.toLowerCase().replace(/[.,;:!?]/g, ''))) return true;
  }
  return false;
}

function extractFirstClaim(body) {
  // Skip frontmatter is already split out
  // Find first non-empty paragraph
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of paragraphs) {
    if (p.startsWith('#')) continue; // skip headings
    if (p.startsWith('>')) continue; // skip callouts/quotes
    if (p.startsWith('-') || p.startsWith('*')) continue; // skip lists
    if (p.startsWith('|')) continue; // skip tables
    // Grab the first sentence: split on ". " or line end
    const firstSentence = p.split(/(?<=[.!?])\s+/)[0].trim();
    if (isClaimSentence(firstSentence)) {
      // Strip trailing period
      return firstSentence.replace(/\.$/, '');
    }
  }
  return null;
}

function passClaimTitles(room) {
  for (const file of room.contentFiles) {
    if (file.isFiledTo) continue; // filed-to stubs keep their labels
    if (file.isXref) continue; // xref titles are structural
    if (file.path.endsWith('PROFILE.md')) continue;

    const entry = loadFile(file.path);
    if (!entry) continue;

    const { hasFm, fm, body } = splitFrontmatter(entry.current);
    const h1Match = body.match(/^\s*#\s+(.+)$/m);
    if (!h1Match) continue;

    const title = h1Match[1].trim();
    if (isClaimSentence(title)) continue; // already a claim
    // Only transform short label titles (<= 5 words)
    const wordCount = title.split(/\s+/).length;
    if (wordCount > 5) continue;

    const claim = extractFirstClaim(body);
    if (!claim) continue;
    if (claim === title) continue;

    // Replace H1
    const newBody = body.replace(
      /^\s*#\s+.+$/m,
      '# ' + claim
    );

    // Add alias in frontmatter
    let newFmBlock = fm;
    if (hasFm) {
      const parsed = parseFrontmatter(entry.current);
      const fmObj = Object.assign({}, parsed.frontmatter);
      const aliases = Array.isArray(fmObj.aliases) ? fmObj.aliases.slice() : [];
      if (!aliases.includes(title)) aliases.push(title);
      fmObj.aliases = aliases;
      const reserialized = serializeFrontmatter(fmObj, '');
      newFmBlock = reserialized.replace(/\n$/, '');
    } else {
      newFmBlock = '---\naliases: [' + JSON.stringify(title) + ']\n---';
    }

    entry.current = newFmBlock + (hasFm ? '' : '\n') + newBody;
    stats.titles_transformed += 1;
  }
}

// ---------- Pass 2: Callout mapping ----------

const CALLOUT_PREFIXES = [
  { type: 'warning', keys: ['WARNING', 'ALERT', 'GAP', 'BLOCKER'] },
  { type: 'tip', keys: ['ACTION', 'TODO', 'RECOMMENDATION', 'TIP'] },
  { type: 'quote', keys: ['SOURCE', 'ATTRIBUTION', 'QUOTE'] },
  { type: 'info', keys: ['NOTE', 'METHODOLOGY', 'EXPLANATION'] },
  { type: 'example', keys: ['EXAMPLE', 'CASE', 'ARCHITECTURE'] },
  { type: 'success', keys: ['VALIDATED', 'CONFIRMED', 'CONVERGENCE'] },
  { type: 'abstract', keys: ['SUMMARY', 'OVERVIEW', 'ABSTRACT'] },
  { type: 'important', keys: ['DECISION', 'COMMITMENT', 'RULING'] },
];

const INLINE_BOLD_MAP = {
  'Key Insight': 'info',
  'Note': 'info',
  'Warning': 'warning',
  'Tip': 'tip',
  'Decision': 'important',
  'Action': 'tip',
};

function passCallouts(room) {
  for (const file of room.contentFiles) {
    if (file.isFiledTo) continue;
    const entry = loadFile(file.path);
    if (!entry) continue;

    const { hasFm, fm, body } = splitFrontmatter(entry.current);
    const lines = body.split('\n');
    const out = [];
    let inCallout = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect whether we're still inside a callout block
      if (/^>\s*\[!/.test(line)) {
        inCallout = true;
        out.push(line);
        continue;
      }
      if (inCallout) {
        if (/^>/.test(line)) {
          out.push(line);
          continue;
        } else if (line.trim() === '') {
          inCallout = false;
          out.push(line);
          continue;
        } else {
          inCallout = false;
        }
      }

      // Skip existing callouts entirely
      if (/^>\s*\[!/.test(line)) {
        out.push(line);
        continue;
      }

      // Prefix-keyword pattern: "KEY: rest"
      let matched = false;
      const kwMatch = line.match(/^([A-Z]{3,16})\s*:\s*(.*)$/);
      if (kwMatch) {
        const key = kwMatch[1];
        const rest = kwMatch[2];
        for (const { type, keys } of CALLOUT_PREFIXES) {
          if (keys.includes(key)) {
            out.push('> [!' + type + ']');
            if (rest.trim()) out.push('> ' + rest);
            stats.callouts_added += 1;
            matched = true;
            break;
          }
        }
      }
      if (matched) continue;

      // Existing blockquote bold pattern: "> **Key Insight:** rest"
      const boldMatch = line.match(/^>\s*\*\*([^*]+):\*\*\s*(.*)$/);
      if (boldMatch) {
        const label = boldMatch[1].trim();
        const rest = boldMatch[2];
        const type = INLINE_BOLD_MAP[label];
        if (type) {
          out.push('> [!' + type + '] ' + label);
          if (rest.trim()) out.push('> ' + rest);
          stats.callouts_added += 1;
          continue;
        }
      }

      out.push(line);
    }

    const newBody = out.join('\n');
    if (newBody !== body) {
      entry.current = (hasFm ? fm : '') + newBody;
    }
  }
}

// ---------- Pass 3: Rich formatting (quotes + dividers) ----------

function buildTeamLookup(room) {
  const map = new Map(); // lowercased display name -> relPath
  for (const p of room.teamProfiles) {
    map.set(p.displayName.toLowerCase(), p.relPath);
    // also index by first name
    const first = p.displayName.split(/\s+/)[0];
    if (first) map.set(first.toLowerCase(), p.relPath);
  }
  return map;
}

function passRichFormatting(room) {
  const teamMap = buildTeamLookup(room);

  for (const file of room.contentFiles) {
    const entry = loadFile(file.path);
    if (!entry) continue;

    const { hasFm, fm, body } = splitFrontmatter(entry.current);
    const lines = body.split('\n');
    const out = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Speaker-attributed quote:   > "..." - Name   OR   > "..." -- Name
      const spk = line.match(/^>\s*"([^"]+)"\s*[-\u2013\u2014]{1,2}\s*(.+)$/);
      if (spk) {
        const quoteText = spk[1];
        const speaker = spk[2].trim().replace(/\*+/g, '');
        const lookup = teamMap.get(speaker.toLowerCase());
        const label = lookup ? '[[' + lookup + '|' + speaker + ']]' : speaker;
        out.push('> [!quote] ' + label);
        out.push('> "' + quoteText + '"');
        stats.quotes_formatted += 1;
        continue;
      }

      out.push(line);
    }

    // Mondrian dividers: insert --- before each H2 that isn't already preceded by one.
    const withDividers = [];
    for (let i = 0; i < out.length; i++) {
      const line = out[i];
      if (/^##\s+/.test(line) && i > 0) {
        // look back for most recent non-empty line
        let j = withDividers.length - 1;
        while (j >= 0 && withDividers[j].trim() === '') j--;
        if (j >= 0 && withDividers[j].trim() !== '---') {
          // Only add dividers for content files, not meeting transcripts
          if (!file.path.includes('/meetings/') || file.path.endsWith('summary.md')) {
            withDividers.push('');
            withDividers.push('---');
            withDividers.push('');
            stats.dividers_added += 1;
          }
        }
      }
      withDividers.push(line);
    }

    const newBody = withDividers.join('\n');
    if (newBody !== body) {
      entry.current = (hasFm ? fm : '') + newBody;
    }
  }
}

// ---------- Pass 4: Terminal symbol cleanup ----------

// ANSI CSI sequences: ESC[...m  and also orphan "[...m" fragments where ESC has been stripped.
// We handle both because STATE.md shows raw "[38;2;166;61;47mEMPTY[0m" in existing files.
const ANSI_ESC_RE = /\x1B\[[0-9;]*[A-Za-z]/g;
const ANSI_BARE_RE = /\[\d+(?:;\d+){0,6}m/g;

const BOX_CHARS_RE = /[\u250C\u2510\u2514\u2518\u2502\u2500\u251C\u2524\u252C\u2534\u253C]/g;
const BLOCK_ELEMS_RE = /[\u2588\u2591\u2592\u2593]+/g;

function stripAnsi(text) {
  let out = text;
  let before = out;
  out = out.replace(ANSI_ESC_RE, '');
  if (out !== before) stats.ansi_cleaned += 1;
  before = out;
  out = out.replace(ANSI_BARE_RE, '');
  if (out !== before) stats.ansi_cleaned += 1;
  return out;
}

function stripBoxDrawing(text) {
  if (!BOX_CHARS_RE.test(text)) return text;
  BOX_CHARS_RE.lastIndex = 0;
  // Convert full lines of box-drawing into nothing (a line of `┌──────┐` becomes empty).
  const lines = text.split('\n');
  const out = [];
  let changed = false;
  for (const line of lines) {
    if (/^[\s\u250C-\u254B]+$/.test(line) && /[\u250C\u2510\u2514\u2518\u2502\u2500]/.test(line)) {
      // Pure box-drawing frame line -- replace with blank or horizontal rule
      if (line.includes('\u2500')) {
        out.push('---');
      } else {
        out.push('');
      }
      stats.box_drawing_replaced += 1;
      changed = true;
      continue;
    }
    // Line mixes box chars with content: just strip the box chars
    if (BOX_CHARS_RE.test(line)) {
      BOX_CHARS_RE.lastIndex = 0;
      const cleaned = line.replace(BOX_CHARS_RE, ' ').replace(/\s{2,}/g, ' ').trim();
      out.push(cleaned);
      stats.box_drawing_replaced += 1;
      changed = true;
    } else {
      out.push(line);
    }
  }
  return changed ? out.join('\n') : text;
}

function stripBlockElements(text) {
  // Replace progress bar runs like ██████████ with nothing or preserve percentage context.
  return text.replace(BLOCK_ELEMS_RE, '');
}

function passTerminalCleanup(room) {
  // Include system files here too since STATE.md contains the worst offenders.
  const filesToProcess = room.contentFiles.map((f) => f.path);
  const systemToo = [
    path.join(room.roomDir, 'STATE.md'),
    path.join(room.roomDir, 'ROOM.md'),
  ];
  for (const p of systemToo) {
    if (fs.existsSync(p)) filesToProcess.push(p);
  }

  for (const absPath of filesToProcess) {
    const entry = loadFile(absPath);
    if (!entry) continue;
    const { hasFm, fm, body } = splitFrontmatter(entry.current);
    let cleaned = stripAnsi(body);
    cleaned = stripBoxDrawing(cleaned);
    cleaned = stripBlockElements(cleaned);
    if (cleaned !== body) {
      entry.current = (hasFm ? fm : '') + cleaned;
    }
  }
}

// ---------- Pass 5: Nested folder structure ----------

function passNestedFolders(room) {
  if (!NESTED_FOLDERS) return;

  const moves = []; // { oldRel, newRel, oldAbs, newAbs }
  for (const file of room.contentFiles) {
    if (file.isFiledTo) continue;
    const rel = file.relPath;
    const parts = rel.split('/');
    if (parts.length < 2) continue;
    const basename = parts[parts.length - 1];
    const parent = parts[parts.length - 2];
    const name = basename.replace(/\.md$/, '');

    // Skip if already nested: section/name/name.md
    if (parent === name) continue;
    // Skip ROOM.md and known meeting / team files
    if (basename === 'ROOM.md' || basename === 'PROFILE.md') continue;
    if (rel.includes('/meetings/')) continue;
    if (rel.includes('/team/')) continue;
    if (rel.includes('/filed-to/')) continue;
    // Only process section-level files: parent must be a known top-level section
    // i.e. rel should be exactly "section/name.md"
    if (parts.length !== 2) continue;

    const newRel = parts[0] + '/' + name + '/' + basename;
    moves.push({
      oldRel: rel,
      newRel,
      oldAbs: file.path,
      newAbs: path.join(room.roomDir, newRel),
    });
  }

  if (moves.length === 0) return;

  // Build wikilink-update map for existing cached files + all content files.
  const relMap = new Map();
  for (const m of moves) relMap.set(m.oldRel, m.newRel);

  // Update wikilinks across all content files (read from disk if not cached)
  for (const file of room.contentFiles) {
    const entry = loadFile(file.path);
    if (!entry) continue;
    let content = entry.current;
    let changed = false;
    for (const [oldRel, newRel] of relMap.entries()) {
      const escaped = oldRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('\\[\\[' + escaped + '(\\||\\]\\])', 'g');
      const next = content.replace(re, '[[' + newRel + '$1');
      if (next !== content) {
        const count = (content.match(re) || []).length;
        content = next;
        changed = true;
        stats.wikilinks_updated += count;
      }
    }
    if (changed) entry.current = content;
  }

  // Perform moves
  for (const m of moves) {
    if (DRY_RUN) {
      stats.files_moved += 1;
      continue;
    }
    const entry = loadFile(m.oldAbs);
    const content = entry ? entry.current : fs.readFileSync(m.oldAbs, 'utf-8');
    fs.mkdirSync(path.dirname(m.newAbs), { recursive: true });
    fs.writeFileSync(m.newAbs, content, 'utf-8');
    fs.unlinkSync(m.oldAbs);
    // Remove from cache so flushFiles doesn't re-create it
    fileCache.delete(m.oldAbs);
    stats.files_moved += 1;
  }
}

// ---------- Run ----------

function main() {
  const room = scanRoom(ROOM_DIR);
  stats.files_processed = room.contentFiles.length;

  passClaimTitles(room);
  passCallouts(room);
  passRichFormatting(room);
  passTerminalCleanup(room);
  passNestedFolders(room);

  flushFiles();

  process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write('ERROR: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
}
