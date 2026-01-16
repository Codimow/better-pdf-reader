import { Context, Effect, Layer, Schema } from "effect";

// ============================================================================
// Data Models
// ============================================================================

export class StoredDocument extends Schema.Class<StoredDocument>("StoredDocument")({
    id: Schema.String,
    name: Schema.String,
    type: Schema.Literal("pdf", "epub"),
    data: Schema.Uint8ArrayFromSelf,
    createdAt: Schema.DateFromSelf,
    lastOpenedAt: Schema.DateFromSelf,
    currentPage: Schema.Number,
    totalPages: Schema.Number,
}) { }

export class DocumentMetadata extends Schema.Class<DocumentMetadata>("DocumentMetadata")({
    id: Schema.String,
    name: Schema.String,
    type: Schema.Literal("pdf", "epub"),
    createdAt: Schema.DateFromSelf,
    lastOpenedAt: Schema.DateFromSelf,
    currentPage: Schema.Number,
    totalPages: Schema.Number,
}) { }

// ============================================================================
// Errors
// ============================================================================

export class DocumentNotFoundError extends Schema.TaggedError<DocumentNotFoundError>()(
    "DocumentNotFoundError",
    { id: Schema.String }
) { }

export class StorageError extends Schema.TaggedError<StorageError>()(
    "StorageError",
    { message: Schema.String, cause: Schema.Unknown }
) { }

// ============================================================================
// Document Storage Service
// ============================================================================

const DB_NAME = "better-pdf-storage";
const DB_VERSION = 1;
const STORE_NAME = "documents";

// Lazy singleton for database connection
let dbPromise: Promise<IDBDatabase> | null = null;

function getDatabase(): Promise<IDBDatabase> {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("IndexedDB is only available in the browser"));
    }

    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            dbPromise = null;
            reject(new Error("Failed to open database"));
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
                store.createIndex("name", "name");
                store.createIndex("createdAt", "createdAt");
                store.createIndex("lastOpenedAt", "lastOpenedAt");
            }
        };
    });

    return dbPromise;
}

export class DocumentStorage extends Context.Tag("@app/DocumentStorage")<
    DocumentStorage,
    {
        readonly save: (doc: typeof StoredDocument.Type) => Effect.Effect<void, StorageError>;
        readonly get: (id: string) => Effect.Effect<typeof StoredDocument.Type, DocumentNotFoundError | StorageError>;
        readonly list: () => Effect.Effect<typeof DocumentMetadata.Type[], StorageError>;
        readonly delete: (id: string) => Effect.Effect<void, StorageError>;
        readonly updateLastOpened: (id: string, page: number) => Effect.Effect<void, DocumentNotFoundError | StorageError>;
    }
