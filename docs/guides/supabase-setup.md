# Supabase setup

We use Supabase for **Postgres** (users, chats, source documents, chunks, embeddings, citations) and **Auth** (email sign-in). You need one hosted Supabase project before wiring up `backend/` and `frontend/`.

## Values to collect

| Value | Where to find it | Used by |
| --- | --- | --- |
| Project URL | Dashboard → Project Settings → API | frontend + backend |
| anon key | Dashboard → Project Settings → API | frontend + backend |
| service role key | Dashboard → Project Settings → API | backend only |
| Project ref | Dashboard URL or `supabase projects list` | CLI commands |
| Direct database connection string | Dashboard → Project Settings → Database | backend migrations + direct DB access |

Keep `service_role` out of git, client bundles, and frontend env files.

## Schema management

Document Copilot manages schema changes from the backend with SQL migrations. Do not create production tables manually in the Supabase dashboard.

Backend migrations create and update:

- the `vector` extension for `pgvector`
- source document and chunk tables
- chat, message, and citation tables
- indexes
- row-level security policies

Use the direct/session database connection string for migrations. Do not use the transaction pooler URL for schema changes.

From `backend/`:

```bash
pnpm db:migrate
```

## Next steps

- `docs/guides/backend-setup.md` — Node.js API service
- `docs/guides/frontend-setup.md` — React app + `@supabase/supabase-js`
