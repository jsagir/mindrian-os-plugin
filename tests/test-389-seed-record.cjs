#!/usr/bin/env node
/*
 * Phase 389-05 -- test-389-seed-record.cjs
 *
 * Tests 1 to 9: the Seed record module (validate, id, write, read, list,
 * resolveFromBrief, renderReceipt). Tests 10 to 12: the two commands and two
 * skills point at resolveFromBrief, keep their frontmatter and their flow.
 * Every file test uses a scratch HOME. No real room, no network, no Brain call.
 * Plain counters. One line per behavior. Exit 1 on a failure.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MOD_PATH = path.join(ROOT, 'lib', 'core', 'pyramid-seed-record.cjs');
const ROUTER_PATH = path.join(ROOT, 'lib', 'core', 'mva-option-router.cjs');

let passed = 0;
let failed = 0;

function check(label, ok, detail) {
  if (ok) {
    passed++;
    console.log('ok   ' + label);
  } else {
    failed++;
    console.log('FAIL ' + label + (detail ? ' :: ' + detail : ''));
  }
}

function listTree(dir) {
  const out = [];
  (function walk(d) {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      out.push(path.relative(dir, p));
      if (e.isDirectory()) walk(p);
    }
  })(dir);
  return out.sort();
}

const DASH = new RegExp('[\\u2013\\u2014]');

function goodRecord(over) {
  return Object.assign({
    schema: 'mos.pyramid-seed/1',
    id: 'abc12345',
    created_at: '2026-11-08T10:00:00.000Z',
    depth: 'seed',
    situation: 'Small clinics order lab kits by phone.',
    complication: 'Orders get lost and kits arrive late.',
    question: 'How can a clinic order kits without losing an order?',
    answer: 'A shared order list that every clinic can see.',
    support: [
      { group: 'Orders are lost today', claims: ['Phone orders have no record.', 'Staff re-enter orders by hand.'] },
      { group: 'A list fixes the loss', claims: ['One list means one record.'] },
    ],
    objection: 'Clinics may refuse to change how they order.',
    evidence: [],
  }, over || {});
}

function main() {
  // ---------- module presence (RED leg) ----------
  const exists = fs.existsSync(MOD_PATH);
  check('Test 0: lib/core/pyramid-seed-record.cjs exists', exists);
  if (!exists) {
    console.log('test-389-seed-record: ' + passed + ' passed, ' + failed + ' failed (module missing)');
    process.exit(1);
  }

  const before = Object.keys(require.cache).length;
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  let printed = '';
  process.stdout.write = (s) => { printed += s; return true; };
  let M;
  try { M = require(MOD_PATH); } finally { process.stdout.write = stdoutWrite; }
  check('Test 9a: requiring the module prints nothing', printed === '', JSON.stringify(printed));
  const expected = ['SCHEMA', 'SHA8_RE', 'validateRecord', 'idFor', 'writeRecord', 'readRecord', 'listRecords', 'resolveFromBrief', 'renderReceipt'];
  check('exports are the contract', expected.every((k) => k in M) && Object.keys(M).length === expected.length, Object.keys(M).join(','));
  void before;

  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'test-389-05-'));
  const origHome = process.env.HOME;
  process.env.HOME = home;
  try {
    // ---------- Test 1: validateRecord ----------
    check('Test 1: a good record is accepted', M.validateRecord(goodRecord()).ok === true);
    const cases = [
      ['wrong schema', goodRecord({ schema: 'x' }), 'bad_schema'],
      ['id upper case', goodRecord({ id: 'ABCDEF12' }), 'bad_id'],
      ['id short', goodRecord({ id: 'abc1234' }), 'bad_id'],
      ['id path', goodRecord({ id: '../x' }), 'bad_id'],
      ['bad created_at', goodRecord({ created_at: 'not a date' }), 'bad_created_at'],
      ['bad depth', goodRecord({ depth: 'deep' }), 'bad_depth'],
      ['missing situation', goodRecord({ situation: '' }), 'missing_field'],
      ['missing complication', goodRecord({ complication: undefined }), 'missing_field'],
      ['missing question', goodRecord({ question: '   ' }), 'missing_field'],
      ['missing answer', goodRecord({ answer: 5 }), 'missing_field'],
      ['missing objection', goodRecord({ objection: '' }), 'missing_field'],
      ['answer over 400', goodRecord({ answer: 'x'.repeat(401) }), 'too_long'],
      ['objection over 300', goodRecord({ objection: 'x'.repeat(301) }), 'too_long'],
      ['support 1 item', goodRecord({ support: [{ group: 'g', claims: ['c'] }] }), 'bad_support_count'],
      ['support 6 items', goodRecord({ support: Array.from({ length: 6 }, () => ({ group: 'g', claims: ['c'] })) }), 'bad_support_count'],
      ['group with 0 claims', goodRecord({ support: [{ group: 'g', claims: [] }, { group: 'h', claims: ['c'] }] }), 'bad_claims_count'],
      ['group with 5 claims', goodRecord({ support: [{ group: 'g', claims: ['1', '2', '3', '4', '5'] }, { group: 'h', claims: ['c'] }] }), 'bad_claims_count'],
      ['group over 120', goodRecord({ support: [{ group: 'g'.repeat(121), claims: ['c'] }, { group: 'h', claims: ['c'] }] }), 'too_long'],
      ['claim over 200', goodRecord({ support: [{ group: 'g', claims: ['c'.repeat(201)] }, { group: 'h', claims: ['c'] }] }), 'too_long'],
      ['evidence not array', goodRecord({ evidence: {} }), 'bad_evidence'],
      ['bad status', goodRecord({ evidence: [{ cell: 'c1', status: 'maybe', summary_line: 's' }] }), 'bad_status'],
      ['summary over 160', goodRecord({ evidence: [{ cell: 'c1', status: 'ok', summary_line: 's'.repeat(161) }] }), 'too_long'],
      ['bad upgraded_from', goodRecord({ upgraded_from: 'XYZ' }), 'bad_upgraded_from'],
      ['null', null, 'not_object'],
      ['string', 'abc', 'not_object'],
      ['array', [], 'not_object'],
    ];
    for (const [name, rec, code] of cases) {
      let r;
      let threw = false;
      try { r = M.validateRecord(rec); } catch (_e) { threw = true; }
      check('Test 1: rejects ' + name + ' with ' + code, !threw && r && r.ok === false && r.code === code, threw ? 'threw' : JSON.stringify(r));
    }
    check('Test 1: accepts full depth, upgraded_from and evidence',
      M.validateRecord(goodRecord({ depth: 'full', upgraded_from: '0123abcd', evidence: [{ cell: 'c1', status: 'empty', summary_line: '' }] })).ok === true);
    check('Test 1: accepts support of 5 groups with 4 claims',
      M.validateRecord(goodRecord({ support: Array.from({ length: 5 }, () => ({ group: 'g', claims: ['1', '2', '3', '4'] })) })).ok === true);

    // ---------- Test 2: idFor ----------
    const a = M.idFor('A venture sentence about clinics');
    check('Test 2: idFor returns 8 lowercase hex', typeof a === 'string' && /^[0-9a-f]{8}$/.test(a), String(a));
    check('Test 2: idFor is stable', a === M.idFor('A venture sentence about clinics'));
    check('Test 2: idFor ignores outer space', a === M.idFor('  A venture sentence about clinics \n'));
    check('Test 2: idFor differs for a different sentence', a !== M.idFor('A different venture sentence'));
    check('Test 2: idFor of a non-string is null', M.idFor(42) === null && M.idFor(null) === null && M.idFor(undefined) === null);

    // ---------- Test 3: writeRecord ----------
    const filesBefore = listTree(home);
    const rec = goodRecord();
    const w = M.writeRecord(rec);
    const seedDir = path.join(home, '.mindrian', 'pyramid-seed', 'briefs');
    const target = path.join(seedDir, 'abc12345.json');
    check('Test 3: writeRecord returns ok and the path', w.ok === true && w.path === target, JSON.stringify(w));
    check('Test 3: the file exists and holds the record', fs.existsSync(target) && JSON.parse(fs.readFileSync(target, 'utf8')).answer === rec.answer);
    check('Test 3: file mode is 0600', (fs.statSync(target).mode & 0o777) === 0o600, (fs.statSync(target).mode & 0o777).toString(8));
    check('Test 3: no temp file remains', fs.readdirSync(seedDir).every((n) => !n.endsWith('.tmp')), fs.readdirSync(seedDir).join(','));
    const filesAfter = listTree(home);
    const added = filesAfter.filter((f) => filesBefore.indexOf(f) === -1);
    check('Test 3: every new path is under .mindrian/pyramid-seed', added.every((f) => f === '.mindrian' || f.startsWith('.mindrian' + path.sep + 'pyramid-seed')), added.join(','));
    const snap = listTree(home);
    const bad1 = M.writeRecord(goodRecord({ id: '../x' }));
    const bad2 = M.writeRecord(goodRecord({ answer: '' }));
    check('Test 3: refuses id ../x and an invalid record', bad1.ok === false && bad2.ok === false);
    check('Test 3: refused writes change nothing', JSON.stringify(listTree(home)) === JSON.stringify(snap));
    const tmpOpt = M.writeRecord(goodRecord({ id: '11111111' }), { home: home });
    check('Test 3: opts.home is honored', tmpOpt.ok === true && tmpOpt.path.startsWith(home));

    // ---------- Test 4: readRecord ----------
    const rBad = ['../../etc/passwd', 'ABCDEF12', '1234567', '123456789', 'abc 1234', 'abc.1234', null, 7];
    let guardOk = true;
    const origRead = fs.readFileSync;
    const origExists = fs.existsSync;
    let touched = 0;
    fs.readFileSync = function () { touched++; return origRead.apply(fs, arguments); };
    fs.existsSync = function () { touched++; return origExists.apply(fs, arguments); };
    try {
      for (const bad of rBad) {
        const r = M.readRecord(bad);
        if (!(r.ok === false && r.reason === 'invalid_id')) guardOk = false;
      }
    } finally {
      fs.readFileSync = origRead;
      fs.existsSync = origExists;
    }
    check('Test 4: bad ids are rejected without touching the file system', guardOk && touched === 0, 'touched=' + touched);
    const missing = M.readRecord('deadbeef');
    check('Test 4: a valid missing id gives not_found', missing.ok === false && missing.reason === 'not_found', JSON.stringify(missing));
    const got = M.readRecord('abc12345');
    check('Test 4: reads the Seed folder first', got.ok === true && got.source === 'seed' && got.record.answer === rec.answer);

    const legacyDir = path.join(home, '.mindrian', 'mva', 'briefs');
    fs.mkdirSync(legacyDir, { recursive: true });
    const legacyBrief = { venture_summary: 'Old venture', domains: ['biotech'], sha8: 'feedf00d' };
    fs.writeFileSync(path.join(legacyDir, 'feedf00d.json'), JSON.stringify(legacyBrief));
    const legacyBefore = fs.readFileSync(path.join(legacyDir, 'feedf00d.json'), 'utf8');
    const lr = M.readRecord('feedf00d');
    check('Test 4: falls back to the old side file with source legacy', lr.ok === true && lr.source === 'legacy' && lr.record.venture_summary === 'Old venture', JSON.stringify(lr));
    check('Test 4: the old side file is not changed', fs.readFileSync(path.join(legacyDir, 'feedf00d.json'), 'utf8') === legacyBefore && fs.readdirSync(legacyDir).length === 1);
    fs.writeFileSync(path.join(legacyDir, 'badbad01.json'), '{not json');
    const pe = M.readRecord('badbad01');
    check('Test 4: malformed old file gives parse_error', pe.ok === false && pe.reason === 'parse_error', JSON.stringify(pe));
    fs.writeFileSync(path.join(seedDir, 'badbad02.json'), '{not json');
    const pe2 = M.readRecord('badbad02');
    check('Test 4: malformed Seed file gives parse_error', pe2.ok === false && pe2.reason === 'parse_error');
    const snap2 = listTree(home);
    M.readRecord('abc12345'); M.readRecord('feedf00d'); M.readRecord('deadbeef');
    check('Test 4: reading never writes', JSON.stringify(listTree(home)) === JSON.stringify(snap2));

    // ---------- Test 5: resolveFromBrief ----------
    const rf = M.resolveFromBrief('abc12345');
    check('Test 5: valid record gives ignite_from_brief with the exact fields',
      rf.action === 'ignite_from_brief' && rf.sha8 === 'abc12345' && rf.canon_verb === 8 &&
      rf.invoke_command === '/mos:ignite --from-brief abc12345' && rf.brief_reward_pending === false &&
      rf.brief_content && rf.brief_content.answer === rec.answer && typeof rf.brief_content.receipt === 'string' &&
      rf.brief_content.receipt === M.renderReceipt(rec), JSON.stringify(Object.keys(rf)));
    const nb = M.resolveFromBrief('deadbeef');
    check('Test 5: missing id gives no_brief_available naming /mos:structure-argument',
      nb.action === 'no_brief_available' && nb.canon_verb === 8 && /\/mos:structure-argument/.test(nb.message) && nb.error === undefined);
    const inv = M.resolveFromBrief('../../x');
    check('Test 5: invalid id adds error invalid_sha8', inv.action === 'no_brief_available' && inv.error === 'invalid_sha8' && /structure-argument/.test(inv.message));
    const pe3 = M.resolveFromBrief('badbad02');
    check('Test 5: malformed JSON gives brief_parse_error with a message', pe3.action === 'brief_parse_error' && pe3.sha8 === 'badbad02' && typeof pe3.message === 'string' && pe3.canon_verb === 8);
    M.writeRecord(goodRecord({ id: '22222222', created_at: '2026-11-09T10:00:00.000Z' }));
    M.writeRecord(goodRecord({ id: '00000001', created_at: '2026-11-01T10:00:00.000Z' }));
    const nl = M.resolveFromBrief(null);
    check('Test 5: null uses the newest record by created_at', nl.action === 'ignite_from_brief' && nl.sha8 === '22222222', JSON.stringify(nl.sha8));
    check('Test 5: legacy-format file resolves with the old reward flag false', M.resolveFromBrief('feedf00d').brief_reward_pending === false);

    // ---------- Test 6: the hand-off resolves without the router (plan 08 retired it) ----------
    // This was a parity test while the router existed. The router is gone, so the leg is now a
    // positive assertion: it must not skip, and the Seed record path must answer on its own.
    check('Test 6: lib/core/mva-option-router.cjs is gone (retired in plan 08)', !fs.existsSync(ROUTER_PATH));
    check('Test 6: the router was never loaded in this process', !Object.keys(require.cache).some((k) => /mva-option-router/.test(k)));
    {
      const ok6 = M.resolveFromBrief('feedf00d');
      check('Test 6: an old side file still resolves to ignite_from_brief with the same fields',
        ok6.action === 'ignite_from_brief' && ok6.sha8 === 'feedf00d' && ok6.canon_verb === 8 &&
        ok6.invoke_command === '/mos:ignite --from-brief feedf00d' && ok6.brief_reward_pending === false &&
        !!ok6.brief_content, JSON.stringify(Object.keys(ok6)));
      const pe6 = M.resolveFromBrief('badbad01');
      check('Test 6: a malformed old file gives brief_parse_error with canon_verb 8',
        pe6.action === 'brief_parse_error' && pe6.sha8 === 'badbad01' && pe6.canon_verb === 8 && typeof pe6.message === 'string');
      const nb6 = M.resolveFromBrief('deadbeef');
      check('Test 6: a missing id gives no_brief_available with canon_verb 8 and no invoke_command',
        nb6.action === 'no_brief_available' && nb6.canon_verb === 8 && nb6.invoke_command === undefined);
    }

    // ---------- Test 7: renderReceipt ----------
    const withEv = goodRecord({
      answer: 'Answer with a dash \u2014 inside.',
      evidence: [
        { cell: 'market-size', status: 'ok', summary_line: 'Clinics lose 4 orders a week.' },
        { cell: 'competitors', status: 'empty', summary_line: '' },
        { cell: 'pricing', status: 'timeout', summary_line: '' },
      ],
    });
    const text = M.renderReceipt(withEv);
    const tl = text.split('\n');
    check('Test 7: starts with a title line, then the answer', tl[0].length > 0 && !/^Answer/.test(tl[0]) && /^Answer: /.test(tl[1]), tl.slice(0, 2).join(' | '));
    const iSupport1 = text.indexOf('Orders are lost today');
    const iSupport2 = text.indexOf('A list fixes the loss');
    const iObj = text.indexOf('Clinics may refuse');
    const iEv = text.indexOf('Clinics lose 4 orders');
    check('Test 7: answer, groups in order, objection, evidence in order',
      text.indexOf('A shared order list') < iSupport1 && iSupport1 < iSupport2 && iSupport2 < iObj && iObj < iEv && iEv > 0);
    check('Test 7: each evidence line is labeled and names its cell', /market-size: outside evidence, quoted: "Clinics lose 4 orders a week\."/.test(text));
    check('Test 7: only ok evidence is shown', !/competitors|pricing/.test(text));
    check('Test 7: group claims are shown', /Phone orders have no record\./.test(text) && /One list means one record\./.test(text));
    check('Test 7: 60 lines or fewer', tl.length <= 60, String(tl.length));
    check('Test 7: deterministic', text === M.renderReceipt(JSON.parse(JSON.stringify(withEv))));
    check('Test 7: no em dash or en dash', !DASH.test(text));
    const noEv = M.renderReceipt(goodRecord());
    check('Test 7: empty evidence gives no evidence section', !/evidence/i.test(noEv));
    const noOk = M.renderReceipt(goodRecord({ evidence: [{ cell: 'x', status: 'error', summary_line: '' }] }));
    check('Test 7: evidence without an ok entry gives no evidence section', !/evidence/i.test(noOk));
    const big = goodRecord({
      support: Array.from({ length: 5 }, (_, i) => ({ group: 'Group ' + i, claims: ['a', 'b', 'c', 'd'] })),
      evidence: Array.from({ length: 40 }, (_, i) => ({ cell: 'cell' + i, status: 'ok', summary_line: 'line ' + i })),
    });
    check('Test 7: the largest record still fits in 60 lines', M.renderReceipt(big).split('\n').length <= 60, String(M.renderReceipt(big).split('\n').length));
    check('Test 7: a newline inside a field does not add lines',
      M.renderReceipt(goodRecord({ answer: 'one\ntwo\nthree' })).split('\n').length === M.renderReceipt(goodRecord()).split('\n').length);

    // ---------- Test 8: listRecords ----------
    fs.writeFileSync(path.join(seedDir, 'notes.json'), '{}');
    fs.writeFileSync(path.join(seedDir, 'ABCDEF12.json'), '{}');
    fs.writeFileSync(path.join(seedDir, 'abc12345.txt'), 'x');
    const ids = M.listRecords();
    check('Test 8: ids newest first, bad names ignored',
      ids[0] === '22222222' && ids.indexOf('abc12345') > 0 && ids.indexOf('abc12345') < ids.indexOf('00000001'),
      ids.join(','));
    check('Test 8: nothing that is not a valid id is listed', ids.every((i) => /^[0-9a-f]{8}$/.test(i)) && ids.indexOf('notes') === -1);
    check('Test 8: an empty home lists nothing', M.listRecords({ home: path.join(home, 'nowhere') }).length === 0);

    // ---------- Test 9 (static) ----------
    const src = fs.readFileSync(MOD_PATH, 'utf8');
    check('Test 9b: the module file holds no em dash or en dash', !DASH.test(src));
    const reqs = (src.match(/require\(['"][^'"]+['"]\)/g) || []).map((s) => s.replace(/require\(['"]|['"]\)/g, ''));
    const allowed = ['node:fs', 'node:path', 'node:os', 'node:crypto'];
    check('Test 9c: requires built-ins only, no room-db and no network module', reqs.every((r) => allowed.indexOf(r) !== -1), reqs.join(','));
    check('Test 9d: no fetch call and no http word in code', !/\bfetch\(|node:https?|brain-client|room-db/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
    check('Test 9e: the module does not require the option router', !/mva-option-router/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
    check('Test 9f: the SHA8 check is kept', M.SHA8_RE.source === '^[0-9a-f]{8}$');
  } finally {
    process.env.HOME = origHome;
    fs.rmSync(home, { recursive: true, force: true });
  }

  docsTests();
}

// ---------- Tests 10 to 12: docs ----------

const DOC_FILES = [
  'commands/ignite.md',
  'commands/new-project.md',
  'skills/ignite/SKILL.md',
  'skills/new-project/SKILL.md',
];

function frontLines(text) {
  return text.split('\n').filter((l) => /^(teaching|help_jtbd):/.test(l));
}

function docsTests() {
  for (const rel of DOC_FILES) {
    const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    check('Test 10: ' + rel + ' has no resolveOption2 and no mva-option-router',
      !/resolveOption2/.test(t) && !/mva-option-router/.test(t));
    check('Test 10: ' + rel + ' names resolveFromBrief and lib/core/pyramid-seed-record.cjs',
      /resolveFromBrief/.test(t) && /lib\/core\/pyramid-seed-record\.cjs/.test(t));

    const head = spawnSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (head.status !== 0) {
      check('Test 11: ' + rel + ' teaching and help_jtbd equal HEAD', false, 'git show failed');
    } else {
      const a = frontLines(head.stdout);
      const b = frontLines(t);
      check('Test 11: ' + rel + ' teaching and help_jtbd equal HEAD (' + a.length + ' lines)',
        a.length >= 2 && JSON.stringify(a) === JSON.stringify(b));
    }
  }

  const ign = fs.readFileSync(path.join(ROOT, 'commands/ignite.md'), 'utf8');
  const ignS = fs.readFileSync(path.join(ROOT, 'skills/ignite/SKILL.md'), 'utf8');
  const np = fs.readFileSync(path.join(ROOT, 'commands/new-project.md'), 'utf8');
  const npS = fs.readFileSync(path.join(ROOT, 'skills/new-project/SKILL.md'), 'utf8');
  for (const [rel, t] of [['commands/ignite.md', ign], ['skills/ignite/SKILL.md', ignS]]) {
    check('Test 12: ' + rel + ' keeps the B2 flow and the reward flag',
      /--from-brief <sha8>/.test(t) && /proceeds to B2|then proceeds to B2/.test(t) && /brief_reward_pending/.test(t));
  }
  for (const [rel, t] of [['commands/new-project.md', np], ['skills/new-project/SKILL.md', npS]]) {
    check('Test 12: ' + rel + ' keeps the three actions, the fallback and the B2 gate',
      /ignite_from_brief/.test(t) && /no_brief_available/.test(t) && /brief_parse_error/.test(t) &&
      /standard Step 2-3 conversation flow/.test(t) && /B2 blueprint gate/.test(t) && /brief_reward_pending/.test(t));
  }
  check('Test 12: the old side file is still named as a fallback in the text',
    /older brief side file/.test(ign) && /older brief side file/.test(np));

  console.log('test-389-seed-record: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

main();
