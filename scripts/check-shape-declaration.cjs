#!/usr/bin/env node
'use strict';

/*
 * Phase 190-03 (SFD-04) - the born-declared-shape CI tripwire (the R16 gate core).
 *
 * Every invocable surface across FOUR classes -- commands, agents, pipeline
 * CHAIN.md files, and QUALIFYING skill SKILL.md files -- must DECLARE the
 * Shape-F it reaches, drawing only from the closed vocabulary shipped in
 * data/hitl-shape-declaration-schema.json (F.0-F.9 plus the literal 'none').
 * A no-fork skill is EXEMPT via its existing connector.excluded:true + reason
 * (Canon Part 11 R1) -- the gate reuses that CIRS exclusion signal rather than
 * minting a parallel skill-exemption field or a redundant hitl_shape:'none'.
 *
 * This module is the PURE validation core (Plan 03 Task 1). It is validated
 * against synthetic fixtures under data/hitl-shape-declaration-fixtures/ before
 * it ever touches the real tree. The --check / --check-plan CLI modes (Task 2)
 * wire this core over the live surfaces.
 *
 * check(fixture, opts) -> { valid, surface, violations[] } mirrors
 * scripts/check-hitl-stages.cjs's check() shape exactly, extended with the skill
 * branch and the f-selector-ranker-contradiction predicate.
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. node:fs + node:path ONLY. Makes
 * ZERO Brain reads/writes and ZERO network calls; runs no inference and consults
 * no agent. Deterministic: same schema + same fixtures -> same verdict.
 *
 * Phase 210-02 (item 210-A, navigator decision, CONTEXT addendum 1): the --check
 * CLI mode is ADVISORY BY DEFAULT. Every predicate still runs and every violation
 * is still detected and enumerated (the lint signal survives), but a violation
 * prints a WARN block and exits 0. The pre-210 hard-fail contract is preserved as
 * an opt-in: --check --strict restores the SHAPE DECLARATION VIOLATION output and
 * exit 1. This softening covers ALL FOUR checks together (the Phase 190 base
 * declaration-exists check, predicate 5, AND the three Phase 209-03 predicates:
 * wired-body, tool-grant, declared-matches-body).
 *
 * Test seam (Phase 210-02): the CHECK_SHAPE_DECLARATION_ROOT env var overrides
 * the SCAN root that collectSurfaces()/checkTree() walk, so a spawn-level test
 * can point --check at a synthetic violating tree. It defaults to the plugin
 * root and changes NOTHING else (the schema still loads from the real repo).
 *
 * Part 7 (Reuse Before Build): the hitl_stages branch delegates wholesale to
 * scripts/check-hitl-stages.cjs's exported check(); the skill-exempt branch reads
 * the EXISTING connector.excluded/connector.reason fields.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv routing.
 */

const fs = require('node:fs');
const path = require('node:path');

// Part 7 reuse: the hitl_stages validator. Its check() validates a stages array
// against the closed F.0-F.9 shape set + the {parallel, ordered, gate} mode set.
const hitlStages = require('./check-hitl-stages.cjs');

// Phase 198-04 (SPEC-2, Task 1): reuse the SAME MCP-tool discovery
// build-connector-registry.cjs uses to generate data/mcp-tool-connectors.json
// (Canon Part 7 -- one discovery walk, not two). A declared MCP tool with a
// missing/invalid hitl_shape is caught by the SAME advisory --check sweep this
// file already runs over commands/agents/pipelines/skills (Phase 210 posture:
// WARN + enumerate, never a hard block; --strict restores hard-fail). Lazily
// required only where used so a --check-plan-only invocation never pays the
// lib/mcp/tools/ + command-resolver.cjs load cost.
function loadMcpToolDescriptors() {
  try {
    const gen = require('./build-connector-registry.cjs');
    return typeof gen.listMcpToolConnectorDescriptors === 'function'
      ? gen.listMcpToolConnectorDescriptors()
      : [];
  } catch (_e) {
    return [];
  }
}

