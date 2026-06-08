# Todos

## Where to start

Start with the shared foundation, then build thin vertical slices across frontend and backend.

## Phase 0 — Foundation

- [x] Install Node 20+ and `pnpm`
- [x] Create Supabase project and collect credentials
- [x] Create OpenAI API key
- [x] Keep ingestion and retrieval on the JS/TS toolchain

## Phase 1 — Backend scaffold

Goal: a running JS/TS API service with a migrated Supabase schema.

- [x] Standardize the backend package on Node.js JS/TS
- [x] Add `backend/src/config.js`
- [x] Add Express app and `GET /health`
- [x] Add SQL migrations for core tables
- [x] Add Supabase clients
- [x] Verify `pnpm db:migrate`
- [x] Verify `pnpm dev`

## Phase 2 — Auth

Goal: analysts can sign in with email; backend rejects unauthenticated requests.

- [x] Add Supabase auth to the SPA
- [x] Add backend token verification
- [x] Add authenticated test endpoint
- [x] Verify token flows from frontend to backend

## Phase 3 — Chat shell

Goal: end-to-end chat UI streaming from the backend, no real retrieval yet.

- [x] Add chat page and layout
- [x] Add backend chat route with stubbed stream
- [x] Connect SPA chat UI to streaming route

## Phase 4 — Retrieval

Goal: grounded answers come from indexed filing chunks.

- [x] Add source document and chunk ingestion
- [x] Add embeddings write path
- [x] Add pgvector search
- [x] Add Postgres full-text search
- [x] Add result fusion in JS/TS

## Phase 5 — Answer generation

Goal: generate concise answers with citations.

- [x] Build grounded prompt assembly
- [x] Add LangChain.js tools and LangGraph.js agent flow
- [x] Call OpenAI from the backend
- [x] Stream answer parts to the UI
- [x] Persist messages and citations

## Phase 6 — Cleanup

- [x] Remove remaining legacy Python backend directories under `backend/app/`
- [x] Remove Python-only docs and commands
- [x] Verify backend runbooks point to Node.js only

## Phase 7 — Deployment

- [ ] Deploy backend to Railway
- [ ] Deploy frontend to Railway
- [ ] Run production migrations
- [ ] Verify auth, chat, retrieval, and citations
