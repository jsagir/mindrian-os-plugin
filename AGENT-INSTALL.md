# Install MindrianOS (instructions for a coding agent)

You are a coding agent. A person pasted a sentence like this into your chat:

> Read https://mindrian-os.com/install.md and set up MindrianOS for me.

This file is the whole procedure. Follow it in order. Tell the person what each step does before you run it, in one plain sentence. Report each result honestly. If a step fails, stop, say what failed and what it means, and point to Troubleshooting.

MindrianOS is a plugin for Claude Code. It adds Larry, a PwS (Problems worth Solving) thinking partner, and a Data Room, a local folder that keeps what you work out.

---

## 1. Scope: what this install does and does not do

**It changes:**
- Claude Code's plugin list: it adds the `jsagir/mindrian-marketplace` marketplace and installs the plugin `mos@mindrian-marketplace`.
- Files under `~/.claude/` that the plugin and its doctor manage (plugin cache, settings entries for the plugin).
- Only if the person says yes in step 6: the optional Eureka engine (Python packages installed with `uv`).

**It never:**
- Edits the person's project files, repositories or shell profile.
- Sends room content anywhere. Rooms stay on this machine.
- Installs Node, Python, uv or Claude Code silently. If one is missing, you say so and ask first.
- Uses `sudo` unless the person asks you to.

Show this scope to the person in two or three lines and get a yes before step 4.

---

## 2. Find out where you are running

| You are | What to do |
|---|---|
| Claude Code in a terminal | Follow every step below. This is the full install. |
| Claude Desktop or Cowork, with a terminal or the Code tab | Run the same steps in that terminal. Hooks and the status line exist only in Claude Code; say so. |
| Claude Desktop with no terminal | Do not improvise. Tell the person to install Claude Code first (https://claude.com/claude-code), then paste the same sentence there. |
| Codex, Cursor or another agent with a shell | MindrianOS runs inside Claude Code. Use your shell to run steps 3 to 5 (they install the plugin into Claude Code), then tell the person to open Claude Code for step 7. |
| No shell access at all | Stop. Give the person the one command from step 4 to run themselves. |

---

## 3. Check what is installed

Run each check and show the results in a short list.

```bash
node --version     # needs 22.18.0 or newer
claude --version   # Claude Code CLI must be on PATH
```

Only for the optional Eureka engine (step 6):

```bash
uv --version
```

- Node missing or older than 22.18.0: ask the person before installing it (for example with their package manager, `nvm` or https://nodejs.org).
- `claude` missing: ask before installing Claude Code (https://claude.com/claude-code).
- `uv` missing: note it. It matters only if the person wants Eureka.

Do not continue to step 4 until Node and `claude` both pass.

---

## 4. Install the plugin

```bash
npx @mindrian_os/cli --no-eureka
```

This adds the marketplace, installs the plugin and brings it to the current build. `--no-eureka` keeps the optional engine out of this step; step 6 asks about it.

If it fails, the output names the fallback. Inside Claude Code that is:

```
/plugin marketplace add jsagir/mindrian-marketplace
/plugin install mos@mindrian-marketplace
```

---

## 5. Repair and verify

```bash
npx @mindrian_os/cli doctor --fix
npx @mindrian_os/cli doctor
```

The first run repairs what it can. The second run is read-only and is the result you report. Tell the person what passed and what did not, in plain words. Do not say "installed" if the second doctor run reports a failure.

---

## 6. Optional: the Eureka engine

Eureka finds non-obvious connections across a room. It is optional and needs `uv` and Python.

Ask the person: "Do you want the optional Eureka engine now? It installs Python packages with uv. You can add it later." Default is no.

- Yes, and `uv` is present:

  ```bash
  npx @mindrian_os/cli --eureka --yes
  ```

- Yes, but `uv` is missing: ask before installing uv, then run the command above.
- No: say they can add it later inside Claude Code with `/mos:eureka enable engine --setup`.

---

## 7. Hand over

Tell the person:

1. Quit Claude Code and open a fresh session (plugins load at start).
2. At the bottom of the terminal, look for a line that starts with `⬡ MindrianOS`. If it is missing, run `/mos:doctor --fix`.
3. Type `/mos:onboard`. Larry takes it from there.

---

## Troubleshooting

| Symptom | What to do |
|---|---|
| `claude: command not found` | Claude Code is not installed or not on PATH. Install it, open a new terminal, retry step 3. |
| `npx` fails with an engine or version error | Node is older than 22.18.0. Upgrade Node, retry step 4. |
| "already installed" during step 4 | Fine. The installer updates it next. Continue to step 5. |
| Doctor still reports a failure after `--fix` | Report the failing line to the person exactly as printed. Do not patch files by hand. |
| No `⬡ MindrianOS` line after restart | Run `/mos:doctor --fix` inside Claude Code, then restart again. |
| Anything else | Stop and show the person the exact error. Point them to https://mindrian-os.com/docs/install. |

Update later with `npx @mindrian_os/cli update`.
