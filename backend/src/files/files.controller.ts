import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { FilesService } from './services/files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { InitUploadDto, CompleteUploadDto } from './dto/file.dto';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initialize a chunked/resumable upload session' })
  init(@CurrentUser() user: CurrentUserPayload, @Body() dto: InitUploadDto) {
    return this.files.initUpload(user.id, dto);
  }

  @Post('upload/:uploadId/chunk/:index')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload a single chunk' })
  @ApiConsumes('application/octet-stream')
  @ApiBody({ schema: { type: 'string', format: 'binary' } })
  @UseInterceptors(FileFieldsInterceptor([]))
  async uploadChunk(
    @CurrentUser() user: CurrentUserPayload,
    @Param('uploadId') uploadId: string,
    @Param('index') index: string,
    @Req() req: any,
  ) {
    const chunkIndex = parseInt(index, 10);
    return this.files.uploadChunk(user.id, uploadId, chunkIndex, req);
  }

  @Post('upload/:uploadId/complete')
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an upload and delete received chunks' })
  cancel(@CurrentUser() user: CurrentUserPayload, @Param('uploadId') uploadId: string) {
    return this.files.cancelUpload(user.id, uploadId);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get upload status (for resume)' })
  status(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.files.getUploadStatus(user.id, id);
  }

  @Get(':id')
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
    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res);
    });
  }
}
