#!/usr/bin/env node
'use strict';
// 374-gate.cjs - the answer gate for the Phase 374 owner cards (374-DECISION.md), per plan.
//
// One question for a later plan: may plan 374-NN act on the recorded owner answers?
// It asks the existing answer gate 390-gate.cjs (command gate-item) once for each card
// item that the plan consumes. It holds no card parser, no hash rule and no ancestor
// check of its own (Canon Part 7: reuse before build). The only new data is the PLAN MAP:
// for each gated plan, its mode, its act items and its read items.
//
// COMMANDS
//   selftest                                         run the 12 synthetic cases W1 to W12
//   plan PLAN_ID [--card FILE] [--repo DIR]          may this plan act? (default card: 374-DECISION.md here)
//   check-map [--card FILE] [--repo DIR]             does the plan map fit the card?
//   table                                            print the plan map, one line for each plan
//   verify-declined PLAN_ID BASE_SHA [--part-files A,B]
//                                                    did a declined plan change nothing?
// Hidden options for the selftest: --map FILE (JSON plan map), --plan-dir DIR (verify-declined),
// and the environment variable GATE390_PATH (path of the answer gate).
//
// PLAN MAP. mode "all": the plan is go only when every act item resolves to a go option.
// mode "any": the plan is go when at least one act item does; the other items print as skip.
// A read item must be answered (not PENDING, hash and head valid) but any option is accepted.
//
// EXIT CODES of plan
//   0  PLAN-GO        the plan may act
//   2  PLAN-DECLINED  the owner said keep: the plan changes nothing (then run verify-declined)
//   1  PLAN-BLOCKED   an item is PENDING, or has a bad token, hash, head or structure
//   1  PLAN-REPLAN    an answer that no plan of this set covers (for example NODES-3000)
//   3  a usage error, an unknown plan, a missing card or a missing 390-gate.cjs
// OUTPUT LINES of plan (one word group at column 1)
//   ACT <od> <option> go|skip|replan
//   READ <od> <option>
//   <the blocked line of the answer gate, passed through>
//   PLAN-GO <plan> | PLAN-DECLINED <plan> | PLAN-BLOCKED <plan> <WORD> <od> | PLAN-REPLAN <plan> <od>=<option>
// EXIT CODES of verify-declined
//   0  DECLINED-OK         nothing of the plan changed since BASE
//   1  DECLINED-VIOLATION  a file of the plan changed, is dirty or untracked, or a plan-tagged commit exists
//   3  a bad BASE or a usage error
// EXIT CODES of check-map: 0 OK check-map; 1 a problem (MAP-ITEM-MISSING, CARD-ITEM-UNUSED,
// MAP-OPTION-UNKNOWN); 3 a usage error or a missing card.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------- the plan map (data)

const PLAN_MAP = Object.freeze({
  '374-08': { mode: 'all', act: [{ od: 'OD-5A', go: ['F6', 'F0'], decline: ['KEEP'], replan: [] }], read: ['OD-2'] },
  '374-09': { mode: 'all', act: [
    { od: 'OD-5A', go: ['F6', 'F0'], decline: ['KEEP'], replan: [] },
    { od: 'OD-5B', go: ['SCREEN'], decline: ['KEEP'], replan: [] }], read: ['OD-2'] },
  '374-10': { mode: 'all', act: [{ od: 'OD-4', go: ['USER-DIR', 'ROOM-DIR'], decline: ['KEEP'], replan: [] }], read: ['OD-5A'] },
  '374-11': { mode: 'all', act: [{ od: 'OD-6', go: ['ENGINE-BUSY-GUARD'], decline: ['KEEP'], replan: [] }], read: ['OD-4'] },
  '374-12': { mode: 'any', act: [
    { od: 'OD-3', go: ['TOPK-200'], decline: ['KEEP'], replan: ['NODES-3000'] },
    { od: 'OD-7', go: ['PAGE-ARG'], decline: ['KEEP'], replan: ['PAGE-ARG-PROJECTION', 'HANDLE-TOOL'] }], read: [] },
  '374-13': { mode: 'any', act: [{ od: 'OD-2', go: ['KEEP', 'ADD-FORGET-TOOL'], decline: [], replan: [] }],
    read: ['OD-3', 'OD-4', 'OD-5A', 'OD-5B', 'OD-6', 'OD-7'] },
  '374-14': { mode: 'any', act: [{ od: 'OD-1', go: ['KEEP', 'ROUTER-NEXT'], decline: [], replan: [] }],
    read: ['OD-2', 'OD-3', 'OD-4', 'OD-5A', 'OD-5B', 'OD-6', 'OD-7'] },
});

