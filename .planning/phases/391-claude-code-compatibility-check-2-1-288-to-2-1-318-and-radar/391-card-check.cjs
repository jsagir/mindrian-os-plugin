#!/usr/bin/env node
'use strict';

/*
 * Phase 391 plan 04 - owner card checker for 391-DECISION.md.
 *
 * Commands:
 *   selftest                    run the built-in tests (includes failure cases and a case that must fail)
 *   check FILE                  every card is complete, hashes match, tokens are known, no long dashes
 *   sha FILE N                  print the SHA-256 of the canonical edit list of card N
 *   edit-list FILE N            print the canonical edit list of card N
 *   gate FILE N [N ...]         print one line "C{N} STATE[:TOKEN]" per card; exit 0 only when all are NOEDIT or READY
 *
 * Card grammar (for N = 1 to 6), each key at the start of a line as "KEY: value":
 *   an HTML comment line holding C{N}-EDIT-LIST-BEGIN, the edit list lines, a comment line holding C{N}-EDIT-LIST-END
 *   C{N}-ALLOWED, C{N}-NOEDIT (tokens split by " | "), C{N}-RECOMMENDED, C{N}-LIST-SHA256,
 *   C{N}-HEAD-AT-DECISION, C{N}-OWNER-ANSWER
 * Canonical edit list: lines between the markers, each trimmed, empty lines removed, sorted, joined with LF,
 * no trailing newline. The hash is the SHA-256 of that text, in hex.
 * Gate states: PENDING, BLOCKED-TOKEN, BLOCKED-HASH, BLOCKED-HEAD, NOEDIT, READY.
 *
 * Node built-ins only. Hyphens only; the long dash characters are built from code points below.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const CARDS = [1, 2, 3, 4, 5, 6];
const EM = String.fromCodePoint(0x2014);
const EN = String.fromCodePoint(0x2013);

function canonical(lines) {
  return lines.map((l) => l.trim()).filter((l) => l.length > 0).sort().join('\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function splitTokens(v) {
  return String(v || '').split('|').map((t) => t.trim()).filter(Boolean);
}

function parse(text) {
  const lines = text.split(/\r?\n/);
  const cards = {};
  for (const n of CARDS) {
    const c = { n, list: null, listProblems: [], allowed: null, noedit: null, recommended: null, sha: null, head: null, answers: [] };
    const begin = '<!-- C' + n + '-EDIT-LIST-BEGIN -->';
    const end = '<!-- C' + n + '-EDIT-LIST-END -->';
    const bi = lines.findIndex((l) => l.trim() === begin);
    const ei = lines.findIndex((l) => l.trim() === end);
    if (bi < 0 || ei < 0 || ei < bi) c.listProblems.push('C' + n + ': edit list markers missing or out of order');
    else c.list = lines.slice(bi + 1, ei);
    for (const l of lines) {
      let m = null;
      const key = (k) => {
        m = new RegExp('^C' + n + '-' + k + ':[ ]*(.*)$').exec(l);
        return m;
      };
      if (key('ALLOWED')) c.allowed = splitTokens(m[1]);
      else if (key('NOEDIT')) c.noedit = splitTokens(m[1]);
      else if (key('RECOMMENDED')) c.recommended = m[1].trim();
      else if (key('LIST-SHA256')) c.sha = m[1].trim();
      else if (key('HEAD-AT-DECISION')) c.head = m[1].trim();
      else if (key('OWNER-ANSWER')) c.answers.push(m[1].trim());
    }
    cards[n] = c;
  }
  return cards;
}

function cardHash(c) {
  return c.list ? sha256(canonical(c.list)) : null;
}

function check(text) {
  const problems = [];
  if (text.includes(EM) || text.includes(EN)) problems.push('file holds a long dash character');
  const cards = parse(text);
  for (const n of CARDS) {
    const c = cards[n];
    const tag = 'C' + n;
    c.listProblems.forEach((p) => problems.push(p));
    if (c.list && canonical(c.list).length === 0) problems.push(tag + ': edit list is empty');
    if (!c.allowed || c.allowed.length === 0) problems.push(tag + ': ALLOWED line missing or empty');
    if (!c.noedit || c.noedit.length === 0) problems.push(tag + ': NOEDIT line missing or empty');
    if (!c.recommended) problems.push(tag + ': RECOMMENDED line missing');
    if (!c.sha) problems.push(tag + ': LIST-SHA256 line missing');
    if (!c.head) problems.push(tag + ': HEAD-AT-DECISION line missing');
    if (c.answers.length !== 1) problems.push(tag + ': expected exactly one OWNER-ANSWER line, found ' + c.answers.length);
    if (c.allowed) {
      if (c.recommended && !c.allowed.includes(c.recommended)) problems.push(tag + ': RECOMMENDED is not in ALLOWED');
      (c.noedit || []).forEach((t) => {
        if (!c.allowed.includes(t)) problems.push(tag + ': NOEDIT token ' + t + ' is not in ALLOWED');
      });
      if (c.answers.length === 1 && c.answers[0] !== 'PENDING' && !c.allowed.includes(c.answers[0])) {
        problems.push(tag + ': OWNER-ANSWER token ' + c.answers[0] + ' is not in ALLOWED');
      }
    }
    if (c.head && !/^[0-9a-f]{40}$/.test(c.head)) problems.push(tag + ': HEAD-AT-DECISION is not a 40 character hex sha');
    const h = cardHash(c);
    if (h && c.sha && h !== c.sha) problems.push(tag + ': LIST-SHA256 does not match the edit list (now ' + h + ')');
  }
  return problems;
}

function isAncestor(head, cwd) {
  if (!/^[0-9a-f]{40}$/.test(head || '')) return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', head, 'HEAD'], { cwd, stdio: 'ignore' });
    return true;
  } catch (_e) {
    return false;
  }
}

function gateOne(c, cwd) {
  const answer = c.answers.length === 1 ? c.answers[0] : '';
  if (c.answers.length !== 1 || answer === '' || answer === 'PENDING') return { state: 'PENDING' };
  if (!c.allowed || !c.allowed.includes(answer)) return { state: 'BLOCKED-TOKEN', token: answer };
  const h = cardHash(c);
  if (!h || h !== c.sha) return { state: 'BLOCKED-HASH', token: answer };
  if (!isAncestor(c.head, cwd)) return { state: 'BLOCKED-HEAD', token: answer };
  return { state: (c.noedit || []).includes(answer) ? 'NOEDIT' : 'READY', token: answer };
}

function gate(text, ns, cwd) {
  const cards = parse(text);
  const out = [];
  let ok = true;
  for (const n of ns) {
    if (!cards[n]) {
      out.push('C' + n + ' UNKNOWN-CARD');
      ok = false;
      continue;
    }
    const g = gateOne(cards[n], cwd);
    const withToken = g.state === 'NOEDIT' || g.state === 'READY';
    out.push('C' + n + ' ' + g.state + (withToken ? ':' + g.token : ''));
    if (!withToken) ok = false;
  }
  return { lines: out, ok };
}

// ---- selftest ------------------------------------------------------------------------------

function buildCard(n, opts) {
  const o = Object.assign({ answer: 'PENDING', head: '0'.repeat(40), list: ['row b ' + n, 'row a ' + n], hashOf: null }, opts || {});
  const hash = o.hashOf || sha256(canonical(o.list));
  return [
    '<!-- C' + n + '-EDIT-LIST-BEGIN -->',
    ...o.list,
    '<!-- C' + n + '-EDIT-LIST-END -->',
    'C' + n + '-ALLOWED: APPLY | DEFER | NO',
    'C' + n + '-NOEDIT: DEFER | NO',
    'C' + n + '-RECOMMENDED: APPLY',
    'C' + n + '-LIST-SHA256: ' + hash,
    'C' + n + '-HEAD-AT-DECISION: ' + o.head,
    'C' + n + '-OWNER-ANSWER: ' + o.answer,
    '',
  ].join('\n');
}

function buildFile(perCard) {
  return CARDS.map((n) => buildCard(n, perCard && perCard[n])).join('\n');
}

function runExpect(name, expected, actual) {
  return { name, pass: expected === actual, expected, actual };
}

function git(args, cwd) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
}

function selftest() {
  const results = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-check-'));
  try {
    git(['init', '-q'], tmp);
    fs.writeFileSync(path.join(tmp, 'a.txt'), 'a');
    git(['add', 'a.txt'], tmp);
    git(['commit', '-q', '-m', 'A'], tmp);
    const headA = git(['rev-parse', 'HEAD'], tmp);
    git(['checkout', '-q', '-b', 'side'], tmp);
    fs.writeFileSync(path.join(tmp, 's.txt'), 's');
    git(['add', 's.txt'], tmp);
    git(['commit', '-q', '-m', 'S'], tmp);
    const headSide = git(['rev-parse', 'HEAD'], tmp);
    git(['checkout', '-q', '-'], tmp);
    fs.writeFileSync(path.join(tmp, 'b.txt'), 'b');
    git(['add', 'b.txt'], tmp);
    git(['commit', '-q', '-m', 'B'], tmp);

    // 1. six valid answered cards: check passes, gate exits 0 with READY or NOEDIT
    const answers = { 1: 'APPLY', 2: 'DEFER', 3: 'APPLY', 4: 'NO', 5: 'APPLY', 6: 'DEFER' };
    const per1 = {};
    CARDS.forEach((n) => { per1[n] = { answer: answers[n], head: headA }; });
    const f1 = buildFile(per1);
    const p1 = check(f1);
    const g1 = gate(f1, CARDS, tmp);
    results.push(runExpect('1 six valid cards: check has no problem', 0, p1.length));
    results.push(runExpect('1 six valid cards: gate ok', true, g1.ok));
    results.push(runExpect('1 states are READY or NOEDIT', true, g1.lines.every((l) => /(READY|NOEDIT):/.test(l))));
    results.push(runExpect('1 NOEDIT token shown for DEFER', 'C2 NOEDIT:DEFER', g1.lines[1]));
    results.push(runExpect('1 READY token shown for APPLY', 'C1 READY:APPLY', g1.lines[0]));

    // 2. pending
    const f2 = buildFile({});
    const g2 = gate(f2, [1, 2], tmp);
    results.push(runExpect('2 pending gives PENDING', 'C1 PENDING', g2.lines[0]));
    results.push(runExpect('2 pending gate not ok', false, g2.ok));
    results.push(runExpect('2 pending file still passes check', 0, check(f2).length));

    // 3. unknown token
    const f3 = buildFile({ 1: { answer: 'MAYBE', head: headA } });
    const g3 = gate(f3, [1], tmp);
    results.push(runExpect('3 unknown token gives BLOCKED-TOKEN', 'C1 BLOCKED-TOKEN', g3.lines[0]));
    results.push(runExpect('3 check reports the unknown token', true, check(f3).some((p) => /not in ALLOWED/.test(p))));

    // 4. edit list changed after the hash was written
    const goodHash = sha256(canonical(['row b 1', 'row a 1']));
    const f4 = buildFile({ 1: { answer: 'APPLY', head: headA, list: ['row b 1', 'row a 1 CHANGED'], hashOf: goodHash } });
    results.push(runExpect('4 changed list gives BLOCKED-HASH', 'C1 BLOCKED-HASH', gate(f4, [1], tmp).lines[0]));
    results.push(runExpect('4 check fails on a hash mismatch', true, check(f4).some((p) => /does not match/.test(p))));

    // 5. head is not an ancestor
    const f5 = buildFile({ 1: { answer: 'APPLY', head: headSide } });
    results.push(runExpect('5 non-ancestor head gives BLOCKED-HEAD', 'C1 BLOCKED-HEAD', gate(f5, [1], tmp).lines[0]));
    const f5b = buildFile({ 1: { answer: 'APPLY', head: 'f'.repeat(40) } });
    results.push(runExpect('5 unknown head gives BLOCKED-HEAD', 'C1 BLOCKED-HEAD', gate(f5b, [1], tmp).lines[0]));

    // 6. NOEDIT versus READY
    results.push(runExpect('6 DEFER is NOEDIT', true, /^C2 NOEDIT:DEFER$/.test(g1.lines[1])));
    results.push(runExpect('6 NO is NOEDIT', true, /^C4 NOEDIT:NO$/.test(g1.lines[3])));
    results.push(runExpect('6 APPLY is READY', true, /^C3 READY:APPLY$/.test(g1.lines[2])));

    // extra check cases
    const dupAnswer = f2.replace('C1-OWNER-ANSWER: PENDING', 'C1-OWNER-ANSWER: PENDING\nC1-OWNER-ANSWER: PENDING');
    results.push(runExpect('check: two answer lines fail', true, check(dupAnswer).some((p) => /exactly one OWNER-ANSWER/.test(p))));
    results.push(runExpect('check: long dash fails', true, check(f2 + '\n' + EM + '\n').some((p) => /long dash/.test(p))));
    results.push(runExpect('check: missing card fails', true, check(f2.replace(/C6-ALLOWED:.*\n/, '')).some((p) => /C6: ALLOWED/.test(p))));
    results.push(runExpect('check: recommended outside allowed fails', true, check(f2.replace('C3-RECOMMENDED: APPLY', 'C3-RECOMMENDED: OTHER')).some((p) => /RECOMMENDED is not in ALLOWED/.test(p))));

    // 7. the self-test can fail: a deliberately wrong expectation must be reported as a failure
    const wrong = runExpect('7 deliberately wrong expectation', 'READY', gate(f2, [1], tmp).lines[0]);
    results.push(runExpect('7 the harness reports a wrong expectation as a failure', false, wrong.pass));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  let failed = 0;
  for (const r of results) {
    if (!r.pass) {
      failed++;
      console.log('  FAIL ' + r.name + ' (expected ' + JSON.stringify(r.expected) + ', got ' + JSON.stringify(r.actual) + ')');
    } else {
      console.log('  ok   ' + r.name);
    }
  }
  console.log((failed === 0 ? 'SELFTEST PASSED: ' : 'SELFTEST FAILED: ') + (results.length - failed) + ' passed, ' + failed + ' failed');
  return failed === 0 ? 0 : 1;
}

// ---- CLI -----------------------------------------------------------------------------------

function main(argv) {
  const cmd = argv[0];
  if (cmd === 'selftest') return selftest();
  if (cmd === 'check' && argv[1]) {
    const problems = check(fs.readFileSync(argv[1], 'utf8'));
    if (problems.length === 0) {
      console.log('check OK: 6 cards complete');
      return 0;
    }
    problems.forEach((p) => console.log('PROBLEM ' + p));
    return 1;
  }
  if ((cmd === 'sha' || cmd === 'edit-list') && argv[1] && argv[2]) {
    const c = parse(fs.readFileSync(argv[1], 'utf8'))[Number(argv[2])];
    if (!c || !c.list) {
      console.log('no edit list for card ' + argv[2]);
      return 1;
    }
    console.log(cmd === 'sha' ? sha256(canonical(c.list)) : canonical(c.list));
    return 0;
  }
  if (cmd === 'gate' && argv[1] && argv.length > 2) {
    const ns = argv.slice(2).map((x) => Number(String(x).replace(/^C/i, '')));
    const r = gate(fs.readFileSync(argv[1], 'utf8'), ns, path.dirname(path.resolve(argv[1])));
    r.lines.forEach((l) => console.log(l));
    return r.ok ? 0 : 1;
  }
  console.log('usage: 391-card-check.cjs selftest | check FILE | sha FILE N | edit-list FILE N | gate FILE N [N ...]');
  return 2;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { parse, canonical, sha256, check, gate };
