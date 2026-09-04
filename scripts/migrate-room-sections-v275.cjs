#!/usr/bin/env node
'use strict';

/*
 * Phase 275-08 Task 1 -- idempotent additive migration of an existing room
 * onto the 11-section ICM L0/L1/L2/L3 schema (Phase 275, D-01 through D-13).
 *
 * Skeleton lifted wholesale from scripts/migrate-minto-schema-v88.cjs: the
 * CLI flag surface, the 0/1/2 exit-code convention, the .room-root walker
 * fallback (findRoomRoot), and the idempotency-by-detection strategy. Only
 * the migration CONTENT differs -- this script does not touch MINTO.md
 * frontmatter fields at all.
 *
 * WHAT THIS SCRIPT DOES, all additive (D-13):
 *   1. Missing section directories + identity ROOM.md files, missing L2
 *      CONTEXT.md contracts, missing identity directories, and the missing
 *      L3 references/ documents are all created by delegating to
 *      lib/core/room-skeleton-scaffold.cjs's own scaffoldRoomSkeleton,
 *      writeSectionContracts and writeReferenceDocs (Canon Part 7: reuse,
 *      do not re-implement). Every one of those writers already
 *      existence-checks before writing, so calling them against a partially
 *      populated legacy room only fills in what is missing.
 *   2. Missing `statement:` frontmatter key on an EXISTING section ROOM.md
 *      is backfilled as a strict, single-line ADDITION immediately after
 *      the `section:` key. An existing `statement:` value, even one that
 *      diverges from SECTION_METADATA (a room owner's own edit), is NEVER
 *      overwritten. No body blockquote is added to an existing file -- a
 *      ROOM.md a human has been editing is not a template render target.
 *
 * WHAT THIS SCRIPT MUST NEVER DO (D-13, stated here so a future reader
 * cannot miss it):
 *   - Never move, rename, merge or delete any directory or file. A room
 *     already using `opportunity-bank/` as an ad-hoc non-frozen directory
 *     keeps its content exactly where it is; the directory name was already
 *     right, only the identity/contract/reference files were missing.
 *   - Never overwrite any existing file's content.
 *   - Never touch a room's `venture_stage` value. STATE.md is where that
 *     value lives (see templates/room-skeleton/references/SECTION-SCHEMA.md
 *     Section 2). scaffoldRoomSkeleton's own `isStateAuthored` guard treats
 *     a STATE.md carrying `auto_created: true` as "not authored" and will
 *     unconditionally RE-RENDER it (a documented, pre-existing gap named in
 *     275-02-SUMMARY.md, not introduced here) -- which would both violate
 *     this script's own never-touch-venture_stage promise AND break the
 *     idempotency guarantee below (a fresh `auto_created_at` timestamp on
 *     every run). This script closes that gap FOR ITSELF (not by editing
 *     room-skeleton-scaffold.cjs, which is out of this script's scope): if
 *     STATE.md exists before scaffoldRoomSkeleton runs, its exact prior
 *     content is captured and restored verbatim afterward, regardless of
 *     what scaffoldRoomSkeleton did to it. A STATE.md that does not exist
 *     yet is still created normally (that is additive, not a violation).
 *   - Never write into references/ anything derived from the room
 *     (writeReferenceDocs already enforces this: verbatim copy, no
 *     renderTemplate substitution pass).
 *
 * IDEMPOTENCY BY DETECTION (matching the v88 analog's hasAllV88Fields
 * strategy): every write in this script, and every write in the scaffold
 * functions it delegates to, is preceded by an existence/presence check.
 * A second run on the same room produces byte-identical output and reports
 * zero writes. This is a hard acceptance criterion, not a best effort.
 *
 * --report-drift, THE ICM L4 PASS, REPORT-ONLY: reads every section's
 * ROOM.md and flags one that has drifted into carrying real content instead
 * of staying identity-only. Signal used (stated here, not guessed): the
 * file's body (everything after the frontmatter block) is longer, in
 * lines, than the freshly-rendered template's body would be for that
 * section, AND the section directory holds no artifact recognised by
 * section-registry.cjs's isIndexableArtifactFile (checked directly in the
 * section directory and one level down, mirroring discoverSections's own
 * nested-artifact pass). Both together mean content went into the identity
 * file instead of an entry folder. This flag NEVER changes the exit code
 * and NEVER modifies a file: passing --report-drift makes the entire
 * invocation read-only (no migration writes happen in the same run), which
 * is the simplest way to make that guarantee unambiguous rather than
 * implicit. Auto-splitting human prose into entry folders is a content
 * decision no script should make (SEED-076, D-13 rationale).
 *
 * Usage:
 *   node scripts/migrate-room-sections-v275.cjs <roomDir> [--dry-run] [--report-drift]
 *   node scripts/migrate-room-sections-v275.cjs --help
 *
 * Exit codes: 0 = success, 1 = usage error, 2 = runtime error.
 */

