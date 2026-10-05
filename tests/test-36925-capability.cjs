#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 06 (TFACE-04, TFACE-05): FeyMinto's local capability marker and the three local command sources.
 *
 * WHY THIS TEST EXISTS. SEED-122 ruling 5: a recommendation is a handle, not a capability. FeyMinto may only say
 * "runnable here" when this install can run it, and it must show where each command suggestion came from (the
 * section contract, the ledger row, the navigator table) without merging them. Every expected value below is
 * derived INDEPENDENTLY at test time from the files on disk (registry, router source, ledger, contracts); none is
 * copied from the module under test.
 *
 * Arms: C1-C5 (capability), C6-C7 (unknown names, framework with a mapped command), S1-S4 (three sources),
 * R0 (router export), N1 (no network surface), D1 (dash guard).
 * No network, no room, no write.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PHASE = path.join(ROOT, '.planning', 'phases', '369.25-feyminto-and-room-identity-spoken-369-3a-the-one-authority-p');
const R6 = path.join(PHASE, 'fixtures', 'phase0', 'R6-three-source-diff', 'three-source-diff.json');
const CAP = path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs');
const SRC = path.join(ROOT, 'lib', 'core', 'feyminto', 'command-sources.cjs');
const REL = path.join(ROOT, 'data', 'section-command-relevance.json');
const ROUTER = path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const NO_RUNNABLE = 'no runnable command here; instruction-only or assisted';
const CORE = ['problem-definition', 'market-analysis', 'solution-design', 'business-model', 'competitive-analysis',
  'team-execution', 'legal-ip', 'financial-model', 'opportunity-bank', 'funding', 'strategy'];

let passed = 0;
let failed = 0;
let skipped = 0;
class Skip extends Error {}
function arm(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    if (e instanceof Skip) { skipped += 1; console.log('SKIP ' + name + ': ' + e.message); return; }
    failed += 1;
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { check(JSON.stringify(a) === JSON.stringify(b), msg + ': got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); }
function sameSet(a, b, msg) { eq(a.slice().sort(), b.slice().sort(), msg); }

// ---- independent readers (never the module under test) -----------------------------------------------------
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
const bare = (c) => c.replace(/^\/mos:/, '');
const regByName = new Map(registry.map((c) => [bare(c.command), c]));
const ledgerFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-command-ledger.json'), 'utf8'));
const jobCanon = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'section-job-canon.json'), 'utf8')).sections;
const relevance = JSON.parse(fs.readFileSync(REL, 'utf8'));
const frameworkNames = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'framework-names.json'), 'utf8')).framework_names;

// The router's unimplemented set, read from SOURCE TEXT so the test does not depend on the export under test.
function routerUnimplementedFromSource() {
  const t = fs.readFileSync(ROUTER, 'utf8');
  const m = t.match(/const UNIMPLEMENTED_MUTATING_ORCHESTRATION = new Set\(\[([\s\S]*?)\]\);/);
  if (!m) throw new Error('could not find UNIMPLEMENTED_MUTATING_ORCHESTRATION in tool-router.cjs source');
  const body = m[1].split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  return new Set([...body.matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]));
}
const routerAll = new Set(require(ROUTER).ALL_TOOL_COMMANDS);
const unimpl = routerUnimplementedFromSource();

function expectedMcp(name) {
  return routerAll.has(name) && !unimpl.has(name) ? 'runnable' : 'instruction-only';
}

