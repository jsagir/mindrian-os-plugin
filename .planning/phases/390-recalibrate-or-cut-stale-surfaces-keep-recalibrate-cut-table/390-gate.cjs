#!/usr/bin/env node
'use strict';
// 390-gate.cjs - the answer gate for the Phase 390 owner cards (390-DECISION.md).
//
// One question: may a later plan act on group Gn, or on item OD-x?
//
// CARD GRAMMAR. Every machine line starts at column 1. A line inside a fenced
// block (three backticks) is ignored, so a card can show examples.
//   HEAD-AT-DECISION: <40 lowercase hex>                      exactly one line
//   GROUP G1: OD-1, OD-2, OD-3                                one per group; the order here is canonical
//   OPTIONS OD-1: KEEP | CUT-A | CUT-B ; RECOMMENDED: KEEP    one per item; KEEP is always first
//   GROUP-SHA256 G1: <64 lowercase hex>                       one per group
//   OWNER-ANSWER G1: <token>                                  one per group
// Tokens: PENDING | KEEP-ALL | RECOMMENDED | CUSTOM OD-1=KEEP OD-2=CUT-A
// (CUSTOM needs one OD-x=OPTION pair for every member of the group, no more, no less).
// Every OD id sits in exactly one group and has exactly one OPTIONS line.
// The group hash is the SHA-256 of the OPTIONS lines of the members in canonical
// order. Each line has runs of white space collapsed to one space and is trimmed.
// The lines are joined with a line feed and there is no trailing line feed.
// An edit to card prose does not change the hash. An edit to an option does.
//
// COMMANDS
//   selftest                          run the 13 synthetic cases
//   check-decision FILE [--expect-pending]
//   seal FILE                         write GROUP-SHA256 lines and HEAD-AT-DECISION; refuses an answered card
//   gate-group FILE Gn [--repo DIR]
//   gate-item FILE OD-x [--need OPTION] [--repo DIR]
//   resolve FILE                      tab separated: OD id, group id, resolved option or state
// --repo DIR is the git folder used for the ancestor check (default: the folder of FILE).
//
// EXIT CODES for gate-group and gate-item (no other code is used by a gate command)
//   0  go: ANSWERED-ACTION or RESOLVED
//   2  the owner said keep: DECLINED
//   1  blocked: BLOCKED-PENDING, BLOCKED-TOKEN, BLOCKED-HASH, BLOCKED-HEAD,
//      BLOCKED-STRUCTURE, MISMATCH
// (3 is used only by a command that is not implemented, and by a usage error.)

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------- pure helpers

function normLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

function groupHash(optionLines) {
  return crypto.createHash('sha256').update(optionLines.map(normLine).join('\n')).digest('hex');
}

// ---------------------------------------------------------------- parser

const KEYWORD = /^(HEAD-AT-DECISION|GROUP-SHA256|GROUP|OPTIONS|OWNER-ANSWER)(?=[ :]|$)/;
const RE_HEAD = /^HEAD-AT-DECISION: ([0-9a-f]{40})$/;
const RE_GROUP = /^GROUP (G\d+): (OD-\d+[A-Z]?(?:, OD-\d+[A-Z]?)*)$/;
const RE_OPTIONS = /^OPTIONS (OD-\d+[A-Z]?): (.+?) ; RECOMMENDED: ([A-Z0-9-]+)$/;
const RE_SHA = /^GROUP-SHA256 (G\d+): ([0-9a-f]{64})$/;
const RE_ANSWER = /^OWNER-ANSWER (G\d+): (.*)$/;
const RE_WORD = /^[A-Z0-9-]+$/;

// Returns the machine lines found outside fenced blocks, with line indexes.
function scanLines(text) {
  const lines = text.split('\n');
  const found = [];
  let fenced = false;
  lines.forEach((line, idx) => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const m = KEYWORD.exec(line);
    if (m) found.push({ idx, kw: m[1], line });
  });
  return { lines, found };
}

