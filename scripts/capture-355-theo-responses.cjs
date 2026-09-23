'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/capture-355-theo-responses.cjs -- Phase 355 Plan 14 Task 1
 * (HIPS-04, HIPS-09, D-09, D-11, D-13). Dev-time only; never required from
 * lib/ or hooks/.
 *
 * Theo via brain-client callTool only (THEO-04); canon names only (Part 8);
 * internal ids replaced before write (Brain IP).
 *
 * capturePairs(pairs, { callTool, names, now }) calls
 * callTool('find_connections', { from, to }) exactly once per distinct
 * canon-name pair; a pair whose two names are not exact members of `names`
 * is refused (reason 'not_canon_name') and never reaches callTool.
 *
 * sanitizeResponse(res, ctx) turns one raw brain-client answer into the
 * shape written to the capture file: a success answer keeps pathLabels,
 * edges, hops, coverage and refusals byte-identical, but every path node
 * that is not itself a canon Framework name is replaced by a synthetic
 * '<lowercased label>-captured-<n>' id, consistently for the same raw id
 * across the whole file (via the shared `ctx.idMap`/`ctx.counters`
 * capturePairs threads through every call) -- Theo's own internal
 * BrainRecord/DomainConcept ids never reach the committed fixture. A
 * transport outage (`res` null/undefined) is recorded as `{ "$null": true }`
 * and replays through `tests/helpers/theo-replay-355.cjs`'s own `$null`
 * sentinel to the identical `null` a live outage produces -- byte-for-byte
 * fixture parity with that helper's existing vocabulary. A sentinel-error
 * object (`res.error` a string: egress_blocked / tier_denied / rate_limited
 * / invalid_key / an unlisted-tool message) or a caught transport exception
 * is recorded as `{ "$error": "<code>" }`; a bare string / array reply is
 * recorded as `{ "$text": true }` -- never the body. Both of the latter two
 * are DEGENERATE capture outcomes: Theo is confirmed reachable and served
 * (355-RESEARCH.md "Live Theo Contract"), so the one live capture this plan
 * actually runs is not expected to produce either shape; they exist so a
 * transient failure during a future --live run (this script, or 355-24's
 * --append) is recorded honestly rather than crashing the capture or
 * silently dropping a pair. Because `theo-replay-355.cjs` (355-06, read
 * only here) has no `$error`/`$text` sentinel of its own, a captured
 * `$error`/`$text` entry replays as that literal object rather than as the
 * original null/string -- `lib/core/verification-stamp.cjs`'s own
 * `_theoOutcomeFor` still resolves it to an honest `unverified` stamp (no
 * `paths` key, no `refusals` array -> `theo`/`malformed_response`), never a
 * fabricated path, so no test that replays this file is ever handed a lie;
 * it is simply a coarser reason than the live sentinel would have carried.
 * The success and `$null` shapes -- the only two this plan's own capture
 * run can produce -- replay to the exact same Stamp every time.
 *
 * validateCapture(file) is the --check gate: every response key must be a
 * "<from>\u0000<to>" pair of exact snapshot members; no string anywhere in
 * the file may match a raw internal-id pattern (Theo's own
 * "brainrecord-export-13" shape, generalized to "<word>-export-<n>"); the
 * file must carry captured_at and snapshot_sha256; and no path entry's
 * `hops` may disagree with its own `edges.length`.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures');
const DEFAULT_OUT = path.join(FIXTURES_ROOT, '355-theo-find-connections-responses.json');

// verification-stamp.cjs is a pure fs/zod module at require time (its own
// wire door to brain-client.cjs is a LAZY require reached only from inside
// _theoOutcomeFor, which this script never calls) -- reusing its
// loadFrameworkNames() here opens no socket (Part 7: reuse before build).
const verificationStamp = require('../lib/core/verification-stamp.cjs');

const INTERNAL_ID_RE = /\b[a-zA-Z][a-zA-Z]*-export-\d+\b/;

// ---------------------------------------------------------------------------
// loadFrameworkNamesForCapture() / loadSnapshotSha256(): the one canon-name
// gate and the one provenance hash, both read fresh from
// data/framework-names.json (D-10, D-48: no fuzzy match, no case fold).
// ---------------------------------------------------------------------------
function loadFrameworkNamesForCapture() {
  return verificationStamp.loadFrameworkNames();
}

function loadSnapshotSha256() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, 'data', 'framework-names.json'), 'utf8');
  const parsed = JSON.parse(raw);
  return typeof parsed.source_sha256 === 'string' ? parsed.source_sha256 : null;
}

