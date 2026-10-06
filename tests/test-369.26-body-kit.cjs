// 369.26 plan 11 guard: the shared pane body kit (act.patch, act.update, act.io, act.refresh,
// act.readAsset, act.sampleName, act.focus; state key `body`).
//
// Why a scratch copy: the kit's closures are built in src/registrars/pane.tsx and need a hook's `$`.
// A test hook cannot lend them one (the engine lists only the calls the plugin's own module makes,
// measured in plan 11), and the Room body only uses sampleName, refresh and setTab. So this guard
// copies the mod to a temp dir, replaces the Think body with a PROBE body that runs every closure
// from its onOpen, and mounts the REAL pane there with the nouns beneath answered. The repo tree is
// never touched.
//
//   static: kit.ts is pure (no `$`, no atom, no hook), names no Brain server; no body file names the
//           Brain; the state contract declares `body` once with an index signature (no phantom Record);
//   engine: validate lists mindrian-workspace.body as read and written and no key named Record; the
//           probe proves patch and update merge into one tab of the one key, the server pin refuses
//           every server but the Mindrian OS one WITHOUT a call, readAsset reads one bare name and
//           refuses a path, sampleName answers the session sample, then the dev switch, then null,
//           focus resolves without throwing (whether the ring moved is not observable in the harness).
// Exit 77 (ENV GAP, never a pass) when the claude binary is not on PATH.
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

const codeOf = (f) =>
  fs.readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');

// ---------- static arms ----------

