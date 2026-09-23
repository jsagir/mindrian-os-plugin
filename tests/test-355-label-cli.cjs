/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 03 Task 2 (D-31, D-32, D-33). PassThrough-driven proof of
 * scripts/label-355-gold.cjs's exported run({argv, input, output, now,
 * repoRoot, direction}), plus the static blinding tripwires.
 *
 * Every 355 test calls scrubVendorKey()/installNetGuard() before requiring
 * any repo module (tests/helpers/hygiene-355.cjs), and asserts
 * attempts() === 0 as its last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PassThrough } = require('node:stream');
const { execFileSync } = require('node:child_process');

const hygiene = require('./helpers/hygiene-355.cjs');

const vendorKeyWasPresent = hygiene.scrubVendorKey();
void vendorKeyWasPresent; // recorded, never logged (Pitfall 16)
const netGuard = hygiene.installNetGuard();

const { check, summary } = hygiene.makeChecker('355-03 label-355-gold CLI');

const ROOT = path.join(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'label-355-gold.cjs');

function loadCli() {
  delete require.cache[require.resolve(SCRIPT_PATH)];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(SCRIPT_PATH);
}

function mkTmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-03-' + label + '-'));
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

function makeOutput() {
  let buf = '';
  return {
    write(s) {
      buf += s;
      return true;
    },
    get text() {
      return buf;
    },
  };
}

function stubDirection(overrides) {
  const base = {
    PHRASES_CONFIRMED: { by: 'pws-author', at: '2026-09-23', phrase_hash: 'abc123' },
    phraseHash: () => 'abc123',
  };
  return Object.assign({}, base, overrides || {});
}

