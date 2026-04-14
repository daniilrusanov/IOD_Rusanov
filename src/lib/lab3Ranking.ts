import type { Lab1Vote, Lab2Vote } from './storage';
import { computeLab1Ranking } from './lab1Results';
import { computeHeuristicPopularity, applyHeuristics } from './lab2Heuristics';

/** Підмножина переможців (до 10) за тією ж логікою, що в Admin. */
export function getWinnerObjectIds(lab1Votes: Lab1Vote[], lab2Votes: Lab2Vote[]): number[] {
  const lab1Ranking = computeLab1Ranking(lab1Votes);
  const topObjects = lab1Ranking.slice(0, 15).map((r) => r.objectId);
  const heuristicsPopularity = computeHeuristicPopularity(lab2Votes);
  const topHeuristics = heuristicsPopularity.slice(0, 3).map((h) => h.heuristicId);
  return applyHeuristics(lab1Votes, topObjects, topHeuristics, 10);
}

export function heuristicPriority(lab2Votes: Lab2Vote[]) {
  return computeHeuristicPopularity(lab2Votes);
}

export function makeObjectIndexMap(objectIds: number[]): Map<number, number> {
  const m = new Map<number, number>();
  objectIds.forEach((id, i) => m.set(id, i));
  return m;
}

export function toLocalTriples(votes: Lab1Vote[], objectIds: number[]): [number, number, number][] {
  const idx = makeObjectIndexMap(objectIds);
  const out: [number, number, number][] = [];
  for (const v of votes) {
    const a = idx.get(v.ranking[0]);
    const b = idx.get(v.ranking[1]);
    const c = idx.get(v.ranking[2]);
    if (a !== undefined && b !== undefined && c !== undefined) out.push([a, b, c]);
  }
  return out;
}

/** Лише голоси, де всі три об'єкти входять у підмножину кандидатів. */
export function filterVotesForSubset(votes: Lab1Vote[], objectIds: number[]): Lab1Vote[] {
  const set = new Set(objectIds);
  return votes.filter((v) => v.ranking.every((id) => set.has(id)));
}

/**
 * Матриця переваг (п. 1.2): A[i][j] — скільки експертів поставили об'єкт i вище за j
 * (лише за наявності обох у трійці експерта; інакше пара не змінює матрицю).
 */
export function buildPairwiseMatrix(votes: Lab1Vote[], objectIds: number[]): number[][] {
  const n = objectIds.length;
  const idx = makeObjectIndexMap(objectIds);
  const a = Array.from({ length: n }, () => Array(n).fill(0));
  for (const v of votes) {
    const [o0, o1, o2] = v.ranking;
    const i0 = idx.get(o0);
    const i1 = idx.get(o1);
    const i2 = idx.get(o2);
    if (i0 === undefined || i1 === undefined || i2 === undefined) continue;
    a[i0][i1]++;
    a[i0][i2]++;
    a[i1][i2]++;
  }
  return a;
}

/** Матриця п. 1.3: чиста перевага B[i][j] = A[i][j] − A[j][i]. */
export function buildNetPreferenceMatrix(pairwise: number[][]): number[][] {
  return pairwise.map((row, i) => row.map((v, j) => (i === j ? 0 : v - pairwise[j][i])));
}

/** perm[k] — індекс об'єкта (0..n-1) на (k+1)-му місці; ranks[i] — ранг об'єкта i. */
export function ranksFromPermutation(perm: number[]): number[] {
  const n = perm.length;
  const ranks = new Array<number>(n);
  for (let k = 0; k < n; k++) ranks[perm[k]] = k + 1;
  return ranks;
}

/**
 * Метрика Кука для одного експерта: трійка з локальними індексами (ранги 1,2,3).
 */
export function cookDistanceOneExpert(ranks: number[], triple: [number, number, number]): number {
  const [a, b, c] = triple;
  return Math.abs(ranks[a] - 1) + Math.abs(ranks[b] - 2) + Math.abs(ranks[c] - 3);
}

export function cookSumMax(
  perm: number[],
  triples: [number, number, number][]
): { sum: number; max: number } {
  if (triples.length === 0) return { sum: 0, max: 0 };
  const ranks = ranksFromPermutation(perm);
  let sum = 0;
  let max = 0;
  for (const t of triples) {
    const d = cookDistanceOneExpert(ranks, t);
    sum += d;
    if (d > max) max = d;
  }
  return { sum, max };
}

function swapInPlace(a: number[], i: number, j: number) {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
}

