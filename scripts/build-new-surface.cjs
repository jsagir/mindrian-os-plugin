#!/usr/bin/env node
'use strict';

/*
 * Phase 167-04 Task 1 - the /mos:new-surface deterministic surface emitter +
 * connector-registry + harness-manifest regeneration + --check (HARN-03,
 * D-167-05, D-167-06).
 *
 * THE HARNESS-AS-CODE GENERATOR FOR SURFACES. Given a spec (a new command /
 * agent / skill), it emits the correct surface .md carrying the 11-key connector
 * frontmatter (the docs/CONNECTOR-CONTRACT.md contract: connects_to_spine,
 * sensor_triggers, reach_id, sub_mode, framework, posture, hierarchy_rank,
 * filing, plan_gated, web_scope, surface) so wiring is NEVER hand-written, then
 * regenerates the connector-registry (the surface's REAL home) and the
 * harness-manifest (whose wiring digest then reflects the new surface). A --check
 * gate proves the emitted surface is WELL-FORMED, REGISTERED in
 * connector-registry.json, and that the harness-manifest --check is clean.
 *
 * REUSE BEFORE BUILD (Canon Part 7): this MIRRORS the shipped generator idiom
 * (scripts/build-connector-registry.cjs main:594-662, the 11-key
 * CONNECTOR_KEYS:89-101; the Wave-1 scripts/build-harness-manifest.cjs --check
 * taxonomy) AND the /mos:new-project SCAFFOLD-BACKEND deterministic-emit PATTERN
 * (commands/new-project.md, the file-emission half ignite delegates to). It is
 * PATTERN reuse, not literal extension: new-project scaffolds a ROOM
 * (folders/sections/ROOM.md); /mos:new-surface scaffolds a SURFACE (a command /
 * agent / skill .md), a different artifact. /mos:ignite (the gate-orchestration
 * front door) is OUT of scope and untouched (D-167-05).
 *
 * TRANSITIVE LANDING, NOT A PER-SURFACE MANIFEST ROW (HIGH-1 reconciliation): a
 * new surface lands TRANSITIVELY. (1) emitSurface writes the surface .md with the
 * 11 connector keys; (2) it SHELLS OUT (execFileSync node, LOW-2 -- a fresh
 * process, never require()+internals, so there is no module-cache bleed and the
 * byte-stable serialize path each generator ships is used verbatim) to regenerate
 * scripts/build-connector-registry.cjs -> data/connector-registry.json (the
 * surface's real home -- this also closes MEDIUM-2: the staged commands/*.md
 * change is matched by a regenerated registry so the connector pre-commit --check
 * stays green); (3) it shells out to regenerate
 * scripts/build-harness-manifest.cjs -> data/harness-manifest.json (the wiring
 * digest + source_count update). The Wave-4 --check asserts (a) the surface .md
 * exists with all 11 connector keys validated against connector-registry (its
 * real home), and (b) build-harness-manifest.cjs --check is clean. It does NOT
 * assert a per-surface manifest entry, because none exists (D-166-03 inviolate).
 *
 * FROZEN BANKS: the emitted reach_id MUST be one of the frozen 6 (REACH_IDS) and
 * the posture one of the frozen 3 (POSTURE_IDS), required from the single frozen
 * source (lib/core/sensors/sensor-types.cjs). The generator mints NO new reach_id
 * -- a new tool identity rides sub_mode (a render label), never a 7th reach.
 *
 * Canon Part 8 (The Graph Boundary): the emitter is LOCAL machinery only. It
 * makes ZERO Brain calls and emits ONLY generic machinery metadata (a surface
 * slug + connector enums). There is no brain-client require, no fetch, no http.
 * The forbidden-token scan in tests/test-new-surface-generator.cjs proves it.
 *
 * Usage:
 *   node scripts/build-new-surface.cjs --spec <spec.json>
 *       read a spec file, emit the surface .md, then regenerate
 *       connector-registry.json + harness-manifest.json
 *   node scripts/build-new-surface.cjs --kind command --name foo --reach context_block ...
 *       emit from argv flags (one flag per connector key)
 *   node scripts/build-new-surface.cjs --check --name foo --kind command
 *       validate the named surface: WELL-FORMED (11 keys + frozen reach + frozen
 *       posture) + REGISTERED in connector-registry.json + harness-manifest
 *       --check clean ; exit 1 + a recovery line on any finding
 *   node scripts/build-new-surface.cjs --refresh --spec <spec.json>
 *       re-emit idempotently (byte-stable)
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// The frozen banks, required from the SINGLE frozen source so the emitter can
// NEVER drift from the dial doctrine. The emitter refuses an off-frozen reach_id
// or posture; it mints no new reach_id. This require is sync, zero-I/O, and makes
// ZERO Brain/network calls (Part 8).
const { REACH_IDS, POSTURE_IDS } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs')
);

// The 11 connector sub-keys, in the docs/CONNECTOR-CONTRACT.md order (mirrors
// build-connector-registry.cjs CONNECTOR_KEYS:89-101). The emitted frontmatter
// carries these keys IN THIS ORDER so the registry generator parses it
// identically to a hand-written connector block.
const CONNECTOR_KEYS = Object.freeze([
  'connects_to_spine',
  'sensor_triggers',
  'reach_id',
  'sub_mode',
  'framework',
  'posture',
  'hierarchy_rank',
  'filing',
  'plan_gated',
  'web_scope',
  'surface',
]);

const RECOVERY = 'Run: node scripts/build-new-surface.cjs';

// The Part 11 R16 EXEMPTION reason stamped onto every emitted expert skill. The
// emitted skills/<expert>/SKILL.md is a render-only capability lens (a pure
// persona that reaches NO Decision-Gate fork), so it is born EXCLUDED -- distinct
// from the born-WIRED commands/skill.md front door that materializes it.
const EXPERT_SKILL_REASON = 'render-only expert capability lens (Part 11 R16 exemption)';

// ---------------------------------------------------------------------------
// surfacePath(kind, name, outDir) -- the SURFACE artifact path (distinct from
// new-project's ROOM folders). A command -> commands/<name>.md ; an agent ->
// agents/<name>.md ; a skill -> skills/<name>/SKILL.md. outDir is the
// env-overridable base (MINDRIAN_SURFACE_OUT_DIR or the opts.outDir override) so
// a test emits to a tmp dir and never pollutes the real commands/ tree (LOW-5).
// ---------------------------------------------------------------------------
function surfacePath(kind, name, outDir) {
  const base = outDir || REPO_ROOT;
  if (kind === 'command') return path.join(base, 'commands', name + '.md');
  if (kind === 'agent') return path.join(base, 'agents', name + '.md');
  if (kind === 'skill') return path.join(base, 'skills', name, 'SKILL.md');
  throw new Error(
    'unknown surface kind "' + kind + '" (expected command | agent | skill). ' + RECOVERY
  );
}

// ---------------------------------------------------------------------------
// validateSpec(spec) -- structural + frozen-bank validation. Throws on any
// off-contract value: a missing connector key, an off-frozen reach_id (not in
// the 6), an off-frozen posture (not in the 3), or an unknown kind. This is the
// pre-emit guard (T-167-15): no off-frozen wiring ever reaches an emitted file.
// ---------------------------------------------------------------------------
function validateSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('spec must be an object. ' + RECOVERY);
  }
  if (typeof spec.kind !== 'string' || ['command', 'agent', 'skill'].indexOf(spec.kind) === -1) {
    throw new Error(
      'spec.kind must be one of command | agent | skill (got ' + JSON.stringify(spec.kind) + '). ' + RECOVERY
    );
  }
  if (typeof spec.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(spec.name)) {
    throw new Error(
      'spec.name must be a lowercase-slug string (got ' + JSON.stringify(spec.name) + '). ' + RECOVERY
    );
  }
  // The 11 connector keys must each be present on the spec (a value, including
  // null / false, is present; an absent key is a MISSING_KEY).
  for (const k of CONNECTOR_KEYS) {
    if (!(k in spec)) {
      throw new Error('spec is missing the connector key "' + k + '". ' + RECOVERY);
    }
  }
  // Frozen reach + posture. A new tool identity rides sub_mode, never a new reach.
  if (REACH_IDS.indexOf(spec.reach_id) === -1) {
    throw new Error(
      'spec.reach_id "' + spec.reach_id + '" is not in the frozen 6 (' +
        REACH_IDS.join(', ') + '). A new tool identity rides sub_mode, never a new reach_id. ' + RECOVERY
    );
  }
  if (POSTURE_IDS.indexOf(spec.posture) === -1) {
    throw new Error(
      'spec.posture "' + spec.posture + '" is not in the frozen 3 (' +
        POSTURE_IDS.join(', ') + '). ' + RECOVERY
    );
  }
}

// ---------------------------------------------------------------------------
// renderConnectorValue(key, v) -- render one connector value into its YAML form,
// matching the shape build-connector-registry.cjs coerce() round-trips: an array
// renders as [a, b]; null renders as null; a boolean / integer renders bare; a
// string renders quoted. Byte-stable for a given spec (idempotence).
// ---------------------------------------------------------------------------
function renderConnectorValue(key, v) {
  if (Array.isArray(v)) {
    return '[' + v.map((x) => String(x)).join(', ') + ']';
  }
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  // A string. framework values may carry spaces, so quote every string value.
  return '"' + String(v) + '"';
}

// ---------------------------------------------------------------------------
// renderSurface(spec) -- compose the surface .md content: the YAML frontmatter
// (name + description + the delimited connector block carrying the 11 keys in
// contract order) + a minimal Larry-led body. Deterministic + byte-stable for a
// given spec (idempotent re-emit).
// ---------------------------------------------------------------------------
function renderSurface(spec) {
  // A render-only expert skill takes the EXCLUDED disposition (Part 11 R16
  // exemption): no 11-key wired block, no reach_id, no hitl_shape. Its identity is
  // the projected SyntheticExpert persona.
  if (spec && spec.excluded === true && spec.kind === 'skill') {
    return renderExcludedExpertSkill(spec);
  }
  const lines = [];
  lines.push('---');
  lines.push('name: ' + spec.name);
  const description =
    typeof spec.description === 'string' && spec.description
      ? spec.description
      : 'A ' + spec.kind + ' surface generated by /mos:new-surface';
  lines.push('description: ' + description);
  // The delimited connector block (the Phase 143.3 additive-block convention).
  lines.push('# --- Phase 143.3 connector frontmatter (generated by /mos:new-surface) ---');
  lines.push('connector:');
  for (const k of CONNECTOR_KEYS) {
    lines.push('  ' + k + ': ' + renderConnectorValue(k, spec[k]));
  }
  lines.push('---');
  lines.push('');
  lines.push('# /mos:' + spec.name);
  lines.push('');
  lines.push(
    'You are Larry. This ' + spec.kind + ' surface was generated by /mos:new-surface ' +
      'with its 11-key connector frontmatter (sub_mode: ' + String(spec.sub_mode) + '), so its ' +
      'wiring is declared, never hand-written. It joins the reach spine via ' +
      'connector-registry.json (its real home) and is reflected transitively in ' +
      'the harness-manifest wiring digest.'
  );
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// renderExcludedExpertSkill(spec) -- compose the render-only expert SKILL.md: a
// minimal EXCLUDED connector block (excluded:true + reason, NO reach_id, NO 11
// wired keys, NO hitl_shape) + a persona body carrying the projected props (hat,
// beautiful_question, research_approach, evidence_tier, provenance). Byte-stable
// for a given spec. This is the Part 11 R16 exemption disposition, on disk.
// ---------------------------------------------------------------------------
function renderExcludedExpertSkill(spec) {
  const e = (spec && spec.expert && typeof spec.expert === 'object') ? spec.expert : {};
  const hat = typeof e.hat === 'string' ? e.hat : '';
  const persona = [e.name, e.surname].filter((x) => typeof x === 'string' && x).join(' ') || spec.name;
  const description =
    typeof spec.description === 'string' && spec.description
      ? spec.description
      : 'A render-only expert capability lens';
  const reason = typeof spec.reason === 'string' && spec.reason ? spec.reason : EXPERT_SKILL_REASON;

  const prov = (e.provenance && typeof e.provenance === 'object') ? e.provenance : {};
  const runId = typeof prov.runId === 'string' && prov.runId ? prov.runId : '(none)';
  const domainNodeIds = Array.isArray(prov.domainNodeIds) ? prov.domainNodeIds : [];

  const lines = [];
  lines.push('---');
  lines.push('name: ' + spec.name);
  lines.push('description: ' + description);
  lines.push('# --- Phase 203-02 connector frontmatter: ' + EXPERT_SKILL_REASON + ' ---');
  lines.push('connector:');
  lines.push('  excluded: true');
  lines.push('  reason: ' + renderConnectorValue('reason', reason));
  lines.push('---');
  lines.push('');
  lines.push('# ' + persona + (typeof e.archetype === 'string' && e.archetype ? ' -- ' + e.archetype : ''));
  lines.push('');
  lines.push(
    'You are ' + persona + ', a ' + (hat || 'synthetic') + '-hat synthetic expert. This ' +
      'skill is a render-only capability lens: the projection of a CONFIRMED SyntheticExpert ' +
      'graph node, invokable anywhere in the room. It reaches no Decision-Gate fork, so it is ' +
      'born EXCLUDED (Part 11 R16 exemption); its reach lives on the /mos:skill front door ' +
      'that materialized it.'
  );
  lines.push('');
  lines.push('## Hat');
  lines.push('');
  lines.push(hat || '(unspecified)');
  lines.push('');
  lines.push('## Beautiful question');
  lines.push('');
  lines.push(typeof e.beautiful_question === 'string' && e.beautiful_question ? e.beautiful_question : '(none recorded)');
  lines.push('');
  lines.push('## Research approach');
  lines.push('');
  lines.push(typeof e.research_approach === 'string' && e.research_approach ? e.research_approach : '(none recorded)');
  lines.push('');
  lines.push('## Evidence tier');
  lines.push('');
  lines.push(typeof e.evidence_tier === 'string' && e.evidence_tier ? e.evidence_tier : 'None');
  lines.push('');
  lines.push('## Provenance');
  lines.push('');
  lines.push('runId: ' + runId + '; domainNodeIds: ' + (domainNodeIds.length ? domainNodeIds.join(', ') : '(none)'));
  lines.push('');
  lines.push('## Invocation (Tri-Polar)');
  lines.push('');
  lines.push(
    'A .md skill is surface-neutral. On Claude Code CLI it loads as a skill file; on Claude ' +
      'Desktop the navigator talks to this persona through Larry; on Cowork it is shared room ' +
      'state every collaborator reaches.'
  );
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// slugifyName(label) -- lowercase-slug a persona surname into a valid surface name
// (matching the spec.name grammar ^[a-z0-9][a-z0-9-]*$). Non-alnum runs collapse to
// a single hyphen; leading/trailing hyphens are trimmed.
// ---------------------------------------------------------------------------
function slugifyName(label) {
  return String(label == null ? '' : label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// readConfirmedExpert(db, selector) -- read ONE CONFIRMED SyntheticExpert node
// matching selector (by node id or props.surname, case-insensitive). The confirmed
// filter (type='SyntheticExpert' AND review_status='confirmed') mirrors
// lib/core/expert-library.cjs::rankExpertsForSlot -- only a human-kept node is
// trusted (Canon Part 9 role 5). Returns { id, props } or null. Pure LOCAL read
// over a caller-owned handle; ZERO Brain, ZERO network (Part 8).
// ---------------------------------------------------------------------------
function readConfirmedExpert(db, selector) {
  let rows;
  try {
    rows = db.prepare(
      "SELECT id, properties FROM nodes WHERE type = 'SyntheticExpert' AND review_status = 'confirmed'"
    ).all();
  } catch (_e) {
    return null;
  }
  const sel = String(selector == null ? '' : selector).trim().toLowerCase();
  if (!sel) return null;
  for (const row of rows) {
    let props = {};
    try {
      const p = JSON.parse(row.properties);
      props = (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
    } catch (_e) {
      props = {};
    }
    const surname = typeof props.surname === 'string' ? props.surname.toLowerCase() : '';
    if (String(row.id).toLowerCase() === sel || surname === sel) {
      return { id: row.id, props };
    }
  }
  return null;
}

// listConfirmedExperts(db) -- the candidate list for a miss (surname + hat), so the
// front door can offer the confirmed choices. Same confirmed filter.
function listConfirmedExperts(db) {
  let rows;
  try {
    rows = db.prepare(
      "SELECT id, properties FROM nodes WHERE type = 'SyntheticExpert' AND review_status = 'confirmed'"
    ).all();
  } catch (_e) {
    return [];
  }
  const out = [];
  for (const row of rows) {
    let props = {};
    try {
      const p = JSON.parse(row.properties);
      props = (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
    } catch (_e) {
      props = {};
    }
    out.push({ id: row.id, surname: typeof props.surname === 'string' ? props.surname : '', hat: typeof props.hat === 'string' ? props.hat : '' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// expertToSkillSpec(expert) -- project a confirmed SyntheticExpert node's props
// into an EXCLUDED skill spec (kind=skill, born-EXCLUDED render-only lens). The
// spec carries NO reach_id and NO connector keys -- only excluded:true + reason +
// the persona props for the body.
// ---------------------------------------------------------------------------
function expertToSkillSpec(expert) {
  const p = (expert && expert.props && typeof expert.props === 'object') ? expert.props : {};
  const name = slugifyName(p.surname) || slugifyName(p.name) || 'expert';
  const description =
    typeof p.archetype === 'string' && p.archetype ? p.archetype : 'A render-only expert capability lens';
  return {
    kind: 'skill',
    name,
    description,
    excluded: true,
    reason: EXPERT_SKILL_REASON,
    expert: {
      hat: p.hat,
      name: p.name,
      surname: p.surname,
      archetype: p.archetype,
      beautiful_question: p.beautiful_question,
      research_approach: p.research_approach,
      evidence_tier: p.evidence_tier,
      provenance: p.provenance,
    },
  };
}

// ---------------------------------------------------------------------------
// materializeExpertSkill(db, selector, opts) -- the --from-expert orchestrator.
// Reads the CONFIRMED node (refusing a proposed / absent one), projects its props
// into an EXCLUDED skill spec, and emits skills/<surname>/SKILL.md through the
// EXISTING emit path (write-only: a room-scoped skill never touches the plugin
// registries, and an excluded surface never joins the wired registry anyway).
// Returns { ok, path?, content?, name?, expert?, refused?, reason?, candidates? }.
// ---------------------------------------------------------------------------
function materializeExpertSkill(db, selector, opts) {
  const o = opts || {};
  const expert = readConfirmedExpert(db, selector);
  if (!expert) {
    return {
      ok: false,
      refused: true,
      reason: 'no_confirmed_expert',
      selector: String(selector == null ? '' : selector),
      candidates: listConfirmedExperts(db),
    };
  }
  const spec = expertToSkillSpec(expert);
  const res = emitSurface(spec, { outDir: o.outDir });
  return { ok: true, path: res.path, content: res.content, name: spec.name, expert, spec };
}

// ---------------------------------------------------------------------------
// regenerateDownstream(cwd) -- SHELL OUT (LOW-2) to regenerate the two downstream
// registries on FRESH node processes: connector-registry FIRST (the surface's
// real home), then the harness-manifest (the wiring digest). NOT require()
// + internals -- a fresh process is the identical byte-stable serialize path with
// no module-cache bleed. cwd anchors the relative script paths (the test passes a
// mirror-repo cwd; production passes REPO_ROOT).
// ---------------------------------------------------------------------------
function regenerateDownstream(cwd) {
  const root = cwd || REPO_ROOT;
  execFileSync('node', ['scripts/build-connector-registry.cjs'], { cwd: root, stdio: 'inherit' });
  execFileSync('node', ['scripts/build-harness-manifest.cjs'], { cwd: root, stdio: 'inherit' });
}

// ---------------------------------------------------------------------------
// emitSurface(spec, opts) -- the deterministic emitter. Validates the spec
// (frozen reach + posture, 11 keys, kind), composes the surface .md, writes it to
// the env-overridable base dir (idempotent byte-stable), and -- when opts.cwd is
// set (the transitive-landing path) -- shells out to regenerate the two
// downstream registries. Returns { path, content }.
//
// opts:
//   outDir  base dir for the emit (defaults to MINDRIAN_SURFACE_OUT_DIR or REPO_ROOT)
//   cwd     when set, regenerate connector-registry + harness-manifest from this
//           cwd after the emit (the transitive landing). When absent, the emit is
//           write-only (a tmp emit that does not touch the real registries).
// ---------------------------------------------------------------------------
function emitSurface(spec, opts) {
  const o = opts || {};
  const excluded = !!(spec && spec.excluded === true);
  if (excluded) {
    validateExcludedSpec(spec);
  } else {
    validateSpec(spec);
  }
  const outDir = o.outDir || process.env.MINDRIAN_SURFACE_OUT_DIR || REPO_ROOT;
  const dest = surfacePath(spec.kind, spec.name, outDir);
  const content = renderSurface(spec);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  // Only a WIRED surface regenerates the downstream registries (its real home). A
  // render-only EXCLUDED skill is room-scoped and never joins the wired registry,
  // so the emit is write-only even when a cwd is supplied.
  if (o.cwd && !excluded) {
    regenerateDownstream(o.cwd);
  }
  return { path: dest, content: content };
}

// ---------------------------------------------------------------------------
// validateExcludedSpec(spec) -- the born-EXCLUDED guard (Part 11 R16 exemption).
// A render-only excluded skill is well-formed iff: it is a skill, has a valid
// lowercase-slug name, carries a non-empty reason, and carries NO reach_id (no 7th
// reach -- the reach lives on the WIRED front door). Throws on any violation.
// ---------------------------------------------------------------------------
function validateExcludedSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('spec must be an object. ' + RECOVERY);
  }
  if (spec.kind !== 'skill') {
    throw new Error('an excluded surface must be a skill (got ' + JSON.stringify(spec.kind) + '). ' + RECOVERY);
  }
  if (typeof spec.name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(spec.name)) {
    throw new Error('spec.name must be a lowercase-slug string (got ' + JSON.stringify(spec.name) + '). ' + RECOVERY);
  }
  if (typeof spec.reason !== 'string' || spec.reason.trim().length === 0) {
    throw new Error('an excluded surface requires a non-empty reason (D-172-a: no surface dark by accident). ' + RECOVERY);
  }
  if ('reach_id' in spec && spec.reach_id != null) {
    throw new Error('a render-only excluded skill carries NO reach_id (no 7th reach). ' + RECOVERY);
  }
}

// ---------------------------------------------------------------------------
// validateSurface(spec, opts) -- the categorized findings (mirrors the Wave-1 /
// connector --check taxonomy). Returns:
//   { missing_key, off_frozen, not_registered, manifest_stale }
// each an array of error strings (empty = that mode clean), each carrying a
// recovery line. PURE with respect to the Brain. The not_registered + manifest
// modes consult the on-disk connector-registry.json + the manifest --check; when
// opts.skipRegistry is true (the spec-only well-formedness path) those modes are
// not exercised.
// ---------------------------------------------------------------------------
function validateSurface(spec, opts) {
  const o = opts || {};
  const missing_key = [];
  const off_frozen = [];
  const not_registered = [];
  const manifest_stale = [];

  const s = spec && typeof spec === 'object' && !Array.isArray(spec) ? spec : {};

  // EXCLUDED branch (Part 11 R16 exemption): a render-only excluded surface is
  // well-formed iff excluded:true carries a non-empty reason AND no reach_id (no
  // 7th reach). It is DELIBERATELY absent from the wired registry, so the wired
  // checks (11 keys / frozen banks / registry membership / manifest) do NOT apply.
  if (s.excluded === true) {
    const reason = typeof s.reason === 'string' && s.reason.trim() ? s.reason.trim() : '';
    if (!reason) {
      missing_key.push(
        'MISSING_REASON: the surface declares excluded:true but no reason ' +
          '(D-172-a: no surface dark by accident). ' + RECOVERY
      );
    }
    if ('reach_id' in s && s.reach_id != null) {
      off_frozen.push(
        'OFF_FROZEN: a render-only excluded skill carries a reach_id but must not ' +
          '(no 7th reach; the reach lives on the WIRED front door). ' + RECOVERY
      );
    }
    return { missing_key, off_frozen, not_registered, manifest_stale };
  }

  // MISSING_KEY: any of the 11 connector keys absent.
  for (const k of CONNECTOR_KEYS) {
    if (!(k in s)) {
      missing_key.push('MISSING_KEY: the surface is missing the connector key "' + k + '". ' + RECOVERY);
    }
  }

  // OFF_FROZEN: an off-frozen reach_id (not in the 6) or posture (not in the 3).
  if (REACH_IDS.indexOf(s.reach_id) === -1) {
    off_frozen.push(
      'OFF_FROZEN: reach_id "' + s.reach_id + '" is not in the frozen 6 (' +
        REACH_IDS.join(', ') + '). A new tool identity rides sub_mode, never a new reach_id. ' + RECOVERY
    );
  }
  if (POSTURE_IDS.indexOf(s.posture) === -1) {
    off_frozen.push(
      'OFF_FROZEN: posture "' + s.posture + '" is not in the frozen 3 (' +
        POSTURE_IDS.join(', ') + '). ' + RECOVERY
    );
  }

  // NOT_REGISTERED + MANIFEST_STALE: consult the on-disk registries (the
  // surface's real home + the wiring digest). Skipped for the spec-only path.
  if (!o.skipRegistry) {
    const registryPath = path.join(REPO_ROOT, 'data', 'connector-registry.json');
    const surfaceName =
      s.kind === 'command' ? '/mos:' + s.name
        : s.kind === 'agent' ? 'agent:' + s.name
          : 'skill:' + s.name;
    let registered = false;
    try {
      const reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      registered = Array.isArray(reg.connectors) && reg.connectors.some((c) => c.surface === surfaceName);
    } catch (_e) {
      registered = false;
    }
    if (!registered) {
      not_registered.push(
        'NOT_REGISTERED: the surface "' + surfaceName + '" is absent from ' +
          'data/connector-registry.json (its real home). Emit it through the ' +
          'generator so the registry regenerates. ' + RECOVERY
      );
    }

    // MANIFEST_STALE: the harness-manifest --check must be clean (the wiring
    // digest reflects the surface). A non-zero exit is a MANIFEST_STALE finding.
    let manifestClean = true;
    try {
      execFileSync('node', ['scripts/build-harness-manifest.cjs', '--check'],
        { cwd: REPO_ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (_e) {
      manifestClean = false;
    }
    if (!manifestClean) {
      manifest_stale.push(
        'MANIFEST_STALE: build-harness-manifest.cjs --check is non-zero (the ' +
          'wiring digest does not reflect the connector-registry). ' +
          'Run: node scripts/build-harness-manifest.cjs'
      );
    }
  }

  return { missing_key, off_frozen, not_registered, manifest_stale };
}

// ---------------------------------------------------------------------------
// specFromArgv(argv) -- assemble a spec from the named flags. Each connector key
// maps to a flag; --reach is an alias for --reach_id. Values coerce: a bare
// "true"/"false" -> boolean, an integer -> number, "null"/"~" -> null, a bracket
// list -> array, else a string. Mirrors build-connector-registry.cjs coerce().
// ---------------------------------------------------------------------------
function coerceFlag(v) {
  if (v === undefined) return undefined;
  if (v === 'null' || v === '~') return null;
  if (v === 'true' || v === 'false') return v === 'true';
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (v.startsWith('[')) {
    const inner = v.replace(/^\[/, '').replace(/\]$/, '').trim();
    if (inner === '') return [];
    return inner.split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter((x) => x.length > 0);
  }
  return v;
}

function specFromArgv(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
      flags[key] = val;
      if (val !== 'true') i += 1;
    }
  }
  if (flags.reach !== undefined && flags.reach_id === undefined) flags.reach_id = flags.reach;
  const spec = {};
  if (flags.kind !== undefined) spec.kind = flags.kind;
  if (flags.name !== undefined) spec.name = flags.name;
  if (flags.description !== undefined) spec.description = flags.description;
  for (const k of CONNECTOR_KEYS) {
    if (flags[k] !== undefined) spec[k] = coerceFlag(flags[k]);
  }
  return spec;
}

// ---------------------------------------------------------------------------
// loadSpec(argv) -- read a --spec <file.json> spec, or assemble one from flags.
// ---------------------------------------------------------------------------
function loadSpec(argv) {
  const i = argv.indexOf('--spec');
  if (i !== -1 && argv[i + 1]) {
    return JSON.parse(fs.readFileSync(argv[i + 1], 'utf8'));
  }
  return specFromArgv(argv);
}

// ---------------------------------------------------------------------------
// runCheck(argv) -- the --check mode. Build a minimal spec from --kind/--name (+
// any provided connector flags), read the emitted surface from the env-overridable
// outDir to recover its connector keys, then validate: WELL-FORMED (11 keys +
// frozen reach + frozen posture) + REGISTERED + manifest --check clean. Print
// each categorized finding + recovery to stderr; exit non-zero on any finding.
// ---------------------------------------------------------------------------
function parseEmittedConnector(mdPath) {
  // Reuse the shipped nested-map parser so --check reads the emitted file the
  // same way the registry generator does. require() inside the branch keeps the
  // top-level import surface minimal.
  const { parseConnectorFrontmatter } = require(
    path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs')
  );
  const fm = parseConnectorFrontmatter(fs.readFileSync(mdPath, 'utf8'));
  return fm.connector || {};
}

function runCheck(argv) {
  const flagSpec = specFromArgv(argv);
  const kind = flagSpec.kind || 'command';
  const name = flagSpec.name;
  if (!name) {
    console.error('--check requires --name <surface-name> (and optional --kind). ' + RECOVERY);
    process.exit(1);
    return;
  }
  const outDir = process.env.MINDRIAN_SURFACE_OUT_DIR || REPO_ROOT;
  const mdPath = surfacePath(kind, name, outDir);
  let conn = {};
  try {
    conn = parseEmittedConnector(mdPath);
  } catch (_e) {
    console.error(
      'NOT_FOUND: the surface .md "' + mdPath + '" does not exist or is unreadable. ' + RECOVERY
    );
    process.exit(1);
    return;
  }
  const spec = Object.assign({ kind: kind, name: name }, conn);
  const findings = validateSurface(spec, {});
  const all = [
    ...findings.missing_key,
    ...findings.off_frozen,
    ...findings.not_registered,
    ...findings.manifest_stale,
  ];
  if (all.length) {
    console.error(all.join('\n'));
    console.error(
      'Recovery: re-emit the surface through the generator so the registry + ' +
        'manifest regenerate: node scripts/build-new-surface.cjs --spec <spec.json>'
    );
    process.exit(1);
    return;
  }
  console.log('new-surface: OK');
}

// ---------------------------------------------------------------------------
// main() -- the 3-branch entry: default emit (+ regenerate) / --check / --refresh.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// runFromExpert(argv) -- the --from-expert CLI mode. Open the room db through the
// SANCTIONED room-db.cjs chokepoint (never a direct node:sqlite open -- Canon
// Part 9 navigation chokepoint), read the CONFIRMED SyntheticExpert, project it
// into an EXCLUDED skill, and emit skills/<surname>/SKILL.md (write-only). A
// refused (proposed / absent) node exits non-zero with a recovery line + the
// confirmed candidate list. --room <dir> overrides the default cwd room root.
// ---------------------------------------------------------------------------
function runFromExpert(argv) {
  const i = argv.indexOf('--from-expert');
  const selector = i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
  if (!selector) {
    console.error('--from-expert requires a <surname|nodeId>. ' + RECOVERY);
    process.exit(1);
    return;
  }
  const j = argv.indexOf('--room');
  const roomDir = j !== -1 && argv[j + 1] && !argv[j + 1].startsWith('--') ? argv[j + 1] : process.cwd();
  const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const db = openRoomDb(roomDir);
  let res;
  try {
    res = materializeExpertSkill(db, selector, {});
  } finally {
    try { closeRoomDb(db); } catch (_e) { /* ignore */ }
  }
  if (!res.ok) {
    console.error(
      'REFUSED: no CONFIRMED SyntheticExpert matches "' + selector + '". Only confirmed ' +
        'nodes materialize (Canon Part 9 role 5: a human confirms the truth-claim first). ' + RECOVERY
    );
    if (Array.isArray(res.candidates) && res.candidates.length) {
      console.error(
        'Confirmed candidates: ' +
          res.candidates.map((c) => (c.surname || c.id) + (c.hat ? ' (' + c.hat + ')' : '')).join(', ')
      );
    }
    process.exit(1);
    return;
  }
  console.log('Emitted render-only expert skill ' + res.path + ' (born EXCLUDED: ' + EXPERT_SKILL_REASON + ')');
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--check')) {
    runCheck(argv);
    return;
  }

  if (argv.includes('--from-expert')) {
    runFromExpert(argv);
    return;
  }

  // Default + --refresh: emit from a spec, then regenerate the two downstream
  // registries (the transitive landing). --refresh is the idempotent re-emit.
  const spec = loadSpec(argv);
  const res = emitSurface(spec, { cwd: REPO_ROOT });
  console.log(
    'Emitted ' + spec.kind + ' surface ' + res.path +
      ' (regenerated connector-registry + harness-manifest)'
  );
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    emitSurface,
    validateSurface,
    validateSpec,
    validateExcludedSpec,
    renderSurface,
    renderExcludedExpertSkill,
    surfacePath,
    specFromArgv,
    CONNECTOR_KEYS,
    EXPERT_SKILL_REASON,
    slugifyName,
    readConfirmedExpert,
    listConfirmedExperts,
    expertToSkillSpec,
    materializeExpertSkill,
  };
}
