---
name: persona
description: Generate Six-Hats lenses from room data
license: BSL-1.1. See LICENSE for complete terms (Business Source License 1.1, Change Date 2030-04-16 to Apache License 2.0).
help_jtbd: "Get a per-persona view of your venture (role-blend x journey-stage)."
body_shape: C (Room Card)
layer: "graph"
hitl_stages:
  - stage: "brief-confirm"
    shapes: ["F.6"]
    mode: "gate"
  - stage: "generate-experts"
    shapes: ["F.8"]
    mode: "parallel"
  - stage: "search-approve"
    shapes: ["F.0"]
    mode: "gate"
  - stage: "resolve-tension"
    shapes: ["F.5"]
    mode: "gate"
hitl_why: "The brief is reviewed as a plan (F.6, brief-confirm), the built personas are accepted as an independent set (F.8, generate-experts), the exact search strings and providers of the four researching hats are approved, edited or refused on four cards shown together (F.0, search-approve), then the tensions among the hats are resolved among parallel branches (F.5, resolve-tension)."
# Phase 118-06 reward-before-investment declaration. Grounded in the shipped
# `list` subcommand, which returns each lens's hat color, label, domain,
# filename and disclaimer: the structure of the six lenses is handed over before
# the navigator commits to a generate or a parallel run.
interactive_first_reward: schema_preview
serves_jtbd: ["validate-idea", "explore", "decide-pursue", "surface-contradiction", "compare-options", "prepare-pitch", "find-problem", "navigate", "audit-room"]
job_when: "I am about to build on a claim that only I have examined"
job_want: "to have it checked from several independent sides with fresh evidence"
job_so: "find where it breaks before it costs me"
job_sentence_status: "provisional"
fits_domains: ["complicated","complex","disorder"]
move_type: "analyze"
move_type_weak: true
cynefin_label_status: "provisional"
teaching: "When you need fresh perspectives on the room, /mos:persona generates Six-Hats lenses from your room data. Each persona argues from a different stance; you decide what holds."
# --- Phase 122 workflow-layer frontmatter ---
kind: methodology
frameworks: ["Six Thinking Hats"]
produces: "room/team/ai-personas/*"
inputs: []
autonomous_safe: true
# --- Phase 143.3 connector frontmatter ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: hats
  sub_mode: persona
  framework: "Six Thinking Hats"   # MUST match the existing frameworks: value
  posture: hold
  hierarchy_rank: 3
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: green
  surface: F.1
# --- Phase 130-03 lens-engine client frontmatter ---
lens_type: cognitive
lens_set: six-hats
rotation_mode: parallel
synthesizer: tension-map
persistence: memory_event
# Phase 265 ledger T-265-08 / navigator decision (Open Question 4, SETTLED
# "Add Task"). Task is pre-approved here because --parallel dispatches up to
# 6 subagents in one turn; allowed-tools is a pre-approval list, not a
# restriction list (frontmatter contract), so this removes the per-spawn
# permission prompt rather than granting a capability the command did not
# already have. Scoped to the invoking turn; clears on the next message.
# AskUserQuestion carries the brief card and the persona card of the deep cycle.
allowed-tools: Read Write Bash Glob Task AskUserQuestion
---

# Persona -- AI Perspective Lenses

Generate persistent De Bono Six Thinking Hat perspective lenses from your room data.

This command is a thin lens-engine client. The deep path (`--parallel`) runs through the door script `scripts/persona-hats.cjs`. After the isolated readings, the door rotates the six-hats lens set in `parallel` rotation mode through `lib/core/lens-engine.cjs`, once for each sub-question, and builds the tension map via `lib/core/synthesizers/tension-map.cjs`. The engine owns the rotation loop and the synthesizer dispatch. The door writes no lens-finding node: the filed review artifact is the record. Each ruling of the navigator on a tension is logged as one `decision_captured` memory event (Canon Part 9).

## Important Distinction

**think-hats** is an INTERACTIVE METHODOLOGY SESSION. It walks you through the six hats in sequence as a facilitated exercise.

**persona** creates PERSISTENT PERSPECTIVE LENSES from your room data. Each persona file lives in your `personas/` section and can be invoked at any time to analyze artifacts, challenge assumptions, or provide a specific viewpoint.

## Two modes

- **deep**: six isolated hats. A hat whose persona is not fresh gets a persona built for it by its own agent run from the room, and you accept, rebuild or refuse each built persona. A deep step never runs in the main context.
- **quick**: the fast look. One pass over the six hats in one context. It makes no agent run and no fetch, and it never builds a persona. It is not an independent review.
- `--parallel` is the old spelling of deep mode, and it still works.
- `analyze` is the old spelling of quick mode, and it still works.

The first line of the output of each mode is the `notice` field of the door output (the `start` call below). It is never a sentence written in this command. After `start` succeeds, print the `notice` field first, on a line of its own, before any other text of that mode. For quick mode the field is `quick.notice`.

## When to use it

These nine situations are equal. None of them ranks above another.

- When I am about to build on a claim that only I have examined, I want to have it checked from several independent sides with fresh evidence, so I can find where it breaks before it costs me.
- When I research a question and keep finding what I already expected, I want to send separate lines of inquiry at it from opposing stances, so I can see evidence I would never have searched for.
- When I must commit to an opportunity or drop it and feeling and fact are tangled, I want to pull apart the facts, the upside, the risks and my gut reaction, so I can see which one is driving me.
- When everything in my room seems to agree, I want to have it read by perspectives that did not write it, so I can find the tensions I have stopped noticing.
- When each option in front of me has someone arguing for it, I want to judge every option on the same sides, so I can compare them without the loudest voice winning.
- When I am about to face an investor, a partner or a customer, I want to hear the hardest questions from each kind of listener before they ask them, so I can answer in the room and not afterwards.
- When my hypothesis is still fuzzy and I am about to put numbers on it, I want to look at it from each side in turn, so I can sharpen it into a hypothesis worth the analysis.
- When my team argues in circles because each person defends a position, I want to make everyone look at one side at a time, so I can move the discussion forward.
- When new evidence arrives that could change my case, I want to see how it lands from each side, so I can update what I believe without overreacting.

