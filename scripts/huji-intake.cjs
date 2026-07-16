#!/usr/bin/env node
'use strict';
/*
 * scripts/huji-intake.cjs - Phase 229-05, seam (b): the deterministic room-populator.
 *
 * populateRoom({roomDir, evidence, transcript, sessionId}) drives the SHIPPED Claimify
 * writer (navigation.writeClaimNode) DIRECTLY over a scratch room.db, exactly as the
 * shipped file-meeting pipeline populates a real room, but NON-INTERACTIVELY. It never
 * invokes the interactive file-meeting slash command: that command carries an F.8
 * nugget-routing HITL and uses AskUserQuestion, which would block an unattended
 * --permission-mode dontAsk session (CONTRACTS INTAKE_PATH). We reuse the MACHINERY,
 * not the interactive shell.
 *
 * Every claim in the Stage A evidence.json (problem_claim, value_proposition, and each
 * evidence_claims[] item) mints ONE typed claim node with:
 *   - review_status='proposed' (NEVER auto-confirmed; only a human confirmNode promotes,
 *     Canon Part 9 role 5),
 *   - the VERBATIM transcript quote + evidenced disposition riding the additive extraProps
 *     blob (D1 anchor rides into the node, protected keys untouched),
 *   - a stable sourceSegment id so a rerun UPSERTs rather than duplicating (idempotency).
 *
 * Related claims are linked through navigation.writeEdge (ALLOWED_EDGE_TYPES only), and
 * wisdom nuggets are extracted the way file-meeting surfaces them. Room population is
 * LOCAL room.db ONLY - no Brain write, no network (Canon Part 8, threat T-229-05-03).
 *
 * CJS only. No em-dashes (CLAUDE.md HARD RULE). Zero new dependencies (reuse shipped core).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const navigation = require('../lib/core/navigation.cjs');

// --------------------------------------------------------------------------
// knowledgeTypeForEvidence - map the evidence `evidenced` enum onto the frozen
// 6-member KNOWLEDGE_TYPES taxonomy. Only a demonstrated ('evidenced') claim rises
// to 'fact'; an asserted or absent claim is an 'assumption' (an unvalidated venture
// belief). Problem and value claims are venture hypotheses, so 'assumption' by default.
// --------------------------------------------------------------------------
function knowledgeTypeForEvidence(evidenced) {
  if (evidenced === 'evidenced') return 'fact';
  return 'assumption'; // 'asserted' | 'absent' | anything else -> unvalidated belief
}

// --------------------------------------------------------------------------
// extractWisdomNuggets - the file-meeting nugget pass, made deterministic. A nugget
// is a notable, quote-anchored signal worth surfacing. Two sources, both grounded in
// what the student actually said (never fabricated):
//   1. self_identified_gaps - metacognition signals (REWARD, never double-punish).
//   2. evidenced claims - the pitch's strongest, backed points.
// Returns an array of { kind, text, quote }. Pure function, no writes.
// --------------------------------------------------------------------------
function extractWisdomNuggets(evidence) {
  const nuggets = [];
  const gaps = Array.isArray(evidence.self_identified_gaps) ? evidence.self_identified_gaps : [];
  for (const gap of gaps) {
    if (typeof gap === 'string' && gap.trim().length > 0) {
      nuggets.push({ kind: 'self_identified_gap', text: gap.trim(), quote: '' });
    }
  }
  const claims = Array.isArray(evidence.evidence_claims) ? evidence.evidence_claims : [];
  for (const c of claims) {
    if (c && c.evidenced === 'evidenced' && typeof c.claim === 'string') {
      nuggets.push({ kind: 'evidenced_strength', text: c.claim, quote: typeof c.quote === 'string' ? c.quote : '' });
    }
  }
  return nuggets;
}

// --------------------------------------------------------------------------
// buildClaimSpecs - flatten the evidence object into an ordered list of claim specs.
// Each spec carries a STABLE sourceSegment id (role + deterministic index + timestamp
// when present) so reruns UPSERT the exact same node ids (idempotency key, per the
// writeClaimNode CLAIM_NODE_ID(sessionId, segmentKey) contract).
// --------------------------------------------------------------------------
function buildClaimSpecs(evidence) {
  const specs = [];

  if (evidence.problem_claim && evidence.problem_claim.stated) {
    const ts = evidence.problem_claim.timestamp;
    specs.push({
      role: 'problem_claim',
      text: evidence.problem_claim.quote || 'problem claim',
      quote: evidence.problem_claim.quote || '',
      evidenced: 'asserted',
      knowledge_type: 'assumption',
      sourceSegment: 'problem_claim@' + (typeof ts === 'string' && ts ? ts : 'na'),
    });
  }

  if (evidence.value_proposition && evidence.value_proposition.stated) {
    specs.push({
      role: 'value_proposition',
      text: evidence.value_proposition.quote || 'value proposition',
      quote: evidence.value_proposition.quote || '',
      evidenced: 'asserted',
      knowledge_type: 'assumption',
      sourceSegment: 'value_proposition',
    });
  }

  const claims = Array.isArray(evidence.evidence_claims) ? evidence.evidence_claims : [];
  claims.forEach((c, i) => {
    if (!c || typeof c.claim !== 'string') return;
    specs.push({
      role: 'evidence_claim',
      index: i,
      text: c.claim,
      quote: typeof c.quote === 'string' ? c.quote : '',
      evidenced: typeof c.evidenced === 'string' ? c.evidenced : 'asserted',
      knowledge_type: knowledgeTypeForEvidence(c.evidenced),
      // absent = a claimed-but-unmade element: unresolved, so mark ambiguous for review.
      disambiguation: c.evidenced === 'absent' ? 'ambiguous' : undefined,
      sourceSegment: 'evidence:' + i,
    });
  });

  return specs;
}

// --------------------------------------------------------------------------
// DI-4 dual-write: the grading spine (Stage B: /mos:pipeline PWS_grading, deep-grade
// first) is tool-scoped to Read/Write/Edit/Bash(node lib/core/*). It CANNOT run
// sqlite3, so it never reads the claim GRAPH (room.db); it reads the section markdown
// the same way it reads any organically-grown room (deep-grade Stage 1: "Read the
// room's populated sections"). Plan 05 wired only the graph half of "populate the room
// like file-meeting does" - so the sections stayed empty auto-scaffolds and Stage B
// (correctly, per the anti-fabrication rule) refused to grade an empty room.
//
// The fix mirrors file-meeting's shipped behavior: intake renders the extracted
// evidence into the section ROOM.md markdown (ICM Layer 0 identity files the grading
// commands already know how to read) AND drops one consolidated pitch-intake artifact
// at the room root (file-meeting's compact-root-reference pattern). No grading command
// changes; the ephemeral scratch room simply looks, on disk, like a normal populated
// room. LOCAL room only - no Brain, no network (Canon Part 8). Quotes are rendered
// BYTE-VERBATIM (the same D1 span the graph node carries), so the grader quotes
// verbatim and D1 stays clean end to end.
//
// Idempotent: the injected region is fenced by STAGE_A markers and fully replaced on
// every run, so a rerun overwrites rather than duplicating (matches the graph UPSERT).
// --------------------------------------------------------------------------

const STAGE_A_BEGIN = '<!-- STAGE-A-INTAKE:BEGIN (huji-stage-a; deterministic dual-write) -->';
const STAGE_A_END = '<!-- STAGE-A-INTAKE:END -->';

// mdQuote - render a verbatim transcript span as a markdown blockquote WITHOUT
// altering a single character of the span (disfluencies/repairs preserved). Only the
// per-line '> ' blockquote prefix is added; the source text itself is copied as-is.
function mdQuote(text) {
  const s = typeof text === 'string' ? text : '';
  if (!s) return '> (no quote captured)';
  return s.split('\n').map((ln) => '> ' + ln).join('\n');
}

// buildSectionRenderings - map the evidence object onto the ICM sections a pitch
// actually addresses. A 2-minute first-venture pitch legitimately covers problem +
// solution/value (+ its own named gaps); it does NOT do market sizing, unit economics,
// or IP, so those sections stay empty BY DESIGN (honest, course-tier). Returns an
// ordered list of { section, body } markdown blocks. Pure function, no writes.
function buildSectionRenderings(evidence, subId) {
  const renderings = [];

  // problem-definition <- problem_claim (the venture's core problem, as pitched).
  if (evidence.problem_claim && evidence.problem_claim.stated) {
    const ts = (typeof evidence.problem_claim.timestamp === 'string' && evidence.problem_claim.timestamp)
      ? ' (transcript ' + evidence.problem_claim.timestamp + ')' : '';
    renderings.push({
      section: 'problem-definition',
      body: [
        '## Problem (as pitched)' + ts,
        '',
        'The student stated the problem this venture addresses. Verbatim from the pitch:',
        '',
        mdQuote(evidence.problem_claim.quote),
      ].join('\n'),
    });
  }

  // solution-design <- value_proposition + evidence_claims + self_identified_gaps +
  // language_notes (the solution, its supporting claims with disposition, the student's
  // own acknowledged gaps, and the language-gentleness note the grader must honor).
  const sol = [];
  if (evidence.value_proposition && evidence.value_proposition.stated) {
    sol.push('## Value Proposition (as pitched)', '', mdQuote(evidence.value_proposition.quote), '');
  }
  const claims = Array.isArray(evidence.evidence_claims) ? evidence.evidence_claims : [];
  if (claims.length) {
    sol.push('## Evidence Claims (verbatim, with evidence disposition)', '');
    sol.push('Each claim carries its byte-verbatim transcript quote and whether the student');
    sol.push('EVIDENCED it (showed/described concretely), merely ASSERTED it, or left it ABSENT.', '');
    claims.forEach((c) => {
      if (!c || typeof c.claim !== 'string') return;
      const disp = (typeof c.evidenced === 'string' && c.evidenced) ? c.evidenced : 'asserted';
      sol.push('- **' + c.claim + '**  _[' + disp + ']_');
      if (typeof c.quote === 'string' && c.quote) {
        sol.push('  ' + mdQuote(c.quote).split('\n').join('\n  '));
      }
    });
    sol.push('');
  }
  const gaps = Array.isArray(evidence.self_identified_gaps) ? evidence.self_identified_gaps.filter((g) => typeof g === 'string' && g.trim()) : [];
  if (gaps.length) {
    sol.push('## Student-Identified Gaps (metacognition - CREDIT, never double-punish)', '');
    sol.push('The student named these gaps in their OWN work. Per the rubric these are a');
    sol.push('strength (self-awareness) to be deepened (HOW to close them), never re-listed as');
    sol.push('discovered deficiencies:', '');
    for (const g of gaps) sol.push('- ' + g.trim());
    sol.push('');
  }
  if (typeof evidence.language_notes === 'string' && evidence.language_notes.trim()) {
    sol.push('## Language Notes (never a content weakness)', '');
    sol.push(evidence.language_notes.trim());
    sol.push('');
    sol.push('Disfluencies, self-corrections, diarization noise, and non-native phrasing are');
    sol.push('recorded here so grading stays language-gentle. They are NEVER graded as content flaws.');
  }
  if (sol.length) {
    renderings.push({ section: 'solution-design', body: sol.join('\n').replace(/\n+$/, '') });
  }

  return renderings;
}

// writeSectionRoomMd - splice a rendered evidence block into a section's ROOM.md,
// preserving the ICM Layer 0 identity header + purpose + starter questions and
// replacing the "Awaiting first content" status tail. Fenced + idempotent. Atomic
// write (tmp + rename). Returns true on success.
function writeSectionRoomMd(roomDir, section, body, subId) {
  const sectionDir = path.join(roomDir, section);
  const roomMdPath = path.join(sectionDir, 'ROOM.md');
  let raw;
  try {
    raw = fs.readFileSync(roomMdPath, 'utf8');
  } catch (_e) {
    // Section ROOM.md absent (production scaffolds it first; be self-sufficient here).
    // Seed a minimal ICM Layer 0 identity + a Status tail the splice below replaces.
    try { fs.mkdirSync(sectionDir, { recursive: true }); } catch (_e2) { return false; }
    raw = [
      '---',
      'section: ' + section,
      'icm_layer: 0',
      'auto_scaffolded: true',
      '---',
      '',
      '# ' + section,
      '',
      '## Status',
      '',
      'Auto-scaffolded. Awaiting first content.',
      '',
    ].join('\n');
  }

  // Strip any prior injected region (idempotent rerun) so we never duplicate.
  const fence = new RegExp('\\n*' + STAGE_A_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + STAGE_A_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n*', 'g');
  let out = raw.replace(fence, '\n');

  // Flip the scaffold flag so a re-scaffold does not treat this as empty.
  out = out.replace(/^auto_scaffolded:\s*true\s*$/m, 'auto_scaffolded: false');

  const region = [
    STAGE_A_BEGIN,
    '',
    body.trim(),
    '',
    '## Status',
    '',
    'Populated by Stage A intake (huji-stage-a-intake) from submission `' + subId + '`.',
    'Every quote above is copied byte-verbatim from the pitch transcript and is a D1',
    'grounding anchor. This section is a normal populated room section; grade it as such.',
    '',
    STAGE_A_END,
    '',
  ].join('\n');

  // Replace from the first "## Status" heading onward (identity header + purpose +
  // starter questions above it are preserved); if no Status heading exists, append.
  const statusIdx = out.indexOf('## Status');
  let finalOut;
  if (statusIdx >= 0) {
    finalOut = out.slice(0, statusIdx).replace(/\s*$/, '\n\n') + region;
  } else {
    finalOut = out.replace(/\s*$/, '\n\n') + region;
  }

  try {
    const tmp = roomMdPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmp, finalOut, 'utf8');
    fs.renameSync(tmp, roomMdPath);
    return true;
  } catch (_e) {
    return false;
  }
}

// renderPitchIntakeArtifact - one consolidated root artifact (file-meeting's
// compact-root-reference pattern), giving the grading spine a single comprehensive,
// provenance-stamped read of the whole extracted pitch. Verbatim quotes throughout.
function renderPitchIntakeArtifact(evidence, subId, renderings) {
  const lines = [
    '---',
    'methodology: huji-stage-a-intake',
    'created: ' + new Date().toISOString().slice(0, 10),
    'source: transcript',
    'submission_id: ' + subId,
    'intake_stage: A',
    'local_only: true',
    '---',
    '',
    '# Pitch Intake: ' + subId,
    '',
    'Deterministic Stage A extraction of one pitch, rendered into this room so the',
    'PWS_grading spine can grade real, quote-anchored content (never an empty scaffold).',
    'All quotes are byte-verbatim from the transcript (D1 anchors); disfluencies preserved.',
    '',
    'Speaker count (human presenters): ' + (typeof evidence.speaker_count === 'number' ? evidence.speaker_count : 'n/a'),
    '',
  ];
  for (const r of renderings) {
    lines.push('<!-- section: ' + r.section + ' -->');
    lines.push(r.body.trim());
    lines.push('');
  }
  return lines.join('\n');
}

// dualWriteMarkdown - the DI-4 markdown half. Renders evidence into section ROOM.md
// files + one root pitch-intake artifact. Returns { sections:[...], artifact, errors }.
function dualWriteMarkdown(roomDir, evidence, subId) {
  const result = { sections: [], artifact: null, errors: [] };
  const renderings = buildSectionRenderings(evidence, subId);
  for (const r of renderings) {
    if (writeSectionRoomMd(roomDir, r.section, r.body, subId)) result.sections.push(r.section);
    else result.errors.push({ section: r.section, reason: 'section_room_md_write_failed' });
  }
  try {
    const artifactPath = path.join(roomDir, 'pitch-intake-' + subId + '.md');
    const tmp = artifactPath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmp, renderPitchIntakeArtifact(evidence, subId, renderings), 'utf8');
    fs.renameSync(tmp, artifactPath);
    result.artifact = artifactPath;
  } catch (e) {
    result.errors.push({ artifact: 'pitch-intake', reason: String(e && e.message || e).slice(0, 80) });
  }
  return result;
}

// --------------------------------------------------------------------------
// populateRoom - the entry point. Opens the scratch room.db, mints one proposed claim
// node per evidence claim, links related claims, extracts wisdom nuggets, AND renders
// the evidence into the section markdown the grading spine reads (DI-4 dual-write).
// Idempotent. Returns { ok, roomDir, sessionId, minted:[node_id...], edges:[edge_id...],
//   nuggets:[...], markdown:{sections,artifact}, errors:[...] }. Never throws on input.
// --------------------------------------------------------------------------
function populateRoom(opts) {
  const { roomDir, evidence, sessionId } = opts || {};
  if (typeof roomDir !== 'string' || roomDir.length === 0) {
    return { ok: false, reason: 'invalid_roomDir' };
  }
  if (!evidence || typeof evidence !== 'object') {
    return { ok: false, reason: 'invalid_evidence' };
  }
  const sid = typeof sessionId === 'string' && sessionId.length > 0
    ? sessionId
    : (typeof evidence.submission_id === 'string' && evidence.submission_id.length > 0
      ? evidence.submission_id
      : 'huji-intake');
  const speaker = evidence.speaker_count === 1 ? 'Speaker 2' : 'presenter';

  const minted = [];
  const edges = [];
  const errors = [];
  const byRole = {}; // role/index -> node_id, for edge wiring

  const db = openRoomDb(roomDir);
  try {
    const specs = buildClaimSpecs(evidence);
    for (const spec of specs) {
      const params = {
        knowledge_type: spec.knowledge_type,
        text: spec.text,
        sessionId: sid,
        sourceSegment: spec.sourceSegment,
        sourceSpeaker: speaker,
        // verbatim quote + evidenced disposition ride the additive extraProps blob
        // (D1 anchor persisted onto the node; protected keys are filtered by the writer).
        extraProps: { quote: spec.quote, evidenced: spec.evidenced, intake_stage: 'A' },
      };
      if (spec.disambiguation) params.disambiguation = spec.disambiguation;

      const res = navigation.writeClaimNode(db, params);
      if (res && res.ok) {
        minted.push(res.node_id);
        const key = spec.role === 'evidence_claim' ? 'evidence:' + spec.index : spec.role;
        byRole[key] = res.node_id;
      } else {
        errors.push({ segment: spec.sourceSegment, reason: res && res.reason });
      }
    }

    // Link related claims (ALLOWED_EDGE_TYPES only). value_proposition RELATED_TO the
    // problem it addresses; each evidence claim SUPPORTS the value proposition. Edges
    // are minted only when BOTH endpoints exist, all born review_status 'proposed'.
    const problemId = byRole.problem_claim;
    const valueId = byRole.value_proposition;
    if (valueId && problemId) {
      const e = navigation.writeEdge(db, {
        source_id: valueId, target_id: problemId, edge_type: 'RELATED_TO', review_status: 'proposed',
      });
      if (e && e.ok) edges.push(e.edge_id); else errors.push({ edge: 'value->problem', reason: e && e.reason });
    }
    if (valueId) {
      for (const key of Object.keys(byRole)) {
        if (key.indexOf('evidence:') !== 0) continue;
        const e = navigation.writeEdge(db, {
          source_id: byRole[key], target_id: valueId, edge_type: 'SUPPORTS', review_status: 'proposed',
        });
        if (e && e.ok) edges.push(e.edge_id); else errors.push({ edge: key + '->value', reason: e && e.reason });
      }
    }

    const nuggets = extractWisdomNuggets(evidence);

    // DI-4 dual-write: also render the evidence into the section markdown the grading
    // spine actually reads (graph half above + markdown half here = "populate the room
    // like file-meeting does", per the CONTEXT.md ruling). Best-effort: a markdown
    // write failure is recorded but never aborts the graph population.
    let markdown = { sections: [], artifact: null, errors: [] };
    try {
      markdown = dualWriteMarkdown(roomDir, evidence, sid);
      for (const e of markdown.errors) errors.push(e);
    } catch (e) {
      errors.push({ markdown: 'dual_write_threw', reason: String(e && e.message || e).slice(0, 100) });
    }

    return { ok: true, roomDir, sessionId: sid, minted, edges, nuggets, markdown, errors };
  } finally {
    try { closeRoomDb(db); } catch (_e) { /* never throw on close */ }
  }
}

