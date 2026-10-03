// CANON369-04 and CANON369-05: the shell is skinned in Design Canon v3 and framed by the D-10 information
// architecture (plan 369-20).
//
// Static arms read the shell's own source (ui/shell/client, ui/shell/app, the walled manifest and lockfile):
// the eleven tokens, no outside colour, radius 0, ochre law, no shadow or gradient, no style attribute (the
// CSP's style-src blocks it), bundled fonts, TileMark's required status, no emoji or long dash. Behaviour arms
// transpile the primitives and the frame with the walled package's own TypeScript and render them to markup
// with its React (skipped with a named gap only when ui/shell/node_modules is absent). The render arm drives
// the BUILT shell in headless Chromium through tests/e2e-369/lib/pw.cjs: no CSP violation anywhere, computed
// radius 0, one aria-current tab, the Status panel and the room-switch dialog, no horizontal scroll at 390 px,
// the four fonts loaded from 127.0.0.1 only. Exit 77 for the render arm when Playwright, Chromium or the
// build is absent (reported by name).
//
// Hermetic: temp HOME, no CLAUDE_ACTIVE_ROOM or CLAUDE_CODE_SESSION_ID; the shell binds 127.0.0.1 only.
// Plain counters, nonzero exit tail (house harness). Hyphens only; no em-dashes or en-dashes.
'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const REPO = path.resolve(__dirname, '..');
const SHELL = path.join(REPO, 'ui', 'shell');
const CLIENT = path.join(SHELL, 'client');
const APP = path.join(SHELL, 'app');
const STANDALONE = path.join(SHELL, '.next', 'standalone');
const pw = require('./e2e-369/lib/pw.cjs');

// Playwright looks for its browsers under HOME; the temp HOME below would hide them. Pin the real cache first.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.HOME) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(process.env.HOME, '.cache', 'ms-playwright');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-skin-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP_HOME, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + String(err.stack || err.message || err).split('\n').slice(0, 14).join('\n    ') + '\n');
}
function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}
async function ascenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

// ---------- shared helpers ----------

function listFiles(dir, exts, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      listFiles(p, exts, out);
    } else if (!exts || exts.some((x) => e.name.endsWith(x))) {
      out.push(p);
    }
  }
  return out;
}
const rel = (f) => path.relative(REPO, f).split(path.sep).join('/');
const read = (f) => fs.readFileSync(f, 'utf8');
const cssFiles = () => listFiles(CLIENT, ['.css']);
const sourceFiles = () => listFiles(CLIENT, ['.ts', '.tsx']).concat(listFiles(APP, ['.ts', '.tsx']));

const TOKENS = {
  '--paper': '#F5F0E6',
  '--paper-deep': '#E9DFCF',
  '--paper-light': '#FCF9F2',
  '--ink': '#14202B',
  '--ink-soft': '#46535D',
  '--line': '#14202B',
  '--rust': '#A8462D',
  '--cobalt': '#2457A5',
  '--ochre': '#D49A20',
  '--success': '#2F6849',
  '--error': '#A12E2E',
};
const TOKEN_HEXES = new Set(Object.values(TOKENS).map((h) => h.toUpperCase()));

// A small CSS reader: comments out, rule blocks with their at-rule context, declarations split.
function parseCss(src) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  function walk(chunk, ctx) {
    let i = 0;
    while (i < chunk.length) {
      const open = chunk.indexOf('{', i);
      if (open === -1) break;
      const head = chunk.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < chunk.length && depth > 0) {
        if (chunk[j] === '{') depth += 1;
        else if (chunk[j] === '}') depth -= 1;
        j += 1;
      }
      const body = chunk.slice(open + 1, j - 1);
      if (/^@(media|supports|layer)/.test(head)) walk(body, ctx.concat(head));
      else if (/^@keyframes/.test(head)) walk(body, ctx.concat(head));
      else rules.push({ selector: head, body, ctx, decls: parseDecls(body) });
      i = j;
    }
  }
  walk(text, []);
  return rules;
}
function parseDecls(body) {
  return body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const k = d.indexOf(':');
    return k === -1 ? null : { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim() };
  }).filter(Boolean);
}
const inKeyframes = (r) => r.ctx.some((c) => /^@keyframes/.test(c));
const valueOf = (r, prop) => (r.decls.find((d) => d.prop === prop) || {}).value;

// color-mix( ... ) with one level of nested parentheses (var(--token)).
const COLOR_MIX = /color-mix\(((?:[^()]|\([^()]*\))*)\)/g;

