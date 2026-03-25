/**
 * MindrianOS Plugin -- AI Team Persona Operations
 * Core operations for personas/ room section.
 * Generates De Bono Six Thinking Hat personas from room intelligence.
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { discoverSections } = require('./section-registry.cjs');
const { safeReadFile } = require('./index.cjs');

// ---------------------------------------------------------------------------
// Frontmatter parser (same regex/split approach as opportunity-ops.cjs)
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from a markdown string.
 * Simple regex/split parsing (no yaml library).
 * @param {string} content
 * @returns {Object}
 */
function parseFrontmatter(content) {
  if (!content || typeof content !== 'string') return {};

  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const yaml = match[1];
  const result = {};
  const lines = yaml.split('\n');

  let currentKey = null;
  let currentList = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top-level key: value
    const topMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (topMatch) {
      // Flush pending list
      if (currentList !== null && currentKey) {
        result[currentKey] = currentList;
        currentList = null;
      }

      currentKey = topMatch[1];
      const val = topMatch[2].trim();

      if (val === '' || val === 'null') {
        result[currentKey] = null;
      } else if (val === 'true') {
        result[currentKey] = true;
      } else if (val === 'false') {
        result[currentKey] = false;
      } else if (/^-?\d+(\.\d+)?$/.test(val)) {
        result[currentKey] = parseFloat(val);
      } else {
        result[currentKey] = val.replace(/^["']|["']$/g, '');
      }
      continue;
    }

    // List item (  - value)
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentKey) {
      if (currentList === null) currentList = [];
      currentList.push(listMatch[1].trim());
      continue;
    }
  }

  // Flush trailing list
  if (currentList !== null && currentKey) {
    result[currentKey] = currentList;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Hat definitions (hardcoded for zero-IO performance)
// ---------------------------------------------------------------------------

const DISCLAIMER = 'This is a perspective lens generated from your room data. It is NOT professional advice. Validate all insights with qualified professionals.';

const HAT_DEFINITIONS = {
  white: {
    color: 'white',
    label: 'Facts & Data',
    perspective: 'What do we actually know? Strip opinion. Data only.',
    focus_areas: ['numbers', 'metrics', 'market data', 'financial figures', 'validated claims', 'data gaps'],
    tension_hat: 'red',
    complementary_hat: 'blue',
    question_style: 'evidence-seeking',
  },
  red: {
    color: 'red',
    label: 'Emotions & Intuition',
    perspective: 'What does your gut say about this venture? No justification needed.',
    focus_areas: ['team passion', 'market excitement', 'user pain intensity', 'founder conviction', 'emotional resonance'],
    tension_hat: 'white',
    complementary_hat: 'yellow',
    question_style: 'feeling-focused',
  },
  black: {
    color: 'black',
    label: 'Risks & Dangers',
    perspective: 'What kills this? What fails? What\'s the worst case?',
    focus_areas: ['competitive threats', 'financial risks', 'regulatory barriers', 'technical debt', 'team gaps', 'assumption fragility'],
    tension_hat: 'yellow',
    complementary_hat: 'white',
    question_style: 'risk-probing',
  },
  yellow: {
    color: 'yellow',
    label: 'Benefits & Opportunities',
    perspective: 'What\'s the upside? Why could this work brilliantly?',
    focus_areas: ['market opportunity', 'competitive advantages', 'team strengths', 'timing benefits', 'growth potential'],
    tension_hat: 'black',
    complementary_hat: 'green',
    question_style: 'opportunity-seeking',
  },
  green: {
    color: 'green',
    label: 'Creativity & Alternatives',
    perspective: 'What else? What\'s weird? What hasn\'t been tried?',
    focus_areas: ['alternative approaches', 'unconventional strategies', 'pivot possibilities', 'adjacent markets', 'creative partnerships'],
    tension_hat: 'blue',
    complementary_hat: 'yellow',
    question_style: 'divergent-thinking',
  },
  blue: {
    color: 'blue',
    label: 'Process & Meta',
    perspective: 'Are we asking the right questions? What\'s missing from the analysis?',
    focus_areas: ['analysis completeness', 'missing sections', 'methodology gaps', 'decision framework', 'next steps'],
    tension_hat: 'green',
    complementary_hat: 'white',
    question_style: 'meta-analytical',
  },
};

const HAT_COLORS = Object.keys(HAT_DEFINITIONS);

// ---------------------------------------------------------------------------
// Domain signal extraction
// ---------------------------------------------------------------------------

/**
 * Extract domain signals from room state and sections.
 * @param {string} roomDir - Path to room directory
 * @returns {{ primaryDomain: string, ventureStage: string, populatedSections: string[], sectionCount: number, ventureName: string, sectionContent: Object }}
 */
function extractDomainSignals(roomDir) {
  const resolved = path.resolve(roomDir);
  const stateContent = safeReadFile(path.join(resolved, 'STATE.md')) || '';
  const sections = discoverSections(resolved);

  const signals = {
    primaryDomain: 'venture',
    ventureStage: 'unknown',
    populatedSections: [],
    sectionCount: 0,
    ventureName: 'Unknown Venture',
    stateContent: stateContent,
    sectionContent: {},
  };

  // Extract venture name from STATE.md frontmatter or heading
  const ventureMatch = stateContent.match(/venture:\s*(.+)/i);
  if (ventureMatch) {
    signals.ventureName = ventureMatch[1].trim();
  } else {
    const headingMatch = stateContent.match(/^#\s+(.+)/m);
    if (headingMatch) signals.ventureName = headingMatch[1].trim();
  }

  // Extract stage
  const stageMatch = stateContent.match(/stage:\s*(.+)/i);
  if (stageMatch) signals.ventureStage = stageMatch[1].trim();

  // Derive domain slug from venture name
  signals.primaryDomain = signals.ventureName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);

  // Scan sections for populated content
  for (const name of sections.all) {
    // Skip the personas section itself
    if (name === 'personas') continue;

    const sectionDir = path.join(resolved, name);
    try {
      const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md') && f !== 'STATE.md');
      if (files.length > 0) {
        signals.populatedSections.push(name);
        // Read first file content for signal extraction
        const firstFile = safeReadFile(path.join(sectionDir, files[0])) || '';
        signals.sectionContent[name] = firstFile;
      }
    } catch (e) {
      // skip unreadable dirs
    }
  }

  signals.sectionCount = signals.populatedSections.length;
  return signals;
}

// ---------------------------------------------------------------------------
// Persona content builders
// ---------------------------------------------------------------------------

/**
 * Extract a brief summary from section content (first meaningful paragraph).
 * @param {string} content
 * @returns {string}
 */
function extractSectionSummary(content) {
  if (!content) return 'Content available for analysis.';

  // Remove frontmatter
  const body = content.replace(/^---[\s\S]*?---\s*/, '');

  // Find first non-heading, non-empty paragraph
  const lines = body.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length > 0) {
    const summary = lines[0].trim();
    return summary.length > 120 ? summary.slice(0, 117) + '...' : summary;
  }
  return 'Content available for analysis.';
}

/**
 * Build hat-specific questions based on hat focus and section content.
 * @param {Object} hat - Hat definition
 * @param {Object} signals - Domain signals
 * @returns {string[]}
 */
function buildQuestions(hat, signals) {
  const domain = signals.ventureName;
  const sections = signals.populatedSections;

  const questionTemplates = {
    white: [
      `What validated data points support the core assumptions in ${domain}?`,
      `Which claims in your ${sections[0] || 'analysis'} section lack quantitative backing?`,
      `What metrics would you need to track to prove or disprove your thesis?`,
    ],
    red: [
      `When you describe ${domain} to someone, what part makes you most excited?`,
      `Which aspect of this venture keeps you up at night -- not logically, but emotionally?`,
      `If you had to bet your reputation on one strength of this venture, what would it be?`,
    ],
    black: [
      `What single point of failure could kill ${domain} in the next 12 months?`,
      `Which competitor could pivot into your space faster than you can build defensibility?`,
      `What assumption, if proven wrong, would invalidate your entire business model?`,
    ],
    yellow: [
      `What unfair advantage does ${domain} have that competitors cannot easily replicate?`,
      `Which market trend is accelerating in your favor right now?`,
      `What is the best possible outcome for this venture in 3 years?`,
    ],
    green: [
      `What if ${domain} served a completely different customer segment?`,
      `What would a radically different business model look like for this same problem?`,
      `What adjacent market could you enter with minimal modification to your core offering?`,
    ],
    blue: [
      `Are we analyzing ${domain} at the right level of granularity?`,
      `Which room section is most underdeveloped relative to its importance?`,
      `What methodology or framework would challenge our current analysis approach?`,
    ],
  };

  return questionTemplates[hat.color] || [
    `What do you see in ${domain} from this perspective?`,
    `What are others missing about this venture?`,
    `What should be examined more carefully?`,
  ];
}

/**
 * Build the full persona markdown content.
 * @param {string} hatColor
 * @param {Object} signals
 * @returns {string}
 */
function buildPersonaContent(hatColor, signals) {
  const hat = HAT_DEFINITIONS[hatColor];
  const tensionHat = HAT_DEFINITIONS[hat.tension_hat];
  const compHat = HAT_DEFINITIONS[hat.complementary_hat];
  const date = new Date().toISOString().split('T')[0];
  const roomHash = crypto.createHash('md5').update(signals.stateContent).digest('hex').slice(0, 7);

  // Build frontmatter
  const frontmatter = [
    '---',
    `hat: ${hat.color}`,
    `hat_label: ${hat.label}`,
    `domain: ${signals.primaryDomain}`,
    `perspective: ${hat.perspective}`,
    `generated_from:`,
    ...signals.populatedSections.map(s => `  - ${s}`),
    `generated_date: ${date}`,
    `room_hash: ${roomHash}`,
    `disclaimer: "${DISCLAIMER}"`,
    '---',
  ].join('\n');

  // Build "Who I Am"
  const whoIAm = `I examine your ${signals.ventureName} venture through the lens of ${hat.label.toLowerCase()}. My perspective: ${hat.perspective} I focus on: ${hat.focus_areas.join(', ')}.`;

  // Build "What I See" sections
  const seeInRoom = signals.populatedSections.map(section => {
    const content = signals.sectionContent[section] || '';
    const summary = extractSectionSummary(content);
    const sectionLabel = section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `### From ${sectionLabel}\n${summary}`;
  }).join('\n\n');

  // Build questions
  const questions = buildQuestions(hat, signals);
  const questionBlock = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

  // Build disagreements
  const disagreements = [
    `- **vs ${tensionHat.color.charAt(0).toUpperCase() + tensionHat.color.slice(1)} (${tensionHat.label}):** Our perspectives naturally tension -- ${hat.label.toLowerCase()} vs ${tensionHat.label.toLowerCase()}. Where I see ${hat.focus_areas[0]}, they see ${tensionHat.focus_areas[0]}.`,
    `- **vs ${compHat.color.charAt(0).toUpperCase() + compHat.color.slice(1)} (${compHat.label}):** We often align, but I emphasize ${hat.focus_areas[1] || hat.focus_areas[0]} while they focus on ${compHat.focus_areas[1] || compHat.focus_areas[0]}.`,
  ].join('\n');

  // Assemble
  return `${frontmatter}

# ${hat.color.charAt(0).toUpperCase() + hat.color.slice(1)} Hat -- ${hat.label} Perspective

## Who I Am

${whoIAm}

## What I See In Your Room

${seeInRoom}

## My Questions For You

${questionBlock}

## Where I Disagree With Other Hats

${disagreements}

---
*${DISCLAIMER} Generated from room state on ${date}.*
`;
}

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

/**
 * Generate 6 hat-colored persona files from room intelligence.
 * Requires 2+ populated sections (rejects thin rooms).
 *
 * @param {string} roomDir - Path to room directory
 * @returns {{ generated: string[], domain: string, sections_used: number } | { error: string }}
 */
function generatePersonas(roomDir) {
  const resolved = path.resolve(roomDir);

  const stateContent = safeReadFile(path.join(resolved, 'STATE.md'));
  if (!stateContent) return { error: 'No room STATE.md found' };

  const signals = extractDomainSignals(resolved);
  if (signals.sectionCount < 2) {
    return {
      error: 'Room needs content in 2+ sections for meaningful personas',
      sections: signals.sectionCount,
    };
  }

  // Ensure personas/ directory exists
  const personasDir = path.join(resolved, 'personas');
  fs.mkdirSync(personasDir, { recursive: true });

  const generated = [];
  for (const hatColor of HAT_COLORS) {
    const content = buildPersonaContent(hatColor, signals);
    const filename = `${hatColor}-${signals.primaryDomain}.md`;
    fs.writeFileSync(path.join(personasDir, filename), content, 'utf-8');
    generated.push(filename);
  }

  return {
    generated,
    domain: signals.primaryDomain,
    sections_used: signals.sectionCount,
  };
}

/**
 * List all personas in a room's personas/ directory.
 * @param {string} roomDir
 * @returns {Array<{ hat: string, hat_label: string, domain: string, filename: string, disclaimer: string }>}
 */
function listPersonas(roomDir) {
  const resolved = path.resolve(roomDir);
  const personasDir = path.join(resolved, 'personas');

  let files;
  try {
    files = fs.readdirSync(personasDir).filter(f => f.endsWith('.md') && f !== 'STATE.md');
  } catch (e) {
    return [];
  }

  return files.map(filename => {
    const content = safeReadFile(path.join(personasDir, filename)) || '';
    const fm = parseFrontmatter(content);
    return {
      hat: fm.hat || null,
      hat_label: fm.hat_label || null,
      domain: fm.domain || null,
      filename,
      disclaimer: fm.disclaimer || null,
    };
  });
}

/**
 * Invoke a specific hat persona, optionally with a target artifact.
 * @param {string} roomDir
 * @param {string} hatColor - white|red|black|yellow|green|blue
 * @param {string} [artifactPath] - Optional path to artifact for analysis
 * @returns {{ persona: string, artifact: string|null, hat: string } | { error: string }}
 */
function invokePersona(roomDir, hatColor, artifactPath) {
  const resolved = path.resolve(roomDir);
  const personasDir = path.join(resolved, 'personas');

  let files;
  try {
    files = fs.readdirSync(personasDir).filter(f => f.startsWith(hatColor + '-') && f.endsWith('.md'));
  } catch (e) {
    return { error: `No ${hatColor} hat persona generated. Run persona generate first.` };
  }

  if (files.length === 0) {
    return { error: `No ${hatColor} hat persona generated. Run persona generate first.` };
  }

  const personaContent = safeReadFile(path.join(personasDir, files[0]));
  const artifactContent = artifactPath ? safeReadFile(path.resolve(artifactPath)) : null;

  return {
    persona: personaContent,
    artifact: artifactContent,
    hat: hatColor,
  };
}

/**
 * Run all 6 personas against a single artifact.
 * @param {string} roomDir
 * @param {string} [artifactPath]
 * @returns {{ perspectives: Object, artifact: string|null }}
 */
function analyzeAllPerspectives(roomDir, artifactPath) {
  const perspectives = {};
  for (const hatColor of HAT_COLORS) {
    perspectives[hatColor] = invokePersona(roomDir, hatColor, artifactPath);
  }
  return {
    perspectives,
    artifact: artifactPath || null,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  generatePersonas,
  listPersonas,
  invokePersona,
  analyzeAllPerspectives,
  extractDomainSignals,
};