// Phase 209-03 (B2): ONE shared STAMP_MARKER constant, imported from the B1
// stamp script rather than a second literal (T-209-10) - a drifted duplicate
// would silently green the declared-implies-wired gate.
const { STAMP_MARKER } = require('./stamp-firing-block.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'hitl-shape-declaration-schema.json');
const FIXTURES_DIR = path.join(REPO_ROOT, 'data', 'hitl-shape-declaration-fixtures');

// The four surface classes the --check mode enumerates (Task 2). Declared here so
// the gate's shape is self-documenting; the walk NEVER hardcodes a surface count.
// Phase 210-02 test seam: resolveScanRoot() honors CHECK_SHAPE_DECLARATION_ROOT
// (spawn-level tests point the sweep at a synthetic tree); default is REPO_ROOT.
function resolveScanRoot() {
  const env = process.env.CHECK_SHAPE_DECLARATION_ROOT;
  if (typeof env === 'string' && env.trim() !== '') return path.resolve(env.trim());
  return REPO_ROOT;
}

// The RANKER-CONSUMER ALLOWLIST anchors: a surface whose implementation requires
// (directly or transitively) any of these is a proven ranked-reach consumer and
// MUST declare F.7 (the ranked dial). Static, code-evaluated -- never an LLM call.
const RANKER_MODULES = Object.freeze([
  'f-selector-ranker.cjs',
  'dial-reach-orchestrator.cjs',
  'navigation-engine.cjs',
]);

// ---------------------------------------------------------------------------
// loadSchema() -- read the closed Shape-F vocabulary. Pure read; no network.
// Returns { shapeVocabulary:Set } or { fatal }.
// ---------------------------------------------------------------------------
function loadSchema() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    return { fatal: 'data/hitl-shape-declaration-schema.json not found' };
  }
  let schema;
  try {
    schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  } catch (e) {
    return { fatal: 'data/hitl-shape-declaration-schema.json is not valid JSON: ' + e.message };
  }
  const doc = schema && schema._doc;
  if (!doc || !Array.isArray(doc.shape_vocabulary) || doc.shape_vocabulary.length === 0) {
    return { fatal: 'data/hitl-shape-declaration-schema.json is missing _doc.shape_vocabulary' };
  }
  return { shapeVocabulary: new Set(doc.shape_vocabulary) };
}

