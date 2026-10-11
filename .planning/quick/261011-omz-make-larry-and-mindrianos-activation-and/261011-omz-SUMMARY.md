---
phase: quick-261011-omz
plan: "01"
status: complete
subsystem: conversation-identity
tags: [mcp, larry, mindrianos, activation, persona, theo-faces, mcp-apps]
provides:
  - Recurring Larry | MindrianOS conversational identity with honest Claude attribution.
  - Verified MCP initialize and loaded personality delivery within the host byte budget.
  - Canonical Theo Faces identity in all three MCP Apps with verified operational lifecycle.
  - Validated Desktop dev-preview ZIP in Windows Downloads.
tech-stack:
  added: []
  patterns: [existing instruction authorities, existing personality loader, real stdio initialization]
key-files:
  created:
    - lib/mcp/theo-faces.cjs
    - lib/mcp/app-identity.js
    - tests/test-larry-theo-face-apps.cjs
  modified:
    - lib/mcp/runtime-instructions.cjs
    - lib/mcp/no-instructions.test.cjs
    - scripts/session-start
    - agents/larry-extended.md
    - skills/larry-personality/SKILL.md
    - references/personality/voice-dna.md
    - lib/mcp/app-views.cjs
    - lib/mcp/app-html/dashboard.html
    - lib/mcp/app-html/wiki.html
    - lib/mcp/app-html/graph.html
    - scripts/mindrian-mcp-server.cjs
key-decisions:
  - Keep existing five voice colors and exactly one leading glyph; append the literal product label.
  - Integrate the exact Claude disclosure once per conversation without changing persona frontmatter or repeating its question.
  - Extend the existing real initialize regression instead of adding a duplicate source-copy suite or permanently pinned historical Git SHA.
requirements-completed: [QUICK-LARRY-IDENTITY]
requirements-pending: []
duration: completed text, face, browser and packaging stages
text-stage-completed: 2026-10-11
---

# Larry identity and canonical Theo Faces

**Larry conversation instructions and MCP Apps now visibly name MindrianOS, disclose Claude and use the canonical Theo Faces. A validated Desktop dev-preview ZIP is ready in Windows Downloads.**

## Execution

- Started text execution: 2026-10-11T14:48:50Z.
- Finished text checks and local task commits: 2026-10-11T14:53:50Z.
- Tasks 1, 2 and 3 complete, including the user's additional canonical Theo Faces scope, browser verification and Desktop preview packaging.
- Source version remains 2.0.0-beta.66. No version, release, tag, push, host installation or room changes.
- STATE.md, ROADMAP.md, PLAN.md and this SUMMARY.md are not staged or committed by this executor; root owns final metadata.

## Accomplishments

- MCP initialize serves the short label and exact first-reply sentence: "I’m Larry, MindrianOS’s PWS thinking partner, powered by Claude."
- Real served instructions measure 1998 UTF-8 bytes, below the 2000-byte project budget and 2048-byte host ceiling. All six loop steps, Theo attribution and the independent byte-identical BOUNDARIES tail remain.
- The actual MCP personality loader consumes the same identity from voice-dna.md without a new loader or dependency.
- SessionStart stable context, first-install/update no-emoji exceptions, returning-user guidance, the default agent and personality skill agree on one leading glyph and recurring label. Persona composition replaces only the redundant "I'm Larry." clause; stored frontmatter is unchanged byte-for-byte.
- Native host replies, artifacts, JSON, code and protocol envelopes remain outside the conversational branding rule. Branding never replaces real tool work or proves plugin activation.

## Local Task Commits

1. Task 1: `3b918036f` - feat(quick-261011-omz-01): disclose Larry identity through MCP.
2. Task 2: `05a0415ff` - feat(quick-261011-omz-01): align Larry activation and persona identity.
3. Task 3 instruction verification: `bf148b91e` - test(quick-261011-omz-01): verify loaded Larry identity and mark compatibility.
4. Task 3 canonical faces, MCP lifecycle and browser tests: `bd455ce41` - feat(quick-261011-omz): identify Larry with canonical Theo faces in MCP views.
5. Final review: `2c34f25ff` - preserve cancellation during MCP app connection. The real SDK browser test now delivers notifications before the initialize response and verifies cancellation stays visible after connection, with refresh recovery.

No tracked deletions. Starting HEAD `7306bc3f1e3fa92127f03185535f3ec1199811fe` and earlier unrelated commits remain intact. Starting manifest, STATE/ROADMAP and diagnostic report hashes were checked against temporary baselines. `.planning/debug/desktop-marketplace-add-fails-20261011.md` remains untracked and unstaged.

## Verification

