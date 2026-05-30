'use strict';
/*
 * Phase 130-02 -- tension-map synthesizer.
 *
 * THE one tension-map. It collapses the 4 duplicated tension-map implementations
 * the Cluster 2 audit found scattered across persona-ops.cjs, hat-persistence,
 * and find-analogies into a single PURE function. Plan 03 deletes the duplicates
 * and points the cognitive-family clients here.
 *
 * Contract: synthesizeTensionMap(findingNodes) takes an array of TYPED
 * lens-finding node objects (the pre-resolved 130-CONTEXT decision: synthesizers
 * receive typed node IDs + their parsed properties, NOT raw per-lens output
 * arrays). Each node object is shaped like what navigation.writeLensFinding
 * stores plus its id:
 *   { id, lens, lensType, topic, summary }
 *
 * It returns { tensions: [ { topic, lenses: [a, b], findings: [..], polarity } ] }
 * -- pairs of lenses whose findings OPPOSE on the same topic (for example a
 * yellow-hat opportunity vs a black-hat concern). It is PURE: no db handle, no
 * fs, no require of room-db / sqlite. Defensive: empty input -> { tensions: [] };
 * never throws.
 *
 * Canon Part 8: pure over typed node objects; never reads raw user content from
 *   disk or db; takes only what the engine already wrote and parsed.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

// Opposing-stance lens pairs in the cognitive (six-hats) family. A yellow-hat
// (benefits) finding opposes a black-hat (risks) finding; green (creativity)
// can oppose black (caution). The map is symmetric and extensible.
const OPPOSING_PAIRS = Object.freeze([
  ['yellow-hat', 'black-hat'],
  ['green-hat', 'black-hat'],
  ['red-hat', 'white-hat'],
]);

// Lightweight optimism / caution markers used to confirm two findings on the
// same topic actually oppose (not just sit on opposing-stance lenses). Scalar
// keyword scan only; no NLP, no network.
const CAUTION_MARKERS = ['risk', 'concern', 'danger', 'churn', 'fail', 'threat', 'weak', 'cost'];
const BENEFIT_MARKERS = ['opportunity', 'benefit', 'revenue', 'gain', 'upside', 'strength', 'win'];

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function lensOf(node) {
  return isPlainObject(node) && typeof node.lens === 'string' ? node.lens : '';
}

function topicOf(node) {
  return isPlainObject(node) && typeof node.topic === 'string' ? node.topic : '';
}

function summaryOf(node) {
  return isPlainObject(node) && typeof node.summary === 'string' ? node.summary.toLowerCase() : '';
}

function hasAny(text, markers) {
  for (const m of markers) {
    if (text.indexOf(m) !== -1) return true;
  }
  return false;
}

function isOpposingLensPair(lensA, lensB) {
  for (const [x, y] of OPPOSING_PAIRS) {
    if ((lensA === x && lensB === y) || (lensA === y && lensB === x)) return true;
  }
  return false;
}

function synthesizeTensionMap(findingNodes) {
  const nodes = Array.isArray(findingNodes) ? findingNodes.filter(isPlainObject) : [];
  if (nodes.length === 0) {
    return { tensions: [] };
  }
  const tensions = [];
  // Compare every pair once. Cognitive lens sets are small (<= 6) so the O(n^2)
  // pass is trivially cheap and keeps the function pure and dependency-free.
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const lensA = lensOf(a);
      const lensB = lensOf(b);
      if (!lensA || !lensB || lensA === lensB) continue;
      const topicA = topicOf(a);
      const topicB = topicOf(b);
      // Same-topic requirement: a tension is two lenses disagreeing about the
      // SAME thing. When topics are absent on both, fall back to lens-pair only.
      const sameTopic = topicA && topicB ? topicA === topicB : true;
      if (!sameTopic) continue;
      if (!isOpposingLensPair(lensA, lensB)) continue;
      // Confirm the stance actually opposes via the scalar markers when present.
      const sa = summaryOf(a);
      const sb = summaryOf(b);
      const aCautions = hasAny(sa, CAUTION_MARKERS);
      const aBenefits = hasAny(sa, BENEFIT_MARKERS);
      const bCautions = hasAny(sb, CAUTION_MARKERS);
      const bBenefits = hasAny(sb, BENEFIT_MARKERS);
      const markersPresent = aCautions || aBenefits || bCautions || bBenefits;
      const polarOppose = (aBenefits && bCautions) || (aCautions && bBenefits);
      // If markers are present they must actually oppose; if absent, the
      // opposing-lens-pair alone qualifies (the stance is structural).
      if (markersPresent && !polarOppose) continue;
      tensions.push({
        topic: topicA || topicB || '',
        lenses: [lensA, lensB],
        findings: [a.id, b.id].filter((x) => typeof x === 'string'),
        polarity: polarOppose ? 'confirmed' : 'structural',
      });
    }
  }
  return { tensions };
}

module.exports = { synthesizeTensionMap, OPPOSING_PAIRS };
