# mos-face

The /m:os face panel mod. It draws a side panel, one status line and buttons in the prompt box, natively in the Claude Code terminal. It shows the state of the room in plain English.

## Walled package

This folder is a walled package (CLAUDE.md D-17, Phase 369.26 precedent, D-05 of Phase 380).

- It has its own folder, its own package.json and its own package-lock.json.
- It is never in the root package.json or the root npm-shrinkwrap.json.
- Nothing from ui reaches the tarball. Only built output ships, under lib/mos-face/dist, in a later plan.
- Its one devDependency is typescript, at the same exact version and integrity as tools/ts-check.
- The engine writes .claude-plugin/types itself. That folder is never committed.

## How to run it

Run these commands in this folder.

- Load it in a session: `claude --plugin-dir ui/mos-face` (from the repo root).
- Test it: `claude plugin test .` (34 original tests).
- Check the plugin shape: `claude plugin validate .`
- Type-check it: `npm run typecheck` (the script lands in a later plan).
- Build it: `npm run build` (the script lands in a later plan).
- Install the lockfile: `npm ci --ignore-scripts`.

## Surfaces

The panel draws only in the Claude Code terminal. Desktop and Cowork get no panel in this phase. This is a deliberate skip (D-05, N7). Their plain MCP reads stay as they are.

## Decisions

This section is filled by plan 07.
