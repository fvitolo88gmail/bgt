'use client';

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const LOGIN_TIMEOUT_MS = 15000;

// una fetch su mobile può restare sospesa senza mai risolversi né fallire (cambio rete a metà
// richiesta) — un try/catch da solo non basta, serve un limite di tempo esplicito
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err: unknown) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect') ?? '/home';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const supabase = createBrowserSupabaseClient();
            const { error: signInError } = await withTimeout(
                supabase.auth.signInWithPassword({ email, password }),
                LOGIN_TIMEOUT_MS
            );

            if (signInError) {
                setError('Email o password non corretti.');
                setSubmitting(false);
                return;
            }

            router.push(redirectTo);
            router.refresh();
        } catch (err) {
            const timedOut = err instanceof Error && err.message === 'timeout';
            setError(
                timedOut
                    ? 'La richiesta sta impiegando troppo tempo. Controlla la connessione e riprova.'
                    : 'Connessione assente o instabile. Riprova.'
            );
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label htmlFor="login-email" className="text-sm text-ink-soft">
                Email
            </label>
            <Input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="login-password" className="text-sm text-ink-soft">
                Password
            </label>
            <Input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
            />

            <Button type="submit" disabled={submitting}>
                {submitting ? 'Accesso...' : 'Accedi'}
            </Button>

            {error && <p className="text-sm text-danger">{error}</p>}
        </form>
    );
}
