---
phase: quick-260916-kfc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements:
  - QUICK-260916-kfc
must_haves:
  truths:
    - "README.md names Theo as the current implementation of the Brain role, states the cutover date (2026-09-03), and says where it runs (theo-mcp.onrender.com, remote MCP)"
    - "The README answers three questions in plain English a newcomer can follow: what MindrianOS actually IS as a mechanism, WHY it was built, and HOW to install it and start"
    - "No unexplained internal jargon survives in the README: no ICM, no Tri-Polar, no Canon Part numbers, no MWP, no phase numbers, no reach or Shape vocabulary. Any term a newcomer would not know is either explained on the spot or cut"
    - "The voice is optimistic and inviting, confident about what the thing does and how easy it is to start, with every claim still literally true"
    - "A reader who has never seen this repo can tell from the README alone what Theo is, what crosses the wire to it, and what never does"
    - "Every factual claim added or retained in README.md is traceable to CLAUDE.md, docs/THE-BRAIN.md, docs/install/BRAIN-SETUP.md, docs/THEO-INSTALL-ID.md, docs/BRAIN-GRAPH-CENSUS.generated.md, or docs/MINDRIAN-CANON.md"
    - "The README is still the same document: the header badges, the loop-in-30-seconds list, the three-layer table, the honest-refusal section, the three-surfaces table, pricing, privacy, and links all survive in the same order"
    - "Every relative link in README.md resolves to a file that exists on disk, and every external URL returns a live response"
    - "The version badge still reads the shipped release 2.0.0-beta.41, not the unreleased working-tree version"
    - "README.md contains zero em-dash characters and zero doctrine-fence phrases"
  artifacts:
    - path: "README.md"
      provides: "Public front door that describes MindrianOS from the current build and explains Theo with working links"
      contains: "Theo"
  key_links:
    - from: "README.md"
      to: "docs/THE-BRAIN.md"
      via: "markdown link in the Theo section"
      pattern: "\\(docs/THE-BRAIN\\.md\\)"
    - from: "README.md"
      to: "docs/MINDRIAN-CANON.md (Part 8, the graph boundary)"
      via: "markdown link next to the boundary claim"
      pattern: "\\(docs/MINDRIAN-CANON\\.md\\)"
    - from: "README.md"
      to: "docs/BRAIN-GRAPH-CENSUS.generated.md"
      via: "markdown link attributing the 27,951 / 452 figures to their dated census"
      pattern: "\\(docs/BRAIN-GRAPH-CENSUS\\.generated\\.md\\)"
    - from: "README.md"
      to: "docs/install/BRAIN-SETUP.md"
      via: "markdown link for Desktop and Cowork connector setup"
      pattern: "\\(docs/install/BRAIN-SETUP\\.md\\)"
---

<objective>
Make README.md tell the truth about the current build, and add the one thing it is missing entirely: Theo, the graph-native teaching backend that has been serving every `brain_*` call since the 2026-09-03 cutover (Phase 339). Right now the README says "the Brain" nine times and never says what the Brain actually runs on, so a reader cannot tell whether that is a metaphor, a product, or a host.

Purpose: the README is the public front door and the npm package's own front page. The plugin's shipped CHANGELOG already names Theo 46 times; the README naming nothing is the inconsistency, not the fix. Every number in it also needs a traceable source, because two different generated docs in this repo report different corpus magnitudes and only one of them describes the live backend.
Second job, layered on the first: the README has to be understood by a newcomer. Plain English, first principles, the actual mechanism rather than the label for it. Someone smart who has never heard of PWS should finish the page knowing what this thing IS, WHY it exists, and HOW to start, and should want to try it. Internally precise vocabulary (ICM layers, canon part numbers, phase numbers, tri-polar, MWP) is correct in CLAUDE.md and docs and wrong in the front door.

Output: a README.md that is accurate line by line, explains Theo and MindrianOS itself in plain language, reads as confident and inviting rather than dry, and hyperlinks every named resource.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@README.md

## Facts established and source-checked during planning (2026-09-16). Do NOT re-derive these.

