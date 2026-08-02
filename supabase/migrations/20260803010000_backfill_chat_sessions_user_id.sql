-- Backfill una tantum: alcune chat_sessions sono rimaste con user_id null nonostante create
-- da utenti autenticati, per una race di sessione lato client che invalidava temporaneamente
-- il token durante la creazione della sessione — invisibili nel listing per utente, che filtra
-- esplicitamente per user_id. Recupero l'owner da user_requests, che traccia lo stesso
-- session_id con user_id sempre valorizzato in pratica per richieste autenticate. Sessioni
-- senza alcun user_request con user_id valorizzato restano user_id null (davvero anonime,
-- storico legacy).
update chat_sessions cs
set user_id = ur.user_id
from (
    select distinct on (session_id) session_id, user_id
    from user_requests
    where session_id is not null and user_id is not null
    order by session_id, created_at asc
) ur
where cs.id = ur.session_id
  and cs.user_id is null;
