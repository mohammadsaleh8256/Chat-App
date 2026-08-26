export interface FileMetadata {
  fileName: string;
  mimeType: string;
  size: bigint;
  ext: string;
}

export const FILE_STORAGE_TOKEN = Symbol('FILE_STORAGE');

export interface IFileStorage {
  /** Save a stream to storage under the given key. Returns the storageKey. */
  saveChunk(stream: NodeJS.ReadableStream, chunkDirectory: string, chunkIndex: number): Promise<void>;

  /** Merge all chunks into a single file. */
  mergeChunks(chunkDirectory: string, targetStorageKey: string, totalChunks: number): Promise<void>;

  /** Open a read stream for the file. */
  openRead(storageKey: string): NodeJS.ReadableStream;

  /** Get the absolute size of a stored file. */
  getSize(storageKey: string): Promise<number>;

  /** Delete a file. */
  delete(storageKey: string): Promise<void>;

  /** Delete a chunk directory. */
  cleanupChunks(chunkDirectory: string): Promise<void>;

  /** Delete a single chunk (for retry). */
  deleteChunk(chunkDirectory: string, chunkIndex: number): Promise<void>;

  /** Return the map of received chunks for resume. */
  getChunkMap(chunkDirectory: string, totalChunks: number): Promise<{ received: number; map: boolean[] }>;

  /** Check if a file exists. */
  exists(storageKey: string): Promise<boolean>;

  /** Generate a safe storage key (path-traversal-safe). */
  generateStorageKey(originalFileName: string, mimeType: string): string;

  /** Detect the attachment type from filename + mime. */
  detectType(fileName: string, mimeType: string): string;
}
