#!/usr/bin/env node
'use strict';
/*
 * Phase 389 plan 03: measure research open question 5.
 * Question: do sentence-derived phrases give different Brain answers for
 * different ideas? The old fixed strings gave the same answer for every idea.
 *
 * This script refuses to run unless MOS_389_LIVE is exactly 1. With it, the
 * script uses the real HOME and the real Brain identity of the caller, and may
 * call Theo and Tavily. Only the main session sets MOS_389_LIVE. Without it, the
 * script prints NOT-MEASURED and the exact command line, and exits 0.
 *
 * Method: for each fixture phrase set of tests/fixtures/389/sprouts.json, run the
 * card and run commands of scripts/pyramid-seed-run.cjs as child processes. Record
 * for each cell the status, the count of results, the duration and a short hash of
 * the excerpt. Then give one verdict for each cell across the 3 fixtures:
 *   DISTINCT  the 3 excerpt hashes differ and none is empty
 *   SAME      two or more equal non-empty excerpt hashes
 *   EMPTY     every status is empty
 *   PARTIAL   anything else (some empty, the rest distinct)
 * The table goes into 389-MEASURE.md between the two marker lines.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PHASE_DIR = __dirname;
const REPO = path.resolve(PHASE_DIR, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'pyramid-seed-run.cjs');
const FIXTURES = path.join(REPO, 'tests', 'fixtures', '389', 'sprouts.json');
const MEASURE_MD = path.join(PHASE_DIR, '389-MEASURE.md');
const START = '<!-- measure:start -->';
const END = '<!-- measure:end -->';
const CMD = 'MOS_389_LIVE=1 node .planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family/389-measure-live.cjs';
const SLOT_ORDER = ['situation', 'complication', 'analogy', 'funding'];

function setHash(set) {
  const o = {};
  SLOT_ORDER.forEach((s) => { if (typeof set[s] === 'string') o[s] = set[s].trim(); });
  return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
}

function cli(args) {
  const r = spawnSync(process.execPath, [SCRIPT].concat(args), { cwd: REPO, encoding: 'utf8', timeout: 120000 });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch (_e) { json = null; }
  return { code: r.status, json };
}

function resultCount(cell) {
  if (Array.isArray(cell.titles)) return cell.titles.length;
  if (typeof cell.excerpt !== 'string' || cell.excerpt.length === 0) return 0;
  return cell.excerpt.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
}

function verdict(rows) {
  if (rows.every((r) => r.status !== 'ok')) return 'EMPTY';
  const hashes = rows.filter((r) => r.status === 'ok').map((r) => r.hash);
  if (new Set(hashes).size < hashes.length) return 'SAME';
  if (hashes.length === rows.length) return 'DISTINCT';
  return 'PARTIAL';
}

function main() {
  if (process.env.MOS_389_LIVE !== '1') {
    process.stdout.write('NOT-MEASURED\n');
    process.stdout.write('Open question 5 is measured only when the main session allows live Brain and web calls.\n');
    process.stdout.write('Command that measures it:\n  ' + CMD + '\n');
    return 0;
  }
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-measure-'));
  const ids = Object.keys(fixtures);
  const perCell = {};
  ids.forEach((fid) => {
    const file = path.join(tmp, fid + '.json');
    fs.writeFileSync(file, JSON.stringify(fixtures[fid]));
    const card = cli(['card', '--sprouts', file]);
    if (card.code !== 0) {
      process.stdout.write('card failed for ' + fid + ' (exit ' + card.code + ')\n');
      return;
    }
    const run = cli(['run', '--sprouts', file, '--confirm', setHash(fixtures[fid])]);
    if (run.code !== 0 || !run.json || !Array.isArray(run.json.cells)) {
      process.stdout.write('run failed for ' + fid + ' (exit ' + run.code + ')\n');
      return;
    }
    run.json.cells.forEach((c) => {
      if (!perCell[c.id]) perCell[c.id] = [];
      perCell[c.id].push({
        fixture: fid,
        status: c.status,
        count: resultCount(c),
        ms: c.duration_ms,
        hash: crypto.createHash('sha256').update(c.excerpt || '').digest('hex').slice(0, 12),
      });
    });
  });
  const lines = [];
  lines.push('Measured: ' + new Date().toISOString() + ' (MOS_389_LIVE=1, caller HOME and Brain identity)');
  lines.push('');
  lines.push('| cell | fixture | status | results | ms | excerpt hash |');
  lines.push('|------|---------|--------|---------|----|--------------|');
  const verdicts = [];
  Object.keys(perCell).forEach((cid) => {
    perCell[cid].forEach((r) => lines.push('| ' + cid + ' | ' + r.fixture + ' | ' + r.status + ' | ' + r.count + ' | ' + r.ms + ' | ' + (r.status === 'ok' ? r.hash : '-') + ' |'));
    verdicts.push('- ' + cid + ': ' + verdict(perCell[cid]));
  });
  lines.push('');
  lines.push('Verdicts across the 3 fixtures:');
  lines.push('');
  verdicts.forEach((v) => lines.push(v));
  const block = START + '\n' + lines.join('\n') + '\n' + END;
  let md = fs.readFileSync(MEASURE_MD, 'utf8');
  const a = md.indexOf(START);
  const b = md.indexOf(END);
  if (a === -1 || b === -1 || b < a) {
    process.stdout.write('389-MEASURE.md has no marker lines; table not written\n');
    return 1;
  }
  md = md.slice(0, a) + block + md.slice(b + END.length);
  fs.writeFileSync(MEASURE_MD, md);
  process.stdout.write(lines.join('\n') + '\n');
  return 0;
}

process.exit(main());
