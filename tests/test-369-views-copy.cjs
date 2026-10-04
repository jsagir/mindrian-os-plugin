// SHELL369-06 and SHELL369-07 (plan 369-25): the review views' copy contract, the five-square tile mapping and the
// D-08 through D-13 static checks.
//
// Static arms read the shell's own source (ui/shell/client, ui/shell/app): every UI-SPEC string the views use sits
// verbatim in client/copy.ts (and in the UI-SPEC itself when the planning tree is present); no banned CTA word, no
// praise, no exclamation mark; every TileMark carries a written status; the document display is read only with no
// save path (D-13); no raw-HTML escape hatch; the five-square tile room is not a shell view in v1 (D-11); the
// graph tab has no canvas and the deliverables view has no export or publish control (D-08, D-12); no long dash.
// Pure-module arms import the erasable TypeScript (tile-model.ts, format.ts) with Node's own type stripping and
// check every row of the UI-SPEC state table, the precedence order, the formatters and the room-question reader.
//
// Hermetic and read-only: no network, no browser (the browser proof is tests/e2e-369/views.cjs). Plain counters,
// nonzero exit tail (house harness). Hyphens only; the dash characters are built at run time.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const SHELL = path.join(REPO, 'ui', 'shell');
const CLIENT = path.join(SHELL, 'client');
const APP = path.join(SHELL, 'app');
const VIEWS = path.join(CLIENT, 'views');
const SPEC = path.join(REPO, '.planning', 'phases', '369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-', '369-UI-SPEC.md');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + String(err.stack || err.message || err).split('\n').slice(0, 10).join('\n    ') + '\n');
}
function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}
async function ascenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

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
// Source with comments removed, so a rule about code is not tripped by a sentence that names the thing it forbids.
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const viewFiles = () => listFiles(VIEWS, ['.ts', '.tsx']);
const clientFiles = () => listFiles(CLIENT, ['.ts', '.tsx']).concat(listFiles(APP, ['.ts', '.tsx']));
const COPY = read(path.join(CLIENT, 'copy.ts'));
const FORMAT = read(path.join(VIEWS, 'format.ts'));

// ---------- (1) copy contract ----------

// Every string below is quoted from the UI-SPEC Copywriting Contract, CTA Contract or view composition.
const SPEC_STRINGS = [
  'What the room holds now',
  'Since you were here',
  'Nothing changed since your last visit on',
  'Review the next decision',
  'Opens it with its evidence. Nothing is saved until you approve.',
  'Open the evidence',
  'Shows what the room knows and where each item came from.',
  'No decision is waiting for you.',
  'No evidence in this room yet. Sources you file in Claude Code appear here.',
  'No decisions yet. When Larry proposes one, it waits here for you.',
  'No deliverables yet. Finished documents filed to the room appear here.',
  "Relations shown here are only as complete as the room's typed links.",
  'This document could not be displayed.',
  'Open it in Claude Code with /mos:open',
  'This room has no question written ',
  'Ask Larry in Claude Code to state what this room is trying to resolve.',
  'Back to evidence',
  'Waiting for you',
  'Proposed',
  'Settled',
  'Next decision',
  'Linked to',
];

scenario('copy: every UI-SPEC string the views use is verbatim in client/copy.ts', () => {
  for (const s of SPEC_STRINGS) assert.ok(COPY.includes(s), 'client/copy.ts is missing: ' + s);
  // "Confirmed by you, {date}" is composed by the attribution formatter, from the UI-SPEC Decisions view.
  assert.ok(FORMAT.includes("' by you'") || FORMAT.includes('by you'), 'format.ts writes "Confirmed by you"');
  assert.ok(/CURRENT QUESTION/i.test(COPY), 'the eyebrow words');
  assert.ok(COPY.includes("'Evidence: ' + n"), 'the "Evidence: {n} items" line');
  assert.ok(COPY.includes("' more waiting'"), 'the "{n} more waiting" eyebrow');
  assert.ok(COPY.includes("'Show all ' + n + ' changes'"), 'the "Show all {n} changes" action');
});

