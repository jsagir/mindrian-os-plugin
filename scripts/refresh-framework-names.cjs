#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 08 (HIPS-04 resolution coverage, D-51). Regenerates
 * data/framework-names.json from ONE live Theo `list_frameworks` read
 * through lib/core/brain-client.cjs (askOp, generic handles only -- never
 * the raw theo server) as a dated, hashed snapshot in the SAME shape
 * (framework_names + curated_extras) verification-stamp.cjs already
 * resolves against.
 *
 * NAMES ONLY: NEVER COMMIT A THEO DESCRIPTION (IP RULING, spike-findings
 * skill). buildSnapshot copies the `name` field off each row and nothing
 * else -- no description, no category, no internal Theo record id. The
 * acceptance grep for this file greps for the literal word "description"
 * outside a proper block-comment line; this header paragraph is that one
 * permitted mention.
 *
 * THE ONE WIRE DOOR (--live only): this module calls
 * `brainClient.askOp('list_frameworks', { limit })` at most once, plus (only
 * on a degraded/capped/too-few answer) the bucketed
 * `pullTheoFrameworks` fallback ported to scripts/build-section-command-ledger.cjs.
 * `lib/core/brain-client.cjs` is required LAZILY, only inside the `--live`
 * branch, only when the caller supplied no `deps.askOp` -- requiring this
 * module (or running `--check`) never opens a socket. `--check` NEVER
 * requires brain-client, not even lazily: it reads the committed snapshot,
 * recomputes the hash, and validates the shape offline.
 *
 * DEGRADATION NEVER WRITES A PARTIAL LIST: a degraded, text-only, or
 * fewer-than-MIN_LIVE_NAMES answer from BOTH the live read and the bucketed
 * fallback writes nothing and exits non-zero, naming the reason.
 *
 * STALE REVIEW NEVER SILENTLY DROPS A REFERENCED NAME: a prior
 * `framework_names` entry that is not in the fresh live set is looked up
 * against every `commands/*.md` frontmatter `frameworks:` array; if any
 * command still references it, the name is KEPT (moved into
 * `curated_extras`) with a note naming the command; otherwise it is DROPPED
 * with a note. Either way the decision is written down in `stale_review`,
 * never silent.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_FW_NAMES_PATH = path.join(REPO_ROOT, 'data', 'framework-names.json');
const DEFAULT_COMMANDS_DIR = path.join(REPO_ROOT, 'commands');

// D-51: a live/fallback read carrying fewer names than the CURRENT committed
// framework_names count (105 at plan-authoring time) is treated as capped or
// degraded, never as "canon shrank overnight".
const MIN_LIVE_NAMES = 105;

const DEFAULT_CURATED_EXTRAS_NOTE =
  'Legitimate :Framework node names that exist in the Brain but are not yet FEEDS_INTO-linked (brain-cleanup adds those edges over time). Hand-curated -- NOT junk nodes. The allowlist the registry validates against is framework_names UNION curated_extras.';

