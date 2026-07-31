'use client';

import { useEffect } from 'react';

export type ToastVariant = 'success' | 'danger';

const VARIANT_CLASSES: Record<ToastVariant, string> = {
    success: 'border-success bg-success-soft text-success',
    danger: 'border-danger bg-danger-soft text-danger',
};

/**
 * Notifica che appare in basso a destra e sparisce da sola dopo
 * `durationMs` — il chiamante controlla la visibilità passando `message`
 * (renderizzare solo quando non è null) e riceve `onDismiss` per azzerarlo,
 * sia a timeout scaduto sia se l'utente la chiude prima.
 */
export function Toast({
    message,
    variant = 'success',
    durationMs = 3000,
    onDismiss,
}: {
    message: string;
    variant?: ToastVariant;
    durationMs?: number;
    onDismiss: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(onDismiss, durationMs);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- riparte solo quando cambia il messaggio, non a ogni render di onDismiss
    }, [message, durationMs]);

    return (
        <div
            role="status"
            className={`fixed bottom-4 right-4 z-50 rounded-md border px-4 py-2.5 text-sm shadow-sm ${VARIANT_CLASSES[variant]}`}
        >
            {message}
        </div>
    );
}
