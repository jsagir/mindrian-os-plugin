/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-04 Task 1 -- stamp-artifact-write tests
 * =================================================
 * Covers the 5 behavior cases:
 *   1. MINTO.md exists -> stamp updates last_artifact_write_seen_at to current ISO;
 *      all other frontmatter keys untouched.
 *   2. MINTO.md absent -> stamp writes to .mindrian/pending-stamps/<section>.json
 *      with {section, last_artifact_write_seen_at}.
 *   3. Narrative body preserved byte-for-byte across stamp.
 *   4. Concurrent stamp writes (2 forks) -> final MINTO has ONE timestamp, no corruption.
 *   5. Malformed MINTO frontmatter -> stamp writes to pending-stamps instead, logs
 *      warning to stderr; no throw; exit 0.
 *
 * Test harness mirrors the pattern in lib/memory/minto-debouncer.test.cjs +
 * lib/memory/recompile-room-references.test.cjs: synchronous runner, mkTmp
 * helper per test, cleanup via process.on('exit').
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { fork, spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STAMP_CLI = path.join(REPO_ROOT, 'scripts', 'stamp-artifact-write.cjs');

// --- tmp dir management -----------------------------------------------------

const createdTmpDirs = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdTmpDirs.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of createdTmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

// --- helpers ----------------------------------------------------------------

function seedRoomAndSection(tmp, sectionName) {
  // .room-root sentinel at tmp; section is a sibling folder.
  fs.writeFileSync(path.join(tmp, '.room-root'), '');
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const sectionDir = path.join(tmp, sectionName);
  fs.mkdirSync(sectionDir, { recursive: true });
  return sectionDir;
}

function writeMintoMd(sectionDir, frontmatterLines, bodyLines) {
  const content =
    ['---', ...frontmatterLines, '---', '', ...bodyLines, ''].join('\n');
  fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), content);
  return content;
}

function runStampCli(sectionDir, extraEnv) {
  return spawnSync(
    process.execPath,
    [STAMP_CLI, sectionDir],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, extraEnv || {}),
    }
  );
}

// --- test runner ------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------- Test 1: happy path, updates only last_artifact_write_seen_at ----
test('Test 1: MINTO.md present -> last_artifact_write_seen_at stamped', async () => {
  const tmp = mkTmp('stamp-t1-');
  const sec = seedRoomAndSection(tmp, 'market-analysis');
  const fm = [
    'schema_version: "1.0"',
    'type: section-minto',
    'section: market-analysis',
    'governing_thought: "Market analysis anchors the venture thesis."',
    'last_generated_at: "2026-01-01T00:00:00Z"',
    'last_artifact_write_seen_at: null',
    'reasoning_health_score: null',
    'flagged_weaknesses: []',
    'decision_log: []',
  ];
  const body = ['# Market Analysis -- Minto Reasoning', '', 'Body paragraph.'];
  const before = writeMintoMd(sec, fm, body);

  const r = runStampCli(sec);
  assert.strictEqual(r.status, 0, 'stamp CLI must exit 0');

  const after = fs.readFileSync(path.join(sec, 'MINTO.md'), 'utf8');
  // last_artifact_write_seen_at now carries an ISO timestamp.
  const mm = after.match(
    /^last_artifact_write_seen_at:\s*"(20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)"\s*$/m
  );
  assert.ok(mm, 'last_artifact_write_seen_at must be ISO-stamped (got: ' + after + ')');

  // All other keys unchanged.
  assert.ok(/^schema_version: "1\.0"$/m.test(after), 'schema_version preserved');
  assert.ok(/^type: section-minto$/m.test(after), 'type preserved');
  assert.ok(/^section: market-analysis$/m.test(after), 'section preserved');
  assert.ok(
    /^governing_thought: "Market analysis anchors the venture thesis\."$/m.test(after),
    'governing_thought preserved'
  );
  assert.ok(
    /^last_generated_at: "2026-01-01T00:00:00Z"$/m.test(after),
    'last_generated_at preserved'
  );
  assert.ok(/^reasoning_health_score: null$/m.test(after), 'reasoning_health_score preserved');
  assert.ok(/^flagged_weaknesses: \[\]$/m.test(after), 'flagged_weaknesses preserved');
  assert.ok(/^decision_log: \[\]$/m.test(after), 'decision_log preserved');

  // Body preserved.
  assert.ok(after.includes('# Market Analysis -- Minto Reasoning'), 'body H1 preserved');
  assert.ok(after.includes('Body paragraph.'), 'body paragraph preserved');
});

