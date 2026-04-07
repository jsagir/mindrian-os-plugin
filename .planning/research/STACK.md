# Stack Research: v1.9.0 Context Engineering Optimization

**Domain:** Claude Code plugin optimization (context window management, caching, progressive loading, npm distribution, release hardening)
**Researched:** 2026-04-07
**Confidence:** HIGH (verified against existing codebase, official Claude Code docs, npm registry)

## Scope

This research covers ONLY the new stack additions for v1.9.0. The existing validated stack (Node.js CJS, Bash scripts, Neo4j Aura, Pinecone, KuzuDB, ICM folder structure, MCP SDK, gray-matter, etc.) is NOT re-evaluated.

**Critical finding: Zero new npm dependencies required.** Every v1.9.0 feature is achievable with Node.js built-ins + existing dependencies. This is not accidental -- the features are infrastructure-level (file I/O, hashing, process management) where Node.js core modules are the right tool.

---

## Recommended Stack Additions

### 1. Context Window Measurement

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Built-in `context-monitor` statusline | Already shipped (v1.8.x) | Writes context window data (`used_percentage`, `remaining_percentage`, `context_window_size`) to per-room bridge files at `~/.mindrian/bridge/{hash}.json` | Already exists in codebase. `session-start` already reads this bridge file for tiered context loading (CTX-02). No new dependency needed. |
| Character-based estimation | Built-in | Approximate token counts from file byte sizes using ~4 chars/token heuristic | Good enough for load/skip decisions. Skill files are markdown -- 1 token per ~4 chars is well-established for English text. Exact counts are unnecessary when the goal is "load this 5KB file or not." |

**Why NOT `@anthropic-ai/tokenizer`:** This npm package is explicitly documented as inaccurate for Claude 3+ models ("very rough approximation"). We already have real context window percentages from the statusline API via the bridge file. Adding a dependency for worse data than what we already have is wrong. [HIGH confidence -- verified GitHub repo README]

**Why NOT Anthropic's Token Count API:** Requires API key + network call. Plugin hooks must complete in <2 seconds. API calls from hooks add latency and failure modes. The bridge file approach is zero-latency, zero-network. [HIGH confidence -- verified API docs]

### 2. Progressive/Lazy Skill Loading

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js `fs` (built-in) | Node 18+ | Read skill file sizes, generate stub summaries, load full skills on demand | No library needed. Skills are markdown files in `skills/*/SKILL.md` (7 directories, ~50KB total). A build script reads file sizes and extracts frontmatter. |
| `gray-matter` | ^4.0.3 | Parse skill YAML frontmatter for manifest generation | Already in package.json. Use frontmatter `trigger` and `description` fields to build stubs without loading full skill body. |

**Architecture:** Generate `skills/.manifest.json` at build/release time containing per-skill metadata (name, description, triggers, byte size, priority tier). Session-start loads the manifest (~500 bytes) instead of all 7 skill directories (~50KB). Full skill content loads only when triggered.

Current skill sizes (measured from codebase):
- `larry-personality/mode-engine.md`: 7,890 bytes
- `ui-system/SKILL.md`: 7,492 bytes
- `context-engine/SKILL.md`: 6,769 bytes
- `room-proactive/SKILL.md`: 5,801 bytes
- `larry-personality/SKILL.md`: 5,349 bytes
- `brain-connector/SKILL.md`: 5,062 bytes
- `larry-personality/framework-chains.md`: 4,921 bytes
- `room-passive/SKILL.md`: 4,297 bytes
- `pws-methodology/SKILL.md`: 2,229 bytes
- **Total: ~49,810 bytes = ~12,450 tokens always loaded**

With manifest: ~500 bytes loaded = ~125 tokens. **99% reduction** for skills layer at session start.

### 3. Caching Strategies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| File-based JSON cache (custom, ~50 lines) | N/A | Cache Brain MCP responses, STATE.md computations, room analysis results | Write JSON to `room/.mindrian/cache/{key}.json` with TTL via file mtime. On read, check mtime age vs TTL. On miss, recompute and write. Filesystem IS the cache -- aligns with ICM. |
| Node.js `crypto.createHash('md5')` | Built-in | Cache key generation from input parameters | Already used in `context-monitor` for bridge file path hashing. Consistent pattern across codebase. |

