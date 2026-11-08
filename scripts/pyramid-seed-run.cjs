#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 389 plan 03 -- pyramid-seed-run: the card and run commands of the Seed
 * Test step.
 *
 * The host model writes at most four short generic phrases (slots situation,
 * complication, analogy, funding) into a JSON file. This script never reads the
 * venture sentence for any other purpose than one check: the card command may
 * read --sentence-file to refuse a phrase that shares a run of 4 words with it.
 * The sentence is not stored, not printed and not sent.
 *
 * Usage (every input is a file path, never text):
 *   card --sprouts FILE [--sentence-file FILE] [--home DIR]
 *        Checks the phrases (Part 8), prints exactly what would leave this
 *        machine (slot, destination, phrase), and records a pending
 *        confirmation bound to the SHA-256 of the phrase set.
 *   run  --sprouts FILE --confirm HASH [--home DIR] [--budget-ms N]
 *        Refuses with exit 3 and card_required, with no network call, unless a
 *        pending record exists whose hash equals --confirm and the hash of the
 *        phrases in FILE. The record is deleted before the first network call,
 *        so a confirmation is single use.
 *
 *   save --record FILE --sentence-file FILE [--home DIR]
 *        Checks the Seed record, checks that its id is the id of the sentence,
 *        writes it under <home>/.mindrian/pyramid-seed/briefs and prints the
 *        receipt. The sentence is read for the id only.
 *   show (--id ID | --latest) [--home DIR]
 *        Prints the record hand-off (resolveFromBrief) and the receipt.
 *   upgrade --record ID [--room DIR] [--home DIR]
 *        The Full depth. Reads the record and the room notes, writes nothing,
 *        prints the questions the Seed did not ask and the report.
 *
 * Exit codes: 0 ok, 1 usage, 2 invalid input, 3 card_required, 4 no record.
 * stdout is JSON only. stderr carries a usage line only.
 *
 * Reuse (Canon Part 7): the cells come from lib/core/pyramid-seed-cells.cjs, the
 * fan-out and the clock from lib/core/pyramid-seed-dispatcher.cjs, pyramid-seed-budget.cjs and
 * pyramid-seed-agent-contract.cjs, the phrase check from part8-split-route.cjs.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const USAGE = 'usage: pyramid-seed-run.cjs card --sprouts FILE [--sentence-file FILE] [--home DIR] | run --sprouts FILE --confirm HASH [--home DIR] [--budget-ms N] | save --record FILE --sentence-file FILE [--home DIR] | show (--id ID | --latest) [--home DIR] | upgrade --record ID [--room DIR] [--home DIR]';
const PENDING_TTL_MS = 60 * 60 * 1000;
const DEFAULT_BUDGET_MS = 45000;
const HASH_RE = /^[0-9a-f]{64}$/;
const FLAGS_WITH_VALUE = ['--sprouts', '--sentence-file', '--confirm', '--home', '--budget-ms', '--record', '--id', '--room'];
const FLAGS_BOOLEAN = ['--latest'];

function finish(obj, code, toStderr) {
  const text = toStderr ? String(obj) + '\n' : JSON.stringify(obj) + '\n';
  const stream = toStderr ? process.stderr : process.stdout;
  stream.write(text, () => process.exit(code));
}

function usage() { finish(USAGE, 1, true); }

function parseArgs(argv) {
  const cmd = argv[0];
  const flags = {};
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (FLAGS_BOOLEAN.indexOf(a) !== -1) { flags[a] = true; continue; }
    if (FLAGS_WITH_VALUE.indexOf(a) === -1 || i + 1 >= argv.length) return null;
    flags[a] = argv[i + 1];
    i += 1;
  }
  return { cmd, flags };
}

function pendingDir(home) {
  return path.join(home, '.mindrian', 'pyramid-seed', 'pending');
}

function phraseSetHash(cells, sprouts) {
  const o = {};
  cells.SLOTS.forEach((s) => {
    if (typeof sprouts[s] === 'string') o[s] = sprouts[s].trim();
  });
  return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
}

function readSprouts(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed;
  } catch (_e) {
    return undefined;
  }
}

function trimmed(cells, sprouts) {
  const o = {};
  cells.SLOTS.forEach((s) => { if (typeof sprouts[s] === 'string') o[s] = sprouts[s].trim(); });
  return o;
}

function destinationText(row) {
  return row.destination === 'web'
    ? 'web search (Tavily)'
    : 'Theo (the Mindrian Brain, generic methodology search)';
}

function writePending(home, sha) {
  const dir = pendingDir(home);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, '.tmp-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
  fs.writeFileSync(tmp, JSON.stringify({ sprouts_sha256: sha, created_at: new Date().toISOString() }), { mode: 0o600 });
  fs.renameSync(tmp, path.join(dir, sha + '.json'));
}

