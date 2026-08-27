#!/usr/bin/env node
'use strict';
/*
 * Phase 265-13 Task 3 -- test-265-declaration-truth.cjs
 *
 * A plain Node tripwire over every commands/*.md that pins the three
 * declaration-defect classes this plan fixed, so none of the three can
 * silently regress:
 *
 *   ARM 1 (PLACEHOLDER)        -- zero unfilled [methodology] placeholders,
 *                                  zero bracket-inside-slash-command strings,
 *                                  every /mos:<name> referenced anywhere in
 *                                  commands/ resolves to an existing
 *                                  commands/<name>.md.
 *   ARM 2 (WEB_SCOPE)          -- a heuristic (declared and self-limiting):
 *                                  a command declaring connector.web_scope:
 *                                  null does not name a known web-fetch
 *                                  symbol in a fire instruction.
 *   ARM 3 (REQUIRES_EVIDENCE)  -- every requires_evidence: block is
 *                                  well-formed and points at a declared
 *                                  emits_evidence_claims: true producer;
 *                                  at least four consumers exist.
 *
 * Print pass/fail counts per arm. process.exit(1) on any failure.
 * No em-dashes. No external deps. Pure CJS.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');

function readCommandFiles() {
  return fs
    .readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

// ---------------------------------------------------------------------------
// ARM 1: PLACEHOLDER ARM
// ---------------------------------------------------------------------------

// Pre-existing name/filename mismatches and illustrative-prose placeholders
// that predate Phase 265-13 and are OUT OF SCOPE for this plan (a repo-wide
// resolver-vs-reality cleanup, not a declaration-truth defect this plan
// introduced or is responsible for). Each entry is a bare command NAME (the
// text after "/mos:"), documented with the file(s) it was found in at the
// time this allowlist was authored (2026, Phase 265-13). Removing an entry
// here because the underlying file now resolves is always safe; adding a
// NEW entry to hide a genuine regression is not the intent of this list and
// should not happen silently -- any addition should be reviewed.
const ARM1_KNOWN_PRE_EXISTING_UNRESOLVED = new Set([
  'x', // act.md:289, onboard.md -- illustrative prose ("/mos:x for <framework>", "Run /mos:X"), not a real invocation
  'X', // onboard.md -- same illustrative-prose pattern, capitalized
  'firing-block', // the <!-- mos:firing-block --> HTML comment sentinel token shipped repo-wide, never a slash-command
  'command', // generic error-pattern template text ("Fix: /mos:command") across many commands, not a real name
  'fingerprint', // diagnostics.md documents an in-progress v1.14.0 rename to /mos:fingerprint; commands/fingerprint.md does not exist yet
  'reason', // mos-reason.md documents itself as "/mos:reason" in prose while its resolver name: is "mos-reason" (pre-existing name/file mismatch)
  'feynman', // mos-reason.md references the separate human-facing "/mos:feynman" workflow, which is not a shipped command file
  'profile-user', // new-project.md / onboard.md reference the deferred "/mos:profile-user" command, not yet built
  'open', // room.md's illustrative UI mockup line ("mos:open domain-exploration"), not a real invocation
  'validate-proposition', // value-proposition.md's OWN documented name/file mismatch (RETRO-05, audit item 39) -- resolver name is validate-proposition, file is value-proposition.md
]);

function armPlaceholder(files) {
  const result = { arm: 'PLACEHOLDER', pass: 0, fail: 0, failures: [] };

  for (const file of files) {
    const full = path.join(COMMANDS_DIR, file);
    const text = fs.readFileSync(full, 'utf8');

    // 1. Zero literal [methodology] occurrences.
    const methodologyRe = /\[methodology\]/g;
    let m;
    let sawMethodology = false;
    while ((m = methodologyRe.exec(text))) {
      sawMethodology = true;
      result.failures.push(
        file + ':' + lineNumberAt(text, m.index) + ' -- unfilled [methodology] placeholder'
      );
    }
    if (sawMethodology) result.fail++;
    else result.pass++;

    // 2. Zero bracket-inside-slash-command strings ("/mos:[").
    const bracketRe = /\/mos:\[/g;
    let sawBracket = false;
    while ((m = bracketRe.exec(text))) {
      sawBracket = true;
      result.failures.push(
        file + ':' + lineNumberAt(text, m.index) + ' -- "/mos:[" bracket inside a slash-command string'
      );
    }
    if (sawBracket) result.fail++;
    else result.pass++;
  }

  // 3. Every /mos:<name> referenced anywhere in commands/ resolves to an
  //    existing commands/<name>.md, except the documented pre-existing
  //    allowlist above.
  const referenceRe = /\/mos:([a-zA-Z][a-zA-Z0-9_-]*)/g;
  let sawUnresolved = false;
  for (const file of files) {
    const full = path.join(COMMANDS_DIR, file);
    const text = fs.readFileSync(full, 'utf8');
    let m;
    while ((m = referenceRe.exec(text))) {
      const name = m[1];
      const target = path.join(COMMANDS_DIR, name + '.md');
      if (!fs.existsSync(target) && !ARM1_KNOWN_PRE_EXISTING_UNRESOLVED.has(name)) {
        sawUnresolved = true;
        result.failures.push(
          file + ':' + lineNumberAt(text, m.index) + ' -- /mos:' + name + ' does not resolve to commands/' + name + '.md'
        );
      }
    }
  }
  if (sawUnresolved) result.fail++;
  else result.pass++;

  return result;
}

// ---------------------------------------------------------------------------
// ARM 2: WEB_SCOPE ARM
//
// HEURISTIC, NOT PROOF: this catches the declaration-versus-reality class
// (a command whose BODY instructs Larry to fire a known web-fetch symbol
// while its frontmatter declares web_scope: null). It does NOT prove absence
// of reach -- a command could still reach the web through a helper module
// this arm has no visibility into (this is exactly the class of gap Task 2
// found and fixed for /mos:futures, and exactly the class Task 2's sweep
// flagged unfixed for /mos:ignite as an honest, recorded finding). Treat a
// PASS here as "no obvious contradiction found", never as "proven safe".
// ---------------------------------------------------------------------------

const WEB_FETCH_FIRE_SYMBOLS = [
  'fetchCorpus',
  'seedGrounding',
  'perRingResearch',
  'tavily-search',
  'WebSearch',
];

function extractConnectorBlock(text) {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const connectorMatch = fm.match(/\nconnector:\n([\s\S]*?)(\n[a-zA-Z_-]+:|$)/);
  return connectorMatch ? connectorMatch[1] : null;
}

function declaresWebScopeNull(text) {
  const block = extractConnectorBlock(text);
  if (!block) return false;
  return /\bweb_scope:\s*null\b/.test(block);
}

function armWebScope(files) {
  const result = { arm: 'WEB_SCOPE', pass: 0, fail: 0, failures: [] };

  for (const file of files) {
    const full = path.join(COMMANDS_DIR, file);
    const text = fs.readFileSync(full, 'utf8');
    if (!declaresWebScopeNull(text)) continue;

    // Strip the frontmatter block before scanning the body for fire
    // instructions -- a frontmatter comment mentioning a symbol name (as
    // this very file's own YAML comments do, and as commands/futures.md's
    // corrective comment now does for the OPPOSITE case) is not a fire
    // instruction.
    const bodyStart = text.indexOf('\n---', 4);
    const body = bodyStart >= 0 ? text.slice(bodyStart + 4) : text;

    const named = WEB_FETCH_FIRE_SYMBOLS.filter((sym) => body.includes(sym));
    if (named.length > 0) {
      result.fail++;
      result.failures.push(
        file +
          ' declares connector.web_scope: null but its body names ' +
          named.join(', ') +
          ' (heuristic: this catches the declaration-versus-reality class, ' +
          'it does not prove absence of reach -- verify the fetch path by ' +
          'hand before trusting this arm alone)'
      );
    } else {
      result.pass++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// ARM 3: REQUIRES_EVIDENCE ARM
// ---------------------------------------------------------------------------

function extractRequiresEvidenceBlock(text) {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const reMatch = fm.match(/\nrequires_evidence:\n([\s\S]*?)(\n[a-zA-Z_-]+:|$)/);
  return reMatch ? reMatch[1] : null;
}

function declaresEmitsEvidenceClaims(text) {
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return false;
  return /\bemits_evidence_claims:\s*true\b/.test(fmMatch[1]);
}

function armRequiresEvidence(files) {
  const result = { arm: 'REQUIRES_EVIDENCE', pass: 0, fail: 0, failures: [] };
  let consumerCount = 0;

  for (const file of files) {
    const full = path.join(COMMANDS_DIR, file);
    const text = fs.readFileSync(full, 'utf8');
    const block = extractRequiresEvidenceBlock(text);
    if (block === null) continue;

    const tierMatch = block.match(/^\s*tier:\s*(\S+)/m);
    const onMatch = block.match(/^\s*on:\s*\[([^\]]*)\]/m);
    const dispatchMatch = block.match(/^\s*dispatch:\s*(\S+)/m);

    const hasTier = !!tierMatch;
    const hasOn = !!onMatch;
    const onArray = onMatch
      ? onMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const onNonEmpty = hasOn && onArray.length > 0;
    const hasDispatch = !!dispatchMatch;

    if (!hasTier || !onNonEmpty || !hasDispatch) {
      result.fail++;
      result.failures.push(
        file +
          ' -- malformed requires_evidence block (tier present: ' +
          hasTier +
          ', on non-empty: ' +
          onNonEmpty +
          ', dispatch present: ' +
          hasDispatch +
          ')'
      );
      continue;
    }

    const dispatchName = dispatchMatch[1].replace(/^\/mos:/, '');
    const dispatchFile = path.join(COMMANDS_DIR, dispatchName + '.md');
    if (!fs.existsSync(dispatchFile)) {
      result.fail++;
      result.failures.push(
        file + ' -- dispatch target ' + dispatchMatch[1] + ' does not resolve to an existing command file'
      );
      continue;
    }

    const dispatchText = fs.readFileSync(dispatchFile, 'utf8');
    if (!declaresEmitsEvidenceClaims(dispatchText)) {
      result.fail++;
      result.failures.push(
        file +
          ' -- dispatch target ' +
          dispatchMatch[1] +
          ' does not declare emits_evidence_claims: true (the reciprocal producer contract)'
      );
      continue;
    }

    result.pass++;
    consumerCount++;
  }

  if (consumerCount < 4) {
    result.fail++;
    result.failures.push(
      'only ' + consumerCount + ' requires_evidence consumer(s) found; the contract must not silently return to zero use (need >= 4)'
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const files = readCommandFiles();
  const arms = [armPlaceholder(files), armWebScope(files), armRequiresEvidence(files)];

  let anyFail = false;
  for (const arm of arms) {
    console.log('--- ARM: ' + arm.arm + ' ---');
    console.log('  pass: ' + arm.pass + '  fail: ' + arm.fail);
    for (const f of arm.failures) console.log('  FAIL: ' + f);
    if (arm.fail > 0) anyFail = true;
    console.log('');
  }

  if (anyFail) {
    console.error('test-265-declaration-truth: FAILED (one or more arms reported a failure)');
    process.exit(1);
  }
  console.log('test-265-declaration-truth: PASSED (all three arms clean)');
  process.exit(0);
}

main();
