import ReactMarkdown from 'react-markdown';
import { ChatMessage } from './types';
import { SourcesList } from './SourcesList';
import { Card } from '@/components/ui/Card';

interface MessageBubbleProps {
    message: ChatMessage;
    onFeedback?: (feedback: 'good' | 'bad') => void;
}

// Icone inline (no dipendenza esterna): stroke bianco su sfondo neutro di
// default, lo sfondo diventa verde/rosso pieno solo quando quel voto è
// quello selezionato per il messaggio.
function ThumbsUpIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M7 10v12" />
            <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
    );
}

function ThumbsDownIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M17 14V2" />
            <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
    );
}

export function MessageBubble({ message, onFeedback }: MessageBubbleProps) {
    const isAssistant = message.role === 'assistant';

    return (
        <div className={`flex ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
            <Card
                className={`max-w-prose px-4 py-2 ${
                    !isAssistant ? 'border-transparent bg-primary text-white' : 'text-ink'
                }`}
            >
                {isAssistant ? (
                    <div className="text-sm [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_a]:font-medium [&_a]:text-primary [&_a]:underline hover:[&_a]:text-primary-hover">
                        <ReactMarkdown
                            components={{
                                a: ({ ...props }) => (
                                    <a {...props} target="_blank" rel="noopener noreferrer" />
                                ),
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <p className="text-sm">{message.content}</p>
                )}

                {message.sources && <SourcesList sources={message.sources} />}

                {isAssistant && message.messageId && onFeedback && (
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Risposta utile"
                            onClick={() => onFeedback('good')}
                            className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-white transition-colors ${
                                message.feedback === 'good' ? 'bg-green-500' : 'bg-ink-faint/50 hover:bg-green-500/70'
                            }`}
                        >
                            <ThumbsUpIcon />
                        </button>
                        <button
                            type="button"
                            aria-label="Risposta non utile"
                            onClick={() => onFeedback('bad')}
                            className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-white transition-colors ${
                                message.feedback === 'bad' ? 'bg-red-500' : 'bg-ink-faint/50 hover:bg-red-500/70'
                            }`}
                        >
                            <ThumbsDownIcon />
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
}
