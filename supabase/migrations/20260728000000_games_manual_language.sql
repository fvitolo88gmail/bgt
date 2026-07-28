-- Epica 0551 (L1) — Retrieval: lingua HyDE e recall manuale
-- La lingua del manuale ingested varia da gioco a gioco (constatato con
-- Francesco) — necessaria per parametrizzare QUERY_ENHANCEMENT_PROMPT
-- (lib/retrieval.ts) in modo che i paragrafi HyDE generati siano nella
-- stessa lingua del corpus target, invece di ereditare silenziosamente la
-- lingua della domanda dell'utente (causa radice diagnosticata in D46).
-- Default 'en': tutti i giochi ingested finora (Hegemony) hanno manuale in
-- inglese; valore esplicito per non lasciare il campo ambiguo su NULL.

alter table games
    add column manual_language text not null default 'en';

comment on column games.manual_language is
    'Lingua del testo del manuale ingested (codice ISO 639-1, es. en/it/de). Usata per generare i paragrafi HyDE nella stessa lingua del corpus — v. Epica 0551, D46.';
