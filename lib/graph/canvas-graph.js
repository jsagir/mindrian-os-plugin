/**
 * MindrianOS Plugin -- Universal Canvas 2D Graph Renderer
 * Ported from the Milken Twin implementation, adapted to consume
 * graph.json (Cytoscape format) from build-graph-from-kuzu.cjs.
 *
 * Zero dependencies. Embeddable via script tag or CJS require.
 *
 * Usage:
 *   const graph = new CanvasGraph(containerEl, graphJsonData, { onNodeClick });
 *   graph.highlightCluster('market-analysis');
 *   graph.destroy();
 */

'use strict';

var EDGE_STYLES = {
  INFORMS:         { color: '#888888', width: 0.8, dash: null, arrow: true },
  CONTRADICTS:     { color: '#FF4B4B', width: 1.5, dash: [6, 4], arrow: false },
  CONVERGES:       { color: '#C8A43C', width: 1.2, dash: [2, 4], arrow: false },
  ENABLES:         { color: '#4A90D9', width: 1.5, dash: null, arrow: true },
  HSI_CONNECTION:  { color: '#8B6FE8', width: 0.8, dash: [2, 3], arrow: false },
  REVERSE_SALIENT: { color: '#FF8C42', width: 1.2, dash: [6, 4], arrow: false },
};

var DEFAULT_EDGE = { color: '#888888', width: 0.3, dash: null, arrow: false };

