---
summary: "CLI reference for `jarvis daemon` (legacy alias for gateway service management)"
read_when:
  - You still use `jarvis daemon ...` in scripts
  - You need service lifecycle commands (install/start/stop/restart/status)
title: "daemon"
---

# `jarvis daemon`

Legacy alias for Gateway service management commands.

`jarvis daemon ...` maps to the same service control surface as `jarvis gateway ...` service commands.

## Usage

```bash
jarvis daemon status
jarvis daemon install
jarvis daemon start
jarvis daemon stop
jarvis daemon restart
jarvis daemon uninstall
```

## Subcommands

- `status`: show service install state and probe Gateway health
- `install`: install service (`launchd`/`systemd`/`schtasks`)
- `uninstall`: remove service
- `start`: start service
- `stop`: stop service
- `restart`: restart service

## Common options

- `status`: `--url`, `--token`, `--password`, `--timeout`, `--no-probe`, `--deep`, `--json`
- `install`: `--port`, `--runtime <node|bun>`, `--token`, `--force`, `--json`
- lifecycle (`uninstall|start|stop|restart`): `--json`

## Prefer

Use [`jarvis gateway`](/cli/gateway) for current docs and examples.
