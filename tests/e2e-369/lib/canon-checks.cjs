'use strict';
/*
 * tests/e2e-369/lib/canon-checks.cjs -- Phase 369-29 (CANON369-07): the computable rules of Design Canon v3 as
 * library functions, so the e2e measures the built shell instead of eyeballing it (Canon s4, UI-SPEC "CANON369
 * Automated Checks"). CJS, built-ins only, no new dependency.
 *
 *   TOKEN_HEXES                 the eleven UI-SPEC colour tokens ({ name, hex }), the only colours the shell may use
 *   relativeLuminance(rgb)      WCAG 2.x relative luminance of [r, g, b] (0-255)
 *   contrastRatio(fg, bg)       WCAG 2.x contrast ratio of two [r, g, b] colours
 *   selfTest()                  the calibration: the canon's own measured pairs must come out of contrastRatio
 *   walkTextContrast(page)      every text-bearing element: computed colour over the nearest opaque background,
 *                               violations below 4.5:1 (3:1 for 24 px and larger, or 18.66 px bold and larger)
 *   radiusViolations(page)      every element (and ::before, ::after) whose computed border radius is not 0px,
 *                               except [data-mark="circle"]
 *   ochreViolations(page)       ochre as text, and ochre fills or borders on a paper surface with no 1 px ink outline
 *   colourViolations(css, file) colour literals in built CSS that are not a token (or a color-mix of tokens)
 *   computedColourViolations    every colour a rendered element actually uses is a token colour
 *   countPerView(page)          h1, primary action, circle mark and ochre triangle counts
 *   tileViolations(page)        [data-tile] elements whose row text or accessible name lacks the written status
 *   runningAnimations(page)     animations still running that last longer than 0.01 ms
 *   iframeViolations(page, origin)  iframes whose src is not same-origin
 *
 * Page-side code runs as a string expression through page.evaluate, so it needs no eval in the page and the
 * shell's Content-Security-Policy is never asked to allow anything. Every violation carries a CSS path, or a
 * file, line and column, so a failing check names its offender. Hyphens only; no em-dashes or en-dashes.
 */

const TOKEN_HEXES = [
  { name: '--paper', hex: '#F5F0E6' },
  { name: '--paper-deep', hex: '#E9DFCF' },
  { name: '--paper-light', hex: '#FCF9F2' },
  { name: '--ink', hex: '#14202B' },
  { name: '--ink-soft', hex: '#46535D' },
  { name: '--line', hex: '#14202B' },
  { name: '--rust', hex: '#A8462D' },
  { name: '--cobalt', hex: '#2457A5' },
  { name: '--ochre', hex: '#D49A20' },
  { name: '--success', hex: '#2F6849' },
  { name: '--error', hex: '#A12E2E' },
];

const TOKEN_HEX_SET = new Set(TOKEN_HEXES.map((t) => t.hex.toLowerCase()));
const TOKEN_NAME_SET = new Set(TOKEN_HEXES.map((t) => t.name));
const TOKEN_RGB_SET = new Set(
  TOKEN_HEXES.map((t) => {
    const h = t.hex.slice(1);
    return parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
  })
);
const OCHRE_RGB = 'rgb(212, 154, 32)';

