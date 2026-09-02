#!/usr/bin/env node
'use strict';

/*
 * check-framework-vocabulary-drift.cjs
 *
 * Phase 254 Plan 03 - the WIRE-04 build gate.
 *
 * WHY THIS EXISTS. There are three framework vocabularies in this repo and
 * they already disagree. `lib/core/framework-chain-composer.cjs`'s
 * `KNOWN_FRAMEWORKS` holds 18 generic strategy-framework names (its own
 * header calls it a "NAME-RECOGNITION BOOTSTRAP ONLY"). `data/command-
 * registry.json` and `data/brain-orchestration-projection.json` each carry
 * the same 28 PWS framework names (the projection is GENERATED from the
 * registry, so build-orchestration-projection.cjs --check already keeps
 * those two in lockstep with each other). The overlap between the composer
 * and the registry is exactly one name (`Lean Canvas`), plus three near-miss
 * aliases that never string-match (`Mullins` / `Mullins Model`, `Beautiful
 * Question` / `Beautiful Question Framework`, `Jobs-to-be-Done` / `Jobs to
 * Be Done (JTBD)`). That mismatch is the ROOT CAUSE of the one-step-chain
 * defect Plans 01 and 02 of this phase fix, and nothing in the tree caught
 * it until now.
 *
 * THE DESIGN IS A DECLARED-DRIFT LEDGER, NOT A PURGE. 254-RESEARCH.md Open
 * Question 3 is explicit: instrument first, decide with data later, because
 * `detectCompletedFramework()` and `parseFrameworkChainSection()` also read
 * `KNOWN_FRAMEWORKS` and have other callers, and the composer's own header
 * (lines 96-105) already names the list conservative and extensible. This
 * gate does NOT delete, re-point, or edit `KNOWN_FRAMEWORKS` -- it names
 * every current divergence with a reason in `DECLARED_NON_PWS` below, and
 * fails the build the moment an UNDECLARED divergence appears. The ledger
 * itself is guarded against rot: a declaration naming a composer entry that
 * no longer exists (`dangling_declaration`), or an alias whose canonical
 * registry target disappears (`alias_target_missing`), each fail the build
 * too -- see `validateDeclarations()` and the two matching checks below.
 *
 * THREE SOURCES, all derived at run time, never a literal count:
 *   composer   - lib/core/framework-chain-composer.cjs's exported
 *                KNOWN_FRAMEWORKS constant (never a regex scrape of source;
 *                the export exists precisely so invariant tests can read it)
 *   registry   - the distinct set of declared `frameworks:` across every
 *                command in data/command-registry.json
 *   projection - the `name` of every node whose `kind` is `framework` in
 *                data/brain-orchestration-projection.json
 *
 * FOUR HARD CHECKS (each produces a `{ kind, detail, names }` violation):
 *   registry_projection_divergence - registry set and projection set must
 *     be equal; both directions (registry-only and projection-only) are
 *     reported so the diff is actionable
 *   undeclared_composer_name - every composer name must be EITHER present
 *     in the registry set OR carry a DECLARED_NON_PWS entry
 *   dangling_declaration - every DECLARED_NON_PWS entry's name must still
 *     be present in the composer set (the ledger cannot rot into entries
 *     that no longer correspond to anything)
 *   alias_target_missing - every declaration carrying an alias_of must name
 *     a canonical string that IS present in the registry set
 *
 * A FIFTH CHECK, empty_source (T-254-11, Tampering disposition: mitigate).
 * An unreadable or empty registry/projection/composer source must NEVER be
 * treated as "no divergence found" -- an empty set trivially equals another
 * empty set, so a silently-failed read would be the exact silent-pass
 * failure mode this gate exists to close. Only the advisory tier below is
 * allowed to degrade quietly.
 *
 * ONE ADVISORY TIER (report-only, NEVER enters `violations`, NEVER changes
 * the exit code): command_slug_not_in_registry -- every slug in
 * lib/mcp/brain-router.cjs's KNOWN_METHODOLOGIES (a COMMAND-SLUG set, a
 * fourth and structurally different vocabulary) that has no matching
 * command in data/command-registry.json. KNOWN_METHODOLOGIES is not
 * exported from brain-router.cjs (its module.exports is { recommend,
 * validateChain }), so this reads the module's SOURCE TEXT rather than
 * editing brain-router.cjs, which belongs to a later plan's wave in this
 * phase and must not be modified from here. If parsing proves brittle the
 * advisory tier degrades to a single `advisory_unavailable` entry; it must
 * NEVER throw and NEVER fail the run.
 *
 * CLI:
 *   --check  prints `framework-vocabulary: OK` and exits 0 on zero
 *            violations, or prints each violation and exits 1
 *   --report prints the full three-way census (derived counts, overlap,
 *            declared ledger, advisory tier) and always exits 0
 *   (default) behaves as --report
 *
 * Canon Part 8: zero network calls, zero Brain requires. This reads two
 * committed local JSON files and two committed local CJS modules (one via
 * require, one as text); nothing here can reach the Brain.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMPOSER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'framework-chain-composer.cjs');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const PROJECTION_PATH = path.join(REPO_ROOT, 'data', 'brain-orchestration-projection.json');
const BRAIN_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'brain-router.cjs');

// ---------------------------------------------------------------------------
// DECLARED_NON_PWS - the ledger.
//
// Re-derived live at execute time (run `--report` to see the current
// three-way census); this array is the RECORD of what was measured, not a
// substitute for the measurement. As measured 2026-09-02: the composer's 18
// KNOWN_FRAMEWORKS names minus the one real overlap (`Lean Canvas`) minus the
// three near-miss aliases leaves 14 plain entries below, plus the 3 alias
// entries.
//
// Every plain entry's reason states the same substantive fact (citing the
// composer's own header, lib/core/framework-chain-composer.cjs lines 96-105):
// KNOWN_FRAMEWORKS is a name-recognition bootstrap string used by
// detectCompletedFramework() / parseFrameworkChainSection() to recognize a
// framework name in a governing thought or a filed-artifact slug -- it is
// NOT a PWS methodology that data/command-registry.json resolves to a
// `/mos:` command, so its absence from the registry is expected, not a bug.
// ---------------------------------------------------------------------------
const BOOTSTRAP_REASON =
  'Name-recognition bootstrap string (lib/core/framework-chain-composer.cjs KNOWN_FRAMEWORKS, ' +
  'header lines 96-105): used by detectCompletedFramework() / parseFrameworkChainSection() to ' +
  'recognize this name in a governing thought or a filed-artifact slug. It is not a PWS methodology ' +
  'that data/command-registry.json resolves to a /mos: command, so its absence from the registry ' +
  'and the projection is expected, not a defect.';

const DECLARED_NON_PWS = Object.freeze([
  { name: 'SWOT Analysis', reason: BOOTSTRAP_REASON },
  { name: 'Porter Five Forces', reason: BOOTSTRAP_REASON },
  { name: 'Value Chain Analysis', reason: BOOTSTRAP_REASON },
  { name: 'Business Model Canvas', reason: BOOTSTRAP_REASON },
  { name: '5 Whys', reason: BOOTSTRAP_REASON },
  { name: 'First Principles', reason: BOOTSTRAP_REASON },
  { name: 'Design Thinking', reason: BOOTSTRAP_REASON },
  { name: 'Blue Ocean Strategy', reason: BOOTSTRAP_REASON },
  { name: "Innovator's Dilemma", reason: BOOTSTRAP_REASON },
  { name: '7 S Framework', reason: BOOTSTRAP_REASON },
  { name: 'Balanced Scorecard', reason: BOOTSTRAP_REASON },
  { name: 'Soft Systems', reason: BOOTSTRAP_REASON },
  { name: 'Rich Pictures', reason: BOOTSTRAP_REASON },
  { name: 'Value Proposition Canvas', reason: BOOTSTRAP_REASON },
  {
    name: 'Mullins',
    reason:
      BOOTSTRAP_REASON +
      ' This entry is a near-miss alias: the registry carries the same concept under the string ' +
      '"Mullins Model", which does not string-match the composer\'s bootstrap name "Mullins".',
    alias_of: 'Mullins Model',
  },
  {
    name: 'Beautiful Question',
    reason:
      BOOTSTRAP_REASON +
      ' This entry is a near-miss alias: the registry carries the same concept under the string ' +
      '"Beautiful Question Framework", which does not string-match the composer\'s bootstrap name ' +
      '"Beautiful Question".',
    alias_of: 'Beautiful Question Framework',
  },
  {
    name: 'Jobs-to-be-Done',
    reason:
      BOOTSTRAP_REASON +
      ' This entry is a near-miss alias: the registry carries the same concept under the string ' +
      '"Jobs to Be Done (JTBD)", which does not string-match the composer\'s bootstrap name ' +
      '"Jobs-to-be-Done".',
    alias_of: 'Jobs to Be Done (JTBD)',
  },
]);

/**
 * validateDeclarations(list) - throws at call time on any entry with a
 * missing or empty reason, or an alias_of that is not a non-empty string.
 * Same discipline as scripts/check-plugin-path-anchoring.cjs's
 * validateAllowlist(): an unreasoned exception is a silent suppression.
 */
