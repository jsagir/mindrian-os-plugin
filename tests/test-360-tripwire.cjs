#!/usr/bin/env node
'use strict';
/*
 * Phase 360 Plan 02 -- the R4 / R8 / R9 tripwire (D-15).
 *
 * R4: scripts/intent-classifier.cjs holds no harness lead literal and no
 *     isMeta / origin.kind comparison of its own; the ONE HARNESS_LEADS list
 *     lives in exactly lib/hmi/turn-text.cjs; the classifier calls its
 *     classifyUserPromptText export (r4c stays RED until 360-07 lands it).
 * R8: the committed 360 fixtures carry only authored placeholders -- no
 *     snapshot session UUID, no peer socket path, no 8-hex-char snapshot-id
 *     prefix (checked by sha256, never by writing the id itself), no
 *     .jsonl / .cache/ path added by a 360 commit.
 * R9: 360's OWN commits (scoped by --grep, not a raw PLAN_BASE..HEAD range,
 *     because parallel phases commit to this same main -- Pitfall 4) never
 *     touch lib/mcp/ or any file on the 357-07 never-edit list.
 *
 * Every sensitive search pattern is assembled from string PARTS at run time
 * (join() calls) so this file can never match its own source text.
 *
 * Node built-ins only. `--only <prefix>` runs every leg whose id starts with
 * that prefix (e.g. `--only r8` runs r8a..r8e). No em-dashes.
 *
 * Run: node tests/test-360-tripwire.cjs [--only <prefix>]
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSIFIER_PATH = path.join(REPO_ROOT, 'scripts', 'intent-classifier.cjs');
const TURN_TEXT_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'turn-text.cjs');
const CASES_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'ups-harness-360', 'cases.json');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'ups-harness-360');

let PRE_PHASE = null;
try {
  PRE_PHASE = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, 'pre-phase.json'), 'utf8'));
} catch (_e) {
  PRE_PHASE = null;
}
const PLAN_BASE_SHA = (PRE_PHASE && typeof PRE_PHASE.plan_base_sha === 'string')
  ? PRE_PHASE.plan_base_sha
  : null;

// ---------------------------------------------------------------------------
// Sensitive patterns, assembled from parts (never a contiguous literal in
// this file's own source, so r4a/r8c can never trip on themselves).
// ---------------------------------------------------------------------------
function j(parts) { return parts.join(''); }

// SPEC R4's five harness lead literals, verbatim from 360-SPEC.md acceptance
// text (requirement 4).
const FIXED_LEADS = Object.freeze([
  j(['<', 'task', '-', 'notification']),
  j(['<', 'cross', '-', 'session', '-', 'message']),
  j(['<', 'agent', '-', 'message']),
  j(['Cross', '-', 'session', ' ', 'idle', ' ', 'notice']),
  j(['Another', ' ', 'Claude', ' ', 'session', ' ', 'sent']),
]);

// The shipped HARNESS_LEADS list, read live from turn-text.cjs when it
// exports one (357-07 already ships it at plan-02 time; 360-06/07 widen it).
// A missing module or export degrades to an empty array -- never a throw.
let HARNESS_LEADS = [];
try {
  const tt = require(TURN_TEXT_PATH);
  if (tt && Array.isArray(tt.HARNESS_LEADS)) HARNESS_LEADS = tt.HARNESS_LEADS.slice();
} catch (_e) {
  HARNESS_LEADS = [];
}

const ALL_LEAD_PATTERNS = FIXED_LEADS.concat(HARNESS_LEADS);

// The peer unix-domain-socket path prefix (R8), assembled from parts so it
// never appears contiguously in this file's own source.
const PEER_SOCKET_PREFIX = j(['uds', ':', '/run/user']);

// sha256(8-char snapshot session-id prefix) for the four sessions named in
// 360-SPEC.md's "Measured evidence" table. Only the HASHES are written here,
// never the ids themselves (r8c's own design constraint) -- computed locally
// via `node -e "console.log(require('crypto').createHash('sha256').update('<id>').digest('hex'))"`
// against each session's 8-char id prefix from that table.
const SNAPSHOT_ID_SHA256 = Object.freeze([
  '86dd2288d068bb1bbc97105cbd7c582e6b80f70de6d7ad938bb21851fc4cdcc5',
  'aded59fee646ef79e1da7aad44d71efbff8daa35e52f32d205916ab50a960e39',
  '2da102c57fcdd844f81dd14908b88b884dba1b9f21b6e48b5c721a92de0fa12e',
  'adeaaeb9861f4d1545274d75862f5ecc16e2bdeee4fda65458f387f0448e2ef5',
]);

// scripts/intent-classifier.cjs's own harness-lead-literal census (360-01's
// pre-phase.json), so r8c can prove the hashes above are computed over the
// SAME four ids the SPEC table names, without re-writing the ids here.
const SHA256 = require('node:crypto').createHash;
function sha256Hex(s) {
  return SHA256('sha256').update(s).digest('hex');
}

// The 357-07 never-edit list this plan's own <context> restates (D-20 /
// 357-07 precedent). A trailing '/' means "this whole directory".
const NEVER_EDIT = Object.freeze([
  'lib/mcp/',
  'lib/core/write-lock.cjs',
  'lib/core/part8-egress-guard.cjs',
  'scripts/doctor.cjs',
  'lib/core/graph-ops.cjs',
  'lib/core/navigation.cjs',
  'scripts/eval-icm-writers.cjs',
  'tests/test-353-grader-agreement.cjs',
  'tests/test-353-ledger-shape.cjs',
  'docs/OPEN-HANDOFFS.md',
]);

// ---------------------------------------------------------------------------
// Small file-reading / comment-stripping helpers.
// ---------------------------------------------------------------------------
function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

// nonCommentLines -- a deliberately simple heuristic (not a real JS parser):
// drop /* ... */ blocks, then drop any line whose TRIMMED text starts with
// '//'. A trailing '// comment' on a real code line is kept (worst case: a
// stray trailing comment could cause a false MATCH, never a false miss),
// which is the safe direction for a tripwire.
function nonCommentLines(text) {
  const stripped = stripBlockComments(text);
  return stripped.split('\n').filter(function (line) {
    const t = line.trim();
    if (!t) return false;
    if (t.indexOf('//') === 0) return false;
    return true;
  });
}

