'use client';

import { ReactNode, useEffect } from 'react';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
}

// Primitivo generico, non ancora agganciato a nessuna schermata esistente
// (nessun flusso attuale lo richiede) — pronto per login/registrazione e
// pannello admin quando quelle schermate verranno implementate.
export function Modal({ open, onClose, title, children }: ModalProps) {
    useEffect(() => {
        if (!open) return;

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose();
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className="w-full max-w-md rounded-lg border border-line bg-card p-6 shadow-lg"
                onClick={(event) => event.stopPropagation()}
            >
                {title && <h2 className="mb-3 font-serif text-lg font-bold text-ink">{title}</h2>}
                {children}
            </div>
        </div>
    );
}
