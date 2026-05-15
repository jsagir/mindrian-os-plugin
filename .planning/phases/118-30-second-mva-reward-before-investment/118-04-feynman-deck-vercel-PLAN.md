---
phase: 118-30-second-mva-reward-before-investment
plan: "04"
slug: feynman-deck-vercel
type: execute
wave: 3
depends_on: ["02", "03"]
files_modified:
  - lib/core/mva-deck-builder.cjs
  - lib/core/mva-deck-builder.test.cjs
  - lib/core/mva-vercel-deploy.cjs
  - lib/core/mva-vercel-deploy.test.cjs
  - lib/core/resolve-vercel-key.cjs
  - lib/core/resolve-vercel-key.test.cjs
  - data/mva-deck-template.html
  - lib/core/mva-orchestrator.cjs
  - lib/core/mva-orchestrator.test.cjs
autonomous: true
requirements: [MVA-118-17, MVA-118-18, MVA-118-19, MVA-118-20]
canon_parts: [Part 8, Part 10]
beta_target: v1.13.0-beta.17
estimated_hours: 8-12
gap_closure: false

must_haves:
  truths:
    - "After the 6 agents return, the orchestrator builds a Feynman-style HTML deck from the agent payloads"
    - "The deck deploys to an ephemeral Vercel subdomain via Vercel REST API (LOCKED LD2 in 118-CONTEXT.md) within 3 seconds"
    - "The user sees the URL appear in the terminal as the FINAL output line BEFORE the 3-option footer"
    - "If Vercel deploy fails OR no VERCEL_TOKEN configured, the deck is written to a local file ~/.mindrian/mva/briefs/<sha8>.html AND the URL line shows the local path instead"
    - "Deck HTML is De Stijl themed (Mondrian palette, system fonts) and uses INLINE styles only (no <style> blocks -- mirrors feedback_tester_email_feynman_destijl_logo rule for Gmail-safe HTML, applied here for maximum portability)"
    - "Zero user-content egress: the deck contains the rendered Larry-voiced summary_lines + deck_data from the agents (which are themselves Part 8 compliant); the original raw sentence is NOT included anywhere in the deployed HTML"
    - "Vercel subdomain name carries sha8 of sentence_sha256 (NOT the sentence itself); the URL is shareable but does not leak the user's prompt"
  artifacts:
    - path: lib/core/mva-deck-builder.cjs
      provides: "Pure function: buildDeck(orchestratorOutcome) -> string (full HTML document). De Stijl theme, inline styles, no <style> blocks. 5-7 slides depending on how many agents returned ok."
      exports: ["buildDeck", "buildSlide", "DECK_PALETTE"]
    - path: lib/core/mva-vercel-deploy.cjs
      provides: "Vercel REST API client. deployDeck(htmlContent, sha8) -> Promise<{ url, deploy_duration_ms } | { error, fallback_path }>. Falls back to local file write on any failure."
      exports: ["deployDeck", "FALLBACK_DIR"]
    - path: lib/core/resolve-vercel-key.cjs
      provides: "VERCEL_TOKEN resolution mirroring lib/core/resolve-brain-key.cjs: process.env -> ~/.mindrian.env -> CWD/.env -> null"
      exports: ["resolveVercelKey", "VERCEL_PROJECT_NAME"]
    - path: data/mva-deck-template.html
      provides: "HTML skeleton with placeholder tokens: {{HEADER}}, {{SLIDES}}, {{FOOTER}}. Inline styles only. Mondrian palette + Impact/Helvetica/Courier system fonts."
      contains: "{{SLIDES}}"
    - path: lib/core/mva-deck-builder.test.cjs
      provides: "Tests: 6-agent ok -> 6 slides + header + footer; 3 ok + 3 empty -> 3 ok slides + 3 placeholder slides; all-fail -> sharp-question single slide; em-dash-free output; no <style> blocks; raw-sentence absent"
      contains: "describe('mva-deck-builder'"
    - path: lib/core/mva-vercel-deploy.test.cjs
      provides: "Tests: VERCEL_TOKEN missing -> falls back to local file; mocked Vercel API returns deployment URL; deploy_duration_ms recorded; subdomain hash = sha8 of input"
      contains: "describe('mva-vercel-deploy'"
    - path: lib/core/resolve-vercel-key.test.cjs
      provides: "Tests mirror resolve-brain-key.cjs test patterns"
      contains: "describe('resolve-vercel-key'"
  key_links:
    - from: lib/core/mva-orchestrator.cjs
      to: lib/core/mva-deck-builder.cjs
      via: require + buildDeck(outcome)
      pattern: 'buildDeck'
    - from: lib/core/mva-orchestrator.cjs
      to: lib/core/mva-vercel-deploy.cjs
      via: require + deployDeck(html, sha8)
      pattern: 'deployDeck'
    - from: lib/core/mva-vercel-deploy.cjs
      to: lib/core/resolve-vercel-key.cjs
      via: require + resolveVercelKey()
      pattern: 'resolveVercelKey'
    - from: lib/core/mva-deck-builder.cjs
      to: data/mva-deck-template.html
      via: fs.readFileSync at module load time
      pattern: 'mva-deck-template\.html'
    - from: lib/core/mva-vercel-deploy.cjs
      to: Vercel REST API
      via: "POST https://api.vercel.com/v13/deployments with bearer VERCEL_TOKEN"
      pattern: 'api\.vercel\.com'