function validateDeclarations(list) {
  if (!Array.isArray(list)) {
    throw new Error('check-framework-vocabulary-drift: declarations must be an array');
  }
  list.forEach(function (entry, i) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('check-framework-vocabulary-drift: declarations[' + i + '] is not an object');
    }
    if (typeof entry.name !== 'string' || entry.name.trim() === '') {
      throw new Error('check-framework-vocabulary-drift: declarations[' + i + '] has no name');
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') {
      throw new Error(
        'check-framework-vocabulary-drift: declarations[' +
          i +
          '] (' +
          entry.name +
          ') has no written reason. Every declared exception must carry a non-empty reason so the ' +
          'gate cannot be silenced anonymously.'
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(entry, 'alias_of') &&
      (typeof entry.alias_of !== 'string' || entry.alias_of.trim() === '')
    ) {
      throw new Error(
        'check-framework-vocabulary-drift: declarations[' +
          i +
          '] (' +
          entry.name +
          ') has an alias_of key that is not a non-empty string'
      );
    }
  });
  return list;
}

validateDeclarations(DECLARED_NON_PWS);

// ---------------------------------------------------------------------------
// Live source readers. Each degrades to [] on any read/parse failure so the
// caller can distinguish "unreadable" from "genuinely diverges" via the
// empty_source check below -- these readers never throw.
// ---------------------------------------------------------------------------

