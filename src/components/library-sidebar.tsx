"use client";

import { useCallback, useRef, useState } from "react";
import { usePdf } from "@/components/providers/pdf-provider";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Upload04Icon,
    Delete02Icon,
    FileIcon,
    MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LibrarySidebarProps {
    onDocumentOpen?: () => void;
}

export function LibrarySidebar({ onDocumentOpen }: LibrarySidebarProps) {
    const {
        documents,
        currentDocument,
        isLoading,
        uploadDocument,
        openDocument,
        deleteDocument,
    } = usePdf();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleUpload = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            if (file.type === "application/pdf") {
                await uploadDocument(file);
            }
        }
    }, [uploadDocument]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleUpload(e.dataTransfer.files);
    }, [handleUpload]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <aside className="w-72 h-full border-r border-border bg-sidebar flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-border">
                <div className="flex items-baseline justify-between">
                    <h1 className="text-lg font-semibold text-foreground tracking-tight">
                        Library
                    </h1>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                        [{documents.length}]
                    </span>
                </div>
            </div>

            {/* Upload Area */}
            <div className="p-4">
                <div
                    className={`
                        relative p-5 border border-dashed transition-all cursor-pointer group
                        ${dragOver
                            ? "border-foreground bg-secondary"
                            : "border-border hover:border-muted-foreground"
                        }
                    `}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        multiple
                        className="hidden"
                        onChange={(e) => handleUpload(e.target.files)}
                    />
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className={`
                            w-10 h-10 border flex items-center justify-center transition-colors
                            ${dragOver ? "border-foreground" : "border-border group-hover:border-muted-foreground"}
                        `}>
                            <HugeiconsIcon
                                icon={Upload04Icon}
                                size={20}
                                strokeWidth={1.5}
                                className={`transition-colors ${dragOver ? "text-foreground" : "text-muted-foreground"}`}
                            />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-foreground">
                                Drop PDF here
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase tracking-wider">
                                or click to browse
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-auto px-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.15em]">
                        Recent
                    </span>
                    <div className="flex-1 h-px bg-border ml-3" />
                </div>

                {isLoading && documents.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-4 h-4 border border-foreground border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-12 space-y-2">
                        <p className="text-xs text-muted-foreground">No documents</p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono">
                            Upload a PDF to begin
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {documents
                            .sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime())
                            .map((doc) => {
                                const isActive = currentDocument?.id === doc.id;
                                const progress = doc.totalPages > 1
                                    ? Math.round((doc.currentPage / doc.totalPages) * 100)
                                    : 100;

                                return (
                                    <div
                                        key={doc.id}
                                        className={`
                                            group relative p-3 cursor-pointer transition-all
                                            ${isActive
                                                ? "bg-secondary"
                                                : "hover:bg-secondary/50"
                                            }
                                        `}
                                        onClick={() => {
                                            openDocument(doc.id);
                                            onDocumentOpen?.();
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Document icon with progress ring */}
                                            <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                                                <svg className="absolute inset-0 w-8 h-8 -rotate-90">
                                                    <circle
                                                        cx="16"
                                                        cy="16"
                                                        r="14"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1"
                                                        className="text-border"
                                                    />
                                                    <circle
                                                        cx="16"
                                                        cy="16"
                                                        r="14"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.5"
                                                        strokeDasharray={`${progress * 0.88} 88`}
                                                        className="text-foreground transition-all duration-300"
                                                    />
                                                </svg>
                                                <HugeiconsIcon
                                                    icon={FileIcon}
                                                    size={14}
                                                    strokeWidth={1.5}
                                                    className="text-foreground"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0 space-y-1">
                                                <p className="text-xs font-medium text-foreground truncate leading-tight">
                                                    {doc.name}
                                                </p>
                                                <div className="flex items-center gap-2 font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                                                    <span>{doc.totalPages}p</span>
                                                    <span className="opacity-40">·</span>
                                                    <span>{formatDate(new Date(doc.lastOpenedAt))}</span>
                                                </div>
                                            </div>

                                            {/* More options dropdown */}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger
                                                    className={`
                                                        w-6 h-6 flex items-center justify-center
                                                        opacity-0 group-hover:opacity-100 transition-opacity
                                                        hover:bg-background
                                                    `}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <HugeiconsIcon icon={MoreHorizontalIcon} size={12} strokeWidth={2} />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" sideOffset={4}>
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteDocument(doc.id);
                                                        }}
                                                    >
                                                        <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
                <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-[0.15em] text-center">
                    Better PDF Reader
                </p>
            </div>
        </aside>
    );
}
