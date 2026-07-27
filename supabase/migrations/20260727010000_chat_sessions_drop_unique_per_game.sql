-- Epica 0900 (Chat con contesto) — D45.
-- Il vincolo introdotto in C1 (una sessione per game_id) era corretto per lo
-- scope iniziale (owner_token non implementato) ma causava il bug segnalato
-- da Francesco: ogni apertura della chat per lo stesso gioco riusava la
-- stessa sessione/history invece di partirne una nuova. Ora il session id è
-- generato dal client a ogni apertura pagina, quindi più sessioni per lo
-- stesso game_id sono normali e attese.
drop index if exists chat_sessions_game_id_idx;
