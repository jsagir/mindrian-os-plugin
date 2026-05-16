#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 119-01 -- Retroactive room-naming F.1 selector CLI shim.
 * REVISION 2026-05-16: full-duplex via the directive-file/INSTRUCTION-FOR-LARRY
 * pattern. Honors D-03 (retroactive naming) + D-06 (four F.1 options) at execution.
 *
 * Invocation (post-Phase 118 MVA completion, fired from mva-orchestrator's
 * phase-119-01-naming-selector-hook block):
 *   node scripts/room-naming-selector.cjs --room-dir <abs_path> [--sentence-sha256 <sha>]
 *
 * Operational flow (the directive-file handoff -- precedent: auto-explore-drain.cjs
 * + preflight-tension-surface.cjs):
 *   1. Resolve the placeholder slug from the room-dir path.basename.
 *   2. Read the Phase 117 auto-explore finding from <roomDir>/.mindrian/auto-explore-*.json.
 *   3. Read the Phase 118 MVA brief sentence from <roomDir>/.mindrian/mva-brief.json.
 *   4. Call llm-name-suggester.cjs::suggestRoomName (async; one-shot Haiku 4.5; LOCAL-only).
 *   5. Build the four F.1 verbs with the interpolated [name this room: <slug>] label.
 *   6. Read thinness flag from STATE.md frontmatter; if true, prepend Larry voice line.
 *   7. WRITE a directive file at <roomDir>/.context/pending-naming-decision.md with the
 *      INSTRUCTION FOR LARRY directive.
 *   8. Exit 0.
 *
 * Per CLAUDE.md tri-polar HARD RULE: the same directive-file contract renders across
 *   - CLI:     Larry reads the directive, dispatches AskUserQuestion with the 4 verbs,
 *              gets the user's pick, calls lib/core/room-naming-selector.cjs::fireNamingSelector
 *              with userPick + suggestedName (the IN-path closes the duplex).
 *   - Desktop: Larry paraphrases the envelope conversationally; same directive carries
 *              the same envelope JSON; Larry's render layer chooses the surface format.
 *   - Cowork:  shared-state choice point; directive lands in the shared <roomDir>/.context/;
 *              first-responder collaborator's AskUserQuestion answer wins; decided_by
 *              sourced from process.env.USER on the first machine to respond, logged in
 *              the room_naming_decided memory_event payload.
 *
 * Canon Part 3: F.1 is the tri-context Decision Gate primitive.
 * Canon Part 8: LOCAL only; api.anthropic.com is the LLM transport (not the Brain MCP).
 * Canon Part 9: room_naming_decided memory_event lands when Larry calls fireNamingSelector
 *   with the user's pick -- ALL writes through navigation.cjs.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs() {
  const args = process.argv.slice(2);
  let roomDir = null;
  let sentenceSha256 = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--room-dir' && i + 1 < args.length) { roomDir = args[i + 1]; }
    if (args[i] === '--sentence-sha256' && i + 1 < args.length) { sentenceSha256 = args[i + 1]; }
  }
  return { roomDir, sentenceSha256 };
}

function readAutoExploreFinding(roomDir) {
  try {
    const dir = path.join(roomDir, '.mindrian');
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter(function (f) { return f.indexOf('auto-explore-') === 0 && f.endsWith('.json'); });
    if (files.length === 0) return null;
    let newest = null; let newestMtime = 0;
    for (const f of files) {
      const stat = fs.statSync(path.join(dir, f));
      if (stat.mtimeMs > newestMtime) { newestMtime = stat.mtimeMs; newest = f; }
    }
    return JSON.parse(fs.readFileSync(path.join(dir, newest), 'utf8'));
  } catch (_e) { return null; }
}

function readMvaBriefSentence(roomDir) {
  try {
    const briefPath = path.join(roomDir, '.mindrian', 'mva-brief.json');
    if (!fs.existsSync(briefPath)) return '';
    const j = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
    return (j && typeof j.sentence === 'string') ? j.sentence : '';
  } catch (_e) { return ''; }
}

function atomicWrite(filePath, content) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o755 });
    const tmp = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, filePath);
    return true;
  } catch (_e) { return false; }
}

