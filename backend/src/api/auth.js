/**
 * Auth API routes.
 */

import { Router } from 'express';
import { requireAuth } from '../auth/dependencies.js';

export const authRouter = Router();

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});
