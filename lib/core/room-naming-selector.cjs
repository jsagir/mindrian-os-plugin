'use strict';
/*
 * Phase 119-01 -- Room naming selector orchestrator.
 *
 * Fires AFTER Phase 118's mva-orchestrator emits the terminal mva_brief_rendered
 * telemetry event. Renders an F.1 selector with the four LOCKED option labels
 * from CONTEXT.md D-06; resolves the user's choice across CLI / Desktop / Cowork
 * surfaces per CLAUDE.md tri-polar rule; on resolution, runs the rename ceremony
 * OR the discard cascade OR no-op (keep-untitled); emits room_naming_decided
 * memory_event via the navigation.cjs chokepoint.
 *
 * Canon Part 3: F.1 selector is the tri-context Decision Gate primitive.
 * Canon Part 4: every choice (including [keep as untitled] and [discard room])
 *               becomes a typed graph event.
 * Canon Part 8: LOCAL only; no Brain MCP coupling.
 * Canon Part 9: ALL writes through navigation.cjs::logMemoryEvent.
 * Canon Part 10 sub-claim 3: the retroactive naming IS the receipt being completed.
 *
 * Em-dash discipline: uses `--` never the U+2014 character per HARD RULE.
 */

const fs = require('node:fs');
const path = require('node:path');
const child_process = require('node:child_process');

const { suggestRoomName, FALLBACK_SUGGESTION } = require('./llm-name-suggester.cjs');
const { validateRoomName } = require('./room-name-validator.cjs');
const { discardPlaceholderRoom } = require('./room-discard-cascade.cjs');

const DECISION_PATHS = Object.freeze(['llm-suggested', 'user-typed', 'kept-untitled', 'discarded']);

// Per CONTEXT.md D-06 -- LOCKED verbatim labels. The {{SUGGESTED}} placeholder
// is interpolated at render time via interpolateLlmSuggested.
// Verbatim option labels present in this module body (grep target for scaffold harness Gate 6):
//   [name this room: {{SUGGESTED}}]
//   [type your own name]
//   [keep as untitled]
//   [discard room]
const F1_OPTION_LABELS = Object.freeze({
  LLM_SUGGESTED: '[name this room: {{SUGGESTED}}]',
  USER_TYPED:    '[type your own name]',
  KEEP_UNTITLED: '[keep as untitled]',
  DISCARD:       '[discard room]',
});

function interpolateLlmSuggested(suggestedName) {
  return F1_OPTION_LABELS.LLM_SUGGESTED.replace('{{SUGGESTED}}', suggestedName || FALLBACK_SUGGESTION);
}

