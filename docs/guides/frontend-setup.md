# Frontend setup

This project uses a Vite + React SPA because the frontend is an internal tool that mainly needs fast iteration, authenticated app flows, and a clean connection to the TypeScript backend. We do not need Next.js, SSR, or full-stack routing.

## Init (from empty `frontend/`)

```bash
cd frontend
pnpm create vite . --template react-ts
pnpm install
```

## UI baseline

```bash
cd frontend
pnpm add react-router-dom @supabase/supabase-js
```

Keep the frontend thin:

- auth session in the browser
- API calls to the backend
- chat UI, citations, and source display
- no direct OpenAI calls
- no privileged Supabase access