// Parse a card. Never throws. card.problems lists every structure problem in order.
function parseCard(text) {
  const { lines, found } = scanLines(text);
  const card = { lines, heads: [], groups: [], order: [], items: new Map(), shas: new Map(), answers: new Map(), problems: [] };
  const P = (s) => card.problems.push(s);
  const groupOf = new Map();
  for (const f of found) {
    let m;
    if (f.kw === 'HEAD-AT-DECISION') {
      if ((m = RE_HEAD.exec(f.line))) card.heads.push({ idx: f.idx, sha: m[1] });
      else P('malformed HEAD-AT-DECISION line ' + (f.idx + 1));
    } else if (f.kw === 'GROUP') {
      if ((m = RE_GROUP.exec(f.line))) {
        if (card.groups.some((g) => g.id === m[1])) P('group ' + m[1] + ' is declared twice');
        else {
          const members = m[2].split(', ');
          card.groups.push({ id: m[1], members });
          for (const od of members) {
            if (groupOf.has(od)) P(od + ' is in two groups (' + groupOf.get(od) + ' and ' + m[1] + ')');
            else groupOf.set(od, m[1]);
          }
        }
      } else P('malformed GROUP line ' + (f.idx + 1));
    } else if (f.kw === 'OPTIONS') {
      if ((m = RE_OPTIONS.exec(f.line))) {
        const od = m[1];
        const options = m[2].split('|').map((s) => s.trim());
        if (card.items.has(od)) P(od + ' has two OPTIONS lines');
        else card.items.set(od, { od, options, rec: m[3], line: f.line });
      } else P('malformed OPTIONS line ' + (f.idx + 1));
    } else if (f.kw === 'GROUP-SHA256') {
      if ((m = RE_SHA.exec(f.line))) {
        if (card.shas.has(m[1])) P('group ' + m[1] + ' has two GROUP-SHA256 lines');
        else card.shas.set(m[1], { sha: m[2], idx: f.idx });
      } else P('malformed GROUP-SHA256 line ' + (f.idx + 1));
    } else if (f.kw === 'OWNER-ANSWER') {
      if ((m = RE_ANSWER.exec(f.line))) {
        if (card.answers.has(m[1])) P('group ' + m[1] + ' has two OWNER-ANSWER lines');
        else card.answers.set(m[1], m[2].trim());
      } else P('malformed OWNER-ANSWER line ' + (f.idx + 1));
    }
  }
  if (card.heads.length === 0) P('no HEAD-AT-DECISION line');
  if (card.heads.length > 1) P('more than one HEAD-AT-DECISION line');
  if (card.groups.length === 0) P('no GROUP line');
  const ids = new Set(card.groups.map((g) => g.id));
  for (const g of card.groups) {
    for (const od of g.members) if (!card.items.has(od)) P(od + ' (group ' + g.id + ') has no OPTIONS line');
    if (!card.shas.has(g.id)) P('group ' + g.id + ' has no GROUP-SHA256 line');
    if (!card.answers.has(g.id)) P('group ' + g.id + ' has no OWNER-ANSWER line');
  }
  for (const od of card.items.keys()) if (!groupOf.has(od)) P(od + ' has an OPTIONS line but is in no group');
  for (const id of card.shas.keys()) if (!ids.has(id)) P('GROUP-SHA256 for unknown group ' + id);
  for (const id of card.answers.keys()) if (!ids.has(id)) P('OWNER-ANSWER for unknown group ' + id);
  for (const it of card.items.values()) {
    if (!it.options.every((o) => RE_WORD.test(o))) P(it.od + ' has an option that is not capital letters, digits and hyphens');
    else {
      if (it.options[0] !== 'KEEP') P(it.od + ' first option is not KEEP');
      if (new Set(it.options).size !== it.options.length) P(it.od + ' lists an option twice');
      if (!it.options.includes(it.rec)) P(it.od + ' RECOMMENDED ' + it.rec + ' is not one of its options');
    }
  }
  card.groupOf = groupOf;
  return card;
}

