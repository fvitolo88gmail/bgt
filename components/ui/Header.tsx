import Link from 'next/link';
import { OwlMark } from './OwlMark';

export function Header() {
    return (
        <header className="flex items-center gap-2 border-b border-line-soft bg-card px-4 py-3">
            <Link href="/home" className="flex items-center gap-2 font-serif text-base font-bold text-ink">
                <OwlMark size={24} />
                BGT
            </Link>
        </header>
    );
}
