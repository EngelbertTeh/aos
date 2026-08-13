export interface Lobby {
    id: string;
    title: string;
    host_id: string;
    started: boolean;
    paused?: boolean;
    current_index?: number;
    participant_order?: Array<{
        user_id: string;
        nickname: string;
    }>;
    source_text?: string;
    expires_at?: string;
}