| Fact | Value | Source checked |
|------|-------|----------------|
| Latest SHIPPED release | `2.0.0-beta.41` | `git tag` (only v2.0.0-beta.41 exists), CHANGELOG.md top released entry, `~/mindrian-marketplace/.claude-plugin/marketplace.json` `source.version` |
| Working-tree version | `2.0.0-beta.42`, UNRELEASED (CHANGELOG top entry reads "[Unreleased] -- v2.0.0-beta.42 (in progress)") | `node lib/core/repo-version.cjs`, package.json, .claude-plugin/plugin.json |
| README badge today | reads `2.0.0-beta.41`, which is CORRECT. The badge tracks the shipped release, not the working tree, because it links to CHANGELOG.md | README.md:13, decision recorded in quick task 260916-ef1 |
| What Theo is | The graph-native teaching backend behind every `brain_*` call. "Brain" stays the constitutional ROLE name; Theo is named as its current implementation, NOT a rename (Phase 339 D-09) | CLAUDE.md three-layer table; docs/MINDRIAN-CANON.md Appendix D entry 40 |
| Cutover | Memgraph to Theo landed 2026-09-03 (Phase 339). Prior hop: Neo4j Aura to Memgraph, 2026-07-22 | CLAUDE.md Technology Stack table |
| Where it runs | `theo-mcp.onrender.com`, reached as a remote MCP server over Streamable HTTP. The plugin's CLI default is the BARE origin (the client appends `/mcp` and `/register` itself), resolved by `getBrainUrl()` in `lib/core/brain-client.cjs`; a direct Desktop or Cowork connector must include the `/mcp` path explicitly | CLAUDE.md; docs/THE-BRAIN.md; docs/install/BRAIN-SETUP.md |
| Connector key | `mindrian-brain` names the plugin's Brain SLOT, not the server behind it, which is why it did not change when the backend did. No `Authorization` header is needed | docs/install/BRAIN-SETUP.md; docs/339-NOTE-theo-desktop-connector-key.md |
| Graph magnitudes | 27,951 nodes, 452 Framework nodes, 39,732 relationships, 15 labels. Census dated 2026-09-11, taken against the Theo origin | docs/BRAIN-GRAPH-CENSUS.generated.md (Census Meta + C1) |
| NOT the source for those numbers | docs/CORPUS-STATS.generated.md says 27,904 nodes / 177 frameworks / 12,485 Pinecone vectors. That file describes the RETIRED incumbent's corpus and has not been regenerated against Theo. Do not cite it, do not "correct" the README down to it | CLAUDE.md; docs/MINDRIAN-CANON.md:48 and Appendix D entry 40 Ruling C |
| Vectors | e5 (multilingual-e5-large), 1024-dim, embedded LOCALLY with no network egress. Pinecone is RETIRED | CLAUDE.md Technology Stack table |
| Per-install identity | `x-theo-install-id`: 32 lowercase hex chars from a 128-bit random draw, minted once per install, stored at `~/.mindrian/theo-install-id.json` (mode 0600), holding only `{id, minted_at}`. It lets Theo tell one install calling twice from two installs calling once, and carries nothing else about you | docs/THEO-INSTALL-ID.md sections 1-3 |
| The boundary | Canon Part 8, the Graph Boundary: LOCAL to BRAIN is NO. Only generic methodology handles (framework names, problem types) cross | docs/MINDRIAN-CANON.md Part 8 (line 264) |
| Surface counts on disk | 113 commands, 126 skills, 15 agents, 4 pipelines. DOCTRINE: prose states these as enumerated-from-disk, never as a frozen literal (Canon Part 7 / Part 11). The README's existing "over a hundred commands" phrasing is compliant; do not hardcode 113 | `ls` enumeration; Canon Appendix D entry 40 |
| Install identifiers | plugin.json `name` = `mos`; marketplace entry `name` = `mos`; npm package `@mindrian_os/cli` with bin `mindrian-os`. The README's `mos@mindrian-marketplace` and `npx @mindrian_os/cli` are CORRECT | .claude-plugin/plugin.json, package.json, marketplace.json |
| CLI subcommands | `mindrian-os update` is real (`bin/cli.js` case 'update'). Confirm `doctor --all` before trusting it | bin/cli.js |
| Theo is already public | CHANGELOG.md names Theo 46 times and ships inside the npm tarball alongside README and LICENSE; skills/ and commands/ name it too. Naming Theo in the README discloses nothing that is not already published | grep over CHANGELOG.md, skills/, commands/ |
| Larry's persona rule is NOT a documentation rule | "Asked by name, say so briefly and honestly; never volunteer it" governs Larry's conversational turns. It does not govern docs, and this task does not touch any persona or skill file | mindrian-os MCP server instructions; skills/larry-personality/SKILL.md |
| The prior fence is SUPERSEDED | Quick task 260916-ef1 (earlier today) carried the must-have "The README says 'the Brain' and never names Theo". That was a scope fence holding a numerals-only fact correction to numerals only. This task's explicit instruction supersedes it. Say so in the SUMMARY | .planning/quick/260916-ef1-.../260916-ef1-SUMMARY.md |
| Doctrine fence applies to README.md | README.md is in `LIVING_DOCS_FILES` in tests/test-250-doctrine-fence.cjs. Four banned phrases: "silent fallback", "never mention (failures\|this bookkeeping)", "graceful degradation everywhere", "never tell (the )?user about degradation" | tests/test-250-doctrine-fence.cjs:95-113 |
| Stale doc, do NOT link | `docs/brain-setup.md` (lowercase) still reports Neo4j + Pinecone counts and calls the Brain "a paid-tier feature. Contact Jonathan for an API key", which contradicts today's free, silently-registered model. Link `docs/install/BRAIN-SETUP.md` instead | docs/brain-setup.md vs docs/install/BRAIN-SETUP.md |
| Known discrepancy, report only | README says "20 years of teaching"; docs/THE-BRAIN.md says "30+ years". Keep the README's 20 (it is consistent across three README sites and is the public figure). Record the drift in the SUMMARY as a follow-up; do NOT edit THE-BRAIN.md here | README.md:10,35,98 vs docs/THE-BRAIN.md |

