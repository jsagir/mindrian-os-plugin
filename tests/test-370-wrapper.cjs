'use strict';
// Phase 370 wrapper test (RED until plan 370-08 creates scripts/check-review-contract.cjs).
// Arms W1 to W8 for the pre-file CLI wrapper. The wrapper must print rule, tier, class and line
// only, never the matched text (Canon Part 8, threat T-370-38).
// Node built-ins only. No network, no Brain call. Temp files only.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-wrapper');
const SCRIPT_REL = 'scripts/check-review-contract.cjs';
const SCRIPT = path.join(H.ROOT, SCRIPT_REL);
const M = H.requireModule(rep);
const CONTRACT = H.realContract();

const PLANTED = ['SystemArchetypeAgent', 'LeveragePointAgent', 'IntersectionOpportunityFinderAgent',
  'Network Analysis MCP', 'NEO4J DATABASE', 'Theo', '/mos:challenge-assumptions', 'artifact_file', 'lib/core/example.cjs'];

function run(args, input) {
  const r = spawnSync(process.execPath, [SCRIPT].concat(args), {
    cwd: H.ROOT,
    input: input === undefined ? undefined : input,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '', error: r.error, signal: r.signal };
}

function mustExist(name) {
  if (!fs.existsSync(SCRIPT)) throw new Error('cannot find ' + SCRIPT_REL + ' (check-review-contract wrapper missing; plan 370-08 creates it)');
  return name;
}

const TMP = H.mkTmpDir('rc370-wrapper-');
function tmpFile(name, content) {
  const p = path.join(TMP, name);
  fs.writeFileSync(p, content);
  return p;
}

// Parse the VIOLATION lines of the wrapper into [rule, tier, class, line] strings.
function parseViolations(out) {
  const rows = [];
  for (const line of out.split('\n')) {
    const m = /^VIOLATION (\S+) (\S+) line (\d+)(?: tier (\S+))?$/.exec(line);
    if (m) rows.push([m[1], m[4] === undefined ? '' : m[4], m[2], m[3]].join('|'));
  }
  return rows.sort();
}

const pre = H.readFixture('pre-fix.md');
const post = H.readFixture('post-fix.md');

rep.arm('W1 pre-fix fixture: exit 1, one line per violation, heading order, no planted text', () => {
  mustExist();
  const f = tmpFile('pre.md', pre);
  const r = run(['check', f]);
  rep.eq(r.status, 1, 'exit code');
  const rows = parseViolations(r.out);
  rep.ok(rows.length >= 1, 'no VIOLATION lines in stdout: ' + JSON.stringify(r.out.slice(0, 200)));
  rep.ok(/^VIOLATION \S+ \S+ line \d+/m.test(r.out), 'VIOLATION line form');
  const lines = r.out.split('\n').filter(Boolean);
  rep.ok(/^RESULT FAIL \d+$/.test(lines[lines.length - 1]), 'last line must be RESULT FAIL <count>, got ' + lines[lines.length - 1]);
  rep.eq(Number(lines[lines.length - 1].split(' ')[2]), rows.length, 'count in RESULT line');
  const eh = lines.filter((l) => l.indexOf('EXPECTED-HEADINGS') === 0);
  rep.eq(eh.length, 1, 'one EXPECTED-HEADINGS line');
  let last = -1;
  for (const s of CONTRACT.sections) {
    const at = eh[0].indexOf(s.heading);
    rep.ok(at > last, 'contract heading missing or out of order in EXPECTED-HEADINGS: ' + s.heading);
    last = at;
  }
  const all = r.out + '\n' + r.err;
  for (const p of PLANTED) rep.ok(all.indexOf(p) === -1, 'planted string printed: ' + p);
});

rep.arm('W2 post-fix fixture: exit 0, OK plus the contract version, stderr empty', () => {
  mustExist();
  const f = tmpFile('post.md', post);
  const r = run(['check', f]);
  rep.eq(r.status, 0, 'exit code');
  rep.eq(r.out, 'OK review-contract v' + CONTRACT.review_contract + '\n', 'stdout');
  rep.eq(r.err, '', 'stderr');
});

rep.arm('W3 stdin form matches the file form', () => {
  mustExist();
  const okr = run(['check', '-'], post);
  rep.eq(okr.status, 0, 'post-fix stdin exit code');
  rep.eq(okr.out, run(['check', tmpFile('post3.md', post)]).out, 'post-fix stdout');
  const bad = run(['check', '-'], pre);
  rep.eq(bad.status, 1, 'pre-fix stdin exit code');
  rep.eq(bad.out, run(['check', tmpFile('pre3.md', pre)]).out, 'pre-fix stdout');
});

rep.arm('W4 a missing file: exit 3, stderr names the problem', () => {
  mustExist();
  const r = run(['check', path.join(TMP, 'does-not-exist.md')]);
  rep.eq(r.status, 3, 'exit code');
  rep.ok(/cannot read/i.test(r.err), 'stderr must say cannot read: ' + JSON.stringify(r.err));
  rep.eq(r.out, '', 'stdout');
  const noArg = run(['check']);
  rep.eq(noArg.status, 3, 'check without a file: exit code');
});

rep.arm('W5 --source applies the soft-term policy of the contract (O3)', () => {
  mustExist();
  const draft = tmpFile('soft.md', H.wrap('The team keeps a shared database of tide tables.'));
  const withWord = tmpFile('src-with.md', '# Notes\n\nWe keep a database of tide tables.\n');
  const withoutWord = tmpFile('src-without.md', '# Notes\n\nWe keep paper lists of tide times.\n');
  const policy = CONTRACT.soft_terms.policy;
  const a = run(['check', draft, '--source', withWord]);
  const b = run(['check', draft, '--source', withoutWord]);
  const c = run(['check', draft]);
  if (policy === 'exempt_if_in_source') {
    rep.eq(a.status, 0, 'source holds the word: exit code (out ' + JSON.stringify(a.out) + ')');
    rep.eq(b.status, 1, 'source lacks the word: exit code');
    rep.eq(c.status, 1, 'no source: exit code');
    rep.ok(parseViolations(b.out).some((x) => x.split('|')[2] === 'soft_term'), 'soft_term class expected');
  } else if (policy === 'strict') {
    rep.eq(a.status, 1, 'strict: exit code with source');
    rep.eq(b.status, 1, 'strict: exit code without word');
  } else {
    rep.eq(a.status, 0, 'compound_only: exit code with source');
    rep.eq(b.status, 0, 'compound_only: exit code without word');
  }
  // Repeated --source and a directory source (read through collectSourceText).
  if (policy === 'exempt_if_in_source') {
    const dir = path.join(TMP, 'room');
    fs.mkdirSync(path.join(dir, 'problem-definition'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'problem-definition', 'notes.md'), 'We keep a database of tide tables.\n');
    const d = run(['check', draft, '--source', withoutWord, '--source', dir]);
    rep.eq(d.status, 0, 'directory source: exit code (out ' + JSON.stringify(d.out) + ')');
    const e = run(['check', draft, '--source', path.join(TMP, 'no-such-source.md')]);
    rep.eq(e.status, 3, 'unreadable source: exit code');
  }
});

rep.arm('W6 parity with the module for the pre-fix fixture', () => {
  mustExist();
  const f = tmpFile('pre6.md', pre);
  const r = run(['check', f, '--repo-root', H.ROOT]);
  const res = M.checkReview(pre, { repoRoot: H.ROOT });
  const want = res.violations.map((v) => [v.rule, v.tier, v.class, String(v.line)].join('|')).sort();
  const got = parseViolations(r.out);
  rep.eq(JSON.stringify(got), JSON.stringify(want), 'violation set differs from the module');
  const ok = run(['check', tmpFile('post6.md', post), '--repo-root', H.ROOT]);
  rep.eq(ok.status, M.checkReview(post, { repoRoot: H.ROOT }).ok ? 0 : 1, 'post-fix parity');
});

rep.arm('W7 no arguments, unknown subcommand and --check exit 3 with a usage line', () => {
  mustExist();
  const none = run([]);
  rep.eq(none.status, 3, 'no arguments: exit code');
  rep.ok(/usage/i.test(none.err), 'no arguments: usage line on stderr');
  const bogus = run(['frobnicate']);
  rep.eq(bogus.status, 3, 'unknown subcommand: exit code');
  rep.ok(/usage/i.test(bogus.err), 'unknown subcommand: usage line on stderr');
  const reserved = run(['--check']);
  rep.eq(reserved.status, 3, '--check: exit code');
  rep.ok(/not available yet/i.test(reserved.err), '--check: not available yet line');
  const badFlag = run(['check', tmpFile('flag.md', post), '--nope']);
  rep.eq(badFlag.status, 3, 'unknown flag: exit code');
});

rep.arm('W8 input over 1000000 bytes exits 3 and does not hang', () => {
  mustExist();
  const big = 'a'.repeat(1000001);
  const t0 = Date.now();
  const f = run(['check', tmpFile('big.md', big)]);
  rep.eq(f.status, 3, 'file: exit code');
  rep.ok(/size|large|bytes/i.test(f.err), 'file: size message on stderr: ' + JSON.stringify(f.err));
  const s = run(['check', '-'], big);
  rep.eq(s.status, 3, 'stdin: exit code (signal ' + s.signal + ', error ' + (s.error && s.error.code) + ')');
  rep.ok(/size|large|bytes/i.test(s.err), 'stdin: size message on stderr: ' + JSON.stringify(s.err));
  rep.ok(Date.now() - t0 < 20000, 'took too long');
  // The limit itself passes the size gate (a body of exactly 1000000 bytes is read, then checked).
  const edge = run(['check', tmpFile('edge.md', 'a'.repeat(1000000))]);
  rep.ok(edge.status === 1 || edge.status === 0, 'input at the limit must be read and checked, got exit ' + edge.status);
});

rep.done();
