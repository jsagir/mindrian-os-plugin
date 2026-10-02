#!/usr/bin/env node
'use strict';
/*
 * scripts/release-cut-listener.cjs -- the release-cut listener
 * (quick 261002-5v9, navigator ruling 2026-10-02).
 *
 * WHAT IT IS
 *   A dev-time release script that release.sh calls on every plugin cut.
 *   It has two legs:
 *
 *   theo     Calls Theo's release bridge (release_sync.py, contract
 *            docs/RELEASE-SYNC-CONTRACT.md in the Theo repo) with this
 *            repo's version and the full HEAD sha, then turns Theo's exit
 *            code into one printed decision: CONTINUE, STOP or
 *            STOP-WITH-ACTION. release.sh runs it at Step 0.55, before the
 *            Step 0.6 stamp gate.
 *   website  A read-only drift scan of the mindrian-website repo's
 *            hand-typed version and command-count surfaces plus its banned
 *            content, as listed by that repo's own
 *            docs/VERSION-BUMP-CHECKLIST.md. release.sh runs it at Step 9.6c,
 *            right after the Step 9.6b FALLBACK_VERSION bump.
 *
 * WHY IT EXISTS
 *   Before this, a cut discovered Theo staleness only when the Step 0.6
 *   stamp gate refused, and nothing checked the website's hand-typed facts
 *   beyond FALLBACK_VERSION, so they drifted silently (2026-10-02:
 *   commands-canon.json said 2.0.0-beta.51 while v2.0.0-beta.55 was out).
 *   Both legs fail open with a visible boxed report; nothing is ever skipped
 *   silently.
 *
 * USAGE
 *   node scripts/release-cut-listener.cjs <theo|website|all|help>
 *     [--plugin-root DIR] [--version X.Y.Z[-pre]] [--ref <40-hex sha>]
 *     [--website-dir DIR] [--report-dir DIR] [--dry-run] [--json]
 *
 *   `all` runs theo then website, each with its own default version, and
 *   rejects --version: the two legs answer about different versions (the
 *   pre-cut placeholder that Theo stamps vs the released tag the website
 *   advertises).
 *
 * EXIT CODES (LISTENER_EXIT)
 *   0  OK                every leg RAN-OK
 *   1  INTERNAL          the listener itself crashed
 *   2  USAGE             bad subcommand, flag, --version or --ref
 *   3  SKIPPED           a leg skipped (named reason), none worse
 *   4  DRIFT             a leg RAN-DRIFT, none worse
 *   10 STOP              the Theo leg says stop
 *   11 STOP_WITH_ACTION  the Theo leg says stop and printed the navigator's lines
 *   Multi-leg precedence: 11 > 10 > 4 > 3 > 0.
 *
 * ENV SEAMS
 *   THEO_DIR                          default <homedir>/Theo
 *   THEO_PYTHON                       default $THEO_DIR/.theo-graph/.venv/bin/python3
 *   THEO_SYNC_TIMEOUT_MS              default 600000
 *   MINDRIAN_WEBSITE_DIR              default <homedir>/mindrian-website/website (Step 9.6b's resolution)
 *   MINDRIAN_CUT_LISTENER_REPORT_DIR  default <homedir>/.mindrian/release-cut-listener
 *
 * CANON PART 8
 *   No network call, no room or user content. It reads plugin repo files and
 *   website repo files, and spawns only the local Theo CLI with a path, a
 *   version and a sha. Theo's stderr is inherited (streams live) and is never
 *   captured or stored.
 *
 * This is a dev-time release script, not a Part 11 invocable surface (no
 * command, agent, pipeline or skill reaches it).
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const CONTRACT = 'mos-release-cut-listener/1';
const THEO_CONTRACT = 'theo-release-sync/1';
const DEFAULT_TIMEOUT_MS = 600000;
const BOX_WIDTH = 78;
const EXCERPT_MAX = 80;
const MAX_SCAN_BYTES = 1024 * 1024;

const LISTENER_EXIT = Object.freeze({
  OK: 0,
  INTERNAL: 1,
  USAGE: 2,
  SKIPPED: 3,
  DRIFT: 4,
  STOP: 10,
  STOP_WITH_ACTION: 11,
});

const USAGE = [
  'Usage: node scripts/release-cut-listener.cjs <theo|website|all|help>',
  '         [--plugin-root DIR] [--version X.Y.Z[-pre]] [--ref <40-hex sha>]',
  '         [--website-dir DIR] [--report-dir DIR] [--dry-run] [--json]',
  '  theo     call Theo release_sync.py for this repo version at the full HEAD sha',
  '  website  read-only drift scan of the mindrian-website version-fact surfaces',
  '  all      theo, then website (rejects --version: the legs answer about different versions)',
  '  exit: 0 OK, 1 internal, 2 usage, 3 skipped, 4 drift, 10 stop, 11 stop with action',
].join('\n');

const VERSION_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SHA_RE = /^[0-9a-f]{40}$/;

// ---------------------------------------------------------------------------
// Theo exit map. Mirrors docs/RELEASE-SYNC-CONTRACT.md section 3 in the Theo
// repo; `next` paraphrases its "What release.sh does" column. The unit suite
// pins this against the doc whenever the doc is present.
// ---------------------------------------------------------------------------
const THEO_EXIT_MAP = Object.freeze({
  0: { statuses: ['already-current', 'verified'], outcome: 'RAN-OK', decision: 'CONTINUE',
    next: 'Theo already reads this version; continue the cut.' },
  1: { statuses: ['internal-error'], outcome: 'STOP', decision: 'STOP',
    next: 'Something broke inside Theo; never a success. Stop and report the message to the navigator.' },
  2: { statuses: ['usage-error'], outcome: 'STOP', decision: 'STOP',
    next: 'Theo rejected an argument. Stop and fix the call.' },
  3: { statuses: ['input-error'], outcome: 'STOP', decision: 'STOP',
    next: 'Theo could not read the plugin at that ref, or plugin.json there names a different version. Stop and check the sha and version.' },
  5: { statuses: ['canon-read-failure'], outcome: 'STOP', decision: 'STOP',
    next: 'Theo could not read its own graph; nothing was decided and it is never treated as current. Stop and retry later.' },
  10: { statuses: ['deferred-window-open'], outcome: 'STOP', decision: 'STOP',
    next: 'A Theo no-write window is open; nothing was compiled. Stop and retry when the window closes.' },
  20: { statuses: ['awaiting-navigator-apply'], outcome: 'STOP', decision: 'STOP-WITH-ACTION',
    next: 'Everything is ready except the write. The navigator applies and verifies, then re-runs the cut.' },
  21: { statuses: ['verified-record-uncommitted'], outcome: 'RAN-DRIFT', decision: 'CONTINUE',
    next: "Theo reads this version (treated as verified), but Theo's record needs a manual commit in the Theo repo." },
  22: { statuses: ['not-yet-applied'], outcome: 'STOP', decision: 'STOP-WITH-ACTION',
    next: 'Theo does not read this version yet: the apply has not run or did not finish. Run it, then verify again.' },
  23: { statuses: ['plugin-ref-moved'], outcome: 'STOP', decision: 'STOP',
    next: 'The ref recorded at propose time now points elsewhere. Stop and run propose again with a full sha.' },
  30: { statuses: ['needs-mapping-review'], outcome: 'STOP', decision: 'STOP',
    next: "This release needs a human framework-mapping decision. Stop; this release's sync needs a Theo phase." },
  31: { statuses: ['spent-seam'], outcome: 'STOP', decision: 'STOP',
    next: 'Theo already applied a sync for this version from other bytes. Stop; this needs a Theo phase (or a version bump).' },
  40: { statuses: ['dry-run-refused'], outcome: 'STOP', decision: 'STOP',
    next: "Theo's own pre-write checks refused the payload. Stop and report the message to the navigator." },
});

// The contract's exit table labels some statuses with the one mode that can
// produce them ("Propose:" / "Verify:" in docs/RELEASE-SYNC-CONTRACT.md
// section 3). Two rows share code 0 because they belong to different modes, so
// a status that does not belong to the answer's own mode is inconsistent.
const STATUS_MODE = Object.freeze({
  'already-current': 'propose',
  'verified': 'verify',
  'verified-record-uncommitted': 'verify',
  'not-yet-applied': 'verify',
  'plugin-ref-moved': 'verify',
});

// Codes Theo can return before it has recorded --version in its answer
// (release_sync.py main(): a usage error raised while parsing, or an
// unexpected exception). Only these may carry `version: null`.
const VERSION_MAY_BE_NULL = Object.freeze([1, 2]);

// ---------------------------------------------------------------------------
// Website surfaces. Mirrors the mindrian-website repo's
// docs/VERSION-BUMP-CHECKLIST.md as of website commit ac84cee (2026-10-02:
// six deleted count pages dropped, src/lib/truth-claims.ts RELEASE added as a
// version surface; quick 261002-byh). Paths are relative to the
// Next root (WEBSITE_DIR). A checklist path missing here shows up as an
// UNMIRRORED row on every run, so this list cannot fall behind silently.
// ---------------------------------------------------------------------------
const SURFACES = Object.freeze({
  version: ['src/lib/version.ts', 'src/data/commands-canon.json', 'src/lib/truth-claims.ts'],
  counts: [
    'src/app/page.tsx',
    'src/app/pricing/page.tsx',
    'src/app/layout.tsx',
  ],
  review: [
    ['src/app/roadmap/page.tsx', 'milestone labels and the Ahead section'],
    ['src/app/about/page.tsx', 'the Today timeline entry'],
  ],
  // Auto-resolving per the checklist (read npm at request time); listed so
  // they are mirrored, never scanned.
  auto: ['src/components/layout/Nav.tsx', 'src/components/layout/Footer.tsx'],
});

const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.md', '.mdx', '.json']);
const SKIP_DIRS = new Set(['.next', 'node_modules', '.git', '.vercel']);

// Banned content, per the checklist's "Banned content" section.
// twenty-years is narrowed on purpose to "20 years of" / "20+ years of": the
// checklist bans the teaching-years claim, and a blog title such as
// "Three S-Curves in 20 Years" is not that claim.
const BANNED_RULES = [
  { rule: 'vanity-graph-count', re: /(?:^|[^\w.,])(?:15,298|19,713|12,401|21K|15\.3K)\b/ },
  { rule: 'vanity-graph-count', re: /\b(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?K)\+?\s+(?:nodes|relationships|embeddings|edges)\b/i },
  { rule: 'kuzudb', re: /\bKuzuDB\b/i },
  { rule: 'plugin-install-string', re: /claude plugin install/i },
  { rule: 'twenty-years', re: /\b20\+?\s+years\s+of\b/i },
  { rule: 'jhu-attribution', re: /\b(?:Johns Hopkins|JHU|JHTV)\b/, allowIf: /University Press|JHU Press/ },
  { rule: 'em-dash', re: /\u2014/ },
];

// A literal "N commands" claim: a number (commas allowed), an optional "+",
// whitespace, at most one optional word, then "commands".
const COUNT_RE = /(?<![\w.,])(\d{1,3}(?:,\d{3})+|\d+)(\+)?\s+(?:[A-Za-z-]+\s+)?commands\b/gi;

// ---------------------------------------------------------------------------
// Deps: every side effect, so the suite runs offline with fakes.
// ---------------------------------------------------------------------------
function makeDeps(overrides) {
  const base = {
    env: process.env,
    homedir: function () { return os.homedir(); },
    now: function () { return new Date(); },
    existsSync: fs.existsSync,
    readFileSync: fs.readFileSync,
    readdirSync: fs.readdirSync,
    statSync: fs.statSync,
    writeFileSync: fs.writeFileSync,
    mkdirSync: fs.mkdirSync,
    spawnSync: cp.spawnSync,
    readRepoVersion: function (root) {
      return require(path.join(__dirname, '..', 'lib', 'core', 'repo-version.cjs')).readRepoVersion(root).version;
    },
    gitHeadSha: function (root) {
      const r = cp.spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
      return r.status === 0 ? String(r.stdout).trim() : null;
    },
    gitLatestTag: function (root) {
      const r = cp.spawnSync('git', ['-C', root, 'describe', '--tags', '--abbrev=0', '--match', 'v*'], { encoding: 'utf8' });
      return r.status === 0 ? String(r.stdout).trim().replace(/^v/, '') : null;
    },
    out: function (t) { process.stdout.write(String(t) + '\n'); },
    err: function (t) { process.stderr.write(String(t) + '\n'); },
  };
  return Object.assign(base, overrides || {});
}

class UsageError extends Error {}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function shellQuote(s) {
  s = String(s);
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function excerpt(line) {
  const t = String(line).trim();
  return t.length > EXCERPT_MAX ? t.slice(0, EXCERPT_MAX - 3) + '...' : t;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function parseNum(s) {
  return parseInt(String(s).replace(/,/g, ''), 10);
}

function legExitCode(leg) {
  if (leg.outcome === 'RAN-OK') return LISTENER_EXIT.OK;
  if (leg.outcome === 'SKIPPED') return LISTENER_EXIT.SKIPPED;
  if (leg.outcome === 'RAN-DRIFT') return LISTENER_EXIT.DRIFT;
  if (leg.decision === 'STOP-WITH-ACTION') return LISTENER_EXIT.STOP_WITH_ACTION;
  return LISTENER_EXIT.STOP;
}

function combineExit(legs) {
  const order = [LISTENER_EXIT.STOP_WITH_ACTION, LISTENER_EXIT.STOP, LISTENER_EXIT.DRIFT, LISTENER_EXIT.SKIPPED];
  const codes = legs.map(legExitCode);
  for (const c of order) { if (codes.indexOf(c) !== -1) return c; }
  return LISTENER_EXIT.OK;
}

// ---------------------------------------------------------------------------
// Theo leg
// ---------------------------------------------------------------------------
function stopResult(reason, extra) {
  return Object.assign({ outcome: 'STOP', decision: 'STOP', reason: reason, theo_exit_code: null, theo: null, actions: [] }, extra || {});
}

// mapTheoResult(res, expect)
//   res     {status, stdout, error, signal} from the spawn
//   expect  {version, ref, mode} the listener asked for. runTheoLeg always
//           passes it (mode 'propose'); when present, the answer must be
//           about exactly that call (review WR-02): `mode` equals
//           expect.mode, `version` equals expect.version (null tolerated only
//           on codes 1 and 2, which can precede Theo recording it),
//           `plugin_ref_sha` equals expect.ref whenever Theo filled it in (and
//           it must be filled in on code 20, whose apply line is bound to that
//           sha). Any mismatch is an inconsistent answer: STOP, never a pass.
//           Omitting expect maps the exit table alone (unit tests of the
//           contract rows); the mode-vs-status consistency check runs either way.
function mapTheoResult(res, expect) {
  res = res || {};
  const status = res.status;
  const err = res.error || null;
  const signal = res.signal || null;

  // Three different kills, three different recoveries (review WR-05): only a
  // real timeout should send the navigator to THEO_SYNC_TIMEOUT_MS.
  if (err && err.code === 'ETIMEDOUT') {
    return stopResult('Theo did not answer before THEO_SYNC_TIMEOUT_MS (spawn ETIMEDOUT' + (signal ? ', sent ' + signal : '') +
      '); the sync result is unknown and never treated as current. Only the python process was signalled: Theo child processes may still be running and writing in the Theo tree, so check `ps` before re-running. Then raise THEO_SYNC_TIMEOUT_MS or run the call by hand, and re-run the cut.');
  }
  if (err && err.code === 'ENOBUFS') {
    return stopResult('Theo stdout exceeded the 16 MiB listener buffer (spawn ENOBUFS' + (signal ? ', killed with ' + signal : '') +
      '); the contract allows exactly one JSON line, so this is a contract violation and never treated as current. Report it to the navigator; raising THEO_SYNC_TIMEOUT_MS will not help.');
  }
  if (signal && status == null) {
    return stopResult('Theo was killed by ' + signal + ' before answering (not a listener timeout: for example the OOM killer or an operator kill); the sync result is unknown and never treated as current. Find out what killed it, then re-run the cut.');
  }
  if (err) {
    return stopResult('Theo could not be run (' + (err.code || err.message) + '); never treated as current.');
  }
  if (typeof status !== 'number') {
    return stopResult('Theo exited without a status code; never treated as current.');
  }

  const entry = THEO_EXIT_MAP[status];
  if (!entry) {
    return stopResult('Theo exited with code ' + status + ', which the contract does not define; never treated as a pass.', { theo_exit_code: status });
  }

  const lines = String(res.stdout || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  const last = lines.length ? lines[lines.length - 1] : '';
  let obj = null;
  try { obj = last ? JSON.parse(last) : null; } catch (_) { obj = null; }
  const violation = function (why) {
    return stopResult('contract violation: ' + why + ' (Theo exit ' + status + '); never treated as current.', { theo_exit_code: status, theo: obj });
  };
  if (!obj || typeof obj !== 'object') return violation('stdout carried no parseable ' + THEO_CONTRACT + ' JSON line');
  if (obj.contract !== THEO_CONTRACT) return violation('contract field is ' + JSON.stringify(obj.contract) + ', expected ' + THEO_CONTRACT);
  if (obj.exit_code !== status) return violation('JSON exit_code ' + JSON.stringify(obj.exit_code) + ' differs from the process exit code');
  if (entry.statuses.indexOf(obj.status) === -1) return violation('status ' + JSON.stringify(obj.status) + ' does not belong to code ' + status);
  if (obj.mode !== 'propose' && obj.mode !== 'verify') return violation('mode is ' + JSON.stringify(obj.mode) + ', expected propose or verify');
  if (STATUS_MODE[obj.status] && STATUS_MODE[obj.status] !== obj.mode) {
    return violation('status ' + JSON.stringify(obj.status) + ' is a ' + STATUS_MODE[obj.status] + '-mode answer but mode is ' + JSON.stringify(obj.mode));
  }
  if (expect) {
    if (expect.mode != null && obj.mode !== expect.mode) {
      return violation('answer is for mode ' + JSON.stringify(obj.mode) + ', but the listener asked for ' + JSON.stringify(expect.mode));
    }
    if (expect.version != null && obj.version !== expect.version &&
        !(obj.version === null && VERSION_MAY_BE_NULL.indexOf(status) !== -1)) {
      return violation('answer is for version ' + JSON.stringify(obj.version) + ', but the listener asked about ' + JSON.stringify(expect.version));
    }
    if (expect.ref != null) {
      const sha = obj.plugin_ref_sha;
      if (sha != null && sha !== expect.ref) {
        return violation('answer resolved plugin_ref_sha ' + JSON.stringify(sha) + ', but the listener passed --ref ' + expect.ref);
      }
      if (sha == null && status === 20) {
        return violation('code 20 must name the plugin_ref_sha its apply line is bound to (expected ' + expect.ref + ')');
      }
    }
  }

  let reason = entry.next;
  const actions = [];
  let decision = entry.decision;
  let outcome = entry.outcome;

  if (status === 10) {
    const wins = Array.isArray(obj.windows) ? obj.windows : [];
    const named = wins.map(function (w) { return (w && w.id) + ' (ends when: ' + (w && w.ends_when) + ')'; });
    reason += ' Open window' + (named.length === 1 ? '' : 's') + ': ' + (named.length ? named.join('; ') : '(none named)') + '.';
  }
  if (status === 20) {
    if (!obj.apply_command || !obj.verify_command) {
      return violation('code 20 must carry apply_command and verify_command');
    }
    actions.push('1. Apply (the only write to Theo\'s graph; run once, always the newest line):');
    actions.push(obj.apply_command);
    actions.push('2. Verify:');
    actions.push(obj.verify_command);
    actions.push('3. When verify succeeds it prints a follow-on (today: node scripts/refresh-framework-names.cjs --live); run it here, commit data/framework-names.json, then re-run the cut.');
  }
  if (status === 22) {
    actions.push('1. Apply: run the newest apply line from the propose run (re-run the cut without --dry-run for a fresh one if it is lost).');
    actions.push('2. Verify:');
    actions.push(obj.verify_command || '(Theo printed no verify_command; re-run the cut to get one)');
  }
  if ((status === 0 && obj.status === 'verified') || status === 21) {
    if (obj.followon_command) {
      actions.push('Follow-on (run in this repo, then commit data/framework-names.json):');
      actions.push(obj.followon_command);
    }
  }
  if (obj.message && outcome !== 'RAN-OK') {
    reason += ' Theo says: ' + obj.message;
  }
  return { outcome: outcome, decision: decision, reason: reason, theo_exit_code: status, theo: obj, actions: actions };
}

function resolveTheoPaths(deps) {
  const env = deps.env || {};
  const theoDir = env.THEO_DIR || path.join(deps.homedir(), 'Theo');
  const python = env.THEO_PYTHON || path.join(theoDir, '.theo-graph', '.venv', 'bin', 'python3');
  const script = path.join(theoDir, '.theo-graph', 'release_sync.py');
  return { theoDir: theoDir, python: python, script: script };
}

function runTheoLeg(opts, deps) {
  opts = opts || {};
  const pluginRoot = opts.pluginRoot;
  let version = opts.version;
  let ref = opts.ref;
  if (version == null) {
    try { version = deps.readRepoVersion(pluginRoot); } catch (e) {
      throw new UsageError('could not read the repo version via lib/core/repo-version.cjs (' + e.message + '); pass --version');
    }
  }
  if (!VERSION_RE.test(String(version))) throw new UsageError('--version must be a plain X.Y.Z[-pre] with no leading v, got ' + JSON.stringify(version));
  if (ref == null) {
    ref = deps.gitHeadSha(pluginRoot);
    if (!ref) throw new UsageError('could not resolve git rev-parse HEAD in ' + pluginRoot + '; pass --ref');
  }
  if (!SHA_RE.test(String(ref))) throw new UsageError('--ref must be a full 40-hex lowercase sha (never HEAD or a branch), got ' + JSON.stringify(ref));

  const p = resolveTheoPaths(deps);
  const argv = [p.script, '--plugin-root', pluginRoot, '--version', version, '--ref', ref, '--json'];
  const command = [p.python].concat(argv);
  const call = command.map(shellQuote).join(' ');
  const leg = {
    leg: 'theo', outcome: null, decision: null, reason: null, version: version,
    command: command, call: call, theo_exit_code: null, theo: null, actions: [],
  };

  const checks = [['THEO_DIR', p.theoDir], ['Theo venv python (THEO_PYTHON)', p.python], ['release_sync.py', p.script]];
  for (const c of checks) {
    if (!deps.existsSync(c[1])) {
      return Object.assign(leg, {
        outcome: 'SKIPPED', decision: 'CONTINUE',
        // No claim about the Step 0.6 stamp gate here (review WR-03): the
        // listener cannot see release.sh's flags (--no-theo-check turns that
        // gate off), so release.sh's own Step 0.55 line says what guards.
        reason: 'SKIPPED: ' + c[0] + ' not found at ' + c[1] + '; Theo was NOT asked to sync.',
      });
    }
  }

  if (opts.dryRun) {
    return Object.assign(leg, { outcome: 'SKIPPED', decision: 'CONTINUE', reason: '--dry-run: printed the call, ran nothing' });
  }

  const env = deps.env || {};
  const t = parseInt(env.THEO_SYNC_TIMEOUT_MS, 10);
  const timeout = Number.isFinite(t) && t > 0 ? t : DEFAULT_TIMEOUT_MS;
  if (typeof opts.note === 'function') opts.note('theo leg: calling ' + call);
  const res = deps.spawnSync(p.python, argv, {
    cwd: p.theoDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: timeout,
    maxBuffer: 16 * 1024 * 1024,
  }) || {};
  if (res.error && (res.error.code === 'ENOENT' || res.error.code === 'EACCES')) {
    return Object.assign(leg, {
      outcome: 'SKIPPED', decision: 'CONTINUE',
      reason: 'SKIPPED: the Theo venv python at ' + p.python + ' could not be run (' + res.error.code + '); Theo was NOT asked to sync.',
    });
  }
  return Object.assign(leg, mapTheoResult(
    { status: res.status, stdout: res.stdout, error: res.error, signal: res.signal },
    { version: version, ref: ref, mode: 'propose' }));
}

// ---------------------------------------------------------------------------
// Website leg (read-only: nothing here opens a website file for writing)
// ---------------------------------------------------------------------------
function readText(deps, p) {
  try { return String(deps.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function resolveWebsiteDir(opts, deps) {
  if (opts.websiteDir) return opts.websiteDir;
  const env = deps.env || {};
  if (env.MINDRIAN_WEBSITE_DIR) return env.MINDRIAN_WEBSITE_DIR;
  return path.join(deps.homedir(), 'mindrian-website', 'website');
}

function walkScan(deps, dir, acc) {
  let entries;
  try { entries = deps.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  entries = entries.slice().sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink && e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walkScan(deps, p, acc);
    } else if (e.isFile()) {
      if (/\.map$/i.test(e.name)) continue;
      if (!SCAN_EXTS.has(path.extname(e.name).toLowerCase())) continue;
      try { if (deps.statSync(p).size > MAX_SCAN_BYTES) continue; } catch (_) { continue; }
      acc.push(p);
    }
  }
}

function runWebsiteLeg(opts, deps) {
  opts = opts || {};
  const pluginRoot = opts.pluginRoot;
  const websiteDir = resolveWebsiteDir(opts, deps);
  let version = opts.version;
  if (version == null) {
    version = deps.gitLatestTag(pluginRoot);
    if (!version) throw new UsageError('could not resolve the latest v* tag in ' + pluginRoot + '; pass --version');
  }
  if (!VERSION_RE.test(String(version))) throw new UsageError('--version must be a plain X.Y.Z[-pre] with no leading v, got ' + JSON.stringify(version));

  const checklistPath = path.join(path.dirname(websiteDir), 'docs', 'VERSION-BUMP-CHECKLIST.md');
  const leg = {
    leg: 'website', outcome: null, decision: 'CONTINUE', reason: null, version: version,
    website_dir: websiteDir, checklist_path: checklistPath, plugin_command_count: null,
    rows: [], banned: [], allowed: [], hints: [],
    counts: { ok: 0, drift: 0, missing: 0, gone: 0, review: 0, unmirrored: 0, unknown: 0, banned: 0 },
  };

  if (!deps.existsSync(websiteDir)) {
    leg.outcome = 'SKIPPED';
    leg.reason = 'SKIPPED: website dir not found at ' + websiteDir + ' (set MINDRIAN_WEBSITE_DIR or --website-dir); nothing was scanned. Reconcile the website by hand per its docs/VERSION-BUMP-CHECKLIST.md.';
    return leg;
  }

  // Plugin command count.
  const regPath = path.join(pluginRoot, 'data', 'command-registry.json');
  let pluginCount = null;
  let regProblem = null;
  try {
    const reg = JSON.parse(String(deps.readFileSync(regPath, 'utf8')));
    if (!reg || !Array.isArray(reg.commands)) throw new Error('no commands array');
    pluginCount = reg.commands.length;
  } catch (e) {
    regProblem = 'plugin command count unreadable from ' + regPath + ' (' + e.message + ')';
  }
  leg.plugin_command_count = pluginCount;

  const rows = leg.rows;
  const add = function (r) { rows.push(Object.assign({ expected: null, found: null, line: null }, r)); };
  const abs = function (rel) { return path.join(websiteDir, rel); };

  // FALLBACK_VERSION.
  {
    const rel = 'src/lib/version.ts';
    const text = readText(deps, abs(rel));
    if (text == null) {
      add({ surface: 'FALLBACK_VERSION', file: rel, status: 'MISSING', expected: 'v' + version });
    } else {
      const m = /FALLBACK_VERSION\s*=\s*["'`]([^"'`]+)["'`]/.exec(text);
      if (!m) add({ surface: 'FALLBACK_VERSION', file: rel, status: 'DRIFT', expected: 'v' + version, found: '(no FALLBACK_VERSION literal)' });
      else add({ surface: 'FALLBACK_VERSION', file: rel, status: m[1] === 'v' + version ? 'OK' : 'DRIFT', expected: 'v' + version, found: m[1], line: lineOf(text, m.index) });
    }
  }

  // truth-claims.ts RELEASE: the plugin release every truth claim was checked
  // against, checked exactly like FALLBACK_VERSION.
  {
    const rel = 'src/lib/truth-claims.ts';
    const text = readText(deps, abs(rel));
    if (text == null) {
      add({ surface: 'truth-claims RELEASE', file: rel, status: 'MISSING', expected: 'v' + version });
    } else {
      const m = /\bconst\s+RELEASE\s*=\s*["'`]([^"'`]+)["'`]/.exec(text);
      if (!m) add({ surface: 'truth-claims RELEASE', file: rel, status: 'DRIFT', expected: 'v' + version, found: '(no const RELEASE literal)' });
      else add({ surface: 'truth-claims RELEASE', file: rel, status: m[1] === 'v' + version ? 'OK' : 'DRIFT', expected: 'v' + version, found: m[1], line: lineOf(text, m.index) });
    }
  }

  // commands-canon.json version + count.
  let canonDrift = false;
  {
    const rel = 'src/data/commands-canon.json';
    const text = readText(deps, abs(rel));
    if (text == null) {
      add({ surface: 'commands-canon version', file: rel, status: 'MISSING', expected: version });
      add({ surface: 'commands-canon count', file: rel, status: 'MISSING', expected: pluginCount });
      canonDrift = true;
    } else {
      let canon = null;
      try { canon = JSON.parse(text); } catch (_) { canon = null; }
      const vm = /"version"\s*:\s*"([^"]*)"/.exec(text);
      const vLine = vm ? lineOf(text, vm.index) : null;
      const found = canon && typeof canon.version === 'string' ? canon.version : '(unparseable)';
      const vStatus = found === version ? 'OK' : 'DRIFT';
      add({ surface: 'commands-canon version', file: rel, status: vStatus, expected: version, found: found, line: vLine });
      if (vStatus !== 'OK') canonDrift = true;
      let n = null;
      if (canon && Array.isArray(canon.groups)) {
        n = canon.groups.reduce(function (s, g) { return s + (g && Array.isArray(g.commands) ? g.commands.length : 0); }, 0);
      }
      let cStatus;
      if (pluginCount == null) cStatus = 'UNKNOWN';
      else cStatus = n === pluginCount ? 'OK' : 'DRIFT';
      add({ surface: 'commands-canon count', file: rel, status: cStatus, expected: pluginCount, found: n == null ? '(unparseable)' : n });
      if (cStatus === 'DRIFT') canonDrift = true;
    }
  }

  // Literal "N commands" lines.
  let literalDrift = false;
  for (const rel of SURFACES.counts) {
    const text = readText(deps, abs(rel));
    if (text == null) {
      add({ surface: 'command count', file: rel, status: 'GONE' });
      continue;
    }
    const lines = text.split('\n');
    let hits = 0;
    lines.forEach(function (ln, i) {
      COUNT_RE.lastIndex = 0;
      let m;
      while ((m = COUNT_RE.exec(ln)) !== null) {
        hits += 1;
        const n = parseNum(m[1]);
        const plus = !!m[2];
        let status;
        if (pluginCount == null) status = 'UNKNOWN';
        else if (plus) status = n <= pluginCount ? 'OK' : 'DRIFT';
        else status = n === pluginCount ? 'OK' : 'DRIFT';
        if (status === 'DRIFT') literalDrift = true;
        add({ surface: 'command count', file: rel, status: status, expected: pluginCount, found: m[1] + (plus ? '+' : ''), line: i + 1 });
      }
    });
    if (hits === 0) add({ surface: 'command count', file: rel, status: 'OK', expected: pluginCount, found: '(no literal N commands)' });
  }

  // Review surfaces.
  for (const r of SURFACES.review) {
    const exists = deps.existsSync(abs(r[0]));
    add({ surface: 'review: ' + r[1], file: r[0], status: exists ? 'REVIEW' : 'GONE' });
  }

  // Checklist mirror check.
  const checklist = readText(deps, checklistPath);
  if (checklist == null) {
    add({ surface: 'checklist', file: checklistPath, status: 'MISSING' });
  } else {
    const known = new Set([].concat(SURFACES.version, SURFACES.counts, SURFACES.review.map(function (r) { return r[0]; }), SURFACES.auto));
    const seen = new Set();
    const re = /`(src\/[^`\s]+\.[A-Za-z0-9]+)`/g;
    let m;
    while ((m = re.exec(checklist)) !== null) {
      const rel = m[1];
      if (known.has(rel) || seen.has(rel)) continue;
      seen.add(rel);
      add({ surface: 'checklist path not mirrored in SURFACES', file: rel, status: 'UNMIRRORED', line: lineOf(checklist, m.index) });
    }
  }

  // Banned scan.
  const files = [];
  walkScan(deps, path.join(websiteDir, 'src'), files);
  for (const p of files) {
    const text = readText(deps, p);
    if (text == null) continue;
    const rel = path.relative(websiteDir, p).split(path.sep).join('/');
    text.split('\n').forEach(function (ln, i) {
      const ruleHit = {};
      for (const r of BANNED_RULES) {
        if (ruleHit[r.rule]) continue;
        if (!r.re.test(ln)) continue;
        ruleHit[r.rule] = true;
        const hit = { rule: r.rule, file: rel, line: i + 1, excerpt: excerpt(ln) };
        if (r.allowIf && r.allowIf.test(ln)) leg.allowed.push(hit);
        else leg.banned.push(hit);
      }
    });
  }

  // Tally.
  rows.forEach(function (r) {
    const k = r.status.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(leg.counts, k)) leg.counts[k] += 1;
  });
  leg.counts.banned = leg.banned.length;

  const flips = leg.counts.drift + leg.counts.missing + leg.counts.unknown + leg.counts.banned;
  leg.outcome = flips > 0 ? 'RAN-DRIFT' : 'RAN-OK';

  if (canonDrift) {
    leg.hints.push('commands-canon: in the website repo: MOS_CANON_VERSION=' + version + ' MOS_PLUGIN_DIR=' + pluginRoot +
      ' node scripts/gen-commands-canon.mjs (website GSD workflow; this listener never runs it)');
  }
  if (literalDrift || leg.banned.length || leg.counts.missing) {
    leg.hints.push('fix via the website GSD workflow per its docs/VERSION-BUMP-CHECKLIST.md');
  }

  const parts = [];
  parts.push(leg.counts.ok + ' ok');
  if (leg.counts.drift) parts.push(leg.counts.drift + ' drift');
  if (leg.counts.missing) parts.push(leg.counts.missing + ' missing');
  if (leg.counts.unknown) parts.push(leg.counts.unknown + ' unknown');
  if (leg.counts.gone) parts.push(leg.counts.gone + ' gone');
  if (leg.counts.review) parts.push(leg.counts.review + ' review');
  if (leg.counts.unmirrored) parts.push(leg.counts.unmirrored + ' unmirrored');
  parts.push(leg.counts.banned + ' banned');
  if (leg.allowed.length) parts.push(leg.allowed.length + ' allowed');
  leg.reason = 'website surfaces vs v' + version + ': ' + parts.join(', ') + (regProblem ? '; ' + regProblem : '') + '.';
  return leg;
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------
function wrap(text, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (let w of words) {
    while (w.length > width) {
      if (cur) { out.push(cur); cur = ''; }
      out.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += ' ' + w;
    else { out.push(cur); cur = w; }
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

function boxLine(content) {
  const inner = BOX_WIDTH - 4;
  return '| ' + content + ' '.repeat(Math.max(0, inner - content.length)) + ' |';
}

function renderReport(report) {
  const inner = BOX_WIDTH - 4;
  const rule = '+' + '-'.repeat(BOX_WIDTH - 2) + '+';
  const out = [];
  out.push(rule);
  const title = 'release-cut listener' + (report.dry_run ? ' (--dry-run)' : '') + '  exit ' + report.exit_code;
  out.push(boxLine(title.slice(0, inner)));
  out.push(rule);
  for (const leg of report.legs) {
    const head = leg.leg + '  ' + leg.outcome + (leg.decision ? '  ' + leg.decision : '') + (leg.version ? '  v' + leg.version : '');
    wrap(head, inner).forEach(function (l) { out.push(boxLine(l)); });
    wrap(leg.reason || '', inner - 2).forEach(function (l) { out.push(boxLine('  ' + l)); });
  }
  out.push(rule);

  for (const leg of report.legs) {
    if (leg.leg === 'theo') {
      out.push('');
      out.push('theo leg:');
      if (leg.call) out.push('  call: ' + leg.call);
      if (leg.theo_exit_code != null) out.push('  theo exit code: ' + leg.theo_exit_code + (leg.theo && leg.theo.status ? ' (' + leg.theo.status + ')' : ''));
      if (leg.theo && leg.theo.message) out.push('  theo message: ' + leg.theo.message);
      if (leg.actions && leg.actions.length) {
        out.push('  navigator lines (copy as printed, never wrapped):');
        leg.actions.forEach(function (a) { out.push(a); });
      }
    } else if (leg.leg === 'website') {
      out.push('');
      out.push('website leg:');
      out.push('  website dir: ' + leg.website_dir);
      if (leg.checklist_path) out.push('  checklist: ' + leg.checklist_path);
      if (leg.rows && leg.rows.length) {
        out.push('  plugin command count: ' + (leg.plugin_command_count == null ? 'UNKNOWN' : leg.plugin_command_count));
        const loc = function (r) { return r.file + (r.line ? ':' + r.line : ''); };
        const w1 = Math.max.apply(null, leg.rows.map(function (r) { return r.status.length; }).concat([6]));
        const w2 = Math.max.apply(null, leg.rows.map(function (r) { return loc(r).length; }).concat([4]));
        out.push('  ' + 'STATUS'.padEnd(w1) + '  ' + 'FILE'.padEnd(w2) + '  SURFACE / EXPECTED / FOUND');
        leg.rows.forEach(function (r) {
          let tail = r.surface;
          if (r.expected != null || r.found != null) tail += ' / ' + (r.expected == null ? '-' : r.expected) + ' / ' + (r.found == null ? '-' : r.found);
          out.push('  ' + r.status.padEnd(w1) + '  ' + loc(r).padEnd(w2) + '  ' + tail);
        });
      }
      if (leg.banned && leg.banned.length) {
        out.push('  banned content:');
        leg.banned.forEach(function (b) { out.push('    BANNED ' + b.rule + '  ' + b.file + ':' + b.line + '  ' + b.excerpt); });
      }
      if (leg.allowed && leg.allowed.length) {
        out.push('  allowed (checklist exemption):');
        leg.allowed.forEach(function (b) { out.push('    ALLOWED ' + b.rule + '  ' + b.file + ':' + b.line + '  ' + b.excerpt); });
      }
      if (leg.hints && leg.hints.length) {
        out.push('  recovery:');
        leg.hints.forEach(function (h) { out.push('    ' + h); });
      }
    }
  }
  return out.join('\n');
}

function utcStamp(d) {
  const p = function (n) { return String(n).padStart(2, '0'); };
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { sub: null, help: false, pluginRoot: null, version: null, ref: null, websiteDir: null, reportDir: null, dryRun: false, json: false };
  const valued = { '--plugin-root': 'pluginRoot', '--version': 'version', '--ref': 'ref', '--website-dir': 'websiteDir', '--report-dir': 'reportDir' };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (Object.prototype.hasOwnProperty.call(valued, t)) {
      // A missing value, or a value that is itself a flag, is a usage error
      // (review WR-01): `theo --report-dir --dry-run` must never take
      // --dry-run as the directory and then run Theo live.
      if (i + 1 >= argv.length || String(argv[i + 1]).indexOf('-') === 0) {
        throw new UsageError(t + ' needs a value' + (i + 1 < argv.length ? ', got the flag ' + argv[i + 1] : ''));
      }
      a[valued[t]] = argv[++i];
      continue;
    }
    switch (t) {
      case '--dry-run': a.dryRun = true; break;
      case '--json': a.json = true; break;
      // -h / --help is a boolean that main() checks BEFORE the subcommand
      // switch (review CR-01): `theo --help` must print usage and spawn
      // nothing, never fall through to a live Theo propose (which writes into
      // Theo and mints a new apply token, killing any line already printed).
      case '-h':
      case '--help': a.help = true; break;
      default:
        if (t.indexOf('-') === 0) throw new UsageError('unknown flag ' + t);
        if (a.sub) throw new UsageError('unexpected argument ' + t);
        a.sub = t;
    }
  }
  return a;
}

function main(argv, deps) {
  deps = deps || makeDeps();
  let a;
  try {
    a = parseArgs(argv || []);
    if (a.help || a.sub === 'help') {
      deps.out(USAGE);
      return LISTENER_EXIT.OK;
    }
    switch (a.sub) {
      case 'theo':
      case 'website':
        break;
      case 'all':
        if (a.version != null) throw new UsageError('`all` rejects --version: the theo leg uses the repo version (pre-cut placeholder) and the website leg the released tag; run the legs separately to pin a version');
        break;
      case null:
        throw new UsageError('missing subcommand');
      default:
        throw new UsageError('unknown subcommand ' + a.sub);
    }
    if (a.version != null && !VERSION_RE.test(a.version)) throw new UsageError('--version must be a plain X.Y.Z[-pre] with no leading v, got ' + JSON.stringify(a.version));
    if (a.ref != null && !SHA_RE.test(a.ref)) throw new UsageError('--ref must be a full 40-hex lowercase sha (never HEAD or a branch), got ' + JSON.stringify(a.ref));
  } catch (e) {
    if (e instanceof UsageError) {
      deps.err('release-cut-listener: ' + e.message);
      deps.err(USAGE);
      return LISTENER_EXIT.USAGE;
    }
    deps.err('release-cut-listener: INTERNAL: ' + (e && e.stack ? e.stack : e));
    return LISTENER_EXIT.INTERNAL;
  }

  const note = a.json ? deps.err : deps.out;
  try {
    const pluginRoot = path.resolve(a.pluginRoot || path.join(__dirname, '..'));
    const legs = [];
    if (a.sub === 'theo' || a.sub === 'all') {
      legs.push(runTheoLeg({ pluginRoot: pluginRoot, version: a.sub === 'theo' ? a.version : null, ref: a.ref, dryRun: a.dryRun, note: note }, deps));
    }
    if (a.sub === 'website' || a.sub === 'all') {
      legs.push(runWebsiteLeg({ pluginRoot: pluginRoot, version: a.sub === 'website' ? a.version : null, websiteDir: a.websiteDir }, deps));
    }
    const exitCode = combineExit(legs);
    const report = {
      contract: CONTRACT,
      generated_at: deps.now().toISOString(),
      plugin_root: pluginRoot,
      dry_run: a.dryRun,
      exit_code: exitCode,
      report_path: null,
      legs: legs,
    };

    let reportNote;
    if (a.dryRun) {
      reportNote = 'report: not written under --dry-run';
    } else {
      const env = deps.env || {};
      const dir = a.reportDir || env.MINDRIAN_CUT_LISTENER_REPORT_DIR || path.join(deps.homedir(), '.mindrian', 'release-cut-listener');
      const versions = legs.map(function (l) { return l.version; }).filter(Boolean)
        .filter(function (v, i, arr) { return arr.indexOf(v) === i; });
      const file = path.join(dir, utcStamp(deps.now()) + '-' + a.sub + '-' + (versions.join('+') || 'unknown') + '.json');
      try {
        deps.mkdirSync(dir, { recursive: true });
        report.report_path = file;
        deps.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
        reportNote = 'report: ' + file;
      } catch (e) {
        report.report_path = null;
        reportNote = 'WARN: report file not written: ' + (e && e.message ? e.message : e);
      }
    }

    if (a.json) {
      deps.out(JSON.stringify(report));
      deps.err(reportNote);
    } else {
      renderReport(report).split('\n').forEach(function (l) { deps.out(l); });
      deps.out(reportNote);
    }
    return exitCode;
  } catch (e) {
    if (e instanceof UsageError) {
      deps.err('release-cut-listener: ' + e.message);
      deps.err(USAGE);
      return LISTENER_EXIT.USAGE;
    }
    deps.err('release-cut-listener: INTERNAL: ' + (e && e.stack ? e.stack : e));
    return LISTENER_EXIT.INTERNAL;
  }
}

module.exports = {
  main: main,
  mapTheoResult: mapTheoResult,
  runTheoLeg: runTheoLeg,
  runWebsiteLeg: runWebsiteLeg,
  renderReport: renderReport,
  makeDeps: makeDeps,
  THEO_EXIT_MAP: THEO_EXIT_MAP,
  LISTENER_EXIT: LISTENER_EXIT,
  SURFACES: SURFACES,
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2), makeDeps());
}
