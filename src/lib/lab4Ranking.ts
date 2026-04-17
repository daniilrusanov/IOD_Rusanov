import type { Lab1Vote } from './storage';
import { computeLab1Ranking } from './lab1Results';
import {
  bruteForceMedians,
  bruteForceMediansPartial,
  cookDistanceOneExpert,
  mergeMedianResults,
  ranksFromPermutation,
  runGeneticAlgorithm,
  type GaObjective,
  type GaResult,
  type MedianResult,
} from './lab3Ranking';

/** Розбиття масиву на numChunks послідовних підмасивів (рівномірне навантаження). */
export function splitIntoContiguousChunks<T>(arr: T[], numChunks: number): T[][] {
  if (arr.length === 0) return [];
  const k = Math.max(1, Math.min(numChunks, arr.length));
  const chunks: T[][] = [];
  const n = arr.length;
  const base = Math.floor(n / k);
  const rem = n % k;
  let start = 0;
  for (let i = 0; i < k; i++) {
    const len = base + (i < rem ? 1 : 0);
    if (len > 0) {
      chunks.push(arr.slice(start, start + len));
      start += len;
    }
  }
  return chunks.length > 0 ? chunks : [arr];
}

export function getLab1TopObjectIds(lab1Votes: Lab1Vote[], limit: number): number[] {
  return computeLab1Ranking(lab1Votes)
    .slice(0, limit)
    .map((r) => r.objectId);
}

/** Об'єкти з кандидатного списку, відсічені евристиками (немає у фінальній підмножині). */
export function getRemovedByHeuristics(candidateIds: number[], finalIds: number[]): number[] {
  const final = new Set(finalIds);
  return candidateIds.filter((id) => !final.has(id));
}

/**
 * Індекс задоволеності (%), за методичкою ЛР4:
 * s_j = 100 · (1 − d_j / (3(n−3))), n — кількість об'єктів у компромісному ранжуванні.
 */
export function satisfactionIndexPercent(d: number, n: number): number {
  if (n <= 3) return d === 0 ? 100 : 0;
  const denom = 3 * (n - 3);
  const s = 100 * (1 - d / denom);
  return Math.max(0, Math.min(100, s));
}

export interface ExpertSatisfactionRow {
  expertIndex: number;
  voterName: string;
  rankingGlob: [number, number, number];
  distanceD: number;
  satisfactionPercent: number;
}

/**
 * Відстань d_j і індекс задоволеності для кожного бюлетеня (порядок як у votesFiltered і triplesLocal).
 */
export function buildExpertSatisfactionTable(
  votesFiltered: Lab1Vote[],
  triplesLocal: [number, number, number][],
  n: number,
  chosenPerm: number[]
): ExpertSatisfactionRow[] {
  const ranks = ranksFromPermutation(chosenPerm);
  const rows: ExpertSatisfactionRow[] = [];
  const m = Math.min(votesFiltered.length, triplesLocal.length);
  for (let j = 0; j < m; j++) {
    const triple = triplesLocal[j];
    const vote = votesFiltered[j];
    const d = cookDistanceOneExpert(ranks, triple);
    rows.push({
      expertIndex: j + 1,
      voterName: vote.voterName,
      rankingGlob: vote.ranking,
      distanceD: d,
      satisfactionPercent: satisfactionIndexPercent(d, n),
    });
  }
  return rows;
}

/** Голоси ЛР1, де хоча б один об'єкт не увійшов до фінальної підмножини (виключені з перебору). */
export function getVotesExcludedFromFinalSubset(lab1Votes: Lab1Vote[], finalObjectIds: number[]): Lab1Vote[] {
  const f = new Set(finalObjectIds);
  return lab1Votes.filter((v) => v.ranking.some((id) => !f.has(id)));
}

export function medianCriteriaMatch(a: MedianResult, b: MedianResult): boolean {
  return a.minSum === b.minSum && a.minMax === b.minMax;
}

export function timedBruteForceCentralized(
  triples: [number, number, number][],
  n: number
): { result: MedianResult; timeMs: number } {
  const t0 = performance.now();
  const result = bruteForceMedians(triples, n);
  return { result, timeMs: performance.now() - t0 };
}

/** «Розподілений» перебір у головному потоці: Promise.all по частинах (декомпозиція за perm[0]). */
export async function timedBruteForceDistributedMainThread(
  triples: [number, number, number][],
  n: number,
  parallelChunks: number
): Promise<{ result: MedianResult; timeMs: number }> {
  const firstVals = Array.from({ length: n }, (_, i) => i);
  const chunks = splitIntoContiguousChunks(firstVals, Math.max(1, parallelChunks));
  const t0 = performance.now();
  const parts = await Promise.all(
    chunks.map((firstValues) => Promise.resolve(bruteForceMediansPartial(triples, n, firstValues)))
  );
  const result = mergeMedianResults(parts);
  return { result, timeMs: performance.now() - t0 };
}