/** Генерація всіх перестановок 0..n-1 (Heap's algorithm). */
export function* generatePermutations(n: number): Generator<number[]> {
  const c = new Array<number>(n).fill(0);
  const a = Array.from({ length: n }, (_, i) => i);
  yield [...a];
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      swapInPlace(a, i % 2 === 0 ? 0 : c[i], i);
      yield [...a];
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

export interface MedianResult {
  minSum: number;
  permutationsMinSum: number[][];
  minMax: number;
  permutationsMinMax: number[][];
}

/** Повний перебір: мінімуми суми та максимуму відстаней (медіани). */
export function bruteForceMedians(triples: [number, number, number][], n: number): MedianResult {
  if (n <= 0) {
    return { minSum: 0, permutationsMinSum: [], minMax: 0, permutationsMinMax: [] };
  }
  if (triples.length === 0) {
    const id = Array.from({ length: n }, (_, i) => i);
    return { minSum: 0, permutationsMinSum: [[...id]], minMax: 0, permutationsMinMax: [[...id]] };
  }
  let minSum = Infinity;
  let minMax = Infinity;
  const permutationsMinSum: number[][] = [];
  const permutationsMinMax: number[][] = [];

  for (const perm of generatePermutations(n)) {
    const { sum, max } = cookSumMax(perm, triples);
    if (sum < minSum) {
      minSum = sum;
      permutationsMinSum.length = 0;
      permutationsMinSum.push([...perm]);
    } else if (sum === minSum) {
      permutationsMinSum.push([...perm]);
    }
    if (max < minMax) {
      minMax = max;
      permutationsMinMax.length = 0;
      permutationsMinMax.push([...perm]);
    } else if (max === minMax) {
      permutationsMinMax.push([...perm]);
    }
  }
  return { minSum, permutationsMinSum, minMax, permutationsMinMax };
}

export type GaObjective = 'sum' | 'max';

export interface GaOptions {
  populationSize: number;
  generations: number;
  mutationRate: number;
  seed?: number;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomPermutation(n: number, rng: () => number): number[] {
  const p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    swapInPlace(p, i, j);
  }
  return p;
}

/** Order crossover (OX) для перестановок. */
function crossoverOx(p1: number[], p2: number[], rng: () => number): number[] {
  const n = p1.length;
  if (n <= 1) return [...p1];
  let i = Math.floor(rng() * n);
  let j = Math.floor(rng() * n);
  if (i > j) [i, j] = [j, i];
  const child = new Array<number>(n);
  const middle = new Set<number>();
  for (let k = i; k <= j; k++) {
    child[k] = p1[k];
    middle.add(p1[k]);
  }
  const tail: number[] = [];
  for (let k = 0; k < n; k++) {
    const v = p2[(j + 1 + k) % n];
    if (!middle.has(v)) tail.push(v);
  }
  let t = 0;
  for (let k = 0; k < n; k++) {
    if (k >= i && k <= j) continue;
    child[k] = tail[t++];
  }
  return child;
}

function mutateSwap(perm: number[], rng: () => number, rate: number): number[] {
  const n = perm.length;
  const p = [...perm];
  for (let i = 0; i < n; i++) {
    if (rng() < rate) {
      const j = Math.floor(rng() * n);
      swapInPlace(p, i, j);
    }
  }
  return p;
}

function fitness(perm: number[], triples: [number, number, number][], objective: GaObjective): number {
  const { sum, max } = cookSumMax(perm, triples);
  return objective === 'sum' ? sum : max;
}

export interface GaResult {
  bestPermutation: number[];
  bestFitness: number;
  objective: GaObjective;
  generations: number;
}

/**
 * Генетичний алгоритм (мінімізація суми або максимуму відстаней Кука).
 */
export function runGeneticAlgorithm(
  triples: [number, number, number][],
  n: number,
  objective: GaObjective,
  options: GaOptions
): GaResult {
  const rng = mulberry32(options.seed ?? Date.now() % 2147483647);
  const { populationSize, generations, mutationRate } = options;
  let population: number[][] = [];
  for (let i = 0; i < populationSize; i++) population.push(randomPermutation(n, rng));

  const fit = (perm: number[]) => fitness(perm, triples, objective);

  let best = population[0];
  let bestF = fit(best);
  for (const p of population) {
    const f = fit(p);
    if (f < bestF) {
      bestF = f;
      best = p;
    }
  }

  const tournamentPick = (): number[] => {
    let bestP = population[Math.floor(rng() * population.length)];
    let bestFi = fit(bestP);
    for (let t = 0; t < 2; t++) {
      const p = population[Math.floor(rng() * population.length)];
      const f = fit(p);
      if (f < bestFi) {
        bestFi = f;
        bestP = p;
      }
    }
    return bestP;
  };

  for (let g = 0; g < generations; g++) {
    const scored = population.map((p) => ({ p, f: fit(p) }));
    scored.sort((a, b) => a.f - b.f);
    const next: number[][] = [];
    const elite = 2;
    for (let i = 0; i < elite; i++) next.push([...scored[i].p]);

    while (next.length < populationSize) {
      const pa = tournamentPick();
      const pb = tournamentPick();
      let child = crossoverOx(pa, pb, rng);
      child = mutateSwap(child, rng, mutationRate);
      next.push(child);
    }
    population = next;

    for (const p of population) {
      const f = fit(p);
      if (f < bestF) {
        bestF = f;
        best = p;
      }
    }
  }

  return { bestPermutation: best, bestFitness: bestF, objective, generations };
}

/** Відновити глобальні id об'єктів за перестановкою локальних індексів. */
export function permToOrderedObjectIds(perm: number[], objectIds: number[]): number[] {
  return perm.map((idx) => objectIds[idx]);
}

/** Синтетичні експерти: m голосів, кожен — випадкова трійка з n об'єктів. */
export function syntheticTriples(
  n: number,
  expertCount: number,
  seed: number
): [number, number, number][] {
  const rng = mulberry32(seed);
  const triples: [number, number, number][] = [];
  for (let e = 0; e < expertCount; e++) {
    const a: number[] = [];
    while (a.length < 3) {
      const x = Math.floor(rng() * n);
      if (!a.includes(x)) a.push(x);
    }
    triples.push([a[0], a[1], a[2]]);
  }
  return triples;
}

export function comparePermutations(p1: number[], p2: number[], n: number): number {
  const r1 = ranksFromPermutation(p1);
  const r2 = ranksFromPermutation(p2);
  let d = 0;
  for (let i = 0; i < n; i++) d += Math.abs(r1[i] - r2[i]);
  return d;
}
