@AGENTS.md

# Claude Code only

- `.claude/settings.json` runs `node scripts/session-check.mjs start --hook` at session start and puts its report in context. If it says NOT OK, resolve that first (AGENTS.md rule 2). Codex has no such hook: it runs the command itself.
