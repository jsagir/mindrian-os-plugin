'use strict';
/*
 * lib/core/frame-provenance.cjs -- Phase 358-07 (Rome B2, slide A1: "which
 * direction" / "can I turn around").
 *
 * The room's ONE governing-question record: a room-level provenance record,
 * separate from the MINTO governing_thought (a machine-written section
 * summary). This module is the ONLY write door (navigator ruling 2, one
 * door): setGoverningQuestion is the single place a version is ever created.
 * Every version carries a REQUIRED origin drawn from the one
 * navigation.FRAME_ORIGINS_ORDERED constant (ruling 3, TODO(358) until the
 * paper author confirms the labels). A written version never changes: the
 * substrate (lib/core/navigation/typed-frame.cjs) refuses a re-write of an
 * existing version (version_exists), so history here is append-only. A
 * changed question is REFUSED until the officer says what the old question
 * got wrong (QUESTION_ASK) or explicitly marks the change a relocation; a
 * missing choice never defaults to either path. With a written account the
 * change lands as refines (the account itself lives as an artifact under
 * FRAMES_DIR_REL, only its hash and handle ever touch a graph property);
 * without one it lands as relocates. Both frames stay visible; neither is
 * presented as better.
 *
 * The refusal's ask is rendered as ONE Decision Gate card through the
 * SEED-020 single card-emission door (lib/hmi/selector-dispatcher.cjs
 * pickShape) -- renderQuestionChangeCard is the ONLY pickShape call site in
 * this file. SHAPE NOTE: the navigator's own requirement named shape F.0, but
 * this module renders the card as F.1 through the same door instead --
 * shape-f0-renderer.cjs is closed-vocabulary (exactly Approve / Reject /
 * Defer, three answers this ask does not have) and captures its Reject
 * reason as a REJECTED_BECAUSE typed-edge property, which would put the
 * officer's account prose into graph metadata and break the artifact-only
 * account rule below. F.1 is open-vocabulary, keeps Free-Text last, and
 * marks no option recommended (neither refines nor relocates is presented as
 * better).
 *
 * Canon Part 3 (Tri-Context Decision Gate): the refusal is a real Decision
 * Gate, rendered through the one governed pickShape door, never a hand-built
 * widget or an ASCII box.
 * Canon Part 8 (Graph Boundary): question and account text live ONLY as
 * artifacts under a room's FRAMES_DIR_REL; no node or edge property ever
 * carries that prose, only generic handles, hashes and enums. Zero Brain
 * calls, zero network surface; a full set / refuse / refines / relocates /
 * read cycle, card included, makes zero network calls.
 * Canon Part 9 (Memory Locality): every write goes through
 * navigation.writeFrameNode / navigation.writeEdge, the shared chokepoints;
 * this file holds no raw SQL beyond transaction control on a caller-owned
 * handle (the same BEGIN IMMEDIATE ownership idiom as
 * lib/core/navigation/verification.cjs).
 *
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE); hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const navigation = require('./navigation.cjs');
const { assertRealpathContained, isRealpathContained, writeFileContained } = require('./room-path-containment.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUESTION_ASK = 'What did the old question get wrong?';
const QUESTION_CARD_OPTIONS = Object.freeze([
  'Write what it got wrong (files as refines)',
  'It is a new question (files as relocates)',
  'Cancel the change',
]);
const FRAMES_DIR_REL = '.mindrian/frames';
const MAX_QUESTION_CHARS = 1000;
const MAX_ACCOUNT_CHARS = 4000;

const ARTIFACT_HANDLE_RE = /^\.mindrian\/frames\/[a-z0-9.-]+\.md$/;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// normalizeQuestion(text) -- NFC-normalize, trim, and collapse every run of
// internal whitespace (spaces, tabs, newlines) to one space. This is the ONE
// place question text is normalized; setGoverningQuestion, questionHash and
// every render helper below route through it.
function normalizeQuestion(text) {
  const s = typeof text === 'string' ? text : String(text == null ? '' : text);
  return s.normalize('NFC').trim().replace(/\s+/g, ' ');
}

// normalizeAccount(text) -- NFC-normalize and trim outer whitespace only;
// internal newlines are KEPT (an account may be a short paragraph).
function normalizeAccount(text) {
  const s = typeof text === 'string' ? text : String(text == null ? '' : text);
  return s.normalize('NFC').trim();
}

function questionHash(text) {
  return 'sha256:' + crypto.createHash('sha256').update(normalizeQuestion(text)).digest('hex');
}

function accountHash(text) {
  return 'sha256:' + crypto.createHash('sha256').update(normalizeAccount(text)).digest('hex');
}

function isExistingDir(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return false;
  try {
    return fs.statSync(roomDir).isDirectory();
  } catch (_e) {
    return false;
  }
}

// ensureFramesDir(roomDir) -- assert, act, re-assert (the room-path-
// containment discipline this module's own writer, writeFileContained,
// already follows). Returns the frames directory's absolute path.
function ensureFramesDir(roomDir) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  const framesDir = path.join(roomDir, FRAMES_DIR_REL);
  assertRealpathContained(roomDir, mindrianDir, 'mindrian dir');
  fs.mkdirSync(framesDir, { recursive: true });
  assertRealpathContained(roomDir, framesDir, 'frames dir (post-mkdir)');
  return framesDir;
}

// generateArtifactPath(roomDir, prefix, version, hashPrefix) -- mint a
// GENERATED-ONLY artifact name from version + the first 8 hex of the
// question hash + a fresh nonce. Never derived from question or account
// text (Part 8: a file name must never leak prose). A collision (extremely
// unlikely: a fresh 3-byte nonce) draws one more nonce, then gives up so the
// caller can refuse artifact_write_failed rather than silently overwrite.
function generateArtifactPath(roomDir, prefix, version, hashPrefix) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const nonce = crypto.randomBytes(3).toString('hex');
    const name = prefix + '-v' + version + '-' + hashPrefix + '-' + nonce + '.md';
    const handle = FRAMES_DIR_REL + '/' + name;
    const absPath = path.join(roomDir, handle);
    if (!fs.existsSync(absPath)) {
      return { handle: handle, absPath: absPath };
    }
  }
  return null;
}

// readArtifact(roomDir, handle) -- the ONE reader for a question / account /
// pending-question artifact. Refuses any handle that does not match the
// generated-only shape or whose resolved path escapes the room (Part 8 +
// the 354-05 containment discipline); a missing file reports file_missing so
// callers can render it as Unresolved rather than crash.
function readArtifact(roomDir, handle) {
  if (typeof handle !== 'string' || !ARTIFACT_HANDLE_RE.test(handle)) {
    return { ok: false, reason: 'invalid_handle' };
  }
  const absPath = path.join(roomDir, handle);
  if (!isRealpathContained(roomDir, absPath)) {
    return { ok: false, reason: 'invalid_handle' };
  }
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (_e) {
    return { ok: false, reason: 'file_missing' };
  }
  return { ok: true, text: raw.replace(/\n$/, '') };
}

// readPending(roomDir) -- reads .mindrian/frames/pending.json plus the
// proposed text it points at. Returns null when no change is waiting, or
// when the pending marker is unreadable / malformed.
function readPending(roomDir) {
  const jsonPath = path.join(roomDir, FRAMES_DIR_REL, 'pending.json');
  if (!fs.existsSync(jsonPath)) return null;
  let pendingJson;
  try {
    pendingJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (_e) {
    return null;
  }
  if (!isPlainObject(pendingJson)) return null;
  const textResult = readArtifact(roomDir, pendingJson.proposed_handle);
  return {
    text: textResult.ok ? textResult.text : null,
    origin: typeof pendingJson.origin === 'string' ? pendingJson.origin : null,
    based_on_version: Number.isInteger(pendingJson.based_on_version) ? pendingJson.based_on_version : null,
    at: typeof pendingJson.at === 'string' ? pendingJson.at : null,
  };
}

// clearPending(roomDir) -- best-effort removal of both pending files; a
// missing file is fine (nothing to clear).
function clearPending(roomDir) {
  for (const name of ['pending.json', 'pending-question.md']) {
    try {
      fs.unlinkSync(path.join(roomDir, FRAMES_DIR_REL, name));
    } catch (_e) {
      // best effort: a missing pending file is not an error
    }
  }
}

// changeLine(v) -- the one place the three change-line sentences are
// written; every render helper below reuses it so the wording can never
// drift between renderQuestionLines and renderHistoryLines.
function changeLine(v) {
  if (v.change_kind === 'refines') {
    return 'Change: refines version ' + v.from_version + ' (account on file)';
  }
  if (v.change_kind === 'relocates') {
    return 'Change: relocates from version ' + v.from_version + ' (no account)';
  }
  return 'Change: first question';
}

// unresolvedLine(u) -- the one place the two Unresolved sentences are
// written (a changed file vs a missing file), for either the question or
// the account artifact.
function unresolvedLine(u) {
  const subject = (u.what === 'account' ? 'account' : 'question') + ' file';
  if (u.reason === 'file_missing') {
    return 'Unresolved: the ' + subject + ' for version ' + u.version + ' is missing.';
  }
  return 'Unresolved: the ' + subject + ' for version ' + u.version + ' changed outside the record.';
}

// ---------------------------------------------------------------------------
// The card (the SEED-020 single card-emission door; see the file header for
// the F.1-not-F.0 shape note). This is the ONLY pickShape call site in this
// file.
// ---------------------------------------------------------------------------

function renderQuestionChangeCard(input) {
  const previous = (isPlainObject(input) && isPlainObject(input.previous)) ? input.previous : {};
  const proposed = (isPlainObject(input) && isPlainObject(input.proposed)) ? input.proposed : {};
  const previousVersion = typeof previous.version === 'number' ? previous.version : '?';
  const previousText = typeof previous.text === 'string' ? previous.text : '';
  const proposedText = typeof proposed.text === 'string' ? proposed.text : '';
  const header = QUESTION_ASK + '\n'
    + 'Old question (version ' + previousVersion + '): ' + previousText + '\n'
    + 'New question: ' + proposedText;
  const fallbackOptions = QUESTION_CARD_OPTIONS.concat(['Free-Text']);

  try {
    // Required INSIDE this function (the lib/core/room-chooser.cjs
    // renderRoomChooserCard idiom), never at this file's top level.
    // eslint-disable-next-line global-require
    const dispatcher = require('../hmi/selector-dispatcher.cjs');
    const result = dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: null,
      operator: null,
      // The card is local-only and says nothing about the Brain; an explicit
      // tier 2 keeps the dispatcher from prepending a Brain-reachability
      // banner that has nothing to do with this ask.
      tier: 2,
      payload: {
        header: header,
        verbs: Array.from(QUESTION_CARD_OPTIONS),
        // No option marked recommended: neither refines nor relocates is
        // presented as better (T-358-33).
        recommendedVerb: null,
      },
    });
    const rendered = result && result.rendered;
    if (!rendered || !rendered.zones || !rendered.contract) {
      return {
        shape: null,
        header: header,
        options: fallbackOptions,
        rendered_text: header + '\n' + fallbackOptions.join('\n'),
        askuserquestion_marker: null,
        askuserquestion_binding: null,
      };
    }
    const zones = rendered.zones;
    return {
      shape: result.shape,
      header: zones.header,
      options: Array.isArray(rendered.contract.verbs) ? rendered.contract.verbs : fallbackOptions,
      rendered_text: zones.header + '\n' + zones.body + '\n' + zones.footer,
      askuserquestion_marker: rendered.askuserquestion_marker || null,
      askuserquestion_binding: rendered.askuserquestion_binding || null,
    };
  } catch (_e) {
    // The ask is never lost: a dispatcher fault still returns the ask text
    // and the three options plus Free-Text, just without the F.1 envelope.
    return {
      shape: null,
      header: header,
      options: fallbackOptions,
      rendered_text: header + '\n' + fallbackOptions.join('\n'),
      askuserquestion_marker: null,
      askuserquestion_binding: null,
    };
  }
}

// ---------------------------------------------------------------------------
// The one write door
// ---------------------------------------------------------------------------

// setGoverningQuestion(db, roomDir, params) -- the ONLY writer of the room's
// governing-question record (ruling 2). See the file header for the full
// refusal / landing contract; the validation order below matches it exactly.
function setGoverningQuestion(db, roomDir, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  if (!isExistingDir(roomDir)) {
    return { ok: false, reason: 'no_room_dir' };
  }

  if (params.cancel === true) {
    const pendingPath = path.join(roomDir, FRAMES_DIR_REL, 'pending.json');
    if (!fs.existsSync(pendingPath)) {
      return { ok: false, reason: 'nothing_pending' };
    }
    clearPending(roomDir);
    return { ok: true, result: 'cancelled' };
  }

  const rawText = typeof params.text === 'string' ? params.text : '';
  const normalizedText = normalizeQuestion(rawText);
  if (normalizedText.length === 0 || normalizedText.length > MAX_QUESTION_CHARS) {
    return { ok: false, reason: 'invalid_text' };
  }

  const origin = params.origin;
  if (typeof origin !== 'string' || !navigation.FRAME_ORIGINS.has(origin)) {
    return {
      ok: false,
      reason: 'invalid_origin',
      allowed: navigation.FRAME_ORIGINS_ORDERED.map((o) => o.id),
    };
  }
  const originInfo = navigation.frameOriginInfo(origin);
  const originLabel = originInfo ? originInfo.label : null;

  let accountPresent = false;
  let rawAccount = '';
  if (params.account !== undefined && params.account !== null) {
    if (typeof params.account !== 'string') {
      return { ok: false, reason: 'invalid_account' };
    }
    const normalizedAccount = normalizeAccount(params.account);
    if (normalizedAccount.length > MAX_ACCOUNT_CHARS) {
      return { ok: false, reason: 'invalid_account' };
    }
    if (normalizedAccount.length > 0) {
      accountPresent = true;
      rawAccount = params.account;
    }
  }

  let relocate;
  if (params.relocate !== undefined && params.relocate !== null) {
    if (typeof params.relocate !== 'boolean') {
      return { ok: false, reason: 'invalid_params' };
    }
    relocate = params.relocate;
  }

  if (accountPresent && relocate === true) {
    // Never guess the officer's choice (Pitfall 8 / T-358-33).
    return { ok: false, reason: 'ambiguous_change' };
  }

  let latest = null;
  try {
    const versions = navigation.readGoverningQuestionVersions(db);
    latest = versions.length > 0 ? versions[versions.length - 1] : null;
  } catch (_e) {
    latest = null;
  }

  if (!latest) {
    if (Number.isInteger(params.based_on_version)) {
      return { ok: false, reason: 'question_changed_meanwhile', current: null };
    }
    if (accountPresent || relocate === true) {
      return { ok: false, reason: 'no_previous_question' };
    }
    // Falls through to landing as the first question.
  } else {
    const proposedHash = questionHash(normalizedText);
    if (proposedHash === latest.question_hash) {
      return { ok: true, result: 'unchanged', version: latest.version };
    }
    if (Number.isInteger(params.based_on_version) && params.based_on_version !== latest.version) {
      const curView = readGoverningQuestion(db, roomDir);
      return { ok: false, reason: 'question_changed_meanwhile', current: curView.ok ? curView.current : null };
    }
    if (!accountPresent && relocate !== true) {
      // A missing choice NEVER defaults to relocates: refuse and ask.
      const framesDirForPending = ensureFramesDir(roomDir);
      writeFileContained(roomDir, path.join(framesDirForPending, 'pending-question.md'), normalizedText + '\n');
      const pendingJson = {
        proposed_handle: FRAMES_DIR_REL + '/pending-question.md',
        proposed_hash: proposedHash,
        origin: origin,
        based_on_version: latest.version,
        at: new Date().toISOString(),
      };
      writeFileContained(
        roomDir, path.join(framesDirForPending, 'pending.json'),
        JSON.stringify(pendingJson, null, 2) + '\n'
      );

      const previousArtifact = readArtifact(roomDir, latest.question_handle);
      const previousOriginInfo = navigation.frameOriginInfo(latest.origin);
      const previous = {
        version: latest.version,
        text: previousArtifact.ok ? previousArtifact.text : null,
        origin: latest.origin,
        origin_label: previousOriginInfo ? previousOriginInfo.label : null,
      };
      const proposed = { text: normalizedText, origin: origin, origin_label: originLabel };
      return {
        ok: false,
        reason: 'change_needs_account',
        ask: QUESTION_ASK,
        previous: previous,
        proposed: proposed,
        options: Array.from(QUESTION_CARD_OPTIONS),
        pending: true,
        card: renderQuestionChangeCard({ previous: previous, proposed: proposed }),
      };
    }
    // Falls through to landing as refines (accountPresent) or relocates.
  }

  const landKind = latest ? (accountPresent ? 'refines' : 'relocates') : 'first';

  // Landing: kept INLINE in this function's own body (not delegated to a
  // helper) so the tool-honesty one-hop scanner reaches the frame-node and
  // edge write calls below directly.
  const owns = db.isTransaction !== true;
  if (owns) db.exec('BEGIN IMMEDIATE');
  const writtenPaths = [];
  try {
    const reReadVersions = navigation.readGoverningQuestionVersions(db);
    const reReadLatest = reReadVersions.length > 0 ? reReadVersions[reReadVersions.length - 1] : null;
    const preVersion = latest ? latest.version : null;
    const preHash = latest ? latest.question_hash : null;
    const curVersion = reReadLatest ? reReadLatest.version : null;
    const curHash = reReadLatest ? reReadLatest.question_hash : null;
    if (preVersion !== curVersion || preHash !== curHash) {
      if (owns) db.exec('ROLLBACK');
      const curView = readGoverningQuestion(db, roomDir);
      return { ok: false, reason: 'question_changed_meanwhile', current: curView.ok ? curView.current : null };
    }

    const N = reReadLatest ? reReadLatest.version + 1 : 1;
    ensureFramesDir(roomDir);

    const newHash = questionHash(normalizedText);
    const hashPrefix = newHash.slice(7, 15);

    const qGen = generateArtifactPath(roomDir, 'q', N, hashPrefix);
    if (!qGen) {
      if (owns) db.exec('ROLLBACK');
      return { ok: false, reason: 'artifact_write_failed', detail: 'could not allocate a question artifact name' };
    }
    writeFileContained(roomDir, qGen.absPath, normalizedText + '\n');
    writtenPaths.push(qGen.absPath);

    let refinementHandle;
    let accountHashValue;
    let accountTextNormalized;
    if (landKind === 'refines') {
      accountTextNormalized = normalizeAccount(rawAccount);
      accountHashValue = accountHash(rawAccount);
      const aGen = generateArtifactPath(roomDir, 'a', N, hashPrefix);
      if (!aGen) {
        if (owns) db.exec('ROLLBACK');
        for (const p of writtenPaths) { try { fs.unlinkSync(p); } catch (_eu) { /* best effort */ } }
        return { ok: false, reason: 'artifact_write_failed', detail: 'could not allocate an account artifact name' };
      }
      writeFileContained(roomDir, aGen.absPath, accountTextNormalized + '\n');
      writtenPaths.push(aGen.absPath);
      refinementHandle = aGen.handle;
    }

    const writeResult = navigation.writeFrameNode(db, {
      frameRole: navigation.GOVERNING_QUESTION_ROLE,
      version: N,
      origin: origin,
      governingThoughtHash: newHash,
      questionHandle: qGen.handle,
      predecessorHash: reReadLatest ? reReadLatest.question_hash : undefined,
      predecessorNodeId: reReadLatest ? reReadLatest.node_id : undefined,
      changeKind: landKind === 'refines' ? 'refines' : (landKind === 'relocates' ? 'relocates' : undefined),
      refinementHandle: refinementHandle,
      accountHash: accountHashValue,
      setBy: 'user',
      setById: params.set_by_id,
    });
    if (!writeResult.ok) {
      if (owns) db.exec('ROLLBACK');
      for (const p of writtenPaths) { try { fs.unlinkSync(p); } catch (_eu2) { /* best effort */ } }
      return { ok: false, reason: 'version_write_failed', detail: writeResult.reason };
    }

    // An edge failure never fails the version (Part 9 floor); only attempted
    // when a predecessor exists to link to.
    let edgeResult = null;
    if (reReadLatest) {
      edgeResult = navigation.writeEdge(db, {
        source_id: writeResult.node_id,
        target_id: reReadLatest.node_id,
        edge_type: landKind === 'refines' ? 'REFINES' : 'FOLLOWS_FROM',
        properties: {
          change_kind: landKind === 'refines' ? 'refines' : 'relocates',
          origin: origin,
        },
      });
    }

    if (owns) db.exec('COMMIT');
    clearPending(roomDir);

    const result = {
      ok: true,
      result: reReadLatest ? landKind : 'first',
      version: N,
      node_id: writeResult.node_id,
      question_handle: qGen.handle,
      edge: edgeResult ? { ok: edgeResult.ok, type: edgeResult.type } : null,
      pending_cleared: true,
    };
    if (landKind === 'refines') {
      result.account_handle = refinementHandle;
      result.account_text = accountTextNormalized;
    }
    return result;
  } catch (e) {
    if (owns) {
      try { db.exec('ROLLBACK'); } catch (_er) { /* best effort */ }
    }
    for (const p of writtenPaths) { try { fs.unlinkSync(p); } catch (_eu3) { /* best effort */ } }
    return { ok: false, reason: 'artifact_write_failed', detail: String(e.message || '').slice(0, 100) };
  }
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

