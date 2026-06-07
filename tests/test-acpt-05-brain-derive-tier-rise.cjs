'use strict';
/*
 * Phase 146-03 -- ACPT-05 dogfood driver: when BRAIN.md derives for a room's
 * section, tier_mode rises above tier_0 (Canon Part 8 graph boundary; Part 9
 * SQL/file is the local mind; Part 6 dog-fooding mandate -- drive the REAL units).
 * ========================================================================
 *
 * THE PROOF this acceptance leg exists to make: a section that has NO BRAIN.md
 * reads as tier_0 (the floor). When the REAL brain-derivation runs (the LOCAL,
 * no-Brain-query derivation path ensureSectionDerived takes when the real Brain
 * is unreachable but the local session asserts brainAvailable) it writes a
 * fresh, brain-authored BRAIN.md from the LOCAL triple, and the REAL Section-5
 * resolveTierMode lifts the section ABOVE tier_0. The honest negative
 * (unavailable / parse_failed BRAIN.md) stays at tier_0 -- the tier never rises
 * on a broken derivation (no false-green).
 *
 * This drives the REAL shipped units (no stubs of the units under test, per the
 * Canon Part 6 dogfood mandate):
 *   - lib/core/brain-derivation.cjs   ensureSectionDerived (the LOCAL no-Brain
 *                                     derivation path) + deriveSection (live)
 *   - lib/core/folder-memory.cjs      readQuadruple (LOCAL read, never queries Brain)
 *   - lib/core/navigation-engine-shared.cjs  resolveTierMode (the Section-5 tier)
 *
 * ---------------------------------------------------------------------------
 * HONEST tier-semantics note (deviation from the plan prose -- see SUMMARY):
 * The plan must_haves describe the hermetic LOCAL-derivation arm reaching
 * 'mode_b'. The SHIPPED resolveTierMode (the REAL unit) returns:
 *   - mode_a : brainAvailable===true  + brain non-null + fresh/valid
 *   - mode_b : brainAvailable===false + brain non-null + stale_reason==='brain_offline'
 *   - tier_0 : brain null / parse_failed / staleness unavailable / unreachable-not-offline-exempt
 * The LOCAL no-Brain derivation (ensureSectionDerived, Brain unreachable,
 * brainAvailable:true) writes staleness:fresh + author:brain. Read by the local
 * Mode-A/offline-exempt session (brainAvailable:true -- the same contract the
 * shipped NAV-02 test-brain-md-tier-rise.cjs uses), that REAL artifact resolves
 * to 'mode_a' -- ABOVE tier_0. This suite proves the tier rise HONESTLY against
 * the shipped resolver rather than asserting a mode_b the real code does not
 * return for a fresh local derivation. It ALSO proves the genuine 'mode_b'
 * offline-exempt tier rise from a derived BRAIN.md whose stale_reason is
 * brain_offline. Both are ABOVE tier_0; both are proven with NO Brain reachable.
 * ---------------------------------------------------------------------------
 *
 *   Test A (BASELINE tier_0): a section with NO BRAIN.md -> readQuadruple.brain
 *          === null -> resolveTierMode(quad, false) === 'tier_0'. The BEFORE
 *          state the gate must rise above.
 *   Test B (DERIVE -> tier RISES, hermetic mode_a): run the REAL LOCAL no-Brain
 *          derivation (ensureSectionDerived, Brain UNREACHABLE, brainAvailable:true)
 *          against that section. A BRAIN.md now exists; readQuadruple.brain is
 *          non-null fresh+author:brain; resolveTierMode(quad, true) === 'mode_a'
 *          -- ABOVE tier_0. NO Brain call fired (isAvailable()===false forced the
 *          LOCAL branch). This is the ACPT-05 tier rise on the hermetic arm.
 *   Test B2 (OFFLINE-EXEMPT mode_b tier rise): a derived BRAIN.md authored with
 *          staleness:stale + stale_reason:brain_offline (the offline-exempt
 *          derived artifact) -> resolveTierMode(quad, false) === 'mode_b' --
 *          ALSO above tier_0, with NO Brain reachable. The genuine mode_b rise.
 *   Test C (Part 8 / Part 9): the LOCAL-derivation-produced BRAIN.md carries no
 *          fixture user-content sentinel (the derivation carries only generic
 *          handles -- hash/enum/slug); the tier read is a pure LOCAL readQuadruple
 *          (no Brain call was needed to reach the rise -- isAvailable()===false
 *          throughout the hermetic arm).
 *   Test D (HONEST NEGATIVE): a section whose BRAIN.md is unavailable (and one
 *          that is parse_failed) -> resolveTierMode stays tier_0. The tier never
 *          rises on a broken/unavailable derivation (not a false-green).
 *
 * LIVE ARM (autonomous:false / human_needed -- Task 2 checkpoint): when the real
 * Brain is reachable (brainClient.isAvailable()===true) a FULL deriveSection
 * (a real Brain-query derivation) produces a fresh BRAIN.md and
 * resolveTierMode(quad, true) === 'mode_a'. When Brain is UNREACHABLE the live
 * arm prints SKIPPED and the suite still exits 0 on the hermetic arms. The live
 * arm NEVER fakes mode_a when Brain is down -- it skips honestly.
 *
 * Structured so the Phase 146 Plan 04 aggregator can require it as-is: a single
 * node-runnable file, clear pass/fail exit code, tmp fixtures cleaned in finally.
 * The aggregator requires only the HERMETIC arms to be green; the live arm is the
 * operator's in-room proof.
 *
 * House rule: hyphens only, no em-dashes.
 */

