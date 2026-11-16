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
 * NAMES, PLUS JOB STATEMENTS: NEVER COMMIT A THEO DESCRIPTION (IP RULING,
 * spike-findings skill). buildSnapshot copies the `name` field off each row
 * and nothing else -- no description, no category, no internal Theo record
 * id. Owner ruling 22 (2026-11-16, docs/designs/front-door/BUILD-RULES.md)
 * adds ONE exception, in a separate file: --live also writes
 * data/framework-jobs.json, the job statements of each framework (pws_jtbd,
 * pws_jtbd_extra, pws_jtbd_drafts) with their status marks (ruled or draft,
 * main or extra, for a draft its confidence and its drafted-by label, for
 * a ruled statement its basis mark when Theo holds one, for each statement
 * one pws_backed boolean, rulings 27 and 28), plus the alias link of a
 * framework (a name), and nothing else.
 * lib/core/framework-jobs.cjs composes and validates that file against
 * closed key lists. The acceptance grep for this file greps for the literal
 * word "description" outside a proper block-comment line; this header
 * paragraph is the one permitted place for that word.
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
 * JOB STATEMENTS READ (--live only, plan 395-10): `list_frameworks` does not
 * serve the statement keys (measured 2026-11-16: it returns name, category
 * and alias_count only), so --live reads them with fixed, parameterized
 * Cypher through `brainClient.query`, the same door the bucketed names
 * fallback uses: one read per first-character bucket (split on a cap), one
 * catch-all read and one count read. The rows must equal Theo's own counts.
 * A degraded, capped or mismatched read writes NOTHING (neither file) and
 * exits 4. --check validates data/framework-jobs.json offline when it
 * exists. Generic handles only: the Cypher text is fixed, the parameters are
 * a bucket prefix and the character list, never room content (Part 8).
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
 * THEO STAMP (Phase 366 Plan 06, D-17): --live also reads Theo's
 * command-registry `mappedBy` (the same command_neighborhood call the
 * place-8 theo-stamp gate makes) and writes `theo_stamp {mapped_by,
 * plugin_version, refreshed_at}`. The release gate
 * scripts/release-lib/canon-snapshot-gate.sh (RULE 5 place 9) refuses a cut
 * when that stamp is absent or names an older version. --check accepts a
 * snapshot with or without the stamp.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_FW_NAMES_PATH = path.join(REPO_ROOT, 'data', 'framework-names.json');
