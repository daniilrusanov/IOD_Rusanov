import type { Lab1Vote } from './storage';
import { HEURISTICS } from '../data/heuristics';

export interface HeuristicScore {
  heuristicId: string;
  count: number;
  rank: number;
}

export function computeHeuristicPopularity(votes: { selectedHeuristics: string[] }[]): HeuristicScore[] {
  const counts: Record<string, number> = {};
  HEURISTICS.forEach((h) => (counts[h.id] = 0));

  for (const vote of votes) {
    for (const hId of vote.selectedHeuristics) {
      if (counts[hId] !== undefined) counts[hId]++;
    }
  }

  const result = Object.entries(counts)
    .map(([id, count]) => ({ heuristicId: id, count, rank: 0 }))
    .sort((a, b) => b.count - a.count);

  result.forEach((r, i) => (r.rank = i + 1));
  return result;
}

// Застосування евристик до об'єктів з ЛР1
export function applyHeuristics(
  votes: Lab1Vote[],
  objectIds: number[],
  _heuristicsToApply: string[],
  maxObjects: number = 10
): number[] {
  if (objectIds.length <= maxObjects) return objectIds;

  // Підрахунок для кожної евристики
  const place1: Record<number, number> = {};
  const place2: Record<number, number> = {};
  const place3: Record<number, number> = {};

  objectIds.forEach((id) => {
    place1[id] = 0;
    place2[id] = 0;
    place3[id] = 0;
  });

  for (const vote of votes) {
    const [first, second, third] = vote.ranking;
    place1[first] = (place1[first] ?? 0) + 1;
    place2[second] = (place2[second] ?? 0) + 1;
    place3[third] = (place3[third] ?? 0) + 1;
  }

  // Сортуємо за підтримкою — залишаємо топ об'єктів
  // Насправді: ті, хто має більше підтримки (place1, place2, place3) - залишаємо
  // Відсікаємо тих, у кого найменша підтримка
  const totalSupport = (objId: number) =>
    (place1[objId] ?? 0) * 3 + (place2[objId] ?? 0) * 2 + (place3[objId] ?? 0) * 1;

  const sorted = [...objectIds].sort((a, b) => totalSupport(b) - totalSupport(a));
  return sorted.slice(0, maxObjects);
}
