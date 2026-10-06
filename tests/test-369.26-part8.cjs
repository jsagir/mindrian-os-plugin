// 369.26 plan 16 guard: Canon Part 8 for the Mindrian Workspace mod (R-24, WS-14, T-369.26-16-01).
//
// The claim this file proves: NO ROOM TEXT CAN REACH A brain_* (Brain) CALL FROM THE MOD. The one
// outbound path is the Think tab's "Look up general guidance" button. It runs one closure,
// `act.guidance(handle)` in src/registrars/pane.tsx, which refuses anything that is not an exact
// member of the framework-name canon and otherwise sends exactly { framework: handle } and nothing
// else. This file proves that four ways, and each way has a MUTATION ARM that plants a room string
// and must make the proof FAIL (an arm that cannot fail proves nothing):
//
//   static   one checker (`checkTree`) over src/: (1) only registrars/pane.tsx and runtime/ids.ts
//            name the Brain server or the tool; (2) the call site is the single literal
//            `$.mcp.call(BRAIN_SERVER, 'framework_techniques', { framework: handle })`, with no
//            spread, no template, no other variable, and it sits AFTER the canon check in the
//            closure; (3) the handle is derived only from `vm.next.method`, and the only callers
//            of the lookup pass `plan.handle`. Mutations plant a room string at each spot.
//   canary   the egress guard module itself (lib/core/part8-egress-guard.cjs) classifies the exact
//            payload the mod sends as a known tool shape, and classifies room content (an email, a
//            currency amount, a person name with a degree) as NOT known; the mod's own
//            `isCanonicalHandle` agrees with the guard on every canon name and every canary.
//   engine   a scratch copy of the mod, a probe Think body that calls the REAL `act.guidance`
//            closure under the real engine with room strings and canonical names; only canonical
//            names produce an MCP call, and the call args are deep-equal { framework }. The
//            mutation removes the canon check from the scratch closure and the probe FAILS.
//
// Exit 77 (ENV GAP, never a pass) only when the engine arms cannot run and nothing else passed.
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

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// Source text with comments removed. A line comment starts at `//` outside a string; a quote string
// ends at the end of its line (so a regex literal that holds a quote cannot swallow the file); a
// template string runs to its closing backtick. Good enough for this guard: every arm below also
// runs on a mutated copy, so a stripper that hid code would show up as a mutation that passes.
function stripComments(src) {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '\'' || c === '"') {
      out += c; i += 1;
      while (i < src.length && src[i] !== '\n') {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === c) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '`') {
      out += c; i += 1;
      while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i]; i += 1;
      }
      out += '`'; i += 1;
      continue;
    }
    out += c; i += 1;
  }
  return out;
}

// The text of the balanced { ... } block that opens at the first `{` at or after `from`.
function braceBlock(code, from) {
  const open = code.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    if (code[i] === '}') { depth -= 1; if (depth === 0) return code.slice(open, i + 1); }
  }
  return code.slice(open);
}

const BRAIN_WORDS = /BRAIN_SERVER|mindrian-brain|\bbrain_[a-z]+|framework_techniques|framework_step/;
// The two files that may name the Brain server or the tool at all.
const BRAIN_FILES = ['src/registrars/pane.tsx', 'src/runtime/ids.ts'];
// Where a use of the guidance closure may appear: its definition, its type and its one caller.
const GUIDANCE_FILES = ['src/registrars/pane.tsx', 'src/pane/types.ts', 'src/pane/think/lookup.ts'];
const CALL_LITERAL = /\$\.mcp\.call\(\s*BRAIN_SERVER\s*,\s*'framework_techniques'\s*,\s*\{ framework: handle \}\s*\)/;

