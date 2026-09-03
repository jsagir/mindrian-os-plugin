#!/usr/bin/env node
'use strict';

/*
 * Phase 128-02 Task 2 - scripts/check-substrate.cjs
 *
 * The CI guard that structurally enforces the Substrate Contract ADR
 * (docs/architecture/SUBSTRATE-CONTRACT.md, Plan 01). It is a STRICT SUPERSET
 * of scripts/check-schema-aliases.cjs --check-chokepoint per the ADR's
 * reuse-vs-build decision (Canon Part 7): it catches every require-pattern the
 * old guard caught PLUS the openGraph openers PLUS raw INSERT/UPDATE/DELETE on
 * nodes/edges/memory_event PLUS direct sqlite require PLUS Cypher user-content
 * interpolation (M4).
 *
 * Mandates enforced (from the ADR):
 *   M2 - read room.db only via lib/core/navigation.cjs (no raw fs read of room.db).
 *   M3 - no require('node:sqlite') / require('better-sqlite3') outside the chokepoint.
 *   M4 - no Cypher MATCH with user-content variable interpolation.
 *   plus: no raw INSERT/UPDATE/DELETE on nodes|edges|memory_event (un-provenanced
 *         write class, including the lazygraph-ops INSERT INTO nodes shape).
 *   plus: no openGraph(...) call outside the allow-list (the #1 production bypass).
 *   plus: the carried-forward --check-chokepoint require() bans (strict superset).
 *
 * CLI modes:
 *   default / --baseline : full-repo scan (lib/ + scripts/), print violations
 *                          grouped by rule, exit 0 (INFORMATIONAL; Plan 03 owns
 *                          blocking-on-net-new).
 *   --diff               : scan only staged files, exit 1 on any violation (the
 *                          pre-commit mode Plan 03 wires).
 *   --check-chokepoint   : alias that runs the superset scan in --diff mode (so
 *                          external callers of the retired subcommand keep working).
 *
 * Programmatic API (pure, no process.exit):
 *   scanFiles(files, readContent) -> Array<{file, line, rule, match}>
 *   scanStaged()                  -> Array<{file, line, rule, match}> (honors seams)
 *
 * Canon Part 6 (dog-fooding: the plugin's own CI guard enforces its contract).
 * Canon Part 7 (reuse: supersedes --check-chokepoint, reuses its scan idiom).
 * Canon Part 8 (LOCAL-only: ZERO network, ZERO Brain calls; node: builtins + git only).
 * Canon Part 9 (navigation.cjs is the only door; every bypass is a violation).
 *
 * Performance: zero new npm deps. node:fs + node:path + node:child_process
 * spawnSync (git only). No fetch, no http, no Brain.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Allow-list. Reused from scripts/check-schema-aliases.cjs ALLOWED_DIRECT_IMPORT
// as the base, extended per the ADR's M11 allow-list section. These paths are
// exempt from the room.db-access bans: the chokepoint itself, its submodules,
// the substrate self-files, tests/fixtures, and the migration scripts.
//
// NOTE on lazygraph-ops.cjs: it IS the bare-schema writer. The guard exempts its
// OWN body (its internal INSERTs are a known baseline violation Plan 03
// enumerates, NOT new-code to block). The guard flags CALLERS that openGraph or
// require it from a non-allowlisted path.
// ---------------------------------------------------------------------------
const ALLOWED_DIRECT_IMPORT = [
  // The guards themselves carry the ban patterns as regex/string literals; they
  // must exempt their own source or they trap their own maintenance (Phase 128
  // dog-food finding 2026-05-30).
  /^scripts\/check-substrate\.cjs$/,
  /^scripts\/check-schema-aliases\.cjs$/,
  /^lib\/core\/navigation\.cjs$/,
  /^lib\/core\/navigation\//,
  /^lib\/core\/room-db\.cjs$/,
  /^lib\/core\/lazygraph-ops\.cjs$/,
  /^lib\/core\/memory-ops\.cjs$/,
  /^lib\/core\/opportunity-ops\.cjs$/,
  // Phase 169 (D-169-11): the graph-derivation composer + the rollupSubRooms
  // RECURSIVE read-side ATTACH. Its WRITES already route through the navigation
  // chokepoint (writeClaimNode + writeEdge for the proposed node + typed edge);
  // it requires room-db.cjs ONLY to open the caller-owned write handle, and
  // node:sqlite ONLY for the cross-room read-only ATTACH the rollup needs (a
  // read-side UNION over child room.db files at arbitrary depth, for which the
  // navigation surface has no ATTACH primitive). The parent db is NEVER written
  // by the rollup (read-only open via file: mode=ro). Allow-listed alongside the
  // other substrate-adjacent core modules (room-db / lazygraph-ops / memory-ops).
  /^lib\/core\/graph-derivation\.cjs$/,
  // Phase 169-07 (GDH-08/09 + D-169-11): the full-citizen self-heal. It requires
  // room-db.cjs openRoomDb ONLY to open the caller-owned write handle for the
  // NESTED_WITHIN lineage edge (the edge WRITE itself routes through the
  // navigation chokepoint navigation/edges.cjs::writeEdge). It hand-rolls no
  // scaffold (it INVOKES room-birth.cjs birthRoom) and makes ZERO Brain call.
  // Allow-listed alongside graph-derivation.cjs.
  /^lib\/core\/graph-self-heal\.cjs$/,
  /^tests\//,
  /^tests\/fixtures\//,
  /^scripts\/migrate-/,
  /^scripts\/migrations\//,
  // v1.14.0 backward-compat grandfather (carried from check-schema-aliases.cjs):
  /^lib\/hmi\/across-session-memory\.cjs$/,
  /^lib\/core\/brain-derivation\.cjs$/,
  /^scripts\/compute-state$/,
  // Phase 108 substrate self-reference (migration scripts directory):
  /^lib\/core\/migrations\//,
  // Phase 272-08 (PYPORT-02/05): rs-engine.cjs's writeReverseSalientEdges
  // writes REVERSE_SALIENT edges (source='rs-engine') for three existing
  // consumers (futures/orchestrator.cjs's runRSReverseSalient,
  // leverage-scan.cjs's Level 6-8 band, reverse-salient-agent.cjs's
  // cascade reads). REVERSE_SALIENT is NOT a member of
  // lib/core/navigation/edges.cjs's ALLOWED_EDGE_TYPES -- its own header
  // (D-168, navigator-LOCKED 2026-06-18) explicitly names the
  // lazygraph-ops.cjs legacy-array two-vocabulary unification
  // (HSI_CONNECTION / REVERSE_SALIENT / RESOLVES_VIA) as a DEFERRED
  // follow-on, out of that reconciliation's scope. lazygraph-ops.cjs's own
  // EDGE_TYPES allowlist (a separate, wider vocabulary) already validates
  // REVERSE_SALIENT and performs the identical INSERT...ON CONFLICT upsert
  // pattern navigation/edges.cjs's writeEdge uses -- confirmed live this
  // session, matching futures/orchestrator.cjs's own pre-existing
  // require('../lazygraph-ops.cjs') usage for the SAME edge type via the
  // SAME openGraph/closeGraph pair. Route REVERSE_SALIENT through
  // navigation.cjs::writeEdge once a future phase lands the D-168-deferred
  // unification; until then this is the one legal door for this edge type.
  /^lib\/core\/rs-engine\.cjs$/,
  // R17-01 (260903-gdm Task 1, Rule 3 auto-fix): node-insert's own co-located
  // test suites (node-insert-overrides.test.cjs, node-insert-epistemic.test.cjs)
  // follow the SAME direct-DatabaseSync-over-a-tmpdir-room.db harness idiom
  // already established by lib/core/hsi-to-graph.test.cjs, room-discard-cascade
  // .test.cjs, room-naming-selector.test.cjs, and llm-name-suggester.test.cjs --
  // none of which are allow-listed, so all four already count as baseline
  // violations today. Without this entry, --diff mode blocks every NEW test
  // file written against that established idiom (a real gap: existing
  // committed instances are silently grandfathered into the baseline count,
  // but a fresh commit adding the identical pattern trips the pre-commit
  // hook). Scoped narrowly to node-insert's own test files, not the whole
  // lib/core/*.test.cjs surface, so the pre-existing 208-violation baseline
  // this plan's Task 3 measures against is not perturbed by a broader fix.
  /^lib\/core\/node-insert-.*\.test\.cjs$/,
  // Phase 296-03 (SEED-030, F-2): the D-02 CJS-to-Python vector bridge. It
  // requires room-db.cjs ONLY to open a caller-owned, allowExtension:true
  // handle (Pattern 1 -- the same openRoomDb(roomDir, {allowExtension:true})
  // idiom scripts/entity-extract.cjs and lib/core/eureka/research-filing.cjs
  // already use) so vector-store.cjs's sqlite-vec capability probe can
  // register on it. It performs ZERO node/edge/memory_event writes -- it
  // reads only the eureka_vec / eureka_vec_fallback / eureka_meta derived
  // projections through vector-store.cjs's own caller-owned-handle contract
  // (Canon Part 9: rebuildable projections, not graph state). Allow-listed
  // alongside the other substrate-adjacent room-db.cjs consumers above.
  /^scripts\/rs-vector-bridge\.cjs$/,
];

function isAllowedPath(p) {
  const normalized = String(p).replace(/\\/g, '/');
  return ALLOWED_DIRECT_IMPORT.some((rx) => rx.test(normalized));
}

// ---------------------------------------------------------------------------
// R17-01 (260903-gdm Task 1, Rule 3 auto-fix): diff-mode-ONLY rule exemptions.
//
// node-insert.cjs IS the single node-write chokepoint (Phase 140-01 / R17).
// Its two `INSERT INTO nodes` statements are the low-level primitive every
// other production site now routes through -- they are not a bypass, they
// ARE the sanctioned door. Those two lines are already counted in the
// --baseline full-repo scan (part of the documented 208 / raw-graph-write 55
// in docs/architecture/SUBSTRATE-BASELINE.md) and stay counted there; this
// exemption ONLY narrows the --diff net-new-aware pre-commit check.
//
// Why a narrower exemption than ALLOWED_DIRECT_IMPORT: adding node-insert.cjs
// there would remove it from --baseline too (isAllowedPath is shared by both
// scan modes), silently shrinking the documented 208 by 2 as a side effect
// of Task 1 and desynchronizing this plan's own Task 3 expected numbers
// (208 -> 205, raw-graph-write 55 -> 52 via three DIFFERENT files). Without
// SOME exemption, every future edit to node-insert.cjs's INSERT statement
// text (a near-certainty -- it is the chokepoint under active development)
// trips the --diff hook on an already-baselined, sanctioned line, which is
// exactly the false-positive the diff scan's own "net-new after baseline"
// contract (see scanStagedDiff's header comment) says should NOT block.
const DIFF_ONLY_RULE_EXEMPTIONS = {
  'lib/core/node-insert.cjs': new Set(['raw-graph-write']),
};

function isDiffExemptHit(filePath, rule) {
  const exempt = DIFF_ONLY_RULE_EXEMPTIONS[filePath];
  return !!exempt && exempt.has(rule);
}

// ---------------------------------------------------------------------------
// Carried-forward require() bans from check-schema-aliases.cjs BANNED_PATTERNS
// (the strict-superset guarantee: every pattern the old --check-chokepoint
// caught is still caught here, under rule "chokepoint-require").
// ---------------------------------------------------------------------------
const BANNED_REQUIRE_PATTERNS = [
  /require\(['"]\.\.?\/[^'"]*?(room-db|lazygraph-ops|memory-ops)\.cjs['"]\)/,
  /require\(['"]lib\/core\/(room-db|lazygraph-ops|memory-ops)\.cjs['"]\)/,
];

// ---------------------------------------------------------------------------
// New M1-M4 + bypass rules. Each rule is { rule, test(line) -> match|null }.
// Pure per-line matchers so the scan is hermetic and order-stable.
// ---------------------------------------------------------------------------

// M3: direct sqlite driver require.
const RE_SQLITE_REQUIRE = /require\(\s*['"](?:node:sqlite|better-sqlite3)['"]\s*\)/;

// M2: raw fs read of a room.db path (readFile / readFileSync / createReadStream).
const RE_FS_ROOMDB = /\b(?:readFileSync|readFile|createReadStream)\s*\([^)]*room\.db/i;

// Un-provenanced write class: raw INSERT/UPDATE/DELETE against nodes|edges|memory_event.
// Matches "INSERT INTO nodes", "UPDATE edges", "DELETE FROM memory_event", etc.
const RE_RAW_WRITE = /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(nodes|edges|memory_event)\b/i;

// The #1 bypass: a call to openGraph (the lazygraph-ops opener).
const RE_OPENGRAPH = /\bopenGraph\s*\(/;

// M4: Cypher MATCH with user-content interpolation. Two breach shapes:
//   (a) template-literal interpolation: a MATCH and a ${...} on the same line.
//   (b) string concatenation into a MATCH clause: 'MATCH ...' + var.
// Parameterized Cypher ($param + params object) does NOT match either shape.
//
// Precision (Phase 128 dog-food fix 2026-05-31): the rule is CYPHER-specific,
// not a bare "match"+"${...}" co-occurrence. Both regexes require uppercase
// MATCH (Cypher keyword convention) immediately followed by a Cypher node
// pattern -- an optional `var =` binding then a `(`. This eliminates the
// false-positives on plain prose / version strings (e.g. `match: got ${x}`,
// `Match ? null : (...)`) that have no Cypher `(` node pattern, while still
// catching real Cypher interpolation like `MATCH (a) WHERE a.n = "${userBody}"`.
const RE_CYPHER_NODE = '\\bMATCH\\s+(?:[A-Za-z_]\\w*\\s*=\\s*)?\\(';
const RE_CYPHER_INTERP_TEMPLATE = new RegExp(RE_CYPHER_NODE + '[^`]*\\$\\{[^}]+\\}');
const RE_CYPHER_INTERP_CONCAT = new RegExp(
  "['\"`][^'\"`]*" + RE_CYPHER_NODE + "[^'\"`]*['\"`]\\s*\\+" +
  '|' + RE_CYPHER_NODE + "[^`]*['\"]\\s*\\+\\s*[A-Za-z_]"
);

// Comment-stripper: ignore lines that are pure // comments so a documentation
// line mentioning "INSERT INTO nodes" in a banned context is not a false flag.
// We only strip a leading-whitespace // comment; inline code with a trailing
// comment is still scanned (the code part is the risk).
function isPureLineComment(line) {
  return /^\s*\/\//.test(line) || /^\s*\*/.test(line);
}

