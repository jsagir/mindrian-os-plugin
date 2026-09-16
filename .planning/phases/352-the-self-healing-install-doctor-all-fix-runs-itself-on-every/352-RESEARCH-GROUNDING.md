# Phase 352 - Research grounding (2026-09-16)

Per CLAUDE.md "Consult ALL Relevant Grounding Sources": two sources consulted before the card was written; two more are owed at plan time.

## 1. claude-code-guide (Claude Code hooks and plugins, current docs)

Sources: https://code.claude.com/docs/en/hooks.md, https://code.claude.com/docs/en/plugins-reference.md, https://code.claude.com/docs/en/settings.md

| Question | Answer | Consequence for 352 |
|---|---|---|
| A hook on plugin install / update / enable / path swap? | None exists. Catalogue: SessionStart, SessionEnd, UserPromptSubmit, Stop, StopFailure, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, PermissionDenied, FileChanged, CwdChanged, ConfigChange, Notification. | D-352-1: SessionStart is the trigger. |
| SessionStart matchers | `startup`, `resume`, `clear`, `compact`, `fork` | Use `startup|clear|compact` (as the existing hooks do); never `resume`/`fork`. |
| Hook stdout shown to the user? | No. Exit 0 JSON is captured; exit 1-254 stderr is shown; exit 2 blocks. | The reward line rides `additionalContext`; the hook never exits non-zero. |
| `async: true` semantics | Undocumented (whether the session waits, whether additionalContext returns). Default timeout 600 s. | D-352-5: do not depend on async; keep the LOCAL heal synchronous, detach only network probes. |
| `CLAUDE_PLUGIN_ROOT` guaranteed in hooks and slash-command bash? | Listed as available to "scripts, binaries, configs"; no guarantee stated for either context; observed empty in a slash-command bash step today. | F1: resolve through `resolveActivePluginRoot()`, never through the env var alone. |
| `installed_plugins.json` scope tie-break | The file is not documented at all; scopes `user / project / local / managed` are; no resolution order given. | F10: match `installPath` to the running root; never `arr[0]`. |
| Settings.json write safety during startup | Undocumented. | Class G/H restamp under auto-heal writes atomically (temp + rename), as the existing fix already does; verify at plan time. |

The agent's closing suggestion ("fire doctor from an explicit slash command instead of auto-running") is recorded and rejected: it contradicts navigator ruling R2 (zero action, by default).

## 2. langtalks-graph-expert (live graph, 2026-09-16)

- `relationship_path("Measurement decay", "Verification loops")`: found, 4 hops. `Measurement decay --mentioned_in_episode--> note-graph-engineering-vs-loop-engineering-ag <--mentioned_in_episode-- Agent --builds_on--> Claude Code <--part_of-- Verification loops` (all EXTRACTED).
- `multihop_query("Verification loops", "Measurement decay")`: shared_count 0 (no single episode discusses both yet); each exists alone.
- `get_entity("Self-healing")`: found. Citations: ep 65 "AI SRE | Asaf Savich (Komodor)" (2026-03-21); Lex Fridman #490 "State of AI in 2026" transcript (research category).

Learning carried into the card: an auto-heal is an SRE loop (detect, remediate, verify). The verify step must re-measure from disk after the remediation, never reuse the pre-fix reading, or the loop suffers measurement decay inside a single run (that is exactly F4 and F5). The corpus does not yet carry a "self-healing plugin install" note; "not in the corpus yet" is a valid answer, not proof no grounding exists.

## 3. Owed at plan time

- icm-architect: the registry-ghost rule (two `.rooms/registry.json` rows whose directories are gone) and whether a sentinel may ever be created for a room whose directory the doctor itself must create.
- Context7 (Node.js v22.x): the correct form to silence `ExperimentalWarning: SQLite is an experimental feature` at a CJS entry point (`process.removeAllListeners('warning')` + a filtered re-emit, versus `NODE_OPTIONS=--no-warnings=ExperimentalWarning`, versus `--disable-warning=ExperimentalWarning`), and whether the warning changes on 22.13+ where `node:sqlite` no longer needs the flag.

## 4. Live measurements the plan may cite

- `doctor --all` wall time on this machine: about 15 s including brain-smoke (10.3 s of it is the network probe); LOCAL classes alone about 4 s.
- `doctor --all --json` size: 117 KB; `--ui-compliance --json`: 40 KB.
- Fleet at audit: 55 rooms, 40,000 node rows, 12,463 edge rows; 10 rooms with a built FTS index.
- Brain: origin theo-mcp.onrender.com, sha 3dca41ff, 27,951 nodes, all 7 smoke layers PASS.