const DEFAULT_COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
// Phase 395 plan 10 (ruling 22): the job statements file and its composer and validator. framework-jobs.cjs uses
// node built-ins only, so requiring it here never loads brain-client.
const DEFAULT_FW_JOBS_PATH = path.join(REPO_ROOT, 'data', 'framework-jobs.json');
const FJ = require(path.join(REPO_ROOT, 'lib', 'core', 'framework-jobs.cjs'));

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

  // Phase 366 Plan 06 (D-17): theo_stamp is optional (a snapshot refreshed
  // before this plan carries none, and --check must still pass it); when
  // present, its three fields must be non-empty strings. The release gate
  // (scripts/release-lib/canon-snapshot-gate.sh, RULE 5 place 9) is what
  // refuses an absent or lagging stamp, not this offline shape check.
  if (Object.prototype.hasOwnProperty.call(snapshot, 'theo_stamp')) {
    const st = snapshot.theo_stamp;
    if (!st || typeof st !== 'object' || Array.isArray(st)) {
      errors.push('theo_stamp is present but not an object');
    } else {
      for (const field of ['mapped_by', 'plugin_version', 'refreshed_at']) {
        if (typeof st[field] !== 'string' || st[field].length === 0) {
          errors.push('theo_stamp.' + field + ' must be a non-empty string');
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// readDefaultMappedBy() -- Theo's command-registry stamp (`mappedBy`), read
// with the SAME call scripts/release-lib/theo-stamp-gate.sh's default reader
// makes: callTool('command_neighborhood', { command: '/mos:act' }), rows[0].
// No new Theo op. Generic handle only (a command name), never room content
// (Part 8). Returns the raw stamp string, or '' on any failure.
// ---------------------------------------------------------------------------
async function readDefaultMappedBy() {
  try {
    const bc = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs'));
    const r = await bc.callTool('command_neighborhood', { command: '/mos:act' });
    const rows = (r && r.rows) || [];
    const row = rows[0] || {};
    return typeof row.mappedBy === 'string' ? row.mappedBy.trim() : '';
  } catch (_e) {
    return '';
  }
}

function readRepoVersionSafe() {
  try {
    return require(path.join(REPO_ROOT, 'lib', 'core', 'repo-version.cjs')).readRepoVersion().version || '';
  } catch (_e) {
    return '';
  }
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
// Phase 395 plan 10 (ruling 22): the job statements read. Three FIXED Cypher
// texts; every variation rides in $params (check-substrate.cjs rule
// m4-cypher-interpolation forbids concatenated Cypher). A row is read when the
// node has a statement or an alias link; the row carries the name, the alias
// link, the statement keys and pws_jtbd_basis only. Measured on 2026-11-16
// through brain-client query, before Theo batch p49-promote-high-v1: 376 rows
// selected, 70 with pws_jtbd, 289 with pws_jtbd_drafts, 0 with pws_jtbd_extra;
// pws_jtbd_draft_confidence and pws_jtbd_draft_by are one string per node
// (lib/core/framework-jobs.cjs also takes an index-aligned list). After that
// batch the Theo session reports 184 with pws_jtbd and 12 with pws_jtbd_extra.
// Owner rulings 27 and 28: the read also returns the 3 pws_backed keys of the exam 2 batch (one boolean for
// pws_jtbd, one list aligned with pws_jtbd_extra, one list aligned with pws_jtbd_drafts); an absent key reads as
// false or as []. lib/core/framework-jobs.cjs rowMarkErrors stops the refresh when a list does not line up.
// ---------------------------------------------------------------------------
const JOBS_HAS = "(toString(coalesce(f.pws_jtbd, '')) <> '' OR size(coalesce(f.pws_jtbd_extra, [])) > 0 OR size(coalesce(f.pws_jtbd_drafts, [])) > 0 OR toString(coalesce(f.alias_of, '')) <> '')";
const JOBS_RETURN = [
  "RETURN f.name AS name, toString(coalesce(f.alias_of, '')) AS alias_of,",
  "toString(coalesce(f.pws_jtbd, '')) AS pws_jtbd, coalesce(f.pws_jtbd_extra, []) AS pws_jtbd_extra,",
  "coalesce(f.pws_jtbd_drafts, []) AS pws_jtbd_drafts, coalesce(f.pws_jtbd_draft_confidence, '') AS pws_jtbd_draft_confidence,",
  "coalesce(f.pws_jtbd_draft_by, '') AS pws_jtbd_draft_by, toString(coalesce(f.pws_jtbd_basis, '')) AS pws_jtbd_basis,",
  'coalesce(f.pws_jtbd_pws_backed, false) AS pws_jtbd_pws_backed, coalesce(f.pws_jtbd_extra_pws_backed, []) AS pws_jtbd_extra_pws_backed,',
  'coalesce(f.pws_jtbd_drafts_pws_backed, []) AS pws_jtbd_drafts_pws_backed',
  'ORDER BY name LIMIT 100',
].join(' ');
const CYPHER_JOBS_PREFIX = ['MATCH (f:Framework)', 'WHERE toLower(left(f.name, $n)) = $prefix', 'AND', JOBS_HAS, JOBS_RETURN].join(' ');
const CYPHER_JOBS_OTHER = ['MATCH (f:Framework)', 'WHERE NOT toLower(left(f.name, 1)) IN $alnum', 'AND', JOBS_HAS, JOBS_RETURN].join(' ');
const CYPHER_JOBS_COUNT = [
  'MATCH (f:Framework)',
  'WHERE',
  JOBS_HAS,
  'RETURN count(f) AS selected,',
  "sum(CASE WHEN toString(coalesce(f.pws_jtbd, '')) <> '' THEN 1 ELSE 0 END) AS ruled,",
  'sum(CASE WHEN size(coalesce(f.pws_jtbd_extra, [])) > 0 THEN 1 ELSE 0 END) AS with_extra,',
  'sum(CASE WHEN size(coalesce(f.pws_jtbd_drafts, [])) > 0 THEN 1 ELSE 0 END) AS with_drafts',
].join(' ');
const JOBS_SNAPSHOT_NOTE =
  'The job statements of each :Framework, read from Theo through lib/core/brain-client.cjs query (a fixed bucketed read). ' +
  'Owner ruling 22: only the job statements and their status marks are carried, no other Theo text. ' +
  'Ruling 21: a draft is shown as a draft and does not steer selection. ' +
  'Rulings 27 and 28: each statement carries one pws_backed mark; in this version the mark is shown and does not steer. ' +
  'Refresh with: node scripts/refresh-framework-names.cjs --live';
const JOBS_ALNUM = '0123456789abcdefghijklmnopqrstuvwxyz'.split('');
const JOBS_PAGE_CAP = 100;
const JOBS_MAX_DEPTH = 2;

// jobsPage(res) -- one query answer to { kind: 'rows', rows } | { kind: 'cap' } | { kind: 'fail', reason }. A page of
// JOBS_PAGE_CAP rows or more counts as capped (LIMIT 100 can cut a bucket without a notice).
function jobsPage(res) {
  if (!res || typeof res !== 'object') return { kind: 'fail', reason: 'no answer' };
  const rows = Array.isArray(res.rows) ? res.rows : Array.isArray(res.records) ? res.records : null;
  if (typeof res.text === 'string' && /ROW_CAP/.test(res.text) && (!rows || rows.length === 0)) return { kind: 'cap' };
  if (!rows || res.error || res.degraded) return { kind: 'fail', reason: typeof res.error === 'string' ? res.error : 'no rows array' };
  if (rows.length >= JOBS_PAGE_CAP) return { kind: 'cap' };
  return { kind: 'rows', rows };
}

function hasItems(v) {
  return (Array.isArray(v) || typeof v === 'string') && v.length > 0;
}

// pullJobRows(query) -- the bucketed job statements read. query is brain-client's query(cypher, params) or a test
// stub. Returns { ok: true, rows, counts } only when every bucket answered and the rows equal Theo's own count;
// else { ok: false, reason }. Never writes.
async function pullJobRows(query) {
  if (typeof query !== 'function') return { ok: false, reason: 'no query function' };
  const rows = [];
  async function ask(cypher, params) {
    try {
      return jobsPage(await query(cypher, params));
    } catch (_e) {
      return { kind: 'fail', reason: 'the read threw' };
    }
  }
  async function bucket(prefix, depth) {
    const p = await ask(CYPHER_JOBS_PREFIX, { n: prefix.length, prefix: prefix });
    if (p.kind === 'rows') {
      rows.push.apply(rows, p.rows);
      return null;
    }
    if (p.kind === 'fail') return 'bucket "' + prefix + '": ' + p.reason;
    if (depth >= JOBS_MAX_DEPTH) return 'bucket "' + prefix + '" is still capped at depth ' + depth;
    for (const c of JOBS_ALNUM) {
      const bad = await bucket(prefix + c, depth + 1);
      if (bad) return bad;
    }
    return null;
  }
  for (const c of JOBS_ALNUM) {
    const bad = await bucket(c, 0);
    if (bad) return { ok: false, reason: bad };
  }
  const other = await ask(CYPHER_JOBS_OTHER, { alnum: JOBS_ALNUM });
  if (other.kind !== 'rows') return { ok: false, reason: 'catch-all bucket: ' + (other.kind === 'cap' ? 'capped' : other.reason) };
  rows.push.apply(rows, other.rows);
  const counted = await ask(CYPHER_JOBS_COUNT, {});
  const want = counted.kind === 'rows' ? counted.rows[0] : null;
  if (!want || typeof want.selected !== 'number') return { ok: false, reason: 'the count read failed' };
  const got = {
    selected: rows.length,
    ruled: rows.filter((r) => r && typeof r.pws_jtbd === 'string' && r.pws_jtbd !== '').length,
    with_extra: rows.filter((r) => r && hasItems(r.pws_jtbd_extra)).length,
    with_drafts: rows.filter((r) => r && hasItems(r.pws_jtbd_drafts)).length,
  };
  for (const k of ['selected', 'ruled', 'with_extra', 'with_drafts']) {
    if (got[k] !== want[k]) {
      return { ok: false, reason: 'the rows do not match the count of Theo (' + k + ': read ' + got[k] + ', counted ' + want[k] + ')' };
    }
  }
  return { ok: true, rows: rows, counts: got };
}

function loadDefaultQuery() {
  // Lazy require, only on the real wire path of runLive() (no injected askOp and no injected readJobRows).
  return require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs')).query;
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

  // Phase 366 Plan 06 (D-17): stamp the snapshot with Theo's own mappedBy so
  // the release gate (RULE 5 place 9) can prove, offline, that this refresh
  // ran after Theo's re-emit for the current version. The default reader is
  // used only on the real wire path (no injected askOp); a test that injects
  // askOp without readMappedBy never stamps and never dials Theo.
  let readMappedBy = null;
  if (typeof d.readMappedBy === 'function') readMappedBy = d.readMappedBy;
  else if (typeof d.askOp !== 'function') readMappedBy = readDefaultMappedBy;
  let stampMissing = false;
  if (readMappedBy) {
    let mappedBy = '';
    try {
      mappedBy = await readMappedBy();
    } catch (_e) {
      mappedBy = '';
    }
    mappedBy = typeof mappedBy === 'string' ? mappedBy.trim() : '';
    const pluginVersion = typeof d.pluginVersion === 'string' && d.pluginVersion ? d.pluginVersion : readRepoVersionSafe();
    if (mappedBy && pluginVersion) {
      snapshot.theo_stamp = { mapped_by: mappedBy, plugin_version: pluginVersion, refreshed_at: now.toISOString() };
    } else {
      stampMissing = true;
    }
  }

  const validation = validateSnapshot(snapshot);
  if (!validation.valid) {
    return {
      ok: false,
      code: 2,
      reason: 'invalid_snapshot',
      message: 'Built snapshot failed its own validation, writing nothing: ' + validation.errors.join('; '),
    };
  }

  // Phase 395 plan 10 (ruling 22): the job statements are read and checked BEFORE anything is written, so a degraded,
  // capped or mismatched read writes neither file. The default reader runs only on the real wire path (no injected
  // askOp), the same rule as readMappedBy; a test injects readJobRows. An injected askOp alone reads no statements.
  let readJobRows = null;
  if (typeof d.readJobRows === 'function') readJobRows = d.readJobRows;
  else if (typeof d.askOp !== 'function') readJobRows = () => pullJobRows(loadDefaultQuery());
  const fwJobsPath = d.fwJobsPath || DEFAULT_FW_JOBS_PATH;
  let jobsSnapshot = null;
  if (readJobRows) {
    let pulled = null;
    try {
      pulled = await readJobRows();
    } catch (_e) {
      pulled = null;
    }
    if (!pulled || pulled.ok !== true || !Array.isArray(pulled.rows)) {
      return {
        ok: false,
        code: 4,
        reason: 'jobs_unreadable',
        message:
          'Theo job statements read was degraded, capped or did not match the count of Theo (' +
          (pulled && pulled.reason ? pulled.reason : 'no answer') +
          '). Writing nothing.',
      };
    }
    // Rulings 27 and 28: a pws_backed list that does not line up with its statements stops the refresh; it is never
    // read as false.
    const markErrors = FJ.rowMarkErrors(pulled.rows);
    if (markErrors.length > 0) {
      return {
        ok: false,
        code: 4,
        reason: 'misaligned_marks',
        message: 'Theo pws_backed marks do not line up with their statements, writing nothing: ' + markErrors.slice(0, 5).join('; '),
      };
    }
    jobsSnapshot = FJ.buildJobsSnapshot({ rows: pulled.rows, date, note: JOBS_SNAPSHOT_NOTE });
    const jobsValidation = FJ.validateJobsSnapshot(jobsSnapshot);
    if (!jobsValidation.valid) {
      return {
        ok: false,
        code: 4,
        reason: 'invalid_jobs_snapshot',
        message: 'Built job statements snapshot failed its own validation, writing nothing: ' + jobsValidation.errors.slice(0, 5).join('; '),
      };
    }
  }
  const jobsNote = jobsSnapshot
    ? ' Also wrote ' +
      fwJobsPath +
      ' (job statements of ' +
      jobsSnapshot.counts.frameworks +
      ' frameworks: ' +
      jobsSnapshot.counts.ruled_main +
      ' ruled main, ' +
      jobsSnapshot.counts.ruled_extra +
      ' ruled extra, ' +
      jobsSnapshot.counts.drafts +
      ' drafts in ' +
      jobsSnapshot.counts.with_drafts +
      ' frameworks, ' +
      jobsSnapshot.counts.aliases +
      ' alias links; pws_backed: ' +
      jobsSnapshot.counts.ruled_main_pws_backed +
      ' ruled main, ' +
      jobsSnapshot.counts.ruled_extra_pws_backed +
      ' ruled extra, ' +
      jobsSnapshot.counts.drafts_pws_backed +
      ' drafts).'
    : '';

  const write = typeof d.write === 'function' ? d.write : (p, s) => atomicWriteJSON(p, s);
  write(fwNamesPath, snapshot);
  if (jobsSnapshot) {
    const writeJobs = typeof d.writeJobs === 'function' ? d.writeJobs : (p, s) => atomicWriteJSON(p, s);
    writeJobs(fwJobsPath, jobsSnapshot);
  }

  if (stampMissing) {
    return {
      ok: false,
      code: 3,
      reason: 'theo_stamp_unreadable',
      snapshot,
      usedFallback,
      message:
        'Wrote ' +
        fwNamesPath +
        ' names WITHOUT a theo_stamp: Theo mappedBy (or the repo version) could not be read. ' +
        'The release gate (RULE 5 place 9) will refuse until this command runs again with Theo reachable.' +
        jobsNote,
    };
  }

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
      ')' +
      jobsNote,
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

  // Phase 395 plan 10 (ruling 22): the job statements file, validated offline when it exists. Before the first --live
  // run after plan 395-10 the file is absent; the message names that, and it is not an error.
  const fwJobsPath = d.fwJobsPath || DEFAULT_FW_JOBS_PATH;
  let jobsNote = '; ' + fwJobsPath + ' absent (job statements not refreshed yet)';
  if (fs.existsSync(fwJobsPath)) {
    let jobs;
    try {
      jobs = JSON.parse(fs.readFileSync(fwJobsPath, 'utf8'));
    } catch (e) {
      return { ok: false, code: 1, message: 'Cannot parse ' + fwJobsPath + ' as JSON: ' + (e && e.message ? e.message : String(e)) };
    }
    const jobsValidation = FJ.validateJobsSnapshot(jobs);
    if (!jobsValidation.valid) {
      return { ok: false, code: 1, message: fwJobsPath + ' failed validation: ' + jobsValidation.errors.slice(0, 10).join('; ') };
    }
    jobsNote = '; ' + fwJobsPath + ' OK (job statements of ' + jobs.counts.frameworks + ' frameworks, hash verified)';
  }

  return {
    ok: true,
    code: 0,
    message: fwNamesPath + ' OK (' + snapshot.framework_names.length + ' names, hash verified)' + jobsNote,
  };
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/refresh-framework-names.cjs [--live|--check|--help]',
      '',
      '  --live   one live Theo list_frameworks read through',
      '           lib/core/brain-client.cjs askOp; regenerates',
      '           data/framework-names.json (names only, D-51) and',
      '           stamps theo_stamp {mapped_by, plugin_version,',
      '           refreshed_at} from Theo mappedBy (366 D-17); also',
      '           writes data/framework-jobs.json (job statements and',
      '           their status marks only, ruling 22; one pws_backed',
      '           mark each, rulings 27 and 28); a degraded or',
      '           partial read writes neither file (exit 4)',
      '  --check  offline: validates the committed snapshot and',
      '           recomputes its hash; never loads brain-client;',
      '           also validates data/framework-jobs.json if present',
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
  pullJobRows,
  CYPHER_JOBS_PREFIX,
  CYPHER_JOBS_OTHER,
  CYPHER_JOBS_COUNT,
};
