#!/usr/bin/env node
'use strict';

/*
 * scripts/backfill-layer.cjs
 *
 * Phase 344 Plan 03 (LAYER-06): the layer declaration backfill.
 *
 * Writes the closed layer_vocabulary (data/layer-declaration-schema.json) into
 * every declaring surface's own frontmatter, one mechanical, auditable,
 * idempotent pass at a time -- the identical shape scripts/backfill-hitl-shape.cjs
 * (Phase 190-02) already proved for hitl_shape (Canon Part 7, reuse before
 * build). This is a NEW file, not an edit of that one, because the key set is
 * different (layer / layer_why, never hitl_shape / hitl_stages / hitl_why) and
 * the propose step below has no hitl-shape analog.
 *
 * THREE MODES, one bare process.argv switch, no Commander:
 *
 *   node scripts/backfill-layer.cjs --propose --class=command|agent|pipeline|skill
 *     Reads the closed six-step rubric from data/layer-declaration-schema.json,
 *     applies it to every surface of the named class using ONLY facts the
 *     surface already declares (its own frontmatter plus data/command-registry.json
 *     for the command class), and WRITES data/layer-backfill.json. Never touches a
 *     surface file. Merges into the existing map so re-running --propose for one
 *     class never erases another class's already-authored rows (the reason 344-04
 *     can extend this same map for agent/pipeline/skill without re-proposing the
 *     command class this plan ships). Any surface the rubric cannot decide gets
 *     the literal layer "unresolved" plus rubric_stopped_at, the step number that
 *     ran out of signal -- never a guess.
 *
 *   node scripts/backfill-layer.cjs --check
 *     Dry run: prints every surface that WOULD change and exits 1 if any would;
 *     writes nothing.
 *
 *   node scripts/backfill-layer.cjs
 *     Apply. Inserts or updates ONLY the layer and layer_why keys named as a map
 *     entry. Every other frontmatter key, every body line, and every byte outside
 *     the layer block is preserved exactly (the non-destructive contract, copied
 *     verbatim from scripts/backfill-hitl-shape.cjs:21-26). Refuses to apply
 *     while any map value is "unresolved": exits 1 naming every unresolved entry,
 *     so a judgment call is made in data, in a diff, never silently inside a
 *     script.
 *
 * NON-DESTRUCTIVE CONTRACT (copied verbatim from backfill-hitl-shape.cjs): only
 * layer / layer_why are ever inserted or updated. A skill's nested connector:
 * block stays byte-identical; the layer keys are ROOT-level siblings of it,
 * never merged into it.
 *
 * Canon Part 8: LOCAL-only. node:fs + node:path only. Zero network, zero Brain
 * reach, zero room access.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BACKFILL_PATH = path.join(REPO_ROOT, 'data', 'layer-backfill.json');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'layer-declaration-schema.json');
const COMMAND_REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');

const { collectSurfaces, parseFrontmatter } = require('./check-shape-declaration.cjs');

// The ONLY frontmatter keys this generator ever inserts or updates.
const LAYER_KEYS = Object.freeze(['layer', 'layer_why']);

const VALID_CLASSES = Object.freeze(['command', 'agent', 'pipeline', 'skill']);

// ---------------------------------------------------------------------------
// loadRubric() -- reads the closed vocabulary and the six-step rubric. A
// missing schema or a schema missing the rubric array is fatal, never a
// silent pass (mirrors scripts/check-layer-declaration.cjs's own
// loadLayerSchema() fail-closed contract).
// ---------------------------------------------------------------------------
function loadRubric() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(SCHEMA_PATH + ' is missing -- cannot propose without the closed layer vocabulary');
  }
  const parsed = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const doc = parsed && parsed._doc;
  const vocabulary = doc && Array.isArray(doc.layer_vocabulary) ? doc.layer_vocabulary : null;
  const rubric = doc && Array.isArray(doc.classification_rubric) ? doc.classification_rubric : null;
  if (!vocabulary || !rubric) {
    throw new Error(SCHEMA_PATH + ' carries no _doc.layer_vocabulary or no _doc.classification_rubric');
  }
  return { vocabulary, rubric };
}

// ---------------------------------------------------------------------------
// loadCommandRegistry() -- the per-command facts the rubric reads for the
// command class: kind, produces, autonomous_safe, body_shape, serves_jtbd.
// Returns a Map keyed by "commands/<name>.md". Missing/unreadable registry is
// non-fatal for propose (the frontmatter-only signals still fire); it just
// narrows what step 2/4 can see.
// ---------------------------------------------------------------------------
function loadCommandRegistry() {
  const out = new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(COMMAND_REGISTRY_PATH, 'utf8'));
    const cmds = parsed && parsed.commands;
    if (cmds && typeof cmds === 'object') {
      for (const key of Object.keys(cmds)) {
        const entry = cmds[key];
        const name = typeof entry.command === 'string' ? entry.command.replace(/^\/mos:/, '') : null;
        if (name) out.set('commands/' + name + '.md', entry);
      }
    }
  } catch (_e) {
    // Non-fatal: propose still runs on frontmatter-only signals.
  }
  return out;
}

// ---------------------------------------------------------------------------
// classifySurface(fm, klass, registryEntry) -- the six-step rubric, in the
// order data/layer-declaration-schema.json declares it (widest scope first,
// first match wins). Uses ONLY facts the surface already declares: its own
// frontmatter, plus (for the command class) the generated command registry's
// kind / produces fields. Returns { layer } when a step fires, or
// { layer: 'unresolved', rubric_stopped_at } when none of the mechanical
// signals below can decide -- the honest signal that a human must read the
// surface's own purpose and resolve it by hand in the map (never guessed here).
//
// Step 1 (graph): a pipeline CHAIN.md is graph by definition (it IS the
// coordination mechanism). A command/agent is graph when it declares
// multi-agent or multi-step coordination: hitl_stages present (a staged,
// gated or ordered flow -- even a single named stage uses the stages dialect
// deliberately, per scripts/backfill-hitl-shape.cjs's own emission-order
// comment distinguishing hitl_shape from hitl_stages), a synthesizer field
// (a fan-out-then-synthesize pattern), kind: meta (a command whose entire job
// is picking or dispatching another flow), or concurrency: parallel.
//
// Step 2 (loop): kind: methodology (a single agent's cycle to a stopping
// condition, filing a methodology artifact) -- checked only after step 1, so
// a methodology-kind surface that ALSO carries hitl_stages or a synthesizer
// (a multi-gate or fan-out methodology command) is correctly graph, not loop.
//
// Steps 3-5 (harness / context / prompt) have no single frontmatter-only
// signal reliable enough to fire without reading what the surface actually
// does (the rubric's own step 3-5 signals name behaviors -- touches room.db,
// writes ROOM.md, shapes voice -- not frontmatter keys). One narrow structural
// exception is mechanized here: a produces path landing on one of the
// canonical context files (STATE.md, ROOM.md, USER.md, FEYNMAN.md, CONTEXT.md)
// is context by construction (the rubric's own step 4 signal, verbatim).
// Everything else stops at step 3 as unresolved for hand resolution.
// ---------------------------------------------------------------------------
function classifySurface(fm, klass, registryEntry) {
  const f = fm && typeof fm === 'object' ? fm : {};

  // Step 1: graph.
  if (klass === 'pipeline') {
    return { layer: 'graph' };
  }
  const hasStages = Array.isArray(f.hitl_stages) && f.hitl_stages.length > 0;
  const hasSynthesizer = typeof f.synthesizer === 'string' && f.synthesizer.trim() !== '';
  const kind = registryEntry && typeof registryEntry.kind === 'string' ? registryEntry.kind : (typeof f.kind === 'string' ? f.kind : null);
  const isMeta = kind === 'meta';
  const isParallel = f.concurrency === 'parallel';
  if (hasStages || hasSynthesizer || isMeta || isParallel) {
    return { layer: 'graph' };
  }

  // Step 2: loop.
  if (kind === 'methodology') {
    return { layer: 'loop' };
  }

  // Step 4 (context), the one mechanizable structural exception: a produces
  // path that lands on a canonical context file.
  const produces = registryEntry && typeof registryEntry.produces === 'string' ? registryEntry.produces : (typeof f.produces === 'string' ? f.produces : null);
  if (produces && /(?:^|\/)(?:STATE|ROOM|USER|FEYNMAN|CONTEXT)\.md$/.test(produces)) {
    return { layer: 'context' };
  }

  // Steps 3, 5, 6 have no reliable frontmatter-only signal. Stop at step 3
  // (harness) and let a human read the surface's own purpose.
  return { layer: 'unresolved', rubric_stopped_at: 3 };
}

// ---------------------------------------------------------------------------
// classPatternForKey(key) -- which class a map key belongs to, used by
// --propose to scope which existing map entries get replaced.
// ---------------------------------------------------------------------------
function classPatternForKey(key) {
  if (/^commands\/.*\.md$/.test(key)) return 'command';
  if (/^agents\/.*\.md$/.test(key)) return 'agent';
  if (/^pipelines\/[^/]+\/CHAIN\.md$/.test(key)) return 'pipeline';
  if (/^skills\/[^/]+\/SKILL\.md$/.test(key)) return 'skill';
  return null;
}

// ---------------------------------------------------------------------------
// propose({ klass }) -- enumerate every surface of klass, classify it, and
// merge the result into the existing data/layer-backfill.json (creating it if
// absent). Returns the full merged map that was written.
//
// SAFE-RE-RUN CONTRACT: an already-resolved entry (layer !== "unresolved",
// whether the rubric decided it mechanically or a human hand-resolved it in
// the map after a prior propose) is NEVER overwritten by re-running --propose
// for the same class. Only two things change a class's rows on a re-run:
// a surface newly appearing on disk (classified fresh), or a surface still
// carrying the literal "unresolved" from a prior run (re-classified, in case
// the rubric or its inputs changed). A surface removed from disk since the
// last propose is dropped. This is what makes the Task 1 acceptance gate's
// own verify command (`--propose` immediately followed by the no-unresolved
// assertion) meaningful after hand resolution, and what lets a later plan
// re-run `--propose --class=agent` without disturbing this plan's
// already-ratified command rows.
// ---------------------------------------------------------------------------
function propose(klass) {
  if (!VALID_CLASSES.includes(klass)) {
    throw new Error('propose: --class must be one of ' + VALID_CLASSES.join('|') + ', got "' + klass + '"');
  }

  let existing = {};
  if (fs.existsSync(BACKFILL_PATH)) {
    existing = JSON.parse(fs.readFileSync(BACKFILL_PATH, 'utf8'));
  }

  const registry = klass === 'command' ? loadCommandRegistry() : new Map();
  const surfaces = collectSurfaces().filter((s) => s.klass === klass);
  const liveKeys = new Set(surfaces.map((s) => s.surface));

  // Start from every OTHER class's rows, untouched, plus this class's rows
  // that are both still resolved AND still on disk.
  const kept = {};
  for (const key of Object.keys(existing)) {
    if (classPatternForKey(key) !== klass) {
      kept[key] = existing[key];
      continue;
    }
    if (liveKeys.has(key) && existing[key] && existing[key].layer !== 'unresolved') {
      kept[key] = existing[key];
    }
  }

  for (const s of surfaces) {
    if (Object.prototype.hasOwnProperty.call(kept, s.surface)) continue;
    let text = '';
    try {
      text = fs.readFileSync(s.file, 'utf8');
    } catch (_e) {
      text = '';
    }
    const fm = parseFrontmatter(text);
    const registryEntry = registry.get(s.surface) || null;
    const result = classifySurface(fm, s.klass, registryEntry);
    kept[s.surface] = result;
  }

  fs.writeFileSync(BACKFILL_PATH, JSON.stringify(sortMap(kept), null, 2) + '\n');
  return kept;
}

function sortMap(map) {
  const out = {};
  for (const key of Object.keys(map).sort()) out[key] = map[key];
  return out;
}

// ---------------------------------------------------------------------------
// renderLayerLines(entry) -- serialize the layer block as frontmatter lines.
// ---------------------------------------------------------------------------
function renderLayerLines(entry) {
  const lines = [];
  if (Object.prototype.hasOwnProperty.call(entry, 'layer')) {
    lines.push('layer: ' + JSON.stringify(entry.layer));
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'layer_why') && entry.layer_why) {
    lines.push('layer_why: ' + JSON.stringify(entry.layer_why));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// stripLayerLines(innerLines) -- remove any pre-existing layer-key lines,
// giving idempotency: strip-then-reinsert at the same deterministic position
// reproduces the input byte-for-byte on an already-conformant file.
// ---------------------------------------------------------------------------
function stripLayerLines(innerLines) {
  const out = [];
  for (const line of innerLines) {
    if (/^layer:/.test(line)) continue;
    if (/^layer_why:/.test(line)) continue;
    out.push(line);
  }
  return out;
}

// ---------------------------------------------------------------------------
// patchSurface(content, entry) -- the pure string transform. Inserts the
// layer block immediately AFTER body_shape: when present, else at the END of
// the frontmatter block. Every other line is byte-identical. Throws on a file
// with no frontmatter block.
// ---------------------------------------------------------------------------
function patchSurface(content, entry) {
  if (typeof content !== 'string') {
    throw new Error('patchSurface: content must be a string');
  }
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) {
    throw new Error('patchSurface: no frontmatter block found');
  }
  const nl = content.indexOf('\r\n') !== -1 ? '\r\n' : '\n';
  const innerLines = m[1].split(/\r?\n/);

  const clean = stripLayerLines(innerLines);

  let insertAt = -1;
  for (let i = 0; i < clean.length; i++) {
    if (/^body_shape:/.test(clean[i])) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt === -1) insertAt = clean.length;

  const layerLines = renderLayerLines(entry);
  const finalInner = clean.slice(0, insertAt).concat(layerLines, clean.slice(insertAt));

  const rebuiltInner = finalInner.join(nl);
  const rest = content.slice(m[0].length);
  const rebuilt = '---' + nl + rebuiltInner + nl + '---' + rest;

  return rebuilt === content ? content : rebuilt;
}

// ---------------------------------------------------------------------------
// runBackfill({ map, rootDir, check }) -- iterate the map keys, patch each
// named file, and either report (check) or write (apply). Files ABSENT from
// the map are never resolved and never opened.
// ---------------------------------------------------------------------------
function runBackfill(opts) {
  const map = opts && opts.map;
  const rootDir = (opts && opts.rootDir) || REPO_ROOT;
  const check = !!(opts && opts.check);
  if (!map || typeof map !== 'object') {
    throw new Error('runBackfill: opts.map is required');
  }

  const changed = [];
  const unchanged = [];
  const wouldChange = [];
  const missing = [];
  const errors = [];

  for (const key of Object.keys(map)) {
    const abs = path.join(rootDir, key);
    if (!fs.existsSync(abs)) {
      missing.push(key);
      continue;
    }
    let before;
    try {
      before = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      errors.push(key + ': ' + (e && e.message ? e.message : String(e)));
      continue;
    }
    let after;
    try {
      after = patchSurface(before, map[key]);
    } catch (e) {
      errors.push(key + ': ' + (e && e.message ? e.message : String(e)));
      continue;
    }
    if (after === before) {
      unchanged.push(key);
      continue;
    }
    if (check) {
      wouldChange.push(key);
      continue;
    }
    fs.writeFileSync(abs, after);
    changed.push(key);
  }

  return { changed, unchanged, wouldChange, missing, errors };
}

// ---------------------------------------------------------------------------
// findUnresolved(map) -- every key whose layer is the literal "unresolved".
// ---------------------------------------------------------------------------
function findUnresolved(map) {
  return Object.keys(map).filter((k) => map[k] && map[k].layer === 'unresolved');
}

// ---------------------------------------------------------------------------
// main() -- CLI entry.
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const isPropose = argv.includes('--propose');
  const isCheck = argv.includes('--check');

  if (isPropose) {
    const classArg = argv.find((a) => a.startsWith('--class='));
    const klass = classArg ? classArg.slice('--class='.length) : null;
    if (!klass) {
      console.error('backfill-layer --propose: --class=command|agent|pipeline|skill is required');
      process.exit(1);
      return;
    }
    let map;
    try {
      map = propose(klass);
    } catch (e) {
      console.error('backfill-layer --propose: ' + (e && e.message ? e.message : String(e)));
      process.exit(1);
      return;
    }
    const total = Object.keys(map).length;
    const unresolvedCount = findUnresolved(map).length;
    console.log(
      'backfill-layer --propose --class=' + klass + ': wrote ' + total + ' total map entries (' +
        unresolvedCount + ' unresolved)'
    );
    return;
  }

  let map;
  try {
    map = JSON.parse(fs.readFileSync(BACKFILL_PATH, 'utf8'));
  } catch (e) {
    console.error('backfill-layer: cannot read ' + BACKFILL_PATH + ': ' + (e && e.message));
    process.exit(1);
    return;
  }

  if (isCheck) {
    const res = runBackfill({ map, rootDir: REPO_ROOT, check: true });
    if (res.missing.length) {
      console.error('MISSING (map key with no file on disk): ' + res.missing.join(', '));
    }
    if (res.errors.length) {
      console.error('ERRORS:\n  ' + res.errors.join('\n  '));
    }
    if (res.wouldChange.length) {
      console.error('backfill-layer --check: ' + res.wouldChange.length + ' surface(s) would change:');
      for (const k of res.wouldChange) console.error('  ' + k);
    }
    if (res.wouldChange.length || res.missing.length || res.errors.length) {
      console.error('Recovery: run node scripts/backfill-layer.cjs');
      process.exit(1);
      return;
    }
    console.log('backfill-layer: OK (' + res.unchanged.length + ' surfaces already conformant)');
    return;
  }

  // Apply. Refuse while any map value is unresolved.
  const unresolved = findUnresolved(map);
  if (unresolved.length) {
    console.error('backfill-layer: refusing to apply, ' + unresolved.length + ' unresolved entr' + (unresolved.length === 1 ? 'y' : 'ies') + ':');
    for (const k of unresolved) console.error('  ' + k);
    process.exit(1);
    return;
  }

  const res = runBackfill({ map, rootDir: REPO_ROOT, check: false });
  if (res.missing.length) {
    console.error('MISSING (map key with no file on disk): ' + res.missing.join(', '));
  }
  if (res.errors.length) {
    console.error('ERRORS:\n  ' + res.errors.join('\n  '));
  }
  if (res.missing.length || res.errors.length) {
    process.exit(1);
    return;
  }
  console.log(
    'backfill-layer: ' + res.changed.length + ' changed, ' + res.unchanged.length + ' unchanged (' +
      (res.changed.length + res.unchanged.length) + ' surfaces total)'
  );
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    loadRubric,
    loadCommandRegistry,
    classifySurface,
    propose,
    renderLayerLines,
    stripLayerLines,
    patchSurface,
    runBackfill,
    findUnresolved,
    main,
    LAYER_KEYS,
    BACKFILL_PATH,
    VALID_CLASSES,
  };
}
