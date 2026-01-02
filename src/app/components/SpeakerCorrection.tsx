import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AlertCircle, CheckCircle2, User } from 'lucide-react';
import { toast } from 'sonner';

interface UncertainEntry {
  id: string;
  text: string;
  timestamp: Date;
  detectedSpeaker: string;
  confidence: number;
  nodeId: string;
  nodeName: string;
  corrected: boolean;
  correctedTo?: string;
}

export function SpeakerCorrection() {
  const [uncertainEntries, setUncertainEntries] = useState<UncertainEntry[]>([
    {
      id: '1',
      text: 'Can someone help me with this?',
      timestamp: new Date(Date.now() - 3600000),
      detectedSpeaker: 'Unknown',
      confidence: 0.45,
      nodeId: 'node-1',
      nodeName: 'Living Room',
      corrected: false,
    },
    {
      id: '2',
      text: 'I think we should do it differently.',
      timestamp: new Date(Date.now() - 7200000),
      detectedSpeaker: 'Bob',
      confidence: 0.62,
      nodeId: 'node-2',
      nodeName: 'Kitchen',
      corrected: false,
    },
    {
      id: '3',
      text: 'That sounds like a great idea!',
      timestamp: new Date(Date.now() - 10800000),
      detectedSpeaker: 'Alice',
      confidence: 0.68,
      nodeId: 'node-1',
      nodeName: 'Living Room',
      corrected: true,
      correctedTo: 'Charlie',
    },
    {
      id: '4',
      text: 'What time is the meeting?',
      timestamp: new Date(Date.now() - 14400000),
      detectedSpeaker: 'Unknown',
      confidence: 0.38,
      nodeId: 'node-2',
      nodeName: 'Kitchen',
      corrected: false,
    },
  ]);

  const speakers = ['Alice', 'Bob', 'Charlie'];
  const [stats, setStats] = useState({
    totalCorrections: 12,
    accuracyImprovement: 8.5,
    learnedPatterns: 24,
  });

  const correctSpeaker = (entryId: string, correctSpeaker: string) => {
    setUncertainEntries(prev =>
      prev.map(entry =>
        entry.id === entryId
          ? { ...entry, corrected: true, correctedTo: correctSpeaker }
          : entry
      )
    );
    setStats(prev => ({
      ...prev,
      totalCorrections: prev.totalCorrections + 1,
      learnedPatterns: prev.learnedPatterns + 1,
    }));
    toast.success(`Speaker corrected to ${correctSpeaker}. System is learning from this correction.`);
  };

  const markAsCorrect = (entryId: string) => {
    setUncertainEntries(prev =>
      prev.map(entry =>
        entry.id === entryId
          ? { ...entry, corrected: true, correctedTo: entry.detectedSpeaker }
          : entry
      )
    );
    toast.success('Marked as correct. System confidence updated.');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getSpeakerColor = (speaker: string) => {
    const colors: Record<string, string> = {
      Alice: 'bg-blue-500',
      Bob: 'bg-green-500',
      Charlie: 'bg-purple-500',
      Unknown: 'bg-gray-500',
    };
    return colors[speaker] || 'bg-gray-500';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const pendingCorrections = uncertainEntries.filter(e => !e.corrected);

  return (
    <div className="space-y-4">
      <div>
        <h2>Speaker Correction & Learning</h2>
        <p className="text-sm text-muted-foreground">
          Help improve speaker identification accuracy through corrections
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Total Corrections</span>
          </div>
          <p className="text-2xl">{stats.totalCorrections}</p>
          <p className="text-xs text-muted-foreground">Provided by you</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Accuracy Improvement</span>
          </div>
          <p className="text-2xl">+{stats.accuracyImprovement}%</p>
          <p className="text-xs text-muted-foreground">Since corrections enabled</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-muted-foreground">Learned Patterns</span>
          </div>
          <p className="text-2xl">{stats.learnedPatterns}</p>
          <p className="text-xs text-muted-foreground">Voice signature updates</p>
        </Card>
      </div>

      {/* Pending Corrections */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3>Pending Review ({pendingCorrections.length})</h3>
          {pendingCorrections.length === 0 && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="w-3 h-3" />
              All caught up!
            </Badge>
          )}
        </div>

        {pendingCorrections.length > 0 ? (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {pendingCorrections.map(entry => (
                <div key={entry.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex gap-3 mb-3">
                    <Avatar className="mt-1">
                      <AvatarFallback className={getSpeakerColor(entry.detectedSpeaker)}>
                        {entry.detectedSpeaker === 'Unknown' ? '?' : getInitials(entry.detectedSpeaker)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{entry.detectedSpeaker}</span>
                        <Badge variant="outline" className={getConfidenceColor(entry.confidence)}>
                          {Math.round(entry.confidence * 100)}% confident
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {entry.timestamp.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm mb-2">"{entry.text}"</p>
                      <Badge variant="outline" className="text-xs">
                        {entry.nodeName}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t">
                    <span className="text-sm text-muted-foreground">Who said this?</span>
                    <div className="flex gap-2 flex-1">
                      {speakers.map(speaker => (
                        <Button
                          key={speaker}
                          onClick={() => correctSpeaker(entry.id, speaker)}
                          variant="outline"
                          size="sm"
                          className={
                            entry.detectedSpeaker === speaker
                              ? 'border-primary'
                              : ''
                          }
                        >
                          {speaker}
                        </Button>
                      ))}
                    </div>
                    {entry.detectedSpeaker !== 'Unknown' && (
                      <Button
                        onClick={() => markAsCorrect(entry.id)}
                        variant="outline"
                        size="sm"
                        className="gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Correct
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No uncertain entries to review right now
            </p>
          </div>
        )}
      </Card>

      {/* Correction History */}
      <Card className="p-4">
        <h3 className="mb-4">Recent Corrections</h3>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {uncertainEntries
              .filter(e => e.corrected)
              .map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-2 rounded border text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-muted-foreground line-through">
                      {entry.detectedSpeaker}
                    </span>
                    <span>→</span>
                    <span className="font-medium">{entry.correctedTo}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {entry.timestamp.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Info */}
      <Card className="p-4 border-blue-500/20 bg-blue-500/5">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-600 dark:text-blue-500 mb-2">
              How Speaker Learning Works
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Your corrections help train the speaker identification model</li>
              <li>The system learns voice patterns and improves over time</li>
              <li>Low confidence entries (below 75%) are flagged for review</li>
              <li>Corrections are immediately applied to improve future accuracy</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
