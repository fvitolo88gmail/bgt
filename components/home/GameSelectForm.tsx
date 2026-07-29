'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { GameOption } from './types';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';

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
            <label htmlFor="game-select" className="text-sm text-ink-soft">
                Scegli il gioco
            </label>
            <Dropdown
                id="game-select"
                value={selectedId}
                onChange={setSelectedId}
                options={games.map((game) => ({ value: game.id, label: game.name }))}
            />

            <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm text-ink-soft">Modalità chat</legend>

                <label className="flex items-start gap-2 text-sm text-ink">
                    <input
                        type="radio"
                        name="chat-mode"
                        value="qa"
                        checked={mode === 'qa'}
                        onChange={() => setMode('qa')}
                        className="mt-1 accent-primary"
                    />
                    <span>
                        <span className="font-medium">Domande</span> — ogni domanda è indipendente,
                        nessuno storico della conversazione.
                    </span>
                </label>

                <label className="flex items-start gap-2 text-sm text-ink">
                    <input
                        type="radio"
                        name="chat-mode"
                        value="conversation"
                        checked={mode === 'conversation'}
                        onChange={() => setMode('conversation')}
                        className="mt-1 accent-primary"
                    />
                    <span>
                        <span className="font-medium">Conversazione</span> — l&apos;assistente ricorda
                        i turni precedenti per rispondere a domande di follow-up.{' '}
                        <span className="text-ink-faint">Consuma più risorse (quota Gemini).</span>
                    </span>
                </label>
            </fieldset>

            <Button type="submit" disabled={!selectedId}>
                Vai alla chat
            </Button>
        </form>
    );
}