// ---------------------------------------------------------------------------
// namesSha256(names) -- sha256 hex of JSON.stringify(sorted, deduped names).
// Sorts internally so callers never need to pre-sort before hashing.
// ---------------------------------------------------------------------------
function namesSha256(names) {
  const list = Array.isArray(names) ? names.slice() : [];
  const sorted = Array.from(new Set(list)).sort((a, b) => a.localeCompare(b));
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// ---------------------------------------------------------------------------
// buildSnapshot({ rows, prior, date, referencedBy }) -- pure (no I/O). rows
// is Theo's raw list_frameworks row array (only `.name` is ever read); prior
// is the previously-committed snapshot object (or a minimal stand-in);
// referencedBy(name) is an optional function returning the referencing
// command's filename (or null) for a stale-review lookup.
// ---------------------------------------------------------------------------
function buildSnapshot(opts) {
  const o = opts || {};
  const rows = Array.isArray(o.rows) ? o.rows : [];
  const prior = o.prior && typeof o.prior === 'object' ? o.prior : {};
  const date = typeof o.date === 'string' && o.date ? o.date : new Date().toISOString().slice(0, 10);
  const referencedBy = typeof o.referencedBy === 'function' ? o.referencedBy : () => null;

  const rawNames = [];
  for (const row of rows) {
    if (!row || typeof row.name !== 'string') continue;
    const trimmed = row.name.trim();
    if (trimmed.length < 1 || trimmed.length > 128) continue;
    rawNames.push(trimmed);
  }
  const framework_names = Array.from(new Set(rawNames)).sort((a, b) => a.localeCompare(b));
  const liveSet = new Set(framework_names);

  const priorFrameworkNames = Array.isArray(prior.framework_names) ? prior.framework_names : [];
  const priorCuratedExtras = Array.isArray(prior.curated_extras) ? prior.curated_extras : [];

  const stale_review = [];
  for (const name of priorFrameworkNames) {
    if (liveSet.has(name)) continue;
    const referencingFile = referencedBy(name);
    if (referencingFile) {
      stale_review.push({
        name,
        decision: 'kept',
        note: 'still referenced by ' + referencingFile + '; not a live Framework as of ' + date,
      });
    } else {
      stale_review.push({
        name,
        decision: 'dropped',
        note: 'not a live Framework as of ' + date,
      });
    }
  }
  const keptStaleNames = stale_review.filter((s) => s.decision === 'kept').map((s) => s.name);

  const curated_extras = Array.from(
    new Set(priorCuratedExtras.filter((n) => !liveSet.has(n)).concat(keptStaleNames))
  ).sort((a, b) => a.localeCompare(b));

  const source_sha256 = namesSha256(framework_names);

  return {
    snapshot_note:
      'Every live :Framework name read from Theo via lib/core/brain-client.cjs askOp (\'list_frameworks\'), not only the FEEDS_INTO-linked subset. Refresh with: node scripts/refresh-framework-names.cjs --live',
    snapshot_date: date,
    source: 'theo list_frameworks via lib/core/brain-client.cjs askOp',
    source_sha256,
    framework_names,
    curated_extras_note:
      typeof prior.curated_extras_note === 'string' && prior.curated_extras_note
        ? prior.curated_extras_note
        : DEFAULT_CURATED_EXTRAS_NOTE,
    curated_extras,
    stale_review,
  };
}

// ---------------------------------------------------------------------------
// validateSnapshot(snapshot) -- offline shape + hash + stale_review check.
// Returns { valid, errors }. Never touches the filesystem or the network.
// ---------------------------------------------------------------------------
function validateSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['snapshot is not an object'] };
  }

  if (typeof snapshot.snapshot_date !== 'string' || snapshot.snapshot_date.length === 0) {
    errors.push('missing snapshot_date');
  }

  const names = Array.isArray(snapshot.framework_names) ? snapshot.framework_names : null;
  if (!names) {
    errors.push('framework_names is not an array');
  } else {
    for (const n of names) {
      if (typeof n !== 'string' || n.length < 1 || n.length > 128) {
        errors.push('framework_names entry has an invalid length: ' + JSON.stringify(n));
      }
    }
    const sorted = names.slice().sort((a, b) => a.localeCompare(b));
    let isSorted = true;
    for (let i = 0; i < names.length; i++) {
      if (names[i] !== sorted[i]) {
        isSorted = false;
        break;
      }
    }
    if (!isSorted) errors.push('framework_names is not sorted');

    const seen = new Set();
    for (const n of names) {
      if (seen.has(n)) errors.push('framework_names has a duplicate: ' + n);
      seen.add(n);
    }

    const expectedHash = namesSha256(names);
    if (snapshot.source_sha256 !== expectedHash) {
      errors.push('source_sha256 mismatch: got ' + snapshot.source_sha256 + ', expected ' + expectedHash);
    }
  }

  const staleReview = Array.isArray(snapshot.stale_review) ? snapshot.stale_review : [];
  for (const s of staleReview) {
    if (!s || (s.decision !== 'dropped' && s.decision !== 'kept')) {
      errors.push('stale_review entry missing a valid decision: ' + JSON.stringify(s));
    }
    if (!s || typeof s.note !== 'string' || s.note.length === 0) {
      errors.push('stale_review entry missing a note: ' + JSON.stringify(s));
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// makeReferencedByFromCommandsDir(commandsDir) -- scans commands/*.md
// frontmatter `frameworks:` JSON-array lines (every commands/*.md frontmatter
// line is a single-line JSON array, e.g. `frameworks: ["Red Teaming"]`) and
// returns a `(name) => filename|null` lookup. Read-only, local, no network.
// ---------------------------------------------------------------------------
function makeReferencedByFromCommandsDir(commandsDir) {
  const map = new Map();
  let files = [];
  try {
    files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
  } catch (_e) {
    files = [];
  }
  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    } catch (_e) {
      continue;
    }
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    if (!fm) continue;
    const line = /^frameworks:\s*(\[.*\])\s*$/m.exec(fm[1]);
    if (!line) continue;
    let arr;
    try {
      arr = JSON.parse(line[1]);
    } catch (_e) {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const name of arr) {
      if (typeof name === 'string' && !map.has(name)) map.set(name, file);
    }
  }
  return (name) => (map.has(name) ? map.get(name) : null);
}