// Every violation of the Part 8 shape found under `root` (a mod folder). Empty means the proof holds.
function checkTree(root) {
  const bad = [];
  const src = path.join(root, 'src');
  const rel = (f) => path.relative(root, f).split(path.sep).join('/');
  const files = walk(src, []).filter((f) => /\.tsx?$/.test(f));
  const code = new Map(files.map((f) => [rel(f), stripComments(fs.readFileSync(f, 'utf8'))]));

  // (1) only two files name the Brain; only three mention the guidance closure.
  for (const [file, text] of code) {
    if (BRAIN_WORDS.test(text) && !BRAIN_FILES.includes(file)) bad.push(file + ': names the Brain server or tool');
    if (/\.guidance\b|\bguidance\s*:/.test(text) && !GUIDANCE_FILES.includes(file)) bad.push(file + ': uses act.guidance');
  }

  // (2) the call site.
  const pane = code.get('src/registrars/pane.tsx');
  if (pane === undefined) {
    bad.push('src/registrars/pane.tsx: missing');
  } else {
    const brainCalls = pane.match(/\$\.mcp\.call\(\s*BRAIN_SERVER/g) || [];
    if (brainCalls.length !== 1) bad.push('pane.tsx: expected exactly one Brain call, found ' + brainCalls.length);
    if (!CALL_LITERAL.test(pane)) bad.push('pane.tsx: the Brain call is not exactly { framework: handle }');
    if ((pane.match(/BRAIN_SERVER/g) || []).length !== 2) bad.push('pane.tsx: BRAIN_SERVER must appear only in its import and the one call');
    const at = pane.search(/\bguidance\s*:\s*async/);
    if (at === -1) {
      bad.push('pane.tsx: no guidance closure');
    } else {
      const closure = braceBlock(pane, at);
      const callAt = closure.search(/\$\.mcp\.call\(\s*BRAIN_SERVER/);
      const checkAt = closure.search(/isCanonicalHandle\(\s*handle\s*,/);
      if (callAt === -1) bad.push('pane.tsx: the Brain call is outside the guidance closure');
      if (checkAt === -1) bad.push('pane.tsx: the guidance closure has no canon check');
      if (callAt !== -1 && checkAt !== -1 && checkAt > callAt) bad.push('pane.tsx: the canon check comes after the Brain call');
      if (!/isCanonicalHandle\([^)]*\)\s*\)\s*return\s*\{\s*kind:\s*'refused'\s*\}/.test(closure)) {
        bad.push('pane.tsx: a failed canon check does not return refused');
      }
    }
  }

  // (3) where the handle comes from, and who passes it on.
  const model = code.get('src/pane/think/help-model.ts');
  if (model === undefined) {
    bad.push('src/pane/think/help-model.ts: missing');
  } else {
    if ((model.match(/next\.method/g) || []).length !== 1) bad.push('help-model.ts: the handle must be read from next.method exactly once');
    const at = model.search(/function handleOf\b/);
    if (at === -1) {
      bad.push('help-model.ts: no handleOf');
    } else {
      const body = braceBlock(model, at);
      if (!/next\.method/.test(body)) bad.push('help-model.ts: handleOf does not read next.method');
      if (/\.place\b|\.purpose\b|\.gates\b|\.points\b|\.step\b|\.reason\b|\btitles?\b|\bpicks?\b|\.details\b|\.health\b|\.context\b/.test(body)) {
        bad.push('help-model.ts: handleOf reads something other than next.method');
      }
    }
    // The handle a plan carries is the checked one: a canon member or null.
    if (!/inCanon\(/.test(model)) bad.push('help-model.ts: the plan handle is not checked against the canon');
  }
  for (const [file, text] of code) {
    if (file === 'src/pane/think/help-model.ts' || file === 'src/pane/think/lookup.ts') continue;
    if (/\b(runLookup|lookupGuidance)\s*\(/.test(text) && file !== 'src/pane/think/help-actions.tsx') {
      bad.push(file + ': calls the lookup');
    }
  }
  const view = code.get('src/pane/think/help-actions.tsx');
  if (view === undefined) {
    bad.push('src/pane/think/help-actions.tsx: missing');
  } else {
    const calls = [...view.matchAll(/\brunLookup\s*\(([^)]*)\)/g)];
    if (calls.length === 0) bad.push('help-actions.tsx: no lookup call');
    for (const m of calls) {
      if (!/^\s*ctx\.act\s*,\s*plan\.handle\s*$/.test(m[1])) bad.push('help-actions.tsx: runLookup is passed something other than plan.handle: ' + m[1].trim());
    }
    if (/\bact\.guidance\b|\bmcpCall\b|\bio\./.test(view)) bad.push('help-actions.tsx: reaches a call path directly');
  }
  return bad;
}

// ---------- static arms ----------

scenario('static: the real src passes the Part 8 shape check', () => {
  const bad = checkTree(MOD);
  assert.deepStrictEqual(bad, [], bad.join('\n'));
});

scenario('static: grep for the Brain server name under src prints exactly registrars/pane.tsx and runtime/ids.ts', () => {
  const hits = walk(path.join(MOD, 'src'), [])
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => /BRAIN_SERVER/.test(stripComments(fs.readFileSync(f, 'utf8'))))
    .map((f) => path.relative(MOD, f).split(path.sep).join('/'))
    .sort();
  assert.deepStrictEqual(hits, ['src/registrars/pane.tsx', 'src/runtime/ids.ts']);
});

scenario('static: no file under src submits the prompt', () => {
  for (const f of walk(path.join(MOD, 'src'), []).filter((p) => /\.tsx?$/.test(p))) {
    assert.ok(!/prompt\.submit/.test(stripComments(fs.readFileSync(f, 'utf8'))), f + ' submits');
  }
});

// A scratch copy of src/ only (cheap): fn gets the mod-shaped folder to mutate and check.
function withSrcCopy(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-36926-p8-'));
  try {
    fs.cpSync(path.join(MOD, 'src'), path.join(tmp, 'src'), { recursive: true });
    return fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Replace `from` with `to` in one file of the copy, refusing to mutate nothing (a guard that moved
// would otherwise make its mutation arm pass vacuously).
function mutate(root, file, from, to) {
  const abs = path.join(root, file);
  const src = fs.readFileSync(abs, 'utf8');
  const hit = typeof from === 'string' ? src.includes(from) : from.test(src);
  assert.ok(hit, 'the text this mutation plants over has moved in ' + file + '; update this guard');
  fs.writeFileSync(abs, src.replace(from, to));
}

scenario('mutation: planting a room string in the Brain call args makes the static check FAIL', () => {
  withSrcCopy((root) => {
    mutate(root, 'src/registrars/pane.tsx', '{ framework: handle }', '{ framework: handle, note: vm.purpose }');
    const bad = checkTree(root);
    assert.ok(bad.some((b) => /not exactly \{ framework: handle \}/.test(b)), bad.join('\n'));
  });
});

scenario('mutation: sending a room string as the framework (no canon check on the path) makes the static check FAIL', () => {
  withSrcCopy((root) => {
    mutate(root, 'src/registrars/pane.tsx', /\$\.mcp\.call\(\s*BRAIN_SERVER,\s*'framework_techniques',\s*\{ framework: handle \}\s*\)/, '$.mcp.call(BRAIN_SERVER, \'framework_techniques\', { framework: purposeText })');
    const bad = checkTree(root);
    assert.ok(bad.length > 0 && bad.some((b) => /not exactly \{ framework: handle \}/.test(b)), bad.join('\n'));
  });
});

scenario('mutation: removing the canon check from the closure makes the static check FAIL', () => {
  withSrcCopy((root) => {
    mutate(root, 'src/registrars/pane.tsx', /if \(!isCanonicalHandle\(handle, canonText\)\) return \{ kind: 'refused' \}/, '');
    const bad = checkTree(root);
    assert.ok(bad.some((b) => /no canon check/.test(b)), bad.join('\n'));
  });
});

scenario('mutation: a second Brain call anywhere makes the static check FAIL', () => {
  withSrcCopy((root) => {
    fs.writeFileSync(
      path.join(root, 'src', 'pane', 'think', 'leak.tsx'),
      "import { BRAIN_SERVER } from '../../runtime/ids'\nexport const leak = (act: any, vm: any) => act.io.mcpCall(BRAIN_SERVER, 'brain_ask', { question: vm.purpose })\n",
    );
    const bad = checkTree(root);
    assert.ok(bad.some((b) => /leak\.tsx: names the Brain/.test(b)), bad.join('\n'));
  });
});

scenario('mutation: handing the lookup a room string from the view makes the static check FAIL', () => {
  withSrcCopy((root) => {
    mutate(root, 'src/pane/think/help-actions.tsx', /runLookup\(ctx\.act, plan\.handle\)/, 'runLookup(ctx.act, ctx.vm.purpose)');
    const bad = checkTree(root);
    assert.ok(bad.some((b) => /runLookup is passed something other than plan\.handle/.test(b)), bad.join('\n'));
  });
});

scenario('mutation: reading the handle from a room field in the model makes the static check FAIL', () => {
  withSrcCopy((root) => {
    mutate(root, 'src/pane/think/help-model.ts', /const (\w+) = vm\.next\.method/, 'const $1 = vm.next.method; const leak = vm.purpose');
    const bad = checkTree(root);
    assert.ok(bad.some((b) => /handleOf reads something other than next\.method/.test(b)), bad.join('\n'));
  });
});

// ---------- canary arms against the egress guard module ----------

const guard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const TOOL = 'mcp__plugin_mos_mindrian-brain__framework_techniques';
const CANON_PATH = path.join(MOD, 'assets', 'framework-names.json');
const CANON_TEXT = fs.readFileSync(CANON_PATH, 'utf8');
const CANON_NAMES = JSON.parse(CANON_TEXT).framework_names;

// Room content that must never leave: the same list drives the guard arm, the mod-check arm and the
// engine probe.
const ROOM_CANARIES = [
  'jane.doe@example.com',
  '$4,200,000 grant from the Larkspur Foundation',
  'Dr. Jane Smith, PhD',
  'Acme Bio venture plan',
  'line one\nline two',
  'x'.repeat(129),
  '',
  ' ',
  'Some Unlisted Framework',
];

scenario('canary: the guard admits exactly the payload the mod sends (a canonical handle under framework) as a known tool shape', () => {
  for (const tool of [TOOL, 'framework_techniques']) {
    const v = guard._proveKnownToolShape({ framework: 'Assumption Challenging' }, tool);
    assert.ok(v && v.class === 'known_tool_shape', tool + ' ' + JSON.stringify(v));
    const lower = guard._proveKnownToolShape({ framework: 'assumption challenging' }, tool);
    assert.ok(lower && lower.class === 'known_tool_shape', 'lowercase ' + JSON.stringify(lower));
  }
  // The payload carries exactly one key: any second key is not a known shape.
  assert.strictEqual(guard._proveKnownToolShape({ framework: 'Assumption Challenging', note: 'x' }, TOOL), null);
  assert.strictEqual(guard._proveKnownToolShape({ framework: 'Assumption Challenging', step_id: 'a::b::s01' }, TOOL), null);
});

scenario('canary: the guard does NOT classify room content (email, currency, name with degree, free text) as a known tool shape', () => {
  for (const c of ROOM_CANARIES) {
    const v = guard._proveKnownToolShape({ framework: c }, TOOL);
    assert.ok(v === null || v.class !== 'known_tool_shape', JSON.stringify(c).slice(0, 40) + ' was admitted: ' + JSON.stringify(v));
  }
  for (const c of [123, null, undefined, { a: 1 }, ['x']]) {
    const v = guard._proveKnownToolShape({ framework: c }, TOOL);
    assert.ok(v === null || v.class !== 'known_tool_shape', 'a non-string was admitted');
  }
});

// The pure half of the lookup, loaded by Node's own type stripping (lookup.ts has no value import).
// Loaded inside the arm, so a missing file fails that arm and not the whole file.
const loadLookup = () => require(path.join(MOD, 'src', 'pane', 'think', 'lookup.ts'));

scenario('canary: the mod isCanonicalHandle and the guard agree on every canon name and every room canary', () => {
  const lookup = loadLookup();
  for (const name of CANON_NAMES) {
    const mine = lookup.isCanonicalHandle(name, CANON_TEXT);
    const theirs = guard._proveKnownToolShape({ framework: name }, TOOL);
    assert.strictEqual(mine, true, name + ' refused by the mod');
    assert.ok(theirs && theirs.class === 'known_tool_shape', name + ' not admitted by the guard');
  }
  for (const c of ROOM_CANARIES.concat([123, null, undefined, {}, []])) {
    assert.strictEqual(lookup.isCanonicalHandle(c, CANON_TEXT), false, JSON.stringify(c) + ' accepted by the mod');
  }
  // An unreadable canon accepts nothing (fail closed, as the guard does on an empty vocabulary).
  for (const text of ['', 'not json', '{}', '{"framework_names":"x"}', '[]']) {
    assert.strictEqual(lookup.isCanonicalHandle('Assumption Challenging', text), false);
  }
});

// ---------- engine arms ----------

const HAVE_CLAUDE = spawnSync('claude', ['--version'], { encoding: 'utf8' }).status === 0;

function withScratch(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-36926-p8e-'));
  const dest = path.join(tmp, 'mod');
  fs.cpSync(MOD, dest, {
    recursive: true,
    filter: (p) => path.basename(p) !== 'node_modules' && p !== path.join(MOD, '.claude-plugin', 'types'),
  });
  try {
    return fn(dest);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// The probe: a Think body whose onOpen runs the REAL act.guidance closure on each canary and
// records the answer kind in the think slice; the view prints the slice as one line of JSON.
const PROBE_BODY = `
import type { TabBody } from '../types'

const HANDLES: unknown[] = ${JSON.stringify(['Assumption Challenging', 'assumption challenging', 'Dominant Design'].concat(ROOM_CANARIES))}
const NON_STRINGS: unknown[] = [123, null, {}, ['Assumption Challenging']]

export const thinkBody: TabBody = {
  view: (ctx) => {
    const { Text } = ctx.el
    return <Text key="probe">{'PROBE ' + JSON.stringify(ctx.body)}</Text>
  },
  keys: () => [],
  explainId: 'X02',
  onOpen: async (act) => {
    const out: { [key: string]: unknown } = {}
    const all = HANDLES.concat(NON_STRINGS)
    for (let i = 0; i < all.length; i += 1) {
      try {
        const answer = await act.guidance(all[i] as string)
        out['h' + i] = answer.kind
      } catch (error) {
        out['h' + i] = 'threw'
      }
    }
    await act.patch('think', { probe: out })
  },
}
`;

const PROBE_TEST = `
import { expect, mock, test } from 'claude-code/testing'

import { PANE_ID, PLUGIN_NAME } from '../src/runtime/ids'

const PALETTE = JSON.stringify({
  version: 1,
  base: {
    mondrian_red: '#A63D2F', mondrian_blue: '#1E3A6E', mondrian_yellow: '#C8A43C', mondrian_black: '#0D0D0D',
    mondrian_white: '#F5F0E8', cream: '#F5F0E8', gray_meta: '#A09A90', success_green: '#2D6B4A',
  },
})
const CANON = JSON.stringify({ framework_names: ['Assumption Challenging', 'Dominant Design', 'Five Whys'] })
const PROPS = { title: 'Mindrian workspace', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

type Call = { server: string; tool: string; args: unknown }

function wire(on: Parameters<Parameters<typeof test>[1]>[1], env: Record<string, string>): { calls: Call[] } {
  const b: { calls: Call[] } = { calls: [] }
  mock.env(on, env)
  mock.store(on, {})
  mock.clock(on, { now: 1760000000000 })
  on('fs.read', (_$, e) => {
    if (e.path.endsWith('palette.json')) return { value: PALETTE }
    if (e.path.endsWith('framework-names.json')) return { value: CANON }
    return { value: '{}' }
  })
  on('fs.exists', () => ({ value: true }))
  on('session.cwd', () => ({ value: '/r/a' }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000, percent: 10 }, rateLimits: [] } }))
  on('mcp.call', (_$, e) => {
    b.calls.push({ server: e.server, tool: e.tool, args: e.args })
    if (e.args && (e.args as { framework?: string }).framework === 'Dominant Design') throw new Error('brain down')
    return { value: { content: [{ type: 'text', text: 'Some general guidance.' }], isError: false } }
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  return b
}

function probeText(tree: unknown): string {
  const out: string[] = []
  const grab = (n: unknown): void => {
    if (typeof n === 'string') out.push(n)
    else if (Array.isArray(n)) n.forEach(grab)
    else if (typeof n === 'object' && n !== null) grab((n as { children?: unknown }).children)
  }
  grab(tree)
  return out.find((s) => s.startsWith('PROBE ')) ?? ''
}

test('part8 probe: only canonical names reach the Brain, and only as exactly { framework }', async ($, on) => {
  const beneath = wire(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' })
  await $.session.start({ cwd: '/r/a', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ plugin: PLUGIN_NAME, surface: 'terminal', component: 'Pane', props: PROPS, requestId: PANE_ID })
  await $.command.run({ command: 'workspace', args: 'think', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
  const line = probeText(await ui.drawn())
  expect(line).not.toBe('')
  const probe = JSON.parse(line.slice('PROBE '.length)).think.probe

  // h0 canonical, h1 its lowercase form, h2 canonical but the Brain is down: the three that may go.
  expect(probe.h0).toBe('reply')
  expect(probe.h1).toBe('reply')
  expect(probe.h2).toBe('failed')
  // every room canary and every non-string is refused, and none of them made a call.
  const rest = Object.keys(probe).filter((k) => k !== 'h0' && k !== 'h1' && k !== 'h2')
  expect(rest.length).toBeGreaterThan(9)
  for (const key of rest) expect(probe[key]).toBe('refused')

  expect(beneath.calls).toEqual([
    { server: 'plugin:mos:mindrian-brain', tool: 'framework_techniques', args: { framework: 'Assumption Challenging' } },
    { server: 'plugin:mos:mindrian-brain', tool: 'framework_techniques', args: { framework: 'assumption challenging' } },
    { server: 'plugin:mos:mindrian-brain', tool: 'framework_techniques', args: { framework: 'Dominant Design' } },
  ])
  expect(JSON.stringify(beneath.calls)).not.toContain('example.com')
  await ui.unmount()
})
`;

const PROBE_OK = /\(pass\) part8 probe: only canonical names reach the Brain/;
const PROBE_FAIL = /\(fail\) part8 probe: only canonical names reach the Brain/;

function runProbe(dest) {
  fs.writeFileSync(path.join(dest, 'src', 'pane', 'bodies', 'think.tsx'), PROBE_BODY);
  fs.writeFileSync(path.join(dest, 'tests', 'zz-part8-probe.test.tsx'), PROBE_TEST);
  const r = spawnSync('claude', ['plugin', 'test', dest], { encoding: 'utf8' });
  return (r.stdout || '') + (r.stderr || '');
}

scenario('engine: the real act.guidance closure sends only canonical names, as exactly { framework }, and refuses every room canary without a call', () => {
  if (!HAVE_CLAUDE) return 'skip';
  withScratch((dest) => {
    const out = runProbe(dest);
    assert.ok(PROBE_OK.test(out), out.slice(-4000));
    assert.ok(!PROBE_FAIL.test(out), out.slice(-4000));
  });
});

scenario('engine mutation: with the canon check removed from the scratch closure the probe FAILS (a room string reaches the Brain)', () => {
  if (!HAVE_CLAUDE) return 'skip';
  withScratch((dest) => {
    mutate(dest, 'src/registrars/pane.tsx', /if \(!isCanonicalHandle\(handle, canonText\)\) return \{ kind: 'refused' \}/, '');
    const out = runProbe(dest);
    assert.ok(PROBE_FAIL.test(out), 'removing the canon check did not fail the probe\n' + out.slice(-3000));
  });
});

scenario('engine mutation: with a room field added to the scratch Brain call the probe FAILS', () => {
  if (!HAVE_CLAUDE) return 'skip';
  withScratch((dest) => {
    mutate(dest, 'src/registrars/pane.tsx', '{ framework: handle }', '{ framework: handle, note: \'jane.doe@example.com\' }');
    const out = runProbe(dest);
    assert.ok(PROBE_FAIL.test(out), 'adding a key did not fail the probe\n' + out.slice(-3000));
  });
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped\n');
process.exit(failed > 0 ? 1 : skipped > 0 && passed === 0 ? 77 : 0);