## Capability rule

Deep mode needs two things: the Agent tool (one separate agent run for each hat) and a local shell (the door script `scripts/persona-hats.cjs`). Check both before step 1.

When the Agent tool or the shell is missing (Claude Desktop through MCP, or a Cowork session with no shell), do not start deep mode. Say this sentence, word for word, and offer the fast look:

> Deep review needs separate agents and a local shell. It runs in Claude Code. Here I can give the fast look, which is one pass and not an independent review.

On such a surface the fast look is the `analyze-perspectives` action of the `room_content` tool. It returns the quick result with its notice first. Never run a same-context pass under the name deep.

**Unattended callers get quick mode only.** When this command runs without a navigator present (inside `/mos:act`, `chain_run`, or any caller that cannot answer a card), run quick mode and show no card. Larry writes the brief itself, with the triage reason "unattended caller", and starts the door with `--mode quick`.

## The deep cycle

The door is one script. Every call prints one JSON object. A refusal is data: `{"ok": false, "reason": "..."}`. Print the reason in one plain sentence and stop that step; never repeat the same call unchanged. A reason `write_failed:<code>` or `internal_error:<code>` is a disk or system error of this machine, not a fault of the review. Navigator text and room text reach the door only through a JSON file, never as argv text. The door refuses a step that comes out of order.

`generate` with no flag starts the deep entry at step 2 in Claude Code.

### Step 1 -- Triage

Decide which mode to recommend. Quick when the target is one artifact and the question needs no outside fact. Deep when the question needs outside evidence or the decision is costly to reverse. Larry recommends with one reason of 200 characters or fewer. The navigator decides on the brief card. Triage has no stop of its own: its result is the first line of the brief card.

### Step 2 -- Brief and Stop 1 (the brief card)

1. Ask the door for the state of the room and of each persona:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" status --room "<room dir>"
   ```

   If `room_ok` is false, say that the room needs 2 sections with 1 or more artifact each, and stop. The field `hats` gives each hat a `state`: `fresh`, `stale`, `unaccepted`, `missing` or `preview_only`.

2. Write the brief from the room and the request: the target (a room-relative path of one file not under `personas/`, or `room`), the governing question (one sentence), 2 to 5 different sub-questions, and the reading list (1 to 12 room-relative paths, none under `personas/`). Read no persona file to write it.

3. Show the brief card (shape F.6, Plan Review) with one AskUserQuestion call. The first line of the card is the triage recommendation: the recommended mode and its reason. Then the target, the governing question, the sub-questions and the reading list. In deep mode the card also names each hat that is not fresh and the reason:
   - `missing`: no persona file yet; it will be built.
   - `stale`: the room changed since the persona was built; it will be built again.
   - `preview_only`: only a template preview exists; a persona will be built.
   - `unaccepted`: built earlier, never accepted; it is not rebuilt, and it comes to the persona card again.

   In quick mode the card says that no persona is built and that a hat without a fresh persona uses its fixed discipline.

4. The answers are approve, edit, the other mode, cancel and defer. Offer four options: approve (the recommended mode), edit the brief, the other mode, and cancel. A free-text answer such as "later" is defer. ASSUMED (a guess): one AskUserQuestion call takes 4 options or fewer.
   - **approve** or **the other mode**: go to point 5 with the chosen mode.
   - **edit**: rewrite the brief from the navigator text and show the card again. Make no door call.
   - **cancel**: stop. Nothing was written, and no run exists.
   - **defer**: stop. Say that `/mos:persona` starts again at this card.

5. Write the brief to a private temporary directory as `brief.json` (`mktemp -d` makes a directory only the user can read). Use the closed key list `schema` (`mos.persona-brief/1`), `target`, `governing_question`, `sub_questions`, `reading_list`, `mode`, and `triage` (`{"recommended": "deep" or "quick", "reason": "..."}`). `triage.recommended` keeps the triage value of Larry, also when the navigator chose the other mode. Then start the run:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" start --room "<room dir>" --brief "<tmp dir>/brief.json" --mode deep
   ```

   Print the `notice` field first (see Two modes). The output holds `run_id`, `review_dir`, `inbox_dir`, `hats` (for each hat: `persona`, `dir`, `discipline`), `to_build` and `to_accept`. Keep `run_id` and `inbox_dir`.

### Step 3 -- Produce and Stop 2 (the persona card)

Deep mode only. Quick mode never builds a persona.

1. **Build.** For each hat of `to_build`, dispatch one fresh `persona-analyst` agent. Dispatch all of them in one message, with the Agent tool and `subagent_type: persona-analyst`. Resolve the model once with `resolveModel(roomPath, 'persona-analyst')` from `lib/core/model-profiles.cjs` (the signature is `resolveModel(roomDir, agentType)`; the argument order must not be reversed). Do not pass any manual background-execution parameter to the Agent tool call. Clamp the fan-out to 20 agents, which is more than the 6 hats. Each agent gets the builder contract below, then these lines and nothing else: the hat, the fixed discipline text (`hats.<hat>.discipline` of the `start` output), the room path, and its own directory (`hats.<hat>.dir`). It gets no other directory.

   ```
   [DEEP] Building personas: {hats of to_build}
     Model: {resolved model}
     Waiting for all builders to finish...
   ```

