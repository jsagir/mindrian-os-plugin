# evals/larry-voice - the Larry voice and operation eval

Phase 369.6 plan 02. This directory holds the rubric, the fixed probe set and the recorded runs that every persona-edit plan of the phase scores itself against, per cell, before and after.

## What it is

A scored eval of how Larry speaks (the voice rubric, items R1 to R15, 30 points) and how Larry operates (the operation block, items OP1 to OP5, scored apart). It has a code half and a judge half, the same split as `evals/icm/`:

- The code half runs offline, with no key and no network. It reuses the pure checks of `lib/hmi/larry-reply-checks.cjs`.
- The judge half scores the items a string cannot show (R5 to R7, R9, R11, R13 and parts of R14, R15, OP2, OP3). It uses Jev when the dev-time key resolves and the run's provenance is re-derived before egress, else a `claude --print` judge with the rubric text (the J method), else the item is recorded as not scored with the reason. It never skips silently.

## The fixture-only rule

The runner refuses any label path outside `evals/larry-voice/runs/` and any room outside its scratch root. All probe prompts are invented. No room content, no real name, no owner text appears in the probes or the fixtures. The scratch room is born from `tests/fixtures/release-room` through the release real-room birth, in a child process, under a scratch home.

## The isolation contract in plain words

Every child process the eval starts (the room birth, the hook captures, `claude --print`) gets an environment built from a declared table (`scripts/isolate-larry-voice.cjs`), never copied from the parent. Every home, rooms, config, data, cache, state and temp name points inside a fresh scratch directory. The plugin names point at this repo, read only. `PATH` is built, never inherited. Any other value that lies under the parent's home is refused. The parent's environment is never changed. Nothing in the eval reads, lists or checks anything under `~/MindrianRooms`. The guards are tested only on stand-in directories the test owns.

## The cells

| Cell | Composition |
|------|-------------|
| 1 | Agent body only (the P method). No skills, hooks, output style or tools. The reference cell. |
| 2 | Cell 1 plus the captured SessionStart context of the scratch room. |
| 3 | Cell 2 plus the rendered tool-noise transcript (`fixtures/rung3-tool-noise.jsonl`). |
| 2s | Shipped twin of cell 2: adds the frontmatter skills, the output style and the per-turn classifier output. |
| 3s | Shipped twin of cell 3. |
| 2s-live, 3s-live | Operation cells: a live session in the scratch room with the dev plugin loaded and tools on. |

Cells 2s and 3s are what a CLI session ships with. They are reported beside cells 2 and 3, never instead. Every reply records a composition manifest of what loaded.

## Judge provenance

Jev gets a payload only when the judge step re-derives the run's provenance first, before any payload is built, and it fails closed. Two kinds of run qualify: a research import that is rebuilt from its pinned source commit and matches byte for byte, and a cell 1 generation run whose composition is proven, whose hashes re-derive at its pinned commit, whose stored prompts equal the probes there, and whose local seal verifies. A valid seal proves possession of the local key, not execution by the generator. The payload is built only from the verified record and leaves through `scripts/jev-voice-transport.cjs`, which has its own egress ceiling and checks the whole payload tuple (probe id, prompt, context, turn index, reply bytes, rubric items) immediately before the fetch. Every other run goes to the claude judge or is not scored.

## Comparison outcomes and exit codes

`compare --before A --after B` reads the run kind of both manifests, picks the required matrix of that kind from `rubric.json`, and reports per cell and per probe, never one total.

| Outcome | Exit | Meaning |
|---------|------|---------|
| COMPLETE | 0 | Every applicable acceptance entry is scored on both sides and nothing dropped. |
| REGRESSION | 1 | A comparable acceptance item dropped or a gate went from pass to fail. Wins over incomplete. |
| REFUSED | 2 | A label outside `runs/`, an unverifiable manifest, or a run kind mismatch. |
| INCOMPLETE | 3 | A required entry is missing, abstained, not scored, judged by different judges, or a cell is partial. Never exits 0. |

## The retry rule

When a judge-scored acceptance item drops on a probe and cell, the after side generates two more samples of that probe and cell, all three are scored by the same judge, and the median of three is compared with the before value. One retry per probe and cell per plan. Code-scored items are deterministic and never retried. Every sample stays recorded.

## The live leg rule

A live leg never passes silently. It exits 77 with a printed reason (NOT RUN), or exits 1 when `LARRY_VOICE_REQUIRE_LIVE=1`. A run where some cells completed and others did not exits 3. The runner refuses any model id that contains `fable`. The credential reaches a child by variable name only (`CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`); with none set the leg records `no_isolated_credential`.

## The acceptance rule (R-01)

The pass mark of 22 of 30 is recorded as data and is never a gate. Acceptance is per-probe non-regression of the total plus R2, R3, R8, R14 and OP1, on every cell of the matrix, with each item applicable per the rules in `rubric.json`.

## Commands

```
node scripts/eval-larry-voice.cjs import --label research-p --from <P-probe-replies.md>
node scripts/eval-larry-voice.cjs generate --label <l> [--probes ids] [--cells 1,2,3,2s,3s] [--samples n] [--model m]
node scripts/eval-larry-voice.cjs score --label <l> --judge jev|claude|none|auto
node scripts/eval-larry-voice.cjs compare --before <l1> --after <l2> [--json]
node scripts/eval-larry-voice.cjs ledger-row --label <l> [--operation-label <l2>] --plan <id>
```

Tests: `node tests/test-3696-isolation.cjs`, `MINDRIAN_SKIP_LIVE_CLAUDE=1 node tests/test-3696-rubric-eval.cjs`.
