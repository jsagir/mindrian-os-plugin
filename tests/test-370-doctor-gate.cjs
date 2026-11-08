'use strict';
// Phase 370 doctor gate test (plan 370-10). It checks the static --check mode of
// scripts/check-review-contract.cjs and the doctor wiring. Arms G1 to G7.
// Every seeded case runs against a temp root that holds copies of the files the
// script reads, so the real tree is never edited. Node built-ins only. No network,
// no Brain call (Canon Part 8).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-doctor-gate');
const SCRIPT = path.join(H.ROOT, 'scripts', 'check-review-contract.cjs');
const DOCTOR = path.join(H.ROOT, 'scripts', 'doctor.cjs');
const PLANT = 'ZQXPLANTEDTEXT';

// The label of the coverage-gate point, copied from HEAD before plan 370-10. It must not change.
const COVERAGE_LABEL = 'connector + orchestration-projection + framework-vocabulary + render-coverage + skill-mirrors gates pass (no dark surface); shape-declaration and tool-honesty are advisory (WARNs inline, never blocks)';

function run(args) {
  const r = spawnSync(process.execPath, [SCRIPT].concat(args), { encoding: 'utf8', timeout: 60000 });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

function copyFile(root, rel) {
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(H.ROOT, rel), dest);
}

// A temp root with copies of every file the --check mode reads.
// opts: { tests: true|false, severity: 'blocker'|'advisory'|... }
function mkRoot(opts) {
  const o = opts || {};
  const root = H.mkTmpDir('rc370-doc-');
  fs.cpSync(path.join(H.ROOT, 'agents'), path.join(root, 'agents'), { recursive: true });
  for (const rel of ['data/command-registry.json', 'data/mcp-tool-connectors.json',
    'references/methodology/grade.md', 'commands/grade.md', 'commands/deep-grade.md']) {
    copyFile(root, rel);
  }
  if (o.tests !== false) {
    for (const f of ['pre-fix.md', 'post-fix.md']) copyFile(root, 'tests/fixtures/370/' + f);
  }
  const enforcement = Object.assign({}, H.realContract().enforcement, { doctor_severity: o.severity || 'blocker' });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'review-contract.json'),
    JSON.stringify(H.contractWith({ enforcement }), null, 2));
  return root;
}

function edit(root, rel, fn) {
  const p = path.join(root, rel);
  fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
}

const LEAK_BLOCK = '\n```markdown\nAssessor: Grading Agent\n' + PLANT + '\n```\n';

rep.arm('G1 the real repo passes and prints a line for each leg', () => {
  const r = run(['--check']);
  rep.eq(r.code, 0, 'exit code on the real repo (out: ' + r.out + ' err: ' + r.err + ')');
  for (const leg of ['templates', 'fixtures', 'contract']) {
    rep.ok(new RegExp('^LEG ' + leg + ' ', 'm').test(r.out), 'no LEG line for ' + leg + ' in: ' + r.out);
  }
  const last = r.out.trim().split('\n').pop();
  rep.eq(last, 'RESULT OK', 'last line');
  rep.ok(!/^FINDING /m.test(r.out), 'a FINDING line on the real repo');
});

rep.arm('G2 a template leak gives a FINDING; severity picks the exit code', () => {
  const blocker = mkRoot({ severity: 'blocker' });
  edit(blocker, 'agents/grading.md', (t) => t + LEAK_BLOCK);
  const b = run(['--check', '--repo-root', blocker]);
  rep.eq(b.code, 1, 'blocker exit code');
  rep.ok(/^FINDING templates agents\/grading\.md internal_name \S+ line \d+$/m.test(b.out), 'no internal_name FINDING in: ' + b.out);
  rep.ok(/^RESULT FAIL [1-9]/m.test(b.out), 'no RESULT FAIL line');

  const adv = mkRoot({ severity: 'advisory' });
  edit(adv, 'agents/grading.md', (t) => t + LEAK_BLOCK);
  const a = run(['--check', '--repo-root', adv]);
  rep.eq(a.code, 0, 'advisory exit code');
  rep.ok(/^WARN FINDING templates agents\/grading\.md internal_name /m.test(a.err), 'no WARN line on stderr: ' + a.err);
  const s = run(['--check', '--strict', '--repo-root', adv]);
  rep.eq(s.code, 1, '--strict exit code on advisory');
});