2. **Write the proposed files.** Make this call unless `start` skipped it. `start` skips it when both `to_build` and `to_accept` are empty; then the `start` output has no hat to build or accept, and the door does not need the call. In every other case the door refuses the next call until this one ran, also when `to_build` is empty but `to_accept` is not:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" write-persona --room "<room dir>" --run "<run_id>"
   ```

   The output gives each built hat a `state`: `proposed` with `file` (`personas/<hat>-<domain>.md`), or `build_failed:<reason>`. A hat with `build_failed` gets no card, takes no part in the reading steps, and is reported as not run, with its reason. For a hat of `to_accept` the file name is the `file` field of `status` (a bare file name under `personas/`).

3. **Stop 2: the persona card (shape F.8, Unordered Basket).** Read the proposed file of each hat that has one. Show one question for each persona: the hat, its focus, its hat questions and its must-not-judge lines. The answers for each hat are accept, rebuild with one line of guidance (2 rebuilds at most for a hat), refuse, and defer. Offer three options (accept, rebuild, refuse); a free-text answer such as "later" is defer. One AskUserQuestion call takes 4 questions or fewer (ASSUMED, a guess). With more than 4 personas, use consecutive calls with no other step between them.

4. **Record the answers.** Write the answer file in the inbox directory, then call the door. The guidance is one line of 200 characters or fewer, and only for rebuild.

   ```json
   {"schema": "mos.persona-accept/1", "run_id": "<run_id>", "hats": {"black": {"decision": "accept"}, "green": {"decision": "rebuild", "guidance": "one line"}, "red": {"decision": "refuse"}}}
   ```

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" accept-persona --room "<room dir>" --run "<run_id>" --answer "<inbox_dir>/accept.json"
   ```

   The door writes the status `accepted` into a persona file only for an accept answer. A refused or deferred hat is reported as not run: it takes no part in the reading steps. A deferred file stays for the next run.

5. **Rebuild.** The output field `to_rebuild` lists each hat with its guidance line. For each one, dispatch one new builder run (the same contract, plus the guidance line as one more input line), call `write-persona` again, and show the card again for that hat only. The door refuses a third rebuild of one hat (`rebuild_limit`): then only accept and refuse are left. The door consumes each spec file: a builder that writes no new spec gives `build_failed` for that hat, and the old file is not proposed again. The door refuses an answer for a hat that is not proposed (`not_proposed:<hat>`) and a persona file that changed after the door wrote it (`persona_file_changed:<hat>`). Repeat until `accept_done` is true.

### The builder contract

Copy this block, word for word, at the head of the prompt of each builder agent. It is the only control on what a builder reads and writes.

<!-- contract:builder:start -->
You build the persona of one hat from the room. You are one hat.

Agent file overrides. This dispatch replaces these instructions of the persona-analyst agent file:
- lines 98 to 100 (run `persona list` first): read no file under `personas/`.
- lines 105, 132 and 140 to 155 (start with the disclaimer; markdown output): write one JSON file in your directory; your reply is the word done and the file path.
- lines 111 to 119 (all-hat mode): you are one hat.
- lines 58 and 64 (the web leg and the Blue synthesis lines): replaced by the bans below.

Inputs: the hat, its fixed discipline, the room path, and the path of your own directory. There is no brief, no governing question and no other hat in this dispatch.

Reads: the room sections. Do not read `personas/`. Do not read the directory of another hat.

Bans: Do not call brain_search or brain_query. This step makes no web search: do not call WebSearch or WebFetch.

Search rule: Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. No code checks it.

Output: one file, `persona.json`, in your own directory, with exactly these keys: `schema` (the text `mos.persona-spec/1`), `hat` (your hat), `focus` (a string of 400 characters or fewer), `hat_questions` (3 to 7 strings, each 240 characters or fewer), `must_not_judge` (1 to 5 strings, each 200 characters or fewer) and `room_sources` (1 to 40 room-relative paths of the files you read, none under `personas/`). Write no URL in any string. Write each string as one line: no line break, no control character and no `#` at its start. These keys are forbidden: `research_handles`, `handles`, `brief`, `evidence`, `verdict`. Your reply is the word done and the file path.
<!-- contract:builder:end -->

### Step 4 -- Handles and the research plan

Deep mode only. The door plans a search only from handles that a hat proposed. Larry proposes no handle and composes no search string.

1. **Handles.** The list `handles_needed` names the researching hats (white, black, yellow, green) that have a fresh or accepted persona and no stored handles for this brief. Take it from the `accept-persona` output that closed Step 3 (`accept_done` is true). When Step 3 had nothing to build and nothing to accept, the `start` output already holds the same list. Dispatch one handle agent for each hat of `handles_needed`, all in one message, with the Agent tool and `subagent_type: persona-analyst`. When the list is empty, dispatch none and go to point 2. Red and blue never get a handle agent. Resolve the model once with `resolveModel(roomPath, 'persona-analyst')` from `lib/core/model-profiles.cjs` (the argument order is `roomDir`, then `agentType`). Do not pass any manual background-execution parameter to the Agent tool call. Clamp the fan-out to 20 agents, which is more than the 4 researching hats.

   Each agent gets the handle contract below, then these lines and nothing else: its hat, the brief (the target, the governing question and the sub-questions with their ids), the name of its persona file (`persona_files.<hat>` of the `accept-persona` output that closed Step 3; when Step 3 had nothing to build and nothing to accept, `hats.<hat>.persona_file` of the `start` output) and its own directory (`hats.<hat>.dir`). It gets no room section, no other hat and no other directory.

   ```
   [DEEP] Proposing search handles: {hats of handles_needed}
     Model: {resolved model}
     Waiting for all handle agents to finish...
   ```