async function main() {
  const { roomDir } = parseArgs();
  if (!roomDir) {
    process.stdout.write(JSON.stringify({ shape: 'F.1', surface: false, reason: 'no_room_dir_arg' }) + '\n');
    process.exit(0);
  }
  const absRoomDir = path.resolve(roomDir);
  if (!fs.existsSync(absRoomDir)) {
    process.stdout.write(JSON.stringify({ shape: 'F.1', surface: false, reason: 'room_dir_not_found' }) + '\n');
    process.exit(0);
  }

  try {
    const placeholderSlug = path.basename(absRoomDir);

    // Step 4: LLM-suggest a name (graceful degradation on error -> 'untitled').
    const suggester = require('../lib/core/llm-name-suggester.cjs');
    const autoExploreFinding = readAutoExploreFinding(absRoomDir);
    const mvaBriefSentence = readMvaBriefSentence(absRoomDir);
    const suggestion = await suggester.suggestRoomName({
      auto_explore_finding: autoExploreFinding,
      mva_brief_sentence: mvaBriefSentence,
    });
    const suggestedName = (suggestion && suggestion.suggested_name) || suggester.FALLBACK_SUGGESTION;

    // Step 5-7: build the F.1 verbs + the INSTRUCTION FOR LARRY directive file.
    const naming = require('../lib/core/room-naming-selector.cjs');
    const llmLabel = naming.interpolateLlmSuggested(suggestedName);
    const verbs = [
      llmLabel,
      naming.F1_OPTION_LABELS.USER_TYPED,
      naming.F1_OPTION_LABELS.KEEP_UNTITLED,
      naming.F1_OPTION_LABELS.DISCARD,
    ];

    // Thinness prepend (D-05; voice line LOCKED verbatim).
    const isThin = naming.readThinnessFromState(absRoomDir);
    let voiceLine = null;
    if (isThin) {
      try {
        const tha = require('../lib/core/larry-thinness-acknowledgment.cjs');
        voiceLine = tha.voiceLine();
      } catch (_e) { voiceLine = null; }
    }

    // Compose the directive file. Precedent: auto-explore-drain.cjs composeDirective.
    const lines = [
      'PENDING ROOM-NAMING DECISION (Phase 119-01; v1.13.0 closed loop):',
      '',
      'A placeholder room was created when you uploaded material. The 30-second MVA brief is',
      'ready. Time to name the room (or discard it).',
      '',
    ];
    if (voiceLine) {
      lines.push(voiceLine);
      lines.push('');
    }
    lines.push('Placeholder slug: ' + placeholderSlug);
    lines.push('Suggested name: ' + suggestedName);
    lines.push('');
    lines.push('OPTIONS:');
    for (let i = 0; i < verbs.length; i++) {
      lines.push('  ' + (i + 1) + '. ' + verbs[i]);
    }
    lines.push('');
    lines.push('[AskUserQuestion contract: shape=F.1 verbs=' + verbs.length + ']');
    lines.push('');
    lines.push('INSTRUCTION FOR LARRY: At this turn, render the placeholder + suggested name');
    lines.push('above (and the thinness voice line if present) verbatim, then dispatch the F.1');
    lines.push('Next Move selector via AskUserQuestion with the four verbs above. When the user');
    lines.push("picks an option, call lib/core/room-naming-selector.cjs::fireNamingSelector with");
    lines.push('the placeholder slug + the user-pick verb + the suggested name; the orchestrator');
    lines.push('handles rename / discard / no-op + emits the room_naming_decided memory_event.');
    lines.push('Delete this directive file after the user has resolved the selector.');
    const directive = lines.join('\n');

    const directivePath = path.join(absRoomDir, '.context', 'pending-naming-decision.md');
    const ok = atomicWrite(directivePath, directive);
    if (!ok) {
      process.stdout.write(JSON.stringify({ shape: 'F.1', surface: false, reason: 'directive_write_failed' }) + '\n');
      process.exit(0);
    }

    // Telemetry-style summary on stdout. The envelope contains the four labels
    // verbatim so the Phase 118 hook can log + integration tests can grep.
    process.stdout.write(JSON.stringify({
      shape: 'F.1',
      surface: process.env.MINDRIAN_SURFACE || 'cli',
      phase: '119-01',
      placeholder_slug: placeholderSlug,
      suggested_name: suggestedName,
      directive_path: directivePath,
      thinness_prepended: !!voiceLine,
      awaiting_input: true,
      envelope: {
        verbs: verbs,
      },
    }) + '\n');
    process.exit(0);
  } catch (e) {
    process.stdout.write(JSON.stringify({ shape: 'F.1', surface: false, reason: 'orchestrator_error:' + String(e.message || e).slice(0, 60) }) + '\n');
    process.exit(0);
  }
}

process.on('uncaughtException', function () {
  process.stdout.write(JSON.stringify({ shape: 'F.1', surface: false, reason: 'uncaught' }) + '\n');
  process.exit(0);
});

main();
