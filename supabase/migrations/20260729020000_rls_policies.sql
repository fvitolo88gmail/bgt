-- ATTENZIONE prima di applicare: verificare che games.visibility = 'shared' per tutti i
-- giochi in uso pubblico oggi (Brass Birmingham, Hegemony). L'app usa sempre la chiave anon
-- senza sessione: dopo questa migration un game con visibility != 'shared' e user_id null
-- diventerebbe invisibile a chiunque, rompendo l'app in produzione.

-- ruolo admin riusabile nelle policy sotto — security definer per evitare ricorsione RLS
-- su profiles quando viene chiamata da una policy di profiles stessa
create function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from profiles where id = auth.uid() and role = 'admin'
    );
$$;

-- proprietà diretta: games e chat_sessions guadagnano user_id (nullable — righe esistenti e
-- flusso anonimo corrente restano orfane/aperte, coerente con D67)
alter table games add column user_id uuid references profiles(id) on delete set null;
alter table chat_sessions add column user_id uuid references profiles(id) on delete set null;

-- blocca l'auto-promozione: un utente non può cambiare il proprio role via update diretto,
-- solo un admin può farlo
create function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.role is distinct from old.role and not is_admin() then
        new.role := old.role;
    end if;
    return new;
end;
$$;

create trigger profiles_prevent_role_escalation
    before update on profiles
    for each row execute function prevent_role_self_escalation();

-- profiles: ognuno vede/modifica solo la propria riga, admin vede/modifica tutte
create policy "profiles_select_own_or_admin" on profiles
    for select using (auth.uid() = id or is_admin());

create policy "profiles_update_own_or_admin" on profiles
    for update using (auth.uid() = id or is_admin())
    with check (auth.uid() = id or is_admin());

-- games: shared visibile a chiunque (anche anonimo), privato solo a owner/admin
alter table games enable row level security;

create policy "games_select_shared_or_own_or_admin" on games
    for select using (visibility = 'shared' or auth.uid() = user_id or is_admin());

create policy "games_insert_own_or_admin" on games
    for insert with check (auth.uid() = user_id or is_admin());

create policy "games_update_own_or_admin" on games
    for update using (auth.uid() = user_id or is_admin())
    with check (auth.uid() = user_id or is_admin());

create policy "games_delete_own_or_admin" on games
    for delete using (auth.uid() = user_id or is_admin());

-- chunks/forum_threads/forum_posts: nessuna colonna utente propria, ownership ereditata da
-- games via game_id — solo select (le scritture restano riservate all'ingest, service role,
-- che bypassa comunque RLS)
alter table chunks enable row level security;

create policy "chunks_select_via_game" on chunks
    for select using (
        exists (
            select 1 from games
            where games.id = chunks.game_id
              and (games.visibility = 'shared' or games.user_id = auth.uid() or is_admin())
        )
    );

alter table forum_threads enable row level security;

create policy "forum_threads_select_via_game" on forum_threads
    for select using (
        exists (
            select 1 from games
            where games.id = forum_threads.game_id
              and (games.visibility = 'shared' or games.user_id = auth.uid() or is_admin())
        )
    );

alter table forum_posts enable row level security;

create policy "forum_posts_select_via_game" on forum_posts
    for select using (
        exists (
            select 1 from games
            where games.id = forum_posts.game_id
              and (games.visibility = 'shared' or games.user_id = auth.uid() or is_admin())
        )
    );

-- chat_sessions: user_id null = sessione anonima, resta aperta come oggi (nessuna
-- restrizione reale finché l'app non popola user_id per utenti loggati); user_id valorizzato
-- diventa privata a quell'utente (o admin)
alter table chat_sessions enable row level security;

create policy "chat_sessions_select" on chat_sessions
    for select using (user_id is null or auth.uid() = user_id or is_admin());

create policy "chat_sessions_insert" on chat_sessions
    for insert with check (user_id is null or auth.uid() = user_id or is_admin());

-- chat_messages: nessuna colonna utente propria, ownership ereditata da chat_sessions via
-- session_id, stessa logica di apertura per sessioni anonime
alter table chat_messages enable row level security;

create policy "chat_messages_select" on chat_messages
    for select using (
        exists (
            select 1 from chat_sessions
            where chat_sessions.id = chat_messages.session_id
              and (chat_sessions.user_id is null or chat_sessions.user_id = auth.uid() or is_admin())
        )
    );

create policy "chat_messages_insert" on chat_messages
    for insert with check (
        exists (
            select 1 from chat_sessions
            where chat_sessions.id = chat_messages.session_id
              and (chat_sessions.user_id is null or chat_sessions.user_id = auth.uid() or is_admin())
        )
    );
