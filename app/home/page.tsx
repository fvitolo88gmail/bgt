import { supabase } from '@/lib/supabase';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getProfile } from '@/lib/repositories/profiles.repository';
import { getGreetingName } from '@/lib/profile-display';
import { GameSelectForm } from '@/components/home/GameSelectForm';
import { GameOption } from '@/components/home/types';
import { Card } from '@/components/ui/Card';
import { OwlMark } from '@/components/ui/OwlMark';

// Solo giochi con almeno una fonte pronta (manuale o forum) — evita di
// portare l'utente su una chat senza contenuto ingested.
export default async function HomePage() {
    const serverSupabase = await createServerSupabaseClient();
    const {
        data: { user },
    } = await serverSupabase.auth.getUser();
    // Fail-soft: se il profilo non si legge per qualche motivo, il saluto
    // ricade su "Bentornato!" invece di rompere la pagina.
    const profile = user ? await getProfile(serverSupabase, user.id).catch(() => null) : null;
    const greetingName = profile && user?.email ? getGreetingName(profile, user.email) : null;

    const { data, error } = await supabase
        .from('games')
        .select('id, name')
        .or('forum_ready.eq.true,manual_ready.eq.true')
        .order('name');

    if (error) {
        console.error('[home] errore caricando i giochi disponibili:', error.message);
    }

    const games: GameOption[] = data ?? [];

    return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-4">
            <div className="text-center">
                {/* Icona sopra il testo (non affiancata): con nomi lunghi il saluto
                    va a capo su 2 righe e un'icona alta quanto il blocco intero,
                    centrata rispetto a entrambe, risulta disallineata da entrambe. */}
                <h1 className="flex flex-col items-center gap-2 font-serif text-2xl font-bold text-ink">
                    <OwlMark size={48} />
                    {greetingName ? `Bentornato ${greetingName}!` : 'Bentornato!'}
                </h1>
                <p className="mt-1 text-sm text-ink-soft">A cosa giochiamo oggi?</p>
            </div>

            {games.length === 0 ? (
                <Card className="p-4 text-center text-sm text-ink-soft">
                    Nessun gioco disponibile al momento.
                </Card>
            ) : (
                <GameSelectForm games={games} />
            )}
        </div>
    );
}
