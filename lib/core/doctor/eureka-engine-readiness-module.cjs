'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * lib/core/doctor/eureka-engine-readiness-module.cjs -- Phase 387 Plan 07 (PRD scope item 5).
 *
 * WHAT check() DOES: reports whether the Eureka engine (the new mindrian-eureka project) is set up on this
 * machine and whether it is ready for the graph tools. It reads the engine location through the one
 * resolver (eureka-engine-resolver.cjs) and the readiness through the one check function
 * (checkEngine in eureka-engine-requirements.cjs). It repeats no resolution rule, no uv check and no
 * package probe (Canon Part 7, reuse before build).
 *
 * FIVE THINGS this header states:
 *
 * (1) Contract: check(ctx, deps) -> { status, detail, action_lines }. Check only. There is no fix export:
 *     the registry row says fix_supported false, and the contract-parity gate
 *     (tests/test-doctor-module-contract-parity.cjs) fails a check-only module that exports one. The fixes
 *     are the /mos:eureka enable engine flags, run by the person.
 *
 * (2) Reporter, not a gate: a machine with no engine is fine, because /mos:eureka runs without the engine.
 *     The status for "not set up" is skip. No path returns error for a missing engine, so this point never
 *     fails the doctor or the release acceptance roll-up.
 *
 * (3) Canon Part 8: local reads only. The only processes started (inside checkEngine) are uv --version,
 *     uv python find and node --version, each with shell false. The engine itself is never started and
 *     there is no network call and no Brain call here.
 *
 * (4) Why the point reads the installed package groups and not the environment settings file: a prepared
 *     environment folder does not show which package groups are installed, so a green line could still end
 *     in a refusal on the scout or the decision routes. checkEngine reads the package folder names. When the
 *     layout cannot be read, the status is warn ("not verified"), never ok.
 *
 * (5) Why the point does not run the engine own health check: that check runs engine code, needs the
 *     encoder libraries (so it fails on a graph-only setup) and takes seconds. A doctor point must be fast
 *     and must not fail a valid minimal setup. The engine own check stays available as the deep check of
 *     /mos:eureka enable engine --check --deep.
 *
 * ok means ready for the graph tools only. The same line lists each route family that is not ready (the
 * encoder group, the hmm group, a model folder, Node.js 22 or newer), each with its exact fix.
 *
 * check is synchronous because the accumulative engine loop in scripts/doctor.cjs is synchronous.
 * Every path returns a status and a non-empty detail string; check never throws.
 */

const resolver = require('../eureka/eureka-engine-resolver.cjs');
const requirements = require('../eureka/eureka-engine-requirements.cjs');

const SYNC = '/mos:eureka enable engine --sync';
const DEEP = '/mos:eureka enable engine --check --deep';

function envFor(ctx, deps) {
  if (deps && deps.env && typeof deps.env === 'object') return deps.env;
  const env = Object.assign({}, process.env);
  if (ctx && typeof ctx.home === 'string' && ctx.home) {
    env.HOME = ctx.home;
    env.USERPROFILE = ctx.home;
  }
  return env;
}

function sentenceFor(cause, extras) {
  return resolver.describeEngineState({ state: 'broken', cause, detail: { extras } });
}

function checkById(result, id) {
  return (result.checks || []).find((c) => c.id === id) || null;
}

function familyFix(family) {
  if (family.status === 'needs_extra') return SYNC + ' --extras ' + family.needs.join(',');
  if (family.status === 'needs_node') return sentenceFor(family.cause || 'node_missing').fix;
  if (family.status === 'needs_model') return sentenceFor('model_missing').fix;
  return DEEP;
}

function readyLine(engine, result) {
  const uv = checkById(result, 'uv');
  const node = checkById(result, 'node');
  const model = checkById(result, 'model');
  const parts = ['Eureka engine: ready for the graph tools (source ' + engine.source + ', folder ' + engine.root + ').'];
  parts.push((uv && uv.detail ? String(uv.detail) : 'uv found') + '. Python ok.');
  parts.push(model && model.ok ? 'Model folder: found.' : "Model folder: not found (the engine's own search may differ).");
  if (node && node.ok) parts.push('Node.js: ' + node.detail + ' ok.');
  else if (node && /older than 22/.test(String(node.detail))) parts.push('Node.js: older than version 22 (needed by some workers).');
  else parts.push('Node.js: not found (needed by some workers).');
  const notReady = (result.families || []).filter((f) => f.status !== 'ready');
  const actions = [];
  if (notReady.length) {
    parts.push('Not ready: ' + notReady.map((f) => f.family + ' (needs ' + f.needs.join(', ') + ')').join('; ') + '.');
    for (const f of notReady) {
      const fix = familyFix(f);
      if (actions.indexOf(fix) === -1) actions.push(fix);
    }
  }
  const pairs = (result.families || []).find((f) => f.family === 'pairs-and-scout');
  if (pairs && pairs.status === 'ready' && !(model && model.ok)) {
    const fix = sentenceFor('model_missing').fix;
    if (actions.indexOf(fix) === -1) actions.push(fix);
  }
  parts.push('ok here means ready for the graph tools only.');
  return { detail: parts.join(' '), actions };
}

function check(ctx, deps) {
  try {
    const env = envFor(ctx, deps);
    const engine = resolver.resolveEngine(env);
    if (engine.state === 'absent') {
      const d = resolver.describeEngineState({ state: 'absent' });
      return {
        status: 'skip',
        detail: 'Eureka engine: not set up (optional). /mos:eureka runs without the engine. The engine tools need it.',
        action_lines: [d.fix],
      };
    }
    if (engine.state === 'broken') {
      const d = resolver.describeEngineState({ state: 'broken', cause: engine.cause });
      return { status: 'warn', detail: 'Eureka engine: ' + d.sentence, action_lines: [d.fix] };
    }
    const result = requirements.checkEngine(engine.root, { env, spawnSync: deps && deps.spawnSync });
    if (result.ok === false) {
      const d = sentenceFor(result.cause, ['mcp-server']);
      return { status: 'warn', detail: 'Eureka engine: ' + d.sentence, action_lines: [d.fix, DEEP] };
    }
    if (result.ok === null) {
      return {
        status: 'warn',
        detail: 'Eureka engine: set up, but the installed package groups were not verified because the environment layout was not recognized.',
        action_lines: [DEEP],
      };
    }
    const ready = readyLine(engine, result);
    return { status: 'ok', detail: ready.detail, action_lines: ready.actions };
  } catch (_error) {
    return { status: 'warn', detail: 'Eureka engine: the readiness check could not run.', action_lines: [DEEP] };
  }
}

module.exports = { check };
