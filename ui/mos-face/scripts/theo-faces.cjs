// Generator for ui/mos-face/tests/face-fixture.ts (Phase 380 plan 12, D-10, MOD380-09).
//
// What it does: it runs the canon face renderer (assets/asset-d96217b320.js, copied byte for
// byte from the mos-brand book) inside a vm context with a minimal fake DOM, mounts it once for
// each of the 11 states, and records the attributes the renderer sets on each part. The record is
// the CANON data in the fixture. The fixture also holds the exact text of the asset JSON
// (ASSET_TEXT), because the engine tests read no file.
//
// Why: the TypeScript composition (hooks/theo-face.ts) must equal what the canon renderer draws.
// The test compares the two. No pose number is typed anywhere: the numbers come from the asset.
//
// Usage:
//   node ui/mos-face/scripts/theo-faces.cjs --write   regenerate tests/face-fixture.ts
//   node ui/mos-face/scripts/theo-faces.cjs --check   exit 1 when the fixture differs (prints the first difference)
//
// Safety (T-380-48): the renderer runs in a vm context that holds only the fake DOM objects below.
// It has no require, no process, no fs, no network. A 2 second timeout stops a runaway script.
// The output is data only. CJS, Node built-ins and vm only. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

const MOD = path.resolve(__dirname, '..');
const ASSET_JSON = path.join(MOD, 'assets', 'asset-fa8504998f.json');
const ASSET_JS = path.join(MOD, 'assets', 'asset-d96217b320.js');
const FIXTURE = path.join(MOD, 'tests', 'face-fixture.ts');

// The parts the renderer draws, in the order of the svg it builds.
const PART_NAMES = ['ground', 'plane', 'vertical', 'horizontal', 'bar', 'one', 'two', 'frame'];

// ---- the minimal fake DOM -------------------------------------------------------------------

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.attrs = new Map();
    this.children = [];
    this.dataset = {};
  }

  setAttribute(k, v) {
    this.attrs.set(String(k), String(v));
  }

  getAttribute(k) {
    return this.attrs.has(k) ? this.attrs.get(k) : null;
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  replaceChildren(...nodes) {
    this.children = nodes;
  }

  querySelectorAll(selector) {
    if (selector !== '[data-part]') throw new Error('fake DOM: selector not supported: ' + selector);
    const out = [];
    const walk = (el) => {
      for (const child of el.children) {
        if (child.dataset.part !== undefined) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  set innerHTML(html) {
    this.children = parseMarkup(String(html));
  }
}

// A small parser for the markup the renderer builds: self closing rect tags and one g element
// that holds a rect. Anything else is a missing piece of the fake DOM and throws.
function parseMarkup(html) {
  const root = new FakeElement('root');
  const stack = [root];
  const re = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let last = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (html.slice(last, m.index).trim() !== '') throw new Error('fake DOM: text node not supported');
    last = re.lastIndex;
    const [, closing, tag, attrText, selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    const el = new FakeElement(tag);
    const attrRe = /([a-zA-Z-]+)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(attrText)) !== null) {
      if (a[1] === 'data-part') el.dataset.part = a[2];
      else el.attrs.set(a[1], a[2]);
    }
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) stack.push(el);
  }
  if (html.slice(last).trim() !== '') throw new Error('fake DOM: trailing text not supported');
  if (stack.length !== 1) throw new Error('fake DOM: unbalanced markup');
  return root.children;
}

