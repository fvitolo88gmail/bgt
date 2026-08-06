import { supabase } from '@/lib/shared/supabase';
import { createServerSupabaseClient } from '@/lib/shared/supabase-server';
import { getProfile } from '@/lib/profile/repository/profiles.repository';
import { getGreetingName } from '@/lib/profile/service/profile-display';
import { listRecentSessionsForUser } from '@/lib/chat/repository/session.repository';
import { QuestionHomeForm } from '@/components/home/QuestionHomeForm';
import { GameOption, RecentConversation } from '@/components/home/types';
import { Card } from '@/components/ui/Card';
import { OwlMark } from '@/components/ui/OwlMark';

// Quante conversazioni recenti mostrare in "Riprendi dove eri" — poche
// righe, non un elenco completo (quello vive nella sidebar della chat).
const RECENT_CONVERSATIONS_LIMIT = 3;

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
        .select('id, name, manual_ready, forum_ready')
        .or('forum_ready.eq.true,manual_ready.eq.true')
        .order('name');

    if (error) {
        console.error('[home] errore caricando i giochi disponibili:', error.message);
    }

    const games: GameOption[] = (data ?? []).map((game) => ({
        id: game.id,
        name: game.name,
        manualReady: game.manual_ready,
        communityReady: game.forum_ready,
    }));

    // Fail-soft anche qui: nessuna sezione "riprendi" invece di rompere la
    // pagina se il fetch delle conversazioni recenti fallisce.
    const recentConversations: RecentConversation[] = user
        ? await listRecentSessionsForUser(serverSupabase, user.id, RECENT_CONVERSATIONS_LIMIT).catch((err) => {
              console.error('[home] errore caricando le conversazioni recenti:', err);
              return [];
          })
        : [];

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-4">
            <div className="text-center">
                {/* Icona sopra il testo (non affiancata): con nomi lunghi il saluto
                    va a capo su 2 righe e un'icona alta quanto il blocco intero,
                    centrata rispetto a entrambe, risulta disallineata da entrambe. */}
                <h1 className="flex flex-col items-center gap-2 font-serif text-2xl font-bold text-ink">
                    <OwlMark size={48} />
                    {greetingName ? `Che regola ti blocca, ${greetingName}?` : 'Che regola ti blocca?'}
                </h1>
                <p className="mt-1 text-sm text-ink-soft">Rispondo citando il manuale o il forum. Mai a memoria.</p>
            </div>

            {games.length === 0 ? (
                <Card className="mx-auto w-full max-w-xl p-4 text-center text-sm text-ink-soft">
                    Nessun gioco disponibile al momento.
                </Card>
            ) : (
                <QuestionHomeForm games={games} recentConversations={recentConversations} />
            )}
        </div>
    );
}
