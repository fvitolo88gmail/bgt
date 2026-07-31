'use client';

import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { Input } from './Input';

// Wrapper su Input con toggle mostra/nascondi: evita di duplicare il
// bottone occhiolino in ogni form che chiede una password.
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
    function PasswordInput({ className = '', ...props }, ref) {
        const [visible, setVisible] = useState(false);

        return (
            <div className="relative">
                <Input ref={ref} type={visible ? 'text' : 'password'} className={`pr-10 ${className}`} {...props} />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? 'Nascondi password' : 'Mostra password'}
                    aria-pressed={visible}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-faint hover:text-ink-soft"
                >
                    {visible ? (
                        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M6.53 6.53C4.6 7.9 3.14 9.8 2.5 12c1.2 3.9 5 7 9.5 7 1.66 0 3.2-.42 4.53-1.14M9.9 4.24A10.9 10.9 0 0112 4c4.5 0 8.3 3.1 9.5 7-.4 1.3-1.05 2.5-1.89 3.53"
                            />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.5 12c1.2-3.9 5-7 9.5-7s8.3 3.1 9.5 7c-1.2 3.9-5 7-9.5 7s-8.3-3.1-9.5-7z"
                            />
                            <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </button>
            </div>
        );
    },
);