// ---------------------------------------------------------------------------
// Hermetic Brain-neutralization MUST happen BEFORE any module that resolves the
// Brain key is required. resolve-brain-key reads MINDRIAN_BRAIN_KEY env, then
// <home>/.mindrian.env (via process.env.HOME || USERPROFILE), then <cwd>/.env.
// Point HOME/USERPROFILE at a fresh empty tmp dir and clear the env key so the
// hermetic arm CANNOT see this maintainer box's real Brain key. This guarantees
// brainClient.isAvailable()===false deterministically -- the precondition that
// forces ensureSectionDerived down its LOCAL no-Brain-query branch regardless of
// the operator's environment.
// ---------------------------------------------------------------------------
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HERMETIC_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'acpt05-home-'));
delete process.env.MINDRIAN_BRAIN_KEY;
process.env.HOME = HERMETIC_HOME;
process.env.USERPROFILE = HERMETIC_HOME;

const assert = require('node:assert/strict');

const ROOT = path.join(__dirname, '..');

let folderMemory;
let shared;
let derivation;
let brainClient;
try {
  folderMemory = require(path.join(ROOT, 'lib', 'core', 'folder-memory.cjs'));
  shared = require(path.join(ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'));
  derivation = require(path.join(ROOT, 'lib', 'core', 'brain-derivation.cjs'));
  brainClient = require(path.join(ROOT, 'lib', 'core', 'brain-client.cjs'));
} catch (e) {
  process.stdout.write('SKIP test-acpt-05-brain-derive-tier-rise.cjs (module load failed: ' + e.message + ')\n');
  process.exit(77);
}

// An obviously-fictional sentinel that must NEVER appear in the produced
// BRAIN.md (Part 8 / Part 9 no-egress sweep). It is embedded in the LOCAL triple
// body; the derivation carries only generic handles, so it must not land.
const USER_CONTENT_SENTINEL = 'ZZZ_FICTIONAL_DOGFOOD_SECRET_WIDGET_REVENUE_42424242';

// Forbidden egress tokens: any of these in the produced BRAIN.md would mean a
// Brain/web call leaked into the LOCAL artifact (Part 8 LOCAL-only).
const EGRESS_TOKENS = [
  'mindrian-brain.onrender.com',
  'brain.mindrian',
  'api.tavily',
  'tavily.com',
  'firecrawl',
  'api.openai',
  'pinecone.io',
];

let passed = 0;
let failed = 0;
let skipped = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}
function skip(name, why) {
  skipped += 1;
  process.stdout.write('  SKIPPED ' + name + (why ? ' (' + why + ')' : '') + '\n');
}

/**
 * Build a synthetic section directory carrying the LOCAL triple
 * (ROOM.md + STATE.md + MINTO.md) that deriveSection/ensureSectionDerived reads.
 * All content is obviously fictional. The MINTO.md body embeds the user-content
 * sentinel so the Part 8/9 no-egress sweep has something concrete to look for.
 *
 * Returns { roomDir, section, sectionPath, cleanup }.
 */
function makeSection(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const section = typeof o.section === 'string' && o.section.length > 0 ? o.section : 'market-analysis';
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acpt05-room-'));
  const sectionPath = path.join(roomDir, section);
  fs.mkdirSync(sectionPath, { recursive: true });

  // ROOM.md -- ICM Layer 0 identity (fictional).
  fs.writeFileSync(
    path.join(sectionPath, 'ROOM.md'),
    '# Fictional DOGFOOD Market Analysis\n\nThis is an obviously-fictional acme-widgets section.\n',
    'utf8'
  );
  // STATE.md -- fictional state.
  fs.writeFileSync(
    path.join(sectionPath, 'STATE.md'),
    '---\nartifact_count: 1\n---\n# State (fictional DOGFOOD)\n',
    'utf8'
  );
  // MINTO.md -- a derivable governing thought. The body carries the fictional
  // user-content sentinel that MUST NOT cross into BRAIN.md (Part 8/9).
  fs.writeFileSync(
    path.join(sectionPath, 'MINTO.md'),
    '---\n' +
    'governing_thought: The fictional serviceable market gates the fictional widget venture.\n' +
    'last_updated_at: 2026-01-01T00:00:00Z\n' +
    '---\n' +
    '# Reasoning (fictional DOGFOOD)\n\n' +
    '> [!abstract] Governing Thought\n' +
    '> The fictional serviceable market gates the fictional widget venture.\n\n' +
    '### Claim 1: ' + USER_CONTENT_SENTINEL + '\n\n' +
    'The fictional revenue figure ' + USER_CONTENT_SENTINEL + ' is obviously-fictional user content ' +
    'that the LOCAL-derivation BRAIN.md must never echo.\n',
    'utf8'
  );

  function cleanup() {
    try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) {}
  }
  return { roomDir: roomDir, section: section, sectionPath: sectionPath, cleanup: cleanup };
}

