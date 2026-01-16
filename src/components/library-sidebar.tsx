"use client";

import { useCallback, useRef, useState } from "react";
import { usePdf } from "@/components/providers/pdf-provider";
import { HugeiconsIcon } from "@hugeicons/react";
import {
    Upload04Icon,
    Delete02Icon,
    Folder02Icon,
    FileIcon,
    Clock01Icon,
    LeftToRightListNumberIcon,
} from "@hugeicons/core-free-icons";

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
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString();
    };

    return (
        <aside className="w-80 h-full border-r border-border bg-sidebar flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <HugeiconsIcon icon={Folder02Icon} size={20} strokeWidth={2} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-foreground">Library</h1>
                        <p className="text-xs text-muted-foreground">{documents.length} documents</p>
                    </div>
                </div>
            </div>

            {/* Upload Area */}
            <div
                className={`
          m-4 p-6 border-2 border-dashed rounded-2xl transition-all cursor-pointer
          ${dragOver
                        ? "border-primary bg-primary/10 scale-[1.02]"
                        : "border-border hover:border-primary/50 hover:bg-secondary/50"
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
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <HugeiconsIcon icon={Upload04Icon} size={24} strokeWidth={2} className="text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Drop PDF here</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                </div>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-auto px-4 pb-4">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Recent Documents
                </h2>

                {isLoading && documents.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : documents.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">No documents yet</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Upload a PDF to get started</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {documents
                            .sort((a, b) => new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime())
                            .map((doc) => (
                                <div
                                    key={doc.id}
                                    className={`
                    group relative p-3 rounded-xl cursor-pointer transition-all
                    ${currentDocument?.id === doc.id
                                            ? "bg-primary/10 border border-primary/20"
                                            : "hover:bg-secondary/70 border border-transparent"
                                        }
                  `}
                                    onClick={() => {
                                        openDocument(doc.id);
                                        onDocumentOpen?.();
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                                            <HugeiconsIcon icon={FileIcon} size={18} strokeWidth={2} className="text-accent" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-foreground truncate">{doc.name}</p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <HugeiconsIcon icon={LeftToRightListNumberIcon} size={12} strokeWidth={2} />
                                                    {doc.totalPages} pages
                                                </span>
                                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={2} />
                                                    {formatDate(new Date(doc.lastOpenedAt))}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Delete button */}
                                    <button
                                        className="
                      absolute top-2 right-2 w-7 h-7 rounded-lg 
                      flex items-center justify-center
                      opacity-0 group-hover:opacity-100 
                      bg-destructive/10 hover:bg-destructive/20 
                      text-destructive transition-all
                    "
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteDocument(doc.id);
                                        }}
                                        aria-label="Delete document"
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={2} />
                                    </button>

                                    {/* Progress indicator */}
                                    {doc.totalPages > 1 && (
                                        <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary/50 rounded-full transition-all"
                                                style={{ width: `${(doc.currentPage / doc.totalPages) * 100}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
