import Link from 'next/link';
import { RecentConversation } from './types';

function formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ChatIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="5" width="18" height="12" rx="4" />
            <polygon points="8,17 8,21 12,17" fill="currentColor" stroke="none" />
        </svg>
    );
}

// Separata dal resto dell'input domanda da un divider ("oppure riprendi"),
// non da un titolo di sezione: riprendere una conversazione passata è
// un'alternativa a fare una nuova domanda, non un blocco a sé.
export function ResumeConversations({ conversations }: { conversations: RecentConversation[] }) {
    if (conversations.length === 0) return null;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[10.5px] tracking-wide text-ink-faint uppercase">oppure riprendi</span>
                <span className="h-px flex-1 bg-line" />
            </div>

            <div className="flex flex-col gap-2">
                {conversations.map((conversation) => (
                    <Link
                        key={conversation.id}
                        href={`/game/${conversation.gameId}?mode=conversation&sessionId=${conversation.id}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-line-soft bg-card px-3.5 py-3 hover:bg-primary-soft/30"
                    >
                        <span className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
                                <ChatIcon />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-[13.5px] font-semibold text-ink">
                                    {conversation.title ?? 'Nuova conversazione'}
                                </span>
                                <span className="font-mono text-[10.5px] text-ink-faint">{conversation.gameName}</span>
                            </span>
                        </span>
                        {conversation.lastMessageAt && (
                            <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                                {formatTimestamp(conversation.lastMessageAt)}
                            </span>
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );
}
