import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OBJECTS } from '../data/objects';
import { storage } from '../lib/storage';
import type { Lab1Vote, Lab2Vote } from '../lib/storage';
import type { MedianResult } from '../lib/lab3Ranking';
import {
  bruteForceMedians,
  bruteForceMediansPartial,
  mergeMedianResults,
  permToOrderedObjectIds,
  runGeneticAlgorithm,
  syntheticTriples,
  toLocalTriples,
  filterVotesForSubset,
  getWinnerObjectIds,
} from '../lib/lab3Ranking';
import {
  buildExpertSatisfactionTable,
  buildLab4ProtocolText,
  getLab1TopObjectIds,
  getRemovedByHeuristics,
  getVotesExcludedFromFinalSubset,
  medianCriteriaMatch,
  runGeneticAlgorithmIslands,
  splitIntoContiguousChunks,
  timedBruteForceCentralized,
  timedBruteForceDistributedMainThread,
} from '../lib/lab4Ranking';
const BRUTE_MAX_N = 10;

function nameById(id: number) {
  return OBJECTS.find((o) => o.id === id)?.name ?? String(id);
}

async function runBruteDistributedWorkers(
  triples: [number, number, number][],
  n: number,
  workerCount: number
): Promise<{ result: MedianResult; timeMs: number; usedWorkers: boolean }> {
  const firstVals = Array.from({ length: n }, (_, i) => i);
  const chunks = splitIntoContiguousChunks(firstVals, Math.max(1, Math.min(workerCount, n)));
  const t0 = performance.now();
  try {
    const parts = await Promise.all(
      chunks.map(
        (firstValues) =>
          new Promise<MedianResult>((resolve, reject) => {
            const w = new Worker(new URL('../workers/lab4Brute.worker.ts', import.meta.url), {
              type: 'module',
            });
            w.onmessage = (ev: MessageEvent<MedianResult>) => {
              resolve(ev.data);
              w.terminate();
            };
            w.onerror = (err) => {
              w.terminate();
              reject(err);
            };
            w.postMessage({ triples, n, firstValues });
          })
      )
    );
    const merged = mergeMedianResults(parts);
    return { result: merged, timeMs: performance.now() - t0, usedWorkers: true };
  } catch {
    const parts = chunks.map((firstValues) => bruteForceMediansPartial(triples, n, firstValues));
    const merged = mergeMedianResults(parts);
    return { result: merged, timeMs: performance.now() - t0, usedWorkers: false };
  }
}

