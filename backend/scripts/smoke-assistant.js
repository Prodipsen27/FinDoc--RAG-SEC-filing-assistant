import { runDocumentAgent, TurnRegistry } from '../src/assistant/agent.js';
import { validateGrounding } from '../src/grounding/validator.js';
import { DocumentRetriever } from '../src/retrieval/retriever.js';
import { closePool } from './_shared.js';

const query =
  process.argv.slice(2).join(' ').trim() ||
  'Summarize Apple’s business and cite the filing sections you used.';

async function main() {
  const registry = new TurnRegistry();
  const answer = await runDocumentAgent(query, {
    retriever: new DocumentRetriever(),
    registry,
    onStatus: (stage, message) => {
      console.log(`[${stage}] ${message}`);
    },
  });

  const validation = await validateGrounding(answer, registry);
  console.log(JSON.stringify({ answer, validation }, null, 2));
}

main()
  .catch((error) => {
    console.error('Assistant smoke test failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
