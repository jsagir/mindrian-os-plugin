#!/usr/bin/env bash
# Phase 127-00 (Task 3) -- live JSON-RPC handshake harness for the mindrian-brain
# stdio shim + .mcp.json shape validation.
#
# Test coverage (Tests 1-9 per 127-00-PLAN.md behavior block):
#   1. .mcp.json is valid JSON
#   2. .mcp.json has both mindrian-os AND mindrian-brain mcpServers entries
#   3. mindrian-brain.command === "node"
#   4. mindrian-brain.args[0] matches ${CLAUDE_PLUGIN_ROOT}/bin/mindrian-brain-mcp-client.cjs
#   5. mindrian-brain.alwaysLoad === true
#   6. mindrian-os also uses ${CLAUDE_PLUGIN_ROOT}/bin/... pattern (consistency)
#   7. Live JSON-RPC initialize handshake under hermetic HOME with no key
#   8. Live tools/call brain_schema returns DIRECTOR_NOT_AVAILABLE
#   9. Live tools/call brain_ask returns DirectiveEnvelope with mode GUIDED,
#      mode_rationale brain_unreachable, the 3 user_override keys
#
# Constraints:
#   - Hermetic HOME via mktemp; MINDRIAN_BRAIN_KEY explicitly unset
#   - 30s total timeout to prevent CI hangs
#   - No em-dashes (HARD RULE)
#
# Run: bash tests/test-127-00-shim-handshake.sh
# Exit: 0 on all 9 tests PASS; non-zero on any failure.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0
FAILED_NAMES=()

ok() {
  PASS=$((PASS + 1))
  printf '  ok %s\n' "$1"
}

fail() {
  FAIL=$((FAIL + 1))
  FAILED_NAMES+=("$1")
  printf '  FAIL %s\n' "$1"
  if [ -n "${2:-}" ]; then
    printf '    %s\n' "$2"
  fi
}

# Overall hard timeout (in seconds). Background watchdog kills the script if
# the harness wedges (covers any future regression where the shim hangs on
# stdin without writing an MCP initialize response).
HARNESS_TIMEOUT=30
( sleep "$HARNESS_TIMEOUT" && kill -KILL $$ 2>/dev/null ) &
WATCHDOG_PID=$!
trap 'kill $WATCHDOG_PID 2>/dev/null || true' EXIT

