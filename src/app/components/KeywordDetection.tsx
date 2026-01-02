import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Bell, Plus, Trash2, Volume2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface Keyword {
  id: string;
  phrase: string;
  enabled: boolean;
  alertType: 'notification' | 'sound' | 'both';
  caseSensitive: boolean;
  detectionCount: number;
  lastDetected?: Date;
}

interface KeywordDetection {
  id: string;
  keyword: string;
  speaker: string;
  context: string;
  timestamp: Date;
  nodeId: string;
  nodeName: string;
}

export function KeywordDetection() {
  const [keywords, setKeywords] = useState<Keyword[]>([
    {
      id: '1',
      phrase: 'help',
      enabled: true,
      alertType: 'both',
      caseSensitive: false,
      detectionCount: 3,
      lastDetected: new Date(Date.now() - 3600000),
    },
    {
      id: '2',
      phrase: 'dinner is ready',
      enabled: true,
      alertType: 'notification',
      caseSensitive: false,
      detectionCount: 12,
      lastDetected: new Date(Date.now() - 86400000),
    },
    {
      id: '3',
      phrase: 'meeting',
      enabled: true,
      alertType: 'notification',
      caseSensitive: false,
      detectionCount: 8,
      lastDetected: new Date(Date.now() - 7200000),
    },
  ]);

  const [detections, setDetections] = useState<KeywordDetection[]>([
    {
      id: '1',
      keyword: 'meeting',
      speaker: 'Alice',
      context: 'What time is the meeting today?',
      timestamp: new Date(Date.now() - 7200000),
      nodeId: 'node-2',
      nodeName: 'Kitchen',
    },
    {
      id: '2',
      keyword: 'help',
      speaker: 'Bob',
      context: 'Can someone help me with this?',
      timestamp: new Date(Date.now() - 3600000),
      nodeId: 'node-1',
      nodeName: 'Living Room',
    },
  ]);

  const [newKeyword, setNewKeyword] = useState({
    phrase: '',
    alertType: 'notification' as const,
    caseSensitive: false,
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  const addKeyword = () => {
    if (!newKeyword.phrase.trim()) {
      toast.error('Please enter a keyword or phrase');
      return;
    }

    const keyword: Keyword = {
      id: Date.now().toString(),
      phrase: newKeyword.phrase,
      enabled: true,
      alertType: newKeyword.alertType,
      caseSensitive: newKeyword.caseSensitive,
      detectionCount: 0,
    };

    setKeywords(prev => [...prev, keyword]);
    toast.success(`Keyword "${newKeyword.phrase}" added`);
    setNewKeyword({ phrase: '', alertType: 'notification', caseSensitive: false });
    setDialogOpen(false);
  };

  const toggleKeyword = (id: string) => {
    setKeywords(prev =>
      prev.map(k => (k.id === id ? { ...k, enabled: !k.enabled } : k))
    );
  };

  const deleteKeyword = (id: string, phrase: string) => {
    setKeywords(prev => prev.filter(k => k.id !== id));
    toast.success(`Keyword "${phrase}" deleted`);
  };

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          toast.success('Browser notifications enabled');
        }
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>Keyword Detection</h2>
          <p className="text-sm text-muted-foreground">
            Get alerted when specific words or phrases are detected
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Keyword
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Keyword Alert</DialogTitle>
              <DialogDescription>
                Set up alerts for specific words or phrases in conversations
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="keyword-phrase">Keyword or Phrase</Label>
                <Input
                  id="keyword-phrase"
                  placeholder="e.g., emergency, package arrived..."
                  value={newKeyword.phrase}
                  onChange={(e) => setNewKeyword({ ...newKeyword, phrase: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert-type">Alert Type</Label>
                <Select
                  value={newKeyword.alertType}
                  onValueChange={(value: any) => setNewKeyword({ ...newKeyword, alertType: value })}
                >
                  <SelectTrigger id="alert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notification">Notification Only</SelectItem>
                    <SelectItem value="sound">Sound Only</SelectItem>
                    <SelectItem value="both">Notification + Sound</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="case-sensitive"
                  checked={newKeyword.caseSensitive}
                  onCheckedChange={(checked) => setNewKeyword({ ...newKeyword, caseSensitive: checked })}
                />
                <Label htmlFor="case-sensitive" className="cursor-pointer">
                  Case sensitive matching
                </Label>
              </div>

              <Button onClick={addKeyword} className="w-full">
                Add Keyword
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Notification Permission */}
      {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
        <Card className="p-4 border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-blue-500" />
              <div>
                <h4 className="font-medium">Enable Browser Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  Get instant alerts when keywords are detected
                </p>
              </div>
            </div>
            <Button onClick={requestNotificationPermission} variant="outline">
              Enable
            </Button>
          </div>
        </Card>
      )}

      {/* Active Keywords */}
      <Card className="p-4">
        <h3 className="mb-4">Active Keywords ({keywords.filter(k => k.enabled).length})</h3>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {keywords.map(keyword => (
              <div
                key={keyword.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Switch
                    checked={keyword.enabled}
                    onCheckedChange={() => toggleKeyword(keyword.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{keyword.phrase}</span>
                      {keyword.caseSensitive && (
                        <Badge variant="outline" className="text-xs">Aa</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Badge variant="secondary" className="gap-1">
                        {keyword.alertType === 'notification' && <Bell className="w-3 h-3" />}
                        {keyword.alertType === 'sound' && <Volume2 className="w-3 h-3" />}
                        {keyword.alertType === 'both' && (
                          <>
                            <Bell className="w-3 h-3" />
                            <Volume2 className="w-3 h-3" />
                          </>
                        )}
                        {keyword.alertType}
                      </Badge>
                      <span>Detected {keyword.detectionCount}×</span>
                      {keyword.lastDetected && (
                        <span>Last: {keyword.lastDetected.toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteKeyword(keyword.id, keyword.phrase)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Recent Detections */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3>Recent Detections</h3>
          <Badge variant="secondary">{detections.length}</Badge>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {detections.map(detection => (
              <div key={detection.id} className="p-3 rounded-lg border bg-card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge className="gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {detection.keyword}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {detection.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm mb-2">"{detection.context}"</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{detection.speaker}</span>
                  <span>•</span>
                  <span>{detection.nodeName}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Analytics */}
      <Card className="p-4">
        <h3 className="mb-4">Keyword Analytics</h3>
        <div className="space-y-2">
          {keywords
            .sort((a, b) => b.detectionCount - a.detectionCount)
            .slice(0, 5)
            .map(keyword => (
              <div key={keyword.id} className="flex items-center gap-3">
                <span className="text-sm flex-1">{keyword.phrase}</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: `${Math.min((keyword.detectionCount / Math.max(...keywords.map(k => k.detectionCount))) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {keyword.detectionCount}
                </span>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
