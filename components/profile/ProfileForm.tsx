'use client';

import { useState, FormEvent } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { updateProfileName } from '@/lib/repositories/profiles.repository';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Toast, type ToastVariant } from '@/components/ui/Toast';

export function ProfileForm({
    userId,
    initialFirstName,
    initialLastName,
}: {
    userId: string;
    initialFirstName: string;
    initialLastName: string;
}) {
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        try {
            const supabase = createBrowserSupabaseClient();
            await updateProfileName(supabase, userId, { firstName: firstName.trim(), lastName: lastName.trim() });
            setToast({ message: 'Profilo salvato.', variant: 'success' });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Errore salvando il profilo';
            setToast({ message, variant: 'danger' });
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm text-ink-soft">
                    Nome
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome" />
                </label>
                <label className="flex flex-col gap-1 text-sm text-ink-soft">
                    Cognome
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Cognome" />
                </label>

                <Button type="submit" disabled={saving} className="self-start">
                    {saving ? 'Salvataggio...' : 'Salva'}
                </Button>
            </form>

            {toast && <Toast message={toast.message} variant={toast.variant} onDismiss={() => setToast(null)} />}
        </>
    );
}