function CanvasGraph(container, graphData, options) {
  if (!container) throw new Error('CanvasGraph: container element required');
  options = options || {};
  var self = this;

  // -- Parse graph data --
  var rawNodes = (graphData && graphData.elements && graphData.elements.nodes) || [];
  var rawEdges = (graphData && graphData.elements && graphData.elements.edges) || [];

  // Build internal nodes
  var nodes = [];
  var nodeMap = {};
  var adjacency = {}; // id -> Set of neighbor ids

  rawNodes.forEach(function(n) {
    var d = n.data || {};
    var node = {
      id: d.id,
      label: d.label || '',
      color: d.color || '#5C5A56',
      section: d.section || '',
      layer: d.layer || 'content',
      cls: (n.classes || '').split(/\s+/)[0] || 'artifact',
      data: d,
      r: 12,
      x: 0, y: 0, vx: 0, vy: 0
    };
    nodes.push(node);
    nodeMap[node.id] = node;
    adjacency[node.id] = new Set();
  });

  // Build internal edges
  var edges = [];
  rawEdges.forEach(function(e) {
    var d = e.data || {};
    if (!nodeMap[d.source] || !nodeMap[d.target]) return;
    edges.push({
      source: d.source,
      target: d.target,
      type: d.type || 'BELONGS_TO',
      label: d.label || '',
      data: d
    });
    adjacency[d.source] = adjacency[d.source] || new Set();
    adjacency[d.target] = adjacency[d.target] || new Set();
    adjacency[d.source].add(d.target);
    adjacency[d.target].add(d.source);
  });

  // Compute degree centrality for node radius
  nodes.forEach(function(n) {
    if (n.cls === 'section-group') {
      n.r = 24;
    } else {
      var degree = adjacency[n.id] ? adjacency[n.id].size : 0;
      n.r = Math.max(8, Math.min(20, 6 + degree * 2));
    }
  });

  // -- Canvas setup --
  var canvas = document.createElement('canvas');
  container.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0;
  var animId = null;
  var particles = [];
  var frameCount = 0;
  var mouseX = -999, mouseY = -999;
  var hoveredNode = null;
  self._highlightState = null;

  function sizeCanvas() {
    var rect = container.getBoundingClientRect();
    W = rect.width || 800;
    H = rect.height || 600;
    canvas.width = W * 2;
    canvas.height = H * 2;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(2, 2);
  }

  sizeCanvas();

  // Initialize positions in circular spread with jitter
  var cx = W / 2, cy = H / 2;
  nodes.forEach(function(n, i) {
    var a = (i / nodes.length) * Math.PI * 2;
    var spread = 120 + Math.random() * 80;
    n.x = cx + Math.cos(a) * spread + (Math.random() - 0.5) * 60;
    n.y = cy + Math.sin(a) * spread + (Math.random() - 0.5) * 60;
    n.vx = 0;
    n.vy = 0;
  });

  // -- ResizeObserver --
  var resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(function() { self.resize(); });
    resizeObserver.observe(container);
  }

  // -- Mouse events --
  canvas.addEventListener('mousemove', function(e) {
    var r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mouseleave', function() { mouseX = -999; mouseY = -999; });
  canvas.addEventListener('click', function() {
    if (!hoveredNode) return;
    var nodeEdges = edges.filter(function(e) {
      return e.source === hoveredNode.id || e.target === hoveredNode.id;
    });
    if (typeof options.onNodeClick === 'function') {
      options.onNodeClick(hoveredNode.data);
    } else if (typeof window !== 'undefined' && window.GraphDetailPanel && typeof window.GraphDetailPanel.show === 'function') {
      window.GraphDetailPanel.show(hoveredNode.data, nodeEdges.map(function(e) { return e.data; }));
    }
  });

  // -- Force simulation --
  function simulate() {
    var cx2 = W / 2, cy2 = H / 2;
    var i, j, n, dx, dy, d, force;

    // Gravity to center
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.vx += (cx2 - n.x) * 0.0008;
      n.vy += (cy2 - n.y) * 0.0008;
    }

    // Node-node repulsion
    for (i = 0; i < nodes.length; i++) {
      for (j = i + 1; j < nodes.length; j++) {
        dx = nodes[j].x - nodes[i].x;
        dy = nodes[j].y - nodes[i].y;
        d = Math.sqrt(dx * dx + dy * dy) || 1;
        force = 800 / (d * d);
        nodes[i].vx -= (dx / d) * force;
        nodes[i].vy -= (dy / d) * force;
        nodes[j].vx += (dx / d) * force;
        nodes[j].vy += (dy / d) * force;
      }
    }

    // Edge attraction
    edges.forEach(function(e) {
      var a = nodeMap[e.source], b = nodeMap[e.target];
      if (!a || !b) return;
      dx = b.x - a.x;
      dy = b.y - a.y;
      d = Math.sqrt(dx * dx + dy * dy) || 1;
      force = (d - 100) * 0.003;
      a.vx += (dx / d) * force;
      a.vy += (dy / d) * force;
      b.vx -= (dx / d) * force;
      b.vy -= (dy / d) * force;
    });

    // Apply velocity with damping + boundary clamping
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.vx *= 0.85;
      n.vy *= 0.85;
      n.x += n.vx;
      n.y += n.vy;
      n.x = Math.max(n.r + 10, Math.min(W - n.r - 10, n.x));
      n.y = Math.max(n.r + 10, Math.min(H - n.r - 10, n.y));
    }
  }

  // -- Draw helpers --
  function hexAlpha(hex, alpha) {
    return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }

  function drawArrowhead(x1, y1, x2, y2, size, color, alpha) {
    var angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size / 2.5);
    ctx.lineTo(-size, size / 2.5);
    ctx.closePath();
    ctx.fillStyle = hexAlpha(color, alpha);
    ctx.fill();
    ctx.restore();
  }

  function getEdgeStyle(type) {
    return EDGE_STYLES[type] || DEFAULT_EDGE;
  }

  // -- Draw frame --
  function draw() {
    ctx.clearRect(0, 0, W, H);
    frameCount++;

    // Find hovered node
    hoveredNode = null;
    for (var hi = 0; hi < nodes.length; hi++) {
      var dx = mouseX - nodes[hi].x, dy = mouseY - nodes[hi].y;
      if (Math.sqrt(dx * dx + dy * dy) < nodes[hi].r + 8) {
        hoveredNode = nodes[hi];
      }
    }

    // Compute connected set for hovered node
    var connectedIds = null;
    if (hoveredNode) {
      connectedIds = new Set();
      connectedIds.add(hoveredNode.id);
      if (adjacency[hoveredNode.id]) {
        adjacency[hoveredNode.id].forEach(function(nid) { connectedIds.add(nid); });
      }
    }

    // Spawn particles on random edges every 8 frames
    if (frameCount % 8 === 0 && edges.length > 0) {
      var pe = edges[Math.floor(Math.random() * edges.length)];
      var pa = nodeMap[pe.source], pb = nodeMap[pe.target];
      if (pa && pb) {
        particles.push({
          sx: pa.x, sy: pa.y, tx: pb.x, ty: pb.y,
          t: 0, speed: 0.008 + Math.random() * 0.012,
          color: pa.color || '#C9A050'
        });
      }
    }

    // Draw edges
    edges.forEach(function(e) {
      var a = nodeMap[e.source], b = nodeMap[e.target];
      if (!a || !b) return;
      var style = getEdgeStyle(e.type);
      var isHovered = hoveredNode && (e.source === hoveredNode.id || e.target === hoveredNode.id);
      var alpha, lw;

      if (hoveredNode) {
        if (isHovered) {
          alpha = 0.7;
          lw = style.width * 2;
        } else {
          alpha = 0.06;
          lw = style.width * 0.5;
        }
      } else {
        alpha = 0.35;
        lw = style.width;
      }

      // Highlight state overlay
      if (self._highlightState) {
        if (self._highlightState.edgeType && e.type === self._highlightState.edgeType) {
          alpha = 0.8; lw = style.width * 2;
        } else if (self._highlightState.ids && (self._highlightState.ids.has(e.source) || self._highlightState.ids.has(e.target))) {
          alpha = 0.6; lw = style.width * 1.5;
        }
      }

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = hexAlpha(style.color, alpha);
      ctx.lineWidth = lw;
      if (style.dash) { ctx.setLineDash(style.dash); } else { ctx.setLineDash([]); }
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      if (style.arrow) {
        drawArrowhead(a.x, a.y, b.x, b.y, 8, style.color, alpha);
      }
    });

    // Draw and update particles
    particles = particles.filter(function(p) {
      p.t += p.speed;
      if (p.t > 1) return false;
      var x = p.sx + (p.tx - p.sx) * p.t;
      var y = p.sy + (p.ty - p.sy) * p.t;
      var alpha = Math.sin(p.t * Math.PI);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(alpha * 200).toString(16).padStart(2, '0');
      ctx.fill();
      // Trail particle
      var tx = p.sx + (p.tx - p.sx) * (p.t - 0.03);
      var ty = p.sy + (p.ty - p.sy) * (p.t - 0.03);
      ctx.beginPath();
      ctx.arc(tx, ty, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.round(alpha * 80).toString(16).padStart(2, '0');
      ctx.fill();
      return true;
    });

    // Draw nodes
    nodes.forEach(function(n, ni) {
      var isHov = hoveredNode === n;
      var isConn = connectedIds ? connectedIds.has(n.id) : false;
      var alpha = hoveredNode ? (isHov || isConn ? 1 : 0.15) : 0.85;
      var color = n.color;

      // Highlight state alpha boost
      if (self._highlightState && self._highlightState.ids && self._highlightState.ids.has(n.id)) {
        alpha = 1;
      }

      // Ambient pulse for section-group nodes
      var pulseR = 0;
      if (n.cls === 'section-group' && !hoveredNode) {
        pulseR = Math.sin(frameCount * 0.03 + ni * 0.5) * 3;
      }

      // Glow ring on hovered or section-group
      if (isHov || n.cls === 'section-group') {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 10 + pulseR, 0, Math.PI * 2);
        var glow = ctx.createRadialGradient(n.x, n.y, n.r, n.x, n.y, n.r + 12 + pulseR);
        glow.addColorStop(0, color + (isHov ? '66' : '22'));
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + pulseR, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(color, alpha * 0.6);
      ctx.fill();
      ctx.strokeStyle = isHov ? '#ffffff' : hexAlpha(color, alpha > 0.5 ? 0.33 : 0.13);
      ctx.lineWidth = isHov ? 2.5 : (n.cls === 'section-group' ? 1.2 : 0.6);
      ctx.stroke();

      // Label
      var showLabel = n.r > 12 || isHov || isConn;
      if (showLabel) {
        var fontSize = isHov ? 14 : (n.r > 14 ? 13 : 11);
        var weight = isHov || n.r > 16 ? '600' : '400';
        ctx.font = weight + ' ' + fontSize + 'px Inter,sans-serif';
        ctx.fillStyle = 'rgba(238,240,244,' + alpha + ')';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(n.label, n.x, n.y + n.r + pulseR + 6);
      }
    });

    // Cursor
    canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
  }

  // -- Animation loop --
  function animate() {
    simulate();
    draw();
    animId = requestAnimationFrame(animate);
  }
  animate();

  // -- Store internals for prototype method access --
  this._s = {
    nodes: nodes, edges: edges, nodeMap: nodeMap,
    highlightState: highlightState,
    animId: animId, resizeObserver: resizeObserver,
    canvas: canvas, sizeCanvas: sizeCanvas,
    getW: function() { return W; }, getH: function() { return H; },
    setCx: function(v) { cx = v; }, setCy: function(v) { cy = v; }
  };
}

