#!/usr/bin/env node
/**
 * check-kuzu-reintroduction.cjs
 *
 * RELEASE GATE: fails the release if the retired KuzuDB graph engine re-enters
 * this repo's dependency surface. Two checks, both deterministic and lexical:
 *
 *   1. Dependency manifests. Every line of package.json (and package-lock.json
 *      when present) is matched against a dependency-key pattern for the real
 *      npm package family: a bare `kuzu`, a `kuzu-` prefixed sibling such as
 *      `kuzu-wasm`, or a scoped `@kuzudb/*` name. A lockfile v3 package path
 *      key (`"node_modules/kuzu"`) is matched too, so a TRANSITIVE
 *      reintroduction that never touches package.json is still caught.
 *
 *   2. Live require/import statements. Every .cjs / .js / .mjs file under the
 *      root is scanned line by line for a module reference whose specifier is
 *      a kuzu package.
 *
 * WHY THIS EXISTS. docs/MOAT-MANDATE.md's PR checklist used to carry the line
 * "Does this work without KuzuDB edges?" - a reviewer instruction to judge, by
 * eye, against a database this repo no longer has. That same file's own
 * correction banner (2026-06-14, KuzuDB-drift sweep) records that the local
 * per-room graph moved to node:sqlite. Asking a human to check an unfalsifiable
 * question about a retired engine is doctrine rot, not a control. This gate
 * replaces that prose with an assertion a machine can fail.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It is not a comment scrub. Deleting
 * history is not the ask, so all of the following are legitimate and MUST keep
 * passing:
 *   - historical header comments such as "Migrated from hsi-to-kuzu.cjs" in
 *     scripts/hsi-to-graph.cjs, scripts/causal-to-graph.cjs,
 *     scripts/migrate-lazygraph.cjs and scripts/whitespace-to-graph.cjs
 *   - the back-compat exported alias `buildGraphFromKuzu` in
 *     lib/core/graph-ops.cjs, whose body is SQLite
 *   - the back-compat subcommand label `case 'build-kuzu':` in
 *     bin/mindrian-tools.cjs
 *   - every .md file in docs/, references/ and pipelines/, which is excluded
 *     automatically because only three code extensions are ever read
 * That is precisely why the scan is scoped to require/import statements and
 * manifest dependency keys rather than a blanket search for the string kuzu.
 *
 * Exit codes:
 *   0 -- clean: no live kuzu dependency and no live kuzu require/import
 *   1 -- forbidden pattern found (release MUST be blocked)
 *   2 -- scanner failure (root missing, package.json missing or unparseable,
 *        or zero scannable source files found)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// A dependency key in a manifest: optional leading whitespace, a double quote,
// then a bare `kuzu`, a `kuzu-` prefixed sibling, or an `@kuzudb/` scoped name,
// then the closing quote and a colon.
const KUZU_DEP_RE = /^\s*"(?:kuzu(?:-[A-Za-z0-9._-]+)?|@kuzudb\/[A-Za-z0-9._-]+)"\s*:/;

// An npm lockfile v3 package path key: the same name alternation, preceded by
// an optional `node_modules/` prefix INSIDE the quotes. This is what catches a
// transitive reintroduction that only ever shows up in the lock.
const KUZU_LOCK_PATH_RE = /^\s*"(?:node_modules\/)?(?:kuzu(?:-[A-Za-z0-9._-]+)?|@kuzudb\/[A-Za-z0-9._-]+)"\s*:/;

// A LIVE module reference only. The specifier must be quoted and must sit
// immediately after require( / from / import( . This is what keeps the bare
// word kuzu inside a comment, inside a `case 'build-kuzu':` label, and inside
// an identifier such as buildGraphFromKuzu from tripping the gate.
const KUZU_REQUIRE_RE = /(?:require\(\s*|from\s+|import\(\s*)['"](?:kuzu(?:-[A-Za-z0-9._-]+)?|@kuzudb\/[A-Za-z0-9._-]+)['"]/;

// Files explicitly allowed to contain the literal forbidden patterns.
// The allowlist is SIZE-FENCED by tests/test-242-kuzu-reintroduction-gate.cjs
// (leg 9 asserts both the count and the exact members). Growing an allowlist is
// how a gate like this gets silently neutered, so adding a third entry must be
// a deliberate, reviewed act that turns a test red first.
const ALLOWLIST = new Set([
  'scripts/check-kuzu-reintroduction.cjs', // self: this file's own regexes contain the literal patterns
  'tests/test-242-kuzu-reintroduction-gate.cjs', // authors seeded forbidden-pattern fixtures into scratch dirs
]);

// Only three code extensions are ever read, so every .md file is excluded
// automatically and the roughly 38 historical prose mentions cannot trip this.
const SCAN_EXTENSIONS = new Set(['.cjs', '.js', '.mjs']);

// Directories never walked, each for a stated reason:
//   node_modules -- untracked install output, enormous, and not this repo's source
//   .git         -- object storage, not source
//   .planning    -- gitignored planning prose that quotes forbidden patterns as examples
//   worktrees    -- stops .claude/worktrees/agent-* sibling checkouts from being
//                   scanned as if they were this tree
const SKIP_DIRS = new Set(['node_modules', '.git', '.planning', 'worktrees']);

// `--root <dir>` exists so the test suite can drive real seeded fixtures inside
// hermetic scratch directories instead of mutating the live tree.
function resolveRoot() {
  const argv = process.argv.slice(2);
  let root = path.resolve(__dirname, '..');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') {
      const value = argv[i + 1];
      if (!value) {
        console.error('check-kuzu-reintroduction: --root was given with no directory argument');
        process.exit(2);
      }
      root = path.resolve(value);
      i++;
    }
  }
  let stat;
  try {
    stat = fs.statSync(root);
  } catch (e) {
    console.error('check-kuzu-reintroduction: root does not exist: ' + root);
    process.exit(2);
  }
  if (!stat.isDirectory()) {
    console.error('check-kuzu-reintroduction: root is not a directory: ' + root);
    process.exit(2);
  }
  return root;
}

function walkSourceFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name))) continue;
      out.push(abs);
    }
  }
  return out;
}

function scanManifest(root, relName, lineRegexes) {
  const abs = path.join(root, relName);
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
    JSON.parse(raw);
  } catch (e) {
    return { missingOrBad: true, error: (e && e.message) || String(e), findings: [] };
  }
  const findings = [];
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const re of lineRegexes) {
      if (re.test(lines[i])) {
        findings.push({ file: relName, line: i + 1, snippet: lines[i].trim().slice(0, 160) });
        break; // one violation per line, never a duplicate per regex
      }
    }
  }
  return { missingOrBad: false, error: null, findings };
}

function scanSourceFile(root, abs) {
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (ALLOWLIST.has(rel)) return [];
  let content;
  try {
    content = fs.readFileSync(abs, 'utf8');
  } catch (_e) {
    return [];
  }
  const findings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (KUZU_REQUIRE_RE.test(lines[i])) {
      findings.push({ file: rel, line: i + 1, snippet: lines[i].trim().slice(0, 160) });
    }
  }
  return findings;
}

function main() {
  const root = resolveRoot();
  const allFindings = [];
  let manifestsScanned = 0;

  // Check 1a: package.json is REQUIRED. Missing or unparseable is a scanner
  // failure, not a pass: a gate that could not read the manifest knows nothing.
  const pkg = scanManifest(root, 'package.json', [KUZU_DEP_RE, KUZU_LOCK_PATH_RE]);
  if (pkg.missingOrBad) {
    console.error('check-kuzu-reintroduction: could not read/parse package.json under ' + root + ': ' + pkg.error);
    process.exit(2);
  }
  manifestsScanned++;
  allFindings.push(...pkg.findings);

  // Check 1b: package-lock.json is OPTIONAL. A missing lock is noted, not failed.
  if (fs.existsSync(path.join(root, 'package-lock.json'))) {
    const lock = scanManifest(root, 'package-lock.json', [KUZU_DEP_RE, KUZU_LOCK_PATH_RE]);
    if (lock.missingOrBad) {
      console.error('check-kuzu-reintroduction: could not read/parse package-lock.json under ' + root + ': ' + lock.error);
      process.exit(2);
    }
    manifestsScanned++;
    allFindings.push(...lock.findings);
  } else {
    console.log('check-kuzu-reintroduction: note - no package-lock.json under ' + root + ', skipping the lock check');
  }

  // Check 2: live require/import statements across the source tree.
  const sourceFiles = walkSourceFiles(root);
  if (sourceFiles.length === 0) {
    console.error('check-kuzu-reintroduction: found zero scannable source files under ' + root);
    console.error('A scanner that scanned nothing must never report PASS.');
    process.exit(2);
  }
  for (const abs of sourceFiles) {
    allFindings.push(...scanSourceFile(root, abs));
  }

  if (allFindings.length === 0) {
    console.log('check-kuzu-reintroduction: PASS');
    console.log('Scanned ' + manifestsScanned + ' dependency manifest(s) and ' + sourceFiles.length +
      ' source file(s). No live kuzu dependency and no live kuzu require/import found.');
    process.exit(0);
  }

  console.error('check-kuzu-reintroduction: FAIL');
  console.error('');
  console.error('Found ' + allFindings.length + ' live kuzu reference(s):');
  for (const f of allFindings) {
    console.error('  ' + f.file + ':' + f.line);
    console.error('    ' + f.snippet);
  }
  console.error('');
  console.error('Release BLOCKED. The local per-room graph has been node:sqlite since 2026-06-14');
  console.error('(see the correction banner at the top of docs/MOAT-MANDATE.md); KuzuDB is retired and');
  console.error('must not re-enter the dependency surface. Historical comments, the buildGraphFromKuzu');
  console.error('back-compat alias, and the build-kuzu subcommand label are exempt by design, so a hit');
  console.error('here means a real dependency key or a real require/import, not prose.');
  process.exit(1);
}

main();
