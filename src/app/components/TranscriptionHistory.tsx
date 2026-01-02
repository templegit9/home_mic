import { useState } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Search, Download, Filter, Calendar, Bookmark, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface TranscriptionEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  nodeId: string;
  nodeName: string;
  confidence: number;
  conversationId?: string;
  tags?: string[];
  bookmarked?: boolean;
}

export function TranscriptionHistory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('today');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Mock historical data
  const allEntries: TranscriptionEntry[] = [
    {
      id: '1',
      speaker: 'Alice',
      text: 'Can you remind me to check the laundry in 30 minutes?',
      timestamp: new Date(Date.now() - 3600000),
      nodeId: 'node-1',
      nodeName: 'Living Room',
      confidence: 0.94,
      conversationId: 'conv-1',
      tags: ['reminder'],
    },
    {
      id: '2',
      speaker: 'Bob',
      text: 'Sure, I\'ll set that up for you.',
      timestamp: new Date(Date.now() - 3590000),
      nodeId: 'node-1',
      nodeName: 'Living Room',
      confidence: 0.89,
      conversationId: 'conv-1',
    },
    {
      id: '3',
      speaker: 'Alice',
      text: 'What time is the meeting today?',
      timestamp: new Date(Date.now() - 7200000),
      nodeId: 'node-2',
      nodeName: 'Kitchen',
      confidence: 0.92,
      conversationId: 'conv-2',
      tags: ['meeting'],
      bookmarked: true,
    },
    {
      id: '4',
      speaker: 'Charlie',
      text: 'The team meeting is at 2 PM in the conference room.',
      timestamp: new Date(Date.now() - 7180000),
      nodeId: 'node-2',
      nodeName: 'Kitchen',
      confidence: 0.88,
      conversationId: 'conv-2',
      tags: ['meeting'],
    },
    {
      id: '5',
      speaker: 'Alice',
      text: 'Did anyone see my keys? I can\'t find them anywhere.',
      timestamp: new Date(Date.now() - 86400000),
      nodeId: 'node-1',
      nodeName: 'Living Room',
      confidence: 0.91,
      conversationId: 'conv-3',
    },
    {
      id: '6',
      speaker: 'Bob',
      text: 'I think I saw them on the kitchen counter this morning.',
      timestamp: new Date(Date.now() - 86380000),
      nodeId: 'node-1',
      nodeName: 'Living Room',
      confidence: 0.87,
      conversationId: 'conv-3',
    },
  ];

  const filteredEntries = allEntries.filter(entry => {
    const matchesSearch = entry.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entry.speaker.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpeaker = selectedSpeaker === 'all' || entry.speaker === selectedSpeaker;
    const matchesNode = selectedNode === 'all' || entry.nodeName === selectedNode;
    
    let matchesDate = true;
    const now = Date.now();
    if (dateRange === 'today') {
      matchesDate = now - entry.timestamp.getTime() < 86400000;
    } else if (dateRange === 'week') {
      matchesDate = now - entry.timestamp.getTime() < 604800000;
    } else if (dateRange === 'month') {
      matchesDate = now - entry.timestamp.getTime() < 2592000000;
    }

    return matchesSearch && matchesSpeaker && matchesNode && matchesDate;
  });

  const exportTranscriptions = (format: 'json' | 'txt' | 'csv') => {
    toast.success(`Exporting ${filteredEntries.length} entries as ${format.toUpperCase()}`);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getSpeakerColor = (speaker: string) => {
    const colors: Record<string, string> = {
      Alice: 'bg-blue-500',
      Bob: 'bg-green-500',
      Charlie: 'bg-purple-500',
    };
    return colors[speaker] || 'bg-gray-500';
  };

  const toggleBookmark = (id: string) => {
    toast.success('Bookmark toggled');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>Transcription History</h2>
          <p className="text-sm text-muted-foreground">
            Search and filter through all recorded conversations
          </p>
        </div>
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
              <SelectItem value="Alice">Alice</SelectItem>
              <SelectItem value="Bob">Bob</SelectItem>
              <SelectItem value="Charlie">Charlie</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedNode} onValueChange={setSelectedNode}>
            <SelectTrigger>
              <SelectValue placeholder="All Nodes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Nodes</SelectItem>
              <SelectItem value="Living Room">Living Room</SelectItem>
              <SelectItem value="Kitchen">Kitchen</SelectItem>
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

        <ScrollArea className="h-[600px]">
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <Avatar className="mt-1">
                  <AvatarFallback className={getSpeakerColor(entry.speaker)}>
                    {getInitials(entry.speaker)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{entry.speaker}</span>
                      <Badge variant="outline" className="text-xs">
                        {entry.nodeName}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {entry.timestamp.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(entry.confidence * 100)}%
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleBookmark(entry.id)}
                    >
                      <Bookmark className={`w-4 h-4 ${entry.bookmarked ? 'fill-current text-yellow-500' : ''}`} />
                    </Button>
                  </div>
                  <p className="text-sm">{entry.text}</p>
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex gap-1">
                      {entry.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs gap-1">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}
