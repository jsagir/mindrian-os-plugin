# Phase 387 decision card: the Eureka engine home, fetch, uv and network terms

Date: 2026-11-06. Written by plan 387-02 task 1. Read-only. The engine was not run. No uv sync, no network, no room data.
Labels: PROVEN = the executor read the line or ran the command. UNVERIFIED = it was not run or not read. ASSUMED = taken from a plan or a message, not checked.
Engine folder read: /home/jsagi/dev/mindrian-eureka (metadata and single lines only; no engine source is copied here).
Plugin facts come from `.planning/debug/eureka-engine-unreachable-on-normal-install.md` (the plan 387-01 RCA).

PART 0 Facts

Engine repo and licence
- F0.1 Origin remote is `https://github.com/jsagir/mindrian-eureka.git`. PROVEN (`git remote -v`). HEAD is 4f903da1a1c99d86bb5f25fa98d57eadf9f629ad, 2026-10-29 (`git log -1`). PROVEN. Only `story/` files are modified in the working tree. PROVEN (`git status --short`).
- F0.2 The repo is private. ASSUMED (from the phase plan). UNVERIFIED: `gh repo view --json visibility,isPrivate,licenseInfo` was NOT run, because the task rules for this run forbid network access.
- F0.3 There is no licence file. PROVEN (`ls LICENSE*` found nothing).
- F0.4 Licence sentence (README.md line 329): "This repo has no blanket license because some source-derived methods still need rights review." PROVEN (`grep -n -i licen README.md`).
- F0.5 The release record `docs/rs-release-gate.md` says `decision: no-go` for public distribution of the unusual-pairs engine, and `partner_internal_decision: approve` for one named partner on its own machine, "not public, not redistributable". Its own status line says `status: draft`. PROVEN (frontmatter of the file). This is a rights fact for Part 2.

Engine packaging
- F0.6 `pyproject.toml`: project name `mindrian-eureka`, `requires-python = ">=3.11"`. PROVEN (grep).
- F0.7 Extras: `mcp-server`, `modern-encoder`, `reference-encoder`, `hmm`, `hub-gate`, `neo4j`. PROVEN (grep). One uv index named `pytorch-cpu` at `https://download.pytorch.org/whl/cpu`. PROVEN (grep).
- F0.8 `uv.lock` exists. PROVEN. The folder is 493 MB without `.venv` and `.git` (`du -sh`, folder includes dist, build and story assets). PROVEN. The existing `.venv` on this machine is 1.3 GB. PROVEN (`du -sh`).
- F0.9 The `hmm` extra pins `pomegranate==1.1.2`. The lock entry holds a source archive (sdist) AND one universal wheel (`py3-none-any`). PROVEN (read of the lock lines). So the audit claim that this package has only a source build is NOT supported by the lock. Whether the dependencies of the `hmm` extra (and the Python versions the lock covers) all have wheels: UNVERIFIED.

This machine (read-only checks, run from an empty scratch folder)
- F0.10 `command -v uv` gives `/home/jsagi/.local/bin/uv`; `uv --version` gives `uv 0.9.4`. PROVEN.
- F0.11 `uv python find --no-project` and `uv python find --no-project '>=3.11'` both give a managed `cpython-3.13.9` interpreter under `~/.local/share/uv/python`. PROVEN. `python3 --version` gives `Python 3.12.3`. PROVEN. `node --version` gives `v22.23.1`. PROVEN.

