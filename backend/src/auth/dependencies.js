/**
 * Auth middleware: extract Supabase JWT, verify with Supabase Auth, attach user.
 */

import { createClient } from '@supabase/supabase-js';
import { settings } from '../config.js';

/**
 * Express middleware that verifies the Supabase Bearer token.
 * Attaches `req.user` ({ id, email }) and `req.accessToken` on success.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  try {
    const client = createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.email) {
      return res.status(401).json({ detail: 'Invalid or expired token' });
    }

    req.user = { id: data.user.id, email: data.user.email };
    req.accessToken = token;
    next();
  } catch {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }
}
