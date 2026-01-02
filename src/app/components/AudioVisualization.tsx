import { useEffect, useRef, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Mic, Volume2 } from 'lucide-react';

interface AudioVisualizationProps {
  nodeId: string;
  nodeName: string;
  isActive: boolean;
}

export function AudioVisualization({ nodeId, nodeName, isActive }: AudioVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [volume, setVolume] = useState(0);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 80;

    let audioData = new Array(64).fill(0);
    let time = 0;

    const animate = () => {
      time += 0.05;

      // Simulate audio data with varying intensity
      if (isActive) {
        audioData = audioData.map((_, i) => {
          const baseFreq = Math.sin(time + i * 0.2) * 0.5 + 0.5;
          const noise = Math.random() * 0.3;
          return (baseFreq + noise) * 100;
        });
        setVolume(Math.max(...audioData));
      } else {
        // Decay when not active
        audioData = audioData.map(v => v * 0.9);
        setVolume(Math.max(...audioData));
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
        if (isActive) {
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
          gradient.addColorStop(1, 'rgba(147, 51, 234, 0.8)');
        } else {
          gradient.addColorStop(0, 'rgba(156, 163, 175, 0.3)');
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
  }, [isActive]);

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
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-100"
            style={{ width: `${Math.min(volume, 100)}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground w-12 text-right">
          {Math.round(volume)}%
        </span>
      </div>
    </Card>
  );
}
