#!/usr/bin/env node
/*
 * SPDX-License-Identifier: BUSL-1.1
 * Licensed Work: MindrianOS Plugin
 * Licensor: Mindrian Inc.
 *
 * Business Source License 1.1
 * Change Date: 2029-04-23
 * Change License: Apache 2.0
 *
 * Use of this file is subject to the terms of the BUSL-1.1 at LICENSE.
 */

/*
 * Plan 89-06: Obsidian Bridge Artifact Writer
 *
 * Pure rendering helpers for the reverse-salient bridge artifact pipeline.
 * Converts `.rs-engine-results.json` pair records into Obsidian-native
 * nested folder artifacts: bridge markdown with wikilinks, ROOM.md identity
 * files, a dataview _index.md, and a De Stijl Cytoscape.js mind map.
 *
 * Design rules (see .planning/phases/89-reverse-salient-engine/89-06-PLAN.md):
 *   - No I/O. All functions are pure string builders. The caller writes.
 *   - Every bridge frontmatter cites BOTH Brain framework nodes
 *     (classical Hughes 1983 + algorithmic Medici/Hofstadter).
 *   - Every bridge body uses Obsidian [[wikilinks]] to both source artifacts.
 *   - Folder-name and file-name match per v1.9.7 nested rule.
 *   - Every folder gets ROOM.md per ICM Layer 0 rule (decision 15).
 *
 * The function set supports three rs-engine modes:
 *   Mode A (internal)   - pairs carry source_artifact_id + source_section.
 *   Mode B (cross-room) - pairs carry source_room + source_artifact.
 *   Mode C (hybrid)     - pairs carry room_artifact + external_doc objects.
 *
 * Field detection is schema-tolerant so this module works against the
 * Plan 89-01 results format today and the Plan 89-04 / 89-05 formats later
 * without a second edit pass.
 */

const path = require('path');

// Phase 89.3 Plan 05 enhancement: Canon Part 8 defense-in-depth on
// the FINAL rendered bridge artifact string. The thesis + breakthrough
// frontmatter fields (when present) carry pair-derived strings that
// flow through to the rendered output. The audit catches any forbidden
// pattern that smuggles into the final bytes regardless of whether the
// caller scrubbed pair.thesis upstream. Defense-in-depth.
const { ExternalEgressViolation } = require('./rs-egress-violations.cjs');
const { auditQueryObject } = require('./rs-egress-prompts.cjs');
const SURFACE_BRIDGE = 'bridge-writer-enhanced';

/**
 * Escape a string for safe inclusion inside double-quoted YAML scalars.
 * Replaces backslashes and double-quotes only; sufficient for the limited
 * inputs (thesis strings) we emit. Newlines are stripped to keep the
 * frontmatter single-line per YAML 1.2 plain double-quoted style.
 */
function escapeYaml(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}

/**
 * Slugify a pair of titles into a folder-safe identifier component.
 * Lowercases, collapses non-alphanumeric to hyphens, trims, truncates each
 * side to 30 chars so long artifact titles do not blow up filesystem limits.
 */
function slugifyPair(sourceTitle, targetTitle) {
  const pick = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30) || 'artifact';
  return `${pick(sourceTitle)}-${pick(targetTitle)}`;
}

/**
 * Extract canonical source/target identifiers from a pair record,
 * tolerating internal/cross-room/hybrid schemas. Returns the label
 * used for humans and the wikilink target used for Obsidian.
 */
