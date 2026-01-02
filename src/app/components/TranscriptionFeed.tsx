import { useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Mic, Wifi, WifiOff } from 'lucide-react';
import { useLiveTranscriptions } from '../hooks/useApi';

export function TranscriptionFeed() {
  const { transcriptions, isConnected } = useLiveTranscriptions(50);

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const getSpeakerColor = (speaker: string | null) => {
    if (!speaker) return 'bg-gray-500';

    // Generate consistent color from speaker name
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500',
      'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'
    ];
    const index = speaker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card className="flex-1 flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Live Transcription
        </h2>
        <Badge
          variant={isConnected ? "default" : "destructive"}
          className="flex items-center gap-1"
        >
          {isConnected ? (
            <>
              <Wifi className="w-3 h-3" />
              Live
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              Disconnected
            </>
          )}
        </Badge>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {transcriptions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Mic className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No transcriptions yet</p>
              <p className="text-sm">Speak into a microphone node to see live text</p>
            </div>
          ) : (
            transcriptions.map((entry) => (
              <div key={entry.transcription_id} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                <Avatar className="mt-1">
                  <AvatarFallback className={getSpeakerColor(entry.speaker_name)}>
                    {getInitials(entry.speaker_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {entry.speaker_name || 'Unknown Speaker'}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {entry.node_name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(entry.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-sm">{entry.text}</p>
                  {entry.keywords_detected.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {entry.keywords_detected.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
