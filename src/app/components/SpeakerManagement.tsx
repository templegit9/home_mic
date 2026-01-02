import { useState, useCallback } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { UserPlus, Mic, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VoiceTraining } from './VoiceTraining';
import { useSpeakers } from '../hooks/useApi';
import { api } from '../lib/api';

export function SpeakerManagement() {
  const { speakers, loading, error, refresh, setSpeakers } = useSpeakers();

  const [newSpeakerName, setNewSpeakerName] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<any | null>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  const getSpeakerColor = (color: string | null) => {
    if (color) return color;
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const startEnrollment = async () => {
    if (!newSpeakerName.trim()) {
      toast.error('Please enter a speaker name');
      return;
    }

    setIsEnrolling(true);
    setEnrollmentProgress(0);

    try {
      // Create speaker in backend
      const colors = ['bg-red-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500', 'bg-blue-500', 'bg-green-500'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newSpeaker = await api.createSpeaker(newSpeakerName, randomColor);

      // Simulate voice enrollment progress
      for (let i = 0; i <= 100; i += 20) {
        setEnrollmentProgress(i);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      setSpeakers(prev => [...prev, newSpeaker]);
      toast.success(`${newSpeakerName} enrolled successfully!`);
      setNewSpeakerName('');
      setDialogOpen(false);
    } catch (e) {
      toast.error('Failed to enroll speaker');
      console.error(e);
    } finally {
      setIsEnrolling(false);
      setEnrollmentProgress(0);
    }
  };

  const deleteSpeaker = useCallback(async (id: string, name: string) => {
    try {
      await api.deleteSpeaker(id);
      setSpeakers(prev => prev.filter(s => s.id !== id));
      toast.success(`${name} removed from speaker list`);
    } catch (e) {
      toast.error('Failed to delete speaker');
      console.error(e);
    }
  }, [setSpeakers]);

  const startRetraining = (speaker: any) => {
    setSelectedSpeaker(speaker);
    setTrainingDialogOpen(true);
  };

  const handleTrainingComplete = () => {
    if (selectedSpeaker) {
      setSpeakers(prev =>
        prev.map(s =>
          s.id === selectedSpeaker.id
            ? { ...s, sample_count: (s.sample_count || 0) + 8 }
            : s
        )
      );
      toast.success('Voice training completed!');
    }
    setTrainingDialogOpen(false);
    setSelectedSpeaker(null);
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Failed to load speakers</p>
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
          <h2>Speaker Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage enrolled speakers and their voice profiles
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
      </div>

      {trainingDialogOpen && selectedSpeaker && (
        <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
          <VoiceTraining
            speakerName={selectedSpeaker.name}
            currentSamples={selectedSpeaker.sample_count || 0}
            onComplete={handleTrainingComplete}
            onCancel={() => setTrainingDialogOpen(false)}
          />
        </Dialog>
      )}

      {loading && speakers.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : speakers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No speakers enrolled yet</p>
          <p className="text-sm">Click "Enroll Speaker" to add your first speaker</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {speakers.map((speaker) => (
            <Card key={speaker.id} className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback className={getSpeakerColor(speaker.color)}>
                      {getInitials(speaker.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3>{speaker.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {speaker.sample_count || 0} samples
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
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Enrolled</span>
                  <span>{new Date(speaker.created_at).toLocaleDateString()}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Voice Profile</span>
                  <Badge variant={speaker.voice_embedding ? "default" : "outline"}>
                    {speaker.voice_embedding ? "Trained" : "Not trained"}
                  </Badge>
                </div>

                {(speaker.sample_count || 0) < 10 && (
                  <Badge variant="outline" className="w-full justify-center">
                    Add more samples for better accuracy
                  </Badge>
                )}

                <Button
                  onClick={() => startRetraining(speaker)}
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  {speaker.voice_embedding ? 'Re-train Voice' : 'Train Voice'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}