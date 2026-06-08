# Backend — agent notes

This is the Node.js API service for Document Copilot. Read `../AGENTS.md` first. This file adds backend-specific conventions.

## Stack

- **Node.js + JavaScript/TypeScript**. Do not introduce non-JS service workflows unless absolutely required.
- **Express** for HTTP.
- **`@supabase/supabase-js`** for Supabase access.
- **`pg`** for direct Postgres queries where needed.
- **LangChain.js + LangGraph.js** for tool-calling agent orchestration.
- **OpenAI Node SDK** for generation and embeddings.
- **Plain SQL migrations** owned in the backend repo.

## Package manager

**`pnpm` only.** Do not use `npm install` or `yarn add`.

## Dependency policy

- **HTTP:** use Express and native `fetch` for outbound calls unless a stronger client is justified.
- **Database:** prefer plain SQL and focused query helpers over adding an ORM.
- **Validation:** validate request boundaries; do not add schema layers everywhere.
- **Logging:** keep it simple and structured.

Before adding a package, check:

1. Can Node or JS/TS handle this directly?
2. Can a small local helper do it clearly?
3. Is the dependency worth its maintenance cost?

## Layout

```text
backend/
├── src/
│   ├── api/             # Express routes
│   ├── auth/            # Supabase token verification
│   ├── assistant/       # LangChain/LangGraph agent orchestration
│   ├── chat/            # chat orchestration and streaming
│   ├── retrieval/       # pgvector + full-text retrieval
│   ├── db/              # SQL helpers and migrations runner
│   ├── ingest/          # document ingestion and embedding jobs
│   └── config.js        # validated env settings
├── migrations/          # SQL migration files
└── package.json
```

## Configuration

- All env reads go through `src/config.js` or `src/config.ts`.
- Do not read `process.env` directly in routes or services.
- Required env must fail at startup, not later at request time.

## Testing

- Prefer focused checks first.
- Keep tests close to behavior that can regress.
- Do not add heavyweight infrastructure unless the project already uses it.