function hexToRgb(hex) {
  let h = String(hex).replace('#', '').toLowerCase();
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function asRgb(c) {
  if (Array.isArray(c)) return c;
  if (c && typeof c === 'object') return [c.r, c.g, c.b];
  throw new Error('not a colour: ' + String(c));
}

// ---------------------------------------------------------------------------------------------
// WCAG 2.x
// ---------------------------------------------------------------------------------------------

function relativeLuminance(rgb) {
  const [r, g, b] = asRgb(rgb).map((v) => {
    const s = Math.max(0, Math.min(255, v)) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

// Colour strings the browser reports: rgb(), rgba(), color(srgb ...), transparent.
function parseColor(s) {
  if (s === undefined || s === null) return null;
  const t = String(s).trim().toLowerCase();
  if (t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const num = (tok, scale) => (tok.endsWith('%') ? (parseFloat(tok) / 100) * scale : parseFloat(tok));
  let m = t.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    if (p.length < 3) return null;
    return { r: num(p[0], 255), g: num(p[1], 255), b: num(p[2], 255), a: p.length > 3 ? num(p[3], 1) : 1 };
  }
  m = t.match(/^color\(srgb\s+([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s/]+/).filter(Boolean);
    if (p.length < 3) return null;
    return { r: num(p[0], 1) * 255, g: num(p[1], 1) * 255, b: num(p[2], 1) * 255, a: p.length > 3 ? num(p[3], 1) : 1 };
  }
  return null;
}

function over(top, under) {
  const a = top.a;
  return {
    r: top.r * a + under.r * (1 - a),
    g: top.g * a + under.g * (1 - a),
    b: top.b * a + under.b * (1 - a),
    a: 1,
  };
}

// chain: background-color strings from the element up to the root (nearest first). Layers are composited
// from the nearest opaque one outward; a page with none is the browser's white canvas.
function compositeBackground(chain) {
  const layers = [];
  for (const s of chain) {
    const c = parseColor(s);
    if (!c) return null;
    if (c.a <= 0) continue;
    layers.push(c);
    if (c.a >= 0.999) break;
  }
  let result = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = layers.length - 1; i >= 0; i -= 1) result = over(layers[i], result);
  return result;
}

const round2 = (n) => Math.round(n * 100) / 100;

// The canon's own measured pairs (UI-SPEC Color table; Canon s4). The walker is only as good as this.
function selfTest() {
  const pairs = [
    ['ink on paper', '#14202B', '#F5F0E6', 14.5],
    ['ink-soft on paper', '#46535D', '#F5F0E6', 7.0],
    ['ink-soft on paper-deep', '#46535D', '#E9DFCF', 6.0],
    ['paper-light on ink', '#FCF9F2', '#14202B', 15.7],
    ['ochre on ink', '#D49A20', '#14202B', 6.6],
    ['ochre on paper', '#D49A20', '#F5F0E6', 2.2],
    ['ochre on paper-deep', '#D49A20', '#E9DFCF', 1.9],
    ['rust on paper', '#A8462D', '#F5F0E6', 5.2],
    ['cobalt on paper', '#2457A5', '#F5F0E6', 6.2],
    ['success on paper', '#2F6849', '#F5F0E6', 5.8],
    ['error on paper', '#A12E2E', '#F5F0E6', 6.3],
  ];
  const lines = [];
  let ok = true;
  for (const [name, fg, bg, expected] of pairs) {
    const got = round2(contrastRatio(hexToRgb(fg), hexToRgb(bg)));
    const good = Math.abs(got - expected) <= 0.3;
    if (!good) ok = false;
    lines.push((good ? 'ok   ' : 'FAIL ') + name + ' measured ' + got + ' (canon ' + expected + ')');
  }
  return { ok, lines };
}

// ---------------------------------------------------------------------------------------------
// Page-side code. pageKit is serialised with toString and runs in the page; it must stay self-contained.
// ---------------------------------------------------------------------------------------------

function pageKit() {
  function pathOf(el) {
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 5; depth += 1) {
      let seg = cur.tagName.toLowerCase();
      if (cur.id) seg += '#' + cur.id;
      const cls = typeof cur.className === 'string' ? cur.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
      if (cls.length) seg += '.' + cls.join('.');
      const mark = cur.getAttribute && (cur.getAttribute('data-mark') || cur.getAttribute('data-tile'));
      if (mark) seg += '[' + (cur.getAttribute('data-mark') ? 'data-mark' : 'data-tile') + '=' + mark + ']';
      parts.unshift(seg);
      if (cur.id) break;
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }
  function parse(s) {
    const t = String(s || '').trim().toLowerCase();
    if (t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    let m = t.match(/^rgba?\(([^)]+)\)$/);
    const val = (tok, scale) => (tok.endsWith('%') ? (parseFloat(tok) / 100) * scale : parseFloat(tok));
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean);
      return { r: val(p[0], 255), g: val(p[1], 255), b: val(p[2], 255), a: p.length > 3 ? val(p[3], 1) : 1 };
    }
    m = t.match(/^color\(srgb\s+([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[\s/]+/).filter(Boolean);
      return { r: val(p[0], 1) * 255, g: val(p[1], 1) * 255, b: val(p[2], 1) * 255, a: p.length > 3 ? val(p[3], 1) : 1 };
    }
    return null;
  }
  function visible(el) {
    if (!el.getClientRects || el.getClientRects().length === 0) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse' || cs.display === 'none') return false;
    if (parseFloat(cs.fontSize) === 0) return false;
    const r = el.getBoundingClientRect();
    // The visually hidden pattern (one pixel, clipped) is not painted text.
    if (r.width <= 1 && r.height <= 1 && cs.overflow !== 'visible') return false;
    return true;
  }
  function hasOwnText(el) {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim() !== '') return true;
    }
    return false;
  }
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'HEAD', 'META', 'LINK']);
  function allElements() {
    return Array.from(document.querySelectorAll('*')).filter((e) => !SKIP.has(e.tagName) && !e.closest('head'));
  }
  function surfaceRgb(el, inclusive) {
    let cur = inclusive ? el : el.parentElement;
    while (cur) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a >= 0.999) return Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b);
      cur = cur.parentElement;
    }
    return '255,255,255';
  }
  return { pathOf, parse, visible, hasOwnText, allElements, surfaceRgb, SKIP };
}

