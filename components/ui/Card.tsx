import { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div className={`rounded-md border border-line bg-card shadow-sm ${className}`} {...props} />;
}
