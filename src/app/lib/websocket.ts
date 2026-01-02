/**
 * HomeMic WebSocket Client
 * Real-time connection to backend for live transcription updates
 */

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://10.0.0.120:8420';

export type WebSocketEvent =
    | { type: 'transcription'; data: TranscriptionEvent }
    | { type: 'node_status'; data: NodeStatusEvent }
    | { type: 'keyword_detected'; data: KeywordEvent }
    | { type: 'connected' }
    | { type: 'disconnected' }
    | { type: 'error'; error: Error };

export interface TranscriptionEvent {
    transcription_id: string;
    node_id: string;
    node_name: string;
    speaker_id: string | null;
    speaker_name: string | null;
    text: string;
    confidence: number;
    timestamp: string;
    keywords_detected: string[];
}

export interface NodeStatusEvent {
    node_id: string;
    status: 'online' | 'offline';
    latency?: number;
}

export interface KeywordEvent {
    keyword: string;
    transcription_id: string;
    timestamp: string;
}

type EventHandler = (event: WebSocketEvent) => void;

class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private handlers: Set<EventHandler> = new Set();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectDelay = 2000;
    private isManualClose = false;

    constructor(baseUrl: string = WS_URL) {
        this.url = baseUrl.replace(/\/$/, '');
    }

    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        this.isManualClose = false;
        const wsUrl = `${this.url}/ws/dashboard`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('[WebSocket] Connected to HomeMic');
                this.reconnectAttempts = 0;
                this.emit({ type: 'connected' });
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('[WebSocket] Failed to parse message:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('[WebSocket] Disconnected');
                this.emit({ type: 'disconnected' });

                if (!this.isManualClose) {
                    this.scheduleReconnect();
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WebSocket] Error:', error);
                this.emit({ type: 'error', error: new Error('WebSocket error') });
            };
        } catch (error) {
            console.error('[WebSocket] Failed to connect:', error);
            this.scheduleReconnect();
        }
    }

    disconnect(): void {
        this.isManualClose = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    subscribe(handler: EventHandler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    private emit(event: WebSocketEvent): void {
        this.handlers.forEach(handler => {
            try {
                handler(event);
            } catch (e) {
                console.error('[WebSocket] Handler error:', e);
            }
        });
    }

    private handleMessage(data: any): void {
        switch (data.type) {
            case 'transcription':
                this.emit({ type: 'transcription', data: data.data });
                break;
            case 'node_status':
                this.emit({ type: 'node_status', data: data.data });
                break;
            case 'keyword_detected':
                this.emit({ type: 'keyword_detected', data: data.data });
                break;
            default:
                console.log('[WebSocket] Unknown message type:', data.type);
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WebSocket] Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            if (!this.isManualClose) {
                this.connect();
            }
        }, delay);
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Export singleton instance
export const websocket = new WebSocketClient();

// Export class for custom instances
export { WebSocketClient };
