/**
 * MindrianOS MCP Prompts — Methodology workflows with Larry personality injection
 *
 * Prompts deliver methodology workflows pre-loaded with room context
 * so Desktop Larry matches CLI Larry.
 *
 * Registered prompts:
 *   1. file-meeting    — File a meeting transcript to Data Room
 *   2. analyze-room    — Analyze current Data Room state
 *   3. grade-venture   — Grade the venture using PWS rubrics
 *   4. run-methodology — Run any of the 25 methodology frameworks
 *   5. suggest-next    — What should I work on next?
 *   6. reason-section  — Analyze a room section using Minto/MECE structured reasoning
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadLarryContext } = require('./larry-context.cjs');
const { getState, computeState } = require('../core/state-ops.cjs');
const { safeReadFile } = require('../core/index.cjs');
const reasoningOps = require('../core/reasoning-ops.cjs');

// All 25 methodology framework names (matching CLI commands)
const METHODOLOGY_NAMES = [
  // methodology group (13)
  'lean-canvas', 'think-hats', 'structure-argument', 'beautiful-question',
  'build-knowledge', 'challenge-assumptions', 'validate', 'map-unknowns',
  'diagnose', 'score-innovation', 'explore-domains', 'analyze-needs',
  'user-needs',
  // analysis group (10)
  'analyze-systems', 'analyze-timing', 'find-bottlenecks', 'root-cause',
  'systems-thinking', 'macro-trends', 'explore-trends', 'explore-futures',
  'dominant-designs', 'scenario-plan',
  // intelligence/strategy (2 from intelligence group that are methodology-like)
  'find-connections', 'build-thesis',
];

/**
 * Safely load a reference file from the plugin references directory.
 * Returns the file content or an empty string if not found.
 *
 * @param {string} pluginRoot
 * @param {...string} segments - Path segments relative to references/
 * @returns {string}
 */
function loadReference(pluginRoot, ...segments) {
  const refPath = path.join(pluginRoot, 'references', ...segments);
  return safeReadFile(refPath) || '';
}

/**
 * Build a prompt message with Larry personality, room state, and optional reference.
 *
 * @param {string} larryFull - Full Larry personality text
 * @param {string} roomState - Current room state text
 * @param {string} reference - Reference material (may be empty)
 * @param {string} userContent - User-specific content or instructions
 * @returns {{ messages: Array<{role: string, content: {type: string, text: string}}> }}
 */
function buildPromptResponse(larryFull, roomState, reference, userContent) {
  const parts = [
    '# Larry Personality Context\n\n' + larryFull,
    '\n\n---\n\n# Current Data Room State\n\n' + (roomState || 'No room initialized yet.'),
  ];

  if (reference) {
    parts.push('\n\n---\n\n# Reference Material\n\n' + reference);
  }

  parts.push('\n\n---\n\n# User Request\n\n' + userContent);

  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text: parts.join('') },
    }],
  };
}

/**
 * Register all MCP Prompts on the server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {string} roomDir - Absolute path to the Data Room directory
 * @param {string} pluginRoot - Root of the plugin repository
 */