scenario('copy: the strings are the UI-SPEC strings (read from the contract itself when the planning tree is present)', () => {
  if (!fs.existsSync(SPEC)) {
    process.stdout.write('    (the UI-SPEC is not in this checkout; the verbatim check above stands alone)\n');
    return;
  }
  const spec = read(SPEC);
  for (const s of SPEC_STRINGS) {
    // A few strings are quoted in the contract with a placeholder or an italic accent mark; compare the stable part.
    const stable = s.replace(/ $/, '');
    assert.ok(spec.includes(stable), 'not in the UI-SPEC: ' + s);
  }
});

scenario('copy: no CTA label is Submit, Learn more, Get started, Click here, Next, Proceed or OK', () => {
  const banned = ['Submit', 'Learn more', 'Get started', 'Click here', 'Next', 'Proceed', 'OK'];
  const files = viewFiles().concat([path.join(CLIENT, 'copy.ts')]);
  for (const f of files) {
    const src = read(f);
    for (const w of banned) {
      const re = new RegExp('(?:label=|label:\\s*)[\'"{`]\\s*' + w + '\\s*[\'"}`]|>\\s*' + w + '\\s*<|[\'"`]' + w + '[\'"`]');
      assert.ok(!re.test(src), rel(f) + ' has a banned CTA word: ' + w);
    }
  }
});

scenario('copy: Canon Part 12 - no praise, no scores, no exclamation mark, none of the banned phrases', () => {
  const literals = [];
  for (const f of [path.join(CLIENT, 'copy.ts')].concat(viewFiles())) {
    for (const m of code(f).matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) literals.push({ f, text: m[1] !== undefined ? m[1] : m[2] });
  }
  assert.ok(literals.length > 40, 'string literals were read');
  for (const { f, text } of literals) {
    assert.ok(!text.includes('!'), rel(f) + ' has an exclamation mark in: ' + text);
    assert.ok(!/great question|i'd be happy to help|well done|congratulations|awesome|good job/i.test(text), rel(f) + ' praises: ' + text);
  }
  // Jsx text between tags too.
  for (const f of viewFiles().filter((x) => x.endsWith('.tsx'))) {
    for (const m of code(f).matchAll(/>([^<>{}\n]+)</g)) assert.ok(!m[1].includes('!'), rel(f) + ' has an exclamation mark in: ' + m[1]);
  }
});

scenario('copy: no em-dash or en-dash in the views, the copy, the shared edits or these tests', () => {
  const files = clientFiles()
    .concat(listFiles(VIEWS, ['.css']))
    .concat([__filename, path.join(__dirname, 'e2e-369', 'views.cjs'), path.join(REPO, 'ui', 'shared', 'src', 'projection.ts'), path.join(REPO, 'ui', 'shared', 'src', 'replica.ts')]);
  for (const f of files) {
    const src = read(f);
    assert.ok(!src.includes(EM) && !src.includes(EN), rel(f) + ' carries a long dash');
  }
});

// ---------- (1b) Plan 369-43: the Ask Larry control (SHELL369-13, gap 1 browser half) ----------

// Every string the control shows, verbatim from the plan's copy list (Canon v3 voice).
const ASK_LARRY_STRINGS = [
  'Ask Larry about this',
  'Larry answers in Claude Code. Copy this line, paste it to him there, and he files his answer in this room as a proposal.',
  'Your question',
  'Does this have enough evidence to confirm it?',
  'Line to paste',
  'Copy the line',
  'Line copied.',
  'Select the line above and copy it.',
  "Check for Larry's proposal",
  'Opens the decision when Larry has filed one. Nothing is approved until you choose.',
  'Checking the room...',
  'Larry has not filed a proposal about this yet.',
  'The room has no proposed claim that names this item.',
  'Paste the line into Claude Code, wait for Larry to file it, then check again.',
  "Something new arrived in this room. Check for Larry's proposal.",
  'No room is open in this browser.',
  'A proposal is read from the open room.',
  'Open the room, then check again.',
  'The room could not be read just now.',
  'MindrianOS did not answer this check.',
  'Nothing changed. Check again in a moment.',
];

scenario('369-43: the Ask Larry control exists in the Evidence reader, calls askClaude and never answers a decision', () => {
  const f = path.join(VIEWS, 'evidence', 'AskLarry.tsx');
  assert.ok(fs.existsSync(f), 'ui/shell/client/views/evidence/AskLarry.tsx is missing');
  const src = code(f);
  assert.ok(/callAction(<[^()]*>)?\('askClaude'/.test(src), 'the primary action calls the askClaude action');
  assert.ok(!/approveDecision|gate_answer|gateAnswer|readGate|publishDeliverable/.test(src), 'the control asks for a proposal only; it never reads a gate or answers a decision');
  assert.ok(/import\s*\{[^}]*\bcopyReference\b[^}]*\}\s*from\s*'mos-ui-shared\/copy-reference'/.test(src), 'the reference line comes from the shared pure copyReference (zod-free module)');
  assert.ok(!/claude-adapter|\/proposal'|\bzod\b/.test(src), 'the control imports nothing that pulls zod into the page (zod probes eval and trips the CSP report)');
  assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(src), 'no browser storage');
  assert.ok(!/\bstyle=/.test(src), 'no inline style attribute');
  assert.ok(!/dangerouslySetInnerHTML|\.innerHTML\s*=/.test(src), 'the line and the room text render as text');
  assert.strictEqual((src.match(/<ActionButton\b/g) || []).length, 1, 'exactly one ActionButton: the control is the view\'s one primary action');
  assert.ok(!/variant="secondary"/.test(src), 'no secondary button beside the primary action');
  const reader = code(path.join(VIEWS, 'evidence', 'EvidenceReader.tsx'));
  assert.ok(/<AskLarry\b/.test(reader), 'the reader renders the control');
  assert.ok(reader.indexOf('<AskLarry') < reader.indexOf('<LazyDocument'), 'the control sits under the provenance block and above the document');
  assert.ok(reader.indexOf('<AskLarry') > reader.indexOf('facts.map'), 'the control sits under the provenance block');
});

