// Phase 369.26 plan 02: the copy deck equals UI-SPEC section 9, row for row, and obeys the copy rules.
//
// The contract is the UI-SPEC "9. Copy deck" tables. The deck is ui/mindrian-workspace-mod/src/copy/deck.ts
// (erasable TypeScript; this guard reads it as text, so it needs no compiler). Arms:
//   A1 the spec parses: the section 9 tables yield (id, text) pairs, B67 is described, the retired ids are found
//   A2 parity: the deck holds exactly those ids with exactly those texts (names the first missing, extra or differing id)
//   A3 the retired ids (B31, B81, D20, D21, D22) are absent from the deck
//   A4 copy rules: no em-dash, en-dash, ICM, command name, file name, code or node id; never "Brain" or "Theo"
//   A5 placeholders are lowercase letters only and the set per id equals the spec's
//   A6 mutation: a spec copy with one string changed makes the parity comparison fail
//   A7 text.ts exists and keeps the two error shapes (missing_copy_data, unexpected_copy_data)
//
// One recorded normalisation: the spec writes the P63 placeholder as the prose "{B40, B41, B42 or B43}" (it
// stands for one of four deck strings); the deck names it {state}. Any spec placeholder that is not lowercase
// letters is read as {state}.
//
// Hermetic and read-only. Plain counters, nonzero exit tail, exit 77 only when the UI-SPEC file is absent.
// Hyphens only: the dash characters are built at run time.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PHASE = path.join(REPO, '.planning', 'phases', '369.26-mindrian-workspace-mod-an-orientation-band-and-docked-review');
const SPEC = path.join(PHASE, '369.26-UI-SPEC.md');
const DECK = path.join(REPO, 'ui', 'mindrian-workspace-mod', 'src', 'copy', 'deck.ts');
const TEXT = path.join(REPO, 'ui', 'mindrian-workspace-mod', 'src', 'copy', 'text.ts');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const DOT = ' ' + String.fromCharCode(0x00b7) + ' ';
const EXPECTED_RETIRED = ['B31', 'B81', 'B83', 'D20', 'D21', 'D22'];
const ID_RE = /^[BPDLHXQMNE][0-9]{2,3}$/;

if (!fs.existsSync(SPEC)) {
  process.stdout.write('SKIPPED (ENV GAP): UI-SPEC not found at ' + SPEC + '\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + String(err.message || err).split('\n').slice(0, 8).join('\n    ') + '\n');
}
function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- spec parser ----------
function parseSpec(markdown) {
  const start = markdown.indexOf('## 9. Copy deck');
  const end = markdown.indexOf('## 10.', start);
  if (start < 0 || end < 0) throw new Error('section 9 headings not found in the UI-SPEC');
  const lines = markdown.slice(start, end).split('\n');
  const pairs = new Map();
  const retired = [];
  let b67Described = false;
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const idCell = cells[0];
    const text = cells[1];
    if (text.startsWith('(retired')) {
      for (const id of idCell.split(',').map((s) => s.trim())) if (ID_RE.test(id)) retired.push(id);
      continue;
    }
    if (!ID_RE.test(idCell)) continue;
    if (idCell === 'B67') {
      b67Described = /middle dot/.test(text);
      pairs.set('B67', DOT);
      continue;
    }
    pairs.set(idCell, normalisePlaceholders(text));
  }
  return { pairs, retired, b67Described };
}

function normalisePlaceholders(text) {
  return text.replace(/\{([^}]*)\}/g, (m, inner) => (/^[a-z]+$/.test(inner) ? m : '{state}'));
}

// ---------- deck reader (text, no compiler) ----------
function unescapeJs(body) {
  return body.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\(.)/g, (m, cp, u4, ch) => {
    if (cp) return String.fromCodePoint(parseInt(cp, 16));
    if (u4) return String.fromCharCode(parseInt(u4, 16));
    return ch;
  });
}

function readDeck() {
  if (!fs.existsSync(DECK)) return null;
  const src = fs.readFileSync(DECK, 'utf8');
  const map = new Map();
  const dupes = [];
  const lineRe = /^\s*'([A-Z][0-9]{2,3})':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,?\s*$/gm;
  let m;
  while ((m = lineRe.exec(src)) !== null) {
    if (map.has(m[1])) dupes.push(m[1]);
    map.set(m[1], unescapeJs(m[2] !== undefined ? m[2] : m[3]));
  }
  map.dupes = dupes;
  return map;
}

// Compare the spec pairs to a deck map; returns problem strings (empty means parity).
function compare(specPairs, deck) {
  const problems = [];
  for (const [id, text] of specPairs) {
    if (!deck.has(id)) problems.push('missing in deck: ' + id);
    else if (deck.get(id) !== text) problems.push('differs: ' + id + ' deck=' + JSON.stringify(deck.get(id)) + ' spec=' + JSON.stringify(text));
  }
  for (const id of deck.keys()) if (!specPairs.has(id)) problems.push('extra in deck: ' + id);
  if (deck.dupes && deck.dupes.length) problems.push('duplicate ids in deck: ' + deck.dupes.join(', '));
  return problems;
}

const placeholdersOf = (text) => (text.match(/\{[^}]*\}/g) || []).map((p) => p.slice(1, -1)).sort();

const specSrc = fs.readFileSync(SPEC, 'utf8');
let spec = null;
let specErr = null;
try { spec = parseSpec(specSrc); } catch (e) { specErr = e; }
const deck = readDeck();

process.stdout.write('369.26 copy deck guard\n');

