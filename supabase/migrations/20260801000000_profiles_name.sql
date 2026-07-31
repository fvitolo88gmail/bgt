-- DESIGN-00004: nome/cognome su profiles, per il saluto in /home e il menu
-- avatar. Nullable: un utente esistente non ha ancora questi dati finché non
-- passa dalla pagina profilo.
alter table profiles add column first_name text;
alter table profiles add column last_name text;