Plugin side (from the 387-01 RCA, all PROVEN on the installed layout)
- F0.12 The tool list holds 24 tools whose name starts with eureka (75 tools in total), the same for both client identities. 22 need the engine. 19 refuse with `engine_not_configured` and 3 job tools with `job_session_not_found` when no engine is set. `eureka_graph_project` answers when a room is bound. `eureka_critic` is broken on every install because `evals/eureka/212-critic-baseline.json` is not shipped (a separate defect, not an owner fork).
- F0.13 The text of the 4 refusals today: `engine_not_configured`: "Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool." `engine_checkout_unavailable`: "The configured Mindrian Eureka checkout is unavailable." `engine_unavailable`: a generic line, no cause (5 variants). `job_session_not_found`: "No active Eureka MCP session owns this job_id. Jobs cannot resume after the MindrianOS host process restarts; start a new job."
- F0.14 Offline rule today: only the graph workflow path sets `UV_OFFLINE`, `HF_HUB_OFFLINE` and `TRANSFORMERS_OFFLINE` to 1 (17 of 17 calls). The generic, async and scout paths set none of them. PROVEN (S6 log).
- F0.15 Every engine start is a plain `uv run --project <root> --extra mcp-server ...`. None of `--no-sync`, `--offline`, `--frozen`, `--locked`, `--no-python-downloads` is passed (4 of 4 argument lists). PROVEN (S6 log).
- F0.16 The plugin doc `docs/integrations/mindrian-eureka-engine.md` (line 73) says: "The first call may install that package extra; the model must already be available locally because the engine does not download models during a run." PROVEN (grep).
- F0.17 `/mos:eureka` (the research planner perspective) needs no engine. It answered ok on the installed layout with no engine, 2 pairs recalled, 0 network attempts. PROVEN. `/mos:eureka-portfolio` needs the local measuring tool (installed by `/mos:eureka enable`, about 380 MB), not the engine; the plugin text says so (`scripts/eureka-portfolio.cjs` line 67). PROVEN (read).
- F0.18 `lib/core/cache-prune.cjs` prunes the versioned plugin cache under `~/.claude/plugins/` and removes every folder that is not kept (header comments, lines 6 to 28); the encoder lives in `~/.mindrian/eureka-deps` (`lib/core/eureka-deps-resolver.cjs` line 17). The same reason applies to an engine folder. PROVEN for the header text; that prune removes an engine folder placed in the cache was not run: UNVERIFIED.
- F0.19 Part 8: room text never leaves the machine to the Brain or any outside service. The Phase 341 tripwire (`tests/test-341-eureka-no-brain-reach.cjs`, arm 3) names the encoder install as the one sanctioned Eureka egress. ASSUMED (taken from the phase plan; not re-read in this task).

The 6 engine audit points, re-read in the engine folder (single lines, no source copied)
- F0.20 (a) A plain `uv run` can sync: the plugin passes no `--no-sync`, `--offline` or `--frozen` (F0.15). The uv behaviour itself (that it installs a missing extra) is UNVERIFIED here; the engine was not run.
- F0.21 (b) uv sync gives packages and no model weights. The engine loads models with `local_files_only`: `encoders.py` lines 20, 64 and 67 pass `local_files_only=not allow_download`, and `analogy_fitness.py` line 128 and `hsi_engine.py` line 99 pass `allow_download=False`. `docs/offline-install.md` says to fetch the `all-MiniLM-L6-v2` model folder by hand and point `MINDRIAN_EUREKA_RS_MODEL_PATH` at it. PROVEN (read of those lines). So the scout, hsi and analogy routes need a model folder that uv sync does not give. PROVEN as a consequence of those lines; the exact "No local model found." text was not re-read: UNVERIFIED.
- F0.22 (c) The audit says the `hmm` extra needs `pomegranate`, which has only a source build. The lock contradicts this for pomegranate itself: it lists a universal wheel next to the sdist (F0.9). A compiler need for other packages of the extra is UNVERIFIED. PROVEN: the contradiction for pomegranate. Re-check before the grant card names a compiler.
- F0.23 (d) uv may fetch a managed Python from github.com unless `--no-python-downloads` is passed. UNVERIFIED as run behaviour. This machine already resolves a managed Python (F0.11), so uv does use managed interpreters here. The flag exists (F0.28).
- F0.24 (e) Some workers need Node.js 22 or newer: `workflow_handlers.py` lines 170, 182, 229, 239 and 287 raise `NodeRuntimeUnavailable` ("RS expert extraction requires Node.js 22 or newer" and two more). PROVEN.
- F0.25 (f) The engine writes outside its folder. `jobs.py` line 38 sets `jobs.sqlite3` in its data folder; `cache.py` lines 143 to 144 set `embeddings.sqlite3` in `~/.cache/mindrian-eureka`; `jobs.py` line 389 also names `embeddings.sqlite3` in the data folder. `mcp_server.py` `main()` touches the job manager before serving ("initialize private local data directory before serving"), so even a graph-only call creates the data folder. PROVEN (read). Both folders exist on this machine now, with `jobs.sqlite3` in `~/.local/share/mindrian-eureka` and `embeddings.sqlite3` in both folders. PROVEN (`ls`). `uv run` also writes `.venv` inside the engine folder. PROVEN here only as the existing 1.3 GB `.venv`; that uv creates it on every first run is uv behaviour: UNVERIFIED.
- F0.26 The engine ships its own `eureka doctor`: it checks Python 3.11 or newer (`MIN_PYTHON = (3, 11, 0)`), uv, the encoder libraries, the local model, the cache folder, the data folder and the offline variables (`docs/offline-install.md` line 52). PROVEN (read). It needs the encoder libraries, so it cannot be the only check.

