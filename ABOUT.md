# HomeMic - Smart Home Audio Recording System

A privacy-first smart microphone system that captures, transcribes, and manages audio recordings from Raspberry Pi nodes throughout your home.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Pi Node        │────▶│  Backend Server │◀────│  Web Dashboard  │
│  (Living Room)  │     │  (LXC Container)│     │  (React + Vite) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Raspberry Pi Nodes**: Capture 10-minute audio clips, upload to server
- **Backend**: FastAPI on Python, runs in Proxmox LXC container
- **Frontend**: React dashboard with real-time status and clip management

## Key Features

### Recording & Transcription
- Automatic 10-minute audio clip capture
- Whisper-based local transcription (privacy-first, no cloud)
- Word-level timestamps with speaker diarization support

### Dashboard
- Real-time system status (CPU, memory, uptime)
- Node health monitoring with last-seen timestamps
- Audio waveform visualization with seek-to-timestamp

### Clip Management
- Browse, search, and play back recordings
- Download audio files (WAV)
- Export transcripts (TXT, SRT subtitles, JSON)
- Rename clips with custom names and notes
- Bulk selection with floating action bar
- Delete with confirmation

### System Control
- Update Backend / Update Node buttons
- Recovery service (port 8001) for restart when main API crashes
- Live log streaming via WebSocket

## Tech Stack

| Layer    | Technology                    |
|----------|-------------------------------|
| Frontend | React, TypeScript, Vite, TailwindCSS |
| Backend  | FastAPI, SQLAlchemy, SQLite   |
| Transcription | faster-whisper (local)   |
| Pi Agent | Python, pyaudio               |
| Hosting  | Proxmox LXC (Debian)          |

## API Endpoints

- `GET /api/status` - System metrics
- `GET /api/batch/history` - List recordings
- `GET /api/batch/clips/{id}` - Clip details + transcript
- `GET /api/batch/clips/{id}/download` - Download audio
- `GET /api/batch/clips/{id}/export?format=txt|srt|json` - Export transcript
- `PATCH /api/batch/clips/{id}` - Update name/notes
- `POST /api/batch/bulk/delete` - Bulk delete
- `POST /api/batch/bulk/export` - Bulk export as ZIP

## Services

| Service | Port | Purpose |
|---------|------|---------|
| homemic | 8420 | Main backend API |
| homemic-recovery | 8001 | Fallback restart service |
| homemic-node | - | Pi audio capture agent |
