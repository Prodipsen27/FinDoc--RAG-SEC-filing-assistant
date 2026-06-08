/**
 * Reciprocal Rank Fusion for hybrid retrieval.
 */

export function reciprocalRankFusion(rankings, k = 60) {
  const scores = new Map();
  for (const ranking of rankings) {
    for (let i = 0; i < ranking.length; i++) {
      const chunkId = ranking[i];
      const prev = scores.get(chunkId) || 0;
      scores.set(chunkId, prev + 1.0 / (k + i + 1));
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chunkId, score]) => ({ chunkId, score }));
}
