# 405 GENUI RESEARCH: interactive UI in the Claude and ChatGPT chat hosts

Date of research: 2026-11-27. Search tool: Tavily only. Each page was read with tavily_extract before its content was used.
Source labels: P = primary (specification, vendor documentation, vendor repository, vendor changelog). S = secondary (blog post, case study, GitHub issue comment from a developer).
"No date on page" means the page shows no publication date. The read date is then 2026-11-27.
Scope: one local stdio MCP server that ships three MCP App components (decision card, framework step player, next-move card) under the Feynman rule (one idea per card, plain words, readable alone).

---

## Plain-words summary

1. One standard now covers both hosts. The standard is MCP Apps (SEP-1865, status Stable 2026-01-26). A tool points to a `ui://` HTML page. The host shows the page in a locked iframe. The page and the host talk with JSON-RPC over `postMessage`. Claude supports it. ChatGPT has been "fully compatible with the MCP Apps spec" since 2026-02-22 and tells builders to use the standard first and `window.openai` only for extras.
2. The card is an addition to the text, not a replacement. Every tool must return useful text. A host without UI shows the text. A host with UI shows the card.
3. A local stdio server is a second-class citizen for UI in the Claude chat. The documentation says a local server in `claude_desktop_config.json` can render an MCP App inline in Claude Desktop. A local server from a plugin is ignored in chat. App tools, entry points, embedded sites and `ui.domain` need a remote server. Developers report (May to October 2026) that views from custom and local servers sometimes do not paint in Claude Desktop and claude.ai while the model is told that a widget rendered.
4. The Code tab of the desktop app is the natural home for the plugin's local server. Plugin local servers load in Claude Code. The Anthropic changelog lists "interactive MCP app widgets in the conversation" as a Code tab feature. A developer issue shows widgets rendered in Claude Code 2.1.234 until 2026-08-20.
5. ChatGPT does not connect to a local server directly. It needs a remote HTTPS endpoint or the Secure MCP Tunnel.
6. Both vendors give the same design advice for an inline card: one purpose, at most 2 actions at the bottom, no menus, no nested scroll, no deep navigation, host colors, light and dark, free text goes to the chat box.
7. The biggest known danger is silent failure. The Claude host adds a note to the tool result that says the user can already see the widget and the model must not repeat it. If the iframe did not paint, the user gets neither the card nor the text. A decision must never depend on a card that may not be visible.

---

## 1. What renders where today

### 1.1 Surface matrix

| Surface | Remote connector | Local stdio server | Sources |
|---|---|---|---|
| Claude Desktop chat | Renders MCP Apps (inline, side panel, full screen). | Documented: a server in `claude_desktop_config.json` renders inline after the user allows it. A local server that comes from a plugin is "Ignored" in chat. App tools, entry points, embedded sites and `ui.domain` do not work for a local server. Developer reports of blank frames exist (section 5). | P: https://claude.com/docs/connectors/building/mcp-apps/getting-started.md (no date on page). P: https://claude.com/docs/plugins/platform-support.md (no date on page). P: https://claude.com/docs/connectors/building/mcp-apps/app-tools (no date on page). P: https://claude.com/docs/connectors/building/mcp-apps/troubleshooting (no date on page). |
| claude.ai web | Renders MCP Apps for directory connectors and custom connectors. | Not possible directly. "Claude reaches your server from Anthropic's infrastructure, so a server running on your machine needs a public URL." Use a tunnel. | P: https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude (no date on page). P: https://claude.com/docs/connectors/building/testing.md (no date on page). |
| Claude mobile (iOS, Android) | Renders MCP Apps in a native WebView (`WKWebView` on iOS, `WebView` on Android). Inline cards are full width. Android gives no camera, microphone or location. | No source found for a local server on mobile. | P: https://claude.com/docs/connectors/building/mcp-apps/design-guidelines.md (no date on page). P: support article above. |
| Cowork (desktop) | Renders MCP Apps. A side panel exists in Cowork and Chat. | A plugin local server "Loads when the Cowork session runs on your computer". | P: https://claude.com/docs/plugins/platform-support.md. P: https://claude.com/docs/cowork/changelog (version heading not captured in the extract). |
| Claude Code Desktop tab | Connectors load. | Plugin local servers load. The tab also loads servers from `claude_desktop_config.json`, `~/.claude.json` and `.mcp.json`. The changelog lists "interactive MCP app widgets in the conversation" among "Code tab features already available in the standard app". A developer issue reports that widgets rendered in Claude Code 2.1.234 and then stopped on 2026-08-20; the issue was closed as not planned. | P: https://code.claude.com/docs/en/desktop (no date on page). P: https://claude.com/docs/cowork/changelog. S: https://github.com/anthropics/claude-code/issues/88370 (opened 2026-08-20). |
| Claude Code terminal | No iframe surface. UI resources (`ui://`, `text/html;profile=mcp-app`) are hidden from the `@` list because they are "pages for a host application to render rather than content for Claude to read". Tool text is the only output. | Same. | P: https://code.claude.com/docs/en/mcp (search excerpt, no date). |
| ChatGPT web | Renders UI from remote MCP servers through plugins. "ChatGPT is now fully compatible with the MCP Apps spec" (2026-02-22). | "Can I connect to a local MCP server? Not directly. ChatGPT connects to remote MCP servers." The Secure MCP Tunnel can forward to a stdio server (`--mcp-command`). | P: https://developers.openai.com/plugins/changelog (entry 2026-02-22). P: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt (search excerpt, no date). P: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels (search excerpt, no date). |
| ChatGPT desktop | Plugins with UI "must function reliably in ChatGPT on both desktop and mobile, including any UI components". | The desktop app accepts a STDIO server in Settings, MCP servers (shared Codex host configuration). View rendering from such a server is UNVERIFIED. See section 7. | P: https://developers.openai.com/plugins/plugin-guidelines (no date on page). |
| ChatGPT mobile | Same rule as above. Picture-in-picture "may be presented as fullscreen" on mobile. | Not possible directly. | P: https://developers.openai.com/plugins/reference (no date on page). |

### 1.2 Display modes

- The standard defines three modes: `inline`, `fullscreen`, `pip`. The view declares its modes in `appCapabilities.availableDisplayModes`. The host returns the mode it set. The host is the final judge. P: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx (Stable 2026-01-26).
- Claude offers `inline` and `fullscreen` only. The side panel also reports `fullscreen`. A chat in its own Claude Desktop window offers `inline` only. A `fullscreen` request works only inside a click or key handler, with focus in the view. P: https://claude.com/docs/connectors/building/mcp-apps/display-modes (no date on page).
- Claude side panel: "available to a limited set of organizations, and not in every conversation". It opens at about half the width of the chat area. The minimum width is about 320 px. P: same page.
- An unknown mode value (for example `sidebar`) makes `ui/initialize` fail and the view does not start. P: same page.
- ChatGPT offers inline (card, carousel), fullscreen and picture-in-picture. "Every app initially appears inline." The composer stays visible in fullscreen. P: https://developers.openai.com/plugins/concepts/ui-guidelines (no date on page).

### 1.3 Size limits