const fs = require('node:fs');
const path = require('node:path');

const scaffold = require('../lib/core/room-skeleton-scaffold.cjs');
const sectionRegistry = require('../lib/core/section-registry.cjs');

const {
  SECTION_NAMES,
  SECTION_METADATA,
  IDENTITY_DIRECTORIES,
  scaffoldRoomSkeleton,
  renderTemplate,
} = scaffold;
const { isIndexableArtifactFile } = sectionRegistry;

// ---------- CLI ----------

const argv = process.argv.slice(2);

if (argv.indexOf('--help') !== -1 || argv.indexOf('-h') !== -1) {
  process.stdout.write(
    'Usage: node scripts/migrate-room-sections-v275.cjs <roomDir> [--dry-run] [--report-drift]\n' +
      '       node scripts/migrate-room-sections-v275.cjs --help\n' +
      '\n' +
      'Brings an existing room onto the 11-section ICM L0/L1/L2/L3 schema (Phase\n' +
      '275). Additive only: never moves, renames, merges or deletes anything;\n' +
      'never overwrites an existing file; never touches venture_stage. Backfills\n' +
      'missing L0 statement: frontmatter, L1 section directories and identity\n' +
      'ROOM.md files, L2 per-section CONTEXT.md contracts, and the L3 references/\n' +
      'directory. Idempotent: a second run reports zero writes and leaves the\n' +
      'room byte-identical to the first run.\n' +
      '\n' +
      'Flags:\n' +
      '  --dry-run       List every intended write; write nothing. Leaves the\n' +
      '                  room byte-for-byte unchanged.\n' +
      '  --report-drift  Read-only ICM L4 pass: reports sections whose ROOM.md\n' +
      '                  carries real content instead of staying identity-only.\n' +
      '                  Report-only -- never rewrites a drifted file, never\n' +
      '                  changes the exit code, and (since this flag makes the\n' +
      '                  whole invocation read-only) performs no migration\n' +
      '                  writes in the same run.\n' +
      '  --help, -h      Show this usage block.\n'
  );
  process.exit(0);
}

const DRY_RUN = argv.indexOf('--dry-run') !== -1;
const REPORT_DRIFT = argv.indexOf('--report-drift') !== -1;
const positional = argv.filter(function (a) {
  return !a.startsWith('--');
});

// ---------- Path resolution + safety (T-275-31) ----------

