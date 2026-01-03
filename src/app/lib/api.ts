/**
 * HomeMic API Client
 * Connects to the backend at the configured server URL
 */

// Backend API URL - can be overridden via environment variable
const API_URL = import.meta.env.VITE_API_URL || 'http://35.224.111.227:8420';

export interface Node {
    id: string;
    name: string;
    location: string;
    status: 'online' | 'offline' | 'warning';
    audio_filtering: boolean;
    latency: number;
    last_seen: string;
}

export interface Speaker {
    id: string;
    name: string;
    color: string;
    created_at: string;
    voice_embedding: string | null;
    sample_count: number;
}

export interface Transcription {
    id: string;
    node_id: string | null;
    speaker_id: string | null;
    speaker_name?: string;
    node_name?: string;
    text: string;
    confidence: number;
    timestamp: string;
    audio_duration: number;
}

export interface SystemStatus {
    uptime: number;
    activeNodes: number;
    totalNodes: number;
    enrolledSpeakers: number;
    pendingReminders: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    transcriptionLatency: number;
    speakerAccuracy: number;
}

export interface Keyword {
    id: string;
    phrase: string;
    category: string;
    priority: string;
    enabled: boolean;
    case_sensitive: boolean;
    detection_count: number;
    last_detected: string | null;
}

export interface BatchClip {
    id: string;
    node_id: string;
    filename: string;
    duration_seconds: number;
    recorded_at: string;
    status: 'pending' | 'processing' | 'transcribed' | 'failed';
    word_count: number;
    transcript_preview?: string | null;
}

export interface TranscriptSegment {
    id: string;
    start_time: number;
    end_time: number;
    text: string;
    confidence: number;
    speaker_id?: string | null;
}

export interface BatchClipDetails extends BatchClip {
    file_size: number;
    uploaded_at: string;
    processed_at?: string | null;
    error_message?: string | null;
    processing_duration_ms?: number | null;
    transcript_text?: string | null;
    segments: TranscriptSegment[];
}

