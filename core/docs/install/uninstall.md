---
summary: "Uninstall JARVIS completely (CLI, service, state, workspace)"
read_when:
  - You want to remove JARVIS from a machine
  - The gateway service is still running after uninstall
title: "Uninstall"
---

# Uninstall

Two paths:

- **Easy path** if `jarvis` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
jarvis uninstall
```

Non-interactive (automation / npx):

```bash
jarvis uninstall --all --yes --non-interactive
npx -y jarvis uninstall --all --yes --non-interactive
```

Manual steps (same result):

1. Stop the gateway service:

```bash
jarvis gateway stop
```

2. Uninstall the gateway service (launchd/systemd/schtasks):

```bash
jarvis gateway uninstall
```

3. Delete state + config:

```bash
rm -rf "${JARVIS_STATE_DIR:-$HOME/.jarvis}"
```

If you set `JARVIS_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4. Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.jarvis/workspace
```

5. Remove the CLI install (pick the one you used):

```bash
npm rm -g jarvis
pnpm remove -g jarvis
bun remove -g jarvis
```

6. If you installed the macOS app:

```bash
rm -rf /Applications/JARVIS.app
```

Notes:

- If you used profiles (`--profile` / `JARVIS_PROFILE`), repeat step 3 for each state dir (defaults are `~/.jarvis-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `jarvis` is missing.

### macOS (launchd)

Default label is `ai.jarvis.gateway` (or `ai.jarvis.<profile>`; legacy `com.jarvis.*` may still exist):

```bash
launchctl bootout gui/$UID/ai.jarvis.gateway
rm -f ~/Library/LaunchAgents/ai.jarvis.gateway.plist
```

If you used a profile, replace the label and plist name with `ai.jarvis.<profile>`. Remove any legacy `com.jarvis.*` plists if present.

### Linux (systemd user unit)

Default unit name is `jarvis-gateway.service` (or `jarvis-gateway-<profile>.service`):

```bash
systemctl --user disable --now jarvis-gateway.service
rm -f ~/.config/systemd/user/jarvis-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `JARVIS Gateway` (or `JARVIS Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "JARVIS Gateway"
Remove-Item -Force "$env:USERPROFILE\.jarvis\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.jarvis-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://jarvis.ai/install.sh` or `install.ps1`, the CLI was installed with `npm install -g jarvis@latest`.
Remove it with `npm rm -g jarvis` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `jarvis ...` / `bun run jarvis ...`):

1. Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2. Delete the repo directory.
3. Remove state + workspace as shown above.
