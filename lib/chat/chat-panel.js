/**
 * MindrianOS Plugin -- BYOAPI Chat Panel
 * Embeddable vanilla JS chat panel for deployed presentation views.
 * Visitors provide their own Anthropic API key (stored in localStorage only).
 * Larry responds with room-scoped context via direct browser-to-API calls.
 *
 * Zero dependencies. Embeddable via script tag or CJS require.
 * Follows var/IIFE pattern matching canvas-graph.js.
 *
 * Usage:
 *   var panel = new ChatPanel(containerEl, { roomData: ROOM_DATA, onToolCall: fn });
 *   panel.destroy();
 */

'use strict';

var ChatPanel = (function() {

  // -- Minimal markdown renderer (~30 lines) --
  function renderMarkdown(text) {
    if (!text) return '';
    var html = text
      // Code blocks (``` ... ```)
      .replace(/```(\w*)\n?([\s\S]*?)```/g, function(_, lang, code) {
        return '<pre style="background:rgba(0,0,0,0.3);padding:8px;border-radius:4px;overflow-x:auto;font-size:12px;margin:6px 0"><code>' + escapeHtml(code.trim()) + '</code></pre>';
      })
      // Inline code
      .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Unordered lists
      .replace(/^[\s]*[-*]\s+(.+)$/gm, '<li style="margin-left:16px">$1</li>')
      // Ordered lists
      .replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li style="margin-left:16px">$1</li>')
      // Line breaks
      .replace(/\n/g, '<br>');
    return html;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // -- CSS injection --
  var CSS_INJECTED = false;
  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.mos-chat-toggle {',
      '  position: fixed; bottom: 20px; right: 20px; z-index: 10000;',
      '  background: var(--mondrian-yellow, #E8B931); color: #1A1A1A;',
      '  border: none; border-radius: 8px; padding: 10px 18px;',
      '  font-family: "DM Sans", sans-serif; font-size: 13px; font-weight: 600;',
      '  cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.4);',
      '  transition: transform 0.15s, box-shadow 0.15s;',
      '}',
      '.mos-chat-toggle:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.5); }',
      '',
      '.mos-chat-panel {',
      '  position: fixed; bottom: 20px; right: 20px; z-index: 10001;',
      '  width: 360px; height: 500px; max-height: 80vh;',
      '  background: var(--bg-card, #1E1E1E); border: 2px solid var(--border-color, #2A2A2A);',
      '  border-radius: 12px; display: flex; flex-direction: column;',
      '  box-shadow: 0 8px 32px rgba(0,0,0,0.5); overflow: hidden;',
      '  font-family: "DM Sans", sans-serif;',
      '}',
      '',
      '.mos-chat-header {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 12px 16px; background: var(--bg-secondary, #161616);',
      '  border-bottom: 2px solid var(--mondrian-yellow, #E8B931);',
      '  flex-shrink: 0;',
      '}',
      '.mos-chat-header h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text-primary, #EEF0F4); }',
      '.mos-chat-header-actions { display: flex; gap: 6px; align-items: center; }',
      '',
      '.mos-chat-btn {',
      '  background: none; border: 1px solid var(--border-color, #2A2A2A);',
      '  color: var(--text-secondary, #999); cursor: pointer;',
      '  padding: 3px 8px; border-radius: 4px; font-size: 11px;',
      '  font-family: "DM Sans", sans-serif;',
      '}',
      '.mos-chat-btn:hover { color: var(--text-primary, #EEF0F4); border-color: var(--text-secondary, #999); }',
      '',
      '.mos-chat-messages {',
      '  flex: 1; overflow-y: auto; padding: 12px; display: flex;',
      '  flex-direction: column; gap: 8px; min-height: 0;',
      '}',
      '',
      '.mos-chat-msg {',
      '  max-width: 85%; padding: 8px 12px; border-radius: 8px;',
      '  font-size: 13px; line-height: 1.5; color: var(--text-primary, #EEF0F4);',
      '  word-wrap: break-word;',
      '}',
      '.mos-chat-msg-user {',
      '  align-self: flex-end; background: var(--mondrian-blue, #1B3B6F);',
      '}',
      '.mos-chat-msg-assistant {',
      '  align-self: flex-start; background: rgba(255,255,255,0.06);',
      '}',
      '.mos-chat-msg-system {',
      '  align-self: center; color: var(--text-muted, #666); font-size: 11px;',
      '  text-align: center; padding: 4px 8px;',
      '}',
      '',
      '.mos-chat-input-area {',
      '  display: flex; gap: 8px; padding: 12px;',
      '  border-top: 1px solid var(--border-color, #2A2A2A); flex-shrink: 0;',
      '}',
      '.mos-chat-input-area textarea {',
      '  flex: 1; background: var(--bg-primary, #0D0D0D);',
      '  border: 1px solid var(--border-color, #2A2A2A); color: var(--text-primary, #EEF0F4);',
      '  border-radius: 6px; padding: 8px 10px; font-size: 13px; resize: none;',
      '  font-family: "DM Sans", sans-serif; min-height: 38px; max-height: 80px;',
      '}',
      '.mos-chat-input-area textarea:focus { outline: none; border-color: var(--mondrian-yellow, #E8B931); }',
      '.mos-chat-input-area textarea::placeholder { color: var(--text-muted, #666); }',
      '',
      '.mos-chat-send {',
      '  background: var(--mondrian-yellow, #E8B931); color: #1A1A1A;',
      '  border: none; border-radius: 6px; padding: 8px 14px;',
      '  font-weight: 600; cursor: pointer; font-size: 13px;',
      '  font-family: "DM Sans", sans-serif; flex-shrink: 0;',
      '}',
      '.mos-chat-send:hover { opacity: 0.9; }',
      '.mos-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }',
      '',
      '.mos-chat-key-form {',
      '  padding: 24px 16px; display: flex; flex-direction: column;',
      '  gap: 12px; align-items: center; flex: 1; justify-content: center;',
      '}',
      '.mos-chat-key-form input {',
      '  width: 100%; background: var(--bg-primary, #0D0D0D);',
      '  border: 1px solid var(--border-color, #2A2A2A); color: var(--text-primary, #EEF0F4);',
      '  border-radius: 6px; padding: 10px 12px; font-size: 13px;',
      '  font-family: "DM Sans", sans-serif;',
      '}',
      '.mos-chat-key-form input:focus { outline: none; border-color: var(--mondrian-yellow, #E8B931); }',
      '.mos-chat-key-form input::placeholder { color: var(--text-muted, #666); }',
      '.mos-chat-key-note {',
      '  font-size: 11px; color: var(--text-muted, #666); text-align: center; line-height: 1.4;',
      '}',
      '',
      '.mos-chat-streaming .mos-chat-send { opacity: 0.4; cursor: not-allowed; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  // -- Storage keys --
  var KEY_API = 'mos-api-key';
  var KEY_OPEN = 'mos-chat-open';

  // -- Constructor --
  function ChatPanel(containerEl, options) {
    if (!containerEl) throw new Error('ChatPanel: container element required');
    options = options || {};
    var self = this;

    self._container = containerEl;
    self._roomData = options.roomData || {};
    self._onToolCall = options.onToolCall || null;
    self._model = options.model || 'claude-sonnet-4-20250514';
    self._messages = []; // conversation history { role, content }
    self._streaming = false;
    self._destroyed = false;

    // Build context and system prompt
    var contextBuilder = (typeof ChatContext !== 'undefined') ? ChatContext : null;
    if (contextBuilder) {
      var roomCtx = contextBuilder.buildRoomContext(self._roomData);
      self._systemPrompt = contextBuilder.buildSystemPrompt(roomCtx);
    } else {
      self._systemPrompt = 'You are Larry, an AI innovation co-founder. Answer questions helpfully.';
    }

    injectCSS();
    self._build();
  }

  ChatPanel.prototype._build = function() {
    var self = this;
    var apiKey = self._getApiKey();

    // Toggle button
    self._toggleBtn = document.createElement('button');
    self._toggleBtn.className = 'mos-chat-toggle';
    self._toggleBtn.textContent = 'Chat with Larry';
    self._toggleBtn.addEventListener('click', function() { self._toggle(); });
    self._container.appendChild(self._toggleBtn);

    // Panel
    self._panel = document.createElement('div');
    self._panel.className = 'mos-chat-panel';
    self._panel.style.display = 'none';
    self._container.appendChild(self._panel);

    // Header
    var header = document.createElement('div');
    header.className = 'mos-chat-header';
    header.innerHTML = '<h3>Larry</h3><div class="mos-chat-header-actions"></div>';
    self._panel.appendChild(header);
    self._headerActions = header.querySelector('.mos-chat-header-actions');

    // Key management button (small icon)
    self._keyBtn = document.createElement('button');
    self._keyBtn.className = 'mos-chat-btn';
    self._keyBtn.textContent = 'Key';
    self._keyBtn.title = 'Manage API key';
    self._keyBtn.addEventListener('click', function() { self._showKeyForm(); });
    self._headerActions.appendChild(self._keyBtn);

    // Minimize button
    var minBtn = document.createElement('button');
    minBtn.className = 'mos-chat-btn';
    minBtn.textContent = 'Minimize';
    minBtn.addEventListener('click', function() { self._toggle(); });
    self._headerActions.appendChild(minBtn);

    // Body area (switches between key form and chat)
    self._body = document.createElement('div');
    self._body.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';
    self._panel.appendChild(self._body);

    if (apiKey) {
      self._showChat();
    } else {
      self._showKeyForm();
    }

    // Restore open state
    var wasOpen = localStorage.getItem(KEY_OPEN);
    if (wasOpen === 'true') {
      self._show();
    }
  };

  ChatPanel.prototype._getApiKey = function() {
    try { return localStorage.getItem(KEY_API) || ''; } catch (_) { return ''; }
  };

  ChatPanel.prototype._setApiKey = function(key) {
    try { localStorage.setItem(KEY_API, key); } catch (_) {}
  };

  ChatPanel.prototype._clearApiKey = function() {
    try { localStorage.removeItem(KEY_API); } catch (_) {}
  };

  ChatPanel.prototype._toggle = function() {
    var isVisible = this._panel.style.display !== 'none';
    if (isVisible) {
      this._hide();
    } else {
      this._show();
    }
  };

  ChatPanel.prototype._show = function() {
    this._panel.style.display = 'flex';
    this._toggleBtn.style.display = 'none';
    try { localStorage.setItem(KEY_OPEN, 'true'); } catch (_) {}
  };

  ChatPanel.prototype._hide = function() {
    this._panel.style.display = 'none';
    this._toggleBtn.style.display = 'block';
    try { localStorage.setItem(KEY_OPEN, 'false'); } catch (_) {}
  };

  ChatPanel.prototype._showKeyForm = function() {
    var self = this;
    self._body.innerHTML = '';

    var form = document.createElement('div');
    form.className = 'mos-chat-key-form';

    var input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'Enter your Anthropic API key to chat with Larry';
    input.value = self._getApiKey();
    form.appendChild(input);

    var saveBtn = document.createElement('button');
    saveBtn.className = 'mos-chat-send';
    saveBtn.textContent = 'Save Key';
    saveBtn.addEventListener('click', function() {
      var val = input.value.trim();
      if (!val) return;
      self._setApiKey(val);
      self._showChat();
    });
    form.appendChild(saveBtn);

    // Clear button (only if key exists)
    if (self._getApiKey()) {
      var clearBtn = document.createElement('button');
      clearBtn.className = 'mos-chat-btn';
      clearBtn.textContent = 'Clear Key';
      clearBtn.style.marginTop = '4px';
      clearBtn.addEventListener('click', function() {
        self._clearApiKey();
        input.value = '';
      });
      form.appendChild(clearBtn);
    }

    var note = document.createElement('div');
    note.className = 'mos-chat-key-note';
    note.textContent = 'Key stored in your browser only -- never sent to any server except Anthropic.';
    form.appendChild(note);

    // Enter key to save
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { saveBtn.click(); }
    });

    self._body.appendChild(form);
  };

  ChatPanel.prototype._showChat = function() {
    var self = this;
    self._body.innerHTML = '';

    // Messages area
    self._msgList = document.createElement('div');
    self._msgList.className = 'mos-chat-messages';
    self._body.appendChild(self._msgList);

    // Re-render existing messages
    for (var i = 0; i < self._messages.length; i++) {
      self._renderMessage(self._messages[i].role, self._messages[i].content);
    }

    // Welcome message if first time
    if (self._messages.length === 0) {
      self._addSystemMsg('Ask Larry about this room\'s content, sections, or knowledge graph.');
    }

    // Input area
    var inputArea = document.createElement('div');
    inputArea.className = 'mos-chat-input-area';
    self._body.appendChild(inputArea);

    self._textarea = document.createElement('textarea');
    self._textarea.placeholder = 'Ask Larry...';
    self._textarea.rows = 1;
    inputArea.appendChild(self._textarea);

    self._sendBtn = document.createElement('button');
    self._sendBtn.className = 'mos-chat-send';
    self._sendBtn.textContent = 'Send';
    inputArea.appendChild(self._sendBtn);

    self._sendBtn.addEventListener('click', function() { self._send(); });
    self._textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self._send();
      }
    });
  };

  ChatPanel.prototype._addSystemMsg = function(text) {
    var el = document.createElement('div');
    el.className = 'mos-chat-msg mos-chat-msg-system';
    el.textContent = text;
    this._msgList.appendChild(el);
    this._scrollToBottom();
  };

  ChatPanel.prototype._renderMessage = function(role, content) {
    var el = document.createElement('div');
    el.className = 'mos-chat-msg mos-chat-msg-' + role;
    if (role === 'assistant') {
      el.innerHTML = renderMarkdown(content);
    } else {
      el.textContent = content;
    }
    this._msgList.appendChild(el);
    this._scrollToBottom();
    return el;
  };

  ChatPanel.prototype._scrollToBottom = function() {
    var ml = this._msgList;
    if (ml) ml.scrollTop = ml.scrollHeight;
  };

  ChatPanel.prototype._send = function() {
    var self = this;
    if (self._streaming) return;
    var text = (self._textarea.value || '').trim();
    if (!text) return;

    self._textarea.value = '';

    // Add user message
    self._messages.push({ role: 'user', content: text });
    self._renderMessage('user', text);

    // Cap at 20 messages
    while (self._messages.length > 20) {
      self._messages.shift();
    }

    // Stream response
    self._streamResponse();
  };

  ChatPanel.prototype._streamResponse = function() {
    var self = this;
    var apiKey = self._getApiKey();
    if (!apiKey) {
      self._showKeyForm();
      return;
    }

    self._streaming = true;
    self._panel.classList.add('mos-chat-streaming');
    if (self._sendBtn) self._sendBtn.disabled = true;

    // Create assistant message element for streaming
    var assistantEl = self._renderMessage('assistant', '');
    var fullText = '';

    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: self._model,
        max_tokens: 1024,
        system: self._systemPrompt,
        messages: self._messages.slice(), // copy
        stream: true
      })
    }).then(function(response) {
      if (response.status === 401) {
        self._clearApiKey();
        assistantEl.className = 'mos-chat-msg mos-chat-msg-system';
        assistantEl.textContent = 'Invalid API key. Please enter a valid key.';
        self._endStream();
        self._showKeyForm();
        return;
      }
      if (!response.ok) {
        return response.text().then(function(errText) {
          var errMsg = 'Error (' + response.status + ')';
          try {
            var errJson = JSON.parse(errText);
            if (errJson.error && errJson.error.message) errMsg = errJson.error.message;
          } catch (_) {}
          assistantEl.className = 'mos-chat-msg mos-chat-msg-system';
          assistantEl.textContent = errMsg;
          self._endStream();
        });
      }

      // Parse SSE stream
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function readChunk() {
        return reader.read().then(function(result) {
          if (result.done) {
            self._finishMessage(fullText);
            self._endStream();
            return;
          }

          buffer += decoder.decode(result.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line.startsWith('data: ')) continue;
            var jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              var event = JSON.parse(jsonStr);

              if (event.type === 'content_block_delta' && event.delta && event.delta.type === 'text_delta') {
                fullText += event.delta.text;
                assistantEl.innerHTML = renderMarkdown(fullText);
                self._scrollToBottom();
              }

              if (event.type === 'message_stop') {
                self._finishMessage(fullText);
                self._endStream();
                return;
              }
            } catch (_) {
              // skip malformed JSON
            }
          }

          return readChunk();
        });
      }

      return readChunk();
    }).catch(function(err) {
      assistantEl.className = 'mos-chat-msg mos-chat-msg-system';
      assistantEl.textContent = 'Connection error: ' + (err.message || 'unknown');
      self._endStream();
    });
  };

  ChatPanel.prototype._finishMessage = function(text) {
    if (text) {
      this._messages.push({ role: 'assistant', content: text });
      // Cap at 20
      while (this._messages.length > 20) {
        this._messages.shift();
      }
    }
  };

  ChatPanel.prototype._endStream = function() {
    this._streaming = false;
    this._panel.classList.remove('mos-chat-streaming');
    if (this._sendBtn) this._sendBtn.disabled = false;
    if (this._textarea) this._textarea.focus();
  };

  ChatPanel.prototype.destroy = function() {
    this._destroyed = true;
    if (this._container) {
      this._container.innerHTML = '';
    }
  };

  return ChatPanel;

})();

// Module exports
if (typeof window !== 'undefined') window.ChatPanel = ChatPanel;
if (typeof module !== 'undefined') module.exports = ChatPanel;
