/* Copyright (c) 2026 Mindrian. BSL 1.1. Shared MCP view lifecycle and honest identity. */
(function (root) {
  'use strict';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@2.0.3/dist/src/app-with-deps.js';
  const face = document.getElementById('mindrian-face');
  const status = document.getElementById('mindrian-status');
  root.MindrianIdentity = {
    setState(state, message) {
      face.innerHTML = root.MindrianFaces.renderFace(state);
      face.dataset.state = state;
      status.textContent = message;
    }
  };
  let current;
  function connect(toolName, render, options = {}) {
    let app, connected = false, pending = false, received = false, timer;
    let args = {};
    const allowed = ['room_path', ...(toolName === 'room-wiki' ? ['section'] : []), ...(toolName === 'room-graph' ? ['layout'] : [])];
    function setArguments(input) {
      for (const name of allowed) if (typeof input?.[name] === 'string') args[name] = input[name];
    }
    function fail(message) {
      clearTimeout(timer);
      pending = false;
      root.MindrianIdentity.setState('could', message);
    }
    function consumeResult(result) {
      received = true;
      clearTimeout(timer);
      try {
        if (result?.isError && !options.raw) throw new Error('The room read was refused. Check the selected room and try again.');
        const text = result?.content?.find(item => item.type === 'text')?.text;
        const data = result?.structuredContent ?? JSON.parse(text);
        if (!options.raw && (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.sections) ||
          !data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats))) {
          fail('The room returned unreadable data. Try refreshing this view.');
          return false;
        }
        render(data, result);
        root.MindrianIdentity.setState('rest', options.raw ? 'MindrianOS connected' : 'Room view ready');
        return true;
      } catch (error) {
        fail(error instanceof SyntaxError ? 'The room returned unreadable data. Try refreshing this view.' :
          (result?.isError ? error.message : 'This room view could not render its data. Try refreshing or reopening it.'));
        return false;
      } finally {
        pending = false;
      }
    }
    const controller = {
      setArguments,
      async callTool(name, arguments_) {
        if (!connected) throw new Error('MindrianOS is disconnected.');
        return app.callServerTool({ name, arguments: arguments_ }, { timeout: 60000 });
      },
      async sendMessage(text) {
        if (!connected) throw new Error('MindrianOS is disconnected.');
        return app.sendMessage({ role: 'user', content: [{ type: 'text', text }] });
      },
      async refresh() {
        if (pending) return false;
        if (!connected) { fail('The view is disconnected. Reopen it or reconnect MindrianOS.'); return false; }
        pending = true;
        clearTimeout(timer);
        root.MindrianIdentity.setState('think', 'Refreshing room view...');
        try { return consumeResult(await app.callServerTool({ name: toolName, arguments: { ...args } }, { timeout: 10000 })); }
        catch (_) { fail('The room refresh failed. Try again or reopen this view.'); return false; }
      },
      updateModelContext(context) {
        if (connected) app.updateModelContext(context).catch(() => {});
      }
    };
    current = controller;
    root.MindrianIdentity.setState('think', 'Connecting to room view...');
    (async () => {
      try {
        const { App } = await import(SDK_URL);
        app = new App({ name: 'MindrianOS ' + toolName, version: '1.0.0' }, {});
        // Initial notifications can arrive during the handshake. Register first.
        app.ontoolinput = params => setArguments(params.arguments);
        app.ontoolresult = consumeResult;
        app.ontoolcancelled = () => {
          received = true;
          fail('The room read was cancelled. Refresh or reopen this view.');
        };
        app.onerror = () => fail('The room connection failed. Reopen this view or reconnect MindrianOS.');
        app.onclose = () => { connected = false; fail('The room connection closed. Reopen this view or reconnect MindrianOS.'); };
        await app.connect(undefined, { timeout: 10000 });
        connected = true;
        if (!received) {
          root.MindrianIdentity.setState('think', 'Waiting for room data...');
          timer = setTimeout(() => fail('Room data did not arrive. Refresh or reopen this view.'), 10000);
        }
      } catch (_) { connected = false; fail('The room connection failed. Reopen this view or reconnect MindrianOS.'); }
    })();
    window.addEventListener('pagehide', () => { clearTimeout(timer); app?.close(); }, { once: true });
    return controller;
  }
  root.MindrianView = { connect, refresh: () => current?.refresh() };
})(globalThis);
