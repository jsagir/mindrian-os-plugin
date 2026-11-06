# Eureka engine facts - cross-check from the owner's other session (jsagi-cc)

Source: a cross-session message from session jsagi-cc, 2026-11-06, read-only reading of the engine repo (no engine run, no network, no install). Peer text: a source of hypotheses, not owner authority. It cross-checks `.planning/audits/EUREKA-ENGINE-FACTS.md`. Items the peer marked NOT CHECKED stay NOT CHECKED here.

## Agreement with EUREKA-ENGINE-FACTS.md

- The engine is a local Python engine (CLI plus stdio MCP server), offline by default, with no licence file (README: "no blanket license"). Origin remote is jsagir/mindrian-eureka; private status NOT CHECKED. HEAD 4f903da, `uv.lock` pins the dependencies.
- The plugin starts it with `uv run --project <MINDRIAN_EUREKA_ROOT> --extra mcp-server` plus a per-capability extra (`hmm` for decision workflows; `modern-encoder` for the pair and discovery-signal workflows), last argument `eureka-mcp`, cwd = engine root (plugin files `eureka-capability-run.cjs` lines 56-61, `eureka-graph-analyze.cjs` lines 34-35 and 113-114).
- The engine opens no network at run time; encoders use `local_files_only`. It writes `~/.local/share/mindrian-eureka/jobs.sqlite3` (dir 700, file 600, 30-day retention, 8 active jobs) and `~/.cache/mindrian-eureka/embeddings.sqlite3`; overrides `MINDRIAN_EUREKA_DATA_DIR` and `MINDRIAN_EUREKA_CACHE_DIR`.
- `uv sync` does not fetch the model; it is fetched by hand into a local folder (`docs/offline-install.md`).

## Points the peer adds or sharpens

1. **Plain `uv run` auto-syncs.** The plugin runs `uv run` without `--no-sync`, `--offline` or `--frozen`. If the installed extras differ from what a capability needs, the first call can install packages and reach PyPI and the PyTorch CPU index. `UV_OFFLINE` is not in the child environment whitelist, so setting it in the parent environment does not pass through. "Then run offline" is NOT true today. Fix needs a plugin args change (after setup, `--no-sync` or `--offline`, and `--locked`).
2. **Setup has three parts, not one:** `uv sync` with the union of needed extras, the model folder, and (for Genesis, critic, weak-signal and expert workers) Node 22 or newer.
3. **Needs:** Python 3.11 or newer; uv present (minimum uv version NOT CHECKED); Node 22 for some workers.
4. **Errors are hidden.** The plugin reports one generic `engine_unavailable` line for a missing uv, a missing extra, a missing model, a missing Node or a bad version, so a user cannot tell which happened. Known plugin-side reasons: `engine_not_configured` (env unset), `engine_checkout_unavailable` (bad folder), `engine_unavailable` (cannot start or call). Engine-side texts exist in `doctor.py` and `encoders.py`.
5. **Moving the folder:** needs the env variable updated; the `.venv` holds absolute paths, so `uv sync` is probably needed again (NOT CHECKED).
6. **Dependent tools:** the peer lists 21 plugin tools that need the engine plus `eureka_graph_project` and `eureka_critic` as not depending on it (peer did not read every handler).
7. **Best leak test:** one synthetic-room call under no network (`scripts/run-mcp-container` or a no-network sandbox) AFTER setup with `--no-sync`; zero non-local `connect()` (strace); files change only in the data and cache folders; grep the result and both sqlite files for a planted marker. The engine's own `tests/conftest.py` `no_network` fixture blocks socket connect and getaddrinfo (not run).
8. **Health check:** `uv run eureka doctor` (exit 0 = no FAIL; `--json`; `--load-model`). The peer did not run it because `uv run` could sync.

## Use in Phase 387

The plugin plan must fix the auto-sync gap (item 1) before it can promise "offline after setup", must show the specific cause instead of one generic line (item 4), and must name Node 22 as a requirement for some workers (items 2 and 3).