// True when a fresh pending record exists for the hash.
function pendingValid(home, sha) {
  try {
    const rec = JSON.parse(fs.readFileSync(path.join(pendingDir(home), sha + '.json'), 'utf8'));
    if (!rec || rec.sprouts_sha256 !== sha) return false;
    const age = Date.now() - Date.parse(rec.created_at);
    return Number.isFinite(age) && age >= 0 && age <= PENDING_TTL_MS;
  } catch (_e) {
    return false;
  }
}

function cardRequired() {
  finish({ error: 'card_required', hint: 'Run the card command, show the card to the person, then run with the confirm hash of that card.' }, 3);
}

function invalid(check) {
  finish({
    error: 'invalid_sprouts',
    reason: check.reason || 'phrases_rejected',
    rejected: check.rejected.map((r) => ({ slot: r.slot, class: r.class })),
  }, 2);
}

function loadSprouts(cells, file) {
  const parsed = file ? readSprouts(file) : undefined;
  if (parsed === undefined) return { error: { ok: false, reason: 'unreadable_file', rejected: [] } };
  return { sprouts: parsed };
}

function doCard(cells, flags, home) {
  const loaded = loadSprouts(cells, flags['--sprouts']);
  if (loaded.error) return invalid(loaded.error);
  let sentence;
  if (flags['--sentence-file']) {
    try { sentence = fs.readFileSync(flags['--sentence-file'], 'utf8'); } catch (_e) {
      return invalid({ ok: false, reason: 'unreadable_sentence_file', rejected: [] });
    }
  }
  const check = cells.checkSprouts(loaded.sprouts, { sentence });
  if (!check.ok) return invalid(check);
  const set = trimmed(cells, loaded.sprouts);
  const sha = phraseSetHash(cells, set);
  try { writePending(home, sha); } catch (_e) {
    return finish({ error: 'pending_write_failed' }, 2);
  }
  const lines = cells.CELL_TABLE.filter((row) => typeof set[row.slot] === 'string').map((row) => ({
    slot: row.slot,
    destination: destinationText(row),
    phrase: set[row.slot],
  }));
  return finish({
    card_id: sha.slice(0, 12),
    sprouts_sha256: sha,
    lines,
    missing: check.missing,
    note: 'Only these phrases leave this machine. Show this card to the person. Run with --confirm ' + sha + ' after the person agrees.',
  }, 0);
}

async function doRun(cells, flags, home) {
  const loaded = loadSprouts(cells, flags['--sprouts']);
  if (loaded.error) return invalid(loaded.error);
  const check = cells.checkSprouts(loaded.sprouts, {});
  if (!check.ok) return invalid(check);
  const set = trimmed(cells, loaded.sprouts);
  const sha = phraseSetHash(cells, set);
  const confirm = flags['--confirm'];
  if (typeof confirm !== 'string' || !HASH_RE.test(confirm) || confirm !== sha) return cardRequired();
  if (!pendingValid(home, sha)) return cardRequired();
  // Delete the record before the first network call. A confirmation is single use.
  try { fs.unlinkSync(path.join(pendingDir(home), sha + '.json')); } catch (_e) { return cardRequired(); }

  let budget = DEFAULT_BUDGET_MS;
  if (flags['--budget-ms'] !== undefined) {
    const n = Number(flags['--budget-ms']);
    if (Number.isInteger(n) && n > 0) budget = Math.min(n, DEFAULT_BUDGET_MS);
  }
  const { dispatchToArray } = require('../lib/core/pyramid-seed-dispatcher.cjs');
  const agents = cells.buildCells(set, {});
  const t0 = Date.now();
  const results = await dispatchToArray(agents, sha, { globalBudgetMs: budget });
  const out = cells.CELL_TABLE.map((row) => {
    const r = results.find((x) => x.agent_id === row.id);
    if (!r) return null;
    const p = (r.payload && typeof r.payload === 'object') ? r.payload : {};
    const entry = {
      id: row.id,
      pyramid: row.pyramid,
      status: r.status,
      duration_ms: r.duration_ms,
      summary_line: typeof p.summary_line === 'string' ? p.summary_line : '',
      excerpt: typeof p.excerpt === 'string' ? p.excerpt : '',
    };
    if (r.status !== 'ok') {
      entry.reason = typeof p.reason === 'string' ? p.reason : (r.status === 'error' ? 'cell_error' : r.status);
    } else {
      entry.source = p.source;
      entry.evidence_only = true;
      if (Array.isArray(p.titles)) entry.titles = p.titles;
      if (typeof p.count === 'number') entry.count = p.count;
    }
    return entry;
  }).filter(Boolean);
  return finish({ cells: out, elapsed_ms: Date.now() - t0 }, 0);
}

