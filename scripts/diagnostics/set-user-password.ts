import 'dotenv/config';
import { createServiceClient } from '../../lib/shared/supabase';

/**
 * Imposta a mano la password di un utente via Admin API — per quando l'email di
 * recovery nativa Supabase non è utilizzabile (SMTP built-in limitato ai membri
 * del team del progetto, v. D73/AUTH-00008). Uso interinale finché non c'è SMTP
 * custom (AUTH-00010).
 *
 * Uso:
 *   npx ts-node --project scripts/tsconfig.json scripts/diagnostics/set-user-password.ts \
 *     --uid <user-uuid> --password <nuova-password>
 */

function parseArg(flag: string): string {
    const index = process.argv.indexOf(flag);
    const value = index === -1 ? undefined : process.argv[index + 1];
    if (!value) {
        throw new Error(`Argomento mancante: ${flag}`);
    }
    return value;
}

async function main() {
    const uid = parseArg('--uid');
    const password = parseArg('--password');

    if (password.length < 8) {
        throw new Error('Password troppo corta (minimo 8 caratteri).');
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase.auth.admin.updateUserById(uid, { password });

    if (error) {
        throw new Error(`Aggiornamento fallito: ${error.message}`);
    }

    console.log(`Password aggiornata per ${data.user.email} (${data.user.id}).`);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
