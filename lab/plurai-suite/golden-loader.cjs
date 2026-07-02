'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-09 (scope item 9, Task 2) -- the GOLDEN-DATA LOADER.
 * Exports loadGolden(sourcePath): parses Lawrence's Test-6 analysis into the
 * horizontal-elevation judge's GROUND-TRUTH golden set. This is the validation
 * set the judge MUST classify correctly.
 *
 * ============================================================================
 * DEVIATION 1 (navigator-approved 2026-07-01) -- NO RAW TRANSCRIPT; SYNTHETIC
 * RECONCILIATION. The plan assumed a raw Test-6 CONVERSATION transcript. That
 * transcript is CONFIRMED GONE (not recoverable). What we DO have is Lawrence's
 * ANALYSIS, which contains the five real misses verbatim (under the header
 * "Five missed elevations - all cross-frame connections") plus the "should have
 * said" target lines and the presumptuous "punchline" quip.
 *
 *   GROUND-TRUTH ANCHOR (real, human-observed, NEVER synthetic):
 *     - the 5 real misses            -> label "No Connection"
 *     - the 2 real should-have-said  -> label "Hedged"   (THE TARGET)
 *     - the "punchline" quip         -> label "Presumptuous" (negative exemplar)
 *   parsed from lab/plurai-suite/golden/test-6-source.md.
 *
 *   SYNTHETIC COVERAGE (clearly marked synthetic, Part-8 clean) is a SEPARATE,
 *   documented seam -- the "Bruce harness" -- to GENERATE additional cross-frame
 *   scenarios for breadth. Those are TEST INPUTS, generated, never passed off as
 *   real observed records. Defaulted OFF; not fired in this build.
 *
 * The no-fabrication rule STILL HOLDS and is the whole point: we NEVER
 * manufacture fake "observed" golden records. The 5 real misses are the tether.
 * If the golden source file is ABSENT, loadGolden returns a marked-pending
 * result and uploads NOTHING (does not synthesize ground truth).
 * ============================================================================
 *
 * DEVIATION 2 (navigator-approved) -- CORRECTED LABEL SCHEMA. The horizontal
 * ladder is [No Connection / Hedged / Presumptuous], NOT [.../Confident].
 * "Confident" was a mislabel: hedged is the target; overclaiming is a failure
 * mode. See judges.cjs.
 *
 * NO LIVE MUTATION. loadGolden PARSES and returns records ready for upload; it
 * does NOT fire the evals-MCP upload_data path. The actual live re-seed/upload
 * of the seeded judge threads is a DELIBERATE navigator follow-up.
 *
 * LAB-SIDE ONLY. Under lab/, never lib/, never shipped, no Python on the user
 * machine. Part 8: generic doctrine only, no user data.
 *
 * House rule: hyphens only, no em-dashes. CJS. Read-only, LOCAL (Part 8).
 */

const fs = require('node:fs');
const { JUDGE_BY_ID } = require('./judges.cjs');

const HORIZONTAL_JUDGE = JUDGE_BY_ID['horizontal-elevation'];
const HORIZONTAL_THREAD = HORIZONTAL_JUDGE.thread_id;

/*
 * Optimize LLM/SLM seam (DEVIATION-neutral, plan Task 2). The Optimize decision
 * -- LLM (diagnostic-accuracy first) vs SLM (deployable runtime guardrail) -- is
 * PENDING the Bruce harness. This is a config seam, NOT a hard-coded pick.
 */
const OPTIMIZE_MODE = 'pending'; // one of: 'pending' | 'llm' | 'slm' (do not hard-code)

/*
 * Deterministic parser over Lawrence's analysis. Operates ONLY on the first
 * clean copy of the analysis (the source file quotes the email several times).
 * We bound the region from the first "Five missed elevations" header to the
 * first "Cumulative Findings" header, so the numbered misses, the should-have
 * lines (incl. the Mediterranean line in "New Principles"), and the punchline
 * quip all come from ONE authoritative pass.
 */
function parseAnchor(text) {
  const startIdx = text.search(/Five missed elevations/i);
  if (startIdx === -1) {
    throw new Error('golden anchor parse: "Five missed elevations" header not found');
  }
  const afterStart = text.slice(startIdx);
  const cumIdx = afterStart.search(/Cumulative Findings/i);
  const region = cumIdx === -1 ? afterStart : afterStart.slice(0, cumIdx);

  // The 5 real misses: numbered "N. **Title.** body" items. Take the first 5.
  const misses = [];
  const missRe = /^\s*>?\s*(\d+)\.\s+\*\*(.+?)\*\*\s*(.*)$/gm;
  let m;
  while ((m = missRe.exec(region)) !== null) {
    if (misses.length >= 5) break;
    misses.push({
      n: Number(m[1]),
      title: m[2].trim(),
      body: m[3].trim(),
    });
  }
  if (misses.length !== 5) {
    throw new Error(`golden anchor parse: expected 5 misses, found ${misses.length}`);
  }

  // The 2 real should-have-said target lines (quoted text after "should have").
  const shoulds = [];
  const shouldRe = /should have[^"]*"([^"]+)"/gi;
  let s;
  while ((s = shouldRe.exec(region)) !== null) {
    if (shoulds.length >= 2) break;
    shoulds.push(s[1].trim());
  }
  if (shoulds.length !== 2) {
    throw new Error(`golden anchor parse: expected 2 should-have-said lines, found ${shoulds.length}`);
  }

  // The presumptuous exemplar: the "punchline" quip (first quoted punchline line).
  const quipMatch = region.match(/"([^"]*punchline[^"]*)"/i);
  if (!quipMatch) {
    throw new Error('golden anchor parse: presumptuous "punchline" quip not found');
  }
  const quip = quipMatch[1].trim();

  return { misses, shoulds, quip };
}

/*
 * Build the GROUND-TRUTH golden records from the parsed anchor. Every record is
 * source:'real' and anchor:true -- these are human-observed, never synthesized.
 */
function buildRecords(anchor) {
  const records = [];

  anchor.misses.forEach((miss, i) => {
    records.push(Object.freeze({
      id: `real-miss-${miss.n}`,
      sample: `${miss.title} ${miss.body}`.trim(),
      label: 'No Connection',
      source: 'real',
      anchor: true,
      note: 'Test 6 cross-frame miss (Larry never connected the frames).',
    }));
    void i;
  });

  anchor.shoulds.forEach((line, i) => {
    records.push(Object.freeze({
      id: `real-should-${i + 1}`,
      sample: line,
      label: 'Hedged',
      source: 'real',
      anchor: true,
      note: 'The should-have-said target: connection made, offered tentatively, evidence-backed.',
    }));
  });

  records.push(Object.freeze({
    id: 'real-quip-presumptuous',
    sample: anchor.quip,
    label: 'Presumptuous',
    source: 'real',
    anchor: true,
    note: 'The "punchline" quip: connection made but overclaimed / presumptuous (negative exemplar).',
  }));

  return Object.freeze(records);
}

/*
 * loadGolden(sourcePath): parse the REAL Test-6 analysis into the horizontal
 * judge golden set. Refuses to fabricate: if the source is absent, returns a
 * marked-pending result and uploads NOTHING (uploads:0, fabricated:0).
 *
 * NO live evals-MCP mutation is fired here (uploaded:false, uploads:0). The
 * records are RETURNED ready for the navigator follow-up upload.
 */
function loadGolden(sourcePath) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    // Refuse to fabricate ground truth. Upload nothing. Synthesize nothing.
    return Object.freeze({
      status: 'pending',
      judge_id: HORIZONTAL_THREAD,
      judge: 'horizontal-elevation',
      source_path: sourcePath || null,
      records: Object.freeze([]),
      uploads: 0,
      uploaded: false,
      fabricated: 0,
      reason: 'golden source absent; refusing to fabricate ground truth (no records synthesized, nothing uploaded).',
    });
  }

  const text = fs.readFileSync(sourcePath, 'utf8');
  const anchor = parseAnchor(text);
  const records = buildRecords(anchor);

  const counts = records.reduce((acc, r) => {
    acc[r.label] = (acc[r.label] || 0) + 1;
    return acc;
  }, Object.create(null));

  return Object.freeze({
    status: 'loaded',
    judge_id: HORIZONTAL_THREAD,
    judge: 'horizontal-elevation',
    labels: HORIZONTAL_JUDGE.labels,
    source_path: sourcePath,
    records,
    counts: Object.freeze(counts),
    // NO live mutation here: records are ready to upload, but upload is the
    // navigator follow-up. loadGolden fires nothing.
    uploads: 0,
    uploaded: false,
    fabricated: 0,
    reason: 'parsed the real Test-6 analysis; records ready for the navigator upload follow-up.',
  });
}

/*
 * SYNTHETIC COVERAGE SEAM -- the "Bruce harness" (DEVIATION 1). Documented seam
 * that WOULD call the evals-MCP to GENERATE additional cross-frame scenarios for
 * breadth. Defaulted OFF and NOT fired in this build. Generated records are
 * ALWAYS marked source:'synthetic', generated:true -- never passed off as real.
 *
 * Never fabricates a "real" observed record. With no live client bound (the
 * default), returns a marked-pending result and generates nothing.
 */
function generateSyntheticCoverage(opts = {}) {
  const enabled = opts.enabled === true;
  const client = opts.evalsMcpClient || null;

  if (!enabled || !client) {
    return Object.freeze({
      status: 'pending',
      fired: false,
      generated: 0,
      records: Object.freeze([]),
      reason: enabled
        ? 'no live evals-MCP client bound; synthetic coverage is a navigator follow-up (not fired).'
        : 'synthetic coverage seam is OFF by default (enabled !== true); nothing generated.',
    });
  }

  // If a navigator ever wires a live client, generated records MUST be tagged
  // synthetic. This build never reaches here (no client is bound).
  throw new Error(
    'generateSyntheticCoverage: live synthetic generation is a deliberate navigator '
    + 'follow-up and is intentionally not fired in this build.'
  );
}

module.exports = Object.freeze({
  OPTIMIZE_MODE,
  HORIZONTAL_THREAD,
  loadGolden,
  generateSyntheticCoverage,
  // exported for the test to exercise the parser directly
  _parseAnchor: parseAnchor,
});