export interface IslandGaOptions {
  islands: number;
  populationSize: number;
  generations: number;
  mutationRate: number;
  baseSeed: number;
}

/** Кілька незалежних запусків ГА (острівці) — імітація розподіленого пошуку; повертається найкраще. */
export function runGeneticAlgorithmIslands(
  triples: [number, number, number][],
  n: number,
  objective: GaObjective,
  options: IslandGaOptions
): GaResult & { timeMs: number; islandResults: GaResult[] } {
  const t0 = performance.now();
  const islandResults: GaResult[] = [];
  for (let i = 0; i < options.islands; i++) {
    islandResults.push(
      runGeneticAlgorithm(triples, n, objective, {
        populationSize: options.populationSize,
        generations: options.generations,
        mutationRate: options.mutationRate,
        seed: options.baseSeed + i * 7919,
      })
    );
  }
  let best = islandResults[0];
  for (const r of islandResults) {
    if (r.bestFitness < best.bestFitness) best = r;
  }
  return { ...best, timeMs: performance.now() - t0, islandResults };
}

export function buildLab4ProtocolText(params: {
  title: string;
  situationA: {
    objectIds: number[];
    objectNames: string[];
    teacherName: string;
    expertsListed: string[];
    candidateTop15: number[];
    removedByHeuristics: number[];
    excludedVotesCount: number;
    lab3MinSum: number | null;
    lab3MinMax: number | null;
    centralizedMs: number | null;
    distributedMainMs: number | null;
    distributedWorkersMs: number | null;
    distributedMatchesLab3: boolean | null;
    chosenPermutationLabel: string;
    satisfactionRows: ExpertSatisfactionRow[];
  };
  situationB: {
    n: number;
    m: number;
    seed: number;
    gaCentralMs: number | null;
    gaCentralFitness: number | null;
    gaIslandsMs: number | null;
    gaIslandsFitness: number | null;
  };
}): string {
  const lines: string[] = [];
  lines.push(`Протокол обчислень — ${params.title}`);
  lines.push(`Згенеровано: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('=== Ситуація А (дані ЛР1–ЛР2) ===');
  lines.push(`Об'єкти (n=${params.situationA.objectIds.length}): ${params.situationA.objectNames.join('; ')}`);
  lines.push(`Викладач (додано до списку): ${params.situationA.teacherName || '—'}`);
  lines.push(`Експерти (імена): ${params.situationA.expertsListed.join(', ') || '—'}`);
  lines.push(`Кандидати топ-15: ${params.situationA.candidateTop15.join(', ')}`);
  lines.push(`Відсічені евристиками: ${params.situationA.removedByHeuristics.join(', ') || '—'}`);
  lines.push(`Бюлетені з об'єктами поза фінальною підмножиною (не в переборі): ${params.situationA.excludedVotesCount}`);
  lines.push(`ЛР3 критерії (еталон): minSum=${params.situationA.lab3MinSum ?? '—'}, minMax=${params.situationA.lab3MinMax ?? '—'}`);
  lines.push(`Час централізованого перебору: ${params.situationA.centralizedMs?.toFixed(1) ?? '—'} мс`);
  lines.push(`Час розподіленого (головний потік, частини): ${params.situationA.distributedMainMs?.toFixed(1) ?? '—'} мс`);
  lines.push(`Час розподіленого (Web Workers): ${params.situationA.distributedWorkersMs?.toFixed(1) ?? '—'} мс`);
  lines.push(`Критерії збігаються з ЛР3: ${params.situationA.distributedMatchesLab3 === null ? '—' : params.situationA.distributedMatchesLab3 ? 'так' : 'ні'}`);
  lines.push(`Обране компромісне ранжування: ${params.situationA.chosenPermutationLabel}`);
  lines.push('Індекси задоволеності:');
  for (const r of params.situationA.satisfactionRows) {
    lines.push(
      `  Експерт ${r.expertIndex} (${r.voterName}): d=${r.distanceD.toFixed(0)}, s=${r.satisfactionPercent.toFixed(1)}%`
    );
  }
  lines.push('');
  lines.push('=== Ситуація Б (n >> 12, синтетика) ===');
  lines.push(`n=${params.situationB.n}, m=${params.situationB.m}, seed=${params.situationB.seed}`);
  lines.push(`ГА централізовано: ${params.situationB.gaCentralMs?.toFixed(1) ?? '—'} мс, fitness=${params.situationB.gaCentralFitness ?? '—'}`);
  lines.push(`ГА острівці (розподілена імітація): ${params.situationB.gaIslandsMs?.toFixed(1) ?? '—'} мс, fitness=${params.situationB.gaIslandsFitness ?? '—'}`);
  return lines.join('\n');
}