function inPage(bodyFn, arg) {
  return (
    '(function(){ const K = (' + pageKit.toString() + ')(); return (' + bodyFn.toString() + ')(K, ' +
    JSON.stringify(arg === undefined ? null : arg) + '); })()'
  );
}

// ---- C5: text contrast ----

function collectTextRuns(K) {
  const bgCache = new Map();
  function chainFor(el) {
    if (bgCache.has(el)) return bgCache.get(el);
    const own = getComputedStyle(el).backgroundColor;
    const parent = el.parentElement ? chainFor(el.parentElement) : [];
    const chain = [own].concat(parent);
    bgCache.set(el, chain);
    return chain;
  }
  function opacityOf(el) {
    let o = 1;
    for (let cur = el; cur; cur = cur.parentElement) o *= parseFloat(getComputedStyle(cur).opacity);
    return o;
  }
  function gradientAbove(el) {
    for (let cur = el; cur; cur = cur.parentElement) {
      const bi = getComputedStyle(cur).backgroundImage;
      if (bi && bi !== 'none') return K.pathOf(cur) + ' background-image: ' + bi.slice(0, 80);
    }
    return null;
  }
  const runs = [];
  for (const el of K.allElements()) {
    if (!K.hasOwnText(el) || !K.visible(el)) continue;
    const cs = getComputedStyle(el);
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue.trim())
      .join(' ')
      .slice(0, 40);
    runs.push({
      path: K.pathOf(el),
      text,
      color: cs.color,
      fontSize: parseFloat(cs.fontSize),
      fontWeight: parseInt(cs.fontWeight, 10) || 400,
      opacity: opacityOf(el),
      chain: chainFor(el),
      image: gradientAbove(el),
    });
  }
  return runs;
}

function evaluateTextRuns(runs) {
  const out = [];
  for (const r of runs) {
    const large = r.fontSize >= 24 || (r.fontSize >= 18.66 && r.fontWeight >= 700);
    const need = large ? 3 : 4.5;
    if (r.image) {
      out.push({ path: r.path, text: r.text, reason: 'text over a background image or gradient cannot be measured: ' + r.image });
      continue;
    }
    const fg = parseColor(r.color);
    const bg = compositeBackground(r.chain);
    if (!fg || !bg) {
      out.push({ path: r.path, text: r.text, reason: 'unparseable colour ' + r.color + ' over ' + r.chain.slice(0, 2).join(' | ') });
      continue;
    }
    const alpha = Math.max(0, Math.min(1, fg.a * r.opacity));
    const eff = over({ r: fg.r, g: fg.g, b: fg.b, a: alpha }, bg);
    const ratio = round2(contrastRatio(eff, bg));
    if (ratio < need) {
      out.push({
        path: r.path,
        text: r.text,
        ratio,
        need,
        size: r.fontSize,
        weight: r.fontWeight,
        reason: 'contrast ' + ratio + ':1 is below ' + need + ':1 (' + r.color + ' on rgb(' + Math.round(bg.r) + ', ' + Math.round(bg.g) + ', ' + Math.round(bg.b) + '), ' + r.fontSize + 'px/' + r.fontWeight + ')',
      });
    }
  }
  return out;
}

