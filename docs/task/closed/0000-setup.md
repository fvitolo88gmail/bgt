# Epica 0 — Setup

**Stato:** ✅ chiusa

## Task

| ID | Task | DoD |
|---|---|---|
| S0.1 | ✅ Scaffold Next.js con TypeScript strict + Tailwind + ESLint + Prettier | `npm run dev` funziona, nessun errore di tipo |
| S0.2 | ✅ Configurazione Vercel: collega repo, configura env vars, deploy placeholder | URL pubblico live |
| S0.3 | ✅ Progetto Supabase: abilita pgvector, applica migration schema completo | migration applicata senza errori |
| S0.4 | ✅ Funzione RPC `match_chunks` in Supabase | chiamata RPC restituisce risultati con score |
| S0.5 | ✅ Client Supabase in `lib/supabase.ts` | connessione verificata |
| S0.6 | ✅ Client Gemini in `lib/gemini.ts` con interfaccia `LLMClient` | embedding restituisce array 768 float |
| S0.7 | ✅ Struttura cartelle completa + `.env.local` | struttura corrisponde a `architecture.md` |