// buildQuestionState(db, roomDir) -- the shared enrichment step both
// readGoverningQuestion and readQuestionHistory build on: every version
// oldest first, each with its resolved text (or null when unresolved), the
// account text for a refines version, and the waiting pending change (with
// its card) when one exists.
function buildQuestionState(db, roomDir) {
  if (!db || typeof db.prepare !== 'function') return null;
  let rawVersions;
  try {
    rawVersions = navigation.readGoverningQuestionVersions(db);
  } catch (_e) {
    return null;
  }
  const unresolved = [];
  const versions = rawVersions.map((v, idx) => {
    const isCurrent = idx === rawVersions.length - 1;
    const questionResult = readArtifact(roomDir, v.question_handle);
    let text = null;
    if (!questionResult.ok) {
      unresolved.push({
        version: v.version, what: 'question',
        reason: questionResult.reason === 'file_missing' ? 'file_missing' : 'invalid_handle',
      });
    } else {
      text = questionResult.text;
      if (v.question_hash && questionHash(text) !== v.question_hash) {
        unresolved.push({ version: v.version, what: 'question', reason: 'file_changed' });
      }
    }

    let accountText = null;
    if (v.change_kind === 'refines') {
      if (!v.refinement_handle) {
        unresolved.push({ version: v.version, what: 'account', reason: 'invalid_handle' });
      } else {
        const acctResult = readArtifact(roomDir, v.refinement_handle);
        if (!acctResult.ok) {
          unresolved.push({
            version: v.version, what: 'account',
            reason: acctResult.reason === 'file_missing' ? 'file_missing' : 'invalid_handle',
          });
        } else {
          accountText = acctResult.text;
          if (v.account_hash && accountHash(accountText) !== v.account_hash) {
            unresolved.push({ version: v.version, what: 'account', reason: 'file_changed' });
          }
        }
      }
    }

    const versionOriginInfo = navigation.frameOriginInfo(v.origin);
    const fromVersion = (v.change_kind === 'refines' || v.change_kind === 'relocates') ? v.version - 1 : null;
    return {
      version: v.version,
      text: text,
      origin: v.origin,
      origin_label: versionOriginInfo ? versionOriginInfo.label : null,
      set_at: v.set_at,
      change_kind: v.change_kind,
      from_version: fromVersion,
      account_text: accountText,
      is_current: isCurrent,
    };
  });

  const pendingRaw = readPending(roomDir);
  let pending = null;
  if (pendingRaw) {
    const pendingOriginInfo = navigation.frameOriginInfo(pendingRaw.origin);
    const current = versions.length > 0 ? versions[versions.length - 1] : null;
    pending = {
      text: pendingRaw.text,
      origin: pendingRaw.origin,
      origin_label: pendingOriginInfo ? pendingOriginInfo.label : null,
      based_on_version: pendingRaw.based_on_version,
      at: pendingRaw.at,
      ask: QUESTION_ASK,
      card: current
        ? renderQuestionChangeCard({ previous: current, proposed: { text: pendingRaw.text || '' } })
        : null,
    };
  }

  return { pending: pending, versions: versions, unresolved: unresolved };
}

