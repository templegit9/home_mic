import { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { MessageCircle, Clock, MapPin, Tag, Bookmark } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  speaker: string;
  text: string;
  timestamp: Date;
  nodeId: string;
  nodeName: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  startTime: Date;
  endTime: Date;
  duration: number;
  location: string;
  tags: string[];
  bookmarked: boolean;
  participants: string[];
}

export function ConversationContext() {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 'conv-1',
      title: 'Dinner Planning',
      messages: [
        {
          id: '1',
          speaker: 'Alice',
          text: 'What should we make for dinner tonight?',
          timestamp: new Date(Date.now() - 7200000),
          nodeId: 'node-2',
          nodeName: 'Kitchen',
        },
        {
          id: '2',
          speaker: 'Bob',
          text: 'How about pasta? I can make my special marinara sauce.',
          timestamp: new Date(Date.now() - 7180000),
          nodeId: 'node-2',
          nodeName: 'Kitchen',
        },
        {
          id: '3',
          speaker: 'Alice',
          text: 'That sounds perfect! Do we have all the ingredients?',
          timestamp: new Date(Date.now() - 7160000),
          nodeId: 'node-2',
          nodeName: 'Kitchen',
        },
        {
          id: '4',
          speaker: 'Bob',
          text: 'Let me check the pantry. We might need tomatoes.',
          timestamp: new Date(Date.now() - 7140000),
          nodeId: 'node-2',
          nodeName: 'Kitchen',
        },
      ],
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 7140000),
      duration: 60,
      location: 'Kitchen',
      tags: ['family', 'dinner'],
      bookmarked: true,
      participants: ['Alice', 'Bob'],
    },
    {
      id: 'conv-2',
      title: 'Morning Check-in',
      messages: [
        {
          id: '5',
          speaker: 'Charlie',
          text: 'Good morning everyone!',
          timestamp: new Date(Date.now() - 14400000),
          nodeId: 'node-1',
          nodeName: 'Living Room',
        },
        {
          id: '6',
          speaker: 'Alice',
          text: 'Morning! Did you sleep well?',
          timestamp: new Date(Date.now() - 14380000),
          nodeId: 'node-1',
          nodeName: 'Living Room',
        },
        {
          id: '7',
          speaker: 'Charlie',
          text: 'Yes, really well. What\'s the plan for today?',
          timestamp: new Date(Date.now() - 14360000),
          nodeId: 'node-1',
          nodeName: 'Living Room',
        },
      ],
      startTime: new Date(Date.now() - 14400000),
      endTime: new Date(Date.now() - 14360000),
      duration: 40,
      location: 'Living Room',
      tags: ['morning', 'casual'],
      bookmarked: false,
      participants: ['Alice', 'Charlie'],
    },
    {
      id: 'conv-3',
      title: 'Team Meeting Discussion',
      messages: [
        {
          id: '8',
          speaker: 'Alice',
          text: 'We need to prepare for tomorrow\'s client presentation.',
          timestamp: new Date(Date.now() - 21600000),
          nodeId: 'node-1',
          nodeName: 'Living Room',
        },
        {
          id: '9',
          speaker: 'Bob',
          text: 'I\'ve finished the slides. Should I send them to you for review?',
          timestamp: new Date(Date.now() - 21540000),
          nodeId: 'node-1',
          nodeName: 'Living Room',
        },
        {
          id: '10',
          speaker: 'Alice',
          text: 'Yes please. Also, let\'s do a dry run in the evening.',
          timestamp: new Date(Date.now() - 21520000),
          nodeId: 'node-1',
          nodeName: 'Living Room',
        },
      ],
      startTime: new Date(Date.now() - 21600000),
      endTime: new Date(Date.now() - 21520000),
      duration: 80,
      location: 'Living Room',
      tags: ['work', 'meeting'],
      bookmarked: true,
      participants: ['Alice', 'Bob'],
    },
  ]);

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState('all');

  const allTags = Array.from(new Set(conversations.flatMap(c => c.tags)));

  const filteredConversations = conversations.filter(conv => {
    if (filterTag === 'all') return true;
    return conv.tags.includes(filterTag);
  });

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

  const toggleBookmark = (convId: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === convId ? { ...conv, bookmarked: !conv.bookmarked } : conv
      )
    );
    toast.success('Bookmark toggled');
  };

  const addTag = (convId: string, tag: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === convId ? { ...conv, tags: [...conv.tags, tag] } : conv
      )
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>Conversation Context</h2>
          <p className="text-sm text-muted-foreground">
            View conversations grouped by context and timeline
          </p>
        </div>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {allTags.map(tag => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Conversation List */}
        <div className="lg:col-span-1">
          <Card className="p-4">
            <h3 className="mb-4">Recent Conversations ({filteredConversations.length})</h3>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredConversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedConversation === conv.id
                        ? 'bg-accent border-primary'
                        : 'bg-card hover:bg-accent/50'
                    }`}
                    onClick={() => setSelectedConversation(conv.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{conv.title}</span>
                      </div>
                      {conv.bookmarked && (
                        <Bookmark className="w-4 h-4 fill-current text-yellow-500" />
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(conv.duration)} • {conv.startTime.toLocaleTimeString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {conv.location}
                      </div>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {conv.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Conversation Detail */}
        <div className="lg:col-span-2">
          {selectedConversation ? (
            <Card className="p-4">
              {(() => {
                const conv = conversations.find(c => c.id === selectedConversation);
                if (!conv) return null;

                return (
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3>{conv.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {conv.startTime.toLocaleString()}
                          </span>
                          <span>•</span>
                          <span>{formatDuration(conv.duration)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {conv.location}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleBookmark(conv.id)}
                      >
                        <Bookmark
                          className={`w-5 h-5 ${
                            conv.bookmarked ? 'fill-current text-yellow-500' : ''
                          }`}
                        />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm text-muted-foreground">Participants:</span>
                      <div className="flex -space-x-2">
                        {conv.participants.map(participant => (
                          <Avatar key={participant} className="w-6 h-6 border-2 border-background">
                            <AvatarFallback className={`${getSpeakerColor(participant)} text-xs`}>
                              {getInitials(participant)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>

                    <ScrollArea className="h-[480px]">
                      <div className="space-y-4">
                        {conv.messages.map(message => (
                          <div key={message.id} className="flex gap-3">
                            <Avatar className="mt-1">
                              <AvatarFallback className={getSpeakerColor(message.speaker)}>
                                {getInitials(message.speaker)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{message.speaker}</span>
                                <span className="text-xs text-muted-foreground">
                                  {message.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-sm">{message.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <div className="flex gap-1 flex-wrap flex-1">
                        {conv.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="gap-1">
                            <Tag className="w-3 h-3" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </Card>
          ) : (
            <Card className="p-12 flex flex-col items-center justify-center text-center h-[600px]">
              <MessageCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="mb-2">No Conversation Selected</h3>
              <p className="text-sm text-muted-foreground">
                Select a conversation from the list to view its details
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
