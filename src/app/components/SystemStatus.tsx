import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Activity, HardDrive, Cpu, Radio, Clock, Shield, FileAudio, Loader2 } from 'lucide-react';
import { useSystemStatus, useBatchClips } from '../hooks/useApi';

export function SystemStatus() {
  const { status, loading, error } = useSystemStatus();
  const { clips, total } = useBatchClips({ limit: 50 });

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

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  // Calculate batch-specific stats
  const today = new Date().toDateString();
  const recordingsToday = clips.filter(c =>
    new Date(c.recorded_at).toDateString() === today
  ).length;

  const pendingTranscription = clips.filter(c =>
    c.status === 'processing' || c.status === 'pending'
  ).length;

  const lastRecording = clips.length > 0
    ? new Date(clips[0].recorded_at)
    : null;

  const timeSinceLastRecording = lastRecording
    ? Math.floor((Date.now() - lastRecording.getTime()) / 60000)
    : null;

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
      {/* System Status */}
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

      {/* Recordings Today */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileAudio className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Recordings Today</span>
        </div>
        <div className="space-y-1">
          <p className="text-2xl text-green-500">{recordingsToday}</p>
          <p className="text-xs text-muted-foreground">
            {total} total recordings
          </p>
        </div>
      </Card>

      {/* Pending Transcription */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className={`w-4 h-4 text-muted-foreground ${pendingTranscription > 0 ? 'animate-spin' : ''}`} />
          <span className="text-sm text-muted-foreground">Pending Transcription</span>
        </div>
        <div className="space-y-1">
          <p className={`text-2xl ${pendingTranscription > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
            {pendingTranscription}
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingTranscription === 0 ? 'All transcribed' : 'In queue'}
          </p>
        </div>
      </Card>

      {/* Active Nodes */}
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

      {/* Last Recording */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Last Recording</span>
        </div>
        <div className="space-y-1">
          <p className="text-2xl">
            {timeSinceLastRecording !== null
              ? timeSinceLastRecording < 60
                ? `${timeSinceLastRecording}m ago`
                : `${Math.floor(timeSinceLastRecording / 60)}h ago`
              : 'None'}
          </p>
          <p className="text-xs text-muted-foreground">
            {lastRecording ? lastRecording.toLocaleTimeString() : 'No recordings yet'}
          </p>
        </div>
      </Card>

      {/* CPU Usage */}
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

      {/* Memory */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Memory</span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className={getStatusColor(status.memoryUsage, 90)}>
              {formatBytes(status.memoryUsed || 0)}
            </span>
            <span className="text-xs text-muted-foreground">/ {formatBytes(status.memoryTotal || 0)}</span>
          </div>
          <Progress value={status.memoryUsage} />
        </div>
      </Card>

      {/* Storage */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Storage</span>
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            Local Only
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span>{formatBytes(status.diskUsed || 0)}</span>
            <span className="text-xs text-muted-foreground">/ {formatBytes(status.diskTotal || 0)}</span>
          </div>
          <Progress value={status.diskUsage} />
        </div>
      </Card>
    </div>
  );
}
