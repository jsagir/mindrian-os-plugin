#!/usr/bin/env node
'use strict';
// Phase 370 plan 06: arms H1 to H11 for scripts/review-contract-hook.cjs
// (the PreToolUse hook for the Write tool that checks a review at write time).
//
// The hook is spawned with a JSON payload on stdin and a temp MINDRIAN_HOME.
// The --contract argument points at a temp copy of the contract with a chosen
// enforcement.hook_mode. hooks.json never passes it.
// Node built-ins only. No network. No Brain call (Canon Part 8).
// Fixture paths are built under a temp folder; nothing is written outside it.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-hook');
const ROOT = H.ROOT;
const HOOK_REL = 'scripts/review-contract-hook.cjs';
const HOOK = path.join(ROOT, HOOK_REL);
const HOOKS_JSON = path.join(ROOT, 'hooks', 'hooks.json');

// Latency budget of arm H11, in ms above the median of node -e 0.
const BUDGET_NONREVIEW_MS = 50;
const BUDGET_REVIEW_MS = 150;
const ROUNDS = 20;

if (!fs.existsSync(HOOK)) {
  rep.fatal('cannot find ' + HOOK_REL + ' (review-contract-hook missing; plan 370-06 creates it)');
}

let CONTRACT_FILES;
try {
  CONTRACT_FILES = {};
  const base = H.realContract();
  const dir = H.mkTmpDir('rc370-hookc-');
  for (const mode of ['log-only', 'enforce']) {
    const c = JSON.parse(JSON.stringify(base));
    c.enforcement = Object.assign({}, c.enforcement || {}, { hook_mode: mode });
    const f = path.join(dir, 'contract-' + mode + '.json');
    fs.writeFileSync(f, JSON.stringify(c, null, 2));
    CONTRACT_FILES[mode] = f;
  }
} catch (e) {
  rep.fatal('cannot build contract copies: ' + ((e && e.message) || e).split('\n')[0]);
}

const PLANTED = ['SystemArchetypeAgent', 'LeveragePointAgent', 'IntersectionOpportunityFinderAgent',
  'Network Analysis MCP', 'NEO4J DATABASE', 'Theo', '/mos:challenge-assumptions', 'artifact_file', 'lib/core/example.cjs'];

const PRE = H.readFixture('pre-fix.md');
const POST = H.readFixture('post-fix.md');

