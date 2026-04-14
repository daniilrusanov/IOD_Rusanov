import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OBJECTS } from '../data/objects';
import { HEURISTICS } from '../data/heuristics';
import { storage } from '../lib/storage';
import type { Lab1Vote, Lab2Vote } from '../lib/storage';
import type { MedianResult } from '../lib/lab3Ranking';
import {
  bruteForceMedians,
  buildNetPreferenceMatrix,
  buildPairwiseMatrix,
  comparePermutations,
  cookSumMax,
  filterVotesForSubset,
  getWinnerObjectIds,
  heuristicPriority,
  permToOrderedObjectIds,
  runGeneticAlgorithm,
  syntheticTriples,
  toLocalTriples,
} from '../lib/lab3Ranking';

/** Повний перебір лише за кнопкою; максимум n = 10 (10! ітерацій). */
const BRUTE_FORCE_BUTTON_MAX_N = 10;
const STORAGE_KEY = 'iod_lab3_snapshot';

function nameById(id: number) {
  return OBJECTS.find((o) => o.id === id)?.name ?? String(id);
}

export default function Lab3() {
  const navigate = useNavigate();
  const [lab1Votes, setLab1Votes] = useState<Lab1Vote[]>([]);
  const [lab2Votes, setLab2Votes] = useState<Lab2Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [scaleRows, setScaleRows] = useState<
    { n: number; m: number; timeMs: number; bestSum: number; seed: number }[]
  >([]);
  const [scaleRunning, setScaleRunning] = useState(false);
  const [gaSeed, setGaSeed] = useState(42);
  const [bruteResult, setBruteResult] = useState<MedianResult | null>(null);
  const [bruteRunning, setBruteRunning] = useState(false);
  const [bruteElapsedMs, setBruteElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [v1, v2] = await Promise.all([storage.getLab1Votes(), storage.getLab2Votes()]);
        setLab1Votes(v1);
        setLab2Votes(v2);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const objectIds = useMemo(() => getWinnerObjectIds(lab1Votes, lab2Votes), [lab1Votes, lab2Votes]);
  const heuristicsRanked = useMemo(() => heuristicPriority(lab2Votes), [lab2Votes]);
  const votesFiltered = useMemo(
    () => filterVotesForSubset(lab1Votes, objectIds),
    [lab1Votes, objectIds]
  );
  const triplesLocal = useMemo(
    () => toLocalTriples(votesFiltered, objectIds),
    [votesFiltered, objectIds]
  );

  const n = objectIds.length;

  const pairwise = useMemo(
    () => buildPairwiseMatrix(votesFiltered, objectIds),
    [votesFiltered, objectIds]
  );
  const net = useMemo(() => buildNetPreferenceMatrix(pairwise), [pairwise]);

  useEffect(() => {
    setBruteResult(null);
    setBruteElapsedMs(null);
  }, [objectIds, triplesLocal]);

  const runBruteForce = useCallback(() => {
    if (n <= 0 || n > BRUTE_FORCE_BUTTON_MAX_N || triplesLocal.length === 0) return;
    setBruteRunning(true);
    setBruteResult(null);
    setBruteElapsedMs(null);
    window.setTimeout(() => {
      const t0 = performance.now();
      const result = bruteForceMedians(triplesLocal, n);
      setBruteElapsedMs(performance.now() - t0);
      setBruteResult(result);
      setBruteRunning(false);
    }, 0);
  }, [n, triplesLocal]);

  const gaSameData = useMemo(() => {
    if (n <= 0 || triplesLocal.length === 0) return null;
    const sum = runGeneticAlgorithm(triplesLocal, n, 'sum', {
      populationSize: 120,
      generations: 350,
      mutationRate: 0.2,
      seed: gaSeed,
    });
    const max = runGeneticAlgorithm(triplesLocal, n, 'max', {
      populationSize: 120,
      generations: 350,
      mutationRate: 0.2,
      seed: gaSeed + 1,
    });
    return { sum, max };
  }, [n, triplesLocal, gaSeed]);

  const demoPerms = useMemo(() => {
    if (n <= 0) return [];
    const base = Array.from({ length: n }, (_, i) => i);
    const p2 = [...base];
    if (n >= 2) [p2[0], p2[1]] = [p2[1], p2[0]];
    const p3 = [...base].reverse();
    return [base, p2, p3].slice(0, Math.min(3, n > 1 ? 3 : 1));
  }, [n]);

  const exportSnapshot = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      objectIds,
      pairwise,
      netPreference: net,
      triplesLocal,
      brute: bruteResult,
      genetic: gaSameData,
      lab1VoteCount: lab1Votes.length,
      lab2VoteCount: lab2Votes.length,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lab3_snapshot_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, [objectIds, pairwise, net, triplesLocal, bruteResult, gaSameData, lab1Votes.length, lab2Votes.length]);

  const runScale = () => {
    setScaleRunning(true);
    setScaleRows([]);
    const rows: { n: number; m: number; timeMs: number; bestSum: number; seed: number }[] = [];
    setTimeout(() => {
      for (const nAlt of [20, 50, 100]) {
        for (const mExp of [10, 20, 30]) {
          const seed = (nAlt % 97) * 1000 + (mExp % 41) * 17 + 12345;
          const triples = syntheticTriples(nAlt, mExp, seed);
          const t0 = performance.now();
          const ga = runGeneticAlgorithm(triples, nAlt, 'sum', {
            populationSize: 180,
            generations: 500,
            mutationRate: 0.18,
            seed,
          });
          const t1 = performance.now();
          rows.push({ n: nAlt, m: mExp, timeMs: t1 - t0, bestSum: ga.bestFitness, seed });
        }
      }
      setScaleRows(rows);
      setScaleRunning(false);
    }, 50);
  };

  const expertsDisplay = useMemo(() => {
    const names = new Set<string>();
    lab1Votes.forEach((v) => names.add(v.voterName.trim()));
    lab2Votes.forEach((v) => names.add(v.voterName.trim()));
    return Array.from(names).sort();
  }, [lab1Votes, lab2Votes]);

  if (loading) {
    return (
      <div className="page lab3-page">
        <p className="subtitle">Завантаження даних ЛР1–ЛР2…</p>
      </div>
    );
  }

  return (
    <div className="page lab3-page">
      <button className="link-btn back-btn" type="button" onClick={() => navigate('/')}>
        На головну
      </button>
      <h1>ЛР3 — Колективне ранжування (метрика Кука)</h1>
      <p className="subtitle lab3-intro">
        Дані з ЛР1 (трійки) та ЛР2 (евристики). Підмножина переможців — до 10 об’єктів; медіани —
        мінімуми суми та максимуму відстаней; еволюційний алгоритм для порівняння та великих n.
      </p>

      <section className="lab3-section">
        <h2>Об’єкти та експерти</h2>
        <p>
          <strong>Об’єкти (підмножина, n = {n}):</strong>
        </p>
        <ol className="lab3-ordered">
          {objectIds.map((id) => (
            <li key={id}>
              {id}. {nameById(id)}
            </li>
          ))}
        </ol>
        <p>
          <strong>Експерти (унікальні імена з ЛР1 та ЛР2):</strong>{' '}
          {expertsDisplay.length > 0 ? expertsDisplay.join(', ') : <em>немає даних</em>}
        </p>
      </section>

      <section className="lab3-section">
        <h2>Пріоритет евристик (ЛР2)</h2>
        <table className="results-table matrix-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Евристика</th>
              <th>Голосів</th>
            </tr>
          </thead>
          <tbody>
            {heuristicsRanked.map((h) => (
              <tr key={h.heuristicId}>
                <td>{h.rank}</td>
                <td>{HEURISTICS.find((x) => x.id === h.heuristicId)?.name ?? h.heuristicId}</td>
                <td>{h.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="lab3-section">
        <h2>Множинні порівняння (анонімно)</h2>
        <p>Кожен рядок — бюлетень: 1 → 2 → 3 місце серед обраних мультфільмів (глобальні id).</p>
        <div className="protocol lab3-protocol">
          {lab1Votes.map((v, i) => (
            <div key={v.id} className="protocol-row">
              <span>Експерт {i + 1}</span>
              <span>
                {v.ranking.map((id) => nameById(id)).join(' → ')}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="lab3-section">
        <h2>Матриця переваг (п. 1.2)</h2>
        <p className="lab3-hint">
          A[i][j] — скільки експертів поставили об’єкт рядка вище за об’єкт стовпця (серед трійок, де
          обидва присутні).
        </p>
        <div className="matrix-scroll">
          <table className="results-table matrix-table dense">
            <thead>
              <tr>
                <th />
                {objectIds.map((id) => (
                  <th key={id}>{id}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {objectIds.map((rowId, i) => (
                <tr key={rowId}>
                  <th>{rowId}</th>
                  {pairwise[i].map((cell, j) => (
                    <td key={`${i}-${j}`}>{i === j ? '—' : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lab3-section">
        <h2>Матриця чистої переваги (п. 1.3)</h2>
        <p className="lab3-hint">B[i][j] = A[i][j] − A[j][i].</p>
        <div className="matrix-scroll">
          <table className="results-table matrix-table dense">
            <thead>
              <tr>
                <th />
                {objectIds.map((id) => (
                  <th key={id}>{id}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {objectIds.map((rowId, i) => (
                <tr key={rowId}>
                  <th>{rowId}</th>
                  {net[i].map((cell, j) => (
                    <td key={`${i}-${j}`}>{i === j ? '—' : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="lab3-section">
        <h2>Перевірка обчислень (кілька перестановок)</h2>
        <p>Локальні індекси 0…n−1; метрика Кука до трійок експертів: сума та макс.</p>
        <table className="results-table">
          <thead>
            <tr>
              <th>Перестановка (індекси)</th>
              <th>Сума</th>
              <th>Макс</th>
            </tr>
          </thead>
          <tbody>
            {demoPerms.map((p, idx) => {
              const { sum, max } = cookSumMax(p, triplesLocal);
              return (
                <tr key={idx}>
                  <td className="left">{p.join(', ')}</td>
                  <td>{sum}</td>
                  <td>{max}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="lab3-section">
        <h2>Прямий перебір n!</h2>
        <p className="lab3-hint">
          Обчислення не запускається автоматично: натисніть кнопку (дозволено лише для n ≤{' '}
          {BRUTE_FORCE_BUTTON_MAX_N}). Для n = 10 це 3 628 800 перестановок — вкладка може на кілька
          секунд «зависнути».
        </p>
        {n > BRUTE_FORCE_BUTTON_MAX_N && (
          <p className="lab3-warn">
            n = {n} &gt; {BRUTE_FORCE_BUTTON_MAX_N}: повний перебір кнопкою недоступний. Звузьте
            підмножину або використайте ГА нижче.
          </p>
        )}
        {n >= 1 && n <= BRUTE_FORCE_BUTTON_MAX_N && triplesLocal.length === 0 && (
          <p>Немає голосів, де всі три об’єкти входять у підмножину — додайте дані ЛР1.</p>
        )}
        {n >= 1 && n <= BRUTE_FORCE_BUTTON_MAX_N && triplesLocal.length > 0 && (
          <p>
            <button type="button" disabled={bruteRunning} onClick={runBruteForce}>
              {bruteRunning ? 'Йде перебір n!…' : `Запустити повний перебір (${n}! перестановок)`}
            </button>
          </p>
        )}
        {bruteRunning && (
          <p className="lab3-hint">Очікуйте… після старту інтерфейс може тимчасово не відповідати.</p>
        )}
        {bruteElapsedMs !== null && bruteResult && (
          <p className="lab3-hint">
            Час обчислення: <strong>{bruteElapsedMs.toFixed(0)}</strong> мс
          </p>
        )}
        {bruteResult && (
          <>
            <p>
              Мінімальна <strong>сума</strong> відстаней: <strong>{bruteResult.minSum}</strong>{' '}
              (медіани за критерієм суми: {bruteResult.permutationsMinSum.length} варіантів).
            </p>
            <p>
              Мінімальний <strong>максимум</strong> відстаней: <strong>{bruteResult.minMax}</strong>{' '}
              (медіани за критерієм макс: {bruteResult.permutationsMinMax.length} варіантів).
            </p>
            <h3>Перші медіани (сума)</h3>
            <ul className="lab3-list">
              {bruteResult.permutationsMinSum.slice(0, 5).map((perm, i) => (
                <li key={i}>
                  {permToOrderedObjectIds(perm, objectIds)
                    .map((id) => `${nameById(id)} (${id})`)
                    .join(' → ')}
                </li>
              ))}
            </ul>
            <h3>Перші медіани (макс)</h3>
            <ul className="lab3-list">
              {bruteResult.permutationsMinMax.slice(0, 5).map((perm, i) => (
                <li key={i}>
                  {permToOrderedObjectIds(perm, objectIds)
                    .map((id) => `${nameById(id)} (${id})`)
                    .join(' → ')}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="lab3-section">
        <h2>Еволюційний алгоритм (ті самі дані)</h2>
        <p>
          <label>
            Seed ГА:{' '}
            <input
              type="number"
              value={gaSeed}
              onChange={(e) => setGaSeed(Number(e.target.value) || 0)}
            />
          </label>
        </p>
        {gaSameData &&
          bruteResult &&
          bruteResult.permutationsMinSum[0] &&
          bruteResult.permutationsMinMax[0] && (
          <table className="results-table">
            <thead>
              <tr>
                <th>Критерій</th>
                <th>Оптимум (перебір)</th>
                <th>ГА (найкраще)</th>
                <th>Відстань між перестановками*</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Сума</td>
                <td>{bruteResult.minSum}</td>
                <td>{gaSameData.sum.bestFitness}</td>
                <td>
                  {comparePermutations(
                    bruteResult.permutationsMinSum[0],
                    gaSameData.sum.bestPermutation,
                    n
                  )}
                </td>
              </tr>
              <tr>
                <td>Макс</td>
                <td>{bruteResult.minMax}</td>
                <td>{gaSameData.max.bestFitness}</td>
                <td>
                  {comparePermutations(
                    bruteResult.permutationsMinMax[0],
                    gaSameData.max.bestPermutation,
                    n
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {gaSameData && !bruteResult && n > 0 && (
          <table className="results-table">
            <thead>
              <tr>
                <th>Критерій</th>
                <th>ГА (найкраще)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Сума</td>
                <td>{gaSameData.sum.bestFitness}</td>
              </tr>
              <tr>
                <td>Макс</td>
                <td>{gaSameData.max.bestFitness}</td>
              </tr>
            </tbody>
          </table>
        )}
        <p className="lab3-hint">
          *Відстань між двома повними ранжуваннями: сума |r₁(i) − r₂(i)| по об’єктах (метрика Кука в
          просторі рангів).
        </p>
        {gaSameData && (
          <p>
            Найкраща перестановка ГА (сума):{' '}
            <strong>
              {permToOrderedObjectIds(gaSameData.sum.bestPermutation, objectIds)
                .map((id) => nameById(id))
                .join(' → ')}
            </strong>
          </p>
        )}
      </section>

      <section className="lab3-section">
        <h2>Масштабування (синтетичні дані, п. 17)</h2>
        <p>
          Еволюційний алгоритм для n ∈ 20, 50, 100 та m ∈ 10, 20, 30 експертів (випадкові трійки).
        </p>
        <button type="button" disabled={scaleRunning} onClick={runScale}>
          {scaleRunning ? 'Обчислення…' : 'Запустити експерименти'}
        </button>
        {scaleRows.length > 0 && (
          <table className="results-table">
            <thead>
              <tr>
                <th>n</th>
                <th>m</th>
                <th>Час (мс)</th>
                <th>Найкраща сума (ГА)</th>
              </tr>
            </thead>
            <tbody>
              {scaleRows.map((r) => (
                <tr key={`${r.n}-${r.m}`}>
                  <td>{r.n}</td>
                  <td>{r.m}</td>
                  <td>{r.timeMs.toFixed(1)}</td>
                  <td>{r.bestSum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="lab3-section">
        <h2>Збереження</h2>
        <button type="button" onClick={exportSnapshot}>
          Експортувати JSON (і в localStorage)
        </button>
      </section>
    </div>
  );
}
