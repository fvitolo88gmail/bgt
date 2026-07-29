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
import { supabase } from '@/lib/supabase';

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    // Epica 0900 (Chat con contesto) — C5: modalità scelta in /home, passata
    // via query param. Default "qa" se assente o valore non riconosciuto.
    const mode = searchParams.get('mode') === 'conversation' ? 'conversation' : 'qa';
    // D45: un id di sessione nuovo a ogni apertura/refresh della pagina —
    // niente continuità tra aperture diverse della stessa chat per ora
    // (v. decision-log.md).
    const [sessionId] = useState(() => crypto.randomUUID());
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [gameName, setGameName] = useState<string | null>(null);
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
                body: JSON.stringify({ question, gameId: id, mode, sessionId }),
            });

            const data = (await res.json()) as { answer: string; sources: Source[] };

            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: data.answer,
                    sources: data.sources,
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
            <p className="mb-4 text-xs text-ink-faint">
                Modalità: {mode === 'conversation' ? 'conversazione (con storico)' : 'domande (senza storico)'}
            </p>

            <div ref={messagesContainerRef} className="mb-4 flex-1 space-y-4 overflow-y-auto overflow-x-hidden">
                {messages.length === 0 && (
                    <p className="text-sm text-ink-faint">Fai una domanda sulle regole del gioco.</p>
                )}

                {messages.map((msg, i) => (
                    <div key={i} ref={i === messages.length - 1 ? lastMessageRef : undefined}>
                        <MessageBubble message={msg} />
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
