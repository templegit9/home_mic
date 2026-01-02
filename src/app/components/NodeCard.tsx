import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Circle, Wifi, WifiOff } from 'lucide-react';

interface NodeCardProps {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'warning';
  audioFiltering: boolean;
  onFilteringToggle: (id: string, enabled: boolean) => void;
  latency: number;
  lastSeen: Date;
}

export function NodeCard({
  id,
  name,
  location,
  status,
  audioFiltering,
  onFilteringToggle,
  latency,
  lastSeen,
}: NodeCardProps) {
  const statusConfig = {
    online: { color: 'text-green-500', label: 'Online', icon: Wifi },
    offline: { color: 'text-gray-400', label: 'Offline', icon: WifiOff },
    warning: { color: 'text-yellow-500', label: 'Warning', icon: Wifi },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="flex items-center gap-2">
            {name}
            <Circle className={`w-2 h-2 fill-current ${config.color}`} />
          </h3>
          <p className="text-sm text-muted-foreground">{location}</p>
        </div>
        <StatusIcon className={`w-5 h-5 ${config.color}`} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Latency</span>
          <span className={latency > 2000 ? 'text-yellow-500' : ''}>{latency}ms</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Last seen</span>
          <span>{lastSeen.toLocaleTimeString()}</span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Label htmlFor={`filtering-${id}`} className="text-sm cursor-pointer">
            Audio Filtering
          </Label>
          <Switch
            id={`filtering-${id}`}
            checked={audioFiltering}
            onCheckedChange={(checked) => onFilteringToggle(id, checked)}
            disabled={status === 'offline'}
          />
        </div>
      </div>
    </Card>
  );
}