function readComposerSet() {
  try {
    // eslint-disable-next-line global-require
    const mod = require(COMPOSER_PATH);
    return Array.isArray(mod.KNOWN_FRAMEWORKS) ? mod.KNOWN_FRAMEWORKS.slice() : [];
  } catch (_e) {
    return [];
  }
}

function readRegistrySet() {
  try {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const set = new Set();
    for (const cmd of data.commands || []) {
      for (const f of cmd.frameworks || []) {
        if (typeof f === 'string' && f.trim() !== '') set.add(f);
      }
    }
    return Array.from(set);
  } catch (_e) {
    return [];
  }
}

// Strip the `<kind>:` id prefix the same way lib/workflow/local-chain-
// recommender.cjs's _splitNodeId does, so this gate never invents a second
// parser for the same shape.
function splitNodeId(nodeId) {
  if (typeof nodeId !== 'string') return { kind: null, name: null };
  const idx = nodeId.indexOf(':');
  if (idx < 0) return { kind: null, name: nodeId };
  return { kind: nodeId.slice(0, idx), name: nodeId.slice(idx + 1) };
}

function readProjectionSet() {
  try {
    const data = JSON.parse(fs.readFileSync(PROJECTION_PATH, 'utf8'));
    const set = new Set();
    for (const node of data.nodes || []) {
      if (!node || node.kind !== 'framework') continue;
      const fromName = typeof node.name === 'string' && node.name.trim() !== '' ? node.name : null;
      const derived = fromName || splitNodeId(node.id).name;
      if (typeof derived === 'string' && derived.trim() !== '') set.add(derived);
    }
    return Array.from(set);
  } catch (_e) {
    return [];
  }
}

function readRegistryCommandSlugs() {
  try {
    const data = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const set = new Set();
    for (const cmd of data.commands || []) {
      if (typeof cmd.command !== 'string') continue;
      const slug = cmd.command.replace(/^\/mos:/, '');
      if (slug.trim() !== '') set.add(slug);
    }
    return set;
  } catch (_e) {
    return new Set();
  }
}

// The fourth vocabulary: lib/mcp/brain-router.cjs's KNOWN_METHODOLOGIES,
// read as TEXT (never required for execution -- T-254-13, no exposure to
// the Brain). KNOWN_METHODOLOGIES is not exported (module.exports is
// { recommend, validateChain }), and brain-router.cjs is Plan 04's file, not
// to be edited from here.
function readBrainRouterMethodologies() {
  try {
    const src = fs.readFileSync(BRAIN_ROUTER_PATH, 'utf8');
    const declM = src.match(/const\s+KNOWN_METHODOLOGIES\s*=\s*\[([\s\S]*?)\];/);
    if (!declM) return null;
    const body = declM[1];
    const slugs = [];
    const tokenRe = /'([^']+)'|"([^"]+)"/g;
    let m;
    while ((m = tokenRe.exec(body)) !== null) {
      const slug = m[1] || m[2];
      if (typeof slug === 'string' && slug.trim() !== '') slugs.push(slug);
    }
    return slugs;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// The four hard checks + the empty-source guard.
