-- Виконайте цей SQL у Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard → ваш проєкт → SQL Editor

create table if not exists lab1_votes (
  id uuid primary key default gen_random_uuid(),
  voter_name text not null,
  ranking jsonb not null check (jsonb_array_length(ranking) = 3),
  created_at timestamptz default now()
);

create table if not exists lab2_votes (
  id uuid primary key default gen_random_uuid(),
  voter_name text not null,
  selected_heuristics jsonb not null,
  created_at timestamptz default now()
);

-- Дозволити публічний доступ (anon key) для читання та запису
alter table lab1_votes enable row level security;
alter table lab2_votes enable row level security;

create policy "Allow all for lab1_votes" on lab1_votes for all using (true) with check (true);
create policy "Allow all for lab2_votes" on lab2_votes for all using (true) with check (true);
