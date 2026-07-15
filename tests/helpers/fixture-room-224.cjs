'use strict';
/*
 * Phase 224-01 Task 2 -- buildFixtureRoom224: the b2-journey-shaped fixture the
 * whole phase reuses (SPEC Req 2 fixture; the 21-file / structural-nodes /
 * 0-typed-edges acceptance shape).
 *
 * WHAT IT SEEDS:
 *   - a .room-root sentinel + ROOM.md so resolvers + enumerators treat it as a
 *     real room root.
 *   - by default 21 markdown artifacts echoing the b2-journey shape. TWO of them
 *     are a RELATED pair (the same venture topic paraphrased with distinct
 *     wording, >= 200 words each so the encoder has genuine signal); the rest
 *     span clearly unrelated domains (quantum optics, medieval trade, coral
 *     ecology, tax law, jazz theory, ...), so cross-domain pairs score LOW.
 *   - every artifact indexed through graph-ops.indexArtifact so the STRUCTURAL
 *     nodes (Artifact + Section) + BELONGS_TO edges exist, and the typed-edge
 *     (cascade-family) count starts at 0 -- the derivation harness proves 0 -> N.
 *
 * DETERMINISTIC: fixed content, no randomness, no network, no LLM. Returns
 * { roomDir, dbPath, relatedPair, unrelatedPair, allFiles }.
 *
 * opts.artifactCount lets a caller (e.g. the Plan 02 cost-bound test) build a
 * smaller/faster variant; the two RELATED artifacts are ALWAYS included and the
 * remainder are drawn from the unrelated-domain pool.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). CJS only, zero new deps.
 */

const fs = require('node:fs');
const path = require('node:path');

const graphOps = require('../../lib/core/graph-ops.cjs');

// The RELATED pair: the SAME venture topic (a subscription meal-kit delivery
// service for time-pressed urban professionals) paraphrased twice with distinct
// wording. Both >= 200 words so the semantic encoder has real signal.
const RELATED_A = [
  '# Meal-Kit Subscription Venture (framing A)',
  '',
  'Our venture delivers a weekly subscription box of pre-portioned fresh ingredients',
  'and step-by-step recipe cards to busy professionals living in dense urban centers.',
  'The core customer is a time-pressed knowledge worker who wants to cook a healthy',
  'home dinner but cannot spare an evening for grocery shopping and meal planning.',
  'Each box arrives chilled, contains everything measured for three dinners, and the',
  'recipes are designed to finish in under thirty minutes. We source produce from',
  'regional farms, negotiate volume pricing, and pack the kits in an insulated',
  'facility on the edge of the city so last-mile delivery stays fast and cold-chain',
  'compliant. Pricing is a flat monthly subscription with a pause-any-week option,',
  'because the biggest churn driver for meal-kit companies is the rigidity of a',
  'fixed weekly commitment. Our differentiation is menu personalization: the',
  'onboarding survey captures dietary restrictions, spice tolerance, and cooking',
  'skill, and the recommendation engine tunes each week to reduce the food waste and',
  'recipe fatigue that push subscribers to cancel. Unit economics hinge on keeping',
  'customer acquisition cost below the six-month contribution margin, so we lean on',
  'referral loops and workplace partnerships rather than paid social. The early',
  'wedge is corporate wellness programs that subsidize the first two months for',
  'their employees, which lowers acquisition cost and seeds word-of-mouth inside',
  'high-density office buildings where our delivery routes are already efficient.',
].join('\n');

const RELATED_B = [
  '# Home Cooking Delivery Concept (framing B)',
  '',
  'This business ships a recurring parcel of measured, ready-to-cook fresh food and',
  'illustrated cooking instructions to career-focused people in crowded metropolitan',
  'neighborhoods. The person we serve is an overworked office employee who would',
  'love a nourishing homemade supper yet has no time to plan menus or stand in a',
  'supermarket line. Every parcel is refrigerated, holds exactly the amount needed',
  'for three evening meals, and the dishes are written to be plated in half an hour',
  'or less. We buy vegetables from nearby growers, secure bulk discounts, and',
  'assemble the parcels in a cold warehouse near downtown so the final delivery leg',
  'is quick and keeps the food properly chilled. Customers pay one simple recurring',
  'fee and can skip any given week, since the top reason people quit these services',
  'is being locked into an inflexible seven-day cadence. What sets us apart is',
  'tailoring: a sign-up questionnaire records allergies, heat preference, and kitchen',
  'confidence, and our matching system adjusts the weekly line-up to cut the leftover',
  'waste and repetitive-recipe boredom that make subscribers walk away. The money',
  'only works if the cost to win a customer stays under the margin they generate in',
  'six months, so we grow through friend referrals and employer deals instead of',
  'expensive advertising. Our first foothold is company health initiatives that cover',
  'the opening two months for staff, trimming acquisition cost and spreading buzz',
  'through packed office towers our couriers already pass every day.',
].join('\n');

