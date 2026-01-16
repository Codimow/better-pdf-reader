import { Context, Effect, Layer, Schema } from "effect";
import type * as pdfjsTypes from "pdfjs-dist";

// Dynamic import for pdf.js (only on client)
let pdfjs: typeof pdfjsTypes | null = null;

const getPdfjs = () =>
    Effect.tryPromise({
        try: async () => {
            if (pdfjs) return pdfjs;

            if (typeof window === "undefined") {
                throw new Error("PDF.js can only be used in the browser");
            }

            const pdfjsModule = await import("pdfjs-dist");
            pdfjsModule.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsModule.version}/build/pdf.worker.min.mjs`;
            pdfjs = pdfjsModule;
            return pdfjsModule;
        },
        catch: (error) => new PdfParseError({ message: "Failed to load PDF.js", cause: error }),
    });

// ============================================================================
// Data Models
// ============================================================================

export class PageContent extends Schema.Class<PageContent>("PageContent")({
    pageNumber: Schema.Number,
    text: Schema.String,
}) { }

export class DocumentContent extends Schema.Class<DocumentContent>("DocumentContent")({
    title: Schema.String,
    pages: Schema.Array(PageContent),
    totalPages: Schema.Number,
}) { }

// ============================================================================
// Errors
// ============================================================================

export class PdfParseError extends Schema.TaggedError<PdfParseError>()(
    "PdfParseError",
    { message: Schema.String, cause: Schema.Unknown }
) { }

export class MarkdownConversionError extends Schema.TaggedError<MarkdownConversionError>()(
    "MarkdownConversionError",
    { message: Schema.String }
) { }

// ============================================================================
// PDF Parser Service
// ============================================================================

export class PdfParser extends Context.Tag("@app/PdfParser")<
    PdfParser,
    {
        readonly parse: (data: Uint8Array) => Effect.Effect<pdfjsTypes.PDFDocumentProxy, PdfParseError>;
        readonly getPageText: (doc: pdfjsTypes.PDFDocumentProxy, pageNumber: number) => Effect.Effect<string, PdfParseError>;
        readonly getAllText: (doc: pdfjsTypes.PDFDocumentProxy) => Effect.Effect<typeof DocumentContent.Type, PdfParseError>;
        readonly getPageCount: (doc: pdfjsTypes.PDFDocumentProxy) => Effect.Effect<number>;
    }
>() {
    static readonly layer = Layer.succeed(
        PdfParser,
        PdfParser.of({
            parse: Effect.fn("PdfParser.parse")(function* (data: Uint8Array) {
                const pdfjsLib = yield* getPdfjs();
                const result = yield* Effect.tryPromise({
                    try: () => pdfjsLib.getDocument({ data }).promise,
                    catch: (error) => new PdfParseError({ message: "Failed to parse PDF", cause: error }),
                });
                return result;
            }),

            getPageText: Effect.fn("PdfParser.getPageText")(function* (
                doc: pdfjsTypes.PDFDocumentProxy,
                pageNumber: number
            ) {
                const page = yield* Effect.tryPromise({
                    try: () => doc.getPage(pageNumber),
                    catch: (error) => new PdfParseError({ message: `Failed to get page ${pageNumber}`, cause: error }),
                });

                const textContent = yield* Effect.tryPromise({
                    try: () => page.getTextContent(),
                    catch: (error) => new PdfParseError({ message: `Failed to extract text from page ${pageNumber}`, cause: error }),
                });

                const text = textContent.items
                    .map((item) => ("str" in item ? item.str : ""))
                    .join(" ");

                return text;
            }),

            getAllText: Effect.fn("PdfParser.getAllText")(function* (doc: pdfjsTypes.PDFDocumentProxy) {
                const pages: typeof PageContent.Type[] = [];

                for (let i = 1; i <= doc.numPages; i++) {
                    const page = yield* Effect.tryPromise({
                        try: () => doc.getPage(i),
                        catch: (error) => new PdfParseError({ message: `Failed to get page ${i}`, cause: error }),
                    });

                    const textContent = yield* Effect.tryPromise({
                        try: () => page.getTextContent(),
                        catch: (error) => new PdfParseError({ message: `Failed to extract text from page ${i}`, cause: error }),
                    });

                    const text = textContent.items
                        .map((item) => ("str" in item ? item.str : ""))
                        .join(" ");

                    pages.push({ pageNumber: i, text });
                }

                return {
                    title: "Document",
                    pages,
                    totalPages: doc.numPages,
                };
            }),

            getPageCount: (doc: pdfjsTypes.PDFDocumentProxy) => Effect.succeed(doc.numPages),
        })
    );
}

// ============================================================================
// Markdown Converter Service
// ============================================================================

export class MarkdownConverter extends Context.Tag("@app/MarkdownConverter")<
    MarkdownConverter,
    {
        readonly pageToMarkdown: (pageText: string, pageNumber: number) => Effect.Effect<string>;
        readonly documentToMarkdown: (content: typeof DocumentContent.Type) => Effect.Effect<string>;
        readonly formatForLLM: (markdown: string, prompt?: string) => Effect.Effect<string>;
    }
>() {
    static readonly layer = Layer.succeed(
        MarkdownConverter,
        MarkdownConverter.of({
            pageToMarkdown: Effect.fn("MarkdownConverter.pageToMarkdown")(function* (
                pageText: string,
                pageNumber: number
            ) {
                // Clean up text and format as markdown
                const cleaned = pageText
                    .replace(/\s+/g, " ")
                    .trim();

                const paragraphs = cleaned
                    .split(/\.\s+/)
                    .filter((p) => p.trim().length > 0)
                    .map((p) => p.trim() + (p.endsWith(".") ? "" : "."));

                const markdown = `## Page ${pageNumber}\n\n${paragraphs.join("\n\n")}`;
                return markdown;
            }),

            documentToMarkdown: Effect.fn("MarkdownConverter.documentToMarkdown")(function* (
                content: typeof DocumentContent.Type
            ) {
                const header = `# ${content.title}\n\n---\n\n`;
                const pages = content.pages
                    .map((page) => {
                        const cleaned = page.text.replace(/\s+/g, " ").trim();
                        const paragraphs = cleaned
                            .split(/\.\s+/)
                            .filter((p) => p.trim().length > 0)
                            .map((p) => p.trim() + (p.endsWith(".") ? "" : "."));
                        return `## Page ${page.pageNumber}\n\n${paragraphs.join("\n\n")}`;
                    })
                    .join("\n\n---\n\n");

                return header + pages;
            }),

            formatForLLM: Effect.fn("MarkdownConverter.formatForLLM")(function* (
                markdown: string,
                prompt?: string
            ) {
                const formatted = prompt
                    ? `${prompt}\n\n---\n\n${markdown}`
                    : `Please analyze the following document:\n\n---\n\n${markdown}`;
                return formatted;
            }),
        })
    );
}

// ============================================================================
// Combined Layer
// ============================================================================

export const PdfServicesLayer = Layer.mergeAll(PdfParser.layer, MarkdownConverter.layer);
