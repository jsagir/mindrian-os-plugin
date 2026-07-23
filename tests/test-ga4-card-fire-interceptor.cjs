'use strict';
/*
 * Phase 179-01 Task 1 - the GA-4 card-fire interceptor proof suite (the R-1 cure).
 *
 * R15 (Phase 178) proves a gate surface is WIRED to emit a card; it cannot force the
 * model to FIRE the card at runtime (the named R-1 residual). This interceptor moves
 * enforcement BELOW the agent: a deterministic Stop-hook-class turn-scan that detects
 * a reached-Decision-Gate turn with no fired AskUserQuestion card and FORCES the card
 * via an exit-2 block + additionalContext re-prompt, degrading gracefully after N
 * bounded retries.
 *
 * This suite asserts the four load-bearing behaviors of the exported, deterministic
 * predicate classifyCardFire(turn, registry) plus the Stop-hook envelope shape:
 *   (a) reached-gate-no-card  -> intercept=true  + exit-2 block envelope carrying a
 *                                calm decision/reason/systemMessage (see
 *                                stop-hook-invalid-hookspecificoutput-schema RCA: the
 *                                envelope NEVER carries hookSpecificOutput -- Stop has
 *                                no hookSpecificOutput variant in Claude Code's schema
 *                                and including it rejects the whole envelope)
 *   (b) non-gate turn         -> intercept=false (ZERO forced cards on an ordinary turn)
 *   (c) reached-gate + card FIRED -> intercept=false (the card fired; nothing to force)
 *   (d) MAX_FORCE_RETRIES reached -> degrade=true + { continue: true } (no infinite loop)
 *   plus the ASCII-box BACKSTOP (off-registry literal anti-pattern is still caught).
 *
 * Canon Part 8 (The Graph Boundary): the interceptor is LOCAL-only. This suite asserts
 * zero Brain/network symbols in the touched surface. House rule: hyphens only, no
 * em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const INTERCEPTOR_PATH = path.join(REPO_ROOT, 'scripts', 'check-card-fire.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const m = require(INTERCEPTOR_PATH);

ok('classifyCardFire is exported as a function',
  typeof m.classifyCardFire === 'function');
ok('MAX_FORCE_RETRIES is exported as a positive integer',
  Number.isInteger(m.MAX_FORCE_RETRIES) && m.MAX_FORCE_RETRIES > 0);

// A minimal stand-in registry mirroring the Phase 178 R15 render-coverage registry
// shape: entries[] each with render_coverage 'card-emission' for gate-reaching
// surfaces. The interceptor enumerates these as the PRIMARY gate-reaching set; it
// must NOT hand-maintain a parallel list.
const FIXTURE_REGISTRY = {
  entries: [
    { entry: 'lib/core/navigation-engine-offer.cjs', render_coverage: 'card-emission' },
    { entry: 'lib/core/room-naming-selector.cjs', render_coverage: 'card-emission' },
    { entry: 'lib/render/render-only-thing.cjs', render_coverage: 'render-only-excluded', reason: 'render-only' },
  ],
};

// ---------------------------------------------------------------------------
// (a) PRIMARY positive: a render-coverage-registry gate-reaching surface ran this
//     turn AND no AskUserQuestion tool-call appears -> intercept=true.
// ---------------------------------------------------------------------------
const reachedNoCard = {
  ran_entries: ['lib/core/navigation-engine-offer.cjs'],
  askuserquestion_fired: false,
  output_text: 'Here are your options.',
  // card-fire-relevance-check-gap (2026-07-17): a PRIMARY intercept now REQUIRES a non-empty
  // reach-recorded gate_subject_text (CONFIRMED proof a gate was reached THIS turn -- ran_entries
  // alone bleeds across turns via the side-channel NO_SESSION_KEY union + TTL) AND topical
  // relevance against it. A genuine primary gate supplies both, so this still force-fires.
  gate_subject_text: 'Choose your starting point: solution-first, domain-first, or venture-first',
  preceding_user_text: 'help me choose a starting point for my venture',
};
const ra = m.classifyCardFire(reachedNoCard, FIXTURE_REGISTRY);
ok('(a) PRIMARY: reached-gate-no-card yields intercept=true', ra.intercept === true);
ok('(a) PRIMARY: reached-gate-no-card is not a degrade', ra.degrade !== true);
ok('(a) PRIMARY: a reason string is attached', typeof ra.reason === 'string' && ra.reason.length > 0);

// ---------------------------------------------------------------------------
// (BACKSTOP) an OFF-registry surface that emitted the ASCII-box gate glyphs with no
//     AskUserQuestion fired is still intercepted (the literal anti-pattern).
// ---------------------------------------------------------------------------
const asciiBoxTurn = {
  ran_entries: ['lib/core/some-off-registry-surface.cjs'],
  askuserquestion_fired: false,
  output_text: [
    'Choose your starting point:',
    '  [1] Solution-first',
    '  [2] Domain-first',
    '  [3] Venture-first',
    'type 1, 2, or 3',
  ].join('\n'),
};
const bb = m.classifyCardFire(asciiBoxTurn, FIXTURE_REGISTRY);
ok('(BACKSTOP) off-registry ASCII-box gate glyphs with no card yields intercept=true',
  bb.intercept === true);

// ---------------------------------------------------------------------------
// (b) NEGATIVE: a turn with NO gate-reaching signal and no ASCII-box glyphs ->
//     intercept=false (zero forced cards on an ordinary turn).
// ---------------------------------------------------------------------------
const ordinaryTurn = {
  ran_entries: ['lib/core/some-non-gate-helper.cjs'],
  askuserquestion_fired: false,
  output_text: 'I read the file and summarized it for you.',
};
const nb = m.classifyCardFire(ordinaryTurn, FIXTURE_REGISTRY);
ok('(b) NEGATIVE: a non-gate ordinary turn yields intercept=false', nb.intercept === false);

// A render-only-excluded entry running is NOT a gate-reaching surface -> no intercept.
const renderOnlyTurn = {
  ran_entries: ['lib/render/render-only-thing.cjs'],
  askuserquestion_fired: false,
  output_text: 'rendered some text',
};
const ro = m.classifyCardFire(renderOnlyTurn, FIXTURE_REGISTRY);
ok('(b) NEGATIVE: a render-only-excluded surface is not gate-reaching -> intercept=false',
  ro.intercept === false);

// ---------------------------------------------------------------------------
// (c) NEGATIVE: a reached-gate turn where the AskUserQuestion DID fire ->
//     intercept=false (the card fired; nothing to force).
// ---------------------------------------------------------------------------
const reachedCardFired = {
  ran_entries: ['lib/core/navigation-engine-offer.cjs'],
  askuserquestion_fired: true,
  output_text: 'options presented',
};
const cf = m.classifyCardFire(reachedCardFired, FIXTURE_REGISTRY);
ok('(c) NEGATIVE: reached-gate WITH a fired card yields intercept=false', cf.intercept === false);

// ---------------------------------------------------------------------------
// (d) BOUNDED ESCAPE: after MAX_FORCE_RETRIES consecutive intercepts on the same
//     turn-context, the predicate degrades to log+allow (degrade=true) so a
//     genuinely card-incapable surface cannot trap the navigator.
// ---------------------------------------------------------------------------
const atLimit = {
  ran_entries: ['lib/core/navigation-engine-offer.cjs'],
  askuserquestion_fired: false,
  output_text: 'still no card',
  retry_count: m.MAX_FORCE_RETRIES,
};
const dg = m.classifyCardFire(atLimit, FIXTURE_REGISTRY);
ok('(d) BOUNDED ESCAPE: at MAX_FORCE_RETRIES the predicate returns degrade=true',
  dg.degrade === true);
ok('(d) BOUNDED ESCAPE: at the limit it stops forcing (intercept=false on degrade)',
  dg.intercept === false);

// Below the limit, it still intercepts.
const belowLimit = {
  ran_entries: ['lib/core/navigation-engine-offer.cjs'],
  askuserquestion_fired: false,
  output_text: 'no card yet',
  retry_count: m.MAX_FORCE_RETRIES - 1,
  // card-fire-relevance-check-gap: a genuine primary gate supplies a relevant recorded
  // subject so it still intercepts below the ceiling (the at-limit fixture above degrades
  // BEFORE the gate-existence guard, so it needs no subject).
  gate_subject_text: 'Choose your starting point: solution-first, domain-first, or venture-first',
  preceding_user_text: 'help me choose a starting point for my venture',
};
const bl = m.classifyCardFire(belowLimit, FIXTURE_REGISTRY);
ok('(d) BOUNDED ESCAPE: below the limit it still intercepts', bl.intercept === true && bl.degrade !== true);

// ---------------------------------------------------------------------------
// ENVELOPE: buildEnforcementEnvelope(verdict) shapes the Stop-hook output. On an
// intercept it is a decision:block envelope carrying only schema-valid top-level
// Stop-hook fields (decision, reason, systemMessage, continue). On a degrade it
// is { continue: true, suppressOutput: true }.
//
// stop-hook-invalid-hookspecificoutput-schema (2026-07-23, 4th occurrence of this
// defect class): this suite previously asserted the envelope CARRIES
// hookSpecificOutput.additionalContext -- that was asserting the BUG. Claude
// Code's Stop-hook schema has no hookSpecificOutput variant at all (the union
// covers only PreToolUse, UserPromptSubmit, PostToolUse); including the key
// rejected the WHOLE envelope on every real Stop hook run, which is exactly what
// a live user hit. The correct, schema-valid intercept envelope never carries
// hookSpecificOutput. See
// .planning/debug/resolved/stop-hook-invalid-hookspecificoutput-schema.md.
// ---------------------------------------------------------------------------
ok('buildEnforcementEnvelope is exported as a function',
  typeof m.buildEnforcementEnvelope === 'function');

const interceptEnv = m.buildEnforcementEnvelope(ra);
ok('ENVELOPE: an intercept envelope NEVER carries hookSpecificOutput (Stop has no such schema variant)',
  interceptEnv && interceptEnv.hookSpecificOutput === undefined);
ok('ENVELOPE: an intercept envelope carries decision:block + continue:false',
  interceptEnv.decision === 'block' && interceptEnv.continue === false);
ok('ENVELOPE: an intercept envelope carries a non-empty systemMessage (the calm, human-facing surface)',
  typeof interceptEnv.systemMessage === 'string' && interceptEnv.systemMessage.length > 0);

const degradeEnv = m.buildEnforcementEnvelope(dg);
ok('ENVELOPE: a degrade envelope is { continue: true } (no infinite loop)',
  degradeEnv && degradeEnv.continue === true);

// ---------------------------------------------------------------------------
// ENVELOPE (CR-06, 2026-07-11 reopen of Finding 1): Claude Code surfaces a Stop
// envelope's `reason` as "Stop hook error: <reason>" REGARDLESS of systemMessage
// (the original premise -- systemMessage suppresses it -- was proven FALSE live).
// So the intercept envelope must carry a calm, human-safe `reason` (NOT the internal
// slug) AND a non-empty systemMessage; the ORIGINAL slug is preserved in the LOCAL
// intercept log, never in the envelope. The degrade branch's `reason` is likewise a
// calm phrase, and the degrade (suppressOutput) branch carries no systemMessage.
// ---------------------------------------------------------------------------
const SLUG = 'ascii-box-backstop-no-card';
const slugEnv = m.buildEnforcementEnvelope({ intercept: true, reason: SLUG, degrade: false });
ok('ENVELOPE CR-06: an intercept envelope carries a non-empty string systemMessage',
  typeof slugEnv.systemMessage === 'string' && slugEnv.systemMessage.length > 0);
ok('ENVELOPE CR-06: the systemMessage does NOT leak the raw classification slug',
  slugEnv.systemMessage.indexOf(SLUG) === -1);
ok('ENVELOPE CR-06: the reason field is a calm phrase, NOT the raw slug (Claude shows it verbatim)',
  typeof slugEnv.reason === 'string' && slugEnv.reason.length > 0 && slugEnv.reason.indexOf(SLUG) === -1);
ok('ENVELOPE CR-06: the degrade envelope reason is also a calm phrase, NOT the raw slug',
  typeof degradeEnv.reason === 'string' && degradeEnv.reason.length > 0
  && degradeEnv.reason.indexOf('bounded-escape') === -1);
ok('ENVELOPE CR-06: the degrade envelope carries NO systemMessage (suppressOutput path)',
  degradeEnv.systemMessage === undefined);

// ---------------------------------------------------------------------------
// REGISTRY-KEYED: the gate-reaching enumeration is derived from the render-coverage
// registry's card-emission entries, not a hand-maintained list. gateReachingEntries
// is the exported enumerator.
// ---------------------------------------------------------------------------
ok('gateReachingEntries is exported as a function',
  typeof m.gateReachingEntries === 'function');
const gre = m.gateReachingEntries(FIXTURE_REGISTRY);
ok('REGISTRY-KEYED: gateReachingEntries returns only card-emission entries',
  Array.isArray(gre) &&
  gre.indexOf('lib/core/navigation-engine-offer.cjs') !== -1 &&
  gre.indexOf('lib/core/room-naming-selector.cjs') !== -1 &&
  gre.indexOf('lib/render/render-only-thing.cjs') === -1);

// ---------------------------------------------------------------------------
// DETERMINISM: same input -> same verdict (no network, no clock, no random).
// ---------------------------------------------------------------------------
const r1 = m.classifyCardFire(reachedNoCard, FIXTURE_REGISTRY);
const r2 = m.classifyCardFire(reachedNoCard, FIXTURE_REGISTRY);
ok('DETERMINISM: classifyCardFire is deterministic over identical input',
  JSON.stringify(r1) === JSON.stringify(r2));

// ---------------------------------------------------------------------------
// PART 8: the touched surface opens no Brain / network wire.
// ---------------------------------------------------------------------------
const src = fs.readFileSync(INTERCEPTOR_PATH, 'utf8');
ok('PART 8: no network / Brain symbols in check-card-fire.cjs',
  !/\bfetch\b|\bhttp\b|\bcurl\b|brain\.mindrian|tavily|mcp__brain/.test(src));

// ---------------------------------------------------------------------------
// DEFENSIVE: a malformed turn / missing registry never throws.
// ---------------------------------------------------------------------------
let threw = false;
try {
  m.classifyCardFire(null, null);
  m.classifyCardFire({}, {});
  m.classifyCardFire(undefined, FIXTURE_REGISTRY);
} catch (_e) {
  threw = true;
}
ok('DEFENSIVE: classifyCardFire never throws on malformed / missing input', threw === false);

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-ga4-card-fire-interceptor.cjs: PASSED');

module.exports = { pass };
