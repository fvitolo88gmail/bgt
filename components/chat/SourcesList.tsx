import { Source, sourceLabel } from './types';
import { Badge } from '@/components/ui/Badge';

interface SourcesListProps {
    sources: Source[];
}

/**
 * Provenienza di una fonte, in ordine di "autorevolezza" crescente non
 * implicato — sono tre categorie pari livello, distinte solo per colore:
 * manuale (neutro), community forum, designer (già usato altrove in UI per
 * segnalare contenuto ufficiale/autorevole).
 */
function ProvenanceBadge({ source }: { source: Pick<Source, 'source' | 'isDesignerResponse'> }) {
    if (source.source === 'manual') {
        return <Badge variant="neutral">Manuale</Badge>;
    }
    if (source.isDesignerResponse) {
        return <Badge variant="designer">Designer</Badge>;
    }
    return <Badge variant="community">Community</Badge>;
}

export function SourcesList({ sources }: SourcesListProps) {
    if (!sources || sources.length === 0) return null;

    // Le fonti manuale vengono raggruppate per sezione/capitolo, con le
    // pagine di quella sezione aggregate in un'unica riga ("Nome Sezione —
    // p. 1 - 3") invece di una voce separata per ogni chunk — più compatto
    // quando più chunk della stessa sezione contribuiscono alla risposta,
    // ma senza perdere il riferimento al capitolo (era sparito in una
    // versione precedente che aggregava solo le pagine, ignorando la
    // sezione). L'ordine dei gruppi segue il primo ordine di apparizione.
    const manualSources = sources.filter((s) => s.source === 'manual');
    const otherSources = sources.filter((s) => s.source !== 'manual');

    // maxSimilarity: la rilevanza più alta tra i chunk aggregati nel gruppo,
    // così la riga riporta comunque un indicatore utile invece di sparire
    // insieme all'aggregazione (era sparita nella versione precedente).
    const manualGroups = new Map<string, { pages: number[]; maxSimilarity: number }>();
    for (const s of manualSources) {
        const key = s.section ?? 'Manuale';
        const entry = manualGroups.get(key) ?? { pages: [], maxSimilarity: 0 };
        if (s.page != null && !entry.pages.includes(s.page)) entry.pages.push(s.page);
        entry.maxSimilarity = Math.max(entry.maxSimilarity, s.similarity);
        manualGroups.set(key, entry);
    }
    for (const entry of manualGroups.values()) entry.pages.sort((a, b) => a - b);

    return (
        <div className="mt-2 border-t border-line pt-2">
            <p className="mb-1 text-xs font-medium text-ink-soft">Fonti:</p>
            <ul className="space-y-1">
                {Array.from(manualGroups.entries()).map(([section, { pages, maxSimilarity }]) => (
                    <li key={`manual-${section}`} className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <ProvenanceBadge source={{ source: 'manual', isDesignerResponse: null }} />
                        <span className="font-medium text-ink-soft">
                            {section}
                            {pages.length > 0 && ` — p. ${pages.join(' - ')}`}
                        </span>
                        <span className="text-ink-faint">
                            · rilevanza {Math.round(maxSimilarity * 100)}%
                        </span>
                    </li>
                ))}
                {[...otherSources]
                    .sort((a, b) => b.similarity - a.similarity)
                    .map((s, j) => (
                        <li key={j} className="flex items-center gap-1.5 text-xs text-ink-soft">
                            <ProvenanceBadge source={s} />
                            {s.bggUrl ? (
                                <a
                                    href={s.bggUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-primary underline hover:text-primary-hover"
                                >
                                    {sourceLabel(s)}
                                </a>
                            ) : (
                                <span className="font-medium text-ink-soft">
                                    {sourceLabel(s)}
                                </span>
                            )}
                            <span className="text-ink-faint">
                                · rilevanza {Math.round(s.similarity * 100)}%
                            </span>
                        </li>
                    ))}
            </ul>
        </div>
    );
}
