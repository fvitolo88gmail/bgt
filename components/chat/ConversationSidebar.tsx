'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Toast, type ToastVariant } from '@/components/ui/Toast';

// Larghezza della sfumatura in fondo alla lista, in px — usata sia nel
// gradiente di maschera sia come soglia per considerare "già in fondo"
// (evita che la sfumatura lampeggi per un residuo di 1-2px di scroll).
const BOTTOM_FADE_PX = 28;

/**
 * true solo quando c'è altro contenuto sotto l'ultima voce visibile — non
 * semplicemente "la lista scrolla", altrimenti la sfumatura resterebbe
 * visibile anche a scroll già in fondo, segnalando contenuto che non c'è.
 * Ricalcolato su resize/scroll e ogni volta che cambia la lista.
 */
function useBottomFade(deps: unknown[]): [React.RefObject<HTMLDivElement | null>, boolean] {
    const ref = useRef<HTMLDivElement>(null);
    const [showFade, setShowFade] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            setShowFade(el.scrollHeight - el.scrollTop - el.clientHeight > BOTTOM_FADE_PX);
        };

        update();
        el.addEventListener('scroll', update);
        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(el);

        return () => {
            el.removeEventListener('scroll', update);
            resizeObserver.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return [ref, showFade];
}

export interface ConversationSummary {
    id: string;
    title: string | null;
    lastMessageAt: string | null;
    createdAt: string;
}

interface ConversationSidebarProps {
    gameId: string;
    activeSessionId: string;
    // incrementato dal chiamante ogni volta che una risposta viene salvata,
    // per far ricomparire nell'elenco la conversazione corrente/il titolo
    // appena generato senza un polling continuo.
    refreshKey: number;
    onSelect: (sessionId: string) => void;
    // Chiamato solo se la conversazione eliminata era quella aperta: il
    // chiamante decide cosa mostrare al posto di una chat ormai orfana
    // (in pratica, ripartire da una conversazione vuota).
    onActiveConversationDeleted: () => void;
}

function formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
        </svg>
    );
}

