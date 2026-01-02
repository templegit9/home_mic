import { useCallback } from 'react';
import { NodeCard } from './NodeCard';
import { Button } from './ui/button';
import { Plus, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNodes } from '../hooks/useApi';
import { api } from '../lib/api';

export function NodesView() {
  const { nodes, loading, error, refresh, setNodes } = useNodes();

  const handleFilteringToggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      const updated = await api.updateNodeFiltering(id, enabled);
      setNodes(prev =>
        prev.map(node =>
          node.id === id ? { ...node, audio_filtering: updated.audio_filtering } : node
        )
      );
      toast.success(`Audio filtering ${enabled ? 'enabled' : 'disabled'}`);
    } catch (e) {
      toast.error('Failed to update node filtering');
      console.error(e);
    }
  }, [setNodes]);

  const handleAddNode = useCallback(async () => {
    // For now, show a toast - could open a modal in the future
    toast.info('New nodes register automatically when they connect');
  }, []);

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Failed to load nodes</p>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>Microphone Nodes</h2>
          <p className="text-sm text-muted-foreground">
            Manage distributed microphone nodes across your home
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Button onClick={handleAddNode}>
            <Plus className="w-4 h-4 mr-2" />
            Add Node
          </Button>
        </div>
      </div>

      {loading && nodes.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No nodes registered yet</p>
          <p className="text-sm">Run the setup script on a Raspberry Pi to add a node</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              id={node.id}
              name={node.name}
              location={node.location}
              status={node.status}
              audioFiltering={node.audio_filtering}
              latency={node.latency}
              lastSeen={new Date(node.last_seen)}
              onFilteringToggle={handleFilteringToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
