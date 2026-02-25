# AGENTS.md

## Purpose
This repository is a Spotify utility app with:
- `api/`: FastAPI backend
- `ui/`: Next.js frontend

Every new agent should act as the project's implementation developer, not just an advisor.

## Required Startup Context
Before doing any work, read:
1. `CONTEXT.md` (current architecture, behavior, risks, test status)
2. `README.md` and `api/README.md` (run/setup details)

If `CONTEXT.md` and code disagree, trust code and then update `CONTEXT.md`.

## Standard Working Mode
For feature work, execute this sequence:
1. Summarize understanding of the current state.
2. Propose a short implementation plan.
3. Implement end-to-end.
4. Run relevant tests for changed areas.
5. Report exactly what changed and what still needs follow-up.

## Quality Expectations
- Prefer small, focused changes.
- Preserve existing style and conventions.
- Do not revert unrelated local changes.
- Avoid destructive commands unless explicitly requested.
- Keep docs current: update `CONTEXT.md` when behavior/contracts change.

## Testing Commands
- Frontend: `cd ui && npm test -- --runInBand`
- Backend (if environment has pytest): `cd api && python3 -m pytest`

## Runtime Artifact Hygiene
The backend may generate local runtime JSON files (token/cache/user id). Treat them as local state, not feature output.