function computeGroupHash(card, g) {
  return groupHash(g.members.map((od) => card.items.get(od).line));
}

// Turn a token into { ok, map } or { ok:false, reason }. PENDING is handled by the caller.
function parseToken(card, g, token) {
  const map = new Map();
  if (token === 'KEEP-ALL') { for (const od of g.members) map.set(od, 'KEEP'); return { ok: true, map }; }
  if (token === 'RECOMMENDED') { for (const od of g.members) map.set(od, card.items.get(od).rec); return { ok: true, map }; }
  const words = token.split(/\s+/);
  if (words[0] !== 'CUSTOM' || words.length < 2) return { ok: false, reason: 'token "' + token + '" is not PENDING, KEEP-ALL, RECOMMENDED or CUSTOM with pairs' };
  for (const w of words.slice(1)) {
    const m = /^(OD-\d+[A-Z]?)=([A-Z0-9-]+)$/.exec(w);
    if (!m) return { ok: false, reason: 'CUSTOM pair "' + w + '" is not OD-x=OPTION' };
    if (!g.members.includes(m[1])) return { ok: false, reason: m[1] + ' is not in group ' + g.id };
    if (map.has(m[1])) return { ok: false, reason: m[1] + ' is set twice' };
    if (!card.items.get(m[1]).options.includes(m[2])) return { ok: false, reason: m[2] + ' is not an option of ' + m[1] };
    map.set(m[1], m[2]);
  }
  for (const od of g.members) if (!map.has(od)) return { ok: false, reason: 'CUSTOM has no pair for ' + od };
  return { ok: true, map };
}

function isAncestor(sha, repoDir) {
  const r = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: repoDir, encoding: 'utf8' });
  return r.status === 0;
}

// The group gate. Returns { code, lines, map }.
function gateGroup(text, gid, repoDir) {
  const card = parseCard(text);
  if (card.problems.length) return { code: 1, lines: ['BLOCKED-STRUCTURE ' + card.problems[0]] };
  const g = card.groups.find((x) => x.id === gid);
  if (!g) return { code: 1, lines: ['BLOCKED-STRUCTURE unknown group ' + gid] };
  const token = card.answers.get(gid);
  if (token === 'PENDING') return { code: 1, lines: ['BLOCKED-PENDING group ' + gid + ' has no owner answer'] };
  const t = parseToken(card, g, token);
  if (!t.ok) return { code: 1, lines: ['BLOCKED-TOKEN ' + t.reason] };
  if (computeGroupHash(card, g) !== card.shas.get(gid).sha) {
    return { code: 1, lines: ['BLOCKED-HASH the options of group ' + gid + ' changed after the hash was written'] };
  }
  if (!isAncestor(card.heads[0].sha, repoDir)) {
    return { code: 1, lines: ['BLOCKED-HEAD HEAD-AT-DECISION ' + card.heads[0].sha + ' is not an ancestor of HEAD'] };
  }
  const resolved = g.members.map((od) => 'RESOLVED ' + od + '=' + t.map.get(od));
  const allKeep = g.members.every((od) => t.map.get(od) === 'KEEP');
  return { code: allKeep ? 2 : 0, lines: [allKeep ? 'DECLINED group ' + gid : 'ANSWERED-ACTION group ' + gid].concat(resolved), map: t.map };
}

// ---------------------------------------------------------------- commands

function readCard(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { console.error('cannot read ' + file + ': ' + e.message); process.exit(3); }
  return '';
}

function flag(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
}

function emit(lines) { console.log(lines.join('\n')); }

function cmdGateGroup(args) {
  const file = args[0];
  const gid = args[1];
  if (!file || !gid) { console.error('usage: gate-group FILE Gn [--repo DIR]'); process.exit(3); }
  const repo = flag(args, '--repo') || path.dirname(path.resolve(file));
  const r = gateGroup(readCard(file), gid, repo);
  emit(r.lines);
  process.exit(r.code);
}

