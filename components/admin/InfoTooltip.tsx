'use client';

import { useRef, useState } from 'react';

const TOOLTIP_WIDTH = 224; // corrisponde a w-56
const VIEWPORT_MARGIN = 8;

interface TooltipPosition {
    top: number;
    left: number;
    placement: 'above' | 'below';
}

/**
 * Icona info con tooltip al passaggio del mouse. Posizionamento `fixed`
 * calcolato al volo (non CSS puro come nella prima versione): dentro le
 * tabelle, wrappate in `overflow-x-auto` per lo scroll orizzontale su
 * mobile, un tooltip `absolute` veniva tagliato dal clipping verticale che
 * `overflow-x-auto` introduce implicitamente. `fixed` esce da quel
 * clipping; la posizione è clampata ai bordi della viewport per non
 * uscire neanche di lì.
 */
export function InfoTooltip({ text }: { text: string }) {
    const iconRef = useRef<HTMLSpanElement>(null);
    const [position, setPosition] = useState<TooltipPosition | null>(null);

    function show() {
        const rect = iconRef.current?.getBoundingClientRect();
        if (!rect) return;

        const placement: TooltipPosition['placement'] = rect.top > 80 ? 'above' : 'below';
        const rawLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        const left = Math.min(
            Math.max(rawLeft, VIEWPORT_MARGIN),
            window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN,
        );
        const top = placement === 'above' ? rect.top - 8 : rect.bottom + 8;

        setPosition({ top, left, placement });
    }

    function hide() {
        setPosition(null);
    }

    return (
        <span className="relative ml-1 inline-flex align-middle">
            <span
                ref={iconRef}
                onMouseEnter={show}
                onMouseLeave={hide}
                className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-ink-faint text-[9px] font-bold leading-none text-ink-faint"
                aria-label={text}
            >
                i
            </span>
            {position && (
                <span
                    role="tooltip"
                    style={{
                        position: 'fixed',
                        top: position.top,
                        left: position.left,
                        width: TOOLTIP_WIDTH,
                        transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
                    }}
                    className="z-50 rounded-md border border-line bg-card p-2 text-[11px] font-normal normal-case leading-snug text-ink-soft shadow-md"
                >
                    {text}
                </span>
            )}
        </span>
    );
}
