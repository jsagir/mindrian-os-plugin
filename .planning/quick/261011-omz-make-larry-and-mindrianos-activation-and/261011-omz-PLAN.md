---
phase: quick-261011-omz
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/mcp/runtime-instructions.cjs
  - lib/mcp/no-instructions.test.cjs
  - scripts/session-start
  - agents/larry-extended.md
  - skills/larry-personality/SKILL.md
  - references/personality/voice-dna.md
  - lib/mcp/theo-faces.cjs
  - lib/mcp/app-identity.js
  - lib/mcp/app-views.cjs
  - lib/mcp/app-html/dashboard.html
  - lib/mcp/app-html/wiki.html
  - lib/mcp/app-html/graph.html
  - scripts/mindrian-mcp-server.cjs
  - tests/test-larry-theo-face-apps.cjs
autonomous: true
requirements: [QUICK-LARRY-IDENTITY]
canon_parts: [10, 12]
user_setup: []
must_haves:
  truths:
    - Every active Larry conversational reply begins with exactly one existing De Stijl glyph followed by the literal label "Larry | MindrianOS".
    - The first active Larry reply in each conversation identifies Larry as MindrianOS's PWS thinking partner, powered by Claude, integrated into the existing greeting.
    - Later replies retain the short label without repeating the full identity sentence; room deliverables contain neither conversational branding nor attribution boilerplate.
    - MCP initialization transmits the identity contract within 2000 UTF-8 bytes and preserves the frozen BOUNDARIES paragraph exactly as its tail.
    - The initialPrompt and persona_variants frontmatter bytes remain unchanged, and persona selection still chooses the existing question after the identity introduction.
    - A validated Desktop dev-preview ZIP reaches Windows Downloads without a version bump, release, push, or host configuration change.
  artifacts:
    - path: lib/mcp/runtime-instructions.cjs
      provides: Hookless Desktop and Cowork identity instructions on the actual MCP initialize response.
    - path: scripts/session-start
      provides: Consistent identity instructions for first-install, returning-user, updated, and existing-room activation.
    - path: references/personality/voice-dna.md
      provides: The identity contract inside the actual MCP Larry personality prompt.
    - path: tests/test-larry-product-identity.cjs
      provides: Hermetic cross-surface identity, precedence, immutable-frontmatter, and clean-artifact regression checks.
  key_links:
    - from: lib/mcp/runtime-instructions.cjs
      to: lib/mcp/no-instructions.test.cjs
      via: Genuine local stdio initialize and byte-budget assertions.
    - from: references/personality/voice-dna.md
      to: lib/mcp/larry-context.cjs
      via: Existing loadLarryContext personality-file loading; do not add a second loader.
    - from: scripts/release-lib/build-desktop-artifact.cjs
      to: Windows Downloads dev-preview ZIP
      via: Existing npm-pack-based Desktop payload builder and validated root-level ZIP packaging.
---

<objective>
Make MindrianOS activation and every active Larry conversational response visibly distinguish the plugin's thinking partner while honestly naming Claude as its underlying model. Use the existing identity, voice, persona and activation surfaces; provide a Desktop installation preview without altering the host's avatar or launching a release.

Output: consistent active-conversation identity instructions, meaningful regression verification, and a validated Desktop dev-preview ZIP in Windows Downloads.
</objective>

<execution_context>
@/home/jsagi/.claude/gsd-core/workflows/execute-plan.md
@/home/jsagi/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.claude/includes/release-process.md
@lib/mcp/runtime-instructions.cjs
@lib/mcp/no-instructions.test.cjs
@lib/mcp/larry-context.cjs
@scripts/session-start
@agents/larry-extended.md
@skills/larry-personality/SKILL.md
@references/personality/voice-dna.md
@scripts/release-lib/build-desktop-artifact.cjs

Quick-mode context: canonical workspace is /home/jsagi/dev/MindrianOS-Plugin; starting HEAD is 7306bc3f1e3fa92127f03185535f3ec1199811fe, two unrelated commits ahead of the local origin/main reference. Preserve those commits and the untracked .planning/debug/desktop-marketplace-add-fails-20261011.md. Branching is none and workflow.use_worktrees is false. No STATE edits by this planner; no remote writes or release in execution.