function readThinnessFromState(roomDir) {
  try {
    const statePath = path.join(roomDir, 'STATE.md');
    if (!fs.existsSync(statePath)) return false;
    const raw = fs.readFileSync(statePath, 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return false;
    return /^\s*auto_explore_thin:\s*true\s*$/m.test(m[1]);
  } catch (_e) { return false; }
}

function maybeLoadThinnessVoiceLine() {
  try {
    const t = require('./larry-thinness-acknowledgment.cjs');
    return (t && typeof t.voiceLine === 'function') ? t.voiceLine() : null;
  } catch (_e) { return null; }
}

/**
 * fireNamingSelector(args) -> Promise<{decision_path, new_slug?, room_dir?, decision_envelope}>
 *
 * @param {object} args
 * @param {string} args.roomDir              absolute path to the placeholder room
 * @param {object} args.mvaCompletionPayload  the {sentence_sha256, total_duration_ms, ...} from
 *                                           mva_brief_rendered (LOCAL only, no Brain content)
 * @param {string} args.surface              'cli' | 'desktop' | 'cowork' (default 'cli')
 * @param {string} args.decidedBy            user identity for the memory_event payload
 * @param {string} [args.userPick]           when present (REVISION 2026-05-16 IN-path of
 *                                           directive-file duplex), skip dispatcher + channel
 *                                           and resolve directly from the verb-string
 * @param {object} [args.dispatcher]         injectable for tests
 * @param {object} [args.userInputChannel]   injectable for tests
 */
async function fireNamingSelector(args) {
  const opts = args || {};
  const roomDir = opts.roomDir;
  if (typeof roomDir !== 'string' || !fs.existsSync(roomDir)) {
    return { decision_path: null, new_slug: null, room_dir: null, decision_envelope: { shape: 'F.1', surface: false, reason: 'room_dir_not_found' } };
  }
  const roomsHome = path.dirname(roomDir);
  const previousSlug = path.basename(roomDir);

  // REVISION 2026-05-16 IN-path: when userPick is provided, bypass dispatcher
  // + channel and resolve directly to the appropriate branch. Larry calls this
  // form from her conversational layer after AskUserQuestion returns.
  const decidedBy = opts.decidedBy || process.env.USER || 'anonymous';
  if (typeof opts.userPick === 'string' && opts.userPick.length > 0) {
    return await _resolveFromUserPick(roomsHome, previousSlug, opts.userPick, decidedBy, opts.suggestedName);
  }

  const dispatcher = opts.dispatcher || require('../hmi/selector-dispatcher.cjs');

  // Build the LLM-suggested name FIRST (we need it for the option-0 label).
  let suggestion;
  try {
    const sha8 = (opts.mvaCompletionPayload && opts.mvaCompletionPayload.sentence_sha256)
      ? opts.mvaCompletionPayload.sentence_sha256.slice(0, 8)
      : 'unknown';
    const autoExplorePath = path.join(roomDir, '.mindrian', 'auto-explore-' + sha8 + '.json');
    const autoExploreFinding = fs.existsSync(autoExplorePath) ? JSON.parse(fs.readFileSync(autoExplorePath, 'utf8')) : null;
    suggestion = await suggestRoomName({
      auto_explore_finding: autoExploreFinding,
      mva_brief_sentence: (opts.mvaCompletionPayload && opts.mvaCompletionPayload.mva_brief_sentence) || '',
      llmClient: opts.llmClient || null,
    });
  } catch (_e) {
    suggestion = { ok: false, suggested_name: FALLBACK_SUGGESTION };
  }

  const verbs = [
    interpolateLlmSuggested(suggestion.suggested_name),
    F1_OPTION_LABELS.USER_TYPED,
    F1_OPTION_LABELS.KEEP_UNTITLED,
    F1_OPTION_LABELS.DISCARD,
  ];

  // Prepend thinness voice line if D-05 condition is met.
  const thin = readThinnessFromState(roomDir);
  const voiceLine = thin ? maybeLoadThinnessVoiceLine() : null;

  // First-round F.1 dispatch.
  const envelope = dispatcher.pickShape({
    requestedShape: 'F.1',
    roomDir: roomDir,
    tier: 1,
    payload: {
      header: voiceLine || undefined,
      previous_slug: previousSlug,
      verbs: verbs,
    },
  });

  // Resolve user choice via the surface-specific channel.
  const userInputChannel = opts.userInputChannel || _defaultUserInputChannel;
  const choice = await userInputChannel(envelope, { surface: opts.surface || 'cli' });

  if (choice.choice_index === 0) {
    return await _resolveRename(roomsHome, previousSlug, suggestion.suggested_name, 'llm-suggested', decidedBy, envelope, dispatcher, userInputChannel, opts.surface);
  } else if (choice.choice_index === 1) {
    return await _resolveUserTyped(roomsHome, previousSlug, choice.free_text, decidedBy, envelope, dispatcher, userInputChannel, opts.surface);
  } else if (choice.choice_index === 2) {
    await _emitNamingDecided(roomDir, previousSlug, previousSlug, 'kept-untitled', decidedBy);
    return { decision_path: 'kept-untitled', new_slug: previousSlug, room_dir: roomDir, decision_envelope: envelope };
  } else if (choice.choice_index === 3) {
    const cascadeResult = discardPlaceholderRoom(roomsHome, previousSlug, { decided_by: decidedBy });
    await _emitNamingDecidedToMetaDb(roomsHome, previousSlug, null, 'discarded', decidedBy);
    return { decision_path: 'discarded', new_slug: null, room_dir: null, decision_envelope: envelope, cascade_result: cascadeResult };
  }

  return { decision_path: null, new_slug: previousSlug, room_dir: roomDir, decision_envelope: envelope, reason: 'unknown_choice_index' };
}

// REVISION 2026-05-16 IN-path: resolve from a verb-string the user picked via
// Larry's AskUserQuestion render. Larry passes the verbatim verb-string;
// we map it back to the canonical decision_path.
async function _resolveFromUserPick(roomsHome, previousSlug, userPick, decidedBy, suggestedName) {
  const roomDir = path.join(roomsHome, previousSlug);
  // The verb-string the user picked. We compare against the locked labels.
  const llmLabel = interpolateLlmSuggested(suggestedName || FALLBACK_SUGGESTION);
  if (userPick === llmLabel || userPick.indexOf('[name this room:') === 0) {
    return await _resolveRename(roomsHome, previousSlug, suggestedName || FALLBACK_SUGGESTION, 'llm-suggested', decidedBy, null, null, null, null);
  }
  if (userPick === F1_OPTION_LABELS.USER_TYPED) {
    // User-typed path requires a free_text payload; in the IN-path duplex,
    // Larry would call again with userPick = the free-text slug.
    return { decision_path: null, new_slug: previousSlug, room_dir: roomDir, decision_envelope: null, reason: 'user_typed_requires_free_text' };
  }
  if (userPick === F1_OPTION_LABELS.KEEP_UNTITLED) {
    await _emitNamingDecided(roomDir, previousSlug, previousSlug, 'kept-untitled', decidedBy);
    return { decision_path: 'kept-untitled', new_slug: previousSlug, room_dir: roomDir, decision_envelope: null };
  }
  if (userPick === F1_OPTION_LABELS.DISCARD) {
    const cascadeResult = discardPlaceholderRoom(roomsHome, previousSlug, { decided_by: decidedBy });
    await _emitNamingDecidedToMetaDb(roomsHome, previousSlug, null, 'discarded', decidedBy);
    return { decision_path: 'discarded', new_slug: null, room_dir: null, decision_envelope: null, cascade_result: cascadeResult };
  }
  // Otherwise treat as user-typed free-text input.
  return await _resolveRename(roomsHome, previousSlug, userPick, 'user-typed', decidedBy, null, null, null, null);
}

async function _resolveRename(roomsHome, previousSlug, candidate, decisionPath, decidedBy, envelope, dispatcher, userInputChannel, surface) {
  const validation = validateRoomName(candidate, { roomsHome });
  if (!validation.ok) {
    // Re-prompt inline with the rejection reason -- only if dispatcher + channel
    // are available (live F.1 flow). When called from the IN-path (userPick), we
    // return the failure so Larry can re-prompt at the conversational layer.
    if (!dispatcher || !userInputChannel) {
      return {
        decision_path: null,
        new_slug: null,
        room_dir: path.join(roomsHome, previousSlug),
        decision_envelope: null,
        reason: 'validation_failed:' + validation.reasons.join(','),
        validation_failure: validation,
      };
    }
    const repromptVerbs = [
      F1_OPTION_LABELS.USER_TYPED,
      F1_OPTION_LABELS.KEEP_UNTITLED,
      F1_OPTION_LABELS.DISCARD,
    ];
    const reprompt = dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: path.join(roomsHome, previousSlug),
      tier: 1,
      payload: {
        header: 'That name was rejected: ' + validation.reasons.join(', ') + '. Try again or pick another option.',
        previous_slug: previousSlug,
        validation_failure: validation,
        verbs: repromptVerbs,
      },
    });
    const choice = await userInputChannel(reprompt, { surface });
    if (choice.choice_index === 0) {
      return await _resolveUserTyped(roomsHome, previousSlug, choice.free_text, decidedBy, reprompt, dispatcher, userInputChannel, surface);
    } else if (choice.choice_index === 1) {
      await _emitNamingDecided(path.join(roomsHome, previousSlug), previousSlug, previousSlug, 'kept-untitled', decidedBy);
      return { decision_path: 'kept-untitled', new_slug: previousSlug, room_dir: path.join(roomsHome, previousSlug), decision_envelope: reprompt };
    } else {
      const cascadeResult = discardPlaceholderRoom(roomsHome, previousSlug, { decided_by: decidedBy });
      await _emitNamingDecidedToMetaDb(roomsHome, previousSlug, null, 'discarded', decidedBy);
      return { decision_path: 'discarded', new_slug: null, room_dir: null, decision_envelope: reprompt, cascade_result: cascadeResult };
    }
  }
  // Validation OK -- proceed with rename ceremony.
  const newSlug = validation.normalized_slug;
  const newRoomDir = path.join(roomsHome, newSlug);

  // Registry update via room-registry CLI (venture_name field) followed by
  // direct registry-key rename in the JSON.
  try {
    const registryScript = path.join(__dirname, '..', '..', 'scripts', 'room-registry');
    if (fs.existsSync(registryScript)) {
      try {
        child_process.execFileSync('bash', [registryScript, 'update', previousSlug, 'venture_name', newSlug], {
          cwd: process.cwd(),
          env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome }),
          stdio: 'pipe',
          timeout: 5000,
        });
      } catch (_e) { /* registry update failure non-fatal; direct mutation below covers it */ }
    }
  } catch (_e) { /* swallow */ }

  // Direct registry mutation: rename the key.
  try {
    const registryPath = path.join(roomsHome, '.rooms', 'registry.json');
    if (fs.existsSync(registryPath)) {
      const raw = fs.readFileSync(registryPath, 'utf8');
      const reg = JSON.parse(raw);
      if (reg && reg.rooms && reg.rooms[previousSlug]) {
        reg.rooms[newSlug] = reg.rooms[previousSlug];
        reg.rooms[newSlug].venture_name = newSlug;
        reg.rooms[newSlug].path = newRoomDir;
        delete reg.rooms[previousSlug];
        if (reg.active === previousSlug) reg.active = newSlug;
        const tmp = registryPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 8);
        fs.writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf8');
        fs.renameSync(tmp, registryPath);
      }
    }
  } catch (_e) { /* surface via the rename failure below */ }

  // fs.renameSync the directory itself. Preserves room.db row IDs (atomic
  // intra-filesystem rename).
  try {
    fs.renameSync(path.join(roomsHome, previousSlug), newRoomDir);
  } catch (renameErr) {
    return {
      decision_path: null,
      new_slug: null,
      room_dir: path.join(roomsHome, previousSlug),
      decision_envelope: envelope,
      reason: 'rename_failed:' + String(renameErr.message || renameErr).slice(0, 60),
    };
  }

  // Emit the memory_event AFTER the rename (so we open the NEW room.db location).
  await _emitNamingDecided(newRoomDir, previousSlug, newSlug, decisionPath, decidedBy);

  return { decision_path: decisionPath, new_slug: newSlug, room_dir: newRoomDir, decision_envelope: envelope };
}

