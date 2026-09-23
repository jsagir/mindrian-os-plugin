# 6 October 2026 Go / No-Go: B1, the checking record (slide A2)

**Decision date:** 6 October 2026.
**What is decided:** slide A2 of the Rome NATO Defense College deck (13 October 2026), the claim that Mindrian "stores what each claim was checked against - on the claim, visible months later, countable across a whole body of work." This is B1.
**Rule, quoted verbatim:** "Both are committed. Go / no-go on 6 October." On that date each one "either passes its acceptance test below or stays off the slides. No partial credit, and no 'almost'."
**Note:** B2 (slide A1, "which direction" and "can I turn around") has its own checklist: `docs/2026-10-06-ROME-B2-GO-NO-GO.md`. This document never edits that file.

This is an operator runbook. Every command below is copy-paste. Every "Expected" block under a numbered step was captured from a real hermetic dry run of the shipped B1 code (scratch HOME / MINDRIAN_HOME / MINDRIAN_ROOMS_HOME, never a real room), not typed from memory. Wherever the runbook says `<room>`, that stands in for the real path on the day; a temp path from the dry run was substituted with this placeholder.

---

## 0. The four acceptance tests and where they are tested here

The four acceptance tests, quoted verbatim from the page shown to the paper author (https://mindrian-explainer-gate.vercel.app/nato.html):

1. "An officer can record, on a claim, what it was checked against, the rung, the method and the result, in the normal flow and without a developer."
2. "Close everything. In a new session, reopen the claim: the record is there and readable."
3. "The room shows counts for checked, disputed, inconclusive and unchecked claims across all its work. Unchecked is always shown."
4. "A checked claim is still only proposed until a person confirms it."

Fallback wording for slide A2, if B1 is NO-GO, quoted verbatim: "Mindrian keeps a persistent room. A claim lands as proposed, and only a person promotes it, at a single write point. Contradictions with earlier filed work surface as typed relations. The room reports its own unfinished business: unanswered questions, and claims with nothing supporting them. Your own material sits alongside the frameworks. What it does not yet do is record what each claim was checked against. That is the next piece of work."

| Test | Tested in |
|------|-----------|
| AT1 (record a check, normal flow) | Sections 5 and 6 |
| AT2 (close everything, reopen, still there) | Section 7 |
| AT3 (room-wide counts, unchecked always shown) | Section 8 |
| AT4 (checked never confirms) | Section 9 |
| Disputed sticks (navigator ruling) | Section 10 |

---

## 1. Dev-machine pre-flight (operator, on the dev machine)

```bash
cd ~/dev/MindrianOS-Plugin
git fetch origin main
git log origin/main --oneline | grep -c "358-0"
bash tests/run-all-358.sh
node scripts/doctor.cjs --acceptance
node lib/core/repo-version.cjs
```

Expected (captured on the dev machine, 2026-09-24, before the 6 October cut):
- `git log origin/main --oneline | grep -c "358-0"` printed `19` (non-zero; the B1 and B2 plan commits are on `main`).
- `bash tests/run-all-358.sh` printed `PASSED=39 FAILED=0 SKIPPED=0` and exited 0.
- `node scripts/doctor.cjs --acceptance` printed `Acceptance full: 20/21 points passed; failed: verify-release-clean-tree` on this run. That one FAIL is peer-session drift on unrelated files (tracked-file drift outside this phase), not a B1 defect; re-run it on the actual release day and if the count is still exactly this one named point, proceed. If a DIFFERENT point fails, stop and diagnose before cutting the release.
- `node lib/core/repo-version.cjs` printed `2.0.0-beta.48` on this dry run. The runbook does not hardcode this number as the version to release; read it fresh on the day and use the NEXT version in section 2.

**[ ] PASS   [ ] FAIL**

---

## 2. Release cut

The navigator runs this. Never bump version numbers by hand.

```bash
scripts/release.sh <next version>
```

`docs/RELEASE-CEREMONY-RULING-SYSTEM.md` RULE 5 is the single home of the five-place version lockstep; this runbook carries no count of its own and does not repeat that list. After the cut, record the released version here: `___________`.

Confirm the package is published:

```bash
npm dist-tag ls @mindrian_os/cli
```

Expected: the released version appears against `latest`.

**[ ] PASS   [ ] FAIL**

---

## 3. Live install check on EACH demo machine

Why this step exists, in one sentence: a commit on `main` is not live until it is released AND picked up by the machine running it (the plugin install cache is versioned at `~/.claude/plugins/cache/mindrian-marketplace/mos/<version>/`, so a stale config keeps running old code even after the release ships).

On every demo machine (CLI box, Desktop laptop, Cowork host):

```bash
/plugin marketplace update
claude plugin update mos@mindrian-marketplace
ls ~/.claude/plugins/cache/mindrian-marketplace/mos/
```

Expected: the directory listing shows the released version directory from section 2.

**Desktop:** open `claude_desktop_config.json`:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Make the `mindrian-os` server's `args` point at `<that released version directory>/bin/mindrian-mcp-server.cjs` (an older version directory in `args` silently keeps the old code running, even after `claude plugin update`). Keep `MINDRIAN_ROOM` pointing at the demo room. Fully quit Claude Desktop (from its menu, not just closing the window) and reopen it.

**Cowork:** confirm the MCP server entry points at `http://127.0.0.1:3847/mcp` and restart Cowork so it picks up the released install.

**[ ] PASS   [ ] FAIL**

---

## 4. Client-name probes (Desktop, then Cowork)

In a new conversation, bind the demo room, then ask Larry to "show the room's checking counts." Larry calls `claim_read`; read the `host` block in the response.

Expected on Desktop (captured from a real stdio-wire dry run of `claim_read` as the Claude Desktop MCP identity, session S2, hermetic room):
```
host: {"client_name":"claude-ai","host":"claude-desktop","host_tier":"tier0","write_path_enabled":true}
```

On Cowork: record the `client_name` exactly as returned. Cowork's client name observed on 6 October: `___________`.

If `write_path_enabled` is `false` on either surface:
1. On that demo machine only, add `"MINDRIAN_MCP_FIRST": "desktop,cowork"` to the `mindrian-os` server's `env` block (Desktop) or the server environment (Cowork), restart, re-probe.
2. File the observed `client_name` so the navigator can run a `/gsd-quick` that adds it to `HOST_TIER_MAP.tier0` in `lib/mcp/surface-detect.cjs` with a test (same pattern as `claude-ai`), then re-cut the release (section 2) and repeat section 3.

Plainly: the `MINDRIAN_MCP_FIRST` env fallback is a demo-machine setting, documented here, not the product path. It gets removed from every demo machine after Rome.

**[ ] PASS   [ ] FAIL**

---

## 5. AT1 on the CLI

In the demo room:

```
/mos:room check bridge
```

Answer "What did you check it against?" with `field note, exercise 02`; pick `observation` (against kind); pick rung 3 (compare on the cards); pick method `compare`; pick result `contradicts`.

Expected (captured, `node scripts/claim-checks.cjs show --room <room> bridge` after the same record on the CLI-equivalent path):
```
Claim: The bridge at grid 42 is passable.
Claim id: claim:S1:395f39e
Confirmation status: proposed - Proposed. Only a person can confirm this claim. A checking record never confirms it.
Checking record: disputed - at least one check contradicts this claim; it stays disputed until a person marks the contradiction answered
  1. checked against: field note, exercise 02 (observation)
     rung 3 (A database or a document) | method: compare | result: contradicts
     by: user (navigator) | when: 2026-09-23T21:04:21.106Z
```

Also try the Larry-driven path: say "Record that I checked the bridge claim against field note, exercise 02, rung 3, by comparing, and it contradicts." Confirm Larry used `claim_verify` and showed the same record (same fields: checked against, rung and label, method, result, by, when).

**[ ] PASS   [ ] FAIL**

---

## 6. AT1 on Desktop and on Cowork (officer-driven, facilitator watching)

The demo shape from CONTEXT specifics, as an exact prompt script:

1. **Officer files the claim** (Desktop or Cowork, talking to Larry): "The bridge at grid 42 is passable." Larry calls `claim_write`.
2. **Facilitator plants the contradicting field note** (in the room, out of band, per the demo script).
3. **Officer records the check**: "Record that I checked the bridge claim against field note, exercise 02, rung 3, by comparing, and it contradicts." Larry calls `claim_verify`.

Expected (captured, the same underlying MCP tools, real Claude Desktop identity `claude-ai`, no `MINDRIAN_MCP_FIRST` override needed):
```
Confirmation status: proposed - Proposed. Only a person can confirm this claim. A checking record never confirms it.
Checking record: disputed - at least one check contradicts this claim; it stays disputed until a person marks the contradiction answered
  1. checked against: field note, exercise 02 (observation)
     rung 3 (A database or a document) | method: compare | result: contradicts
```

The response shows Confirmation status `proposed` and Checking record `disputed` with the rung label, on both Desktop and Cowork.

**[ ] PASS (Desktop)   [ ] FAIL (Desktop)**
**[ ] PASS (Cowork)   [ ] FAIL (Cowork)**

---

## 7. AT2: close everything, new session, reopen

"Close everything. In a new session, reopen the claim: the record is there and readable."

Quit Claude Desktop from its menu, close the Cowork session, exit the CLI. Open a brand-new session on each surface, bind the same room, and reopen the claim by words (never by re-filing the sentence): "reopen the bridge claim," or on the CLI, `/mos:room claim bridge`.

Expected (captured with SEPARATE OS PROCESSES and SEPARATE session ids, never an in-process stand-in for "close everything": write in session S1, then read in a brand-new process and session S2, `claim_read` by words):
```
Claim: The bridge at grid 42 is passable.
Claim id: claim:S1:395f39e
Confirmation status: proposed - Proposed. Only a person can confirm this claim. A checking record never confirms it.
Checking record: disputed - at least one check contradicts this claim; it stays disputed until a person marks the contradiction answered
  1. checked against: field note, exercise 02 (observation)
     rung 3 (A database or a document) | method: compare | result: contradicts
     by: user (navigator) | when: 2026-09-23T21:04:21.106Z
```
`host` on the same call: `{"client_name":"claude-ai","host":"claude-desktop","host_tier":"tier0","write_path_enabled":true}`.

Every field is there: checked against, rung and label, method, result, by, when.

**WARNING:** reopen by words, never re-file the sentence in the new session. Re-filing the same sentence ("The bridge at grid 42 is passable.") in a new session mints a SECOND, NEW claim id that starts unchecked; the list then shows both claims, and the officer's earlier check does not attach to the new one.

**[ ] PASS   [ ] FAIL**

---

## 8. AT3: room-wide counts, unchecked always shown

Say "show the room's checking counts" or run `/mos:room checks`.

Expected (captured, `node scripts/claim-checks.cjs portrait --room <room>`, one disputed claim and one unchecked claim in the room):
```
Checking record across this room (counts only)
  checked: 0
  disputed: 1
  inconclusive: 0
  unchecked (no checking record yet): 1
  claims in this room: 2
  checks recorded: 1 (supports 0, contradicts 1, inconclusive 0)
  checks by rung: rung 1: 0, rung 2: 0, rung 3: 1, rung 4: 0, rung 5: 0, rung unknown: 0
A count is not a verdict. Only a person confirms a claim.
```

Then check a room where every claim is checked and confirm the line `unchecked (no checking record yet): 0` is still printed (the portrait renderer always prints all four state lines; a zero count is not omitted). Confirm no percentage, grade or single score appears anywhere in the output.

**[ ] PASS   [ ] FAIL**

---

## 9. AT4: checked never confirms

The claim view after checking still says `Confirmation status: proposed` (see the captured blocks in sections 5-8 above: every one of them shows `Confirmation status: proposed` alongside a `checked` or `disputed` Checking record). Recording a check never promotes, never demotes, never changes `review_status`.

Optional demonstration: only a person confirms. Run a gate card approved by the officer (`gate_render` / `gate_answer`), and confirm the checking record printed above is unchanged after that approval (the confirmation gate and the checking record are two separate write paths).

**[ ] PASS   [ ] FAIL**

---

## 10. Disputed sticks demo

Record a later `supports` check on a disputed claim, WITHOUT `--resolves-dispute` / without the person saying it answers the dispute.

Expected (captured, `record --result supports`, no `--resolves-dispute`, on the claim from section 5):
```
Recorded a check on this claim. Its confirmation status did not change.
Claim: The bridge at grid 42 is passable.
Claim id: claim:S1:395f39e
Confirmation status: proposed - Proposed. Only a person can confirm this claim. A checking record never confirms it.
Checking record: disputed - at least one check contradicts this claim; it stays disputed until a person marks the contradiction answered
  1. checked against: field note, exercise 02 (observation)
     rung 3 (A database or a document) | method: compare | result: contradicts
     by: user (navigator) | when: 2026-09-23T21:04:21.106Z
  2. checked against: a second field survey (observation)
     rung 3 (A database or a document) | method: compare | result: supports
     by: user (navigator) | when: 2026-09-23T21:04:49.100Z
```
Still `disputed`, both records visible.

Then the person answers Yes to "Does this check answer the earlier contradiction?" (CLI card), or tells Larry explicitly it answers it (MCP path).

Expected (captured, `record --result supports --resolves-dispute`, an explicit person Yes):
```
Recorded a check on this claim. Its confirmation status did not change.
Claim: The bridge at grid 42 is passable.
Claim id: claim:S1:395f39e
Confirmation status: proposed - Proposed. Only a person can confirm this claim. A checking record never confirms it.
Checking record: checked - checked is not the same as confirmed
  1. checked against: field note, exercise 02 (observation)
     rung 3 (A database or a document) | method: compare | result: contradicts
     by: user (navigator) | when: 2026-09-23T21:04:21.106Z
  2. checked against: a second field survey (observation)
     rung 3 (A database or a document) | method: compare | result: supports
     by: user (navigator) | when: 2026-09-23T21:04:49.100Z
  3. checked against: the officer confirmed the survey in person (person)
     rung 4 (A primary source) | method: compare | result: supports
     by: user (navigator) | when: 2026-09-23T21:04:55.542Z
     a person marked the earlier contradiction answered
```
Now `checked`, and every earlier record is still listed (never overwritten, never hidden).

**[ ] PASS   [ ] FAIL**

---

## 11. Decision table

| Test | CLI | Desktop | Cowork |
|------|-----|---------|--------|
| AT1 | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |
| AT2 | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |
| AT3 | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |
| AT4 | PASS / FAIL, initials, time | PASS / FAIL, initials, time | PASS / FAIL, initials, time |

**Rule:** GO only if every row passes on every surface that will be on the demo machines in Rome. Any FAIL means NO-GO for slide A2, and the fallback wording (section 0, quoted verbatim) goes on the slide. No partial credit, and no "almost".

---

## 12. Rung list note

The five rungs printed by `node scripts/claim-checks.cjs rungs` (captured):
```
1. Your own intuition
2. A counter-argument generated by the model
3. A database or a document
4. A primary source
5. A person who disagrees with you
```
This list is provisional (the paper author's published hierarchy from The Orientation Problem has not shipped yet). If the final list arrives before 6 October, the swap is one constant (`VERIFICATION_RUNGS` in `lib/core/navigation/verification.cjs`) plus a test update, then re-release (section 2) and re-run sections 1 through 8.

---

## 13. Known limits, stated honestly

- A new session that re-files the same claim sentence mints a new claim id; it does not attach to the earlier one's checking record (section 7's warning).
- The Cowork client name was unconfirmed at build time (section 4); it must be probed live before 6 October.
- Resolving a dispute depends on the person saying so; the tool has no way to independently tell who is typing (`checked_by_id` is a local, best-effort identity, never a cryptographic proof, and never crosses to the Brain per Canon Part 8).

---

*Runbook built from a real hermetic dry run of the shipped B1 code (plans 358-01 through 358-05), scratch HOME / MINDRIAN_HOME / MINDRIAN_ROOMS_HOME, never a real room. `bash tests/run-all-358.sh`: PASSED=39 FAILED=0 SKIPPED=0 at build time.*
