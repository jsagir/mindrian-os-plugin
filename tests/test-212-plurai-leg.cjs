#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 212-04 -- the OPTIONAL deployed-classifier leg (navigator Q3 lock).
 *
 * WHAT THIS IS
 *   The local two-stage critic (lib/core/eureka-critic.cjs) is the CORE of the
 *   Grounding Guard. This leg is a SEPARATELY-GATED optional signal: a deployed
 *   Plurai classifier scored on the SYNTHETIC gold-card connection text. It can
 *   NEVER block the phase -- when no key resolves OR the endpoint errors/404s it
 *   degrades to SKIP and writes a baseline_deferred record, exactly the sanctioned
 *   path from test-211-judge-gate.cjs. As of build time the cross-topic-connection
 *   route 404s (evals/plurai/211-baseline.json), so this leg SKIPs on this machine.
 *
 * --------------------------------------------------------------------------
 * PART 8 EGRESS RULE (stated once, enforced structurally):
 * Plurai is BUILD/CI ONLY, never the runtime path, never real-room content. This
 * leg scores ONLY the pseudonymous, synthetic-by-construction gold-card texts from
 * evals/eureka/cases/. It never opens any room database. (The local critic is the
 * runtime Grounding Guard; this deployed judge is an offline calibration signal.)
 * --------------------------------------------------------------------------
 *
 * Reuse before build (Part 7): callJudge / JUDGES / endpointUrl come from
 * lab/eval/report-from-transcript.cjs; no hand-rolled REST client.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..');
const CASES_DIR = path.join(REPO, 'evals', 'eureka', 'cases');
const BASELINE_PATH = path.join(REPO, 'evals', 'plurai', '212-baseline.json');

const matter = require('gray-matter');
const rft = require(path.join(REPO, 'lab/eval/report-from-transcript.cjs'));

let PASS = 0;
let FAIL = 0;
let SKIP = 0;

async function ok(label, fn) {
  try {
    const r = await fn();
    if (r === 'SKIP') { console.log('SKIP ' + label); SKIP += 1; return; }
    console.log('ok   ' + label);
    PASS += 1;
  } catch (e) {
    console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e));
    FAIL += 1;
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function card(stem) {
  const raw = fs.readFileSync(path.join(CASES_DIR, stem + '.md'), 'utf8');
  return matter(raw).data;
}

// Plurai key resolution -- mirror the 211-05 contract: env var, then
// ~/.config/evals/credentials.json. loadApiKey is not exported by rft.
function resolvePluraiKey() {
  if (process.env.PLURAI_API_KEY) return process.env.PLURAI_API_KEY;
  try {
    const p = path.join(os.homedir(), '.config', 'evals', 'credentials.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j.api_key || null;
  } catch (_e) {
    return null;
  }
}

// Write/refresh the deferred baseline in the 211-baseline.json house shape, with
// both the boolean flag and the explicit status string.
function writeDeferredBaseline(reason, detail) {
  const payload = {
    schema_version: '1.0',
    artifact_kind: 'ci-baseline',
    status: 'baseline_deferred',
    baseline_deferred: true,
    reason: reason,
    detail: detail || null,
    date: new Date().toISOString().slice(0, 10),
    legs: ['cross-topic-connection'],
    judge_slug: rft.JUDGES.elevation.slug,
    judge_labels: rft.JUDGES.elevation.labels,
    synthetic_only: true,
    optional_leg: true,
    deferred_note: 'OPTIONAL deployed-classifier leg (navigator Q3 lock): the local '
      + 'two-stage critic is the core Grounding Guard; this Plurai leg is a separately '
      + 'gated calibration signal that scores ONLY the pseudonymous gold-card connection '
      + 'texts, never real-room content (Part 8 egress rule). '
      + (reason === 'no_plurai_key'
        ? 'No Plurai key resolved at build time -- honest deferral. Re-run with '
          + 'PLURAI_API_KEY (or ~/.config/evals/credentials.json) to record a hosted baseline.'
        : 'A key resolved but the judge endpoint was unreachable (see detail). The '
          + 'cross-topic-connection route is not deployed at the expected URL as of build '
          + 'time; deferred honestly. Deploy or correct the endpoint, then re-run.'),
    endpoint: rft.endpointUrl(rft.JUDGES.elevation.slug),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
}

async function run() {
  console.log('test-212-plurai-leg (optional deployed-classifier signal; SKIP-degrading)');
  console.log('');

  await ok('Optional Plurai leg scores the synthetic gold-card connection (or degrades to a deferred baseline)', async function () {
    const key = resolvePluraiKey();
    if (!key) {
      const p = writeDeferredBaseline('no_plurai_key');
      assert(p.status === 'baseline_deferred', 'deferred baseline must be written');
      console.log('     (no Plurai key -> SKIP + wrote deferred baseline ' + path.relative(REPO, BASELINE_PATH) + ')');
      return 'SKIP';
    }

    // Build the judge input from SYNTHETIC gold-card text ONLY.
    const dm = card('archimedes-darkmatter');
    const transferable = 'Statement A: ' + dm.hypothesis_in + '\nStatement B: ' + dm.destination
      + '\nClaim: these connect because they share the mechanism of statistical background subtraction.';

    const res = await rft.callJudge(rft.JUDGES.elevation.slug, key, transferable, {});

    // Endpoint gap tolerance: any error (404 / unreachable) degrades to a deferred
    // baseline and SKIPs -- never a red CI failure (T-212-16 mitigation).
    if (res.error) {
      const p = writeDeferredBaseline('plurai_endpoint_unreachable', res.reason || res.label);
      assert(p.status === 'baseline_deferred', 'deferred baseline must be written on endpoint error');
      console.log('     (endpoint unreachable -> SKIP + wrote deferred baseline; ' + (res.reason || res.label) + ')');
      return 'SKIP';
    }

    // Live: the transferable connection should judge Hedged or Confident.
    assert(res.label === 'Hedged' || res.label === 'Confident',
      'the transferable darkmatter connection must judge Hedged or Confident (got ' + res.label + ')');
    const live = {
      schema_version: '1.0',
      artifact_kind: 'ci-baseline',
      status: 'baseline_live',
      baseline_deferred: false,
      method: 'hosted-plurai',
      date: new Date().toISOString().slice(0, 10),
      legs: ['cross-topic-connection'],
      judge_slug: rft.JUDGES.elevation.slug,
      synthetic_only: true,
      optional_leg: true,
      results: { transferable_darkmatter: res.label },
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(live, null, 2) + '\n', 'utf8');
    console.log('     (live Plurai baseline recorded: transferable_darkmatter=' + res.label + ')');
  });

  console.log('');
  console.log('Phase 212 plurai-leg: PASS=' + PASS + ' FAIL=' + FAIL + ' SKIP=' + SKIP);
  // The optional leg NEVER red-fails on a missing key or an unreachable endpoint.
  process.exit(FAIL === 0 ? 0 : 1);
}

run();