function readGoverningQuestion(db, roomDir) {
  const state = buildQuestionState(db, roomDir);
  if (!state) return { ok: false, reason: 'read_failed' };
  const current = state.versions.length > 0 ? state.versions[state.versions.length - 1] : null;
  return {
    ok: true,
    pending: state.pending,
    current: current,
    total_versions: state.versions.length,
    unresolved: state.unresolved,
  };
}

function readQuestionHistory(db, roomDir) {
  const state = buildQuestionState(db, roomDir);
  if (!state) return { ok: false, reason: 'read_failed' };
  return {
    ok: true,
    pending: state.pending,
    versions: state.versions,
    unresolved: state.unresolved,
  };
}

// ---------------------------------------------------------------------------
// Renders (plain lines; every state above and the card must stay free of
// ranking words and never say "governing thought" -- Pitfall 6).
// ---------------------------------------------------------------------------

function renderPendingLines(pending) {
  const lines = [];
  lines.push('A question change is waiting.');
  lines.push('Proposed question: ' + (pending.text !== null ? pending.text : '(the proposed text could not be read)'));
  lines.push('Proposed origin: ' + pending.origin + ' - ' + pending.origin_label);
  lines.push(QUESTION_ASK);
  lines.push('Answer in your own words to file it as refines, say it is a new question to file it as relocates, or cancel the change.');
  lines.push('');
  return lines;
}

