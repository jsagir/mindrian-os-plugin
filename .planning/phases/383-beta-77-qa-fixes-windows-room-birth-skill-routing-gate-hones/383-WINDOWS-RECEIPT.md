# Phase 383 Windows retest receipt

Status: UNSIGNED. The owner fills every field marked `[ ]` and signs the last line.
Closes: QA383-01 (Windows room birth), SEED-142, and the Windows legs of QA383-02, -03, -04, -08, -09, -10.
Retest target: plugin v2.0.0-beta.79 (cut after this receipt is prepared). Do not retest an older build.

## Part A. Evidence from the autonomous waves (filled 2026-11-05)

| Item | Value |
|------|-------|
| Dev tree HEAD at preparation | `f6c49f660ea4777640f5b37a1a3246f82a80fb0e` |
| Version in the dev tree | 2.0.0-beta.78 (the fixes ship in beta.79) |
| `bash tests/run-all-383.sh` last line | `Phase 383: PASS=16 FAIL=0 SKIP=0` |
| `node scripts/build-connector-registry.cjs --check` | exit 0 |
| `node scripts/build-orchestration-projection.cjs --check` | exit 0, `orchestration-projection: OK` |
| `node scripts/check-render-coverage.cjs` | exit 0, `198 wired, 2 excluded, 0 unwired` |
| `node scripts/doctor.cjs --acceptance` | `24/25 points passed`; failed: `verify-release-clean-tree` (a modified Phase 384 bench file, not Phase 383 work); `real-room-run` WARN: latest receipt is behind HEAD |
| What the Linux and Windows-side proofs showed | plan 383-03: on the dev machine Windows side, the resolver found Git Bash (msys) and Python 3.13, rejected the Store stub for `python3`, and a registry create wrote no `C:` entry |

Open causes this retest must answer (from `383-ROUTING-DIAGNOSIS.md`): C1 first-install branch or Mode 1 text, C4 skill listing overflow, C5 which Windows hook branch ran.

### Deletion listing 1: Linux side (dev machine, WSL), read only, listed 2026-11-05

Rooms home: `~/MindrianRooms`. Command: `check({})` of `lib/core/doctor/doubled-room-trees-module.cjs`. A file-change marker found nothing newer after the run (nothing was written).

- Machine id for approval: `linux`
- Doubled-path folders: 8
- Top folder: `home`
- Digest: `677711508073`
- Folders:
  - `home/jsagi/MindrianRooms/aion-eureka-synergy`
  - `home/jsagi/MindrianRooms/air-temp-map`
  - `home/jsagi/MindrianRooms/axiom`
  - `home/jsagi/MindrianRooms/egain-des-liquid-conductor`
  - `home/jsagi/MindrianRooms/google-verifiable-quantum-circuit-compilation`
  - `home/jsagi/MindrianRooms/haim-battlefield-intake`
  - `home/jsagi/MindrianRooms/iris-lev-joint-venture`
  - `home/jsagi/MindrianRooms/orly-abramovitz`
- Kept, never removed by the repair: 78 other seed-like folders (12 under `_archive/` and `rooms/` hold edited or extra files; 66 under `tmp/` have no matching real room).
- Removal rule: each folder is removed only when STATE.md, USER.md, ROOM.md and `.mindrian` are unchanged seed files and the copied path matches a real room. The delete is `--clean-doubled-rooms=<digest>`; a stale digest deletes nothing.

### Deletion listing 2: Windows side of the dev machine, read only, listed 2026-11-05

Rooms home: `C:\Users\jsagi\MindrianRooms`. The module ran under Windows `node.exe` from a temporary copy of `lib/`, `data/` and `node_modules/` (the copy was deleted after the run). A file-change marker found nothing newer after the run.

- Machine id for approval: `windows-dev`
- Doubled-path folders: 2
- Top folder: `C` (the folder that WSL shows as `C:`)
- Digest: `3ba9221b0a9e`
- Folders:
  - `C/Users/jsagi/MindrianRooms/hebrew-output-validator`
  - `C/Users/jsagi/MindrianRooms/rdf`
- Kept: `C/Users/jsagi/MindrianRooms/carmon-cohen-renewal` (holds edited or extra files) and `mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab` (no matching real room).
- Not covered by this listing: a second top-level entry whose name is the literal text `C:\Users\jsagi\MindrianRooms\carmon-cohen-renewal` (visible from WSL, dated Oct 26). The module does not list it. It stays untouched.
- Digest binds to the listing. If anything under the rooms home changes, list again and approve the new digest.

### Deletion listing 3: the owner's Windows QA machine

