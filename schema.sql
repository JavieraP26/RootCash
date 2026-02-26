-- SQL Schema for Finanzas App

-- 1. Create table for Categories
create table public.categories (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users not null,
    name text not null,
    color_hex text default '#1E293B' not null
);

-- 2. Create table for Budgets
create table public.budgets (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users not null,
    category_id uuid references public.categories(id) on delete cascade not null,
    amount_limit numeric not null,
    month text not null, -- Format 'YYYY-MM'
    year text not null
);

-- 3. Create table for Fixed Debts
create table public.fixed_debts (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users not null,
    category_id uuid references public.categories(id) on delete set null,
    description text not null,
    amount numeric not null,
    due_day integer not null check (due_day >= 1 and due_day <= 31)
);

-- 4. Create table for Transactions
create table public.transactions (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users not null,
    category_id uuid references public.categories(id) on delete set null,
    amount numeric not null,
    type text not null check (type in ('expense', 'income')),
    date date not null,
    description text not null
);

-- Enable RLS (Row Level Security)
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.fixed_debts enable row level security;
alter table public.transactions enable row level security;

-- Create policies so users can only see their own data
create policy "Users can view own categories" on categories for select using (auth.uid() = user_id);
create policy "Users can insert own categories" on categories for insert with check (auth.uid() = user_id);
create policy "Users can update own categories" on categories for update using (auth.uid() = user_id);
create policy "Users can delete own categories" on categories for delete using (auth.uid() = user_id);

create policy "Users can view own budgets" on budgets for select using (auth.uid() = user_id);
create policy "Users can insert own budgets" on budgets for insert with check (auth.uid() = user_id);
create policy "Users can update own budgets" on budgets for update using (auth.uid() = user_id);
create policy "Users can delete own budgets" on budgets for delete using (auth.uid() = user_id);

create policy "Users can view own fixed debts" on fixed_debts for select using (auth.uid() = user_id);
create policy "Users can insert own fixed debts" on fixed_debts for insert with check (auth.uid() = user_id);
create policy "Users can update own fixed debts" on fixed_debts for update using (auth.uid() = user_id);
create policy "Users can delete own fixed debts" on fixed_debts for delete using (auth.uid() = user_id);

create policy "Users can view own transactions" on transactions for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on transactions for insert with check (auth.uid() = user_id);
create policy "Users can update own transactions" on transactions for update using (auth.uid() = user_id);
create policy "Users can delete own transactions" on transactions for delete using (auth.uid() = user_id);
