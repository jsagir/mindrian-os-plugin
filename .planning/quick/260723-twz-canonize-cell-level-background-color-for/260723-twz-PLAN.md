---
phase: 260723-twz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - references/design/newsletter-email-template.html
  - docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
  - references/design/email-template-standard.md
  - /home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md  # outside repo, plain file edit, NOT committed
autonomous: true
requirements:
  - CELL-LEVEL-BG-CANON            # Orchestrator brief: move background-color OFF table style and ONTO the td cell(s) inside it, 6 confirmed sites per file; visual result must not change
  - EVERY-CELL-IN-MULTIROW-PANELS  # Orchestrator brief: for multi-row panels (command-chain box), apply background-color to EVERY row's td, not just the first, or an unstyled gap shows
  - DOC-CANONIZATION-TWO-PLACES    # Orchestrator brief: canonize as a hard rule in email-template-standard.md's numbered Rules list AND in the navigator's standing memory file, Part B
  - VISUAL-UNCHANGED-VERIFIED      # Orchestrator brief: prove the cream M:OS v1.1 look is untouched via before/after Playwright CLI screenshot comparison (not the MCP plugin, per feedback_playwright_cli)
  - NO-GMAIL-DRAFT-TOUCH           # Orchestrator brief: do not touch the live Gmail draft or call any Gmail MCP tool
  - NO-EMDASHES                    # feedback_no_emdashes (HARD RULE)

must_haves:
  truths:
    - "Rendering of references/design/newsletter-email-template.html and docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html is pixel-identical before and after the change (verified via Playwright CLI full-page screenshot, byte-compared with cmp) -- every full-bleed panel, top-cap card, and terminal-island block looks exactly as it did under the cream M:OS Canonical Design System v1.1."
    - "No table tag inside either HTML file's content body carries background-color in its style attribute anymore, except the single outermost page-wrapper table (matches body's own background-color, not a panel, explicitly out of scope)."
    - "Every td cell inside a formerly table-level-background panel now carries that panel's background-color directly, including BOTH rows of the two-row command-chain terminal box (command-names row and the docs-link caption row) -- no unstyled cream/white gap shows between them."
    - "email-template-standard.md's numbered Rules list states cell-level background-color as mandatory, and its Full-Bleed Alert Panel / Top-Cap Band Card / Full-Bleed Color Panel component-pattern snippets show background-color on the td, matching the actual re-skinned template exactly."
    - "The navigator's standing memory file (feedback_newsletter_story_challenge_playbook.md, Part B) documents the cell-level canon so future sessions do not reintroduce table-level background-color."
    - "No Gmail draft was touched and no Gmail MCP tool was called at any point in this plan."
  artifacts:
    - path: "references/design/newsletter-email-template.html"
      provides: "Canonical email template with all 6 confirmed panel backgrounds moved to cell level; table-level background-color count drops from 7 to 1 (only the excluded outer page wrapper remains)"
      contains: "background-color:#0C0C0D;padding:14px 20px 4px 20px"
    - path: "docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html"
      provides: "Drafted content instance with the identical 6-site cell-level conversion applied, real content untouched"
      contains: "background-color:#E11D22;padding:18px 20px"
    - path: "references/design/email-template-standard.md"
      provides: "Rule 12 added (cell-level background-color mandatory) plus 3 component-pattern snippets updated to match the re-skinned template"
      contains: "Background-color lives on"
    - path: "/home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md"
      provides: "Part B dated addendum canonizing cell-level background-color as the standing rule for this template family"
      contains: "260723-twz"
  key_links:
    - from: "references/design/newsletter-email-template.html"
      to: "docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html"
      via: "identical 6-site cell-level conversion applied to both files"
      pattern: "background-color:#1E52E0;padding:16px 20px"
    - from: "references/design/newsletter-email-template.html"
      to: "references/design/email-template-standard.md"
      via: "template is canonical source, .md is derived and kept in sync (per the .md's own header note)"
      pattern: "background-color:#FBFAF7;padding:16px 20px"
    - from: "before/after Playwright screenshots"
      to: "visual-unchanged requirement"
      via: "playwright screenshot --full-page against file:// URLs, byte-compared with cmp -s"
      pattern: "cmp -s .*\\.png"
