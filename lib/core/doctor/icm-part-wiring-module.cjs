'use strict';
/*
 * lib/core/doctor/icm-part-wiring-module.cjs -- Phase 344 (the layer contract)
 * Plan 05, Task 2.
 *
 * WHAT check() DOES: reads data/icm-parts.json (the hand-authored declaration
 * of every ICM nested part of a room, shipped by this same plan's Task 1) and
 * data/command-registry.json (the generated command registry), and reports,
 * as raw counts, how many declared ICM parts have at least one producer and
 * at least one consumer, how many declared producer command names resolve
 * against the real command registry, how many declared consumer paths exist
 * on disk, and how many declaring surfaces sit at each engineering layer.
 * With ctx.flags.cascadeRooms truthy it additionally opens every registered
 * room's section directories as flat files and counts the presence of the
 * per-section CONTEXT.md contract's two declaration headings (`## Commands
 * that write here` and `## Inputs`), giving that contract its first code
 * consumer (docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md gap 5.3).
 *
 * Contract: check(ctx) -> { status:'ok'|'skip', detail, ... }. `status` is
 * NEVER 'warn', no matter what the counts are. There is NO fix(ctx) and no
 * `fix` export of any kind: a count is check-only, there is nothing to
 * repair about a measurement, and tests/test-doctor-module-contract-parity.cjs
 * rule 8 fails the suite if a fix_supported:false module (the registry row
 * this plan adds to data/doctor-modules.json) exports one.
 *
 * The counts-only six rules (this plan's own contract block, five copied from
 * this file's own sibling room-graph-density-module.cjs docblock, one added
 * by this phase's shape):
 *   1. status is NEVER 'warn'.
 *   2. no rendered string carries a health, size or completeness adjective
 *      (dense, sparse, density, risk, healthy, high, complete, incomplete,
 *      coverage, gap, missing, drift, compliant).
 *   3. there is no threshold; SEED-074's gate IS the threshold question and
 *      this phase deliberately does not open it.
 *   4. fix_supported:false in the registry row, no fix export.
 *   5. a warn would also inflate the drift tally and print the
 *      "run /mos:doctor --fix" next-move block for a module with no fix.
 *   6. every denominator is enumerated at check time; no source line in this
 *      file contains a frozen surface or part count.
 *
 * Canon Part 8: pure LOCAL filesystem reads. Zero network, zero Brain, zero
 * telemetry. This module opens NO database at all -- not room.db, not
 * anything else -- so the mutation risk the read-only navigation door exists
 * to prevent is structurally absent here. Should a future revision need to
 * open room.db, the ONLY permitted door is openRoomDbReadOnlyForCaller
 * (lib/core/navigation/spine-events.cjs); openRoomDbForCaller is FORBIDDEN,
 * because it delegates to room-db.cjs::openRoomDb, which mkdirSyncs
 * .mindrian/ and runs 13 table-creation statements (each an IF-NOT-EXISTS
 * guard) plus 5 migrations on every open, so a census through it would
 * silently migrate every registered room the first time doctor ran.
 *
 * Canon Part 7 (reuse before build): the registry read (shared.cjs's
 * readRegistry) and the per-room resolveRoomPath function are reused rather
 * than reinvented. resolveRoomPath is copied verbatim from
 * lib/core/doctor/cascade-rooms-module.cjs (it does not export it): an
 * absolute registry `path` is used as-is, else it is joined against
 * roomsHome; null when neither resolves, so callers skip the entry.
 *
 * Threat register (T-344-23..28, this plan's own):
 *   T-344-23 (tampering, the live-room census): mitigated by construction --
 *     no database is ever opened.
 *   T-344-24 (self-DoS): each room is wrapped in a try that includes the
 *     path resolution itself, and each CONTEXT.md read is individually
 *     guarded, so one bad room soft-fails that room and never aborts the
 *     sweep (pinned by the corrupt-registry-entry and unreadable-CONTEXT.md
 *     fixtures in tests/test-344-icm-part-wiring-doctor.cjs).
 *   T-344-25 (information disclosure): the payload carries room NAMES,
 *     section names and counts only; no absolute filesystem path is ever
 *     placed in the payload (pinned by a test that walks every string value).
 *   T-344-26 (repudiation): the banned-adjective list is asserted by the
 *     test over every rendered string.
 *   T-344-27 (elevation of privilege): fix_supported:false, no fix export.
 *   T-344-28 (Canon Part 8): not reachable -- zero network, zero Brain
 *     client, no brain- import anywhere in this module.
 */

