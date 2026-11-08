#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 392 Plan 02 Task 1 -- the vocabulary drift test (392-SC3, D-01, D-02).
 *
 * THE SEAM THIS PROVES: data/brain-shape-vocabulary.json is the ONE file that
 * holds the closed enums of the Part 8 problem shape (problem_type, stage,
 * role, domain_tag, constraint_categories) and the one stage map from the
 * room's venture_stage to Theo's six Phase ids. Every other list in this
 * repo is pinned to it here, or named as retired through legacy_stage_map.
 * When any list changes alone, this test fails and names the list.
 *
 * Legs:
 *   V0  the vocabulary file exists and parses (RED on beta.81: missing file)
 *   V1  problem_type == the four Theo rung ids == guard TAXONOMY_RUNGS ==
 *       brain-client THEO_RUNG_SET == rung-vocabulary THEO_RUNGS as a set;
 *       isTheoRung accepts every member and rejects every non-member;
 *       Theo vocabulary.ts PROBLEM_TYPE_IDS when readable (named SKIP else)
 *   V2  stage == Phase0..Phase5 (D-01)
 *   V3  stage_map keys == model-profiles VALID_STAGES; values in stage
 *   V4  role == the seven lowercase ids of user-md-ops.cjs role_blend axes;
 *       persona-taxonomy ROLE_BLEND_AXES map onto them through role_map
 *   V5  domain_tag == data/eureka-critic-tags.json domain_tags, same order
 *   V6  constraint_categories == the nine D-02 members, same order
 *   V7  Theo shape-packet.ts five enums == the five lists, order included,
 *       when the file is readable (one named SKIP line otherwise)
 *   V8  persona-taxonomy PROBLEM_TYPES map through problem_type_aliases;
 *       Wicked has no alias
 *   V9  persona-taxonomy VENTURE_STAGES each have a legacy_stage_map entry
 *       (a Phase id or "retired"); the retired ones are printed
 *   V10 the informal stage words of lib/mcp/brain-router.cjs (venture_stage
 *       inference block) each have a legacy_stage_map entry
 *   V11 every enum member matches ^[A-Za-z][A-Za-z0-9_]*$
 *
 * Theo reads are read-only (fs.readFileSync) off MINDRIAN_THEO_CHECKOUT
 * (default /home/jsagi/Theo), the test-354 precedent. A SKIP is tallied as a
 * named skip, never as a pass of that assertion.
 *
 * Run: node tests/test-392-vocabulary-drift.cjs
 * Plain Node harness, hand-rolled ok(), exit 1 on any failure.
 * Hyphens only, no em dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const VOCAB_PATH = path.join(REPO, 'data', 'brain-shape-vocabulary.json');
const CRITIC_TAGS_PATH = path.join(REPO, 'data', 'eureka-critic-tags.json');
const USER_MD_OPS_PATH = path.join(REPO, 'lib', 'core', 'user-md-ops.cjs');
const MODEL_PROFILES_PATH = path.join(REPO, 'lib', 'core', 'model-profiles.cjs');
const BRAIN_ROUTER_PATH = path.join(REPO, 'lib', 'mcp', 'brain-router.cjs');
const THEO_CHECKOUT = process.env.MINDRIAN_THEO_CHECKOUT || '/home/jsagi/Theo';
const THEO_VOCAB_PATH = path.join(THEO_CHECKOUT, 'src', 'mcp', 'content', 'vocabulary.ts');
const THEO_SHAPE_PATH = path.join(THEO_CHECKOUT, 'src', 'mcp', 'content', 'shape-packet.ts');

const EXPECTED = Object.freeze({
  problem_type: ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked'],
  stage: ['Phase0', 'Phase1', 'Phase2', 'Phase3', 'Phase4', 'Phase5'],
  role: ['founder', 'researcher', 'operator', 'investor', 'mentor', 'domain_expert', 'student'],
  constraint_categories: ['regulatory', 'capital', 'technical', 'market_access', 'talent', 'time', 'data', 'partner', 'ethical'],
  brain_router_stage_words: ['discovery', 'ideation', 'validation', 'problem-fit', 'growth', 'scaling', 'execution'],
});
const ENUM_MEMBER_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

