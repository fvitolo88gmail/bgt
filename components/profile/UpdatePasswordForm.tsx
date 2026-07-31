'use client';

import { useState, FormEvent } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Toast, type ToastVariant } from '@/components/ui/Toast';

const MIN_PASSWORD_LENGTH = 8;

export function UpdatePasswordForm({ email }: { email: string }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setToast({ message: `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`, variant: 'danger' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setToast({ message: 'Le due password non coincidono.', variant: 'danger' });
            return;
        }

        setSaving(true);
        try {
            const supabase = createBrowserSupabaseClient();

            // Supabase non espone una verifica password isolata: si ri-autentica
            // con le credenziali attuali per confermarle prima di sovrascriverle.
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            });
            if (verifyError) {
                setToast({ message: 'Password attuale non corretta.', variant: 'danger' });
                setSaving(false);
                return;
            }

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setToast({ message: 'Password aggiornata.', variant: 'success' });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Errore aggiornando la password';
            setToast({ message, variant: 'danger' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label htmlFor="current-password" className="flex flex-col gap-1 text-sm text-ink-soft">
                    Password attuale
                    <PasswordInput
                        id="current-password"
                        required
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                </label>
                <label htmlFor="new-password" className="flex flex-col gap-1 text-sm text-ink-soft">
                    Nuova password
                    <PasswordInput
                        id="new-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                    />
                </label>
                <label htmlFor="confirm-password" className="flex flex-col gap-1 text-sm text-ink-soft">
                    Conferma password
                    <PasswordInput
                        id="confirm-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                </label>

                <Button type="submit" disabled={saving} className="self-start">
                    {saving ? 'Aggiornamento...' : 'Aggiorna password'}
                </Button>
            </form>

            {toast && <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />}
        </>
    );
}
