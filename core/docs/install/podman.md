---
summary: "Run JARVIS in a rootless Podman container"
read_when:
  - You want a containerized gateway with Podman instead of Docker
title: "Podman"
---

# Podman

Run the JARVIS gateway in a **rootless** Podman container. Uses the same image as Docker (build from the repo [Dockerfile](https://github.com/jarvis/jarvis/blob/main/Dockerfile)).

## Requirements

- Podman (rootless)
- Sudo for one-time setup (create user, build image)

## Quick start

**1. One-time setup** (from repo root; creates user, builds image, installs launch script):

```bash
./setup-podman.sh
```

This also creates a minimal `~jarvis/.jarvis/jarvis.json` (sets `gateway.mode="local"`) so the gateway can start without running the wizard.

By default the container is **not** installed as a systemd service, you start it manually (see below). For a production-style setup with auto-start and restarts, install it as a systemd Quadlet user service instead:

```bash
./setup-podman.sh --quadlet
```

(Or set `JARVIS_PODMAN_QUADLET=1`; use `--container` to install only the container and launch script.)

**2. Start gateway** (manual, for quick smoke testing):

```bash
./scripts/run-jarvis-podman.sh launch
```

**3. Onboarding wizard** (e.g. to add channels or providers):

```bash
./scripts/run-jarvis-podman.sh launch setup
```

Then open `http://127.0.0.1:18789/` and use the token from `~jarvis/.jarvis/.env` (or the value printed by setup).

## Systemd (Quadlet, optional)

If you ran `./setup-podman.sh --quadlet` (or `JARVIS_PODMAN_QUADLET=1`), a [Podman Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html) unit is installed so the gateway runs as a systemd user service for the jarvis user. The service is enabled and started at the end of setup.

- **Start:** `sudo systemctl --machine jarvis@ --user start jarvis.service`
- **Stop:** `sudo systemctl --machine jarvis@ --user stop jarvis.service`
- **Status:** `sudo systemctl --machine jarvis@ --user status jarvis.service`
- **Logs:** `sudo journalctl --machine jarvis@ --user -u jarvis.service -f`

The quadlet file lives at `~jarvis/.config/containers/systemd/jarvis.container`. To change ports or env, edit that file (or the `.env` it sources), then `sudo systemctl --machine jarvis@ --user daemon-reload` and restart the service. On boot, the service starts automatically if lingering is enabled for jarvis (setup does this when loginctl is available).

To add quadlet **after** an initial setup that did not use it, re-run: `./setup-podman.sh --quadlet`.

## The jarvis user (non-login)

`setup-podman.sh` creates a dedicated system user `jarvis`:

- **Shell:** `nologin` — no interactive login; reduces attack surface.
- **Home:** e.g. `/home/jarvis` — holds `~/.jarvis` (config, workspace) and the launch script `run-jarvis-podman.sh`.
- **Rootless Podman:** The user must have a **subuid** and **subgid** range. Many distros assign these automatically when the user is created. If setup prints a warning, add lines to `/etc/subuid` and `/etc/subgid`:

  ```text
  jarvis:100000:65536
  ```

  Then start the gateway as that user (e.g. from cron or systemd):

  ```bash
  sudo -u jarvis /home/jarvis/run-jarvis-podman.sh
  sudo -u jarvis /home/jarvis/run-jarvis-podman.sh setup
  ```

- **Config:** Only `jarvis` and root can access `/home/jarvis/.jarvis`. To edit config: use the Control UI once the gateway is running, or `sudo -u jarvis $EDITOR /home/jarvis/.jarvis/jarvis.json`.

## Environment and config

- **Token:** Stored in `~jarvis/.jarvis/.env` as `JARVIS_GATEWAY_TOKEN`. `setup-podman.sh` and `run-jarvis-podman.sh` generate it if missing (uses `openssl`, `python3`, or `od`).
- **Optional:** In that `.env` you can set provider keys (e.g. `GROQ_API_KEY`, `OLLAMA_API_KEY`) and other JARVIS env vars.
- **Host ports:** By default the script maps `18789` (gateway) and `18790` (bridge). Override the **host** port mapping with `JARVIS_PODMAN_GATEWAY_HOST_PORT` and `JARVIS_PODMAN_BRIDGE_HOST_PORT` when launching.
- **Gateway bind:** By default, `run-jarvis-podman.sh` starts the gateway with `--bind loopback` for safe local access. To expose on LAN, set `JARVIS_GATEWAY_BIND=lan` and configure `gateway.controlUi.allowedOrigins` (or explicitly enable host-header fallback) in `jarvis.json`.
- **Paths:** Host config and workspace default to `~jarvis/.jarvis` and `~jarvis/.jarvis/workspace`. Override the host paths used by the launch script with `JARVIS_CONFIG_DIR` and `JARVIS_WORKSPACE_DIR`.

## Useful commands

- **Logs:** With quadlet: `sudo journalctl --machine jarvis@ --user -u jarvis.service -f`. With script: `sudo -u jarvis podman logs -f jarvis`
- **Stop:** With quadlet: `sudo systemctl --machine jarvis@ --user stop jarvis.service`. With script: `sudo -u jarvis podman stop jarvis`
- **Start again:** With quadlet: `sudo systemctl --machine jarvis@ --user start jarvis.service`. With script: re-run the launch script or `podman start jarvis`
- **Remove container:** `sudo -u jarvis podman rm -f jarvis` — config and workspace on the host are kept

## Troubleshooting

- **Permission denied (EACCES) on config or auth-profiles:** The container defaults to `--userns=keep-id` and runs as the same uid/gid as the host user running the script. Ensure your host `JARVIS_CONFIG_DIR` and `JARVIS_WORKSPACE_DIR` are owned by that user.
- **Gateway start blocked (missing `gateway.mode=local`):** Ensure `~jarvis/.jarvis/jarvis.json` exists and sets `gateway.mode="local"`. `setup-podman.sh` creates this file if missing.
- **Rootless Podman fails for user jarvis:** Check `/etc/subuid` and `/etc/subgid` contain a line for `jarvis` (e.g. `jarvis:100000:65536`). Add it if missing and restart.
- **Container name in use:** The launch script uses `podman run --replace`, so the existing container is replaced when you start again. To clean up manually: `podman rm -f jarvis`.
- **Script not found when running as jarvis:** Ensure `setup-podman.sh` was run so that `run-jarvis-podman.sh` is copied to jarvis’s home (e.g. `/home/jarvis/run-jarvis-podman.sh`).
- **Quadlet service not found or fails to start:** Run `sudo systemctl --machine jarvis@ --user daemon-reload` after editing the `.container` file. Quadlet requires cgroups v2: `podman info --format '{{.Host.CgroupsVersion}}'` should show `2`.

## Optional: run as your own user

To run the gateway as your normal user (no dedicated jarvis user): build the image, create `~/.jarvis/.env` with `JARVIS_GATEWAY_TOKEN`, and run the container with `--userns=keep-id` and mounts to your `~/.jarvis`. The launch script is designed for the jarvis-user flow; for a single-user setup you can instead run the `podman run` command from the script manually, pointing config and workspace to your home. Recommended for most users: use `setup-podman.sh` and run as the jarvis user so config and process are isolated.
