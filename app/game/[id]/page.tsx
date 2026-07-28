'use client';

import { use } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatMessage, Source } from '@/components/chat/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

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
            <h1 className="mb-1 font-serif text-xl font-bold text-ink">Assistente Regole</h1>
            <p className="mb-4 text-xs text-ink-faint">
                Modalità: {mode === 'conversation' ? 'conversazione (con storico)' : 'domande (senza storico)'}
            </p>

            <div className="mb-4 flex-1 space-y-4 overflow-y-auto">
                {messages.length === 0 && (
                    <p className="text-sm text-ink-faint">Fai una domanda sulle regole del gioco.</p>
                )}

                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <Card className="px-4 py-2">
                            <p className="text-sm text-ink-faint">Sto cercando...</p>
                        </Card>
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