---

<objective>
After the 6 agents return, build a Feynman-style HTML deck from their payloads and deploy to an ephemeral Vercel subdomain so the user gets a shareable URL within 3 seconds.

Per LD2 LOCKED (118-CONTEXT.md, resolves OQ2): Vercel REST API directly with VERCEL_TOKEN resolved via env precedence. Deploy to a single project `mindrianos-briefs`; each deploy gets a unique subdomain mos-brief-<sha8>.vercel.app. No CLI dependency on tester machines.

Per binding decision OQ4 lean (settled): on option-2 invest, the brief data lands in room.db (a job for Plan 118-05; this plan emits the data into the deck and into a side-file ready for 118-05 to consume). For now, the deck URL is the primary persistence; the side-file is for 118-05's option-2 path.

Per Canon Part 8: the deck contains rendered summary_lines + structured deck_data from agents (already Part 8 sanitized in Plan 118-02). The raw sentence is NEVER serialized into the HTML or sent to Vercel. The subdomain carries sha8 of the SENTENCE HASH (a hash of a hash), not the sentence.

Per Canon Part 10 sub-claim 3: the deck is the "receipt" the user sees -- the visible artifact that proves intelligence happened. This is THE artifact that closes the Hooked variable-reward loop.

Purpose: the deck + URL is the user-shareable receipt that makes the MVA real beyond their own terminal scrollback.

Output: 3 lib modules + 1 deck template + 3 test files + orchestrator wired to call deck-builder + deploy at the end of runPipeline.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-CONTEXT.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-02-six-agents-PLAN.md
@.planning/phases/118-30-second-mva-reward-before-investment/118-03-progressive-streaming-PLAN.md
@~/MindrianRooms/mindrian/mindrianOS/sub-rooms/communications/conversion-fix/solution-design/the-30-second-mva.md
@lib/core/resolve-brain-key.cjs
@lib/wiki/wiki-layout.cjs

<interfaces>
<!-- Contract dependencies -->

From Plan 118-03 (mva-orchestrator.cjs):
```typescript
type OrchestratorOutcome = {
  results: AgentResult[];        // 6 results from dispatcher
  rendered: string;              // The terminal output already shown
  footer_data: { ok: number, failed: number, sha256: string };
};
```

The deck builder consumes OrchestratorOutcome and produces a full HTML document.

Vercel REST API (LOCKED LD2 in 118-CONTEXT.md):
```typescript
POST https://api.vercel.com/v13/deployments
Headers:
  Authorization: Bearer <VERCEL_TOKEN>
  Content-Type: application/json
Body:
  {
    "name": "mos-brief-<sha8>",
    "files": [
      { "file": "index.html", "data": "<base64-encoded-html>", "encoding": "base64" }
    ],
    "projectSettings": { "framework": null },
    "target": "production"
  }
Response (success):
  { "url": "mos-brief-<sha8>-<random>.vercel.app", "id": "dpl_...", "readyState": "READY", ... }
```

The Vercel API timeout for deploy completion is typically ~1-3 seconds for a single HTML file. Per source spec line 71, the budget is "<3s for deploy". We use a 5-second cap for safety (still within the overall 45s phase budget).

De Stijl palette (mirrored from feedback_tester_email_feynman_destijl_logo + lib/wiki/wiki-layout.cjs):
- Canvas: #0D0D0D (near-black) or #F5F0E8 (cream)
- Red: #E0162B
- Yellow: #F8D43E
- Blue: #0F52BA
- Green: #2D7D46
- Amethyst: #7A4FA0
- Lines: 2-3px solid black

Fonts (system-safe per the De Stijl email rule applied here):
- Display: Impact, "Arial Black", sans-serif
- Body: Helvetica, Arial, sans-serif
- Code/monospace: Courier, "Courier New", monospace

Inline-styles-only rule rationale: while this is web-deployed (not email), enforcing inline-only keeps the HTML portable (works in any embed, any wrapping iframe, any CSP that blocks inline style tags) AND mirrors the style discipline from the broader email-style canon for consistency.

From the existing project per CONTEXT.md (lib/wiki/wiki-layout.cjs is the closest precedent for HTML deck generation -- mirror its De Stijl approach but reduce to a single-file template, not the multi-page wiki).
</interfaces>

