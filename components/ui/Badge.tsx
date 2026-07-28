import { HTMLAttributes } from 'react';

export type BadgeVariant = 'neutral' | 'community' | 'designer' | 'success' | 'warning' | 'danger';

// Colori legati alla provenienza fonte (manuale/community/designer) e agli
// stati semantici del tema — mai un colore scelto ad hoc fuori da theme.css.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
    neutral: 'bg-accent-manual-soft text-ink-soft',
    community: 'bg-accent-community-soft text-accent-community',
    designer: 'bg-accent-designer-soft text-accent-designer',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
}

export function Badge({ variant = 'neutral', className = '', ...props }: BadgeProps) {
    return (
        <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${VARIANT_CLASSES[variant]} ${className}`}
            {...props}
        />
    );
}
