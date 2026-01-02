import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Mic } from 'lucide-react';

interface TranscriptionEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  nodeId: string;
  nodeName: string;
  confidence: number;
}

export function TranscriptionFeed() {
  const [entries, setEntries] = useState<TranscriptionEntry[]>([]);

  useEffect(() => {
    // Mock real-time transcription data
    const mockEntries: TranscriptionEntry[] = [
      {
        id: '1',
        speaker: 'Alice',
        text: 'Can you remind me to check the laundry in 30 minutes?',
        timestamp: new Date(Date.now() - 120000),
        nodeId: 'node-1',
        nodeName: 'Living Room',
        confidence: 0.94,
      },
      {
        id: '2',
        speaker: 'Bob',
        text: 'Sure, I\'ll set that up for you.',
        timestamp: new Date(Date.now() - 90000),
        nodeId: 'node-1',
        nodeName: 'Living Room',
        confidence: 0.89,
      },
      {
        id: '3',
        speaker: 'Alice',
        text: 'What time is the meeting today?',
        timestamp: new Date(Date.now() - 30000),
        nodeId: 'node-2',
        nodeName: 'Kitchen',
        confidence: 0.92,
      },
    ];

    setEntries(mockEntries);

    // Simulate real-time updates
    const interval = setInterval(() => {
      const mockPhrases = [
        'The weather looks great today.',
        'Did you finish that project?',
        'I need to go grocery shopping later.',
        'What\'s for dinner tonight?',
        'Can you help me with this?',
      ];
      
      const speakers = ['Alice', 'Bob', 'Charlie'];
      const nodes = [
        { id: 'node-1', name: 'Living Room' },
        { id: 'node-2', name: 'Kitchen' },
      ];
      
      const randomSpeaker = speakers[Math.floor(Math.random() * speakers.length)];
      const randomNode = nodes[Math.floor(Math.random() * nodes.length)];
      const randomPhrase = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
      
      const newEntry: TranscriptionEntry = {
        id: Date.now().toString(),
        speaker: randomSpeaker,
        text: randomPhrase,
        timestamp: new Date(),
        nodeId: randomNode.id,
        nodeName: randomNode.name,
        confidence: 0.85 + Math.random() * 0.14,
      };
      
      setEntries(prev => [newEntry, ...prev].slice(0, 50));
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const getSpeakerColor = (speaker: string) => {
    const colors = {
      Alice: 'bg-blue-500',
      Bob: 'bg-green-500',
      Charlie: 'bg-purple-500',
    };
    return colors[speaker as keyof typeof colors] || 'bg-gray-500';
  };

  return (
    <Card className="flex-1 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Live Transcription
        </h2>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
              <Avatar className="mt-1">
                <AvatarFallback className={getSpeakerColor(entry.speaker)}>
                  {getInitials(entry.speaker)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{entry.speaker}</span>
                  <Badge variant="outline" className="text-xs">
                    {entry.nodeName}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {entry.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(entry.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm">{entry.text}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