function cmdGateItem(args) {
  const file = args[0];
  const od = args[1];
  if (!file || !od) { console.error('usage: gate-item FILE OD-x [--need OPTION] [--repo DIR]'); process.exit(3); }
  const need = flag(args, '--need');
  const repo = flag(args, '--repo') || path.dirname(path.resolve(file));
  const text = readCard(file);
  const card = parseCard(text);
  if (card.problems.length) { emit(['BLOCKED-STRUCTURE ' + card.problems[0]]); process.exit(1); }
  const gid = card.groupOf.get(od);
  if (!gid) { emit(['BLOCKED-STRUCTURE unknown item ' + od]); process.exit(1); }
  const r = gateGroup(text, gid, repo);
  if (r.code === 1) { emit(r.lines); process.exit(1); }
  const have = r.map.get(od);
  if (have === 'KEEP') { emit(['DECLINED ' + od + '=KEEP']); process.exit(2); }
  if (need && need !== have) { emit(['MISMATCH ' + od + ' have=' + have + ' need=' + need]); process.exit(1); }
  emit(['RESOLVED ' + od + '=' + have]);
  process.exit(0);
}

function cmdResolve(args) {
  const file = args[0];
  if (!file) { console.error('usage: resolve FILE'); process.exit(3); }
  const repo = flag(args, '--repo') || path.dirname(path.resolve(file));
  const text = readCard(file);
  const card = parseCard(text);
  if (card.problems.length) { emit(['BLOCKED-STRUCTURE ' + card.problems[0]]); process.exit(1); }
  const rows = [];
  for (const g of card.groups) {
    const r = gateGroup(text, g.id, repo);
    for (const od of g.members) {
      let state;
      if (r.code === 1) state = r.lines[0].split(' ')[0] === 'BLOCKED-PENDING' ? 'PENDING' : r.lines[0].split(' ')[0];
      else state = r.map.get(od);
      rows.push([od, g.id, state].join('\t'));
    }
  }
  emit(rows);
  process.exit(0);
}

function cmdCheckDecision(args) {
  const file = args[0];
  if (!file) { console.error('usage: check-decision FILE [--expect-pending]'); process.exit(3); }
  const card = parseCard(readCard(file));
  const problems = card.problems.slice();
  for (const g of card.groups) {
    const complete = g.members.every((od) => card.items.has(od));
    if (complete && card.shas.has(g.id) && computeGroupHash(card, g) !== card.shas.get(g.id).sha) {
      problems.push('group ' + g.id + ' GROUP-SHA256 differs from the recomputed hash');
    }
    const token = card.answers.get(g.id);
    if (complete && token !== undefined && token !== 'PENDING') {
      if (args.includes('--expect-pending')) problems.push('group ' + g.id + ' answer is not PENDING');
      const t = parseToken(card, g, token);
      if (!t.ok) problems.push('group ' + g.id + ' answer is not valid: ' + t.reason);
    } else if (token !== undefined && token !== 'PENDING' && args.includes('--expect-pending')) {
      problems.push('group ' + g.id + ' answer is not PENDING');
    }
  }
  if (problems.length) { emit(problems.map((p) => 'PROBLEM ' + p)); process.exit(1); }
  emit(['OK check-decision groups=' + card.groups.length + ' items=' + card.items.size]);
  process.exit(0);
}