# ---------------------------------------------------------------------------
# Tests 1-6: .mcp.json shape validation.
# ---------------------------------------------------------------------------
NODE_OUT=$(node -e '
  const m = require("./.mcp.json");
  const out = {};
  out.valid_json = true;
  out.has_mindrian_os = !!(m.mcpServers && m.mcpServers["mindrian-os"]);
  out.has_mindrian_brain = !!(m.mcpServers && m.mcpServers["mindrian-brain"]);
  if (out.has_mindrian_brain) {
    out.brain_command = m.mcpServers["mindrian-brain"].command;
    out.brain_args0 = m.mcpServers["mindrian-brain"].args && m.mcpServers["mindrian-brain"].args[0];
    out.brain_always_load = m.mcpServers["mindrian-brain"].alwaysLoad;
  }
  if (out.has_mindrian_os) {
    out.os_args0 = m.mcpServers["mindrian-os"].args && m.mcpServers["mindrian-os"].args[0];
  }
  process.stdout.write(JSON.stringify(out));
' 2>/dev/null) || NODE_OUT=""

if [ -z "$NODE_OUT" ]; then
  fail "Test 1: .mcp.json is valid JSON" ".mcp.json failed to parse"
else
  ok "Test 1: .mcp.json is valid JSON"
fi

# Test 2: both keys
node -e '
  const m = require("./.mcp.json");
  process.exit(m.mcpServers && m.mcpServers["mindrian-os"] && m.mcpServers["mindrian-brain"] ? 0 : 1);
' >/dev/null 2>&1 && ok "Test 2: .mcp.json has both mindrian-os and mindrian-brain entries" || fail "Test 2: .mcp.json has both mindrian-os and mindrian-brain entries"

# Test 3: brain.command === "node"
node -e '
  const m = require("./.mcp.json");
  process.exit(m.mcpServers["mindrian-brain"].command === "node" ? 0 : 1);
' >/dev/null 2>&1 && ok "Test 3: mindrian-brain.command === \"node\"" || fail "Test 3: mindrian-brain.command === \"node\""

# Test 4: brain.args[0] matches ${CLAUDE_PLUGIN_ROOT}/bin/mindrian-brain-mcp-client.cjs
node -e '
  const m = require("./.mcp.json");
  const a = m.mcpServers["mindrian-brain"].args[0];
  const re = /^\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/mindrian-brain-mcp-client\.cjs$/;
  process.exit(re.test(a) ? 0 : 1);
' >/dev/null 2>&1 && ok "Test 4: mindrian-brain.args[0] uses \${CLAUDE_PLUGIN_ROOT} pattern" || fail "Test 4: mindrian-brain.args[0] uses \${CLAUDE_PLUGIN_ROOT} pattern"

# Test 5: brain.alwaysLoad === true
node -e '
  const m = require("./.mcp.json");
  process.exit(m.mcpServers["mindrian-brain"].alwaysLoad === true ? 0 : 1);
' >/dev/null 2>&1 && ok "Test 5: mindrian-brain.alwaysLoad === true" || fail "Test 5: mindrian-brain.alwaysLoad === true"

# Test 6: mindrian-os also uses ${CLAUDE_PLUGIN_ROOT}/bin/... pattern
node -e '
  const m = require("./.mcp.json");
  const a = m.mcpServers["mindrian-os"].args[0];
  const re = /^\$\{CLAUDE_PLUGIN_ROOT\}\/bin\/mindrian-mcp-server\.cjs$/;
  process.exit(re.test(a) ? 0 : 1);
' >/dev/null 2>&1 && ok "Test 6: mindrian-os.args[0] uses \${CLAUDE_PLUGIN_ROOT} pattern (consistency)" || fail "Test 6: mindrian-os.args[0] uses \${CLAUDE_PLUGIN_ROOT} pattern (consistency)"

# ---------------------------------------------------------------------------
# Tests 7-9: live JSON-RPC handshake under hermetic HOME with no key.
#
# Implementation strategy: a single inline Node script handles all three
# (initialize + tools/call brain_schema + tools/call brain_ask) by spawning
# the shim once, writing 3 requests, reading 3 responses. Returns JSON
# describing each test result to stdout; bash reads + branches.
# ---------------------------------------------------------------------------
TEMPDIR=$(mktemp -d -t mindrian-brain-shim-127-XXXXXX)
# Ensure cleanup even if the harness is killed by the watchdog.
trap 'rm -rf "$TEMPDIR"; kill $WATCHDOG_PID 2>/dev/null || true' EXIT

# Make sure no stale env contaminates the hermetic spawn.
# Phase 250-04 (HONEST-03): MINDRIAN_DISABLE_AUTO_REGISTER=1 keeps Test 8's
# no-key DIRECTOR_NOT_AVAILABLE assertion deterministic once the live
# /register endpoint exists -- without this, a live harness run would
# silently register (mint a real token against the deployed Brain) and the
# DIRECTOR_NOT_AVAILABLE fixture below would break.
LIVE_OUT=$(HOME="$TEMPDIR" XDG_CONFIG_HOME="$TEMPDIR/.config" MINDRIAN_DISABLE_AUTO_REGISTER=1 env -u MINDRIAN_BRAIN_KEY \
  node -e '
    "use strict";
    const cp = require("child_process");
    const path = require("path");

    const SHIM = path.resolve(process.cwd(), "bin/mindrian-brain-mcp-client.cjs");
    const proc = cp.spawn("node", [SHIM], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const PROTOCOL_VERSION = "2024-11-05";
    const initReq = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "harness-127-00", version: "1.0.0" },
      },
    };
    const initializedNotif = { jsonrpc: "2.0", method: "notifications/initialized" };
    const schemaReq = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "brain_schema", arguments: {} },
    };
    const askReq = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "brain_ask", arguments: { question: "what frameworks chain from SWOT?" } },
    };

    let stdoutBuf = "";
    const responses = new Map();
    let resolveDone;
    const doneP = new Promise((r) => { resolveDone = r; });

    proc.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf8");
      let nl;
      while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          if (obj && typeof obj.id !== "undefined") {
            responses.set(obj.id, obj);
            if (responses.has(1) && responses.has(2) && responses.has(3)) {
              resolveDone();
            }
          }
        } catch (_e) { /* non-JSON stdout line; ignore */ }
      }
    });

    // Stash stderr so we can dump on failure.
    let stderrBuf = "";
    proc.stderr.on("data", (c) => { stderrBuf += c.toString("utf8"); });

    proc.on("error", (err) => {
      console.error(JSON.stringify({ fatal: "spawn_error", message: err.message }));
      process.exit(2);
    });

    const TIMEOUT_MS = 5000;
    const timer = setTimeout(() => {
      console.error(JSON.stringify({
        fatal: "timeout",
        seen_ids: Array.from(responses.keys()),
        stderr: stderrBuf.slice(-500),
      }));
      try { proc.kill("SIGKILL"); } catch (_e) {}
      process.exit(2);
    }, TIMEOUT_MS);

    function send(obj) {
      proc.stdin.write(JSON.stringify(obj) + "\n");
    }

    // Initialize handshake, then send tools/call requests.
    send(initReq);
    // Per MCP spec, send notifications/initialized after the server replies.
    // We send it eagerly after a tiny tick so we cover both strict-and-loose
    // implementations.
    setTimeout(() => {
      send(initializedNotif);
      send(schemaReq);
      send(askReq);
    }, 50);

    doneP.then(() => {
      clearTimeout(timer);
      const out = {
        init: responses.get(1) || null,
        schema_call: responses.get(2) || null,
        ask_call: responses.get(3) || null,
        stderr_tail: stderrBuf.slice(-200),
      };
      process.stdout.write("---HARNESS_RESULT_START---\n");
      process.stdout.write(JSON.stringify(out));
      process.stdout.write("\n---HARNESS_RESULT_END---\n");
      try { proc.kill("SIGTERM"); } catch (_e) {}
      // Give the SIGTERM a moment to drain, then exit.
      setTimeout(() => process.exit(0), 50);
    });
  ' 2>/dev/null)

