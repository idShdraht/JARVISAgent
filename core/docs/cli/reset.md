---
summary: "CLI reference for `jarvis reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
title: "reset"
---

# `jarvis reset`

Reset local config/state (keeps the CLI installed).

```bash
jarvis reset
jarvis reset --dry-run
jarvis reset --scope config+creds+sessions --yes --non-interactive
```
