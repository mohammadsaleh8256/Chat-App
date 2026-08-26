import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { FILE_STORAGE_TOKEN, IFileStorage } from '../storage/file-storage.interface';
import { InitUploadDto, CompleteUploadDto } from '../dto/file.dto';
import * as crypto from 'crypto';

const MAX_CHUNK_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per chunk

@Injectable()
export class FilesService {
  private readonly logger = new Logger('FilesService');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE_TOKEN) private readonly storage: IFileStorage,
    private readonly config: ConfigService,
  ) {}

  async initUpload(userId: string, dto: InitUploadDto) {
    const maxSize = BigInt(this.config.get<string>('MAX_FILE_SIZE_BYTES', '10737418240'));
    if (BigInt(dto.fileSize) > maxSize)
      throw new BadRequestException(`حداکثر اندازه فایل ${maxSize.toString()} بایت است.`);

    const chunkSize = this.config.get<number>('CHUNK_SIZE_BYTES', 5 * 1024 * 1024);
    if (dto.totalChunks <= 0)
      throw new BadRequestException('تعداد قطعات نامعتبر است.');
    if (dto.fileSize <= 0)
      throw new BadRequestException('اندازه فایل نامعتبر است.');

    const uploadId = crypto.randomUUID();
    const storageKey = this.storage.generateStorageKey(dto.fileName, dto.mimeType || 'application/octet-stream');
    const storedFileName = storageKey.split('/').pop() || `${uploadId}.bin`;
    const chunkDirectory = `_chunks/${uploadId}`;
    const type = this.storage.detectType(dto.fileName, dto.mimeType || 'application/octet-stream');

    const attachment = await this.prisma.attachment.create({
      data: {
        uploaderId: userId,
        originalFileName: dto.fileName,
        storedFileName,
        storageKey,
        mimeType: dto.mimeType || 'application/octet-stream',
        size: BigInt(dto.fileSize),
        type,
        uploadId,
        uploadStatus: 'PENDING',
        totalChunks: dto.totalChunks,
        receivedChunks: 0,
        uploadedBytes: BigInt(0),
        chunkDirectory,
      },
    });

    // Check if chunks already exist (resume scenario)
    const { received } = await this.storage.getChunkMap(chunkDirectory, dto.totalChunks);
    if (received > 0) {
      await this.prisma.attachment.update({
        where: { id: attachment.id },
        data: {
          uploadStatus: 'UPLOADING',
          receivedChunks: received,
          uploadedBytes: BigInt(Math.floor((received / dto.totalChunks) * dto.fileSize)),
        },
      });
    }

    return {
      uploadId,
      attachmentId: attachment.id,
      chunkDirectory,
      chunkSize,
      canResume: received > 0,
      receivedChunks: received,
    };
  }

  async uploadChunk(userId: string, uploadId: string, chunkIndex: number, stream: NodeJS.ReadableStream) {
    const attachment = await this.prisma.attachment.findUnique({ where: { uploadId } });
    if (!attachment) throw new NotFoundException('آپلود یافت نشد.');
    if (attachment.uploaderId !== userId) throw new ForbiddenException('این آپلود متعلق به شما نیست.');
    if (attachment.uploadStatus === 'COMPLETED') throw new BadRequestException('این فایل قبلاً کامل شده است.');
    if (attachment.uploadStatus === 'CANCELLED') throw new BadRequestException('آپلود لغو شده است.');
    if (chunkIndex < 0 || chunkIndex >= attachment.totalChunks)
      throw new BadRequestException('شماره قطعه نامعتبر است.');

    await this.storage.saveChunk(stream, attachment.chunkDirectory!, chunkIndex);

    const { received } = await this.storage.getChunkMap(attachment.chunkDirectory!, attachment.totalChunks);
    const uploadedBytes = BigInt(Math.floor((received / attachment.totalChunks) * Number(attachment.size)));

    await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        uploadStatus: 'UPLOADING',
        receivedChunks: received,
        uploadedBytes,
      },
    });

    return {
      completed: received === attachment.totalChunks,
      receivedChunks: received,
      uploadedBytes: uploadedBytes.toString(),
    };
  }

  async completeUpload(userId: string, uploadId: string, dto: CompleteUploadDto) {
    const attachment = await this.prisma.attachment.findUnique({ where: { uploadId } });
    if (!attachment) throw new NotFoundException('آپلود یافت نشد.');
    if (attachment.uploaderId !== userId) throw new ForbiddenException('این آپلود متعلق به شما نیست.');

    const { received } = await this.storage.getChunkMap(attachment.chunkDirectory!, attachment.totalChunks);
    if (received !== attachment.totalChunks)
      throw new BadRequestException(`فقط ${received} از ${attachment.totalChunks} قطعه دریافت شده است.`);

    await this.storage.mergeChunks(attachment.chunkDirectory!, attachment.storageKey, attachment.totalChunks);

    if (dto.fileHash) {
      const hash = await this.computeHash(attachment.storageKey);
      if (hash !== dto.fileHash.toLowerCase()) {
        this.logger.warn(`Hash mismatch for upload ${uploadId}: expected=${dto.fileHash}, actual=${hash}`);
      }
      await this.prisma.attachment.update({
        where: { id: attachment.id },
        data: { fileHash: dto.fileHash },
      });
    }

    const size = await this.storage.getSize(attachment.storageKey);

    await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        uploadStatus: 'COMPLETED',
        completedAt: new Date(),
        size: BigInt(size),
      },
    });

    await this.storage.cleanupChunks(attachment.chunkDirectory!);

    return {
      attachmentId: attachment.id,
      uploadId,
      downloadUrl: `/api/files/${attachment.id}`,
      size,
    };
  }

  async cancelUpload(userId: string, uploadId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { uploadId } });
    if (!attachment) throw new NotFoundException('آپلود یافت نشد.');
    if (attachment.uploaderId !== userId) throw new ForbiddenException('این آپلود متعلق به شما نیست.');

    if (attachment.chunkDirectory) {
      await this.storage.cleanupChunks(attachment.chunkDirectory);
    }
    await this.prisma.attachment.update({
      where: { id: attachment.id },
      data: { uploadStatus: 'CANCELLED' },
    });

    return { success: true };
  }

  async getUploadStatus(userId: string, uploadId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { uploadId } });
    if (!attachment) throw new NotFoundException('آپلود یافت نشد.');
    if (attachment.uploaderId !== userId) throw new ForbiddenException('دسترسی غیرمجاز.');
    return {
      uploadId,
      attachmentId: attachment.id,
      fileName: attachment.originalFileName,
      size: attachment.size.toString(),
      uploadedBytes: attachment.uploadedBytes.toString(),
      totalChunks: attachment.totalChunks,
      receivedChunks: attachment.receivedChunks,
      status: attachment.uploadStatus,
      createdAt: attachment.createdAt,
      completedAt: attachment.completedAt,
    };
  }

  /**
   * Secure download — only the uploader OR any participant of the conversation the message belongs to.
   */
  async authorizeDownload(userId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { message: true },
    });
    if (!attachment || attachment.deletedAt) throw new NotFoundException('فایل یافت نشد.');

    // Uploader always has access
    if (attachment.uploaderId === userId) return attachment;

    // Otherwise must be a participant of the conversation
    if (attachment.message) {
      const p = await this.prisma.conversationParticipant.findFirst({
        where: { conversationId: attachment.message.conversationId, userId },
      });
      if (p) return attachment;
    }

    throw new ForbiddenException('شما به این فایل دسترسی ندارید.');
  }

  /** Open a read stream for the file at the given storage key. */
  openReadStream(storageKey: string): NodeJS.ReadableStream {
    return this.storage.openRead(storageKey);
  }

  private async computeHash(storageKey: string): Promise<string> {
    const stream = this.storage.openRead(storageKey) as any;
    const hash = crypto.createHash('sha256');
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    return hash.digest('hex');
  }
}
