'use strict';
// R1: re-count and classify every file under lib, scripts, hooks naming MINTO.md / FEYNMAN.md / BRAIN.md.
// Read-only. Run from the repo root: node <this file> <outDir>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const out = process.argv[2];
const FACES = ['MINTO', 'FEYNMAN', 'BRAIN'];
const KEYS = {
  MINTO: ['schema_version', 'room_slug', 'room:', 'parent-moc', 'methodology', 'sources', 'related', 'governing_thought', 'governing_thought_placeholder', 'last_generated_at', 'last_artifact_write_seen_at', 'reasoning_health_score', 'flagged_weaknesses', 'decision_log', 'Argument Structure', 'Governing Thought', 'section-minto'],
  FEYNMAN: ['timeline_last_rendered', 'dial_memory_last_rendered', 'TIMELINE_AUTO_START', 'DIAL_MEMORY_AUTO_START', 'Timeline (auto)', 'Dial Memory (auto)', 'Available reaches', 'Last selected', 'Current recommended'],
  BRAIN: ['brain_generated_at', 'brain_graph_version', 'governing_thought_hash', 'staleness', 'stale_reason', 'prompt_version', 'cost_tokens', 'brain_query_count', '(no signal)', 'Pattern Matches', 'Cross-Domain Analogies', 'Wicked Indicators', 'Unfilled Opportunity Matches', 'Framework Chain Predictions', 'ProblemType Classification', 'HSI Signals', 'Flagged Contradictions'],
};
const READ = /readFileSync|readTriple|readQuadruple|matter\(|matter\.|parseFrontmatter|readFile\(|fs\.read|\.read\(|readText|loadFace|existsSync|statSync|cat\s|grep\s|\bread[A-Z]\w*\(/;
const WRITE = /writeFileSync|writeFile\(|appendFileSync|renameSync|atomicWrite|writeTriple|writeQuadruple|\bwrite[A-Z]\w*\(|\brender[A-Z]\w*\(|generate[A-Z]\w*\(|unlinkSync|copyFileSync|cp\s|mv\s|>\s*"?\$?\{?\w*\/?(MINTO|FEYNMAN|BRAIN)\.md/;
const COMMENT = /^\s*(\/\/|\*|\/\*|#)/;
const isTest = (f) => /\.test\.cjs$|\/test-|\/tests?\//.test(f);
const result = [];
const summary = {};
for (const face of FACES) {
  let files = [];
  try {
    files = execFileSync('grep', ['-rlIF', face + '.md', 'lib', 'scripts', 'hooks'], { encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  } catch (e) { files = (e.stdout || '').split('\n').filter(Boolean).sort(); }
  const roles = { reader: 0, writer: 0, both: 0, mention: 0 };
  let testCount = 0;
  for (const f of files) {
    let lines;
    try { lines = fs.readFileSync(f, 'utf8').split('\n'); } catch (e) { continue; }
    const hits = [];
    lines.forEach((l, i) => { if (l.includes(face + '.md')) hits.push(i); });
    let r = 0, w = 0, code = 0;
    const touched = new Set();
    let evidence = null;
    for (const i of hits) {
      const win = lines.slice(Math.max(0, i - 8), i + 9).join('\n');
      const line = lines[i];
      if (!COMMENT.test(line)) { code++; if (!evidence) evidence = (i + 1) + ': ' + line.trim().slice(0, 160); }
      if (!COMMENT.test(line)) {
        if (WRITE.test(win)) w++;
        if (READ.test(win)) r++;
      }
    }
    const whole = lines.join('\n');
    for (const k of KEYS[face]) if (whole.includes(k)) touched.add(k);
    let role = 'mention';
    if (code > 0 && r > 0 && w > 0) role = 'both';
    else if (code > 0 && w > 0) role = 'writer';
    else if (code > 0 && r > 0) role = 'reader';
    // Hand corrections after reading the first code line of every 'mention' (see referrers-summary.txt).
    const OVERRIDE = { 'BRAIN|lib/core/cross-room-aggregator.cjs': 'reader' };
    if (OVERRIDE[face + '|' + f]) role = OVERRIDE[face + '|' + f];
    const test = isTest(f);
    if (test) testCount++;
    else roles[role]++;
    result.push({ face, path: f, occurrences: hits.length, code_occurrences: code, role, first_code_line: evidence, is_test: test, keys_or_blocks: [...touched] });
  }
  summary[face] = { total_files: files.length, test_files: testCount, non_test_files: files.length - testCount, non_test_roles: roles };
}
fs.writeFileSync(path.join(out, 'referrers.json'), JSON.stringify(result, null, 2) + '\n');
const ctx = { MINTO: 128, FEYNMAN: 23, BRAIN: 64 };
const lines = ['R1 referrer re-count at HEAD (grep -rlIF "<FACE>.md" lib scripts hooks)', ''];
for (const f of FACES) {
  const s = summary[f];
  lines.push(`${f}.md: ${s.total_files} files (CONTEXT said ${ctx[f]}, delta ${s.total_files - ctx[f]}); test files ${s.test_files}, non-test ${s.non_test_files}; non-test roles reader ${s.non_test_roles.reader}, writer ${s.non_test_roles.writer}, both ${s.non_test_roles.both}, mention ${s.non_test_roles.mention}`);
}
lines.push('', 'Role heuristic: reader/writer is read from the +-8 lines around each non-comment occurrence (readFileSync, matter, readTriple ... vs writeFileSync, rename, render, generate ...); mention = only comment/string. It is a classifier over text, not a call graph. Most remaining mention rows are exclusion lists (SKIP_FILES / reserved-name arrays), schema tables or prose. One hand override: BRAIN|lib/core/cross-room-aggregator.cjs is a reader.');
fs.writeFileSync(path.join(out, 'referrers-summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