Locked identity contract: each active Larry conversational reply opens with one glyph from the existing five-color vocabulary, then "Larry | MindrianOS". First active reply per conversation contains exactly this sentence: "I’m Larry, MindrianOS’s PWS thinking partner, powered by Claude." Integrate it into the existing greeting and existing initialPrompt/persona question, without another greeting or another question. The label applies to active Larry conversation only, not native host responses, saved artifacts, raw JSON, code blocks, or machine protocol envelopes. Branding cannot replace tool execution or claim plugin activity merely because a label appears.

Discovery level 0: established local instruction and packaging patterns, no new dependency or external API. Existing MCP instructions measure 1984 bytes, so adding the contract requires compressing earlier prose without dropping any runtime-loop step, backend attribution, or the frozen BOUNDARIES tail. lib/mcp/larry-context.cjs loads references/personality/voice-dna.md, not the personality SKILL, so both authority paths must receive the same identity contract.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Serve honest Larry identity through MCP and its personality prompt</name>
  <files>lib/mcp/runtime-instructions.cjs, lib/mcp/no-instructions.test.cjs, references/personality/voice-dna.md</files>
  <read_first>lib/mcp/runtime-instructions.cjs, lib/mcp/no-instructions.test.cjs, lib/mcp/larry-context.cjs, lib/mcp/prompts.cjs, references/personality/voice-dna.md, lib/hmi/voice-color-mark.cjs</read_first>
  <action>Add the locked short label and first-active-reply attribution sentence to the existing runtime identity opening and to voice-dna's identity/voice authority. Say the model remains Claude and Larry is the MindrianOS persona; do not imply a separate model or replace Theo's teaching-backend attribution. Keep each pedagogical move's existing De Stijl color mapping and require exactly one leading glyph, with no additional decorative emoji. The label is the only mandatory reply prefix; do not introduce a second mark or a required extra move label. State that the full introduction happens once per conversation and that saved room artifacts remain clean deliverables. Compress only earlier runtime prose to retain every existing six-step loop behavior and Theo declaration while staying at or below 2000 UTF-8 bytes. Leave the exact frozen BOUNDARIES paragraph unchanged and at the end, and retain the independent frozen test literal. Extend the genuine initialize regression to assert that the served identity contract includes the literal label, first-reply attribution, and clean-artifact distinction; preserve all existing wire-identity, budget, cap and moat checks.</action>
  <verify>
    <automated>node lib/mcp/no-instructions.test.cjs</automated>
  </verify>
  <acceptance_criteria>
    - The actual initialize result equals RUNTIME_INSTRUCTIONS, contains "Larry | MindrianOS" and the exact first-active-reply sentence, and is at most 2000 UTF-8 bytes.
    - PART8_BOUNDARIES_FROZEN remains byte-identical and is still the served string's tail.
    - loadLarryContext(process.cwd()).full includes the same identity instructions from references/personality/voice-dna.md.
  </acceptance_criteria>
  <done>Both hookless MCP identity paths carry the same honest identity contract; existing initialization and graph-boundary safeguards pass.</done>
</task>