The uv flags the plan relies on (run from an empty scratch folder with no project; this starts no engine)
- F0.27 `uv run --help` lists `--no-sync`, `--locked`, `--frozen`, `--offline` and `--no-python-downloads`. PROVEN. `uv sync --help` lists `--locked`, `--frozen`, `--offline` and `--no-python-downloads`. PROVEN.
- F0.28 `uv run --no-sync --locked --offline --no-python-downloads --no-project -- true` exits 0 and prints two warnings that `--locked` and `--no-sync` have no effect together with `--no-project`. PROVEN. So the flags parse together. Their effect inside the engine project is UNVERIFIED (the engine project was not used).

PART 1 Where the engine lives
- user-side-dir (RECOMMENDED). A folder outside the plugin. The plugin finds it in this order: the environment override MINDRIAN_EUREKA_ROOT, then a saved setting file `~/.mindrian/eureka-engine.json` that `/mos:eureka enable engine` writes, then the default folder `~/.mindrian/eureka-engine/`. It survives plugin updates. CLI and Desktop on one machine read the same setting. A person does not set a variable by hand.
- env-only (today). The path comes from one shell variable. A Desktop app started from a menu has no shell variable. Not recommended.
- plugin-cache. The folder would sit inside the plugin cache, which is deleted at every update. Not recommended.

PART 2 Whether the plugin may fetch the engine
- none (RECOMMENDED). The plugin never downloads, clones or ships the engine. `enable` adopts a checkout the person already has. Reason: the repo is private, has no licence, and its own release record says no-go for public distribution (F0.4, F0.5).
- release-artifact. The owner licenses and publishes a pinned, hash-checked release first. Plans 387-03 and 387-04 are replanned to add a fetch step.
- private-clone. `git clone` with the person's own credentials. It works only for people with access, and it puts a private repo address into a commercial plugin.

PART 3 What setup needs (uv, Python, Node, packages, model)
- check-and-explain (RECOMMENDED). Setup is three parts. (1) Python packages, from `uv sync --locked --no-python-downloads` for the union of extras the person wants. (2) A model folder that the person places, because the engine never downloads one and uv sync gives no weights (F0.21). (3) Node.js 22 or newer for some workers (F0.24). `enable` checks `uv --version`, `uv python find --no-project` against the requires-python value from the engine's `pyproject.toml`, `node --version`, the installed extras and the model folder. It prints one plain line for each miss: missing uv, wrong Python, missing Node or wrong Node version, missing extra, missing model, bad folder. For uv it gives the official uv install page. The plugin never installs uv, Python or Node and never downloads a model.
- plugin-installs-uv. The plugin runs a remote install script. Not recommended.

