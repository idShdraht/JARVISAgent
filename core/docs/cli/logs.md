---
summary: "CLI reference for `jarvis logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
title: "logs"
---

# `jarvis logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:

- Logging overview: [Logging](/logging)

## Examples

```bash
jarvis logs
jarvis logs --follow
jarvis logs --json
jarvis logs --limit 500
jarvis logs --local-time
jarvis logs --follow --local-time
```

Use `--local-time` to render timestamps in your local timezone.
