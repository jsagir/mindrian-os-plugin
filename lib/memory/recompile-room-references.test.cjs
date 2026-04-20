#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-03 -- recompile-room-references tests (RED -> GREEN)
 * ==============================================================
 * Ships the deterministic ROOM.md references recompiler. The compiler
 * rebuilds ONLY the delimited
 *   <!-- BEGIN REFERENCES --> ... <!-- END REFERENCES -->
 * block inside ROOM.md. Human-authored identity prose OUTSIDE the
 * markers is preserved byte-for-byte across every recompile. The
 * compiler is deterministic (no LLM), sub-200ms for typical sections,
 * and composes with the Phase 87-02 atomic write-lock plus an
 * mtime-stamp conflict detector so manual edits between sessions are
 * never silently stomped.
 *
 * Test map (10 tests, one per PLAN <behavior> case):
 *   Test  1: ROOM.md without markers + 3 artifacts -> markers APPENDED with all 3 links; prose preserved
 *   Test  2: ROOM.md with existing REFERENCES block -> block REPLACED; prose outside byte-identical
 *   Test  3: artifact wikilink to other section surfaces under "Section links" Set-deduped
 *   Test  4: wikilink in identity prose OUTSIDE markers stays in prose (NOT moved into auto-block)
 *   Test  5: ROOM.md / STATE.md / MINTO.md filtered from artifact list (system files excluded)
 *   Test  6: mtime conflict detected (ROOM.md edited after last stamp) -> skip write, stderr warn, exit 0 on CLI
 *   Test  7: 3 concurrent forked recompiles on same section -> well-formed output, no duplicate block
 *   Test  8: 20-artifact section recompile completes in < 200ms wall-clock
 *   Test  9: empty section (ROOM.md + zero artifacts) -> block contains "No artifacts yet in this section."
 *   Test 10: no ROOM.md present -> exit code 2, stderr message, no file created
 *
 * BSL 1.1. Zero npm deps. Node built-ins only. Three-surface by construction.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');