function cmdSeal(args) {
  const file = args[0];
  if (!file) { console.error('usage: seal FILE [--repo DIR]'); process.exit(3); }
  const repo = flag(args, '--repo') || path.dirname(path.resolve(file));
  const text = readCard(file);
  const card = parseCard(text);
  if (card.problems.length) { emit(['BLOCKED-STRUCTURE ' + card.problems[0]]); process.exit(1); }
  for (const g of card.groups) {
    if (card.answers.get(g.id) !== 'PENDING') { emit(['seal refused: group ' + g.id + ' is answered']); process.exit(1); }
  }
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' });
  if (head.status !== 0) { emit(['seal refused: git rev-parse HEAD failed in ' + repo]); process.exit(1); }
  const lines = card.lines.slice();
  lines[card.heads[0].idx] = 'HEAD-AT-DECISION: ' + head.stdout.trim();
  for (const g of card.groups) lines[card.shas.get(g.id).idx] = 'GROUP-SHA256 ' + g.id + ': ' + computeGroupHash(card, g);
  const tmp = file + '.seal-' + process.pid + '.tmp';
  fs.writeFileSync(tmp, lines.join('\n'));
  try { fs.chmodSync(tmp, fs.statSync(file).mode); } catch (e) { /* keep default mode */ }
  fs.renameSync(tmp, file);
  emit(['SEALED groups=' + card.groups.length + ' head=' + head.stdout.trim()]);
  process.exit(0);
}

// ---------------------------------------------------------------- selftest

const SCRIPT = __filename;
const ZERO40 = '0'.repeat(40);
const ZERO64 = '0'.repeat(64);

function repoRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('selftest needs a git repository: ' + r.stderr);
  return r.stdout.trim();
}

function liveHead(repo) {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('git rev-parse HEAD failed');
  return r.stdout.trim();
}

function defaultGroups() {
  return [
    { id: 'G1', answer: 'PENDING', items: [
      { od: 'OD-1', options: ['KEEP', 'CUT-A', 'CUT-B'], rec: 'CUT-A' },
      { od: 'OD-2', options: ['KEEP', 'DEADLINE-90D'], rec: 'KEEP' } ] },
    { id: 'G2', answer: 'PENDING', items: [
      { od: 'OD-3', options: ['KEEP', 'CUT-X'], rec: 'KEEP' },
      { od: 'OD-4', options: ['KEEP', 'CUT-Y'], rec: 'KEEP' } ] },
  ];
}

function optionsLine(it) {
  return 'OPTIONS ' + it.od + ': ' + it.options.join(' | ') + ' ; RECOMMENDED: ' + it.rec;
}

// Build card text. spec: { groups, head, omitHash, zeroHash, fence, tamper }
function buildCard(spec, repo) {
  const groups = spec.groups || defaultGroups();
  const head = spec.head === 'zeros' ? ZERO40 : liveHead(repo);
  const out = ['# Synthetic card', '', 'Prose line that is not a machine line.', ''];
  if (spec.fence) {
    out.push('Example (ignored by the gate):', '```',
      'OWNER-ANSWER G1: KEEP-ALL', 'GROUP G9: OD-9', 'HEAD-AT-DECISION: ' + ZERO40, '```', '');
  }
  out.push('HEAD-AT-DECISION: ' + head);
  for (const g of groups) {
    out.push('', 'GROUP ' + g.id + ': ' + g.items.map((i) => i.od).join(', '));
    for (const it of g.items) out.push(optionsLine(it));
    if (spec.omitHash !== g.id) {
      const h = spec.zeroHash ? ZERO64 : groupHash(g.items.map(optionsLine));
      out.push('GROUP-SHA256 ' + g.id + ': ' + h);
    }
    for (const a of [].concat(g.answer)) out.push('OWNER-ANSWER ' + g.id + ': ' + a);
  }
  let text = out.join('\n') + '\n';
  if (spec.tamper) text = spec.tamper(text);
  return text;
}