// ---------------------------------------------------------------------------
// _replacementId(rawId, label, ctx): the synthetic id for one non-canon path
// node, stable within ctx.idMap so the same raw id always maps to the same
// replacement across the whole capture run/file (D-11, Brain IP).
// ---------------------------------------------------------------------------
function _replacementId(rawId, label, ctx) {
  if (ctx.idMap.has(rawId)) return ctx.idMap.get(rawId);
  const lowerLabel = String(label || 'node').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'node';
  const n = (ctx.counters.get(lowerLabel) || 0) + 1;
  ctx.counters.set(lowerLabel, n);
  const replacement = lowerLabel + '-captured-' + n;
  ctx.idMap.set(rawId, replacement);
  return replacement;
}

function _sanitizePathEntry(entry, ctx) {
  if (!entry || typeof entry !== 'object') return entry;
  const nodes = Array.isArray(entry.path) ? entry.path : [];
  const labels = Array.isArray(entry.pathLabels) ? entry.pathLabels : [];
  const sanitizedNodes = nodes.map((node, i) => {
    const label = labels[i];
    if (label === 'Framework') return node;
    return _replacementId(node, label, ctx);
  });
  const out = { path: sanitizedNodes };
  if (Object.prototype.hasOwnProperty.call(entry, 'pathLabels')) out.pathLabels = entry.pathLabels;
  if (Object.prototype.hasOwnProperty.call(entry, 'edges')) out.edges = entry.edges;
  if (Object.prototype.hasOwnProperty.call(entry, 'hops')) out.hops = entry.hops;
  return out;
}

// ---------------------------------------------------------------------------
// sanitizeResponse(res, ctx): see the module docblock for the full
// null/error/text/success contract. `ctx` is optional -- a caller that
// wants replacement ids consistent across several calls (capturePairs)
// passes one shared ctx; a standalone call gets a fresh one-off context.
// ---------------------------------------------------------------------------
function sanitizeResponse(res, ctx) {
  const context = ctx || { names: loadFrameworkNamesForCapture(), idMap: new Map(), counters: new Map() };

  if (res === null || res === undefined) return { $null: true };
  if (res && typeof res === 'object' && res.$__capture_exception === true) {
    return { $error: typeof res.code === 'string' ? res.code : 'exception' };
  }
  if (typeof res === 'string') return { $text: true };
  if (Array.isArray(res)) return { $text: true };
  if (typeof res !== 'object') return { $text: true };
  if (typeof res.error === 'string') return { $error: res.error };
  if (typeof res.text === 'string'
    && !Object.prototype.hasOwnProperty.call(res, 'paths')
    && !Object.prototype.hasOwnProperty.call(res, 'refusals')) {
    return { $text: true };
  }

  const out = {};
  if (Object.prototype.hasOwnProperty.call(res, 'coverage')) out.coverage = res.coverage;
  if (Object.prototype.hasOwnProperty.call(res, 'refusals')) out.refusals = res.refusals;
  if (Object.prototype.hasOwnProperty.call(res, 'paths')) {
    out.paths = Array.isArray(res.paths) ? res.paths.map((p) => _sanitizePathEntry(p, context)) : res.paths;
  }
  if (Object.prototype.hasOwnProperty.call(res, 'diagnostics')) out.diagnostics = res.diagnostics;
  return out;
}

// ---------------------------------------------------------------------------
// capturePairs(pairs, { callTool, names, now }): the one loop that decides,
// per distinct { from, to } pair, whether Theo is ever called. `now`
// defaults to Date.now, injectable for a deterministic latency test.
// ---------------------------------------------------------------------------
async function capturePairs(pairs, deps) {
  const callTool = deps && deps.callTool;
  const names = (deps && deps.names) || new Set();
  const now = (deps && typeof deps.now === 'function') ? deps.now : Date.now;
  if (typeof callTool !== 'function') throw new Error('capturePairs: deps.callTool is required');

  const ctx = { names, idMap: new Map(), counters: new Map() };
  const responses = {};
  const refused = [];
  const latencyMs = [];
  let calls = 0;
  let sawSuccess = false;

  const seen = new Set();
  const list = Array.isArray(pairs) ? pairs : [];
  for (const p of list) {
    const from = p && p.from;
    const to = p && p.to;
    if (typeof from !== 'string' || typeof to !== 'string' || from.length === 0 || to.length === 0) continue;
    const key = from + '\u0000' + to;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!names.has(from) || !names.has(to)) {
      refused.push({ from, to, reason: 'not_canon_name' });
      continue;
    }

    const t0 = now();
    let raw;
    try {
      raw = await callTool('find_connections', { from, to });
    } catch (e) {
      raw = { $__capture_exception: true, code: (e && e.message) || 'exception' };
    }
    const t1 = now();
    calls += 1;
    latencyMs.push(t1 - t0);

    const sanitized = sanitizeResponse(raw, ctx);
    responses[key] = sanitized;
    if (!sanitized.$null && !sanitized.$error && !sanitized.$text) sawSuccess = true;
  }

  return {
    calls,
    latency_ms: latencyMs,
    responses,
    refused,
    served: calls > 0 && sawSuccess,
  };
}