scenario('369-43: every Ask Larry string lives in client/copy.ts (one ASK_LARRY object), the primary label written once', () => {
  assert.ok(/export const ASK_LARRY\b/.test(COPY), 'copy.ts has the ASK_LARRY object');
  const lines = COPY.split('\n');
  assert.strictEqual(lines.filter((l) => l.includes("Check for Larry's proposal")).length, 1, 'the label is one line of copy.ts (the arrived sentence composes it)');
  for (const s of ASK_LARRY_STRINGS.filter((x) => !x.includes("Check for Larry's proposal"))) assert.ok(COPY.includes(s), 'client/copy.ts is missing: ' + s);
  const src = code(path.join(VIEWS, 'evidence', 'AskLarry.tsx'));
  for (const s of ASK_LARRY_STRINGS) assert.ok(!src.includes(s), 'AskLarry.tsx hard-codes a copy string: ' + s);
});

scenario('369-43: the UI-SPEC records the Ask Larry control with every string it shows (when the planning tree is present)', () => {
  if (!fs.existsSync(SPEC)) {
    process.stdout.write('    (the UI-SPEC is not in this checkout; the copy.ts check above stands alone)\n');
    return;
  }
  const spec = read(SPEC);
  assert.ok(spec.includes('Ask Larry about this (SHELL369-13)'), 'the dated gap-closure section is missing');
  for (const s of ASK_LARRY_STRINGS) assert.ok(spec.includes(s), 'not in the UI-SPEC: ' + s);
});