// ---------------------------------------------------------------- commands (RED stubs)

function flagValue(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] === undefined ? null : args[i + 1]);
}

// Positional arguments: everything that is not a flag and not the value of a known flag.
function positionals(args) {
  const withValue = new Set(['--card', '--repo', '--map', '--part-files', '--plan-dir']);
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (withValue.has(args[i])) { i++; continue; }
    if (args[i].startsWith('--')) continue;
    out.push(args[i]);
  }
  return out;
}

function die(code, text) {
  console.error(text);
  process.exit(code);
}

function loadMap(args) {
  const f = flagValue(args, '--map');
  if (!f) return PLAN_MAP;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return die(3, 'cannot read the plan map ' + f + ': ' + e.message); }
}

function answerGatePath() {
  const p = process.env.GATE390_PATH || GATE_SIBLING;
  if (!fs.existsSync(p)) die(3, 'the answer gate 390-gate.cjs is missing: ' + p);
  return p;
}

function cardPath(args) {
  const f = flagValue(args, '--card') || path.join(__dirname, '374-DECISION.md');
  if (!fs.existsSync(f)) die(3, 'the card is missing: ' + f);
  return f;
}

function repoDir(args, cardFile) {
  return flagValue(args, '--repo') || path.dirname(path.resolve(cardFile));
}

function classify(entry, option) {
  if (entry.go.includes(option)) return 'go';
  if (entry.decline.includes(option)) return 'skip';
  return 'replan';
}

// ---------------------------------------------------------------- plan

// Ask the answer gate about one item. Returns { state: 'answered', option } or { state: 'blocked', word, line }.
function askItem(gate, cardFile, repo, od) {
  const r = spawnSync(process.execPath, [gate, 'gate-item', cardFile, od, '--repo', repo], { encoding: 'utf8', env: cleanEnv() });
  const first = ((r.stdout || '').trim().split('\n')[0] || '').trim();
  if (r.status === 0) {
    const m = /^RESOLVED (OD-\S+)=(\S+)$/.exec(first);
    if (m) return { state: 'answered', option: m[2] };
  }
  if (r.status === 2) {
    const m = /^DECLINED (OD-\S+)=(\S+)$/.exec(first);
    if (m) return { state: 'answered', option: m[2] };
  }
  if (r.status === 1 && first) return { state: 'blocked', word: first.split(' ')[0], line: first };
  return die(3, 'the answer gate gave an unreadable answer for ' + od + ' (exit ' + r.status + '): ' + first + ' ' + (r.stderr || '').trim());
}

