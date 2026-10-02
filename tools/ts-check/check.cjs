// The erasable-TypeScript gate (Phase 369 D-17, TS369-03).
//
// What this does, plainly: Node can run a .ts file by stripping the type words out of
// it, but Node never reads tsconfig and never type-checks, so nothing at runtime stops
// an enum, a namespace or a constructor parameter property (the three things that need
// real code generation, not just erasing) from landing in lib/core and then throwing on
// a user's machine. This script asks tsc, with erasableSyntaxOnly and verbatimModuleSyntax
// on, to refuse those constructs, and proves the refusal works by running tsc against
// known-bad fixture files and known-good ones.
//
// Four stages, each prints PASS or FAIL, exit 1 if any FAIL:
//   core       every .ts/.mts/.cts under lib/ (zero today, so it passes vacuously)
//   forbidden  each file in fixtures/forbidden must be REJECTED with its expected TS code
//   allowed    fixtures/allowed must compile clean AND run under Node type stripping
//   greps      no "paths" alias in any tsconfig under lib/ or ui/, no .tsx under lib/
//
// TypeScript lives only in this walled package (own lockfile), never in the root
// package.json. @types/node is deliberately absent: tsconfig sets types: [] and the
// allowed fixture carries its own tiny ambient declaration. Exit 77 = package not
// installed (environment gap, not a code failure). CJS, Node built-ins only.

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PKG_DIR = __dirname;
const REPO = path.resolve(PKG_DIR, '..', '..');
const TSCONFIG_CORE = path.join(PKG_DIR, 'tsconfig.core.json');
const FIXTURES = path.join(PKG_DIR, 'fixtures');
const AMBIENT = path.join(FIXTURES, 'allowed', 'ambient.d.ts');

// What each forbidden fixture must be rejected with.
const FORBIDDEN_EXPECT = {
  'enum.ts': ['TS1294'],
  'namespace.ts': ['TS1294'],
  'param-property.ts': ['TS1294'],
  'esm-in-cjs.ts': ['TS1287', 'TS1295'],
};

const NOT_INSTALLED_MSG =
  'tools/ts-check is not installed: run npm --prefix tools/ts-check ci --ignore-scripts';

// ---------- helpers ----------

function resolveTsc() {
  const pkgJson = path.join(PKG_DIR, 'node_modules', 'typescript', 'package.json');
  if (!fs.existsSync(pkgJson)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin && pkg.bin.tsc;
  if (!bin) return null;
  const abs = path.join(path.dirname(pkgJson), bin);
  return fs.existsSync(abs) ? abs : null;
}

// Walk a directory, skipping node_modules (and any extra relative-to-REPO prefixes).
function walk(dir, skipPrefixes) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(REPO, abs).split(path.sep).join('/');
    if ((skipPrefixes || []).some((p) => rel === p || rel.startsWith(p + '/'))) continue;
    if (entry.isDirectory()) out.push(...walk(abs, skipPrefixes));
    else if (entry.isFile()) out.push(abs);
  }
  return out;
}

