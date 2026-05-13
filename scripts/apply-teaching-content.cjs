#!/usr/bin/env node
'use strict';

/*
 * Phase 104.1 Plan 02 Task 4 - Sweep-edit teaching field into commands/*.md
 * frontmatter from the approved working artifact.
 *
 * Reads:
 *   .planning/phases/104.1-per-command-teaching-content/104.1-TEACHING-CONTENT-DRAFT.md
 *
 * Writes (idempotent, in-place):
 *   commands/<slug>.md  -- inserts or updates `teaching: "<string>"` inside
 *                          the leading `---` YAML frontmatter block. Inserts
 *                          on its own line directly AFTER the existing
 *                          `serves_jtbd:` line when present, else at the
 *                          first natural position after `description:`.
 *                          Preserves the rest of the file verbatim.
 *
 * Idempotent: re-running on a file that already has the same teaching value
 * is a no-op (no write, no diff). Re-running with a CHANGED teaching value
 * updates in place.
 *
 * Usage:
 *   node scripts/apply-teaching-content.cjs           # apply all
 *   node scripts/apply-teaching-content.cjs --check   # report drift, exit 1
 *                                                       if any command's
 *                                                       frontmatter teaching
 *                                                       does not match the
 *                                                       artifact (no writes)
 *
 * Canon Part 7 (Reuse Before Build): mirrors the hand-rolled frontmatter
 * line-walk pattern from scripts/build-command-registry.cjs (this file)
 * rather than adding gray-matter or a new YAML parser. The build script
 * is the read surface for the registry; this script is the write surface
 * for the per-command frontmatter. Both honor the same shape.
 *
 * Canon Part 8 boundary: this script is purely LOCAL. Zero network surface,
 * zero Brain calls, zero user-content egress.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const DRAFT_PATH = path.join(
  REPO_ROOT,
  '.planning',
  'phases',
  '104.1-per-command-teaching-content',
  '104.1-TEACHING-CONTENT-DRAFT.md'
);

// ---------------------------------------------------------------------------
// parseDraft() -- read the working artifact, extract (slug, teaching) pairs.
// Returns a Map of slug -> teaching_string.
//
// The table shape (post-Task-1) is:
//   | # | /mos:<slug> | serves_jtbd | teaching string | lede | [OK] |
//
// awk -F '|' index map (note leading `|` makes $1 empty):
//   $1 = ""        (before leading pipe)
//   $2 = # column
//   $3 = command column (/mos:<slug>)
//   $4 = serves_jtbd
//   $5 = teaching string
//   $6 = lede letter
//   $7 = review status ([OK])
// ---------------------------------------------------------------------------
function parseDraft() {
  if (!fs.existsSync(DRAFT_PATH)) {
    console.error('ERROR: working artifact not found: ' + DRAFT_PATH);
    process.exit(1);
  }
  const raw = fs.readFileSync(DRAFT_PATH, 'utf8');
  const out = new Map();
  for (const rawLine of raw.split(/\r?\n/)) {
    // Data rows start with `| ` followed by a digit (the # column).
    if (!/^\|\s*\d+\s*\|/.test(rawLine)) continue;
    // Split on `|` and strip whitespace from each field. Use a regex that
    // tolerates the leading and trailing pipes.
    const parts = rawLine.split('|').map((s) => s.trim());
    // parts[0] = "" (before leading |), parts[1] = "#", parts[2] = "/mos:slug",
    // parts[3] = "serves_jtbd", parts[4] = "teaching", parts[5] = "lede",
    // parts[6] = "[OK]" (or status), parts[7] = "" (after trailing |).
    if (parts.length < 7) continue;
    const command = parts[2];
    const teaching = parts[4];
    if (!command.startsWith('/mos:')) continue;
    if (!teaching) continue;
    const slug = command.replace(/^\/mos:/, '');
    out.set(slug, teaching);
  }
  return out;
}

// ---------------------------------------------------------------------------
// applyTeachingToFile(filePath, teaching) -- read the file, find the leading
// frontmatter block, insert or update the `teaching:` key. Returns one of:
//   'written'    -- file was changed and written
//   'unchanged'  -- already had the correct teaching value, no write
//   'no-frontmatter' -- file does not have a leading `---` frontmatter block
//
// Insertion point: directly AFTER the line containing `serves_jtbd:` when
// present, else AFTER `description:`, else as the last key inside the
// frontmatter block.
//
// Update: if `teaching:` already exists, rewrite its line in place.
// ---------------------------------------------------------------------------
function applyTeachingToFile(filePath, teaching) {
  const raw = fs.readFileSync(filePath, 'utf8');

  // Frontmatter detection: leading `---` line, then content, then `---` line.
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== '---') return 'no-frontmatter';

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return 'no-frontmatter';

  // Build the YAML value. JSON.stringify gives us a safely-escaped string
  // (handles embedded quotes, backslashes). YAML accepts JSON-style
  // double-quoted strings.
  const yamlValue = JSON.stringify(teaching);
  const newLine = 'teaching: ' + yamlValue;

  // Locate existing `teaching:` line (if any) inside the frontmatter block.
  let teachingIdx = -1;
  let servesJtbdIdx = -1;
  let descriptionIdx = -1;
  for (let i = 1; i < endIdx; i++) {
    if (/^teaching:\s*/.test(lines[i])) teachingIdx = i;
    else if (/^serves_jtbd:\s*/.test(lines[i])) servesJtbdIdx = i;
    else if (/^description:\s*/.test(lines[i])) descriptionIdx = i;
  }

  if (teachingIdx !== -1) {
    // Update in place.
    if (lines[teachingIdx] === newLine) {
      return 'unchanged';
    }
    lines[teachingIdx] = newLine;
    fs.writeFileSync(filePath, lines.join('\n'));
    return 'written';
  }

  // Insert. Prefer AFTER serves_jtbd:, else AFTER description:, else just
  // before the closing `---`.
  let insertAfter;
  if (servesJtbdIdx !== -1) insertAfter = servesJtbdIdx;
  else if (descriptionIdx !== -1) insertAfter = descriptionIdx;
  else insertAfter = endIdx - 1;

  lines.splice(insertAfter + 1, 0, newLine);
  fs.writeFileSync(filePath, lines.join('\n'));
  return 'written';
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const isCheck = argv.includes('--check');

  const pairs = parseDraft();
  if (pairs.size === 0) {
    console.error('ERROR: no (command, teaching) pairs parsed from the artifact');
    process.exit(1);
  }

  // Build a slug -> filePath index by scanning commands/*.md and reading the
  // `name:` field from each file's frontmatter. The build script uses fm.name
  // (not the filename) to derive the command slug (e.g., value-proposition.md
  // has name: validate-proposition and emits /mos:validate-proposition).
  const slugToPath = new Map();
  for (const f of fs.readdirSync(COMMANDS_DIR)) {
    if (!f.endsWith('.md')) continue;
    const filePath = path.join(COMMANDS_DIR, f);
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    if (lines[0] !== '---') continue;
    let nm = null;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') break;
      const m = /^name:\s*(.+?)\s*$/.exec(lines[i]);
      if (m) {
        nm = m[1].replace(/^["']|["']$/g, '');
        break;
      }
    }
    // Fallback to filename basename when `name:` is absent.
    if (!nm) nm = f.replace(/\.md$/, '');
    slugToPath.set(nm, filePath);
  }

  const stats = { written: 0, unchanged: 0, missing: 0, noFrontmatter: 0 };
  const missing = [];
  const drift = [];

  for (const [slug, teaching] of pairs) {
    const filePath = slugToPath.get(slug);
    if (!filePath || !fs.existsSync(filePath)) {
      stats.missing++;
      missing.push(slug);
      continue;
    }

    if (isCheck) {
      // Read-only drift detection.
      const raw = fs.readFileSync(filePath, 'utf8');
      const lines = raw.split(/\r?\n/);
      if (lines[0] !== '---') {
        stats.noFrontmatter++;
        continue;
      }
      let endIdx = -1;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---') {
          endIdx = i;
          break;
        }
      }
      if (endIdx === -1) {
        stats.noFrontmatter++;
        continue;
      }
      const wanted = 'teaching: ' + JSON.stringify(teaching);
      let found = null;
      for (let i = 1; i < endIdx; i++) {
        if (/^teaching:\s*/.test(lines[i])) {
          found = lines[i];
          break;
        }
      }
      if (found !== wanted) {
        drift.push({ slug, wanted, found });
      } else {
        stats.unchanged++;
      }
      continue;
    }

    const result = applyTeachingToFile(filePath, teaching);
    if (result === 'written') stats.written++;
    else if (result === 'unchanged') stats.unchanged++;
    else if (result === 'no-frontmatter') stats.noFrontmatter++;
  }

  if (isCheck) {
    if (drift.length > 0) {
      console.error('DRIFT detected on ' + drift.length + ' commands:');
      for (const d of drift.slice(0, 5)) {
        console.error('  - ' + d.slug + ': wanted=' + d.wanted + '   found=' + (d.found || '(absent)'));
      }
      if (drift.length > 5) console.error('  ... and ' + (drift.length - 5) + ' more');
      process.exit(1);
    }
    if (stats.noFrontmatter > 0 || stats.missing > 0) {
      console.error('ERROR: ' + stats.noFrontmatter + ' commands without frontmatter, ' + stats.missing + ' missing');
      process.exit(1);
    }
    console.log('apply-teaching-content --check: OK (' + stats.unchanged + ' commands match artifact)');
    return;
  }

  console.log(
    'apply-teaching-content: written=' +
      stats.written +
      ', unchanged=' +
      stats.unchanged +
      ', missing=' +
      stats.missing +
      ', no-frontmatter=' +
      stats.noFrontmatter +
      ', total=' +
      pairs.size
  );
  if (missing.length > 0) {
    console.error('Missing command files: ' + missing.join(', '));
    process.exit(1);
  }
  if (stats.noFrontmatter > 0) {
    console.error('ERROR: ' + stats.noFrontmatter + ' commands lack a leading frontmatter block');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = { parseDraft, applyTeachingToFile };
}