function findRoomRoot(start) {
  let dir = path.resolve(start);
  const fsRoot = path.parse(dir).root;
  while (dir && dir !== fsRoot) {
    if (fs.existsSync(path.join(dir, '.room-root'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

let ROOM_DIR;
if (positional.length >= 1) {
  ROOM_DIR = path.resolve(positional[0]);
} else {
  ROOM_DIR = findRoomRoot(process.cwd()) || process.cwd();
}

// T-275-31: reject any resolved path whose components include '..', mirroring
// the _pathSafetyReason guard already in lib/core/navigation/room-birth.cjs:123.
function pathSafetyReason(p) {
  if (typeof p !== 'string' || p.length === 0) return 'empty_path';
  if (!path.isAbsolute(p)) return 'relative_path';
  const normalized = path.normalize(p);
  if (normalized.split(path.sep).includes('..')) return 'path_traversal';
  return null;
}

if (!fs.existsSync(ROOM_DIR) || !fs.statSync(ROOM_DIR).isDirectory()) {
  process.stderr.write(
    'ERROR: room dir does not exist or is not a directory: ' + ROOM_DIR + '\n'
  );
  process.exit(1);
}

const pathErr = pathSafetyReason(ROOM_DIR);
if (pathErr) {
  process.stderr.write('ERROR: unsafe room dir path (' + pathErr + '): ' + ROOM_DIR + '\n');
  process.exit(1);
}

// T-275-31: refuse to operate on a path with no .room-root sentinel and no
// section directory, so a mistyped argument cannot scatter files across an
// unrelated tree.
const hasRoomRootSentinel = fs.existsSync(path.join(ROOM_DIR, '.room-root'));
const hasAnySectionDir = SECTION_NAMES.some((s) => {
  try {
    return fs.statSync(path.join(ROOM_DIR, s)).isDirectory();
  } catch (_e) {
    return false;
  }
});
if (!hasRoomRootSentinel && !hasAnySectionDir) {
  process.stderr.write(
    'ERROR: ' + ROOM_DIR + ' has no .room-root sentinel and no recognised section\n' +
      'directory. Refusing to operate on a path that does not look like a room,\n' +
      'so a mistyped argument cannot scatter files across an unrelated tree.\n'
  );
  process.exit(1);
}

// ---------- Helpers ----------

const SECTION_TEMPLATE_PATH = path.resolve(
  __dirname, '..', 'templates', 'room-skeleton', 'ROOM.md.section.tmpl'
);

let _sectionTemplateCache = null; // null = not yet loaded
function readSectionTemplate() {
  if (_sectionTemplateCache === null) {
    try {
      _sectionTemplateCache = fs.readFileSync(SECTION_TEMPLATE_PATH, 'utf8');
    } catch (_e) {
      _sectionTemplateCache = '';
    }
  }
  return _sectionTemplateCache;
}

function bodyOf(raw) {
  const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return m ? m[1] : raw;
}

function parseFrontmatterBlock(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  return { fmText: m[1], fmFull: m[0], body: raw.slice(m[0].length) };
}

// Atomic write: openSync 'wx' tmp (pid + random suffix, per the v88 analog's
// concurrency-guard convention) + fsync + rename. Returns true on success.
function atomicWriteLocal(targetPath, content) {
  const tmpPath =
    targetPath + '.v275-migrate.tmp.' + process.pid + '.' +
    Math.random().toString(36).slice(2, 10);
  let fd;
  try {
    fd = fs.openSync(tmpPath, 'wx');
  } catch (_e) {
    return false;
  }
  try {
    fs.writeSync(fd, content);
    fs.fsyncSync(fd);
  } catch (_e) {
    try { fs.closeSync(fd); } catch (_e2) { /* already closed */ }
    try { fs.unlinkSync(tmpPath); } catch (_e3) { /* best effort */ }
    return false;
  }
  try {
    fs.closeSync(fd);
  } catch (_e) {
    /* already closed */
  }
  try {
    fs.renameSync(tmpPath, targetPath);
  } catch (_e) {
    return false;
  }
  return true;
}

// Renders what scaffoldRoomSkeleton WOULD render for this section's ROOM.md
// today, using the identical sectionSubs shape, so the drift detector has a
// real baseline rather than a guessed one.
function renderedBodyFor(slug) {
  const meta = SECTION_METADATA[slug];
  if (!meta) return '';
  const titleCase = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const sectionSubs = {
    STATEMENT: meta.statement || meta.purpose,
    SECTION_NAME: slug,
    SECTION_NAME_TITLE_CASE: titleCase,
    SECTION_PURPOSE: meta.purpose,
    STAGE_RELEVANCE_LIST: meta.stage_relevance.map((s) => '  - ' + s).join('\n'),
    DEFAULT_METHODOLOGIES_LIST: meta.default_methodologies.map((m) => '  - ' + m).join('\n'),
  };
  const rendered = renderTemplate(readSectionTemplate(), sectionSubs);
  return bodyOf(rendered);
}

// Mirrors section-registry.cjs's discoverSections nested-artifact pass: an
// artifact directly in the section dir, or one level down (excluding
// dot-dirs and sub-rooms carrying their own .room-root sentinel).
function sectionHasArtifact(dirPath) {
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (_e) {
    return false;
  }
  if (files.some(isIndexableArtifactFile)) return true;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (_e) {
    return false;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith('.')) continue;
    const childPath = path.join(dirPath, ent.name);
    if (fs.existsSync(path.join(childPath, '.room-root'))) continue; // sub-room, skip
    let childFiles;
    try {
      childFiles = fs.readdirSync(childPath);
    } catch (_e) {
      continue;
    }
    if (childFiles.some(isIndexableArtifactFile)) return true;
  }
  return false;
}

function checkDrift(roomDir, slug) {
  const dirPath = path.join(roomDir, slug);
  const roomMdPath = path.join(dirPath, 'ROOM.md');
  if (!fs.existsSync(roomMdPath)) return null;
  let raw;
  try {
    raw = fs.readFileSync(roomMdPath, 'utf8');
  } catch (_e) {
    return null;
  }
  const actualBody = bodyOf(raw);
  const baselineBody = renderedBodyFor(slug);
  const actualLines = actualBody.split('\n').length;
  const baselineLines = baselineBody.split('\n').length;
  const hasArtifact = sectionHasArtifact(dirPath);
  if (actualLines > baselineLines && !hasArtifact) {
    return { slug: slug, path: roomMdPath, bodyLineCount: actualLines };
  }
  return null;
}

function printDriftReport(roomDir) {
  const hits = [];
  for (const slug of SECTION_NAMES) {
    const hit = checkDrift(roomDir, slug);
    if (hit) hits.push(hit);
  }
  process.stdout.write('\n=== L4 DRIFT REPORT (report-only, nothing rewritten) ===\n');
  if (hits.length === 0) {
    process.stdout.write('No drifted sections found.\n');
  } else {
    for (const hit of hits) {
      process.stdout.write(
        'DRIFT: ' + hit.slug + ' -- ' + hit.path + ' (' + hit.bodyLineCount + ' body lines)\n' +
          '  Move this content into ' + hit.slug + '/<artifact-slug>/<artifact-slug>.md and leave\n' +
          '  ROOM.md as identity only. Rule cited in ' + hit.slug + '/CONTEXT.md\'s own Outputs\n' +
          '  clause: "Never inline content into ROOM.md."\n'
      );
    }
  }
  process.stdout.write('=== END L4 DRIFT REPORT (' + hits.length + ' drifted) ===\n\n');
  return hits;
}

function backfillStatementIfMissing(roomMdPath, slug, result) {
  let raw;
  try {
    raw = fs.readFileSync(roomMdPath, 'utf8');
  } catch (_e) {
    result.errors.push('statement_backfill_read_failed:' + slug);
    return;
  }
  const parsed = parseFrontmatterBlock(raw);
  if (!parsed) {
    result.warnings.push('statement_backfill_skipped_no_frontmatter:' + slug);
    return;
  }
  if (/^\s*statement:\s*/m.test(parsed.fmText)) {
    return; // Canon Part 9: an existing statement, even a divergent one, is never overwritten.
  }
  const meta = SECTION_METADATA[slug];
  const statementValue = meta ? (meta.statement || meta.purpose) : '';
  const newLine = 'statement: ' + statementValue;
  const lines = parsed.fmText.split(/\r?\n/);
  const sectionLineIdx = lines.findIndex((l) => /^\s*section:\s*/.test(l));
  let newLines;
  if (sectionLineIdx === -1) {
    newLines = [newLine].concat(lines);
    result.warnings.push('statement_backfill_no_section_key:' + slug);
  } else {
    newLines = lines.slice(0, sectionLineIdx + 1)
      .concat([newLine])
      .concat(lines.slice(sectionLineIdx + 1));
  }
  const newContent = '---\n' + newLines.join('\n') + '\n---\n' + parsed.body;
  if (atomicWriteLocal(roomMdPath, newContent)) {
    result.statements_backfilled.push(slug);
  } else {
    result.errors.push('statement_backfill_write_failed:' + slug);
  }
}

// ---------- Dry-run planning (read-only) ----------

function planDryRun(roomDir) {
  const planned = [];

  const statePath = path.join(roomDir, 'STATE.md');
  if (!scaffold.isStateAuthored(roomDir) && !fs.existsSync(statePath)) {
    planned.push('create STATE.md (room has no STATE.md yet)');
  }
  if (!fs.existsSync(path.join(roomDir, 'MINTO.md'))) planned.push('create MINTO.md');
  if (!fs.existsSync(path.join(roomDir, 'USER.md'))) planned.push('create USER.md');

  for (const slug of SECTION_NAMES) {
    const roomMdPath = path.join(roomDir, slug, 'ROOM.md');
    if (!fs.existsSync(roomMdPath)) {
      planned.push('create section identity: ' + slug + '/ROOM.md');
    } else {
      const raw = fs.readFileSync(roomMdPath, 'utf8');
      const parsed = parseFrontmatterBlock(raw);
      if (parsed && !/^\s*statement:\s*/m.test(parsed.fmText)) {
        planned.push('backfill statement: frontmatter key on ' + slug + '/ROOM.md');
      }
    }
    const contractPath = path.join(roomDir, slug, 'CONTEXT.md');
    const contractTemplatePath = path.resolve(
      __dirname, '..', 'templates', 'room-skeleton', 'section-contracts', slug + '.md'
    );
    if (!fs.existsSync(contractPath) && fs.existsSync(contractTemplatePath)) {
      planned.push('create L2 contract: ' + slug + '/CONTEXT.md');
    }
  }

  for (const dirName of Object.keys(IDENTITY_DIRECTORIES)) {
    if (!fs.existsSync(path.join(roomDir, dirName, 'ROOM.md'))) {
      planned.push('create identity directory: ' + dirName + '/ROOM.md');
    }
  }

  for (const name of scaffold.REFERENCE_DOCS) {
    const targetPath = path.join(roomDir, 'references', name);
    const templatePath = path.resolve(
      __dirname, '..', 'templates', 'room-skeleton', 'references', name
    );
    if (!fs.existsSync(targetPath) && fs.existsSync(templatePath)) {
      planned.push('create L3 reference: references/' + name);
    }
  }

  return planned;
}

// ---------- Main ----------

function main() {
  if (REPORT_DRIFT) {
    // Report-only mode: the whole invocation is read-only when this flag is
    // present, so the "does not modify any file" guarantee is unambiguous
    // rather than implicit in ordering.
    printDriftReport(ROOM_DIR);
    process.exit(0);
  }

  if (DRY_RUN) {
    const planned = planDryRun(ROOM_DIR);
    if (planned.length === 0) {
      process.stdout.write('Nothing to migrate; room already matches the current schema.\n');
    } else {
      for (const p of planned) {
        process.stdout.write('would migrate: ' + p + '\n');
      }
    }
    process.stdout.write('\nDry run: ' + planned.length + ' intended write(s), 0 actually written.\n');
    process.exit(0);
  }

  // Real migration.
  const result = {
    statements_backfilled: [],
    warnings: [],
    errors: [],
  };

  // Preserve any pre-existing STATE.md verbatim across the scaffoldRoomSkeleton
  // call. See the header docblock's "never touch venture_stage" section for
  // why this guard exists: isStateAuthored treats auto_created:true as "not
  // authored" and would otherwise re-render STATE.md (a fresh auto_created_at
  // timestamp, and potentially a stale venture_stage) on every single run.
  const statePath = path.join(ROOM_DIR, 'STATE.md');
  const statePreExisted = fs.existsSync(statePath);
  const stateOriginalContent = statePreExisted ? fs.readFileSync(statePath, 'utf8') : null;

  let scaffoldResult;
  try {
    scaffoldResult = scaffoldRoomSkeleton(ROOM_DIR, {});
  } catch (e) {
    process.stderr.write('ERROR: scaffoldRoomSkeleton threw: ' + e.message + '\n');
    process.exit(2);
    return;
  }

  if (statePreExisted) {
    const afterContent = fs.existsSync(statePath) ? fs.readFileSync(statePath, 'utf8') : null;
    if (afterContent !== stateOriginalContent) {
      if (atomicWriteLocal(statePath, stateOriginalContent)) {
        result.warnings.push('state_md_restored_after_scaffold_rewrite');
      } else {
        result.errors.push('state_md_restore_failed');
      }
    }
  }

  // Statement backfill (item 2): the one in-place frontmatter ADDITION this
  // script makes. scaffoldRoomSkeleton never touches an existing ROOM.md, so
  // this is the only place a pre-existing section identity file is edited.
  for (const slug of SECTION_NAMES) {
    const roomMdPath = path.join(ROOM_DIR, slug, 'ROOM.md');
    if (fs.existsSync(roomMdPath)) {
      backfillStatementIfMissing(roomMdPath, slug, result);
    }
  }

  const allErrors = (scaffoldResult.errors || []).concat(result.errors);
  const allWarnings = (scaffoldResult.warnings || []).concat(result.warnings);

  const report = [
    '',
    'Sections created: ' + (scaffoldResult.sections_created || []).length +
      ' (' + (scaffoldResult.sections_created || []).join(', ') + ')',
    'L2 contracts created: ' + (scaffoldResult.contracts_created || []).length +
      ' (' + (scaffoldResult.contracts_created || []).join(', ') + ')',
    'Identity directories created: ' + (scaffoldResult.identity_files_created || []).length +
      ' (' + (scaffoldResult.identity_files_created || []).join(', ') + ')',
    'L3 reference docs created: ' + (scaffoldResult.reference_docs_created || []).length +
      ' (' + (scaffoldResult.reference_docs_created || []).join(', ') + ')',
    'statement: frontmatter backfilled: ' + result.statements_backfilled.length +
      ' (' + result.statements_backfilled.join(', ') + ')',
    'Warnings: ' + allWarnings.length,
    'Errors: ' + allErrors.length,
  ];
  if (allWarnings.length > 0) {
    report.push('');
    for (const w of allWarnings) report.push('  warning: ' + w);
  }
  if (allErrors.length > 0) {
    report.push('');
    for (const e of allErrors) report.push('  error: ' + e);
  }
  process.stdout.write(report.join('\n') + '\n');

  process.exit(allErrors.length === 0 ? 0 : 2);
}

main();
