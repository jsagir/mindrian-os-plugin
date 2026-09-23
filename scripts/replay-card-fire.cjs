#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 357-02 -- replay-card-fire.cjs: the gate-triad replay harness.
 * =====================================================================
 * DEV-TIME ONLY. Never required from lib/ or hooks/. Never a hook itself.
 * Makes ZERO network calls (globalThis.fetch is replaced with a thrower for
 * the whole run, restored in a finally). No em-dashes anywhere (hyphens
 * only, CLAUDE.md HARD RULE).
 *
 * Purpose (SPEC R2 / R5, D-13, R-H, R-I): replay every labeled corpus entry
 * (scripts/card-fire-replay-corpus.cjs::loadCorpus) through the REAL
 * Stop-hook card-gate predicate on both Tri-Polar surfaces:
 *   - CLI surface : deriveTurnSignals(envelope) -> classifyCardFire(turn, registry)
 *                   (scripts/check-card-fire.cjs), mirroring that file's own
 *                   main() bookkeeping (retry/session counters, consumption).
 *   - MCP surface : lib/mcp/stop-gate-handler.cjs::handleStopEvent(sid, ctx),
 *                   the daemon-side host that WRAPS the same predicate.
 * No mocks of either. This is the measuring instrument every later 357 plan
 * (corpus authoring, D-07/D-08a fixes, the standing bar gate) reads.
 *
 * Hermetic isolation (Pattern 2, T-357-03/T-357-04 mitigations): every entry,
 * on every surface, runs under a FRESH mkdtemp MINDRIAN_HOME,
 * CARD_FIRE_SIDECHANNEL_PATH, MINDRIAN_ROOMS_HOME and MINDRIAN_ROOMS_ROOT with
 * a unique session id and (for MCP) stopGateHandler._resetForTest(). Without
 * the ROOMS redirect, handleStopEvent's closeOutRoom step would resolve the
 * navigator's OWN machine-wide active room and mutate it (Pitfall 4) -- a
 * temp MINDRIAN_HOME alone is NOT hermetic for the MCP surface.
 *
 * Envelope modes (Pattern 1, D-02/D-07): `direct` (238 and authored debug
 * entries: fields go straight to deriveTurnSignals), `transcript` (live and
 * dogfood entries: a minimal jsonl transcript is written to temp and passed
 * as transcript_path, so lib/hmi/turn-text.cjs -- the code D-07 changes --
 * actually runs), `sidechannel` (reach state seeded via the real
 * recordReachedGate + back-dated ts, so gate_is_fresh/consumption are real),
 * and `transcript+sidechannel` (the live Stop contract). Direct fields would
 * freeze the pre-fix classification (Pitfall 2), so live/dogfood entries are
 * never direct-mode (enforced by the corpus loader's validateEntry).
 *
 * --code-root (Pattern 3, T-357-12): `git archive <sha> scripts lib data
 * package.json .claude-plugin` into a fresh mkdtemp, digest-verified against
 * tests/fixtures/card-fire-replay/pre-phase.json's runtime_files, with
 * node_modules symlinked in. Stateless (no `.git/worktrees` entry, unlike a
 * worktree -- this repo has been bitten by that before). `--baseline write`
 * requires `--code-root pre-phase` (D-03).
 *
 * CLI vs MCP parity (D-14, R-H): compared by verdict CLASS only (block vs
 * pass) -- an MCP `fire:true` carries no reason string, so comparing reason
 * text is an anti-pattern. `dedup-already-fired-this-session` is excluded
 * from the parity check (a session-scoped MCP-only suppression, not a real
 * disagreement).
 *
 * Exit codes: 2 on a corpus-load error, a code-root preparation error, or
 * (in --surface both) a CLI/MCP class mismatch outside dedup; 1 when
 * false_blocks > 0 or new_misses > 0 (known_miss / known_false_block
 * excluded, R-C); 0 otherwise.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');

const corpusLoader = require(path.join(REPO_ROOT, 'scripts', 'card-fire-replay-corpus.cjs'));

// D-13: the exact message a network-ban test leg greps stderr for (via a
// NODE_OPTIONS preload that intercepts the throw before it unwinds here).
const NETWORK_FORBIDDEN_MESSAGE = 'network forbidden in replay-card-fire';

// Direct-field envelope keys deriveTurnSignals already accepts (D-02). Copied
// straight onto the stop context whenever present on the entry's envelope
// (or one of its envelope.steps), regardless of mode -- validateEntry already
// enforces which fields each mode forbids, so this copy is unconditional.
const DIRECT_FIELD_ALLOWLIST = [
  'output_text',
  'last_assistant_text',
  'ran_entries',
  'preceding_user_text',
  'preceding_user_text_source',
  'gate_subject_text',
  'reach_corroborated',
  'sidechannel_health',
  'askuserquestion_fired',
  'ask_user_question_fired',
  'gate_signature',
];

// Per-code-root-dir module cache, so a multi-entry run does not re-require
// the same code root's modules for every single entry. require() itself
// already caches by resolved absolute path, so this is a light convenience
// layer, not a correctness requirement -- two different code roots (HEAD vs
// a pre-phase mkdtemp) are always different absolute paths and never collide.
const _codeRootModuleCache = new Map();

/**
 * loadCodeRootModules(dir) -- require the three runtime modules the replay
 * drives, by ABSOLUTE path under `dir` (the repo root, or a prepared
 * code-root mkdtemp). Never requires from tests/ (scripts must not depend on
 * tests, RESEARCH anti-pattern).
 */
function loadCodeRootModules(dir) {
  const cached = _codeRootModuleCache.get(dir);
  if (cached) return cached;
  const checkCardFire = require(path.join(dir, 'scripts', 'check-card-fire.cjs'));
  const stopGateHandler = require(path.join(dir, 'lib', 'mcp', 'stop-gate-handler.cjs'));
  const sidechannel = require(path.join(dir, 'lib', 'core', 'card-fire-sidechannel.cjs'));
  const mods = { checkCardFire: checkCardFire, stopGateHandler: stopGateHandler, sidechannel: sidechannel, dir: dir };
  _codeRootModuleCache.set(dir, mods);
  return mods;
}

/**
 * prepareCodeRoot(spec) -- resolve the code root to replay against.
 *   - undefined / null / the repo root path -> { dir: REPO_ROOT, cleanup: noop }
 *   - 'pre-phase' -> git-archive the pinned pre_phase_sha into a fresh
 *     mkdtemp, digest-verify every runtime_files entry, symlink node_modules.
 *   - any other string -> treated as an existing directory as-is.
 * Never throws past this function's own callers without a clear message
 * naming the failing path (the code-root digest mismatch case).
 */
function prepareCodeRoot(spec) {
  if (spec === undefined || spec === null || path.resolve(String(spec)) === REPO_ROOT) {
    return { dir: REPO_ROOT, cleanup: function () {} };
  }

  if (spec === 'pre-phase') {
    const pre = corpusLoader.readPrePhase();
    if (!pre || typeof pre.pre_phase_sha !== 'string' || !pre.pre_phase_sha) {
      throw new Error('pre-phase.json missing');
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'replay-357-root-'));
    try {
      const archivePath = path.join(tmp, 'a.tar');
      execFileSync('git', [
        'archive', '-o', archivePath, pre.pre_phase_sha,
        'scripts', 'lib', 'data', 'package.json', '.claude-plugin',
      ], { cwd: REPO_ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
      execFileSync('tar', ['-xf', archivePath, '-C', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
      fs.rmSync(archivePath, { force: true });

      const runtimeFiles = (pre.runtime_files && typeof pre.runtime_files === 'object') ? pre.runtime_files : {};
      for (const relPath of Object.keys(runtimeFiles)) {
        const extractedPath = path.join(tmp, relPath);
        let contents;
        try {
          contents = fs.readFileSync(extractedPath);
        } catch (_e) {
          throw new Error('pre-phase archive missing runtime file: ' + relPath);
        }
        const digest = crypto.createHash('sha256').update(contents).digest('hex');
        if (digest !== runtimeFiles[relPath]) {
          throw new Error('pre-phase runtime file digest mismatch: ' + relPath);
        }
      }

      const nodeModulesSrc = path.join(REPO_ROOT, 'node_modules');
      if (fs.existsSync(nodeModulesSrc)) {
        try {
          fs.symlinkSync(nodeModulesSrc, path.join(tmp, 'node_modules'), 'dir');
        } catch (_eSymlink) {
          /* best-effort: a missing node_modules symlink only breaks a
             requires-a-third-party-package call path, which this replay's
             own runtime files do not exercise. */
        }
      }
    } catch (e) {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_eCleanup) { /* best-effort */ }
      throw e;
    }
    return {
      dir: tmp,
      cleanup: function () {
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
      },
    };
  }

  return { dir: spec, cleanup: function () {} };
}

/**
 * withHermeticEnv(label, fn) -- run `fn({dir, homeDir, sideFile, roomsDir})`
 * under a fresh mkdtemp with MINDRIAN_HOME, CARD_FIRE_SIDECHANNEL_PATH,
 * MINDRIAN_ROOMS_HOME and MINDRIAN_ROOMS_ROOT all pointed at it, restoring
 * every env var (deleting when previously unset) and removing the temp dir
 * in a finally. `fn` may be sync or async; its return value (or resolved
 * value) is this function's own resolved value.
 */
async function withHermeticEnv(label, fn) {
  const prefix = 'replay-357-env-' + (label || 'entry') + '-';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const homeDir = path.join(dir, 'home');
  const sideFile = path.join(dir, 'card-fire-reached.json');
  const roomsDir = path.join(dir, 'rooms');
  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(roomsDir, { recursive: true });

  const keys = ['MINDRIAN_HOME', 'CARD_FIRE_SIDECHANNEL_PATH', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT'];
  const saved = {};
  for (const k of keys) {
    saved[k] = { had: Object.prototype.hasOwnProperty.call(process.env, k), val: process.env[k] };
  }
  process.env.MINDRIAN_HOME = homeDir;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = sideFile;
  process.env.MINDRIAN_ROOMS_HOME = roomsDir;
  process.env.MINDRIAN_ROOMS_ROOT = roomsDir;

  try {
    return await fn({ dir: dir, homeDir: homeDir, sideFile: sideFile, roomsDir: roomsDir });
  } finally {
    for (const k of keys) {
      if (saved[k].had) process.env[k] = saved[k].val;
      else delete process.env[k];
    }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

function safeIdSlug(id) {
  return String(id).replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60);
}

/**
 * seedSidechannelRecords(records, sessionId, mods) -- seed the real side
 * channel via recordReachedGate, then back-date each JUST-SEEDED record's
 * `ts` to `now - age_ms` so gate_is_fresh / consumption behave exactly as a
 * live turn would. Uses the CARD_FIRE_SIDECHANNEL_PATH the current
 * withHermeticEnv call set (never invents its own path).
 */
function seedSidechannelRecords(records, sessionId, mods) {
  if (!Array.isArray(records) || records.length === 0) return;
  const sideFile = process.env.CARD_FIRE_SIDECHANNEL_PATH;

  let beforeCount = 0;
  try {
    const before = JSON.parse(fs.readFileSync(sideFile, 'utf8'));
    beforeCount = Array.isArray(before[sessionId]) ? before[sessionId].length : 0;
  } catch (_e) {
    beforeCount = 0;
  }

  for (const rec of records) {
    mods.sidechannel.recordReachedGate({
      sessionId: sessionId,
      surface: rec.entry,
      shape: rec.shape,
      subjectText: rec.subject,
      filePath: sideFile,
    });
  }

  let store = {};
  try {
    store = JSON.parse(fs.readFileSync(sideFile, 'utf8'));
  } catch (_e) {
    store = {};
  }
  const list = Array.isArray(store[sessionId]) ? store[sessionId] : [];
  const now = Date.now();
  for (let i = 0; i < records.length; i += 1) {
    const idx = beforeCount + i;
    if (list[idx]) {
      list[idx].ts = now - (Number.isFinite(records[i].age_ms) ? records[i].age_ms : 0);
    }
  }
  store[sessionId] = list;
  try {
    fs.writeFileSync(sideFile, JSON.stringify(store));
  } catch (_eWrite) {
    /* best-effort, matches the side channel's own never-throw contract */
  }
}

/**
 * seedCounters(counters, ctx, sessionId, mods) -- pre-seed the real bounded-
 * escape counters (env.counters.session / env.counters.retry) via the
 * exported bumpSessionCount/bumpRetryCount accessors, against the SAME
 * temp MINDRIAN_HOME both surfaces read (Pattern 2). The retry key is
 * derived the SAME way runCliStop/handleStopEvent derive it
 * (turnContextHash(deriveTurnSignals(ctx))), so seeding lands on the exact
 * key the classification step will read back.
 */
function seedCounters(counters, ctx, sessionId, mods) {
  if (!counters || typeof counters !== 'object') return;
  const sessionN = Number.isInteger(counters.session) ? counters.session : 0;
  const retryN = Number.isInteger(counters.retry) ? counters.retry : 0;
  for (let i = 0; i < sessionN; i += 1) mods.checkCardFire.bumpSessionCount(sessionId);
  if (retryN > 0) {
    const turn = mods.checkCardFire.deriveTurnSignals(ctx);
    const ctxHash = mods.checkCardFire.turnContextHash(turn);
    for (let i = 0; i < retryN; i += 1) mods.checkCardFire.bumpRetryCount(ctxHash);
  }
}

/**
 * materializeEnvelope(env, dir, sessionId, mods) -- turn a D-02 envelope
 * object into the stop context both surfaces consume: writes a temp
 * transcript.jsonl for a transcript-containing mode, seeds the real side
 * channel for a sidechannel-containing mode, copies direct fields
 * unconditionally (validateEntry already enforces which fields each mode
 * forbids), and seeds counters when present. Returns the stop context.
 */
function materializeEnvelope(env, dir, sessionId, mods) {
  const ctx = { session_id: sessionId };
  const mode = typeof env.mode === 'string' ? env.mode : 'direct';

  if (mode.indexOf('transcript') !== -1) {
    const transcriptPath = path.join(dir, 'transcript-' + crypto.randomBytes(4).toString('hex') + '.jsonl');
    const records = Array.isArray(env.transcript) ? env.transcript : [];
    const lines = records.map(function (rec) { return JSON.stringify(rec); });
    fs.writeFileSync(transcriptPath, lines.join('\n') + (lines.length > 0 ? '\n' : ''));
    ctx.transcript_path = transcriptPath;
  }

  if (mode.indexOf('sidechannel') !== -1) {
    seedSidechannelRecords(env.sidechannel_records, sessionId, mods);
  }

  for (const field of DIRECT_FIELD_ALLOWLIST) {
    if (Object.prototype.hasOwnProperty.call(env, field)) {
      ctx[field] = env[field];
    }
  }

  if (env.counters) {
    seedCounters(env.counters, ctx, sessionId, mods);
  }

  return ctx;
}

/**
 * runCliStop(ctx, mods) -- mirror scripts/check-card-fire.cjs's main()
 * exactly, minus stdin/stdout/the intercept log: loadRegistry ->
 * deriveTurnSignals -> read both counters -> classifyCardFire -> the SAME
 * degrade/intercept/pass bookkeeping (bump-or-clear both counters,
 * consumeReachedGatesForVerdict on every TERMINAL verdict). A defensive
 * `predicate-error` reason (classifyCardFire's own catch-all) is reported as
 * class 'error' rather than folded into 'pass'.
 */
function runCliStop(ctx, mods) {
  const checkCardFire = mods.checkCardFire;
  const registry = checkCardFire.loadRegistry();
  const turn = checkCardFire.deriveTurnSignals(ctx);
  const ctxHash = checkCardFire.turnContextHash(turn);
  turn.retry_count = checkCardFire.readRetryCount(ctxHash);
  turn.session_count = checkCardFire.readSessionCount(turn.session_id);

  const verdict = checkCardFire.classifyCardFire(turn, registry);

  const base = {
    preceding_user_text_source: turn.preceding_user_text_source,
    preceding_user_is_meta: turn.preceding_user_is_meta,
  };

  if (verdict.reason === 'predicate-error') {
    return Object.assign({ class: 'error' }, base);
  }

  if (verdict.degrade === true) {
    checkCardFire.clearRetryCount(ctxHash);
    checkCardFire.clearSessionCount(turn.session_id);
    checkCardFire.consumeReachedGatesForVerdict(turn, verdict);
    return Object.assign({ class: 'pass', reason: verdict.reason, degrade: true }, base);
  }

  if (verdict.intercept === true) {
    checkCardFire.bumpRetryCount(ctxHash);
    checkCardFire.bumpSessionCount(turn.session_id);
    return Object.assign({ class: 'block', reason: verdict.reason, degrade: false }, base);
  }

  checkCardFire.clearRetryCount(ctxHash);
  checkCardFire.clearSessionCount(turn.session_id);
  checkCardFire.consumeReachedGatesForVerdict(turn, verdict);
  return Object.assign({ class: 'pass', reason: verdict.reason, degrade: false }, base);
}

/**
 * runMcpStop(ctx, mods) -- call the REAL handleStopEvent (no _resetForTest
 * here -- the caller resets ONCE per entry, before the first step, so a
 * multi-step entry's own dedup lifecycle plays out exactly as a live session
 * would). `fire:true` -> class 'block'; otherwise class 'pass', with
 * `dedup: true` when the MCP-only suppression reason fired (excluded from
 * parity per D-14). `handler-error` -> class 'error'.
 */
async function runMcpStop(ctx, mods) {
  const r = await mods.stopGateHandler.handleStopEvent(ctx.session_id, ctx);
  const roomDir = (r && r.business && Object.prototype.hasOwnProperty.call(r.business, 'room_dir'))
    ? r.business.room_dir
    : null;

  if (r && r.reason === 'handler-error') {
    return { class: 'error', room_dir: roomDir };
  }
  if (r && r.fire === true) {
    return { class: 'block', reason: r.reason, room_dir: roomDir };
  }
  const out = { class: 'pass', reason: r ? r.reason : undefined, room_dir: roomDir };
  if (r && r.reason === 'dedup-already-fired-this-session') out.dedup = true;
  return out;
}

/**
 * runEntry(entry, {codeRoot, surface}) -- replay one corpus entry. For each
 * requested surface, runs in its OWN withHermeticEnv, with a unique
 * session id `replay357-<surface>-<slug(id)>-<random hex>`: replays
 * envelope.steps in order (each materialized then run), then the final
 * envelope; the entry's result is the FINAL step's result. Returns
 * { cli?, mcp? }.
 */
async function runEntry(entry, opts) {
  const options = opts || {};
  const surface = options.surface || 'both';
  const codeRoot = options.codeRoot || REPO_ROOT;
  const mods = loadCodeRootModules(codeRoot);

  const wantCli = surface === 'cli' || surface === 'both';
  const wantMcp = surface === 'mcp' || surface === 'both';

  const steps = Array.isArray(entry.envelope.steps)
    ? entry.envelope.steps.concat([entry.envelope])
    : [entry.envelope];

  const result = {};

  if (wantCli) {
    result.cli = await withHermeticEnv('cli-' + safeIdSlug(entry.id), async function (h) {
      const sessionId = 'replay357-cli-' + safeIdSlug(entry.id) + '-' + crypto.randomBytes(4).toString('hex');
      let last = null;
      for (const stepEnv of steps) {
        const ctx = materializeEnvelope(stepEnv, h.dir, sessionId, mods);
        last = runCliStop(ctx, mods);
      }
      return last;
    });
  }

  if (wantMcp) {
    result.mcp = await withHermeticEnv('mcp-' + safeIdSlug(entry.id), async function (h) {
      const sessionId = 'replay357-mcp-' + safeIdSlug(entry.id) + '-' + crypto.randomBytes(4).toString('hex');
      mods.stopGateHandler._resetForTest();
      let last = null;
      for (const stepEnv of steps) {
        const ctx = materializeEnvelope(stepEnv, h.dir, sessionId, mods);
        last = await runMcpStop(ctx, mods);
      }
      return last;
    });
  }

  return result;
}

/**
 * classifyOutcome(entry, cls, baselineClass) -- the corpus-vs-classification
 * verdict, in priority order (a harness/predicate error always wins; a
 * known_false_block or known_miss annotation is checked before the plain
 * false-block / miss classes so an entry can never silently land in both):
 *   ERROR              cls === 'error'
 *   KNOWN_FALSE_BLOCK   known_false_block present AND cls === 'block'
 *   OK                  known_false_block present AND cls !== 'block'
 *   EXCLUDED_PARTIAL    envelope_partial === true
 *   FALSE_BLOCK         expected 'pass', cls 'block'
 *   NEW_MISS            expected 'block', cls 'pass', baselineClass === 'block'
 *   KNOWN_MISS          expected 'block', cls 'pass', known_miss present
 *   MISSED_FORK         expected 'block', cls 'pass', otherwise (unmarked)
 *   OK                  otherwise
 */
function classifyOutcome(entry, cls, baselineClass) {
  if (cls === 'error') return 'ERROR';

  if (entry.known_false_block) {
    return cls === 'block' ? 'KNOWN_FALSE_BLOCK' : 'OK';
  }

  if (entry.envelope_partial === true) return 'EXCLUDED_PARTIAL';

  const expected = entry.expected_verdict_class;

  if (expected === 'pass' && cls === 'block') return 'FALSE_BLOCK';

  if (expected === 'block' && cls === 'pass') {
    if (baselineClass === 'block') return 'NEW_MISS';
    if (entry.known_miss) return 'KNOWN_MISS';
    return 'MISSED_FORK';
  }

  return 'OK';
}

/**
 * runReplay(opts) -- load the corpus, replay every (filtered) entry on the
 * requested surface(s), classify each outcome, tally counts, optionally
 * write or compare against baseline.json, and return the full result object
 * (never calls process.exit itself -- main() maps `.exitCode` to the real
 * process exit code). The network ban and the code-root cleanup both live
 * here (not only in main()) so an in-process caller (a test) that calls
 * runReplay() directly gets the same guarantees a CLI invocation gets.
 */
async function runReplay(opts) {
  const options = opts || {};
  const corpusDir = options.corpusDir || corpusLoader.CORPUS_DIR;
  const surface = options.surface || 'both';
  const only = options.only
    ? String(options.only).split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    : null;
  const sourceFilter = options.source || null;

  const loadOpts = { corpusDir: corpusDir };
  if (sourceFilter) loadOpts.sources = [sourceFilter];
  const corpus = corpusLoader.loadCorpus(loadOpts);

  if (corpus.errors.length > 0) {
    return { exitCode: 2, error: 'corpus load errors', loaderErrors: corpus.errors };
  }

  let entries = corpus.entries;
  if (only) {
    const onlySet = new Set(only);
    entries = entries.filter(function (e) { return onlySet.has(e.id); });
  }

  let codeRootResult;
  try {
    codeRootResult = prepareCodeRoot(options.codeRoot);
  } catch (e) {
    return { exitCode: 2, error: 'code root preparation failed: ' + e.message };
  }
  const codeRootDir = codeRootResult.dir;
  const codeRootLabel = options.codeRoot === 'pre-phase'
    ? 'pre-phase'
    : (codeRootDir === REPO_ROOT ? 'HEAD' : codeRootDir);

  const baselinePath = path.join(corpusDir, 'baseline.json');
  const baselineMode = options.baseline || (fs.existsSync(baselinePath) ? 'compare' : null);

  if (baselineMode === 'write' && options.codeRoot !== 'pre-phase') {
    codeRootResult.cleanup();
    return { exitCode: 2, error: '--baseline write requires --code-root pre-phase (D-03)' };
  }

  let baselineData = null;
  if (baselineMode === 'compare') {
    try {
      baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    } catch (_e) {
      baselineData = null;
    }
  }

  let preSha = null;
  try {
    const pre = corpusLoader.readPrePhase(corpusDir);
    preSha = pre ? pre.pre_phase_sha : null;
  } catch (_e) {
    preSha = null;
  }

  // D-13: the network ban. Applies for the whole entry-replay window,
  // whether this function was reached via main() or called directly.
  const savedFetch = globalThis.fetch;
  globalThis.fetch = function () {
    throw new Error(NETWORK_FORBIDDEN_MESSAGE);
  };

  const results = [];
  let errorsCount = 0;
  let parityMismatches = 0;

  try {
    for (const entry of entries) {
      let entryResult;
      try {
        entryResult = await runEntry(entry, { codeRoot: codeRootDir, surface: surface });
      } catch (_e) {
        entryResult = { cli: { class: 'error' }, mcp: { class: 'error' } };
      }

      const cliClass = entryResult.cli ? entryResult.cli.class : undefined;
      const mcpClass = entryResult.mcp ? entryResult.mcp.class : undefined;
      const primaryClass = surface === 'mcp' ? mcpClass : cliClass;

      let parityMismatch = false;
      if (surface === 'both') {
        const mcpDedup = entryResult.mcp && entryResult.mcp.dedup === true;
        if (!mcpDedup && cliClass !== mcpClass) {
          parityMismatch = true;
          parityMismatches += 1;
        }
      }

      const baselineClass = (baselineData && baselineData.verdicts)
        ? baselineData.verdicts[entry.id]
        : undefined;

      const outcome = parityMismatch ? 'PARITY_MISMATCH' : classifyOutcome(entry, primaryClass, baselineClass);
      if (primaryClass === 'error') errorsCount += 1;

      results.push({
        id: entry.id,
        source: entry.source,
        expected: entry.expected_verdict_class,
        cli: entryResult.cli || null,
        mcp: entryResult.mcp || null,
        baseline: baselineClass !== undefined ? baselineClass : null,
        outcome: outcome,
      });
    }
  } finally {
    globalThis.fetch = savedFetch;
    codeRootResult.cleanup();
  }

  if (baselineMode === 'write') {
    const verdicts = {};
    for (const r of results) {
      verdicts[r.id] = (surface === 'mcp')
        ? (r.mcp && r.mcp.class)
        : (r.cli && r.cli.class);
    }
    const baselineOut = {
      meta: {
        pre_phase_sha: preSha,
        code_root: codeRootLabel,
        written_at: new Date().toISOString(),
        entry_count: results.length,
      },
      verdicts: verdicts,
    };
    fs.writeFileSync(baselinePath, JSON.stringify(baselineOut, null, 2) + '\n');
  }

  const counts = {
    entries: results.length,
    evaluated: results.length,
    false_blocks: results.filter(function (r) { return r.outcome === 'FALSE_BLOCK'; }).length,
    missed_forks: results.filter(function (r) { return r.outcome === 'MISSED_FORK'; }).length,
    known_misses: results.filter(function (r) { return r.outcome === 'KNOWN_MISS'; }).length,
    known_false_blocks: results.filter(function (r) { return r.outcome === 'KNOWN_FALSE_BLOCK'; }).length,
    new_misses: results.filter(function (r) { return r.outcome === 'NEW_MISS'; }).length,
    excluded_partial: results.filter(function (r) { return r.outcome === 'EXCLUDED_PARTIAL'; }).length,
    parity_mismatches: parityMismatches,
    errors: errorsCount,
    unmarked_misses: results.filter(function (r) { return r.outcome === 'MISSED_FORK'; }).length,
  };

  let missingFromBaseline = [];
  if (baselineMode === 'compare' && baselineData && baselineData.verdicts) {
    missingFromBaseline = results
      .filter(function (r) { return !(r.id in baselineData.verdicts); })
      .map(function (r) { return r.id; });
  }

  const exitCode = (counts.errors > 0 || counts.parity_mismatches > 0)
    ? 2
    : ((counts.false_blocks > 0 || counts.new_misses > 0) ? 1 : 0);

  return {
    exitCode: exitCode,
    code_root: codeRootLabel,
    pre_phase_sha: preSha,
    surface: surface,
    counts: counts,
    entries: results,
    known_miss_ids: entries.filter(function (e) { return !!e.known_miss; }).map(function (e) { return e.id; }),
    known_false_block_ids: entries.filter(function (e) { return !!e.known_false_block; }).map(function (e) { return e.id; }),
    missing_from_baseline: missingFromBaseline,
  };
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--surface': opts.surface = argv[i += 1]; break;
      case '--baseline': opts.baseline = argv[i += 1]; break;
      case '--json': opts.json = true; break;
      case '--code-root': opts.codeRoot = argv[i += 1]; break;
      case '--only': opts.only = argv[i += 1]; break;
      case '--source': opts.source = argv[i += 1]; break;
      case '--corpus-dir': opts.corpusDir = argv[i += 1]; break;
      default:
        // Unknown flags are ignored rather than fatal, so a later plan can
        // add flags (e.g. --mutation, reserved for 357-09's leg) without
        // this file needing a matching edit first.
        break;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let result;
  try {
    result = await runReplay(opts);
  } catch (e) {
    process.stderr.write('[replay-card-fire] uncaught: ' + (e && e.message ? e.message : String(e)) + '\n');
    process.exitCode = 2;
    return;
  }

  if (result.error) {
    process.stderr.write('[replay-card-fire] ' + result.error + '\n');
    if (Array.isArray(result.loaderErrors)) {
      for (const e of result.loaderErrors) process.stderr.write('  ' + e + '\n');
    }
    process.exitCode = result.exitCode || 2;
    return;
  }

  if (opts.json) {
    process.stdout.write(JSON.stringify({
      code_root: result.code_root,
      pre_phase_sha: result.pre_phase_sha,
      surface: result.surface,
      counts: result.counts,
      entries: result.entries,
    }) + '\n');
  } else {
    const c = result.counts;
    process.stdout.write(
      'replay-card-fire: code_root=' + result.code_root + ' surface=' + result.surface + '\n' +
      'entries=' + c.entries +
      ' false_blocks=' + c.false_blocks +
      ' missed_forks=' + c.missed_forks +
      ' known_misses=' + c.known_misses +
      ' known_false_blocks=' + c.known_false_blocks +
      ' new_misses=' + c.new_misses +
      ' excluded_partial=' + c.excluded_partial +
      ' parity_mismatches=' + c.parity_mismatches +
      ' errors=' + c.errors + '\n'
    );
    for (const e of result.entries) {
      if (e.outcome !== 'OK') {
        process.stdout.write(
          '  ' + e.outcome + ' ' + e.id +
          ' cli=' + (e.cli && e.cli.class) +
          ' mcp=' + (e.mcp && e.mcp.class) + '\n'
        );
      }
    }
    process.stdout.write('known misses: ' + result.known_miss_ids.join(', ') + '\n');
    process.stdout.write('known false blocks: ' + result.known_false_block_ids.join(', ') + '\n');
  }

  process.exitCode = result.exitCode;
}

module.exports = {
  runReplay: runReplay,
  runEntry: runEntry,
  prepareCodeRoot: prepareCodeRoot,
  classifyOutcome: classifyOutcome,
  main: main,
};

if (require.main === module) {
  main();
}