// ---------------------------------------------------------------------------
// isRankerConsumer(scriptRel, opts) -- the static grep predicate. Reads the
// implementation file and returns true when it requires any RANKER_MODULES anchor.
// Comment-aware (skips // and /* * lines). Pure read; returns false on a
// missing/unreadable file. LOCAL-only (Canon Part 8).
// ---------------------------------------------------------------------------
function isRankerConsumer(scriptRel, opts) {
  const root = (opts && opts.repoRoot) || REPO_ROOT;
  const abs = path.isAbsolute(scriptRel)
    ? scriptRel
    : path.join(root, String(scriptRel).split('/').join(path.sep));
  let src;
  try {
    src = fs.readFileSync(abs, 'utf8');
  } catch (_e) {
    return false;
  }
  for (const mod of RANKER_MODULES) {
    const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('require\\([^)]*' + escaped + '[^)]*\\)');
    for (const rawLine of src.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
      const code = rawLine.replace(/\/\/.*$/, '');
      if (re.test(code)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// check(fixture, opts) -- THE PINNED validation predicate over ONE surface
// record. Pure code, deterministic, no LLM, no network. Returns
//   { valid:boolean, surface:string, violations:string[] }.
// opts.vocab (a { shapeVocabulary:Set }) short-circuits the schema read so a
// caller can validate many fixtures against one load.
// ---------------------------------------------------------------------------
function check(fixture, opts) {
  opts = opts || {};
  const violations = [];

  let shapeVocabulary;
  if (opts.vocab && opts.vocab.shapeVocabulary) {
    shapeVocabulary = opts.vocab.shapeVocabulary;
  } else {
    const loaded = loadSchema();
    if (loaded.fatal) {
      return { valid: false, surface: '', violations: [loaded.fatal] };
    }
    shapeVocabulary = loaded.shapeVocabulary;
  }

  const surface = fixture && typeof fixture.surface === 'string' ? fixture.surface : '';
  const label = surface || '<unnamed>';

  // (1) surface is a non-empty string.
  if (!surface || surface.trim().length === 0) {
    violations.push('surface is missing or not a non-empty string');
  }

  const hasShape =
    fixture && fixture.hitl_shape !== undefined && fixture.hitl_shape !== null;
  const hasStages =
    fixture && fixture.hitl_stages !== undefined && fixture.hitl_stages !== null;

  // (2) never both a single-fork shape AND a multi-stage declaration.
  if (hasShape && hasStages) {
    violations.push(
      'surface ' + label + ': declares BOTH hitl_shape and hitl_stages (exactly one form is allowed)'
    );
  }

  if (hasShape) {
    // (3) hitl_shape is a member of the closed vocabulary AND hitl_why is present.
    const shape = fixture.hitl_shape;
    if (!shapeVocabulary.has(shape)) {
      violations.push(
        'surface ' + label + ': unknown hitl_shape "' + shape +
          '" (not in the closed set F.0-F.9 plus "none")'
      );
    }
    const why = fixture.hitl_why;
    if (typeof why !== 'string' || why.trim().length === 0) {
      violations.push('surface ' + label + ': hitl_why is missing or empty');
    }
  } else if (hasStages) {
    // (4) delegate the stages array wholesale to check-hitl-stages.cjs (Part 7).
    const stagesResult = hitlStages.check({ surface, hitl_stages: fixture.hitl_stages });
    for (const v of stagesResult.violations) violations.push(v);
    // The schema also requires a non-empty hitl_why for a multi-stage declaration.
    const why = fixture.hitl_why;
    if (typeof why !== 'string' || why.trim().length === 0) {
      violations.push('surface ' + label + ': hitl_why is missing or empty for the staged flow');
    }
  } else {
    // (5) NEITHER form: valid ONLY IF connector.excluded:true AND a non-empty
    //     reason (the skill-exempt case, reusing the CIRS R1 exclusion signal).
    const excluded = fixture && fixture.connector_excluded === true;
    const reason = fixture ? fixture.connector_reason : undefined;
    const hasReason = typeof reason === 'string' && reason.trim().length > 0;
    if (!(excluded && hasReason)) {
      violations.push(
        'surface ' + label + ': declares NEITHER hitl_shape/hitl_stages NOR ' +
          'connector.excluded:true + reason (a surface silently missing both a ' +
          'Shape-F declaration and a CIRS exclusion is illegal, exactly like a CIRS gap)'
      );
    }
  }

  // (6) the f-selector-ranker-contradiction predicate. When an implementation_script
  //     is a proven ranker consumer, F.7 MUST appear as the hitl_shape OR within at
  //     least one hitl_stages[].shapes[] entry; absence from both is a contradiction.
  const script = fixture && fixture.implementation_script;
  if (typeof script === 'string' && script.trim().length > 0 && isRankerConsumer(script, opts)) {
    let hasF7 = false;
    if (hasShape && fixture.hitl_shape === 'F.7') hasF7 = true;
    if (hasStages && Array.isArray(fixture.hitl_stages)) {
      for (const st of fixture.hitl_stages) {
        if (st && Array.isArray(st.shapes) && st.shapes.indexOf('F.7') !== -1) {
          hasF7 = true;
          break;
        }
      }
    }
    if (!hasF7) {
      const declared = hasShape
        ? String(fixture.hitl_shape)
        : hasStages
          ? 'stages without any F.7'
          : '<no declaration>';
      violations.push(
        'surface ' + label + ': f-selector-ranker-contradiction -- implementation_script ' +
          script + ' is a proven ranker consumer (requires ' + RANKER_MODULES.join(' / ') +
          '), so it MUST declare F.7 (expected F.7, declared ' + declared + ')'
      );
    }
  }

  // Phase 209-03 (B2): three declared-implies-wired predicates. Scoped to
  // hasShape ONLY (single-fork hitl_shape), matching the B1 stamp's EXACT
  // wiring domain (scripts/stamp-firing-block.cjs's getHitlShape() reads only
  // the hitl_shape key) - a hitl_stages command is a multi-stage declaration
  // where a single "canonical firing block" naming one shape does not apply,
  // and B1 never touched that surface class. Wiring hitl_stages commands is
  // out of this phase's scope (CONTEXT names only "hitl_shape-declaring
  // commands"); scoping here to hasShape avoids red-flooding CI on a class B1
  // was never asked to stamp.
  //
  // Each predicate applies ONLY when the fixture explicitly carries the
  // corresponding body-derived field (checkTree() populates these for the
  // live tree; hand-built fixtures in data/hitl-shape-declaration-fixtures/
  // that omit them are UNAFFECTED - backward compatible by construction,
  // never a silent scope creep). All three honor the SAME excluded:true +
  // non-empty reason escape hatch as (5).
  const excludedOk =
    fixture &&
    fixture.connector_excluded === true &&
    typeof fixture.connector_reason === 'string' &&
    fixture.connector_reason.trim().length > 0;

  if (hasShape && !excludedOk) {
    // (7) wired-body: the body must carry the canonical firing block
    // (STAMP_MARKER, the B1 stamp) OR mention AskUserQuestion directly.
    if (fixture && fixture.body_has_firing_block !== undefined) {
      const wiredBody = fixture.body_has_firing_block === true || fixture.body_mentions_tool === true;
      if (!wiredBody) {
        violations.push(
          'surface ' + label + ': declares ' + (hasShape ? fixture.hitl_shape : 'hitl_stages') +
            ' but the body neither carries the canonical firing block (' + STAMP_MARKER +
            ') nor mentions AskUserQuestion'
        );
      }
    }

    // (8) tool-grant: an ABSENT allowed-tools key is unrestricted (passes); a
    // present list must include AskUserQuestion.
    if (fixture && Object.prototype.hasOwnProperty.call(fixture, 'allowed_tools')) {
      const allowedTools = fixture.allowed_tools;
      if (allowedTools !== null && Array.isArray(allowedTools) && allowedTools.indexOf('AskUserQuestion') === -1) {
        violations.push(
          'surface ' + label + ': allowed-tools is restrictive and does not grant AskUserQuestion'
        );
      }
    }

    // (9) declared-matches-body: a body naming a DIFFERENT Shape-F than the
    // declared one is a contradiction (the futures.md F.2-vs-F.1 case). A body
    // with no shape mention at all passes (no contradiction detectable).
    if (fixture && Array.isArray(fixture.body_shape_mentions) && fixture.body_shape_mentions.length > 0) {
      const declaredShape = hasShape ? fixture.hitl_shape : null;
      if (declaredShape && fixture.body_shape_mentions.indexOf(declaredShape) === -1) {
        violations.push(
          'surface ' + label + ': declares ' + declaredShape + ' but the body mentions Shape ' +
            fixture.body_shape_mentions.join(', ') + ' (declared-vs-body shape contradiction)'
        );
      }
    }
  }

  return { valid: violations.length === 0, surface, violations };
}

// ---------------------------------------------------------------------------
// checkAll(fixturesDir) -- validate every *.json fixture in a directory (default
// data/hitl-shape-declaration-fixtures/). Mirrors check-hitl-stages.cjs checkAll().
// Returns { valid:boolean, fixtures:number, violations:string[] }.
// ---------------------------------------------------------------------------
function checkAll(fixturesDir) {
  const dir = fixturesDir || FIXTURES_DIR;
  const vocab = loadSchema();
  if (vocab.fatal) {
    return { valid: false, fixtures: 0, violations: [vocab.fatal] };
  }
  if (!fs.existsSync(dir)) {
    return { valid: false, fixtures: 0, violations: [dir + ' not found'] };
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const violations = [];
  for (const f of files) {
    let fixture;
    try {
      fixture = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    } catch (e) {
      violations.push(f + ': not valid JSON: ' + e.message);
      continue;
    }
    const r = check(fixture, { vocab });
    for (const v of r.violations) violations.push(f + ': ' + v);
  }

  return { valid: violations.length === 0, fixtures: files.length, violations };
}

// ---------------------------------------------------------------------------
// coerce(v) -- scalar/array coercion for the frontmatter parser: null, booleans,
// integers, inline JSON arrays (e.g. ["F.9", "F.2"]), else quote-stripped string.
// Mirrors the coerceScalar idiom in check-cirs-declaration.cjs.
// ---------------------------------------------------------------------------
function coerce(v) {
  const s = String(v).trim();
  if (s === '') return '';
  if (s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^\[.*\]$/.test(s)) {
    try {
      return JSON.parse(s.replace(/'/g, '"'));
    } catch (_e) {
      // fall through to string strip
    }
  }
  return s.replace(/^["']|["']$/g, '');
}

// ---------------------------------------------------------------------------
// parseBlock(block) -- classify an indented sub-block as one of: an array of maps
// (dash + key:value), a nested map (key:value), or an array of scalars (dash +
// scalar). Comment-aware. Returns the parsed value.
// ---------------------------------------------------------------------------
function parseBlock(block) {
  const lines = block
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '' && !/^\s*#/.test(l));
  if (lines.length === 0) return [];

  const first = lines[0];
  const isDashMap = /^\s*-\s+[A-Za-z0-9_-]+:\s*/.test(first);
  const isDashScalar = /^\s*-\s+/.test(first) && !isDashMap;

  if (isDashMap) {
    const arr = [];
    let cur = null;
    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+#.*$/, '');
      const dashKv = /^\s*-\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (dashKv) {
        cur = {};
        cur[dashKv[1]] = coerce(dashKv[2]);
        arr.push(cur);
        continue;
      }
      const kv = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (kv && cur) {
        cur[kv[1]] = coerce(kv[2]);
      }
    }
    return arr;
  }

  if (isDashScalar) {
    const arr = [];
    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+#.*$/, '');
      const dash = /^\s*-\s+(.*)$/.exec(line);
      if (dash) arr.push(coerce(dash[1]));
    }
    return arr;
  }

  // Nested map.
  const obj = {};
  let subKey = null;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+#.*$/, '');
    const kv = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      subKey = kv[1];
      const sv = kv[2].trim();
      obj[subKey] = sv === '' ? [] : coerce(sv);
      continue;
    }
    const dash = /^\s*-\s+(.*)$/.exec(line);
    if (dash && subKey) {
      if (!Array.isArray(obj[subKey])) obj[subKey] = [];
      obj[subKey].push(coerce(dash[1]));
    }
  }
  return obj;
}

// ---------------------------------------------------------------------------
// parseFrontmatter(md) -- a focused YAML-subset reader for the fields this gate
// needs: top-level scalars (hitl_shape, hitl_why), nested maps (connector,
// cirs_relationship), and arrays of maps (hitl_stages, hitl_declarations). An
// empty-value top-level key gathers its indented block and hands it to
// parseBlock. Reads LOCAL bytes only (Canon Part 8). Not a general YAML engine --
// exactly the descent the four surface classes and the plan frontmatter use.
// ---------------------------------------------------------------------------
function parseFrontmatter(md) {
  if (typeof md !== 'string') return {};
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return {};
  const lines = m[1].split(/\r?\n/);
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '' || /^\s*#/.test(line) || /^\s/.test(raw)) {
      i += 1;
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) {
      i += 1;
      continue;
    }
    const key = kv[1];
    const val = kv[2].trim();
    if (val !== '') {
      out[key] = coerce(val);
      i += 1;
      continue;
    }
    // Empty value: gather the following more-indented block.
    const block = [];
    i += 1;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === '') {
        block.push('');
        i += 1;
        continue;
      }
      if (/^\s/.test(l)) {
        block.push(l);
        i += 1;
        continue;
      }
      break;
    }
    out[key] = parseBlock(block);
  }
  return out;
}

// Matches the repo's canonical "Decision Gate (Part 3, Shape F.N)" citation
// form ONLY (verified 2026-07-02: the unique, unambiguous phrasing a command
// body uses to cite ITS OWN top-level Decision Gate against Canon Part 3),
// BODY TEXT ONLY (never the frontmatter). A bare "Shape F.N" mention
// elsewhere in a body (e.g. "render its Shape F.1 selector" describing a
// nested helper gate, or a numbered sub-stage like "B2: ... (Shape F.0,
// pre-room)") is a legitimate reference to a DIFFERENT, internal sub-decision
// and is deliberately NOT treated as a contradiction signal - a live-tree
// audit confirmed multiple such multi-gate commands (file-meeting.md,
// memory.md, new-project.md, systems-thinking.md) that are correctly wired
// and would otherwise false-positive under a naive "any Shape F.N mention"
// scan. Only futures.md uses this exact citation form in the entire commands/
// tree (grep-confirmed), which is why it is the phase's sole named drift case.
// Distinct F.N tokens are deduplicated and returned as e.g. ["F.1", "F.2"].
const BODY_SHAPE_MENTION_RE = /part\s+3,\s*shape\s+f\.(\d)/gi;

function extractBodyShapeMentions(bodyText) {
  const s = typeof bodyText === 'string' ? bodyText : '';
  const seen = new Set();
  let m;
  BODY_SHAPE_MENTION_RE.lastIndex = 0;
  while ((m = BODY_SHAPE_MENTION_RE.exec(s)) !== null) {
    seen.add('F.' + m[1]);
  }
  return Array.from(seen).sort();
}

// ---------------------------------------------------------------------------
// frontmatterToFixture(surface, fm, bodyText) -- build a check() fixture from a
// parsed surface frontmatter: lift hitl_shape/hitl_why/hitl_stages, and lift the
// nested connector.excluded/connector.reason into the flat connector_excluded/
// connector_reason fields check() reads.
//
// Phase 209-03 (B2): when bodyText is provided (checkTree() always supplies
// it for the live tree; callers that omit it get the old frontmatter-only
// fixture, so this is additive and backward-compatible), also lift the three
// declared-implies-wired signals: body_has_firing_block (the B1 STAMP_MARKER
// present), body_mentions_tool ('AskUserQuestion' present), body_shape_mentions
// (distinct "Shape F.N" tokens in the body), and allowed_tools (null when the
// frontmatter key is absent - unrestricted - else the parsed list).
// ---------------------------------------------------------------------------
function frontmatterToFixture(surface, fm, bodyText) {
  const fixture = { surface };
  if (fm && fm.hitl_shape !== undefined) fixture.hitl_shape = fm.hitl_shape;
  if (fm && fm.hitl_why !== undefined) fixture.hitl_why = fm.hitl_why;
  if (fm && fm.hitl_stages !== undefined) fixture.hitl_stages = fm.hitl_stages;
  const conn = fm && fm.connector;
  if (conn && typeof conn === 'object' && !Array.isArray(conn)) {
    if (conn.excluded === true) fixture.connector_excluded = true;
    if (typeof conn.reason === 'string') fixture.connector_reason = conn.reason;
  }

  if (typeof bodyText === 'string') {
    fixture.body_has_firing_block = bodyText.indexOf(STAMP_MARKER) !== -1;
    fixture.body_mentions_tool = bodyText.indexOf('AskUserQuestion') !== -1;
    fixture.body_shape_mentions = extractBodyShapeMentions(bodyText);

    const allowedToolsRaw = fm && fm['allowed-tools'];
    if (allowedToolsRaw === undefined || allowedToolsRaw === null) {
      fixture.allowed_tools = null;
    } else if (Array.isArray(allowedToolsRaw)) {
      fixture.allowed_tools = allowedToolsRaw;
    } else {
      // An inline scalar dialect: either a single tool ("Bash") or the B1
      // stamp's comma-append grant form ("Bash(node *), AskUserQuestion" -
      // bare comma-separated, no brackets - see scripts/stamp-firing-block.cjs
      // grantTool's scalar branch). Split on top-level commas so both forms
      // evaluate the same way as a multi-item list.
      fixture.allowed_tools = String(allowedToolsRaw)
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }
  }

  return fixture;
}

// ---------------------------------------------------------------------------
// checkPlanFrontmatter(fm) -- the pure --check-plan core (Task 2). Reuses the
// EXISTING R12 signal (cirs_relationship.surfaces_added) as the trigger: when a
// plan adds surfaces, it MUST carry a sibling hitl_declarations[] with one
// conformant entry per added surface. Returns { ok, errors[] }.
// ---------------------------------------------------------------------------
function checkPlanFrontmatter(fm) {
  const errors = [];
  const f = fm && typeof fm === 'object' ? fm : {};
  const rel = f.cirs_relationship;
  const added =
    rel && Array.isArray(rel.surfaces_added) ? rel.surfaces_added.filter((s) => typeof s === 'string' && s.trim() !== '') : [];

  if (added.length === 0) {
    return { ok: true, errors };
  }

  const decls = Array.isArray(f.hitl_declarations) ? f.hitl_declarations : null;
  if (!decls) {
    errors.push(
      'cirs_relationship.surfaces_added is non-empty but hitl_declarations is missing ' +
        '(every added surface must declare its Shape-F per docs/HITL-SHAPE-DECLARATION-CONTRACT.md)'
    );
    return { ok: false, errors };
  }

  const declared = new Set();
  for (const d of decls) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      errors.push('hitl_declarations has an entry that is not a map');
      continue;
    }
    const s = typeof d.surface === 'string' ? d.surface.trim() : '';
    if (s === '') {
      errors.push('hitl_declarations has an entry with no surface');
      continue;
    }
    const hasShape = d.hitl_shape !== undefined && d.hitl_shape !== null;
    const hasStages = d.hitl_stages !== undefined && d.hitl_stages !== null;
    const exempt =
      d.connector_excluded === true &&
      typeof d.connector_reason === 'string' &&
      d.connector_reason.trim() !== '';
    if (hasShape) {
      if (typeof d.hitl_why !== 'string' || d.hitl_why.trim() === '') {
        errors.push('hitl_declarations for ' + s + ': hitl_shape is present but hitl_why is missing');
      }
    } else if (hasStages) {
      // A stages declaration is accepted here; the surface-scan gate validates the array.
    } else if (exempt) {
      // A newly-added exempt skill is conformant via connector_excluded:true + reason.
    } else {
      errors.push(
        'hitl_declarations for ' + s + ': needs hitl_shape + hitl_why, or hitl_stages, ' +
          'or connector_excluded:true + connector_reason'
      );
    }
    declared.add(s);
  }

  for (const s of added) {
    if (!declared.has(s)) {
      errors.push(
        'surface ' + s + ' is in cirs_relationship.surfaces_added but has no hitl_declarations entry'
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// collectSurfaces() -- enumerate the FOUR declaring surface classes from disk,
// deterministically sorted. Returns [{ surface, file, klass }]. The surface count
// is whatever this walk finds; NO count is ever hardcoded (the
// surface_count_principle in data/hitl-shape-declaration-schema.json).
// ---------------------------------------------------------------------------
function collectSurfaces() {
  const surfaces = [];
  const root = resolveScanRoot();
  const commandsDir = path.join(root, 'commands');
  const agentsDir = path.join(root, 'agents');
  const pipelinesDir = path.join(root, 'pipelines');
  const skillsDir = path.join(root, 'skills');

  if (fs.existsSync(commandsDir)) {
    for (const f of fs.readdirSync(commandsDir).filter((x) => x.endsWith('.md')).sort()) {
      surfaces.push({ surface: 'commands/' + f, file: path.join(commandsDir, f), klass: 'command' });
    }
  }

  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir).filter((x) => x.endsWith('.md')).sort()) {
      surfaces.push({ surface: 'agents/' + f, file: path.join(agentsDir, f), klass: 'agent' });
    }
  }

  if (fs.existsSync(pipelinesDir)) {
    for (const d of fs.readdirSync(pipelinesDir).sort()) {
      const chain = path.join(pipelinesDir, d, 'CHAIN.md');
      if (fs.existsSync(chain)) {
        surfaces.push({ surface: 'pipelines/' + d + '/CHAIN.md', file: chain, klass: 'pipeline' });
      }
    }
  }

  if (fs.existsSync(skillsDir)) {
    for (const d of fs.readdirSync(skillsDir).sort()) {
      const skill = path.join(skillsDir, d, 'SKILL.md');
      if (fs.existsSync(skill)) {
        surfaces.push({ surface: 'skills/' + d + '/SKILL.md', file: skill, klass: 'skill' });
      }
    }
  }

  return surfaces;
}

