import { Source, sourceLabel } from './types';

interface SourcesListProps {
    sources: Source[];
}

/**
 * Provenienza di una fonte, in ordine di "autorevolezza" crescente non
 * implicato — sono tre categorie pari livello, distinte solo per colore:
 * manuale (grigio, neutro), community forum (blu), designer (ambra, già
 * usato altrove in UI per segnalare contenuto ufficiale/autorevole).
 */
function ProvenanceBadge({ source }: { source: Source }) {
    if (source.source === 'manual') {
        return (
            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-600">
                Manuale
            </span>
        );
    }
    if (source.isDesignerResponse) {
        return (
            <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">
                Designer
            </span>
        );
    }
    return (
        <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">
            Community
        </span>
    );
}

export function SourcesList({ sources }: SourcesListProps) {
    if (!sources || sources.length === 0) return null;

    return (
        <div className="mt-2 pt-2 border-t border-gray-300">
            <p className="text-xs text-gray-500 font-medium mb-1">Fonti:</p>
            <ul className="space-y-1">
                {[...sources]
                    .sort((a, b) => b.similarity - a.similarity)
                    .map((s, j) => (
                        <li key={j} className="flex items-center gap-1.5 text-xs text-gray-500">
                            <ProvenanceBadge source={s} />
                            {s.bggUrl ? (
                                <a
                                    href={s.bggUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-blue-600 underline hover:text-blue-800"
                                >
                                    {sourceLabel(s)}
                                </a>
                            ) : (
                                <span className="font-medium text-gray-600">
                                    {sourceLabel(s)}
                                </span>
                            )}
                            <span className="text-gray-400">
                                · rilevanza {Math.round(s.similarity * 100)}%
                            </span>
                        </li>
                    ))}
            </ul>
        </div>
    );
}
