'use client';

import { use } from 'react';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatMessage, Source } from '@/components/chat/types';

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
        <main className="max-w-2xl mx-auto p-4 flex flex-col h-screen">
            <h1 className="text-xl font-bold mb-1">Assistente Regole</h1>
            <p className="text-xs text-gray-400 mb-4">
                Modalità: {mode === 'conversation' ? 'conversazione (con storico)' : 'domande (senza storico)'}
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.length === 0 && (
                    <p className="text-gray-400 text-sm">Fai una domanda sulle regole del gioco.</p>
                )}

                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg px-4 py-2">
                            <p className="text-sm text-gray-400">Sto cercando...</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="Fai una domanda sulle regole..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700"
                >
                    Invia
                </button>
            </div>
        </main>
    );
}
