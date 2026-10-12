'use strict';
// Corpus for the part8 room-lexicon false-positive debug session.
// Positives: 6 named methodology questions + 20 derived from data/framework-names.json (stride 20).
// Negatives: 10 strings that MUST be refused. All negatives are synthetic (made-up names, ids, keys).
// This file holds NO room text.
const fs = require('node:fs');
const path = require('node:path');

const REPO = '/home/jsagi/dev/MindrianOS-Plugin';

const NAMED = [
  "which framework tests a business model's riskiest assumption first",
  'how does the lean canvas relate to the value proposition canvas',
  'what is the difference between an ill-defined and a wicked problem',
  'which framework comes after jobs to be done in the PWS sequence',
  'explain dominant design',
  'what does customer segment mean in the lean canvas',
];

const TEMPLATES = [
  function (x) { return 'explain ' + x; },
  function (x) { return 'when should I use ' + x; },
  function (x) { return 'what is ' + x + ' and how does it work'; },
  function (x) { return 'which problem type fits ' + x; },
];

function derived() {
  const doc = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'framework-names.json'), 'utf8'));
  const names = doc.framework_names;
  const out = [];
  for (let k = 0; k < 20; k += 1) {
    const idx = 10 + k * 20;
    const name = names[idx];
    out.push({ idx: idx, framework: name, q: TEMPLATES[k % TEMPLATES.length](name) });
  }
  return out;
}

const POSITIVES = NAMED.map(function (q, i) { return { id: 'N' + (i + 1), kind: 'named', q: q }; })
  .concat(derived().map(function (d, i) { return { id: 'D' + (i + 1), kind: 'derived', q: d.q, framework: d.framework, idx: d.idx }; }));

// 10 strings that MUST be refused. Synthetic data only.
const NEGATIVES = [
  { id: 'X1', what: 'made-up person name plus revenue figure', q: 'Orla Venn said her company reached $4.2M revenue last quarter, which framework fits?' },
  { id: 'X2', what: 'our startup pivoted to', q: 'our startup pivoted to selling to hospitals, which framework fits that move' },
  { id: 'X3', what: 'email address', q: 'which framework should orla.venn@nimbusrobotics.example use for pricing' },
  { id: 'X4', what: 'API key shape (uppercase digit run)', q: 'explain the lean canvas AKIAIOSFODNN7EXAMPLE framework' },
  { id: 'X5', what: 'sentence copied from a room file but with proper nouns', q: 'Fennick Robotics plans to sell the Thessaly gripper to Harbor Quill Partners after the Tuesday pilot' },
  { id: 'X6', what: 'room artifact id', q: 'what framework applies to artifact MOS2026X7 in the pricing section' },
  { id: 'X7', what: 'confidential sentence', q: 'this is confidential: which framework tests the riskiest assumption' },
  { id: 'X8', what: 'money figure', q: 'which framework helps when the budget is $750K' },
  { id: 'X9', what: 'date plus a company name', q: 'on 14 March 2026 Fennick Robotics Ltd signed the term sheet, which framework fits' },
  { id: 'X10', what: 'possessive private phrase', q: 'which framework fits my customers and my pricing' },
];

// Baseline GAP probes: first-draft negatives the CURRENT guard allows (with no room bound too). Recorded, not part of the 10.
const GAPS = [
  { id: 'GAP1', what: 'API key shape, mixed case after a vendor prefix', q: 'explain the lean canvas sk-ant-api03-AbCdEf0123456789AbCdEf0123456789 framework' },
  { id: 'GAP2', what: 'spelled-out money figure', q: 'which framework helps when the budget is 750000 dollars' },
];
module.exports = { POSITIVES, NEGATIVES, GAPS, NAMED, derived };

if (require.main === module) {
  process.stdout.write(JSON.stringify({ positives: POSITIVES, negatives: NEGATIVES }, null, 2) + '\n');
}