PART 4 Licence and network terms
- sync-on-grant-then-offline (RECOMMENDED). The only network step is `uv sync --locked --no-python-downloads` with `--extra mcp-server` plus the extras the person asks for (`modern-encoder`, `reference-encoder`, `hmm`). It sits behind a grant card that lists every host it could reach: pypi.org and files.pythonhosted.org; download.pytorch.org when an encoder extra is chosen; github.com is not reached because Python downloads are off. The grant card also names every write: the `.venv` in the engine folder at setup; at run time the engine writes `jobs.sqlite3` in its data folder `~/.local/share/mindrian-eureka` and `embeddings.sqlite3` in its cache folder `~/.cache/mindrian-eureka` (and a second `embeddings.sqlite3` in the data folder), even for a graph-only call; the plugin deletes neither file. The `hmm` extra pins pomegranate, which the lock lists with a universal wheel (F0.9), so a compiler is probably not needed; that is UNVERIFIED for the other packages of the extra. The plugin never fetches model weights. After setup every engine run passes `--no-sync`, `--offline`, `--locked` and `--no-python-downloads` in the uv arguments, not only in the environment, so a partial setup becomes a typed refusal with the fix and never a silent install. MINDRIAN_EUREKA_ALLOW_NETWORK=1 lifts the rule. The enable text says the plugin does not include or download the engine. Honest limit: offline holds for the graph tools after step 1. The scout, pair and analogy tools also need the model folder of step 2, and otherwise refuse with a typed model-missing state.
- keep-current-split (today). A plain `uv run` on every path (F0.15), so a missing extra can make uv install packages and reach a package index at call time. Only the graph workflows get `UV_OFFLINE` (F0.14). This leaves a Canon Part 8 gap. Not recommended.

PART 5 Tool surface when no engine exists
- keep-registered-typed-refusal (RECOMMENDED). Every Eureka tool the runtime lists (24, measured in plan 387-01) stays in tools/list. Each of the 22 engine tools refuses with one typed state and one fix line, from one text source. `eureka_graph_project` and `eureka_critic` need no engine.
- register-only-when-present. The 22 engine tools disappear until the engine exists. It saves about 7,000 characters of tools/list (ASSUMED, from the phase plan). Larry cannot name the missing capability, and Desktop needs a restart to see the tools.

RECOMMENDATION
Option A is all 5 RECOMMENDED options together.
- Part 1, user-side-dir: one saved setting works on CLI and Desktop and survives updates, with no hand-set variable.
- Part 2, none: the engine repo is private, has no licence, and its release record says no-go for public distribution, so the plugin must not make that rights decision.
- Part 3, check-and-explain: setup has three parts and a failure in any of them is told apart in plain words, with no install by the plugin.
- Part 4, sync-on-grant-then-offline: one granted network step, then every run is offline by argument, which closes the Part 8 gap that F0.15 shows.
- Part 5, keep-registered-typed-refusal: Larry can always name what is missing and how to fix it.

WHAT CHANGES IF NOT A
For each part, these plans change. They stop and are replanned.
- Part 1 (engine home): 387-03 (resolver and requirements map), 387-09 (enable command), 387-04 (command text), 387-05 and 387-11 (tool states), 387-07 (doctor), 387-08 (docs).
- Part 2 (fetch): 387-03 and 387-04 gain a fetch step (release-artifact or private-clone); 387-09 (enable command) gains the fetch and a hash check; 387-08 (docs) and 387-06 (egress) list the new host; a licence decision comes first.
- Part 3 (uv, Python, Node, model): 387-03 (requirements map), 387-09 (enable command), 387-11 (typed reasons), 387-07 (doctor), 387-08 (docs).
- Part 4 (network terms): 387-06 (egress arguments and fake-engine tests), 387-09 (grant card), 387-10 (owner-run live leak test), 387-08 (docs).
- Part 5 (tool surface): 387-05 and 387-11 (tool states and registration), 387-07 (doctor), 387-04 (command text), 387-08 (docs).

THE QUESTION
NEEDS_HUMAN: Approve option A for Phase 387 (adopt an engine checkout the person already has, never fetch or ship it, check uv, Python, Node, packages and model with plain messages, one granted packages step that writes the .venv in the engine folder, then every engine run offline with no auto-sync, where the engine writes jobs.sqlite3 under ~/.local/share/mindrian-eureka and embeddings.sqlite3 under ~/.cache/mindrian-eureka, keep every Eureka tool listed with typed refusals), or name the part and the option to change?
