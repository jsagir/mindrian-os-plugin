'use strict';
// Presentation adapter only. The existing gate ledger and gate_answer own all decisions.
const { registerAppResource, RESOURCE_MIME_TYPE } = require('@modelcontextprotocol/ext-apps/server');
const { loadTemplate } = require('./app-views.cjs');
const URI = 'ui://mindrian-os/decision/v1.html';
const registered = new WeakSet();
const TOOL_META = Object.freeze({ ui: { resourceUri: URI, visibility: ['model', 'app'] } });

function registerGateApp(server) {
  if (registered.has(server)) return;
  // Lightweight non-App tool registrars (including core tests) may expose tools only.
  if (typeof server.registerResource !== 'function') return;
  registerAppResource(server, 'mindrian-decision', URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: URI, mimeType: RESOURCE_MIME_TYPE, text: loadTemplate('decision.html'),
      _meta: { ui: { prefersBorder: true, csp: {
        resourceDomains: ['https://cdn.jsdelivr.net'], connectDomains: [],
      } } } }],
  }));
  registered.add(server);
}

module.exports = { URI, TOOL_META, registerGateApp };
