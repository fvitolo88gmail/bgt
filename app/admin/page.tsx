import { redirect } from 'next/navigation';

// /admin resta solo un punto d'ingresso: oggi l'unica voce funzionante della
// console (v. AdminShell) è "Costi", quindi redirige lì invece di mostrare
// una shell vuota. Da rivedere quando ADMIN-CONSOLE aggiunge altre pagine.
export default function AdminPage() {
    redirect('/admin/costs');
}
