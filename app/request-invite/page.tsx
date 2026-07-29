import { RequestInviteForm } from '@/components/invite/RequestInviteForm';
import { Card } from '@/components/ui/Card';

export default function RequestInvitePage() {
    return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-4">
            <h1 className="text-center font-serif text-xl font-bold text-ink">Richiedi accesso</h1>
            <Card className="p-4">
                <RequestInviteForm />
            </Card>
        </div>
    );
}
