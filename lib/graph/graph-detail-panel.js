/**
 * MindrianOS Plugin -- Slide-in Graph Detail Panel
 * Shows node info and cross-section connections when a graph node is clicked.
 *
 * Zero dependencies. Self-contained CSS via injected style tag.
 * Embeddable via script tag or CJS require.
 *
 * Usage:
 *   GraphDetailPanel.init(containerEl);   // optional, defaults to document.body
 *   GraphDetailPanel.show(nodeData, allEdges);
 *   GraphDetailPanel.hide();
 */

'use strict';

var EDGE_TYPE_COLORS = {
  INFORMS: '#888888',
  CONTRADICTS: '#FF4B4B',
  CONVERGES: '#C8A43C',
  ENABLES: '#4A90D9',
  HSI_CONNECTION: '#8B6FE8',
  REVERSE_SALIENT: '#FF8C42',
};

var GraphDetailPanel = {
  _panel: null,
  _content: null,
  _initialized: false,

  /** Create the panel DOM structure. Call once. */
  init: function(containerEl) {
    if (this._initialized) return;
    var host = containerEl || document.body;

    // Inject styles
    var style = document.createElement('style');
    style.textContent = [
      '.gdp-panel { position:fixed; top:0; right:0; width:360px; height:100vh; background:#1A1A1A; border-left:3px solid #5C5A56; transform:translateX(100%); transition:transform 0.3s ease; z-index:10000; overflow-y:auto; font-family:"DM Sans","Inter",sans-serif; color:#EEF0F4; padding:24px 20px; box-sizing:border-box; }',
      '.gdp-panel.gdp-open { transform:translateX(0); }',
      '.gdp-close { position:absolute; top:12px; right:14px; background:none; border:none; color:#EEF0F4; font-size:22px; cursor:pointer; opacity:0.6; }',
      '.gdp-close:hover { opacity:1; }',
      '.gdp-label { font-size:20px; font-weight:600; margin:0 0 10px 0; line-height:1.3; }',
      '.gdp-badge { display:inline-block; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:500; background:#333; margin-right:6px; margin-bottom:6px; }',
      '.gdp-section-row { font-size:13px; color:#AAA; margin-bottom:4px; }',
      '.gdp-section-row span { color:#EEF0F4; }',
      '.gdp-divider { border:none; border-top:1px solid #333; margin:14px 0; }',
      '.gdp-conns-title { font-size:14px; font-weight:600; margin-bottom:8px; }',
      '.gdp-conn { display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:6px; }',
      '.gdp-conn-badge { padding:1px 7px; border-radius:8px; font-size:10px; font-weight:600; color:#1A1A1A; white-space:nowrap; }',
      '.gdp-arrow { color:#666; font-size:11px; }',
      '.gdp-summary { font-family:"Source Serif 4",serif; font-size:14px; line-height:1.6; color:#CCC; margin-top:10px; }',
    ].join('\n');
    host.appendChild(style);

    // Create panel
    var panel = document.createElement('div');
    panel.className = 'gdp-panel';
    panel.innerHTML = '<button class="gdp-close" aria-label="Close">&times;</button><div class="gdp-content"></div>';
    host.appendChild(panel);

    this._panel = panel;
    this._content = panel.querySelector('.gdp-content');

    var self = this;
    panel.querySelector('.gdp-close').addEventListener('click', function() { self.hide(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') self.hide();
    });

    this._initialized = true;
  },

  /** Populate and slide in the panel. */
  show: function(nodeData, allEdges) {
    if (!this._initialized) this.init();
    var nd = nodeData || {};
    var color = nd.color || '#5C5A56';
    this._panel.style.borderLeftColor = color;

    var html = '';

    // Header
    html += '<h2 class="gdp-label" style="color:' + color + '">' + esc(nd.label || nd.id || 'Node') + '</h2>';

    // Type badge
    var cls = nd.layer || 'content';
    html += '<span class="gdp-badge">' + esc(cls) + '</span>';

    // Section
    if (nd.section) {
      html += '<div class="gdp-section-row">Section: <span>' + esc(nd.section.replace(/-/g, ' ')) + '</span></div>';
    }
    // Methodology
    if (nd.methodology) {
      html += '<div class="gdp-section-row">Methodology: <span>' + esc(nd.methodology.replace(/-/g, ' ')) + '</span></div>';
    }
    // Meeting date
    if (nd.meeting_date) {
      html += '<div class="gdp-section-row">Meeting date: <span>' + esc(nd.meeting_date) + '</span></div>';
    }
    // Speaker role
    if (nd.role) {
      html += '<div class="gdp-section-row">Role: <span>' + esc(nd.role) + '</span></div>';
    }
    // Assumption status
    if (nd.status) {
      var sc = nd.status === 'valid' ? '#4CAF50' : nd.status === 'invalid' ? '#FF4B4B' : '#C8A43C';
      html += '<div class="gdp-section-row">Status: <span style="color:' + sc + '">' + esc(nd.status) + '</span></div>';
    }

    // Cross-section connections
    var connEdges = (allEdges || []).filter(function(e) {
      return e.source === nd.id || e.target === nd.id;
    });
    if (connEdges.length > 0) {
      html += '<hr class="gdp-divider">';
      html += '<div class="gdp-conns-title">Connections (' + connEdges.length + ')</div>';

      // Group by type
      var groups = {};
      connEdges.forEach(function(e) {
        var t = e.type || 'RELATED';
        if (!groups[t]) groups[t] = [];
        groups[t].push(e);
      });

      Object.keys(groups).forEach(function(type) {
        var badgeColor = EDGE_TYPE_COLORS[type] || '#666';
        groups[type].forEach(function(e) {
          var isOutgoing = e.source === nd.id;
          var otherId = isOutgoing ? e.target : e.source;
          var arrow = isOutgoing ? '\u2192' : '\u2190';
          html += '<div class="gdp-conn">';
          html += '<span class="gdp-conn-badge" style="background:' + badgeColor + '">' + esc(type) + '</span>';
          html += '<span class="gdp-arrow">' + arrow + '</span>';
          html += '<span>' + esc(otherId) + '</span>';
          html += '</div>';
        });
      });
    }

    // Summary
    html += '<hr class="gdp-divider">';
    var summary = nd.desc || nd.summary || 'No summary available.';
    html += '<div class="gdp-summary">' + esc(summary) + '</div>';

    this._content.innerHTML = html;
    this._panel.classList.add('gdp-open');
  },

  /** Slide the panel out. */
  hide: function() {
    if (this._panel) this._panel.classList.remove('gdp-open');
  }
};

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Module exports
if (typeof window !== 'undefined') window.GraphDetailPanel = GraphDetailPanel;
if (typeof module !== 'undefined') module.exports = GraphDetailPanel;