// Write a throwaway tsconfig that extends ours with an explicit file list, run tsc on it.
function runTsc(tscBin, files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ts-check-'));
  try {
    const cfg = path.join(tmp, 'tsconfig.json');
    fs.writeFileSync(cfg, JSON.stringify({ extends: TSCONFIG_CORE, files }));
    const r = spawnSync(process.execPath, [tscBin, '-p', cfg], { encoding: 'utf8' });
    const output = (r.stdout || '') + (r.stderr || '');
    return { status: r.status, output };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// A forbidden file is "caught" only if tsc exits nonzero AND names an expected TS code.
function runForbidden(tscBin, file, expectCodes) {
  const r = runTsc(tscBin, [file, AMBIENT]);
  const matched = expectCodes.find((c) => r.output.includes(c)) || null;
  return { caught: r.status !== 0 && matched !== null, code: matched, output: r.output };
}

// ---------- stages ----------

function stageCore(tscBin) {
  const files = walk(path.join(REPO, 'lib'), ['lib/wiki/editor-src']).filter((f) =>
    /\.(ts|mts|cts)$/.test(f)
  );
  if (files.length === 0) {
    return { ok: true, lines: ['0 core TypeScript files: core stage passes vacuously'] };
  }
  const r = runTsc(tscBin, files);
  return { ok: r.status === 0, lines: [files.length + ' core TypeScript files checked', r.output.trim()] };
}

function stageForbidden(tscBin) {
  const lines = [];
  let ok = true;
  for (const [name, codes] of Object.entries(FORBIDDEN_EXPECT)) {
    const file = path.join(FIXTURES, 'forbidden', name);
    const r = runForbidden(tscBin, file, codes);
    if (r.caught) {
      lines.push('caught ' + name + ' (' + r.code + ')');
    } else {
      ok = false;
      const construct = name.replace(/\.ts$/, '');
      lines.push('FAIL: the gate no longer catches ' + construct + ' (' + name + ')');
    }
  }
  return { ok, lines };
}

function stageAllowed(tscBin) {
  const dir = path.join(FIXTURES, 'allowed');
  const files = ['shape-a.ts', 'types.ts', 'ambient.d.ts'].map((f) => path.join(dir, f));
  const r = runTsc(tscBin, files);
  if (r.status !== 0) return { ok: false, lines: ['allowed fixtures failed tsc:', r.output.trim()] };
  const run = spawnSync(process.execPath, [path.join(dir, 'run-shape-a.cjs')], { encoding: 'utf8' });
  const out = (run.stdout || '').trim();
  if (run.status !== 0 || !out.includes('shape-a sum=5')) {
    return { ok: false, lines: ['Node did not run shape-a.ts by stripping types:', out, (run.stderr || '').trim()] };
  }
  return { ok: true, lines: ['shape-a compiles clean and Node runs it by stripping types (' + out + ')'] };
}

function findPathAliases() {
  const hits = [];
  for (const root of ['lib', 'ui']) {
    for (const f of walk(path.join(REPO, root), [])) {
      if (!/^tsconfig.*\.json$/.test(path.basename(f))) continue;
      if (/"paths"\s*:/.test(fs.readFileSync(f, 'utf8'))) hits.push(path.relative(REPO, f));
    }
  }
  return hits;
}

function findLibTsx() {
  return walk(path.join(REPO, 'lib'), ['lib/wiki/editor-src'])
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => path.relative(REPO, f));
}

function stageGreps() {
  const lines = [];
  let ok = true;
  const aliases = findPathAliases();
  if (aliases.length) {
    ok = false;
    lines.push('FAIL: TS path alias ("paths") found in: ' + aliases.join(', '));
  } else {
    lines.push('no "paths" alias in any tsconfig under lib/ or ui/');
  }
  const tsx = findLibTsx();
  if (tsx.length) {
    ok = false;
    lines.push('FAIL: .tsx under lib/: ' + tsx.join(', '));
  } else {
    lines.push('no .tsx under lib/');
  }
  return { ok, lines };
}

// ---------- main ----------

function main() {
  const tscBin = resolveTsc();
  if (!tscBin) {
    process.stdout.write(NOT_INSTALLED_MSG + '\n');
    return 77;
  }
  const stages = [
    ['core', () => stageCore(tscBin)],
    ['forbidden', () => stageForbidden(tscBin)],
    ['allowed', () => stageAllowed(tscBin)],
    ['greps', () => stageGreps()],
  ];
  let failed = false;
  for (const [name, fn] of stages) {
    const r = fn();
    process.stdout.write((r.ok ? 'PASS' : 'FAIL') + ' stage ' + name + '\n');
    for (const line of r.lines) if (line) process.stdout.write('  ' + line + '\n');
    if (!r.ok) failed = true;
  }
  process.stdout.write(failed ? 'erasable gate: FAIL\n' : 'erasable gate: PASS\n');
  return failed ? 1 : 0;
}

module.exports = {
  _internal: { resolveTsc, runTsc, runForbidden, findPathAliases, findLibTsx, FORBIDDEN_EXPECT, AMBIENT },
};

if (require.main === module) process.exit(main());
