/**
 * BatchClipViewer - View and play back batch audio clips with transcripts
 */
import { useState, useRef, useEffect } from 'react';
import { useBatchClips, useBatchClipDetails } from '../hooks/useApi';
import { api, TranscriptSegment } from '../lib/api';
import { AudioWaveform } from './AudioWaveform';

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

    // Action state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showBulkExportMenu, setShowBulkExportMenu] = useState(false);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Update current time as audio plays
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleDurationChange = () => {
            // Use audio's duration if valid, otherwise fallback to clip's known duration
            if (audio.duration && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };
        const handleLoadedMetadata = () => {
            // Set duration when metadata loads
            if (audio.duration && isFinite(audio.duration)) {
                setDuration(audio.duration);
            } else if (selectedClip?.duration_seconds) {
                // Fallback to clip's known duration for WAV files
                setDuration(selectedClip.duration_seconds);
            }
        };
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('durationchange', handleDurationChange);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        // If we already have metadata, set duration now
        if (audio.readyState >= 1) {
            handleLoadedMetadata();
        }

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('durationchange', handleDurationChange);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioUrl, selectedClip]);

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

    // Delete clip handler
    const handleDelete = async () => {
        if (!selectedClipId) return;
        setIsDeleting(true);
        try {
            await api.deleteBatchClip(selectedClipId);
            setSelectedClipId(null);
            setShowDeleteConfirm(false);
            refresh();
        } catch (e) {
            console.error('Delete failed:', e);
        } finally {
            setIsDeleting(false);
        }
    };

    // Download audio handler
    const handleDownload = () => {
        if (!selectedClipId) return;
        window.open(api.getClipDownloadUrl(selectedClipId), '_blank');
    };

    // Export transcript handler
    const handleExport = (format: 'txt' | 'srt' | 'json') => {
        if (!selectedClipId) return;
        window.open(api.getExportTranscriptUrl(selectedClipId, format), '_blank');
        setShowExportMenu(false);
    };

    // Bulk selection handlers
    const toggleSelection = (clipId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(clipId)) next.delete(clipId);
            else next.add(clipId);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedIds.size === filteredClips.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredClips.map(c => c.id)));
        }
    };

    // Start editing handler
    const startEditing = () => {
        if (!selectedClip) return;
        setEditName(selectedClip.display_name || selectedClip.filename.replace('.wav', ''));
        setEditNotes(selectedClip.notes || '');
        setIsEditing(true);
    };

    // Save metadata handler
    const handleSaveMetadata = async () => {
        if (!selectedClipId) return;
        setIsSaving(true);
        try {
            await api.updateClipMetadata(selectedClipId, {
                display_name: editName || undefined,
                notes: editNotes || undefined,
            });
            setIsEditing(false);
            refresh();
        } catch (e) {
            console.error('Save failed:', e);
        } finally {
            setIsSaving(false);
        }
    };

    // Bulk delete handler
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Delete ${selectedIds.size} recordings?`)) return;
        try {
            await api.bulkDeleteClips(Array.from(selectedIds));
            setSelectedIds(new Set());
            refresh();
        } catch (e) {
            console.error('Bulk delete failed:', e);
        }
    };

    // Bulk export handler
    const handleBulkExport = async (format: 'txt' | 'srt' | 'json') => {
        if (selectedIds.size === 0) return;
        try {
            const blob = await api.bulkExportClips(Array.from(selectedIds), format);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transcripts_${new Date().toISOString().slice(0, 10)}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            setShowBulkExportMenu(false);
        } catch (e) {
            console.error('Bulk export failed:', e);
        }
    };

    // Filter clips by search (client-side for now)
    const filteredClips = searchQuery
        ? clips.filter(c => c.transcript_preview?.toLowerCase().includes(searchQuery.toLowerCase()))
        : clips;

    // Find current segment based on playback time
    const currentSegment = selectedClip?.segments.find(
        seg => currentTime >= seg.start_time && currentTime < seg.end_time
    );

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
                    {/* Select All */}
                    <div className="flex items-center justify-between mt-3 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selectedIds.size === filteredClips.length && filteredClips.length > 0}
                                onChange={selectAll}
                                className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                            />
                            <span className="text-gray-400">Select All</span>
                        </label>
                        <span className="text-gray-500">{selectedIds.size > 0 ? `${selectedIds.size} selected` : ''}</span>
                    </div>
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
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(c.id)}
                                            onClick={(e) => toggleSelection(c.id, e)}
                                            onChange={() => { }}
                                            className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                                        />
                                        <span className="text-sm text-gray-400">
                                            {formatTimestamp(c.recorded_at)}
                                        </span>
                                    </div>
                                    <span className={`px-2 py-0.5 text-xs rounded-full text-white ${getStatusColor(c.status)}`}>
                                        {c.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm mb-2 ml-6">
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
                                    {/* Editable Name/Notes */}
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                placeholder="Recording name"
                                                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
                                            />
                                            <textarea
                                                value={editNotes}
                                                onChange={(e) => setEditNotes(e.target.value)}
                                                placeholder="Notes / tags"
                                                rows={2}
                                                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500 resize-none"
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={handleSaveMetadata} disabled={isSaving} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs disabled:opacity-50">
                                                    {isSaving ? 'Saving...' : 'Save'}
                                                </button>
                                                <button onClick={() => setIsEditing(false)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium">{selectedClip.display_name || selectedClip.filename.replace('.wav', '')}</span>
                                                <button onClick={startEditing} className="text-gray-400 hover:text-white text-xs">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="text-sm text-gray-400">{formatTimestamp(selectedClip.recorded_at)}</div>
                                            {selectedClip.notes && (
                                                <div className="text-xs text-gray-500 mt-1">{selectedClip.notes}</div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm">
                                        <span>{formatDuration(currentTime)}</span>
                                        <div
                                            className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden cursor-pointer"
                                            onClick={(e) => {
                                                if (audioRef.current && duration > 0) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const clickX = e.clientX - rect.left;
                                                    const percent = clickX / rect.width;
                                                    audioRef.current.currentTime = percent * duration;
                                                }
                                            }}
                                        >
                                            <div
                                                className="h-full bg-blue-500 transition-all pointer-events-none"
                                                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                                            />
                                        </div>
                                        <span>{formatDuration(duration)}</span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleDownload}
                                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1.5"
                                        title="Download Audio"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download
                                    </button>

                                    <div className="relative">
                                        <button
                                            onClick={() => setShowExportMenu(!showExportMenu)}
                                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-1.5"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Export
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {showExportMenu && (
                                            <div className="absolute right-0 mt-1 bg-gray-700 rounded shadow-lg z-10 py-1 min-w-[120px]">
                                                <button onClick={() => handleExport('txt')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-600">Text (.txt)</button>
                                                <button onClick={() => handleExport('srt')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-600">Subtitles (.srt)</button>
                                                <button onClick={() => handleExport('json')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-600">JSON (.json)</button>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm flex items-center gap-1.5"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Delete Confirmation Modal */}
                            {showDeleteConfirm && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                    <div className="bg-gray-800 p-6 rounded-lg max-w-sm">
                                        <h3 className="text-lg font-semibold mb-2">Delete Recording?</h3>
                                        <p className="text-gray-400 mb-4">This will permanently delete the audio file and transcript.</p>
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">Cancel</button>
                                            <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 bg-red-600 rounded hover:bg-red-500 disabled:opacity-50">
                                                {isDeleting ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {audioUrl && (
                                <audio ref={audioRef} src={audioUrl} preload="metadata" />
                            )}

                            {/* Waveform Visualization */}
                            {audioUrl && (
                                <div className="mt-4">
                                    <AudioWaveform
                                        audioUrl={audioUrl}
                                        currentTime={currentTime}
                                        duration={duration}
                                        onSeek={(time) => {
                                            if (audioRef.current) {
                                                audioRef.current.currentTime = time;
                                            }
                                        }}
                                        height={60}
                                    />
                                </div>
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

            {/* Floating Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl px-6 py-3 flex items-center gap-4 z-50">
                    <span className="text-sm font-medium">{selectedIds.size} selected</span>
                    <div className="h-6 w-px bg-gray-600" />

                    <div className="relative">
                        <button
                            onClick={() => setShowBulkExportMenu(!showBulkExportMenu)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center gap-2"
                        >
                            Export All
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showBulkExportMenu && (
                            <div className="absolute bottom-full mb-2 left-0 bg-gray-700 rounded shadow-lg z-10 py-1 min-w-[120px]">
                                <button onClick={() => handleBulkExport('txt')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-600">Text (.txt)</button>
                                <button onClick={() => handleBulkExport('srt')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-600">Subtitles (.srt)</button>
                                <button onClick={() => handleBulkExport('json')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-600">JSON (.json)</button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleBulkDelete}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-sm"
                    >
                        Delete All
                    </button>

                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-2 text-gray-400 hover:text-white text-sm"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}
