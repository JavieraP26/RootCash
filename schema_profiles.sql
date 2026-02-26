-- SQL Schema: Tabla de Perfiles (Usuarios y Sueldos)

create table public.profiles (
    id uuid references auth.users not null primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    email text not null,
    monthly_income numeric default 0 not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Create policies
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Trigger to automatically create a profile when a new user signs up via Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