function resolvePairIdentity(pair) {
  // Hybrid mode (Plan 89-05): room_artifact + external_doc
  if (pair.room_artifact || pair.external_doc) {
    const roomArtifact = pair.room_artifact || {};
    const externalDoc = pair.external_doc || {};
    const roomId = roomArtifact.room_id || roomArtifact.section || 'room';
    const artifactId = roomArtifact.artifact_id || roomArtifact.id || 'artifact';
    const externalId = externalDoc.external_id || externalDoc.id || 'external';
    return {
      isHybrid: true,
      sourceLabel: roomArtifact.title || artifactId || 'Room Artifact',
      targetLabel: externalDoc.title || externalId || 'External Doc',
      sourceLink: `[[${roomId}/${artifactId}]]`,
      targetLink: externalDoc.external_id
        ? `[${externalDoc.title || externalId}](${externalDoc.external_id})`
        : `[${externalDoc.title || externalId}]`,
      sourceId: `${roomId}/${artifactId}`,
      targetId: externalDoc.external_id || externalId,
      sourceRoom: roomId,
      targetRoom: externalDoc.source || '',
      externalSource: externalDoc.source || '',
      externalId,
    };
  }

  // Cross-room mode (Plan 89-04): source_room + source_artifact
  // Mode A internal (Plan 89-01): source_artifact_id (section/slug) + source_title
  const sourceRoom =
    pair.source_room ||
    pair.source_section ||
    (typeof pair.source_artifact_id === 'string' && pair.source_artifact_id.includes('/')
      ? pair.source_artifact_id.split('/')[0]
      : '');
  const targetRoom =
    pair.target_room ||
    pair.target_section ||
    (typeof pair.target_artifact_id === 'string' && pair.target_artifact_id.includes('/')
      ? pair.target_artifact_id.split('/')[0]
      : '');

  const sourceArtifact =
    pair.source_artifact ||
    (typeof pair.source_artifact_id === 'string' && pair.source_artifact_id.includes('/')
      ? pair.source_artifact_id.split('/').slice(1).join('/')
      : pair.source_artifact_id) ||
    'artifact-a';
  const targetArtifact =
    pair.target_artifact ||
    (typeof pair.target_artifact_id === 'string' && pair.target_artifact_id.includes('/')
      ? pair.target_artifact_id.split('/').slice(1).join('/')
      : pair.target_artifact_id) ||
    'artifact-b';

  const sourceLabel = pair.source_title || sourceArtifact;
  const targetLabel = pair.target_title || targetArtifact;

  return {
    isHybrid: false,
    sourceLabel,
    targetLabel,
    sourceLink: `[[${sourceRoom || 'room'}/${sourceArtifact}]]`,
    targetLink: `[[${targetRoom || 'room'}/${targetArtifact}]]`,
    sourceId: sourceRoom ? `${sourceRoom}/${sourceArtifact}` : sourceArtifact,
    targetId: targetRoom ? `${targetRoom}/${targetArtifact}` : targetArtifact,
    sourceRoom: sourceRoom || '',
    targetRoom: targetRoom || '',
    externalSource: '',
    externalId: '',
  };
}

/**
 * Render a single bridge artifact markdown string with dual Brain
 * framework citation and Obsidian wikilinks to both sources.
 */
