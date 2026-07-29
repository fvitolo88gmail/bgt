# AUTH-00010 — Configurazione SMTP custom (Resend)

**Stato:** todo — in attesa dell'acquisto di un dominio (v. D73, nota in AUTH-00008)

**Blocca:** AUTH-00008

## Task

Quando si acquista un dominio per il progetto: crea account Resend, verifica il dominio (record
DNS SPF/DKIM), genera una API key. Configura Supabase (Authentication → Email → SMTP Settings)
con le credenziali Resend (host `smtp.resend.com`, porta `465`, user `resend`, password = API
key) e un sender email/nome sul dominio verificato.

## DoD

Un invito mandato da Supabase Studio (Authentication → Users → Invite) arriva davvero a un
destinatario esterno al team del progetto Supabase; nessun rate limit incontrato nell'uso
normale (limite Resend free 3.000 email/mese, non i 2/ora del servizio built-in). Il processo
manuale interinale ("Create new user" via Studio, v. AUTH-00008) può essere abbandonato in
favore dell'invito email reale.
