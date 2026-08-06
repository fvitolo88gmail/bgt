export type ChatMode = 'qa' | 'conversation';

interface ChatModeToggleProps {
    mode: ChatMode;
    onChange: (mode: ChatMode) => void;
}

// Segmented control a pillola, stile ripreso dal riferimento del design
// system per il selettore di modalità dentro la chat: bordo primary pieno,
// segmento attivo pieno di --primary con testo bianco, inattivo trasparente
// con testo ink-soft.
export function ChatModeToggle({ mode, onChange }: ChatModeToggleProps) {
    return (
        <div className="inline-flex rounded-full border-[1.5px] border-primary p-[3px] text-[11.5px] font-bold">
            <button
                type="button"
                aria-pressed={mode === 'qa'}
                onClick={() => onChange('qa')}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 transition-colors ${
                    mode === 'qa' ? 'bg-primary text-white' : 'text-ink-soft'
                }`}
            >
                Domande
            </button>
            <button
                type="button"
                aria-pressed={mode === 'conversation'}
                onClick={() => onChange('conversation')}
                className={`cursor-pointer rounded-full px-3.5 py-1.5 transition-colors ${
                    mode === 'conversation' ? 'bg-primary text-white' : 'text-ink-soft'
                }`}
            >
                Conversazione
            </button>
        </div>
    );
}