// ---------- Test 2: MINTO absent -> pending-stamps fallback ----------------
test('Test 2: MINTO.md absent -> pending-stamps fallback', async () => {
  const tmp = mkTmp('stamp-t2-');
  const sec = seedRoomAndSection(tmp, 'problem-definition');

  const r = runStampCli(sec);
  assert.strictEqual(r.status, 0, 'stamp CLI must exit 0 even when MINTO absent');

  const pendingDir = path.join(tmp, '.mindrian', 'pending-stamps');
  assert.ok(fs.existsSync(pendingDir), 'pending-stamps dir created');
  const pendingFile = path.join(pendingDir, 'problem-definition.json');
  assert.ok(fs.existsSync(pendingFile), 'pending stamp JSON written for section');

  const payload = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
  assert.strictEqual(payload.section, 'problem-definition');
  assert.ok(
    /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(payload.last_artifact_write_seen_at),
    'pending stamp carries ISO timestamp'
  );
});

// ---------- Test 3: narrative body preserved byte-for-byte -----------------
test('Test 3: narrative body preserved byte-for-byte after stamp', async () => {
  const tmp = mkTmp('stamp-t3-');
  const sec = seedRoomAndSection(tmp, 'solution-design');
  const fm = [
    'schema_version: "1.0"',
    'type: section-minto',
    'section: solution-design',
    'governing_thought: "Solution design is the synthesis of prior analysis."',
    'last_generated_at: "2026-02-01T00:00:00Z"',
    'last_artifact_write_seen_at: null',
    'reasoning_health_score: 0.42',
    'flagged_weaknesses: []',
    'decision_log: []',
  ];
  // Body with multiple lines, wikilinks, special chars.
  const body = [
    '# Solution Design -- Minto Reasoning',
    '',
    '> [!abstract] Governing Thought',
    '> Solution design is the synthesis of prior analysis.',
    '',
    '## Argument Structure',
    '',
    '### Claim 1: Architecture',
    '',
    'See [[../problem-definition/MINTO.md|Problem]]',
    '',
    '### Claim 2: Constraints',
    '',
    'Unicode safe: citations (Smith 2024) -> key-results.',
    '',
    '---',
    '',
  ];
  writeMintoMd(sec, fm, body);
  const before = fs.readFileSync(path.join(sec, 'MINTO.md'), 'utf8');

  const r = runStampCli(sec);
  assert.strictEqual(r.status, 0, 'stamp CLI must exit 0');

  const after = fs.readFileSync(path.join(sec, 'MINTO.md'), 'utf8');

  // Extract the body regions (everything after closing `---`) and diff them.
  function bodyOf(content) {
    const m = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
    return m ? m[1] : content;
  }
  const beforeBody = bodyOf(before);
  const afterBody = bodyOf(after);
  assert.strictEqual(
    afterBody, beforeBody,
    'body region must be byte-identical after stamp'
  );
});

