import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Activity, HardDrive, Cpu, Radio, Clock, Shield } from 'lucide-react';

interface SystemMetrics {
  uptime: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  transcriptionLatency: number;
  speakerAccuracy: number;
  activeNodes: number;
  totalNodes: number;
}

export function SystemStatus() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: 2587200, // 30 days in seconds
    cpuUsage: 45,
    memoryUsage: 62,
    diskUsage: 38,
    transcriptionLatency: 1420,
    speakerAccuracy: 91,
    activeNodes: 2,
    totalNodes: 2,
  });

  useEffect(() => {
    // Simulate metric updates
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        uptime: prev.uptime + 5,
        cpuUsage: Math.max(20, Math.min(80, prev.cpuUsage + (Math.random() - 0.5) * 10)),
        memoryUsage: Math.max(40, Math.min(85, prev.memoryUsage + (Math.random() - 0.5) * 5)),
        transcriptionLatency: Math.max(800, Math.min(2500, prev.transcriptionLatency + (Math.random() - 0.5) * 200)),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (value: number, threshold: number) => {
    if (value >= threshold) return 'text-destructive';
    if (value >= threshold * 0.8) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">System Status</span>
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Online
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Uptime</span>
          </div>
          <p className="text-2xl">{formatUptime(metrics.uptime)}</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">CPU Usage</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className={getStatusColor(metrics.cpuUsage, 80)}>
              {metrics.cpuUsage.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">/ 100%</span>
          </div>
          <Progress value={metrics.cpuUsage} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Memory Usage</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className={getStatusColor(metrics.memoryUsage, 90)}>
              {metrics.memoryUsage.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">/ 8 GB</span>
          </div>
          <Progress value={metrics.memoryUsage} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Active Nodes</span>
        </div>
        <div className="space-y-1">
          <p className="text-2xl">
            {metrics.activeNodes} / {metrics.totalNodes}
          </p>
          <p className="text-xs text-muted-foreground">All nodes operational</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Transcription Latency</span>
        </div>
        <div className="space-y-1">
          <p className={`text-2xl ${getStatusColor(metrics.transcriptionLatency, 2000)}`}>
            {metrics.transcriptionLatency}ms
          </p>
          <p className="text-xs text-muted-foreground">Target: &lt; 2000ms</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Speaker Accuracy</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-2xl text-green-500">{metrics.speakerAccuracy}%</span>
            <span className="text-xs text-muted-foreground">Target: &gt; 85%</span>
          </div>
          <Progress value={metrics.speakerAccuracy} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Disk Usage</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span>{metrics.diskUsage}%</span>
            <span className="text-xs text-muted-foreground">/ 128 GB</span>
          </div>
          <Progress value={metrics.diskUsage} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Privacy Status</span>
        </div>
        <div className="space-y-1">
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Local Only
          </Badge>
          <p className="text-xs text-muted-foreground">
            No external requests detected
          </p>
        </div>
      </Card>
    </div>
  );
}