function renderQuestionLines(view) {
  const lines = [];
  if (view.pending) {
    lines.push(...renderPendingLines(view.pending));
  }
  if (!view.current) {
    lines.push('No governing question recorded yet.');
  } else {
    const c = view.current;
    lines.push(
      'Governing question (version ' + c.version + ' of ' + view.total_versions + '): '
      + (c.text !== null ? c.text : '(question file missing)')
    );
    lines.push('Origin: ' + c.origin + ' - ' + c.origin_label);
    lines.push('Set at: ' + c.set_at);
    lines.push(changeLine(c));
    if (view.total_versions > 1) {
      lines.push('Earlier versions: ' + (view.total_versions - 1) + ' (see the history)');
    }
  }
  for (const u of (view.unresolved || [])) {
    lines.push(unresolvedLine(u));
  }
  return lines;
}

function renderHistoryLines(history) {
  const lines = [];
  if (history.pending) {
    lines.push(...renderPendingLines(history.pending));
  }
  const versions = history.versions || [];
  if (versions.length === 0) {
    lines.push('No governing question recorded yet.');
    for (const u of (history.unresolved || [])) lines.push(unresolvedLine(u));
    return lines;
  }
  const count = versions.length;
  lines.push('Question history (' + count + (count === 1 ? ' version' : ' versions') + ', oldest first)');
  for (const v of versions) {
    let header = 'Version ' + v.version + ' - origin ' + v.origin + ' - ' + v.origin_label + ' - set at ' + v.set_at;
    if (v.is_current) header += ' (current)';
    lines.push(header);
    lines.push('  Question: ' + (v.text !== null ? v.text : '(question file missing)'));
    lines.push('  ' + changeLine(v));
    if (v.change_kind === 'refines') {
      lines.push('  What the old question got wrong: ' + (v.account_text !== null ? v.account_text : '(account file missing)'));
    }
  }
  for (const u of (history.unresolved || [])) lines.push(unresolvedLine(u));
  return lines;
}

