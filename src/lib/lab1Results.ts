import type { Lab1Vote } from './storage';
import { OBJECTS } from '../data/objects';

// Підрахунок балів: 1 місце = 3 бали, 2 місце = 2 бали, 3 місце = 1 бал
const SCORES = [3, 2, 1] as const;

export function computeLab1Ranking(votes: Lab1Vote[]): { objectId: number; score: number; rank: number }[] {
  const scores: Record<number, number> = {};
  OBJECTS.forEach((o) => (scores[o.id] = 0));

  for (const vote of votes) {
    vote.ranking.forEach((objId, idx) => {
      scores[objId] = (scores[objId] ?? 0) + SCORES[idx];
    });
  }

  const result = Object.entries(scores)
    .map(([id, score]) => ({ objectId: +id, score, rank: 0 }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  result.forEach((r, i) => (r.rank = i + 1));
  return result;
}
