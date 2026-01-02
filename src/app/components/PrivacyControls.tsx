import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { MicOff, Clock, Shield, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PrivacyZone {
  id: string;
  nodeId: string;
  nodeName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  reason: string;
  active: boolean;
}

interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  days: string[];
}

export function PrivacyControls() {
  const [nodes, setNodes] = useState([
    { id: 'node-1', name: 'Living Room', muted: false },
    { id: 'node-2', name: 'Kitchen', muted: false },
  ]);

  const [privacyZones, setPrivacyZones] = useState<PrivacyZone[]>([
    {
      id: '1',
      nodeId: 'node-1',
      nodeName: 'Living Room',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() - 1800000),
      reason: 'Private conversation',
      active: false,
    },
  ]);

  const [quietHours, setQuietHours] = useState<QuietHours>({
    enabled: true,
    startTime: '22:00',
    endTime: '07:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  });

  const [globalMute, setGlobalMute] = useState(false);

  const toggleNodeMute = (nodeId: string) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, muted: !node.muted } : node
      )
    );
    const node = nodes.find(n => n.id === nodeId);
    toast.success(`${node?.name} ${node?.muted ? 'unmuted' : 'muted'}`);
  };

  const toggleGlobalMute = () => {
    setGlobalMute(!globalMute);
    toast.success(`All nodes ${globalMute ? 'unmuted' : 'muted'}`);
  };

  const createPrivacyZone = (nodeId: string, duration: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const newZone: PrivacyZone = {
      id: Date.now().toString(),
      nodeId,
      nodeName: node.name,
      startTime: new Date(),
      duration,
      reason: 'Temporary privacy zone',
      active: true,
    };

    setPrivacyZones(prev => [...prev, newZone]);
    toast.success(`Privacy zone activated for ${node.name} (${duration} min)`);

    // Auto-deactivate after duration
    setTimeout(() => {
      setPrivacyZones(prev =>
        prev.map(zone =>
          zone.id === newZone.id
            ? { ...zone, active: false, endTime: new Date() }
            : zone
        )
      );
      toast.info(`Privacy zone ended for ${node.name}`);
    }, duration * 60000);
  };

  const updateQuietHours = (updates: Partial<QuietHours>) => {
    setQuietHours(prev => ({ ...prev, ...updates }));
    toast.success('Quiet hours updated');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2>Privacy Controls</h2>
        <p className="text-sm text-muted-foreground">
          Manage recording permissions and privacy zones
        </p>
      </div>

      {/* Global Controls */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <h3>Global Privacy</h3>
          </div>
          {globalMute && (
            <Badge variant="destructive">All Nodes Muted</Badge>
          )}
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${globalMute ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
              <MicOff className={`w-5 h-5 ${globalMute ? 'text-red-500' : 'text-green-500'}`} />
            </div>
            <div>
              <Label htmlFor="global-mute" className="cursor-pointer">
                Global Mute
              </Label>
              <p className="text-sm text-muted-foreground">
                Disable all microphones system-wide
              </p>
            </div>
          </div>
          <Switch
            id="global-mute"
            checked={globalMute}
            onCheckedChange={toggleGlobalMute}
          />
        </div>
      </Card>

      {/* Individual Node Controls */}
      <Card className="p-4">
        <h3 className="mb-4">Node Controls</h3>
        <div className="space-y-3">
          {nodes.map(node => (
            <div key={node.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${node.muted ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                  <MicOff className={`w-4 h-4 ${node.muted ? 'text-red-500' : 'text-blue-500'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{node.name}</span>
                    {node.muted && <Badge variant="secondary">Muted</Badge>}
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="link" className="h-auto p-0 text-xs">
                        Create privacy zone
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Privacy Zone - {node.name}</DialogTitle>
                        <DialogDescription>
                          Temporarily disable recording for a specific duration
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-3 pt-4">
                        <Button
                          onClick={() => createPrivacyZone(node.id, 30)}
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          30 minutes
                        </Button>
                        <Button
                          onClick={() => createPrivacyZone(node.id, 60)}
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          1 hour
                        </Button>
                        <Button
                          onClick={() => createPrivacyZone(node.id, 180)}
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          3 hours
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <Switch
                checked={node.muted}
                onCheckedChange={() => toggleNodeMute(node.id)}
                disabled={globalMute}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Quiet Hours */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            <h3>Scheduled Quiet Hours</h3>
          </div>
          <Switch
            checked={quietHours.enabled}
            onCheckedChange={(enabled) => updateQuietHours({ enabled })}
          />
        </div>

        {quietHours.enabled && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select
                  value={quietHours.startTime}
                  onValueChange={(startTime) => updateQuietHours({ startTime })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Select
                  value={quietHours.endTime}
                  onValueChange={(endTime) => updateQuietHours({ endTime })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return (
                        <SelectItem key={hour} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Recording disabled from {quietHours.startTime} to {quietHours.endTime}
            </p>
          </div>
        )}
      </Card>

      {/* Privacy Zone History */}
      <Card className="p-4">
        <h3 className="mb-4">Privacy Zone History</h3>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {privacyZones.map(zone => (
              <div key={zone.id} className="flex items-center justify-between p-2 rounded border text-sm">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{zone.nodeName}</span>
                    <p className="text-xs text-muted-foreground">
                      {zone.startTime.toLocaleString()}
                      {zone.endTime && ` - ${zone.endTime.toLocaleTimeString()}`}
                    </p>
                  </div>
                </div>
                <Badge variant={zone.active ? 'default' : 'secondary'}>
                  {zone.active ? 'Active' : 'Ended'}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Privacy Warning */}
      <Card className="p-4 border-yellow-500/20 bg-yellow-500/5">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-600 dark:text-yellow-500">Privacy Notice</h4>
            <p className="text-sm text-muted-foreground mt-1">
              All audio processing occurs locally on your network. When nodes are muted or in privacy zones,
              no recording or transcription takes place. All privacy events are logged for auditing purposes.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
