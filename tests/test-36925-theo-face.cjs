#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 08 (TFACE-02..07): the Theo face renderer, a pure function over three inputs: the Theo ask result
 * (plan 05), the capability marker (plan 06) and the three command sources (plan 06).
 *
 * WHY THIS TEST EXISTS. The face is what a navigator reads at session start about what Theo said and what can run
 * here. It must say what was asked, what came back, where each suggestion came from, why it fits, what it cannot
 * tell you, and it must never present agreement as independent confirmation. Every Theo response below is an
 * injected stub; there is no network, no room and no write.
 *
 * Arms: F1 asked provenance, F2 six not-asked lines, F3 capability + source tags + section marker, F4 ledger is a
 * link, contract-only and table-only listed, F5 at most three why-it-fits lines, F6 limitations, F7 shared premise
 * (and no corroboration word anywhere), F8 no shared chapter, F9 no leak of foreign object keys, F10 flat
 * frontmatter + machine scalars, F11 dash guard. Carry-over from plan 05 (handles_on_wire): F12 provenance names
 * only handles that crossed the wire, F13 Theo text scrub, F14 purity of the module source.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MOD = path.join(ROOT, 'lib', 'core', 'feyminto', 'theo-face.cjs');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let pass = 0;
let fail = 0;
function arm(name, fn) {
  try {
    fn();
    pass += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    fail += 1;
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), msg + ': got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }

let face = null;
let loadError = null;
try { face = require(MOD); } catch (e) { loadError = e; }
function need() { if (!face) throw new Error('module missing: ' + (loadError && loadError.message)); return face; }

const ask = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'theo-ask.cjs'));
const cap = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs'));
const cs = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'command-sources.cjs'));

// ---- canned inputs ---------------------------------------------------------------------------------------
const NOW = () => '2026-10-06T12:00:00.000Z';
const IDENTITY_OK = { ok: true, room_id: 'room-fixture', repaired: false };
const IDENTITY_BAD = { ok: false, reason: 'room_id_missing' };

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
const navCommands = registry.filter((c) => c.surface === 'navigator').map((c) => c.command.replace(/^\/mos:/, ''));
const internalCommands = registry.filter((c) => c.surface !== 'navigator').map((c) => c.command.replace(/^\/mos:/, ''));
const CMD_A = navCommands[0];
const CMD_B = internalCommands[0];

const CHAPTERS = [
  { phase: 'p1', phaseLabel: 'Frame the problem', chapterId: 'ch-01', chapterLabel: 'Chapter 1', toolTypes: ['Matrix', 'Checklist'] },
  { phase: 'p1', phaseLabel: 'Frame the problem', chapterId: 'ch-02', chapterLabel: 'Chapter 2', toolTypes: ['Checklist', 'Canvas'] },
  { phase: 'p2', phaseLabel: 'Test the frame', chapterId: 'ch-07', chapterLabel: 'Chapter 7', toolTypes: ['Experiment'] },
];
const COMMAND_ROWS = [
  { command: CMD_A, jtbd: 'Name the problem', framework: 'Alpha Frame' },
  { command: CMD_A, jtbd: 'Name the problem', framework: 'Beta Frame' },
  { command: CMD_B, jtbd: 'Check the premise', framework: 'Gamma Frame' },
];
const ROUTE = [
  { step: 1, framework: 'Alpha Frame' },
  { step: 2, framework: 'Beta Frame' },
  { step: 3, framework: 'Gamma Frame' },
  { step: 4, framework: 'Delta Frame' },
];
const NEIGH = (framework, chapters, extra) => Object.assign({ framework, name: framework, chapters, commands: [], brain_records: 0 }, extra || {});

