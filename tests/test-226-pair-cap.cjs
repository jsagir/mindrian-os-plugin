#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-04 -- D8 / G-6 END-TO-END PAIR-CAP (REQ-7).
 *
 * WHY THIS TEST EXISTS (the failure it forbids)
 *   The paid rubric fan-out must be bounded by the CAP, never by room size. A
 *   200-entry room has ~10k raw cross-section pairs; an uncapped O(N^2) reasoning
 *   pass would send all of them to the (paid) rubric. This leg proves, against the
 *   REAL degrade seeder and score stage:
 *     (1) pairs.json candidates.length <= 25 (the default cap) while the fan-out
 *         that existed (pairs_considered) is in the thousands - the free Jaccard
 *         pre-filter selected the capped low-overlap eureka band;
 *     (2) after a stubbed rubric score over the capped set, provenance.pairs_sent
 *         <= provenance.reasoning_cap (cost bounded by the cap, not room size);
 *     (3) MINDRIAN_EUREKA_REASONING_MAX_PAIRS=7 in a CHILD process env makes the
 *         cap 7 (the env override is read at call time, honored in a real spawn).
 *
 *   Runtime is bounded: entry bodies are tiny, the Jaccard pre-filter is pure CJS
 *   math over 200 entries, and the encoder never loads (--force-encoder-unavailable).
 *   Target well under 30 seconds.
 *
 * Runs under the aggregator NODE_OPTIONS=--require tests/eureka-offline-preload.cjs
 * zero-network guard. Standalone: node tests/test-226-pair-cap.cjs. node:assert
 * strict, node built-ins + in-repo requires only. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const runner = require(path.join(REPO_ROOT, 'scripts', 'eureka-portfolio-report.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { FIXTURE_PAIRS } = require(path.join(REPO_ROOT, 'tests', 'fixtures', '226-reasoning-pairs.cjs'));

const DEFAULT_CAP = 25;
const ENTRY_COUNT = 200;

// Synthetic N-entry room: two sections (alpha / beta), tiny distinct bodies so the
// cross-section fan-out is ~ (N/2)^2 raw pairs but every body clears the noise
// floor. room.db carries the Claim nodes; markdown entries on disk feed
// readRoomMarkdown (the reasoning path reads disk directly).
function makeSyntheticRoom(n) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-226-cap-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const now = new Date().toISOString();
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (let i = 1; i <= n; i += 1) {
    const inA = i <= n / 2;
    const section = inA ? 'alpha' : 'beta';
    const id = 'E' + String(i).padStart(5, '0');
    // Distinct token mix per entry so Jaccard has a real ordering to pre-filter on.
    const body = 'This entry explores term' + (i % 37) + ' with word' + (i % 53)
      + ' and node' + (i % 71) + ' across sections to make a body over forty characters long.';
    ins.run(id, 'Claim', JSON.stringify({ text: body, section: section }),
      'fixture://' + id, 'import', now, now);
    const secDir = path.join(dir, section);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, id + '.md'), '# ' + section + ' ' + i + '\n\n' + body + '\n', 'utf8');
  }
  closeRoomDb(db);
  return dir;
}