function cmdPlan(args) {
  const pos = positionals(args);
  const id = pos[0];
  if (!id) die(3, 'usage: plan PLAN_ID [--card FILE] [--repo DIR]');
  const map = loadMap(args);
  const entry = map[id];
  if (!entry) die(3, 'unknown plan id ' + id + ' (the map holds: ' + Object.keys(map).join(' ') + ')');
  const gate = answerGatePath();
  const cardFile = cardPath(args);
  const repo = repoDir(args, cardFile);

  const acts = [];
  for (const a of entry.act) {
    const q = askItem(gate, cardFile, repo, a.od);
    if (q.state === 'blocked') {
      console.log(q.line);
      console.log('PLAN-BLOCKED ' + id + ' ' + q.word + ' ' + a.od);
      process.exit(1);
    }
    const kind = classify(a, q.option);
    console.log('ACT ' + a.od + ' ' + q.option + ' ' + kind);
    acts.push({ od: a.od, option: q.option, kind });
  }
  for (const od of entry.read) {
    const q = askItem(gate, cardFile, repo, od);
    if (q.state === 'blocked') {
      console.log(q.line);
      console.log('PLAN-BLOCKED ' + id + ' ' + q.word + ' ' + od);
      process.exit(1);
    }
    console.log('READ ' + od + ' ' + q.option);
  }
  const replan = acts.find((x) => x.kind === 'replan');
  if (replan) {
    console.log('PLAN-REPLAN ' + id + ' ' + replan.od + '=' + replan.option);
    process.exit(1);
  }
  const goes = acts.filter((x) => x.kind === 'go').length;
  const go = entry.mode === 'any' ? goes >= 1 : goes === acts.length;
  if (go) { console.log('PLAN-GO ' + id); process.exit(0); }
  console.log('PLAN-DECLINED ' + id);
  process.exit(2);
}

// ---------------------------------------------------------------- table

function tableLine(id, entry) {
  const parts = ['PLAN ' + id + ' ' + entry.mode];
  for (const a of entry.act) {
    parts.push('ACT ' + a.od + ' go=' + (a.go.join(',') || '-') + ' decline=' + (a.decline.join(',') || '-') + ' replan=' + (a.replan.join(',') || '-'));
  }
  parts.push('READ ' + (entry.read.join(',') || '-'));
  return parts.join(' ');
}

function cmdTable(args) {
  const map = loadMap(args);
  console.log(Object.keys(map).map((id) => tableLine(id, map[id])).join('\n'));
  process.exit(0);
}

// ---------------------------------------------------------------- check-map

// Option lists of the card: one anchored expression, lines inside fenced blocks ignored.
function cardOptions(text) {
  const opts = new Map();
  let fenced = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = /^OPTIONS (OD-\d+[A-Z]?): (.+?) ; RECOMMENDED: /.exec(line);
    if (m) opts.set(m[1], m[2].split('|').map((s) => s.trim()));
  }
  return opts;
}

function cmdCheckMap(args) {
  const map = loadMap(args);
  const gate = answerGatePath();
  const cardFile = cardPath(args);
  const repo = repoDir(args, cardFile);
  const r = spawnSync(process.execPath, [gate, 'resolve', cardFile, '--repo', repo], { encoding: 'utf8', env: cleanEnv() });
  const rows = (r.stdout || '').trim().split('\n').filter(Boolean);
  if (r.status !== 0 || rows.some((x) => x.indexOf('\t') === -1)) {
    console.log('PROBLEM card structure: ' + (rows[0] || (r.stderr || '').trim()));
    process.exit(1);
  }
  const items = rows.map((x) => x.split('\t')[0]);
  const opts = cardOptions(fs.readFileSync(cardFile, 'utf8'));
  const problems = [];
  const usedAsAct = new Set();
  for (const id of Object.keys(map)) {
    const e = map[id];
    for (const a of e.act) {
      usedAsAct.add(a.od);
      if (!items.includes(a.od)) { problems.push('MAP-ITEM-MISSING ' + id + ' ' + a.od); continue; }
      for (const kind of ['go', 'decline', 'replan']) {
        for (const o of a[kind]) {
          if (!(opts.get(a.od) || []).includes(o)) problems.push('MAP-OPTION-UNKNOWN ' + id + ' ' + a.od + ' ' + o + ' (' + kind + ')');
        }
      }
    }
    for (const od of e.read) if (!items.includes(od)) problems.push('MAP-ITEM-MISSING ' + id + ' ' + od);
  }
  for (const od of items) if (!usedAsAct.has(od)) problems.push('CARD-ITEM-UNUSED ' + od);
  if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
  console.log('OK check-map plans=' + Object.keys(map).length + ' items=' + items.length);
  process.exit(0);
}

// ---------------------------------------------------------------- verify-declined