function selftest() {
  const repo = repoRoot();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '390-gate-'));
  const failures = [];
  let n = 0;
  const file = (spec) => {
    const f = path.join(dir, 'card-' + (++n) + '.md');
    fs.writeFileSync(f, buildCard(spec, repo));
    return f;
  };
  const run = (args) => {
    const r = spawnSync(process.execPath, [SCRIPT].concat(args), { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  };
  const withAnswers = (a1, a2) => {
    const g = defaultGroups();
    g[0].answer = a1;
    g[1].answer = a2 === undefined ? 'PENDING' : a2;
    return { groups: g };
  };
  const gg = (spec, gid) => run(['gate-group', file(spec), gid, '--repo', repo]);
  const gi = (spec, od, extra) => run(['gate-item', file(spec), od, '--repo', repo].concat(extra || []));
  const expect = (id, text, checks) => {
    const msgs = [];
    for (const c of checks) {
      try { const m = c(); if (m) msgs.push(m); } catch (e) { msgs.push('threw ' + e.message); }
    }
    if (msgs.length) { console.log('FAIL ' + id + ' ' + text + ': ' + msgs.join('; ')); failures.push(id); }
    else console.log('ok   ' + id + ' ' + text);
  };
  const code = (r, want) => (r.code === want ? '' : 'exit ' + r.code + ' want ' + want + ' (' + r.out.trim().split('\n')[0] + ')');
  const has = (r, s) => (r.out.includes(s) ? '' : 'missing "' + s + '" in: ' + r.out.trim());

  { const r = gg(withAnswers('PENDING'), 'G1');
    expect('S1', 'PENDING gives exit 1 and BLOCKED-PENDING', [() => code(r, 1), () => has(r, 'BLOCKED-PENDING')]); }

  { const r = gg(withAnswers('APPROVE-MOST'), 'G1');
    expect('S2', 'unknown token APPROVE-MOST gives exit 1 and BLOCKED-TOKEN', [() => code(r, 1), () => has(r, 'BLOCKED-TOKEN')]); }

  { const r = gg(withAnswers('PENDING', 'KEEP-ALL'), 'G2');
    expect('S3', 'KEEP-ALL gives exit 2, DECLINED and a KEEP line per member',
      [() => code(r, 2), () => has(r, 'DECLINED'), () => has(r, 'RESOLVED OD-3=KEEP'), () => has(r, 'RESOLVED OD-4=KEEP')]); }

  { const a = gg(withAnswers('RECOMMENDED'), 'G1');
    const b = gg(withAnswers('PENDING', 'RECOMMENDED'), 'G2');
    expect('S4', 'RECOMMENDED: exit 0 with a non-KEEP recommendation, exit 2 when all recommend KEEP',
      [() => code(a, 0), () => has(a, 'ANSWERED-ACTION'), () => has(a, 'RESOLVED OD-1=CUT-A'), () => has(a, 'RESOLVED OD-2=KEEP'),
       () => code(b, 2), () => has(b, 'DECLINED')]); }

  { const miss = gg(withAnswers('CUSTOM OD-1=CUT-A'), 'G1');
    const badOpt = gg(withAnswers('CUSTOM OD-1=CUT-Z OD-2=KEEP'), 'G1');
    const badOd = gg(withAnswers('CUSTOM OD-1=KEEP OD-2=KEEP OD-3=KEEP'), 'G1');
    const dup = gg(withAnswers('CUSTOM OD-1=KEEP OD-1=CUT-A OD-2=KEEP'), 'G1');
    const allKeep = gg(withAnswers('CUSTOM OD-1=KEEP OD-2=KEEP'), 'G1');
    const one = gg(withAnswers('CUSTOM OD-1=KEEP OD-2=DEADLINE-90D'), 'G1');
    expect('S5', 'CUSTOM: missing member, bad option, foreign OD, duplicate pair give BLOCKED-TOKEN; all KEEP exit 2; one non-KEEP exit 0',
      [() => code(miss, 1), () => has(miss, 'BLOCKED-TOKEN'), () => code(badOpt, 1), () => has(badOpt, 'BLOCKED-TOKEN'),
       () => code(badOd, 1), () => has(badOd, 'BLOCKED-TOKEN'), () => code(dup, 1), () => has(dup, 'BLOCKED-TOKEN'),
       () => code(allKeep, 2), () => code(one, 0), () => has(one, 'RESOLVED OD-2=DEADLINE-90D')]); }

  { const spec = withAnswers('RECOMMENDED');
    spec.tamper = (t) => t.replace('KEEP | CUT-A | CUT-B ;', 'KEEP | CUT-A | CUT-C ;');
    const r = gg(spec, 'G1');
    expect('S6', 'an OPTIONS line edited after the hash gives exit 1 and BLOCKED-HASH', [() => code(r, 1), () => has(r, 'BLOCKED-HASH')]); }

  { const spec = withAnswers('RECOMMENDED'); spec.head = 'zeros';
    const bad = gg(spec, 'G1');
    const good = gg(withAnswers('RECOMMENDED'), 'G1');
    expect('S7', 'HEAD-AT-DECISION of 40 zeros gives BLOCKED-HEAD; the live HEAD passes',
      [() => code(bad, 1), () => has(bad, 'BLOCKED-HEAD'), () => code(good, 0)]); }

  { const spec = withAnswers('RECOMMENDED', 'PENDING');
    const ok = gi(spec, 'OD-1', ['--need', 'CUT-A']);
    const mis = gi(spec, 'OD-1', ['--need', 'CUT-B']);
    const keep = gi(spec, 'OD-2');
    const pend = gi(spec, 'OD-3');
    expect('S8', 'gate-item: match exit 0, MISMATCH exit 1, resolved KEEP exit 2, PENDING group exit 1',
      [() => code(ok, 0), () => has(ok, 'RESOLVED OD-1=CUT-A'), () => code(mis, 1), () => has(mis, 'MISMATCH OD-1 have=CUT-A need=CUT-B'),
       () => code(keep, 2), () => has(keep, 'DECLINED OD-2=KEEP'), () => code(pend, 1), () => has(pend, 'BLOCKED-PENDING')]); }

  { const spec = withAnswers('RECOMMENDED'); spec.fence = true;
    const r = gg(spec, 'G1');
    expect('S11', 'a fenced example OWNER-ANSWER line is ignored', [() => code(r, 0), () => has(r, 'ANSWERED-ACTION')]); }

  { const dupAns = withAnswers(['PENDING', 'PENDING']);
    const a = gg(dupAns, 'G1');
    const noOpt = withAnswers('PENDING');
    noOpt.tamper = (t) => t.split('\n').filter((l) => !l.startsWith('OPTIONS OD-2:')).join('\n');
    const b = gg(noOpt, 'G1');
    expect('S12', 'two OWNER-ANSWER lines, or a member with no OPTIONS line, give BLOCKED-STRUCTURE before the token',
      [() => code(a, 1), () => has(a, 'BLOCKED-STRUCTURE'), () => code(b, 1), () => has(b, 'BLOCKED-STRUCTURE'),
       () => (b.out.includes('BLOCKED-PENDING') ? 'structure must come before PENDING' : '')]); }

  { const cd = (spec, extra) => run(['check-decision', file(spec)].concat(extra || []));
    const problem = (r, label, needle) => [() => code(r, 1), () => has(r, 'PROBLEM'), () => (needle && !r.out.includes(needle) ? label + ': missing "' + needle + '" in: ' + r.out.trim() : '')];
    const dupAns = cd(withAnswers(['PENDING', 'PENDING']));
    const firstNotKeep = withAnswers('PENDING');
    firstNotKeep.groups[1].items[0].options = ['CUT-X', 'KEEP'];
    firstNotKeep.groups[1].items[0].rec = 'KEEP';
    const twoGroups = withAnswers('PENDING');
    twoGroups.groups[1].items[1].od = 'OD-1';
    const badRec = withAnswers('PENDING');
    badRec.groups[0].items[0].rec = 'CUT-Q';
    const stale = withAnswers('PENDING');
    stale.tamper = (t) => t.replace('KEEP | CUT-X ;', 'KEEP | CUT-Z ;');
    const answered = cd(withAnswers('RECOMMENDED'), ['--expect-pending']);
    const good = cd(withAnswers('PENDING'));
    const goodP = cd(withAnswers('PENDING'), ['--expect-pending']);
    expect('S9', 'check-decision: names each defect with PROBLEM; OK line on a valid card',
      [].concat(problem(dupAns, 'two answers', 'two OWNER-ANSWER'), problem(cd(firstNotKeep), 'first not KEEP', 'first option is not KEEP'),
        problem(cd(twoGroups), 'two groups', 'is in two groups'), problem(cd(badRec), 'bad rec', 'is not one of its options'),
        problem(cd(stale), 'stale hash', 'hash'), problem(answered, 'expect-pending', 'not PENDING'),
        [() => code(good, 0), () => has(good, 'OK check-decision groups=2 items=4'), () => code(goodP, 0)])); }

  { const spec = withAnswers('PENDING', 'PENDING'); spec.zeroHash = true; spec.head = 'zeros';
    const f = path.join(dir, 'seal-ok.md');
    fs.writeFileSync(f, buildCard(spec, repo));
    const before = fs.readFileSync(f, 'utf8');
    const r = run(['seal', f, '--repo', repo]);
    const after = fs.readFileSync(f, 'utf8');
    const answerLines = (t) => t.split('\n').filter((l) => l.startsWith('OWNER-ANSWER ')).join('|');
    const chk = run(['check-decision', f, '--expect-pending']);
    const proseLines = (t) => t.split('\n').filter((l) => !/^(GROUP-SHA256|HEAD-AT-DECISION)/.test(l)).join('\n');
    const af = path.join(dir, 'seal-answered.md');
    const aText = buildCard(withAnswers('PENDING', 'KEEP-ALL'), repo);
    fs.writeFileSync(af, aText);
    const ar = run(['seal', af]);
    expect('S10', 'seal writes hashes and HEAD, keeps answers and other lines byte for byte, refuses an answered card',
      [() => code(r, 0), () => (after === before ? 'file did not change' : ''),
       () => (answerLines(after) === answerLines(before) ? '' : 'OWNER-ANSWER lines changed'),
       () => (proseLines(after) === proseLines(before) ? '' : 'other lines changed'),
       () => code(chk, 0), () => code(ar, 1), () => has(ar, 'seal refused: group G2 is answered'),
       () => (fs.readFileSync(af, 'utf8') === aText ? '' : 'answered card was rewritten')]); }

  { const spec = withAnswers('PENDING', 'PENDING'); spec.omitHash = 'G2';
    const f = path.join(dir, 'seal-nohash.md');
    fs.writeFileSync(f, buildCard(spec, repo));
    const before = fs.readFileSync(f, 'utf8');
    const r = run(['seal', f]);
    expect('S13', 'seal on a card with no GROUP-SHA256 line for a group: BLOCKED-STRUCTURE with the group id, file unchanged',
      [() => code(r, 1), () => has(r, 'BLOCKED-STRUCTURE'), () => has(r, 'G2'), () => (fs.readFileSync(f, 'utf8') === before ? '' : 'file was written')]); }

  fs.rmSync(dir, { recursive: true, force: true });
  if (failures.length) { console.log('selftest FAILED: ' + failures.join(' ')); return 1; }
  console.log('selftest passed');
  return 0;
}

// ---------------------------------------------------------------- CLI

function main(argv) {
  const cmd = argv[0];
  switch (cmd) {
    case 'selftest': process.exit(selftest()); break;
    case 'check-decision': cmdCheckDecision(argv.slice(1)); break;
    case 'seal': cmdSeal(argv.slice(1)); break;
    case 'gate-group': cmdGateGroup(argv.slice(1)); break;
    case 'gate-item': cmdGateItem(argv.slice(1)); break;
    case 'resolve': cmdResolve(argv.slice(1)); break;
    default:
      console.error('usage: 390-gate.cjs selftest | check-decision FILE [--expect-pending] | seal FILE | gate-group FILE Gn [--repo DIR] | gate-item FILE OD-x [--need OPTION] [--repo DIR] | resolve FILE');
      process.exit(3);
  }
}

main(process.argv.slice(2));
