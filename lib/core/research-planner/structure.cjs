'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/research-planner/structure.cjs -- Phase 363 Plan 10 (DRP363-12,
 * DRP363-20; D-02b, D-09, D-17, D-19).
 *
 * The planner's local reads of the shipped research-shape ledger
 * (data/research-shape-ledger.json, built at dev time from anchored graph
 * reads and capped by the 2026-09-17 IP ruling). Plain English: the graph
 * already knows which frameworks fit which kind of question and in what
 * order; we shipped that knowledge as data, so every surface reads it
 * offline, keyless, and without sending anything anywhere.
 *
 *   loadLedger(path?)      read the ledger once, cache it
 *   detectScientific(o)    is this scientific research? signals S1, S2, S5
 *   structureFor(o)        Logic Trees and Scientific Roadmapping steps
 *   plannersForRoom(o)     which planner templates fit the room, in order
 *   nextFramework(o)       weakest branch lens -> next framework + command
 *   lensSelection(o)       when the diffusion lens joins the plan (D-19)
 *   refreshLive(o)         optional live re-read, handles only, named source
 *
 * Everything except refreshLive is local: no network, no Brain call, no
 * clock. No function accepts the navigator's free text, so no keyword
 * classifier can run (AMB-07, T-363-26). The rung is read silently from the
 * room and never appears in any human-facing string this module returns.
 *
 * Hyphens only: no em-dash or en-dash.
 */

const fs = require('node:fs');
const path = require('node:path');

const Q = require('./question-templates.cjs');

const DEFAULT_LEDGER_PATH = path.join(__dirname, '..', '..', '..', 'data', 'research-shape-ledger.json');
const ADOPTION_FRAMEWORK = 'Adoption-Capacity Theory';
const RUNGS = Object.freeze(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']);
const RESEARCHER_ROLES = Object.freeze(['researcher', 'researcher_ind']);

let _ledger = null;
let _ledgerPath = null;

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function arr(v) { return Array.isArray(v) ? v : []; }

function loadLedger(p) {
  const target = (typeof p === 'string' && p) ? p : DEFAULT_LEDGER_PATH;
  if (_ledger && _ledgerPath === target) return _ledger;
  const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
  if (!isObj(parsed) || !isObj(parsed.frameworks)) throw new Error('research_shape_ledger_malformed');
  _ledger = parsed;
  _ledgerPath = target;
  return _ledger;
}

function ledgerOrNull() {
  try { return loadLedger(); } catch (_e) { return null; }
}

function fw(ledger, name) {
  return (ledger && isObj(ledger.frameworks) && isObj(ledger.frameworks[name])) ? ledger.frameworks[name] : null;
}

function ledgerReason(ledger) {
  const b = (ledger && ledger.built_from) || {};
  return 'Built from the research-shape ledger captured ' + b.captured_at + ' (' + b.source + ').';
}

// ---------------------------------------------------------------------------
// Room reads (local)
// ---------------------------------------------------------------------------
function roleSignal(roomDir) {
  if (typeof roomDir !== 'string' || !roomDir) return false;
  try {
    // eslint-disable-next-line global-require
    const userMdOps = require('../user-md-ops.cjs');
    const u = userMdOps.readUserMd(path.join(roomDir, 'USER.md'));
    if (!u) return false;
    if (RESEARCHER_ROLES.indexOf(u.canonical_role) !== -1) return true;
    const blend = isObj(u.role_blend) ? u.role_blend : {};
    let best = null;
    let bestW = 0;
    Object.keys(blend).sort().forEach(function (k) {
      const w = blend[k];
      if (typeof w === 'number' && Number.isFinite(w) && w > bestW) { best = k; bestW = w; }
    });
    return best !== null && RESEARCHER_ROLES.indexOf(best) !== -1;
  } catch (_e) { return false; }
}

function resolveRung(roomDir) {
  if (typeof roomDir !== 'string' || !roomDir) return { rung: null, source: 'none' };
  try {
    // eslint-disable-next-line global-require
    const framing = require('../ambient-framing.cjs');
    const r = framing.resolveRoomRung(roomDir);
    if (r && RUNGS.indexOf(r.rung) !== -1) return { rung: r.rung, source: r.source };
    return { rung: null, source: (r && r.source) || 'none' };
  } catch (_e) { return { rung: null, source: 'none' }; }
}

function hasTimingArtifact(roomDir) {
  if (typeof roomDir !== 'string' || !roomDir) return false;
  function walk(dir, depth) {
    if (depth > 4) return false;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return false; }
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i];
      if (!e.isDirectory() || e.name.charAt(0) === '.' || e.name === 'node_modules') continue;
      const abs = path.join(dir, e.name);
      if (e.name === 'timing') {
        try { if (fs.readdirSync(abs).some(function (n) { return n.charAt(0) !== '.' && n !== 'ROOM.md'; })) return true; } catch (_e) { /* next */ }
      }
      if (walk(abs, depth + 1)) return true;
    }
    return false;
  }
  return walk(roomDir, 0);
}

