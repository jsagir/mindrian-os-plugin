#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 122-04 -- /mos:suggest-next CLI helper (the resolver-composed command sequence)
 * ====================================================================================
 * The script behind commands/suggest-next.md. Reads the room's ProblemType
 * (and active JTBD, if present) from room/STATE.md, runs the chain recommender
 * (lib/brain/chain-recommender.cjs recommendFrameworkChain -- a FEEDS_INTO
 * traversal over framework names + problem-type enums; Canon Part 8: never a
 * command string, never user content), composes that framework chain into a
 * /mos: command SEQUENCE via the resolver (lib/workflow/command-resolver.cjs
 * composeWorkflow -- the only door), and prints BOTH the framework chain and
 * its command sequence. A framework with no /mos: command renders as
 * "(no /mos: for this -- run it manually)" (degrade, do not fabricate).
 *
 * Larry NEVER names a /mos: command from memory: every command line here came
 * back from composeWorkflow / the generated data/command-registry.json.
 *
 * Usage:
 *   node scripts/suggest-next-command.cjs
 *   node scripts/suggest-next-command.cjs --problem-type ill-defined
 *   node scripts/suggest-next-command.cjs --from-framework "Beautiful Question Framework"
 *   node scripts/suggest-next-command.cjs --room /path/to/room
 *
 * Rendering: Shape B (Semantic Tree) per skills/ui-system/SKILL.md -- the
 * declared body_shape for /mos:suggest-next. No bespoke format.
 *
 * Graceful: no room / no ProblemType / no Brain -> framework-only advice that
 * STILL goes through the resolver for whatever frameworks it has (a true
 * statement at every layer). Never throws to the user; always exit 0.
 *
 * Three-surface compatible: pure CJS, node built-ins only, zero network here
 * (the Brain query, if any, is the recommender's FEEDS_INTO traversal through
 * the existing brain-client chokepoint -- not this script's surface).
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const recommender = require(path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs'));
const resolver = require(path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs'));
// Phase 121.5-10 Sub-plan K (audit Section 5.3 highest-leverage promotion):
// promote /mos:suggest-next from NONE to F.1 via rankForSelector + pickShape.
// The locked Brain-suggestion content template (chip + question line + two-
// line dense option rows + stat-strip footer) renders into stdout via the
// dispatcher; the underlying recommender/resolver workflow is preserved
// (Larry NEVER names a /mos: from memory; every command came from
// composeWorkflow / the generated registry).
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));
const jtbdTaxonomy = require(path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json'));

// ---------- argv parsing (process.argv switch, mindrian-tools style) ----------

function parseArgs(argv) {
  const out = { problemType: null, fromFramework: null, roomDir: null };
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--problem-type' || a === '--from-problem-type') { out.problemType = args[i + 1] || null; i += 1; }
    else if (a === '--from-framework' || a === '--framework') { out.fromFramework = args[i + 1] || null; i += 1; }
    else if (a === '--room') { out.roomDir = args[i + 1] || null; i += 1; }
    else if (a.startsWith('--problem-type=')) { out.problemType = a.slice('--problem-type='.length); }
    else if (a.startsWith('--from-problem-type=')) { out.problemType = a.slice('--from-problem-type='.length); }
    else if (a.startsWith('--from-framework=')) { out.fromFramework = a.slice('--from-framework='.length); }
    else if (a.startsWith('--room=')) { out.roomDir = a.slice('--room='.length); }
  }
  return out;
}

// ---------- room state reading (light; reuses what the command already does) ----------

function resolveRoomDir(explicit) {
  if (explicit && typeof explicit === 'string') {
    const p = path.resolve(explicit);
    if (isRoom(p)) return p;
    const nested = path.join(p, 'room');
    if (isRoom(nested)) return nested;
    return null;
  }
  // Common layouts: ./room, . (if it has STATE.md / .room-root).
  const cwd = process.cwd();
  const candidates = [path.join(cwd, 'room'), cwd];
  for (const c of candidates) if (isRoom(c)) return c;
  return null;
}

function isRoom(dir) {
  try {
    if (!fs.statSync(dir).isDirectory()) return false;
  } catch (_e) { return false; }
  return fs.existsSync(path.join(dir, 'STATE.md')) || fs.existsSync(path.join(dir, '.room-root'));
}

// Read a ProblemType / Problem Type / active JTBD from STATE.md. Tolerant of
// both "Problem Type: IDP" prose lines and "problem_type: ill-defined"
// frontmatter lines. Returns { problemType, activeJtbd } (either may be null).
function readRoomState(roomDir) {
  const out = { problemType: null, activeJtbd: null };
  if (!roomDir) return out;
  let text = null;
  try { text = fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8'); }
  catch (_e) { return out; }
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    let m = /^[-*\s>|`]*problem[\s_-]*type\s*[:=]\s*(.+?)\s*$/i.exec(line);
    if (m && out.problemType === null) out.problemType = stripMd(m[1]);
    m = /^[-*\s>|`]*active[\s_-]*jtbd\s*[:=]\s*(.+?)\s*$/i.exec(line);
    if (m && out.activeJtbd === null) out.activeJtbd = stripMd(m[1]);
    m = /^[-*\s>|`]*jtbd[\s_-]*id\s*[:=]\s*(.+?)\s*$/i.exec(line);
    if (m && out.activeJtbd === null) out.activeJtbd = stripMd(m[1]);
  }
  return out;
}

function stripMd(s) {
  return String(s).replace(/^["'\[\(]+/, '').replace(/["'\]\)]+$/, '').replace(/`/g, '').trim() || null;
}

// ---------- render (Shape B: Semantic Tree) ----------

function buildHeader(roomDir, roomState) {
  const name = roomDir ? path.basename(path.resolve(roomDir, '..')) || 'room' : 'no room';
  return '-- ' + (roomDir ? name : 'MindrianOS') + ' -- suggest-next' +
    (roomState && roomState.problemType ? ' -- ProblemType: ' + roomState.problemType : '') + ' --';
}

function renderSequence(workflow) {
  // Shape B: a step-numbered list, one line per step:
  //   1. <framework>  ->  <command>
  //   2. <framework>  ->  (no /mos: for this -- run it manually)
  const lines = [];
  for (const s of workflow) {
    const fw = s && typeof s.framework === 'string' ? s.framework : '(unknown framework)';
    const cmd = (s && typeof s.command === 'string' && s.command.length > 0)
      ? s.command
      : '(no /mos: for this -- run it manually)';
    lines.push('  ' + String(s.step) + '. ' + fw + '  ->  ' + cmd);
  }
  return lines.join('\n');
}

function actionFooter(workflow) {
  // Zone 4 fallback (only used when ranker returns zero items -- Tier 0 / no
  // packet / empty registry). Renders 2-3 grounded /mos: commands. Pull the
  // first runnable command from the workflow as the primary; always offer
  // /mos:status as a fallback. Live F.1 path uses the locked Brain-suggestion
  // template instead (Phase 121.5-10 Sub-plan K).
  const first = workflow.find(function (s) { return s && typeof s.command === 'string' && s.command.length > 0; });
  const lines = ['', '---'];
  if (first) lines.push('> ' + first.command + '  -- start the chain here');
  lines.push('> /mos:pipeline --from-problem-type <x>  -- run a Brain-derived chain end to end');
  lines.push('> /mos:status  -- see the room state this was computed from');
  return lines.join('\n') + '\n';
}

// Phase 121.5-10 Sub-plan K (audit Section 5.3): render the locked Brain-
// suggestion content template via pickShape({ requestedShape: 'F.1',
// payload: { brain_suggestion_variant: true, ... }}). Returns the composed
// rendered string (header + body + footer + AskUserQuestion trailer) ready
// for stdout. Falls back to null when the ranker returns zero items so the
// caller can route to the Tier-0 framework-only path.
function renderBrainSuggestionF1(items, roomState) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const optionRows = items.map(function (it, i) {
    const conf = (typeof it.score === 'number') ? it.score : 0;
    const glyph = (conf >= 0.7) ? '▶' : '▷';
    const category = (typeof it.category === 'string') ? it.category : '';
    const rel = (typeof it.graph_relationship === 'string') ? it.graph_relationship : '';
    const sep = (category.length > 0 && rel.length > 0) ? ' · ' : '';
    return {
      glyph: glyph,
      number: i + 1,
      verb: it.command,
      confPct: Math.round(conf * 100),
      meta: category + sep + rel,
    };
  });
  // Determine top-K of N for the footer stat strip. We do not have the
  // pre-clamp total here (rankForSelector clamps internally), so we use
  // items.length as both top-K and N -- the more accurate "N" would be the
  // full registry size pre-clamp; left as a v2 refinement.
  const k = items.length;
  const aliasMap = (jtbdTaxonomy && jtbdTaxonomy.alias_map && jtbdTaxonomy.alias_map.verb_aliases)
    ? jtbdTaxonomy.alias_map.verb_aliases : {};
  const topScore = (typeof items[0].score === 'number') ? items[0].score : 0;
  const result = dispatcher.pickShape({
    requestedShape: 'F.1',
    payload: {
      brain_suggestion_variant: true,
      header: '[■ BRAIN]',
      questionLine: 'Choose next move:',
      verbs: items.map(function (it) { return it.command; }),
      alias_map: aliasMap,
      recommendedVerb: (topScore >= 0.7) ? items[0].command : null,
      optionRows: optionRows,
      footer: '▶ Brain · top-' + k + ' of ' + k + ' ranked · cyan = informing',
    },
  });
  if (!result || result.shape === 'error' || !result.rendered) return null;
  const zones = result.rendered.zones || {};
  const header = (typeof zones.header === 'string') ? zones.header : '';
  const body = (typeof zones.body === 'string') ? zones.body : '';
  const footer = (typeof zones.footer === 'string') ? zones.footer : '';
  return header + '\n\n' + body + '\n\n' + footer + '\n';
}

// ---------- main ----------

function main(argv) {
  const args = parseArgs(argv || process.argv);
  const roomDir = resolveRoomDir(args.roomDir);
  const roomState = readRoomState(roomDir);

  // Seed inputs: explicit CLI flags win; otherwise fall back to the room's
  // ProblemType / active JTBD. The recommender REUSES problem-type-router and
  // framework-chain-composer -- it does not re-derive the routing here.
  const opts = {};
  if (args.fromFramework) opts.currentFramework = args.fromFramework;
  if (args.problemType) opts.problemType = args.problemType;
  if (roomState.problemType || roomState.activeJtbd) {
    opts.roomState = {
      problemType: roomState.problemType || undefined,
      activeJtbd: roomState.activeJtbd || undefined,
    };
  }

  // Recommend the framework chain (FEEDS_INTO traversal; framework names +
  // enums only), then compose the /mos: command SEQUENCE via the resolver.
  const frameworkChain = recommender.recommendFrameworkChain(opts);
  const workflow = resolver.composeWorkflow(frameworkChain);

  const hasKnownType = Boolean(args.problemType || args.fromFramework || roomState.problemType || roomState.activeJtbd);

  // Phase 121.5-10 Sub-plan K (audit Section 5.3): try the locked Brain-
  // suggestion F.1 surface first via rankForSelector + pickShape. The
  // ranker returns scored items[] with category + graph_relationship for
  // the meta row; pickShape applies the locked template overlay (chip +
  // question line + two-line dense rows + stat-strip footer). If the
  // ranker returns zero items (Tier 0 / no registry content), fall back
  // to the legacy Shape B + actionFooter render so this command stays
  // useful even in degraded environments.
  const rankerRoomState = {};
  if (roomState.problemType) rankerRoomState.problemType = roomState.problemType;
  if (roomState.activeJtbd) rankerRoomState.activeJtbd = roomState.activeJtbd;
  let rankedItems = [];
  try {
    rankedItems = ranker.rankForSelector({
      jtbd: roomState.activeJtbd || null,
      problemType: roomState.problemType || null,
      roomState: rankerRoomState,
      packetOptional: null,
      k: 3,
    });
  } catch (_e) {
    rankedItems = [];
  }
  const brainRender = renderBrainSuggestionF1(rankedItems, roomState);

  const out = [];
  out.push(buildHeader(roomDir, roomState));
  out.push('');
  if (!hasKnownType) {
    out.push('No ProblemType set yet -- this is framework-only advice (it still');
    out.push('routes every framework through the resolver; set a ProblemType or');
    out.push('pass --problem-type / --from-framework for a full Brain-derived chain).');
    out.push('');
  }
  out.push('Recommended framework chain:');
  out.push('  ' + frameworkChain.join('  ->  '));
  out.push('');
  out.push('Command sequence (resolver-composed -- run in order):');
  out.push(renderSequence(workflow));
  // Note any manual-only steps explicitly.
  const manual = workflow.filter(function (s) { return !(s && typeof s.command === 'string' && s.command.length > 0); });
  if (manual.length > 0) {
    out.push('');
    out.push('Run manually (no /mos: for these yet): ' + manual.map(function (s) { return s.framework; }).join(', '));
  }
  process.stdout.write(out.join('\n') + '\n');
  if (brainRender !== null) {
    process.stdout.write('\n');
    process.stdout.write(brainRender);
  } else {
    process.stdout.write(actionFooter(workflow));
  }
  process.exit(0);
}

if (require.main === module) {
  try {
    main(process.argv);
  } catch (err) {
    process.stdout.write('suggest-next could not be computed.\n');
    process.stdout.write('  Reason: ' + (err && err.message ? err.message : 'unknown') + '\n');
    process.stdout.write('> /mos:status  -- check the room state\n');
    process.exit(0);
  }
}

module.exports = {
  parseArgs: parseArgs,
  resolveRoomDir: resolveRoomDir,
  readRoomState: readRoomState,
  renderSequence: renderSequence,
  // Phase 121.5-10 Sub-plan K: locked Brain-suggestion F.1 renderer exported
  // for direct testing (lib/memory/brain-suggestion-template.test.cjs).
  renderBrainSuggestionF1: renderBrainSuggestionF1,
  main: main,
};
