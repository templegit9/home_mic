/**
 * SystemControlPanel - Health checks and live log viewer
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
    RefreshCw, Server, Radio, CheckCircle, XCircle,
    AlertCircle, Terminal, Play, Pause, Trash2
} from 'lucide-react';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://10.0.0.135:8420';
const WS_URL = (import.meta.env.VITE_WS_URL || 'ws://10.0.0.135:8420').replace('ws://', 'ws://').replace('http://', 'ws://');

interface NodeStatus {
    id: string;
    name: string;
    location: string;
    status: 'online' | 'offline';
    last_seen: string | null;
}

interface HealthStatus {
    server: {
        status: string;
        cpu_percent: number;
        memory_percent: number;
        disk_percent: number;
    };
    nodes: NodeStatus[];
    overall: 'healthy' | 'degraded' | 'offline';
}

interface LogEntry {
    timestamp: string;
    level: string;
    source: string;
    message: string;
}

export function SystemControlPanel() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);

    const wsRef = useRef<WebSocket | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Fetch health status
    const checkHealth = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/control/health`);
            if (res.ok) {
                const data = await res.json();
                setHealth(data);
            }
        } catch (err) {
            console.error('Health check failed:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Restart states
    const [backendUpdating, setBackendUpdating] = useState(false);
    const [nodeUpdating, setNodeUpdating] = useState(false);
    const [lastAction, setLastAction] = useState<string | null>(null);

    // Update and restart backend
    const updateBackend = async () => {
        setBackendUpdating(true);
        setLastAction(null);
        try {
            const res = await fetch(`${API_URL}/api/control/backend/update`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLastAction('Backend updating... page will refresh shortly');
                // Backend will restart, wait then refresh
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } else {
                setLastAction(`Backend update failed: ${data.error}`);
            }
        } catch (err) {
            setLastAction(`Backend update error: ${err}`);
        } finally {
            setBackendUpdating(false);
        }
    };

    // Update and restart node
    const updateNode = async () => {
        setNodeUpdating(true);
        setLastAction(null);
        try {
            const res = await fetch(`${API_URL}/api/control/node/update`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLastAction('Node updated and restarted successfully');
                // Refresh health after a moment
                setTimeout(checkHealth, 2000);
            } else {
                setLastAction(`Node update failed: ${data.error}`);
            }
        } catch (err) {
            setLastAction(`Node update error: ${err}`);
        } finally {
            setNodeUpdating(false);
        }
    };

    // Restart node only (no git pull)
    const restartNode = async () => {
        setNodeUpdating(true);
        setLastAction(null);
        try {
            const res = await fetch(`${API_URL}/api/control/node/restart`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setLastAction('Node restarted successfully');
                setTimeout(checkHealth, 2000);
            } else {
                setLastAction(`Node restart failed: ${data.error}`);
            }
        } catch (err) {
            setLastAction(`Node restart error: ${err}`);
        } finally {
            setNodeUpdating(false);
        }
    };

    // Start log streaming
    const startLogStream = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(`${WS_URL}/api/control/logs/stream`);

        ws.onopen = () => {
            console.log('[LogStream] Connected');
            setIsStreaming(true);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'heartbeat') return;

                setLogs(prev => {
                    const newLogs = [...prev, data];
                    // Keep last 200 logs
                    return newLogs.slice(-200);
                });
            } catch (e) {
                console.error('[LogStream] Parse error:', e);
            }
        };

        ws.onclose = () => {
            console.log('[LogStream] Disconnected');
            setIsStreaming(false);
            wsRef.current = null;
        };

        ws.onerror = (err) => {
            console.error('[LogStream] Error:', err);
        };

        wsRef.current = ws;
    }, []);

    // Stop log streaming
    const stopLogStream = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsStreaming(false);
    }, []);

    // Toggle streaming
    const toggleStreaming = () => {
        if (isStreaming) {
            stopLogStream();
        } else {
            startLogStream();
        }
    };

    // Clear logs
    const clearLogs = () => {
        setLogs([]);
    };

    // Auto-scroll effect
    useEffect(() => {
        if (autoScroll && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, autoScroll]);

    // Initial health check and cleanup
    useEffect(() => {
        checkHealth();
        return () => {
            stopLogStream();
        };
    }, [checkHealth, stopLogStream]);

    // Status badge helper
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'online':
            case 'healthy':
                return (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {status}
                    </Badge>
                );
            case 'offline':
                return (
                    <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        {status}
                    </Badge>
                );
            case 'degraded':
                return (
                    <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {status}
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    // Log level color
    const getLogLevelClass = (level: string) => {
        switch (level.toUpperCase()) {
            case 'ERROR':
                return 'text-red-500';
            case 'WARNING':
                return 'text-yellow-500';
            case 'INFO':
                return 'text-blue-400';
            case 'DEBUG':
                return 'text-gray-400';
            default:
                return 'text-foreground';
        }
    };

    return (
        <div className="space-y-6">
            {/* Health Status Card */}
            <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2">
                        <Server className="w-5 h-5" />
                        System Health
                    </h3>
                    <div className="flex items-center gap-2">
                        {health && getStatusBadge(health.overall)}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={checkHealth}
                            disabled={loading}
                        >
                            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            Check All
                        </Button>
                    </div>
                </div>

                {health ? (
                    <div className="space-y-4">
                        {/* Server Status */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-3">
                                <Server className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="font-medium">Backend Server</p>
                                    <p className="text-xs text-muted-foreground">
                                        CPU: {health.server.cpu_percent?.toFixed(1)}% |
                                        Memory: {health.server.memory_percent?.toFixed(1)}% |
                                        Disk: {health.server.disk_percent?.toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                            {getStatusBadge(health.server.status)}
                        </div>

                        {/* Node Status */}
                        {health.nodes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                                No nodes registered
                            </p>
                        ) : (
                            health.nodes.map(node => (
                                <div
                                    key={node.id}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <Radio className="w-5 h-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{node.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {node.location}
                                                {node.last_seen && (
                                                    <> • Last seen: {new Date(node.last_seen).toLocaleTimeString()}</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {getStatusBadge(node.status)}
                                </div>
                            ))
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                            <Button
                                variant="default"
                                size="sm"
                                onClick={updateBackend}
                                disabled={backendUpdating || nodeUpdating}
                            >
                                <RefreshCw className={`w-4 h-4 mr-1 ${backendUpdating ? 'animate-spin' : ''}`} />
                                Update Backend
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={updateNode}
                                disabled={backendUpdating || nodeUpdating}
                            >
                                <RefreshCw className={`w-4 h-4 mr-1 ${nodeUpdating ? 'animate-spin' : ''}`} />
                                Update Node
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={restartNode}
                                disabled={backendUpdating || nodeUpdating}
                            >
                                <Radio className="w-4 h-4 mr-1" />
                                Restart Node
                            </Button>
                        </div>

                        {/* Action Status */}
                        {lastAction && (
                            <p className={`text-sm ${lastAction.includes('failed') || lastAction.includes('error') ? 'text-red-500' : 'text-green-500'}`}>
                                {lastAction}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Click "Check All" to verify system health
                    </p>
                )}
            </Card>

            {/* Live Logs Card */}
            <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2">
                        <Terminal className="w-5 h-5" />
                        Live Logs
                    </h3>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={isStreaming ? 'bg-green-500/10 text-green-500' : ''}>
                            {isStreaming ? 'Streaming' : 'Stopped'}
                        </Badge>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleStreaming}
                        >
                            {isStreaming ? (
                                <><Pause className="w-4 h-4 mr-1" /> Stop</>
                            ) : (
                                <><Play className="w-4 h-4 mr-1" /> Start</>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearLogs}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <ScrollArea className="h-64 rounded-md border bg-black/90 p-2 font-mono text-xs">
                    {logs.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {isStreaming ? 'Waiting for logs...' : 'Click "Start" to stream logs'}
                        </p>
                    ) : (
                        <div className="space-y-0.5">
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-2 hover:bg-white/5 px-1 rounded">
                                    <span className="text-gray-500 shrink-0">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                    <span className={`shrink-0 w-14 ${getLogLevelClass(log.level)}`}>
                                        [{log.level}]
                                    </span>
                                    <span className="text-purple-400 shrink-0 max-w-32 truncate">
                                        {log.source}
                                    </span>
                                    <span className="text-gray-200 break-all">
                                        {log.message}
                                    </span>
                                </div>
                            ))}
                            <div ref={logsEndRef} />
                        </div>
                    )}
                </ScrollArea>

                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <span>{logs.length} log entries</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="rounded"
                        />
                        Auto-scroll
                    </label>
                </div>
            </Card>
        </div>
    );
}

export default SystemControlPanel;
