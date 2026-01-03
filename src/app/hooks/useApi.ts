/**
 * Custom React hooks for HomeMic API and WebSocket
 */
import { useState, useEffect, useCallback } from 'react';
import { api, Node, Speaker, Transcription, SystemStatus, Keyword } from '../lib/api';
import { websocket, WebSocketEvent, TranscriptionEvent } from '../lib/websocket';

// ============ API HOOKS ============

export function useNodes() {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getNodes();
            setNodes(data);
            setError(null);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        // Refresh every 30 seconds
        const interval = setInterval(refresh, 30000);
        return () => clearInterval(interval);
    }, [refresh]);

    return { nodes, loading, error, refresh, setNodes };
}

export function useSpeakers() {
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getSpeakers();
            setSpeakers(data);
            setError(null);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { speakers, loading, error, refresh, setSpeakers };
}

export function useTranscriptions(params?: {
    limit?: number;
    nodeId?: string;
    speakerId?: string;
    search?: string;
}) {
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getTranscriptions({
                limit: params?.limit || 50,
                node_id: params?.nodeId,
                speaker_id: params?.speakerId,
                search: params?.search,
            });
            setTranscriptions(data);
            setError(null);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [params?.limit, params?.nodeId, params?.speakerId, params?.search]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { transcriptions, loading, error, refresh, setTranscriptions };
}

export function useSystemStatus() {
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getSystemStatus();
            setStatus(data);
            setError(null);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        // Refresh every 10 seconds
        const interval = setInterval(refresh, 10000);
        return () => clearInterval(interval);
    }, [refresh]);

    return { status, loading, error, refresh };
}

export function useKeywords() {
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getKeywords();
            setKeywords(data);
            setError(null);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { keywords, loading, error, refresh, setKeywords };
}

// ============ WEBSOCKET HOOKS ============

export function useWebSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

    useEffect(() => {
        const unsubscribe = websocket.subscribe((event) => {
            setLastEvent(event);

            if (event.type === 'connected') {
                setIsConnected(true);
            } else if (event.type === 'disconnected') {
                setIsConnected(false);
            }
        });

        websocket.connect();

        return () => {
            unsubscribe();
        };
    }, []);

    return { isConnected, lastEvent };
}

export function useLiveTranscriptions(maxItems: number = 50) {
    const [transcriptions, setTranscriptions] = useState<TranscriptionEvent[]>([]);
    const { isConnected, lastEvent } = useWebSocket();

    // Load initial transcriptions from API as fallback
    useEffect(() => {
        api.getRecentTranscriptions(30).then((data) => {
            const events: TranscriptionEvent[] = data.map((t) => ({
                transcription_id: t.id,
                node_id: t.node_id || '',
                node_name: t.node_name || 'Unknown',
                speaker_id: t.speaker_id || null,
                speaker_name: t.speaker_name || null,
                text: t.text,
                confidence: t.confidence,
                timestamp: t.timestamp,
                keywords_detected: [],
            }));
            setTranscriptions(events);
        }).catch(console.error);
    }, []);

    // Handle WebSocket events
    useEffect(() => {
        if (!lastEvent) return;

        if (lastEvent.type === 'initial_state') {
            // Use WebSocket initial state if available
            setTranscriptions(lastEvent.transcriptions.slice(0, maxItems));
        } else if (lastEvent.type === 'transcription') {
            setTranscriptions((prev) =>
                [lastEvent.data, ...prev].slice(0, maxItems)
            );
        }
    }, [lastEvent, maxItems]);

    return { transcriptions, isConnected };
}

export function useAudioLevels() {
    const [levels, setLevels] = useState<Record<string, number>>({});
    const { isConnected, lastEvent } = useWebSocket();

    useEffect(() => {
        if (!lastEvent) return;

        if (lastEvent.type === 'audio_level') {
            setLevels((prev) => ({
                ...prev,
                [lastEvent.data.node_id]: lastEvent.data.level
            }));
        }
    }, [lastEvent]);

    return { levels, isConnected };
}

// ============ BATCH CLIP HOOKS ============

export function useBatchClips(params?: {
    nodeId?: string;
    status?: string;
    limit?: number;
}) {
    const [clips, setClips] = useState<import('../lib/api').BatchClip[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [offset, setOffset] = useState(0);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getBatchHistory({
                node_id: params?.nodeId,
                status: params?.status,
                limit: params?.limit || 20,
                offset,
            });
            setClips(data.clips);
            setTotal(data.total);
            setError(null);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [params?.nodeId, params?.status, params?.limit, offset]);

    useEffect(() => {
        refresh();
        // Refresh every 30 seconds
        const interval = setInterval(refresh, 30000);
        return () => clearInterval(interval);
    }, [refresh]);

    const nextPage = useCallback(() => {
        if (offset + (params?.limit || 20) < total) {
            setOffset((prev) => prev + (params?.limit || 20));
        }
    }, [offset, total, params?.limit]);

    const prevPage = useCallback(() => {
        setOffset((prev) => Math.max(0, prev - (params?.limit || 20)));
    }, [params?.limit]);

    return { clips, total, loading, error, refresh, offset, nextPage, prevPage };
}

export function useBatchClipDetails(clipId: string | null) {
    const [clip, setClip] = useState<import('../lib/api').BatchClipDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (!clipId) {
            setClip(null);
            return;
        }

        try {
            setLoading(true);
            const data = await api.getBatchClipDetails(clipId);
            setClip(data);
            setError(null);
        } catch (e) {
            setError(e as Error);
        } finally {
            setLoading(false);
        }
    }, [clipId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const audioUrl = clipId ? api.getClipAudioUrl(clipId) : null;

    return { clip, loading, error, refresh, audioUrl };
}
