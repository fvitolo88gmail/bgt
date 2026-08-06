'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GameOption, RecentConversation } from './types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChatModeToggle, ChatMode } from './ChatModeToggle';
import { GameChipSelect } from './GameChipSelect';
import { ResumeConversations } from './ResumeConversations';

// Icone dei badge fonte, riprese dal riferimento del design system
// (data-dc-tpl="263"/"269" in docs/design-reference/BGT Design System -
// Standalone.html): libro per il manuale, fumetto per il forum community.
function ManualIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
    );
}

function CommunityIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <rect x="3" y="5" width="18" height="12" rx="4" />
            <polygon points="8,17 8,21 12,17" fill="currentColor" stroke="none" />
        </svg>
    );
}

interface QuestionHomeFormProps {
    games: GameOption[];
    recentConversations: RecentConversation[];
}

export function QuestionHomeForm({ games, recentConversations }: QuestionHomeFormProps) {
    const router = useRouter();
    const [question, setQuestion] = useState('');
    const [gameId, setGameId] = useState(games[0]?.id ?? '');
    // Scelta qui, non dentro la chat: /game/[id] non ha un controllo proprio
    // per cambiare modalità a metà conversazione.
    const [mode, setMode] = useState<ChatMode>('qa');
    const selectedGame = games.find((game) => game.id === gameId);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = question.trim();
        if (!trimmed || !gameId) return;
        router.push(`/game/${gameId}?mode=${mode}&q=${encodeURIComponent(trimmed)}`);
    }

    return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {/* Bordo pieno primary + ring soft (non il bordo grigio generico di
                    Card): questo box è il fuoco della pagina, deve leggersi come tale
                    anche a riposo, non solo quando riceve focus. */}
                <div className="rounded-lg border border-primary bg-paper p-3.5 ring-2 ring-primary-soft">
                    <textarea
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Scrivi la tua domanda sulle regole…"
                        rows={2}
                        className="w-full resize-none border-none bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                e.currentTarget.form?.requestSubmit();
                            }
                        }}
                    />
                    {/* Due righe con ruoli fissi, non legate al numero di badge: 1) gioco +
                        bottone — sempre e solo questi due elementi, quindi sempre ci stanno
                        (il chip tronca con ellipsis, il bottone si riduce alla sola icona
                        sotto sm); 2) badge fonte, riga a parte che va a capo solo al proprio
                        interno — 0, 1 o 2 badge non influenzano mai la riga sopra. */}
                    <div className="mt-2 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 font-mono text-[11px] text-ink-faint">gioco:</span>
                                {games.length > 0 ? (
                                    <GameChipSelect games={games} value={gameId} onChange={setGameId} />
                                ) : (
                                    <span className="text-xs text-ink-faint">Nessun gioco disponibile</span>
                                )}
                            </div>
                            <Button
                                type="submit"
                                disabled={!question.trim() || !gameId}
                                aria-label="Chiedi"
                                className="flex shrink-0 items-center gap-1.5 px-2.5 sm:px-4"
                            >
                                <span className="hidden sm:inline">Chiedi</span>
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="currentColor" aria-hidden="true">
                                    <polygon points="3,20 21,12 3,4 3,10 15,12 3,14" />
                                </svg>
                            </Button>
                        </div>

                        {/* Solo le fonti pronte, non un badge "mancante" per l'altra. */}
                        {(selectedGame?.manualReady || selectedGame?.communityReady) && (
                            <div className="flex flex-wrap items-center gap-2">
                                {selectedGame?.manualReady && (
                                    <Badge variant="neutral" className="shrink-0" aria-label="Manuale disponibile">
                                        <ManualIcon />
                                        <span>Manuale ✓</span>
                                    </Badge>
                                )}
                                {selectedGame?.communityReady && (
                                    <Badge variant="community" className="shrink-0" aria-label="Community disponibile">
                                        <CommunityIcon />
                                        <span>Community ✓</span>
                                    </Badge>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Centrato (non allineato a sinistra come il resto del form): è
                    un'opzione secondaria e autonoma, non legata al flusso a griglia
                    di gioco/badge/bottone sopra — centrarlo lo rende leggibile anche
                    su schermi stretti invece di restare appeso al bordo. */}
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {/* Stessa label mono/minuscola di "gioco:" sopra — coerenza tra i
                            due controlli del form invece di uno stile a sé per il toggle. */}
                        <span className="font-mono text-[11px] text-ink-faint">modalità:</span>
                        <ChatModeToggle mode={mode} onChange={setMode} />
                    </div>
                    <span className="text-xs text-ink-soft">
                        {mode === 'conversation' ? (
                            <>
                                Ricorderà cosa vi siete detti dopo ogni messaggio.{' '}
                                <span className="text-ink-faint">Consuma più token.</span>
                            </>
                        ) : (
                            'Ogni domanda è indipendente, nessuno storico.'
                        )}
                    </span>
                </div>
            </form>

            <ResumeConversations conversations={recentConversations} />
        </div>
    );
}
