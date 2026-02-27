---
summary: "CLI reference for `jarvis devices` (device pairing + token rotation/revocation)"
read_when:
  - You are approving device pairing requests
  - You need to rotate or revoke device tokens
title: "devices"
---

# `jarvis devices`

Manage device pairing requests and device-scoped tokens.

## Commands

### `jarvis devices list`

List pending pairing requests and paired devices.

```
jarvis devices list
jarvis devices list --json
```

### `jarvis devices remove <deviceId>`

Remove one paired device entry.

```
jarvis devices remove <deviceId>
jarvis devices remove <deviceId> --json
```

### `jarvis devices clear --yes [--pending]`

Clear paired devices in bulk.

```
jarvis devices clear --yes
jarvis devices clear --yes --pending
jarvis devices clear --yes --pending --json
```

### `jarvis devices approve [requestId] [--latest]`

Approve a pending device pairing request. If `requestId` is omitted, JARVIS
automatically approves the most recent pending request.

```
jarvis devices approve
jarvis devices approve <requestId>
jarvis devices approve --latest
```

### `jarvis devices reject <requestId>`

Reject a pending device pairing request.

```
jarvis devices reject <requestId>
```

### `jarvis devices rotate --device <id> --role <role> [--scope <scope...>]`

Rotate a device token for a specific role (optionally updating scopes).

```
jarvis devices rotate --device <deviceId> --role operator --scope operator.read --scope operator.write
```

### `jarvis devices revoke --device <id> --role <role>`

Revoke a device token for a specific role.

```
jarvis devices revoke --device <deviceId> --role node
```

## Common options

- `--url <url>`: Gateway WebSocket URL (defaults to `gateway.remote.url` when configured).
- `--token <token>`: Gateway token (if required).
- `--password <password>`: Gateway password (password auth).
- `--timeout <ms>`: RPC timeout.
- `--json`: JSON output (recommended for scripting).

Note: when you set `--url`, the CLI does not fall back to config or environment credentials.
Pass `--token` or `--password` explicitly. Missing explicit credentials is an error.

## Notes

- Token rotation returns a new token (sensitive). Treat it like a secret.
- These commands require `operator.pairing` (or `operator.admin`) scope.
- `devices clear` is intentionally gated by `--yes`.
- If pairing scope is unavailable on local loopback (and no explicit `--url` is passed), list/approve can use a local pairing fallback.
