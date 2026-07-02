#!/usr/bin/env node
'use strict';

/*
 * Phase 190-02 (SFD-03) - the HITL Shape-F declaration backfill generator.
 *
 * Turns Plan 01's data/hitl-shape-backfill.json into shipped frontmatter on the
 * real declaring surfaces (the commands, agents, pipeline CHAIN.md, and the
 * qualifying skill SKILL.md files), in ONE mechanical, auditable, idempotent
 * pass instead of hand-editing each file (Canon Part 7 reuse-before-build;
 * mirrors the build-connector-registry.cjs generator idiom - node:fs + node:path
 * only, a focused line-walk frontmatter patcher, a --check dry-run vs default
 * apply main()).
 *
 * The generator is DATA-DRIVEN, never surface-class-driven: it iterates the map
 * keys and patches whichever file each key names. That is exactly what keeps the
 * 5 non-qualifying skills untouched - they are simply ABSENT from the map (their
 * connector.excluded:true + reason is their exemption, Canon Part 11 R1), so the
 * generator never opens them for write.
 *
 * NON-DESTRUCTIVE CONTRACT: patchSurface only inserts/updates hitl_shape /
 * hitl_stages / hitl_why keys. Every other frontmatter key, every body line, and
 * the byte order outside the shape block is preserved exactly. A skill's nested
 * connector: block (its own surface:, excluded:, reason:, etc.) is left
 * byte-identical; the shape keys are ROOT-level siblings of connector:, never
 * merged into it. No em-dashes anywhere in emitted content.
 *
 * Usage:
 *   node scripts/backfill-hitl-shape.cjs
 *       apply mode: patch every file named as a KEY in the map; prints a
 *       one-line changed/unchanged summary.
 *   node scripts/backfill-hitl-shape.cjs --check
 *       dry-run: prints the surfaces that WOULD change and exits 1 if any would;
 *       writes nothing to disk.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BACKFILL_PATH = path.join(REPO_ROOT, 'data', 'hitl-shape-backfill.json');

// The ONLY frontmatter keys this generator ever inserts or updates (the RULES
// contract). Emission order is fixed for determinism: a single-fork entry emits
// hitl_shape then hitl_why; a multi-stage entry emits hitl_stages then hitl_why.
// An entry never carries both hitl_shape and hitl_stages.
const SHAPE_KEYS = Object.freeze(['hitl_shape', 'hitl_stages', 'hitl_why']);

// ---------------------------------------------------------------------------
// renderShapeLines(entry) -- serialize the shape block as an array of
// frontmatter lines. Scalars use JSON.stringify so any colon/paren/comma in a
// hitl_why sentence is safely double-quoted (a JSON string is a valid YAML
// double-quoted flow scalar). hitl_stages emits a nested YAML list mirroring the
// repo's connector: nested-block idiom, with flow-sequence shapes arrays.
// ---------------------------------------------------------------------------
function renderShapeLines(entry) {
  const lines = [];
  if (Object.prototype.hasOwnProperty.call(entry, 'hitl_shape')) {
    lines.push('hitl_shape: ' + JSON.stringify(entry.hitl_shape));
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'hitl_stages')) {
    lines.push('hitl_stages:');
    const stages = Array.isArray(entry.hitl_stages) ? entry.hitl_stages : [];
    for (const st of stages) {
      const shapes = Array.isArray(st.shapes) ? st.shapes : [];
      lines.push('  - stage: ' + JSON.stringify(st.stage));
      lines.push('    shapes: [' + shapes.map((s) => JSON.stringify(s)).join(', ') + ']');
      lines.push('    mode: ' + JSON.stringify(st.mode));
    }
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'hitl_why')) {
    lines.push('hitl_why: ' + JSON.stringify(entry.hitl_why));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// stripShapeLines(innerLines) -- remove any pre-existing shape-key lines from a
// frontmatter inner-line array, returning the file's "clean" frontmatter (what a
// never-patched file looks like). A hitl_stages: key drags its indented children
// out with it. This is what makes patchSurface idempotent: strip-then-reinsert
// at the same deterministic position reproduces the input byte-for-byte.
// ---------------------------------------------------------------------------
function stripShapeLines(innerLines) {
  const out = [];
  let inStages = false;
  for (const line of innerLines) {
    if (inStages) {
      // An indented (child) line belongs to the hitl_stages block -> drop it.
      if (/^\s+\S/.test(line)) continue;
      // A non-indented line ends the block; fall through to re-evaluate it.
      inStages = false;
    }
    if (/^hitl_shape:/.test(line)) continue;
    if (/^hitl_why:/.test(line)) continue;
    if (/^hitl_stages:/.test(line)) {
      inStages = true;
      continue;
    }
    out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------------------
// patchSurface(content, entry) -- the pure string transform. Returns new file
// content with the shape block inserted immediately AFTER the body_shape: line
// when present, else appended at the END of the frontmatter block (the common
// case for skills, which rarely carry body_shape:). Every other line is
// byte-identical. Throws on a file that has no frontmatter block (never silently
// appends a frontmatter block to a bodiless file).
// ---------------------------------------------------------------------------
function patchSurface(content, entry) {
  if (typeof content !== 'string') {
    throw new Error('patchSurface: content must be a string');
  }
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) {
    throw new Error('patchSurface: no frontmatter block found');
  }
  const nl = content.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const innerLines = m[1].split(/\r?\n/);

  // Strip any existing shape block so re-runs are byte-stable (idempotency).
  const clean = stripShapeLines(innerLines);

  // Insertion point: right after body_shape: if present, else end of frontmatter.
  let insertAt = -1;
  for (let i = 0; i < clean.length; i++) {
    if (/^body_shape:/.test(clean[i])) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt === -1) insertAt = clean.length;

  const shapeLines = renderShapeLines(entry);
  const finalInner = clean
    .slice(0, insertAt)
    .concat(shapeLines, clean.slice(insertAt));

  const rebuiltInner = finalInner.join(nl);
  const rest = content.slice(m[0].length);
  const rebuilt = '---' + nl + rebuiltInner + nl + '---' + rest;

  // Idempotency guarantee: an already-conformant file returns byte-identical.
  return rebuilt === content ? content : rebuilt;
}

// ---------------------------------------------------------------------------
// runBackfill({ map, rootDir, check }) -- iterate the map keys, patch each named
// file (resolved against rootDir), and either report (check) or write (apply).
// Returns { changed, unchanged, wouldChange, missing, errors }. Files ABSENT
// from the map are never resolved and never opened - the exemption mechanism for
// the 5 non-qualifying skills. Pure of any Brain/network I/O (Part 8).
// ---------------------------------------------------------------------------
function runBackfill(opts) {
  const map = opts && opts.map;
  const rootDir = (opts && opts.rootDir) || REPO_ROOT;
  const check = !!(opts && opts.check);
  if (!map || typeof map !== 'object') {
    throw new Error('runBackfill: opts.map is required');
  }

  const changed = [];
  const unchanged = [];
  const wouldChange = [];
  const missing = [];
  const errors = [];

  for (const key of Object.keys(map)) {
    const abs = path.join(rootDir, key);
    if (!fs.existsSync(abs)) {
      missing.push(key);
      continue;
    }
    let before;
    try {
      before = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      errors.push(key + ': ' + (e && e.message ? e.message : String(e)));
      continue;
    }
    let after;
    try {
      after = patchSurface(before, map[key]);
    } catch (e) {
      errors.push(key + ': ' + (e && e.message ? e.message : String(e)));
      continue;
    }
    if (after === before) {
      unchanged.push(key);
      continue;
    }
    if (check) {
      wouldChange.push(key);
      continue;
    }
    fs.writeFileSync(abs, after);
    changed.push(key);
  }

  return { changed, unchanged, wouldChange, missing, errors };
}

// ---------------------------------------------------------------------------
// main() -- CLI entry. --check is a dry-run (prints pending surfaces, exits 1 if
// any would change or any error). Default apply mode writes changed files and
// prints a one-line summary.
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');

  let map;
  try {
    map = JSON.parse(fs.readFileSync(BACKFILL_PATH, 'utf8'));
  } catch (e) {
    console.error('backfill-hitl-shape: cannot read ' + BACKFILL_PATH + ': ' + (e && e.message));
    process.exit(1);
    return;
  }

  const res = runBackfill({ map, rootDir: REPO_ROOT, check });

  if (res.missing.length) {
    console.error('MISSING (map key with no file on disk): ' + res.missing.join(', '));
  }
  if (res.errors.length) {
    console.error('ERRORS:\n  ' + res.errors.join('\n  '));
  }

  if (check) {
    if (res.wouldChange.length) {
      console.error(
        'backfill-hitl-shape --check: ' + res.wouldChange.length + ' surface(s) would change:'
      );
      for (const k of res.wouldChange) console.error('  ' + k);
    }
    if (res.wouldChange.length || res.missing.length || res.errors.length) {
      console.error('Recovery: run node scripts/backfill-hitl-shape.cjs');
      process.exit(1);
      return;
    }
    console.log('backfill-hitl-shape: OK (' + res.unchanged.length + ' surfaces already conformant)');
    return;
  }

  if (res.missing.length || res.errors.length) {
    process.exit(1);
    return;
  }
  console.log(
    'backfill-hitl-shape: ' +
      res.changed.length +
      ' changed, ' +
      res.unchanged.length +
      ' unchanged (' +
      (res.changed.length + res.unchanged.length) +
      ' surfaces total)'
  );
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    patchSurface,
    renderShapeLines,
    stripShapeLines,
    runBackfill,
    main,
    SHAPE_KEYS,
    BACKFILL_PATH,
  };
}
