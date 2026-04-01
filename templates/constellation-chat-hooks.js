/**
 * MindrianOS Plugin -- Constellation Chat Hooks
 * Click handlers for injecting Constellation graph node/edge clicks
 * into the Fabric Chat panel via window.postMessage.
 *
 * Include this script in the Constellation view (or any Cytoscape-based view).
 * It attaches event listeners to the Cytoscape instance and sends messages
 * that the Fabric Chat panel listens for.
 *
 * Usage:
 *   <script src="constellation-chat-hooks.js"></script>
 *   // After Cytoscape init:
 *   ConstellationChatHooks.attach(cy);
 *
 * Or inline:
 *   cy.on('tap', 'node', function(evt) {
 *     window.postMessage({
 *       type: 'chat-inject',
 *       nodeId: evt.target.data('id'),
 *       label: evt.target.data('label') || evt.target.data('id'),
 *       nodeType: evt.target.data('nodeType') || 'Artifact'
 *     }, '*');
 *   });
 */

'use strict';

var ConstellationChatHooks = (function() {

  /**
   * Attach click handlers to a Cytoscape instance.
   * Node clicks inject context into the Fabric Chat panel.
   * @param {object} cy - Cytoscape instance
   */
  function attach(cy) {
    if (!cy || typeof cy.on !== 'function') {
      console.warn('ConstellationChatHooks: Invalid Cytoscape instance');
      return;
    }

    // Node tap -- inject context for the clicked Entry or Section
    cy.on('tap', 'node', function(evt) {
      var node = evt.target;
      var data = node.data();

      var nodeType = 'Artifact';
      // Detect Section nodes by class or property
      if (data.type === 'Section' || data.nodeType === 'Section' || node.hasClass('section-node')) {
        nodeType = 'Section';
      }

      window.postMessage({
        type: 'chat-inject',
        nodeId: data.id || '',
        label: data.label || data.title || data.id || '',
        nodeType: nodeType
      }, '*');
    });

    // Edge tap -- inject question about the Thread/relationship
    cy.on('tap', 'edge', function(evt) {
      var edge = evt.target;
      var data = edge.data();
      var sourceLabel = '';
      var targetLabel = '';

      try {
        sourceLabel = edge.source().data('label') || edge.source().data('title') || edge.source().data('id') || '';
        targetLabel = edge.target().data('label') || edge.target().data('title') || edge.target().data('id') || '';
      } catch (_) {}

      var threadType = data.type || data.label || 'connection';

      window.postMessage({
        type: 'chat-inject',
        nodeId: data.id || (data.source + '->' + data.target),
        label: threadType + ' between ' + sourceLabel + ' and ' + targetLabel,
        nodeType: 'Thread'
      }, '*');
    });
  }

  return { attach: attach };

})();

// Module exports
if (typeof window !== 'undefined') window.ConstellationChatHooks = ConstellationChatHooks;
if (typeof module !== 'undefined') module.exports = ConstellationChatHooks;
