#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-03 -- the D6 / G-4 MODE-DISCLOSURE three-surface test (REQ-5).
 *
 * WHY THIS TEST EXISTS (the failure it forbids)
 *   The mode label must ride WITH the result at every surface a reader can reach:
 *   the md report, the json provenance, AND the /mos:eureka html export. If the
 *   label is present in json but dropped from the html a second reader opens, that
 *   reader mistakes a lower-confidence reasoning result for a full-confidence
 *   embedded one -- the exact over-trust vector the whole phase exists to prevent.
 *
 * WHAT IT PROVES (on ONE and the same reasoning run)
 *   (1) md contains the reasoning-mode caveat and names 'reasoning' before provenance;
 *   (2) json provenance.run_mode === 'reasoning';
 *   (3) the html export (written by the REAL eureka-command html subcommand, spawned)
 *       exists and carries 'REASONING MODE', the caveat, and the degrade_cause;
 *   (4) the html is self-contained (no external URL, Part 8);
 *   (5) an embedded-shaped json re-exported yields an html whose banner names the
 *       embedded run_mode string (the label is never reasoning-only, never defaulted);
 *   (6) commands/eureka.md documents html, the reasoning flow, and the faithful-judge
 *       NEVER-estimate rule (the doc-parity leg, so the command doc cannot rot).
 *
 * Hermetic: builds a temp room, drives the REAL emitter degrade + reasoning stages,
 * spawns the REAL dispatcher for the html leg. Runs under the offline preload
 * (zero-network guard). node:assert strict, node built-ins + in-repo requires only.
 * No em-dashes.
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

const CMD = path.join(REPO_ROOT, 'scripts', 'eureka-command.cjs');

const POOL_A = ['photon', 'lattice', 'entropy', 'plasma', 'quantum', 'resonance'];
const POOL_B = ['enzyme', 'protein', 'membrane', 'genome', 'mitosis', 'receptor'];

function bodyFor(idx, pool) {
  const a = pool[idx % pool.length];
  const b = pool[(idx + 2) % pool.length];
  return 'The ' + a + ' governs the ' + b + ' behavior under load, exploring how ' + a
    + ' and ' + b + ' couple across the boundary of this domain in several sentences.';
}

// A hermetic room with 6 nodes across 2 sections plus matching markdown on disk
// (readRoomMarkdown reads disk directly). Mirrors test-226-field-contract.
function makeFixtureRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-226-md-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const now = new Date().toISOString();
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  for (let i = 1; i <= 6; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= 3;
    const section = inA ? 'physics' : 'biology';
    const body = bodyFor(i, inA ? POOL_A : POOL_B);
    ins.run(id, 'Claim', JSON.stringify({ text: body, section: section, parentId: inA ? 'DOM_A' : 'DOM_B' }),
      'fixture://' + id, 'import', now, now);
    const secDir = path.join(dir, section);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, id + '.md'), '# ' + section + ' tech ' + i + '\n\n' + body + '\n', 'utf8');
  }
  closeRoomDb(db);
  return dir;
}

function makeFixtureGraph(graphPath) {
  const nodes = [];
  for (let i = 1; i <= 6; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= 3;
    nodes.push({
      data: {
        id: id, cnumber: id, title: (inA ? 'physics tech ' : 'biology tech ') + i,
        primary_tier: 1, pair_count: 5 + i, degree: 10 + i,
        section: inA ? 'physics' : 'biology',
        primary_problem: (inA ? 'energy transport gap ' : 'cell signaling gap ') + i,
        problems: [(inA ? 'energy transport gap ' : 'cell signaling gap ') + i],
      },
    });
  }
  const edges = [
    { data: { type: 'CONVERGES', source: 'C00001', target: 'C00004', shared_problems: ['cross-domain bridge'] } },
    { data: { type: 'CONVERGES', source: 'C00002', target: 'C00005', shared_problems: ['boundary coupling'] } },
  ];
  fs.writeFileSync(graphPath,
    JSON.stringify({ meta: { honest_nouns: 'hermetic 226 fixture' }, elements: { nodes: nodes, edges: edges } }),
    'utf8');
}