<reference_only>
- Source spec lines 70-76 (the URL appears at t=30s; "Your Feynman deck: https://mos-brief-ab3c.vercel.app")
- Source spec line 126 ("Auto-deploy to ephemeral Vercel subdomain succeeds in <3s")
- feedback_tester_email_feynman_destijl_logo.md (De Stijl HTML rules; mirrored here for portability)
- feedback_no_emdashes.md (`--` not `—` everywhere in the deck text content)
- ~/.claude/projects/-home-jsagi/memory/feedback_no_real_names_in_repo.md (the deck must NOT include real names or biographical role tags of testers/advisors/partners; the deck is public via Vercel)
- lib/wiki/wiki-layout.cjs (precedent De Stijl HTML structure; this plan does NOT reuse the wiki code, just patterns the deck style after it)
- lib/core/resolve-brain-key.cjs (precedent env-var resolution pattern)
</reference_only>
</context>

<open_questions>
**OQ2 LOCKED (LD2 in 118-CONTEXT.md):** Vercel REST API direct with VERCEL_TOKEN env precedence. Project name `mindrianos-briefs`. Subdomain `mos-brief-<sha8>-<random>.vercel.app`. This is no longer an open question -- the executor MUST follow LD2 verbatim.

**OQ4 (partially resolved):** Deck data lands in (a) the deployed Vercel HTML + (c) Vercel URL persistence; (a) room.db landing is the Plan 118-05 option-2 job. This plan writes a side-file ~/.mindrian/mva/briefs/<sha8>.json with the structured deck data so 118-05 can consume it on option-2 selection.

**OQ13 (NEW, this plan): Should the deck include a "Generated by MindrianOS" footer with a link back to the install minisite?**
- LEAN: Yes. Footer line: "Generated by MindrianOS -- https://mindrianos-install-site.vercel.app" (no em-dashes; `--`). Plus a sha8 timestamp marker.
- Open: confirm with Jonathan that the install minisite link is correct attribution; the alternative is https://mindrianos-jsagirs-projects.vercel.app (the main site per lib/wiki/wiki-layout.cjs:21).
- This is per feedback_install_minisite_lockstep -- the install site is the canonical user-facing install URL.

**OQ14 (NEW, this plan): Vercel subdomain garbage collection.**
- Vercel free-tier preview deployments have no auto-deletion. They accumulate.
- LEAN: Phase 118 ships with no cleanup; document as a known limitation. Phase 121.5 capstone OR a v1.14.0 follow-up adds a daily cron to delete deployments older than 7 days via the Vercel REST DELETE endpoint.
- Open: confirm with Jonathan that v1.13.0 can ship without cleanup (or that the 7-day cleanup is a hard requirement for the release gate).

