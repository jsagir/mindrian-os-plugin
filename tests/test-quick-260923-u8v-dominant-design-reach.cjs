'use strict';
/*
 * Quick task 260923-u8v -- teach Larry when to reach for Dominant Design.
 *
 * RED-then-GREEN pin for four things:
 *   Group A -- the new SKILL.md subsection (Theo ch04 doctrine).
 *   Group B -- the SENS-09 dominant-design branch (sensor-diffusion-adoption.cjs)
 *              surfacing through the one governed dispatchSensors -> dispatch
 *              map -> commandsForFramework path, plus the ACE precedence
 *              regression guard.
 *   Group C -- the connector claim (commands/dominant-designs.md) and the two
 *              regenerated registries, with the skills/dominant-designs/SKILL.md
 *              mirror staying byte-unchanged.
 *   Group D -- the SENS-09 counter-metric honesty record.
 *
 * This is a plain node script (no framework). Every check(name, fn) records
 * pass/fail independently and keeps going after a failure, so one missing
 * export (classifyDominantDesign does not exist on the pre-change tree) fails
 * only the checks that need it instead of crashing the whole run. Each check
 * name starts with its behavior id (A1, B4, C2, ...) so a caller can grep
 * '^FAIL - <id>' to tell an expected pre-change RED from a real regression.
 *
 * House rule: hyphens only, no em-dashes, no en-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
const groupTally = {}; // { A: {pass,fail}, B: {...}, C: {...}, D: {...} }

function bump(letter, ok) {
  if (!groupTally[letter]) groupTally[letter] = { pass: 0, fail: 0 };
  groupTally[letter][ok ? 'pass' : 'fail']++;
}

function check(name, fn) {
  const letter = (name.match(/^([A-D])\d/) || [])[1] || '?';
  try {
    const r = fn();
    if (r === false) throw new Error('assertion returned false');
    console.log('ok - ' + name);
    pass++;
    bump(letter, true);
  } catch (e) {
    console.log('FAIL - ' + name + ': ' + (e && e.message ? e.message : String(e)));
    fail++;
    bump(letter, false);
  }
}

// ---------------------------------------------------------------------------
// Group A -- SKILL.md doctrine section (read the WORKING TREE file, not HEAD)
// ---------------------------------------------------------------------------

const SKILL_PATH = path.join(REPO_ROOT, 'skills', 'larry-personality', 'SKILL.md');
const HEADING = '### When to reach for Dominant Design (/mos:dominant-designs)';
const OPERATING_HEADING = '## Operating the components (ICM Layer 1 Routing)';
const REACH_RULES_HEADING = '### Reach rules';
const CANONICAL_REACH_IDS = ['brain_consult', 'context_block', 'contradiction', 'cross_room', 'deep_research', 'hats'];

let skillSrc = '';
let skillSection = null; // { text }
try {
  skillSrc = fs.readFileSync(SKILL_PATH, 'utf8');
  const lines = skillSrc.split('\n');
  const startIdx = lines.findIndex(function (l) { return l === HEADING; });
  if (startIdx !== -1) {
    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (lines[i].indexOf('## ') === 0 || lines[i].indexOf('### ') === 0) { endIdx = i; break; }
    }
    skillSection = { text: lines.slice(startIdx, endIdx).join('\n') };
  }
} catch (e) {
  skillSrc = '';
  skillSection = null;
}

function sectionText() {
  if (!skillSection) throw new Error('section heading not found: ' + HEADING);
  return skillSection.text;
}

check('A1 section heading exists with a body', function () {
  return !!sectionText();
});

check('A2 section placed after Reach rules and before Operating the components', function () {
  const headingIdx = skillSrc.indexOf(HEADING);
  const reachRulesIdx = skillSrc.indexOf(REACH_RULES_HEADING);
  const operatingIdx = skillSrc.indexOf(OPERATING_HEADING);
  if (headingIdx === -1 || reachRulesIdx === -1 || operatingIdx === -1) throw new Error('one of the anchor headings is missing');
  return headingIdx > reachRulesIdx && headingIdx < operatingIdx;
});

check('A3 cites Theo ch04 Trend Analysis & S-Curves', function () {
  const t = sectionText();
  return t.indexOf('Theo ch04') !== -1 && t.indexOf('Trend Analysis & S-Curves') !== -1;
});

check('A4 item (a) Un-Defined rung', function () {
  const t = sectionText();
  return t.indexOf('Un-Defined') !== -1 && t.indexOf('what is the future of X') !== -1;
});

check('A5 item (b) PEST sequence', function () {
  const t = sectionText();
  return t.indexOf('PEST -> S-Curve Analysis -> Dominant Design -> Reverse Salient Analysis') !== -1;
});

check('A6 item (c) era-of-ferment tells', function () {
  const t = sectionText().toLowerCase();
  return ['era of ferment', 'rival architectures', 'metric', 'switching is still cheap', 'several different lagging components']
    .every(function (needle) { return t.indexOf(needle) !== -1; });
});

check('A7 item (d) locked-design tells', function () {
  const t = sectionText().toLowerCase();
  return ['interface stopped changing', 'built on top', 'switching costs', 'technological momentum', 'exactly one lagging component']
    .every(function (needle) { return t.indexOf(needle) !== -1; });
});

check('A8 item (e) payoff', function () {
  return sectionText().indexOf('worth attacking yet') !== -1;
});

check('A9 offer rules (361 D-03, D-12)', function () {
  const t = sectionText();
  return ['Offer the quick pass first', 'sourced evidence', 'query gate', 'web calls', 'Never auto-run research', 'Unattended runs take the quick pass']
    .every(function (needle) { return t.indexOf(needle) !== -1; });
});

check('A10 surfacing mechanics (SENS-09, brain_consult, turns 1-2, resolver)', function () {
  const t = sectionText();
  return t.indexOf('SENS-09') !== -1 && t.indexOf('`brain_consult`') !== -1 && t.indexOf('turns 1-2') !== -1 &&
    t.indexOf('commandsForFramework("Dominant Design")') !== -1;
});

check('A11 NAV-2 corrected Theo graph note', function () {
  const t = sectionText();
  const hasAll = ['FEEDS_INTO', 'S-Curve Analysis -> Dominant Design', 'Dominant Design -> Reverse Salient Analysis', 'Theo Phase 20.3']
    .every(function (needle) { return t.indexOf(needle) !== -1; });
  const forbidden = /no ADDRESSES_PROBLEM_TYPE|no FEEDS_INTO|lacks? (?:any )?FEEDS_INTO|lacks? (?:an? )?ADDRESSES_PROBLEM_TYPE/i;
  return hasAll && !forbidden.test(t);
});

check('A12 drift-trap guard: only reach-id backtick spans carry an underscore', function () {
  const t = sectionText();
  const codeSpanRx = /`([a-z][a-z0-9_]*)`/g;
  let m;
  while ((m = codeSpanRx.exec(t)) !== null) {
    const tok = m[1];
    if (tok.indexOf('_') !== -1 && CANONICAL_REACH_IDS.indexOf(tok) === -1) {
      throw new Error('non-reach-id underscore backtick span: `' + tok + '`');
    }
  }
  return true;
});

check('A13 no em-dash or en-dash characters in the section', function () {
  const t = sectionText();
  return t.indexOf('\u2014') === -1 && t.indexOf('\u2013') === -1;
});

// ---------------------------------------------------------------------------
// Group B -- SENS-09 dominant-design branch
// ---------------------------------------------------------------------------

let diffusionMod = null;
try {
  diffusionMod = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-diffusion-adoption.cjs'));
} catch (e) {
  diffusionMod = null;
}

let insightSensorsMod = null;
try {
  insightSensorsMod = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
} catch (e) {
  insightSensorsMod = null;
}

function dispatchSensors(turn, tuple, ctx) {
  if (!insightSensorsMod || typeof insightSensorsMod.dispatchSensors !== 'function') {
    throw new Error('insight-sensors.cjs dispatchSensors failed to load');
  }
  return insightSensorsMod.dispatchSensors(turn, tuple, ctx);
}

function sensorDiffusionAdoption(turn, tuple, ctx) {
  if (!diffusionMod || typeof diffusionMod.sensorDiffusionAdoption !== 'function') {
    throw new Error('sensor-diffusion-adoption.cjs sensorDiffusionAdoption failed to load');
  }
  return diffusionMod.sensorDiffusionAdoption(turn, tuple, ctx);
}

function classifyDominantDesign(text) {
  if (!diffusionMod || typeof diffusionMod.classifyDominantDesign !== 'function') {
    throw new Error('classifyDominantDesign is not exported yet');
  }
  return diffusionMod.classifyDominantDesign(text);
}

const EBIKE_TEXT = 'everyone in e-bikes is converging on the same frame design, which one wins?';
const BREAD_TEXT = 'we sell artisanal sourdough bread, help me price the loaf';

function ebikeDominantDesignMatches(ctx) {
  const reaches = dispatchSensors({ text: EBIKE_TEXT, signals: [] }, { problem_type: 'UDP' }, ctx || { turn_count: 5 });
  return reaches.filter(function (r) { return r.dispatch === 'dominant-design'; });
}

// B1 -- e-bike surfaces exactly one dominant-design reach at turn 5
check('B1 exactly one dominant-design reach fires on the e-bike turn', function () {
  return ebikeDominantDesignMatches().length === 1;
});
check('B1 reach_id is brain_consult', function () {
  return ebikeDominantDesignMatches()[0].reach_id === 'brain_consult';
});
check('B1 posture is push_forward', function () {
  return ebikeDominantDesignMatches()[0].posture === 'push_forward';
});
check('B1 signal is dominant_design_detected', function () {
  return ebikeDominantDesignMatches()[0].signal === 'dominant_design_detected';
});
check('B1 evidence.sensor_id is SENS-09', function () {
  return ebikeDominantDesignMatches()[0].evidence.sensor_id === 'SENS-09';
});
check('B1 evidence.framework is dominant-design', function () {
  return ebikeDominantDesignMatches()[0].evidence.framework === 'dominant-design';
});
check('B1 evidence.mode is keyword', function () {
  return ebikeDominantDesignMatches()[0].evidence.mode === 'keyword';
});
check('B1 evidence.design_state is convergence', function () {
  return ebikeDominantDesignMatches()[0].evidence.design_state === 'convergence';
});
check('B1 evidence.problem_type is UDP', function () {
  return ebikeDominantDesignMatches()[0].evidence.problem_type === 'UDP';
});
check('B1 companions deep-equal []', function () {
  const c = ebikeDominantDesignMatches()[0].companions;
  return Array.isArray(c) && c.length === 0;
});

// B2 -- resolver path: dispatch map -> framework name -> allowlist -> commandsForFramework
check('B2 resolver path: dominant-design -> Dominant Design -> allowlist -> commandsForFramework', function () {
  const dmap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'dispatch-framework-map.json'), 'utf8'));
  const mapped = dmap['dominant-design'] === 'Dominant Design';
  const fnames = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'framework-names.json'), 'utf8'));
  const allNames = (fnames.framework_names || []).concat(fnames.curated_extras || []);
  const inAllowlist = allNames.indexOf('Dominant Design') !== -1;
  const resolver = require(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
  const cmds = resolver.commandsForFramework('Dominant Design');
  const resolves = Array.isArray(cmds) && cmds.indexOf('/mos:dominant-designs') !== -1;
  if (!mapped) throw new Error('dispatch-framework-map.json has no dominant-design -> Dominant Design entry yet');
  if (!inAllowlist) throw new Error('Dominant Design missing from framework-names.json allowlist');
  if (!resolves) throw new Error('commandsForFramework("Dominant Design") does not include /mos:dominant-designs');
  return true;
});

// B3 -- unrelated turn: no dominant-design reach, no SENS-09 reach (already GREEN: proves the negative is live)
check('B3 unrelated turn (sourdough bread) surfaces no dominant-design or SENS-09 reach', function () {
  const reaches = dispatchSensors({ text: BREAD_TEXT, signals: [] }, { problem_type: 'well-defined' }, { turn_count: 5 });
  const hasDominantDesign = reaches.some(function (r) { return r.dispatch === 'dominant-design'; });
  const hasSens09 = reaches.some(function (r) { return r.evidence && r.evidence.sensor_id === 'SENS-09'; });
  return !hasDominantDesign && !hasSens09;
});

// B4 -- tell families (via classifyDominantDesign directly and via sensorDiffusionAdoption)
const TELL_FAMILIES = [
  ['directed-energy weapons against drones: four rival architectures, and nobody agrees which metric decides the winner', 'ferment'],
  ['the interface stopped changing years ago and the fight has moved entirely to what gets built on top of it', 'locked'],
  ['switching from one approach to another is still cheap', 'ferment'],
  ['the old standard is visibly cracking', 'ferment'],
  ['switching costs hardened all around it', 'locked'],
  ['there is exactly one lagging component everyone is racing to fix', 'locked'],
  ['several, different lagging components depending on the architecture', 'ferment'],
  ['has the market settled on a dominant design yet?', 'convergence'],
  ['which standard will win?', 'convergence'],
  ['the industry finally agreed on a standard', 'convergence'],
];

TELL_FAMILIES.forEach(function (pair, idx) {
  const text = pair[0];
  const expected = pair[1];
  check('B4.' + (idx + 1) + ' classifyDominantDesign(' + JSON.stringify(text.slice(0, 40)) + '...) === ' + expected, function () {
    return classifyDominantDesign(text) === expected;
  });
  check('B4.' + (idx + 1) + ' sensorDiffusionAdoption routes the same text to dominant-design/' + expected, function () {
    const r = sensorDiffusionAdoption({ text: text, signals: [] }, {}, {});
    return !!r && r.dispatch === 'dominant-design' && r.evidence.design_state === expected;
  });
});

check('B4 DOMINANT_DESIGN_STATES deep-equals [ferment, locked, convergence]', function () {
  if (!diffusionMod || !Array.isArray(diffusionMod.DOMINANT_DESIGN_STATES)) throw new Error('DOMINANT_DESIGN_STATES is not exported yet');
  const got = diffusionMod.DOMINANT_DESIGN_STATES;
  const want = ['ferment', 'locked', 'convergence'];
  return got.length === want.length && got.every(function (v, i) { return v === want[i]; });
});

// B5 -- near-miss negatives: classifyDominantDesign returns ''
const NEAR_MISSES = [
  'which one wins the bake-off?',
  'the predominant designation for this role',
  'we built the app on top of the old CRM',
  'where is solar on its S-curve?',
  'our design team keeps cracking jokes',
  'switching to the cheap plan saved money',
  'the interface froze when I clicked save',
  'we have two competing designs for the logo',
  'help me write a pitch email to an investor',
];

NEAR_MISSES.forEach(function (text, idx) {
  check('B5.' + (idx + 1) + ' near-miss returns empty: ' + JSON.stringify(text), function () {
    return classifyDominantDesign(text) === '';
  });
});

// B6 -- turn-stage doctrine alignment: turns 1-2 suppress brain_consult, turn 5 unlocks it
check('B6 turn-stage gate: turn_count 1 suppresses, turn_count 5 allows the dominant-design reach', function () {
  const at1 = ebikeDominantDesignMatches({ turn_count: 1 });
  const at5 = ebikeDominantDesignMatches({ turn_count: 5 });
  return at1.length === 0 && at5.length === 1;
});

// B7 -- ACE regression and precedence
check('B7.1 ACE keyword still fires adoption-capacity (dual-use drone swarm, no dominant-design tell)', function () {
  const r = sensorDiffusionAdoption({ text: 'a dual-use drone swarm for the navy', signals: [] }, { problem_type: 'WDP' }, {});
  return !!r && r.dispatch === 'adoption-capacity';
});
check('B7.2 ACE signal tier outranks the dominant-design keyword branch', function () {
  const r = sensorDiffusionAdoption({ text: EBIKE_TEXT, signals: ['diffusion_detected'] }, { problem_type: 'UDP' }, {});
  return !!r && r.dispatch === 'adoption-capacity';
});
check('B7.3 ACE context tier outranks the dominant-design keyword branch', function () {
  const r = sensorDiffusionAdoption({ text: EBIKE_TEXT, signals: [] }, { problem_type: 'diffusion' }, {});
  return !!r && r.dispatch === 'adoption-capacity';
});
check('B7.4 dominant-design branch outranks the ACE keyword fallback (directed-energy text)', function () {
  const r = sensorDiffusionAdoption({ text: TELL_FAMILIES[0][0], signals: [] }, { problem_type: 'WDP' }, {});
  return !!r && r.dispatch === 'dominant-design';
});

// B8 -- Part 8: evidence carries only scalars, no whitespace, no matched prose
check('B8 Part 8: evidence is scalar-only, no whitespace, no leaked prose', function () {
  const r = ebikeDominantDesignMatches()[0];
  const evidence = r.evidence;
  for (const k of Object.keys(evidence)) {
    const v = evidence[k];
    const t = typeof v;
    if (!(v === null || t === 'string' || t === 'number' || t === 'boolean')) {
      throw new Error('evidence.' + k + ' is not a scalar/null');
    }
    if (t === 'string' && /\s/.test(v)) {
      throw new Error('evidence.' + k + ' ("' + v + '") contains whitespace');
    }
  }
  // Scan VALUES only (never the JSON keys): the legitimate generic field name
  // "framework" itself contains the substring "frame" and must not false-fire
  // this leaked-prose check.
  const valuesBlob = [r.reach_id, r.posture, r.dispatch, r.signal]
    .concat(Object.values(evidence))
    .filter(function (v) { return typeof v === 'string'; })
    .join('|');
  return valuesBlob.indexOf('e-bike') === -1 && valuesBlob.indexOf('frame') === -1;
});

// B9 -- regex time bound on a long unpunctuated string
check('B9 classifyDominantDesign classifies a 20,000-word turn within 250ms', function () {
  const words = 'switching interface design standard converging which '.repeat(20000 / 7);
  const start = Date.now();
  classifyDominantDesign(words);
  const elapsed = Date.now() - start;
  if (elapsed > 250) throw new Error('took ' + elapsed + 'ms, over the 250ms bound');
  return true;
});

// ---------------------------------------------------------------------------
// Group C -- connector wiring
// ---------------------------------------------------------------------------

check('C1 commands/dominant-designs.md claims SENS-06 and SENS-09', function () {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'dominant-designs.md'), 'utf8');
  return src.indexOf('sensor_triggers: [SENS-06, SENS-09]') !== -1;
});

check('C2 connector-registry.json has SENS-09 wired to /mos:dominant-designs', function () {
  const reg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'connector-registry.json'), 'utf8'));
  const connector = (reg.connectors || []).find(function (c) { return c.surface === '/mos:dominant-designs'; });
  if (!connector) throw new Error('no connector for /mos:dominant-designs');
  const triggers = connector.sensor_triggers || [];
  const triggersMatch = triggers.length === 2 && triggers[0] === 'SENS-06' && triggers[1] === 'SENS-09';
  const reachIdOk = connector.reach_id === 'context_block';
  const indexOk = Array.isArray(reg.sensor_index && reg.sensor_index['SENS-09']) &&
    reg.sensor_index['SENS-09'].indexOf('/mos:dominant-designs') !== -1;
  if (!triggersMatch) throw new Error('connector.sensor_triggers is ' + JSON.stringify(triggers));
  if (!reachIdOk) throw new Error('connector.reach_id is ' + connector.reach_id);
  if (!indexOk) throw new Error('sensor_index.SENS-09 does not include /mos:dominant-designs');
  return true;
});

check('C3 brain-orchestration-projection.json node carries SENS-09', function () {
  const proj = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'brain-orchestration-projection.json'), 'utf8'));
  const node = (proj.nodes || []).find(function (n) { return n.id === 'command:/mos:dominant-designs'; });
  if (!node) throw new Error('no projection node command:/mos:dominant-designs');
  const triggersOk = Array.isArray(node.sensor_triggers) && node.sensor_triggers.indexOf('SENS-09') !== -1;
  const provOk = node.chain_provenance && Array.isArray(node.chain_provenance.firing_sensors) &&
    node.chain_provenance.firing_sensors.indexOf('SENS-09') !== -1;
  if (!triggersOk) throw new Error('node.sensor_triggers does not include SENS-09');
  if (!provOk) throw new Error('node.chain_provenance.firing_sensors does not include SENS-09');
  return true;
});

check('C4 skills/dominant-designs/SKILL.md mirror stays desensitized ([])', function () {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'dominant-designs', 'SKILL.md'), 'utf8');
  return src.indexOf('sensor_triggers: []') !== -1;
});

// ---------------------------------------------------------------------------
// Group D -- counter-metric honesty
// ---------------------------------------------------------------------------

check('D1 SENS-09 counter-metric record names Dominant Design honestly', function () {
  const priority = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-priority.cjs'));
  const record = (priority.SENS_PRIORITY || []).find(function (r) { return r.id === 'SENS-09'; });
  if (!record) throw new Error('no SENS-09 record in SENS_PRIORITY');
  const optimizesOk = typeof record.optimizes === 'string' && record.optimizes.indexOf('Dominant Design') !== -1;
  const watchedByOk = typeof record.watched_by === 'string' && record.watched_by.length > 0;
  if (!optimizesOk) throw new Error('optimizes does not name Dominant Design: ' + record.optimizes);
  if (!watchedByOk) throw new Error('watched_by is empty');
  return true;
});

// ---------------------------------------------------------------------------
// Tally
// ---------------------------------------------------------------------------

console.log('');
Object.keys(groupTally).sort().forEach(function (letter) {
  const t = groupTally[letter];
  console.log('Group ' + letter + ': ' + t.pass + ' pass, ' + t.fail + ' fail');
});

if (fail > 0) {
  console.log('\nFAIL ' + fail + ' of ' + (pass + fail));
  process.exit(1);
} else {
  console.log('\nPASS ' + pass + ' assertions');
  process.exit(0);
}
