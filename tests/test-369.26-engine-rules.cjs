// 369.26 engine rules (plan 01A): the host rules a hooks module must satisfy, proved against the
// real `claude plugin validate` on a throwaway copy of the mod (never the repo tree).
//
// Why: plans 03 and 04 measured that the engine's static scan refuses `$` crossing an import, an
// imported atom in read/update, a state contract with an import, and a manifest with no types
// entry. Each fact is written in 369.26-ENGINE-RULES.md; this test keeps them true: one arm proves
// a hook that READS STATE validates, the others plant each mistake and prove the engine still
// refuses it (so a future engine that stops refusing is noticed, and so is a repo change that
// reintroduces one). Exit 77 (ENV GAP, never a pass) when the claude binary is not on PATH.
// Hyphens only. CJS, Node built-ins only. Hermetic: writes only to a temp dir it removes.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mindrian-workspace-mod');

let passed = 0;
let failed = 0;
let skipped = 0;
function scenario(name, fn) {
  try {
    const r = fn();
    if (r === 'skip') { skipped += 1; process.stdout.write('  skip ' + name + ' (claude not on PATH)\n'); return; }
    passed += 1; process.stdout.write('  ok ' + name + '\n');
  } catch (e) {
    failed += 1; process.stdout.write('  FAIL ' + name + '\n    ' + (e.stack || e.message || String(e)) + '\n');
  }
}

// ---------- static arms: the repo files obey the contract ----------

scenario('plugin.json names the types contract and the file exists', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(MOD, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.strictEqual(manifest.types, './types/state.d.ts');
  assert.ok(fs.existsSync(path.join(MOD, 'types', 'state.d.ts')));
});

scenario('types/state.d.ts has no import and its tab union equals TAB_IDS in ids.ts', () => {
  const dts = fs.readFileSync(path.join(MOD, 'types', 'state.d.ts'), 'utf8');
  const code = dts.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/\bimport\b/.test(code), 'the state contract must be self-contained (no import)');
  const ids = fs.readFileSync(path.join(MOD, 'src', 'runtime', 'ids.ts'), 'utf8');
  const tabs = /TAB_IDS\s*=\s*\[([^\]]*)\]/.exec(ids)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  const union = /tab:\s*([^\n]+)/.exec(code)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepStrictEqual(union, tabs);
});

// ---------- engine arms: a scratch copy under the real claude plugin validate ----------

const HAVE_CLAUDE = spawnSync('claude', ['--version'], { encoding: 'utf8' }).status === 0;

function scratch(mutate) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-36926-engine-'));
  const dest = path.join(tmp, 'mod');
  fs.cpSync(MOD, dest, {
    recursive: true,
    // the engine-laid declaration folder and node_modules stay behind; the contract types/ goes along
    filter: (src) => path.basename(src) !== 'node_modules' && src !== path.join(MOD, '.claude-plugin', 'types'),
  });
  try {
    mutate(dest);
    const r = spawnSync('claude', ['plugin', 'validate', dest], { encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const bandWith = (body, header) => (dest) => {
  fs.writeFileSync(
    path.join(dest, 'src', 'registrars', 'band.tsx'),
    header + "\nimport type { Register } from 'claude-code'\n\nexport const registerBand: Register = (on) => {\n" +
      "  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {\n" + body + "\n    return next(e)\n  })\n}\n",
  );
};

// The recipe in 369.26-ENGINE-RULES.md: an atom declared in the hook file, a literal ref inline,
// and plain data (INITIAL) imported.
const RECIPE_HEADER = "import { atom, read } from 'claude-code'\nimport { INITIAL } from '../state/atoms'\n" +
  "const tabAtom = atom({ plugin: 'mindrian-workspace', key: 'tab' } as const, INITIAL.tab)\n";
const RECIPE_BODY = "    const tab = await read($, tabAtom)\n" +
  "    const plain = await read($, { plugin: 'mindrian-workspace', key: 'plain' } as const)\n    void tab; void plain";

scenario('a render hook that reads state (same-file atom + literal ref + imported initial) validates', () => {
  if (!HAVE_CLAUDE) return 'skip';
  const r = scratch(bandWith(RECIPE_BODY, RECIPE_HEADER));
  assert.strictEqual(r.status, 0, r.out);
  // The other registrars of the mod read state too (plans 05 to 07), so the line lists more than
  // these two keys: assert that both are listed, not that they are the only ones (369.26-05).
  const reads = (r.out.match(/state reads: ([^\n']*)/) || [])[1] || '';
  assert.ok(reads.includes('mindrian-workspace.plain') && reads.includes('mindrian-workspace.tab'), r.out);
});

scenario('mutation: read($, importedAtom) is refused (rule 2)', () => {
  if (!HAVE_CLAUDE) return 'skip';
  const r = scratch(bandWith("    const tab = await read($, TAB_REF)\n    void tab",
    "import { read } from 'claude-code'\nimport { TAB_REF } from '../state/atoms'\n"));
  assert.notStrictEqual(r.status, 0, 'an imported reference must not validate');
  assert.match(r.out, /string literals/);
});

scenario('mutation: $ passed into an imported function is refused (rule 1)', () => {
  if (!HAVE_CLAUDE) return 'skip';
  const r = scratch((dest) => {
    fs.writeFileSync(path.join(dest, 'src', 'registrars', 'helper.ts'),
      "import type { EngineInterface } from 'claude-code'\nexport async function helper($: EngineInterface) { return $.env.get('TERM') }\n");
    bandWith("    await helper($)", "import { helper } from './helper'\n")(dest);
  });
  assert.notStrictEqual(r.status, 0, 'a $ crossing an import must not validate');
  assert.match(r.out, /never across an import/);
});

scenario('mutation: a state contract with an import is refused (rule 3)', () => {
  if (!HAVE_CLAUDE) return 'skip';
  const r = scratch((dest) => {
    bandWith(RECIPE_BODY, RECIPE_HEADER)(dest);
    const f = path.join(dest, 'types', 'state.d.ts');
    fs.writeFileSync(f, "import type { TabId } from '../src/runtime/ids'\n" + fs.readFileSync(f, 'utf8'));
  });
  assert.notStrictEqual(r.status, 0, 'a d.ts with an import must not validate');
  assert.match(r.out, /import. reaches outside the file/);
});

scenario('mutation: a state read with no types entry in plugin.json is refused (rule 3)', () => {
  if (!HAVE_CLAUDE) return 'skip';
  const r = scratch((dest) => {
    bandWith(RECIPE_BODY, RECIPE_HEADER)(dest);
    const f = path.join(dest, '.claude-plugin', 'plugin.json');
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    delete m.types;
    fs.writeFileSync(f, JSON.stringify(m));
  });
  assert.notStrictEqual(r.status, 0, 'a state read with no types contract must not validate');
  assert.match(r.out, /types contract must name it/);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped\n');
if (failed) process.exit(1);
process.exit(skipped && !passed ? 77 : 0);