function scanLine(line) {
  if (isPureLineComment(line)) return [];
  const hits = [];

  // Carried-forward require bans (chokepoint superset).
  for (const rx of BANNED_REQUIRE_PATTERNS) {
    const m = line.match(rx);
    if (m) hits.push({ rule: 'chokepoint-require', match: m[0] });
  }

  let m;
  m = line.match(RE_SQLITE_REQUIRE);
  if (m) hits.push({ rule: 'm3-direct-sqlite-require', match: m[0] });

  m = line.match(RE_FS_ROOMDB);
  if (m) hits.push({ rule: 'm2-raw-room-db-read', match: m[0].trim() });

  m = line.match(RE_RAW_WRITE);
  if (m) hits.push({ rule: 'raw-graph-write', match: m[0].trim() });

  m = line.match(RE_OPENGRAPH);
  if (m) hits.push({ rule: 'opengraph-bypass', match: m[0] });

  m = line.match(RE_CYPHER_INTERP_TEMPLATE);
  if (m) {
    hits.push({ rule: 'm4-cypher-interpolation', match: m[0].trim().slice(0, 120) });
  } else {
    m = line.match(RE_CYPHER_INTERP_CONCAT);
    if (m) hits.push({ rule: 'm4-cypher-interpolation', match: m[0].trim().slice(0, 120) });
  }

  return hits;
}