// files_modified list from the frontmatter of a plan file.
function filesModified(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return [];
  const out = [];
  let inList = false;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') break;
    if (/^files_modified:\s*$/.test(lines[i])) { inList = true; continue; }
    if (inList) {
      const m = /^\s+-\s+(.+?)\s*$/.exec(lines[i]);
      if (m) out.push(m[1].replace(/^["']|["']$/g, ''));
      else break;
    }
  }
  return out;
}

function gitIn(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: cleanEnv() });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '' };
}

function repoRootOf(dirName) {
  const r = gitIn(dirName, ['rev-parse', '--show-toplevel']);
  if (r.status !== 0) die(3, 'not inside a git repository: ' + dirName);
  return r.out.trim();
}

function cmdVerifyDeclined(args) {
  const pos = positionals(args);
  const id = pos[0];
  const baseArg = pos[1];
  if (!id || !baseArg || !/^374-\d\d$/.test(id)) die(3, 'usage: verify-declined PLAN_ID BASE_SHA [--part-files A,B]');
  const repo = flagValue(args, '--repo') || repoRootOf(__dirname);
  const planDir = flagValue(args, '--plan-dir') || __dirname;
  const partRaw = flagValue(args, '--part-files');
  const parts = partRaw ? partRaw.split(',').map((s) => s.trim()).filter(Boolean) : null;
  if (args.includes('--part-files') && (!parts || parts.length === 0)) die(3, '--part-files needs at least one path');

  const baseRes = gitIn(repo, ['rev-parse', '--verify', '--quiet', baseArg + '^{commit}']);
  if (baseRes.status !== 0) die(3, 'BASE does not resolve to a commit: ' + baseArg);
  const base = baseRes.out.trim();
  if (gitIn(repo, ['merge-base', '--is-ancestor', base, 'HEAD']).status !== 0) die(3, 'BASE is not an ancestor of HEAD: ' + baseArg);

  let files;
  if (parts) files = parts;
  else {
    const planFile = path.join(planDir, id + '-PLAN.md');
    if (!fs.existsSync(planFile)) die(3, 'plan file is missing: ' + planFile);
    files = filesModified(fs.readFileSync(planFile, 'utf8')).filter((p) => !/^\.planning\/phases\/374-[^/]*\//.test(p));
  }

  const hits = [];
  const add = (x) => { if (!hits.includes(x)) hits.push(x); };
  // An empty path list must not widen the check to the whole tree.
  if (files.length > 0) {
    const spec = files.map((p) => ':(literal)' + p);
    const d = gitIn(repo, ['diff', '--name-only', base, 'HEAD', '--'].concat(spec));
    if (d.status !== 0) die(3, 'git diff failed: ' + d.err.trim());
    d.out.split('\n').filter(Boolean).forEach(add);
    const s = gitIn(repo, ['status', '--porcelain', '--untracked-files=all', '--'].concat(spec));
    if (s.status !== 0) die(3, 'git status failed: ' + s.err.trim());
    s.out.split('\n').filter(Boolean).forEach((l) => add(l.slice(3)));
  }
  if (!parts) {
    const lg = gitIn(repo, ['log', base + '..HEAD', '--format=%h%x09%s']);
    if (lg.status !== 0) die(3, 'git log failed: ' + lg.err.trim());
    for (const l of lg.out.split('\n').filter(Boolean)) {
      const tab = l.indexOf('\t');
      if (l.slice(tab + 1).includes('(' + id + ')')) add(l.slice(0, tab));
    }
  }
  if (hits.length) {
    console.log(hits.map((h) => 'DECLINED-VIOLATION ' + id + ' ' + h).join('\n'));
    process.exit(1);
  }
  console.log('DECLINED-OK ' + id);
  process.exit(0);
}

// ---------------------------------------------------------------- selftest

const SCRIPT = __filename;

function cleanEnv(extra) {
  const env = {};
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('GIT_') || k === 'GATE390_PATH') continue;
    env[k] = process.env[k];
  }
  return Object.assign(env, extra || {});
}