// Each checker returns a list of violation strings (empty = clean) so a planted bad sheet proves it bites.
function checkColourLiterals(css) {
  const out = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const hex = m[0].toUpperCase();
    if (!TOKEN_HEXES.has(hex)) out.push('outside colour literal ' + m[0]);
  }
  for (const m of stripped.matchAll(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g)) out.push('colour function ' + m[0]);
  for (const r of parseCss(css)) {
    for (const d of r.decls) {
      if (d.prop.startsWith('--')) continue;
      const v = d.value.replace(COLOR_MIX, '').replace(/var\([^)]*\)/g, '');
      const named = /\b(white|black|red|blue|green|yellow|gray|grey|orange|purple|pink|brown|silver|gold|navy|teal|cyan|magenta|maroon|olive|lime|aqua|fuchsia)\b/i.exec(v);
      if (named && /color|background|border|outline|fill|stroke|shadow/.test(d.prop)) out.push('named colour ' + named[0] + ' in ' + r.selector);
    }
  }
  for (const m of stripped.matchAll(COLOR_MIX)) {
    const parts = m[1].split(',').slice(1).map((p) => p.trim());
    for (const p of parts) {
      if (!/^(var\(--[a-z-]+\)( \d+%)?|transparent)$/.test(p)) out.push('color-mix with a non-token argument: ' + m[0]);
    }
  }
  return out;
}
function checkOchre(css) {
  const out = [];
  for (const r of parseCss(css)) {
    if (/\[data-surface="ink"\]/.test(r.selector)) continue; // the one plain-ochre case: a triangle or line on an ink field
    for (const d of r.decls) {
      if (['color', 'text-decoration-color', 'caret-color'].includes(d.prop) && /var\(--ochre\)/.test(d.value)) out.push('ochre as text colour in ' + r.selector);
    }
    const fill = r.decls.find((d) => ['background', 'background-color', 'fill'].includes(d.prop) && /var\(--ochre\)/.test(d.value));
    if (fill) {
      const outlined = r.decls.some((d) => (['border', 'outline'].includes(d.prop) && /^1px solid var\(--ink\)$/.test(d.value)) || (d.prop === 'stroke' && d.value === 'var(--ink)'));
      if (!outlined) out.push('ochre fill without a 1px ink outline in ' + r.selector);
    }
  }
  return out;
}
function checkForbiddenPairs(css) {
  const out = [];
  for (const r of parseCss(css)) {
    const fg = valueOf(r, 'color');
    const bg = valueOf(r, 'background') || valueOf(r, 'background-color');
    if (!fg || !bg) continue;
    if (/var\(--ochre\)/.test(fg)) out.push('ochre text in ' + r.selector);
    if (/var\(--cobalt\)/.test(fg) && /var\(--ink\)/.test(bg)) out.push('cobalt on ink in ' + r.selector);
    if (/var\(--rust\)/.test(fg) && /var\(--ink\)/.test(bg)) out.push('rust on ink in ' + r.selector);
    if (/var\(--ochre\)/.test(bg) && !/var\(--ink\)/.test(fg)) out.push('ochre fill under non-ink text in ' + r.selector);
  }
  return out;
}
function checkRadius(css) {
  const out = [];
  for (const r of parseCss(css)) {
    for (const d of r.decls) {
      if (!/radius/.test(d.prop)) continue;
      const zero = /^(0|0px|var\(--radius\))$/.test(d.value);
      if (!zero && !/\[data-mark="circle"\]/.test(r.selector)) out.push('radius ' + d.value + ' in ' + r.selector);
    }
  }
  return out;
}
function checkShadowGradientOpacity(css) {
  const out = [];
  for (const r of parseCss(css)) {
    for (const d of r.decls) {
      if (d.prop === 'box-shadow' && d.value !== 'none' && !/:focus-visible/.test(r.selector)) out.push('box-shadow outside the focus ring in ' + r.selector);
      if (/gradient\(/.test(d.value)) out.push('gradient in ' + r.selector);
      if (d.prop === 'backdrop-filter') out.push('backdrop-filter in ' + r.selector);
      if (d.prop === 'opacity' && !inKeyframes(r)) out.push('opacity outside a keyframe in ' + r.selector);
    }
  }
  return out;
}

const luminance = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mixHex = (a, b, wa) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * wa + parseInt(b.slice(i, i + 2), 16) * (1 - wa)).toString(16).padStart(2, '0')).join('');

// ---------- (1) tokens ----------