function ConversationList({
    conversations,
    loading,
    activeSessionId,
    onSelect,
    onDelete,
}: {
    conversations: ConversationSummary[];
    loading: boolean;
    activeSessionId: string;
    onSelect: (sessionId: string) => void;
    onDelete: (conversation: ConversationSummary) => void;
}) {
    return (
        <>
            {loading && conversations.length === 0 && (
                <p className="px-2.5 text-xs text-app-sidebar-ink-muted">Carico le conversazioni...</p>
            )}

            {!loading && conversations.length === 0 && (
                <p className="px-2.5 text-xs text-app-sidebar-ink-muted">Nessuna conversazione precedente.</p>
            )}

            {conversations.map((conversation) => {
                const isActive = conversation.id === activeSessionId;
                return (
                    <div
                        key={conversation.id}
                        className={`flex items-center gap-1 rounded-[7px] transition-colors ${
                            isActive ? 'bg-app-sidebar-active' : 'hover:bg-app-sidebar-active/50'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => onSelect(conversation.id)}
                            className={`min-w-0 flex-1 cursor-pointer px-2.5 py-2 text-left ${isActive ? 'text-ink' : 'text-app-sidebar-ink'}`}
                        >
                            <p className="truncate text-xs font-semibold">
                                {conversation.title ?? 'Nuova conversazione'}
                            </p>
                            <p className="text-[10.5px] text-app-sidebar-ink-muted">
                                {formatTimestamp(conversation.lastMessageAt ?? conversation.createdAt)}
                            </p>
                        </button>
                        <button
                            type="button"
                            aria-label={`Elimina conversazione "${conversation.title ?? 'Nuova conversazione'}"`}
                            onClick={(e) => {
                                // Non deve selezionare la conversazione (è dentro lo stesso
                                // contenitore del bottone di selezione, non un elemento a parte).
                                e.stopPropagation();
                                onDelete(conversation);
                            }}
                            // Sempre visibile (non solo in hover): su touch non c'è hover, e
                            // nascondere l'unico modo di eliminare una conversazione dietro un
                            // hover la renderebbe irraggiungibile da mobile.
                            className="mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] text-app-sidebar-ink-muted hover:bg-danger hover:text-white"
                        >
                            <TrashIcon />
                        </button>
                    </div>
                );
            })}
        </>
    );
}

// Nessun pulsante "nuova conversazione": la chat parte già vuota ogni volta
// che si entra nella pagina (nessuna conversazione selezionata) e la
// registrazione avviene solo alla prima domanda inviata (getOrCreateSession)
// — non serve un'azione esplicita per ottenere quello stato.
//
// Responsive mutuato da AdminShell (stesso standard di piattaforma, v.
// architecture.md): sotto `md` il pannello collassa in una seconda top bar
// (sotto quella con nome gioco/modalità) con hamburger, invece di stringere
// la chat in uno spazio residuo troppo piccolo per essere utile.
export function ConversationSidebar({
    gameId,
    activeSessionId,
    refreshKey,
    onSelect,
    onActiveConversationDeleted,
}: ConversationSidebarProps) {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Conversazione in attesa di conferma eliminazione (null = nessuna modale
    // aperta) e stato di invio, per disabilitare "Elimina" mentre la
    // richiesta è in corso invece di permettere doppi click.
    const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);
    // Un hook per contenitore (overlay mobile espanso + sidebar desktop): la
    // sfumatura in fondo compare solo quando c'è davvero altro sotto
    // l'ultima voce visibile, non come decorazione fissa.
    const [expandedListRef, expandedShowFade] = useBottomFade([conversations, loading, isMenuOpen]);
    const [desktopListRef, desktopShowFade] = useBottomFade([conversations, loading]);
    const fadeMaskStyle = {
        WebkitMaskImage: `linear-gradient(to bottom, black calc(100% - ${BOTTOM_FADE_PX}px), transparent 100%)`,
        maskImage: `linear-gradient(to bottom, black calc(100% - ${BOTTOM_FADE_PX}px), transparent 100%)`,
    };

    useEffect(() => {
        let cancelled = false;

        fetch(`/api/chat/sessions?gameId=${encodeURIComponent(gameId)}`)
            .then((res) => res.json())
            .then((data: { sessions?: ConversationSummary[] }) => {
                if (cancelled) return;
                setConversations(data.sessions ?? []);
            })
            .catch((err) => {
                console.error('[conversation-sidebar] errore caricando le conversazioni:', err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gameId, refreshKey]);

    function handleSelect(sessionId: string) {
        setIsMenuOpen(false);
        onSelect(sessionId);
    }

    // Apre la modale di conferma — l'eliminazione vera e propria parte solo
    // dal click su "Elimina" dentro la modale (confirmDelete).
    function handleDelete(conversation: ConversationSummary) {
        setDeleteTarget(conversation);
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        const conversation = deleteTarget;
        setDeleting(true);

        try {
            const res = await fetch(`/api/chat/sessions/${conversation.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`status ${res.status}`);

            setConversations((prev) => prev.filter((c) => c.id !== conversation.id));
            if (conversation.id === activeSessionId) {
                onActiveConversationDeleted();
            }
            setDeleteTarget(null);
        } catch (err) {
            console.error('[conversation-sidebar] errore eliminando la conversazione:', err);
            setToast({ message: 'Errore eliminando la conversazione. Riprova.', variant: 'danger' });
        } finally {
            setDeleting(false);
        }
    }

    return (
        <>
            {/* Seconda top bar, solo sotto md. relative z-50: stesso motivo dell'header
                globale (v. Header.tsx) — senza essere posizionata, l'overlay a tutto
                schermo qui sotto (fixed, z-40) la coprirebbe anche se è lei stessa il
                trigger per aprirlo/chiuderlo. bg-app-sidebar-header (violetto scuro, non
                lo stesso chiaro della lista): a colpo d'occhio non si confonde con i
                titoli delle conversazioni, che usano lo stesso trattamento visivo del
                pannello chiaro. border-line invece di un violetto dedicato: stesso colore
                dell'header del gioco, per restare coerenti quando le due bar sono vicine. */}
            <div className="relative z-50 flex shrink-0 items-center justify-between border-b border-line bg-app-sidebar-header px-3.5 py-3 md:hidden">
                <span className="text-xs font-semibold text-app-sidebar-header-ink">Conversazioni</span>
                <button
                    type="button"
                    aria-label={isMenuOpen ? 'Chiudi conversazioni' : 'Apri conversazioni'}
                    aria-expanded={isMenuOpen}
                    onClick={() => setIsMenuOpen((open) => !open)}
                    className="flex h-8 w-8 items-center justify-center rounded-[7px] text-app-sidebar-header-ink hover:bg-white/10"
                >
                    <span className="sr-only">Menu conversazioni</span>
                    {isMenuOpen ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                        </svg>
                    )}
                </button>
            </div>

            {isMenuOpen && (
                // A tutto schermo (absolute inset-0 sull'area sotto l'header globale, non
                // fixed sul viewport), non un dropdown limitato in altezza: con molte
                // conversazioni un menu troncato non sarebbe comunque consultabile.
                // absolute invece di fixed: "fixed inset-0" è relativo al viewport e si
                // sovrapponeva all'header globale (in-flow, sopra quest'area), coprendo la
                // prima conversazione della lista — absolute lo ancora invece al contenitore
                // "relative" in page.tsx, che inizia già sotto l'header. min-h-0 sul
                // contenuto è necessario perché un figlio flex non si restringe sotto il
                // proprio contenuto senza di esso, altrimenti overflow-y-auto non scrolla mai.
                <nav className="absolute inset-0 z-40 flex flex-col bg-app-sidebar md:hidden">
                    <div className="flex shrink-0 items-center justify-between border-b border-line bg-app-sidebar-header px-3.5 py-3">
                        <span className="text-xs font-semibold text-app-sidebar-header-ink">Conversazioni</span>
                        <button
                            type="button"
                            aria-label="Chiudi conversazioni"
                            onClick={() => setIsMenuOpen(false)}
                            className="flex h-8 w-8 items-center justify-center rounded-[7px] text-app-sidebar-header-ink hover:bg-white/10"
                        >
                            <span className="sr-only">Chiudi</span>
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    </div>
                    <div
                        ref={expandedListRef}
                        className="app-sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3.5 pt-3 pb-4"
                        style={expandedShowFade ? fadeMaskStyle : undefined}
                    >
                        <ConversationList
                            conversations={conversations}
                            loading={loading}
                            activeSessionId={activeSessionId}
                            onSelect={handleSelect}
                            onDelete={handleDelete}
                        />
                    </div>
                </nav>
            )}

            {/* Violetto (bg-app-sidebar): pannello di navigazione dell'applicazione,
                per coerenza con lo standard di piattaforma — nero per i pannelli di
                amministrazione (v. AdminShell/--admin-sidebar), violetto per quelli
                applicativi (v. architecture.md). Visibile solo da md in su. */}
            <div className="hidden w-[220px] shrink-0 flex-col bg-app-sidebar md:flex">
                {/* min-h/py/border-b allineati all'header del gioco (v. page.tsx, "px-8
                    py-4" con due righe di testo) — senza, l'header di questo pannello
                    risultava visibilmente più basso e col bordo sfalsato rispetto a
                    quello della chat sulla stessa riga. bg-app-sidebar-header (violetto
                    scuro) invece del chiaro della lista sotto: si distingue a colpo
                    d'occhio dai titoli delle conversazioni, che non usano questo tono. */}
                <div className="flex min-h-[75px] shrink-0 items-center border-b border-line bg-app-sidebar-header px-3.5 py-4">
                    <p className="text-[10.5px] font-bold tracking-wide text-app-sidebar-header-ink uppercase">
                        Conversazioni
                    </p>
                </div>
                <div
                    ref={desktopListRef}
                    className="app-sidebar-scroll flex-1 space-y-1 overflow-y-auto p-3.5"
                    style={desktopShowFade ? fadeMaskStyle : undefined}
                >
                    <ConversationList
                        conversations={conversations}
                        loading={loading}
                        activeSessionId={activeSessionId}
                        onSelect={onSelect}
                        onDelete={handleDelete}
                    />
                </div>
            </div>

            <Modal open={deleteTarget !== null} onClose={() => (!deleting ? setDeleteTarget(null) : undefined)} title="Eliminare la conversazione?">
                <p className="mb-4 text-sm text-ink-soft">
                    {deleteTarget && (
                        <>
                            Stai per eliminare <span className="font-semibold text-ink">{deleteTarget.title ?? 'Nuova conversazione'}</span>.
                            {' '}I messaggi di questa conversazione verranno persi, l&apos;azione non si può annullare.
                        </>
                    )}
                </p>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                        Annulla
                    </Button>
                    <Button type="button" variant="danger" onClick={confirmDelete} disabled={deleting}>
                        {deleting ? 'Elimino...' : 'Elimina'}
                    </Button>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />}
        </>
    );
}
