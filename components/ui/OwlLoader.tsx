import { OwlMark } from './OwlMark';

// Indicatore di caricamento: mascotte che saltella con rimbalzo verso destra
// e ricomincia, per la sola attesa della risposta in chat. Nessun box/
// riserva di spazio: il transform scivola sullo spazio già disponibile a
// destra (il contenitore scrollabile ha overflow-x-hidden esplicito per non
// far comparire una scrollbar orizzontale durante il salto).
export function OwlLoader({ size = 26 }: { size?: number }) {
    return (
        <span className="inline-flex shrink-0 animate-owl-hop" role="status" aria-label="Sto cercando...">
            <OwlMark size={size} />
        </span>
    );
}
