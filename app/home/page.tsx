import { supabase } from '@/lib/supabase';
import { GameSelectForm } from '@/components/home/GameSelectForm';
import { GameOption } from '@/components/home/types';

// Solo giochi con almeno una fonte pronta (manuale o forum) — evita di
// portare l'utente su una chat senza contenuto ingested.
export default async function HomePage() {
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
        <main className="max-w-md mx-auto p-4 flex flex-col h-screen justify-center gap-6">
            <h1 className="text-xl font-bold text-center">Assistente Regole</h1>

            {games.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">
                    Nessun gioco disponibile al momento.
                </p>
            ) : (
                <GameSelectForm games={games} />
            )}
        </main>
    );
}
