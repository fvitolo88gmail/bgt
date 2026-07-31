/**
 * Derivazioni pure per la visualizzazione del profilo (saluto in /home,
 * iniziali sull'avatar, nome nel menu utente) — nessun accesso DB qui, solo
 * logica su nome/cognome/email già letti altrove (DESIGN-00004).
 */

export interface ProfileNameInput {
    firstName: string | null;
    lastName: string | null;
}

/**
 * "Nome Cognome" se entrambi presenti, solo uno dei due se manca l'altro,
 * altrimenti la parte locale dell'email (prima della @) come fallback —
 * un utente che non è ancora passato dalla pagina profilo ha comunque un
 * nome da mostrare, non un vuoto o "null null".
 */
export function getDisplayName(profile: ProfileNameInput, email: string): string {
    const parts = [profile.firstName, profile.lastName].filter((p): p is string => Boolean(p?.trim()));
    if (parts.length > 0) return parts.join(' ');
    return email.split('@')[0] || email;
}

/**
 * Solo il nome (mai il cognome) per il saluto in /home — più informale del
 * nome completo di getDisplayName. Fallback identico: parte locale
 * dell'email se manca il nome.
 */
export function getGreetingName(profile: ProfileNameInput, email: string): string {
    const firstName = profile.firstName?.trim();
    if (firstName) return firstName;
    return email.split('@')[0] || email;
}

/**
 * Iniziali per l'avatar: prima lettera di nome+cognome se entrambi
 * presenti, altrimenti le prime due lettere del nome visualizzato
 * (getDisplayName) — sempre 1-2 caratteri maiuscoli, mai vuoto.
 */
export function getInitials(profile: ProfileNameInput, email: string): string {
    const firstName = profile.firstName?.trim();
    const lastName = profile.lastName?.trim();
    if (firstName && lastName) {
        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }
    const displayName = getDisplayName(profile, email).trim();
    return displayName.slice(0, 2).toUpperCase() || '?';
}