function registerPrompts(server, roomDir, pluginRoot) {
  const larryFull = loadLarryContext(pluginRoot).full;

  // -------------------------------------------------------------------------
  // 1. file-meeting — File a meeting transcript to Data Room
  // -------------------------------------------------------------------------
  server.prompt(
    'file-meeting',
    {
      description: 'File a meeting transcript into the Data Room. Larry extracts insights, maps to sections, and files artifacts.',
      arguments: [
        { name: 'transcript', description: 'The full meeting transcript text', required: true },
        { name: 'meetingDate', description: 'Meeting date (YYYY-MM-DD format)', required: false },
      ],
    },
    async (args) => {
      const roomState = getState(roomDir) || '';
      const filingRef = loadReference(pluginRoot, 'meeting', 'section-mapping.md');
      const segmentRef = loadReference(pluginRoot, 'meeting', 'segment-classification.md');
      const reference = [filingRef, segmentRef].filter(Boolean).join('\n\n---\n\n');

      const dateNote = args.meetingDate ? `Meeting date: ${args.meetingDate}\n\n` : '';
      const userContent = `${dateNote}Please file this meeting transcript into the Data Room. Extract key insights, classify segments, map findings to the appropriate sections, and identify cross-section relationships.\n\n## Transcript\n\n${args.transcript}`;

      return buildPromptResponse(larryFull, roomState, reference, userContent);
    }
  );

  // -------------------------------------------------------------------------
  // 2. analyze-room — Analyze current Data Room state
  // -------------------------------------------------------------------------
  server.prompt(
    'analyze-room',
    {
      description: 'Analyze the current Data Room state. Larry identifies gaps, strengths, and what needs attention.',
      arguments: [
        { name: 'focus', description: 'Specific section or concern to focus on', required: false },
      ],
    },
    async (args) => {
      // Use computeState for richer analysis (runs the full state computation)
      let roomState;
      try {
        roomState = computeState(roomDir);
      } catch (e) {
        roomState = getState(roomDir) || '';
      }

      const focusNote = args.focus ? `Focus area: ${args.focus}\n\n` : '';
      const userContent = `${focusNote}Analyze the current state of my Data Room. Identify gaps, strengths, cross-section relationships, and what I should work on. Be specific about which sections need attention and why.`;

      return buildPromptResponse(larryFull, roomState, '', userContent);
    }
  );

  // -------------------------------------------------------------------------
  // 3. grade-venture — Grade the venture using PWS rubrics
  // -------------------------------------------------------------------------
  server.prompt(
    'grade-venture',
    {
      description: 'Grade the venture using PWS assessment rubrics. Quick mode gives overview, deep mode provides detailed component analysis.',
      arguments: [
        { name: 'depth', description: 'Assessment depth: "quick" (overview) or "deep" (detailed component analysis)', required: false },
      ],
    },
    async (args) => {
      const depth = args.depth || 'quick';
      const roomState = getState(roomDir) || '';

      const assessmentPhilosophy = loadReference(pluginRoot, 'personality', 'assessment-philosophy.md');

      let gradingRef;
      if (depth === 'deep') {
        gradingRef = loadReference(pluginRoot, 'methodology', 'deep-grade.md')
          || loadReference(pluginRoot, 'methodology', 'grade.md');
      } else {
        gradingRef = loadReference(pluginRoot, 'methodology', 'grade.md');
      }

      const reference = [assessmentPhilosophy, gradingRef].filter(Boolean).join('\n\n---\n\n');

      const userContent = `Grade my venture using a ${depth} assessment. Evaluate each Data Room section against PWS rubrics, identify the strongest and weakest areas, and provide an overall grade with specific improvement recommendations.`;

      return buildPromptResponse(larryFull, roomState, reference, userContent);
    }
  );

  // -------------------------------------------------------------------------
  // 4. run-methodology — Run any of the 25 methodology frameworks
  // -------------------------------------------------------------------------
  server.prompt(
    'run-methodology',
    {
      description: 'Run a PWS innovation methodology framework. Larry guides you through the chosen framework applied to your venture.',
      arguments: [
        {
          name: 'methodology',
          description: `Methodology to run. One of: ${METHODOLOGY_NAMES.join(', ')}`,
          required: true,
        },
        { name: 'focus', description: 'Specific venture aspect or question to focus the methodology on', required: false },
      ],
    },
    async (args) => {
      const methodology = args.methodology;
      const roomState = getState(roomDir) || '';

      // Try methodology-specific reference file
      const methodRef = loadReference(pluginRoot, 'methodology', `${methodology}.md`);

      const focusNote = args.focus ? `Focus: ${args.focus}\n\n` : '';
      const userContent = `${focusNote}Run the "${methodology}" methodology framework on my venture. Guide me through the framework step by step, applying it specifically to what you see in my Data Room.`;

      return buildPromptResponse(larryFull, roomState, methodRef, userContent);
    }
  );

  // -------------------------------------------------------------------------
  // 5. suggest-next — What should I work on next?
  // -------------------------------------------------------------------------
  server.prompt(
    'suggest-next',
    {
      description: 'Larry analyzes room gaps and suggests what to work on next.',
      arguments: [],
    },
    async () => {
      let roomState;
      try {
        roomState = computeState(roomDir);
      } catch (e) {
        roomState = getState(roomDir) || '';
      }

      const suggestRef = loadReference(pluginRoot, 'methodology', 'index.md');

      const userContent = 'Based on the current state of my Data Room, what should I work on next? Consider which sections are weakest, what methodologies would help most, and what the highest-impact next step would be.';

      return buildPromptResponse(larryFull, roomState, suggestRef, userContent);
    }
  );

  // -------------------------------------------------------------------------
  // 6. reason-section — Analyze a room section using Minto/MECE structured reasoning
  // -------------------------------------------------------------------------
  server.prompt(
    'reason-section',
    {
      description: 'Analyze a room section using Minto/MECE structured reasoning. Larry captures WHY a section matters, rates confidence, and identifies cross-section dependencies.',
      arguments: [
        { name: 'section', description: 'Room section to reason about', required: true },
      ],
    },
    async (args) => {
      const section = args.section;

      // a. Read room STATE.md for venture context
      const roomState = getState(roomDir) || 'No room initialized yet.';

      // b. Read section artifacts (list .md files in room/{section}/)
      const sectionDir = path.join(roomDir, section);
      let artifactSummary = '';
      try {
        const files = fs.readdirSync(sectionDir).filter(f => f.endsWith('.md')).sort();
        if (files.length > 0) {
          const artifacts = files.map(f => {
            const content = safeReadFile(path.join(sectionDir, f)) || '';
            // Truncate long artifacts to keep prompt manageable
            const truncated = content.length > 2000
              ? content.slice(0, 2000) + '\n\n[... truncated, ' + content.length + ' chars total]'
              : content;
            return `### ${f}\n\n${truncated}`;
          });
          artifactSummary = artifacts.join('\n\n---\n\n');
        } else {
          artifactSummary = 'No artifacts in this section yet.';
        }
      } catch (e) {
        artifactSummary = `Section "${section}" directory not found or empty.`;
      }

      // c. Read existing reasoning if any
      const existingReasoning = reasoningOps.getReasoning(roomDir, section);
      const existingContent = existingReasoning.error
        ? 'No existing reasoning for this section.'
        : existingReasoning.content;

      // d. Read the reasoning template
      const reasoningTemplate = loadReference(pluginRoot, 'reasoning', 'reasoning-template.md');

      // e. Compose prompt message array
      const systemMessage = 'You are Larry, MindrianOS reasoning engine. Analyze this section using Minto Pyramid (Situation-Complication-Question-Answer) and MECE structure. Fill in the REASONING.md template below with specific claims from the section artifacts. Rate confidence levels. Identify cross-section dependencies. Be specific about what must be TRUE for this section to be complete.';

      const userMessage = [
        '# Venture Context\n\n' + roomState,
        '\n\n---\n\n# Section Artifacts: ' + section + '\n\n' + artifactSummary,
        '\n\n---\n\n# Existing Reasoning\n\n' + existingContent,
        '\n\n---\n\n# REASONING.md Template (fill this in)\n\n' + (reasoningTemplate || 'Template not found — generate Minto/MECE structured reasoning.'),
      ].join('');

      return {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: systemMessage + '\n\n---\n\n' + userMessage },
          },
        ],
      };
    }
  );
}

module.exports = { registerPrompts, METHODOLOGY_NAMES };
