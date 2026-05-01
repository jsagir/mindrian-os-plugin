#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-04 -- conversation operator hook entry point
 * =====================================================
 * Single hook entry point that branches on hook_event_name (Claude Code 2.x):
 *   SessionStart      -> read state; surface resume hint if BUILD_ROOM (D-18)
 *   Stop              -> persist current state (D-19)
 *   PostToolUse       -> update operator on AskUserQuestion / decision_gate_pending (D-20)
 *   UserPromptSubmit  -> classify user message; transition if confidence >= 0.6 (D-11/D-12)
 *
 * Envelope schema: Phase 95 BASH-95-01 invariant. Top-level keys subset of
 * { decision, reason, continue, stopReason, suppressOutput, systemMessage,
 *   hookSpecificOutput }. additionalContext ONLY inside hookSpecificOutput.
 *
 * Active-room guard: PostToolUse with tool_input.file_path outside the
 * active room exits silently (Phase 95 cascade-side-channel pattern;
 * Decision #15 active-room invariant).
 *
 * Canon Part 8: zero Brain queries. Reads/writes only:
 *   <roomDir>/.mindrian/conversation-operator.json
 *   <roomDir>/.room-graph/room.db (via lib/conversation/operator.cjs)
 *
 * Frame budget: < 50ms wall-clock per invocation. hooks.json timeout 3000ms
 * gives orders-of-magnitude safety margin.
 *
 * Defensive: NEVER blocks the hook chain. Any internal error -> stderr log
 * + emit { continue: true, suppressOutput: true } + exit 0.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Resolve plugin root: this script lives at <pluginRoot>/scripts/operator-update.cjs
const PLUGIN_ROOT = path.resolve(__dirname, '..');

let operator, classifier;
try {
  operator = require(path.join(PLUGIN_ROOT, 'lib', 'conversation', 'operator.cjs'));
  classifier = require(path.join(PLUGIN_ROOT, 'lib', 'conversation', 'classifier.cjs'));
} catch (e) {
  // 99-01 or 99-02 module missing -> Tier 0: silent exit. Do NOT block hook chain.
  process.stderr.write('[operator-update] cannot load operator/classifier: ' + e.message + '\n');
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
  process.exit(0);
}
const { getCurrent, transition, OPERATORS } = operator;
const { classify } = classifier;

// ----- envelope schema allowlist (Phase 95 BASH-95-01) -----

const ALLOWED = new Set([
  'decision',
  'reason',
  'continue',
  'stopReason',
  'suppressOutput',
  'systemMessage',
  'hookSpecificOutput',
]);

function emitEnvelope(obj) {
  // Strict envelope key allowlist (Phase 95 BASH-95-01)
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (ALLOWED.has(k)) filtered[k] = obj[k];
  }
  // Default to silent success
  if (filtered.continue === undefined) filtered.continue = true;
  process.stdout.write(JSON.stringify(filtered));
  process.exit(0);
}

function silentSuccess() {
  emitEnvelope({ continue: true, suppressOutput: true });
}

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch (_e) {
    return {};
  }
}

function resolveActiveRoom() {
  const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
  const regPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return null;
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  } catch (_e) {
    return null;
  }
  if (!reg.active_room || !Array.isArray(reg.rooms)) return null;
  const room = reg.rooms.find(function (r) { return r && r.slug === reg.active_room; });
  if (!room || !room.abs_path) return null;
  if (!fs.existsSync(room.abs_path)) return null;
  if (room.sealed) return null; // sealed rooms: hook is a no-op
  return room;
}

function isInActiveRoom(filePath, activeAbs) {
  if (!filePath || !activeAbs) return false;
  try {
    const f = path.resolve(filePath);
    const a = path.resolve(activeAbs);
    return f === a || f.indexOf(a + path.sep) === 0;
  } catch (_e) {
    return false;
  }
}

// ----- main -----

function main() {
  const env = readStdinJson();
  const evt = env.hook_event_name || env.hookEventName || process.env.HOOK_EVENT_NAME || null;

  if (!evt) return silentSuccess();

  const room = resolveActiveRoom();
  if (!room) return silentSuccess(); // no registry / no active room: tier 0 silence

  switch (evt) {
    case 'SessionStart': {
      const state = getCurrent(room.abs_path);
      if (state.current === 'BUILD_ROOM' && state.context && state.context.active_section) {
        return emitEnvelope({
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext:
              'you were filing in ' +
              state.context.active_section +
              '; resume? Type /mos:room ' +
              state.context.active_section +
              ' to continue or /mos:operator reset to clear.',
          },
        });
      }
      return silentSuccess();
    }

    case 'Stop': {
      // Phase 99-04 ships the no-op variant per behavior block. State is
      // already up to date from the most recent transition; we don't append
      // a hook_stop history entry unless 99-01 grows recordSessionBoundary.
      return silentSuccess();
    }

    case 'PostToolUse': {
      const tool = env.tool_name || env.toolName || '';
      const toolInput = env.tool_input || env.toolInput || {};
      const toolResp = env.tool_response || env.toolResponse || {};

      // Active-room guard: when tool_input.file_path is set, it must be inside the active room
      if (toolInput.file_path && !isInActiveRoom(toolInput.file_path, room.abs_path)) {
        return silentSuccess();
      }

      const state = getCurrent(room.abs_path);

      // Sub-branch 1: AskUserQuestion -> DECISION_GATE
      if (tool === 'AskUserQuestion') {
        const qid =
          toolInput.question_id ||
          toolInput.questionId ||
          (toolInput.question && String(toolInput.question).slice(0, 32)) ||
          'unknown';
        try {
          transition(room.abs_path, 'DECISION_GATE', 'hook_post_tool_use', {
            decision_gate_pending: qid,
          });
        } catch (_e) {
          /* swallow */
        }
        return silentSuccess();
      }

      // Sub-branch 2: decision_gate_pending was set; if any tool runs after the question
      // (heuristic: non-AskUserQuestion tool), resolve the gate by transitioning to previous.
      if (state.context && state.context.decision_gate_pending) {
        try {
          transition(room.abs_path, 'previous', 'hook_post_tool_use', {
            decision_gate_pending: null,
          });
        } catch (_e) {
          /* swallow */
        }
        return silentSuccess();
      }

      return silentSuccess();
    }

    case 'UserPromptSubmit': {
      const userMessage = env.prompt || env.user_message || '';
      const state = getCurrent(room.abs_path);
      const result = classify({ user_message: userMessage, hook_event: 'UserPromptSubmit' }, state);
      if (!result || !result.candidate_op) return silentSuccess();
      try {
        transition(
          room.abs_path,
          result.candidate_op,
          result.suggested_trigger || 'user_message',
          { active_room: room.slug }
        );
      } catch (_e) {
        /* swallow validate errors */
      }
      return silentSuccess();
    }

    default:
      return silentSuccess();
  }
}

try {
  main();
} catch (e) {
  process.stderr.write('[operator-update] uncaught: ' + e.message + '\n');
  silentSuccess();
}
