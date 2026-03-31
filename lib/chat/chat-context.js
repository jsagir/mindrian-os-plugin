/**
 * MindrianOS Plugin -- Chat Context Builder
 * Builds Larry's system prompt from ROOM_DATA for the BYOAPI chat panel.
 *
 * Zero dependencies. Embeddable via script tag or CJS require.
 * Follows var/IIFE pattern matching canvas-graph.js.
 */

'use strict';

var ChatContext = (function() {

  /**
   * Build room context string from ROOM_DATA.
   * Summarizes room name, governing thought, sections, and graph stats.
   * @param {object} roomData - The ROOM_DATA object injected into the page
   * @returns {string} Context string, max ~2000 chars
   */
  function buildRoomContext(roomData) {
    if (!roomData) return 'No room data available.';

    var parts = [];
    var charBudget = 2000;

    // Room name
    var roomName = (roomData.state && roomData.state.name)
      || roomData.roomName
      || 'Unnamed Room';
    parts.push('Room: ' + roomName);

    // Stage
    var stage = (roomData.state && roomData.state.stage)
      || roomData.stage
      || '';
    if (stage) {
      parts.push('Stage: ' + stage);
    }

    // Governing thought from MINTO
    if (roomData.minto) {
      var gt = '';
      if (typeof roomData.minto === 'string') {
        // MINTO content as raw string
        var gtMatch = roomData.minto.match(/governing_thought:\s*["']?([^"'\n]+)/);
        if (gtMatch) gt = gtMatch[1].trim();
      } else if (roomData.minto.governing_thought) {
        gt = roomData.minto.governing_thought;
      }
      if (gt) {
        parts.push('Governing Thought: ' + gt);
      }
      // Pyramid levels
      if (roomData.minto.levels && roomData.minto.levels.length > 0) {
        parts.push('MINTO Levels: ' + roomData.minto.levels.join(', '));
      }
    }

    // Sections with artifact counts
    var sections = (roomData.state && roomData.state.sections)
      || roomData.sections
      || [];
    if (sections.length > 0) {
      var sectionLines = [];
      for (var i = 0; i < sections.length; i++) {
        var s = sections[i];
        var label = s.label || s.id || s.name || ('Section ' + (i + 1));
        var count = s.entryCount || s.artifacts || s.count || 0;
        sectionLines.push('  - ' + label + ' (' + count + ' artifacts)');
      }
      parts.push('Sections:\n' + sectionLines.join('\n'));
    }

    // Graph structure summary
    var graph = roomData.graph;
    if (graph && graph.elements) {
      var nodeCount = (graph.elements.nodes || []).length;
      var edgeCount = (graph.elements.edges || []).length;

      if (nodeCount > 0 || edgeCount > 0) {
        var graphLine = 'Graph: ' + nodeCount + ' nodes, ' + edgeCount + ' edges';

        // Edge type distribution
        var edgeTypes = {};
        var edgeArr = graph.elements.edges || [];
        for (var j = 0; j < edgeArr.length; j++) {
          var eType = (edgeArr[j].data && edgeArr[j].data.type) || 'unknown';
          edgeTypes[eType] = (edgeTypes[eType] || 0) + 1;
        }
        var typeStrs = [];
        for (var t in edgeTypes) {
          if (edgeTypes.hasOwnProperty(t)) {
            typeStrs.push(t + ':' + edgeTypes[t]);
          }
        }
        if (typeStrs.length > 0) {
          graphLine += ' [' + typeStrs.join(', ') + ']';
        }
        parts.push(graphLine);
      }
    }

    // Stats
    if (roomData.stats) {
      var statParts = [];
      if (roomData.stats.meetings) statParts.push(roomData.stats.meetings + ' meetings');
      if (roomData.stats.speakers) statParts.push(roomData.stats.speakers + ' speakers');
      if (roomData.stats.artifacts) statParts.push(roomData.stats.artifacts + ' total artifacts');
      if (statParts.length > 0) {
        parts.push('Stats: ' + statParts.join(', '));
      }
    }

    // Current view
    if (roomData.currentView) {
      parts.push('Current view: ' + roomData.currentView);
    }

    // Assemble and truncate
    var result = parts.join('\n');
    if (result.length > charBudget) {
      result = result.slice(0, charBudget - 15) + '\n[...truncated]';
    }
    return result;
  }

  /**
   * Build the full system prompt for Larry, embedding voice DNA and room context.
   * @param {string} roomContext - Output of buildRoomContext()
   * @returns {string} Full system prompt
   */
  function buildSystemPrompt(roomContext) {
    var voiceDNA = [
      'You are Larry, an AI innovation co-founder embedded in a MindrianOS Data Room.',
      '',
      'VOICE RULES:',
      '- Conversational, not academic. Provocative, not condescending.',
      '- Concise: most responses 3-8 sentences, not 30.',
      '- Warm but demanding. Curious, not interrogating.',
      '- If your response looks like it belongs in a PDF, delete it and start over.',
      '',
      'SIGNATURE OPENERS (rotate naturally):',
      '- "Very simply..." when distilling complexity',
      '- "Think about it like this..." when reframing',
      '- "Here\'s what everyone misses..." when revealing hidden insight',
      '- "Let me challenge you with this..." when provoking deeper thinking',
      '- "Notice what\'s happening here..." when surfacing patterns',
      '',
      'REFRAME TECHNIQUE (your power move, use sparingly):',
      '- Flip the user\'s framing to reveal something they didn\'t see.',
      '- "You\'re thinking about this as X. But what if it\'s actually Y?"',
      '- "That\'s not a problem -- that\'s a category containing dozens of problems."',
      '',
      'PACING: Use short punchy sentences for key insights. Let insights breathe.',
    ].join('\n');

    var instructions = [
      '',
      '== Room Context ==',
      roomContext || 'No room context available.',
      '',
      '== Instructions ==',
      'You are Larry, embedded in a MindrianOS Data Room. Answer questions about THIS room\'s content.',
      'You can reference specific sections, artifacts, graph relationships, and the governing thought.',
      'When discussing the room\'s structure, you may reference Simon\'s Architecture of Complexity naturally -- never as a lecture.',
      'You can call tools to highlight graph clusters and filter views.',
      'Stay grounded in the room data above. If asked about something not in the room, say so.',
    ].join('\n');

    return voiceDNA + instructions;
  }

  return {
    buildRoomContext: buildRoomContext,
    buildSystemPrompt: buildSystemPrompt
  };

})();

// Module exports
if (typeof window !== 'undefined') {
  window.ChatContext = ChatContext;
}
if (typeof module !== 'undefined') {
  module.exports = ChatContext;
}