// The UNRELATED-domain pool: each is a genuinely distinct subject so a pair drawn
// across two of them scores LOW semantic similarity. Deterministic prose, no
// shared venture vocabulary with the RELATED pair.
const UNRELATED_POOL = [
  ['# Quantum Optics Note',
    'Photon entanglement experiments in a linear-optical setup rely on beam splitters,',
    'wave plates, and single-photon avalanche detectors arranged on a vibration-isolated',
    'table. Coincidence counting reveals the correlation between polarization states,',
    'and violations of a Bell inequality confirm that no local hidden-variable model',
    'reproduces the measured statistics. Detector dark counts and imperfect mode overlap',
    'are the dominant sources of visibility loss in the interferometer.'].join('\n'),
  ['# Medieval Trade Routes',
    'The Hanseatic League knit together Baltic and North Sea ports through shared',
    'commercial privileges, standardized cog ships, and fortified trading posts called',
    'kontors. Merchants moved salted herring, timber, furs, and Flemish cloth along',
    'coastal circuits, while guild oligarchies in Lubeck and Novgorod negotiated tariffs',
    'and settled disputes. The league declined as territorial monarchies asserted control',
    'over customs revenue in the late fifteenth century.'].join('\n'),
  ['# Coral Reef Ecology',
    'Reef-building corals host symbiotic zooxanthellae that photosynthesize and supply',
    'the polyps with fixed carbon. Rising sea-surface temperatures disrupt this symbiosis,',
    'expelling the algae and bleaching the colony white. Recovery depends on larval',
    'recruitment, herbivorous fish grazing down competing macroalgae, and water clarity.',
    'Ocean acidification further lowers the aragonite saturation state that corals need to',
    'calcify their skeletons.'].join('\n'),
  ['# Corporate Tax Structuring',
    'Transfer pricing rules require related entities to transact at arms-length values,',
    'and tax authorities scrutinize intercompany royalty and management-fee arrangements.',
    'A holding company in a low-rate jurisdiction can defer taxation on foreign earnings',
    'until repatriation, subject to controlled-foreign-corporation anti-deferral regimes.',
    'Thin-capitalization limits cap the interest deduction on intra-group loans to prevent',
    'earnings stripping.'].join('\n'),
  ['# Jazz Harmony Primer',
    'Modal interchange borrows chords from parallel scales, so a major key can lean on a',
    'minor iv or a flat-VII to color a cadence. Tritone substitution swaps a dominant',
    'seventh for the chord a tritone away, preserving the guiding tones while shifting the',
    'bass a half step. Bebop lines weave chromatic passing tones between chord tones to',
    'keep strong beats consonant over fast ii-V-I motion.'].join('\n'),
  ['# Volcanic Petrology',
    'Basaltic magma erupts at low viscosity, producing fluid lava flows and shield',
    'volcanoes, while silica-rich rhyolite traps gas and drives explosive plinian columns.',
    'Fractional crystallization removes olivine and pyroxene early, enriching the residual',
    'melt in silica and alkalis. Phenocryst zoning records the pressure and temperature',
    'history of the magma chamber before ascent.'].join('\n'),
  ['# Distributed Consensus',
    'The Raft protocol elects a single leader that appends client commands to a replicated',
    'log, and followers acknowledge entries before the leader marks them committed. A term',
    'number totally orders elections, and a candidate needs a majority vote to win, which',
    'guarantees at most one leader per term. Log matching plus the commit rule ensures',
    'safety even across network partitions.'].join('\n'),
  ['# Baroque Counterpoint',
    'A fugue states a subject in one voice, answers it a fifth away in a second voice, and',
    'develops the material through episodes built on sequence and invertible counterpoint.',
    'Stretto overlaps entries of the subject before it finishes, tightening the texture',
    'toward the close. A pedal point on the dominant builds tension before the final tonic',
    'resolution.'].join('\n'),
  ['# Soil Microbiology',
    'Nitrogen-fixing rhizobia colonize legume root nodules and convert atmospheric',
    'dinitrogen into ammonia via the nitrogenase enzyme, which is irreversibly poisoned by',
    'oxygen. Mycorrhizal fungi extend hyphal networks that trade phosphorus for plant',
    'photosynthate. Soil aggregate stability depends on glomalin and microbial',
    'exudates that bind mineral particles.'].join('\n'),
  ['# Aviation Aerodynamics',
    'Lift arises from the pressure difference between the upper and lower surfaces of a',
    'cambered wing, and induced drag grows as the square of the lift coefficient. Wingtip',
    'vortices trail behind the aircraft, so a high aspect ratio reduces the induced-drag',
    'penalty. At high angle of attack the boundary layer separates and the wing stalls,',
    'collapsing lift abruptly.'].join('\n'),
  ['# Constitutional Law Outline',
    'Judicial review lets courts strike legislation that conflicts with the constitution,',
    'a power asserted in early nineteenth-century jurisprudence. The separation of powers',
    'distributes authority among a legislature, executive, and judiciary, each checking the',
    'others. Federalism reserves enumerated powers to a central government while leaving a',
    'residual police power to the constituent states.'].join('\n'),
  ['# Glacial Geomorphology',
    'A valley glacier carves a U-shaped trough, plucking bedrock at its base and depositing',
    'unsorted till at its terminal moraine. Crevasses open where the ice flows over a',
    'convex slope and accelerates. When the glacier retreats, kettle lakes form as buried',
    'ice blocks melt, and drumlins record the former direction of ice flow.'].join('\n'),
  ['# Enzyme Kinetics',
    'The Michaelis-Menten model describes an initial reaction velocity that saturates as',
    'substrate concentration rises, with Km marking the concentration at half of Vmax.',
    'Competitive inhibitors raise the apparent Km without changing Vmax, while',
    'noncompetitive inhibitors lower Vmax. A Lineweaver-Burk double-reciprocal plot',
    'linearizes the data to extract the constants.'].join('\n'),
  ['# Byzantine Mosaics',
    'Gold-ground tesserae set at slight angles catch candlelight so the figures shimmer in',
    'dim church interiors. Iconographic programs place Christ Pantocrator in the central',
    'dome, with saints and imperial donors ranked below by theological hierarchy. The',
    'application of glass smalti over a wet setting bed demanded rapid, planned work by',
    'skilled mosaicists.'].join('\n'),
  ['# Cryptographic Hashing',
    'A secure hash function maps arbitrary input to a fixed-length digest while resisting',
    'preimage, second-preimage, and collision attacks. The Merkle-Damgard construction',
    'iterates a compression function over padded message blocks. Length-extension weakness',
    'in that construction motivated sponge-based designs that absorb and squeeze state',
    'through a fixed permutation.'].join('\n'),
  ['# Wine Fermentation',
    'Yeast metabolizes grape sugars into ethanol and carbon dioxide, and the fermentation',
    'temperature shapes the ester profile that gives a wine its fruit aromas. Malolactic',
    'conversion softens sharp malic acid into rounder lactic acid. Tannin extraction during',
    'maceration depends on skin contact time and cap-management technique.'].join('\n'),
  ['# Orbital Mechanics',
    'A Hohmann transfer moves a spacecraft between two circular orbits with two tangential',
    'burns, minimizing the delta-v for coplanar maneuvers. Orbital period scales with the',
    'three-halves power of the semi-major axis per Keplers third law. A gravity assist',
    'trades momentum with a planet to change heliocentric velocity without expending',
    'propellant.'].join('\n'),
  ['# Textile Weaving',
    'A plain weave interlaces warp and weft one over one for a balanced, durable cloth,',
    'while a twill offsets the crossing to produce a diagonal rib. Warp threads are held',
    'under tension on the loom, and the shed opening lets the shuttle pass the weft. Thread',
    'count and fiber staple length govern the drape and strength of the finished fabric.'].join('\n'),
  ['# Neuronal Signaling',
    'An action potential fires when depolarization opens voltage-gated sodium channels,',
    'and the influx drives the membrane toward the sodium equilibrium potential. Delayed',
    'potassium channels then repolarize the cell, producing a refractory period. At the',
    'synapse, calcium entry triggers vesicle fusion and neurotransmitter release across the',
    'cleft.'].join('\n'),
  ['# Renaissance Perspective',
    'Linear perspective converges parallel lines to a single vanishing point on the horizon,',
    'letting painters render measured depth on a flat panel. A gridded floor of orthogonals',
    'and transversals fixes the scale of receding figures. Atmospheric perspective softens',
    'and cools distant forms to reinforce the illusion of space.'].join('\n'),
];