// ---------------------------------------------------------------------------
// collectMcpToolSurfaces() -- Phase 198-04 (SPEC-2, Task 1) mirror of the SAME
// MCP-tool discovery build-connector-registry.cjs uses. An MCP tool is not a
// markdown surface (no frontmatter to parse), so this builds a check()
// fixture DIRECTLY from each module's own {tool, hitl_shape, hitl_why}
// descriptor instead of going through parseFrontmatter/frontmatterToFixture.
// Returns [{ surface, fixture }]. Zero Brain/network calls.
// ---------------------------------------------------------------------------
function collectMcpToolSurfaces() {
  const out = [];
  const raw = loadMcpToolDescriptors();
  for (const c of raw) {
    const tool = typeof c.tool === 'string' && c.tool
      ? c.tool
      : (typeof c.surface === 'string' && c.surface ? c.surface : 'unknown');
    const surface = 'mcp:' + tool;
    out.push({
      surface,
      fixture: {
        surface,
        hitl_shape: typeof c.hitl_shape === 'string' ? c.hitl_shape : undefined,
        hitl_why: typeof c.hitl_why === 'string' ? c.hitl_why : undefined,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// checkTree() -- the --check sweep over the live four-class tree. Parses each
// surface's frontmatter, builds a check() fixture, and classifies the pass
// results into { declared, skillExempt }. Returns
//   { ok, declared, skillExempt, scanned, violations[] }.
// The counts are COMPUTED from enumeration, never a literal.
// ---------------------------------------------------------------------------
function checkTree() {
  const vocab = loadSchema();
  if (vocab.fatal) {
    return { ok: false, declared: 0, skillExempt: 0, scanned: 0, violations: [vocab.fatal] };
  }

  const surfaces = collectSurfaces();
  const violations = [];
  let declared = 0;
  let skillExempt = 0;

  for (const s of surfaces) {
    let md;
    try {
      md = fs.readFileSync(s.file, 'utf8');
    } catch (_e) {
      violations.push(s.surface + ': cannot read file');
      continue;
    }
    const fm = parseFrontmatter(md);
    // Phase 209-03 (B2): the declared-implies-wired body/grant/shape-match
    // predicates are scoped to the 'command' surface class ONLY, matching the
    // B1 stamp's EXACT wiring domain (scripts/stamp-firing-block.cjs walks
    // only commands/*.md). Agents, pipelines, and skills are a DIFFERENT
    // wiring generation this phase does not touch; passing bodyText only for
    // s.klass === 'command' means frontmatterToFixture leaves the new fields
    // undefined for those classes, and check()'s predicates skip accordingly
    // (backward-compatible by construction - see the predicate comment).
    let bodyText;
    if (s.klass === 'command') {
      const fmMatch = /^---\r?\n[\s\S]*?\r?\n---/.exec(md);
      bodyText = fmMatch ? md.slice(fmMatch[0].length) : md;
    }
    const fixture = frontmatterToFixture(s.surface, fm, bodyText);
    const r = check(fixture, { vocab });
    if (!r.valid) {
      for (const v of r.violations) violations.push(v);
      continue;
    }
    const hasDecl = fixture.hitl_shape !== undefined || fixture.hitl_stages !== undefined;
    if (hasDecl) {
      declared += 1;
    } else {
      skillExempt += 1;
    }
  }

  // Phase 198-04 (SPEC-2, Task 1): mirror the SAME MCP-tool discovery into
  // this enumeration. A declared MCP tool with a missing/invalid hitl_shape is
  // caught by the SAME check() predicate every command/agent/pipeline/skill
  // surface above runs through -- advisory, WARN-and-enumerate (Phase 210
  // posture), never a hard block from this loop alone (main()'s --check
  // branch applies the SAME advisory-vs-strict gate uniformly over the whole
  // violations[] array, MCP tools included).
  const mcpSurfaces = collectMcpToolSurfaces();
  for (const m of mcpSurfaces) {
    const r = check(m.fixture, { vocab });
    if (!r.valid) {
      for (const v of r.violations) violations.push(v);
      continue;
    }
    const hasDecl = m.fixture.hitl_shape !== undefined || m.fixture.hitl_stages !== undefined;
    if (hasDecl) {
      declared += 1;
    } else {
      skillExempt += 1;
    }
  }

  return {
    ok: violations.length === 0,
    declared,
    skillExempt,
    scanned: surfaces.length + mcpSurfaces.length,
    violations,
  };
}

// ---------------------------------------------------------------------------
// CLI: --check (scan the live four-class tree; ADVISORY by default as of Phase
// 210 - WARN and exit 0 on violations; --strict restores the pre-210 hard-fail
// exit 1) | --check-plan <planpath...> (scan PLAN.md frontmatter). On clean,
// print a one-line OK summary and exit 0.
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--check-plan')) {
    const idx = argv.indexOf('--check-plan');
    const planPaths = argv.slice(idx + 1).filter((a) => !a.startsWith('--'));
    if (planPaths.length === 0) {
      console.error('usage: node scripts/check-shape-declaration.cjs --check-plan <planpath...>');
      process.exit(2);
      return;
    }
    const allErrors = [];
    for (const p of planPaths) {
      let md;
      try {
        md = fs.readFileSync(p, 'utf8');
      } catch (_e) {
        allErrors.push(p + ': cannot read plan file');
        continue;
      }
      const fm = parseFrontmatter(md);
      const res = checkPlanFrontmatter(fm);
      if (!res.ok) {
        for (const e of res.errors) allErrors.push(p + ': ' + e);
      }
    }
    if (allErrors.length) {
      console.error(allErrors.join('\n'));
      console.error(
        'Recovery: add a hitl_declarations: array to the plan frontmatter with one ' +
          '{surface, hitl_shape, hitl_why} (or {surface, hitl_stages}, or {surface, ' +
          'connector_excluded:true, connector_reason}) entry per surface in ' +
          'cirs_relationship.surfaces_added, per docs/HITL-SHAPE-DECLARATION-CONTRACT.md.'
      );
      process.exit(1);
      return;
    }
    console.log('check-shape-declaration: OK (' + planPaths.length + ' plan(s))');
    return;
  }

  if (argv.includes('--check')) {
    const strict = argv.includes('--strict');
    const report = checkTree();
    if (!report.ok) {
      if (strict) {
        // The pre-210 hard-fail contract, preserved as the --strict opt-in.
        console.error('SHAPE DECLARATION VIOLATION:');
        for (const v of report.violations) console.error('  - ' + v);
        console.error(
          'Recovery: run node scripts/backfill-hitl-shape.cjs, or hand-author the ' +
            'missing declaration per docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add ' +
            'connector.excluded:true + reason if this skill reaches no fork.'
        );
        console.error('strict mode: exiting 1 (--strict restores the pre-Phase-210 hard-fail contract)');
        process.exit(1);
        return;
      }
      // Phase 210-02 (item 210-A): advisory default. Every violation is still
      // DETECTED and ENUMERATED (the lint signal survives, all four checks);
      // only the exit-1 block is removed. Mirrors the doctor.cjs WARN-not-fail
      // idiom (the agentshield acceptance entry).
      console.error(
        'WARN: shape-declaration advisory (Phase 210): ' + report.violations.length +
          ' violation(s) detected; not blocking (run with --strict to restore hard-fail)'
      );
      for (const v of report.violations) console.error('WARN:   - ' + v);
      console.error(
        'Recovery: run node scripts/backfill-hitl-shape.cjs, or hand-author the ' +
          'missing declaration per docs/HITL-SHAPE-DECLARATION-CONTRACT.md, or add ' +
          'connector.excluded:true + reason if this skill reaches no fork.'
      );
      return;
    }
    console.log(
      'check-shape-declaration: OK (' +
        report.declared + ' declared, ' +
        report.skillExempt + ' skill-exempt, ' +
        (report.declared + report.skillExempt) + ' scanned)' +
        (strict ? ' [strict mode]' : '')
    );
    return;
  }

  console.error(
    'usage: node scripts/check-shape-declaration.cjs [--check [--strict] | --check-plan <planpath...>]'
  );
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  loadSchema,
  check,
  checkAll,
  checkPlanFrontmatter,
  isRankerConsumer,
  parseFrontmatter,
  frontmatterToFixture,
  collectSurfaces,
  checkTree,
  RANKER_MODULES,
  extractBodyShapeMentions,
};
