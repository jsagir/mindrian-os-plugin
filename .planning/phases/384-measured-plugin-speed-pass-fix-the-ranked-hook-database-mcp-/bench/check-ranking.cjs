'use strict';
// check-ranking.cjs (plan 384-09). Checks 384-RANKING.md against the rules RK1 to RK5.
// Node built-ins only.
// Usage: node check-ranking.cjs <ranking file>      exit 0 only when every rule holds
//        node check-ranking.cjs --self-test         good samples pass, every bad sample fails
const fs = require('fs');
const os = require('os');
const path = require('path');

const HEADINGS = [
  '## How this was measured',
  '## Verdict rule',
  '## Felt path',
  '## Findings',
  '## Operator path',
  '## The five',
  '## Owner questions',
  '## Plans after this one: NOT YET PLANNED',
];

const COLUMNS = [
  'id',
  'PRD claim',
  'measured',
  'median',
  'p95',
  'n',
  'spread percent',
  'basis',
  'cost per occurrence',
  'occurrences per session',
  'cost per session',
  'share of felt path',
  'verdict',
  'meets floor',
  'files',
];

const VERDICTS = ['CONFIRMED', 'REFUTED', 'NOT MEASURABLE'];
const REQUIRED_IDS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q5b', 'C-A', 'C-B', 'C-C', 'C-D', 'C-E'];
const FIXTURE_LABEL = ' (spread from fixture)';
const DASH_RE = new RegExp(String.fromCharCode(8211, 124, 8212));
const GAIN_RE = /\b(faster|saves|gains?|speedups?)\b/i;
const CITE_RE = /measurements\/[A-Za-z0-9._-]+\.(?:json|md)/g;
const COPY_ONLY_RE = /^measurements\/(?:script-timings-copy|mcp-timings-copy)[A-Za-z0-9._-]*\.json$/;

function sectionOf(text, heading) {
  const i = text.indexOf(heading);
  if (i < 0) return null;
  const rest = text.slice(i + heading.length);
  const j = rest.search(/\n## /);
  return j < 0 ? rest : rest.slice(0, j);
}

function splitRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  const parts = t.split('|');
  parts.shift();
  if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
  return parts.map((c) => c.trim());
}

function nCellOk(cell, verdict) {
  if (cell === 'n/a') return verdict === 'NOT MEASURABLE';
  const parts = cell.split(' x ');
  if (!parts.length) return false;
  for (const p of parts) {
    if (/^count \d+$/.test(p)) continue;
    if (/^\d+$/.test(p) && Number(p) >= 7) continue;
    return false;
  }
  return true;
}