// ---------------------------------------------------------------------------
// validateCapture(file): the --check gate. Never opens a socket, never
// requires brain-client.cjs.
// ---------------------------------------------------------------------------
function _scanForInternalIds(value, key, errors) {
  if (typeof value === 'string') {
    if (INTERNAL_ID_RE.test(value)) errors.push('response "' + key + '" carries a raw internal id: ' + value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) _scanForInternalIds(v, key, errors);
    return;
  }
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) _scanForInternalIds(value[k], key, errors);
  }
}

function _scanForHopMismatch(entry, key, errors) {
  if (!entry || !Array.isArray(entry.paths)) return;
  for (const p of entry.paths) {
    if (!p || typeof p !== 'object') continue;
    const edgesLen = Array.isArray(p.edges) ? p.edges.length : null;
    if (typeof p.hops === 'number' && edgesLen !== null && p.hops !== edgesLen) {
      errors.push('response "' + key + '" has a path whose hops (' + p.hops + ') disagrees with edges.length (' + edgesLen + ')');
    }
  }
}

function validateCapture(file) {
  const errors = [];
  if (!file || typeof file !== 'object') return { ok: false, errors: ['capture file is not an object'] };

  if (typeof file.captured_at !== 'string' || file.captured_at.length === 0) errors.push('missing captured_at');
  if (typeof file.snapshot_sha256 !== 'string' || file.snapshot_sha256.length === 0) errors.push('missing snapshot_sha256');

  const names = loadFrameworkNamesForCapture();
  const responses = (file && file.responses && typeof file.responses === 'object') ? file.responses : {};
  for (const key of Object.keys(responses)) {
    const parts = key.split('\u0000');
    if (parts.length !== 2 || !names.has(parts[0]) || !names.has(parts[1])) {
      errors.push('key "' + key + '" is not a pair of exact snapshot-member names');
    }
    const entry = responses[key];
    _scanForInternalIds(entry, key, errors);
    _scanForHopMismatch(entry, key, errors);
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// resolveGuardedPath(p, opts): realpath + path.sep containment under
// tests/fixtures/ (the eval-icm-writers.cjs:81-102 idiom, T-355-67). Exits
// the process on an escape attempt (`exitOnEscape`, default true) so both
// --live --out and --check --file share one refusal path; a caller that
// wants the boolean instead (this script's own test) passes
// `exitOnEscape: false`.
// ---------------------------------------------------------------------------
function resolveGuardedPath(p, opts) {
  const exitOnEscape = !opts || opts.exitOnEscape !== false;
  const abs = path.resolve(process.cwd(), p);
  const existingDir = fs.existsSync(abs) ? abs : path.dirname(abs);
  let realDir;
  try {
    realDir = fs.realpathSync(fs.existsSync(abs) ? path.dirname(abs) : existingDir);
  } catch (_e) {
    realDir = path.dirname(abs);
  }
  const realForCheck = path.join(realDir, path.basename(abs));
  const prefixWithSep = FIXTURES_ROOT + path.sep;
  const within = (realForCheck === FIXTURES_ROOT) || realForCheck.indexOf(prefixWithSep) === 0;
  if (!within) {
    if (exitOnEscape) {
      // eslint-disable-next-line no-console
      console.error('capture-355-theo-responses: refused -- ' + p + ' is outside tests/fixtures/ (T-355-67)');
      process.exit(1);
    }
    return { abs, within: false };
  }
  return { abs, within: true };
}

// ---------------------------------------------------------------------------
// _writeAtomic(outPath, data): temp-then-rename (D-11).
// ---------------------------------------------------------------------------
function _writeAtomic(outPath, data) {
  const tmpPath = outPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, outPath);
}

function _mergeCaptureFile(existing, result, snapshotSha256) {
  const capturedAt = new Date().toISOString();
  if (!existing) {
    return {
      captured_at: capturedAt,
      theo_host: os.hostname(),
      snapshot_sha256: snapshotSha256,
      served: result.served,
      calls: result.calls,
      latency_ms: result.latency_ms,
      responses: result.responses,
    };
  }
  const mergedResponses = Object.assign({}, existing.responses || {});
  let newCalls = 0;
  const newLatency = (existing.latency_ms || []).slice();
  for (const key of Object.keys(result.responses)) {
    if (!Object.prototype.hasOwnProperty.call(mergedResponses, key)) {
      mergedResponses[key] = result.responses[key];
      newCalls += 1;
      newLatency.push.apply(newLatency, []);
    }
  }
  if (newCalls > 0) newLatency.push.apply(newLatency, result.latency_ms);
  return {
    captured_at: capturedAt,
    theo_host: os.hostname(),
    snapshot_sha256: snapshotSha256,
    served: Boolean(existing.served) || result.served,
    calls: (typeof existing.calls === 'number' ? existing.calls : 0) + newCalls,
    latency_ms: newLatency,
    responses: mergedResponses,
  };
}

// ---------------------------------------------------------------------------
// CLI. --live --pairs <json> [--out <path>] [--append]; --check [--file
// <path>]; --help. Flag-style argv, no subcommand keyword (the
// build-section-command-ledger.cjs main() shape).
// ---------------------------------------------------------------------------
function _flagValue(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log([
    'capture-355-theo-responses.cjs -- Theo find_connections capture (D-09, D-11, D-13)',
    'Usage:',
    '  node scripts/capture-355-theo-responses.cjs --live --pairs <json> [--out <path>] [--append]',
    '  node scripts/capture-355-theo-responses.cjs --check [--file <path>]',
    '  node scripts/capture-355-theo-responses.cjs --help',
    'Default out/file: ' + path.relative(REPO_ROOT, DEFAULT_OUT),
  ].join('\n'));
}

function runCheckCli(argv) {
  const fileArg = _flagValue(argv, '--file') || DEFAULT_OUT;
  const guarded = resolveGuardedPath(fileArg);
  const filePath = guarded.abs;

  if (!fs.existsSync(filePath)) {
    // eslint-disable-next-line no-console
    console.log('capture-355-theo-responses --check: SKIP (' + path.relative(REPO_ROOT, filePath) + ' does not exist yet)');
    process.exit(77);
    return;
  }

  let file;
  try {
    file = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('capture-355-theo-responses --check: FAILED (cannot parse ' + filePath + ': ' + e.message + ')');
    process.exit(1);
    return;
  }

  const result = validateCapture(file);
  if (!result.ok) {
    for (const err of result.errors) {
      // eslint-disable-next-line no-console
      console.error('capture-355-theo-responses --check: FAILED (' + err + ')');
    }
    process.exit(1);
    return;
  }

  // eslint-disable-next-line no-console
  console.log('capture-355-theo-responses --check: OK (' + Object.keys(file.responses || {}).length + ' pairs, served=' + file.served + ')');
  process.exit(0);
}

async function runLiveCli(argv) {
  const pairsArg = _flagValue(argv, '--pairs');
  if (!pairsArg) {
    // eslint-disable-next-line no-console
    console.error('capture-355-theo-responses --live: --pairs <json> is required');
    process.exit(1);
    return;
  }
  const outArg = _flagValue(argv, '--out') || DEFAULT_OUT;
  const guarded = resolveGuardedPath(outArg);
  const outPath = guarded.abs;
  const append = argv.includes('--append');

  const pairsRaw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), pairsArg), 'utf8'));
  const pairs = Array.isArray(pairsRaw) ? pairsRaw : (Array.isArray(pairsRaw && pairsRaw.pairs) ? pairsRaw.pairs : []);

  // Lazy require: the ONE wire door, reached only in this --live branch.
  // eslint-disable-next-line global-require
  const brainClient = require('../lib/core/brain-client.cjs');
  const names = loadFrameworkNamesForCapture();

  const result = await capturePairs(pairs, { callTool: brainClient.callTool, names });

  let existing = null;
  if (append && fs.existsSync(outPath)) {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  }

  const snapshotSha256 = loadSnapshotSha256();
  const merged = _mergeCaptureFile(existing, result, snapshotSha256);
  _writeAtomic(outPath, merged);

  // eslint-disable-next-line no-console
  console.log('capture-355-theo-responses --live: wrote ' + path.relative(REPO_ROOT, outPath)
    + ' (' + result.calls + ' calls this run, served=' + merged.served + ')');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help')) {
    printHelp();
    process.exit(argv.length === 0 ? 1 : 0);
    return;
  }
  if (argv.includes('--check')) {
    runCheckCli(argv);
    return;
  }
  if (argv.includes('--live')) {
    runLiveCli(argv).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('capture-355-theo-responses --live: ' + ((e && e.stack) || e));
      process.exit(1);
    });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('capture-355-theo-responses: unknown invocation; see --help');
  process.exit(1);
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    capturePairs,
    sanitizeResponse,
    validateCapture,
    resolveGuardedPath,
    loadFrameworkNamesForCapture,
    loadSnapshotSha256,
    _mergeCaptureFile,
    _writeAtomic,
    DEFAULT_OUT,
    FIXTURES_ROOT,
  };
}