async function main() {
  const t0 = Date.now();
  const dir = makeSyntheticRoom(ENTRY_COUNT);
  const workdir = path.join(dir, 'wd');
  const outPath = path.join(dir, 'report.md');
  const jsonPath = path.join(dir, 'report.json');
  const baseArgs = [
    '--db', dir, '--pairs', 'room',
    '--out', outPath, '--json', jsonPath, '--reasoning-workdir', workdir,
  ];

  // ----- (1) The degrade seed caps candidates at the default while the raw
  //           fan-out is in the thousands. -----
  const code0 = await runner.main(baseArgs.concat(['--force-encoder-unavailable']));
  assert.strictEqual(code0, 0, 'degrade run main() exits 0 (got ' + code0 + ')');

  const pairsDoc = JSON.parse(fs.readFileSync(path.join(workdir, 'pairs.json'), 'utf8'));
  assert.strictEqual(pairsDoc.entries_read, ENTRY_COUNT,
    'the seed read all ' + ENTRY_COUNT + ' entries (got ' + pairsDoc.entries_read + ')');
  assert.ok(pairsDoc.candidates.length <= DEFAULT_CAP,
    'pairs.json candidates.length (' + pairsDoc.candidates.length + ') <= default cap ' + DEFAULT_CAP);
  assert.strictEqual(pairsDoc.cap, DEFAULT_CAP, 'the seeded cap is the default ' + DEFAULT_CAP);
  assert.ok(pairsDoc.pairs_considered > 1000,
    'the raw cross-section fan-out existed and is bounded by the cap, not sent whole '
    + '(pairs_considered ' + pairsDoc.pairs_considered + ' > 1000)');

  // ----- (2) A stubbed rubric score over the capped set: pairs_sent <= cap. -----
  const mappings = {};
  const answers = {};
  for (let i = 0; i < pairsDoc.candidates.length; i += 1) {
    const c = pairsDoc.candidates[i];
    const f = FIXTURE_PAIRS[i % FIXTURE_PAIRS.length];
    mappings[c.id] = { mechanismText: f.mechanismText, mappingStatement: f.mappingStatement };
    answers[c.id] = { neutral: f.neutral, adversarial: f.adversarial };
  }
  fs.writeFileSync(path.join(workdir, 'mappings.json'), JSON.stringify(mappings), 'utf8');
  fs.writeFileSync(path.join(workdir, 'answers.json'), JSON.stringify(answers), 'utf8');

  const codeE = await runner.reasoningStageEmit(runner.parseArgv(baseArgs.concat(['--reasoning-emit'])));
  assert.strictEqual(codeE, 0, 'reasoningStageEmit exits 0 (got ' + codeE + ')');
  const codeS = await runner.reasoningStageScore(runner.parseArgv(baseArgs.concat(['--reasoning-score'])));
  assert.strictEqual(codeS, 0, 'reasoningStageScore exits 0 (got ' + codeS + ')');

  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(report.provenance.pairs_sent <= report.provenance.reasoning_cap,
    'provenance.pairs_sent (' + report.provenance.pairs_sent + ') <= reasoning_cap ('
    + report.provenance.reasoning_cap + ') - cost bounded by the cap, not room size');
  assert.strictEqual(report.provenance.reasoning_cap, DEFAULT_CAP,
    'the scored report cap is the default ' + DEFAULT_CAP);
  assert.ok(report.provenance.pairs_considered > 1000,
    'the report provenance carries the raw fan-out (pairs_considered ' + report.provenance.pairs_considered + ')');

  // ----- (3) The env override works in a CHILD process (read at call time). -----
  const childWorkdir = path.join(dir, 'wd7');
  const childOut = path.join(dir, 'report7.md');
  const childJson = path.join(dir, 'report7.json');
  const childEnv = Object.assign({}, process.env, { MINDRIAN_EUREKA_REASONING_MAX_PAIRS: '7' });
  const child = spawnSync(process.execPath, [
    path.join(REPO_ROOT, 'scripts', 'eureka-portfolio-report.cjs'),
    '--db', dir, '--pairs', 'room', '--force-encoder-unavailable',
    '--out', childOut, '--json', childJson, '--reasoning-workdir', childWorkdir,
  ], { env: childEnv, encoding: 'utf8' });
  assert.strictEqual(child.status, 0,
    'the child degrade run exits 0 (stderr: ' + String(child.stderr || '').slice(0, 400) + ')');
  const childPairs = JSON.parse(fs.readFileSync(path.join(childWorkdir, 'pairs.json'), 'utf8'));
  assert.strictEqual(childPairs.cap, 7,
    'MINDRIAN_EUREKA_REASONING_MAX_PAIRS=7 in the child env makes the cap 7 (got ' + childPairs.cap + ')');
  assert.ok(childPairs.candidates.length <= 7,
    'the child candidates.length (' + childPairs.candidates.length + ') <= the overridden cap 7');

  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 30000, 'the whole cap leg ran under 30s (took ' + elapsed + 'ms)');

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.stdout.write('test-226-pair-cap: PASS (' + ENTRY_COUNT + ' entries, ' + pairsDoc.pairs_considered
    + ' raw pairs -> ' + pairsDoc.candidates.length + ' capped at ' + DEFAULT_CAP + ', pairs_sent '
    + report.provenance.pairs_sent + ' <= cap; env override cap=7 honored in a child; ' + elapsed + 'ms)\n');
}

main().then(function () { process.exit(0); }, function (err) {
  process.stderr.write('test-226-pair-cap: FAIL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
