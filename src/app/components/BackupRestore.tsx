import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Download, Upload, HardDrive, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Backup {
  id: string;
  timestamp: Date;
  size: string;
  type: 'auto' | 'manual';
  includes: string[];
  location: string;
}

export function BackupRestore() {
  const [autoBackup, setAutoBackup] = useState(true);
  const [backupFrequency, setBackupFrequency] = useState('daily');
  const [backupLocation, setBackupLocation] = useState('/mnt/nas/homemic-backup');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);

  const [backups, setBackups] = useState<Backup[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 86400000),
      size: '2.4 GB',
      type: 'auto',
      includes: ['Transcriptions', 'Speaker Profiles', 'Configuration', 'Reminders'],
      location: '/mnt/nas/homemic-backup',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 172800000),
      size: '2.3 GB',
      type: 'auto',
      includes: ['Transcriptions', 'Speaker Profiles', 'Configuration', 'Reminders'],
      location: '/mnt/nas/homemic-backup',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 259200000),
      size: '2.1 GB',
      type: 'manual',
      includes: ['Transcriptions', 'Speaker Profiles', 'Configuration', 'Reminders'],
      location: '/mnt/nas/homemic-backup',
    },
  ]);

  const createBackup = () => {
    setIsBackingUp(true);
    setBackupProgress(0);

    const interval = setInterval(() => {
      setBackupProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsBackingUp(false);
          
          const newBackup: Backup = {
            id: Date.now().toString(),
            timestamp: new Date(),
            size: '2.5 GB',
            type: 'manual',
            includes: ['Transcriptions', 'Speaker Profiles', 'Configuration', 'Reminders'],
            location: backupLocation,
          };
          
          setBackups(prev => [newBackup, ...prev]);
          toast.success('Backup completed successfully');
          return 0;
        }
        return prev + 10;
      });
    }, 500);
  };

  const restoreBackup = (backupId: string) => {
    const backup = backups.find(b => b.id === backupId);
    if (backup) {
      toast.success(`Restoring backup from ${backup.timestamp.toLocaleString()}`);
    }
  };

  const deleteBackup = (backupId: string) => {
    setBackups(prev => prev.filter(b => b.id !== backupId));
    toast.success('Backup deleted');
  };

  const exportConfig = () => {
    toast.success('Configuration exported successfully');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2>Backup & Restore</h2>
        <p className="text-sm text-muted-foreground">
          Protect your data with automated backups and easy restoration
        </p>
      </div>

      {/* Backup Settings */}
      <Card className="p-4">
        <h3 className="mb-4">Backup Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div>
              <Label htmlFor="auto-backup" className="cursor-pointer">
                Automatic Backups
              </Label>
              <p className="text-sm text-muted-foreground">
                Schedule regular automated backups
              </p>
            </div>
            <Switch
              id="auto-backup"
              checked={autoBackup}
              onCheckedChange={setAutoBackup}
            />
          </div>

          {autoBackup && (
            <>
              <div className="space-y-2">
                <Label>Backup Frequency</Label>
                <Select value={backupFrequency} onValueChange={setBackupFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Every Hour</SelectItem>
                    <SelectItem value="daily">Daily (Recommended)</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Backup Location</Label>
                <Input
                  value={backupLocation}
                  onChange={(e) => setBackupLocation(e.target.value)}
                  placeholder="/path/to/backup/location"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: Network-attached storage (NAS) or external drive
                </p>
              </div>
            </>
          )}

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Backup Includes</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Transcription history</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Speaker profiles</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">System configuration</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Reminders & alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Privacy zone history</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Keyword settings</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Manual Backup */}
      <Card className="p-4">
        <h3 className="mb-4">Manual Backup</h3>
        {isBackingUp ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Creating backup...</span>
              <span className="text-muted-foreground">{backupProgress}%</span>
            </div>
            <Progress value={backupProgress} />
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={createBackup} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Create Backup Now
            </Button>
            <Button onClick={exportConfig} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Config
            </Button>
          </div>
        )}
      </Card>

      {/* Available Backups */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3>Available Backups</h3>
          <Badge variant="secondary">{backups.length} backups</Badge>
        </div>
        <div className="space-y-3">
          {backups.map(backup => (
            <div key={backup.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <HardDrive className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {backup.timestamp.toLocaleString()}
                      </span>
                      <Badge variant={backup.type === 'auto' ? 'secondary' : 'outline'}>
                        {backup.type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {backup.size}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor((Date.now() - backup.timestamp.getTime()) / 86400000)}d ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {backup.includes.map(item => (
                  <Badge key={item} variant="outline" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button
                  onClick={() => restoreBackup(backup.id)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Restore
                </Button>
                <Button
                  onClick={() => deleteBackup(backup.id)}
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Disaster Recovery */}
      <Card className="p-4 border-yellow-500/20 bg-yellow-500/5">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-600 dark:text-yellow-500 mb-2">
              Disaster Recovery Tips
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Store backups on separate physical device (NAS or external drive)</li>
              <li>Test restore process periodically to ensure backup integrity</li>
              <li>Keep at least 3 generations of backups for redundancy</li>
              <li>Document backup location and credentials in secure location</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
