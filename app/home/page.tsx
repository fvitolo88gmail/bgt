import { supabase } from '@/lib/supabase';
import { GameSelectForm } from '@/components/home/GameSelectForm';
import { GameOption } from '@/components/home/types';
import { Card } from '@/components/ui/Card';

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
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-4">
            <h1 className="text-center font-serif text-xl font-bold text-ink">Assistente Regole</h1>

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
