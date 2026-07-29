'use client';

import { useEffect, useRef, useState } from 'react';

export interface DropdownOption {
    value: string;
    label: string;
}

interface DropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    id?: string;
}

// Dropdown personalizzato (non <select> nativo) per uno stile coerente col
// tema su tutti i browser — apertura/chiusura su click esterno o Esc.
export function Dropdown({ options, value, onChange, placeholder = 'Seleziona...', id }: DropdownProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;

        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpen(false);
        }

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const selected = options.find((option) => option.value === value);

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                id={id}
                onClick={() => setOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-soft"
            >
                <span className={selected ? '' : 'text-ink-faint'}>{selected?.label ?? placeholder}</span>
                <span
                    className={`ml-2 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                >
                    ▾
                </span>
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-line bg-card py-1 shadow-lg"
                >
                    {options.map((option) => (
                        <li key={option.value}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={option.value === value}
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                className={`block w-full px-3 py-2 text-left text-sm hover:bg-primary-soft ${
                                    option.value === value ? 'bg-primary-soft font-medium text-primary' : 'text-ink'
                                }`}
                            >
                                {option.label}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
