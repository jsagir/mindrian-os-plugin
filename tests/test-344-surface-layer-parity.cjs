#!/usr/bin/env node
'use strict';

/*
 * The whole-tree surface-layer-parity test.
 *
 * The layer contract phase, this plan's requirement LAYER-07: the
 * whole-tree parity test. Where the sibling layer-gate test pins the gate's
 * BEHAVIOR against synthetic clean/violating trees, this test pins the
 * gate's RESULT against the REAL repo tree, after this plan's own
 * agent/pipeline/skill/MCP-tool backfill: zero undeclared surfaces across
 * every class the gate walks.
 *
 * Every count below is computed from disk (fs.readdirSync) or from the gate's
 * own --json output, cross-checked against an independent enumeration this
 * file performs itself. No expected total is ever a hardcoded literal --
 * the phrase to avoid, per this task's own action text.
 *
 * Canon Part 8: LOCAL-only. node:fs + node:path + node:child_process only.
 * Zero network, zero Brain reach, zero room access.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GATE_PATH = path.join(REPO_ROOT, 'scripts', 'check-layer-declaration.cjs');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'layer-declaration-schema.json');
const BACKFILL_PATH = path.join(REPO_ROOT, 'data', 'layer-backfill.json');
const MCP_CONNECTORS_PATH = path.join(REPO_ROOT, 'data', 'mcp-tool-connectors.json');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const AGENTS_DIR = path.join(REPO_ROOT, 'agents');
const PIPELINES_DIR = path.join(REPO_ROOT, 'pipelines');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

const { parseFrontmatter } = require(path.join(REPO_ROOT, 'scripts', 'check-shape-declaration.cjs'));

let pass = 0;
let fail = 0;

function assert(cond, label) {
  if (cond) {
    pass += 1;
    console.log('PASS: ' + label);
  } else {
    fail += 1;
    console.log('FAIL: ' + label);
  }
}

// ---------------------------------------------------------------------------
// enumerateFromDisk() -- the SAME four-class walk the gate itself performs
// (scripts/check-shape-declaration.cjs's collectSurfaces()), reimplemented
// independently here via fs.readdirSync so this test never trusts the code
// under test for its own denominator.
// ---------------------------------------------------------------------------
function enumerateFromDisk() {
  const commandFiles = fs.existsSync(COMMANDS_DIR)
    ? fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'))
    : [];

  const agentFiles = fs.existsSync(AGENTS_DIR)
    ? fs.readdirSync(AGENTS_DIR).filter((f) => f.endsWith('.md'))
    : [];

  const pipelineDirs = fs.existsSync(PIPELINES_DIR)
    ? fs
        .readdirSync(PIPELINES_DIR)
        .filter((d) => fs.existsSync(path.join(PIPELINES_DIR, d, 'CHAIN.md')))
    : [];

  const skillDirs = fs.existsSync(SKILLS_DIR)
    ? fs.readdirSync(SKILLS_DIR).filter((d) => fs.existsSync(path.join(SKILLS_DIR, d, 'SKILL.md')))
    : [];

  return { commandFiles, agentFiles, pipelineDirs, skillDirs };
}

// ---------------------------------------------------------------------------
// isExemptSkill(skillDir) -- the same exemption predicate the gate applies:
// connector.excluded === true with a non-empty reason.
// ---------------------------------------------------------------------------
function isExemptSkill(skillDir) {
  const skillFile = path.join(SKILLS_DIR, skillDir, 'SKILL.md');
  const text = fs.readFileSync(skillFile, 'utf8');
  const fm = parseFrontmatter(text);
  const conn = fm && fm.connector;
  return !!(
    conn &&
    typeof conn === 'object' &&
    !Array.isArray(conn) &&
    conn.excluded === true &&
    typeof conn.reason === 'string' &&
    conn.reason.trim() !== ''
  );
}

function hasLayerLine(skillDir) {
  const skillFile = path.join(SKILLS_DIR, skillDir, 'SKILL.md');
  const text = fs.readFileSync(skillFile, 'utf8');
  return /^layer:/m.test(text);
}

function main() {
  // --- Run the gate over the REAL repo tree (no CHECK_LAYER_DECLARATION_ROOT
  //     override), --json mode. ---------------------------------------------
  const res = spawnSync(process.execPath, [GATE_PATH, '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  let report = null;
  try {
    report = JSON.parse(res.stdout);
  } catch (_e) {
    report = null;
  }
  assert(report !== null, 'gate --json over the real tree prints valid JSON');

  // --- Bullet 1: undeclared is 0. --------------------------------------------
  assert(report && report.undeclared === 0, "the gate's --json undeclared total is 0 over the real repo tree");

  // --- Independent denominator, computed here from disk plus the generated
  //     MCP connector registry, never a literal. -----------------------------
  const disk = enumerateFromDisk();
  const mcpRegistry = JSON.parse(fs.readFileSync(MCP_CONNECTORS_PATH, 'utf8'));
  const mcpList = Array.isArray(mcpRegistry) ? mcpRegistry : mcpRegistry.connectors;
  const computedTotal =
    disk.commandFiles.length + disk.agentFiles.length + disk.pipelineDirs.length + disk.skillDirs.length + mcpList.length;

  assert(
    report && report.total === computedTotal,
    'the gate total (' + (report && report.total) + ') equals the denominator this test computes itself from disk (' + computedTotal + ')'
  );

  // --- Bullet 2: declared + exempt === total. --------------------------------
  assert(
    report && report.declared + report.exempt === report.total,
    'declared (' + (report && report.declared) + ') + exempt (' + (report && report.exempt) + ') equals total (' + (report && report.total) + ')'
  );

  // --- Bullet 3: every by_layer key is a vocabulary member, keys sum to
  //     declared. -------------------------------------------------------------
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const vocabulary = schema && schema._doc && Array.isArray(schema._doc.layer_vocabulary) ? schema._doc.layer_vocabulary : [];
  assert(vocabulary.length > 0, 'the layer vocabulary itself is non-empty');

  const byLayer = (report && report.by_layer) || {};
  const outOfVocabKeys = Object.keys(byLayer).filter((k) => !vocabulary.includes(k));
  assert(outOfVocabKeys.length === 0, 'every by_layer key is a member of the schema vocabulary (offenders: ' + outOfVocabKeys.join(', ') + ')');

  const byLayerSum = Object.keys(byLayer).reduce((acc, k) => acc + byLayer[k], 0);
  assert(
    byLayerSum === (report && report.declared),
    'the by_layer keys sum (' + byLayerSum + ') equals declared (' + (report && report.declared) + ')'
  );

  // --- Bullet 4: every skill absent from data/layer-backfill.json and
  //     carrying no ^layer: line is exempt (excluded:true + non-empty
  //     reason). --------------------------------------------------------------
  const backfillMap = JSON.parse(fs.readFileSync(BACKFILL_PATH, 'utf8'));
  const badAbsences = [];
  for (const skillDir of disk.skillDirs) {
    const key = 'skills/' + skillDir + '/SKILL.md';
    const inMap = Object.prototype.hasOwnProperty.call(backfillMap, key);
    if (inMap) continue;
    if (hasLayerLine(skillDir)) continue;
    if (!isExemptSkill(skillDir)) badAbsences.push(key);
  }
  assert(
    badAbsences.length === 0,
    'every skill absent from data/layer-backfill.json with no ^layer: line is exempt (offenders: ' + badAbsences.join(', ') + ')'
  );

  // --- Bullet 5: this test's own source contains no three-digit literal. ----
  const selfSource = fs.readFileSync(__filename, 'utf8');
  assert(!/\b\d{3}\b/.test(selfSource), 'this test source contains no three-digit literal');

  console.log('');
  console.log(
    'PASS=' +
      pass +
      ' FAIL=' +
      fail +
      ' (enumerated ' +
      computedTotal +
      ' surfaces: ' +
      disk.commandFiles.length +
      ' commands, ' +
      disk.agentFiles.length +
      ' agents, ' +
      disk.pipelineDirs.length +
      ' pipelines, ' +
      disk.skillDirs.length +
      ' skills, ' +
      mcpList.length +
      ' mcp tools)'
  );
  process.exit(fail > 0 ? 1 : 0);
}

main();
