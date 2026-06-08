/**
 * User record provisioning for Supabase Auth users.
 */

import { getServiceRoleClient } from './supabase.js';

export async function ensureUser(user) {
  const client = getServiceRoleClient();
  await client.from('users').upsert({ id: user.id, email: user.email });
}
