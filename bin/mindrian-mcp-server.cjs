#!/usr/bin/env node
'use strict';

// Forwarding shim (Phase 369.1, D-10): the real file is scripts/mindrian-mcp-server.cjs.
// Kept for one release so configs and tests that name bin/mindrian-mcp-server.cjs keep working;
// Chat and Cowork refuse a plugin with a top-level bin/ directory, so the Desktop copy ships without bin/.

require('../scripts/mindrian-mcp-server.cjs');