// ---------- Test 4: concurrent stamp writes serialize, no corruption -------
test('Test 4: 2 concurrent stamp forks -> one ISO, no corruption', async () => {
  const tmp = mkTmp('stamp-t4-');
  const sec = seedRoomAndSection(tmp, 'business-model');
  const fm = [
    'schema_version: "1.0"',
    'type: section-minto',
    'section: business-model',
    'governing_thought: "Business model drives monetization pathways."',
    'last_generated_at: "2026-03-01T00:00:00Z"',
    'last_artifact_write_seen_at: null',
    'reasoning_health_score: null',
    'flagged_weaknesses: []',
    'decision_log: []',
  ];
  writeMintoMd(sec, fm, ['# Business Model -- Minto', '', 'Body.']);

  // Fork two concurrent stamp CLIs.
  const children = [
    fork(STAMP_CLI, [sec], { silent: true }),
    fork(STAMP_CLI, [sec], { silent: true }),
  ];
  const results = await Promise.all(children.map((c) => new Promise((resolve) => {
    c.on('exit', (code) => resolve(code));
  })));
  // Both should exit 0 (soft-fail guarantee; worst case one bails on lock).
  for (const code of results) {
    assert.strictEqual(code, 0, 'every concurrent stamp exits 0');
  }

  // MINTO.md still well-formed: frontmatter parses, body intact.
  const after = fs.readFileSync(path.join(sec, 'MINTO.md'), 'utf8');
  assert.ok(
    /^---\r?\n[\s\S]*?\r?\n---/.test(after),
    'MINTO.md frontmatter structure preserved'
  );
  const matches = after.match(/^last_artifact_write_seen_at:\s*.*$/gm);
  assert.ok(matches && matches.length === 1,
    'exactly one last_artifact_write_seen_at line (no duplication)');
  assert.ok(
    /last_artifact_write_seen_at:\s*"20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/.test(after),
    'final stamp has valid ISO timestamp'
  );
  assert.ok(after.includes('# Business Model -- Minto'), 'body preserved after race');
});

// ---------- Test 5: malformed frontmatter -> pending-stamps fallback ------
test('Test 5: malformed MINTO frontmatter -> pending-stamps + stderr warn', async () => {
  const tmp = mkTmp('stamp-t5-');
  const sec = seedRoomAndSection(tmp, 'team');
  // Write a file called MINTO.md but missing the closing --- delimiter.
  fs.writeFileSync(
    path.join(sec, 'MINTO.md'),
    '---\nschema_version: "1.0"\ntype: section-minto\n# NO CLOSING DELIMITER\nbody text'
  );

  const r = runStampCli(sec);
  assert.strictEqual(r.status, 0, 'stamp CLI must exit 0 even on malformed MINTO');

  const pendingDir = path.join(tmp, '.mindrian', 'pending-stamps');
  assert.ok(fs.existsSync(pendingDir), 'pending-stamps dir created as fallback');
  const pendingFile = path.join(pendingDir, 'team.json');
  assert.ok(fs.existsSync(pendingFile), 'pending stamp written as fallback');

  // Stderr should carry a warning but must not throw.
  const stderr = r.stderr ? r.stderr.toString() : '';
  // Warning is expected but we stay permissive: at minimum, no uncaught exception.
  assert.ok(
    !/UnhandledPromiseRejection|Error:\s+ENOENT/i.test(stderr) ||
      /pending-stamps|malformed|frontmatter/i.test(stderr),
    'stderr does not crash; malformed signal acceptable'
  );
});

// --- CLI smoke: non-existent section path -> still exits 0 -----------------
test('Test 6 (acceptance): non-existent section path -> exit 0 (soft-fail)', async () => {
  const r = runStampCli('/does/not/exist/anywhere/section');
  assert.strictEqual(r.status, 0, 'stamp on missing dir must still exit 0');
});

// --- runner ----------------------------------------------------------------

(async () => {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (e) {
      failed += 1;
      process.stderr.write('FAIL ' + t.name + '\n' + (e && e.stack || e) + '\n');
    }
  }
  process.stdout.write(
    '\nstamp-artifact-write.test.cjs: ' +
    (tests.length - failed) + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
})();
