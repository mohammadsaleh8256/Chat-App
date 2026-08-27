import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { Readable } from 'stream';
import { FilesService } from './services/files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { InitUploadDto, CompleteUploadDto } from './dto/file.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@ApiTags('Files')
@Controller('api/files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('upload/init')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize a chunked/resumable upload session' })
  init(@CurrentUser() user: CurrentUserPayload, @Body() dto: InitUploadDto) {
    return this.files.initUpload(user.id, dto);
  }

  @Post('upload/:uploadId/chunk/:index')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a single chunk' })
  @ApiConsumes('application/octet-stream')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  async uploadChunk(
    @CurrentUser() user: CurrentUserPayload,
    @Param('uploadId') uploadId: string,
    @Param('index') index: string,
    @Req() req: Request,
  ) {
    const chunkIndex = parseInt(index, 10);
    if (Number.isNaN(chunkIndex)) {
      return { statusCode: 400, message: 'chunk index must be a number' };
    }
    const stream = Readable.from(req as unknown as NodeJS.ReadableStream);
    return this.files.uploadChunk(user.id, uploadId, chunkIndex, stream);
  }

  @Post('upload/:uploadId/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete an upload (merge chunks + verify)' })
  complete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('uploadId') uploadId: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.files.completeUpload(user.id, uploadId, dto);
  }

  @Post('upload/:uploadId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an upload and delete received chunks' })
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('uploadId') uploadId: string) {
    return this.files.cancelUpload(user.id, uploadId);
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get upload status (for resume)' })
  status(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.files.getUploadStatus(user.id, id);
  }

  /**
   * Stream a file for inline display (images, videos, audio).
   * NO JwtAuthGuard — token is validated manually from query param so that
   * <img src>, <video>, <audio> tags can load the file.
   *
   * Use: GET /api/files/:id/stream?token=<accessToken>
   */
  @Get(':id/stream')
  @ApiOperation({ summary: 'Stream a file for inline display (token via query)' })
  async stream(
    @Param('id') id: string,
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      res.status(401).json({ error: 'Unauthorized', message: 'Token required' });
      return;
    }

    let userId: string;
    try {
      const payload: any = this.jwt.verify(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      userId = payload.sub;
    } catch {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
      return;
    }

    const attachment = await this.files.authorizeDownload(userId, id);
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', attachment.size.toString());
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalFileName)}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const stream = this.files.openReadStream(attachment.storageKey);
    return new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res);
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Securely download a file (attachment)' })
  async download(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const attachment = await this.files.authorizeDownload(user.id, id);
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', attachment.size.toString());
    const safeName = encodeURIComponent(attachment.originalFileName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);

    const stream = this.files.openReadStream(attachment.storageKey);
    return new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res);
    });
  }
}
