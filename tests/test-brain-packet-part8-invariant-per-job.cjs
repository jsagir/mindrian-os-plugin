'use strict';
// Phase 110-05 Task 2: D-11(d) Part-8 invariant per-job + round-trip schema check
// (PACKET-110-06 + PACKET-110-09).
//
// For all 12 D-02 jobs prove two properties:
//   (a) Round-trip: navigation.buildBrainPacket(db, job, focusId, ...) produces a packet
//       that ajv-validates against data/brain-packet-schema.json's $defs[job].in (one
//       compile + validate per job; the same chokepoint sendPacket uses, so a passing
//       round-trip mirrors what the wire will accept).
//   (b) Adversarial Part-8 sweep: with forbidden content seeded into node properties
//       AND absolute paths seeded into source_path, JSON.stringify(packet) contains
//       ZERO leak: no decision/claim/assumption/opportunity body, no mirror_solution,
//       no /home/ absolute path, no /secret/ path component, no email, no string field
//       longer than 500 chars, no ${injection} template-string fragment.
//
// Mirrors tests/test-navigation-packet-part8-leak.cjs's 8-tripwire sweep idiom -- this
// suite loops it over the 12 D-02 jobs and adds the schema round-trip.
//
// IMPORTANT: do NOT weaken the tripwires to make the test pass. A failing tripwire OR
// round-trip is a real Canon Part 8 leak or a schema/shape mismatch in
// lib/core/navigation/packet.cjs -- it should fail and the fix is a follow-up
// gap-closure plan, not a relaxation of this suite. The legitimately-emitted relative
// source-section slugs (e.g. "design") are NOT absolute /home/ paths and do not trip
// the tripwires.
//
// Pattern: CJS, node:assert/strict, no Mocha, no Jest. ajv is transitive via the MCP
// SDK -- never a direct dependency (per CLAUDE.md "What NOT to Use"). The schema is
// draft 2020-12; use ajv/dist/2020.

const { ok } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

const Ajv2020 = require('ajv/dist/2020').default || require('ajv/dist/2020');

const D02_JOBS = [
  'select_methodology',
  'suggest_next_move',
  'detect_contradiction',
  'summarize_neighborhood',
  'classify_room_budding',
  'rank_assumptions',
  'generate_feynman_explanation',
  'strengthen_minto',
  'prepare_investor_brief',
  'opportunity_react',
  'opportunity_reflect',
  'opportunity_rank',
];

function makeRoomWithForbidden() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-110-part8-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const insN = db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) "
    + "VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)"
  );
  insN.run('room:test', 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  // Decision focus -- carry a long transcript + a forbidden body + a ${injection}
  // template fragment + an absolute /home/jsagi/secret/ source_path.
  const transcript = 'B'.repeat(800);
  insN.run(
    'decision:focus', 'decision',
    JSON.stringify({ summary: 'short', body: 'SECRET RAW DECISION BODY ${injection}', transcript }),
    '/home/jsagi/secret/path/decision.md',
    0.7, 'confirmed', nowMs, nowMs, 'design'
  );
  insN.run(
    'claim:c1', 'claim',
    JSON.stringify({ summary: 'short', body: 'SECRET RAW CLAIM BODY', email: 'leak@example.com' }),
    '/home/jsagi/secret/c1.md',
    0.6, 'confirmed', nowMs, nowMs, 'design'
  );
  insN.run(
    'assumption:a1', 'assumption',
    JSON.stringify({ claim: 'short', body: 'SECRET RAW ASSUMPTION ${x}' }),
    '/home/jsagi/a1.md',
    0.5, 'proposed', nowMs, nowMs, 'design'
  );
  insN.run(
    'opportunity:hi', 'opportunity',
    JSON.stringify({
      hsi_score: 85,
      tags: ['fintech', 'b2b'],
      body: 'SECRET RAW OPP BODY ' + 'y'.repeat(300),
      mirror_solution: 'SECRET MIRROR',
    }),
    '/home/jsagi/oh.md',
    0.6, 'confirmed', nowMs, nowMs, 'design'
  );
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  insE.run('decision:focus', 'claim:c1', 'INFORMS');
  insE.run('decision:focus', 'assumption:a1', 'ASSUMES');
  insE.run('decision:focus', 'opportunity:hi', 'BANKED_BY');
  return { tmp, db };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }

function defaultMocks() {
  return {
    jtbd: { getCurrent: () => ({ current: null }) },
    operator: { getCurrent: () => ({ current: null }) },
  };
}

// Phase 125-03: buildBrainPacket is now async; run() awaits each call.
async function run() {
  let assertions = 0;

  // Compile the 110-01 schema once. Use the same Ajv2020 + wrapper-with-inline-$defs
  // pattern that lib/core/brain-client.cjs::_validatorFor uses, so the suite validates
  // against the same compile path the wire uses.
  const schemaPath = path.join(REPO_ROOT, 'data', 'brain-packet-schema.json');
  const schemaRaw = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(schemaRaw);

  for (const job of D02_JOBS) {
    const { tmp, db } = makeRoomWithForbidden();
    try {
      const packet = await navigation.buildBrainPacket(db, job, 'decision:focus', {
        _mocks: defaultMocks(),
        roomId: 'test',
      });
      ok(packet && packet.job === job,
        'job ' + job + ': buildBrainPacket returned a packet with packet.job === job');
      assertions++;

      // (a) round-trip: the produced packet validates against $defs[job].in.
      // The schema's per-job shape is $defs[job].in (NOT $defs[job].properties.in --
      // see brain-client.cjs comment around _validatorFor). The wrapper carries the
      // root's $defs inline so cross-refs (FocusNode, BankedOpportunities, etc.)
      // resolve (a known ajv@8 quirk -- mirrors the wire compile path).
      const validateIn = ajv.compile({
        $id: 'urn:test:part8:' + job + ':in',
        $ref: '#/$defs/' + job + '/in',
        $defs: schemaRaw.$defs,
      });
      const okIn = validateIn(packet);
      ok(okIn,
        'job ' + job + ': buildBrainPacket output validates against $defs[' + job + '].in; errors='
        + JSON.stringify(validateIn.errors));
      assertions++;

      // (b) adversarial Part-8 sweep. Mirrors tests/test-navigation-packet-part8-leak.cjs's
      // 8-tripwire idiom; this suite asserts the same invariants per job for all 12.
      const s = JSON.stringify(packet);

      ok(!/SECRET RAW DECISION BODY/.test(s),
        'job ' + job + ': tripwire -- no decision body leak in JSON.stringify(packet)');
      assertions++;
      ok(!/SECRET RAW CLAIM BODY/.test(s),
        'job ' + job + ': tripwire -- no claim body leak');
      assertions++;
      ok(!/SECRET RAW ASSUMPTION/.test(s),
        'job ' + job + ': tripwire -- no assumption body leak');
      assertions++;
      ok(!/SECRET RAW OPP BODY/.test(s),
        'job ' + job + ': tripwire -- no opportunity body leak');
      assertions++;
      ok(!/SECRET MIRROR/.test(s),
        'job ' + job + ': tripwire -- no mirror_solution leak');
      assertions++;

      ok(!/\/home\/jsagi\//.test(s),
        'job ' + job + ': tripwire -- no absolute /home/jsagi/ path leak');
      assertions++;
      ok(!/\/secret\//.test(s),
        'job ' + job + ': tripwire -- no /secret/ path component leak');
      assertions++;

      ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(s),
        'job ' + job + ': tripwire -- no email address leak');
      assertions++;

      // No single quoted string field longer than 500 chars (catches transcripts /
      // long bodies that escaped the safe-projection mappers). split('"') is the same
      // crude-but-effective heuristic test-navigation-packet-part8-leak.cjs's Tripwire 4
      // uses; here split-by-quote is a per-field upper-bound proxy.
      const longField = s.split('"').some(function (x) { return x.length > 500; });
      ok(!longField,
        'job ' + job + ': tripwire -- no string field exceeds 500 chars (transcript-length leak)');
      assertions++;

      // No template-injection-shaped string fragment.
      ok(!/\$\{[^}]+\}/.test(s),
        'job ' + job + ': tripwire -- no ${...} template-injection string leak');
      assertions++;

      db.close();
    } finally {
      cleanup(tmp);
    }
  }

  process.stdout.write('test-brain-packet-part8-invariant-per-job: PASS (' + assertions + ' assertions)\n');
}

// Phase 125-03: run() is async; surface promise rejections cleanly.
run().catch(function (e) {
  process.stderr.write('FAIL: ' + (e && e.stack ? e.stack : String(e)) + '\n');
  process.exit(1);
});
