'use strict';
// Phase 370 fixtures test (RED until plan 370-02 creates lib/core/review-contract.cjs and the data file).
// The pre-fix fixture must FAIL the check. The post-fix fixture must PASS it.
// Arms F1 to F5. Fixtures hold a pseudonym team and a synthetic venture only (D-08).

const fs = require('fs');
const path = require('path');
const H = require('./helpers/review-contract-370.cjs');

const rep = H.reporter('test-370-fixtures');
const M = H.requireModule(rep);
const OPTS = { repoRoot: H.ROOT };

rep.arm('F1 pre-fix fixture fails with the expected rule pairs', () => {
  const res = M.checkReview(H.readFixture('pre-fix.md'), OPTS);
  rep.ok(res.ok === false, 'pre-fix fixture must not be ok');
  const pairs = [
    ['internal_name', 'agent_name'],
    ['internal_name', 'command'],
    ['internal_name', 'backend_name'],
    ['internal_name', 'tool_id'],
    ['internal_name', 'path_or_id'],
    ['forbidden_section', undefined],
    ['revision_points_count', undefined],
    ['cross_domain_count', undefined],
  ];
  const missing = [];
  for (const [rule, cls] of pairs) {
    const hit = res.violations.some((v) => v.rule === rule && (cls === undefined || v.class === cls));
    if (!hit) missing.push(rule + (cls ? '/' + cls : ''));
  }
  rep.ok(missing.length === 0, 'missing violation pairs: ' + missing.join(', '));
});

rep.arm('F2 post-fix fixture passes, with and without source text', () => {
  const post = H.readFixture('post-fix.md');
  const a = M.checkReview(post, OPTS);
  rep.ok(a.ok === true && a.violations.length === 0, 'post-fix must pass: ' + JSON.stringify(a.violations));
  const b = M.checkReview(post, Object.assign({ sourceText: H.readFixture('source-student.md') }, OPTS));
  rep.ok(b.ok === true && b.violations.length === 0, 'post-fix with source text must pass: ' + JSON.stringify(b.violations));
});

rep.arm('F3 the pre-fix fixture holds each planted string', () => {
  const pre = H.readFixture('pre-fix.md');
  const planted = ['SystemArchetypeAgent', 'LeveragePointAgent', 'IntersectionOpportunityFinderAgent',
    'Network Analysis MCP', 'NEO4J DATABASE', 'Theo', '/mos:challenge-assumptions', 'artifact_file', 'lib/core/example.cjs'];
  for (const p of planted) rep.ok(pre.indexOf(p) !== -1, 'planted string missing from pre-fix.md: ' + p);
});

rep.arm('F4 pseudonym guard', () => {
  const dir = path.join(H.ROOT, 'tests', 'fixtures', '370');
  const files = fs.readdirSync(dir);
  rep.ok(files.length >= 3, 'fixture directory is missing files');
  const cohort = ['Dental Healthcare', 'LDES Innovation', 'Dreams for Sale', 'Circular Manufacturing', 'AI in Education'];
  for (const f of files) {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const c of cohort) rep.ok(txt.indexOf(c) === -1, f + ' holds a cohort project name: ' + c);
    rep.ok(!/Professor [A-Z][a-z]+/.test(txt), f + ' holds a "Professor Name" pattern');
  }
});

rep.arm('F5 the post-fix body is short and starts with the Executive Summary', () => {
  const post = H.readFixture('post-fix.md');
  const body = M.splitArtifact(post).body;
  const words = body.split(/\s+/).filter(Boolean).length;
  rep.ok(words < 600, 'post-fix body has ' + words + ' words');
  const first = body.split('\n').find((l) => /^## /.test(l));
  rep.eq(first, '## Executive Summary', 'first ## heading');
});

rep.done();