scenario('tokens.css carries the eleven UI-SPEC colour tokens, names and hexes exact', () => {
  const css = read(path.join(CLIENT, 'styles', 'tokens.css'));
  for (const [name, hex] of Object.entries(TOKENS)) {
    const re = new RegExp('^\\s*' + name.replace(/-/g, '\\-') + ':\\s*' + hex + ';', 'm');
    assert.ok(re.test(css), name + ': ' + hex + ' missing');
    assert.strictEqual((css.match(new RegExp(hex, 'gi')) || []).length, hex === '#14202B' ? 2 : 1, hex + ' appears the expected number of times (--ink and --line share one)');
  }
  for (const font of ['--font-display: "Fraunces", Georgia, serif', '--font-ui: "DM Sans", Arial, sans-serif', '--font-editorial: "Bodoni Moda", Didot, serif', '--font-code: "JetBrains Mono", monospace']) {
    assert.ok(css.includes(font), font);
  }
  assert.ok(/--radius:\s*0;/.test(css), '--radius: 0');
  assert.ok(/--ease-workshop:\s*cubic-bezier\(\.22, 1, \.36, 1\)/.test(css));
  for (const sp of ['4px', '8px', '16px', '24px', '32px', '48px', '64px']) {
    assert.ok(new RegExp('--space-[a-z0-9]+:\\s*' + sp + ';').test(css), 'spacing ' + sp);
  }
  assert.ok(/--paper:\s*#F5F0E6/.test(css), 'the plan acceptance string "--paper: #F5F0E6"');
});

// ---------- (2) colour law, radius, shadow, gradient, ochre ----------

scenario('C9: every colour literal in shell CSS is one of the eleven token hexes (or a color-mix of tokens)', () => {
  const files = cssFiles();
  assert.ok(files.length >= 5, 'at least tokens, base, fonts, primitives and frame: ' + files.map(rel).join(', '));
  for (const f of files) assert.deepStrictEqual(checkColourLiterals(read(f)), [], rel(f));
});

scenario('colour law: ochre is never text, an ochre fill carries a 1px ink outline (or sits on an ink field), no forbidden pair', () => {
  for (const f of cssFiles()) {
    const css = read(f);
    assert.deepStrictEqual(checkOchre(css), [], rel(f) + ' ochre');
    assert.deepStrictEqual(checkForbiddenPairs(css), [], rel(f) + ' pairs');
  }
});

scenario('canon law: radius 0 except the circle mark; no shadow but the focus edge; no gradient, backdrop-filter or tinting opacity', () => {
  let radiusRules = 0;
  for (const f of cssFiles()) {
    const css = read(f);
    assert.deepStrictEqual(checkRadius(css), [], rel(f) + ' radius');
    assert.deepStrictEqual(checkShadowGradientOpacity(css), [], rel(f) + ' shadow');
    radiusRules += parseCss(css).filter((r) => r.decls.some((d) => /radius/.test(d.prop))).length;
  }
  assert.ok(radiusRules >= 2, 'base.css sets the universal radius and the circle exception');
  const base = parseCss(read(path.join(CLIENT, 'styles', 'base.css')));
  assert.ok(base.some((r) => /^\[data-mark="circle"\]$/.test(r.selector) && valueOf(r, 'border-radius') === '50%'), 'the circle mark is the one rounded element');
});

scenario('the colour, ochre, radius and shadow checkers bite: a planted bad sheet is refused (mutation)', () => {
  assert.ok(checkColourLiterals('.a { color: #FF0000; }').length > 0, 'an outside hex');
  assert.ok(checkColourLiterals('.a { color: rgb(1, 2, 3); }').length > 0, 'a colour function');
  assert.ok(checkColourLiterals('.a { color: color-mix(in srgb, #123456 50%, transparent); }').length > 0, 'a literal inside color-mix');
  assert.deepStrictEqual(checkColourLiterals('.a { color: color-mix(in srgb, var(--paper) 75%, transparent); }'), []);
  assert.ok(checkOchre('.a { color: var(--ochre); }').length > 0, 'ochre text');
  assert.ok(checkOchre('.a { background: var(--ochre); }').length > 0, 'an ochre fill with no outline');
  assert.deepStrictEqual(checkOchre('.a { background: var(--ochre); border: 1px solid var(--ink); }'), []);
  assert.deepStrictEqual(checkOchre('.sm[data-surface="ink"] { background: var(--ochre); }'), []);
  assert.ok(checkForbiddenPairs('.a { color: var(--cobalt); background: var(--ink); }').length > 0, 'cobalt on ink');
  assert.ok(checkForbiddenPairs('.a { color: var(--rust); background: var(--ink); }').length > 0, 'rust on ink');
  assert.ok(checkRadius('.a { border-radius: 4px; }').length > 0, 'a rounded corner');
  assert.deepStrictEqual(checkRadius('[data-mark="circle"] { border-radius: 50%; }'), []);
  assert.ok(checkShadowGradientOpacity('.a { box-shadow: 0 1px 3px var(--ink); }').length > 0, 'a drop shadow');
  assert.deepStrictEqual(checkShadowGradientOpacity(':focus-visible { box-shadow: 0 0 0 7px var(--ink); }'), []);
  assert.ok(checkShadowGradientOpacity('.a { background: linear-gradient(var(--ink), var(--paper)); }').length > 0, 'a gradient');
  assert.ok(checkShadowGradientOpacity('.a { opacity: 0.5; }').length > 0, 'a tinting opacity');
});

scenario('contrast: the pairs the shell draws meet the canon ratios (paper, paper-deep, ink fields, the CTA consequence line)', () => {
  const T = TOKENS;
  assert.ok(contrast(T['--ink'], T['--paper']) >= 14, 'ink on paper');
  assert.ok(contrast(T['--ink-soft'], T['--paper']) >= 6.9, 'ink-soft on paper');
  assert.ok(contrast(T['--ink-soft'], T['--paper-deep']) >= 5.9, 'ink-soft on paper-deep');
  assert.ok(contrast(T['--paper-light'], T['--ink']) >= 15, 'paper-light on ink');
  assert.ok(contrast(T['--ochre'], T['--ink']) >= 6.5, 'ochre on ink (the triangle)');
  assert.ok(contrast(T['--error'], T['--paper']) >= 6.2, 'error on paper');
  assert.ok(contrast(T['--error'], T['--paper-deep']) >= 4.5, 'error on paper-deep (the Status panel)');
  assert.ok(contrast(T['--success'], T['--paper']) >= 5.7, 'success on paper');
  assert.ok(contrast(T['--cobalt'], T['--paper']) >= 6.1, 'cobalt on paper (the bar and circle)');
  assert.ok(contrast(T['--rust'], T['--paper']) >= 5.1, 'rust on paper (the mark)');
  const consequence = mixHex(T['--paper'], T['--ink'], 0.75); // color-mix(paper 75%, transparent) over the ink bar
  assert.ok(contrast(consequence, T['--ink']) >= 4.5, 'the CTA consequence line on ink measures ' + contrast(consequence, T['--ink']).toFixed(2));
});

scenario('Bodoni Moda is drawn only in the wordmark', () => {
  for (const f of cssFiles()) {
    if (f.endsWith('tokens.css')) continue;
    for (const r of parseCss(read(f))) {
      for (const d of r.decls) {
        if (/--font-editorial|Bodoni/.test(d.value) && !f.endsWith('fonts.css')) assert.ok(/\.wordmark$/.test(r.selector), rel(f) + ' draws Bodoni in ' + r.selector);
      }
    }
  }
});

// ---------- (3) no style attribute, no emoji, no long dash, no HTML injection ----------

scenario('CSP: no style attribute anywhere in the shell client or route glue (style-src blocks it)', () => {
  for (const f of sourceFiles()) {
    const src = read(f);
    assert.ok(!/\bstyle\s*=\s*[{"']/.test(src), rel(f) + ' sets a style attribute');
    assert.ok(!/dangerouslySetInnerHTML|\.innerHTML\s*=/.test(src), rel(f) + ' injects HTML');
  }
});

scenario('no emoji and no U+2014 or U+2013 in the shell client, route glue or stylesheets', () => {
  for (const f of sourceFiles().concat(cssFiles())) {
    const src = read(f);
    assert.ok(!src.includes(EM) && !src.includes(EN), rel(f) + ' carries a long dash');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src), rel(f) + ' carries an emoji');
  }
});

// ---------- (4) fonts ----------

scenario('fonts.css bundles four families by relative url, display swap, no outside host', () => {
  const css = read(path.join(CLIENT, 'styles', 'fonts.css'));
  assert.ok(!/https?:|\/\//.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'no host and no protocol-relative url');
  const faces = parseCss(css).filter((r) => r.selector === '@font-face');
  assert.ok(faces.length >= 9, 'font faces: ' + faces.length);
  const families = new Set();
  for (const face of faces) {
    families.add(valueOf(face, 'font-family').replace(/['"]/g, ''));
    assert.strictEqual(valueOf(face, 'font-display'), 'swap');
    const url = /url\(([^)]+)\)/.exec(valueOf(face, 'src'))[1];
    assert.ok(url.startsWith('../../node_modules/@fontsource'), 'relative url into the walled package: ' + url);
    const file = path.join(CLIENT, 'styles', url);
    assert.ok(fs.existsSync(file) || !fs.existsSync(path.join(SHELL, 'node_modules')), 'file exists: ' + url);
  }
  assert.deepStrictEqual(Array.from(families).sort(), ['Bodoni Moda', 'DM Sans', 'Fraunces', 'JetBrains Mono']);
  const fraunces = faces.filter((f) => /Fraunces/.test(valueOf(f, 'font-family')));
  assert.ok(fraunces.some((f) => valueOf(f, 'font-style') === 'italic') && fraunces.some((f) => valueOf(f, 'font-style') === 'normal'), 'Fraunces normal and italic');
  assert.ok(fraunces.every((f) => /opsz/.test(valueOf(f, 'src'))), 'Fraunces files carry the opsz axis');
});

scenario('the four font packages are pinned exactly in the walled manifest and lockfile; none in the root manifest', () => {
  const pkg = JSON.parse(read(path.join(SHELL, 'package.json')));
  const lock = JSON.parse(read(path.join(SHELL, 'package-lock.json')));
  for (const name of ['@fontsource-variable/fraunces', '@fontsource-variable/dm-sans', '@fontsource-variable/jetbrains-mono', '@fontsource/bodoni-moda']) {
    assert.match(pkg.dependencies[name] || '', /^\d+\.\d+\.\d+$/, name + ' is an exact pin');
    const entry = lock.packages['node_modules/' + name];
    assert.ok(entry && entry.version === pkg.dependencies[name] && /^sha512-/.test(entry.integrity), name + ' is locked with an integrity hash');
    assert.strictEqual(entry.license, 'OFL-1.1', name + ' licence');
  }
  const rootPkg = JSON.parse(read(path.join(REPO, 'package.json')));
  assert.ok(!JSON.stringify(rootPkg).includes('@fontsource'), 'nothing enters the root package.json');
});

// ---------- (5) behaviour: primitives and frame rendered to markup ----------

const HAVE_NM = fs.existsSync(path.join(SHELL, 'node_modules', 'react', 'package.json')) && fs.existsSync(path.join(SHELL, 'node_modules', 'typescript', 'package.json'));
let R = null; // { ts, load, renderToStaticMarkup, React }
if (HAVE_NM) {
  const shellRequire = createRequire(path.join(SHELL, 'package.json'));
  const ts = shellRequire('typescript');
  const cache = {};
  const load = (file) => {
    file = path.resolve(file);
    if (cache[file]) return cache[file].exports;
    const out = ts.transpileModule(read(file), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: file,
    }).outputText;
    const mod = { exports: {} };
    cache[file] = mod;
    // mos-ui-shared is the walled shared package; Node cannot strip types under node_modules, so its source is
    // loaded from ui/shared/src through the same transpiler (the frame reaches it through the browser-copy provider).
    const req = (spec) => (spec.startsWith('.') ? load(path.resolve(path.dirname(file), spec)) : spec.startsWith('mos-ui-shared/') ? load(path.join(REPO, 'ui', 'shared', 'src', spec.slice('mos-ui-shared/'.length) + '.ts')) : shellRequire(spec));
    new Function('require', 'module', 'exports', out)(req, mod, mod.exports);
    return mod.exports;
  };
  R = { ts, load, React: shellRequire('react'), renderToStaticMarkup: shellRequire('react-dom/server').renderToStaticMarkup };
}
const prim = (name) => R.load(path.join(CLIENT, 'primitives', name + '.tsx'));
const markup = (el) => R.renderToStaticMarkup(el);

if (!R) {
  process.stdout.write('  (behaviour arms skipped: ui/shell/node_modules is absent; run npm ci --install-links --ignore-scripts in ui/shell)\n');
} else {
  const h = R.React.createElement;

  scenario('TileMark: the type makes status required, an empty status throws in development and renders nothing in production (D-11)', () => {
    const src = read(path.join(CLIENT, 'primitives', 'TileMark.tsx'));
    assert.ok(/\bstatus:\s*string;/.test(src) && !/\bstatus\?:/.test(src), 'status is a required string prop');
    assert.ok((src.match(/status/g) || []).length >= 2);
    assert.ok(/data-tile=/.test(src));
    const { TileMark } = prim('TileMark');
    const html = markup(h(TileMark, { tile: 'red', status: 'Challenged' }));
    assert.match(html, /data-tile="red"/);
    assert.ok(html.includes('Challenged'), 'the written status is in the same element');
    assert.match(html, /class="tile-mark"[^>]*aria-hidden="true"/, 'the mark is aria-hidden; the words carry the meaning');
    const before = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      assert.throws(() => markup(h(TileMark, { tile: 'blue', status: '' })), /never renders without its written status/);
      assert.throws(() => markup(h(TileMark, { tile: 'blue', status: '   ' })), /written status/);
      process.env.NODE_ENV = 'production';
      assert.strictEqual(markup(h(TileMark, { tile: 'blue', status: '' })), '', 'nothing rendered in production');
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  scenario('StateMark is aria-hidden; the triangle is an svg; Legend draws the five marks with words and no data-tile', () => {
    const { StateMark } = prim('StateMark');
    for (const shape of ['square', 'circle', 'triangle', 'empty', 'line']) {
      const html = markup(h(StateMark, { shape }));
      assert.match(html, /aria-hidden="true"/);
      assert.match(html, new RegExp('data-mark="' + shape + '"'));
    }
    assert.match(markup(h(StateMark, { shape: 'triangle' })), /<svg/);
    const { Legend } = prim('Legend');
    const html = markup(h(Legend));
    assert.strictEqual((html.match(/<li/g) || []).length, 5);
    for (const words of ['Proposed', 'Challenged or fixed', 'Contradiction', 'Decision', 'Empty or delivered']) assert.ok(html.includes(words), words);
    assert.ok(!/data-tile/.test(html), 'legend marks are not state marks');
  });

  scenario('ActionButton: primary has the triangle and a two-line label; disabled uses aria-disabled and not the attribute; secondary has no marker', () => {
    const { ActionButton } = prim('ActionButton');
    const primary = markup(h(ActionButton, { label: 'Review the next decision', consequence: 'Opens it with its evidence.' }));
    assert.match(primary, /data-variant="primary"/);
    assert.match(primary, /class="ab-label">Review the next decision</);
    assert.match(primary, /class="ab-consequence">Opens it with its evidence\.</);
    assert.match(primary, /data-mark="triangle"[^>]*data-surface="ink"/);
    const disabled = markup(h(ActionButton, { label: 'Approve: Approve as written', consequence: 'Choose an answer first.', state: 'disabled' }));
    assert.match(disabled, /aria-disabled="true"/);
    assert.ok(!/ disabled(=|>| )/.test(disabled), 'never the disabled attribute');
    const saving = markup(h(ActionButton, { label: 'Saving your answer...', state: 'saving' }));
    assert.match(saving, /data-mark="line"/);
    assert.match(saving, /aria-disabled="true"/);
    const done = markup(h(ActionButton, { label: 'Recorded', state: 'success' }));
    assert.match(done, /data-mark="square"/);
    const secondary = markup(h(ActionButton, { label: 'Reject', variant: 'secondary' }));
    assert.match(secondary, /data-variant="secondary"/);
    assert.ok(!/class="sm"/.test(secondary), 'no marker on a secondary action');
    const error = markup(h(ActionButton, { label: 'Approve', state: 'error' }));
    assert.match(error, /data-state="error"/);
  });

  scenario('InlineError renders What, Why, Fix in order; Rule, TextAction and LiveRegion render as the contract says', () => {
    const { InlineError } = prim('InlineError');
    const html = markup(h(InlineError, { what: 'What failed.', why: 'Because.', fix: 'Do this.' }));
    assert.ok(html.indexOf('ie-what') < html.indexOf('ie-why') && html.indexOf('ie-why') < html.indexOf('ie-fix'));
    const { Rule } = prim('Rule');
    assert.match(markup(h(Rule, null, 'body')), /class="reveal-rule"[^>]*aria-hidden="true".*class="reveal-body">body</);
    const { TextAction } = prim('TextAction');
    assert.match(markup(h(TextAction, { href: '/x' }, 'Show all')), /<a class="text-action" href="\/x">Show all<\/a>/);
    assert.match(markup(h(TextAction, null, 'Decide later')), /<button type="button" class="text-action">Decide later<\/button>/);
    const { LiveRegion } = prim('LiveRegion');
    assert.match(markup(h(LiveRegion, { message: 'x' })), /role="status" aria-live="polite"/);
  });

  scenario('ConfirmDialog is a native dialog, renders its actions only while open, labels its heading', () => {
    const { ConfirmDialog } = prim('ConfirmDialog');
    const props = { title: 'Leave this decision unanswered?', body: 'b', primaryLabel: 'Switch to x', secondaryLabel: 'Stay here', onPrimary() {}, onCancel() {} };
    const closed = markup(h(ConfirmDialog, Object.assign({ open: false }, props)));
    assert.match(closed, /<dialog[^>]*aria-labelledby="confirm-title"/);
    assert.ok(!closed.includes('Switch to x'), 'closed dialog adds no second primary action to the page');
    const open = markup(h(ConfirmDialog, Object.assign({ open: true }, props)));
    assert.ok(open.includes('Switch to x') && open.includes('Stay here') && open.includes('<h2'));
    assert.match(open, /data-role="secondary"/);
  });

  scenario('PrimaryNav: Work, Evidence, Decisions, Deliverables, then Graph; /gate belongs to Decisions; waiting is text, never a badge (D-10)', () => {
    const nav = R.load(path.join(CLIENT, 'frame', 'PrimaryNav.tsx'));
    assert.deepStrictEqual(nav.PRIMARY_TABS.map((t) => t.label), ['Work', 'Evidence', 'Decisions', 'Deliverables']);
    assert.deepStrictEqual(nav.SECONDARY_TABS.map((t) => t.label), ['Graph']);
    assert.strictEqual(nav.currentTab('/'), 'work');
    assert.strictEqual(nav.currentTab('/decisions'), 'decisions');
    assert.strictEqual(nav.currentTab('/gate/abc'), 'decisions');
    assert.strictEqual(nav.currentTab('/graph'), 'graph');
    assert.strictEqual(nav.currentTab('/nope'), null);
    const src = read(path.join(CLIENT, 'frame', 'PrimaryNav.tsx'));
    assert.ok(/'Decisions \(' \+ waiting \+ ' waiting\)'/.test(src), 'the waiting count is written in words');
    for (const f of listFiles(path.join(CLIENT, 'frame'), ['.tsx', '.css'])) {
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      assert.ok(!/badge|\bdot\b|bubble/i.test(code), rel(f) + ' draws a badge or a dot');
    }
    assert.ok(/aria-current=\{current === tab\.id \? 'page' : undefined\}/.test(src));
  });

  scenario('ShellFrame markup: the room comes before the wordmark, one live region, one current tab, the nav order, the Status control', () => {
    const { ShellFrame } = R.load(path.join(CLIENT, 'frame', 'ShellFrame.tsx'));
    const html = markup(h(ShellFrame, { port: 3369, pathname: '/decisions' }, h('p', null, 'view body')));
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    assert.ok(header.indexOf('class="sh-room"') > -1 && header.indexOf('class="sh-room"') < header.indexOf('class="wordmark"'), 'the room is the first content item in the header');
    assert.ok(header.indexOf('Room') < header.indexOf('M</span>'), 'the Room label precedes the wordmark text');
    assert.match(header, /aria-label="M:OS, back to Work"/);
    assert.ok(header.indexOf('wordmark') < header.indexOf('Status'), 'Status is last');
    assert.strictEqual((html.match(/role="status"/g) || []).length, 1, 'exactly one live region');
    const labels = Array.from(html.matchAll(/class="pnav-link"[^>]*>([^<]+)</g)).map((m) => m[1]);
    assert.deepStrictEqual(labels, ['Work', 'Evidence', 'Decisions', 'Deliverables', 'Graph']);
    assert.strictEqual((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /aria-current="page"[^>]*>Decisions</);
    assert.ok(html.indexOf('pnav-sep') > html.indexOf('>Deliverables<') && html.indexOf('pnav-sep') < html.indexOf('>Graph<'), 'a rule between the primary tabs and Graph');
    assert.match(html, /<main id="view"[^>]*>.*view body/);
    assert.match(html, /<aside id="status-panel"[^>]*data-open="false"[^>]*inert=""/);
    assert.ok(!/ style=/.test(html), 'no style attribute');
  });

  scenario('SessionIndicator is the interim: three connection words, the INTERIM(plan 24) marker, nothing else (D-04)', () => {
    const copy = R.load(path.join(CLIENT, 'copy.ts'));
    assert.deepStrictEqual(Object.values(copy.CONNECTION_WORDS), ['Connected', 'Reconnecting...', 'Disconnected']);
    const src = read(path.join(CLIENT, 'frame', 'SessionIndicator.tsx'));
    assert.strictEqual(src.split('\n')[0], '// INTERIM(plan 24)');
    assert.ok(/CONNECTION_WORDS\[status\.connection\]/.test(src));
    assert.ok(!/['"`][A-Z][a-z]+(\.\.\.)?['"`]/.test(src.replace(/^\/\/.*$/gm, '')), 'no word of its own beyond the three');
    assert.match(copy.connectionLost(12), /^Lost the connection to the room\. You are looking at the last copy, up to change 12\.$/);
    assert.strictEqual(copy.RECONNECT_NOW, 'Reconnect now');
  });

  scenario('RoomSelector: the leave-a-decision confirmation (T-369-20-03): exact copy, gate_open drives it, the switch retries with confirmLeave', () => {
    const src = read(path.join(CLIENT, 'frame', 'RoomSelector.tsx'));
    assert.strictEqual((src.match(/Leave this decision unanswered\?/g) || []).length, 1);
    assert.ok(src.includes("'Your open decision in ' + current + ' closes when you switch to ' + next + '. Nothing is saved. You can ask Larry for it again in Claude Code.'"));
    assert.ok(src.includes("'Switch to ' + next") && src.includes("secondary: 'Stay here'"));
    assert.ok(/reason === 'gate_open'/.test(src) && /confirmLeave: true/.test(src));
    assert.ok(/role="listbox"/.test(src) && /aria-haspopup="listbox"/.test(src) && /Open now/.test(src));
  });

  scenario('StatusPanel: connection, address, version, MCP session (8 chars), browser copy, last update; Esc and "Close status"; not a modal', () => {
    const src = read(path.join(CLIENT, 'frame', 'StatusPanel.tsx'));
    for (const label of ['Connection', 'Address', 'MindrianOS version', 'MCP session', 'Browser copy', 'Last update', 'Close status']) assert.ok(src.includes(label), label);
    assert.ok(/'127\.0\.0\.1:' \+ port/.test(src) && /'Escape'/.test(src));
    assert.ok(!/showModal|aria-modal/.test(src), 'the panel is not a modal');
  });
}

// ---------- (6) the render arm: the built shell in headless Chromium ----------

const BUILT = fs.existsSync(path.join(STANDALONE, 'server.js'));
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}
async function waitUntil(fn, ms, what) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return; } catch (_e) { /* retry */ }
    if (Date.now() > end) throw new Error('timeout waiting for ' + what);
    await new Promise((r) => setTimeout(r, 100));
  }
}
function httpGet(port, p, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, headers: headers || {} }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end();
  });
}

async function renderArm() {
  const rootNm = path.join(REPO, 'node_modules');
  if (!fs.existsSync(path.join(rootNm, 'next', 'package.json')) || !fs.existsSync(path.join(rootNm, 'react-dom', 'package.json'))) {
    return 'the root node_modules does not carry next and react-dom (run npm ci --ignore-scripts at the repo root)';
  }
  if (!pw.resolvePlaywright()) return 'Playwright is not installed (spike 006 install or a walled dev package)';
  let launched;
  try {
    launched = await pw.launch();
  } catch (e) {
    return 'Chromium could not launch: ' + String(e.message || e).split('\n')[0];
  }
  const { browser } = launched;

  // The ruled shape: a plugin-like tree that reaches only the root node_modules.
  const plugin = path.join(TMP_HOME, 'plugin');
  fs.mkdirSync(path.join(plugin, 'lib', 'ui-shell'), { recursive: true });
  fs.symlinkSync(rootNm, path.join(plugin, 'node_modules'), 'dir');
  const dist = path.join(plugin, 'lib', 'ui-shell', 'dist');
  fs.cpSync(STANDALONE, dist, { recursive: true });

  const daemon = http.createServer((_q, r) => r.end('{}'));
  await new Promise((r) => daemon.listen(0, '127.0.0.1', r));
  const port = await freePort();
  const code = crypto.randomBytes(32).toString('base64url');
  const dataHome = path.join(TMP_HOME, 'live');
  fs.mkdirSync(dataHome, { recursive: true });
  const tokenFile = path.join(dataHome, 'ctl', 'control.token');
  const env = Object.assign({}, process.env, {
    HOME: TMP_HOME, USERPROFILE: TMP_HOME, MINDRIAN_ROOMS_HOME: path.join(TMP_HOME, 'rooms'),
    MOS_DAEMON_URL: 'http://127.0.0.1:' + daemon.address().port, MOS_SHELL_PORT: String(port),
    MOS_SHELL_BOOTSTRAP_SHA256: crypto.createHash('sha256').update(code).digest('hex'), MOS_SHELL_CONTROL_TOKEN_FILE: tokenFile,
    HOSTNAME: '127.0.0.1', PORT: String(port), NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
  });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  const child = spawn(process.execPath, ['server.js'], { cwd: dist, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => { try { child.kill('SIGKILL'); } catch (_e) { /* gone */ } }, 3000).unref();
  });

  const origin = 'http://127.0.0.1:' + port;
  const ROOMS = { ok: true, rooms: [{ slug: 'room-a', purpose: 'The first venture room.' }, { slug: 'room-b', purpose: 'The second room.' }], current: 'room-a' };
  let statusBody = { ok: true, connection: 'connected', lastAckAt: Date.now(), mcpSessionPrefix: 'abcdef0123456789'.slice(0, 8), roomSlug: 'room-a', version: '1.1.0' };
  const seen = { status: 0, openRoom: [] };
  async function mock(page, opts) {
    opts = opts || {};
    await page.route('**/api/status', (route) => {
      seen.status += 1;
      if (opts.abortStatus) return route.abort('connectionrefused');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.status || statusBody) });
    });
    await page.route('**/api/actions/*', async (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
      if (name === 'listRooms') return json(ROOMS);
      if (name === 'listOpenGates') return json({ ok: true, gates: [], waiting: 2 });
      if (name === 'openRoom') {
        const body = JSON.parse(route.request().postData() || '{}');
        seen.openRoom.push(body);
        return body.confirmLeave ? json({ ok: true, room: body.room }) : json({ ok: false, reason: 'gate_open', room: 'room-a' });
      }
      return json({ ok: false, reason: 'unknown' });
    });
  }
  const radiusOffenders = (page) => page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.matches('[data-mark="circle"]')) continue;
      const cs = getComputedStyle(el);
      for (const k of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius']) {
        if (cs[k] !== '0px') bad.push(el.tagName.toLowerCase() + '.' + el.className + ' ' + k + '=' + cs[k]);
      }
    }
    return bad;
  });

  try {
    await waitUntil(async () => fs.existsSync(tokenFile) && (await httpGet(port, '/auth/bootstrap', { 'sec-fetch-site': 'none' })) > 0, 20000, 'the shell to answer');
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const egress = pw.captureEgress(page);
    const violations = [];
    await context.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    });
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await mock(page);
    // window.__csp is per document: read it before every navigation and at the end of the run.
    const collect = async (p) => { violations.push(...(await p.evaluate(() => window.__csp || []))); };
    const go = async (p, url) => { await collect(p); return p.goto(url); };

    await page.goto(origin + '/auth/bootstrap?code=' + encodeURIComponent(code));
    await page.waitForSelector('header.shell-header');

    await ascenario('render: the header leads with the room, the nav reads Work to Graph, one tab is current, the waiting count is words', async () => {
      await page.waitForFunction(() => document.querySelector('.rs-name') && document.querySelector('.rs-name').textContent === 'room-a');
      const firstText = await page.evaluate(() => document.querySelector('header.shell-header').firstElementChild.textContent);
      assert.ok(firstText.startsWith('Room'), 'first header content is the room selector: ' + firstText);
      assert.strictEqual(await page.textContent('.rs-name'), 'room-a');
      const labels = await page.$$eval('.pnav-link', (els) => els.map((e) => e.textContent));
      assert.deepStrictEqual(labels, ['Work', 'Evidence', 'Decisions (2 waiting)', 'Deliverables', 'Graph']);
      assert.strictEqual(await page.$$eval('[aria-current="page"]', (els) => els.length), 1);
      assert.strictEqual(await page.textContent('[aria-current="page"]'), 'Work');
      assert.strictEqual(await page.$$eval('[class*="badge"]', (els) => els.length), 0);
      assert.strictEqual(await page.textContent('.session-indicator'), 'Connected');
      assert.strictEqual(await page.$$eval('[role="status"]', (els) => els.length), 1, 'one live region');
      assert.strictEqual(await page.$$eval('h1', (els) => els.length), 1, 'one H1');
    });

    await ascenario('render: the current tab follows the path; the cobalt bar is drawn under it', async () => {
      await go(page, origin + '/decisions');
      await page.waitForSelector('[aria-current="page"]');
      assert.strictEqual(await page.$$eval('[aria-current="page"]', (els) => els.length), 1);
      assert.match(await page.textContent('[aria-current="page"]'), /^Decisions/);
      const bar = await page.$eval('[aria-current="page"]', (el) => { const cs = getComputedStyle(el, '::after'); return { bg: cs.backgroundColor, h: cs.height }; });
      assert.strictEqual(bar.bg, 'rgb(36, 87, 165)');
      assert.strictEqual(bar.h, '2px');
      const missing = await go(page, origin + '/not-a-view');
      assert.strictEqual(missing.status(), 404, 'a first segment the shell does not serve is a 404');
      assert.strictEqual(await page.textContent('main h1'), 'This page is not part of the workspace.', 'the shell answers with its own 404, not the chassis page');
      assert.ok(!/\sstyle=/.test(await missing.text()), 'no style attribute in the 404 markup (the chassis route announcer sets its own through CSSOM after load, which the CSP allows)');
      await go(page, origin + '/');
      await page.waitForSelector('.rs-name');
    });

    await ascenario('render: the Status panel opens, shows the address and the session, and Esc closes it and returns focus', async () => {
      await page.click('#status-trigger');
      await page.waitForSelector('#status-panel[data-open="true"]');
      const text = await page.textContent('#status-panel');
      assert.ok(text.includes('127.0.0.1:' + port), text);
      assert.ok(text.includes('abcdef01') && text.includes('1.1.0') && text.includes('Connected'), text);
      assert.strictEqual(await page.$eval('#status-panel', (el) => el.hasAttribute('inert')), false);
      assert.ok((await radiusOffenders(page)).length === 0, 'radius 0 with the panel open');
      await page.keyboard.press('Escape');
      await page.waitForSelector('#status-panel[data-open="false"]');
      assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'status-trigger');
      assert.strictEqual(await page.$eval('#status-panel', (el) => el.hasAttribute('inert')), true);
      await page.click('#status-trigger');
      await page.waitForSelector('#status-panel[data-open="true"]');
      await page.click('text=Close status');
      await page.waitForSelector('#status-panel[data-open="false"]');
    });

    await ascenario('render: switching rooms with a decision open shows the confirmation with Stay here focused; Stay sends nothing, Switch sends confirmLeave (T-369-20-03)', async () => {
      await page.click('.rs-trigger');
      await page.waitForSelector('[role="listbox"]');
      assert.strictEqual(await page.$$eval('[role="option"]', (els) => els.length), 2);
      assert.ok((await page.textContent('[role="listbox"]')).includes('Open now'));
      await page.click('[role="option"]:has-text("room-b")');
      await page.waitForSelector('dialog[open]');
      assert.strictEqual(await page.textContent('dialog h2'), 'Leave this decision unanswered?');
      assert.ok((await page.textContent('dialog p')).startsWith('Your open decision in room-a closes when you switch to room-b.'));
      assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.textContent), 'Stay here');
      assert.deepStrictEqual(await radiusOffenders(page), [], 'radius 0 with the dialog open');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      assert.ok(seen.openRoom.every((b) => b.confirmLeave !== true), 'cancelling sends no confirmLeave');
      await page.click('.rs-trigger');
      await page.click('[role="option"]:has-text("room-b")');
      await page.waitForSelector('dialog[open]');
      await page.click('dialog button:has-text("Switch to room-b")');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));
      assert.ok(seen.openRoom.some((b) => b.confirmLeave === true && b.room === 'room-b'), 'the confirmed switch retries with confirmLeave');
    });

    await ascenario('render: computed border radius is 0 on every element except the circle mark', async () => {
      assert.deepStrictEqual(await radiusOffenders(page), []);
    });

    await ascenario('render: the four fonts are drawn and report loaded, from 127.0.0.1 only', async () => {
      await page.evaluate(() => document.fonts.ready);
      const loaded = await page.evaluate(() => Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '') + '/' + f.style));
      for (const family of ['Fraunces', 'DM Sans', 'JetBrains Mono', 'Bodoni Moda']) {
        assert.ok(loaded.some((l) => l.startsWith(family + '/')), family + ' loaded: ' + JSON.stringify(loaded));
      }
      const urls = egress.urls().filter((u) => /\.woff2/.test(u));
      assert.ok(urls.length >= 4 && urls.every((u) => u.startsWith(origin + '/_next/static/media/')), 'font requests: ' + JSON.stringify(urls));
      assert.ok(await page.$('link[rel="preload"][as="font"]'), 'above-the-fold fonts are preloaded');
      const family = await page.$eval('.wordmark', (el) => getComputedStyle(el).fontFamily);
      assert.ok(family.startsWith('"Bodoni Moda"'), 'the wordmark is Bodoni Moda: ' + family);
    });

    await ascenario('render: a lost connection shows the banner and Reconnect now asks again; an unreachable server shows the failure banner and the Status error', async () => {
      const lost = await context.newPage();
      await mock(lost, { status: { ok: true, connection: 'disconnected', lastAckAt: null, mcpSessionPrefix: null, roomSlug: null, version: null } });
      await lost.goto(origin + '/');
      await lost.waitForSelector('[data-banner="connection-lost"]');
      assert.ok((await lost.textContent('[data-banner="connection-lost"]')).startsWith('Lost the connection to the room.'));
      assert.strictEqual(await lost.textContent('.session-indicator'), 'Disconnected');
      const before = seen.status;
      await lost.click('text=Reconnect now');
      await waitUntil(() => seen.status > before, 5000, 'Reconnect now to ask the status again');
      await collect(lost);
      await lost.close();
      const dead = await context.newPage();
      await mock(dead, { abortStatus: true });
      await dead.goto(origin + '/');
      await dead.waitForSelector('[data-banner="failure"]');
      assert.strictEqual(await dead.textContent('[data-banner="failure"]'), 'The workspace cannot reach MindrianOS on this machine.');
      await dead.click('#status-trigger');
      assert.ok((await dead.textContent('#status-panel')).includes('The MindrianOS server is not answering on 127.0.0.1:' + port + '.'));
      assert.ok((await dead.textContent('main h1')).startsWith('The workspace cannot reach MindrianOS'));
      await collect(dead);
      await dead.close();
    });

    await ascenario('render: at 390 px the page does not scroll sideways, with the nav, the selector and the Status panel open', async () => {
      const phone = await context.newPage();
      await phone.setViewportSize({ width: 390, height: 844 });
      await mock(phone);
      await phone.goto(origin + '/decisions');
      await phone.waitForSelector('.rs-name');
      const fits = () => phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      assert.ok(await fits(), 'no horizontal scroll on load');
      await phone.click('.rs-trigger');
      await phone.waitForSelector('[role="listbox"]');
      assert.ok(await fits(), 'no horizontal scroll with the room list open');
      await phone.keyboard.press('Escape');
      await phone.click('#status-trigger');
      await phone.waitForSelector('#status-panel[data-open="true"]');
      assert.ok(await fits(), 'no horizontal scroll with the Status panel open');
      const tab = await phone.$eval('[aria-current="page"]', (el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; });
      assert.ok(tab, 'the current tab is kept in view');
      await collect(phone);
      await phone.close();
    });

    await ascenario('render: zero securitypolicyviolation events and only loopback hosts across the whole run', async () => {
      await collect(page);
      assert.deepStrictEqual(violations, [], 'CSP violations: ' + JSON.stringify(violations));
      assert.deepStrictEqual(consoleErrors.filter((t) => /Content Security Policy/i.test(t)), [], 'CSP console errors');
      pw.assertOnlyLoopback(egress);
    });

    await context.close();
  } finally {
    await browser.close();
    await stop();
    await new Promise((r) => daemon.close(r));
    if (failed) process.stdout.write('\n--- shell log (tail) ---\n' + log.split('\n').slice(-12).join('\n') + '\n');
  }
  return null;
}

async function main() {
  let gap = null;
  if (!BUILT) gap = 'the shell is not built (cd ui/shell && npm run build)';
  else gap = await renderArm();
  fs.rmSync(TMP_HOME, { recursive: true, force: true });
  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  if (failed) process.exit(1);
  if (gap) {
    process.stdout.write('ENV GAP: ' + gap + '; the render arm did not run (exit 77)\n');
    process.exit(77);
  }
  process.exit(0);
}

main().catch((e) => {
  process.stdout.write('FATAL ' + (e.stack || e.message || e) + '\n');
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.exit(1);
});