[ ] Not listed yet. On the QA machine, from the updated plugin root, run `node scripts\doctor.cjs` and copy the `doubled-room-trees` row: count, top folders, digest. Then the main session fires the F.0 card for that digest.

Machine id for approval: `windows-qa`. Count: [ ]. Tops: [ ]. Digest: [ ].

## Part B. Retest steps on the Windows QA machine

1. Update the plugin to v2.0.0-beta.79: run `/plugin marketplace update`, then `claude plugin update mos@mindrian-marketplace`. Restart Claude Code CLI.
2. Set `MINDRIAN_ROOMS_HOME` to a new empty test folder. Never use the real rooms folder.
3. Use a machine with no WSL distro and no real Python on PATH. Start Claude Code CLI natively.
4. Capture the machine facts (Part C).
5. In the plugin root run `node lib/core/platform.cjs room-runtime` and copy the `tried` line.
6. Run `/mos:doctor`. Copy the `room-runtime` row and the `doubled-room-trees` row.
7. Run `/mos:new-project`. Answer as the physicist did. Expected: a room is created in the test folder, or three plain lines (what failed, why, one fix) appear before any card and no folder is written. Copy the outcome verbatim. Run `dir` on the test rooms folder.
8. With no room, send: `I know what I want, I need the how`. Expected: `/mos:scientific-roadmap` runs, and the first reply says once that nothing is remembered until a room exists. Repeat inside a room.
9. Note the longest default reply, in sentences.
10. Write the exact unsourced number and its sentence from the beta.77 QA session, or write `not available`.
11. Optional: repeat steps 7 and 8 on Claude Desktop and Cowork. For Desktop, read `node scripts/real-room-run.cjs` output, then run it with `--desktop-verified win`.
12. Deletions: the main session fires the F.0 card (Approve / Reject / Defer) for each listing above. Approve only what the card shows. Record one line per approval in Part D.
13. Fill every field and sign.

## Part C. Owner fields

| Field | Value |
|-------|-------|
| Date | [ ] |
| Windows version and architecture | [ ] |
| Claude Code version | [ ] |
| Plugin version (`node lib/core/repo-version.cjs` in the installed plugin, or the `/mos:doctor` banner) | [ ] |
| `wsl -l -v` output (or `WSL not installed`) | [ ] |
| `where bash` | [ ] |
| `where python3` | [ ] |
| `where python` | [ ] |
| `py -3 --version` | [ ] |
| Resolver `tried` line (`node lib/core/platform.cjs room-runtime`) | [ ] |
| `room-runtime` row of `/mos:doctor` | [ ] |
| Hook shell kind from that row (git-bash, wsl-launcher, path-bash, none) | [ ] |
| `MINDRIAN_ROOMS_HOME` used (a new test folder) | [ ] |
| `/mos:new-project` outcome: `created` / `refused before the card` / `other` | [ ] |
| If created: room name and `dir` of the test rooms folder | [ ] |
| If refused: the three plain lines, verbatim | [ ] |
| If other: the output, verbatim | [ ] |
| Did a card appear before a failure (QA383-04)? yes / no | [ ] |
| Was any folder written when the create was refused? yes / no | [ ] |
| First-install branch: was this the first Claude Code session with the plugin on this machine? (383-ROUTING-DIAGNOSIS C1) | [ ] |
| Listing budget: `/doctor` listing estimate or the `claude --debug` overflow line (C4) | [ ] |
| Which hook branch ran: WSL launcher, silent exit, or Git Bash (C5) | [ ] |
| "I know what I want, I need the how" with no room: did `/mos:scientific-roadmap` run? (QA383-02) | [ ] |
| Same prompt inside a room: did it run? | [ ] |
| First reply with no room: did Larry say nothing is remembered? (QA383-03) | [ ] |
| Longest default reply in the retest, in sentences (QA383-09) | [ ] |
| Exact unsourced number from the beta.77 QA session, with its sentence (QA383-08) | [ ] |
| Desktop row: `ran` / `not ran`; if ran, the `--desktop-verified win` result | [ ] |
| Cowork row: `ran` / `not ran` | [ ] |

## Part D. Deletion approvals

One line per approval, written by the owner after the F.0 card. The digest must equal the digest printed in Part A (or the QA machine listing).

```
approved-delete linux 677711508073        [ ] approve / [ ] reject / [ ] defer
approved-delete windows-dev 3ba9221b0a9e  [ ] approve / [ ] reject / [ ] defer
approved-delete windows-qa <digest>       [ ] approve / [ ] reject / [ ] defer
```

Removed lists (filled after each repair ran): [ ]

## Part E. Sign-off

Outcome closes QA383-01 only when the create outcome is `created`, or `refused before the card` with no folder written.

Signed:
