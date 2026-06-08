/**
 * Express server — entry point for the Document Copilot backend.
 */

import express from 'express';
import cors from 'cors';

import { settings } from './config.js';
import { authRouter } from './api/auth.js';
import { chatRouter } from './api/chat.js';

const app = express();

app.use(cors({ origin: settings.corsOrigins, credentials: true }));
app.use(express.json());

app.use(authRouter);
app.use(chatRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(settings.port, () => {
  console.log(`FinDoc AI backend listening on port ${settings.port}`);

  // Self-ping to prevent Render free tier from sleeping
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
    setInterval(async () => {
      try {
        const res = await fetch(`${renderUrl}/health`);
        console.log(`[Keep-Alive] Pinged self status: ${res.status}`);
      } catch (err) {
        console.error('[Keep-Alive] Self-ping failed:', err.message);
      }
    }, PING_INTERVAL);
    console.log(`[Keep-Alive] Setup self-ping to ${renderUrl} every 14 minutes`);
  }
});