// A1
scenario('A1 the UI-SPEC section 9 tables parse into id and text pairs', () => {
  if (specErr) throw specErr;
  check(spec.pairs.size >= 150, 'expected at least 150 spec ids, found ' + spec.pairs.size);
  for (const id of ['B01', 'B10', 'B67', 'P33', 'D24', 'L01', 'H22', 'X04', 'Q07', 'M04', 'N06', 'E07']) check(spec.pairs.has(id), 'spec id not parsed: ' + id);
  check(spec.b67Described, 'B67 is no longer described as a middle dot in the spec');
  check(spec.pairs.get('B10') === "You're in: {folder}", 'B10 parsed as ' + JSON.stringify(spec.pairs.get('B10')));
  check(JSON.stringify(spec.retired.slice().sort()) === JSON.stringify(EXPECTED_RETIRED.slice().sort()), 'retired ids parsed as ' + spec.retired.join(','));
  process.stdout.write('    spec ids: ' + spec.pairs.size + '\n');
});

// A2
scenario('A2 the deck equals the spec, id for id and word for word', () => {
  check(spec, 'spec did not parse');
  check(deck, 'deck missing: ' + path.relative(REPO, DECK));
  process.stdout.write('    spec ids: ' + spec.pairs.size + ' deck ids: ' + deck.size + '\n');
  const problems = compare(spec.pairs, deck);
  check(problems.length === 0, problems.length + ' problem(s), first: ' + problems[0]);
});

// A3
scenario('A3 retired ids (B31, B81, B83, D20, D21, D22) are absent from the deck', () => {
  check(deck, 'deck missing: ' + path.relative(REPO, DECK));
  const src = fs.readFileSync(DECK, 'utf8');
  for (const id of EXPECTED_RETIRED) {
    check(!deck.has(id), 'retired id present in deck: ' + id);
    check(!new RegExp("['\"]" + id + "['\"]").test(src), 'retired id appears in deck source: ' + id);
  }
});

// A4
scenario('A4 copy rules: no long dash, ICM, command, file name, code or node id; never Brain or Theo', () => {
  check(deck, 'deck missing: ' + path.relative(REPO, DECK));
  for (const [id, text] of deck) {
    check(!text.includes(EM), id + ' holds an em-dash');
    check(!text.includes(EN), id + ' holds an en-dash');
    check(!text.includes('ICM'), id + ' holds ICM');
    check(!text.includes('/mos:'), id + ' holds a command name');
    check(!/\.(md|json|cjs|ts|tsx)\b/.test(text), id + ' holds a file extension');
    check(!/\b[0-9a-f]{8}-[0-9a-f]{4}-/.test(text), id + ' holds a node id');
    check(!/\b[a-z]+_[a-z0-9_]+\b/.test(text), id + ' holds a snake_case code');
    check(!/\b(Brain|Theo)\b/.test(text), id + ' holds Brain or Theo');
  }
});

// A4b (C-28): the only slash command on any screen is /workspace, and only the band hints and the unfocused-pane
// line name it; no copy line leads with a bare single-letter key as a typeable hint (the prompt box would take it).
scenario('A4b the only slash word is /workspace, in B80, B82 and N06; no band hint leads with a bare letter', () => {
  check(deck, 'deck missing: ' + path.relative(REPO, DECK));
  const allowed = new Set(['B80', 'B82', 'N06']);
  for (const [id, text] of deck) {
    const slashes = text.match(/(^|\s)\/[a-z]+/g) || [];
    if (slashes.length > 0) {
      check(allowed.has(id), id + ' names a slash command but is not one of B80, B82, N06');
      for (const w of slashes) check(w.trim() === '/workspace', id + ' names a slash command other than /workspace: ' + w.trim());
    }
  }
  for (const id of ['B80', 'B82']) {
    const t = deck.get(id);
    check(t !== undefined && t.startsWith('/workspace'), id + ' must lead with /workspace');
    check(!/(^|\s)[a-z0-9]: /.test(t), id + ' names a bare single-letter key');
  }
  const n06 = deck.get('N06');
  check(n06 !== undefined && !/\bPress [a-z0-9]\b/.test(n06), 'N06 tells a person to press a bare key');
});

// A5
scenario('A5 placeholders are lowercase letters and match the spec per id', () => {
  check(spec && deck, 'spec or deck missing');
  for (const [id, text] of deck) {
    for (const p of placeholdersOf(text)) check(/^[a-z]+$/.test(p), id + ' placeholder is not lowercase letters: {' + p + '}');
    const want = spec.pairs.get(id);
    if (want !== undefined) check(JSON.stringify(placeholdersOf(text)) === JSON.stringify(placeholdersOf(want)), id + ' placeholder set differs from the spec');
  }
});

// A6
scenario('A6 mutation: one changed spec string fails the parity comparison', () => {
  const mutated = specSrc.replace('| B80 | /workspace: Open workspace |', '| B80 | Open the workspace |');
  check(mutated !== specSrc, 'mutation target not found in the spec');
  const m = parseSpec(mutated);
  // Compare the mutated spec against a perfect copy of the genuine spec, so this arm works with or without a deck.
  const perfect = new Map(spec.pairs);
  perfect.dupes = [];
  const problems = compare(m.pairs, perfect);
  check(problems.length > 0, 'the comparison did not notice the changed string');
  check(problems.some((p) => p.includes('B80')), 'the comparison did not name B80: ' + problems[0]);
});

// A7
scenario('A7 text.ts exists with the two error shapes', () => {
  check(fs.existsSync(TEXT), 'text.ts missing: ' + path.relative(REPO, TEXT));
  const src = fs.readFileSync(TEXT, 'utf8');
  check(src.includes('missing_copy_data:'), 'text.ts lacks missing_copy_data:');
  check(src.includes('unexpected_copy_data:'), 'text.ts lacks unexpected_copy_data:');
  check(/export (function|const) text\b/.test(src), 'text.ts does not export text');
  check(/export type CopyData\b/.test(src), 'text.ts does not export CopyData');
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