// Run the canon renderer for one state and return the attributes of every part.
// How: mount with initial = id (the mount draws it), then also call setState(id, instant) on a
// second mount that started at another state; both must give the same record.
function runRenderer(rendererSource, id, startAt) {
  const created = [];
  const document = {
    createElementNS(_ns, tag) {
      const el = new FakeElement(tag);
      el.setAttribute = FakeElement.prototype.setAttribute.bind(el);
      created.push(el);
      return el;
    },
  };
  const sandbox = {
    document,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    console: { log() {}, warn() {}, error() {} },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(rendererSource, context, { timeout: 2000, filename: 'asset-d96217b320.js' });
  const api = sandbox.MosTheo;
  if (!api || typeof api.mount !== 'function') throw new Error('the renderer did not expose MosTheo.mount');
  const container = new FakeElement('div');
  const handle = api.mount(container, { initial: startAt || id });
  if (startAt) {
    if (handle.setState(id, { instant: true }) !== true) throw new Error('setState refused the state ' + id);
  }
  const svg = created.find((el) => el.tag === 'svg');
  if (!svg) throw new Error('the renderer built no svg');
  const parts = svg.querySelectorAll('[data-part]');
  const byName = {};
  for (const el of parts) byName[el.dataset.part] = el;
  const record = [];
  for (const name of PART_NAMES) {
    const el = byName[name];
    if (!el) throw new Error('the renderer has no part ' + name);
    record.push({ part: name, attrs: Object.fromEntries(el.attrs) });
    if (name === 'bar') {
      const inner = el.firstElementChild;
      if (!inner) throw new Error('the bar part has no rect');
      record.push({ part: 'barRect', attrs: Object.fromEntries(inner.attrs) });
    }
  }
  return { record, label: svg.getAttribute('aria-label') };
}

function buildFixture() {
  const assetText = fs.readFileSync(ASSET_JSON, 'utf8');
  const rendererText = fs.readFileSync(ASSET_JS, 'utf8');
  const asset = JSON.parse(assetText);
  const ids = asset.states.map((s) => s.id);
  const canon = {};
  for (const id of ids) {
    const direct = runRenderer(rendererText, id, null);
    // The same state reached with setState from another state must draw the same attributes.
    const other = ids.find((x) => x !== id);
    const moved = runRenderer(rendererText, id, other);
    if (JSON.stringify(direct.record) !== JSON.stringify(moved.record)) {
      throw new Error('the renderer draws ' + id + ' differently when reached with setState');
    }
    canon[id] = direct.record;
  }
  const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
  const lines = [
    '// GENERATED by ui/mos-face/scripts/theo-faces.cjs --write. Do not edit by hand.',
    '// Test data, not product code. Phase 380 plan 12 (D-10, MOD380-09).',
    '//',
    '// ASSET_TEXT is the exact text of assets/asset-fa8504998f.json (the canon Theo face asset,',
    '// mos-brand book e947a5d, segments/identity/theo/entries/2026-10-19). The engine tests read no',
    '// file, so the text sits here as a string constant.',
    '// CANON holds, for each state, the attributes that the canon renderer asset-d96217b320.js sets',
    '// on each part, in draw order (record taken by running that renderer in a vm with a fake DOM).',
    '// asset json sha256 ' + sha(assetText),
    '// renderer js  sha256 ' + sha(rendererText),
    '// Hyphens only.',
    '',
    'export type CanonAttrs = Record<string, string>',
    'export type CanonRecord = { part: string; attrs: CanonAttrs }',
    '',
    'export const ASSET_TEXT: string = ' + JSON.stringify(assetText),
    '',
    'export const CANON: Record<string, CanonRecord[]> = ' + JSON.stringify(canon, null, 1),
    '',
  ];
  return lines.join('\n');
}

function main() {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    process.stdout.write('usage: node ui/mos-face/scripts/theo-faces.cjs --write | --check\n');
    process.exit(2);
  }
  const want = buildFixture();
  if (mode === '--write') {
    fs.writeFileSync(FIXTURE, want);
    process.stdout.write('wrote ' + path.relative(process.cwd(), FIXTURE) + ' (' + want.length + ' bytes)\n');
    return;
  }
  let have = '';
  try {
    have = fs.readFileSync(FIXTURE, 'utf8');
  } catch {
    process.stdout.write('theo-faces --check: the fixture is missing. One fix: run --write\n');
    process.exit(1);
  }
  if (have !== want) {
    const a = have.split('\n');
    const b = want.split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
    process.stdout.write('theo-faces --check: the fixture differs from the canon renderer at line ' + (i + 1) + '\n');
    process.stdout.write('  have: ' + String(a[i]).slice(0, 120) + '\n  want: ' + String(b[i]).slice(0, 120) + '\n');
    process.stdout.write('One fix: run node ui/mos-face/scripts/theo-faces.cjs --write\n');
    process.exit(1);
  }
  process.stdout.write('theo-faces --check: the fixture equals the canon renderer output\n');
}

main();
