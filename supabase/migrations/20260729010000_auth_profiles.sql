-- ruolo utente come enum nativo (invece di text/check) per validazione a livello di tipo
create type user_role as enum ('admin', 'user');

-- profiles: 1:1 con auth.users, riga creata automaticamente al signup (trigger sotto)
create table profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role user_role not null default 'user',
    created_at timestamptz not null default now()
);

-- RLS abilitata da subito (principio architetturale: enforcement a livello DB, non solo
-- applicativo) — nessuna policy qui: le policy sono AUTH-00003, fino ad allora la tabella
-- resta accessibile solo alla service role
alter table profiles enable row level security;

-- crea automaticamente la riga profiles al signup
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id) values (new.id);
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();
