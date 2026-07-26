import { Source, sourceLabel } from './types';

interface SourcesListProps {
    sources: Source[];
}

export function SourcesList({ sources }: SourcesListProps) {
    if (!sources || sources.length === 0) return null;

    return (
        <div className="mt-2 pt-2 border-t border-gray-300">
            <p className="text-xs text-gray-500 font-medium mb-1">Fonti:</p>
            <ul className="space-y-0.5">
                {[...sources]
                    .sort((a, b) => b.similarity - a.similarity)
                    .map((s, j) => (
                        <li key={j} className="text-xs text-gray-500">
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
                            {s.isDesignerResponse && (
                                <span className="text-amber-600 font-medium"> · risposta del designer</span>
                            )}
                            <span className="text-gray-400">
                                {' '}
                                · rilevanza {Math.round(s.similarity * 100)}%
                            </span>
                        </li>
                    ))}
            </ul>
        </div>
    );
}
