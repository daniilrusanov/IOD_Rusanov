import { bruteForceMediansPartial } from '../lib/lab3Ranking';

self.onmessage = (
  e: MessageEvent<{ triples: [number, number, number][]; n: number; firstValues: number[] }>
) => {
  const { triples, n, firstValues } = e.data;
  const result = bruteForceMediansPartial(triples, n, firstValues);
  self.postMessage(result);
};
