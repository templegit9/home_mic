import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Clock, MapPin, Users, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface RoomStats {
  name: string;
  transcription_count: number;
  total_duration_seconds: number;
}

interface SpeakerStats {
  name: string;
  transcription_count: number;
  total_duration_minutes: number;
  color: string;
}

interface HourlyStats {
  hour: string;
  count: number;
}

export function RoomAnalytics() {
  const [timeRange, setTimeRange] = useState('24');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [roomData, setRoomData] = useState<RoomStats[]>([]);
  const [speakerData, setSpeakerData] = useState<SpeakerStats[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyStats[]>([]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const hours = parseInt(timeRange);
      const [rooms, speakers, hourly] = await Promise.all([
        api.fetch<any>(`/api/analytics/room?period_hours=${hours}`),
        api.fetch<any>(`/api/analytics/speakers?period_hours=${hours}`),
        api.fetch<any>(`/api/analytics/hourly?period_hours=${hours}`),
      ]);

      setRoomData(rooms.rooms || []);
      setSpeakerData((speakers.speakers || []).map((s: any, i: number) => ({
        ...s,
        color: ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444'][i % 5],
      })));
      setHourlyData(hourly.hourly || []);
      setError(null);
    } catch (e) {
      setError(e as Error);
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  // Calculate summary stats
  const mostActiveRoom = roomData.length > 0
    ? roomData.reduce((a, b) => a.transcription_count > b.transcription_count ? a : b)
    : null;

  const mostActiveSpeaker = speakerData.length > 0
    ? speakerData.reduce((a, b) => a.total_duration_minutes > b.total_duration_minutes ? a : b)
    : null;

  const totalConversations = roomData.reduce((sum, r) => sum + r.transcription_count, 0);

  // Find peak hour
  const peakHour = hourlyData.length > 0
    ? hourlyData.reduce((a, b) => a.count > b.count ? a : b)
    : null;

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">Failed to load analytics</p>
        <Button onClick={fetchAnalytics} variant="outline">
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
          <h2>Room & Activity Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Insights into conversation patterns across your home
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchAnalytics} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">Past 24 Hours</SelectItem>
              <SelectItem value="168">Past Week</SelectItem>
              <SelectItem value="720">Past Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Most Active Room</span>
          </div>
          <p className="text-2xl">{mostActiveRoom?.name || 'N/A'}</p>
          <p className="text-sm text-muted-foreground">
            {mostActiveRoom?.transcription_count || 0} conversations
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Peak Hour</span>
          </div>
          <p className="text-2xl">{peakHour?.hour || 'N/A'}</p>
          <p className="text-sm text-muted-foreground">
            {peakHour?.count || 0} conversations
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Most Active Speaker</span>
          </div>
          <p className="text-2xl">{mostActiveSpeaker?.name || 'N/A'}</p>
          <p className="text-sm text-muted-foreground">
            {Math.round(mostActiveSpeaker?.total_duration_minutes || 0)} minutes
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Conversations</span>
          </div>
          <p className="text-2xl">{totalConversations}</p>
          <p className="text-sm text-muted-foreground">
            In selected period
          </p>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Activity by Room */}
          {roomData.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-4">Activity by Room</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roomData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-sm" />
                  <YAxis className="text-sm" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="transcription_count" fill="#3b82f6" name="Conversations" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Hourly Activity */}
          {hourlyData.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-4">Activity Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-sm" />
                  <YAxis className="text-sm" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e' }}
                    name="Conversations"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Speaker Activity */}
          {speakerData.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-4">
                <h3 className="mb-4">Speaking Time Distribution</h3>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={speakerData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, total_duration_minutes }) => `${name}: ${Math.round(total_duration_minutes)}m`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="total_duration_minutes"
                      >
                        {speakerData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {speakerData.map(speaker => (
                    <div key={speaker.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: speaker.color }} />
                        <span>{speaker.name}</span>
                      </div>
                      <span className="text-muted-foreground">{Math.round(speaker.total_duration_minutes)} minutes</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="mb-4">Conversation Count by Speaker</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={speakerData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-sm" />
                    <YAxis type="category" dataKey="name" className="text-sm" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Bar dataKey="transcription_count" fill="#a855f7" name="Conversations" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {roomData.length === 0 && speakerData.length === 0 && hourlyData.length === 0 && (
            <Card className="p-8 text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No analytics data available</p>
              <p className="text-sm text-muted-foreground">Start recording conversations to see insights</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// Extend api client to expose fetch for custom endpoints
declare module '../lib/api' {
  interface ApiClient {
    fetch<T>(endpoint: string, options?: RequestInit): Promise<T>;
  }
}