| Command | Exit | Evidence |
| --- | --- | --- |
| `node lib/mcp/no-instructions.test.cjs` | 0 | 18 passed: genuine initialize, exact disclosure, loaded personality, five glyph/label combinations, byte budget, moat canaries and frozen boundary tail. |
| `node tests/test-larry-voice-mark-182.cjs` | 0 | 106 passed, 0 failed. |
| `node tests/test-243-voice-glyph-honest.cjs` | 0 | 18 passed, 0 failed. |
| `node tests/test-143.2-doctrine-presence.cjs` | 0 | 16 requirement groups; no em-dashes and existing frontmatter contract intact. |
| `bash tests/test-115-persona-variants.sh` | 0 | 7/7: persona values, default/initialPrompt/source-copy identity and existing selection contract. |
| `bash tests/test-115-surfaces-grep.sh` | 1 | Existing README tagline assertion fails; starting HEAD already lacks the asserted founder sentence. No README edit or assertion weakening. |
| `node tests/test-267.3-session-start-declaration.cjs` | 0 | 7 passed, 0 failed; first-install anchors and free-text routing declarations preserved. |
| `bash -n scripts/session-start` | 0 | Shell syntax valid. |
| Manual full frontmatter comparison to starting HEAD | 0 | Byte-identical original agent YAML, beyond the existing value-level tests. |
| `git diff --check` and baseline hash comparisons | 0 | No whitespace failures, unrelated changes, manifest edits or tracked deletions. |
| `node tests/test-267-mcpv2-app-views.cjs` | 0 | 22 passed: actual tool schemas, input delivery, selected room and read containment. |
| `node tests/test-larry-theo-face-apps.cjs` | 0 | 2 passed: independent canonical geometry and actual MCP initialize/resources/results/CSP. |
| `node tests/test-larry-theo-face-apps.cjs --browser` | 0 | 11 passed: real installed SDK in a sandbox iframe, initial notifications before the initialize response, cancellation persistence and recovery, refresh arguments, structured data and fallback, refusal/malformed data/render/RPC/connection/SDK failure recovery, all 15 canonical poses, desktop/mobile and reduced motion. |
| Canonical Desktop builder and `checkPayload` | 0 | No payload violations; 2032 files and 34012771 uncompressed bytes. |
| Final ZIP validation | 0 | CRC, exact tree contents, executable modes, safe paths, no symlinks, root manifest, version, file/byte limits and all compression ratios pass. |

The initialize test runs with a temporary HOME and rooms home, an unreachable loopback Brain URL, and inherited session/daemon/first flags removed. It does not bind or write a real room. Existing commit hooks emitted advisory HITL declaration conflicts and a Node SQLite experimental warning; commits succeeded. These pre-existing advisory findings were not changed.

## Deviations and Steering

- Root explicitly authorized existing-test coverage instead of a new tests/test-larry-product-identity.cjs suite. Actual initialization, loaded personality and the existing detector provide the meaningful checks. No permanent old-HEAD frontmatter pin was added.
- User added permission to reuse Theo Faces. Root extended Task 3, then the second executor vendored the exact POSES/LARRY/THEO definitions from the canonical gallery, preserving seven Theo states and eight Larry modes. The fixed reframe uses canonical rf2 geometry. No new face art or guessed emotional state was introduced.
- The three registered room views share an inline identity header outside their replaced content: Larry | MindrianOS, Powered by Claude and an accessible operational status. Only actual pending reads use Thinking, successful rendering uses Rest, and errors use It could not. Faces are static, including under reduced motion.
- The touched views previously loaded an ES module as a classic script and constructed App without its required information. The shared lifecycle now dynamically imports the pinned installed 2.0.3 bundle, supplies app information and registers callbacks before connecting. Initial and refreshed results share one consumer; typed structuredContent is preferred with JSON text compatibility. Selected room/section/layout arguments remain on refresh. Resource CSP includes only existing script/font origins.
- Graph/wiki viewport sizing accommodates the new header. Existing render controls remain; graph context updates now use the actual connected controller. No full UI overhaul or new tool was added.
- Server initialize includes the honest product title and a neutral canonical SVG icon. Host rendering of these optional metadata fields is not guaranteed and does not replace Claude's native avatar.
- SUMMARY/STATE/ROADMAP/PLAN staging and state mutations are delegated to root by explicit scope override. This final summary remains unstaged for root metadata ownership.

## Desktop Dev Preview

Path: `/mnt/c/Users/jsagi/Downloads/mindrianos-desktop-larry-identity-dev-20261011.zip`.

- Source version: **2.0.0-beta.66**, unchanged and explicitly an unreleased dev preview.
- Artifact bytes: **11817035**.
- Files: **2032**.
- Uncompressed bytes: **34012821**.
- Maximum per-file compression ratio: **18.00105532941354**, below 50.
- Executable modes preserved: **138 files**.
- SHA256: `c8bb4c7a9712f0581ebf0c86c65036a2df6fbcf06f048e1edee3877b9309d279`.
- The existing npm-pack-based builder was used without version override. ZIP uses DEFLATE level 6 and has `.claude-plugin/plugin.json` at its root, no wrapper folder, no top-level bin or UI-shell dist, no symlinks, safe path segments and byte-identical builder tree contents. CRC and content/mode checks passed.
- The previous beta.65 fallback ZIP remains untouched. Neither the user's installation nor public marketplace was changed.

Final builder output and ZIP report: `/tmp/mindrian-larry-identity-20261011/desktop-payload-final` and `/tmp/mindrian-larry-identity-20261011/preview-zip-report.json`. The preview was rebuilt after the cancellation fix, then rechecked for CRC, exact tree bytes, modes and package limits.

## Browser Evidence

`/tmp/mindrian-larry-identity-20261011/` contains `room-dashboard-900.png`, `room-dashboard-390.png`, `room-wiki-900.png`, `room-wiki-390.png`, `room-graph-900.png`, `room-graph-390.png` and `canonical-reframe.png`. The executor and browser worker inspected the identity, controls and header/content separation. No horizontal overflow or overlapping header was observed.

Canonical provenance: `theo-face/prototype/theo-faces-canonical.html`, revision `553928532c6f0ed3f153fa78b3fb0b436131c314`, SHA256 `78c75c6a697213be390091d315af6e883a54f367651d79b36e18462eb46e2464`. The plugin has no runtime dependency on that checkout. API behavior was checked against the installed SDK and its official App documentation at https://apps.extensions.modelcontextprotocol.io/api/classes/app.App.html.

## Verification Limits

Verified instruction delivery, deterministic mark compatibility and MCP App rendering against a real SDK with a mocked parent host. No live Claude conversation, native Desktop model compliance/rendering, host avatar replacement or completed marketplace installation is claimed. Identity is declared behavior, not a per-token runtime interceptor. No public release or marketplace fix is claimed.
