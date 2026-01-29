---
name: migrate
description: Export and import OpsAgent installations for migration between machines. Use when the user wants to migrate OpsAgent to a new computer, backup their setup, or restore from a backup. Handles workspace files, config, WhatsApp sessions, and optionally credentials.
---

# OpsAgent Migration

Export and import complete OpsAgent installations.

## Export

Create a portable archive of the current installation:

```bash
bash scripts/export.sh
```

Options:
- `--output, -o PATH` — Output directory (default: current)
- `--workspace PATH` — Workspace path (default: ~/clawd)
- `--include-sessions` — Include session transcripts
- `--include-credentials` — Include credentials ⚠️ handle with care

Example:
```bash
bash scripts/export.sh -o /tmp --include-sessions
```

Creates: `opsagent-export-YYYYMMDD_HHMMSS.tar.gz`

## Import

Restore from an export archive on a new machine:

```bash
bash scripts/import.sh <archive.tar.gz>
```

Options:
- `--workspace PATH` — Target workspace (default: ~/clawd)
- `--force, -f` — Overwrite without prompting

Example:
```bash
bash scripts/import.sh opsagent-export-20260129_120000.tar.gz --force
```

## What's Included

| Component | Default | Flag |
|-----------|---------|------|
| Workspace (~/clawd) | ✓ | — |
| Config (opsagent.json) | ✓ | — |
| Managed skills | ✓ | — |
| WhatsApp session | ✓ | — |
| Session transcripts | ✗ | `--include-sessions` |
| Credentials | ✗ | `--include-credentials` |

**Excluded from workspace** (can be rebuilt):
`node_modules/`, `.next/`, `.open-next/`, `.vercel/`, `.wrangler/`, `.git/`, `dist/`, `build/`

## Migration Workflow

1. On old machine:
   ```bash
   bash scripts/export.sh -o ~/Desktop
   ```

2. Transfer archive to new machine (scp, USB, cloud, etc.)

3. On new machine:
   ```bash
   npm install -g opsagent
   bash scripts/import.sh ~/opsagent-export-*.tar.gz
   cd ~/clawd && opsagent gateway start
   ```

WhatsApp session transfers automatically — no re-scan needed.