function askedResult(over) {
  const base = {
    asked: true,
    origin: 'https://theo-mcp.example',
    handles_sent: { problem_type: 'IllDefined', section_kind: 'problem-definition', job_id: 'find-problem', frameworks: ['Alpha Frame', 'Beta Frame'] },
    handles_on_wire: ['problem_type', 'frameworks'],
    handles_fingerprint: 'sha256:abc123',
    queries_sent: 5,
    rows_returned: { find_frameworks: 3, commands: 3, route: 4, neighborhood: 2 },
    refusals: [],
    asked_at: '2026-10-06T11:59:00.000Z',
    results: {
      chapters: CHAPTERS,
      commands: COMMAND_ROWS,
      route: ROUTE,
      neighborhoods: [
        NEIGH('Alpha Frame', [{ id: 'ch-07', label: 'Chapter 7' }, { id: 'ch-02', label: 'Chapter 2' }]),
        NEIGH('Beta Frame', [{ id: 'ch-07', label: 'Chapter 7' }]),
      ],
    },
  };
  return Object.assign(base, over || {});
}
function notAsked(reason) {
  return { asked: false, not_asked: reason, not_asked_line: ask.NOT_ASKED_LINES[reason], queries_sent: 0, asked_at: '2026-10-06T11:59:00.000Z' };
}
function input(section, askRes, over) {
  return Object.assign({
    identity: IDENTITY_OK,
    section,
    ask: askRes,
    capabilityFor: cap.capabilityFor,
    sources: cs.sourcesForSection(section),
    sectionMarker: cap.sectionMarker,
    now: NOW,
  }, over || {});
}

