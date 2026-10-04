#!/usr/bin/env node
'use strict';

// Forwarding shim (Phase 369.1, D-10): the real file is scripts/mindrian-tools.cjs.
// Kept for one release so configs and tests that name bin/mindrian-tools.cjs keep working;
// Chat and Cowork refuse a plugin with a top-level bin/ directory, so the Desktop copy ships without bin/.

require('../scripts/mindrian-tools.cjs');
