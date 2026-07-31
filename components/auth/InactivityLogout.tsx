'use client';

import { useEffect, useRef } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

// montato una sola volta nel root layout: traccia l'inattività dell'utente e forza il logout
// allo scadere del timeout, indipendente dalla scadenza del token Supabase (che si rinnova da
// solo finché l'utente resta attivo).
export function InactivityLogout() {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const supabase = createBrowserSupabaseClient();
        let sessionActive = false;

        async function handleTimeout() {
            await supabase.auth.signOut();
            window.location.href = '/login';
        }

        function resetTimer() {
            if (!sessionActive) return;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(handleTimeout, INACTIVITY_TIMEOUT_MS);
        }

        function clearTimer() {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            sessionActive = session !== null;
            if (sessionActive) resetTimer();
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            sessionActive = session !== null;
            if (sessionActive) {
                resetTimer();
            } else {
                clearTimer();
            }
        });

        ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, resetTimer));

        return () => {
            ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
            clearTimer();
            subscription.unsubscribe();
        };
    }, []);

    return null;
}
