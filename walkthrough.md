# Document Copilot JS Stack Walkthrough

## Goal

Keep the product on a full JavaScript / TypeScript stack:

- `backend/` owns the API, retrieval, ingestion, and OpenAI calls
- `frontend/` stays a thin React SPA
- Supabase owns auth and persistence
- LangChain.js and LangGraph.js own the backend agent loop

## Backend shape

- Node.js + JavaScript/TypeScript
- Express for HTTP
- `@supabase/supabase-js` for Supabase access
- `pg` for direct retrieval queries
- LangChain.js + LangGraph.js for orchestration
- OpenAI Node SDK for embeddings and answer generation
- backend-owned SQL migrations

## Frontend shape

- Vite + React + TypeScript
- Supabase browser auth
- shared API client pointed at `VITE_API_BASE_URL`
- chat UI, citations, and source display

## Retrieval path

1. embed the user query
2. run vector search
3. run full-text search
4. fuse the ranked results in backend JS/TS
5. send bounded context to the model
6. validate citations before persisting

## Run locally

```bash
cd backend
pnpm install
pnpm db:migrate
pnpm dev
```

```bash
cd frontend
pnpm install
pnpm dev
```