## Scope fence

`files_modified` is exactly `README.md`. Do not fix the stale docs, the canon, or CLAUDE.md's own `mindrian-os@mindrian-marketplace` install string (also stale; plugin id is `mos`). Findings go in the SUMMARY as follow-ups, not in the diff.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Name Theo in the three places the Brain already appears, and add one compact Theo section</name>
  <files>README.md</files>
  <action>
Edit README.md at four sites. Preserve the document's voice and write in the register this whole plan demands: second person, short sentences, plain English a newcomer can follow, the mechanism named rather than a label for it, optimistic and inviting without exaggerating. No em-dashes (hyphens only), no emoji, no marketing superlatives, no unexplained internal vocabulary. Specifically banned from README prose: ICM, Tri-Polar, MWP, canon part numbers, phase numbers, reach ids, Shape letters, DIKW. Those are correct internally and wrong in the front door. Every claim still has to be literally true; optimism is in the framing, never in an inflated fact.

SITE 1, the loop step 2 (currently line 35). It reads "Your context triggers a question to the Brain, the methodology graph: 27,951 nodes and 452 frameworks built from 20 years of teaching...". Name the backend once inline so the sentence says the Brain runs on Theo, without disrupting the numbered list's rhythm. Keep the figures exactly as they are (27,951 / 452) and keep "20 years of teaching".

SITE 2, the three-layer table Brain row (currently line 98). Today it reads "The methodology graph: 27,951 nodes, 452 frameworks, 20 years of teaching, served over MCP". Rewrite that cell so it names Theo as what serves the role, mirroring CLAUDE.md's own three-layer table ("Theo, the graph-native teaching backend"), and keep the "Who owns it" cell's "Served remotely, never distributed" meaning intact.