| Limit | Value | Source |
|---|---|---|
| Claude inline size | The host reports `width` and `maxHeight` in `containerDimensions`. On mobile "the host also caps inline height and clips content that exceeds it". No number is published. | P: display-modes page; design-guidelines.md |
| Claude layout range | "design responsively from 320px up to fullscreen" | P: design-guidelines.md |
| ChatGPT inline card | Height grows with content "up to the height of the mobile display area". | P: ui-guidelines |
| Claude tool result | About 150,000 characters on claude.ai and Claude Desktop. Above that, with the code sandbox active, the view gets a file pointer and "never hydrates". Claude Code: 25,000 tokens by default (`MAX_MCP_OUTPUT_TOKENS`). | P: troubleshooting page |
| Claude `sendMessage` | 8,000 characters at most. At most 3 consecutive line breaks. At most 64 consecutive spaces or tabs. Text blocks only. | P: https://claude.com/docs/connectors/building/mcp-apps/send-messages (no date on page) |
| Claude view start time | A new view that must replace a full-screen view "must send `ui/notifications/initialized` within 15 seconds". | P: display-modes page |
| Claude app tools | 64 tools per view. 45 seconds to respond. 100,000 characters of result text. (Remote connectors only.) | P: app-tools page |
| Claude touch target | 44 x 44 pt minimum. | P: design-guidelines.md |
| ChatGPT status text | `openai/toolInvocation/invoking` and `invoked`: 64 characters at most. | P: plugins/reference |

### 1.4 CSP and sandbox

- Default policy when the resource declares no `csp`: `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none';`. The host can restrict more. The host must not allow an origin that the server did not declare. P: specification 2026-01-26.
- The server declares origins in `_meta.ui.csp` on the content item of the `resources/read` result: `connectDomains` (fetch, XHR, WebSocket), `resourceDomains` (scripts, styles, images, fonts, media), `frameDomains` (nested iframes), `baseUriDomains`. P: specification; Patterns page https://apps.extensions.modelcontextprotocol.io/api/documents/Patterns.html (no date on page).
- Claude: "All external origins are blocked by default." Claude ignores `baseUriDomains`. `frameDomains` also needs an allow from Claude for the connector. P: design-guidelines.md.
- ChatGPT: "Nested frames are blocked by default." The review checks the declared policy against the behavior of the UI. P: https://developers.openai.com/plugins/build/chatgpt-ui (no date on page).
- A web host must use a double iframe (sandbox proxy on a different origin). The sandbox has `allow-scripts` and `allow-same-origin`. P: specification.
- Claude serves all views of one connector from one origin on `*.claudemcpcontent.com`. The iframe has `allow-same-origin`, so `BroadcastChannel` works between copies of the view. P: https://claude.com/docs/connectors/building/mcp-apps/instance-supersession (no date on page).
- `ui.domain` (a stable origin) "isn't available" for a local stdio server, because it has no URL to hash. P: troubleshooting page.
- If an administrator blocks `claudemcpcontent.com` (key `disableNonessentialServices`), the conversation shows an error in place of the widget. P: https://claude.com/docs/third-party/claude-desktop/extensions (no date on page).
- The sandbox blocks `window.open` and normal link navigation. Use `app.openLink`. Inline event handlers (`onclick="..."`) and `eval` do not run. P: https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/mcp-server-dev/skills/build-mcp-app/references/apps-sdk-messages.md (skill version 0.1.0, no date).
- ChatGPT default sandbox origin: `https://web-sandbox.oaiusercontent.com`. A dedicated `_meta.ui.domain` is required for plugin submission. P: plugins/reference.

### 1.5 Fonts and assets

- Claude sends `@font-face` rules for Anthropic Sans in `hostContext.styles.css.fonts`. The files are on `https://assets.claude.ai`. The view must list that origin in `resourceDomains` or the font does not load. "Prefer bundling third-party fonts into your widget rather than allowlisting public CDNs." P: https://claude.com/docs/connectors/building/mcp-apps/transparent-theming.md (no date on page).
- Claude font tokens: `font-sans` = "Anthropic Sans, sans-serif", `font-mono` = "ui-monospace, monospace". P: design-guidelines.md.
- ChatGPT: "Don't use custom fonts, even in full screen modes. Use system font variables wherever possible." P: ui-guidelines.
- Images: remote images are blocked unless declared. Inline images as `data:` URIs on the server. P: build-mcp-app SKILL.md https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/mcp-server-dev/skills/build-mcp-app/SKILL.md (version 0.1.0, no date).
- Claude app icon: a `data:` PNG or JPEG in `serverInfo.icons`, 64 to 128 px, under 10 KB. Claude removes an inline SVG. The icon needs a Verified listing or a custom connector. P: design-guidelines.md.

### 1.6 Theming

- The host passes `theme` ("light" or "dark") and CSS variables in `hostContext.styles.variables`. Standard keys: `--color-background-*`, `--color-text-*`, `--color-border-*`, `--color-ring-*`, `--font-*`, `--border-radius-*`, `--border-width-regular`, `--shadow-*`. Spacing is not in the set on purpose. P: specification.
- Hosts use the CSS `light-dark()` function. The view must set fallback values for each variable it uses. P: specification.
- Claude: "All views must support both light and dark themes. Use the host's style tokens ... and never hardcode colors." Brand colors are allowed "for accents and identity". P: design-guidelines.md.
- Claude: keep `html, body { background: transparent; }`, add a `color-scheme` meta tag in the head, and set `prefersBorder` explicitly (default: borderless on web, bordered on mobile). P: transparent-theming.md; design-guidelines.md.
- SDK helpers: `applyDocumentTheme`, `applyHostStyleVariables`, `applyHostFonts`, `useHostStyles`. Register the `hostcontextchanged` listener before `connect()`. P: transparent-theming.md.
- ChatGPT provides the same standard variables since 2026-05-28. P: plugins/changelog (entry 2026-05-28).

---

## 2. Protocol facts a builder needs

All items are P from the specification 2026-01-26 unless a different source is named.

