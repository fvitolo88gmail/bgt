import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
    return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-4">
            <h1 className="text-center font-serif text-xl font-bold text-ink">Accedi</h1>
            <Card className="p-4">
                {/* useSearchParams (per il redirect post-login) richiede un boundary Suspense */}
                <Suspense fallback={null}>
                    <LoginForm />
                </Suspense>
            </Card>
        </div>
    );
}
