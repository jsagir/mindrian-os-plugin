#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 04 -- HIPS-02, D-19..D-22. The offline validator + sweep
 * engine for data/floor-ledger.json: every threshold literal a user could
 * read as a measured verdict gets one ledger row, disclosed not calibrated
 * (D-19), and a planted literal that slips in unrecorded fails loudly
 * (D-22). ZERO network. Never requires brain-client.cjs. No zod (house
 * ledger pattern, data/section-command-ledger.json).
 *
 * Exports: validateLedger, resolveHits, stripComments, SCAN_FAMILIES,
 * FLOOR_SCAN_FILES.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// FLOOR_SCAN_FILES -- the D-21 inventory files, plus scripts/hsi-to-graph.cjs
// (the HIPS-02 research addition D-21 missed). Repo-relative, forward-slash.
// ---------------------------------------------------------------------------
const FLOOR_SCAN_FILES = Object.freeze([
  'lib/core/rs-engine.cjs',
  'lib/core/rs-differential-scorer.cjs',
  'lib/core/rs-innovation-classifier.cjs',
  'lib/core/rs-breakthrough-scorer.cjs',
  'lib/core/hsi-engine.cjs',
  'scripts/hsi-to-graph.cjs',
  'scripts/compute-whitespace-gaps.py',
  'scripts/whitespace-command.cjs',
  'scripts/interpret-whitespace.cjs',
  'lib/core/eureka-critic.cjs',
  'lib/core/eureka/tail-quadrant.cjs',
  'lib/core/eureka/analogy-fitness.cjs',
]);

// ---------------------------------------------------------------------------
// SCAN_FAMILIES -- the pattern-pass glob patterns over the engine families
// (355-04-PLAN.md <behavior>). '*' is the only wildcard supported; test
// files (*.test.cjs) are excluded from every family (engine source only).
// ---------------------------------------------------------------------------
const SCAN_FAMILIES = Object.freeze([
  'lib/core/rs-*.cjs',
  'lib/core/hsi-*.cjs',
  'lib/core/eureka/*.cjs',
  'lib/core/eureka-critic.cjs',
  'scripts/*whitespace*.cjs',
  'scripts/hsi-*.cjs',
  'scripts/compute-whitespace-gaps.py',
]);

// ---------------------------------------------------------------------------
// stripComments(text, ext) -- comment-stripped lines, SAME array length as
// the input (index i -> source line i+1), so a hit's line number is always
// the real file line number. JS: '//' line comments, '/* ... */' block
// comments (including multi-line), '*' continuation lines. Python: '#' line
// comments. URL-safe: a '//' immediately preceded by ':' never starts a
// comment (the hygiene-355 nonCommentLines idiom, https://... safe).
// ---------------------------------------------------------------------------
function stripComments(text, ext) {
  const lines = text.split(/\r?\n/);
  const out = new Array(lines.length);
  const isPython = ext === '.py';
  let inBlock = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isPython) {
      out[i] = trimmed.startsWith('#') ? '' : line.replace(/(^|[^:])#.*$/, '$1');
      continue;
    }

    if (inBlock) {
      const closeIdx = line.indexOf('*/');
      if (closeIdx === -1) {
        out[i] = '';
      } else {
        out[i] = line.slice(closeIdx + 2);
        inBlock = false;
      }
      continue;
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      out[i] = '';
      continue;
    }

    const blockOpenIdx = line.indexOf('/*');
    if (blockOpenIdx !== -1) {
      const blockCloseIdx = line.indexOf('*/', blockOpenIdx + 2);
      if (blockCloseIdx !== -1) {
        out[i] = line.slice(0, blockOpenIdx) + line.slice(blockCloseIdx + 2);
      } else {
        out[i] = line.slice(0, blockOpenIdx);
        inBlock = true;
      }
      continue;
    }

    out[i] = line.replace(/(^|[^:])\/\/.*$/, '$1');
  }

  return out;
}

// ---------------------------------------------------------------------------
// Glob resolution -- '*' only, no npm glob dependency (house discipline).
// ---------------------------------------------------------------------------
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveGlobPattern(repoRoot, pattern) {
  const base = path.basename(pattern);
  const dirRel = path.dirname(pattern);
  if (!base.includes('*')) {
    return fs.existsSync(path.join(repoRoot, pattern)) ? [pattern] : [];
  }
  const dirAbs = path.join(repoRoot, dirRel);
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  const reStr = '^' + base.split('*').map(escapeRegExp).join('.*') + '$';
  const re = new RegExp(reStr);
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => re.test(name))
    .filter((name) => !name.endsWith('.test.cjs'))
    .map((name) => (dirRel === '.' ? name : dirRel + '/' + name));
}