// Split a face body into { heading: bodyText } by '## ' headings, in order.
function sections(body) {
  const out = [];
  const parts = body.split(/^## /m);
  for (const p of parts.slice(1)) {
    const nl = p.indexOf('\n');
    out.push({ heading: '## ' + (nl < 0 ? p : p.slice(0, nl)), text: nl < 0 ? '' : p.slice(nl + 1).replace(/\s+$/, '') });
  }
  return out;
}
function sectionText(body, heading) {
  const s = sections(body).find((x) => x.heading === heading);
  return s ? s.text : null;
}

const everyRender = [];
function render(inp) {
  const r = need().renderTheoFace(inp);
  everyRender.push(r.body + '\n' + JSON.stringify(r.frontmatter));
  return r;
}

const H = {
  prov: '## Provenance',
  sugg: '## FeyMinto: what Theo suggests for this nest',
  src: '## Command sources for this nest',
  fits: '## Why it fits the unresolved question',
  lim: '## Limitations',
  shared: '## Shared premise',
};

// ---------------------------------------------------------------------------------------------------------
arm('F0 exports and heading order', () => {
  const f = need();
  eq(f.THEO_FACE_HEADINGS.slice(), [H.prov, H.sugg, H.src, H.fits, H.lim, H.shared], 'THEO_FACE_HEADINGS');
  check(Object.isFrozen(f.THEO_FACE_HEADINGS), 'THEO_FACE_HEADINGS frozen');
  check(typeof f.sharedPremise === 'function' && typeof f.renderTheoFace === 'function', 'two functions exported');
});

arm('F1 asked: flat provenance frontmatter and a plain paragraph', () => {
  const r = render(input('problem-definition', askedResult()));
  const fm = r.frontmatter;
  eq(fm.face, 'feyminto-theo', 'face');
  eq(fm.room_id, 'room-fixture', 'room_id');
  eq(fm.asked, true, 'asked');
  eq(fm.not_asked_reason, null, 'not_asked_reason');
  eq(fm.theo_origin, 'https://theo-mcp.example', 'theo_origin');
  eq(fm.handles_problem_type, 'IllDefined', 'handles_problem_type');
  eq(fm.handles_section_kind, 'problem-definition', 'handles_section_kind');
  eq(fm.handles_job_id, 'find-problem', 'handles_job_id');
  eq(fm.handles_frameworks, 'Alpha Frame,Beta Frame', 'handles_frameworks');
  eq(fm.handles_on_wire, 'problem_type,frameworks', 'handles_on_wire');
  eq(fm.handles_fingerprint, 'sha256:abc123', 'handles_fingerprint');
  eq(fm.queries_sent, 5, 'queries_sent');
  eq([fm.rows_find_frameworks, fm.rows_commands, fm.rows_route, fm.rows_neighborhood], [3, 3, 4, 2], 'rows_*');
  eq(fm.refusals, 'none', 'refusals');
  eq(fm.asked_at, '2026-10-06T11:59:00.000Z', 'asked_at');
  check(typeof fm.edit_surface === 'string' && fm.edit_surface.length > 0 && /generated/.test(fm.edit_surface), 'edit_surface truthy and says generated');
  eq(fm.edit_recorded_in, 'none (generated face)', 'edit_recorded_in');
  const prov = sectionText(r.body, H.prov);
  check(prov && prov.indexOf('https://theo-mcp.example') !== -1, 'provenance names the origin');
  check(prov.indexOf('IllDefined') !== -1, 'provenance names the lens');
  check(/\b5 queries\b/.test(prov), 'provenance names the query count: ' + prov);
  check(/\b12 rows\b/.test(prov), 'provenance names the total row count (3+3+4+2): ' + prov);
  check(prov.split('\n').filter((l) => l.trim()).length === 1, 'provenance is one paragraph');
  check(r.body.indexOf('(no signal)') === -1, 'no (no signal)');
});

arm('F2 six not-asked reasons: the exact line, a reason, no (no signal)', () => {
  const reasons = ['at_birth', 'offline', 'theo_unavailable', 'egress_blocked', 'no_handle_to_send', 'room_not_ready'];
  eq(Object.keys(ask.NOT_ASKED).sort(), reasons.slice().sort(), 'the closed set the test iterates');
  for (const reason of reasons) {
    const r = render(input('problem-definition', notAsked(reason)));
    eq(sectionText(r.body, H.sugg), ask.NOT_ASKED_LINES[reason], 'suggestions body for ' + reason);
    eq(r.frontmatter.not_asked_reason, reason, 'not_asked_reason ' + reason);
    eq(r.frontmatter.asked, false, 'asked false ' + reason);
    check(r.body.indexOf('(no signal)') === -1, 'no (no signal) for ' + reason);
    const prov = sectionText(r.body, H.prov);
    check(prov.indexOf(ask.NOT_ASKED_LINES[reason]) !== -1 && /Nothing was sent\./.test(prov), 'provenance carries the line and Nothing was sent: ' + prov);
    eq(r.frontmatter.rows_commands, null, 'a question never asked has null rows, not 0 (' + reason + ')');
    eq(r.recommendations.length, 0, 'no recommendations when not asked');
    const fits = sectionText(r.body, H.fits);
    check(fits.indexOf('Nothing to fit yet: Theo was not asked (' + reason + ').') !== -1, 'why-it-fits says nothing to fit: ' + fits);
  }
});

arm('F3 capability label and source tag on every framework, operation and command line; section marker', () => {
  const r = render(input('legal-ip', askedResult()));
  const sugg = sectionText(r.body, H.sugg);
  const lines = sugg.split('\n').filter((l) => /^- /.test(l));
  check(lines.length > 0, 'suggestion lines exist');
  for (const l of lines) {
    check(/\(source: (theo [a-z_]+|contract|navigator table|ledger, see CONTEXT\.md section 2)\)\s*$/.test(l), 'line ends with a source tag: ' + l);
  }
  const cmdLine = lines.find((l) => l.indexOf('/mos:' + CMD_A + ' ') !== -1);
  check(cmdLine && cmdLine.indexOf(cap.capabilityFor(CMD_A, { kind: 'command' }).label) !== -1, 'navigator command carries its capabilityFor label: ' + cmdLine);
  const internalLine = lines.find((l) => l.indexOf('/mos:' + CMD_B + ' ') !== -1);
  check(internalLine && internalLine.indexOf(cap.capabilityFor(CMD_B, { kind: 'command' }).label) !== -1, 'internal command carries its label: ' + internalLine);
  const fwLine = lines.find((l) => l.indexOf('Alpha Frame') !== -1 && /recommend_chain/.test(l));
  check(fwLine && fwLine.indexOf(cap.capabilityFor('Alpha Frame', { kind: 'framework' }).label) !== -1, 'framework carries its label: ' + fwLine);
  const opLine = lines.find((l) => l.indexOf('Frame the problem') !== -1);
  check(opLine && /assisted/.test(opLine) && /Matrix/.test(opLine) && /Checklist/.test(opLine) && /Canvas/.test(opLine), 'operation line has phase, tool types, assisted label: ' + opLine);
  check(sugg.split('\n').indexOf('no runnable command here; instruction-only or assisted') !== -1, 'legal-ip section marker line present as its own line');
  const other = render(input('problem-definition', askedResult()));
  check(sectionText(other.body, H.sugg).indexOf('no runnable command here') === -1, 'no marker for a section with a dedicated command');
});

arm('F4 ledger sequence is a link plus counts; contract-only and table-only carry their source', () => {
  const sec = 'competitive-analysis';
  const sources = cs.sourcesForSection(sec);
  const r = render(input(sec, askedResult()));
  const text = sectionText(r.body, H.src);
  check(/Ledger sequence: see \[CONTEXT\.md section 2\]\(CONTEXT\.md\) \(\d+ names; \d+ agree with another source/.test(text), 'ledger link line: ' + text);
  check(text.indexOf(sources.ledger.provenance.stamp) !== -1, 'ledger stamp printed');
  const top3 = sources.context_section2_top3;
  check(top3.length === 3, 'fixture has a top 3');
  for (const l of r.body.split('\n')) {
    for (const n of top3) {
      const re = new RegExp('(^|[^a-z0-9-])' + n.replace(/[-]/g, '\\-') + '([^a-z0-9-]|$)');
      if (re.test(l)) check(/\(source: /.test(l), 'ledger top-3 name "' + n + '" on a line with no source tag: ' + l);
    }
  }
  check(sources.table_only.length > 0, 'fixture has a table_only name');
  for (const n of sources.table_only) {
    const l = text.split('\n').find((x) => x.indexOf('/mos:' + n + ' ') !== -1);
    check(l && /\(source: navigator table\)\s*$/.test(l), 'table_only ' + n + ' tagged navigator table: ' + l);
  }
  const pd = cs.sourcesForSection('problem-definition');
  const r2 = render(input('problem-definition', askedResult()));
  const t2 = sectionText(r2.body, H.src);
  check(pd.contract_only.length > 0, 'problem-definition fixture has contract_only names');
  for (const n of pd.contract_only) {
    const l = t2.split('\n').find((x) => x.indexOf('/mos:' + n + ' ') !== -1);
    check(l && /\(source: contract\)\s*$/.test(l), 'contract_only ' + n + ' tagged contract: ' + l);
  }
  const agreeName = pd.agreement[0];
  const al = t2.split('\n').find((x) => x.indexOf('/mos:' + agreeName + ' ') !== -1);
  check(al && /\(source: [^)]*;[^)]*\)\s*$/.test(al), 'agreement name carries more than one source tag: ' + al);
  eq(t2.split('\n').filter((x) => x.indexOf('/mos:' + agreeName + ' ') !== -1).length, 1, 'agreement name listed once');
});

arm('F5 at most three why-it-fits lines, naming lens and job, linking the open question', () => {
  const r = render(input('problem-definition', askedResult()));
  const fits = sectionText(r.body, H.fits).split('\n').filter((l) => l.trim());
  check(fits.length === 3, 'exactly three lines for an answer with many recommendations: ' + fits.length);
  for (const l of fits) {
    check(l.indexOf('IllDefined') !== -1, 'names the lens: ' + l);
    check(l.indexOf('find-problem') !== -1, 'names the job: ' + l);
    check(l.indexOf('[BRIEF.md](BRIEF.md#the-question-that-matters-now)') !== -1, 'links the open question: ' + l);
  }
  const one = askedResult({ results: { chapters: [], commands: [], route: [{ step: 1, framework: 'Alpha Frame' }], neighborhoods: [] } });
  const r1 = render(input('problem-definition', one));
  eq(sectionText(r1.body, H.fits).split('\n').filter((l) => l.trim()).length, 1, 'one recommendation gives one line');
});

arm('F6 limitations: fixed lines, coverage, already-in-play, refusals, zero-query lead', () => {
  const withCoverage = askedResult({
    refusals: [{ tool: 'framework_neighborhood', kind: 'timeout' }],
    results: Object.assign({}, askedResult().results, { coverage: { matched: 3, total: 11 } }),
  });
  const r = render(input('problem-definition', withCoverage));
  const lim = sectionText(r.body, H.lim);
  check(lim.indexOf('Theo answered for the lens, not for this nest: its problem-type reads take no section or job (THEO-PREP item 1).') !== -1, 'lens-not-nest line');
  check(lim.indexOf('recommend_chain does not know which frameworks this nest already used (THEO-PREP item 2).') !== -1, 'already-in-play line');
  check(lim.indexOf('Chapter coverage for this lens: 3 of 11.') !== -1, 'matched of total: ' + lim);
  check(lim.indexOf('framework_neighborhood: timeout') !== -1, 'refusal listed');
  check(lim.indexOf('A suggestion here has not run. Runnable here means a command exists on this install, not that it was used.') !== -1, 'nothing ran line');
  check(lim.indexOf('A zero query count is an investigation lead, not a verdict.') === -1, 'no zero-query line when queries were sent');
  eq(r.frontmatter.refusals, 'framework_neighborhood:timeout', 'refusals scalar');
  const noCoverage = render(input('problem-definition', askedResult()));
  const lim2 = sectionText(noCoverage.body, H.lim);
  check(/Theo listed 3 chapters for this lens; the total chapter count was not returned to this face\./.test(lim2), 'honest line when coverage is absent: ' + lim2);
  const zero = render(input('problem-definition', notAsked('offline')));
  check(sectionText(zero.body, H.lim).indexOf('A zero query count is an investigation lead, not a verdict.') !== -1, 'zero-query lead when 0 queries');
});

arm('F7 shared premise names both frameworks and the chapter; the corroboration stem never appears', () => {
  const f = need();
  const sp = f.sharedPremise([
    NEIGH('Alpha Frame', [{ id: 'ch-07', label: 'Chapter 7' }, { id: 'ch-02', label: 'Chapter 2' }]),
    NEIGH('Beta Frame', [{ id: 'ch-07', label: 'Chapter 7' }]),
    NEIGH('Gamma Frame', [{ id: 'ch-02', label: 'Chapter 2' }]),
  ]);
  eq(sp, [
    { chapter_id: 'ch-02', chapter_label: 'Chapter 2', frameworks: ['Alpha Frame', 'Gamma Frame'] },
    { chapter_id: 'ch-07', chapter_label: 'Chapter 7', frameworks: ['Alpha Frame', 'Beta Frame'] },
  ], 'sharedPremise sorted by chapter id');
  const r = render(input('problem-definition', askedResult()));
  const text = sectionText(r.body, H.shared);
  check(text && text.indexOf('Shared premise: Alpha Frame and Beta Frame both draw on Chapter 7. Their agreement is one line of reasoning, not two.') !== -1, 'shared premise line: ' + text);
});

arm('F8 no shared chapter means no Shared premise heading', () => {
  const a = askedResult({ results: Object.assign({}, askedResult().results, { neighborhoods: [
    NEIGH('Alpha Frame', [{ id: 'ch-01', label: 'Chapter 1' }]), NEIGH('Beta Frame', [{ id: 'ch-02', label: 'Chapter 2' }]) ] }) });
  const r = render(input('problem-definition', a));
  check(r.body.indexOf(H.shared) === -1, 'no Shared premise heading');
  eq(need().sharedPremise([]), [], 'empty neighborhoods');
  eq(need().sharedPremise([NEIGH('Solo', [{ id: 'ch-01', label: 'Chapter 1' }])]), [], 'one framework cannot share');
  eq(need().sharedPremise([NEIGH('Same', [{ id: 'ch-01', label: 'C' }]), NEIGH('Same', [{ id: 'ch-01', label: 'C' }])]), [], 'the same framework twice is not two frameworks');
});

arm('F9 foreign keys on the inputs never leak into the output', () => {
  const CANARY = 'ZZCANARY-venture-Quokka-9931';
  const a = askedResult({ governing_thought: CANARY + '-gt', title: CANARY + '-title', venture_name: CANARY + '-venture' });
  a.results.chapters = CHAPTERS.map((c) => Object.assign({ venture_name: CANARY + '-ch' }, c));
  a.results.commands = COMMAND_ROWS.map((c) => Object.assign({ governing_thought: CANARY + '-cmd' }, c));
  a.results.route = ROUTE.map((c) => Object.assign({ title: CANARY + '-route' }, c));
  a.results.neighborhoods = a.results.neighborhoods.map((n) => Object.assign({ venture_name: CANARY + '-n' }, n));
  const inp = input('problem-definition', a, { governing_thought: CANARY + '-in', title: CANARY + '-intitle', venture_name: CANARY + '-inv' });
  inp.identity = Object.assign({ governing_thought: CANARY + '-id' }, IDENTITY_OK);
  inp.sources.venture_name = CANARY + '-src';
  const r = need().renderTheoFace(inp);
  const all = r.body + JSON.stringify(r.frontmatter) + JSON.stringify(r.recommendations);
  check(all.indexOf('ZZCANARY') === -1, 'a planted string reached the output');
});

arm('F10 frontmatter is flat; suggested_commands and suggested_frameworks match the lists', () => {
  const distinct = navCommands.slice(0, 14);
  const rows = distinct.map((c, i) => ({ command: c, jtbd: 'job ' + i, framework: 'Alpha Frame' }));
  const a = askedResult({ results: Object.assign({}, askedResult().results, {
    commands: rows,
    route: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ step: n, framework: 'Fw ' + n })),
  }) });
  const r = render(input('problem-definition', a));
  for (const k of Object.keys(r.frontmatter)) {
    const v = r.frontmatter[k];
    check(v === null || ['string', 'number', 'boolean'].indexOf(typeof v) !== -1, 'frontmatter ' + k + ' is a scalar, got ' + typeof v);
    if (typeof v === 'string') check(v.indexOf('\n') === -1, 'frontmatter ' + k + ' has a newline');
  }
  const sc = r.frontmatter.suggested_commands.split(',');
  check(sc.length === 10, 'at most 10 suggested commands, got ' + sc.length);
  const sugg = sectionText(r.body, H.sugg);
  const cmdNames = sugg.split('\n').filter((l) => /^- \/mos:/.test(l)).map((l) => l.match(/^- \/mos:([a-z0-9-]+) /)[1]);
  eq(sc.map((e) => e.split(':')[0]), cmdNames, 'suggested_commands order equals the Commands lines');
  eq(cmdNames, distinct.slice(0, 10), 'the first ten distinct Theo rows, in Theo order');
  for (const e of sc) {
    const parts = e.split(':');
    check(parts.length === 3, 'command:cli:mcp triple: ' + e);
    const c = cap.capabilityFor(parts[0], { kind: 'command' });
    eq([parts[1], parts[2]], [c.cli, c.mcp], 'markers for ' + parts[0]);
  }
  eq(r.frontmatter.suggested_frameworks, 'Fw 1,Fw 2,Fw 3,Fw 4,Fw 5,Fw 6', 'at most 6 route names in route order');
  const nf = render(input('problem-definition', notAsked('offline')));
  eq([nf.frontmatter.suggested_commands, nf.frontmatter.suggested_frameworks], ['', ''], 'not asked suggests nothing');
});