| Topic | Fact |
|---|---|
| Extension id | `io.modelcontextprotocol/ui`. The client advertises it in `initialize` under `capabilities.extensions` with `mimeTypes: ["text/html;profile=mcp-app"]`. |
| Server capability | Developer report: `registerAppTool` and `registerAppResource` do not declare the server-side extension capability. The developer had to declare `capabilities.extensions["io.modelcontextprotocol/ui"]` himself before Claude counted the tools as interactive. S: https://github.com/anthropics/claude-ai-mcp/issues/165 (comment, 2026). |
| UI resource | URI must start with `ui://`. `mimeType` must be `text/html;profile=mcp-app`. Content is a valid HTML5 document in `text` or `blob`. |
| Link tool to UI | `_meta.ui.resourceUri` on the tool. The flat key `_meta["ui/resourceUri"]` is deprecated. The host reads the resource with `resources/read` and may prefetch and cache it. |
| Handshake | View sends `ui/initialize` (with `appCapabilities`). Host answers with `hostContext` and `hostCapabilities`. View sends `ui/notifications/initialized`. The host must not send anything to the view before that. |
| Tool input | `ui/notifications/tool-input` (complete arguments, once). `ui/notifications/tool-input-partial` (zero or more, best-effort "healed" JSON, not for critical operations). |
| Tool result | `ui/notifications/tool-result` with the standard `CallToolResult` (`content`, `structuredContent`, `_meta`). `ui/notifications/tool-cancelled` if the call stops. |
| View calls server | `tools/call` through the host (SDK: `app.callServerTool`). The host may block or ask for approval. In Claude, "When your view calls your own server's tools with `app.callServerTool`, the user doesn't see the prompt." P: app-tools page. |
| App-only tools | `_meta.ui.visibility: ["app"]`. The host must not show the tool to the model. Default visibility is `["model","app"]`. |
| Message to chat | `ui/message` (SDK: `app.sendMessage`), role `user`. "Host MAY request user consent." Claude asks the user to allow it or puts the text in the message box. A result with no error does not prove that the user agreed. P: send-messages page. |
| Silent context | `ui/update-model-context` (SDK: `app.updateModelContext`). Each call overwrites the last. The host may hold it until the next user message. |
| Other requests | `ui/open-link`, `ui/request-display-mode`, `notifications/message` (log), `resources/read`, `ping`. |
| Size | View sends `ui/notifications/size-changed`. The SDK does it with `autoResize` (default on). |
| Teardown | Host sends `ui/resource-teardown` before it removes the view. |
| What the model sees (standard) | `content`: "Text representation for model context and text-only hosts". `structuredContent`: "optimized for UI rendering (not added to model context)". `_meta`: "not intended for model context". |
| What the model sees (Claude) | Claude reads the `text` blocks. It reads `structuredContent` "only when it receives no text at all from `content`". P: app-tools page (stated for app tools). Developer note: "Hosts strip `_meta` before the model ever sees it." S: https://github.com/modelcontextprotocol/ext-apps/issues/671 (comment 2026-09-18). |
| What the model sees (ChatGPT) | `structuredContent` and `content` are "Surfaced to the model and the component". `_meta` is "Delivered only to the component. Hidden from the model." P: plugins/reference. |
| Model does not see the view | The model does not see pixels, clicks or local UI state. The view must report with `updateModelContext` or `sendMessage`. The host adds a note that a widget rendered whether or not it painted. S: issue 165. |
| State persistence | Not in the MVP ("State persistence and restoration" is listed as future work). Claude: "When your app loads again, it starts from your HTML, so store on your server anything that you need to keep." P: design-guidelines.md. SDK pattern: server returns a `viewUUID` in `_meta`; the view uses it as a `localStorage` key; effort-heavy state goes to the server through app-only tools. P: Patterns page. |
| Instances | Each tool call mounts a new iframe. Old instances stay live. No host API removes them. P: instance-supersession page. |
| Capability check | "Servers SHOULD check client capabilities before registering UI-enabled tools" (`getUiCapability`). "Tools MUST return meaningful content array even when UI is available." |
| SDK versions | Latest release v2.1.0 ("10 Nov" on the releases page). v2.0.2 on 25 Sep. v1.7.5 on 23 Jul. "The wire protocol is unchanged between `ext-apps` 1.x and 2.x." 2.x needs Node.js 20+ and MCP SDK `^2.0.0` peers. `app.registerTool` needs 1.7.0 or later. P: https://github.com/modelcontextprotocol/ext-apps/releases; https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/README.md. |

---

## 3. Claude MCP Apps host versus ChatGPT Apps SDK host

| Topic | Claude | ChatGPT | Source |
|---|---|---|---|
| Bridge | MCP Apps JSON-RPC over `postMessage`. | Same bridge. `window.openai` stays for "compatibility aliases and optional ChatGPT extensions". The reference page calls `window.openai` the "legacy" API. | P: plugins/reference; plugins/build/chatgpt-ui |
| Link key | `_meta.ui.resourceUri` | Same. `_meta["openai/outputTemplate"]` is an alias. | P: chatgpt-ui |
| Tool input | `ui/notifications/tool-input` | Same. `window.openai.toolInput` is an alias and can be `null` until the user approves an approval-gated tool. | P: plugins/reference; changelog 2026-05-27 |
| Tool result | `ui/notifications/tool-result` | Same. Alias `window.openai.toolOutput`. | P: chatgpt-ui |
| Tool call from view | `tools/call` | Same. Alias `window.openai.callTool`. | P: chatgpt-ui |
| Follow-up message | `ui/message`, user must agree | `ui/message`. Alias `sendFollowUpMessage`. | P: chatgpt-ui; send-messages |
| Visibility | `_meta.ui.visibility` | Same. `openai/visibility` deprecated 2026-07-21. `openai/widgetAccessible` is a compatibility field. | P: plugins/changelog; plugins/reference |
| Widget state | No host store. Use the server or `localStorage` with a server key. | `window.openai.widgetState` and `setWidgetState` (per rendered instance; not durable; not in the standard). | P: Migrate_OpenAI_App https://apps.extensions.modelcontextprotocol.io/api/documents/Migrate_OpenAI_App.html; chatgpt-ui |
| Display modes | inline, fullscreen (side panel reports fullscreen) | inline, fullscreen, pip | P: display-modes; ui-guidelines |
| Extras | Side panel, app tools (model calls tools in the view), entry points, downloads, `preferredDisplayMode`. Most need a remote connector. | `requestModal`, `requestCheckout`, file helpers, `requestClose`, `setOpenInAppUrl`, `openai/widgetDescription`. | P: getting-started.md; plugins/reference |
| `ui.domain` format | First 32 hex characters of SHA-256 of the connector URL + `.claudemcpcontent.com` | Own origin, unique per plugin | P: getting-started.md; plugins/reference |
| Local server | `claude_desktop_config.json` in Desktop; plugin local server only in Cowork (local session) and Claude Code | Remote only, or Secure MCP Tunnel | P: platform-support.md; OpenAI help article |

One view for both hosts (all P):
1. Register with `registerAppTool()` and `registerAppResource()`, "which generate each host's metadata for you". Call `App.connect()` without a transport argument. Source: getting-started.md.
2. Use the standard column of the OpenAI mapping table for all data flow. Source: chatgpt-ui.
3. "Feature-detect each extension ... Avoid branching on a host or product name. Test for the capability your UI needs." Source: chatgpt-ui.
4. Do not depend on `widgetState`. Keep the truth on the server. Source: Migrate_OpenAI_App; chatgpt-ui ("Avoid `localStorage` for core state").
5. Check `hostContext.availableDisplayModes` before a mode request. Source: display-modes; Migrate_OpenAI_App.
6. Set `ui.domain` per host or not at all. For a local server leave it out. Source: troubleshooting.

---

## 4. Best practices

### 4a. UX

