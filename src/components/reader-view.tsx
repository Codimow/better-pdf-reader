"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePdf } from "@/components/providers/pdf-provider";
// Dynamically import PdfViewer to avoid server-side usage of browser-only APIs (DOMMatrix)
const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then(mod => mod.PdfViewer), {
    ssr: false,
    loading: () => <div className="flex-1 bg-muted/20 animate-pulse" />
});
import { ThemeToggle } from "@/components/theme-toggle";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
    Copy01Icon,
    FileScriptIcon,
    Menu01Icon,
    CheckmarkCircle02Icon,
    GridViewIcon,
    CommandIcon,
    MoreVerticalIcon,
    ChartHistogramIcon,
} from "@hugeicons/core-free-icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { PagesPerView } from "@/components/pdf-viewer";

interface ReaderViewProps {
    onMenuClick?: () => void;
    onShowStats?: () => void;
}

export function ReaderView({ onMenuClick, onShowStats }: ReaderViewProps) {
    const {
        currentDocument,
        currentPdf,
        currentPage,
        totalPages,
        pagesPerView,
        goToPage,
        nextPage,
        prevPage,
        setPagesPerView,
        copyPageAsMarkdown,
        copyDocumentAsMarkdown,
        closeDocument,
    } = usePdf();

    const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");
    const [pageInputValue, setPageInputValue] = useState(String(currentPage));


    // Use focus state to prevent overwriting input while user is typing
    const [isInputFocused, setIsInputFocused] = useState(false);

    // Sync input value when page changes externally, ONLY if not focused
    useEffect(() => {
        if (!isInputFocused) {
            setPageInputValue(String(currentPage));
        }
    }, [currentPage, isInputFocused]);

    const handlePageSubmit = () => {
        let val = parseInt(pageInputValue);
        if (isNaN(val)) {
            val = currentPage;
        }

        // Clamp to bounds
        if (val < 1) val = 1;
        if (val > totalPages) val = totalPages;

        if (val !== currentPage) {
            goToPage(val);
        } else {
            // Just normalize the input display if it was weird (like "001" or "0")
            setPageInputValue(String(val));
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow digits
        const newValue = e.target.value.replace(/[^0-9]/g, '');
        setPageInputValue(newValue);
    };

    const handleCopy = async (type: "page" | "document") => {
        setCopyState("copying");
        try {
            if (type === "page") {
                await copyPageAsMarkdown();
            } else {
                await copyDocumentAsMarkdown();
            }
            setCopyState("copied");
            setTimeout(() => setCopyState("idle"), 2000);
        } catch (e) {
            console.error("Copy failed:", e);
            setCopyState("idle");
        }
    };

    if (!currentPdf || !currentDocument) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-background relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(currentColor_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.03] pointer-events-none" />

                <div className="text-center space-y-6 z-10">
                    <div className="w-16 h-16 mx-auto border border-border rounded-full flex items-center justify-center bg-secondary/50">
                        <HugeiconsIcon icon={FileScriptIcon} size={24} className="text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-500">
                            System_Idle
                        </span>
                        <h2 className="text-2xl font-bold text-foreground tracking-tight uppercase">
                            No_Document_Loaded
                        </h2>
                        <p className="text-xs text-muted-foreground font-mono tracking-wide max-w-[280px] mx-auto">
                            SELECT A FILE FROM THE LIBRARY TO INITIALIZE READER
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background min-h-0 relative">
            {/* Header */}
            <header className="shrink-0 h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 gap-4 z-20">
                {/* Left: Menu & Title */}
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        onClick={closeDocument}
                        className="w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground border border-transparent hover:border-border rounded-sm"
                        title="Close Document"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
                    </button>

                    <div className="w-px h-4 bg-border mx-1" />

                    <button
                        onClick={onMenuClick}
                        className="lg:hidden w-8 h-8 flex items-center justify-center hover:bg-secondary transition-colors text-foreground"
                        aria-label="Open menu"
                    >
                        <HugeiconsIcon icon={Menu01Icon} size={18} />
                    </button>

                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="font-mono font-bold text-foreground truncate text-sm tracking-tight uppercase">
                                {currentDocument.name}
                            </h1>
                            <span className="font-mono text-[9px] text-red-500 uppercase tracking-wider border border-red-500/20 bg-red-500/10 px-1 py-0.5 rounded-[2px]">
                                PDF
                            </span>
                        </div>
                    </div>
                </div>

                {/* Center: Navigation */}
                <div className="flex items-center gap-1 border border-border px-1 py-1 rounded-[4px] bg-secondary/30">
                    <button
                        onClick={prevPage}
                        disabled={currentPage <= 1}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-foreground"
                    >
                        <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
                    </button>

                    <div className="flex items-center gap-1.5 px-2 font-mono text-xs">
                        <input
                            type="text"
                            inputMode="numeric"
                            value={pageInputValue}
                            onChange={handleInputChange}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => {
                                setIsInputFocused(false);
                                handlePageSubmit();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handlePageSubmit();
                            }}
                            className="w-10 h-6 text-center bg-transparent border-b border-border focus:border-red-500 focus:outline-none text-foreground transition-colors"
                        />
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground">{totalPages}</span>
                    </div>

                    <button
                        onClick={nextPage}
                        disabled={currentPage >= totalPages}
                        className="w-7 h-7 flex items-center justify-center hover:bg-secondary disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-foreground"
                    >
                        <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={onShowStats}
                        className="w-8 h-8 flex items-center justify-center border border-border hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 transition-all text-muted-foreground"
                        title="Reading Stats"
                    >
                        <HugeiconsIcon icon={ChartHistogramIcon} size={14} />
                    </button>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Copy Markdown Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className={`
                                flex items-center gap-2 px-3 h-8 border transition-all text-xs font-mono uppercase tracking-wide
                                ${copyState === "copied"
                                    ? "bg-foreground text-background border-foreground"
                                    : "border-border hover:bg-secondary text-foreground"
                                }
                            `}
                            disabled={copyState === "copying"}
                        >
                            {copyState === "copied" ? (
                                <>
                                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
                                    <span>Copied</span>
                                </>
                            ) : copyState === "copying" ? (
                                <>
                                    <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                    <span>...</span>
                                </>
                            ) : (
                                <>
                                    <HugeiconsIcon icon={CommandIcon} size={14} />
                                    <span className="hidden sm:inline">Export</span>
                                </>
                            )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground font-mono">
                            <div className="px-3 py-2 text-[10px] text-muted-foreground uppercase tracking-widest">Export_Mode</div>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem onClick={() => handleCopy("page")} className="focus:bg-secondary focus:text-foreground">
                                <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-2" />
                                Current_Page
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopy("document")} className="focus:bg-secondary focus:text-foreground">
                                <HugeiconsIcon icon={FileScriptIcon} size={14} className="mr-2" />
                                Full_Document
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Page Layout Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="flex items-center gap-2 px-3 h-8 border border-border hover:bg-secondary text-foreground transition-all text-xs font-mono uppercase"
                        >
                            <HugeiconsIcon icon={GridViewIcon} size={14} />
                            <span className="hidden sm:inline">{pagesPerView}X</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground font-mono">
                            <DropdownMenuRadioGroup
                                value={String(pagesPerView)}
                                onValueChange={(v) => setPagesPerView(Number(v) as PagesPerView)}
                            >
                                <DropdownMenuRadioItem value="1" className="focus:bg-secondary focus:text-foreground text-xs">Single_View</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="2" className="focus:bg-secondary focus:text-foreground text-xs">Dual_View</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="4" className="focus:bg-secondary focus:text-foreground text-xs">Quad_View</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* More menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            className="w-8 h-8 flex items-center justify-center border border-border hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <HugeiconsIcon icon={MoreVerticalIcon} size={14} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border text-popover-foreground font-mono">
                            <DropdownMenuItem
                                className="focus:bg-red-500 focus:text-white text-red-500 text-xs uppercase"
                                onClick={closeDocument}
                            >
                                Close_Document
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* PDF Viewer */}
            <PdfViewer pdf={currentPdf} currentPage={currentPage} pagesPerView={pagesPerView} onPageChange={goToPage} />
        </div>
    );
}
