# 02 - MindrianOS plugin capability surface audit (efficiency)

Date: 2026-11-24. Repo: /home/jsagi/dev/MindrianOS-Plugin-399 (worktree, branch for Phase 399/400, version 2.0.0-beta.88).
Method: read-only. Scripts: /tmp/claude-1000/-home-jsagi/2573fa9c-012c-4f0a-8072-478e6d3aa1be/scratchpad/eff/measure.py and sim.py.
Evidence marks: PROVEN (measured here), ASSUMED (not measured), UNVERIFIED (not run).

## 0. Baseline (PROVEN)

| Surface | Files | Lines | Bytes | Frontmatter lines | Frontmatter comment lines |
|---|---|---|---|---|---|
| skills/*/SKILL.md | 125 | 24,605 | 1,526,255 | 4,081 | 717 |
| commands/*.md | 113 | 22,224 | 1,254,935 | 4,133 | 639 |
| agents/*.md | 17 | 2,410 | 140,174 | 500 | n/a |
| references/methodology/*.md | 43 | 6,602 | n/a | n/a | n/a |

## 1. Mirrors

- Generator: scripts/build-skill-mirrors.cjs. It copies every commands/<name>.md to skills/<name>/SKILL.md. Skip list: trending-to-absurd (hand-authored).
- Reason in the file header: a Windows host bug does not register plugin commands/, but skills/ loads.
- Exceptions: DESENSITIZE (sensor_triggers set to [] in the mirror) and SKILL-SPEC NORMALIZATION (name, allowed-tools as string, license, compatibility).
- `node scripts/build-skill-mirrors.cjs --check`: OK, 112 mirrors match (PROVEN).
- 113 of 113 commands have a skill twin. 112 are generated, 1 (trending-to-absurd) is hand-authored. 12 skills have no command (2,747 lines): brain-connector, client-discovery-interview, context-engine, conversation-mode, intelligence-orchestrator, larry-personality, mos-deck-engine, mullins-scaffold, pws-methodology, room-passive, room-proactive, ui-system.
- Line overlap, command vs mirror: 21,015 of 21,858 mirror lines are identical (96.1 percent). Mirror bytes: 1,327,267. The 3.9 percent difference is the normalization frontmatter.
- Context load: both directories ship in the package and both register. Claude Code docs state that a skill takes precedence when a skill and a command share a name (ASSUMED from host docs, not probed here). So per invocation only 1 copy loads. The mirror cost is package size, maintenance and gate time, not per-turn context.
- Observation (PROVEN in this session): the host skill listing shows the mos:* skills by name only, with no description. Other plugins in the same listing keep their descriptions. A likely cause is the listing budget for about 125 plus skills (ASSUMED). A skill without a description in the listing is harder for the model to pick.

Readers that pin commands/ as the source (do not break): scripts/build-command-registry.cjs, scripts/build-render-coverage.cjs, scripts/check-help-coverage.cjs, scripts/apply-job-labels.cjs (Phase 399), tests/test-399-job-labels.cjs L6 (each mirror carries the command serves_jtbd line), scripts/build-connector-registry.cjs (walks both).

## 2. Repeated blocks (non-mirror files only, mirrors counted separately)

| Block | Copies | Lines each | Total lines | Canonical source to point at |
|---|---|---|---|---|
| `<!-- mos:firing-block v2 -->` AskUserQuestion firing paragraph | 84 commands + 86 skills | 13 (+1 blank) | about 2,380 (1,176 in commands) | one file, for example references/hmi/firing-block.md, or the HITL layer itself (lib/hmi/selector-dispatcher.cjs). Stamped by scripts/stamp-firing-block.cjs, checked by tests/test-219-qualify.cjs |
| Research-planner CLI protocol (plan, review approve, run-quick, basket, file-run, pending cards, F.0/F.8 rules) in eureka, find-analogies, find-bottlenecks, find-connections, scout | 5 commands (+5 mirrors) | about 45 non-blank shared | about 225 (450 with mirrors) | commands/research.md "Plan-run mode", or a new references/research/plan-run-protocol.md |
| "This is a new way to use the framework ... checked research plan" handoff (diffusion, map-unknowns, root-cause, think-hats, plus 1) | 5 (+5) | about 43 shared | about 215 (430) | same reference as above |
| Methodology wrapper template (Setup: read reference, read voice-dna.md, read STATE.md; Session Flow; When Complete; "File this to <section>?"; suggest next) | 25 commands (+25) | about 14 non-blank body lines | about 350 body (700) | one generated template plus data row per framework |
| Voice rules (LOCKED) block (openers, no emoji, 12 glyphs, 3-line error) | 11 | 5 | 55 (110) | skills/larry-personality/SKILL.md and skills/ui-system/SKILL.md Section 3 |
| "Read references/personality/voice-dna.md for Larry's voice" setup line | 39 commands/agents | 1 | 39 (78) | the larry-personality skill or the output style |
| Error 3-line pattern blocks (No Data Room found, What/Why/Fix) | 6 | 5 | 30 | skills/ui-system/SKILL.md |
| `# --- Phase 172-06 CIRS R1 exclude (Canon Part 11) ---` and similar connector comments | 37 + 7 | 1 to 10 | inside the 1,356 frontmatter comment lines | docs/CONNECTOR-CONTRACT.md |
| `interactive_first_reward: "--none (diagnostic surface)"` | 35 | 1 | 35 | default value in the registry builder |
| `license: BSL-1.1 ...` | 12 non-mirror + 112 mirrors | 1 | 124 | mirror generator adds it; acceptable |
| Agent header comment "The HOST enforces tools: ... omitClaudeMd ..." | 2 | 5 | 10 | docs/ (agent frontmatter contract) |
| Agent comment "Quick 261108-es3 removed the allowed-tools key ..." | 3+ | 1 | small | same |

Part 8 warnings: no identical multi-line Part 8 paragraph reached 3 copies in bodies. The Part 8 rule is restated in varied words; it is not a top item.

Change-history prose in prompts: 688 lines in commands/*.md cite a phase, decision, seed or quick id (Phase NNN, D-NN, SEED-NNN, quick 26...). Example: commands/eureka.md "Said plainly, because older text here claimed otherwise". This text explains past edits to a maintainer; the model does not need it to run the command.

## 3. Frontmatter and descriptions

- disable-model-invocation: 17 skill files contain the key. 6 set true (explain-decision, export, ingest-methodology, publish, snapshot, vault). 8 set false. 3 hits are comment text. 14 skills also carry the compatibility line that names disable-model-invocation semantics.
- omitClaudeMd: 0 agents set it. The 2 hits are comments in agents/dominant-design-researcher.md and agents/research-lane-analyst.md that list the key as supported.
- Description bytes (load each session in the listing): skills 11,887 (mean 95, max 901), commands 7,122 (mean 63, max 262), agents 3,195 (mean 187, max 356). Model-invocable skills: 119, 11,604 bytes. Total about 22 KB, about 5,500 tokens (ASSUMED 4 bytes per token).
- Largest skill descriptions: trending-to-absurd 901, mullins-scaffold 739, mos-deck-engine 619, client-discovery-interview 548, intelligence-orchestrator 517, larry-personality 267, doctor 262, scientific-roadmap 259. 8 are over 250 bytes, 5 are over 500.
- client-discovery-interview also exists as a user-level skill with the same name in this host (seen in the session skill list). Two triggers compete.
- Purpose is stated up to 4 times per command: description, help_jtbd (113 files, 113 lines), teaching (113 files, 177 lines), serves_jtbd (113 files, 188 lines). Consumers: help_jtbd 4 code files, teaching 16 code files.
- Frontmatter key cost in commands (lines): connector 1,107, allowed-tools 819, hitl_why 213, serves_jtbd 188, teaching 177, hitl_stages 156, interactive_first_reward 129.
- allowed-tools in commands names unscoped tools (mcp__mindrian-brain__brain_ask, brain_search, brain_query, brain_schema, read_neo4j_cypher x9, get_neo4j_schema x4, mcp__tavily__tavily-search). The live plugin names are mcp__plugin_mos_mindrian-brain__*. read_neo4j_cypher and get_neo4j_schema are Memgraph-era names. These pre-approvals probably match nothing (ASSUMED; probe the host to confirm).
- Whether the host injects frontmatter text into context on invocation: UNVERIFIED. If it does, the 1,356 frontmatter comment lines and the connector blocks cost context on every invocation.

## 4. Size distribution (top entries, lines; frontmatter lines in brackets)

Skills: file-meeting 1,282 [37], rooms 684 [19], research 674 [57], new-project 641 [29], whitespace 620 [34], room 613 [31], act 524 [67], setup 497 [18], onboard 487 [20], mos-reason 485 [46], ui-system 476 [10], admin 439 [22], scout 431 [41], find-analogies 420 [50], eureka 381 [44], room-proactive 344 [27], mos-deck-engine 331 [38], vault 328 [34], scheduled-tasks 303 [20], grade-grant 294 [37].

Commands: file-meeting 1,287 [42], rooms 688 [23], research 680 [63], new-project 645 [33], whitespace 623 [37], room 617 [35], act 530 [73], setup 501 [22], onboard 491 [24], mos-reason 490 [51], admin 441 [24], scout 440 [50], find-analogies 429 [59], eureka 384 [47], vault 332 [38], scheduled-tasks 310 [27], grade-grant 298 [41], persona 277 [57], causal 270 [37], grade 269 [42].

Agents: framework-runner 259, grading 213, persona-analyst 204, grant-reviewer 194, larry-extended 170, dominant-design-researcher 162, chain-step-reviewer 152, investor 144, analogy-query-fetcher 122, research-lane-analyst 121, opportunity-scanner 119, vault-section-reviewer 110, research 106, competitor-watch-fetcher 97, meeting-perspective-extractor 97, brain-query 94, reverse-salient-agent 46 [42].

What makes them large (PROVEN by section sizes):
- file-meeting (62,805 bytes): Step 3 five-perspective dispatch 370 lines, Step 5 summary 242, Step 1 input 159, Step 4 mapping 154. references/meeting/ already holds 10 files of 192 to 377 lines on the same topics. The command restates protocol that the references hold.
- rooms: one file holds 6 subcommands (new 133, git-setup 112, list 71, close 58, open 56, archive 54). Every invocation loads all 6.
- whitespace: 6 subcommands in one file (external 89, map 80, analyze 63, tree 57, score 55, discover 52).
- research: plan-run mode 177, URL mode 94, recovery 64, stages.
- new-project: deep exploration 121, room structure 102, git setup 92.
- ui-system skill (41,547 bytes): Body Shapes section 259 of 476 lines. 47 commands point at it (43 by ui_reference).
- Agents: larry-extended preloads 4 skills through `skills:` (larry-personality 284, context-engine 169, room-passive 174, room-proactive 344 = 971 lines) on every spawn. reverse-salient-agent preloads 2 (453 lines).

## 5. Method content: embedded versus fetched

Sample of 10 methodology commands (PROVEN):

| Command | Lines | references/ reads | Theo or brain_* mentions |
|---|---|---|---|
| analyze-needs | 79 | 2 | 0 |
| beautiful-question | 77 | 2 | 0 |
| build-knowledge | 122 | 2 | 0 |
| challenge-assumptions | 79 | 2 | 0 |
| explore-domains | 79 | 2 | 0 |
| lean-canvas | 75 | 2 | 0 |
| think-hats | 116 | 2 | 0 |
| validate | 78 | 2 | 0 |
| root-cause | 103 | 2 | 0 |
| find-analogies | 429 | 5 | 6 |

Finding: methodology commands embed very little framework teaching. They are thin wrappers (about 14 body lines, of which 13 are the firing block in many) that tell the model to read references/methodology/<name>.md (43 files, 6,602 lines, shipped in the package). 33 commands read references/methodology/; 8 commands name a brain_* or Theo tool. The method text comes from local references, not from Theo at run time. This conflicts in spirit with CLAUDE.md "Brain IP protection ... never distributed" and decision 8 "no surface ... serves methodology the graph did not give" (flag for the owner; not a size item).

In the 25-command wrapper family (2,491 lines), frontmatter is 1,088 lines (44 percent). The body is mostly template.

## 6. Dead, deprecated, duplicate

Reference counts per name (code files in tests, lib, scripts, hooks, bin; docs; data; other prompts) are in /tmp/claude-1000/-home-jsagi/2573fa9c-012c-4f0a-8072-478e6d3aa1be/scratchpad/eff/refs.txt. No name has zero references; the drift gates keep every name wired. Lowest: client-discovery-interview (0 code refs), pws-methodology (1), value-proposition (2), room-passive (2), mos-deck-engine (3), mullins-scaffold (3), context-engine (4).

Deprecated stubs past their own removal date (PROVEN): hmi-status, organize, heal, visualize (removal v1.14.0); mva-brief, mva-report (removal v2.0.0-beta.86). Current version is 2.0.0-beta.88. 438 lines in commands plus about 430 in mirrors. diagnostics says "[Renaming to /mos:fingerprint v1.14.0]" and is not renamed.

Near-duplicate purpose (description and body similarity):
- analyze-needs (Score customer jobs with importance and satisfaction) vs user-needs (Map user needs with importance vs satisfaction): same framework family, bodies 0.62 similar.
- futures (consequence wheel) vs explore-futures (TTA + Scenario + S-Curve) vs explore-trends vs macro-trends vs scenario-plan.
- deck vs present vs mos-deck-engine (skill).
- mullins vs mullins-scaffold (skill).
- dashboard vs show vs graph vs visualize (deprecated).
- doctor vs diagnostics vs heal (deprecated).
- room vs rooms vs organize (deprecated), plus room-passive and room-proactive skills.
- memory vs memory-cortex-reach vs dial-memory-refresh.
- grade vs deep-grade (grade-grant is separate).
- session-report vs mva-report (deprecated alias).

## 7. Agents

All 17 set `model: inherit`. 0 set omitClaudeMd. Tools (from the host agent listing):
- Read only, structured JSON, no writes: chain-step-reviewer, meeting-perspective-extractor, research-lane-analyst, vault-section-reviewer.
- Approved-query fetchers (Tavily, WebSearch, Read; never compose a query): analogy-query-fetcher, competitor-watch-fetcher, dominant-design-researcher.
- Brain readers: brain-query, grading, investor, research (Tavily plus Brain, Write).
- Writers or all tools: framework-runner (Read, Write, Bash, Glob), opportunity-scanner, persona-analyst, larry-extended (all), reverse-salient-agent (all).
- Reviewers: chain-step-reviewer, grant-reviewer, vault-section-reviewer, investor (adversarial), grading.
- Mode-parameter candidates: (a) one "structured-reader" agent with Mode = chain-step | meeting-perspective | research-lane | vault-section (4 agents, 480 lines); (b) one "approved-query-fetcher" with Mode = analogy | competitor | dominant-design (3 agents, 381 lines).
- omitClaudeMd candidates: every Read-only and fetcher agent (7). The project CLAUDE.md is 238 lines plus 4 includes (94 lines). These agents do not need it. Note: plugin agents run in the user's project, so this saves the user's CLAUDE.md, which can be large.
- Note from agent comments: the host ignores mcpServers and allowed-tools for plugin agents (quick 261108-es3, SEED-147), yet agents still carry both keys "as intent".

## 8. Ranked consolidation list

Estimates: repo lines removed; per-invocation context effect stated where it applies.

| Rank | Item | Est. lines saved | Context effect | Risks and collisions |
|---|---|---|---|---|
| 1 | Replace the 13-line firing block with a 1-line pointer (or move the rule into the gate renderer output and the larry-personality skill) | about 2,200 (commands + skills) | about 1 KB off each of 84 command invocations | scripts/stamp-firing-block.cjs and tests/test-219-qualify.cjs assert the block; update both. No 399/400 collision |
| 2 | Split large multi-subcommand files by progressive disclosure: keep a short router body, move subcommand detail to references/ (file-meeting to references/meeting/, rooms, whitespace, research, new-project, admin, setup, onboard) | about 1,500 net after dedup with references/meeting/ | file-meeting from about 63 KB to about 15 KB per invocation; rooms and whitespace similar | render-coverage and help-coverage read body shapes; tests that grep command bodies for step text. Keep names. No 399 collision |
| 3 | Remove the 6 deprecated stubs past their removal date | about 870 (with mirrors) | small | data/command-deprecations.json, help-coverage, registry. COLLISION: organize, mva-brief and mva-report are in the 399 data/run-step-capabilities.json list of 73 run-step commands. Remove them from that list first (it is refreshed from the book inventory) or keep them. 400 F-04/F-05 label counts use 113 commands |
| 4 | Move frontmatter comments (1,356 lines) and phase-history prose in bodies (688 cited lines, about half removable) to docs/ ledgers | about 1,350 frontmatter + about 700 body (with mirrors) | body part: direct context saving; frontmatter part: only if the host injects frontmatter (UNVERIFIED) | build-skill-mirrors.cjs names load-bearing comments (rs-experts); keep those. Mirror check must be rerun |
| 5 | One shared research plan-run protocol reference for eureka, find-analogies, find-bottlenecks, find-connections, scout, and the plan handoff for diffusion, map-unknowns, root-cause, think-hats (+1) | about 880 (with mirrors) | about 45 lines off each invocation | harness and test fixtures may grep these commands for planner CLI lines. No 399 collision |
| 6 | Generate the 25 methodology wrapper bodies from one template plus a data row (reference file, coaching note, target section, next command) | about 250 body (500 with mirrors) | small per invocation | user-facing names must stay as files (registration). 21 of the 25 are 399 run-step commands; keep names and serves_jtbd. Keep the frontmatter that the registry reads |
| 7 | Purpose fields: let the 400 three-slot job sentence replace help_jtbd and teaching, and derive description from the want slot | about 290 frontmatter lines in commands (580 with mirrors) | shorter listing; one purpose source | help_jtbd 4 code consumers, teaching 16 code consumers; retarget them to the job sentence. See section 9 |
| 8 | Agents: 2 Mode-parameter agents (structured-reader, approved-query-fetcher); set omitClaudeMd true on the 7 narrow agents | about 480 | each spawn of the 7 skips CLAUDE.md | data/subagent-dispatch-grants.json and tests name agent types; 399 put serves_jtbd on agents; 400 plans one job sentence per agent (a Mode agent needs one sentence per mode or one generic sentence) |
| 9 | larry-extended: preload larry-personality only; read context-engine, room-passive, room-proactive on demand | 0 repo lines | about 690 lines off each larry-extended spawn | Larry behaviour drift; test with a real-room run |
| 10 | Shorten the 5 skill descriptions over 500 bytes to under 200; drop the plugin client-discovery-interview or rename it (user-level skill has the same name) | about 2.5 KB per session listing | helps the listing budget so mos:* descriptions survive | trigger quality; the 400 job sentence can supply the trigger text |
| 11 | Fix or remove allowed-tools entries that use unscoped or retired MCP names (819 frontmatter lines in commands) | up to about 400 | none, but restores real pre-approval if it was intended | verify-release and check-brain-tool-liveness.cjs read these lists; probe the host first |
| 12 | Merge near-duplicate commands (analyze-needs with user-needs; futures family; deck/present; dashboard/show) behind aliases | about 300 to 600 | fewer listing entries | HIGH: analyze-needs, user-needs, futures, explore-futures, explore-trends, macro-trends, grade, deep-grade are 399 run-step pins and have separate rows in data/decision-advisor-table.json. Owner ruling needed per pair |
| 13 | Drop the generated mirrors: make skills/ the single source and retarget commands/ readers | about 22,000 repo lines, about 1.3 MB package | none per turn (skill already wins on name clash, ASSUMED) | HIGH: build-command-registry, render-coverage, help-coverage, apply-job-labels (399) and test-399-job-labels L6 read commands/; 400 writes labels to every command and skill. Do this after 400 lands, in one phase, with a Windows probe |

Total for ranks 1 to 11 (low and medium risk): about 8,500 lines, about 18 percent of the 49,239 skill, command and agent lines, before rank 13.

## 9. Phase 399 and Phase 400 labels: what they make redundant, and collisions

What exists (399): serves_jtbd in every command, mirror and agent frontmatter (114 skill/agent files carry it); data/job-vocabulary.json (one canonical job list); data/run-step-capabilities.json (73 commands); data/decision-advisor-table.json; data/capability-job-labels.json (MCP tools). The registry derives jtbd_label and jtbd_summary from the first serves_jtbd job.

What 400 adds (400-CONTEXT.md S1, S2): a job sentence {when, want, so} for every command, skill, agent and MCP tool; fits_domains and move_type per capability.

Prose the labels make redundant:
- help_jtbd (113 lines) and teaching (177 lines): both are free-text purpose statements. The {when, want, so} sentence covers them. help text can render from the sentence.
- description: can be the want slot, short and uniform. The when slot is the trigger text the long skill descriptions (trending-to-absurd, mullins-scaffold, mos-deck-engine, client-discovery-interview, intelligence-orchestrator) now carry in prose.
- Body "When to use" and "Use ONLY when" paragraphs and "This command guides the user through X" lines: covered by the when slot.
- Body "If the conversation reveals a connection to another methodology, suggest it: ... /mos:<next>" (16 copies): the advisor table and the curated chains choose the next move. Do not replace this with slot chaining (400 F-08: do not build chaining).
- fits_domains and move_type replace prose such as "use for complex problems" or "this is a probing move" where it exists; they do not replace hitl_why or connector blocks, which are governance, not purpose.

Collisions to flag:
- C1: 400 S1 puts 3 slots plus 2 label lists on every capability. If stored in frontmatter, about 5 lines x 238 command and skill files plus 17 agents, and the mirror generator doubles the command half (about 1,200 lines). Recommend: store sentences and labels in one data file keyed by capability (the data/capability-job-labels.json pattern 399 already uses for MCP tools), keep only serves_jtbd in frontmatter. This also keeps the mirror check simple.
- C2: test-399-job-labels.cjs L6 requires each mirror to carry the command serves_jtbd line. Any mirror removal (rank 13) must change L6 and apply-job-labels.cjs in the same plan.
- C3: run-step pins. organize, mva-brief, mva-report (deprecated) and the near-duplicate pairs in rank 12 are in data/run-step-capabilities.json. Removing or merging them changes the advisor table rows and the 400 F-04/F-05 counts.
- C4: rank 8 (Mode agents) reduces the agent count that 400 labels; decide the agent shape before 400 writes agent sentences.
- C5: 400 F-05 says housekeeping commands should be excluded from move matching. The deprecated stubs and the help, splash, status family are housekeeping; removing the stubs (rank 3) shrinks that exclusion list.
- C6: do not touch .planning/phases/400-*; a 400 agent works there.

## 10. Verification

- `node scripts/build-skill-mirrors.cjs --check`: OK, 112 mirrors.
- Measurements: python3 -I measure.py {mirror,size,desc,para,lines,heads,fmkeys}; python3 -I sim.py (pairwise body similarity, firing block removed).
- Not run: test suites, host probe for frontmatter injection, host probe for skill-vs-command precedence, Windows registration probe.