function repoRoot() {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: __dirname, encoding: 'utf8', env: cleanEnv() });
  if (r.status !== 0) throw new Error('selftest needs a git repository: ' + r.stderr);
  return r.stdout.trim();
}

const GATE_SIBLING = path.resolve(__dirname, '..', '390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table', '390-gate.cjs');

const ZERO40 = '0'.repeat(40);
const ZERO64 = '0'.repeat(64);

const CARD_TEXT = [
  '# Synthetic 374 card', '', 'Prose line that is not a machine line.', '',
  'HEAD-AT-DECISION: ' + ZERO40, '',
  'GROUP G1: OD-1',
  'OPTIONS OD-1: KEEP | GO-A | GO-B | REPLAN-C ; RECOMMENDED: GO-A',
  'GROUP-SHA256 G1: ' + ZERO64,
  'OWNER-ANSWER G1: PENDING', '',
  'GROUP G2: OD-2',
  'OPTIONS OD-2: KEEP | GO-D ; RECOMMENDED: GO-D',
  'GROUP-SHA256 G2: ' + ZERO64,
  'OWNER-ANSWER G2: PENDING', '',
  'GROUP G3: OD-3',
  'OPTIONS OD-3: KEEP | READ-X | READ-Y ; RECOMMENDED: READ-X',
  'GROUP-SHA256 G3: ' + ZERO64,
  'OWNER-ANSWER G3: PENDING', '',
].join('\n');

const TEST_MAP = {
  '374-91': { mode: 'all', act: [{ od: 'OD-1', go: ['GO-A', 'GO-B'], decline: ['KEEP'], replan: ['REPLAN-C'] }], read: ['OD-3'] },
  '374-92': { mode: 'any', act: [
    { od: 'OD-1', go: ['GO-A'], decline: ['KEEP'], replan: ['REPLAN-C'] },
    { od: 'OD-2', go: ['GO-D'], decline: ['KEEP'], replan: [] }], read: [] },
  '374-93': { mode: 'all', act: [{ od: 'OD-3', go: ['READ-X'], decline: ['KEEP'], replan: ['READ-Y'] }], read: [] },
};