2. **Plan.** Call the door once. The door reads each `handles.json`, screens every handle, composes each search string and checks the provider list. It sends nothing.

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" plan-research --room "<room dir>" --run "<run_id>"
   ```

   The output holds `hats` (for each hat: `planned`, `not_planned:<reason>`, or `never_searches` for red and blue), `planned` (the list of planned hats), `plan_seq`, `plan` (the plan with the exact strings and providers of each hat) and `refused_shown` (a list of `{hat, text, reason}`: the handles and edits that the door refused). The door refuses a second `plan-research` call that has no `--edited` file.

3. Print one line from the `hats` field: `Research not run for: `, then each hat whose state starts with `not_planned:` as `<hat> (<reason>)`, in the order white, black, yellow, green, then a full stop. Print nothing when no hat is in that state. The merge repeats this line in its `notice_lines`.

4. When `planned` is empty, the door marks the research step as skipped and writes empty evidence files. Show no card, write no approved file and make no `run-research` call. Go to Step 6.

### The handle contract

Copy this block, word for word, at the head of the prompt of each handle agent. It is the only control on what a handle agent reads and proposes.

<!-- contract:handles:start -->
You propose search handles for one hat and one brief. You are one hat.

Agent file overrides. This dispatch replaces these instructions of the persona-analyst agent file:
- lines 98 to 100 (run `persona list` first): read no file under `personas/` except your own persona file.
- lines 105, 132 and 140 to 155 (start with the disclaimer; markdown output): write one JSON file in your directory; your reply is the word done and the file path.
- lines 111 to 119 (all-hat mode): you are one hat.
- lines 58 and 64 (the web leg and the Blue synthesis lines): replaced by the bans below.

Inputs: the brief (the target, the governing question and the sub-questions) and your own persona file, and the path of your own directory. There is no room section, no White package, no reading list, no other hat and no conversation in this dispatch.

Handle rule: a handle is 1 to 4 lower-case words, with no digit and no punctuation. It is a generic field term. It holds no name of the venture, of a person, of a product or of a place. Do not add the search qualifier of your hat: the door adds it. Propose 2 handles at most, each with one line of reason of 200 characters or fewer.

Green rule (green only): each handle names a field other than the field of the room, where the same structural problem exists.

Nature rule (green only): also propose one nature handle: the job of the target in nature terms, that is, how a living system does the same job (for example `organisms that recover metals` for battery recycling). It is 1 to 6 lower-case words, with no digit and no punctuation, and it holds no name of the venture, of a person, of a product or of a place. The door searches it on AskNature only and adds no qualifier to it.

Bans: This step makes no web search: do not call WebSearch or WebFetch. Do not call brain_search or brain_query. Do not read the directory of another hat.

Search rule: Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. No code checks it.

Output: one file, `handles.json`, in your own directory, with exactly these keys: `schema` (the text `mos.persona-handles/1`), `hat` (your hat) and `handles` (1 or 2 items, each `{handle, why}`, where `handle` is the handle and `why` is the line of reason). Green only: one more key, `nature_handle`, with one item `{handle, why}` for the nature handle. Your reply is the word done and the file path.
<!-- contract:handles:end -->

### Step 5 -- Stop 3: the search cards, then the research

Run this step only when `planned` is not empty. A hat that is not planned gets no card; it is named in the line of Step 4.

These cards cover the searches that the door sends. Each reading hat may also search the web on its own to validate and build its case. Those searches follow a prompt rule only: no code checks them before they leave the machine. The review lists every string a hat reports and every source it found, under their own label.

1. **Show the cards (shape F.0, Mini Decision Gate).** Show up to four cards together, one for each hat of `planned`, in one AskUserQuestion call: the four cards are shown together in one interaction, and each hat is approved, edited or refused on its own. Each card shows, from `plan.hats.<hat>`:
   - the hat;
   - each exact string of `strings`, word for word, one on each line (mark an edited string as edited);
   - the `providers` that will receive the string;
   - for green, the `nature` entry: when its `state` is `planned`, its exact `text`, word for word, as the AskNature string (the nature lens searches this string only, never the other strings of green); else the line `AskNature: not planned (<reason>)` with the reason of its `state`;
   - the `unavailable_line`, when it is not empty;
   - each entry of `host_searches`, when the list is not empty: its `label` word for word (`web search by the assistant`, `AskNature (through web search)` or `Kaggle datasets (through web search)`) and its exact `text`, word for word. These searches are run by the assistant with the web search tool of the host, not by a provider of the door. Add this sentence, word for word: Code cannot prove that the assistant searched exactly that string.;
   - this sentence, word for word: A failed provider may be asked again with the same string.

   The sentence is the fixed text of the card. It means that the door may send the same approved string again to the same provider up to 2 times for each failed lens run, when that source fails in passing (Tier 1 recovery). It never sends another string and never asks another provider.

   Show the entries of `refused_shown` next to the cards: the hat, the text when it is not null, and the reason. These handles or edits were refused by the door and will never be sent.

   The answers for each hat are approve, edit, refuse and defer. Offer three options (approve, edit, refuse); a free-text answer such as "later" is defer. One AskUserQuestion call takes 4 questions or fewer (ASSUMED, a guess), and there are 4 researching hats at most.

2. **Edit.** An edit answer gives the new text of one string. Larry never composes a string and never changes the text of the navigator. Write the edited strings file into a new private directory (`mktemp -d`), with the closed key list, then call the door with it and remove the directory after the call:

   ```json
   {"schema": "mos.persona-edited/1", "run_id": "<run_id>", "edits": [{"hat": "black", "q_hash_replaced": "<q_hash of the string in the plan>", "text": "the text of the navigator"}]}
   ```

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" plan-research --room "<room dir>" --run "<run_id>" --edited "<tmp dir>/edited.json"
   ```

   The door checks the edited text again and issues a new plan with a new `plan_seq`. The cards are shown again for the edited hats, from the new `plan`, with the refused edits of `refused_shown` and their reasons. The answers of the other hats stand. An edited string must keep the qualifier of its hat.

3. **Approved file.** Write the approved file immediately after the cards, when every hat of `planned` has a final answer of approve, refuse or defer. Use a new private directory (`mktemp -d`); the inbox is not used. Make no fetch and no `run-research` call before the approved file exists. Copy `q_hashes` and `providers` from the plan of the last `plan-research` output: for an approve answer, every `q_hash` of `strings` (for green also `nature.q_hash` when the `state` of `nature` is `planned`) and the whole `providers` list in its order; for a refuse or a defer answer, empty lists. Use the `plan_seq` of that plan. Write no entry for a hat that is not planned, and never one for red or blue. Larry never composes a search string and never changes a hash or a provider.

   ```json
   {"schema": "mos.persona-approved/1", "run_id": "<run_id>", "plan_seq": 1, "hats": {"white": {"decision": "approve", "q_hashes": ["<q_hash>"], "providers": ["<provider>"]}, "black": {"decision": "refuse", "q_hashes": [], "providers": []}}}
   ```

