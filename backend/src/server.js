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
});
