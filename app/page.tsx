import { redirect } from "next/navigation";

// La root non ha contenuto proprio (v. architecture.md) — reindirizza subito
// alla selezione gioco, unico punto d'ingresso reale dell'app.
export default function Home() {
  redirect("/home");
}
