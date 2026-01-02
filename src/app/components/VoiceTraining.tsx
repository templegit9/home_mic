import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Mic, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

const TRAINING_PHRASES = [
  "The quick brown fox jumps over the lazy dog",
  "Please set a reminder for tomorrow at nine AM",
  "What's the weather like today",
  "Turn on the living room lights",
  "I need help with something",
  "Can you play some music",
  "Tell me a joke",
  "What time is my next meeting",
];

interface VoiceTrainingProps {
  speakerName: string;
  currentSamples: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function VoiceTraining({ speakerName, currentSamples, onComplete, onCancel }: VoiceTrainingProps) {
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [completedPhrases, setCompletedPhrases] = useState<number[]>([]);
  const [voiceSignature, setVoiceSignature] = useState<number[]>(new Array(32).fill(0));

  const startRecording = () => {
    setIsRecording(true);
    
    // Simulate voice signature visualization
    const interval = setInterval(() => {
      setVoiceSignature(new Array(32).fill(0).map(() => Math.random() * 100));
    }, 50);

    // Simulate recording duration
    setTimeout(() => {
      clearInterval(interval);
      setIsRecording(false);
      setCompletedPhrases(prev => [...prev, currentPhrase]);
      
      if (currentPhrase < TRAINING_PHRASES.length - 1) {
        setCurrentPhrase(currentPhrase + 1);
        toast.success('Phrase recorded successfully');
      } else {
        toast.success('Voice training complete!');
        setTimeout(onComplete, 1000);
      }
    }, 3000);
  };

  const skipPhrase = () => {
    if (currentPhrase < TRAINING_PHRASES.length - 1) {
      setCurrentPhrase(currentPhrase + 1);
    }
  };

  const progress = (completedPhrases.length / TRAINING_PHRASES.length) * 100;

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Voice Training - {speakerName}</DialogTitle>
        <DialogDescription>
          Read each phrase clearly to help the system learn your voice pattern
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 pt-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Training Progress</span>
            <span className="text-muted-foreground">
              {completedPhrases.length} / {TRAINING_PHRASES.length} phrases
            </span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Current Phrase */}
        <Card className="p-6 bg-accent/50">
          <div className="text-center space-y-4">
            <Badge variant="outline">Phrase {currentPhrase + 1}</Badge>
            <p className="text-xl leading-relaxed">
              "{TRAINING_PHRASES[currentPhrase]}"
            </p>
          </div>
        </Card>

        {/* Voice Signature Visualization */}
        <div className="h-24 flex items-end gap-1 justify-center">
          {voiceSignature.map((height, i) => (
            <div
              key={i}
              className={`w-2 rounded-t transition-all ${
                isRecording
                  ? 'bg-gradient-to-t from-blue-500 to-purple-500'
                  : 'bg-muted'
              }`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <Button
            onClick={startRecording}
            disabled={isRecording || completedPhrases.includes(currentPhrase)}
            className="flex-1"
            size="lg"
          >
            {isRecording ? (
              <>
                <Mic className="w-5 h-5 mr-2 animate-pulse" />
                Recording...
              </>
            ) : completedPhrases.includes(currentPhrase) ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Recorded
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Start Recording
              </>
            )}
          </Button>
          {!completedPhrases.includes(currentPhrase) && (
            <Button onClick={skipPhrase} variant="outline">
              Skip
            </Button>
          )}
        </div>

        {/* Phrase List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">All Phrases</h4>
          <div className="grid gap-2 max-h-[200px] overflow-y-auto">
            {TRAINING_PHRASES.map((phrase, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 p-2 rounded text-sm ${
                  i === currentPhrase ? 'bg-accent' : ''
                }`}
              >
                {completedPhrases.includes(i) ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                )}
                <span className={completedPhrases.includes(i) ? 'text-muted-foreground' : ''}>
                  {phrase}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button onClick={onCancel} variant="outline">
            Cancel Training
          </Button>
          <p className="text-sm text-muted-foreground">
            Current samples: {currentSamples} • Target: 10+
          </p>
        </div>
      </div>
    </DialogContent>
  );
}
