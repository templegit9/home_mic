import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Mic, Volume2 } from 'lucide-react';

interface AudioVisualizationProps {
  nodeId: string;
  nodeName: string;
  isActive: boolean;
  audioLevel?: number;  // Real audio level from WebSocket (0-100)
}

export function AudioVisualization({ nodeId, nodeName, isActive, audioLevel = 0 }: AudioVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioDataRef = useRef<number[]>(new Array(64).fill(0));
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 80;

    const animate = () => {
      const audioData = audioDataRef.current;

      // Shift array left and add new audio level at the end
      audioData.shift();
      // Add some variance to make it look more natural
      const variance = (Math.random() - 0.5) * 10;
      const newLevel = Math.max(0, Math.min(100, audioLevel + variance));
      audioData.push(isActive ? newLevel : 0);

      // Decay old values when not active
      if (!isActive) {
        for (let i = 0; i < audioData.length; i++) {
          audioData[i] *= 0.9;
        }
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw waveform
      const barWidth = canvas.width / audioData.length;

      audioData.forEach((value, i) => {
        const x = i * barWidth;
        const height = (value / 100) * canvas.height;
        const y = (canvas.height - height) / 2;

        // Gradient based on intensity
        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        if (isActive && value > 2) {
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
          gradient.addColorStop(1, 'rgba(147, 51, 234, 0.8)');
        } else {
          gradient.addColorStop(0, 'rgba(156, 163, 175, 0.2)');
          gradient.addColorStop(1, 'rgba(156, 163, 175, 0.1)');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - 2, height);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, audioLevel]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mic className={`w-4 h-4 ${isActive ? 'text-blue-500 animate-pulse' : 'text-muted-foreground'}`} />
          <span className="font-medium">{nodeName}</span>
        </div>
        <Badge variant={isActive ? 'default' : 'secondary'}>
          {isActive ? 'Active' : 'Idle'}
        </Badge>
      </div>

      <canvas ref={canvasRef} className="w-full h-20 rounded" />

      <div className="mt-3 flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${isActive
              ? 'bg-gradient-to-r from-blue-500 to-purple-500'
              : 'bg-muted-foreground/30'
              }`}
            style={{ width: `${Math.min(audioLevel, 100)}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground w-12 text-right">
          {isActive ? `${Math.round(audioLevel)}%` : '--'}
        </span>
      </div>

      {!isActive && (
        <p className="text-xs text-muted-foreground text-center mt-2">
          No recent audio activity
        </p>
      )}
    </Card>
  );
}

