import pg from 'pg';

const regions = [
  'ap-southeast-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-central-1', 'eu-west-1', 'ap-south-1', 'ca-central-1', 'sa-east-1',
  'ap-southeast-2'
];

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  // Let's try port 6543 first, then 5432
  for (const port of [6543, 5432]) {
    const connectionString = `postgresql://postgres.qxqjkgompxiwnqdnjctr:Zxpr27sen123@${host}:${port}/postgres`;
    const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      console.log(`SUCCESS: Connected to ${host}:${port}`);
      await client.end();
      return { region, port, connectionString };
    } catch (err) {
      console.log(`FAILED: ${host}:${port} - ${err.message}`);
    }
  }
  return null;
}

async function main() {
  for (const region of regions) {
    const res = await testRegion(region);
    if (res) {
      console.log('FOUND WORKING CONNECTION STRING:', res.connectionString);
      break;
    }
  }
}

main();
