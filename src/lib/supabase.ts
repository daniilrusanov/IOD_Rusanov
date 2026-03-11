import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

// URL: https://xxx.supabase.co, ключ: JWT (eyJ...) або довгий рядок
const urlValid = url.length > 20 && url.includes('supabase');
const keyValid = anonKey.length > 50;

export const supabase = urlValid && keyValid ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = () => !!supabase;

// Для діагностики (без витоку секретів)
export const getConfigStatus = () => ({
  hasUrl: !!url,
  urlValid,
  hasKey: !!anonKey,
  keyValid,
  configured: !!supabase,
});
