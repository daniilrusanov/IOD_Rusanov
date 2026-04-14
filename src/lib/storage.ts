import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEYS = {
  lab1Votes: 'iod_lab1_votes',
  lab2Votes: 'iod_lab2_votes',
  lab1Results: 'iod_lab1_results',
};

export interface Lab1Vote {
  id: string;
  voterName: string;
  ranking: [number, number, number];
  createdAt: string;
}

export interface Lab2Vote {
  id: string;
  voterName: string;
  selectedHeuristics: string[];
  createdAt: string;
}

/** Мережа/DNS/видалений проєкт — помилка приходить у `error`, а не лише в catch. */
function isSupabaseNetworkError(err: unknown): boolean {
  const msg =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: string }).message)
      : String(err);
  const m = msg.toLowerCase();
  return (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('failed to fetch') ||
    m.includes('name not resolved') ||
    m.includes('err_name_not_resolved') ||
    m.includes('getaddrinfo') ||
    m.includes('load failed') ||
    m.includes('connection')
  );
}

async function getLab1FromSupabase(): Promise<Lab1Vote[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('lab1_votes')
      .select('id, voter_name, ranking, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      if (isSupabaseNetworkError(error)) {
        console.warn(
          '[Supabase] Хост не знайдено або мережа недоступна (ERR_NAME_NOT_RESOLVED тощо). Перевірте Project URL у Dashboard → Settings → API; якщо проєкт видалено — оновіть .env або приберіть VITE_SUPABASE_* для роботи лише з localStorage.',
          error
        );
      } else {
        console.error('Supabase lab1 error:', error);
      }
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      voterName: r.voter_name,
      ranking: r.ranking as [number, number, number],
      createdAt: r.created_at,
    }));
  } catch (e) {
    console.error('Supabase lab1 (мережа/URL):', e);
    return [];
  }
}

async function getLab2FromSupabase(): Promise<Lab2Vote[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('lab2_votes')
      .select('id, voter_name, selected_heuristics, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      if (isSupabaseNetworkError(error)) {
        console.warn(
          '[Supabase] Хост не знайдено або мережа недоступна. Перевірте VITE_SUPABASE_URL у Dashboard → Settings → API.',
          error
        );
      } else {
        console.error('Supabase lab2 error:', error);
      }
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      voterName: r.voter_name,
      selectedHeuristics: r.selected_heuristics as string[],
      createdAt: r.created_at,
    }));
  } catch (e) {
    console.error('Supabase lab2 (мережа/URL):', e);
    return [];
  }
}

function readLab1Local(): Lab1Vote[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.lab1Votes);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function readLab2Local(): Lab2Vote[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.lab2Votes);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export const storage = {
  async getLab1Votes(): Promise<Lab1Vote[]> {
    if (!isSupabaseConfigured()) return readLab1Local();
    const remote = await getLab1FromSupabase();
    const local = readLab1Local();
    if (remote.length > 0) return remote;
    if (local.length > 0) {
      console.warn(
        'Supabase недоступний або порожній — показано дані з localStorage. Перевірте VITE_SUPABASE_URL / мережу.'
      );
    }
    return local;
  },

  async addLab1Vote(vote: Omit<Lab1Vote, 'id' | 'createdAt'>): Promise<Lab1Vote> {
    const newVote: Lab1Vote = {
      ...vote,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('lab1_votes').insert({
          id: newVote.id,
          voter_name: newVote.voterName,
          ranking: newVote.ranking,
          created_at: newVote.createdAt,
        });
        if (error) {
          if (isSupabaseNetworkError(error)) {
            console.warn(
              'Supabase недоступний (DNS/мережа) — голос збережено лише в localStorage. Оновіть URL проєкту в .env.',
              error
            );
            const votes = readLab1Local();
            votes.push(newVote);
            localStorage.setItem(STORAGE_KEYS.lab1Votes, JSON.stringify(votes));
            return newVote;
          }
          throw new Error(error.message);
        }
        return newVote;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isSupabaseNetworkError(e) || msg.includes('fetch') || msg.includes('Fetch') || msg.includes('Network')) {
          console.warn('Supabase недоступний — голос збережено лише локально (localStorage).');
          const votes = readLab1Local();
          votes.push(newVote);
          localStorage.setItem(STORAGE_KEYS.lab1Votes, JSON.stringify(votes));
          return newVote;
        }
        throw e;
      }
    }

    const votes = readLab1Local();
    votes.push(newVote);
    localStorage.setItem(STORAGE_KEYS.lab1Votes, JSON.stringify(votes));
    return newVote;
  },

  async getLab2Votes(): Promise<Lab2Vote[]> {
    if (!isSupabaseConfigured()) return readLab2Local();
    const remote = await getLab2FromSupabase();
    const local = readLab2Local();
    if (remote.length > 0) return remote;
    if (local.length > 0) {
      console.warn(
        'Supabase недоступний або порожній — показано дані з localStorage. Перевірте VITE_SUPABASE_URL / мережу.'
      );
    }
    return local;
  },

  async addLab2Vote(vote: Omit<Lab2Vote, 'id' | 'createdAt'>): Promise<Lab2Vote> {
    const newVote: Lab2Vote = {
      ...vote,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('lab2_votes').insert({
          id: newVote.id,
          voter_name: newVote.voterName,
          selected_heuristics: newVote.selectedHeuristics,
          created_at: newVote.createdAt,
        });
        if (error) {
          if (isSupabaseNetworkError(error)) {
            console.warn(
              'Supabase недоступний (DNS/мережа) — голос збережено лише в localStorage. Оновіть URL проєкту в .env.',
              error
            );
            const votes = readLab2Local();
            votes.push(newVote);
            localStorage.setItem(STORAGE_KEYS.lab2Votes, JSON.stringify(votes));
            return newVote;
          }
          throw new Error(error.message);
        }
        return newVote;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isSupabaseNetworkError(e) || msg.includes('fetch') || msg.includes('Fetch') || msg.includes('Network')) {
          console.warn('Supabase недоступний — голос збережено лише локально (localStorage).');
          const votes = readLab2Local();
          votes.push(newVote);
          localStorage.setItem(STORAGE_KEYS.lab2Votes, JSON.stringify(votes));
          return newVote;
        }
        throw e;
      }
    }

    const votes = readLab2Local();
    votes.push(newVote);
    localStorage.setItem(STORAGE_KEYS.lab2Votes, JSON.stringify(votes));
    return newVote;
  },

  getLab1TopObjects(): number[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.lab1Results);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  setLab1TopObjects(ids: number[]): void {
    localStorage.setItem(STORAGE_KEYS.lab1Results, JSON.stringify(ids));
  },
};
