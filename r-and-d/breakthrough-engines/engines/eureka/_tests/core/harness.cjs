'use strict';
// Test harness for eureka/lib/core/eureka/*.cjs.
// The shipped files require many sibling modules that are not part of this slice.
// makeRoot() builds a throwaway plugin-shaped tree in the OS temp dir:
//   <root>/lib/core/eureka/<module under test copied from package or _baseline/orig>
//   <root>/lib/core/**   hand-written minimal STUBS (never shipped, live only here)
// so the pure logic can be exercised without inventing modules in the package.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PKG = path.resolve(__dirname, '..', '..', '..');            // package-2026
const NEW_DIR = path.join(PKG, 'eureka', 'lib', 'core', 'eureka');
const ORIG_DIR = path.join(PKG, '_baseline', 'orig', 'eureka', 'lib', 'core', 'eureka');

const STUBS = {
  'lib/core/direction-convention.cjs': `
    const DIRECTIONS = Object.freeze(['structural_transfer', 'semantic_implementation']);
    module.exports = { DIRECTIONS, NONE: 'none' };`,
  'lib/core/semantic-index/embedding-spine.cjs': `
    module.exports = { ENCODER_UNAVAILABLE_HINT: 'Run /mos:eureka enable to install the encoder' };`,
  'lib/core/verification-stamp-format.cjs': `
    module.exports = {
      REASON_WORDS: { no_path: 'no methodology path' },
      formatPathText: (nodes, edges) => nodes.join(' - ') + (edges.length ? ' [' + edges.join(',') + ']' : ''),
      assertNoScalar: (lines) => ({ lines: lines.map(String) }),
    };`,
  'lib/core/scaffold-predicate.cjs': `
    module.exports = {
      isScaffoldBasename: (p) => /(^|\\/)(CONTEXT|FEYNMAN)\\.md$/.test(p),
      isScaffoldFile: (p) => /CONTEXT\\.md$/.test(p) || /SEEDED-FEYNMAN/.test(require('node:fs').existsSync(p) ? require('node:fs').readFileSync(p, 'utf8') : ''),
    };`,
  'lib/core/room-skeleton-scaffold.cjs': `
    module.exports = { SECTION_NAMES: ['problem-definition', 'market-analysis', 'solution-design', 'business-model', 'competitive-analysis', 'team-execution', 'legal-ip', 'financial-model'] };`,
  'lib/core/futures/orchestrator.cjs': `
    const FUTURES_FANOUT_CAP = 5;
    module.exports = { FUTURES_FANOUT_CAP, resolveFanoutCap: (o) => Math.min(FUTURES_FANOUT_CAP, (o && o.fanout) || 1) };`,
  'lib/core/semantic-index/lexical-overlap.cjs': `
    const tok = (s) => new Set(String(s).toLowerCase().split(/[^\\p{L}\\p{N}]+/u).filter(Boolean));
    module.exports = {
      LEXICAL_METHOD: 'jaccard-v1',
      lexicalOverlap: (a, b) => { const A = tok(a), B = tok(b); let i = 0; for (const x of A) if (B.has(x)) i++; const u = A.size + B.size - i; return u === 0 ? 0 : i / u; },
    };`,
  'lib/core/eureka-critic.cjs': `
    module.exports = {
      _gate1: { FABRICATED_QUANTITY: /\\b\\d+x\\b/, DOLLAR_FIGURE: /\\$\\d/ },
      buildNeutralPrompt: (c) => 'NEUTRAL ' + c.id,
      buildAdversarialPrompt: (c) => 'Argue this proposed analogy is generic filler ' + c.id,
      runRubric: async (c, o) => ({ verdict: 'transferable', reasoning_tag: 'ok', rubric_pattern: 'yyyyyy' }),
    };`,
  'lib/core/room-db.cjs': `
    const { DatabaseSync } = require('node:sqlite');
    module.exports = {
      openRoomDb: (dir) => { const p = require('node:path').join(dir, '.mindrian', 'room.db'); require('node:fs').mkdirSync(require('node:path').dirname(p), { recursive: true }); return new DatabaseSync(p); },
      closeRoomDb: (db) => { try { db.close(); } catch (e) {} },
    };`,
  'lib/core/opportunity-extractor.cjs': `
    module.exports = { opportunityHash: (name) => require('node:crypto').createHash('sha256').update(String(name)).digest('hex') };`,
  'lib/core/opportunity-ops.cjs': `
    function parseFrontmatter(txt) {
      const m = /^---\\n([\\s\\S]*?)\\n---/.exec(txt); const o = {};
      if (!m) return o;
      for (const line of m[1].split('\\n')) { const k = /^([a-z_]+):\\s*(.*)$/.exec(line); if (k) o[k[1]] = k[2].replace(/^"|"$/g, ''); }
      return o;
    }
    module.exports = { parseFrontmatter, listOpportunities: () => ({ opportunities: global.__bank || [] }), bankOpportunity: () => ({ banked: true }), computeOpportunityBankState: () => ({}) };`,
  'lib/core/feynman-minto-invariants.cjs': `
    module.exports = { validate: (p) => ({ valid: !/FAILINVARIANT/.test(require('node:fs').readFileSync(p, 'utf8')), violations: [{ message: 'forced' }] }) };`,
  'lib/core/semantic-index/research-filing.cjs': `
    const fs = require('node:fs'), path = require('node:path');
    module.exports = {
      OFFLINE_PROVENANCE: 'web: absent (room-corpus degrade)',
      queryRoomCorpus: () => ({ research_mode: 'web_degraded_local_fallback', providers: [], results: [], provenance: 'p' }),
      fileResearchArtifact: () => ({ ok: true, node_id: 'r1', relPath: 'research/r.md' }),
      runPostFilingExtraction: async () => ({ ok: true }),
      _internal: {
        ensureDirIdentity: () => {},
        atomicWrite: (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); },
      },
    };`,
  'lib/core/navigation.cjs': `
    const log = (global.__nav = global.__nav || []);
    module.exports = {
      writeMemoryArtifactNode: (db, a) => { log.push(['artifact', a]); return { ok: true, node_id: 'art:' + a.path }; },
      linkOpportunityEvidence: (db, a) => { log.push(['link', a]); return { ok: true }; },
      advanceOpportunityStage: (db, a) => { log.push(['advance', a]); return { ok: true }; },
      writeClaimNode: (db, a) => { log.push(['claim', a]); return { ok: true, node_id: 'claim1' }; },
    };`,
  'lib/workflow/command-resolver.cjs': `
    module.exports = { composeWorkflow: (names) => names.map((n, i) => ({ step: i + 1, framework: n, command: 'cmd-' + i, optional: false })) };`,
  'lib/core/chain-executor.cjs': `
    module.exports = {
      makeGateFn: () => (step) => (step.material ? 'halt' : 'run'),
      runChain: async (steps, o) => {
        const trace = []; let haltedAt = null;
        for (const s of steps) {
          if (o.gateFn(s) === 'halt') { const v = o.onHalt ? await o.onHalt(s, {}) : 'defer'; haltedAt = { step: s, verb: v }; break; }
          const r = await o.onStep(s, trace.length ? trace[trace.length - 1].chain_output : null);
          trace.push({ step: s, chain_output: r && r.chain_output, quality: r && r.quality });
        }
        return { trace, completed: !haltedAt, haltedAt, partial: false };
      },
    };`,
  'lib/core/npm-cli-resolve.cjs': `
    module.exports = { resolveNpmCli: () => ({ command: 'npm', shell: !!global.__shell }), buildInstallArgs: (d, tail) => ['install'].concat(tail) };`,
  'lib/core/npm-install-lock.cjs': `
    module.exports = { acquireInstallLock: () => true, releaseInstallLock: () => {}, waitForUnlock: () => {} };`,
  'lib/core/eureka-deps-resolver.cjs': `
    module.exports = { eurekaDepsRoot: () => '/tmp/eureka-deps', eurekaDepInstalled: () => ({ installed: false, dir: null }) };`,
  'lib/core/rs-differential-scorer.cjs': `
    module.exports = { scoreMeasured: async () => ({}), _test: { resolveEurekaDiffFloor: () => 0.15 } };`,
  'lib/core/verification-stamp.cjs': `
    module.exports = { TIERS: ['strong', 'indirect', 'unverified'], BACKENDS: ['theo', 'none'], REASONS: ['no_path'] };`,
  'lib/core/bono/cell-fanout.cjs': `module.exports = { runCellFanout: async () => ({ cells: [], dropped: [], plan: { requested: 0, dispatched: 0, capped: false }, dispatchPlan: {} }) };`,
  'lib/core/bono/reviewer-governance.cjs': `module.exports = { composeReviewerGovernedSeams: () => ({}) };`,
};

function writeStubs(root, extra) {
  const all = Object.assign({}, STUBS, extra || {});
  for (const rel of Object.keys(all)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, all[rel]);
  }
}

// variant: 'new' (package copy) or 'orig' (pristine baseline).
function makeRoot(variant, extraStubs, extraFiles) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-core-' + variant + '-'));
  const src = variant === 'orig' ? ORIG_DIR : NEW_DIR;
  const dst = path.join(root, 'lib', 'core', 'eureka');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  writeStubs(root, extraStubs);
  for (const rel of Object.keys(extraFiles || {})) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, extraFiles[rel]);
  }
  return root;
}

function load(variant, mod, extraStubs, extraFiles) {
  const root = makeRoot(variant, extraStubs, extraFiles);
  return { root, mod: require(path.join(root, 'lib', 'core', 'eureka', mod + '.cjs')) };
}

module.exports = { makeRoot, load, NEW_DIR, ORIG_DIR, PKG };