// ---------------------------------------------------------------------------

function checkEmptySources(composerSet, registrySet, projectionSet) {
  const violations = [];
  if (!Array.isArray(composerSet) || composerSet.length === 0) {
    violations.push({
      kind: 'empty_source',
      detail: 'the composer source (KNOWN_FRAMEWORKS) failed to read or resolved to an empty set',
      names: [],
    });
  }
  if (!Array.isArray(registrySet) || registrySet.length === 0) {
    violations.push({
      kind: 'empty_source',
      detail: 'the registry source (data/command-registry.json frameworks) failed to read or resolved to an empty set',
      names: [],
    });
  }
  if (!Array.isArray(projectionSet) || projectionSet.length === 0) {
    violations.push({
      kind: 'empty_source',
      detail:
        'the projection source (data/brain-orchestration-projection.json framework nodes) failed to read or resolved to an empty set',
      names: [],
    });
  }
  return violations;
}

function checkRegistryProjectionDivergence(registrySet, projectionSet) {
  const violations = [];
  const regSet = new Set(registrySet);
  const projSet = new Set(projectionSet);
  const registryOnly = registrySet.filter(function (n) {
    return !projSet.has(n);
  });
  const projectionOnly = projectionSet.filter(function (n) {
    return !regSet.has(n);
  });
  if (registryOnly.length > 0) {
    violations.push({
      kind: 'registry_projection_divergence',
      detail: 'present in the registry set but missing from the projection set',
      names: registryOnly,
    });
  }
  if (projectionOnly.length > 0) {
    violations.push({
      kind: 'registry_projection_divergence',
      detail: 'present in the projection set but missing from the registry set',
      names: projectionOnly,
    });
  }
  return violations;
}

function checkUndeclaredComposerNames(composerSet, registrySet, declarations) {
  const regSet = new Set(registrySet);
  const declaredNames = new Set(declarations.map(function (d) { return d.name; }));
  const undeclared = composerSet.filter(function (n) {
    return !regSet.has(n) && !declaredNames.has(n);
  });
  if (undeclared.length === 0) return [];
  return [
    {
      kind: 'undeclared_composer_name',
      detail:
        'present in KNOWN_FRAMEWORKS but neither in the registry set nor declared with a reason in DECLARED_NON_PWS',
      names: undeclared,
    },
  ];
}

function checkDanglingDeclarations(composerSet, declarations) {
  const compSet = new Set(composerSet);
  const dangling = declarations
    .filter(function (d) { return !compSet.has(d.name); })
    .map(function (d) { return d.name; });
  if (dangling.length === 0) return [];
  return [
    {
      kind: 'dangling_declaration',
      detail: 'a DECLARED_NON_PWS entry names a string no longer present in KNOWN_FRAMEWORKS',
      names: dangling,
    },
  ];
}

function checkAliasTargets(registrySet, declarations) {
  const regSet = new Set(registrySet);
  const missing = declarations
    .filter(function (d) {
      return typeof d.alias_of === 'string' && d.alias_of.trim() !== '' && !regSet.has(d.alias_of);
    })
    .map(function (d) { return d.alias_of; });
  if (missing.length === 0) return [];
  return [
    {
      kind: 'alias_target_missing',
      detail: 'a declaration carries an alias_of target that is not present in the registry set',
      names: missing,
    },
  ];
}

// ---------------------------------------------------------------------------
// The advisory tier. Report-only, NEVER enters violations, NEVER changes
// the exit code -- T-254-12 (Denial of Service, mitigate).
// ---------------------------------------------------------------------------
function buildAdvisory() {
  try {
    const slugs = readBrainRouterMethodologies();
    if (!Array.isArray(slugs)) {
      return [
        {
          kind: 'advisory_unavailable',
          detail: 'could not parse KNOWN_METHODOLOGIES out of lib/mcp/brain-router.cjs source text',
          names: [],
        },
      ];
    }
    const registrySlugs = readRegistryCommandSlugs();
    const missing = slugs.filter(function (s) { return !registrySlugs.has(s); });
    return missing.map(function (s) {
      return {
        kind: 'command_slug_not_in_registry',
        detail:
          'lib/mcp/brain-router.cjs KNOWN_METHODOLOGIES slug has no matching command in data/command-registry.json',
        names: [s],
      };
    });
  } catch (_e) {
    return [
      {
        kind: 'advisory_unavailable',
        detail: 'the fourth-vocabulary advisory tier failed to compute and degraded rather than throwing',
        names: [],
      },
    ];
  }
}

