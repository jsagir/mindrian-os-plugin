'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 (beta.51 scaffold-as-content bug cluster), decisions D-01 and
 * D-02 -- the ONE shared scaffold predicate.
 *
 * WHY THIS EXISTS: the beta.51 cluster has one root. The system counted its
 * own scaffold (the files room birth writes into every section) as the
 * navigator's content. Eureka, compute-state and the MINTO generator each
 * need to answer "is this file scaffold?" and each must answer it the same
 * way, so the answer lives here, once:
 *   - CONTEXT.md, ROOM.md, MINTO.md, STATE.md, USER.md, BRAIN.md are always
 *     scaffold (no read needed), and so is BRIEF.md (369.25-19, a generated
 *     projection of the nest's faces, never content);
 *   - FEYNMAN.md is scaffold only while it still holds nothing but what the
 *     system wrote: frontmatter, its H1, the birth (or default) seed
 *     sentence, and the auto blocks (## Timeline (auto), ## Dial Memory (auto)
 *     and, from 369.25-15, ## What changed (auto) and ## What we cannot yet
 *     explain (auto), each with its sentinel-bounded body). One
 *     navigator-written line anywhere outside those blocks makes it content;
 *   - the shipped reference docs room birth copies into references/
 *     (room-skeleton-scaffold's REFERENCE_DOCS export, the two schema docs)
 *     are always scaffold, consumed from that export;
 *   - every other .md file is content.
 *
 * CANON PART 7 (reuse before build): this module builds on
 * lib/core/semantic-index/scaffold-template-index.cjs (kindBasename,
 * isTemplateIdentical, stripLeadingFrontmatter) and on the two auto-block
 * owners' own bodyOutsideSentinels + HEADER exports
 * (lib/core/feynman/timeline-runner.cjs and
 * lib/core/feynman/dial-memory-renderer.cjs). It never forks the template
 * matcher and never hard-codes a sentinel string.
 *
 * CANON PART 8 (graph boundary): node built-ins plus local lib modules only.
 * Zero network, zero Brain reach.
 *
 * FAILURE POSTURE (F4, T-363.1-01/02): content wins. If a sentinel module
 * cannot load, a FEYNMAN.md cannot be read, or it is larger than
 * MAX_FEYNMAN_BYTES, the file is treated as content: a wrong "scaffold"
 * answer would silently drop the navigator's work from every count, while a
 * wrong "content" answer only over-counts. Nothing here throws.
 *
 * BASH CLI (compute-state and other bash callers ask the same predicate;
 * paths cross as argv only, never as interpolated code, T-363.1-03):
 *   node lib/core/scaffold-predicate.cjs --is-scaffold <path>
 *       exit 0 = scaffold, 1 = content, 2 = usage error
 *   node lib/core/scaffold-predicate.cjs --count-content <dir> [<dir>...]
 *       one non-scaffold top-level .md count per dir, argument order
 *   node lib/core/scaffold-predicate.cjs --list-content <dir> [<dir>...]
 *       every dir's content files (absolute), dirs in argument order
 * Loading the template index costs a measurable fraction of a second per
 * node process, so the CLI takes many dirs per spawn: call it once per run,
 * not once per section or file.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const scaffoldTemplateIndex = require('./semantic-index/scaffold-template-index.cjs');

// The scaffold kinds room birth writes into a section. Basenames are derived
// through the template index's kindBasename, never typed as a second list.
const SCAFFOLD_KIND_LIST = Object.freeze(['CONTEXT', 'ROOM', 'MINTO', 'STATE', 'USER', 'BRAIN', 'FEYNMAN']);

// The reference docs room birth copies into references/ (the two schema
// docs). They are shipped plugin text, not the navigator's work, and
// beta.51 replays showed one of them ranking as Eureka's rank-1 endpoint (gap
// closure 2026-09-30, B51-01 residual). The list is CONSUMED from
// room-skeleton-scaffold's frozen REFERENCE_DOCS export (single source of
// truth, Canon Part 7): a new shipped reference doc is scaffold the moment it
// joins that allowlist. The module is cheap to load (node built-ins plus
// gray-matter, already resident via the template index) and its heavier
// requires are lazy inside functions. If it cannot load, content wins: no
// reference doc is treated as scaffold, which only over-counts.
function loadReferenceDocs() {
  try {
    const docs = require('./room-skeleton-scaffold.cjs').REFERENCE_DOCS;
    if (Array.isArray(docs) && docs.every((d) => typeof d === 'string' && d.length > 0)) return docs;
  } catch (_e) {
    // fall through
  }
  return [];
}
const REFERENCE_DOC_BASENAMES = Object.freeze(loadReferenceDocs().map((d) => scaffoldBasenameOf(d)).filter((d) => d !== null));
// 369.25-19: BRIEF.md is a generated projection of the nest's faces and records (lib/core/feyminto/brief.cjs), never the
// navigator's content. Counting it would make the brief an artifact of its own nest: it would be listed in ROOM.md and in
// MINTO sources, the nest's artifact count would move with every render, and the next render would see the change.
const GENERATED_PROJECTION_BASENAMES = Object.freeze(['BRIEF.md']);
const SCAFFOLD_BASENAMES = Object.freeze(new Set(
  SCAFFOLD_KIND_LIST.map(scaffoldTemplateIndex.kindBasename).concat(REFERENCE_DOC_BASENAMES, GENERATED_PROJECTION_BASENAMES)
));
const FEYNMAN_BASENAME = scaffoldTemplateIndex.kindBasename('FEYNMAN');

// A FEYNMAN.md above this size is treated as content without parsing
// (T-363.1-02: a huge file read on every compute-state run).
const MAX_FEYNMAN_BYTES = 262144;

// bodyOutsideSentinels removes one block per call; a pathological file with
// repeated blocks is re-stripped up to this many passes. Anything left after
// the cap is simply not template text, so the file reads as content.
const MAX_STRIP_PASSES = 10;

const USAGE = 'usage: node lib/core/scaffold-predicate.cjs ' +
  '--is-scaffold <path> | --count-content <dir> [<dir>...] | --list-content <dir> [<dir>...]';

// The last path segment of nameOrPath, with backslashes normalised to
// slashes first, and `.md` appended when the segment has no .md extension
// (case-insensitive test). Returns null for a non-string or empty input.
function scaffoldBasenameOf(nameOrPath) {
  if (typeof nameOrPath !== 'string' || nameOrPath.length === 0) return null;
  const segments = nameOrPath.replace(/\\/g, '/').split('/');
  let base = segments[segments.length - 1];
  if (!base) return null;
  if (!/\.md$/i.test(base)) base += '.md';
  return base;
}

// isScaffoldBasename(nameOrPath) -- membership test only, no read. The stem
// is case-sensitive: 'Context.md' is content, 'CONTEXT' is scaffold.
function isScaffoldBasename(nameOrPath) {
  const base = scaffoldBasenameOf(nameOrPath);
  return base !== null && SCAFFOLD_BASENAMES.has(base);
}

// Lazy, independently guarded load of the two auto-block owners. Either one
// missing -> null -> isSeededFeynman answers false (content wins).
let sentinelModules;
function loadSentinelModules() {
  if (sentinelModules !== undefined) return sentinelModules;
  try {
    const timelineRunner = require('./feynman/timeline-runner.cjs');
    const dialMemory = require('./feynman/dial-memory-renderer.cjs');
    // 369.25-15: the third auto-block owner, the FeyMinto what-changed and cannot-yet-explain blocks.
    const feyMintoBlocks = require('./feyminto/feynman-blocks.cjs');
    const mods = [timelineRunner, dialMemory, feyMintoBlocks];
    for (const m of mods) {
      if (!m || typeof m.bodyOutsideSentinels !== 'function' || typeof m.HEADER !== 'string') {
        sentinelModules = null;
        return sentinelModules;
      }
    }
    sentinelModules = mods;
  } catch (_e) {
    sentinelModules = null;
  }
  return sentinelModules;
}

// isSeededFeynman(body) -- true when a FEYNMAN.md body holds nothing the
// navigator wrote. Order: excise every auto block (repeat until stable),
// drop the auto-block HEADER lines each bodyOutsideSentinels leaves behind,
// strip the leading frontmatter, then ask the template index whether every
// remaining line is shipped seed text. Nothing left at all is scaffold.
function isSeededFeynman(body) {
  try {
    const mods = loadSentinelModules();
    if (!mods) return false;
    let text = String(body == null ? '' : body);
    for (let pass = 0; pass < MAX_STRIP_PASSES; pass += 1) {
      let next = text;
      for (const m of mods) next = m.bodyOutsideSentinels(next);
      if (next === text) break;
      text = next;
    }
    const headers = new Set(mods.map((m) => m.HEADER.trim()));
    text = text.split(/\r?\n/).filter((line) => !headers.has(line.trim())).join('\n');
    text = scaffoldTemplateIndex.stripLeadingFrontmatter(text);
    if (!/\S/.test(text)) return true;
    return scaffoldTemplateIndex.isTemplateIdentical('FEYNMAN', text) === true;
  } catch (_e) {
    return false;
  }
}

// isScaffoldFile(absPath) -- the basename must be a scaffold basename.
// Non-FEYNMAN kinds are scaffold without a read. FEYNMAN.md is read (size
// capped) and passed to isSeededFeynman; missing, unreadable or oversized
// reads as content.
function isScaffoldFile(absPath) {
  try {
    const base = scaffoldBasenameOf(absPath);
    if (base === null || !SCAFFOLD_BASENAMES.has(base)) return false;
    if (base !== FEYNMAN_BASENAME) return true;
    const st = fs.statSync(absPath);
    if (!st.isFile() || st.size > MAX_FEYNMAN_BYTES) return false;
    const text = fs.readFileSync(absPath, 'utf8');
    if (Buffer.byteLength(text, 'utf8') > MAX_FEYNMAN_BYTES) return false;
    return isSeededFeynman(text);
  } catch (_e) {
    return false;
  }
}

function compareCodepoint(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// listContentFiles(dir) -- the top-level regular .md files in dir that are
// NOT scaffold, as absolute-joined paths sorted by codepoint. Never recurses.
// A missing or unreadable dir returns [].
function listContentFiles(dir) {
  if (typeof dir !== 'string' || dir.length === 0) return [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    try {
      if (!entry || !entry.isFile()) continue;
      if (!/\.md$/i.test(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (isScaffoldFile(full)) continue;
      out.push(full);
    } catch (_e) {
      // An entry that cannot be classified is skipped, never thrown.
    }
  }
  return out.sort(compareCodepoint);
}

// ---------------------------------------------------------------------------
// CLI -- switch-case router on argv[2] (house pattern, no Commander).
// ---------------------------------------------------------------------------
function usageError(msg) {
  if (msg) process.stderr.write(msg + '\n');
  process.stderr.write(USAGE + '\n');
  return 2;
}

function runCli(argv) {
  const cmd = argv[0];
  const args = argv.slice(1);
  switch (cmd) {
    case '--is-scaffold': {
      if (args.length !== 1 || !args[0]) return usageError('--is-scaffold takes exactly one path');
      return isScaffoldFile(path.resolve(args[0])) ? 0 : 1;
    }
    case '--count-content': {
      if (args.length === 0) return usageError('--count-content takes at least one dir');
      let out = '';
      for (const dir of args) out += String(listContentFiles(path.resolve(dir)).length) + '\n';
      process.stdout.write(out);
      return 0;
    }
    case '--list-content': {
      if (args.length === 0) return usageError('--list-content takes at least one dir');
      let out = '';
      for (const dir of args) {
        for (const f of listContentFiles(path.resolve(dir))) out += f + '\n';
      }
      process.stdout.write(out);
      return 0;
    }
    default:
      return usageError(cmd ? ('unknown flag: ' + cmd) : null);
  }
}

if (require.main === module) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (err) {
    process.stderr.write('scaffold-predicate: ' + String(err && err.message ? err.message : err) + '\n');
    process.exitCode = 2;
  }
}

module.exports = {
  SCAFFOLD_BASENAMES,
  isScaffoldBasename,
  isSeededFeynman,
  isScaffoldFile,
  listContentFiles,
};
