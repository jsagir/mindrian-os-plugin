/**
 * MindrianOS Plugin -- Generative Tools for Larry Chat
 * Defines AI tool definitions (Anthropic API format), execution handlers,
 * and a declarative UI renderer (json-render pattern) for inline components.
 *
 * Tools:
 *   - highlightCluster: highlight graph nodes by section or edge type
 *   - filterEdgeType: filter graph to show specific edge type
 *   - showInsight: render structured insight card inline in chat
 *
 * Zero dependencies. Embeddable via script tag or CJS require.
 * Follows var/IIFE pattern matching canvas-graph.js and chat-panel.js.
 *
 * Usage:
 *   GenerativeTools.TOOL_DEFINITIONS  // array for Anthropic API tools param
 *   GenerativeTools.executeToolCall(name, input, context)
 *   GenerativeTools.renderComponent(component)  // returns HTML string
 */

'use strict';

var GenerativeTools = (function() {

  // -- Tool definitions (Anthropic API format) --

  var TOOL_DEFINITIONS = [
    {
      name: 'highlightCluster',
      description: 'Highlight a group of nodes on the knowledge graph. Use for section names (e.g., "market-analysis", "problem-definition") or edge types (CONTRADICTS, CONVERGES, ENABLES, INFORMS). Always call this when the user asks to "show" or "highlight" something on the graph.',
      input_schema: {
        type: 'object',
        properties: {
          group: { type: 'string', description: 'Section name or edge type to highlight (e.g., "market-analysis", "CONTRADICTS")' }
        },
        required: ['group']
      }
    },
    {
      name: 'filterEdgeType',
      description: 'Filter the graph to show only edges of a specific type. Use when user asks about relationships, connections of a specific kind, or wants to focus on contradictions/convergences/etc.',
      input_schema: {
        type: 'object',
        properties: {
          edgeType: { type: 'string', enum: ['CONTRADICTS', 'CONVERGES', 'ENABLES', 'INFORMS', 'HSI_CONNECTION', 'REVERSE_SALIENT'], description: 'Edge type to filter' }
        },
        required: ['edgeType']
      }
    },
    {
      name: 'showInsight',
      description: 'Render a visual insight card in the chat with structured data. Use when presenting analysis results, summaries, or comparisons. The card renders inline in the chat.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Card title' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                value: { type: 'string' },
                color: { type: 'string', description: 'Optional hex color for accent' }
              },
              required: ['label', 'value']
            },
            description: 'Key-value items to display'
          },
          footer: { type: 'string', description: 'Optional footer text' }
        },
        required: ['title', 'items']
      }
    }
  ];

  // -- Tool execution --

  function executeToolCall(toolName, toolInput, context) {
    context = context || {};
    var graph = context.graph || null;

    if (toolName === 'highlightCluster') {
      if (!graph || typeof graph.highlightCluster !== 'function') {
        return { success: false, message: 'Graph not available on this view' };
      }
      graph.highlightCluster(toolInput.group);
      return { success: true, message: 'Highlighted ' + toolInput.group };
    }

    if (toolName === 'filterEdgeType') {
      if (!graph || typeof graph.highlightCluster !== 'function') {
        return { success: false, message: 'Graph not available on this view' };
      }
      // highlightCluster already handles edge types
      graph.highlightCluster(toolInput.edgeType);
      return { success: true, message: 'Filtered to ' + toolInput.edgeType + ' edges' };
    }

    if (toolName === 'showInsight') {
      return {
        success: true,
        rendered: true,
        component: {
          type: 'insight-card',
          title: toolInput.title,
          items: toolInput.items,
          footer: toolInput.footer || ''
        }
      };
    }

    return { success: false, message: 'Unknown tool: ' + toolName };
  }

  // -- Declarative UI renderer (json-render pattern, GENUI-01) --

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderComponent(component) {
    if (!component || !component.type) return '';

    if (component.type === 'insight-card') {
      return renderInsightCard(component);
    }

    if (component.type === 'list') {
      return renderList(component);
    }

    if (component.type === 'table') {
      return renderTable(component);
    }

    return '<div style="color:var(--text-muted,#666);font-size:11px;">Unknown component: ' + escapeHtml(component.type) + '</div>';
  }

  function renderInsightCard(comp) {
    var html = '<div style="border-left:3px solid var(--mondrian-yellow,#E8B931);background:rgba(232,185,49,0.06);border-radius:6px;padding:12px 14px;margin:4px 0;font-size:13px;">';
    html += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-primary,#EEF0F4);">' + escapeHtml(comp.title) + '</div>';

    if (comp.items && comp.items.length) {
      for (var i = 0; i < comp.items.length; i++) {
        var item = comp.items[i];
        var colorDot = item.color
          ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + escapeHtml(item.color) + ';margin-right:6px;vertical-align:middle;"></span>'
          : '';
        html += '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:4px;line-height:1.4;">';
        html += colorDot;
        html += '<span style="color:var(--text-secondary,#999);min-width:80px;">' + escapeHtml(item.label) + '</span>';
        html += '<span style="color:var(--text-primary,#EEF0F4);">' + escapeHtml(item.value) + '</span>';
        html += '</div>';
      }
    }

    if (comp.footer) {
      html += '<div style="margin-top:8px;font-size:11px;color:var(--text-muted,#666);border-top:1px solid var(--border-color,#2A2A2A);padding-top:6px;">' + escapeHtml(comp.footer) + '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderList(comp) {
    var html = '<div style="border-left:3px solid var(--mondrian-blue,#1B3B6F);background:rgba(27,59,111,0.06);border-radius:6px;padding:12px 14px;margin:4px 0;font-size:13px;">';
    if (comp.title) {
      html += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-primary,#EEF0F4);">' + escapeHtml(comp.title) + '</div>';
    }
    if (comp.items && comp.items.length) {
      html += '<ul style="margin:0;padding-left:18px;color:var(--text-primary,#EEF0F4);">';
      for (var i = 0; i < comp.items.length; i++) {
        var item = typeof comp.items[i] === 'string' ? comp.items[i] : (comp.items[i].label || comp.items[i].value || '');
        html += '<li style="margin-bottom:3px;line-height:1.4;">' + escapeHtml(item) + '</li>';
      }
      html += '</ul>';
    }
    html += '</div>';
    return html;
  }

  function renderTable(comp) {
    var html = '<div style="border-left:3px solid var(--mondrian-red,#C23B22);background:rgba(194,59,34,0.06);border-radius:6px;padding:12px 14px;margin:4px 0;font-size:12px;overflow-x:auto;">';
    if (comp.title) {
      html += '<div style="font-weight:600;margin-bottom:8px;font-size:13px;color:var(--text-primary,#EEF0F4);">' + escapeHtml(comp.title) + '</div>';
    }
    if (comp.headers && comp.rows) {
      html += '<table style="width:100%;border-collapse:collapse;">';
      html += '<thead><tr>';
      for (var h = 0; h < comp.headers.length; h++) {
        html += '<th style="text-align:left;padding:4px 8px;border-bottom:1px solid var(--border-color,#2A2A2A);color:var(--text-secondary,#999);font-weight:500;">' + escapeHtml(comp.headers[h]) + '</th>';
      }
      html += '</tr></thead><tbody>';
      for (var r = 0; r < comp.rows.length; r++) {
        html += '<tr>';
        var row = comp.rows[r];
        for (var c = 0; c < row.length; c++) {
          html += '<td style="padding:4px 8px;border-bottom:1px solid rgba(42,42,42,0.5);color:var(--text-primary,#EEF0F4);">' + escapeHtml(row[c]) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
    html += '</div>';
    return html;
  }

  return {
    TOOL_DEFINITIONS: TOOL_DEFINITIONS,
    executeToolCall: executeToolCall,
    renderComponent: renderComponent
  };

})();

// Module exports
if (typeof window !== 'undefined') window.GenerativeTools = GenerativeTools;
if (typeof module !== 'undefined') module.exports = GenerativeTools;
