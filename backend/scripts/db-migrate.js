import fs from 'fs';

import { closePool, getPoolClient, getSchemaPath } from './_shared.js';

async function main() {
  const sql = fs.readFileSync(getSchemaPath(), 'utf-8');
  const pool = getPoolClient();

  await pool.query(sql);
  console.log('Applied schema.sql successfully.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
