-- expenses table
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  owner uuid not null,
  item text,
  amount numeric not null default 0,
  category text,
  expense_date date not null,
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

create policy "Insert own expenses" on public.expenses
  for insert
  with check (owner = auth.uid());

create policy "Select/Update/Delete own expenses" on public.expenses
  for select, update, delete
  using (owner = auth.uid())
  with check (owner = auth.uid());
