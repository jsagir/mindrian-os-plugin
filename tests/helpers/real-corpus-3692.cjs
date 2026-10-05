'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 02 Task 1 -- the real-corpus test seam.
 *
 * Every existing planner test stubs fetchEnvelopeFn, so a fence regression in
 * the corpus layer (research-corpus.cjs fetchCorpusEnvelope and the fetchers
 * under it) is invisible to them. This helper drives the REAL
 * fetchCorpusEnvelope through the OpenAlex replay fetch installed at
 * globalThis.fetch, so the audit, the URL build and the call count are all
 * observed. No network; no write outside temp dirs.
 *
 * Exports:
 *   hermeticEnv(extra)             copy of process.env with HOME, USERPROFILE and
 *                                  MINDRIAN_ROOMS_HOME in fresh mkdtemp dirs, vendor
 *                                  keys deleted, Brain URL pointed at a dead port
 *   withReplay(route, fn)          installs the replay fetch for the duration of
 *                                  await fn(); returns { result, error, calls }
 *   realFetchEnvelope(route)       fetchEnvelopeFn-shaped async fn over the real
 *                                  fetchCorpusEnvelope; .calls accumulates the
 *                                  recorder rows, .reset() clears them
 *   writePreload(dir, routeModule) wraps writeReplayPreload
 *   readReplayLog(file)            JSON lines appended by a route module to
 *                                  process.env.MOS_3692_REPLAY_LOG -> [{q}]
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const replayHelper = require('./openalex-replay-363.cjs');

const VENDOR_KEYS = ['TAVILY_API_KEY', 'OPENALEX_API_KEY', 'OPENALEX_EMAIL', 'PATENTSVIEW_API_KEY'];

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function hermeticEnv(extra) {
  const env = Object.assign({}, process.env);
  const home = mkTmp('mos3692-home-');
  env.HOME = home;
  env.USERPROFILE = home;
  env.MINDRIAN_ROOMS_HOME = mkTmp('mos3692-rooms-');
  VENDOR_KEYS.forEach(function (k) { delete env[k]; });
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  if (extra && typeof extra === 'object') Object.assign(env, extra);
  return env;
}

function defaultRoute() { return 'gap_primary_zero'; }

// withReplay(route, fn): the replay fetch is live at globalThis.fetch only while
// fn runs; the previous fetch is restored in finally.
async function withReplay(route, fn) {
  const replay = replayHelper.makeReplayFetch({ route: typeof route === 'function' ? route : defaultRoute });
  const prior = globalThis.fetch;
  globalThis.fetch = replay;
  let result = null;
  let error = null;
  try {
    result = await fn();
  } catch (e) {
    error = e;
  } finally {
    globalThis.fetch = prior;
  }
  return { result: result, error: error, calls: replay.calls };
}

// realFetchEnvelope(route): the seam planner tests pass as fetchEnvelopeFn. It
// calls the real corpus (loaded lazily so a test can set HOME first) and lets a
// throw propagate exactly as the real path does.
function realFetchEnvelope(route) {
  const calls = [];
  async function fetchEnvelopeFn(args) {
    const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
    const out = await withReplay(route, function () { return corpus.fetchCorpusEnvelope(args); });
    out.calls.forEach(function (c) { calls.push(c); });
    if (out.error) throw out.error;
    return out.result;
  }
  fetchEnvelopeFn.calls = calls;
  fetchEnvelopeFn.reset = function () { calls.length = 0; };
  return fetchEnvelopeFn;
}

function writePreload(dir, routeModulePath) {
  return replayHelper.writeReplayPreload(dir, { routeModulePath: routeModulePath });
}

function readReplayLog(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (_e) {
    return [];
  }
  return raw.split(/\r?\n/).filter(function (l) { return l.length > 0; }).map(function (l) {
    try { return JSON.parse(l); } catch (_e) { return { q: null, raw: l }; }
  });
}

module.exports = {
  withReplay: withReplay,
  realFetchEnvelope: realFetchEnvelope,
  hermeticEnv: hermeticEnv,
  writePreload: writePreload,
  readReplayLog: readReplayLog,
  VENDOR_KEYS: VENDOR_KEYS,
};