/**
 * Highlight a cluster by section name or edge type.
 * Auto-resets after 2 seconds.
 */
CanvasGraph.prototype.highlightCluster = function(group) {
  var s = this._s;
  var self = this;
  var nodes = s.nodes, edges = s.edges;

  // Clear previous
  if (self._highlightState && self._highlightState.timeout) clearTimeout(self._highlightState.timeout);

  var ids = new Set();
  var edgeType = null;

  // Check if group matches an edge type
  if (EDGE_STYLES[group]) {
    edgeType = group;
    edges.forEach(function(e) {
      if (e.type === group) { ids.add(e.source); ids.add(e.target); }
    });
  } else {
    // Section name match
    nodes.forEach(function(n) {
      if (n.data.section === group || n.id === group) ids.add(n.id);
    });
  }

  // Temporarily increase radius for highlighted nodes
  nodes.forEach(function(n) {
    if (ids.has(n.id)) n.r += 6;
  });

  self._highlightState = {
    ids: ids,
    edgeType: edgeType,
    timeout: setTimeout(function() {
      nodes.forEach(function(n) {
        if (ids.has(n.id)) n.r -= 6;
      });
      self._highlightState = null;
    }, 2000)
  };
};

/** Stop animation, remove canvas, clean up listeners. */
CanvasGraph.prototype.destroy = function() {
  var s = this._s;
  if (s.animId) cancelAnimationFrame(s.animId);
  s.animId = null;
  if (s.resizeObserver) s.resizeObserver.disconnect();
  if (s.canvas.parentElement) s.canvas.parentElement.removeChild(s.canvas);
};

/** Manually trigger resize (also handled by ResizeObserver). */
CanvasGraph.prototype.resize = function() {
  var s = this._s;
  s.sizeCanvas();
  s.setCx(s.getW() / 2);
  s.setCy(s.getH() / 2);
};

// Module exports
if (typeof window !== 'undefined') window.CanvasGraph = CanvasGraph;
if (typeof module !== 'undefined') module.exports = CanvasGraph;