// save: validate a Seed record written by the host model, check that its id is the id of the
// sentence, and write it under <home>/.mindrian/pyramid-seed/briefs. The sentence file is read for
// the id only. It is not stored and not printed.
function doSave(flags, home) {
  const recMod = require('../lib/core/pyramid-seed-record.cjs');
  let record;
  try { record = JSON.parse(fs.readFileSync(flags['--record'], 'utf8')); } catch (_e) {
    return finish({ ok: false, error: 'unreadable_record' }, 2);
  }
  let sentence;
  try { sentence = fs.readFileSync(flags['--sentence-file'], 'utf8'); } catch (_e) {
    return finish({ ok: false, error: 'unreadable_sentence_file' }, 2);
  }
  // The host model cannot compute a hash or a clock. Fill what is absent: the id from the
  // sentence, the time, the schema name and the depth. A value that is present is kept and checked.
  if (record && typeof record === 'object' && !Array.isArray(record)) {
    if (record.id === undefined) record.id = recMod.idFor(sentence);
    if (record.created_at === undefined) record.created_at = new Date().toISOString();
    if (record.schema === undefined) record.schema = recMod.SCHEMA;
    if (record.depth === undefined) record.depth = 'seed';
  }
  const v = recMod.validateRecord(record);
  if (!v.ok) return finish({ ok: false, error: 'invalid_record', code: v.code, field: v.field }, 2);
  if (recMod.idFor(sentence) !== record.id) return finish({ ok: false, error: 'id_mismatch', code: 'id_mismatch', field: 'id' }, 2);
  const w = recMod.writeRecord(record, { home });
  if (!w.ok) return finish({ ok: false, error: w.reason || 'write_failed', code: w.code, field: w.field }, 2);
  return finish({ ok: true, id: record.id, path: w.path, receipt: recMod.renderReceipt(record) }, 0);
}

// show: resolveFromBrief output plus the receipt, for one id or the newest record.
function doShow(flags, home) {
  const recMod = require('../lib/core/pyramid-seed-record.cjs');
  const r = recMod.resolveFromBrief(flags['--latest'] ? null : flags['--id'], { home });
  if (r.action === 'no_brief_available') return finish(Object.assign({}, r), 4);
  if (r.action !== 'ignite_from_brief') return finish(Object.assign({}, r), 2);
  const content = r.brief_content || {};
  return finish(Object.assign({}, r, { receipt: typeof content.receipt === 'string' ? content.receipt : recMod.renderReceipt(content) }), 0);
}

// upgrade: the Full depth. Reads the record and the room notes. Writes nothing.
function doUpgrade(flags, home) {
  const recMod = require('../lib/core/pyramid-seed-record.cjs');
  const upMod = require('../lib/core/pyramid-seed-upgrade.cjs');
  const got = recMod.readRecord(flags['--record'], { home });
  if (!got.ok) {
    const missing = got.reason === 'not_found' || got.reason === 'invalid_id';
    return finish({ ok: false, action: 'no_brief_available', error: got.reason }, missing ? 4 : 2);
  }
  const result = upMod.upgradeSeed(got.record, { roomDir: flags['--room'] });
  if (!result.ok) return finish({ ok: false, error: result.reason || 'upgrade_failed', errors: result.errors }, 2);
  return finish({
    ok: true,
    status: result.status,
    upgraded_from: result.upgraded_from,
    additions: result.additions,
    mece_warnings: result.mece_warnings,
    restatement_warnings: result.restatement_warnings,
    uncovered: result.uncovered,
    room_evidence: result.room_evidence,
    report: upMod.renderUpgrade(result),
  }, 0);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) return usage();
  const { cmd, flags } = parsed;
  if (['card', 'run', 'save', 'show', 'upgrade'].indexOf(cmd) === -1) return usage();
  const home0 = flags['--home'] || os.homedir();
  if (cmd === 'save') {
    if (!flags['--record'] || !flags['--sentence-file']) return usage();
    return doSave(flags, home0);
  }
  if (cmd === 'show') {
    if (!flags['--id'] && !flags['--latest']) return usage();
    return doShow(flags, home0);
  }
  if (cmd === 'upgrade') {
    if (!flags['--record']) return usage();
    return doUpgrade(flags, home0);
  }
  if (!flags['--sprouts']) return usage();
  if (cmd === 'run' && !Object.prototype.hasOwnProperty.call(flags, '--confirm')) {
    // A run without a confirm value is a refusal, not a usage error: nothing left the machine.
    return cardRequired();
  }
  const cells = require('../lib/core/pyramid-seed-cells.cjs');
  const home = flags['--home'] || os.homedir();
  if (cmd === 'card') return doCard(cells, flags, home);
  return doRun(cells, flags, home);
}

main().catch(() => finish({ error: 'seed_run_failed' }, 2));
