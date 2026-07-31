'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function RequestInviteForm() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState<Status>('idle');

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setStatus('submitting');

        try {
            const response = await fetch('/api/invite-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstName, lastName, email, message: message || undefined }),
            });

            if (!response.ok) {
                setStatus('error');
                return;
            }

            setStatus('success');
        } catch {
            setStatus('error');
        }
    }

    if (status === 'success') {
        return (
            <p className="text-sm text-ink-soft">
                Richiesta inviata. Se viene approvata, riceverai un invito via email.
            </p>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor="invite-first-name" className="text-sm text-ink-soft">
                Nome
            </label>
            <Input
                id="invite-first-name"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Nome"
            />

            <label htmlFor="invite-last-name" className="text-sm text-ink-soft">
                Cognome
            </label>
            <Input
                id="invite-last-name"
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Cognome"
            />

            <label htmlFor="invite-email" className="text-sm text-ink-soft">
                La tua email
            </label>
            <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@esempio.com"
            />

            <label htmlFor="invite-message" className="text-sm text-ink-soft">
                Messaggio (opzionale)
            </label>
            <textarea
                id="invite-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
                placeholder="Perché vorresti accedere?"
            />

            <Button type="submit" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Invio...' : 'Richiedi accesso'}
            </Button>

            {status === 'error' && (
                <p className="text-sm text-danger">
                    Qualcosa è andato storto, riprova tra poco.
                </p>
            )}
        </form>
    );
}
