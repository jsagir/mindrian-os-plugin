# 341-06 cold-install proof - Linux arm (captured by the orchestrator, 2026-09-10)

Artifact under proof: @mindrian_os/cli@2.0.0-beta.31 (npm dist.unpackedSize 29,129,059 bytes, dist.fileCount
1,833; marketplace source npm pinned 2.0.0-beta.31; tag v2.0.0-beta.31 at origin; released via the rewired
ceremony, exit 0, full acceptance 20/20; in-ceremony payload ceiling: entryCount=1833 unpackedSize=29129059 OK).

| Evidence item | Result |
|---|---|
| Command | `claude plugin update mos@mindrian-marketplace` (user scope), after `claude plugin marketplace update` (run by the ceremony's Step 10) |
| Outcome | "Plugin mos updated from 2.0.0-beta.27 to 2.0.0-beta.31 for scope user. Restart to apply changes." exit 0 |
| Elapsed | 24 s (the same command on 2026-09-09 against the git source ran past 300 s twice and died with `fatal: early EOF`) |
| installed_plugins.json | user scope version 2.0.0-beta.31, installPath ~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.31 |
| Cache entry size | 73 MB (beta.23 / .25 / .27 entries on this box: 597 MB each) |
| Loader second install | node_modules present, 123 top-level entries (from the shipped npm-shrinkwrap.json) |
| Root layout | .claude-plugin/plugin.json and npm-shrinkwrap.json at the cache root |
| MCP server: mindrian-os | `bin/mindrian-mcp-server.cjs` answers initialize + tools/list over stdio from the cache dir: serverInfo.version 2.0.0-beta.31, 40 tools |
| MCP server: mindrian-brain | `bin/mindrian-brain-mcp-client.cjs`: serverInfo.version 2.0.0-beta.31, 6 tools |
| Class S (installed copy) | 5 layers: deps_present ok, vec_backend ok, model_probe ok, graceful_degrade ok, model_installed NO (advisory; the honest slim state, enable command not run) |
| `doctor --acceptance --pre-flight` from the cache dir | FAIL verify-release-clean-tree ("git status failed"): that tier asserts a clean git tree and a plugin cache is not a repository; not applicable to an installed copy (a finding for 341-09/10: the user-side tier must not include dev-repo points) |
| Platform | Linux (this dev box), Claude Code CLI; Desktop/Cowork not present here: A6 for Linux = DEFERRED (no hookless host on this machine) |

Not captured here: a fresh-machine first install (this was an update over beta.27); Windows 11 and macOS arms
(navigator, real machines); the A6 verdict for Desktop/Cowork.

Addendum: `doctor --install-state --json` on the installed copy, before restart: install-state WARN with 3
findings (record-stale, vor-IP-vs-AV, vor-IP-vs-LV) = the install path is beta.31 while this still-running
session's active version is beta.27 ("Restart to apply changes"); deployment-surfaces OK (6/6 reconciled).
This is the exact pre-restart state D-07a's first-session verification exists to surface honestly; it clears
on the first session after restart and is not a defect of the artifact.
