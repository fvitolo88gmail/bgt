import { createServerSupabaseClient } from '@/lib/shared/supabase-server';
import { getProfile } from '@/lib/profile/repository/profiles.repository';
import { getInitials } from '@/lib/profile/service/profile-display';
import { Avatar } from '@/components/ui/Avatar';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { UpdatePasswordForm } from '@/components/profile/UpdatePasswordForm';

// proxy.ts garantisce già una sessione valida per ogni route non pubblica —
// se per qualche motivo user è null si mostra solo un messaggio, nessun
// redirect qui (già gestito a monte).
export default async function ProfilePage() {
    const supabase = await createServerSupabaseClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return (
            <div className="mx-auto max-w-md px-4 py-10">
                <p className="text-sm text-ink-soft">Devi accedere per vedere il tuo profilo.</p>
            </div>
        );
    }

    const profile = await getProfile(supabase, user.id);
    const email = user.email ?? '';

    return (
        <div className="mx-auto max-w-md px-4 py-10">
            <div className="mb-8 flex flex-col items-center gap-3">
                <Avatar initials={getInitials(profile, email)} size={64} />
                <p className="text-sm text-ink-faint">{email}</p>
            </div>

            <ProfileForm
                userId={user.id}
                initialFirstName={profile.firstName ?? ''}
                initialLastName={profile.lastName ?? ''}
            />

            <hr className="my-8 border-line-soft" />

            <UpdatePasswordForm email={email} />
        </div>
    );
}