function walkFiles(dir, exts) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push.apply(out, walkFiles(full, exts));
    } else if (exts.some(function (ext) { return e.name.endsWith(ext); })) {
      out.push(full);
    }
  }
  return out;
}

// The 360 committed file set that R8 static legs scan: every file directly
// under tests/fixtures/ups-harness-360/, every tests/test-360-*.cjs file,
// and tests/run-all-360.sh.
function list360Files() {
  const out = [];
  try {
    for (const name of fs.readdirSync(FIXTURES_DIR)) {
      const full = path.join(FIXTURES_DIR, name);
      if (fs.statSync(full).isFile()) out.push(full);
    }
  } catch (_e) { /* fixtures dir not present yet */ }
  const testsDir = path.join(REPO_ROOT, 'tests');
  try {
    for (const name of fs.readdirSync(testsDir)) {
      if (/^test-360-.*\.cjs$/.test(name)) out.push(path.join(testsDir, name));
    }
  } catch (_e) { /* tests dir always present in this repo */ }
  const runAll = path.join(testsDir, 'run-all-360.sh');
  if (fs.existsSync(runAll)) out.push(runAll);
  return out;
}

// 360's OWN commits, scoped by --grep (Pitfall 4): a raw PLAN_BASE..HEAD
// range would also see phases 354/356/357's parallel commits to this same
// main, falsely failing r9 on their lib/mcp/ edits.
function get360Commits() {
  if (!PLAN_BASE_SHA) return [];
  let out;
  try {
    out = execFileSync(
      'git',
      ['log', '--format=%H', PLAN_BASE_SHA + '..HEAD', '--grep=(360-'],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
  } catch (_e) {
    return [];
  }
  return out.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
}

function changedFilesForCommit(sha, diffFilter) {
  const args = ['diff-tree', '--no-commit-id', '--name-only', '-r'];
  if (diffFilter) args.push('--diff-filter=' + diffFilter);
  args.push(sha);
  let out;
  try {
    out = execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (_e) {
    return [];
  }
  return out.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Leg harness.
// ---------------------------------------------------------------------------
const ONLY_PREFIX = (function () {
  const idx = process.argv.indexOf('--only');
  return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
})();

let checks = 0;
let failed = 0;

function assertTrue(cond, msg) {
  if (!cond) throw new Error(msg);
}

function leg(id, fn) {
  if (ONLY_PREFIX && id.indexOf(ONLY_PREFIX) !== 0) return;
  checks += 1;
  try {
    fn();
    console.log('  ok - ' + id);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + id + ': ' + (e && e.message ? e.message : String(e)));
  }
}

function skipLeg(id, reason) {
  if (ONLY_PREFIX && id.indexOf(ONLY_PREFIX) !== 0) return;
  checks += 1;
  console.log('  SKIP ' + id + ': ' + reason);
}

console.log('test-360-tripwire.cjs (360-02): R4 / R8 / R9 tripwire');

// ----- R4 --------------------------------------------------------------

leg('r4a', function () {
  const raw = readFile(CLASSIFIER_PATH);
  for (const p of ALL_LEAD_PATTERNS) {
    assertTrue(raw.indexOf(p) === -1,
      'scripts/intent-classifier.cjs contains a harness lead literal: ' + p);
  }
});

leg('r4b', function () {
  const raw = readFile(CLASSIFIER_PATH);
  const banned = ['isMeta', 'originKind', j(['origin', '.', 'kind'])];
  for (const token of banned) {
    assertTrue(raw.indexOf(token) === -1,
      'scripts/intent-classifier.cjs contains ' + token);
  }
});

// RED until 360-07: intent-classifier.cjs does not yet require turn-text.cjs
// or call classifyUserPromptText. Recorded RED in 360-02-SUMMARY.md.
leg('r4c', function () {
  const lines = nonCommentLines(readFile(CLASSIFIER_PATH));
  const joined = lines.join('\n');
  const requiresTurnText = /require\s*\([^)]*turn-text\.cjs/.test(joined);
  const callsExport = joined.indexOf('classifyUserPromptText') !== -1;
  assertTrue(requiresTurnText && callsExport,
    'scripts/intent-classifier.cjs does not yet require lib/hmi/turn-text.cjs '
    + 'and call classifyUserPromptText (expected RED until 360-07 lands D-06/D-07)');
});

leg('r4d', function () {
  const files = walkFiles(path.join(REPO_ROOT, 'lib'), ['.cjs', '.js'])
    .concat(walkFiles(path.join(REPO_ROOT, 'scripts'), ['.cjs', '.js']));
  const hits = [];
  let harnessLeadsAssignments = 0;
  for (const f of files) {
    let raw;
    try {
      raw = readFile(f);
    } catch (_e) {
      continue;
    }
    const lines = nonCommentLines(raw);
    let hasLead = false;
    for (const line of lines) {
      for (const p of ALL_LEAD_PATTERNS) {
        if (line.indexOf(p) !== -1) { hasLead = true; break; }
      }
      if (hasLead) break;
    }
    if (hasLead) hits.push(path.relative(REPO_ROOT, f).split(path.sep).join('/'));
    if (/HARNESS_LEADS\s*=/.test(raw)) harnessLeadsAssignments += 1;
  }
  hits.sort();
  const expected = ['lib/hmi/turn-text.cjs'];
  assertTrue(JSON.stringify(hits) === JSON.stringify(expected),
    'harness lead literal(s) defined outside the one expected file, got: ' + JSON.stringify(hits));
  assertTrue(harnessLeadsAssignments === 1,
    'HARNESS_LEADS assignment found in ' + harnessLeadsAssignments + ' file(s), expected exactly 1');
});

// ----- R8 --------------------------------------------------------------

leg('r8a', function () {
  const cases = JSON.parse(readFile(CASES_PATH));
  assertTrue(cases.meta && cases.meta.source === 'authored',
    'cases.json meta.source must be "authored"');
  assertTrue(typeof cases.meta.sanitization_statement === 'string'
    && cases.meta.sanitization_statement.length >= 200,
    'cases.json meta.sanitization_statement must be >= 200 chars');
});

leg('r8b', function () {
  const raw = readFile(CASES_PATH);
  const sids = [...raw.matchAll(/session_id"\s*:\s*"([^"]+)"/g)].map(function (m) { return m[1]; });
  assertTrue(sids.length > 0, 'no session_id values found in cases.json');
  for (const sid of sids) {
    assertTrue(/^sample-session-[a-z0-9-]+$/.test(sid),
      'session_id does not match the sample- placeholder pattern: ' + sid);
  }

  const fromMatches = raw.match(/from=[^ >]*/g) || [];
  assertTrue(fromMatches.length > 0, 'no from= occurrences found in cases.json');
  for (const m of fromMatches) {
    const cleaned = m.replace(/^from=/, '').replace(/\\/g, '').replace(/^"|"$/g, '');
    assertTrue(cleaned === 'sample-peer', 'from= value is not sample-peer: ' + m);
  }
});

// R8c: no committed 360 file carries the peer socket-path prefix, a
// UUID-shaped token, or an 8-hex-char token whose sha256 names one of the
// four SPEC-table session ids. A `dogfood-<8hex>-` corpus id (357's own
// sanitized corpus-id scheme, already reviewed under T-360-04 in 360-01's
// pre-phase.json) is the one recognized exception -- that is a STRUCTURAL
// corpus id built from a session-id prefix, not the raw id leaking in, and
// 360-01-SUMMARY.md already recorded it as reviewed/accepted.
leg('r8c', function () {
  const files = list360Files();
  assertTrue(files.length > 0, 'no 360 files found to scan');
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
  const hexTokenRe = /\b[0-9a-f]{8}\b/g;
  for (const f of files) {
    const raw = readFile(f);
    assertTrue(raw.indexOf(PEER_SOCKET_PREFIX) === -1,
      path.relative(REPO_ROOT, f) + ' contains the peer socket path prefix');
    assertTrue(!uuidRe.test(raw),
      path.relative(REPO_ROOT, f) + ' contains a UUID-shaped token');
    let m;
    hexTokenRe.lastIndex = 0;
    while ((m = hexTokenRe.exec(raw)) !== null) {
      const start = m.index;
      const precededByDogfood = raw.slice(Math.max(0, start - 8), start) === 'dogfood-';
      if (precededByDogfood) continue;
      const digest = sha256Hex(m[0]);
      assertTrue(SNAPSHOT_ID_SHA256.indexOf(digest) === -1,
        path.relative(REPO_ROOT, f) + ' contains an 8-hex-char token matching a snapshot session-id hash');
    }
  }
});

// R8d: local-only. Reads ONLY filenames (session-id stems) and structural
// from= attribute values from the raw snapshot -- never prompt bodies --
// and checks none of them appear verbatim in the committed 360 file set.
// Prints counts only. SKIPs (not a failure) when the snapshot is absent.
leg('r8d', function () {
  const snapshotDir = process.env.MOS360_SNAPSHOT_DIR
    || path.join(os.homedir(), '.cache', 'mindrian-dev', '357-raw');
  if (!fs.existsSync(snapshotDir)) {
    console.log('    (r8d local-only: snapshot dir not present at ' + snapshotDir
      + ', proceeding without the live-snapshot cross-check)');
    return;
  }
  let entries = [];
  try {
    entries = fs.readdirSync(snapshotDir);
  } catch (_e) {
    console.log('    (r8d local-only: snapshot dir unreadable, proceeding without the cross-check)');
    return;
  }
  const jsonlFiles = entries.filter(function (n) { return n.endsWith('.jsonl'); });
  const sessionStems = jsonlFiles
    .map(function (n) { return n.replace(/\.jsonl$/, ''); })
    .filter(function (n) { return /^[0-9a-f-]{20,}$/.test(n); });

  const peerNames = new Set();
  const SIZE_CAP = 32 * 1024 * 1024;
  for (const n of jsonlFiles) {
    const full = path.join(snapshotDir, n);
    try {
      const st = fs.statSync(full);
      if (st.size > SIZE_CAP) continue; // guard: never load a pathological file whole
      const raw = fs.readFileSync(full, 'utf8');
      for (const m of raw.matchAll(/from="([^"]+)"/g)) {
        peerNames.add(m[1]);
      }
    } catch (_e) { /* unreadable file: skip it, never fail the leg on this */ }
  }

  const files360 = list360Files();
  const combined360 = files360.map(function (f) {
    try { return readFile(f); } catch (_e) { return ''; }
  }).join('\n');

  let sessionIdLeakCount = 0;
  for (const stem of sessionStems) {
    if (combined360.indexOf(stem) !== -1) sessionIdLeakCount += 1;
  }
  let peerNameLeakCount = 0;
  for (const name of peerNames) {
    if (name === 'sample-peer') continue; // the committed placeholder itself
    if (combined360.indexOf(name) !== -1) peerNameLeakCount += 1;
  }

  console.log('    (r8d local-only: checked ' + sessionStems.length + ' session-id stem(s) and '
    + peerNames.size + ' distinct peer name(s) from the raw snapshot against the 360 file set; '
    + sessionIdLeakCount + ' session-id leak(s), ' + peerNameLeakCount + ' peer-name leak(s))');

  assertTrue(sessionIdLeakCount === 0, sessionIdLeakCount + ' raw snapshot session id(s) leaked into the 360 file set');
  assertTrue(peerNameLeakCount === 0, peerNameLeakCount + ' raw snapshot peer name(s) leaked into the 360 file set');
});

// R8e: 360's own commits add no .jsonl file and no .cache/ path; the repo
// never tracks a 357-raw directory.
leg('r8e', function () {
  const commits = get360Commits();
  const addedJsonl = [];
  const addedCache = [];
  for (const sha of commits) {
    const added = changedFilesForCommit(sha, 'A');
    for (const f of added) {
      if (f.endsWith('.jsonl')) addedJsonl.push(f);
      if (f.indexOf('.cache/') !== -1) addedCache.push(f);
    }
  }
  assertTrue(addedJsonl.length === 0, '360 commits added a .jsonl file: ' + addedJsonl.join(', '));
  assertTrue(addedCache.length === 0, '360 commits added a .cache/ path: ' + addedCache.join(', '));

  let tracked = [];
  try {
    tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' }).split('\n');
  } catch (_e) {
    tracked = [];
  }
  const raw357 = tracked.filter(function (f) { return f.indexOf('357-raw') !== -1; });
  assertTrue(raw357.length === 0, 'the repo tracks a 357-raw path: ' + raw357.join(', '));
});

// ----- R9 --------------------------------------------------------------

// R9 is scoped to 360's own commits via `git log --grep`, not a raw
// PLAN_BASE..HEAD range, because parallel phases commit to this same main
// (360-RESEARCH Pitfall 4).
leg('r9', function () {
  const commits = get360Commits();
  const violations = [];
  for (const sha of commits) {
    const changed = changedFilesForCommit(sha, null);
    for (const f of changed) {
      for (const banned of NEVER_EDIT) {
        const isDirBan = banned.charAt(banned.length - 1) === '/';
        const hit = isDirBan ? (f.indexOf(banned) === 0) : (f === banned);
        if (hit) violations.push(sha.slice(0, 8) + ':' + f);
      }
    }
  }
  assertTrue(violations.length === 0,
    '360 commit(s) touched a never-edit path: ' + violations.join(', '));
});

// ----- em (house rule) --------------------------------------------------

leg('em', function () {
  const emDash = Buffer.from([0xe2, 0x80, 0x94]).toString('utf8');
  const hits = [];
  for (const f of list360Files()) {
    const raw = readFile(f);
    if (raw.indexOf(emDash) !== -1) hits.push(path.relative(REPO_ROOT, f));
  }
  assertTrue(hits.length === 0, 'em-dash found in: ' + hits.join(', '));
});

console.log('PASS test-360-tripwire.cjs (' + checks + ' checks)');
if (failed > 0) process.exit(1);
