// Spike 007: assemble the forensic results.json from the recorded facts and probe outputs.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const r = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ev = [];
const add = (label, data) => ev.push(Object.assign({ label }, data));
add('license_check', { checked: '2026-10-02', repo: 'github.com/BuilderIO/agent-native', commit: '8aae00fb0f8abd6a385eafefc4ef83d408ea0925 (2026-10-01)', root_package_json: { name: 'agentnative', license: 'ISC', role: 'private monorepo root' }, readme_license_section: 'MIT', license_files_in_repo: ['packages/vscode-extension/LICENSE.md (MIT, Copyright (c) Builder.io)'], root_LICENSE_file: false, npm_core: { name: '@agent-native/core', version: '0.198.8', license_field: 'MIT', license_text_file_in_tarball: false, bundled_font_licenses: ['LICENSE_GEIST', 'LICENSE_LIBERATION', 'LICENSE_NOTO_NASKH_ARABIC'] }, published_packages: 'every non-private @agent-native/* package declares MIT; templates private, no field', blocks_commercial_use: false });
add('scaffold', { command: 'npx --yes @agent-native/core@0.198.8 create mos-ui --standalone --template chat', stack: 'React Router 8.1 + Vite 8.1 + Nitro/h3, zod 4, React 19', db_dev: 'PGlite (mos-ui/data/pglite): UI session, chat, auth tables only', cli_telemetry_default: 'on, https://analytics.agent-native.com/track; opt-out DO_NOT_TRACK=1 or AGENT_NATIVE_TELEMETRY_DISABLED=1', nested_claude_md: 'scaffold writes CLAUDE.md + .claude/skills + .mcp.json; the CLAUDE.md auto-loaded into the running Claude session when a file in the folder was read', dev_server_bind: '*:8080 (all interfaces); PTY terminal server on 127.0.0.1:42003', readme_import_drift: 'README imports useActionQuery from @agent-native/core/client; 0.198 refuses it; home is @agent-native/core/client/hooks', setup_sh_rebuild_s: 17 });
add('actions_http_burn_probe', Object.assign({ app: 'prod 127.0.0.1:8090', root_cause: 'lib/mcp/gate-ledger.cjs:100 consumeGate deletes the entry before the session check' }, r('stages/02_actions/burn-probe.out.json')));
add('agent_native_as_mcp_client_direct', { result: 'not connected', error: fs.readFileSync(path.join(root, 'stages/02_actions/an-mcp-client-probe.direct.txt'), 'utf8').split('\n')[0], handshake_trace: ['POST server/discover (protocol 2026-07-28, no session) -> 400 Server not initialized', 'POST initialize -> 200 + mcp-session-id', 'POST notifications/initialized -> 202', 'agent-native connect guard already recorded the 400 via transport.onerror -> server marked not connected'], sdk: { agent_native: '@modelcontextprotocol/client 2.0.0', mindrian_os: '@modelcontextprotocol/sdk ^1.30.1' } });
add('agent_native_as_mcp_client_with_discover_shim', Object.assign({ shim: 'session-less server/discover -> HTTP 200 JSON-RPC -32601; HTTP 404 still fails' }, r('stages/02_actions/an-mcp-client-probe.with-shim.json')));
add('prod_build', { build_s: 77, bundle: '27.4 MB (8.91 MB gzip)', db: 'production refuses PGlite (ensureSchemaObject refusing to issue DDL); agent chat, automations, integrations error at boot; actions and the gate route work', server_non_loopback_peers_sampled: [] });
add('real_room_note', { finding: 'the real room changes during runs come from the installed mos plugin hooks (on-stop set, STATE.md) of live Claude sessions with this room active; .mindrian changed at 03:11:34, before the 03:11:53 stack start; stack-only controls change nothing' });
for (const [k, f] of [['dev', 'results-dev.json'], ['prod', 'results-prod.json'], ['prod_fresh_setup', 'results-prod-fresh-setup.json']]) {
  for (const e of r('stages/03_click-test/output/' + f)) ev.push(Object.assign({}, e, { label: k + '.' + e.label }));
}
fs.writeFileSync(path.join(root, 'results.json'), JSON.stringify(ev, null, 1));
console.log(ev.length + ' events');
