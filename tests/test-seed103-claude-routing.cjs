#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * SEED-103: lib/core/claude-routing.cjs is the one home for Claude model ids
 * under lib/. Hermetic: zero network, zero key.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const R = require(path.join(REPO_ROOT, 'lib/core/claude-routing.cjs'));

let PASS = 0; let FAIL = 0;
function ok(c, m) { if (c) PASS += 1; else { FAIL += 1; process.stderr.write('  FAIL: ' + m + '\n'); } }

// 1. Every role resolves to a full claude-* id by default, never a bare alias.
for (const role of R.ROLE_NAMES) {
  const id = R.resolveModelId(role);
  ok(/^claude-[a-z]+-[0-9]/.test(id), 'role ' + role + ' resolves to a full id (got ' + id + ')');
}
ok(R.ROLE_NAMES.indexOf('entity_classify') !== -1, 'entity_classify role exists');

// 2. Default is opus for every role (the claude-api rule: never downgrade by default).
for (const role of R.ROLE_NAMES) {
  ok(R.ROLES[role].alias === 'opus', 'role ' + role + ' defaults to opus');
}

// 3. Unknown role throws; bad override throws.
let threw = false; try { R.resolveModelId('no_such_role'); } catch (_e) { threw = true; }
ok(threw, 'unknown role throws');
threw = false; try { R.resolveModelId('chat', { override: 'gpt-4o' }); } catch (_e) { threw = true; }
ok(threw, 'non-claude override throws');

// 4. Overrides: alias and full id; env wins over default; explicit override wins over env.
ok(R.resolveModelId('chat', { override: 'haiku' }) === R.ALIAS_IDS.haiku, 'alias override resolves');
ok(R.resolveModelId('chat', { override: 'claude-sonnet-5-5' }) === 'claude-sonnet-5-5', 'full-id override passes through');
process.env.MINDRIAN_MODEL_CHAT = 'sonnet';
ok(R.resolveModelId('chat') === R.ALIAS_IDS.sonnet, 'env override applies');
ok(R.resolveModelId('chat', { override: 'opus' }) === R.ALIAS_IDS.opus, 'explicit override beats env');
delete process.env.MINDRIAN_MODEL_CHAT;

// 5. Request shape per generation.
const msgs = [{ role: 'user', content: 'x' }];
const b5 = R.buildMessagesBody('entity_classify', { system: 's', messages: msgs, temperature: 0, max_tokens: 500 });
ok(b5.model === 'claude-opus-5-5', '5.x body model');
ok(!('temperature' in b5), '5.x body drops temperature');
ok(!('thinking' in b5), '5.x body never sends thinking');
ok(b5.output_config && b5.output_config.effort === 'low', '5.x body carries effort low for entity_classify');
ok(b5.max_tokens >= 1024, '5.x body floors max_tokens for thinking (got ' + b5.max_tokens + ')');
const bh = R.buildMessagesBody('entity_classify', { messages: msgs, temperature: 0, max_tokens: 500 }, { override: 'haiku' });
ok(bh.model === 'claude-haiku-4-5', 'haiku body model');
ok(bh.temperature === 0, 'haiku body keeps temperature');
ok(!('output_config' in bh), 'haiku body has no output_config');
ok(bh.max_tokens === 500, 'haiku body keeps max_tokens');
threw = false; try { R.buildMessagesBody('chat', { messages: [] }); } catch (_e) { threw = true; }
ok(threw, 'empty messages throws');

// 6. textOf skips thinking blocks.
ok(R.textOf({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }) === 'ab', 'textOf concatenates text blocks only');

// 7. routingTable shape.
const t = R.routingTable();
ok(t.length === R.ROLE_NAMES.length && t.every(function (r) { return r.role && r.model && r.source; }), 'routingTable rows');

// 8. Tripwire: no other file under lib/ hardcodes a claude-* model id.
// Allowed: this module; test files; comments are stripped before the grep.
let hits = [];
try {
  const out = execFileSync('grep', ['-rnoE', 'claude-(haiku|sonnet|opus|fable|mythos|3)[-a-z0-9.]*', 'lib', '--include=*.cjs', '--include=*.js'], { cwd: REPO_ROOT, encoding: 'utf8' });
  hits = out.split('\n').filter(Boolean).filter(function (line) {
    const file = line.split(':')[0];
    if (file === 'lib/core/claude-routing.cjs') return false;
    if (/\.test\.cjs$/.test(file) || /test-/.test(path.basename(file))) return false;
    if (/skillopt-schemas\.cjs$/.test(file)) return false; // self-test fixtures inside that module
    // Browser-targeted chat bundle (window.FabricChat / document.*): it cannot require the
    // router, so its literal is updated by hand and pinned here to the router's opus id.
    if (/^lib\/chat\/(fabric-chat\.cjs|chat-panel\.js)$/.test(file)) {
      const hit = line.split(':').slice(2).join(':');
      if (hit === R.ALIAS_IDS.opus) return false;
      return true;
    }
    // strip comment-only lines
    const src = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8').split('\n');
    const ln = Number(line.split(':')[1]);
    const text = src[ln - 1] || '';
    if (/^\s*(\/\/|\*|\/\*)/.test(text)) return false;
    return true;
  });
} catch (e) {
  if (!(e && e.status === 1)) throw e; // grep exit 1 = no matches
}
ok(hits.length === 0, 'no hardcoded claude-* id under lib/ outside claude-routing.cjs: ' + hits.join(' | '));

if (FAIL > 0) { process.stderr.write('test-seed103-claude-routing: ' + FAIL + ' FAILED, ' + PASS + ' passed\n'); process.exit(1); }
process.stdout.write('test-seed103-claude-routing: ' + PASS + ' assertions passed\n');