| Practice | Source |
|---|---|
| Add UI only when it beats text: structured input the model cannot infer, a pick from a list, a destructive or billable confirmation, a visual output, a long job to watch. "If none apply, skip the widget." | P: build-mcp-app SKILL.md |
| Check elicitation first. "Confirm yes/no", "Pick from short enum" and a flat form are marked "overkill" for a widget. Use a widget for a visual preview, a large list, or live progress. | P: build-mcp-app SKILL.md |
| "Custom UI is optional. Add it when a plugin use case requires people to inspect, compare, edit, confirm, or navigate structured information." "Choose the smallest presentation." | P: chatgpt-ui |
| Inline card limits (Claude): height fits content, no nested scroll, "At most 2 actions, placed at the bottom of the card", "At most 4-5 data points", no drill-ins, no menus or popovers. | P: design-guidelines.md |
| Inline card limits (ChatGPT): "A single action or decision", one primary and one optional secondary action, "No deep navigation or multiple views within a card", "No nested scrolling", "No duplicate inputs". | P: ui-guidelines |
| Do not build "Chat inputs or conversational UI that replicate Claude's own features". Free text, follow-up questions and "requests to modify, refine, or redo" go to the chat input. Confirming a prepared action ("Mark complete", "Send", "Save") stays in the app. | P: design-guidelines.md |
| "Reveal complexity only when users need it. The inline card might show a summary, and fullscreen mode can offer the detailed view." | P: design-guidelines.md |
| Prefer visible controls (segmented buttons, toggle chips, inline tabs) over menus and dropdowns. | P: design-guidelines.md |
| Hand back to the conversation: `sendMessage` for a terminal user action; `updateModelContext` for silent state. "Reserve `sendMessage` for terminal actions." Send only on a click or key press, never on load or on a timer. | P: widget-templates.md https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/mcp-server-dev/skills/build-mcp-app/references/widget-templates.md; send-messages |
| The model answer after the card must not repeat the card ("Avoid content that is redundant with the card"). | P: ui-guidelines |
| Put the model's reasoning in the payload: a short `note` field per item, shown as a callout. Name the field in the tool description. | P: build-mcp-app SKILL.md |
| Loading: skeleton that matches the final layout. "Avoid spinners for inline content." Use partial tool input for a preview. Clear the skeleton on `tool-cancelled`. | P: design-guidelines.md; Patterns page; apps-sdk-messages.md |
| Errors: the server returns `isError: true` with content for the model. The view reports a runtime failure with `updateModelContext`. Keep the control usable so the user can try again. | P: Patterns page; send-messages |
| Empty, error, pending, done and failed states must each be designed and tested. | S: https://sunpeak.ai/blogs/mcp-app-examples (October 2026) |
| Accessibility: WCAG AA contrast, keyboard navigation, text alternatives, test with assistive technology (Claude). Alt text for all images, text resize without layout break (ChatGPT). | P: design-guidelines.md; ui-guidelines |
| Typography: three sizes (heading, body, caption) and two weights. Icons are monochrome outlines and support the text. | P: design-guidelines.md |
| Do not put the product logo in the card. ChatGPT adds the logo and name before the widget. | P: ui-guidelines |
| Language first: let the user say the filter in words; give the model a list of allowed values in the tool schema. | S: https://developers.openai.com/blog/15-lessons-building-chatgpt-apps (Alpic author, no date found on page) |

### 4b. Data and security

| Practice | Source |
|---|---|
| "Decide explicitly who needs to know what." Model text in `content`. UI data in `structuredContent`. UI-only data in `_meta`. | S: 15 lessons; P: specification; plugins/reference |
| In ChatGPT the model reads `structuredContent` "verbatim". Keep it short. Do not put a hidden value there. | P: plugins/reference |
| Treat `structuredContent` in the view as "untrusted input". | P: chatgpt-ui |
| Writes go through a server tool. The server validates and returns the authoritative snapshot. "Never trust totals calculated only in the component." | P: chatgpt-ui |
| Approve and reject buttons call app-only tools, "because those actions belong to the UI after the user has inspected the request". Most create flows "should require an explicit user action in the UI". | S: sunpeak blog |
| Human in the loop: the host may require approval for tool calls from the UI ("User consent"). ChatGPT users choose when apps ask (always, before changes, before important changes) since 2026-06-12. Tool annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) must be correct; they only change how the host frames the call, "servers must still enforce their own authorization logic". | P: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps (2026-01-26); plugins/changelog; plugins/reference |
| Keep each tool definition constant. A change to name, title, description or schema can reset the user's "Always allow". Put changing values in the result. | P: app-tools page |
| Prompt-injection limits on messages from the view: Claude shows a caution, limits length and invisible characters, refuses fast repeats, and refuses for a short time after a decline. | P: send-messages |
| The threat model lists phishing and social engineering by a view. The mitigations are the sandbox, auditable JSON-RPC, pre-declared templates and CSP. | P: specification |
| CSP: declare nothing unless needed. `resourceDomains` also widens `script-src` and `style-src`, "so keep it to origins you trust to serve executable code". | P: transparent-theming.md |
| Data minimization: "Gather only the minimum data required." The server must not rebuild the chat log. | P: plugin-guidelines |
| Network calls from the view go through `callServerTool`, not `fetch`. | P: apps-sdk-messages.md |

### 4c. Engineering

| Practice | Source |
|---|---|
| Ship one self-contained HTML file. Inline the SDK bundle (`@modelcontextprotocol/ext-apps/app-with-deps`). "Do not `import { App } from "https://esm.sh/..."`; the iframe's CSP blocks the transitive dependency fetches and the widget renders blank." | P: build-mcp-app SKILL.md |
| The Claude quickstart loads the SDK from `unpkg.com` with a `resourceDomains` entry, and then says: "For production, serve the client script from your own origin, or bundle it into the HTML." | P: https://claude.com/docs/connectors/building/mcp-apps/quickstart.md (no date on page) |
| Framework: any or none. The `App` class is "a convenience wrapper, not a requirement". Anthropic templates are "intentionally framework-free; widgets are small enough that React/Vue hydration cost usually isn't worth it". | P: https://modelcontextprotocol.io/extensions/apps/overview (no date on page); widget-templates.md |
| Use `addEventListener`. No inline handlers. No `eval`. Inline CSS in a `<style>` tag. | P: apps-sdk-messages.md |
| Set handlers before `await app.connect()`. Always call `connect()`. Keep a non-zero height. Use `autoResize`. | P: apps-sdk-messages.md; troubleshooting |
| One widget per tool. "Tool description must mention the widget." Return a text summary with a display widget so the model can go on. | P: build-mcp-app SKILL.md |
| Separate data tools from render tools. "Only the render tool should include `_meta.ui.resourceUri`." The widget then renders once with final data. | P: chatgpt-ui |
| Front-load data in the first tool result; a tool call from the view costs seconds. | S: 15 lessons |
| Budget the payload: cap at about 130 KB; prune columns, then rows; send heavy assets through an app-only tool. | P: payload-budgeting.md https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/mcp-server-dev/skills/build-mcp-app/references/payload-budgeting.md |
| Streaming partial input: use it only for preview UI. | P: specification; Patterns page |
| Version the `ui://` URI. "Treat the resource URI as a cache key." Publish a new URI on a breaking change. | P: chatgpt-ui |
| Put a content hash in the URI and keep the old URI served as an alias; hosts keep cached tool declarations. | S: ext-apps issue 671 (comment 2026-09-18) |
| Claude Desktop caches UI resources. Fully quit and relaunch after an HTML change. | P: build-mcp-app SKILL.md |
| Fallback text: test in a host without the Apps surface that the text result is enough. | P: build-mcp-app SKILL.md; specification |
| Test ladder: (1) a plain browser page with a fake `ExtApps` shim; (2) `basic-host` from the ext-apps repository; (3) MCP Inspector for the protocol; (4) the real host. | P: build-mcp-app SKILL.md; https://apps.extensions.modelcontextprotocol.io/api/documents/Testing_MCP_Apps.html (no date on page) |
| An inspector that renders the UI saves deploy cycles. Asana engineers: MCP Inspector "didn't have the ability to render UI"; with a UI inspector they could test "tool calls with predictable inputs and getting the UI as output" and check mobile layout. | S: https://www.mcpjam.com/blog/asana-mcpjam (no date on page) |
| Debug in the iframe's own console. "CSP violations are the #1 reason widgets silently fail." In Claude Desktop: Help, Troubleshooting, Enable Developer Mode; the app is the inner iframe. | P: build-mcp-app SKILL.md; troubleshooting |
| Pause timers and animation when the view is off screen (`IntersectionObserver`). Stop polling in `onteardown`. | P: Patterns page |
| Pin the package version of a local `npx` server entry. | P: getting-started.md |

