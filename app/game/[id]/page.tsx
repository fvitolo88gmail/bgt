'use client';

import { use } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageBubble } from '@/components/chat/MessageBubble';
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
    // un id di sessione nuovo a ogni apertura/refresh della pagina — niente continuità tra
    // aperture diverse della stessa chat per ora
    const [sessionId] = useState(() => crypto.randomUUID());
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
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
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', content: 'Errore nella risposta. Riprova.' },
            ]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden p-4">
            <h1 className="mb-1 font-serif text-xl font-bold text-ink">{gameName ?? 'Assistente Regole'}</h1>
            <p className="mb-1 text-xs text-ink-faint">
                Modalità: {mode === 'conversation' ? 'conversazione (con storico)' : 'domande (senza storico)'}
            </p>

            {expansions.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-3">
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

            <div ref={messagesContainerRef} className="mb-4 flex-1 space-y-4 overflow-y-auto overflow-x-hidden">
                {messages.length === 0 && (
                    <p className="text-sm text-ink-faint">Fai una domanda sulle regole del gioco.</p>
                )}

                {messages.map((msg, i) => (
                    <div key={i} ref={i === messages.length - 1 ? lastMessageRef : undefined}>
                        <MessageBubble message={msg} onFeedback={(feedback) => handleFeedback(i, feedback)} />
                    </div>
                ))}

                {loading && (
                    <div className="flex items-center gap-3">
                        <Card className="px-4 py-2">
                            <p className="text-sm text-ink-faint">Sto cercando...</p>
                        </Card>
                        <OwlLoader />
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <Input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="Fai una domanda sulle regole..."
                />
                <Button onClick={handleSubmit} disabled={loading}>
                    Invia
                </Button>
            </div>
        </div>
    );
}