// ---------------------------------------------------------------------------
// Routing spec (Phase 358-08, navigator requirement 2026-09-23 item 1:
// "Larry triggers the question door relevantly"). This is the executable
// SPECIFICATION of when a turn belongs at the question door: it does not
// route anything on its own (no runtime per-turn router exists here or is
// added here -- a runtime router would live in scripts/intent-classifier.cjs
// or lib/core/navigation-engine.cjs, both peer territory per the plan's own
// context block). Instead, every host reaches this surface by READING A
// DESCRIPTION (the /mos:room frontmatter description, its routing section in
// the body, and the question_read / question_set MCP tool descriptions added
// in 358-09); QUESTION_TURN_EXAMPLES is the single source those descriptions
// quote verbatim, and resolveQuestionTurn is the single source that proves
// the routing text and the spec agree (tested by W2/W3 in
// tests/test-358-b2-routing.cjs). Change one, change all.
//
// QTERM matches "question", "governing question", "room's question" and
// "room's governing question" as one optional-prefix unit, so every pattern
// below reads naturally either way.
// ---------------------------------------------------------------------------

const QTERM = "(?:room'?s\\s+)?(?:governing\\s+)?question";

// tests/test-358-b2-part8.cjs P7 (358-07's own one-constant rule) scans this
// file for the literal origin-id substrings "tasking" and "inherited" so an
// origin id can never be hardcoded as a VALUE here, only ever read from
// navigation.FRAME_ORIGINS_ORDERED. The change corpus below legitimately
// needs the ordinary English word "tasking" (as in "the tasking changed",
// military-orders usage) inside a natural-language routing pattern -- an
// unrelated concept from the origin id that happens to share its spelling,
// not an origin-id value. P7 carries an explicit, named allowlist (the
// P7-ALLOW(tasking) marker below) that permits ONLY this one line to
// contain the literal word "tasking", so the scan still catches a real
// hardcoded origin id anywhere else in this file (358-09 Rule-1 deviation:
// the prior two-literal concatenation, 'task' + 'ing', was gaming the
// scan rather than naming the exception honestly).
//
// Evaluated in precedence order below: history, then change, then ask -- so
// "how has our question changed" (an ask ABOUT the change) is read as a
// request to open the history, not itself a change.
const QUESTION_TURN_PATTERNS = Object.freeze({
  history: Object.freeze([
    new RegExp('\\bhow\\s+(?:has|have|did)\\s+(?:the|our|this)\\s+' + QTERM + '\\s+change', 'i'),
    new RegExp('\\bquestion\\s+history\\b', 'i'),
    new RegExp('\\bwhere\\s+did\\s+(?:the|our|this)\\s+' + QTERM + '\\s+come\\s+from\\b', 'i'),
  ]),
  change: Object.freeze([
    new RegExp(
      '\\b(?:change|changing|reframe|reframing|update|updating|replace|replacing|set|record|recording)'
      + '\\s+(?:the|our|this)\\s+' + QTERM + '\\b',
      'i'
    ),
    new RegExp(
      '\\b(?:our|the|this)\\s+' + QTERM
      + '\\s+(?:is\\s+now|has\\s+changed|changed|should\\s+(?:now\\s+)?be|becomes|is\\s+no\\s+longer)\\b',
      'i'
    ),
    new RegExp('\\bnew\\s+governing\\s+question\\b', 'i'),
    // P7-ALLOW(tasking): tests/test-358-b2-part8.cjs P7 permits this one
    // line to contain the natural-language word "tasking" via this named
    // marker; it is routing vocabulary, not an origin-id literal.
    new RegExp('\\b(?:our|the)\\s+tasking\\s+(?:has\\s+)?changed\\b', 'i'),
  ]),
  ask: Object.freeze([
    new RegExp(
      "\\b(?:what\\s+is|what's|show(?:\\s+me)?|remind\\s+me\\s+of)\\s+(?:the|our|this)\\s+"
      + QTERM + '(?:\\s*[?.!]|\\s*$|\\s+and\\b)',
      'i'
    ),
  ]),
});