function resolveScanFiles(repoRoot, extraFiles) {
  const set = new Set();
  for (const f of FLOOR_SCAN_FILES) set.add(f);
  for (const pattern of SCAN_FAMILIES) {
    for (const f of resolveGlobPattern(repoRoot, pattern)) set.add(f);
  }
  for (const f of extraFiles || []) set.add(f);
  return Array.from(set).filter((f) => fs.existsSync(path.join(repoRoot, f)));
}

// ---------------------------------------------------------------------------
// Hit patterns (355-04-PLAN.md <behavior>): a const decimal declaration, an
// envFloat(/envInt( call, a resolveFloat( call, or a numeric comparison
// against a decimal / 1.0-style literal. One hit per matching line (a line
// matching more than one pattern still counts once).
// ---------------------------------------------------------------------------
const HIT_PATTERNS = [
  /const\s+[A-Z_]+\s*=\s*(0?\.[0-9]+|1\.0+)\b/,
  /env(?:Float|Int)\('/,
  /resolveFloat\('/,
  /[<>]=?\s*(0?\.[0-9]+|1\.0+)\b/,
];

function lineIsHit(line) {
  return HIT_PATTERNS.some((re) => re.test(line));
}

// ---------------------------------------------------------------------------
// matchesAnchor(anchor, lineText) -- a bare anchor matches as \bNAME\b; an
// anchor prefixed 're:' is used as a regex against the line.
// ---------------------------------------------------------------------------
function matchesAnchor(anchor, lineText) {
  if (typeof anchor !== 'string' || anchor.length === 0) return false;
  if (anchor.startsWith('re:')) {
    try {
      return new RegExp(anchor.slice(3)).test(lineText);
    } catch (_e) {
      return false;
    }
  }
  return new RegExp('\\b' + escapeRegExp(anchor) + '\\b').test(lineText);
}

// ---------------------------------------------------------------------------
// resolveHits(ledger, repoRoot, extraFiles) -> { scannedFiles, hits,
// unresolved }. Scans FLOOR_SCAN_FILES union the SCAN_FAMILIES glob union
// extraFiles; every hit resolves to a ledger row sharing its file whose
// anchor matches the hit line, or lands in `unresolved`.
// ---------------------------------------------------------------------------
function resolveHits(ledger, repoRoot, extraFiles) {
  const rows = (ledger && Array.isArray(ledger.rows)) ? ledger.rows : [];
  const files = resolveScanFiles(repoRoot, extraFiles);
  const hits = [];
  const unresolved = [];

  for (const relFile of files) {
    const absFile = path.join(repoRoot, relFile);
    let raw;
    try {
      raw = fs.readFileSync(absFile, 'utf8');
    } catch (_e) {
      continue;
    }
    const ext = path.extname(relFile);
    const strippedLines = stripComments(raw, ext);
    const rowsForFile = rows.filter((r) => r.file === relFile);

    for (let i = 0; i < strippedLines.length; i += 1) {
      const lineText = strippedLines[i];
      if (!lineText || !lineIsHit(lineText)) continue;
      const hit = { file: relFile, line: i + 1, text: lineText.trim() };
      hits.push(hit);
      const resolved = rowsForFile.some((r) => matchesAnchor(r.line_anchor, lineText));
      if (!resolved) unresolved.push(hit);
    }
  }

  return { scannedFiles: files.length, hits: hits, unresolved: unresolved };
}

// ---------------------------------------------------------------------------
// validateLedger(ledger, repoRoot) -> { valid, problems }. Shape validation
// (D-20 row shape, D-19 disclosed-only-this-phase, the calibration gate) plus
// stale-anchor detection (every row's anchor must match at least one
// comment-stripped line of its OWN file, read fresh from repoRoot).
// ---------------------------------------------------------------------------
const VALID_KINDS = new Set(['floor', 'band', 'weight', 'rubric', 'policy', 'definitional']);
const VALID_STATUSES = new Set(['disclosed', 'calibrated']);
const VALID_ENV_READS = new Set(['load', 'call', null]);
const REQUIRED_FIELDS = ['id', 'file', 'line_anchor', 'value', 'gates', 'kind', 'env_override', 'env_read', 'status', 'provenance', 'dependent_outputs'];

function validateLedger(ledger, repoRoot) {
  const problems = [];

  if (!ledger || typeof ledger !== 'object') {
    return { valid: false, problems: ['ledger is not an object'] };
  }
  if (typeof ledger.floor_basis !== 'string' || ledger.floor_basis.length === 0) {
    problems.push('ledger.floor_basis is missing');
  }
  if (!Array.isArray(ledger.rows) || ledger.rows.length === 0) {
    problems.push('ledger.rows is missing or empty');
    return { valid: false, problems: problems };
  }

  const seenIds = new Set();
  const fileCache = new Map();

  for (const row of ledger.rows) {
    const rid = row && row.id ? row.id : '(no id)';

    for (const field of REQUIRED_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(row || {}, field)) {
        problems.push(rid + ': missing field "' + field + '"');
      }
    }

    if (seenIds.has(rid)) problems.push(rid + ': duplicate row id');
    seenIds.add(rid);

    if (row.kind !== undefined && !VALID_KINDS.has(row.kind)) {
      problems.push(rid + ': invalid kind "' + row.kind + '"');
    }
    if (row.status !== undefined && !VALID_STATUSES.has(row.status)) {
      problems.push(rid + ': invalid status "' + row.status + '"');
    }
    if (row.env_read !== undefined && !VALID_ENV_READS.has(row.env_read)) {
      problems.push(rid + ': invalid env_read "' + row.env_read + '"');
    }
    if (row.line_anchor !== undefined && /^\d+$/.test(String(row.line_anchor))) {
      problems.push(rid + ': line_anchor is a bare line number (never allowed)');
    }

    if (row.status === 'calibrated') {
      const prov = row.provenance;
      const hasGold = prov && Object.prototype.hasOwnProperty.call(prov, 'gold') && prov.gold !== null && prov.gold !== undefined;
      const hasN = prov && Object.prototype.hasOwnProperty.call(prov, 'n') && prov.n !== null && prov.n !== undefined;
      if (!prov || !hasGold || !hasN) {
        problems.push(rid + ': status calibrated requires provenance.gold and provenance.n');
      }
    }

    if (repoRoot && row.file && row.line_anchor) {
      let stripped = fileCache.get(row.file);
      if (stripped === undefined) {
        const absFile = path.join(repoRoot, row.file);
        try {
          const raw = fs.readFileSync(absFile, 'utf8');
          stripped = stripComments(raw, path.extname(row.file));
        } catch (_e) {
          stripped = null;
        }
        fileCache.set(row.file, stripped);
      }
      if (stripped === null) {
        problems.push(rid + ': file "' + row.file + '" does not exist under repoRoot');
      } else {
        const matches = stripped.some((line) => line && matchesAnchor(row.line_anchor, line));
        if (!matches) {
          problems.push(rid + ': stale anchor "' + row.line_anchor + '" matches no line in ' + row.file);
        }
      }
    }
  }

  return { valid: problems.length === 0, problems: problems };
}

// ---------------------------------------------------------------------------
// --check CLI: offline, zero network, never requires brain-client.
// ---------------------------------------------------------------------------
function runCheck() {
  const repoRoot = path.resolve(__dirname, '..');
  const ledgerPath = path.join(repoRoot, 'data', 'floor-ledger.json');
  let ledger;
  try {
    ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  } catch (e) {
    console.error('FAIL: cannot read/parse ' + ledgerPath + ': ' + e.message);
    return false;
  }

  const shapeResult = validateLedger(ledger, repoRoot);
  const hitsResult = resolveHits(ledger, repoRoot, []);

  const problems = shapeResult.problems.slice();
  if (hitsResult.scannedFiles === 0) problems.push('scanned 0 files (sweep found nothing to scan)');
  for (const h of hitsResult.unresolved) {
    problems.push('unresolved hit ' + h.file + ':' + h.line + ' -- ' + h.text);
  }

  if (problems.length > 0) {
    for (const p of problems) console.error('FAIL: ' + p);
    return false;
  }

  console.log('PASS: floor-ledger --check (' + ledger.rows.length + ' rows, ' + hitsResult.scannedFiles + ' files scanned, ' + hitsResult.hits.length + ' hits, 0 unresolved)');
  return true;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  switch (args[0]) {
    case '--check': {
      const ok = runCheck();
      process.exit(ok ? 0 : 1);
      break;
    }
    default: {
      console.error('usage: node scripts/check-floor-ledger.cjs --check');
      process.exit(1);
    }
  }
}

module.exports = {
  validateLedger: validateLedger,
  resolveHits: resolveHits,
  stripComments: stripComments,
  SCAN_FAMILIES: SCAN_FAMILIES,
  FLOOR_SCAN_FILES: FLOOR_SCAN_FILES,
};