arm('F11 dash guard over the test and the module', () => {
  for (const p of [__filename, MOD]) {
    if (!fs.existsSync(p)) throw new Error('missing ' + p);
    const t = fs.readFileSync(p, 'utf8');
    check(t.indexOf(EM) === -1 && t.indexOf(EN) === -1, 'em or en dash in ' + path.basename(p));
  }
});

arm('F12 provenance names only handles that crossed the wire (handles_on_wire)', () => {
  // problem_type only on the wire; frameworks, section and job were built but not sent
  const a = askedResult({ handles_on_wire: ['problem_type'] });
  const r = render(input('problem-definition', a));
  const prov = sectionText(r.body, H.prov);
  check(prov.indexOf('IllDefined') !== -1, 'the lens that was sent is named');
  check(prov.indexOf('Alpha Frame') === -1 && prov.indexOf('Beta Frame') === -1, 'frameworks not on the wire are not named: ' + prov);
  check(prov.indexOf('problem-definition') === -1 && prov.indexOf('find-problem') === -1, 'section and job are not named as sent: ' + prov);
  check(/section and job were not sent/i.test(prov), 'says plainly that section and job were not sent: ' + prov);
  eq(r.frontmatter.handles_on_wire, 'problem_type', 'handles_on_wire scalar');
  // frameworks only on the wire
  const b = askedResult({ handles_on_wire: ['frameworks'] });
  const rb = render(input('problem-definition', b));
  const pb = sectionText(rb.body, H.prov);
  check(pb.indexOf('IllDefined') === -1, 'a lens that was not sent is not named: ' + pb);
  check(pb.indexOf('Alpha Frame') !== -1 && pb.indexOf('Beta Frame') !== -1, 'frameworks that were sent are named');
  // both on the wire: both named, section and job still never named
  const c = render(input('problem-definition', askedResult()));
  const pc = sectionText(c.body, H.prov);
  check(pc.indexOf('IllDefined') !== -1 && pc.indexOf('Alpha Frame') !== -1, 'both named when both were sent');
  check(pc.indexOf('find-problem') === -1, 'job never named as sent');
  // the sweep: for every handle value in handles_sent that is not on the wire, the provenance must not name it
  const sweep = askedResult({ handles_on_wire: [] });
  const rs = render(input('problem-definition', sweep));
  const ps = sectionText(rs.body, H.prov);
  for (const v of ['IllDefined', 'Alpha Frame', 'Beta Frame', 'problem-definition', 'find-problem']) {
    check(ps.indexOf(v) === -1, 'provenance names "' + v + '" though no handle was on the wire: ' + ps);
  }
});

