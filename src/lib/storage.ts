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

async function getLab1FromSupabase(): Promise<Lab1Vote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('lab1_votes')
    .select('id, voter_name, ranking, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Supabase lab1 error:', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    voterName: r.voter_name,
    ranking: r.ranking as [number, number, number],
    createdAt: r.created_at,
  }));
}

async function getLab2FromSupabase(): Promise<Lab2Vote[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('lab2_votes')
    .select('id, voter_name, selected_heuristics, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Supabase lab2 error:', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    voterName: r.voter_name,
    selectedHeuristics: r.selected_heuristics as string[],
    createdAt: r.created_at,
  }));
}

export const storage = {
  async getLab1Votes(): Promise<Lab1Vote[]> {
    if (isSupabaseConfigured()) return getLab1FromSupabase();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.lab1Votes);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addLab1Vote(vote: Omit<Lab1Vote, 'id' | 'createdAt'>): Promise<Lab1Vote> {
    const newVote: Lab1Vote = {
      ...vote,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('lab1_votes').insert({
        id: newVote.id,
        voter_name: newVote.voterName,
        ranking: newVote.ranking,
        created_at: newVote.createdAt,
      });
      if (error) throw new Error(error.message);
      return newVote;
    }

    const votes = JSON.parse(localStorage.getItem(STORAGE_KEYS.lab1Votes) ?? '[]');
    votes.push(newVote);
    localStorage.setItem(STORAGE_KEYS.lab1Votes, JSON.stringify(votes));
    return newVote;
  },

  async getLab2Votes(): Promise<Lab2Vote[]> {
    if (isSupabaseConfigured()) return getLab2FromSupabase();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.lab2Votes);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addLab2Vote(vote: Omit<Lab2Vote, 'id' | 'createdAt'>): Promise<Lab2Vote> {
    const newVote: Lab2Vote = {
      ...vote,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('lab2_votes').insert({
        id: newVote.id,
        voter_name: newVote.voterName,
        selected_heuristics: newVote.selectedHeuristics,
        created_at: newVote.createdAt,
      });
      if (error) throw new Error(error.message);
      return newVote;
    }

    const votes = JSON.parse(localStorage.getItem(STORAGE_KEYS.lab2Votes) ?? '[]');
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