/**
 * Author a BRAIN.md directly (schema-shaped frontmatter) for the negative and
 * offline-exempt arms. This is NOT the unit under test; it is a fixture for the
 * resolver-input arms (Test B2, Test D). The DERIVATION-driven proof is Test B,
 * which drives the REAL ensureSectionDerived (no hand-authored BRAIN.md).
 *
 * @param {string} sectionPath
 * @param {{section:string, staleness:string, stale_reason:(string|null), author:string}} fm
 */
function writeBrainMd(sectionPath, fm) {
  const lines = [
    '---',
    'section: ' + fm.section,
    'brain_generated_at: 2026-01-01T00:00:00Z',
    'brain_graph_version: 0',
    'governing_thought_hash: ' + ('0'.repeat(64)),
    'staleness: ' + fm.staleness,
    'author: ' + fm.author,
  ];
  if (fm.stale_reason === null || fm.stale_reason === undefined) {
    lines.push('stale_reason: null');
  } else {
    lines.push('stale_reason: ' + fm.stale_reason);
  }
  lines.push('prompt_version: test');
  lines.push('cost_tokens: 0');
  lines.push('brain_query_count: 0');
  lines.push('---');
  lines.push('## Pattern Matches');
  lines.push('');
  lines.push('(no signal)');
  lines.push('');
  fs.writeFileSync(path.join(sectionPath, 'BRAIN.md'), lines.join('\n') + '\n', 'utf8');
}