// --------------------------------------------------------------------------
// --selftest: scaffold a throwaway room, run populateRoom over a tiny evidence object,
// assert claim nodes exist with review_status='proposed', and that a SECOND run does
// not duplicate them (idempotency). Exits 0 on pass, 1 on failure. No model calls.
// --------------------------------------------------------------------------
function selftest() {
  const assert = require('node:assert');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'huji-intake-selftest-'));
  const roomDir = path.join(tmpRoot, 'scratch-room');
  fs.mkdirSync(roomDir, { recursive: true });
  // A grading-legal scratch STATE.md (Stage: Validation) per AI-SPEC pitfall 3; not
  // strictly needed for the write, but keeps the scratch room shaped like the real one.
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# Scratch Room\n\nStage: Validation\n', 'utf8');

  // A disfluency in a quote (DI-5) that MUST survive verbatim through the dual-write.
  const disfluentQuote = 'handled by vali- validating materials with experts';
  const evidence = {
    submission_id: 'selftest-001',
    problem_claim: { stated: true, quote: 'Food allergies are a big problem around the world.', timestamp: '0:10' },
    value_proposition: { stated: true, quote: 'a tiny device that tests your food right at the table' },
    evidence_claims: [
      { claim: 'uses a smart light sensor', quote: 'The science inside uses smart light sensor.', evidenced: 'asserted' },
      { claim: 'validates materials with experts', quote: disfluentQuote, evidenced: 'evidenced' },
      { claim: 'has FDA approval', quote: '', evidenced: 'absent' },
    ],
    self_identified_gaps: ['deeper market research', 'competitor analysis'],
    speaker_count: 1,
    language_notes: 'Non-native English; minor disfluencies. Not content weaknesses.',
  };

  const r1 = populateRoom({ roomDir, evidence, sessionId: 'selftest-001' });
  assert.strictEqual(r1.ok, true, 'first run must succeed: ' + JSON.stringify(r1));
  assert.strictEqual(r1.errors.length, 0, 'first run must have zero write errors: ' + JSON.stringify(r1.errors));
  // 2 anchors + 3 evidence claims = 5 claim nodes.
  assert.strictEqual(r1.minted.length, 5, 'expected 5 minted claim nodes, got ' + r1.minted.length);
  assert.ok(r1.nuggets.length >= 2, 'expected wisdom nuggets (>=2 gaps), got ' + r1.nuggets.length);
  assert.ok(r1.nuggets.some((n) => n.kind === 'evidenced_strength'), 'expected an evidenced_strength nugget');

  // --- DI-4 dual-write assertions: the section markdown the grading spine reads. ---
  assert.ok(r1.markdown && Array.isArray(r1.markdown.sections), 'populateRoom must return markdown result');
  assert.ok(r1.markdown.sections.includes('problem-definition'), 'problem-definition ROOM.md must be populated');
  assert.ok(r1.markdown.sections.includes('solution-design'), 'solution-design ROOM.md must be populated');
  assert.ok(r1.markdown.artifact && fs.existsSync(r1.markdown.artifact), 'consolidated pitch-intake artifact must exist');

  const problemMd = fs.readFileSync(path.join(roomDir, 'problem-definition', 'ROOM.md'), 'utf8');
  assert.ok(!/Awaiting first content/.test(problemMd), 'problem-definition ROOM.md must no longer read "Awaiting first content"');
  assert.ok(problemMd.includes('Food allergies are a big problem around the world.'), 'problem quote must render verbatim into ROOM.md');
  assert.ok(/auto_scaffolded:\s*false/.test(problemMd), 'auto_scaffolded flag must flip to false');

  const solutionMd = fs.readFileSync(path.join(roomDir, 'solution-design', 'ROOM.md'), 'utf8');
  assert.ok(!/Awaiting first content/.test(solutionMd), 'solution-design ROOM.md must no longer read "Awaiting first content"');
  assert.ok(solutionMd.includes('a tiny device that tests your food right at the table'), 'value prop must render verbatim');
  // DI-5 x DI-4: the disfluency MUST survive byte-verbatim through the render.
  assert.ok(solutionMd.includes(disfluentQuote), 'disfluency "vali- validating" must survive verbatim into ROOM.md');
  assert.ok(solutionMd.includes('deeper market research'), 'self-identified gaps must render (metacognition credit)');

  const artifactMd = fs.readFileSync(r1.markdown.artifact, 'utf8');
  assert.ok(artifactMd.includes(disfluentQuote), 'disfluency must survive verbatim into the root pitch-intake artifact');

  // Assert the nodes exist as type='claim', review_status='proposed'.
  const db = openRoomDb(roomDir);
  let countAfterFirst;
  let proposedCount;
  try {
    countAfterFirst = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='claim'").get().n;
    proposedCount = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='claim' AND review_status='proposed'").get().n;
  } finally {
    closeRoomDb(db);
  }
  assert.strictEqual(countAfterFirst, 5, 'expected 5 claim rows after first run, got ' + countAfterFirst);
  assert.strictEqual(proposedCount, 5, 'all 5 claim nodes must be review_status=proposed, got ' + proposedCount);

  // Second run: idempotent, MUST NOT duplicate.
  const r2 = populateRoom({ roomDir, evidence, sessionId: 'selftest-001' });
  assert.strictEqual(r2.ok, true, 'second run must succeed');
  const db2 = openRoomDb(roomDir);
  let countAfterSecond;
  try {
    countAfterSecond = db2.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type='claim'").get().n;
  } finally {
    closeRoomDb(db2);
  }
  assert.strictEqual(countAfterSecond, 5, 'rerun must not duplicate; expected 5 claim rows, got ' + countAfterSecond);

  // Markdown dual-write must be idempotent too: exactly ONE injected region per section.
  const solutionMd2 = fs.readFileSync(path.join(roomDir, 'solution-design', 'ROOM.md'), 'utf8');
  const beginCount = (solutionMd2.match(/STAGE-A-INTAKE:BEGIN/g) || []).length;
  assert.strictEqual(beginCount, 1, 'rerun must not duplicate the injected markdown region; got ' + beginCount);
  assert.ok(solutionMd2.includes(disfluentQuote), 'disfluency must still be present verbatim after idempotent rerun');

  // Clean up the throwaway room.
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('OK - huji-intake selftest passed: 5 proposed claim nodes, idempotent rerun, nuggets extracted, DI-4 dual-write into section ROOM.md + disfluency verbatim');
}

if (require.main === module) {
  if (process.argv.includes('--selftest')) {
    try {
      selftest();
      process.exit(0);
    } catch (e) {
      console.error('SELFTEST FAILED:', e && e.message ? e.message : e);
      process.exit(1);
    }
  } else {
    console.log('Usage: node scripts/huji-intake.cjs --selftest');
    console.log('  (populateRoom is consumed programmatically by the Stage A intake driver.)');
    process.exit(0);
  }
}

module.exports = {
  populateRoom,
  extractWisdomNuggets,
  buildClaimSpecs,
  knowledgeTypeForEvidence,
  buildSectionRenderings,
  dualWriteMarkdown,
  renderPitchIntakeArtifact,
};