function writeFileUnder(roomDir, rel, body) {
  const abs = path.join(roomDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body + '\n', 'utf8');
  return abs;
}

/**
 * buildFixtureRoom224(tmpDir, opts) -> { roomDir, dbPath, relatedPair, unrelatedPair, allFiles }
 *   tmpDir: an existing writable directory (caller owns cleanup). The room is
 *           created at tmpDir/room so the caller's dir stays inspectable.
 *   opts.artifactCount: total artifact count (default 21). The 2 RELATED
 *           artifacts are always included; the remainder come from the unrelated
 *           pool. Minimum enforced is 3 (2 related + 1 unrelated).
 */
async function buildFixtureRoom224(tmpDir, opts) {
  if (typeof tmpDir !== 'string' || tmpDir.length === 0) {
    throw new Error('fixture-room-224: tmpDir is required');
  }
  const options = (opts && typeof opts === 'object') ? opts : {};
  const total = Math.max(3, Number.isInteger(options.artifactCount) ? options.artifactCount : 21);
  const unrelatedCount = total - 2;
  if (unrelatedCount > UNRELATED_POOL.length) {
    throw new Error('fixture-room-224: artifactCount ' + total + ' exceeds the unrelated pool ('
      + (UNRELATED_POOL.length + 2) + ' max)');
  }

  const roomDir = path.join(tmpDir, 'room');
  fs.mkdirSync(roomDir, { recursive: true });

  // .room-root sentinel + ROOM.md scaffolding (ROOM.md is a scaffold basename the
  // pair builder skips, proving the exclusion is exercised).
  fs.writeFileSync(path.join(roomDir, '.room-root'), JSON.stringify({ slug: 'fixture-224' }) + '\n', 'utf8');
  writeFileUnder(roomDir, 'ROOM.md', '# Fixture Room 224\n\nb2-journey-shaped derivation fixture (Phase 224-01).');

  const allFiles = [];

  // The RELATED pair (always present). Distinct filenames, same topic paraphrased.
  const relA = writeFileUnder(roomDir, 'venture-mealkit-framing-a.md', RELATED_A);
  const relB = writeFileUnder(roomDir, 'venture-mealkit-framing-b.md', RELATED_B);
  allFiles.push(relA, relB);

  // The unrelated-domain artifacts (deterministic slice of the pool).
  const unrelatedFiles = [];
  for (let i = 0; i < unrelatedCount; i += 1) {
    const body = UNRELATED_POOL[i];
    const slug = 'domain-' + String(i).padStart(2, '0') + '.md';
    const abs = writeFileUnder(roomDir, slug, body);
    unrelatedFiles.push(abs);
    allFiles.push(abs);
  }

  // Index EVERY artifact through the structural indexing path so Artifact +
  // Section nodes + BELONGS_TO edges exist and the typed-edge count starts at 0.
  for (const abs of allFiles) {
    // graph-ops.indexArtifact opens/uses/closes the graph internally (await).
    // eslint-disable-next-line no-await-in-loop
    await graphOps.indexArtifact(roomDir, abs);
  }

  return {
    roomDir: roomDir,
    dbPath: path.join(roomDir, '.mindrian', 'room.db'),
    relatedPair: { a: relA, b: relB },
    unrelatedPair: { a: relA, b: unrelatedFiles[0] || relB },
    allFiles: allFiles,
  };
}

module.exports = { buildFixtureRoom224, RELATED_A, RELATED_B, UNRELATED_POOL };