<task type="auto">
  <name>Task 2: Reconcile activation, persona greetings, and standing voice precedence</name>
  <files>scripts/session-start, agents/larry-extended.md, skills/larry-personality/SKILL.md</files>
  <read_first>scripts/session-start stable_prefix and RETURNING_USER_HINT, agents/larry-extended.md Voice and Persona-Aware Turn 1, skills/larry-personality/SKILL.md Voice Signature, scripts/first-install-router.cjs _buildAdditionalContext, tests/test-115-persona-variants.sh, tests/test-115-surfaces-grep.sh</read_first>
  <action>Put the identity contract into session-start's stable_prefix so first install, updates, returning users and existing-room activation inherit it. Reconcile "Skip the full introduction" with the once-per-conversation one-sentence identity, so returning users skip the onboarding tour while retaining that sentence on their first active Larry reply. Narrow any no-emoji wording in touched activation/voice instructions to allow exactly the required single leading De Stijl glyph and no decorative emoji elsewhere. Update the agent body's voice instructions and personality skill to require the short label on every active Larry reply, and the exact attribution sentence once per conversation. Preserve all agent YAML frontmatter byte-for-byte, including initialPrompt and persona_variants. Resolve persona-body precedence explicitly: choose the existing default or role-specific variant using the existing algorithm, place the mandated identity sentence after the leading glyph and label, then use the selected variant's existing question without repeating its redundant "I'm Larry." clause. Do not change stored variant values or add a second greeting/question. Keep the existing initialPrompt-is-the-greeting rule. Higher-priority conversation identity narrowly overrides older command no-emoji prose only for the single prefix glyph; machine outputs and filed artifacts stay unbranded. First-install-router already asks for one glyph; edit only its prompt text if a contradictory instruction demonstrably suppresses the label, preserving routing/state logic and recording any such additional file in the execution summary.</action>
  <verify>
    <automated>bash -n scripts/session-start; bash tests/test-115-persona-variants.sh; bash tests/test-115-surfaces-grep.sh; node tests/test-267.3-session-start-declaration.cjs</automated>
  </verify>
  <acceptance_criteria>
    - Agent frontmatter bytes match the starting HEAD exactly; existing persona and first-touch tests pass.
    - Stable activation, agent voice, and personality voice all state the identical short label and first-active-reply sentence.
    - Returning-user and persona instructions no longer suppress or duplicate the first-conversation identity introduction.
    - Existing first-install free-text routing, one-question behavior and no-extra-greeting instructions remain in force.
  </acceptance_criteria>
  <done>CLI and agent activation carry consistent identity with no persona-frontmatter changes, extra greeting, artifact branding, or routing changes.</done>
</task>

<task type="auto">
  <name>Task 3: Verify cross-surface delivery and package a Desktop dev preview</name>
  <files>tests/test-larry-product-identity.cjs; local /mnt/c/Users/jsagi/Downloads/mindrianos-desktop-larry-identity-dev-20261011.zip</files>
  <read_first>lib/mcp/no-instructions.test.cjs, lib/mcp/larry-context.cjs, tests/test-larry-voice-mark-182.cjs, tests/test-243-voice-glyph-honest.cjs, tests/test-143.2-doctrine-presence.cjs, scripts/release-lib/build-desktop-artifact.cjs</read_first>
  <action>Add one built-ins-only, hermetic regression suite for the cross-surface contract. Verify the actual loaded personality context, standing activation identity and precedence, immutable initialPrompt/persona frontmatter against the starting HEAD, single-glyph-plus-label examples using the existing glyph detector, and the explicit clean-artifact exception. Use actual MCP initialize coverage from Task 1 rather than simulating the server. Run the named existing voice, doctrine, persona and activation checks; report unrelated pre-existing failures accurately instead of changing their assertions to obtain green. Build the updated Desktop payload into an isolated task-specific temporary directory using the canonical scripts/release-lib/build-desktop-artifact.cjs build --source /home/jsagi/dev/MindrianOS-Plugin --out command, without --version override or release.sh. ZIP the builder output at the named Windows Downloads path with .claude-plugin/plugin.json at the ZIP root, no wrapper directory, DEFLATE level 6 and preserved executable modes. Validate builder checkPayload, CRC, contents matching the built tree, no symlinks, safe path segments, no top-level bin or lib/ui-shell/dist, at most 5000 files and 200000000 uncompressed bytes, and maximum per-file ratio at most 50. Record artifact bytes, file count, uncompressed bytes, SHA256, current source version and dev-preview status. Preserve the prior beta.65 fallback ZIP and untracked diagnostic report. Do not alter version manifests, tag, release, push, change the user's installation, access user rooms, or claim that Claude Desktop rendering or model compliance was tested when only instruction delivery was verified.</action>
  <verify>
    <automated>node tests/test-larry-product-identity.cjs; node lib/mcp/no-instructions.test.cjs; node tests/test-larry-voice-mark-182.cjs; node tests/test-243-voice-glyph-honest.cjs; node tests/test-143.2-doctrine-presence.cjs; bash tests/test-115-persona-variants.sh; bash tests/test-115-surfaces-grep.sh; node tests/test-267.3-session-start-declaration.cjs</automated>
  </verify>
  <acceptance_criteria>
    - Named checks verify real served instructions, byte budget, immutable boundaries, persona integrity and existing voice glyph behavior.
    - The distinct dev-preview ZIP exists in Windows Downloads, passes the complete ZIP validation, and contains the updated instructions and unchanged current source version.
    - The execution summary distinguishes verified instruction delivery from untested host rendering and conversational compliance; no marketplace fix or production release is claimed.
  </acceptance_criteria>
  <done>Identity delivery and existing compatibility gates are verified, and a locally validated Desktop dev preview is ready for user installation.</done>
