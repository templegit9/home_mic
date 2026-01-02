import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Clock, MapPin, Users } from 'lucide-react';
import { useState } from 'react';

export function RoomAnalytics() {
  const [timeRange, setTimeRange] = useState('week');

  // Activity by room data
  const roomActivityData = [
    { room: 'Living Room', conversations: 45, duration: 180 },
    { room: 'Kitchen', conversations: 38, duration: 142 },
    { room: 'Office', conversations: 12, duration: 95 },
  ];

  // Activity by time of day
  const timeActivityData = [
    { hour: '6am', count: 2 },
    { hour: '8am', count: 8 },
    { hour: '10am', count: 12 },
    { hour: '12pm', count: 15 },
    { hour: '2pm', count: 11 },
    { hour: '4pm', count: 14 },
    { hour: '6pm', count: 18 },
    { hour: '8pm', count: 20 },
    { hour: '10pm', count: 5 },
  ];

  // Speaker activity breakdown
  const speakerActivityData = [
    { speaker: 'Alice', minutes: 245, color: '#3b82f6' },
    { speaker: 'Bob', minutes: 189, color: '#22c55e' },
    { speaker: 'Charlie', minutes: 112, color: '#a855f7' },
  ];

  // Conversation duration trends
  const conversationTrendsData = [
    { day: 'Mon', avgDuration: 4.2 },
    { day: 'Tue', avgDuration: 5.1 },
    { day: 'Wed', avgDuration: 3.8 },
    { day: 'Thu', avgDuration: 6.2 },
    { day: 'Fri', avgDuration: 5.5 },
    { day: 'Sat', avgDuration: 7.8 },
    { day: 'Sun', avgDuration: 6.9 },
  ];

  // Peak hours
  const peakHours = {
    morning: '8-10 AM',
    afternoon: '2-4 PM',
    evening: '6-9 PM',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>Room & Activity Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Insights into conversation patterns across your home
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Past Week</SelectItem>
            <SelectItem value="month">Past Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Most Active Room</span>
          </div>
          <p className="text-2xl">Living Room</p>
          <p className="text-sm text-muted-foreground">45 conversations</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Peak Hours</span>
          </div>
          <p className="text-2xl">6-9 PM</p>
          <p className="text-sm text-muted-foreground">Evening activity</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Most Active Speaker</span>
          </div>
          <p className="text-2xl">Alice</p>
          <p className="text-sm text-muted-foreground">245 minutes</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Avg. Conversation</span>
          </div>
          <p className="text-2xl">5.6 min</p>
          <p className="text-sm text-muted-foreground">+12% from last week</p>
        </Card>
      </div>

      {/* Activity by Room */}
      <Card className="p-4">
        <h3 className="mb-4">Activity by Room</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={roomActivityData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="room" className="text-sm" />
            <YAxis className="text-sm" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
            />
            <Bar dataKey="conversations" fill="#3b82f6" name="Conversations" />
            <Bar dataKey="duration" fill="#a855f7" name="Duration (min)" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Time of Day Activity */}
      <Card className="p-4">
        <h3 className="mb-4">Activity Heatmap - Time of Day</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={timeActivityData}>
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* Speaker Activity Breakdown */}
        <Card className="p-4">
          <h3 className="mb-4">Speaking Time Distribution</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={speakerActivityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ speaker, minutes }) => `${speaker}: ${minutes}m`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="minutes"
                >
                  {speakerActivityData.map((entry, index) => (
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
            {speakerActivityData.map(speaker => (
              <div key={speaker.speaker} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: speaker.color }} />
                  <span>{speaker.speaker}</span>
                </div>
                <span className="text-muted-foreground">{speaker.minutes} minutes</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Conversation Duration Trends */}
        <Card className="p-4">
          <h3 className="mb-4">Average Conversation Duration</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={conversationTrendsData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" className="text-sm" />
              <YAxis className="text-sm" label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
              />
              <Line
                type="monotone"
                dataKey="avgDuration"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: '#f59e0b' }}
                name="Avg Duration (min)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Peak Activity Times */}
      <Card className="p-4">
        <h3 className="mb-4">Peak Activity Times</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Morning</Badge>
            </div>
            <p className="text-2xl mb-1">{peakHours.morning}</p>
            <p className="text-sm text-muted-foreground">Breakfast & planning</p>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Afternoon</Badge>
            </div>
            <p className="text-2xl mb-1">{peakHours.afternoon}</p>
            <p className="text-sm text-muted-foreground">Work & meetings</p>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Evening</Badge>
            </div>
            <p className="text-2xl mb-1">{peakHours.evening}</p>
            <p className="text-sm text-muted-foreground">Dinner & family time</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
