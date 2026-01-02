import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { UserPlus, Mic, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { VoiceTraining } from './VoiceTraining';

interface Speaker {
  id: string;
  name: string;
  color: string;
  voiceSamples: number;
  accuracy: number;
  enrolled: Date;
}

export function SpeakerManagement() {
  const [speakers, setSpeakers] = useState<Speaker[]>([
    {
      id: '1',
      name: 'Alice',
      color: 'bg-blue-500',
      voiceSamples: 12,
      accuracy: 94,
      enrolled: new Date('2025-12-15'),
    },
    {
      id: '2',
      name: 'Bob',
      color: 'bg-green-500',
      voiceSamples: 8,
      accuracy: 89,
      enrolled: new Date('2025-12-20'),
    },
    {
      id: '3',
      name: 'Charlie',
      color: 'bg-purple-500',
      voiceSamples: 5,
      accuracy: 78,
      enrolled: new Date('2026-01-01'),
    },
  ]);

  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const startEnrollment = () => {
    if (!newSpeakerName.trim()) {
      toast.error('Please enter a speaker name');
      return;
    }

    setIsEnrolling(true);
    setEnrollmentProgress(0);

    // Simulate voice enrollment process
    const interval = setInterval(() => {
      setEnrollmentProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsEnrolling(false);
          
          const colors = ['bg-red-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          
          setSpeakers(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              name: newSpeakerName,
              color: randomColor,
              voiceSamples: 5,
              accuracy: 75 + Math.random() * 15,
              enrolled: new Date(),
            },
          ]);
          
          toast.success(`${newSpeakerName} enrolled successfully!`);
          setNewSpeakerName('');
          setDialogOpen(false);
          return 0;
        }
        return prev + 20;
      });
    }, 800);
  };

  const deleteSpeaker = (id: string, name: string) => {
    setSpeakers(prev => prev.filter(s => s.id !== id));
    toast.success(`${name} removed from speaker list`);
  };

  const startRetraining = (speaker: Speaker) => {
    setSelectedSpeaker(speaker);
    setTrainingDialogOpen(true);
  };

  const handleTrainingComplete = () => {
    if (selectedSpeaker) {
      setSpeakers(prev =>
        prev.map(s =>
          s.id === selectedSpeaker.id
            ? { ...s, voiceSamples: s.voiceSamples + 8, accuracy: Math.min(98, s.accuracy + 5) }
            : s
        )
      );
    }
    setTrainingDialogOpen(false);
    setSelectedSpeaker(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2>Speaker Management</h2>
        <Dialog open={dialogOpen} onValueChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Enroll Speaker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enroll New Speaker</DialogTitle>
              <DialogDescription>
                Enter the speaker's name and follow the voice enrollment process.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="speaker-name">Speaker Name</Label>
                <Input
                  id="speaker-name"
                  placeholder="Enter name..."
                  value={newSpeakerName}
                  onChange={(e) => setNewSpeakerName(e.target.value)}
                  disabled={isEnrolling}
                />
              </div>

              {isEnrolling && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span>Recording voice samples... {enrollmentProgress}%</span>
                  </div>
                  <Progress value={enrollmentProgress} />
                </div>
              )}

              <Button
                onClick={startEnrollment}
                disabled={isEnrolling || !newSpeakerName.trim()}
                className="w-full"
              >
                {isEnrolling ? 'Enrolling...' : 'Start Enrollment'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {trainingDialogOpen && selectedSpeaker && (
        <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
          <VoiceTraining
            speakerName={selectedSpeaker.name}
            currentSamples={selectedSpeaker.voiceSamples}
            onComplete={handleTrainingComplete}
            onCancel={() => setTrainingDialogOpen(false)}
          />
        </Dialog>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {speakers.map((speaker) => (
          <Card key={speaker.id} className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className={speaker.color}>
                    {getInitials(speaker.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3>{speaker.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {speaker.voiceSamples} samples
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteSpeaker(speaker.id, speaker.name)}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Accuracy</span>
                  <span>{Math.round(speaker.accuracy)}%</span>
                </div>
                <Progress value={speaker.accuracy} />
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Enrolled</span>
                <span>{speaker.enrolled.toLocaleDateString()}</span>
              </div>

              {speaker.voiceSamples < 10 ? (
                <Badge variant="outline" className="w-full justify-center">
                  Add more samples for better accuracy
                </Badge>
              ) : null}

              <Button
                onClick={() => startRetraining(speaker)}
                variant="outline"
                size="sm"
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Re-train Voice
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}