4. **Host web search.** Run this point only when an approved hat has entries in `host_searches` (the provider `host-web` is in its `providers`). The door is a script and cannot call the web search tool of the host, so the assistant runs it. For each hat with an approve answer, and for each entry of `plan.hats.<hat>.host_searches` whose `q_hash` is in the approved `q_hashes` of that hat: run the web search tool of the host (WebSearch in Claude Code, or the equivalent tool of another host) with the `text` of the entry, exactly and unchanged. Search no string that was not approved. Write the results file into a new private directory (`mktemp -d`), never into the inbox:

   ```json
   {"schema": "mos.persona-host-results/1", "run_id": "<run_id>", "plan_seq": 1, "searches": [{"hat": "white", "lens": "industry", "q_hash": "<q_hash of the entry>", "string": "<the text of the entry, unchanged>", "results": [{"url": "<url>", "title": "<title>", "snippet": "<snippet>"}]}]}
   ```

   Write one entry for each search that ran, with at most 10 results from the tool and no other text. When a search ran and found nothing, write `"results": []`: that is an honest empty answer. When the host has no web search tool, or a search failed, write no entry for it and do not guess: the door then reports the provider as not run (`provider_unavailable:host_web`), never as empty. Use the `plan_seq` of the newest plan. When no search ran at all, write no file and pass no `--host-results` flag.

5. **Fetch.** Call the door once, then remove the private directories (the approved file and the host results file):

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" run-research --room "<room dir>" --run "<run_id>" --approved "<tmp dir>/approved.json" --host-results "<tmp dir>/host-results.json"
   ```

   The door fetches only the approved strings from the approved providers, files the findings (and the approved host results) as proposed evidence and seals the evidence files of the hats. A host result is accepted only for an approved string and the exact host string of the plan; a result off the site of an AskNature or Kaggle search is refused and counted. A refusal gives a reason: map it to one plain sentence and stop this step.
   - `step_out_of_order:plan_research`: the plan step did not run yet.
   - `plan_changed`: the plan changed after the cards; plan again and show the cards again.
   - `plan_seq_stale`: the approved file does not match the newest plan; write it again from the newest plan.
   - `string_not_in_plan`: a hash is not in the plan; no search was sent.
   - `too_many_strings`: a hat has more than 2 strings; no search was sent.
   - `provider_list_mismatch`: the providers differ from the card; no search was sent.
   - `hat_never_searches`: red and blue never search.
   - `approved_file_missing`: the approved file was not found; write it again.
   - `host_results_file_missing`: the host results file was not found; write it again, or run the door again with no `--host-results` flag.
   - `host_result_not_approved`: a host result is for a string or a hat that was not approved; no search was sent by the door.
   - `host_result_not_in_plan`, `host_string_mismatch`: a host result does not match a host search of the plan, or its string was changed; no search was sent by the door.

6. **Print the research lines.** From the output, print one line for each of white, black, yellow and green: `Research <hat>: <state>`, then ` (<reason>)` when `reasons.<hat>` is not null, then `, <n> evidence items` from `evidence_items.<hat>`. When a string of `strings.<hat>` has a `host` entry with the state `not_executed`, print one more line: `Host web search not run for <hat> (<lens>): <reason>.` with the `reason` of that entry: `provider_unavailable:host_web` (no host results for the string) or `provider_failed:host_off_site` (every result was off the site, so the search did not run as approved). For green, print one more line from the output field `nature`: `Research green (AskNature): <nature>.` Then print the two counts of `counts` (`strings_approved`, `strings_refused`). Add no judgment of the findings. A hat with a refused or deferred card gets no door evidence; its reading still runs. Continue with Step 6.

### Step 6 -- Readings

Dispatch one fresh `persona-analyst` agent for each of white, red, black, yellow and green. Dispatch all of them in one message, with the Agent tool and `subagent_type: persona-analyst`. Skip a hat whose persona was refused, deferred or failed to build in Step 3: the door reports it as not run, with its reason. Resolve the model once with `resolveModel(roomPath, 'persona-analyst')` from `lib/core/model-profiles.cjs` (the argument order is `roomDir`, then `agentType`). Do not pass any manual background-execution parameter to the Agent tool call. The platform caps concurrent subagents at 20 (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`); five is far below the cap, and the standing rule is to clamp to 20.

Each agent gets the reader contract below, then these lines and nothing else: its hat, the brief (the target, the governing question, the sub-questions with their ids and the reading list), the room path, the name of its persona file (`persona_files.<hat>` of the `accept-persona` output that closed Step 3; when Step 3 had nothing to build and nothing to accept, `hats.<hat>.persona_file` of the `start` output) and its own directory (`hats.<hat>.dir`). The `persona` field of a hat in the `start` output is a state word, not a file name. It gets no other hat, no other directory and no part of this conversation. Do not read the file of a hat in the main context.

```
[DEEP] Reading as separate hats: {hats}
  Model: {resolved model}
  Waiting for all readers to finish...
```

### The reader contract

Copy this block, word for word, at the head of the prompt of each reader agent. It is the only control on what a reader reads, searches and writes.

<!-- contract:reader:start -->
You read the target as one hat, alone. You are one hat.

Agent file overrides. This dispatch replaces these instructions of the persona-analyst agent file:
- lines 98 to 100 (run `persona list` first): read no file under `personas/` except your own persona file.
- lines 105, 132 and 140 to 155 (start with the disclaimer; markdown output): write one JSON file in your directory; your reply is the word done and the file path.
- lines 111 to 119 (all-hat mode): you are one hat.
- lines 131 and 135 (use only facts of the room): you may cite an evidence item of your own pack or of the White package by its id, or a source that you found yourself and listed in self_found_sources.
- lines 58 and 64 (the web leg and the Blue synthesis lines): replaced by the web rule and the bans below.