const fs = require('node:fs');
const path = require('node:path');

const { readRegistry } = require('./shared.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
// Test seams (Env-seam hand-off pattern, 344-02): a hermetic test overrides
// these two paths to point at a scratch fixture rather than the real repo,
// without needing to copy this module's own require graph (shared.cjs and
// its own active-plugin-root.cjs dependency) into a synthetic tree. Unset in
// production; only tests/test-344-icm-part-wiring-doctor.cjs sets them.
const ICM_PARTS_PATH = process.env.ICM_PARTS_PATH_OVERRIDE
  || path.join(REPO_ROOT, 'data', 'icm-parts.json');
const COMMAND_REGISTRY_PATH = process.env.COMMAND_REGISTRY_PATH_OVERRIDE
  || path.join(REPO_ROOT, 'data', 'command-registry.json');

const PRODUCER_HEADING = '## Commands that write here';
const INPUTS_HEADING = '## Inputs';

// resolveRoomPath(roomsHome, info) -> absolute room dir path, copied verbatim
// from lib/core/doctor/cascade-rooms-module.cjs (it does not export it): an
// absolute registry `path` is used as-is, else it is joined against
// roomsHome. Returns null when info/path is absent so callers skip the entry.
function resolveRoomPath(roomsHome, info) {
  const relPath = info && info.path;
  if (!relPath) return null;
  return path.isAbsolute(relPath) ? relPath : path.join(roomsHome, relPath);
}

// loadJson(absPath) -> parsed object, or null on any absence/parse failure.
// NEVER throws.
function loadJson(absPath) {
  try {
    const raw = fs.readFileSync(absPath, 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

// resolveDeclarations(parts, commandRegistry) -> the repo-side leg: counts
// over the hand-authored declaration file plus resolution against the
// generated command registry. Never throws.
function resolveDeclarations(parts, commandRegistry) {
  const commandNames = new Set(
    (commandRegistry && Array.isArray(commandRegistry.commands)
      ? commandRegistry.commands
      : []
    ).map((c) => c && c.command).filter((c) => typeof c === 'string')
  );

  let partsWithProducer = 0;
  let partsWithConsumer = 0;
  let producersResolved = 0;
  let producersUnresolved = 0;
  let consumersResolved = 0;
  let consumersUnresolved = 0;

  for (const part of parts) {
    const producers = Array.isArray(part.producers) ? part.producers : [];
    const consumers = Array.isArray(part.consumers) ? part.consumers : [];
    if (producers.length > 0) partsWithProducer += 1;
    if (consumers.length > 0) partsWithConsumer += 1;

    for (const producer of producers) {
      if (typeof producer !== 'string') continue;
      if (producer.startsWith('/mos:')) {
        if (commandNames.has(producer)) producersResolved += 1;
        else producersUnresolved += 1;
      } else {
        // A repo-relative module path producer: resolved when the file
        // exists on disk.
        if (fs.existsSync(path.join(REPO_ROOT, producer))) producersResolved += 1;
        else producersUnresolved += 1;
      }
    }

    for (const consumer of consumers) {
      if (typeof consumer !== 'string') continue;
      if (fs.existsSync(path.join(REPO_ROOT, consumer))) consumersResolved += 1;
      else consumersUnresolved += 1;
    }
  }

  return {
    declarations: {
      parts_total: parts.length,
      parts_with_producer: partsWithProducer,
      parts_with_consumer: partsWithConsumer,
    },
    producer_resolution: {
      resolved: producersResolved,
      unresolved: producersUnresolved,
    },
    consumer_resolution: {
      resolved: consumersResolved,
      unresolved: consumersUnresolved,
    },
  };
}

// resolveLayers(commandRegistry) -> per engineering-layer declaring-surface
// counts, read from data/command-registry.json's `layer` field (lifted by
// this phase's sibling plan). An undeclared (null) layer counts separately,
// never silently folded into one of the six vocabulary members.
function resolveLayers(commandRegistry) {
  const commands = (commandRegistry && Array.isArray(commandRegistry.commands))
    ? commandRegistry.commands
    : [];
  const byLayer = {};
  let undeclared = 0;
  for (const c of commands) {
    const layer = c && c.layer;
    if (typeof layer === 'string' && layer.length > 0) {
      byLayer[layer] = (byLayer[layer] || 0) + 1;
    } else {
      undeclared += 1;
    }
  }
  return { by_layer: byLayer, undeclared, surfaces_total: commands.length };
}

// countSectionContractHeadings(roomPath) -> { sections, producer, inputs },
// walking every immediate child directory of a room and, when it carries a
// CONTEXT.md, reading it as a flat file to count the two declaration
// headings. A directory named CONTEXT.md (an unreadable-file fixture) is
// individually guarded: it soft-fails that one section, never the room.
function countSectionContractHeadings(roomPath) {
  let sections = 0;
  let producerHeadingCount = 0;
  let inputsHeadingCount = 0;

  let entries;
  try {
    entries = fs.readdirSync(roomPath, { withFileTypes: true });
  } catch (_e) {
    return { sections: 0, producer: 0, inputs: 0 };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const contextMdPath = path.join(roomPath, entry.name, 'CONTEXT.md');
    let exists = false;
    try {
      exists = fs.existsSync(contextMdPath) && fs.statSync(contextMdPath).isFile();
    } catch (_e) {
      exists = false;
    }
    if (!exists) continue;
    sections += 1;
    try {
      const content = fs.readFileSync(contextMdPath, 'utf8');
      if (content.indexOf(PRODUCER_HEADING) !== -1) producerHeadingCount += 1;
      if (content.indexOf(INPUTS_HEADING) !== -1) inputsHeadingCount += 1;
    } catch (_e) {
      // Unreadable CONTEXT.md (T-344-24): soft-fail this section only, the
      // sweep continues. The section is still counted as present (it has a
      // CONTEXT.md path), just not as carrying either heading.
    }
  }

  return { sections, producer: producerHeadingCount, inputs: inputsHeadingCount };
}

// sweepCascadeRooms() -> { rooms: [...] }, the live-room leg. Only runs when
// ctx.flags.cascadeRooms is truthy. Room NAMES and counts only; no absolute
// filesystem path is ever placed in the returned rooms[] entries.
function sweepCascadeRooms() {
  const reg = readRegistry();
  if (!reg) return { rooms: [] };
  const roomsHome = reg.roomsHome;
  const rooms = (reg.registry && reg.registry.rooms) || {};
  const out = [];

  for (const name of Object.keys(rooms)) {
    try {
      // Inside the try on purpose (T-344-24): a malformed registry entry
      // must soft-fail this room, not throw out of the sweep.
      const roomPath = resolveRoomPath(roomsHome, rooms[name]);
      if (!roomPath) continue;
      const counts = countSectionContractHeadings(roomPath);
      out.push({
        room: name,
        sections: counts.sections,
        contracts_with_producer_heading: counts.producer,
        contracts_with_inputs_heading: counts.inputs,
      });
    } catch (_e) {
      // T-344-24 / T-217-01 self-DoS guard: one bad room never aborts the
      // sweep.
      out.push({
        room: name,
        sections: 0,
        contracts_with_producer_heading: 0,
        contracts_with_inputs_heading: 0,
      });
    }
  }

  return { rooms: out };
}

// check(ctx) -- counts-only read. NEVER mutates, NEVER opens a database,
// NEVER returns 'warn'.
function check(ctx) {
  const c = ctx || {};
  const icmParts = loadJson(ICM_PARTS_PATH);
  if (!icmParts || !Array.isArray(icmParts.parts)) {
    return {
      status: 'skip',
      detail: 'data/icm-parts.json is absent or unreadable; nothing to measure',
    };
  }

  const commandRegistry = loadJson(COMMAND_REGISTRY_PATH);
  const parts = icmParts.parts;

  const { declarations, producer_resolution, consumer_resolution } =
    resolveDeclarations(parts, commandRegistry);
  const layers = resolveLayers(commandRegistry);

  const detail = 'parts with a declared producer: ' + declarations.parts_with_producer
    + '; parts with a declared consumer: ' + declarations.parts_with_consumer
    + '; parts with none: ' + (declarations.parts_total - declarations.parts_with_consumer)
    + '; total: ' + declarations.parts_total;

  const payload = {
    status: 'ok',
    detail,
    declarations,
    producer_resolution,
    consumer_resolution,
    layers,
  };

  if (c.flags && c.flags.cascadeRooms) {
    const cascade = sweepCascadeRooms();
    payload.rooms = cascade.rooms;
  }

  return payload;
}

module.exports = { check };