// ---------------------------------------------------------------------------
// classifyVocabularies(sets) - the exported classifier. With no argument,
// reads the three live sources; with an injected
// { composer, registry, projection, declarations }, uses those instead, so
// every fixture-suite arm is hermetic (no live-tree mutation).
// ---------------------------------------------------------------------------
function classifyVocabularies(sets) {
  const opts = sets || {};
  const composerSet = Array.isArray(opts.composer) ? opts.composer : readComposerSet();
  const registrySet = Array.isArray(opts.registry) ? opts.registry : readRegistrySet();
  const projectionSet = Array.isArray(opts.projection) ? opts.projection : readProjectionSet();
  const declarations = Array.isArray(opts.declarations) ? validateDeclarations(opts.declarations) : DECLARED_NON_PWS;

  const violations = []
    .concat(checkEmptySources(composerSet, registrySet, projectionSet))
    .concat(checkRegistryProjectionDivergence(registrySet, projectionSet))
    .concat(checkUndeclaredComposerNames(composerSet, registrySet, declarations))
    .concat(checkDanglingDeclarations(composerSet, declarations))
    .concat(checkAliasTargets(registrySet, declarations));

  return {
    composer: composerSet,
    registry: registrySet,
    projection: projectionSet,
    declarations: declarations,
    violations: violations,
    advisory: buildAdvisory(),
  };
}

// ---------------------------------------------------------------------------
// Reporting + CLI.
// ---------------------------------------------------------------------------

function printReport(result) {
  console.log('=== check-framework-vocabulary-drift: three-way census ===');
  console.log('composer   (KNOWN_FRAMEWORKS)                         : ' + result.composer.length);
  console.log('registry   (command-registry.json frameworks)         : ' + result.registry.length);
  console.log('projection (brain-orchestration-projection.json)      : ' + result.projection.length);
  const regSet = new Set(result.registry);
  const overlap = result.composer.filter(function (n) { return regSet.has(n); });
  console.log('composer/registry overlap                             : ' + overlap.length + ' (' + overlap.join(', ') + ')');
  console.log('');
  console.log('declared ledger (' + result.declarations.length + ' entries):');
  for (const d of result.declarations) {
    console.log('  - ' + d.name + (d.alias_of ? ' [alias_of: ' + d.alias_of + ']' : ''));
  }
  console.log('');
  if (result.violations.length === 0) {
    console.log('violations: none');
  } else {
    console.log('violations:');
    for (const v of result.violations) {
      console.log('  [' + v.kind + '] ' + v.detail + (v.names && v.names.length ? ': ' + v.names.join(', ') : ''));
    }
  }
  console.log('');
  console.log('advisory tier (fourth vocabulary, brain-router.cjs KNOWN_METHODOLOGIES, report-only, never gates the build):');
  if (result.advisory.length === 0) {
    console.log('  none');
  } else {
    for (const a of result.advisory) {
      console.log('  [' + a.kind + '] ' + a.detail + (a.names && a.names.length ? ': ' + a.names.join(', ') : ''));
    }
  }
}

const RECOVERY =
  'Recovery: run node scripts/check-framework-vocabulary-drift.cjs --report for the full census, ' +
  'then either fix the underlying source (composer/registry/projection) or add a reasoned entry to ' +
  'DECLARED_NON_PWS in scripts/check-framework-vocabulary-drift.cjs.';

function runCheck() {
  const result = classifyVocabularies();
  if (result.violations.length === 0) {
    console.log('framework-vocabulary: OK');
    return 0;
  }
  for (const v of result.violations) {
    console.error('[' + v.kind + '] ' + v.detail + (v.names && v.names.length ? ': ' + v.names.join(', ') : ''));
  }
  console.error('');
  console.error(RECOVERY);
  return 1;
}

function main(argv) {
  const args = (argv || []).slice(2);
  let mode = 'report';
  for (const a of args) {
    if (a === '--check') mode = 'check';
    else if (a === '--report') mode = 'report';
  }
  if (mode === 'check') {
    return runCheck();
  }
  printReport(classifyVocabularies());
  return 0;
}

module.exports = {
  classifyVocabularies: classifyVocabularies,
  validateDeclarations: validateDeclarations,
  DECLARED_NON_PWS: DECLARED_NON_PWS,
  main: main,
  RECOVERY: RECOVERY,
};

if (require.main === module) {
  process.exit(main(process.argv));
}