### 4d. Step flows and decision or approval cards

| Practice | Source |
|---|---|
| Claude lists "Multi-step workflows" as a fit for MCP Apps in general, but lists as patterns to avoid: "Complex multi-step workflows that exceed the display mode's scope" and "Deep navigation such as drill-ins, breadcrumbs, or multiple views". The inline card has "No drill-ins, breadcrumbs, or multiple views". | P: overview page; design-guidelines.md |
| ChatGPT: a card with tabs or drill-ins must be split "into separate cards or tool actions". Fullscreen is the place for "multi-step workflows or deeper exploration". | P: ui-guidelines |
| Full screen has "No floating panels, so use collapsible sidebars, tabs, or pagination to disclose details". The composer is always visible. | P: design-guidelines.md |
| Guided creation flow: three states in the resource (draft, preview or validation, submitted result). The model prepares the draft. The user finishes in the UI. The submit tool is app-only. Prevent double submit. | S: sunpeak blog |
| Approval card: show who, what, why, risk and source. Disable buttons while a write is in flight. Show a final approved, rejected or failed state. Call `updateModelContext` after the decision. A failed approval leaves a retryable state. | S: sunpeak blog |
| Confirm dialog template exists. Anthropic adds: "For simple confirmation, prefer elicitation over a widget ... Use this widget when you need custom styling or context beyond what a native form offers." | P: widget-templates.md |
| A click on an old card can act after a newer card exists. Make old instances inert: a server-minted key `{createdAt, seq}` in `structuredContent`, a `BroadcastChannel`, grey out, disable buttons, block `updateModelContext` and `sendMessage`. The key must come from the server because Claude lazy-mounts cells on scroll. | P: instance-supersession page |
| State that the model needs for the next turn (selected option, current step) goes to `updateModelContext`. Each call overwrites the last, so send the full current state. | P: specification; Patterns page |
| Intent pattern from MCP-UI: components "don't directly modify state"; they send intents and the agent stays in control. | S: https://shopify.engineering/mcp-ui-breaking-the-text-wall (2025) |
| For long work behind a step: start the work, return at once, and let a second tool report the outcome. Show progress with `notifications/progress`. | P: app-tools page; apps-sdk-messages.md |
| Generative UI spectrum: controlled (fixed components), declarative (A2UI, Open-JSON-UI), open-ended (MCP Apps). A fixed card that a tool fills with data is the high-control end. | S: https://github.com/CopilotKit/generative-ui (no date on page) |

---

## 5. Known failures and anti-patterns

| Failure | Detail | Source and date |
|---|---|---|
| View never paints in Claude Desktop or claude.ai, model says it rendered | Tool call succeeds. Host reads the `ui://` resource. An empty frame or nothing appears. Reports cover stdio and HTTP, custom connectors, MCPB extensions, iOS. Versions named: Desktop 1.10628.2, 1.12603.1 (2026-06-11), 1.26832.0. One controlled test: 6 of 10 renders blank in one window, 0 of 18 in a later window. | S: https://github.com/anthropics/claude-ai-mcp/issues/165 (comments dated 2026-06-04, 2026-06-13 and later). S: https://github.com/modelcontextprotocol/ext-apps/issues/671 (opened 2026-05-27, open, last comment 2026-10-06) |
| Silent success | The host adds: "[This tool call rendered an interactive widget in the chat. The user can already see the result - do not repeat it in text or with another visualization tool.]" The note is added even when the iframe did not mount. "the user therefore loses both the widget and the text answer". | S: issue 165; issue 671 (comment 2026-09-02) |
| Missing server capability | The server did not declare `capabilities.extensions["io.modelcontextprotocol/ui"]`. The SDK helpers did not do it. | S: issue 165; issue 671 (comment 2026-09-18) |
| Cached tool list | `tools/list` is cached per connector session. A fix looks like "a no-op" until the connector is removed and added again. The connector settings page shows a count of interactive tools; use it as a check. | S: issue 165 |
| Stale `ui://` URI | After a rebuild the old URI is gone; Claude still asks for it and shows "Unable to reach". Same message as a wrong `ui.domain`. | S: issue 165; issue 671 (2026-09-18) |
| Wrong `ui.domain` | A wrong value blocks mounting. Leaving it out does not. | P: troubleshooting. S: issue 165 |
| CDN import kills the script | `esm.sh` build of the SDK threw at module load; `connect()` never ran; the iframe stayed hidden. | S: issue 671 (commit note 2026-09-17). P: build-mcp-app SKILL.md |
| Handshake deadlock | The view waited for a certain `ui/initialize` reply shape before it sent `initialized`. "The host holds the iframe hidden until that notification lands." | S: issue 671 (2026-09-18) |
| Missing `connect()` or zero height | "the most common issue" for an invisible app. | P: troubleshooting |
| Result too large | Above about 150,000 characters the view gets a file pointer and a JSON parse error. Works in MCP Inspector, breaks in Desktop. | P: troubleshooting; payload-budgeting.md |
| Framework drops `_meta.ui` on the result | FastMCP `AppConfig` put `resourceUri` on the tool definition only. | S: issue 671 (2026-09-02) |
| `serverInfo.websiteUrl` | One team saw rendering fail with it and work without it. Small sample. | S: issue 671 (2026-10-06) |
| Claude Code widgets stopped | After a staged rollout of `server/discover` version negotiation, widgets from one server stopped in Claude Code 2.1.234. Closed as not planned. | S: https://github.com/anthropics/claude-code/issues/88370 (2026-08-20) |
| Old instances act | Several live copies each push context and messages. | P: instance-supersession page |
| Render tool on every call | "If you attach a widget template to every tool call, ChatGPT can re-render your iframe too often." | P: chatgpt-ui |
| Web habits | Lazy loading, UI-driven state and "share everything everywhere" harmed agentic apps. CSP surprises: "it works locally but breaks in production". | S: 15 lessons |
| Menus and popovers | They "get clipped by container boundaries or create z-index conflicts with the host UI". | P: design-guidelines.md |
| Referer checks on iOS | WebKit omits `Referer`; allowlist on `Origin`. | P: troubleshooting |
| Invisible first-message tools | App tools of the first view reach Claude only with the next user message. | P: app-tools page |

---

## 6. Open-source MCP Apps to read as models

