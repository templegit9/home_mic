import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Bell, Plus, Trash2, Clock, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface Reminder {
  id: string;
  title: string;
  description?: string;
  speaker?: string;
  dueDate: Date;
  recurring?: 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  createdBy: string;
}

export function ReminderManager() {
  const [reminders, setReminders] = useState<Reminder[]>([
    {
      id: '1',
      title: 'Check the laundry',
      description: 'Move clothes from washer to dryer',
      speaker: 'Alice',
      dueDate: new Date(Date.now() + 1800000), // 30 min
      completed: false,
      createdBy: 'Alice',
    },
    {
      id: '2',
      title: 'Team meeting',
      speaker: 'Bob',
      dueDate: new Date(Date.now() + 7200000), // 2 hours
      recurring: 'weekly',
      completed: false,
      createdBy: 'Bob',
    },
    {
      id: '3',
      title: 'Take medication',
      speaker: 'Alice',
      dueDate: new Date(Date.now() - 3600000), // overdue
      recurring: 'daily',
      completed: false,
      createdBy: 'Voice',
    },
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    speaker: '',
    dueDate: '',
    dueTime: '',
    recurring: '',
  });

  const speakers = ['Alice', 'Bob', 'Charlie', 'All'];

  const createReminder = () => {
    if (!formData.title || !formData.dueDate || !formData.dueTime) {
      toast.error('Please fill in required fields');
      return;
    }

    const dueDate = new Date(`${formData.dueDate}T${formData.dueTime}`);
    
    const newReminder: Reminder = {
      id: Date.now().toString(),
      title: formData.title,
      description: formData.description || undefined,
      speaker: formData.speaker || undefined,
      dueDate,
      recurring: formData.recurring as any || undefined,
      completed: false,
      createdBy: 'Manual',
    };

    setReminders(prev => [newReminder, ...prev]);
    toast.success('Reminder created successfully');
    
    setFormData({
      title: '',
      description: '',
      speaker: '',
      dueDate: '',
      dueTime: '',
      recurring: '',
    });
    setDialogOpen(false);
  };

  const toggleComplete = (id: string) => {
    setReminders(prev =>
      prev.map(r =>
        r.id === id ? { ...r, completed: !r.completed } : r
      )
    );
  };

  const deleteReminder = (id: string, title: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.success(`"${title}" removed`);
  };

  const getTimeUntil = (date: Date) => {
    const diff = date.getTime() - Date.now();
    const isPast = diff < 0;
    const absDiff = Math.abs(diff);
    
    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${isPast ? 'Overdue by ' : ''}${days}d ${hours % 24}h`;
    if (hours > 0) return `${isPast ? 'Overdue by ' : ''}${hours}h ${minutes % 60}m`;
    return `${isPast ? 'Overdue by ' : ''}${minutes}m`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2>Reminders</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Reminder</DialogTitle>
              <DialogDescription>
                Set up a new reminder with optional recurring schedule.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Reminder title..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Additional details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="speaker">Assign to Speaker</Label>
                <Select value={formData.speaker} onValueChange={(value) => setFormData({ ...formData, speaker: value })}>
                  <SelectTrigger id="speaker">
                    <SelectValue placeholder="Select speaker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {speakers.map(speaker => (
                      <SelectItem key={speaker} value={speaker}>
                        {speaker}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due-date">Due Date *</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due-time">Due Time *</Label>
                  <Input
                    id="due-time"
                    type="time"
                    value={formData.dueTime}
                    onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurring">Recurring</Label>
                <Select value={formData.recurring} onValueChange={(value) => setFormData({ ...formData, recurring: value })}>
                  <SelectTrigger id="recurring">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={createReminder} className="w-full">
                Create Reminder
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {reminders.map((reminder) => {
          const isOverdue = reminder.dueDate < new Date() && !reminder.completed;
          
          return (
            <Card key={reminder.id} className={`p-4 ${reminder.completed ? 'opacity-60' : ''}`}>
              <div className="flex gap-3">
                <Checkbox
                  checked={reminder.completed}
                  onCheckedChange={() => toggleComplete(reminder.id)}
                  className="mt-1"
                />
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className={reminder.completed ? 'line-through' : ''}>
                        {reminder.title}
                      </h3>
                      {reminder.description && (
                        <p className="text-sm text-muted-foreground">
                          {reminder.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteReminder(reminder.id, reminder.title)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    {reminder.speaker && (
                      <Badge variant="outline" className="gap-1">
                        <User className="w-3 h-3" />
                        {reminder.speaker}
                      </Badge>
                    )}
                    
                    <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeUntil(reminder.dueDate)}
                    </Badge>
                    
                    {reminder.recurring && (
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="w-3 h-3" />
                        {reminder.recurring}
                      </Badge>
                    )}
                    
                    <span className="text-muted-foreground">
                      by {reminder.createdBy}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