// ---------------------------------------------------------------------------
// detectScientific: S1 (template framework in the scientific set, or the
// scientific-roadmapping template), S2 (researcher role), S5 (navigator
// toggle). Reads only the three named keys; any other property, including a
// stated question, is ignored by construction.
// ---------------------------------------------------------------------------
function detectScientific(opts) {
  const o = isObj(opts) ? opts : {};
  const templateId = o.templateId;
  const roomDir = o.roomDir;
  const navigatorToggle = o.navigatorToggle;
  const signals = [];
  const ledger = ledgerOrNull();
  const tpl = (typeof templateId === 'string' && Q.TEMPLATES[templateId]) ? Q.TEMPLATES[templateId] : null;
  if (templateId === 'scientific-roadmapping') signals.push('S1');
  else if (tpl && ledger && arr(ledger.scientific_set).indexOf(tpl.framework) !== -1) signals.push('S1');
  if (roleSignal(roomDir)) signals.push('S2');
  if (navigatorToggle === true) signals.push('S5');
  return { scientific: signals.length > 0, signals: signals };
}

// ---------------------------------------------------------------------------
// structureFor
// ---------------------------------------------------------------------------
function structureFor(opts) {
  const o = isObj(opts) ? opts : {};
  const ledger = ledgerOrNull();
  const tpl = (typeof o.templateId === 'string' && Q.TEMPLATES[o.templateId]) ? Q.TEMPLATES[o.templateId] : null;
  const treeHint = o.rung === 'WellDefined' ? 'hypothesis' : null;
  const scientific = o.scientific === true;
  const lt = ledger ? fw(ledger, 'Logic Trees (Issue, Hypothesis, Decision)') : null;

  if (!scientific || !ledger || !lt || arr(lt.steps).length === 0) {
    const local = tpl ? tpl.dimensions.map(function (d, i) { return { order: i + 1, name: d.label, dimension: d.id }; }) : [];
    return {
      source: 'local_template',
      reason: !scientific ? 'This question is not structured as scientific research.'
        : 'The shipped ledger holds no Logic Trees steps; the local template is used.',
      scientific: false,
      tree_type_hint: treeHint,
      steps: local,
    };
  }

  const out = {
    source: 'theo_ledger',
    reason: ledgerReason(ledger),
    scientific: true,
    tree_type_hint: treeHint,
    logic_trees_steps: arr(lt.steps).map(function (s) { return { order: s.order, name: s.name }; }),
  };
  const engine = o.engine === 'scientific-roadmapping' || o.templateId === 'scientific-roadmapping';
  if (engine) {
    const sr = fw(ledger, 'Scientific Roadmapping');
    if (sr && arr(sr.steps).length > 0) {
      out.frameworks = {
        'Scientific Roadmapping': {
          steps: sr.steps.map(function (s) {
            return { order: s.order, name: s.name, key_question: s.key_question, gates: arr(s.gates).slice() };
          }),
        },
      };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// plannersForRoom: templates offered by relevance to the silently classified
// rung, in ledger FEEDS_INTO order (a template whose framework feeds another
// offered template's framework comes first), then template order. A template
// whose framework carries no problem-type edge in the ledger fits any room
// and is listed after the ones that name the room's rung.
// ---------------------------------------------------------------------------
function plannersForRoom(opts) {
  const o = isObj(opts) ? opts : {};
  const ledger = ledgerOrNull();
  if (!ledger) return { planners: [], source: 'none', reason: 'The shipped ledger could not be read.' };
  const resolved = (typeof o.rung === 'string' && RUNGS.indexOf(o.rung) !== -1)
    ? { rung: o.rung, source: 'given' } : resolveRung(o.roomDir);
  const rung = resolved.rung;
  const shape = rung && isObj(ledger.shapes) ? ledger.shapes[rung] : null;

  const rows = [];
  Q.PLANNER_TEMPLATE_IDS.forEach(function (id, idx) {
    const t = Q.TEMPLATES[id];
    if (t.explicit_only) return;
    const f = fw(ledger, t.framework);
    const types = f ? arr(f.problem_types) : [];
    let fit;
    if (!rung) fit = 'any';
    else if (types.indexOf(rung) !== -1) fit = 'named';
    else if (types.length === 0) fit = 'any';
    else return;
    rows.push({ id: id, idx: idx, fit: fit, framework: t.framework, t: t });
  });

  // Kahn ordering: FEEDS_INTO edges between offered frameworks, template order tie-break.
  const remaining = rows.slice();
  const ordered = [];
  while (remaining.length > 0) {
    let pick = -1;
    for (let i = 0; i < remaining.length && pick === -1; i += 1) {
      const cand = remaining[i];
      const blocked = remaining.some(function (other) {
        if (other === cand) return false;
        const of = fw(ledger, other.framework);
        return of && arr(of.feeds_into).indexOf(cand.framework) !== -1
          && !(fw(ledger, cand.framework) && arr(fw(ledger, cand.framework).feeds_into).indexOf(other.framework) !== -1);
      });
      if (!blocked) pick = i;
    }
    if (pick === -1) pick = 0;
    ordered.push(remaining.splice(pick, 1)[0]);
  }
  ordered.sort(function (a, b) {
    if (a.fit !== b.fit) return a.fit === 'named' ? -1 : 1;
    return 0;
  });

  const planners = ordered.map(function (r) {
    return {
      template_id: r.id,
      doors: r.t.doors.slice(),
      framework: r.framework,
      shape: shape ? shape.shape : null,
      default_mode: shape ? shape.default_mode : 'quick',
      reason: r.fit === 'named'
        ? r.framework + ' is one of the frameworks the graph offers for a question framed like this room\'s.'
        : r.framework + ' is not tied to one kind of question in the graph, so it fits this room too.',
    };
  });
  return { planners: planners, source: 'theo_ledger', rung_source: resolved.source, reason: ledgerReason(ledger) };
}

// ---------------------------------------------------------------------------
// nextFramework: the weakest branch's lens framework, mapped through the
// ledger's FEEDS_INTO edges, filtered to frameworks that address the rung,
// resolved to a command by the one framework-to-command door.
// ---------------------------------------------------------------------------
function nextFramework(opts) {
  const o = isObj(opts) ? opts : {};
  const ledger = ledgerOrNull();
  if (!ledger) return { none: true, reason: 'ledger_unavailable' };
  if (typeof o.rung !== 'string' || RUNGS.indexOf(o.rung) === -1) return { none: true, reason: 'rung_unknown' };
  const src = fw(ledger, o.lensFramework);
  if (!src) return { none: true, reason: 'no_feeds_into_for_rung' };
  const addressing = arr(ledger.problem_types && ledger.problem_types[o.rung] && ledger.problem_types[o.rung].frameworks);
  const candidates = arr(src.feeds_into).filter(function (g) { return addressing.indexOf(g) !== -1; });
  if (candidates.length === 0) return { none: true, reason: 'no_feeds_into_for_rung' };
  // eslint-disable-next-line global-require
  const resolver = require('../../workflow/command-resolver.cjs');
  for (let i = 0; i < candidates.length; i += 1) {
    const cmds = resolver.commandsForFramework(candidates[i]);
    if (cmds.length > 0) {
      return { none: false, framework: candidates[i], command: cmds[0], commands: cmds.slice(), source: 'theo_ledger', reason: ledgerReason(ledger) };
    }
  }
  return {
    none: false, framework: candidates[0], command: null, commands: [], source: 'theo_ledger',
    reason: 'The graph names this framework next, but no command runs it yet.',
  };
}

// ---------------------------------------------------------------------------
// lensSelection (D-19): the diffusion lens joins the plan for a named
// reason. Local. Nothing about the question is read or sent.
//   navigator_toggle > larry (needs a reason) > room_signal >
//   ledger_feeds_into > sr_step
// ---------------------------------------------------------------------------
function lensSelection(opts) {
  const o = isObj(opts) ? opts : {};
  const ledger = ledgerOrNull();
  const fired = [];
  const refused = [];
  const reasons = {};

  if (o.navigatorToggle === true) { fired.push('navigator_toggle'); reasons.navigator_toggle = 'The navigator asked for the diffusion lens.'; }

  const req = isObj(o.requested) ? o.requested : null;
  if (req && req.lens === 'diffusion') {
    if (typeof req.reason === 'string' && req.reason.trim().length > 0) {
      fired.push('larry');
      reasons.larry = req.reason.trim().slice(0, 140);
    } else {
      refused.push({ lens: 'diffusion', reason: 'reason_required' });
    }
  }

  if (hasTimingArtifact(o.roomDir)) { fired.push('room_signal'); reasons.room_signal = 'The room holds a timing or diffusion artifact.'; }

  if (ledger && o.templateId !== 'diffusion') {
    const act = fw(ledger, ADOPTION_FRAMEWORK);
    const fedBy = act ? arr(act.fed_by) : [];
    const hit = arr(o.frameworks).filter(function (n) { return fedBy.indexOf(n) !== -1; });
    if (hit.length > 0) { fired.push('ledger_feeds_into'); reasons.ledger_feeds_into = hit[0] + ' feeds into ' + ADOPTION_FRAMEWORK + ' in the graph.'; }
  }

  const chains = isObj(o.perspective) ? arr(o.perspective.unlock_chains) : [];
  const adoptionStep = chains.some(function (c) {
    return isObj(c) && arr(c.steps).some(function (s) { return isObj(s) && s.kind === 'adoption'; });
  });
  if (adoptionStep) { fired.push('sr_step'); reasons.sr_step = 'A roadmap unlock chain has an adoption step.'; }

  if (fired.length === 0) return { selected: [], refused: refused };
  return {
    selected: [{ lens: 'diffusion', source: fired[0], reason: reasons[fired[0]], signals: fired.slice() }],
    refused: refused,
  };
}

// ---------------------------------------------------------------------------
// refreshLive: optional re-read of the graph through the guarded client.
// Only framework names and problem-type ids cross, as bound parameters, in
// plain anchored MATCH reads. A miss falls back to the shipped ledger with
// the reason named.
// ---------------------------------------------------------------------------
async function refreshLive(opts) {
  const o = isObj(opts) ? opts : {};
  const ledger = ledgerOrNull();
  const fallback = function (reason) { return { source: 'theo_ledger', reason: reason }; };
  if (!ledger) return fallback('ledger_unavailable');
  let client = o.brainClient;
  if (!client) {
    try {
      // eslint-disable-next-line global-require
      client = require('../brain-client.cjs');
    } catch (_e) { return fallback('brain_unavailable'); }
  }
  if (!client || typeof client.query !== 'function') return fallback('brain_unavailable');

  const LT = 'Logic Trees (Issue, Hypothesis, Decision)';
  const SR = 'Scientific Roadmapping';
  const stepsCypher = 'MATCH (f:Framework {name:$n})-[:HAS_PROCESS_STEP]->(s) RETURN s.order AS ord, s.name AS name, s.key_question AS key_question, s.gates AS gates';
  const feedsCypher = 'MATCH (f:Framework {name:$n})-[:FEEDS_INTO]->(g:Framework) RETURN g.name AS name';
  const ptCypher = 'MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(p:DomainConcept {id:$pt}) RETURN f.name AS name';

  async function run(cypher, params) {
    const res = await client.query(cypher, params);
    if (res === null || res === undefined) { const e = new Error('brain_unavailable'); e.reason = 'brain_unavailable'; throw e; }
    const disp = res.egress_disclosure && res.egress_disclosure.disposition;
    if (disp === 'blocked') { const e = new Error('egress_blocked'); e.reason = 'egress_blocked'; throw e; }
    const rows = Array.isArray(res) ? res : res.records;
    if (!Array.isArray(rows)) { const e = new Error('read_failed'); e.reason = 'read_failed'; throw e; }
    return rows;
  }

  const live = { logic_trees_steps: [], sr_steps: [], problem_types: {}, feeds_into: {} };
  try {
    const lt = await run(stepsCypher, { n: LT });
    live.logic_trees_steps = lt.map(function (r) { return { order: r.ord, name: r.name }; })
      .filter(function (s) { return typeof s.name === 'string'; }).sort(function (a, b) { return a.order - b.order; });
    const sr = await run(stepsCypher, { n: SR });
    live.sr_steps = sr.filter(function (r) { return typeof r.name === 'string'; }).map(function (r) {
      return {
        order: r.ord, name: r.name,
        key_question: typeof r.key_question === 'string' ? r.key_question.slice(0, 140) : null,
        gates: Array.isArray(r.gates) ? r.gates.filter(function (g) { return typeof g === 'string'; }).map(function (g) { return g.slice(0, 140); }) : [],
      };
    }).sort(function (a, b) { return a.order - b.order; });
    for (let i = 0; i < RUNGS.length; i += 1) {
      const rows = await run(ptCypher, { pt: RUNGS[i] });
      live.problem_types[RUNGS[i]] = rows.map(function (r) { return r.name; }).filter(function (n) { return typeof n === 'string'; });
    }
    const names = Object.keys(ledger.frameworks).sort();
    for (let j = 0; j < names.length; j += 1) {
      const rows = await run(feedsCypher, { n: names[j] });
      live.feeds_into[names[j]] = rows.map(function (r) { return r.name; }).filter(function (n) { return typeof n === 'string'; });
    }
  } catch (e) {
    return fallback(e && e.reason ? e.reason : 'read_failed');
  }
  return { source: 'theo_live', reason: 'live read through the guarded client, handles only', live: live };
}

module.exports = {
  loadLedger,
  detectScientific,
  structureFor,
  plannersForRoom,
  nextFramework,
  lensSelection,
  refreshLive,
};