scenario('369-43: SEED-067 and SHELL369-04 - no model call in the control, and no new shell action is registered', () => {
  const src = code(path.join(VIEWS, 'evidence', 'AskLarry.tsx'));
  assert.ok(!/anthropic|openai|ANTHROPIC_API_KEY|\bmessages\.create\b|\/v1\/messages/i.test(src), 'no model call in the browser');
  const actions = read(path.join(SHELL, 'server', 'actions.ts'));
  const list = actions.slice(actions.indexOf('export const ACTION_NAMES'), actions.indexOf('] as const'));
  const names = [...list.matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert.strictEqual(names.length, 10, 'the registry stays at ten actions: ' + names.join(', '));
});

// ---------- (2) the tile mapping ----------

(async () => {
  const tileModel = await import(pathToFileURL(path.join(VIEWS, 'tile-model.ts')).href);
  const format = await import(pathToFileURL(path.join(VIEWS, 'format.ts')).href);
  const none = { openGate: false, contradicts: null };

  await ascenario('tileFor: each row of the UI-SPEC five-square table gets its tile and its written status', () => {
    const t = tileModel.tileFor;
    const expect = (item, ctx, tile, status) => {
      const r = t(item, ctx);
      assert.strictEqual(r.tile, tile, JSON.stringify(item) + ' tile');
      assert.strictEqual(r.status, status, JSON.stringify(item) + ' status');
      assert.ok(r.status.length > 0, 'a tile never travels without words');
    };
    expect({ status: 'proposed' }, none, 'blue', 'PROPOSED');
    expect({}, none, 'blue', 'PROPOSED'); // the room never moved it: proposed
    expect({ status: 'confirmed' }, none, 'red', 'CONFIRMED');
    expect({ status: 'validated' }, none, 'red', 'VALIDATED');
    expect({ status: 'needs_evidence' }, none, 'red', 'NEEDS EVIDENCE');
    expect({ status: 'stale' }, none, 'red', 'STALE');
    expect({ status: 'rejected' }, none, 'red', 'REJECTED');
    expect({ status: 'invalidated' }, none, 'red', 'INVALIDATED');
    expect({ status: 'proposed' }, { openGate: false, contradicts: 'Other claim' }, 'yellow', 'CONTRADICTION . PROPOSED');
    expect({ status: 'proposed' }, { openGate: true, contradicts: null }, 'black', 'WAITING FOR YOU . PROPOSED');
    expect({ kind: 'decision' }, none, 'black', 'DECIDED');
    expect({ kind: 'deliverable' }, none, 'white', 'DELIVERED');
    expect({ empty: true }, none, 'white', 'EMPTY');
    expect({ status: 'superseded' }, none, 'white', 'SUPERSEDED');
  });

  await ascenario('tileFor: black over yellow over red over blue over white; the other states are written after the primary', () => {
    const t = tileModel.tileFor;
    // The UI-SPEC example row, word for word.
    assert.strictEqual(t({ status: 'confirmed' }, { openGate: true, contradicts: 'X' }).status, 'WAITING FOR YOU . CONFIRMED . CONTRADICTION');
    assert.strictEqual(t({ status: 'confirmed' }, { openGate: true, contradicts: 'X' }).tile, 'black');
    assert.strictEqual(t({ status: 'confirmed' }, { openGate: false, contradicts: 'X' }).tile, 'yellow');
    assert.strictEqual(t({ status: 'confirmed' }, { openGate: false, contradicts: 'X' }).status, 'CONTRADICTION . CONFIRMED');
    assert.strictEqual(t({ status: 'rejected' }, none).tile, 'red');
    assert.strictEqual(t({ kind: 'decision', status: 'confirmed' }, none).status, 'DECIDED . CONFIRMED');
    assert.strictEqual(t({ kind: 'decision', status: 'confirmed' }, none).tile, 'black');
    assert.deepStrictEqual(t({ status: 'proposed' }, { openGate: false, contradicts: 'Other claim' }).extra, ['Contradicts Other claim']);
    assert.deepStrictEqual(t({ status: 'proposed' }, none).extra, []);
    // A word the table does not know is written as it is, never reinterpreted as a known state.
    assert.strictEqual(t({ status: 'on_hold' }, none).status, 'ON HOLD');
  });

  await ascenario('369-43: the values of ASK_LARRY are exactly the plan copy (the arrived sentence composes the label)', async () => {
    const copy = await import(pathToFileURL(path.join(CLIENT, 'copy.ts')).href);
    assert.ok(copy.ASK_LARRY && typeof copy.ASK_LARRY === 'object', 'ASK_LARRY is exported');
    const values = new Set();
    const collect = (o) => { for (const v of Object.values(o)) { if (typeof v === 'string') values.add(v); else if (v && typeof v === 'object') collect(v); } };
    collect(copy.ASK_LARRY);
    for (const s of ASK_LARRY_STRINGS) assert.ok(values.has(s), 'ASK_LARRY has no value: ' + s);
  });

  await ascenario('contradictionPartners: both ends of a CONTRADICTS edge point at each other; other edge types are ignored', () => {
    const m = tileModel.contradictionPartners([
      { source: 'a', target: 'b', type: 'CONTRADICTS' },
      { source: 'c', target: 'd', type: 'INFORMS' },
    ]);
    assert.strictEqual(m.get('a'), 'b');
    assert.strictEqual(m.get('b'), 'a');
    assert.ok(!m.has('c') && !m.has('d'));
  });

  // ---------- (3) the formatters and the room question ----------

  await ascenario('format: relative under 24 hours, else "2 Oct 2026"; the settled attribution is in words', () => {
    const now = new Date(2026, 9, 4, 12, 0, 0).getTime();
    assert.strictEqual(format.timeLabel(new Date(now - 30 * 1000).toISOString(), now), 'just now');
    assert.strictEqual(format.timeLabel(new Date(now - 5 * 60000).toISOString(), now), '5m ago');
    assert.strictEqual(format.timeLabel(new Date(now - 2 * 3600000).toISOString(), now), '2h ago');
    assert.strictEqual(format.timeLabel(new Date(2026, 9, 2, 8, 0, 0).toISOString(), now), '2 Oct 2026');
    assert.strictEqual(format.timeLabel('', now), '');
    assert.strictEqual(format.formatDay(new Date(2026, 9, 2, 8, 0, 0).toISOString()), '2 Oct 2026');
    const day = '2026-10-02T09:00:00.000Z';
    assert.ok(/^Confirmed by you, \d{1,2} Oct 2026$/.test(format.attribution('confirmed', 'user', day)), format.attribution('confirmed', 'user', day));
    assert.ok(/^Validated by you, /.test(format.attribution('validated', 'jonathan', day)));
    assert.strictEqual(format.attribution('confirmed', 'user', undefined), 'Confirmed by you');
    assert.ok(!/by you/.test(format.attribution('rejected', 'user', day)), 'only a confirmation is by you');
    assert.ok(!/by you/.test(format.attribution('confirmed', 'system', day)), 'a system stamp is not a person');
  });

  await ascenario('format: the room question is read out of the question card text, and a room with none says so', () => {
    const card = 'Governing question (version 2 of 3): What would make this customer problem worth solving?\nOrigin: chosen - chosen by the officer\nSet at: 2026-10-02T09:00:00.000Z\nChange: refines';
    assert.strictEqual(format.questionOf(card), 'What would make this customer problem worth solving?');
    assert.strictEqual(format.questionOf('A question change is waiting.\nProposed question: X\n' + card), 'What would make this customer problem worth solving?');
    assert.strictEqual(format.questionOf('No governing question recorded yet.'), '');
    assert.strictEqual(format.questionOf(''), '');
    assert.strictEqual(format.questionOf(undefined), '');
    assert.strictEqual(format.questionOf('Governing question (version 1 of 1): One line only'), 'One line only');
  });

  await ascenario('format: only a room-relative Markdown path is asked of the room (a synthetic handle has no document)', () => {
    const r = format.readableDocumentPath;
    assert.strictEqual(r('evidence/interview.md'), 'evidence/interview.md');
    assert.strictEqual(r('notes.MD'), 'notes.MD');
    for (const bad of ['meeting:ab12:inline', 'system:hsi-to-graph', 'frame:room:governing-question', '/etc/passwd.md', '../outside.md', 'a/../../b.md', 'file.txt', '', undefined, 'C:\\x.md', '\\\\host\\share.md']) {
      assert.strictEqual(r(bad), null, String(bad));
    }
    assert.ok(format.isStructural('Section') && format.isStructural('frame') && !format.isStructural('claim'));
  });

  // ---------- (4) D-13: the document display ----------

  scenario('D-13: the document display is read only - editable={false}, every editing surface off, no save route', () => {
    const f = path.join(VIEWS, 'evidence', 'DocumentDisplay.tsx');
    const src = read(f);
    assert.strictEqual((src.match(/editable=\{false\}/g) || []).length, 1, 'editable={false} appears once');
    for (const off of ['sideMenu={false}', 'formattingToolbar={false}', 'slashMenu={false}', 'linkToolbar={false}', 'filePanel={false}', 'tableHandles={false}']) {
      assert.ok(src.includes(off), 'DocumentDisplay turns off ' + off);
    }
    assert.ok(!/onChange|saveDocument|PUT|method: 'PUT'|method: 'POST'|\bfetch\(/.test(src), 'no change handler, save, PUT or direct request');
    assert.ok(/callAction(<[^()]*>)?\('readArtifact'/.test(src), 'the markdown comes from the room_artifact tool through the readArtifact action');
    for (const f2 of viewFiles()) assert.ok(!/saveDocument|api\/save|method:\s*'PUT'/.test(code(f2)), rel(f2) + ' has no save path');
    // The pin: the Phase 232 wiki editor's BlockNote version (RESEARCH Pitfall 12).
    const pkg = JSON.parse(read(path.join(SHELL, 'package.json')));
    for (const name of ['@blocknote/core', '@blocknote/react', '@blocknote/mantine']) assert.strictEqual(pkg.dependencies[name], '0.51.4', name);
    const wiki = JSON.parse(read(path.join(REPO, 'lib', 'wiki', 'editor-src', 'package.json')));
    assert.strictEqual((wiki.dependencies || {})['@blocknote/core'], '0.51.4', 'the wiki editor pin is the same version');
  });

  scenario('Canon s7: a room document never adds an H1 - its headings are demoted one level before they are shown (plan 369-29, C8)', () => {
    const src = read(path.join(VIEWS, 'evidence', 'DocumentDisplay.tsx'));
    assert.ok(/export function demoteHeadings\b/.test(src), 'the demotion is a named function');
    assert.ok(/replaceBlocks\(editor\.document, demoteHeadings\(/.test(src), 'the parsed blocks go through it before they are shown');
    assert.ok(/Math\.min\(3, level \+ 1\)/.test(src), 'level 1 becomes 2, and the display stops at 3');
  });

  scenario('D-13: the display is themed to the UI-SPEC - paper, ink, DM Sans, Fraunces headings, radius 0, no shadow', () => {
    const css = read(path.join(VIEWS, 'evidence', 'document-display.css'));
    assert.ok(/background:\s*var\(--paper\)/.test(css) && /color:\s*var\(--ink\)/.test(css));
    assert.ok(/font-family:\s*var\(--font-ui\)/.test(css) && /font-family:\s*var\(--font-display\)/.test(css));
    assert.ok(/border-radius:\s*var\(--radius\)/.test(css) && /box-shadow:\s*none/.test(css));
    assert.ok(/font-size:\s*var\(--heading-size\)/.test(css), 'headings at the Heading size');
  });

  // ---------- (5) XSS: room content is text ----------

  scenario('T-369-25-01: room content renders as text - no dangerouslySetInnerHTML, no innerHTML, no indexedDB in the shell source', () => {
    for (const f of clientFiles()) {
      const src = code(f);
      assert.ok(!/dangerouslySetInnerHTML/.test(src), rel(f) + ' uses dangerouslySetInnerHTML');
      assert.ok(!/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML/.test(src), rel(f) + ' writes markup');
      assert.ok(!/indexedDB/.test(src), rel(f) + ' reaches for indexedDB (the copy helpers live in ui/shared)');
    }
  });

  // ---------- (6) D-11, D-12, D-08: what the views do not draw ----------

  scenario('D-11: no five-square tile-room composition in the shell - no TileRoom, no data-tile-room, a TileMark always beside its item text', () => {
    for (const f of clientFiles().concat(listFiles(CLIENT, ['.css']))) {
      assert.ok(!/TileRoom/.test(path.basename(f)), rel(f) + ' is named TileRoom');
      assert.ok(!/data-tile-room|TileRoom/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')), rel(f) + ' draws the tile room');
    }
    // A TileMark appears only in the row component and in the three readers, once each, next to the item's title.
    // Plan 369-27: the gate card draws two (the black decision-gate square in its eyebrow, UI-SPEC part 1, and its
    // subject's tile beside the subject text, part 3); neither is a row of a tile composition.
    const allowed = new Set(['ItemRow.tsx', 'EvidenceReader.tsx', 'DecisionsView.tsx', 'DeliverablesView.tsx', 'GateCard.tsx']);
    for (const f of viewFiles().filter((x) => x.endsWith('.tsx'))) {
      const n = (code(f).match(/<TileMark\b/g) || []).length;
      if (n > 0) assert.ok(allowed.has(path.basename(f)), rel(f) + ' renders a TileMark outside an item row or reader');
      assert.ok(n <= (path.basename(f) === 'GateCard.tsx' ? 2 : 1), rel(f) + ' renders ' + n + ' TileMarks (one per item)');
      assert.ok(!/\[\s*'blue'\s*,\s*'red'\s*,\s*'yellow'/.test(code(f)), rel(f) + ' lays the five tones side by side');
    }
  });

  scenario('D-11: every TileMark and every ItemRow in the views carries a written status', () => {
    for (const f of viewFiles().filter((x) => x.endsWith('.tsx'))) {
      const src = code(f);
      for (const m of src.matchAll(/<TileMark\b[^>]*?\/>/gs)) assert.ok(/\bstatus=/.test(m[0]), rel(f) + ': ' + m[0]);
      for (const m of src.matchAll(/<ItemRow\b[^>]*?(?:\/>|>)/gs)) assert.ok(/\bstatus=/.test(m[0]), rel(f) + ': an ItemRow without a status');
    }
    const row = code(path.join(VIEWS, 'ItemRow.tsx'));
    assert.ok(/<TileMark tile=\{tile\} status=\{status\}/.test(row), 'ItemRow hands its status to the TileMark');
  });

  scenario('D-11: a legend sits under every list that shows marks', () => {
    for (const f of ['work/SinceLastVisit.tsx', 'evidence/EvidenceList.tsx', 'decisions/DecisionsView.tsx', 'deliverables/DeliverablesView.tsx']) {
      assert.ok(/<Legend\s*\/>/.test(code(path.join(VIEWS, f))), f + ' draws the legend');
    }
  });

  scenario('D-12: the Graph tab is text only - no canvas, no svg, no diagram library', () => {
    for (const f of listFiles(path.join(VIEWS, 'graph'), ['.ts', '.tsx'])) {
      const src = read(f);
      assert.strictEqual((src.match(/canvas/gi) || []).length, 0, rel(f) + ' mentions canvas');
      assert.ok(!/<svg|cytoscape|d3-|reactflow|sigma/i.test(src), rel(f) + ' draws a diagram');
    }
    assert.ok(read(path.join(VIEWS, 'graph', 'GraphView.tsx')).includes('GRAPH.caption'), 'the typed-links caption is shown');
  });

  scenario('D-08: the views review and decide only - no export, publish, download or write control in Deliverables or anywhere in the views', () => {
    const src = code(path.join(VIEWS, 'deliverables', 'DeliverablesView.tsx'));
    // Words a person could read or press: string literals and JSX text (the `export` keyword is not one).
    const words = [...src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] || m[2] || '').concat([...src.matchAll(/>([^<>{}\n]+)</g)].map((m) => m[1]));
    for (const w of words) assert.ok(!/\b(export|publish|download|share|print)\b/i.test(w), 'Deliverables has a control or text about: ' + w);
    assert.ok(!/<button\b|onClick=\{[^}]*(export|publish)/i.test(src.replace(/<TextAction[\s\S]*?<\/TextAction>/g, '')), 'Deliverables adds no button of its own');
    // The gate view (views/gate, plan 369-27) is the one place a decision is answered; every other view only reads.
    for (const f of viewFiles().filter((x) => !x.split(path.sep).includes('gate'))) {
      const s = code(f);
      assert.ok(!/approveDecision|publishDeliverable|gate_answer/.test(s), rel(f) + ' answers a decision or publishes (that is the gate view)');
      // Plan 369-43: the Ask Larry control (views/evidence/AskLarry.tsx) is the one view file that may call askClaude, and only that.
      const mayAsk = path.basename(f) === 'AskLarry.tsx' ? '|askClaude' : '';
      assert.ok(!new RegExp("callAction(<[^()]*>)?\\('(?!readArtifact|listOpenGates|readGate|roomDoc" + mayAsk + ")").test(s), rel(f) + ' calls an action the views may not call');
      assert.ok(!/readGate\b/.test(s) || /callAction(<[^()]*>)?\('readGate'/.test(s), rel(f) + ' reads a gate through callAction only (no render nonce is kept by a view)');
    }
  });

  scenario('D-08: Decisions groups Waiting for you, Proposed and Settled, in that order, and links a waiting row to the gate view', () => {
    const src = read(path.join(VIEWS, 'decisions', 'DecisionsView.tsx'));
    const a = src.indexOf('DECISIONS.waiting');
    const b = src.indexOf('DECISIONS.proposed');
    const c = src.indexOf('DECISIONS.settled');
    assert.ok(a > 0 && b > a && c > b, 'the three H2 groups are drawn in order');
    assert.ok(/'\/gate\/' \+ encodeURIComponent/.test(src), 'a waiting row opens /gate/<gate_id>');
    assert.ok(/attribution\(/.test(src), 'settled rows are attributed in words');
  });

  // ---------- (7) wiring ----------

  scenario('D-09: the opening screen wiring - last-visit marker, revision above it, the Next decision panel, the Hooked states', () => {
    const since = read(path.join(VIEWS, 'work', 'SinceLastVisit.tsx'));
    assert.ok(/getLastVisit/.test(since) && /revision\s*<=\s*after/.test(since), 'the list is every item whose revision is above the marker');
    assert.ok(/CHANGES_SHOWN/.test(since) && /showAllChanges/.test(since), 'five rows, then "Show all {n} changes"');
    for (const state of ['holds-now', 'nothing-changed', 'changes']) assert.ok(since.includes('data-state="' + state + '"'), state);
    assert.ok(/ROOM_HOLDS_NOW/.test(since) && /nothingChanged\(/.test(since));
    const copy = COPY;
    assert.ok(/CHANGES_SHOWN = 5/.test(copy), 'at most 5 rows');
    const work = read(path.join(VIEWS, 'work', 'WorkView.tsx'));
    assert.ok(/<h1\b/.test(work) && /NextDecisionPanel/.test(work) && /SinceLastVisit/.test(work));
    // On phones the order is question, Next decision, Since you were here: the panel precedes the list in the markup.
    assert.ok(work.indexOf('<NextDecisionPanel') < work.indexOf('<SinceLastVisit'), 'phone order');
    const panel = read(path.join(VIEWS, 'work', 'NextDecisionPanel.tsx'));
    assert.ok(/REVIEW_NEXT_DECISION/.test(panel) && /OPEN_THE_EVIDENCE/.test(panel) && /NO_DECISION_WAITING/.test(panel));
  });

  scenario('the route registry names Work, Evidence, Decisions, Deliverables and Graph; focus moves to the H1 of every view', () => {
    const routes = read(path.join(CLIENT, 'routes.ts'));
    for (const p of ["'/'", "'/work'", "'/evidence'", "'/decisions'", "'/deliverables'", "'/graph'"]) assert.ok(routes.includes('path: ' + p), 'route ' + p);
    for (const f of ['work/WorkView.tsx', 'evidence/EvidenceView.tsx', 'decisions/DecisionsView.tsx', 'deliverables/DeliverablesView.tsx', 'graph/GraphView.tsx']) {
      const src = read(path.join(VIEWS, f));
      assert.ok(/useHeadingFocus\(\)/.test(src) && /<h1 ref=\{heading\} tabIndex=\{-1\}/.test(src), f + ' focuses its H1');
    }
  });

  scenario('the shared copy is projection version 2 and the shell reads the last-visit day from the copy', () => {
    const proj = read(path.join(REPO, 'ui', 'shared', 'src', 'projection.ts'));
    assert.ok(/PROJECTION_VERSION = 2/.test(proj), 'version 2');
    assert.ok(/confirmed_by: 'string'/.test(proj.slice(proj.indexOf('nodes: {'), proj.indexOf('relations:'))), 'nodes carry confirmed_by');
    assert.ok(/getLastVisitAt/.test(read(path.join(REPO, 'ui', 'shared', 'src', 'replica.ts'))));
    assert.ok(/getLastVisitAt/.test(read(path.join(CLIENT, 'replica', 'ReplicaProvider.tsx'))));
  });

  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  process.stdout.write('FATAL ' + String((err && err.stack) || err) + '\n');
  process.exit(1);
});
