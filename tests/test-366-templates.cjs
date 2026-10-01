#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 04 (EPV366-05, EPV366-06, EPV366-08, EPV366-09; D-06, D-09,
 * D-10): the four new perspectives (rs, hsi, analogies, connections) carry a
 * question template, a falsifier on every researchable dimension and lenses
 * on the five frozen families; whitespace stays on its shipped template.
 *
 *   T1  TEMPLATES holds the seven shipped ids plus rs, hsi, analogies,
 *       connections, registered after eureka; whitespace is unchanged
 *       (pinned sha256 of its JSON form).
 *   T2  every new dimension: valid step, lens present in LENS_FAMILY whose
 *       family equals default_family, researchable ones carry
 *       falsifier_default and the named falsifier template of that family.
 *   T3  each new framework is an exact canon name from
 *       data/framework-names.json, and equals the door command's
 *       frontmatter frameworks value where a command file exists.
 *   T4  doors: find-bottlenecks -> rs, find-analogies -> analogies,
 *       find-connections -> connections, whitespace -> whitespace; hsi is
 *       explicit_only on /mos:scout hsi, so /mos:scout is never rerouted.
 *   T5  analogies declares statement_slots function, behavior, structure;
 *       no other template does, and none of them is a composer query slot.
 *   T6  rs leaves use {cause, effect} through causal-link and compose
 *       through composeForLeaf; opportunity rules use existing kinds.
 *
 * Pure: no room, no network. Hermetic HOME before any repo module loads.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-templates-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-templates-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-templates');

const Q = require(path.join(ROOT, 'lib/core/research-planner/question-templates.cjs'));
const F = require(path.join(ROOT, 'lib/core/research-planner/families.cjs'));

