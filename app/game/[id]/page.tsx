'use client';

import { use } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { ChatMessage, Source } from '@/components/chat/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { OwlLoader } from '@/components/ui/OwlLoader';
import { CITATIONS_DISCLAIMER } from '@/components/ui/Footer';
import { supabase } from '@/lib/shared/supabase';

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    // modalità scelta in /home, passata via query param. Default "qa" se assente o non riconosciuta.
    const mode = searchParams.get('mode') === 'conversation' ? 'conversation' : 'qa';
    // Sessione mutabile (non più fissa per apertura pagina): il pannello
    // conversazioni (solo modalità conversation) può farne partire una nuova
    // o selezionarne una precedente dall'elenco.
    const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
    // Apertura del pannello conversazioni sotto md. Lo stato vive qui, non in
    // ConversationSidebar, perché il trigger sta nell'header del gioco.
    const [isConversationsOpen, setIsConversationsOpen] = useState(false);
    // Incrementato dopo ogni risposta salvata, per far ricomparire nella
    // sidebar la conversazione corrente/il titolo appena generato al primo
    // turno, senza polling continuo.
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    // Distinto da `loading` (attesa di una risposta): qui è il caricamento
    // della history di una conversazione selezionata dalla sidebar.
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState(false);
    const [gameName, setGameName] = useState<string | null>(null);
    // Espansioni collegate a questo gioco base (games.base_game_id) — di default nessuna
    // selezionata: il retrieval resta scoped al solo manuale base finché l'utente non le
    // attiva esplicitamente per la partita in corso. Selezione non persistita (per-sessione).
    const [expansions, setExpansions] = useState<{ id: string; name: string }[]>([]);
    const [selectedExpansionIds, setSelectedExpansionIds] = useState<string[]>([]);
    // Ref sull'ultimo messaggio (domanda o risposta) e sul contenitore
    // scrollabile: calcolo diretto dello scrollTop (invece di scrollIntoView,
    // che allinea al bordo dello scrollport più vicino ma non garantisce di
    // arrivare fino in cima in ogni browser) per portare ogni nuovo messaggio
    // esattamente al bordo superiore — sia la domanda sia, quando arriva, la
    // risposta — invece di lasciarlo in fondo sotto contenuto precedente lungo.
    const lastMessageRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = messagesContainerRef.current;
        const target = lastMessageRef.current;
        if (!container || !target) return;
        container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
    }, [messages]);

    // Nome del gioco caricato lato client per intestare la chat — non arriva
    // già da /home (la navigazione passa solo id/mode in query), quindi va
    // recuperato qui invece di duplicare lo stato tra le due pagine.
    useEffect(() => {
        let cancelled = false;

        supabase
            .from('games')
            .select('name')
            .eq('id', id)
            .single()
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) {
                    console.error('[game] errore caricando il nome del gioco:', error.message);
                    return;
                }
                setGameName(data?.name ?? null);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    // Espansioni disponibili per questo gioco — caricate a parte dal nome, stesso pattern
    // (fetch client-side, non passato da /home).
    useEffect(() => {
        let cancelled = false;

        supabase
            .from('games')
            .select('id, name')
            .eq('base_game_id', id)
            .order('name')
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) {
                    console.error('[game] errore caricando le espansioni:', error.message);
                    return;
                }
                setExpansions(data ?? []);
            });

        return () => {
            cancelled = true;
        };
    }, [id]);

    // Aggiorna subito lo stato locale (feedback "premuto") e invia in background;
    // in caso di errore lo stato resta com'era prima del click, l'utente può riprovare.
    // Click sul voto già selezionato → toggle: il feedback torna a null (deselezionato).
    async function handleFeedback(index: number, feedback: 'good' | 'bad') {
        const target = messages[index];
        if (!target?.messageId) return;

        const previousFeedback = target.feedback ?? null;
        const nextFeedback = previousFeedback === feedback ? null : feedback;

        setMessages((prev) =>
            prev.map((msg, i) => (i === index ? { ...msg, feedback: nextFeedback } : msg)),
        );

        try {
            const res = await fetch('/api/chat/feedback', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: target.messageId, feedback: nextFeedback }),
            });
            if (!res.ok) throw new Error(`status ${res.status}`);
        } catch (err) {
            console.error('[game] errore salvando il feedback:', err);
            setMessages((prev) =>
                prev.map((msg, i) => (i === index ? { ...msg, feedback: previousFeedback } : msg)),
            );
        }
    }

    function toggleExpansion(expansionId: string) {
        setSelectedExpansionIds((prev) =>
            prev.includes(expansionId)
                ? prev.filter((e) => e !== expansionId)
                : [...prev, expansionId],
        );
    }

    async function handleSubmit() {
        if (!input.trim() || loading) return;

        const question = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: question }]);
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question, gameId: id, mode, sessionId, expansionGameIds: selectedExpansionIds }),
            });

            const data = (await res.json()) as { answer: string; sources: Source[]; messageId: string | null };

            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: data.answer,
                    sources: data.sources,
                    messageId: data.messageId,
                },
            ]);
            // Rinfresca la sidebar: la prima risposta di una conversazione le dà un titolo,
            // le successive aggiornano solo l'ordinamento per ultimo messaggio.
            if (mode === 'conversation') setSidebarRefreshKey((prev) => prev + 1);
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Errore nella risposta. Riprova.' },
            ]);
        } finally {
            setLoading(false);
        }
    }

    // Selezione dalla sidebar (CHAT-LISTING-00003): passa alla sessione scelta
    // e ricarica la history reale da chat_messages, invece di ripartire da
    // una chat vuota — le fonti non sono persistite (chat_messages non le
    // salva, v. schema), quindi i messaggi assistant ricaricati non le
    // mostrano, a differenza di quelli appena arrivati nella stessa sessione.
    // Non c'è un pulsante "nuova conversazione" separato: la pagina parte già
    // su una chat vuota (nessuna sessione selezionata) e la conversazione
    // viene registrata solo alla prima domanda inviata (getOrCreateSession).
    async function handleSelectConversation(selectedSessionId: string) {
        setSessionId(selectedSessionId);
        setMessages([]);
        setHistoryError(false);
        setLoadingHistory(true);

        try {
            const res = await fetch(`/api/chat/sessions/${selectedSessionId}/messages`);
            if (!res.ok) throw new Error(`status ${res.status}`);

            const data = (await res.json()) as {
                messages: { id: string; role: 'user' | 'assistant'; content: string; feedback: 'good' | 'bad' | null }[];
            };
            setMessages(
                data.messages.map((msg) => ({
                    role: msg.role,
                    content: msg.content,
                    messageId: msg.id,
                    feedback: msg.feedback,
                })),
            );
        } catch (err) {
            console.error('[game] errore caricando la conversazione selezionata:', err);
            setHistoryError(true);
        } finally {
            setLoadingHistory(false);
        }
    }

    // La conversazione aperta è stata eliminata dalla sidebar: non c'è più
    // nulla da mostrare, si riparte da una chat vuota (stesso stato di
    // apertura pagina) invece di lasciare in vista messaggi ormai orfani.
    function handleActiveConversationDeleted() {
        setSessionId(crypto.randomUUID());
        setMessages([]);
        setHistoryError(false);
    }

    // Una volta caricata una conversazione (ripresa dalla sidebar o già
    // avviata inviando il primo messaggio) non c'è altro modo di tornare a
    // una chat vuota se non ricaricare la pagina — pulsante visibile solo a
    // quel punto (messages.length > 0), non anche a chat già vuota: lì è
    // ridondante, la pagina parte già in quello stato.
    function handleNewConversation() {
        setSessionId(crypto.randomUUID());
        setMessages([]);
        setHistoryError(false);
    }

    return (
        // Struttura mutuata da AdminShell (pannello + contenuto a piena altezza,
        // nessun riquadro bordato che confini la chat) per coerenza di
        // piattaforma: qui il pannello è violetto (applicativo, v.
        // architecture.md), non nero (quello è riservato ai pannelli admin).
        // L'header del gioco sta sopra entrambe le colonne, non dentro quella
        // della chat: così la riga di separazione in cima è una sola e continua,
        // e non c'è un'altezza da tenere allineata tra due fasce affiancate.
        <div className="flex w-full flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-4 sm:px-6">
                {/* Sotto md il pannello conversazioni non è affiancato alla chat: si apre
                    da qui come overlay. Da md in su la colonna è sempre visibile. */}
                {mode === 'conversation' && (
                    <button
                        type="button"
                        aria-label={isConversationsOpen ? 'Chiudi conversazioni' : 'Apri conversazioni'}
                        aria-expanded={isConversationsOpen}
                        onClick={() => setIsConversationsOpen((open) => !open)}
                        className="-ml-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[7px] text-ink-soft transition-colors hover:bg-primary-soft md:hidden"
                    >
                        {isConversationsOpen ? (
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                            </svg>
                        )}
                    </button>
                )}

                <div className="min-w-0 flex-1">
                    <h1 className="font-serif text-lg font-bold text-ink">{gameName ?? 'Assistente Regole'}</h1>
                    <p className="text-[10.5px] font-bold tracking-wide text-ink-faint uppercase">
                        {mode === 'conversation' ? 'Conversazione — con storico' : 'Domande — senza storico'}
                    </p>

                    {expansions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-3">
                            {expansions.map((expansion) => (
                                <label key={expansion.id} className="flex items-center gap-1.5 text-xs text-ink-faint">
                                    <input
                                        type="checkbox"
                                        checked={selectedExpansionIds.includes(expansion.id)}
                                        onChange={() => toggleExpansion(expansion.id)}
                                    />
                                    Includi: {expansion.name}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* relative: ancora l'overlay del pannello conversazioni (sotto md) a
                quest'area, che inizia già sotto l'header globale e sotto quello del
                gioco — un inset-0 su un antenato più in alto ne coprirebbe una parte. */}
            <div className="relative flex min-h-0 flex-1">
                {mode === 'conversation' && (
                    <ConversationSidebar
                        gameId={id}
                        activeSessionId={sessionId}
                        refreshKey={sidebarRefreshKey}
                        isMenuOpen={isConversationsOpen}
                        onCloseMenu={() => setIsConversationsOpen(false)}
                        onSelect={handleSelectConversation}
                        onNewConversation={handleNewConversation}
                        onActiveConversationDeleted={handleActiveConversationDeleted}
                    />
                )}

                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {/* relative: lo scroll ai nuovi messaggi calcola `offsetTop` rispetto
                        all'offsetParent, che deve essere questo contenitore — se lo fosse un
                        antenato più in alto, il valore includerebbe anche l'altezza dell'header. */}
                    <div ref={messagesContainerRef} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6">
                        {/* max-w interno solo per leggibilità del testo — lo sfondo/i bordi della chat restano a piena larghezza, non confinati in un riquadro */}
                        <div className="mx-auto flex w-full max-w-3xl flex-col space-y-4">
                            {loadingHistory && (
                                <p className="text-sm text-ink-faint">Carico la conversazione...</p>
                            )}

                            {historyError && (
                                <p className="text-sm text-danger">
                                    Errore caricando questa conversazione. Riprova selezionandola di nuovo dalla sidebar.
                                </p>
                            )}

                            {messages.map((msg, i) => (
                                <div key={i} ref={i === messages.length - 1 ? lastMessageRef : undefined}>
                                    <MessageBubble message={msg} onFeedback={(feedback) => handleFeedback(i, feedback)} />
                                </div>
                            ))}

                            {loading && (
                                <div className="flex items-center gap-3">
                                    <Card className="rounded-md rounded-bl-[3px] border-line-soft px-4 py-3">
                                        <p className="text-sm text-ink-faint">Sto cercando...</p>
                                    </Card>
                                    <OwlLoader />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 border-t border-line px-4 py-4 sm:px-6">
                        <div className="mx-auto w-full max-w-3xl">
                            <div className="flex gap-2.5">
                                <Input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                    placeholder="Fai una domanda sulle regole..."
                                />
                                <Button onClick={handleSubmit} disabled={loading}>
                                    {/* "Avvia nuova conversazione" solo in modalità conversation: in QA
                                        non esiste il concetto di conversazione salvata da avviare. */}
                                    {mode === 'conversation' && messages.length === 0 ? 'Avvia nuova conversazione' : 'Invia'}
                                </Button>
                            </div>
                            {/* Qui invece che nel footer globale (nascosto su questa pagina): senza
                                bordo né fascia propria, resta accanto alle risposte di cui parla. */}
                            <p className="mt-2 text-center text-[10.5px] text-ink-faint">
                                {CITATIONS_DISCLAIMER}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
