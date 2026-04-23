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
 * Plan 89-06: Obsidian Bridge Artifact Writer CLI
 *
 * Consumes `.rs-engine-results.json` (Plan 89-01 / 89-04 / 89-05 output)
 * and writes Obsidian-native nested bridge folders under
 * <room>/opportunity-bank/cross-room-bridges/.
 *
 * Honored invariants:
 *   - v1.9.7 nested rule: folder/folder.md (file name matches folder).
 *   - ICM Layer 0 rule (decision 15): every folder gets ROOM.md.
 *   - Dual Brain framework citation in every bridge frontmatter.
 *   - De Stijl Cytoscape.js mind map emitted at cross-room-bridges/mindmap.html.
 *
 * Usage:
 *   node scripts/write-bridge-artifacts.cjs --results <path> --room <path>
 *
 * Three-surface coverage:
 *   - CLI: invoked directly by the user.
 *   - Desktop: invoked by ReverseSalientAgent after rs-engine.py finishes (Plan 89-07).
 *   - Cowork: when COWORK=1 the room path resolves to the shared 00_Context/ mirror.
 */

const fs = require('fs');
const path = require('path');

const {
  slugifyPair,
  renderBridgeArtifact,
  renderRoomMd,
  renderIndex,
  renderSectionRoomMd,
  renderMindMap,
  resolvePairIdentity,
} = require('../lib/core/bridge-writer.cjs');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--results') out.results = args[++i];
    else if (flag === '--room') out.room = args[++i];
    else if (flag === '--help' || flag === '-h') out.help = true;
  }
  if (out.help || !out.results || !out.room) {
    const usage =
      'Usage: node scripts/write-bridge-artifacts.cjs --results <path> --room <path>';
    if (out.help) {
      console.log(usage);
      process.exit(0);
    }
    console.error(usage);
    process.exit(1);
  }
  return out;
}

function main() {
  const { results, room } = parseArgs();
  const resultsPath = path.resolve(results);
  const roomPath = path.resolve(room);

  if (!fs.existsSync(resultsPath)) {
    console.error(`[bridge-writer] results file not found: ${resultsPath}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(resultsPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`[bridge-writer] invalid JSON in ${resultsPath}: ${err.message}`);
    process.exit(2);
  }

  const pairs = Array.isArray(data.pairs) ? data.pairs : [];
  if (!pairs.length) {
    console.error('[bridge-writer] no pairs in results file; nothing to write');
    process.exit(3);
  }

  const metadata = data.metadata || {};
  const mode = metadata.mode || data.mode || 'internal';

  const baseDir = path.join(roomPath, 'opportunity-bank', 'cross-room-bridges');
  fs.mkdirSync(baseDir, { recursive: true });

  // Section-level ROOM.md (ICM Layer 0 rule)
  fs.writeFileSync(path.join(baseDir, 'ROOM.md'), renderSectionRoomMd({ mode }));

  const bridges = [];
  pairs.forEach((pair, idx) => {
    const bridgeId = `bridge-${String(idx + 1).padStart(3, '0')}`;
    const identity = resolvePairIdentity(pair);
    const slug = slugifyPair(identity.sourceLabel, identity.targetLabel);
    const folderName = `${bridgeId}-${slug}`;
    const folder = path.join(baseDir, folderName);
    fs.mkdirSync(folder, { recursive: true });

    const artifactPath = path.join(folder, `${folderName}.md`);
    const bridgeMd = renderBridgeArtifact(pair, bridgeId, {
      mode,
      thesis_enabled: metadata.thesis_generated === true,
    });
    fs.writeFileSync(artifactPath, bridgeMd);

    // ROOM.md inside each bridge folder (ICM Layer 0 rule)
    fs.writeFileSync(
      path.join(folder, 'ROOM.md'),
      renderRoomMd(bridgeId, identity.sourceLabel, identity.targetLabel)
    );

    bridges.push({ bridgeId, slug, folder: folderName, ...pair });
  });

  // Dataview index
  fs.writeFileSync(path.join(baseDir, '_index.md'), renderIndex(bridges));

  // De Stijl mind map (ROADMAP SC-7, REQ-05)
  fs.writeFileSync(path.join(baseDir, 'mindmap.html'), renderMindMap(pairs));

  console.log(`[bridge-writer] Wrote ${bridges.length} bridges to ${baseDir}`);
  console.log(`[bridge-writer] Mind map: ${path.join(baseDir, 'mindmap.html')}`);
}

main();