function renderBridgeArtifact(pair, bridgeId, metadata) {
  const identity = resolvePairIdentity(pair);
  const lsa = typeof pair.lsa_score === 'number' ? pair.lsa_score : 0;
  const sem = typeof pair.semantic_score === 'number' ? pair.semantic_score : 0;
  const signedDiff =
    typeof pair.signed_diff === 'number' ? pair.signed_diff : sem - lsa;
  const absDiff =
    typeof pair.abs_diff === 'number' ? pair.abs_diff : Math.abs(signedDiff);
  const direction = pair.direction || 'structural_transfer';

  const interpretation =
    direction === 'structural_transfer'
      ? 'Means similar things, uses different topic vocabulary. Cross-domain analogy opportunity.'
      : 'Uses same topic vocabulary, means different things. Method exists in one domain, applies to the other.';

  const directionLabel =
    direction === 'structural_transfer'
      ? 'Structural Transfer (A then B)'
      : 'Semantic Implementation (B from A)';

  const meta = metadata || {};
  const mode = meta.mode || (meta.metadata && meta.metadata.mode) || 'internal';
  const thesisEnabled = meta.thesis_enabled === true;

  const thesisBody = thesisEnabled
    ? pair.innovation_thesis || '(Thesis generation pending)'
    : '_Run without `--no-thesis` to generate innovation thesis._';

  const generatedAt = new Date().toISOString();

  // Phase 89.3 Plan 05 enhancement: 2 OPTIONAL frontmatter fields.
  // BACKWARD-COMPAT: when pair.thesis OR pair.breakthrough is missing,
  // omit the corresponding YAML key entirely so v1.10.16-vintage inputs
  // render BYTE-IDENTICAL pre-89.3 frontmatter (regression-tested).
  const hasThesis = typeof pair.thesis === 'string' && pair.thesis.length > 0;
  const hasBreakthrough =
    pair.breakthrough &&
    typeof pair.breakthrough === 'object' &&
    typeof pair.breakthrough.score === 'number';
  let optionalFrontmatter = '';
  if (hasThesis) {
    optionalFrontmatter += `\nthesis: "${escapeYaml(pair.thesis)}"`;
  }
  if (hasBreakthrough) {
    optionalFrontmatter += `\nbreakthrough_score: ${pair.breakthrough.score.toFixed(2)}`;
  }

  const out = `---
brain_framework_classical: "framework:reverse-salient-analysis"
brain_framework_algorithmic: "framework:algorithmic-generation-of-reverse-salient-solutions"
brain_chain_next: ["framework:cross-domain-innovation", "framework:medici-effect"]
brain_node_version: "2026-Q2"
bridge_id: "${bridgeId}"
mode: "${mode}"
lsa_score: ${lsa.toFixed(4)}
semantic_score: ${sem.toFixed(4)}
signed_diff: ${signedDiff.toFixed(4)}
abs_diff: ${absDiff.toFixed(4)}
direction: "${direction}"
source_room: "${identity.sourceRoom}"
target_room: "${identity.targetRoom}"
external_source: "${identity.externalSource}"
external_id: "${identity.externalId}"
generated_at: "${generatedAt}"${optionalFrontmatter}
---

# Bridge ${bridgeId}: ${identity.sourceLabel} x ${identity.targetLabel}

**Structural similarity (LSA):** ${lsa.toFixed(3)}
**Semantic similarity (BERT):** ${sem.toFixed(3)}
**Differential (|sem - lsa|):** ${absDiff.toFixed(3)}
**Direction:** ${directionLabel}

## Sources

- **Source A:** ${identity.sourceLink}
- **Source B:** ${identity.targetLink}

## Interpretation

${interpretation}

## Innovation Thesis

<!-- Generated when --no-thesis is OFF; stub when ON -->
${thesisBody}

## Brain Framework Citation

This bridge is classified under [[framework:reverse-salient-analysis]] (Hughes 1983, Networks of Power) with chain-forward to [[framework:cross-domain-innovation]] (Medici Effect / Hofstadter Surfaces and Essences).

The algorithmic generation is classified under [[framework:algorithmic-generation-of-reverse-salient-solutions]].

Case studies for context: Marconi, Naval Aviation (see Workshop 3 curriculum).
`;

  // Canon Part 8 defense-in-depth: scan the FINAL rendered string for
  // any FORBIDDEN_PATTERNS leak that smuggled through pair.thesis OR
  // any other surface field. auditQueryObject walks JSON.stringify of
  // the wrapper object; throws ExternalEgressViolation with
  // meta.surface = 'bridge-writer-enhanced' on hit. The thrown error
  // never leaves a partially-rendered artifact behind because we throw
  // BEFORE returning.
  auditQueryObject({ rendered: out }, SURFACE_BRIDGE);
  return out;
}

/**
 * Render ROOM.md identity file for a single bridge folder.
 * Honors ICM Layer 0 rule (decision 15): every folder has ROOM.md.
 */
function renderRoomMd(bridgeId, sourceLabel, targetLabel) {
  return `---
room_type: bridge-artifact
room_id: ${bridgeId}
icm_layer: 4
---

# ${bridgeId}

This folder contains a reverse-salient bridge artifact connecting ${sourceLabel} with ${targetLabel}.

## Contents
- \`${bridgeId}.md\` - main bridge artifact with wikilinks and thesis
- Attachments as needed (images, data extracts)

## Identity
Per ICM Layer 0 rule (decision 15): this directory is a bridge artifact subsystem with its own ROOM.md.
`;
}

/**
 * Render the _index.md dataview query that renders a table of all bridges.
 */
function renderIndex(bridges) {
  return `---
room_type: bridge-index
icm_layer: 4
---

# Cross-Room Bridges Index

\`\`\`dataview
TABLE direction, abs_diff AS "Differential", lsa_score AS "LSA", semantic_score AS "BERT", source_room, target_room
FROM "opportunity-bank/cross-room-bridges"
WHERE abs_diff > 0.3
SORT abs_diff DESC
\`\`\`

## Total bridges: ${bridges.length}
`;
}

/**
 * Render the top-level ROOM.md for the cross-room-bridges section.
 */