// ---------------------------------------------------------------------------
// Pure programmatic scan API.
//   scanFiles(files, readContent) -> Array<{file, line, rule, match}>
//   files       : array of repo-relative paths
//   readContent : (relPath) -> string (the file body), or '' if unreadable
// Allow-listed paths are skipped entirely. Non-source extensions are skipped.
// ---------------------------------------------------------------------------
function scanFiles(files, readContent) {
  const violations = [];
  for (const filePath of files) {
    if (!/\.(cjs|js|mjs)$/.test(filePath)) continue;
    if (isAllowedPath(filePath)) continue;
    const content = readContent(filePath);
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const hits = scanLine(lines[i]);
      for (const h of hits) {
        violations.push({ file: filePath, line: i + 1, rule: h.rule, match: h.match });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Staged-file seam helpers (reused idiom from check-schema-aliases.cjs so the
// Task-1 tests drive the guard hermetically).
// ---------------------------------------------------------------------------
function getStagedFiles() {
  const env = process.env.MINDRIAN_HOOK_STAGED_FILES;
  if (typeof env === 'string') {
    return env.split('\n').map((s) => s.trim()).filter(Boolean);
  }
  try {
    const r = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (r.status !== 0) return [];
    return (r.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function readStagedContent(filePath) {
  const contentDir = process.env.MINDRIAN_HOOK_STAGED_CONTENT_DIR;
  const candidates = [];
  if (contentDir) candidates.push(path.join(contentDir, filePath));
  candidates.push(path.join(REPO_ROOT, filePath));
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
    } catch (_) { /* fall through */ }
  }
  try {
    const r = spawnSync('git', ['show', ':' + filePath], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (r.status === 0) return r.stdout || '';
  } catch (_) { /* ignore */ }
  return '';
}

// scanStaged: the API the Task-1 tests call. Honors the staged-file + content
// seams; pure (returns the violation array, never exits). Whole-file scan.
function scanStaged() {
  return scanFiles(getStagedFiles(), readStagedContent);
}

// ---------------------------------------------------------------------------
// Net-new-aware staged scan (Phase 128 dog-food fix 2026-05-30).
//
// runDiff must flag ONLY violations on lines the staged diff ADDS, never
// pre-existing lines in a touched file. This is the "net-new after baseline"
// contract the plan intended: editing a file that already carries baselined
// debt (the 195 in SUBSTRATE-BASELINE.md) is fine; introducing a NEW bypass
// line is blocked. Whole-file scanStaged remains for the tests + the API.
//
// Honors the MINDRIAN_HOOK_STAGED_DIFF seam for hermetic tests; else runs git.
// ---------------------------------------------------------------------------
function getStagedDiff() {
  const env = process.env.MINDRIAN_HOOK_STAGED_DIFF;
  if (typeof env === 'string') return env;
  try {
    const r = spawnSync('git', ['diff', '--cached', '--unified=0', '--diff-filter=ACM'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (r.status !== 0) return '';
    return r.stdout || '';
  } catch (_) {
    return '';
  }
}

function scanStagedDiff() {
  const diff = getStagedDiff();
  if (!diff) return [];
  const violations = [];
  let curFile = null;
  let skipFile = true;
  let newLineNo = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const m = raw.match(/^\+\+\+ b\/(.+)$/);
      curFile = m ? m[1] : null;
      skipFile = !curFile || !/\.(cjs|js|mjs)$/.test(curFile) || isAllowedPath(curFile);
      continue;
    }
    if (raw.startsWith('@@')) {
      // @@ -a[,b] +c[,d] @@  -> next added line is new-file line c
      const m = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      newLineNo = m ? parseInt(m[1], 10) : 0;
      continue;
    }
    if (skipFile || !curFile) continue;
    if (raw.startsWith('+')) {
      const hits = scanLine(raw.slice(1));
      for (const h of hits) {
        if (isDiffExemptHit(curFile, h.rule)) continue;
        violations.push({ file: curFile, line: newLineNo, rule: h.rule, match: h.match });
      }
      newLineNo++;
    } else if (raw.startsWith('-')) {
      // removed line: does not advance the new-file line counter
    } else {
      // context line (rare under --unified=0): advances the new-file counter
      newLineNo++;
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Full-repo walker (for --baseline). LOCAL-only: reads source files from disk,
// never room.db, never network.
// ---------------------------------------------------------------------------
function walkSourceFiles(dirAbs, relPrefix, out) {
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const childAbs = path.join(dirAbs, e.name);
    const childRel = relPrefix ? relPrefix + '/' + e.name : e.name;
    if (e.isDirectory()) {
      walkSourceFiles(childAbs, childRel, out);
    } else if (/\.(cjs|js|mjs)$/.test(e.name)) {
      out.push(childRel);
    }
  }
}

function scanRepo() {
  const files = [];
  walkSourceFiles(path.join(REPO_ROOT, 'lib'), 'lib', files);
  walkSourceFiles(path.join(REPO_ROOT, 'scripts'), 'scripts', files);
  const readFromDisk = (rel) => {
    try {
      return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    } catch (_) {
      return '';
    }
  };
  return scanFiles(files, readFromDisk);
}

// ---------------------------------------------------------------------------
// Output helpers.
// ---------------------------------------------------------------------------
function groupByRule(violations) {
  const groups = {};
  for (const v of violations) {
    (groups[v.rule] = groups[v.rule] || []).push(v);
  }
  return groups;
}

function printGrouped(violations, stream) {
  const groups = groupByRule(violations);
  const ruleNames = Object.keys(groups).sort();
  for (const rule of ruleNames) {
    stream.write('[' + rule + '] ' + groups[rule].length + ' violation(s):\n');
    for (const v of groups[rule]) {
      stream.write('  ' + v.file + ':' + v.line + ': ' + v.match + '\n');
    }
    stream.write('\n');
  }
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------
function runBaseline() {
  const violations = scanRepo();
  process.stdout.write('[check-substrate] --baseline: full-repo scan (INFORMATIONAL, non-blocking)\n');
  process.stdout.write('Found ' + violations.length + ' violation(s) across lib/ + scripts/.\n\n');
  printGrouped(violations, process.stdout);
  process.stdout.write('Plan 03 wires --diff into the pre-commit hook and decides blocking-on-net-new.\n');
  process.exit(0);
}

function runDiff() {
  // Net-new-aware: only flags violations on lines the staged diff ADDS, so a
  // commit that touches a file carrying baselined debt is not blocked unless it
  // introduces a NEW bypass (Phase 128 dog-food fix 2026-05-30).
  const violations = scanStagedDiff();
  if (violations.length === 0) {
    process.exit(0);
  }
  process.stderr.write('[check-substrate] FAIL (--diff): staged changes ADD a navigation.cjs chokepoint bypass:\n');
  printGrouped(violations, process.stderr);
  process.stderr.write('Route the access through lib/core/navigation.cjs, or add the path to ALLOWED_DIRECT_IMPORT in scripts/check-substrate.cjs.\n');
  process.exit(1);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--diff')) {
    runDiff();
  } else if (args.includes('--check-chokepoint')) {
    // Superset alias: run the full scan in --diff (blocking) mode so external
    // callers of the retired subcommand keep working per the ADR retirement plan.
    runDiff();
  } else {
    // default / --baseline
    runBaseline();
  }
}

module.exports = {
  scanFiles,
  scanStaged,
  scanStagedDiff,
  scanRepo,
  isAllowedPath,
  ALLOWED_DIRECT_IMPORT,
  BANNED_REQUIRE_PATTERNS,
};
