---
type: decision-record
domain: ui-ux-architecture
source: Session 2026-04-16 discussion
decision: localhost Node server inside the plugin (no external dependency)
---

# Alternatives Considered for the Visual Layer

## Decision

Ship the visual layer as a Node HTTP server inside the existing MindrianOS plugin. No external dependencies (no Quarto, no Electron, no separate download). One install, one product, two surfaces (terminal + browser).

## Options evaluated

### Option A: Quarto open-source wiki (DEFERRED to export format)

**What:** Quarto is Posit's open-source scientific publishing system. Markdown-native, live-preview, wiki navigation, PDF export, incremental rebuild.

**Pros:**
- Already solves live-preview, search, PDF, static site generation
- Academic credibility (standard at JHU, Emory, research institutions)
- Room markdown maps 1:1 to Quarto project structure
- Lawrence could publish venture research in academic format

**Cons:**
- External dependency (Quarto installer, ~500MB with Pandoc)
- Not embeddable in the plugin (separate install = conversion rate halved)
- Cannot read room.db SQLite (no typed-edge graph visualization)
- Wikilinks need a custom Lua filter
- No bidirectional control surface (Quarto is a RENDERER, not a PLATFORM)

**Verdict:** DEFERRED. Quarto is the right EXPORT FORMAT for academic use (Phase 87+: `/mos:export quarto`). Not the right rendering engine for the live dashboard.

### Option B: Electron desktop app (REJECTED)

**What:** Standalone desktop app wrapping the dashboard in Chromium.

**Pros:** native feel, system tray, deep OS integration
**Cons:** 200MB+ download, separate install, separate update cycle, separate version matrix, heavy maintenance burden for a two-person team. Every Electron bug becomes our bug.

**Verdict:** REJECTED. Too heavy for the value delivered. A browser tab does the same thing.

### Option C: Chrome extension (DEFERRED to Tier 2/3)

**What:** Chrome Web Store extension with badge, popup, and optional claude.ai injection.

**Pros:** native browser integration, notifications, claude.ai sidebar injection (Tier 3 mass-market play)
**Cons:** Chrome-only (excludes Firefox, Safari, Arc), Chrome Web Store review process, extension permissions are scary to users, cannot host localhost server

**Verdict:** DEFERRED. Chrome extension is a LAYER ON TOP of the localhost server (Tier 2), not a replacement for it. Ship the server first (Phase 86), then the extension (Phase 88+). The claude.ai injection (Tier 3) is the mass-market play for when the product outgrows the terminal-first audience.

### Option D: Tauri app (CONSIDERED, not pursued)

**What:** Rust-based lightweight alternative to Electron (~10MB).
**Pros:** small, fast, native webview
**Cons:** Rust build toolchain, still a separate install, still a version matrix

**Verdict:** NOT PURSUED. Overhead exceeds benefit for current stage. Revisit if the product needs native desktop features (system tray notifications, global hotkeys) that a browser tab cannot provide.

### Option E: PWA (Progressive Web App) (MERGED into Option F)

**What:** localhost server with a service worker. "Add to home screen" on desktop.
**Pros:** feels like an app, no store review, offline capable
**Cons:** still needs the localhost server running, PWA install UX is confusing on desktop

**Verdict:** MERGED. The localhost server (Option F) IS a PWA-capable endpoint. Adding a manifest.json and service worker is a one-afternoon enhancement, not a separate architecture choice.

### Option F: Localhost Node server inside the plugin (SELECTED)

**What:** scripts/serve-dashboard ships inside the MindrianOS plugin. `/mos:dashboard live` starts it. Browser tab opens automatically. Zero external dependencies.

**Pros:**
- One install (plugin install IS the visual layer install)
- Version sync for free (plugin version = dashboard version)
- Zero new dependencies (Node 22 builtin http, fs, node:sqlite)
- BSL license covers it automatically
- Works offline (localhost, no cloud)
- Cross-platform (macOS, Linux, Windows)
- Reads room.db directly (typed-edge graph with Mondrian colors)
- SSE live-reload (zero-token incremental updates)
- Foundation for bidirectional control surface (Phase 87 buttons)

**Cons:**
- No native app feel (it's a browser tab)
- User must have Claude Code running for the server to start
- No system notifications without Chrome extension layer

**Verdict:** SELECTED. Maximum value per line of code. Ships as part of the product users already installed. Every other option adds an install step, a dependency, or a maintenance burden that a two-person team cannot sustain. The browser tab IS the product.