function renderSectionRoomMd(metadata) {
  const mode = (metadata && metadata.mode) || 'internal';
  return `---
room_type: cross-room-bridges
icm_layer: 4
---

# Cross-Room Bridges

Generated by rs-engine.py (${mode} mode).

Every bridge in this section is a reverse-salient innovation pair. Structural
similarity (LSA) and semantic similarity (BERT) differ enough to suggest a
cross-domain transfer or a latent method-domain mismatch. See Hughes 1983
Networks of Power and the Medici Effect for theoretical grounding.
`;
}

/**
 * Render the De Stijl Cytoscape.js mind map HTML for all bridge pairs.
 * Standalone HTML (Cytoscape.js via CDN); no build step.
 * Per-edge direction drives edge color (red structural, yellow semantic).
 */
function renderMindMap(pairs) {
  const nodes = new Map();
  const edges = [];

  pairs.forEach((pair, idx) => {
    const bridgeId = `bridge-${String(idx + 1).padStart(3, '0')}`;
    const identity = resolvePairIdentity(pair);
    const sourceId = identity.sourceId || `source-${idx}`;
    const targetId = identity.targetId || `target-${idx}`;

    if (!nodes.has(sourceId)) {
      nodes.set(sourceId, {
        data: { id: sourceId, label: identity.sourceLabel || sourceId, type: 'artifact' },
      });
    }
    if (!nodes.has(targetId)) {
      nodes.set(targetId, {
        data: { id: targetId, label: identity.targetLabel || targetId, type: 'artifact' },
      });
    }
    const absDiff = typeof pair.abs_diff === 'number' ? pair.abs_diff : 0;
    edges.push({
      data: {
        id: bridgeId,
        source: sourceId,
        target: targetId,
        label: `${pair.direction || 'bridge'} (D${absDiff.toFixed(2)})`,
        abs_diff: absDiff,
        direction: pair.direction || 'unknown',
      },
    });
  });

  const elements = JSON.stringify([...nodes.values(), ...edges]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reverse Salient Bridge Mind Map</title>
  <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
  <style>
    :root {
      --red: #A63D2F;
      --blue: #1E3A6E;
      --yellow: #C8A43C;
      --teal: #2A6B5E;
      --cream: #F5F0E8;
      --dark: #1a1a1a;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--dark); font-family: 'Courier New', monospace; color: var(--cream); }
    header {
      padding: 16px 24px;
      border-bottom: 3px solid var(--red);
      display: flex; align-items: center; gap: 16px;
    }
    header h1 { font-size: 1.1rem; letter-spacing: 0.12em; color: var(--yellow); }
    header span { font-size: 0.75rem; color: var(--teal); }
    #cy { width: 100vw; height: calc(100vh - 56px); }
  </style>
</head>
<body>
  <header>
    <h1>REVERSE SALIENT BRIDGE MAP</h1>
    <span>Brain: framework:reverse-salient-analysis + framework:algorithmic-generation-of-reverse-salient-solutions</span>
  </header>
  <div id="cy"></div>
  <script>
    const elements = ${elements};
    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: elements,
      style: [
        {
          selector: 'node[type="artifact"]',
          style: {
            'background-color': '#1E3A6E',
            'label': 'data(label)',
            'color': '#F5F0E8',
            'font-size': '10px',
            'text-wrap': 'wrap',
            'text-max-width': '100px',
            'border-width': 2,
            'border-color': '#2A6B5E',
            'width': 40,
            'height': 40
          }
        },
        {
          selector: 'edge[direction="structural_transfer"]',
          style: {
            'line-color': '#A63D2F',
            'target-arrow-color': '#A63D2F',
            'target-arrow-shape': 'triangle',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#C8A43C',
            'curve-style': 'bezier'
          }
        },
        {
          selector: 'edge[direction="semantic_implementation"]',
          style: {
            'line-color': '#C8A43C',
            'target-arrow-color': '#C8A43C',
            'target-arrow-shape': 'triangle',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#F5F0E8',
            'curve-style': 'bezier'
          }
        },
        {
          selector: 'edge',
          style: {
            'line-color': '#2A6B5E',
            'target-arrow-color': '#2A6B5E',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],
      layout: { name: 'cose', padding: 40, animate: false }
    });
  </script>
</body>
</html>`;
}

module.exports = {
  slugifyPair,
  resolvePairIdentity,
  renderBridgeArtifact,
  renderRoomMd,
  renderIndex,
  renderSectionRoomMd,
  renderMindMap,
};