</task>

</tasks>

<verification>
User steering (2026-10-11): Task 3 now also integrates the user's canonical Theo Faces state set. Vendor the exact POSES/LARRY/THEO definitions from /home/jsagi/dev/theo-face/prototype/theo-faces-canonical.html with provenance (SHA256 78c75c6a697213be390091d315af6e883a54f367651d79b36e18462eb46e2464). Add a shared, self-contained identity header to the three registered MCP views through the existing template loader: canonical face, Larry | MindrianOS, Powered by Claude, and an accessible operational status. Preserve all seven Theo states and eight Larry modes; use static canonical poses (reframe uses rf2) and actual read/refresh/error lifecycle only, never invented emotional/evidence states. Include a neutral face and honest title in MCP serverInfo metadata where supported; this does not replace Claude's host avatar. Fix the touched App import/constructor and install callbacks before connect, using the installed SDK's version and documented API. Keep initial and refreshed result consumption shared, prefer structuredContent with existing JSON-text fallback, and make connection errors visible. Add resource CSP for existing required origins. Verify canonical state geometry, real resource delivery, initial-result race, refresh/error states, reduced motion and desktop/mobile layouts with a bounded browser pass. Build the final preview only after these assets and lifecycle changes pass; keep versions, releases, remotes, user installations and rooms untouched.

Run every named check and record separate exit statuses. Review the final diff for exactly one-glyph identity, accurate Claude attribution, persona/frontmatter preservation, unchanged BOUNDARIES, clean artifact rules, no new dependency, no manual version bump, and no unrelated changes. Confirm the ZIP includes the built identity surfaces and report its SHA256. Check git status to ensure the earlier diagnostic report remains untracked and unstaged.
</verification>

<success_criteria>
The active Larry identity contract is delivered consistently on MCP, CLI and agent surfaces, without extra greeting turns, duplicate glyphs, changed persona values or branded room artifacts. Protocol and compatibility checks pass or accurately identify unrelated existing failures. A validated Desktop dev-preview artifact exists without a release or remote write. The host avatar and actual Claude model remain unchanged.
</success_criteria>

<source_audit>
GOAL: User's visible Larry/MindrianOS activation and every active conversational reply - covered by Tasks 1 and 2.
REQ QUICK-LARRY-IDENTITY: Honest powered-by-Claude attribution, one prefix glyph and label, first-reply sentence, clean artifacts - covered by Tasks 1 and 2, verified by Task 3.
RESEARCH: Runtime budget/frozen tail, real voice-DNA loader, persona first-touch precedence, existing Desktop builder and upload limits - covered by Tasks 1 through 3.
CONTEXT: Preserve frontmatter, old commits/report, versions and old ZIP; no release/push/host avatar change - covered by Tasks 2 and 3. No phase-specific ROADMAP requirements or deferred phase ideas are assigned to this quick task.
</source_audit>

<output>
After execution, create .planning/quick/261011-omz-make-larry-and-mindrianos-activation-and/261011-omz-SUMMARY.md with changed surfaces, verification results, artifact path and hash, and the limits of host verification. This planner writes only this PLAN.md and makes no code, commit or STATE changes.
</output>
