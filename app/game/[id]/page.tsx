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
import { supabase } from '@/lib/shared/supabase';

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    // modalità scelta in /home, passata via query param. Default "qa" se assente o non riconosciuta.
    const mode = searchParams.get('mode') === 'conversation' ? 'conversation' : 'qa';
    // Sessione mutabile (non più fissa per apertura pagina): la sidebar (solo
    // modalità conversation, CHAT-LISTING-00002) può farne partire una nuova
    // o selezionarne una precedente dall'elenco.
    const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
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
        // Struttura mutuata da AdminShell (sidebar + contenuto a piena altezza,
        // nessun riquadro bordato che confini la chat) per coerenza di
        // piattaforma: qui la sidebar è violetta (pannello applicativo, v.
        // architecture.md), non nera (quella è riservata ai pannelli admin).
        // flex-col sotto md: sotto quella soglia ConversationSidebar collassa
        // in una seconda top bar invece di stare affiancata alla chat.
        <div className="flex w-full flex-1 flex-col overflow-hidden md:flex-row">
            {mode === 'conversation' && (
                <ConversationSidebar
                    gameId={id}
                    activeSessionId={sessionId}
                    refreshKey={sidebarRefreshKey}
                    onSelect={handleSelectConversation}
                    onActiveConversationDeleted={handleActiveConversationDeleted}
                />
            )}

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="border-b border-line px-4 py-4 sm:px-8">
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

                <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-8 py-5">
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

                <div className="relative border-t border-line px-8 py-4">
                    {/* Ancorato a questo contenitore (non alla lista messaggi, che scrolla):
                        "-top" negativo lo fa fluttuare appena sopra la barra di input,
                        indipendentemente da quanto la chat sopra sia scrollata. Sempre in
                        questa posizione sia a schermo largo che stretto (non richiesta una
                        variante responsive). */}
                    {mode === 'conversation' && messages.length > 0 && (
                        <button
                            type="button"
                            onClick={handleNewConversation}
                            title="Nuova conversazione"
                            aria-label="Nuova conversazione"
                            className="absolute -top-16 right-4 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md transition-colors hover:bg-primary-hover sm:right-8"
                        >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </button>
                    )}

                    <div className="mx-auto flex w-full max-w-3xl gap-2.5">
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
                </div>
            </div>
        </div>
    );
}
