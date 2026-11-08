#!/usr/bin/env node
'use strict';
// Phase 389 owner card checker (plan 389-02).
//
// Commands:
//   selftest                 run the 9 behaviors against synthetic cards
//   hash FILE                print the SHA-256 of the items section of the card
//   check FILE               validate the whole card (structure, hash, HEAD, tokens, coupling)
//   gate FILE D1 [D2 ...]    exit 0 only if every requested item is APPROVED or ALTERNATIVE
//
// Gate output, one line per requested item: D<n> <token> <STATE>
//   STATE is APPROVED (exact token APPROVE), ALTERNATIVE (a listed non-APPROVE token),
//   PENDING, UNKNOWN-TOKEN, or BLOCKED (a go state while the card has a global problem).
// A consuming plan acts only on APPROVED, or on the alternative step its own text names.
// Node built-ins only. Plain ASCII.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cp = require('child_process');

// ---- constants copied from the plan context (allowed tokens and coupling rules) ----
const ITEM_COUNT = 11;
const ALLOWED = {
  1: ['APPROVE', 'KEEP-HOOK'],
  2: ['APPROVE', 'KEEP-DETACHED'],
  3: ['APPROVE', 'NO'],
  4: ['APPROVE', 'NO'],
  5: ['APPROVE', 'NO'],
  6: ['APPROVE', 'NO'],
  7: ['APPROVE', 'NO'],
  8: ['APPROVE', 'NO-ALIAS'],
  9: ['APPROVE', 'NO'],
  10: ['APPROVE', 'DROP', 'NO'],
  11: ['APPROVE', 'FLAG-FALSE'],
};
// when: [item, token]; needs: list of [item, token]. All needs must hold when the "when" holds.
const COUPLING = [
  { when: [1, 'APPROVE'], needs: [[2, 'APPROVE']] },
  { when: [6, 'APPROVE'], needs: [[1, 'APPROVE'], [2, 'APPROVE']] },
  { when: [10, 'DROP'], needs: [[6, 'APPROVE']] },
  { when: [2, 'KEEP-DETACHED'], needs: [[1, 'KEEP-HOOK'], [6, 'NO']] },
];
const MARK_START = '<!-- items:start -->';
const MARK_END = '<!-- items:end -->';

function rtrimLine(l) { return l.replace(/[ \t\r]+$/, ''); }

// Find the marker lines. Returns {ok, s, e, problem}.
function locateMarkers(lines) {
  const starts = [];
  const ends = [];
  lines.forEach(function (l, i) {
    const t = rtrimLine(l);
    if (t === MARK_START) starts.push(i);
    if (t === MARK_END) ends.push(i);
  });
  if (starts.length !== 1) return { ok: false, problem: 'MARKERS start marker count ' + starts.length };
  if (ends.length !== 1) return { ok: false, problem: 'MARKERS end marker count ' + ends.length };
  if (starts[0] >= ends[0]) return { ok: false, problem: 'MARKERS start marker is not before the end marker' };
  return { ok: true, s: starts[0], e: ends[0] };
}

// Text between the marker lines: trailing spaces trimmed, LF only, no trailing blank line.
function hashItemsText(lines, m) {
  const body = lines.slice(m.s + 1, m.e).map(rtrimLine);
  while (body.length && body[body.length - 1] === '') body.pop();
  return crypto.createHash('sha256').update(body.join('\n'), 'utf8').digest('hex');
}

