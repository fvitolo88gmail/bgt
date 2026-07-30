-- Feedback utente (pollice su/giù) sui messaggi assistant, per analisi manuale.
-- Solo modalità "conversation" popola questa colonna (l'unica che salva chat_messages oggi).

alter table chat_messages
    add column feedback text null check (feedback in ('good', 'bad'));
