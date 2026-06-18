/**
 * MindrianOS Plugin -- Stage 7 mitigation / innovation roadmap generator
 * (Phase 163, Wave 5 SURFACE-B).
 *
 * Stage 7 is the NET-NEW output section the 7-stage Visionary Innovation
 * Companion spec adds beyond /mos:explore-trends's 6 stages. For each banked
 * opportunity surfaced by the trend pipeline (the absurd-extrapolation rings),
 * Stage 7:
 *
 *   1. CLASSIFIES the opportunity into the UDP / IDP / WDP problem-type taxonomy
 *      (the /mos:diagnose vocabulary; the same closed enum the Phase 91-07
 *      problem-type-router and the futures FORESIGHT_WEB_PARTNERS diagnose handle
 *      use). UDP = Undefined Problem (low definition clarity), IDP = Ill-Defined
 *      Problem (mid), WDP = Well-Defined Problem (high clarity + high confidence).
 *
 *   2. Emits a mitigation / innovation ROADMAP per opportunity:
 *        mitigation_steps  -- how to DEFEND against the absurd-trend risk.
 *        innovation_steps  -- how to SEIZE the disruptive opportunity.
 *      Each step carries an evidence tier (Canon Part 5). A step that asserts a
 *      venture truth is a truth-claim and lands review_status 'proposed' -- never
 *      auto-confirmed (Canon Part 9 role 5; only a human byUser promotes a
 *      truth-claim to confirmed).
 *
 *   3. Files the roadmap as a NESTED Obsidian artifact under
 *      opportunity-bank/trending-to-absurd-<seed>/stage7-roadmap/ WITH an ICM
 *      Layer 0 ROOM.md per folder (CLAUDE.md decisions 15 + 16), reusing the
 *      futures folder discipline (exclusive ownership of opportunity-bank/;
 *      threat T-163-13 -- no write escapes opportunity-bank/).
 *
 * Canon Part 8: ZERO Brain egress. Pure LOCAL generation + file write. The
 *   problem-type classification is a LOCAL scalar heuristic over the opportunity
 *   object; no Brain call, no network.
 * Canon Part 9: nothing is confirmed by the generator. Truth-claim steps stay
 *   proposed; the on-disk artifact records review_status: proposed.
 *
 * Defensive: an empty / null opportunity set returns an empty roadmap and files
 *   nothing -- never throws.
 *
 * Pure Node.js built-ins only (zero npm deps). NO em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Part 7 reuse: slugify rides the futures harness (the SAME slug discipline the
// trend orchestrator's exclusive-ownership filing uses).
const futures = require('../futures/orchestrator.cjs');
const { slugify } = futures;

// The exclusive seed-folder prefix this harness owns under opportunity-bank/.
// Mirrors the TTA orchestrator's TTA_SEED_PREFIX (Wave 4) so the Stage 7 roadmap
// lands in the SAME owned subtree as the trend artifacts it summarizes.
const TTA_SEED_PREFIX = 'trending-to-absurd';
const STAGE7_FOLDER = 'stage7-roadmap';

// The closed UDP / IDP / WDP problem-type taxonomy (the /mos:diagnose vocabulary;
// the SAME enum the Phase 91-07 problem-type-router uses). Frozen; never minted
// anew here.
const PROBLEM_TYPES = Object.freeze(['UDP', 'IDP', 'WDP']);

// Evidence tiers (Canon Part 5). A roadmap step carries one of these. The default
// for a generated step is 'practitioner' (a pattern, not yet measured); a step
// asserting a venture truth is flagged truth_claim and stays proposed.
const EVIDENCE_TIERS = Object.freeze(['academic', 'operational', 'practitioner', 'none']);

/**
 * classifyProblemType -- map an opportunity to UDP / IDP / WDP using a LOCAL
 * scalar heuristic (Part 8: no Brain call). The signal is the opportunity's
 * definition clarity (when present) plus its confidence:
 *   - low clarity (or no clarity signal + low confidence)  -> UDP (undefined)
 *   - high clarity AND high confidence                     -> WDP (well-defined)
 *   - everything in between                                -> IDP (ill-defined)
 *
 * @param {Object} opp - the opportunity object
 * @returns {string} one of PROBLEM_TYPES
 */
function classifyProblemType(opp) {
  if (!opp || typeof opp !== 'object') return 'IDP';
  const clarity = typeof opp.definition_clarity === 'string'
    ? opp.definition_clarity.toLowerCase()
    : null;
  const confidence = Number.isFinite(opp.confidence) ? opp.confidence : 0.5;

  if (clarity === 'low') return 'UDP';
  if (clarity === 'high' && confidence >= 0.7) return 'WDP';
  if (clarity === 'high') return 'IDP';
  if (clarity === 'medium' || clarity === 'mid') return 'IDP';
  // No explicit clarity signal: fall back to confidence bands.
  if (confidence < 0.35) return 'UDP';
  if (confidence >= 0.75) return 'WDP';
  return 'IDP';
}

