import { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Search, Download, Calendar, Bookmark, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranscriptions, useNodes, useSpeakers } from '../hooks/useApi';
import { api } from '../lib/api';

export function TranscriptionHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  const { transcriptions, loading, error, refresh, setTranscriptions } = useTranscriptions({
    limit: 100,
    search: searchQuery || undefined,
    speakerId: selectedSpeaker !== 'all' ? selectedSpeaker : undefined,
    nodeId: selectedNode !== 'all' ? selectedNode : undefined,
  });

  const { nodes } = useNodes();
  const { speakers } = useSpeakers();

  // Filter by date on client side
  const filteredEntries = transcriptions.filter(entry => {
    let matchesDate = true;
    const now = Date.now();
    const entryTime = new Date(entry.timestamp).getTime();

    if (dateRange === 'today') {
      matchesDate = now - entryTime < 86400000;
    } else if (dateRange === 'week') {
      matchesDate = now - entryTime < 604800000;
    } else if (dateRange === 'month') {
      matchesDate = now - entryTime < 2592000000;
    }

    return matchesDate;
  });

  const exportTranscriptions = (format: 'json' | 'txt' | 'csv') => {
    const data = filteredEntries.map(t => ({
      speaker: t.speaker_name || 'Unknown',
      text: t.text,
      timestamp: t.timestamp,
      node: t.node_name || 'Unknown',
      confidence: t.confidence,
    }));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      filename = 'transcriptions.json';
      mimeType = 'application/json';
    } else if (format === 'csv') {
      const headers = 'speaker,text,timestamp,node,confidence\n';
      const rows = data.map(d =>
        `"${d.speaker}","${d.text.replace(/"/g, '""')}","${d.timestamp}","${d.node}",${d.confidence}`
      ).join('\n');
      content = headers + rows;
      filename = 'transcriptions.csv';
      mimeType = 'text/csv';
    } else {
      content = data.map(d =>
        `[${new Date(d.timestamp).toLocaleString()}] ${d.speaker} (${d.node}): ${d.text}`
      ).join('\n');
      filename = 'transcriptions.txt';
      mimeType = 'text/plain';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredEntries.length} transcriptions as ${format.toUpperCase()}`);
  };

  const deleteTranscription = useCallback(async (id: string) => {
    try {
      await api.deleteTranscription(id);
      setTranscriptions(prev => prev.filter(t => t.id !== id));
      toast.success('Transcription deleted');
    } catch (e) {
      toast.error('Failed to delete transcription');
      console.error(e);
    }
  }, [setTranscriptions]);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getSpeakerColor = (speaker: string | null) => {
    if (!speaker) return 'bg-gray-500';
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500'];
    const index = speaker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Failed to load transcriptions</p>
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
          <h2>Transcription History</h2>
          <p className="text-sm text-muted-foreground">
            Search and filter through all recorded conversations
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
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Transcriptions</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Export {filteredEntries.length} filtered transcriptions in your preferred format.
                </p>
                <div className="grid gap-2">
                  <Button onClick={() => exportTranscriptions('json')} variant="outline" className="justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    Export as JSON
                  </Button>
                  <Button onClick={() => exportTranscriptions('txt')} variant="outline" className="justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    Export as TXT
                  </Button>
                  <Button onClick={() => exportTranscriptions('csv')} variant="outline" className="justify-start">
                    <Download className="w-4 h-4 mr-2" />
                    Export as CSV
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-4 mb-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transcriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={selectedSpeaker} onValueChange={setSelectedSpeaker}>
            <SelectTrigger>
              <SelectValue placeholder="All Speakers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Speakers</SelectItem>
              {speakers.map(speaker => (
                <SelectItem key={speaker.id} value={speaker.id}>{speaker.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedNode} onValueChange={setSelectedNode}>
            <SelectTrigger>
              <SelectValue placeholder="All Nodes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Nodes</SelectItem>
              {nodes.map(node => (
                <SelectItem key={node.id} value={node.id}>{node.location}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Past Week</SelectItem>
              <SelectItem value="month">Past Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary">
            {filteredEntries.length} results
          </Badge>
        </div>

        {loading && transcriptions.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No transcriptions found</p>
            <p className="text-sm">Try adjusting your search filters</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <Avatar className="mt-1">
                    <AvatarFallback className={getSpeakerColor(entry.speaker_name || null)}>
                      {getInitials(entry.speaker_name || null)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{entry.speaker_name || 'Unknown'}</span>
                        <Badge variant="outline" className="text-xs">
                          {entry.node_name || 'Unknown'}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(entry.confidence * 100)}%
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTranscription(entry.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <p className="text-sm">{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}
