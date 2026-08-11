# Gate 0 - Cursor on Windows: navigator's live observation (VERBATIM external record)

Recorded 2026-08-11. Preserved as delivered (em-dashes preserved per the verbatim-record
convention). This closes 234-08 Task 2's observation requirement. Sign-off block appended.

---

**Tester:** jsagi (navigator) / **Machine:** Windows 11 (build 10.0.26200) / **Host:** Cursor
(Agent mode) / **Date:** 2026-08-11 / **Caveat:** NOT a cold install (WSL, marketplace
plugin, hand-tuned mcp.json pre-existing).

Install config: C:\Users\jsagi\.cursor\mcp.json, two servers via WSL bridge
(wsl.exe -> bash -> node v22.23.1), plugin root mos/2.0.0-beta.5, env from
/home/jsagi/.mindrian.env, MINDRIAN_ROOMS_HOME set. VS Code not tested.

Load behavior: FOUR server identities (duplicate registration: plugin-mos-* AND user-*),
all ready; 36 OS tools + 6 Brain tools, twice. Cold-start stderr showed capabilities
active=[apps], MCP Apps registered (room-dashboard/wiki/graph). (Note: a manual WSL
launch stderr printed "v2.0.0-beta.6 started" - that launch resolved the DEV checkout,
which sits at the beta.6 next-bump placeholder; the cache install is beta.5.)

WORKED: catalog loads (36+6 discoverable); WSL+Node22 path clean; skills catalog visible;
room ops via WSL scripts (lunar-water-site created); marketplace at 2.0.0-beta.5.

FAILED / SURPRISED:
- Duplicate MCP servers (marketplace + user mcp.json both register) - Medium.
- Native Windows Node + Linux paths -> path mangling C:\home\... MODULE_NOT_FOUND -
  Blocker without WSL (confirms 234-08 static finding).
- WSL system Node v20.19.5 -> ERR_UNKNOWN_BUILTIN_MODULE node:sqlite - Node >= 22.5 required.
- One brain_ask returned tier_0_brain_unreachable despite key present - Medium
  (cold-start/restart timing suspected).
- Tools return "NOT EXECUTED - follow Reference steps" instruction surfaces - expected
  by design on foreign hosts, but confusing without docs.
- chain_run -> gate_render_failed: MCP -32001 Request timed out on the 4-step chain - High.
- room_bind -> { ok:false, reason:"no_session_id" } - Medium (session binding not wired
  on this MCP client path; the CTX-03 real-host deferral, now observed).
- No /mos:* slash commands on Cursor - by design.

WINDOWS DOCS NOTES: never native-Node+Linux-paths; document Node 22+ prominently; warn
against dual registration; uncheck "Automatically install necessary tools" in the Node
installer; first Brain call may be slow (Render idle wake 30-60s).

VERDICT (this machine): install/servers/catalog PASS (with WSL bridge); Brain PARTIAL
(one probe failed); call-and-done end-to-end FAIL (instruction-surface model + gate
timeout); cold path NOT TESTED / likely FAIL; VS Code NOT TESTED.
**Overall: PASS with caveats** - Tier-0 MCP load proven on Cursor+Windows given
WSL + Node 22 + manual mcp.json. Zero-handholding cold path unproven.

FOLLOW-UPS: Cursor-specific install snippet; deduplicate registration; investigate
gate_render -32001; fresh-VM cold-path Gate 0; VS Code + Copilot attempt.

---

## Sign-off block

| Field | Value |
|---|---|
| Gate | 0 (foreign-host live verification, 234-08 Task 2) |
| Machine | Windows 11 build 10.0.26200, WSL Ubuntu, Node 22.23.1 (nvm) |
| Host | Cursor, Agent mode |
| Plugin | mos@2.0.0-beta.5 (mindrian-marketplace) |
| Verdict | PASS with caveats (see criterion table above) |
| Observed by | navigator (jsagi), 2026-08-11 |
| Recorded by | dev session, commit accompanying this file |
| Gap items | .planning/debug/gate0-cursor-windows-gaps.md (3 defects, routed) |

## ADDENDUM (2026-08-11, post-restart): Gate 0 COMPLETE - PASS

Second navigator report after Cursor restart: both servers connect in 1-2s
(idle -> connecting -> connected), MCP Apps registered (room-dashboard/wiki/graph),
room bound (lunar-water-site), and LIVE tool calls verified: status_read OK (tier0,
write path enabled), room_state OK (Pre-Opportunity, 1 artifact), brain_stats OK
(Memgraph, 28,325 / 23,014), brain_search OK (0.94-0.96 hits), brain_ask GUIDED mode
working as designed (grounding-or-reframe; text2cypher arm disabled_pending_schema_trim
by policy). The earlier Brain PARTIAL flips to PASS.

Navigator's completion statement (verbatim): "Installed Mindrian in Cursor on Windows.
On load, mindrian-os and mindrian-brain MCP servers connected successfully, registered
three MCP Apps, bound to room lunar-water-site, and responded to live tool calls.
Brain graph is live with 28k+ nodes. Gate 0: PASS."

NEW OBSERVATION, upgrades gap item 3: the plugin-channel copy runs NATIVE Windows Node
at v1.16.0-beta.13 alongside the WSL beta.5 - the duplicate registration is
VERSION-SKEWED, and beta.13 is the dead-Brain-leg build. Severity raised to HIGH in
.planning/debug/gate0-cursor-windows-gaps.md: an agent addressing the plugin-channel
instance gets the pre-fix Brain behavior. Recommended immediate operator action:
remove or update the plugin-channel registration so only ONE version serves.
