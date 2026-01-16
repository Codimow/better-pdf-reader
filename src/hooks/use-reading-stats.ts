import { useState, useEffect, useRef } from "react";
import { usePdf } from "@/components/providers/pdf-provider";

export interface PageTime {
    page: number;
    duration: number; // in milliseconds
}

export interface ReadingSession {
    startTime: number;
    totalDuration: number | (() => number);
    getCurrentPageDuration: () => number;
    pagesRead: number;
    averageTimePerPage: number;
    history: PageTime[];
    currentPage: number;
}

export function useReadingStats() {
    const { currentDocument, currentPage } = usePdf();
    const [isOpen, setIsOpen] = useState(false);

    // Session state
    const [startTime, setStartTime] = useState<number>(Date.now());
    const [history, setHistory] = useState<PageTime[]>([]);

    // Pause state
    const [isPaused, setIsPaused] = useState(false);
    const pauseStartRef = useRef<number | null>(null);

    // Refs for tracking intervals without re-renders
    const lastPageParams = useRef({ page: 1, time: Date.now() });

    const togglePause = () => {
        const wasOpen = isOpen;
        if (!isOpen) {
            setIsOpen(true);
        }

        if (isPaused) {
            // Unpause if paused
            if (pauseStartRef.current) {
                const pauseDuration = Date.now() - pauseStartRef.current;
                setStartTime(prev => prev + pauseDuration);
                lastPageParams.current.time += pauseDuration;
            }
            pauseStartRef.current = null;
            setIsPaused(false);
        } else {
            // If it was already open and running, then we pause.
            // If it was closed, we just opened it and kept it running.
            if (wasOpen) {
                pauseStartRef.current = Date.now();
                setIsPaused(true);
            }
        }
    };

    // Reset on new document
    useEffect(() => {
        if (currentDocument) {
            setStartTime(Date.now());
            setHistory([]);
            lastPageParams.current = { page: currentPage, time: Date.now() };
            setIsPaused(false);
            pauseStartRef.current = null;
        }
    }, [currentDocument?.id]);

    // Track page changes
    useEffect(() => {
        if (!currentDocument) return;

        // If paused, we don't want to accumulate time for the PREVIOUS page.
        // But if the user switches pages while paused, we should update the tracker 
        // to start tracking the NEW page from "now" (which will be corrected on resume).

        if (isPaused) {
            // Just update the page index, don't touch the time or history.
            // The time ref will be shifted when we unpause.
            lastPageParams.current.page = currentPage;
            return;
        }

        const now = Date.now();
        const { page: lastPage, time: lastTime } = lastPageParams.current;
        const duration = now - lastTime;

        if (lastPage !== currentPage) {
            // Record history
            // Record history only if duration > 2000ms (2 seconds)
            // This prevents "skipping" through pages from cluttering the stats
            if (duration > 2000) {
                setHistory(prev => {
                    const existingIndex = prev.findIndex(p => p.page === lastPage);

                    if (existingIndex >= 0) {
                        const newHistory = [...prev];
                        const item = newHistory[existingIndex];
                        if (item) {
                            newHistory[existingIndex] = { ...item, duration: item.duration + duration };
                        }
                        return newHistory;
                    }

                    return [...prev, { page: lastPage, duration }];
                });
            }

            // Update refs
            lastPageParams.current = { page: currentPage, time: now };
        }
    }, [currentPage, currentDocument, isPaused]);

    // Live duration calculation helper
    const getSessionDuration = () => {
        if (isPaused && pauseStartRef.current) {
            return pauseStartRef.current - startTime;
        }
        return Date.now() - startTime;
    };

    const getCurrentPageDuration = () => {
        if (isPaused && pauseStartRef.current) {
            return pauseStartRef.current - lastPageParams.current.time;
        }
        return Date.now() - lastPageParams.current.time;
    };

    // Idle Watchdog: Auto-pause after 2 minutes of inactivity
    useEffect(() => {
        if (isPaused) return;

        let idleTimer: NodeJS.Timeout;
        const IDLE_TIMEOUT = 120000; // 2 minutes

        const resetIdleTimer = () => {
            clearTimeout(idleTimer);
            if (!isPaused) {
                idleTimer = setTimeout(() => {
                    // Auto-pause
                    console.log("Auto-pausing due to inactivity");
                    togglePause(); // Use the existing toggle which handles strict logic
                }, IDLE_TIMEOUT);
            }
        };

        // Listen for user activity
        const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
        const handleActivity = () => resetIdleTimer();

        events.forEach(event => window.addEventListener(event, handleActivity));
        resetIdleTimer(); // Start timer

        return () => {
            clearTimeout(idleTimer);
            events.forEach(event => window.removeEventListener(event, handleActivity));
        };
    }, [isPaused]); // Re-bind when pause state changes

    // Calculate derived stats
    const totalPagesRead = new Set(history.map(h => h.page)).size;
    const totalRecordedTime = history.reduce((acc, curr) => acc + curr.duration, 0);
    const avgTime = totalPagesRead > 0 ? totalRecordedTime / totalPagesRead : 0;

    return {
        isOpen,
        setIsOpen,
        isPaused,
        togglePause,
        stats: {
            startTime,
            totalDuration: getSessionDuration, // function to get live time
            getCurrentPageDuration, // function to get live page time
            pagesRead: totalPagesRead,
            averageTimePerPage: avgTime,
            history,
            currentPage: lastPageParams.current.page
        }
    };
}