function assertTrue(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function leg(name, fn) {
  try { fn(); C.check(name, true); } catch (e) { C.check(name, false, String(e && e.message ? e.message : e).slice(0, 240)); }
}

const SEVEN = ['map-unknowns', 'root-cause', 'think-hats', 'whitespace', 'diffusion', 'scientific-roadmapping', 'eureka'];
const NEW = ['rs', 'hsi', 'analogies', 'connections'];
const STEPS = ['tension', 'goal', 'rung', 'forum', 'paths', 'limiters', 'ranking'];
const WHITESPACE_SHA = '51bdb0e5ae1921475536420c88379ab004f27c41e6b60dfefbf1cb7b6969e3a2';
const FALSIFIERS = {
  'rs:lagging_component': 'cl.break',
  'hsi:divergence': 'ce.counter',
  'an:structural_transfer': 'ce.counter',
  'cn:lateral_path': 'ce.counter',
};
const FRAMEWORKS = {
  rs: 'Reverse Salient Analysis',
  hsi: 'HSI Semantic Surprise Analysis Assistant',
  analogies: 'Four Lenses of Innovation',
  connections: "Usher's Model of Cumulative Synthesis",
};
const COMMAND_FILES = { rs: 'find-bottlenecks.md', analogies: 'find-analogies.md', connections: 'find-connections.md' };

leg('T1 eleven templates, new ids after eureka, whitespace unchanged', function () {
  assertTrue(JSON.stringify(Q.PLANNER_TEMPLATE_IDS) === JSON.stringify(SEVEN.concat(NEW)), 'ids ' + Q.PLANNER_TEMPLATE_IDS.join(','));
  const sha = crypto.createHash('sha256').update(JSON.stringify(Q.TEMPLATES.whitespace)).digest('hex');
  assertTrue(sha === WHITESPACE_SHA, 'whitespace template changed: ' + sha);
});

leg('T2 every new dimension has a lens on its family and a falsifier where researchable', function () {
  let seen = 0;
  NEW.forEach(function (id) {
    const t = Q.TEMPLATES[id];
    assertTrue(t && Array.isArray(t.dimensions) && t.dimensions.length > 0, id + ' dimensions');
    assertTrue(Array.isArray(t.lenses) && t.lenses.length > 0, id + ' lenses');
    t.lenses.forEach(function (l) { assertTrue(F.LENS_FAMILY[l], id + ' lens missing in LENS_FAMILY: ' + l); });
    t.dimensions.forEach(function (d) {
      seen += 1;
      assertTrue(STEPS.indexOf(d.perspective_step) !== -1, d.id + ' step');
      const lf = F.LENS_FAMILY[d.default_lens];
      assertTrue(lf, d.id + ' lens ' + d.default_lens + ' not in LENS_FAMILY');
      assertTrue(t.lenses.indexOf(d.default_lens) !== -1, d.id + ' lens not declared on the template');
      if (d.researchable) {
        assertTrue(typeof d.falsifier_default === 'string' && d.falsifier_default.length > 0, d.id + ' falsifier_default');
      }
      if (d.default_family !== null) {
        assertTrue(lf.family === d.default_family, d.id + ' lens family ' + lf.family + ' vs ' + d.default_family);
        assertTrue(d.falsifier_template === FALSIFIERS[d.id], d.id + ' falsifier ' + d.falsifier_template);
        const ids = F.FAMILIES[d.default_family].templates.map(function (x) { return x.id; });
        assertTrue(ids.indexOf(d.falsifier_template) !== -1, d.id + ' falsifier not in family');
      }
    });
    const known = t.dimensions.filter(function (d) { return /:already_known$/.test(d.id); })[0];
    assertTrue(known && known.local === true && known.perspective_step === 'tension' && known.researchable, id + ' already_known mirrors eu:already_known');
    (t.opportunity_rules || []).forEach(function (r) {
      assertTrue(t.dimensions.some(function (d) { return d.id === r.dimension; }), id + ' rule dimension');
    });
  });
  Object.keys(FALSIFIERS).forEach(function (k) {
    const owner = NEW.filter(function (id) { return Q.TEMPLATES[id].dimensions.some(function (d) { return d.id === k; }); });
    assertTrue(owner.length === 1, k + ' present once');
  });
  assertTrue(seen > 0, 'dimensions seen');
});

leg('T3 frameworks are exact canon names and match the door frontmatter', function () {
  const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/framework-names.json'), 'utf8')).framework_names;
  NEW.forEach(function (id) {
    const fw = Q.TEMPLATES[id].framework;
    assertTrue(fw === FRAMEWORKS[id], id + ' framework ' + fw);
    assertTrue(names.indexOf(fw) !== -1, id + ' framework not canon: ' + fw);
    if (COMMAND_FILES[id]) {
      const src = fs.readFileSync(path.join(ROOT, 'commands', COMMAND_FILES[id]), 'utf8');
      const m = src.match(/^frameworks:\s*\[\s*"([^"]+)"\s*\]/m);
      assertTrue(m && m[1] === fw, id + ' frontmatter frameworks');
    }
  });
  assertTrue(Q.templateForFramework('HSI Semantic Surprise Analysis Assistant').id === 'whitespace', 'whitespace still owns its framework lookup');
});

leg('T4 doors route to the new templates; hsi is explicit only', function () {
  assertTrue(Q.templateForCommand('/mos:find-bottlenecks').id === 'rs', 'find-bottlenecks');
  assertTrue(Q.templateForCommand('/mos:find-analogies').id === 'analogies', 'find-analogies');
  assertTrue(Q.templateForCommand('/mos:find-connections').id === 'connections', 'find-connections');
  assertTrue(Q.templateForCommand('/mos:whitespace').id === 'whitespace', 'whitespace');
  assertTrue(Q.templateForCommand('/mos:eureka').id === 'eureka', 'eureka');
  const h = Q.TEMPLATES.hsi;
  assertTrue(JSON.stringify(h.doors) === JSON.stringify(['/mos:scout hsi']) && h.explicit_only === true, 'hsi door and explicit_only');
  assertTrue(Q.templateForCommand('/mos:scout hsi') === null, '/mos:scout hsi not routed by command');
  assertTrue(Q.templateForCommand('/mos:scout') === null, '/mos:scout never rerouted');
  ['rs', 'analogies', 'connections'].forEach(function (id) { assertTrue(!Q.TEMPLATES[id].explicit_only, id + ' routable'); });
});

leg('T5 analogies declares the SAPPhIRE statement slots, never query slots', function () {
  const a = Q.TEMPLATES.analogies;
  assertTrue(JSON.stringify(a.statement_slots) === JSON.stringify(['function', 'behavior', 'structure']), 'statement_slots');
  Q.PLANNER_TEMPLATE_IDS.forEach(function (id) {
    if (id !== 'analogies') assertTrue(Q.TEMPLATES[id].statement_slots === undefined, id + ' carries no statement_slots');
    assertTrue(Q.TEMPLATES[id].recall_slots === undefined, id + ' carries no recall-time slots');
  });
  const ce = ['term', 'term2'];
  a.statement_slots.forEach(function (s) { assertTrue(ce.indexOf(s) === -1, s + ' is not a composer slot'); });
  const r = F.composeForLeaf({ lens: 'an.structure', slots: { function: 'x', behavior: 'y', structure: 'z' } });
  assertTrue(r.ok === false && r.reason === 'bad_slot', 'statement slots refused as query slots');
});

leg('T6 rs leaves use cause and effect through causal-link; rule kinds exist', function () {
  const lag = Q.TEMPLATES.rs.dimensions.filter(function (d) { return d.id === 'rs:lagging_component'; })[0];
  assertTrue(lag.default_family === 'causal-link/v1' && lag.default_lens === 'rs.lag', 'rs:lagging_component on causal-link');
  assertTrue(F.LENS_FAMILY['rs.lag'].family === 'causal-link/v1', 'rs.lag family');
  const ok = F.composeForLeaf({ lens: 'rs.lag', slots: { cause: 'battery chemistry', effect: 'vehicle range' } });
  assertTrue(ok.ok === true && ok.queries.length > 0, 'rs.lag composes with cause and effect');
  const bad = F.composeForLeaf({ lens: 'rs.lag', slots: { term: 'battery chemistry' } });
  assertTrue(bad.ok === false, 'rs.lag refuses a term slot');
  ['hsi.diverge', 'hsi.known', 'an.structure', 'an.known', 'cn.lateral', 'cn.known'].forEach(function (l) {
    assertTrue(F.LENS_FAMILY[l] && F.LENS_FAMILY[l].family === 'concept-evidence/v1', l + ' on concept-evidence');
  });
  assertTrue(F.LENS_FAMILY['rs.known'] && F.LENS_FAMILY['rs.known'].family === 'causal-link/v1', 'rs.known on causal-link');
  const rules = {
    rs: ['constraint_attack', 'rs:lagging_component'],
    hsi: ['mechanism_transfer', 'hsi:divergence'],
    analogies: ['mechanism_transfer', 'an:structural_transfer'],
    connections: ['cross_domain_transfer', 'cn:lateral_path'],
  };
  Object.keys(rules).forEach(function (id) {
    const r = Q.TEMPLATES[id].opportunity_rules;
    assertTrue(r.length === 1 && r[0].kind === rules[id][0] && r[0].dimension === rules[id][1], id + ' opportunity rule');
  });
  const famSrc = fs.readFileSync(path.join(ROOT, 'lib/core/research-planner/families.cjs'), 'utf8');
  assertTrue(Object.keys(F.FAMILIES).length === 5, 'five frozen families');
  assertTrue(/Phase 366/.test(famSrc) && /D-06/.test(famSrc), 'lens comment names Phase 366 and D-06');
  assertTrue(guard.attempts() === 0, 'no network');
});

const code = C.summary();
try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (e) { /* best effort */ }
process.exit(code);
