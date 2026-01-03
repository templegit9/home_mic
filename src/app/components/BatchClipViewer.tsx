/**
 * BatchClipViewer - View and play back batch audio clips with transcripts
 */
import { useState, useRef, useEffect } from 'react';
import { useBatchClips, useBatchClipDetails } from '../hooks/useApi';
import { api, TranscriptSegment } from '../lib/api';

// Format duration in mm:ss
function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format timestamp for display
function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString();
}

// Status badge colors
function getStatusColor(status: string): string {
    switch (status) {
        case 'transcribed': return 'bg-green-500';
        case 'processing': return 'bg-yellow-500';
        case 'pending': return 'bg-blue-500';
        case 'failed': return 'bg-red-500';
        default: return 'bg-gray-500';
    }
}

export default function BatchClipViewer() {
    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { clips, total, loading, error, refresh, offset, nextPage, prevPage } = useBatchClips({ limit: 15 });
    const { clip: selectedClip, loading: clipLoading, audioUrl } = useBatchClipDetails(selectedClipId);

    // Audio player state
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Update current time as audio plays
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioUrl]);

    // Handle segment click - seek to that time
    const seekToSegment = (segment: TranscriptSegment) => {
        if (audioRef.current) {
            audioRef.current.currentTime = segment.start_time;
            if (!isPlaying) {
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Find current segment based on playback time
    const currentSegment = selectedClip?.segments.find(
        seg => currentTime >= seg.start_time && currentTime < seg.end_time
    );

    // Filter clips by search (client-side for now)
    const filteredClips = searchQuery
        ? clips.filter(c => c.transcript_preview?.toLowerCase().includes(searchQuery.toLowerCase()))
        : clips;

    return (
        <div className="flex h-full bg-gray-900 text-white">
            {/* Left Panel - Clip List */}
            <div className="w-1/3 border-r border-gray-700 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-700">
                    <h2 className="text-xl font-bold mb-3">Audio Recordings</h2>
                    <input
                        type="text"
                        placeholder="Search transcripts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                </div>

                {/* Clip List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-400">Loading...</div>
                    ) : error ? (
                        <div className="p-4 text-center text-red-400">Error: {error.message}</div>
                    ) : filteredClips.length === 0 ? (
                        <div className="p-4 text-center text-gray-400">No recordings yet</div>
                    ) : (
                        filteredClips.map((c) => (
                            <div
                                key={c.id}
                                onClick={() => setSelectedClipId(c.id)}
                                className={`p-4 border-b border-gray-700 cursor-pointer hover:bg-gray-800 transition-colors ${selectedClipId === c.id ? 'bg-gray-800 border-l-4 border-l-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-gray-400">
                                        {formatTimestamp(c.recorded_at)}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full text-white ${getStatusColor(c.status)}`}>
                                        {c.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm mb-2">
                                    <span className="text-gray-300">{formatDuration(c.duration_seconds)}</span>
                                    {c.word_count > 0 && (
                                        <span className="text-gray-500">• {c.word_count} words</span>
                                    )}
                                </div>
                                {c.transcript_preview && (
                                    <p className="text-sm text-gray-400 truncate">{c.transcript_preview}</p>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                <div className="p-3 border-t border-gray-700 flex items-center justify-between text-sm">
                    <button
                        onClick={prevPage}
                        disabled={offset === 0}
                        className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                    >
                        ← Prev
                    </button>
                    <span className="text-gray-400">
                        {offset + 1}-{Math.min(offset + 15, total)} of {total}
                    </span>
                    <button
                        onClick={nextPage}
                        disabled={offset + 15 >= total}
                        className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50"
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* Right Panel - Clip Details & Player */}
            <div className="flex-1 flex flex-col">
                {selectedClip ? (
                    <>
                        {/* Audio Player */}
                        <div className="p-4 border-b border-gray-700 bg-gray-800">
                            <div className="flex items-center gap-4 mb-3">
                                <button
                                    onClick={togglePlayPause}
                                    className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-500 transition-colors"
                                >
                                    {isPlaying ? (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <rect x="6" y="4" width="4" height="16" />
                                            <rect x="14" y="4" width="4" height="16" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                    )}
                                </button>
                                <div className="flex-1">
                                    <div className="text-sm text-gray-400 mb-1">
                                        {formatTimestamp(selectedClip.recorded_at)}
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span>{formatDuration(currentTime)}</span>
                                        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all"
                                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                            />
                                        </div>
                                        <span>{formatDuration(duration)}</span>
                                    </div>
                                </div>
                            </div>
                            {audioUrl && (
                                <audio ref={audioRef} src={audioUrl} preload="metadata" />
                            )}
                        </div>

                        {/* Transcript */}
                        <div className="flex-1 overflow-y-auto p-4">
                            <h3 className="text-lg font-semibold mb-4">Transcript</h3>

                            {clipLoading ? (
                                <div className="text-gray-400">Loading transcript...</div>
                            ) : selectedClip.status === 'transcribed' && selectedClip.segments.length > 0 ? (
                                <div className="space-y-2">
                                    {selectedClip.segments.map((seg) => (
                                        <div
                                            key={seg.id}
                                            onClick={() => seekToSegment(seg)}
                                            className={`p-3 rounded-lg cursor-pointer transition-colors ${currentSegment?.id === seg.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-800 hover:bg-gray-700'
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs text-gray-400">
                                                    {formatDuration(seg.start_time)}
                                                </span>
                                                {seg.confidence > 0 && (
                                                    <span className="text-xs text-gray-500">
                                                        ({Math.round(seg.confidence * 100)}%)
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm">{seg.text}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : selectedClip.status === 'processing' ? (
                                <div className="text-yellow-400 flex items-center gap-2">
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Processing... This may take a few minutes.
                                </div>
                            ) : selectedClip.status === 'failed' ? (
                                <div className="text-red-400">
                                    <p>Transcription failed</p>
                                    {selectedClip.error_message && (
                                        <p className="text-sm mt-1">{selectedClip.error_message}</p>
                                    )}
                                </div>
                            ) : selectedClip.transcript_text ? (
                                <p className="text-gray-300 leading-relaxed">{selectedClip.transcript_text}</p>
                            ) : (
                                <div className="text-gray-400">No transcript available</div>
                            )}
                        </div>

                        {/* Clip Info Footer */}
                        <div className="p-3 border-t border-gray-700 text-xs text-gray-400 flex items-center justify-between">
                            <div>
                                {selectedClip.word_count} words • {formatDuration(selectedClip.duration_seconds)}
                            </div>
                            {selectedClip.processing_duration_ms && (
                                <div>
                                    Processed in {(selectedClip.processing_duration_ms / 1000).toFixed(1)}s
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                            <p>Select a recording to view transcript</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