// ---------------------------------------------------------------------------
// atomicWriteJSON(filePath, snapshot) -- temp file then rename.
// ---------------------------------------------------------------------------
function atomicWriteJSON(filePath, snapshot) {
  const dataString = JSON.stringify(snapshot, null, 2) + '\n';
  const tmp = filePath + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, dataString);
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// tryAskOp(askOp) -- one askOp('list_frameworks') read; returns the raw row
// array on a usable answer (not degraded, >= MIN_LIVE_NAMES trimmed unique
// names), else null.
// ---------------------------------------------------------------------------
async function tryAskOp(askOp) {
  let result;
  try {
    result = await askOp('list_frameworks', { limit: 1000 });
  } catch (_e) {
    return null;
  }
  if (!result || typeof result !== 'object' || result.degraded) return null;
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const names = new Set();
  for (const r of rows) {
    if (r && typeof r.name === 'string' && r.name.trim()) names.add(r.name.trim());
  }
  if (names.size < MIN_LIVE_NAMES) return null;
  return rows;
}

// ---------------------------------------------------------------------------
// tryFallback(pullTheoFrameworks) -- the bucketed read
// (scripts/build-section-command-ledger.cjs's pullTheoFrameworks), only
// reached when the direct askOp read above was unusable. Returns a row array
// (>= MIN_LIVE_NAMES names) on success, else null.
// ---------------------------------------------------------------------------
async function tryFallback(pullTheoFrameworks) {
  if (typeof pullTheoFrameworks !== 'function') return null;
  let rows;
  try {
    rows = await pullTheoFrameworks();
  } catch (_e) {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  const names = new Set();
  for (const r of rows) {
    if (r && typeof r.name === 'string' && r.name.trim()) names.add(r.name.trim());
  }
  if (names.size < MIN_LIVE_NAMES) return null;
  return rows;
}

function loadDefaultAskOp() {
  // Lazy require: the ONE wire door, only reached inside runLive() when the
  // caller supplied no deps.askOp (i.e. not under test).
  return require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs')).askOp;
}

function loadDefaultPullTheoFrameworks() {
  try {
    const mod = require(path.join(REPO_ROOT, 'scripts', 'build-section-command-ledger.cjs'));
    if (mod && typeof mod.pullTheoFrameworks === 'function') return mod.pullTheoFrameworks;
  } catch (_e) {
    // No fallback available; the caller treats a null return as "closed".
  }
  return null;
}

// ---------------------------------------------------------------------------
// runLive(deps) -- the --live flow. Never calls process.exit; returns
// { ok, code, message, snapshot?, usedFallback? } so both the CLI and a test
// can drive it. deps: { askOp, pullTheoFrameworks, prior, fwNamesPath, now,
// commandsDir, referencedBy, write } -- every key optional.
// ---------------------------------------------------------------------------
async function runLive(deps) {
  const d = deps || {};
  const now = d.now instanceof Date ? d.now : new Date();
  const date = now.toISOString().slice(0, 10);
  const fwNamesPath = d.fwNamesPath || DEFAULT_FW_NAMES_PATH;

  let prior = d.prior;
  if (!prior) {
    try {
      prior = JSON.parse(fs.readFileSync(fwNamesPath, 'utf8'));
    } catch (_e) {
      prior = { framework_names: [], curated_extras: [] };
    }
  }

  const askOp = typeof d.askOp === 'function' ? d.askOp : loadDefaultAskOp();

  let rows = await tryAskOp(askOp);
  let usedFallback = false;
  if (!rows) {
    const pullTheoFrameworks =
      typeof d.pullTheoFrameworks === 'function' ? d.pullTheoFrameworks : loadDefaultPullTheoFrameworks();
    rows = await tryFallback(pullTheoFrameworks);
    if (rows) usedFallback = true;
  }

  if (!rows) {
    return {
      ok: false,
      code: 2,
      reason: 'degraded_or_too_few',
      message:
        'Theo list_frameworks was degraded, text-only, or returned fewer than ' +
        MIN_LIVE_NAMES +
        ' names, and the bucketed fallback read either failed or also returned too few. Writing nothing.',
    };
  }

  const referencedBy =
    typeof d.referencedBy === 'function' ? d.referencedBy : makeReferencedByFromCommandsDir(d.commandsDir || DEFAULT_COMMANDS_DIR);

  const snapshot = buildSnapshot({ rows, prior, date, referencedBy });

  const validation = validateSnapshot(snapshot);
  if (!validation.valid) {
    return {
      ok: false,
      code: 2,
      reason: 'invalid_snapshot',
      message: 'Built snapshot failed its own validation, writing nothing: ' + validation.errors.join('; '),
    };
  }

  const write = typeof d.write === 'function' ? d.write : (p, s) => atomicWriteJSON(p, s);
  write(fwNamesPath, snapshot);

  return {
    ok: true,
    code: 0,
    snapshot,
    usedFallback,
    message:
      'Wrote ' +
      fwNamesPath +
      ' (' +
      snapshot.framework_names.length +
      ' live names, ' +
      snapshot.stale_review.filter((s) => s.decision === 'kept').length +
      ' stale-kept, ' +
      snapshot.stale_review.filter((s) => s.decision === 'dropped').length +
      ' stale-dropped' +
      (usedFallback ? ', via bucketed fallback' : '') +
      ')',
  };
}

// ---------------------------------------------------------------------------
// runCheck(deps) -- the --check flow. Offline: reads the committed snapshot,
// recomputes its hash, validates its shape. NEVER requires brain-client.
// ---------------------------------------------------------------------------
function runCheck(deps) {
  const d = deps || {};
  const fwNamesPath = d.fwNamesPath || DEFAULT_FW_NAMES_PATH;

  let raw;
  try {
    raw = fs.readFileSync(fwNamesPath, 'utf8');
  } catch (e) {
    return { ok: false, code: 1, message: 'Cannot read ' + fwNamesPath + ': ' + (e && e.message ? e.message : String(e)) };
  }

  let snapshot;
  try {
    snapshot = JSON.parse(raw);
  } catch (e) {
    return { ok: false, code: 1, message: 'Cannot parse ' + fwNamesPath + ' as JSON: ' + (e && e.message ? e.message : String(e)) };
  }

  const validation = validateSnapshot(snapshot);
  if (!validation.valid) {
    return {
      ok: false,
      code: 1,
      message: fwNamesPath + ' failed validation: ' + validation.errors.join('; '),
    };
  }

  return {
    ok: true,
    code: 0,
    message: fwNamesPath + ' OK (' + snapshot.framework_names.length + ' names, hash verified)',
  };
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/refresh-framework-names.cjs [--live|--check|--help]',
      '',
      '  --live   one live Theo list_frameworks read through',
      '           lib/core/brain-client.cjs askOp; regenerates',
      '           data/framework-names.json (names only, D-51)',
      '  --check  offline: validates the committed snapshot and',
      '           recomputes its hash; never loads brain-client',
      '  --help   this message',
    ].join('\n')
  );
}

async function main(argv) {
  const args = Array.isArray(argv) ? argv : process.argv.slice(2);

  if (args.includes('--help')) {
    printHelp();
    return 0;
  }
  if (args.includes('--check')) {
    const result = runCheck();
    console.log(result.message);
    return result.code;
  }
  if (args.includes('--live')) {
    const result = await runLive();
    console.log(result.message);
    return result.code;
  }

  printHelp();
  return 1;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error('refresh-framework-names: uncaught error: ' + (e && e.stack ? e.stack : String(e)));
      process.exit(1);
    });
}

module.exports = {
  MIN_LIVE_NAMES,
  namesSha256,
  buildSnapshot,
  validateSnapshot,
  makeReferencedByFromCommandsDir,
  runLive,
  runCheck,
  main,
};
