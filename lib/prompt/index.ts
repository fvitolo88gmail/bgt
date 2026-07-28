// lib/prompt/index.ts
//
// Punto d'ingresso unico per i consumer (`@/lib/prompt`) — riesporta le due
// specializzazioni (qa, conversation) e le utility condivise, così i call
// site non devono conoscere la struttura interna della cartella.

export { buildPrompt } from './qa';
export { buildConversationPrompt, buildHistorySection, type ConversationTurn } from './conversation';
export { buildContext } from './shared';