async function main() {
  const dir = makeFixtureRoom();
  const graphPath = path.join(dir, 'idea-graph.json');
  makeFixtureGraph(graphPath);

  // Write the report to the DEFAULT eureka report location so the html subcommand
  // (which reads <room>/.mindrian/eureka/portfolio-report.json) sees the same run.
  const reportDir = path.join(dir, '.mindrian', 'eureka');
  fs.mkdirSync(reportDir, { recursive: true });
  const outPath = path.join(reportDir, 'portfolio-report.md');
  const jsonPath = path.join(reportDir, 'portfolio-report.json');
  const workdir = path.join(reportDir, 'reasoning');

  const baseArgs = [
    '--db', dir, '--graph', graphPath, '--pairs', 'graph',
    '--out', outPath, '--json', jsonPath, '--reasoning-workdir', workdir,
  ];

  // (A) Drive the REAL degrade (encoder_unavailable via the deterministic seam).
  const code0 = await runner.main(baseArgs.concat(['--force-encoder-unavailable']));
  assert.strictEqual(code0, 0, 'degrade run main() exits 0 (got ' + code0 + ')');

  const pairsDoc = JSON.parse(fs.readFileSync(path.join(workdir, 'pairs.json'), 'utf8'));
  assert.ok(pairsDoc.candidates.length > 0, 'the degrade seeded candidate pairs');

  // (B) The session writes mappings + answers keyed by the seeded candidate ids.
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

  // (C) Emit + score through the REAL exported stages -> writes the mode:reasoning
  //     md + json at the default report location.
  const codeE = await runner.reasoningStageEmit(runner.parseArgv(baseArgs.concat(['--reasoning-emit'])));
  assert.strictEqual(codeE, 0, 'reasoningStageEmit exits 0 (got ' + codeE + ')');
  const codeS = await runner.reasoningStageScore(runner.parseArgv(baseArgs.concat(['--reasoning-score'])));
  assert.strictEqual(codeS, 0, 'reasoningStageScore exits 0 (got ' + codeS + ')');

  // -- Surface 1: the md report. --
  const md = fs.readFileSync(outPath, 'utf8');
  const caveatIdx = md.indexOf('reasoning-mode caveat');
  const provIdx = md.indexOf('## Provenance');
  assert.ok(caveatIdx >= 0, 'md contains the reasoning-mode caveat block');
  assert.ok(caveatIdx < provIdx, 'md caveat appears BEFORE the provenance table');
  assert.ok(/reasoning/i.test(md.slice(0, provIdx)), "md names 'reasoning' before the provenance table");

  // -- Surface 2: the json provenance. --
  const jsonDoc = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.strictEqual(jsonDoc.provenance.run_mode, 'reasoning', "json provenance.run_mode === 'reasoning'");
  assert.strictEqual(jsonDoc.provenance.degrade_cause, 'encoder_unavailable', 'json names the degrade cause');

  // -- Surface 3: the html export, via the REAL dispatcher (spawned). --
  const htmlRun = spawnSync(process.execPath, [CMD, dir, 'html'], { encoding: 'utf8', env: process.env });
  assert.strictEqual(htmlRun.status, 0, 'eureka-command html exits 0 (stderr: ' + (htmlRun.stderr || '') + ')');
  assert.ok(/mode:\s*reasoning/i.test(htmlRun.stdout), 'the CLI confirmation discloses the mode');

  const htmlPath = path.join(reportDir, 'portfolio-report.html');
  assert.ok(fs.existsSync(htmlPath), 'the html export file exists');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(/REASONING MODE/.test(html), "the html banner reads 'REASONING MODE' (D6, label not lost)");
  assert.ok(/lower confidence/i.test(html), 'the html carries the reasoning caveat');
  assert.ok(html.indexOf('encoder_unavailable') !== -1, 'the html names the degrade cause');
  // (4) self-contained: no external URL of any kind (Part 8).
  assert.ok(!/https?:\/\//.test(html) && !/\/\/cdn/.test(html), 'the html has no external URL (self-contained)');

  // -- (5) The label is NEVER reasoning-only: an embedded-shaped json re-exported
  //        yields an html whose banner names the embedded run_mode verbatim. --
  const embeddedRunMode = 'live (local embedding spine)';
  const embeddedJson = {
    provenance: { run_mode: embeddedRunMode, run_date: '2026-07-15', pairs_mode: 'graph' },
    ranked: [{ rank: 1, a: 'C00001', b: 'C00004', a_title: 'physics tech 1', b_title: 'biology tech 4', score: 0.72, banked: false }],
    tail: { items: [] },
    statements: [{ rank: 1, a: 'C00001', b: 'C00004', tail_flag: false, text: 'An embedded statement.', banked: false, critic: 'transferable', weak_dimensions: [], potential_tier: 'tier2', mode: 'embedded' }],
  };
  fs.writeFileSync(jsonPath, JSON.stringify(embeddedJson, null, 2) + '\n', 'utf8');
  const htmlRun2 = spawnSync(process.execPath, [CMD, dir, 'html'], { encoding: 'utf8', env: process.env });
  assert.strictEqual(htmlRun2.status, 0, 'embedded re-export html exits 0');
  const html2 = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html2.indexOf(embeddedRunMode) !== -1, 'the embedded html banner names the embedded run_mode string');
  assert.ok(!/REASONING MODE - LOWER-CONFIDENCE/.test(html2), 'the embedded html does NOT show the reasoning caveat banner');

  // -- (6) Doc-parity: commands/eureka.md teaches the honest protocol (no rot). --
  const doc = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'eureka.md'), 'utf8');
  assert.ok(/\bhtml\b/.test(doc), 'commands/eureka.md documents the html subcommand');
  assert.ok(/reasoning_await_mappings/.test(doc) || /reasoning mode/i.test(doc),
    'commands/eureka.md documents the reasoning-mode flow');
  assert.ok(/never\s+estimate/i.test(doc), 'commands/eureka.md states the faithful-judge NEVER-estimate rule');

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  process.stdout.write('test-226-mode-disclosure: PASS (label + caveat proven across md + json + html '
    + 'for one reasoning run; embedded banner + doc-parity verified)\n');
}

main().then(function () { process.exit(0); }, function (err) {
  process.stderr.write('test-226-mode-disclosure: FAIL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