SITE 3, a new section immediately AFTER the three-layer table and BEFORE the "Why not just talk to Claude, ChatGPT, or Gemini directly?" section. Heading: `## What Theo is`. Target 120 to 180 words. It must answer, in this order:
  - What Theo is: the graph-native teaching backend the Brain runs on. "Brain" is the role; Theo is the thing currently doing the job. State it that way, because the role name is constitutional and Theo is the implementation, not a rename (Phase 339 D-09).
  - When: the cutover landed 2026-09-03, replacing the graph database the Brain ran on before. One clause is enough. Do NOT write "Phase 339" in the README, and do not narrate the full Aura to Memgraph to Theo lineage. Naming Memgraph is optional and only if the sentence reads naturally without it needing explanation.
  - Where it runs: `theo-mcp.onrender.com`, a remote MCP server. Name the host in prose or code formatting. Do NOT make the raw MCP endpoint a clickable link, because a browser GET against an MCP endpoint returns an error and a dead-looking link in the front door is worse than no link. Link the setup doc instead.
  - What crosses the wire and what does not: a generic methodology question crosses (a framework name, a problem type); your room, your notes, your decisions, and your meetings never do. State this rule in plain words as a rule the project holds itself to, and link `docs/MINDRIAN-CANON.md` as where that rule is written down. Do NOT write "Canon Part 8" or any part number in the README prose; the part number is your sourcing, not the reader's.
  - The vectors stay home: semantic search uses e5 (multilingual-e5-large, 1024-dim) embedded locally on your machine with no network egress.
  - Where to read more, as inline markdown links in the prose or a short link line at the end of the section: `docs/THE-BRAIN.md` (what the Brain holds and the six tools it exposes), `docs/install/BRAIN-SETUP.md` (Desktop and Cowork connector setup, including why the connector URL needs the explicit `/mcp` path when the plugin's own default does not), and `docs/THEO-INSTALL-ID.md` (the opaque per-install identifier).

SITE 4, the privacy section (currently "## The privacy line"). Add at most two sentences: the only per-install thing Theo receives is `x-theo-install-id`, a 32-character random hex string minted once and stored locally, which lets Theo tell one install from another without learning who you are. Link `docs/THEO-INSTALL-ID.md`. Do not restructure the section.

Do NOT touch: the version badge, the three corpus figures, the install commands, the honest-refusal section, the surfaces table, pricing, or the command list. Those are Task 2's audit surface, and Task 2 only changes them if a check actually fails.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && test "$(grep -c 'Theo' README.md)" -ge 5 && grep -q '^## What Theo is' README.md && grep -q 'theo-mcp.onrender.com' README.md && test "$(grep -c '—' README.md)" -eq 0 && node --test tests/test-250-doctrine-fence.cjs && git diff --name-only | grep -qx 'README.md' && test "$(git diff --name-only | wc -l)" -eq 1 && echo TASK1-PASS</automated>
  </verify>
  <done>README.md names Theo at the loop step, in the three-layer table Brain row, in a new `## What Theo is` section placed between the three-layer table and the "Why not just talk to Claude" section, and in the privacy section. The section states the role-versus-implementation distinction, the 2026-09-03 cutover, the host, the Part 8 boundary, and local embedding, and links THE-BRAIN.md, install/BRAIN-SETUP.md, and THEO-INSTALL-ID.md. Zero em-dashes, doctrine fence green, and the working tree shows exactly one modified file.</done>
</task>

<task type="auto">
  <name>Task 2: Audit every remaining claim and every link, fix only what fails</name>
  <files>README.md</files>
  <action>
Walk the whole README top to bottom and check each claim against the repo. This is an audit: change a line ONLY when a check fails. Record every check and its outcome, pass or fail, in the SUMMARY.

CLAIM CHECKS (expected outcome in brackets, from planning):
  1. Version badge `version-2.0.0--beta.41` against `git tag --list 'v2.0.0*' | sort -V | tail -1` and the CHANGELOG's top RELEASED entry. The badge tracks the shipped release, never the working tree (`node lib/core/repo-version.cjs` reports the unreleased 2.0.0-beta.42). [expected: correct, no change]
  2. The three corpus figure sites (27,951 nodes twice, 452 frameworks three times) against `docs/BRAIN-GRAPH-CENSUS.generated.md`. [expected: correct, no change]. Attribute them: add ONE short parenthetical or footnote, at the three-layer table or the Theo section, pointing at `docs/BRAIN-GRAPH-CENSUS.generated.md` with its census date (2026-09-11) so a reader can trace the number. Do not add the figures a third time; attribute, do not repeat. Do NOT substitute the figures in docs/CORPUS-STATS.generated.md, which describes the retired backend.
  3. Install block: `npx @mindrian_os/cli` against package.json `name`; `claude plugin marketplace add jsagir/mindrian-marketplace` and `claude plugin install mos@mindrian-marketplace` against `.claude-plugin/plugin.json` `name` and the marketplace entry. [expected: all correct]
  4. Update block: `mindrian-os update` and `mindrian-os doctor --all` against `bin/cli.js`. `update` is confirmed present; confirm `doctor` accepts `--all` and fix the flag if it does not.
  5. "over a hundred commands across the skills, agents, and pipelines this plugin ships" against disk (113 commands, 126 skills, 15 agents, 4 pipelines). [expected: true]. Keep the enumerated-from-disk phrasing; do not freeze a literal count into the prose (Canon Part 7 / Part 11).
  6. The six `/mos:*` commands listed in the "Commands are internals" block: confirm each has a file in `commands/`. Drop or replace any that does not resolve.
  7. Pricing section against `.claude/includes/decisions.md` and `.claude/includes/moat.md`: the paid gate is installing and updating, not per-query; the Brain registers silently at no separate cost. [expected: consistent]
  8. Privacy section paths `~/MindrianRooms/` and `./.mindrian/`. Confirm against the repo before leaving them asserted.

LINK CHECKS. Every named resource must be hyperlinked and every hyperlink must resolve:
  - Relative targets: extract them and assert each exists on disk. Currently expected: CHANGELOG.md, LICENSE, docs/settings-template.json, plus whatever Task 1 added.
  - External URLs: https://mindrian-os.com, https://mindrian-os.com/logo_dark.svg, https://mindrian-os.com/docs/install, https://mindrian-os.com/brain-access, https://github.com/jsagir/mindrian-marketplace. A 2xx or 3xx is live. A 000, a DNS failure, or a 404 is a real break: report it in the SUMMARY and drop or repoint the link rather than shipping a dead one.
  - Anchor link `#three-surfaces` in the "Works on" badge must match a heading that still exists.
  - The Links section at the bottom: confirm it covers website, marketplace, changelog, and Brain access, and add a line pointing at the architecture docs the Theo section introduced so the reader has one place to find them.

Last, reread the diff end to end and confirm the document still reads as one voice, and that the three-layer table, the loop list, the honest-refusal section, and the surfaces table are all present, in their original order, with their original headings.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && BROKEN=$(grep -oE '\]\([^)]+\)' README.md | sed 's/^](//;s/)$//' | grep -v '^http' | grep -v '^#' | sort -u | while read -r p; do [ -e "$p" ] || echo "$p"; done) && test -z "$BROKEN" && for u in https://mindrian-os.com https://mindrian-os.com/logo_dark.svg https://mindrian-os.com/docs/install https://mindrian-os.com/brain-access https://github.com/jsagir/mindrian-marketplace; do c=$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 25 "$u"); echo "$c $u"; case "$c" in 2*|3*) ;; *) echo "DEAD-LINK $u"; exit 1;; esac; done && grep -q 'version-2\.0\.0--beta\.41-1E3A6E' README.md && test "$(grep -c '27,951 nodes' README.md)" -ge 2 && test "$(grep -c '452 framework' README.md)" -ge 3 && grep -q 'BRAIN-GRAPH-CENSUS.generated.md' README.md && grep -q '^## Three surfaces' README.md && grep -q '^## The loop, in 30 seconds' README.md && test "$(grep -c '—' README.md)" -eq 0 && node --test tests/test-250-doctrine-fence.cjs && test "$(git diff --name-only | wc -l)" -eq 1 && echo TASK2-PASS</automated>
  </verify>
  <done>Every claim in the README has been checked against the repo and the outcome recorded in the SUMMARY. Every relative link resolves to an existing file, every external URL returns 2xx or 3xx, the badge still reads the shipped release, the corpus figures carry a traceable source link to the dated census, the original sections and headings survive, zero em-dashes, doctrine fence green, and only README.md is modified.</done>
</task>

<task type="auto">
  <name>Task 3: The newcomer pass. What it is, why it exists, how to start, in plain English and an optimistic voice</name>
  <files>README.md</files>
  <action>
Read the whole README from the top as if you have never seen this project. Then make it answer three questions plainly, in the document's existing structure. This is a voice and comprehension pass on top of the facts Tasks 1 and 2 established; do not undo either, and do not reorder or delete sections.

WHAT IT IS (mechanism, not just tagline). The hero paragraph is a good promise but a newcomer cannot tell what actually happens. Somewhere in the opening (hero paragraph or the first section under it), one plain sentence must state the mechanism in concrete nouns: you install a plugin into Claude, you talk to it normally, it consults a methodology graph built from 20 years of teaching, and it files the conversation into a folder on your own machine that is still there next session. No metaphor carries that sentence. Keep the existing tagline; add the mechanism, do not replace the promise with it.

WHY IT WAS BUILT. The "You have a problem worth solving. You are probably solving the wrong one first." section is the why, and the "Why not just talk to Claude, ChatGPT, or Gemini directly?" section is the sharper why. Confirm both read as a problem a newcomer recognizes in themselves, in plain language, without insider vocabulary. Tighten only if a sentence needs an insider to parse it.

HOW TO START. The Install section currently reads as a command dump with two warnings attached. Rework the framing, not the commands:
  - Lead with the single command that works and say plainly that it is one command.
  - Say in one warm line what happens after the restart: Larry starts talking, and the connection to the methodology graph registers itself in the background, with no key to paste and no account to create first. That is already true and already in the section; make it feel like good news instead of a footnote.
  - Keep both field gotchas (a personal Claude Pro or Max account, and leaving the Windows native-modules checkbox unchecked) and keep the note about approving shell prompts. Frame them as two things worth knowing before you start, not as warnings.
  - Add the first move. After install, a newcomer does not know what to type. The README already documents `/mos:ignite` as the front door for starting a room. Confirm `commands/ignite.md` exists, then name it as the literal first thing to try, in one line, right after the install steps or at the close of the document.

JARGON SWEEP. Any word a newcomer would not know is either explained where it first appears or cut. Hard bans in README prose: ICM, Tri-Polar, MWP, canon part numbers, phase numbers, reach ids, Shape letters, DIKW. Explain-on-first-use, do not cut: "MCP" (one clause: the standard way Claude connects to an outside service), "Data Room" (one clause: the structured folder on your machine), and the readiness score in the example source line if a reader cannot infer it from context. "PWS" is already expanded on first use; leave it.

TONE. Confident, present tense, active voice, inviting. Banned as hype: revolutionary, game-changing, seamless, cutting-edge, best-in-class, unleash, supercharge, effortless, and any superlative not backed by a fact in this plan's context table. Optimism lives in the framing and the verbs, never in an inflated claim. No claim moves a single number.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && test -z "$(grep -nE '\bICM\b|Tri-Polar|Canon Part|\bMWP\b|Phase [0-9]|reach_id|DIKW' README.md)" && test -z "$(grep -niE 'revolutionary|game.chang|seamless|cutting.edge|best.in.class|unleash|supercharge|effortless' README.md)" && grep -q '/mos:ignite' README.md && test -f commands/ignite.md && grep -q '^## Install' README.md && grep -q '^## The three layers' README.md && grep -q '^## What Theo is' README.md && grep -q 'version-2\.0\.0--beta\.41-1E3A6E' README.md && test "$(grep -c '27,951 nodes' README.md)" -ge 2 && test "$(grep -c '452 framework' README.md)" -ge 3 && test "$(grep -c '—' README.md)" -eq 0 && node --test tests/test-250-doctrine-fence.cjs && test "$(git diff --name-only | wc -l)" -eq 1 && echo TASK3-PASS</automated>
  </verify>
  <done>A newcomer reading top to bottom learns the mechanism in one plain sentence, recognizes the problem it solves, sees that installing is one command, knows what happens after the restart, and knows the first thing to type. No banned internal vocabulary and no hype words survive. MCP and Data Room are explained where they first appear. Every section and heading from before this task is still present in the same order, every number is unchanged, doctrine fence green, only README.md modified.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo to public | README.md ships in the npm tarball and renders on GitHub. Anything written here is published. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kfc-01 | Information disclosure | Naming Theo and its host in public copy | mitigate | Disclose ONLY what already ships publicly: the name Theo, the `theo-mcp.onrender.com` origin, and the connector key, all of which already appear in the shipped CHANGELOG.md, docs/THE-BRAIN.md, docs/install/BRAIN-SETUP.md, skills/, and commands/. Never publish a key, an admin-tier endpoint, Cypher access details, internal phase-ops language, or anything from `.planning/`. |
| T-kfc-02 | Tampering | Scope creep out of README.md into canon, persona, or stale docs | mitigate | `files_modified` is README.md only; both tasks gate on `git diff --name-only` returning exactly one path. Stale-doc findings are reported in the SUMMARY, never fixed in this diff. |
| T-kfc-03 | Repudiation | An unsourced number entering the public front door | mitigate | Every figure retained must link or name its source doc; the audit records the source for each claim in the SUMMARY. The retired-backend figures in docs/CORPUS-STATS.generated.md are explicitly out of bounds. |
| T-kfc-SC | Tampering | npm/pip/cargo installs | n/a | This plan installs no packages. No legitimacy gate required. |
</threat_model>

<verification>
- `node --test tests/test-250-doctrine-fence.cjs` exits 0 (README.md is in the living-docs set).
- `grep -c '—' README.md` returns 0.
- `git diff --name-only` returns exactly `README.md`.
- Every relative markdown target in README.md exists on disk; every external URL returns 2xx or 3xx.
- `grep -ci theo README.md` is 5 or more, and `## What Theo is` exists as a heading.
- Zero hits for the banned internal vocabulary (ICM, Tri-Polar, Canon Part, MWP, `Phase <n>`, reach_id, DIKW) and zero hits for the banned hype words.
- `/mos:ignite` is named as the first move and `commands/ignite.md` exists.
</verification>

<success_criteria>
- A reader who lands on the GitHub page learns, without leaving it, what MindrianOS is, what the Brain is, that Theo is the backend serving it since 2026-09-03, where it runs, and what never leaves their machine.
- Every number, command, and path in the README was checked against the repo this session, and the check log lives in the SUMMARY.
- No dead links, no em-dashes, no doctrine-fence phrases, no invented facts, and no file other than README.md touched.
- The README still sounds like the README, only clearer: same sections, same order, same voice, now readable by someone who has never heard of PWS.
- The page reads as an invitation rather than a spec sheet, and every optimistic sentence is backed by a fact in this plan's context table.
</success_criteria>

<output>
Create `.planning/quick/260916-kfc-update-the-mindrianos-plugin-readme-md-s/260916-kfc-SUMMARY.md` when done.

The SUMMARY must carry, beyond the standard template:
1. The full claim-check log from Task 2: every claim, its source, and pass or fail.
2. A "Follow-ups found, not fixed here" list, seeded with the three already known: `docs/brain-setup.md` is stale (Neo4j + Pinecone counts, "paid-tier feature, contact Jonathan for an API key"); CLAUDE.md line 25 still says `claude plugin install mindrian-os@mindrian-marketplace` when the plugin id is `mos`; README says "20 years of teaching" while docs/THE-BRAIN.md says "30+ years".
3. An explicit note that quick task 260916-ef1's "never names Theo" must-have was a scope fence for that numerals-only task and is superseded by this one.
</output>