// Measures every text run. Returns { count, lowest, violations }: how many runs were measured, the run with the
// least headroom over its own requirement (ratio, need, path), and the violations.
async function measureTextContrast(page) {
  const runs = await page.evaluate(inPage(collectTextRuns));
  const violations = evaluateTextRuns(runs);
  let lowest = null;
  for (const r of runs) {
    if (r.image) continue;
    const fg = parseColor(r.color);
    const bg = compositeBackground(r.chain);
    if (!fg || !bg) continue;
    const eff = over({ r: fg.r, g: fg.g, b: fg.b, a: Math.max(0, Math.min(1, fg.a * r.opacity)) }, bg);
    const ratio = contrastRatio(eff, bg);
    const need = r.fontSize >= 24 || (r.fontSize >= 18.66 && r.fontWeight >= 700) ? 3 : 4.5;
    if (!lowest || ratio / need < lowest.ratio / lowest.need) lowest = { ratio: round2(ratio), need, path: r.path, text: r.text };
  }
  return { count: runs.length, lowest, violations };
}

async function walkTextContrast(page) {
  return (await measureTextContrast(page)).violations;
}

// ---- C3: radius ----

function collectRadius(K) {
  const props = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'];
  const bad = [];
  function check(el, pseudo) {
    const cs = getComputedStyle(el, pseudo || null);
    if (pseudo && (cs.content === 'none' || cs.content === 'normal')) return;
    const off = props.filter((p) => !/^0(px)?(\s+0(px)?)?$/.test(cs[p]));
    if (off.length) bad.push({ path: K.pathOf(el) + (pseudo || ''), radius: off.map((p) => p + ': ' + cs[p]).join('; ') });
  }
  for (const el of K.allElements()) {
    if (el.matches('[data-mark="circle"]')) continue;
    check(el, null);
    check(el, '::before');
    check(el, '::after');
  }
  return bad;
}
async function radiusViolations(page) {
  return page.evaluate(inPage(collectRadius));
}

// ---- C4: ochre law ----

function collectOchre(K) {
  const OCHRE = [212, 154, 32];
  const INK = [20, 32, 43];
  const isOchre = (s) => {
    const c = K.parse(s);
    return !!c && c.a > 0 && Math.round(c.r) === OCHRE[0] && Math.round(c.g) === OCHRE[1] && Math.round(c.b) === OCHRE[2];
  };
  const isInk = (s) => {
    const c = K.parse(s);
    return !!c && c.a > 0.5 && Math.round(c.r) === INK[0] && Math.round(c.g) === INK[1] && Math.round(c.b) === INK[2];
  };
  const onInk = (rgbKey) => rgbKey === INK.join(',');
  const bad = [];
  function inkBorder(cs) {
    const sides = ['Top', 'Right', 'Bottom', 'Left'];
    const allBorder = sides.every((s) => parseFloat(cs['border' + s + 'Width']) >= 1 && cs['border' + s + 'Style'] !== 'none' && isInk(cs['border' + s + 'Color']));
    const outline = parseFloat(cs.outlineWidth) >= 1 && cs.outlineStyle !== 'none' && isInk(cs.outlineColor);
    return allBorder || outline;
  }
  function check(el, pseudo) {
    const cs = getComputedStyle(el, pseudo || null);
    if (pseudo && (cs.content === 'none' || cs.content === 'normal')) return;
    const where = K.pathOf(el) + (pseudo || '');
    if (!pseudo && K.hasOwnText(el) && K.visible(el) && isOchre(cs.color)) {
      bad.push({ path: where, reason: 'ochre text: color ' + cs.color });
    }
    const surface = K.surfaceRgb(el, !!pseudo);
    if (isOchre(cs.backgroundColor) && !onInk(surface) && !inkBorder(cs)) {
      bad.push({ path: where, reason: 'ochre fill on a paper surface (rgb ' + surface + ') without a 1px ink outline' });
    }
    const borderOchre = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none' && isOchre(cs['border' + s + 'Color']));
    if (borderOchre && !onInk(surface)) bad.push({ path: where, reason: 'ochre border on a paper surface (rgb ' + surface + ')' });
    if (!pseudo && el instanceof SVGElement) {
      if (isOchre(cs.fill) && !onInk(surface)) {
        const stroked = isInk(cs.stroke) && parseFloat(cs.strokeWidth) >= 1;
        if (!stroked) bad.push({ path: where, reason: 'ochre svg fill on a paper surface (rgb ' + surface + ') without a 1px ink stroke' });
      }
      if (isOchre(cs.stroke) && parseFloat(cs.strokeWidth) > 0 && !onInk(surface)) {
        bad.push({ path: where, reason: 'ochre svg stroke on a paper surface (rgb ' + surface + ')' });
      }
    }
  }
  for (const el of K.allElements()) {
    check(el, null);
    check(el, '::before');
    check(el, '::after');
  }
  return bad;
}
async function ochreViolations(page) {
  return page.evaluate(inPage(collectOchre));
}