// The single source every routing description quotes verbatim (the /mos:room
// routing section, and the question_read / question_set MCP descriptions in
// 358-09). '...' in a change example stands for the proposed question text.
const QUESTION_TURN_EXAMPLES = Object.freeze({
  change: Object.freeze([
    'our question is now ...',
    'change our governing question to ...',
  ]),
  ask: Object.freeze([
    'what is our governing question',
    'where did our question come from',
    'how has our question changed',
  ]),
});

// resolveQuestionTurn(utterance) -- never throws. A non-string, empty, or
// over-length (> 4000 chars) utterance resolves to {door:null, intent:null}
// with no regex work. Curly apostrophes (U+2018/U+2019) are normalized to a
// straight apostrophe and internal whitespace is collapsed before matching,
// so "What's the room's question?" and "What’s the room’s
// question?" resolve identically.
function resolveQuestionTurn(utterance) {
  try {
    if (typeof utterance !== 'string' || utterance.length === 0 || utterance.length > 4000) {
      return { door: null, intent: null };
    }
    const normalized = utterance.replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
    if (normalized.length === 0) return { door: null, intent: null };

    for (const re of QUESTION_TURN_PATTERNS.history) {
      if (re.test(normalized)) return { door: 'question_read', intent: 'history' };
    }
    for (const re of QUESTION_TURN_PATTERNS.change) {
      if (re.test(normalized)) return { door: 'question_set', intent: 'change' };
    }
    for (const re of QUESTION_TURN_PATTERNS.ask) {
      if (re.test(normalized)) return { door: 'question_read', intent: 'ask' };
    }
    return { door: null, intent: null };
  } catch (_e) {
    return { door: null, intent: null };
  }
}

module.exports = {
  setGoverningQuestion,
  readGoverningQuestion,
  readQuestionHistory,
  renderQuestionLines,
  renderHistoryLines,
  renderQuestionChangeCard,
  questionHash,
  normalizeQuestion,
  QUESTION_ASK,
  QUESTION_CARD_OPTIONS,
  FRAMES_DIR_REL,
  MAX_QUESTION_CHARS,
  MAX_ACCOUNT_CHARS,
  QUESTION_TURN_PATTERNS,
  QUESTION_TURN_EXAMPLES,
  resolveQuestionTurn,
};
