#!/usr/bin/env node
'use strict';

/**
 * MindrianOS -- Room Intelligence Extractor
 * Reads all Sections in a Room, extracts per-Section intelligence, and produces
 * a structured JSON briefing consumed by generate-snapshot.cjs.
 *
 * Three extraction tiers (matching model-profiles.cjs routing):
 *   EXTRACT-01: Haiku scan per Section (entry count, word count, Thesis, Claims, spectral profiles) - parallel
 *   EXTRACT-02: Sonnet synthesis (top 5 Signals, Room health score, innovation map)
 *   EXTRACT-03: Opus narrative (Room story, hub hero text adapted to Room type)
 *
 * Usage: node scripts/extract-room-intelligence.cjs [ROOM_PATH] [--json]
 *
 * Zero npm dependencies -- uses only Node.js built-ins.
 *
 * Taxonomy: Room, Section, Entry, State, Thesis, Signal, Thread, Fabric,
 *           Surprise, Bottleneck, Blind Spot, Claims
 */

const fs = require('fs');
const path = require('path');
const { detectRoomType, getRoomTypeConfig } = require('../lib/core/room-type-detector.cjs');

// -- Constants --

const SKIP_DIRS = new Set(['.lazygraph', 'meetings', 'team', 'exports', 'assets', 'personas']);
const SKIP_FILES = new Set([
  'ROOM.md', 'STATE.md', 'USER.md', 'JTBD.md',
  'ROOM-INTELLIGENCE.md', 'MEETINGS-INTELLIGENCE.md',
  'ASSET_MANIFEST.md'
]);

const REASONING_FILES = ['MINTO.md', 'REASONING.md'];

// -- Helpers --

/**
 * Parse YAML-like frontmatter delimited by --- lines.
 */
function parseFrontmatter(content) {
  const fm = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return fm;
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      fm[key] = val;
    }
  }
  return fm;
}

/**
 * Count words in a string (simple whitespace split).
 */