---

<objective>
Retire the table-level background-color pattern in the two live email HTML surfaces (the canonical template and the already-drafted v1.15.3-beta.44 content instance) and replace it everywhere with the cell-level pattern already used at 28 of the other 35 background-color sites in the same file. This is a pure DOM-restructuring task: WHERE the color declaration lives moves from the wrapping table's style attribute to the style attribute of the td cell(s) immediately inside it. The rendered cream M:OS Canonical Design System v1.1 look -- full-bleed differentiated panels, bold-Arial headline, hero image, dark terminal-island code blocks -- does not change in any way. Cell-level background-color is the more broadly compatible pattern across email clients (confirmed via web research this session) and is the pattern a different email drafted earlier this session already used exclusively, with no Gmail compose-editor issues. This is the safer, more conservative choice, not a design compromise.

A fresh grep audit at planning time found 6 real table-level sites needing conversion in each file (not 7 as an earlier verbal recollection suggested): the STEP 0 red callout, the two neutral (#FBFAF7) what's-new cards, the blue (#1E52E0) what's-new card 2, the dark (#0C0C0D) command-chain terminal box (which has TWO rows, both need the cell-level fix), and the dark (#0C0C0D) triple-feature ink panel. The challenge-seed Courier box is NOT one of the sites -- its td already carries background-color:#0C0C0D directly and its wrapping table has no style attribute at all; it already follows the target pattern and must not be touched. The single outermost page-wrapper table (style="background-color:#F4F2EC;") -- the very first table after the opening body tag -- is also out of scope: it mirrors body's own background-color as a client-compatibility fallback, is not a "panel," and was never part of the confirmed site list.

Purpose: eliminate a DOM pattern that likely causes Gmail compose-editor rendering artifacts, converging every background-color declaration in this template family on the one pattern already proven safe, without touching the visual result at all.

Output: both HTML files with 6 sites converted per file (verified visually pixel-identical via Playwright before/after screenshots), plus the rule canonized in email-template-standard.md's Rules list and in the navigator's standing memory file (feedback_newsletter_story_challenge_playbook.md, Part B).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@references/design/newsletter-email-template.html
@docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html
@references/design/email-template-standard.md

DO NOT TOUCH: any live Gmail draft, and do not call any Gmail MCP tool (create_draft/update_draft/list_drafts/etc.) at any point in this plan.

DO NOT edit the challenge-seed Courier box (the td with style background-color:#0C0C0D;border-left:4px solid #C8A43C in section 10, "THE CHALLENGE + COPY-PASTE SEED") -- it already has cell-level background-color and needs no change. Its wrapping table never had a background-color style property to begin with.

DO NOT touch the single outermost page-wrapper table (role="presentation" width="100%" ... style="background-color:#F4F2EC;") immediately after the opening body tag in either file -- it is intentionally out of scope (matches body's own background-color, not a panel).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert 6 table-level background-color sites to cell-level in both HTML files, verify visual output is unchanged</name>
  <files>references/design/newsletter-email-template.html, docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html</files>
  <action>
Step 1: Re-confirm the exact site list per file before editing (files may have shifted since planning). Run this grep on both files: grep -n 'table[^>]*style="[^"]*background-color' FILE. Expect 7 matches each: the excluded outer page-wrapper table (background-color:#F4F2EC, first table after the body tag) plus the 6 real sites in this order: STEP 0 callout (#E11D22), what's-new card 1 (#FBFAF7), what's-new card 2 (#1E52E0), what's-new card 3 (#FBFAF7), command-chain terminal box (#0C0C0D), triple-feature ink panel (#0C0C0D).

Step 2: Capture baseline screenshots before touching anything. Create /tmp/twz-bg-check/. For each of the two HTML files, run: playwright screenshot --browser chromium --viewport-size=800,1400 --full-page "file:///ABSOLUTE_PATH_TO_FILE" /tmp/twz-bg-check/before-NAME.png (NAME = template or outbox).

Step 3: Apply the identical conversion to both files, one site at a time. For each of the 6 sites, remove the background-color:#XXX; property from the enclosing table tag's style attribute entirely (if that was the table's only style property, drop the style="..." attribute from the table tag completely rather than leaving style=""), and prepend background-color:#XXX; as the first property inside the style attribute of every td cell that is a direct child of that table's row(s):
  - STEP 0 callout: table currently has style="background-color:#E11D22;"; its one child td (style="padding:18px 20px;text-align:left;") gets background-color:#E11D22; prepended to its style, becoming style="background-color:#E11D22;padding:18px 20px;text-align:left;".
  - What's-new card 1: table currently has style="background-color:#FBFAF7;"; its one child td (style="padding:16px 20px;text-align:left;") becomes style="background-color:#FBFAF7;padding:16px 20px;text-align:left;".
  - What's-new card 2: table currently has style="background-color:#1E52E0;"; its one child td (style="padding:16px 20px;text-align:left;") becomes style="background-color:#1E52E0;padding:16px 20px;text-align:left;".
  - What's-new card 3: same pattern as card 1, using #FBFAF7.
  - Command-chain terminal box: table currently has style="background-color:#0C0C0D;" and wraps TWO tr/td rows -- apply background-color:#0C0C0D; to BOTH: the commands/gloss row (td style="padding:14px 20px 4px 20px;font-family:Courier,Consolas,monospace;font-size:13px;line-height:2;color:#C8A43C;text-align:left;") and the docs-link caption row (td style="padding:0 20px 14px 20px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#E8E8E2;text-align:left;"). Skipping the second row would leave a cream-colored gap under the command list, a real visual regression.
  - Triple-feature ink panel: table currently has style="background-color:#0C0C0D;"; its one child td (style="padding:16px 20px;text-align:left;") becomes style="background-color:#0C0C0D;padding:16px 20px;text-align:left;".
Leave every other attribute on every table and td tag (role, width, cellpadding, cellspacing, border, all other style properties) exactly as-is -- this is a background-color relocation only, nothing else changes.

Step 4: Capture after screenshots with the identical Playwright invocation used in Step 2 (same browser, same viewport-size, same --full-page flag) to /tmp/twz-bg-check/after-NAME.png.

Step 5: Byte-compare: cmp -s /tmp/twz-bg-check/before-template.png /tmp/twz-bg-check/after-template.png, and the same for the outbox pair. Both must report identical (exit 0). If either differs, stop and diagnose before proceeding -- a diff here means the DOM move changed something visually, which must not happen.
  </action>
  <verify>
    <automated>test "$(grep -c 'table[^>]*style="[^"]*background-color' references/design/newsletter-email-template.html)" = "1" && test "$(grep -c 'table[^>]*style="[^"]*background-color' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html)" = "1" && echo TABLE_BG_RETIRED_OK</automated>
    <automated>test "$(grep -c 'td[^>]*style="[^"]*background-color' references/design/newsletter-email-template.html)" = "35" && test "$(grep -c 'td[^>]*style="[^"]*background-color' docs/testers/outbox/2026-07-23-v1.15.3-beta.44-everything-got-better.html)" = "35" && echo TD_BG_COUNT_OK</automated>
    <automated>cmp -s /tmp/twz-bg-check/before-template.png /tmp/twz-bg-check/after-template.png && cmp -s /tmp/twz-bg-check/before-outbox.png /tmp/twz-bg-check/after-outbox.png && echo VISUAL_UNCHANGED_OK</automated>
  </verify>
  <done>
Both HTML files show exactly 1 table-level background-color match (the excluded outer page wrapper) and 35 td-level background-color matches (28 pre-existing plus 7 newly added: 1 each for STEP 0, card 1, card 2, card 3, and triple-feature, plus 2 for the command-chain box's two rows). The before/after Playwright screenshots are byte-identical for both files, proving the cream M:OS Canonical Design System v1.1 rendering is unchanged. The challenge-seed Courier box and the outer page wrapper were left untouched. No Gmail draft or Gmail MCP tool was touched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Canonize cell-level background-color as a hard rule in email-template-standard.md and the navigator's standing memory file</name>
  <files>references/design/email-template-standard.md, /home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md</files>
  <action>
Depends on Task 1 being complete (this task documents the pattern Task 1 just applied).

Part 1, references/design/email-template-standard.md: Add a new item 12 to the existing numbered "## Rules" list (currently ends at item 11, "NO em-dashes. Hyphens only."). New rule 12 text: "Background-color lives on td cells, never on table tags. Even full-bleed color panels (STEP 0 callout, what's-new cards, terminal-island blocks) put background-color on the cell(s) inside, not the wrapping table -- the cell-level pattern is the more broadly compatible one across email clients (some, including Gmail's compose editor, strip or mishandle table-level background-color)."

Then update the three "Component Patterns" code snippets that still show table-level background-color so they match the re-skinned template exactly:
  - "Full-Bleed Alert Panel (STEP 0 callout)" snippet: change the table line from table width="100%" style="background-color:#E11D22;" to table width="100%" (no style attribute), and change the td line from td style="padding:18px 20px;text-align:left;" to td style="background-color:#E11D22;padding:18px 20px;text-align:left;".
  - "Top-Cap Band Card (what's-new cards 1 and 3)" snippet: change the second table line from table width="100%" style="background-color:#FBFAF7;" to table width="100%" (no style attribute), and change its td line from td style="padding:16px 20px;text-align:left;" to td style="background-color:#FBFAF7;padding:16px 20px;text-align:left;".
  - "Full-Bleed Color Panel (what's-new card 2, triple-feature rail)" snippet: change the table line from table width="100%" style="background-color:#1E52E0;" to table width="100%" (no style attribute), and change its td line to td style="background-color:#1E52E0;padding:16px 20px;text-align:left;" -- add a one-line note directly under the snippet clarifying the triple-feature rail uses the same cell-level pattern with #0C0C0D instead of #1E52E0.
Leave the "Seed / Code Box" snippet untouched -- it already shows background-color on its td, confirming it was already following the now-canonical pattern; add one short sentence noting this for clarity ("this snippet already used the cell-level pattern before this rule was written").

Part 2, the memory file at the absolute path /home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md (a plain file outside this git repo -- use Read then Write/Bash to edit it directly, this is a normal file edit, not a git operation, and must NOT be committed to this repo): in the "## Part B - The challenge email" section, add a new dated paragraph immediately after the existing "cream M:OS canon" paragraph (the one ending "...LTR + left-aligned everywhere."). New paragraph text: "UPDATED 2026-07-23 (quick task 260723-twz): background-color for every panel in the template (STEP 0 callout, what's-new cards, the command-chain terminal box, the triple-feature panel) now lives on the td cell(s), never on the wrapping table tag. This closes a DOM pattern that likely caused Gmail compose-editor rendering artifacts -- cell-level background-color is the more broadly compatible pattern across email clients and was already used at the majority of background-color sites in the same template before this change. The visual cream M:OS Canonical Design System v1.1 result is unchanged; only the DOM location of the color declaration moved. Applies to every future issue built from this template." Also update the frontmatter modified timestamp at the top of the file to the current UTC time (obtain via date -u +%Y-%m-%dT%H:%M:%S.000Z and set the modified: field to that value). Do not alter any other existing content in the file, and do not remove the prior 2026-07-23T17:44:13.650Z history implied by the rest of Part B.
  </action>
  <verify>
    <automated>grep -c '^12\. \*\*' references/design/email-template-standard.md | grep -q '^1$' && grep -q 'Background-color lives on' references/design/email-template-standard.md && echo MD_RULE_ADDED_OK</automated>
    <automated>! grep -c 'style="background-color:#E11D22;">$' references/design/email-template-standard.md | grep -qv '^0$' && grep -q 'background-color:#E11D22;padding:18px 20px' references/design/email-template-standard.md && echo MD_SNIPPETS_UPDATED_OK</automated>
    <automated>grep -q '260723-twz' /home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md && grep -q 'cell-level' /home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md && echo MEMORY_UPDATED_OK</automated>
    <automated>! grep -qP '\xe2\x80\x94' references/design/email-template-standard.md /home/jsagi/.claude/projects/-home-jsagi/memory/feedback_newsletter_story_challenge_playbook.md && echo NO_EMDASH_OK</automated>
  </verify>
  <done>
email-template-standard.md has a new numbered Rule 12 mandating cell-level background-color, and its Full-Bleed Alert Panel / Top-Cap Band Card / Full-Bleed Color Panel snippets now show background-color on td instead of table, matching the re-skinned template. The Seed/Code Box snippet is confirmed already-correct with a clarifying note. The navigator's memory file (feedback_newsletter_story_challenge_playbook.md, Part B, outside this repo) has a new dated paragraph canonizing the same rule, and its modified timestamp is updated. Nothing else in either file changed. The memory file edit is not committed to this repo (it lives outside it). No em-dashes were introduced.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Plan scope -> live Gmail draft | This plan never syncs the DOM change to any existing Gmail draft; that surface is explicitly out of scope and untouched |
| Plan scope -> external memory file | The navigator explicitly authorized a direct plain-file edit to a path outside this git repo; the edit is a normal Read/Write file operation, not a git operation, and is never committed here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-twz-01 | Tampering/scope-creep | Any live Gmail draft | mitigate | Task 1 and Task 2 both explicitly forbid calling create_draft/update_draft/list_drafts or any Gmail MCP tool; verified by absence of any Gmail tool invocation in the executed transcript |
| T-twz-02 | Tampering | Visual regression from the DOM move (unstyled gap on the command-chain box, or a missed site) | mitigate | Step 5 in Task 1 requires a byte-identical Playwright before/after screenshot comparison via cmp -s before the task can be marked done; the multi-row command-chain box is called out explicitly to apply background-color to both rows |
| T-twz-03 | Repudiation | External memory file edit going unrecorded | mitigate | Task 2 requires a dated, task-ID-referenced paragraph in Part B plus an updated modified timestamp, so the change is traceable in the file's own history |
| T-twz-04 | Information disclosure | N/A -- no secrets, credentials, or PII touched | accept | Static HTML/Markdown DOM restructuring only; no network calls beyond local Playwright rendering of local files, no package installs, no credential access |
</threat_model>

<verification>
Phase-level checks (run after both tasks):
- grep -c 'table[^>]*style="[^"]*background-color' on both HTML files returns exactly 1 (only the excluded outer page-wrapper table remains).
- grep -c 'td[^>]*style="[^"]*background-color' on both HTML files returns exactly 35 (28 baseline plus 7 newly relocated).
- The challenge-seed Courier box's td still carries background-color:#0C0C0D directly; its wrapping table still has no style attribute.
- The command-chain box's TWO td rows both carry background-color:#0C0C0D (no unstyled gap).
- Playwright before/after full-page screenshots are byte-identical (cmp -s) for both HTML files.
- email-template-standard.md has a new Rule 12 and its three affected component snippets show cell-level background-color.
- feedback_newsletter_story_challenge_playbook.md (outside repo) has a dated Part B addendum naming quick task 260723-twz and the cell-level rule, with an updated modified timestamp.
- No Gmail MCP tool was called; no em-dash appears in any edited file.
</verification>

<success_criteria>
- Every table-level background-color site in both email HTML files (6 per file) is converted to cell-level, with the command-chain box's both rows covered and the already-correct challenge-seed box and the out-of-scope outer wrapper left untouched.
- The cream M:OS Canonical Design System v1.1 rendering is provably unchanged (byte-identical Playwright screenshots before and after).
- The cell-level background-color rule is canonized in both email-template-standard.md (numbered Rules list + updated snippets) and the navigator's standing memory file (Part B, dated addendum), so future sessions do not reintroduce the table-level pattern.
- No live Gmail draft was touched and no Gmail MCP tool was called.
</success_criteria>

<output>
Create `.planning/quick/260723-twz-canonize-cell-level-background-color-for/260723-twz-SUMMARY.md` when done, recording: confirmation that both HTML files pass the byte-identical screenshot check, the exact table-level/td-level background-color counts before and after, and confirmation that both documentation surfaces (email-template-standard.md, committed; feedback_newsletter_story_challenge_playbook.md, outside repo and not committed) now canonize the cell-level rule.
</output>
