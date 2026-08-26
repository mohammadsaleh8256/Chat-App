import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { IFileStorage } from './file-storage.interface';

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.mp3', '.wav', '.ogg', '.m4a', '.flac',
  '.pdf', '.zip', '.rar',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.md',
]);

@Injectable()
export class LocalFileStorage implements IFileStorage {
  private readonly logger = new Logger('LocalFileStorage');
  private readonly root: string;

  constructor(config: ConfigService) {
    const dir = config.get<string>('UPLOAD_DIR', './uploads');
    this.root = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
    fs.mkdir(this.root, { recursive: true }).catch((err) => {
      this.logger.error(`Failed to create upload dir ${this.root}: ${err.message}`);
    });
  }

  async saveChunk(stream: NodeJS.ReadableStream, chunkDirectory: string, chunkIndex: number): Promise<void> {
    const dir = this.resolve(chunkDirectory);
    await fs.mkdir(dir, { recursive: true });
    const chunkPath = path.join(dir, `${String(chunkIndex).padStart(8, '0')}.part`);
    const ws = createWriteStream(chunkPath, { flags: 'w' });
    await pipeline(stream, ws);
  }

  async mergeChunks(chunkDirectory: string, targetStorageKey: string, totalChunks: number): Promise<void> {
    const srcDir = this.resolve(chunkDirectory);
    const targetPath = this.resolve(targetStorageKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    const ws = createWriteStream(targetPath, { flags: 'w' });
    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(srcDir, `${String(i).padStart(8, '0')}.part`);
        try {
          const stat = await fs.stat(chunkPath);
          if (!stat.isFile()) throw new Error(`Chunk ${i} missing`);
        } catch {
          throw new Error(`Chunk ${i} missing in ${chunkDirectory}`);
        }
        const rs = createReadStream(chunkPath);
        await pipeline(rs, ws, { end: false });
      }
    } finally {
      ws.end();
      await new Promise<void>((resolve, reject) => {
        ws.on('finish', () => resolve());
        ws.on('error', reject);
      });
    }
  }

  openRead(storageKey: string): NodeJS.ReadableStream {
    const full = this.resolve(storageKey);
    return createReadStream(full);
  }

  async getSize(storageKey: string): Promise<number> {
    try {
      const stat = await fs.stat(this.resolve(storageKey));
      return stat.size;
    } catch { return 0; }
  }

  async delete(storageKey: string): Promise<void> {
    try { await fs.unlink(this.resolve(storageKey)); } catch { /* ignore */ }
  }

  async cleanupChunks(chunkDirectory: string): Promise<void> {
    try {
      await fs.rm(this.resolve(chunkDirectory), { recursive: true, force: true });
    } catch (err) {
      this.logger.warn(`cleanupChunks: ${err}`);
    }
  }

  async deleteChunk(chunkDirectory: string, chunkIndex: number): Promise<void> {
    try {
      await fs.unlink(path.join(this.resolve(chunkDirectory), `${String(chunkIndex).padStart(8, '0')}.part`));
    } catch { /* ignore */ }
  }

  async getChunkMap(chunkDirectory: string, totalChunks: number): Promise<{ received: number; map: boolean[] }> {
    const map = new Array(totalChunks).fill(false);
    let received = 0;
    try {
      const files = await fs.readdir(this.resolve(chunkDirectory));
      for (const f of files) {
        const m = f.match(/^(\d{8})\.part$/);
        if (m) {
          const idx = parseInt(m[1], 10);
          if (idx >= 0 && idx < totalChunks) {
            map[idx] = true;
            received++;
          }
        }
      }
    } catch { /* directory doesn't exist yet */ }
    return { received, map };
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const stat = await fs.stat(this.resolve(storageKey));
      return stat.isFile();
    } catch { return false; }
  }

  generateStorageKey(originalFileName: string, _mimeType: string): string {
    const ext = path.extname(originalFileName).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '';
    const id = require('crypto').randomUUID().replace(/-/g, '');
    const yyyy = new Date().getFullYear();
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    return path.posix.join('attachments', `${yyyy}`, `${mm}`, `${id}${safeExt}`);
  }

  detectType(fileName: string, mimeType: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const map: Record<string, string> = {
      '.jpg': 'IMAGE', '.jpeg': 'IMAGE', '.png': 'IMAGE', '.gif': 'IMAGE', '.webp': 'IMAGE', '.bmp': 'IMAGE',
      '.mp4': 'VIDEO', '.mov': 'VIDEO', '.avi': 'VIDEO', '.mkv': 'VIDEO', '.webm': 'VIDEO',
      '.mp3': 'AUDIO', '.wav': 'AUDIO', '.ogg': 'AUDIO', '.m4a': 'AUDIO', '.flac': 'AUDIO',
      '.pdf': 'PDF',
      '.zip': 'ZIP',
      '.rar': 'RAR',
      '.doc': 'DOCUMENT', '.docx': 'DOCUMENT',
      '.xls': 'SPREADSHEET', '.xlsx': 'SPREADSHEET',
      '.ppt': 'PRESENTATION', '.pptx': 'PRESENTATION',
      '.txt': 'TEXT', '.md': 'TEXT',
    };
    if (map[ext]) return map[ext];
    const mt = (mimeType || '').toLowerCase();
    if (mt.startsWith('image/')) return 'IMAGE';
    if (mt.startsWith('video/')) return 'VIDEO';
    if (mt.startsWith('audio/')) return 'AUDIO';
    return 'OTHER';
  }

  /**
   * Resolve a storage key to an absolute filesystem path, guarding against path traversal.
   */
  private resolve(storageKey: string): string {
    const full = path.resolve(this.root, storageKey);
    if (!full.startsWith(this.root + path.sep) && full !== this.root) {
      throw new Error('Path traversal detected.');
    }
    return full;
  }
}