function contractList(slug) {
  const t = fs.readFileSync(path.join(ROOT, 'templates', 'room-skeleton', 'section-contracts', slug + '.md'), 'utf8').split('\n');
  const i = t.findIndex((l) => /^## Commands that write here/.test(l));
  const out = [];
  for (let k = i + 1; k < t.length && !/^## /.test(t[k]); k++) {
    if (/^\s*-?\s*Note:/.test(t[k])) continue;
    for (const m of t[k].matchAll(/\/mos:([a-z0-9-]+)/g)) out.push(m[1]);
  }
  return [...new Set(out)];
}
function ledgerRow(slug) {
  const job = jobCanon[slug].job_id;
  return (ledgerFile.rows[job + '|*|*'] || []).map((r) => bare(r.command));
}

function loadCap() { return require(CAP); }
function loadSrc() { return require(SRC); }

// ---- capability --------------------------------------------------------------------------------------------
arm('C1 beautiful-question: cli runnable, mcp per the router sets, version from readRepoVersion', () => {
  const { capabilityFor } = loadCap();
  const { readRepoVersion } = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs'));
  const r = capabilityFor('beautiful-question', { kind: 'command' });
  check(r.known === true, 'known');
  eq(r.cli, 'runnable', 'cli');
  eq(r.mcp, expectedMcp('beautiful-question'), 'mcp');
  eq(r.version, readRepoVersion().version, 'version');
  check(typeof r.label === 'string' && r.label.length > 0, 'label present');
});

arm('C2 scout: mcp instruction-only (it is in UNIMPLEMENTED_MUTATING_ORCHESTRATION)', () => {
  check(unimpl.has('scout'), 'precondition: scout is in the router unimplemented set');
  const { capabilityFor } = loadCap();
  const r = capabilityFor('scout', { kind: 'command' });
  eq(r.mcp, 'instruction-only', 'mcp');
  eq(r.cli, 'runnable', 'cli (scout is a navigator-surface command with a file)');
});

arm('C3 an internal-surface registry command is instruction-only on both surfaces with reason "internal surface"', () => {
  const internal = registry.find((c) => c.surface === 'internal');
  check(internal, 'precondition: the registry has an internal-surface command');
  const { capabilityFor } = loadCap();
  const r = capabilityFor(bare(internal.command), { kind: 'command' });
  eq(r.cli, 'instruction-only', 'cli');
  eq(r.mcp, 'instruction-only', 'mcp');
  eq(r.reason, 'internal surface', 'reason');
});

arm('C4 a canonical framework no registry command lists is assisted', () => {
  const used = new Set();
  registry.forEach((c) => (c.frameworks || []).forEach((f) => used.add(String(f).toLowerCase())));
  const orphan = frameworkNames.find((f) => !used.has(String(f).toLowerCase()));
  check(orphan, 'precondition: some canonical framework is unmapped');
  const { capabilityFor, CAPABILITY } = loadCap();
  const r = capabilityFor(orphan, { kind: 'framework' });
  eq(r.known, true, 'known');
  eq(r.cli, CAPABILITY.ASSISTED, 'cli');
  eq(r.mcp, CAPABILITY.ASSISTED, 'mcp');
  check(/assisted/.test(r.label), 'label says assisted');
});

arm('C5 sectionMarker: legal-ip and financial-model read the no-runnable line; problem-definition does not', () => {
  const { sectionMarker } = loadCap();
  eq(sectionMarker('legal-ip'), NO_RUNNABLE, 'legal-ip');
  eq(sectionMarker('financial-model'), NO_RUNNABLE, 'financial-model');
  eq(sectionMarker('problem-definition'), null, 'problem-definition');
});

arm('C6 an unknown command name is { known: false }, never a runnable claim', () => {
  const { capabilityFor } = loadCap();
  const r = capabilityFor('zzz-not-a-command', { kind: 'command' });
  eq(r.known, false, 'known');
  check(r.cli === undefined && r.mcp === undefined, 'no cli or mcp claim on an unknown name');
});

arm('C7 a framework that a registry command lists is not assisted and names that command', () => {
  const cmd = registry.find((c) => (c.frameworks || []).length > 0 && c.surface === 'navigator');
  check(cmd, 'precondition');
  const fw = cmd.frameworks[0];
  const owners = registry.filter((c) => (c.frameworks || []).some((f) => String(f).toLowerCase() === String(fw).toLowerCase())).map((c) => bare(c.command));
  const { capabilityFor, CAPABILITY } = loadCap();
  const r = capabilityFor(fw, { kind: 'framework' });
  check(r.cli !== CAPABILITY.ASSISTED, 'a mapped framework is not assisted on cli');
  sameSet(r.commands, owners, 'the mapping commands');
});

arm('C8 a command whose file name differs from its name: key (validate-proposition in value-proposition.md) is still runnable on CLI', () => {
  const file = path.join(ROOT, 'commands', 'value-proposition.md');
  check(fs.existsSync(file) && !fs.existsSync(path.join(ROOT, 'commands', 'validate-proposition.md')), 'precondition: the intentional file-name mismatch is present');
  check(/^name:\s*validate-proposition\s*$/m.test(fs.readFileSync(file, 'utf8')), 'precondition: the file declares name: validate-proposition');
  const { capabilityFor } = loadCap();
  const r = capabilityFor('validate-proposition', { kind: 'command' });
  eq(r.cli, 'runnable', 'cli');
  eq(r.mcp, expectedMcp('validate-proposition'), 'mcp');
});

arm('C9 every non-internal registry command resolves to a command file by file name or name: key, so none is marked instruction-only for a missing file', () => {
  const { capabilityFor } = loadCap();
  const bad = registry.filter((c) => c.surface === 'navigator').map((c) => capabilityFor(bare(c.command), { kind: 'command' })).filter((r) => r.cli !== 'runnable');
  eq(bad.map((r) => r.name), [], 'navigator-surface commands not runnable on CLI');
});

// ---- the three command sources -----------------------------------------------------------------------------
arm('S1 counts: contract and table equal the R6 fixture; ledger equals the row read independently (MOVING)', () => {
  if (!fs.existsSync(R6)) throw new Skip('the R6 fixture is not in this checkout (.planning/ is not shipped)');
  const fx = JSON.parse(fs.readFileSync(R6, 'utf8')).sections;
  const { sourcesForSection } = loadSrc();
  for (const slug of CORE) {
    const r = sourcesForSection(slug);
    eq(r.contract.names.length, fx[slug].contract_commands.length, slug + ' contract count');
    eq(r.navigator_table.names.length, fx[slug].table_commands.length, slug + ' table count');
    eq(r.ledger.names, ledgerRow(slug), slug + ' ledger row (order kept)');
    sameSet(r.contract.names, contractList(slug), slug + ' contract names');
  }
});

arm('S2 competitive-analysis: top 3 shares nothing with the contract; the disagreement lists are visible', () => {
  const { sourcesForSection } = loadSrc();
  const r = sourcesForSection('competitive-analysis');
  const contract = contractList('competitive-analysis');
  eq(r.context_section2_top3, ledgerRow('competitive-analysis').slice(0, 3), 'top 3 is the first three of the ledger row');
  eq(r.context_section2_top3.filter((n) => contract.includes(n)).length, 0, 'top 3 names none of the contract commands');
  check(r.table_only.includes('scout'), 'scout is table_only (the table names it, the contract does not)');
  check(!r.contract_only.includes('scout'), 'scout is not contract_only');
  for (const n of ['contract_only', 'ledger_only', 'table_only', 'agreement']) check(Array.isArray(r[n]), n + ' is an array');
  check(r.agreement.includes('compare-ventures'), 'compare-ventures is named by two or more sources');
});

arm('S3 the relevance data: every named command is in the registry; provenance line and closing rule present', () => {
  eq(Object.keys(relevance.sections).length, 11, 'section count');
  const named = new Set();
  for (const s of Object.values(relevance.sections)) for (const k of ['existing', 'supporting', 'additional_fit']) s[k].forEach((n) => named.add(n));
  for (const a of Object.values(relevance.areas)) a.commands.forEach((n) => named.add(n));
  const missing = [...named].filter((n) => !regByName.has(n));
  eq(missing, [], 'commands named in the data file but absent from data/command-registry.json');
  check(named.size > 0, 'non-vacuous: the data file names commands');
  check(relevance.provenance.includes('navigator-supplied'), 'provenance line');
  check(relevance.rule.startsWith('The section sets the purpose.'), 'the closing rule sentence');
  eq(relevance.no_dedicated_command, ['legal-ip', 'financial-model'], 'no_dedicated_command');
  // verbatim filing: the rule equals the last rule paragraph of the filed table
  if (fs.existsSync(path.join(PHASE, '369.25-SECTION-COMMAND-RELEVANCE.md'))) {
    const filed = fs.readFileSync(path.join(PHASE, '369.25-SECTION-COMMAND-RELEVANCE.md'), 'utf8');
    check(filed.includes(relevance.rule), 'the rule is the filed sentence, word for word');
  }
});

arm('S4 provenance per source: ledger stamp is plugin_version + build_mode; table stamp is the navigator date', () => {
  const { sourcesForSection } = loadSrc();
  const r = sourcesForSection('market-analysis');
  eq(r.contract.provenance, { kind: 'contract', path: 'templates/room-skeleton/section-contracts/market-analysis.md', stamp: 'authored' }, 'contract provenance');
  eq(r.ledger.provenance, { kind: 'ledger', path: 'data/section-command-ledger.json', stamp: ledgerFile.plugin_version + ' ' + ledgerFile.build_mode }, 'ledger provenance');
  eq(r.navigator_table.provenance, { kind: 'navigator_table', path: 'data/section-command-relevance.json', stamp: 'navigator-supplied 2026-10-06' }, 'table provenance');
  const { SOURCE_KINDS } = loadSrc();
  eq(SOURCE_KINDS, ['contract', 'ledger', 'navigator_table'], 'SOURCE_KINDS');
  check(Object.isFrozen(SOURCE_KINDS), 'SOURCE_KINDS is frozen');
});

arm('S5 an unknown section is refused, not guessed', () => {
  const { sourcesForSection } = loadSrc();
  let threw = false;
  let out;
  try { out = sourcesForSection('not-a-section'); } catch (_e) { threw = true; }
  check(threw || out === null, 'unknown section throws or returns null');
});

// ---- router export, no network, dash guard -----------------------------------------------------------------
arm('R0 the router exports UNIMPLEMENTED_MUTATING_ORCHESTRATION and it equals the literal in its source', () => {
  const exported = require(ROUTER).UNIMPLEMENTED_MUTATING_ORCHESTRATION;
  check(exported instanceof Set, 'exported as a Set');
  sameSet([...exported], [...unimpl], 'exported set equals the source literal');
});

arm('N1 neither module reaches the network or the brain client', () => {
  for (const f of [CAP, SRC]) {
    check(fs.existsSync(f), path.relative(ROOT, f) + ' exists');
    const t = fs.readFileSync(f, 'utf8');
    check(!/fetch\(|https|brain-client/.test(t), path.relative(ROOT, f) + ' carries no network or brain-client reference');
  }
});

arm('D1 dash guard over the test, both modules and the data file', () => {
  for (const f of [__filename, CAP, SRC, REL]) {
    check(fs.existsSync(f), path.relative(ROOT, f) + ' exists');
    const t = fs.readFileSync(f, 'utf8');
    check(!t.includes(EM) && !t.includes(EN), 'em or en dash in ' + path.relative(ROOT, f));
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
process.exit(failed > 0 ? 1 : 0);
