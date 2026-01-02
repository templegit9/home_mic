import { useState } from 'react';
import { NodeCard } from './NodeCard';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Node {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'warning';
  audioFiltering: boolean;
  latency: number;
  lastSeen: Date;
}

export function NodesView() {
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'node-1',
      name: 'Living Room Node',
      location: 'Living Room',
      status: 'online',
      audioFiltering: true,
      latency: 1420,
      lastSeen: new Date(),
    },
    {
      id: 'node-2',
      name: 'Kitchen Node',
      location: 'Kitchen',
      status: 'online',
      audioFiltering: false,
      latency: 1580,
      lastSeen: new Date(),
    },
  ]);

  const handleFilteringToggle = (id: string, enabled: boolean) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === id ? { ...node, audioFiltering: enabled } : node
      )
    );
    toast.success(`Audio filtering ${enabled ? 'enabled' : 'disabled'}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>Microphone Nodes</h2>
          <p className="text-sm text-muted-foreground">
            Manage distributed microphone nodes across your home
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Node
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            {...node}
            onFilteringToggle={handleFilteringToggle}
          />
        ))}
      </div>
    </div>
  );
}
