import ReactMarkdown from 'react-markdown';
import { ChatMessage } from './types';
import { SourcesList } from './SourcesList';
import { Card } from '@/components/ui/Card';

interface MessageBubbleProps {
    message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isAssistant = message.role === 'assistant';

    return (
        <div className={`flex ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
            <Card
                className={`max-w-prose px-4 py-2 ${
                    !isAssistant ? 'border-transparent bg-primary text-white' : 'text-ink'
                }`}
            >
                {isAssistant ? (
                    <div className="text-sm [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_a]:font-medium [&_a]:text-primary [&_a]:underline hover:[&_a]:text-primary-hover">
                        <ReactMarkdown
                            components={{
                                a: ({ ...props }) => (
                                    <a {...props} target="_blank" rel="noopener noreferrer" />
                                ),
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <p className="text-sm">{message.content}</p>
                )}

                {message.sources && <SourcesList sources={message.sources} />}
            </Card>
        </div>
    );
}
