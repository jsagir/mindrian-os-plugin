'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * 369.25 plan 23 (FCLOSE-01, FEYMINTO-CROSS row 8) -- read every nest's FeyMinto for the real-room release run.
 *
 * The release run's job is to show a person what the product does on a room. For FeyMinto that means: per core nest,
 * was Theo asked or not (and why not), which frameworks it named, and which /mos: commands can run on this surface
 * right now. This module is that reader. It reads the nest's Theo face (BRAIN.md) through the one face reader the
 * brief and the composition already use (lib/core/feyminto/next-move.cjs readFace), never by parsing the file a
 * second way, and it never edits a face by hand: the only writer is lib/core/brain-derivation.cjs deriveSection.
 *
 *   readRoomFeyMinto(roomDir)                    -> entries, read only, one per core nest folder present
 *   feymintoLeg(roomDir, { offline, deriveSection }) -> entries, after asking Theo per nest (or recording that this run
 *                                                  was offline, writing nothing); live asks go through deriveSection,
 *                                                  which sends only handles (Canon Part 8, plan 05 / plan 17)
 *   formatFeyMintoBlock(entries)                 -> the report section, "It tried / It got / It could not" voice
 *
 * An entry: { nest, asked, not_asked_reason, not_asked_line, queries_sent, frameworks_named: [names],
 *             commands_runnable_here: [names] }. Names only, never a room id, node id or path.
 *
 * "Runnable here" means the face's capability marker for the CLI is 'runnable' (lib/core/feyminto/capability.cjs);
 * an instruction-only or assisted command is not listed. Hyphens only.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const NOT_RECORDED_LINE = 'not recorded: this nest has no FeyMinto face yet';

function coreSections() {
  return Object.keys(require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs')).CORE_SECTIONS);
}

function notAskedLine(reason) {
  try {
    const lines = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'theo-ask.cjs')).NOT_ASKED_LINES;
    if (reason && Object.prototype.hasOwnProperty.call(lines, reason)) return lines[reason];
  } catch (_e) { /* fall through */ }
  return reason ? 'not asked: ' + String(reason).replace(/_/g, ' ') : NOT_RECORDED_LINE;
}

function nestDirs(roomDir) {
  return coreSections().filter(function (name) {
    try { return fs.statSync(path.join(roomDir, name)).isDirectory(); } catch (_e) { return false; }
  });
}

function entryFor(roomDir, nest) {
  const nextMove = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
  const RUNNABLE = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'capability.cjs')).CAPABILITY.RUNNABLE;
  const face = nextMove.readFace(path.join(roomDir, nest));
  if (!face || face.exists !== true || face.keyed !== true) {
    return { nest: nest, asked: false, not_asked_reason: 'not_recorded', not_asked_line: NOT_RECORDED_LINE, queries_sent: 0, frameworks_named: [], commands_runnable_here: [] };
  }
  const asked = face.asked === true;
  const reason = asked ? null : (face.not_asked_reason || 'not_recorded');
  return {
    nest: nest,
    asked: asked,
    not_asked_reason: reason,
    not_asked_line: asked ? null : (reason === 'not_recorded' ? NOT_RECORDED_LINE : notAskedLine(reason)),
    queries_sent: typeof face.queries_sent === 'number' ? face.queries_sent : 0,
    frameworks_named: Array.isArray(face.frameworks) ? face.frameworks.slice() : [],
    commands_runnable_here: (Array.isArray(face.commands) ? face.commands : []).filter(function (c) { return c && c.cli === RUNNABLE; }).map(function (c) { return c.name; }),
  };
}

/** readRoomFeyMinto(roomDir) -> one entry per core nest folder present. Read only. */
function readRoomFeyMinto(roomDir) {
  return nestDirs(roomDir).map(function (nest) { return entryFor(roomDir, nest); });
}

/**
 * feymintoLeg(roomDir, { offline, deriveSection }) -> entries
 * Live: per nest, ask Theo through deriveSection (handles only, Canon Part 8), then read the face back; a live ask that
 * could not run (Theo unreachable) is reported as not asked: Theo did not answer, never as the birth line the file
 * still holds. Offline: nothing is asked and NOTHING IS WRITTEN (the faces on disk stay exactly as birth left them);
 * every nest that was not already asked is reported for this run as not asked: this run was offline.
 */
async function feymintoLeg(roomDir, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  if (o.offline === true) {
    return readRoomFeyMinto(roomDir).map(function (e) {
      return e.asked ? e : Object.assign({}, e, { not_asked_reason: 'offline', not_asked_line: notAskedLine('offline') });
    });
  }
  const derive = typeof o.deriveSection === 'function'
    ? o.deriveSection
    : require(path.join(ROOT, 'lib', 'core', 'brain-derivation.cjs')).deriveSection;
  const failures = {};
  for (const nest of nestDirs(roomDir)) {
    let res = null;
    try { res = await derive(roomDir, nest, { offline: false }); } catch (e) { res = { success: false, reason: String((e && e.message) || e).slice(0, 120) }; }
    if (!(res && res.success === true)) failures[nest] = (res && res.reason) || 'derivation_failed';
  }
  return readRoomFeyMinto(roomDir).map(function (e) {
    if (Object.prototype.hasOwnProperty.call(failures, e.nest) && !e.asked) {
      return Object.assign({}, e, { not_asked_reason: 'theo_unavailable', not_asked_line: notAskedLine('theo_unavailable'), derive_failure: failures[e.nest] });
    }
    return e;
  });
}

function commandName(n) { return /^\//.test(n) ? n : '/mos:' + n; }

/** formatFeyMintoBlock(entries) -> the report section. Names only. */
function formatFeyMintoBlock(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const anyAsked = list.some(function (e) { return e.asked; });
  const L = [];
  L.push('== FeyMinto ==');
  L.push(anyAsked
    ? '  It tried:  to ask Theo, per nest, which frameworks, operations and /mos: commands fit, sending only the nest\'s problem type, section kind, job and the framework handles already in play.'
    : '  It tried:  to read, per nest, which frameworks, operations and /mos: commands Theo would suggest; no question was sent from this run.');
  list.forEach(function (e) {
    if (e.asked) {
      const fw = e.frameworks_named.length ? e.frameworks_named.join(', ') : 'none';
      const cmds = e.commands_runnable_here.length ? e.commands_runnable_here.map(commandName).join(', ') : 'none';
      L.push('  ' + e.nest + ': asked (' + e.queries_sent + ' ' + (e.queries_sent === 1 ? 'query' : 'queries') + '); frameworks: ' + fw + '; runnable here: ' + cmds);
    } else {
      L.push('  ' + e.nest + ': ' + (e.not_asked_line || NOT_RECORDED_LINE));
    }
  });
  L.push('  It could not: tell whether a suggestion is right for this venture; nothing suggested here has run.');
  return L.join('\n').replace(/[\u2014\u2013]/g, '-');
}

module.exports = { readRoomFeyMinto, feymintoLeg, formatFeyMintoBlock };
