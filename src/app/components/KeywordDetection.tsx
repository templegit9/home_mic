import { useState, useCallback } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Bell, Plus, Trash2, Volume2, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useKeywords } from '../hooks/useApi';
import { api } from '../lib/api';

export function KeywordDetection() {
  const { keywords, loading, error, refresh, setKeywords } = useKeywords();

  const [newKeyword, setNewKeyword] = useState({
    phrase: '',
    category: 'general',
    priority: 'normal',
    caseSensitive: false,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const addKeyword = async () => {
    if (!newKeyword.phrase.trim()) {
      toast.error('Please enter a keyword or phrase');
      return;
    }

    setIsCreating(true);
    try {
      const keyword = await api.createKeyword({
        phrase: newKeyword.phrase,
        category: newKeyword.category,
        priority: newKeyword.priority,
        case_sensitive: newKeyword.caseSensitive,
        enabled: true,
      });

      setKeywords(prev => [...prev, keyword]);
      toast.success(`Keyword "${newKeyword.phrase}" added`);
      setNewKeyword({ phrase: '', category: 'general', priority: 'normal', caseSensitive: false });
      setDialogOpen(false);
    } catch (e) {
      toast.error('Failed to add keyword');
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleKeyword = useCallback(async (id: string, enabled: boolean) => {
    try {
      const updated = await api.updateKeyword(id, { enabled: !enabled });
      setKeywords(prev =>
        prev.map(k => (k.id === id ? updated : k))
      );
    } catch (e) {
      toast.error('Failed to update keyword');
      console.error(e);
    }
  }, [setKeywords]);

  const deleteKeyword = useCallback(async (id: string, phrase: string) => {
    try {
      await api.deleteKeyword(id);
      setKeywords(prev => prev.filter(k => k.id !== id));
      toast.success(`Keyword "${phrase}" deleted`);
    } catch (e) {
      toast.error('Failed to delete keyword');
      console.error(e);
    }
  }, [setKeywords]);

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          toast.success('Browser notifications enabled');
        }
      });
    }
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Failed to load keywords</p>
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
          <h2>Keyword Detection</h2>
          <p className="text-sm text-muted-foreground">
            Get alerted when specific words or phrases are detected
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
                    disabled={isCreating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={newKeyword.category}
                    onValueChange={(value) => setNewKeyword({ ...newKeyword, category: value })}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="safety">Safety</SelectItem>
                      <SelectItem value="reminders">Reminders</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={newKeyword.priority}
                    onValueChange={(value) => setNewKeyword({ ...newKeyword, priority: value })}
                    disabled={isCreating}
                  >
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="case-sensitive"
                    checked={newKeyword.caseSensitive}
                    onCheckedChange={(checked) => setNewKeyword({ ...newKeyword, caseSensitive: checked })}
                    disabled={isCreating}
                  />
                  <Label htmlFor="case-sensitive" className="cursor-pointer">
                    Case sensitive matching
                  </Label>
                </div>

                <Button onClick={addKeyword} className="w-full" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Keyword'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
        {loading && keywords.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : keywords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No keywords configured</p>
            <p className="text-sm">Click "Add Keyword" to set up alerts</p>
          </div>
        ) : (
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
                      onCheckedChange={() => toggleKeyword(keyword.id, keyword.enabled)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{keyword.phrase}</span>
                        {keyword.case_sensitive && (
                          <Badge variant="outline" className="text-xs">Aa</Badge>
                        )}
                        <Badge
                          variant={keyword.priority === 'critical' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {keyword.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {keyword.category}
                        </Badge>
                        <span>Detected {keyword.detection_count}×</span>
                        {keyword.last_detected && (
                          <span>Last: {new Date(keyword.last_detected).toLocaleTimeString()}</span>
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
        )}
      </Card>

      {/* Analytics */}
      {keywords.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-4">Keyword Analytics</h3>
          <div className="space-y-2">
            {keywords
              .sort((a, b) => b.detection_count - a.detection_count)
              .slice(0, 5)
              .map(keyword => (
                <div key={keyword.id} className="flex items-center gap-3">
                  <span className="text-sm flex-1">{keyword.phrase}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${Math.min((keyword.detection_count / Math.max(...keywords.map(k => k.detection_count), 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {keyword.detection_count}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
