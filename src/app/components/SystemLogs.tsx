import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Download, Filter, AlertCircle, Info, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type LogLevel = 'info' | 'warning' | 'error' | 'success';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  details?: string;
}

export function SystemLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 300000),
      level: 'info',
      category: 'Node',
      message: 'Living Room node connected',
      details: 'WebSocket connection established from 192.168.1.105',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 240000),
      level: 'success',
      category: 'Speaker',
      message: 'Speaker identified: Alice (94% confidence)',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 180000),
      level: 'info',
      category: 'Transcription',
      message: 'Whisper model loaded successfully',
      details: 'Model: whisper-base.en, Load time: 2.3s',
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 120000),
      level: 'warning',
      category: 'Network',
      message: 'High latency detected on Kitchen node',
      details: 'Latency: 2150ms (threshold: 2000ms)',
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 60000),
      level: 'error',
      category: 'Privacy',
      message: 'Failed to verify network isolation',
      details: 'Outbound connection attempt blocked to 8.8.8.8',
    },
    {
      id: '6',
      timestamp: new Date(Date.now() - 30000),
      level: 'success',
      category: 'Privacy',
      message: 'Network isolation verified',
      details: 'Zero external requests in past 24h',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    // Simulate new log entries
    const interval = setInterval(() => {
      const categories = ['Node', 'Speaker', 'Transcription', 'Network', 'Privacy', 'System'];
      const levels: LogLevel[] = ['info', 'success', 'warning'];
      const messages = [
        'Health check completed',
        'Audio stream started',
        'Speaker confidence updated',
        'Network latency normal',
        'Privacy zone activated',
        'Backup completed successfully',
      ];

      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        level: levels[Math.floor(Math.random() * levels.length)],
        category: categories[Math.floor(Math.random() * categories.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
      };

      setLogs(prev => [newLog, ...prev].slice(0, 100));
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;
    return matchesSearch && matchesLevel && matchesCategory;
  });

  const getLogIcon = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getLogColor = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'border-l-blue-500';
      case 'success':
        return 'border-l-green-500';
      case 'warning':
        return 'border-l-yellow-500';
      case 'error':
        return 'border-l-red-500';
    }
  };

  const exportLogs = () => {
    toast.success(`Exporting ${filteredLogs.length} log entries`);
  };

  const categories = Array.from(new Set(logs.map(log => log.category)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>System Logs</h2>
          <p className="text-sm text-muted-foreground">
            Real-time event monitoring and diagnostic information
          </p>
        </div>
        <Button onClick={exportLogs} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Logs
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Badge variant="secondary">{filteredLogs.length} entries</Badge>
        </div>

        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {filteredLogs.map(log => (
              <div
                key={log.id}
                className={`p-3 rounded-lg border-l-4 bg-card hover:bg-accent/50 transition-colors ${getLogColor(log.level)}`}
              >
                <div className="flex items-start gap-3">
                  {getLogIcon(log.level)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {log.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Info</span>
          </div>
          <p className="text-2xl">{logs.filter(l => l.level === 'info').length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Success</span>
          </div>
          <p className="text-2xl">{logs.filter(l => l.level === 'success').length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-muted-foreground">Warnings</span>
          </div>
          <p className="text-2xl">{logs.filter(l => l.level === 'warning').length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-muted-foreground">Errors</span>
          </div>
          <p className="text-2xl">{logs.filter(l => l.level === 'error').length}</p>
        </Card>
      </div>
    </div>
  );
}
