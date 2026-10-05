'use strict';
/*
 * lib/core/feyminto/command-sources.cjs -- the three LOCAL command sources per core section, side by side.
 *
 * Plan 369.25-06 (TFACE-05). CONTEXT Specific Ideas: FeyMinto's Theo face shows all three per nest with their
 * provenance, never one merged list. The three sources, and why they disagree:
 *   1. contract:         the `/mos:` names under "## Commands that write here" in
 *                        templates/room-skeleton/section-contracts/<section>.md, excluding the "Note:" line. Authored.
 *   2. ledger:           data/section-command-ledger.json row `<job>|*|*`, the job taken from
 *                        data/section-job-canon.json. Jev-scored and rebuilt before every cut, so it MOVES. The first
 *                        three of this row are what the nest's generated CONTEXT.md section 2 names.
 *   3. navigator_table:  data/section-command-relevance.json, the navigator-supplied relevance table (a LOCAL prior,
 *                        Canon Part 8: it never leaves for Theo). existing / supporting / additional_fit.
 *
 * Disagreement lists (stated once, here, because "only" is relative):
 *   agreement     names present in two or more of the three sources
 *   contract_only in the contract and NOT in the navigator table (authored text versus the navigator's judgment)
 *   table_only    in the navigator table and NOT in the contract
 *   ledger_only   in the ledger row and in neither the contract nor the navigator table
 *
 * Pure local file reads. No network, no Brain, no write.
 */
const fs = require('node:fs');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..', '..');
const SOURCE_KINDS = Object.freeze(['contract', 'ledger', 'navigator_table']);

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, rel), 'utf8'));
}

function assertCoreSection(section) {
  const { CORE_SECTIONS } = require('../section-registry.cjs');
  if (typeof section !== 'string' || !Object.prototype.hasOwnProperty.call(CORE_SECTIONS, section)) {
    throw new Error('command-sources: unknown core section ' + JSON.stringify(section));
  }
}

function contractLines(section) {
  const file = path.join(PLUGIN_ROOT, 'templates', 'room-skeleton', 'section-contracts', section + '.md');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const start = lines.findIndex((l) => /^## Commands that write here/.test(l));
  if (start < 0) return [];
  const out = [];
  for (let k = start + 1; k < lines.length && !/^## /.test(lines[k]); k++) {
    if (/^\s*-?\s*Note:/.test(lines[k])) continue;
    out.push(lines[k]);
  }
  return out;
}

function namesIn(lines) {
  const out = [];
  for (const l of lines) for (const m of l.matchAll(/\/mos:([a-z0-9-]+)/g)) out.push(m[1]);
  return [...new Set(out)];
}

// The contract's "Ground truth" line: the commands whose own `produces` path names this section. A line that reads
// "none ..." means the contract records NO dedicated command (legal-ip, financial-model), even when the line goes on to
// mention a wildcard command in prose. has_line is false when the contract has no such line (then nothing is claimed).
function contractGroundTruth(section) {
  assertCoreSection(section);
  const line = contractLines(section).find((l) => /Ground truth/.test(l));
  if (!line) return { has_line: false, none: false, names: [] };
  const m = line.match(/Ground truth \([^)]*\):\s*(.*)$/);
  const rest = m ? m[1] : '';
  const none = /^none\b/i.test(rest);
  return { has_line: true, none, names: none ? [] : namesIn([rest]) };
}

function sourcesForSection(section) {
  assertCoreSection(section);
  const canon = readJson('data/section-job-canon.json').sections[section];
  const jobId = canon && canon.job_id;
  const ledgerFile = readJson('data/section-command-ledger.json');
  const rel = readJson('data/section-command-relevance.json');
  const tableRow = rel.sections[section] || { existing: [], supporting: [], additional_fit: [] };

  const contractNames = namesIn(contractLines(section));
  const row = (ledgerFile.rows && ledgerFile.rows[jobId + '|*|*']) || [];
  const ledgerNames = row.map((r) => String(r.command).replace(/^\/mos:/, ''));
  const tableNames = [...new Set([...tableRow.existing, ...tableRow.supporting, ...tableRow.additional_fit])];

  const all = [...new Set([...contractNames, ...ledgerNames, ...tableNames])];
  const inContract = new Set(contractNames);
  const inLedger = new Set(ledgerNames);
  const inTable = new Set(tableNames);
  const agreement = all.filter((n) => (inContract.has(n) ? 1 : 0) + (inLedger.has(n) ? 1 : 0) + (inTable.has(n) ? 1 : 0) >= 2);

  return {
    section,
    job_id: jobId,
    contract: {
      names: contractNames,
      provenance: { kind: 'contract', path: 'templates/room-skeleton/section-contracts/' + section + '.md', stamp: 'authored' },
    },
    ledger: {
      names: ledgerNames,
      provenance: { kind: 'ledger', path: 'data/section-command-ledger.json', stamp: ledgerFile.plugin_version + ' ' + ledgerFile.build_mode },
    },
    navigator_table: {
      existing: tableRow.existing.slice(),
      supporting: tableRow.supporting.slice(),
      additional_fit: tableRow.additional_fit.slice(),
      names: tableNames,
      provenance: { kind: 'navigator_table', path: 'data/section-command-relevance.json', stamp: 'navigator-supplied 2026-10-06' },
    },
    context_section2_top3: ledgerNames.slice(0, 3),
    agreement,
    contract_only: contractNames.filter((n) => !inTable.has(n)),
    ledger_only: ledgerNames.filter((n) => !inContract.has(n) && !inTable.has(n)),
    table_only: tableNames.filter((n) => !inContract.has(n)),
  };
}

module.exports = { SOURCE_KINDS, sourcesForSection, contractGroundTruth };