// Read the card and compute every fact. Does not decide pass or fail.
function evaluate(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const m = locateMarkers(lines);
  const problems = [];
  if (!m.ok) problems.push(m.problem);
  const inItems = function (i) { return m.ok && i > m.s && i < m.e; };
  const tokens = {};
  const heads = [];
  const shas = [];
  lines.forEach(function (raw, i) {
    if (inItems(i)) return;
    const t = raw.replace(/[ \r]+$/, '');
    if (t.indexOf('OWNER-ANSWER-D') === 0) {
      const mm = /^OWNER-ANSWER-D([0-9]+): (.+)$/.exec(t);
      if (!mm) { problems.push('MALFORMED-LINE ' + (i + 1)); return; }
      const n = Number(mm[1]);
      if (String(n) !== mm[1] || n < 1 || n > ITEM_COUNT) { problems.push('EXTRA-ANSWER-LINE D' + mm[1]); return; }
      (tokens[n] = tokens[n] || []).push(mm[2]);
    } else if (t.indexOf('HEAD-AT-DECISION') === 0) {
      const mm = /^HEAD-AT-DECISION: ([0-9a-f]{40})$/.exec(t);
      if (!mm) { problems.push('MALFORMED-LINE ' + (i + 1)); return; }
      heads.push(mm[1]);
    } else if (t.indexOf('ITEMS-SHA256') === 0) {
      const mm = /^ITEMS-SHA256: ([0-9a-f]{64})$/.exec(t);
      if (!mm) { problems.push('MALFORMED-LINE ' + (i + 1)); return; }
      shas.push(mm[1]);
    }
  });
  const items = {};
  for (let n = 1; n <= ITEM_COUNT; n++) {
    const list = tokens[n] || [];
    if (list.length === 0) {
      problems.push('MISSING D' + n);
      items[n] = { token: 'MISSING', state: 'UNKNOWN-TOKEN', value: null };
    } else if (list.length > 1) {
      problems.push('DUPLICATE D' + n);
      items[n] = { token: 'DUPLICATE', state: 'UNKNOWN-TOKEN', value: null };
    } else {
      const tok = list[0];
      let state = 'UNKNOWN-TOKEN';
      let value = null;
      if (tok === 'PENDING') state = 'PENDING';
      else if (ALLOWED[n].indexOf(tok) >= 0) { state = tok === 'APPROVE' ? 'APPROVED' : 'ALTERNATIVE'; value = tok; }
      items[n] = { token: tok, state: state, value: value };
    }
  }
  if (heads.length !== 1) problems.push('HEAD-LINE count ' + heads.length);
  if (shas.length !== 1) problems.push('SHA-LINE count ' + shas.length);
  if (m.ok && shas.length === 1) {
    const actual = hashItemsText(lines, m);
    if (actual !== shas[0]) problems.push('HASH-MISMATCH expected=' + shas[0] + ' actual=' + actual);
  }
  if (heads.length === 1) {
    const r = cp.spawnSync('git', ['merge-base', '--is-ancestor', heads[0], 'HEAD'], {
      cwd: path.dirname(path.resolve(file)), encoding: 'utf8',
    });
    if (r.status !== 0) problems.push('HEAD-NOT-ANCESTOR ' + heads[0] + ' (git exit ' + r.status + ')');
  }
  // Coupling over the whole card, for items that were not requested too.
  COUPLING.forEach(function (rule) {
    const w = items[rule.when[0]];
    if (!w || w.value !== rule.when[1]) return;
    rule.needs.forEach(function (need) {
      const x = items[need[0]];
      if (!x || x.value !== need[1]) problems.push('COUPLING D' + rule.when[0] + ' needs D' + need[0]);
    });
  });
  return { problems: problems, items: items, markers: m, lines: lines };
}

function cmdHash(file) {
  if (!file) { console.log('usage: 389-decision.cjs hash FILE'); return 2; }
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const m = locateMarkers(lines);
  if (!m.ok) { console.log(m.problem); return 1; }
  console.log(hashItemsText(lines, m));
  return 0;
}

function cmdCheck(file) {
  if (!file) { console.log('usage: 389-decision.cjs check FILE'); return 2; }
  const ev = evaluate(file);
  const problems = ev.problems.slice();
  for (let n = 1; n <= ITEM_COUNT; n++) {
    const it = ev.items[n];
    if (it.state === 'UNKNOWN-TOKEN' && it.token !== 'MISSING' && it.token !== 'DUPLICATE') {
      problems.push('UNKNOWN-TOKEN D' + n + ' ' + it.token);
    }
  }
  if (problems.length) {
    problems.forEach(function (p) { console.log(p); });
    console.log('CHECK FAIL');
    return 1;
  }
  let pending = 0;
  for (let n = 1; n <= ITEM_COUNT; n++) if (ev.items[n].state === 'PENDING') pending++;
  console.log('CHECK OK: 11 answer lines, hash matches, HEAD is an ancestor, ' + pending + ' PENDING');
  return 0;
}

