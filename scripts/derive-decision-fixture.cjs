#!/usr/bin/env node
'use strict';
// Phase 399-03 (I-05, F6, D-03): derive the labels-only recorded fixture of the job-to-command yes/no run.
// Usage: node scripts/derive-decision-fixture.cjs --source <recorded run json> --out <fixture path>
// Zero network. Keeps only job, command and p (rounded to 3 decimals) from the source pairs.
// Nothing else crosses: no job summary, no label, no primary flag, no token count.
const fs = require('node:fs');
const path = require('node:path');

function usage(code) {
  const out = code === 0 ? console.log : console.error;
  out('Usage: node scripts/derive-decision-fixture.cjs --source <recorded run json> --out <fixture path>');
  process.exit(code);
}

const HEADER = {
  schema: 'mos.decision-recorded/1',
  provider: 'gemini',
  model: 'gemini-decision-1',
  question_type: 'yes_no',
  question_template: 'serves_job_v1',
  recorded_at: '2026-11-24',
  conditioned_on: { definition_level: null, last_command: null },
};

function derive(source) {
  if (!source || !Array.isArray(source.pairs)) throw new Error('source has no pairs array');
  const pairs = source.pairs.map((x, i) => {
    if (typeof x.job !== 'string' || typeof x.command !== 'string' || typeof x.p !== 'number') {
      throw new Error('pair ' + i + ' lacks job, command or numeric p');
    }
    if (x.p < 0 || x.p > 1) throw new Error('pair ' + i + ' p out of range');
    return { job: x.job, command: x.command, p: Math.round(x.p * 1000) / 1000 };
  });
  pairs.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : a.command < b.command ? -1 : a.command > b.command ? 1 : 0));
  return Object.assign({}, HEADER, { pairs });
}

function main(argv) {
  let source = null;
  let out = null;
  for (let i = 0; i < argv.length; i += 1) {
    switch (argv[i]) {
      case '--source':
        source = argv[++i];
        break;
      case '--out':
        out = argv[++i];
        break;
      case '--help':
      case '-h':
        usage(0);
        break;
      default:
        console.error('unknown argument: ' + argv[i]);
        usage(2);
    }
  }
  if (!source || !out) usage(2);
  const fixture = derive(JSON.parse(fs.readFileSync(path.resolve(source), 'utf8')));
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(path.resolve(out), JSON.stringify(fixture, null, 1) + '\n');
  console.log('wrote ' + fixture.pairs.length + ' pairs');
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { derive, HEADER };
