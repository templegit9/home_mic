import { useState, useCallback } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { MicOff, Clock, Shield, Eye, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useNodes } from '../hooks/useApi';
import { api } from '../lib/api';

interface PrivacyZone {
  id: string;
  nodeId: string;
  nodeName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  active: boolean;
}

interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export function PrivacyControls() {
  const { nodes, loading, error, refresh, setNodes } = useNodes();

  const [privacyZones, setPrivacyZones] = useState<PrivacyZone[]>([]);
  const [quietHours, setQuietHours] = useState<QuietHours>({
    enabled: false,
    startTime: '22:00',
    endTime: '07:00',
  });
  const [globalMute, setGlobalMute] = useState(false);
  const [mutingAll, setMutingAll] = useState(false);
  const [mutingNode, setMutingNode] = useState<string | null>(null);

  const toggleNodeMute = useCallback(async (nodeId: string, currentlyMuted: boolean) => {
    setMutingNode(nodeId);
    try {
      if (currentlyMuted) {
        await api.unmuteNode(nodeId);
      } else {
        await api.muteNode(nodeId);
      }

      setNodes(prev =>
        prev.map(node =>
          node.id === nodeId ? { ...node, audio_filtering: !currentlyMuted } : node
        )
      );

      const node = nodes.find(n => n.id === nodeId);
      toast.success(`${node?.location || 'Node'} ${currentlyMuted ? 'unmuted' : 'muted'}`);
    } catch (e) {
      toast.error('Failed to update node');
      console.error(e);
    } finally {
      setMutingNode(null);
    }
  }, [nodes, setNodes]);

  const toggleGlobalMute = useCallback(async () => {
    setMutingAll(true);
    try {
      if (globalMute) {
        await api.unmuteAll();
      } else {
        await api.muteAll();
      }
      setGlobalMute(!globalMute);
      toast.success(`All nodes ${globalMute ? 'unmuted' : 'muted'}`);
      refresh();
    } catch (e) {
      toast.error('Failed to update');
      console.error(e);
    } finally {
      setMutingAll(false);
    }
  }, [globalMute, refresh]);

  const createPrivacyZone = useCallback(async (nodeId: string, duration: number) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    try {
      await api.muteNode(nodeId, duration);

      const newZone: PrivacyZone = {
        id: Date.now().toString(),
        nodeId,
        nodeName: node.location,
        startTime: new Date(),
        duration,
        active: true,
      };

      setPrivacyZones(prev => [...prev, newZone]);
      toast.success(`Privacy zone activated for ${node.location} (${duration} min)`);

      // Auto-deactivate after duration
      setTimeout(() => {
        setPrivacyZones(prev =>
          prev.map(zone =>
            zone.id === newZone.id
              ? { ...zone, active: false, endTime: new Date() }
              : zone
          )
        );
        toast.info(`Privacy zone ended for ${node.location}`);
        refresh();
      }, duration * 60000);
    } catch (e) {
      toast.error('Failed to create privacy zone');
      console.error(e);
    }
  }, [nodes, refresh]);

  const updateQuietHours = (updates: Partial<QuietHours>) => {
    setQuietHours(prev => ({ ...prev, ...updates }));
    toast.success('Quiet hours updated');
  };

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
          <h2>Privacy Controls</h2>
          <p className="text-sm text-muted-foreground">
            Manage recording permissions and privacy zones
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={refresh} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
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
          {mutingAll ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Switch
              id="global-mute"
              checked={globalMute}
              onCheckedChange={toggleGlobalMute}
            />
          )}
        </div>
      </Card>

      {/* Individual Node Controls */}
      <Card className="p-4">
        <h3 className="mb-4">Node Controls</h3>
        {loading && nodes.length === 0 ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : nodes.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No nodes registered</p>
        ) : (
          <div className="space-y-3">
            {nodes.map(node => (
              <div key={node.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${node.audio_filtering ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
                    <MicOff className={`w-4 h-4 ${node.audio_filtering ? 'text-red-500' : 'text-blue-500'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{node.location}</span>
                      <Badge variant={node.status === 'online' ? 'default' : 'secondary'}>
                        {node.status}
                      </Badge>
                      {node.audio_filtering && <Badge variant="secondary">Muted</Badge>}
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="link" className="h-auto p-0 text-xs">
                          Create privacy zone
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Privacy Zone - {node.location}</DialogTitle>
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
                {mutingNode === node.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Switch
                    checked={node.audio_filtering}
                    onCheckedChange={() => toggleNodeMute(node.id, node.audio_filtering)}
                    disabled={globalMute}
                  />
                )}
              </div>
            ))}
          </div>
        )}
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
      {privacyZones.length > 0 && (
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
      )}

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