Inputs: the brief (the target, the governing question, the sub-questions with their ids, the reading list), your own persona file, the files of the reading list, and your own directory. There is no conversation, no view of Larry and no other hat in this dispatch.

Files in your own directory: white, black, yellow and green: `shared-white.json` and `evidence.json`. red: `shared-white.json` only; red has no `evidence.json`. The file `shared-white.json` is the White package. Read it. Cite an item of it only if you are not red.

Web rule: White, black, yellow and green may use WebSearch and WebFetch to validate and build their case. Red makes no search and gives no evidence and no justification. For red, this step makes no web search: do not call WebSearch or WebFetch.

Search rule: Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. No code checks it. List every search string you sent in self_search_strings and every source you used in self_found_sources.

Bans: Do not call brain_search or brain_query. Do not read the directory of another hat. Write no URL and no `EvidenceClaim:` id in any text field unless you may cite it.

Output: one file, `reading.json`, in your own directory, with a closed list of keys. Your reply is the word done and the file path.

Keys of every hat: `schema` (the text `mos.persona-reading/1`), `run_id`, `hat` (your hat) and `positions`: one entry for each sub-question id of the brief, each `{sub_question, value, line}`, with `line` of 300 characters or fewer (a `no_position` value needs no line). The value is `favours`, `opposes`, `mixed` or `no_position`; for green it is `alternative_offered` or `no_position`.
- white: `evidence`, `missing_data` (strings of 200 characters or fewer) or `nothing_missing` (true), `self_search_strings`, `self_found_sources`.
- red: `positions` only. Each line is 25 words or fewer.
- black: `evidence` (each item has a `disposition`, `disconfirming` or `confirming`; the first item is disconfirming), `steelman` (400 characters or fewer), `self_search_strings`, `self_found_sources`.
- yellow: `evidence`, `none_found` (true only when you found no source after a search), `self_search_strings`, `self_found_sources`.
- green: `provocations` (1 to 7 strings of 300 characters or fewer), `evidence` (no `disposition`), `self_search_strings`, `self_found_sources`.

Each item of `evidence` is `{source, tier, disposition?, note}`. The `source` is an item id of your own pack, an item id of the White package, or the url of a source in your self_found_sources; an item that cites a self-found source has the tier `self_found`. The `note` is 300 characters or fewer. The list `self_search_strings` holds 0 to 50 strings of 200 characters or fewer. The list `self_found_sources` holds 0 to 30 items of `{url, title, search_string, summary}`: the url starts with http or https, and the search_string is one of your self_search_strings.
<!-- contract:reader:end -->

### Step 7 -- Check the readings, then Blue

1. Check the readings:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" check --room "<room dir>" --run "<run_id>"
   ```

   The output field `not_run` is a list of `{hat, reason, state}`. Print one line `Not run: <hat> (<reason>)` for each entry. The door checks each reading from its file bytes: the closed keys, the citation boundary and the rules of the hat. It never repairs a reading. The field `blue_ledger` is the path of the counts-only ledger of Blue.

2. Dispatch one fresh `persona-analyst` agent for blue, with the Blue contract below, the brief, the name of its persona file (`persona_files.blue` of the `accept-persona` output that closed Step 3; when Step 3 had nothing to build and nothing to accept, `hats.blue.persona_file` of the `start` output) and its own directory (`hats.blue.dir`). The model is the one of Step 6. Skip Blue when its persona was refused, deferred or failed to build; the door reports it as not run. Blue writes `reading.json` into its directory before Step 8.

### The Blue contract

Copy this block, word for word, at the head of the prompt of the Blue agent.

<!-- contract:blue:start -->
You read the process of this run as the blue hat, alone. You are one hat.

Blue fixed text: Blue hat. Read the process only. Say what was skipped, which hat was thin, and what to ask next. Add no content: no fact, no risk, no idea, no recommendation, no position on the target. You are not the judge.

Agent file overrides. This dispatch replaces these instructions of the persona-analyst agent file:
- lines 98 to 100 (run `persona list` first): read no file under `personas/` except your own persona file.
- lines 105, 132 and 140 to 155 (start with the disclaimer; markdown output): write one JSON file in your directory; your reply is the word done and the file path.
- lines 111 to 119 (all-hat mode): you are one hat.
- lines 58 and 64 (the web leg and the Blue synthesis lines): replaced by the Blue fixed text and the bans below.

Inputs: the brief (the target, the governing question, the sub-questions with their ids), your own persona file, and `ledger.json` in your own directory. The ledger holds counts and state names only. There is nothing else in this dispatch.

Search rule: no search. This step makes no web search: do not call WebSearch or WebFetch. Put no venture name, person name, figure or other room detail in a search string. This is a rule for you. No code checks it.

Bans: Do not call brain_search or brain_query. Do not read the directory of another hat.

Output: one file, `reading.json`, in your own directory, with the keys `schema` (the text `mos.persona-reading/1`), `run_id`, `hat` (the text `blue`), and then `skipped`, `thin` and `ask_next` only. Each of the three is a list of 0 to 7 strings of 200 characters or fewer. Each `thin` entry names a hat. Your reply is the word done and the file path.
<!-- contract:blue:end -->

### Step 8 -- Merge and narrate

1. Write the counts file `counts.json` into the inbox directory of the run. It holds these three whole numbers and no other key: `agent_runs` (the agent runs of this run: builders, rebuilds, handle agents, readers and Blue), `stops` (the stops shown so far, and Stop 3 is one stop; Stop 4 is not counted, because it follows the merge) and `cards` (the questions shown so far across those stops, and each search card is one question).

   ```json
   {"agent_runs": 7, "stops": 2, "cards": 7}
   ```

2. Call the door:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" merge --room "<room dir>" --run "<run_id>" --counts "<inbox_dir>/counts.json"
   ```

   The door judges each reading again, builds the positions table, calls the lens engine once for each sub-question, files the review artifact and the run record in the review folder, and deletes the scratch tree. The output holds `notice_lines`, `artifact` (the path of the filed review), `tensions`, `open`, `settled`, `same_position`, `hats` and `not_run`.