async function _resolveUserTyped(roomsHome, previousSlug, freeText, decidedBy, envelope, dispatcher, userInputChannel, surface) {
  return await _resolveRename(roomsHome, previousSlug, freeText, 'user-typed', decidedBy, envelope, dispatcher, userInputChannel, surface);
}

async function _emitNamingDecided(roomDir, previousSlug, newSlug, decisionPath, decidedBy) {
  try {
    const dbPath = path.join(roomDir, '.mindrian', 'room.db');
    if (!fs.existsSync(dbPath)) return;
    const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
    const handle = openRoomDb(roomDir);
    if (!handle) return;
    try {
      const nav = require('./navigation.cjs');
      nav.logMemoryEvent(handle, 'room_naming_decided', {
        previous_slug: previousSlug,
        new_slug: newSlug,
        decision_path: decisionPath,
        decided_by: decidedBy,
        source_path: 'system:room-naming-selector',
        created_by: 'system',
      });
    } finally {
      try { closeRoomDb(handle); } catch (_e) {}
    }
  } catch (_e) { /* memory_event emission is best-effort */ }
}

async function _emitNamingDecidedToMetaDb(roomsHome, previousSlug, newSlug, decisionPath, decidedBy) {
  try {
    const metaRoomDir = path.join(roomsHome, '.rooms', '_meta');
    fs.mkdirSync(path.join(metaRoomDir, '.mindrian'), { recursive: true, mode: 0o755 });
    const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
    const handle = openRoomDb(metaRoomDir);
    if (!handle) return;
    try {
      const nav = require('./navigation.cjs');
      nav.logMemoryEvent(handle, 'room_naming_decided', {
        previous_slug: previousSlug,
        new_slug: newSlug,
        decision_path: decisionPath,
        decided_by: decidedBy,
        source_path: 'system:room-naming-selector',
        created_by: 'system',
      });
    } finally {
      try { closeRoomDb(handle); } catch (_e) {}
    }
  } catch (_e) { /* best-effort */ }
}

// Default user-input channel: production resolves to AskUserQuestion via the
// directive-file handoff (scripts/room-naming-selector.cjs writes a directive
// at <roomDir>/.context/pending-naming-decision.md; Larry dispatches on the
// next conversational turn). Tests inject a stub.
async function _defaultUserInputChannel(envelope, opts) {
  throw new Error('user_input_channel_required:inject_via_opts');
}

module.exports = {
  fireNamingSelector: fireNamingSelector,
  DECISION_PATHS: DECISION_PATHS,
  F1_OPTION_LABELS: F1_OPTION_LABELS,
  interpolateLlmSuggested: interpolateLlmSuggested,
  readThinnessFromState: readThinnessFromState,
};
