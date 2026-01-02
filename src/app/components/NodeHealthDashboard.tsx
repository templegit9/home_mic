import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Thermometer, Wifi, Volume2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface NodeHealth {
  id: string;
  name: string;
  audioQuality: number;
  sensitivity: number;
  temperature: number;
  latencyHistory: Array<{ time: string; latency: number }>;
  networkQuality: number;
  lastHealthCheck: Date;
  issues: string[];
}

export function NodeHealthDashboard() {
  const [selectedNode, setSelectedNode] = useState('node-1');
  const [nodeHealth, setNodeHealth] = useState<Record<string, NodeHealth>>({
    'node-1': {
      id: 'node-1',
      name: 'Living Room',
      audioQuality: 94,
      sensitivity: 87,
      temperature: 42,
      latencyHistory: [
        { time: '10:00', latency: 1200 },
        { time: '10:05', latency: 1350 },
        { time: '10:10', latency: 1180 },
        { time: '10:15', latency: 1420 },
        { time: '10:20', latency: 1290 },
        { time: '10:25', latency: 1410 },
        { time: '10:30', latency: 1380 },
      ],
      networkQuality: 98,
      lastHealthCheck: new Date(),
      issues: [],
    },
    'node-2': {
      id: 'node-2',
      name: 'Kitchen',
      audioQuality: 88,
      sensitivity: 82,
      temperature: 48,
      latencyHistory: [
        { time: '10:00', latency: 1400 },
        { time: '10:05', latency: 1580 },
        { time: '10:10', latency: 1520 },
        { time: '10:15', latency: 1680 },
        { time: '10:20', latency: 1590 },
        { time: '10:25', latency: 1720 },
        { time: '10:30', latency: 1650 },
      ],
      networkQuality: 95,
      lastHealthCheck: new Date(),
      issues: ['High ambient noise detected'],
    },
  });

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setNodeHealth(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(nodeId => {
          const node = updated[nodeId];
          // Update latency history
          const newLatency = {
            time: new Date().toLocaleTimeString(),
            latency: 1000 + Math.random() * 800,
          };
          node.latencyHistory = [...node.latencyHistory.slice(-6), newLatency];
          
          // Update temperature
          node.temperature = Math.max(35, Math.min(55, node.temperature + (Math.random() - 0.5) * 2));
        });
        return updated;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const currentNode = nodeHealth[selectedNode];

  const getHealthStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-500', variant: 'default' as const };
    if (score >= 75) return { label: 'Good', color: 'text-blue-500', variant: 'secondary' as const };
    if (score >= 60) return { label: 'Fair', color: 'text-yellow-500', variant: 'outline' as const };
    return { label: 'Poor', color: 'text-red-500', variant: 'destructive' as const };
  };

  const getTempStatus = (temp: number) => {
    if (temp < 45) return { label: 'Normal', color: 'text-green-500' };
    if (temp < 55) return { label: 'Warm', color: 'text-yellow-500' };
    return { label: 'Hot', color: 'text-red-500' };
  };

  return (
    <div className="space-y-4">
      <div>
        <h2>Node Health Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Monitor hardware performance and audio quality metrics
        </p>
      </div>

      <Tabs value={selectedNode} onValueChange={setSelectedNode}>
        <TabsList>
          {Object.values(nodeHealth).map(node => (
            <TabsTrigger key={node.id} value={node.id} className="gap-2">
              {node.name}
              {node.issues.length > 0 && (
                <AlertCircle className="w-3 h-3 text-yellow-500" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.values(nodeHealth).map(node => (
          <TabsContent key={node.id} value={node.id} className="space-y-4 mt-4">
            {/* Health Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Audio Quality</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl ${getHealthStatus(node.audioQuality).color}`}>
                      {node.audioQuality}%
                    </span>
                    <Badge variant={getHealthStatus(node.audioQuality).variant}>
                      {getHealthStatus(node.audioQuality).label}
                    </Badge>
                  </div>
                  <Progress value={node.audioQuality} />
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Sensitivity</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl ${getHealthStatus(node.sensitivity).color}`}>
                      {node.sensitivity}%
                    </span>
                    <Badge variant={getHealthStatus(node.sensitivity).variant}>
                      {getHealthStatus(node.sensitivity).label}
                    </Badge>
                  </div>
                  <Progress value={node.sensitivity} />
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Temperature</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl ${getTempStatus(node.temperature).color}`}>
                      {node.temperature.toFixed(1)}°C
                    </span>
                    <Badge variant="outline">
                      {getTempStatus(node.temperature).label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Pi Zero 2W</p>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wifi className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Network Quality</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl ${getHealthStatus(node.networkQuality).color}`}>
                      {node.networkQuality}%
                    </span>
                    <Badge variant={getHealthStatus(node.networkQuality).variant}>
                      {getHealthStatus(node.networkQuality).label}
                    </Badge>
                  </div>
                  <Progress value={node.networkQuality} />
                </div>
              </Card>
            </div>

            {/* Latency Graph */}
            <Card className="p-4">
              <h3 className="mb-4">Network Latency (Real-time)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={node.latencyHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="time" className="text-xs" />
                  <YAxis className="text-xs" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="latency"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Latency (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Current: {node.latencyHistory[node.latencyHistory.length - 1]?.latency.toFixed(0)}ms
                </span>
                <span className="text-muted-foreground">
                  Avg: {(node.latencyHistory.reduce((sum, d) => sum + d.latency, 0) / node.latencyHistory.length).toFixed(0)}ms
                </span>
                <span className="text-muted-foreground">
                  Target: &lt; 2000ms
                </span>
              </div>
            </Card>

            {/* Diagnostics */}
            <Card className="p-4">
              <h3 className="mb-4">Diagnostics</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Microphone Connection</span>
                  </div>
                  <Badge variant="outline">OK</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm">WebSocket Connection</span>
                  </div>
                  <Badge variant="outline">Connected</Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    {node.issues.length > 0 ? (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    <span className="text-sm">Audio Environment</span>
                  </div>
                  <Badge variant={node.issues.length > 0 ? 'outline' : 'outline'}>
                    {node.issues.length > 0 ? node.issues[0] : 'Optimal'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm">Last Health Check</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {node.lastHealthCheck.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
