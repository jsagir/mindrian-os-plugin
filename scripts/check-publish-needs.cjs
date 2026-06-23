#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 173-01 -- check-publish-needs.cjs (R2/R7 enforcement).
 *
 * A read-only LOCAL validator over data/publish-needs.json. Mirrors the
 * scripts/build-connector-registry.cjs --check exit-code discipline: exits 0
 * when the map is clean, exits 1 with a one-line stderr reason on the FIRST
 * violation (plus a recovery hint). Zero Brain, zero network (Canon Part 8).
 *
 * What it enforces:
 *   1. R2 -- every job.resolves_to is a REAL command/skill:
 *        - a "/mos:"-prefixed value is a command keyed in data/command-registry.json
 *        - any other value is a skill handle validated against skills/<handle>/ presence
 *   2. R7 -- every job carries a shows value of EXACTLY "connections" or "gaps".
 *   3. Part 10 -- no job label contains a /mos: token (commands-are-internals);
 *      every job.lane is one of the 4 frozen lane ids.
 *
 * Usage:
 *   node scripts/check-publish-needs.cjs           validate; exit 1 on any violation
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MAP_PATH = path.join(REPO_ROOT, 'data', 'publish-needs.json');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');

// The 4 frozen lane ids -- shared verbatim with publish-needs.json _lanes and
// lib/core/publish-needs-default-lane.cjs LANES.
const LANES = ['know-stand', 'find-broken', 'make-land', 'get-into-world'];
const SHOWS_ENUM = ['connections', 'gaps'];

function fail(msg) {
  console.error('check-publish-needs: ' + msg);
  console.error('Recovery: fix data/publish-needs.json (R2 real resolves_to + R7 shows enum + no /mos: in a job label), then re-run: node scripts/check-publish-needs.cjs');
  process.exit(1);
}

function loadJson(p, label) {
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (_e) {
    fail(label + ' not readable at ' + p);
    return null; // unreachable (fail exits)
  }
  try {
    return JSON.parse(raw);
  } catch (_e) {
    fail(label + ' is not valid JSON at ' + p);
    return null; // unreachable
  }
}

function main() {
  const map = loadJson(MAP_PATH, 'data/publish-needs.json');
  const registry = loadJson(REGISTRY_PATH, 'data/command-registry.json');

  if (!Array.isArray(map.jobs) || map.jobs.length === 0) {
    fail('jobs[] is missing or empty');
  }

  // Build the real-command set from the registry.
  const realCommands = new Set(
    (Array.isArray(registry.commands) ? registry.commands : [])
      .map((c) => (c && typeof c.command === 'string') ? c.command : null)
      .filter(Boolean)
  );

  map.jobs.forEach((j, i) => {
    const where = 'jobs[' + i + ']';

    // job label present + no /mos: token (Part 10 commands-are-internals).
    if (typeof j.job !== 'string' || j.job.length === 0) {
      fail(where + '.job is missing or not a non-empty string');
    }
    if (/\/mos:/i.test(j.job)) {
      fail(where + '.job ("' + j.job + '") leaks a /mos: command token; job labels must be user-voice');
    }

    // lane is one of the 4 frozen ids.
    if (LANES.indexOf(j.lane) === -1) {
      fail(where + '.lane ("' + j.lane + '") is not one of the 4 frozen lane ids: ' + LANES.join(', '));
    }

    // R7: shows is exactly "connections" or "gaps".
    if (SHOWS_ENUM.indexOf(j.shows) === -1) {
      fail(where + '.shows ("' + j.shows + '") must be exactly one of: ' + SHOWS_ENUM.join(', '));
    }

    // R2: resolves_to is a real command or a real skill handle.
    if (typeof j.resolves_to !== 'string' || j.resolves_to.length === 0) {
      fail(where + '.resolves_to is missing or not a non-empty string');
    }
    if (j.resolves_to.indexOf('/mos:') === 0) {
      if (!realCommands.has(j.resolves_to)) {
        fail(where + '.resolves_to ("' + j.resolves_to + '") is not a real command in data/command-registry.json');
      }
    } else {
      // Skill handle -> validate against skills/<handle>/ directory presence.
      const skillPath = path.join(SKILLS_DIR, j.resolves_to);
      let isDir = false;
      try {
        isDir = fs.statSync(skillPath).isDirectory();
      } catch (_e) {
        isDir = false;
      }
      if (!isDir) {
        fail(where + '.resolves_to ("' + j.resolves_to + '") is not a real skill (no skills/' + j.resolves_to + '/ directory)');
      }
    }
  });

  console.log('check-publish-needs: OK -- ' + map.jobs.length + ' jobs, all resolves_to real, all shows in {connections,gaps}, no command-name labels');
  process.exit(0);
}

main();
