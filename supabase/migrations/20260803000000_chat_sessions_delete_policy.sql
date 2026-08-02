-- Epica CHAT-LISTING — eliminazione conversazione dalla sidebar
-- chat_sessions aveva policy RLS per select/insert/update ma non per delete
-- (stesso pattern di gap già visto per l'update, 20260802000000) — l'app
-- oggi elimina via service client con user_id esplicito nella query
-- (deleteSession, D77), ma la policy resta necessaria per completezza dello
-- schema/RLS e per qualunque futuro accesso diretto via client con sessione.

create policy "chat_sessions_delete" on chat_sessions
    for delete using (
        user_id is null or auth.uid() = user_id or is_admin()
    );
