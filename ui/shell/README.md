# mos-ui-shell

The MindrianOS UI shell: a walled package (Phase 369 D-07, D-17) on the chassis the bake-off chose
(workroom: Next 16 with React 19 and BlockNote). It is private, ESM TypeScript, and has its own
lockfile. Nothing here enters the plugin's root `package.json` except the three framework runtime
packages the navigator ruled on 2026-10-03 (`next`, `react`, `react-dom`, pinned to the same exact
versions in both manifests); only built assets ship, under `lib/ui-shell/dist` (plan 369-28), without a
`node_modules` tree.

## The three folders

- `server/`: framework-free, erasable TypeScript. The security layer and the session state:
  `config.ts` (one env source), `bootstrap.ts` (the one-time sign-in code), `auth.ts` (in-memory
  browser sessions, the cookie, CSRF, the sign-in exchange), `origin-guard.ts` (Host and Origin
  allow-list, fetch-metadata refusal), `csp.ts` (the Content-Security-Policy), `control.ts` (the
  launcher's channel and the start-up routine). Node runs these directly; the chassis only bundles them.
- `client/`: the React frame (`App.tsx`, the route registry `routes.ts`, the one browser client
  `api.ts`, the UI-SPEC copy `copy.ts`).
- `app/`: thin Next route glue, nothing else. A page or route file imports from `server/` and
  `client/` and adapts the chassis's request object. `proxy.ts` (Host and Origin guard plus the CSP
  nonce) and `instrumentation.ts` (start-up) sit at the package root because Next requires them there.

## Security model in one paragraph

Binds 127.0.0.1 only. Every request passes a Host and Origin allow-list (`127.0.0.1:<port>` only).
A browser signs in with a one-time link: a 32-byte code, sha256-armed by the launcher, valid 60
seconds, single use, exchanged for an HttpOnly SameSite=Strict cookie and a 303 to a code-free URL.
The exchange refuses cross-site requests before it touches the code. Sessions live in server memory;
nothing is stored in the browser. Every POST needs the session's CSRF token (from a meta tag, never
storage). Pages carry a per-response nonce CSP with no outside host.

## Build and run (the maintainer, at release; never on a user's machine)

```bash
export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH
cd ui/shell
npm ci --ignore-scripts
npm run build      # next build, then copies .next/static into .next/standalone
MOS_DAEMON_URL=http://127.0.0.1:<daemon port> npm run start   # MOS_SHELL_PORT, default 3369
```

Telemetry is off in both scripts (`NEXT_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1`). Environment:
`MOS_DAEMON_URL` (required, must be http://127.0.0.1), `MOS_SHELL_PORT`,
`MOS_SHELL_BOOTSTRAP_SHA256`, `MOS_SHELL_CONTROL_TOKEN_FILE`, `MOS_PROPOSAL_SOURCE`.

## Module system

ESM TypeScript, erasable syntax only (no enum, no namespace, no parameter properties), relative
imports with explicit `.ts` and `.tsx` extensions, no path aliases (`tests/test-369-ts-erasable-gate.cjs`).

## RULE 8 (ruled 2026-10-03: Next as a per-machine dependency)

The Next standalone output is stripped of its traced `node_modules` tree by `scripts/postbuild.mjs`, and
`server.js` resolves `next`, `react` and `react-dom` from the plugin root's `node_modules`, installed per
machine by the loader like every other dependency. The root `package.json` pins them exactly, equal to
this package's versions (`tests/test-369-walled-manifest.cjs` fails on drift). `tests/test-369-shell-server.cjs`
proves the output has no `node_modules` and runs with only the root's reachable. See 369-BAKEOFF-DECISION.md.
