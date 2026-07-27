'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { GameOption } from './types';

// Epica 0900 (Chat con contesto) — C5: modalità scelta qui, non con un
// toggle dentro la chat — v. note di scope in docs/task/0900-chat-con-contesto.md.
type ChatMode = 'qa' | 'conversation';

export function GameSelectForm({ games }: { games: GameOption[] }) {
    const router = useRouter();
    const [selectedId, setSelectedId] = useState(games[0]?.id ?? '');
    const [mode, setMode] = useState<ChatMode>('qa');

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedId) return;
        router.push(`/game/${selectedId}?mode=${mode}`);
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor="game-select" className="text-sm text-gray-600">
                Scegli il gioco
            </label>
            <select
                id="game-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {games.map((game) => (
                    <option key={game.id} value={game.id}>
                        {game.name}
                    </option>
                ))}
            </select>

            <fieldset className="flex flex-col gap-2">
                <legend className="text-sm text-gray-600 mb-1">Modalità chat</legend>

                <label className="flex items-start gap-2 text-sm">
                    <input
                        type="radio"
                        name="chat-mode"
                        value="qa"
                        checked={mode === 'qa'}
                        onChange={() => setMode('qa')}
                        className="mt-1"
                    />
                    <span>
                        <span className="font-medium">Domande</span> — ogni domanda è indipendente,
                        nessuno storico della conversazione.
                    </span>
                </label>

                <label className="flex items-start gap-2 text-sm">
                    <input
                        type="radio"
                        name="chat-mode"
                        value="conversation"
                        checked={mode === 'conversation'}
                        onChange={() => setMode('conversation')}
                        className="mt-1"
                    />
                    <span>
                        <span className="font-medium">Conversazione</span> — l&apos;assistente ricorda
                        i turni precedenti per rispondere a domande di follow-up.{' '}
                        <span className="text-gray-500">Consuma più risorse (quota Gemini).</span>
                    </span>
                </label>
            </fieldset>

            <button
                type="submit"
                disabled={!selectedId}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700"
            >
                Vai alla chat
            </button>
        </form>
    );
}
