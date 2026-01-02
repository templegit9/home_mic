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

      // Only animate if node is active (recently seen)
      if (isActive) {
        // Simulated waveform (real audio levels would come from WebSocket)
        audioData = audioData.map((_, i) => {
          const baseFreq = Math.sin(time + i * 0.2) * 0.3 + 0.3;
          const noise = Math.random() * 0.2;
          return (baseFreq + noise) * 60; // Reduced max to 60% to look less fake
        });
        setVolume(Math.round(Math.max(...audioData) * 0.8)); // Cap at ~50%
      } else {
        // Decay quickly when not active
        audioData = audioData.map(v => v * 0.85);
        setVolume(Math.round(Math.max(...audioData) * 0.5));
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw waveform only if there's data
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
            className={`h-full transition-all duration-100 ${isActive
                ? 'bg-gradient-to-r from-blue-500 to-purple-500'
                : 'bg-muted-foreground/30'
              }`}
            style={{ width: `${Math.min(volume, 100)}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground w-12 text-right">
          {isActive ? `${Math.round(volume)}%` : '--'}
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
