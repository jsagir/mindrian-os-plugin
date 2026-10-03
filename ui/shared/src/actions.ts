/*
 * actions.ts -- the shell's action layer and its exposure policy (Phase 369 D-15).
 *
 * Every shell action declares who may call it: `agent`, `human` or `both`. An
 * action without an exposure is refused at definition, never defaulted. The
 * generated 1:1 MCP adapter (src/generated/mcp-adapter.ts) is internal: it is
 * exposed to neither humans nor agents and can never be registered as an
 * action, so a definition tagged `adapter: true`, or named like an adapter
 * wrapper (`mcp.` prefix), is refused.
 *
 * `human` means a call originated by a browser interaction: gate_answer and
 * every truth-claim confirmation are human-only, and a caller-supplied
 * `principal` field is never proof of a human. This module only declares and
 * lists; it holds no HTTP or route logic (the chassis mounts routes, plan 19
 * enforces the origin of each call).
 *
 * Erasable TypeScript only.
 */

export const EXPOSURES = ['agent', 'human', 'both'] as const;

export type Exposure = (typeof EXPOSURES)[number];

export type ShellActionInput = {
  name: string;
  exposure: Exposure;
  input: { safeParse: (value: unknown) => unknown };
  run: (input: unknown, context?: unknown) => unknown;
  adapter?: boolean;
};

export type ShellAction = Readonly<{
  name: string;
  exposure: Exposure;
  input: { safeParse: (value: unknown) => unknown };
  run: (input: unknown, context?: unknown) => unknown;
}>;

function isZodSchema(value: unknown): boolean {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { safeParse?: unknown }).safeParse === 'function' &&
    typeof (value as { parse?: unknown }).parse === 'function'
  );
}

export function defineShellAction(def: ShellActionInput): ShellAction {
  if (!def || typeof def !== 'object') throw new Error('defineShellAction: a definition object is required');
  if (typeof def.name !== 'string' || def.name.trim().length === 0) {
    throw new Error('defineShellAction: name is required');
  }
  if (!(EXPOSURES as readonly unknown[]).includes(def.exposure)) {
    throw new Error(
      'defineShellAction: action "' + def.name + '" must declare exposure as one of ' + EXPOSURES.join(', '),
    );
  }
  if (def.adapter === true || def.name.startsWith('mcp.')) {
    throw new Error('defineShellAction: the generated MCP adapter can never be an action ("' + def.name + '")');
  }
  if (!isZodSchema(def.input)) {
    throw new Error('defineShellAction: action "' + def.name + '" needs a zod input schema');
  }
  if (typeof def.run !== 'function') {
    throw new Error('defineShellAction: action "' + def.name + '" needs a run function');
  }
  return Object.freeze({ name: def.name, exposure: def.exposure, input: def.input, run: def.run });
}

export function createActionRegistry() {
  const actions = new Map<string, ShellAction>();
  return {
    register(def: ShellAction): ShellAction {
      // A registry only holds what defineShellAction produced: a hand-built
      // object would bypass the exposure check.
      if (!def || !Object.isFrozen(def) || !(EXPOSURES as readonly unknown[]).includes(def.exposure)) {
        throw new Error('register: only a definition from defineShellAction is accepted');
      }
      if (actions.has(def.name)) throw new Error('register: duplicate action "' + def.name + '"');
      actions.set(def.name, def);
      return def;
    },
    list(): ShellAction[] {
      return Array.from(actions.values());
    },
    get(name: string): ShellAction | undefined {
      return actions.get(name);
    },
    callableBy(kind: 'human' | 'agent'): ShellAction[] {
      if (kind !== 'human' && kind !== 'agent') throw new Error('callableBy: kind must be human or agent');
      return Array.from(actions.values()).filter((a) => a.exposure === kind || a.exposure === 'both');
    },
    assertAllDeclared(): void {
      for (const a of actions.values()) {
        if (!(EXPOSURES as readonly unknown[]).includes(a.exposure)) {
          throw new Error('action "' + a.name + '" has no declared exposure');
        }
      }
    },
  };
}