function countWords(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Extract title from first # heading or filename.
 */
function extractTitle(content, filename) {
  const match = content.match(/^# (.+)$/m);
  return match ? match[1].trim() : filename.replace(/\.md$/, '');
}

/**
 * Read JSON file safely.
 */
function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

// -- EXTRACT-01: Haiku-tier Section Scan (parallel-ready) --

/**
 * Scan a single Section and extract per-Entry intelligence.
 * This is the "haiku" tier -- lightweight extraction that can run in parallel.
 *
 * @param {string} roomDir - Room root directory
 * @param {string} sectionName - Section directory name
 * @returns {Object} Section intelligence object
 */
function scanSection(roomDir, sectionName) {
  const sectionDir = path.join(roomDir, sectionName);
  const result = {
    id: sectionName,
    label: sectionName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    entryCount: 0,
    wordCount: 0,
    entries: [],
    thesis: null,
    claims: [],
    spectralProfile: null,
    methodologyCoverage: [],
    isEmpty: true,
  };

  // Read entries
  let files;
  try {
    files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md') && !SKIP_FILES.has(f));
  } catch (_) {
    return result;
  }

  result.entryCount = files.length;
  result.isEmpty = files.length === 0;

  for (const file of files) {
    const filePath = path.join(sectionDir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (_) { continue; }

    const fm = parseFrontmatter(content);
    const words = countWords(content);
    result.wordCount += words;

    const entry = {
      filename: file,
      title: extractTitle(content, file),
      wordCount: words,
      methodology: fm.methodology || fm.framework || null,
      confidence: fm.confidence || null,
      validity: fm.validity || fm.status || null,
    };

    result.entries.push(entry);

    // Track methodology coverage
    if (entry.methodology && !result.methodologyCoverage.includes(entry.methodology)) {
      result.methodologyCoverage.push(entry.methodology);
    }

    // Track Claims (assumption validity)
    if (fm.validity || fm.claim_status) {
      result.claims.push({
        title: entry.title,
        validity: fm.validity || fm.claim_status,
        confidence: fm.confidence || 'unknown',
      });
    }
  }

  // Read Thesis (MINTO.md or REASONING.md governing thought)
  for (const reasoningFile of REASONING_FILES) {
    const reasoningPath = path.join(sectionDir, reasoningFile);
    if (fs.existsSync(reasoningPath)) {
      try {
        const content = fs.readFileSync(reasoningPath, 'utf-8');
        const governingMatch = content.match(/(?:Governing Thought|Thesis|Main Argument):\s*(.+)/i);
        if (governingMatch) {
          result.thesis = governingMatch[1].trim();
        } else {
          // Fallback: first non-heading, non-empty line after frontmatter
          const lines = content.replace(/^---[\s\S]*?---\n?/, '').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
              result.thesis = trimmed;
              break;
            }
          }
        }

        // Parse MECE arguments if present
        const meceMatches = content.match(/(?:Argument|Key Point)\s*\d+:\s*(.+)/gi);
        if (meceMatches) {
          result.meceArguments = meceMatches.map(m =>
            m.replace(/(?:Argument|Key Point)\s*\d+:\s*/i, '').trim()
          );
        }

        // Parse confidence
        const confMatch = content.match(/Confidence:\s*(high|medium|low)/i);
        if (confMatch) {
          result.reasoningConfidence = confMatch[1].toLowerCase();
        }

        // Parse staleness
        const staleMatch = content.match(/(?:stale|outdated|needs.update)/i);
        result.reasoningStale = !!staleMatch;
      } catch (_) {}
      break;
    }
  }

  // Read spectral profile (.hsi-results.json)
  const hsiPath = path.join(sectionDir, '.hsi-results.json');
  const hsiData = safeReadJson(hsiPath);
  if (hsiData) {
    result.spectralProfile = {
      spectralGap: hsiData.spectral_gap || hsiData.spectralGap || null,
      dominantMode: hsiData.dominant_mode || hsiData.dominantMode || null,
      modeEntropy: hsiData.mode_entropy || hsiData.modeEntropy || null,
    };
  }

  return result;
}

// -- EXTRACT-02: Sonnet-tier Synthesis --

/**
 * Synthesize Room-level intelligence from per-Section scans.
 * Produces top 5 Signals, Room health score, and innovation map.
 *
 * @param {Array} sectionScans - Array of scanSection results
 * @param {Object} graphData - graph.json parsed data (or null)
 * @param {string} roomDir - Room root directory
 * @returns {Object} Synthesis intelligence
 */
function synthesizeIntelligence(sectionScans, graphData, roomDir) {
  const synthesis = {
    signals: [],
    healthScore: 0,
    healthBreakdown: {},
    innovationMap: [],
    sentinelDigest: null,
  };

  // -- Room Health Score --
  // Factors: section completeness, edge density, reasoning coverage
  const totalSections = sectionScans.length;
  const populatedSections = sectionScans.filter(s => !s.isEmpty).length;
  const sectionCompleteness = totalSections > 0 ? populatedSections / totalSections : 0;

  const totalEntries = sectionScans.reduce((sum, s) => sum + s.entryCount, 0);
  const edgeCount = graphData ? (graphData.edges || []).length : 0;
  const edgeDensity = totalEntries > 1 ? Math.min(edgeCount / (totalEntries * 2), 1) : 0;

  const sectionsWithThesis = sectionScans.filter(s => s.thesis).length;
  const reasoningCoverage = totalSections > 0 ? sectionsWithThesis / totalSections : 0;

  // Weighted health score (0-100)
  synthesis.healthScore = Math.round(
    (sectionCompleteness * 40) +
    (edgeDensity * 30) +
    (reasoningCoverage * 30)
  );

  synthesis.healthBreakdown = {
    sectionCompleteness: Math.round(sectionCompleteness * 100),
    edgeDensity: Math.round(edgeDensity * 100),
    reasoningCoverage: Math.round(reasoningCoverage * 100),
  };

  // -- Top 5 Signals --
  // Priority: CONTRADICTS > REVERSE_SALIENT > CONVERGES > ANALOGOUS_TO > INFORMS
  const signalPriority = [
    'CONTRADICTS', 'REVERSE_SALIENT', 'HSI_CONNECTION',
    'CONVERGES', 'ANALOGOUS_TO', 'INFORMS'
  ];

  if (graphData && graphData.edges) {
    const edgesByType = {};
    for (const edge of graphData.edges) {
      const type = (edge.data && edge.data.type) || (edge.data && edge.data.label) || 'UNKNOWN';
      if (!edgesByType[type]) edgesByType[type] = [];
      edgesByType[type].push(edge);
    }

    for (const signalType of signalPriority) {
      if (synthesis.signals.length >= 5) break;
      const edges = edgesByType[signalType] || [];
      for (const edge of edges.slice(0, 2)) {
        if (synthesis.signals.length >= 5) break;
        const d = edge.data || {};
        synthesis.signals.push({
          type: signalType,
          source: d.source || '',
          target: d.target || '',
          description: d.description || d.label || `${signalType} between ${d.source || '?'} and ${d.target || '?'}`,
          weight: d.weight || d.spectral_gap_avg || 1,
        });
      }
    }
  }

  // Fill remaining signals from Section-level intelligence
  if (synthesis.signals.length < 5) {
    // Blind Spots (empty sections)
    for (const section of sectionScans) {
      if (synthesis.signals.length >= 5) break;
      if (section.isEmpty) {
        synthesis.signals.push({
          type: 'BLIND_SPOT',
          source: section.id,
          target: null,
          description: `${section.label} has no Entries -- potential Blind Spot`,
          weight: 0.5,
        });
      }
    }
  }

  if (synthesis.signals.length < 5) {
    // Stale reasoning
    for (const section of sectionScans) {
      if (synthesis.signals.length >= 5) break;
      if (section.reasoningStale) {
        synthesis.signals.push({
          type: 'STALE_REASONING',
          source: section.id,
          target: null,
          description: `${section.label} Thesis may be outdated -- needs refresh`,
          weight: 0.3,
        });
      }
    }
  }

  // -- Innovation Map --
  // Sections with high spectral gap or HSI connections
  for (const section of sectionScans) {
    if (section.spectralProfile && section.spectralProfile.spectralGap) {
      const gap = parseFloat(section.spectralProfile.spectralGap);
      if (gap > 0.5) {
        synthesis.innovationMap.push({
          section: section.id,
          spectralGap: gap,
          dominantMode: section.spectralProfile.dominantMode,
          entryCount: section.entryCount,
        });
      }
    }
  }

  // Sort innovation map by spectral gap descending
  synthesis.innovationMap.sort((a, b) => b.spectralGap - a.spectralGap);

  // -- Sentinel Digest --
  const intelligenceDir = path.join(roomDir, '.intelligence');
  if (fs.existsSync(intelligenceDir)) {
    try {
      const digestFiles = fs.readdirSync(intelligenceDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse();
      if (digestFiles.length > 0) {
        const latestDigest = fs.readFileSync(
          path.join(intelligenceDir, digestFiles[0]), 'utf-8'
        );
        synthesis.sentinelDigest = {
          filename: digestFiles[0],
          content: latestDigest.slice(0, 2000),
          totalDigests: digestFiles.length,
        };
      }
    } catch (_) {}
  }

  return synthesis;
}

// -- EXTRACT-03: Opus-tier Narrative --

/**
 * Generate Room narrative adapted to detected Room type.
 * Produces the hub hero text and Room story.
 *
 * @param {string} roomType - Detected Room type
 * @param {Object} roomTypeConfig - ROOM_TYPE_CONFIG for this type
 * @param {Array} sectionScans - Per-Section scan results
 * @param {Object} synthesis - Sonnet-tier synthesis results
 * @param {string} roomName - Room display name
 * @returns {Object} Narrative object with story and heroText
 */
function generateNarrative(roomType, roomTypeConfig, sectionScans, synthesis, roomName) {
  const totalEntries = sectionScans.reduce((sum, s) => sum + s.entryCount, 0);
  const populatedSections = sectionScans.filter(s => !s.isEmpty);
  const thesisSections = sectionScans.filter(s => s.thesis);

  // Collect governing thoughts for the narrative
  const governingThoughts = thesisSections
    .map(s => `${s.label}: ${s.thesis}`)
    .slice(0, 5);

  // Build type-adapted narrative
  const narrative = {
    roomType,
    heroText: '',
    story: '',
    governingThoughts,
    keyStats: {},
  };

  // Health descriptor
  const healthDesc = synthesis.healthScore >= 70 ? 'well-developed'
    : synthesis.healthScore >= 40 ? 'developing'
    : 'early-stage';

  switch (roomType) {
    case 'venture':
      narrative.heroText = `${roomName} is a ${healthDesc} venture Room with ${totalEntries} Entries across ${populatedSections.length} active Sections.`;
      narrative.story = buildVentureStory(sectionScans, synthesis, roomName, healthDesc);
      narrative.keyStats = {
        entries: totalEntries,
        sections: populatedSections.length,
        threads: synthesis.healthBreakdown.edgeDensity,
        blindSpots: sectionScans.filter(s => s.isEmpty).length,
      };
      break;

    case 'website':
      narrative.heroText = `${roomName} is a ${healthDesc} design system Room with ${totalEntries} artifacts across ${populatedSections.length} categories.`;
      narrative.story = buildWebsiteStory(sectionScans, synthesis, roomName, healthDesc);
      narrative.keyStats = {
        pages: totalEntries,
        components: populatedSections.filter(s => s.id.includes('component') || s.id === 'solution-design').reduce((sum, s) => sum + s.entryCount, 0),
        sections: populatedSections.length,
      };
      break;

    case 'research':
      narrative.heroText = `${roomName} is a ${healthDesc} research Room with ${totalEntries} papers and artifacts across ${populatedSections.length} research domains.`;
      narrative.story = buildResearchStory(sectionScans, synthesis, roomName, healthDesc);
      narrative.keyStats = {
        papers: totalEntries,
        findings: sectionScans.filter(s => s.id === 'findings' || s.id === 'results').reduce((sum, s) => sum + s.entryCount, 0),
        methodologies: [...new Set(sectionScans.flatMap(s => s.methodologyCoverage))].length,
      };
      break;

    default:
      narrative.heroText = `${roomName} is a ${healthDesc} data Room with ${totalEntries} Entries across ${populatedSections.length} Sections.`;
      narrative.story = buildGeneralStory(sectionScans, synthesis, roomName, healthDesc);
      narrative.keyStats = {
        entries: totalEntries,
        sections: populatedSections.length,
        signals: synthesis.signals.length,
      };
  }

  return narrative;
}

/**
 * Build venture-specific Room story.
 */
function buildVentureStory(sections, synthesis, name, health) {
  const parts = [`${name} is a ${health} venture data room.`];

  const problemSection = sections.find(s => s.id === 'problem-definition');
  if (problemSection && problemSection.thesis) {
    parts.push(`Core problem: ${problemSection.thesis}`);
  }

  const marketSection = sections.find(s => s.id === 'market-analysis');
  if (marketSection && marketSection.entryCount > 0) {
    parts.push(`Market analysis covers ${marketSection.entryCount} Entries.`);
  }

  if (synthesis.signals.length > 0) {
    parts.push(`Top Signal: ${synthesis.signals[0].description}`);
  }

  const blindSpots = sections.filter(s => s.isEmpty);
  if (blindSpots.length > 0) {
    parts.push(`Blind Spots: ${blindSpots.map(s => s.label).join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Build website-specific Room story.
 */
function buildWebsiteStory(sections, synthesis, name, health) {
  const parts = [`${name} is a ${health} design system room.`];

  const designSection = sections.find(s => s.id === 'solution-design');
  if (designSection && designSection.thesis) {
    parts.push(`Architecture: ${designSection.thesis}`);
  }

  const totalComponents = sections
    .filter(s => s.id.includes('component') || s.id === 'solution-design')
    .reduce((sum, s) => sum + s.entryCount, 0);
  if (totalComponents > 0) {
    parts.push(`${totalComponents} components documented.`);
  }

  if (synthesis.signals.length > 0) {
    parts.push(`Top Signal: ${synthesis.signals[0].description}`);
  }

  return parts.join(' ');
}

/**
 * Build research-specific Room story.
 */
function buildResearchStory(sections, synthesis, name, health) {
  const parts = [`${name} is a ${health} research room.`];

  const questionSection = sections.find(s => s.id === 'problem-definition');
  if (questionSection && questionSection.thesis) {
    parts.push(`Research question: ${questionSection.thesis}`);
  }

  const litSection = sections.find(s => s.id === 'literature' || s.id === 'market-analysis');
  if (litSection && litSection.entryCount > 0) {
    parts.push(`Literature review covers ${litSection.entryCount} sources.`);
  }

  const methodologies = [...new Set(sections.flatMap(s => s.methodologyCoverage))];
  if (methodologies.length > 0) {
    parts.push(`Methodologies: ${methodologies.join(', ')}.`);
  }

  if (synthesis.signals.length > 0) {
    parts.push(`Top Signal: ${synthesis.signals[0].description}`);
  }

  return parts.join(' ');
}

/**
 * Build general Room story.
 */
function buildGeneralStory(sections, synthesis, name, health) {
  const parts = [`${name} is a ${health} data room.`];

  const populated = sections.filter(s => !s.isEmpty);
  if (populated.length > 0) {
    parts.push(`Active Sections: ${populated.map(s => s.label).join(', ')}.`);
  }

  if (synthesis.signals.length > 0) {
    parts.push(`Top Signal: ${synthesis.signals[0].description}`);
  }

  return parts.join(' ');
}

// -- Main Extraction Pipeline --

/**
 * Run the full extraction pipeline on a Room.
 * Returns structured JSON consumed by generate-snapshot.cjs.
 *
 * @param {string} roomDir - Absolute path to Room directory
 * @returns {Object} Complete Room intelligence extraction
 */
function extractRoomIntelligence(roomDir) {
  const resolved = path.resolve(roomDir);

  // Read State
  let stateContent = '';
  const statePath = path.join(resolved, 'STATE.md');
  try { stateContent = fs.readFileSync(statePath, 'utf-8'); } catch (_) {}

  // Discover Sections
  let dirEntries;
  try {
    dirEntries = fs.readdirSync(resolved, { withFileTypes: true });
  } catch (_) {
    dirEntries = [];
  }

  const sectionNames = [];
  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    sectionNames.push(entry.name);
  }

  // EXTRACT-01: Haiku scan per Section (parallel-ready)
  const sectionScans = sectionNames.map(name => scanSection(resolved, name));

  // Detect Room type
  const sectionMeta = sectionScans.map(s => ({
    name: s.id,
    entries: s.entries.map(e => ({ content: '' })),
  }));
  const roomType = detectRoomType(stateContent, sectionMeta);
  const roomTypeConfig = getRoomTypeConfig(roomType);

  // Apply Room-type labels to scans
  for (const scan of sectionScans) {
    const configLabel = roomTypeConfig.sectionLabels[scan.id];
    if (configLabel) scan.label = configLabel;
  }

  // Read graph data
  let graphData = null;
  const graphPath = path.join(resolved, 'graph.json');
  graphData = safeReadJson(graphPath);

  // Read assumptions.json for Claims
  let globalClaims = [];
  const assumptionsPath = path.join(resolved, 'assumptions.json');
  const assumptionsData = safeReadJson(assumptionsPath);
  if (assumptionsData && Array.isArray(assumptionsData)) {
    globalClaims = assumptionsData;
  }

  // Read Room name from State
  let roomName = path.basename(resolved);
  const stateFm = parseFrontmatter(stateContent);
  if (stateFm.venture_name) roomName = stateFm.venture_name;
  else if (stateFm.room_name) roomName = stateFm.room_name;
  else if (stateFm.name) roomName = stateFm.name;

  // EXTRACT-02: Sonnet synthesis
  const synthesis = synthesizeIntelligence(sectionScans, graphData, resolved);

  // EXTRACT-03: Opus narrative
  const narrative = generateNarrative(roomType, roomTypeConfig, sectionScans, synthesis, roomName);

  // Assemble output
  return {
    roomName,
    roomType,
    roomTypeConfig: {
      hubTitle: roomTypeConfig.hubTitle,
      graphLabel: roomTypeConfig.graphLabel,
      insightTypes: roomTypeConfig.insightTypes,
    },
    extraction: {
      timestamp: new Date().toISOString(),
      sectionCount: sectionScans.length,
      totalEntries: sectionScans.reduce((sum, s) => sum + s.entryCount, 0),
      totalWords: sectionScans.reduce((sum, s) => sum + s.wordCount, 0),
    },
    sections: sectionScans,
    synthesis,
    narrative,
    claims: globalClaims,
  };
}

// -- CLI --

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/extract-room-intelligence.cjs [ROOM_PATH] [--json]');
    console.log('');
    console.log('  ROOM_PATH   Path to room directory (default: ./room)');
    console.log('  --json      Output raw JSON (default: human-readable summary)');
    process.exit(0);
  }

  const jsonMode = args.includes('--json');
  const roomDir = path.resolve(args.find(a => !a.startsWith('-')) || './room');

  if (!fs.existsSync(roomDir) || !fs.statSync(roomDir).isDirectory()) {
    process.stderr.write(`Error: Room directory not found: ${roomDir}\n`);
    process.exit(1);
  }

  const result = extractRoomIntelligence(roomDir);

  if (jsonMode) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    // Human-readable summary
    console.log(`Room Intelligence: ${result.roomName}`);
    console.log(`Type: ${result.roomType} (${result.roomTypeConfig.hubTitle})`);
    console.log(`Health: ${result.synthesis.healthScore}/100`);
    console.log(`  Section completeness: ${result.synthesis.healthBreakdown.sectionCompleteness}%`);
    console.log(`  Edge density: ${result.synthesis.healthBreakdown.edgeDensity}%`);
    console.log(`  Reasoning coverage: ${result.synthesis.healthBreakdown.reasoningCoverage}%`);
    console.log('');
    console.log(`Sections: ${result.extraction.sectionCount}`);
    console.log(`Entries: ${result.extraction.totalEntries}`);
    console.log(`Words: ${result.extraction.totalWords}`);
    console.log('');

    if (result.sections.length > 0) {
      console.log('Per-Section Intelligence:');
      for (const s of result.sections) {
        const thesisStr = s.thesis ? ` | Thesis: ${s.thesis.slice(0, 60)}...` : '';
        const spectralStr = s.spectralProfile ? ` | Spectral gap: ${s.spectralProfile.spectralGap}` : '';
        console.log(`  ${s.label}: ${s.entryCount} entries, ${s.wordCount} words${thesisStr}${spectralStr}`);
      }
      console.log('');
    }

    if (result.synthesis.signals.length > 0) {
      console.log('Top Signals:');
      for (let i = 0; i < result.synthesis.signals.length; i++) {
        const sig = result.synthesis.signals[i];
        console.log(`  ${i + 1}. [${sig.type}] ${sig.description}`);
      }
      console.log('');
    }

    console.log(`Narrative: ${result.narrative.heroText}`);
    console.log(`Story: ${result.narrative.story}`);
  }
}

module.exports = {
  scanSection,
  synthesizeIntelligence,
  generateNarrative,
  extractRoomIntelligence,
};
