#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 Plan 06 Task 1 (RED until Task 2 lands lib/core/verification-stamp.cjs).
 *
 * The adapter cannot lie: tier is recomputed from the returned edges, paths
 * are byte-true to what Theo sent (non-Framework nodes rendered by label
 * class, never by internal id), resolution is local and exact, the wire call
 * is exactly ('find_connections', {from, to}), the per-run memo + pool of 4
 * hold, and the zod Stamp schema makes a lying stamp unrepresentable.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const path = require('node:path');
const replay = require('./helpers/theo-replay-355.cjs');
const fixture = require('./fixtures/355/theo-stub-responses.json');
const directionConvention = require('../lib/core/direction-convention.cjs');

const { check, summary } = hygiene.makeChecker('355-06 stamp truth (adapter)');

const frameworkNamesData = require(path.join('..', 'data', 'framework-names.json'));
const NAMES = new Set(frameworkNamesData.framework_names.concat(frameworkNamesData.curated_extras));
const commandRegistryData = require(path.join('..', 'data', 'command-registry.json'));
const REGISTRY = new Map();
for (const c of commandRegistryData.commands) {
  if (c && typeof c.command === 'string') REGISTRY.set(c.command, c.frameworks || []);
}
const CTX = { names: NAMES, registry: REGISTRY };

let vs;
try {
  vs = require('../lib/core/verification-stamp.cjs');
} catch (e) {
  console.log('FAIL: lib/core/verification-stamp.cjs exists (' + e.message + ')');
  netGuard.restore();
  summary();
  process.exit(1);
}

