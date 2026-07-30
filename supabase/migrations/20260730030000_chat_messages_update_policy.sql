-- chat_messages aveva policy RLS per select/insert ma non per update: il salvataggio del
-- feedback (pollice su/giù) tramite client anon veniva bloccato silenziosamente (0 righe
-- aggiornate, nessun errore) invece di fallire in modo visibile.

create policy "chat_messages_update" on chat_messages
    for update using (
        exists (
            select 1 from chat_sessions
            where chat_sessions.id = chat_messages.session_id
              and (chat_sessions.user_id is null or chat_sessions.user_id = auth.uid() or is_admin())
        )
    )
    with check (
        exists (
            select 1 from chat_sessions
            where chat_sessions.id = chat_messages.session_id
              and (chat_sessions.user_id is null or chat_sessions.user_id = auth.uid() or is_admin())
        )
    );
