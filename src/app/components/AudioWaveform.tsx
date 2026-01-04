/**
 * AudioWaveform - Visual waveform display for audio clips
 * Shows amplitude levels across the duration with playhead indicator
 */
import { useEffect, useRef, useState, useCallback } from 'react';

interface AudioWaveformProps {
    audioUrl: string | null;
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    height?: number;
    barWidth?: number;
    barGap?: number;
}

interface WaveformData {
    peaks: number[];
    duration: number;
}

export function AudioWaveform({
    audioUrl,
    currentTime,
    duration,
    onSeek,
    height = 80,
    barWidth = 3,
    barGap = 1
}: AudioWaveformProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
    const [loading, setLoading] = useState(false);
    const [containerWidth, setContainerWidth] = useState(0);

    // Calculate number of bars based on container width
    const numBars = Math.floor(containerWidth / (barWidth + barGap));

    // Load and analyze audio to extract waveform peaks
    const loadWaveform = useCallback(async (url: string) => {
        setLoading(true);
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // Get samples from first channel
            const channelData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;
            const audioDuration = audioBuffer.duration;

            // Calculate peaks for visualization
            const samplesPerBar = Math.floor(channelData.length / numBars);
            const peaks: number[] = [];

            for (let i = 0; i < numBars; i++) {
                const start = i * samplesPerBar;
                const end = Math.min(start + samplesPerBar, channelData.length);

                // Find max absolute value in this segment
                let max = 0;
                for (let j = start; j < end; j++) {
                    const abs = Math.abs(channelData[j]);
                    if (abs > max) max = abs;
                }
                peaks.push(max);
            }

            // Normalize peaks to 0-1 range
            const maxPeak = Math.max(...peaks);
            const normalizedPeaks = peaks.map(p => p / (maxPeak || 1));

            setWaveformData({
                peaks: normalizedPeaks,
                duration: audioDuration
            });

            audioContext.close();
        } catch (error) {
            console.error('Failed to load waveform:', error);
        } finally {
            setLoading(false);
        }
    }, [numBars]);

    // Observe container width for responsive sizing
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });

        observer.observe(containerRef.current);
        setContainerWidth(containerRef.current.offsetWidth);

        return () => observer.disconnect();
    }, []);

    // Load waveform when URL changes and we have width
    useEffect(() => {
        if (audioUrl && containerWidth > 0 && numBars > 0) {
            loadWaveform(audioUrl);
        }
    }, [audioUrl, containerWidth, numBars, loadWaveform]);

    // Draw waveform on canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !waveformData) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = containerWidth * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, containerWidth, height);

        // Calculate playhead position
        const playheadPercent = duration > 0 ? currentTime / duration : 0;
        const playheadX = playheadPercent * containerWidth;

        // Draw bars
        waveformData.peaks.forEach((peak, i) => {
            const x = i * (barWidth + barGap);
            const barHeight = Math.max(2, peak * (height - 4)); // Min height of 2px
            const y = (height - barHeight) / 2;

            // Color based on whether we've played past this point
            const barPosition = x / containerWidth;
            const isPast = barPosition < playheadPercent;

            ctx.fillStyle = isPast ? '#3B82F6' : '#4B5563'; // Blue if played, gray otherwise
            ctx.fillRect(x, y, barWidth, barHeight);
        });

        // Draw playhead line
        if (playheadX > 0) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(playheadX - 1, 0, 2, height);
        }

    }, [waveformData, currentTime, duration, containerWidth, height, barWidth, barGap]);

    // Handle click to seek
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current || duration <= 0) return;

        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = clickX / rect.width;
        const seekTime = percent * duration;

        onSeek(seekTime);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full cursor-pointer"
            style={{ height }}
            onClick={handleClick}
        >
            {loading ? (
                <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-gray-500">Loading waveform...</div>
                </div>
            ) : !waveformData ? (
                <div className="flex items-center justify-center h-full bg-gray-800 rounded">
                    <div className="text-sm text-gray-500">No audio loaded</div>
                </div>
            ) : (
                <canvas
                    ref={canvasRef}
                    className="w-full h-full"
                    style={{ width: containerWidth, height }}
                />
            )}

            {/* Hover overlay for better click feedback */}
            <div className="absolute inset-0 hover:bg-white/5 transition-colors rounded" />
        </div>
    );
}

export default AudioWaveform;
