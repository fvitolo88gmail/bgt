import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
    ghost: 'bg-transparent text-ink border border-line hover:bg-paper-2',
    // Conferma di un'azione distruttiva (es. eliminazione conversazione) —
    // stessa classe hover del colore base: nessun tono "hover" più scuro
    // definito per --danger nella palette, a differenza di --primary-hover.
    danger: 'bg-danger text-white hover:bg-danger/90',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', className = '', ...props },
    ref
) {
    return (
        <button
            ref={ref}
            className={`cursor-pointer rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
            {...props}
        />
    );
});