function checkRanking(text, phaseDir) {
  const errors = [];
  const err = (m) => errors.push(m);

  for (const h of HEADINGS) if (!text.includes(h)) err('missing heading: ' + h);
  if (!text.includes('What was not measured')) err('missing text: What was not measured');

  // RK4: paths, room folder name, dashes, ids.
  if (/\/home\//.test(text)) err('text holds a home path');
  if (/\/mnt\/c\//.test(text)) err('text holds a mounted-drive path');
  if (text.includes('Mindrian' + 'Rooms')) err('text holds the room folder name');
  if (text.includes('/' + 'tmp')) err('text holds a temp path');
  if (DASH_RE.test(text)) err('text holds a banned dash character');
  for (const id of REQUIRED_IDS) {
    const re = new RegExp('(^|[^A-Za-z0-9])' + id.replace(/[-]/g, '\\-') + '(?![A-Za-z0-9])');
    if (!re.test(text)) err('missing owner question id: ' + id);
  }

  // Frequency basis.
  let assumed = false;
  try {
    const f = JSON.parse(fs.readFileSync(path.join(phaseDir, 'measurements', 'frequency.json'), 'utf8'));
    assumed = f.basis === 'ASSUMED model';
  } catch (e) {
    err('measurements/frequency.json missing or unreadable');
  }

  // Findings table.
  const sec = sectionOf(text, '## Findings');
  const claimCells = [];
  if (sec === null) {
    err('no Findings section');
  } else {
    const lines = sec.split('\n');
    let headerIdx = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const cells = splitRow(lines[i]);
      if (cells && cells[0].toLowerCase() === 'id') {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx < 0) {
      err('no header row in the Findings table');
    } else {
      const header = splitRow(lines[headerIdx]);
      const same = header.length === COLUMNS.length && COLUMNS.every((c, k) => header[k].toLowerCase() === c.toLowerCase());
      if (!same) err('header row does not name the 15 columns in order');
      const seen = {};
      for (let i = headerIdx + 1; i < lines.length; i += 1) {
        const cells = splitRow(lines[i]);
        if (!cells) continue;
        if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;
        const id = cells[0];
        if (!/^S(\d+)(-[a-z0-9]+)?$/.test(id)) continue;
        seen[id] = true;
        const where = 'row ' + id + ': ';
        if (cells.length !== COLUMNS.length) {
          err(where + 'has ' + cells.length + ' cells, needs ' + COLUMNS.length);
          continue;
        }
        const get = (name) => cells[COLUMNS.findIndex((c) => c.toLowerCase() === name.toLowerCase())];
        claimCells.push(get('PRD claim'));
        const verdict = get('verdict');
        if (!VERDICTS.includes(verdict)) err(where + 'verdict is not exactly one of CONFIRMED, REFUTED, NOT MEASURABLE');
        const verdictOk = VERDICTS.includes(verdict) ? verdict : 'x';
        if (!nCellOk(get('n'), verdictOk)) err(where + 'n cell is not an integer of 7 or more, a count, or a product of them');
        const spread = get('spread percent');
        const spreadBare = spread.endsWith(FIXTURE_LABEL) ? spread.slice(0, -FIXTURE_LABEL.length) : spread;
        if (spread === 'n/a') {
          if (verdictOk !== 'NOT MEASURABLE') err(where + 'spread is n/a but the verdict is not NOT MEASURABLE');
        } else if (!/^\d+(\.\d+)?$/.test(spreadBare)) {
          err(where + 'spread cell is not a number');
        }
        const basis = get('basis');
        if (basis !== 'DIRECT' && basis !== 'DERIVED') err(where + 'basis is not DIRECT or DERIVED');
        if (get('meets floor') !== 'pending Q5b') err(where + 'meets floor is not exactly pending Q5b');
        const files = get('files');
        const cites = files.match(CITE_RE) || [];
        const bare = (files.match(/measurements\//g) || []).length;
        if (!cites.length) err(where + 'files cell has no citation');
        if (bare !== cites.length) err(where + 'files cell has a bare measurements/ or a malformed citation');
        for (const c of cites) {
          if (!fs.existsSync(path.join(phaseDir, c))) err(where + 'cited file does not exist: ' + c);
        }
        if (cites.length && cites.every((c) => COPY_ONLY_RE.test(c)) && !spread.endsWith(FIXTURE_LABEL)) {
          err(where + 'copy row rests on one set of timings and lacks the label (spread from fixture)');
        }
        if (assumed) {
          const occ = get('occurrences per session');
          if (occ !== 'n/a' && !occ.includes('ASSUMED')) err(where + 'occurrences cell lacks ASSUMED while the frequency basis is ASSUMED');
        }
      }
      for (let k = 1; k <= 10; k += 1) if (!seen['S' + k]) err('missing primary row S' + k);
    }
  }

  // The five section when the frequency is assumed.
  if (assumed) {
    const five = sectionOf(text, '## The five');
    if (five === null || !five.includes('rests on an assumed frequency')) {
      err('The five does not say: rests on an assumed frequency');
    }
  }

  // RK3: gain words outside quotes and outside the PRD claim cells.
  let scan = text;
  for (const c of claimCells) if (c) scan = scan.split(c).join(' ');
  scan = scan.replace(/"[^"\n]*"/g, ' ');
  const m = scan.match(GAIN_RE);
  if (m) err('gain word outside a quoted PRD claim: ' + m[0]);

  return errors;
}

// ---------------------------------------------------------------- self-test

function mkRow(id, o) {
  const r = Object.assign(
    {
      claim: '"claim text"',
      measured: 'a cost',
      median: '10',
      p95: '12',
      n: '7',
      spread: '3.0',
      basis: 'DIRECT',
      per: '10 ms',
      occ: '1',
      sess: '10 ms',
      share: '1 percent',
      verdict: 'CONFIRMED',
      floor: 'pending Q5b',
      files: 'measurements/ok.json',
    },
    o || {}
  );
  return (
    '| ' +
    [id, r.claim, r.measured, r.median, r.p95, r.n, r.spread, r.basis, r.per, r.occ, r.sess, r.share, r.verdict, r.floor, r.files].join(' | ') +
    ' |'
  );
}

function goodText(o) {
  const opt = Object.assign({ extraRow: null, rowOverride: null, five: 'The list rests on an assumed frequency.', sentence: '' }, o || {});
  const rows = [];
  for (let k = 1; k <= 10; k += 1) {
    const id = 'S' + k;
    rows.push(mkRow(id, opt.rowOverride && opt.rowOverride.id === id ? opt.rowOverride.o : { occ: 'ASSUMED 1' }));
  }
  rows.push(opt.extraRow || mkRow('S5-local', { files: 'measurements/mcp-timings-copy-local.json', spread: '5.5' + FIXTURE_LABEL, occ: 'ASSUMED 30' }));
  return [
    '# Ranking',
    '## How this was measured',
    'text. What was not measured: network.',
    '## Verdict rule',
    'rule text. The PRD wrote "this change saves time" and that is a quoted claim.',
    '## Felt path',
    'text',
    '## Findings',
    '| ' + COLUMNS.join(' | ') + ' |',
    '|' + COLUMNS.map(() => '---').join('|') + '|',
    rows.join('\n'),
    opt.sentence,
    '## Operator path',
    'text',
    '## The five',
    opt.five,
    '## Owner questions',
    'Q1 Q2 Q3 Q4 Q5 Q5b C-A C-B C-C C-D C-E',
    '## Plans after this one: NOT YET PLANNED',
    'text',
    '',
  ].join('\n');
}

function selfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-rank-'));
  const mdir = path.join(dir, 'measurements');
  fs.mkdirSync(mdir);
  fs.writeFileSync(path.join(mdir, 'ok.json'), '{}');
  fs.writeFileSync(path.join(mdir, 'mcp-timings-copy-local.json'), '{}');
  const freq = (basis) => fs.writeFileSync(path.join(mdir, 'frequency.json'), JSON.stringify({ basis }));
  let failed = 0;
  const expect = (name, wantOk, text, basis) => {
    freq(basis || 'ASSUMED model');
    const errs = checkRanking(text, dir);
    const ok = wantOk ? errs.length === 0 : errs.length > 0;
    if (!ok) {
      failed += 1;
      console.log('FAIL ' + name + (errs.length ? ' : ' + errs.slice(0, 3).join(' ; ') : ' : no error found'));
    } else {
      console.log('ok   ' + name);
    }
  };

  // Good samples.
  expect('good: full ranking, ASSUMED basis', true, goodText());
  expect('good: measured basis needs no ASSUMED cell', true, goodText({ five: 'No assumed frequency.' }).split('ASSUMED ').join(''), 'measured from 5 session files');
  expect('good: quoted PRD claim with the word saves', true, goodText({ rowOverride: { id: 'S2', o: { occ: 'ASSUMED 1', claim: '"the fix saves a second"' } } }));
  expect('good: copy row with the label', true, goodText());
  expect('good: n is a count and a product', true, goodText({ rowOverride: { id: 'S1', o: { occ: 'ASSUMED 1', n: 'count 3 x 15' } } }));
  expect('good: NOT MEASURABLE row with n/a n and spread', true, goodText({ rowOverride: { id: 'S8', o: { occ: 'n/a', n: 'n/a', spread: 'n/a', verdict: 'NOT MEASURABLE' } } }));

  // Bad samples.
  expect('bad: two verdicts', false, goodText({ rowOverride: { id: 'S3', o: { occ: 'ASSUMED 1', verdict: 'CONFIRMED REFUTED' } } }));
  expect('bad: n = 3 and no count', false, goodText({ rowOverride: { id: 'S3', o: { occ: 'ASSUMED 1', n: '3' } } }));
  expect('bad: basis is neither DIRECT nor DERIVED', false, goodText({ rowOverride: { id: 'S3', o: { occ: 'ASSUMED 1', basis: 'GUESSED' } } }));
  expect('bad: empty meets floor cell', false, goodText({ rowOverride: { id: 'S3', o: { occ: 'ASSUMED 1', floor: '' } } }));
  expect('bad: files cell with a bare measurements/', false, goodText({ rowOverride: { id: 'S3', o: { occ: 'ASSUMED 1', files: 'measurements/' } } }));
  expect('bad: files cell cites a made-up file', false, goodText({ rowOverride: { id: 'S3', o: { occ: 'ASSUMED 1', files: 'measurements/made-up.json' } } }));
  expect(
    'bad: copy row lacks the label',
    false,
    goodText({ extraRow: mkRow('S5-local', { files: 'measurements/mcp-timings-copy-local.json', spread: '5.5', occ: 'ASSUMED 30' }) })
  );
  expect('bad: spread holds text', false, goodText({ rowOverride: { id: 'S3', o: { occ: 'ASSUMED 1', spread: 'small' } } }));
  expect('bad: ASSUMED basis with an occurrences cell lacking ASSUMED', false, goodText({ rowOverride: { id: 'S3', o: { occ: '30' } } }));
  expect('bad: ASSUMED basis without the five-section words', false, goodText({ five: 'The list is plain.' }));
  expect('bad: the word faster outside quotes', false, goodText({ sentence: 'This path is faster than the other.' }));
  expect('bad: n/a spread on a confirmed row', false, goodText({ rowOverride: { id: 'S3', o: { occ: 'ASSUMED 1', spread: 'n/a' } } }));
  expect('bad: a home path in the text', false, goodText({ sentence: 'see /' + 'home/x/y' }));
  expect('bad: a banned dash in the text', false, goodText({ sentence: 'a ' + String.fromCharCode(8212) + ' b' }));
  expect('bad: missing owner question id C-E', false, goodText().replace('C-E', 'C-X'));
  expect('bad: missing primary row S10', false, goodText().split('\n').filter((l) => !l.startsWith('| S10 |')).join('\n'));
  expect('bad: missing heading', false, goodText().replace('## Operator path', '## Other path'));

  fs.rmSync(dir, { recursive: true, force: true });
  if (failed === 0) {
    console.log('check-ranking self-test: ALL PASS');
    return 0;
  }
  console.log('check-ranking self-test: ' + failed + ' FAILED');
  return 1;
}

function main(argv) {
  if (argv[0] === '--self-test') return selfTest();
  if (!argv[0]) {
    process.stderr.write('usage: check-ranking.cjs <ranking file> | --self-test\n');
    return 2;
  }
  const file = path.resolve(argv[0]);
  const text = fs.readFileSync(file, 'utf8');
  const errs = checkRanking(text, path.dirname(file));
  if (errs.length) {
    for (const e of errs) console.log('FAIL ' + e);
    console.log('check-ranking: ' + errs.length + ' problem(s)');
    return 1;
  }
  console.log('check-ranking: OK');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { checkRanking };
