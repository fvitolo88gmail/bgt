import { SelectHTMLAttributes, forwardRef } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
    function Select({ className = '', ...props }, ref) {
        return (
            <select
                ref={ref}
                className={`w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft ${className}`}
                {...props}
            />
        );
    }
);
