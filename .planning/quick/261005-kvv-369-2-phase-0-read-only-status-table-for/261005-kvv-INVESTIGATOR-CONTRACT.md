# Investigator contract (Phase 0, quick 261005-kvv)

You are a READ-ONLY investigator over `/home/jsagi/dev/MindrianOS-Plugin` at HEAD (run `git rev-parse --short HEAD` and `node lib/core/repo-version.cjs` first and record both). You classify failure ids against the current tree. You do not fix anything.

## Hard rules

1. Never modify a tracked file. Never `git commit`, `git add`, `git stash`, `git checkout`. Never `npm install`. Never kill a `mindrian-mcp-server` or any process you did not start.
2. Never touch the user's real state: no writes under `~/MindrianRooms`, `~/.mindrian`, `~/.mindrian.env`, `~/.claude`. Every reproduction that writes anything runs with an isolated HOME: `export HOME=$(mktemp -d /tmp/phase0-home-XXXX)` (and set any room-home env var the script documents, read the script to find it) so registries and rooms land there. If a reproduction cannot be isolated, do not run it; classify `needs evidence` and say why.
3. Canon Part 8: never send room content to Theo. A bare generic call (for example `tools/list` or `brain_stats` with and without an Authorization header) is allowed to measure the key question.
4. Line numbers: re-measure on HEAD with grep; never copy a line number from a report.
5. Every number you write is measured by a command whose output is in a fixture. No estimates.
6. Hyphens only, never em-dashes or en-dashes.

## Python versions on this machine

- `python3` on PATH is 3.12.3 (`/usr/bin/python3`).
- Stock-Mac stand-in: `/home/jsagi/.local/bin/python3.9` (3.9.24). To make the scripts resolve it, create a temp bin dir with `ln -s /home/jsagi/.local/bin/python3.9 <tmpbin>/python3` and prepend it to PATH for that command only.
- Windows stand-in (no python3 at all): run with a PATH that contains no `python3` (for example `env -i PATH=<tmpbin-without-python> HOME=<isolated> node ...`), and record what the Node caller returns.

## Fixtures

Root: `/home/jsagi/dev/MindrianOS-Plugin/.planning/phases/369.2-research-searches-online-for-real/fixtures/phase0/`.

For each id, create `<ID>/` holding:
- `commands.sh`: every command you ran for this id, in order, exactly as run (with the env you set).
- `NN-<short>.out`: the raw stdout+stderr of each command (`2>&1`), plus the exit code on the last line as `exit=<n>`.
- `grep.txt`: the grep lines that locate the current file:line and symbol.
- Keep raw outputs raw. Trim only if a single output exceeds 200 KB (then keep head 100 KB + tail 100 KB and say so).

Do not create fixtures for ids you did not run anything for; the partial table row then cites `grep.txt` only.

## The partial table

Write `fixtures/phase0/partial-<family>.md` with this exact table (one row per id in your family, in the order given):

| ID | Status | Current file:line and symbol | How checked (command or test) | Fixture | Measured note |

- Status is one of: `reproduced`, `fixed`, `obsolete`, `needs evidence`.
- `fixed` requires both the change on HEAD and a run or test on HEAD showing the symptom gone; cite the commit if `git log -S'<token>' --oneline -- <file>` finds it.
- `needs evidence` names the evidence that would decide it (one clause).
- Measured note: the numbers you measured (counts, exit codes, versions), nothing else.

Below the table add two short lists: "Sites that moved since the reports" (reported location -> current location) and "Could not do on this machine" (with the reason).

## Where things are (verified on HEAD before you start)

- `scripts/room-registry`, `scripts/resolve-room`, `scripts/on-cwd-changed` (inline Python; `datetime.UTC` at room-registry:389, :614, resolve-room:157, on-cwd-changed:97).
- `lib/core/room-open.cjs` (`runRegistry`), `lib/core/brain-client.cjs` (key order at ~261, bearer at ~492 and ~712, Tier 0 comments at 20-22 and ~1893).
- `lib/core/part8-egress-guard.cjs` (`freeform_unmatched` / `freeform_unproven` at ~906-914), `lib/core/cross-room-aggregator.cjs` (city fence).
- `lib/core/research-planner/{deep,planner,families,quick,grants,plan}.cjs`, `scripts/research-planner.cjs`.
- `lib/lens-engine/source-lens-driver.cjs` (`LENS_TO_SOURCE`, `patent: 'pubmed'` at line 80).
- `scripts/eureka-jev-judge.cjs`, `lib/core/navigation.cjs` (edge writes), `lib/ui-shell/` (shell, launch.cjs, dist), `scripts/release.sh` (Step 6.8 Desktop copy at ~920-955).
- Source reports: `.planning/seeds/SEED-115..120*.md`, `.planning/phases/369.2-research-searches-online-for-real/369.2-ENGINEERING-BRIEF.md` (the failure register, lines 69-304) and `369.2-ISSUE-REGISTER.md`.
- Tests: `tests/run-all-<phase>.sh`, `tests/test-*.cjs`; `node tests/<file>` runs one.

## Reporting back

Your final message: the path of your partial, the id count by status, and any id where you are unsure of the status (say why). Nothing else.