# Extract the result JSON between the delimiters.
RESULT_JSON=$(printf '%s\n' "$LIVE_OUT" | awk '/---HARNESS_RESULT_START---/{flag=1;next}/---HARNESS_RESULT_END---/{flag=0}flag')

if [ -z "$RESULT_JSON" ]; then
  fail "Test 7: live JSON-RPC initialize handshake" "no harness result produced"
  fail "Test 8: live tools/call brain_schema returns DIRECTOR_NOT_AVAILABLE" "no harness result produced"
  fail "Test 9: live tools/call brain_ask returns DirectiveEnvelope GUIDED brain_unreachable" "no harness result produced"
else
  # Test 7: initialize response with serverInfo.name === "mindrian-brain"
  INIT_OK=$(printf '%s' "$RESULT_JSON" | node -e '
    let buf = "";
    process.stdin.on("data", (d) => { buf += d.toString("utf8"); });
    process.stdin.on("end", () => {
      try {
        const r = JSON.parse(buf);
        const init = r.init;
        const ok = init && init.result && init.result.serverInfo
          && init.result.serverInfo.name === "mindrian-brain"
          && typeof init.result.serverInfo.version === "string"
          && init.result.serverInfo.version.length > 0;
        process.stdout.write(ok ? "PASS" : ("FAIL:" + JSON.stringify(init)));
      } catch (e) { process.stdout.write("FAIL:parse:" + e.message); }
    });
  ' 2>/dev/null)
  if [ "$INIT_OK" = "PASS" ]; then
    ok "Test 7: live JSON-RPC initialize -> serverInfo.name == mindrian-brain"
  else
    fail "Test 7: live JSON-RPC initialize -> serverInfo.name == mindrian-brain" "$INIT_OK"
  fi

  # Test 8: brain_schema keyless refusal sentinel (byte-locked wire string).
  SCHEMA_OK=$(printf '%s' "$RESULT_JSON" | node -e '
    let buf = "";
    process.stdin.on("data", (d) => { buf += d.toString("utf8"); });
    process.stdin.on("end", () => {
      try {
        const r = JSON.parse(buf);
        const c = r.schema_call;
        const content = c && c.result && c.result.content && c.result.content[0];
        if (!content || content.type !== "text") {
          process.stdout.write("FAIL:no_text_content:" + JSON.stringify(c));
          return;
        }
        const parsed = JSON.parse(content.text);
        const ok = parsed.status === "DIRECTOR_NOT_AVAILABLE"
          && /MINDRIAN_BRAIN_KEY not set/.test(parsed.reason)
          && /brain-access/.test(parsed.upgrade_hint)
          && /Larry/.test(parsed.fallback_advice);
        process.stdout.write(ok ? "PASS" : ("FAIL:" + JSON.stringify(parsed)));
      } catch (e) { process.stdout.write("FAIL:parse:" + e.message); }
    });
  ' 2>/dev/null)
  if [ "$SCHEMA_OK" = "PASS" ]; then
    ok "Test 8: live tools/call brain_schema refuses with DIRECTOR_NOT_AVAILABLE (keyless, no methodology served)"
  else
    fail "Test 8: live tools/call brain_schema refuses with DIRECTOR_NOT_AVAILABLE (keyless, no methodology served)" "$SCHEMA_OK"
  fi

  # Test 9: brain_ask DirectiveEnvelope shape.
  ASK_OK=$(printf '%s' "$RESULT_JSON" | node -e '
    let buf = "";
    process.stdin.on("data", (d) => { buf += d.toString("utf8"); });
    process.stdin.on("end", () => {
      try {
        const r = JSON.parse(buf);
        const c = r.ask_call;
        const content = c && c.result && c.result.content && c.result.content[0];
        if (!content || content.type !== "text") {
          process.stdout.write("FAIL:no_text_content:" + JSON.stringify(c));
          return;
        }
        const parsed = JSON.parse(content.text);
        const okShape = parsed.packet_version === "1.0"
          && parsed.packet_type === "DirectiveEnvelope"
          && parsed.mode === "GUIDED"
          && parsed.mode_rationale === "brain_unreachable"
          && parsed.user_override
          && Object.prototype.hasOwnProperty.call(parsed.user_override, "just tell me")
          && Object.prototype.hasOwnProperty.call(parsed.user_override, "let me think")
          && Object.prototype.hasOwnProperty.call(parsed.user_override, "stop");
        process.stdout.write(okShape ? "PASS" : ("FAIL:" + JSON.stringify(parsed)));
      } catch (e) { process.stdout.write("FAIL:parse:" + e.message); }
    });
  ' 2>/dev/null)
  if [ "$ASK_OK" = "PASS" ]; then
    ok "Test 9: live tools/call brain_ask returns DirectiveEnvelope GUIDED brain_unreachable"
  else
    fail "Test 9: live tools/call brain_ask returns DirectiveEnvelope GUIDED brain_unreachable" "$ASK_OK"
  fi
fi

# ---------------------------------------------------------------------------
# Summary.
# ---------------------------------------------------------------------------
printf '\n'
printf 'PASSED: %s\n' "$PASS"
printf 'FAILED: %s\n' "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf 'FAILED TESTS:\n'
  for n in "${FAILED_NAMES[@]}"; do
    printf '  - %s\n' "$n"
  done
  exit 1
fi
printf 'ALL 9 HANDSHAKE TESTS PASS\n'
exit 0