async function main() {
  const cli = loadCli();

  check('exports: run is a function', typeof cli.run === 'function');
  check('exports: SETS is an object', typeof cli.SETS === 'object' && cli.SETS !== null);
  check('exports: LEGENDS is an object', typeof cli.LEGENDS === 'object' && cli.LEGENDS !== null);
  check('exports: mulberry32 is a function', typeof cli.mulberry32 === 'function');
  check('exports: SETS has all four sets', ['sentences', 'citations', 'pairings-unstamped', 'pairings-stamped'].every((k) => Object.prototype.hasOwnProperty.call(cli.SETS, k)));

  // ---------------------------------------------------------------------
  // Fixture setup: tiny item files (3 sentences, 2 citation pairs, 2 pairings)
  // ---------------------------------------------------------------------
  const workDir = mkTmpDir('fixtures');

  const sentenceItemsPath = path.join(workDir, 'sentences.items.json');
  writeJson(sentenceItemsPath, {
    items: [
      { id: 's1', sentence: 'The audit compared two datasets before recommending a change.', boundary_tag: null },
      { id: 's2', sentence: 'The report lists the fields collected during intake.', boundary_tag: 'important-neutral' },
      { id: 's3', sentence: 'What if the team tried a lighter onboarding flow.', boundary_tag: null },
    ],
  });

  const citationItemsPath = path.join(workDir, 'citations.items.json');
  writeJson(citationItemsPath, {
    items: [
      { id: 'c1', claim: 'Framework A feeds into Framework B', path: [{ from: 'Framework A', relation: 'feeds_into', to: 'Framework B' }] },
      { id: 'c2', claim: 'Framework C contradicts Framework D', path: [{ from: 'Framework C', relation: 'opposes', to: 'Framework D' }] },
    ],
  });

  const pairingItemsPath = path.join(workDir, 'pairings.items.json');
  writeJson(pairingItemsPath, {
    items: [
      { id: 'p1', room: 'alpha', a_excerpt: 'excerpt a1', b_excerpt: 'excerpt b1', direction_phrase: 'same meaning in different words' },
      { id: 'p2', room: 'beta', a_excerpt: 'excerpt a2', b_excerpt: 'excerpt b2', direction_phrase: 'same words with different meaning' },
    ],
  });

  const goodDirection = stubDirection();
  let clock = 1000;
  const now = () => {
    clock += 10;
    return clock;
  };

  // ---------------------------------------------------------------------
  // Behavior 1: start sentences, write '1' then '6', two entries recorded
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('session-sentences');
    const input = new PassThrough();
    const output = makeOutput();
    const runPromise = cli.run({
      argv: ['start', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    input.write('1\n');
    input.write('6\n');
    input.write('q\n');
    const code = await runPromise;
    check('B1: start exits 0 after q', code === 0);
    const sessionPath = path.join(sessionDir, 'labeling-session-sentences.json');
    check('B1: session file exists', fs.existsSync(sessionPath));
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    const entryKeys = Object.keys(session.entries);
    check('B1: two entries recorded', entryKeys.length === 2, entryKeys.join(','));
    check('B1: entries keyed by id, not position', entryKeys.every((k) => ['s1', 's2', 's3'].includes(k)));
    const firstEntry = session.entries[entryKeys[0]];
    check(
      'B1: entry carries label/at/ms',
      typeof firstEntry.label === 'string' && typeof firstEntry.at === 'string' && typeof firstEntry.ms === 'number',
    );
    check(
      'B1: legend shown verbatim',
      output.text.indexOf('1 analytical  2 integrative  3 descriptive  4 evaluative  5 creative  6 none   u undo   q save+quit') !== -1,
    );
  }

  // ---------------------------------------------------------------------
  // Behavior 2: session file exists and parses after every key; atomic save
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('session-atomic');
    const input = new PassThrough();
    const output = makeOutput();
    const runPromise = cli.run({
      argv: ['start', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    input.write('1\n');
    await new Promise((r) => setImmediate(r));
    const sessionPath = path.join(sessionDir, 'labeling-session-sentences.json');
    check(
      'B2: session parses after one key',
      (() => {
        try {
          JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
          return true;
        } catch (_e) {
          return false;
        }
      })(),
    );
    check('B2: no leftover .tmp sibling (atomic rename)', !fs.existsSync(sessionPath + '.tmp'));
    input.write('q\n');
    await runPromise;
  }

  // ---------------------------------------------------------------------
  // Behavior 3: 'u' undoes the most recent entry; 'q' saves and exits 0
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('session-undo');
    const input = new PassThrough();
    const output = makeOutput();
    const runPromise = cli.run({
      argv: ['start', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    input.write('1\n');
    await new Promise((r) => setImmediate(r));
    input.write('u\n');
    await new Promise((r) => setImmediate(r));
    const sessionPath = path.join(sessionDir, 'labeling-session-sentences.json');
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    check('B3: undo removes the entry', Object.keys(session.entries).length === 0);
    input.write('q\n');
    const code = await runPromise;
    check('B3: q exits 0', code === 0);
  }

  // ---------------------------------------------------------------------
  // Behavior 4: resume refuses on a changed fixture hash / phrase hash
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('session-resume-hash');
    const sessionPath = path.join(sessionDir, 'labeling-session-sentences.json');
    writeJson(sessionPath, {
      set: 'sentences',
      fixture_sha256: 'deadbeef',
      order_seed: 42,
      phrase_module_hash: null,
      started_at: new Date(1).toISOString(),
      entries: {},
    });
    const input = new PassThrough();
    const output = makeOutput();
    const code = await cli.run({
      argv: ['resume', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    check('B4: resume with a changed items file exits non-zero', code !== 0);
    check('B4: message names fixture_sha256', output.text.indexOf('fixture_sha256') !== -1, output.text);
  }
  {
    const sessionDir = mkTmpDir('session-resume-phrase');
    const sessionPath = path.join(sessionDir, 'labeling-session-citations.json');
    const correctHash = crypto.createHash('sha256').update(fs.readFileSync(citationItemsPath, 'utf8')).digest('hex');
    writeJson(sessionPath, {
      set: 'citations',
      fixture_sha256: correctHash,
      order_seed: 42,
      phrase_module_hash: 'stale-hash-value',
      started_at: new Date(1).toISOString(),
      entries: {},
    });
    const input = new PassThrough();
    const output = makeOutput();
    const code = await cli.run({
      argv: ['resume', '--set', 'citations', '--items', citationItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    check('B4: resume with a changed phrase hash exits non-zero', code !== 0);
    check('B4: message names phrase_module_hash', output.text.indexOf('phrase_module_hash') !== -1, output.text);
  }

  // ---------------------------------------------------------------------
  // Behavior 5: citations / pairings refuse without a confirmed phrase hash
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('session-nophrase-1');
    const input = new PassThrough();
    const output = makeOutput();
    const code = await cli.run({
      argv: ['start', '--set', 'citations', '--items', citationItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: stubDirection({ PHRASES_CONFIRMED: undefined }),
    });
    check('B5: missing PHRASES_CONFIRMED refuses citations start', code !== 0);
  }
  {
    const sessionDir = mkTmpDir('session-nophrase-2');
    const input = new PassThrough();
    const output = makeOutput();
    const code = await cli.run({
      argv: ['start', '--set', 'pairings-unstamped', '--items', pairingItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: stubDirection({ phraseHash: () => 'a-different-hash' }),
    });
    check('B5: stale phrase_hash refuses pairings start', code !== 0);
  }
  {
    const sessionDir = mkTmpDir('session-sentences-nogate');
    const input = new PassThrough();
    const output = makeOutput();
    const runPromise = cli.run({
      argv: ['start', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: stubDirection({ PHRASES_CONFIRMED: undefined }),
    });
    input.write('q\n');
    const code = await runPromise;
    check('B5: sentences never gated by PHRASES_CONFIRMED', code === 0);
  }

  // ---------------------------------------------------------------------
  // Behavior 6: seeded shuffle (mulberry32) is deterministic; seed stored
  // ---------------------------------------------------------------------
  {
    const r1 = cli.mulberry32(7);
    const r2 = cli.mulberry32(7);
    const seq1 = [r1(), r1(), r1()];
    const seq2 = [r2(), r2(), r2()];
    check('B6: same seed gives the same sequence', JSON.stringify(seq1) === JSON.stringify(seq2));

    const sessionDir = mkTmpDir('session-seed');
    const input = new PassThrough();
    const output = makeOutput();
    const runPromise = cli.run({
      argv: ['start', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir, '--seed', '99'],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    input.write('q\n');
    await runPromise;
    const session = JSON.parse(fs.readFileSync(path.join(sessionDir, 'labeling-session-sentences.json'), 'utf8'));
    check('B6: order_seed stored on the session', session.order_seed === 99, String(session.order_seed));
  }

  // ---------------------------------------------------------------------
  // Behavior 7: status prints labeled/total counts, nothing about labels
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('session-status');
    const output = makeOutput();
    const code = await cli.run({
      argv: ['status', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input: new PassThrough(),
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    check('B7: status exits 0', code === 0);
    check('B7: status prints 0/3', /\b0\/3\b/.test(output.text), output.text);
    check('B7: status never prints a sentence', output.text.indexOf('audit compared two datasets') === -1);
  }

  // ---------------------------------------------------------------------
  // Behavior 8: emit only when every item is labeled
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('session-emit');
    const input = new PassThrough();
    const output = makeOutput();
    const runPromise = cli.run({
      argv: ['start', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    input.write('1\n');
    input.write('q\n');
    await runPromise;

    const outDir1 = mkTmpDir('out-incomplete');
    const outPath1 = path.join(outDir1, 'gold-incomplete.json');
    const emitOut1 = makeOutput();
    const emitCode1 = await cli.run({
      argv: ['emit', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir, '--out', outPath1],
      input: new PassThrough(),
      output: emitOut1,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    check('B8: emit refuses when incomplete', emitCode1 !== 0);
    check('B8: incomplete gold file never written', !fs.existsSync(outPath1));

    const input2 = new PassThrough();
    const output2 = makeOutput();
    const runPromise2 = cli.run({
      argv: ['resume', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input: input2,
      output: output2,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    input2.write('2\n');
    input2.write('3\n');
    input2.write('q\n');
    await runPromise2;

    const outDir2 = mkTmpDir('out-complete');
    const outPath2 = path.join(outDir2, 'gold-complete.json');
    const emitOut2 = makeOutput();
    const emitCode2 = await cli.run({
      argv: ['emit', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir, '--out', outPath2],
      input: new PassThrough(),
      output: emitOut2,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    check('B8: emit succeeds when complete', emitCode2 === 0, emitOut2.text);
    const gold = JSON.parse(fs.readFileSync(outPath2, 'utf8'));
    check(
      'B8: gold carries _labeling_note/labeler/fixture_sha256/labeled_at',
      typeof gold._labeling_note === 'string' && gold.labeler === 'navigator' && typeof gold.fixture_sha256 === 'string' && typeof gold.labeled_at === 'string',
    );
    check(
      'B8: gold items shape is {id, sentence, gold}',
      Array.isArray(gold.items) && gold.items.every((it) => typeof it.id === 'string' && typeof it.sentence === 'string' && typeof it.gold === 'string'),
    );
    check('B8: gold item count matches the item set', gold.items.length === 3, String(gold.items.length));
  }

  // ---------------------------------------------------------------------
  // Behavior 9: no boundary_tag leakage; unstamped pairing carries no stamp text
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('session-boundary');
    const input = new PassThrough();
    const output = makeOutput();
    const runPromise = cli.run({
      argv: ['start', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    input.write('1\n');
    input.write('2\n');
    input.write('3\n');
    input.write('q\n');
    await runPromise;
    check('B9: boundary_tag value never printed', output.text.indexOf('important-neutral') === -1, output.text);
  }
  {
    const sessionDir = mkTmpDir('session-pairing-unstamped');
    const input = new PassThrough();
    const output = makeOutput();
    const runPromise = cli.run({
      argv: ['start', '--set', 'pairings-unstamped', '--items', pairingItemsPath, '--session-dir', sessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    input.write('y\n');
    input.write('y\n');
    input.write('n\n');
    input.write('n\n');
    input.write('n\n');
    input.write('y\n');
    input.write('q\n');
    const code = await runPromise;
    check('B9: pairings-unstamped session exits 0', code === 0);
    const forbidden = ['strong', 'indirect', 'unverified'];
    const lowered = output.text.toLowerCase();
    const hit = forbidden.filter((w) => lowered.indexOf(w) !== -1);
    check('B9: unstamped pairing display carries no stamp substrings', hit.length === 0, hit.join(','));
  }

  // ---------------------------------------------------------------------
  // Behavior 10: --out / --session-dir path escape refused
  // ---------------------------------------------------------------------
  {
    const input = new PassThrough();
    const output = makeOutput();
    const outsidePath = path.join(os.tmpdir(), '..', 'label-355-escape-test-' + process.pid + '.json');
    const code = await cli.run({
      argv: ['emit', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', mkTmpDir('guard-out'), '--out', outsidePath],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    check('B10: --out outside the allowed roots refuses', code !== 0);
    check('B10: escaped output path never written', !fs.existsSync(outsidePath));
  }
  {
    const input = new PassThrough();
    const output = makeOutput();
    const outsideSessionDir = path.join(ROOT, 'lib');
    const code = await cli.run({
      argv: ['start', '--set', 'sentences', '--items', sentenceItemsPath, '--session-dir', outsideSessionDir],
      input,
      output,
      now,
      repoRoot: ROOT,
      direction: goodDirection,
    });
    check('B10: --session-dir outside the allowed roots refuses', code !== 0);
    check('B10: no session file written outside the allowed roots', !fs.existsSync(path.join(outsideSessionDir, 'labeling-session-sentences.json')));
  }

  // ---------------------------------------------------------------------
  // Behavior 11 / static tripwire: no banned requires, non-comment lines only
  // ---------------------------------------------------------------------
  {
    const lines = hygiene.nonCommentLines(SCRIPT_PATH);
    const joined = lines.join('\n');
    const banned = [
      'hsi-spectral',
      'verification-stamp',
      'jev-devtime-client',
      'jev-question-ceilings',
      'jev-response-schema',
      'measure-hsi',
      'calibrate-citation',
      'judge-355',
    ];
    const hit = banned.filter((b) => joined.indexOf(b) !== -1);
    check('B11: script never references any banned module (non-comment lines)', hit.length === 0, hit.join(','));
  }
  {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    check('acceptance: renameSync present (atomic save)', (src.match(/renameSync/g) || []).length >= 1);
    check('acceptance: setRawMode(false) present (Pitfall 12 restore)', src.indexOf('setRawMode(false)') !== -1);
  }

  // ---------------------------------------------------------------------
  // Acceptance: the real CLI's status subcommand, before any labeling
  // ---------------------------------------------------------------------
  {
    const sessionDir = mkTmpDir('real-cli-status');
    let stdout = '';
    let realCliOk = true;
    try {
      stdout = execFileSync(process.execPath, [SCRIPT_PATH, 'status', '--set', 'sentences', '--session-dir', sessionDir], { encoding: 'utf8' });
    } catch (e) {
      realCliOk = false;
      stdout = (e && e.stdout) || String(e);
    }
    check('acceptance: real CLI status exits 0', realCliOk);
    check('acceptance: real CLI status prints a 0/<N> count', /\b0\/\d+\b/.test(stdout), stdout);
  }

  check('hygiene: zero network attempts across this whole run', netGuard.attempts() === 0);
  netGuard.restore();

  const code = summary();
  process.exitCode = code;
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err && err.stack || err);
  process.exitCode = 1;
});