**OQ15 (NEW, this plan): What happens to the 3-option footer when the deck deploys successfully?**
- The terminal shows the URL line first, THEN the 3-option footer.
- The deck itself ALSO renders the 3-option text at the bottom of the HTML, but the user can only "click" option 2 (a button labeled "Build a room around this") that triggers a `mailto:` or copy-to-clipboard fallback -- because Vercel-hosted HTML can't invoke a local CLI.
- LEAN: deck shows the 3 options as static text + a copy-to-clipboard button for the brief sha8 ("paste this in your terminal: /mos:new-project --from-brief <sha8>"). Real routing happens in the terminal (Plan 118-05).
</open_questions>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Vercel key resolution helper + Vercel deploy module</name>
  <files>lib/core/resolve-vercel-key.cjs, lib/core/resolve-vercel-key.test.cjs, lib/core/mva-vercel-deploy.cjs, lib/core/mva-vercel-deploy.test.cjs</files>
  <behavior>
    resolve-vercel-key tests (RED first):
    - Test 1: With process.env.VERCEL_TOKEN set, resolveVercelKey() returns that value.
    - Test 2: With process.env unset but ~/.mindrian.env containing `VERCEL_TOKEN="abc123"`, resolveVercelKey() returns 'abc123'.
    - Test 3: With both unset, resolveVercelKey() returns null.
    - Test 4: With ~/.mindrian.env containing `VERCEL_TOKEN=raw-no-quotes`, resolveVercelKey() returns 'raw-no-quotes' (the quote-stripping handles both quoted and unquoted per feedback_gmail_qp_env_var_corruption.md hard-rule lessons learned).
    - Test 5: VERCEL_PROJECT_NAME exported constant === 'mindrianos-briefs'.

    mva-vercel-deploy tests:
    - Test 6: deployDeck(html, 'ab3c1234') with no VERCEL_TOKEN -> returns { error: 'vercel_unavailable', fallback_path: '/home/.../.mindrian/mva/briefs/ab3c1234.html', deploy_duration_ms: <num> }. The HTML is written to that path.
    - Test 7: deployDeck with TOKEN set and Vercel API mocked to return 200 + body { url: 'mos-brief-ab3c-xyz.vercel.app', readyState: 'READY' } -> returns { url: 'https://mos-brief-ab3c-xyz.vercel.app', deploy_duration_ms: <num> }.
    - Test 8: deployDeck handles 4xx/5xx from Vercel: falls back to local file, returns { error: 'vercel_api_error', status: 5xx, fallback_path, deploy_duration_ms }.
    - Test 9: deployDeck has a 5-second timeout (AbortController + fetch signal). If Vercel API hangs, deploy aborts and falls back. Wall-clock <5500ms.
    - Test 10: The subdomain name in the deploy request body matches `mos-brief-<sha8>` exactly (Test grabs the request body via fetch mock; assert body.name).
    - Test 11: deployDeck NEVER passes the raw HTML body to Vercel as a query parameter or URL -- only as base64-encoded file content in the request body (Canon Part 8 cleanliness; the deck itself is sanitized at build-time, but the URL/query channel must also be clean).

    Run: `node --test lib/core/resolve-vercel-key.test.cjs lib/core/mva-vercel-deploy.test.cjs` passes all 11.
  </behavior>
  <action>
    Step 1: Implement lib/core/resolve-vercel-key.cjs mirroring lib/core/resolve-brain-key.cjs structure. Key precedence: process.env -> ~/.mindrian.env (parse KEY=VALUE lines; strip surrounding double-quotes if present, per feedback_gmail_qp_env_var_corruption.md hard-rule) -> CWD/.env -> null. Export VERCEL_PROJECT_NAME = 'mindrianos-briefs'.

    Step 2: Implement lib/core/mva-vercel-deploy.cjs.
    ```javascript
    'use strict';
    const fs = require('node:fs');
    const path = require('node:path');
    const os = require('node:os');
    const { resolveVercelKey, VERCEL_PROJECT_NAME } = require('./resolve-vercel-key.cjs');

    const FALLBACK_DIR = path.join(os.homedir(), '.mindrian', 'mva', 'briefs');
    const VERCEL_API_URL = 'https://api.vercel.com/v13/deployments';
    const DEPLOY_TIMEOUT_MS = 5000;

    function writeFallback(html, sha8) {
      fs.mkdirSync(FALLBACK_DIR, { recursive: true });
      const fallbackPath = path.join(FALLBACK_DIR, sha8 + '.html');
      fs.writeFileSync(fallbackPath, html, 'utf8');
      return fallbackPath;
    }

    async function deployDeck(html, sha8) {
      const t0 = Date.now();
      const key = resolveVercelKey();
      if (!key) {
        const fallback_path = writeFallback(html, sha8);
        return { error: 'vercel_unavailable', fallback_path, deploy_duration_ms: Date.now() - t0 };
      }
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), DEPLOY_TIMEOUT_MS);
      try {
        const response = await fetch(VERCEL_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            name: `mos-brief-${sha8}`,
            files: [{
              file: 'index.html',
              data: Buffer.from(html, 'utf8').toString('base64'),
              encoding: 'base64'
            }],
            projectSettings: { framework: null },
            target: 'production'
          }),
          signal: ctl.signal
        });
        clearTimeout(timer);
        if (!response.ok) {
          const fallback_path = writeFallback(html, sha8);
          return { error: 'vercel_api_error', status: response.status, fallback_path, deploy_duration_ms: Date.now() - t0 };
        }
        const data = await response.json();
        return { url: 'https://' + data.url, deploy_duration_ms: Date.now() - t0 };
      } catch (e) {
        clearTimeout(timer);
        const fallback_path = writeFallback(html, sha8);
        return { error: 'vercel_exception', error_short: String(e.message || e).slice(0, 60), fallback_path, deploy_duration_ms: Date.now() - t0 };
      }
    }

    module.exports = { deployDeck, FALLBACK_DIR };
    ```

    Step 3: Write all 11 tests. Use global.fetch monkey-patch for Vercel API mocking; use os.tmpdir() override (HOME env or os.homedir() spy) for the fallback path tests.

    Step 4: Canon Part 8 grep check: assert `lib/core/mva-vercel-deploy.cjs` has no references to `MVA_SENTENCE`, `context.sentence`, or any raw-sentence field name. The function only sees `html` (already sanitized at build time) and `sha8` (a hash).
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/resolve-vercel-key.test.cjs lib/core/mva-vercel-deploy.test.cjs</automated>
  </verify>
  <done>
    - All 11 tests pass.
    - resolveVercelKey precedence matches resolve-brain-key.cjs (process.env -> mindrian.env -> CWD .env -> null).
    - deployDeck handles 4 failure modes: no key, API error, timeout, exception. All fall back to local file write.
    - Local fallback path is ~/.mindrian/mva/briefs/<sha8>.html.
    - Wall-clock cap is 5 seconds via AbortController (Test 9).
    - Vercel request body uses base64-encoded HTML file content (Test 11).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Deck template + builder (pure HTML generation)</name>
  <files>data/mva-deck-template.html, lib/core/mva-deck-builder.cjs, lib/core/mva-deck-builder.test.cjs</files>
  <behavior>
    Deck builder tests (RED first):
    - Test 1: buildDeck with all 6 agents ok -> returns a string starting with `<!DOCTYPE html>`, containing 6 slide divs (one per agent), ending with `</html>`. Length > 2000 chars.
    - Test 2: Em-dash sweep: the returned HTML has zero `—` characters. The 3-option footer uses `--` not `—`.
    - Test 3: No <style> blocks: assert /<style[^>]*>/.test(html) === false.
    - Test 4: Inline styles ARE present: assert /style="[^"]+"/.test(html) === true and there are >= 10 inline style attributes.
    - Test 5: Mondrian palette present: assert the HTML contains at least 3 of {#E0162B, #F8D43E, #0F52BA, #2D7D46, #7A4FA0}.
    - Test 6: Empty-state agents: when 3 agents return status 'empty', the deck has 3 slides showing the empty-state placeholder text (matches Plan 118-03 renderer's empty-state strings).
    - Test 7: All-fail: when all 6 agents return error/timeout/empty, buildDeck produces a single-slide deck showing the sharp-question fallback verbatim from source spec line 111.
    - Test 8: Raw-sentence absent: buildDeck takes orchestratorOutcome which has NO raw sentence field; verify the output HTML contains no field labeled "sentence", "prompt", or "user_input"; the only sentence-related identifier is the sha8 footer marker.
    - Test 9: Footer rendering: deck includes a "Generated by MindrianOS" footer with the install-site link (per OQ13 lean) AND the sha8 marker.
    - Test 10: 3-option footer in deck: the bottom of the deck has the verbatim 3-option text from binding decision B4, rendered as static text + a copy-to-clipboard button for the brief sha8 (per OQ15 lean).
    - Test 11: data/mva-deck-template.html exists and has the 3 placeholder tokens {{HEADER}} {{SLIDES}} {{FOOTER}} (regex check).
    - Test 12 (NIT-3 palette-divergence check): if lib/wiki/wiki-layout.cjs exists, grep it for hex palette constants (#E0162B|#F8D43E|#0F52BA|#2D7D46|#7A4FA0|#0D0D0D|#F5F0E8 or any other hex literal in a palette-named const) and assert every hex in DECK_PALETTE that ALSO appears in wiki-layout.cjs uses the SAME hex value. Diff any divergence as a test-failure message. If lib/wiki/wiki-layout.cjs does NOT exist, document via the test skip-reason "wiki-layout.cjs absent; palette is freshly defined for the MVA deck" -- the test PASSES (skipped, not failed). Rationale: maintain palette parity with the existing De Stijl wiki surface so the deck and the wiki feel like one product (and so any future palette evolution updates both atomically).

    Run: `node --test lib/core/mva-deck-builder.test.cjs` passes all 12.
  </behavior>
  <action>
    Step 1: Create data/mva-deck-template.html. Single HTML document with these inline-styled regions:
    ```html
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>30-Second Brief -- MindrianOS</title>
    </head>
    <body style="margin:0;padding:0;background:#F5F0E8;font-family:Helvetica,Arial,sans-serif;color:#0D0D0D;">
    {{HEADER}}
    <main style="max-width:900px;margin:0 auto;padding:24px 32px;">
    {{SLIDES}}
    </main>
    {{FOOTER}}
    </body>
    </html>
    ```
    HEADER: a Mondrian color-bar (5 rectangles in Red/Yellow/Blue/Green/Amethyst) + "MINDRIAN" wordmark in Impact + the sha8.
    SLIDES: one <article> per agent.
    FOOTER: 3-option text + copy button + sha8 marker + "Generated by MindrianOS" attribution.

    Step 2: Implement lib/core/mva-deck-builder.cjs.

    Key flow:
    - Load template via fs.readFileSync at module-load time (cached).
    - buildSlide(agentResult): produces an <article> with:
      - Slide label (Red/Yellow/Blue/Green/Amethyst rotation by agent_id deterministically)
      - Summary line (Larry-voiced; reuses Plan 118-03 renderer's summary mapping)
      - Structured deck_data rendered as a small list/grid (e.g., for brain_similar, list the 3 ventures with their statuses; for tavily_funding, list the funding match with deadline)
      - On status 'empty'/'error'/'timeout': render the placeholder text matching the terminal output's empty-state strings (consistent narrative)
    - buildDeck(outcome):
      - Hebrew refusal short-circuit: if outcome.footer_data?.hebrew_refusal -> return a Hebrew refusal deck (single slide)
      - All-fail: if outcome.footer_data.ok === 0 -> return a sharp-question single-slide deck
      - Normal: header + 6 slides + footer
    - DECK_PALETTE = Object.freeze({ red: '#E0162B', yellow: '#F8D43E', blue: '#0F52BA', green: '#2D7D46', amethyst: '#7A4FA0', cream: '#F5F0E8', black: '#0D0D0D' })

    All output uses `--` not `—` (no em-dashes; verified by Test 2).

    Step 3: Add a Canon-Part-8 grep test in mva-deck-builder.test.cjs:
    ```javascript
    test('canon part 8: deck contains no raw-sentence references', () => {
      const code = fs.readFileSync(__dirname + '/mva-deck-builder.cjs', 'utf8');
      assert.equal(code.match(/MVA_SENTENCE/), null);
      assert.equal(code.match(/process\.env\.CLAUDE_USER_PROMPT/), null);
      const template = fs.readFileSync(__dirname + '/../../data/mva-deck-template.html', 'utf8');
      assert.equal(template.match(/MVA_SENTENCE/), null);
      // No biographical role tags from feedback_no_real_names_in_repo.md
      assert.equal(template.match(/Lawrence|Gary|Natan|Rea|Jonathan|Aronhime/), null);
    });
    ```

    Step 4 (NIT-3 palette parity check): Add a wiki-layout palette-divergence test:
    ```javascript
    test('nit-3: palette parity with lib/wiki/wiki-layout.cjs (if present)', () => {
      const wikiPath = path.join(__dirname, '..', '..', 'lib', 'wiki', 'wiki-layout.cjs');
      if (!fs.existsSync(wikiPath)) {
        // Freshly defined palette case -- the diff is skipped + DECK_PALETTE stands alone
        // Per plan-checker iter 2 NIT-3: document the absence rather than silently pass
        console.log('  (skipped: lib/wiki/wiki-layout.cjs absent; palette is freshly defined for the MVA deck)');
        return;
      }
      const wikiSource = fs.readFileSync(wikiPath, 'utf8');
      const deck = require('./mva-deck-builder.cjs');
      const palette = deck.DECK_PALETTE;
      const divergent = [];
      for (const [name, hex] of Object.entries(palette)) {
        // For each color in DECK_PALETTE, look for a same-color hex literal in wiki-layout.
        // We compare by hex VALUE: if wiki-layout uses #E0162B (red), DECK_PALETTE.red MUST also be #E0162B.
        // Pattern: any hex literal in wiki-layout that semantically corresponds (case-insensitive).
        const hexUpper = hex.toUpperCase();
        const wikiHasSameHex = wikiSource.toUpperCase().includes(hexUpper);
        // If wiki has a DIFFERENT hex for the same semantic color (e.g. red), flag it.
        // Simplest check: if any of the canonical Mondrian colors appears in wiki at a different value, surface it.
        if (!wikiHasSameHex) {
          // Look for any hex literal with similar lightness; surface as INFO not FAIL unless explicitly divergent.
          const otherHexes = (wikiSource.match(/#[0-9A-Fa-f]{6}/g) || []).map(h => h.toUpperCase());
          // Only flag if wiki has a hex AND it's not our hex AND the name suggests same-semantic-color
          const wikiMentionsColor = new RegExp('\\b' + name + '\\b', 'i').test(wikiSource);
          if (wikiMentionsColor && otherHexes.length > 0) {
            divergent.push(`${name}: deck=${hex}, wiki references "${name}" but uses different hex(es): ${otherHexes.slice(0,3).join(', ')}`);
          }
        }
      }
      assert.equal(divergent.length, 0,
        'Palette divergence detected vs lib/wiki/wiki-layout.cjs:\n  ' + divergent.join('\n  ') +
        '\nReconcile DECK_PALETTE with wiki-layout.cjs or document the divergence in the SUMMARY.');
    });
    ```

    Step 5: Write all 12 tests. Build the deck with synthetic OrchestratorOutcome objects.
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-deck-builder.test.cjs && if [ -f lib/wiki/wiki-layout.cjs ]; then echo "wiki-layout exists -- palette parity check ran"; else echo "wiki-layout absent -- palette freshly defined (per NIT-3 documented skip)"; fi</automated>
  </verify>
  <done>
    - All 12 tests pass (11 base + 1 palette parity).
    - HTML is em-dash-free (Test 2).
    - No <style> blocks; only inline styles (Tests 3, 4).
    - Mondrian palette present (Test 5).
    - Empty-state and all-fail rendering paths work (Tests 6, 7).
    - No raw sentence anywhere (Test 8 + grep test).
    - No real names in template (grep test).
    - Footer attribution + 3-option text + sha8 marker (Tests 9, 10).
    - Palette parity check vs lib/wiki/wiki-layout.cjs runs successfully (Test 12); if wiki-layout.cjs absent, the test logs the documented skip rationale and passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire deck + deploy into orchestrator</name>
  <files>lib/core/mva-orchestrator.cjs, lib/core/mva-orchestrator.test.cjs</files>
  <behavior>
    Extended orchestrator tests:
    - Test 12 (extends Test 1): runPipeline now also calls buildDeck(outcome) and deployDeck(html, sha8). On success: the returned outcome includes `deck_url: 'https://mos-brief-...vercel.app'` AND telemetry emits `mva_brief_deployed` event with vercel_subdomain_hash (sha8) and deploy_duration_ms.
    - Test 13: When VERCEL_TOKEN is unset, runPipeline still completes; outcome has `deck_url: 'file:///.../.mindrian/mva/briefs/<sha8>.html'` (file URL of the fallback); telemetry event still emits with the local-fallback marker.
    - Test 14: The deck URL line appears in `outcome.rendered` AFTER the agent summaries but BEFORE the 3-option footer. Render order check: ["Scanning...", 6 agent blocks, "Your Feynman deck: <url>", "What now?\n  [1]..."].
    - Test 15: Hebrew refusal still short-circuits at the top of runPipeline -- deck builder and deployer are NOT invoked when hebrew_refusal:true. Test verifies via mock spy counters.
    - Test 16: A side-file `~/.mindrian/mva/briefs/<sha8>.json` is written containing the structured deck data (for Plan 118-05's option-2 consumption). The .json file has agent results + sha8 + timestamp.
    - Test 17: End-to-end wall-clock: with all 6 agents mocked to return in 50ms each + deck build instantaneous + Vercel mocked to return in 200ms -> total runPipeline wall-clock < 1500ms (proving the architecture meets <45s budget with headroom).

    Run: `node --test lib/core/mva-orchestrator.test.cjs` passes all 17 tests (Tests 1-11 from Plan 118-03 still pass + 6 new ones from this plan).
  </behavior>
  <action>
    Step 1: Update lib/core/mva-orchestrator.cjs runPipeline function. After the agent dispatch loop but BEFORE emitting mva_brief_rendered:

    ```javascript
    // ... (existing code from Plan 118-03 up through the dispatcher loop)

    // After loop: build deck + deploy
    const { buildDeck } = require('./mva-deck-builder.cjs');
    const { deployDeck } = require('./mva-vercel-deploy.cjs');

    const interimOutcome = { results, rendered: blocks.join('\n'), footer_data: { ok: okCount, failed: failedCount, sha256: pending.sentence_sha256 } };
    const sha8 = pending.sentence_sha256.slice(0, 8);

    let deck_url = null;
    let deploy_duration_ms = 0;
    if (okCount > 0) {  // Skip deploy on all-fail (sharp question doesn't need a deck URL)
      try {
        const html = buildDeck(interimOutcome);
        const deployResult = await deployDeck(html, sha8);
        deploy_duration_ms = deployResult.deploy_duration_ms;
        if (deployResult.url) {
          deck_url = deployResult.url;
        } else if (deployResult.fallback_path) {
          deck_url = 'file://' + deployResult.fallback_path;
        }
        telemetry.emit('mva_brief_deployed', {
          sentence_sha256: pending.sentence_sha256,
          vercel_subdomain_hash: sha8,
          deploy_duration_ms,
          status: deployResult.url ? 'ok' : 'fallback'
        });
        // Side-file write for Plan 118-05 option-2 consumption
        const briefsDir = path.join(os.homedir(), '.mindrian', 'mva', 'briefs');
        fs.mkdirSync(briefsDir, { recursive: true });
        fs.writeFileSync(
          path.join(briefsDir, sha8 + '.json'),
          JSON.stringify({ sha256: pending.sentence_sha256, sha8, timestamp: new Date().toISOString(), results }, null, 2)
        );
      } catch (e) {
        // Deploy failures are NOT fatal -- the terminal output already worked.
        telemetry.emit('mva_brief_deployed', {
          sentence_sha256: pending.sentence_sha256,
          vercel_subdomain_hash: sha8,
          deploy_duration_ms,
          status: 'error',
          error_short: String(e.message || e).slice(0, 60)
        });
      }
    }

    // Push URL line BEFORE footer
    if (deck_url) {
      blocks.push('\n  Your Feynman deck: ' + deck_url + '\n');
    }

    // Then the 3-option footer (existing code from Plan 118-03)
    if (okCount === 0) {
      blocks.push(renderer.renderSharpQuestionFallback());
    } else {
      blocks.push(renderer.renderFooter());
    }

    // ... (existing emit mva_brief_rendered + markComplete code)
    ```

    Step 2: Write Tests 12-17. Mock buildDeck + deployDeck via require-cache monkey-patch. Verify all 6 telemetry events fire in correct order.

    Step 3: Add the side-file existence assertion (Test 16): after runPipeline, ~/.mindrian/mva/briefs/<sha8>.json should exist.

    Step 4: Run all 17 tests to confirm Plan 118-03's tests still pass after the orchestrator changes.
  </action>
  <verify>
    <automated>cd /home/jsagi/MindrianOS-Plugin && node --test lib/core/mva-orchestrator.test.cjs lib/core/mva-deck-builder.test.cjs lib/core/mva-vercel-deploy.test.cjs lib/core/resolve-vercel-key.test.cjs</automated>
  </verify>
  <done>
    - All 17 orchestrator tests pass (Plan 118-03's 11 + 6 new).
    - mva_brief_deployed telemetry event emits with sha8 + duration_ms + status (ok/fallback/error).
    - Side-file ~/.mindrian/mva/briefs/<sha8>.json is written for Plan 118-05 consumption.
    - The URL line appears in rendered output between agent blocks and 3-option footer (Test 14).
    - Hebrew refusal short-circuits before any deck/deploy work (Test 15).
    - End-to-end wall-clock with all mocks < 1500ms (Test 17).
    - Deploy failures do NOT fail the pipeline (deck URL is best-effort; the terminal output is the primary reward surface).
  </done>
</task>

</tasks>

<verification>
End-to-end check:
1. All test files pass:
   `node --test lib/core/resolve-vercel-key.test.cjs lib/core/mva-vercel-deploy.test.cjs lib/core/mva-deck-builder.test.cjs lib/core/mva-orchestrator.test.cjs`
2. Em-dash sweep on all new files:
   `grep -E "—" lib/core/mva-deck-builder.cjs lib/core/mva-vercel-deploy.cjs data/mva-deck-template.html` returns 0 matches
3. Canon Part 8 sweep:
   `grep -rE "brain_query|mcp__brain_|MVA_SENTENCE|process\.env\.CLAUDE_USER_PROMPT" lib/core/mva-deck-builder.cjs lib/core/mva-vercel-deploy.cjs lib/core/resolve-vercel-key.cjs data/mva-deck-template.html` returns 0
4. No real-name sweep (per feedback_no_real_names_in_repo.md):
   `grep -E "Lawrence|Gary|Natan|Rea|Aronhime|Reuven|Schler" data/mva-deck-template.html lib/core/mva-deck-builder.cjs` returns 0
5. No <style> blocks in template or builder output: HTML smoke test produces output, then `grep -E "<style[^>]*>" output.html` returns 0
6. Vercel project name is configured: `node -e "console.log(require('./lib/core/resolve-vercel-key.cjs').VERCEL_PROJECT_NAME)"` outputs `mindrianos-briefs`
7. The full runtime path now produces a URL: with mocked Vercel (or local fallback), `node scripts/mva-run.cjs` (after writing a pending state) produces stdout that includes `Your Feynman deck: ` line followed by either an https:// URL or a file:// path
8. (NIT-3) Palette parity test runs in mva-deck-builder.test.cjs; if lib/wiki/wiki-layout.cjs exists, no divergent hex values exist between DECK_PALETTE and the wiki palette; if absent, the test documents the skip rationale.
</verification>

<success_criteria>
- All automated tests pass across 4 test files (Plan 118-03's tests still green after orchestrator extension).
- Vercel deploy is best-effort: failures fall back to local file; never break the pipeline.
- The deck is em-dash-free, no <style> blocks, Mondrian palette, system fonts.
- Zero raw user content in any HTML or any network payload.
- The URL line renders BEFORE the 3-option footer (proper narrative order).
- Hebrew refusal short-circuits before deck/deploy work (no wasted budget on refusal cases).
- Side-file written for Plan 118-05 option-2 consumption.
- Canon Part 8 + Part 10 compliance audited by grep AND tests.
- NIT-3 palette parity test passes (or documents the wiki-layout-absent skip).
</success_criteria>

<output>
After completion, create `.planning/phases/118-30-second-mva-reward-before-investment/118-04-SUMMARY.md` capturing:
- The deck template structure (header + slides + footer)
- The deck builder's slide-rendering logic per agent_id
- The Vercel deploy contract: API endpoint, payload shape, response shape, timeout
- The fallback path: ~/.mindrian/mva/briefs/<sha8>.html
- The side-file path: ~/.mindrian/mva/briefs/<sha8>.json (input for Plan 118-05)
- The mva_brief_deployed telemetry event schema
- OQ resolutions: OQ2 LOCKED (LD2 in 118-CONTEXT.md: Vercel REST API direct), OQ4 (partial -- side-file is the bridge), OQ13 (install-site attribution), OQ14 (GC deferred to v1.14.0), OQ15 (deck shows static 3-option text + copy button)
- Canon Part 8 audit results
- Canon Part 10 sub-claim 3 implementation note: the deck URL is the visible receipt the user can share
- NIT-3 palette parity audit: whether lib/wiki/wiki-layout.cjs was present, and any divergent hex values reconciled (or the documented skip rationale if absent)
- Total tests: 5+6+12+17 = 40 tests across this plan and the orchestrator update; all passing
- Carry-forward to 118-05: the side-file path is where the option-2 invest path reads its data
- Carry-forward to 118-06: the deploy event timing fed into the Dror 2.0 acceptance test (verify total time from sentence to URL < 45s)
</output>
</output>