function selftest() {
  const repo = repoRoot();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '374-gate-'));
  const failures = [];
  let n = 0;
  const gate390 = process.env.GATE390_PATH || GATE_SIBLING;

  const writeJson = (obj) => { const f = path.join(dir, 'map-' + (++n) + '.json'); fs.writeFileSync(f, JSON.stringify(obj)); return f; };
  const mapFile = writeJson(TEST_MAP);

  // One sealed card (sealed by the answer gate itself), then one copy for each case.
  const base = path.join(dir, 'base.md');
  fs.writeFileSync(base, CARD_TEXT);
  const seal = spawnSync(process.execPath, [gate390, 'seal', base, '--repo', repo], { encoding: 'utf8', env: cleanEnv() });
  if (seal.status !== 0) { console.log('FAIL setup seal: ' + seal.stdout + seal.stderr); return 1; }
  const sealed = fs.readFileSync(base, 'utf8');
  const card = (answers, tamper) => {
    let t = sealed;
    for (const gid of Object.keys(answers)) t = t.replace('OWNER-ANSWER ' + gid + ': PENDING', 'OWNER-ANSWER ' + gid + ': ' + answers[gid]);
    if (tamper) t = tamper(t);
    const f = path.join(dir, 'card-' + (++n) + '.md');
    fs.writeFileSync(f, t);
    return f;
  };

  const run = (args, env) => {
    const r = spawnSync(process.execPath, [SCRIPT].concat(args), { encoding: 'utf8', env: cleanEnv(env) });
    const out = (r.stdout || '') + (r.stderr || '');
    const lines = out.trim().split('\n');
    return { code: r.status, out, last: lines[lines.length - 1] };
  };
  const plan = (id, cardFile, map) => run(['plan', id, '--card', cardFile, '--repo', repo, '--map', map || mapFile]);

  const expect = (id, text, checks) => {
    const msgs = [];
    for (const c of checks) {
      try { const m = c(); if (m) msgs.push(m); } catch (e) { msgs.push('threw ' + e.message); }
    }
    if (msgs.length) { console.log('FAIL ' + id + ' ' + text + ': ' + msgs.join('; ')); failures.push(id); }
    else console.log('ok   ' + id + ' ' + text);
  };
  const code = (r, want) => (r.code === want ? '' : 'exit ' + r.code + ' want ' + want + ' (' + r.last + ')');
  const has = (r, s) => (r.out.includes(s) ? '' : 'missing "' + s + '" in: ' + r.out.trim());
  const last = (r, s) => (r.last.startsWith(s) ? '' : 'last line "' + r.last + '" does not start with "' + s + '"');

  { const r = plan('374-91', card({}), mapFile);
    expect('W1', 'an act item PENDING: exit 1, BLOCKED-PENDING, final line PLAN-BLOCKED',
      [() => code(r, 1), () => has(r, 'BLOCKED-PENDING'), () => last(r, 'PLAN-BLOCKED 374-91')]); }

  { const r = plan('374-91', card({ G1: 'RECOMMENDED', G3: 'CUSTOM OD-3=READ-Y' }));
    expect('W2', 'mode all, act item go: exit 0, ACT line, READ line, PLAN-GO',
      [() => code(r, 0), () => has(r, 'ACT OD-1 GO-A go'), () => has(r, 'READ OD-3 READ-Y'), () => last(r, 'PLAN-GO 374-91')]); }

  { const a = plan('374-91', card({ G1: 'KEEP-ALL', G3: 'KEEP-ALL' }));
    const b = plan('374-92', card({ G1: 'KEEP-ALL', G2: 'KEEP-ALL' }));
    expect('W3', 'act item KEEP-ALL: exit 2, PLAN-DECLINED (mode all and mode any with no go item)',
      [() => code(a, 2), () => last(a, 'PLAN-DECLINED 374-91'), () => code(b, 2), () => last(b, 'PLAN-DECLINED 374-92')]); }

  { const r = plan('374-92', card({ G1: 'RECOMMENDED', G2: 'KEEP-ALL' }));
    expect('W4', 'mode any, one item go and one decline: exit 0, PLAN-GO, the declined item prints skip',
      [() => code(r, 0), () => has(r, 'ACT OD-1 GO-A go'), () => has(r, 'ACT OD-2 KEEP skip'), () => last(r, 'PLAN-GO 374-92')]); }

  { const a = plan('374-91', card({ G1: 'CUSTOM OD-1=REPLAN-C', G3: 'KEEP-ALL' }));
    const b = plan('374-92', card({ G1: 'CUSTOM OD-1=GO-B', G2: 'RECOMMENDED' }));
    expect('W5', 'an answer in the replan list, or in no list: exit 1, PLAN-REPLAN with the item and option',
      [() => code(a, 1), () => last(a, 'PLAN-REPLAN 374-91 OD-1=REPLAN-C'), () => code(b, 1), () => last(b, 'PLAN-REPLAN 374-92 OD-1=GO-B')]); }

  { const r = plan('374-91', card({ G1: 'RECOMMENDED' }));
    expect('W6', 'act item answered but a read item PENDING: exit 1, BLOCKED-PENDING, PLAN-BLOCKED',
      [() => code(r, 1), () => has(r, 'BLOCKED-PENDING'), () => last(r, 'PLAN-BLOCKED 374-91')]); }

  { const r = plan('374-91', card({ G1: 'RECOMMENDED', G3: 'RECOMMENDED' }, (t) => t.replace('GO-B | REPLAN-C', 'GO-B | REPLAN-D')));
    expect('W7', 'an OPTIONS line edited after the seal: exit 1, BLOCKED-HASH passes through',
      [() => code(r, 1), () => has(r, 'BLOCKED-HASH'), () => last(r, 'PLAN-BLOCKED 374-91 BLOCKED-HASH')]); }

  { const good = card({ G1: 'RECOMMENDED', G3: 'RECOMMENDED' });
    const unknown = plan('374-77', good);
    const nocard = plan('374-91', path.join(dir, 'no-such-card.md'));
    const no390 = run(['plan', '374-91', '--card', good, '--repo', repo, '--map', mapFile], { GATE390_PATH: path.join(dir, 'no-such-gate.cjs') });
    expect('W8', 'an unknown plan id, a missing card and a missing 390-gate.cjs each exit 3',
      [() => code(unknown, 3), () => code(nocard, 3), () => code(no390, 3)]); }

  { const cf = card({});
    const ok = run(['check-map', '--card', cf, '--repo', repo, '--map', mapFile]);
    const badItem = JSON.parse(JSON.stringify(TEST_MAP)); badItem['374-91'].read = ['OD-9'];
    const missing = run(['check-map', '--card', cf, '--repo', repo, '--map', writeJson(badItem)]);
    const noOd3 = JSON.parse(JSON.stringify(TEST_MAP)); delete noOd3['374-93'];
    const unused = run(['check-map', '--card', cf, '--repo', repo, '--map', writeJson(noOd3)]);
    const badOpt = JSON.parse(JSON.stringify(TEST_MAP)); badOpt['374-91'].act[0].go = ['GO-A', 'NOPE'];
    const unknown = run(['check-map', '--card', cf, '--repo', repo, '--map', writeJson(badOpt)]);
    expect('W9', 'check-map: MAP-ITEM-MISSING, CARD-ITEM-UNUSED, MAP-OPTION-UNKNOWN each exit 1; a valid pair exit 0',
      [() => code(ok, 0), () => has(ok, 'OK check-map'),
       () => code(missing, 1), () => has(missing, 'MAP-ITEM-MISSING'),
       () => code(unused, 1), () => has(unused, 'CARD-ITEM-UNUSED'),
       () => code(unknown, 1), () => has(unknown, 'MAP-OPTION-UNKNOWN')]); }

  { const r = run(['table']);
    const rows = r.out.trim().split('\n').filter((l) => l.startsWith('PLAN '));
    expect('W10', 'table prints one PLAN line for each of the 7 plans and exits 0',
      [() => code(r, 0), () => (rows.length === 7 ? '' : rows.length + ' rows, want 7'),
       () => has(r, 'PLAN 374-08 all ACT OD-5A go=F6,F0 decline=KEEP replan=- READ OD-2'),
       () => has(r, 'PLAN 374-12 any ACT OD-3 go=TOPK-200 decline=KEEP replan=NODES-3000 ACT OD-7 go=PAGE-ARG decline=KEEP replan=PAGE-ARG-PROJECTION,HANDLE-TOOL READ -')]); }

  // ---- verify-declined on a throwaway git repository
  const gitEnv = cleanEnv();
  const hooksDir = path.join(dir, 'no-hooks');
  fs.mkdirSync(hooksDir);
  const git = (cwd, args) => {
    const r = spawnSync('git', ['-c', 'user.name=selftest', '-c', 'user.email=selftest@example.invalid', '-c', 'commit.gpgsign=false',
      '-c', 'core.hooksPath=' + hooksDir].concat(args), { cwd, encoding: 'utf8', env: gitEnv });
    if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + r.stderr);
    return r.stdout.trim();
  };
  let repoN = 0;
  const mkRepo = () => {
    const d = path.join(dir, 'throwaway-' + (++repoN));
    fs.mkdirSync(path.join(d, 'lib'), { recursive: true });
    fs.mkdirSync(path.join(d, '.planning', 'phases', '374-test'), { recursive: true });
    git(d, ['init', '-q']);
    fs.writeFileSync(path.join(d, 'lib', 'a.cjs'), 'a1\n');
    fs.writeFileSync(path.join(d, 'other.txt'), 'o1\n');
    fs.writeFileSync(path.join(d, '.planning', 'phases', '374-test', '374-99-PLAN.md'),
      ['---', 'plan: 99', 'files_modified:', '  - lib/a.cjs', '  - lib/b.cjs',
        '  - .planning/phases/374-test/374-99-SUMMARY.md', 'autonomous: true', '---', 'body', ''].join('\n'));
    git(d, ['add', '-A']);
    git(d, ['commit', '-q', '-m', 'base']);
    return { d, base: git(d, ['rev-parse', 'HEAD']), planDir: path.join(d, '.planning', 'phases', '374-test') };
  };
  const vd = (x, extra) => run(['verify-declined', '374-99', (extra && extra.base) || x.base, '--repo', x.d, '--plan-dir', x.planDir].concat((extra && extra.args) || []));

  { const x = mkRepo();
    const clean = vd(x);
    fs.writeFileSync(path.join(x.planDir, '374-99-SUMMARY.md'), 'phase folder note\n');
    const phaseOnly = vd(x);
    fs.writeFileSync(path.join(x.d, 'other.txt'), 'o2\n');
    git(x.d, ['commit', '-q', '-a', '-m', 'peer change without a tag']);
    const peer = vd(x);
    expect('W11', 'verify-declined: nothing changed, a phase-folder change, or a peer commit on another path: exit 0, DECLINED-OK',
      [() => code(clean, 0), () => has(clean, 'DECLINED-OK 374-99'), () => code(phaseOnly, 0), () => code(peer, 0), () => has(peer, 'DECLINED-OK')]); }

  { const a = mkRepo();
    fs.writeFileSync(path.join(a.d, 'lib', 'a.cjs'), 'a2\n');
    const ra = vd(a);
    const b = mkRepo();
    fs.writeFileSync(path.join(b.d, 'lib', 'a.cjs'), 'a3\n');
    git(b.d, ['commit', '-q', '-a', '-m', 'change a product file']);
    const rb = vd(b);
    const c = mkRepo();
    fs.writeFileSync(path.join(c.d, 'lib', 'b.cjs'), 'b1\n');
    const rc = vd(c);
    const d = mkRepo();
    fs.writeFileSync(path.join(d.d, 'other.txt'), 'o9\n');
    git(d.d, ['commit', '-q', '-a', '-m', 'feat(374-99): tagged commit on an unrelated file']);
    const dsha = git(d.d, ['rev-parse', '--short', 'HEAD']);
    const rd = vd(d);
    const e = mkRepo();
    fs.writeFileSync(path.join(e.d, 'lib', 'a.cjs'), 'a4\n');
    const re = vd(e, { args: ['--part-files', 'lib/b.cjs'] });
    const rf = vd(mkRepo(), { base: '0123456789abcdef0123456789abcdef01234567' });
    expect('W12', 'verify-declined: dirty file, committed file, untracked file, plan-tagged commit exit 1 DECLINED-VIOLATION; --part-files skips the other part; unknown BASE exit 3',
      [() => code(ra, 1), () => has(ra, 'DECLINED-VIOLATION 374-99 lib/a.cjs'),
       () => code(rb, 1), () => has(rb, 'DECLINED-VIOLATION 374-99 lib/a.cjs'),
       () => code(rc, 1), () => has(rc, 'DECLINED-VIOLATION 374-99 lib/b.cjs'),
       () => code(rd, 1), () => has(rd, 'DECLINED-VIOLATION 374-99 ' + dsha.slice(0, 7)),
       () => code(re, 0), () => has(re, 'DECLINED-OK'),
       () => code(rf, 3)]); }

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
    case 'plan': cmdPlan(argv.slice(1)); break;
    case 'check-map': cmdCheckMap(argv.slice(1)); break;
    case 'table': cmdTable(argv.slice(1)); break;
    case 'verify-declined': cmdVerifyDeclined(argv.slice(1)); break;
    default:
      console.error('usage: 374-gate.cjs selftest | plan PLAN_ID [--card FILE] [--repo DIR] | check-map [--card FILE] [--repo DIR] | table | verify-declined PLAN_ID BASE_SHA [--part-files A,B]');
      process.exit(3);
  }
}

main(process.argv.slice(2));
