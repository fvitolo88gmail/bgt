import { InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    function Input({ className = '', ...props }, ref) {
        return (
            <input
                ref={ref}
                className={`w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft ${className}`}
                {...props}
            />
        );
    }
);