**Cache implementation pattern:**
```javascript
// lib/core/file-cache.cjs (~50 lines)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function cacheKey(prefix, ...args) {
  return prefix + '-' + crypto.createHash('md5').update(args.join('|')).digest('hex').slice(0, 12);
}

function cacheGet(cacheDir, key, ttlSeconds) {
  const file = path.join(cacheDir, key + '.json');
  if (!fs.existsSync(file)) return null;
  const age = (Date.now() - fs.statSync(file).mtimeMs) / 1000;
  if (age > ttlSeconds) { try { fs.unlinkSync(file); } catch(e) {} return null; }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) { return null; }
}

function cacheSet(cacheDir, key, value) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const tmp = path.join(cacheDir, key + '.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, path.join(cacheDir, key + '.json')); // atomic write
}

function cacheClear(cacheDir, prefix) {
  if (!fs.existsSync(cacheDir)) return;
  for (const f of fs.readdirSync(cacheDir)) {
    if (f.startsWith(prefix)) try { fs.unlinkSync(path.join(cacheDir, f)); } catch(e) {}
  }
}
```

**TTL recommendations:**
| Cache Target | TTL | Rationale | Invalidation |
|-------------|-----|-----------|--------------|
| Brain MCP responses | 24h (86400s) | Teaching intelligence is static between releases | Manual via `/mos:cache clear` |
| STATE.md computation | 5min (300s) | Recompute on next session start if stale | PostWrite hook when STATE.md changes |
| Room analysis (analyze-room) | 15min (900s) | Moderate churn during active sessions | PostWrite hook clears on any room file write |
| Skill manifest | Until plugin update | Version-stamped, never stale within same version | Regenerated at build time |
| Integrity check result | 24h (86400s) | File hashes don't change during normal use | Cleared on plugin update |
| Hook staleness check | 24h (86400s) | Version headers don't change during normal use | Cleared on plugin update |

**Why NOT `node-cache` / `lru-cache` / `cacheman`:** These are in-memory caches. Hook scripts run as **separate processes** spawned by Claude Code -- in-memory state dies when the process exits. File-based caching is the ONLY approach that persists across ephemeral hook invocations. This is not a preference; it is a hard constraint of the plugin hook architecture. [HIGH confidence -- verified by examining hooks.json: hooks spawn `run-hook.cmd` which executes scripts as child processes]

**Why NOT Redis/SQLite:** Creates dual source of truth with filesystem. Breaks ICM principle. Adds infrastructure dependency.

### 4. npm Package Distribution

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| npm registry (public) | N/A | Distribute plugin as npm package | Claude Code marketplace natively supports `npm` as a plugin source type in marketplace.json. Zero custom infrastructure needed. |
| `marketplace.json` npm source | N/A | Point marketplace entry to npm package | Verified format: `{"source": "npm", "package": "mindrian-os", "version": "^1.9.0"}`. Supports version pinning, semver ranges, private registries. |
| `"files"` in package.json | N/A | Whitelist published files | Safer than `.npmignore` blacklist -- explicitly declares what ships. |
| `npm publish` | Built-in | Publish to registry | Standard workflow. `prepublishOnly` script generates build artifacts. |

**marketplace.json npm source entry:**
```json
{
  "name": "mos",
  "source": {
    "source": "npm",
    "package": "mindrian-os",
    "version": "^1.9.0"
  },
  "description": "MindrianOS -- AI innovation co-founder"
}
```

**Dual distribution strategy:** Keep GitHub as primary (self-update via git clone is proven, gives more control, supports SHA pinning). Add npm as secondary for marketplace integration. Both deliver identical code.

**Required package.json changes:**
- Remove `"private": true` (blocks npm publish)
- Add `"files"` whitelist
- Add `prepublishOnly` build script

