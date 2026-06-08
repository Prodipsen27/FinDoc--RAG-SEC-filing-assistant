# Agent Instructions

This file is the source of truth for any coding agent working in this repo. Read it before touching code.

## Stack

- **Backend:** Node.js + JavaScript/TypeScript + Express
- **Frontend:** Vite + React SPA + TypeScript
- **Database:** Supabase Postgres (users, chats, source documents, chunks)
- **Migrations:** SQL migrations owned by the backend
- **Retrieval:** Supabase `pgvector` + Postgres full-text search
- **Auth:** Supabase Auth
- **Hosting:** Railway (backend service + frontend service)
- **Agent orchestration:** LangChain.js + LangGraph.js
- **LLM + embeddings:** OpenAI

Stack is locked unless explicitly changed. Keep the repo JS/TS-first unless a non-JS exception is truly unavoidable.

## Repo layout

```text
document-copilot/
├── AGENTS.md           # this file
├── README.md
├── data/               # local corpus + download helpers (payloads gitignored)
├── docs/               # specs, briefs, design notes
├── backend/            # Node.js API service (see backend/AGENTS.md)
└── frontend/           # React SPA (see frontend/AGENTS.md)
```

## Dependency policy

**Default: write it yourself. Reach for a library only when the alternative would be non-trivial, error-prone, or reinvention of a standard.** Every dependency is a liability: bundle size, supply-chain risk, and upgrade work.

OK to depend on:

- Things that are genuinely hard to get right (HTTP servers, SQL drivers, parsers, LLM SDKs, auth SDKs).
- The declared stack (Express, LangChain.js, LangGraph.js, React, Vite, Supabase clients, OpenAI SDK, etc.).

Not OK:

- Helper libraries that wrap 5–20 lines of platform APIs.
- Frameworks where a function would do.
- "Nicer API" layers on top of an already-present dependency.

Before adding a runtime dep, answer in the commit message:

1. What exactly does it do that we cannot write in <30 lines of clear code?
2. How often does it get used?
3. What is its maintenance / transitive-dep footprint?

Per-stack specifics live in `backend/AGENTS.md` and `frontend/AGENTS.md`.

## Configuration

A single settings module is the source of truth for environment per service (`backend/src/config.js` or `backend/src/config.ts`, `frontend/src/lib/env.ts`). Do not read `process.env` or `import.meta.env` directly in app code. Do not call dotenv loaders outside the settings module.

Fail fast on startup if required config is missing. No silent fallbacks that hide real config errors.

## Code style (universal)

- **Small, obvious functions.** A 15-line function with clear names beats a three-class abstraction.
- **No premature abstraction.** Three similar lines is better than a badly named base class. Extract when there is a third caller, not a hypothetical one.
- **No error handling for cases that cannot happen.** Trust internal callers and framework guarantees. Validate only at boundaries: HTTP input, external APIs, DB writes, untrusted parsing.
- **No backwards-compat shims** unless explicitly asked for.
- **No feature flags** added speculatively.
- **Comments:** explain *why* when non-obvious, never *what*. Remove stale TODOs.
- **Keep files focused.** Prefer small modules.
