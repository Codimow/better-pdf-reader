"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence, useDragControls, useAnimation } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    PlayIcon,
    PauseIcon,
    StopIcon,
    RefreshIcon,
    ViewOffSlashIcon
} from "@hugeicons/core-free-icons";
import type { ReadingSession } from "@/hooks/use-reading-stats";
import { cn } from "@/lib/utils";

interface ReadingTrackerProps {
    isOpen: boolean;
    onClose: () => void;
    stats: ReadingSession;
    currentSessionFn: () => number;
    isPaused: boolean;
    onTogglePause: () => void;
}

export function ReadingTracker({ isOpen, onClose, stats, currentSessionFn, isPaused, onTogglePause }: ReadingTrackerProps) {
    const [elapsed, setElapsed] = useState(0);
    const [livePageDuration, setLivePageDuration] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isIdle, setIsIdle] = useState(false);
    const controls = useDragControls();

    // Ghost Mode: Track mouse movement to fade out when idle
    useEffect(() => {
        let timer: NodeJS.Timeout;
        const resetIdle = () => {
            setIsIdle(false);
            clearTimeout(timer);
            timer = setTimeout(() => setIsIdle(true), 4000); // Fade after 4s
        };
        window.addEventListener("mousemove", resetIdle);
        resetIdle();
        return () => {
            window.removeEventListener("mousemove", resetIdle);
            clearTimeout(timer);
        };
    }, []);

    // Update timer loop
    useEffect(() => {
        if (!isOpen) return;
        setElapsed(currentSessionFn());
        if (stats.getCurrentPageDuration) setLivePageDuration(stats.getCurrentPageDuration());

        const interval = setInterval(() => {
            if (!isPaused) {
                setElapsed(currentSessionFn());
                if (stats.getCurrentPageDuration) {
                    setLivePageDuration(stats.getCurrentPageDuration());
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, [isOpen, currentSessionFn, isPaused, stats.getCurrentPageDuration]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return hours > 0
            ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // Calculate velocity for color coding
    const pagesPerHour = useMemo(() => {
        if (!elapsed || stats.pagesRead === 0) return 0;
        const stableDuration = Math.max(elapsed, 60 * 1000); // minimum 1 min
        const hours = stableDuration / (1000 * 60 * 60);
        return Math.round(stats.pagesRead / hours);
    }, [elapsed, stats.pagesRead]);

    const getFlowColor = () => {
        if (pagesPerHour < 20) return "text-emerald-400"; // Deep Reading
        if (pagesPerHour < 60) return "text-blue-400";    // Flow State
        return "text-orange-400";                         // Skimming / Fast
    };

    // Generate waveform bars
    const waveformBars = useMemo(() => {
        const VISIBLE_BARS = 32;
        const history = stats.history || [];
        const allData = [...history];

        if (stats.currentPage) {
            allData.push({
                page: stats.currentPage,
                duration: isPaused ? (stats.getCurrentPageDuration ? stats.getCurrentPageDuration() : 0) : Math.max(100, livePageDuration)
            });
        }

        const recentDurations = allData.slice(-VISIBLE_BARS).map(d => d.duration);
        const maxDuration = Math.max(...recentDurations, 5000);

        const bars = [];
        for (let i = 0; i < VISIBLE_BARS; i++) {
            const dataIndex = allData.length - 1 - i;
            const item = dataIndex >= 0 ? allData[dataIndex] : undefined;
            if (item) {
                const ratio = Math.sqrt(item.duration) / Math.sqrt(maxDuration);
                bars.unshift({ type: 'data', height: Math.min(100, Math.max(10, ratio * 100)), active: dataIndex === allData.length - 1 && !isPaused });
            } else {
                bars.unshift({ type: 'empty', height: 10 + Math.sin(i * 0.5) * 5 });
            }
        }
        return bars;
    }, [stats.history, livePageDuration, isPaused, stats.currentPage]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    drag
                    dragControls={controls}
                    dragMomentum={false}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{
                        opacity: isIdle && !isHovered && !isPaused ? 0.3 : 1, // Ghost mode
                        scale: 1,
                        y: 0
                    }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* The HUD Capsule */}
                    <div className={cn(
                        "relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group",
                        isHovered || isPaused ? "w-[340px] h-[160px] rounded-[32px]" : "w-[180px] h-[48px]"
                    )}>

                        {/* Compact View Content (Always visible-ish) */}
                        <div className={cn(
                            "absolute inset-0 flex items-center justify-between px-5 transition-opacity duration-300",
                            isHovered || isPaused ? "opacity-0 pointer-events-none" : "opacity-100"
                        )}>
                            {/* Drag Handle (Compact) */}
                            <div className="absolute inset-0 cursor-grab active:cursor-grabbing" onPointerDown={(e) => controls.start(e)} />

                            <div className="flex items-center gap-3">
                                <div className={cn("w-2 h-2 rounded-full animate-pulse", isPaused ? "bg-amber-500" : "bg-red-500")} />
                                <span className={cn("font-mono text-sm tracking-widest tabular-nums", getFlowColor())}>
                                    {formatTime(elapsed)}
                                </span>
                            </div>
                            <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">
                                {isPaused ? "PAUSED" : "REC"}
                            </span>
                        </div>

                        {/* Expanded View Content */}
                        <div className={cn(
                            "absolute inset-0 flex flex-col p-5 transition-opacity duration-500",
                            isHovered || isPaused ? "opacity-100 delay-100" : "opacity-0 pointer-events-none"
                        )}>
                            {/* Header: Drag handle + Close */}
                            <div className="flex justify-between items-start mb-4 relative z-20">
                                <div className="flex flex-col gap-0.5" onPointerDown={(e) => controls.start(e)}> {/* Drag Area */}
                                    {/* Mocking a 'Flow State' Label */}
                                    <span className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-bold cursor-grab active:cursor-grabbing">
                                        Session
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                        <span className={cn("text-2xl font-light tracking-tighter mix-blend-screen font-mono", getFlowColor())}>
                                            {formatTime(elapsed)}
                                        </span>
                                        <div className="text-[10px] text-neutral-400 font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                                            {pagesPerHour} PG/HR
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={onClose}
                                    className="text-neutral-500 hover:text-white transition-colors p-1"
                                    title="Hide HUD"
                                >
                                    <HugeiconsIcon icon={ViewOffSlashIcon} size={16} />
                                </button>
                            </div>

                            {/* Waveform Viz */}
                            <div className="flex-1 flex items-end gap-[2px] opacity-80 mb-4 mask-linear-fade relative">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none z-10" />
                                {waveformBars.map((bar, i) => (
                                    <motion.div
                                        key={i}
                                        layout
                                        className={cn(
                                            "flex-1 rounded-full",
                                            bar.type === 'data'
                                                ? (bar.active ? "bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" : "bg-white/30")
                                                : "bg-white/5"
                                        )}
                                        style={{ height: `${bar.height}%` }}
                                    />
                                ))}
                            </div>

                            {/* Control Bar */}
                            <div className="flex items-center gap-2 mt-auto">
                                <button
                                    onClick={onTogglePause}
                                    className="flex-1 h-10 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 group/btn"
                                >
                                    {isPaused ? (
                                        <>
                                            <HugeiconsIcon icon={PlayIcon} size={16} className="text-emerald-400 group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-xs font-medium text-emerald-100">RESUME</span>
                                        </>
                                    ) : (
                                        <>
                                            <HugeiconsIcon icon={PauseIcon} size={16} className="text-amber-400 group-hover/btn:scale-110 transition-transform" />
                                            <span className="text-xs font-medium text-amber-100">PAUSE</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => {
                                        if (confirm("Reset session?")) window.location.reload();
                                    }}
                                    className="w-10 h-10 bg-white/5 hover:bg-red-500/20 border border-white/5 hover:border-red-500/30 rounded-full flex items-center justify-center transition-all active:scale-95 text-neutral-400 hover:text-red-400"
                                    title="Reset"
                                >
                                    <HugeiconsIcon icon={RefreshIcon} size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Progress Ring / Activity Indicator (Subtle bottom border in expanded, full ring in compact) */}
                        <div className={cn(
                            "absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent transition-all duration-1000",
                            isPaused ? "text-amber-500/50" : getFlowColor(),
                            isHovered ? "w-full opacity-100" : "w-[60%] left-[20%] opacity-50"
                        )} />

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