| Repository | What it shows |
|---|---|
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-server-vanillajs | Smallest complete app without a framework. Host context, theme and fonts. |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-server-react | Same app with React hooks (`useApp`, `useHostStyles`). |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/budget-allocator-server | Business form with direct manipulation. |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/scenario-modeler-server | Business model with inputs and results in one view. |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/system-monitor-server | App-only tools and polling. |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/pdf-server | Chunked data through app-only tools, view state with `viewUUID`, fullscreen toggle. |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/transcript-server | `updateModelContext` plus `sendMessage` hand-back. |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/map-server | CSP declaration, context to the model, fullscreen. |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-host | Reference host for local tests. |
| https://github.com/modelcontextprotocol/ext-apps/tree/main/plugins/mcp-apps | Agent skills: create-mcp-app, add-app-to-server, convert-web-app, migrate-oai-app. |
| https://github.com/anthropics/claude-plugins-official/tree/main/plugins/mcp-server-dev/skills/build-mcp-app | Anthropic skill with HTML scaffolds for picker, confirm dialog, progress, display and carousel; sandbox and payload notes. |
| https://github.com/openai/openai-apps-sdk-examples | OpenAI "Pizzaz" examples: list, carousel, map, album, video. (Linked from the OpenAI page; the repository itself was not read.) |
| https://github.com/alpic-ai/skybridge | React framework with a local host emulator, hot reload and the `data-llm` attribute. (Linked from the OpenAI blog; the repository itself was not read.) |
| https://github.com/MCP-UI-Org/mcp-ui | Client and server SDK that implements MCP Apps; `AppRenderer` for hosts. (Docs page https://mcpui.dev/guide/introduction was read.) |
| https://github.com/CopilotKit/generative-ui | Side-by-side examples of controlled, declarative and open-ended generative UI. |

---

## 7. Same chat package in ChatGPT (owner hypothesis)

Hypothesis: the MindrianOS chat package for Claude Desktop (one local stdio MCP server plus three MCP App views) can also run in the ChatGPT desktop chat.

### 7a. Local stdio server or remote only

| Surface | Fact | Source |
|---|---|---|
| ChatGPT web | "Can I connect to a local MCP server? Not directly. ChatGPT connects to remote MCP servers." Connection is a public HTTPS MCP endpoint or a Secure MCP Tunnel. | P: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt (no date on page) |
| ChatGPT mobile | "Can I connect custom MCP servers on mobile? No - web only." (This is about adding a server. Published plugin UI must still work on mobile.) | P: same help article; P: https://developers.openai.com/plugins/plugin-guidelines |
| ChatGPT desktop app | The desktop app has "Settings, then select MCP servers ... Add server ... choose STDIO or Streamable HTTP". It shares MCP configuration with the Codex CLI and IDE extension "for the same Codex host". "ChatGPT web doesn't read local Codex configuration files." A plugin can be marked "Desktop only". | P: https://developers.openai.com/codex/mcp (no date on page; read with a query filter, not in full) |
| Secure MCP Tunnel | A small client runs next to the private server, opens an outbound HTTPS path, and forwards to a stdio command (`--mcp-command`) or an HTTP URL. The client must stay running. It "does not support public plugin submission or distribution". | P: https://developers.openai.com/api/docs/guides/secure-mcp-tunnels (search excerpt, no date) |
| Public listing | Needs "a stable, publicly reachable HTTPS endpoint" with streamable HTTP. A tunnel or local endpoint is not accepted. | P: https://developers.openai.com/plugins/build/mcp-server (search excerpt, no date) |

What a local-data product needs for ChatGPT:
1. Web and mobile chat: a remote endpoint. Either a hosted server (then room data leaves the computer, which conflicts with the local-room design) or a Secure MCP Tunnel per user (the room stays local, but each tool call travels through OpenAI's tunnel service, and the user must run `tunnel-client` with a `tunnel_id` and an API key).
2. Desktop app: a stdio entry in Settings, MCP servers. No tunnel. This is the only path that matches the Claude Desktop shape.

Plans and regions:
- "Custom MCP server connections and full MCP support are available for ChatGPT Business and Enterprise/Edu customers on ChatGPT web." Business: only admins and owners create and publish. Enterprise/Edu: RBAC permission "Create plugins with MCPs". P: help article.
- "Pro users can build apps using the Apps SDK. Full MCP is only available to Business and Enterprise/Edu users, currently. Pro users can connect custom MCP servers with read/fetch permissions." P: help article.
- "Are there geo restrictions? No." P: help article.
- "You don't need to turn on Developer Mode first." The user must accept a risk warning for each server. P: help article.
- Plus and Free plans for custom servers: no source found.
- Plan rules for stdio servers in the desktop app: no source found.

### 7b. MCP Apps features in the ChatGPT host

| Feature | Status in ChatGPT | Source |
|---|---|---|
| Standard as a whole | "ChatGPT is now fully compatible with the MCP Apps spec." | P: plugins/changelog (2026-02-22) |
| `ui://` resource with `text/html;profile=mcp-app` | Supported. | P: https://developers.openai.com/plugins/build/chatgpt-ui |
| `_meta.ui.resourceUri` | Supported and preferred. | P: chatgpt-ui; plugins/reference |
| `_meta.ui.visibility` | Supported. Old `openai/visibility` deprecated 2026-07-21. | P: plugins/changelog; plugins/reference |
| `_meta.ui.csp`, `prefersBorder`, `domain` | Supported. `domain` is required for submission. | P: plugins/reference |
| `ui/initialize`, `tool-input`, `tool-result` | Supported. Approval-gated input arrives through `tool-input` after approval (2026-05-27). | P: plugins/changelog |
| `tools/call` from the view | Supported. | P: chatgpt-ui |
| `ui/message` | Supported. | P: chatgpt-ui |
| `ui/update-model-context` | Named as "the portable MCP Apps mechanism for updating model-visible context". | P: chatgpt-ui |
| Host style variables and theme change | Supported since 2026-05-28. | P: plugins/changelog |
| Display modes | inline, fullscreen, pip. Declare them at initialization. Optional pre-load hint `_meta["openai/ui"].availableDisplayModes`. | P: plugins/reference; ui-guidelines |
| Still `window.openai` only | Widget state (`widgetState`, `setWidgetState`), modal (`requestModal`), checkout (`requestCheckout`), file helpers, `requestClose`, `setOpenInAppUrl`, `openExternal` redirect targets (`openai/widgetCSP.redirect_domains`), status text (`openai/toolInvocation/*`), `openai/widgetDescription`. | P: plugins/reference; chatgpt-ui |

None of the three MindrianOS views needs a `window.openai`-only feature.

### 7c. How instructions reach the model in ChatGPT

- Server instructions: "ChatGPT now reads MCP server instructions returned during initialization and uses them alongside tool metadata to understand cross-tool workflows, constraints, and server-wide guidance." P: plugins/changelog (2026-05-26).
- Tool descriptions, schemas and annotations are read from the server. For a workspace, the tool list is a "frozen" snapshot until an admin refreshes it. P: help article.
- Skills: a ChatGPT plugin can combine "skills, MCP servers, and optional interfaces". The MCP client matrix marks ChatGPT as "Partial" for the Skills over MCP extension and links to "import skills from the MCP server". P: https://developers.openai.com/plugins (search excerpt); P: https://modelcontextprotocol.io/extensions/client-matrix (no date on page).
- View description for the model: `_meta["openai/widgetDescription"]` on the resource. P: plugins/reference.
- The user selects the plugin with `@` for a message; selection "applies to the message where you use it, not the entire conversation". P: help article.
- MCP prompts (`prompts/list`) in ChatGPT: no source found.
- A persona line in server instructions is guidance, not a system prompt. No source says how strongly ChatGPT follows it.

### 7d. Human confirmation for write tools

| Topic | ChatGPT | Claude | Source |
|---|---|---|---|
| Who asks | The host. "ChatGPT asks for confirmation based on app permissions and the action's context." "Some especially risky actions may be blocked instead of being presented for approval." | The host. Claude asks the user to allow a tool unless a saved choice ("Always allow") or the permission setting (Manual, Auto) covers it. | P: help article. P: getting-started.md; app-tools page |
| User setting | Always ask, before making changes, or only before important changes; per app and global; admins set workspace defaults. | Per tool saved choice; conversation permission setting. | P: plugins/changelog (2026-06-12). P: app-tools page |
| Input to the decision | Tool annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) "help ChatGPT and Codex choose appropriate confirmation and safety behavior. They do not replace authorization, validation, or confirmation in your server." | Prompt names the connector and the tool `title`. | P: https://developers.openai.com/plugins/build/mcp-server. P: app-tools page |
| View input before approval | `toolInput` can be `null` until the user approves. | Not stated. | P: plugins/reference |
| Tool call from the view | No source found for a host prompt on `tools/call` from the view. | No prompt for `app.callServerTool` to the view's own server. | P: app-tools page |
| Deep research | Custom apps: read and fetch only, no write. | Not applicable. | P: help article |

