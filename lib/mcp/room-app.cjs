'use strict';
// Entry view only: room binding, memory and reads remain existing tool operations.
const { registerAppResource, RESOURCE_MIME_TYPE } = require('@modelcontextprotocol/ext-apps/server');
const { loadTemplate } = require('./app-views.cjs');
const URI = 'ui://mindrian-os/rooms/v4.html';
const registered = new WeakSet();
const TOOL_META = Object.freeze({ ui: { resourceUri: URI, visibility: ['model', 'app'] } });
function registerRoomApp(server) {
  if (registered.has(server) || typeof server.registerResource !== 'function') return;
  registerAppResource(server, 'mindrian-rooms', URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: URI, mimeType: RESOURCE_MIME_TYPE, text: loadTemplate('rooms.html'),
      _meta: { ui: { prefersBorder: true, csp: {
        resourceDomains: ['https://cdn.jsdelivr.net', 'data:'], connectDomains: [],
      } } } }],
  }));
  registered.add(server);
}
module.exports = { URI, TOOL_META, registerRoomApp };