export interface BatchHistoryResponse {
    total: number;
    offset: number;
    limit: number;
    clips: BatchClip[];
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_URL) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    // Generic fetch helper (public for custom endpoints)
    async fetch<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || `HTTP ${response.status}`);
        }

        return response.json();
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            await this.fetch('/');
            return true;
        } catch {
            return false;
        }
    }

    // ============ NODES ============

    async getNodes(): Promise<Node[]> {
        return this.fetch<Node[]>('/api/nodes');
    }

    async getNode(id: string): Promise<Node> {
        return this.fetch<Node>(`/api/nodes/${id}`);
    }

    async createNode(name: string, location: string): Promise<Node> {
        return this.fetch<Node>('/api/nodes', {
            method: 'POST',
            body: JSON.stringify({ name, location }),
        });
    }

    async updateNodeFiltering(id: string, enabled: boolean): Promise<Node> {
        return this.fetch<Node>(`/api/nodes/${id}/filtering`, {
            method: 'POST',
            body: JSON.stringify({ enabled }),
        });
    }

    async deleteNode(id: string): Promise<void> {
        await this.fetch(`/api/nodes/${id}`, { method: 'DELETE' });
    }

    // ============ SPEAKERS ============

    async getSpeakers(): Promise<Speaker[]> {
        return this.fetch<Speaker[]>('/api/speakers');
    }

    async createSpeaker(name: string, color?: string): Promise<Speaker> {
        return this.fetch<Speaker>('/api/speakers', {
            method: 'POST',
            body: JSON.stringify({ name, color }),
        });
    }

    async updateSpeaker(id: string, updates: Partial<Speaker>): Promise<Speaker> {
        return this.fetch<Speaker>(`/api/speakers/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    async deleteSpeaker(id: string): Promise<void> {
        await this.fetch(`/api/speakers/${id}`, { method: 'DELETE' });
    }

    // ============ TRANSCRIPTIONS ============

    async getTranscriptions(params?: {
        limit?: number;
        offset?: number;
        speaker_id?: string;
        node_id?: string;
        search?: string;
    }): Promise<Transcription[]> {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', params.limit.toString());
        if (params?.offset) query.set('offset', params.offset.toString());
        if (params?.speaker_id) query.set('speaker_id', params.speaker_id);
        if (params?.node_id) query.set('node_id', params.node_id);
        if (params?.search) query.set('search', params.search);

        const queryStr = query.toString();
        return this.fetch<Transcription[]>(`/api/transcriptions${queryStr ? `?${queryStr}` : ''}`);
    }

    async getRecentTranscriptions(minutes: number = 5): Promise<Transcription[]> {
        return this.fetch<Transcription[]>(`/api/transcriptions/recent?minutes=${minutes}`);
    }

    async deleteTranscription(id: string): Promise<void> {
        await this.fetch(`/api/transcriptions/${id}`, { method: 'DELETE' });
    }

    // ============ BATCH CLIPS ============

    async getBatchHistory(params?: {
        node_id?: string;
        status?: string;
        start_date?: string;
        end_date?: string;
        limit?: number;
        offset?: number;
    }): Promise<BatchHistoryResponse> {
        const query = new URLSearchParams();
        if (params?.node_id) query.set('node_id', params.node_id);
        if (params?.status) query.set('status', params.status);
        if (params?.start_date) query.set('start_date', params.start_date);
        if (params?.end_date) query.set('end_date', params.end_date);
        if (params?.limit) query.set('limit', params.limit.toString());
        if (params?.offset) query.set('offset', params.offset.toString());

        const queryStr = query.toString();
        return this.fetch<BatchHistoryResponse>(`/api/batch/history${queryStr ? `?${queryStr}` : ''}`);
    }

    async getBatchClipDetails(clipId: string): Promise<BatchClipDetails> {
        return this.fetch<BatchClipDetails>(`/api/batch/clips/${clipId}`);
    }

    async deleteBatchClip(clipId: string, deleteFile: boolean = true): Promise<void> {
        await this.fetch(`/api/batch/clips/${clipId}?delete_file=${deleteFile}`, { method: 'DELETE' });
    }

    getClipAudioUrl(clipId: string): string {
        return `${this.baseUrl}/api/batch/clips/${clipId}/audio`;
    }

    // ============ SYSTEM ============

    async getSystemStatus(): Promise<SystemStatus> {
        return this.fetch<SystemStatus>('/api/status');
    }

    async getSystemAnalytics(days: number = 7): Promise<any> {
        return this.fetch(`/api/system/analytics?days=${days}`);
    }

    // ============ KEYWORDS ============

    async getKeywords(): Promise<Keyword[]> {
        return this.fetch<Keyword[]>('/api/keywords');
    }

    async createKeyword(keyword: Partial<Keyword>): Promise<Keyword> {
        return this.fetch<Keyword>('/api/keywords', {
            method: 'POST',
            body: JSON.stringify(keyword),
        });
    }

    async updateKeyword(id: string, updates: Partial<Keyword>): Promise<Keyword> {
        return this.fetch<Keyword>(`/api/keywords/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    }

    async deleteKeyword(id: string): Promise<void> {
        await this.fetch(`/api/keywords/${id}`, { method: 'DELETE' });
    }

    // ============ PRIVACY ============

    async getPrivacyZones(): Promise<any[]> {
        return this.fetch('/api/privacy/zones');
    }

    async muteNode(nodeId: string, durationMinutes?: number): Promise<void> {
        const query = durationMinutes ? `?duration_minutes=${durationMinutes}` : '';
        await this.fetch(`/api/privacy/mute/${nodeId}${query}`, { method: 'POST' });
    }

    async unmuteNode(nodeId: string): Promise<void> {
        await this.fetch(`/api/privacy/unmute/${nodeId}`, { method: 'POST' });
    }

    async muteAll(durationMinutes?: number): Promise<void> {
        const query = durationMinutes ? `?duration_minutes=${durationMinutes}` : '';
        await this.fetch(`/api/privacy/mute-all${query}`, { method: 'POST' });
    }

    async unmuteAll(): Promise<void> {
        await this.fetch('/api/privacy/unmute-all', { method: 'POST' });
    }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for custom instances
export { ApiClient };
