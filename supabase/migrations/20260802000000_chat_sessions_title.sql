-- Epica CHAT-LISTING — CHAT-LISTING-00001
-- chat_sessions guadagna titolo e timestamp ultimo messaggio, prerequisiti per
-- elencare/riprendere conversazioni (CHAT-LISTING-00002/00003). Nessun cambio
-- al vincolo di unicità: più conversazioni per lo stesso game_id sono già
-- ammesse dal 2026-07-27 (chat_sessions_drop_unique_per_game).

alter table chat_sessions
    add column title text null,
    add column last_message_at timestamptz null;

-- backfill: sessioni esistenti restano accessibili come prima conversazione,
-- ordinabili da subito per ultimo messaggio (fallback a created_at se senza
-- messaggi, es. la sessione creata da getOrCreateSession prima del primo turno).
update chat_sessions cs
set last_message_at = coalesce(
    (select max(cm.created_at) from chat_messages cm where cm.session_id = cs.id),
    cs.created_at
);

-- elenco conversazioni di un utente per un gioco, ordinate per ultimo messaggio
create index on chat_sessions (user_id, game_id, last_message_at desc);

-- mancava una policy di update su chat_sessions (solo select/insert):
-- necessaria per salvare titolo e last_message_at dopo la creazione, stesso
-- pattern già seguito per chat_messages (20260730030000).
create policy "chat_sessions_update" on chat_sessions
    for update using (
        user_id is null or auth.uid() = user_id or is_admin()
    )
    with check (
        user_id is null or auth.uid() = user_id or is_admin()
    );
