import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Activity, HardDrive, Cpu, Radio, Clock, Shield, Users, Bell } from 'lucide-react';
import { useSystemStatus } from '../hooks/useApi';

export function SystemStatus() {
  const { status, loading, error } = useSystemStatus();

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

  if (loading && !status) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-muted rounded w-3/4"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 col-span-full">
          <p className="text-muted-foreground text-center">
            Unable to load system status
          </p>
        </Card>
      </div>
    );
  }

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
          <p className="text-2xl">{formatUptime(status.uptime)}</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">CPU Usage</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className={getStatusColor(status.cpuUsage, 80)}>
              {status.cpuUsage.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">/ 100%</span>
          </div>
          <Progress value={status.cpuUsage} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Memory Usage</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className={getStatusColor(status.memoryUsage, 90)}>
              {status.memoryUsage.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">used</span>
          </div>
          <Progress value={status.memoryUsage} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Radio className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Active Nodes</span>
        </div>
        <div className="space-y-1">
          <p className="text-2xl">
            {status.activeNodes} / {status.totalNodes}
          </p>
          <p className="text-xs text-muted-foreground">
            {status.activeNodes === status.totalNodes
              ? 'All nodes operational'
              : `${status.totalNodes - status.activeNodes} offline`}
          </p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Transcription Latency</span>
        </div>
        <div className="space-y-1">
          <p className={`text-2xl ${getStatusColor(status.transcriptionLatency, 2000)}`}>
            {status.transcriptionLatency}ms
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
            <span className="text-2xl text-green-500">
              {status.speakerAccuracy}%
            </span>
            <span className="text-xs text-muted-foreground">Target: &gt; 85%</span>
          </div>
          <Progress value={status.speakerAccuracy} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Disk Usage</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span>{status.diskUsage.toFixed(1)}%</span>
            <span className="text-xs text-muted-foreground">used</span>
          </div>
          <Progress value={status.diskUsage} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Privacy Status</span>
        </div>
        <div className="space-y-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Local Only
          </Badge>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {status.enrolledSpeakers} speakers
            </div>
            <div className="flex items-center gap-1">
              <Bell className="w-3 h-3" />
              {status.pendingReminders} reminders
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