let checks = 0;
let failed = 0;
let skips = 0;
const failedLegs = new Set();
const skipLines = [];

function ok(leg, label, cond) {
  checks += 1;
  if (cond) {
    console.log('  ok   [' + leg + '] ' + label);
  } else {
    failed += 1;
    failedLegs.add(leg);
    console.log('  FAIL [' + leg + '] ' + label);
  }
}

function skip(leg, line) {
  skips += 1;
  skipLines.push(leg + ': ' + line);
  console.log('SKIP ' + line);
}

function sameList(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameSet(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

/** Parse `export const NAME = [ 'a', 'b' ] as const` into ['a','b']; null when absent. */
function parseTsTuple(text, name) {
  const re = new RegExp('export const ' + name + ' = \\[([\\s\\S]*?)\\] as const');
  const m = text.match(re);
  if (!m) return null;
  const out = [];
  const itemRe = /'([^']*)'/g;
  let im;
  while ((im = itemRe.exec(m[1])) !== null) out.push(im[1]);
  return out;
}

function readTextOrNull(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function main() {
  console.log('test-392-vocabulary-drift');

  // V0 -- the file exists and parses.
  if (!fs.existsSync(VOCAB_PATH)) {
    console.log('  FAIL [V0] data/brain-shape-vocabulary.json is missing at ' + VOCAB_PATH);
    console.log('FAIL: test-392-vocabulary-drift (vocabulary file missing)');
    process.exit(1);
  }
  let vocab;
  try {
    vocab = JSON.parse(fs.readFileSync(VOCAB_PATH, 'utf8'));
  } catch (e) {
    console.log('  FAIL [V0] data/brain-shape-vocabulary.json does not parse: ' + (e && e.message));
    process.exit(1);
  }
  ok('V0', 'schema_version is 1', vocab.schema_version === 1);
  for (const key of ['problem_type', 'stage', 'stage_map', 'role', 'role_map', 'domain_tag', 'constraint_categories', 'problem_type_aliases', 'legacy_stage_map']) {
    ok('V0', 'key present: ' + key, vocab[key] !== undefined && vocab[key] !== null);
  }

  // Repo lists.
  const guard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
  const brainClient = require(path.join(REPO, 'lib', 'core', 'brain-client.cjs'));
  const rungVocab = require(path.join(REPO, 'lib', 'core', 'strategy', 'rung-vocabulary.cjs'));
  // VALID_STAGES is a module-local literal in model-profiles.cjs (not exported
  // on beta.81); read it from the source text, the user-md-ops technique below.
  const modelProfilesText = fs.readFileSync(MODEL_PROFILES_PATH, 'utf8');
  const validStagesMatch = modelProfilesText.match(/const VALID_STAGES = \[([\s\S]*?)\];/);
  const VALID_STAGES = validStagesMatch ? Array.from(validStagesMatch[1].matchAll(/'([^']+)'/g), (m) => m[1]) : [];
  const modelProfiles = { VALID_STAGES: VALID_STAGES };
  ok('V3', 'model-profiles.cjs VALID_STAGES literal found with 5 members', VALID_STAGES.length === 5);
  const personaTaxonomy = require(path.join(REPO, 'lib', 'core', 'persona-taxonomy.cjs'));
  const criticTags = JSON.parse(fs.readFileSync(CRITIC_TAGS_PATH, 'utf8'));

  // V1 -- problem_type.
  ok('V1', 'problem_type equals the four Theo rung ids in order', sameList(vocab.problem_type, EXPECTED.problem_type));
  ok('V1', 'problem_type equals the guard TAXONOMY_RUNGS set', sameSet(vocab.problem_type, Array.from(guard.TAXONOMY_RUNGS)));
  ok('V1', 'problem_type equals brain-client THEO_RUNG_SET', sameSet(vocab.problem_type, Array.from(brainClient.THEO_RUNG_SET)));
  ok('V1', 'problem_type equals rung-vocabulary THEO_RUNGS as a set', sameSet(vocab.problem_type, rungVocab.THEO_RUNGS));
  ok('V1', 'every problem_type member passes isTheoRung', vocab.problem_type.every((m) => rungVocab.isTheoRung(m)));
  ok('V1', 'every non-member fails isTheoRung', ['undefined', 'ill-defined', 'Undefined Problem', 'wicked', '', 'Phase1'].every((m) => !rungVocab.isTheoRung(m)));
  const theoVocabText = readTextOrNull(THEO_VOCAB_PATH);
  if (theoVocabText === null) {
    skip('V1', 'theo vocabulary.ts not readable at ' + THEO_VOCAB_PATH + ': PROBLEM_TYPE_IDS not compared');
  } else {
    const ids = parseTsTuple(theoVocabText, 'PROBLEM_TYPE_IDS');
    ok('V1', 'Theo vocabulary.ts PROBLEM_TYPE_IDS parsed', Array.isArray(ids) && ids.length > 0);
    ok('V1', 'problem_type equals Theo PROBLEM_TYPE_IDS in order', sameList(vocab.problem_type, ids || []));
  }

  // V2 -- stage.
  ok('V2', 'stage equals Phase0..Phase5 in order (D-01)', sameList(vocab.stage, EXPECTED.stage));

  // V3 -- stage_map.
  const stageMapKeys = Object.keys(vocab.stage_map || {});
  ok('V3', 'stage_map keys equal model-profiles VALID_STAGES as a set', sameSet(stageMapKeys, modelProfiles.VALID_STAGES));
  ok('V3', 'stage_map has exactly ' + modelProfiles.VALID_STAGES.length + ' keys', stageMapKeys.length === modelProfiles.VALID_STAGES.length);
  ok('V3', 'every stage_map value is a stage member', stageMapKeys.every((k) => vocab.stage.includes(vocab.stage_map[k])));
  ok('V3', 'Phase0 is not a stage_map target (reached only by a room with no venture_stage)', !stageMapKeys.some((k) => vocab.stage_map[k] === 'Phase0'));

  // V4 -- role.
  ok('V4', 'role equals the seven lowercase ids in order', sameList(vocab.role, EXPECTED.role));
  const userMdOpsText = fs.readFileSync(USER_MD_OPS_PATH, 'utf8');
  const axesMatch = userMdOpsText.match(/const axes = \[([\s\S]*?)\];/);
  const userMdAxes = axesMatch ? Array.from(axesMatch[1].matchAll(/'([^']+)'/g), (m) => m[1]) : null;
  ok('V4', 'user-md-ops.cjs role_blend axes literal found', Array.isArray(userMdAxes) && userMdAxes.length > 0);
  ok('V4', 'role equals user-md-ops.cjs role_blend axes in order', sameList(vocab.role, userMdAxes || []));
  const roleMapKeys = Object.keys(vocab.role_map || {});
  ok('V4', 'role_map keys equal persona-taxonomy ROLE_BLEND_AXES as a set', sameSet(roleMapKeys, personaTaxonomy.ROLE_BLEND_AXES));
  ok('V4', 'every role_map value is a role member', roleMapKeys.every((k) => vocab.role.includes(vocab.role_map[k])));
  ok('V4', 'role_map covers every role exactly once', sameSet(roleMapKeys.map((k) => vocab.role_map[k]), vocab.role) && roleMapKeys.length === vocab.role.length);

  // V5 -- domain_tag.
  ok('V5', 'domain_tag equals eureka-critic-tags.json domain_tags in order (11 members)', sameList(vocab.domain_tag, criticTags.domain_tags) && vocab.domain_tag.length === 11);

  // V6 -- constraint_categories.
  ok('V6', 'constraint_categories equals the nine D-02 members in order', sameList(vocab.constraint_categories, EXPECTED.constraint_categories));

  // V7 -- Theo shape-packet.ts five enums.
  const theoShapeText = readTextOrNull(THEO_SHAPE_PATH);
  if (theoShapeText === null) {
    skip('V7', 'theo shape-packet.ts not readable at ' + THEO_SHAPE_PATH + ': Theo plan 48-01 not landed');
  } else {
    const importsVocab = /import \{[^}]*PROBLEM_TYPE_IDS[^}]*\} from '\.\/vocabulary\.js'/.test(theoShapeText);
    ok('V7', 'shape-packet.ts imports PROBLEM_TYPE_IDS from vocabulary.ts', importsVocab);
    const theoProblemType = theoVocabText === null ? null : parseTsTuple(theoVocabText, 'PROBLEM_TYPE_IDS');
    const pairs = [
      ['problem_type', 'PROBLEM_TYPE_IDS', theoProblemType],
      ['stage', 'STAGE_IDS', parseTsTuple(theoShapeText, 'STAGE_IDS')],
      ['role', 'ROLE_IDS', parseTsTuple(theoShapeText, 'ROLE_IDS')],
      ['domain_tag', 'DOMAIN_TAG_IDS', parseTsTuple(theoShapeText, 'DOMAIN_TAG_IDS')],
      ['constraint_categories', 'CONSTRAINT_CATEGORY_IDS', parseTsTuple(theoShapeText, 'CONSTRAINT_CATEGORY_IDS')],
    ];
    for (const [key, name, theoList] of pairs) {
      ok('V7', 'Theo ' + name + ' parsed', Array.isArray(theoList) && theoList.length > 0);
      ok('V7', key + ' equals Theo ' + name + ' in order (' + (theoList ? theoList.length : 0) + ' members)', sameList(vocab[key], theoList || []));
    }
    const schemaVersionMatch = theoShapeText.match(/export const SHAPE_SCHEMA_VERSION = (\d+) as const/);
    ok('V7', 'Theo SHAPE_SCHEMA_VERSION equals schema_version', !!schemaVersionMatch && Number(schemaVersionMatch[1]) === vocab.schema_version);
  }

  // V8 -- persona-taxonomy PROBLEM_TYPES through problem_type_aliases.
  const aliases = vocab.problem_type_aliases || {};
  const expectedAliases = { UDP: 'UnDefined', IDP: 'IllDefined', WDP: 'WellDefined' };
  for (const pt of personaTaxonomy.PROBLEM_TYPES) {
    if (pt === 'unknown') {
      ok('V8', 'persona PROBLEM_TYPES unknown has no alias (a cold-start sentinel, not a problem type)', aliases[pt] === undefined);
      continue;
    }
    ok('V8', 'persona PROBLEM_TYPES ' + pt + ' aliases to ' + expectedAliases[pt], aliases[pt] === expectedAliases[pt]);
  }
  ok('V8', 'every alias target is a problem_type member', Object.keys(aliases).every((k) => vocab.problem_type.includes(aliases[k])));
  const wickedAliased = Object.keys(aliases).filter((k) => aliases[k] === 'Wicked');
  ok('V8', 'Wicked has no alias (persona-taxonomy carries no Wicked member)', wickedAliased.length === 0);
  console.log('  note [V8] Wicked has no persona-taxonomy alias: UDP/IDP/WDP cover three of the four rungs');

  // V9 -- persona-taxonomy VENTURE_STAGES through legacy_stage_map.
  const legacy = vocab.legacy_stage_map || {};
  const retired = [];
  for (const vs of personaTaxonomy.VENTURE_STAGES) {
    const v = legacy[vs];
    ok('V9', 'persona VENTURE_STAGES ' + vs + ' has a legacy_stage_map entry', v !== undefined);
    ok('V9', 'legacy_stage_map ' + vs + ' is a Phase id or "retired" (got ' + JSON.stringify(v) + ')', v === 'retired' || vocab.stage.includes(v));
    if (v === 'retired') retired.push(vs);
  }

  // V10 -- brain-router informal stage words.
  const routerText = fs.readFileSync(BRAIN_ROUTER_PATH, 'utf8');
  const blockStart = routerText.indexOf('Infer from venture_stage');
  const block = blockStart === -1 ? '' : routerText.slice(blockStart, blockStart + 1200);
  const routerWords = Array.from(new Set(Array.from(block.matchAll(/stage === '([a-z-]+)'/g), (m) => m[1])));
  ok('V10', 'brain-router.cjs venture_stage inference block found', blockStart !== -1);
  ok('V10', 'brain-router informal stage words are the seven pinned words', sameSet(routerWords, EXPECTED.brain_router_stage_words));
  for (const w of EXPECTED.brain_router_stage_words) {
    const v = legacy[w];
    ok('V10', 'brain-router word ' + w + ' has a legacy_stage_map entry', v !== undefined);
    ok('V10', 'legacy_stage_map ' + w + ' is a Phase id or "retired" (got ' + JSON.stringify(v) + ')', v === 'retired' || vocab.stage.includes(v));
    if (v === 'retired' && !retired.includes(w)) retired.push(w);
  }
  ok('V10', 'every legacy_stage_map value is a Phase id or "retired"', Object.keys(legacy).every((k) => legacy[k] === 'retired' || vocab.stage.includes(legacy[k])));
  console.log('  retired legacy stages: ' + (retired.length ? retired.join(', ') : 'none'));

  // V11 -- enum members are plain identifiers.
  for (const key of ['problem_type', 'stage', 'role', 'domain_tag', 'constraint_categories']) {
    const list = vocab[key];
    ok('V11', key + ' members match ^[A-Za-z][A-Za-z0-9_]*$', Array.isArray(list) && list.every((m) => ENUM_MEMBER_RE.test(m)));
    ok('V11', key + ' has no duplicate member', Array.isArray(list) && new Set(list).size === list.length);
  }

  // V12 -- the builder's two additions (plan 392-08): role_default is a role
  // member; constraint_keyword_map has exactly the constraint_categories as
  // keys, every keyword is a lowercase word, and no keyword sits in two
  // categories (a keyword in two categories would make the packet depend on
  // iteration order).
  ok('V12', 'role_default is a role member', typeof vocab.role_default === 'string' && vocab.role.includes(vocab.role_default));
  const kwMap = vocab.constraint_keyword_map || {};
  const kwKeys = Object.keys(kwMap);
  ok('V12', 'constraint_keyword_map keys equal constraint_categories as a set', sameSet(kwKeys, vocab.constraint_categories));
  ok('V12', 'every constraint_keyword_map value is a non-empty array of lowercase words',
    kwKeys.every((k) => Array.isArray(kwMap[k]) && kwMap[k].length > 0 && kwMap[k].every((w) => /^[a-z][a-z0-9_]*$/.test(w))));
  const allKeywords = kwKeys.flatMap((k) => kwMap[k]);
  ok('V12', 'no keyword appears in two constraint categories', new Set(allKeywords).size === allKeywords.length);

  console.log('');
  console.log('======================================');
  console.log('Checks: ' + checks + '  Failed: ' + failed + '  Skips: ' + skips);
  if (skipLines.length) console.log('Skips: ' + skipLines.join(' | '));
  if (failedLegs.size > 0) console.log('Failed legs: ' + Array.from(failedLegs).sort().join(', '));
  console.log('======================================');
  if (failed > 0) process.exit(1);
}

try {
  main();
} catch (e) {
  console.error('FAIL: test-392-vocabulary-drift');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