const recompiler = require('../../scripts/recompile-room-references.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'scripts', 'recompile-room-references.cjs');

// ---------- Fixture helpers ----------

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  // Mark as a room root so downstream resolve-room style walkers could find it.
  fs.writeFileSync(path.join(d, '.room-root'), '');
  fs.mkdirSync(path.join(d, '.mindrian'), { recursive: true });
  TMPDIRS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

function sectionDir(roomDir, name) {
  const p = path.join(roomDir, name);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function writeArtifact(dir, baseName, title, body) {
  const payload = '# ' + title + '\n\n' + (body || 'Content.\n');
  fs.writeFileSync(path.join(dir, baseName + '.md'), payload, 'utf8');
}

function readRoomMd(dir) {
  return fs.readFileSync(path.join(dir, 'ROOM.md'), 'utf8');
}

function writeRoomMd(dir, contents) {
  fs.writeFileSync(path.join(dir, 'ROOM.md'), contents, 'utf8');
}

// ---------- Runner ----------

let passed = 0;
let failed = 0;
const pendingAsync = [];
function run(name, fn) {
  try {
    const maybePromise = fn();
    if (maybePromise && typeof maybePromise.then === 'function') {
      // Defer pass/fail bookkeeping until the promise settles; drive it
      // from main() below so a failing async test still exits non-zero.
      pendingAsync.push(
        maybePromise.then(
          () => {
            process.stdout.write('  OK ' + name + '\n');
            passed += 1;
          },
          (e) => {
            process.stderr.write('  FAIL ' + name + ': ' + (e && e.message || e) + '\n');
            if (e && e.stack) process.stderr.write(e.stack + '\n');
            failed += 1;
          }
        )
      );
      return;
    }
    process.stdout.write('  OK ' + name + '\n');
    passed += 1;
  } catch (e) {
    process.stderr.write('  FAIL ' + name + ': ' + (e && e.message || e) + '\n');
    if (e && e.stack) process.stderr.write(e.stack + '\n');
    failed += 1;
  }
}

// ---------- Tests ----------

run('test 1 -- no markers + 3 artifacts: markers APPENDED, prose preserved', () => {
  const room = mkTmp('recomp-t1-');
  const sec = sectionDir(room, 'market-analysis');
  const identityProse =
    '# Market Analysis\n' +
    '\n' +
    'Bottom-up TAM analysis for the enterprise SaaS wedge.\n';
  writeRoomMd(sec, identityProse);
  writeArtifact(sec, 'tam-bottom-up', 'TAM Bottom-Up Analysis');
  writeArtifact(sec, 'sam-calculation', 'SAM Calculation');
  writeArtifact(sec, 'competitor-density', 'Competitor Density Report');

  const result = recompiler.recompile(sec);
  assert.equal(result.success, true, 'recompile returned non-success: ' + JSON.stringify(result));
  assert.ok(result.references_count >= 3, 'expected >=3 references, got ' + result.references_count);

  const out = readRoomMd(sec);
  assert.ok(out.indexOf('<!-- BEGIN REFERENCES -->') !== -1, 'BEGIN marker missing');
  assert.ok(out.indexOf('<!-- END REFERENCES -->') !== -1, 'END marker missing');
  assert.ok(out.indexOf('tam-bottom-up') !== -1, 'tam-bottom-up link missing');
  assert.ok(out.indexOf('sam-calculation') !== -1, 'sam-calculation link missing');
  assert.ok(out.indexOf('competitor-density') !== -1, 'competitor-density link missing');
  // Prose preserved verbatim
  assert.ok(out.indexOf('Bottom-up TAM analysis for the enterprise SaaS wedge.') !== -1,
    'identity prose was not preserved');
});

run('test 2 -- existing REFERENCES block is REPLACED, prose outside byte-identical', () => {
  const room = mkTmp('recomp-t2-');
  const sec = sectionDir(room, 'market-analysis');
  const proseBefore = '# Market Analysis\n\nOriginal human prose.\n';
  const proseAfter = '\n[More human-authored content -- preserved.]\n';
  const staleBlock =
    '<!-- BEGIN REFERENCES -->\n' +
    '## Cross-References\n\n' +
    '### Artifacts in this section\n' +
    '- [[stale-artifact|Old Link]]\n' +
    '<!-- END REFERENCES -->\n';
  writeRoomMd(sec, proseBefore + staleBlock + proseAfter);

  writeArtifact(sec, 'new-one', 'New One');
  writeArtifact(sec, 'new-two', 'New Two');

  const result = recompiler.recompile(sec);
  assert.equal(result.success, true);

  const out = readRoomMd(sec);
  // Stale link gone, new links present
  assert.equal(out.indexOf('stale-artifact'), -1, 'stale link was not removed');
  assert.ok(out.indexOf('new-one') !== -1, 'new-one link missing');
  assert.ok(out.indexOf('new-two') !== -1, 'new-two link missing');
  // Prose outside preserved
  assert.ok(out.indexOf('Original human prose.') !== -1, 'prose before markers lost');
  assert.ok(out.indexOf('[More human-authored content -- preserved.]') !== -1,
    'prose after markers lost');
  // Exactly one BEGIN / one END marker (no duplication)
  const beginCount = (out.match(/<!-- BEGIN REFERENCES -->/g) || []).length;
  const endCount = (out.match(/<!-- END REFERENCES -->/g) || []).length;
  assert.equal(beginCount, 1, 'expected exactly 1 BEGIN marker, got ' + beginCount);
  assert.equal(endCount, 1, 'expected exactly 1 END marker, got ' + endCount);
});

run('test 3 -- artifact wikilink to other section surfaces under Section links', () => {
  const room = mkTmp('recomp-t3-');
  const sec = sectionDir(room, 'market-analysis');
  writeRoomMd(sec, '# Market Analysis\n\nProse.\n');
  fs.writeFileSync(
    path.join(sec, 'tam-analysis.md'),
    '# TAM Analysis\n\nSee [[problem-definition/wedge-spec]] and [[financial-model/pricing]].\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(sec, 'sam-calc.md'),
    '# SAM Calc\n\nAlso references [[problem-definition/wedge-spec]] (duplicate target, should dedupe).\n',
    'utf8'
  );

  const result = recompiler.recompile(sec);
  assert.equal(result.success, true);

  const out = readRoomMd(sec);
  // Section-level links present
  assert.ok(out.indexOf('problem-definition/wedge-spec') !== -1,
    'cross-section link problem-definition/wedge-spec missing');
  assert.ok(out.indexOf('financial-model/pricing') !== -1,
    'cross-section link financial-model/pricing missing');
  // Deduped: problem-definition/wedge-spec appears at most once under "Section links"
  const sectionLinksMatch = out.match(
    /### Section links\n([\s\S]*?)(?=\n###|\n<!-- END REFERENCES -->)/
  );
  assert.ok(sectionLinksMatch, 'Section links header missing');
  const secBlock = sectionLinksMatch[1];
  const occurrences = (secBlock.match(/problem-definition\/wedge-spec/g) || []).length;
  assert.equal(occurrences, 1, 'cross-section link not deduped; occurrences=' + occurrences);
});

run('test 4 -- wikilink in identity prose OUTSIDE markers stays in prose, not moved', () => {
  const room = mkTmp('recomp-t4-');
  const sec = sectionDir(room, 'market-analysis');
  const prose =
    '# Market Analysis\n\n' +
    'This section ties back to [[sibling-section/foo]] (a human-authored note).\n';
  writeRoomMd(sec, prose);
  writeArtifact(sec, 'real-artifact', 'Real Artifact');

  const result = recompiler.recompile(sec);
  assert.equal(result.success, true);

  const out = readRoomMd(sec);
  // The human wikilink survives in prose
  assert.ok(out.indexOf('[[sibling-section/foo]]') !== -1,
    'identity-prose wikilink was stripped');
  // And it is NOT added into the auto-block section-links list.
  const beginIdx = out.indexOf('<!-- BEGIN REFERENCES -->');
  const endIdx = out.indexOf('<!-- END REFERENCES -->');
  assert.ok(beginIdx !== -1 && endIdx > beginIdx);
  const autoBlock = out.slice(beginIdx, endIdx);
  assert.equal(autoBlock.indexOf('sibling-section/foo'), -1,
    'prose wikilink leaked into auto-block');
});

run('test 5 -- ROOM.md / STATE.md / MINTO.md filtered from artifact list', () => {
  const room = mkTmp('recomp-t5-');
  const sec = sectionDir(room, 'market-analysis');
  writeRoomMd(sec, '# Market Analysis\n\nProse.\n');
  // System files: must NOT appear in artifact list
  fs.writeFileSync(path.join(sec, 'STATE.md'), '# State\n', 'utf8');
  fs.writeFileSync(path.join(sec, 'MINTO.md'), '---\n---\n# Minto\n', 'utf8');
  // A real artifact
  writeArtifact(sec, 'valid-artifact', 'Valid Artifact');

  const result = recompiler.recompile(sec);
  assert.equal(result.success, true);

  const out = readRoomMd(sec);
  // Scope assertions to the machine-managed block only so the "ROOM.md"
  // appearing in section-links target rendering (e.g. "section/ROOM.md")
  // cannot poison the filter check.
  const beginIdx = out.indexOf('<!-- BEGIN REFERENCES -->');
  const endIdx = out.indexOf('<!-- END REFERENCES -->');
  const block = out.slice(beginIdx, endIdx);
  const artifactsBlockMatch = block.match(
    /### Artifacts in this section\n([\s\S]*?)(?=\n###|$)/
  );
  assert.ok(artifactsBlockMatch, 'Artifacts subsection missing');
  const aBlock = artifactsBlockMatch[1];
  assert.ok(aBlock.indexOf('valid-artifact') !== -1, 'valid-artifact missing');
  assert.equal(aBlock.indexOf('STATE'), -1, 'STATE.md leaked into artifact list');
  assert.equal(aBlock.indexOf('MINTO'), -1, 'MINTO.md leaked into artifact list');
});

run('test 6 -- mtime conflict detection: ROOM.md edited after stamp -> skip', () => {
  const room = mkTmp('recomp-t6-');
  const sec = sectionDir(room, 'market-analysis');
  const prose = '# Market Analysis\n\nOriginal prose.\n';
  writeRoomMd(sec, prose);
  writeArtifact(sec, 'art-1', 'Art 1');

  // Stamp at "now - 60s"; ROOM.md mtime pushed to "now + 60s" to simulate a
  // human edit that post-dates the last recompile.
  const stampPath = path.join(room, '.mindrian', 'recompile-stamps.json');
  const nowMs = Date.now();
  const stampData = {};
  stampData[sec] = { last_recompile_at: nowMs - 60_000 };
  fs.writeFileSync(stampPath, JSON.stringify(stampData, null, 2), 'utf8');

  const futureSec = new Date(nowMs + 60_000) / 1000;
  fs.utimesSync(path.join(sec, 'ROOM.md'), futureSec, futureSec);

  const result = recompiler.recompile(sec);
  assert.equal(result.success, false, 'expected skip on mtime conflict');
  assert.equal(result.reason, 'mtime_conflict', 'wrong skip reason: ' + result.reason);

  // ROOM.md unchanged (no markers injected)
  const out = readRoomMd(sec);
  assert.equal(out, prose, 'ROOM.md was modified despite mtime conflict');
});

run('test 7 -- concurrent recompiles: final state well-formed, no duplicate block', () => {
  const room = mkTmp('recomp-t7-');
  const sec = sectionDir(room, 'market-analysis');
  writeRoomMd(sec, '# Market Analysis\n\nProse for concurrency test.\n');
  // Several artifacts so writes have something to emit
  for (let i = 0; i < 5; i++) {
    writeArtifact(sec, 'art-' + i, 'Art ' + i);
  }

  // Fork 3 workers that each recompile the same section in parallel.
  // Workers exit 0 on success, 1 on throw.
  const worker = path.join(__dirname, 'recompile-room-references.worker.cjs');
  assert.ok(fs.existsSync(worker), 'worker file missing: ' + worker);
  const promises = [];
  for (let i = 0; i < 3; i++) {
    promises.push(new Promise((resolve) => {
      const child = fork(worker, [sec], { silent: true });
      child.on('exit', (code) => resolve(code));
    }));
  }
  return Promise.all(promises).then((codes) => {
    assert.ok(codes.every((c) => c === 0 || c === 2), // 2 is mtime-conflict skip, valid outcome
      'some workers failed with non-0/2 exit: ' + JSON.stringify(codes));
    const out = readRoomMd(sec);
    const beginCount = (out.match(/<!-- BEGIN REFERENCES -->/g) || []).length;
    const endCount = (out.match(/<!-- END REFERENCES -->/g) || []).length;
    assert.equal(beginCount, 1, 'expected 1 BEGIN after concurrent recompiles, got ' + beginCount);
    assert.equal(endCount, 1, 'expected 1 END after concurrent recompiles, got ' + endCount);
    // Prose preserved
    assert.ok(out.indexOf('Prose for concurrency test.') !== -1, 'prose lost in concurrent write');
    // Block must be well-formed: END after BEGIN
    assert.ok(out.indexOf('<!-- END REFERENCES -->') > out.indexOf('<!-- BEGIN REFERENCES -->'),
      'END appears before BEGIN');
  });
});

run('test 8 -- 20-artifact section completes in under 200ms', () => {
  const room = mkTmp('recomp-t8-');
  const sec = sectionDir(room, 'dense-section');
  writeRoomMd(sec, '# Dense Section\n\nLots of artifacts.\n');
  for (let i = 0; i < 20; i++) {
    writeArtifact(sec, 'artifact-' + i, 'Artifact ' + i, 'Content number ' + i + '.\n');
  }

  const start = Date.now();
  const result = recompiler.recompile(sec);
  const elapsed = Date.now() - start;
  assert.equal(result.success, true);
  assert.ok(result.references_count >= 20,
    'expected >=20 references, got ' + result.references_count);
  assert.ok(elapsed < 200, 'recompile took ' + elapsed + 'ms (budget 200ms)');
  // Sanity: elapsed_ms reported by result is within ballpark
  assert.ok(typeof result.elapsed_ms === 'number', 'result.elapsed_ms missing');
});

run('test 9 -- empty section produces placeholder line', () => {
  const room = mkTmp('recomp-t9-');
  const sec = sectionDir(room, 'empty-section');
  writeRoomMd(sec, '# Empty Section\n\nNothing here yet.\n');

  const result = recompiler.recompile(sec);
  assert.equal(result.success, true);
  assert.equal(result.references_count, 0);

  const out = readRoomMd(sec);
  assert.ok(out.indexOf('<!-- BEGIN REFERENCES -->') !== -1, 'BEGIN marker missing');
  assert.ok(out.indexOf('No artifacts yet in this section.') !== -1,
    'empty placeholder text missing');
});

run('test 10 -- missing ROOM.md: exit code 2 via CLI, no file created', () => {
  const room = mkTmp('recomp-t10-');
  const sec = sectionDir(room, 'no-room-md');
  // Do NOT create ROOM.md
  writeArtifact(sec, 'orphan', 'Orphan artifact');

  // Programmatic call
  const result = recompiler.recompile(sec);
  assert.equal(result.success, false);
  assert.equal(result.reason, 'no_room_md');
  assert.equal(fs.existsSync(path.join(sec, 'ROOM.md')), false,
    'recompiler wrongly created ROOM.md');

  // CLI invocation
  const res = spawnSync(process.execPath, [CLI, sec], { encoding: 'utf8' });
  assert.equal(res.status, 2, 'CLI exit code ' + res.status + ' (expected 2). stderr: ' + res.stderr);
  assert.ok(/ROOM\.md not found/i.test(res.stderr), 'stderr missing "ROOM.md not found": ' + res.stderr);
  assert.equal(fs.existsSync(path.join(sec, 'ROOM.md')), false,
    'CLI wrongly created ROOM.md');
});

// ---------- Epilogue ----------

Promise.all(pendingAsync).then(() => {
  process.stdout.write('\nrecompile-room-references: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
});