rep.arm('G3 a reference template with 6 revision points gives revision_points_count', () => {
  const root = mkRoot();
  edit(root, 'references/methodology/grade.md', (t) => t.replace(
    '- **{Revision point 4 takeaway}:** {one plain sentence}\n',
    '- **{Revision point 4 takeaway}:** {one plain sentence}\n' +
    '- **{Revision point 5 takeaway}:** {one plain sentence}\n' +
    '- **{Revision point 6 takeaway}:** {one plain sentence}\n'));
  const r = run(['--check', '--repo-root', root]);
  rep.eq(r.code, 1, 'exit code');
  rep.ok(/^FINDING templates references\/methodology\/grade\.md revision_points_count \S+ line \d+$/m.test(r.out), 'no revision_points_count FINDING in: ' + r.out);
});

rep.arm('G4 fixtures leg: wrong result, no tests folder, missing fixture', () => {
  const swapped = mkRoot();
  fs.copyFileSync(path.join(swapped, 'tests/fixtures/370/pre-fix.md'), path.join(swapped, 'tests/fixtures/370/post-fix.md'));
  const w = run(['--check', '--repo-root', swapped]);
  rep.eq(w.code, 1, 'swapped exit code');
  rep.ok(/^FINDING fixtures tests\/fixtures\/370\/post-fix\.md /m.test(w.out), 'no fixtures FINDING in: ' + w.out);

  const none = mkRoot({ tests: false });
  const n = run(['--check', '--repo-root', none]);
  rep.eq(n.code, 0, 'no tests exit code (out: ' + n.out + ')');
  rep.ok(/^SKIP fixtures/m.test(n.out), 'no SKIP fixtures line in: ' + n.out);
  rep.ok(/^LEG fixtures SKIP$/m.test(n.out), 'no LEG fixtures SKIP line');

  const missing = mkRoot({ tests: false });
  fs.mkdirSync(path.join(missing, 'tests'), { recursive: true });
  const m = run(['--check', '--repo-root', missing]);
  rep.eq(m.code, 1, 'missing fixture exit code');
  rep.ok(/^FINDING fixtures tests\/fixtures\/370\/(pre|post)-fix\.md missing_file /m.test(m.out), 'no missing_file FINDING in: ' + m.out);
});

rep.arm('G5 severity comes from the contract', () => {
  const leak = (sev) => {
    const root = mkRoot({ severity: sev });
    edit(root, 'agents/grading.md', (t) => t + LEAK_BLOCK);
    return run(['--check', '--repo-root', root]);
  };
  rep.eq(leak('blocker').code, 1, 'blocker');
  rep.eq(leak('advisory').code, 0, 'advisory');
  const off = leak('off');
  rep.eq(off.code, 0, 'off exit code');
  rep.ok(/review-contract gate disabled by contract/.test(off.out), 'no disabled line: ' + off.out);
});

rep.arm('G6 doctor wiring: one gates[] entry in the coverage-gate point, label unchanged', () => {
  const src = fs.readFileSync(DOCTOR, 'utf8');
  const start = src.indexOf("id: 'coverage-gate'");
  rep.ok(start !== -1, "no id: 'coverage-gate' in scripts/doctor.cjs");
  const end = src.indexOf('const results', start);
  rep.ok(end !== -1, 'no const results after the coverage-gate id');
  const block = src.slice(start, end);
  rep.ok(block.indexOf("{ id: 'review-contract', script: 'check-review-contract.cjs' }") !== -1,
    'the review-contract gate entry is not inside the coverage-gate point');
  rep.ok(block.indexOf("label: '" + COVERAGE_LABEL + "'") !== -1, 'the coverage-gate label changed');
  rep.ok(block.indexOf("severity: 'blocker'") !== -1 && block.indexOf("applies_to: ['pre-tag', 'full']") !== -1,
    'the coverage-gate severity or applies_to changed');
  const count = (src.match(/id: 'review-contract'/g) || []).length;
  rep.eq(count, 1, 'count of review-contract entries in doctor.cjs');
});

rep.arm('G7 the output holds no template text and no planted string', () => {
  const root = mkRoot({ severity: 'blocker' });
  edit(root, 'agents/grading.md', (t) => t + LEAK_BLOCK);
  edit(root, 'references/methodology/grade.md', (t) => t + '\n```markdown\n' + PLANT + ' Neo4j\n```\n');
  const r = run(['--check', '--repo-root', root]);
  rep.eq(r.code, 1, 'exit code (the seeded leaks must be found)');
  const all = r.out + r.err;
  rep.ok(all.indexOf(PLANT) === -1, 'the planted string was echoed');
  rep.ok(all.indexOf('Grading Agent') === -1, 'block text was echoed');
  for (const line of all.split('\n').filter((l) => /^(WARN )?FINDING /.test(l))) {
    rep.ok(/^(WARN )?FINDING [a-z]+ \S+ \S+ \S+ line \d+$/.test(line), 'FINDING line has an unexpected shape: ' + line);
  }
});

rep.done();