3. Narrate the filed artifact on the screen under three rules.
   - Print the `notice_lines` of the output first, each on its own line, word for word, before any other text.
   - Say the dissent register before the tensions: for each sub-question, black first, then the other hats that ran, each line with its hat named. Then say the tensions, the same-position lines, the hats that did not run, and the sources.
   - Add no fact, no risk, no idea and no recommendation. Say what the artifact says and attribute each line to its hat. Do not merge two lines into one. Do not say who is right.

   Code checks the filed artifact and not the spoken text. If you add a word that is not in the artifact, nothing catches it, and the navigator cannot tell it from a finding of a hat. Every claim of a hat stays proposed until the navigator confirms it. The merge confirms nothing and files no claim as a fact of the venture. Say "proposed" when you restate a claim of a hat.

### Step 9 -- Stop 4: the rulings

Ask a ruling for each tension of the `open` list of the merge output. A settled tension is not asked again: the artifact shows its stored ruling next to the new lines, and only the navigator can re-open it. When `open` is empty, show no card and say that no tension is open.

1. Show the rulings card (shape F.5, Branches) with one AskUserQuestion call. One question for each open tension: the sub-question, the pair, and the two lines of the pair, each with its hat. The `pair` is sorted by name: `side_a` is the first hat of the pair, `side_b` is the second. The answers are `side_a` (the first hat holds), `side_b` (the second hat holds), both hold, and defer. Offer the four answers as options. The navigator may add one optional reason line of 280 characters or fewer in the free-text field. One AskUserQuestion call takes 4 questions or fewer (ASSUMED, a guess); with more than 4 open tensions, use consecutive calls with no other step between them.

2. Write the answer file into a new private directory (`mktemp -d`), not into the inbox: the merge deleted the inbox with the scratch tree. Navigator text reaches the door only through this JSON file. Use the tension ids of the merge output. A ruling that is `side_a`, `side_b` or `both_hold` goes into the rulings store of the room. A `defer` is not stored, so the next run asks the tension again.

   ```json
   {"schema": "mos.persona-ruling-answer/1", "run_id": "<run_id>", "rulings": [{"tension_id": "<id>", "ruling": "side_a", "reason": "one line"}]}
   ```

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" record-ruling --room "<room dir>" --run "<run_id>" --answer "<tmp dir>/ruling.json"
   ```

3. Print what the output says: the rulings recorded, the tensions deferred, and `memory_event` (`logged`, or `not_logged` with its reason; the ruling is stored either way). A ruling is the answer of the navigator on a pair of hats. It confirms no claim about the venture.

   The door also writes a fixed "## Rulings" section at the end of the filed review (the tension id, the ruling, the side hat and the date, and nothing else) and sets the state line of each ruled tension. Read the `artifact` field of the output: `updated`, or `not_updated` with its reason (the ruling is stored either way). The reason line of the navigator stays in the rulings store and is not written into the review.

4. To re-open a settled tension, only when the navigator asks for it, add an entry for its id with `"reopen": true` (and `"ruling": "defer"`). The door removes its key from the store, and the next run asks it again. Do this for no other reason.

## Quick mode

Quick mode is the fast look. It is steps 1 and 2 (the same brief card), then one pass of the six hats in the main context. It makes no agent run, no fetch and no web search, and it never builds a persona. The pass leaves a run record, so it can be put next to a deep run (see Compare below).

1. Start the door with quick mode. The output holds a `quick` object and an `inbox_dir`:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" start --room "<room dir>" --brief "<tmp dir>/brief.json" --mode quick
   ```

2. Print the `notice` field of the output first (`quick.notice`).
3. Make one pass over the six hats in the main context. Use the text of each hat from `quick.hats.<hat>.text`. Name every hat of `quick.fixed_discipline_hats` as "on fixed discipline": it has no fresh persona file. For each hat except blue, give one position for each sub-question of the brief: one closed value and one line of 300 characters or fewer. White, red, black and yellow use `favours`, `opposes`, `mixed` or `no_position`. Green uses `alternative_offered` or `no_position` and may add provocations. Blue gives only `skipped`, `thin` and `ask_next`. Put no source, no URL and no fact from outside the room in a line: quick mode has no research.
4. Write the quick result file `quick-result.json` into the `inbox_dir` of the output. It holds these keys and no other: `schema` (`mos.persona-quick/1`), `run_id` and `hats`. Each hat holds `positions` (the entries `sub_question` with the id of the brief, `value` and `line`), and green may hold `provocations`. A key for evidence, a search, a justification or a verdict is refused by name.

   ```json
   {"schema": "mos.persona-quick/1", "run_id": "<run_id>", "hats": {"black": {"positions": [{"sub_question": "<id>", "value": "opposes", "line": "one line"}]}, "blue": {"skipped": ["one line"]}}}
   ```

5. Write the counts file `counts.json` into the same inbox: `agent_runs` is 0, `stops` and `cards` are the brief card (1 and 1; an unattended caller shows no card and writes 0 and 0).
6. Call the door to merge the quick result:

   ```bash
   node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" merge --room "<room dir>" --run "<run_id>" --quick-result "<inbox_dir>/quick-result.json" --counts "<inbox_dir>/counts.json"
   ```

   The door checks the file, makes the same tension call and the same same-position rule as a deep run, and files the artifact and the run record. When it refuses, nothing is written: fix the file and call again.
7. Print the `notice_lines` of the output first, each on its own line, word for word, then narrate the filed artifact under the three rules of Step 8. Say that this is not an independent review.
8. When `open` is not empty and a navigator is present, offer the rulings of Step 9 as an option: `record-ruling` works for a quick run the same way. An unattended caller is not offered it.
9. Make no agent run and no fetch. Never build a persona.

