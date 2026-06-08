# Backend setup

This project uses a separate Node.js backend because the server owns AI work, retrieval, document processing, auth checks, and persistence. Keep the backend in JS/TS. Prefer LangChain.js + LangGraph.js for the agent layer. Do not add non-JS service code unless there is a hard technical blocker.

## Init (from empty `backend/`)

```bash
cd backend
pnpm init
pnpm add express cors @supabase/supabase-js openai pg zod @langchain/core @langchain/openai @langchain/langgraph
pnpm add -D eslint
```

## Database migrations

Backend schema changes are owned as SQL migration files in `backend/migrations/`.

Suggested flow:

```bash
cd backend
pnpm db:create add-document-tables
pnpm db:migrate
```

Rules:

- Keep migrations as plain SQL.
- Use the direct Supabase database connection for migrations.
- Do not treat the Supabase dashboard as the schema source of truth.

## Project shape

```text
backend/
├── src/
│   ├── api/
│   ├── auth/
│   ├── assistant/
│   ├── chat/
│   ├── db/
│   ├── ingest/
│   ├── retrieval/
│   └── config.js
├── migrations/
└── package.json
```

## Local run

```bash
cd backend
pnpm install
pnpm db:migrate
pnpm dev
```

Preferred API server command:

```bash
cd backend
pnpm dev
```

## Data helpers

Keep ingestion and retrieval helpers in the JS toolchain as well:

```bash
pnpm data:download
pnpm data:convert
pnpm ingest:load
pnpm ingest:embed --all
```

## Agent layer

Keep answer generation in JS as well:

- LangChain.js tools for retrieval-backed actions
- LangGraph.js for the tool-calling loop
- Zod for backend-side structured output validation