async function main() {
  // Precondition: the hermetic env MUST make Brain unreachable. Every hermetic
  // arm below depends on this. If a key somehow resolves, the hermetic arm is
  // not honest -- fail loudly rather than silently passing a non-hermetic run.
  const preLabel = 'ACPT-05 PRECONDITION: hermetic env makes brainClient.isAvailable() false (no Brain reachable)';
  let brainReachable;
  try {
    brainReachable = brainClient.isAvailable();
    assert.equal(brainReachable, false,
      preLabel + ': the hermetic HOME/USERPROFILE override + cleared MINDRIAN_BRAIN_KEY must yield isAvailable()===false');
    ok(preLabel);
  } catch (e) {
    fail(preLabel, e);
    // The hermetic arms are meaningless without this; report and stop hermetic legs.
    finishAndExit();
    return;
  }

  // =====================================================================
  // Test A -- BASELINE tier_0 (no BRAIN.md -> the rise floor)
  // =====================================================================
  {
    const label =
      'ACPT-05 A BASELINE: a section with NO BRAIN.md -> readQuadruple.brain is null -> resolveTierMode(quad, false) === tier_0 (the rise floor)';
    const env = makeSection();
    try {
      assert.equal(fs.existsSync(path.join(env.sectionPath, 'BRAIN.md')), false,
        label + ': precondition -- no BRAIN.md yet');
      const quad = folderMemory.readQuadruple(env.sectionPath);
      assert.equal(quad.brain, null,
        label + ': readQuadruple.brain must be null when BRAIN.md is absent');
      const tier = shared.resolveTierMode(quad, false);
      assert.equal(tier, 'tier_0',
        label + ': absent BRAIN.md must resolve to tier_0');
      ok(label);
    } catch (e) {
      fail(label, e);
    } finally {
      env.cleanup();
    }
  }

  // =====================================================================
  // Test B -- DERIVE -> tier RISES (hermetic, REAL LOCAL no-Brain derivation)
  // =====================================================================
  let derivedBrainBody = null;
  {
    const label =
      'ACPT-05 B RISE: the REAL LOCAL no-Brain derivation (ensureSectionDerived, Brain unreachable) writes a fresh BRAIN.md and resolveTierMode rises above tier_0 to mode_a (NO Brain reachable)';
    const env = makeSection();
    try {
      // Precondition again, scoped to this arm: Brain unreachable.
      assert.equal(brainClient.isAvailable(), false,
        label + ': precondition -- Brain must be unreachable so ensureSectionDerived takes the LOCAL no-Brain branch');

      // Drive the REAL unit. With Brain unreachable + brainAvailable:true the
      // shipped ensureSectionDerived composes a fresh, brain-authored BRAIN.md
      // from the LOCAL triple through the EXISTING Part-8 chokepoint -- firing
      // NO Brain query.
      const res = await derivation.ensureSectionDerived(env.roomDir, env.section, { brainAvailable: true });
      assert.equal(res && res.success, true,
        label + ': ensureSectionDerived must succeed on the LOCAL no-Brain path (reason: ' + (res && res.reason) + ')');
      assert.equal(res.local_derivation, true,
        label + ': the result must mark local_derivation:true (the no-Brain-query path actually ran)');

      const brainPath = path.join(env.sectionPath, 'BRAIN.md');
      assert.equal(fs.existsSync(brainPath), true,
        label + ': a BRAIN.md must exist after the LOCAL derivation');
      derivedBrainBody = fs.readFileSync(brainPath, 'utf8');

      // The REAL LOCAL read -- never queries Brain.
      const quad = folderMemory.readQuadruple(env.sectionPath);
      assert.ok(quad.brain && quad.brain.parse_failed !== true,
        label + ': readQuadruple.brain must be a non-null, parseable struct after derivation');
      assert.equal(quad.brain.staleness, 'fresh',
        label + ': the LOCAL derivation writes staleness:fresh');
      assert.equal(quad.brain.author, 'brain',
        label + ': the LOCAL derivation is brain-authored (author:brain)');

      // The local Mode-A/offline-exempt session reads with brainAvailable:true
      // (the same contract the shipped NAV-02 tier-rise test uses). The REAL
      // resolveTierMode lifts the section to mode_a -- ABOVE tier_0.
      const tier = shared.resolveTierMode(quad, true);
      assert.notEqual(tier, 'tier_0',
        label + ': a fresh, brain-authored BRAIN.md must lift the tier ABOVE tier_0 (observable rise)');
      assert.equal(tier, 'mode_a',
        label + ': the local-session read (brainAvailable:true) resolves the fresh local derivation to mode_a');
      ok(label);
    } catch (e) {
      fail(label, e);
    } finally {
      env.cleanup();
    }
  }

  // =====================================================================
  // Test B2 -- OFFLINE-EXEMPT mode_b tier rise (NO Brain reachable)
  // =====================================================================
  {
    const label =
      'ACPT-05 B2 MODE-B: a derived BRAIN.md with stale_reason:brain_offline -> resolveTierMode(quad, false) === mode_b -- ALSO above tier_0 with NO Brain reachable (the genuine offline-exempt rise)';
    const env = makeSection();
    try {
      // The offline-exempt derived artifact: staleness:stale + brain_offline.
      // This is the artifact a prior derivation leaves when Brain went offline;
      // the resolver treats it as the Mode-B (Local Only) tier per Canon Part 3.
      writeBrainMd(env.sectionPath, {
        section: env.section,
        staleness: 'stale',
        stale_reason: 'brain_offline',
        author: 'brain',
      });
      const quad = folderMemory.readQuadruple(env.sectionPath);
      assert.ok(quad.brain && quad.brain.parse_failed !== true,
        label + ': precondition -- a parseable BRAIN.md must be present');
      assert.equal(quad.brain.stale_reason, 'brain_offline',
        label + ': precondition -- the artifact must carry stale_reason:brain_offline');

      const tier = shared.resolveTierMode(quad, false);
      assert.equal(tier, 'mode_b',
        label + ': brain unreachable + brain_offline -> mode_b (the offline-exempt tier)');
      assert.notEqual(tier, 'tier_0',
        label + ': mode_b is ABOVE tier_0 (a genuine rise with NO Brain reachable)');
      ok(label);
    } catch (e) {
      fail(label, e);
    } finally {
      env.cleanup();
    }
  }

  // =====================================================================
  // Test C -- Part 8 / Part 9 (no user content in BRAIN.md; pure LOCAL read)
  // =====================================================================
  {
    const label =
      'ACPT-05 C PART-8/9: the LOCAL-derivation BRAIN.md carries no fixture user-content sentinel and no egress token (generic handles only); the tier rise needed NO Brain call (pure LOCAL readQuadruple)';
    try {
      assert.notEqual(derivedBrainBody, null,
        label + ': precondition -- Test B must have produced a BRAIN.md body to sweep');

      // Part 8/9: the fictional user-content sentinel from the LOCAL triple body
      // must NOT appear in the produced BRAIN.md. The derivation carries only
      // generic handles (hash + enum + slug) -- no user prose crosses.
      assert.equal(derivedBrainBody.indexOf(USER_CONTENT_SENTINEL), -1,
        label + ': the user-content sentinel must NOT appear in the produced BRAIN.md (Part 8 generic-handles-only)');

      // No Brain/web egress token in the LOCAL artifact.
      for (const token of EGRESS_TOKENS) {
        assert.equal(derivedBrainBody.indexOf(token), -1,
          label + ': the BRAIN.md must NOT contain the egress token "' + token + '" (Part 8 LOCAL-only)');
      }

      // Part 9: the tier rise was reached with NO Brain call -- isAvailable() is
      // false throughout the hermetic arm, yet Test B reached a tier ABOVE
      // tier_0 via a pure LOCAL readQuadruple. The tier read is a LOCAL read.
      assert.equal(brainClient.isAvailable(), false,
        label + ': isAvailable() must remain false -- the tier rise required no Brain reachability (SQL/file is the local mind)');
      ok(label);
    } catch (e) {
      fail(label, e);
    }
  }

  // =====================================================================
  // Test D -- HONEST NEGATIVE (broken/unavailable derivation stays tier_0)
  // =====================================================================
  {
    const label =
      'ACPT-05 D NEGATIVE: a BRAIN.md with staleness:unavailable (and a parse_failed one) -> resolveTierMode stays tier_0 (the tier never rises on a broken/unavailable derivation -- no false-green)';
    const envUnavail = makeSection();
    const envParseFail = makeSection();
    try {
      // (i) unavailable -> tier_0
      writeBrainMd(envUnavail.sectionPath, {
        section: envUnavail.section,
        staleness: 'unavailable',
        stale_reason: null,
        author: 'brain',
      });
      const quadUnavail = folderMemory.readQuadruple(envUnavail.sectionPath);
      assert.equal(quadUnavail.brain.staleness, 'unavailable',
        label + ': precondition -- the unavailable BRAIN.md must read staleness:unavailable');
      assert.equal(shared.resolveTierMode(quadUnavail, true), 'tier_0',
        label + ': staleness:unavailable must stay tier_0 even with brainAvailable:true');
      assert.equal(shared.resolveTierMode(quadUnavail, false), 'tier_0',
        label + ': staleness:unavailable must stay tier_0 with brainAvailable:false');

      // (ii) parse_failed -> tier_0. An empty BRAIN.md parses as parse_failed.
      fs.writeFileSync(path.join(envParseFail.sectionPath, 'BRAIN.md'), '', 'utf8');
      const quadParseFail = folderMemory.readQuadruple(envParseFail.sectionPath);
      assert.equal(quadParseFail.brain.parse_failed, true,
        label + ': precondition -- the empty BRAIN.md must read parse_failed:true');
      assert.equal(shared.resolveTierMode(quadParseFail, true), 'tier_0',
        label + ': parse_failed must stay tier_0 even with brainAvailable:true');
      ok(label);
    } catch (e) {
      fail(label, e);
    } finally {
      envUnavail.cleanup();
      envParseFail.cleanup();
    }
  }

  // =====================================================================
  // LIVE ARM (autonomous:false / human_needed -- Task 2 checkpoint)
  // Runs ONLY when the real Brain is reachable; otherwise SKIPS honestly.
  // Never fakes mode_a when Brain is down.
  // =====================================================================
  {
    const label =
      'ACPT-05 LIVE: a FULL deriveSection (real Brain-query) lifts the tier to mode_a (autonomous:false / human_needed)';
    // The hermetic env above neutralized the Brain key in-process, so the live
    // arm cannot run in this hermetic invocation by construction. An operator
    // running the live arm per the Task-2 human-verify checkpoint must do so in
    // a process with a reachable Brain (and WITHOUT this file's hermetic env
    // neutralization). We honour the contract: detect reachability and SKIP
    // honestly here rather than ever faking mode_a.
    let liveReachable = false;
    try { liveReachable = brainClient.isAvailable() === true; } catch (_e) { liveReachable = false; }

    if (!liveReachable) {
      skip(label, 'live-Brain arm: Brain unreachable; the hermetic mode_a + mode_b arms already proved the tier rise');
    } else {
      // Defensive: if a future operator runs this with a reachable Brain, drive
      // the REAL full deriveSection and assert mode_a. Never faked.
      const env = makeSection();
      try {
        const res = await derivation.deriveSection(env.roomDir, env.section, {});
        assert.equal(res && res.success, true,
          label + ': the full deriveSection must succeed against a reachable Brain (reason: ' + (res && res.reason) + ')');
        const quad = folderMemory.readQuadruple(env.sectionPath);
        assert.ok(quad.brain && quad.brain.parse_failed !== true,
          label + ': readQuadruple.brain must be non-null after a live derivation');
        const tier = shared.resolveTierMode(quad, true);
        assert.equal(tier, 'mode_a',
          label + ': a live fresh BRAIN.md read with brainAvailable:true must resolve to mode_a');
        // Part 8 spot-check: the live artifact carries no fixture user content.
        const body = fs.readFileSync(path.join(env.sectionPath, 'BRAIN.md'), 'utf8');
        assert.equal(body.indexOf(USER_CONTENT_SENTINEL), -1,
          label + ': the live BRAIN.md must NOT echo fixture user content (Part 8)');
        ok(label);
      } catch (e) {
        fail(label, e);
      } finally {
        env.cleanup();
      }
    }
  }

  finishAndExit();
}

function finishAndExit() {
  // Clean the hermetic HOME.
  try { fs.rmSync(HERMETIC_HOME, { recursive: true, force: true }); } catch (_e) {}

  process.stdout.write('\n');
  process.stdout.write(
    'ACPT-05 BRAIN.md derive -> tier_mode rises (Phase 146-03 acceptance): ' +
    passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  try { fs.rmSync(HERMETIC_HOME, { recursive: true, force: true }); } catch (_e) {}
  process.stderr.write('FAIL test-acpt-05-brain-derive-tier-rise.cjs: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