### 5. Hook Version Detection and Staleness Checks

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Version header convention | N/A | Each hook/script embeds `# @version X.Y.Z` in first 5 lines | Zero-cost. Self-documenting. Survives copy/move operations. |
| Semver comparison (custom, ~20 lines) | N/A | Compare script version headers against plugin.json version | Already have version comparison logic in `check-update` (Node one-liner). Extract to `lib/core/version-ops.cjs`. |

**Convention:**
```bash
#!/usr/bin/env bash
# @version 1.9.0
# session-start: SessionStart hook handler for MindrianOS
```

**Detection logic:**
```javascript
// lib/core/version-ops.cjs
function checkHookStaleness(scriptPath, pluginVersion) {
  const head = fs.readFileSync(scriptPath, 'utf8').split('\n').slice(0, 5).join('\n');
  const match = head.match(/@version\s+([\d.]+)/);
  if (!match) return { stale: false, reason: 'no-header' };
  return { stale: match[1] !== pluginVersion, expected: pluginVersion, found: match[1] };
}
```

Scripts without headers are treated as "unknown version" (always pass). This allows gradual adoption without breaking existing scripts.

### 6. Git Verification for Plugin Integrity

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js `crypto` | Built-in | SHA-256 hash of critical files | 3 lines of code. Hash plugin.json + hooks.json + key scripts. Compare against known-good hashes. |
| `.integrity` file | N/A | Ship SHA-256 hashes with each release | Generated at build time. Read at session-start (once per day, cached). |
| `child_process.execSync` | Built-in | Git tag verification (`git tag -v`) | Already used throughout codebase in git-ops.cjs. |

**Integrity check flow:**
1. Build time: `scripts/build-integrity.cjs` hashes critical files, writes `.integrity`
2. Session-start: Read `.integrity`, recompute hashes, compare
3. Mismatch = warn: "Plugin files modified since install. Run /mos:update to restore."
4. Result cached for 24h in bridge file (avoid re-checking every session)
5. Only checks critical files (plugin.json, hooks.json, session-start, ~10 files total)

**Critical files to hash:**
- `.claude-plugin/plugin.json` -- version, identity
- `hooks/hooks.json` -- hook configuration
- `hooks/run-hook.cmd` -- hook dispatcher
- `scripts/session-start` -- context injection
- `scripts/self-update` -- update mechanism
- `bin/mindrian-tools.cjs` -- CLI entry point
- `lib/core/index.cjs` -- core library entry

### 7. Background Update Check (Detached Process)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `child_process.spawn` with `detached: true` | Built-in | Run update check without blocking session-start | `spawn('node', ['check-update-bg.cjs'], { detached: true, stdio: 'ignore' }).unref()`. Process survives parent exit. Writes result to bridge file. |

**Pattern:**
```javascript
// Non-blocking update check spawned from session-start
const child = spawn('node', [path.join(__dirname, 'check-update-bg.cjs')], {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env, PLUGIN_ROOT: pluginRoot }
});
child.unref(); // Don't wait for completion
```