arm('F13 Theo text is single-line and never carries the corroboration stem or (no signal)', () => {
  const a = askedResult();
  a.results.commands = [{ command: CMD_A, jtbd: 'Theo corroborates this\nsecond line (no signal)', framework: 'Alpha Frame' }];
  const r = render(input('problem-definition', a));
  const all = r.body + JSON.stringify(r.frontmatter);
  check(!/corroborat/i.test(all), 'corroboration stem emitted');
  check(all.indexOf('(no signal)') === -1, '(no signal) emitted');
  const l = sectionText(r.body, H.sugg).split('\n').find((x) => x.indexOf('/mos:' + CMD_A + ' ') !== -1);
  check(l && l.indexOf('second line') !== -1, 'text kept, joined to one line: ' + l);
});

arm('F14 the module is pure: no fs, no network, no brain-client', () => {
  if (!fs.existsSync(MOD)) throw new Error('missing module');
  const t = fs.readFileSync(MOD, 'utf8');
  check(!/require\((['"])(node:)?fs\1\)|brain-client|fetch\(|https?\.request|require\((['"])(node:)?(http|https|net)\1\)/.test(t), 'module reaches fs or the network');
  check(!/corroborat/i.test(t) && t.indexOf('(no signal)') === -1, 'module source names the banned stem or sentinel');
});

arm('F15 an unready identity gives room_id null; an unknown command is marked, not guessed', () => {
  const r = render(input('problem-definition', askedResult(), { identity: IDENTITY_BAD }));
  eq(r.frontmatter.room_id, null, 'room_id null when identity is not ok');
  const a = askedResult();
  a.results.commands = [{ command: 'no-such-command-xyz', jtbd: 'j', framework: 'Alpha Frame' }];
  const r2 = render(input('problem-definition', a));
  const l = sectionText(r2.body, H.sugg).split('\n').find((x) => x.indexOf('/mos:no-such-command-xyz ') !== -1);
  check(l && /not a command on this install/.test(l), 'unknown command says so: ' + l);
  eq(r2.frontmatter.suggested_commands, 'no-such-command-xyz:unknown:unknown', 'unknown markers in the machine scalar');
});

arm('F16 across every render, the corroboration stem matched 0 times', () => {
  check(everyRender.length > 10, 'renders collected: ' + everyRender.length);
  const hits = everyRender.filter((t) => /corroborat/i.test(t)).length;
  eq(hits, 0, 'renders carrying the stem');
});

console.log('\nPASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
