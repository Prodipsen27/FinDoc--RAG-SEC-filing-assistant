/**
 * Supabase client construction for server-side database and auth access.
 */

import { createClient } from '@supabase/supabase-js';
import { settings } from '../config.js';

/** Shared service-role client — bypasses RLS. Backend-only. */
let _serviceRoleClient = null;

export function getServiceRoleClient() {
  if (!_serviceRoleClient) {
    _serviceRoleClient = createClient(
      settings.supabaseUrl,
      settings.supabaseServiceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return _serviceRoleClient;
}

/** Request-scoped client that enforces RLS for the authenticated user. */
export function createUserClient(accessToken) {
  return createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
