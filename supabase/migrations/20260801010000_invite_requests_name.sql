-- Nome/cognome sulla richiesta di accesso: l'admin che rivede la coda
-- (invite_requests_select_admin) sa a chi sta per inviare l'invito, non solo
-- l'indirizzo email.
alter table invite_requests add column first_name text not null default '';
alter table invite_requests add column last_name text not null default '';
alter table invite_requests alter column first_name drop default;
alter table invite_requests alter column last_name drop default;