export default function Lab4() {
  const navigate = useNavigate();
  const [lab1Votes, setLab1Votes] = useState<Lab1Vote[]>([]);
  const [lab2Votes, setLab2Votes] = useState<Lab2Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState('Викладач');

  const [central, setCentral] = useState<{ result: MedianResult; timeMs: number } | null>(null);
  const [distMain, setDistMain] = useState<{ result: MedianResult; timeMs: number } | null>(null);
  const [distWorkers, setDistWorkers] = useState<{
    result: MedianResult;
    timeMs: number;
    usedWorkers: boolean;
  } | null>(null);
  const [lab3Ref, setLab3Ref] = useState<MedianResult | null>(null);
  const [running, setRunning] = useState(false);
  const [chunkCount, setChunkCount] = useState(4);
  const [workerCount, setWorkerCount] = useState(
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? Math.min(8, navigator.hardwareConcurrency)
      : 4
  );

  const [chosenPermIndex, setChosenPermIndex] = useState(0);

  const [bN, setBN] = useState(20);
  const [bM, setBM] = useState(20);
  const [bSeed, setBSeed] = useState(42);
  const [bIslands, setBIslands] = useState(4);
  const [bRunning, setBRunning] = useState(false);
  const [bCentral, setBCentral] = useState<{ timeMs: number; fitness: number } | null>(null);
  const [bIslandsRes, setBIslandsRes] = useState<{ timeMs: number; fitness: number } | null>(null);

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
  const candidateTop15 = useMemo(() => getLab1TopObjectIds(lab1Votes, 15), [lab1Votes]);
  const removedByHeuristics = useMemo(
    () => getRemovedByHeuristics(candidateTop15, objectIds),
    [candidateTop15, objectIds]
  );
  const votesFiltered = useMemo(
    () => filterVotesForSubset(lab1Votes, objectIds),
    [lab1Votes, objectIds]
  );
  const triplesLocal = useMemo(
    () => toLocalTriples(votesFiltered, objectIds),
    [votesFiltered, objectIds]
  );
  const excludedVotes = useMemo(
    () => getVotesExcludedFromFinalSubset(lab1Votes, objectIds),
    [lab1Votes, objectIds]
  );

  const n = objectIds.length;

  const expertsDisplay = useMemo(() => {
    const names = new Set<string>();
    lab1Votes.forEach((v) => names.add(v.voterName.trim()));
    lab2Votes.forEach((v) => names.add(v.voterName.trim()));
    return Array.from(names).sort();
  }, [lab1Votes, lab2Votes]);

  const expertsWithTeacher = useMemo(() => {
    const t = teacherName.trim();
    if (!t) return expertsDisplay;
    return [...expertsDisplay, t].filter((x, i, a) => a.indexOf(x) === i);
  }, [expertsDisplay, teacherName]);

  const baseResult = central?.result ?? distMain?.result ?? distWorkers?.result ?? null;
  const permutationsForChoice = baseResult?.permutationsMinSum ?? [];

  useEffect(() => {
    if (chosenPermIndex >= permutationsForChoice.length) setChosenPermIndex(0);
  }, [chosenPermIndex, permutationsForChoice.length]);

  const chosenPerm = permutationsForChoice[chosenPermIndex] ?? null;

  const satisfactionRows = useMemo(() => {
    if (!chosenPerm || n <= 0 || triplesLocal.length === 0) return [];
    return buildExpertSatisfactionTable(votesFiltered, triplesLocal, n, chosenPerm);
  }, [chosenPerm, n, triplesLocal, votesFiltered]);

  const runAllComparisons = useCallback(async () => {
    if (n <= 0 || n > BRUTE_MAX_N || triplesLocal.length === 0) return;
    setRunning(true);
    setCentral(null);
    setDistMain(null);
    setDistWorkers(null);
    setLab3Ref(null);

    window.setTimeout(async () => {
      try {
        const ref = bruteForceMedians(triplesLocal, n);
        setLab3Ref(ref);

        const c = timedBruteForceCentralized(triplesLocal, n);
        setCentral(c);

        const d = await timedBruteForceDistributedMainThread(triplesLocal, n, chunkCount);
        setDistMain(d);

        const w = await runBruteDistributedWorkers(triplesLocal, n, workerCount);
        setDistWorkers(w);
      } finally {
        setRunning(false);
      }
    }, 0);
  }, [n, triplesLocal, chunkCount, workerCount]);

  const matchesLab3 =
    lab3Ref && central && distMain && distWorkers
      ? medianCriteriaMatch(lab3Ref, central.result) &&
        medianCriteriaMatch(lab3Ref, distMain.result) &&
        medianCriteriaMatch(lab3Ref, distWorkers.result)
      : null;

  const exportProtocol = useCallback(() => {
    const chosenLabel =
      chosenPerm && objectIds.length
        ? permToOrderedObjectIds(chosenPerm, objectIds)
            .map((id) => `${nameById(id)} (${id})`)
            .join(' → ')
        : '—';

    const text = buildLab4ProtocolText({
      title: 'ЛР4 — компромісні ранжування та індекси задоволеності',
      situationA: {
        objectIds,
        objectNames: objectIds.map((id) => nameById(id)),
        teacherName,
        expertsListed: expertsWithTeacher,
        candidateTop15,
        removedByHeuristics,
        excludedVotesCount: excludedVotes.length,
        lab3MinSum: lab3Ref?.minSum ?? null,
        lab3MinMax: lab3Ref?.minMax ?? null,
        centralizedMs: central?.timeMs ?? null,
        distributedMainMs: distMain?.timeMs ?? null,
        distributedWorkersMs: distWorkers?.timeMs ?? null,
        distributedMatchesLab3: matchesLab3,
        chosenPermutationLabel: chosenLabel,
        satisfactionRows,
      },
      situationB: {
        n: bN,
        m: bM,
        seed: bSeed,
        gaCentralMs: bCentral?.timeMs ?? null,
        gaCentralFitness: bCentral?.fitness ?? null,
        gaIslandsMs: bIslandsRes?.timeMs ?? null,
        gaIslandsFitness: bIslandsRes?.fitness ?? null,
      },
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lab4_protocol_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [
    chosenPerm,
    objectIds,
    teacherName,
    expertsWithTeacher,
    candidateTop15,
    removedByHeuristics,
    excludedVotes.length,
    lab3Ref,
    central,
    distMain,
    distWorkers,
    matchesLab3,
    satisfactionRows,
    bN,
    bM,
    bSeed,
    bCentral,
    bIslandsRes,
  ]);

  const runSituationB = useCallback(() => {
    if (bN < 4 || bM < 1) return;
    setBRunning(true);
    setBCentral(null);
    setBIslandsRes(null);
    window.setTimeout(() => {
      const triples = syntheticTriples(bN, bM, bSeed);
      const t0 = performance.now();
      const ga = runGeneticAlgorithm(triples, bN, 'sum', {
        populationSize: 180,
        generations: 400,
        mutationRate: 0.18,
        seed: bSeed,
      });
      const t1 = performance.now();
      setBCentral({ timeMs: t1 - t0, fitness: ga.bestFitness });

      const isl = runGeneticAlgorithmIslands(triples, bN, 'sum', {
        islands: Math.max(2, bIslands),
        populationSize: 120,
        generations: 350,
        mutationRate: 0.2,
        baseSeed: bSeed,
      });
      setBIslandsRes({ timeMs: isl.timeMs, fitness: isl.bestFitness });
      setBRunning(false);
    }, 0);
  }, [bN, bM, bSeed, bIslands]);

  if (loading) {
    return (
      <div className="page lab3-page lab4-page">
        <p className="subtitle">Завантаження даних ЛР1–ЛР2…</p>
      </div>
    );
  }

  return (
    <div className="page lab3-page lab4-page">
      <button className="link-btn back-btn" type="button" onClick={() => navigate('/')}>
        На головну
      </button>
      <h1>ЛР4 — Компромісні ранжування та задоволеність експертів</h1>
      <p className="subtitle lab3-intro">
        Ситуація А: дані ЛР1–ЛР3, розподілений перебір (декомпозиція за першим місцем у перестановці),
        відстані d та індекси s. Ситуація Б: велике n, еволюційний алгоритм (централізовано vs
        острівці).
      </p>

      <section className="lab3-section">
        <h2>Об’єкти та учасники</h2>
        <p>
          <strong>Підмножина об’єктів (n = {n}, для прямого перебору потрібно n ≤ {BRUTE_MAX_N}):</strong>
        </p>
        <ol className="lab3-ordered">
          {objectIds.map((id) => (
            <li key={id}>
              {id}. {nameById(id)}
            </li>
          ))}
        </ol>
        <p>
          <strong>Експерти + викладач:</strong> {expertsWithTeacher.length ? expertsWithTeacher.join(', ') : '—'}
        </p>
        <p className="lab3-hint">
          Кандидати з ЛР1 (топ-15): {candidateTop15.join(', ') || '—'}. Відсічені евристиками ЛР2:{' '}
          {removedByHeuristics.join(', ') || '—'}.
        </p>
        {excludedVotes.length > 0 && (
          <p className="lab3-warn">
            Бюлетені, де є об’єкт поза фінальною підмножиною (не беруть участь у переборі):{' '}
            {excludedVotes.length}.
          </p>
        )}
      </section>

      <section className="lab3-section">
        <h2>Множинні порівняння (ЛР1)</h2>
        <p className="lab3-hint">Анонімні бюлетені; для перебору використовуються лише рядки, де всі три id ∈ фінальної підмножини.</p>
        <div className="protocol lab3-protocol">
          {lab1Votes.map((v, i) => (
            <div key={v.id} className="protocol-row">
              <span>Експерт {i + 1}</span>
              <span>{v.ranking.map((id) => nameById(id)).join(' → ')}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="lab3-section">
        <h2>Декомпозиція перебору</h2>
        <p>
          Перестановки розбиваються за значенням <code>perm[0]</code> (об’єкт на 1-му місці): для
          кожного <code>first ∈ {'{0,…,n−1}'}</code> перебираються всі перестановки хвоста довжини{' '}
          <code>(n−1)!</code>. Об’єднання по різних <code>first</code> дає всі <code>n!</code>{' '}
          перестановок без пропусків і без повторів.
        </p>
      </section>

      <section className="lab3-section">
        <h2>Перебір: централізовано vs розподілено</h2>
        {n > BRUTE_MAX_N && (
          <p className="lab3-warn">
            n = {n} &gt; {BRUTE_MAX_N}: повний перебір у браузері не запускається. Звузьте підмножину в
            адмінці/даних або використайте блок «Ситуація Б».
          </p>
        )}
        {n >= 1 && n <= BRUTE_MAX_N && triplesLocal.length === 0 && (
          <p>Немає голосів з повним покриттям підмножини.</p>
        )}
        {n >= 1 && n <= BRUTE_MAX_N && triplesLocal.length > 0 && (
          <>
            <p>
              <label>
                Частин (головний потік):{' '}
                <input
                  type="number"
                  min={1}
                  max={32}
                  value={chunkCount}
                  onChange={(e) => setChunkCount(Math.max(1, Number(e.target.value) || 1))}
                  className="lab4-input-num"
                />
              </label>{' '}
              <label>
                Воркерів:{' '}
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={workerCount}
                  onChange={(e) => setWorkerCount(Math.max(1, Number(e.target.value) || 1))}
                  className="lab4-input-num"
                />
              </label>
            </p>
            <p>
              <button type="button" disabled={running} onClick={runAllComparisons}>
                {running ? 'Обчислення…' : 'Запустити ЛР3 (еталон) + централізований + розподілені перебори'}
              </button>
            </p>
          </>
        )}

        {lab3Ref && (
          <p>
            <strong>ЛР3 (еталон, той самий bruteForceMedians):</strong> minSum = {lab3Ref.minSum}, minMax ={' '}
            {lab3Ref.minMax}
          </p>
        )}
        {central && (
          <p>
            Централізовано: minSum = {central.result.minSum}, minMax = {central.result.minMax}, час{' '}
            <strong>{central.timeMs.toFixed(1)}</strong> мс
          </p>
        )}
        {distMain && (
          <p>
            Розподілено (Promise по частинах): minSum = {distMain.result.minSum}, minMax ={' '}
            {distMain.result.minMax}, час <strong>{distMain.timeMs.toFixed(1)}</strong> мс
          </p>
        )}
        {distWorkers && (
          <p>
            Розподілено (Web Workers{distWorkers.usedWorkers ? '' : ' — fallback на головний потік'}): minSum ={' '}
            {distWorkers.result.minSum}, minMax = {distWorkers.result.minMax}, час{' '}
            <strong>{distWorkers.timeMs.toFixed(1)}</strong> мс
          </p>
        )}
        {matchesLab3 !== null && (
          <p className={matchesLab3 ? 'lab3-hint' : 'lab3-warn'}>
            Збіг критеріїв minSum/minMax з еталоном ЛР3: <strong>{matchesLab3 ? 'так' : 'ні'}</strong>
          </p>
        )}
      </section>

      <section className="lab3-section">
        <h2>Компромісне ранжування та індекси задоволеності</h2>
        {permutationsForChoice.length > 0 && (
          <>
            <p>
              Оберіть варіант з множини мінімуму суми (показано до 200):{' '}
              <select
                value={chosenPermIndex}
                onChange={(e) => setChosenPermIndex(Number(e.target.value))}
                className="lab4-select"
              >
                {permutationsForChoice.slice(0, 200).map((perm, idx) => (
                  <option key={idx} value={idx}>
                    {permToOrderedObjectIds(perm, objectIds)
                      .map((id) => `${nameById(id)} (${id})`)
                      .join(' → ')}
                  </option>
                ))}
              </select>
            </p>
            <p className="lab3-hint">
              d — сума модулів різниць рангів (метрика Кука до трійки 1,2,3); s = 100·(1 − d/(3(n−3))).
            </p>
            <div className="matrix-scroll">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Експерт</th>
                    <th>Трійка (id)</th>
                    <th>d</th>
                    <th>s, %</th>
                  </tr>
                </thead>
                <tbody>
                  {satisfactionRows.map((r) => (
                    <tr key={r.expertIndex}>
                      <td>{r.expertIndex}</td>
                      <td>{r.voterName}</td>
                      <td className="left">{r.rankingGlob.join(' → ')}</td>
                      <td>{r.distanceD}</td>
                      <td>{r.satisfactionPercent.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {permutationsForChoice.length === 0 && (
          <p>Спочатку виконайте перебір вище або перевірте дані.</p>
        )}
      </section>

      <section className="lab3-section">
        <h2>Ситуація Б — n &gt;&gt; 12 (синтетичні трійки)</h2>
        <p>
          <label>
            n:{' '}
            <input
              type="number"
              min={13}
              max={200}
              value={bN}
              onChange={(e) => setBN(Math.max(4, Number(e.target.value) || 13))}
              className="lab4-input-num"
            />
          </label>{' '}
          <label>
            m (експертів):{' '}
            <input
              type="number"
              min={1}
              max={500}
              value={bM}
              onChange={(e) => setBM(Math.max(1, Number(e.target.value) || 1))}
              className="lab4-input-num"
            />
          </label>{' '}
          <label>
            seed:{' '}
            <input
              type="number"
              value={bSeed}
              onChange={(e) => setBSeed(Number(e.target.value) || 0)}
              className="lab4-input-num"
            />
          </label>{' '}
          <label>
            Острівців:{' '}
            <input
              type="number"
              min={2}
              max={16}
              value={bIslands}
              onChange={(e) => setBIslands(Math.max(2, Number(e.target.value) || 2))}
              className="lab4-input-num"
            />
          </label>
        </p>
        <p>
          <button type="button" disabled={bRunning} onClick={runSituationB}>
            {bRunning ? 'ГА…' : 'ГА: централізовано vs острівці'}
          </button>
        </p>
        {bCentral && (
          <p>
            Централізований ГА: <strong>{bCentral.timeMs.toFixed(1)}</strong> мс, найкраща сума ={' '}
            {bCentral.fitness}
          </p>
        )}
        {bIslandsRes && (
          <p>
            Острівці (розподілена імітація): <strong>{bIslandsRes.timeMs.toFixed(1)}</strong> мс, найкраща
            сума = {bIslandsRes.fitness}
          </p>
        )}
      </section>

      <section className="lab3-section">
        <h2>Протокол у файл</h2>
        <button type="button" onClick={exportProtocol}>
          Завантажити lab4_protocol.txt
        </button>
      </section>
    </div>
  );
}