Effect on the decision card: the host confirm dialog and the card are two different gates. A model-visible write tool would show the ChatGPT dialog and then the card, which is a double prompt. Keep the write tool app-only and mark the card-opening tool `readOnlyHint: true`, so the host does not ask and the card click is the one approval. The server check (gate id, option id, single use) stays the real control on both hosts.

### 7e. Same package on both hosts

| Part of the package | Verdict | Reason | Source |
|---|---|---|---|
| The three view HTML files (standard bridge only) | Works | ChatGPT is fully compatible with the MCP Apps spec. | P: plugins/changelog 2026-02-22 |
| `_meta.ui.resourceUri`, `visibility`, `csp`, `prefersBorder` | Works | Same keys on both hosts. | P: plugins/reference |
| App-only tool for the decision click | Works | `tools/call` from the view and `_meta.ui.visibility` are supported. | P: chatgpt-ui; plugins/reference |
| `updateModelContext` and `sendMessage` hand-back | Works | Both are in the ChatGPT mapping. Consent behavior of `ui/message` in ChatGPT is not documented. | P: chatgpt-ui |
| Text fallback in `content` | Works | Required by both. | P: specification; chatgpt-ui |
| Host theme tokens with fallbacks | Works | ChatGPT sends the standard variables since 2026-05-28. | P: plugins/changelog |
| Fonts | Needs a change | ChatGPT: no custom fonts; use the system stack. A bundled brand font is against the guideline. | P: ui-guidelines |
| Inline card limits (2 actions, no nested scroll) | Works | Same rule on both hosts. | P: ui-guidelines; design-guidelines.md |
| Step player in a larger view | Needs a change | Claude: fullscreen or side panel. ChatGPT: fullscreen or pip. Read `availableDisplayModes`; do not assume. | P: display-modes; plugins/reference |
| `structuredContent` | Needs a change | ChatGPT gives it to the model verbatim; Claude reads text first. Keep it short and without hidden values; declare `outputSchema`. | P: plugins/reference; app-tools page |
| Tool annotations | Needs a change | ChatGPT requires explicit `readOnlyHint`, `destructiveHint`, `openWorldHint` on each tool. | P: plugin-guidelines |
| Server instructions (Larry identity, loop) | Works, with unknown strength | ChatGPT reads server instructions since 2026-05-26. | P: plugins/changelog |
| Hooks, slash commands, agents | Not possible | These are Claude Code plugin parts. ChatGPT plugins have their own skill format. | P: platform-support.md; https://developers.openai.com/plugins (search excerpt) |
| Local stdio transport, ChatGPT web and mobile | Not possible | Remote only. A tunnel or a hosted server is needed. | P: help article |
| Local stdio transport, ChatGPT desktop app | Needs a change | A stdio entry in Settings, MCP servers is possible. The install path differs from Claude Desktop. | P: codex/mcp |
| View rendering from a local stdio server in the ChatGPT desktop chat | UNVERIFIED | No primary source. One developer says the same server renders "in both VS Code's MCP client and Codex". | S: https://github.com/anthropics/claude-ai-mcp/issues/165 |
| Custom server access by plan | Needs a change | Full MCP (write tools): Business and Enterprise/Edu on web. Pro: read and fetch only. | P: help article |
| `ui.domain` | Needs a change | Each host has its own format. Leave it out for local use. | P: getting-started.md; plugins/reference |
| Public listing in the ChatGPT directory | Not possible with a local server | Needs a stable public HTTPS endpoint and a unique `ui.domain`. | P: plugins/build/mcp-server; plugins/reference |
| Part 8 boundary | Needs a change | With a tunnel or hosted server, room content in tool results travels through OpenAI infrastructure before it reaches the model. This is a design decision for the owner, not a protocol limit. | P: secure-mcp-tunnels (search excerpt) |

Answer to the hypothesis: the three views and the tool contract are portable. The transport and the install path are not. The ChatGPT desktop app is the only ChatGPT surface that accepts a local stdio server, and view rendering there is not confirmed by a primary source. Run a spike before any promise.

---

## What this means for the three MindrianOS components

Each rule names its source. "Card" means decision card, step player or next-move card.

