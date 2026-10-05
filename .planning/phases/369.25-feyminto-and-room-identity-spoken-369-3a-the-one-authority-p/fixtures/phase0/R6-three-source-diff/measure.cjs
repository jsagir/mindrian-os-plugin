'use strict';
// R6: the three command sources per section, re-derived at HEAD and compared with the RESEARCH table. Read-only.
// Run from the repo root: node <this file> <outDir>
const fs = require('node:fs');
const path = require('node:path');
const ROOT = process.cwd();
const OUT = path.resolve(process.argv[2]);
const PHASE = path.join(ROOT, '.planning/phases/369.25-feyminto-and-room-identity-spoken-369-3a-the-one-authority-p');
const canon = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/section-job-canon.json'), 'utf8')).sections;
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/section-command-ledger.json'), 'utf8')).rows;
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/command-registry.json'), 'utf8'));
const regText = JSON.stringify(registry);
const LABELS = { 'Problem Definition': 'problem-definition', 'Market Analysis': 'market-analysis', 'Solution Design': 'solution-design', 'Business Model': 'business-model', 'Competitive Analysis': 'competitive-analysis', 'Team and Execution': 'team-execution', 'Legal and IP': 'legal-ip', 'Financial Model': 'financial-model', 'Opportunity Bank': 'opportunity-bank', 'Funding': 'funding', 'Strategy': 'strategy' };
const rel = fs.readFileSync(path.join(PHASE, '369.25-SECTION-COMMAND-RELEVANCE.md'), 'utf8').split('\n');
const table = {};
for (const l of rel) {
  const m = l.match(/^\| \*\*([^*]+)\*\* \| (.*?) \| /);
  if (m && LABELS[m[1]]) table[LABELS[m[1]]] = [...new Set([...m[2].matchAll(/`([a-z0-9-]+)`/g)].map((x) => x[1]))];
}
function contractCommands(slug) {
  const t = fs.readFileSync(path.join(ROOT, 'templates/room-skeleton/section-contracts', slug + '.md'), 'utf8').split('\n');
  const i = t.findIndex((l) => /^## Commands that write here/.test(l));
  const out = [];
  for (let k = i + 1; k < t.length && !/^## /.test(t[k]); k++) {
    if (/^\s*-?\s*Note:/.test(t[k]) || /^Note:/.test(t[k])) continue;
    for (const m of t[k].matchAll(/\/mos:([a-z0-9-]+)/g)) out.push(m[1]);
  }
  return [...new Set(out)];
}
// self-check that the registry test is not vacuous: a made-up name must be reported missing
const bogusMissing = !regText.includes('"zzz-not-a-command"') && !regText.includes('mos:zzz-not-a-command');
const rows = {};
for (const slug of Object.keys(LABELS).map((k) => LABELS[k])) {
  const job = canon[slug].job_id;
  const row = ledger[job + '|*|*'] || [];
  const ledgerCmds = row.map((r) => r.command.replace('/mos:', ''));
  const contract = contractCommands(slug);
  const top3 = ledgerCmds.slice(0, 3);
  const tbl = table[slug] || [];
  const all = new Set([...contract, ...ledgerCmds, ...tbl]);
  rows[slug] = {
    job, contract_commands: contract, ledger_row_commands_count: ledgerCmds.length, table_commands: tbl,
    context_s2_top3: top3, top3_in_contract: top3.filter((c) => contract.includes(c)).length + '/' + top3.length,
    table_names_not_in_contract: tbl.filter((c) => !contract.includes(c)),
    contract_only_not_in_ledger_or_table: contract.filter((c) => !ledgerCmds.includes(c) && !tbl.includes(c)),
    missing_from_command_registry: [...all].filter((c) => !regText.includes('"' + c + '"') && !regText.includes('/mos:' + c) && !regText.includes('mos:' + c)),
  };
}
// the RESEARCH table, parsed from RESEARCH.md, for the cell-by-cell comparison
const rs = fs.readFileSync(path.join(PHASE, '369.25-RESEARCH.md'), 'utf8').split('\n');
const start = rs.findIndex((l) => l.startsWith('| Section | job | contract |'));
const research = {};
for (let k = start + 2; k < rs.length && rs[k].startsWith('|'); k++) {
  const c = rs[k].split('|').map((x) => x.trim()).filter((x, i) => i > 0 && i <= 8);
  research[c[0]] = { job: c[1], contract: Number(c[2]), ledger: Number(c[3]), table: Number(c[4]), s2: c[5].split(', '), top3_in_contract: c[6], table_not_in_contract: c[7] === 'none' ? [] : c[7].split(', ') };
}
const diffs = [];
for (const [slug, r] of Object.entries(rows)) {
  const x = research[slug];
  if (!x) { diffs.push({ slug, cell: 'row', measured: 'present', research: 'absent' }); continue; }
  const norm = (v) => (Array.isArray(v) ? v.slice().sort() : v);
  const cmp = (cell, a, b) => { if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) diffs.push({ slug, cell, measured_at_head: a, research_table: b }); };
  cmp('job', r.job, x.job); cmp('contract_count', r.contract_commands.length, x.contract); cmp('ledger_row_count', r.ledger_row_commands_count, x.ledger);
  cmp('table_count', r.table_commands.length, x.table); cmp('context_s2_top3', r.context_s2_top3, x.s2); cmp('top3_in_contract', r.top3_in_contract, x.top3_in_contract);
  cmp('table_names_not_in_contract', r.table_names_not_in_contract, x.table_not_in_contract);
}
const sectionsWithNoTop3InContract = Object.keys(rows).filter((s) => rows[s].top3_in_contract.startsWith('0/'));
const res = { registry_check_not_vacuous: bogusMissing, method: 'contract = /mos: names under "## Commands that write here" minus Note: lines; ledger = data/section-command-ledger.json row <job>|*|*, job from data/section-job-canon.json; table = backticked names in column 2 of 369.25-SECTION-COMMAND-RELEVANCE.md; CONTEXT s2 top 3 = first 3 of the ledger row', ledger_built_at: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/section-command-ledger.json'), 'utf8')).built_at, sections: rows, sections_whose_context_s2_names_none_of_their_contract_commands: sectionsWithNoTop3InContract, cells_differing_from_research_table: diffs };
fs.writeFileSync(path.join(OUT, 'three-source-diff.json'), JSON.stringify(res, null, 2) + '\n');
console.log(JSON.stringify({ none_in_contract: sectionsWithNoTop3InContract, diffs, missing: Object.fromEntries(Object.entries(rows).map(([s, r]) => [s, r.missing_from_command_registry])) }, null, 1));