// ---- C9: colours, static (built CSS) and computed (what is drawn) ----

const NAMED_COLOURS = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan ' +
  'darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey ' +
  'darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink ' +
  'indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen ' +
  'lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
  'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise ' +
  'palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray ' +
  'slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
).split(' ');
const NAMED_RE = new RegExp('(^|[^-\\w])(' + NAMED_COLOURS.join('|') + ')(?![-\\w])', 'i');
const COLOUR_PROPS = /^(color|background|background-color|border(-[a-z]+)*|outline(-[a-z]+)*|fill|stroke|text-decoration(-color)?|caret-color|accent-color|column-rule(-color)?|box-shadow|text-shadow|scrollbar-color|-webkit-tap-highlight-color|-webkit-text-fill-color|-webkit-text-stroke(-color)?)$/;

function isTokenColourHex(h) {
  const t = h.toLowerCase();
  const rgb = hexToRgb(t);
  if (t.length === 5 || t.length === 9) {
    // #rgba and #rrggbbaa: the alpha channel may vary, the colour channels must be a token (or fully transparent).
    const a = t.length === 5 ? t[4] + t[4] : t.slice(7, 9);
    if (parseInt(a, 16) === 0) return true;
  }
  return TOKEN_RGB_SET.has(rgb.join(','));
}

// Returns [{ file, line, col, literal, reason }]. Declarations only (the innermost { } blocks); url(...) is skipped.
function colourViolations(cssText, file) {
  const text = String(cssText).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const out = [];
  const lineStarts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') lineStarts.push(i + 1);
  const where = (offset) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - lineStarts[lo] + 1 };
  };
  const blockRe = /\{([^{}]*)\}/g;
  let bm;
  while ((bm = blockRe.exec(text))) {
    const bodyStart = bm.index + 1;
    const body = bm[1];
    let cursor = 0;
    for (const decl of body.split(';')) {
      const declOffset = bodyStart + cursor;
      cursor += decl.length + 1;
      const colon = decl.indexOf(':');
      if (colon < 0) continue;
      const prop = decl.slice(0, colon).trim().toLowerCase();
      let value = decl.slice(colon + 1);
      const isCustom = prop.startsWith('--');
      if (!isCustom && !COLOUR_PROPS.test(prop)) continue;
      const valueOffset = declOffset + colon + 1;
      value = value.replace(/url\([^)]*\)/gi, (m) => ' '.repeat(m.length));
      const report = (idx, literal, reason) => {
        const w = where(valueOffset + idx);
        out.push({ file, line: w.line, col: w.col, literal, reason: reason + ' (in ' + prop + ')' });
      };
      // color-mix(): every colour argument must be a token (var, hex) or transparent.
      let rest = value;
      const mixRe = /color-mix\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;
      let mm;
      const mixSpans = [];
      while ((mm = mixRe.exec(value))) {
        mixSpans.push([mm.index, mm.index + mm[0].length]);
        const args = mm[1].split(',').slice(1);
        for (const a of args) {
          const v = a.trim().replace(/\s+\d+(\.\d+)?%$/, '').trim();
          const okArg = /^transparent$/i.test(v) || (/^var\(\s*(--[a-z-]+)\s*\)$/i.test(v) && TOKEN_NAME_SET.has(v.replace(/^var\(\s*/i, '').replace(/\s*\)$/, ''))) || (/^#[0-9a-f]{3,8}$/i.test(v) && isTokenColourHex(v));
          if (!okArg) report(mm.index, mm[0].slice(0, 80), 'color-mix with a non-token colour "' + v + '"');
        }
      }
      for (const [s, e] of mixSpans) rest = rest.slice(0, s) + ' '.repeat(e - s) + rest.slice(e);
      const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
      let hm;
      while ((hm = hexRe.exec(rest))) {
        if (![4, 5, 7, 9].includes(hm[0].length)) continue;
        if (!isTokenColourHex(hm[0])) report(hm.index, hm[0], 'colour ' + hm[0] + ' is not one of the eleven tokens');
      }
      const fnRe = /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
      let fm;
      while ((fm = fnRe.exec(rest))) report(fm.index, fm[0] + '...', 'colour function ' + fm[1] + '() is not a token');
      if (!isCustom) {
        const named = rest.replace(/var\([^)]*\)/gi, (m) => ' '.repeat(m.length)).match(NAMED_RE);
        if (named) report(rest.toLowerCase().indexOf(named[2].toLowerCase()), named[2], 'named colour ' + named[2] + ' is not a token');
      }
    }
  }
  return out;
}

