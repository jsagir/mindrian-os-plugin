# MindrianOS Troubleshooting

## Brain Connection Issues

### "RESOURCE_EXHAUSTED" / "429" / Pinecone Quota Error

**What happened:** Pinecone's free tier hit its monthly embedding token limit (5M tokens/month). Every semantic search query consumes tokens. When the quota is used up, all Brain searches fail until the billing cycle resets.

**Immediate fix (30 seconds):**

```bash
# Remove the Brain config — MindrianOS works fully without it
rm -f .mcp.json

# Restart Claude Code
```

**Everything still works without Brain:**
- All 46 `/mos:` commands
- Data Room (filing, analysis, intelligence)
- Knowledge graph (KuzuDB LazyGraph)
- Meeting intelligence (filing, speakers, cross-meeting)
- AI Team Personas (De Bono Six Hats)
- Opportunity Bank + Funding Room
- Reasoning Engine
- PDF export, dashboard, pipelines

**Only 5 commands lose enrichment** (they still work, just without graph intelligence):
- `/mos:suggest-next` — works, but without framework chain recommendations
- `/mos:find-connections` — works, but without cross-domain pattern discovery
- `/mos:compare-ventures` — works, but without similar venture matching
- `/mos:deep-grade` — works, but without calibrated grading from 100+ projects
- `/mos:research` — works, but without semantic cross-reference

**To restore Brain later:**
```bash
/mos:setup brain
# Enter your Brain API key when prompted
# Get a key at: https://mindrianos-jsagirs-projects.vercel.app/brain-access
```

---

### "Neo4j connection refused" / "Failed to connect"

**What happened:** The Neo4j Aura instance might be paused (free tier pauses after 3 days of inactivity) or the credentials are wrong.

**Fix:**
1. If using direct Neo4j connection (old pattern) — switch to Brain API key:
   ```bash
   rm -f .mcp.json
   /mos:setup brain
   ```
2. If using Brain API server — the server handles Neo4j reconnection. Just retry.
3. If the error persists, the Brain server might be sleeping (Render free tier, 30-60s cold start). Wait 60 seconds and try again.

---

### "Invalid Brain API key" / 401 Error

**What happened:** Your Brain API key is missing, expired, or revoked.

**Fix:**
1. Check your `.env` file has `MINDRIAN_BRAIN_KEY=<your-key>`
2. If expired, request a new one at https://mindrianos-jsagirs-projects.vercel.app/brain-access
3. If you don't have a key, remove Brain config and work without it:
   ```bash
   rm -f .mcp.json
   ```

---

### "MCP server failed to start" / "neo4j-brain not found"

**What happened:** Your `.mcp.json` references MCP servers that aren't installed or configured.

**Fix:**
```bash
# Remove the broken config
rm -f .mcp.json

# Restart Claude Code
```

If you want Brain, use the API key method instead of direct database connections:
```bash
/mos:setup brain
```

---

## Plugin Issues

### Commands not recognized / "/mos:" not working

**What happened:** Plugin might not be installed or needs update.

**Fix:**
```bash
# Reinstall
claude plugin marketplace remove mindrian-marketplace
claude plugin marketplace add jsagir/mindrian-marketplace
claude plugin install mos@mindrian-marketplace

# Restart Claude Code
```

---

### "Plugin mindrian-os not found"

**What happened:** Plugin was renamed from `mindrian-os` to `mos` in v0.6.0.

**Fix:**
```bash
# Remove old name
claude plugin uninstall mindrian-os@mindrian-marketplace

# Install new name
claude plugin install mos@mindrian-marketplace

# Restart Claude Code
```

---

### Plugin update not picking up changes

**Fix:**
```bash
# Full reinstall
claude plugin uninstall mos@mindrian-marketplace
claude plugin marketplace remove mindrian-marketplace
claude plugin marketplace add jsagir/mindrian-marketplace
claude plugin install mos@mindrian-marketplace

# Restart Claude Code
```

---

## Knowledge Graph Issues

### KuzuDB errors / "Cannot open database"

**What happened:** The LazyGraph database file might be corrupted.

**Fix:**
```bash
# Remove and rebuild the graph
rm -f room/.lazygraph

# Rebuild from room content
node bin/mindrian-tools.cjs graph rebuild ./room
```

---

### Graph queries return empty results

**What happened:** The graph might not be built yet, or no cross-references exist.

**Fix:**
```bash
# Check graph stats
node bin/mindrian-tools.cjs graph stats ./room

# If nodes = 0, rebuild
node bin/mindrian-tools.cjs graph rebuild ./room
```

---

## General Rules

1. **When in doubt, delete `.mcp.json`** — MindrianOS works fully without Brain
2. **Restart Claude Code** after any config change
3. **Brain is optional** — it enriches but never blocks
4. **All errors should be silent** — if you see an error, it's a bug. Report it.
5. **Never share your Brain API key** — it's tied to your account

## Privacy & Data Ownership

**All Data Room content is stored locally on your machine.** MindrianOS does not collect, access, or transmit your venture data. Period.

- **Room data** — stays in your `room/` folder. Never leaves your machine.
- **Knowledge graph** — KuzuDB runs embedded locally in `room/.lazygraph`. Your graph, your data.
- **Brain connection** (optional) — sends only search queries to the methodology graph. Never your room content, artifacts, or meeting transcripts. The Brain contains teaching intelligence (frameworks, grading rubrics, methodology chains) — not your data.
- **Wiki dashboard** — runs on localhost only. Not exposed to the internet.
- **Analytics** — local usage patterns stored in `room/.learnings.md`. Never transmitted.

Your intellectual property stays yours. MindrianOS is a tool, not a platform that monetizes your data.

## Get Help

- **Website:** https://mindrianos-jsagirs-projects.vercel.app
- **Brain Access:** https://mindrianos-jsagirs-projects.vercel.app/brain-access
- **Plugin Repo:** https://github.com/jsagir/mindrian-os-plugin
- **Report Issues:** https://github.com/jsagir/mindrian-os-plugin/issues