1. **Text is the contract; the card is an extra.** Each UI tool returns `content` text that holds the full idea in plain words (question, options, recommended option, or the step, or the next move). The card must add controls only. Reason: the specification requires meaningful `content`, and the Claude host tells the model not to repeat the result even when the iframe did not paint. Sources: specification 2026-01-26; ext-apps issue 671 (2026-09-02).
2. **Gate the UI on the client capability, and declare the server capability.** Register a tool with `_meta.ui.resourceUri` only when the client advertises `io.modelcontextprotocol/ui`. Declare `capabilities.extensions["io.modelcontextprotocol/ui"]` on the server. In all other cases use the existing ladder (elicitation, then text). Sources: specification; issue 165; build-mcp-app SKILL.md (elicitation table).
3. **Plan for two homes, not one.** In the Claude chat a plugin local server is ignored; only a `claude_desktop_config.json` or extension entry reaches the chat, and local views have reported render faults. In the Code tab the plugin server loads and widgets are a listed feature. Treat the Code tab as the first target and the chat as a spike. Sources: platform-support.md; getting-started.md; cowork changelog; claude-code issue 88370; issue 165.
4. **One card, one tool, one idea.** Do not build one view that switches between decision, step and next move. Use three tools and three `ui://` resources. Say in each tool description that it opens a card. Sources: build-mcp-app SKILL.md ("One widget per tool"); ui-guidelines ("single-purpose").
5. **Decision card layout: inline, at most 2 buttons at the bottom, at most 4 to 5 data points, no menu, no inner scroll.** The recommended option is the primary button. A third free-form option ("What if C") is not a text box in the card; the card tells the user to type it in the chat. Sources: design-guidelines.md; ui-guidelines.
6. **The click is the approval, and only the click.** The buttons call an app-only tool (`visibility: ["app"]`) with `app.callServerTool`. The model cannot see or call that tool. The server checks the gate id, the option id and single use, and returns the authoritative result. Disable both buttons while the call runs. Show a final state (approved, rejected, failed with retry). Sources: specification (visibility); app-tools page (no prompt on `callServerTool`); chatgpt-ui (server is the source of truth); sunpeak blog.
7. **Tell the model what happened, in two different ways.** After the decision, call `updateModelContext` with the full current state (silent). Call `sendMessage` only from the user's click, with a short readable request, and do not treat a no-error result as proof that the user agreed. Keep the message under 8,000 characters. Sources: Patterns page; send-messages page; widget-templates.md.
8. **Old cards must go inert.** Put a server-minted key (gate id plus sequence) in `structuredContent`. Use a `BroadcastChannel` so an older card greys out and stops all calls. Keep the server-side single-use check as the real guard. Sources: instance-supersession page; apps-sdk-messages.md.
9. **Step player: one step on screen, state on the server.** Inline shows the current step only, with one primary action (Next) and one secondary action (Back). No tabs, breadcrumbs or drill-ins inline. Offer the whole path only after a click that requests `fullscreen`, and lay out by `containerDimensions` from 320 px up. The current step lives on the server; the view reads it from the tool result or an app-only tool, because a reloaded view starts from the HTML. Sources: design-guidelines.md; ui-guidelines; display-modes page; Patterns page (view state).
10. **Next-move card: display plus one action.** It shows one move, the reason in one line (the `note` pattern), and one button. The tool returns the same move as text so the model can continue without a click. Sources: build-mcp-app SKILL.md ("Don't block on widget results for read-only tools", "Put Claude's reasoning in the payload").
11. **Put each datum in the right lane.** Text the model needs: `content`. Data the card needs: `structuredContent`, kept short, because ChatGPT gives it to the model verbatim. Data only the card may see: `_meta`. Assume that the model sees everything in `content` and, on ChatGPT, in `structuredContent`. Sources: specification; plugins/reference; 15 lessons.
12. **One self-contained HTML file per card.** Inline the SDK bundle, CSS and script. No CDN, no remote font, no remote image (`data:` only). Use `addEventListener`. No `eval`. Declare an empty `csp`. Set handlers before `connect()`, always call `connect()`, keep `autoResize` on, never report height 0. Sources: build-mcp-app SKILL.md; apps-sdk-messages.md; troubleshooting; issue 671 (2026-09-17, 2026-09-18).
13. **Host tokens for structure, brand for accent.** Use the standard CSS variables with fallbacks, a transparent background, the `color-scheme` meta tag, and `prefersBorder` set explicitly. Support light and dark. Use the host font variable with a system fallback; do not ship a custom font. Brand colors go on the primary button and small accents only. Meet WCAG AA, keyboard use and 44 pt targets. Sources: design-guidelines.md; transparent-theming.md; ui-guidelines.
14. **Version the `ui://` URI and keep tool definitions constant.** Put a content hash in each URI and keep the previous URI served. Do not change tool names, titles, descriptions or schemas between releases without need, because the user's "Always allow" can reset. Fully quit Claude Desktop after an HTML change. Sources: chatgpt-ui; issue 671 (2026-09-18); app-tools page; build-mcp-app SKILL.md.
15. **Test the card where it can fail.** Order: browser page with a fake shim; `basic-host`; a UI inspector; Claude Desktop config entry; Code tab; then a tunnel to claude.ai and ChatGPT. For each card test: text fallback in a host without UI, light and dark, 320 px width, empty, loading, error, double click, old card after a new card, and a result near the size cap (130 KB target; 25,000 tokens in Claude Code). Check the connector page count of interactive tools. Sources: build-mcp-app SKILL.md; Testing_MCP_Apps page; MCPJam Asana case study; payload-budgeting.md; troubleshooting; issue 165.

---

## UNVERIFIED

Each item has only a secondary source, only a search excerpt, or no source.

1. ChatGPT desktop app and a local stdio server: https://developers.openai.com/codex/mcp (P, read with a query filter) says the desktop app can add a STDIO server. No primary source says that MCP App UI from that server renders in the desktop chat. One GitHub comment says a server "renders correctly as a real iframe in both VS Code's MCP client and Codex" (S: issue 165). Needs a spike.
2. Code tab widgets from a plugin local stdio server: the changelog line and issue 88370 show that widgets render in Claude Code sessions, but no primary page states it for a plugin-bundled stdio server. The changelog version and date for the line were not captured. Needs a spike.
3. Claude Code terminal shows no widget: inferred from the docs line about UI resources. A secondary post (https://cto4.ai/p/mcp-apps-in-context, about March 2026, search excerpt only) says MCP Apps work in all Claude surfaces "but Claude Code"; this is older than the changelog line.
4. The cause of the blank-frame reports in Claude Desktop and claude.ai (issue 165, issue 671). Developers propose connector gating, session state, `ui.domain`, `websiteUrl`. No Anthropic statement was found. The current state on 2026-11-27 is unknown.
5. The host note "[This tool call rendered an interactive widget in the chat ...]" and its behavior come from developer reports only (S).
6. "Hosts strip `_meta` before the model ever sees it" for Claude: developer comment only (S). The Claude docs state the `structuredContent` rule for app tools; no Claude page states the rule for server tool results.
7. The default Claude sandbox origin is per conversation: developer measurement (S: issue 165). The specification says "typically per-conversation".
8. `registerAppTool` and `registerAppResource` do not declare the server extension capability: developer report (S). SDK version of the report not stated; v2.1.0 was not checked.
9. Numeric maximum height of a Claude inline view: no source found.
10. Whether Claude Desktop chat supports MCP elicitation for a local server: no source read. The Anthropic skill recommends elicitation but does not list host support.
11. Year of the ext-apps releases "10 Nov" (v2.1.0), "25 Sep" (v2.0.2), "23 Jul" (v1.7.5): the releases page shows day and month only. 2026 is assumed.
12. MCP Apps over MCPB (local extension with UI): the Anthropic skill names it as a deployment shape (P), but one developer reports a blank frame with an MCPB extension on Desktop 1.26832.0 (S).
13. The support article list of interactive connectors (Amplitude, Asana, Box, Canva, Clay, Figma, Hex, Slack) is P, but no engineering post from Figma, Canva, Slack, Hex, monday.com, Vercel, Cloudflare, Sentry or Linear about their MCP App build was found. The Asana material is a vendor case study on mcpjam.com (S).
14. The client support matrix page (https://modelcontextprotocol.io/extensions/client-matrix) was read, but the check marks did not survive extraction. The client list in section 1 uses the overview page text instead.
15. Publication date of "15 lessons learned building ChatGPT Apps": no date found on the page. It uses `window.openai` names, so it predates or ignores the standards-first guidance.
16. OpenAI "UX principles" page: https://developers.openai.com/plugins/concepts/ux-principles returned 404. The UI guidelines page was used instead.
17. ChatGPT: custom MCP servers on Free and Plus plans, and plan rules for stdio servers in the desktop app: no source found.
18. ChatGPT: support for MCP prompts (`prompts/list`): no source found.
19. ChatGPT: whether `ui/message` from a view needs user consent, and whether `tools/call` from a view to an app-only write tool shows the host confirm dialog: no source found.
20. ChatGPT: how strongly the model follows MCP server instructions (for example a persona line): no source found.
21. Secure MCP Tunnel details (stdio forwarding, no public submission) and the public endpoint rule come from search excerpts of OpenAI pages, not from a full read.
22. ChatGPT skills inside a plugin and "Partial" Skills over MCP support: from a search excerpt and the client matrix link text; the linked section was not read.

