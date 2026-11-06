# Phase 387 leak test runbook (owner-run)

Date written: 2026-11-06
Status of the real-engine proof: NOT RUN. Nobody has run this test against the real engine.

## What this test proves

It makes one graph call to the real Eureka engine. The call carries a synthetic snapshot with a planted marker. The plugin makes the call the same way it does for you, with `--no-sync`, `--offline`, `--locked` and `--no-python-downloads`. The test watches the call with strace.

It checks four things (the pass criteria):

1. No non-local connect. The call and every child process it starts make zero connect calls to an address that is not local. Local means a unix socket, 127.0.0.0/8, ::1 and ::ffff:127.x. A failed connect still counts as an attempt.
2. Changes only in the data and cache folders. Every file that changed lies under the engine data folder or the engine cache folder. The test puts both in a scratch place, and the scratch HOME must stay unchanged.
3. Engine folder and uv.lock unchanged. The engine folder, its `.venv` and its `uv.lock` do not change. Python bytecode files are listed as noise: they are shown in the output and never make the test fail.
4. Marker not in the sqlite files. The planted marker is in no file under the data and cache folders after the job ends. This covers `jobs.sqlite3`, `embeddings.sqlite3` and their `-wal` and `-shm` files.

## What this test does not prove

- It proves one graph call (`graph.explore_local_relationships`). It does not prove every route.
- The scout and pair routes need a model folder. Test them in a second run after you place a model.
- strace traces only connect calls. A program could still send data by another path. The no-network run below covers that: inside `unshare -rn` every connect to a non-local address fails, and the call shows the failure.
- A PASS covers the plugin version and the engine commit you tested. Nothing else.

## Preparation

1. Use a Linux machine. Install `strace` (for example `sudo apt install strace`).
2. Have the engine folder you already use. The plugin does not download it.
3. Prepare the engine once: `/mos:eureka enable engine --path <engine folder>` and then `/mos:eureka enable engine --sync`. Approve the grant card. This is the only step that uses the network.
4. Run `/mos:eureka enable engine --check`. It must say the engine is set up and ready.
5. Write down two things now: the plugin version (`node lib/core/repo-version.cjs`) and the engine commit (`git -C <engine folder> rev-parse HEAD`).
6. If you use a custom environment folder, set `UV_PROJECT_ENVIRONMENT` in your shell. The test passes that one variable on.

The test uses scratch folders for HOME, the data folder and the cache folder. It reads none of your real data.

## Commands

Run these from the plugin folder.

Run 1, strace only:

```
MINDRIAN_EUREKA_LIVE_LEAK=1 MINDRIAN_EUREKA_ROOT=<engine folder> node tests/test-387-eureka-live-leak.cjs
```

Run 2, the no-network run. It runs the same call inside a network namespace with no network (`unshare -rn`):

```
MINDRIAN_EUREKA_LIVE_LEAK=1 MINDRIAN_EUREKA_LEAK_NO_NET=1 MINDRIAN_EUREKA_ROOT=<engine folder> node tests/test-387-eureka-live-leak.cjs
```

If `unshare -rn` is not allowed on your machine, the test says SKIPPED with that reason. Then use the strace result of Run 1.

Without the opt-in the test prints SKIPPED and exits with code 77. The phase runner `bash tests/run-all-387.sh` runs it that way.

## How to read the result

Each line starts with PASS or FAIL. The end of the output says RESULT: PASS or RESULT: FAIL.

| Line | A FAIL means |
|------|--------------|
| the graph call completed | The call did not finish. The four criteria prove nothing. Read the reason in the output and fix the setup first. |
| no non-local connect | The engine or a child tried to reach an address that is not local. The line names the family and the address. This is a Part 8 breach. Stop using the engine for room text and report it. |
| changes only in the data and cache folders | The call wrote a file outside the data and cache folders. The line names the files. Check whether uv or the engine wrote them. |
| engine folder and uv.lock unchanged | The call changed the engine folder, the `.venv` or `uv.lock`. A run with `--no-sync` should not do this. Report the files. |
| marker not in the sqlite files | The planted marker was found on disk. The engine kept request text. The line names the file and the count. This is a Part 8 finding for the engine. |

The information lines show the local connects, the unix sockets, the files written in the data and cache folders, and the marker count in the result file. The engine may echo input in its result, so that last count is for your judgment and does not decide the test.

## Second proof: the engine own no_network test

The engine repo has `tests/conftest.py` with a `no_network` fixture. It blocks socket connect and name lookup inside the engine tests. The test above checks that the fixture exists (arm L10). To use it as a second proof, run from the engine folder:

```
cd <engine folder>
uv run --no-sync --offline --locked --no-python-downloads pytest
```

This works only if the engine dev packages are installed. Nobody has run it yet. If pytest is missing, install the dev group in a separate step that you approve yourself. Do not use `--sync` on the plugin setup for this.

## What to do with the result

1. Copy the PASS and FAIL lines and the information lines.
2. Open `.planning/debug/eureka-engine-unreachable-on-normal-install.md`.
3. Paste the output under the section Owner leak test result and replace the line `status: not run`.
4. Add the plugin version and the engine commit you wrote down.
5. If every criterion passed, change `leak_proof: OPEN` to `leak_proof: CLOSED` with the date, and then move the file to `.planning/debug/resolved/`.
6. If any criterion failed, keep `leak_proof: OPEN`, add the failing lines under Open items and report them.