function collectComputedColours(K) {
  const found = new Map();
  function note(path, what, value) {
    const key = what + ' ' + value;
    if (!found.has(key)) found.set(key, { path, what, value, count: 0 });
    found.get(key).count += 1;
  }
  for (const el of K.allElements()) {
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
      const path = K.pathOf(el) + (pseudo || '');
      const props = [['color', cs.color], ['background-color', cs.backgroundColor]];
      for (const s of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none') props.push(['border-' + s.toLowerCase() + '-color', cs['border' + s + 'Color']]);
      }
      if (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none') props.push(['outline-color', cs.outlineColor]);
      if (cs.boxShadow && cs.boxShadow !== 'none') props.push(['box-shadow', cs.boxShadow]);
      if (!pseudo && el instanceof SVGElement) {
        if (cs.fill && cs.fill !== 'none') props.push(['fill', cs.fill]);
        if (cs.stroke && cs.stroke !== 'none') props.push(['stroke', cs.stroke]);
      }
      for (const [what, value] of props) {
        if (what === 'box-shadow') {
          note(path, what, value);
          continue;
        }
        const c = K.parse(value);
        if (!c) {
          note(path, what + ' (unparseable)', value);
          continue;
        }
        if (c.a <= 0) continue;
        note(path, what, Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b));
      }
    }
  }
  return Array.from(found.values());
}

// Every colour a rendered element draws with is a token colour (an alpha blend of a token keeps its rgb).
async function computedColourViolations(page) {
  const found = await page.evaluate(inPage(collectComputedColours));
  const bad = [];
  for (const f of found) {
    if (f.what === 'box-shadow') {
      // The focus ring's ink edge is the one shadow the canon allows; anything else is out.
      const colours = f.value.match(/rgba?\([^)]*\)|color\([^)]*\)/g) || [];
      const nonToken = colours.filter((c) => {
        const p = parseColor(c);
        return p && p.a > 0 && !TOKEN_RGB_SET.has(Math.round(p.r) + ',' + Math.round(p.g) + ',' + Math.round(p.b));
      });
      if (nonToken.length) bad.push({ path: f.path, reason: 'box-shadow uses a non-token colour: ' + f.value.slice(0, 80) });
      continue;
    }
    if (/unparseable/.test(f.what)) {
      bad.push({ path: f.path, reason: f.what + ': ' + f.value });
      continue;
    }
    if (!TOKEN_RGB_SET.has(f.value)) bad.push({ path: f.path, reason: f.what + ' rgb(' + f.value + ') is not a token colour (' + f.count + ' uses)' });
  }
  return bad;
}

// ---- C8: counts per view ----

