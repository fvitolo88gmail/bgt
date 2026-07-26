import ReactMarkdown from 'react-markdown';
import { ChatMessage } from './types';
import { SourcesList } from './SourcesList';

interface MessageBubbleProps {
    message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isAssistant = message.role === 'assistant';

    return (
        <div className={`flex ${!isAssistant ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-prose rounded-lg px-4 py-2 ${
                    !isAssistant ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
                }`}
            >
                {isAssistant ? (
                    <div className="text-sm [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_strong]:font-semibold [&_a]:text-blue-600 [&_a]:underline [&_a]:font-medium hover:[&_a]:text-blue-800">
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
            </div>
        </div>
    );
}
