/*
 * config.ts -- the shell server's one config source (plan 369-19, D-08).
 *
 * Reads and validates the environment once. Every later shell plan reads its
 * settings from here, never from process.env directly.
 *
 *   MOS_DAEMON_URL                 required; an http://127.0.0.1:<port> URL. Any other host
 *                                  is refused (Canon Part 8: the server contacts only loopback).
 *   MOS_SHELL_PORT                 default 3369: clear of the daemon's ephemeral port and of the
 *                                  bake-off's 8091 and 8092, with "369" naming the phase. The
 *                                  launcher's --port and this variable override it.
 *   MOS_SHELL_BOOTSTRAP_SHA256     optional at start; the sha256 (hex) of the one-time sign-in code.
 *   MOS_SHELL_CONTROL_TOKEN_FILE   default ~/.mindrian/ui-shell/control.token
 *   MOS_PROPOSAL_SOURCE            fixed (default) or adapter (369-ADAPTER-RULING.md); read here so
 *                                  plan 369-32 has one config source.
 *
 * Framework-free erasable TypeScript: Node strips the types, nothing here knows Next.
 */
import { homedir } from 'node:os';
import { join } from 'node:path';

export type ProposalSourceKind = 'fixed' | 'adapter';

export type ShellConfig = {
  daemonUrl: string;
  port: number;
  bootstrapSha256: string | null;
  controlTokenFile: string;
  proposalSource: ProposalSourceKind;
};

export const DEFAULT_SHELL_PORT = 3369;

type Env = Record<string, string | undefined>;

export class ConfigError extends Error {}

export function loadConfig(env: Env = process.env): ShellConfig {
  const rawDaemon = env['MOS_DAEMON_URL'];
  if (!rawDaemon) throw new ConfigError('MOS_DAEMON_URL is required (an http://127.0.0.1:<port> URL)');
  let daemon: URL;
  try {
    daemon = new URL(rawDaemon);
  } catch {
    throw new ConfigError('MOS_DAEMON_URL is not a URL');
  }
  if (daemon.protocol !== 'http:' || daemon.hostname !== '127.0.0.1') {
    throw new ConfigError('MOS_DAEMON_URL must be http://127.0.0.1:<port>; the shell contacts no other host');
  }

  const rawPort = env['MOS_SHELL_PORT'];
  let port = DEFAULT_SHELL_PORT;
  if (rawPort !== undefined && rawPort !== '') {
    port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError('MOS_SHELL_PORT must be an integer from 1 to 65535');
  }

  const rawSha = env['MOS_SHELL_BOOTSTRAP_SHA256'];
  let bootstrapSha256: string | null = null;
  if (rawSha) {
    if (!/^[0-9a-f]{64}$/i.test(rawSha)) throw new ConfigError('MOS_SHELL_BOOTSTRAP_SHA256 must be 64 hex characters');
    bootstrapSha256 = rawSha.toLowerCase();
  }

  const controlTokenFile = env['MOS_SHELL_CONTROL_TOKEN_FILE'] || join(homedir(), '.mindrian', 'ui-shell', 'control.token');

  const rawSource = env['MOS_PROPOSAL_SOURCE'] || 'fixed';
  if (rawSource !== 'fixed' && rawSource !== 'adapter') throw new ConfigError('MOS_PROPOSAL_SOURCE must be fixed or adapter');

  return {
    daemonUrl: daemon.origin,
    port,
    bootstrapSha256,
    controlTokenFile,
    proposalSource: rawSource,
  };
}

// Env is read once per process. The globalThis slot is shared by the proxy, the
// route handlers and the pages, which the chassis bundles separately.
const SLOT = Symbol.for('mos.shell.config');

export function getConfig(): ShellConfig {
  const g = globalThis as Record<symbol, unknown>;
  if (!g[SLOT]) g[SLOT] = loadConfig();
  return g[SLOT] as ShellConfig;
}
