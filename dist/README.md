<!-- GENERATED FILE - DO NOT HAND EDIT. | Regenerate with: node scripts/build-dist-bundles.cjs -->

# MindrianOS distribution bundles

Generated from the canonical `skills/` tree by `scripts/build-dist-bundles.cjs`.
Nothing in this directory is hand-edited. Edit `skills/`, then regenerate.

## There is no auto-update mechanism

These bundles are generated SNAPSHOTS, not auto-updating installs. Claude Code
has `claude plugin update`; VS Code, Cursor, Zed, Gemini CLI and the rest of the
Agent Skills ecosystem have no equivalent for this content today. A copy you
placed on a foreign host will stay exactly as old as the day you placed it.

To refresh:

```bash
node scripts/build-dist-bundles.cjs      # regenerate both bundles
# then copy the bundle into your host again, manually
```

To find out whether a bundle is behind before you trust it:

```bash
node scripts/build-dist-bundles.cjs --check-stale   # exit 1 when stale
```

That check compares `dist/BUNDLE-VERSION.json`'s `source_version` against the
live `.claude-plugin/plugin.json` version. Staleness is mechanically detectable,
not silently assumed.

## What is here

| Bundle | Layout | Hosts |
|--------|--------|-------|
| `generic-claude-dir/` | nested `.claude/skills/<name>/SKILL.md` plus each skill's `references/`, `scripts/`, `assets/` | VS Code, Cursor, Goose, OpenCode, Copilot, Codex, Gemini CLI, Roo Code, Amp and the rest of the Agent Skills clients that read the `.claude/skills/` convention |
| `zed/` | FLAT `.agents/skills/<name>/SKILL.md`, no nested folders | Zed only (its loader does not descend into skill subdirectories) |

- Skills in each bundle: 126
- Catalog name+description bytes: 13240 / 51200 (26% of Zed's 50KB budget)
- Skills whose subdirectories could not ship to Zed: 1 (2 subdirectories in total, recorded in `zed/OMITTED-ASSETS.md`)

## `generic-claude-dir/.mcp.json` is machine-specific

It is generated with a LITERAL absolute path to the MindrianOS install on the
machine that ran the generator, because no foreign host expands
`${CLAUDE_PLUGIN_ROOT}`. That is why it is deliberately not committed to the
repository: the path would be wrong for everyone else. Run the generator on your
own machine to get a correct one, or edit the two `args` paths and the
`MINDRIAN_OS_ROOT` env value by hand.

It carries a path and nothing else. No Brain key, no credential, ever.