## Compare

When both a deep run and a quick run of the same brief exist and are merged, Larry may offer to put them side by side. The door checks that the brief is the same:

```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/persona-hats.cjs" compare --room "<room dir>" --deep "<deep run_id>" --quick "<quick run_id>"
```

The door writes `compare.md` in the folder of the deep run: for each sub-question the value and the line of each hat in each mode, then the counts of each mode (the agent runs, the stops and the cards are marked as reported by the command), then an empty "Navigator note:" field. Show the file. Do not say which mode is better, do not score either mode and do not write the navigator note. The navigator decides what the two columns mean.

A surface with no shell (Claude Desktop through MCP, or a Cowork session with no shell) has no run record and no compare: the fast look there is the `analyze-perspectives` action, and it files nothing.

## Subcommands

### generate

Build the six hat-colored persona files from current room state.

```
/mos:persona generate
```

In Claude Code, `generate` with no flag starts the deep entry at step 2 of the cycle above: the status call, the brief card, and the build of every persona that is not fresh. Each persona file holds the fixed discipline of the hat, a focus, hat questions and must-not-judge lines, all built from YOUR room content. On a surface with no Agent tool or no shell, `generate` gives the refusal sentence of the capability rule and the fast look. The template preview (see below) is the only path that writes template files.

**Prerequisites:** Room must have 2+ populated sections (sections with at least one artifact file). Thin rooms are rejected to prevent generic output.

### list

Show all generated personas in the room.

```
/mos:persona list
```

Returns each persona's hat color, label, domain, filename, and disclaimer.

### invoke [hat] [artifact]

Adopt a specific hat's perspective.

```
/mos:persona invoke black
/mos:persona invoke yellow path/to/artifact.md
```

Returns the persona content for the specified hat. When an artifact path is provided, the persona's perspective is applied to that specific document.

Hat colors: white (Facts & Data), red (Emotions & Intuition), black (Risks & Dangers), yellow (Benefits & Opportunities), green (Creativity & Alternatives), blue (Process & Meta).

### analyze [artifact]

Run all 6 perspectives against a single artifact.

```
/mos:persona analyze path/to/business-model.md
```

Returns all six hat perspectives on the artifact. Highlights where hats DISAGREE -- that tension is where insight lives.

`analyze` is the old spelling of quick mode: the fast look of the Quick mode section, not an independent review.

### parallel

`--parallel` is the old spelling of deep mode. It starts the deep cycle above at the triage step and runs it to the rulings of Step 9.

```
/mos:persona --parallel
/mos:persona --parallel path/to/artifact.md
```

With an artifact path, the path is the target of the brief (a room-relative path of one file). With no path, the target is the whole room. The cycle needs the room precondition of the door: 2 or more sections with 1 or more artifact each. Personas that are not fresh are built and accepted first (Step 3). The handles, the search cards, the readings, the merge and the rulings are Steps 4 to 9 above. Use `analyze` (quick mode) for a fast single-context look; use deep mode for independent readings.

### The template preview, and what it is not

The OTHER persona surface is `lib/core/persona-ops.cjs` `generatePersonas`, reached through the `room_content` MCP tool's `generate-personas` action. It is a deterministic template fill over regex-extracted room-section summaries -- there is no reasoning step anywhere in that path. Use it only for a fast structural preview of what the six hats would cover, nothing more.

As of Phase 265-16, `generate-personas` ROUTES here by default instead of silently writing template files; it only produces the preview on explicit opt-in (`{"mode": "preview"}`), and every preview file it writes stamps `PREVIEW_NOTICE` on its face, in both frontmatter and body, so it is never mistaken for this command's analysis.

The MCP tool cannot simply run this pipeline itself: an MCP tool handler runs server-side and cannot invoke the Agent tool, which is a client-side capability reached only through command prose like this file. That is why the fix is a route, not a rewrite of the handler.

## Persona Override (Identity-Only)

The personas above are the AI TEAM around the navigator. Separately, a navigator can declare their OWN synthetic persona for a role-play or test session. This is the identity-only override surface. It is a local-only sentinel file (zero Brain egress per Canon Part 8); a navigator-set persona is navigator-confirmed (legitimate per Canon Part 9 role 5).

```bash
node lib/core/persona-override.cjs set <role>     # declare a synthetic persona
node lib/core/persona-override.cjs status         # show the active override JSON, or "none"
node lib/core/persona-override.cjs clear          # remove the override
```

What it does: while an override is active, the identity that every persona reader funnels through (`readUserMd`) returns the SYNTHETIC persona instead of the real USER.md, for every turn. The override store lives OUTSIDE the context window, so the declared persona sticks across turns AND survives maintenance commands like `/mos:doctor` (the exact failure that previously collapsed a role-played persona). `set <role>` sets the canonical role plus a 1.0 role-blend on that role.

How to clear it: run `node lib/core/persona-override.cjs clear`. With no override active, identity resolution is byte-identical to the default (every real user is on this path).

## Personas Are Perspective Lenses, Not Expert Advisors

Every persona output includes a disclaimer. Personas synthesize from YOUR room data -- they never generate new domain facts. They are thinking tools that help you see your venture from structured angles, not authoritative opinions.

## Examples

**CLI:**
```bash
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/mindrian-tools.cjs" persona generate ./room
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/mindrian-tools.cjs" persona list ./room
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/mindrian-tools.cjs" persona invoke ./room black
node "${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?MindrianOS install root not found. Set MINDRIAN_OS_ROOT (see lib/core/active-plugin-root.cjs) or run from Claude Code.}}/scripts/mindrian-tools.cjs" persona analyze ./room path/to/artifact.md
```

**Natural language (Desktop/Cowork):**
- "Generate personas for my room"
- "What does the black hat think about my competitive analysis?"
- "Run all perspectives on my business model"
- "Show me my personas"
