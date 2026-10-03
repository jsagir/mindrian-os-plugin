# UI shell chassis bake-off (Phase 369)

Two candidates build the same slice; one harness measures both. The navigator
picks the chassis from the measured table (D-07), not an executor.

- `workroom/`: candidate A, the workroom chassis (Next, React, BlockNote).
- `agent-native/`: candidate B, the agent-native scaffold (Vite, React Router, Nitro).
- `measure.cjs`: the nine-measure harness. `results.json`: what it measured.
  `COMPARISON.md`: the table read from `results.json`.

## Reproduce from nothing

Needs Node 22.18 or newer (the nvm Node), pnpm, network for the installs, and
the Playwright Chromium that `tests/e2e-369/lib/pw.cjs` resolves.

```bash
export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH
# each candidate on its own (the generated app/ is git-ignored)
bash ui/bakeoff/workroom/setup.sh && bash ui/bakeoff/workroom/build.sh
bash ui/bakeoff/agent-native/setup.sh && bash ui/bakeoff/agent-native/build.sh
# the measurement; this deletes each app/, runs setup and build, then measures
node ui/bakeoff/measure.cjs --candidate both
# a re-measure without rebuilding
node ui/bakeoff/measure.cjs --candidate both --skip-build
node tests/test-369-bakeoff-measure.cjs
```

Flags: `--candidate workroom|agent-native|both`, `--out <file>` (default
`ui/bakeoff/results.json`), `--skip-build`.

## How it measures

Setup and build run under your real HOME (they install packages). Everything
measured runs under a temp HOME with no `CLAUDE_*` variables, telemetry off, on
loopback only: a hermetic flag-ON MindrianOS daemon with seeded fixture rooms,
the candidate's production build served by its own `serve.sh`, and a headless
Chromium. Before any number is taken the harness checks that both slices
declare the same six action names with the same exposures, and aborts if not.

A measure the harness cannot take is written as `{ "value": null, "not_measured": "<reason>" }`.
Nothing is estimated.

## The nine measures, one sentence each

1. `architecture_distorted`: how many framework conventions the candidate had to bypass (and how many files outside its own folder and `ui/shared` changed).
2. `workroom_code_surviving`: how many lines of the workroom's own code are still byte-identical in the candidate.
3. `selected_state_reaches_claude`: whether a node the person selects reaches the proposal, scored through the room-proposal adapter that the navigator ruled (no Claude process runs in the shell), with the boundaries crossed.
4. `persistent_state`: what the running slice stores that did not exist before (cookies, browser storage, server files).
5. `reconnect`: how long the evidence view takes to show 6 claims written after the daemon was killed and restarted.
6. `startup_errors`: server error events in the first 5 seconds plus browser errors on first load.
7. `dependency_removal`: which packages had to be removed and whether the build stayed green.
8. `direct_file_write_replacement`: how many direct file-system or process-spawn uses remain in the server source (the action layer should have replaced all of them).
9. `packaging`: build time, output size and file count, whether the output carries a node_modules tree, whether a copy of the output starts with plain `node` and no build, first paint, and the projected release payload against the loader ceiling.

Extras: `gate_click_to_view_ms` (Confirm click to the page showing the decision, plus
whether `change_seq` incremented and the `room.changed` hint fired) and
`csp_style_src_self` (whether the read-only document renders under the UI-SPEC
contract Content-Security-Policy, with the violations counted).

The `rxdb.info` strings that both builds carry come from `ui/shared`'s RxDB, so
they are recorded once under `meta.shared_findings`, not against either candidate.
