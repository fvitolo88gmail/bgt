'use client';

import { use } from 'react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Source {
    source: 'manual' | 'forum';
    page: number | null;
    section: string | null;
    threadSubject: string | null;
    isDesignerResponse: boolean | null;
    similarity: number;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    sources?: Source[];
}

function sourceLabel(s: Source): string {
    if (s.source === 'forum') {
        return s.threadSubject ? `Forum — ${s.threadSubject}` : 'Forum';
    }
    return s.section ?? (s.page != null ? `Pagina ${s.page}` : 'Manuale');
}

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
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
                body: JSON.stringify({ question, gameId: id }),
            });

            const data = await res.json() as { answer: string; sources: Source[] };

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
            <h1 className="text-xl font-bold mb-4">Assistente Regole</h1>

            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.length === 0 && (
                    <p className="text-gray-400 text-sm">Fai una domanda sulle regole del gioco.</p>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-prose rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                        }`}>
                            {msg.role === 'assistant' ? (
                                <div className="text-sm [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_strong]:font-semibold">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-sm">{msg.content}</p>
                            )}

                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-gray-300">
                                    <p className="text-xs text-gray-500 font-medium mb-1">Fonti:</p>
                                    <ul className="space-y-0.5">
                                        {[...msg.sources]
                                            .sort((a, b) => b.similarity - a.similarity)
                                            .map((s, j) => (
                                                <li key={j} className="text-xs text-gray-500">
                                                    <span className="font-medium text-gray-600">
                                                        {sourceLabel(s)}
                                                    </span>
                                                    {s.isDesignerResponse && (
                                                        <span className="text-amber-600 font-medium"> · risposta del designer</span>
                                                    )}
                                                    <span className="text-gray-400">
                                                        {' '}
                                                        · rilevanza {Math.round(s.similarity * 100)}%
                                                    </span>
                                                </li>
                                            ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
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