import { useState, useEffect } from 'react';
import { TranscriptionFeed } from './components/TranscriptionFeed';
import { TranscriptionHistory } from './components/TranscriptionHistory';
import { DashboardSidebar } from './components/DashboardSidebar';
import { NodesView } from './components/NodesView';
import { SpeakerManagement } from './components/SpeakerManagement';
import { SpeakerCorrection } from './components/SpeakerCorrection';
import { ReminderManager } from './components/ReminderManager';
import { SystemStatus } from './components/SystemStatus';
import { PrivacyControls } from './components/PrivacyControls';
import { KeywordDetection } from './components/KeywordDetection';
import { RoomAnalytics } from './components/RoomAnalytics';
import { NodeHealthDashboard } from './components/NodeHealthDashboard';
import { SystemLogs } from './components/SystemLogs';
import { BackupRestore } from './components/BackupRestore';
import { ConversationContext } from './components/ConversationContext';
import BatchClipViewer from './components/BatchClipViewer';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import {
  Mic, Radio, Users, Bell, BarChart3, Settings, Shield,
  Moon, Sun, Search, TrendingUp, Eye, HardDrive,
  AlertCircle, MessageCircle, UserCheck, Activity, FileAudio
} from 'lucide-react';
import { Toaster } from './components/ui/sonner';

type View =
  | 'dashboard'
  | 'nodes'
  | 'speakers'
  | 'speaker-correction'
  | 'reminders'
  | 'history'
  | 'recordings'
  | 'conversations'
  | 'privacy'
  | 'keywords'
  | 'analytics'
  | 'health'
  | 'logs'
  | 'settings';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check system theme preference
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />

      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl">HomeMic</h1>
                <p className="text-sm text-muted-foreground">
                  Privacy-First Smart Microphone System
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20">
                <Shield className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Local Network Only</span>
              </div>
              <Button variant="ghost" size="icon" onClick={toggleTheme}>
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveView('settings')}
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="border-b bg-card sticky top-[73px] z-40">
        <div className="container mx-auto px-4">
          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as View)}>
            <TabsList className="bg-transparent border-b-0 h-12 p-0 gap-2 flex-wrap">
              <TabsTrigger
                value="dashboard"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger
                value="nodes"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <Radio className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Nodes</span>
              </TabsTrigger>
              <TabsTrigger
                value="speakers"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <Users className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Speakers</span>
              </TabsTrigger>
              <TabsTrigger
                value="reminders"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <Bell className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Reminders</span>
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <Search className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
              <TabsTrigger
                value="recordings"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <FileAudio className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Recordings</span>
              </TabsTrigger>
              <TabsTrigger
                value="conversations"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Conversations</span>
              </TabsTrigger>
              <TabsTrigger
                value="privacy"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <Eye className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Privacy</span>
              </TabsTrigger>
              <TabsTrigger
                value="keywords"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Keywords</span>
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            <SystemStatus />

            <div className="grid gap-6 lg:grid-cols-2">
              <BatchClipViewer />

              <DashboardSidebar />
            </div>
          </div>
        )}

        {activeView === 'nodes' && <NodesView />}
        {activeView === 'speakers' && <SpeakerManagement />}
        {activeView === 'speaker-correction' && <SpeakerCorrection />}
        {activeView === 'reminders' && <ReminderManager />}
        {activeView === 'history' && <TranscriptionHistory />}
        {activeView === 'recordings' && <BatchClipViewer />}
        {activeView === 'conversations' && <ConversationContext />}
        {activeView === 'privacy' && <PrivacyControls />}
        {activeView === 'keywords' && <KeywordDetection />}
        {activeView === 'analytics' && <RoomAnalytics />}
        {activeView === 'health' && <NodeHealthDashboard />}
        {activeView === 'logs' && <SystemLogs />}

        {activeView === 'settings' && (
          <div className="space-y-6">
            <div>
              <h2>Settings</h2>
              <p className="text-sm text-muted-foreground">
                Configure system preferences and manage data
              </p>
            </div>

            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                <TabsTrigger value="health">Node Health</TabsTrigger>
                <TabsTrigger value="corrections">Speaker Learning</TabsTrigger>
                <TabsTrigger value="logs">System Logs</TabsTrigger>
                <TabsTrigger value="backup">Backup & Restore</TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsList className="hidden">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  <TabsTrigger value="health">Node Health</TabsTrigger>
                  <TabsTrigger value="corrections">Speaker Learning</TabsTrigger>
                  <TabsTrigger value="logs">System Logs</TabsTrigger>
                  <TabsTrigger value="backup">Backup</TabsTrigger>
                </TabsList>

                <div data-state="active">
                  <div className="grid gap-6">
                    <Card className="p-4">
                      <h3 className="mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5" />
                        Quick Navigation
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <Button
                          variant="outline"
                          className="justify-start"
                          onClick={() => setActiveView('health')}
                        >
                          <Radio className="w-4 h-4 mr-2" />
                          Node Health
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start"
                          onClick={() => setActiveView('speaker-correction')}
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Speaker Learning
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start"
                          onClick={() => setActiveView('logs')}
                        >
                          <Activity className="w-4 h-4 mr-2" />
                          System Logs
                        </Button>
                      </div>
                    </Card>

                    <NodeHealthDashboard />
                    <SpeakerCorrection />
                    <SystemLogs />
                    <BackupRestore />
                  </div>
                </div>
              </div>
            </Tabs>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-6 bg-card">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>HomeMic v1.0 • Running locally on your home network</p>
          <p className="mt-1">No cloud dependencies • Zero external requests</p>
        </div>
      </footer>
    </div>
  );
}