>() {
    static readonly layer = Layer.succeed(
        DocumentStorage,
        DocumentStorage.of({
            save: Effect.fn("DocumentStorage.save")(function* (doc: typeof StoredDocument.Type) {
                const db = yield* Effect.tryPromise({
                    try: () => getDatabase(),
                    catch: (error) => new StorageError({ message: "Failed to open database", cause: error }),
                });

                // Convert to plain object for IndexedDB (Schema.Class instances may not serialize properly)
                const plainDoc = {
                    id: doc.id,
                    name: doc.name,
                    type: doc.type,
                    data: doc.data,
                    createdAt: doc.createdAt,
                    lastOpenedAt: doc.lastOpenedAt,
                    currentPage: doc.currentPage,
                    totalPages: doc.totalPages,
                };

                yield* Effect.tryPromise({
                    try: () => new Promise<void>((resolve, reject) => {
                        try {
                            const transaction = db.transaction(STORE_NAME, "readwrite");
                            const store = transaction.objectStore(STORE_NAME);
                            const request = store.put(plainDoc);

                            request.onsuccess = () => resolve();
                            request.onerror = () => {
                                console.error("[Storage] Save error:", request.error);
                                reject(request.error);
                            };

                            transaction.onerror = () => {
                                console.error("[Storage] Transaction error:", transaction.error);
                                reject(transaction.error);
                            };
                        } catch (e) {
                            console.error("[Storage] Exception during save:", e);
                            reject(e);
                        }
                    }),
                    catch: (error) => {
                        console.error("[Storage] Failed to save document:", error);
                        return new StorageError({ message: "Failed to save document", cause: error });
                    },
                });
            }),

            get: Effect.fn("DocumentStorage.get")(function* (id: string) {
                const db = yield* Effect.tryPromise({
                    try: () => getDatabase(),
                    catch: (error) => new StorageError({ message: "Failed to open database", cause: error }),
                });

                const doc = yield* Effect.tryPromise({
                    try: () => new Promise<typeof StoredDocument.Type | undefined>((resolve, reject) => {
                        const transaction = db.transaction(STORE_NAME, "readonly");
                        const store = transaction.objectStore(STORE_NAME);
                        const request = store.get(id);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new StorageError({ message: "Failed to get document", cause: error }),
                });

                if (!doc) {
                    return yield* new DocumentNotFoundError({ id });
                }
                return doc;
            }),

            list: Effect.fn("DocumentStorage.list")(function* () {
                const db = yield* Effect.tryPromise({
                    try: () => getDatabase(),
                    catch: (error) => new StorageError({ message: "Failed to open database", cause: error }),
                });

                const docs = yield* Effect.tryPromise({
                    try: () => new Promise<typeof StoredDocument.Type[]>((resolve, reject) => {
                        const transaction = db.transaction(STORE_NAME, "readonly");
                        const store = transaction.objectStore(STORE_NAME);
                        const request = store.getAll();
                        request.onsuccess = () => resolve(request.result || []);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new StorageError({ message: "Failed to list documents", cause: error }),
                });

                return docs.map((doc) => ({
                    id: doc.id,
                    name: doc.name,
                    type: doc.type,
                    createdAt: doc.createdAt,
                    lastOpenedAt: doc.lastOpenedAt,
                    currentPage: doc.currentPage,
                    totalPages: doc.totalPages,
                })) as typeof DocumentMetadata.Type[];
            }),

            delete: Effect.fn("DocumentStorage.delete")(function* (id: string) {
                const db = yield* Effect.tryPromise({
                    try: () => getDatabase(),
                    catch: (error) => new StorageError({ message: "Failed to open database", cause: error }),
                });

                yield* Effect.tryPromise({
                    try: () => new Promise<void>((resolve, reject) => {
                        const transaction = db.transaction(STORE_NAME, "readwrite");
                        const store = transaction.objectStore(STORE_NAME);
                        const request = store.delete(id);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new StorageError({ message: "Failed to delete document", cause: error }),
                });
            }),

            updateLastOpened: Effect.fn("DocumentStorage.updateLastOpened")(function* (
                id: string,
                page: number
            ) {
                const db = yield* Effect.tryPromise({
                    try: () => getDatabase(),
                    catch: (error) => new StorageError({ message: "Failed to open database", cause: error }),
                });

                // Get the document first
                const doc = yield* Effect.tryPromise({
                    try: () => new Promise<typeof StoredDocument.Type | undefined>((resolve, reject) => {
                        const transaction = db.transaction(STORE_NAME, "readonly");
                        const store = transaction.objectStore(STORE_NAME);
                        const request = store.get(id);
                        request.onsuccess = () => resolve(request.result);
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new StorageError({ message: "Failed to get document", cause: error }),
                });

                if (!doc) {
                    return yield* new DocumentNotFoundError({ id });
                }

                const updated = {
                    ...doc,
                    lastOpenedAt: new Date(),
                    currentPage: page,
                };

                // Save the updated document
                yield* Effect.tryPromise({
                    try: () => new Promise<void>((resolve, reject) => {
                        const transaction = db.transaction(STORE_NAME, "readwrite");
                        const store = transaction.objectStore(STORE_NAME);
                        const request = store.put(updated);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    }),
                    catch: (error) => new StorageError({ message: "Failed to update document", cause: error }),
                });
            }),
        })
    );
}