scenario('kit.ts is pure: no $, no atom, no hook, no engine import, and no Brain server', () => {
  const code = codeOf(path.join(MOD, 'src', 'pane', 'kit.ts'));
  assert.ok(!/\$\./.test(code) && !/\(\$[,)]/.test(code), 'kit.ts uses $');
  assert.ok(!/\batom\(|\bupdate\(|\bread\(|\bon\(|from 'claude-code'/.test(code), 'kit.ts reaches the engine');
  assert.ok(!/BRAIN_SERVER|mindrian-brain|brain_/.test(code), 'kit.ts names the Brain');
  assert.ok(/MINDRIAN_SERVER/.test(code), 'kit.ts does not pin the Mindrian OS server');
});

scenario('no tab body or panel names the Brain server', () => {
  for (const dir of ['bodies', 'room']) {
    const root = path.join(MOD, 'src', 'pane', dir);
    if (!fs.existsSync(root)) continue;
    for (const f of walk(root, [])) {
      assert.ok(!/BRAIN_SERVER|mindrian-brain|brain_/.test(codeOf(f)), f + ' names the Brain');
    }
  }
});

scenario('the state contract declares body once, with an index signature and no nested Record<string, unknown>', () => {
  // Comments may name the trap; only the code is checked.
  const d = fs.readFileSync(path.join(MOD, 'types', 'state.d.ts'), 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.strictEqual((d.match(/^\s*body:/gm) || []).length, 1);
  assert.match(d, /body: Record<'room' \| 'think' \| 'sources' \| 'review', \{ \[key: string\]: unknown \}>/);
  assert.ok(!/Record<string, unknown>/.test(d), 'a nested Record<string, unknown> makes validate list a phantom key');
  assert.ok(!/^\s*import\s/m.test(d), 'the contract file may not import');
});

scenario('the registrar declares the body atom with one literal reference', () => {
  const src = fs.readFileSync(path.join(MOD, 'src', 'registrars', 'pane.tsx'), 'utf8');
  assert.strictEqual((src.match(/key: 'body'/g) || []).length, 1);
});

// ---------- engine arms ----------

const HAVE_CLAUDE = spawnSync('claude', ['--version'], { encoding: 'utf8' }).status === 0;

function withScratch(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-36926-kit-'));
  const dest = path.join(tmp, 'mod');
  fs.cpSync(MOD, dest, {
    recursive: true,
    filter: (src) => path.basename(src) !== 'node_modules' && src !== path.join(MOD, '.claude-plugin', 'types'),
  });
  try {
    return fn(dest);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

scenario('validate lists mindrian-workspace.body as read and written, and no phantom Record key', () => {
  if (!HAVE_CLAUDE) return 'skip';
  const r = spawnSync('claude', ['plugin', 'validate', MOD], { encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  assert.strictEqual(r.status, 0, out);
  assert.match(out, /state reads:[^\n]*mindrian-workspace\.body/);
  assert.match(out, /state writes:[^\n]*mindrian-workspace\.body/);
  assert.ok(!/mindrian-workspace\.Record/.test(out), 'a phantom Record key is listed\n' + out);
});

// The probe: a Think body whose onOpen runs every closure of the kit and records what happened in
// the think slice, and whose view prints the whole body record as one line of JSON.
const PROBE_BODY = `
import type { TabBody } from '../types'

const MINDRIAN = 'plugin:mos:mindrian-os'

export const thinkBody: TabBody = {
  view: (ctx) => {
    const { Text } = ctx.el
    return <Text key="probe">{'PROBE ' + JSON.stringify(ctx.body)}</Text>
  },
  keys: () => [],
  explainId: 'X02',
  onOpen: async (act) => {
    const out: { [key: string]: unknown } = {}
    await act.patch('think', { a: 1, b: [1], gone: 'x' })
    await act.patch('think', { b: [1, 2], gone: undefined })
    await act.update('think', (slice) => ({ ...slice, c: Array.isArray(slice.b) ? slice.b.length : -1 }))
    await act.patch('room', { actionsOpen: true })
    await act.io.mcpCall(MINDRIAN, 'gate_list', {})
    for (const server of ['plugin:mos:mindrian-brain', 'theo', '', MINDRIAN + ' ']) {
      try {
        await act.io.mcpCall(server, 'framework_techniques', { framework: 'x' })
        out['server:' + server] = 'reached'
      } catch (error) {
        out['server:' + server] = 'refused:' + (error instanceof Error ? error.message : '')
      }
    }
    out.asset = await act.readAsset('probe-asset.json')
    for (const bad of ['../x', 'a/b', '..', '', 'a\\\\b']) {
      try {
        await act.readAsset(bad)
        out['asset:' + bad] = 'read'
      } catch (error) {
        out['asset:' + bad] = 'refused:' + (error instanceof Error ? error.message : '')
      }
    }
    out.sample = await act.sampleName()
    await act.focus('tab:think')
    out.focus = 'resolved'
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

const PROPS = { title: 'Mindrian workspace', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

type Beneath = { mcp: { server: string; tool: string }[]; reads: string[]; focused: string[] }

function wire(on: Parameters<Parameters<typeof test>[1]>[1], env: Record<string, string>): Beneath {
  const b: Beneath = { mcp: [], reads: [], focused: [] }
  mock.env(on, env)
  mock.store(on, {})
  mock.clock(on, { now: 1760000000000 })
  on('fs.read', (_$, e) => {
    b.reads.push(e.path)
    if (e.path.endsWith('palette.json')) return { value: PALETTE }
    if (e.path.endsWith('probe-asset.json')) return { value: '{"probe":true}' }
    return { value: '{}' }
  })
  on('fs.exists', () => ({ value: true }))
  on('session.cwd', () => ({ value: '/r/a' }))
  on('session.usage', () => ({ value: { startedAt: 1, context: { window: 200000, percent: 10 }, rateLimits: [] } }))
  on('mcp.call', (_$, e) => {
    b.mcp.push({ server: e.server, tool: e.tool })
    return { value: { content: [{ type: 'text', text: JSON.stringify({ ok: true, room: 'a', count: 0, gates: [], segments: {} }) }], isError: false } }
  })
  on('ui.focus', (_$, e) => {
    if (e.element !== undefined) b.focused.push(e.element)
    return {}
  })
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  return b
}

// A live room has no model until the session's first read: start the session so the pane has one.
async function start($: any) {
  await $.session.start({ cwd: '/r/a', surface: 'terminal', isInteractive: true })
}

async function run($: any, args: string) {
  return $.command.run({ command: 'workspace', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } })
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

test('kit probe: every closure of the body kit works under the real engine', async ($, on) => {
  const beneath = wire(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p' })
  await start($)
  const ui = await $.ui.mount({ plugin: PLUGIN_NAME, surface: 'terminal', component: 'Pane', props: PROPS, requestId: PANE_ID })
  await run($, 'think')
  const line = probeText(await ui.drawn())
  expect(line).not.toBe('')
  const body = JSON.parse(line.slice('PROBE '.length))

  // patch merges per tab, an undefined value removes a key, update is functional, other tabs untouched.
  expect(body.think.a).toBe(1)
  expect(body.think.b).toEqual([1, 2])
  expect('gone' in body.think).toBe(false)
  expect(body.think.c).toBe(2)
  expect(body.room).toEqual({ actionsOpen: true })
  expect(body.sources).toEqual({})
  expect(body.review).toEqual({})

  // The pin: the Mindrian OS server was called, every other server was refused with NO call.
  expect(beneath.mcp.map((c) => c.server + ':' + c.tool)).toContain('plugin:mos:mindrian-os:gate_list')
  expect(beneath.mcp.every((c) => c.server === 'plugin:mos:mindrian-os')).toBe(true)
  expect(beneath.mcp.some((c) => c.tool === 'framework_techniques')).toBe(false)
  for (const key of ['server:plugin:mos:mindrian-brain', 'server:theo', 'server:', 'server:plugin:mos:mindrian-os ']) {
    expect(String(body.think.probe[key])).toMatch(/^refused:/)
  }

  // readAsset: one bare name under assets/, a path refused without a read.
  expect(body.think.probe.asset).toBe('{"probe":true}')
  for (const key of ['asset:../x', 'asset:a/b', 'asset:..', 'asset:', 'asset:a\\\\b']) {
    expect(String(body.think.probe[key])).toMatch(/^refused:/)
  }
  const assetReads = beneath.reads.filter((p) => p.includes('/assets/') && !p.endsWith('palette.json'))
  expect(assetReads).toHaveLength(1)
  expect(assetReads[0]?.endsWith('/assets/probe-asset.json')).toBe(true)

  // sampleName is null on a live room; focus resolved without throwing (the harness does not carry a
  // refused or accepted ring move to a hook beneath, so only "never rejects" is proved here).
  expect(body.think.probe.sample).toBeNull()
  expect(body.think.probe.focus).toBe('resolved')
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})

test('kit probe: sampleName answers the dev switch, and the session sample wins over it', async ($, on) => {
  wire(on, { MINDRIAN_ROOMS_HOME: '/r', HOME: '/home/p', MOS_WORKSPACE_SAMPLE: 'several' })
  const ui = await $.ui.mount({ plugin: PLUGIN_NAME, surface: 'terminal', component: 'Pane', props: PROPS, requestId: PANE_ID })
  await run($, 'think')
  let body = JSON.parse(probeText(await ui.drawn()).slice('PROBE '.length))
  expect(body.think.probe.sample).toBe('several')
  await run($, 'sample empty')
  await run($, 'think')
  body = JSON.parse(probeText(await ui.drawn()).slice('PROBE '.length))
  expect(body.think.probe.sample).toBe('empty')
  await run($, 'live')
  await ui.press({ key: 'tab:room' })
  await ui.unmount()
})
`;

scenario('the probe: every closure of the kit works under the real engine (patch, update, pin, assets, sample, focus)', () => {
  if (!HAVE_CLAUDE) return 'skip';
  withScratch((dest) => {
    fs.writeFileSync(path.join(dest, 'src', 'pane', 'bodies', 'think.tsx'), PROBE_BODY);
    fs.writeFileSync(path.join(dest, 'tests', 'zz-kit-probe.test.tsx'), PROBE_TEST);
    const r = spawnSync('claude', ['plugin', 'test', dest], { encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    assert.ok(/\(pass\) kit probe: every closure of the body kit works under the real engine/.test(out), out.slice(-4000));
    assert.ok(/\(pass\) kit probe: sampleName answers the dev switch/.test(out), out.slice(-4000));
    assert.ok(!/\(fail\) kit probe/.test(out), out.slice(-4000));
  });
});

scenario('mutation: with the server pin removed from the scratch copy the probe FAILS (the arm discriminates)', () => {
  if (!HAVE_CLAUDE) return 'skip';
  withScratch((dest) => {
    fs.writeFileSync(path.join(dest, 'src', 'pane', 'bodies', 'think.tsx'), PROBE_BODY);
    fs.writeFileSync(path.join(dest, 'tests', 'zz-kit-probe.test.tsx'), PROBE_TEST);
    const reg = path.join(dest, 'src', 'registrars', 'pane.tsx');
    const src = fs.readFileSync(reg, 'utf8');
    const pinned = 'allowedServer(server) ? $.mcp.call(server, tool, args) : Promise.reject(new Error(\'server_not_allowed\'))';
    assert.ok(src.includes(pinned), 'the pin line moved; update this guard');
    fs.writeFileSync(reg, src.replace(pinned, '$.mcp.call(server, tool, args)'));
    const r = spawnSync('claude', ['plugin', 'test', dest], { encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    assert.ok(/\(fail\) kit probe: every closure of the body kit works under the real engine/.test(out), 'removing the pin did not fail the probe\n' + out.slice(-3000));
  });
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped\n');
process.exit(failed > 0 ? 1 : skipped > 0 && passed === 0 ? 77 : 0);
