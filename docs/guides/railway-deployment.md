# Railway deployment

This repo deploys to Railway as two services from one project:

- `document-copilot-backend` from `backend/` — Node.js + Express + LangChain/LangGraph
- `document-copilot-frontend` from `frontend/` — Vite React build

## Backend service

1. Create a Railway project from this repo.
2. Add a service named `document-copilot-backend`.
3. Set root directory to `backend`.
4. Add variables:

```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
OPENAI_API_KEY=...
ALLOWED_ORIGINS=https://your-frontend.up.railway.app
PORT=3000
```

5. Run migrations before or during first deploy:

```bash
pnpm db:migrate
```

6. Verify:

```text
https://your-backend.up.railway.app/health
```

## Frontend service

1. Add a service named `document-copilot-frontend`.
2. Set root directory to `frontend`.
3. Add variables:

```bash
VITE_API_BASE_URL=https://your-backend.up.railway.app
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. Deploy and verify:

```text
https://your-frontend.up.railway.app/health
```

## Notes

- Do not set `PORT` on the frontend unless the chosen static host requires it.
- Redeploy the frontend after changing `VITE_*` variables.
- Keep the backend stateless; persistence stays in Supabase.
- Run ingestion as backend jobs, not from the browser.