// Spawn the hook. opts: { mode, home, cwd (process cwd), args (replace the default) }.
function runHook(payload, opts) {
  const o = opts || {};
  const home = o.home || H.mkTmpDir('rc370-home-');
  const args = o.args || (o.mode ? ['--contract', CONTRACT_FILES[o.mode]] : []);
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const r = spawnSync(process.execPath, [HOOK].concat(args), {
    cwd: o.cwd || '/',
    input,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { MINDRIAN_HOME: home }),
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', home };
}

function rows(home) {
  const f = path.join(home, 'voice-style.jsonl');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function writePayload(file, content, cwd, extra) {
  const p = { tool_name: 'Write', tool_input: { file_path: file, content } };
  if (cwd !== undefined) p.cwd = cwd;
  return Object.assign(p, extra || {});
}

const TMP = H.mkTmpDir('rc370-hookp-');
const ROOM_CWD = path.join(TMP, 'room');
const ROOM_FILE = path.join(ROOM_CWD, 'competitive-analysis', 'review.md');

function noText(s, label) {
  for (const p of PLANTED) rep.ok(s.indexOf(p) === -1, label + ' holds planted text: ' + p);
}

rep.arm('H1 enforce, pre-fix content: exit 2, rule/class/line on stderr, no planted text', () => {
  const r = runHook(writePayload(ROOM_FILE, PRE, ROOM_CWD), { mode: 'enforce' });
  rep.eq(r.status, 2, 'exit code');
  rep.ok(/internal_name/.test(r.stderr), 'stderr lists rule internal_name');
  rep.ok(/agent_name/.test(r.stderr), 'stderr lists class agent_name');
  rep.ok(/line\s*9\b|:9\b|@9\b/.test(r.stderr), 'stderr lists line 9');
  noText(r.stderr, 'stderr');
  noText(r.stdout, 'stdout');
  rep.eq(rows(r.home).length, 0, 'enforce mode writes no log row');
});

rep.arm('H2 enforce, post-fix content: exit 0, empty stderr', () => {
  const r = runHook(writePayload(ROOM_FILE, POST, ROOM_CWD), { mode: 'enforce' });
  rep.eq(r.status, 0, 'exit code');
  rep.eq(r.stderr, '', 'stderr');
  rep.eq(r.stdout, '', 'stdout');
});

rep.arm('H3 log-only, pre-fix content: exit 0, empty stderr, one log row with rule ids and lines only', () => {
  const r = runHook(writePayload(ROOM_FILE, PRE, ROOM_CWD), { mode: 'log-only' });
  rep.eq(r.status, 0, 'exit code');
  rep.eq(r.stderr, '', 'stderr');
  rep.eq(r.stdout, '', 'stdout');
  const rs = rows(r.home);
  rep.eq(rs.length, 1, 'log rows');
  rep.eq(rs[0].policy_id, 'review-contract-body', 'policy_id');
  rep.ok(/internal_name/.test(rs[0].detail), 'detail holds rule ids');
  rep.ok(/@\d+/.test(rs[0].detail), 'detail holds line numbers');
  noText(rs[0].detail, 'detail');
  noText(JSON.stringify(rs[0]), 'row');
});

rep.arm('H4 empty, non-JSON and tool_input-less stdin: exit 0, no output, no log row', () => {
  for (const mode of ['enforce', 'log-only']) {
    for (const input of ['', '   \n', 'not json {', '[1,2]', 'null', JSON.stringify({ tool_name: 'Write' }), JSON.stringify({ tool_name: 'Write', tool_input: 'x' })]) {
      const r = runHook(input, { mode });
      rep.eq(r.status, 0, 'exit code for ' + JSON.stringify(input) + ' in ' + mode);
      rep.eq(r.stdout, '', 'stdout');
      rep.eq(r.stderr, '', 'stderr');
      rep.eq(rows(r.home).length, 0, 'no log row');
    }
  }
  // A missing contract file: fail open.
  const r2 = runHook(writePayload(ROOM_FILE, PRE, ROOM_CWD), { args: ['--contract', path.join(TMP, 'does-not-exist.json')] });
  rep.eq(r2.status, 0, 'missing contract file exits 0');
  rep.eq(r2.stderr, '', 'missing contract stderr');
});

rep.arm('H5 leaking content without a review header: exit 0, no log row', () => {
  const leak = '# Notes\n\nSystemArchetypeAgent and Theo found a link. See artifact_file.\n';
  const withFmOther = '---\ntitle: plain note\n---\n# Notes\n\nSystemArchetypeAgent and Theo found a link.\n';
  for (const mode of ['enforce', 'log-only']) {
    for (const content of [leak, withFmOther]) {
      const r = runHook(writePayload(ROOM_FILE, content, ROOM_CWD), { mode });
      rep.eq(r.status, 0, 'exit code in ' + mode);
      rep.eq(r.stderr, '', 'stderr');
      rep.eq(rows(r.home).length, 0, 'no log row');
    }
  }
});

rep.arm('H6 tool_name Edit with a review header in new_string: exit 0', () => {
  for (const mode of ['enforce', 'log-only']) {
    const p = { tool_name: 'Edit', cwd: ROOM_CWD, tool_input: { file_path: ROOM_FILE, old_string: 'x', new_string: PRE } };
    const r = runHook(p, { mode });
    rep.eq(r.status, 0, 'exit code in ' + mode);
    rep.eq(r.stderr, '', 'stderr');
    rep.eq(rows(r.home).length, 0, 'no log row');
    // An Edit payload that carries content is still not checked.
    const p2 = { tool_name: 'Edit', cwd: ROOM_CWD, tool_input: { file_path: ROOM_FILE, content: PRE } };
    rep.eq(runHook(p2, { mode }).status, 0, 'Edit with content');
  }
});

rep.arm('H7 only fault is the soft word database: exit 0 in both modes (soft terms skipped)', () => {
  const content = H.wrap('The town keeps a database of tide times.', 'reality');
  // Precondition: the module itself fails this text when soft terms are checked.
  const M = H.requireModule(rep);
  const strict = M.checkReview(content, { contract: Object.assign(H.realContract(), { soft_terms: Object.assign({}, H.realContract().soft_terms, { policy: 'strict' }) }) });
  rep.ok(strict.ok === false, 'precondition: strict policy fails this text');
  const skipped = M.checkReview(content, { softTerms: 'skip' });
  rep.ok(skipped.ok === true, 'precondition: soft terms skipped passes this text');
  for (const mode of ['enforce', 'log-only']) {
    const r = runHook(writePayload(ROOM_FILE, content, ROOM_CWD), { mode });
    rep.eq(r.status, 0, 'exit code in ' + mode);
    rep.eq(r.stderr, '', 'stderr');
    rep.eq(rows(r.home).length, 0, 'no log row');
  }
});

rep.arm('H8 static order: the header check comes before the require of the contract module', () => {
  const src = fs.readFileSync(HOOK, 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const iHeader = code.indexOf('review_contract');
  const iReq = code.search(/require\([^)]*review-contract\.cjs/);
  rep.ok(iHeader !== -1, 'the quick header check names review_contract');
  rep.ok(iReq !== -1, 'the script requires review-contract.cjs');
  rep.ok(iHeader < iReq, 'quick header check before the module require');
  // No top-level require of the module or of the log module.
  const topRequires = code.split('\n').filter((l) => /^(const|let|var)\s.*require\(/.test(l));
  for (const l of topRequires) {
    rep.ok(!/review-contract\.cjs|voice-style-log/.test(l), 'top-level require loads a module: ' + l.trim());
  }
});

rep.arm('H9 hooks.json: one Write entry, timeout 3, no onFailure; budget far below the timeout', () => {
  const doc = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
  const found = [];
  for (const ev of Object.keys(doc.hooks || {})) {
    for (const group of doc.hooks[ev] || []) {
      for (const h of group.hooks || []) {
        if (typeof h.command === 'string' && h.command.indexOf('review-contract-hook.cjs') !== -1) found.push({ ev, group, h });
      }
    }
  }
  rep.eq(found.length, 1, 'entries that name review-contract-hook.cjs');
  rep.eq(found[0].ev, 'PreToolUse', 'event');
  rep.eq(found[0].group.matcher, 'Write', 'matcher');
  rep.eq(found[0].h.timeout, 3, 'timeout');
  rep.ok(!Object.prototype.hasOwnProperty.call(found[0].h, 'onFailure'), 'no onFailure key');
  rep.ok(found[0].h.command.indexOf('--contract') === -1, 'hooks.json passes no --contract argument');
  rep.ok(10 * BUDGET_REVIEW_MS <= found[0].h.timeout * 1000, 'ten times the review budget is at most the timeout');
});

// Repo-source relative paths (the plan checker counterexample).
const REPO_SOURCE_FILES = [
  'pipelines/PWS_grading/01-deep-grade.md',
  'tests/fixtures/370/pre-fix.md',
  '.planning/phases/x/review.md',
  'references/methodology/x.md',
  'agents/x.md',
  'commands/x.md',
  'skills/x/SKILL.md',
];

rep.arm('H10 repo-source paths: never checked, never logged, in both modes', () => {
  const dev = path.join(TMP, 'dev');
  for (const mode of ['enforce', 'log-only']) {
    for (const rel of REPO_SOURCE_FILES) {
      const variants = [
        ['relative to cwd', writePayload(rel, PRE, dev)],
        ['absolute under cwd', writePayload(path.join(dev, rel), PRE, dev)],
        ['absolute under the repo root', writePayload(path.join(ROOT, rel), PRE, dev)],
        ['absolute under the repo root, other cwd', writePayload(path.join(ROOT, rel), PRE, ROOT)],
      ];
      for (const [label, payload] of variants) {
        const r = runHook(payload, { mode });
        rep.eq(r.status, 0, mode + ' ' + label + ' ' + rel + ' exit code');
        rep.eq(r.stderr, '', mode + ' ' + label + ' ' + rel + ' stderr');
        rep.eq(rows(r.home).length, 0, mode + ' ' + label + ' ' + rel + ' log rows');
      }
    }
  }
});

rep.arm('H10b not .md, or inside the plugin repo root: skipped, no log row', () => {
  const cases = [
    path.join(ROOM_CWD, 'review.txt'),
    path.join(ROOM_CWD, 'tmp.Xk3j9a'),
    path.join(ROOM_CWD, 'review.md.bak'),
    path.join(ROOT, 'docs', 'example.md'),
    path.join(ROOT, 'docs', 'does', 'not', 'exist', 'x.md'),
  ];
  for (const mode of ['enforce', 'log-only']) {
    for (const f of cases) {
      const r = runHook(writePayload(f, PRE, ROOM_CWD), { mode });
      rep.eq(r.status, 0, mode + ' ' + f + ' exit code');
      rep.eq(r.stderr, '', mode + ' ' + f + ' stderr');
      rep.eq(rows(r.home).length, 0, mode + ' ' + f + ' log rows');
    }
    // An upper-case extension is still a markdown file: it IS checked.
    const up = runHook(writePayload(path.join(ROOM_CWD, 'REVIEW.MD'), PRE, ROOM_CWD), { mode });
    rep.eq(up.status, mode === 'enforce' ? 2 : 0, mode + ' upper-case .MD is checked');
  }
});

rep.arm('H10c no file_path: exit 0, no log row', () => {
  for (const mode of ['enforce', 'log-only']) {
    const r = runHook({ tool_name: 'Write', cwd: ROOM_CWD, tool_input: { content: PRE } }, { mode });
    rep.eq(r.status, 0, mode + ' exit code');
    rep.eq(r.stderr, '', mode + ' stderr');
    rep.eq(rows(r.home).length, 0, mode + ' log rows');
    const r2 = runHook({ tool_name: 'Write', cwd: ROOM_CWD, tool_input: { file_path: 42, content: PRE } }, { mode });
    rep.eq(r2.status, 0, mode + ' non-string file_path exit code');
    rep.eq(rows(r2.home).length, 0, mode + ' non-string file_path log rows');
  }
});

rep.arm('H10d parent folder named agents, tests or skills outside the cwd: still checked', () => {
  const files = [
    path.join(TMP, 'agents', 'room', 'x', 'review.md'),
    path.join(TMP, 'tests', 'room', 'x', 'review.md'),
    path.join(TMP, 'skills', 'room', 'x', 'review.md'),
  ];
  const other = path.join(TMP, 'other');
  for (const f of files) {
    // Payload cwd <tmp>/other, file outside it.
    let r = runHook(writePayload(f, PRE, other), { mode: 'enforce' });
    rep.eq(r.status, 2, 'enforce with cwd ' + f);
    rep.ok(/internal_name/.test(r.stderr), 'enforce stderr lists the rules ' + f);
    noText(r.stderr, 'stderr');
    r = runHook(writePayload(f, PRE, other), { mode: 'log-only' });
    rep.eq(r.status, 0, 'log-only with cwd ' + f);
    rep.eq(r.stderr, '', 'log-only stderr');
    rep.eq(rows(r.home).length, 1, 'log-only one row with cwd ' + f);
    // No payload cwd, process cwd outside <tmp>.
    r = runHook(writePayload(f, PRE), { mode: 'enforce', cwd: '/' });
    rep.eq(r.status, 2, 'enforce without cwd ' + f);
    r = runHook(writePayload(f, PRE), { mode: 'log-only', cwd: '/' });
    rep.eq(r.status, 0, 'log-only without cwd ' + f);
    rep.eq(rows(r.home).length, 1, 'log-only one row without cwd ' + f);
  }
});

rep.arm('H10e stated limit: cwd above a repo-source folder skips (accepted fail-open)', () => {
  // The accepted fail-open: someone who works from a folder ABOVE a folder named
  // agents (or tests, skills, and so on) and writes a review there is skipped,
  // because from that cwd the folder looks like repo source. A false block is
  // worse than a false allow (scripts/write-scope-check.cjs).
  const f = path.join(TMP, 'agents', 'room', 'x', 'review.md');
  for (const mode of ['enforce', 'log-only']) {
    const r = runHook(writePayload(f, PRE, TMP), { mode });
    rep.eq(r.status, 0, mode + ' exit code');
    rep.eq(r.stderr, '', mode + ' stderr');
    rep.eq(rows(r.home).length, 0, mode + ' log rows');
  }
});

function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function timeSpawn(args, input, env) {
  const t0 = process.hrtime.bigint();
  spawnSync(process.execPath, args, { cwd: '/', input, encoding: 'utf8', env });
  return Number(process.hrtime.bigint() - t0) / 1e6;
}
function measure() {
  const home = H.mkTmpDir('rc370-lat-');
  const env = Object.assign({}, process.env, { MINDRIAN_HOME: home });
  const plain = JSON.stringify(writePayload(ROOM_FILE, '# Plain note\n\nJust text, no review header.\n', ROOM_CWD));
  const review = JSON.stringify(writePayload(ROOM_FILE, PRE, ROOM_CWD));
  const hookArgs = [HOOK, '--contract', CONTRACT_FILES.enforce];
  // Warm-up round, not counted.
  timeSpawn(['-e', '0'], '', env);
  timeSpawn(hookArgs, plain, env);
  timeSpawn(hookArgs, review, env);
  const base = [];
  const non = [];
  const rev = [];
  for (let i = 0; i < ROUNDS; i++) {
    base.push(timeSpawn(['-e', '0'], '', env));
    non.push(timeSpawn(hookArgs, plain, env));
    rev.push(timeSpawn(hookArgs, review, env));
  }
  return { base: median(base), non: median(non), rev: median(rev) };
}

rep.arm('H11 latency budget: non-review <= baseline + 50 ms; review <= baseline + 150 ms (median of 20 interleaved rounds)', () => {
  let m = measure();
  const pass = (x) => (x.non - x.base) <= BUDGET_NONREVIEW_MS && (x.rev - x.base) <= BUDGET_REVIEW_MS;
  const line = (x, tag) => console.log('       H11' + tag + ' median baseline(node -e 0)=' + x.base.toFixed(1) + ' ms, median non-review=' + x.non.toFixed(1) +
    ' ms (margin ' + (BUDGET_NONREVIEW_MS - (x.non - x.base)).toFixed(1) + ' ms), median review=' + x.rev.toFixed(1) +
    ' ms (margin ' + (BUDGET_REVIEW_MS - (x.rev - x.base)).toFixed(1) + ' ms)');
  line(m, '');
  if (!pass(m)) {
    m = measure();
    line(m, ' retry');
  }
  rep.ok(pass(m), 'latency budget exceeded on both measurements');
});

rep.done();