function cmdGate(file, names) {
  if (!file || !names || names.length === 0) {
    console.log('usage: 389-decision.cjs gate FILE D1 [D2 ...]');
    return 2;
  }
  const wanted = [];
  for (let i = 0; i < names.length; i++) {
    const mm = /^D([0-9]+)$/.exec(names[i]);
    const n = mm ? Number(mm[1]) : 0;
    if (!mm || String(n) !== mm[1] || n < 1 || n > ITEM_COUNT) {
      console.log('UNKNOWN-ITEM ' + names[i]);
      console.log('GATE FAIL');
      return 1;
    }
    wanted.push(n);
  }
  const ev = evaluate(file);
  ev.problems.forEach(function (p) { console.log(p); });
  let go = ev.problems.length === 0;
  wanted.forEach(function (n) {
    const it = ev.items[n];
    let state = it.state;
    if ((state === 'APPROVED' || state === 'ALTERNATIVE') && ev.problems.length) state = 'BLOCKED';
    if (state !== 'APPROVED' && state !== 'ALTERNATIVE') go = false;
    console.log('D' + n + ' ' + it.token + ' ' + state);
  });
  console.log(go ? 'GATE PASS' : 'GATE FAIL');
  return go ? 0 : 1;
}


// ---- self-test ----
function selftest() {
  const SELF = __filename;
  let pass = 0;
  let fail = 0;
  function ok(name, cond, detail) {
    if (cond) { pass++; console.log('PASS ' + name); }
    else { fail++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
  }
  function run(args) {
    const r = cp.spawnSync(process.execPath, [SELF].concat(args), { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  }
  function git(cwd, args) {
    const base = ['-c', 'user.name=selftest', '-c', 'user.email=selftest@example.invalid',
      '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null'];
    const r = cp.spawnSync('git', base.concat(args), { cwd: cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + (r.stderr || ''));
    return (r.stdout || '').trim();
  }
  function refHash(items) {
    const t = items.split(/\r?\n/).map(function (l) { return l.replace(/[ \t\r]+$/, ''); }).join('\n').replace(/\n+$/, '');
    return crypto.createHash('sha256').update(t, 'utf8').digest('hex');
  }
  const ITEMS = 'Item text one  \nItem text two\n';
  function allApprove() {
    const a = {};
    for (let n = 1; n <= ITEM_COUNT; n++) a[n] = 'APPROVE';
    return a;
  }
  function allPending() {
    const a = {};
    for (let n = 1; n <= ITEM_COUNT; n++) a[n] = 'PENDING';
    return a;
  }
  // Build a synthetic card as text. o.answers: n -> token. o.drop: items to omit. o.dup: items to repeat.
  function cardText(o) {
    const eol = o.eol || '\n';
    const pad = o.pad || '';
    const items = o.items === undefined ? ITEMS : o.items;
    const L = ['# Synthetic card', '', MARK_START].concat(items.split('\n')).concat([MARK_END, '']);
    const ans = o.answers || allPending();
    for (let n = 1; n <= ITEM_COUNT; n++) {
      if ((o.drop || []).indexOf(n) >= 0) continue;
      L.push('OWNER-ANSWER-D' + n + ': ' + ans[n] + pad);
      if ((o.dup || []).indexOf(n) >= 0) L.push('OWNER-ANSWER-D' + n + ': ' + ans[n] + pad);
    }
    (o.extra || []).forEach(function (x) { L.push(x); });
    if (!o.noHead) L.push('HEAD-AT-DECISION: ' + o.head);
    L.push('ITEMS-SHA256: ' + (o.sha || refHash(items)));
    return L.join(eol) + eol;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dec389-'));
  try {
    git(tmp, ['init', '-q']);
    fs.writeFileSync(path.join(tmp, 'a.txt'), 'a\n');
    git(tmp, ['add', 'a.txt']);
    git(tmp, ['commit', '-q', '-m', 'first']);
    const headA = git(tmp, ['rev-parse', 'HEAD']);
    fs.writeFileSync(path.join(tmp, 'b.txt'), 'b\n');
    git(tmp, ['add', 'b.txt']);
    git(tmp, ['commit', '-q', '-m', 'second']);
    const branch = git(tmp, ['branch', '--show-current']);
    git(tmp, ['checkout', '-q', '-b', 'side']);
    fs.writeFileSync(path.join(tmp, 'c.txt'), 'c\n');
    git(tmp, ['add', 'c.txt']);
    git(tmp, ['commit', '-q', '-m', 'side']);
    const headSide = git(tmp, ['rev-parse', 'HEAD']);
    git(tmp, ['checkout', '-q', branch]);

    let seq = 0;
    function put(o) {
      seq++;
      const f = path.join(tmp, 'card' + seq + '.md');
      const o2 = Object.assign({ head: headA }, o);
      fs.writeFileSync(f, cardText(o2));
      return f;
    }
    function putRaw(text) {
      seq++;
      const f = path.join(tmp, 'card' + seq + '.md');
      fs.writeFileSync(f, text);
      return f;
    }
    function approveWith(over) {
      return Object.assign(allApprove(), over || {});
    }

    // Test 1: PENDING
    {
      const f = put({});
      const r = run(['gate', f, 'D1']);
      ok('T1 pending gate exits 1', r.code === 1, 'code ' + r.code);
      ok('T1 pending prints "D1 PENDING PENDING"', /^D1 PENDING PENDING$/m.test(r.out), r.out);
      const c = run(['check', f]);
      ok('T1 check accepts an all-PENDING card', c.code === 0, c.out);
    }
    // Test 2: unknown token
    {
      const f = put({ answers: approveWith({ 3: 'MAYBE' }) });
      const r = run(['gate', f, 'D3']);
      ok('T2 unknown token exits 1', r.code === 1, 'code ' + r.code);
      ok('T2 prints UNKNOWN-TOKEN', /^D3 MAYBE UNKNOWN-TOKEN$/m.test(r.out), r.out);
    }
    // Test 3: hash mismatch
    {
      const f = put({ answers: allApprove() });
      const good = run(['gate', f, 'D1']);
      ok('T3 control: unedited all-APPROVE card passes D1', good.code === 0, good.out);
      const edited = fs.readFileSync(f, 'utf8').replace('Item text two', 'Item text 2wo');
      const g = putRaw(edited);
      const r = run(['gate', g, 'D1']);
      ok('T3 edited items exit 1', r.code === 1, 'code ' + r.code);
      ok('T3 prints HASH-MISMATCH', /HASH-MISMATCH/.test(r.out), r.out);
      ok('T3 prints no APPROVED on a failing run', !/APPROVED/.test(r.out), r.out);
    }
    // Test 4: HEAD not an ancestor
    {
      const f = put({ answers: allApprove(), head: headSide });
      const r = run(['gate', f, 'D1']);
      ok('T4 side-branch HEAD exits 1', r.code === 1, 'code ' + r.code);
      ok('T4 prints HEAD-NOT-ANCESTOR', /HEAD-NOT-ANCESTOR/.test(r.out), r.out);
      const f2 = put({ answers: allApprove(), head: '0'.repeat(40) });
      const r2 = run(['gate', f2, 'D1']);
      ok('T4 unknown sha exits 1 with HEAD-NOT-ANCESTOR', r2.code === 1 && /HEAD-NOT-ANCESTOR/.test(r2.out), r2.out);
      const f3 = put({ answers: allApprove(), head: 'abc' });
      const r3 = run(['gate', f3, 'D1']);
      ok('T4 malformed sha exits 1', r3.code === 1, r3.out);
    }
    // Test 5: coupling
    {
      const a = run(['gate', put({ answers: approveWith({ 2: 'KEEP-DETACHED' }) }), 'D1']);
      ok('T5 D1 APPROVE with D2 KEEP-DETACHED exits 1', a.code === 1 && /COUPLING D1 needs D2/.test(a.out), a.out);
      const b = run(['gate', put({ answers: approveWith({ 1: 'KEEP-HOOK' }) }), 'D6']);
      ok('T5 D6 APPROVE with D1 KEEP-HOOK exits 1', b.code === 1 && /COUPLING D6 needs D1/.test(b.out), b.out);
      const b2 = run(['gate', put({ answers: approveWith({ 2: 'KEEP-DETACHED' }) }), 'D6']);
      ok('T5 D6 APPROVE with D2 KEEP-DETACHED exits 1', b2.code === 1 && /COUPLING D6 needs D2/.test(b2.out), b2.out);
      const c = run(['gate', put({ answers: approveWith({ 6: 'NO', 10: 'DROP' }) }), 'D10']);
      ok('T5 D10 DROP with D6 NO exits 1', c.code === 1 && /COUPLING D10 needs D6/.test(c.out), c.out);
      const d = run(['gate', put({ answers: approveWith({ 2: 'KEEP-DETACHED', 6: 'NO' }) }), 'D2']);
      ok('T5 D2 KEEP-DETACHED with D1 APPROVE exits 1', d.code === 1 && /COUPLING D2 needs D1/.test(d.out), d.out);
      const e = run(['gate', put({ answers: approveWith({ 1: 'KEEP-HOOK', 2: 'KEEP-DETACHED' }) }), 'D2']);
      ok('T5 D2 KEEP-DETACHED with D6 APPROVE exits 1', e.code === 1 && /COUPLING D2 needs D6/.test(e.out), e.out);
      const f = run(['gate', put({ answers: approveWith({ 1: 'KEEP-HOOK', 2: 'KEEP-DETACHED', 6: 'NO', 10: 'NO' }) }), 'D3']);
      ok('T5 gate on an unrelated item still enforces a broken pair elsewhere: ok pair passes', f.code === 0, f.out);
      const g = run(['gate', put({ answers: approveWith({ 2: 'KEEP-DETACHED' }) }), 'D3']);
      ok('T5 coupling is enforced for an item that was not requested', g.code === 1 && /COUPLING/.test(g.out), g.out);
      const h = run(['gate', put({ answers: approveWith({ 10: 'DROP' }) }), 'D10']);
      ok('T5 D10 DROP with D6 APPROVE passes as ALTERNATIVE', h.code === 0 && /^D10 DROP ALTERNATIVE$/m.test(h.out), h.out);
      const i = run(['gate', put({ answers: approveWith({ 1: 'KEEP-HOOK', 2: 'KEEP-DETACHED', 6: 'NO' }) }), 'D1', 'D2', 'D6']);
      ok('T5 valid keep-everything set passes', i.code === 0 && /^D2 KEEP-DETACHED ALTERNATIVE$/m.test(i.out), i.out);
    }
    // Test 6: all APPROVE and ALTERNATIVE
    {
      const all = [];
      for (let n = 1; n <= ITEM_COUNT; n++) all.push('D' + n);
      const r = run(['gate', put({ answers: allApprove() }), ...all]);
      let lines = 0;
      for (let n = 1; n <= ITEM_COUNT; n++) if (new RegExp('^D' + n + ' APPROVE APPROVED$', 'm').test(r.out)) lines++;
      ok('T6 all APPROVE exits 0', r.code === 0, 'code ' + r.code + ' ' + r.out);
      ok('T6 prints D<n> APPROVE APPROVED for all 11', lines === 11, 'lines ' + lines);
      const r2 = run(['gate', put({ answers: approveWith({ 3: 'NO', 11: 'FLAG-FALSE', 8: 'NO-ALIAS' }) }), 'D3', 'D11', 'D8', 'D4']);
      ok('T6 listed non-APPROVE tokens exit 0', r2.code === 0, r2.out);
      ok('T6 prints ALTERNATIVE for D3, D11, D8 and APPROVED for D4',
        /^D3 NO ALTERNATIVE$/m.test(r2.out) && /^D11 FLAG-FALSE ALTERNATIVE$/m.test(r2.out) &&
        /^D8 NO-ALIAS ALTERNATIVE$/m.test(r2.out) && /^D4 APPROVE APPROVED$/m.test(r2.out), r2.out);
      const r3 = run(['gate', put({ answers: approveWith({ 4: 'PENDING' }) }), 'D3', 'D4']);
      ok('T6 one PENDING item among requested items exits 1', r3.code === 1 && /^D4 PENDING PENDING$/m.test(r3.out), r3.out);
      const r4 = run(['gate', put({ answers: allApprove() }), 'D12']);
      ok('T6 unknown item name exits 1', r4.code === 1, r4.out);
    }
    // Test 7: check on structure
    {
      const good = run(['check', put({})]);
      ok('T7 check accepts a well-formed card', good.code === 0, good.out);
      const fewer = run(['check', put({ drop: [5] })]);
      ok('T7 check rejects 10 answer lines', fewer.code === 1, fewer.out);
      const more = run(['check', put({ extra: ['OWNER-ANSWER-D12: PENDING'] })]);
      ok('T7 check rejects 12 answer lines', more.code === 1, more.out);
      const base = cardText({ head: headA });
      const noStart = run(['check', putRaw(base.replace(MARK_START + '\n', ''))]);
      ok('T7 check rejects a missing start marker', noStart.code === 1, noStart.out);
      const noEnd = run(['check', putRaw(base.replace(MARK_END + '\n', ''))]);
      ok('T7 check rejects a missing end marker', noEnd.code === 1, noEnd.out);
      const noHead = run(['check', put({ noHead: true })]);
      ok('T7 check rejects a missing HEAD-AT-DECISION line', noHead.code === 1, noHead.out);
      const noSha = run(['check', putRaw(base.replace(/^ITEMS-SHA256: .*\n/m, ''))]);
      ok('T7 check rejects a missing ITEMS-SHA256 line', noSha.code === 1, noSha.out);
      const swapped = run(['check', putRaw(base.replace(MARK_START, 'X-TMP').replace(MARK_END, MARK_START).replace('X-TMP', MARK_END))]);
      ok('T7 check rejects markers in the wrong order', swapped.code === 1, swapped.out);
    }
    // Test 8: exact tokens only
    {
      const bad = ['approve', 'Approve', 'APPROVE-MOST', 'APPROVE # ok', 'APPROVE now', 'APPROVE.', ' APPROVE', 'APPROVE\t', 'KEEP-HOOK APPROVE'];
      bad.forEach(function (tok) {
        const a = allApprove();
        a[1] = tok;
        const r = run(['gate', put({ answers: a }), 'D1']);
        ok('T8 token "' + tok.replace(/\t/g, '<TAB>') + '" is UNKNOWN-TOKEN and exit 1',
          r.code === 1 && /UNKNOWN-TOKEN/.test(r.out) && !/APPROVED/.test(r.out), r.out);
      });
      const cross = [[3, 'KEEP-HOOK'], [1, 'DROP'], [9, 'FLAG-FALSE'], [2, 'NO'], [11, 'NO'], [8, 'NO']];
      cross.forEach(function (p) {
        const a = allApprove();
        a[p[0]] = p[1];
        const r = run(['gate', put({ answers: a }), 'D' + p[0]]);
        ok('T8 D' + p[0] + ' token ' + p[1] + ' belongs to another item: UNKNOWN-TOKEN',
          r.code === 1 && /UNKNOWN-TOKEN/.test(r.out), r.out);
      });
      const dupCard = put({ answers: allApprove(), dup: [1] });
      const dup = run(['gate', dupCard, 'D1']);
      ok('T8 duplicate D1 line: gate exit 1 UNKNOWN-TOKEN', dup.code === 1 && /UNKNOWN-TOKEN/.test(dup.out) && !/APPROVED/.test(dup.out), dup.out);
      ok('T8 duplicate D1 line: check exit 1', run(['check', dupCard]).code === 1);
      const missCard = put({ answers: allApprove(), drop: [1] });
      const miss = run(['gate', missCard, 'D1']);
      ok('T8 missing D1 line: gate exit 1 UNKNOWN-TOKEN', miss.code === 1 && /UNKNOWN-TOKEN/.test(miss.out) && !/APPROVED/.test(miss.out), miss.out);
      ok('T8 missing D1 line: check exit 1', run(['check', missCard]).code === 1);
      const noSpace = putRaw(cardText({ answers: allApprove(), head: headA }).replace('OWNER-ANSWER-D1: APPROVE', 'OWNER-ANSWER-D1:APPROVE'));
      const ns = run(['gate', noSpace, 'D1']);
      ok('T8 line without the space after the colon is not a go', ns.code === 1 && !/APPROVED/.test(ns.out), ns.out);
      const indented = putRaw(cardText({ answers: allApprove(), head: headA }).replace('OWNER-ANSWER-D1: APPROVE', '  OWNER-ANSWER-D1: APPROVE'));
      const ind = run(['gate', indented, 'D1']);
      ok('T8 indented line is not an answer line', ind.code === 1 && !/APPROVED/.test(ind.out), ind.out);
      const inside = putRaw(cardText({ answers: allPending(), items: ITEMS + 'OWNER-ANSWER-D1: APPROVE\n', head: headA }));
      const ins = run(['gate', inside, 'D1']);
      ok('T8 an answer-like line inside the items section is ignored', ins.code === 1 && /^D1 PENDING PENDING$/m.test(ins.out), ins.out);
      const sp = run(['gate', put({ answers: allApprove(), pad: '   ' }), 'D1']);
      ok('T8 trailing spaces are removed before the match', sp.code === 0 && /^D1 APPROVE APPROVED$/m.test(sp.out), sp.out);
      const crlf = run(['gate', put({ answers: allApprove(), eol: '\r\n' }), 'D1']);
      ok('T8 CRLF line ends are accepted and the hash still matches', crlf.code === 0 && /^D1 APPROVE APPROVED$/m.test(crlf.out), crlf.out);
    }
    // Test 9: hash
    {
      const f = put({ items: 'Alpha  \nBeta\n\n' });
      const expected = crypto.createHash('sha256').update('Alpha\nBeta', 'utf8').digest('hex');
      const h = run(['hash', f]);
      ok('T9 hash prints the SHA-256 of the trimmed LF items section', h.code === 0 && h.out.trim() === expected, h.out + ' vs ' + expected);
      const f2 = put({ items: 'Alpha  \nBetb\n\n' });
      const h2 = run(['hash', f2]);
      ok('T9 one changed character changes the hash', h2.code === 0 && h2.out.trim() !== expected, h2.out);
      const f3 = putRaw(fs.readFileSync(f, 'utf8').replace('OWNER-ANSWER-D1: PENDING', 'OWNER-ANSWER-D1: APPROVE'));
      const h3 = run(['hash', f3]);
      ok('T9 changing an answer line does not change the hash', h3.out.trim() === expected, h3.out);
      const f4 = put({ items: 'Alpha  \r\nBeta\r\n\r\n' });
      const h4 = run(['hash', f4]);
      ok('T9 CRLF items hash the same as LF items', h4.out.trim() === expected, h4.out);
      const f5 = putRaw('no markers here\n');
      ok('T9 hash on a file without markers exits 1', run(['hash', f5]).code === 1);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('selftest: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' (' + pass + ' passed, ' + fail + ' failed)');
  return fail === 0 ? 0 : 1;
}

// ---- command line ----
function main(argv) {
  const cmd = argv[0];
  try {
    switch (cmd) {
      case 'selftest': return selftest();
      case 'hash': return cmdHash(argv[1]);
      case 'check': return cmdCheck(argv[1]);
      case 'gate': return cmdGate(argv[1], argv.slice(2));
      default:
        console.log('usage: 389-decision.cjs selftest | hash FILE | check FILE | gate FILE D1 [D2 ...]');
        return 2;
    }
  } catch (e) {
    console.log('ERROR ' + (e && e.message ? e.message : String(e)));
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { ALLOWED, COUPLING, MARK_START, MARK_END, hashItemsText };
