import { DocumentRetriever } from '../src/retrieval/retriever.js';
import { formatPassagesForAgent } from '../src/retrieval/types.js';
import { closePool } from './_shared.js';

const query =
  process.argv.slice(2).join(' ').trim() || 'What are the main business segments for Apple?';

async function main() {
  const retriever = new DocumentRetriever();
  const passages = await retriever.search(query);
  console.log(formatPassagesForAgent(passages));
}

main()
  .catch((error) => {
    console.error('Retrieval smoke test failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
