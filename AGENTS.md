<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent Skills

This project has access to reusable agent skills from multiple sources:

### Local Skills (`C:\Users\Admin\.agents\skills\`)
Core opencode skills for code review, automation, subagents, loops, hooks, and more. Load via `/skill-name` when needed.

### David Ondrej Skills (`vendor/davidondrej-skills/skills/`)
Additional agent skills for orchestration, research, thinking, ops, and skill authoring. Reference the `SKILL.md` in each subfolder before use:
- `agent-orchestration/` - subagents, goal loops, handoffs, git worktrees
- `research-and-web/` - web/YouTube research (DeepAPI powered)
- `thinking-and-docs/` - structured thinking, documentation
- `ops-and-setup/` - server/security setup
- `skill-authoring/` - create/publish new skills

### Pre-Task Check
Before starting any coding task, check available skills in `.agents/skills/` and `vendor/davidondrej-skills/skills/`. Use the most relevant skill for the task.