The background process writes its result to the bridge file. Next session-start reads the cached result instead of blocking on a network call.

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gray-matter` | ^4.0.3 | Parse skill frontmatter for manifest generation | Already installed. Use in `build-skill-manifest.cjs`. |
| Node.js `crypto` | Built-in | Cache keys (MD5), integrity hashes (SHA-256) | Already used in context-monitor. |
| Node.js `fs` | Built-in | File-based cache, skill loading, integrity checks | Core of everything. |
| Node.js `child_process` | Built-in | Git operations, background update check | Already used extensively. |

**Total new npm dependencies for v1.9.0: 0**

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `scripts/verify-release` | Pre-release verification | Already exists. Extend with: integrity hash generation, hook version validation, npm pack dry-run. |
| `npm pack --dry-run` | Preview npm package contents | Verify `"files"` whitelist before first publish. |
| `wc -c skills/*/*.md` | Measure skill token budget | Quick validation that progressive loading numbers are correct. |

---

## Installation

```bash
# No new packages required for v1.9.0
# Everything uses Node.js built-ins + existing dependencies (gray-matter)

# For npm distribution setup (one-time):
npm login
npm publish --access public
```

---

## package.json Changes Required

```json
{
  "name": "mindrian-os",
  "private": false,
  "files": [
    "bin/",
    "lib/",
    "scripts/",
    "commands/",
    "skills/",
    "agents/",
    "hooks/",
    "references/",
    "pipelines/",
    ".claude-plugin/",
    ".mcp.json",
    "settings.json",
    "CHANGELOG.md",
    ".integrity"
  ],
  "scripts": {
    "mcp": "node bin/mindrian-mcp-server.cjs",
    "parity": "node lib/parity/check-parity.cjs",
    "build:manifest": "node scripts/build-skill-manifest.cjs",
    "build:integrity": "node scripts/build-integrity.cjs",
    "prepublishOnly": "npm run build:manifest && npm run build:integrity"
  }
}
```

**Note:** `"name"` changes from `mindrian-os-plugin` to `mindrian-os` for npm public package name. Verify name availability on npmjs.com before publishing.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Character-based token estimation | `@anthropic-ai/tokenizer` | Never. Inaccurate for Claude 3+. Bridge file has real data. |
| File-based JSON cache (50 lines) | `node-cache`, `cacheman`, `keyv` | Never. Hook processes are ephemeral -- in-memory caches die between invocations. |
| `"files"` whitelist in package.json | `.npmignore` | Never. Whitelist is safer -- explicitly declares what ships. |
| `# @version` header convention | Separate version manifest file | Never. Headers are self-documenting, survive copy. Manifest creates sync risk. |
| `crypto.createHash('sha256')` | `ssri` npm package | Never. SSRI is for HTTP subresource integrity. Local hashing is 3 lines of built-in code. |
| npm as secondary distribution | npm as primary (drop git self-update) | When Anthropic marketplace fully standardizes on npm and provides auto-update for npm sources. |
| Custom semver comparison | `semver` npm package | Only if version comparison grows to need ranges/prereleases. Current need is equality check only. |
| Build-time skill manifest | Runtime skill scanning | Never in production. Runtime scanning adds latency to session-start (2-second budget). |
| Detached spawn for update check | In-process async fetch | Never. Session-start has 2-second timeout. Network calls can take 3+ seconds. Detached process is fire-and-forget. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@anthropic-ai/tokenizer` | Inaccurate for Claude 3+. Adds dependency for worse data than bridge file already provides. | Bridge file `ctx_pct` from Claude's statusline API |
| `node-cache` / `lru-cache` / `@isaacs/ttlcache` | In-memory. Hook processes are ephemeral -- memory is lost between invocations. | File-based JSON cache in `room/.mindrian/cache/` |
| `semver` npm package | Need equality check, not range resolution. 20 lines vs 50KB dependency. | `version.split('.').map(Number)` comparison |
| `tiktoken` / `js-tiktoken` | OpenAI tokenizer with different encoding than Claude. Bridge file has exact data. | Bridge file context window data |
| Any database for caching | Dual source of truth. Filesystem IS the architecture. | JSON files in `.mindrian/cache/` |
| Webpack / esbuild / rollup | No bundling needed. CJS files ship as source. "Every output is an edit surface." | Direct file shipping via `"files"` whitelist |
| `dotenv` | Environment comes from shell. Plugin runs in Claude's environment. | Direct `process.env` access |
| `commander` / `yargs` for build scripts | Build scripts take 0-1 args. `process.argv[2]` is sufficient. | Direct `process.argv` |

---

## New Files to Create

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `lib/core/file-cache.cjs` | Generic file-based cache with TTL | ~50 lines |
| `lib/core/version-ops.cjs` | Hook staleness detection, semver comparison | ~40 lines |
| `lib/core/skill-loader.cjs` | Progressive skill loading, manifest reading | ~60 lines |
| `lib/core/integrity-ops.cjs` | File hash generation and verification | ~50 lines |
| `scripts/build-skill-manifest.cjs` | Build-time: generate `skills/.manifest.json` | ~40 lines |
| `scripts/build-integrity.cjs` | Build-time: generate `.integrity` hash file | ~30 lines |
| `scripts/check-update-bg.cjs` | Background (detached) update checker | ~40 lines |
| `skills/.manifest.json` | Pre-computed skill metadata (generated) | ~1KB |
| `.integrity` | SHA-256 hashes of critical files (generated) | ~500 bytes |

**Total new code: ~360 lines across 7 source files + 2 generated files.**

---

## Integration Points

| Existing Component | How v1.9.0 Integrates |
|-------------------|--------------------------|
| `scripts/session-start` | Reads skill manifest instead of loading all skills. Checks hook staleness (cached 24h). Verifies integrity (cached 24h). Spawns background update check. Already reads bridge file for context tier. |
| `scripts/context-monitor` | No changes. Already writes bridge file with context window data that drives all budget decisions. |
| `hooks/hooks.json` | No structural changes. PostWrite hook's `post-write` script extended to invalidate relevant caches via `cacheClear()`. |
| `lib/core/brain-client.cjs` | Wrap Brain MCP calls with `file-cache` (24h TTL). Cache key = query hash. |
| `scripts/compute-state` | Wrap output with `file-cache` (5min TTL). Cache key = room path hash. |
| `scripts/analyze-room` | Wrap output with `file-cache` (15min TTL). Invalidated by PostWrite hook. |
| `scripts/check-update` | Extract version comparison to `version-ops.cjs`. Background variant writes to bridge file. |
| `scripts/self-update` | Add npm update path (`npm install mindrian-os@latest`) alongside git clone. |
| `package.json` | Remove `"private": true`, add `"files"`, add build scripts, rename to `mindrian-os`. |
| `scripts/verify-release` | Extend with: build manifest, build integrity, validate version headers, npm pack dry-run. |
| `scripts/post-write` | Add cache invalidation: clear `analyze-room` and `compute-state` caches on room file writes. |
| Marketplace `marketplace.json` | Add npm source entry alongside existing GitHub source. |

---

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| File-based cache (custom) | Node.js >=18 | Uses `fs.statSync().mtimeMs` (available since Node 8) |
| `gray-matter@^4.0.3` | Node.js >=18 | Already in package.json, no change |
| `crypto.createHash('sha256')` | Node.js >=18 | Built-in, always available |
| `child_process.spawn({ detached })` | Node.js >=18 | Built-in, used for background update check |
| npm publish | npm >=9 | Requires `"private": false` |
| Claude Code npm plugin source | Claude Code 1.x+ | Verified in official marketplace docs |

---

## Sources

- [Claude Code Plugin Marketplace Docs](https://code.claude.com/docs/en/plugin-marketplaces) -- npm source type confirmed, marketplace.json schema verified, plugin caching behavior documented [HIGH confidence -- fetched 2026-04-07]
- [Anthropic Tokenizer TypeScript](https://github.com/anthropics/anthropic-tokenizer-typescript) -- README confirms inaccuracy for Claude 3+ models [HIGH confidence]
- [Claude API Token Counting](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- API-based counting requires API key, free but network-dependent [HIGH confidence]
- [@anthropic-ai/tokenizer npm](https://www.npmjs.com/package/@anthropic-ai/tokenizer) -- package exists but deprecated for modern models [HIGH confidence]
- [node-cache npm](https://www.npmjs.com/package/node-cache) -- confirmed in-memory only, unsuitable for ephemeral processes [HIGH confidence]
- Existing codebase: `scripts/context-monitor` (bridge file pattern), `scripts/session-start` (tiered loading), `scripts/check-update` (version comparison), `hooks/hooks.json` (process model) -- all verified by reading source [HIGH confidence, local verification]
- Existing `package.json` -- `"private": true` confirmed, dependencies verified [HIGH confidence, local verification]
- Skill file sizes measured: `du -b skills/*/*.md` -- 49,810 bytes total across 9 files [HIGH confidence, local verification]

---
*Stack research for: MindrianOS v1.9.0 Context Engineering Optimization*
*Researched: 2026-04-07*
