import { Card } from './ui/card';
import { AudioVisualization } from './AudioVisualization';
import { useNodes, useSystemStatus, useSpeakers, useAudioLevels } from '../hooks/useApi';
import { Loader2 } from 'lucide-react';

export function DashboardSidebar() {
    const { nodes, loading: nodesLoading } = useNodes();
    const { status, loading: statusLoading } = useSystemStatus();
    const { speakers } = useSpeakers();
    const { levels: audioLevels } = useAudioLevels();

    // Determine which nodes are "active" based on recent last_seen
    // Backend returns UTC timestamps without 'Z' suffix, so we append it for proper parsing
    const now = Date.now();
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const activeNodeIds = nodes
        .filter(n => {
            if (n.status !== 'online') return false;
            // Parse timestamp as UTC by appending 'Z' if missing
            const lastSeenStr = n.last_seen.endsWith('Z') ? n.last_seen : n.last_seen + 'Z';
            const lastSeenMs = new Date(lastSeenStr).getTime();
            const ageMs = now - lastSeenMs;
            return ageMs < FIVE_MINUTES_MS;
        })
        .map(n => n.id);

    return (
        <div className="space-y-6">
            {/* Audio Visualizations */}
            <div className="space-y-3">
                <h3>Live Audio Activity</h3>
                {nodesLoading && nodes.length === 0 ? (
                    <Card className="p-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </Card>
                ) : nodes.length === 0 ? (
                    <Card className="p-4 text-center text-muted-foreground">
                        <p>No nodes registered</p>
                    </Card>
                ) : (
                    nodes.slice(0, 3).map(node => (
                        <AudioVisualization
                            key={node.id}
                            nodeId={node.id}
                            nodeName={node.location}
                            isActive={activeNodeIds.includes(node.id)}
                            audioLevel={audioLevels[node.id] ?? 0}
                        />
                    ))
                )}
                {nodes.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                        +{nodes.length - 3} more nodes
                    </p>
                )}
            </div>

            <Card className="p-4">
                <h3 className="mb-4">Quick Stats</h3>
                {statusLoading && !status ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Active Nodes</p>
                            <p className="text-2xl">
                                {status?.activeNodes ?? 0} / {status?.totalNodes ?? 0}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Enrolled Speakers</p>
                            <p className="text-2xl">{status?.enrolledSpeakers ?? speakers.length}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Pending Reminders</p>
                            <p className="text-2xl">{status?.pendingReminders ?? 0}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Avg. Accuracy</p>
                            <p className="text-2xl">{status?.speakerAccuracy ?? 0}%</p>
                        </div>
                    </div>
                )}
            </Card>

            <Card className="p-4">
                <h3 className="mb-4">Node Status</h3>
                {nodesLoading && nodes.length === 0 ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : nodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No nodes registered</p>
                ) : (
                    <div className="space-y-3 text-sm">
                        {nodes.map(node => (
                            <div key={node.id} className="flex justify-between">
                                <span className="text-muted-foreground">{node.location}</span>
                                <span className={node.status === 'online' ? 'text-green-500' : 'text-red-500'}>
                                    {node.status === 'online' ? 'Online' : 'Offline'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