function collectCounts(K) {
  const OCHRE = [212, 154, 32];
  const triangles = new Set();
  for (const el of document.querySelectorAll('[data-mark="triangle"]')) triangles.add(el);
  for (const el of document.querySelectorAll('svg, svg *')) {
    const c = K.parse(getComputedStyle(el).fill);
    if (c && c.a > 0 && Math.round(c.r) === OCHRE[0] && Math.round(c.g) === OCHRE[1] && Math.round(c.b) === OCHRE[2]) {
      triangles.add(el.closest('[data-mark="triangle"]') || el);
    }
  }
  return {
    h1: document.querySelectorAll('h1').length,
    primary: document.querySelectorAll('.ab[data-variant="primary"]').length,
    circle: document.querySelectorAll('[data-mark="circle"]').length,
    triangle: triangles.size,
  };
}
async function countPerView(page) {
  return page.evaluate(inPage(collectCounts));
}

// ---- C7: tiles carry their words ----

function collectTiles(K) {
  const bad = [];
  function nameOf(el) {
    if (el.getAttribute('aria-hidden') === 'true') return '';
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    let s = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) s += n.nodeValue;
      else if (n.nodeType === 1) s += ' ' + nameOf(n);
    }
    return s.replace(/\s+/g, ' ').trim();
  }
  for (const el of document.querySelectorAll('[data-tile]')) {
    const status = ((el.querySelector('.tile-status') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    const path = K.pathOf(el);
    if (!status) {
      bad.push({ path, reason: 'tile with no written status' });
      continue;
    }
    const name = nameOf(el);
    if (name.toLowerCase().indexOf(status.toLowerCase()) === -1) bad.push({ path, reason: 'accessible name "' + name + '" lacks the status "' + status + '"' });
    const row = el.closest('li, tr, [role="row"], .item-row, .gate-subject, .legend') || el.parentElement;
    const rowText = ((row && row.innerText) || '').replace(/\s+/g, ' ');
    if (rowText.toLowerCase().indexOf(status.toLowerCase()) === -1) bad.push({ path, reason: 'its row does not carry the status "' + status + '"' });
    const mark = el.querySelector('.tile-mark');
    if (mark && mark.getAttribute('aria-hidden') !== 'true') bad.push({ path, reason: 'the mark is not aria-hidden' });
  }
  return bad;
}
async function tileViolations(page) {
  return page.evaluate(inPage(collectTiles));
}

// ---- C10: animations ----

function collectAnimations(K) {
  return document
    .getAnimations()
    .filter((a) => {
      if (a.playState !== 'running') return false;
      const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
      const active = t ? t.activeDuration : Infinity;
      return !(typeof active === 'number' && active <= 0.01);
    })
    .map((a) => {
      const t = a.effect.getComputedTiming();
      const target = a.effect && a.effect.target;
      return {
        path: target && target.nodeType === 1 ? K.pathOf(target) : '(no target)',
        name: a.animationName || a.transitionProperty || a.constructor.name,
        activeDuration: String(t.activeDuration),
      };
    });
}
async function runningAnimations(page) {
  return page.evaluate(inPage(collectAnimations));
}

// ---- C1: iframes ----

function collectIframes(K, origin) {
  return Array.from(document.querySelectorAll('iframe, frame, embed, object'))
    .map((el) => ({ path: K.pathOf(el), src: el.getAttribute('src') || el.getAttribute('data') || '' }))
    .filter((f) => {
      if (!f.src) return false;
      try {
        return new URL(f.src, location.href).origin !== origin;
      } catch (_e) {
        return true;
      }
    });
}
async function iframeViolations(page, origin) {
  return page.evaluate(inPage(collectIframes, origin));
}

module.exports = {
  TOKEN_HEXES,
  TOKEN_HEX_SET,
  OCHRE_RGB,
  hexToRgb,
  parseColor,
  relativeLuminance,
  contrastRatio,
  compositeBackground,
  selfTest,
  measureTextContrast,
  walkTextContrast,
  evaluateTextRuns,
  radiusViolations,
  ochreViolations,
  colourViolations,
  computedColourViolations,
  countPerView,
  tileViolations,
  runningAnimations,
  iframeViolations,
};
