'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 03: shared helpers of the unit tests that compare lib/core/room-scan.cjs with the
 * LIVE tools (bash, sort, xargs, date, python3, grep, find) on this host.
 *
 * Rules (T-381-01): every live call is a spawnSync with a CONSTANT program string. Data travels as
 * positional arguments or as files, never pasted into program text. The child env is built from
 * scratch (no inherited bash functions such as the agent shell grep function) and carries
 * LC_ALL=C.UTF-8 and an explicit TZ (or none for the host zone).
 *
 * The expected value of every date leg comes from the BASE_SHA portable_date_to_epoch run in bash
 * (tests/helpers/oracle-381.cjs buildOldTree), never from JS arithmetic.
 *
 * Plain node built-ins, zero deps. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const oracle = require(path.join(REPO, 'tests', 'helpers', 'oracle-381.cjs'));

// The pinned live-tool env. tz === 'host' (or undefined) leaves TZ out so the host zone applies.
function liveEnv(tz) {
  const env = { PATH: '/usr/bin:/bin', HOME: os.tmpdir(), LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
  if (tz && tz !== 'host') env.TZ = tz;
  return env;
}

const tmpDirs = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-381-' + label + '-'));
  tmpDirs.push(d);
  return d;
}
function cleanup() {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  try { oracle.cleanupTmp(); } catch (_e) { /* best effort */ }
}

// bash -c <constant program> _ <args...>; returns the raw spawn result (stdout as a Buffer).
function runBash(program, args, opts) {
  const o = opts || {};
  return spawnSync('bash', ['-c', program, '_'].concat(args || []), {
    cwd: o.cwd || os.tmpdir(),
    env: liveEnv(o.tz),
    input: o.input,
    timeout: o.timeout || 120000,
    maxBuffer: 1 << 28,
  });
}

// Split a NUL-terminated record stream into UTF-8 strings.
function nulSplit(buf) {
  const s = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf);
  const parts = s.split('\0');
  if (parts.length && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

// A deterministic LCG so fuzz cases are the same on every host.
function makeLcg(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

// ---------------------------------------------------------------------------
// The date legs (shared by test-381-bash-dialect.cjs and test-381-date-tz-matrix.cjs)
// ---------------------------------------------------------------------------
// Payloads copied from tests/test-compute-team-date-guard.cjs (TEAM_MARKER, FUND_MARKER,
// TEAM_PAYLOAD, FUND_PAYLOAD_RAW) and tests/test-analyze-room-edge-argv.cjs (MARK_INFORMS,
// payloadName). They are the corrected quick 261029-u8x payloads; the RCA Symptoms payload does
// not fire and is not used.
const TEAM_MARKER = 'mos-team-proof';
const FUND_MARKER = 'mos-fund-proof';
const TEAM_PAYLOAD = "'+str(__import__('os').system('touch " + TEAM_MARKER + "'))+'";
const FUND_PAYLOAD_RAW = "\\'+str(__import__(\\'os\\').system(\\'touch " + FUND_MARKER + "\\'))+\\'";
const MARK_INFORMS = 'mos-edge-informs-proof';
function payloadName(marker) {
  return "x'+require('child_process').execSync('touch " + marker + "')+'";
}
const MARKERS = [TEAM_MARKER, FUND_MARKER, MARK_INFORMS];

// analyze-room reads last_updated through xargs; the value the date function sees is the xargs
// output. Real xargs through real bash (no JS shortcut).
function viaXargs(value) {
  const r = runBash('printf "%s\\n" "$1" | xargs 2>/dev/null', [value]);
  return r.stdout.toString('utf8').replace(/\n+$/, '');
}

function dateValues() {
  return [
    '2026-01-15', '2024-02-29', '2026-02-29', '2026-02-30', '2026-13-01', '1970-01-01',
    '9999-12-31', '0001-01-01', '0050-06-01', '0099-12-31', '1850-06-01',
    '2026-1-5', '2026-10-1', '2026-1-05',
    '2026-03-08', '2026-03-29', '2018-11-04',
    '2026-10-01T12:00:00Z', '2026-10-01T12:00:00+03:00', '2026-10-01 12:00', '2026-10-01 ',
    '2026-10-01\r', 'not a date at all',
    TEAM_PAYLOAD, viaXargs(FUND_PAYLOAD_RAW), payloadName(MARK_INFORMS),
  ];
}

const TZ_MATRIX = ['UTC', 'Asia/Jerusalem', 'America/Havana', 'Asia/Beirut', 'America/Sao_Paulo', 'America/New_York', 'host'];
// The DST-gap pairs: GNU date rejects a midnight that does not exist, then python gives a shifted epoch.
const GAP_PAIRS = [['America/Havana', '2026-03-08'], ['Asia/Beirut', '2026-03-29'], ['America/Sao_Paulo', '2018-11-04']];

function oldComputeTeam() {
  return path.join(oracle.buildOldTree(oracle.BASE_SHA), 'scripts', 'compute-team');
}

// Expected epochs: the BASE_SHA portable_date_to_epoch run in bash under the given TZ, in a fresh
// temp cwd. Returns { epochs: string[], cwd } and the marker files found in that cwd.
const FN_PROGRAM = 'eval "$(sed -n "/^portable_date_to_epoch()/,/^}/p" "$1")"; shift; ' +
  'for v in "$@"; do printf "%s\\0" "$(portable_date_to_epoch "$v")"; done';
function oracleEpochs(values, tz) {
  const cwd = mkTmp('oracle-date');
  const r = runBash(FN_PROGRAM, [oldComputeTeam()].concat(values), { tz, cwd });
  if (r.status !== 0) throw new Error('oracle bash failed: ' + String(r.stderr));
  const markers = MARKERS.filter((m) => fs.existsSync(path.join(cwd, m)));
  return { epochs: nulSplit(r.stdout), markers };
}

// The exact python program text of the C-2 link of the BASE_SHA portable_date_to_epoch.
function oraclePyProgram() {
  const src = fs.readFileSync(oldComputeTeam(), 'utf8');
  const m = src.match(/python3 -c '([^']*)' "\$datestr"/);
  if (!m) throw new Error('C-2 python3 link not found in the BASE_SHA compute-team');
  return m[1];
}

// Run fn with process.env.TZ set (or removed for 'host'), cwd moved to a fresh temp dir; returns
// { value, markers }. Restores both afterwards.
function withTz(tz, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'TZ');
  const prev = process.env.TZ;
  const prevCwd = process.cwd();
  const cwd = mkTmp('new-date');
  if (tz === 'host') delete process.env.TZ; else process.env.TZ = tz;
  process.chdir(cwd);
  try {
    const value = fn();
    const markers = MARKERS.filter((m) => fs.existsSync(path.join(cwd, m)));
    return { value, markers };
  } finally {
    process.chdir(prevCwd);
    if (had) process.env.TZ = prev; else delete process.env.TZ;
  }
}

module.exports = {
  REPO,
  oracle,
  liveEnv,
  mkTmp,
  cleanup,
  runBash,
  nulSplit,
  makeLcg,
  TEAM_MARKER,
  FUND_MARKER,
  MARK_INFORMS,
  TEAM_PAYLOAD,
  FUND_PAYLOAD_RAW,
  payloadName,
  MARKERS,
  viaXargs,
  dateValues,
  TZ_MATRIX,
  GAP_PAIRS,
  oracleEpochs,
  oraclePyProgram,
  withTz,
};
