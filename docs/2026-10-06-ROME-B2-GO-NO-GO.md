# 6 October 2026 Go / No-Go: B2, frame provenance (slide A1)

**Decision date:** 6 October 2026.
**What is decided:** slide A1 of the Rome NATO Defense College deck (13 October 2026), two separate moves: "which direction" (where the room's current question came from, and its history) and "can I turn around" (the pause before an answer to a changed question, and whether the change is a refinement or a relocation). Each move is judged on its own acceptance test.
**Published go / no-go rule, quoted verbatim:** on 6 October each one "either passes its acceptance test below or stays off the slides. No partial credit, and no 'almost'."
**Note:** B1 (slide A2, the checking record) has its own checklist: `docs/2026-10-06-ROME-B1-GO-NO-GO.md`. This document never edits that file.

This is an operator runbook. Every command below is copy-paste. Every "Expected" block under a numbered step was captured from a real hermetic dry run of the shipped B2 code (scratch HOME / MINDRIAN_HOME / MINDRIAN_ROOMS_HOME, never a real room), not typed from memory. Wherever the runbook says `<room>`, that stands in for the real path on the day; a temp path from the dry run was substituted with this placeholder.

---

## 0. The four tests and the ruling

Published B2 tests (slide A1), quoted verbatim:
1. "The room shows where its current question came from: chosen, tasking, prompt or inherited."
2. "Changing the question keeps the old one visible, as a history an officer can open."
3. "Before an answer to a changed question appears, the officer is asked what the old question got wrong."
4. "With an answer, the change is filed as a refinement. Without one, it is filed as a relocation. Neither is presented as better."

Published split rule, quoted verbatim: "If B2 passes tests 1 and 2 but not the pause (3 and 4), 'which direction' goes up and 'can I turn around' stays out. Each move is judged on its own."

**Navigator ruling 1 (LOCKED, 2026-09-23):** the slide / fallback sentence is: "When the governing question changes, the room asks what the old question got wrong before it records the new question, and keeps both questions on the record." AT3 passes when:
- (a) the change door refuses without account / relocate, on CLI and Desktop.
- (b) every B2 read surface shows the pending ask first.
- (c) the demo script routes every question change through the door.

The published Layer 2 sentence on the explainer page still says "before it shows a new answer." Updating that page is a navigator action (section 13), not a repo change.

| Test | Tested in |
|------|-----------|
| AT1 (which direction: current origin) | Section 7 |
| AT2 (which direction: history stays visible) | Section 8 |
| AT3 (can I turn around: the pause, parts a/b/c) | Section 9, and Section 6 for part (c) coverage |
| AT4 (can I turn around: refines / relocates, neither ranked) | Section 10 |

---

## 1. Dev-machine pre-flight

```bash
cd ~/dev/MindrianOS-Plugin
git fetch origin main
git log origin/main --oneline | grep -cE "358-(07|08|09|10)"
bash tests/run-all-358.sh
node scripts/doctor.cjs --acceptance
node lib/core/repo-version.cjs
```

Expected (captured on the dev machine, 2026-09-24, before the 6 October cut):
- `git log origin/main --oneline | grep -cE "358-(07|08|09|10)"` printed a non-zero count (the B2 plan commits are on `main`).
- `bash tests/run-all-358.sh` printed `PASSED=39 FAILED=0 SKIPPED=0` and exited 0.
- `node scripts/doctor.cjs --acceptance` printed `Acceptance full: 20/21 points passed; failed: verify-release-clean-tree` on this run. That one FAIL is peer-session drift on unrelated tracked files (recorded as transient in both 358-05-SUMMARY.md and 358-10-SUMMARY.md), not a B2 defect. Re-run it on the actual release day; if a DIFFERENT point fails, stop and diagnose before cutting the release.
- `node lib/core/repo-version.cjs` printed `2.0.0-beta.48` on this dry run. Read it fresh on the day; the runbook does not hardcode a version to release.

**[ ] PASS   [ ] FAIL**

---

## 2. Release cut

The navigator runs this. Never bump version numbers by hand.

```bash
scripts/release.sh <next version>
```

`docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 is the single home of the five-place version lockstep; this runbook carries no count of its own. If B1 and B2 are decided the same day, one release cut covers both checklists. Step 5.6 of `scripts/release.sh` fires the `theo-resync` `repository_dispatch` at the Theo repository immediately after the tag is verified at origin (see `docs/THEO-NOTIFY-CONTRACT.md`). Record the released version here: `___________`.

**[ ] PASS   [ ] FAIL**

---

## 3. Live install check on each demo machine

Why this step exists, in one sentence: a commit on `main` is not live until it is released AND picked up by the machine running it.

On every demo machine (CLI box, Desktop laptop, Cowork host):

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
ls ~/.claude/plugins/cache/mindrian-marketplace/mos/
```

Expected: the directory listing shows the released version directory from section 2.

**Desktop:** re-point the `mindrian-os` server's `args` at `<that released version directory>/bin/mindrian-mcp-server.cjs` in `claude_desktop_config.json`:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Keep `MINDRIAN_ROOM` pointing at the demo room. Fully quit Claude Desktop from its menu and reopen it.

**Cowork:** confirm the MCP server entry points at `http://127.0.0.1:3847/mcp` and restart Cowork on the released install.

**[ ] PASS   [ ] FAIL**

---

## 4. Theo knows the new subcommands

Only run this AFTER the release (section 2) AND after Theo's resync has fired and completed. This row is release completeness, not a slide criterion: never mark it PASS before the resync has run, even if everything else is green.

```bash
node -e "
const { callTool } = require('./lib/core/brain-client.cjs');
callTool('command_neighborhood', { command: '/mos:room' }).then(r => console.log(JSON.stringify(r)));
"
```

This sends only the literal command name `/mos:room` through `lib/core/brain-client.cjs`; no room path or text leaves this process (the same call `scripts/release-lib/theo-stamp-gate.sh` makes).

Expected, once the release containing commit `c50cb7f2e` has shipped and Theo has resynced: `mappedBy` names the released version, and `registryHash` equals `2afa656e2ebc049072453ca55587bc8a7f6920f77ec864b4369ae29bc6f85d7e` (the recorded `sha256sum data/command-registry.json` at commit `c50cb7f2e`, per `358-10-SUMMARY.md`).

Pre-release reading, quoted for comparison (captured at planning time, before this release):
```
{"mappedBy":"command-registry@2.0.0-beta.42","registryHash":"43d13474f8028fb9a2cc589388a9aa2a2ef90cf5a7bb55fee10eb203c850f9f8"}
```
An older `mappedBy` and a `registryHash` that differs from the recorded value is the expected, honest PRE-release state. If `mappedBy` is still older than the released version on the day, Theo has not resynced yet: record it, check Theo's health and the resync delivery, and do NOT mark this row PASS.

**[ ] PASS (Theo resynced, hash matches)   [ ] FAIL (still stale)**

---

## 5. Client-name probes

Desktop, then Cowork. In a new conversation bound to the demo room, ask "What is our governing question?" (Larry calls `question_read`); read the `host` block in the response.

Expected on Desktop (captured from a real stdio-wire dry run of `question_read` as the Claude Desktop MCP identity, session S9, hermetic room):
```
host: {"client_name":"claude-ai","host":"claude-desktop","host_tier":"tier0","write_path_enabled":true}
```

On Cowork: record the `client_name` exactly as returned. Cowork's client name observed on 6 October: `___________`.

If `write_path_enabled` is `false`: add the documented demo-machine fallback `"MINDRIAN_MCP_FIRST": "desktop,cowork"` to the `mindrian-os` server's env block, restart, re-probe. File the observed `client_name` for a `/gsd-quick` that adds it to `HOST_TIER_MAP.tier0` in `lib/mcp/surface-detect.cjs`, then re-cut (section 2) and repeat section 3. The env fallback is a demo-machine setting, removed after Rome.

**[ ] PASS   [ ] FAIL**

---

## 6. Relevance probe (does Larry reach for the question door only when he should)

On the CLI and on Desktop, in a fresh conversation bound to the demo room, say each turn below and confirm whether Larry reaches for `/mos:room question` or `question_read` / `question_set`.

The routing DECISION underneath every surface is `resolveQuestionTurn(utterance)` in `lib/core/frame-provenance.cjs` (358-08's routing spec, the same source both `/mos:room`'s routing section and the MCP tool descriptions quote verbatim). Expected classifications, captured from a real dry run of the shipped routing function (not typed from memory):

**Question turns (should route to the door):**
```
"Our question is now: which camera works with sunglasses?" -> {"door":"question_set","intent":"change"}
"What is our governing question?" -> {"door":"question_read","intent":"ask"}
"Where did our question come from?" -> {"door":"question_read","intent":"history"}
```

**Unrelated turns (should NOT route to the door):**
```
"What is a camera?" -> {"door":null,"intent":null}
"Check the bridge claim against the field note, exercise 02" -> {"door":null,"intent":null}
"Any questions before we file?" -> {"door":null,"intent":null}
```

On the actual demo machine, confirm Larry's live behavior matches: the question turns end at the card or the read (nothing recorded yet on a plain ask), the unrelated turns never call `question_read` or `question_set` and never invoke `/mos:room question`. The question-turn rows count toward AT1 and AT3 (c) on that surface. An unrelated-turn FAIL (Larry reaching for the question door on an unrelated turn, or missing it on a real question turn) is a routing bug to fix before Rome (the `/mos:room` routing section or the MCP tool descriptions), not a slide NO-GO by itself; it is still recorded here.

**[ ] PASS (CLI)   [ ] FAIL (CLI)**
**[ ] PASS (Desktop)   [ ] FAIL (Desktop)**

---

## 7. AT1 (where the question came from)

CLI:
```bash
node scripts/room-question.cjs set --room <room> --origin tasking Which camera solves the delay?
node scripts/room-question.cjs show --room <room>
```

Expected (captured):
```
Recorded: version 1 (first question)

Governing question (version 1 of 1): Which camera solves the delay?
Origin: tasking - handed down as a tasking
Set at: 2026-09-23T21:09:47.069Z
Change: first question
```

Desktop and Cowork: "Record our governing question: which camera solves the delay? It came from a tasking." then "What is our governing question and where did it come from?" Larry calls `question_set` then `question_read`.

Expected (captured, MCP `question_read` render, real Claude Desktop identity `claude-ai`, no `MINDRIAN_MCP_FIRST` override needed):
```
Governing question (version 3 of 3): Should the checkpoint move north?
Origin: prompt - suggested in conversation with the tool
Set at: 2026-09-23T21:10:02.175Z
Change: relocates from version 2 (no account)
Earlier versions: 2 (see the history)
```
(This later capture is from the same dry-run room after two more changes; on 6 October the officer's own first question will be version 1. The shape to check is the Origin line: `Origin: <id> - <label>`, always present.)

**[ ] PASS (CLI)   [ ] FAIL (CLI)**
**[ ] PASS (Desktop)   [ ] FAIL (Desktop)**
**[ ] PASS (Cowork)   [ ] FAIL (Cowork)**

---

## 8. AT2 (the old question stays visible)

Change the question with an account (see section 9), then close everything: quit Desktop from its menu, end the Cowork session, exit the CLI. Open a NEW session, run `node scripts/room-question.cjs history --room <room>` or say "Show me the question history."

Expected (captured, `history`, three versions across one first-question, one refines, one relocates):
```
Question history (3 versions, oldest first)
Version 1 - origin tasking - handed down as a tasking - set at 2026-09-23T21:09:47.069Z
  Question: Which camera solves the delay?
  Change: first question
Version 2 - origin chosen - chosen by the officer - set at 2026-09-23T21:10:02.072Z
  Question: Which camera works with sunglasses?
  Change: refines version 1 (account on file)
  What the old question got wrong: It assumed the delay was the camera, but the officers wear sunglasses.
Version 3 - origin prompt - suggested in conversation with the tool - set at 2026-09-23T21:10:02.175Z (current)
  Question: Should the checkpoint move north?
  Change: relocates from version 2 (no account)
```
Every version keeps its origin and time, none deleted, none overwritten.

**[ ] PASS   [ ] FAIL**

---

## 9. AT3 (asked before the new question is recorded)

**Part (a):** CLI, change the question WITHOUT `--account` or `--relocate`:
```bash
node scripts/room-question.cjs set --room <room> --origin chosen --based-on 1 Which camera works with sunglasses?
```
Expected (captured, refused, nothing recorded):
```
x The question was not changed yet
  Why: change_needs_account
  Previous question (version 1): Which camera solves the delay?
  Proposed question: Which camera works with sunglasses?
  What did the old question get wrong?
  Fix: re-run set with --account "<the officer's own words>" (files as refines), or --relocate (files as relocates), or run cancel
```
The card printed to stdout in the same refusal:
```
What did the old question get wrong?
Old question (version 1): Which camera solves the delay?
New question: Which camera works with sunglasses?
1. Write what it got wrong (files as refines)
2. It is a new question (files as relocates)
3. Cancel the change
4. Free-Text
[AskUserQuestion contract: shape=F.1 verbs=4]
```

Desktop: "Change our governing question to which camera works with sunglasses" -> `question_set` refuses. Expected (captured, MCP `question_set` refusal payload):
```
ok: false reason: change_needs_account
ask: What did the old question get wrong?
card.options: ["Write what it got wrong (files as refines)","It is a new question (files as relocates)","Cancel the change","Free-Text"]
next: Fire the card, or on a host without AskUserQuestion ask the officer in plain words. Then call question_set again with the same text and origin plus account (the officer's own words, filed as refines), or relocate: true (the officer says it is a new question, filed as relocates), or cancel: true. Never write the account yourself.
host: {"client_name":"claude-ai","host":"claude-desktop","host_tier":"tier0","write_path_enabled":true}
```
NOTHING recorded until the officer answers.

**Part (b):** close the session with the ask unanswered, open a new one, run `node scripts/room-question.cjs show --room <room>` or say "What is our governing question?"

Expected (captured, CLI `show`, first line):
```
A question change is waiting.
Proposed question: Which camera works with sunglasses?
Proposed origin: chosen - chosen by the officer
What did the old question get wrong?
Answer in your own words to file it as refines, say it is a new question to file it as relocates, or cancel the change.

Governing question (version 1 of 1): Which camera solves the delay?
Origin: tasking - handed down as a tasking
Set at: 2026-09-23T21:09:47.069Z
Change: first question
```
Also captured on the MCP read side (`question_read` rendered.question, same shape): the first line is `A question change is waiting.` before the current question block, on ANY host, including an unrecognized one where writes are refused.

**Part (c):** the demo script rule. Every question change in the demo goes through one of two doors only: `node scripts/room-question.cjs set <new question>` on the CLI, or "Change our governing question to: <new question>" to Larry on Desktop / Cowork. Facilitator line, to be said out loud if Larry starts working on a new question without recording it: "Record that as our governing question first."

**[ ] PASS (a, CLI)   [ ] FAIL (a, CLI)**
**[ ] PASS (a, Desktop)   [ ] FAIL (a, Desktop)**
**[ ] PASS (b)   [ ] FAIL (b)**
**[ ] PASS (c, demo script followed)   [ ] FAIL (c)**

---

## 10. AT4 (refines or relocates, neither ranked)

Answer the card in the officer's own words:
```bash
node scripts/room-question.cjs set --room <room> --origin chosen --based-on 1 --account "It assumed the delay was the camera, but the officers wear sunglasses." Which camera works with sunglasses?
```
Expected (captured):
```
Recorded: version 2 (refines version 1)
What the old question got wrong: It assumed the delay was the camera, but the officers wear sunglasses.

Governing question (version 2 of 2): Which camera works with sunglasses?
Origin: chosen - chosen by the officer
Set at: 2026-09-23T21:10:02.072Z
Change: refines version 1 (account on file)
Earlier versions: 1 (see the history)
```

Then change again and pick "It is a new question":
```bash
node scripts/room-question.cjs set --room <room> --origin prompt --relocate Should the checkpoint move north?
```
Expected (captured):
```
Recorded: version 3 (relocates from version 2)

Governing question (version 3 of 3): Should the checkpoint move north?
Origin: prompt - suggested in conversation with the tool
Set at: 2026-09-23T21:10:02.175Z
Change: relocates from version 2 (no account)
Earlier versions: 2 (see the history)
```

Open the history (captured in section 8 above): every version has the same layout, no option on the card was marked recommended, and no line in `show` or `history` output ranks one version above another. Neither `refines` nor `relocates` carries a "better" or "preferred" marker anywhere in the rendered text.

**[ ] PASS   [ ] FAIL**

---

## 11. Answer paths on 6 October: covered and NOT covered

| Path | Surface | Coverage | Why |
|------|---------|----------|-----|
| `question_set` | Desktop, Cowork (MCP) | COVERED | Write-gated door, refuses without account/relocate, proven over the real stdio server as `claude-ai` |
| `/mos:room question set` | CLI | COVERED | Same door via `scripts/room-question.cjs`, same refusal shape |
| `question_read` | Desktop, Cowork (MCP) | COVERED | Unconditional read, shows waiting change first on any host |
| `/mos:room question` and `question history` | All surfaces | COVERED | CLI `show`/`history` and the MCP render both proven by the dry run above |
| Larry answering in chat without recording the question | All surfaces | NOT COVERED | No hook on Desktop or Cowork inspects a plain-text answer that was never recorded through `question_set`; nothing sees a question that Larry discussed but never filed. Mitigated only by the section 9 (c) demo-script rule and the facilitator line, never by the code |
| MCP instructions standing order | Desktop, Cowork | NOT COVERED | The 2000-byte instructions budget has no room for a standing per-turn reminder; Phase 359 territory |
| `claim_read` (B1 read tool) | CLI, Desktop, Cowork | NOT COVERED | Shows the claim's checking record, not a waiting-question notice; B1 and B2 read surfaces are separate |
| `suggest_next` | All surfaces | NOT COVERED | Phase 355 territory; runs after the answer, does not itself read the governing question |
| `reach_candidates` | All surfaces | NOT COVERED | Phase 355 territory, same reason |
| `framework_run` | All surfaces | NOT COVERED | Phase 355 territory, same reason |
| `whitespace_scan` | All surfaces | NOT COVERED | Phase 355 territory, same reason |
| `chain_resolve` / `chain_run` | All surfaces | NOT COVERED | The pending-change halt on chain execution is a stretch item (ruling 6), not built for 6 October |
| `gate_render` / `gate_answer` | All surfaces | NOT COVERED | Peer (Phase 354) territory, not touched by this plan set |
| `status_read` | All surfaces | NOT COVERED | Phase 354 territory |
| `context_assemble`, `graph_reason`, `room_state_bound` | All surfaces | N/A | Not in the answer loop; do not read or surface the governing question |
| The next-move engine | All surfaces | N/A | Reads the section summary, not the question |
| `UserPromptSubmit` hooks, session-start banner | CLI | N/A | Phase 360 territory; no runtime per-turn router exists yet |
| MINTO regeneration, brain-derivation queue | All surfaces | N/A | Unrelated write path, never reads the B2 governing question |
| The strategy goal card | All surfaces | N/A | Phase 345's `goal.parent_question` slot is separate (see section 16) |

---

## 12. Decision table

| Test | CLI | Desktop | Cowork |
|------|-----|---------|--------|
| AT1 | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |
| AT2 | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |
| AT3a | PASS / FAIL, initials, time | PASS / FAIL, initials, time | n/a (part a is CLI + Desktop) |
| AT3b | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |
| AT3c | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |
| AT4 | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |
| Relevance | PASS / FAIL, initials, time | PASS / FAIL, initials, time | n/a (probed on CLI + Desktop) |
| Theo (release completeness) | PASS / FAIL, initials, time | n/a | n/a |

**Rules:**
- "Which direction" goes on slide A1 only if AT1 (every surface in Rome) and AT2 pass.
- "Can I turn around" goes on only if AT3 (a, b and c) and AT4 pass.
- Each move is judged on its own; no partial credit.
- If "can I turn around" is off, the slide keeps the published "Today" line for it, quoted verbatim: "Can I turn around?" Today: "nothing asks you anything when the question changes." Practice 5's fallback card, quoted verbatim: "Pairs change their question once. The room asks what the old one got wrong, or the facilitator does if the pause is not in."
- If "which direction" is off, the slide keeps its own "Today" line, quoted verbatim: "Which direction?" Today: "the room stores the governing question, but not where it came from, and not its history."

---

## 13. Slide wording

Ruled sentence, quoted verbatim: "When the governing question changes, the room asks what the old question got wrong before it records the new question, and keeps both questions on the record."

Navigator action, not a repo change: update the published Layer 2 sentence on https://mindrian-explainer-gate.vercel.app/nato.html from "before it shows a new answer" to the ruled wording above before the deck is final.

---

## 14. Origin labels are provisional

The four origin labels (captured, `node scripts/room-question.cjs origins`):
```
1. chosen - chosen by the officer
2. tasking - handed down as a tasking
3. prompt - suggested in conversation with the tool
4. inherited - carried over from earlier work
```
They live in `FRAME_ORIGINS_ORDERED` in `lib/core/navigation/typed-frame.cjs`, marked `TODO(358)`. When the paper author's definitions arrive, the swap is that one constant plus its test, then re-release (section 2) and re-run sections 1 through 10.

---

## 15. Known limits, stated honestly

- Larry chatting about a new question without recording it through `question_set` is not caught by any code path (section 11, first NOT COVERED row); only the demo-script rule (section 9c) prevents it in Rome.
- On MCP, the officer's account is whatever Larry passes as `account`; it is echoed back in the response so the officer can read and correct it, but the tool cannot independently confirm who typed it.
- The Cowork client name may still be unconfirmed until the section 5 probe is run live.
- Routing is by description and pattern match (`resolveQuestionTurn`), not a runtime per-turn router; section 6's relevance probe is a dry run of the routing function itself plus a live spot check, not a guarantee against every possible phrasing.
- Theo knows the new subcommands only after BOTH the release ships AND the resync completes (section 4); never mark that row PASS before both have happened.
- The card shown in sections 9 and elsewhere is shape F.1 (Approve-style verbs plus Free-Text), not the F.0 shape the navigator originally asked for; the reason is one sentence: the F.0 renderer only shows Approve / Reject / Defer inside an ASCII border and writes the Reject reason into a graph edge, which would put the officer's account text in graph metadata against locked AT4 (the account must be an artifact handle, never graph-edge prose, per Canon Part 8). This is the navigator's card-shape ruling to make or defer at the Task 2 checkpoint.

---

## 16. Later reconciliation (handoff)

- Phase 345's `goal.parent_question` slot was left untouched by B2 (navigator ruling 4). The strategy card's taxonomy climb (`lib/core/strategy/strategy-card.cjs:303`, `taxonomyClimb.climb(goal.parent_question)`) still reads that always-null slot; a later phase should make it read the B2 governing question as the single source, so the strategy card's "governing thought" and the room's governing question stop being two separate ideas with similar names.
- The `chain_run` pending-change halt (ruling 6, a stretch item) was not built for 6 October; it is a follow-up once B2-01 through B2-10 are all green in production use.
- A runtime per-turn router (a `scripts/intent-classifier.cjs`-style module, or an extension of the next-move engine) that would close the "Larry answering in chat" gap (section 11, section 15) is a follow-up, not built here.
- A `larry-personality` trigger line for the question door waits for its owning plans (355-23, 357-10, 359-09, 359-11) to land; this plan set did not touch `skills/larry-personality/SKILL.md`.
- `claim_read` (B1) shows no waiting-question notice; the two read surfaces (checking record and governing question) stay separate on purpose for 6 October.
- The F.0 versus F.1 card-shape decision (section 15's last bullet) is the navigator's to make at the Task 2 checkpoint below.

---

*Runbook built from a real hermetic dry run of the shipped B2 code (plans 358-07 through 358-10), scratch HOME / MINDRIAN_HOME / MINDRIAN_ROOMS_HOME, never a real room. `bash tests/run-all-358.sh`: PASSED=39 FAILED=0 SKIPPED=0 at build time.*