/**
 * buildMitigationSteps -- how to DEFEND against the absurd-trend risk this
 * opportunity exposes. Each step carries an evidence tier (Part 5). The first
 * mitigation step asserts a venture truth (the risk is real for THIS venture),
 * so it is flagged truth_claim and lands proposed (Part 9).
 *
 * @param {Object} opp - the opportunity object
 * @param {string} problemType - the UDP / IDP / WDP classification
 * @returns {Array<Object>} mitigation steps
 */
function buildMitigationSteps(opp, problemType) {
  const domain = (opp && typeof opp.domain === 'string') ? opp.domain : 'the domain';
  return [
    {
      step: 'Name the absurd-trend risk this opportunity exposes in ' + domain
        + ' and record it as a tracked assumption.',
      kind: 'mitigation',
      evidence_tier: 'practitioner',
      // Asserting the risk is REAL for this venture is a venture-truth claim.
      truth_claim: true,
      review_status: 'proposed',
    },
    {
      step: 'Define the early-warning signal that would show the ' + problemType
        + ' framing is wrong, and the defensive move it triggers.',
      kind: 'mitigation',
      evidence_tier: 'practitioner',
      truth_claim: false,
      review_status: 'proposed',
    },
  ];
}

/**
 * buildInnovationSteps -- how to SEIZE the disruptive opportunity. Each step
 * carries an evidence tier (Part 5). All innovation steps land proposed (Part 9):
 * the generator proposes, the human confirms.
 *
 * @param {Object} opp - the opportunity object
 * @param {string} problemType - the UDP / IDP / WDP classification
 * @returns {Array<Object>} innovation steps
 */
function buildInnovationSteps(opp, problemType) {
  const label = (opp && typeof opp.label === 'string') ? opp.label : 'the opportunity';
  // The innovation move keyed to the problem type (the /mos:diagnose routing
  // intuition: undefined -> explore, ill-defined -> reformulate, well-defined ->
  // execute / validate).
  const move = problemType === 'UDP'
    ? 'Run a domain-exploration pass to surface the whitespace this opportunity opens.'
    : problemType === 'IDP'
      ? 'Reformulate the opportunity into a well-defined problem before committing.'
      : 'Build and validate the minimum viable version of this opportunity.';
  return [
    {
      step: 'Frame "' + label + '" as a disruptive bet and capture the 10x upside thesis.',
      kind: 'innovation',
      evidence_tier: 'practitioner',
      truth_claim: false,
      review_status: 'proposed',
    },
    {
      step: move,
      kind: 'innovation',
      evidence_tier: 'practitioner',
      truth_claim: false,
      review_status: 'proposed',
    },
  ];
}

/**
 * Render a roadmap object to a frontmatter + body markdown string. Body is
 * >50 chars so a downstream HSI discover_artifacts pass does not skip it as
 * near-empty. review_status is ALWAYS proposed (Part 9): the generator never
 * writes a confirmed artifact.
 */
function renderRoadmapMd(roadmap, opts) {
  opts = opts || {};
  const lines = [];
  lines.push('---');
  lines.push('artifact_type: stage7-roadmap');
  lines.push('seed: ' + String(opts.seed || 'seed'));
  lines.push('opportunity_count: ' + roadmap.length);
  lines.push('review_status: proposed');
  lines.push('---');
  lines.push('');
  lines.push('# Stage 7 Mitigation / Innovation Roadmap');
  lines.push('');
  lines.push('Each surfaced opportunity is mapped to a UDP / IDP / WDP problem type '
    + 'and given a mitigation roadmap (defend against the absurd-trend risk) plus '
    + 'an innovation roadmap (seize the disruptive opportunity). Truth-claim steps '
    + 'stay proposed until a human confirms them (Canon Part 9).');
  lines.push('');
  for (const entry of roadmap) {
    lines.push('## ' + entry.opportunity_id + ' (' + entry.problem_type + ')');
    lines.push('');
    lines.push('### Mitigation');
    for (const s of entry.mitigation_steps) {
      lines.push('- [' + s.evidence_tier + '] ' + s.step
        + (s.truth_claim ? ' (truth-claim: proposed)' : ''));
    }
    lines.push('');
    lines.push('### Innovation');
    for (const s of entry.innovation_steps) {
      lines.push('- [' + s.evidence_tier + '] ' + s.step
        + (s.truth_claim ? ' (truth-claim: proposed)' : ''));
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Write an ICM Layer 0 ROOM.md identity file into a folder (CLAUDE.md decision
 * 15: every directory in the Data Room gets a ROOM.md). Mirrors the futures
 * writeRoomMd discipline (that helper is private to the futures module, so the
 * Stage 7 generator carries the SAME idiom locally). Idempotent overwrite.
 */
function writeRoomMd(dir, title, description) {
  const body = [
    '# ' + title,
    '',
    description,
    '',
    '_ICM Layer 0 identity file (Stage 7 roadmap)._',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'ROOM.md'), body, 'utf-8');
}

/**
 * generateStage7Roadmap -- the Stage 7 entry point. Classifies each opportunity
 * into UDP / IDP / WDP, builds a mitigation + innovation roadmap, and files the
 * roadmap as a nested artifact under
 * opportunity-bank/trending-to-absurd-<seed>/stage7-roadmap/ WITH an ICM Layer 0
 * ROOM.md per folder. Truth-claim steps stay proposed (Part 9). Empty input
 * returns an empty roadmap and files nothing (defensive).
 *
 * Canon Part 8: zero Brain egress; pure LOCAL classification + file write.
 *
 * @param {string} roomDir - absolute room directory
 * @param {Array<Object>} opportunities - the banked opportunity objects
 * @param {Object} [opts]
 * @param {string} [opts.seed] - the trend seed label (pins the owned folder)
 * @returns {Promise<{ roadmap: Array<Object>, filed: Array<{id,path}>, roadmapDir: string }>}
 */
async function generateStage7Roadmap(roomDir, opportunities, opts) {
  opts = opts || {};
  const list = Array.isArray(opportunities) ? opportunities : [];

  // Build the structured roadmap (one entry per opportunity).
  const roadmap = [];
  for (const opp of list) {
    if (!opp || typeof opp !== 'object') continue;
    const oppId = typeof opp.id === 'string' && opp.id.length > 0
      ? opp.id
      : 'opp-' + slugify(typeof opp.label === 'string' ? opp.label : 'untitled');
    const problemType = classifyProblemType(opp);
    roadmap.push({
      opportunity_id: oppId,
      problem_type: problemType,
      mitigation_steps: buildMitigationSteps(opp, problemType),
      innovation_steps: buildInnovationSteps(opp, problemType),
    });
  }

  const resolvedRoom = path.resolve(roomDir);
  const seedLabel = String(opts.seed || 'seed');
  const seedSlug = slugify(TTA_SEED_PREFIX + '-' + seedLabel);
  // Exclusive ownership: the roadmap lands under
  // opportunity-bank/trending-to-absurd-<seed>/stage7-roadmap/ (T-163-13). No
  // write escapes opportunity-bank/.
  const roadmapDir = path.join(resolvedRoom, 'opportunity-bank', seedSlug, STAGE7_FOLDER);

  // Empty roadmap: file nothing, return empty (defensive).
  if (roadmap.length === 0) {
    return { roadmap, filed: [], roadmapDir };
  }

  fs.mkdirSync(roadmapDir, { recursive: true });
  // ICM Layer 0: the stage7-roadmap folder gets a ROOM.md identity file.
  writeRoomMd(roadmapDir, 'Stage 7 Roadmap: ' + seedLabel,
    'Mitigation / innovation roadmap for the trending-to-absurd opportunities. '
    + 'Each opportunity is mapped to a UDP / IDP / WDP problem type.');

  // File the roadmap as a nested artifact in its OWN named folder (CLAUDE.md
  // decision 16: never a bare .md in a section root).
  const artifactSlug = 'stage7-roadmap-' + seedSlug;
  const artifactFolder = path.join(roadmapDir, artifactSlug);
  fs.mkdirSync(artifactFolder, { recursive: true });
  // ICM Layer 0: the artifact folder itself gets a ROOM.md (decision 15).
  writeRoomMd(artifactFolder, 'Stage 7 Roadmap Artifact',
    'The mitigation / innovation roadmap content for the ' + seedLabel + ' seed.');
  const mdPath = path.join(artifactFolder, artifactSlug + '.md');
  fs.writeFileSync(mdPath, renderRoadmapMd(roadmap, { seed: seedLabel }), 'utf-8');

  const filed = [{ id: artifactSlug, path: mdPath }];
  return { roadmap, filed, roadmapDir };
}

module.exports = {
  TTA_SEED_PREFIX,
  STAGE7_FOLDER,
  PROBLEM_TYPES,
  EVIDENCE_TIERS,
  classifyProblemType,
  buildMitigationSteps,
  buildInnovationSteps,
  generateStage7Roadmap,
};
