export interface GameOption {
    id: string;
    name: string;
    manualReady: boolean;
    communityReady: boolean;
}

export interface RecentConversation {
    id: string;
    title: string | null;
    gameId: string;
    gameName: string;
    lastMessageAt: string | null;
}
