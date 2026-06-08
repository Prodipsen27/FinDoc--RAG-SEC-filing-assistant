import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

async function check() {
  const isSupabase = connectionString.includes('supabase.com') || connectionString.includes('supabase.co');
  if (isSupabase) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB successfully');
    
    const countRes = await client.query('SELECT COUNT(*) FROM document_chunks');
    console.log('Number of rows in document_chunks:', countRes.rows[0].count);
    
    const docCountRes = await client.query('SELECT COUNT(*) FROM source_documents');
    console.log('Number of rows in source_documents:', docCountRes.rows[0].count);
  } catch (err) {
    console.error('DB check failed:', err);
  } finally {
    await client.end();
  }
}

check();
