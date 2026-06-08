/**
 * Raw Postgres pool for retrieval queries (pgvector + FTS).
 * Supabase JS client can't run arbitrary SQL with vector casts,
 * so retrieval uses pg directly.
 */

import pg from 'pg';
import { settings } from '../config.js';

const { Pool } = pg;

let _pool = null;

export function getPool() {
  if (!_pool) {
    const isSupabase = settings.databaseUrl.includes('supabase.com') || settings.databaseUrl.includes('supabase.co');
    if (isSupabase) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    _pool = new Pool({
      connectionString: settings.databaseUrl,
    });
  }
  return _pool;
}
