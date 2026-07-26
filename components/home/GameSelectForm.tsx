'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { GameOption } from './types';

export function GameSelectForm({ games }: { games: GameOption[] }) {
    const router = useRouter();
    const [selectedId, setSelectedId] = useState(games[0]?.id ?? '');

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedId) return;
        router.push(`/game/${selectedId}`);
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
