# Install MindrianOS (instructions for a coding agent)

You are a coding agent. A person pasted a sentence like this into your chat:

> Read https://mindrian-os.com/install.md and set up MindrianOS for me.

## Stop here if you cannot run commands

If you are ChatGPT, Gemini, or any chat assistant that cannot run commands on this computer: you cannot install MindrianOS, and it does not run inside your app. Do not propose to build an integration, a connector, an MCP server, a custom GPT or an action for MindrianOS. Do not ask for the person's files or notes.

Say exactly this to the person, then stop:

> MindrianOS is a plugin for Claude, so I can't install it here, and it doesn't run inside this app. You have two ways to get it:
>
> 1. **Claude Desktop:** open the plugin settings, choose Add marketplace, enter `jsagir/mindrian-marketplace`, and install MindrianOS.
> 2. **Claude Code:** it needs a paid Claude plan (Pro, Max, Ultra, Team or Enterprise) or a Console account. Install it from https://code.claude.com/docs/en/setup, then paste the same sentence you gave me into Claude Code. It will do the rest.
>
> Full steps: https://mindrian-os.com/docs/install

If you can run commands, continue below.

---

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
| Claude Desktop (Chat, Cowork or the Code tab) | Use the Desktop path in section 2a. No terminal is needed. You cannot click the app for the person, so give them the steps and wait. |
| Codex, Cursor or another agent with a shell | MindrianOS runs inside Claude Code. If `claude` is missing, use section 2b (with a yes). Then run steps 3 to 5 in your shell and tell the person to open Claude Code for step 7. |
| ChatGPT, Gemini, or any chat with no shell | Use the block "Stop here if you cannot run commands" at the top of this file. Say its words, then stop. |
| No shell access at all | Stop. Give the person the Desktop path (section 2a) or the commands from sections 2b and 4 to run themselves. |

### 2a. Claude Desktop path (no terminal)

Give the person these steps:

1. Open Claude Desktop and go to **Customize > Plugins**.
2. Choose **Add marketplace** and enter `jsagir/mindrian-marketplace`.
3. Install **MindrianOS** (the `mos-desktop` entry). In Claude Code, install `mos` instead, as in step 4.
4. Larry and the room tools work in **Cowork** and in the **Code tab**. **Chat** gets the skills and commands only. Hooks and the status line exist only in Claude Code.
5. On first use the plugin installs its own packages once. A short "installing" answer is normal; ask again after it finishes.

Skip steps 3 to 6 on this path. Go to step 7 and use `/mos:onboard` in Cowork or the Code tab.

### 2b. No Claude Code yet

Claude Code needs a paid Claude plan (Pro, Max, Ultra, Team, Enterprise) or a Console (API) account. The free claude.ai plan does not include it. Tell the person this before you install anything.

After a yes, run the official installer for their system (source: https://code.claude.com/docs/en/setup):

```bash
# macOS, Linux, WSL
curl -fsSL https://claude.ai/install.sh | bash
```

```powershell
# Windows PowerShell
irm https://claude.ai/install.ps1 | iex
```

```bat
:: Windows CMD
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

Then open a new terminal and run `claude --version`. If `claude` is not found, the install folder is not on PATH yet; see https://code.claude.com/docs/en/troubleshoot-install. The person must run `claude` once and log in through the browser. You cannot do the login for them. Then continue with step 3.

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
- `claude` missing: go to section 2b. Ask before you install it.
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
| Claude Desktop says "Marketplace sync failed" when you add `jsagir/mindrian-marketplace` | It is often already added: Desktop shares the plugin list of Claude Code on the same computer. Run `claude plugin marketplace list`, or look in the plugin list in Desktop. If it is there, sync it and install MindrianOS from it. Do not add it again. |
| No `⬡ MindrianOS` line after restart | Run `/mos:doctor --fix` inside Claude Code, then restart again. |
| Anything else | Stop and show the person the exact error. Point them to https://mindrian-os.com/docs/install. |

Update later with `npx @mindrian_os/cli update`.