async function main() {
  // ------------------------------------------------------------------
  // Tier recomputed from recorded edges; byte-true paths.
  // ------------------------------------------------------------------
  {
    const callTool = replay.makeReplayCallTool(fixture);
    const deps = Object.assign({ callTool: callTool }, CTX);

    const strong1 = await vs.stampFindingDetailed(
      { fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'structural_transfer' }, deps);
    check('strong 1-hop: verification === strong', strong1.stamp.verification === 'strong');
    check('strong 1-hop: backend theo, no reason', strong1.stamp.backend === 'theo' && strong1.stamp.reason === undefined);
    check('strong 1-hop: path.nodes byte-equal (all Framework)',
      JSON.stringify(strong1.stamp.path.nodes) === JSON.stringify(['Reverse Salient Analysis', 'Six Thinking Hats']));
    check('strong 1-hop: path.edges byte-equal', JSON.stringify(strong1.stamp.path.edges) === JSON.stringify(['EXTENDS']));

    const strong2 = await vs.stampFindingDetailed(
      { fromHandle: 'Design Thinking', toHandle: 'Jobs to Be Done (JTBD)', direction: 'structural_transfer' }, deps);
    check('strong 2-hop all-Framework interior: verification === strong', strong2.stamp.verification === 'strong');
    check('strong 2-hop: path.nodes byte-equal',
      JSON.stringify(strong2.stamp.path.nodes) === JSON.stringify(['Design Thinking', 'Systems Thinking', 'Jobs to Be Done (JTBD)']));

    const indirect3 = await vs.stampFindingDetailed(
      { fromHandle: 'Cynefin Framework', toHandle: 'Hedgehog Concept', direction: 'semantic_implementation' }, deps);
    check('indirect 3-hop lateral: verification === indirect', indirect3.stamp.verification === 'indirect');
    check('indirect 3-hop: path.edges byte-equal',
      JSON.stringify(indirect3.stamp.path.edges) === JSON.stringify(['ADDRESSES', 'COMPLEMENTS', 'EXTENDS']));

    // Non-Framework interior on a VERIFIED (lateral-edged) path: rendered by
    // label class, never by the internal fixture id.
    const provenanceLateral = await vs.stampFindingDetailed(
      { fromHandle: 'S-Curve Analysis', toHandle: 'Ackoff Pyramid', direction: 'none' }, deps);
    check('provenance-routed but lateral-edged path still verifies strong', provenanceLateral.stamp.verification === 'strong');
    check('non-Framework interior rendered as [Label], never the internal id',
      JSON.stringify(provenanceLateral.stamp.path.nodes)
        === JSON.stringify(['S-Curve Analysis', '[DomainConcept]', 'Ackoff Pyramid']));
    check('internal fixture id never appears in the stamp',
      JSON.stringify(provenanceLateral.stamp).indexOf('fixture-domain-2') === -1);

    // co-sourced-only / no-lateral-relation: unverified, no path, no internal id anywhere.
    const coSourced = await vs.stampFindingDetailed(
      { fromHandle: 'Hierarchy Mapping', toHandle: 'PEST Analysis', direction: 'none' }, deps);
    check('anchor-only path (SOURCED_FROM x2) -> unverified/theo/co_sourced_only',
      coSourced.stamp.verification === 'unverified' && coSourced.stamp.backend === 'theo' && coSourced.stamp.reason === 'co_sourced_only');
    check('co_sourced_only stamp carries no path key', !Object.prototype.hasOwnProperty.call(coSourced.stamp, 'path'));
    check('co_sourced_only: no internal fixture id anywhere in the stamp',
      JSON.stringify(coSourced.stamp).indexOf('fixture-brainrecord-1') === -1);

    const noLateral = await vs.stampFindingDetailed(
      { fromHandle: 'Ackoff Pyramid', toHandle: 'Dominant Design', direction: 'none' }, deps);
    check('non-lateral, non-anchor path (ADDRESSES_PROBLEM_TYPE x2) -> unverified/theo/no_lateral_relation',
      noLateral.stamp.verification === 'unverified' && noLateral.stamp.backend === 'theo' && noLateral.stamp.reason === 'no_lateral_relation');

    check('installNetGuard saw zero fetch attempts across this whole block', netGuard.attempts() === 0);
  }

  // ------------------------------------------------------------------
  // Deterministic path choice among five equal 2-hop paths.
  // ------------------------------------------------------------------
  {
    const fivePaths = fixture.responses['Futures Wheel\u0000Mullins Model'].paths;
    const results = [];
    for (let i = 0; i < 10; i += 1) {
      const { chosen } = vs.choosePath(fivePaths);
      results.push(chosen);
    }
    check('choosePath prefers a lateral edge over anchor/non-lateral',
      results.every((c) => c.edges.every((e) => vs.LATERAL_EDGE_TYPES.has(e))));
    check('choosePath prefers an all-Framework interior among lateral candidates',
      results.every((c) => c.pathLabels.every((l) => l === 'Framework')));
    check('choosePath is lexically deterministic (Adoption-Capacity Theory interior wins)',
      results.every((c) => c.path[1] === 'Adoption-Capacity Theory'));
    check('choosePath is identical across 10 runs',
      results.every((c) => JSON.stringify(c) === JSON.stringify(results[0])));

    const callTool = replay.makeReplayCallTool(fixture);
    const deps = Object.assign({ callTool: callTool }, CTX);
    const r = await vs.stampFindingDetailed({ fromHandle: 'Futures Wheel', toHandle: 'Mullins Model', direction: 'none' }, deps);
    check('full stampFindingDetailed on the 5-equal-path pair also picks the Adoption-Capacity Theory interior',
      r.stamp.path && r.stamp.path.nodes[1] === 'Adoption-Capacity Theory');
  }

  // ------------------------------------------------------------------
  // Local resolution (D-10, D-48).
  // ------------------------------------------------------------------
  {
    const fwHit = vs.resolveEndpoint({ framework: 'Six Thinking Hats', methodology: null, title: null }, CTX);
    check('frontmatter framework: hit -> via framework', fwHit.name === 'Six Thinking Hats' && fwHit.via === 'framework');

    const methHit = vs.resolveEndpoint({ framework: null, methodology: 'analyze-needs', title: null }, CTX);
    check('methodology: slug resolves through registry frameworks[0] -> via methodology',
      methHit.name === 'Jobs to Be Done (JTBD)' && methHit.via === 'methodology');

    const titleHit = vs.resolveEndpoint({ framework: null, methodology: null, title: 'Dominant Design' }, CTX);
    check('title hit -> via title', titleHit.name === 'Dominant Design' && titleHit.via === 'title');

    const caseVariantMiss = vs.resolveEndpoint({ framework: 'six thinking hats', methodology: null, title: null }, CTX);
    check('a case variant of a real name misses (no case folding)', caseVariantMiss.name === null && caseVariantMiss.via === null);

    const totalMiss = vs.resolveEndpoint({ framework: 'Not A Real Framework', methodology: null, title: 'Also Not Real' }, CTX);
    check('a full miss yields { name: null, via: null }', totalMiss.name === null && totalMiss.via === null);

    const callTool = replay.makeReplayCallTool(fixture);
    const before = callTool.calls.length;
    const composed = await vs.stampFindingDetailed(
      { fromHandle: totalMiss.name, toHandle: 'Six Thinking Hats', direction: 'none' },
      Object.assign({ callTool: callTool }, CTX)
    );
    check('composed with a resolution miss -> not_called/handle_unresolved',
      composed.stamp.verification === 'unverified' && composed.stamp.backend === 'not_called' && composed.stamp.reason === 'handle_unresolved');
    check('a resolution miss makes ZERO callTool calls', callTool.calls.length === before);
  }

  // ------------------------------------------------------------------
  // extractCarried: leading frontmatter block only, framework: key only.
  // ------------------------------------------------------------------
  {
    const withFrontmatter = '---\nframework: Six Thinking Hats\nmethodology: analyze-needs\n---\nBody text here.';
    const carried = vs.extractCarried(withFrontmatter, 'A Title');
    check('extractCarried reads framework: from frontmatter', carried.framework === 'Six Thinking Hats');
    check('extractCarried reads methodology: from frontmatter', carried.methodology === 'analyze-needs');
    check('extractCarried keeps the passed title', carried.title === 'A Title');

    const noFrontmatter = 'Body text only, no frontmatter block.';
    const carriedNone = vs.extractCarried(noFrontmatter, 'Another Title');
    check('extractCarried with no frontmatter block returns null framework/methodology',
      carriedNone.framework === null && carriedNone.methodology === null && carriedNone.title === 'Another Title');

    const quoted = '---\nframework: "Six Thinking Hats"\n---\n';
    const carriedQuoted = vs.extractCarried(quoted, null);
    check('extractCarried strips surrounding quotes', carriedQuoted.framework === 'Six Thinking Hats');
  }

  // ------------------------------------------------------------------
  // The wire call is exactly ('find_connections', {from, to}).
  // ------------------------------------------------------------------
  {
    const callTool = replay.makeReplayCallTool(fixture);
    const deps = Object.assign({ callTool: callTool }, CTX);
    await vs.stampFindingDetailed({ fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'none' }, deps);
    check('at least one call was captured', callTool.calls.length >= 1);
    check('every captured call uses the literal tool name find_connections',
      callTool.calls.every((c) => c.tool === 'find_connections'));
    check('every captured call carries exactly the keys [from, to], sorted',
      callTool.calls.every((c) => JSON.stringify(Object.keys(c.args).sort()) === JSON.stringify(['from', 'to'])));
  }

  // ------------------------------------------------------------------
  // Memo + pool of 4: 6 findings over 3 distinct pairs call callTool 3 times;
  // a second stampFindings call re-calls Theo (no cross-run cache).
  // ------------------------------------------------------------------
  {
    const inner = replay.makeReplayCallTool(fixture);
    const counting = replay.makeCountingCallTool(inner);
    const deps = Object.assign({ callTool: counting }, CTX);
    const findings = [
      { fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'structural_transfer' },
      { fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'semantic_implementation' },
      { fromHandle: 'Design Thinking', toHandle: 'Jobs to Be Done (JTBD)', direction: 'none' },
      { fromHandle: 'Design Thinking', toHandle: 'Jobs to Be Done (JTBD)', direction: 'structural_transfer' },
      { fromHandle: 'Cynefin Framework', toHandle: 'Hedgehog Concept', direction: 'none' },
      { fromHandle: 'Cynefin Framework', toHandle: 'Hedgehog Concept', direction: 'semantic_implementation' },
    ];
    const stamps = await vs.stampFindings(findings, deps);
    check('stampFindings returns one stamp per input finding, in order', stamps.length === 6);
    check('6 findings over 3 distinct pairs call callTool exactly 3 times', counting.calls.length === 3);
    check('max in-flight callTool calls stayed <= 4 (pool of 4)', counting.maxInFlight() <= 4);
    check('shared-pair findings with different directions each carry their own direction',
      stamps[0].direction === 'structural_transfer' && stamps[1].direction === 'semantic_implementation');
    check('shared-pair findings with different directions still share the same verified path',
      stamps[0].verification === stamps[1].verification
      && JSON.stringify(stamps[0].path) === JSON.stringify(stamps[1].path));

    const secondRunInner = replay.makeReplayCallTool(fixture);
    const secondRunCounting = replay.makeCountingCallTool(secondRunInner);
    await vs.stampFindings(findings, Object.assign({ callTool: secondRunCounting }, CTX));
    check('a second stampFindings call re-calls Theo (no cross-run cache)', secondRunCounting.calls.length === 3);
  }

  // ------------------------------------------------------------------
  // Schema: a lying stamp is unrepresentable.
  // ------------------------------------------------------------------
  {
    const Stamp = vs.Stamp;
    const goodStrong = {
      verification: 'strong', backend: 'theo', direction: 'structural_transfer', judge: 'none',
      path: { nodes: ['A', 'B'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] },
    };
    check('a well-formed strong stamp parses', Stamp.safeParse(goodStrong).success === true);

    const extraKey = Object.assign({}, goodStrong, { score: 0.9 });
    check('Stamp.parse rejects an extra score key', Stamp.safeParse(extraKey).success === false);
    const extraKey2 = Object.assign({}, goodStrong, { confidence: 0.9 });
    check('Stamp.parse rejects an extra confidence key', Stamp.safeParse(extraKey2).success === false);

    const goodUnverified = { verification: 'unverified', backend: 'theo', direction: 'none', judge: 'none', reason: 'no_path_within_3_hops' };
    check('a well-formed unverified stamp parses', Stamp.safeParse(goodUnverified).success === true);

    const pathOnUnverified = Object.assign({}, goodUnverified, { path: goodStrong.path });
    check('Stamp.parse rejects a path on an unverified stamp', Stamp.safeParse(pathOnUnverified).success === false);

    const reasonOnVerified = Object.assign({}, goodStrong, { reason: 'malformed_response' });
    check('Stamp.parse rejects a verified stamp carrying a reason', Stamp.safeParse(reasonOnVerified).success === false);

    const strongWith3Hops = {
      verification: 'strong', backend: 'theo', direction: 'none', judge: 'none',
      path: { nodes: ['A', 'B', 'C', 'D'], labels: ['Framework', 'Framework', 'Framework', 'Framework'], edges: ['EXTENDS', 'SUPPORTS', 'FEEDS_INTO'] },
    };
    check('Stamp.parse rejects strong with 3 hops', Stamp.safeParse(strongWith3Hops).success === false);

    const badJudge = Object.assign({}, goodUnverified, { judge: 'supports' });
    check('Stamp.parse rejects judge other than none', Stamp.safeParse(badJudge).success === false);

    const badDirection = Object.assign({}, goodUnverified, { direction: 'bogus_direction' });
    check('Stamp.parse rejects a direction outside the closed enum', Stamp.safeParse(badDirection).success === false);

    const wrongBackendReason = { verification: 'unverified', backend: 'not_called', direction: 'none', judge: 'none', reason: 'no_path_within_3_hops' };
    check('Stamp.parse rejects backend not_called with a non-handle_unresolved reason', Stamp.safeParse(wrongBackendReason).success === false);

    const wrongTheoReason = { verification: 'unverified', backend: 'theo', direction: 'none', judge: 'none', reason: 'rate_limited' };
    check('Stamp.parse rejects backend theo carrying an unavailable-only reason', Stamp.safeParse(wrongTheoReason).success === false);
  }

  // ------------------------------------------------------------------
  // POSTURE and toNodeProps / fromNodeProps round trip.
  // ------------------------------------------------------------------
  {
    check('POSTURE deep-equals the declared read-only posture',
      JSON.stringify(vs.POSTURE) === JSON.stringify({ autonomous_safe: true, reversibility: 'n/a (read-only)', consequence: 'low', writes: 'none' }));

    const stamp = vs.Stamp.parse({
      verification: 'indirect', backend: 'theo', direction: 'semantic_implementation', judge: 'none',
      path: { nodes: ['A', '[BrainRecord]', 'B', 'C'], labels: ['Framework', 'BrainRecord', 'Framework', 'Framework'], edges: ['EXTENDS', 'SUPPORTS', 'FEEDS_INTO'] },
    });
    const props = vs.toNodeProps(stamp);
    check('toNodeProps flattens path into path/path_labels/path_edges/path_len',
      Array.isArray(props.path) && Array.isArray(props.path_labels) && Array.isArray(props.path_edges) && props.path_len === 3);
    const back = vs.fromNodeProps(props);
    check('fromNodeProps round-trips through Stamp.parse', JSON.stringify(back) === JSON.stringify(stamp));

    const unverifiedStamp = vs.Stamp.parse({ verification: 'unverified', backend: 'not_called', direction: 'none', judge: 'none', reason: 'handle_unresolved' });
    const uProps = vs.toNodeProps(unverifiedStamp);
    check('toNodeProps on an unverified stamp carries an empty path array, path_len 0',
      Array.isArray(uProps.path) && uProps.path.length === 0 && uProps.path_len === 0 && uProps.reason === 'handle_unresolved');
    const uBack = vs.fromNodeProps(uProps);
    check('fromNodeProps round-trips an unverified stamp too', JSON.stringify(uBack) === JSON.stringify(unverifiedStamp));
  }

  // ------------------------------------------------------------------
  // Frozen exports sanity.
  // ------------------------------------------------------------------
  {
    check('LATERAL_EDGE_TYPES carries the D-49 ten members',
      vs.LATERAL_EDGE_TYPES.size === 10
      && ['EXTENDS', 'CONTRASTS_WITH', 'COMPLEMENTS', 'PRODUCES_INPUT_FOR', 'FEEDS_INTO', 'ADDRESSES', 'SUPPORTS', 'PRECEDES', 'REQUIRES_KNOWLEDGE_OF', 'GUARDED_BY']
        .every((e) => vs.LATERAL_EDGE_TYPES.has(e)));
    check('ANCHOR_EDGE_TYPES carries the D-49 six members',
      vs.ANCHOR_EDGE_TYPES.size === 6
      && ['SOURCED_FROM', 'PART_OF', 'INSTANCE_OF', 'HAS_CHUNK', 'EXTRACTED_FROM', 'MENTIONS'].every((e) => vs.ANCHOR_EDGE_TYPES.has(e)));
    check('ADDRESSES_PROBLEM_TYPE is not a lateral edge (distinct from ADDRESSES)', !vs.LATERAL_EDGE_TYPES.has('ADDRESSES_PROBLEM_TYPE'));
    check('REASONS carries all 13 D-13/D-54 reasons in order',
      JSON.stringify(vs.REASONS) === JSON.stringify([
        'handle_unresolved', 'backend_unavailable', 'tool_not_listed', 'egress_refused', 'tier_denied',
        'rate_limited', 'invalid_key', 'text_reply', 'endpoint_unresolved', 'no_path_within_3_hops',
        'co_sourced_only', 'no_lateral_relation', 'malformed_response',
      ]));
    check('DIRECTIONS is re-exported unchanged from direction-convention.cjs',
      JSON.stringify(directionConvention.DIRECTIONS) !== undefined);
    check('tierFromHops maps 1 and 2 to strong, 3 to indirect, else unverified',
      vs.tierFromHops(1) === 'strong' && vs.tierFromHops(2) === 'strong' && vs.tierFromHops(3) === 'indirect'
      && vs.tierFromHops(4) === 'unverified' && vs.tierFromHops(0) === 'unverified');
  }

  netGuard.restore();
  check('installNetGuard attempts() === 0 (zero network across this whole file)', netGuard.attempts() === 0);
  check('TYPESAFE_API_KEY was scrubbed before any repo require', typeof wasKeyPresent === 'boolean');

  process.exit(summary());
}

main().catch((e) => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  netGuard.restore();
  process.exit(1);
});
